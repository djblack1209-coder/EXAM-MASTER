/**
 * Stats Store — 用户学习统计状态中心
 *
 * 架构：Page → Store(本文件) → API(stats.api.js) → 后端(user-stats)
 *
 * 缓存策略：
 *   - overview 数据缓存 5 分钟，避免频繁请求
 *   - 趋势数据缓存 10 分钟
 *   - 未登录时返回空数据（不报错）
 *
 * @module stores/stats
 */

import { defineStore } from 'pinia';
import { ref, shallowRef, computed } from 'vue';
import {
  getStatsOverview as apiGetOverview,
  getDailyStats as apiGetDailyStats,
  getStudyTrend as apiGetTrend,
  getRankInfo as apiGetRankInfo,
  recordStudyTime as apiRecordStudyTime,
  updateStreak as apiUpdateStreak
} from '@/services/api/domains/stats.api.js';
import { getToken } from '@/services/auth-storage.js';
import { logger } from '@/utils/logger.js';

/** 缓存过期时间（毫秒） */
const OVERVIEW_TTL = 5 * 60 * 1000; // 5分钟
const TREND_TTL = 10 * 60 * 1000; // 10分钟

export const useStatsStore = defineStore('stats', () => {
  // ==================== State ====================

  /** 综合统计概览 */
  const overview = ref(null);
  /** 每日统计数据 — shallowRef 避免深度响应开销 */
  const dailyStats = shallowRef([]);
  /** 学习趋势 */
  const trend = ref(null);
  /** 排名信息 */
  const rankInfo = ref(null);
  /** 加载状态 */
  const loading = ref(false);
  /** 错误信息 */
  const error = ref(null);

  // 缓存时间戳
  let _overviewFetchedAt = 0;
  let _trendFetchedAt = 0;

  // ==================== 内部工具 ====================

  function _isLoggedIn() {
    return !!getToken();
  }

  /** 空的统计数据（未登录或请求失败时返回） */
  function _emptyOverview() {
    return {
      totalQuestions: 0,
      correctQuestions: 0,
      accuracy: 0,
      totalStudyDays: 0,
      totalStudyMinutes: 0,
      streakDays: 0,
      lastStudyDate: null,
      totalMistakes: 0,
      masteredMistakes: 0,
      mistakeMasteryRate: 0,
      today: { questions: 0, correct: 0, studyMinutes: 0, accuracy: 0 },
      achievementCount: 0
    };
  }

  // ==================== Actions ====================

  /**
   * 获取综合统计概览（带缓存）
   * @param {boolean} [force=false] - 强制刷新（忽略缓存）
   * @returns {Promise<Object>} 统计数据
   */
  async function fetchOverview(force = false) {
    if (!_isLoggedIn()) {
      overview.value = _emptyOverview();
      return overview.value;
    }

    // 缓存未过期，直接返回
    if (!force && overview.value && Date.now() - _overviewFetchedAt < OVERVIEW_TTL) {
      return overview.value;
    }

    loading.value = true;
    error.value = null;
    try {
      const res = await apiGetOverview();
      if (res?.code === 0 && res.data) {
        overview.value = res.data;
        _overviewFetchedAt = Date.now();
        return res.data;
      }
      // 请求失败但有缓存，返回缓存
      if (overview.value) return overview.value;
      overview.value = _emptyOverview();
      return overview.value;
    } catch (err) {
      logger.warn('[StatsStore] fetchOverview 失败:', err);
      error.value = '获取统计数据失败';
      if (!overview.value) overview.value = _emptyOverview();
      return overview.value;
    } finally {
      loading.value = false;
    }
  }

  /**
   * 获取每日统计
   * @param {number} [days=7] - 查询天数
   * @returns {Promise<{stats:Array, summary:Object}>}
   */
  async function fetchDailyStats(days = 7) {
    if (!_isLoggedIn()) {
      dailyStats.value = [];
      return { stats: [], summary: {} };
    }

    loading.value = true;
    try {
      const res = await apiGetDailyStats({ days });
      if (res?.code === 0 && res.data) {
        dailyStats.value = res.data.stats || [];
        return res.data;
      }
      return { stats: dailyStats.value, summary: {} };
    } catch (err) {
      logger.warn('[StatsStore] fetchDailyStats 失败:', err);
      return { stats: dailyStats.value, summary: {} };
    } finally {
      loading.value = false;
    }
  }

  /**
   * 获取学习趋势（带缓存）
   * @param {string} [period='week'] - 'week' 或 'month'
   * @param {boolean} [force=false] - 强制刷新
   * @returns {Promise<Object>}
   */
  async function fetchTrend(period = 'week', force = false) {
    if (!_isLoggedIn()) {
      trend.value = null;
      return null;
    }

    if (!force && trend.value && Date.now() - _trendFetchedAt < TREND_TTL) {
      return trend.value;
    }

    loading.value = true;
    try {
      const res = await apiGetTrend({ period });
      if (res?.code === 0 && res.data) {
        trend.value = res.data;
        _trendFetchedAt = Date.now();
        return res.data;
      }
      return trend.value;
    } catch (err) {
      logger.warn('[StatsStore] fetchTrend 失败:', err);
      return trend.value;
    } finally {
      loading.value = false;
    }
  }

  /**
   * 获取排名信息
   * @returns {Promise<Object|null>}
   */
  async function fetchRankInfo() {
    if (!_isLoggedIn()) {
      rankInfo.value = null;
      return null;
    }

    try {
      const res = await apiGetRankInfo();
      if (res?.code === 0 && res.data) {
        rankInfo.value = res.data;
        return res.data;
      }
      return rankInfo.value;
    } catch (err) {
      logger.warn('[StatsStore] fetchRankInfo 失败:', err);
      return rankInfo.value;
    }
  }

  /**
   * 记录学习时长
   * @param {number} minutes - 学习分钟数
   * @returns {Promise<boolean>} 是否成功
   */
  async function reportStudyTime(minutes) {
    if (!_isLoggedIn() || !minutes || minutes <= 0) return false;

    try {
      const res = await apiRecordStudyTime(minutes);
      if (res?.code === 0) {
        // 更新本地缓存
        if (overview.value) {
          overview.value.totalStudyMinutes = (overview.value.totalStudyMinutes || 0) + minutes;
          if (overview.value.today) {
            overview.value.today.studyMinutes = (overview.value.today.studyMinutes || 0) + minutes;
          }
        }
        return true;
      }
      return false;
    } catch (err) {
      logger.warn('[StatsStore] reportStudyTime 失败:', err);
      return false;
    }
  }

  /**
   * 更新连续学习天数（每日首次学习时调用）
   * @returns {Promise<{streakDays:number, totalStudyDays:number}|null>}
   */
  async function reportStreak() {
    if (!_isLoggedIn()) return null;

    try {
      const res = await apiUpdateStreak();
      if (res?.code === 0 && res.data) {
        // 更新本地缓存
        if (overview.value) {
          overview.value.streakDays = res.data.streakDays;
          overview.value.totalStudyDays = res.data.totalStudyDays;
          overview.value.lastStudyDate = res.data.lastStudyDate;
        }
        return res.data;
      }
      return null;
    } catch (err) {
      logger.warn('[StatsStore] reportStreak 失败:', err);
      return null;
    }
  }

  /**
   * 清空缓存（登出时调用）
   */
  function clearCache() {
    overview.value = null;
    dailyStats.value = [];
    trend.value = null;
    rankInfo.value = null;
    _overviewFetchedAt = 0;
    _trendFetchedAt = 0;
  }

  // ==================== Computed ====================

  /** 连续学习天数 */
  const streakDays = computed(() => overview.value?.streakDays || 0);

  /** 总学习天数 */
  const totalStudyDays = computed(() => overview.value?.totalStudyDays || 0);

  /** 正确率 */
  const accuracy = computed(() => overview.value?.accuracy || 0);

  /** 今日做题数 */
  const todayQuestions = computed(() => overview.value?.today?.questions || 0);

  /** 总做题数 */
  const totalQuestions = computed(() => overview.value?.totalQuestions || 0);

  return {
    // 状态
    overview,
    dailyStats,
    trend,
    rankInfo,
    loading,
    error,
    // 计算属性
    streakDays,
    totalStudyDays,
    accuracy,
    todayQuestions,
    totalQuestions,
    // 查询
    fetchOverview,
    fetchDailyStats,
    fetchTrend,
    fetchRankInfo,
    // 写入
    reportStudyTime,
    reportStreak,
    // 工具
    clearCache
  };
});
