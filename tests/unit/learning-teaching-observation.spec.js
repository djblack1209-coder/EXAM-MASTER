import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { mount } from '@vue/test-utils';
import { useConversationLearningStore } from '@/stores/modules/conversation-learning.js';
import { learningRepository } from '@/services/learning/learning-repository.js';
import {
  applyLearningOperation,
  emptyLearningState,
  questionKey,
  normalizePrivateSyncOperation
} from '@/services/learning/learning-domain.js';
import { executeLearningTool, nextStrategy } from '@/services/learning/learning-tools.js';
import {
  observeTeaching,
  requestedTeachingMethod
} from '../../laf-backend/functions/_shared/learning-teaching-observation.js';
import { prepareLearningRestore } from '@/services/learning/learning-backup.js';
import LearningOverview from '@/components/business/learning/learning-overview.vue';

vi.mock('@dcloudio/uni-app', () => ({ onShow: vi.fn(), onHide: vi.fn(), onBackPress: vi.fn() }));
const api = vi.hoisted(() => ({ generate: vi.fn() }));
vi.mock('@/services/api/domains/learning.api.js', async (original) => ({
  ...(await original()),
  generateLearningTurn: api.generate
}));
beforeEach(() => {
  uni.clearStorageSync();
  setActivePinia(createPinia());
  api.generate.mockReset();
});
const commit = (id, type, data) => learningRepository.commit({ id, type, data });
const begin = () => {
  const store = useConversationLearningStore();
  store.start('12 + 8');
  return store;
};
const observations = (store) => observeTeaching(store.state).rows;

describe('实际教学与后续表现', () => {
  it('切换方法和用户说懂了不能证明有效；失败执行和普通消息不成为教学观察', async () => {
    const store = begin();
    commit('label', 'strategy.set', { method: 'example', reason: '仅选择' });
    commit('plain', 'message.add', {
      conversationId: store.selectedConversationId,
      role: 'assistant',
      content: '懂了就好'
    });
    store.refresh();
    expect(observations(store)).toEqual([]);
    await store.send('换一个例子', { discussionOnly: true, id: 'example' });
    await store.send('懂了', { id: 'understood' });
    expect(store.state.attempts).toHaveLength(0);
    expect(observations(store)[0]).toMatchObject({ status: 'waiting', followups: { reliable: 0, pending: 0 } });
    const altered = JSON.parse(JSON.stringify(store.state));
    altered.executions.find((e) => e.tool === 'teaching').status = 'failed';
    expect(observeTeaching(altered).rows).toEqual([]);
  });
  it('提示后正确、原题无提示重做、独立变式分别记录；不会推断长期掌握', async () => {
    const store = begin();
    await store.send('直接讲解', { discussionOnly: true, id: 'explanation' });
    store.submit('20', true, 'helped');
    expect(observations(store)[0]).toMatchObject({
      status: 'helped_correct',
      followups: { helpedCorrect: 1, independentTransfer: 0 }
    });
    store.submit('20', true, 'redo');
    expect(observations(store)[0]).toMatchObject({ status: 'original_redo', followups: { originalRedo: 1 } });
    store.generateVariant();
    store.submit('12', true, 'transfer');
    expect(observations(store)[0]).toMatchObject({
      status: 'independent_transfer',
      evidenceIds: ['helped', 'redo', 'transfer'],
      followups: { independentTransfer: 1, dueReview: 0 }
    });
    expect(store.summary.knowledge['数学 / 整数运算'].status).toBe('待复测');
  });
  it('同一作答不会归功于多个教法，后一次交付开始新的观察；相同消息重试不新增行', async () => {
    const store = begin();
    await store.send('直接讲解', { discussionOnly: true, id: 'first-method' });
    await store.send('换方法', { discussionOnly: true, id: 'second-method' });
    await store.send('换方法', { discussionOnly: true, id: 'second-method' });
    store.submit('20', true, 'answer');
    const rows = observations(store);
    expect(rows).toHaveLength(2);
    expect(rows[0].status).toBe('waiting');
    expect(rows[1]).toMatchObject({ method: 'analogy', status: 'helped_correct', followups: { reliable: 1 } });
    expect(store.state.attempts[0].hints).toHaveLength(2);
  });
  it('不同对话、无关题、其他知识点和伪造父题循环不能串入效果观察', async () => {
    const store = begin();
    const conversationId = store.selectedConversationId;
    const key = questionKey(store.activeQuestion);
    await store.send('直接讲解', { discussionOnly: true, id: 'teaching' });
    store.start('4 + 6');
    store.submit('10', true, 'other-question');
    store.focus(key);
    store.submit('20', true, 'other-conversation');
    expect(observations(store)[0].status).toBe('waiting');
    const cycle = JSON.parse(JSON.stringify(store.state));
    cycle.questions[0].parentQuestionKey = key;
    expect(observeTeaching(cycle).rows).toEqual([]);
    expect(observeTeaching(store.state, { conversationId: 'unknown' }).rows).toEqual([]);
    expect(observeTeaching(store.state, { conversationId, scope: '语文 / 写作' }).rows).toEqual([]);
  });
  it('争议立即撤销可靠效果，计划和首答仍按原事实重算；恢复与同步保留历史身份', async () => {
    const store = begin();
    await store.send('直接讲解', { discussionOnly: true, id: 'explained' });
    store.submit('20', true, 'answer');
    store.correctAssessment('answer', '原始答案有争议');
    expect(observations(store)[0]).toMatchObject({
      status: 'pending',
      followups: { reliable: 0, helpedCorrect: 0, pending: 1 }
    });
    expect(store.summary.first.denominator).toBe(0);
    expect(store.summary.tasks).toMatchObject({ numerator: 1, denominator: 1 });
    const restored = prepareLearningRestore(
      emptyLearningState('guest', store.state.timezone),
      store.exportData()
    ).state;
    expect(observeTeaching(restored).rows[0]).toMatchObject({ historyOnly: true, status: 'pending' });
    let replay = emptyLearningState('guest', store.state.timezone);
    for (const e of store.state.events)
      replay = applyLearningOperation(
        replay,
        normalizePrivateSyncOperation({ id: e.id, type: e.type, at: e.at, data: e.data })
      ).state;
    expect(observeTeaching(replay)).toEqual(observeTeaching(store.state));
  });
  it('提前复測不记到期通过，有有效前期调度且无提示的到期作答才单列', async () => {
    const store = begin();
    await store.send('直接讲解', { discussionOnly: true, id: 'explain' });
    store.submit('20', true, 'first');
    store.focus(questionKey(store.activeQuestion), store.selectedConversationId, 'review');
    store.submit('20', true, 'early');
    expect(observations(store)[0].followups.dueReview).toBe(0);
    const due = store.state.reviews[0].due;
    vi.spyOn(Date, 'now').mockReturnValue(due + 1000);
    try {
      store.focus(questionKey(store.activeQuestion), store.selectedConversationId, 'review');
      store.submit('20', true, 'due');
      expect(observations(store)[0]).toMatchObject({
        status: 'due_review',
        followups: { dueReview: 1, originalRedo: 1 }
      });
    } finally {
      vi.restoreAllMocks();
    }
  });
  it('统计页面显示相同观察、可靠/待定与提示分母，并可回原教学', async () => {
    const store = begin();
    await store.send('直接讲解', { discussionOnly: true });
    store.submit('20', true);
    const wrapper = mount(LearningOverview, {
      props: { initialExpanded: true, view: 'study-detail' },
      global: {
        stubs: {
          view: { template: '<div><slot /></div>' },
          text: { template: '<span><slot /></span>' },
          BaseIcon: true
        }
      }
    });
    expect(wrapper.text()).toContain('练习表现');
    expect(wrapper.text()).not.toContain('教学后的作答观察');
    expect(wrapper.text()).toContain('可靠后续 1 次');
    expect(wrapper.text()).toContain('提示后正确 1 次');
    expect(wrapper.text()).toContain('回看教学与作答');
    wrapper.unmount();
  });
});

describe('有证据的调整与用户意愿', () => {
  it('两次错答先补先修；实际补充后仍错则拆步，再受阻换例；没有重复同一先修', async () => {
    const store = begin();
    for (const [id, answer, method] of [
      ['a1', '19', null],
      ['a2', '18', 'prerequisite'],
      ['a3', '17', 'steps'],
      ['a4', '16', 'example'],
      ['a5', '15', 'analogy']
    ]) {
      await store.send(answer, { id });
      if (method) expect(store.active.messages.at(-1)).toMatchObject({ role: 'tool', method });
    }
    expect(store.state.strategy).toMatchObject({
      source: 'observed',
      evidenceIds: ['a4:answer', 'a5:answer'],
      conversationId: store.selectedConversationId
    });
    expect(store.state.executions.filter((e) => e.tool === 'teaching' && e.method === 'prerequisite')).toHaveLength(1);
    expect(observations(store).map((r) => r.status)).toEqual(['blocked', 'blocked', 'blocked', 'waiting']);
    expect(store.summary.first).toMatchObject({ numerator: 1, denominator: 1 });
  });
  it('直接讲解与慢速步骤是持续的用户选择，错误或提示后正确不能被自动教法覆盖', async () => {
    const store = begin();
    await store.send('直接讲解', { discussionOnly: true });
    store.submit('19', true);
    store.submit('18', true);
    store.submit('20', true);
    expect(store.state.strategy).toMatchObject({ source: 'self_report', method: 'explain' });
    expect(requestedTeachingMethod(store.state, store.selectedConversationId)).toBe('explain');
    store.setRhythm('gentle');
    store.submit('19', true);
    store.submit('18', true);
    expect(store.state.strategy.method).toBe('steps');
    await store.send('停止', { discussionOnly: true });
    expect(requestedTeachingMethod(store.state, store.selectedConversationId)).toBeNull();
    expect(() => store.submit('20', true)).toThrow('已停止');
  });
  it('不同对话不继承强制教法或两次错误判断；实际用户可以换方法解除前一个选择', async () => {
    const store = begin();
    await store.send('直接讲解', { discussionOnly: true });
    const earlier = store.selectedConversationId;
    store.start('4 + 6');
    expect(requestedTeachingMethod(store.state, store.selectedConversationId)).toBeNull();
    store.submit('9', true, 'new-first');
    expect(nextStrategy(store.state, store.state.attempts.at(-1))).toBeNull();
    store.focus(questionKey(store.state.questions[0]), earlier);
    await store.send('换方法', { discussionOnly: true });
    expect(store.state.strategy.method).toBe('analogy');
  });
  it('模型不能改指定教法，也不能借相同教法释放用户选择、降低难度或覆盖理由', async () => {
    const store = begin();
    await store.send('直接讲解', { discussionOnly: true });
    const current = JSON.parse(JSON.stringify(store.state.strategy));
    const context = {
      conversationId: store.selectedConversationId,
      permissions: ['learn'],
      calls: 0,
      maxCalls: 3,
      deadline: Date.now() + 5000,
      origin: 'model',
      lockedMethod: 'explain'
    };
    expect(() =>
      executeLearningTool(
        learningRepository,
        { id: 'denied', name: 'method', arguments: { method: 'question', reason: '模型建议' } },
        context
      )
    ).toThrow('模型不能选择教法或写入学习事实');
    expect(() =>
      executeLearningTool(
        learningRepository,
        { id: 'same', name: 'method', arguments: { method: 'explain', difficulty: 'easier', reason: '覆盖用户' } },
        context
      )
    ).toThrow('模型不能选择教法或写入学习事实');
    store.refresh();
    expect(store.state.strategy).toEqual(current);
    expect(() =>
      executeLearningTool(
        learningRepository,
        { id: 'source-forgery', name: 'method', arguments: { method: 'explain', source: 'self_report' } },
        context
      )
    ).toThrow('模型不能选择教法或写入学习事实');
  });
  it('下一轮模型请求只发压缩快照与教法锁，拒绝真实返回中的违规换法', async () => {
    const store = begin();
    await store.send('直接讲解', { discussionOnly: true });
    store.submit('20', true);
    store.models = [{ id: 'synthetic', model: 'synthetic', capabilities: {} }];
    store.modelId = 'synthetic';
    store.selectedMode = 'cloud';
    store.sharingAllowed = true;
    api.generate.mockResolvedValue({
      success: true,
      data: {
        message: '先问一个问题',
        tools: [{ name: 'method', arguments: { method: 'question', reason: '想换方法' } }]
      }
    });
    await store.send('请继续解释', { id: 'model-reply' });
    expect(api.generate.mock.calls[0][0].learningContext.summary).toMatchObject({
      contract: 'learning-snapshot-v1',
      teaching: { stopped: false, method: 'explain' }
    });
    expect(api.generate.mock.calls[0][0].learningContext.summary).not.toHaveProperty('continuity');
    expect(store.state.events.find((e) => e.id === 'model-reply:request').data.lockedMethod).toBe('explain');
    expect(store.error).toBe('此操作未获授权，未执行。');
    expect(store.state.strategy.method).toBe('explain');
    expect(store.active.messages.some((m) => m.id === 'model-reply:reply')).toBe(false);
  });
  it('更正策略依据撤销旧自动判断，但保留用户选择、停止状态与历史策略事件', async () => {
    const store = begin();
    store.submit('19', true, 'first');
    store.submit('18', true, 'second');
    expect(store.state.strategy.method).toBe('prerequisite');
    store.correctAssessment('second', '答案依据有争议');
    expect(store.state.strategy).toMatchObject({ method: 'check', evidenceIds: [] });
    expect(observations(store)[0].status).toBe('waiting');
    expect(store.state.events.find((e) => e.id === 'second:strategy').result.method).toBe('prerequisite');
    await store.send('直接讲解', { discussionOnly: true });
    store.correctAssessment('first', '另一处争议');
    expect(store.state.strategy.method).toBe('explain');
  });
  it('无可靠后续答案、不确定条件和单次错误不启动自动下降，也不会拿缺知识点题泛化', () => {
    const store = begin();
    const a = store.submit('19', true, 'only');
    expect(nextStrategy(store.state, a)).toBeNull();
    const pending = { ...a, id: 'pending', grade: { status: 'pending', outcome: null } };
    expect(nextStrategy({ ...store.state, attempts: [...store.state.attempts, pending] }, pending)).toBeNull();
  });
});
