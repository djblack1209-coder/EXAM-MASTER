/**
 * 多Agent编排主云函数
 * 搬运自 OpenMAIC lib/orchestration/ 的多Agent课堂编排逻辑
 * 适配 Laf 云函数 + MongoDB 持久化
 *
 * 功能：
 * 1. start_session - 创建课堂会话
 * 2. send_message - 发送消息（推进状态机）
 * 3. get_state - 获取当前课堂状态
 * 4. end_session - 结束课堂
 *
 * @version 1.0.0
 */

import cloud from '@lafjs/cloud';
import { requireAuth, isAuthError } from './_shared/auth-middleware';
import {
  success,
  badRequest,
  unauthorized,
  serverError,
  generateRequestId,
  checkRateLimitDistributed,
  createLogger
} from './_shared/api-response';
import { ClassroomSession, Lesson } from './_shared/agents/agent-types';
import { createInitialState, advanceState } from './_shared/orchestration/state-machine';

const db = cloud.database();
const logger = createLogger('[AgentOrchestrator]');

const RATE_LIMIT_WINDOW = 60 * 1000;
const RATE_LIMIT_MAX = 30; // 每分钟30次交互

export default async function (ctx: any) {
  const requestId = generateRequestId('agent');

  try {
    // JWT 认证
    const authResult = requireAuth(ctx);
    if (isAuthError(authResult)) {
      return unauthorized('请先登录');
    }
    const userId = authResult.userId;

    // 频率限制
    const rateLimitKey = `agent-orchestrator:${userId}`;
    const rateLimit = await checkRateLimitDistributed(rateLimitKey, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW);
    if (!rateLimit.allowed) {
      return { code: 429, success: false, message: '请求过于频繁，请稍后再试', requestId };
    }

    const { action, data } = ctx.body || {};
    if (!action) {
      return badRequest('缺少 action 参数');
    }

    switch (action) {
      case 'start_session':
        return await startSession(userId, data, requestId);
      case 'send_message':
        return await sendMessage(userId, data, requestId);
      case 'get_state':
        return await getState(userId, data, requestId);
      case 'end_session':
        return await endSession(userId, data, requestId);
      default:
        return badRequest(`不支持的操作: ${action}`);
    }
  } catch (err: any) {
    logger.error(`[${requestId}] 未捕获异常:`, err.message);
    return serverError('服务异常，请稍后重试');
  }
}

// ==================== start_session ====================
async function startSession(userId: string, data: any, requestId: string) {
  const { lessonId } = data || {};
  if (!lessonId) {
    return badRequest('缺少 lessonId');
  }

  // 查询课程
  const lessonResult = await db.collection('lessons').where({ _id: lessonId, userId }).getOne();
  const lesson = lessonResult.data as Lesson | null;
  if (!lesson) {
    return { code: 404, success: false, message: '课程不存在', requestId };
  }
  if (lesson.status !== 'ready') {
    return badRequest('课程尚未生成完成');
  }
  if (!lesson.scenes || lesson.scenes.length === 0) {
    return badRequest('课程没有场景内容');
  }

  // 检查是否有未完成的会话
  const existingSession = await db
    .collection('classroom_sessions')
    .where({ lessonId, userId, completedAt: null as any })
    .getOne();

  if (existingSession.data) {
    // 恢复已有会话
    return success({
      sessionId: existingSession.data._id,
      state: existingSession.data.state,
      resumed: true
    });
  }

  // 创建新会话
  const firstScene = lesson.scenes[0];
  const sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const initialState = createInitialState(sessionId, lessonId, firstScene);

  const session: Omit<ClassroomSession, '_id'> = {
    lessonId,
    userId,
    state: initialState,
    startedAt: Date.now(),
    lastActiveAt: Date.now()
  };

  const insertResult = await db.collection('classroom_sessions').add(session);

  logger.info(`[${requestId}] 创建课堂会话: ${insertResult.id}, 课程: ${lesson.title}`);

  return success({
    sessionId: insertResult.id,
    state: initialState,
    lesson: { title: lesson.title, topic: lesson.topic, sceneCount: lesson.scenes.length },
    resumed: false
  });
}

// ==================== send_message ====================
async function sendMessage(userId: string, data: any, requestId: string) {
  const { sessionId, message } = data || {};
  if (!sessionId) {
    return badRequest('缺少 sessionId');
  }

  // 查询会话
  const sessionResult = await db.collection('classroom_sessions').doc(sessionId).get();
  const session = sessionResult.data as ClassroomSession | null;
  if (!session || session.userId !== userId) {
    return { code: 404, success: false, message: '会话不存在', requestId };
  }
  if (session.completedAt) {
    return badRequest('课堂已结束');
  }

  // 查询课程获取场景
  const lessonResult = await db.collection('lessons').doc(session.lessonId).get();
  const lesson = lessonResult.data as Lesson | null;
  if (!lesson) {
    return { code: 404, success: false, message: '课程不存在', requestId };
  }

  const currentScene = lesson.scenes[session.state.currentSceneIndex];
  if (!currentScene) {
    return badRequest('当前场景不存在');
  }

  // 推进状态机
  const { newMessage, updatedState } = await advanceState(session.state, currentScene, message || undefined);

  // 检查是否需要切换到下一个场景
  if (updatedState.phase === 'completed' && updatedState.currentSceneIndex < lesson.scenes.length - 1) {
    updatedState.currentSceneIndex += 1;
    updatedState.phase = 'lecturing';
    updatedState.turnCount = 0;
    updatedState.messages = []; // 新场景清空消息
  }

  // 持久化状态
  await db
    .collection('classroom_sessions')
    .doc(sessionId)
    .update({
      state: updatedState,
      lastActiveAt: Date.now(),
      ...(updatedState.phase === 'completed' && updatedState.currentSceneIndex >= lesson.scenes.length - 1
        ? { completedAt: Date.now() }
        : {})
    });

  logger.info(
    `[${requestId}] 课堂推进: session=${sessionId}, turn=${updatedState.turnCount}, phase=${updatedState.phase}`
  );

  return success({
    message: newMessage,
    state: {
      phase: updatedState.phase,
      turnCount: updatedState.turnCount,
      currentSceneIndex: updatedState.currentSceneIndex,
      totalScenes: lesson.scenes.length
    }
  });
}

// ==================== get_state ====================
async function getState(userId: string, data: any, requestId: string) {
  const { sessionId } = data || {};
  if (!sessionId) {
    return badRequest('缺少 sessionId');
  }

  const sessionResult = await db.collection('classroom_sessions').doc(sessionId).get();
  const session = sessionResult.data as ClassroomSession | null;
  if (!session || session.userId !== userId) {
    return { code: 404, success: false, message: '会话不存在', requestId };
  }

  return success({
    state: session.state,
    startedAt: session.startedAt,
    lastActiveAt: session.lastActiveAt,
    completedAt: session.completedAt
  });
}

// ==================== end_session ====================
async function endSession(userId: string, data: any, requestId: string) {
  const { sessionId } = data || {};
  if (!sessionId) {
    return badRequest('缺少 sessionId');
  }

  const sessionResult = await db.collection('classroom_sessions').doc(sessionId).get();
  const session = sessionResult.data as ClassroomSession | null;
  if (!session || session.userId !== userId) {
    return { code: 404, success: false, message: '会话不存在', requestId };
  }

  await db.collection('classroom_sessions').doc(sessionId).update({
    'state.phase': 'completed',
    completedAt: Date.now()
  });

  logger.info(`[${requestId}] 课堂结束: session=${sessionId}`);

  return success({ ended: true });
}
