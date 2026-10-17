import { withIdentityLock } from '@/services/identity-context.js';
import {
  captureSession,
  checkSession,
  assertSession,
  isSessionUnavailable,
  readStorageStrict
} from '@/services/auth-storage.js';
/**
 * 只排空旧版本持久任务；不接受新的离线提交。
 * 保留身份隔离、按 id 确认/取消、有效期与网络恢复入口。
 * 发送仅由注册的 rebuilder 从持久 requestData 重建。
 */

import { logger } from '@/utils/logger.js';
import { requirePersistent } from '@/services/persistence-read.js';

/**
 * 队列直接使用 uni 存储，避免与 storageService 的请求同步链循环依赖。
 *
 * 使用 uni 原生存储 API 替代 storageService，因为 offline-queue 的存储需求简单，
 * 不需要 storageService 的云同步能力。
 */

function createNetworkUniCompat() {
  return {
    getNetworkType(options = {}) {
      const { success } = options;
      const online = typeof navigator !== 'undefined' ? navigator.onLine !== false : true;
      success?.({ networkType: online ? 'wifi' : 'none' });
    },
    onNetworkStatusChange(_callback) {
      // H5 fallback 环境不提供真实网络变更订阅，静默兼容
    }
  };
}

const globalRef = typeof globalThis !== 'undefined' ? globalThis : {};
const uni = globalRef['uni'] || createNetworkUniCompat();

function createQueueStorageCompat() {
  const memoryStore = new Map();
  const keyPrefix = '__exam_offline_queue__:';

  const readLocal = (key) => {
    if (typeof localStorage === 'undefined') return undefined;
    const raw = localStorage.getItem(keyPrefix + key);
    return raw === null ? undefined : JSON.parse(raw);
  };

  const writeLocal = (key, value) => {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(keyPrefix + key, JSON.stringify(value));
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  return {
    get(key, defaultValue = null) {
      // An installed store's read failure must never fall back to an incomplete memory copy.
      if (typeof uni.getStorageSync === 'function') {
        const value = requirePersistent(() => readStorageStrict(uni, key));
        return value === '' || value === undefined || value === null ? defaultValue : value;
      }
      const value = requirePersistent(() => readLocal(key));
      if (value !== undefined) return value;
      return typeof localStorage === 'undefined' && memoryStore.has(key) ? memoryStore.get(key) : defaultValue;
    },
    set(key, value) {
      try {
        if (typeof uni.setStorageSync === 'function') {
          uni.setStorageSync(key, value);
          return true;
        }
        if (typeof localStorage !== 'undefined') return writeLocal(key, value);
        memoryStore.set(key, value);
        return true;
      } catch {
        return false;
      }
    }
  };
}

const queueStorage = createQueueStorageCompat();

const STORAGE_KEY = 'EXAM_OFFLINE_QUEUE';
// A successful remote response is not a local dequeue receipt. Retain it across queue instances
// in this runtime until expiry; retry acknowledgement only, never resend the same item.
const sentReceipts = new Map();
const sendingIds = new Map();
export const QUEUE_STATE = Object.freeze({
  PENDING: 'pending',
  SENDING: 'sending',
  CONFIRMED: 'confirmed',
  RETRY: 'retry'
});
const MAX_AGE = 24 * 60 * 60 * 1000; // 24小时过期

/**
 * 优先级权重
 */
const PRIORITY_WEIGHTS = {
  critical: 4,
  high: 3,
  normal: 2,
  low: 1
};

/**
 * 离线队列类
 */
class OfflineQueue {
  constructor() {
    for (const [id, sentAt] of sentReceipts) if (Date.now() - sentAt >= MAX_AGE) sentReceipts.delete(id);
    this.queue = [];
    this._storageLoaded = false;
    this.processing = false;
    this.isOnline = true;
    this.listeners = new Set();
    this._rebuilder = null; // ✅ 请求重建函数（由请求调用方注册）

    // 初始化
    this._init();
  }

  /**
   * ✅ 问题清单修复：注册请求重建函数
   * 允许请求调用方注册一个函数，用于从持久化的 requestData 重建请求
   * @param {Function} rebuilderFn - (requestData) => Promise<any>
   */
  registerRebuilder(rebuilderFn) {
    this._rebuilder = rebuilderFn;
    logger.log('[OfflineQueue] ✅ 请求重建函数已注册');
  }

  /**
   * 初始化
   * @private
   */
  _init() {
    // 从本地存储恢复队列
    this._loadFromStorage();

    // 监听网络状态
    this._setupNetworkListener();

    logger.log('[OfflineQueue] 初始化完成，队列中有 [省略] 个待处理请求');
  }

  /**
   * 从本地存储加载队列
   * @private
   */
  _restore(items) {
    return items
      .filter(
        (item) =>
          item &&
          typeof item.id === 'string' &&
          !!item.id &&
          Date.now() - item.timestamp < MAX_AGE &&
          typeof item.session?.owner === 'string' &&
          !!item.session.owner &&
          (item.session.epoch === null || /^[a-zA-Z0-9_-]{8,120}$/.test(item.session.epoch || '')) &&
          checkSession(item.session) !== 'changed'
      )
      .map((item) => ({
        ...item,
        retryCount: item.retryCount || 0,
        state: sentReceipts.has(item.id)
          ? QUEUE_STATE.CONFIRMED
          : item.state === QUEUE_STATE.SENDING && !sendingIds.has(item.id)
            ? QUEUE_STATE.RETRY
            : Object.values(QUEUE_STATE).includes(item.state)
              ? item.state
              : QUEUE_STATE.RETRY
      }))
      .sort((a, b) => (PRIORITY_WEIGHTS[b.priority] || 2) - (PRIORITY_WEIGHTS[a.priority] || 2));
  }

  _loadFromStorage() {
    try {
      const stored = queueStorage.get(STORAGE_KEY, []);
      if (!Array.isArray(stored)) throw new Error('离线记录暂不可读');
      this.queue = this._restore(stored);
      this._storageLoaded = true;
    } catch {
      this._storageLoaded = false;
    }
  }

  // Only transactions may persist. The base is read inside the same origin-wide identity lock.
  _transaction(apply) {
    const write = () => {
      const latest = queueStorage.get(STORAGE_KEY, []);
      if (!Array.isArray(latest)) return false;
      const next = latest.map((item) => ({ ...item }));
      const result = apply(next);
      if (result === false) return false;
      if (
        !queueStorage.set(STORAGE_KEY, next) ||
        JSON.stringify(queueStorage.get(STORAGE_KEY, [])) !== JSON.stringify(next)
      )
        return false;
      this.queue = this._restore(next);
      this._storageLoaded = true;
      return result;
    };
    try {
      const result = withIdentityLock(write);
      return result?.catch ? result.catch(() => false) : result;
    } catch {
      return false;
    }
  }

  _saveToStorage(item) {
    return this._transaction((latest) => {
      if (item) {
        const index = latest.findIndex((current) => current.id === item.id);
        // Never restore a canceled task or acknowledge a different body after lock wait.
        if (
          item.state === QUEUE_STATE.SENDING &&
          (index === -1 || JSON.stringify(latest[index].requestData) !== JSON.stringify(item.requestData))
        ) {
          this._loadFromStorage();
          return false;
        }
        if (index !== -1) {
          latest[index] = { ...latest[index], state: item.state, retryCount: item.retryCount };
        }
      }
      return true;
    });
  }

  /**
   * 设置网络监听
   * @private
   */
  _setupNetworkListener() {
    // 检查当前网络状态
    if (typeof uni.getNetworkType === 'function') {
      uni.getNetworkType({
        success: (res) => {
          this.isOnline = res.networkType !== 'none';
          logger.log('[OfflineQueue] 当前网络状态: [省略]');
        }
      });
    }

    // 监听网络变化
    if (typeof uni.onNetworkStatusChange === 'function') {
      uni.onNetworkStatusChange((res) => {
        const wasOffline = !this.isOnline;
        this.isOnline = res.isConnected;

        logger.log('[OfflineQueue] 网络状态变化: [省略] ([省略])');

        // 从离线恢复到在线，自动处理队列
        if (wasOffline && this.isOnline && (this.queue.length > 0 || !this._storageLoaded)) {
          logger.log('[OfflineQueue] 网络恢复，开始处理离线队列...');
          this.processQueue();
        }

        // 通知监听器
        this._notifyListeners({
          type: 'networkChange',
          isOnline: this.isOnline,
          networkType: res.networkType
        });
      });
    }
  }

  /**
   * 通知监听器
   * @private
   */
  _notifyListeners(event) {
    this.listeners.forEach((listener) => {
      try {
        listener(event);
      } catch (error) {
        logger.error('[OfflineQueue] 监听器执行错误:', error);
      }
    });
  }

  dequeue(id) {
    if (!this.queue.some((item) => item.id === id) || sendingIds.has(id)) return false;
    const removed = this.queue.find((item) => item.id === id);
    const result = this._transaction((latest) => {
      if (sendingIds.has(id)) return false;
      const index = latest.findIndex((item) => item.id === id);
      if (index !== -1) latest.splice(index, 1);
      return true;
    });
    const finish = (saved) => {
      if (saved) {
        this._notifyListeners({ type: 'dequeue', request: removed, queueLength: this.queue.length });
      }
      return saved;
    };
    return result?.then ? result.then(finish) : finish(result);
  }

  /**
   * 处理队列中的请求
   * @param {Object} options - 选项
   * @returns {Promise<Object>} 处理结果
   */
  async processQueue(options = {}) {
    void options;
    if (this.processing || this.paused) {
      logger.log('[OfflineQueue] 队列[省略]...');
      return { success: false, reason: this.paused ? 'paused' : 'already_processing' };
    }

    if (!this.isOnline) {
      logger.log('[OfflineQueue] 当前离线，暂停处理队列');
      return { success: false, reason: 'offline' };
    }

    const results = { processed: 0, failed: 0, errors: [] };
    this.processing = true;
    try {
      // Refresh and expire under the same lock, including old epochs of this account.
      // An unavailable identity is never permission to clean another account's records.
      const session = captureSession();
      if (!session) return { success: false, reason: 'SESSION_UNAVAILABLE' };
      let refreshed = this._transaction((latest) => {
        assertSession(session);
        for (let i = latest.length - 1; i >= 0; i--) {
          const task = latest[i];
          if (
            task.session?.owner === session.owner &&
            Date.now() - task.timestamp >= MAX_AGE &&
            !sendingIds.has(task.id)
          )
            latest.splice(i, 1);
        }
        return true;
      });
      if (refreshed?.then) refreshed = await refreshed;
      if (!refreshed) return { success: false, reason: 'storage_unavailable' };
      if (this.queue.length === 0) {
        logger.log('[OfflineQueue] 队列为空');
        return { success: true, processed: 0, failed: 0 };
      }

      logger.log('[OfflineQueue] 🔄 开始处理队列，共 [省略] 个请求');

      // 复制队列进行处理
      const toProcess = [...this.queue];

      for (const item of toProcess) {
        // 检查网络状态
        if (!this.isOnline) {
          logger.log('[OfflineQueue] 网络断开，暂停处理');
          results.reason = 'offline';
          break;
        }

        if (!this.queue.some((current) => current.id === item.id)) continue;
        const previousState = item.state;
        const claim = {};
        const release = () => {
          if (sendingIds.get(item.id) === claim) sendingIds.delete(item.id);
        };
        try {
          const status = checkSession(item.session);
          if (status === 'unavailable') {
            results.reason = 'SESSION_UNAVAILABLE';
            break;
          }
          if (status !== 'current') {
            if (!(await this.dequeue(item.id))) {
              results.reason = 'storage_unavailable';
              break;
            }
            continue;
          }
          if (sentReceipts.has(item.id) || item.state === QUEUE_STATE.CONFIRMED) {
            if (!(await this.dequeue(item.id))) {
              results.reason = 'storage_unavailable';
              break;
            }
            results.processed++;
            continue;
          }
          const requestFn =
            item.requestData && this._rebuilder
              ? () => this._rebuilder(item.requestData, { session: item.session, taskId: item.id })
              : null;

          if (!requestFn) {
            // 无法执行也无法重建，跳过
            logger.log('[OfflineQueue] ⚠️ 请求 [省略] 无法执行（缺少请求数据或重建器），跳过');
            item.state = QUEUE_STATE.RETRY;
            results.reason = 'request_unavailable';
            results.failed++;
            await this._saveToStorage(item);
            continue;
          }

          logger.log('[OfflineQueue] 📡 处理请求: [省略]');

          // 执行请求
          assertSession(item.session);
          if (sendingIds.has(item.id)) {
            results.reason = 'already_processing';
            break;
          }
          let saved = this._transaction((latest) => {
            assertSession(item.session);
            if (sendingIds.has(item.id) || sentReceipts.has(item.id)) return false;
            const current = latest.find((task) => task.id === item.id);
            if (
              !current ||
              Date.now() - current.timestamp >= MAX_AGE ||
              current.session?.owner !== item.session.owner ||
              current.session?.epoch !== item.session.epoch ||
              JSON.stringify(current.requestData) !== JSON.stringify(item.requestData)
            ) {
              this._loadFromStorage();
              return false;
            }
            // Comparison and registration share the same lock, before verification can yield.
            sendingIds.set(item.id, claim);
            current.state = QUEUE_STATE.SENDING;
            return true;
          });
          if (saved?.then) saved = await saved;
          if (!saved || sendingIds.get(item.id) !== claim) {
            item.state = previousState;
            results.reason =
              sendingIds.has(item.id) && sendingIds.get(item.id) !== claim
                ? 'already_processing'
                : 'storage_unavailable';
            break;
          }
          assertSession(item.session);
          if (this.paused || !this.isOnline) {
            results.reason = this.paused ? 'paused' : 'offline';
            break;
          }
          item.state = QUEUE_STATE.SENDING;
          const response = await requestFn({ session: item.session, taskId: item.id });
          if (isSessionUnavailable(response)) {
            item.state = previousState;
            results.reason = 'SESSION_UNAVAILABLE';
            await this._saveToStorage(item);
            break;
          }
          if (
            response?.success === false ||
            response?.ok === false ||
            (response?.code !== undefined && ![0, 200].includes(response.code))
          )
            throw new Error('请求未确认成功');
          sentReceipts.set(item.id, Date.now());
          item.state = QUEUE_STATE.CONFIRMED;
          release();
          assertSession(item.session);
          if (!(await this._saveToStorage(item))) {
            results.reason = 'storage_unavailable';
            break;
          }

          // Only local persistence confirms dequeue; retain body and receipt on failure.
          if (!(await this.dequeue(item.id))) {
            results.reason = 'storage_unavailable';
            break;
          }
          results.processed++;

          logger.log('[OfflineQueue] ✅ 请求成功: [省略]');
        } catch (error) {
          const status = checkSession(item.session);
          if (status === 'unavailable' || isSessionUnavailable(error)) {
            if (!sentReceipts.has(item.id)) item.state = previousState;
            results.reason = 'SESSION_UNAVAILABLE';
            await this._saveToStorage(item);
            break;
          }
          release();
          if (status === 'changed') {
            if (!(await this.dequeue(item.id))) {
              results.reason = 'storage_unavailable';
              break;
            }
            continue;
          }
          logger.error('[OfflineQueue] ❌ 请求失败: [省略]', error);

          item.retryCount++;
          item.state = QUEUE_STATE.RETRY;
          results.reason = 'request_failed';
          results.errors.push({
            id: item.id,
            error: error.message || error
          });

          results.failed++;
          await this._saveToStorage(item);
        } finally {
          release();
        }

        // 请求间隔，避免过快
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    } finally {
      this.processing = false;
    }

    logger.log('[OfflineQueue] 📊 队列处理完成: 成功 [省略], 失败 [省略]');

    this._notifyListeners({
      type: 'processComplete',
      results
    });

    return {
      success: !results.reason,
      ...results
    };
  }

  /**
   * 清空队列
   */
  clear() {
    const results = this.queue.map((item) => this.dequeue(item.id));
    const finish = (values) => {
      this._notifyListeners({ type: 'clear', queueLength: this.queue.length });
      return values.every(Boolean);
    };
    return results.some((result) => result?.then) ? Promise.all(results).then(finish) : finish(results);
  }

  /**
   * 获取队列状态
   * @returns {Object} 队列状态
   */
  getStatus() {
    return {
      queueLength: this.queue.length,
      isProcessing: this.processing,
      isOnline: this.isOnline,
      items: this.queue.map((item) => ({
        id: item.id,
        priority: item.priority,
        timestamp: item.timestamp,
        retryCount: item.retryCount,
        state: item.state,
        age: Date.now() - item.timestamp
      }))
    };
  }

  /**
   * 添加监听器
   * @param {Function} listener - 监听函数
   * @returns {Function} 取消监听函数
   */
  addListener(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * 暂停队列处理
   */
  pause() {
    // [AUDIT FIX] 使用独立 paused 标志，避免与 processQueue 的 processing 标志冲突
    this.paused = true;
    logger.log('[OfflineQueue] 队列处理已暂停');
  }

  /**
   * 恢复队列处理
   */
  resume() {
    this.paused = false;
    logger.log('[OfflineQueue] 队列处理已恢复');

    // 如果在线且有待处理请求，自动开始处理
    if (this.isOnline && (this.queue.length > 0 || !this._storageLoaded)) {
      this.processQueue();
    }
  }
}

// 创建单例
const offlineQueue = new OfflineQueue();

// 导出
export { offlineQueue, OfflineQueue };
export default offlineQueue;
