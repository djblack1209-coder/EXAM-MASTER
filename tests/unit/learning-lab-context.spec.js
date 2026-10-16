import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import LearningLab from '@/components/business/learning/learning-lab.vue';
import { useConversationLearningStore } from '@/stores/modules/conversation-learning.js';
import { emptyLearningState } from '@/services/learning/learning-domain.js';
import { createNoticeQuestion, WRITING_GENRES } from '../../laf-backend/functions/_shared/learning-writing.js';
import { createScienceQuestion } from '../../laf-backend/functions/_shared/learning-science.js';
import { visualRecipe, MOTION_TEMPLATES } from '../../laf-backend/functions/_shared/learning-visual.js';

vi.mock('@dcloudio/uni-app', () => ({ onHide: vi.fn(), onShow: vi.fn(), onBackPress: vi.fn() }));
const stubs = {
  view: { template: '<div><slot /></div>' },
  text: { template: '<span><slot /></span>' },
  BaseIcon: true
};
let wrappers = [];
beforeEach(() => {
  uni.clearStorageSync();
  setActivePinia(createPinia());
  vi.useFakeTimers();
  vi.setSystemTime(Date.parse('2026-10-06T20:00:00Z'));
});
afterEach(() => {
  for (const w of wrappers) w.unmount();
  wrappers = [];
  vi.restoreAllMocks();
  vi.useRealTimers();
});
function lab(props = {}) {
  const w = mount(LearningLab, {
    props: {
      state: emptyLearningState('lab-user', 'America/Los_Angeles'),
      conversationId: 'c',
      context: 'lab-context',
      ...props
    },
    global: { stubs }
  });
  wrappers.push(w);
  return w;
}
const button = (w, label) => w.findAll('button, [role="button"], [role="tab"]').find((b) => b.text() === label);
const selected = (w, label) =>
  (button(w, label).attributes('aria-selected') ?? button(w, label).attributes('aria-pressed')) === 'true';
const request = (w, id = 'visual-1', extra = {}) => ({
  id,
  owner: w.props('state').owner,
  learningContext: w.props('context'),
  conversationId: w.props('conversationId'),
  questionKey: w.props('question') ? `${w.props('question').id}@${w.props('question').version}` : null,
  recipe: visualRecipe({ template: 'constant_net_force', massKg: 3, netForceN: 6, direction: 'left' }),
  ...extra
});
const inputs = [
  { template: 'distance_displacement', outward: 9, backward: 2, direction: 'left' },
  { template: 'constant_net_force', massKg: 3, netForceN: 6, direction: 'left' },
  {
    template: 'accelerated_motion',
    massKg: 0.3,
    initialVelocityMps: 1.1,
    netForceN: 0.2,
    direction: 'right',
    physicalSeconds: 3
  },
  {
    template: 'changing_net_force',
    massKg: 0.6,
    initialVelocityMps: -1,
    segments: [
      { seconds: 2, netForceN: 0.3, direction: 'right' },
      { seconds: 3, netForceN: 0, direction: 'none' }
    ]
  },
  {
    template: 'velocity_time_graph',
    points: [
      { time: 0, velocity: -2 },
      { time: 3, velocity: 1 },
      { time: 5, velocity: 1 }
    ]
  }
];

describe('当前题目决定互动学习的初始视图', () => {
  it('当前运动题观察前隐藏计算范围，帮助失败也不暴露', async () => {
    const q = createScienceQuestion('science', 'c', inputs[2]);
    const help = vi.fn(() => false);
    const w = lab({ question: q, recordScienceHelp: help });
    await button(w, '互动学习').trigger('tap');
    expect(w.find('.force-end').exists()).toBe(false);
    expect(w.find('.force-start').exists()).toBe(false);
    await button(w, '会转向').trigger('tap');
    await button(w, '下一步').trigger('tap');
    expect(w.text()).toContain('观察帮助未保存');
    expect(w.find('.force-end').exists()).toBe(false);
    help.mockReturnValue(true);
    await button(w, '下一步').trigger('tap');
    expect(w.find('.force-end').exists()).toBe(true);
  });
  it.each(WRITING_GENRES.map((g) => [g.id, g.goal]))(
    '%s直接进入本体裁带练，打开不改原记录或教法',
    async (genre, goal) => {
      const store = useConversationLearningStore();
      store.start(goal);
      const before = store.exportData();
      const w = lab({
        state: store.state,
        conversationId: store.active.id,
        context: store.writingContext(),
        question: store.activeQuestion
      });
      expect(w.find('.lab-content').exists()).toBe(false);
      await button(w, '互动学习').trigger('tap');
      expect(selected(w, '逐句带练')).toBe(true);
      expect(w.find('textarea').exists()).toBe(true);
      expect(w.find('.scene').exists()).toBe(false);
      expect(store.activeQuestion.writingExercise.genreId || 'notice').toBe(genre);
      expect(store.exportData()).toBe(before);
    }
  );
  it.each(inputs)('科学题使用原条件%j，预测与打开不保存帮助，明确观察才保存', async (input) => {
    const question = createScienceQuestion('science', 'c', input);
    const help = vi.fn(() => true);
    const w = lab({ question, recordScienceHelp: help });
    const before = JSON.stringify(w.props('state'));
    await button(w, '互动学习').trigger('tap');
    expect(selected(w, '互动观察')).toBe(true);
    expect(help).not.toHaveBeenCalled();
    const prediction = MOTION_TEMPLATES.includes(input.template)
      ? '会转向'
      : input.template === 'constant_net_force'
        ? '减半'
        : '我猜不同';
    await button(w, prediction).trigger('tap');
    expect(help).not.toHaveBeenCalled();
    for (let i = 0; i < 24; i++) await button(w, '下一步').trigger('tap');
    expect(help).toHaveBeenCalledTimes(1);
    expect(help).toHaveBeenCalledWith('lab-context', question.scienceExercise.input);
    await button(w, '独立检验').trigger('tap');
    expect(w.emitted('science')).toEqual([['lab-context', question.scienceExercise.input]]);
    expect(JSON.stringify(w.props('state'))).toBe(before);
  });
  it.each(['unknown-contract', 'invalid-input'])('不把%s科学题伪装成默认示例', async (kind) => {
    const q = createScienceQuestion('science', 'c', inputs[0]);
    if (kind === 'unknown-contract') q.scienceExercise.contract = 'future';
    else q.scienceExercise.input.outward = 10000;
    const help = vi.fn(() => true);
    const w = lab({ question: q, recordScienceHelp: help });
    await button(w, '互动学习').trigger('tap');
    expect(w.text()).toContain('这道题的动画暂不可用');
    expect(button(w, '播放动画')).toBeUndefined();
    expect(w.find('.scene').exists()).toBe(false);
    expect(help).not.toHaveBeenCalled();
    await button(w, '路程与位移').trigger('tap');
    expect(w.text()).not.toContain('这道题的动画暂不可用');
    expect(w.find('.scene').exists()).toBe(true);
    expect(help).not.toHaveBeenCalled();
  });
});

describe('视图选择、迟到演示与上下文边界', () => {
  it('重复选择当前视图保持预测和播放，停止仍收回定时器', async () => {
    const w = lab();
    await button(w, '互动学习').trigger('tap');
    await button(w, '我猜不同').trigger('tap');
    await button(w, '播放动画').trigger('tap');
    const timers = vi.getTimerCount();
    expect(timers).toBe(1);
    await button(w, '互动观察').trigger('tap');
    expect(button(w, '暂停动画')).toBeTruthy();
    expect(button(w, '我猜不同')).toBeUndefined();
    expect(vi.getTimerCount()).toBe(timers);
    await vi.advanceTimersByTimeAsync(1000);
    expect(w.text()).toContain('路程 1.7 m');
    await w.setProps({ stopped: true });
    expect(vi.getTimerCount()).toBe(0);
    expect(w.emitted('science')).toBeUndefined();
  });
  it('未操作视图时接入当前已校验演示，但不播放或写学习事实', () => {
    const recipe = visualRecipe(inputs[1]);
    const w = lab({
      request: {
        id: 'visual-1',
        owner: 'lab-user',
        learningContext: 'lab-context',
        conversationId: 'c',
        questionKey: null,
        recipe
      }
    });
    expect(w.find('.lab-content').exists()).toBe(true);
    expect(selected(w, '互动观察')).toBe(true);
    expect(w.text()).toContain('恒定合力 6 N向左');
    expect(button(w, '播放动画').attributes('disabled')).toBeDefined();
    expect(w.emitted('science')).toBeUndefined();
    expect(w.props('state').attempts).toEqual([]);
  });
  it('写作草稿和关系图选择保持，新演示必须明确查看', async () => {
    const store = useConversationLearningStore();
    store.start('英文论证写作');
    const w = lab({
      state: store.state,
      conversationId: store.active.id,
      context: store.writingContext(),
      question: store.activeQuestion
    });
    await button(w, '互动学习').trigger('tap');
    await w.find('textarea').setValue('A private draft with  double spaces.');
    await button(w, '学习关系图').trigger('tap');
    const before = store.exportData();
    await w.setProps({ request: request(w) });
    expect(selected(w, '学习关系图')).toBe(true);
    await button(w, '逐句带练').trigger('tap');
    expect(w.find('textarea').element.value).toBe('A private draft with  double spaces.');
    await button(w, '查看新动画').trigger('tap');
    expect(selected(w, '互动观察')).toBe(true);
    expect(w.text()).toContain('恒定合力 6 N向左');
    expect(button(w, '查看新动画')).toBeUndefined();
    await button(w, '逐句带练').trigger('tap');
    expect(w.find('textarea').element.value).toBe('A private draft with  double spaces.');
    expect(store.exportData()).toBe(before);
  });
  it('用户收起后迟到演示不重开，重新打开仍需明确查看', async () => {
    const w = lab();
    await button(w, '互动学习').trigger('tap');
    await button(w, '互动学习').trigger('tap');
    await w.setProps({ request: request(w) });
    expect(w.find('.lab-content').exists()).toBe(false);
    await button(w, '互动学习').trigger('tap');
    expect(w.find('.force-lane').exists()).toBe(false);
    expect(button(w, '查看新动画')).toBeTruthy();
  });
  it.each(['owner', 'conversation', 'id', 'version', 'context'])(
    '即使其他字段未变，%s切换也清空草稿/选择并拒绝旧请求',
    async (kind) => {
      const q = createNoticeQuestion('q', 'c');
      const w = lab({ question: q });
      await button(w, '互动学习').trigger('tap');
      await w.find('textarea').setValue('This draft belongs to the old question.');
      await button(w, '学习关系图').trigger('tap');
      const old = request(w);
      await w.setProps(
        kind === 'owner'
          ? { state: { ...w.props('state'), owner: 'other' } }
          : kind === 'conversation'
            ? { conversationId: 'other' }
            : kind === 'context'
              ? { context: 'other-context' }
              : { question: { ...q, [kind]: kind === 'id' ? 'other-q' : 2 } }
      );
      expect(w.find('.lab-content').exists()).toBe(false);
      await w.setProps({ request: old });
      expect(w.find('.lab-content').exists()).toBe(false);
      await button(w, '互动学习').trigger('tap');
      expect(selected(w, '逐句带练')).toBe(true);
      expect(w.find('textarea').element.value).toBe('');
    }
  );
  it.each(['owner', 'learningContext', 'conversationId', 'questionKey', 'recipe'])(
    '拒绝不匹配/不可校验的%s，不改视图或播放',
    async (field) => {
      const w = lab();
      const bad = field === 'recipe' ? { template: 'exec', code: 'anything' } : 'stale';
      await w.setProps({ request: request(w, 'bad', { [field]: bad }) });
      expect(w.find('.lab-content').exists()).toBe(false);
    }
  );
  it.each(['stopped', 'busy', 'visible'])('%s边界不自动打开/应用演示，解除后仍须明确操作', async (kind) => {
    const w = lab({ [kind]: kind !== 'visible' });
    await w.setProps({ request: request(w) });
    expect(w.find('.lab-content').exists()).toBe(false);
    await w.setProps({ [kind]: kind === 'visible' });
    expect(w.find('.lab-content').exists()).toBe(false);
    await button(w, '互动学习').trigger('tap');
    expect(w.find('.force-lane').exists()).toBe(false);
    await button(w, '查看新动画').trigger('tap');
    expect(w.find('.force-lane').exists()).toBe(true);
  });
  it('隐藏收回播放和草稿，保留本上下文明示视图；账户变化恢复题目默认', async () => {
    const q = createNoticeQuestion('q', 'c');
    const w = lab({ question: q });
    await button(w, '互动学习').trigger('tap');
    await button(w, '互动观察').trigger('tap');
    await button(w, '我猜不同').trigger('tap');
    await button(w, '播放动画').trigger('tap');
    expect(vi.getTimerCount()).toBe(1);
    await w.setProps({ visible: false });
    expect(vi.getTimerCount()).toBe(0);
    await w.setProps({ visible: true });
    await button(w, '互动学习').trigger('tap');
    expect(selected(w, '互动观察')).toBe(true);
    await w.setProps({ context: 'other' });
    await button(w, '互动学习').trigger('tap');
    expect(selected(w, '逐句带练')).toBe(true);
  });
});
