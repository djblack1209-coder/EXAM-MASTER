/**
 * 用户统计 API
 * 职责：对接后端 user-stats 云函数，提供学习统计、趋势分析、
 *       学习时长记录、连续学习天数、排名等功能
 *
 * 后端接口：/user-stats
 * 认证方式：JWT（后端自动从 token 提取 userId）
 *
 * @module services/api/domains/stats
 */

import { logger } from '@/utils/logger.js';
import { request, normalizeError } from './_request-core.js';

const ENDPOINT = '/user-stats';

// ==================== 查询类 ====================

/**
 * 获取综合统计概览
 * 包含：总题数、正确率、学习天数、学习时长、连续天数、
 *       错题数据、今日数据、成就数量
 * @returns {Promise<{code:number, data:Object}>}
 */
export async function getStatsOverview() {
  try {
    return await request(ENDPOINT, { action: 'getOverview', data: {} });
  } catch (error) {
    logger.warn('[stats.api] 获取综合统计失败:', error);
    return normalizeError(error, '获取综合统计');
  }
}

/**
 * 获取每日统计数据
 * @param {Object} [params] - 查询参数
 * @param {number} [params.days=7] - 查询天数（1~90）
 * @returns {Promise<{code:number, data:{days:number, stats:Array, summary:Object}}>}
 */
export async function getDailyStats(params = {}) {
  try {
    return await request(ENDPOINT, { action: 'getDailyStats', data: params });
  } catch (error) {
    logger.warn('[stats.api] 获取每日统计失败:', error);
    return normalizeError(error, '获取每日统计');
  }
}

/**
 * 获取学习趋势
 * @param {Object} [params] - 查询参数
 * @param {string} [params.period='week'] - 时间周期（'week' 或 'month'）
 * @returns {Promise<{code:number, data:{period:string, stats:Array, trend:Object, summary:Object}}>}
 */
export async function getStudyTrend(params = {}) {
  try {
    return await request(ENDPOINT, { action: 'getTrend', data: params });
  } catch (error) {
    logger.warn('[stats.api] 获取学习趋势失败:', error);
    return normalizeError(error, '获取学习趋势');
  }
}

/**
 * 获取排名信息
 * @returns {Promise<{code:number, data:{rank:number, totalUsers:number, percentile:number, description:string}}>}
 */
export async function getRankInfo() {
  try {
    return await request(ENDPOINT, { action: 'getRankInfo', data: {} });
  } catch (error) {
    logger.warn('[stats.api] 获取排名信息失败:', error);
    return normalizeError(error, '获取排名信息');
  }
}

// ==================== 写入类 ====================

/**
 * 记录学习时长
 * @param {number} minutes - 学习分钟数（1~480）
 * @returns {Promise<{code:number, data:{minutes:number, dateKey:string}}>}
 */
export async function recordStudyTime(minutes) {
  try {
    return await request(ENDPOINT, {
      action: 'recordStudyTime',
      data: { minutes }
    });
  } catch (error) {
    logger.warn('[stats.api] 记录学习时长失败:', error);
    return normalizeError(error, '记录学习时长');
  }
}

/**
 * 更新连续学习天数（每日首次学习时调用）
 * @returns {Promise<{code:number, data:{streakDays:number, totalStudyDays:number, lastStudyDate:number}}>}
 */
export async function updateStreak() {
  try {
    return await request(ENDPOINT, { action: 'updateStreak', data: {} });
  } catch (error) {
    logger.warn('[stats.api] 更新连续天数失败:', error);
    return normalizeError(error, '更新连续天数');
  }
}
