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
import {
  addMistake as apiAddMistake,
  getMistakes as apiGetMistakes,
  removeMistake as apiRemoveMistake,
  batchRemoveMistakes as apiBatchRemoveMistakes,
  updateMistakeStatus as apiUpdateMistakeStatus,
  updateMistakeFields as apiUpdateMistakeFields,
  batchSyncMistakes as apiBatchSyncMistakes
} from './api/domains/practice.api.js';
import { offlineMistakeToBackend } from '@/utils/field-normalizer.js';

function createUniCompat() {
  const memoryStore = new Map();
  const keyPrefix = '__exam_storage__:';

  const readLocal = (key) => {
    try {
      if (typeof localStorage === 'undefined') return undefined;
      const raw = localStorage.getItem(`${keyPrefix}${key}`);
      if (raw === null) return undefined;
      const parsed = JSON.parse(raw);
      return Object.prototype.hasOwnProperty.call(parsed, 'value') ? parsed.value : parsed;
    } catch {
      return undefined;
    }
  };

  const writeLocal = (key, value) => {
    try {
      if (typeof localStorage === 'undefined') return true;
      localStorage.setItem(`${keyPrefix}${key}`, JSON.stringify({ value }));
      return true;
    } catch {
      return false;
    }
  };

  const removeLocal = (key) => {
    try {
      if (typeof localStorage === 'undefined') return;
      localStorage.removeItem(`${keyPrefix}${key}`);
    } catch {
      /* ignore */
    }
  };

  return {
    getStorageSync(key) {
      if (memoryStore.has(key)) return memoryStore.get(key);
      const localValue = readLocal(key);
      if (localValue !== undefined) {
        memoryStore.set(key, localValue);
        return localValue;
      }
      return '';
    },
    setStorageSync(key, value) {
      const ok = writeLocal(key, value);
      if (!ok) {
        throw new Error(`Local storage write failed for key: ${key}`);
      }
      memoryStore.set(key, value);
    },
    removeStorageSync(key) {
      memoryStore.delete(key);
      removeLocal(key);
    },
    clearStorageSync() {
      memoryStore.clear();
      try {
        if (typeof localStorage !== 'undefined') {
          const keys = [];
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith(keyPrefix)) {
              keys.push(key);
            }
          }
          keys.forEach((key) => localStorage.removeItem(key));
        }
      } catch {
        /* ignore */
      }
    },
    getStorageInfoSync() {
      const keys = new Set(Array.from(memoryStore.keys()));
      try {
        if (typeof localStorage !== 'undefined') {
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (!key || !key.startsWith(keyPrefix)) continue;
            keys.add(key.slice(keyPrefix.length));
          }
        }
      } catch {
        /* ignore */
      }
      return {
        keys: Array.from(keys),
        currentSize: keys.size,
        limitSize: 10240
      };
    },
    showToast() {
      // H5/测试环境下无 uni 时静默处理
    }
  };
}

const globalRef = typeof globalThis !== 'undefined' ? globalThis : {};
const uni = globalRef['uni'] || createUniCompat();

// ✅ B021: 敏感数据加密存储
// 需要加密存储的键名列表
const SENSITIVE_KEYS = [
  'EXAM_TOKEN',
  'userInfo',
  'EXAM_USER_ID',
  'EXAM_USER_INFO',
  'access_token',
  'refresh_token',
  'token_expire_time'
];

// ✅ 加密/解密逻辑已提取到 utils/crypto/cipher.js 共享模块
import { obfuscate, deobfuscate } from '../utils/crypto/cipher.js';

/**
 * 判断一个键是否需要加密存储
 */
function isSensitiveKey(key) {
  return SENSITIVE_KEYS.includes(key);
}

// ✅ 从独立模块导入认证函数（打破循环依赖）
import { getUserId, getToken } from './auth-storage.js';
import { toast } from '@/utils/toast.js';

// ✅ 用户隔离：全局键（不加 userId 前缀）
// 所有不在此集合中的键都会自动加 `u_${userId}_` 前缀，实现多用户数据隔离
const GLOBAL_KEYS = new Set([
  // 认证/身份 — 标识当前登录用户，必须全局
  'EXAM_TOKEN',
  'EXAM_USER_ID',
  'EXAM_USER_INFO',
  'userInfo',
  'access_token',
  'refresh_token',
  'token_expire_time',
  // 登录前状态
  'redirect_after_login',
  'wx_oauth_state',
  'qq_oauth_state',
  'qq_oauth_origin',
  // 应用级 UI/设置
  'theme_mode',
  'theme_type',
  'voice_enabled',
  // 应用级瞬态
  'runtime_errors',
  '_pendingSearch',
  '_pendingAchievements',
  'last_active_time',
  'session_start_time',
  // 通用缓存（与用户无关）
  'daily_quote_cache',
  'daily_quote_date',
  'cached_schools',
  'cached_schools_time'
]);

/**
 * 解析存储键：对用户级 key 自动加 userId 前缀
 * 全局 key 原样返回，用户级 key 返回 `u_${userId}_${key}`
 * 未登录时用户级 key 也原样返回（降级为全局，登录后迁移）
 * @param {string} key - 原始键名
 * @returns {string} 实际存储键名
 */
function resolveKey(key) {
  // 全局键 / 内部加密前缀 / 动态全局模式 → 原样返回
  if (GLOBAL_KEYS.has(key)) return key;
  if (key.startsWith('_enc_')) return key;
  if (key.startsWith('school_detail_')) return key;
  if (key.startsWith('recovery_daily_reset_')) return key;
  if (key.startsWith('recovery_monthly_reset_')) return key;

  const uid = getUserId();
  if (!uid) return key; // 未登录降级
  return `u_${uid}_${key}`;
}

// ==================== 防抖写入机制 ====================
// 高频写入场景（如练习状态保存）使用防抖，减少 I/O 操作
const _pendingWrites = new Map(); // key -> { value, timer }
const DEBOUNCE_DELAY = 500; // 防抖延迟 500ms

/**
 * 存储服务类
 */
class StorageService {
  constructor() {
    this._mistakeBookMutex = Promise.resolve();
    this._guestMistakeReadWarned = false;
  }

  async _withMistakeBookLock(task) {
    const next = this._mistakeBookMutex.then(async () => task());
    this._mistakeBookMutex = next.catch(() => undefined);
    return next;
  }

  _filterMistakeBookByIds(mistakes, ids) {
    const idSet = new Set(ids.map((id) => String(id)));
    return mistakes.filter((m) => {
      const currentId = m?.id || m?._id;
      return !idSet.has(String(currentId));
    });
  }

  _toOptionalNumber(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : undefined;
  }

  _buildMistakeCloudFields(mistake) {
    const source = mistake && typeof mistake === 'object' ? mistake : {};
    const fields = {};

    const setIfDefined = (key, value) => {
      if (value !== undefined) {
        fields[key] = value;
      }
    };

    setIfDefined('question_id', source.question_id ?? source.questionId);
    setIfDefined('question_content', source.question_content ?? source.question ?? source.title);

    if (Array.isArray(source.options)) {
      setIfDefined('options', source.options);
    }

    setIfDefined('user_answer', source.user_answer ?? source.userAnswer ?? source.userChoice);
    setIfDefined('correct_answer', source.correct_answer ?? source.correctAnswer ?? source.answer);
    setIfDefined('analysis', source.analysis ?? source.desc);
    setIfDefined('category', source.category);

    if (Array.isArray(source.tags)) {
      setIfDefined('tags', source.tags);
    }

    setIfDefined('error_type', source.error_type ?? source.errorType);
    setIfDefined('difficulty', source.difficulty);
    setIfDefined('source', source.source);

    const wrongCount = this._toOptionalNumber(source.wrong_count ?? source.wrongCount);
    if (wrongCount !== undefined) {
      setIfDefined('wrong_count', Math.max(1, Math.floor(wrongCount)));
    }

    const reviewCount = this._toOptionalNumber(source.review_count ?? source.reviewCount);
    if (reviewCount !== undefined) {
      setIfDefined('review_count', Math.max(0, Math.floor(reviewCount)));
    }

    const easeFactor = this._toOptionalNumber(source.ease_factor ?? source.easeFactor);
    if (easeFactor !== undefined) {
      setIfDefined('ease_factor', easeFactor);
    }

    const intervalDays = this._toOptionalNumber(source.interval_days ?? source.intervalDays);
    if (intervalDays !== undefined) {
      setIfDefined('interval_days', Math.max(1, Math.floor(intervalDays)));
    }

    const lastReviewTime = this._toOptionalNumber(
      source.last_review_time ?? source.lastReviewTime ?? source.last_practice_time
    );
    if (lastReviewTime !== undefined) {
      setIfDefined('last_review_time', Math.floor(lastReviewTime));
    }

    const nextReviewTime = this._toOptionalNumber(source.next_review_time ?? source.nextReviewTime);
    if (nextReviewTime !== undefined) {
      setIfDefined('next_review_time', Math.floor(nextReviewTime));
    }

    if (
      Object.prototype.hasOwnProperty.call(source, 'is_mastered') ||
      Object.prototype.hasOwnProperty.call(source, 'isMastered')
    ) {
      setIfDefined('is_mastered', Boolean(source.is_mastered ?? source.isMastered));
    }

    const notesValue = source.notes !== undefined ? source.notes : source.note;
    if (notesValue !== undefined) {
      setIfDefined('notes', notesValue);
    }

    return fields;
  }

  async _updateMistakeFieldsInCloud(userId, mistakeId, mistakeData) {
    if (!userId || !mistakeId || String(mistakeId).startsWith('local_')) {
      return false;
    }

    const fields = this._buildMistakeCloudFields(mistakeData);
    if (Object.keys(fields).length === 0) {
      return false;
    }

    try {
      const res = await apiUpdateMistakeFields(userId, mistakeId, fields);
      const resAny = /** @type {any} */ (res);
      return Boolean(resAny?.ok === true || resAny?.code === 0 || (resAny?.updated || 0) > 0);
    } catch (e) {
      logger.warn('[StorageService] 错题字段回写云端失败:', e);
      return false;
    }
  }

  /**
   * 保存数据到本地存储
   * @param {string} key - 存储键名
   * @param {any} value - 要存储的值（支持对象、数组、字符串等）
   * @param {boolean} silent - 是否静默失败（不显示错误提示）
   * @returns {boolean} 是否保存成功
   */
  save(key, value, silent = false) {
    try {
      const rk = resolveKey(key);
      // ✅ B021: 敏感数据加密后存储
      if (isSensitiveKey(key)) {
        const encrypted = obfuscate(value);
        if (encrypted !== null) {
          uni.setStorageSync(`_enc_${rk}`, encrypted);
          // 清理旧的明文存储（迁移期间）
          try {
            uni.removeStorageSync(rk);
          } catch {
            /* ignore */
          }
          return true;
        }
      }
      uni.setStorageSync(rk, value);
      return true;
    } catch (error) {
      logger.error(`[StorageService] 保存失败: ${key}`, error);
      if (!silent) {
        toast.info('保存失败，请检查存储空间');
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
    _pendingWrites.forEach(({ value, timer }, key) => {
      clearTimeout(timer);
      this.save(key, value, true);
    });
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
      const rk = resolveKey(key);
      // ✅ B021: 优先读取加密存储的敏感数据
      if (isSensitiveKey(key)) {
        const encrypted = uni.getStorageSync(`_enc_${rk}`);
        if (encrypted && encrypted !== '') {
          const decrypted = deobfuscate(encrypted);
          if (decrypted !== null) return decrypted;
        }
        // 回退：读取旧的明文存储（兼容迁移期间）
        const plainValue = uni.getStorageSync(rk);
        if (plainValue !== '' && plainValue !== null && plainValue !== undefined) {
          // 自动迁移：将明文数据加密后重新存储
          this.save(key, plainValue, true);
          return plainValue;
        }
        // 二次回退：读取无前缀的旧数据（用户隔离迁移期间）
        if (rk !== key) {
          const legacyEnc = uni.getStorageSync(`_enc_${key}`);
          if (legacyEnc && legacyEnc !== '') {
            const dec = deobfuscate(legacyEnc);
            if (dec !== null) {
              // 自动迁移到带前缀的 key
              this.save(key, dec, true);
              try {
                uni.removeStorageSync(`_enc_${key}`);
              } catch {
                /* ignore */
              }
              return dec;
            }
          }
        }
        return defaultValue;
      }
      const value = uni.getStorageSync(rk);
      // uni.getStorageSync 在 key 不存在时返回空字符串，需要判断
      if (value === '' || value === null || value === undefined) {
        // 回退：读取无前缀的旧数据（用户隔离迁移期间）
        if (rk !== key) {
          const legacyValue = uni.getStorageSync(key);
          if (legacyValue !== '' && legacyValue !== null && legacyValue !== undefined) {
            // 自动迁移到带前缀的 key
            this.save(key, legacyValue, true);
            try {
              uni.removeStorageSync(key);
            } catch {
              /* ignore */
            }
            return legacyValue;
          }
        }
        return defaultValue;
      }
      return value;
    } catch (error) {
      logger.error(`[StorageService] 读取失败: ${key}`, error);
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
      const rk = resolveKey(key);
      uni.removeStorageSync(rk);
      // ✅ B021: 同时清理加密存储
      if (isSensitiveKey(key)) {
        try {
          uni.removeStorageSync(`_enc_${rk}`);
        } catch {
          /* ignore */
        }
      }
      // 清理旧的无前缀数据（迁移期间）
      if (rk !== key) {
        try {
          uni.removeStorageSync(key);
        } catch {
          /* ignore */
        }
        if (isSensitiveKey(key)) {
          try {
            uni.removeStorageSync(`_enc_${key}`);
          } catch {
            /* ignore */
          }
        }
      }
      return true;
    } catch (error) {
      logger.error(`[StorageService] 删除失败: ${key}`, error);
      if (!silent) {
        toast.info('删除失败');
      }
      return false;
    }
  }

  /**
   * 清空本地存储（默认保留全局认证与应用级配置）
   * @param {boolean} silent - 是否静默失败
   * @param {{preserveGlobal?: boolean, preserveKeys?: string[]}} options - 清理选项
   * @returns {boolean} 是否清空成功
   */
  clear(silent = false, options = {}) {
    try {
      const preserveGlobal = options.preserveGlobal !== false;
      const preserveKeys = Array.isArray(options.preserveKeys) ? options.preserveKeys : [];

      if (!preserveGlobal && preserveKeys.length === 0) {
        uni.clearStorageSync();
        _pendingWrites.clear();
        return true;
      }

      const keep = new Set();

      if (preserveGlobal) {
        GLOBAL_KEYS.forEach((key) => {
          keep.add(key);
          keep.add(`_enc_${key}`);
        });
      }

      for (const key of preserveKeys) {
        if (typeof key !== 'string' || !key) continue;
        keep.add(key);
        keep.add(`_enc_${key}`);
      }

      const keys = uni.getStorageInfoSync().keys || [];
      for (const key of keys) {
        if (keep.has(key)) continue;
        uni.removeStorageSync(key);
      }

      _pendingWrites.clear();
      return true;
    } catch (error) {
      logger.error('[StorageService] 清空存储失败', error);
      if (!silent) {
        toast.info('清空失败');
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
      const rk = resolveKey(key);
      // ✅ B021: 检查加密存储
      if (isSensitiveKey(key)) {
        const encrypted = uni.getStorageSync(`_enc_${rk}`);
        if (encrypted !== '' && encrypted !== null && encrypted !== undefined) return true;
      }
      const value = uni.getStorageSync(rk);
      if (value !== '' && value !== null && value !== undefined) return true;
      // 回退：检查无前缀的旧数据（迁移期间）
      if (rk !== key) {
        if (isSensitiveKey(key)) {
          const legacyEnc = uni.getStorageSync(`_enc_${key}`);
          if (legacyEnc !== '' && legacyEnc !== null && legacyEnc !== undefined) return true;
        }
        const legacyValue = uni.getStorageSync(key);
        if (legacyValue !== '' && legacyValue !== null && legacyValue !== undefined) return true;
      }
      return false;
    } catch (error) {
      logger.error(`[StorageService] 检查失败: ${key}`, error);
      return false;
    }
  }

  /**
   * 登录后迁移：将无前缀的用户级旧数据迁移到 `u_${userId}_` 前缀下
   * 应在登录成功、userId 已写入后调用一次
   * @returns {number} 迁移的 key 数量
   */
  migrateUserKeys() {
    const uid = getUserId();
    if (!uid) return 0;

    let migrated = 0;
    try {
      const allKeys = uni.getStorageInfoSync().keys || [];
      for (const rawKey of allKeys) {
        // 跳过已有前缀的、全局的、加密前缀的
        if (rawKey.startsWith('u_')) continue;
        if (rawKey.startsWith('_enc_')) continue;
        if (GLOBAL_KEYS.has(rawKey)) continue;
        if (rawKey.startsWith('school_detail_')) continue;
        if (rawKey.startsWith('recovery_daily_reset_')) continue;
        if (rawKey.startsWith('recovery_monthly_reset_')) continue;

        const prefixedKey = `u_${uid}_${rawKey}`;
        // 如果带前缀的 key 已存在，不覆盖（用户可能已有新数据）
        const existing = uni.getStorageSync(prefixedKey);
        if (existing !== '' && existing !== null && existing !== undefined) continue;

        const value = uni.getStorageSync(rawKey);
        if (value === '' || value === null || value === undefined) continue;

        uni.setStorageSync(prefixedKey, value);
        try {
          uni.removeStorageSync(rawKey);
        } catch {
          /* ignore */
        }
        migrated++;
      }

      // 同样迁移 _enc_ 前缀的敏感数据
      for (const sKey of SENSITIVE_KEYS) {
        if (GLOBAL_KEYS.has(sKey)) continue;
        const oldEncKey = `_enc_${sKey}`;
        const newEncKey = `_enc_u_${uid}_${sKey}`;
        const encVal = uni.getStorageSync(oldEncKey);
        if (encVal === '' || encVal === null || encVal === undefined) continue;
        const existingEnc = uni.getStorageSync(newEncKey);
        if (existingEnc !== '' && existingEnc !== null && existingEnc !== undefined) continue;
        uni.setStorageSync(newEncKey, encVal);
        try {
          uni.removeStorageSync(oldEncKey);
        } catch {
          /* ignore */
        }
        migrated++;
      }

      if (migrated > 0) {
        logger.log(`[StorageService] 用户隔离迁移完成: ${migrated} 个 key 已迁移到 u_${uid}_ 前缀`);
      }
    } catch (error) {
      logger.error('[StorageService] 用户隔离迁移失败:', error);
    }
    return migrated;
  }

  /**
   * 登出时清理当前用户的所有隔离数据
   * 保留全局 key 和其他用户的数据
   * @param {string} [uid] - 要清理的 userId，默认当前用户
   * @returns {number} 清理的 key 数量
   */
  clearUserData(uid) {
    const userId = uid || getUserId();
    if (!userId) return 0;

    let cleared = 0;
    try {
      const prefix = `u_${userId}_`;
      const encPrefix = `_enc_u_${userId}_`;
      const allKeys = uni.getStorageInfoSync().keys || [];
      for (const key of allKeys) {
        if (key.startsWith(prefix) || key.startsWith(encPrefix)) {
          try {
            uni.removeStorageSync(key);
            cleared++;
          } catch {
            /* ignore */
          }
        }
      }
      if (cleared > 0) {
        logger.log(`[StorageService] 已清理用户 ${userId} 的 ${cleared} 个隔离 key`);
      }
    } catch (error) {
      logger.error('[StorageService] 清理用户数据失败:', error);
    }
    return cleared;
  }

  /**
   * 获取所有存储的键名（仅用于调试）
   * @returns {string[]} 所有键名数组
   */
  getAllKeys() {
    try {
      return uni.getStorageInfoSync().keys || [];
    } catch (error) {
      logger.error('[StorageService] 获取所有键名失败', error);
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
      logger.error('[StorageService] 获取存储信息失败', error);
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
      logger.error('[StorageService] 批量保存失败', error);
      if (!silent) {
        toast.info('批量保存失败');
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
          case 'synced':
            stats.synced++;
            break;
          case 'pending':
            stats.pending++;
            break;
          case 'local_only':
            stats.localOnly++;
            break;
          case 'conflict':
            stats.conflict++;
            break;
          default:
            stats.synced++; // 无状态视为已同步
        }
      });

      return stats;
    } catch (error) {
      logger.error('[StorageService] 获取同步状态失败:', error);
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
      const localMistake = localMistakes.find((m) => m.id === mistakeId || m._id === mistakeId);

      if (!localMistake || localMistake.sync_status !== 'conflict') {
        return { success: false, error: '未找到冲突记录' };
      }

      // 获取云端版本
      let cloudMistake = null;
      try {
        const res = await apiGetMistakes(userId, { id: mistakeId });
        if (res.data && !Array.isArray(res.data)) {
          cloudMistake = res.data;
        } else if (Array.isArray(res.data)) {
          cloudMistake = res.data.find((m) => m._id === mistakeId || m.id === mistakeId);
        }
      } catch (e) {
        logger.warn('[StorageService] 获取云端冲突数据失败:', e);
      }

      if (!cloudMistake && localMistake._conflict_cloud_data && typeof localMistake._conflict_cloud_data === 'object') {
        cloudMistake = localMistake._conflict_cloud_data;
      }

      let resolvedData = null;
      let cloudPersisted = false;
      const cloudTargetId = cloudMistake?._id || cloudMistake?.id || mistakeId;

      switch (strategy) {
        case 'local':
          // 以本地为准，上传到云端
          resolvedData = { ...localMistake };
          delete resolvedData.sync_status;
          delete resolvedData._conflict_cloud_data;
          cloudPersisted = await this._updateMistakeFieldsInCloud(userId, cloudTargetId, resolvedData);
          if (cloudPersisted && cloudTargetId) {
            resolvedData.id = cloudTargetId;
            resolvedData._id = cloudTargetId;
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
            resolvedData.wrong_count = Math.max(base.wrong_count || 0, other.wrong_count || 0);
            // 标签合并去重
            if (other.tags?.length || base.tags?.length) {
              resolvedData.tags = Array.from(new Set([...(base.tags || []), ...(other.tags || [])]));
            }
            // is_mastered 取最新修改方的值（已由 base 决定）
            // 笔记合并：保留较长的版本（兼容 note/notes）
            const baseNotes = (base.notes || base.note || '').toString();
            const otherNotes = (other.notes || other.note || '').toString();
            if (baseNotes || otherNotes) {
              resolvedData.notes = otherNotes.length > baseNotes.length ? otherNotes : baseNotes;
            }
            delete resolvedData.note;
            delete resolvedData._conflict_cloud_data;
          }

          // 上传合并结果到云端
          cloudPersisted = await this._updateMistakeFieldsInCloud(userId, cloudTargetId, resolvedData);
          if (cloudPersisted && cloudTargetId) {
            resolvedData.id = cloudTargetId;
            resolvedData._id = cloudTargetId;
          }
          break;
      }

      // 更新本地记录
      if (resolvedData) {
        const canMarkSynced = (strategy === 'cloud' && Boolean(cloudMistake)) || cloudPersisted;
        if (canMarkSynced) {
          resolvedData.sync_status = 'synced';
          delete resolvedData._needs_remote_merge;
          delete resolvedData._conflict_cloud_data;
        } else {
          resolvedData.sync_status = 'conflict';
          resolvedData._needs_remote_merge = true;
        }
        const idx = localMistakes.findIndex((m) => m.id === mistakeId || m._id === mistakeId);
        if (idx !== -1) {
          localMistakes[idx] = resolvedData;
          this.save('mistake_book', localMistakes, true);
        }
      }

      logger.log(`[StorageService] 冲突已解决: ${mistakeId}, 策略: ${strategy}`);
      return { success: true, strategy, data: resolvedData, cloudPersisted };
    } catch (error) {
      logger.error('[StorageService] 解决冲突失败:', error);
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
      logger.warn('[StorageService] 用户未登录，降级到本地存储');
      return this._saveMistakeLocal(data, 'local_only');
    }

    try {
      logger.log('[StorageService] 📡 开始保存错题到云端...');
      // 统一字段名：前端 question → 后端 question_content
      const normalizedData = offlineMistakeToBackend(data);
      const res = await apiAddMistake(userId, normalizedData);
      const resAny = /** @type {any} */ (res);

      // 统一返回格式：后端可能返回 {id: "...", ok: true} 或 {code: 0, data: {...}}
      const cloudId = resAny?.id || resAny?._id || resAny?.data?.id || resAny?.data?._id;
      const isSuccess = (resAny?.ok === true || resAny?.code === 0) && cloudId;

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
        logger.warn('[StorageService] ⚠️ 云端保存返回格式异常，降级到本地:', res);
        return this._saveMistakeLocal(data, 'pending');
      }
    } catch (error) {
      logger.warn('[StorageService] ⚠️ 云端保存异常，降级到本地存储:', error);
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
      logger.error('[StorageService] 本地保存错题失败:', error);
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
    return this._withMistakeBookLock(async () => {
      const userId = getUserId();
      if (!userId) {
        if (!this._guestMistakeReadWarned) {
          logger.warn('[StorageService] 用户未登录，使用本地存储');
          this._guestMistakeReadWarned = true;
        }
        return this._getMistakesLocal(page, limit, filters);
      }

      this._guestMistakeReadWarned = false;

      try {
        logger.log(`[StorageService] 开始从云端获取错题列表 (page: ${page}, limit: ${limit})`);
        const res = await apiGetMistakes(userId, {
          // ✅ P2-1: 传递分页参数给后端，避免全量拉取
          page,
          limit,
          ...(filters.is_mastered !== undefined ? { is_mastered: filters.is_mastered } : {})
        });
        logger.log(
          `[StorageService] ✅ 云端获取成功，返回 ${Array.isArray(res.data) ? res.data.length : res.data?.data?.length || res.data?.list?.length || 0} 条记录`
        );

        // 返回数据，兼容旧代码期望的格式
        const mistakeList = res.data || [];

        // 如果返回的是对象格式，尝试提取数组和分页信息
        let list = Array.isArray(mistakeList) ? mistakeList : mistakeList.data || mistakeList.list || [];
        // ✅ P2-1: 优先使用后端返回的分页元数据
        const serverTotal = mistakeList.total;
        const serverHasMore = mistakeList.hasMore;

        // 更新本地缓存（第一页时），合并本地待同步数据
        if (page === 1 && Array.isArray(list)) {
          // 获取本地待同步的错题（sync_status 为 'pending' 或 'local_only'）
          const localMistakes = this.get('mistake_book', []);
          const pendingMistakes = localMistakes.filter(
            (m) => (m.sync_status === 'pending' || m.sync_status === 'local_only') && m.id && m.id.startsWith('local_')
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

        // ✅ P2-1: 后端已做分页和筛选，直接返回结果
        return {
          list: list,
          total: serverTotal !== undefined ? serverTotal : list.length,
          page: page,
          limit: limit,
          hasMore: serverHasMore !== undefined ? serverHasMore : list.length >= limit,
          source: 'cloud'
        };
      } catch (error) {
        logger.warn('[StorageService] Laf 获取异常，降级到本地:', error);
        return this._getMistakesLocal(page, limit, filters);
      }
    });
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
      logger.error('[StorageService] 本地获取错题失败:', error);
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
      logger.warn('[StorageService] 用户未登录，仅删除本地');
      return this._removeMistakeLocal(id);
    }

    // 使用 Laf 后端删除
    try {
      logger.log(`[StorageService] 开始删除错题: ${id}`);
      const res = await apiRemoveMistake(userId, id);
      const resAny = /** @type {any} */ (res);

      // 后端返回格式: {deleted: 1, ok: true} 或 {deleted: 0, ok: true}
      if (resAny?.ok === true) {
        if ((resAny?.deleted || 0) > 0) {
          // 云端删除成功（云端确实有这条记录并已删除）
          logger.log(`[StorageService] ✅ 云端删除成功: ${id} (deleted: ${resAny?.deleted})`);
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
        logger.warn('[StorageService] Laf 删除失败，尝试本地删除:', resAny?.message || resAny);
        return this._removeMistakeLocal(id);
      }
    } catch (error) {
      // 网络错误，尝试本地删除
      logger.warn('[StorageService] Laf 删除异常，尝试本地删除:', error);
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
        logger.warn(`[StorageService] ⚠️ 本地缓存中未找到错题: ${id}`);
        return { success: false, error: '错题不存在' };
      }
    } catch (error) {
      logger.error('[StorageService] 本地删除错题失败:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 批量删除错题（P2-4: 替代逐条 removeMistake 的 N+1 模式）
   * 一次请求删除所有指定 ID 的错题，同时清理本地缓存
   * @param {string[]} ids - 错题ID数组
   * @returns {Promise<Object>} { success: boolean, deleted: number, source: 'cloud'|'local' }
   */
  async batchRemoveMistakes(ids) {
    return this._withMistakeBookLock(async () => {
      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return { success: false, error: '错题ID列表不能为空' };
      }

      const userId = getUserId();
      if (!userId) {
        logger.warn('[StorageService] 用户未登录，仅删除本地');
        const localMistakes = this.get('mistake_book', []);
        const nextMistakes = this._filterMistakeBookByIds(localMistakes, ids);
        const deleted = localMistakes.length - nextMistakes.length;
        this.save('mistake_book', nextMistakes, true);
        return { success: true, deleted, source: 'local' };
      }

      try {
        logger.log(`[StorageService] 开始批量删除 ${ids.length} 条错题`);
        const res = await apiBatchRemoveMistakes(userId, ids);
        const resAny = /** @type {any} */ (res);

        if (resAny?.ok === true) {
          logger.log(`[StorageService] ✅ 云端批量删除成功: ${resAny?.deleted}/${ids.length}`);
          // 同步清理本地缓存
          const localMistakes = this.get('mistake_book', []);
          const nextMistakes = this._filterMistakeBookByIds(localMistakes, ids);
          const deleted = localMistakes.length - nextMistakes.length;
          this.save('mistake_book', nextMistakes, true);
          return { success: true, deleted: Math.max(resAny?.deleted || 0, deleted), source: 'cloud' };
        } else {
          logger.warn('[StorageService] 云端批量删除失败:', resAny?.message);
          // 降级：仅清理本次请求的本地目标记录
          const localMistakes = this.get('mistake_book', []);
          const nextMistakes = this._filterMistakeBookByIds(localMistakes, ids);
          const deleted = localMistakes.length - nextMistakes.length;
          this.save('mistake_book', nextMistakes, true);
          return { success: true, deleted, source: 'local' };
        }
      } catch (error) {
        logger.warn('[StorageService] 云端批量删除异常，清理本地目标记录:', error);
        const localMistakes = this.get('mistake_book', []);
        const nextMistakes = this._filterMistakeBookByIds(localMistakes, ids);
        const deleted = localMistakes.length - nextMistakes.length;
        this.save('mistake_book', nextMistakes, true);
        return { success: true, deleted, source: 'local' };
      }
    });
  }

  /**
   * 更新错题掌握状态（云端+本地）
   * @param {string} id - 错题ID
   * @param {boolean} is_mastered - 是否已掌握
   * @returns {Promise<Object>} 返回更新结果 { success: boolean, source: 'cloud'|'local' }
   */
  async updateMistakeStatus(id, is_mastered) {
    if (!id) {
      logger.warn('[StorageService] ⚠️ 更新错题状态失败：错题ID不能为空');
      return { success: false, error: '错题ID不能为空' };
    }

    const userId = getUserId();
    if (!userId) {
      logger.warn('[StorageService] ⚠️ 用户未登录，仅更新本地状态');
      return this._updateMistakeStatusLocal(id, is_mastered);
    }

    logger.log(`[StorageService] 📡 开始更新错题状态 - ID: ${id}, is_mastered: ${is_mastered}`);

    // 优先尝试云端更新（使用 Laf 后端）
    try {
      logger.log(
        `[StorageService] 🌐 发送云端更新请求: /mistake-manager { action: 'updateStatus', id: ${id}, is_mastered: ${is_mastered} }`
      );
      const res = await apiUpdateMistakeStatus(userId, id, is_mastered);
      const resAny = /** @type {any} */ (res);

      logger.log(`[StorageService] 📥 云端更新响应:`, res);

      // 检查返回格式：可能是 {code: 200, ok: true, updated: 1} 或 {ok: true} 或 {code: 0, data: {...}}
      const cloudId = resAny?.id || resAny?._id || resAny?.data?.id;
      const isSuccess =
        (resAny?.ok === true || resAny?.code === 200 || resAny?.code === 0) &&
        ((resAny?.updated || 0) > 0 || resAny?.ok === true || cloudId);

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
        logger.warn(`[StorageService] ⚠️ 云端更新失败（返回格式异常），降级到本地更新 - ID: ${id}`, res);
        return this._updateMistakeStatusLocal(id, is_mastered);
      }
    } catch (error) {
      // 网络错误，尝试本地更新
      logger.warn(`[StorageService] ⚠️ 云端更新异常（网络错误），降级到本地更新 - ID: ${id}`, error);
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
        logger.log(
          `[StorageService] ✅ 本地状态更新成功 - ID: ${id}, 状态: ${oldStatus} -> ${is_mastered}, last_practice_time: ${Date.now()}`
        );
        return { success: true, source: 'local' };
      } else {
        logger.warn(`[StorageService] ⚠️ 本地缓存中未找到错题 - ID: ${id}`);
        return { success: false, error: '错题不存在' };
      }
    } catch (error) {
      logger.error('[StorageService] ❌ 本地更新错题状态失败:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * I003: 同步本地待同步的错题到云端（优先批量同步，失败回退逐条）
   * @returns {Promise<Object>} 返回同步结果 { success: boolean, synced: number, failed: number, conflicts: number }
   */
  async syncPendingMistakes() {
    return this._withMistakeBookLock(async () => {
      const userId = getUserId();
      if (!userId) {
        logger.warn('[StorageService] 用户未登录，无法同步待同步错题');
        return { success: false, error: '用户未登录' };
      }

      try {
        const localMistakes = this.get('mistake_book', []);
        const pendingMistakes = localMistakes.filter(
          (m) => m.sync_status === 'pending' || m.sync_status === 'local_only'
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
          const batchRes = await apiBatchSyncMistakes(userId, batchData);

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
              const res = await apiAddMistake(userId, mistakeData);
              const resAny = /** @type {any} */ (res);

              const cloudId = resAny?.data?.id || resAny?.data?._id || resAny?.id || resAny?._id;
              const isSuccess = (resAny?.code === 0 || resAny?.ok === true) && cloudId;

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
              logger.error(`[StorageService] ❌ 同步错题异常: ${mistake.id || mistake._id}`, error);
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
            logger.warn('[StorageService] 自动解决冲突失败:', e);
          }
        }

        return result;
      } catch (error) {
        logger.error('[StorageService] ❌ 同步待同步错题失败:', error);
        return {
          success: false,
          synced: 0,
          failed: 0,
          error: error.message
        };
      }
    });
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
