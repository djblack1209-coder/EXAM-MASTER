/**
 * ✅ B003: 成就系统管理云函数
 *
 * 功能：
 * 1. 获取成就列表 (getAll) - 包含已解锁和未解锁
 * 2. 解锁成就 (unlock)
 * 3. 检查成就条件 (check) - 根据用户数据自动检测可解锁成就
 * 4. 获取用户已解锁成就 (getUnlocked)
 *
 * @version 1.0.0
 */

import cloud from '@lafjs/cloud';
import { verifyJWT } from './login';
import { extractBearerToken } from './_shared/auth';
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
} from './_shared/api-response';

const db = cloud.database();
const _ = db.command;

function extractToken(ctx: any): string {
  const rawToken = ctx?.headers?.authorization || ctx?.headers?.Authorization;
  return extractBearerToken(rawToken);
}

// ==================== 成就定义 ====================
const ACHIEVEMENTS = [
  // 学习里程碑
  {
    id: 'first_login',
    name: '初来乍到',
    description: '首次登录应用',
    icon: '🎉',
    category: 'milestone',
    condition: { type: 'login_count', value: 1 }
  },
  {
    id: 'study_3_days',
    name: '三天打鱼',
    description: '累计学习3天',
    icon: '📅',
    category: 'milestone',
    condition: { type: 'total_study_days', value: 3 }
  },
  {
    id: 'study_7_days',
    name: '一周坚持',
    description: '累计学习7天',
    icon: '🗓️',
    category: 'milestone',
    condition: { type: 'total_study_days', value: 7 }
  },
  {
    id: 'study_30_days',
    name: '月度学霸',
    description: '累计学习30天',
    icon: '📆',
    category: 'milestone',
    condition: { type: 'total_study_days', value: 30 }
  },
  {
    id: 'study_100_days',
    name: '百日冲刺',
    description: '累计学习100天',
    icon: '💯',
    category: 'milestone',
    condition: { type: 'total_study_days', value: 100 }
  },

  // 刷题成就
  {
    id: 'first_question',
    name: '初试牛刀',
    description: '完成第1道题',
    icon: '✏️',
    category: 'practice',
    condition: { type: 'total_questions', value: 1 }
  },
  {
    id: 'questions_50',
    name: '小试身手',
    description: '累计完成50道题',
    icon: '📝',
    category: 'practice',
    condition: { type: 'total_questions', value: 50 }
  },
  {
    id: 'questions_200',
    name: '刷题达人',
    description: '累计完成200道题',
    icon: '🎯',
    category: 'practice',
    condition: { type: 'total_questions', value: 200 }
  },
  {
    id: 'questions_500',
    name: '题海战术',
    description: '累计完成500道题',
    icon: '🏊',
    category: 'practice',
    condition: { type: 'total_questions', value: 500 }
  },
  {
    id: 'questions_1000',
    name: '千题斩',
    description: '累计完成1000道题',
    icon: '⚔️',
    category: 'practice',
    condition: { type: 'total_questions', value: 1000 }
  },

  // 正确率成就
  {
    id: 'accuracy_60',
    name: '及格万岁',
    description: '正确率达到60%',
    icon: '✅',
    category: 'accuracy',
    condition: { type: 'accuracy', value: 60 }
  },
  {
    id: 'accuracy_80',
    name: '优秀学员',
    description: '正确率达到80%',
    icon: '🌟',
    category: 'accuracy',
    condition: { type: 'accuracy', value: 80 }
  },
  {
    id: 'accuracy_95',
    name: '学神降临',
    description: '正确率达到95%',
    icon: '👑',
    category: 'accuracy',
    condition: { type: 'accuracy', value: 95 }
  },

  // 连续学习成就
  {
    id: 'streak_3',
    name: '三连击',
    description: '连续学习3天',
    icon: '🔥',
    category: 'streak',
    condition: { type: 'streak_days', value: 3 }
  },
  {
    id: 'streak_7',
    name: '周周不断',
    description: '连续学习7天',
    icon: '🔥',
    category: 'streak',
    condition: { type: 'streak_days', value: 7 }
  },
  {
    id: 'streak_30',
    name: '铁杵磨针',
    description: '连续学习30天',
    icon: '💪',
    category: 'streak',
    condition: { type: 'streak_days', value: 30 }
  },

  // 错题相关
  {
    id: 'first_mistake_mastered',
    name: '知错能改',
    description: '首次掌握一道错题',
    icon: '🔄',
    category: 'mistake',
    condition: { type: 'mastered_mistakes', value: 1 }
  },
  {
    id: 'mistakes_mastered_10',
    name: '错题克星',
    description: '掌握10道错题',
    icon: '🎖️',
    category: 'mistake',
    condition: { type: 'mastered_mistakes', value: 10 }
  },
  {
    id: 'mistakes_mastered_50',
    name: '错题终结者',
    description: '掌握50道错题',
    icon: '🏆',
    category: 'mistake',
    condition: { type: 'mastered_mistakes', value: 50 }
  },

  // 社交成就
  {
    id: 'first_pk',
    name: '初次交锋',
    description: '完成第1次PK对战',
    icon: '⚡',
    category: 'social',
    condition: { type: 'pk_count', value: 1 }
  },
  {
    id: 'pk_win_5',
    name: '五连胜',
    description: 'PK对战赢5次',
    icon: '🏅',
    category: 'social',
    condition: { type: 'pk_wins', value: 5 }
  }
];

export default async function (ctx) {
  const startTime = Date.now();
  const requestId = generateRequestId('ach');

  try {
    const { action, userId: requestUserId, data } = ctx.body || {};

    if (!action || typeof action !== 'string') {
      return wrapResponse(badRequest('action 不能为空'), requestId, startTime);
    }

    // 成就数据属于用户私有数据，所有操作均要求认证
    const rawToken = extractToken(ctx);
    if (!rawToken) {
      return wrapResponse(unauthorized('请先登录：缺少认证令牌'), requestId, startTime);
    }

    const payload = verifyJWT(rawToken);
    if (!payload || !validateUserId(payload.userId)) {
      return wrapResponse(unauthorized('登录已过期，请重新登录'), requestId, startTime);
    }

    const userId = payload.userId;
    if (requestUserId && requestUserId !== userId) {
      logger.warn(`[${requestId}] 检测到 userId 不匹配，已使用 token 用户ID`);
    }

    // 频率限制
    const rateLimit = checkRateLimit(`ach_${userId}`, 30, 60000);
    if (!rateLimit.allowed) {
      return wrapResponse(
        { code: 429, success: false, message: '请求过于频繁', timestamp: Date.now() },
        requestId,
        startTime
      );
    }

    const handlers = {
      getAll: handleGetAll,
      getUnlocked: handleGetUnlocked,
      unlock: handleUnlock,
      check: handleCheck
    };

    const handler = handlers[action];
    if (!handler) {
      return wrapResponse(badRequest(`不支持的操作: ${action}`), requestId, startTime);
    }

    const result = await handler(userId, data || {}, requestId);
    return wrapResponse(result, requestId, startTime);
  } catch (error) {
    logger.error(`[${requestId}] 成就系统异常:`, error);
    return wrapResponse(serverError('服务器内部错误'), requestId, startTime);
  }
}

// ==================== 获取所有成就（含解锁状态） ====================
async function handleGetAll(userId: string, _data: Record<string, unknown>, _requestId: string) {
  // 获取用户已解锁的成就
  const user = await db.collection('users').doc(userId).get();
  const unlockedIds = new Set((user.data?.achievements || []).map((a: Record<string, unknown>) => a.id));

  // 合并成就列表
  const allAchievements = ACHIEVEMENTS.map((ach) => ({
    ...ach,
    unlocked: unlockedIds.has(ach.id),
    unlocked_at: user.data?.achievements?.find((a: Record<string, unknown>) => a.id === ach.id)?.unlocked_at || null
  }));

  // 按类别分组
  const categories = {};
  for (const ach of allAchievements) {
    if (!categories[ach.category]) {
      categories[ach.category] = { category: ach.category, achievements: [], unlocked: 0, total: 0 };
    }
    categories[ach.category].achievements.push(ach);
    categories[ach.category].total++;
    if (ach.unlocked) categories[ach.category].unlocked++;
  }

  return success(
    {
      achievements: allAchievements,
      categories: Object.values(categories),
      summary: {
        total: ACHIEVEMENTS.length,
        unlocked: unlockedIds.size,
        percentage: Math.round((unlockedIds.size / ACHIEVEMENTS.length) * 100)
      }
    },
    '获取成功'
  );
}

// ==================== 获取已解锁成就 ====================
async function handleGetUnlocked(userId: string, _data: Record<string, unknown>, _requestId: string) {
  const user = await db.collection('users').doc(userId).get();
  const userAchievements = user.data?.achievements || [];

  // 补充成就详情
  const unlocked = userAchievements.map((ua: Record<string, unknown>) => {
    const def = ACHIEVEMENTS.find((a) => a.id === ua.id);
    return {
      ...ua,
      name: def?.name || ua.name || '未知成就',
      description: def?.description || '',
      icon: def?.icon || '🏆',
      category: def?.category || 'other'
    };
  });

  return success(
    {
      unlocked,
      locked: ACHIEVEMENTS.filter((a) => !userAchievements.some((ua: Record<string, unknown>) => ua.id === a.id))
    },
    '获取成功'
  );
}

// ==================== 解锁成就 ====================
async function handleUnlock(userId: string, data: Record<string, unknown>, requestId: string) {
  const { achievementId } = data;

  if (!achievementId) return badRequest('achievementId 不能为空');

  // 验证成就是否存在
  const achDef = ACHIEVEMENTS.find((a) => a.id === achievementId);
  if (!achDef) return badRequest('成就不存在');

  // 检查是否已解锁 — 使用原子条件更新防止并发重复解锁
  const now = Date.now();
  const updateResult = await db
    .collection('users')
    .where({
      _id: userId,
      'achievements.id': _.neq(achievementId)
    })
    .update({
      achievements: _.push({
        id: achievementId,
        name: achDef.name,
        icon: achDef.icon,
        unlocked_at: now
      }),
      updated_at: now
    });

  // 如果 updated === 0，说明该成就已存在（条件不匹配）
  if (updateResult.updated === 0) {
    return success({ alreadyUnlocked: true }, '成就已解锁');
  }

  logger.info(`[${requestId}] 解锁成就: ${achievementId} for user ${userId}`);

  return success(
    {
      achievement: { ...achDef, unlocked: true, unlocked_at: now },
      newlyUnlocked: true
    },
    `恭喜解锁成就: ${achDef.name}`
  );
}

// ==================== 检查可解锁成就 ====================
async function handleCheck(userId: string, _data: Record<string, unknown>, requestId: string) {
  // 获取用户数据
  const user = await db.collection('users').doc(userId).get();
  if (!user.data) return badRequest('用户不存在');

  const userData = user.data;
  const unlockedIds = new Set((userData.achievements || []).map((a: Record<string, unknown>) => a.id));

  // 获取错题掌握数
  let masteredMistakes = 0;
  try {
    const mistakeResult = await db
      .collection('mistake_book')
      .where({
        user_id: userId,
        is_mastered: true
      })
      .count();
    masteredMistakes = mistakeResult.total || 0;
  } catch (e) {
    logger.warn(`[${requestId}] 查询错题数失败:`, e.message);
  }

  // 计算正确率
  const accuracy =
    userData.total_questions > 0 ? Math.round((userData.correct_questions / userData.total_questions) * 100) : 0;

  // 构建用户指标
  const metrics = {
    total_study_days: userData.total_study_days || 0,
    total_questions: userData.total_questions || 0,
    streak_days: userData.streak_days || 0,
    accuracy,
    mastered_mistakes: masteredMistakes,
    login_count: 1, // 至少登录过1次
    pk_count: userData.pk_count || 0,
    pk_wins: userData.pk_wins || 0
  };

  // 检查每个未解锁成就
  const newlyUnlocked = [];

  for (const ach of ACHIEVEMENTS) {
    if (unlockedIds.has(ach.id)) continue;

    const { type, value } = ach.condition;
    const currentValue = metrics[type] || 0;

    if (currentValue >= value) {
      // 满足条件，自动解锁
      const now = Date.now();
      await db
        .collection('users')
        .doc(userId)
        .update({
          achievements: _.push({
            id: ach.id,
            name: ach.name,
            icon: ach.icon,
            unlocked_at: now
          }),
          updated_at: now
        });

      newlyUnlocked.push({ ...ach, unlocked_at: now });
      logger.info(`[${requestId}] 自动解锁成就: ${ach.id}`);
    }
  }

  return success(
    {
      checked: ACHIEVEMENTS.length,
      newlyUnlocked,
      metrics
    },
    newlyUnlocked.length > 0 ? `新解锁 ${newlyUnlocked.length} 个成就！` : '暂无新成就可解锁'
  );
}
