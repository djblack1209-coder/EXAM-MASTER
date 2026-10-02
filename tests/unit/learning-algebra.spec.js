import { beforeEach, describe, it, expect, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { mount } from '@vue/test-utils';
import fixture from '../fixtures/learning/algebra-v1.json';
import {
  parseAlgebraExpression,
  createAlgebraQuestion,
  createAlgebraVariant,
  algebraReferenceText,
  normalizeAlgebraQuestion,
  ALGEBRA_CONTRACT
} from '../../laf-backend/functions/_shared/learning-algebra.js';
import {
  gradeAnswer,
  classifyResponse,
  normalizePrivateSyncOperation,
  applyLearningOperation,
  emptyLearningState,
  summarizeLearning,
  questionKey
} from '@/services/learning/learning-domain.js';
import { localTeaching } from '@/services/learning/learning-tools.js';
import { learningRepository } from '@/services/learning/learning-repository.js';
import { prepareLearningRestore } from '@/services/learning/learning-backup.js';
import { useConversationLearningStore } from '@/stores/modules/conversation-learning.js';
import LearningOverview from '@/components/business/learning/learning-overview.vue';
const clone = (v) => JSON.parse(JSON.stringify(v));
beforeEach(() => {
  uni.clearStorageSync();
  setActivePinia(createPinia());
});
describe('精确代数的独立固定验题集', () => {
  it.each(fixture.cases)('$id', (item) => {
    const q = createAlgebraQuestion(item.id, item.goal);
    if (item.uncertainties) q.uncertainties = item.uncertainties;
    expect(gradeAnswer(q, item.answer)).toMatchObject({ status: item.status, outcome: item.outcome });
  });
  it('语法和资源限制：不拼接被空白隔开的数字，不执行命令，不接受无界计算', () => {
    for (const input of [
      '1 2',
      '1/2x',
      'x+y',
      'x**2',
      'x^2^3',
      'require("fs")',
      '1e99',
      '1/0',
      '0^0',
      '('.repeat(17) + '1' + ')'.repeat(17),
      '999999999^6',
      'x'.repeat(257)
    ])
      expect(() => parseAlgebraExpression(input)).toThrow();
    expect(parseAlgebraExpression('-x^2').numerator).toEqual([
      [0, 1],
      [0, 1],
      [-1, 1]
    ]);
    expect(parseAlgebraExpression('\\frac{\\frac{x}{2}+1}{3}').numerator).toEqual([
      [2, 1],
      [1, 1]
    ]);
    expect(parseAlgebraExpression('0.3').numerator).toEqual([[3, 10]]);
  });
  it('准确保留嵌套除法、零乘与零次幂的原定义域，不能因约分忘记', () => {
    for (const [goal, correct] of [
      ['化简 1/(x/x)', '1，x≠0'],
      ['化简 0*(1/x)', '0，x≠0'],
      ['化简 x^0', '1，x≠0']
    ]) {
      const q = createAlgebraQuestion('domain', goal);
      expect(gradeAnswer(q, correct).outcome).toBe('correct');
      expect(gradeAnswer(q, correct.split('，')[0]).basis).toBe('missing_domain_condition');
    }
  });
  it('同步和题目写入重新计算依据，不信任模型/导入/客户端伪造答案或权限', () => {
    const q = createAlgebraQuestion('proof', '解方程 x^2-5x+6=0');
    q.validation.solution.values = [[999, 1]];
    q.source = { kind: 'model_generated', reference: '999' };
    const operation = { id: 'proof', type: 'question.add', data: { question: q } };
    const normalized = normalizePrivateSyncOperation(operation).data.question;
    expect(normalized.validation.solution.values).toEqual([
      [2, 1],
      [3, 1]
    ]);
    expect(normalized.source.kind).toBe('model_generated');
    expect(normalized.publishable).toBe(false);
    const state = applyLearningOperation(emptyLearningState('guest'), operation).state;
    expect(state.questions[0].validation.solution.values).toEqual([
      [2, 1],
      [3, 1]
    ]);
    expect(gradeAnswer(q, '999').outcome).toBe('wrong');
    const unknown = normalizeAlgebraQuestion({ ...q, prompt: '计算秘密条件', algebra: { status: 'verified' } });
    expect(unknown.validation).toBeNull();
    expect(unknown.algebra).toBeUndefined();
    expect(normalizeAlgebraQuestion({ ...clone(q), prompt: q.prompt + '，但 x>2' }).validation).toBeNull();
  });
  it('自然明确的代数答案能自动记录，猜测、题干引用、反问继续作为讨论', () => {
    const q = createAlgebraQuestion('bind', '解方程 x^2=4');
    for (const answer of ['±2', 'x=-2或x=2', '{-2,2}']) expect(classifyResponse(answer, q)).toBe('answer');
    for (const answer of ['也许是2', '是不是2？', '题干是x^2=4'])
      expect(classifyResponse(answer, q)).toBe('discussion');
    expect(classifyResponse('我不懂', q)).toBe('clarify');
    expect(classifyResponse('sqrt(2)', q)).toBe('clarify');
  });
  it('变式改变任务方向/数域并有独立解与条件验证，不提前显示答案', () => {
    const parent = createAlgebraQuestion('original', '化简 (x^2-1)/(x-1)');
    const variant = createAlgebraVariant('variant', parent);
    expect(variant.parentQuestionKey).toBe('original@1');
    expect(variant.algebra.task).toBe('equation');
    expect(gradeAnswer(variant, '-1').outcome).toBe('correct');
    expect(gradeAnswer(variant, '-1,1').outcome).toBe('wrong');
    expect(variant.validationResult.verified).toBe(true);
    expect(variant.prompt).not.toContain('答案');
    const integer = createAlgebraQuestion('integer', '整数解方程 2*x=1');
    const real = createAlgebraVariant('real', integer);
    expect(real.variantChange).toContain('数域改变');
    expect(gradeAnswer(real, '1/2').outcome).toBe('correct');
    expect(createAlgebraVariant('unavailable', createAlgebraQuestion('unknown', '解方程 x^2=2'))).toBeNull();
  });
  it('分层提示和方法有实际内容，解题结果与例题各自区分，不虚构图形能力', () => {
    const q = createAlgebraQuestion('teach', '化简 (x^2-1)/(x-1)');
    expect(algebraReferenceText(q)).toBe('1*x+1，x≠1');
    expect(localTeaching(q, 'hint', 1).content).not.toContain('1*x+1');
    expect(localTeaching(q, 'hint', 2).content).not.toContain('1*x+1');
    expect(localTeaching(q, 'hint', 3).content).toContain('1*x+1');
    expect(
      new Set(
        ['explain', 'steps', 'question', 'example', 'analogy', 'prerequisite'].map((m) => localTeaching(q, m).content)
      ).size
    ).toBe(6);
    expect(localTeaching(q, 'diagram').content).toContain('没有函数图形渲染能力');
    expect(localTeaching(q, 'check').helped).toBe(false);
  });
  it('其他评分合同和选项不会被代数教学/变式擅自覆盖；无解题保持有效但不称有解', () => {
    const q = createAlgebraQuestion('empty', '解方程 x^2+1=0');
    expect(q.validationResult).toMatchObject({ verified: true, wellPosed: true, solvable: false });
    expect(createAlgebraVariant('unexpected', { ...q, rubric: { id: 'user-contract' } })).toBeNull();
    expect(localTeaching({ ...q, options: ['A. 无解'] }, 'explain')).toBeNull();
    expect(localTeaching({ ...q, rubric: { id: 'user-contract' } }, 'explain')).toBeNull();
  });
});
describe('从聊天到错题、计划、复习和同步的代数流程', () => {
  it('不配模型即可独立校验；重试、提示后修正、变式、刷新共用事实和首答口径', async () => {
    const store = useConversationLearningStore();
    store.start('化简 (x+1)^2');
    const original = questionKey(store.activeQuestion);
    const request = vi.spyOn(uni, 'request');
    await store.send('x^2+1', { id: 'first-turn' });
    await store.send('x^2+1', { id: 'first-turn' });
    expect(store.state.attempts).toHaveLength(1);
    expect(store.summary.mistakes).toHaveLength(1);
    await store.send('直接讲解');
    await store.send('x^2+2*x+1');
    expect(store.state.attempts[1]).toMatchObject({ kind: 'revision', grade: { outcome: 'correct' } });
    expect(store.state.attempts[1].hints).toHaveLength(1);
    store.generateVariant();
    expect(store.activeQuestion.parentQuestionKey).toBe(original);
    await store.send('-1');
    expect(store.state.attempts[2]).toMatchObject({ kind: 'variant', hints: [] });
    expect(store.summary.first).toMatchObject({ numerator: 1, denominator: 1 });
    expect(store.summary.tasks).toMatchObject({ numerator: 2, denominator: 2 });
    expect(request).not.toHaveBeenCalled();
    request.mockRestore();
    setActivePinia(createPinia());
    const refreshed = useConversationLearningStore();
    expect(refreshed.state.attempts).toHaveLength(3);
    const backup = prepareLearningRestore(
      emptyLearningState('guest', refreshed.state.timezone),
      refreshed.exportData()
    );
    expect(backup.state.attempts.map((a) => a.grade)).toEqual(refreshed.state.attempts.map((a) => a.grade));
    let replay = emptyLearningState('guest', refreshed.state.timezone);
    for (const e of refreshed.state.events)
      replay = applyLearningOperation(
        replay,
        normalizePrivateSyncOperation({ id: e.id, type: e.type, at: e.at, data: e.data })
      ).state;
    expect(summarizeLearning(replay).first).toEqual(refreshed.summary.first);
    expect(summarizeLearning(replay).tasks).toEqual(refreshed.summary.tasks);
    const wrapper = mount(LearningOverview, {
      global: {
        stubs: {
          view: { template: '<div><slot /></div>' },
          text: { template: '<span><slot /></span>' },
          BaseIcon: true
        }
      }
    });
    expect(wrapper.text()).toContain('1 / 1');
    wrapper.unmount();
  });
  it('缺定义域只保存待核对；明确补全不重复首答，实际检验和帮助不可混淆', async () => {
    const store = useConversationLearningStore();
    store.start('化简 (x^2-1)/(x-1)');
    await store.send('x+1');
    expect(store.summary.first.denominator).toBe(0);
    expect(store.summary.mistakes).toHaveLength(0);
    expect(store.active.messages.at(-1).content).toContain('还需补充');
    await store.send('x+1，x≠1');
    expect(store.state.attempts[1]).toMatchObject({ kind: 'redo', grade: { status: 'reliable', outcome: 'correct' } });
    expect(store.summary.first.denominator).toBe(0);
    expect(store.summary.knowledge['数学 / 代数等价与定义域'].status).toBe('待复测');
  });
  it('个人资料题目仍保留来源和未确认条件，不被符号工具绕过识别门禁', () => {
    const q = createAlgebraQuestion('private', '解方程 x^2=4');
    q.scope = 'private';
    q.source = { kind: 'material', materialId: 'paper', page: 3, region: [0, 0, 1, 1] };
    q.uncertainties = [{ field: '指数', resolved: false }];
    const store = useConversationLearningStore();
    store.start('识别校对');
    learningRepository.commit({ id: 'private', type: 'question.add', data: { question: q } });
    store.refresh();
    store.focus('private@1');
    const result = store.submit('±2', true);
    expect(result.grade).toMatchObject({ status: 'pending', basis: 'critical_input_uncertain' });
    expect(store.activeQuestion.source.page).toBe(3);
    expect(store.activeQuestion.publishable).toBe(false);
    expect(store.summary.mistakes).toHaveLength(0);
    expect(store.activeQuestion.validation.evidenceId).toBe(ALGEBRA_CONTRACT);
  });
});
