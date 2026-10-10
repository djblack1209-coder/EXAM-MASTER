import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  emptyLearningState,
  applyLearningOperation,
  summarizeLearning,
  gradeAnswer,
  classifyResponse,
  normalizePrivateSyncOperation,
  dayKey,
  LEARNING_TRACKS,
  normalizeLearningTask,
  learningTaskContext,
  createMaterialObjectiveQuestion,
  createMaterialObjectiveVariant
} from '@/services/learning/learning-domain.js';
import {
  userDirective,
  executeLearningTool,
  createArithmeticQuestion,
  nextStrategy
} from '@/services/learning/learning-tools.js';
import { createLearningRepository, LEARNING_KEY } from '@/services/learning/learning-repository.js';
import { createLearningWriteLease } from '@/services/learning/learning-write-lease.js';
import { synchronizeLearning } from '@/services/learning/learning-sync.js';
import { parsePastedMaterial } from '@/services/learning/material-intake.js';
const q = (id, answer = '4') => ({
  id,
  version: 1,
  prompt: `计算题 ${id}`,
  scope: 'private',
  subject: '数学',
  knowledgePoint: '运算',
  validation: { type: 'number', answer, authority: 'human_reviewed', evidenceId: `review_${id}` },
  uncertainties: []
});
let state;
let serial;
const apply = (type, data, id = `op${++serial}`, at = Date.parse('2026-09-29T10:00:00Z')) => {
  const outcome = applyLearningOperation(state, { id, type, data, at });
  state = outcome.state;
  return outcome.result;
};
const start = () => apply('conversation.start', { goal: '学习运算' }, 'c1');
const focus = (question) => {
  apply('question.add', { question });
  apply('question.focus', { conversationId: 'c1', questionKey: `${question.id}@1` });
};
const answer = (value, id, extra = {}) =>
  apply('attempt.submit', { conversationId: 'c1', answer: value, ...extra }, id);
beforeEach(() => {
  state = emptyLearningState('u1', 'Asia/Shanghai');
  serial = 0;
});

describe('刷题原作答本地恢复与写锁撤销', () => {
  let bridge, repository, lease;
  const input = () => ({
    currentQuestion: { id: 'q1', question: '原题', type: 'single_choice', options: ['甲', '乙'] },
    userAnswer: 'A',
    sessionId: 'quiz_original',
    attemptId: 'quiz_answer_original'
  });
  beforeEach(async () => {
    uni.clearStorageSync();
    vi.resetModules();
    bridge = await import('@/services/learning/quiz-learning-bridge.js');
    repository = (await import('@/services/learning/learning-repository.js')).learningRepository;
    lease = (await import('@/services/learning/learning-write-lease.js')).learningWriteLease;
  });
  afterEach(() => {
    lease.release();
    vi.restoreAllMocks();
    uni.clearStorageSync();
  });

  it('restores only explicit identified choices, preserving legacy absence and neutral reviews and making retry a no-op', async () => {
    const question = input().currentQuestion;
    const saved = {
      sessionId: 'quiz_original',
      questions: [question, { ...question, id: 'q2', type: 'analysis' }],
      answeredQuestions: [
        { index: 0, questionId: 'q1', userChoice: 0 },
        { index: 1, questionId: 'q2', userChoice: 'flashcard_rating_1', attemptId: 'quiz_answer_neutral' },
        { index: 0, questionId: 'q1', userChoice: 0, attemptId: 'quiz_answer_original' }
      ]
    };
    const original = JSON.stringify(saved);
    expect(await bridge.restoreQuizLearningAttempts(saved)).toEqual({ restored: 1, reused: 0, skipped: 2 });
    const before = repository.read();
    expect(before.attempts).toHaveLength(1);
    expect(before.attempts[0].answer).toBe('A');
    expect(before.attempts[0].grade.status).toBe('pending');
    expect(await bridge.restoreQuizLearningAttempts(saved)).toEqual({ restored: 0, reused: 1, skipped: 2 });
    expect(repository.read()).toEqual(before);
    expect(JSON.stringify(saved)).toBe(original);
  });

  it('rejects altered content using an old attempt identifier without writing a new question or answer', async () => {
    await bridge.recordQuizLearningAttempt(input());
    const before = repository.read();
    await expect(bridge.recordQuizLearningAttempt({ ...input(), userAnswer: 'B' })).rejects.toMatchObject({
      code: 'CONFLICT'
    });
    await expect(
      bridge.recordQuizLearningAttempt({
        ...input(),
        currentQuestion: { ...input().currentQuestion, question: '不同题面' }
      })
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(repository.read()).toEqual(before);
  });

  it('rejects ambiguous reused identifiers before writing any part of the restore batch', async () => {
    const before = JSON.stringify(global.__mockStorage);
    await expect(
      bridge.restoreQuizLearningAttempts({
        sessionId: 'quiz_original',
        questions: [input().currentQuestion, { ...input().currentQuestion, id: 'q2' }],
        answeredQuestions: [
          { index: 0, questionId: 'q1', userChoice: 0, attemptId: 'quiz_answer_original' },
          { index: 1, questionId: 'q2', userChoice: 1, attemptId: 'quiz_answer_original' }
        ]
      })
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(JSON.stringify(global.__mockStorage)).toBe(before);
  });

  it('keeps stopped-session accepted receipts idempotent and rejects a new late submission before any new fact', async () => {
    await bridge.recordQuizLearningAttempt(input());
    repository.commit({
      id: 'stop-original',
      type: 'task.stop',
      data: { conversationId: 'quiz_quiz_original' }
    });
    const before = repository.read();
    expect((await bridge.recordQuizLearningAttempt(input())).reused).toBe(true);
    await expect(bridge.recordQuizLearningAttempt({ ...input(), attemptId: 'quiz_answer_late' })).rejects.toMatchObject(
      { code: 'STOPPED' }
    );
    expect(repository.read()).toEqual(before);
  });

  it.each(['owner', 'lifecycle', 'closed'])(
    'rejects %s changes while awaiting ownership without writing quiz facts',
    async (change) => {
      repository.commit({ id: 'original', type: 'conversation.start', data: { goal: '原学习' } });
      let finish;
      vi.spyOn(lease, 'waitUntilWritable').mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finish = resolve;
          })
      );
      let valid = true;
      const pending = bridge.recordQuizLearningAttempt({ ...input(), canContinue: () => valid });
      const rejected = expect(pending).rejects.toMatchObject({ code: 'CONTEXT_CHANGED' });
      if (change === 'owner') uni.setStorageSync('EXAM_USER_ID', 'local-other');
      if (change === 'lifecycle') repository.rollback();
      if (change === 'closed') valid = false;
      const before = JSON.stringify(global.__mockStorage);
      finish('unsupported');
      await rejected;
      expect(JSON.stringify(global.__mockStorage)).toBe(before);
    }
  );

  it('revokes a pending lock wait when the owning page releases it', async () => {
    let callback;
    const local = createLearningWriteLease({
      async request(_name, _options, handler) {
        callback = handler;
      }
    });
    const pending = local.waitUntilWritable('u1');
    const rejected = expect(pending).rejects.toMatchObject({ code: 'CONTEXT_CHANGED' });
    await Promise.resolve();
    local.release();
    await rejected;
    await callback({ name: 'released' });
  });

  it('keeps another window protected and does not wait beyond the bounded pending acquisition', async () => {
    const occupied = createLearningWriteLease({
      async request(_name, _options, callback) {
        return callback(null);
      }
    });
    await expect(occupied.waitUntilWritable('u1')).rejects.toMatchObject({ code: 'OTHER_WINDOW_ACTIVE' });
    occupied.release();
    vi.useFakeTimers();
    const pendingLease = createLearningWriteLease({ async request() {} });
    try {
      const pending = pendingLease.waitUntilWritable('u1');
      const rejected = expect(pending).rejects.toMatchObject({ code: 'WRITE_LEASE_PENDING' });
      await vi.advanceTimersByTimeAsync(2000);
      await rejected;
    } finally {
      pendingLease.release();
      vi.useRealTimers();
    }
  });
});

describe('新资料字段完整校验与历史合同回放', () => {
  const source = (content) => parsePastedMaterial(content, 'field-contract');
  const literal = (material, from = 'Departure city', contract) =>
    createMaterialObjectiveQuestion('reading-field', material, {
      segmentId: 'field-contract_1',
      kind: 'literal',
      from,
      ...(contract ? { contract } : {})
    });
  it.each([
    'Answers',
    'Solutions',
    'Annotations',
    'AnswerKey',
    'Answer_Keys',
    'Student answers',
    'Student_response',
    'User responses',
    'Ａｎｓｗｅｒｓ',
    'Ｓｏｌｕｔｉｏｎｓ'
  ])('新练习拒绝答案或作答字段 %s', (label) => {
    expect(() => literal(source(`${label}: Bristol`), label)).toThrow(
      expect.objectContaining({ code: 'CAPABILITY_UNAVAILABLE' })
    );
  });
  it.each(['Answer key', 'Travel notes', 'Broken field:', 'x'.repeat(301) + ': value'])(
    '不静默丢弃非空原文行 %s',
    (line) => {
      expect(() => literal(source(`${line}\nDeparture city: Bristol`))).toThrow(
        expect.objectContaining({ code: 'CAPABILITY_UNAVAILABLE' })
      );
    }
  );
  it.each(['primary', 'junior', 'senior', 'postgraduate', 'civil', 'ielts', 'toefl'])(
    '%s 只核验完整原文中的字面值，变式和停止分别保存',
    (track) => {
      apply('conversation.start', { goal: '定位所给文本', task: { track } }, 'c1');
      apply('material.add', { material: source('\nDeparture city: Bristol\r\nArrival city: Oxford\n') });
      const question = literal(state.materials[0]);
      expect(question.materialExercise.contract).toBe('material-objective-v3');
      focus(question);
      expect(answer('London', 'reading-first', { explicit: true }).grade.outcome).toBe('wrong');
      apply('hint.add', { conversationId: 'c1', level: 1, content: '核对出发地字段的原文' });
      expect(answer('Bristol', 'reading-revision', { explicit: true })).toMatchObject({
        kind: 'revision',
        grade: { status: 'reliable', outcome: 'correct' }
      });
      const variant = createMaterialObjectiveVariant('reading-variant', question, state);
      expect(variant.materialExercise).toMatchObject({ contract: 'material-objective-v3', from: 'Arrival city' });
      expect(variant.prompt).not.toContain('Departure city');
      focus(variant);
      expect(answer('Oxford', 'reading-independent', { explicit: true })).toMatchObject({
        kind: 'variant',
        hints: [],
        grade: { status: 'reliable', outcome: 'correct' }
      });
      apply('task.stop', { conversationId: 'c1', source: 'self_report' });
      expect(state.conversations[0].stopped).toBe(true);
      expect(state.attempts.map((a) => a.answer)).toEqual(['London', 'Bristol', 'Oxford']);
      expect(summarizeLearning(state).first).toMatchObject({ numerator: 1, denominator: 1 });
    }
  );
  it.each(['material-objective-v1', 'material-objective-v2'])(
    '历史 %s 保留原来允许的标题与题干，同步重新构建原规则',
    (contract) => {
      start();
      apply('material.add', { material: source('Travel notes\n2024: 80\n2025: 100') });
      const old = createMaterialObjectiveQuestion('legacy-field', state.materials[0], {
        contract,
        segmentId: 'field-contract_1',
        kind: 'growth_percent',
        from: '2024',
        to: '2025'
      });
      expect(old.prompt.startsWith('根据所给资料完成练习：')).toBe(true);
      const operation = normalizePrivateSyncOperation({
        id: 'legacy-add',
        type: 'question.add',
        data: { question: old }
      });
      apply(operation.type, operation.data, operation.id);
      expect(state.questions[0]).toMatchObject(old);
      expect(gradeAnswer(state.questions[0], '25%')).toMatchObject({ status: 'reliable', outcome: 'correct' });
    }
  );
  it('新字段题拒绝只改合同降版，仍由保存来源重建答案', () => {
    start();
    apply('material.add', { material: source('Departure city: Bristol\nArrival city: Oxford') });
    const question = literal(state.materials[0]);
    expect(() =>
      apply('question.add', {
        question: { ...question, materialExercise: { ...question.materialExercise, contract: 'material-objective-v1' } }
      })
    ).toThrow(expect.objectContaining({ code: 'SOURCE_MISMATCH' }));
    const incoming = normalizePrivateSyncOperation({
      id: 'new-field',
      type: 'question.add',
      data: {
        question: { ...question, validation: { ...question.validation, answer: 'London' } }
      }
    });
    apply(incoming.type, incoming.data, incoming.id);
    expect(state.questions[0].validation.answer).toBe('Bristol');
    expect(gradeAnswer(state.questions[0], 'London').outcome).toBe('wrong');
  });
  it('来源标记只核对字段键，原答中的答案字样和Unicode仍作为文字', () => {
    const q = literal(source('Departure city: Answers stay as text 🧭\nAnswering city: Oxford'));
    expect(q.validation.answer).toBe('Answers stay as text 🧭');
    expect(gradeAnswer(q, 'Answers stay as text 🧭')).toMatchObject({ status: 'reliable', outcome: 'correct' });
    expect(
      gradeAnswer({ ...q, validation: { ...q.validation, evidenceId: 'material-objective-v1' } }, q.validation.answer)
    ).toMatchObject({ status: 'pending', outcome: null });
  });
  it('未被选中的答案字段仍阻止新数量题，完整纯数值字段保留精确小数规则', () => {
    expect(() =>
      createMaterialObjectiveQuestion('numeric-bad', source('Answers: 80\n2024: 80\n2025: 100'), {
        segmentId: 'field-contract_1',
        kind: 'growth_percent',
        from: '2024',
        to: '2025'
      })
    ).toThrow(expect.objectContaining({ code: 'CAPABILITY_UNAVAILABLE' }));
    const q = createMaterialObjectiveQuestion('numeric-exact', source('部分: 10\n整体: 30'), {
      segmentId: 'field-contract_1',
      kind: 'share_percent',
      from: '部分',
      to: '整体'
    });
    expect(q.materialExercise.contract).toBe('material-objective-v3');
    expect(gradeAnswer(q, '100/3%')).toMatchObject({ status: 'reliable', outcome: 'correct' });
    expect(gradeAnswer(q, '33.333333%')).toMatchObject({ status: 'reliable', outcome: 'wrong' });
  });
});

describe('对话学习的事实、统计与纠错', () => {
  it('七个方向与通用任务独立保存，旧对话不猜年级、考试版本或官方能力', () => {
    for (const track of Object.keys(LEARNING_TRACKS)) {
      const c = apply('conversation.start', {
        goal: '同一任务',
        task: { track, stage: '明确填写的阶段', edition: '版本未核对' }
      });
      expect(learningTaskContext(state, c.id)).toMatchObject({
        track,
        stage: '明确填写的阶段',
        edition: '版本未核对',
        evaluation: 'pending_reference',
        curriculumCoverage: 'unverified',
        officialScore: 'unverified'
      });
    }
    start();
    expect(learningTaskContext(state, 'c1')).toMatchObject({ track: 'general', stage: null, edition: null });
    for (const invalid of [
      { track: 'invented' },
      { track: 'primary', officialScore: 9 },
      { stage: 6 },
      { contract: 'v9' }
    ])
      expect(() => normalizeLearningTask(invalid)).toThrow();
  });
  it('资料规则由原文重建，伪造答案、题干、版本与批注区域不能提升校验权限', () => {
    start();
    apply(
      'material.add',
      { material: parsePastedMaterial('2024: 80\n2025: 100\n2026: 150', 'source') },
      'source-import'
    );
    const material = state.materials[0];
    const input = { segmentId: 'source_1', kind: 'growth_percent', from: '2024', to: '2025' };
    const q = createMaterialObjectiveQuestion('growth', material, input);
    expect(q.prompt).not.toContain('2026: 150');
    const sync = normalizePrivateSyncOperation({
      id: 'new-q',
      type: 'question.add',
      data: { question: { ...q, validation: { ...q.validation, answer: '999' } } }
    });
    expect(sync.data.question.validation).toBeNull();
    apply(sync.type, sync.data, sync.id);
    expect(gradeAnswer(state.questions.at(-1), '25%')).toMatchObject({ status: 'reliable', outcome: 'correct' });
    expect(gradeAnswer(state.questions.at(-1), '25')).toMatchObject({ status: 'pending' });
    for (const bad of [
      { ...q, id: 'bad-prompt', prompt: q.prompt + '额外条件' },
      { ...q, id: 'bad-version', source: { ...q.source, extractionEventId: 'invented' } },
      { ...q, id: 'bad-rubric', rubric: { id: 'invented' } }
    ])
      expect(() => apply('question.add', { question: bad })).toThrow();
    expect(() =>
      createMaterialObjectiveQuestion('wrong', parsePastedMaterial('Answer: 25', 'answer-zone'), {
        segmentId: 'answer-zone_1',
        kind: 'literal',
        from: 'Answer'
      })
    ).toThrow();
    expect(() =>
      createMaterialObjectiveQuestion('duplicate', parsePastedMaterial('year: 80\nyear: 100', 'duplicate'), {
        segmentId: 'duplicate_1',
        kind: 'literal',
        from: 'year'
      })
    ).toThrow();
  });
  it.each([
    ['decimal-increase', 'difference', '0.1', '0.3', '0.2', 'correct'],
    ['decimal-fraction', 'difference', '0.1', '0.3', '1/5', 'correct'],
    ['decimal-decrease', 'difference', '12.75', '10.5', '-2.25', 'correct'],
    ['exact-not-nearby', 'difference', '0.1', '0.3', '0.200000001', 'wrong'],
    ['decimal-growth', 'growth_percent', '12.5', '15', '20%', 'correct'],
    ['decimal-negative-growth', 'growth_percent', '12.5', '10', '-20%', 'correct'],
    ['zero-current', 'growth_percent', '12.5', '0', '-100%', 'correct'],
    ['decimal-share', 'share_percent', '12.5', '50', '25%', 'correct'],
    ['zero-share', 'share_percent', '0', '50', '0%', 'correct'],
    ['whole-share', 'share_percent', '50', '50', '100%', 'correct'],
    ['recurring-share', 'share_percent', '1', '3', '100/3%', 'correct'],
    ['rounded-share-not-exact', 'share_percent', '1', '3', '33.333333%', 'wrong']
  ])('%s 按所给数值精确校验，不以浮点容差或模型意见放宽', (_id, kind, from, to, response, outcome) => {
    const question = createMaterialObjectiveQuestion(
      'exact-material',
      parsePastedMaterial(`甲: ${from}\n乙: ${to}`, 'exact'),
      {
        segmentId: 'exact_1',
        kind,
        from: '甲',
        to: '乙'
      }
    );
    expect(question.materialExercise.contract).toBe('material-objective-v3');
    expect(gradeAnswer(question, response)).toMatchObject({ status: 'reliable', outcome });
    expect(classifyResponse(response, question)).toBe('answer');
  });
  it.each(['25', '25％', '25%或20%', '25/0%', '25+0%', '1e2%', 'require("fs")%', '9'.repeat(300) + '%'])(
    '占比不猜百分号或执行表达式：%s',
    (response) => {
      const question = createMaterialObjectiveQuestion('share', parsePastedMaterial('部分: 12.5\n整体: 50', 'share'), {
        segmentId: 'share_1',
        kind: 'share_percent',
        from: '部分',
        to: '整体'
      });
      expect(gradeAnswer(question, response)).toMatchObject({ status: 'pending', outcome: null });
      expect(classifyResponse(response, question)).not.toBe('answer');
    }
  );
  it.each([
    ['share_percent', '-1', '10'],
    ['share_percent', '11', '10'],
    ['share_percent', '1', '0'],
    ['growth_percent', '0', '10'],
    ['growth_percent', '1', '-1'],
    ['difference', '12.5万元', '15万元'],
    ['difference', '1,000', '2000'],
    ['difference', '1/2', '1'],
    ['difference', '1e3', '2000'],
    ['difference', '0.0000001', '1'],
    ['difference', '-999999999', '999999999']
  ])('不明确或超限字段不建题：%s %s %s', (kind, from, to) => {
    expect(() =>
      createMaterialObjectiveQuestion('blocked', parsePastedMaterial(`甲: ${from}\n乙: ${to}`, 'blocked'), {
        segmentId: 'blocked_1',
        kind,
        from: '甲',
        to: '乙'
      })
    ).toThrow();
    expect(state.conversations).toHaveLength(0);
  });
  it('旧整数合同仍可回放，新合同同步重建答案、拒绝降版，并跳过不适用的变式字段', () => {
    start();
    apply('material.add', {
      material: parsePastedMaterial('部分: 12.5\n整体: 50\n过小整体: 8\n下一整体: 62.5', 'exact-source')
    });
    const material = state.materials[0];
    const original = createMaterialObjectiveQuestion('share', material, {
      segmentId: 'exact-source_1',
      kind: 'share_percent',
      from: '部分',
      to: '整体'
    });
    const sync = normalizePrivateSyncOperation({
      id: 'exact-sync',
      type: 'question.add',
      data: {
        question: {
          ...original,
          validation: { ...original.validation, answer: '999', inputs: { from: { value: '1' } } }
        }
      }
    });
    apply(sync.type, sync.data, sync.id);
    expect(gradeAnswer(state.questions[0], '25%').outcome).toBe('correct');
    const variant = createMaterialObjectiveVariant('share-variant', state.questions[0], state);
    expect(variant.materialExercise).toMatchObject({ contract: 'material-objective-v3', from: '部分', to: '下一整体' });
    expect(gradeAnswer(variant, '20%').outcome).toBe('correct');
    expect(() =>
      apply('question.add', {
        question: {
          ...original,
          id: 'downgrade',
          materialExercise: { ...original.materialExercise, contract: 'material-objective-v1' }
        }
      })
    ).toThrow();
    const legacyMaterial = parsePastedMaterial('基期: 80\n现期: 100', 'legacy');
    apply('material.add', { material: legacyMaterial });
    const legacy = createMaterialObjectiveQuestion(
      'legacy-growth',
      state.materials.find((material) => material.id === 'legacy'),
      {
        segmentId: 'legacy_1',
        contract: 'material-objective-v1',
        kind: 'growth_percent',
        from: '基期',
        to: '现期'
      }
    );
    expect(legacy.validation).toMatchObject({ answer: '2000/80', evidenceId: 'material-objective-v1' });
    expect(gradeAnswer(legacy, '25%').outcome).toBe('correct');
    focus(legacy);
    answer('25%', 'legacy-attempt');
    let replay = emptyLearningState('u1', state.timezone);
    for (const event of state.events)
      replay = applyLearningOperation(replay, normalizePrivateSyncOperation(event)).state;
    expect(replay.questions.map((question) => question.validation)).toEqual(
      state.questions.map((question) => question.validation)
    );
    expect(replay.attempts).toEqual(state.attempts);
  });
  it('字面阅读原答与不同字段复测分开，模糊消息先澄清，来源删除后无法恢复旧题', () => {
    apply(
      'conversation.start',
      { goal: '按资料学习', task: { track: 'toefl', edition: 'PRIVATE_TASK_METADATA' } },
      'c1'
    );
    apply('material.add', {
      material: parsePastedMaterial('Departure city: Bristol\nArrival city: Oxford\nTravel day: Monday', 'reading')
    });
    const question = createMaterialObjectiveQuestion('reading-q', state.materials[0], {
      segmentId: 'reading_1',
      kind: 'literal',
      from: 'Departure city'
    });
    focus(question);
    expect(answer('Bristol', 'ambiguous-reading').clarification).toBe(true);
    expect(answer('我的答案是London', 'reading-wrong').grade.outcome).toBe('wrong');
    apply('hint.add', { conversationId: 'c1', content: '定位冒号后的原文' });
    expect(answer('我的答案是Bristol', 'reading-revision').hints).toHaveLength(1);
    const variant = createMaterialObjectiveVariant('reading-variant', state.questions[0], state);
    expect(variant.parentQuestionKey).toBe('reading-q@1');
    expect(variant.materialExercise.from).toBe('Arrival city');
    focus(variant);
    expect(answer('我的答案是Oxford', 'reading-independent')).toMatchObject({
      kind: 'variant',
      hints: [],
      grade: { outcome: 'correct' }
    });
    const preview = apply('material.delete', {
      materialId: 'reading',
      questionKeys: ['reading-q@1', 'reading-variant@1']
    });
    expect(preview.deleted).not.toBe(false);
    expect(JSON.stringify(state)).not.toContain('PRIVATE_TASK_METADATA');
    expect(() => apply('question.add', { question: { ...question, id: 'late' } })).toThrow();
  });
  it('10 任务 6 完成；6 次首答 2 错；聊天、重试、重做不改变口径', () => {
    start();
    const tasks = Array.from({ length: 10 }, (_, i) => ({
      id: `t${i}`,
      title: `任务 ${i}`,
      questionKey: `q${i}@1`,
      condition: 'submitted'
    }));
    apply('plan.set', { tasks }, 'plan1');
    for (let i = 0; i < 6; i++) {
      focus(q(`q${i}`));
      answer(i < 2 ? '3' : '4', `a${i}`);
    }
    let stats = summarizeLearning(state, Date.parse('2026-09-29T10:00:00Z'));
    expect(stats.tasks).toMatchObject({ numerator: 6, denominator: 10, rate: 0.6 });
    expect(stats.first).toMatchObject({ numerator: 2, denominator: 6, rate: 1 / 3 });
    answer('4', 'a5'); // 重试同一操作
    apply('message.add', { conversationId: 'c1', role: 'user', content: '我们聊聊学习目标' });
    answer('4', 'redo');
    stats = summarizeLearning(state, Date.parse('2026-09-29T10:00:00Z'));
    expect(stats.first.denominator).toBe(6);
    expect(state.attempts).toHaveLength(7);
    apply('assessment.correct', { attemptId: 'a0', reason: '标准答案有争议', outcome: null }, 'dispute');
    expect(summarizeLearning(state).first).toMatchObject({ numerator: 1, denominator: 5 });
    expect(summarizeLearning(state).mistakes).toHaveLength(1);
    apply('assessment.review', {
      attemptId: 'a0',
      outcome: 'correct',
      reason: '独立人工复核',
      evidenceId: 'signed-review-1'
    });
    expect(summarizeLearning(state).first).toMatchObject({ numerator: 1, denominator: 6 });
    apply('plan.set', { tasks: tasks.slice(0, 6), reason: '用户调整' }, 'plan2');
    expect(summarizeLearning(state, Date.parse('2026-09-29T10:00:00Z'), { planId: 'plan1' }).tasks.rate).toBe(0.6);
    expect(state.plans[1].replaces).toBe('plan1');
  });
  it('歧义、探索、不确定条件、模型答案均不能直接产生可靠错误', () => {
    start();
    focus(q('q1'));
    expect(answer('可能是 3？', 'unclear').clarification).toBe(true);
    expect(state.attempts).toHaveLength(0);
    expect(classifyResponse('我选 A', { validation: { type: 'choice' } })).toBe('answer');
    expect(classifyResponse('我猜 A', { validation: { type: 'choice' } })).toBe('discussion');
    expect(gradeAnswer({ ...q('q2'), uncertainties: [{ field: '单位', resolved: false }] }, '3').status).toBe(
      'pending'
    );
    apply('question.add', {
      question: {
        ...q('model'),
        scope: 'generated',
        validation: { type: 'number', authority: 'model', answer: '4', evidenceId: 'two-models-agree' }
      }
    });
    expect(state.questions.at(-1).validation).toBeNull();
  });
  it('分数等价、单位和不支持的表达式分别处理，不执行代码', () => {
    expect(gradeAnswer(q('fraction', '1/2'), '0.5').outcome).toBe('correct');
    expect(
      gradeAnswer({ ...q('unit', '2'), validation: { ...q('unit', '2').validation, unit: 'm' } }, '2cm')
    ).toMatchObject({ status: 'reliable', outcome: 'wrong' });
    expect(gradeAnswer(q('unsafe'), 'globalThis.secret').status).toBe('pending');
  });
  it('提示、修正、原题重做、变式、复测保留不同经历，提示后答对不成为独立掌握', () => {
    start();
    focus(q('q1'));
    answer('3', 'a1');
    apply('hint.add', { conversationId: 'c1', content: '先确定运算顺序' });
    const revised = answer('4', 'a2', { kind: 'revision', parentAttemptId: 'a1' });
    expect(revised.hints).toHaveLength(1);
    expect(summarizeLearning(state).knowledge['数学 / 运算'].status).toBe('需提示');
    const original = createArithmeticQuestion('sum', '12 + 8');
    const variant = createArithmeticQuestion('inverse', '12 + 8', 'self_report', original);
    expect(variant.parentQuestionKey).toBe('sum@1');
    expect(variant.prompt).not.toContain('12');
    expect(gradeAnswer(variant, '12').outcome).toBe('correct');
  });
  it('自然指令持久化；连续同点错误检查先修，不给整科永久标签', () => {
    start();
    focus(q('q1'));
    answer('3', 'a1');
    focus(q('q2'));
    const a2 = answer('3', 'a2');
    expect(nextStrategy(state, a2)).toMatchObject({ method: 'prerequisite', evidenceIds: ['a1', 'a2'] });
    for (const [input, method] of [
      ['直接讲解', 'explain'],
      ['太简单了', 'challenge'],
      ['换方法', 'analogy'],
      ['降低难度', 'steps']
    ]) {
      const directive = userDirective(input, state, 'c1');
      apply(directive.type, directive.data);
      expect(state.strategy.method).toBe(method);
    }
    const stop = userDirective('停止当前任务', state, 'c1');
    apply(stop.type, stop.data);
    expect(() => answer('4', 'a3')).toThrow('当前任务已停止');
  });
  it('乘法变式改变解题方向而不直接给原未知数，零乘条件不冒充已验题', () => {
    const parent = createArithmeticQuestion('mul', '7 × 8');
    const variant = createArithmeticQuestion('inverse', '7 × 8', 'self_report', parent);
    expect(variant.prompt).toBe('已知一个数乘 8 得到 56，求这个数。');
    expect(gradeAnswer(variant, '7').outcome).toBe('correct');
    const synced = normalizePrivateSyncOperation({ type: 'question.add', data: { question: variant } });
    expect(synced.data.question.validation.answer).toBe('7');
    const ambiguous = createArithmeticQuestion('zero', '7 × 0', 'self_report', parent);
    expect(ambiguous.validationResult).toEqual({ solvable: false, verified: false });
    expect(ambiguous.validation).toBeNull();
    expect(gradeAnswer(ambiguous, '7').status).toBe('pending');
  });
  it('按学习者时区跨日，时区切换不改原始时间；计划历史保留', () => {
    const time = Date.parse('2026-09-29T01:30:00Z');
    expect(dayKey(time, 'America/Los_Angeles')).toBe('2026-09-28');
    expect(dayKey(time, 'Asia/Shanghai')).toBe('2026-09-29');
    expect(() => dayKey(time, 'invalid-zone')).toThrow();
  });
});

describe('本地持久化、迁移和工具边界', () => {
  it('waits for the actual first exclusive lock before saving an already explicit quiz attempt', async () => {
    uni.clearStorageSync();
    const original = Object.getOwnPropertyDescriptor(navigator, 'locks');
    Object.defineProperty(navigator, 'locks', {
      configurable: true,
      value: {
        async request(name, _options, callback) {
          await Promise.resolve();
          return callback({ name });
        }
      }
    });
    vi.resetModules();
    try {
      const { recordQuizLearningAttempt } = await import('@/services/learning/quiz-learning-bridge.js');
      const { learningRepository } = await import('@/services/learning/learning-repository.js');
      const { learningWriteLease } = await import('@/services/learning/learning-write-lease.js');
      try {
        const input = {
          currentQuestion: { id: 'q1', question: '原题', options: ['甲', '乙'] },
          userAnswer: 'A',
          sessionId: 'quiz_original',
          attemptId: 'quiz_answer_original'
        };
        expect((await recordQuizLearningAttempt(input)).success).toBe(true);
        const before = learningRepository.read();
        expect(before.attempts).toHaveLength(1);
        expect(before.attempts[0].grade.status).toBe('pending');
        await recordQuizLearningAttempt(input);
        expect(learningRepository.read()).toEqual(before);
      } finally {
        learningWriteLease.release();
      }
    } finally {
      if (original) Object.defineProperty(navigator, 'locks', original);
      else delete navigator.locks;
      uni.clearStorageSync();
    }
  });
  function memoryStorage() {
    const map = new Map();
    return {
      map,
      get: (key, fallback) => (map.has(key) ? structuredClone(map.get(key)) : fallback),
      save: (key, value) => {
        map.set(key, structuredClone(value));
        return true;
      },
      remove: (key) => map.delete(key) || true
    };
  }
  it('保存重开、幂等、迁移重复、中断恢复、用户隔离、删除恢复副本', () => {
    const storage = memoryStorage();
    storage.save('mistake_book', [{ id: 'old' }]);
    const repository = createLearningRepository(storage, () => 'u1');
    repository.migrateLegacy();
    repository.migrateLegacy();
    repository.commit({ id: 'c1', type: 'conversation.start', data: { goal: '新目标' } });
    expect(createLearningRepository(storage, () => 'u1').read().conversations).toHaveLength(1);
    repository.commit({ id: 'c1', type: 'conversation.start', data: { goal: '新目标' } });
    expect(repository.read().revision).toBe(1);
    expect(repository.read().legacy.reviewRequired).toBe(true);
    expect(() => createLearningRepository(storage, () => 'u2').read()).toThrow('其他用户');
    expect(() => repository.commit({ id: 'c2', type: 'conversation.start', data: { goal: '冲突' } }, 0)).toThrow(
      '已更新'
    );
    repository.rollback();
    expect(repository.read().conversations).toHaveLength(0);
    repository.deleteData();
    expect(storage.get('mistake_book', [])).toHaveLength(1);
    expect([...storage.map.keys()].filter((key) => key.startsWith('conversation_learning'))).toEqual([
      `${LEARNING_KEY}_lifecycle`
    ]);
    expect(storage.get(`${LEARNING_KEY}_lifecycle`)).toEqual({
      owner: 'u1',
      contract: 'learning-lifecycle-v1',
      generation: expect.any(String)
    });
  });
  it('落盘失败不返回成功，恢复副本保留', () => {
    const storage = memoryStorage();
    const repository = createLearningRepository(storage, () => 'u1');
    storage.save = () => false;
    expect(() => repository.commit({ id: 'c1', type: 'conversation.start', data: { goal: '目标' } })).toThrow(
      '恢复副本'
    );
    expect(repository.read().conversations).toHaveLength(0);
  });
  it.each(['deleteData', 'rollback'])('同步等待期间%s使迟到结果失效，不能恢复被撤销的记录', async (action) => {
    const repository = createLearningRepository(memoryStorage(), () => 'u1');
    repository.commit({ id: 'c1', type: 'conversation.start', data: { goal: '原始学习' } });
    const remote = repository.read();
    let finishPull;
    let requests = 0;
    const request = () => {
      requests++;
      return new Promise((resolve) => {
        finishPull = resolve;
      });
    };
    const result = synchronizeLearning(repository, true, request);
    const rejected = expect(result).rejects.toThrow('记录已删除或恢复');
    repository[action]();
    finishPull({ success: true, data: { state: remote } });
    await rejected;
    expect(requests).toBe(1);
    expect(repository.read().conversations).toHaveLength(0);
  });
  it('账户切换后停止同步，不向新账户发送旧操作', async () => {
    const storage = memoryStorage();
    let owner = 'u1';
    const repository = createLearningRepository(storage, () => owner);
    repository.commit({ id: 'c1', type: 'conversation.start', data: { goal: '私有目标' } });
    const remote = repository.read();
    let finishPull;
    let requests = 0;
    const request = () => {
      requests++;
      return new Promise((resolve) => {
        finishPull = resolve;
      });
    };
    const result = synchronizeLearning(repository, true, request);
    const rejected = expect(result).rejects.toThrow('用户已切换');
    owner = 'u2';
    storage.save('conversation_learning_v1', emptyLearningState('u2'));
    finishPull({ success: true, data: { state: remote } });
    await rejected;
    expect(requests).toBe(1);
    expect(repository.read().events).toHaveLength(0);
  });
  it('两个 H5 窗口只允许一个写入，关闭写入窗口后接管且原始作答不被覆盖', async () => {
    const occupied = new Set();
    const locks = {
      async request(name, _options, callback) {
        if (occupied.has(name)) return callback(null);
        occupied.add(name);
        try {
          return await callback({ name });
        } finally {
          occupied.delete(name);
        }
      }
    };
    const wait = () => new Promise((resolve) => setTimeout(resolve, 0));
    const storage = memoryStorage();
    const firstLease = createLearningWriteLease(locks);
    const secondLease = createLearningWriteLease(locks);
    const first = createLearningRepository(storage, () => 'u1', firstLease);
    const second = createLearningRepository(storage, () => 'u1', secondLease);
    first.read();
    await wait();
    second.read();
    await wait();
    first.commit({ id: 'original', type: 'conversation.start', data: { goal: '原始学习' } });
    expect(() => second.commit({ id: 'other', type: 'conversation.start', data: { goal: '另一窗口' } })).toThrow(
      '另一窗口'
    );
    expect(second.read().conversations).toHaveLength(1);
    firstLease.release();
    await wait();
    second.read();
    await wait();
    second.commit({ id: 'other', type: 'conversation.start', data: { goal: '另一窗口' } });
    expect(second.read().conversations.map((c) => c.goal)).toEqual(['原始学习', '另一窗口']);
    secondLease.release();
  });
  it('恶意工具、模型代答、权限提升和无界循环不能执行', () => {
    const repository = createLearningRepository(memoryStorage(), () => 'u1');
    repository.commit({ id: 'c1', type: 'conversation.start', data: { goal: '目标' } });
    const context = {
      permissions: ['read', 'learn'],
      origin: 'model',
      conversationId: 'c1',
      calls: 0,
      maxCalls: 1,
      deadline: Date.now() + 1000
    };
    expect(() => executeLearningTool(repository, { id: 'x', name: 'shell', arguments: {} }, context)).toThrow(
      '允许清单'
    );
    expect(() =>
      executeLearningTool(repository, { id: 'x', name: 'submit', arguments: { answer: '4' } }, context)
    ).toThrow('代替用户');
    expect(() => executeLearningTool(repository, { id: 'y', name: 'progress', arguments: {} }, context)).toThrow(
      '预算'
    );
  });
});
