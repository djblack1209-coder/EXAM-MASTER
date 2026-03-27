/**
 * FSRS 优化器前端客户端
 *
 * 与后端 fsrs-optimizer 云函数通信，管理个性化 FSRS 参数的同步与激活。
 *
 * 导出:
 * - syncFSRSParams()       — 应用启动时调用，从后端拉取个性化参数并激活
 * - triggerOptimization()   — 触发参数优化（建议每积累 50 条新复习后调用）
 * - getReviewStats()        — 获取复习统计数据（用于学习分析页面）
 * - getOptimizationStatus() — 获取优化状态（是否可以优化、冷却时间等）
 *
 * @module fsrs-optimizer-client
 */

import { lafService } from '@/services/lafService.js';
import { loadUserParams, restoreUserParams, hasCustomParams } from './fsrs-service.js';
import { logger } from '@/utils/logger.js';

const TAG = '[FSRSOptimizer]';

/** 本地缓存键：上次同步时间戳 */
const LAST_SYNC_KEY = 'fsrs_optimizer_last_sync';

/** 同步间隔：最少 5 分钟间隔避免频繁请求 */
const SYNC_INTERVAL_MS = 5 * 60 * 1000;

// ---------------------------------------------------------------------------
// syncFSRSParams — 应用启动时同步个性化参数
// ---------------------------------------------------------------------------

/**
 * 从后端拉取用户个性化 FSRS 参数并激活到调度器
 *
 * 调用时机：App.vue onLaunch 或用户登录后
 *
 * 流程：
 * 1. 先从本地存储恢复参数（快速冷启动）
 * 2. 检查同步间隔，避免频繁请求
 * 3. 调用后端 get_params 获取最新参数
 * 4. 如果后端有个性化参数，调用 loadUserParams 激活
 *
 * @returns {Promise<boolean>} 是否成功加载了个性化参数
 */
export async function syncFSRSParams() {
  try {
    // Step 1: 先从本地恢复（无网络延迟）
    restoreUserParams();

    // Step 2: 检查同步间隔
    const lastSync = _getLastSyncTime();
    if (lastSync && Date.now() - lastSync < SYNC_INTERVAL_MS) {
      logger.log(TAG, '跳过同步，距上次同步不足 5 分钟');
      return hasCustomParams();
    }

    // Step 3: 从后端拉取
    const res = await lafService.request('/fsrs-optimizer', { action: 'get_params' });

    if (!res || res.code !== 0 || !res.data) {
      logger.warn(TAG, '获取参数失败:', res?.message || '未知错误');
      return hasCustomParams();
    }

    _setLastSyncTime(Date.now());

    // Step 4: 如果后端有个性化参数，激活
    const { w, requestRetention, hasCustomParams: hasCustom } = res.data;

    if (hasCustom && w?.length) {
      const activated = loadUserParams({ w, requestRetention });
      logger.log(TAG, '个性化参数已同步', activated ? '并激活' : '(无变化)');
      return activated;
    }

    logger.log(TAG, '后端无个性化参数，使用默认值');
    return false;
  } catch (e) {
    logger.warn(TAG, '同步参数异常:', e);
    // 即使远程失败，本地参数仍可用
    return hasCustomParams();
  }
}

// ---------------------------------------------------------------------------
// triggerOptimization — 触发参数优化
// ---------------------------------------------------------------------------

/**
 * 触发后端 FSRS 参数优化
 *
 * 建议在以下时机调用：
 * - 每积累 50 条新复习记录后（由 do-quiz 中的计数器触发）
 * - 用户在设置页面手动点击「优化记忆模型」
 *
 * @returns {Promise<{
 *   success: boolean,
 *   data?: { w: number[], requestRetention: number, metrics: object },
 *   message?: string
 * }>}
 */
export async function triggerOptimization() {
  try {
    logger.log(TAG, '开始触发参数优化...');

    const res = await lafService.request('/fsrs-optimizer', { action: 'optimize' });

    if (!res || (res.code !== 0 && res.code !== 200)) {
      const msg = res?.message || '优化请求失败';
      logger.warn(TAG, '优化失败:', msg);
      return { success: false, message: msg };
    }

    const { w, requestRetention, metrics } = res.data;

    // 优化成功后立即激活新参数
    if (w?.length) {
      loadUserParams({ w, requestRetention });
      logger.log(TAG, '优化完成，新参数已激活', {
        retention: requestRetention,
        rmse: metrics?.rmse,
        totalReviews: metrics?.totalReviews
      });
    }

    _setLastSyncTime(Date.now());

    return {
      success: true,
      data: { w, requestRetention, metrics }
    };
  } catch (e) {
    logger.warn(TAG, '优化异常:', e);
    return { success: false, message: '网络异常，请稍后重试' };
  }
}

// ---------------------------------------------------------------------------
// getReviewStats — 获取复习统计
// ---------------------------------------------------------------------------

/**
 * 获取用户的复习统计数据
 *
 * 返回数据包括：
 * - totalReviews: 总复习次数
 * - retentionRate: 全局留存率
 * - retentionByInterval: 按间隔天数的留存率（用于绘制遗忘曲线）
 * - learningCurve: 按周聚合的学习曲线
 * - ratingDistribution: 评分分布 { again, hard, good, easy }
 * - dailyReviews: 最近 30 天每日复习量
 *
 * @returns {Promise<object|null>} 统计数据对象，失败返回 null
 */
export async function getReviewStats() {
  try {
    const res = await lafService.request('/fsrs-optimizer', { action: 'get_review_stats' });

    if (!res || res.code !== 0 || !res.data) {
      logger.warn(TAG, '获取统计失败:', res?.message || '未知错误');
      return null;
    }

    return res.data;
  } catch (e) {
    logger.warn(TAG, '获取统计异常:', e);
    return null;
  }
}

// ---------------------------------------------------------------------------
// getOptimizationStatus — 获取优化状态
// ---------------------------------------------------------------------------

/**
 * 获取当前优化状态
 *
 * @returns {Promise<{
 *   canOptimize: boolean,
 *   hasCustomParams: boolean,
 *   reviewLogCount: number,
 *   minLogsRequired: number,
 *   cooldownRemaining: number,
 *   optimizeCount: number,
 *   optimizedAt: number|null
 * }|null>}
 */
export async function getOptimizationStatus() {
  try {
    const res = await lafService.request('/fsrs-optimizer', { action: 'get_params' });

    if (!res || res.code !== 0 || !res.data) {
      return null;
    }

    return {
      canOptimize: res.data.canOptimize,
      hasCustomParams: res.data.hasCustomParams,
      reviewLogCount: res.data.reviewLogCount,
      minLogsRequired: res.data.minLogsRequired,
      cooldownRemaining: res.data.cooldownRemaining,
      optimizeCount: res.data.optimizeCount,
      optimizedAt: res.data.optimizedAt
    };
  } catch (e) {
    logger.warn(TAG, '获取优化状态异常:', e);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function _getLastSyncTime() {
  try {
    const val = uni.getStorageSync(LAST_SYNC_KEY);
    return val ? Number(val) : null;
  } catch (_) {
    return null;
  }
}

function _setLastSyncTime(ts) {
  try {
    uni.setStorageSync(LAST_SYNC_KEY, String(ts));
  } catch (_) {
    // ignore
  }
}
