import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { createLearningRepository, learningRepository, LEARNING_KEY } from '@/services/learning/learning-repository.js';
import { storageService, StorageService } from '@/services/storageService.js';
import { useConversationLearningStore } from '@/stores/modules/conversation-learning.js';
const epochKey = `${LEARNING_KEY}_lifecycle`;
function pair() {
  const map = new Map();
  const storage = {
    get: (key, fallback) => structuredClone(map.get(key) ?? fallback),
    save: (key, value) => {
      map.set(key, structuredClone(value));
      return true;
    },
    remove: (key) => {
      map.delete(key);
      return true;
    }
  };
  const a = createLearningRepository(storage, () => 'u1');
  const b = createLearningRepository(storage, () => 'u1');
  a.commit({ id: 'original', type: 'conversation.start', data: { goal: '原记录' } });
  const backup = a.exportData();
  a.deleteData();
  a.commit({ id: 'current', type: 'conversation.start', data: { goal: '当前记录' } });
  return { a, b, map, storage, backup };
}
function mutate(repo, kind, backup) {
  if (kind === 'delete') repo.deleteData();
  else if (kind === 'restore') repo.restoreData(backup, repo.read().revision);
  else if (kind === 'rollback') {
    repo.commit({
      id: 'new-profile',
      type: 'profile.set',
      data: { field: 'foundation', value: '普通观察', source: 'self_report', scope: '当前任务' }
    });
    repo.rollback();
  } else if (kind === 'sync') repo.replaceSynchronized(repo.read());
  else if (kind === 'epoch-remove') repo._map.delete(epochKey);
}
describe('跨Repository生命周期撤销', () => {
  it.each(['delete', 'restore', 'rollback', 'sync'])('另一窗口%s使已捕获生命周期失效，重建实例仍能继续', (kind) => {
    const { a, b, map, storage, backup } = pair();
    const before = a.lifecycleRevision();
    mutate(b, kind, backup);
    expect(a.lifecycleRevision()).not.toBe(before);
    expect(map.get(epochKey)).toMatchObject({ owner: 'u1', contract: 'learning-lifecycle-v1' });
    const fresh = createLearningRepository(storage, () => 'u1');
    expect(fresh.read()).toEqual(a.read());
  });
  it('普通学习写入与重复备份恢复不撤销生命周期', () => {
    const { a, b } = pair();
    const before = a.lifecycleRevision();
    b.commit({
      id: 'profile',
      type: 'profile.set',
      data: { field: 'foundation', value: '普通观察', source: 'self_report', scope: '当前任务' }
    });
    b.restoreData(b.exportData(), b.read().revision);
    expect(a.lifecycleRevision()).toBe(before);
  });
  it('同账户清除后恢复原记录仍不同于旧上下文，标记不进入备份', () => {
    const { a, b, backup } = pair();
    const before = a.lifecycleRevision();
    b.deleteData();
    b.restoreData(backup, b.read().revision);
    expect(a.lifecycleRevision()).not.toBe(before);
    expect(a.exportData()).not.toContain('learning-lifecycle-v1');
    expect(a.exportData()).not.toContain('generation');
  });
  it('完整账户清理移除标记也撤销旧动作，首次读取不写元信息', () => {
    const { a, map } = pair();
    const before = a.lifecycleRevision();
    map.delete(epochKey);
    expect(a.lifecycleRevision()).not.toBe(before);
    const empty = pair();
    empty.map.clear();
    empty.a.read();
    expect(empty.map.size).toBe(0);
  });
  it.each(['delete', 'restore', 'rollback', 'sync'])('共享标记保存失败时%s不修改事实或恢复副本', (kind) => {
    const { a, b, storage, map, backup } = pair();
    const before = structuredClone(map);
    const save = storage.save;
    storage.save = (key, value) => (key === epochKey ? false : save(key, value));
    expect(() => mutate(b, kind, backup)).toThrow('撤销标记');
    // rollback's ordinary profile write intentionally preceded the failed restore.
    if (kind !== 'rollback') expect(map).toEqual(before);
    else expect(a.read().events.some((event) => event.id === 'new-profile')).toBe(true);
  });
  it.each([
    { owner: 'other', contract: 'learning-lifecycle-v1', generation: '12345678' },
    { owner: 'u1', contract: 'wrong', generation: '12345678' },
    { owner: 'u1', contract: 'learning-lifecycle-v1', generation: '' }
  ])('损坏/跨账户标记拒绝动作，不覆盖原记录', (value) => {
    const { a, map } = pair();
    const before = a.exportData();
    map.set(epochKey, value);
    expect(() => a.lifecycleRevision()).toThrow();
    expect(() => a.deleteData()).toThrow();
    map.delete(epochKey);
    expect(a.exportData()).toBe(before);
  });
  it('资料动作前检查真实租约；只读仍可读取/导出，零元信息写入', () => {
    const { storage, map } = pair();
    let denied = true;
    const lease = {
      prepare: () => (denied ? 'blocked' : 'writable'),
      assertWritable: () => {
        if (denied) throw Object.assign(new Error('另一窗口'), { code: 'OTHER_WINDOW_ACTIVE' });
      }
    };
    const repo = createLearningRepository(storage, () => 'u1', lease),
      before = structuredClone(map);
    expect(repo.read().owner).toBe('u1');
    expect(repo.exportData()).toBeTruthy();
    expect(() => repo.prepareAsyncAction()).toThrow('另一窗口');
    expect(map).toEqual(before);
    denied = false;
    expect(() => repo.prepareAsyncAction()).not.toThrow();
  });
});
let store, peer, backup;
beforeEach(() => {
  uni.clearStorageSync();
  uni.setStorageSync('EXAM_USER_ID', 'synthetic-crosswindow-owner');
  setActivePinia(createPinia());
  store = useConversationLearningStore();
  store.start('原记录');
  backup = store.exportData();
  store.deleteData();
  store.start('当前记录');
  store.materialConnection = {
    endpoint: 'http://127.0.0.1:8765/parse',
    allowedOrigins: ['http://127.0.0.1:8765'],
    token: 'TEST_ONLY_CROSSWINDOW_MATERIAL_TOKEN_32',
    consent: true
  };
  peer = createLearningRepository(storageService, () => 'synthetic-crosswindow-owner', null);
});
afterEach(() => {
  vi.unstubAllGlobals();
  store?.$dispose();
  vi.restoreAllMocks();
});
function notify() {
  window.dispatchEvent(new StorageEvent('storage', { key: `u_synthetic-crosswindow-owner_${epochKey}` }));
}
describe('Store共享撤销标记与浏览器事件', () => {
  it.each(['delete', 'restore'])('另一Repository%s后旧健康回执不采纳', async (kind) => {
    let resolve;
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise((r) => (resolve = r)))
    );
    const p = store.checkMaterialConnection(),
      rejected = expect(p).rejects.toMatchObject({ code: 'CONTEXT_CHANGED' });
    mutate(peer, kind, backup);
    resolve({
      ok: true,
      text: async () =>
        JSON.stringify({ success: true, data: { version: 'isolated-parser', pdfText: true, pagePreview: true } })
    });
    await rejected;
  });
  it.each(['delete', 'restore'])('另一Repository%s后Storage事件主动取消旧解析且不保存迟到资料', async (kind) => {
    let resolve;
    const transport = vi.fn(() => new Promise((r) => (resolve = r)));
    vi.stubGlobal('fetch', transport);
    const p = store.importFile({ name: 'synthetic.pdf', size: 4, contentBase64: 'dGVzdA==' });
    const rejected = expect(p).rejects.toMatchObject({ code: expect.stringMatching(/^(CANCELLED|CONTEXT_CHANGED)$/) });
    mutate(peer, kind, backup);
    notify();
    expect(transport.mock.calls[0][1].signal.aborted).toBe(true);
    resolve({
      ok: true,
      text: async () =>
        JSON.stringify({
          success: true,
          data: {
            id: 'late',
            fingerprint: 'late',
            scope: 'private',
            segments: [{ id: 'one', content: '迟到资料' }],
            totalPages: 1,
            nextPage: null
          }
        })
    });
    await rejected;
    expect(learningRepository.read().materials).toHaveLength(0);
  });
  it('资料动作写入权被拒绝时正文零传输、不锁busy', async () => {
    const transport = vi.fn();
    vi.stubGlobal('fetch', transport);
    vi.spyOn(learningRepository, 'assertWriteAccess').mockImplementation(() => {
      throw Object.assign(new Error('另一窗口'), { code: 'OTHER_WINDOW_ACTIVE' });
    });
    await expect(store.importFile({ name: 'synthetic.pdf', size: 4, contentBase64: 'dGVzdA==' })).rejects.toMatchObject(
      { code: 'OTHER_WINDOW_ACTIVE' }
    );
    expect(transport).not.toHaveBeenCalled();
    expect(store.materialBusy).toBe(false);
  });
  it('不同账户Storage事件不刷新或撤销当前上下文', () => {
    const context = store.materialContext(),
      before = store.state;
    window.dispatchEvent(new StorageEvent('storage', { key: `u_someone_else_${epochKey}` }));
    expect(store.state).toBe(before);
    expect(store.materialContext()).toBe(context);
  });
});

describe('H5兼容存储不缓存跨窗口学习根及标记', () => {
  it('另一个窗口写入/移除兼容localStorage后读到最新值', () => {
    localStorage.clear();
    vi.stubGlobal('uni', undefined);
    vi.stubGlobal('wx', undefined);
    const service = new StorageService();
    expect(
      service.save(
        epochKey,
        { owner: 'guest', contract: 'learning-lifecycle-v1', generation: 'initial_12345678' },
        true
      )
    ).toBe(true);
    expect(service.get(epochKey).generation).toBe('initial_12345678');
    const key = Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i)).find((key) =>
      key.endsWith(epochKey)
    );
    expect(key).toBeTruthy();
    localStorage.setItem(
      key,
      JSON.stringify({ value: { owner: 'guest', contract: 'learning-lifecycle-v1', generation: 'peer_123456789' } })
    );
    expect(service.get(epochKey).generation).toBe('peer_123456789');
    localStorage.removeItem(key);
    expect(service.get(epochKey, null)).toBeNull();
  });
});

describe('标记初始化与只读上下文', () => {
  it('首次资料动作初始化不改变本窗口记录身份，标记不携带正文或凭据', () => {
    const map = new Map(),
      storage = {
        get: (key, fallback) => map.get(key) ?? fallback,
        save: (key, value) => {
          map.set(key, structuredClone(value));
          return true;
        },
        remove: () => true
      };
    const repo = createLearningRepository(storage, () => 'u1');
    const before = repo.lifecycleContext();
    repo.prepareAsyncAction();
    expect(repo.lifecycleContext()).toEqual(before);
    expect([...map.keys()]).toEqual([epochKey]);
    expect(Object.keys(map.get(epochKey)).sort()).toEqual(['contract', 'generation', 'owner']);
  });
  it('首次初始化保存失败不生成学习事实或改变生命周期', () => {
    const repo = createLearningRepository(
      { get: (_key, fallback) => fallback, save: () => false, remove: () => true },
      () => 'u1'
    );
    expect(() => repo.prepareAsyncAction()).toThrow('撤销标记');
    expect(repo.lifecycleRevision()).toBe(0);
  });
  it('损坏共享标记时健康与解析都零传输，不在watch中抛异常', async () => {
    const transport = vi.fn();
    vi.stubGlobal('fetch', transport);
    storageService.save(
      epochKey,
      { owner: 'someone-else', contract: 'learning-lifecycle-v1', generation: '12345678' },
      true
    );
    notify();
    expect(store.materialContext()).toBeNull();
    await expect(store.checkMaterialConnection()).rejects.toMatchObject({ code: 'CONTEXT_CHANGED' });
    await expect(store.importFile({ name: 'synthetic.pdf', size: 4, contentBase64: 'dGVzdA==' })).rejects.toThrow();
    expect(transport).not.toHaveBeenCalled();
    expect(store.materialBusy).toBe(false);
  });
  it('真实根Storage事件刷新删除后的事实；普通学习事件保持文件许可', () => {
    const before = store.materialContext();
    peer.commit({
      id: 'profile-peer',
      type: 'profile.set',
      data: { field: 'foundation', value: '普通观察', source: 'self_report', scope: '当前任务' }
    });
    window.dispatchEvent(new StorageEvent('storage', { key: `u_synthetic-crosswindow-owner_${LEARNING_KEY}` }));
    expect(store.materialContext()).toBe(before);
    expect(store.state.events.some((event) => event.id === 'profile-peer')).toBe(true);
    peer.deleteData();
    window.dispatchEvent(new StorageEvent('storage', { key: `u_synthetic-crosswindow-owner_${LEARNING_KEY}` }));
    expect(store.state.events).toHaveLength(0);
    expect(store.materialContext()).not.toBe(before);
  });
  it('Store卸载移除Storage监听，迟到事件不刷新旧实例', () => {
    const before = store.state;
    store.$dispose();
    peer.deleteData();
    notify();
    expect(store.state).toBe(before);
  });
});
