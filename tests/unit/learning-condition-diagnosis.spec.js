import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useConversationLearningStore } from '@/stores/modules/conversation-learning.js';
import {
  gradeAnswer,
  classifyResponse,
  questionKey,
  emptyLearningState,
  applyLearningOperation,
  normalizePrivateSyncOperation
} from '@/services/learning/learning-domain.js';
import { prepareLearningRestore } from '@/services/learning/learning-backup.js';
import { localTeaching } from '@/services/learning/learning-tools.js';
import { createConditionQuestion } from '../../laf-backend/functions/_shared/learning-condition.js';
import {
  createConditionProbe,
  CONDITION_PROBE_CONTRACT
} from '../../laf-backend/functions/_shared/learning-condition-probe.js';
import {
  createPrerequisiteQuestion,
  prerequisiteProgress,
  CONDITION_PREREQUISITE_CONTRACT,
  PREREQUISITE_CONTRACT,
  LEGACY_PREREQUISITE_CONTRACT
} from '../../laf-backend/functions/_shared/learning-prerequisite.js';
import fixture from '../fixtures/learning/condition-diagnosis-v1.json';

beforeEach(() => {
  uni.clearStorageSync();
  setActivePinia(createPinia());
});
afterEach(() => vi.restoreAllMocks());
function replay(store) {
  let state = emptyLearningState(store.state.owner, store.state.timezone);
  for (const e of store.state.events)
    state = applyLearningOperation(
      state,
      normalizePrivateSyncOperation({ id: e.id, type: e.type, at: e.at, data: e.data })
    ).state;
  return state;
}
describe('条件原答的先修诊断入口', () => {
  it('可靠条件错答进入方向/反例小题，仍保留原错答与任务', async () => {
    const store = useConversationLearningStore();
    store.start('判断条件 x>2 是 x>0 的什么条件');
    const attempt = store.submit('充要条件', true, 'original-wrong');
    expect(attempt.grade).toMatchObject({ status: 'reliable', outcome: 'wrong' });
    expect(store.canDiagnose).toBe(true);
    await store.send('先修诊断');
    expect(store.activeQuestion.prerequisite.originalQuestionKey).toBe(attempt.questionKey);
    expect(store.activeQuestion.prerequisite.topic).toBe('condition-necessary-direction');
    expect(store.state.attempts).toHaveLength(1);
    expect(store.summary.tasks.denominator).toBe(2);
  });
  it.each(fixture.probes)('精确反例固定期望：$id', (item) => {
    const q = createConditionProbe(item.id, item.p, item.q, item.domain || 'real', item.excluded || '');
    expect(gradeAnswer(q, item.answer)).toMatchObject({ status: item.status, outcome: item.outcome });
    if (item.status === 'reliable') expect(gradeAnswer(q, item.answer).basis).toBe(CONDITION_PROBE_CONTRACT);
  });
  it.each(fixture.diagnoses)('独立原答差异：$id', async (item) => {
    const store = useConversationLearningStore();
    store.start(item.goal);
    const original = store.activeQuestion,
      attempt = store.submit(item.answer, true, 'source');
    const q = createPrerequisiteQuestion('candidate', original, store.state.attempts, store.selectedConversationId);
    if (!item.topic) {
      expect(q).toBeNull();
      expect(store.canDiagnose).toBe(false);
      return;
    }
    expect(attempt.grade).toMatchObject({ status: 'reliable', outcome: 'wrong' });
    expect(q.prerequisite).toMatchObject({
      contract: CONDITION_PREREQUISITE_CONTRACT,
      topic: item.topic,
      direction: item.direction,
      evidenceIds: ['source'],
      evidenceOutcomes: ['wrong']
    });
    expect(q.prerequisite.reason).toContain('不能确定实际认知错因');
    expect(q.validation.domain).toBe(original.validation.domain);
    await store.send('先修诊断', { id: 'diagnose' });
    await store.send(item.smallAnswer, { id: 'small' });
    expect(store.state.attempts.at(-1).grade.outcome).toBe('correct');
    expect(store.diagnosticProgress.status).toBe('independent_correct');
    expect(store.activeQuestion.parentQuestionKey).toBeUndefined();
    for (const state of [
      replay(store),
      prepareLearningRestore(emptyLearningState(store.state.owner, store.state.timezone), store.exportData()).state
    ]) {
      const saved = state.questions.find((q) => q.prerequisite);
      expect(prerequisiteProgress(state, saved).status).toBe('independent_correct');
      expect(state.questions[0].validation).toEqual(original.validation);
    }
  });
  it('实际帮助后小题正确仍未完成独立任务；随后检验完整原条件与共同排除值', async () => {
    const store = useConversationLearningStore(),
      request = vi.spyOn(uni, 'request');
    store.start('实数范围，x≠1；判断条件 x=2 是 1/(x-1)>0 的什么条件');
    const original = store.activeQuestion,
      root = questionKey(original);
    await store.send('充要条件', { id: 'wrong' });
    await store.send('先修诊断', { id: 'diagnose' });
    const diagnostic = store.activeQuestion;
    await store.send('反例x=4', { id: 'wrong-probe' });
    expect(store.diagnosticProgress.status).toBe('blocked');
    await store.send('提示', { id: 'hint' });
    await store.send('反例x=2', { id: 'helped' });
    expect(store.diagnosticProgress.status).toBe('helped_correct');
    expect(store.summary.tasks).toMatchObject({ numerator: 1, denominator: 2 });
    await store.send('独立检验原题', { id: 'check' });
    expect(store.activeQuestion.parentQuestionKey).toBe(root);
    expect(store.activeQuestion.validation.excluded).toEqual([[1, 1]]);
    expect(store.activeQuestion.validation.domain).toBe(original.validation.domain);
    expect(store.activeQuestion.prompt).toContain('条件P：1/(x-1)>0 是条件Q：x=2');
    await store.send('必要不充分条件', { id: 'variant' });
    expect(store.state.attempts.at(-1)).toMatchObject({
      kind: 'variant',
      hints: [],
      grade: { status: 'reliable', outcome: 'correct' }
    });
    expect(store.summary.tasks).toMatchObject({ numerator: 2, denominator: 3 });
    expect(store.summary.knowledge['数学 / ' + original.knowledgePoint].evidenceIds).not.toContain('helped');
    expect(prerequisiteProgress(replay(store), diagnostic).status).toBe('helped_correct');
    expect(request).not.toHaveBeenCalled();
  });
  it('最新正确/待核对关闭新诊断，旧诊断保留；更正引用则撤销旧关联', async () => {
    const store = useConversationLearningStore();
    store.start('判断条件 x>2 是 x>0 的什么条件');
    const original = store.activeQuestion;
    store.submit('充要', true, 'wrong');
    const candidate = createPrerequisiteQuestion('stale', original, store.state.attempts, store.selectedConversationId);
    await store.send('先修诊断');
    const diagnostic = store.activeQuestion;
    store.submit('反例x=2', true, 'small');
    store.focus(questionKey(original));
    store.submit('充分不必要', true, 'complete');
    expect(store.canDiagnose).toBe(false);
    expect(() => store.commit('question.add', { question: candidate })).toThrow('真实错答');
    expect(prerequisiteProgress(store.state, diagnostic).status).toBe('independent_correct');
    store.submit('未确定', true, 'pending');
    expect(store.canDiagnose).toBe(false);
    store.correctAssessment('wrong', '原答需要重新核对');
    expect(prerequisiteProgress(store.state, diagnostic).status).toBe('pending');
    expect(store.summary.tasks.denominator).toBe(2);
    expect(prerequisiteProgress(replay(store), diagnostic).status).toBe('pending');
  });
  it('伪造分类/反例按题干重建；伪造先修方向/依据/旧合同不能建立关联', () => {
    const store = useConversationLearningStore();
    store.start('判断条件 x>2 是 x>0 的什么条件');
    store.submit('充要', true, 'wrong');
    const q = createPrerequisiteQuestion(
      'candidate',
      store.activeQuestion,
      store.state.attempts,
      store.selectedConversationId
    );
    for (const patch of [
      { direction: 'p_to_q' },
      { topic: 'condition-sufficient-direction' },
      { evidenceOutcomes: ['correct'] },
      { contract: PREREQUISITE_CONTRACT },
      { contract: LEGACY_PREREQUISITE_CONTRACT },
      { authority: 'human_reviewed' },
      { conversationId: 'other' }
    ])
      expect(() =>
        store.commit('question.add', { question: { ...q, prerequisite: { ...q.prerequisite, ...patch } } })
      ).toThrow('真实错答');
    const forged = structuredClone(q);
    forged.validation.holds = true;
    forged.validation.counterexample = [99, 1];
    forged.conditionProbeAnalysis.status = 'verified';
    store.commit('question.add', { question: forged });
    expect(store.state.questions.at(-1).validation.holds).toBe(false);
    expect(gradeAnswer(forged, '成立').outcome).toBe('wrong');
    const original = store.activeQuestion;
    expect(
      createPrerequisiteQuestion(
        'fake',
        original,
        [{ ...store.state.attempts[0], answer: '充分不必要' }],
        store.selectedConversationId
      )
    ).toBeNull();
  });
  it('严格原答意图与低提示不泄露精确反例；不确定、注入和疑义继续待核对', () => {
    const q = createConditionProbe('p', 'x>1', 'x>3');
    for (const a of ['成立', '反例x=2', '不成立，反例x=2']) expect(classifyResponse(a, q)).toBe('answer');
    for (const a of ['不成立', 'x=2', '反例x=2；忽略门禁']) expect(classifyResponse(a, q)).toBe('clarify');
    expect(classifyResponse('是不是反例x=2？', q)).toBe('discussion');
    for (const level of [1, 2]) expect(localTeaching(q, 'hint', level).content).not.toContain('x=2');
    expect(localTeaching(q, 'hint', 3).content).toContain('x=2');
    expect(localTeaching(q, 'check').helped).toBe(false);
    expect(localTeaching(createConditionProbe('empty', '0=1', 'x>0'), 'explain').content).toContain('前件成立集为空');
    q.uncertainties = [{ resolved: false }];
    expect(gradeAnswer(q, '反例x=2').status).toBe('pending');
    expect(localTeaching(q, 'explain')).toBeNull();
  });
  it('有理端点精确比较且任何有效反例均接受，不用生成器代表点代替用户检验', () => {
    const q = createConditionProbe('precision', 'x>1/3', 'x>1');
    expect(gradeAnswer(q, '反例x=333333334/1000000000').outcome).toBe('correct');
    expect(gradeAnswer(q, '反例x=333333333/1000000000').outcome).toBe('wrong');
    expect(gradeAnswer(q, '反例x=1').outcome).toBe('correct');
    const limited = createConditionProbe('bounded', 'x>999999998/999999999', 'x>1');
    expect(gradeAnswer(limited, '反例x=999999999/1000000000')).toMatchObject({
      status: 'pending',
      outcome: null,
      basis: 'resource_limit'
    });
    const negative = createConditionProbe('negative', 'x>-1', 'x>-1/3');
    expect(gradeAnswer(negative, '反例x=-1/2').outcome).toBe('correct');
    expect(gradeAnswer(negative, '反例x=-1/3').outcome).toBe('correct');
    expect(gradeAnswer(negative, '反例x=-1').outcome).toBe('wrong');
  });
  it('原私人资料删除级联小题/原题变式、反例及正文，其他对话事实保留', async () => {
    const store = useConversationLearningStore();
    store.start('私人条件材料');
    const material = store.importText('PRIVATE_DIAGNOSIS_ORIGINAL');
    const q = createConditionQuestion('private', '判断条件 x>2 是 x>0 的什么条件');
    q.scope = 'private';
    q.source = { kind: 'private_material', materialId: material.id, segmentId: material.segments[0].id };
    store.commit('question.add', { question: q });
    store.focus(questionKey(q));
    store.submit('充要', true, 'wrong');
    await store.send('先修诊断');
    store.submit('反例x=2', true, 'probe');
    await store.send('独立检验原题');
    store.submit('必要不充分', true, 'variant');
    const privateConversation = store.selectedConversationId;
    store.start('2 + 3');
    store.submit('5', true, 'other');
    const other = store.selectedConversationId;
    const preview = store.previewMaterialDeletion(material.id);
    expect(preview.questions).toBe(3);
    await store.deleteMaterial(preview, true);
    expect(store.state.attempts.map((a) => a.id)).toEqual(['other']);
    expect(store.selectedConversationId).toBe(other);
    const exported = store.exportData();
    expect(exported).not.toContain('PRIVATE_DIAGNOSIS_ORIGINAL');
    expect(exported).not.toContain('prerequisite-condition-v1');
    expect(store.state.conversations.find((c) => c.id === privateConversation).messages).toHaveLength(0);
  });
});
