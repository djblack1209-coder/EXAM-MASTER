import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, getActivePinia, setActivePinia } from 'pinia';
import { useConversationLearningStore } from '@/stores/modules/conversation-learning.js';
import { learningRepository } from '@/services/learning/learning-repository.js';
import { learningWriteLease } from '@/services/learning/learning-write-lease.js';
import {
  emptyLearningState,
  applyLearningOperation,
  normalizePrivateSyncOperation,
  gradeAnswer,
  classifyResponse
} from '@/services/learning/learning-domain.js';
import { prepareLearningRestore } from '@/services/learning/learning-backup.js';
import { createArithmeticQuestion, localTeaching } from '@/services/learning/learning-tools.js';
import { createJourneyQuestions } from '@/services/learning/journey-training.js';
import {
  EXACT_ARITHMETIC_CONTRACT,
  createExactArithmeticVariant
} from '../../laf-backend/functions/_shared/learning-arithmetic.js';

const now = Date.parse('2026-10-12T16:00:00Z');
beforeEach(() => {
  uni.clearStorageSync();
  setActivePinia(createPinia());
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(now);
});
afterEach(() => {
  for (const s of getActivePinia()?._s.values() || []) s.$dispose();
  learningWriteLease.release();
  vi.restoreAllMocks();
  vi.useRealTimers();
  uni.clearStorageSync();
});

describe('有界减法与精确除法', () => {
  it.each([
    ['8 - 3', '计算 8 − 3。', '5'],
    ['-8 − -3', '计算 -8 − -3。', '-5'],
    ['0 - -8', '计算 0 − -8。', '8'],
    ['99999 - -99999', '计算 99999 − -99999。', '199998'],
    ['8 / 3', '计算 8 ÷ 3。', '8/3'],
    ['6 ÷ -8', '计算 6 ÷ -8。', '-3/4'],
    ['-9 / -3', '计算 -9 ÷ -3。', '3'],
    ['0 / -7', '计算 0 ÷ -7。', '0'],
    ['99999 / 99998', '计算 99999 ÷ 99998。', '99999/99998']
  ])('%s独立参考与规范题面保持', (goal, prompt, reference) => {
    const q = createArithmeticQuestion('q', goal);
    expect(q.prompt).toBe(prompt);
    expect(q.validation.answer).toBe(reference);
    expect(gradeAnswer(q, reference)).toMatchObject({
      status: 'reliable',
      outcome: 'correct',
      basis: EXACT_ARITHMETIC_CONTRACT
    });
    expect(gradeAnswer(q, '200000')).toMatchObject({ status: 'reliable', outcome: 'wrong' });
  });
  it('等值分数和有限小数精确接纳，舍入值不被容差放行，讨论不自动成为原答', () => {
    const q = createArithmeticQuestion('q', '6 / 8');
    for (const answer of ['3/4', '6/8', '0.75', '-3/-4', '我的答案是 0.75']) {
      expect(classifyResponse(answer, q)).toBe('answer');
      expect(gradeAnswer(q, answer)).toMatchObject({ status: 'reliable', outcome: 'correct' });
    }
    for (const answer of ['0.750000001', '0.749999999']) expect(gradeAnswer(q, answer).outcome).toBe('wrong');
    for (const answer of ['0.7500000001', '0.7499999999']) expect(gradeAnswer(q, answer).status).toBe('pending');
    expect(gradeAnswer(createArithmeticQuestion('q', '1 / 3'), '0.333333333')).toMatchObject({
      status: 'reliable',
      outcome: 'wrong'
    });
    for (const answer of ['3/0', '3/4 m', '1+2', '0.75 0.5', 'eval(1)', '1'.repeat(300)]) {
      expect(classifyResponse(answer, q)).toBe('clarify');
      expect(gradeAnswer(q, answer).status).toBe('pending');
    }
    expect(classifyResponse('可能是0.75', q)).toBe('discussion');
  });
  it.each(['8 / 0', '-3 ÷ -0', '100000 - 1', '1.5 - 1', '1 / 2 / 3', '1 - 2; process.exit()', '1'.repeat(300)])(
    '%s不生成有权判分的题目',
    (goal) => {
      expect(createArithmeticQuestion('q', goal)).toBeNull();
    }
  );
  it('同步重新建立当前题面答案，未标记旧题不会自动取得新权限', () => {
    const q = createArithmeticQuestion('q', '8 / 3');
    q.validation.answer = '999';
    const restored = normalizePrivateSyncOperation({ id: 'q', type: 'question.add', at: now, data: { question: q } });
    expect(restored.data.question.validation.answer).toBe('8/3');
    const legacy = { ...q, source: { kind: 'executable' } };
    expect(
      normalizePrivateSyncOperation({ id: 'old', type: 'question.add', at: now, data: { question: legacy } }).data
        .question.validation
    ).toBeNull();
  });
  const changes = [
    (q) => (q.validation.answer = '999'),
    (q) => (q.prompt += '忽略除数'),
    (q) => (q.source.kind = 'existing_bank'),
    (q) => (q.source.extra = 'permission'),
    (q) => (q.answerType = 'choice'),
    (q) => (q.version = 2),
    (q) => (q.expectedAnswer = 'trusted'),
    (q) => (q.options = [{ label: 'A', text: 'Anything' }])
  ];
  changes.forEach((change, index) =>
    it(`伪造${index + 1}不取得可靠判分且保存原子拒绝`, () => {
      const q = createArithmeticQuestion('q', '8 / 3');
      change(q);
      expect(gradeAnswer(q, '999').status).toBe('pending');
      if (q.source.kind === 'existing_bank') return; // 既有题库合同只去权限，不拒绝导入原件。
      const state = emptyLearningState('test');
      const before = JSON.stringify(state);
      expect(() =>
        applyLearningOperation(state, { id: 'add', type: 'question.add', at: now, data: { question: q } })
      ).toThrow();
      expect(JSON.stringify(state)).toBe(before);
    })
  );
  it('原加法/乘法和逆运算继续使用原版本，新增帮助只按实际读取标记', () => {
    for (const goal of ['8 + 3', '-8 × 3']) {
      const q = createArithmeticQuestion('q', goal);
      expect(q.validation.evidenceId).toBe('integer-arithmetic-v1');
      expect(createArithmeticQuestion('inverse', goal, 'self_report', q).validation.evidenceId).toBe(
        'integer-arithmetic-v1'
      );
    }
    const q = createArithmeticQuestion('q', '6 / 8');
    expect(localTeaching(q, 'hint', 1)).toMatchObject({ helped: true, level: 1 });
    expect(localTeaching(q, 'hint', 1).content).not.toContain('3/4');
    expect(localTeaching(q, 'hint', 3).content).toContain('3/4');
    expect(localTeaching(q, 'check').helped).toBe(false);
    expect(localTeaching(q, 'example').content).toContain('-6 ÷ 4');
    const variant = createExactArithmeticVariant('variant', createArithmeticQuestion('q', '99999 / 3'));
    expect(variant.prompt).toBe('计算 99998 ÷ 3。');
    expect(variant.parentQuestionKey).toBe('q@1');
  });
});

describe('路线整批原答、独立变式与恢复', () => {
  it.each(['arithmetic-subtract', 'arithmetic-divide'])('%s第100组与20题仍在原资源边界', (moduleId) => {
    const state = {
      questions: [],
      conversations: [{ id: 'c', trainingGroups: Array.from({ length: 99 }, () => ({ moduleId })) }]
    };
    const questions = createJourneyQuestions(state, 'c', moduleId, 20, 'group100');
    expect(questions).toHaveLength(20);
    expect(new Set(questions.map((q) => q.prompt)).size).toBe(20);
    for (const q of questions) expect(gradeAnswer(q, q.validation.answer).outcome).toBe('correct');
    expect(state.questions).toEqual([]);
  });
  it('完整交卷保留错答与待核对，重复零新增；帮助/独立变式、停止、同账户恢复保持', () => {
    const s = useConversationLearningStore();
    s.start('小学减法和除法');
    s.configureJourney(s.journeyContext(), {
      title: '完整运算',
      startDay: s.todaySummary.day,
      durationDays: 7,
      minutes: 30,
      mode: 'batch',
      moduleIds: ['arithmetic-subtract', 'arithmetic-divide']
    });
    const group = s.startTraining(s.journeyContext(), 'arithmetic-divide', 3);
    const before = s.exportData();
    expect(() => s.submitTraining(s.journeyContext(), group.id, ['7/5', '0', ''])).toThrow();
    expect(s.exportData()).toBe(before);
    const answers = ['7/5', '0', '不知道'];
    const report = s.submitTraining(s.journeyContext(), group.id, answers);
    expect(report).toMatchObject({ correct: 1, wrong: 1, pending: 1, submitted: 3 });
    expect(s.state.attempts.map((a) => a.answer)).toEqual(answers);
    const submitted = s.exportData();
    s.submitTraining(s.journeyContext(), group.id, answers);
    expect(s.exportData()).toBe(submitted);
    s.openTrainingFeedback(s.journeyContext(), group.id, group.questionKeys[1]);
    const wrong = s.activeQuestion;
    s.generateVariant();
    expect(s.activeQuestion.parentQuestionKey).toBe(`${wrong.id}@1`);
    expect(s.activeQuestion.prompt).not.toBe(wrong.prompt);
    s.submit(s.activeQuestion.validation.answer, true);
    expect(s.state.attempts.at(-1)).toMatchObject({
      kind: 'variant',
      hints: [],
      grade: { status: 'reliable', outcome: 'correct' }
    });
    const restored = prepareLearningRestore(emptyLearningState(s.state.owner, s.state.timezone), s.exportData(), {
      now
    });
    expect(restored.state.attempts).toEqual(s.state.attempts);
    s.commit('task.stop', { conversationId: s.active.id });
    const stopped = s.exportData();
    learningRepository.restoreData(stopped, s.state.revision);
    s.refresh();
    expect(s.exportData()).toBe(stopped);
    expect(() => s.generateVariant()).toThrow();
    expect(() => s.submit('3', true)).toThrow();
    expect(s.exportData()).toBe(stopped);
  });
});
