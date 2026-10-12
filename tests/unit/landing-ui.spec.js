import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia } from 'pinia';
import { nextTick } from 'vue';
import PlayfulLanding from '@/components/business/learning/playful-landing.vue';
import FutureLanding from '@/components/business/learning/future-landing.vue';
import { initI18n, setLanguage, t } from '@/i18n/index.js';
import { landingMessages } from '@/i18n/messages/landing.js';
import { setMascotReducedMotion } from '@/design/mascot-motion.js';

vi.mock('@dcloudio/uni-app', () => ({ onHide: vi.fn(), onShow: vi.fn() }));
vi.mock('@/design/future-motion.js', () => ({
  FUTURE_ASSETS: { video: '' },
  bindFutureSky: () => ({ setEnabled: vi.fn(), dispose: vi.fn() }),
  runFutureEntrance: (_root, finish) => {
    finish();
    return vi.fn();
  }
}));
let wrapper;
beforeEach(() => {
  initI18n();
  setLanguage('zh-CN');
  setMascotReducedMotion(false, { persist: false });
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(callback) {
        this.callback = callback;
      }
      observe() {
        this.callback([{ isIntersecting: true }]);
      }
      disconnect() {}
    }
  );
});
afterEach(() => {
  wrapper?.unmount();
  setMascotReducedMotion(false, { persist: false });
  vi.unstubAllGlobals();
});
function render(component) {
  wrapper = mount(component, {
    attachTo: document.body,
    global: {
      plugins: [createPinia()],
      mocks: { $yoziInsets: {} },
      stubs: { view: { template: '<div><slot /></div>' }, text: { template: '<span><slot /></span>' } }
    }
  });
  return wrapper;
}
describe('landing language, entry and mascot behavior', () => {
  it('every landing key has both languages and never falls back to its key', () => {
    expect(Object.keys(landingMessages.en).sort()).toEqual(Object.keys(landingMessages['zh-CN']).sort());
    for (const locale of ['zh-CN', 'en']) {
      setLanguage(locale);
      for (const key of Object.keys(landingMessages.en)) expect(t(`landing.${key}`)).toBe(landingMessages[locale][key]);
    }
  });
  it.each([PlayfulLanding, FutureLanding])(
    'switches mounted fixed labels and accessible names to English',
    async (component) => {
      render(component);
      expect(wrapper.text()).toContain('开始学习');
      setLanguage('en');
      await nextTick();
      expect(wrapper.text()).toContain('Start learning');
      expect(wrapper.text()).not.toMatch(/[\u3400-\u9fff]/);
      expect(
        wrapper
          .findAll('[aria-label]')
          .map((node) => node.attributes('aria-label'))
          .join(' ')
      ).not.toMatch(/[\u3400-\u9fff]/);
    }
  );
  it.each([PlayfulLanding, FutureLanding])(
    'one primary entry is keyboard accessible and emits once',
    async (component) => {
      render(component);
      const primary = wrapper.findAll('.base-button--primary');
      expect(primary).toHaveLength(1);
      await primary[0].trigger('keydown', { key: 'Enter' });
      expect(wrapper.emitted('open')).toEqual([['start']]);
    }
  );
  it.each([PlayfulLanding, FutureLanding])(
    'waves once, settles to idle, pauses for reduced motion',
    async (component) => {
      render(component);
      await nextTick();
      const mascot = wrapper.get('.yozi-mascot');
      expect(mascot.attributes('data-pose')).toBe('wave');
      expect(mascot.attributes('data-moving')).toBe('true');
      await mascot.get('.yozi-mascot__alt').trigger('animationend', { animationName: 'yozi-wave' });
      expect(mascot.attributes('data-pose')).toBe('idle');
      setMascotReducedMotion(true, { persist: false });
      await nextTick();
      expect(mascot.attributes('data-moving')).toBe('false');
    }
  );
  it('keeps the Playful main heading above navigation, with exact bilingual line breaks', async () => {
    render(PlayfulLanding);
    const heading = wrapper.get('.playful-jobs > .playful-job-title');
    expect(heading.attributes('role')).toBe('heading');
    expect(heading.attributes('aria-level')).toBe('1');
    expect(heading.element.textContent).toBe('从一个问题\n到真正理解');
    expect(heading.element.nextElementSibling.classList.contains('playful-nav')).toBe(true);
    setLanguage('en');
    await nextTick();
    expect(heading.element.textContent).toBe('From one question\nto real understanding');
  });
  it('keeps Future brand heading and both scrolling learning/practice/review runs', async () => {
    render(FutureLanding);
    expect(wrapper.get('.intro .name[role=heading]').text()).toBe('Yozi AI');
    const runs = wrapper.findAll('.marquee-run > *');
    expect(runs).toHaveLength(2);
    expect(runs.every((run) => run.text().includes('学习 · 练习 · 复习'))).toBe(true);
    setLanguage('en');
    await nextTick();
    expect(runs.every((run) => run.text().includes('LEARNING · PRACTICE · REVIEW'))).toBe(true);
    expect(wrapper.find('.scene-assembly .scene').exists()).toBe(true);
  });
  it('Future motion chip pauses the mascot without changing the learning entry', async () => {
    render(FutureLanding);
    await wrapper.get('.base-chip').trigger('keydown', { key: ' ' });
    await nextTick();
    expect(wrapper.get('.yozi-mascot').attributes('data-moving')).toBe('false');
    expect(wrapper.findAll('.base-button--primary')).toHaveLength(1);
  });
});
