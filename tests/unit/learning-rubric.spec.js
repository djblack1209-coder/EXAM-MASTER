import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { mount, flushPromises } from '@vue/test-utils';
import fixture from '../fixtures/learning/rubric-v1.json';
import {
  normalizeRubric,
  applyLearningOperation,
  emptyLearningState,
  summarizeLearning,
  questionKey
} from '@/services/learning/learning-domain.js';
import { assessWithRubric } from '../../laf-backend/functions/_shared/learning-rubric.js';
import { learningRepository } from '@/services/learning/learning-repository.js';
import { prepareLearningRestore } from '@/services/learning/learning-backup.js';
import { correctMaterialQuestion } from '@/services/learning/material-intake.js';
import { executeLearningTool } from '@/services/learning/learning-tools.js';
import { useConversationLearningStore } from '@/stores/modules/conversation-learning.js';
import LearningPage from '@/pages/learning/index.vue';
import LearningOverview from '@/components/business/learning/learning-overview.vue';
import { generateLearningTurn } from '@/services/api/domains/learning.api.js';
vi.mock('@dcloudio/uni-app', () => ({ onShow: vi.fn(), onHide: vi.fn(), onLoad: vi.fn() }));
vi.mock('@/services/api/domains/learning.api.js', async (original) => ({
  ...(await original()),
  generateLearningTurn: vi.fn()
}));
const clone = (v) => JSON.parse(JSON.stringify(v));
const valid = fixture.cases[0];
const commit = (id, type, data) => learningRepository.commit({ id, type, data });
const stub = { view: { template: '<div><slot /></div>' }, text: { template: '<span><slot /></span>' }, BaseIcon: true };
function stateWithAnswer(item = valid) {
  let state = emptyLearningState('guest');
  for (const operation of [
    { id: 'session', type: 'conversation.start', data: { goal: '解释蒸发与凝结' } },
    {
      id: 'question',
      type: 'question.add',
      data: { question: { ...clone(fixture.question), uncertainties: item.uncertainties || [] } }
    },
    { id: 'focus', type: 'question.focus', data: { conversationId: 'session', questionKey: 'water-cycle@1' } },
    { id: 'answer', type: 'attempt.submit', data: { conversationId: 'session', answer: item.answer, explicit: true } }
  ])
    state = applyLearningOperation(state, operation).state;
  return state;
}
function assessmentOperation(item = valid, id = 'assessment') {
  return {
    id,
    type: 'assessment.assist',
    data: { ...clone(item.assessment), conversationId: 'session', attemptId: 'answer', model: 'test-only-model' }
  };
}
function subjectiveStore() {
  const store = useConversationLearningStore();
  store.start('理解蒸发与凝结');
  const material = store.importText('题干：简述蒸发与凝结的区别。');
  store.structureQuestion(material.id, {
    segmentId: material.segments[0].id,
    type: 'subjective',
    prompt: fixture.question.prompt
  });
  return store;
}
beforeEach(() => {
  uni.clearStorageSync();
  setActivePinia(createPinia());
  vi.clearAllMocks();
});
afterEach(() => vi.restoreAllMocks());

describe('主观评分的版本、引用与事实边界', () => {
  for (const item of fixture.cases)
    it(item.id, () => {
      const state = stateWithAnswer(item);
      if (item.expectedError) {
        expect(() => applyLearningOperation(state, assessmentOperation(item))).toThrow(
          expect.objectContaining({ code: item.expectedError })
        );
        expect(state.attempts[0].assistance).toBeUndefined();
      } else {
        const graded = applyLearningOperation(state, assessmentOperation(item)).state;
        expect(graded.attempts[0].assistance[0]).toMatchObject({
          contract: fixture.version,
          score: item.expectedScore,
          maxScore: 4,
          status: 'ai_assisted',
          questionKey: 'water-cycle@1',
          reviewRequired: true
        });
        expect(graded.attempts[0].grade.status).toBe('pending');
        expect(summarizeLearning(graded)).toMatchObject({
          first: { numerator: 0, denominator: 0 },
          mistakes: [],
          pending: 1
        });
        expect(graded.reviews).toEqual([]);
      }
    });
  it('超限、伪权威、重复维度和异常数值不能进入题目', () => {
    const invalid = [
      { ...clone(fixture.question.rubric), authority: 'human_reviewed' },
      { ...clone(fixture.question.rubric), version: 2 },
      { ...clone(fixture.question.rubric), source: { kind: 'verified', reference: '伪出处' } },
      {
        ...clone(fixture.question.rubric),
        criteria: [clone(fixture.question.rubric.criteria[0]), clone(fixture.question.rubric.criteria[0])]
      },
      { ...clone(fixture.question.rubric), criteria: [{ ...fixture.question.rubric.criteria[0], maxScore: NaN }] },
      { ...clone(fixture.question.rubric), criteria: [{ ...fixture.question.rubric.criteria[0], maxScore: 0.1 }] },
      {
        ...clone(fixture.question.rubric),
        criteria: Array.from({ length: 4 }, (_, i) => ({
          ...fixture.question.rubric.criteria[0],
          id: String(i),
          maxScore: 10
        }))
      }
    ];
    for (const rubric of invalid) expect(() => normalizeRubric(rubric)).toThrow();
    expect(() =>
      applyLearningOperation(emptyLearningState('guest'), {
        id: 'bad',
        type: 'question.add',
        data: { question: { ...fixture.question, answerType: 'choice' } }
      })
    ).toThrow('主观评分');
  });
  it('错误版本、缺漏、重复、自创维度、缺证据、超分和矛盾总分均拒绝，不写成功事实', () => {
    const state = stateWithAnswer();
    const original = clone(valid.assessment);
    const invalid = [
      { ...original, rubricId: 'another-rubric' },
      { ...original, dimensions: original.dimensions.slice(0, 1) },
      { ...original, dimensions: [original.dimensions[0], original.dimensions[0]] },
      { ...original, dimensions: [{ ...original.dimensions[0], criterionId: 'invented' }, original.dimensions[1]] },
      { ...original, dimensions: [{ ...original.dimensions[0], score: 1.25 }, original.dimensions[1]] },
      { ...original, dimensions: [{ ...original.dimensions[0], evidence: [] }, original.dimensions[1]] },
      { ...original, outcome: 'wrong' },
      { ...original, dimensions: [{ ...original.dimensions[0], execute: 'delete' }, original.dimensions[1]] }
    ];
    for (const input of invalid)
      expect(() =>
        applyLearningOperation(state, {
          ...assessmentOperation(),
          data: { ...input, conversationId: 'session', attemptId: 'answer' }
        })
      ).toThrow();
    expect(state.attempts[0].assistance).toBeUndefined();
  });
  it('真实引用不能绕过未校对关键条件；部分缺分不偷偷按零分结算', () => {
    const q = { ...fixture.question, uncertainties: [{ field: '箭头', resolved: false }] };
    expect(() => assessWithRubric(q, { answer: valid.answer }, valid.assessment)).toThrow('关键题目条件');
    const uncertain = clone(valid.assessment);
    uncertain.dimensions[0].score = null;
    uncertain.dimensions[0].evidence = [];
    uncertain.outcome = 'uncertain';
    expect(assessWithRubric(fixture.question, { answer: valid.answer }, uncertain).score).toBeNull();
  });
  it('评估绑定当前明确作答，同一事件重试不增加次数；两次一致模型意见仍不升级', () => {
    const first = applyLearningOperation(stateWithAnswer(), assessmentOperation());
    expect(applyLearningOperation(first.state, assessmentOperation()).reused).toBe(true);
    const second = applyLearningOperation(first.state, assessmentOperation(valid, 'second-model')).state;
    expect(second.attempts).toHaveLength(1);
    expect(second.attempts[0].assistance).toHaveLength(2);
    expect(second.attempts[0].grade.status).toBe('pending');
    expect(() =>
      applyLearningOperation(second, {
        ...assessmentOperation(valid, 'foreign'),
        data: { ...assessmentOperation().data, conversationId: 'foreign' }
      })
    ).toThrow();
  });
  it('没有维度时只能未量化反馈，不接受自创分数或成功权限字段', () => {
    const state = stateWithAnswer();
    delete state.questions[0].rubric;
    const data = {
      conversationId: 'session',
      attemptId: 'answer',
      outcome: 'partial',
      feedback: '需要继续说明',
      dimensions: [{ name: '表达', feedback: '暂时反馈' }]
    };
    expect(applyLearningOperation(state, { id: 'text-only', type: 'assessment.assist', data }).result.status).toBe(
      'ai_assisted'
    );
    expect(() =>
      applyLearningOperation(state, {
        id: 'score',
        type: 'assessment.assist',
        data: { ...data, dimensions: [{ ...data.dimensions[0], score: 2 }] }
      })
    ).toThrow('只能给文字反馈');
  });
  it('备份重放不信任伪造派生分值、模型一致或可靠标签；原答和维度保持可追溯', () => {
    const state = applyLearningOperation(stateWithAnswer(), assessmentOperation()).state;
    state.attempts[0].grade.status = 'reliable';
    state.attempts[0].assistance[0].score = 999;
    const restored = prepareLearningRestore(emptyLearningState('guest'), JSON.stringify(state)).state;
    expect(restored.attempts[0].grade.status).toBe('pending');
    expect(restored.attempts[0].assistance[0].score).toBe(4);
    expect(restored.questions[0].rubric).toEqual(fixture.question.rubric);
  });
  it('反复修订维度保留历史评估和帮助，不增加首次；题干校对解除仅评分修订关系', () => {
    const store = subjectiveStore();
    store.setRubric(fixture.question.rubric.criteria);
    const oldKey = questionKey(store.activeQuestion);
    commit('hint', 'hint.add', {
      conversationId: store.selectedConversationId,
      content: '思考液态和气态方向',
      level: 1
    });
    store.refresh();
    const old = store.submit(valid.answer, true, 'old-answer');
    commit('old-grade', 'assessment.assist', {
      ...valid.assessment,
      rubricId: store.activeQuestion.rubric.id,
      conversationId: store.selectedConversationId,
      attemptId: old.id
    });
    store.refresh();
    const previousAssessment = clone(store.state.attempts[0].assistance[0]);
    store.setRubric(fixture.question.rubric.criteria);
    store.setRubric(fixture.question.rubric.criteria);
    expect(store.state.attempts[0].assistance[0]).toEqual(previousAssessment);
    expect(store.active.pendingHints[0].questionKey).toBe(oldKey);
    const redo = store.submit(valid.answer, true, 'new-answer');
    expect(redo.kind).toBe('redo');
    expect(redo.hints).toHaveLength(1);
    expect(store.summary.first.denominator).toBe(0);
    expect(store.state.attempts.filter((a) => a.kind === 'first')).toHaveLength(1);
    expect(store.state.plans.at(-1).tasks).toHaveLength(4);
    expect(() => store.submit(valid.answer, true, 'forced-first', { kind: 'first' })).toThrow('已有首次');
    const corrected = correctMaterialQuestion(store.activeQuestion, { prompt: '结合示例说明二者方向' }, '修正题干');
    expect(corrected.rubricRevisionOf).toBeUndefined();
  });
  it('云模型收到完整绑定原答与维度，工具结构校验通过才产生辅助评估', async () => {
    const store = subjectiveStore();
    store.setRubric(fixture.question.rubric.criteria);
    const answer = `${'这是学习者的完整论述。'.repeat(240)}${valid.answer}`;
    const attempt = store.submit(answer, true, 'long-answer');
    store.selectedMode = 'cloud';
    store.modelId = 'test-profile';
    store.sharingAllowed = true;
    vi.mocked(generateLearningTurn).mockResolvedValueOnce({
      success: true,
      data: {
        model: 'actual-test-model',
        message: '按维度给出辅助意见，请继续核对。',
        tools: [
          {
            name: 'assess',
            arguments: { ...clone(valid.assessment), rubricId: store.activeQuestion.rubric.id, attemptId: attempt.id }
          }
        ]
      }
    });
    await store.send('请评价刚才的作答？', { id: 'rubric-turn' });
    const payload = vi.mocked(generateLearningTurn).mock.calls[0][0];
    expect(payload.learningContext.attempt.answer).toBe(answer);
    expect(payload.learningContext.question.rubric.id).toBe(store.activeQuestion.rubric.id);
    expect(store.state.attempts).toHaveLength(1);
    expect(store.state.attempts[0].assistance[0].score).toBe(4);
    expect(store.summary.pending).toBe(1);
    expect(store.state.reviews).toHaveLength(0);
  });
  it('实际页面可取消或保存维度，辅助总分与原答引用在对话和统计共享显示', async () => {
    const store = subjectiveStore();
    const wrapper = mount(LearningPage, {
      global: {
        stubs: { ...stub, LearningShell: { template: '<div><slot /></div>' }, LearningOverview: true, NumberLine: true }
      }
    });
    const button = (label) => wrapper.findAll('button').find((b) => b.text().trim() === label);
    const revision = store.state.revision;
    await button('评分维度').trigger('tap');
    await wrapper.find('[aria-label="维度1名称"]').setValue('蒸发方向');
    await button('取消编辑').trigger('tap');
    expect(store.state.revision).toBe(revision);
    await button('评分维度').trigger('tap');
    await wrapper.find('[aria-label="维度1名称"]').setValue('蒸发方向');
    await wrapper.find('[aria-label="维度1要求"]').setValue('说明液态变为气态，等价表述可接受');
    await wrapper.find('[aria-label="维度1满分"]').setValue('2');
    await button('增加维度').trigger('tap');
    await wrapper.find('[aria-label="维度2名称"]').setValue('凝结方向');
    await wrapper.find('[aria-label="维度2要求"]').setValue('说明气态变为液态，等价表述可接受');
    await wrapper.find('[aria-label="维度2满分"]').setValue('2');
    await button('保存评分维度版本').trigger('tap');
    await flushPromises();
    expect(store.activeQuestion.version).toBe(2);
    const attempt = store.submit(valid.answer, true, 'ui-answer');
    const args = clone(valid.assessment);
    args.rubricId = store.activeQuestion.rubric.id;
    args.dimensions.forEach((d, i) => (d.criterionId = store.activeQuestion.rubric.criteria[i].id));
    const outcome = executeLearningTool(
      learningRepository,
      { id: 'ui-assessment', name: 'assess', arguments: { ...args, attemptId: attempt.id } },
      {
        conversationId: store.selectedConversationId,
        permissions: ['read', 'learn'],
        origin: 'model',
        model: 'test-only-model',
        calls: 0,
        maxCalls: 1,
        deadline: Date.now() + 5000
      }
    );
    expect(outcome.success).toBe(true);
    store.refresh();
    await flushPromises();
    expect(wrapper.find('[aria-label="当前作答的辅助评分"]').text()).toContain('4 / 4');
    expect(wrapper.text()).toContain('原答引用：从液态变为气态');
    wrapper.unmount();
    const overview = mount(LearningOverview, {
      props: { initialExpanded: true, view: 'study-detail' },
      global: { stubs: stub }
    });
    expect(overview.text()).toContain('辅助总分 4 / 4');
    expect(overview.text()).toContain('原答引用：由气态变回液态');
    expect(store.summary.first.denominator).toBe(0);
    overview.unmount();
  });
});
