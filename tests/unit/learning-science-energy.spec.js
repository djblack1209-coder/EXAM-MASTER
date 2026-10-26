import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { mount } from '@vue/test-utils';
import {
  ENERGY_TEMPLATE,
  energyResult,
  visualRecipe,
  visualFrame,
  assertVisualOutputCapability
} from '../../laf-backend/functions/_shared/learning-visual.js';
import {
  createScienceQuestion,
  nextScienceInput,
  scienceVisualHelpContent
} from '../../laf-backend/functions/_shared/learning-science.js';
import { confirmedDiagramRecipe, diagramHelpContent } from '../../laf-backend/functions/_shared/learning-diagram.js';
import {
  emptyLearningState,
  applyLearningOperation,
  gradeAnswer,
  questionKey,
  normalizePrivateSyncOperation,
  learningCapabilitiesData
} from '@/services/learning/learning-domain.js';
import { useConversationLearningStore } from '@/stores/modules/conversation-learning.js';
import LearningLab from '@/pages/learning/components/learning-lab.vue';
vi.mock('@dcloudio/uni-app', () => ({ onHide: vi.fn(), onShow: vi.fn(), onBackPress: vi.fn() }));
const base = {
  template: ENERGY_TEMPLATE,
  massKg: 2,
  initialVelocityMps: 1,
  netForceN: 4,
  direction: 'right',
  physicalSeconds: 2
};
const copy = (x) => JSON.parse(JSON.stringify(x));
const button = (wrapper, text) => wrapper.findAll('button').find((b) => b.text() === text);
const stubs = {
  view: { template: '<div><slot /></div>' },
  text: { template: '<span><slot /></span>' },
  BaseIcon: true
};
beforeEach(() => {
  uni.clearStorageSync();
  setActivePinia(createPinia());
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-07T18:00:00Z'));
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

// 独立BigInt算式校验数值，不调用产品的运动/能量计算器。
const gcd = (a, b) => {
  a = a < 0n ? -a : a;
  b = b < 0n ? -b : b;
  while (b) [a, b] = [b, a % b];
  return a;
};
const frac = (n, d = 1n) => {
  const g = gcd(n, d),
    s = d < 0n ? -1n : 1n;
  return [(n / g) * s, (d / g) * s];
};
const number = (n) => {
  const [whole, decimal = ''] = String(n).split('.');
  return frac(BigInt(whole + decimal), 10n ** BigInt(decimal.length));
};
const plus = (a, b) => frac(a[0] * b[1] + b[0] * a[1], a[1] * b[1]);
const minus = (a, b) => plus(a, [-b[0], b[1]]);
const times = (a, b) => frac(a[0] * b[0], a[1] * b[1]);
const divide = (a, b) => frac(a[0] * b[1], a[1] * b[0]);
function oracle(input, step) {
  const m = number(input.massKg),
    u = number(input.initialVelocityMps),
    f = times(number(input.netForceN), [input.direction === 'left' ? -1n : 1n, 1n]),
    t = frac(BigInt(input.physicalSeconds * step), 24n);
  const a = divide(f, m),
    v = plus(u, times(a, t)),
    x = plus(times(u, t), divide(times(a, times(t, t)), [2n, 1n]));
  const initialKinetic = divide(times(m, times(u, u)), [2n, 1n]),
    finalKinetic = divide(times(m, times(v, v)), [2n, 1n]);
  return {
    work: times(f, x),
    initialKinetic,
    finalKinetic,
    kineticChange: minus(finalKinetic, initialKinetic),
    displacement: x,
    velocity: v
  };
}
describe('合力总功与动能的独立精确依据', () => {
  it.each([
    [base, [24, 1], [1, 1], [25, 1]],
    [
      { ...base, massKg: 1, initialVelocityMps: 4, netForceN: 2, direction: 'left', physicalSeconds: 3 },
      [-6, 1],
      [8, 1],
      [2, 1]
    ],
    [{ ...base, massKg: 3, initialVelocityMps: 2, netForceN: 7, direction: 'left' }, [14, 3], [6, 1], [32, 3]],
    [
      { ...base, massKg: 0.3, initialVelocityMps: 1, netForceN: 0.2, direction: 'left', physicalSeconds: 4 },
      [4, 15],
      [3, 20],
      [5, 12]
    ],
    [{ ...base, initialVelocityMps: -2, netForceN: 0, direction: 'none' }, [0, 1], [4, 1], [4, 1]],
    [{ ...base, initialVelocityMps: 0, netForceN: 0, direction: 'none' }, [0, 1], [0, 1], [0, 1]]
  ])('手算初末动能与带符号总功 %j', (input, work, initialKinetic, finalKinetic) => {
    expect(energyResult(input)).toMatchObject({ work, initialKinetic, finalKinetic, kineticChange: work });
    const q = createScienceQuestion('q', 'c', input);
    expect(q.scienceExercise.contract).toBe('science-transfer-v4');
    expect(q.options).toHaveLength(4);
    expect(new Set(q.options.map((o) => o.slice(3))).size).toBe(4);
    expect(gradeAnswer(q, q.validation.answer)).toMatchObject({
      status: 'reliable',
      outcome: 'correct',
      evaluator: 'deterministic-science-v4'
    });
    expect(gradeAnswer(q, 'ABCD'[('ABCD'.indexOf(q.validation.answer) + 1) % 4]).outcome).toBe('wrong');
    expect(gradeAnswer(q, '一般能量守恒都正确')).toMatchObject({ status: 'pending', outcome: null });
  });
  it('零功可有非零路程，反向速度不令动能为负', () => {
    const input = { ...base, massKg: 1, initialVelocityMps: 2, netForceN: 2, direction: 'left' },
      r = energyResult(input);
    expect(r).toMatchObject({
      work: [0, 1],
      displacement: [0, 1],
      distance: [2, 1],
      velocity: [-2, 1],
      initialKinetic: [2, 1],
      finalKinetic: [2, 1]
    });
  });
  it('400组边界/小数/双方向与2000帧由独立BigInt重算，能量非负、功不使用路程', () => {
    let cases = 0;
    for (const massKg of [0.1, 0.37, 3, 19.99])
      for (const initialVelocityMps of [-10, -1.25, 0, 3.75, 10])
        for (const netForceN of [0, 0.11, 12])
          for (const direction of netForceN ? ['left', 'right'] : ['none'])
            for (const physicalSeconds of [1, 3, 7, 10]) {
              const input = {
                  template: ENERGY_TEMPLATE,
                  massKg,
                  initialVelocityMps,
                  netForceN,
                  direction,
                  physicalSeconds
                },
                recipe = visualRecipe(input);
              for (const step of [0, 1, 12, 23, 24]) {
                const frame = visualFrame(recipe, step),
                  expected = oracle(input, step);
                for (const key of Object.keys(expected)) expect(frame.exact[key].map(BigInt)).toEqual(expected[key]);
                expect(frame.exact.finalKinetic[0]).toBeGreaterThanOrEqual(0);
                expect(frame.position).toBeGreaterThanOrEqual(frame.minimum);
                expect(frame.position).toBeLessThanOrEqual(frame.maximum);
              }
              const next = nextScienceInput(input);
              expect(next).not.toEqual(input);
              expect(createScienceQuestion('next', 'c', next).options).toHaveLength(4);
              cases++;
            }
    expect(cases).toBe(400);
  });
  it.each([
    { code: 'exec()' },
    { url: 'http://localhost' },
    { massKg: 0.09 },
    { massKg: 20.01 },
    { initialVelocityMps: 10.01 },
    { netForceN: -1 },
    { netForceN: 12.01 },
    { physicalSeconds: 0 },
    { physicalSeconds: 11 },
    { physicalSeconds: 1.5 },
    { direction: 'none' },
    { massKg: '2' }
  ])('拒绝越界或代码/网络参数 %j', (patch) => {
    expect(() => visualRecipe({ ...base, ...patch })).toThrow();
  });
  it('v1–v4和未知能力不能接纳新演示，v5不扩张其他权限', () => {
    const output = { tools: [{ name: 'visualize', arguments: base }] };
    for (const visualization of [
      undefined,
      'learning-visual-v1',
      'learning-visual-v2',
      'learning-visual-v3',
      'learning-visual-v4',
      'unknown'
    ])
      expect(() => assertVisualOutputCapability(output, learningCapabilitiesData({ visualization }))).toThrow();
    expect(
      assertVisualOutputCapability(output, learningCapabilitiesData({ visualization: 'learning-visual-v5' }))
    ).toBe(output);
    expect(learningCapabilitiesData({ visualization: 'unknown' })).not.toHaveProperty('visualization');
  });
});
describe('原图质量/运动范围与同题归属', () => {
  const source = {
    binding: { contract: 'learning-diagram-v1', owner: 'u', conversationId: 'c', questionKey: 'q@1' },
    stamp: 'page-revision-1',
    image: 'synthetic-page-reference'
  };
  const input = {
    explicit: true,
    binding: source.binding,
    sourceSnapshot: { stamp: source.stamp, image: source.image },
    template: ENERGY_TEMPLATE,
    massKg: '500',
    massUnit: 'g',
    initialVelocityMps: '200',
    velocityUnit: 'cm/s',
    velocityDirection: 'right',
    initialState: 'moving',
    forceKind: 'net_constant',
    netForceN: '1',
    forceUnit: 'N',
    direction: 'left',
    physicalSeconds: '2',
    timeUnit: 's',
    massKind: 'constant',
    motionKind: 'linear',
    bodyKind: 'particle',
    frameKind: 'inertial'
  };
  it('只从明确确认的不变质量/直线/合力与单位采用条件', () => {
    const recipe = confirmedDiagramRecipe(input, source);
    expect(recipe).toMatchObject({ contract: 'learning-visual-v5', massKg: 0.5, initialVelocityMps: 2 });
    expect(
      energyResult({
        template: recipe.template,
        massKg: recipe.massKg,
        initialVelocityMps: recipe.initialVelocityMps,
        netForceN: recipe.netForceN,
        direction: recipe.direction,
        physicalSeconds: recipe.physicalSeconds
      }).work
    ).toEqual([0, 1]);
    expect(diagramHelpContent(recipe, 3)).toContain('不变质量0.5kg');
  });
  it.each([
    { bodyKind: 'other' },
    { bodyKind: '' },
    { frameKind: 'other' },
    { frameKind: '' },
    { massKind: 'changing' },
    { massKind: '' },
    { motionKind: 'multidimensional' },
    { motionKind: '' },
    { forceKind: 'applied' },
    { forceKind: 'unknown' },
    { explicit: false },
    { sourceSnapshot: { stamp: 'changed', image: source.image } },
    { binding: { ...source.binding, owner: 'other' } },
    { code: 'eval()' }
  ])('未知/错源/单个力不能升级成净功条件 %j', (patch) => {
    expect(() => confirmedDiagramRecipe({ ...input, ...patch }, source)).toThrow();
  });
});
describe('功与动能事实、独立新题、原时区与停止', () => {
  it.each(['prompt', 'source', 'contract', 'input', 'conversation', 'options', 'authority', 'stripped'])(
    '规范和私人重放原子拒绝 %s',
    (kind) => {
      const state = applyLearningOperation(emptyLearningState('u'), {
        id: 'c',
        type: 'conversation.start',
        data: { goal: '功与动能' }
      }).state;
      const q = createScienceQuestion('q', 'c', base),
        before = copy(state);
      if (kind === 'prompt') q.prompt += '官方满分';
      if (kind === 'source') q.source.reference = 'official';
      if (kind === 'contract') q.scienceExercise.contract = 'science-transfer-v3';
      if (kind === 'input') q.scienceExercise.input.massKg = 3;
      if (kind === 'conversation') q.scienceExercise.conversationId = 'other';
      if (kind === 'options') q.options[0] = 'A. forged';
      if (kind === 'authority') q.expectedAnswer = 'A';
      if (kind === 'stripped') delete q.scienceExercise;
      const op = { id: 'add', type: 'question.add', data: { question: q } };
      expect(() => applyLearningOperation(state, op)).toThrow();
      expect(() => applyLearningOperation(state, normalizePrivateSyncOperation(op))).toThrow();
      expect(state).toEqual(before);
    }
  );
  it('明确开始/作答，观察不记掌握；独立/复测幂等，原时区提前/停止/私人重放保护', async () => {
    const store = useConversationLearningStore();
    store.commit('timezone.set', { timezone: 'America/Los_Angeles' });
    store.start('功与动能');
    const original = copy(store.activeQuestion);
    expect(original.scienceExercise.input).toEqual(base);
    expect(store.recordScienceHelp(store.writingContext(), base)).toBe(true);
    expect(store.active.pendingHints[0].content).toBe(scienceVisualHelpContent(base));
    expect(store.state.attempts).toEqual([]);
    expect(store.state.reviews).toEqual([]);
    store.submit('B', false);
    expect(store.state.attempts).toEqual([]);
    store.submit('B', true, 'helped-wrong');
    expect(store.state.attempts[0].grade.outcome).toBe('wrong');
    const before = copy(store.state.attempts);
    store.startScience(store.writingContext(), base);
    expect(store.activeQuestion.parentQuestionKey).toBe(questionKey(original));
    expect(store.active.pendingHints).toEqual([]);
    store.submit(store.activeQuestion.validation.answer, true, 'independent-correct');
    expect(store.state.attempts.slice(0, 1)).toEqual(before);
    expect(store.state.attempts[1].hints).toEqual([]);
    const plan = store.scheduleScienceRetest(),
      saved = store.exportData();
    expect(store.scheduleScienceRetest()).toEqual(plan);
    expect(store.exportData()).toBe(saved);
    store.focus(plan.questionKey);
    const future = copy(store.activeQuestion);
    expect(future.scienceExercise).toMatchObject({ dueDay: '2026-10-08', plannedTimezone: 'America/Los_Angeles' });
    store.commit('timezone.set', { timezone: 'UTC' });
    vi.setSystemTime(new Date('2026-10-08T06:30:00Z'));
    const early = store.exportData();
    expect(() => store.submit(future.validation.answer, true)).toThrow('复测日期');
    expect(store.exportData()).toBe(early);
    vi.setSystemTime(new Date('2026-10-08T07:00:00Z'));
    store.submit(future.validation.answer, true, 'due-correct');
    await store.send('停止当前任务');
    const stopped = store.exportData();
    expect(() => store.recordScienceHelp(store.writingContext(), base)).toThrow('停止');
    expect(() => store.startScience(store.writingContext(), base)).toThrow('停止');
    expect(store.exportData()).toBe(stopped);
    let replay = emptyLearningState(store.state.owner, 'America/Los_Angeles');
    for (const event of store.state.events)
      replay = applyLearningOperation(replay, normalizePrivateSyncOperation(copy(event))).state;
    expect(replay.attempts).toEqual(store.state.attempts);
    expect(replay.reviews).toEqual(store.state.reviews);
    expect(replay.conversations[0].stopped).toBe(true);
  });
  it('实际演示选择/预测不写事实，逐步观察先存帮助，结束不记原答；独立动作才换题', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn()
      }))
    );
    const store = useConversationLearningStore();
    store.start('功与动能');
    const wrapper = mount(LearningLab, {
      props: {
        state: store.state,
        question: store.activeQuestion,
        context: store.writingContext(),
        recordScienceHelp: (...args) => store.recordScienceHelp(...args),
        onScience: (...args) => store.startScience(...args)
      },
      global: { stubs }
    });
    try {
      const before = store.exportData();
      await button(wrapper, '互动学习').trigger('tap');
      await button(wrapper, '我猜会').trigger('tap');
      expect(store.exportData()).toBe(before);
      for (let step = 0; step < 24; step++) await button(wrapper, '逐步观察').trigger('tap');
      expect(store.active.pendingHints).toHaveLength(1);
      expect(store.state.attempts).toEqual([]);
      expect(store.state.reviews).toEqual([]);
      expect(wrapper.find('[aria-label="功与动能读数"]').text()).toContain('合力总功 24 J');
      expect(wrapper.find('[aria-label="功与动能读数"]').text()).toContain('当前动能 25 J');
      const original = questionKey(store.activeQuestion);
      await button(wrapper, '独立检验').trigger('tap');
      expect(questionKey(store.activeQuestion)).not.toBe(original);
      expect(store.active.pendingHints).toEqual([]);
      await wrapper.setProps({ state: store.state, question: store.activeQuestion, context: store.writingContext() });
      expect(button(wrapper, '独立检验')).toBeUndefined();
      store.commit('task.stop', { conversationId: store.active.id });
      await wrapper.setProps({ stopped: true });
      const stopped = store.exportData();
      await button(wrapper, '互动学习').trigger('tap');
      expect(store.exportData()).toBe(stopped);
    } finally {
      wrapper.unmount();
    }
  });
});
