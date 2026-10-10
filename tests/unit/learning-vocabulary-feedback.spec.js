import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useConversationLearningStore } from '@/stores/modules/conversation-learning.js';
import { learningRepository } from '@/services/learning/learning-repository.js';
import { executeLearningTool } from '@/services/learning/learning-tools.js';
import {
  applyLearningOperation,
  emptyLearningState,
  normalizePrivateSyncOperation,
  questionKey
} from '@/services/learning/learning-domain.js';
import {
  vocabularyUseFeedbackBasis,
  vocabularyEvidence,
  gradeVocabularyReviewAnswer
} from '../../laf-backend/functions/_shared/learning-vocabulary.js';
const api = vi.hoisted(() => ({ generate: vi.fn(), result: vi.fn() }));
vi.mock('@/services/api/domains/learning.api.js', async (original) => ({
  ...(await original()),
  generateLearningTurn: api.generate,
  fetchLearningResult: api.result
}));
const clone = (value) => JSON.parse(JSON.stringify(value));
const answer = 'We recycle  glass into new jars.\nOur class collects it.';
beforeEach(() => {
  uni.clearStorageSync();
  setActivePinia(createPinia());
  api.generate.mockReset();
  api.result.mockReset();
});
afterEach(() => {
  vi.restoreAllMocks();
});
function setup(submit = true, word = 'recycle') {
  const store = useConversationLearningStore();
  store.start('英文说明写作');
  const q = store.openVocabulary(store.writingContext(), word);
  store.commit(
    'vocabulary.submit',
    {
      conversationId: store.selectedConversationId,
      questionKey: questionKey(q),
      answer: q.validation.answer,
      explicit: true
    },
    'sense-answer'
  );
  store.startVocabularyTask(store.writingContext(), questionKey(q), 'usage');
  if (submit) store.submit(answer, true, 'use-answer');
  return store;
}
function cloud(store) {
  store.models = [{ id: 'use-fixture', model: 'synthetic-not-a-real-model', source: 'byok', capabilities: {} }];
  store.modelId = 'use-fixture';
  store.selectedMode = 'cloud';
  store.sharingAllowed = true;
}
function response(body, score = null) {
  return {
    success: true,
    data: {
      requestId: body.requestId,
      requestBinding: body.requestBinding,
      modelId: body.modelId,
      model: 'synthetic-not-a-real-model',
      message: '检查原句中的动作和材料。',
      tools: [
        {
          name: 'assess',
          arguments: {
            attemptId: body.learningContext.attempt.id,
            rubricId: body.learningContext.question.rubric.id,
            outcome: score === null ? 'uncertain' : 'correct',
            feedback: '合成反馈不证明语义。',
            dimensions: body.learningContext.question.rubric.criteria.map((c) => ({
              criterionId: c.id,
              score,
              feedback: '引用绑定原句，本夹具不作真实语义判断。',
              evidence: [{ quote: 'recycle  glass', start: 3, end: 17 }]
            }))
          }
        }
      ]
    }
  };
}
function assessment(store, score = null) {
  const basis = vocabularyUseFeedbackBasis(store.activeQuestion, store.state);
  return {
    conversationId: store.active.id,
    attemptId: 'use-answer',
    rubricId: basis.rubric.id,
    rubricContract: 'subjective-rubric-v2',
    outcome: score === null ? 'uncertain' : 'correct',
    feedback: '合成反馈',
    dimensions: basis.rubric.criteria.map((c) => ({
      criterionId: c.id,
      score,
      feedback: '原答引用',
      evidence: ['recycle  glass']
    }))
  };
}
describe('自由原句的词义绑定与位置反馈', () => {
  it('派生维度不修改旧题或判分；包含词、错用和无目标词均保持pending', () => {
    const store = setup(),
      before = clone(store.state),
      basis = vocabularyUseFeedbackBasis(store.activeQuestion, store.state);
    expect(basis).toMatchObject({
      contract: 'vocabulary-use-feedback-v1',
      senseId: 'recycle-material',
      senseVersion: 1,
      word: 'recycle',
      meaning: '回收并加工再利用',
      originAttemptId: 'sense-answer'
    });
    expect(store.state).toEqual(before);
    expect(store.activeQuestion.rubric).toBeUndefined();
    for (const raw of [answer, 'I recycle my homework to the teacher.', 'An unrelated sentence.'])
      expect(gradeVocabularyReviewAnswer(store.activeQuestion, raw, store.state)).toMatchObject({
        status: 'pending',
        outcome: null
      });
  });
  for (const attack of ['sense', 'version', 'prompt', 'source', 'parent', 'origin-attempt', 'explicit', 'permission'])
    it(`派生反馈拒绝${attack}伪造`, () => {
      const store = setup(),
        state = clone(store.state),
        q = clone(store.activeQuestion);
      if (attack === 'sense') q.vocabularyReview.senseId = 'save-file';
      if (attack === 'version') q.vocabularyReview.senseVersion = 2;
      if (attack === 'prompt') q.prompt += '官方满分';
      if (attack === 'source') q.source.kind = 'official';
      if (attack === 'parent') q.parentQuestionKey = 'other@1';
      if (attack === 'origin-attempt') q.vocabularyReview.originAttemptId = 'other';
      if (attack === 'explicit') state.events.find((e) => e.id === 'sense-answer').data.explicit = false;
      if (attack === 'permission') q.validation = { authority: 'executable', answer: answer };
      expect(() => vocabularyUseFeedbackBasis(q, state)).toThrow();
    });
  it('已有原答只发送一次请求；严格引用和教法保持，满分也不升级掌握/复习', async () => {
    const store = setup(),
      beforeQuestions = clone(store.state.questions),
      beforePlans = clone(store.state.plans),
      evidence = vocabularyEvidence(store.state, 'recycle-material');
    cloud(store);
    store.commit('strategy.set', {
      conversationId: store.active.id,
      method: 'explain',
      source: 'self_report',
      reason: '用户选择'
    });
    api.generate.mockImplementation((body) => response(body, 2));
    await store.requestVocabularyFeedback();
    expect(store.error).toBe('');
    expect(api.generate).toHaveBeenCalledTimes(1);
    const context = api.generate.mock.calls[0][0].learningContext;
    expect(context.question.vocabularyUse).toMatchObject({
      word: 'recycle',
      meaning: '回收并加工再利用',
      originPrompt: store.state.questions.find((q) => q.vocabularyExercise)?.prompt
    });
    expect(store.state.questions).toEqual(beforeQuestions);
    expect(store.state.plans).toEqual(beforePlans);
    expect(store.state.attempts).toHaveLength(2);
    const attempt = store.state.attempts.at(-1),
      feedback = attempt.assistance[0];
    expect(attempt.answer).toBe(answer);
    expect(attempt.grade.status).toBe('pending');
    expect(feedback).toMatchObject({
      contract: 'subjective-rubric-v2',
      status: 'ai_assisted',
      score: 6,
      reviewRequired: true,
      vocabularyUse: {
        contract: 'vocabulary-use-feedback-v1',
        senseId: 'recycle-material',
        originAttemptId: 'sense-answer'
      }
    });
    expect(feedback.dimensions[0].evidenceLocations[0]).toMatchObject({ quote: 'recycle  glass', start: 3, end: 17 });
    expect(store.activeStrategy.method).toBe('explain');
    expect(store.state.reviews).toEqual([]);
    expect(vocabularyEvidence(store.state, 'recycle-material')).toEqual(evidence);
    expect(store.summary.first.denominator).toBe(0);
  });
  it('未提交、未连接、未授权和已校对原句均零模型请求', async () => {
    const store = setup(false);
    await expect(store.requestVocabularyFeedback()).rejects.toThrow('提交');
    store.submit(answer, true, 'use-answer');
    await expect(store.requestVocabularyFeedback()).rejects.toThrow('连接');
    cloud(store);
    store.sharingAllowed = false;
    await expect(store.requestVocabularyFeedback()).rejects.toThrow('流向');
    store.sharingAllowed = true;
    store.commit('assessment.correct', { attemptId: 'use-answer', reason: '原句需修订', outcome: null });
    await expect(store.requestVocabularyFeedback()).rejects.toThrow('新的原句');
    expect(api.generate).not.toHaveBeenCalled();
  });
  for (const attack of [
    'other-attempt',
    'other-rubric',
    'no-rubric',
    'fake-quote',
    'duplicate-range',
    'extra-tool',
    'new-question'
  ])
    it(`模型${attack}整次拒绝，没有部分计划或反馈`, async () => {
      const store = setup();
      cloud(store);
      const plan = clone(store.state.plans);
      api.generate.mockImplementation((body) => {
        const value = response(body),
          args = value.data.tools[0].arguments;
        if (attack === 'other-attempt') args.attemptId = 'sense-answer';
        if (attack === 'other-rubric') args.rubricId = 'other';
        if (attack === 'no-rubric') {
          delete args.rubricId;
          args.dimensions = [{ name: '原句', feedback: '缺引用' }];
        }
        if (attack === 'fake-quote') args.dimensions[0].evidence[0].quote = 'fake quote';
        if (attack === 'duplicate-range') args.dimensions[0].evidence.push(clone(args.dimensions[0].evidence[0]));
        if (attack === 'extra-tool')
          value.data.tools.unshift({ name: 'plan', arguments: { tasks: [], reason: 'attack' } });
        if (attack === 'new-question') value.data.question = { prompt: '另一个任务', options: [] };
        return value;
      });
      await store.requestVocabularyFeedback();
      expect(store.error).toBeTruthy();
      expect(store.state.attempts.at(-1).assistance).toBeUndefined();
      expect(store.state.plans).toEqual(plan);
    });
  for (const change of ['stop', 'answer', 'correct', 'question', 'account', 'cancel'])
    it(`${change}后不接纳迟到原句反馈`, async () => {
      const store = setup();
      cloud(store);
      let resolve, body;
      api.generate.mockImplementation((value) => {
        body = value;
        return new Promise((r) => {
          resolve = r;
        });
      });
      const pending = store.requestVocabularyFeedback();
      await Promise.resolve();
      expect(store.busy).toBe(true);
      if (change === 'stop') await store.send('停止当前任务');
      if (change === 'answer') store.submit('A different sentence.', true, 'new-answer');
      if (change === 'correct')
        store.commit('assessment.correct', { attemptId: 'use-answer', reason: '校对', outcome: null });
      if (change === 'question') store.start('其他学习');
      if (change === 'account') {
        uni.setStorageSync('EXAM_USER_ID', 'other');
        store.refresh();
      }
      if (change === 'cancel') store.cancel();
      resolve(response(body));
      await pending;
      expect(store.state.attempts.find((a) => a.id === 'use-answer')?.assistance).toBeUndefined();
    });
  it('原请求恢复只读取结果并幂等；不重新生成', async () => {
    const store = setup();
    cloud(store);
    let body;
    api.generate.mockImplementation((value) => {
      body = value;
      return { success: false, message: '合成断线' };
    });
    await store.requestVocabularyFeedback();
    expect(store.recoverableRequest.feedbackAttemptId).toBe('use-answer');
    api.result.mockResolvedValue(response(body));
    await store.recoverModelResult();
    expect(api.generate).toHaveBeenCalledTimes(1);
    expect(store.state.attempts.at(-1).assistance).toHaveLength(1);
    expect(store.recoverableRequest).toBeNull();
  });
  it('重复引用须明确位置；停止/旧原答不可直接写入新反馈，历史重放不改变原句', () => {
    const store = setup();
    const input = assessment(store);
    store.commit('assessment.assist', input, 'feedback');
    const saved = store.exportData();
    expect(
      applyLearningOperation(
        store.state,
        store.state.events.find((e) => e.id === 'feedback')
      ).reused
    ).toBe(true);
    let replay = emptyLearningState(store.state.owner, store.state.timezone);
    for (const event of JSON.parse(saved).events)
      replay = applyLearningOperation(replay, normalizePrivateSyncOperation(event)).state;
    expect(replay.attempts).toEqual(store.state.attempts);
    store.submit('We recycle glass. We recycle glass.', true, 'repeated');
    expect(() => store.commit('assessment.assist', input)).toThrow('变化');
    const repeated = {
      ...input,
      attemptId: 'repeated',
      dimensions: input.dimensions.map((d) => ({ ...d, evidence: ['recycle glass'] }))
    };
    expect(() => store.commit('assessment.assist', repeated)).toThrow('重复文字');
    repeated.dimensions = repeated.dimensions.map((d) => ({
      ...d,
      evidence: [{ quote: 'recycle glass', start: 3, end: 16 }]
    }));
    store.commit('assessment.assist', repeated);
    store.commit('task.stop', { conversationId: store.active.id });
    expect(() => store.commit('assessment.assist', repeated)).toThrow('停止');
  });
  it('旧无量表文字反馈保持旧合同，没有给历史题加量表', () => {
    const store = setup();
    store.commit(
      'assessment.assist',
      {
        conversationId: store.active.id,
        attemptId: 'use-answer',
        outcome: 'uncertain',
        dimensions: [{ name: '原句', feedback: '旧文字反馈' }],
        feedback: '历史记录'
      },
      'legacy'
    );
    expect(store.state.attempts.at(-1).assistance[0].contract).toBe('unscored-feedback-v1');
    expect(store.activeQuestion.rubric).toBeUndefined();
    const out = executeLearningTool(
      learningRepository,
      {
        id: 'legacy-model',
        name: 'assess',
        arguments: {
          attemptId: 'use-answer',
          outcome: 'uncertain',
          dimensions: [{ name: '原句', feedback: '旧模型文字反馈' }],
          feedback: '旧协议'
        }
      },
      {
        conversationId: store.active.id,
        permissions: ['read', 'learn'],
        calls: 0,
        maxCalls: 1,
        deadline: Date.now() + 5000,
        origin: 'model'
      }
    );
    expect(out.success).toBe(true);
    store.refresh();
    expect(store.state.attempts.at(-1).assistance.at(-1).id).toBe('legacy-model');
    expect(store.state.attempts.at(-1).assistance.at(-1).contract).toBe('unscored-feedback-v1');
  });
  it('反馈保存失败不展示成功，也不补写或重发模型', async () => {
    const store = setup();
    cloud(store);
    const commit = learningRepository.commit.bind(learningRepository);
    vi.spyOn(learningRepository, 'commit').mockImplementation((op) => {
      if (op.type === 'assessment.assist') throw new Error('合成保存失败');
      return commit(op);
    });
    api.generate.mockImplementation((body) => response(body));
    await store.requestVocabularyFeedback();
    expect(store.error).toContain('保存失败');
    expect(store.state.attempts.at(-1).assistance).toBeUndefined();
    expect(api.generate).toHaveBeenCalledTimes(1);
  });
});
