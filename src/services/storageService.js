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

import { supportsIdentityWrites, browserUpgradeRequired } from './identity-context.js';
import { logger } from '@/utils/logger.js';
import { readPersistent, requirePersistent } from './persistence-read.js';
import { readLocalHistory } from './learning/history-storage.js';
import {
  addMistake as apiAddMistake,
  getMistakes as apiGetMistakes,
  removeMistake as apiRemoveMistake,
  batchRemoveMistakes as apiBatchRemoveMistakes,
  updateMistakeFields as apiUpdateMistakeFields,
  batchSyncMistakes as apiBatchSyncMistakes
} from './api/domains/practice.api.js';
import { offlineMistakeToBackend } from '@/utils/field-normalizer.js';
import {
  QUIZ_REVIEW_HANDOFF_KEY,
  createQuizReviewHandoff,
  readQuizReviewHandoff,
  selectQuizQuestionsById
} from './quiz-session-contract.js';
import {
  captureQuizOriginal,
  quizOriginalIdentity
} from '../../laf-backend/functions/_shared/learning-quiz-original.js';

const LOCAL_COMPAT_PREFIX = '__exam_storage__:';
const IDENTITY_MIGRATION_PREFIX = '__exam_identity_migration_v1:';

// Storage events preserve each writer's order. Bracket only format changes, without identity values.
// A real logout outside the bracket still revokes even if login has already been restored.
function migrateIdentityKeys(keys, write) {
  if (!keys.length || typeof localStorage === 'undefined') return write();
  const marker = `${IDENTITY_MIGRATION_PREFIX}${globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2)}`;
  localStorage.setItem(marker, JSON.stringify(keys));
  try {
    return write();
  } finally {
    localStorage.removeItem(marker);
  }
}

function createUniCompat() {
  const memoryStore = new Map();
  const keyPrefix = LOCAL_COMPAT_PREFIX;

  const readLocal = (key, throwOnError = false) => {
    try {
      if (typeof localStorage === 'undefined') return undefined;
      // Match auth-storage's precedence for legacy browser identities.
      if (isIdentityStorageKey(key)) {
        const direct = localStorage.getItem(key);
        if (direct !== null) return direct;
      }
      const raw = localStorage.getItem(`${keyPrefix}${key}`);
      if (raw === null) return undefined;
      const parsed = JSON.parse(raw);
      return Object.prototype.hasOwnProperty.call(parsed, 'value') ? parsed.value : parsed;
    } catch (error) {
      if (throwOnError) throw error;
      return undefined;
    }
  };

  const writeLocal = (key, value) => {
    try {
      if (typeof localStorage === 'undefined') return true;
      const source = isIdentityStorageKey(key) ? localStorage.getItem(key) : null;
      const migrating = source !== null;
      migrateIdentityKeys(migrating ? [key] : [], () => {
        const serialized = JSON.stringify({ value });
        localStorage.setItem(`${keyPrefix}${key}`, serialized);
        if (localStorage.getItem(`${keyPrefix}${key}`) !== serialized) throw new Error('兼容存储未确认，旧副本保留');
        if (migrating) {
          if (localStorage.getItem(key) !== source) {
            if (localStorage.getItem(`${keyPrefix}${key}`) === serialized)
              localStorage.removeItem(`${keyPrefix}${key}`);
            throw new Error('迁移源已变化，未采用旧副本');
          }
          localStorage.removeItem(key);
        }
      });
      return true;
    } catch {
      return false;
    }
  };

  const removeLocal = (key) => {
    try {
      if (typeof localStorage === 'undefined') return;
      localStorage.removeItem(`${keyPrefix}${key}`);
      if (isIdentityStorageKey(key)) localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  };

  return {
    getStorageSyncStrict(key) {
      if (typeof localStorage === 'undefined') return memoryStore.get(key) ?? '';
      const current = readLocal(key, true);
      if (current === undefined) memoryStore.delete(key);
      else memoryStore.set(key, current);
      return current === undefined ? '' : current;
    },
    getStorageSync(key) {
      // Identity, learning roots and revocation markers must observe other windows.
      if (
        typeof localStorage !== 'undefined' &&
        (isIdentityStorageKey(key) ||
          key === IDENTITY_GENERATION_KEY ||
          key === LOGIN_ATTEMPT_KEY ||
          key === SESSION_REVOCATION_KEY ||
          key === SESSION_ENABLED_KEY ||
          /(?:^|_)conversation_learning_v1(?:_|$)/.test(key))
      ) {
        const current = readLocal(key);
        if (current === undefined) memoryStore.delete(key);
        else memoryStore.set(key, current);
        return current === undefined ? '' : current;
      }
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
            if (key && (key.startsWith(keyPrefix) || isIdentityStorageKey(key))) {
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
            if (key?.startsWith(keyPrefix)) keys.add(key.slice(keyPrefix.length));
            else if (isIdentityStorageKey(key)) keys.add(key);
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
const uniCompat = createUniCompat();

function getRuntimeUni() {
  // uni 编译器会重写 wx.getStorageSync 静态访问；H5 的微信 JS-SDK 并非存储运行时。
  // 按完整接口检查候选，使用动态属性以免把导入的函数误当作 SDK 能力。
  const supportsStorage = (candidate) =>
    candidate &&
    ['getStorageSync', 'setStorageSync', 'removeStorageSync'].every(
      (method) => typeof Reflect.get(candidate, method) === 'function'
    );
  const runtimeUni = globalRef['uni'];
  if (supportsStorage(runtimeUni)) {
    return runtimeUni;
  }

  const runtimeWx = globalRef['wx'];
  if (supportsStorage(runtimeWx)) {
    return runtimeWx;
  }

  if (typeof wx !== 'undefined' && supportsStorage(wx)) {
    return wx;
  }

  return uniCompat;
}

const uni = new Proxy(
  {},
  {
    get(_target, prop) {
      const runtimeUni = getRuntimeUni();
      const value = runtimeUni[prop];
      return typeof value === 'function' ? value.bind(runtimeUni) : value;
    },
    set(_target, prop, value) {
      getRuntimeUni()[prop] = value;
      return true;
    }
  }
);

// ✅ B021: 敏感数据加密存储
// 需要加密存储的键名列表
const SENSITIVE_KEYS = [
  'EXAM_TOKEN',
  'EXAM_SESSION_EPOCH',
  'userInfo',
  'EXAM_USER_ID',
  'EXAM_USER_INFO',
  'access_token',
  'refresh_token',
  'token_expire_time'
];

function identityStorageKey(key) {
  if (typeof key !== 'string') return '';
  const unprefixed = key.startsWith(LOCAL_COMPAT_PREFIX) ? key.slice(LOCAL_COMPAT_PREFIX.length) : key;
  return unprefixed.startsWith('_enc_') ? unprefixed.slice(5) : unprefixed;
}
function isIdentityStorageKey(key) {
  return SENSITIVE_KEYS.includes(identityStorageKey(key));
}
function identityWasRemoved(event) {
  if (event.oldValue === null) return false;
  if (event.newValue === null || event.newValue === '') return true;
  try {
    let value = JSON.parse(event.newValue);
    if (value && typeof value === 'object') value = 'value' in value ? value.value : value.data;
    return value === null || value === '';
  } catch {
    return false;
  }
}
function removeLoginEpoch(expectedGeneration = readIdentityGeneration()) {
  // Invalidate both queued commits and responses that have not reached storage yet.
  const revocation = newIdentityId();
  uni.setStorageSync(SESSION_REVOCATION_KEY, revocation);
  if (readIdentityGeneration() !== expectedGeneration) return false;
  uni.setStorageSync(LOGIN_ATTEMPT_KEY, revocation);
  if (readIdentityGeneration() !== expectedGeneration) return false;
  uni.removeStorageSync(LOGIN_SESSION_EPOCH_KEY);
  uni.removeStorageSync(`_enc_${LOGIN_SESSION_EPOCH_KEY}`);
}

const newIdentityId = () =>
  globalThis.crypto?.randomUUID?.() || `session_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
const guestWrites = new Map();
const loginGuestSources = new Map();
const identityListeners = new Set();
let identityWriteDepth = 0;
let pendingIdentityChange;
function notifyIdentityChange(change) {
  if (identityWriteDepth) {
    if (pendingIdentityChange?.type !== 'logout') pendingIdentityChange = change;
    return;
  }
  for (const listener of identityListeners) {
    try {
      listener(change);
    } catch {
      // A subscriber must never turn a successful identity write into a failure.
      logger.warn('[StorageService] 身份变化订阅处理失败');
    }
  }
}

// ✅ 加密/解密逻辑已提取到 utils/crypto/cipher.js 共享模块
import { obfuscate, deobfuscate } from '../utils/crypto/cipher.js';

/**
 * 判断一个键是否需要加密存储
 */
function isSensitiveKey(key) {
  return SENSITIVE_KEYS.includes(key);
}

// ✅ 从独立模块导入认证函数（打破循环依赖）
import {
  getUserId,
  getToken,
  LOGIN_SESSION_EPOCH_KEY,
  SESSION_ENABLED_KEY,
  LOGIN_ATTEMPT_KEY,
  SESSION_REVOCATION_KEY,
  IDENTITY_GENERATION_KEY,
  readIdentityGeneration,
  captureSession,
  checkSession,
  assertSession,
  readSessionSnapshot,
  sessionCredentialProof,
  readStorageStrict,
  sessionUnavailable,
  isSessionUnavailable
} from './auth-storage.js';
import { toast } from '@/utils/toast.js';

const IDENTITY_CONTROL_KEYS = new Set([
  IDENTITY_GENERATION_KEY,
  SESSION_ENABLED_KEY,
  SESSION_REVOCATION_KEY,
  LOGIN_ATTEMPT_KEY
]);

// ✅ 用户隔离：全局键（不加 userId 前缀）
// 所有不在此集合中的键都会自动加 `u_${userId}_` 前缀，实现多用户数据隔离
const GLOBAL_KEYS = new Set([
  // 认证/身份 — 标识当前登录用户，必须全局
  'EXAM_TOKEN',
  'EXAM_SESSION_EPOCH',
  'EXAM_SESSION_ENABLED',
  'EXAM_LOGIN_ATTEMPT',
  'EXAM_SESSION_REVOCATION',
  'EXAM_IDENTITY_GENERATION',
  'EXAM_USER_ID',
  'EXAM_USER_INFO',
  'userInfo',
  'access_token',
  'refresh_token',
  'token_expire_time',
  // 登录前状态
  'redirect_after_login',
  'wx_oauth_state',
  // 应用级 UI/设置
  'theme_mode',
  'theme_type',
  'voice_enabled',
  'onboarding_completed',
  'exam_type',
  'exam_profile',
  'daily_goal',
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
  'cached_schools_time',
  // 只兼容保留旧交接；新练习使用私有、带账户和原件的 quiz_review_handoff_v1。
  'smart_review_ids'
]);

const UNSCOPED_KEY_PREFIXES = ['_enc_', 'school_detail_', 'recovery_daily_reset_', 'recovery_monthly_reset_'];

function isUnscopedKey(key) {
  return GLOBAL_KEYS.has(key) || UNSCOPED_KEY_PREFIXES.some((prefix) => key.startsWith(prefix));
}

function withIdentityLock(write) {
  if (!supportsIdentityWrites()) throw browserUpgradeRequired();
  const locks = globalThis.navigator?.locks;
  return locks?.request ? locks.request('exam-master:login-session-v1', { mode: 'exclusive' }, write) : write();
}
function advanceIdentityGeneration(expected) {
  if (readIdentityGeneration() !== expected) return null;
  const next = expected + 1;
  uni.setStorageSync(IDENTITY_GENERATION_KEY, next);
  return next;
}
function commitIdentityRecord(record, expectedGeneration) {
  if (readIdentityGeneration() !== expectedGeneration) return false;
  record.generation = expectedGeneration + 1;
  const encrypted = obfuscate(record);
  uni.setStorageSync(`_enc_${LOGIN_SESSION_EPOCH_KEY}`, encrypted);
  if (readIdentityGeneration() !== expectedGeneration) return false;
  uni.setStorageSync(SESSION_REVOCATION_KEY, record.revocation);
  uni.setStorageSync(SESSION_ENABLED_KEY, true);
  uni.setStorageSync(IDENTITY_GENERATION_KEY, record.generation);
  return (
    readIdentityGeneration() === record.generation &&
    uni.getStorageSync(`_enc_${LOGIN_SESSION_EPOCH_KEY}`) === encrypted
  );
}
function identitySnapshotMatches(origin) {
  const now = readSessionSnapshot();
  return (
    origin?.status === 'current' &&
    now.status === 'current' &&
    origin.session.owner === now.session.owner &&
    origin.session.epoch === now.session.epoch &&
    origin.token === now.token
  );
}

function migratePlainSensitiveKey(key) {
  const generation = readIdentityGeneration();
  const origin = readSessionSnapshot();
  const write = () => {
    if (readIdentityGeneration() !== generation || !identitySnapshotMatches(origin)) return false;
    try {
      const plain = readStorageStrict(getRuntimeUni(), key);
      if (plain === '' || plain === null || plain === undefined) return false;
      return migrateIdentityKeys([key, `${LOCAL_COMPAT_PREFIX}${key}`], () => {
        const existing = readStorageStrict(getRuntimeUni(), `_enc_${key}`);
        if (!identitySnapshotMatches(origin)) return false;
        if (!existing) uni.setStorageSync(`_enc_${key}`, obfuscate(plain));
        if (JSON.stringify(deobfuscate(uni.getStorageSync(`_enc_${key}`))) !== JSON.stringify(plain)) return false;
        if (!identitySnapshotMatches(origin)) return false;
        if (origin.record) {
          if (!commitIdentityRecord({ ...origin.record }, generation)) return false;
        } else if (advanceIdentityGeneration(generation) === null) return false;
        uni.removeStorageSync(key);
        return true;
      });
    } catch {
      return false;
    }
  };
  const result = withIdentityLock(write);
  if (result?.catch) result.catch(() => false);
  return result;
}

/**
 * 解析存储键：对用户级 key 自动加 userId 前缀
 * 全局 key 原样返回，用户级 key 返回 `u_${userId}_${key}`
 * 未登录时用户级 key 也原样返回（降级为全局，登录后迁移）
 * @param {string} key - 原始键名
 * @returns {string} 实际存储键名
 */
function resolveKey(key, session) {
  // 全局键 / 内部加密前缀 / 动态全局模式 → 原样返回
  if (isUnscopedKey(key)) return key;

  const uid = session ? (session.owner === 'guest' ? null : session.owner) : getUserId();
  if (!uid) return key; // 未登录降级
  return `u_${uid}_${key}`;
}

// ==================== 防抖写入机制 ====================
// 高频写入场景（如练习状态保存）使用防抖，减少 I/O 操作
const _pendingWrites = new Map(); // key -> { value, timer }
const _unreadBases = new Set();
const storageBinding = (key, session) => JSON.stringify([key, session?.owner, session?.epoch]);
const _pendingUpdates = new Map(); // [key, owner, epoch] -> ordered read/modify/write operations
const DEBOUNCE_DELAY = 500; // 防抖延迟 500ms
const isOwnedLearningKey = (key) => key === 'conversation_learning_v1' || key.startsWith('conversation_learning_v1_');
const PRIVATE_QUIZ_KEYS = new Set([
  'v30_bank',
  'v30_user_answers',
  'v30_bank_backup',
  'v30_bank_backup_before_clear',
  'loaded_flashcard_banks',
  'temp_practice_question',
  'temp_practice_questions',
  'temp_review_questions',
  'quiz_review_handoff_v1',
  'legacy_review_handoff_v1',
  'question_favorites',
  'favorite_folders',
  'favorite_settings',
  'EXAM_QUIZ_PROGRESS',
  'EXAM_QUIZ_PROGRESS_TIME',
  'EXAM_STUDY_PROGRESS',
  'studyProgress',
  'question_timer_settings',
  'question_time_records'
]);
const isDurableLearningKey = (key) =>
  isOwnedLearningKey(key) ||
  key.startsWith('fsrs_card_') ||
  [
    'mistake_book',
    'studyProgress',
    'EXAM_STUDY_PROGRESS',
    'study_engine_state_v1',
    'imported_files',
    'imported_files_backup',
    'fsrs_user_params',
    'v30_bank',
    'v30_bank_backup',
    'v30_bank_backup_before_clear',
    'v30_user_answers',
    'question_favorites',
    'favorite_folders',
    'favorite_settings',
    'EXAM_QUIZ_PROGRESS',
    'EXAM_QUIZ_PROGRESS_TIME',
    'question_timer_settings',
    'question_time_records'
  ].includes(key);

function clearPendingWrites() {
  _pendingWrites.forEach(({ timer }) => {
    clearTimeout(timer);
  });
  _pendingWrites.clear();
}

/**
 * 存储服务类
 */
class StorageService {
  constructor() {
    this._mistakeBookMutex = Promise.resolve();
    this._guestMistakeReadWarned = false;
  }

  captureSession() {
    return captureSession();
  }
  checkSession(session) {
    return checkSession(session);
  }

  getSessionEpoch({ migrateLegacy = true } = {}) {
    const snapshot = readSessionSnapshot();
    if (snapshot.status === 'unavailable') return null;
    if (snapshot.status === 'changed') {
      // The device has already upgraded. A missing epoch is final, even after remount.
      this._finishRevocation();
      return null;
    }
    if (snapshot.session.owner === 'guest') return null;
    if (!migrateLegacy || !snapshot.token) return snapshot.session.epoch;
    if (snapshot.enabled) return snapshot.session.epoch;
    // Only the never-enabled legacy format may be upgraded, without changing its epoch.
    return this._newSessionEpoch(snapshot.session.epoch || undefined, { ...snapshot.session, token: snapshot.token });
  }

  _finishRevocation() {
    if (!supportsIdentityWrites()) return;
    try {
      const result = this._clearRevokedCredentials(undefined, true);
      return result?.catch ? result.catch(() => false) : result;
    } catch {
      return false;
    }
  }

  _clearRevokedCredentials(session, onlyRevoked = false, generation = readIdentityGeneration()) {
    const write = () => {
      if (readIdentityGeneration() !== generation) return false;
      if (session && checkSession(session) === 'changed') return false;
      if (onlyRevoked && readSessionSnapshot().status !== 'changed') return false;
      const next = advanceIdentityGeneration(generation);
      if (next === null) return false;
      identityWriteDepth++;
      try {
        removeLoginEpoch(next);
        for (const key of [
          'EXAM_USER_ID',
          'EXAM_TOKEN',
          'userInfo',
          'EXAM_USER_INFO',
          'access_token',
          'refresh_token',
          'token_expire_time'
        ]) {
          if (readIdentityGeneration() !== next) return false;
          uni.removeStorageSync(key);
          uni.removeStorageSync(`_enc_${key}`);
        }
        clearPendingWrites();
        return true;
      } finally {
        identityWriteDepth--;
        if (!identityWriteDepth) {
          pendingIdentityChange = undefined;
          notifyIdentityChange({ type: 'logout' });
        }
      }
    };
    return withIdentityLock(write);
  }

  _newSessionEpoch(existing, expected) {
    const generation = readIdentityGeneration();
    const origin = readSessionSnapshot();
    const write = () => {
      if (
        !identitySnapshotMatches(origin) ||
        (expected &&
          (origin.session.owner !== expected.owner ||
            origin.session.epoch !== expected.epoch ||
            origin.token !== expected.token))
      )
        return null;
      const { owner } = origin.session,
        token = origin.token;
      if (!token || owner === 'guest') return null;
      const epoch = existing || newIdentityId();
      const record = {
        version: 1,
        epoch,
        migratedFrom: origin.session.epoch,
        owner,
        token,
        userInfo: this.get('userInfo', null, { migrateLegacy: false }),
        proof: sessionCredentialProof(owner, token),
        revocation: uni.getStorageSync(SESSION_REVOCATION_KEY) || null
      };
      if (!identitySnapshotMatches(origin)) return null;
      if (!record.revocation) {
        record.revocation = newIdentityId();
      }
      if (!commitIdentityRecord(record, generation)) return null;
      uni.setStorageSync(SESSION_ENABLED_KEY, true);
      notifyIdentityChange({ type: 'migration' });
      return epoch;
    };
    const result = withIdentityLock(write);
    return result;
  }

  beginLoginAttempt() {
    if (!supportsIdentityWrites()) throw browserUpgradeRequired();
    const generation = readIdentityGeneration();
    const snapshot = readSessionSnapshot();
    if (snapshot.status === 'unavailable') throw sessionUnavailable();
    const revocation = uni.getStorageSync(SESSION_REVOCATION_KEY) || null;
    const guestSources = snapshot.session.owner === 'guest' ? new Map(guestWrites) : new Map();
    return withIdentityLock(() => {
      if (readIdentityGeneration() !== generation) throw new Error('登录尝试已失效，请重试');
      let next;
      try {
        if (snapshot.record) {
          const record = { ...snapshot.record };
          if (!commitIdentityRecord(record, generation)) throw new Error('登录尝试已失效，请重试');
          next = record.generation;
        } else next = advanceIdentityGeneration(generation);
      } catch (failure) {
        notifyIdentityChange();
        throw new Error('登录状态未保存，请重新登录', { cause: failure });
      }
      if (next === null) throw new Error('登录尝试已失效，请重试');
      const attempt = Object.freeze({ id: newIdentityId(), generation: next, revocation, guestSources });
      uni.setStorageSync(LOGIN_ATTEMPT_KEY, attempt.id);
      return attempt;
    });
  }

  isLoginAttemptCurrent(attempt) {
    try {
      return (
        supportsIdentityWrites() &&
        !!attempt &&
        readIdentityGeneration() === attempt.generation &&
        uni.getStorageSync(LOGIN_ATTEMPT_KEY) === attempt.id &&
        (uni.getStorageSync(SESSION_REVOCATION_KEY) || null) === attempt.revocation
      );
    } catch {
      return false;
    }
  }

  saveLoginSession({ userId, token, userInfo }, attempt = this.beginLoginAttempt()) {
    if (typeof userId !== 'string' || !userId.trim() || typeof token !== 'string' || !token.trim())
      throw new Error('登录结果不完整，请重新登录');
    userInfo = userInfo === undefined ? null : JSON.parse(JSON.stringify(userInfo));
    if (attempt?.then)
      return attempt.then((registered) => this.saveLoginSession({ userId, token, userInfo }, registered));
    return withIdentityLock(() => {
      if (!this.isLoginAttemptCurrent(attempt)) throw new Error('登录尝试已失效，请重试');
      const previous = readSessionSnapshot();
      const previousInfo = previous.record?.userInfo ?? this.get('userInfo', null, { migrateLegacy: false });
      const aliases = new Map(
        ['EXAM_USER_ID', 'userInfo', 'EXAM_TOKEN'].flatMap((key) =>
          [key, `_enc_${key}`].map((name) => [name, uni.getStorageSync(name)])
        )
      );
      let ownedGeneration = attempt.generation;
      let committed = false;
      const current = () => readIdentityGeneration() === ownedGeneration;
      identityWriteDepth++;
      try {
        if (!current()) throw new Error('登录尝试已失效，请重试');
        const revocation = newIdentityId();
        const record = {
          version: 1,
          epoch: newIdentityId(),
          owner: userId,
          token,
          userInfo,
          proof: sessionCredentialProof(userId, token),
          revocation
        };
        if (!commitIdentityRecord(record, ownedGeneration)) throw new Error('登录尝试已失效，请重试');
        ownedGeneration = record.generation;
        committed = true;
        for (const key of ['access_token', 'refresh_token', 'token_expire_time']) {
          if (!current()) throw new Error('登录尝试已失效，请重试');
          uni.removeStorageSync(key);
          uni.removeStorageSync(`_enc_${key}`);
        }
        for (const [key, value] of [
          ['EXAM_USER_ID', userId],
          ['userInfo', userInfo],
          ['EXAM_TOKEN', token]
        ]) {
          if (!current() || !this._saveValue(key, value, true)) throw new Error('登录状态未保存');
        }
        loginGuestSources.clear();
        loginGuestSources.set(record.epoch, attempt.guestSources);
        guestWrites.clear();
        return Object.freeze({ owner: userId, epoch: record.epoch, proof: record.proof });
      } catch (failure) {
        // Rollback is another generation-checked mutation, never restoration over a winner.
        if (committed && current()) {
          const rollback = advanceIdentityGeneration(ownedGeneration);
          if (rollback !== null) {
            if (previous.token && previous.session.owner !== 'guest') {
              const revocation = previous.record?.revocation || newIdentityId();
              uni.setStorageSync(SESSION_REVOCATION_KEY, revocation);
              const record = previous.record || {
                version: 1,
                owner: previous.session.owner,
                epoch: previous.session.epoch || newIdentityId(),
                token: previous.token,
                userInfo: previousInfo,
                proof: previous.session.proof,
                ...(previous.session.epoch ? {} : { migratedFrom: null })
              };
              uni.setStorageSync(
                `_enc_${LOGIN_SESSION_EPOCH_KEY}`,
                obfuscate({ ...record, revocation, generation: rollback })
              );
            } else removeLoginEpoch(rollback);
            for (const [name, value] of aliases) {
              if (readIdentityGeneration() !== rollback) break;
              if (value === '' || value === undefined || value === null) uni.removeStorageSync(name);
              else uni.setStorageSync(name, value);
            }
          }
        }
        throw new Error('登录状态未保存，请重新登录', { cause: failure });
      } finally {
        identityWriteDepth--;
        if (!identityWriteDepth) {
          pendingIdentityChange = undefined;
          notifyIdentityChange();
        }
      }
    });
  }

  /** Subscribe without exposing identity values; dispose with the consumer's scope. */
  onIdentityChange(listener, eventBus = uni) {
    identityListeners.add(listener);
    const authEvents = ['user:logout', 'loginStatusChanged', 'auth:userdata', 'auth:restore'];
    const changed = (change) => {
      if (identityListeners.has(listener)) listener(change);
    };
    const authListeners = authEvents.map((event) => [
      event,
      () => {
        // Logout notifications only trigger a reread; the owning transaction already revoked.

        changed(event === 'user:logout' ? { type: 'logout' } : undefined);
      }
    ]);
    for (const [event, handler] of authListeners) eventBus.$on?.(event, handler);
    const migrations = new Map();
    const storageChanged = (event) => {
      if (event.storageArea && event.storageArea !== window.localStorage) return;
      if (event.key?.startsWith(IDENTITY_MIGRATION_PREFIX)) {
        if (event.newValue === null) migrations.delete(event.key);
        else {
          try {
            const keys = JSON.parse(event.newValue);
            if (Array.isArray(keys) && keys.length <= 4 && keys.every(isIdentityStorageKey))
              migrations.set(event.key, new Set(keys));
          } catch {
            /* Invalid markers cannot suppress revocation. */
          }
        }
        return;
      }
      if (event.key === null) {
        migrations.clear();
        changed({ type: 'logout' });
      } else if (isIdentityStorageKey(event.key)) {
        const removed = identityWasRemoved(event);
        if (removed) {
          for (const keys of migrations.values()) {
            if (keys.delete(event.key)) return;
          }
        }
        changed(removed ? { type: 'logout' } : undefined);
      }
    };
    if (typeof window !== 'undefined') window.addEventListener('storage', storageChanged);
    return () => {
      identityListeners.delete(listener);
      for (const [event, handler] of authListeners) eventBus.$off?.(event, handler);
      if (typeof window !== 'undefined') window.removeEventListener('storage', storageChanged);
    };
  }

  prepareQuizReview({ ids, expectedOwner, paperId = '' } = {}) {
    const session = captureSession(),
      owner = session?.owner === 'guest' ? '' : session?.owner;
    const current = () => checkSession(session) === 'current';
    if (expectedOwner !== owner) return { success: false, code: 'CONTEXT_CHANGED' };
    try {
      const bank = this.get('v30_bank', [], { migrateLegacy: false, throwOnError: true });
      const selected = selectQuizQuestionsById(bank, ids);
      const handoff = createQuizReviewHandoff(selected, owner, paperId);
      if (!handoff) return { success: false, code: 'ORIGINAL_UNAVAILABLE' };
      if (!current()) return { success: false, code: 'CONTEXT_CHANGED' };
      if (this.save(QUIZ_REVIEW_HANDOFF_KEY, handoff, true, session) !== true)
        return { success: false, code: 'SAVE_FAILED' };
      if (!current()) return { success: false, code: 'CONTEXT_CHANGED' };
      const saved = this.get(QUIZ_REVIEW_HANDOFF_KEY, null, { migrateLegacy: false, throwOnError: true });
      if (!current()) return { success: false, code: 'CONTEXT_CHANGED' };
      if (
        !readQuizReviewHandoff(saved, handoff.id, owner, paperId) ||
        quizOriginalIdentity(saved) !== quizOriginalIdentity(handoff)
      )
        return { success: false, code: 'SAVE_UNCONFIRMED' };
      const query =
        `mode=smart_review&reviewId=${encodeURIComponent(handoff.id)}` +
        (paperId ? `&paperId=${encodeURIComponent(paperId)}` : '');
      return { success: true, id: handoff.id, url: `/pages/practice-sub/do-quiz?${query}` };
    } catch (_error) {
      return { success: false, code: 'STORAGE_UNAVAILABLE' };
    }
  }

  _mistakeContext(session = captureSession()) {
    const current = () => {
      const status = checkSession(session);
      if (status === 'unavailable') throw sessionUnavailable();
      return status === 'current';
    };
    current.session = session;
    return current;
  }

  _mistakeContextChanged() {
    return { success: false, code: 'CONTEXT_CHANGED', error: '账户或登录状态已变化，请回到原账户核对结果' };
  }

  _mistakeRequestCancelled(response) {
    for (let depth = 0, failure = response; depth < 4 && failure; depth++, failure = failure.error) {
      if (isSessionUnavailable(failure)) throw sessionUnavailable();
      if (['account_changed', 'cancelled'].includes(failure.errorType)) return true;
    }
    return false;
  }

  async _withMistakeBookLock(task, session = captureSession()) {
    const current = this._mistakeContext(session);
    let reportUnavailable;
    const unavailable = new Promise((_resolve, reject) => {
      reportUnavailable = reject;
    });
    const next = this._mistakeBookMutex.then(async () => {
      // Keep the original queue slot while waiting; later tasks cannot overtake it.
      for (;;) {
        try {
          if (!current()) return this._mistakeContextChanged();
          this._mistakeBookRows();
          break;
        } catch (error) {
          if (!isSessionUnavailable(error)) throw error;
          reportUnavailable(error);
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }
      // Only preflight is retried: a started remote task is never automatically replayed.
      return task(current);
    });
    this._mistakeBookMutex = next.catch(() => undefined);
    return Promise.race([next, unavailable]);
  }

  _mistakeBookRows() {
    const rows = this.get('mistake_book', [], { migrateLegacy: false });
    if (!Array.isArray(rows)) throw new Error('历史记录无法读取，请保留原件后恢复');
    return JSON.parse(JSON.stringify(rows));
  }

  _mistakeSaveFailed(extra = {}) {
    return { success: false, code: 'STORAGE_FAILED', error: '本机记录未保存，原记录保留，请核对原账户', ...extra };
  }

  _sameMistakeOriginal(left, right) {
    const original = (row) => {
      const identified = { ...row, id: row.question_id ?? row.questionId ?? 'legacy-import' };
      return {
        captured: captureQuizOriginal(identified),
        current: captureQuizOriginal({ ...identified, quizOriginal: undefined })
      };
    };
    return (
      quizOriginalIdentity(original(left)) === quizOriginalIdentity(original(right)) &&
      (left.user_answer ?? left.userAnswer ?? left.userChoice ?? '') ===
        (right.user_answer ?? right.userAnswer ?? right.userChoice ?? '')
    );
  }

  _filterMistakeBookByIds(mistakes, ids) {
    const idSet = new Set(ids.map((id) => String(id)));
    return mistakes.filter((m) => {
      const currentId = m?.id ?? m?._id;
      return !idSet.has(String(currentId));
    });
  }

  _buildMistakeCloudFields(mistake) {
    const fields = {};
    if (Array.isArray(mistake?.tags)) fields.tags = [...mistake.tags];
    const notes = mistake?.notes !== undefined ? mistake.notes : mistake?.note;
    if (notes !== undefined) fields.notes = notes;
    return fields;
  }

  async _updateMistakeFieldsInCloud(userId, mistakeId, mistakeData, current) {
    if (!userId || !mistakeId || String(mistakeId).startsWith('local_')) {
      return { confirmed: false };
    }

    const fields = this._buildMistakeCloudFields(mistakeData);
    if (Object.keys(fields).length === 0) {
      return { confirmed: true, skipped: true };
    }

    try {
      const res = await apiUpdateMistakeFields(userId, mistakeId, fields, { session: current.session });
      const resAny = /** @type {any} */ (res);
      return {
        confirmed: resAny?.success !== false && Boolean(resAny?.ok === true || resAny?.code === 0),
        cancelled: this._mistakeRequestCancelled(res)
      };
    } catch (e) {
      logger.warn('[StorageService] 错题字段回写云端失败:', e);
      return { confirmed: false, cancelled: this._mistakeRequestCancelled(e) };
    }
  }

  /**
   * 保存数据到本地存储
   * @param {string} key - 存储键名
   * @param {any} value - 要存储的值（支持对象、数组、字符串等）
   * @param {boolean} silent - 是否静默失败（不显示错误提示）
   * @returns {boolean} 是否保存成功
   */
  save(key, value, silent = false, session, { mergeProfile = false } = {}) {
    if (IDENTITY_CONTROL_KEYS.has(identityStorageKey(key))) return false;
    if (isIdentityStorageKey(key) && !isSensitiveKey(key)) return false;
    if (!isSensitiveKey(key)) return this._saveValue(key, value, silent, session);
    const generation = readIdentityGeneration();
    const origin = readSessionSnapshot();
    session = session === undefined ? origin.session : session;
    mergeProfile = mergeProfile && ['userInfo', 'EXAM_USER_INFO'].includes(key);
    const patch = mergeProfile ? JSON.parse(JSON.stringify(value)) : null;
    // Bind operations by owner/epoch; compare the current full snapshot only for this commit.
    const write = () => {
      if (checkSession(session) !== 'current') return false;
      if (!mergeProfile && !identitySnapshotMatches(origin)) return false;
      const latest = readSessionSnapshot();
      if (latest.status !== 'current') return false;
      if (mergeProfile)
        value = {
          ...(latest.record
            ? latest.record.userInfo
            : this.get(key, null, { migrateLegacy: false, throwOnError: true, session })),
          ...patch
        };
      if (checkSession(session) !== 'current' || (!mergeProfile && !identitySnapshotMatches(origin))) return false;
      const expectedGeneration = generation;
      if (readIdentityGeneration() !== expectedGeneration) return false;
      const record = latest.record ? { ...latest.record } : null;
      if (record) {
        if (key === 'userInfo' || key === 'EXAM_USER_INFO') {
          const owner = value?.uid || value?.userId || value?._id || value?.id;
          if (owner && owner !== record.owner) return false;
          record.userInfo = value;
        } else if (key === 'EXAM_TOKEN' && value) {
          record.token = value;
          record.proof = sessionCredentialProof(record.owner, value);
        } else if (key === LOGIN_SESSION_EPOCH_KEY) return false;
      }
      if (
        (key === 'EXAM_USER_ID' && value !== origin.session.owner) ||
        (['EXAM_TOKEN', 'access_token', 'refresh_token'].includes(key) && !value)
      ) {
        const next = advanceIdentityGeneration(expectedGeneration);
        if (next === null) return false;
        removeLoginEpoch(next);
        return this._saveValue(key, value, silent);
      }
      // The same transaction updates the full record before mirroring aliases.
      if (record) {
        if (!commitIdentityRecord(record, expectedGeneration)) return false;
      } else if (advanceIdentityGeneration(expectedGeneration) === null) return false;
      return this._saveValue(key, value, silent);
    };
    try {
      const result = withIdentityLock(write);
      return result?.catch ? result.catch(() => false) : result;
    } catch {
      return false;
    }
  }

  _saveValue(key, value, silent = false, session, identityWrites) {
    try {
      if (session !== undefined) assertSession(session);
      else if (!isUnscopedKey(key)) session = assertSession(captureSession());
      if (!isUnscopedKey(key) && _unreadBases.has(storageBinding(key, session))) return false;
      const rk = resolveKey(key, session);
      // ✅ B021: 敏感数据加密后存储
      if (isSensitiveKey(key)) {
        const encrypted = obfuscate(value);
        if (encrypted !== null) {
          const plain = uni.getStorageSync(rk);
          const hasPlain =
            (plain !== '' && plain !== null && plain !== undefined) ||
            uni.getStorageInfoSync?.().keys?.includes(rk) === true;
          return migrateIdentityKeys(hasPlain ? [rk, `${LOCAL_COMPAT_PREFIX}${rk}`] : [], () => {
            identityWrites?.set(`_enc_${rk}`, encrypted);
            uni.setStorageSync(`_enc_${rk}`, encrypted);
            if (JSON.stringify(deobfuscate(uni.getStorageSync(`_enc_${rk}`))) !== JSON.stringify(value))
              throw new Error('加密存储未确认，旧副本保留');
            // 清理旧的明文存储（迁移期间）
            try {
              if (hasPlain) uni.removeStorageSync(rk);
            } catch {
              /* ignore */
            }
            return true;
          });
        }
      }
      uni.setStorageSync(rk, value);
      if (session?.owner === 'guest' && !isUnscopedKey(key)) guestWrites.set(key, JSON.stringify(value));
      return true;
    } catch (error) {
      logger.error('[StorageService] 保存失败: [省略]', error);
      if (!silent) {
        toast.info('保存失败，请检查存储空间');
      }
      return false;
    } finally {
      // Also revoke old work if a write only partially succeeded.
      if (isIdentityStorageKey(key)) notifyIdentityChange();
    }
  }

  /**
   * 防抖保存：高频写入场景使用（如练习状态自动保存）
   * 在 DEBOUNCE_DELAY 内多次调用只会执行最后一次写入
   * @param {string} key - 存储键名
   * @param {any} value - 要存储的值
   * @param {boolean} silent - 是否静默失败
   */
  saveDebounced(key, value, silent = true, session = captureSession(), delay = DEBOUNCE_DELAY) {
    if (!session || checkSession(session) === 'changed') return false;
    value = JSON.parse(JSON.stringify(value));
    const pendingKey = JSON.stringify([key, session.owner, session.epoch]);
    const existing = _pendingWrites.get(pendingKey);
    if (existing) {
      clearTimeout(existing.timer);
    }
    const timer = setTimeout(() => {
      this._flushPendingWrite(pendingKey);
    }, delay);
    _pendingWrites.set(pendingKey, { key, value, timer, session, silent });
    return true;
  }

  /**
   * 立即刷新所有待写入的防抖数据（页面卸载时调用）
   */
  flushPendingWrites(key) {
    let result;
    for (const [name, pending] of _pendingWrites)
      if (key === undefined || pending.key === key) {
        const saved = this._flushPendingWrite(name, true);
        result = result === false ? false : saved;
      }
    for (const [id, pending] of _pendingUpdates) if (key === undefined || pending.key === key) this._flushUpdate(id);
    return result;
  }

  update(key, fallback, apply, session = captureSession()) {
    if (!session || checkSession(session) === 'changed') return false;
    const id = JSON.stringify([key, session.owner, session.epoch]);
    const pending = _pendingUpdates.get(id) || { key, fallback, session, operations: [] };
    pending.operations.push(apply);
    _pendingUpdates.set(id, pending);
    return this._flushUpdate(id);
  }

  _flushUpdate(id) {
    const pending = _pendingUpdates.get(id);
    if (!pending) return true;
    const status = checkSession(pending.session);
    if (status === 'changed') {
      _pendingUpdates.delete(id);
      return false;
    }
    if (status !== 'current') return false;
    try {
      const { key, fallback, session, operations } = pending;
      let value = JSON.parse(JSON.stringify(this.get(key, fallback, { session, migrateLegacy: false })));
      if (
        (Array.isArray(fallback) && !Array.isArray(value)) ||
        (fallback &&
          !Array.isArray(fallback) &&
          typeof fallback === 'object' &&
          (!value || typeof value !== 'object' || Array.isArray(value)))
      )
        throw sessionUnavailable();
      if (pending.written && JSON.stringify(value) === pending.written.value) {
        operations.splice(0, pending.written.count);
        pending.written = null;
      }
      if (!operations.length) {
        _pendingUpdates.delete(id);
        return true;
      }
      for (const apply of operations) value = apply(value);
      pending.written = { value: JSON.stringify(value), count: operations.length };
      if (!this.save(key, value, true, session)) return false;
      if (JSON.stringify(this.get(key, null, { session, migrateLegacy: false })) !== JSON.stringify(value))
        return false;
      _pendingUpdates.delete(id);
      return true;
    } catch (error) {
      if (!isSessionUnavailable(error)) {
        _pendingUpdates.delete(id);
        throw error;
      }
      return false;
    }
  }

  cancelPendingWrite(key, session) {
    const id = JSON.stringify([key, session?.owner, session?.epoch]);
    const pending = _pendingWrites.get(id);
    if (pending) {
      clearTimeout(pending.timer);
      _pendingWrites.delete(id);
    }
  }

  _flushPendingWrite(id, silent) {
    const pending = _pendingWrites.get(id);
    const key = pending?.key;
    if (!pending) return;
    clearTimeout(pending.timer);
    const status = checkSession(pending.session);
    if (status === 'changed') {
      _pendingWrites.delete(id);
      return false;
    }
    if (status !== 'current') return false;
    try {
      if (this.save(key, pending.value, silent ?? pending.silent, pending.session) !== true) return false;
      const saved = this.get(key, null, { migrateLegacy: false, throwOnError: true, session: pending.session });
      if (JSON.stringify(saved) !== JSON.stringify(pending.value)) return false;
      if (_pendingWrites.get(id) === pending) _pendingWrites.delete(id);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 从本地存储读取数据
   * @param {string} key - 存储键名
   * @param {any} defaultValue - 如果不存在时返回的默认值
   * @returns {any} 存储的值或默认值
   */
  read(key, defaultValue = null, options = {}) {
    const session = options.session === undefined && !isUnscopedKey(key) ? captureSession() : options.session;
    const result = readPersistent(() => this._readValue(key, defaultValue, { ...options, session }));
    if (session && !isUnscopedKey(key)) {
      const id = storageBinding(key, session);
      if (result.status === 'ready') _unreadBases.delete(id);
      else _unreadBases.add(id);
    }
    return result;
  }

  get(key, defaultValue = null, options = {}) {
    const result = this.read(key, defaultValue, options);
    if (result.status !== 'ready') throw result.error;
    return result.value;
  }

  _readValue(key, defaultValue = null, { migrateLegacy = true, session } = {}) {
    try {
      if (session === undefined && !isUnscopedKey(key)) session = captureSession();
      if (session !== undefined) assertSession(session);
      const snapshot = isSensitiveKey(key) && key !== LOGIN_SESSION_EPOCH_KEY ? readSessionSnapshot() : null;
      if (snapshot?.status === 'unavailable') throw sessionUnavailable();
      if (snapshot?.status === 'changed' || (isSensitiveKey(key) && !supportsIdentityWrites())) return defaultValue;
      if (snapshot?.record) {
        if (key === 'userInfo' || key === 'EXAM_USER_INFO') return snapshot.record.userInfo ?? defaultValue;
        if (key === 'EXAM_USER_ID') return snapshot.record.owner;
        if (key === 'EXAM_TOKEN') return snapshot.record.token;
      }
      const rk = resolveKey(key, session);
      const read = (name) => {
        const runtime = getRuntimeUni();
        const value = readStorageStrict(runtime, name, true, { allowEmpty: typeof defaultValue === 'string' });
        if (session) assertSession(session);
        return value;
      };
      // ✅ B021: 优先读取加密存储的敏感数据
      if (isSensitiveKey(key)) {
        const encrypted = read(`_enc_${rk}`);
        if (encrypted && encrypted !== '') {
          const decrypted = deobfuscate(encrypted);
          if (decrypted !== null) return decrypted;
        }
        // 回退：读取旧的明文存储（兼容迁移期间）
        const plainValue = read(rk);
        if (plainValue !== '' && plainValue !== null && plainValue !== undefined) {
          // 自动迁移：将明文数据加密后重新存储
          if (migrateLegacy) migratePlainSensitiveKey(key);
          return plainValue;
        }
        // 二次回退：读取无前缀的旧数据（用户隔离迁移期间）
        if (rk !== key && migrateLegacy && session?.owner === 'guest') {
          const legacyEnc = read(`_enc_${key}`);
          if (legacyEnc && legacyEnc !== '') {
            const dec = deobfuscate(legacyEnc);
            if (dec !== null) {
              // 自动迁移到带前缀的 key
              if (this.save(key, dec, true, session)) {
                try {
                  uni.removeStorageSync(`_enc_${key}`);
                } catch {
                  /* ignore */
                }
              }
              return dec;
            }
          }
        }
        return defaultValue;
      }
      const value = read(rk);
      // uni.getStorageSync 在 key 不存在时返回空字符串，需要判断
      if (value === '' || value === null || value === undefined) {
        // 新学习事实显式绑定 owner，不从游客命名空间回退或自动迁移。
        if (isDurableLearningKey(key) || PRIVATE_QUIZ_KEYS.has(key) || !migrateLegacy) return defaultValue;
        // 回退：读取无前缀的旧数据（用户隔离迁移期间）
        if (rk !== key && migrateLegacy && session?.owner === 'guest') {
          const legacyValue = read(key);
          if (legacyValue !== '' && legacyValue !== null && legacyValue !== undefined) {
            // 自动迁移到带前缀的 key
            if (this.save(key, legacyValue, true, session)) {
              try {
                uni.removeStorageSync(key);
              } catch {
                /* ignore */
              }
            }
            return legacyValue;
          }
        }
        return defaultValue;
      }
      return value;
    } catch (error) {
      logger.error('[StorageService] 读取失败: [省略]', error);
      throw error;
    }
  }

  /**
   * 删除指定的存储项
   * @param {string} key - 要删除的键名
   * @param {boolean} silent - 是否静默失败
   * @returns {boolean} 是否删除成功
   */
  remove(key, silent = false, session) {
    if (IDENTITY_CONTROL_KEYS.has(identityStorageKey(key))) return false;
    if (isIdentityStorageKey(key)) {
      try {
        return this._clearRevokedCredentials(session);
      } catch {
        return false;
      }
    }
    try {
      if (session !== undefined) assertSession(session);
      else if (!isUnscopedKey(key)) session = assertSession(captureSession());
      const rk = resolveKey(key, session);
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
      if (rk !== key && !session) {
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
      logger.error('[StorageService] 删除失败: [省略]', error);
      if (!silent) {
        toast.info('删除失败');
      }
      return false;
    } finally {
      if (isIdentityStorageKey(key)) notifyIdentityChange();
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

      if (!preserveGlobal) {
        const generation = readIdentityGeneration();
        const result = withIdentityLock(() => {
          const next = advanceIdentityGeneration(generation);
          if (next === null) return false;
          removeLoginEpoch(next);
          const keep = new Set(IDENTITY_CONTROL_KEYS);
          for (const key of preserveKeys) {
            if (typeof key === 'string' && key) {
              keep.add(key);
              keep.add(`_enc_${key}`);
            }
          }
          const keys = uni.getStorageInfoSync().keys || [];
          for (const key of keys) {
            if (readIdentityGeneration() !== next) return false;
            if (!keep.has(key)) uni.removeStorageSync(key);
          }
          clearPendingWrites();
          notifyIdentityChange({ type: 'records' });
          return true;
        });
        return result?.catch ? result.catch(() => false) : result;
      }

      const keep = new Set([IDENTITY_GENERATION_KEY, SESSION_ENABLED_KEY, SESSION_REVOCATION_KEY, LOGIN_ATTEMPT_KEY]);

      if (preserveGlobal) {
        SENSITIVE_KEYS.forEach((key) => {
          if (GLOBAL_KEYS.has(key)) {
            migratePlainSensitiveKey(key);
          }
        });

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

      clearPendingWrites();
      return true;
    } catch (error) {
      logger.error('[StorageService] 清空存储失败', error);
      if (!silent) {
        toast.info('清空失败');
      }
      return false;
    } finally {
      if (options.preserveGlobal !== false) notifyIdentityChange({ type: 'records' });
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
      logger.error('[StorageService] 检查失败: [省略]', error);
      return false;
    }
  }

  /**
   * 登录后迁移：将无前缀的用户级旧数据迁移到 `u_${userId}_` 前缀下
   * 应在登录成功、userId 已写入后调用一次
   * @returns {number} 迁移的 key 数量
   */
  migrateUserKeys(session = captureSession()) {
    if (!session || session.owner === 'guest' || checkSession(session) !== 'current') return 0;
    const sources = loginGuestSources.get(session.epoch);
    if (!sources) return 0;
    let migrated = 0;
    for (const [key, serialized] of sources) {
      if (isOwnedLearningKey(key) || PRIVATE_QUIZ_KEYS.has(key) || isUnscopedKey(key)) {
        sources.delete(key);
        continue;
      }
      const target = resolveKey(key, session);
      try {
        assertSession(session);
        const value = readStorageStrict(getRuntimeUni(), key, true, { allowEmpty: true });
        if (JSON.stringify(value) !== serialized) {
          sources.delete(key);
          continue;
        }
        const runtime = getRuntimeUni();
        const existing = readStorageStrict(runtime, target, true, { allowEmpty: true });
        const exists =
          (existing !== '' && existing !== undefined && existing !== null) ||
          runtime.getStorageInfoSync().keys.includes(target);
        if (exists && JSON.stringify(existing) !== serialized) {
          sources.delete(key);
          continue;
        }
        assertSession(session);
        if (!exists) uni.setStorageSync(target, value);
        assertSession(session);
        if (
          JSON.stringify(readStorageStrict(getRuntimeUni(), key, true, { allowEmpty: true })) !== serialized ||
          JSON.stringify(readStorageStrict(getRuntimeUni(), target, true, { allowEmpty: true })) !== serialized
        )
          continue;
        assertSession(session);
        // Guest writers are synchronous on every runtime: no shared atomic compare/delete exists.
        // Retain the source; consume only this login's proof after verifying the copied value.
        sources.delete(key);
        migrated++;
      } catch {
        break;
      }
    }
    if (!sources.size) loginGuestSources.delete(session.epoch);
    return migrated;
  }

  /**
   * 清理当前用户隔离数据；登出可保留学习事实，显式删除仍可全量清理。
   * 保留全局 key 和其他用户的数据
   * @param {string} [uid] - 要清理的 userId，默认当前用户
   * @returns {number} 清理的 key 数量
   */
  clearUserData(uid, { preserveLearning = false } = {}) {
    const userId = uid || getUserId();
    if (!userId) return 0;
    if (preserveLearning) this.flushPendingWrites();
    clearPendingWrites();

    let cleared = 0;
    try {
      const prefix = `u_${userId}_`;
      const encPrefix = `_enc_u_${userId}_`;
      const allKeys = uni.getStorageInfoSync().keys || [];
      for (const key of allKeys) {
        if (key.startsWith(prefix) || key.startsWith(encPrefix)) {
          const ownedKey = key.slice(key.startsWith(encPrefix) ? encPrefix.length : prefix.length);
          if (preserveLearning && isDurableLearningKey(ownedKey)) continue;
          try {
            uni.removeStorageSync(key);
            cleared++;
          } catch {
            /* ignore */
          }
        }
      }
      if (cleared > 0) {
        logger.log('[StorageService] 已清理 [省略] 个隔离 key');
      }
    } catch (error) {
      logger.error('[StorageService] 清理用户数据失败:', error);
    } finally {
      try {
        if (cleared > 0 && userId === getUserId()) notifyIdentityChange({ type: 'records' });
      } catch {
        /* Cache cleanup cannot interrupt revocation. */
      }
    }
    return cleared;
  }

  // 只用于用户明确确认的访客迁移，不开放任意账户的原始键读取。
  getGuestLearningSnapshot() {
    const read = (key) => requirePersistent(() => readStorageStrict(getRuntimeUni(), key));
    const value = read('conversation_learning_v1');
    return value && typeof value === 'object'
      ? JSON.parse(JSON.stringify(readLocalHistory(value, read, 'guest')))
      : null;
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
  saveBatch(data, silent = false, session = captureSession()) {
    try {
      assertSession(session);
      const keys = Object.keys(data);
      const write = (index) => {
        if (index === keys.length) return true;
        const key = keys[index];
        const saved = this.save(key, data[key], true, session);
        const next = (confirmed) => (confirmed === true ? write(index + 1) : false);
        return saved?.then ? saved.then(next) : next(saved);
      };
      return write(0);
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
    return this._withMistakeBookLock((current) => this._resolveMistakeConflict(current, mistakeId, strategy));
  }

  async _resolveMistakeConflict(current, mistakeId, strategy) {
    const userId = getUserId();
    if (!userId) return { success: false, error: '用户未登录' };
    if (!['local', 'cloud', 'merge'].includes(strategy))
      return { success: false, code: 'INVALID_INPUT', error: '请选择冲突处理方式' };
    try {
      const localMistakes = this._mistakeBookRows();
      const originalBook = JSON.stringify(localMistakes);
      const index = localMistakes.findIndex((row) => String(row.id ?? row._id) === String(mistakeId));
      const localMistake = localMistakes[index];
      if (!localMistake || localMistake.sync_status !== 'conflict') return { success: false, error: '未找到冲突记录' };
      let response;
      try {
        response = await apiGetMistakes(userId, { id: mistakeId }, { session: current.session });
      } catch (error) {
        if (!current() || this._mistakeRequestCancelled(error)) return this._mistakeContextChanged();
        return { success: false, code: 'CONFLICT_UNCONFIRMED', error: '云端版本未确认，原冲突保留' };
      }
      if (!current() || this._mistakeRequestCancelled(response)) return this._mistakeContextChanged();
      const data = response?.data;
      const rows = Array.isArray(data) ? data : (data?.list ?? data?.data ?? (data?.id || data?._id ? [data] : []));
      const cloudMistake =
        Array.isArray(rows) &&
        rows.find(
          (row) => String(row?.id ?? row?._id) === String(mistakeId) && (!row.user_id || row.user_id === userId)
        );
      if (response?.success === false || !(response?.code === 0 || response?.ok === true) || !cloudMistake)
        return { success: false, code: 'CONFLICT_UNCONFIRMED', error: '云端版本未确认，原冲突保留' };
      // Conflicting source versions or raw answers need separate records, never a destructive field merge.
      if (!this._sameMistakeOriginal(localMistake, cloudMistake))
        return { success: false, code: 'SOURCE_CONFLICT', error: '原题或原答不同，保留两份原件后再处理' };
      const oldStateFields = [
        'wrong_count',
        'review_count',
        'is_mastered',
        'mastered_at',
        'last_practice_time',
        'last_review_time',
        'next_review_time',
        'ease_factor',
        'interval_days',
        'due',
        'stability',
        'elapsed_days',
        'scheduled_days',
        'learning_steps',
        'reps',
        'lapses',
        'state',
        'last_review'
      ];
      if (
        oldStateFields.some(
          (key) => quizOriginalIdentity(localMistake[key] ?? null) !== quizOriginalIdentity(cloudMistake[key] ?? null)
        )
      )
        return {
          success: false,
          code: 'LEGACY_STATE_CONFLICT',
          error: '两份旧状态不一致，原冲突保留，不能自动当作作答或复习'
        };
      let resolvedData;
      let cloudPersisted = false;
      if (strategy === 'cloud') resolvedData = { ...cloudMistake };
      else {
        const localTime = localMistake.last_practice_time || localMistake.updated_at || 0;
        const cloudTime = cloudMistake.updated_at || cloudMistake.last_review_time || 0;
        const base = strategy === 'merge' && cloudTime > localTime ? cloudMistake : localMistake;
        const other = base === localMistake ? cloudMistake : localMistake;
        resolvedData = { ...base };
        if (strategy === 'merge') {
          if (base.tags?.length || other.tags?.length)
            resolvedData.tags = Array.from(new Set([...(base.tags || []), ...(other.tags || [])]));
          const baseNotes = String(base.notes ?? base.note ?? ''),
            otherNotes = String(other.notes ?? other.note ?? '');
          if (baseNotes || otherNotes)
            resolvedData.notes = otherNotes.length > baseNotes.length ? otherNotes : baseNotes;
          delete resolvedData.note;
        }
        delete resolvedData._conflict_cloud_data;
        const persisted = await this._updateMistakeFieldsInCloud(userId, mistakeId, resolvedData, current);
        if (!current() || persisted.cancelled) return this._mistakeContextChanged();
        if (!persisted.confirmed)
          return { success: false, code: 'CONFLICT_UNCONFIRMED', error: '云端未确认保存，原冲突保留' };
        cloudPersisted = !persisted.skipped;
        resolvedData = { ...cloudMistake, ...this._buildMistakeCloudFields(resolvedData) };
      }
      if (!current()) return this._mistakeContextChanged();
      if (JSON.stringify(this._mistakeBookRows()) !== originalBook)
        return { success: false, code: 'CONTEXT_CHANGED', cloudPersisted, error: '本机记录已变化，请重新核对冲突' };
      resolvedData.id = cloudMistake.id ?? cloudMistake._id;
      resolvedData._id = cloudMistake._id ?? cloudMistake.id;
      resolvedData.sync_status = 'synced';
      delete resolvedData._needs_remote_merge;
      delete resolvedData._conflict_cloud_data;
      localMistakes[index] = resolvedData;
      if (!this.save('mistake_book', localMistakes, true, current.session))
        return this._mistakeSaveFailed({ cloudPersisted });
      return { success: true, strategy, data: resolvedData, cloudPersisted };
    } catch (error) {
      if (!current()) return this._mistakeContextChanged();
      return { success: false, error: error.message };
    }
  }

  async resolveAllConflicts() {
    // One lock and one account context cover the whole batch; no nested mutex acquisition.
    return this._withMistakeBookLock(async (current) => {
      const conflicts = this._mistakeBookRows().filter((row) => row.sync_status === 'conflict');
      let resolved = 0,
        failed = 0;
      for (const conflict of conflicts) {
        if (!current()) return { ...this._mistakeContextChanged(), resolved, failed };
        const result = await this._resolveMistakeConflict(current, conflict.id ?? conflict._id, 'merge');
        if (!current() || result.code === 'CONTEXT_CHANGED')
          return { ...this._mistakeContextChanged(), resolved, failed };
        if (result.success) resolved++;
        else failed++;
      }
      return { success: failed === 0, resolved, failed };
    });
  }

  /**
   * 保存错题（使用 Laf 后端）
   * @param {Object} data - 错题数据
   * @returns {Promise<Object>} 返回保存结果
   */
  async addMistake(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data))
      return { success: false, code: 'INVALID_INPUT', error: '题目记录无法保存，请保留原件' };
    let original;
    try {
      original = JSON.parse(JSON.stringify(data));
    } catch {
      return { success: false, code: 'INVALID_INPUT', error: '题目记录无法保存，请保留原件' };
    }
    return this._withMistakeBookLock(async (current) => {
      const userId = getUserId();
      if (!userId) return this._saveMistakeLocal(original, 'local_only', current);
      try {
        this._mistakeBookRows();
      } catch {
        return this._mistakeSaveFailed();
      }
      let response;
      try {
        response = await apiAddMistake(userId, offlineMistakeToBackend(original), { session: current.session });
      } catch (error) {
        if (!current() || this._mistakeRequestCancelled(error)) return this._mistakeContextChanged();
        if (['FORBIDDEN', 'RESOURCE_LIMIT', 'INVALID_INPUT'].includes(error.code))
          return { success: false, code: error.code, error: error.message };
        return this._saveMistakeLocal(original, 'pending', current);
      }
      if (!current() || this._mistakeRequestCancelled(response)) return this._mistakeContextChanged();
      const cloudId = response?.id ?? response?._id ?? response?.data?.id ?? response?.data?._id;
      const confirmed = response?.success !== false && (response?.ok === true || response?.code === 0) && cloudId;
      if (!confirmed) return this._saveMistakeLocal(original, 'pending', current);
      const localMistakes = this._mistakeBookRows();
      const existing = localMistakes.find((row) => String(row.id ?? row._id) === String(cloudId));
      if (existing) {
        if (!this._sameMistakeOriginal(existing, original))
          return {
            success: false,
            code: 'SOURCE_CONFLICT',
            remoteSaved: true,
            id: cloudId,
            error: '云端编号已有不同原件，本机原记录保留'
          };
        return { success: true, id: cloudId, source: 'cloud', replayed: true };
      }
      localMistakes.unshift({
        ...original,
        id: cloudId,
        _id: cloudId,
        sync_status: 'synced',
        created_at: original.created_at ?? original.createdAt ?? original.addTime ?? Date.now()
      });
      if (!this.save('mistake_book', localMistakes, true, current.session))
        return this._mistakeSaveFailed({ remoteSaved: true, id: cloudId });
      return { success: true, id: cloudId, source: 'cloud' };
    });
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
  _saveMistakeLocal(mistakeData, syncStatus = 'pending', current = this._mistakeContext()) {
    try {
      const localMistakes = this._mistakeBookRows();
      const newMistake = {
        ...mistakeData,
        id: `local_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
        sync_status: syncStatus,
        created_at: mistakeData.created_at ?? mistakeData.createdAt ?? mistakeData.addTime ?? Date.now()
      };
      localMistakes.unshift(newMistake);
      if (!this.save('mistake_book', localMistakes, true, current.session)) return this._mistakeSaveFailed();

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
    return this._withMistakeBookLock(async (current) => {
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
        logger.log('[StorageService] 开始从云端获取错题列表 (page: [省略], limit: [省略])');
        const res = await apiGetMistakes(
          userId,
          {
            // ✅ P2-1: 传递分页参数给后端，避免全量拉取
            page,
            limit,
            ...(filters.is_mastered !== undefined ? { is_mastered: filters.is_mastered } : {})
          },
          { session: current.session }
        );
        if (!current() || this._mistakeRequestCancelled(res)) return this._mistakeContextChanged();
        if (res?.success === false || (res?.code !== 0 && res?.ok !== true && res?.success !== true))
          throw new Error('历史列表读取未确认');
        logger.log('[StorageService] ✅ 云端获取成功，返回 [省略] 条记录');

        // 返回数据，兼容旧代码期望的格式
        const mistakeList = res.data || [];

        // 如果返回的是对象格式，尝试提取数组和分页信息
        let list = Array.isArray(mistakeList) ? mistakeList : mistakeList.data || mistakeList.list || [];
        // ✅ P2-1: 优先使用后端返回的分页元数据
        const serverTotal = mistakeList.total;
        const serverHasMore = mistakeList.hasMore;

        // A remote page updates its identities; unloaded cached originals remain.
        let cacheSaved = true;
        if (Array.isArray(list)) {
          const cached = this.get('mistake_book', [], { migrateLegacy: false });
          const oldRows = Array.isArray(cached) ? cached : [];
          const incomingIds = new Set(
            list
              .map((row) => row?.id ?? row?._id)
              .filter((id) => id !== undefined && id !== null)
              .map(String)
          );
          const retained = oldRows.filter((row) => !incomingIds.has(String(row?.id ?? row?._id)));
          const identifiable = list.filter(
            (row) => row && (row.id ?? row._id) !== undefined && (row.id ?? row._id) !== null
          );
          cacheSaved = this.save('mistake_book', [...identifiable, ...retained], true, current.session);
          if (page === 1) {
            const pending = retained.filter((row) => row && ['pending', 'local_only'].includes(row.sync_status));
            list = [...list, ...pending];
          }
        }

        // ✅ P2-1: 后端已做分页和筛选，直接返回结果
        return {
          list: list,
          total: serverTotal !== undefined ? serverTotal : list.length,
          page: page,
          limit: limit,
          hasMore: serverHasMore !== undefined ? serverHasMore : list.length >= limit,
          source: 'cloud',
          cacheSaved
        };
      } catch (error) {
        if (!current()) return this._mistakeContextChanged();
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
      const allMistakes = this.get('mistake_book', [], { migrateLegacy: false });

      // 应用筛选条件
      let filteredMistakes = Array.isArray(allMistakes) ? [...allMistakes] : [];
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
      if (isSessionUnavailable(error)) throw error;
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
  async removeMistake(id, session = captureSession()) {
    if (!['string', 'number'].includes(typeof id) || String(id).trim() === '')
      return { success: false, error: '错题ID不能为空' };
    return this._withMistakeBookLock(async (current) => {
      const userId = getUserId();
      if (!userId) return this._removeMistakeLocal(id, current);
      try {
        const res = await apiRemoveMistake(userId, id, { session: current.session });
        if (!current() || this._mistakeRequestCancelled(res)) return this._mistakeContextChanged();
        const receipt = res?.ok === true ? res : res?.code === 0 && res?.data?.ok === true ? res.data : null;
        const local = this._removeMistakeLocal(id, current);
        if (!receipt) return local;
        if (!local.success && local.code !== 'NOT_FOUND') return { ...local, source: 'cloud', localPending: true };
        return { success: true, source: 'cloud', deleted: receipt.deleted || 0 };
      } catch (error) {
        if (!current()) return this._mistakeContextChanged();
        logger.warn('[StorageService] 远端移除未确认，仅处理本机指定条目', error);
        return this._removeMistakeLocal(id, current);
      }
    }, session);
  }

  _removeMistakeLocal(id, current) {
    if (!current()) return this._mistakeContextChanged();
    try {
      const rows = this.get('mistake_book', [], { migrateLegacy: false });
      if (!Array.isArray(rows)) return { success: false, error: '本机条目格式异常，原记录保留' };
      const next = rows.filter((row) => (row?.id ?? row?._id) !== id);
      if (next.length === rows.length) return { success: false, code: 'NOT_FOUND', error: '错题不存在' };
      if (!this.save('mistake_book', next, true, current.session))
        return { success: false, code: 'STORAGE_FAILED', error: '本机移除未保存，原记录保留' };
      return { success: true, source: 'local', deleted: rows.length - next.length };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async batchRemoveMistakes(ids, session = captureSession()) {
    if (
      !Array.isArray(ids) ||
      !ids.length ||
      ids.some((id) => !['string', 'number'].includes(typeof id) || String(id).trim() === '')
    )
      return { success: false, error: '错题ID列表不合法' };
    const requested = [...ids];
    return this._withMistakeBookLock(async (current) => {
      const userId = getUserId();
      let receipt;
      if (userId) {
        try {
          const res = await apiBatchRemoveMistakes(userId, requested, { session: current.session });
          if (!current() || this._mistakeRequestCancelled(res)) return this._mistakeContextChanged();
          receipt = res?.ok === true ? res : res?.code === 0 && res?.data?.ok === true ? res.data : null;
        } catch (error) {
          if (!current()) return this._mistakeContextChanged();
          logger.warn('[StorageService] 批量远端移除未确认，保留原账户边界', error);
        }
      }
      if (!current()) return this._mistakeContextChanged();
      const rows = this.get('mistake_book', [], { migrateLegacy: false });
      if (!Array.isArray(rows)) return { success: false, error: '本机条目格式异常，原记录保留' };
      const next = this._filterMistakeBookByIds(rows, requested);
      if (!this.save('mistake_book', next, true, current.session))
        return {
          success: false,
          code: 'STORAGE_FAILED',
          source: receipt ? 'cloud' : 'local',
          localPending: true,
          error: '本机移除未保存，原记录保留'
        };
      return {
        success: true,
        deleted: Math.max(receipt?.deleted || 0, rows.length - next.length),
        source: receipt ? 'cloud' : 'local'
      };
    }, session);
  }

  /**
   * 兼容旧调用，但旧掌握标记没有可靠作答依据，不能写复习事实。
   */
  async updateMistakeStatus() {
    return {
      success: false,
      code: 'RELIABLE_REVIEW_REQUIRED',
      error: '请在学习页明确作答；旧掌握标记不能证明完成复习'
    };
  }

  /**
   * 同步本地待办；结果未确认时保留原件，不立即逐条重发。
   * @returns {Promise<Object>} 返回同步结果 { success: boolean, synced: number, failed: number, conflicts: number }
   */
  async syncPendingMistakes({ expectedRecords, session = captureSession() } = {}) {
    return this._withMistakeBookLock(async (current) => {
      const userId = getUserId();
      if (!userId) {
        logger.warn('[StorageService] 用户未登录，无法同步待同步错题');
        return { success: false, error: '用户未登录' };
      }

      try {
        const localMistakes = this._mistakeBookRows();
        const originalBook = JSON.stringify(localMistakes);
        const pendingMistakes = localMistakes.filter(
          (m) => m && (m.sync_status === 'pending' || m.sync_status === 'local_only')
        );
        if (expectedRecords !== undefined && JSON.stringify(pendingMistakes) !== JSON.stringify(expectedRecords))
          return { success: false, code: 'CONTEXT_CHANGED', error: '待办已变化，请重新确认发送范围' };

        if (pendingMistakes.length === 0) {
          logger.log('[StorageService] ✅ 没有待同步的错题');
          return { success: true, synced: 0, failed: 0, conflicts: 0 };
        }

        logger.log('[StorageService] 🔄 开始同步 [省略] 条待同步错题...');

        let synced = 0;
        let failed = 0;
        let conflicts = 0;

        // I003: 尝试批量同步（后端 batchSync action）
        const batchData = pendingMistakes.map((m) => ({
          ...offlineMistakeToBackend(m),
          _local_id: m.id ?? m._id // 用于回写映射
        }));

        let batchRes;
        try {
          batchRes = await apiBatchSyncMistakes(userId, batchData, { session: current.session });
        } catch (error) {
          if (!current() || this._mistakeRequestCancelled(error)) return this._mistakeContextChanged();
          return { success: false, code: 'SYNC_UNCONFIRMED', error: '同步结果未确认，原待办保留，请稍后核对' };
        }
        if (!current() || this._mistakeRequestCancelled(batchRes)) return this._mistakeContextChanged();
        const receipts = batchRes?.data?.results ?? batchRes?.results;
        if (batchRes?.success === false || batchRes?.code !== 0 || !Array.isArray(receipts))
          return { success: false, code: 'SYNC_UNCONFIRMED', error: '同步结果未确认，原待办保留，请稍后核对' };
        const mapped = new Set();
        const cloudIds = new Set();
        for (const receipt of receipts) {
          const localId = receipt.localId ?? receipt._local_id ?? receipt.oldId;
          const mistake = pendingMistakes.find((row) => String(row.id ?? row._id) === String(localId));
          const cloudId = receipt.id ?? receipt.newId;
          if (!mistake || mapped.has(mistake) || (receipt.success && cloudIds.has(String(cloudId))))
            return { success: false, code: 'SYNC_UNCONFIRMED', error: '同步编号对应关系不明确，原待办保留' };
          mapped.add(mistake);
          if (receipt.success && cloudId) {
            cloudIds.add(String(cloudId));
            mistake.id = cloudId;
            mistake._id = cloudId;
            mistake.sync_status = 'synced';
            synced++;
          } else if (receipt.conflict) {
            mistake.sync_status = 'conflict';
            mistake._conflict_cloud_data = receipt.cloudData || null;
            conflicts++;
          } else failed++;
        }
        failed += pendingMistakes.length - mapped.size;
        if (JSON.stringify(this._mistakeBookRows()) !== originalBook)
          return { success: false, code: 'CONTEXT_CHANGED', remoteSynced: synced, error: '本机记录已变化，原待办保留' };

        // 更新本地存储
        if (!current()) return this._mistakeContextChanged();
        if (!this.save('mistake_book', localMistakes, true, current.session))
          return {
            success: false,
            code: 'STORAGE_FAILED',
            synced: 0,
            failed,
            conflicts,
            remoteSynced: synced,
            error: '同步映射未保存，原待办保留'
          };

        const result = {
          success: synced > 0,
          synced: synced,
          failed: failed,
          conflicts: conflicts
        };

        // 记录最后同步时间
        if (synced > 0) this.save('last_sync_time', Date.now(), true, current.session);

        logger.log('[StorageService] 📊 同步完成: 成功 [省略] 条, 失败 [省略] 条, 冲突 [省略] 条');

        if (conflicts > 0) result.requiresConflictReview = true;

        return result;
      } catch (error) {
        if (!current()) return this._mistakeContextChanged();
        logger.error('[StorageService] ❌ 同步待同步错题失败:', error);
        return {
          success: false,
          synced: 0,
          failed: 0,
          error: error.message
        };
      }
    }, session);
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
