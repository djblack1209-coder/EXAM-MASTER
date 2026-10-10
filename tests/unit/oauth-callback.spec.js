import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { mount } from '@vue/test-utils';
import QQCallback from '@/pages/login/qq-callback.vue';
import WechatCallback from '@/pages/login/wechat-callback.vue';
import {
  beginWebOAuth,
  consumeWebOAuth,
  requestNativeWechatCode,
  loginNativeWechat,
  requestNativeQQCredential,
  loginNativeQQ
} from '@/pages/login/oauth-utils.js';
import { storageService } from '@/services/storageService.js';
import { getToken, getUserId } from '@/services/auth-storage.js';
import { useThemeStore } from '@/stores/modules/theme.js';
import { logger } from '@/utils/logger.js';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const mocks = vi.hoisted(() => ({ hooks: [], qq: vi.fn(), wechat: vi.fn(), wechatWeb: vi.fn(), desktop: vi.fn() }));
vi.mock('@dcloudio/uni-app', () => ({ onLoad: (handler) => mocks.hooks.push(handler) }));
vi.mock('@/stores/modules/auth', () => ({
  useAuthStore: () => ({
    loginByQQH5: mocks.qq,
    loginByWechatH5: mocks.wechat,
    loginByWechatWeb: mocks.wechatWeb,
    desktopOAuth: mocks.desktop
  })
}));
vi.mock('@/utils/logger.js', () => ({
  logger: { log: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}));
const stubs = {
  view: { template: '<div><slot /></div>' },
  text: { template: '<span><slot /></span>' },
  BaseIcon: true
};
const wrappers = [];
function openCallback(component) {
  const wrapper = mount(component, { global: { stubs } });
  wrappers.push(wrapper);
  return { wrapper, load: mocks.hooks.at(-1) };
}
function request(provider, { queryLocation = 'hash', extra = '', wechatMode = 'h5' } = {}) {
  const authorization = new URL(beginWebOAuth(provider, 'isolated-app-id', '', { wechatMode }));
  const state = authorization.searchParams.get('state');
  const redirectUri = authorization.searchParams.get('redirect_uri');
  const code = 'isolated-code-123';
  const callback = new URL(redirectUri);
  const query = `code=${code}&state=${state}${extra}`;
  if (queryLocation === 'hash') callback.hash += `?${query}`;
  if (queryLocation === 'search') callback.search = query;
  location.href = callback.href;
  return { code, state, redirectUri };
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.hooks.length = 0;
  setActivePinia(createPinia());
  uni.clearStorageSync();
  localStorage.clear();
  location.href = 'https://245334.xyz/#/pages/login/index';
  const response = {
    code: 0,
    data: { userId: 'oauth-isolated-user', token: 'isolated-session', nickname: '验收账户' }
  };
  mocks.qq.mockResolvedValue(response);
  mocks.wechat.mockResolvedValue(response);
  mocks.wechatWeb.mockResolvedValue(response);
  mocks.desktop.mockResolvedValue({ code: 0, data: { desktopReady: true } });
});
afterEach(() => {
  vi.useRealTimers();
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount());
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  delete window.__TAURI_INTERNALS__;
});

for (const [provider, component, call, key, wechatMode = 'h5'] of [
  ['qq', QQCallback, mocks.qq, 'qq_oauth_state'],
  ['wechat', WechatCallback, mocks.wechat, 'wx_oauth_state'],
  ['wechat', WechatCallback, mocks.wechatWeb, 'wx_oauth_state', 'website']
]) {
  describe(`${provider} ${wechatMode} 网页授权回调`, () => {
    it.each(['hash', 'search', 'router'])('实际页面读取 %s 参数并沿现有 Store 登录', async (queryLocation) => {
      const params = request(provider, { queryLocation, wechatMode });
      const { wrapper, load } = openCallback(component);
      await load(queryLocation === 'router' ? { code: params.code, state: params.state } : {});
      expect(call).toHaveBeenCalledExactlyOnceWith(
        provider === 'qq' ? { code: params.code, redirectUri: params.redirectUri } : params.code
      );
      if (provider === 'wechat') {
        expect(wechatMode === 'website' ? mocks.wechat : mocks.wechatWeb).not.toHaveBeenCalled();
      }
      expect(wrapper.text()).toContain('登录成功');
      expect(getUserId()).toBe('oauth-isolated-user');
      expect(getToken()).toBe('isolated-session');
      expect(storageService.get(key)).toBeFalsy();
      expect(location.href).not.toContain(params.code);
      expect(location.href).not.toContain(params.state);
      expect(JSON.stringify(logger.log.mock.calls)).not.toContain('oauth-isolated-user');
    });
    it('无发起记录的回调不能交换授权码或改账户', async () => {
      location.hash = `#/pages/login/${provider === 'qq' ? 'qq' : 'wechat'}-callback?code=unknown123&state=unknown`;
      const { wrapper, load } = openCallback(component);
      await load({});
      expect(wrapper.text()).toContain('安全验证失败');
      expect(call).not.toHaveBeenCalled();
      expect(getToken()).toBeNull();
    });
    it.each(['wrong-state', 'expired', 'duplicate', 'conflict', 'missing-code', 'cancel'])(
      '%s 被拒绝且校验只使用一次',
      async (failure) => {
        const params = request(provider, { wechatMode });
        const options = {};
        if (failure === 'wrong-state') options.state = 'wrong';
        if (failure === 'expired') {
          const context = storageService.get(key);
          storageService.save(key, { ...context, createdAt: Date.now() - 11 * 60 * 1000 });
        }
        if (failure === 'duplicate') location.hash += `&state=${params.state}`;
        if (failure === 'conflict') location.search = '?code=another-code';
        if (failure === 'missing-code') location.hash = location.hash.replace(`code=${params.code}&`, '');
        if (failure === 'cancel') location.hash += '&error=access_denied&error_description=private-description';
        const { wrapper, load } = openCallback(component);
        await load(options);
        expect(call).not.toHaveBeenCalled();
        expect(wrapper.text()).toContain('登录失败');
        expect(wrapper.text()).not.toContain('private-description');
        expect(storageService.get(key)).toBeFalsy();
        expect(() => consumeWebOAuth(provider, { code: params.code, state: params.state })).toThrow('安全验证失败');
      }
    );
    it('等待响应期间离开页面，迟到成功不保存身份', async () => {
      request(provider, { wechatMode });
      let resolve;
      call.mockImplementation(
        () =>
          new Promise((done) => {
            resolve = done;
          })
      );
      const { wrapper, load } = openCallback(component);
      const pending = load({});
      wrapper.unmount();
      resolve({ code: 0, data: { token: 'late-session', userId: 'late-user' } });
      await pending;
      expect(getToken()).toBeNull();
      expect(uni.switchTab).not.toHaveBeenCalled();
    });
    it('等待响应期间切换账户，保留新账户身份', async () => {
      request(provider, { wechatMode });
      let resolve;
      call.mockImplementation(
        () =>
          new Promise((done) => {
            resolve = done;
          })
      );
      const { wrapper, load } = openCallback(component);
      const pending = load({});
      storageService.save('EXAM_USER_ID', 'new-user');
      storageService.save('EXAM_TOKEN', 'new-session');
      resolve({ code: 0, data: { token: 'old-session', userId: 'old-user' } });
      await pending;
      expect(wrapper.text()).toContain('账户已变化');
      expect(getUserId()).toBe('new-user');
      expect(getToken()).toBe('new-session');
    });
    it('重放回调不重复登录，错误页键盘可以重新进入登录', async () => {
      const params = request(provider, { wechatMode });
      const first = openCallback(component);
      await first.load({});
      await first.load({ code: params.code, state: params.state });
      first.wrapper.unmount();
      const second = openCallback(component);
      await second.load({ code: params.code, state: params.state });
      expect(call).toHaveBeenCalledTimes(1);
      expect(second.wrapper.text()).toContain('安全验证失败');
      const retry = second.wrapper.find('[role="button"]');
      await retry.trigger('keydown', { key: 'Enter' });
      expect(uni.redirectTo).toHaveBeenCalledWith({ url: '/pages/login/index' });
    });
    it('回调错误页跟随共享深浅色状态', async () => {
      const { wrapper, load } = openCallback(component);
      await load({});
      const theme = useThemeStore();
      theme.setDarkMode(true);
      await wrapper.vm.$nextTick();
      expect(wrapper.find('.callback-container').classes()).toContain('dark-mode');
      theme.setDarkMode(false);
      await wrapper.vm.$nextTick();
      expect(wrapper.find('.callback-container').classes()).not.toContain('dark-mode');
    });
  });
}

describe('桌面系统浏览器回调', () => {
  for (const [provider, component] of [
    ['qq', QQCallback],
    ['wechat', WechatCallback]
  ]) {
    it(`${provider} 只提交一次授权结果并提示返回桌面，不保存或覆盖浏览器身份`, async () => {
      const state = `desktop_${'ab'.repeat(32)}`;
      location.href = `https://245334.xyz/#/pages/login/${provider}-callback?code=isolated-desktop-code&state=${state}`;
      storageService.save('EXAM_USER_ID', 'existing-browser-user', true);
      storageService.save('EXAM_TOKEN', 'existing-browser-session', true);
      const { wrapper, load } = openCallback(component);
      await load({});
      await load({ code: 'isolated-desktop-code', state });
      expect(mocks.desktop).toHaveBeenCalledExactlyOnceWith({
        action: 'complete',
        provider,
        code: 'isolated-desktop-code',
        state
      });
      expect(wrapper.text()).toContain('授权已完成');
      expect(wrapper.text()).toContain('请返回Yozi AI桌面应用继续学习');
      expect(wrapper.text()).not.toContain('问理');
      expect(getUserId()).toBe('existing-browser-user');
      expect(getToken()).toBe('existing-browser-session');
      expect(uni.switchTab).not.toHaveBeenCalled();
      expect(location.href).not.toContain(state);
      expect(location.href).not.toContain('isolated-desktop-code');
      expect(mocks.qq).not.toHaveBeenCalled();
      expect(mocks.wechat).not.toHaveBeenCalled();
      expect(mocks.wechatWeb).not.toHaveBeenCalled();
    });
    it(`${provider} 取消的桌面回调不泄露供应商错误说明`, async () => {
      const state = `desktop_${'ab'.repeat(32)}`;
      location.href = `https://245334.xyz/#/pages/login/${provider}-callback?state=${state}&error=access_denied&error_description=private-description`;
      mocks.desktop.mockResolvedValueOnce({ code: 401, message: '用户取消授权' });
      const { wrapper, load } = openCallback(component);
      await load({});
      expect(mocks.desktop).toHaveBeenCalledExactlyOnceWith({
        action: 'complete',
        provider,
        state,
        error: 'access_denied'
      });
      expect(wrapper.text()).toContain('用户取消授权');
      expect(wrapper.text()).not.toContain('private-description');
      expect(getToken()).toBeNull();
    });
    it(`${provider} 离开页面后迟到回执不能显示成功`, async () => {
      let resolve;
      location.href = `https://245334.xyz/#/pages/login/${provider}-callback?code=isolated-desktop-code&state=desktop_${'ab'.repeat(32)}`;
      mocks.desktop.mockImplementationOnce(
        () =>
          new Promise((done) => {
            resolve = done;
          })
      );
      const { wrapper, load } = openCallback(component);
      const pending = load({});
      wrapper.unmount();
      resolve({
        code: 0,
        data: { desktopReady: true, token: 'ignored-browser-token', userId: 'ignored-browser-user' }
      });
      await pending;
      expect(getToken()).toBeNull();
      expect(uni.switchTab).not.toHaveBeenCalled();
    });
  }
});

describe('授权发起边界', () => {
  it('网站应用使用扫码入口、独立 AppID 与 snsapi_login，并绑定发起时的应用类型', () => {
    const authorization = new URL(beginWebOAuth('wechat', 'isolated-web-app', '', { wechatMode: 'website' }));
    expect(authorization.origin + authorization.pathname).toBe('https://open.weixin.qq.com/connect/qrconnect');
    expect(authorization.searchParams.get('appid')).toBe('isolated-web-app');
    expect(authorization.searchParams.get('scope')).toBe('snsapi_login');
    expect(storageService.get('wx_oauth_state')).toMatchObject({ wechatMode: 'website' });
    location.href = `${authorization.searchParams.get('redirect_uri')}?code=isolated-code-123&state=${authorization.searchParams.get('state')}&wechatMode=h5`;
    expect(consumeWebOAuth('wechat')).toMatchObject({ code: 'isolated-code-123', wechatMode: 'website' });
  });
  it('旧公众号上下文继续使用公众号，回调参数不能改成网站应用', () => {
    request('wechat', { extra: '&wechatMode=website' });
    const context = storageService.get('wx_oauth_state');
    delete context.wechatMode;
    storageService.save('wx_oauth_state', context, true);
    expect(consumeWebOAuth('wechat').wechatMode).toBe('h5');
  });
  it('未知微信授权类型拒绝，清除上下文且不交换授权码', async () => {
    request('wechat', { wechatMode: 'website' });
    storageService.save('wx_oauth_state', { ...storageService.get('wx_oauth_state'), wechatMode: 'unknown' }, true);
    const { wrapper, load } = openCallback(WechatCallback);
    await load({});
    expect(wrapper.text()).toContain('安全验证失败');
    expect(mocks.wechat).not.toHaveBeenCalled();
    expect(mocks.wechatWeb).not.toHaveBeenCalled();
    expect(storageService.get('wx_oauth_state')).toBeFalsy();
    expect(() => beginWebOAuth('wechat', 'isolated-app', '', { wechatMode: 'unknown' })).toThrow('授权方式');
  });
  it.each(['qq', 'wechat'])('给 %s 平台的注册回调使用无片段的实际入口', (provider) => {
    const authorization = new URL(beginWebOAuth(provider, 'isolated-app'));
    const callback = new URL(authorization.searchParams.get('redirect_uri'));
    expect(callback.origin).toBe(location.origin);
    expect(callback.hash).toBe('');
    expect(callback.pathname).toBe(`/oauth/${provider}.html`);
  });
  it('拒绝带片段的旧注册回调，且不保存授权上下文', () => {
    expect(() => beginWebOAuth('qq', 'isolated-app', `${location.origin}/#/pages/login/qq-callback`)).toThrow(
      '回调地址'
    );
    expect(storageService.get('qq_oauth_state')).toBeFalsy();
  });
  it('网页回调页面均已登记到实际客户端路由', () => {
    const pages = JSON.parse(readFileSync('src/pages.json', 'utf8'));
    const routes = pages.subPackages.flatMap((group) => group.pages.map((page) => `${group.root}/${page.path}`));
    expect(routes).toContain('pages/login/qq-callback');
    expect(routes).toContain('pages/login/wechat-callback');
  });
  it('普通网页不会仅凭编译标志取得桌面能力', () => {
    vi.stubGlobal('__WENLI_DESKTOP__', true);
    expect(new URL(beginWebOAuth('qq', 'isolated-app')).origin).toBe('https://graph.qq.com');
  });
  it('真实桌面拒绝嵌入网页授权，且不保存待回调状态', () => {
    vi.stubGlobal('__WENLI_DESKTOP__', true);
    window.__TAURI_INTERNALS__ = { invoke: vi.fn() };
    expect(() => beginWebOAuth('qq', 'isolated-app')).toThrow('请使用邮箱登录');
    expect(storageService.get('qq_oauth_state')).toBeFalsy();
    expect(window.__TAURI_INTERNALS__.invoke).not.toHaveBeenCalled();
  });
  it('回调跨域或无法生成随机校验值时不跳转、不保存', () => {
    expect(() => beginWebOAuth('qq', 'isolated-app', 'https://other.example/callback')).toThrow('当前页面不一致');
    vi.stubGlobal('crypto', undefined);
    expect(() => beginWebOAuth('qq', 'isolated-app')).toThrow('安全授权');
    expect(storageService.get('qq_oauth_state')).toBeFalsy();
  });
  it('上下文存储失败不发起授权', () => {
    vi.spyOn(storageService, 'save').mockReturnValue(false);
    expect(() => beginWebOAuth('qq', 'isolated-app')).toThrow('无法保存');
  });
});

describe('平台返回到真实静态入口再进入现有页面', () => {
  function relay(provider, extra = '') {
    const authorization = new URL(beginWebOAuth(provider, 'isolated-app'));
    const redirectUri = authorization.searchParams.get('redirect_uri');
    const state = authorization.searchParams.get('state');
    const callback = new URL(redirectUri);
    callback.search = `code=isolated-code-123&state=${state}${extra}`;
    const replace = vi.fn();
    const scrub = vi.fn();
    runInNewContext(readFileSync('public/oauth/callback.js', 'utf8'), {
      URL,
      URLSearchParams,
      window: { location: { href: callback.href, replace }, history: { state: null, replaceState: scrub } }
    });
    expect(scrub).toHaveBeenCalledExactlyOnceWith(null, '', redirectUri);
    expect(replace).toHaveBeenCalledOnce();
    location.href = replace.mock.calls[0][0];
    expect(new URL(location.href).origin).toBe(new URL(redirectUri).origin);
    expect(new URL(location.href).search).toBe('');
    return { redirectUri };
  }
  for (const [provider, component, call] of [
    ['qq', QQCallback, mocks.qq],
    ['wechat', WechatCallback, mocks.wechat]
  ]) {
    it(`${provider} 静态入口保留一次校验并在成功后清除授权参数`, async () => {
      const { redirectUri } = relay(provider, '&redirect=https%3A%2F%2Funtrusted.example');
      expect(location.href).not.toContain('untrusted.example');
      expect(location.hash).toContain(`/pages/login/${provider === 'qq' ? 'qq' : 'wechat'}-callback?`);
      const { wrapper, load } = openCallback(component);
      await load({});
      expect(wrapper.text()).toContain('登录成功');
      expect(call).toHaveBeenCalledExactlyOnceWith(
        provider === 'qq' ? { code: 'isolated-code-123', redirectUri } : 'isolated-code-123'
      );
      expect(location.href).not.toContain('isolated-code');
    });
    it(`${provider} 静态入口不掩盖重复参数，实际页面仍在交换前拒绝`, async () => {
      relay(provider, '&code=duplicate-code');
      const { wrapper, load } = openCallback(component);
      await load({});
      expect(wrapper.text()).toContain('授权参数不明确');
      expect(call).not.toHaveBeenCalled();
    });
  }
});

describe('移动微信仅取授权码且不接受迟到身份', () => {
  function sdk() {
    let callbacks;
    const runtime = {
      login: vi.fn((options) => {
        callbacks = options;
      }),
      getUserInfo: vi.fn()
    };
    return { runtime, callbacks: () => callbacks };
  }
  it('官方 SDK 只授权模式，传给现有登录接口的仅 code 和 platform', async () => {
    const native = sdk();
    const exchange = vi.fn().mockResolvedValue({ code: 0, data: { token: 'own-session', userId: 'own-user' } });
    const pending = loginNativeWechat(native.runtime, exchange, () => true);
    expect(native.callbacks()).toMatchObject({ provider: 'weixin', onlyAuthorize: true });
    native.callbacks().success({
      code: 'isolated-native-code',
      authResult: { access_token: 'provider-private-token', openid: 'untrusted-openid' }
    });
    expect(await pending).toMatchObject({ code: 0 });
    expect(exchange).toHaveBeenCalledExactlyOnceWith({ code: 'isolated-native-code', platform: 'app' });
    expect(native.runtime.getUserInfo).not.toHaveBeenCalled();
  });
  it.each([undefined, 'short', 'a'.repeat(201), 'private&openid=forged'])(
    '不完整 SDK 授权码 %s 不提交',
    async (code) => {
      const native = sdk();
      const exchange = vi.fn();
      const pending = loginNativeWechat(native.runtime, exchange, () => true);
      native.callbacks().success({ code, authResult: { access_token: 'private-token' } });
      await expect(pending).rejects.toThrow('授权码失败');
      expect(exchange).not.toHaveBeenCalled();
    }
  );
  it.each([
    ['cancel private-token', '已取消'],
    ['private-token', '登录失败']
  ])('SDK 失败 %s 仅保留固定消息', async (errMsg, message) => {
    const native = sdk();
    const pending = requestNativeWechatCode(native.runtime);
    native.callbacks().fail({ errMsg });
    await expect(pending).rejects.toThrow(message);
    await expect(pending).rejects.not.toThrow('private-token');
  });
  it('120 秒未返回时结束请求，之后的成功回调不发送授权码', async () => {
    vi.useFakeTimers();
    const native = sdk();
    const exchange = vi.fn();
    const pending = loginNativeWechat(native.runtime, exchange, () => true);
    const rejected = expect(pending).rejects.toThrow('超时');
    await vi.advanceTimersByTimeAsync(120_000);
    await rejected;
    native.callbacks().success({ code: 'late-private-code' });
    await Promise.resolve();
    expect(exchange).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
  it('SDK 重复回调只提交一次，并清理超时计时器', async () => {
    vi.useFakeTimers();
    const native = sdk();
    const exchange = vi.fn().mockResolvedValue({ code: 0 });
    const pending = loginNativeWechat(native.runtime, exchange, () => true);
    native.callbacks().success({ code: 'isolated-native-code' });
    native.callbacks().success({ code: 'another-private-code' });
    native.callbacks().fail({ errMsg: 'cancel' });
    await pending;
    expect(exchange).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });
  it('SDK 返回前页面/账户已变化，不继续调用服务器', async () => {
    const native = sdk();
    const exchange = vi.fn();
    const pending = loginNativeWechat(native.runtime, exchange, () => false);
    native.callbacks().success({ code: 'isolated-native-code' });
    await expect(pending).rejects.toThrow('页面或账户已变化');
    expect(exchange).not.toHaveBeenCalled();
  });
  it('换码期间账户变化，服务器迟到成功不传给身份保存调用方', async () => {
    const native = sdk();
    let current = true,
      respond;
    const exchange = vi.fn(
      () =>
        new Promise((resolve) => {
          respond = resolve;
        })
    );
    const pending = loginNativeWechat(native.runtime, exchange, () => current);
    native.callbacks().success({ code: 'isolated-native-code' });
    await Promise.resolve();
    current = false;
    respond({ code: 0, data: { token: 'late-private-token', userId: 'late-user' } });
    await expect(pending).rejects.toThrow('页面或账户已变化');
    expect(getToken()).toBeNull();
  });
  it('网络错误对象含凭据时也只返回固定消息', async () => {
    const native = sdk();
    const pending = loginNativeWechat(
      native.runtime,
      () => Promise.reject(new Error('private-code')),
      () => true
    );
    native.callbacks().success({ code: 'isolated-native-code' });
    await expect(pending).rejects.toThrow('登录请求失败');
    await expect(pending).rejects.not.toThrow('private-code');
  });
  it('Tauri 不调用移动 SDK；缺 SDK 或同步异常同样安全结束', async () => {
    vi.stubGlobal('__WENLI_DESKTOP__', true);
    window.__TAURI_INTERNALS__ = { invoke: vi.fn() };
    const native = sdk();
    await expect(requestNativeWechatCode(native.runtime)).rejects.toThrow('不支持微信');
    expect(native.runtime.login).not.toHaveBeenCalled();
    delete window.__TAURI_INTERNALS__;
    await expect(requestNativeWechatCode({})).rejects.toThrow('不支持微信');
    await expect(
      requestNativeWechatCode({
        login: () => {
          throw new Error('private-sdk-error');
        }
      })
    ).rejects.toThrow('登录失败');
  });
});

describe('移动 QQ 凭证只交换一次且不接受迟到身份', () => {
  function sdk({ delayProvider = false } = {}) {
    let providerCallbacks, loginCallbacks;
    const runtime = {
      getProvider: vi.fn((options) => {
        providerCallbacks = options;
        if (!delayProvider) options.success({ provider: ['qq'] });
      }),
      login: vi.fn((options) => {
        loginCallbacks = options;
      }),
      getUserInfo: vi.fn()
    };
    return { runtime, provider: () => providerCallbacks, callbacks: () => loginCallbacks };
  }
  it('SDK 仅提供 token，服务端沿现有 Store 验证应用/身份；不上传客户端资料', async () => {
    const native = sdk();
    const exchange = vi.fn().mockResolvedValue({ code: 0, data: { token: 'own-session', userId: 'own-user' } });
    const pending = loginNativeQQ(native.runtime, exchange, () => true);
    expect(native.callbacks()).toMatchObject({ provider: 'qq' });
    expect(native.callbacks()).not.toHaveProperty('onlyAuthorize');
    native.callbacks().success({
      authResult: { access_token: 'TEST_ONLY_token+&=?', openid: 'untrusted-openid' },
      userInfo: { role: 'admin' },
      code: 'unused-code'
    });
    expect(await pending).toMatchObject({ code: 0 });
    expect(exchange).toHaveBeenCalledExactlyOnceWith({ accessToken: 'TEST_ONLY_token+&=?', platform: 'app' });
    expect(native.runtime.getUserInfo).not.toHaveBeenCalled();
  });
  it.each([undefined, '', 'has space', 'line\nbreak', 'a'.repeat(2049), 123])(
    '无效 SDK token 不进入业务请求',
    async (access_token) => {
      const native = sdk();
      const exchange = vi.fn();
      const pending = loginNativeQQ(native.runtime, exchange, () => true);
      native.callbacks().success({ authResult: { access_token }, code: 'must-not-fallback' });
      await expect(pending).rejects.toThrow('登录凭证失败');
      expect(exchange).not.toHaveBeenCalled();
    }
  );
  it.each([
    ['cancel TEST_ONLY_private_token', '已取消QQ登录'],
    ['deny TEST_ONLY_private_token', '用户拒绝授权'],
    ['TEST_ONLY_private_token', 'QQ登录失败']
  ])('SDK 失败只显示固定消息', async (errMsg, message) => {
    const native = sdk();
    const pending = requestNativeQQCredential(native.runtime);
    native.callbacks().fail({ errMsg });
    await expect(pending).rejects.toThrow(message);
    await expect(pending).rejects.not.toThrow('TEST_ONLY_private_token');
  });
  it.each(['provider', 'login'])('等待 %s 超过 120 秒安全结束，迟到回调不能登录', async (stage) => {
    vi.useFakeTimers();
    const native = sdk({ delayProvider: stage === 'provider' });
    const exchange = vi.fn();
    const pending = loginNativeQQ(native.runtime, exchange, () => true);
    const rejected = expect(pending).rejects.toThrow('超时');
    await vi.advanceTimersByTimeAsync(120_000);
    await rejected;
    native.provider().success({ provider: ['qq'] });
    native.callbacks()?.success({ authResult: { access_token: 'late-private-token' } });
    await Promise.resolve();
    expect(exchange).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
    if (stage === 'provider') expect(native.runtime.login).not.toHaveBeenCalled();
  });
  it('重复 provider/SDK 回调只提交一次，迟到 provider 失败不撤销在途 SDK', async () => {
    vi.useFakeTimers();
    const native = sdk();
    const exchange = vi.fn().mockResolvedValue({ code: 0 });
    const pending = loginNativeQQ(native.runtime, exchange, () => true);
    native.provider().success({ provider: ['qq'] });
    native.provider().fail({ errMsg: 'late-provider-error' });
    native.callbacks().success({ authResult: { access_token: 'TEST_ONLY_first_token' } });
    native.callbacks().success({ authResult: { access_token: 'TEST_ONLY_late_token' } });
    native.callbacks().fail({ errMsg: 'cancel' });
    await pending;
    expect(native.runtime.login).toHaveBeenCalledTimes(1);
    expect(exchange).toHaveBeenCalledExactlyOnceWith({ accessToken: 'TEST_ONLY_first_token', platform: 'app' });
    expect(vi.getTimerCount()).toBe(0);
  });
  it('SDK 返回前账户/页面改变，不继续交换 token', async () => {
    const native = sdk();
    const exchange = vi.fn();
    const pending = loginNativeQQ(native.runtime, exchange, () => false);
    native.callbacks().success({ authResult: { access_token: 'TEST_ONLY_token' } });
    await expect(pending).rejects.toThrow('页面或账户已变化');
    expect(exchange).not.toHaveBeenCalled();
  });
  it('服务器响应到达前账户变化，旧会话不传给保存调用方', async () => {
    const native = sdk();
    let current = true,
      respond;
    const exchange = vi.fn(
      () =>
        new Promise((resolve) => {
          respond = resolve;
        })
    );
    const pending = loginNativeQQ(native.runtime, exchange, () => current);
    native.callbacks().success({ authResult: { access_token: 'TEST_ONLY_token' } });
    await Promise.resolve();
    current = false;
    respond({ code: 0, data: { token: 'late-token', userId: 'late-user' } });
    await expect(pending).rejects.toThrow('页面或账户已变化');
    expect(getToken()).toBeNull();
  });
  it('网络错误不显示原始 SDK/token 数据', async () => {
    const native = sdk();
    const pending = loginNativeQQ(
      native.runtime,
      () => Promise.reject(new Error('TEST_ONLY_private_token')),
      () => true
    );
    native.callbacks().success({ authResult: { access_token: 'TEST_ONLY_token' } });
    await expect(pending).rejects.toThrow('登录请求失败');
    await expect(pending).rejects.not.toThrow('TEST_ONLY_private_token');
  });
  it('未包含 QQ provider 时不调用 SDK，不能伪造业务会话', async () => {
    const native = sdk({ delayProvider: true });
    const pending = requestNativeQQCredential(native.runtime);
    native.provider().success({ provider: [] });
    await expect(pending).rejects.toThrow('请先安装QQ客户端');
    expect(native.runtime.login).not.toHaveBeenCalled();
  });
  it('Tauri/缺 SDK/同步 SDK 异常均安全结束，不输出原始错误', async () => {
    vi.stubGlobal('__WENLI_DESKTOP__', true);
    window.__TAURI_INTERNALS__ = { invoke: vi.fn() };
    const native = sdk();
    await expect(requestNativeQQCredential(native.runtime)).rejects.toThrow('不支持QQ');
    expect(native.runtime.getProvider).not.toHaveBeenCalled();
    delete window.__TAURI_INTERNALS__;
    vi.unstubAllGlobals();
    await expect(requestNativeQQCredential({})).rejects.toThrow('不支持QQ');
    await expect(
      requestNativeQQCredential({
        login: vi.fn(),
        getProvider: () => {
          throw new Error('TEST_ONLY_private_error');
        }
      })
    ).rejects.toThrow('QQ登录失败');
    const throwing = sdk({ delayProvider: true });
    throwing.runtime.login = () => {
      throw new Error('TEST_ONLY_private_error');
    };
    const pending = requestNativeQQCredential(throwing.runtime);
    throwing.provider().success({ provider: ['qq'] });
    await expect(pending).rejects.toThrow('QQ登录失败');
  });
});
