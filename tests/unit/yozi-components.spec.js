import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import BaseButton from '@/components/base/base-button/base-button.vue';
import WotButton from '@/components/base/base-button/wot-button.vue';
import BaseChip from '@/components/base/base-chip/base-chip.vue';
import BaseSegmented from '@/components/base/base-segmented/base-segmented.vue';
import BaseTag from '@/components/base/base-tag/base-tag.vue';
import BaseOptions from '@/components/base/base-options/base-options.vue';
import BaseInput from '@/components/base/base-input/base-input.vue';
import BaseCheckbox from '@/components/base/base-checkbox/base-checkbox.vue';
import BaseCard from '@/components/base/base-card/base-card.vue';
import BaseStat from '@/components/base/base-stat/base-stat.vue';
import BaseBubble from '@/components/base/base-bubble/base-bubble.vue';
import BaseEmpty from '@/components/base/base-empty/base-empty.vue';
import BaseLoading from '@/components/base/base-loading/base-loading.vue';
import BaseToast from '@/components/base/base-toast/base-toast.vue';
import BaseListRow from '@/components/base/base-list-row/base-list-row.vue';
import BaseIcon from '@/components/base/base-icon/base-icon.vue';
import YoziMascot from '@/components/base/yozi-mascot/yozi-mascot.vue';
import AnimatedAvatar from '@/components/base/animated-avatar/animated-avatar.vue';
import CustomModal from '@/components/common/CustomModal.vue';
import { getIconPath, getIconMarkup } from '@/components/base/base-icon/icons.js';
import { BOARD_ICONS } from '@/components/base/base-icon/board-icons.js';
import { initI18n, setLanguage } from '@/i18n/index.js';
import { setMascotReducedMotion, setMascotInputFocused } from '@/design/mascot-motion.js';
import { readFileSync } from 'node:fs';

const lifecycle = vi.hoisted(() => ({ show: [], hide: [] }));
vi.mock('@dcloudio/uni-app', () => ({
  onShow: (fn) => lifecycle.show.push(fn),
  onHide: (fn) => lifecycle.hide.push(fn)
}));
const wrappers = [];
let observers = [],
  media;
const elementStubs = { view: { template: '<div><slot /></div>' }, text: { template: '<span><slot /></span>' } };
function render(component, props = {}, slots = {}, stubs = {}) {
  const wrapper = mount(component, {
    attachTo: document.body,
    props,
    slots,
    global: { stubs: { ...elementStubs, ...stubs } }
  });
  wrappers.push(wrapper);
  return wrapper;
}
class Observer {
  constructor(callback) {
    this.callback = callback;
    this.disconnect = vi.fn();
    observers.push(this);
  }
  observe(element) {
    this.element = element;
    this.callback([{ isIntersecting: true }]);
  }
  visible(value) {
    this.callback([{ isIntersecting: value }]);
  }
}
beforeEach(() => {
  observers = [];
  lifecycle.show = [];
  lifecycle.hide = [];
  media = {
    matches: false,
    addEventListener: vi.fn((name, fn) => {
      media.change = fn;
    }),
    removeEventListener: vi.fn()
  };
  vi.stubGlobal('IntersectionObserver', Observer);
  vi.spyOn(window, 'matchMedia').mockReturnValue(media);
  setMascotReducedMotion(false, { persist: false });
  initI18n();
});
afterEach(() => {
  for (const wrapper of wrappers.splice(0).reverse()) wrapper.unmount();
  document.body.innerHTML = '';
  setMascotReducedMotion(false, { persist: false });
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('canonical controls and drafts', () => {
  it.each(['primary', 'secondary', 'quiet', 'danger', 'apple', 'google', 'wechat'])(
    'renders %s buttons with one activation and keyboard contract',
    async (variant) => {
      const w = render(BaseButton, { variant }, { default: 'Submit' });
      expect(w.classes()).toContain(`base-button--${variant}`);
      await w.trigger('keydown', { key: 'Enter' });
      await w.trigger('keydown', { key: ' ', repeat: true });
      expect(w.emitted('tap')).toHaveLength(1);
      await w.setProps({ disabled: true });
      await w.trigger('tap');
      await w.trigger('keydown', { key: ' ' });
      expect(w.attributes('aria-disabled')).toBe('true');
      expect(w.emitted('tap')).toHaveLength(1);
      await w.setProps({ disabled: false, loading: true });
      await w.trigger('tap');
      expect(w.attributes('aria-busy')).toBe('true');
      expect(w.text()).toContain('加载中');
      expect(w.find('.base-button__spinner').exists()).toBe(true);
      expect(w.findComponent(YoziMascot).exists()).toBe(false);
      expect(w.emitted('tap')).toHaveLength(1);
    }
  );
  it('icon, small and block variants retain labels and size classes; Wot delegates disabled/loading', async () => {
    const w = render(BaseButton, { icon: 'up', iconOnly: true, label: 'Send', small: true, block: true });
    expect(w.attributes('aria-label')).toBe('Send');
    expect(w.classes()).toEqual(expect.arrayContaining(['is-icon', 'is-small', 'is-block']));
    const adapter = render(WotButton, { loading: true, plain: true });
    await adapter.trigger('tap');
    expect(adapter.emitted('click')).toBeUndefined();
    await adapter.setProps({ loading: false });
    await adapter.trigger('tap');
    expect(adapter.emitted('click')).toHaveLength(1);
  });
  it('chip toggles only its draft and has pressed semantics', async () => {
    const w = render(BaseChip, { modelValue: false, count: 20 }, { default: 'Middle' });
    expect(w.attributes('aria-pressed')).toBe('false');
    await w.trigger('keydown', { key: ' ' });
    expect(w.emitted('update:modelValue')).toEqual([[true]]);
    await w.setProps({ disabled: true });
    await w.trigger('tap');
    expect(w.emitted('update:modelValue')).toHaveLength(1);
  });
  it('action chip is keyboard reachable, fires once, and never changes a selection draft', async () => {
    const w = render(BaseChip, { action: true, surface: 'glass' }, { default: 'Give me a hint' });
    expect(w.attributes('aria-pressed')).toBeUndefined();
    expect(w.attributes('tabindex')).toBe('0');
    await w.trigger('keydown', { key: 'Enter' });
    expect(w.emitted('tap')).toHaveLength(1);
    expect(w.emitted('click')).toHaveLength(1);
    expect(w.emitted('update:modelValue')).toBeUndefined();
    await w.trigger('keydown', { key: ' ', repeat: true });
    expect(w.emitted('tap')).toHaveLength(1);
    await w.setProps({ disabled: true });
    await w.trigger('tap');
    await w.trigger('keydown', { key: ' ' });
    expect(w.emitted('tap')).toHaveLength(1);
    expect(w.attributes('tabindex')).toBe('-1');
  });
  it('segmented has one selected tab, roving focus, wrap, Home/End and skips disabled tabs', async () => {
    const options = [
      { value: 'today', label: 'Today' },
      { value: 'week', label: 'Week', disabled: true },
      { value: 'all', label: 'All' }
    ];
    const w = render(BaseSegmented, { options, modelValue: 'today', label: 'Period' });
    expect(w.findAll('[aria-selected="true"]')).toHaveLength(1);
    await w.findAll('[role="tab"]')[0].trigger('keydown', { key: 'ArrowRight' });
    expect(w.emitted('update:modelValue').at(-1)).toEqual(['all']);
    expect(document.activeElement).toBe(w.findAll('button')[2].element);
    await w.findAll('button')[2].trigger('keydown', { key: 'Home' });
    expect(w.emitted('update:modelValue').at(-1)).toEqual(['today']);
    await w.findAll('button')[0].trigger('keydown', { key: 'End' });
    expect(w.emitted('update:modelValue').at(-1)).toEqual(['all']);
  });
  it('segmented accepts idle selection and blocks pointer and keyboard selection while disabled', async () => {
    const w = render(BaseSegmented, {
      options: [
        { value: 'US', label: '美国' },
        { value: 'CN', label: '中国' },
        { value: 'closed', label: '关闭', disabled: true }
      ],
      modelValue: 'US',
      label: '地区',
      disabled: false
    });
    // A fallthrough disabled="false" still matches the global [disabled] style.
    expect(w.attributes('disabled')).toBeUndefined();
    const tabs = w.findAll('[role="tab"]');
    await tabs[1].trigger('tap');
    await tabs[2].trigger('tap');
    expect(w.emitted('update:modelValue')).toEqual([['CN']]);
    await w.setProps({ disabled: true });
    expect(tabs.every((tab) => tab.attributes('disabled') !== undefined)).toBe(true);
    expect(tabs.map((tab) => tab.attributes('tabindex'))).toEqual(['-1', '-1', '-1']);
    // Test Utils skips trigger() on disabled buttons; dispatch reaches the guards.
    tabs[0].element.dispatchEvent(new Event('tap', { bubbles: true }));
    tabs[0].element.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
    await nextTick();
    expect(w.emitted('update:modelValue')).toHaveLength(1);
    await w.setProps({ disabled: false });
    expect(w.attributes('disabled')).toBeUndefined();
    expect(tabs[2].attributes('disabled')).toBeDefined();
    expect(tabs.map((tab) => tab.attributes('tabindex'))).toEqual(['0', '-1', '-1']);
    tabs[1].element.dispatchEvent(new Event('tap', { bubbles: true }));
    tabs[0].element.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
    await nextTick();
    expect(w.emitted('update:modelValue')).toEqual([['CN'], ['CN'], ['CN']]);
    expect(document.activeElement).toBe(tabs[1].element);
  });
  it.each(['neutral', 'violet', 'mint', 'coral', 'apricot'])('renders the %s flat tag', (tone) =>
    expect(render(BaseTag, { tone }, { default: 'Status' }).classes()).toContain(`base-tag--${tone}`)
  );
  it('renders five answer states without upgrading pending; radio selection never emits submission', async () => {
    const states = ['default', 'selected', 'correct', 'wrong', 'pending'];
    const options = states.map((state) => ({ value: state, label: state, state }));
    const w = render(BaseOptions, { options, modelValue: 'selected', label: 'Answers' });
    expect(w.findAll('[role="radio"]').map((node) => node.attributes('data-state'))).toEqual(states);
    expect(w.findAll('[aria-checked="true"]')).toHaveLength(1);
    expect(w.text()).toContain('未提交');
    expect(w.text()).toContain('待核对');
    const keys = w.findAll('.base-option__key');
    expect(keys.slice(0, 4).map((node) => node.text())).toEqual(['A', 'B', 'C', 'D']);
    expect(keys[4].text()).toBe('');
    await w.findAll('button')[0].trigger('keydown', { key: 'ArrowDown' });
    expect(w.emitted('update:modelValue')).toEqual([['selected']]);
    expect(w.emitted('submit')).toBeUndefined();
    await w.setProps({ disabled: true });
    await w.findAll('button')[1].trigger('tap');
    expect(w.emitted('update:modelValue')).toHaveLength(1);
  });
  it('radio keyboard wraps and skips unavailable options', async () => {
    const w = render(BaseOptions, {
      options: [
        { value: 'a', label: 'A' },
        { value: 'b', label: 'B', disabled: true },
        { value: 'c', label: 'C' }
      ],
      modelValue: 'a',
      label: 'Answers'
    });
    await w.findAll('button')[0].trigger('keydown', { key: 'ArrowLeft' });
    expect(w.emitted('update:modelValue').at(-1)).toEqual(['c']);
    await w.findAll('button')[2].trigger('keydown', { key: 'Home' });
    expect(w.emitted('update:modelValue').at(-1)).toEqual(['a']);
  });
  it('input label, prefix, help/error association, textarea and disabled drafts work', async () => {
    const w = render(BaseInput, { label: 'Phone', prefix: '+1', help: 'Optional' });
    expect(w.get('label').attributes('for')).toBe(w.get('input').attributes('id'));
    expect(w.text()).toContain('+1');
    expect(w.get('input').attributes('aria-describedby')).toBe(w.get('.base-field__help').attributes('id'));
    await w.get('input').setValue('555');
    expect(w.emitted('update:modelValue')).toEqual([['555']]);
    await w.setProps({ error: 'Invalid' });
    expect(w.get('input').attributes('aria-invalid')).toBe('true');
    expect(w.get('[role="alert"]').text()).toBe('Invalid');
    await w.setProps({ multiline: true, disabled: true });
    expect(w.get('textarea').attributes('disabled')).toBeDefined();
  });
  it('verification countdown blocks resend until elapsed and does not send a code itself', async () => {
    vi.useFakeTimers();
    const w = render(BaseInput, { verification: true, resendSeconds: 2 });
    await w.get('button').trigger('tap');
    expect(w.emitted('resend')).toBeUndefined();
    expect(w.text()).toContain('2 秒');
    await vi.advanceTimersByTimeAsync(2000);
    expect(w.text()).toContain('重新发送');
    await w.get('button').trigger('tap');
    expect(w.emitted('resend')).toHaveLength(1);
  });
  it('consent toggles using keyboard, honors disabled, and does not toggle when a policy link is activated', async () => {
    const w = render(BaseCheckbox, { modelValue: false }, { default: '<a href="#policy">Policy</a>' });
    await w.get('a').trigger('tap');
    expect(w.emitted('update:modelValue')).toBeUndefined();
    await w.trigger('keydown', { key: ' ' });
    expect(w.emitted('update:modelValue')).toEqual([[true]]);
    await w.setProps({ modelValue: true, disabled: true });
    await w.trigger('tap');
    expect(w.attributes('aria-checked')).toBe('true');
    expect(w.emitted('update:modelValue')).toHaveLength(1);
  });
});
describe('surfaces, feedback and translations', () => {
  it.each(['paper', 'glass'])('renders %s card with original header/body/footer slots', (surface) => {
    const w = render(BaseCard, { surface, title: 'Title' }, { default: 'Body', footer: 'Footer' });
    expect(w.classes()).toContain(`base-card--${surface}`);
    expect(w.text()).toContain('BodyFooter');
  });
  it('statistics preserve denominators and message roles are accessible', () => {
    expect(render(BaseStat, { label: 'Tasks', value: 3, denominator: 5 }).text()).toContain('/ 5');
    expect(render(BaseBubble, { author: 'user' }, { default: 'Answer' }).attributes('aria-label')).toBe('你的消息');
    expect(render(BaseBubble).findComponent(AnimatedAvatar).exists()).toBe(false);
    const avatar = render(BaseBubble, { avatar: true }).getComponent(AnimatedAvatar);
    expect(avatar.props('size')).toBe(48);
    expect(avatar.attributes('aria-hidden')).toBe('true');
  });
  it.each(['empty', 'loading', 'error'])('state %s uses the same mascot and translated title', (state) => {
    const w = render(BaseEmpty, { state, showButton: true });
    expect(w.getComponent(YoziMascot).exists()).toBe(true);
    expect(w.attributes('role')).toBe(state === 'error' ? 'alert' : 'status');
    expect(w.attributes('aria-busy')).toBe(String(state === 'loading'));
  });
  it('loading compatibility delegates to the canonical state', () =>
    expect(render(BaseLoading).getComponent(BaseEmpty).props('state')).toBe('loading'));
  it('toast expires once and removes its timer on unmount; list rows have keyboard and disabled behavior', async () => {
    vi.useFakeTimers();
    const toast = render(BaseToast, { visible: true, duration: 100 });
    await vi.advanceTimersByTimeAsync(100);
    expect(toast.emitted('update:visible')).toEqual([[false]]);
    const row = render(BaseListRow, { label: 'Language' });
    await row.trigger('keydown', { key: 'Enter' });
    expect(row.emitted('tap')).toHaveLength(1);
    await row.setProps({ disabled: true });
    await row.trigger('tap');
    expect(row.emitted('tap')).toHaveLength(1);
  });
  it('internal component strings and mascot alternatives switch immediately to English', async () => {
    const w = render(BaseButton, { loading: true });
    const mascot = render(YoziMascot, { decorative: false, pose: 'think', play: 'none' });
    setLanguage('en');
    await nextTick();
    expect(w.text()).toContain('Loading');
    expect(mascot.attributes('aria-label')).toBe('Yozi is thinking');
  });
  it('all board Lucide paths use 1.75 outlines, selected fills use .16, official brands retain their files', () => {
    for (const name of Object.keys(BOARD_ICONS)) expect(getIconMarkup(name)).toContain('stroke-width="1.75"');
    expect(getIconMarkup('home', true)).toContain('fill-opacity=".16"');
    expect(getIconPath('google', undefined, 'dark', 'pink')).toBe('/static/brand/google-g.svg');
    expect(render(BaseIcon, { name: 'check' }).attributes('aria-hidden')).toBe('true');
  });
  it('bottom sheet keeps configurable mask/Esc closing and returns focus', async () => {
    const opener = document.createElement('button');
    document.body.append(opener);
    opener.focus();
    const Popup = {
      props: ['modelValue', 'position', 'closeOnClickModal'],
      template: '<div v-if="modelValue"><slot /></div>'
    };
    const w = render(
      CustomModal,
      { visible: true, position: 'bottom', maskClosable: false, escapeClosable: false },
      {},
      { WdPopup: Popup }
    );
    await flushPromises();
    expect(w.get('[role="dialog"]').classes()).toContain('is-bottom');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(w.emitted('cancel')).toBeUndefined();
    await w.setProps({ escapeClosable: true });
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(w.emitted('cancel')).toHaveLength(1);
    await w.setProps({ visible: false });
    expect(document.activeElement).toBe(opener);
  });
});
describe('mascot playback ownership and lifecycle', () => {
  it.each(['idle', 'wave', 'think', 'celebrate', 'encourage', 'read', 'sleep', 'point', 'curious'])(
    'loads %s pose, is decorative by default, and play none is still',
    (pose) => {
      const w = render(YoziMascot, { pose, play: 'none' });
      expect(w.attributes('data-pose')).toBe(pose);
      expect(w.attributes('aria-hidden')).toBe('true');
      expect(w.attributes('data-moving')).toBe('false');
    }
  );
  it('only the latest visible mascot moves; leaving the viewport gives ownership back; observers are disposed', async () => {
    const first = render(YoziMascot);
    const second = render(YoziMascot, { pose: 'think' });
    await nextTick();
    expect(first.attributes('data-moving')).toBe('false');
    expect(second.attributes('data-moving')).toBe('true');
    observers[1].visible(false);
    await nextTick();
    expect(second.attributes('data-moving')).toBe('false');
    expect(first.attributes('data-moving')).toBe('true');
    second.unmount();
    expect(observers[1].disconnect).toHaveBeenCalledOnce();
  });
  it.each(['', '-3249c96f', null])(
    'once completes with compiled/uni keyframe %s; wave auto returns to idle',
    async (suffix) => {
      const w = render(YoziMascot, { pose: 'celebrate', play: 'once' });
      await nextTick();
      await w.get('.yozi-mascot__motion').trigger('animationend', { animationName: 'yozi-blink' });
      expect(w.emitted('complete')).toBeUndefined();
      await w
        .get('.yozi-mascot__motion')
        .trigger('animationend', { animationName: suffix === null ? '' : `yozi-jump${suffix}` });
      expect(w.emitted('complete')).toEqual([['celebrate']]);
      expect(w.attributes('data-moving')).toBe('false');
      const wave = render(YoziMascot, { pose: 'wave' });
      await nextTick();
      expect(wave.get('.yozi-mascot__alt').element.style.animationIterationCount).toBe('1');
      await wave.get('.yozi-mascot__motion').trigger('animationend');
      expect(wave.emitted('complete')).toBeUndefined();
      await wave
        .get('.yozi-mascot__alt')
        .trigger('animationend', { animationName: suffix === null ? '' : `yozi-wave${suffix}` });
      expect(wave.attributes('data-pose')).toBe('idle');
      expect(wave.emitted('complete')).toEqual([['wave']]);
    }
  );
  it('looping blink and wave frames inherit the running mode and repeat indefinitely', async () => {
    const w = render(YoziMascot, { pose: 'idle', play: 'loop' });
    await nextTick();
    expect(w.get('.yozi-mascot__alt').element.style.animationIterationCount).toBe('infinite');
    expect(w.get('.yozi-mascot__alt').element.style.animationPlayState).toBe('running');
    await w.setProps({ pose: 'wave' });
    expect(w.get('.yozi-mascot__alt').element.style.animationIterationCount).toBe('infinite');
    setMascotReducedMotion(true, { persist: false });
    await nextTick();
    expect(w.get('.yozi-mascot__alt').element.style.animationPlayState).toBe('paused');
  });
  it('loop does not complete, and both system/application reduced motion leave the pose still', async () => {
    const w = render(YoziMascot, { pose: 'celebrate', play: 'loop' });
    await nextTick();
    await w.get('.yozi-mascot__motion').trigger('animationend', { animationName: 'yozi-jump' });
    expect(w.emitted('complete')).toBeUndefined();
    media.matches = true;
    media.change();
    await nextTick();
    expect(w.attributes('data-moving')).toBe('false');
    media.matches = false;
    media.change();
    await nextTick();
    setMascotReducedMotion(true, { persist: false });
    await nextTick();
    expect(w.attributes('data-moving')).toBe('false');
    expect(w.attributes('data-pose')).toBe('celebrate');
  });
  it('document hiding pauses every mascot; answer focus pauses loops but allows one-shot feedback', async () => {
    const w = render(YoziMascot, { pose: 'think' });
    await nextTick();
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    document.dispatchEvent(new Event('visibilitychange'));
    await nextTick();
    expect(w.attributes('data-moving')).toBe('false');
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
    document.dispatchEvent(new Event('visibilitychange'));
    await nextTick();
    setMascotInputFocused('test', true);
    await nextTick();
    expect(w.attributes('data-moving')).toBe('false');
    const feedback = render(YoziMascot, { pose: 'celebrate' });
    await nextTick();
    expect(feedback.attributes('data-moving')).toBe('true');
    setMascotInputFocused('test', false);
  });
  it('actual field focus pauses loop and blur resumes it', async () => {
    const w = render(YoziMascot, { pose: 'read' }),
      input = render(BaseInput, { multiline: true, label: 'Answer' });
    await nextTick();
    await input.get('textarea').trigger('focus');
    expect(w.attributes('data-moving')).toBe('false');
    await input.get('textarea').trigger('blur');
    await nextTick();
    expect(w.attributes('data-moving')).toBe('true');
  });
  it('native page hide/show and uni intersection observer pause/resume and disconnect', async () => {
    vi.stubEnv('MODE', 'development');
    const callback = vi.fn();
    let observe;
    const native = {
      relativeToViewport() {
        return this;
      },
      observe(_selector, fn) {
        observe = fn;
      },
      disconnect: callback
    };
    uni.createIntersectionObserver = vi.fn(() => native);
    const w = render(YoziMascot, { pose: 'sleep' });
    observe({ intersectionRatio: 1 });
    await nextTick();
    expect(w.attributes('data-moving')).toBe('true');
    lifecycle.hide[0]();
    await nextTick();
    expect(w.attributes('data-moving')).toBe('false');
    lifecycle.show[0]();
    await nextTick();
    expect(w.attributes('data-moving')).toBe('true');
    observe({ intersectionRatio: 0 });
    await nextTick();
    expect(w.attributes('data-moving')).toBe('false');
    w.unmount();
    expect(callback).toHaveBeenCalledOnce();
    delete uni.createIntersectionObserver;
  });
  it('celebration duration comes from the 600ms token and preview uses the supported H5-only platform directory', () => {
    expect(readFileSync('src/styles/yozi-tokens.scss', 'utf8')).toContain('--mx-celebrate-time: 600ms');
    const pages = readFileSync('src/pages.json', 'utf8');
    expect(JSON.parse(pages).pages.some((page) => page.path === 'platforms/h5/components')).toBe(false);
  });
});
