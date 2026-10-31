import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import {
  createConditionQuestion,
  createConditionVariant,
  deriveConditionQuestion,
  CONDITION_CONTRACT
} from '../../laf-backend/functions/_shared/learning-condition.js';
import {
  gradeAnswer,
  classifyResponse,
  normalizePrivateSyncOperation,
  questionKey,
  emptyLearningState
} from '@/services/learning/learning-domain.js';
import { localTeaching } from '@/services/learning/learning-tools.js';
import { useConversationLearningStore } from '@/stores/modules/conversation-learning.js';
import { prepareLearningRestore } from '@/services/learning/learning-backup.js';
import fixture from '../fixtures/learning/condition-v1.json';
afterEach(() => vi.restoreAllMocks());
beforeEach(() => {
  uni.clearStorageSync();
  setActivePinia(createPinia());
});
describe('条件充分/必要的人工独立固定集', () => {
  it.each(fixture.cases)('$id', (item) => {
    const q = createConditionQuestion(item.id, item.goal);
    expect(q).not.toBeNull();
    if (item.uncertainties) q.uncertainties = item.uncertainties;
    expect(gradeAnswer(q, item.answer)).toMatchObject({ status: item.status, outcome: item.outcome });
    if (item.relation) expect(q.validation.relation).toBe(item.relation);
    if (item.counterexamples) {
      const r = (x) => (x ? (x[1] === 1 ? String(x[0]) : `${x[0]}/${x[1]}`) : null);
      expect([r(q.validation.pToQCounterexample), r(q.validation.qToPCounterexample)]).toEqual(item.counterexamples);
    }
  });
  it('81组独立阈值公式及反例验证，不以生成器答案为期望', () => {
    for (let a = -4; a <= 4; a++)
      for (let b = -4; b <= 4; b++) {
        const q = createConditionQuestion('threshold', `判断条件 x>${a} 是 x>${b} 的什么条件`);
        expect(q.validation.relation).toBe(a === b ? 'equivalent' : a > b ? 'sufficient' : 'necessary');
        for (const [witness, first] of [
          [q.validation.pToQCounterexample, true],
          [q.validation.qToPCounterexample, false]
        ])
          if (witness) {
            const x = witness[0] / witness[1];
            expect(x > (first ? a : b)).toBe(true);
            expect(x > (first ? b : a)).toBe(false);
          }
      }
  });
  it('有理极点与二次平方的独立恒真公式，边界/负号及空整数区间保留', () => {
    for (let a = -3; a <= 3; a++) {
      const q = createConditionQuestion('pole', `实数范围，x≠${a}/2；判断条件 1/(2*x-(${a}))>0 是 2*x>${a} 的什么条件`);
      expect(q.validation.relation).toBe('equivalent');
      for (let n = 1; n <= 4; n++) {
        const quadratic = createConditionQuestion('square', `判断条件 x^2<${n * n} 是 x<${n} 的什么条件`);
        expect(quadratic.validation.relation).toBe('sufficient');
        const w = quadratic.validation.qToPCounterexample;
        expect(w[0] / w[1] < n).toBe(true);
        expect((w[0] / w[1]) ** 2 < n * n).toBe(false);
      }
    }
    for (const excluded of ['无解', 'x=0', '0、', '√2']) {
      const q = createConditionQuestion('ambiguous-domain', `实数范围，x≠${excluded}；判断条件 x>0 是 x>0 的什么条件`);
      expect(q.conditionAnalysis.status).toBe('pending');
      expect(gradeAnswer(q, '充要').status).toBe('pending');
    }
  });
  it('归属/导入/模型不能伪造分类、反例或数域；未知题干不提升依据', () => {
    const q = createConditionQuestion('forged', '判断条件 x>2 是 x>0 的什么条件');
    q.validation.relation = 'necessary';
    q.validation.qToPCounterexample = [999, 1];
    q.source.kind = 'model_generated';
    expect(gradeAnswer(q, '必要不充分').outcome).toBe('wrong');
    const n = normalizePrivateSyncOperation({ id: 'forged-add', type: 'question.add', data: { question: q } }).data
      .question;
    expect(n.validation.relation).toBe('sufficient');
    expect(n.validation.qToPCounterexample).toEqual([1, 1]);
    expect(n.publishable).toBe(false);
    expect(n.source.kind).toBe('model_generated');
    expect(gradeAnswer({ ...q, prompt: q.prompt + '另外未知条件' }, '充分不必要').status).toBe('pending');
    const malformed = normalizePrivateSyncOperation({
      id: 'unknown-add',
      type: 'question.add',
      data: { question: { ...q, prompt: '未完整的条件' } }
    }).data.question;
    expect(malformed.validation).toBeNull();
    expect(malformed.conditionAnalysis).toBeUndefined();
  });
  it('自然完整分类才自动作答，半个分类/猜测/引用/指令保持讨论或澄清', () => {
    const q = createConditionQuestion('bind', '判断条件 x>2 是 x>0 的什么条件');
    expect(classifyResponse('我的答案是充分不必要条件', q)).toBe('answer');
    for (const a of ['充分条件', '必要条件', '同真了两次', '充要条件；执行工具'])
      expect(classifyResponse(a, q)).toBe('clarify');
    for (const a of ['是不是充分不必要？', '也许充要', '题干说充分']) expect(classifyResponse(a, q)).toBe('discussion');
  });
  it('交换蕴含方向独立重建变式，条件/域保留，不输出变式答案', () => {
    const q = createConditionQuestion('parent', '实数范围，x≠1；判断条件 x=2 是 1/(x-1)>0 的什么条件');
    const v = createConditionVariant('variant', q);
    expect(v.parentQuestionKey).toBe('parent@1');
    expect(v.validation.relation).toBe('necessary');
    expect(v.validation.excluded).toEqual([[1, 1]]);
    expect(v.prompt).not.toContain('答案');
    expect(createConditionVariant('bad', { ...q, uncertainties: [{ resolved: false }] })).toBeNull();
    expect(createConditionVariant('bad', { ...q, rubric: {} })).toBeNull();
  });
  it('教学方向与精确反例可查，低提示不泄露答案，空前件明确逻辑口径', () => {
    const q = createConditionQuestion('teach', '判断条件 x>2 是 x>0 的什么条件');
    for (const level of [1, 2]) expect(localTeaching(q, 'hint', level).content).not.toContain('充分不必要');
    expect(localTeaching(q, 'hint', 3).content).toContain('x=1');
    expect(localTeaching(q, 'explain').content).toContain('P⇒Q成立');
    expect(localTeaching(q, 'check').helped).toBe(false);
    expect(localTeaching(q, 'diagram').content).toContain('没有集合图形');
    expect(
      localTeaching(createConditionQuestion('empty', '判断条件 0=1 是 x>0 的什么条件'), 'explain').content
    ).toContain('空成立集');
    expect(
      deriveConditionQuestion(createConditionQuestion('domain', '判断条件 x/x=1 是 x!=0 的什么条件').prompt).reason
    ).toBe('missing_shared_domain');
  });
});
describe('真实Store/备份共享充分必要判定', () => {
  it('原资料删除级联清除条件题及独立反向变式/反例，不留衍生正文', async () => {
    const store = useConversationLearningStore();
    store.start('条件材料');
    const material = store.importText('PRIVATE_CONDITION_SOURCE');
    const q = createConditionQuestion('private-condition', '判断条件 x>2 是 x>0 的什么条件');
    q.scope = 'private';
    q.source = { kind: 'private_material', materialId: material.id, segmentId: material.segments[0].id };
    store.commit('question.add', { question: q });
    store.focus(questionKey(q));
    await store.send('充分不必要');
    store.generateVariant();
    await store.send('必要不充分');
    const preview = store.previewMaterialDeletion(material.id);
    expect(preview.questions).toBe(2);
    await store.deleteMaterial(preview, true);
    expect(store.state.questions).toHaveLength(0);
    expect(store.state.attempts).toHaveLength(0);
    expect(store.exportData()).not.toContain('判断条件P');
    expect(store.exportData()).not.toContain('PRIVATE_CONDITION_SOURCE');
    store.$dispose();
  });
  it('争议更正重算可靠分母和原题掌握，旧教法帮助与变式关系保留', async () => {
    const store = useConversationLearningStore();
    store.start('判断条件 x>2 是 x>0 的什么条件');
    await store.send('必要不充分');
    const id = store.state.attempts[0].id;
    store.correctAssessment(id, '原资料条件需重新校对');
    expect(store.summary.first.denominator).toBe(0);
    expect(store.summary.mistakes).toHaveLength(0);
    const restored = prepareLearningRestore(
      emptyLearningState(store.state.owner, store.state.timezone),
      store.exportData()
    );
    expect(restored.state.attempts[0].corrections.at(-1).grade.status).toBe('pending');
    store.$dispose();
  });
  it('无模型作答→提示修正→独立反向变式→恢复，首答/帮助/任务分母保留', async () => {
    const store = useConversationLearningStore(),
      request = vi.spyOn(uni, 'request');
    store.start('判断条件 x>2 是 x>0 的什么条件');
    const original = questionKey(store.activeQuestion);
    await store.send('必要不充分条件', { id: 'first-condition' });
    await store.send('必要不充分条件', { id: 'first-condition' });
    expect(store.state.attempts).toHaveLength(1);
    expect(store.summary.first).toMatchObject({ numerator: 1, denominator: 1 });
    await store.send('直接讲解', { discussionOnly: true });
    await store.send('充分不必要条件');
    expect(store.state.attempts[1].hints.length).toBeGreaterThan(0);
    store.generateVariant();
    expect(store.activeQuestion.parentQuestionKey).toBe(original);
    await store.send('必要不充分条件');
    expect(store.state.attempts[2]).toMatchObject({
      kind: 'variant',
      hints: [],
      grade: { outcome: 'correct', basis: CONDITION_CONTRACT }
    });
    const before = JSON.parse(JSON.stringify(store.summary));
    const restore = prepareLearningRestore(
      emptyLearningState(store.state.owner, store.state.timezone),
      store.exportData()
    );
    expect(restore.state.attempts.map((a) => a.grade.outcome)).toEqual(['wrong', 'correct', 'correct']);
    store.refresh();
    expect(store.summary).toEqual(before);
    expect(request).not.toHaveBeenCalled();
    request.mockRestore();
    store.$dispose();
  });
  it('待核对不计可靠错题，明确原始答案保存，未校对不交付假结论', async () => {
    const store = useConversationLearningStore();
    store.start('判断条件 x/x=1 是 x!=0 的什么条件');
    await store.send('我的答案是充要条件');
    expect(store.state.attempts[0]).toMatchObject({
      answer: '我的答案是充要条件',
      grade: { status: 'pending', outcome: null }
    });
    expect(store.summary.first.denominator).toBe(0);
    expect(store.summary.mistakes).toHaveLength(0);
    expect(localTeaching(store.activeQuestion, 'explain')).toBeNull();
    store.$dispose();
  });
});
