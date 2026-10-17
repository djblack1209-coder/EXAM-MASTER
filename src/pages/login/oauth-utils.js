import { captureSession } from '@/services/auth-storage.js';
import { storageService } from '@/services/storageService.js';
import { isDesktopRuntime } from '@/services/desktop/runtime.js';

const PARAMS = ['code', 'state', 'error', 'error_description'];
const MAX_AGE_MS = 10 * 60 * 1000;

// App 只取得一次性授权码；供应商密钥和 access_token 由业务服务器持有。
export function requestNativeWechatCode(runtime) {
  if (isDesktopRuntime() || typeof runtime?.login !== 'function') {
    return Promise.reject(new Error('当前设备不支持微信登录'));
  }
  return new Promise((resolve, reject) => {
    let finished = false;
    const finish = (error, code) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      if (error) reject(error);
      else resolve(code);
    };
    const timer = setTimeout(() => finish(new Error('微信授权已超时，请重新登录')), 120_000);
    try {
      runtime.login({
        provider: 'weixin',
        onlyAuthorize: true,
        success: (result) => {
          const code = result?.code;
          if (typeof code !== 'string' || !/^[a-zA-Z0-9_-]{10,200}$/.test(code)) {
            finish(new Error('获取微信授权码失败，请重新登录'));
            return;
          }
          finish(null, code);
        },
        fail: (error) => {
          const cancelled = typeof error?.errMsg === 'string' && /cancel|取消/i.test(error.errMsg);
          finish(new Error(cancelled ? '已取消微信登录' : '微信登录失败，请重试'));
        }
      });
    } catch {
      finish(new Error('微信登录失败，请重试'));
    }
  });
}

export async function loginNativeWechat(runtime, exchange, isCurrent) {
  const code = await requestNativeWechatCode(runtime);
  if (!isCurrent()) throw new Error('页面或账户已变化，请重新登录');
  let response;
  try {
    response = await exchange({ code, platform: 'app' });
  } catch {
    throw new Error('登录请求失败，请重试');
  }
  if (!isCurrent()) throw new Error('页面或账户已变化，请重新登录');
  return response;
}

function providerInfo(provider) {
  if (provider === 'wechat') return { key: 'wx_oauth_state', name: '微信', route: 'wechat-callback' };
  throw new Error('不支持的授权方式');
}

function currentUrl() {
  if (typeof location === 'undefined') throw new Error('当前环境不支持网页授权');
  return new URL(location.href);
}

function requireWebOAuth(provider) {
  if (isDesktopRuntime()) {
    throw new Error(`桌面端暂不支持${providerInfo(provider).name}授权，请使用邮箱登录`);
  }
}

export function beginWebOAuth(
  provider,
  appId,
  configuredRedirect = '',
  { wechatMode = 'h5', attempt = storageService.beginLoginAttempt() } = {}
) {
  const info = providerInfo(provider);
  requireWebOAuth(provider);
  if (provider === 'wechat' && !['h5', 'website'].includes(wechatMode)) {
    throw new Error('不支持的微信网页授权方式');
  }
  if (!appId) throw new Error(`${info.name}登录未配置`);
  const page = currentUrl();
  const redirectUri = configuredRedirect || `${page.origin}/oauth/${provider}.html`;
  const callback = new URL(redirectUri);
  // The returning page must be able to read the context from this origin.
  if (
    !['https:', 'http:'].includes(callback.protocol) ||
    callback.origin !== page.origin ||
    callback.username ||
    callback.password
  ) {
    throw new Error(`${info.name}回调地址与当前页面不一致，请联系管理员`);
  }
  if (callback.hash) throw new Error(`${info.name}回调地址不能包含 #，请联系管理员`);
  const bytes = new Uint8Array(16);
  if (typeof globalThis.crypto?.getRandomValues !== 'function') {
    throw new Error('当前环境不支持安全授权，请使用邮箱登录');
  }
  globalThis.crypto.getRandomValues(bytes);
  const nonce = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  if (!storageService.isLoginAttemptCurrent(attempt)) throw new Error('登录尝试已失效，请重新登录');
  const state = `${nonce}_${attempt.id}`;
  const context = {
    state,
    attempt: { id: attempt.id, revocation: attempt.revocation },
    redirectUri,
    origin: page.origin,
    createdAt: Date.now(),
    ...(provider === 'wechat' ? { wechatMode } : {})
  };
  if (
    !storageService.save(info.key, context, true, captureSession()) ||
    !storageService.isLoginAttemptCurrent(attempt)
  ) {
    throw new Error('无法保存授权校验信息，请重新登录');
  }
  const authUrl = new URL(
    wechatMode === 'website'
      ? 'https://open.weixin.qq.com/connect/qrconnect'
      : 'https://open.weixin.qq.com/connect/oauth2/authorize'
  );
  authUrl.searchParams.set('appid', appId);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('scope', wechatMode === 'website' ? 'snsapi_login' : 'snsapi_userinfo');
  if (provider === 'wechat') authUrl.hash = 'wechat_redirect';
  return authUrl.href;
}

function readCallbackParams(options, page) {
  const result = {};
  const add = (key, value) => {
    if (typeof value !== 'string' || value.length > 512 || (result[key] !== undefined && result[key] !== value)) {
      throw new Error('授权参数不明确，请重新登录');
    }
    result[key] = value;
  };
  const hashQuery = page.hash.includes('?') ? page.hash.slice(page.hash.indexOf('?') + 1) : '';
  for (const query of [page.search, hashQuery]) {
    const params = new URLSearchParams(query);
    for (const key of PARAMS) {
      if (params.getAll(key).length > 1) throw new Error('授权参数不明确，请重新登录');
      if (params.has(key)) add(key, params.get(key));
    }
  }
  for (const key of PARAMS) {
    if (Object.prototype.hasOwnProperty.call(options || {}, key)) add(key, options[key]);
  }
  return result;
}

function clearCallbackUrl(page) {
  if (typeof history === 'undefined') return;
  for (const key of PARAMS) page.searchParams.delete(key);
  const queryAt = page.hash.indexOf('?');
  if (queryAt !== -1) {
    const path = page.hash.slice(0, queryAt);
    const params = new URLSearchParams(page.hash.slice(queryAt + 1));
    for (const key of PARAMS) params.delete(key);
    page.hash = path + (params.size ? `?${params}` : '');
  }
  try {
    history.replaceState(history.state, '', page.href);
  } catch {
    // Refusing a history update never grants permission to exchange a code.
  }
}

export function consumeWebOAuth(provider, options = {}) {
  const info = providerInfo(provider);
  const context = storageService.get(info.key);
  // Claim even denied, malformed or expired callbacks before any network request.
  if (!storageService.remove(info.key, true, captureSession())) throw new Error('无法清除授权校验信息，请重新登录');
  requireWebOAuth(provider);
  const page = currentUrl();
  let params;
  try {
    params = readCallbackParams(options, page);
  } finally {
    clearCallbackUrl(page);
  }
  const age = Date.now() - context?.createdAt;
  // Legacy web contexts came only from the public-account path. A callback
  // parameter cannot change the app type selected by the originating page.
  const wechatMode = context?.wechatMode ?? 'h5';
  if (
    !context ||
    !/^[a-f0-9]{32}_[a-zA-Z0-9_-]{8,120}$/.test(context.state) ||
    !context.attempt ||
    !context.state.endsWith(`_${context.attempt.id}`) ||
    !storageService.isLoginAttemptCurrent(context.attempt) ||
    params.state !== context.state ||
    context.origin !== page.origin ||
    !Number.isFinite(age) ||
    age < 0 ||
    age > MAX_AGE_MS ||
    (provider === 'wechat' && !['h5', 'website'].includes(wechatMode))
  ) {
    throw new Error('安全验证失败或授权已过期，请重新登录');
  }
  if (params.error) {
    throw new Error(params.error === 'access_denied' ? '用户取消授权' : `${info.name}授权未完成，请重新登录`);
  }
  if (!params.code || params.code.length < 6 || params.code.length > 200) {
    throw new Error(`未获取到有效${info.name}授权码`);
  }
  return {
    code: params.code,
    attempt: Object.freeze({ ...context.attempt, guestSources: new Map() }),
    redirectUri: context.redirectUri,
    ...(provider === 'wechat' ? { wechatMode } : {})
  };
}

// A broker callback has no ordinary browser login context and must never save
// a desktop account into this browser's existing learning namespace.
export function consumeDesktopOAuth(provider, options = {}) {
  providerInfo(provider);
  const page = currentUrl();
  let params;
  try {
    params = readCallbackParams(options, page);
  } catch {
    return null;
  }
  if (typeof params.state !== 'string' || !params.state.startsWith('desktop_')) return null;
  try {
    requireWebOAuth(provider);
    if (!/^desktop_[a-f0-9]{64}$/.test(params.state)) throw new Error('安全验证失败或授权已过期，请重新登录');
    if (params.error)
      return { state: params.state, error: params.error === 'access_denied' ? 'access_denied' : 'invalid' };
    if (!/^[a-zA-Z0-9_-]{6,200}$/.test(params.code || '')) throw new Error('未获取到有效授权码');
    return { state: params.state, code: params.code };
  } finally {
    clearCallbackUrl(page);
  }
}
