/**
 * 认证信息存储工具（独立模块）
 *
 * 从 storageService.js 中提取，解决 storageService ↔ lafService 循环依赖问题。
 * 两个模块都可以安全地导入此文件，不会产生循环引用。
 *
 * ✅ 加密/解密逻辑已提取到 utils/crypto/cipher.js 共享模块
 */

import { deobfuscate } from '../utils/crypto/cipher.js';

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
