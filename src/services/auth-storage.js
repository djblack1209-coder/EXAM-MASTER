/**
 * 认证信息存储工具（独立模块）
 *
 * 从 storageService.js 中提取，解决 storageService ↔ lafService 循环依赖问题。
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

  const directValue = uni.getItem(key);
  if (directValue !== null) {
    return directValue;
  }

  const compatValue = uni.getItem(`${LOCAL_COMPAT_PREFIX}${key}`);
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

function safeGetStorageSync(key) {
  try {
    if (typeof uni !== 'undefined' && typeof uni.getStorageSync === 'function') {
      return uni.getStorageSync(key);
    }
  } catch (_e) {
    // ignore
  }

  try {
    return readCompatLocalStorage(key);
  } catch (_e) {
    // ignore
  }

  return '';
}

/**
 * 获取当前用户ID（统一入口）
 */
export const getUserId = () => {
  try {
    const encrypted = normalizeStringValue(safeGetStorageSync('_enc_EXAM_USER_ID'));
    if (encrypted) {
      const decrypted = deobfuscate(encrypted);
      if (decrypted !== null) return decrypted;
    }
  } catch {
    /* ignore */
  }

  const plainUserId = normalizeStringValue(safeGetStorageSync('EXAM_USER_ID'));
  return plainUserId || null;
};

/**
 * 获取当前用户Token（统一入口）
 */
export const getToken = () => {
  try {
    const encrypted = normalizeStringValue(safeGetStorageSync('_enc_EXAM_TOKEN'));
    if (encrypted) {
      const decrypted = deobfuscate(encrypted);
      if (decrypted !== null) return decrypted;
    }
  } catch {
    /* ignore */
  }

  const plainToken = normalizeStringValue(safeGetStorageSync('EXAM_TOKEN'));
  return plainToken || null;
};
