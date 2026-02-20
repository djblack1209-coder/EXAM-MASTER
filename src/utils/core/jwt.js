/**
 * JWT 工具 - 用于智谱AI API鉴权
 * 纯JS实现，无需依赖第三方库
 */

import { logger } from '../logger.js';

/**
 * Base64URL 编码（符合JWT规范）
 * @param {string} str - 要编码的字符串
 * @returns {string} Base64URL编码后的字符串
 */
function base64UrlEncode(str) {
  const bytes = stringToBytes(str);
  return base64UrlEncodeBytes(bytes);
}

/**
 * Base64URL 编码（Uint8Array）
 * @param {Uint8Array} bytes - 字节数组
 * @returns {string} Base64URL编码后的字符串
 */
function base64UrlEncodeBytes(bytes) {
  let base64 = '';
  if (typeof wx !== 'undefined' && wx.arrayBufferToBase64) {
    base64 = wx.arrayBufferToBase64(bytes.buffer);
  } else if (typeof btoa === 'function') {
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    base64 = btoa(binary);
  } else {
    throw new Error('当前环境不支持Base64编码');
  }

  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/**
 * Base64URL 解码为字符串
 * @param {string} base64Url - Base64URL字符串
 * @returns {string} 解码后的字符串
 */
function base64UrlDecodeToString(base64Url) {
  let base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  const pad = base64.length % 4;
  if (pad) base64 += '='.repeat(4 - pad);

  let bytes;
  if (typeof wx !== 'undefined' && wx.base64ToArrayBuffer) {
    bytes = new Uint8Array(wx.base64ToArrayBuffer(base64));
  } else if (typeof atob === 'function') {
    const binary = atob(base64);
    bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
  } else {
    throw new Error('当前环境不支持Base64解码');
  }

  return bytesToString(bytes);
}

/**
 * 字符串转字节数组（UTF-8）
 * @param {string} str - 字符串
 * @returns {Uint8Array} 字节数组
 */
function stringToBytes(str) {
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(str);
  }

  const bytes = [];
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if (code < 0x80) {
      bytes.push(code);
    } else if (code < 0x800) {
      bytes.push(0xc0 | (code >> 6));
      bytes.push(0x80 | (code & 0x3f));
    } else if (code >= 0xd800 && code <= 0xdbff) {
      const next = str.charCodeAt(++i);
      const combined = 0x10000 + ((code & 0x3ff) << 10) + (next & 0x3ff);
      bytes.push(0xf0 | (combined >> 18));
      bytes.push(0x80 | ((combined >> 12) & 0x3f));
      bytes.push(0x80 | ((combined >> 6) & 0x3f));
      bytes.push(0x80 | (combined & 0x3f));
    } else {
      bytes.push(0xe0 | (code >> 12));
      bytes.push(0x80 | ((code >> 6) & 0x3f));
      bytes.push(0x80 | (code & 0x3f));
    }
  }
  return new Uint8Array(bytes);
}

/**
 * 字节数组转字符串（UTF-8）
 * @param {Uint8Array} bytes - 字节数组
 * @returns {string} 字符串
 */
function bytesToString(bytes) {
  let result = '';
  for (let i = 0; i < bytes.length; i++) {
    const byte = bytes[i];
    if (byte < 0x80) {
      result += String.fromCharCode(byte);
    } else if (byte < 0xe0) {
      const byte2 = bytes[++i];
      result += String.fromCharCode(((byte & 0x1f) << 6) | (byte2 & 0x3f));
    } else if (byte < 0xf0) {
      const byte2 = bytes[++i];
      const byte3 = bytes[++i];
      result += String.fromCharCode(((byte & 0x0f) << 12) | ((byte2 & 0x3f) << 6) | (byte3 & 0x3f));
    } else {
      const byte2 = bytes[++i];
      const byte3 = bytes[++i];
      const byte4 = bytes[++i];
      let codePoint = ((byte & 0x07) << 18) | ((byte2 & 0x3f) << 12) | ((byte3 & 0x3f) << 6) | (byte4 & 0x3f);
      codePoint -= 0x10000;
      result += String.fromCharCode((codePoint >> 10) + 0xd800);
      result += String.fromCharCode((codePoint & 0x3ff) + 0xdc00);
    }
  }
  return result;
}

/**
 * SHA-256 哈希（纯JS实现）
 * @param {Uint8Array} data - 输入数据
 * @returns {Uint8Array} 哈希结果
 */
function sha256(data) {
  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98,
    0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
    0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8,
    0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
    0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819,
    0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
    0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7,
    0xc67178f2
  ];

  const rightRotate = (value, amount) => (value >>> amount) | (value << (32 - amount));

  const bytes = Array.from(data);
  const bitLen = bytes.length * 8;
  bytes.push(0x80);
  while (bytes.length % 64 !== 56) bytes.push(0);

  const high = Math.floor(bitLen / 0x100000000);
  const low = bitLen >>> 0;
  bytes.push((high >>> 24) & 0xff, (high >>> 16) & 0xff, (high >>> 8) & 0xff, high & 0xff);
  bytes.push((low >>> 24) & 0xff, (low >>> 16) & 0xff, (low >>> 8) & 0xff, low & 0xff);

  let h0 = 0x6a09e667;
  let h1 = 0xbb67ae85;
  let h2 = 0x3c6ef372;
  let h3 = 0xa54ff53a;
  let h4 = 0x510e527f;
  let h5 = 0x9b05688c;
  let h6 = 0x1f83d9ab;
  let h7 = 0x5be0cd19;

  for (let i = 0; i < bytes.length; i += 64) {
    const w = new Array(64);
    for (let j = 0; j < 16; j++) {
      const index = i + j * 4;
      w[j] = (bytes[index] << 24) | (bytes[index + 1] << 16) | (bytes[index + 2] << 8) | bytes[index + 3];
    }
    for (let j = 16; j < 64; j++) {
      const s0 = rightRotate(w[j - 15], 7) ^ rightRotate(w[j - 15], 18) ^ (w[j - 15] >>> 3);
      const s1 = rightRotate(w[j - 2], 17) ^ rightRotate(w[j - 2], 19) ^ (w[j - 2] >>> 10);
      w[j] = (w[j - 16] + s0 + w[j - 7] + s1) >>> 0;
    }

    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    let f = h5;
    let g = h6;
    let h = h7;

    for (let j = 0; j < 64; j++) {
      const S1 = rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + K[j] + w[j]) >>> 0;
      const S0 = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
    h5 = (h5 + f) >>> 0;
    h6 = (h6 + g) >>> 0;
    h7 = (h7 + h) >>> 0;
  }

  const hash = new Uint8Array(32);
  const words = [h0, h1, h2, h3, h4, h5, h6, h7];
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    hash[i * 4] = (word >>> 24) & 0xff;
    hash[i * 4 + 1] = (word >>> 16) & 0xff;
    hash[i * 4 + 2] = (word >>> 8) & 0xff;
    hash[i * 4 + 3] = word & 0xff;
  }
  return hash;
}

/**
 * 字节数组拼接
 * @param {Uint8Array} a - 第一个数组
 * @param {Uint8Array} b - 第二个数组
 * @returns {Uint8Array} 拼接结果
 */
function concatBytes(a, b) {
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

/**
 * HMAC-SHA256 签名（纯JS实现）
 * @param {string} message - 要签名的消息
 * @param {string} secret - 密钥
 * @returns {string} Base64URL编码的签名
 */
async function hmacSHA256(message, secret) {
  const blockSize = 64;
  let key = stringToBytes(secret);
  if (key.length > blockSize) {
    key = sha256(key);
  }

  const paddedKey = new Uint8Array(blockSize);
  paddedKey.set(key);

  const oKeyPad = new Uint8Array(blockSize);
  const iKeyPad = new Uint8Array(blockSize);
  for (let i = 0; i < blockSize; i++) {
    oKeyPad[i] = paddedKey[i] ^ 0x5c;
    iKeyPad[i] = paddedKey[i] ^ 0x36;
  }

  const messageBytes = stringToBytes(message);
  const innerHash = sha256(concatBytes(iKeyPad, messageBytes));
  const finalHash = sha256(concatBytes(oKeyPad, innerHash));

  return base64UrlEncodeBytes(finalHash);
}

/**
 * 生成智谱AI JWT Token
 * @param {string} apiKey - 智谱AI的API Key，格式为 "id.secret"
 * @returns {Promise<string>} JWT Token（Bearer Token）
 */
export async function generateToken(apiKey) {
  try {
    // 解析API Key（只按第一个小数点拆分）
    const dotIndex = typeof apiKey === 'string' ? apiKey.indexOf('.') : -1;
    const id = dotIndex > 0 ? apiKey.slice(0, dotIndex) : '';
    const secret = dotIndex > 0 ? apiKey.slice(dotIndex + 1) : '';

    if (!id || !secret) {
      throw new Error('API Key格式错误，应为 "id.secret" 格式');
    }

    // 1. 构建JWT Header
    const header = {
      alg: 'HS256',
      sign_type: 'SIGN'
    };

    // 2. 构建JWT Payload
    const timestamp = Math.floor(Date.now() / 1000);
    const payload = {
      api_key: id,
      exp: timestamp + 3600, // 1小时后过期（秒）
      timestamp: timestamp
    };

    // 3. Base64URL编码Header和Payload
    const encodedHeader = base64UrlEncode(JSON.stringify(header));
    const encodedPayload = base64UrlEncode(JSON.stringify(payload));

    // 4. 生成签名
    const signatureInput = `${encodedHeader}.${encodedPayload}`;
    const signature = await hmacSHA256(signatureInput, secret);

    // 5. 组合成完整的JWT
    const jwt = `${encodedHeader}.${encodedPayload}.${signature}`;

    return jwt;
  } catch (error) {
    logger.error('生成JWT Token失败:', error);
    throw error;
  }
}

/**
 * 验证Token是否过期
 * @param {string} token - JWT Token
 * @returns {boolean} 是否过期
 */
export function isTokenExpired(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return true;

    const payload = JSON.parse(base64UrlDecodeToString(parts[1]));

    return Math.floor(Date.now() / 1000) >= payload.exp;
  } catch (_error) {
    return true;
  }
}

export default {
  generateToken,
  isTokenExpired
};
