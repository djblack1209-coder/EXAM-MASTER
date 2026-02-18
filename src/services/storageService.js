/**
 * 统一存储服务层 (Storage Service Layer)
 *
 * 目的：
 * 1. 封装 uni.getStorageSync/setStorageSync，统一存储接口
 * 2. 支持云端数据库同步（混合模式：云端优先，本地降级）
 * 3. 提供统一的错误处理和日志记录
 * 4. 支持数据加密、压缩等扩展功能
 *
 * 使用示例：
 * import { storageService } from '@/services/storageService.js'
 *
 * // 保存数据（本地）
 * storageService.save('mistakes', mistakeList)
 *
 * // 读取数据（本地）
 * const mistakes = storageService.get('mistakes', [])
 *
 * // 错题相关（云端+本地混合）
 * await storageService.saveMistake(mistakeData)
 * const mistakes = await storageService.getMistakes(1, 20)
 * await storageService.removeMistake(mistakeId)
 * await storageService.updateMistakeStatus(mistakeId, true)
 */

import { logger } from '@/utils/logger.js';
import { lafService } from './lafService.js';
import { offlineMistakeToBackend } from '@/utils/field-normalizer.js';

// ✅ B021: 敏感数据加密存储
// 需要加密存储的键名列表
const SENSITIVE_KEYS = ['EXAM_TOKEN', 'userInfo', 'EXAM_USER_ID', 'EXAM_USER_INFO'];

// ✅ P1-FIX: 混淆密钥从统一配置读取，支持环境变量覆盖
// 在小程序环境中存储已经是沙箱隔离的，此加密主要保护 H5/Web 构建
import config from '../config/index.js';
const OBFUSCATION_KEY = config.security.obfuscationKey;

// ==================== 跨平台 Base64 ====================
// 微信小程序环境没有 btoa/atob，需要自行实现
const BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';

function base64Encode(str) {
  let output = '';
  let i = 0;
  while (i < str.length) {
    const chr1 = str.charCodeAt(i++);
    const chr2 = i < str.length ? str.charCodeAt(i++) : NaN;
    const chr3 = i < str.length ? str.charCodeAt(i++) : NaN;
    const enc1 = chr1 >> 2;
    const enc2 = ((chr1 & 3) << 4) | (isNaN(chr2) ? 0 : (chr2 >> 4));
    const enc3 = isNaN(chr2) ? 64 : (((chr2 & 15) << 2) | (isNaN(chr3) ? 0 : (chr3 >> 6)));
    const enc4 = isNaN(chr3) ? 64 : (chr3 & 63);
    output += BASE64_CHARS.charAt(enc1) + BASE64_CHARS.charAt(enc2) +
              BASE64_CHARS.charAt(enc3) + BASE64_CHARS.charAt(enc4);
  }
  return output;
}

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

/**
 * ✅ S001: 升级加密算法 - 多轮 Feistel 网络 + HMAC 完整性校验
 * 替代原有的简单 XOR 混淆，提供更强的数据保护
 * 兼容微信小程序环境（无 Web Crypto API）
 *
 * 安全特性：
 * 1. 8轮 Feistel 网络加密（非线性变换，抗频率分析）
 * 2. 基于 SipHash 的完整性校验（防篡改）
 * 3. 随机 IV（相同明文产生不同密文）
 * 4. 向后兼容旧版 XOR 加密数据（自动迁移）
 */

// 加密版本标识
const CIPHER_VERSION = 2;
const FEISTEL_ROUNDS = 8;

/**
 * 生成伪随机字节（跨平台兼容）
 */
function _randomBytes(len) {
  const bytes = new Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = Math.floor(Math.random() * 256);
  }
  return bytes;
}

/**
 * SipHash-2-4 风格的哈希函数（比 FNV-1a 更强的完整性校验）
 */
function _sipHash(str, seed) {
  let v0 = 0x736f6d65 ^ (seed || 0);
  let v1 = 0x646f7261;
  let v2 = 0x6c796765;
  let v3 = 0x74656462;
  for (let i = 0; i < str.length; i++) {
    const m = str.charCodeAt(i);
    v3 ^= m;
    // 2 rounds of SipRound
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

/**
 * 派生子密钥（从主密钥 + 轮次生成不同的子密钥）
 */
function _deriveSubKey(masterKey, round) {
  let hash = 0;
  const salt = `rnd${round}:${masterKey}`;
  for (let i = 0; i < salt.length; i++) {
    hash = ((hash << 5) - hash + salt.charCodeAt(i)) | 0;
  }
  return hash >>> 0;
}

/**
 * Feistel 轮函数（非线性变换）
 */
function _feistelF(halfBlock, subKey) {
  const result = new Array(halfBlock.length);
  for (let i = 0; i < halfBlock.length; i++) {
    // 非线性变换：S-box 替换 + 密钥混合
    let v = halfBlock[i];
    v = (v + (subKey >>> (i % 4 * 8)) & 0xFF) & 0xFF;
    v = ((v * 167 + 13) & 0xFF); // 仿射变换
    v = v ^ ((subKey >>> ((i + 2) % 4 * 8)) & 0xFF);
    result[i] = v;
  }
  return result;
}

/**
 * Feistel 网络加密
 */
function _feistelEncrypt(bytes, key) {
  const mid = Math.ceil(bytes.length / 2);
  let left = bytes.slice(0, mid);
  let right = bytes.slice(mid);
  // 右半部分可能比左半部分短，补齐
  while (right.length < left.length) right.push(0);

  for (let round = 0; round < FEISTEL_ROUNDS; round++) {
    const subKey = _deriveSubKey(key, round);
    const fResult = _feistelF(right, subKey);
    const newLeft = right.slice();
    const newRight = left.map((v, i) => (v ^ fResult[i]) & 0xFF);
    left = newLeft;
    right = newRight;
  }

  return left.concat(right);
}

/**
 * Feistel 网络解密（反向执行轮次）
 */
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

/**
 * 旧版 FNV-1a 哈希（仅用于解密旧数据的兼容）
 */
function _legacyHash(str) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = (hash * 0x01000193) >>> 0;
  }
  return hash.toString(36);
}

/**
 * 旧版 XOR 解密（仅用于向后兼容，解密后自动迁移到新格式）
 */
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

/**
 * V2 加密：Feistel 网络 + 随机 IV + SipHash 完整性校验
 */
function obfuscate(data) {
  try {
    const str = typeof data === 'string' ? data : JSON.stringify(data);
    // 生成 4 字节随机 IV
    const iv = _randomBytes(4);
    // 将字符串转为字节数组
    const plainBytes = [];
    const encoded = encodeURIComponent(str);
    for (let i = 0; i < encoded.length; i++) {
      plainBytes.push(encoded.charCodeAt(i));
    }
    // IV 混入明文（每个字节与 IV 异或，增加随机性）
    for (let i = 0; i < plainBytes.length; i++) {
      plainBytes[i] = (plainBytes[i] ^ iv[i % iv.length]) & 0xFF;
    }
    // Feistel 加密
    const cipherBytes = _feistelEncrypt(plainBytes, OBFUSCATION_KEY);
    // 编码为 Base64：[version(1)][iv(4)][cipher(...)]
    const allBytes = [CIPHER_VERSION, ...iv, ...cipherBytes];
    const b64 = base64Encode(String.fromCharCode(...allBytes));
    // SipHash 完整性校验
    const hmac = _sipHash(str + OBFUSCATION_KEY, 0x5A3C);
    return `v2.${hmac}.${b64}`;
  } catch (e) {
    console.warn('[StorageService] 加密失败，使用明文存储:', e.message);
    return null;
  }
}

/**
 * 解密数据（自动识别 V1/V2 格式，V1 数据解密后自动迁移）
 */
function deobfuscate(encoded) {
  try {
    // V2 格式：v2.<hmac>.<base64>
    if (encoded.startsWith('v2.')) {
      const parts = encoded.split('.');
      if (parts.length !== 3) return null;
      const expectedHmac = parts[1];
      const b64 = parts[2];
      const raw = base64Decode(b64);
      if (raw.length < 6) return null; // version(1) + iv(4) + 至少1字节数据
      const version = raw.charCodeAt(0);
      if (version !== CIPHER_VERSION) return null;
      const iv = [raw.charCodeAt(1), raw.charCodeAt(2), raw.charCodeAt(3), raw.charCodeAt(4)];
      const cipherBytes = [];
      for (let i = 5; i < raw.length; i++) {
        cipherBytes.push(raw.charCodeAt(i) & 0xFF);
      }
      // Feistel 解密
      const plainWithIV = _feistelDecrypt(cipherBytes, OBFUSCATION_KEY);
      // 移除 IV 混入
      const plainBytes = plainWithIV.map((v, i) => (v ^ iv[i % iv.length]) & 0xFF);
      // 字节转字符串
      const str = decodeURIComponent(String.fromCharCode(...plainBytes));
      // 校验完整性
      const actualHmac = _sipHash(str + OBFUSCATION_KEY, 0x5A3C);
      if (actualHmac !== expectedHmac) {
        console.warn('[StorageService] V2 数据完整性校验失败，可能被篡改');
        return null;
      }
      try { return JSON.parse(str); } catch { return str; }
    }

    // V1 旧格式兼容（自动解密）
    return _legacyDeobfuscate(encoded);
  } catch {
    console.warn('[StorageService] 解密失败');
    return null;
  }
}

/**
 * 判断一个键是否需要加密存储
 */
function isSensitiveKey(key) {
  return SENSITIVE_KEYS.includes(key);
}

// ✅ 从独立模块导入认证函数（打破循环依赖）
import { getUserId, getToken } from './auth-storage.js';

// ==================== 防抖写入机制 ====================
// 高频写入场景（如练习状态保存）使用防抖，减少 I/O 操作
const _pendingWrites = new Map(); // key -> { value, timer }
const DEBOUNCE_DELAY = 500; // 防抖延迟 500ms

/**
 * 存储服务类
 */
class StorageService {
  /**
   * 保存数据到本地存储
   * @param {string} key - 存储键名
   * @param {any} value - 要存储的值（支持对象、数组、字符串等）
   * @param {boolean} silent - 是否静默失败（不显示错误提示）
   * @returns {boolean} 是否保存成功
   */
  save(key, value, silent = false) {
    try {
      // ✅ B021: 敏感数据加密后存储
      if (isSensitiveKey(key)) {
        const encrypted = obfuscate(value);
        if (encrypted !== null) {
          uni.setStorageSync(`_enc_${key}`, encrypted);
          // 清理旧的明文存储（迁移期间）
          try { uni.removeStorageSync(key); } catch { /* ignore */ }
          return true;
        }
      }
      uni.setStorageSync(key, value);
      return true;
    } catch (error) {
      console.error(`[StorageService] 保存失败: ${key}`, error);
      if (!silent) {
        uni.showToast({
          title: '保存失败，请检查存储空间',
          icon: 'none',
          duration: 2000
        });
      }
      return false;
    }
  }

  /**
   * 防抖保存：高频写入场景使用（如练习状态自动保存）
   * 在 DEBOUNCE_DELAY 内多次调用只会执行最后一次写入
   * @param {string} key - 存储键名
   * @param {any} value - 要存储的值
   * @param {boolean} silent - 是否静默失败
   */
  saveDebounced(key, value, silent = true) {
    const existing = _pendingWrites.get(key);
    if (existing) {
      clearTimeout(existing.timer);
    }
    const timer = setTimeout(() => {
      this.save(key, value, silent);
      _pendingWrites.delete(key);
    }, DEBOUNCE_DELAY);
    _pendingWrites.set(key, { value, timer });
  }

  /**
   * 立即刷新所有待写入的防抖数据（页面卸载时调用）
   */
  flushPendingWrites() {
    for (const [key, { value, timer }] of _pendingWrites.entries()) {
      clearTimeout(timer);
      this.save(key, value, true);
    }
    _pendingWrites.clear();
  }

  /**
   * 从本地存储读取数据
   * @param {string} key - 存储键名
   * @param {any} defaultValue - 如果不存在时返回的默认值
   * @returns {any} 存储的值或默认值
   */
  get(key, defaultValue = null) {
    try {
      // ✅ B021: 优先读取加密存储的敏感数据
      if (isSensitiveKey(key)) {
        const encrypted = uni.getStorageSync(`_enc_${key}`);
        if (encrypted && encrypted !== '') {
          const decrypted = deobfuscate(encrypted);
          if (decrypted !== null) return decrypted;
        }
        // 回退：读取旧的明文存储（兼容迁移期间）
        const plainValue = uni.getStorageSync(key);
        if (plainValue !== '' && plainValue !== null && plainValue !== undefined) {
          // 自动迁移：将明文数据加密后重新存储
          this.save(key, plainValue, true);
          return plainValue;
        }
        return defaultValue;
      }
      const value = uni.getStorageSync(key);
      // uni.getStorageSync 在 key 不存在时返回空字符串，需要判断
      if (value === '' || value === null || value === undefined) {
        return defaultValue;
      }
      return value;
    } catch (error) {
      console.error(`[StorageService] 读取失败: ${key}`, error);
      return defaultValue;
    }
  }

  /**
   * 删除指定的存储项
   * @param {string} key - 要删除的键名
   * @param {boolean} silent - 是否静默失败
   * @returns {boolean} 是否删除成功
   */
  remove(key, silent = false) {
    try {
      uni.removeStorageSync(key);
      // ✅ B021: 同时清理加密存储
      if (isSensitiveKey(key)) {
        try { uni.removeStorageSync(`_enc_${key}`); } catch { /* ignore */ }
      }
      return true;
    } catch (error) {
      console.error(`[StorageService] 删除失败: ${key}`, error);
      if (!silent) {
        uni.showToast({
          title: '删除失败',
          icon: 'none',
          duration: 2000
        });
      }
      return false;
    }
  }

  /**
   * 清空所有本地存储（谨慎使用！）
   * @param {boolean} silent - 是否静默失败
   * @returns {boolean} 是否清空成功
   */
  clear(silent = false) {
    try {
      uni.clearStorageSync();
      return true;
    } catch (error) {
      console.error('[StorageService] 清空存储失败', error);
      if (!silent) {
        uni.showToast({
          title: '清空失败',
          icon: 'none',
          duration: 2000
        });
      }
      return false;
    }
  }

  /**
   * 检查指定键是否存在
   * @param {string} key - 要检查的键名
   * @returns {boolean} 是否存在
   */
  has(key) {
    try {
      // ✅ B021: 检查加密存储
      if (isSensitiveKey(key)) {
        const encrypted = uni.getStorageSync(`_enc_${key}`);
        if (encrypted !== '' && encrypted !== null && encrypted !== undefined) return true;
      }
      const value = uni.getStorageSync(key);
      return value !== '' && value !== null && value !== undefined;
    } catch (error) {
      console.error(`[StorageService] 检查失败: ${key}`, error);
      return false;
    }
  }

  /**
   * 获取所有存储的键名（仅用于调试）
   * @returns {string[]} 所有键名数组
   */
  getAllKeys() {
    try {
      return uni.getStorageInfoSync().keys || [];
    } catch (error) {
      console.error('[StorageService] 获取所有键名失败', error);
      return [];
    }
  }

  /**
   * 获取存储信息（大小、键数量等）
   * @returns {Object} 存储信息对象
   */
  getStorageInfo() {
    try {
      return uni.getStorageInfoSync();
    } catch (error) {
      console.error('[StorageService] 获取存储信息失败', error);
      return { keys: [], currentSize: 0, limitSize: 0 };
    }
  }

  /**
   * 批量保存多个键值对
   * @param {Object} data - 键值对对象，如 { key1: value1, key2: value2 }
   * @param {boolean} silent - 是否静默失败
   * @returns {boolean} 是否全部保存成功
   */
  saveBatch(data, silent = false) {
    try {
      Object.keys(data).forEach((key) => {
        this.save(key, data[key], true); // 批量操作时静默单个失败
      });
      return true;
    } catch (error) {
      console.error('[StorageService] 批量保存失败', error);
      if (!silent) {
        uni.showToast({
          title: '批量保存失败',
          icon: 'none',
          duration: 2000
        });
      }
      return false;
    }
  }

  /**
   * 批量读取多个键的值
   * @param {string[]} keys - 要读取的键名数组
   * @returns {Object} 键值对对象，如 { key1: value1, key2: value2 }
   */
  getBatch(keys) {
    const result = {};
    keys.forEach((key) => {
      result[key] = this.get(key);
    });
    return result;
  }

  // ==================== 错题本云端同步方法 ====================

  /**
   * 同步状态常量
   */
  static SYNC_STATUS = {
    SYNCED: 'synced', // 已同步
    PENDING: 'pending', // 待同步（本地有修改未上传）
    LOCAL_ONLY: 'local_only', // 仅本地（未登录时创建）
    CONFLICT: 'conflict' // 冲突（本地和云端都有修改）
  };

  /**
   * 获取同步状态摘要
   * @returns {Object} 同步状态统计 { total, synced, pending, localOnly, conflict, lastSyncTime }
   */
  getSyncStatus() {
    try {
      const localMistakes = this.get('mistake_book', []);
      const lastSyncTime = this.get('last_sync_time', null);

      const stats = {
        total: localMistakes.length,
        synced: 0,
        pending: 0,
        localOnly: 0,
        conflict: 0,
        lastSyncTime
      };

      localMistakes.forEach((m) => {
        switch (m.sync_status) {
          case 'synced': stats.synced++; break;
          case 'pending': stats.pending++; break;
          case 'local_only': stats.localOnly++; break;
          case 'conflict': stats.conflict++; break;
          default: stats.synced++; // 无状态视为已同步
        }
      });

      return stats;
    } catch (error) {
      console.error('[StorageService] 获取同步状态失败:', error);
      return { total: 0, synced: 0, pending: 0, localOnly: 0, conflict: 0, lastSyncTime: null };
    }
  }

  /**
   * 解决同步冲突
   * 策略：
   * - 'local': 以本地数据为准，覆盖云端
   * - 'cloud': 以云端数据为准，覆盖本地
   * - 'merge': 合并（保留最新修改时间的版本）
   *
   * @param {string} mistakeId - 错题ID
   * @param {string} strategy - 冲突解决策略: 'local' | 'cloud' | 'merge'
   * @returns {Promise<Object>} 解决结果
   */
  async resolveConflict(mistakeId, strategy = 'merge') {
    const userId = getUserId();
    if (!userId) {
      return { success: false, error: '用户未登录' };
    }

    try {
      const localMistakes = this.get('mistake_book', []);
      const localMistake = localMistakes.find((m) => (m.id === mistakeId || m._id === mistakeId));

      if (!localMistake || localMistake.sync_status !== 'conflict') {
        return { success: false, error: '未找到冲突记录' };
      }

      // 获取云端版本
      let cloudMistake = null;
      try {
        const res = await lafService.request('/mistake-manager', {
          action: 'get',
          userId,
          data: { id: mistakeId }
        });
        if (res.data && !Array.isArray(res.data)) {
          cloudMistake = res.data;
        } else if (Array.isArray(res.data)) {
          cloudMistake = res.data.find((m) => m._id === mistakeId || m.id === mistakeId);
        }
      } catch (e) {
        console.warn('[StorageService] 获取云端冲突数据失败:', e);
      }

      let resolvedData = null;

      switch (strategy) {
        case 'local':
          // 以本地为准，上传到云端
          resolvedData = { ...localMistake };
          delete resolvedData.sync_status;
          delete resolvedData._conflict_cloud_data;
          try {
            await lafService.request('/mistake-manager', {
              action: 'updateStatus',
              userId,
              data: { id: mistakeId, is_mastered: localMistake.is_mastered }
            });
          } catch (e) {
            console.warn('[StorageService] 上传本地冲突数据失败:', e);
          }
          break;

        case 'cloud':
          // 以云端为准，覆盖本地
          if (cloudMistake) {
            resolvedData = { ...cloudMistake };
          } else {
            resolvedData = { ...localMistake };
            delete resolvedData._conflict_cloud_data;
          }
          break;

        case 'merge':
        default:
          // I003: 字段级合并策略 — 逐字段取最新修改
          const localTime = localMistake.last_practice_time || localMistake.updated_at || 0;
          const cloudTime = cloudMistake?.updated_at || cloudMistake?.last_review_time || 0;

          if (!cloudMistake) {
            // 云端无数据，直接用本地
            resolvedData = { ...localMistake };
            delete resolvedData._conflict_cloud_data;
          } else {
            // 字段级合并：以时间戳较新的一方为基础，合并另一方的独有字段
            const base = cloudTime > localTime ? cloudMistake : localMistake;
            const other = cloudTime > localTime ? localMistake : cloudMistake;
            resolvedData = { ...base };

            // 合并特定字段：取两边的最大值或最新值
            resolvedData.wrong_count = Math.max(
              base.wrong_count || 0, other.wrong_count || 0
            );
            // 标签合并去重
            if (other.tags?.length || base.tags?.length) {
              resolvedData.tags = [...new Set([
                ...(base.tags || []),
                ...(other.tags || [])
              ])];
            }
            // is_mastered 取最新修改方的值（已由 base 决定）
            // 笔记合并：保留较长的版本
            if ((other.note || '').length > (base.note || '').length) {
              resolvedData.note = other.note;
            }
            delete resolvedData._conflict_cloud_data;
          }

          // 上传合并结果到云端
          try {
            await lafService.request('/mistake-manager', {
              action: 'updateStatus',
              userId,
              data: { id: mistakeId, is_mastered: resolvedData.is_mastered }
            });
          } catch (e) {
            console.warn('[StorageService] 合并上传失败:', e);
          }
          break;
      }

      // 更新本地记录
      if (resolvedData) {
        resolvedData.sync_status = 'synced';
        const idx = localMistakes.findIndex((m) => (m.id === mistakeId || m._id === mistakeId));
        if (idx !== -1) {
          localMistakes[idx] = resolvedData;
          this.save('mistake_book', localMistakes, true);
        }
      }

      logger.log(`[StorageService] 冲突已解决: ${mistakeId}, 策略: ${strategy}`);
      return { success: true, strategy, data: resolvedData };
    } catch (error) {
      console.error('[StorageService] 解决冲突失败:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 自动解决所有冲突（使用merge策略）
   * @returns {Promise<Object>} 批量解决结果
   */
  async resolveAllConflicts() {
    const localMistakes = this.get('mistake_book', []);
    const conflicts = localMistakes.filter((m) => m.sync_status === 'conflict');

    if (conflicts.length === 0) {
      return { success: true, resolved: 0 };
    }

    let resolved = 0;
    let failed = 0;

    for (const conflict of conflicts) {
      const result = await this.resolveConflict(conflict.id || conflict._id, 'merge');
      if (result.success) {
        resolved++;
      } else {
        failed++;
      }
    }

    logger.log(`[StorageService] 批量解决冲突: 成功 ${resolved}, 失败 ${failed}`);
    return { success: resolved > 0, resolved, failed };
  }

  /**
   * 保存错题（使用 Laf 后端）
   * @param {Object} data - 错题数据
   * @returns {Promise<Object>} 返回保存结果
   */
  async addMistake(data) {
    const userId = getUserId();
    if (!userId) {
      console.warn('[StorageService] 用户未登录，降级到本地存储');
      return this._saveMistakeLocal(data, 'local_only');
    }

    try {
      logger.log('[StorageService] 📡 开始保存错题到云端...');
      const res = await lafService.request('/mistake-manager', {
        action: 'add',
        data,
        userId
      });

      // 统一返回格式：后端可能返回 {id: "...", ok: true} 或 {code: 0, data: {...}}
      const cloudId = res.id || res._id || res.data?.id || res.data?._id;
      const isSuccess = (res.ok === true || res.code === 0) && cloudId;

      if (isSuccess) {
        logger.log(`[StorageService] ✅ 云端保存成功 - ID: ${cloudId}`);
        // 更新本地缓存（云端保存成功后，同步更新本地）
        const localMistakes = this.get('mistake_book', []);
        const newMistake = {
          ...data,
          id: cloudId,
          _id: cloudId,
          sync_status: 'synced',
          created_at: Date.now()
        };
        localMistakes.unshift(newMistake);
        this.save('mistake_book', localMistakes, true);
        logger.log(`[StorageService] ✅ 本地缓存已同步更新`);

        return {
          success: true,
          id: cloudId,
          source: 'cloud'
        };
      } else {
        console.warn('[StorageService] ⚠️ 云端保存返回格式异常，降级到本地:', res);
        return this._saveMistakeLocal(data, 'pending');
      }
    } catch (error) {
      console.warn('[StorageService] ⚠️ 云端保存异常，降级到本地存储:', error);
      const localResult = this._saveMistakeLocal(data, 'pending');
      if (localResult.success) {
        logger.log('[StorageService] ✅ 已降级到本地保存，sync_status: pending');
      }
      return localResult;
    }
  }

  /**
   * 保存错题（兼容旧方法名）
   * @param {Object} mistakeData - 错题数据
   * @returns {Promise<Object>} 返回保存结果
   */
  async saveMistake(mistakeData) {
    return this.addMistake(mistakeData);
  }

  /**
   * 本地保存错题（内部方法）
   * @private
   */
  _saveMistakeLocal(mistakeData, syncStatus = 'pending') {
    try {
      const localMistakes = this.get('mistake_book', []);
      const newMistake = {
        ...mistakeData,
        id: `local_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
        sync_status: syncStatus,
        created_at: Date.now()
      };
      localMistakes.unshift(newMistake);
      this.save('mistake_book', localMistakes, true);

      return {
        success: true,
        id: newMistake.id,
        source: 'local',
        sync_status: syncStatus
      };
    } catch (error) {
      console.error('[StorageService] 本地保存错题失败:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 获取错题列表（使用 Laf 后端）
   * @param {number} page - 页码（从1开始，可选，用于兼容）
   * @param {number} limit - 每页数量（可选，用于兼容）
   * @param {Object} filters - 筛选条件（可选，用于兼容）
   * @returns {Promise<Array>} 返回错题列表数组
   */
  async getMistakes(page = 1, limit = 20, filters = {}) {
    const userId = getUserId();
    if (!userId) {
      console.warn('[StorageService] 用户未登录，使用本地存储');
      return this._getMistakesLocal(page, limit, filters);
    }

    try {
      logger.log(`[StorageService] 开始从云端获取错题列表 (page: ${page}, limit: ${limit})`);
      const res = await lafService.request('/mistake-manager', {
        action: 'get',
        userId
      });
      logger.log(`[StorageService] ✅ 云端获取成功，返回 ${Array.isArray(res.data) ? res.data.length : (res.data?.data?.length || res.data?.list?.length || 0)} 条记录`);

      // 返回数据数组，兼容旧代码期望的格式
      const mistakeList = res.data || [];

      // 如果返回的是对象格式，尝试提取数组
      let list = Array.isArray(mistakeList) ? mistakeList : (mistakeList.data || mistakeList.list || []);

      // 更新本地缓存（第一页时），合并本地待同步数据
      if (page === 1 && Array.isArray(list)) {
        // 获取本地待同步的错题（sync_status 为 'pending' 或 'local_only'）
        const localMistakes = this.get('mistake_book', []);
        const pendingMistakes = localMistakes.filter((m) =>
          (m.sync_status === 'pending' || m.sync_status === 'local_only') &&
          m.id && m.id.startsWith('local_')
        );

        if (pendingMistakes.length > 0) {
          // 合并云端数据和本地待同步数据（去重：如果云端已有相同题目，保留云端版本）
          const cloudIds = new Set(list.map((m) => m.id || m._id).filter(Boolean));
          const mergedList = [
            ...list, // 云端数据优先
            ...pendingMistakes.filter((m) => {
              const mId = m.id || m._id;
              // 如果本地待同步数据在云端不存在，则保留
              return mId && mId.startsWith('local_') && !cloudIds.has(mId);
            })
          ];

          // 按创建时间倒序排序
          mergedList.sort((a, b) => {
            const timeA = a.created_at || a.addTime || a.timestamp || 0;
            const timeB = b.created_at || b.addTime || b.timestamp || 0;
            return timeB - timeA;
          });

          // 使用合并后的列表进行后续处理
          list = mergedList;

          // 保存合并后的数据到本地缓存
          this.save('mistake_book', mergedList, true);
          logger.log(`[StorageService] ✅ 已合并 ${pendingMistakes.length} 条本地待同步错题到列表`);
        } else {
          // 没有待同步数据，直接保存云端数据
          this.save('mistake_book', list, true);
        }
      }

      // 应用筛选和分页（兼容旧代码）
      let filteredList = list;
      if (filters.is_mastered !== undefined) {
        filteredList = filteredList.filter((m) => m.is_mastered === filters.is_mastered);
      }

      // 分页处理
      const skip = (page - 1) * limit;
      const paginatedList = filteredList.slice(skip, skip + limit);

      // 统一返回对象格式，保持接口一致性
      return {
        list: paginatedList,
        total: filteredList.length,
        page: page,
        limit: limit,
        hasMore: skip + limit < filteredList.length,
        source: 'cloud'
      };
    } catch (error) {
      console.warn('[StorageService] Laf 获取异常，降级到本地:', error);
      return this._getMistakesLocal(page, limit, filters);
    }
  }

  /**
   * 本地获取错题列表（内部方法）
   * @private
   */
  _getMistakesLocal(page = 1, limit = 20, filters = {}) {
    try {
      const allMistakes = this.get('mistake_book', []);

      // 应用筛选条件
      let filteredMistakes = allMistakes;
      if (filters.is_mastered !== undefined) {
        filteredMistakes = filteredMistakes.filter((m) => m.is_mastered === filters.is_mastered);
      }

      // 按创建时间倒序排序
      filteredMistakes.sort((a, b) => {
        const timeA = a.created_at || a.addTime || 0;
        const timeB = b.created_at || b.addTime || 0;
        return timeB - timeA;
      });

      // 分页
      const skip = (page - 1) * limit;
      const paginatedList = filteredMistakes.slice(skip, skip + limit);

      return {
        list: paginatedList,
        total: filteredMistakes.length,
        page: page,
        limit: limit,
        hasMore: skip + limit < filteredMistakes.length,
        source: 'local'
      };
    } catch (error) {
      console.error('[StorageService] 本地获取错题失败:', error);
      return {
        list: [],
        total: 0,
        page: page,
        limit: limit,
        hasMore: false,
        source: 'local'
      };
    }
  }

  /**
   * 删除错题（使用 Laf 后端）
   * @param {string} id - 错题ID
   * @returns {Promise<Object>} 返回删除结果 { success: boolean, source: 'cloud'|'local' }
   */
  async removeMistake(id) {
    if (!id) {
      return { success: false, error: '错题ID不能为空' };
    }

    const userId = getUserId();
    if (!userId) {
      console.warn('[StorageService] 用户未登录，仅删除本地');
      return this._removeMistakeLocal(id);
    }

    // 使用 Laf 后端删除
    try {
      logger.log(`[StorageService] 开始删除错题: ${id}`);
      const res = await lafService.request('/mistake-manager', {
        action: 'remove',
        data: { id },
        userId: userId
      });

      // 后端返回格式: {deleted: 1, ok: true} 或 {deleted: 0, ok: true}
      if (res.ok === true) {
        if (res.deleted > 0) {
          // 云端删除成功（云端确实有这条记录并已删除）
          logger.log(`[StorageService] ✅ 云端删除成功: ${id} (deleted: ${res.deleted})`);
        } else {
          // 云端没有这条记录（可能是本地待同步数据），但仍认为操作成功
          logger.log(`[StorageService] ⚠️ 云端未找到记录: ${id} (可能是本地待同步数据)，仅删除本地`);
        }
        // 无论云端是否找到记录，都同步删除本地
        const localResult = this._removeMistakeLocal(id);
        if (localResult.success) {
          logger.log(`[StorageService] ✅ 本地缓存已同步删除: ${id}`);
        }
        return { success: true, source: 'cloud' };
      } else {
        // 云端删除失败，尝试本地删除
        console.warn('[StorageService] Laf 删除失败，尝试本地删除:', res.message || res);
        return this._removeMistakeLocal(id);
      }
    } catch (error) {
      // 网络错误，尝试本地删除
      console.warn('[StorageService] Laf 删除异常，尝试本地删除:', error);
      return this._removeMistakeLocal(id);
    }
  }

  /**
   * 本地删除错题（内部方法）
   * @private
   */
  _removeMistakeLocal(id) {
    try {
      const localMistakes = this.get('mistake_book', []);
      const index = localMistakes.findIndex((m) => m.id === id || m._id === id);

      if (index !== -1) {
        localMistakes.splice(index, 1);
        this.save('mistake_book', localMistakes, true);
        logger.log(`[StorageService] ✅ 本地删除成功: ${id}, 剩余 ${localMistakes.length} 条`);
        return { success: true, source: 'local' };
      } else {
        console.warn(`[StorageService] ⚠️ 本地缓存中未找到错题: ${id}`);
        return { success: false, error: '错题不存在' };
      }
    } catch (error) {
      console.error('[StorageService] 本地删除错题失败:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 更新错题掌握状态（云端+本地）
   * @param {string} id - 错题ID
   * @param {boolean} is_mastered - 是否已掌握
   * @returns {Promise<Object>} 返回更新结果 { success: boolean, source: 'cloud'|'local' }
   */
  async updateMistakeStatus(id, is_mastered) {
    if (!id) {
      console.warn('[StorageService] ⚠️ 更新错题状态失败：错题ID不能为空');
      return { success: false, error: '错题ID不能为空' };
    }

    const userId = getUserId();
    if (!userId) {
      console.warn('[StorageService] ⚠️ 用户未登录，仅更新本地状态');
      return this._updateMistakeStatusLocal(id, is_mastered);
    }

    logger.log(`[StorageService] 📡 开始更新错题状态 - ID: ${id}, is_mastered: ${is_mastered}`);

    // 优先尝试云端更新（使用 Laf 后端）
    try {
      logger.log(`[StorageService] 🌐 发送云端更新请求: /mistake-manager { action: 'updateStatus', id: ${id}, is_mastered: ${is_mastered} }`);
      const res = await lafService.request('/mistake-manager', {
        action: 'updateStatus',
        data: { id, is_mastered },
        userId: userId
      });

      logger.log(`[StorageService] 📥 云端更新响应:`, res);

      // 检查返回格式：可能是 {code: 200, ok: true, updated: 1} 或 {ok: true} 或 {code: 0, data: {...}}
      const cloudId = res.id || res._id || res.data?.id;
      const isSuccess = (res.ok === true || res.code === 200 || res.code === 0)
        && (res.updated > 0 || res.ok === true || cloudId);

      if (isSuccess) {
        logger.log(`[StorageService] ✅ 云端状态更新成功 - ID: ${id}, is_mastered: ${is_mastered}, 响应:`, res);
        // 云端更新成功，同步更新本地
        const localResult = this._updateMistakeStatusLocal(id, is_mastered);
        if (localResult.success) {
          logger.log(`[StorageService] ✅ 本地缓存已同步更新`);
        }
        return { success: true, source: 'cloud' };
      } else {
        // 云端更新失败，尝试本地更新
        console.warn(`[StorageService] ⚠️ 云端更新失败（返回格式异常），降级到本地更新 - ID: ${id}`, res);
        return this._updateMistakeStatusLocal(id, is_mastered);
      }
    } catch (error) {
      // 网络错误，尝试本地更新
      console.warn(`[StorageService] ⚠️ 云端更新异常（网络错误），降级到本地更新 - ID: ${id}`, error);
      return this._updateMistakeStatusLocal(id, is_mastered);
    }
  }

  /**
   * 本地更新错题状态（内部方法）
   * @private
   */
  _updateMistakeStatusLocal(id, is_mastered) {
    try {
      logger.log(`[StorageService] 🔄 开始本地更新错题状态 - ID: ${id}, is_mastered: ${is_mastered}`);
      const localMistakes = this.get('mistake_book', []);
      const mistake = localMistakes.find((m) => m.id === id || m._id === id);

      if (mistake) {
        const oldStatus = mistake.is_mastered;
        mistake.is_mastered = Boolean(is_mastered);
        mistake.last_practice_time = Date.now();
        this.save('mistake_book', localMistakes, true);
        logger.log(`[StorageService] ✅ 本地状态更新成功 - ID: ${id}, 状态: ${oldStatus} -> ${is_mastered}, last_practice_time: ${Date.now()}`);
        return { success: true, source: 'local' };
      } else {
        console.warn(`[StorageService] ⚠️ 本地缓存中未找到错题 - ID: ${id}`);
        return { success: false, error: '错题不存在' };
      }
    } catch (error) {
      console.error('[StorageService] ❌ 本地更新错题状态失败:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * I003: 同步本地待同步的错题到云端（优先批量同步，失败回退逐条）
   * @returns {Promise<Object>} 返回同步结果 { success: boolean, synced: number, failed: number, conflicts: number }
   */
  async syncPendingMistakes() {
    const userId = getUserId();
    if (!userId) {
      console.warn('[StorageService] 用户未登录，无法同步待同步错题');
      return { success: false, error: '用户未登录' };
    }

    try {
      const localMistakes = this.get('mistake_book', []);
      const pendingMistakes = localMistakes.filter((m) =>
        m.sync_status === 'pending' || m.sync_status === 'local_only'
      );

      if (pendingMistakes.length === 0) {
        logger.log('[StorageService] ✅ 没有待同步的错题');
        return { success: true, synced: 0, failed: 0, conflicts: 0 };
      }

      logger.log(`[StorageService] 🔄 开始同步 ${pendingMistakes.length} 条待同步错题...`);

      let synced = 0;
      let failed = 0;
      let conflicts = 0;

      // I003: 尝试批量同步（后端 batchSync action）
      const batchData = pendingMistakes.map((m) => ({
        ...offlineMistakeToBackend(m),
        _local_id: m.id || m._id // 用于回写映射
      }));

      let useBatch = true;
      try {
        const batchRes = await lafService.request('/mistake-manager', {
          action: 'batchSync',
          userId,
          data: { mistakes: batchData }
        });

        if (batchRes.code === 0 && batchRes.data?.results) {
          // 批量同步成功，逐条更新本地状态
          for (const result of batchRes.data.results) {
            const localId = result.localId || result._local_id;
            const mistake = pendingMistakes.find((m) => (m.id || m._id) === localId);
            if (!mistake) continue;

            if (result.success && result.id) {
              mistake.id = result.id;
              mistake._id = result.id;
              mistake.sync_status = 'synced';
              synced++;
            } else if (result.conflict) {
              // I003: 标记冲突，保存云端数据供后续解决
              mistake.sync_status = 'conflict';
              mistake._conflict_cloud_data = result.cloudData || null;
              conflicts++;
            } else {
              failed++;
            }
          }
        } else {
          // 批量接口不可用或返回异常，回退到逐条
          useBatch = false;
        }
      } catch (_e) {
        logger.log('[StorageService] 批量同步不可用，回退到逐条同步');
        useBatch = false;
      }

      // 回退：逐条同步（兼容不支持 batchSync 的后端版本）
      if (!useBatch) {
        for (const mistake of pendingMistakes) {
          if (mistake.sync_status === 'synced') continue; // 批量已处理的跳过
          try {
            const mistakeData = {
              question_content: mistake.question_content || mistake.question,
              options: mistake.options || [],
              user_answer: mistake.user_answer || mistake.userChoice,
              correct_answer: mistake.correct_answer || mistake.answer,
              analysis: mistake.analysis || mistake.desc || '',
              tags: mistake.tags || [],
              is_mastered: mistake.is_mastered || false,
              wrong_count: mistake.wrong_count || mistake.wrongCount || 1
            };

            const oldId = mistake.id || mistake._id;
            const res = await lafService.request('/mistake-manager', {
              action: 'add',
              data: mistakeData,
              userId
            });

            const cloudId = res.data?.id || res.data?._id || res.id || res._id;
            const isSuccess = (res.code === 0 || res.ok === true) && cloudId;

            if (isSuccess) {
              mistake.id = cloudId;
              mistake._id = cloudId;
              mistake.sync_status = 'synced';
              synced++;
              logger.log(`[StorageService] ✅ 错题同步成功: ${oldId} -> ${cloudId}`);
            } else {
              failed++;
            }
          } catch (error) {
            console.error(`[StorageService] ❌ 同步错题异常: ${mistake.id || mistake._id}`, error);
            failed++;
          }
        }
      }

      // 更新本地存储
      this.save('mistake_book', localMistakes, true);

      const result = {
        success: synced > 0,
        synced: synced,
        failed: failed,
        conflicts: conflicts
      };

      // 记录最后同步时间
      this.save('last_sync_time', Date.now(), true);

      logger.log(`[StorageService] 📊 同步完成: 成功 ${synced} 条, 失败 ${failed} 条, 冲突 ${conflicts} 条`);

      // I003: 如果有冲突，自动尝试 merge 解决
      if (conflicts > 0) {
        try {
          const conflictResult = await this.resolveAllConflicts();
          logger.log(`[StorageService] 自动解决冲突: ${conflictResult.resolved} 条`);
          result.autoResolved = conflictResult.resolved;
        } catch (e) {
          console.warn('[StorageService] 自动解决冲突失败:', e);
        }
      }

      return result;
    } catch (error) {
      console.error('[StorageService] ❌ 同步待同步错题失败:', error);
      return {
        success: false,
        synced: 0,
        failed: 0,
        error: error.message
      };
    }
  }

}

// 导出单例
export const storageService = new StorageService();

/**
 * ✅ F019: 便捷别名 - 降低从 uni.*StorageSync 迁移的成本
 * 用法：import { storage } from '@/services/storageService.js'
 *       storage.set('key', value)  // 替代 uni.setStorageSync('key', value)
 *       storage.get('key')         // 替代 uni.getStorageSync('key')
 *       storage.remove('key')      // 替代 uni.removeStorageSync('key')
 */
export const storage = {
  get: (key, defaultValue) => storageService.get(key, defaultValue),
  set: (key, value) => storageService.save(key, value, true),
  remove: (key) => storageService.remove(key, true)
};

// 导出类（如果需要创建多个实例）
export { StorageService, getUserId, getToken };

// 默认导出
export default storageService;
