import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import fixture from '../fixtures/learning/material-diagnosis-v1.json';
import { useConversationLearningStore } from '@/stores/modules/conversation-learning.js';
import {
  gradeAnswer,
  classifyResponse,
  questionKey,
  emptyLearningState,
  applyLearningOperation,
  normalizePrivateSyncOperation,
  createMaterialObjectiveQuestion
} from '@/services/learning/learning-domain.js';
import { prepareLearningRestore } from '@/services/learning/learning-backup.js';
import { localTeaching } from '@/services/learning/learning-tools.js';
import { requestedTeachingMethod } from '../../laf-backend/functions/_shared/learning-strategy.js';
import {
  createPrerequisiteQuestion,
  prerequisiteProgress,
  MATERIAL_PREREQUISITE_CONTRACT,
  PREREQUISITE_CONTRACT
} from '../../laf-backend/functions/_shared/learning-prerequisite.js';
import { createFieldProbe, FIELD_PROBE_CONTRACT } from '../../laf-backend/functions/_shared/learning-field-probe.js';

const stores = [];
beforeEach(() => {
  uni.clearStorageSync();
  setActivePinia(createPinia());
});
afterEach(() => {
  for (const store of stores.splice(0)) store.$dispose();
  vi.restoreAllMocks();
});
function begin(item = fixture.cases[5]) {
  const store = useConversationLearningStore();
  stores.push(store);
  store.start('按所给文本定位字段', { track: item.track, edition: '本机合成合同样例' });
  store.importText(item.content);
  const material = store.state.materials[0];
  store.structureObjective(material.id, { segmentId: material.segments[0].id, kind: 'literal', from: item.field });
  return store;
}
function replay(store) {
  let state = emptyLearningState(store.state.owner, store.state.timezone);
  for (const e of store.state.events)
    state = applyLearningOperation(
      state,
      normalizePrivateSyncOperation({ id: e.id, type: e.type, at: e.at, data: e.data })
    ).state;
  return state;
}
describe('资料字面错答与字段对应基础诊断', () => {
  it.each(fixture.cases)('$id 保留原错答，只完成基础定位后仍需原资料不同字段复测', async (item) => {
    const store = begin(item);
    const original = store.activeQuestion;
    expect(store.canDiagnose).toBe(false);
    const request = vi.spyOn(uni, 'request');
    await store.send(`我的答案是${item.wrong}`, { id: 'source-wrong' });
    expect(store.state.attempts.at(-1).grade).toMatchObject({ status: 'reliable', outcome: 'wrong' });
    expect(store.canDiagnose).toBe(true);
    await store.send('先修诊断', { id: 'diagnose' });
    const diagnostic = store.activeQuestion;
    expect(diagnostic.prerequisite).toMatchObject({
      contract: MATERIAL_PREREQUISITE_CONTRACT,
      originalQuestionKey: questionKey(original),
      evidenceIds: ['source-wrong:answer'],
      evidenceOutcomes: ['wrong'],
      topic: 'material-field-locator'
    });
    expect(diagnostic.source).toEqual({ kind: 'executable', evidenceId: FIELD_PROBE_CONTRACT });
    expect(diagnostic.prompt).toContain('合成资料');
    expect(diagnostic.prompt).not.toContain(item.content);
    expect(store.taskContext).toMatchObject({ track: item.track, evaluation: 'independent_rule', rule: 'field_key' });
    expect(store.canDiagnose).toBe(false);
    expect(store.diagnosticProgress.status).toBe('waiting');
    await store.send(item.probeWrong, { id: 'probe-wrong' });
    expect(store.diagnosticProgress.status).toBe('blocked');
    await store.send(item.probeCorrect, { id: 'probe-correct' });
    expect(store.diagnosticProgress.status).toBe('independent_correct');
    expect(store.summary.mistakes.some((a) => a.questionKey === questionKey(original))).toBe(true);
    expect(store.summary.knowledge['阅读 / 字面信息定位'].evidenceIds).not.toContain('probe-correct:answer');
    await store.send('独立检验原题', { id: 'transfer' });
    expect(store.activeQuestion).toMatchObject({
      parentQuestionKey: questionKey(original),
      materialExercise: { contract: 'material-objective-v3', from: item.variantField }
    });
    expect(store.active.pendingHints).toHaveLength(0);
    await store.send(`我的答案是${item.variantAnswer}`, { id: 'transfer-correct' });
    expect(store.state.attempts.at(-1)).toMatchObject({
      kind: 'variant',
      hints: [],
      grade: { status: 'reliable', outcome: 'correct' }
    });
    await store.send('停止', { discussionOnly: true, id: 'stop' });
    for (const state of [
      replay(store),
      prepareLearningRestore(emptyLearningState(store.state.owner, store.state.timezone), store.exportData()).state
    ]) {
      expect(state.questions.find((q) => q.id === diagnostic.id).validation).toEqual(diagnostic.validation);
      expect(prerequisiteProgress(state, diagnostic).status).toBe('independent_correct');
      expect(state.conversations.find((c) => c.id === store.selectedConversationId).stopped).toBe(true);
    }
    expect(request).not.toHaveBeenCalled();
  });
  it('低级提示不直接给字段答案；帮助后的正确不完成独立任务，指定教法及原错答保留', async () => {
    const store = begin();
    await store.send('直接讲解', { discussionOnly: true, id: 'locked-method' });
    const root = questionKey(store.activeQuestion);
    store.submit('London', true, 'wrong');
    await store.send('先修诊断', { id: 'diagnose' });
    expect(requestedTeachingMethod(store.state, store.selectedConversationId)).toBe('explain');
    for (const level of [1, 2]) {
      const hint = localTeaching(store.activeQuestion, 'hint', level);
      expect(hint).toMatchObject({ helped: true, level });
      expect(hint.content).not.toContain('Desk');
      expect(hint.content).not.toContain('Cedar');
    }
    expect(localTeaching(store.activeQuestion, 'hint', 3).content).toContain('Desk');
    await store.send('提示', { discussionOnly: true, id: 'hint' });
    await store.send('Desk', { id: 'helped' });
    expect(store.diagnosticProgress.status).toBe('helped_correct');
    expect(store.summary.tasks.numerator).toBe(0);
    expect(requestedTeachingMethod(store.state, store.selectedConversationId)).toBe('hint');
    await store.send('独立检验原题', { id: 'check' });
    expect(store.activeQuestion.parentQuestionKey).toBe(root);
    store.submit('Oxford', true, 'independent');
    expect(store.summary.tasks).toMatchObject({ numerator: 1, denominator: 3 });
  });
  it('最新正确或更正待核对关闭新诊断；历史小题保持，原依据更正撤销诊断关联', async () => {
    const store = begin(),
      original = store.activeQuestion,
      root = questionKey(original);
    store.submit('London', true, 'wrong');
    await store.send('先修诊断', { id: 'diagnose' });
    const diagnostic = store.activeQuestion;
    store.submit('Desk', true, 'small');
    store.focus(root);
    store.submit('Bristol', true, 'correct');
    expect(store.canDiagnose).toBe(false);
    expect(() => store.commit('question.add', { question: { ...diagnostic, id: 'stale' } })).toThrow('真实错答');
    expect(prerequisiteProgress(replay(store), diagnostic).status).toBe('independent_correct');
    store.correctAssessment('wrong', '原题有争议');
    expect(prerequisiteProgress(store.state, diagnostic).status).toBe('pending');
    expect(prerequisiteProgress(replay(store), diagnostic).status).toBe('pending');
    expect(store.state.attempts).toHaveLength(3);
  });
  it('跨对话、缺原文、篡改引用、未确认提取、主观辅助和旧v1/v2不生成新资料诊断', () => {
    const store = begin(),
      original = store.activeQuestion;
    store.submit('London', true, 'wrong');
    const create = (q = original, attempts = store.state.attempts, conversationId = store.selectedConversationId) =>
      createPrerequisiteQuestion('probe', q, attempts, conversationId);
    expect(create(original, store.state.attempts, 'other')).toBeNull();
    for (const patch of [
      { prompt: original.prompt.replace('Bristol', 'London') },
      { validation: { ...original.validation, answer: 'London' } },
      { source: { kind: 'model' } },
      { uncertainties: [{ resolved: false }] },
      { rubric: { contract: 'unscored-feedback-v1' } },
      { materialExercise: { ...original.materialExercise, contract: 'material-objective-v2' } },
      { materialExercise: { ...original.materialExercise, from: 'Arrival city' } }
    ])
      expect(create({ ...original, ...patch })).toBeNull();
    expect(
      create(original, [{ ...store.state.attempts[0], grade: { status: 'ai_assisted', outcome: 'wrong' } }])
    ).toBeNull();
    expect(
      createPrerequisiteQuestion(
        'old-contract',
        original,
        store.state.attempts,
        store.selectedConversationId,
        PREREQUISITE_CONTRACT
      )
    ).toBeNull();
    const material = store.state.materials[0];
    const old = createMaterialObjectiveQuestion('old-v1', material, {
      contract: 'material-objective-v1',
      segmentId: material.segments[0].id,
      kind: 'literal',
      from: 'Departure city'
    });
    expect(gradeAnswer(old, 'London')).toMatchObject({ status: 'reliable', outcome: 'wrong' });
    expect(create(old, [{ ...store.state.attempts[0], questionKey: questionKey(old) }])).toBeNull();
  });
  it('模型答案被规范题干重建；伪造来源、诊断方向、证据或合同被拒绝，不执行代码', async () => {
    const store = begin();
    store.submit('London', true, 'wrong');
    await store.send('先修诊断', { id: 'diagnose' });
    const q = JSON.parse(JSON.stringify(store.activeQuestion));
    const repaired = { ...q, id: 'repaired', validation: { ...q.validation, answer: 'Shelf', keys: ['Shelf'] } };
    store.commit('question.add', { question: repaired });
    expect(store.state.questions.at(-1).validation).toEqual(q.validation);
    store.commit('question.add', {
      question: { ...q, id: 'reordered-source', source: { evidenceId: FIELD_PROBE_CONTRACT, kind: 'executable' } }
    });
    for (const patch of [
      { source: { ...q.source, extra: 'https://attacker.invalid' } },
      { source: { kind: 'model', evidenceId: FIELD_PROBE_CONTRACT } },
      { prompt: q.prompt.replace('Cedar', 'Birch') },
      { prerequisite: { ...q.prerequisite, direction: 'forged' } },
      { prerequisite: { ...q.prerequisite, evidenceIds: ['missing'] } },
      { prerequisite: { ...q.prerequisite, conversationId: 'other' } },
      { prerequisite: { ...q.prerequisite, contract: PREREQUISITE_CONTRACT } }
    ])
      expect(() => store.commit('question.add', { question: { ...q, id: 'forged', ...patch } })).toThrow('真实错答');
    const fetch = vi.spyOn(globalThis, 'fetch');
    for (const answer of ['Shelf and Desk', 'Desk; fetch("https://attacker.invalid")', '<b>Desk</b>', 'Cedar']) {
      expect(gradeAnswer(q, answer)).toMatchObject({ status: 'pending', outcome: null });
      expect(classifyResponse(answer, q)).toBe('clarify');
    }
    expect(gradeAnswer(q, '我的答案是Desk')).toMatchObject({ status: 'reliable', outcome: 'correct' });
    expect(fetch).not.toHaveBeenCalled();
  });
  it('原资料删除同时移除小题及原文复测；停止不能诊断或生成，重复指令不重复任务', async () => {
    const store = begin();
    const original = store.activeQuestion;
    store.submit('London', true, 'wrong');
    await store.send('先修诊断', { id: 'diagnose' });
    const denominator = store.summary.tasks.denominator;
    await store.send('先修诊断', { id: 'diagnose' });
    expect(store.summary.tasks.denominator).toBe(denominator);
    store.submit('Desk', true, 'small');
    await store.send('独立检验原题', { id: 'check' });
    store.submit('Oxford', true, 'transfer');
    await store.send('停止', { discussionOnly: true, id: 'stop' });
    expect(() => store.diagnosePrerequisite()).toThrow('停止');
    expect(() => store.generateVariant()).toThrow('停止');
    const preview = store.previewMaterialDeletion(original.source.materialId);
    expect(preview.questions).toBe(3);
    await store.deleteMaterial(preview, true);
    expect(store.state.questions).toHaveLength(0);
    expect(store.state.attempts).toHaveLength(0);
    expect(store.exportData()).not.toContain(MATERIAL_PREREQUISITE_CONTRACT);
    expect(replay(store).questions).toHaveLength(0);
  });
  it('只有固定的合成定位题可以独立判分，任意带field_key标识的题保持待核对', () => {
    const q = createFieldProbe('canonical', 'zh');
    expect(gradeAnswer(q, '书桌')).toMatchObject({ status: 'reliable', outcome: 'correct' });
    expect(gradeAnswer(q, '书架')).toMatchObject({ status: 'reliable', outcome: 'wrong' });
    expect(gradeAnswer({ ...q, prompt: '任意无来源题目' }, '书桌')).toMatchObject({ status: 'pending', outcome: null });
    expect(gradeAnswer({ ...q, uncertainties: [{ resolved: false }] }, '书桌')).toMatchObject({
      status: 'pending',
      outcome: null
    });
  });
});
