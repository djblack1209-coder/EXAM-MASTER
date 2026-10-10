import { beforeEach, describe, it, expect } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useConversationLearningStore } from '@/stores/modules/conversation-learning.js';
import {
  emptyLearningState,
  questionKey,
  applyLearningOperation,
  normalizePrivateSyncOperation
} from '@/services/learning/learning-domain.js';
import {
  createPrerequisiteQuestion,
  prerequisiteProgress
} from '../../laf-backend/functions/_shared/learning-prerequisite.js';
import {
  requestedTeachingMethod,
  observeTeaching
} from '../../laf-backend/functions/_shared/learning-teaching-observation.js';
import { prepareLearningRestore } from '@/services/learning/learning-backup.js';
import { createAlgebraQuestion } from '@/services/learning/learning-tools.js';
import { parsePastedMaterial } from '@/services/learning/material-intake.js';

beforeEach(() => {
  uni.clearStorageSync();
  setActivePinia(createPinia());
});
const begin = (goal = '12 + 8') => {
  const store = useConversationLearningStore();
  store.start(goal);
  return store;
};

describe('有真实错答依据的先修小题与原题独立检验', () => {
  it('删除私人原资料同时删除先修小题、独立变式及关联作答；导出不能带回关系', async () => {
    const store = begin('私人资料不等式');
    store.commit('material.add', { material: parsePastedMaterial('私人原资料标记', 'private-material') });
    const q = createAlgebraQuestion('private-root', '解不等式 -2*x+6>0');
    q.scope = 'private';
    q.source = { kind: 'material', materialId: 'private-material' };
    store.commit('question.add', { question: q });
    store.focus('private-root@1');
    store.submit('x>3', true, 'private-wrong');
    await store.send('先修诊断');
    store.submit('x<0', true, 'private-diagnostic');
    await store.send('独立检验原题');
    const preview = store.previewMaterialDeletion('private-material');
    expect(preview.questions).toBe(3);
    await store.deleteMaterial(preview, true);
    expect(store.state.questions).toHaveLength(0);
    expect(store.state.attempts).toHaveLength(0);
    expect(store.exportData()).not.toContain('prerequisite-diagnosis-');
    const restored = prepareLearningRestore(
      emptyLearningState('guest', store.state.timezone),
      store.exportData()
    ).state;
    expect(restored.questions).toHaveLength(0);
  });
  it.each([
    ['12 + 8', '19', '计算 2 + 3。', '5'],
    ['-12 + -8', '-4', '计算 -2 + -3。', '-5'],
    ['-12 × 8', '96', '计算 -2 × 3。', '-6'],
    ['解不等式 -2*x+6>0', 'x>3', '在实数范围内解不等式 -x>0，写出完整解集。', 'x<0']
  ])('从%s的可靠错答独立建立基础小题；不显示答案、不升级原题掌握', async (goal, wrong, prompt, correct) => {
    const store = begin(goal),
      root = questionKey(store.activeQuestion),
      conversation = store.selectedConversationId;
    store.submit(wrong, true, 'original-wrong');
    await store.send('开始先修诊断', { id: 'diagnose' });
    expect(store.activeQuestion.prompt).toBe(prompt);
    expect(store.activeQuestion.prerequisite).toMatchObject({
      originalQuestionKey: root,
      conversationId: conversation,
      evidenceIds: ['original-wrong']
    });
    expect(store.activeQuestion.parentQuestionKey).toBeUndefined();
    expect(store.active.pendingHints).toHaveLength(0);
    expect(store.diagnosticProgress.status).toBe('waiting');
    const a = store.submit(correct, true, 'diagnostic-correct');
    expect(a.grade).toMatchObject({ status: 'reliable', outcome: 'correct' });
    expect(a.hints).toHaveLength(0);
    expect(store.diagnosticProgress).toMatchObject({ status: 'independent_correct' });
    expect(store.summary.mistakes.some((a) => a.id === 'original-wrong')).toBe(true);
    expect(store.summary.knowledge['数学 / ' + store.state.questions[0].knowledgePoint].evidenceIds).not.toContain(
      'diagnostic-correct'
    );
    expect(store.summary.tasks).toMatchObject({ numerator: 2, denominator: 2 });
  });
  it('指定教法保留；诊断后的原题变式绑定原题，提示不能变成独立成功', async () => {
    const store = begin(),
      root = questionKey(store.activeQuestion);
    await store.send('直接讲解');
    store.submit('19', true, 'wrong');
    await store.send('先修诊断', { id: 'diagnose' });
    expect(requestedTeachingMethod(store.state, store.selectedConversationId)).toBe('explain');
    await store.send('提示');
    store.submit('5', true, 'helped');
    expect(store.diagnosticProgress.status).toBe('helped_correct');
    expect(store.summary.tasks).toMatchObject({ numerator: 1, denominator: 2 });
    await store.send('独立检验原题', { id: 'check-original' });
    expect(store.activeQuestion.parentQuestionKey).toBe(root);
    expect(store.active.pendingHints).toHaveLength(0);
    const result = store.submit('12', true, 'transfer');
    expect(result).toMatchObject({ kind: 'variant', hints: [], grade: { status: 'reliable', outcome: 'correct' } });
    expect(observeTeaching(store.state).rows[0].followups.independentTransfer).toBe(1);
    expect(observeTeaching(store.state).rows[0].evidenceIds).not.toContain('helped');
  });
  it('无错答、争议、另一个对话、范围外或诊断题自身不生成无依据诊断', () => {
    const store = begin();
    expect(store.canDiagnose).toBe(false);
    store.submit('19', true, 'wrong');
    const original = store.activeQuestion;
    expect(createPrerequisiteQuestion('test', original, store.state.attempts, 'other')).toBeNull();
    store.correctAssessment('wrong', '原题待核对');
    expect(store.canDiagnose).toBe(false);
    expect(
      createPrerequisiteQuestion(
        'test',
        { ...original, uncertainties: [{ resolved: false }] },
        store.state.attempts,
        store.selectedConversationId
      )
    ).toBeNull();
    expect(
      createPrerequisiteQuestion(
        'test',
        { ...original, prerequisite: {} },
        store.state.attempts,
        store.selectedConversationId
      )
    ).toBeNull();
    expect(
      createPrerequisiteQuestion(
        'test',
        { ...original, prompt: '证明通用命题' },
        store.state.attempts,
        store.selectedConversationId
      )
    ).toBeNull();
  });
  it('备份/同步重验错答关联和独立判分；后续更正立即撤销诊断关联，旧任务分母保留', async () => {
    const store = begin();
    store.submit('19', true, 'wrong');
    await store.send('先修诊断', { id: 'diagnose' });
    store.submit('5', true, 'correct');
    const savedQuestion = JSON.parse(JSON.stringify(store.activeQuestion));
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
    for (const state of [restored, replay])
      expect(prerequisiteProgress(state, savedQuestion).status).toBe('independent_correct');
    store.correctAssessment('wrong', '原答有争议');
    expect(store.diagnosticProgress.status).toBe('pending');
    expect(store.summary.tasks.denominator).toBe(2);
    const afterCorrection = prepareLearningRestore(
      emptyLearningState('guest', store.state.timezone),
      store.exportData()
    ).state;
    expect(prerequisiteProgress(afterCorrection, savedQuestion).status).toBe('pending');
  });
  it('重复消息不建重复任务；停止状态拒绝生成，模型伪造引用或宽容度被共享reducer拒绝', async () => {
    const store = begin();
    store.submit('19', true, 'wrong');
    await store.send('先修诊断', { id: 'diagnose' });
    await store.send('先修诊断', { id: 'diagnose' });
    expect(store.state.questions).toHaveLength(2);
    expect(store.summary.tasks.denominator).toBe(2);
    const q = JSON.parse(JSON.stringify(store.activeQuestion));
    q.id = 'forged';
    q.validation.tolerance = 999;
    expect(() => store.commit('question.add', { question: q })).toThrow('真实错答');
    delete q.validation.tolerance;
    q.prerequisite.evidenceIds = ['missing'];
    expect(() => store.commit('question.add', { question: q })).toThrow('真实错答');
    await store.send('停止');
    expect(() => store.diagnosePrerequisite()).toThrow('停止');
    expect(() => store.generateVariant()).toThrow('停止');
  });
});
