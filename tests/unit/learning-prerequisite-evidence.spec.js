import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import fixture from '../fixtures/learning/prerequisite-v2.json';
import { useConversationLearningStore } from '@/stores/modules/conversation-learning.js';
import {
  gradeAnswer,
  questionKey,
  emptyLearningState,
  applyLearningOperation,
  normalizePrivateSyncOperation
} from '@/services/learning/learning-domain.js';
import { prepareLearningRestore } from '@/services/learning/learning-backup.js';
import {
  createPrerequisiteQuestion,
  prerequisiteProgress,
  LEGACY_PREREQUISITE_CONTRACT
} from '../../laf-backend/functions/_shared/learning-prerequisite.js';

beforeEach(() => {
  uni.clearStorageSync();
  setActivePinia(createPinia());
});
function begin(goal) {
  const store = useConversationLearningStore();
  store.start(goal);
  return store;
}
function replay(store) {
  let state = emptyLearningState('guest', store.state.timezone);
  for (const e of store.state.events)
    state = applyLearningOperation(
      state,
      normalizePrivateSyncOperation({ id: e.id, type: e.type, at: e.at, data: e.data })
    ).state;
  return state;
}
describe('独立原答差异驱动的版本化先修诊断', () => {
  it('最新完整作答关闭新诊断；既有诊断及原错答历史保留，恢复/同步不丢失', async () => {
    const store = begin('解方程 x^2=4'),
      root = questionKey(store.activeQuestion);
    store.submit('2', true, 'partial');
    await store.send('先修诊断');
    const diagnostic = store.activeQuestion;
    store.submit('±1', true, 'small');
    store.focus(root);
    store.submit('±2', true, 'complete');
    expect(store.canDiagnose).toBe(false);
    expect(
      createPrerequisiteQuestion('stale', store.activeQuestion, store.state.attempts, store.selectedConversationId)
    ).toBeNull();
    for (const state of [
      store.state,
      replay(store),
      prepareLearningRestore(emptyLearningState('guest', store.state.timezone), store.exportData()).state
    ]) {
      expect(state.questions.some((q) => q.id === diagnostic.id)).toBe(true);
      expect(prerequisiteProgress(state, diagnostic).status).toBe('independent_correct');
      expect(state.attempts.find((a) => a.id === 'partial').grade.outcome).toBe('partial');
    }
  });
  it('最新待核对不能借旧可靠错答生成新诊断；部分正确仍可候选检查', () => {
    const store = begin('解方程 x^2=4');
    store.submit('3', true, 'wrong');
    expect(store.canDiagnose).toBe(true);
    store.submit('待核对这个表达', true, 'pending');
    expect(store.canDiagnose).toBe(false);
    store.submit('2', true, 'partial');
    expect(store.canDiagnose).toBe(true);
  });
  for (const item of fixture.cases)
    it(item.id, async () => {
      const store = begin(item.goal),
        root = store.activeQuestion;
      const attempt = store.submit(item.answer, true, 'source-answer');
      expect(attempt.grade).toMatchObject({ status: item.status, outcome: item.outcome });
      const candidate = createPrerequisiteQuestion(
        'fixed-diagnostic',
        root,
        store.state.attempts,
        store.selectedConversationId
      );
      if (!item.topic) {
        expect(candidate).toBeNull();
        expect(store.canDiagnose).toBe(false);
        return;
      }
      expect(candidate.prompt).toBe(item.prompt);
      expect(candidate.prerequisite).toMatchObject({
        contract: fixture.version,
        topic: item.topic,
        evidenceOutcomes: [item.outcome]
      });
      expect(gradeAnswer(candidate, item.diagnosticAnswer)).toMatchObject({ status: 'reliable', outcome: 'correct' });
      await store.send('先修诊断', { id: 'diagnose' });
      expect(store.activeQuestion.prompt).toBe(item.prompt);
      const result = store.submit(item.diagnosticAnswer, true, 'diagnostic-independent');
      expect(result.hints).toHaveLength(0);
      expect(store.diagnosticProgress.status).toBe('independent_correct');
      const summary = store.summary.knowledge[`数学 / ${root.knowledgePoint}`];
      expect(summary.evidenceIds).not.toContain('diagnostic-independent');
      expect(store.summary.mistakes.map((a) => a.id)).toEqual(item.outcome === 'wrong' ? ['source-answer'] : []);
      for (const state of [
        replay(store),
        prepareLearningRestore(emptyLearningState('guest', store.state.timezone), store.exportData()).state
      ]) {
        const q = state.questions.find((q) => q.prerequisite);
        expect(prerequisiteProgress(state, q).status).toBe('independent_correct');
        expect(q.prerequisite.evidenceOutcomes).toEqual([item.outcome]);
      }
    });
  it('少写一解不计错题；提示后补全不完成独立任务，原题变式仍单独检验', async () => {
    const store = begin('解方程 x^2=4'),
      root = questionKey(store.activeQuestion);
    store.submit('2', true, 'partial');
    await store.send('先修诊断', { id: 'diagnose' });
    await store.send('提示', { discussionOnly: true });
    store.submit('{-1,1}', true, 'helped');
    expect(store.diagnosticProgress.status).toBe('helped_correct');
    expect(store.summary.mistakes).toHaveLength(0);
    expect(store.summary.tasks).toMatchObject({ numerator: 1, denominator: 2 });
    await store.send('独立检验原题', { id: 'check' });
    expect(store.activeQuestion.parentQuestionKey).toBe(root);
    expect(store.activeQuestion.prompt).toBe('在实数范围内解方程 -2*(4)=-2*(x^2)，写出全部精确解。');
    expect(store.active.pendingHints).toHaveLength(0);
    expect(gradeAnswer(store.activeQuestion, '2')).toMatchObject({ status: 'reliable', outcome: 'partial' });
    expect(store.submit('{-2,2}', true, 'independent-check').grade.outcome).toBe('correct');
    expect(store.summary.tasks).toMatchObject({ numerator: 2, denominator: 3 });
  });
  it('v1备份及同步按冻结的原题干/理由重验，不用v2替换旧诊断', () => {
    const store = begin('-12 + -8');
    store.submit('-4', true, 'wrong');
    const q = createPrerequisiteQuestion(
      'legacy',
      store.activeQuestion,
      store.state.attempts,
      store.selectedConversationId,
      LEGACY_PREREQUISITE_CONTRACT
    );
    expect(q.prompt).toBe('计算 0 + -3。');
    expect(q.prerequisite.reason).toBe('原题计算受阻，先用小数检查加法与符号；错答尚不能确定具体错因');
    expect(q.prerequisite.evidenceOutcomes).toBeUndefined();
    store.commit('question.add', { question: q });
    store.focus('legacy@1');
    store.submit('-3', true, 'legacy-correct');
    for (const state of [
      replay(store),
      prepareLearningRestore(emptyLearningState('guest', store.state.timezone), store.exportData()).state
    ]) {
      const saved = state.questions.find((q) => q.id === 'legacy');
      expect(saved.prerequisite.contract).toBe(LEGACY_PREREQUISITE_CONTRACT);
      expect(saved.prompt).toBe(q.prompt);
      expect(prerequisiteProgress(state, saved).status).toBe('independent_correct');
    }
  });
  it('有效判分被更正或原答与手工更正冲突时撤销诊断依据，保存旧题与任务分母', async () => {
    const store = begin('解方程 x^2=4');
    store.submit('2', true, 'partial');
    await store.send('先修诊断');
    store.submit('{-1,1}', true, 'correct');
    store.correctAssessment('partial', '原答尚需核对');
    expect(store.diagnosticProgress.status).toBe('pending');
    expect(store.summary.tasks.denominator).toBe(2);
    expect(prerequisiteProgress(replay(store), store.activeQuestion).status).toBe('pending');
    const other = begin('解不等式 -2*x+6>0');
    other.submit('x<3', true, 'correct-original');
    other.commit('assessment.correct', { attemptId: 'correct-original', reason: '手工要求记错', outcome: 'wrong' });
    expect(other.state.attempts.at(-1).corrections.at(-1).grade).toMatchObject({ status: 'pending', outcome: 'wrong' });
    expect(other.canDiagnose).toBe(false);
    expect(
      createPrerequisiteQuestion(
        'contradictory',
        other.activeQuestion,
        [{ ...other.state.attempts.at(-1), corrections: [], grade: { status: 'reliable', outcome: 'wrong' } }],
        other.selectedConversationId
      )
    ).toBeNull();
  });
  it('拒绝伪造候选分类、证据结果、合同、顺序与跨对话引用；不能以reference改写算术真值', () => {
    const store = begin('27 + 18');
    store.submit('35', true, 'first');
    store.submit('35', true, 'second');
    const original = store.activeQuestion,
      q = createPrerequisiteQuestion('candidate', original, store.state.attempts, store.selectedConversationId);
    for (const patch of [
      { topic: 'basic-addition' },
      { evidenceOutcomes: ['wrong', 'partial'] },
      { contract: 'prerequisite-diagnosis-v9' },
      { evidenceIds: ['second', 'first'] },
      { conversationId: 'other' }
    ]) {
      expect(() =>
        store.commit('question.add', { question: { ...q, prerequisite: { ...q.prerequisite, ...patch } } })
      ).toThrow('真实错答');
    }
    expect(
      createPrerequisiteQuestion(
        'attack',
        { ...original, validation: { ...original.validation, answer: '35' } },
        store.state.attempts,
        store.selectedConversationId
      )
    ).toBeNull();
    expect(
      createPrerequisiteQuestion(
        'attack',
        original,
        [{ ...store.state.attempts[0], answer: 'eval(35)' }],
        store.selectedConversationId
      )
    ).toBeNull();
  });
  it.each([
    ['解方程 (x^2-4)/(x-2)=0', '{-2,2}', '-1', '-2', '{-2,2}', 'wrong'],
    ['正数解方程 x^2=4', '-2', '2', '2', '-2', 'wrong'],
    ['整数解方程 x^2=4', '2', '{-1,1}', '±2', '2', 'partial']
  ])(
    '%s诊断后的独立检验保留原数域、排除值和全部解要求',
    async (goal, source, smallAnswer, complete, incomplete, outcome) => {
      const store = begin(goal),
        original = store.activeQuestion;
      store.submit(source, true, 'source');
      await store.send('先修诊断');
      store.submit(smallAnswer, true, 'small');
      await store.send('独立检验原题');
      expect(store.activeQuestion.validation.task).toBe('equation');
      expect(store.activeQuestion.validation.domain).toBe(original.validation.domain);
      expect(store.activeQuestion.validation.excluded).toEqual(original.validation.excluded);
      expect(store.activeQuestion.validation.solution).toEqual(original.validation.solution);
      expect(gradeAnswer(store.activeQuestion, incomplete).outcome).toBe(outcome);
      expect(store.submit(complete, true, 'complete').grade).toMatchObject({ status: 'reliable', outcome: 'correct' });
      expect(store.state.attempts.at(-1).hints).toHaveLength(0);
    }
  );
});
