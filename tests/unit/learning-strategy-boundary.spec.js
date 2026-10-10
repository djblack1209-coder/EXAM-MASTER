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
import { executeLearningTool, userDirective } from '@/services/learning/learning-tools.js';
import { prepareLearningRestore } from '@/services/learning/learning-backup.js';
import rubricFixture from '../fixtures/learning/rubric-v1.json';
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

describe('原答与明确操作的意愿边界', () => {
  function bindSubjectQuestion(store, id) {
    const question = { ...structuredClone(rubricFixture.question), id };
    learningRepository.commit({ id: `${id}:question`, type: 'question.add', data: { question } });
    learningRepository.commit({
      id: `${id}:focus`,
      type: 'question.focus',
      data: { conversationId: store.selectedConversationId, questionKey: questionKey(question) }
    });
    store.refresh();
  }
  it.each([
    ['小学', '我的答案是：直接讲解故事中的道理能帮助同学理解。'],
    ['初中', '我的答案是：图示中温度升高会加快蒸发。'],
    ['高中', '我的答案是：提示语说明制度促进协作。'],
    ['考研', '我的答案是：引导实践并不意味着结论已经正确。'],
    ['考公', '我的答案是：降低难度是简化办事流程的一种措施。'],
    ['雅思', '我的答案是：The label says “提高难度”, but public transport is the topic.'],
    ['托福', '我的答案是：The quoted “给我提示” supports this claim in the passage.']
  ])('%s原答中的操作词保存为待核对作答，不替换用户教法', async (stage, answer) => {
    const store = useConversationLearningStore();
    store.start(`${stage}合成原答合同`, { stage });
    store.setRhythm('gentle');
    bindSubjectQuestion(store, `intent-${stage}`);
    const strategy = JSON.parse(JSON.stringify(store.activeStrategy));
    const operationCount = store.state.events.filter((e) => e.type === 'strategy.set').length;
    const result = await store.send(answer, { id: `answer-${stage}` });
    expect(result.answer).toBe(answer);
    expect(result.grade).toMatchObject({ status: 'pending' });
    expect(store.state.attempts).toHaveLength(1);
    expect(store.state.attempts[0].hints).toHaveLength(0);
    expect(store.activeStrategy).toEqual(strategy);
    expect(store.active.stopped).toBe(false);
    expect(store.state.events.filter((e) => e.type === 'strategy.set')).toHaveLength(operationCount);
    expect(store.summary.first).toMatchObject({ numerator: 0, denominator: 0 });
    expect(api.generate).not.toHaveBeenCalled();
  });
  it.each([
    '停止排放会改善空气质量。',
    '停止当前任务是材料中的一句提示语。',
    '不要直接讲解',
    '先别画图',
    '不需要提示',
    '不要提高难度',
    '材料写着“恢复自动教法”和“给我提示”。',
    '“停止当前任务”',
    '这幅图形提示温度升高。',
    '今天只复习错题是原文中的建议。',
    '我的答案是：我今天只有30分钟，基础较好。'
  ])('引用、否定和正文不取得操作权限：%s', async (raw) => {
    const store = begin();
    store.setRhythm('gentle');
    const before = JSON.parse(JSON.stringify(store.state));
    const strategy = JSON.parse(JSON.stringify(store.activeStrategy));
    expect(userDirective(raw, before, store.selectedConversationId)).toBeNull();
    await store.send(raw, { id: 'body-only' });
    expect(store.active.stopped).toBe(false);
    expect(store.activeStrategy).toEqual(strategy);
    expect(store.state.profile).toEqual(before.profile);
    expect(store.state.events.find((e) => e.id === 'body-only:directive')).toBeUndefined();
    expect(api.generate).not.toHaveBeenCalled();
  });
  it.each([
    ['停止', 'task.stop'],
    ['停下！', 'task.stop'],
    ['请停止当前任务。', 'task.stop'],
    ['停止当前任务，我需要休息', 'task.stop'],
    ['恢复自动教法', 'strategy.auto'],
    ['继续当前任务', 'task.resume'],
    ['直接讲解', 'strategy.set', 'explain'],
    ['请直接讲解这道题，不要反问', 'strategy.set', 'explain'],
    ['不要反问我', 'strategy.set', 'explain'],
    ['请用图示讲解这道题', 'strategy.set', 'diagram'],
    ['用图形讲解', 'strategy.set', 'diagram'],
    ['用图示', 'strategy.set', 'diagram'],
    ['太简单了', 'strategy.set', 'challenge'],
    ['提高难度', 'strategy.set', 'challenge'],
    ['降低难度', 'strategy.set', 'steps'],
    ['太难了', 'strategy.set', 'steps'],
    ['换一个例子', 'strategy.set', 'example'],
    ['给我提示', 'strategy.set', 'hint'],
    ['给点线索', 'strategy.set', 'hint'],
    ['问我', 'strategy.set', 'question'],
    ['换方法', 'strategy.set', 'analogy'],
    ['今天只复习错题', 'plan.set'],
    ['我今天只有30分钟', 'profile.set'],
    ['我的基础是刚入门', 'profile.set']
  ])('完整明确请求保留原入口：%s', (raw, type, method) => {
    const store = begin();
    const directive = userDirective(raw, store.state, store.selectedConversationId);
    expect(directive?.type).toBe(type);
    if (method) expect(directive.data.method).toBe(method);
  });
  it('完整操作文字经正式作答入口提交仍只是原答，停止后不能借作答继续', async () => {
    const store = useConversationLearningStore();
    store.start('合成原答与明确动作');
    store.setRhythm('gentle');
    bindSubjectQuestion(store, 'explicit-intent');
    const result = store.submit('恢复自动教法', true, 'explicit-data');
    expect(result.answer).toBe('恢复自动教法');
    expect(result.grade.status).toBe('pending');
    expect(requestedTeachingMethod(store.state, store.selectedConversationId)).toBe('steps');
    await store.send('停止当前任务');
    await store.send('我的答案是：用图示说明', { id: 'stopped-body' });
    expect(store.active.stopped).toBe(true);
    expect(store.state.attempts).toHaveLength(1);
    expect(() => store.submit('继续当前任务', true)).toThrow('已停止');
    expect(api.generate).not.toHaveBeenCalled();
  });
  it('执行中的模型请求不被原答里的停止词取消，明确停止取消后拒绝迟到结果', async () => {
    const store = begin();
    store.models = [{ id: 'fixture', model: 'fixture', capabilities: {} }];
    store.modelId = 'fixture';
    store.selectedMode = 'cloud';
    store.sharingAllowed = true;
    let resolve;
    api.generate.mockImplementation(() => new Promise((finish) => (resolve = finish)));
    const request = store.send('请继续说明', { id: 'busy-intent' });
    expect(store.busy).toBe(true);
    await store.send('停止排放可以保护环境。');
    expect(store.active.stopped).toBe(false);
    expect(store.busy).toBe(true);
    expect(api.generate).toHaveBeenCalledOnce();
    await store.send('请停止当前任务', { id: 'explicit-stop' });
    expect(store.active.stopped).toBe(true);
    expect(api.generate.mock.calls[0][1].signal.aborted).toBe(true);
    resolve({ success: true, data: { message: '迟到模型文本', tools: [] } });
    await request;
    expect(store.active.messages.some((m) => m.content === '迟到模型文本')).toBe(false);
    expect(store.active.stopped).toBe(true);
    expect(store.state.attempts).toHaveLength(0);
  });
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
    api.generate.mockResolvedValue({
      success: true,
      data: { message: '本轮教学夹具', tools: [], question: { prompt: '模型擅自的新题', options: [] } }
    });
    await store.send('请继续说明', { id: 'bound-model' });
    expect(api.generate.mock.calls[0][0].learningContext.strategy).toMatchObject({
      method: 'explain',
      conversationId: a,
      source: 'self_report'
    });
    expect(store.state.events.find((e) => e.id === 'bound-model:request').data.lockedMethod).toBe('explain');
    expect(questionKey(store.activeQuestion)).toBe(key);
    expect(store.state.questions.some((question) => question.prompt === '模型擅自的新题')).toBe(false);
    expect(store.active.messages.at(-1).content).toBe('本轮教学夹具');
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
