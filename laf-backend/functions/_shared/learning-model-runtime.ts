// 进程内快速取消；跨进程仍读同一用户成本账，不依赖全局response或前端已取消声明。
import crypto from 'node:crypto';
import { ProviderError } from './ai-providers/learning-provider.js';
import { eraseModelResultCache, mutateAccount } from './learning-account.js';
const active = new Map<string, AbortController>();
const key = (owner: string, id: string) =>
  crypto
    .createHash('sha256')
    .update(JSON.stringify([owner, id]))
    .digest('hex');
export function cancelActiveLearningCall(owner: string, id: string) {
  active.get(key(owner, id))?.abort(new ProviderError('CANCELLED', '用户已取消模型任务'));
}
export async function eraseLearningModelResultCache(db: any, owner: string) {
  const accountId = `learning_${crypto.createHash('sha256').update(owner).digest('hex')}`;
  const existing = (await db.collection('learning_accounts').where({ _id: accountId, user_id: owner }).get()).data?.[0];
  if (!existing) return { erasedResults: 0, cancellationRecorded: 0 };
  const result = await mutateAccount(db, owner, (account) => eraseModelResultCache(account));
  for (const id of result.pendingRequests) cancelActiveLearningCall(owner, id);
  return { erasedResults: result.erasedResults, cancellationRecorded: result.pendingRequests.length };
}
export function controlLearningCall(db: any, owner: string, id: string, response?: any) {
  if (active.size >= 128) throw new ProviderError('RESOURCE_LIMIT', '模型执行并发达到安全上限');
  const executionKey = key(owner, id),
    controller = new AbortController();
  if (active.has(executionKey)) throw new ProviderError('IDEMPOTENCY_CONFLICT', '模型请求已在执行');
  active.set(executionKey, controller);
  const close = () => {
    if (!response.writableEnded) controller.abort(new ProviderError('CANCELLED', '模型客户端已断开'));
  };
  response?.once?.('close', close);
  if (response?.destroyed) controller.abort(new ProviderError('CANCELLED', '模型客户端已断开'));
  let timer: ReturnType<typeof setTimeout>,
    stopped = false;
  async function checkCancellation() {
    if (stopped || controller.signal.aborted) return;
    try {
      const accountId = `learning_${crypto.createHash('sha256').update(owner).digest('hex')}`;
      const row = (await db.collection('learning_accounts').where({ _id: accountId, user_id: owner }).get()).data?.[0];
      const call = row?.calls.find((c: any) => c.id === id);
      if (!call || call.status !== 'reserved' || call.cancelRequestedAt)
        controller.abort(new ProviderError('CANCELLED', '模型任务已取消或结束'));
    } catch {
      controller.abort(new ProviderError('ACCOUNT_UNAVAILABLE', '无法确认模型任务预算状态'));
    } // 无法检查预算/取消时停止新增输出，不无限轮询。
    if (!stopped && !controller.signal.aborted) timer = setTimeout(() => void checkCancellation(), 500);
  }
  return {
    signal: controller.signal,
    async start() {
      await checkCancellation();
    },
    stop() {
      stopped = true;
      clearTimeout(timer);
      response?.removeListener?.('close', close);
      if (active.get(executionKey) === controller) active.delete(executionKey);
    }
  };
}
