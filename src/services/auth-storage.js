/**
 * 认证信息存储工具（独立模块）
 *
 * 从 storageService.js 中提取，解决 storageService ↔ lafService 循环依赖问题。
 * 两个模块都可以安全地导入此文件，不会产生循环引用。
 *
 * ✅ 支持 V1 (XOR) 和 V2 (Feistel) 两种加密格式的解密
 */

// ==================== 跨平台 Base64 ====================
const BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';

function base64Decode(input) {
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

const OBFUSCATION_KEY = 'ExM@st3r_2026';
const CIPHER_VERSION = 2;
const FEISTEL_ROUNDS = 8;

// ==================== V2 Feistel 解密支持 ====================

function _sipHash(str, seed) {
  let v0 = 0x736f6d65 ^ (seed || 0);
  let v1 = 0x646f7261;
  let v2 = 0x6c796765;
  let v3 = 0x74656462;
  for (let i = 0; i < str.length; i++) {
    const m = str.charCodeAt(i);
    v3 ^= m;
    for (let r = 0; r < 2; r++) {
      v0 = (v0 + v1) >>> 0; v1 = ((v1 << 13) | (v1 >>> 19)) ^ v0;
      v0 = ((v0 << 16) | (v0 >>> 16)); v2 = (v2 + v3) >>> 0;
      v3 = ((v3 << 16) | (v3 >>> 16)) ^ v2; v0 = (v0 + v3) >>> 0;
      v3 = ((v3 << 21) | (v3 >>> 11)) ^ v0; v2 = (v2 + v1) >>> 0;
      v1 = ((v1 << 17) | (v1 >>> 15)) ^ v2; v2 = ((v2 << 16) | (v2 >>> 16));
    }
    v0 ^= m;
  }
  v2 ^= 0xff;
  for (let r = 0; r < 4; r++) {
    v0 = (v0 + v1) >>> 0; v1 = ((v1 << 13) | (v1 >>> 19)) ^ v0;
    v0 = ((v0 << 16) | (v0 >>> 16)); v2 = (v2 + v3) >>> 0;
    v3 = ((v3 << 16) | (v3 >>> 16)) ^ v2; v0 = (v0 + v3) >>> 0;
    v3 = ((v3 << 21) | (v3 >>> 11)) ^ v0; v2 = (v2 + v1) >>> 0;
    v1 = ((v1 << 17) | (v1 >>> 15)) ^ v2; v2 = ((v2 << 16) | (v2 >>> 16));
  }
  return ((v0 ^ v1 ^ v2 ^ v3) >>> 0).toString(36);
}

function _deriveSubKey(masterKey, round) {
  let hash = 0;
  const salt = `rnd${round}:${masterKey}`;
  for (let i = 0; i < salt.length; i++) {
    hash = ((hash << 5) - hash + salt.charCodeAt(i)) | 0;
  }
  return hash >>> 0;
}

function _feistelF(halfBlock, subKey) {
  const result = new Array(halfBlock.length);
  for (let i = 0; i < halfBlock.length; i++) {
    let v = halfBlock[i];
    v = (v + ((subKey >>> ((i % 4) * 8)) & 0xFF)) & 0xFF;
    v = ((v * 167 + 13) & 0xFF);
    v = v ^ ((subKey >>> (((i + 2) % 4) * 8)) & 0xFF);
    result[i] = v;
  }
  return result;
}

function _feistelDecrypt(bytes, key) {
  const mid = Math.ceil(bytes.length / 2);
  let left = bytes.slice(0, mid);
  let right = bytes.slice(mid);

  for (let round = FEISTEL_ROUNDS - 1; round >= 0; round--) {
    const subKey = _deriveSubKey(key, round);
    const fResult = _feistelF(left, subKey);
    const newRight = left.slice();
    const newLeft = right.map((v, i) => (v ^ fResult[i]) & 0xFF);
    left = newLeft;
    right = newRight;
  }

  return left.concat(right);
}

// ==================== V1 旧版 XOR 解密 ====================

function _legacyHash(str) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = (hash * 0x01000193) >>> 0;
  }
  return hash.toString(36);
}

function _legacyDeobfuscate(encoded) {
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
      str += String.fromCharCode(
        result.charCodeAt(i) ^ OBFUSCATION_KEY.charCodeAt(i % OBFUSCATION_KEY.length)
      );
    }
    if (expectedHash !== null) {
      const actualHash = _legacyHash(str + OBFUSCATION_KEY);
      if (actualHash !== expectedHash) return null;
    }
    try { return JSON.parse(str); } catch { return str; }
  } catch { return null; }
}

// ==================== 统一解密入口 ====================

/**
 * 解密数据（自动识别 V1/V2 格式）
 */
function deobfuscate(encoded) {
  try {
    // V2 格式：v2.<hmac>.<base64>
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
        cipherBytes.push(raw.charCodeAt(i) & 0xFF);
      }
      const plainWithIV = _feistelDecrypt(cipherBytes, OBFUSCATION_KEY);
      const plainBytes = plainWithIV.map((v, i) => (v ^ iv[i % iv.length]) & 0xFF);
      const str = decodeURIComponent(String.fromCharCode(...plainBytes));
      const actualHmac = _sipHash(str + OBFUSCATION_KEY, 0x5A3C);
      if (actualHmac !== expectedHmac) {
        console.warn('[AuthStorage] V2 数据完整性校验失败');
        return null;
      }
      try { return JSON.parse(str); } catch { return str; }
    }

    // V1 旧格式兼容
    return _legacyDeobfuscate(encoded);
  } catch {
    console.warn('[AuthStorage] 解密失败');
    return null;
  }
}

/**
 * 获取当前用户ID（统一入口）
 */
export const getUserId = () => {
  try {
    const encrypted = uni.getStorageSync('_enc_EXAM_USER_ID');
    if (encrypted && encrypted !== '') {
      const decrypted = deobfuscate(encrypted);
      if (decrypted !== null) return decrypted;
    }
  } catch { /* ignore */ }
  return uni.getStorageSync('EXAM_USER_ID') || null;
};

/**
 * 获取当前用户Token（统一入口）
 */
export const getToken = () => {
  try {
    const encrypted = uni.getStorageSync('_enc_EXAM_TOKEN');
    if (encrypted && encrypted !== '') {
      const decrypted = deobfuscate(encrypted);
      if (decrypted !== null) return decrypted;
    }
  } catch { /* ignore */ }
  return uni.getStorageSync('EXAM_TOKEN') || null;
};
