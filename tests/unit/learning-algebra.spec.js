import { beforeEach, describe, it, expect, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { mount } from '@vue/test-utils';
import fixture from '../fixtures/learning/algebra-v1.json';
import * as algebra from '../../laf-backend/functions/_shared/learning-algebra.js';
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
vi.mock('@dcloudio/uni-app', () => ({ onShow: vi.fn(), onHide: vi.fn(), onBackPress: vi.fn() }));
const clone = (v) => JSON.parse(JSON.stringify(v));
describe('显式单未知量方程沿独立版本完成作答与接续', () => {
  it('旧导入的相同题干没有新合同标记时保持待核对，不因重放取得评分权威', () => {
    const legacy = createAlgebraQuestion('legacy-named', '解关于 t 的方程 2*t+3=9');
    legacy.source = { kind: 'model_generated' };
    legacy.validation = null;
    legacy.validationResult = { verified: false, wellPosed: false, solvable: null, evidenceId: ALGEBRA_CONTRACT };
    delete legacy.algebra;
    const normalized = normalizePrivateSyncOperation({
      id: 'old-named',
      type: 'question.add',
      data: { question: legacy }
    }).data.question;
    expect(normalized.validation).toBeNull();
    expect(normalized.algebra).toBeUndefined();
    expect(gradeAnswer(normalized, 't=3').status).toBe('pending');
    expect(algebraReferenceText(normalized)).toBeNull();
    expect(createAlgebraVariant('old-variant', normalized)).toBeNull();
    expect(localTeaching(normalized, 'explain')).toBeNull();
  });
  it.each([
    ['解关于 t 的方程 2*t+3=9', 't=3', 'correct'],
    ['解关于 y 的方程 y^2=4', 'y=-2或y=2', 'correct'],
    ['解关于 y 的方程 y^2=4', 'y=2', 'partial'],
    ['解关于 z 的方程 (z^2-1)/(z-1)=0', 'z=-1', 'correct'],
    ['解关于 z 的方程 (z^2-1)/(z-1)=0', 'z=-1或z=1', 'wrong'],
    ['整数解关于 n 的方程 2*n=1', '无解', 'correct'],
    ['正数解关于 a 的方程 a^2=4', 'a=2', 'correct'],
    ['解关于 f 的方程 \\frac{f}{2}=3', 'f=6', 'correct'],
    ['解关于 r 的方程 r=\\frac{1}{2}', 'r=\\frac{1}{2}', 'correct'],
    ['解关于 t 的方程 t/t=1', '任意实数，t≠0', 'correct']
  ])('%s保留所声明的符号与精确数域', (goal, answer, outcome) => {
    const q = createAlgebraQuestion('named', goal);
    expect(q.algebra).toMatchObject({ contract: algebra.NAMED_EQUATION_CONTRACT, status: 'verified' });
    expect(gradeAnswer(q, answer)).toMatchObject({
      status: 'reliable',
      outcome,
      basis: algebra.NAMED_EQUATION_CONTRACT
    });
    expect(q.prompt).not.toContain('关于 x');
  });
  it('未知量不能暗换为x，多变量、无理根及超限继续待核对，旧合同不扩大', () => {
    const q = createAlgebraQuestion('named', '解关于 t 的方程 2*t+3=9');
    expect(gradeAnswer(q, 'x=3')).toMatchObject({ status: 'pending', basis: 'answer_variable_mismatch' });
    expect(classifyResponse('t=3', q)).toBe('answer');
    expect(classifyResponse('是不是t=3？', q)).not.toBe('answer');
    for (const expression of ['t+y=3', 'x+t=3', 't^2=2', 't/0=1', `${'('.repeat(17)}t${')'.repeat(17)}=1`]) {
      const unsupported = createAlgebraQuestion('unsupported', `解关于 t 的方程 ${expression}`);
      expect(unsupported.validation).toBeNull();
      expect(gradeAnswer(unsupported, 't=3').status).toBe('pending');
    }
    const old = createAlgebraQuestion('old', '解方程 2*t+3=9');
    expect(old.algebra.contract).toBe(ALGEBRA_CONTRACT);
    expect(old.validation).toBeNull();
    expect(createAlgebraQuestion('legacy', '解方程 x=3').algebra.contract).toBe(ALGEBRA_CONTRACT);
  });
  it('同步重算原方程与符号，不接收伪造解或符号；未确认原资料与用户量表仍优先', () => {
    const q = createAlgebraQuestion('named', '解关于 t 的方程 t^2=4');
    q.validation.solution.values = [[999, 1]];
    q.algebra.symbol = 'y';
    const normalized = normalizePrivateSyncOperation({
      id: 'named-import',
      type: 'question.add',
      data: { question: q }
    }).data.question;
    expect(normalized.algebra.symbol).toBe('t');
    expect(gradeAnswer(normalized, 't=-2或t=2').outcome).toBe('correct');
    expect(gradeAnswer({ ...normalized, uncertainties: [{ field: '未知量', resolved: false }] }, 't=2').status).toBe(
      'pending'
    );
    expect(gradeAnswer({ ...normalized, rubric: { id: 'user-rubric' } }, 't=2').status).toBe('pending');
    expect(gradeAnswer({ ...normalized, options: ['A. 2'] }, 't=2').status).toBe('pending');
  });
  it('参考中的限制用原符号；平移变式与数域变式独立重算', () => {
    const q = createAlgebraQuestion('named', '解关于 t 的方程 t/t=1');
    expect(algebraReferenceText(q)).toBe('任意实数，t≠0');
    const translated = createAlgebraVariant('shift', createAlgebraQuestion('named', '解关于 t 的方程 2*t+3=9'));
    expect(translated.parentQuestionKey).toBe('named@1');
    expect(translated.prompt).toContain('(t+1)');
    expect(gradeAnswer(translated, 't=2').outcome).toBe('correct');
    expect(gradeAnswer(translated, 't=3').outcome).toBe('wrong');
    const real = createAlgebraVariant('real', createAlgebraQuestion('integer', '整数解关于 n 的方程 2*n=1'));
    expect(gradeAnswer(real, 'n=1/2').outcome).toBe('correct');
    expect(createAlgebraVariant('constant', createAlgebraQuestion('constant', '解关于 t 的方程 1=1'))).toBeNull();
  });
  it('聊天提交、帮助后订正、无提示变式和普通仓库重开共用事实，零网络调用', async () => {
    const store = useConversationLearningStore();
    const request = vi.spyOn(uni, 'request');
    store.start('解关于 t 的方程 2*t+3=9');
    expect(store.state.attempts).toHaveLength(0);
    await store.submit('t=4', true, 'named-first:answer');
    await store.submit('t=4', true, 'named-first:answer');
    expect(store.state.attempts).toHaveLength(1);
    expect(store.state.attempts[0]).toMatchObject({ answer: 't=4', grade: { outcome: 'wrong' } });
    await store.send('直接讲解', { discussionOnly: true });
    await store.submit('t=3', true);
    expect(store.state.attempts[1]).toMatchObject({ answer: 't=3', grade: { outcome: 'correct' } });
    expect(store.state.attempts[1].hints).toHaveLength(1);
    store.generateVariant();
    await store.submit('t=2', true);
    expect(store.state.attempts[2]).toMatchObject({ kind: 'variant', hints: [], grade: { outcome: 'correct' } });
    const before = clone(store.state);
    setActivePinia(createPinia());
    const reopened = useConversationLearningStore();
    expect(reopened.state.attempts).toEqual(before.attempts);
    expect(reopened.state.events).toEqual(before.events);
    expect(request).not.toHaveBeenCalled();
    request.mockRestore();
  });
});
beforeEach(() => {
  uni.clearStorageSync();
  setActivePinia(createPinia());
});
describe('模型计算核对的精确格式与作答规则隔离', () => {
  const check = (raw, unit = '') => (algebra.parseExactModelNumberCheck || algebra.parseExactNumberAnswer)(raw, unit);
  it('真实归档模型的带分数百分数与100/3%精确相等，不要求再次生成同一数学值', () => {
    const modelLine = '计算核对：33 1/3%';
    const raw = modelLine.match(/(?:^|\n)计算核对[：:]\s*([^\n]+)\s*$/)[1];
    expect(check(raw, '%')).toEqual([100, 3]);
    expect(check(raw, '%')).toEqual(algebra.parseExactNumberAnswer('100/3%', '%'));
    expect(algebra.parseExactNumberAnswer(raw, '%')).toBeNull();
  });
  it.each([
    ['-1 1/2', [-3, 2]],
    ['+1 1/2', [3, 2]],
    ['0 1/2', [1, 2]],
    ['-0 1/2', [-1, 2]],
    ['33\u00a01/3', [100, 3]],
    ['33\u202f1/3', [100, 3]],
    ['2\t1 / 4', [9, 4]],
    ['0002 01/04', [9, 4]]
  ])('有界单值%s只在模型核对入口支持', (input, expected) => {
    expect(check(input)).toEqual(expected);
    expect(algebra.parseExactNumberAnswer(input)).toBeNull();
  });
  it.each([
    '1 0/2',
    '1 2/2',
    '1 3/2',
    '1 1/0',
    '1 -1/2',
    '1 1/-2',
    '1.5 1/2',
    '1 1.5/2',
    '1\n1/2',
    '1 1/2+1',
    '1e3 1/2',
    '33 1/3≈33.3',
    '33 1/3%',
    '999999999 1/999999999',
    '9'.repeat(257)
  ])('无单位模式拒绝歧义或超限%s', (raw) => expect(check(raw)).toBeNull());
  it('单位必须明确，缺单位、双单位、错误百分数或缺模型核对行不补齐', () => {
    expect(check('33 1/3', '%')).toBeNull();
    expect(check('33 1/3%%', '%')).toBeNull();
    expect(check('33 1/3％', '%')).toBeNull();
    expect(check('33 1/3%', 'kg')).toBeNull();
    expect(check('33.3%', '%')).toEqual([333, 10]);
    expect(check('33.3%', '%')).not.toEqual([100, 3]);
    expect('没有核对行'.match(/(?:^|\n)计算核对[：:]\s*([^\n]+)\s*$/)).toBeNull();
  });
  it('真正的最后单行核对入口接纳带分数，标签和值跨行、缺行或多个核对值均拒绝', () => {
    expect(algebra.extractExactModelNumberCheck('解释。\n计算核对：33 1/3%\n')).toEqual({
      raw: '33 1/3%',
      exact: [100, 3]
    });
    expect(algebra.extractExactModelNumberCheck('解释。\r\n计算核对:100/3%\r\n')).toEqual({
      raw: '100/3%',
      exact: [100, 3]
    });
    for (const message of [
      '计算核对：\n100/3%',
      '计算核对：\r\n100/3%',
      '正文计算核对：100/3%',
      '计算核对：100/3%\n还有文字',
      '没有核对行',
      '计算核对：100/3%\n计算核对：100/3%',
      '计算核对：33.3%（约）',
      '计算核对：100/3',
      '计算核对：\u2028100/3%',
      '计算核对：100/3%\r后续',
      'x'.repeat(8001)
    ])
      expect(algebra.extractExactModelNumberCheck(message)).toBeNull();
  });
  it('真实新响应33⅓%按完整字符解析，不把NFKC展开结果331⁄3当作数值', () => {
    expect(algebra.extractExactModelNumberCheck('计算核对：33⅓%')).toEqual({
      raw: '33⅓%',
      exact: [100, 3]
    });
    expect(check('33⅓%', '%')).not.toEqual([331, 3]);
    expect(algebra.parseExactNumberAnswer('33⅓%', '%')).toBeNull();
    for (const [input, expected] of [
      ['½', [1, 2]],
      ['-½', [-1, 2]],
      ['-33⅓', [-100, 3]],
      ['33 ⅓', [100, 3]],
      ['+2¾', [11, 4]],
      ['0⅔', [2, 3]],
      ['1⅐', [8, 7]]
    ])
      expect(check(input)).toEqual(expected);
    for (const input of ['33⅓⅓', '⅓33', '33⅓/2', '⅟3', '+ ⅓', '33⁄3', '999999999⅐']) expect(check(input)).toBeNull();
  });
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
    await store.send('直接讲解', { discussionOnly: true });
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
