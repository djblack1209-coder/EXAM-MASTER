import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useConversationLearningStore } from '@/stores/modules/conversation-learning.js';
import { learningRepository } from '@/services/learning/learning-repository.js';
import { emptyLearningState } from '@/services/learning/learning-domain.js';
import { prepareLearningRestore } from '@/services/learning/learning-backup.js';
import { poetryEncouragement, validatedPoetryReference } from '@/services/learning/learning-chat.js';
import poetryCache from '@/services/learning/poetry-cache.json';
import { learningText } from '@/i18n/learning.js';
import { setLanguage } from '@/i18n/index.js';
import '@/pages/learning/messages.js';
import { FRACTION_CONTRACT } from '../../laf-backend/functions/_shared/learning-fraction.js';
import {
  DENSITY_TRANSFER_CONTRACT,
  PRESSURE_TRANSFER_CONTRACT
} from '../../laf-backend/functions/_shared/learning-science.js';
import { EMAIL_WRITING_CONTRACT } from '../../laf-backend/functions/_shared/learning-writing.js';
import { localTeaching } from '@/services/learning/learning-tools.js';
import { SENTENCE_CONTRACT } from '../../laf-backend/functions/_shared/learning-sentence.js';

const clone = (value) => JSON.parse(JSON.stringify(value));
beforeEach(() => {
  uni.clearStorageSync();
  setActivePinia(createPinia());
  setLanguage('zh-CN');
});
afterEach(() => {
  vi.restoreAllMocks();
  setLanguage('zh-CN');
});

describe('诗词调用接续', () => {
  let store;
  const reference = {
    referenceId: poetryCache.id,
    sourceUrl: poetryCache.sourceUrl,
    upstreamPoemId: '253',
    provider: 'https://poetry.palemoky.com'
  };
  const settle = async () => {
    for (let step = 0; step < 8; step++) await Promise.resolve();
  };
  const prepare = () => {
    uni.setStorageSync('EXAM_USER_ID', 'poetry-fixture-owner');
    uni.setStorageSync('EXAM_TOKEN', 'poetry-fixture-only-token');
    store = useConversationLearningStore();
    store.start('解关于 t 的不等式 t<3');
    store.submit('t<3', true, 'poetry-original', { chatEntry: true, poetry: false });
    store.generateVariant();
  };
  const enableFixture = async () => {
    const abort = vi.fn();
    let pending;
    const request = vi.spyOn(uni, 'request').mockImplementation((options) => {
      if (options.data.action === 'list') {
        void Promise.resolve().then(() =>
          options.success({ data: { success: true, data: { models: [], poetryReferenceEnabled: true } } })
        );
      } else {
        pending = options;
      }
      return { abort };
    });
    await store.loadModels();
    return { request, abort, pending: () => pending };
  };
  const completeVariant = () => store.submit('t<2', true, 'poetry-variant', { chatEntry: true });
  const reply = (operation, value = reference) =>
    operation.pending().success({ data: { success: true, data: { reference: value } } });
  afterEach(() => {
    store?.$dispose();
    store = null;
    vi.useRealTimers();
  });

  it('默认关闭时保留即时本地鼓励，完全不发送辅助请求', () => {
    prepare();
    const request = vi.spyOn(uni, 'request');
    expect(completeVariant().grade.outcome).toBe('correct');
    expect(store.active.messages.at(-1).content).toContain(poetryCache.text);
    expect(store.poetryReferenceEnabled).toBe(false);
    expect(store.poetryReference).toBeNull();
    expect(request).not.toHaveBeenCalled();
  });

  it('慢查询不阻塞已存原答与鼓励，仅发送固定公开情境，来源结果不写学习事实', async () => {
    prepare();
    const operation = await enableFixture();
    const attempt = completeVariant();
    expect(store.busy).toBe(false);
    expect(store.active.messages.at(-1).content).toContain(poetryCache.text);
    expect(operation.pending().data).toEqual({ action: 'poetry', context: poetryCache.context });
    expect(operation.pending().url).toMatch(/\/learning-models$/u);
    const before = clone(store.state);
    reply(operation);
    await settle();
    expect(store.poetryReference).toEqual({
      conversationId: store.active.id,
      questionKey: attempt.questionKey,
      attemptId: attempt.id,
      reference
    });
    expect(store.state).toEqual(before);
    expect(learningRepository.read()).toEqual(before);
    expect(operation.request).toHaveBeenCalledTimes(2);
  });

  it.each(['cancel', 'conversation', 'question', 'owner', 'records', 'stop', 'dispose', 'disabled', 'mode'])(
    '%s之后丢弃迟到的来源结果，保留该动作完成后的全部学习事实',
    async (change) => {
      prepare();
      const operation = await enableFixture();
      completeVariant();
      if (change === 'cancel') store.cancel();
      if (change === 'conversation') store.selectedConversationId = null;
      if (change === 'question') store.generateVariant();
      if (change === 'owner') {
        uni.setStorageSync('EXAM_USER_ID', 'poetry-other-fixture-owner');
        store.refresh();
      }
      if (change === 'records') {
        vi.spyOn(learningRepository, 'lifecycleContext').mockReturnValue(['poetry-fixture-owner', 'replaced-fixture']);
        store.refresh();
      }
      if (change === 'stop') await store.send('停止', { chatEntry: true });
      if (change === 'dispose') store.$dispose();
      if (change === 'disabled') store.poetryReferenceEnabled = false;
      if (change === 'mode') store.selectedMode = 'cloud';
      const before = clone(store.state);
      reply(operation);
      await settle();
      expect(operation.abort).toHaveBeenCalledOnce();
      expect(store.poetryReference).toBeNull();
      expect(store.state).toEqual(before);
    }
  );

  it('辅助请求在1200毫秒内取消，底层没有取消回调也能结束且不接受迟到响应', async () => {
    vi.useFakeTimers();
    prepare();
    const operation = await enableFixture();
    const previousTimers = vi.getTimerCount();
    completeVariant();
    const before = clone(store.state);
    await vi.advanceTimersByTimeAsync(1200);
    expect(operation.abort).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(previousTimers);
    reply(operation);
    await settle();
    expect(store.poetryReference).toBeNull();
    expect(store.state).toEqual(before);
    expect(store.busy).toBe(false);
  });

  it('只接受已核对原诗的四项来源字段，拒绝替换出处、任意编号或额外内容', () => {
    expect(validatedPoetryReference(reference)).toEqual(reference);
    for (const invalid of [
      { ...reference, referenceId: 'other-poem' },
      { ...reference, sourceUrl: 'https://untrusted.example/poem' },
      { ...reference, provider: 'https://untrusted.example' },
      { ...reference, upstreamPoemId: '../private' },
      { ...reference, upstreamPoemId: '1'.repeat(13) },
      { ...reference, content: 'unverified content' }
    ])
      expect(validatedPoetryReference(invalid)).toBeNull();
  });
});

describe('压强聊天接续', () => {
  let store;
  const send = (text, id) => store.send(text, { chatEntry: true, id });
  beforeEach(() => {
    store = useConversationLearningStore();
  });
  afterEach(() => {
    store.$dispose();
  });

  it.each(['压强', '练习压强', '压强、压力与接触面积', 'Practice pressure', 'Study contact pressure'])(
    '明确选择%s进入原有练习，保留同一目标且不推断基础或自动作答',
    async (topic) => {
      const request = vi.spyOn(uni, 'request');
      await send('我想复习物理', 'pressure-goal');
      const conversationId = store.active.id;
      const goal = store.active.goal;
      await send(topic, 'pressure-topic');
      expect(store.active.id).toBe(conversationId);
      expect(store.active.goal).toBe(goal);
      expect(store.activeQuestion).toMatchObject({
        subject: '物理',
        source: { kind: 'project_original', reference: PRESSURE_TRANSFER_CONTRACT },
        scienceExercise: {
          contract: PRESSURE_TRANSFER_CONTRACT,
          conversationId,
          input: { target: 'pressure', uniformContact: true, normalForceN: 72, areaCm2: 24 }
        }
      });
      expect(store.activeQuestion.prompt).toContain('压力垂直接触面且压强均匀');
      expect(store.activeQuestion.options).toContain('A. 30000Pa');
      expect(store.state.attempts).toEqual([]);
      expect(store.state.executions).toEqual([]);
      expect(store.state.events.some((event) => event.type === 'profile.set')).toBe(false);
      const opened = clone(store.state);
      await send(topic, 'pressure-topic');
      expect(store.state).toEqual(opened);
      expect(request).not.toHaveBeenCalled();
    }
  );

  it('明确错答、真实提示后订正、无帮助新条件及未来复测停止重开保全，零网络', async () => {
    const request = vi.spyOn(uni, 'request');
    await send('复习压强', 'pressure-open');
    const conversationId = store.active.id;
    store.submit('B', true, 'pressure-wrong', { chatEntry: true });
    const original = clone(store.state.attempts[0]);
    expect(original).toMatchObject({ answer: 'B', hints: [], grade: { status: 'reliable', outcome: 'wrong' } });
    const protectedFacts = clone({
      questions: store.state.questions,
      profile: store.state.profile
    });
    const previousDifficulty = store.state.strategy.difficulty;
    const previousEvents = store.state.events.length;
    await send('给我提示', 'pressure-hint');
    expect(store.active.pendingHints).toHaveLength(1);
    expect(store.active.pendingHints[0].content).toContain('面积从cm²除以10000换成m²');
    expect(store.state.attempts).toEqual([original]);
    expect({ questions: store.state.questions, profile: store.state.profile }).toEqual(protectedFacts);
    expect(store.state.strategy).toMatchObject({
      conversationId,
      method: 'hint',
      source: 'self_report',
      difficulty: previousDifficulty
    });
    expect(
      store.state.events
        .slice(previousEvents)
        .filter((event) => ['strategy.set', 'strategy.auto'].includes(event.type))
        .map((event) => [event.type, event.data.method, event.data.source])
    ).toEqual([['strategy.set', 'hint', 'self_report']]);
    const helped = clone(store.state);
    await send('给我提示', 'pressure-hint');
    expect(store.state).toEqual(helped);
    store.submit('A', true, 'pressure-corrected', { chatEntry: true });
    expect(store.state.attempts[1]).toMatchObject({
      kind: 'revision',
      hints: [expect.any(Object)],
      grade: { outcome: 'correct' }
    });
    await send('独立检验原题', 'pressure-independent');
    expect(store.activeQuestion.scienceExercise.input).toMatchObject({
      target: 'force',
      uniformContact: true,
      pressurePa: 13600,
      areaCm2: 56
    });
    expect(store.activeQuestion.options).toContain('C. 76.16N');
    expect(store.active.pendingHints).toEqual([]);
    store.submit('C', true, 'pressure-variant-answer', { chatEntry: true });
    expect(store.state.attempts[2]).toMatchObject({
      kind: 'variant',
      hints: [],
      grade: { outcome: 'correct', evaluator: 'deterministic-science-v6' }
    });
    const future = store.scheduleScienceRetest();
    const planned = store.state.questions.find(
      (question) => `${question.id}@${question.version}` === future.questionKey
    );
    expect(planned.scienceExercise).toMatchObject({ phase: 'retest', plannedTimezone: store.state.timezone });
    store.focus(future.questionKey);
    expect(() => store.submit('A', true, 'pressure-early')).toThrow();
    expect(store.state.attempts).toHaveLength(3);
    expect(
      store.state.plans
        .filter((plan) => plan.day === future.day)
        .at(-1)
        .tasks.at(-1).completedBy
    ).toBeNull();
    await send('停止', 'pressure-stop');
    const before = clone(store.state);
    const exported = store.exportData();
    store.$dispose();
    setActivePinia(createPinia());
    store = useConversationLearningStore();
    expect(store.active.id).toBe(conversationId);
    expect(store.active.stopped).toBe(true);
    expect(store.state).toEqual(before);
    const restored = prepareLearningRestore(emptyLearningState(before.owner, before.timezone), exported).state;
    expect(restored.attempts).toEqual(before.attempts);
    expect(restored.conversations).toEqual(before.conversations);
    expect(restored.plans).toEqual(before.plans);
    expect(restored.reviews).toEqual(before.reviews);
    expect(before.events.some((event) => event.type === 'model.request')).toBe(false);
    expect(before.conversations[0].messages.some((message) => message.content.startsWith('妙哉妙哉'))).toBe(false);
    expect(request).not.toHaveBeenCalled();
  });

  it('明确切题保留旧原答，否定/引用/停止不出题，伪造条件不产生教学依据', async () => {
    await send('方程', 'pressure-math');
    await send('t=3', 'pressure-math-answer');
    const original = clone(store.state.attempts);
    await send('练习压强', 'pressure-switch');
    const key = store.active.activeQuestionKey;
    for (const text of ['不要练习压强', '材料写着“压强”', '血压', 'Practice blood pressure']) await send(text);
    expect(store.active.activeQuestionKey).toBe(key);
    expect(store.state.attempts).toEqual(original);
    const tampered = clone(store.activeQuestion);
    tampered.scienceExercise.input.uniformContact = false;
    expect(localTeaching(tampered, 'hint')).toBeNull();
    expect(localTeaching(store.activeQuestion, 'review')).toMatchObject({ helped: false });
    await send('停止', 'pressure-boundary-stop');
    const questions = clone(store.state.questions);
    const hints = clone(store.active.pendingHints);
    await send('练习压强', 'pressure-stopped-topic');
    await send('给我提示', 'pressure-stopped-hint');
    expect(store.state.questions).toEqual(questions);
    expect(store.active.pendingHints).toEqual(hints);
    expect(store.state.attempts).toEqual(original);
  });

  it('给出的具体压强题保留原条件并待核对，不被原创模板覆盖或获得旧题判分', async () => {
    await send('压强', 'pressure-template');
    await send('题目：容器内气体压强如何随温度变化？', 'pressure-supplied');
    expect(store.activeQuestion).toMatchObject({
      prompt: '容器内气体压强如何随温度变化？',
      validation: null,
      source: { kind: 'user_input' }
    });
    expect(store.activeQuestion.scienceExercise).toBeUndefined();
    store.submit('A', true, 'pressure-supplied-answer', { chatEntry: true });
    expect(store.state.attempts.at(-1).grade.status).toBe('pending');
    expect(store.state.reviews).toEqual([]);
  });
});

it.each(['英文句子组织', '练习英语句子排序', 'Practice English sentence building', 'Sentence ordering'])(
  '句子聊天：显式主题%s只接既有原创词块任务，不推断水平或写作答',
  async (goal) => {
    const store = useConversationLearningStore();
    const request = vi.spyOn(uni, 'request');
    await store.send(goal, { chatEntry: true });
    expect(store.active.goal).toBe(goal);
    expect(store.activeQuestion.sentenceExercise).toMatchObject({
      contract: SENTENCE_CONTRACT,
      taskId: 'library-hours',
      conversationId: store.active.id
    });
    expect(store.activeQuestion.source).toEqual({ kind: 'project_original', reference: SENTENCE_CONTRACT });
    expect(store.active.messages.at(-1).content).toBe('点选词块组织句子，明确提交后保存作答。');
    expect(store.state.questions).toHaveLength(1);
    expect(store.state.attempts).toEqual([]);
    expect(store.state.executions).toEqual([]);
    expect(store.state.events.some((event) => ['profile.set', 'model.request'].includes(event.type))).toBe(false);
    expect(request).not.toHaveBeenCalled();
  }
);

it('句子聊天：同会话错答、真实帮助后订正、独立新句和复测安排停止重开保全', async () => {
  const store = useConversationLearningStore();
  const request = vi.spyOn(uni, 'request');
  const send = (text, id) => store.send(text, { chatEntry: true, id });
  await send('我想练习英语写作', 'sentence-goal');
  const conversationId = store.active.id;
  await send('英文句子组织', 'sentence-topic');
  expect(store.active.id).toBe(conversationId);
  expect(store.active.goal).toBe('我想练习英语写作');
  const opened = clone(store.state.events);
  await send('英文句子组织', 'sentence-topic');
  expect(store.state.events).toEqual(opened);
  store.submitSentence(store.writingContext(), ['t4', 't2', 't3']);
  const original = clone(store.state.attempts[0]);
  expect(original.grade).toMatchObject({ status: 'reliable', outcome: 'wrong' });
  expect(original.hints).toEqual([]);
  const strategy = clone(store.state.strategy);
  const profile = clone(store.state.profile);
  const questions = clone(store.state.questions);
  const beforeHelpEvents = store.state.events.length;
  await send('给我提示', 'sentence-help');
  expect(store.active.pendingHints).toHaveLength(1);
  expect(store.active.pendingHints[0].questionKey).toBe(store.active.activeQuestionKey);
  expect(store.active.messages.at(-1).content).toContain('先找主语后的谓语');
  expect(store.state.strategy).toEqual(strategy);
  expect(store.state.profile).toEqual(profile);
  expect(store.state.questions).toEqual(questions);
  expect(store.state.attempts[0]).toEqual(original);
  expect(
    store.state.events
      .slice(beforeHelpEvents)
      .some((event) => ['strategy.set', 'strategy.auto', 'model.request'].includes(event.type))
  ).toBe(false);
  const helped = clone(store.state.events);
  await send('给我提示', 'sentence-help');
  expect(store.state.events).toEqual(helped);
  store.submitSentence(store.writingContext(), ['t1', 't2', 't3']);
  expect(store.state.attempts[1]).toMatchObject({ kind: 'revision', grade: { outcome: 'correct' } });
  expect(store.state.attempts[1].hints).toHaveLength(1);
  await send('独立检验原题', 'sentence-independent');
  expect(store.activeQuestion.sentenceExercise.taskId).toBe('meeting-room');
  expect(store.activeQuestion.parentQuestionKey).toBe(original.questionKey);
  expect(store.active.pendingHints).toEqual([]);
  store.submitSentence(store.writingContext(), ['t1', 't2', 't3']);
  expect(store.state.attempts[2]).toMatchObject({ kind: 'variant', hints: [], grade: { outcome: 'correct' } });
  const retest = store.scheduleSentenceRetest(store.writingContext());
  const planned = store.state.questions.find((question) => `${question.id}@${question.version}` === retest.questionKey);
  expect(planned.sentenceExercise.phase).toBe('retest');
  expect(store.state.attempts).toHaveLength(3);
  expect(store.state.plans.filter((plan) => plan.day === retest.day).at(-1).tasks[0].completedBy).toBeNull();
  await send('停止', 'sentence-stop');
  const before = clone(store.state);
  const exported = store.exportData();
  setActivePinia(createPinia());
  const reopened = useConversationLearningStore();
  expect(reopened.active.stopped).toBe(true);
  expect(reopened.state).toEqual(before);
  const restored = prepareLearningRestore(emptyLearningState(before.owner, before.timezone), exported).state;
  expect(restored.attempts).toEqual(before.attempts);
  expect(restored.questions).toEqual(before.questions);
  expect(restored.plans).toEqual(before.plans);
  expect(restored.conversations).toEqual(before.conversations);
  expect(before.events.some((event) => event.type === 'model.request')).toBe(false);
  expect(before.conversations[0].messages.some((message) => message.content.startsWith('妙哉妙哉'))).toBe(false);
  expect(request).not.toHaveBeenCalled();
});

it('句子聊天：否定引用不换题或记作答，停止后请求不得增加帮助', async () => {
  const store = useConversationLearningStore();
  await store.send('英文句子组织', { chatEntry: true });
  const originalQuestion = clone(store.activeQuestion);
  for (const text of ['不要练习英文句子组织', '材料里写着“英文句子组织”', '不要给我提示', '引用“句子提示”'])
    await store.send(text, { chatEntry: true });
  expect(store.state.questions).toEqual([originalQuestion]);
  expect(store.state.attempts).toEqual([]);
  expect(store.active.pendingHints).toEqual([]);
  await store.send('停止', { chatEntry: true });
  const strategy = clone(store.state.strategy);
  await store.send('句子提示', { chatEntry: true });
  await store.send('练习英文句子组织', { chatEntry: true });
  expect(store.active.stopped).toBe(true);
  expect(store.state.questions).toEqual([originalQuestion]);
  expect(store.state.attempts).toEqual([]);
  expect(store.active.pendingHints).toEqual([]);
  expect(store.state.strategy).toEqual(strategy);
});

it('句子聊天：另一会话的旧停止任务和原始有效教法保持', async () => {
  const store = useConversationLearningStore();
  store.start('原有资料学习');
  const oldId = store.active.id;
  await store.send('直接讲解');
  await store.send('停止');
  const previous = clone(store.active);
  const previousEvents = clone(store.state.events);
  store.selectedConversationId = null;
  await store.send('Practice English sentence building', { chatEntry: true });
  await store.send('give me a hint', { chatEntry: true });
  expect(store.state.conversations.find((conversation) => conversation.id === oldId)).toEqual(previous);
  expect(store.state.events.slice(0, previousEvents.length)).toEqual(previousEvents);
  expect(store.active.pendingHints).toHaveLength(1);
  expect(store.state.attempts).toEqual([]);
});

it('句子页顶提示：不带聊天标记的页面调用保留首答与本题依据，仅记真实帮助且重试去重', async () => {
  const store = useConversationLearningStore();
  store.start('英文句子组织');
  store.submitSentence(store.writingContext(), ['t4', 't2', 't3']);
  const before = clone(store.state);
  await store.send('提示', { id: 'page-sentence-hint' });
  for (const key of ['attempts', 'questions', 'profile', 'strategy']) expect(store.state[key]).toEqual(before[key]);
  expect(store.active.pendingHints).toHaveLength(1);
  expect(store.active.pendingHints[0].questionKey).toBe(store.active.activeQuestionKey);
  expect(store.active.messages.at(-1).content).toContain('先找主语后的谓语');
  expect(store.state.events.slice(before.events.length).map((event) => event.type)).toEqual([
    'message.add',
    'hint.add',
    'message.add'
  ]);
  const helped = clone(store.state);
  await store.send('提示', { id: 'page-sentence-hint' });
  expect(store.state).toEqual(helped);
});

it('句子页顶提示：切到普通私人题后保留旧停止句子，本题仍走原教法分支', async () => {
  const store = useConversationLearningStore();
  store.start('英文句子组织');
  await store.send('停止');
  const previous = clone(store.active);
  store.start('普通私人题');
  const result = store.commit('question.add', {
    question: {
      id: 'page-hint-other-question',
      version: 1,
      scope: 'private',
      subject: '其他',
      prompt: '保留原条件的私人题，尚未校对。',
      answerType: 'subjective',
      source: { kind: 'user_input', reference: null }
    }
  });
  store.focus(result.questionKey);
  const current = clone(store.activeQuestion);
  await store.send('提示');
  expect(store.state.conversations.find((conversation) => conversation.id === previous.id)).toEqual(previous);
  expect(store.activeQuestion).toEqual(current);
  expect(store.active.pendingHints).toEqual([]);
  expect(store.activeStrategy.method).toBe('hint');
  expect(store.state.attempts).toEqual([]);
});

it('句子页顶提示：非离线模式保留原授权拒绝，不读取本地句子提示或发请求', async () => {
  const store = useConversationLearningStore();
  const request = vi.spyOn(uni, 'request');
  store.start('英文句子组织');
  const original = clone(store.activeQuestion);
  store.selectedMode = 'cloud';
  store.sharingAllowed = false;
  await expect(store.send('提示')).rejects.toMatchObject({ code: 'CONSENT_REQUIRED' });
  expect(store.activeQuestion).toEqual(original);
  expect(store.active.pendingHints).toEqual([]);
  expect(store.state.attempts).toEqual([]);
  expect(store.activeStrategy.method).toBe('hint');
  expect(request).not.toHaveBeenCalled();
});

it('句子页顶提示：当前任务停止后默认页面调用不改变帮助、画像或教法', async () => {
  const store = useConversationLearningStore();
  store.start('英文句子组织');
  await store.send('停止');
  const before = clone(store.state);
  await store.send('提示');
  expect(store.active.stopped).toBe(true);
  expect(store.active.pendingHints).toEqual([]);
  for (const key of ['attempts', 'questions', 'profile', 'strategy']) expect(store.state[key]).toEqual(before[key]);
});

it.each([
  '我想复习初二语文',
  '我想复习初二',
  '小学',
  '我想复习初中',
  '我想复习高中历史',
  'I want to study history',
  'Explain the aftermath'
])('科目澄清不从学段或非数学目标%s推断数学，也不先出题或写基础', async (goal) => {
  const store = useConversationLearningStore();
  const request = vi.spyOn(uni, 'request');
  await store.send(goal, { chatEntry: true });
  expect(store.active.goal).toBe(goal);
  expect(store.active.messages.at(-1).content).toBe('你想先解决哪道题或哪个知识点？可以直接贴题。');
  expect(store.state.questions).toHaveLength(0);
  expect(store.state.attempts).toHaveLength(0);
  expect(store.state.events.some((event) => event.type === 'profile.set')).toBe(false);
  expect(request).not.toHaveBeenCalled();
});

it('目标后在同一聊天选分数、错答订正和独立复测，停止重开及恢复保留原答和一次短诗', async () => {
  const store = useConversationLearningStore();
  const request = vi.spyOn(uni, 'request');
  const send = (text, id) => store.send(text, { chatEntry: true, id });
  await send('我想复习小学数学', 'fraction-goal');
  const conversationId = store.active.id;
  await send('分数四则', 'fraction-topic');
  expect(store.active.id).toBe(conversationId);
  expect(store.activeQuestion.source.evidenceId).toBe(FRACTION_CONTRACT);
  expect(store.activeQuestion.prompt).toBe('计算 1/2 + 1/3。');
  expect(store.state.attempts).toHaveLength(0);
  const opened = clone(store.state.events);
  await send('分数四则', 'fraction-topic');
  expect(store.state.events).toEqual(opened);
  await send('2/5', 'fraction-wrong');
  expect(store.state.attempts.at(-1).grade.outcome).toBe('wrong');
  await send('给我提示', 'fraction-help');
  await send('5/6', 'fraction-correction');
  expect(store.state.attempts.at(-1)).toMatchObject({ kind: 'revision', grade: { outcome: 'correct' } });
  expect(store.state.attempts.at(-1).hints.length).toBeGreaterThan(0);
  const poems = () => store.active.messages.filter((message) => message.content.startsWith('妙哉妙哉'));
  expect(poems()).toHaveLength(0);
  await send('独立检验原题', 'fraction-variant');
  expect(store.activeQuestion.prompt).toBe('计算 2/2 + 1/3。');
  await send('4/3', 'fraction-independent');
  expect(store.state.attempts.at(-1)).toMatchObject({ kind: 'variant', hints: [], grade: { outcome: 'correct' } });
  expect(poems()).toHaveLength(1);
  expect(poems()[0].content).toContain('御定全唐詩');
  await send('练习方程', 'fraction-switch');
  await send('t=3', 'fraction-equation-original');
  await send('独立检验原题', 'fraction-equation-variant');
  await send('t=2', 'fraction-equation-independent');
  expect(poems()).toHaveLength(1);
  await send('停止', 'fraction-stop');
  const before = clone(store.state);
  setActivePinia(createPinia());
  const reopened = useConversationLearningStore();
  expect(reopened.active.stopped).toBe(true);
  expect(reopened.state.attempts).toEqual(before.attempts);
  expect(reopened.state.events).toEqual(before.events);
  const restored = prepareLearningRestore(emptyLearningState('guest', before.timezone), store.exportData()).state;
  expect(restored.attempts).toEqual(before.attempts);
  expect(restored.reviews).toEqual(before.reviews);
  expect(restored.conversations).toEqual(before.conversations);
  expect(request).not.toHaveBeenCalled();
});

it.each([
  ['分数加减', '计算 1/2 + 1/3。'],
  ['分数乘除', '计算 2/3 ÷ 4/5。'],
  ['Practice fractions', '计算 1/2 + 1/3。'],
  ['题目：计算 3/4 ÷ -9/8', '计算 3/4 ÷ -9/8。'],
  ['1/2 + 1/3', '计算 1/2 + 1/3。']
])('已有目标后明确选题%s，不建立第二会话或误记原答', async (text, prompt) => {
  const store = useConversationLearningStore();
  await store.send('先复习数学', { chatEntry: true, id: 'fraction-existing-goal' });
  const id = store.active.id;
  await store.send(text, { chatEntry: true, id: 'fraction-explicit-choice' });
  expect(store.active.id).toBe(id);
  expect(store.activeQuestion.prompt).toBe(prompt);
  expect(store.state.attempts).toHaveLength(0);
  expect(store.state.conversations).toHaveLength(1);
});

it('分数答案不切题，否定和引用不选题；不支持的完整题保留为私人待核对，停止不出题', async () => {
  const store = useConversationLearningStore();
  const send = (text, id) => store.send(text, { chatEntry: true, id });
  await send('分数', 'fraction-answer-topic');
  const originalKey = store.active.activeQuestionKey;
  await send('5/6', 'fraction-answer');
  expect(store.active.activeQuestionKey).toBe(originalKey);
  expect(store.state.attempts.at(-1).grade.outcome).toBe('correct');
  for (const text of ['不是练习分数', '他说“分数四则”']) await send(text);
  expect(store.active.activeQuestionKey).toBe(originalKey);
  expect(store.state.questions).toHaveLength(1);
  await send('题目：1/2 ÷ 0/3', 'fraction-unsupported');
  expect(store.activeQuestion).toMatchObject({
    prompt: '1/2 ÷ 0/3',
    scope: 'private',
    source: { kind: 'user_input' },
    validation: null,
    publishable: false
  });
  expect(store.state.attempts).toHaveLength(1);
  await send('停止', 'fraction-unsupported-stop');
  await send('练习分数乘除', 'fraction-stopped-choice');
  expect(store.state.questions).toHaveLength(2);
  expect(store.active.stopped).toBe(true);
});

it('明确物理目标后只澄清密度，沿同一聊天错答/提示订正/独立新条件和停止恢复，零网络', async () => {
  const store = useConversationLearningStore();
  const request = vi.spyOn(uni, 'request');
  const send = (text, id) => store.send(text, { chatEntry: true, id });
  await send('我想复习初中物理', 'density-goal');
  const conversationId = store.active.id;
  expect(store.active.messages.at(-1).content).toContain('比如密度');
  expect(store.state.questions).toHaveLength(0);
  expect(store.state.events.some((event) => event.type === 'profile.set')).toBe(false);
  await send('密度', 'density-topic');
  expect(store.active.id).toBe(conversationId);
  expect(store.activeQuestion.scienceExercise.contract).toBe(DENSITY_TRANSFER_CONTRACT);
  expect(store.activeQuestion.scienceExercise.conversationId).toBe(conversationId);
  expect(store.activeQuestion.options).toContain('C. 2.4g/cm³');
  expect(store.state.attempts).toHaveLength(0);
  const opened = clone(store.state.events);
  await send('密度', 'density-topic');
  expect(store.state.events).toEqual(opened);
  store.submit('A', true, 'density-wrong', { chatEntry: true });
  expect(store.state.attempts.at(-1).grade.outcome).toBe('wrong');
  await send('给我提示', 'density-hint');
  expect(store.active.pendingHints.at(-1).content).toContain('密度＝质量÷体积');
  store.submit('C', true, 'density-correction', { chatEntry: true });
  expect(store.state.attempts.at(-1)).toMatchObject({ kind: 'revision', grade: { outcome: 'correct' } });
  expect(store.state.attempts.at(-1).hints.length).toBeGreaterThan(0);
  await send('独立检验原题', 'density-independent');
  expect(store.activeQuestion.scienceExercise.input).toMatchObject({
    target: 'mass',
    densityGcm3: 1.66,
    volumeCm3: 86
  });
  expect(store.activeQuestion.options).toContain('C. 142.76g');
  store.submit('C', true, 'density-independent-answer', { chatEntry: true });
  expect(store.state.attempts.at(-1)).toMatchObject({ kind: 'variant', hints: [], grade: { outcome: 'correct' } });
  expect(store.active.messages.some((message) => message.content.startsWith('妙哉妙哉'))).toBe(false);
  await send('停止', 'density-stop');
  const before = clone(store.state);
  setActivePinia(createPinia());
  const reopened = useConversationLearningStore();
  expect(reopened.active.stopped).toBe(true);
  expect(reopened.state.attempts).toEqual(before.attempts);
  const restored = prepareLearningRestore(emptyLearningState('guest', before.timezone), store.exportData()).state;
  expect(restored.conversations).toEqual(before.conversations);
  expect(restored.attempts).toEqual(before.attempts);
  expect(restored.events.map(({ id, type, at }) => ({ id, type, at }))).toEqual(
    before.events.map(({ id, type, at }) => ({ id, type, at }))
  );
  expect(
    restored.questions.map(({ id, version, prompt, options, scienceExercise }) => ({
      id,
      version,
      prompt,
      options,
      scienceExercise
    }))
  ).toEqual(
    before.questions.map(({ id, version, prompt, options, scienceExercise }) => ({
      id,
      version,
      prompt,
      options,
      scienceExercise
    }))
  );
  expect(request).not.toHaveBeenCalled();
});

it.each(['学习密度', '密度、质量与体积', 'Practice density'])(
  '已有目标后明确选择%s，不改身份或建立另一会话',
  async (topic) => {
    const store = useConversationLearningStore();
    await store.send('复习物理', { chatEntry: true });
    const conversationId = store.active.id;
    await store.send(topic, { chatEntry: true });
    expect(store.active.id).toBe(conversationId);
    expect(store.activeQuestion.scienceExercise.contract).toBe(DENSITY_TRANSFER_CONTRACT);
    expect(store.state.attempts).toHaveLength(0);
  }
);

it('密度换题保留数学原答，否定不切题，伪造条件不获教学依据，英文澄清可读', async () => {
  const store = useConversationLearningStore();
  const send = (text, id) => store.send(text, { chatEntry: true, id });
  await send('方程', 'density-old-topic');
  await send('t=3', 'density-old-answer');
  const original = clone(store.state.attempts);
  await send('练习密度', 'density-switch');
  expect(store.activeQuestion.scienceExercise.contract).toBe(DENSITY_TRANSFER_CONTRACT);
  const key = store.active.activeQuestionKey;
  for (const text of ['不要练习密度', '材料提到“密度”']) await send(text);
  expect(store.active.activeQuestionKey).toBe(key);
  expect(store.state.attempts).toEqual(original);
  const tampered = clone(store.activeQuestion);
  tampered.scienceExercise.input.massG = 0;
  expect(localTeaching(tampered, 'hint')).toBeNull();
  expect(localTeaching(store.activeQuestion, 'review')).toMatchObject({ helped: false });
  setLanguage('en');
  expect(learningText('想先练哪个知识点？比如密度，也可以直接贴题。')).toContain('density');
  expect(learningText(localTeaching(store.activeQuestion, 'review').content)).toContain('independently');
});

it('英语写作目标后在同一聊天选择邮件，保留原稿/帮助/独立稿及停止恢复，零网络且不作可靠判分', async () => {
  const store = useConversationLearningStore();
  const request = vi.spyOn(uni, 'request');
  const send = (text, id) => store.send(text, { chatEntry: true, id });
  await send('我想练习英语写作', 'email-goal');
  const conversationId = store.active.id;
  expect(store.active.messages.at(-1).content).toContain('比如英文邮件');
  expect(store.state.questions).toHaveLength(0);
  expect(store.state.events.some((event) => event.type === 'profile.set')).toBe(false);
  await send('英文邮件写作', 'email-topic');
  expect(store.active.id).toBe(conversationId);
  expect(store.activeQuestion.writingExercise).toMatchObject({ contract: EMAIL_WRITING_CONTRACT, conversationId });
  expect(store.activeQuestion.validation).toBeNull();
  expect(store.activeQuestion.rubric.criteria).toHaveLength(4);
  expect(store.active.messages.at(-1).content).toContain('明确提交后保存原稿');
  const opened = clone(store.state.events);
  await send('英文邮件写作', 'email-topic');
  expect(store.state.events).toEqual(opened);
  const original = 'Dear Ms Lee,\n\nCould we meet next Tuesday?\nThank you.\n  Mei  ';
  store.submit(original, true, 'email-original', { chatEntry: true });
  expect(store.state.attempts.at(-1)).toMatchObject({ answer: original, grade: { status: 'pending', outcome: null } });
  store.readWritingReference(store.writingContext(), 'mcmurrey-inquiry-letter-body-en-v1', 1);
  const revision = original + '\nI can bring the project notes.';
  store.submit(revision, true, 'email-revision', { chatEntry: true });
  expect(store.state.attempts.at(-1).hints).toHaveLength(1);
  const beforeIndependent = clone(store.state.attempts);
  const originalQuestion = store.active.activeQuestionKey;
  store.generateVariant();
  expect(store.activeQuestion.parentQuestionKey).toBe(originalQuestion);
  expect(store.active.pendingHints).toEqual([]);
  const independent =
    'Dear Coordinator,\nI am writing about our next activity.\nCould you confirm the date?\nBest,\nMei';
  store.submit(independent, true, 'email-independent', { chatEntry: true });
  expect(store.state.attempts.slice(0, 2)).toEqual(beforeIndependent);
  expect(store.state.attempts.at(-1)).toMatchObject({ answer: independent, hints: [], grade: { status: 'pending' } });
  expect(store.state.reviews).toEqual([]);
  expect(store.active.messages.some((message) => message.content.startsWith('妙哉妙哉'))).toBe(false);
  await send('停止', 'email-stop');
  const before = clone(store.state);
  setActivePinia(createPinia());
  const reopened = useConversationLearningStore();
  expect(reopened.active).toMatchObject({ id: conversationId, stopped: true });
  expect(reopened.state.attempts).toEqual(before.attempts);
  const restored = prepareLearningRestore(emptyLearningState('guest', before.timezone), store.exportData()).state;
  expect(restored.attempts).toEqual(before.attempts);
  expect(restored.conversations).toEqual(before.conversations);
  expect(request).not.toHaveBeenCalled();
});

it.each(['英语邮件', '练习英文邮件写作', 'Practice English email writing', 'Email writing'])(
  '目标后选择%s只接既有邮件任务，不推断基础或误记作答',
  async (topic) => {
    const store = useConversationLearningStore();
    await store.send('I want to practice writing in English', { chatEntry: true });
    const id = store.active.id;
    await store.send(topic, { chatEntry: true });
    expect(store.active.id).toBe(id);
    expect(store.activeQuestion.writingExercise.contract).toBe(EMAIL_WRITING_CONTRACT);
    expect(store.state.attempts).toHaveLength(0);
  }
);

it('明确换到邮件保留数学原答，否定/引用不换题，贴来的具体邮件任务不被模板替换', async () => {
  const store = useConversationLearningStore();
  const send = (text, id) => store.send(text, { chatEntry: true, id });
  await send('方程', 'email-math');
  await send('t=3', 'email-math-answer');
  const attempts = clone(store.state.attempts);
  const key = store.active.activeQuestionKey;
  for (const text of ['不要练习英文邮件写作', '材料里提到“英文邮件写作”']) await send(text);
  expect(store.active.activeQuestionKey).toBe(key);
  await send('练习英文邮件', 'email-switch');
  expect(store.activeQuestion.writingExercise.contract).toBe(EMAIL_WRITING_CONTRACT);
  expect(store.state.attempts).toEqual(attempts);
  const prompt = '请给校长写一封关于请假的英文邮件，必须包含两条原因';
  await send('题目：' + prompt, 'email-provided-task');
  expect(store.activeQuestion).toMatchObject({
    prompt,
    scope: 'private',
    source: { kind: 'user_input' },
    validation: null
  });
  expect(store.activeQuestion.writingExercise).toBeUndefined();
  await send('停止', 'email-provided-stop');
  const questions = store.state.questions.length;
  await send('练习英文邮件写作', 'email-stopped');
  expect(store.state.questions).toHaveLength(questions);
});

it.each(['提示', '读参考信件', 'give me a hint', 'Read sample email'])(
  '离线邮件聊天参考：%s直接读已有出处，首稿不变、真实帮助归本题且重试不重复',
  async (requestText) => {
    const store = useConversationLearningStore();
    const request = vi.spyOn(uni, 'request');
    await store.send('英文邮件写作', { chatEntry: true, id: 'reference-goal' });
    const original = 'Dear Library Team,\n\nCould I keep the book until Friday?\n\nMei  ';
    store.submit(original, true, 'reference-first', { chatEntry: true });
    const first = clone(store.state.attempts[0]);
    const strategy = clone(store.state.strategy);
    const profile = clone(store.state.profile);
    const eventsBefore = store.state.events.length;
    expect(store.canReadChatWritingReference).toBe(true);
    await store.send(requestText, { chatEntry: true, id: 'reference-read' });
    expect(store.state.attempts[0]).toEqual(first);
    expect(store.state.strategy).toEqual(strategy);
    expect(store.state.profile).toEqual(profile);
    const added = store.state.events.slice(eventsBefore);
    expect(added.filter((event) => event.type === 'hint.add')).toHaveLength(1);
    expect(added.some((event) => ['strategy.set', 'strategy.auto', 'model.request'].includes(event.type))).toBe(false);
    expect(store.active.pendingHints).toHaveLength(1);
    expect(store.active.pendingHints[0].reference).toMatchObject({
      id: 'mcmurrey-inquiry-letter-body-en-v1',
      scoringAuthority: false
    });
    expect(store.active.messages.at(-1).content).toContain('公开示例，仅供参考。');
    expect(store.active.messages.at(-1).content).toContain('Dear Technical Support Department:');
    expect(store.active.messages.at(-1).content).toContain('W. Gary NNNNN');
    expect(store.active.messages.at(-1).content).toContain(
      'https://mcmassociates.io/textbook/examples/inquirex2c.html'
    );
    expect(store.active.messages.at(-1).content).toContain('https://creativecommons.org/licenses/by/4.0/');
    const read = clone(store.state);
    await store.send(requestText, { chatEntry: true, id: 'reference-read' });
    expect(store.state).toEqual(read);
    store.submit(original + '\nThank you.  ', true, 'reference-revision', { chatEntry: true });
    expect(store.state.attempts.map((attempt) => attempt.hints.length)).toEqual([0, 1]);
    expect(store.state.attempts.every((attempt) => attempt.grade.status === 'pending')).toBe(true);
    store.generateVariant();
    expect(store.active.pendingHints).toEqual([]);
    expect(store.state.reviews).toEqual([]);
    expect(request).not.toHaveBeenCalled();
  }
);

it('离线邮件聊天参考：否定、引用和停止不读参考，也不改教法或产生模型事件', async () => {
  const store = useConversationLearningStore();
  await store.send('英文邮件写作', { chatEntry: true });
  const strategy = clone(store.state.strategy);
  for (const text of ['不要提示', '材料里写“读参考信件”']) await store.send(text, { chatEntry: true });
  expect(store.active.pendingHints).toEqual([]);
  expect(store.state.strategy).toEqual(strategy);
  await store.send('停止');
  const stoppedStrategy = clone(store.state.strategy);
  await store.send('读参考信件', { chatEntry: true });
  expect(store.active.stopped).toBe(true);
  expect(store.active.pendingHints).toEqual([]);
  expect(store.state.strategy).toEqual(stoppedStrategy);
  expect(store.state.events.some((event) => event.type === 'model.request')).toBe(false);
});

it('离线邮件聊天参考：已有面板的三参读取合同保持，帮助与出处不丢', async () => {
  const store = useConversationLearningStore();
  store.start('英文邮件写作');
  const strategy = clone(store.state.strategy);
  store.readWritingReference(store.writingContext(), 'mcmurrey-inquiry-letter-body-en-v1', 1);
  expect(store.active.pendingHints).toHaveLength(1);
  expect(store.active.pendingHints[0].reference.id).toBe('mcmurrey-inquiry-letter-body-en-v1');
  expect(store.state.strategy).toEqual(strategy);
  expect(store.state.attempts).toEqual([]);
});

it('离线邮件聊天参考：数学和非离线分支不使用邮件参考', async () => {
  const store = useConversationLearningStore();
  await store.send('方程', { chatEntry: true });
  expect(store.canReadChatWritingReference).toBe(false);
  await store.send('提示', { chatEntry: true });
  expect(store.active.pendingHints.some((hint) => hint.reference)).toBe(false);
  expect(store.state.events.some((event) => event.type === 'strategy.set')).toBe(true);
  await store.send('练习英文邮件', { chatEntry: true });
  expect(store.canReadChatWritingReference).toBe(true);
  store.selectedMode = 'cloud';
  expect(store.canReadChatWritingReference).toBe(false);
});

it('邮件的英文澄清和原稿保存提示保持待核对含义', () => {
  setLanguage('en');
  expect(learningText('想先练哪种写作？比如英文邮件，也可以直接贴题。')).toContain('English email');
  expect(learningText('先写一版完整邮件，明确提交后保存原稿；反馈暂待核对。')).toContain('pending verification');
});

it('同一聊天保存目标、最少澄清、原答、订正、独立变式、一次诗词、停止重开和恢复，零网络', async () => {
  const store = useConversationLearningStore();
  const request = vi.spyOn(uni, 'request');
  const send = (text, id) => store.send(text, { chatEntry: true, id });
  const goal = '我想复习初二数学，先测测我的薄弱点';
  await send(goal, 'chat-goal');
  const conversationId = store.active.id;
  expect(store.active.goal).toBe(goal);
  expect(store.state.attempts).toHaveLength(0);
  expect(store.state.questions).toHaveLength(0);
  expect(store.state.events.some((event) => event.type === 'profile.set')).toBe(false);
  expect(store.active.messages.at(-1).content).toContain('想先练哪个知识点');
  await send('一次不等式', 'chat-topic');
  expect(store.active.id).toBe(conversationId);
  expect(store.activeQuestion.prompt).toContain('关于 t');
  expect(store.state.attempts).toHaveLength(0);
  const topicEvents = clone(store.state.events);
  await send('一次不等式', 'chat-topic');
  expect(store.state.events).toEqual(topicEvents);
  await send('t>3', 'chat-wrong');
  expect(store.state.attempts[0].grade.outcome).toBe('wrong');
  const poems = () => store.active.messages.filter((message) => message.content.startsWith('妙哉妙哉'));
  expect(poems()).toHaveLength(0);
  await send('直接讲解', 'chat-help');
  await send('t<3', 'chat-correction');
  expect(store.state.attempts[1]).toMatchObject({ kind: 'revision', grade: { outcome: 'correct' } });
  expect(store.state.attempts[1].hints).toHaveLength(1);
  expect(poems()).toHaveLength(0);
  await send('独立检验原题', 'chat-variant');
  await send('t<2', 'chat-independent');
  expect(store.state.attempts[2]).toMatchObject({ kind: 'variant', hints: [], grade: { outcome: 'correct' } });
  expect(poems()).toHaveLength(1);
  expect(poems()[0].content).toContain('欲窮千里目，更上一層樓。');
  expect(poems()[0].content).toContain('王之渙《登鸛雀樓》');
  expect(poems()[0].content).toContain('御定全唐詩');
  expect(store.summary.knowledge['数学 / 一次不等式与解集'].status).toBe('待复测');
  expect(store.state.reviews.length).toBeGreaterThan(0);
  const afterPoem = clone(store.state.events);
  await send('t<2', 'chat-independent');
  expect(store.state.events).toEqual(afterPoem);
  await send('独立检验原题', 'chat-variant-again');
  await send('t<1', 'chat-independent-again');
  expect(poems()).toHaveLength(1);
  expect(store.state.attempts).toHaveLength(4);
  await send('停止', 'chat-stop');
  const before = clone(store.state);
  setActivePinia(createPinia());
  const reopened = useConversationLearningStore();
  expect(reopened.active.stopped).toBe(true);
  expect(reopened.active.goal).toBe(goal);
  expect(reopened.state.attempts).toEqual(before.attempts);
  expect(reopened.state.events).toEqual(before.events);
  expect(reopened.state.reviews).toEqual(before.reviews);
  const restored = prepareLearningRestore(emptyLearningState('guest', before.timezone), store.exportData()).state;
  expect(restored.conversations).toEqual(before.conversations);
  expect(restored.attempts).toEqual(before.attempts);
  expect(restored.reviews).toEqual(before.reviews);
  expect(request).not.toHaveBeenCalled();
});

it('直接题目不当成原答，停止时不能暗中出题，旧入口继续沿旧流程', async () => {
  const store = useConversationLearningStore();
  await store.send('解关于 t 的不等式 t<3', { chatEntry: true, id: 'direct-question' });
  expect(store.state.attempts).toHaveLength(0);
  expect(store.active.messages.at(-1).content).toContain('先从这道题开始');
  store.selectedConversationId = null;
  await store.send('这道题我不会，带我一步步理解', { chatEntry: true, id: 'missing-question' });
  expect(store.activeQuestion).toBeFalsy();
  await store.send('停止', { chatEntry: true });
  await store.send('一次不等式', { chatEntry: true });
  await store.send('题目：x+1=2', { chatEntry: true });
  expect(store.active.stopped).toBe(true);
  expect(store.activeQuestion).toBeFalsy();
  expect(store.state.questions).toHaveLength(1);
  store.selectedConversationId = null;
  await store.send('我想复习初二数学', { id: 'old-entry' });
  expect(store.active.messages.at(-1).content).toBe('尚未连接模型，请先连接。');
});

it('诗词不可用或写入失败保留原答与判分，错误/部分/待核对/已帮助不触发独立赞语', async () => {
  const store = useConversationLearningStore();
  store.start('解关于 t 的不等式 t<3');
  await store.send('t<3', { id: 'original-correct' });
  store.generateVariant();
  await store.send('t<2', { chatEntry: true, poetry: false, id: 'quiet-variant' });
  const last = store.state.attempts.at(-1);
  expect(last.grade.outcome).toBe('correct');
  expect(poetryEncouragement(store.state, store.active.id, last.id, { available: false })).toBeNull();
  expect(poetryEncouragement(store.state, store.active.id, last.id)).not.toBeNull();
  for (const outcome of ['wrong', 'partial', null]) {
    const state = clone(store.state);
    state.attempts.at(-1).grade = { ...last.grade, status: outcome ? 'reliable' : 'pending', outcome };
    expect(poetryEncouragement(state, store.active.id, last.id)).toBeNull();
  }
  const helped = clone(store.state);
  helped.attempts.at(-1).hints = [{ id: 'synthetic-help' }];
  expect(poetryEncouragement(helped, store.active.id, last.id)).toBeNull();
  const commit = learningRepository.commit.bind(learningRepository);
  vi.spyOn(learningRepository, 'commit').mockImplementation((operation) => {
    if (operation.type === 'message.add' && operation.data.content.startsWith('妙哉妙哉'))
      throw new Error('synthetic optional write failure');
    return commit(operation);
  });
  store.generateVariant();
  const result = await store.send('t<1', { chatEntry: true, id: 'optional-failure' });
  expect(result.grade.outcome).toBe('correct');
  expect(store.state.attempts.at(-1).answer).toBe('t<1');
  expect(store.active.messages.some((message) => message.content.startsWith('妙哉妙哉'))).toBe(false);
});

it('英文界面翻译新反馈前缀，诗句、作者与原本出处保持原文', async () => {
  const store = useConversationLearningStore();
  await store.send('一次不等式', { chatEntry: true });
  await store.send('t<3', { chatEntry: true });
  await store.send('独立检验原题', { chatEntry: true });
  await store.send('t<2', { chatEntry: true, poetry: false });
  const poem = poetryEncouragement(store.state, store.active.id, store.state.attempts.at(-1).id);
  setLanguage('en');
  expect(learningText('想先练哪个知识点？比如方程或一次不等式，也可以直接贴题。')).toContain('Which topic');
  expect(learningText(poem.content)).toContain('You solved this variant independently.');
  expect(learningText(poem.content)).toContain('欲窮千里目，更上一層樓。');
  expect(learningText(poem.content)).toContain('王之渙《登鸛雀樓》');
});

it('聊天入口不绕过已有云端上下文授权', async () => {
  const store = useConversationLearningStore();
  const request = vi.spyOn(uni, 'request');
  store.selectedMode = 'cloud';
  store.sharingAllowed = false;
  await expect(store.send('我想复习初二数学', { chatEntry: true })).rejects.toThrow('数据流向');
  expect(request).not.toHaveBeenCalled();
});

it('页面明确提交沿同一诗词边界，展示选项不进入作答事实，英文示例可开始', async () => {
  const store = useConversationLearningStore();
  await store.send('I want to review middle-school math and find what needs practice', { chatEntry: true });
  expect(store.active.messages.at(-1).content).toContain('想先练哪个知识点');
  await store.send('Linear inequalities', { chatEntry: true });
  await store.send('Give me a hint', { chatEntry: true });
  expect(store.active.pendingHints).toHaveLength(1);
  store.submit('t<3', true, 'explicit-chat-original', { chatEntry: true });
  expect(store.active.messages.some((message) => message.content.startsWith('妙哉妙哉'))).toBe(false);
  store.generateVariant();
  store.submit('t<2', true, 'explicit-chat-variant', { chatEntry: true });
  expect(store.active.messages.filter((message) => message.content.startsWith('妙哉妙哉'))).toHaveLength(1);
  const event = store.state.events.find((item) => item.id === 'explicit-chat-variant');
  expect(event.data).not.toHaveProperty('chatEntry');
  expect(event.data).not.toHaveProperty('poetry');
});

it('知识点选择在计划写入失败后以同一编号重试，不误记原答或重复题目/任务', async () => {
  const store = useConversationLearningStore();
  await store.send('我想复习初二数学', { chatEntry: true, id: 'retry-goal' });
  const commit = learningRepository.commit.bind(learningRepository);
  let fail = true;
  vi.spyOn(learningRepository, 'commit').mockImplementation((operation) => {
    if (fail && operation.id === 'retry-topic:chat-plan') {
      fail = false;
      throw new Error('synthetic interrupted plan write');
    }
    return commit(operation);
  });
  await expect(store.send('一次不等式', { chatEntry: true, id: 'retry-topic' })).rejects.toThrow('interrupted');
  expect(store.state.questions).toHaveLength(1);
  expect(store.state.attempts).toHaveLength(0);
  await store.send('一次不等式', { chatEntry: true, id: 'retry-topic' });
  expect(store.state.questions).toHaveLength(1);
  expect(store.state.attempts).toHaveLength(0);
  expect(store.state.events.some((event) => event.id.startsWith('retry-topic:answer'))).toBe(false);
  const plan = store.state.plans.at(-1);
  expect(plan.tasks.filter((task) => task.questionKey === 'retry-topic_chat@1')).toHaveLength(1);
  const events = clone(store.state.events);
  await store.send('一次不等式', { chatEntry: true, id: 'retry-topic' });
  expect(store.state.events).toEqual(events);
});

it('按推荐用语请求小步引导后贴题，实际提示、原答、独立变式和重开事实接续', async () => {
  const store = useConversationLearningStore();
  const request = vi.spyOn(uni, 'request');
  const send = (text, id) => store.send(text, { chatEntry: true, id });
  const goal = '这道题我不会，带我一步步理解';
  await send(goal, 'paste-goal');
  const conversationId = store.active.id;
  expect(store.activeStrategy).toMatchObject({ method: 'hint', source: 'self_report' });
  expect(store.activeStrategy.difficulty).not.toBe('easier');
  expect(store.active.pendingHints).toHaveLength(0);
  expect(store.state.events.some((event) => ['teaching.deliver', 'profile.set'].includes(event.type))).toBe(false);
  expect(store.active.messages.at(-1).content).toContain('贴题');
  await send('题目：2x+3=9', 'paste-question');
  expect(store.active.id).toBe(conversationId);
  expect(store.active.goal).toBe(goal);
  expect(store.activeQuestion.prompt).toContain('2x+3=9');
  expect(store.activeQuestion.validation.authority).toBe('executable');
  expect(store.active.pendingHints).toHaveLength(1);
  expect(store.active.pendingHints[0]).toMatchObject({ level: 1 });
  expect(store.active.messages.at(-1)).toMatchObject({ role: 'tool', method: 'hint' });
  expect(store.active.pendingHints[0].content).not.toContain('x=3');
  expect(store.state.attempts).toHaveLength(0);
  await send('继续提示', 'paste-hint');
  expect(store.active.pendingHints.map((hint) => hint.level)).toEqual([1, 2]);
  expect(store.active.pendingHints[1].content).not.toContain('第二个根');
  expect(store.state.attempts).toHaveLength(0);
  await send('x=3', 'paste-answer');
  expect(store.state.attempts[0]).toMatchObject({ answer: 'x=3', grade: { outcome: 'correct' } });
  expect(store.state.attempts[0].hints).toHaveLength(2);
  expect(store.active.messages.some((message) => message.content.startsWith('妙哉妙哉'))).toBe(false);
  await send('独立检验原题', 'paste-variant');
  await send('x=2', 'paste-independent');
  expect(store.state.attempts[1]).toMatchObject({ kind: 'variant', hints: [], grade: { outcome: 'correct' } });
  expect(store.active.messages.filter((message) => message.content.startsWith('妙哉妙哉'))).toHaveLength(1);
  await send('停止', 'paste-stop');
  const before = clone(store.state);
  setActivePinia(createPinia());
  const reopened = useConversationLearningStore();
  expect(reopened.active).toMatchObject({ id: conversationId, goal, stopped: true });
  expect(reopened.state.events).toEqual(before.events);
  expect(reopened.state.attempts).toEqual(before.attempts);
  expect(reopened.state.reviews).toEqual(before.reviews);
  const restored = prepareLearningRestore(emptyLearningState('guest', before.timezone), store.exportData()).state;
  expect(restored.conversations).toEqual(before.conversations);
  expect(restored.attempts).toEqual(before.attempts);
  expect(request).not.toHaveBeenCalled();
});

it.each(['2x+3=9', '-2x+6>0', '题目：x=3', '原题是\\frac{x}{2}+1=3', '题目：解关于 t 的方程 2t+3=9'])(
  '完整贴题复用原校验器，原文保留且不生成原答：%s',
  async (raw) => {
    const store = useConversationLearningStore();
    await store.send(raw, { chatEntry: true, id: 'explicit-paste' });
    expect(store.active.goal).toBe(raw);
    expect(store.active.messages.find((message) => message.role === 'user').content).toBe(raw);
    expect(store.state.questions).toHaveLength(1);
    expect(store.activeQuestion.validation.authority).toBe('executable');
    expect(store.state.attempts).toHaveLength(0);
    expect(store.active.pendingHints).toHaveLength(0);
  }
);

it.each(['x=3', '3=x', 'x<3', '我的答案是：x=3', '2t+3=9', '2x+y=9', 'f(x)=3'])(
  '无原题或未知量不明时先澄清，不误建题或判分：%s',
  async (raw) => {
    const store = useConversationLearningStore();
    await store.send(raw, { chatEntry: true });
    expect(store.active.goal).toBe(raw);
    expect(store.active.messages.at(-1).content).toBe('请补充完整题目、未知量和已知条件；这条暂不记为作答。');
    expect(store.state.questions).toHaveLength(0);
    expect(store.state.attempts).toHaveLength(0);
    expect(store.active.pendingHints).toHaveLength(0);
  }
);

it.each([
  '题目：x^2>4',
  '题目：x+1=2，x是正整数',
  '题目：整数范围内2x+3=8',
  '题目：0<x<3',
  `题目：${'x+'.repeat(130)}1=3`
])('明确贴入但超出当前核验范围的原题保留为私人待核对题，条件不丢失：%s', async (raw) => {
  const store = useConversationLearningStore();
  await store.send(raw, { chatEntry: true });
  expect(store.active.goal).toBe(raw);
  expect(store.activeQuestion).toMatchObject({
    scope: 'private',
    prompt: raw.slice(3),
    source: { kind: 'user_input' },
    validation: null,
    publishable: false
  });
  expect(store.active.messages.at(-1).content).toContain('暂不能自动核验');
  expect(store.state.attempts).toHaveLength(0);
  expect(store.active.pendingHints).toHaveLength(0);
});

it('贴题提示写入失败后以同一编号续写，不把贴题误判为答案或重复帮助', async () => {
  const store = useConversationLearningStore();
  await store.send('带我一步步理解', { chatEntry: true, id: 'paste-retry-goal' });
  const commit = learningRepository.commit.bind(learningRepository);
  let fail = true;
  vi.spyOn(learningRepository, 'commit').mockImplementation((operation) => {
    if (fail && operation.id === 'paste-retry:local-teaching') {
      fail = false;
      throw new Error('synthetic interrupted hint write');
    }
    return commit(operation);
  });
  await expect(store.send('2x+3=9', { chatEntry: true, id: 'paste-retry' })).rejects.toThrow('hint write');
  expect(store.active.pendingHints).toHaveLength(0);
  expect(store.state.attempts).toHaveLength(0);
  await store.send('2x+3=9', { chatEntry: true, id: 'paste-retry' });
  expect(store.active.pendingHints).toHaveLength(1);
  expect(store.state.questions).toHaveLength(1);
  expect(store.state.attempts).toHaveLength(0);
  expect(store.currentPlan.tasks).toHaveLength(1);
  const events = clone(store.state.events);
  await store.send('2x+3=9', { chatEntry: true, id: 'paste-retry' });
  expect(store.state.events).toEqual(events);
});

it('同一聊天明确换题再返回前题，原答和未用提示分题保留，重开恢复一致', async () => {
  const store = useConversationLearningStore();
  const request = vi.spyOn(uni, 'request');
  const send = (text, id) => store.send(text, { chatEntry: true, id });
  const goal = '我想复习初二数学';
  await send(goal, 'switch-goal');
  await send('方程', 'switch-first');
  const conversationId = store.active.id;
  const firstKey = store.active.activeQuestionKey;
  await send('t=4', 'switch-wrong');
  const originalAnswer = clone(store.state.attempts[0]);
  await send('带我一步步理解', 'switch-first-help');
  const oldHints = clone(store.active.pendingHints);
  const oldEvents = clone(store.state.events);
  await send('题目：-2x+6>0', 'switch-second');
  const secondKey = store.active.activeQuestionKey;
  expect(secondKey).not.toBe(firstKey);
  expect(store.active).toMatchObject({ id: conversationId, goal });
  expect(store.state.questions).toHaveLength(2);
  expect(store.state.attempts).toHaveLength(1);
  expect(store.state.attempts[0]).toEqual(originalAnswer);
  expect(store.state.events.slice(0, oldEvents.length)).toEqual(oldEvents);
  expect(store.active.helpQueues.find((entry) => entry.questionKey === firstKey).hints).toEqual(oldHints);
  expect(store.active.pendingHints.map((hint) => hint.id)).toEqual(['switch-second:local-teaching']);
  await send('x<3', 'switch-second-answer');
  expect(store.state.attempts[1]).toMatchObject({ questionKey: secondKey, grade: { outcome: 'correct' } });
  expect(store.state.attempts[1].hints.map((hint) => hint.id)).toEqual(['switch-second:local-teaching']);
  store.focus(firstKey, conversationId);
  expect(store.active.pendingHints).toEqual(oldHints);
  await send('t=3', 'switch-first-correction');
  expect(store.state.attempts[2]).toMatchObject({
    questionKey: firstKey,
    kind: 'revision',
    grade: { outcome: 'correct' }
  });
  expect(store.state.attempts[2].hints).toEqual(oldHints);
  expect(store.currentPlan.tasks.map((task) => task.questionKey)).toEqual([firstKey, secondKey]);
  await send('停止', 'switch-stop');
  const before = clone(store.state);
  setActivePinia(createPinia());
  const reopened = useConversationLearningStore();
  expect(reopened.active).toMatchObject({ id: conversationId, goal, stopped: true, activeQuestionKey: firstKey });
  expect(reopened.state.questions).toEqual(before.questions);
  expect(reopened.state.attempts).toEqual(before.attempts);
  expect(reopened.state.events).toEqual(before.events);
  expect(reopened.state.reviews).toEqual(before.reviews);
  const restored = prepareLearningRestore(emptyLearningState('guest', before.timezone), store.exportData()).state;
  expect(restored.questions).toEqual(before.questions);
  expect(restored.attempts).toEqual(before.attempts);
  expect(request).not.toHaveBeenCalled();
});

it('不支持的新题拥有自己的待核对答案，条件与旧判分保留，再选择可核验题继续', async () => {
  const store = useConversationLearningStore();
  const send = (text, id) => store.send(text, { chatEntry: true, id });
  await send('解关于 t 的方程 2t+3=9', 'pending-switch-first');
  await send('t=3', 'pending-switch-first-answer');
  const first = clone(store.state.attempts[0]);
  const raw = '题目：x+1=2，x是正整数';
  await send(raw, 'pending-switch-second');
  const pendingKey = store.active.activeQuestionKey;
  expect(store.activeQuestion).toMatchObject({
    prompt: raw.slice(3),
    scope: 'private',
    validation: null,
    publishable: false
  });
  expect(store.state.attempts).toHaveLength(1);
  const clarification = await send('x=1', 'pending-switch-second-draft');
  expect(clarification.clarification).toBe(true);
  expect(store.state.attempts).toHaveLength(1);
  expect(store.active.messages.at(-1).content).toContain('这句话是你的正式作答吗');
  await send('我的答案是：x=1', 'pending-switch-second-answer');
  expect(store.state.attempts[1]).toMatchObject({
    questionKey: pendingKey,
    answer: '我的答案是：x=1',
    grade: { status: 'pending' }
  });
  expect(store.state.attempts[1].grade.outcome).toBeNull();
  expect(store.state.attempts[0]).toEqual(first);
  expect(store.active.messages.some((message) => message.content.startsWith('妙哉妙哉'))).toBe(false);
  await send('练习一次不等式', 'pending-switch-third');
  expect(store.active.activeQuestionKey).not.toBe(pendingKey);
  expect(store.activeQuestion.validation.authority).toBe('executable');
  await send('t<3', 'pending-switch-third-answer');
  expect(store.state.attempts[2].grade.outcome).toBe('correct');
  expect(store.state.questions.find((question) => `${question.id}@${question.version}` === pendingKey).prompt).toBe(
    raw.slice(3)
  );
  expect(store.state.attempts[1].grade.status).toBe('pending');
  const restored = prepareLearningRestore(emptyLearningState('guest', store.state.timezone), store.exportData()).state;
  expect(restored.questions.find((question) => `${question.id}@${question.version}` === pendingKey)).toMatchObject({
    prompt: raw.slice(3),
    validation: null,
    source: { kind: 'user_input' },
    publishable: false
  });
  expect(restored.attempts[1].grade.status).toBe('pending');
});

it('换题焦点写入中断后同编号续接，旧提示不丢、不误记原答或重复新题', async () => {
  const store = useConversationLearningStore();
  const send = (text, id) => store.send(text, { chatEntry: true, id });
  await send('方程', 'focus-retry-first');
  await send('带我一步步理解', 'focus-retry-help');
  const oldKey = store.active.activeQuestionKey;
  const oldHints = clone(store.active.pendingHints);
  const commit = learningRepository.commit.bind(learningRepository);
  let fail = true;
  vi.spyOn(learningRepository, 'commit').mockImplementation((operation) => {
    if (fail && operation.id === 'focus-retry-second:chat-focus') {
      fail = false;
      throw new Error('synthetic interrupted question focus');
    }
    return commit(operation);
  });
  await expect(send('题目：2x+3=9', 'focus-retry-second')).rejects.toThrow('question focus');
  expect(store.active.activeQuestionKey).toBe(oldKey);
  expect(store.active.pendingHints).toEqual(oldHints);
  await send('题目：2x+3=9', 'focus-retry-second');
  expect(store.active.activeQuestionKey).not.toBe(oldKey);
  expect(store.state.questions).toHaveLength(2);
  expect(store.state.attempts).toHaveLength(0);
  expect(store.currentPlan.tasks).toHaveLength(2);
  expect(store.active.helpQueues.find((entry) => entry.questionKey === oldKey).hints).toEqual(oldHints);
  expect(store.active.pendingHints).toHaveLength(1);
  const events = clone(store.state.events);
  await send('题目：2x+3=9', 'focus-retry-second');
  expect(store.state.events).toEqual(events);
});

it.each(['我的答案是：题目：x+1=2', '材料写着“题目：x+1=2”。', '不要练习一次不等式', '2x=6'])(
  '普通答案、引用或否定不取得换题权限：%s',
  async (raw) => {
    const store = useConversationLearningStore();
    await store.send('方程', { chatEntry: true });
    const key = store.active.activeQuestionKey;
    await store.send(raw, { chatEntry: true });
    expect(store.active.activeQuestionKey).toBe(key);
    expect(store.state.questions).toHaveLength(1);
  }
);
