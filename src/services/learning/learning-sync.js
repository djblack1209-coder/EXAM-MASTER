import { learningRequest } from '../api/domains/learning.api.js';
import {
  HISTORY_LIMITS,
  validateHistoryManifest,
  decodeHistory
} from '../../../laf-backend/functions/_shared/learning-history.js';
import {
  assert,
  applyLearningOperation,
  normalizePrivateSyncOperation,
  operationFingerprint,
  samePrivacyRedaction
} from './learning-domain.js';

function checkedRemote(result, owner) {
  assert(result?.success, 'SYNC_FAILED', result?.message || '学习同步连接不可用');
  const state = result.data?.state;
  assert(state?.owner === owner, 'OWNER_MISMATCH', '同步用户不一致');
  assert(
    state.version === 1 &&
      Number.isInteger(state.revision) &&
      state.revision >= 0 &&
      [
        'events',
        'conversations',
        'questions',
        'materials',
        'attempts',
        'plans',
        'reviews',
        'executions',
        'profile'
      ].every((key) => Array.isArray(state[key])) &&
      state.events.length <= HISTORY_LIMITS.operations &&
      JSON.stringify(state).length <= HISTORY_LIMITS.stateCharacters,
    'INVALID_RESPONSE',
    '同步数据结构无效，本机记录保留'
  );
  return state;
}
function checkSharedEvents(repository, local, remote) {
  const known = new Map(remote.events.map((event) => [event.id, event]));
  const conflicts = local.events
    .filter((event) => {
      const previous = known.get(event.id);
      if (!previous) return false;
      const normalized = normalizePrivateSyncOperation(event);
      if (samePrivacyRedaction(previous, normalized)) return false;
      return (
        previous.type !== normalized.type ||
        operationFingerprint(previous.data) !== operationFingerprint(normalized.data)
      );
    })
    .map((event) => event.id);
  if (conflicts.length) {
    repository.captureSyncConflict?.(remote, conflicts);
    assert(false, 'CONFLICT', '同一操作对应不同内容；本机与云端副本保留，可在记录与隐私中处理');
  }
  return known;
}

// 保持服务端 30 次/分钟限制；本次最多 512 请求/10 分钟，不无界重试。
function syncTransport(request, owner, signal, assertContext, onProgress) {
  const began = Date.now(),
    recent = [];
  let calls = 0;
  const check = () => {
    assertContext();
    assert(
      Date.now() - began < 600000 && calls < 512,
      'RESOURCE_LIMIT',
      '同步达到本次预算，保留本机记录；已接收操作可继续幂等补传'
    );
  };
  const wait = (ms) =>
    new Promise((resolve, reject) => {
      const abort = () => {
        clearTimeout(timer);
        signal?.removeEventListener('abort', abort);
        reject(Object.assign(new Error('同步已取消，本机记录保留'), { code: 'CANCELLED' }));
      };
      const timer = setTimeout(() => {
        signal?.removeEventListener('abort', abort);
        resolve();
      }, ms);
      if (signal?.aborted) abort();
      else signal?.addEventListener('abort', abort, { once: true });
    });
  return async (body) => {
    check();
    while (recent.length && Date.now() - recent[0] >= 61000) recent.shift();
    if (recent.length >= 24) {
      onProgress?.({ phase: '等待同步窗口', calls });
      await wait(Math.max(1, 61000 - (Date.now() - recent[0])));
      check();
      while (recent.length && Date.now() - recent[0] >= 61000) recent.shift();
    }
    recent.push(Date.now());
    calls++;
    const result = await request('/learning-sync', body, { expectedOwner: owner, signal });
    check();
    onProgress?.({
      phase: body.action === 'page' ? '读取历史分页' : body.action === 'push' ? '补传学习操作' : '读取云端记录',
      calls
    });
    return result;
  };
}
async function pullSnapshot(send, timezone, owner) {
  // 并发更新使分页失效时仅重新拉取一次；不拼接两个版本。
  for (let retry = 0; retry < 2; retry++) {
    const result = await send({ action: 'pull', timezone });
    if (!result?.data?.history) return checkedRemote(result, owner);
    assert(result.success, 'SYNC_FAILED', result.message || '同步读取失败');
    const manifest = validateHistoryManifest(result.data.history, owner),
      revision = result.data.revision;
    assert(Number.isInteger(revision) && revision >= 0, 'INVALID_RESPONSE', '同步版本无效');
    const pages = [];
    let stale = false;
    for (let offset = 0; offset < manifest.checksums.length; offset += 3) {
      const part = await send({ action: 'page', revision, generation: manifest.generation, offset, count: 3 });
      if (part?.error === 'STALE_SYNC') {
        stale = true;
        break;
      }
      const data = part?.data;
      assert(
        part?.success &&
          data?.owner === owner &&
          data.revision === revision &&
          data.generation === manifest.generation &&
          data.offset === offset &&
          Array.isArray(data.pages) &&
          data.pages.length === Math.min(3, manifest.checksums.length - offset),
        'INVALID_RESPONSE',
        '同步历史分页无效，本机记录保留'
      );
      pages.push(...data.pages);
    }
    if (!stale) return checkedRemote({ success: true, data: { state: decodeHistory(manifest, pages, owner) } }, owner);
  }
  assert(false, 'CONFLICT', '云端持续更新，未采用混合分页；请稍后重新同步');
}
function operationBatches(events) {
  const batches = [];
  let batch = [],
    size = 2;
  for (const { id, type, data, at } of events) {
    const operation = { id, type, data, at },
      length = JSON.stringify(operation).length + 1;
    assert(length <= 600000, 'RESOURCE_LIMIT', '单个同步操作超过传输上限，请分段处理；本机记录保留');
    if (batch.length && (batch.length >= 100 || size + length > 600000)) {
      batches.push(batch);
      batch = [];
      size = 2;
    }
    batch.push(operation);
    size += length;
  }
  if (batch.length) batches.push(batch);
  return batches;
}
export async function synchronizeLearning(repository, consent, request = learningRequest, { signal, onProgress } = {}) {
  assert(consent, 'CONSENT_REQUIRED', '同步会上传当前用户的对话、资料片段和学习记录，需要明确授权');
  repository.assertWriteAccess?.();
  let initial = repository.read();
  let lifecycle = repository.lifecycleRevision?.();
  const assertContext = () => {
    assert(!signal?.aborted, 'CANCELLED', '同步已取消，本机记录保留；已发送批次可能已保存云端');
    assert(repository.read().owner === initial.owner, 'OWNER_MISMATCH', '用户已切换，停止旧账户同步');
    assert(repository.lifecycleRevision?.() === lifecycle, 'CONTEXT_CHANGED', '记录已删除或恢复，旧同步结果未写入');
  };
  assertContext();
  const send = syncTransport(request, initial.owner, signal, assertContext, onProgress);
  let remote = await pullSnapshot(send, initial.timezone, initial.owner);
  // 先传播隐私墓碑，绝不先把已删除资料的旧正文补传到服务器。
  const deletionOps = initial.events.filter(
    (e) => e.type === 'material.delete' && !remote.events.some((r) => r.id === e.id)
  );
  for (const operations of operationBatches(deletionOps)) {
    const result = await send({ action: 'push', operations, timezone: initial.timezone, returnSnapshot: false });
    if (result?.data?.snapshotRequired) {
      assert(result.success, 'SYNC_FAILED', result.message || '删除同步未完成');
      remote = await pullSnapshot(send, initial.timezone, initial.owner);
    } else remote = checkedRemote(result, initial.owner);
  }
  for (const event of remote.events.filter(
    (e) => e.type === 'material.delete' && !initial.events.some((local) => local.id === e.id)
  )) {
    repository.commit({ id: event.id, type: event.type, data: event.data, at: event.at });
    lifecycle = repository.lifecycleRevision?.();
    initial = repository.read();
  }
  const known = checkSharedEvents(repository, initial, remote),
    pending = initial.events.filter((e) => !known.has(e.id));
  assert(
    pending.every((e) => e.data),
    'MIGRATION_REQUIRED',
    '早期记录缺少可重放操作，请先导出复核，不覆盖记录'
  );
  let snapshotRequired = false;
  for (const operations of operationBatches(pending)) {
    const result = await send({ action: 'push', operations, timezone: initial.timezone, returnSnapshot: false });
    if (result?.data?.snapshotRequired) {
      assert(
        result.success &&
          Array.isArray(result.data.accepted) &&
          operations.every((e) => result.data.accepted.includes(e.id)),
        'INVALID_RESPONSE',
        '同步接收回执不完整，未替换本机记录'
      );
      snapshotRequired = true;
    } else {
      remote = checkedRemote(result, initial.owner);
      snapshotRequired = false;
    }
  }
  if (snapshotRequired) remote = await pullSnapshot(send, initial.timezone, initial.owner);
  const current = repository.read();
  assertContext();
  const remoteIds = checkSharedEvents(repository, current, remote);
  for (const event of current.events.filter((e) => !remoteIds.has(e.id)))
    remote = applyLearningOperation(remote, { id: event.id, type: event.type, data: event.data, at: event.at }).state;
  return repository.replaceSynchronized(remote);
}
export async function adoptRemoteConflict(repository, preview, consent, request = learningRequest, { signal } = {}) {
  assert(consent, 'CONSENT_REQUIRED', '采用云端记录需要明确确认；未合并的本机副本保留');
  const lifecycle = repository.lifecycleRevision?.(),
    current = repository.read();
  assert(current.owner === preview?.owner, 'OWNER_MISMATCH', '账户已切换，请重新预览');
  const check = () => {
    assert(!signal?.aborted, 'CANCELLED', '已取消采用云端记录');
    assert(repository.read().owner === current.owner, 'OWNER_MISMATCH', '账户已切换');
    assert(repository.lifecycleRevision?.() === lifecycle, 'CONTEXT_CHANGED', '记录已恢复或删除，未采用旧结果');
  };
  const remote = await pullSnapshot(
    syncTransport(request, current.owner, signal, check),
    current.timezone,
    current.owner
  );
  check();
  return repository.adoptConflictRemote(remote, preview);
}
