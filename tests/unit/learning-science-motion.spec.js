import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { mount } from '@vue/test-utils';
import {
  visualRecipe,
  visualFrame,
  motionResult,
  assertVisualOutputCapability,
  manimVisualSource
} from '../../laf-backend/functions/_shared/learning-visual.js';
import { createScienceQuestion, nextScienceInput } from '../../laf-backend/functions/_shared/learning-science.js';
import { confirmedDiagramRecipe, sourceDiagram } from '../../laf-backend/functions/_shared/learning-diagram.js';
import {
  emptyLearningState,
  applyLearningOperation,
  normalizePrivateSyncOperation,
  gradeAnswer
} from '@/services/learning/learning-domain.js';
import { learningRepository } from '@/services/learning/learning-repository.js';
import { useConversationLearningStore } from '@/stores/modules/conversation-learning.js';
import LearningLab from '@/components/business/learning/learning-lab.vue';
import DiagramConditions from '@/components/business/learning/diagram-conditions.vue';
import { executeLearningTool } from '@/services/learning/learning-tools.js';
import {
  requestedTeachingMethod,
  conversationStrategy
} from '../../laf-backend/functions/_shared/learning-strategy.js';
import { parseLearningOutput } from '../../laf-backend/functions/_shared/ai-providers/learning-provider.ts';
vi.mock('@dcloudio/uni-app', () => ({ onHide: vi.fn(), onShow: vi.fn(), onBackPress: vi.fn() }));
const at = Date.parse('2026-10-06T09:00:00Z'),
  copy = (v) => JSON.parse(JSON.stringify(v));
const motion = {
  template: 'accelerated_motion',
  massKg: 0.5,
  initialVelocityMps: 2,
  netForceN: 0.5,
  direction: 'left',
  physicalSeconds: 4
};
const segmented = {
  template: 'changing_net_force',
  massKg: 0.5,
  initialVelocityMps: 1,
  segments: [
    { seconds: 2, netForceN: 0.5, direction: 'left' },
    { seconds: 2, netForceN: 0, direction: 'none' },
    { seconds: 2, netForceN: 0.5, direction: 'right' }
  ]
};
beforeEach(() => {
  uni.clearStorageSync();
  setActivePinia(createPinia());
  vi.useFakeTimers();
  vi.setSystemTime(at);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});
const initial = () =>
  applyLearningOperation(emptyLearningState('motion-user', 'Asia/Shanghai'), {
    id: 'c',
    type: 'conversation.start',
    at,
    data: { goal: '学习物理' }
  }).state;
const add = (state, question) =>
  applyLearningOperation(state, { id: 'add-' + question.id, type: 'question.add', at, data: { question } }).state;
const stubs = {
  view: { template: '<div><slot /></div>' },
  text: { template: '<span><slot /></span>' },
  BaseIcon: true
};
const button = (wrapper, label) =>
  wrapper.findAll('button, [role="button"], [role="tab"]').find((b) => b.text() === label);
describe('精确初速度与分段合力', () => {
  it.each([
    [motion, [4, 1], [0, 1], [-2, 1]],
    [{ ...motion, massKg: 0.3, initialVelocityMps: 1, netForceN: 0.2 }, [17, 6], [-4, 3], [-5, 3]],
    [
      { ...motion, massKg: 0.3, initialVelocityMps: 1.1, netForceN: 0.2, direction: 'right', physicalSeconds: 3 },
      [63, 10],
      [63, 10],
      [31, 10]
    ],
    [{ ...motion, initialVelocityMps: -2, netForceN: 0, direction: 'none' }, [8, 1], [-8, 1], [-2, 1]],
    [{ ...motion, initialVelocityMps: 0, netForceN: 0, direction: 'none' }, [0, 1], [0, 1], [0, 1]],
    [segmented, [4, 1], [-2, 1], [1, 1]],
    [{ ...segmented, segments: segmented.segments.slice(0, 2) }, [3, 1], [-2, 1], [-1, 1]]
  ])('原始条件 %j 得到独立手算结果', (input, distance, displacement, velocity) => {
    expect(motionResult(input)).toEqual({ distance, displacement, velocity });
    const recipe = visualRecipe(input),
      frames = Array.from({ length: 25 }, (_, i) => visualFrame(recipe, i));
    expect(frames.every((f, i) => !i || f.distance >= frames[i - 1].distance)).toBe(true);
    expect(
      frames.every(
        (f) =>
          f.position >= f.minimum &&
          f.position <= f.maximum &&
          f.comparisonPosition >= f.minimum &&
          f.comparisonPosition <= f.maximum
      )
    ).toBe(true);
    expect(frames.at(-1).exact).toEqual({ distance, displacement, velocity });
  });
  it('分段边界位置与速度连续，合力切换为右段；零合力保持运动', () => {
    const r = visualRecipe(segmented);
    expect(visualFrame(r, 8)).toMatchObject({
      time: 2,
      position: 0,
      speed: -1,
      distance: 1,
      acceleration: 0,
      phaseIndex: 1
    });
    expect(visualFrame(r, 16)).toMatchObject({
      time: 4,
      position: -2,
      speed: -1,
      distance: 3,
      acceleration: 1,
      phaseIndex: 2
    });
    expect(visualFrame(r, 24)).toMatchObject({ comparisonPosition: 2, comparisonSpeed: 1, comparisonDistance: 2 });
  });
  it('复杂转向的分母超出安全整数时拒绝，而非把近似值升级判分', () => {
    const input = {
      ...segmented,
      massKg: 0.37,
      initialVelocityMps: 9.87,
      segments: [
        { seconds: 3, netForceN: 11.99, direction: 'left' },
        { seconds: 3, netForceN: 11.98, direction: 'right' },
        { seconds: 4, netForceN: 11.97, direction: 'left' }
      ]
    };
    expect(() => visualRecipe(input)).toThrow('精确数值范围');
    expect(() => createScienceQuestion('q', 'c', input)).toThrow('精确数值范围');
    const forged = createScienceQuestion('q', 'c', segmented);
    forged.scienceExercise.input = input;
    expect(gradeAnswer(forged, 'A')).toMatchObject({ status: 'pending', basis: 'no_independent_reference' });
  });
  it.each([
    { ...motion, massKg: 0 },
    { ...motion, massKg: 0.09 },
    { ...motion, massKg: 20.01 },
    { ...motion, massKg: '0.5' },
    { ...motion, initialVelocityMps: 10.01 },
    { ...motion, initialVelocityMps: 0.123 },
    { ...motion, initialVelocityMps: Infinity },
    { ...motion, initialVelocityMps: undefined },
    { ...motion, physicalSeconds: 1.5 },
    { ...motion, physicalSeconds: 11 },
    { ...motion, netForceN: 0, direction: 'right' },
    { ...motion, netForceN: 12.01 },
    { ...motion, code: 'exec()' },
    { ...segmented, segments: [] },
    { ...segmented, segments: [{ seconds: 1, netForceN: 1, direction: 'right' }] },
    { ...segmented, segments: [...segmented.segments, ...segmented.segments] },
    {
      ...segmented,
      segments: [
        { seconds: 9, netForceN: 0, direction: 'none' },
        { seconds: 2, netForceN: 0, direction: 'none' }
      ]
    },
    { ...segmented, segments: [{ seconds: 1, netForceN: 0, direction: 'left' }, segmented.segments[2]] },
    { ...segmented, segments: [{ ...segmented.segments[0], url: 'http://127.0.0.1' }, segmented.segments[2]] }
  ])('拒绝缺失条件、资源提升或越界 %j', (input) => {
    expect(() => visualRecipe(input)).toThrow();
  });
  it('v3能力逐级兼容，旧客户端不得采用初速度模型，固定视频不冒充新模板', () => {
    const call = { name: 'visualize', arguments: motion },
      out = { message: '预测后观察。', tools: [call] };
    for (const version of ['learning-visual-v1', 'learning-visual-v2', 'future'])
      expect(() => assertVisualOutputCapability(out, { visualization: version })).toThrow();
    expect(assertVisualOutputCapability(out, { visualization: 'learning-visual-v3' })).toBe(out);
    expect(() => manimVisualSource(motion)).toThrow('逐步观察');
    expect(parseLearningOutput(JSON.stringify(out)).tools[0].arguments).toEqual(motion);
    const state = initial(),
      commit = vi.fn(),
      ctx = {
        permissions: ['read'],
        calls: 0,
        maxCalls: 1,
        deadline: Date.now() + 1000,
        conversationId: 'c',
        origin: 'model'
      };
    expect(executeLearningTool({ read: () => state, commit }, call, ctx).result.contract).toBe('learning-visual-v3');
    expect(commit.mock.calls[0][0].type).toBe('execution.record');
    expect(state.attempts).toHaveLength(0);
    expect(() =>
      executeLearningTool({ read: () => state, commit }, call, { ...ctx, calls: 0, lockedMethod: 'steps' })
    ).toThrow('指定');
  });
});
describe('新题版本、原答及日历', () => {
  it('观察帮助归当前科学题；重复播放去重，原答后再看属于下一次作答', () => {
    const store = useConversationLearningStore();
    store.start('学习物理');
    store.startScience(store.writingContext(), motion);
    const key = store.active.activeQuestionKey,
      before = copy(store.state),
      context = store.writingContext();
    expect(store.recordScienceHelp(context, motion)).toBe(true);
    expect(store.recordScienceHelp(context, motion)).toBe(true);
    expect(store.state.attempts).toEqual(before.attempts);
    expect(store.state.plans).toEqual(before.plans);
    expect(store.active.pendingHints).toHaveLength(1);
    expect(store.active.pendingHints[0]).toMatchObject({ questionKey: key, level: 1 });
    expect(store.active.pendingHints[0].content).toContain('初速度2m/s');
    expect(store.state.events.filter((e) => e.type === 'hint.add')).toHaveLength(1);
    store.submit(store.activeQuestion.validation.answer, true, 'helped-answer');
    const first = copy(store.state.attempts[0]);
    expect(first.hints).toHaveLength(1);
    expect(store.summary.tasks.numerator).toBe(0);
    store.recordScienceHelp(context, motion);
    expect(store.active.pendingHints).toHaveLength(1);
    expect(store.state.attempts[0]).toEqual(first);
    expect(store.state.events.filter((e) => e.type === 'hint.add')).toHaveLength(2);
    let replay = emptyLearningState(store.state.owner, store.state.timezone);
    for (const event of store.state.events)
      replay = applyLearningOperation(replay, normalizePrivateSyncOperation(copy(event))).state;
    expect(replay.attempts).toEqual(store.state.attempts);
    expect(replay.conversations).toEqual(store.state.conversations);
  });
  it('未来题可记录观察帮助，提前提交仍拒绝；到期答对不能冒充无提示通过', () => {
    const store = useConversationLearningStore();
    store.start('学习物理');
    store.startScience(store.writingContext(), motion);
    store.submit(store.activeQuestion.validation.answer, true, 'original-a');
    const first = copy(store.state.attempts[0]),
      plan = store.scheduleScienceRetest();
    store.focus(plan.questionKey);
    store.recordScienceHelp(store.writingContext(), segmented);
    const early = store.exportData();
    expect(() => store.submit(store.activeQuestion.validation.answer, true)).toThrow();
    expect(store.exportData()).toBe(early);
    vi.setSystemTime(at + 86400000);
    store.submit(store.activeQuestion.validation.answer, true, 'helped-review');
    expect(store.state.attempts[0]).toEqual(first);
    expect(store.state.attempts[1]).toMatchObject({
      kind: 'review',
      hints: [expect.objectContaining({ questionKey: plan.questionKey })]
    });
    expect(
      store.state.plans
        .filter((p) => p.day === plan.day)
        .at(-1)
        .tasks.at(-1).completedBy
    ).toBeNull();
  });
  it('观察帮助保留迟到、账户和停止门禁，非法参数不写事实', async () => {
    const store = useConversationLearningStore();
    store.start('学习物理');
    store.startScience(store.writingContext(), motion);
    const context = store.writingContext(),
      before = store.exportData();
    expect(() => store.recordScienceHelp(context, { ...motion, url: 'http://127.0.0.1' })).toThrow();
    expect(store.exportData()).toBe(before);
    store.startScience(context, store.activeQuestion.scienceExercise.input);
    const switched = store.exportData();
    expect(() => store.recordScienceHelp(context, motion)).toThrow('切换');
    expect(store.exportData()).toBe(switched);
    await store.send('停止当前任务');
    const stopped = store.exportData();
    expect(() => store.recordScienceHelp(store.writingContext(), motion)).toThrow('停止');
    expect(store.exportData()).toBe(stopped);
    const old = store.writingContext();
    store.start('另一对话');
    const changed = store.exportData();
    expect(() => store.recordScienceHelp(old, motion)).toThrow('切换');
    expect(store.exportData()).toBe(changed);
  });
  it.each([motion, segmented])('四选项精确、不固定答案权限且私人重放一致 %j', (input) => {
    const q = createScienceQuestion('q', 'c', input);
    expect(q.scienceExercise.contract).toBe('science-transfer-v2');
    expect(new Set(q.options).size).toBe(4);
    const expected = q.validation.answer;
    for (const letter of 'ABCD')
      expect(gradeAnswer(q, letter)).toMatchObject({
        status: 'reliable',
        basis: 'science-transfer-v2',
        outcome: letter === expected ? 'correct' : 'wrong'
      });
    expect(gradeAnswer(q, 'A B').status).toBe('pending');
    q.validation = { type: 'choice', answer: 'Z', authority: 'human_reviewed', evidenceId: 'forged' };
    expect(add(initial(), q).questions[0].validation.answer).toBe(expected);
    const op = normalizePrivateSyncOperation({ id: 'add-q', type: 'question.add', at, data: { question: q } });
    expect(op.data.question.validation).toBeNull();
    expect(applyLearningOperation(initial(), op).state.questions[0].validation.answer).toBe(expected);
    expect(nextScienceInput(input)).not.toEqual(input);
  });
  it.each(['contract', 'segment', 'source', 'conversation', 'prompt', 'options'])('伪造 %s 时原状态不变', (kind) => {
    const q = createScienceQuestion('q', 'c', segmented),
      state = initial(),
      before = JSON.stringify(state);
    if (kind === 'contract') q.scienceExercise.contract = 'science-transfer-v1';
    if (kind === 'segment') q.scienceExercise.input.segments[1].netForceN = 1;
    if (kind === 'source') q.source.url = 'http://localhost';
    if (kind === 'conversation') q.scienceExercise.conversationId = 'other';
    if (kind === 'prompt') q.prompt += '已掌握';
    if (kind === 'options') q.options.reverse();
    expect(() => add(state, q)).toThrow();
    expect(JSON.stringify(state)).toBe(before);
  });
  it('到期读原时区，跨日无额外写入也能重新判断；原答、教法、停止与重放保持', async () => {
    const store = useConversationLearningStore();
    store.start('学习物理');
    learningRepository.commit({
      id: 'method',
      type: 'strategy.set',
      data: {
        conversationId: store.active.id,
        method: 'steps',
        source: 'self_report',
        difficulty: 'self_report',
        reason: '按用户指定步骤'
      }
    });
    store.refresh();
    store.startScience(store.writingContext(), segmented);
    expect(store.submit(store.activeQuestion.validation.answer, false).clarification).toBe(true);
    const raw = store.activeQuestion.validation.answer;
    store.submit(raw, true, 'a');
    const first = copy(store.state.attempts[0]),
      plan = store.scheduleScienceRetest();
    store.focus(plan.questionKey);
    expect(store.scienceCanSubmit()).toBe(false);
    expect(() => store.submit('A', true)).toThrow();
    vi.setSystemTime(at + 86400000);
    // 不refresh、不写操作；昨日的computed值不能禁用今日提交。
    expect(store.scienceCanSubmit()).toBe(true);
    store.submit(store.activeQuestion.validation.answer, true, 'retest-a');
    expect(store.state.attempts[0]).toEqual(first);
    expect(requestedTeachingMethod(store.state, store.active.id)).toBe('steps');
    await store.send('停止当前任务');
    const exported = store.exportData();
    expect(() => store.startScience(store.writingContext(), motion)).toThrow('停止');
    let replay = emptyLearningState(store.state.owner, store.state.timezone);
    for (const e of store.state.events)
      replay = applyLearningOperation(replay, normalizePrivateSyncOperation(copy(e))).state;
    expect(replay.questions).toEqual(store.state.questions);
    expect(replay.attempts).toEqual(store.state.attempts);
    expect(replay.plans).toEqual(store.state.plans);
    setActivePinia(createPinia());
    const reopened = useConversationLearningStore();
    reopened.refresh();
    expect(reopened.exportData()).toBe(exported);
    expect(reopened.active.stopped).toBe(true);
    expect(reopened.active.activeQuestionKey).toBe(plan.questionKey);
    expect(conversationStrategy(reopened.state, reopened.active.id)).toMatchObject({ method: 'steps', stopped: true });
  });
});
const imageState = () => {
  const state = initial(),
    buffer = Buffer.alloc(24);
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82]).copy(buffer);
  buffer.writeUInt32BE(100, 16);
  buffer.writeUInt32BE(100, 20);
  state.materials = [
    {
      id: 'm',
      name: '合成原图',
      kind: 'image',
      fingerprint: 'science-motion-image-fixture-v1',
      extractionVersion: 'synthetic-v1',
      segments: [
        {
          id: 's',
          content: '质量500g，初速度200cm/s，恒定合力0.5N向左，4s。',
          page: 1,
          extractionVersion: 'synthetic-v1',
          extractionEventId: 'image',
          preview: 'data:image/png;base64,' + buffer.toString('base64')
        }
      ]
    }
  ];
  state.questions = [
    {
      id: 'q',
      version: 1,
      prompt: '分析运动。',
      scope: 'private',
      source: {
        kind: 'private_material',
        materialId: 'm',
        segmentId: 's',
        page: 1,
        extractionVersion: 'synthetic-v1',
        extractionEventId: 'image'
      }
    }
  ];
  state.conversations[0].activeQuestionKey = 'q@1';
  return state;
};
const confirmation = (state) => {
  const src = sourceDiagram(state, state.questions[0], 'c');
  return {
    explicit: true,
    binding: src.binding,
    sourceSnapshot: { stamp: src.stamp, image: src.image },
    template: 'accelerated_motion',
    massKg: '500',
    massUnit: 'g',
    initialVelocityMps: '200',
    velocityUnit: 'cm/s',
    velocityDirection: 'right',
    initialState: 'moving',
    netForceN: '0.5',
    forceUnit: 'N',
    forceKind: 'net_constant',
    direction: 'left',
    physicalSeconds: '4',
    timeUnit: 's'
  };
};
describe('原图明确条件与实际控件', () => {
  it('打开固定示例视频也先保存当前物理题帮助，失败时不暴露视频', async () => {
    const state = initial(),
      question = createScienceQuestion('q', 'c', motion),
      recordScienceHelp = vi.fn(() => false);
    const w = mount(LearningLab, {
      props: { state, question, conversationId: 'c', context: 'ctx', recordScienceHelp },
      global: { stubs }
    });
    await button(w, '互动学习').trigger('tap');
    await button(w, '路程与位移').trigger('tap');
    await button(w, '观看视频').trigger('tap');
    expect(w.find('video').exists()).toBe(false);
    expect(w.text()).toContain('观察帮助未保存');
    recordScienceHelp.mockReturnValue(true);
    await button(w, '观看视频').trigger('tap');
    expect(w.find('video').exists()).toBe(true);
    const calls = recordScienceHelp.mock.calls.length;
    await button(w, '收起视频').trigger('tap');
    await button(w, '观看视频').trigger('tap');
    expect(recordScienceHelp).toHaveBeenCalledTimes(calls);
    w.unmount();
  });
  it('私人原图物理题查看普通示例也保存帮助，原页及题干保持', async () => {
    const store = useConversationLearningStore(),
      source = imageState().materials[0];
    store.start('理解物理原图');
    learningRepository.commit({ id: 'image', type: 'material.add', data: { material: source } });
    store.refresh();
    store.structureQuestion(source.id, {
      segmentId: 's',
      prompt: '分析原图运动。',
      type: 'subjective',
      subject: '物理',
      knowledgePoint: '初速度与运动'
    });
    const before = copy(store.state),
      context = store.writingContext(),
      key = store.active.activeQuestionKey;
    store.recordScienceHelp(context, motion);
    expect(store.active.pendingHints[0]).toMatchObject({ questionKey: key, level: 1 });
    expect(store.state.materials).toEqual(before.materials);
    expect(store.state.questions).toEqual(before.questions);
    expect(store.state.attempts).toEqual(before.attempts);
    const w = mount(LearningLab, {
      props: {
        state: store.state,
        question: store.activeQuestion,
        conversationId: store.active.id,
        context,
        recordScienceHelp: (ctx, input) => store.recordScienceHelp(ctx, input)
      },
      global: { stubs }
    });
    await button(w, '互动学习').trigger('tap');
    await button(w, '初速度与转向').trigger('tap');
    await button(w, '会转向').trigger('tap');
    await button(w, '下一步').trigger('tap');
    expect(store.state.events.filter((e) => e.type === 'hint.add')).toHaveLength(1);
    expect(w.text()).toContain('加速度 -1');
    w.unmount();
  });
  it('绑定科学题观察前先保存帮助；保存失败不显示数值，不启动播放', async () => {
    const state = initial(),
      q = createScienceQuestion('q', 'c', motion);
    state.questions = [q];
    state.conversations[0].activeQuestionKey = 'q@1';
    const recordScienceHelp = vi.fn(() => false),
      w = mount(LearningLab, {
        props: { state, question: q, conversationId: 'c', context: 'ctx', recordScienceHelp },
        global: { stubs }
      });
    await button(w, '互动学习').trigger('tap');
    await button(w, '初速度与转向').trigger('tap');
    await button(w, '会转向').trigger('tap');
    await button(w, '下一步').trigger('tap');
    expect(recordScienceHelp).toHaveBeenCalledWith('ctx', motion);
    expect(w.text()).toContain('时间 0 s / 4 s');
    expect(w.text()).toContain('观察帮助未保存');
    expect(w.text()).not.toContain('加速度 -1');
    await button(w, '播放动画').trigger('tap');
    expect(button(w, '暂停动画')).toBeUndefined();
    expect(w.text()).toContain('时间 0 s / 4 s');
    recordScienceHelp.mockReturnValue(true);
    await button(w, '下一步').trigger('tap');
    expect(w.text()).not.toContain('观察帮助未保存');
    expect(w.text()).toContain('加速度 -1');
    const calls = recordScienceHelp.mock.calls.length;
    await button(w, '下一步').trigger('tap');
    expect(recordScienceHelp).toHaveBeenCalledTimes(calls);
    state.attempts.push({ id: 'a', questionKey: 'q@1' });
    await w.setProps({ state: copy(state) });
    await button(w, '下一步').trigger('tap');
    expect(recordScienceHelp).toHaveBeenCalledTimes(calls + 1);
    await w.setProps({ stopped: true });
    await button(w, '下一步').trigger('tap');
    expect(recordScienceHelp).toHaveBeenCalledTimes(calls + 1);
    w.unmount();
  });
  it('克与厘米每秒明确换算，原图像素/归属仍严格绑定', () => {
    const state = imageState(),
      src = sourceDiagram(state, state.questions[0], 'c'),
      input = confirmation(state);
    expect(confirmedDiagramRecipe(input, src)).toEqual(visualRecipe(motion));
    expect(() => confirmedDiagramRecipe({ ...input, velocityUnit: '' }, src)).toThrow('单位');
    expect(() => confirmedDiagramRecipe({ ...input, initialState: 'unknown' }, src)).toThrow('初速度');
    expect(() => confirmedDiagramRecipe({ ...input, initialState: 'rest' }, src)).toThrow('初速度');
    expect(() => confirmedDiagramRecipe({ ...input, forceKind: 'applied' }, src)).toThrow('单个推力');
    expect(() =>
      confirmedDiagramRecipe({ ...input, sourceSnapshot: { ...input.sourceSnapshot, image: 'different' } }, src)
    ).toThrow('变化');
    expect(() => confirmedDiagramRecipe({ ...input, binding: { ...input.binding, owner: 'other' } }, src)).toThrow(
      '变化'
    );
  });
  it('每段单位和合力条件明确，不采用空缺或单个推力', () => {
    const state = imageState(),
      src = sourceDiagram(state, state.questions[0], 'c'),
      old = confirmation(state);
    const { netForceN, forceUnit, direction, physicalSeconds, timeUnit, ...common } = old;
    const input = {
      ...common,
      template: 'changing_net_force',
      initialVelocityMps: '100',
      forceKind: 'net_segments',
      segments: segmented.segments.map((s) => ({
        ...s,
        netForceN: String(s.netForceN),
        seconds: String(s.seconds),
        timeUnit: 's',
        forceUnit: 'N'
      }))
    };
    expect(confirmedDiagramRecipe(input, src)).toEqual(visualRecipe(segmented));
    const forged = copy(input);
    forged.segments[1].timeUnit = '';
    expect(() => confirmedDiagramRecipe(forged, src)).toThrow('单位');
    expect(() => confirmedDiagramRecipe({ ...input, forceKind: 'net_constant' }, src)).toThrow('各自恒定');
  });
  it.each(['初速度与转向', '分段合力'])('预测/观察再独立检验，停止不能另发事件：%s', async (label) => {
    const w = mount(LearningLab, {
      props: { state: initial(), conversationId: 'c', context: 'ctx' },
      global: { stubs }
    });
    await button(w, '互动学习').trigger('tap');
    await button(w, label).trigger('tap');
    expect(button(w, '独立检验')).toBeUndefined();
    await button(w, '会转向').trigger('tap');
    for (let i = 0; i < 24; i++) await button(w, '下一步').trigger('tap');
    expect(w.text()).toContain(label === '分段合力' ? '位移 -2 m' : '位移 0 m');
    expect(button(w, '观看视频')).toBeUndefined();
    await button(w, '独立检验').trigger('tap');
    expect(w.emitted('science')).toEqual([['ctx', label === '分段合力' ? segmented : motion]]);
    await w.setProps({ stopped: true });
    await button(w, '独立检验').trigger('tap');
    expect(w.emitted('science')).toHaveLength(1);
    w.unmount();
  });
  it('原图新模板空草稿拒绝确认，选择仍不写帮助；成功保存后才采用', async () => {
    const state = imageState(),
      recordHelp = vi.fn(() => true),
      w = mount(DiagramConditions, {
        props: { state, question: state.questions[0], conversationId: 'c', context: 'ctx', recordHelp },
        global: { stubs }
      });
    await button(w, '按原图观察').trigger('tap');
    await button(w, '初速度与转向').trigger('tap');
    await button(w, '确认条件并观察').trigger('tap');
    expect(recordHelp).not.toHaveBeenCalled();
    expect(w.emitted('confirm')).toBeUndefined();
    for (const [selector, value] of [
      ['input[aria-label="原图质量"]', '0.5'],
      ['input[aria-label="原图合力"]', '0.5'],
      ['input[aria-label="初速度大小"]', '2'],
      ['input[aria-label="持续时间"]', '4']
    ])
      await w.find(selector).setValue(value);
    await button(w, 'kg').trigger('tap');
    await button(w, 'N').trigger('tap');
    await button(w, '已有速度').trigger('tap');
    await w.find('input[aria-label="初速度大小"]').setValue('2');
    await button(w, 'm/s').trigger('tap');
    await button(w, 's').trigger('tap');
    await button(w, '恒定合力').trigger('tap');
    const groups = w.findAll('.diagram-options');
    await groups
      .find((g) => g.attributes('aria-label') === '初速度方向')
      .findAll('button, [role="button"], [role="tab"]')[1]
      .trigger('tap');
    await w
      .findAll('button, [role="button"], [role="tab"]')
      .filter((b) => b.text() === '向左')
      .at(-1)
      .trigger('tap');
    expect(recordHelp).not.toHaveBeenCalled();
    await button(w, '确认条件并观察').trigger('tap');
    expect(recordHelp).toHaveBeenCalledOnce();
    expect(w.emitted('confirm')[0][0]).toEqual(visualRecipe(motion));
    w.unmount();
  });
});
