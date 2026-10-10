import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { createPinia, setActivePinia } from 'pinia';
import { mount, flushPromises } from '@vue/test-utils';
import { useConversationLearningStore } from '@/stores/modules/conversation-learning.js';
import {
  emptyLearningState,
  applyLearningOperation,
  normalizePrivateSyncOperation,
  learningCapabilitiesData
} from '@/services/learning/learning-domain.js';
import {
  visualRecipe,
  visualFrame,
  velocityGraphResult,
  assertVisualOutputCapability
} from '../../laf-backend/functions/_shared/learning-visual.js';
import {
  createScienceQuestion,
  gradeScienceAnswer,
  nextScienceInput
} from '../../laf-backend/functions/_shared/learning-science.js';
import { sourceDiagram, confirmedDiagramRecipe } from '../../laf-backend/functions/_shared/learning-diagram.js';
import { executeLearningTool } from '@/services/learning/learning-tools.js';
import { parseLearningOutput } from '../../laf-backend/functions/_shared/ai-providers/learning-provider.ts';
import LearningLab from '@/components/business/learning/learning-lab.vue';
import DiagramConditions from '@/components/business/learning/diagram-conditions.vue';
import VelocityTimeGraph from '@/components/business/learning/velocity-time-graph.vue';
vi.mock('@dcloudio/uni-app', () => ({ onHide: vi.fn() }));
const input = (pairs) => ({
  template: 'velocity_time_graph',
  points: pairs.map(([time, velocity]) => ({ time, velocity }))
});
const graph = input([
  [0, 2],
  [3, -1],
  [5, -1],
  [8, 2]
]);
const clone = (value) => JSON.parse(JSON.stringify(value));
const stubs = {
  view: { template: '<div><slot /></div>' },
  text: { template: '<span><slot /></span>' },
  BaseIcon: true
};
const button = (wrapper, label) => wrapper.findAll('button').find((b) => b.text().trim() === label);
let stores;
beforeEach(() => {
  uni.clearStorageSync();
  setActivePinia(createPinia());
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-06T09:00:00Z'));
  stores = [];
});
afterEach(() => {
  stores.forEach((s) => s.$dispose());
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
function setup() {
  const store = useConversationLearningStore();
  stores.push(store);
  store.start('学习物理');
  store.commit('timezone.set', { timezone: 'America/Los_Angeles' });
  store.startScience(store.writingContext(), graph);
  return store;
}
function privateSource() {
  const state = emptyLearningState('graph-owner', 'America/Los_Angeles'),
    bytes = Buffer.alloc(24);
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82]).copy(bytes);
  bytes.writeUInt32BE(100, 16);
  bytes.writeUInt32BE(100, 20);
  const image = `data:image/png;base64,${bytes.toString('base64')}`;
  state.materials = [
    {
      id: 'graph-material',
      name: '合成图形绑定夹具',
      kind: 'image',
      fingerprint: 'graph-source-v1',
      extractionVersion: 'graph-v1',
      segments: [
        {
          id: 's',
          content: '速度图折点（0s,2m/s）、（3s,-1m/s），相邻折点之间为直线。',
          preview: image,
          page: 1,
          extractionVersion: 'graph-v1',
          extractionEventId: 'graph-extraction'
        }
      ]
    }
  ];
  state.questions = [
    {
      id: 'q',
      version: 1,
      scope: 'private',
      prompt: '读速度—时间图。',
      subject: '物理',
      source: {
        kind: 'private_material',
        materialId: 'graph-material',
        segmentId: 's',
        page: 1,
        extractionVersion: 'graph-v1',
        extractionEventId: 'graph-extraction'
      }
    }
  ];
  state.conversations = [{ id: 'c', goal: '学习物理', activeQuestionKey: 'q@1', stopped: false }];
  const source = sourceDiagram(state, state.questions[0], 'c');
  return {
    state,
    source,
    confirmation: {
      explicit: true,
      binding: source.binding,
      sourceSnapshot: { stamp: source.stamp, image: source.image },
      template: 'velocity_time_graph',
      points: [
        { time: '0', velocity: '200' },
        { time: '3000', velocity: '-100' }
      ],
      timeUnit: 'ms',
      velocityUnit: 'cm/s',
      positiveDirection: 'right',
      lineKind: 'linear'
    }
  };
}
describe('速度图面积的独立精确依据', () => {
  it.each([
    [
      [
        [0, 2],
        [3, -1]
      ],
      [5, 2],
      [3, 2],
      [2, 1],
      [1, 2]
    ],
    [
      [
        [0, 1],
        [1, -2]
      ],
      [5, 6],
      [-1, 2],
      [1, 6],
      [2, 3]
    ],
    [
      [
        [0, 0.5],
        [0.5, -0.25]
      ],
      [5, 48],
      [1, 16],
      [1, 12],
      [1, 48]
    ],
    [
      [
        [0, -2],
        [4, -2]
      ],
      [8, 1],
      [-8, 1],
      [0, 1],
      [8, 1]
    ],
    [
      [
        [0, 0],
        [2, 0]
      ],
      [0, 1],
      [0, 1],
      [0, 1],
      [0, 1]
    ],
    [
      [
        [0, 1],
        [2, 0],
        [4, -1],
        [5, 1]
      ],
      [5, 2],
      [0, 1],
      [5, 4],
      [5, 4]
    ],
    [
      [
        [0, 2],
        [3, -1],
        [5, -1],
        [8, 2]
      ],
      [7, 1],
      [1, 1],
      [4, 1],
      [3, 1]
    ]
  ])('手算折点 %j，过零拆分而非取总面积绝对值', (pairs, distance, displacement, positiveArea, negativeArea) => {
    const value = input(pairs),
      result = velocityGraphResult(value),
      recipe = visualRecipe(value);
    expect(result).toMatchObject({ distance, displacement, positiveArea, negativeArea });
    expect(visualFrame(recipe, 24).exact).toMatchObject(result);
    const q = createScienceQuestion('graph-q', 'c', value);
    expect(new Set(q.options).size).toBe(4);
    expect(gradeScienceAnswer(q, q.validation.answer)).toMatchObject({
      status: 'reliable',
      outcome: 'correct',
      basis: 'science-transfer-v3'
    });
    expect(gradeScienceAnswer(q, 'ABCD'[('ABCD'.indexOf(q.validation.answer) + 1) % 4]).outcome).toBe('wrong');
  });
  it('折点边界采用右侧斜率；静止、瞬间过零和最后终点不多算面积', () => {
    const r = visualRecipe(
      input([
        [0, 2],
        [3, -1],
        [6, -1]
      ])
    );
    expect(visualFrame(r, 8)).toMatchObject({ time: 2, speed: 0, exact: { distance: [2, 1], displacement: [2, 1] } });
    expect(visualFrame(r, 12)).toMatchObject({ time: 3, speed: -1, acceleration: 0, phaseIndex: 1 });
    expect(visualFrame(r, 0).areas).toEqual([]);
  });
  it('复制/冻结折点和规范化帧，外部修改不能改变可判分条件', () => {
    const original = clone(graph),
      r = visualRecipe(original);
    original.points[0].velocity = 20;
    expect(r.points[0].velocity).toBe(2);
    expect(() => {
      r.points[0].velocity = 20;
    }).toThrow();
    expect(visualFrame({ ...r, physicalSeconds: 100000, steps: 5000 }, 24).time).toBe(8);
    expect(() => visualFrame(r, 25)).toThrow();
  });
  it.each([
    { ...graph, code: 'exec()' },
    { ...graph, url: 'http://127.0.0.1' },
    input([
      [1, 2],
      [3, 2]
    ]),
    input([
      [0, 1],
      [0, 2]
    ]),
    input([
      [0, 1],
      [2, 2],
      [1, 3]
    ]),
    input([[0, 1]]),
    input([
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
      [4, 5]
    ]),
    input([
      [0, 1],
      [11, 2]
    ]),
    input([
      [0, 1],
      [1, 20.01]
    ]),
    input([
      [0, -20.01],
      [1, 2]
    ]),
    input([
      [0, 0.001],
      [1, 2]
    ]),
    input([
      [0, 1],
      [0.001, 2]
    ]),
    input([
      [0, 1],
      [1, Infinity]
    ]),
    input([
      [0, '1'],
      [1, 2]
    ]),
    { ...graph, points: [{ ...graph.points[0], unit: 'm' }, graph.points[1]] }
  ])('未知字段、缺失数据、曲线资源或范围越界拒绝 %j', (value) => expect(() => visualRecipe(value)).toThrow());
  it('旧三代客户端拒绝新图形，v4兼容旧图形并保持受限工具/指定教法', () => {
    const call = { name: 'visualize', arguments: graph },
      output = { message: '预测后观察。', tools: [call] };
    for (const version of ['learning-visual-v1', 'learning-visual-v2', 'learning-visual-v3', 'future'])
      expect(() => assertVisualOutputCapability(output, { visualization: version })).toThrow();
    expect(
      assertVisualOutputCapability(output, learningCapabilitiesData({ visualization: 'learning-visual-v4' }))
    ).toBe(output);
    const parsed = parseLearningOutput(JSON.stringify(output));
    expect(parsed.tools[0].arguments).toEqual(graph);
    const store = setup(),
      commit = vi.fn(),
      context = {
        permissions: ['read'],
        calls: 0,
        maxCalls: 1,
        deadline: Date.now() + 1000,
        conversationId: store.active.id,
        origin: 'model'
      };
    expect(executeLearningTool({ read: () => store.state, commit }, call, context).result.contract).toBe(
      'learning-visual-v4'
    );
    expect(commit.mock.calls[0][0].type).toBe('execution.record');
    expect(() =>
      executeLearningTool({ read: () => store.state, commit }, call, { ...context, calls: 0, lockedMethod: 'steps' })
    ).toThrow('指定');
  });
  it('旧6配方/150帧/12原题与判分结果逐字冻结', () => {
    const inputs = [
      { template: 'distance_displacement', outward: 6, backward: 4 },
      { template: 'distance_displacement', outward: 8, backward: 6, direction: 'left' },
      { template: 'constant_net_force', massKg: 2, netForceN: 4, direction: 'right' },
      { template: 'constant_net_force', massKg: 4, netForceN: 0, direction: 'none' },
      {
        template: 'accelerated_motion',
        massKg: 0.5,
        netForceN: 0.25,
        direction: 'right',
        initialVelocityMps: -1,
        physicalSeconds: 4
      },
      {
        template: 'changing_net_force',
        massKg: 1,
        initialVelocityMps: -1,
        segments: [
          { seconds: 2, netForceN: 1, direction: 'right' },
          { seconds: 2, netForceN: 0, direction: 'none' },
          { seconds: 2, netForceN: 0.5, direction: 'right' }
        ]
      }
    ];
    const result = inputs.map((input, i) => {
      const recipe = visualRecipe(input);
      return {
        input,
        recipe,
        frames: Array.from({ length: 25 }, (_, s) => visualFrame(recipe, s)),
        questions: [null, { day: '2026-10-06', timezone: 'America/Los_Angeles' }].map((planning, j) => {
          const q = createScienceQuestion(
            'old-graph-check-' + i + '-' + j,
            'old-conversation',
            input,
            j ? 'parent@1' : null,
            planning
          );
          return { question: q, grade: gradeScienceAnswer(q, q.validation.answer) };
        })
      };
    });
    expect(createHash('sha256').update(JSON.stringify(result)).digest('hex')).toBe(
      '71950cfdd0573591b4c6170b5876a9833b219746cc7c84d3085725e230dc6071'
    );
  });
  it('伪造条件/题面/选项/来源不能借缓存答案可靠判分', () => {
    const q = createScienceQuestion('graph-q', 'c', graph);
    for (const mutate of [
      (v) => (v.scienceExercise.input.points[0].velocity = 3),
      (v) => (v.scienceExercise.contract = 'science-transfer-v2'),
      (v) => (v.prompt = '官方题'),
      (v) => (v.options[0] = 'A. 伪造'),
      (v) => (v.source.kind = 'official'),
      (v) => (v.scienceExercise.input.points[0].area = 1)
    ]) {
      const forged = clone(q);
      mutate(forged);
      expect(gradeScienceAnswer(forged, q.validation.answer).status).toBe('pending');
    }
  });
});
describe('原图轴单位和确认边界', () => {
  it('明确ms/cm/s和正方向后才换算，原图/当前题目与源快照绑定', () => {
    const { source, confirmation } = privateSource();
    expect(confirmedDiagramRecipe(confirmation, source).points).toEqual(
      input([
        [0, 2],
        [3, -1]
      ]).points
    );
    expect(confirmedDiagramRecipe({ ...confirmation, positiveDirection: 'left' }, source).points).toEqual(
      input([
        [0, -2],
        [3, 1]
      ]).points
    );
  });
  it.each([
    { explicit: false },
    { timeUnit: '' },
    { velocityUnit: 'm' },
    { positiveDirection: 'unknown' },
    { lineKind: 'curve' },
    { lineKind: 'unknown' },
    {
      points: [
        { time: '0', velocity: '1' },
        { time: '0', velocity: '2' }
      ]
    },
    {
      points: [
        { time: '-1', velocity: '1' },
        { time: '3000', velocity: '2' }
      ]
    },
    {
      points: [
        { time: '0', velocity: '1e2' },
        { time: '3000', velocity: '2' }
      ]
    },
    { binding: { owner: 'other' } },
    { sourceSnapshot: { stamp: 'other', image: 'data:image/png;base64,AA==' } }
  ])('轴/曲线/符号/归属不确定拒绝 %j', (patch) => {
    const { source, confirmation } = privateSource();
    expect(() => confirmedDiagramRecipe({ ...confirmation, ...patch }, source)).toThrow();
  });
  it('选择折点只改草稿；保存帮助失败不采用，成功后才发确认', async () => {
    const { state } = privateSource(),
      record = vi.fn(() => false),
      wrapper = mount(DiagramConditions, {
        props: { state, question: state.questions[0], conversationId: 'c', context: 'ctx', recordHelp: record },
        global: { stubs }
      });
    try {
      await button(wrapper, '按原图演示').trigger('tap');
      await button(wrapper, '速度—时间图').trigger('tap');
      expect(wrapper.emitted('confirm')).toBeUndefined();
      expect(wrapper.findAll('input').every((i) => i.element.value === '')).toBe(true);
      for (const name of ['s', 'm/s', '向右', '直线']) await button(wrapper, name).trigger('tap');
      for (const [label, value] of [
        ['折点1时间', '0'],
        ['折点1速度', '2'],
        ['折点2时间', '3'],
        ['折点2速度', '-1']
      ])
        await wrapper.find(`input[aria-label="${label}"]`).setValue(value);
      const confirm = wrapper.findAll('button').find((b) => b.text().includes('确认条件'));
      await confirm.trigger('tap');
      expect(wrapper.emitted('confirm')).toBeUndefined();
      expect(wrapper.text()).toContain('演示帮助未保存');
      record.mockReturnValue(true);
      await confirm.trigger('tap');
      expect(wrapper.emitted('confirm')[0][0].points).toEqual(
        input([
          [0, 2],
          [3, -1]
        ]).points
      );
    } finally {
      wrapper.unmount();
    }
  });
});
describe('明确原答、帮助与日历复测', () => {
  it('未使用的新题复用；已帮助或提交过的预备题继续换条件，不返回旧独立题', () => {
    const store = setup(),
      first = clone(store.activeQuestion);
    store.startScience(store.writingContext(), graph);
    expect(store.activeQuestion.id).toBe(first.id);
    store.recordScienceHelp(store.writingContext(), graph);
    store.startScience(store.writingContext(), graph);
    const second = clone(store.activeQuestion);
    expect(second.id).not.toBe(first.id);
    expect(second.parentQuestionKey).toBe(`${first.id}@1`);
    expect(store.active.pendingHints).toEqual([]);
    store.startScience(store.writingContext(), graph);
    expect(store.activeQuestion.id).toBe(second.id);
    store.submit(second.validation.answer, true, 'graph-prepared-submitted');
    store.startScience(store.writingContext(), graph);
    expect(store.activeQuestion.parentQuestionKey).toBe(`${second.id}@1`);
    expect(store.activeQuestion.id).not.toBe(second.id);
    expect(store.active.pendingHints).toEqual([]);
    expect(store.state.attempts[0].questionKey).toBe(`${second.id}@1`);
  });
  it('科学图形新题、原时区未来拒绝、到期帮助不能冒充独立完成，私人重放保留', () => {
    const store = setup();
    store.commit('strategy.set', {
      conversationId: store.active.id,
      method: 'steps',
      source: 'self_report',
      reason: '用户指定'
    });
    const q = clone(store.activeQuestion);
    store.submit(q.validation.answer, true, 'graph-original');
    const target = store.scheduleScienceRetest();
    store.focus(target.questionKey);
    const saved = store.exportData();
    expect(store.activeQuestion.scienceExercise).toMatchObject({
      contract: 'science-transfer-v3',
      plannedTimezone: 'America/Los_Angeles',
      dueDay: '2026-10-07'
    });
    expect(store.activeQuestion.scienceExercise.input).toEqual(nextScienceInput(q.scienceExercise.input));
    expect(() => store.submit(store.activeQuestion.validation.answer, true)).toThrow('尚未到复测日期');
    expect(store.exportData()).toBe(saved);
    store.commit('timezone.set', { timezone: 'Asia/Shanghai' });
    vi.setSystemTime(new Date('2026-10-07T06:59:59Z'));
    expect(store.scienceCanSubmit()).toBe(false);
    vi.setSystemTime(new Date('2026-10-07T07:00:00Z'));
    expect(store.scienceCanSubmit()).toBe(true);
    const context = store.writingContext();
    store.recordScienceHelp(context, store.activeQuestion.scienceExercise.input);
    store.recordScienceHelp(context, store.activeQuestion.scienceExercise.input);
    expect(store.active.pendingHints).toHaveLength(1);
    store.submit(store.activeQuestion.validation.answer, true, 'graph-helped');
    expect(store.state.attempts.at(-1)).toMatchObject({
      kind: 'review',
      grade: { outcome: 'correct', basis: 'science-transfer-v3' },
      hints: [{ level: 1 }]
    });
    expect(
      store.state.plans.find((p) => p.day === target.day).tasks.find((t) => t.questionKey === target.questionKey)
        .completedBy
    ).toBeNull();
    let replay = emptyLearningState(store.state.owner, store.state.timezone);
    for (const event of store.state.events)
      replay = applyLearningOperation(replay, normalizePrivateSyncOperation(event)).state;
    for (const key of ['questions', 'attempts', 'plans', 'conversations'])
      expect(replay[key]).toEqual(store.state[key]);
    store.commit('task.stop', { conversationId: store.active.id });
    const stopped = store.exportData();
    expect(() => store.startScience(store.writingContext(), graph)).toThrow('停止');
    expect(store.exportData()).toBe(stopped);
  });
  it('观察保存一次帮助后才推进面积；独立换题不迁原观察帮助或原答', async () => {
    const store = setup(),
      wrapper = mount(LearningLab, {
        props: {
          state: store.state,
          question: store.activeQuestion,
          conversationId: store.active.id,
          context: store.writingContext(),
          recordScienceHelp: store.recordScienceHelp
        },
        global: { stubs }
      });
    try {
      await button(wrapper, '互动学习').trigger('tap');
      await button(wrapper, '速度—时间图').trigger('tap');
      expect(wrapper.text()).not.toContain('正面积');
      const before = store.exportData();
      await button(wrapper, '我猜不同').trigger('tap');
      expect(store.exportData()).toBe(before);
      for (let i = 0; i < 24; i++) await button(wrapper, '下一步').trigger('tap');
      expect(store.active.pendingHints).toHaveLength(1);
      expect(wrapper.text()).toContain('正面积 4 m');
      expect(wrapper.text()).toContain('负面积大小 3 m');
      expect(store.state.attempts).toEqual([]);
      await button(wrapper, '独立检验').trigger('tap');
      const [context, observed] = wrapper.emitted('science')[0];
      const previous = clone(store.activeQuestion);
      store.startScience(context, observed);
      expect(store.active.pendingHints).toEqual([]);
      expect(store.activeQuestion.scienceExercise.input).toEqual(nextScienceInput(previous.scienceExercise.input));
      expect(store.activeQuestion.parentQuestionKey).toBe(`${previous.id}@1`);
    } finally {
      wrapper.unmount();
    }
  });
});
describe('图形显示不越过隐藏和卸载边界', () => {
  it('缺绘图能力给出短错误，保留带单位折点数据，不产生学习动作', async () => {
    vi.stubGlobal('uni', { ...uni, createSelectorQuery: undefined, createCanvasContext: undefined });
    const wrapper = mount(VelocityTimeGraph, { props: { points: graph.points }, global: { stubs } });
    try {
      await flushPromises();
      expect(wrapper.text()).toContain('图形暂不可用，折点数据保留');
      expect(wrapper.text()).toContain('3 s · -1 m/s');
      expect(wrapper.emitted()).toEqual({});
    } finally {
      wrapper.unmount();
    }
  });
  it('折点文本与无障碍描述保留；迟到测量/卸载/隐藏不能再画旧图', async () => {
    const callbacks = [],
      query = {
        in() {
          return this;
        },
        select() {
          return this;
        },
        boundingClientRect(cb) {
          callbacks.push(cb);
          return this;
        },
        exec() {}
      };
    const ctx = Object.fromEntries(
      [
        'clearRect',
        'setFillStyle',
        'fillRect',
        'beginPath',
        'moveTo',
        'lineTo',
        'closePath',
        'fill',
        'setStrokeStyle',
        'setLineWidth',
        'stroke',
        'setFontSize',
        'setTextAlign',
        'fillText',
        'arc',
        'draw'
      ].map((k) => [k, vi.fn()])
    );
    const create = vi.fn(() => ctx);
    vi.stubGlobal('uni', { ...uni, createSelectorQuery: () => query, createCanvasContext: create });
    const wrapper = mount(VelocityTimeGraph, { props: { points: graph.points }, global: { stubs } });
    await flushPromises();
    expect(wrapper.text()).toContain('3 s · -1 m/s');
    expect(wrapper.find('canvas').attributes('aria-label')).toContain('相邻折点之间为直线');
    const stale = callbacks[0];
    await wrapper.setProps({
      points: input([
        [0, 0],
        [2, 1]
      ]).points
    });
    await flushPromises();
    stale({ width: 400 });
    expect(create).not.toHaveBeenCalled();
    callbacks.at(-1)({ width: 400 });
    expect(ctx.draw).toHaveBeenCalledOnce();
    await wrapper.setProps({ visible: false });
    await flushPromises();
    callbacks.at(-1)({ width: 400 });
    expect(ctx.draw).toHaveBeenCalledOnce();
    wrapper.unmount();
    window.dispatchEvent(new Event('resize'));
    callbacks.at(-1)({ width: 400 });
    expect(ctx.draw).toHaveBeenCalledOnce();
  });
});
