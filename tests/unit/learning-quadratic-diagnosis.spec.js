import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useConversationLearningStore } from '@/stores/modules/conversation-learning.js';
import {
  gradeAnswer,
  questionKey,
  emptyLearningState,
  applyLearningOperation,
  normalizePrivateSyncOperation,
  summarizeLearning
} from '@/services/learning/learning-domain.js';
import { prepareLearningRestore } from '@/services/learning/learning-backup.js';
import { conversationStrategy } from '../../laf-backend/functions/_shared/learning-strategy.js';
import {
  createAlgebraQuestion,
  QUADRATIC_INEQUALITY_CONTRACT
} from '../../laf-backend/functions/_shared/learning-algebra.js';
import {
  createPrerequisiteQuestion,
  prerequisiteProgress,
  QUADRATIC_PREREQUISITE_CONTRACT,
  CONDITION_PREREQUISITE_CONTRACT,
  PREREQUISITE_CONTRACT,
  LEGACY_PREREQUISITE_CONTRACT
} from '../../laf-backend/functions/_shared/learning-prerequisite.js';
import fixture from '../fixtures/learning/quadratic-diagnosis-v1.json';

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
function source(question, answer, id = 'original-wrong', conversationId = 'quality') {
  return { id, answer, conversationId, questionKey: questionKey(question), grade: gradeAnswer(question, answer) };
}

describe('二次不等式的独立原答差异与候选先修', () => {
  it.each(fixture.cases)('$id', (item) => {
    const original = createAlgebraQuestion(item.id, item.goal);
    if (item.uncertainties) original.uncertainties = item.uncertainties;
    const attempt = source(original, item.answer),
      diagnostic = createPrerequisiteQuestion(
        'candidate',
        original,
        [attempt],
        'quality',
        QUADRATIC_PREREQUISITE_CONTRACT
      );
    expect(attempt.grade).toMatchObject({ status: item.status, outcome: item.outcome });
    if (!item.topic) {
      expect(diagnostic).toBeNull();
      return;
    }
    expect(diagnostic.prompt).toBe(item.prompt);
    expect(diagnostic.prerequisite).toMatchObject({
      contract: QUADRATIC_PREREQUISITE_CONTRACT,
      topic: item.topic,
      evidenceIds: ['original-wrong'],
      evidenceOutcomes: ['wrong']
    });
    expect(diagnostic.prerequisite.reason).toContain('不能确定实际认知错因');
    expect(diagnostic.parentQuestionKey).toBeUndefined();
    expect(gradeAnswer(diagnostic, item.diagnosticAnswer)).toMatchObject({ status: 'reliable', outcome: 'correct' });
    expect(createPrerequisiteQuestion('default', original, [attempt], 'quality').prerequisite.contract).toBe(
      QUADRATIC_PREREQUISITE_CONTRACT
    );
    for (const contract of [LEGACY_PREREQUISITE_CONTRACT, PREREQUISITE_CONTRACT, CONDITION_PREREQUISITE_CONTRACT])
      expect(createPrerequisiteQuestion('old', original, [attempt], 'quality', contract)).toBeNull();
  });

  it('从完整原式重验，调用方的参考、错误评分与伪造小题不能建立诊断', () => {
    const store = useConversationLearningStore();
    store.start('解二次不等式 x^2-4<0');
    store.submit('[-2,2]', true, 'wrong');
    const original = JSON.parse(JSON.stringify(store.activeQuestion)),
      evidence = JSON.parse(JSON.stringify(store.state.attempts));
    original.validation.solution.intervals = [];
    original.source.reference = '无解';
    const diagnostic = createPrerequisiteQuestion('candidate', original, evidence, store.selectedConversationId);
    expect(diagnostic.prerequisite.topic).toBe('quadratic-boundary');
    expect(
      createPrerequisiteQuestion(
        'forged',
        original,
        [{ ...evidence[0], answer: '(-2,2)' }],
        store.selectedConversationId
      )
    ).toBeNull();
    for (const patch of [
      { contract: PREREQUISITE_CONTRACT },
      { contract: LEGACY_PREREQUISITE_CONTRACT },
      { topic: 'quadratic-zeros' },
      { evidenceIds: ['missing'] },
      { evidenceIds: ['wrong', 'wrong'] },
      { evidenceOutcomes: ['correct'] },
      { reason: '用户确定不会求根' },
      { conversationId: 'other' },
      { authority: 'human_reviewed' },
      { direction: 'p_to_q' }
    ])
      expect(() =>
        store.commit('question.add', {
          question: { ...diagnostic, prerequisite: { ...diagnostic.prerequisite, ...patch } }
        })
      ).toThrow('真实错答');
    expect(() =>
      store.commit('question.add', { question: { ...diagnostic, prompt: '在实数范围内解不等式 x>0，写出完整解集。' } })
    ).toThrow('真实错答');
    const forged = structuredClone(diagnostic);
    forged.validation.solution.intervals = [];
    store.commit('question.add', { question: forged });
    expect(gradeAnswer(store.state.questions.at(-1), 'x>1').outcome).toBe('correct');
    expect(store.state.questions.at(-1).publishable).toBe(false);
  });

  it('只取本对话本版本最近两份真实错答，按最新差异选型；诊断小题不能套娃', () => {
    const q = createAlgebraQuestion('original', '解二次不等式 x^2-4>0');
    const attempts = [
      source(q, 'x>2', 'first'),
      source(q, '[-2,2]', 'second'),
      source(q, '(-∞,-3)∪(3,∞)', 'latest'),
      source(q, '无解', 'other-conversation', 'other'),
      { ...source(q, '无解', 'other-version'), questionKey: 'original@2' }
    ];
    const diagnostic = createPrerequisiteQuestion('candidate', q, attempts, 'quality');
    expect(diagnostic.prerequisite).toMatchObject({
      topic: 'quadratic-zeros',
      evidenceIds: ['second', 'latest'],
      evidenceOutcomes: ['wrong', 'wrong']
    });
    expect(createPrerequisiteQuestion('nested', diagnostic, [source(diagnostic, '无解')], 'quality')).toBeNull();
    const arithmetic = {
      id: 'arithmetic',
      version: 1,
      prompt: '计算 2 + 3。',
      source: { kind: 'executable' },
      validation: { type: 'number', authority: 'executable', evidenceId: 'integer-arithmetic-v1', answer: 5 }
    };
    expect(
      createPrerequisiteQuestion(
        'bad',
        arithmetic,
        [source(arithmetic, '4')],
        'quality',
        QUADRATIC_PREREQUISITE_CONTRACT
      )
    ).toBeNull();
  });

  it('最新正确或待核对关闭新诊断，历史小题保留；更正所引用原答使旧关联待核对', async () => {
    const store = useConversationLearningStore();
    store.start('解二次不等式 x^2-4>=0');
    const original = store.activeQuestion;
    store.submit('x>=2', true, 'wrong');
    const stale = createPrerequisiteQuestion('stale', original, store.state.attempts, store.selectedConversationId);
    await store.send('先修诊断', { id: 'diagnose' });
    const diagnostic = store.activeQuestion;
    store.submit('(-∞,-1]∪[1,∞)', true, 'small');
    store.focus(questionKey(original));
    store.submit('(-∞,-2]∪[2,∞)', true, 'correct');
    expect(store.canDiagnose).toBe(false);
    expect(() => store.commit('question.add', { question: stale })).toThrow('真实错答');
    expect(prerequisiteProgress(store.state, diagnostic).status).toBe('independent_correct');
    expect(
      prerequisiteProgress(
        prepareLearningRestore(emptyLearningState(store.state.owner, store.state.timezone), store.exportData()).state,
        diagnostic
      ).status
    ).toBe('independent_correct');
    store.submit('尚未确定', true, 'pending');
    expect(store.canDiagnose).toBe(false);
    store.correctAssessment('wrong', '原答判分需要重新核对');
    expect(prerequisiteProgress(store.state, diagnostic).status).toBe('pending');
    expect(prerequisiteProgress(replay(store), diagnostic).status).toBe('pending');
    expect(
      prerequisiteProgress(
        prepareLearningRestore(emptyLearningState(store.state.owner, store.state.timezone), store.exportData()).state,
        diagnostic
      ).status
    ).toBe('pending');
    expect(store.state.questions).toHaveLength(2);
  });
});

describe('二次原题与基础小题分别保留学习事实', () => {
  it('原错答→小题受阻→图示后正确→完整原题独立变式→停止/重开/恢复/同步重放', async () => {
    const store = useConversationLearningStore(),
      request = vi.spyOn(uni, 'request');
    store.start('解二次不等式 (x-2)*(x-4)>=0');
    const original = store.activeQuestion,
      root = questionKey(original);
    await store.send('x>=4', { id: 'first' });
    expect(store.canDiagnose).toBe(true);
    expect(store.state.questions).toHaveLength(1);
    await store.send('先修诊断', { id: 'diagnose' });
    const diagnostic = store.activeQuestion;
    expect(store.active.pendingHints).toHaveLength(0);
    expect(store.diagnosticProgress.status).toBe('waiting');
    await store.send('x>=1', { id: 'small-wrong' });
    expect(store.diagnosticProgress.status).toBe('blocked');
    await store.send('用图示', { discussionOnly: true, id: 'diagram' });
    await store.send('(-∞,-1]∪[1,∞)', { id: 'small-helped' });
    expect(store.diagnosticProgress.status).toBe('helped_correct');
    expect(store.state.attempts.at(-1).hints).toHaveLength(1);
    expect(store.summary.tasks).toMatchObject({ numerator: 1, denominator: 2 });
    await store.send('独立检验原题', { id: 'check' });
    expect(store.activeQuestion.parentQuestionKey).toBe(root);
    expect(store.activeQuestion.algebra.contract).toBe(QUADRATIC_INEQUALITY_CONTRACT);
    expect(store.activeQuestion.validation.solution).toEqual(original.validation.solution);
    expect(store.activeQuestion.prerequisite).toBeUndefined();
    await store.send('x<=2∪x>=4', { id: 'variant' });
    expect(store.state.attempts.at(-1)).toMatchObject({ kind: 'variant', hints: [], grade: { outcome: 'correct' } });
    expect(store.summary.first).toMatchObject({ numerator: 2, denominator: 2 });
    expect(store.summary.mistakes.map((a) => a.id)).toEqual(['first:answer', 'small-wrong:answer']);
    expect(store.summary.tasks).toMatchObject({ numerator: 2, denominator: 3 });
    expect(store.summary.knowledge['数学 / ' + original.knowledgePoint].evidenceIds).not.toContain(
      'small-helped:answer'
    );
    store.commit('task.stop', { conversationId: store.active.id });
    store.focus(questionKey(diagnostic));
    expect(store.active.stopped).toBe(true);
    expect(() => store.generateVariant()).toThrow('继续已停止');
    expect(() => store.diagnosePrerequisite()).toThrow('继续已停止');
    for (const state of [
      replay(store),
      prepareLearningRestore(emptyLearningState(store.state.owner, store.state.timezone), store.exportData()).state
    ]) {
      expect(state.conversations[0].stopped).toBe(true);
      expect(conversationStrategy(state, store.selectedConversationId)).toMatchObject({
        method: 'diagram',
        source: 'self_report',
        stopped: true
      });
      expect(state.questions.find((q) => q.prerequisite).prerequisite.contract).toBe(QUADRATIC_PREREQUISITE_CONTRACT);
      expect(prerequisiteProgress(state, diagnostic).status).toBe('helped_correct');
      expect(summarizeLearning(state).first).toEqual(store.summary.first);
      expect(summarizeLearning(state).tasks).toEqual(store.summary.tasks);
    }
    expect(request).not.toHaveBeenCalled();
  });

  it('小方程诊断正确仍不等于二次完整区间掌握；原题变式保持不等式任务', async () => {
    const store = useConversationLearningStore();
    store.start('解二次不等式 x^2-4<0');
    const root = questionKey(store.activeQuestion);
    store.submit('(-3,3)', true, 'wrong');
    await store.send('先修诊断');
    expect(store.activeQuestion.prerequisite.topic).toBe('quadratic-zeros');
    store.submit('-1,1', true, 'small');
    expect(store.diagnosticProgress.status).toBe('independent_correct');
    await store.send('独立检验原题');
    expect(store.activeQuestion.parentQuestionKey).toBe(root);
    expect(store.activeQuestion.algebra.contract).toBe(QUADRATIC_INEQUALITY_CONTRACT);
    expect(gradeAnswer(store.activeQuestion, '(-2,2)').outcome).toBe('correct');
    expect(gradeAnswer(store.activeQuestion, '-2,2').status).toBe('pending');
  });

  it('删除私人原资料级联二次诊断/完整变式，其他对话和原停止记录不变', async () => {
    const store = useConversationLearningStore();
    store.start('私人二次材料');
    const material = store.importText('PRIVATE_QUADRATIC_DIAGNOSIS_SOURCE'),
      q = createAlgebraQuestion('private', '解二次不等式 x^2-4>=0');
    q.scope = 'private';
    q.source = { kind: 'private_material', materialId: material.id, segmentId: material.segments[0].id };
    store.commit('question.add', { question: q });
    store.focus(questionKey(q));
    store.submit('x>=2', true, 'wrong');
    await store.send('先修诊断');
    store.submit('(-∞,-1]∪[1,∞)', true, 'small');
    await store.send('独立检验原题');
    store.submit('(-∞,-2]∪[2,∞)', true, 'variant');
    const privateConversation = store.selectedConversationId;
    store.commit('task.stop', { conversationId: privateConversation });
    store.start('2 + 3');
    store.submit('5', true, 'other');
    const other = store.selectedConversationId,
      preview = store.previewMaterialDeletion(material.id);
    expect(preview.questions).toBe(3);
    await store.deleteMaterial(preview, true);
    expect(store.state.attempts.map((a) => a.id)).toEqual(['other']);
    expect(store.selectedConversationId).toBe(other);
    expect(store.state.conversations.find((c) => c.id === privateConversation).stopped).toBe(true);
    expect(store.exportData()).not.toContain('PRIVATE_QUADRATIC_DIAGNOSIS_SOURCE');
    expect(store.exportData()).not.toContain(QUADRATIC_PREREQUISITE_CONTRACT);
  });
});
