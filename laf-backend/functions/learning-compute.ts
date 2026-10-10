import cloud from '@lafjs/cloud';
import { createHash } from 'node:crypto';
import { requireAuth, isAuthError } from './_shared/auth-middleware.js';
import { checkRateLimitDistributed } from './_shared/api-response.js';
import { decodeServerHistory } from './_shared/learning-history-server.js';
import { computeSympyReference } from './_shared/learning-sympy.js';
import {
  COMPUTE_CONTRACT,
  computeScopeFor,
  sameComputeSnapshot,
  normalizeComputeReference
} from './_shared/learning-compute-contract.js';

const active = new Set<string>();
const id = (value: unknown) => typeof value === 'string' && value.length > 0 && value.length <= 160;
const failure = (code: number, error: string, message: string) => ({ code, success: false, error, message });
export default async function (ctx: any) {
  const auth = requireAuth(ctx);
  if (isAuthError(auth)) return auth;
  const owner = auth.userId;
  const limit = await checkRateLimitDistributed(`learning-compute:${owner}`, 12, 60000);
  if (!limit.allowed) return failure(429, 'RATE_LIMIT', '参考计算过于频繁，请稍后再试');
  const body = ctx.body;
  if (
    !body ||
    Object.keys(body).sort().join(',') !==
      'action,attemptId,consent,contract,conversationId,epoch,expected,questionKey' ||
    body.contract !== COMPUTE_CONTRACT ||
    body.action !== 'sympy_reference' ||
    body.consent !== true ||
    ![body.conversationId, body.questionKey, body.attemptId, body.epoch].every(id) ||
    !body.expected ||
    typeof body.expected !== 'object' ||
    JSON.stringify(body).length > 18000
  )
    return failure(400, 'INVALID_INPUT', '需确认当前题目和原答的参考计算');
  if (
    process.env.LEARNING_SYMPY_ENABLED !== 'true' ||
    !process.env.LEARNING_SYMPY_PYTHON ||
    !process.env.LEARNING_SYMPY_PACKAGES
  )
    return failure(503, 'RUNTIME_UNAVAILABLE', '当前服务尚未启用参考计算');
  if (active.size >= 2 || active.has(owner)) return failure(429, 'BUSY', '计算正在进行，请稍后再试');
  active.add(owner);
  const controller = new AbortController();
  const response = cloud.res;
  const close = () => {
    if (!response?.writableEnded) controller.abort();
  };
  response?.once?.('close', close);
  if (response?.destroyed) controller.abort();
  let timer: ReturnType<typeof setTimeout>;
  let finished = false;
  let storedRevision: number | null = null;
  const key = `learning_sync_${createHash('sha256').update(owner).digest('hex')}`;
  const collection = cloud.database().collection('learning_states');
  const query = { _id: key, user_id: owner };
  async function readContext() {
    if (controller.signal.aborted) throw Object.assign(new Error(), { code: 'CANCELLED' });
    const row = (await collection.where(query).get()).data?.[0];
    if (!row) throw Object.assign(new Error(), { code: 'NOT_SYNCED' });
    if (storedRevision !== null && row.revision !== storedRevision)
      throw Object.assign(new Error(), { code: 'CONTEXT_CHANGED' });
    const state = await decodeServerHistory(row.state, owner);
    const expected = computeScopeFor(state, body.conversationId);
    if (
      expected.questionKey !== body.questionKey ||
      expected.attemptId !== body.attemptId ||
      !sameComputeSnapshot(expected.expected, body.expected)
    )
      throw Object.assign(new Error(), { code: 'NOT_SYNCED' });
    storedRevision = row.revision;
    return { ownerId: owner, conversationId: body.conversationId, epoch: body.epoch, state };
  }
  async function monitor() {
    if (finished || controller.signal.aborted) return;
    try {
      const row = (await collection.where(query).field({ revision: true }).get()).data?.[0];
      if (!row || row.revision !== storedRevision) controller.abort();
    } catch {
      controller.abort();
    }
    if (!finished && !controller.signal.aborted) timer = setTimeout(() => void monitor(), 250);
  }
  try {
    const initial = await readContext();
    timer = setTimeout(() => void monitor(), 250);
    const result = await computeSympyReference(
      {
        ownerId: owner,
        conversationId: body.conversationId,
        questionKey: body.questionKey,
        attemptId: body.attemptId
      },
      readContext,
      { python: process.env.LEARNING_SYMPY_PYTHON, packages: process.env.LEARNING_SYMPY_PACKAGES },
      controller.signal
    );
    if (controller.signal.aborted) throw Object.assign(new Error(), { code: 'CANCELLED' });
    const reference = normalizeComputeReference(
      {
        contract: result.contract,
        requestId: result.requestId,
        questionKey: body.questionKey,
        attemptId: body.attemptId,
        source: result.source,
        result: result.result
      },
      initial.state,
      body.conversationId,
      body.questionKey
    );
    return {
      code: 0,
      success: true,
      data: {
        contract: COMPUTE_CONTRACT,
        ownerId: owner,
        conversationId: body.conversationId,
        epoch: body.epoch,
        expected: body.expected,
        reference,
        gradingAuthority: false,
        persisted: false,
        requiresHelpRecord: true
      }
    };
  } catch (error: any) {
    const code = error?.code;
    if (code === 'NOT_SYNCED') return failure(409, code, '请先同步本题和原答，再计算参考');
    if (['CANCELLED', 'STOPPED', 'CONTEXT_CHANGED', 'OWNER_CHANGED', 'ORIGINAL_ANSWER_CHANGED'].includes(code))
      return failure(409, code, '任务已变化或取消，未读取旧计算结果');
    if (['UNSUPPORTED_QUESTION', 'UNRESOLVED_QUESTION', 'PRECONDITION', 'RESOURCE_LIMIT'].includes(code))
      return failure(422, code, '本题或原答暂不支持参考计算');
    if (['TIME_LIMIT', 'MEMORY_LIMIT', 'INPUT_LIMIT', 'OUTPUT_LIMIT'].includes(code))
      return failure(422, code, '计算超出本次限额，原答保持');
    return failure(503, 'COMPUTE_UNAVAILABLE', '参考计算暂不可用，原答保持');
  } finally {
    finished = true;
    clearTimeout(timer);
    controller.abort();
    response?.removeListener?.('close', close);
    active.delete(owner);
  }
}
