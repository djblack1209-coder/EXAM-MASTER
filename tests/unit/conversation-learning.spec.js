import { describe, it, expect, beforeEach } from 'vitest';
import {
  emptyLearningState,
  applyLearningOperation,
  summarizeLearning,
  gradeAnswer,
  classifyResponse,
  normalizePrivateSyncOperation,
  dayKey
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

describe('对话学习的事实、统计与纠错', () => {
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
