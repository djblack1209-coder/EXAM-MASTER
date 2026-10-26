import cloud from '@lafjs/cloud';
import { requireAuth, isAuthError } from './_shared/auth-middleware.js';
import { requireActiveUser } from './_shared/active-user.js';
import { checkRateLimitDistributed } from './_shared/api-response.js';
import { syncLearningOperations, readLearningHistoryPages } from './_shared/learning-sync.js';
import { syncWireResult } from './_shared/learning-history-server.js';
import { eraseLearningModelResultCache } from './_shared/learning-model-runtime.js';
export default async function (ctx: any) {
  const auth = requireAuth(ctx);
  if (isAuthError(auth)) return auth;
  const inactive = await requireActiveUser(cloud.database(), auth.userId);
  if (inactive) return inactive;
  const limit = await checkRateLimitDistributed(`learning-sync:${auth.userId}`, 30, 60000);
  if (!limit.allowed) return { code: 429, success: false, message: '同步请求过于频繁' };
  try {
    const body = ctx.body || {};
    if (body.action === 'page')
      return { code: 0, success: true, data: await readLearningHistoryPages(cloud.database(), auth.userId, body) };
    if (body.action === 'delete') {
      const cache = await eraseLearningModelResultCache(cloud.database(), auth.userId);
      await cloud.database().collection('learning_states').where({ user_id: auth.userId }).remove();
      return { code: 0, success: true, data: { deleted: true, modelResultCacheDeleted: true, ...cache } };
    }
    if (!['push', 'pull'].includes(body.action)) return { code: 400, success: false, message: '同步操作不支持' };
    const result = await syncLearningOperations(
      cloud.database(),
      auth.userId,
      body.action === 'push' ? body.operations : [],
      body.timezone || 'Asia/Shanghai'
    );
    return {
      code: 0,
      success: true,
      data: syncWireResult(result, body.action === 'push' && body.returnSnapshot === false)
    };
  } catch (error: any) {
    return {
      code: error.code === 'CONFLICT' ? 409 : 422,
      success: false,
      error: error.code || 'SYNC_FAILED',
      message: '学习同步未完成，本地记录保持可用；请核对冲突或分批重试'
    };
  }
}
