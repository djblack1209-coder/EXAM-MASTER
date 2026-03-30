/**
 * 课程生成云函数
 * 搬运自 OpenMAIC lib/generation/ + app/api/generate/ 的两阶段生成管线
 * 适配 Laf 云函数异步生成模式
 *
 * 功能：
 * 1. create - 创建课程（异步生成）
 * 2. status - 查询生成进度
 * 3. detail - 获取课程详情
 * 4. list - 获取用户课程列表
 * 5. delete - 删除课程
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
  generateRequestId,
  checkRateLimitDistributed,
  createLogger
} from './_shared/api-response.js';
import { Lesson } from './_shared/agents/agent-types.js';
import { generateOutline, generateScene } from './_shared/generation/generation-pipeline.js';

const db = cloud.database();
const logger = createLogger('[LessonGenerator]');

const RATE_LIMIT_WINDOW = 60 * 1000;
const RATE_LIMIT_MAX = 10; // 课程生成消耗大，限制更严

export default async function (ctx: any) {
  const requestId = generateRequestId('lesson');

  try {
    const authResult = requireAuth(ctx);
    if (isAuthError(authResult)) {
      return unauthorized('请先登录');
    }
    const userId = authResult.userId;

    const rateLimitKey = `lesson-generator:${userId}`;
    const rateLimit = await checkRateLimitDistributed(rateLimitKey, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW);
    if (!rateLimit.allowed) {
      return { code: 429, success: false, message: '请求过于频繁，请稍后再试', requestId };
    }

    const { action, data } = ctx.body || {};
    if (!action) {
      return badRequest('缺少 action 参数');
    }

    switch (action) {
      case 'create':
        return await createLesson(userId, data, requestId);
      case 'status':
        return await getLessonStatus(userId, data, requestId);
      case 'detail':
        return await getLessonDetail(userId, data, requestId);
      case 'list':
        return await listLessons(userId, data, requestId);
      case 'delete':
        return await deleteLesson(userId, data, requestId);
      default:
        return badRequest(`不支持的操作: ${action}`);
    }
  } catch (err: any) {
    logger.error(`[${requestId}] 未捕获异常:`, err.message);
    return serverError('服务异常，请稍后重试');
  }
}

// ==================== create ====================
async function createLesson(userId: string, data: any, requestId: string) {
  const { topic, subject, materials, sceneCount } = data || {};
  if (!topic || !subject) {
    return badRequest('缺少 topic 或 subject');
  }

  // 限制同时生成数量
  const generating = await db.collection('lessons').where({ userId, status: 'generating' }).count();
  if (generating.total >= 3) {
    return badRequest('同时生成课程数量已达上限（3个），请等待完成后再试');
  }

  // 创建课程记录（状态：generating）
  const now = Date.now();
  const lesson: Omit<Lesson, '_id'> = {
    userId,
    title: `${subject} - ${topic}`,
    topic,
    subject,
    outline: [],
    scenes: [],
    status: 'generating',
    progress: 0,
    created_at: now,
    updated_at: now
  };

  const insertResult = await db.collection('lessons').add(lesson);
  const lessonId = String(insertResult.id);

  logger.info(`[${requestId}] 创建课程: ${lessonId}, 主题: ${topic}`);

  // 异步生成（不阻塞响应）
  generateLessonAsync(lessonId, userId, topic, subject, materials, sceneCount || 6, requestId).catch((err) => {
    logger.error(`[${requestId}] 异步生成失败: ${err.message}`);
  });

  return success({
    lessonId,
    status: 'generating',
    message: '课程生成已启动，请通过 status 接口查询进度'
  });
}

// ==================== 异步生成管线 ====================
async function generateLessonAsync(
  lessonId: string,
  _userId: string,
  topic: string,
  subject: string,
  materials: string | undefined,
  sceneCount: number,
  requestId: string
) {
  try {
    // 阶段1：生成大纲
    logger.info(`[${requestId}] 阶段1: 生成大纲...`);
    await updateProgress(lessonId, 5, 'generating');

    const outline = await generateOutline(topic, subject, materials, sceneCount);
    if (!outline || outline.length === 0) {
      throw new Error('大纲生成失败');
    }

    await db.collection('lessons').doc(lessonId).update({
      outline,
      progress: 20,
      updated_at: Date.now()
    });

    logger.info(`[${requestId}] 大纲生成完成: ${outline.length} 个章节`);

    // 阶段2：逐个生成场景内容
    const scenes = [];
    let previousContext = '';

    for (let i = 0; i < outline.length; i++) {
      const item = outline[i];
      const progress = 20 + Math.round(((i + 1) / outline.length) * 70);

      logger.info(`[${requestId}] 阶段2: 生成场景 ${i + 1}/${outline.length} - ${item.title}`);
      await updateProgress(lessonId, progress, 'generating');

      const scene = await generateScene(item, subject, topic, previousContext);
      scenes.push(scene);

      // 累积上下文（给后续场景参考）
      if (scene.type === 'slide') {
        const slideContent = scene.content as any;
        previousContext += slideContent.slides?.map((s: any) => s.body).join('\n') || '';
        // 限制上下文长度
        if (previousContext.length > 4000) {
          previousContext = previousContext.substring(previousContext.length - 4000);
        }
      }

      // 每生成一个场景就保存一次（防止中途失败丢失）
      await db.collection('lessons').doc(lessonId).update({
        scenes,
        progress,
        updated_at: Date.now()
      });
    }

    // 生成完成
    await db
      .collection('lessons')
      .doc(lessonId)
      .update({
        title: `${subject} - ${topic}`,
        scenes,
        status: 'ready',
        progress: 100,
        updated_at: Date.now()
      });

    logger.info(`[${requestId}] 课程生成完成: ${lessonId}, ${scenes.length} 个场景`);
  } catch (err: any) {
    logger.error(`[${requestId}] 课程生成失败: ${err.message}`);
    // [AUDIT FIX R277] 不存储原始错误详情到DB，仅保存用户友好提示
    await db
      .collection('lessons')
      .doc(lessonId)
      .update({
        status: 'failed',
        error: '课程生成失败，请稍后重试',
        updated_at: Date.now()
      })
      .catch((dbErr: any) => {
        // [AUDIT FIX R135] 记录状态更新失败，防止课程永久卡在 generating
        logger.error(`课程状态更新失败: ${lessonId} - ${dbErr?.message || '未知错误'}`);
      });
  }
}

async function updateProgress(lessonId: string, progress: number, status: string) {
  await db.collection('lessons').doc(lessonId).update({
    progress,
    status,
    updated_at: Date.now()
  });
}

// ==================== status ====================
async function getLessonStatus(userId: string, data: any, requestId: string) {
  const { lessonId } = data || {};
  if (!lessonId) return badRequest('缺少 lessonId');

  const result = await db
    .collection('lessons')
    .where({ _id: lessonId, userId })
    .field({ status: 1, progress: 1, error: 1, title: 1 })
    .getOne();

  if (!result.data) {
    return { code: 404, success: false, message: '课程不存在', requestId };
  }

  return success(result.data);
}

// ==================== detail ====================
async function getLessonDetail(userId: string, data: any, requestId: string) {
  const { lessonId } = data || {};
  if (!lessonId) return badRequest('缺少 lessonId');

  const result = await db.collection('lessons').where({ _id: lessonId, userId }).getOne();
  if (!result.data) {
    return { code: 404, success: false, message: '课程不存在', requestId };
  }

  return success(result.data);
}

// ==================== list ====================
async function listLessons(userId: string, data: any, _requestId: string) {
  const { page = 1, pageSize = 20 } = data || {};
  const skip = (page - 1) * pageSize;

  const [countResult, listResult] = await Promise.all([
    db.collection('lessons').where({ userId }).count(),
    db
      .collection('lessons')
      .where({ userId })
      .field({ outline: 0, scenes: 0 }) // 列表不返回大字段
      .orderBy('created_at', 'desc')
      .skip(skip)
      .limit(pageSize)
      .get()
  ]);

  return success({
    list: listResult.data,
    total: countResult.total,
    page,
    pageSize
  });
}

// ==================== delete ====================
async function deleteLesson(userId: string, data: any, requestId: string) {
  const { lessonId } = data || {};
  if (!lessonId) return badRequest('缺少 lessonId');

  const result = await db.collection('lessons').where({ _id: lessonId, userId }).getOne();
  if (!result.data) {
    return { code: 404, success: false, message: '课程不存在', requestId };
  }

  // 同时删除关联的课堂会话
  await Promise.all([
    db.collection('lessons').doc(lessonId).remove(),
    db.collection('classroom_sessions').where({ lessonId }).remove()
  ]);

  logger.info(`[${requestId}] 删除课程: ${lessonId}`);
  return success({ deleted: true });
}
