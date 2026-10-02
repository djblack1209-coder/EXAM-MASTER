import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { mount } from '@vue/test-utils';
import { useConversationLearningStore } from '@/stores/modules/conversation-learning.js';
import { learningRepository } from '@/services/learning/learning-repository.js';
import {
  emptyLearningState,
  gradeAnswer,
  questionKey,
  summarizeLearning,
  applyLearningOperation,
  normalizePrivateSyncOperation
} from '@/services/learning/learning-domain.js';
import {
  localTeaching,
  nextStrategy,
  createArithmeticQuestion,
  createArithmeticChallenge
} from '@/services/learning/learning-tools.js';
import { prepareLearningRestore } from '@/services/learning/learning-backup.js';
import NumberLine from '@/components/business/learning/number-line.vue';
import LearningOverview from '@/components/business/learning/learning-overview.vue';
import { deriveConversationReview } from '@/services/learning/conversation-review.js';

beforeEach(() => {
  uni.clearStorageSync();
  setActivePinia(createPinia());
});
const commit = (id, type, data) => learningRepository.commit({ id, type, data });
const stub = { view: { template: '<div><slot /></div>' }, text: { template: '<span><slot /></span>' }, BaseIcon: true };
describe('教学实际交付与帮助记录', () => {
  it('切换题目、切换对话、刷新及相同消息重试均保留提示；正式提交后不串入其他题', async () => {
    const store = useConversationLearningStore();
    store.start('12 + 8');
    const original = store.activeQuestion,
      conversation = store.selectedConversationId;
    await store.send('直接讲解', { id: 'delivered-explanation' });
    await store.send('直接讲解', { id: 'delivered-explanation' });
    expect(store.active.pendingHints).toHaveLength(1);
    expect(store.state.executions.filter((e) => e.tool === 'teaching')).toHaveLength(1);
    store.start('3 + 7');
    const other = store.activeQuestion;
    store.focus(questionKey(original));
    setActivePinia(createPinia());
    const reopened = useConversationLearningStore();
    const assisted = reopened.submit('20', true, 'helped-first');
    expect(assisted.hints).toHaveLength(1);
    expect(assisted.hints[0]).toMatchObject({ questionKey: questionKey(original), level: 3 });
    expect(reopened.summary.knowledge['数学 / 整数运算'].status).toBe('需提示');
    reopened.focus(questionKey(other), conversation);
    expect(reopened.submit('10', true, 'other-first').hints).toHaveLength(0);
    reopened.focus(questionKey(original), conversation);
    const redo = reopened.submit('20', true, 'original-redo');
    expect(redo.kind).toBe('redo');
    expect(reopened.summary.knowledge['数学 / 整数运算'].status).toBe('待复测');
    expect(reopened.summary.first.denominator).toBe(2);
  });
  it('切换教法和显式复测不清除尚未提交的帮助，也不完成独立正确任务', async () => {
    const store = useConversationLearningStore();
    store.start('12 + 8');
    const key = questionKey(store.activeQuestion);
    commit('independent-plan', 'plan.set', {
      tasks: [{ id: 'independent', title: '独立检验', questionKey: key, condition: 'independent_correct' }]
    });
    store.refresh();
    await store.send('直接讲解');
    store.setRhythm('focus');
    store.focus(key, store.selectedConversationId, 'review');
    const answer = store.submit('20', true);
    expect(answer.hints).toHaveLength(1);
    expect(answer.kind).toBe('review');
    expect(store.currentPlan.tasks[0].completedBy).toBeNull();
  });
  it('1至3级提示逐步增加，例题、类比、步骤各有实际内容；不靠教法标签冒充执行', async () => {
    const store = useConversationLearningStore();
    store.start('12 + 8');
    for (let i = 1; i <= 3; i++) await store.send('给我提示', { id: `layer-${i}` });
    expect(store.active.pendingHints.map((h) => h.level)).toEqual([1, 2, 3]);
    expect(store.active.pendingHints[0].content).not.toContain('20');
    expect(store.active.pendingHints[1].content).not.toContain('20');
    expect(store.active.pendingHints[2].content).toContain('20');
    await store.send('给我提示', { id: 'layer-1' });
    expect(store.active.pendingHints).toHaveLength(3);
    const q = store.activeQuestion;
    const contents = ['explain', 'question', 'steps', 'prerequisite', 'example', 'analogy', 'diagram'].map(
      (m) => localTeaching(q, m).content
    );
    expect(new Set(contents).size).toBe(7);
    expect(localTeaching(q, 'example').content).toContain('5 + (-2)');
    expect(localTeaching(q, 'analogy').content).toContain('账户余额');
    expect(localTeaching(q, 'check').helped).toBe(false);
    expect(localTeaching({ ...q, source: { kind: 'model_generated' } }, 'explain')).toBeNull();
  });
  it('教学校验或落盘失败不写半条消息、半条帮助或成功执行收据', () => {
    const store = useConversationLearningStore();
    store.start('12 + 8');
    const original = store.state;
    const operation = {
      id: 'invalid-teaching',
      type: 'teaching.deliver',
      data: {
        conversationId: store.selectedConversationId,
        questionKey: questionKey(store.activeQuestion),
        method: 'explain',
        origin: 'model_reply',
        content: '答案是20',
        helped: false
      }
    };
    expect(() => applyLearningOperation(original, operation)).toThrow('不能自行证明');
    expect(original.conversations[0].pendingHints).toHaveLength(0);
    expect(original.executions).toHaveLength(0);
    expect(() =>
      commit('invalid-hint', 'hint.add', {
        conversationId: store.selectedConversationId,
        content: '超限层级',
        level: 99
      })
    ).toThrow('层级');
  });
  it('教学事件经备份/同步重放保持原题帮助、统计和历史身份，不宣称重新执行', async () => {
    const store = useConversationLearningStore();
    store.start('12 + 8');
    await store.send('用图形讲解', { id: 'graph-delivery' });
    store.focus(questionKey(store.activeQuestion));
    store.submit('20', true, 'graph-answer');
    const current = emptyLearningState('guest', store.state.timezone);
    const restored = prepareLearningRestore(current, store.exportData());
    expect(restored.state.attempts[0].hints).toHaveLength(1);
    expect(summarizeLearning(restored.state).knowledge['数学 / 整数运算'].status).toBe('需提示');
    expect(restored.state.executions.find((e) => e.tool === 'teaching')).toMatchObject({
      status: 'cancelled',
      errorCode: 'BACKUP_HISTORY_ONLY'
    });
    expect(prepareLearningRestore(restored.state, store.exportData()).imported).toBe(0);
    let replay = current;
    for (const e of store.state.events)
      replay = applyLearningOperation(
        replay,
        normalizePrivateSyncOperation({ id: e.id, type: e.type, at: e.at, data: e.data })
      ).state;
    expect(replay.attempts[0].hints).toEqual(store.state.attempts[0].hints);
    expect(summarizeLearning(replay).first).toEqual(store.summary.first);
  });
  it('可靠的部分正确如实反馈和单列，不能显示判对或独立完成', async () => {
    const store = useConversationLearningStore();
    store.start('多解检验');
    commit('roots', 'question.add', {
      question: {
        id: 'roots',
        version: 1,
        scope: 'private',
        prompt: 'x²=4的全部实根',
        subject: '数学',
        knowledgePoint: '解集',
        validation: {
          type: 'number_set',
          answers: [-2, 2],
          authority: 'human_reviewed',
          evidenceId: 'independent-roots'
        }
      }
    });
    store.focus('roots@1');
    await store.send('2');
    expect(store.active.messages.at(-1).content).toContain('部分正确');
    expect(store.active.messages.at(-1).content).not.toContain('判对');
    expect(store.summary.first).toMatchObject({ numerator: 0, denominator: 1, partial: 1 });
    expect(store.summary.knowledge['数学 / 解集'].status).toBe('待复测');
    const wrapper = mount(LearningOverview, { global: { stubs: stub } });
    expect(wrapper.text()).toContain('首答部分正确 1 次');
    wrapper.unmount();
  });
  it('已实际显示的数轴包含比例、方向与结果；负移动和零移动不伪造图形', () => {
    for (const [goal, expected] of [
      ['12 + -8', '向左移动 8'],
      ['4 + 0', '移动 0']
    ]) {
      const wrapper = mount(NumberLine, {
        props: { question: createArithmeticQuestion('graph', goal) },
        global: { stubs: stub }
      });
      expect(wrapper.find('[role="img"]').attributes('aria-label')).toContain(expected);
      expect(wrapper.find('.mark').attributes('style')).toContain('left:');
      wrapper.unmount();
    }
    const wrapper = mount(NumberLine, {
      props: { question: createArithmeticQuestion('mul', '3 × 4') },
      global: { stubs: stub }
    });
    expect(wrapper.find('[role="img"]').exists()).toBe(false);
    wrapper.unmount();
  });
});

describe('动态调整的任务、证据和范围', () => {
  it('纠正原错答时从仍有效的提示修正重建安排；不把重建当成新的独立复测', async () => {
    const store = useConversationLearningStore();
    store.start('12 + 8');
    const first = store.submit('19', true);
    await store.send('直接讲解');
    const revision = store.submit('20', true);
    store.correctAssessment(first.id, '原始判分有争议');
    const review = store.state.reviews.at(-1);
    expect(review).toMatchObject({ attemptId: revision.id, rating: 'hard', evidenceIds: [revision.id] });
    expect(review.rebuiltFrom).toBeTruthy();
    expect(store.state.reviews.filter((r) => !r.cancelled)).toHaveLength(1);
    expect(store.summary.knowledge['数学 / 整数运算'].status).toBe('需提示');
    expect(store.summary.first.denominator).toBe(0);
    expect(store.state.attempts).toHaveLength(2);
    const restored = prepareLearningRestore(emptyLearningState('guest', store.state.timezone), store.exportData());
    expect(restored.state.reviews.at(-1).attemptId).toBe(revision.id);
    expect(restored.state.attempts).toHaveLength(2);
  });
  it('误判争议撤销旧依据后，新可靠作答可重新建立安排，不受无效旧日期阻挡', () => {
    const store = useConversationLearningStore();
    store.start('12 + 8');
    const first = store.submit('19', true, 'disputed-first');
    store.correctAssessment(first.id, '原评分需重新检查');
    const next = store.submit('20', true, 'new-reliable');
    expect(store.state.reviews[0].cancelled).toBe(true);
    expect(store.state.reviews.at(-1)).toMatchObject({ attemptId: next.id, policy: 'reliable-due-v1' });
    expect(store.summary.first.denominator).toBe(0);
    expect(store.summary.mistakes).toHaveLength(0);
  });
  it('即时重做、修正及提前复测不增长FSRS间隔，到期可靠复测才调度', async () => {
    const store = useConversationLearningStore();
    store.start('12 + 8');
    await store.send('20');
    const firstReview = store.state.reviews[0];
    await store.send('20');
    await store.send('直接讲解');
    await store.send('20');
    store.focus(questionKey(store.activeQuestion), store.selectedConversationId, 'review');
    await store.send('20');
    expect(store.state.attempts).toHaveLength(4);
    expect(store.state.reviews).toHaveLength(1);
    expect(store.state.reviews[0]).toEqual(firstReview);
    const prior = store.state.attempts[0];
    const dueAttempt = { ...prior, id: 'due-test', kind: 'review', at: firstReview.due + 1000, hints: [] };
    const derived = deriveConversationReview([...store.state.attempts, dueAttempt], store.state.reviews);
    expect(derived.evidenceIds).toEqual([prior.id, 'due-test']);
    expect(derived.policy).toBe('reliable-due-v1');
    expect(derived.due).toBeGreaterThan(dueAttempt.at);
    expect(store.summary.first.denominator).toBe(1);
  });
  it('较高自述水平可直接提高要求，产生组合挑战与独立验证，不先强制刷基础', async () => {
    const store = useConversationLearningStore();
    store.start('12 + 8');
    const original = store.activeQuestion;
    await store.send('太简单了', { id: 'challenge-turn' });
    const q = store.activeQuestion;
    expect(q.parentQuestionKey).toBe(questionKey(original));
    expect(q.prompt).toBe('计算 (12 + 8) × -2。');
    expect(q.prompt).not.toContain('-40');
    expect(store.currentPlan.tasks).toHaveLength(2);
    const synced = normalizePrivateSyncOperation({
      type: 'question.add',
      data: { question: { ...q, validation: { ...q.validation, answer: '999' } } }
    });
    expect(synced.data.question.validation.answer).toBe('-40');
    const answer = await store.send('-40');
    expect(answer.kind).toBe('variant');
    expect(answer.hints).toHaveLength(0);
    expect(answer.grade.outcome).toBe('correct');
    expect(store.summary.knowledge['数学 / 运算顺序与符号'].status).toBe('待复测');
  });
  it.each([
    ['-12 + 8', '8'],
    ['0 + 0', '0'],
    ['-9 + -1', '20']
  ])('组合运算 %s 独立期望为%s', (goal, expected) => {
    const q = createArithmeticChallenge('combination', createArithmeticQuestion('base', goal));
    expect(gradeAnswer(q, expected).outcome).toBe('correct');
    expect(
      normalizePrivateSyncOperation({ type: 'question.add', data: { question: q } }).data.question.validation.answer
    ).toBe(expected);
  });
  it('连续两次同知识点错误实际补充先修；无标签的无关题不能推断同科受阻', async () => {
    const store = useConversationLearningStore();
    store.start('12 + 8');
    await store.send('19');
    await store.send('18');
    expect(store.state.strategy).toMatchObject({
      method: 'prerequisite',
      evidenceIds: store.state.attempts.map((a) => a.id)
    });
    expect(store.active.messages.at(-1)).toMatchObject({ role: 'tool', method: 'prerequisite' });
    expect(store.active.pendingHints).toHaveLength(1);
    const questions = [
      { id: 'math', version: 1 },
      { id: 'history', version: 1 }
    ];
    const attempts = questions.map((q) => ({
      id: q.id,
      questionKey: questionKey(q),
      hints: [],
      grade: { status: 'reliable', outcome: 'wrong' }
    }));
    expect(nextStrategy({ questions, attempts }, attempts[1])).toBeNull();
  });
  it('目标更换后变式仍根据原题，不伪造与当前目标的题目关系', async () => {
    const store = useConversationLearningStore();
    store.start('12 + 8');
    const original = store.activeQuestion;
    await store.send('调整目标：7 × 8');
    store.generateVariant();
    expect(store.activeQuestion.prompt).toBe('已知一个数加 8 得到 20，求这个数。');
    expect(store.activeQuestion.parentQuestionKey).toBe(questionKey(original));
  });
  it('云模型讲解未主动调用提示工具，后续作答仍保守标记帮助，首次事实不重复', async () => {
    uni.setStorageSync('EXAM_USER_ID', 'isolated-teaching-owner');
    uni.setStorageSync('EXAM_TOKEN', 'TEST_ONLY_isolated_token');
    const store = useConversationLearningStore();
    store.start('12 + 8');
    store.selectedMode = 'cloud';
    store.sharingAllowed = true;
    store.modelId = 'isolated-model';
    const transport = vi.spyOn(uni, 'request').mockImplementation((options) => {
      options.success({ data: { success: true, data: { message: '12加8得到20。', tools: [] } } });
      return { abort: vi.fn() };
    });
    try {
      await store.send('直接讲解', { id: 'model-explain' });
      expect(store.active.messages.at(-1)).toMatchObject({ role: 'assistant', method: 'explain' });
      store.focus(questionKey(store.activeQuestion));
      const attempt = await store.send('20');
      expect(attempt.hints).toHaveLength(1);
      expect(store.summary.first.denominator).toBe(1);
      expect(store.summary.knowledge['数学 / 整数运算'].status).toBe('需提示');
      expect(transport).toHaveBeenCalledOnce();
    } finally {
      transport.mockRestore();
    }
  });
  it('同对话切换题目期间模型响应不可写入新题；失败无教学成功收据', async () => {
    uni.setStorageSync('EXAM_USER_ID', 'isolated-teaching-owner');
    uni.setStorageSync('EXAM_TOKEN', 'TEST_ONLY_isolated_token');
    const store = useConversationLearningStore();
    store.start('12 + 8');
    commit('second-q', 'question.add', { question: createArithmeticQuestion('second-q', '3 + 7') });
    store.refresh();
    store.selectedMode = 'cloud';
    store.sharingAllowed = true;
    store.modelId = 'isolated-model';
    let respond;
    const transport = vi.spyOn(uni, 'request').mockImplementation((options) => {
      respond = options.success;
      return { abort: vi.fn() };
    });
    try {
      const request = store.send('直接讲解');
      store.focus('second-q@1');
      respond({ data: { success: true, data: { message: '旧题答案20', tools: [] } } });
      await request;
      expect(store.error).toContain('切换');
      expect(store.active.pendingHints).toHaveLength(0);
      expect(store.active.messages.some((m) => m.role === 'assistant')).toBe(false);
      expect(store.state.executions.filter((e) => e.tool === 'teaching')).toHaveLength(0);
    } finally {
      transport.mockRestore();
    }
  });
});
