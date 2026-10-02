import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useConversationLearningStore } from '@/stores/modules/conversation-learning.js';
import { learningRepository } from '@/services/learning/learning-repository.js';
import {
  emptyLearningState,
  questionKey,
  applyLearningOperation,
  normalizePrivateSyncOperation
} from '@/services/learning/learning-domain.js';
import { requestedTeachingMethod } from '../../laf-backend/functions/_shared/learning-teaching-observation.js';
import { executeLearningTool } from '@/services/learning/learning-tools.js';
import { prepareLearningRestore } from '@/services/learning/learning-backup.js';
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
const begin = () => {
  const store = useConversationLearningStore();
  store.start('12 + 8');
  return store;
};
const modelContext = (store) => ({
  conversationId: store.selectedConversationId,
  permissions: ['learn'],
  calls: 0,
  maxCalls: 3,
  deadline: Date.now() + 5000,
  origin: 'model'
});

describe('对话停止与持久教法边界', () => {
  it('停止A后新建B，B的两次可靠错答仍交付先修；导航回A不解除停止', async () => {
    const store = begin(),
      a = store.selectedConversationId,
      key = questionKey(store.activeQuestion);
    await store.send('停止');
    store.start('4 + 6');
    store.submit('9', true, 'b-first');
    store.submit('8', true, 'b-second');
    expect(store.active.messages.at(-1)).toMatchObject({ role: 'tool', method: 'prerequisite' });
    store.focus(key, a);
    expect(store.active.stopped).toBe(true);
    expect(() => store.submit('20', true)).toThrow('已停止');
  });
  it('A直接讲解、B慢慢理解，返回和重开均恢复各自选择；后续错答不覆盖', async () => {
    const store = begin(),
      a = store.selectedConversationId,
      key = questionKey(store.activeQuestion);
    await store.send('直接讲解');
    store.start('4 + 6');
    const b = store.selectedConversationId,
      bKey = questionKey(store.activeQuestion);
    store.setRhythm('gentle');
    store.focus(key, a);
    expect(requestedTeachingMethod(store.state, a)).toBe('explain');
    store.submit('19', true, 'a-first');
    store.submit('18', true, 'a-second');
    expect(requestedTeachingMethod(store.state, a)).toBe('explain');
    store.refresh();
    expect(requestedTeachingMethod(store.state, a)).toBe('explain');
    setActivePinia(createPinia());
    const reopened = useConversationLearningStore();
    reopened.focus(bKey, b);
    expect(requestedTeachingMethod(reopened.state, b)).toBe('steps');
    reopened.focus(key, a);
    expect(requestedTeachingMethod(reopened.state, a)).toBe('explain');
  });
  it('明确恢复自动只解除当前教法；不提交答案/交付帮助、不解除停止，可明确继续任务', async () => {
    const store = begin(),
      a = store.selectedConversationId;
    await store.send('直接讲解');
    await store.send('停止');
    const answers = store.state.attempts.length,
      teaching = store.state.executions.filter((e) => e.tool === 'teaching').length;
    await store.send('恢复自动教法', { id: 'auto' });
    expect(requestedTeachingMethod(store.state, a)).toBeNull();
    expect(store.active.stopped).toBe(true);
    expect(store.state.attempts).toHaveLength(answers);
    expect(store.state.executions.filter((e) => e.tool === 'teaching')).toHaveLength(teaching);
    expect(store.state.events.find((e) => e.id === 'auto:directive')?.type).toBe('strategy.auto');
    await store.send('继续当前任务');
    expect(store.active.stopped).toBe(false);
    store.submit('19', true, 'resumed-first');
    store.submit('18', true, 'resumed-second');
    expect(store.active.messages.at(-1)).toMatchObject({ method: 'steps' });
    expect(store.activeStrategy.source).toBe('observed');
  });
  it('模型未传方法锁也不能覆盖旧对话用户教法；同方法保持来源和理由', async () => {
    const store = begin(),
      a = store.selectedConversationId,
      key = questionKey(store.activeQuestion);
    await store.send('直接讲解');
    store.start('4 + 6');
    store.setRhythm('gentle');
    store.focus(key, a);
    expect(() =>
      executeLearningTool(
        learningRepository,
        { id: 'denied', name: 'method', arguments: { method: 'question', reason: '模型换法' } },
        modelContext(store)
      )
    ).toThrow('明确指定');
    executeLearningTool(
      learningRepository,
      { id: 'same', name: 'method', arguments: { method: 'explain', reason: '覆盖理由' } },
      modelContext(store)
    );
    store.refresh();
    expect(requestedTeachingMethod(store.state, a)).toBe('explain');
    expect(store.activeStrategy.reason).toContain('用户明确要求');
  });
  it('备份与私人同步重放恢复各对话选择及独立自动状态，保留停止和首答事实', async () => {
    const store = begin(),
      a = store.selectedConversationId;
    await store.send('直接讲解');
    await store.send('停止');
    store.start('4 + 6');
    const b = store.selectedConversationId;
    store.setRhythm('gentle');
    await store.send('恢复自动教法');
    const restored = prepareLearningRestore(
      emptyLearningState('guest', store.state.timezone),
      store.exportData()
    ).state;
    let replay = emptyLearningState('guest', store.state.timezone);
    for (const e of store.state.events)
      replay = applyLearningOperation(
        replay,
        normalizePrivateSyncOperation({ id: e.id, type: e.type, at: e.at, data: e.data })
      ).state;
    for (const state of [restored, replay]) {
      expect(requestedTeachingMethod(state, a)).toBeNull(); // 停止时不执行；选择仍保留到明确继续。
      expect(state.conversations.find((c) => c.id === a).stopped).toBe(true);
      expect(requestedTeachingMethod(state, b)).toBeNull();
      expect(state.attempts).toHaveLength(0);
      const resumed = applyLearningOperation(state, {
        id: 'resume-replayed',
        type: 'task.resume',
        data: { conversationId: a, source: 'self_report' }
      }).state;
      expect(requestedTeachingMethod(resumed, a)).toBe('explain');
    }
  });
  it('模型背景与本轮锁读取当前对话；停止任务的普通消息不会调用模型或落作答', async () => {
    const store = begin(),
      a = store.selectedConversationId,
      key = questionKey(store.activeQuestion);
    await store.send('直接讲解');
    store.start('4 + 6');
    store.setRhythm('gentle');
    store.focus(key, a);
    store.models = [{ id: 'fixture', model: 'fixture', capabilities: {} }];
    store.modelId = 'fixture';
    store.selectedMode = 'cloud';
    store.sharingAllowed = true;
    api.generate.mockResolvedValue({ success: true, data: { message: '本轮教学夹具', tools: [] } });
    await store.send('请继续说明', { id: 'bound-model' });
    expect(api.generate.mock.calls[0][0].learningContext.strategy).toMatchObject({
      method: 'explain',
      conversationId: a,
      source: 'self_report'
    });
    expect(store.state.events.find((e) => e.id === 'bound-model:request').data.lockedMethod).toBe('explain');
    await store.send('停止');
    const count = store.state.attempts.length;
    await store.send('20');
    await store.send('请继续说明');
    expect(api.generate).toHaveBeenCalledTimes(1);
    expect(store.state.attempts).toHaveLength(count);
  });
  it('另一对话恢复自动不解除原选择；引用或否定自动指令不能释放教法', async () => {
    const store = begin(),
      a = store.selectedConversationId,
      key = questionKey(store.activeQuestion);
    await store.send('直接讲解');
    store.start('4 + 6');
    store.setRhythm('gentle');
    await store.send('恢复自动教法');
    expect(requestedTeachingMethod(store.state, a)).toBe('explain');
    store.focus(key, a);
    await store.send('不要恢复自动教法');
    await store.send('材料写着“恢复自动教法”');
    expect(requestedTeachingMethod(store.state, a)).toBe('explain');
    expect(store.state.events.filter((e) => e.type === 'strategy.auto')).toHaveLength(1);
  });
});
