import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { inferLoginRegion, readLoginRegion, chooseLoginRegion } from '@/services/auth-region.js';
import {
  availableLoginMethods,
  isAgeEligible,
  createAgeSession,
  loginErrorText
} from '@/pages/login/regional-utils.js';
import { t, setLanguage } from '@/i18n/index.js';
import LoginPage from '@/pages/login/index.vue';
import BaseButton from '@/components/base/base-button/base-button.vue';
import BaseCheckbox from '@/components/base/base-checkbox/base-checkbox.vue';
import BaseInput from '@/components/base/base-input/base-input.vue';
import BaseSegmented from '@/components/base/base-segmented/base-segmented.vue';
import { storageService } from '@/services/storageService.js';
import { getLoginSessionEpoch } from '@/services/auth-storage.js';
// Exercise the retained US flow only with its feature explicitly enabled.
vi.mock('@/services/auth-region.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    US_LOGIN_ENABLED: true,
    readLoginRegion: (runtime) => actual.readLoginRegion(runtime, { enabled: true })
  };
});
const mocks = vi.hoisted(() => ({
  api: vi.fn(),
  email: vi.fn(),
  sendEmail: vi.fn(),
  show: [],
  hide: [],
  devTest: false
}));
vi.mock('@/config/build-channel.js', () => ({
  get DEV_TEST() {
    return mocks.devTest;
  }
}));
vi.mock('@dcloudio/uni-app', () => ({
  onShow: (fn) => mocks.show.push(fn),
  onHide: (fn) => mocks.hide.push(fn),
  onLoad: () => {}
}));
vi.mock('@/stores/modules/auth', () => ({
  useAuthStore: () => ({ regionalLogin: mocks.api, loginByEmail: mocks.email, sendEmailCode: mocks.sendEmail })
}));
const wrappers = [];
function open() {
  const wrapper = mount(LoginPage, {
    global: {
      stubs: {
        PrivacyPopup: true,
        YoziMascot: true,
        view: { template: '<div><slot /></div>' },
        text: { template: '<span><slot /></span>' }
      }
    }
  });
  wrappers.push(wrapper);
  return wrapper;
}
const action = (wrapper, text) => wrapper.findAllComponents(BaseButton).find((b) => b.text() === text);
async function agree(wrapper) {
  await wrapper.findComponent(BaseCheckbox).trigger('tap');
}
beforeEach(() => {
  mocks.devTest = false;
  setActivePinia(createPinia());
  uni.clearStorageSync();
  localStorage.clear();
  setLanguage('zh-CN');
  mocks.show.length = 0;
  mocks.hide.length = 0;
  mocks.api
    .mockReset()
    .mockImplementation(async (body) =>
      body.type === 'capabilities'
        ? { code: 0, data: { apple: { clientId: 'fixture' }, google: { clientId: 'fixture' }, wechat: true } }
        : body.type === 'age_confirm'
          ? { code: 0, data: { ticket: 'fixture-ticket', expiresAt: Date.now() + 600_000 } }
          : { code: 503, errorCode: 'SMS_DISABLED' }
    );
});
afterEach(() => {
  wrappers.splice(0).forEach((w) => w.unmount());
  vi.restoreAllMocks();
});
it('dev/test 回访邮箱登录沿固定测试码，无密码和协议勾选门槛', async () => {
  mocks.devTest = true;
  mocks.email.mockReset().mockResolvedValue({ code: 503, message: '合成服务不可用' });
  mocks.sendEmail.mockReset();
  uni.setStorageSync('yozi_login_region', 'CN');
  const wrapper = open();
  await flushPromises();
  await action(wrapper, '使用邮箱登录').vm.$emit('tap');
  await flushPromises();
  const inputs = wrapper.findAllComponents(BaseInput);
  expect(inputs).toHaveLength(1);
  expect(wrapper.findComponent(BaseCheckbox).exists()).toBe(true);
  expect(wrapper.findComponent(BaseCheckbox).props('modelValue')).toBe(false);
  await inputs[0].vm.$emit('update:modelValue', 'returning@example.test');
  await action(wrapper, '登录').vm.$emit('tap');
  await flushPromises();
  expect(mocks.email).toHaveBeenCalledOnce();
  expect(mocks.email.mock.calls[0][0]).toMatchObject({ email: 'returning@example.test', verifyCode: '000000' });
  expect(mocks.email.mock.calls[0][0]).not.toHaveProperty('password');
  expect(mocks.sendEmail).not.toHaveBeenCalled();
});
it('正式邮箱登录仍校验并发送密码，不发送固定测试码', async () => {
  mocks.email.mockReset().mockResolvedValue({ code: 503, message: '合成服务不可用' });
  uni.setStorageSync('yozi_login_region', 'CN');
  const wrapper = open();
  await flushPromises();
  await agree(wrapper);
  await action(wrapper, '使用邮箱登录').vm.$emit('tap');
  await flushPromises();
  const inputs = wrapper.findAllComponents(BaseInput);
  expect(inputs).toHaveLength(2);
  await inputs[0].vm.$emit('update:modelValue', 'returning@example.test');
  await action(wrapper, '登录').vm.$emit('tap');
  await flushPromises();
  expect(mocks.email).not.toHaveBeenCalled();
  await inputs[1].vm.$emit('update:modelValue', 'Fixture-password');
  await action(wrapper, '登录').vm.$emit('tap');
  await flushPromises();
  expect(mocks.email).toHaveBeenCalledOnce();
  expect(mocks.email.mock.calls[0][0]).toMatchObject({ password: 'Fixture-password' });
  expect(mocks.email.mock.calls[0][0].verifyCode).toBeUndefined();
});
describe('regions and platform capability filtering', () => {
  it('朋友试用仅显示邮箱验证码，不要求创建密码或出现其他登录方式', async () => {
    uni.setStorageSync('yozi_login_region', 'CN');
    mocks.api.mockResolvedValue({ code: 0, data: { friendTrial: true } });
    const wrapper = open();
    await flushPromises();
    await agree(wrapper);
    await action(wrapper, '使用邮箱登录').vm.$emit('tap');
    await flushPromises();
    const fields = wrapper.findAllComponents(BaseInput);
    expect(fields).toHaveLength(2);
    await fields[0].vm.$emit('update:modelValue', 'friend@validmail.com');
    await fields[1].vm.$emit('update:modelValue', '123456');
    mocks.email.mockResolvedValueOnce({ code: 503, message: '合成未发送' });
    await action(wrapper, '登录').vm.$emit('tap');
    await flushPromises();
    expect(mocks.email).toHaveBeenLastCalledWith(
      expect.objectContaining({ email: 'friend@validmail.com', verifyCode: '123456', region: 'CN' })
    );
    expect(mocks.email.mock.calls.at(-1)[0]).not.toHaveProperty('password');
  });
  it.each([
    [{ region: 'US' }, 'US'],
    [{ locale: 'en-US' }, 'US'],
    [{ locale: 'zh-CN' }, 'CN'],
    [{ timeZone: 'America/Los_Angeles' }, 'US'],
    [{ locale: 'zh-CN', timeZone: 'America/Los_Angeles' }, 'US'],
    [{ timeZone: 'America/Toronto' }, 'CN'],
    [{}, 'CN']
  ])('infer %j without a remote lookup: %s', (input, region) => expect(inferLoginRegion(input)).toBe(region));
  it('inference does not persist; explicit selection does and language stays independent', () => {
    const runtime = { getStorageSync: vi.fn(), setStorageSync: vi.fn(), getSystemInfoSync: () => ({ region: 'US' }) };
    expect(readLoginRegion(runtime)).toBe('US');
    expect(runtime.setStorageSync).not.toHaveBeenCalled();
    expect(chooseLoginRegion('CN', runtime)).toBe(true);
    expect(runtime.setStorageSync).toHaveBeenCalledWith('yozi_login_region', 'CN');
    expect(t('login.us')).toBe('美国');
  });
  it('region, mini-program, provider and configuration filters hide unavailable options', () => {
    const capabilities = { apple: {}, google: {}, wechat: true };
    expect(availableLoginMethods('US', { capabilities })).toEqual(['apple', 'google', 'email', 'phone']);
    expect(
      availableLoginMethods('CN', { capabilities, platform: 'app', providers: ['apple', 'weixin'], os: 'ios' })
    ).toEqual(['phone', 'wechat', 'email', 'apple']);
    expect(availableLoginMethods('CN', { capabilities, os: 'android' })).toEqual(['phone', 'wechat', 'email']);
    expect(availableLoginMethods('US', { capabilities, platform: 'mp-weixin' })).toEqual(['wechat', 'phone', 'email']);
    expect(availableLoginMethods('US', { capabilities, platform: 'app', providers: ['apple'] })).toEqual([
      'apple',
      'email',
      'phone'
    ]);
    expect(availableLoginMethods('US', {})).toEqual(['email', 'phone']);
    expect(availableLoginMethods('US', { capabilities, desktop: true })).toEqual(['email', 'phone']);
  });
  it.each(['ios', 'macos', 'android'])('China excludes Apple on the %s web even with capability', (os) => {
    expect(availableLoginMethods('CN', { platform: 'h5', os, capabilities: { apple: {} } })).toEqual([
      'phone',
      'email'
    ]);
  });
  it.each(['macos', 'android'])('China excludes Apple on native %s', (os) => {
    expect(
      availableLoginMethods('CN', { platform: 'app', os, providers: ['apple'], capabilities: { apple: {} } })
    ).toEqual(['phone', 'email']);
  });
  it('China requires the native iOS Apple provider', () => {
    expect(availableLoginMethods('CN', { platform: 'app', os: 'ios', capabilities: { apple: {} } })).toEqual([
      'phone',
      'email'
    ]);
  });
});
describe('age privacy and local session latch', () => {
  it('exact month boundary and invalid/future fields', () => {
    const now = new Date('2026-10-11T00:00:00Z');
    expect(isAgeEligible('2013', '9', now)).toBe(true);
    expect(isAgeEligible('2013', '10', now)).toBe(false);
    expect(isAgeEligible('2027', '1', now)).toBeNull();
    expect(isAgeEligible('2000', '13', now)).toBeNull();
  });
  it('block survives back, reload and storage failure; marker holds no birthday and expires', () => {
    const store = new Map(),
      runtime = { getStorageSync: (k) => store.get(k), setStorageSync: (k, v) => store.set(k, v) };
    let now = 1000;
    const session = createAgeSession(runtime, () => now);
    session.block();
    expect([...store.values()]).toEqual([{ blocked: true, expiresAt: 86_401_000 }]);
    expect(createAgeSession(runtime, () => now).isBlocked()).toBe(true);
    now += 86_400_001;
    expect(session.isBlocked()).toBe(true);
    expect(createAgeSession(runtime, () => now).isBlocked()).toBe(false);
    const broken = createAgeSession({
      getStorageSync() {
        throw Error();
      },
      setStorageSync() {
        throw Error();
      }
    });
    broken.block();
    expect(broken.isBlocked()).toBe(true);
  });
  it.each(['zh-CN', 'en'])('short error copy and registered login strings in %s', (language) => {
    setLanguage(language);
    expect(loginErrorText({ errorCode: 'SMS_DISABLED' })).toBe(t('login.smsClosed'));
    expect(loginErrorText({ message: 'private credentials' })).toBe(t('login.retry'));
    for (const value of ['__proto__', 'constructor', 'toString']) {
      expect(loginErrorText({ errorCode: value })).toBe(t('login.retry'));
      expect(loginErrorText({ message: value })).toBe(t('login.retry'));
    }
    for (const key of ['title', 'phone', 'birth', 'blocked', 'consent'])
      expect(t(`login.${key}`)).not.toBe(`login.${key}`);
  });
});
describe('login page explicit actions', () => {
  it('邮箱成功登录相同账户也生成新会话代号', async () => {
    uni.setStorageSync('yozi_login_region', 'CN');
    storageService.saveLoginSession({ userId: 'email-epoch-user', token: 'synthetic-email-token', userInfo: {} });
    const oldEpoch = getLoginSessionEpoch();
    const wrapper = open();
    await flushPromises();
    await agree(wrapper);
    await action(wrapper, '使用邮箱登录').vm.$emit('tap');
    await flushPromises();
    const fields = wrapper.findAllComponents(BaseInput);
    await fields[0].vm.$emit('update:modelValue', 'fixture@example.invalid');
    await fields[1].vm.$emit('update:modelValue', 'SyntheticPassword123');
    mocks.email.mockResolvedValueOnce({
      code: 0,
      data: { userId: 'email-epoch-user', token: 'synthetic-email-token' }
    });
    await action(wrapper, '登录').vm.$emit('tap');
    await flushPromises();
    expect(getLoginSessionEpoch()).toBeTruthy();
    expect(getLoginSessionEpoch()).not.toBe(oldEpoch);
  });
  it.each(
    ['US', 'CN'].flatMap((region) =>
      ['zh-CN', 'en'].flatMap((language) => [false, true].map((sms) => [region, language, sms]))
    )
  )('%s / %s / SMS %s gives only the first available method primary emphasis', async (region, language, sms) => {
    uni.setStorageSync('yozi_login_region', region);
    setLanguage(language);
    mocks.api.mockResolvedValue({
      code: 0,
      data: { apple: { clientId: 'fixture' }, google: { clientId: 'fixture' }, wechat: true, sms }
    });
    const wrapper = open();
    await flushPromises();
    const buttons = wrapper.get('.login-stack').findAllComponents(BaseButton);
    const names = buttons.map((button) => button.text());
    expect(names[0]).toBe(t(`login.${region === 'US' ? 'apple' : sms ? 'phone' : 'wechat'}`));
    expect(buttons.filter((button) => button.props('variant') === 'primary')).toHaveLength(1);
    expect(buttons[0].props('variant')).toBe('primary');
    expect(buttons[0].props('disabled')).toBe(false);
    expect(Boolean(action(wrapper, t('login.phone')))).toBe(sms);
    expect(mocks.api.mock.calls.every(([body]) => body.type === 'capabilities')).toBe(true);
  });
  it('a rejected age ticket clears the proof and returns to neutral confirmation', async () => {
    uni.setStorageSync('yozi_login_region', 'US');
    const wrapper = open();
    await flushPromises();
    await agree(wrapper);
    await action(wrapper, '使用邮箱登录').vm.$emit('tap');
    await flushPromises();
    const birth = wrapper.findAllComponents(BaseInput);
    await birth[0].vm.$emit('update:modelValue', '2000');
    await birth[1].vm.$emit('update:modelValue', '1');
    await action(wrapper, '继续').vm.$emit('tap');
    await flushPromises();
    mocks.email.mockResolvedValueOnce({ code: 403, errorCode: 'AGE_CONFIRMATION_REQUIRED' });
    const fields = wrapper.findAllComponents(BaseInput);
    await fields[0].vm.$emit('update:modelValue', 'fixture@example.invalid');
    await fields[1].vm.$emit('update:modelValue', 'SyntheticPassword123');
    await action(wrapper, '登录').vm.$emit('tap');
    await flushPromises();
    expect(wrapper.find('.age-form').exists()).toBe(true);
    expect(wrapper.findAllComponents(BaseInput).map((field) => field.props('modelValue'))).toEqual(['', '']);
    expect(wrapper.find('[role="alert"]').text()).toBe(t('login.confirmAgain'));
  });
  it('region keyboard event saves selection without changing language; consent gates login; age form is neutral', async () => {
    uni.setStorageSync('yozi_login_region', 'CN');
    const wrapper = open();
    await flushPromises();
    const regions = wrapper.findComponent(BaseSegmented);
    await regions.vm.$emit('update:modelValue', 'US');
    await flushPromises();
    expect(uni.getStorageSync('yozi_login_region')).toBe('US');
    expect(wrapper.text()).toContain('登录 Yozi AI');
    expect(action(wrapper, '使用邮箱登录').props('disabled')).toBe(false);
    await action(wrapper, '使用邮箱登录').vm.$emit('tap');
    await flushPromises();
    expect(wrapper.find('.age-form').exists()).toBe(false);
    expect(wrapper.find('[role=alert]').text()).toBe(t('login.consent'));
    expect(mocks.api.mock.calls.every(([body]) => body.type === 'capabilities')).toBe(true);
    await agree(wrapper);
    await action(wrapper, '使用邮箱登录').vm.$emit('tap');
    await flushPromises();
    expect(wrapper.find('.age-form').exists()).toBe(true);
    expect(wrapper.find('.age-form .login-subtitle').text()).not.toContain('13');
    const inputs = wrapper.findAllComponents(BaseInput);
    await inputs[0].vm.$emit('update:modelValue', '2000');
    await inputs[1].vm.$emit('update:modelValue', '1');
    await action(wrapper, '继续').vm.$emit('tap');
    await flushPromises();
    expect(wrapper.find('.email-form').exists()).toBe(true);
    expect(mocks.api).toHaveBeenCalledWith({ type: 'age_confirm', region: 'US', year: 2000, month: 1 });
    expect(uni.getStorageSync('yozi_birth')).toBeFalsy();
  });
  it('unavailable phone sign-in is hidden without sending a request in English', async () => {
    uni.setStorageSync('yozi_login_region', 'CN');
    setLanguage('en');
    const wrapper = open();
    await flushPromises();
    await agree(wrapper);
    expect(action(wrapper, 'Continue with phone')).toBeUndefined();
    expect(wrapper.text()).not.toContain('unavailable');
    expect(action(wrapper, 'Continue with email')).toBeTruthy();
    expect(mocks.api.mock.calls.every(([body]) => body.type === 'capabilities')).toBe(true);
  });
  it('shows a service status and no form when every sign-in method is unavailable', async () => {
    mocks.api.mockResolvedValue({ code: 0, data: { email: false, sms: false, wechat: false } });
    const wrapper = open();
    await flushPromises();
    expect(wrapper.get('[role="status"]').text()).toBe('登录服务暂时不可用，请稍后再试');
    expect(wrapper.findAllComponents(BaseInput)).toHaveLength(0);
    expect(action(wrapper, '使用邮箱登录')).toBeUndefined();
  });
  it('underage erases all draft values, does not call backend, and back cannot reopen age', async () => {
    uni.setStorageSync('yozi_login_region', 'US');
    const wrapper = open();
    await flushPromises();
    await agree(wrapper);
    await action(wrapper, '使用邮箱登录').vm.$emit('tap');
    await flushPromises();
    const inputs = wrapper.findAllComponents(BaseInput);
    await inputs[0].vm.$emit('update:modelValue', '2020');
    await inputs[1].vm.$emit('update:modelValue', '1');
    await action(wrapper, '继续').vm.$emit('tap');
    await flushPromises();
    expect(wrapper.find('.age-blocked').exists()).toBe(true);
    expect(mocks.api.mock.calls).toHaveLength(1);
    expect(uni.getStorageSync('yozi_age_block')).toMatchObject({ blocked: true });
    await action(wrapper, '返回').vm.$emit('tap');
    await flushPromises();
    await action(wrapper, '使用邮箱登录').vm.$emit('tap');
    await flushPromises();
    expect(wrapper.find('.age-blocked').exists()).toBe(true);
    expect(wrapper.findAllComponents(BaseInput)).toHaveLength(0);
  });
});

it('inflight-2: old response is rejected after logout and identical-account relogin', async () => {
  uni.setStorageSync('yozi_login_region', 'CN');
  storageService.saveLoginSession({ userId: 'email-epoch-user', token: 'synthetic-email-token', userInfo: {} });
  const wrapper = open();
  await flushPromises();
  await agree(wrapper);
  await action(wrapper, '使用邮箱登录').vm.$emit('tap');
  await flushPromises();
  const fields = wrapper.findAllComponents(BaseInput);
  await fields[0].vm.$emit('update:modelValue', 'fixture@example.invalid');
  await fields[1].vm.$emit('update:modelValue', 'SyntheticPassword123');
  let resolve;
  mocks.email.mockImplementationOnce(
    () =>
      new Promise((r) => {
        resolve = r;
      })
  );
  await action(wrapper, '登录').vm.$emit('tap');
  await flushPromises();
  storageService._clearRevokedCredentials();
  storageService.saveLoginSession({ userId: 'email-epoch-user', token: 'synthetic-email-token', userInfo: {} });
  const epoch = getLoginSessionEpoch();
  resolve({ code: 0, data: { userId: 'other-fixture', token: 'other-fixture-token' } });
  await flushPromises();
  expect(getLoginSessionEpoch()).toBe(epoch);
});
