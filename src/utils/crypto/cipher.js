/**
 * 共享加密/解密工具模块
 *
 * 从 storageService.js 和 auth-storage.js 提取的公共加密逻辑，
 * 消除两个模块之间 ~170 行的重复代码。
 *
 * 两个模块都可以安全导入此文件，不会产生循环引用。
 *
 * 支持：
 * - V2: Feistel 网络 + 随机 IV + SipHash 完整性校验
 * - V1: 旧版 XOR 混淆（向后兼容，仅解密）
 *
 * @module utils/crypto/cipher
 */

import config from '../../config/index.js';
import { logger } from '../logger.js';

const OBFUSCATION_KEY = config.security.obfuscationKey;
const CIPHER_VERSION = 2;
const FEISTEL_ROUNDS = 8;

// C-05 FIX: 生产环境空密钥必须硬失败，防止零保护上线
if (!OBFUSCATION_KEY) {
  const isProduction = typeof import.meta !== 'undefined' && import.meta.env?.VITE_USER_NODE_ENV === 'production';
  if (isProduction) {
    throw new Error(
      '[Cipher] FATAL: VITE_OBFUSCATION_KEY 未配置，生产环境禁止以空密钥运行。请在 .env.production 中设置该变量。'
    );
  }
  logger.warn('[Cipher] ⚠️ VITE_OBFUSCATION_KEY 未配置，本地存储加密已禁用。请在 .env 文件中设置该变量。');
}

// ==================== 跨平台 Base64 ====================
// 微信小程序环境没有 btoa/atob，需要自行实现
const BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';

export function base64Encode(str) {
  let output = '';
  let i = 0;
  while (i < str.length) {
    const chr1 = str.charCodeAt(i++);
    const chr2 = i < str.length ? str.charCodeAt(i++) : NaN;
    const chr3 = i < str.length ? str.charCodeAt(i++) : NaN;
    const enc1 = chr1 >> 2;
    const enc2 = ((chr1 & 3) << 4) | (isNaN(chr2) ? 0 : chr2 >> 4);
    const enc3 = isNaN(chr2) ? 64 : ((chr2 & 15) << 2) | (isNaN(chr3) ? 0 : chr3 >> 6);
    const enc4 = isNaN(chr3) ? 64 : chr3 & 63;
    output +=
      BASE64_CHARS.charAt(enc1) + BASE64_CHARS.charAt(enc2) + BASE64_CHARS.charAt(enc3) + BASE64_CHARS.charAt(enc4);
  }
  return output;
}

export function base64Decode(input) {
  let output = '';
  let i = 0;
  const str = input.replace(/[^A-Za-z0-9+/=]/g, '');
  while (i < str.length) {
    const enc1 = BASE64_CHARS.indexOf(str.charAt(i++));
    const enc2 = BASE64_CHARS.indexOf(str.charAt(i++));
    const enc3 = BASE64_CHARS.indexOf(str.charAt(i++));
    const enc4 = BASE64_CHARS.indexOf(str.charAt(i++));
    const chr1 = (enc1 << 2) | (enc2 >> 4);
    output += String.fromCharCode(chr1);
    if (enc3 !== 64) {
      const chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
      output += String.fromCharCode(chr2);
    }
    if (enc4 !== 64) {
      const chr3 = ((enc3 & 3) << 6) | enc4;
      output += String.fromCharCode(chr3);
    }
  }
  return output;
}

// ==================== SipHash ====================

export function sipHash(str, seed) {
  let v0 = 0x736f6d65 ^ (seed || 0);
  let v1 = 0x646f7261;
  let v2 = 0x6c796765;
  let v3 = 0x74656462;
  for (let i = 0; i < str.length; i++) {
    const m = str.charCodeAt(i);
    v3 ^= m;
    for (let r = 0; r < 2; r++) {
      v0 = (v0 + v1) >>> 0;
      v1 = ((v1 << 13) | (v1 >>> 19)) ^ v0;
      v0 = (v0 << 16) | (v0 >>> 16);
      v2 = (v2 + v3) >>> 0;
      v3 = ((v3 << 16) | (v3 >>> 16)) ^ v2;
      v0 = (v0 + v3) >>> 0;
      v3 = ((v3 << 21) | (v3 >>> 11)) ^ v0;
      v2 = (v2 + v1) >>> 0;
      v1 = ((v1 << 17) | (v1 >>> 15)) ^ v2;
      v2 = (v2 << 16) | (v2 >>> 16);
    }
    v0 ^= m;
  }
  v2 ^= 0xff;
  for (let r = 0; r < 4; r++) {
    v0 = (v0 + v1) >>> 0;
    v1 = ((v1 << 13) | (v1 >>> 19)) ^ v0;
    v0 = (v0 << 16) | (v0 >>> 16);
    v2 = (v2 + v3) >>> 0;
    v3 = ((v3 << 16) | (v3 >>> 16)) ^ v2;
    v0 = (v0 + v3) >>> 0;
    v3 = ((v3 << 21) | (v3 >>> 11)) ^ v0;
    v2 = (v2 + v1) >>> 0;
    v1 = ((v1 << 17) | (v1 >>> 15)) ^ v2;
    v2 = (v2 << 16) | (v2 >>> 16);
  }
  return ((v0 ^ v1 ^ v2 ^ v3) >>> 0).toString(36);
}

// ==================== Feistel 网络 ====================

function deriveSubKey(masterKey, round) {
  let hash = 0;
  const salt = `rnd${round}:${masterKey}`;
  for (let i = 0; i < salt.length; i++) {
    hash = ((hash << 5) - hash + salt.charCodeAt(i)) | 0;
  }
  return hash >>> 0;
}

function feistelF(halfBlock, subKey) {
  const result = new Array(halfBlock.length);
  for (let i = 0; i < halfBlock.length; i++) {
    let v = halfBlock[i];
    v = (v + ((subKey >>> ((i % 4) * 8)) & 0xff)) & 0xff;
    v = (v * 167 + 13) & 0xff;
    v = v ^ ((subKey >>> (((i + 2) % 4) * 8)) & 0xff);
    result[i] = v;
  }
  return result;
}

export function feistelEncrypt(bytes, key) {
  const mid = Math.ceil(bytes.length / 2);
  let left = bytes.slice(0, mid);
  let right = bytes.slice(mid);
  while (right.length < left.length) right.push(0);

  for (let round = 0; round < FEISTEL_ROUNDS; round++) {
    const subKey = deriveSubKey(key, round);
    const fResult = feistelF(right, subKey);
    const newLeft = right.slice();
    const newRight = left.map((v, i) => (v ^ fResult[i]) & 0xff);
    left = newLeft;
    right = newRight;
  }

  return left.concat(right);
}

export function feistelDecrypt(bytes, key) {
  const mid = Math.ceil(bytes.length / 2);
  let left = bytes.slice(0, mid);
  let right = bytes.slice(mid);

  for (let round = FEISTEL_ROUNDS - 1; round >= 0; round--) {
    const subKey = deriveSubKey(key, round);
    const fResult = feistelF(left, subKey);
    const newRight = left.slice();
    const newLeft = right.map((v, i) => (v ^ fResult[i]) & 0xff);
    left = newLeft;
    right = newRight;
  }

  return left.concat(right);
}

// ==================== 旧版 V1 XOR 解密（向后兼容） ====================

function legacyHash(str) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = (hash * 0x01000193) >>> 0;
  }
  return hash.toString(36);
}

function legacyDeobfuscate(encoded) {
  try {
    let payload = encoded;
    let expectedHash = null;
    const dotIdx = encoded.indexOf('.');
    if (dotIdx > 0 && dotIdx < 12) {
      expectedHash = encoded.substring(0, dotIdx);
      payload = encoded.substring(dotIdx + 1);
    }
    const result = decodeURIComponent(base64Decode(payload));
    let str = '';
    for (let i = 0; i < result.length; i++) {
      str += String.fromCharCode(result.charCodeAt(i) ^ OBFUSCATION_KEY.charCodeAt(i % OBFUSCATION_KEY.length));
    }
    if (expectedHash !== null) {
      const actualHash = legacyHash(str + OBFUSCATION_KEY);
      if (actualHash !== expectedHash) return null;
    }
    try {
      return JSON.parse(str);
    } catch {
      return str;
    }
  } catch {
    return null;
  }
}

// ==================== 随机字节生成 ====================

/**
 * 生成随机字节数组
 * 优先使用 crypto.getRandomValues（CSPRNG），不可用时降级为 Math.random
 * 微信小程序环境下 globalThis.crypto 可能不存在
 */
function randomBytes(len) {
  // 尝试使用 CSPRNG
  try {
    const _crypto = globalThis.crypto || globalThis.msCrypto;
    if (_crypto && _crypto.getRandomValues) {
      const arr = new Uint8Array(len);
      _crypto.getRandomValues(arr);
      return Array.from(arr);
    }
  } catch (_e) {
    /* 环境不支持，降级 */
  }

  // 降级：基于时间戳 + 计数器的混合随机（比纯 Math.random 更好）
  const bytes = new Array(len);
  const seed = Date.now() ^ ((Math.random() * 0xffffffff) >>> 0);
  for (let i = 0; i < len; i++) {
    bytes[i] = (Math.floor(Math.random() * 256) ^ ((seed >>> ((i % 4) * 8)) & 0xff)) & 0xff;
  }
  return bytes;
}

// ==================== 高层 API ====================

/**
 * V2 加密：Feistel 网络 + 随机 IV + SipHash 完整性校验
 */
export function obfuscate(data) {
  try {
    const str = typeof data === 'string' ? data : JSON.stringify(data);
    const iv = randomBytes(4);
    const plainBytes = [];
    const encoded = encodeURIComponent(str);
    for (let i = 0; i < encoded.length; i++) {
      plainBytes.push(encoded.charCodeAt(i));
    }
    for (let i = 0; i < plainBytes.length; i++) {
      plainBytes[i] = (plainBytes[i] ^ iv[i % iv.length]) & 0xff;
    }
    const cipherBytes = feistelEncrypt(plainBytes, OBFUSCATION_KEY);
    const allBytes = [CIPHER_VERSION, ...iv, ...cipherBytes];
    const b64 = base64Encode(String.fromCharCode(...allBytes));
    const hmac = sipHash(str + OBFUSCATION_KEY, 0x5a3c);
    return `v2.${hmac}.${b64}`;
  } catch (e) {
    logger.warn('[Cipher] 加密失败，使用明文存储:', e.message);
    return null;
  }
}

/**
 * 解密数据（自动识别 V1/V2 格式）
 */
export function deobfuscate(encoded) {
  try {
    if (typeof encoded === 'string' && encoded.startsWith('v2.')) {
      const parts = encoded.split('.');
      if (parts.length !== 3) return null;
      const expectedHmac = parts[1];
      const b64 = parts[2];
      const raw = base64Decode(b64);
      if (raw.length < 6) return null;
      const version = raw.charCodeAt(0);
      if (version !== CIPHER_VERSION) return null;
      const iv = [raw.charCodeAt(1), raw.charCodeAt(2), raw.charCodeAt(3), raw.charCodeAt(4)];
      const cipherBytes = [];
      for (let i = 5; i < raw.length; i++) {
        cipherBytes.push(raw.charCodeAt(i) & 0xff);
      }
      const plainWithIV = feistelDecrypt(cipherBytes, OBFUSCATION_KEY);
      const plainBytes = plainWithIV.map((v, i) => (v ^ iv[i % iv.length]) & 0xff);
      const str = decodeURIComponent(String.fromCharCode(...plainBytes));
      const actualHmac = sipHash(str + OBFUSCATION_KEY, 0x5a3c);
      if (actualHmac !== expectedHmac) {
        logger.warn('[Cipher] V2 数据完整性校验失败');
        return null;
      }
      try {
        return JSON.parse(str);
      } catch {
        return str;
      }
    }
    return legacyDeobfuscate(encoded);
  } catch {
    logger.warn('[Cipher] 解密失败');
    return null;
  }
}

/** 获取混淆密钥（供需要直接使用的模块） */
export function getObfuscationKey() {
  return OBFUSCATION_KEY;
}
