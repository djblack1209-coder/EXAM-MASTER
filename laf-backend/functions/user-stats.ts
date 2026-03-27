/**
 * ✅ B004: 用户统计数据云函数
 *
 * 功能：
 * 1. 获取综合统计 (getOverview) - 总题数、正确率、学习天数等
 * 2. 获取每日统计 (getDailyStats) - 指定日期范围的每日数据
 * 3. 获取学习趋势 (getTrend) - 近7/30天趋势
 * 4. 记录学习时长 (recordStudyTime)
 * 5. 更新连续学习天数 (updateStreak)
 * 6. 获取排名数据 (getRankInfo)
 *
 * @version 1.0.0
 */

import cloud from '@lafjs/cloud';
import { requireAuth, isAuthError } from './_shared/auth-middleware.js';
import {
  success,
  badRequest,
  unauthorized,
  serverError,
  validateUserId,
  checkRateLimit,
  logger,
  generateRequestId,
  wrapResponse
} from './_shared/api-response.js';

const db = cloud.database();
const _ = db.command;

export default async function (ctx) {
  const startTime = Date.now();
  const requestId = generateRequestId('stats');

  try {
    const { action, userId: requestUserId, data } = ctx.body || {};

    if (!action || typeof action !== 'string') {
      return wrapResponse(badRequest('action 不能为空'), requestId, startTime);
    }

    // JWT 验证：所有操作都必须提供有效 token
    const authResult = requireAuth(ctx);
    if (isAuthError(authResult)) {
      return wrapResponse(authResult, requestId, startTime);
    }

    const userId = authResult.userId;
    if (requestUserId && requestUserId !== userId) {
      logger.warn(`[${requestId}] 检测到 userId 不匹配，已使用 token 用户ID`);
    }

    // 频率限制
    const rateLimit = checkRateLimit(`stats_${userId}`, 60, 60000);
    if (!rateLimit.allowed) {
      return wrapResponse(
        { code: 429, success: false, message: '请求过于频繁', timestamp: Date.now() },
        requestId,
        startTime
      );
    }

    const handlers = {
      getOverview: handleGetOverview,
      getDailyStats: handleGetDailyStats,
      getTrend: handleGetTrend,
      recordStudyTime: handleRecordStudyTime,
      updateStreak: handleUpdateStreak,
      getRankInfo: handleGetRankInfo
    };

    const handler = handlers[action];
    if (!handler) {
      return wrapResponse(badRequest(`不支持的操作: ${action}`), requestId, startTime);
    }

    const result = await handler(userId, data || {}, requestId);
    return wrapResponse(result, requestId, startTime);
  } catch (error) {
    logger.error(`[${requestId}] 用户统计异常:`, error);
    return wrapResponse(serverError('服务器内部错误'), requestId, startTime);
  }
}

// ==================== 获取综合统计 ====================
async function handleGetOverview(userId: string, _data: Record<string, unknown>, _requestId: string) {
  // 并行获取多项数据
  const [userRes, mistakeCountRes, masteredCountRes, todayStatsRes] = await Promise.all([
    db.collection('users').doc(userId).get(),
    db.collection('mistake_book').where({ user_id: userId }).count(),
    db.collection('mistake_book').where({ user_id: userId, is_mastered: true }).count(),
    getDailyRecord(userId, getTodayKey())
  ]);

  const user = userRes.data;
  if (!user) return badRequest('用户不存在');

  const totalQuestions = user.total_questions || 0;
  const correctQuestions = user.correct_questions || 0;
  const accuracy = totalQuestions > 0 ? Math.round((correctQuestions / totalQuestions) * 100) : 0;

  return success(
    {
      // 总体数据
      totalQuestions,
      correctQuestions,
      accuracy,
      totalStudyDays: user.total_study_days || 0,
      totalStudyMinutes: user.total_study_minutes || 0,
      streakDays: user.streak_days || 0,
      lastStudyDate: user.last_study_date || null,

      // 错题数据
      totalMistakes: mistakeCountRes.total || 0,
      masteredMistakes: masteredCountRes.total || 0,
      mistakeMasteryRate:
        mistakeCountRes.total > 0 ? Math.round(((masteredCountRes.total || 0) / mistakeCountRes.total) * 100) : 0,

      // 今日数据
      today: {
        questions: todayStatsRes?.questions || 0,
        correct: todayStatsRes?.correct || 0,
        studyMinutes: todayStatsRes?.study_minutes || 0,
        accuracy:
          todayStatsRes?.questions > 0 ? Math.round(((todayStatsRes?.correct || 0) / todayStatsRes.questions) * 100) : 0
      },

      // 成就数量
      achievementCount: (user.achievements || []).length
    },
    '获取成功'
  );
}

// ==================== 获取每日统计 ====================
async function handleGetDailyStats(userId: string, data: Record<string, unknown>, _requestId: string) {
  const { days = 7 } = data;
  const limitDays = Math.min(Math.max(1, Number.parseInt(String(days), 10) || 7), 90);

  // 计算日期范围
  const endDate = new Date();
  endDate.setHours(23, 59, 59, 999);
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - limitDays + 1);
  startDate.setHours(0, 0, 0, 0);

  const records = await db
    .collection('daily_stats')
    .where({
      user_id: userId,
      date: _.gte(startDate.getTime()).and(_.lte(endDate.getTime()))
    })
    .orderBy('date', 'asc')
    .limit(limitDays)
    .get();

  // 填充缺失日期
  const statsMap = new Map();
  for (const record of records.data) {
    statsMap.set(record.date_key, record);
  }

  const dailyStats = [];
  for (let i = 0; i < limitDays; i++) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    const dateKey = formatDateKey(d);
    const record = statsMap.get(dateKey);

    dailyStats.push({
      date: dateKey,
      timestamp: d.getTime(),
      questions: record?.questions || 0,
      correct: record?.correct || 0,
      studyMinutes: record?.study_minutes || 0,
      accuracy: record?.questions > 0 ? Math.round(((record?.correct || 0) / record.questions) * 100) : 0
    });
  }

  return success(
    {
      days: limitDays,
      stats: dailyStats,
      summary: {
        totalQuestions: dailyStats.reduce((s, d) => s + d.questions, 0),
        totalCorrect: dailyStats.reduce((s, d) => s + d.correct, 0),
        totalStudyMinutes: dailyStats.reduce((s, d) => s + d.studyMinutes, 0),
        activeDays: dailyStats.filter((d) => d.questions > 0 || d.studyMinutes > 0).length
      }
    },
    '获取成功'
  );
}

// ==================== 获取学习趋势 ====================
async function handleGetTrend(userId: string, data: Record<string, unknown>, requestId: string) {
  const { period = 'week' } = data;
  const days = period === 'month' ? 30 : 7;

  // 复用 getDailyStats 逻辑
  const result = await handleGetDailyStats(userId, { days }, requestId);
  if (!result.success) return result;

  const stats = result.data.stats;

  // 计算趋势
  const halfPoint = Math.floor(stats.length / 2);
  const firstHalf = stats.slice(0, halfPoint);
  const secondHalf = stats.slice(halfPoint);

  const avgFirst = firstHalf.length > 0 ? firstHalf.reduce((s, d) => s + d.questions, 0) / firstHalf.length : 0;
  const avgSecond = secondHalf.length > 0 ? secondHalf.reduce((s, d) => s + d.questions, 0) / secondHalf.length : 0;

  const trend = avgSecond > avgFirst ? 'up' : avgSecond < avgFirst ? 'down' : 'stable';
  const trendPercent = avgFirst > 0 ? Math.round(((avgSecond - avgFirst) / avgFirst) * 100) : 0;

  return success(
    {
      period,
      stats,
      trend: {
        direction: trend,
        percentage: trendPercent,
        description: trend === 'up' ? '学习量上升' : trend === 'down' ? '学习量下降' : '学习量稳定'
      },
      summary: result.data.summary
    },
    '获取成功'
  );
}

// ==================== 记录学习时长 ====================
async function handleRecordStudyTime(userId: string, data: Record<string, unknown>, requestId: string) {
  const { minutes } = data;
  const parsedMinutes = Number.parseInt(String(minutes), 10);

  if (!Number.isFinite(parsedMinutes) || parsedMinutes <= 0) {
    return badRequest('minutes 必须大于0');
  }

  const safeMinutes = Math.min(parsedMinutes, 480); // 最大8小时
  const dateKey = getTodayKey();
  const now = Date.now();

  // 更新每日统计
  const existing = await getDailyRecord(userId, dateKey);

  if (existing) {
    await db
      .collection('daily_stats')
      .doc(existing._id)
      .update({
        study_minutes: _.inc(safeMinutes),
        updated_at: now
      });
  } else {
    await db.collection('daily_stats').add({
      user_id: userId,
      date_key: dateKey,
      date: new Date(dateKey).getTime(),
      questions: 0,
      correct: 0,
      study_minutes: safeMinutes,
      created_at: now,
      updated_at: now
    });
  }

  // 更新用户总学习时长
  await db
    .collection('users')
    .doc(userId)
    .update({
      total_study_minutes: _.inc(safeMinutes),
      updated_at: now
    });

  logger.info(`[${requestId}] 记录学习时长: ${safeMinutes}分钟`);
  return success({ minutes: safeMinutes, dateKey }, '学习时长已记录');
}

// ==================== 更新连续学习天数 ====================
async function handleUpdateStreak(userId: string, _data: Record<string, unknown>, requestId: string) {
  const user = await db.collection('users').doc(userId).get();
  if (!user.data) return badRequest('用户不存在');

  const now = Date.now();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayTs = today.getTime();

  const lastStudyDate = user.data.last_study_date;
  let newStreak = user.data.streak_days || 0;
  let newTotalDays = user.data.total_study_days || 0;

  if (!lastStudyDate || lastStudyDate < todayTs) {
    // 今天还没记录过
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayTs = yesterday.getTime();

    if (lastStudyDate && lastStudyDate >= yesterdayTs) {
      // 昨天学习过，连续天数+1
      newStreak += 1;
    } else if (!lastStudyDate || lastStudyDate < yesterdayTs) {
      // 断了，重置为1
      newStreak = 1;
    }

    newTotalDays += 1;

    await db.collection('users').doc(userId).update({
      streak_days: newStreak,
      total_study_days: newTotalDays,
      last_study_date: todayTs,
      updated_at: now
    });

    logger.info(`[${requestId}] 更新连续学习: streak=${newStreak}, total=${newTotalDays}`);
  }

  return success(
    {
      streakDays: newStreak,
      totalStudyDays: newTotalDays,
      lastStudyDate: todayTs
    },
    '学习记录已更新'
  );
}

// ==================== 获取排名信息 ====================
async function handleGetRankInfo(userId: string, _data: Record<string, unknown>, _requestId: string) {
  const user = await db.collection('users').doc(userId).get();
  if (!user.data) return badRequest('用户不存在');

  // 获取总题数排名
  const totalQuestions = user.data.total_questions || 0;
  const higherCount = await db
    .collection('users')
    .where({
      total_questions: _.gt(totalQuestions)
    })
    .count();

  const totalUsers = await db.collection('users').count();

  const rank = (higherCount.total || 0) + 1;
  const percentile = totalUsers.total > 0 ? Math.round(((totalUsers.total - rank) / totalUsers.total) * 100) : 0;

  return success(
    {
      rank,
      totalUsers: totalUsers.total || 0,
      percentile,
      totalQuestions,
      streakDays: user.data.streak_days || 0,
      description:
        percentile >= 90
          ? '超越了90%的用户'
          : percentile >= 70
            ? '超越了70%的用户'
            : percentile >= 50
              ? '超越了50%的用户'
              : '继续加油！'
    },
    '获取成功'
  );
}

// ==================== 工具函数 ====================

function getTodayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function getDailyRecord(userId: string, dateKey: string) {
  const result = await db
    .collection('daily_stats')
    .where({
      user_id: userId,
      date_key: dateKey
    })
    .getOne();
  return result.data || null;
}
