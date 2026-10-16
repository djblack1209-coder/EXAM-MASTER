import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, getActivePinia, setActivePinia } from 'pinia';
import { flushPromises, mount } from '@vue/test-utils';
import LearningPage from '@/pages/learning/index.vue';
import CustomModal from '@/components/common/CustomModal.vue';
import JourneyReview from '@/components/business/learning/journey-review.vue';
import LearningOverview from '@/components/business/learning/learning-overview.vue';
import LearningJourney from '@/components/business/learning/learning-journey.vue';
import YoziMascot from '@/components/base/yozi-mascot/yozi-mascot.vue';
import BaseButton from '@/components/base/base-button/base-button.vue';
import BaseOptions from '@/components/base/base-options/base-options.vue';
import BaseInput from '@/components/base/base-input/base-input.vue';
import { useConversationLearningStore } from '@/stores/modules/conversation-learning.js';
import { learningWriteLease } from '@/services/learning/learning-write-lease.js';
import { setMascotReducedMotion } from '@/design/mascot-motion.js';
import { initI18n, setLanguage, t } from '@/i18n/index.js';
import { learningText } from '@/i18n/learning.js';
import messages from '@/pages/learning/messages.js';
vi.mock('@dcloudio/uni-app', () => ({ onLoad: () => {}, onShow: () => {}, onHide: () => {}, onBackPress: () => {} }));
const wrappers = [];
const stubs = {
  view: { template: '<div><slot /></div>' },
  text: { template: '<span><slot /></span>' },
  PrivacyPopup: true,
  LearningLab: true,
  BaseIcon: true
};
function render(component = LearningPage, props = {}) {
  const wrapper = mount(component, { attachTo: document.body, props, global: { stubs } });
  wrappers.push(wrapper);
  return wrapper;
}
function pose(wrapper, name) {
  return wrapper.findAllComponents(YoziMascot).find((child) => child.props('pose') === name);
}
beforeEach(() => {
  uni.clearStorageSync();
  setActivePinia(createPinia());
  initI18n();
  setMascotReducedMotion(false, { persist: false });
  const query = {
    select: vi.fn().mockReturnThis(),
    boundingClientRect: vi.fn().mockReturnThis(),
    selectViewport: vi.fn().mockReturnThis(),
    scrollOffset: vi.fn().mockReturnThis(),
    exec: vi.fn((callback) => callback([null, { scrollTop: 0 }]))
  };
  vi.spyOn(uni, 'createSelectorQuery').mockReturnValue(query);
});
afterEach(() => {
  wrappers
    .splice(0)
    .reverse()
    .forEach((wrapper) => wrapper.unmount());
  for (const store of getActivePinia()?._s.values() || []) store.$dispose();
  learningWriteLease.release();
  setMascotReducedMotion(false, { persist: false });
  setLanguage('zh-CN');
  vi.restoreAllMocks();
});
describe('learning interface states preserve learning facts', () => {
  it.each([
    ['offline', null, 'idle', '连接模型', 'neutral'],
    ['offline', null, 'error', '连接模型', 'neutral'],
    ['local', 'connector_verified', 'error', '本地连接就绪', 'apricot'],
    ['local', 'model_verified', 'idle', '本机模型已连接', 'mint'],
    ['cloud', 'connected', 'ready', '最近调用成功', 'mint'],
    ['cloud', 'failed', 'ready', '最近调用失败', 'coral'],
    ['cloud', 'stale', 'ready', '连接需重新验证', 'apricot'],
    ['cloud', 'connected', 'error', '模型列表暂不可用', 'coral']
  ])('operation errors preserve the %s connection evidence (%s, %s)', async (mode, status, phase, label, tone) => {
    const store = useConversationLearningStore();
    store.start('12 + 8');
    store.submit('19', true);
    store.selectedMode = mode;
    store.modelListState = { phase, message: phase === 'error' ? '读取服务暂不可用' : '' };
    if (mode === 'local') store.localConnection = { status };
    if (mode === 'cloud') {
      store.modelId = 'fixture-cloud';
      store.models = [{ id: 'fixture-cloud', connectionStatus: status }];
    }
    const wrapper = render(),
      before = store.exportData();
    for (const error of ['请求已取消，费用状态请查看模型用量', '学习天数必须在 1 到 365 之间']) {
      store.error = error;
      await flushPromises();
      expect(wrapper.get('.connection-pill').text()).toBe(label);
      expect(wrapper.get('.connection-pill .base-tag').classes()).toContain(`base-tag--${tone}`);
      expect(wrapper.get('#learning-request-error').text()).toContain(error);
      expect(store.exportData()).toBe(before);
    }
    setLanguage('en');
    await flushPromises();
    expect(wrapper.get('.connection-pill').text()).not.toMatch(/[\u3400-\u9fff]/);
    expect(store.exportData()).toBe(before);
  });
  it('model failure is visible and focused beside recovery without writing or changing an original answer', async () => {
    const store = useConversationLearningStore();
    store.start('12 + 8');
    store.submit('19', true);
    expect(store.state.attempts).toHaveLength(1);
    const wrapper = render(),
      before = store.exportData(),
      scroll = vi.fn(),
      originalScroll = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = scroll;
    try {
      store.error = messages['zh-CN']['learning.notice.networkNoReply'];
      await flushPromises();
      const error = wrapper.get('#learning-request-error');
      expect(document.activeElement).toBe(error.element);
      expect(scroll).toHaveBeenCalledWith({ block: 'start', behavior: 'auto' });
      expect(error.get('[role="alert"]').text()).toContain('没有可恢复的回复');
      expect(error.element.closest('.conversation-area')).not.toBeNull();
      expect(store.exportData()).toBe(before);
      setLanguage('en');
      await flushPromises();
      expect(error.text()).toContain('there is no reply to recover');
      expect(store.exportData()).toBe(before);
      store.error = '';
      await flushPromises();
      expect(wrapper.find('#learning-request-error').exists()).toBe(false);
      expect(store.exportData()).toBe(before);
    } finally {
      Element.prototype.scrollIntoView = originalScroll;
    }
  });
  it('a chat goal locates its clarification without creating a route or answers', async () => {
    const store = useConversationLearningStore(),
      wrapper = render();
    const scroll = vi.fn(),
      originalScroll = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = scroll;
    try {
      const goalInput = wrapper.get('#learning-composer').findComponent(BaseInput);
      await goalInput.get('textarea').setValue('分数加减与乘除');
      const start = wrapper.get('#learning-composer [aria-label="发送"]');
      await start.trigger('keydown', { key: 'Enter' });
      await flushPromises();
      const entry = wrapper.get('#learning-chat-latest');
      expect(document.activeElement).toBe(entry.element);
      expect(scroll).toHaveBeenCalledWith({ block: 'start', behavior: 'auto' });
      expect(wrapper.get('.conversation-area').text()).toContain(t('learning.chat.question'));
      expect(store.state.conversations).toHaveLength(1);
      expect(store.state.attempts).toHaveLength(0);
      expect(store.state.questions).toHaveLength(0);
      expect(store.active.journey).toBeUndefined();
    } finally {
      Element.prototype.scrollIntoView = originalScroll;
    }
  });
  it('route choices start empty, remain drafts when cancelled and save only the selected modules', async () => {
    const store = useConversationLearningStore();
    store.start('分数加减与乘除');
    const before = store.exportData(),
      wrapper = render(LearningJourney, { inline: true });
    const button = (label) => wrapper.findAll('button').find((item) => item.text().trim() === label);
    await button(t('learning.klc')).trigger('keydown', { key: 'Enter' });
    expect(wrapper.get('[data-test="journey-save"]').attributes('disabled')).toBeDefined();
    expect(wrapper.findAll('.journey-module-options [aria-pressed="true"]')).toHaveLength(0);
    await wrapper
      .findAll('.journey-module-options button')
      .find((item) => item.text().includes('分数加减'))
      .trigger('keydown', { key: 'Enter' });
    expect(store.exportData()).toBe(before);
    await button(t('learning.k8s')).trigger('keydown', { key: 'Enter' });
    expect(store.exportData()).toBe(before);
    await button(t('learning.klc')).trigger('keydown', { key: 'Enter' });
    expect(wrapper.findAll('.journey-module-options [aria-pressed="true"]')).toHaveLength(0);
    for (const label of ['分数加减', '分数乘除'])
      await wrapper
        .findAll('.journey-module-options button')
        .find((item) => item.text().includes(label))
        .trigger('keydown', { key: 'Enter' });
    await wrapper.get('[data-test="journey-save"]').trigger('keydown', { key: 'Enter' });
    await flushPromises();
    expect(store.active.journey.moduleIds).toEqual(['fraction-add-subtract', 'fraction-multiply-divide']);
    expect(store.state.attempts).toHaveLength(0);
    expect(document.activeElement).toBe(wrapper.get('#learning-journey-panel').element);
    const saved = store.exportData();
    await button(t('learning.k1m')).trigger('keydown', { key: 'Enter' });
    expect(wrapper.findAll('.journey-module-options [aria-pressed="true"]')).toHaveLength(2);
    await button(t('learning.k8s')).trigger('keydown', { key: 'Enter' });
    expect(store.exportData()).toBe(saved);
  });
  it('stopping reveals a primary resume action before the question and preserves original answers', async () => {
    const store = useConversationLearningStore();
    store.start('12 + 8');
    store.submit('20', true);
    const originals = JSON.stringify(store.state.attempts),
      wrapper = render(),
      scroll = vi.fn(),
      originalScroll = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = scroll;
    try {
      const stop = wrapper.get('#learning-composer [aria-label="停止当前任务"]');
      await stop.trigger('keydown', { key: 'Enter' });
      await flushPromises();
      const state = wrapper.get('#learning-stop-state');
      expect(document.activeElement).toBe(state.element);
      expect(
        state.element.compareDocumentPosition(wrapper.get('#active-learning-question').element) &
          Node.DOCUMENT_POSITION_FOLLOWING
      ).toBeTruthy();
      const resume = state.findComponent(BaseButton);
      expect(resume.props('variant')).toBe('primary');
      expect(store.active.stopped).toBe(true);
      expect(JSON.stringify(store.state.attempts)).toBe(originals);
      const stopped = store.exportData();
      store.error = '请求已取消，费用状态请查看模型用量';
      await flushPromises();
      expect(document.activeElement).toBe(state.element);
      expect(store.exportData()).toBe(stopped);
      await resume.trigger('keydown', { key: 'Enter' });
      await flushPromises();
      expect(store.active.stopped).toBe(false);
      expect(wrapper.find('#learning-stop-state').exists()).toBe(false);
      expect(document.activeElement).toBe(wrapper.get('#active-learning-question').element);
      expect(JSON.stringify(store.state.attempts)).toBe(originals);
    } finally {
      Element.prototype.scrollIntoView = originalScroll;
    }
  });
  it('resuming a completed group locates its saved results without adding an answer', async () => {
    const store = useConversationLearningStore();
    store.start('分数练习');
    store.configureJourney(store.journeyContext(), {
      title: '分数练习',
      startDay: store.todaySummary.day,
      durationDays: 2,
      minutes: 15,
      mode: 'batch',
      moduleIds: ['fraction-add-subtract']
    });
    const group = store.startTraining(store.journeyContext(), 'fraction-add-subtract', 1);
    store.submitTraining(store.journeyContext(), group.id, ['11/12']);
    await store.send('停止当前任务');
    const originals = JSON.stringify(store.state.attempts),
      wrapper = render();
    const resume = wrapper.get('#learning-stop-state').findComponent(BaseButton);
    await resume.trigger('keydown', { key: 'Enter' });
    await flushPromises();
    expect(store.active.stopped).toBe(false);
    expect(document.activeElement).toBe(wrapper.get('#learning-training-panel').element);
    expect(wrapper.get('#learning-training-panel').text()).toContain('11/12');
    expect(JSON.stringify(store.state.attempts)).toBe(originals);
  });
  it('opening and reopening a module locates its results; revealing grading evidence preserves every fact', async () => {
    const store = useConversationLearningStore();
    store.start('分数练习');
    store.configureJourney(store.journeyContext(), {
      title: '分数练习',
      startDay: new Date().toLocaleDateString('en-CA', { timeZone: store.state.timezone }),
      durationDays: 2,
      minutes: 15,
      mode: 'batch',
      moduleIds: ['fraction-add-subtract', 'fraction-multiply-divide']
    });
    const group = store.startTraining(store.journeyContext(), 'fraction-add-subtract', 1);
    store.submitTraining(store.journeyContext(), group.id, ['22/24']);
    store.selectTraining(null);
    const before = store.exportData();
    const wrapper = render(LearningJourney);
    const scroll = vi.fn();
    const originalScroll = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = scroll;
    try {
      await wrapper.get('[data-test="journey-module-fraction-add-subtract"]').trigger('keydown', { key: 'Enter' });
      await flushPromises();
      const panel = wrapper.get('#learning-training-panel');
      expect(scroll).toHaveBeenCalledWith({ block: 'start', behavior: 'auto' });
      expect(document.activeElement).toBe(panel.element);
      expect(panel.text()).toContain('22/24');
      expect(panel.text()).not.toContain('fraction-arithmetic-v1');
      const basis = panel.findAll('button').find((button) => button.text() === t('learning.viewGradingBasis'));
      await basis.trigger('keydown', { key: 'Enter' });
      expect(basis.attributes('aria-expanded')).toBe('true');
      expect(panel.text()).toContain('fraction-arithmetic-v1');
      await basis.trigger('keydown', { key: 'Enter' });
      expect(panel.text()).not.toContain('fraction-arithmetic-v1');
      await wrapper.get('[data-test="journey-module-fraction-add-subtract"]').trigger('keydown', { key: 'Enter' });
      await flushPromises();
      expect(document.activeElement).toBe(panel.element);
      expect(store.exportData()).toBe(before);
    } finally {
      Element.prototype.scrollIntoView = originalScroll;
    }
  });
  it('thinks in the chat empty state without creating a conversation', async () => {
    const store = useConversationLearningStore(),
      wrapper = render();
    expect(pose(wrapper.find('.welcome-copy'), 'think').props('play')).toBe('loop');
    await flushPromises();
    expect(wrapper.find('.composer textarea').exists()).toBe(true);
    expect(store.state.conversations).toHaveLength(0);
  });
  it('thinking loops while replying, pauses for answer input, and stops on reply or error', async () => {
    const store = useConversationLearningStore();
    store.start('12 + 8');
    const wrapper = render();
    store.busy = true;
    await flushPromises();
    expect(pose(wrapper, 'think').props('play')).toBe('loop');
    const input = wrapper.find('.composer textarea');
    await input.trigger('focus');
    expect(pose(wrapper, 'think').attributes('data-moving')).toBe('false');
    await input.trigger('blur');
    store.busy = false;
    await flushPromises();
    expect(wrapper.find('.reply-state').exists()).toBe(false);
    store.busy = true;
    store.error = '合成连接错误';
    await flushPromises();
    expect(wrapper.find('.reply-state').exists()).toBe(false);
    expect(wrapper.find('.base-state--error').attributes('role')).toBe('alert');
    expect(store.state.attempts).toHaveLength(0);
  });
  it.each([
    ['20', 'celebrate', 'once', 'mint'],
    ['19', 'encourage', 'once', 'coral']
  ])('reliable answer %s displays %s once from the existing result', async (answer, expected, play, tone) => {
    const store = useConversationLearningStore();
    store.start('12 + 8');
    const wrapper = render();
    store.submit(answer, true);
    await flushPromises();
    const feedback = wrapper.find('.answer-feedback');
    expect(pose(feedback, expected).props('play')).toBe(play);
    expect(feedback.find('.base-tag').classes()).toContain(`base-tag--${tone}`);
    expect(store.state.attempts).toHaveLength(1);
  });
  it('subjective answers stay pending and show static reading without a correct reward', async () => {
    const store = useConversationLearningStore();
    store.start('英文论证写作');
    const wrapper = render();
    store.submit('保留原答及其  spacing。', true);
    await flushPromises();
    expect(pose(wrapper.find('.answer-feedback'), 'read').props('play')).toBe('none');
    expect(wrapper.find('.answer-feedback .base-tag').classes()).toContain('base-tag--apricot');
    expect(pose(wrapper.find('.answer-feedback'), 'celebrate')).toBeUndefined();
    expect(store.state.attempts[0].grade.status).toBe('pending');
    expect(store.state.attempts[0].answer).toBe('保留原答及其  spacing。');
  });
  it('the H5 click listener receives one keyboard activation after a disabled button becomes available', async () => {
    const click = vi.fn();
    const wrapper = render(BaseButton, { disabled: true, onClick: click });
    await wrapper.get('button').trigger('keydown', { key: 'Enter' });
    expect(click).not.toHaveBeenCalled();
    await wrapper.setProps({ disabled: false });
    await wrapper.get('button').trigger('keydown', { key: 'Enter' });
    expect(click).toHaveBeenCalledTimes(1);
    await wrapper.get('button').trigger('keydown', { key: 'Enter', repeat: true });
    expect(click).toHaveBeenCalledTimes(1);
  });
  it('options only change a draft; keyboard submit saves exactly one original answer', async () => {
    const store = useConversationLearningStore();
    store.start('学习物理');
    store.startScience(store.writingContext(), {
      template: 'distance_displacement',
      outward: 6,
      backward: 4,
      direction: 'right'
    });
    const wrapper = render(),
      answer = store.activeQuestion.validation.answer;
    const before = store.exportData();
    await wrapper.find(`.base-option[data-value="${answer}"]`).trigger('keydown', { key: 'Enter' });
    expect(store.exportData()).toBe(before);
    expect(wrapper.find('.composer textarea').element.value).toBe(answer);
    const submit = wrapper.findAll('button').find((button) => button.text().trim() === t('learning.submitAnswer'));
    await submit.trigger('keydown', { key: 'Enter' });
    await flushPromises();
    expect(store.state.attempts).toHaveLength(1);
    expect(store.state.attempts[0].answer).toBe(answer);
    expect(wrapper.find(`.base-option[data-value="${answer}"]`).attributes('data-state')).toBe('correct');
  });
  it('multiple choices have checkbox semantics and keyboard toggling emits only draft values', async () => {
    const wrapper = render(BaseOptions, {
      multiple: true,
      modelValue: ['A'],
      options: [
        { value: 'A', label: 'One' },
        { value: 'B', label: 'Two' }
      ],
      label: 'Choices'
    });
    await wrapper.findAll('[role="checkbox"]')[1].trigger('keydown', { key: ' ' });
    expect(wrapper.emitted('update:modelValue')).toEqual([[['A', 'B']]]);
    expect(wrapper.emitted('submit')).toBeUndefined();
  });
  it('keeps earlier answers reachable from an otherwise empty daily statistics view', async () => {
    const now = Date.now();
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      vi.setSystemTime(now - 2 * 86400000);
      const store = useConversationLearningStore();
      store.start('12 + 8');
      store.submit('19', true);
      vi.setSystemTime(now);
      store.refresh();
      const before = store.exportData();
      const wrapper = render(LearningOverview, { view: 'study-detail', initialExpanded: true, showNavigation: false });
      expect(wrapper.get('.overview-empty').text()).toContain(t('learning.history'));
      expect(wrapper.find('.base-stat').exists()).toBe(false);
      await wrapper.get('.overview-empty .base-button').trigger('keydown', { key: 'Enter' });
      await flushPromises();
      expect(wrapper.find('.overview-empty').exists()).toBe(false);
      await wrapper.setProps({ view: 'mistake' });
      expect(wrapper.text()).toContain('19');
      expect(store.exportData()).toBe(before);
    } finally {
      vi.useRealTimers();
    }
  });
  it('empty statistics have one action; reduced motion stops the thinking pose', async () => {
    const overview = render(LearningOverview);
    expect(overview.findComponent(YoziMascot).exists()).toBe(true);
    expect(overview.findAll('.overview-empty .base-button')).toHaveLength(1);
    expect(overview.find('.base-stat').exists()).toBe(false);
    setMascotReducedMotion(true, { persist: false });
    const wrapper = render();
    await flushPromises();
    expect(pose(wrapper, 'think').attributes('data-moving')).toBe('false');
  });
  it('confirmed daily recap celebrates once without changing the saved original answers', async () => {
    const store = useConversationLearningStore();
    store.start('学习数学');
    store.configureJourney(store.journeyContext(), {
      title: '合成路线',
      startDay: store.todaySummary.day,
      durationDays: 7,
      minutes: 30,
      mode: 'batch',
      moduleIds: ['arithmetic-add']
    });
    const group = store.startTraining(store.journeyContext(), 'arithmetic-add', 1);
    const question = store.activeQuestion;
    store.submitTraining(store.journeyContext(), group.id, [String(question.validation.answer)]);
    const wrapper = render(JourneyReview),
      originals = JSON.stringify(store.state.attempts);
    expect(pose(wrapper, 'celebrate')).toBeUndefined();
    await wrapper.find('[data-test="recap-confirm"]').trigger('keydown', { key: 'Enter' });
    await flushPromises();
    expect(pose(wrapper, 'celebrate').props('play')).toBe('once');
    expect(JSON.stringify(store.state.attempts)).toBe(originals);
  });
  it('search focus appears for keyboard use and disappears for pointer use', async () => {
    const wrapper = render(BaseInput, { label: 'Search', hideLabel: true, focusVisibleOnly: true });
    document.dispatchEvent(new Event('pointerdown'));
    await wrapper.find('input').trigger('focus');
    expect(wrapper.find('.base-field__group').classes()).not.toContain('is-keyboard-focused');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab' }));
    await flushPromises();
    expect(wrapper.find('.base-field__group').classes()).toContain('is-keyboard-focused');
    await wrapper.find('input').trigger('blur');
    expect(wrapper.find('.base-field__group').classes()).not.toContain('is-keyboard-focused');
  });
  it('BaseInput preserves native input events, numeric values, readonly and hidden accessible labels', async () => {
    const wrapper = render(BaseInput, { modelValue: 2, label: 'Quantity', hideLabel: true });
    const input = wrapper.find('input');
    expect(input.element.value).toBe('2');
    expect(input.attributes('aria-label')).toBe('Quantity');
    expect(input.attributes('aria-labelledby')).toBeUndefined();
    await input.setValue('3');
    expect(wrapper.emitted('update:modelValue')).toEqual([['3']]);
    expect(wrapper.emitted('input')).toHaveLength(1);
    await wrapper.setProps({ readonly: true });
    await input.setValue('4');
    expect(wrapper.emitted('input')).toHaveLength(1);
  });
});
describe('learning i18n', () => {
  it('localizes platform receipts, observed preferences and modal actions while preserving authored content', async () => {
    const store = useConversationLearningStore();
    store.start('12 + 8');
    store.submit('20', true);
    store.commit('message.add', { conversationId: store.active.id, role: 'assistant', content: '答对了。' });
    store.commit('profile.set', {
      field: 'foundation',
      value: '本次独立完成',
      source: 'self_report',
      scope: '当前任务'
    });
    const before = store.exportData();
    const wrapper = render();
    setLanguage('en');
    await flushPromises();
    expect(wrapper.get('.message.notice').text()).toBe('Correct.');
    expect(wrapper.findAll('.message.assistant').at(-1).text()).toBe('答对了。');
    await wrapper.get('.connection-pill').trigger('tap');
    await flushPromises();
    const profile = wrapper.findAllComponents(BaseButton).find((button) => button.text() === 'Goals and plans');
    expect(profile).toBeTruthy();
    await profile.trigger('tap');
    await flushPromises();
    expect(wrapper.text()).toContain('Completed independently this time');
    expect(wrapper.text()).toContain('本次独立完成');
    const hint = wrapper.findAllComponents(BaseButton).find((button) => button.text() === 'Record a hint used');
    await hint.trigger('tap');
    await flushPromises();
    const modal = wrapper.findAllComponents(CustomModal).find((component) => component.props('visible'));
    expect(modal).toBeTruthy();
    expect(modal.props('confirmText')).toBe('Confirm');
    expect(modal.props('cancelText')).toBe('Cancel');
    expect(modal.props('title')).not.toMatch(/[\u3400-\u9fff]/);
    expect(store.exportData()).toBe(before);
    expect(learningText('这次答错了，已加入错题。')).toBe('Saved to your mistakes. Try again.');
    expect(learningText('作答已保存，判分待核对。')).toBe('Answer saved. Grade pending verification.');
  });
  it('translates every learning style while retaining the stored preference values', async () => {
    const store = useConversationLearningStore();
    store.start('学习物理');
    const before = store.exportData();
    const wrapper = render();
    setLanguage('en');
    await flushPromises();
    await wrapper.get('.connection-pill').trigger('tap');
    await flushPromises();
    const styles = wrapper.get('.rhythm-options').text();
    expect(styles).toContain('Stay focused');
    expect(styles).toContain('Take it step by step');
    expect(styles).toContain('Review and practice');
    expect(styles).not.toMatch(/[\u3400-\u9fff]/);
    expect(store.exportData()).toBe(before);
  });
  it('keeps existing question actions together, with one primary submit and a compact result before them', async () => {
    const store = useConversationLearningStore();
    store.start('12 + 8');
    const wrapper = render();
    await wrapper.get('.connection-pill').trigger('tap');
    await flushPromises();
    const actions = wrapper.get('.question-actions');
    const buttons = actions.findAllComponents(BaseButton);
    expect(buttons.filter((button) => button.props('variant') === 'primary')).toHaveLength(1);
    expect(
      buttons.filter((button) => button.props('variant') === 'quiet').every((button) => button.props('small'))
    ).toBe(true);
    expect(actions.text()).toContain('要个提示');
    expect(actions.text()).toContain('变式练习');
    expect(actions.text()).toContain('校对题目');
    store.submit('20', true);
    await flushPromises();
    const result = wrapper.get('.answer-feedback');
    expect(pose(result, 'celebrate').props('size')).toBe('small');
    expect(result.element.compareDocumentPosition(actions.element) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(store.state.attempts).toHaveLength(1);
  });
  it.each(['zh-CN', 'en'])(
    'the %s hint button delivers actual help without asking the learner to supply it',
    async (language) => {
      const store = useConversationLearningStore();
      store.start('12 + 8');
      const wrapper = render();
      setLanguage(language);
      await flushPromises();
      const label = language === 'en' ? 'Give me a hint' : '要个提示';
      await wrapper
        .findAll('button')
        .find((button) => button.text().trim() === label)
        .trigger('tap');
      await flushPromises();
      expect(store.active.pendingHints).toHaveLength(1);
      expect(store.active.pendingHints[0]).toMatchObject({ level: 1 });
      expect(store.active.pendingHints[0].content).not.toContain('20');
      expect(wrapper.text()).toContain(store.active.pendingHints[0].content);
      expect(wrapper.getComponent(CustomModal).props('visible')).toBe(false);
      expect(store.state.attempts).toHaveLength(0);
      expect(store.state.events.filter((event) => event.type === 'teaching.deliver')).toHaveLength(1);
    }
  );
  it('disables help requests and manual help records when the task is stopped', async () => {
    const store = useConversationLearningStore();
    store.start('12 + 8');
    const wrapper = render();
    await store.send('停止当前任务');
    await flushPromises();
    await wrapper.get('.connection-pill').trigger('tap');
    await flushPromises();
    const hint = wrapper.findAll('button').find((button) => button.text().trim() === '要个提示');
    expect(hint.attributes('disabled')).toBeDefined();
    const record = wrapper.findAll('button').find((button) => button.text().trim() === '记录使用的提示');
    expect(record.attributes('disabled')).toBeDefined();
    expect(store.active.pendingHints).toHaveLength(0);
    expect(store.active.stopped).toBe(true);
  });
  it('uses one-row auto-growing input for the composer without changing draft-only entry', async () => {
    const store = useConversationLearningStore();
    store.start('12 + 8');
    const wrapper = render();
    const input = wrapper.get('.composer').findComponent(BaseInput);
    expect(input.props('autoGrow')).toBe(true);
    expect(input.props('maxRows')).toBe(5);
    expect(input.get('textarea').attributes('rows')).toBe('1');
    const before = store.exportData();
    await input.get('textarea').setValue('第一行\n第二行\n第三行');
    expect(store.exportData()).toBe(before);
    expect(store.state.attempts).toHaveLength(0);
  });
  it('translates the writing shortcuts without changing their stored topic values', () => {
    setLanguage('en', { persist: false });
    for (const topic of [
      '英文通知写作',
      '英文说明写作',
      '英文论证写作',
      '英文邮件写作',
      '英文学术讨论',
      '中文叙事写作'
    ]) {
      expect(learningText(topic)).not.toMatch(/[\u3400-\u9fff]/);
    }
    const store = useConversationLearningStore();
    store.start('英文论证写作');
    expect(store.active.goal).toBe('英文论证写作');
    expect(learningText('英文论证')).toBe('English argument');
    expect(learningText('回应题目')).toBe('Response to the prompt');
    const wrapper = render();
    expect(wrapper.get('.composer textarea').attributes('placeholder')).not.toMatch(/[\u3400-\u9fff]/);
  });
  it('has matching complete dictionaries and preserves interpolation parameters in English', () => {
    expect(Object.keys(messages.en).sort()).toEqual(Object.keys(messages['zh-CN']).sort());
    for (const [key, value] of Object.entries(messages['zh-CN'])) {
      expect(messages.en[key], key).toBeTruthy();
      expect(messages.en[key], key).not.toContain('[translation pending]');
      expect(messages.en[key], key).not.toMatch(/[\u3400-\u9fff]/);
      const parameters = (text) => [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();
      expect(parameters(messages.en[key]), key).toEqual(parameters(value));
    }
  });
  it('defaults to Chinese, updates controls immediately, and leaves question and original content untouched', async () => {
    const store = useConversationLearningStore();
    store.start('12 + 8');
    const question = store.activeQuestion.prompt,
      wrapper = render();
    expect(wrapper.text()).toContain('提交答案');
    const before = store.exportData();
    setLanguage('en');
    await flushPromises();
    expect(wrapper.text()).toContain('Submit answer');
    expect(wrapper.text()).not.toContain('要个提示');
    expect(wrapper.text()).toContain(question);
    expect(store.exportData()).toBe(before);
    expect(learningText('模型未连接')).toBe('Model not connected');
    expect(learningText('用户自写的故事')).toBe('用户自写的故事');
  });
});
