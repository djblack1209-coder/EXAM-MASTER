import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { mount, flushPromises } from '@vue/test-utils';
import LoginPage from '@/pages/login/index.vue';
import BaseInput from '@/components/base/base-input/base-input.vue';
import BaseButton from '@/components/base/base-button/base-button.vue';
import BaseCheckbox from '@/components/base/base-checkbox/base-checkbox.vue';
import { storageService } from '@/services/storageService.js';
import { getUserId } from '@/services/auth-storage.js';
import { setLanguage, t } from '@/i18n/index.js';
// The retained US flow is exercised behind its explicit feature setting.
vi.mock('@/services/auth-region.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    US_LOGIN_ENABLED: true,
    readLoginRegion: (runtime) => actual.readLoginRegion(runtime, { enabled: true })
  };
});
const mocks = vi.hoisted(() => ({ api: vi.fn(), provider: vi.fn() }));
vi.mock('@dcloudio/uni-app', () => ({ onShow: () => {}, onHide: () => {} }));
vi.mock('@/pages/login/provider-utils.js', () => ({ requestProviderToken: mocks.provider }));
vi.mock('@/stores/modules/auth', () => ({ useAuthStore: () => ({ regionalLogin: mocks.api }) }));
let wrapper;
beforeEach(() => {
  vi.useFakeTimers();
  uni.clearStorageSync();
  setActivePinia(createPinia());
  setLanguage('zh-CN');
  uni.setStorageSync('yozi_login_region', 'US');
  mocks.api.mockReset().mockImplementation(async (body) => {
    if (body.type === 'capabilities')
      return { code: 0, data: { apple: { clientId: 'fixture' }, google: { clientId: 'fixture' }, sms: true } };
    if (body.type === 'age_confirm')
      return { code: 0, data: { ticket: 'fixture-ticket', expiresAt: Date.now() + 600000 } };
    if (body.action === 'begin') return { code: 0, data: { session: 'fixture-challenge' } };
    return { code: 0, data: { userId: 'normal-owner', token: 'fixture-only-token', userInfo: {} } };
  });
  mocks.provider.mockReset().mockResolvedValue('fixture-identity');
});
afterEach(() => {
  wrapper?.unmount();
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
});
const button = (text) => wrapper.findAllComponents(BaseButton).find((x) => x.text() === text);
it.each(['apple', 'google', 'phone'].flatMap((method) => [false, true].map((revoked) => [method, revoked])))(
  'order-07-01: %s page flow uses its initiating attempt revoked=%s',
  async (method, revoked) => {
    wrapper = mount(LoginPage, {
      global: {
        stubs: {
          PrivacyPopup: true,
          YoziMascot: true,
          view: { template: '<div><slot /></div>' },
          text: { template: '<span><slot /></span>' }
        }
      }
    });
    await flushPromises();
    await wrapper.findComponent(BaseCheckbox).trigger('tap');
    const attempts = vi.spyOn(storageService, 'beginLoginAttempt');
    let finish;
    if (method !== 'phone')
      mocks.provider.mockImplementation(
        () =>
          new Promise((resolve) => {
            finish = resolve;
          })
      );
    await button(t(`login.${method}`)).vm.$emit('tap');
    await flushPromises();
    const birth = wrapper.findAllComponents(BaseInput);
    await birth[0].vm.$emit('update:modelValue', '2000');
    await birth[1].vm.$emit('update:modelValue', '1');
    await button(t('login.continue')).vm.$emit('tap');
    await flushPromises();
    if (method === 'phone') {
      const fields = wrapper.findAllComponents(BaseInput);
      await fields[0].vm.$emit('update:modelValue', '2025550101');
      await fields[1].vm.$emit('update:modelValue', '123456');
      mocks.api.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finish = resolve;
          })
      );
      await button(t('login.submit')).vm.$emit('tap');
      await flushPromises();
    }
    expect(attempts).toHaveBeenCalledTimes(1);
    if (revoked) storageService._clearRevokedCredentials();
    finish(
      method === 'phone'
        ? { code: 0, data: { userId: 'normal-owner', token: 'fixture-only-token' } }
        : 'fixture-identity'
    );
    await flushPromises();
    expect(getUserId()).toBe(revoked ? null : 'normal-owner');
    expect(mocks.api.mock.calls.some(([body]) => body.action === 'send')).toBe(false);
  }
);
