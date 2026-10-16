import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { defineComponent, nextTick } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import BaseInput from '@/components/base/base-input/base-input.vue';
import BaseOptions from '@/components/base/base-options/base-options.vue';
import BaseButton from '@/components/base/base-button/base-button.vue';
import { getTabbarSafeAreaStyle } from '@/utils/core/system.js';
import { usePageDialog } from '@/composables/usePageDialog.js';
import { setLanguage, t, translateRegisteredText } from '@/i18n/index.js';
import dashboard from '@/i18n/messages/dashboard.js';
import quiz from '@/pages/practice-sub/messages.js';
import favorite from '@/pages/favorite/messages.js';
import mistake from '@/pages/mistake/messages.js';
import plan from '@/pages/plan/messages.js';
import study from '@/pages/study-detail/messages.js';
import PrivacyPopup from '@/components/common/privacy-popup.vue';
import CustomModal from '@/components/common/CustomModal.vue';
import { useThemeStore } from '@/stores/modules/theme.js';
const wrappers = [];
const render = (c, options = {}) => {
  const w = mount(c, {
    ...options,
    global: {
      stubs: { view: { template: '<div><slot/></div>' }, text: { template: '<span><slot/></span>' }, BaseIcon: true }
    }
  });
  wrappers.push(w);
  return w;
};
function renderDialog() {
  let ui;
  const w = render(
    defineComponent({
      setup() {
        ui = usePageDialog();
        return () => null;
      }
    })
  );
  return { w, ui };
}

beforeEach(() => {
  setActivePinia(createPinia());
  setLanguage('zh-CN');
});
afterEach(() => {
  wrappers.splice(0).forEach((w) => w.unmount());
  vi.unstubAllGlobals();
  setLanguage('zh-CN');
});
describe('remaining page language and controls', () => {
  it('a button label names the control without duplicating its visible slot', () => {
    const w = render(BaseButton, { props: { label: 'Accessible settings' }, slots: { default: 'Settings' } });
    expect(w.text()).toBe('Settings');
    expect(w.get('[role=button]').attributes('aria-label')).toBe('Accessible settings');
  });
  it('tab content and navigation share real safe-area insets with a legacy fallback', () => {
    const info = vi.fn();
    vi.stubGlobal('uni', { ...uni, getWindowInfo: info });
    info.mockReturnValue({ safeAreaInsets: { bottom: 34 }, screenHeight: 844, safeArea: { bottom: 820 } });
    expect(getTabbarSafeAreaStyle()).toEqual({ '--yozi-safe-bottom': '34px' });
    info.mockReturnValue({ screenHeight: 844, safeArea: { bottom: 820 } });
    expect(getTabbarSafeAreaStyle()).toEqual({ '--yozi-safe-bottom': '24px' });
    info.mockReturnValue({ safeAreaInsets: { bottom: 0 } });
    expect(getTabbarSafeAreaStyle()).toEqual({});
    info.mockImplementation(() => {
      throw new Error('Unavailable');
    });
    expect(getTabbarSafeAreaStyle()).toEqual({});
  });
  it.each([
    ['zh-CN', false],
    ['zh-CN', true],
    ['en', false],
    ['en', true]
  ])('privacy uses %s and dark=%s without weakening native authorization', async (language, dark) => {
    let authorize;
    const resolve = vi.fn();
    vi.stubGlobal('wx', {
      onNeedPrivacyAuthorization: (callback) => {
        authorize = callback;
      },
      offNeedPrivacyAuthorization: vi.fn()
    });
    setLanguage(language);
    useThemeStore().setDarkMode(dark, { persist: false });
    const w = mount(PrivacyPopup, {
      global: {
        stubs: {
          view: { template: '<div><slot/></div>' },
          text: { template: '<span><slot/></span>' },
          WdPopup: { props: ['modelValue'], template: '<div class="fixture-popup" v-if="modelValue"><slot/></div>' }
        }
      }
    });
    wrappers.push(w);
    authorize(resolve);
    await flushPromises();
    const modal = w.getComponent(CustomModal);
    expect(modal.props()).toMatchObject({ maskClosable: false, escapeClosable: false, position: 'bottom' });
    expect(w.get('#agree-btn').attributes('open-type')).toBe('agreePrivacyAuthorization');
    expect(w.text()).toContain(t('privacy.title'));
    if (language === 'en') expect(w.text()).not.toMatch(/[\u3400-\u9fff]/);
    if (process.env.YOZI_UI_SHOT_FIXTURES === '1') {
      const fs = await import('node:fs');
      fs.writeFileSync(
        `tmp/ui-redesign-20261011/batch4b/privacy-${language}-${dark ? 'dark' : 'light'}.json`,
        JSON.stringify({ language, dark, html: w.html() })
      );
    }
    await w.get('#agree-btn').trigger('agreeprivacyauthorization');
    expect(resolve).toHaveBeenCalledExactlyOnceWith({ buttonId: 'agree-btn', event: 'agree' });
    w.unmount();
    wrappers.pop();
    vi.unstubAllGlobals();
  });
  it.each(Object.entries({ dashboard, quiz, favorite, mistake, plan, study }))(
    '%s has complete bilingual interface messages',
    (namespace, messages) => {
      expect(Object.keys(messages.en).sort()).toEqual(Object.keys(messages['zh-CN']).sort());
      setLanguage('en');
      for (const [key, value] of Object.entries(messages.en)) {
        expect(value.trim()).not.toBe('');
        expect(value).not.toMatch(/[\u3400-\u9fff]/);
        expect(t(namespace + '.' + key)).toBe(value);
      }
    }
  );
  it('known year labels follow language while unknown user content stays unchanged', () => {
    setLanguage('en');
    expect(translateRegisteredText('quiz', '2025考研英语二真题')).toBe('2025 graduate English II paper');
    expect(translateRegisteredText('quiz', '我的自定义资料')).toBe('我的自定义资料');
    setLanguage('zh-CN');
    expect(translateRegisteredText('quiz', '2025考研英语二真题')).toBe('2025考研英语二真题');
  });
  it('birth selection emits a draft without rendering a free text input', async () => {
    const w = render(BaseInput, {
      props: {
        label: '出生年份',
        options: [
          { value: '2010', label: '2010' },
          { value: '2009', label: '2009' }
        ],
        modelValue: ''
      }
    });
    expect(w.find('input').exists()).toBe(false);
    expect(w.findAll('select option').map((o) => o.text())).toEqual(['请选择', '2010', '2009']);
    await w.get('select').setValue('2010');
    expect(w.emitted('update:modelValue')).toEqual([['2010']]);
  });
  it('phone button separates first request, countdown and resend', async () => {
    const w = render(BaseInput, { props: { label: '验证码', verification: true, verificationSent: false } });
    expect(w.text()).toContain('获取验证码');
    expect(w.text()).not.toContain('重新发送');
    await w.find('button').trigger('tap');
    expect(w.emitted('resend')).toHaveLength(1);
    await w.setProps({ verificationSent: true, resendSeconds: 30 });
    expect(w.text()).toContain('30');
    await w.setProps({ resendSeconds: 0 });
    expect(w.text()).toContain('重新发送');
    await w.setProps({ label: 'Code' });
    setLanguage('en');
    await nextTick();
    expect(w.text()).toContain('Resend');
    expect(w.text()).not.toMatch(/[\u3400-\u9fff]/);
  });
  it('pending reference options expose uncertainty and selection only emits a draft', async () => {
    const w = render(BaseOptions, {
      props: {
        label: 'Options',
        options: [
          { value: 0, label: 'Original A' },
          { value: 1, label: 'Original B', state: 'pending' }
        ],
        modelValue: 1
      }
    });
    expect(w.get('[data-value="1"]').attributes('data-state')).toBe('pending');
    expect(w.get('[data-value="1"]').attributes('aria-checked')).toBe('true');
    await w.get('[data-value="0"]').trigger('tap');
    expect(w.emitted('update:modelValue')).toEqual([[0]]);
    expect(w.emitted('submit')).toBeUndefined();
  });
});
describe('page scoped confirmations', () => {
  it('queues confirmations and preserves callbacks exactly once', async () => {
    const { w, ui } = renderDialog();
    const success = vi.fn(),
      first = ui.modal.show({ title: 'First', success }),
      second = ui.modal.show({ title: 'Second' });
    expect(ui.pageDialog.value.title).toBe('First');
    ui.settleDialog(false);
    expect(await first).toEqual({ confirm: false, cancel: true });
    expect(success).toHaveBeenCalledExactlyOnceWith({ confirm: false, cancel: true });
    expect(ui.pageDialog.value.title).toBe('Second');
    ui.settleDialog(true);
    expect(await second).toEqual({ confirm: true, cancel: false });
    ui.settleDialog(true);
    expect(success).toHaveBeenCalledTimes(1);
    w.unmount();
  });
  it('editable confirmation preserves the input for the existing rename callback', async () => {
    const { w, ui } = renderDialog();
    const success = vi.fn(),
      result = ui.modal.show({ editable: true, success });
    ui.settleDialog(true, 'Renamed folder');
    expect(await result).toEqual({ confirm: true, cancel: false, content: 'Renamed folder' });
    expect(success).toHaveBeenCalledExactlyOnceWith({ confirm: true, cancel: false, content: 'Renamed folder' });
    w.unmount();
  });
  it('unmount resolves pending dialogs without executing business writes', async () => {
    const { w, ui } = renderDialog();
    const success = vi.fn(),
      result = ui.modal.show({ success });
    w.unmount();
    expect(await result).toEqual({ confirm: false, cancel: true });
    expect(success).not.toHaveBeenCalled();
  });
});
