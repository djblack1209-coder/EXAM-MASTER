import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { useConversationLearningStore } from '@/stores/modules/conversation-learning.js';
import { learningRepository } from '@/services/learning/learning-repository.js';
import {
  emptyLearningState,
  learningCapabilitiesData,
  applyLearningOperation,
  normalizePrivateSyncOperation
} from '../../laf-backend/functions/_shared/learning-domain.js';
import { sourceDiagram, confirmedDiagramRecipe } from '../../laf-backend/functions/_shared/learning-diagram.js';
import {
  visualRecipe,
  visualFrame,
  assertVisualOutputCapability,
  manimVisualSource
} from '../../laf-backend/functions/_shared/learning-visual.js';
import { parseLearningOutput } from '../../laf-backend/functions/_shared/ai-providers/learning-provider.ts';
import { blenderVisualSource } from '../../scripts/build/render-learning-visual.mjs';
import DiagramConditions from '@/components/business/learning/diagram-conditions.vue';
import LearningLab from '@/pages/learning/components/learning-lab.vue';
vi.mock('@dcloudio/uni-app', () => ({ onHide: vi.fn() }));
const clone = (v) => JSON.parse(JSON.stringify(v));
const png = (width = 100) => {
  const b = Buffer.alloc(24);
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82]).copy(b);
  b.writeUInt32BE(width, 16);
  b.writeUInt32BE(100, 20);
  return `data:image/png;base64,${b.toString('base64')}`;
};
const image = png();
const material = () => ({
  id: 'diagram-material',
  name: '合成物理页图',
  kind: 'image',
  fingerprint: 'diagram-source-v1',
  extractionVersion: 'synthetic-v1',
  segments: [
    {
      id: 's1',
      content: '质量2kg；恒定合力4N向右；初始静止。',
      page: 1,
      extractionVersion: 'synthetic-v1',
      extractionEventId: 'image-add',
      preview: image
    }
  ]
});
const fixture = () => {
  const s = emptyLearningState('diagram-user', 'Asia/Shanghai');
  s.materials = [material()];
  s.questions = [
    {
      id: 'q',
      version: 1,
      prompt: '比较同样合力下的运动。',
      scope: 'private',
      source: {
        kind: 'private_material',
        materialId: 'diagram-material',
        segmentId: 's1',
        page: 1,
        extractionVersion: 'synthetic-v1',
        extractionEventId: 'image-add'
      }
    }
  ];
  s.conversations = [{ id: 'c1', goal: '学习物理', activeQuestionKey: 'q@1', stopped: false }];
  return s;
};
const source = (s = fixture()) => sourceDiagram(s, s.questions[0], 'c1');
const confirmation = (s = fixture()) => {
  const p = source(s);
  return {
    explicit: true,
    binding: p.binding,
    sourceSnapshot: { stamp: p.stamp, image: p.image },
    template: 'constant_net_force',
    massKg: '2',
    massUnit: 'kg',
    netForceN: '4',
    forceUnit: 'N',
    direction: 'right',
    initialState: 'rest',
    forceKind: 'net_constant'
  };
};
const force = (patch = {}) =>
  visualRecipe({ template: 'constant_net_force', massKg: 2, netForceN: 4, direction: 'right', ...patch });
beforeEach(() => {
  uni.clearStorageSync();
  setActivePinia(createPinia());
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});
describe('物理有界演示与版本', () => {
  it('使用合力与质量，2秒从静止出发；相同合力下质量加倍的加速度和位移减半', () => {
    const r = force(),
      half = visualFrame(r, 12),
      end = visualFrame(r, 24);
    expect(r).toMatchObject({
      contract: 'learning-visual-v2',
      initialVelocity: 0,
      forceConstant: true,
      duration: 6,
      physicalSeconds: 2
    });
    expect(half).toMatchObject({
      time: 1,
      position: 1,
      acceleration: 2,
      comparisonAcceleration: 1,
      comparisonPosition: 0.5
    });
    expect(end).toMatchObject({ time: 2, position: 4, speed: 4, comparisonPosition: 2, complete: true });
    expect(visualFrame(force({ direction: 'left' }), 24)).toMatchObject({ position: -4, acceleration: -2, speed: -4 });
    expect(visualFrame(force({ netForceN: 0, direction: 'none' }), 24)).toMatchObject({
      position: 0,
      acceleration: 0,
      comparisonPosition: 0
    });
    const frames = Array.from({ length: 25 }, (_, i) => visualFrame(force({ massKg: 1, netForceN: 12 }), i));
    expect(frames.at(-1).position).toBe(24);
    expect(frames.every((f, i) => !i || f.position >= frames[i - 1].position)).toBe(true);
  });
  it.each([
    { massKg: 0 },
    { massKg: 21 },
    { massKg: 1.5 },
    { massKg: '2' },
    { netForceN: -1 },
    { netForceN: 13 },
    { netForceN: NaN },
    { direction: 'up' },
    { url: 'http://127.0.0.1' },
    { code: 'import os' },
    { initialVelocity: 8 },
    { forceConstant: false },
    { duration: 99 },
    { backward: 1 }
  ])('拒绝越界、猜测条件与能力提升 %j', (patch) => expect(() => force(patch)).toThrow());
  it('旧v1仍仅向右默认往返，v2可反向；旧客户端不接新模板或方向', () => {
    const old = visualRecipe({ template: 'distance_displacement', outward: 6, backward: 4 });
    expect(old.contract).toBe('learning-visual-v1');
    expect(old).not.toHaveProperty('direction');
    const left = visualRecipe({ template: 'distance_displacement', outward: 6, backward: 4, direction: 'left' });
    expect(visualFrame(left, 24)).toMatchObject({ distance: 10, displacement: -2 });
    const output = {
      tools: [
        {
          name: 'visualize',
          arguments: { template: 'constant_net_force', massKg: 2, netForceN: 4, direction: 'right' }
        }
      ]
    };
    expect(() => assertVisualOutputCapability(output, { visualization: 'learning-visual-v1' })).toThrow('未声明');
    expect(
      assertVisualOutputCapability(output, learningCapabilitiesData({ visualization: 'learning-visual-v2' }))
    ).toBe(output);
    expect(() => assertVisualOutputCapability(output, { visualization: 'future' })).toThrow();
    expect(parseLearningOutput(JSON.stringify({ message: '先预测。', ...output })).tools).toHaveLength(1);
    expect(() => visualFrame({ ...old, contract: 'learning-visual-v2' }, 1)).toThrow();
  });
  it('新场景没有已验视频适配时明确拒绝，不输出NaN或错误旧片', () => {
    const p = { template: 'constant_net_force', massKg: 2, netForceN: 4, direction: 'right' };
    expect(() => manimVisualSource(p)).toThrow('逐步观察');
    expect(() => blenderVisualSource(p, 'tmp/f', 'tmp/s')).toThrow('逐步观察');
    expect(() => manimVisualSource({ template: 'distance_displacement', direction: 'left' })).toThrow();
  });
  it('零合力不要求猜方向，非零合力不能声明无方向', () => {
    expect(() => force({ netForceN: 0 })).toThrow('无方向');
    expect(() => force({ direction: 'none' })).toThrow();
    expect(force({ netForceN: 0, direction: 'none' }).direction).toBe('none');
  });
});
describe('原图条件的来源与确认', () => {
  it('只绑定当前题目、账户与明确提取版本，本地页图不访问URL', () => {
    const s = fixture(),
      before = JSON.stringify(s);
    expect(source(s)).toMatchObject({
      image,
      binding: { owner: 'diagram-user', questionKey: 'q@1', extractionEventId: 'image-add' }
    });
    expect(sourceDiagram(s, s.questions[0], 'other')).toBeNull();
    expect(JSON.stringify(s)).toBe(before);
    s.conversations[0].activeQuestionKey = 'other@1';
    expect(source(s)).toBeNull();
  });
  it.each(['version', 'event', 'page', 'deleted', 'url', 'invalidImage'])('失效来源不提供条件入口：%s', (kind) => {
    const s = fixture();
    if (kind === 'version') s.materials[0].extractionVersion = 'v2';
    if (kind === 'event') s.materials[0].segments[0].extractionEventId = 'changed';
    if (kind === 'page') s.questions[0].source.page = 2;
    if (kind === 'deleted') s.materialDeletions = [{ materialId: 'diagram-material' }];
    if (kind === 'url') s.materials[0].segments[0].preview = 'https://example.test/image.png';
    if (kind === 'invalidImage') s.materials[0].segments[0].preview = png(5000);
    expect(source(s)).toBeNull();
  });
  it('单位逐项确认后才精确换算；不猜丢失字段或小数', () => {
    const s = fixture(),
      p = source(s),
      c = confirmation(s);
    expect(confirmedDiagramRecipe({ ...c, massKg: '2000', massUnit: 'g' }, p)).toMatchObject({ massKg: 2 });
    expect(() => confirmedDiagramRecipe({ ...c, massKg: '1500', massUnit: 'g' }, p)).toThrow('整数');
    for (const patch of [
      { explicit: false },
      { massUnit: '' },
      { forceUnit: '' },
      { initialState: 'moving' },
      { forceKind: 'applied' },
      { initialState: 'unknown' },
      { direction: '' },
      { massKg: '2.0' },
      { massKg: '2e0' },
      { code: 'x' },
      { binding: { ...c.binding, owner: 'other' } }
    ])
      expect(() => confirmedDiagramRecipe({ ...c, ...patch }, p)).toThrow();
    const base = {
      explicit: true,
      binding: p.binding,
      sourceSnapshot: c.sourceSnapshot,
      template: 'distance_displacement',
      outward: '600',
      outwardUnit: 'cm',
      backward: '4',
      backwardUnit: 'm',
      direction: 'left'
    };
    expect(confirmedDiagramRecipe(base, p)).toMatchObject({ outward: 6, backward: 4, direction: 'left' });
    expect(() => confirmedDiagramRecipe({ ...base, backwardUnit: '' }, p)).toThrow('单位');
  });
  it('原页像素或题目文字变化，旧确认即使标识不变仍被拒绝', () => {
    const s = fixture(),
      c = confirmation(s);
    s.materials[0].segments[0].preview = png(101);
    expect(() => confirmedDiagramRecipe(c, source(s))).toThrow('原页');
    s.materials[0].segments[0].preview = image;
    s.questions[0].prompt = '修改后的题干';
    expect(() => confirmedDiagramRecipe(c, source(s))).toThrow('原页');
  });
});
function storeWithImage() {
  const store = useConversationLearningStore();
  store.start('理解合力与运动');
  const m = material();
  learningRepository.commit({ id: 'image-add', type: 'material.add', data: { material: m } });
  store.refresh();
  store.structureQuestion(m.id, {
    segmentId: 's1',
    prompt: '合力4N，质量2kg，从静止出发，比较运动。',
    type: 'subjective',
    subject: '物理',
    knowledgePoint: '合力与加速度'
  });
  return store;
}
const actualConfirmation = (store) => {
  const s = sourceDiagram(store.state, store.activeQuestion, store.selectedConversationId);
  return { ...confirmation(), binding: s.binding, sourceSnapshot: { stamp: s.stamp, image: s.image } };
};
describe('图示帮助与可靠事实分开', () => {
  it('确认先写绑定原题的帮助；原答、评分、计划、复习不被创建或改写，公开备份可重放', () => {
    const store = storeWithImage();
    const old = clone(store.state),
      input = actualConfirmation(store);
    store.recordDiagramHelp(store.writingContext(), input);
    expect(store.active.pendingHints).toHaveLength(1);
    const help = store.state.events.filter((e) => e.type === 'hint.add').at(-1).data;
    expect(help.conversationId).toBe(store.selectedConversationId);
    expect(store.active.pendingHints[0].questionKey).toBe(store.active.activeQuestionKey);
    expect(help.content).toContain('质量2kg');
    expect(help.content).not.toContain('data:image');
    for (const f of ['attempts', 'questions', 'plans', 'reviews']) expect(store.state[f]).toEqual(old[f]);
    expect(store.summary.first.denominator).toBe(0);
    expect(store.summary.totalReliableAnswers).toBe(0);
    const payload = store.exportData();
    expect(store.previewRestore(payload)).toBeTruthy();
    expect(store.exportData()).toBe(payload);
    let replay = emptyLearningState(store.state.owner, store.state.timezone);
    for (const event of store.state.events)
      replay = applyLearningOperation(replay, normalizePrivateSyncOperation(event)).state;
    expect(replay.conversations.at(-1).pendingHints).toEqual(store.active.pendingHints);
    store.$dispose();
  });
  it('停止、账户/题目变化及保存失败均不展示未记录帮助', async () => {
    const store = storeWithImage(),
      ctx = store.writingContext(),
      input = actualConfirmation(store);
    expect(() => store.recordDiagramHelp('other', input)).toThrow('切换');
    expect(() =>
      store.recordDiagramHelp(ctx, { ...input, binding: { ...input.binding, questionKey: 'other@1' } })
    ).toThrow();
    const before = store.exportData();
    const spy = vi.spyOn(learningRepository, 'commit').mockImplementationOnce(() => {
      throw Error('disk failure');
    });
    expect(() => store.recordDiagramHelp(ctx, input)).toThrow('disk failure');
    expect(store.exportData()).toBe(before);
    spy.mockRestore();
    await store.send('停止当前任务', { discussionOnly: true });
    const stopped = store.exportData();
    expect(() => store.recordDiagramHelp(store.writingContext(), input)).toThrow('停止');
    expect(store.exportData()).toBe(stopped);
    store.$dispose();
  });
});
const stubs = {
  view: { template: '<div><slot /></div>' },
  text: { template: '<span><slot /></span>' },
  BaseIcon: true
};
const button = (w, text) => w.findAll('button, [role="button"], [role="tab"]').find((b) => b.text() === text);
const press = async (w, text) => {
  const b = button(w, text);
  expect(b).toBeTruthy();
  await b.trigger('tap');
};
async function fillForce(w) {
  await press(w, '按原图观察');
  await press(w, '合力与加速度');
  await w.get('[aria-label="原图质量"]').setValue('2');
  await press(w, 'kg');
  await w.get('[aria-label="原图合力"]').setValue('4');
  await press(w, 'N');
  await press(w, '静止');
  await press(w, '恒定合力');
  await press(w, '向右');
}
describe('条件选择、动作与生命周期', () => {
  it('原图查看不写帮助，停后仍可读，上下文变化关闭自有查看', async () => {
    const s = fixture(),
      saved = vi.fn(() => true),
      preview = vi.fn(),
      close = vi.fn();
    const previousPreview = uni.previewImage,
      previousClose = uni.closePreviewImage;
    uni.previewImage = preview;
    uni.closePreviewImage = close;
    const w = mount(DiagramConditions, {
      props: {
        state: s,
        question: s.questions[0],
        conversationId: 'c1',
        context: 'ctx',
        stopped: true,
        recordHelp: saved
      },
      global: { stubs }
    });
    try {
      await press(w, '查看原图');
      expect(preview).toHaveBeenCalledWith(expect.objectContaining({ urls: [image], current: image }));
      expect(saved).not.toHaveBeenCalled();
      await w.setProps({ context: 'different-account' });
      expect(close).toHaveBeenCalled();
      expect(w.emitted('confirm')).toBeUndefined();
    } finally {
      w.unmount();
      uni.previewImage = previousPreview;
      uni.closePreviewImage = previousClose;
    }
  });
  it('只有明确同步保存成功才采用场景，重复旧按钮不会重复写帮助', async () => {
    const s = fixture(),
      saved = vi.fn(() => undefined),
      w = mount(DiagramConditions, {
        props: { state: s, question: s.questions[0], conversationId: 'c1', recordHelp: saved },
        global: { stubs }
      });
    await fillForce(w);
    await press(w, '确认条件并观察');
    expect(w.emitted('confirm')).toBeUndefined();
    saved.mockReturnValue(true);
    const old = button(w, '确认条件并观察');
    await old.trigger('tap');
    await old.trigger('tap');
    expect(saved).toHaveBeenCalledTimes(2);
    expect(w.emitted('confirm')).toHaveLength(1);
    w.unmount();
  });
  it('校对原图时只显示当前步骤；折叠释放源条件，小加速度不会显示为精确零', async () => {
    const s = fixture(),
      w = mount(LearningLab, {
        props: {
          state: s,
          question: s.questions[0],
          conversationId: 'c1',
          context: 'ctx',
          recordDiagramHelp: () => true
        },
        global: { stubs }
      });
    await press(w, '互动学习');
    await fillForce(w);
    expect(w.find('.scene').exists()).toBe(false);
    expect(button(w, '播放动画')).toBeUndefined();
    await press(w, '确认条件并观察');
    expect(w.text()).toContain('原图条件已确认');
    await press(w, '互动学习');
    await press(w, '互动学习');
    expect(w.text()).not.toContain('原图条件已确认');
    expect(w.text()).toContain('参考内容');
    await w.setProps({
      request: {
        id: 'small-a',
        recipe: force({ massKg: 20, netForceN: 1 }),
        owner: s.owner,
        learningContext: 'ctx',
        conversationId: 'c1',
        questionKey: `${s.questions[0].id}@${s.questions[0].version}`
      }
    });
    await press(w, '查看新动画');
    expect(w.text()).not.toContain('m/s²');
    await press(w, '减半');
    await press(w, '下一步');
    expect(w.text()).toContain('加速度 0.025 m/s²');
    await w.setProps({
      request: {
        id: 'fraction',
        recipe: force({ massKg: 3, netForceN: 1 }),
        owner: s.owner,
        learningContext: 'ctx',
        conversationId: 'c1',
        questionKey: `${s.questions[0].id}@${s.questions[0].version}`
      }
    });
    await press(w, '查看新动画');
    expect(w.text()).not.toContain('m/s²');
    await press(w, '减半');
    await press(w, '下一步');
    expect(w.text()).toContain('加速度 ≈0.333 m/s²');
    w.unmount();
  });
  it('重复选择当前演示视图不丢失已确认原图或改成固定示例', async () => {
    const s = fixture(),
      saved = vi.fn(() => true),
      w = mount(LearningLab, {
        props: { state: s, question: s.questions[0], conversationId: 'c1', context: 'ctx', recordDiagramHelp: saved },
        global: { stubs }
      });
    try {
      await press(w, '互动学习');
      await fillForce(w);
      await press(w, '确认条件并观察');
      const before = JSON.stringify(s);
      expect(w.findAll('.force-lane')).toHaveLength(2);
      await press(w, '互动观察');
      expect(w.text()).toContain('原图条件已确认');
      expect(w.findAll('.force-lane')).toHaveLength(2);
      expect(w.find('.scene').exists()).toBe(false);
      await press(w, '减半');
      await press(w, '下一步');
      expect(w.text()).toContain('加速度 2 m/s²向右');
      expect(saved).toHaveBeenCalledTimes(1);
      expect(JSON.stringify(s)).toBe(before);
    } finally {
      w.unmount();
    }
  });
  it.each([
    ['合力与加速度', 'tap'],
    ['合力与加速度', 'keyboard'],
    ['功与动能', 'tap'],
    ['功与动能', 'keyboard']
  ])('重复选择当前概念%s（%s）保持原图条件、预测和当前步骤', async (concept, action) => {
    const s = fixture(),
      saved = vi.fn(() => true),
      w = mount(LearningLab, {
        props: { state: s, question: s.questions[0], conversationId: 'c1', context: 'ctx', recordDiagramHelp: saved },
        global: { stubs }
      });
    try {
      await press(w, '互动学习');
      if (concept === '合力与加速度') await fillForce(w);
      else {
        await press(w, '按原图观察');
        await press(w, '功与动能');
        await w.get('[aria-label="原图质量"]').setValue('500');
        await press(w, 'g');
        await w.get('[aria-label="原图合力"]').setValue('1');
        await press(w, 'N');
        for (const label of ['已有速度', '恒定合力', '可视为质点', '惯性系', '不变', '直线']) await press(w, label);
        await w.get('[aria-label="初速度大小"]').setValue('200');
        await press(w, 'cm/s');
        await w.get('[aria-label="初速度方向"]').findAll('button, [role="button"], [role="tab"]')[1].trigger('tap');
        await w.get('[aria-label="持续时间"]').setValue('2');
        await press(w, 's');
        await w
          .findAll('button, [role="button"], [role="tab"]')
          .filter((b) => b.text() === '向左')
          .at(-1)
          .trigger('tap');
      }
      await press(w, '确认条件并观察');
      await press(w, concept === '功与动能' ? '我猜不会' : '减半');
      for (let i = 0; i < 12; i++) await press(w, '下一步');
      const beforeFacts = JSON.stringify(s),
        beforeReadout = w.get('.lab-content').text(),
        selected = w
          .get('[aria-label="用动画理解概念"]')
          .findAll('button, [role="button"], [role="tab"]')
          .find((b) => b.text() === concept);
      expect(w.text()).toContain('原图条件已确认');
      if (concept === '功与动能') expect(beforeReadout).toContain('合力总功 -1 J');
      // Vue单元编译器缺少uni-app的click→tap桥，补齐真实键盘动作的原生事件路径。
      if (action === 'keyboard')
        selected.element.addEventListener('click', () =>
          selected.element.dispatchEvent(new Event('tap', { bubbles: true }))
        );
      await selected.trigger(action === 'keyboard' ? 'keydown' : 'tap', action === 'keyboard' ? { key: 'Enter' } : {});
      expect(w.text()).toContain('原图条件已确认');
      expect(w.get('.lab-content').text()).toBe(beforeReadout);
      expect(button(w, concept === '功与动能' ? '我猜不会' : '减半')).toBeUndefined();
      expect(saved).toHaveBeenCalledTimes(1);
      expect(JSON.stringify(s)).toBe(beforeFacts);
      await press(w, '路程与位移');
      expect(w.text()).not.toContain('原图条件已确认');
      expect(w.find('.scene').exists()).toBe(true);
      expect(saved).toHaveBeenCalledTimes(1);
    } finally {
      w.unmount();
    }
  });
  it('当前题目演示不可用时仍能明确选择同概念的普通示例', async () => {
    const s = fixture();
    s.questions[0].scienceExercise = { contract: 'unknown', input: { template: 'distance_displacement' } };
    const w = mount(LearningLab, {
      props: { state: s, question: s.questions[0], conversationId: 'c1', context: 'ctx' },
      global: { stubs }
    });
    try {
      await press(w, '互动学习');
      expect(w.text()).toContain('这道题的动画暂不可用');
      expect(w.find('.scene').exists()).toBe(false);
      await press(w, '路程与位移');
      expect(w.text()).not.toContain('这道题的动画暂不可用');
      expect(w.find('.scene').exists()).toBe(true);
    } finally {
      w.unmount();
    }
  });
  it('迟到的新演示保留已确认原图，明确查看才替换', async () => {
    const s = fixture(),
      recordHelp = vi.fn(() => true),
      w = mount(LearningLab, {
        props: {
          state: s,
          question: s.questions[0],
          conversationId: 'c1',
          context: 'ctx',
          recordDiagramHelp: recordHelp
        },
        global: { stubs }
      });
    await press(w, '互动学习');
    await fillForce(w);
    await press(w, '确认条件并观察');
    expect(w.text()).toContain('原图条件已确认');
    const before = JSON.stringify(s);
    await w.setProps({
      request: {
        id: 'new-visual',
        recipe: force({ massKg: 20, netForceN: 1 }),
        owner: s.owner,
        learningContext: 'ctx',
        conversationId: 'c1',
        questionKey: `${s.questions[0].id}@${s.questions[0].version}`
      }
    });
    expect(w.text()).toContain('原图条件已确认');
    expect(recordHelp).toHaveBeenCalledTimes(1);
    await press(w, '查看新动画');
    expect(w.text()).not.toContain('原图条件已确认');
    expect(w.text()).toContain('20 kg');
    expect(JSON.stringify(s)).toBe(before);
    expect(recordHelp).toHaveBeenCalledTimes(1);
    w.unmount();
  });
  it('字段默认未知；选择不写事实，全部明确确认且帮助保存后才给场景', async () => {
    const s = fixture(),
      saved = vi.fn(() => true),
      w = mount(DiagramConditions, {
        props: { state: s, question: s.questions[0], conversationId: 'c1', context: 'ctx', recordHelp: saved },
        global: { stubs }
      });
    await press(w, '按原图观察');
    await press(w, '确认条件并观察');
    expect(saved).not.toHaveBeenCalled();
    expect(w.emitted('confirm')).toBeUndefined();
    await press(w, '按原图观察');
    await fillForce(w);
    expect(saved).not.toHaveBeenCalled();
    await press(w, '确认条件并观察');
    expect(saved).toHaveBeenCalledTimes(1);
    expect(w.emitted('confirm')[0][0]).toMatchObject({ massKg: 2, netForceN: 4 });
    await press(w, '修改原图条件');
    expect(w.text()).not.toContain('原图条件已确认');
    await w.setProps({ context: 'new-account' });
    expect(w.find('.diagram-form').exists()).toBe(false);
    w.unmount();
  });
  it('保存失败不显示新演示，停止禁用确认；旧像素替换清空表单', async () => {
    const s = fixture(),
      saved = vi.fn(() => false),
      w = mount(DiagramConditions, {
        props: { state: s, question: s.questions[0], conversationId: 'c1', recordHelp: saved },
        global: { stubs }
      });
    await fillForce(w);
    await press(w, '确认条件并观察');
    expect(w.emitted('confirm')).toBeUndefined();
    expect(w.text()).toContain('未保存');
    await w.setProps({ stopped: true });
    expect(button(w, '确认条件并观察').attributes('disabled')).toBeDefined();
    const next = clone(s);
    next.materials[0].segments[0].preview = png(102);
    await w.setProps({ state: next, stopped: false });
    expect(w.find('.diagram-form').exists()).toBe(false);
    w.unmount();
  });
  it('新的科学比较先预测，播放在忙碌/停止/隐藏时释放，观看不提交事实', async () => {
    vi.useFakeTimers();
    const s = fixture(),
      before = JSON.stringify(s),
      w = mount(LearningLab, { props: { state: s, conversationId: 'c1', context: 'ctx' }, global: { stubs } });
    await press(w, '互动学习');
    await press(w, '合力与加速度');
    expect(button(w, '播放动画').attributes('disabled')).toBeDefined();
    await press(w, '减半');
    await press(w, '播放动画');
    await vi.advanceTimersByTimeAsync(3000);
    expect(w.text()).toContain('时间 1 s / 2 s');
    await w.setProps({ busy: true });
    const text = w.text();
    await vi.advanceTimersByTimeAsync(3000);
    expect(w.text()).toBe(text);
    await w.setProps({ busy: false });
    await press(w, '播放动画');
    await w.setProps({ stopped: true });
    expect(button(w, '播放动画').attributes('disabled')).toBeDefined();
    await w.setProps({ visible: false });
    expect(w.find('.lab-content').exists()).toBe(false);
    expect(JSON.stringify(s)).toBe(before);
    w.unmount();
  });
});
