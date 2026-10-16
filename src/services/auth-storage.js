/**
 * 认证信息存储工具（独立模块）
 *
 * 从 storageService.js 中提取，避免 storageService 与 API 请求层循环依赖。
 * 两个模块都可以安全地导入此文件，不会产生循环引用。
 *
 * ✅ 加密/解密逻辑已提取到 utils/crypto/cipher.js 共享模块
 */

import { deobfuscate } from '../utils/crypto/cipher.js';

const LOCAL_COMPAT_PREFIX = '__exam_storage__:';

function readCompatLocalStorage(key) {
  if (typeof localStorage === 'undefined') {
    return '';
  }

  const directValue = localStorage.getItem(key);
  if (directValue !== null) {
    return directValue;
  }

  const compatValue = localStorage.getItem(`${LOCAL_COMPAT_PREFIX}${key}`);
  if (compatValue === null) {
    return '';
  }

  try {
    const parsed = JSON.parse(compatValue);
    if (parsed && typeof parsed === 'object' && Object.prototype.hasOwnProperty.call(parsed, 'value')) {
      return parsed.value;
    }
  } catch {
    // ignore parse failure, fallback to raw value
  }

  return compatValue;
}

function normalizeStringValue(value) {
  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  return '';
}

function safeGetStorageSync(key, strict = false) {
  try {
    // 与 storageService 使用同一个完整存储运行时。静态 uni 访问会被编译器
    // 改写成另一套 H5 读取函数，导致兼容存储中的已登录账户被读成访客。
    const supportsStorage = (candidate) =>
      candidate &&
      ['getStorageSync', 'setStorageSync', 'removeStorageSync'].every(
        (method) => typeof Reflect.get(candidate, method) === 'function'
      );
    const globalRef = typeof globalThis !== 'undefined' ? globalThis : {};
    const runtimeUni = globalRef['uni'];
    const runtimeWx = globalRef['wx'];
    const runtime = supportsStorage(runtimeUni)
      ? runtimeUni
      : supportsStorage(runtimeWx)
        ? runtimeWx
        : typeof wx !== 'undefined' && supportsStorage(wx)
          ? wx
          : null;
    if (runtime) {
      return Reflect.get(runtime, 'getStorageSync').call(runtime, key);
    }
  } catch (error) {
    if (strict) throw error;
  }

  try {
    return readCompatLocalStorage(key);
  } catch (error) {
    if (strict) throw error;
  }

  return '';
}

function getStoredAuthValue(key) {
  try {
    const encrypted = normalizeStringValue(safeGetStorageSync(`_enc_${key}`));
    if (encrypted) {
      const decrypted = deobfuscate(encrypted);
      if (decrypted !== null) return decrypted;
    }
  } catch {
    /* ignore */
  }

  const plainValue = normalizeStringValue(safeGetStorageSync(key));
  return plainValue || null;
}

/**
 * 获取当前用户ID（统一入口）
 */
export const getUserId = () => getStoredAuthValue('EXAM_USER_ID');

/**
 * 获取当前用户Token（统一入口）
 */
export const getToken = () => getStoredAuthValue('EXAM_TOKEN');

export const LOGIN_SESSION_EPOCH_KEY = 'EXAM_SESSION_EPOCH';

export const SESSION_ENABLED_KEY = 'EXAM_SESSION_ENABLED';

// Synchronous SHA-256: supported by uni/wx as well as browsers, with no async credential gap.
// This digest detects torn identity writes; it is never an authorization credential or logged.
const shaPrimes = [];
for (let n = 2; shaPrimes.length < 64; n++) {
  if (!shaPrimes.some((p) => n % p === 0)) shaPrimes.push(n);
}
const shaConstants = shaPrimes.map((p) => (Math.cbrt(p) * 0x100000000) | 0);
let lastCredentialProof;
export function sessionCredentialProof(owner, token) {
  if (lastCredentialProof?.owner === owner && lastCredentialProof.token === token) return lastCredentialProof.value;
  const text = unescape(encodeURIComponent(JSON.stringify([owner, token])));
  const words = [];
  for (let i = 0; i < text.length; i++)
    words[i >> 2] = (words[i >> 2] || 0) | (text.charCodeAt(i) << (24 - (i % 4) * 8));
  words[text.length >> 2] = (words[text.length >> 2] || 0) | (0x80 << (24 - (text.length % 4) * 8));
  const length = (((text.length + 8) >> 6) + 1) * 16;
  words[length - 1] = text.length * 8;
  let hash = shaPrimes.slice(0, 8).map((p) => (Math.sqrt(p) * 0x100000000) | 0);
  const rotate = (v, n) => (v >>> n) | (v << (32 - n));
  for (let offset = 0; offset < length; offset += 16) {
    const w = [];
    let [a, b, c, d, e, f, g, h] = hash;
    for (let i = 0; i < 64; i++) {
      if (i < 16) w[i] = words[offset + i] | 0;
      else {
        const x = w[i - 15],
          y = w[i - 2];
        w[i] =
          (w[i - 16] +
            (rotate(x, 7) ^ rotate(x, 18) ^ (x >>> 3)) +
            w[i - 7] +
            (rotate(y, 17) ^ rotate(y, 19) ^ (y >>> 10))) |
          0;
      }
      const first =
        (h + (rotate(e, 6) ^ rotate(e, 11) ^ rotate(e, 25)) + ((e & f) ^ (~e & g)) + shaConstants[i] + w[i]) | 0;
      const second = ((rotate(a, 2) ^ rotate(a, 13) ^ rotate(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
      h = g;
      g = f;
      f = e;
      e = (d + first) | 0;
      d = c;
      c = b;
      b = a;
      a = (first + second) | 0;
    }
    hash = hash.map((v, i) => (v + [a, b, c, d, e, f, g, h][i]) | 0);
  }
  const value = hash.map((v) => (v >>> 0).toString(16).padStart(8, '0')).join('');
  lastCredentialProof = { owner, token, value };
  return value;
}
const decodedAuth = new Map();
function strictAuthValue(key) {
  const encrypted = normalizeStringValue(safeGetStorageSync(`_enc_${key}`, true));
  if (encrypted) {
    const value = decodedAuth.has(encrypted) ? decodedAuth.get(encrypted) : deobfuscate(encrypted);
    if (value === null) throw new Error('登录状态暂不可读，请重试');
    decodedAuth.set(encrypted, value);
    if (decodedAuth.size > 12) decodedAuth.delete(decodedAuth.keys().next().value);
    return value;
  }
  return safeGetStorageSync(key, true) || null;
}
const validEpoch = (value) => typeof value === 'string' && /^[a-zA-Z0-9_-]{8,120}$/.test(value);
export const getLoginSessionEpoch = () => {
  const value = strictAuthValue(LOGIN_SESSION_EPOCH_KEY);
  return validEpoch(value?.epoch) ? value.epoch : validEpoch(value) ? value : null;
};

export function readSessionSnapshot() {
  try {
    for (let attempt = 0; attempt < 3; attempt++) {
      const before = strictAuthValue(LOGIN_SESSION_EPOCH_KEY);
      const owner = normalizeStringValue(strictAuthValue('EXAM_USER_ID')) || 'guest';
      const token = normalizeStringValue(strictAuthValue('EXAM_TOKEN')) || null;
      const enabled = !!safeGetStorageSync(SESSION_ENABLED_KEY, true);
      const after = strictAuthValue(LOGIN_SESSION_EPOCH_KEY);
      if (before !== after && JSON.stringify(before) !== JSON.stringify(after)) continue;
      const epoch = validEpoch(before?.epoch) ? before.epoch : validEpoch(before) ? before : null;
      if (
        before &&
        typeof before === 'object' &&
        (before.version !== 1 || before.owner !== owner || before.proof !== sessionCredentialProof(owner, token))
      )
        continue;
      if (enabled && before && (typeof before !== 'object' || !epoch)) continue;
      if (enabled && !epoch && (token || owner !== 'guest'))
        return { status: 'changed', session: Object.freeze({ owner, epoch }), token, enabled };
      if (token && owner === 'guest') continue;
      return {
        status: enabled && token && !epoch ? 'changed' : 'current',
        session: Object.freeze({ owner, epoch }),
        token,
        enabled
      };
    }
  } catch {
    // A storage exception is not evidence of logout. Never fall back to another runtime.
  }
  return { status: 'unavailable', session: null, token: null };
}
export function captureSession() {
  const snapshot = readSessionSnapshot();
  return snapshot.status === 'current' ? snapshot.session : null;
}
export function checkSession(session) {
  const snapshot = readSessionSnapshot();
  if (snapshot.status === 'unavailable') {
    // A confirmed different/missing epoch revokes old work even while the next login is incomplete.
    // A failed read or mismatched credentials within the same epoch remains retryable.
    try {
      if (session && getLoginSessionEpoch() !== session.epoch) return 'changed';
    } catch {
      /* unavailable */
    }
    return 'unavailable';
  }
  if (snapshot.status !== 'current') return snapshot.status;
  return session && session.owner === snapshot.session.owner && session.epoch === snapshot.session.epoch
    ? 'current'
    : 'changed';
}
export function assertSession(session) {
  const status = checkSession(session);
  if (status !== 'current')
    throw Object.assign(
      new Error(status === 'unavailable' ? '登录状态暂不可读，请重试' : '登录会话已变化，请重新确认后继续'),
      {
        code: status === 'unavailable' ? 'SESSION_UNAVAILABLE' : 'CONTEXT_CHANGED'
      }
    );
  return session;
}
// Read credentials and validate the originating session together, immediately before transport.
export function sessionForRequest(session) {
  const snapshot = readSessionSnapshot();
  const status =
    snapshot.status !== 'current'
      ? snapshot.status
      : session && snapshot.session.owner === session.owner && snapshot.session.epoch === session.epoch
        ? 'current'
        : 'changed';
  if (status !== 'current')
    throw Object.assign(
      new Error(status === 'unavailable' ? '登录状态暂不可读，请重试' : '登录会话已变化，未发送旧内容'),
      {
        code: status === 'unavailable' ? 'SESSION_UNAVAILABLE' : 'CONTEXT_CHANGED'
      }
    );
  return snapshot;
}
