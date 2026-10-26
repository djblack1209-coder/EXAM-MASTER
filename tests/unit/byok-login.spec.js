import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import Login from '@/pages/login/index.vue';
import BaseInput from '@/components/base/base-input/base-input.vue';
import BaseButton from '@/components/base/base-button/base-button.vue';
import BaseCheckbox from '@/components/base/base-checkbox/base-checkbox.vue';
import { setLanguage, t } from '@/i18n/index.js';
const mock = vi.hoisted(() => ({ load: vi.fn(), login: vi.fn(), navigate: vi.fn(), needs: true }));
vi.mock('@dcloudio/uni-app', () => ({ onShow() {}, onHide() {}, onLoad() {} }));
vi.mock('@/stores/modules/conversation-learning.js', () => ({
  useConversationLearningStore: () => ({
    loadModels: mock.load,
    get needsConnection() {
      return mock.needs;
    },
    openModelConnector: () => ({ route: '/pages/profile/index?panel=connectors' })
  })
}));
vi.mock('@/stores/modules/auth', () => ({
  useAuthStore: () => ({ regionalLogin: async () => ({ code: 0, data: { email: true } }), loginByEmail: mock.login })
}));
vi.mock('@/utils/safe-navigate', async (original) => ({ ...(await original()), safeNavigateTo: mock.navigate }));
vi.mock('@/stores/modules/user', () => ({ useUserStore: () => ({ restoreUserInfo() {} }) }));
let wrapper;
beforeEach(() => {
  vi.useFakeTimers();
  uni.clearStorageSync();
  setActivePinia(createPinia());
  setLanguage('zh-CN');
  mock.needs = true;
  mock.navigate.mockReset();
  mock.load.mockReset().mockResolvedValue({ success: true });
  mock.login.mockReset().mockResolvedValue({
    code: 0,
    data: { userId: 'fixture-byok-new-owner', token: 'fixture-only-session-token', userInfo: {} }
  });
});
afterEach(() => {
  wrapper?.unmount();
  vi.clearAllTimers();
  vi.useRealTimers();
});
const tap = async (label) => {
  const button = wrapper.findAllComponents(BaseButton).find((item) => item.text().trim() === label);
  expect(button, label).toBeTruthy();
  button.vm.$emit('tap');
  await flushPromises();
};
it.each([false, true])('loads connections and guides after email authentication, registration=%s', async (register) => {
  wrapper = mount(Login, { global: { stubs: { PrivacyPopup: true, YoziMascot: true } } });
  await flushPromises();
  wrapper.getComponent(BaseCheckbox).vm.$emit('update:modelValue', true);
  await flushPromises();
  await tap(t('login.email'));
  if (register) await tap(t('login.create'));
  const fields = wrapper.findAllComponents(BaseInput);
  fields
    .find((item) => item.props('label') === t('login.emailAddress'))
    .vm.$emit('update:modelValue', 'fixture@example.test');
  fields
    .find((item) => item.props('label') === t(register ? 'login.setPassword' : 'login.password'))
    .vm.$emit('update:modelValue', 'FixtureOnly123!');
  if (register) fields.find((item) => item.props('label') === t('login.code')).vm.$emit('update:modelValue', '123456');
  await flushPromises();
  await tap(t(register ? 'login.register' : 'login.submit'));
  expect(mock.load).toHaveBeenCalledOnce();
  await vi.advanceTimersByTimeAsync(1600);
  expect(mock.navigate).toHaveBeenCalledWith('/pages/profile/index?panel=connectors');
});
