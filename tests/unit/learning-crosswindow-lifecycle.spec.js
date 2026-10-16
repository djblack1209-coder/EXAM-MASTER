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
describe('模型列表与用量读取的实际请求生命周期', () => {
  function requests() {
    uni.setStorageSync('EXAM_TOKEN', 'fixture-only-token');
    const pending = [];
    vi.spyOn(uni, 'request').mockImplementation((options) => {
      const abort = vi.fn();
      pending.push({ ...options, abort });
      return { abort };
    });
    return pending;
  }
  const modelResult = (id = 'current-model') => ({
    success: true,
    data: { models: [{ id, provider: '合成供应商', model: id, capabilities: { structured: true } }], presets: [] }
  });
  const usageResult = {
    success: true,
    data: {
      entitlement: {
        week: '2026-10-04',
        timezone: 'Asia/Shanghai',
        policyVersion: 'fixture',
        weeklyUnits: 10,
        spent: 0,
        reserved: 0
      },
      cost: { spent: 0, reserved: 0, pending: 0 }
    }
  };
  it('连续点击只发送一次列表请求；真实等待不改变模型、共享许可或学习事实', async () => {
    const pending = requests(),
      before = store.exportData();
    store.selectedMode = 'local';
    store.modelId = 'explicit-choice';
    store.sharingAllowed = true;
    const first = store.loadModels(),
      second = store.loadModels();
    expect(store.modelListState).toMatchObject({ phase: 'loading' });
    expect(pending).toHaveLength(1);
    expect(pending[0].data).toEqual({ action: 'list' });
    pending[0].success({ data: modelResult() });
    await Promise.all([first, second]);
    expect(store.modelListState).toMatchObject({ phase: 'ready' });
    expect(store.models[0].id).toBe('current-model');
    expect(store.selectedMode).toBe('local');
    expect(store.modelId).toBe('explicit-choice');
    expect(store.sharingAllowed).toBe(true);
    expect(store.exportData()).toBe(before);
  });
  it('读取失败与明确重试分别显示状态；成功后清除旧错误，不自动重放', async () => {
    const pending = requests(),
      first = store.loadModels();
    pending[0].fail({ errMsg: 'fixture failure' });
    expect((await first).success).toBe(false);
    expect(store.modelListState).toMatchObject({ phase: 'error', message: '服务连接不可用，学习记录已保存。' });
    expect(pending).toHaveLength(1);
    const retry = store.loadModels();
    pending[1].success({ data: modelResult() });
    await retry;
    expect(store.modelListState).toMatchObject({ phase: 'ready' });
    expect(store.error).toBe('');
  });
  it.each(['models', 'usage'])('%s空回执具有明确空状态', async (kind) => {
    const pending = requests(),
      promise = kind === 'models' ? store.loadModels() : store.loadUsage();
    pending[0].success({ data: { success: true, data: kind === 'models' ? { models: [], presets: [] } : null } });
    await promise;
    expect(kind === 'models' ? store.modelListState : store.modelUsageState).toMatchObject({ phase: 'empty' });
    expect(store.usage).toBeNull();
  });
  it.each([{ models: [{ id: 'broken' }] }, { models: null }, { models: [], presets: [{}] }])(
    '结构不完整的成功列表回执不会进入页面渲染：%j',
    async (data) => {
      const pending = requests(),
        promise = store.loadModels();
      pending[0].success({ data: { success: true, data } });
      expect(await promise).toMatchObject({ success: false, code: 502 });
      expect(store.models).toEqual([]);
      expect(store.modelPresets).toEqual([]);
      expect(store.modelListState.phase).toBe('error');
    }
  );
  it('不完整用量回执不出现NaN或解引用错误', async () => {
    const pending = requests(),
      promise = store.loadUsage();
    pending[0].success({ data: { success: true, data: { entitlement: {}, cost: {} } } });
    expect(await promise).toMatchObject({ success: false, code: 502 });
    expect(store.modelUsageState.phase).toBe('error');
    expect(store.usage).toBeNull();
  });
  it('取消后立即可重新读取；忽略abort的迟到旧回执不能覆盖新列表或解锁新请求', async () => {
    const pending = requests(),
      first = store.loadModels();
    const cancelled = expect(first).rejects.toMatchObject({ code: 'CANCELLED' });
    store.cancelModelReads('models');
    await cancelled;
    expect(pending[0].abort).toHaveBeenCalledOnce();
    expect(store.modelListState.phase).toBe('idle');
    const retry = store.loadModels();
    pending[0].success({ data: modelResult('late-old') });
    await Promise.resolve();
    expect(store.modelListState.phase).toBe('loading');
    expect(store.models).toEqual([]);
    pending[1].success({ data: modelResult('fresh') });
    await retry;
    expect(store.models[0].id).toBe('fresh');
  });
  it.each(['delete', 'restore'])('同账户另一窗口%s后的旧读取被拒绝', async (kind) => {
    const pending = requests(),
      promise = store.loadModels();
    const rejected = expect(promise).rejects.toMatchObject({ code: 'CONTEXT_CHANGED' });
    mutate(peer, kind, backup);
    pending[0].success({ data: modelResult('stale') });
    await rejected;
    expect(store.models).toEqual([]);
    expect(store.modelListState.phase).toBe('idle');
  });
  it('账户切走再切回仍拒绝旧列表；不依赖页面refresh恰好看到中间账户', async () => {
    const pending = requests(),
      promise = store.loadModels();
    const rejected = expect(promise).rejects.toMatchObject({ code: 'CONTEXT_CHANGED' });
    uni.setStorageSync('EXAM_USER_ID', 'synthetic-second-owner');
    learningRepository.read();
    uni.setStorageSync('EXAM_USER_ID', 'synthetic-crosswindow-owner');
    pending[0].success({ data: modelResult('old-account') });
    await rejected;
    expect(store.models).toEqual([]);
  });
  it.each(['same-window', 'encrypted-storage', 'compat-encrypted-storage', 'token-removal'])(
    'actual encrypted login revokes an in-flight read on %s and rejects its late result',
    async (change) => {
      const pending = requests();
      storageService.save('EXAM_USER_ID', 'synthetic-second-owner', true);
      const peerIdentity = uni.getStorageSync('_enc_EXAM_USER_ID');
      storageService.save('EXAM_USER_ID', 'synthetic-crosswindow-owner', true);
      storageService.save('EXAM_TOKEN', 'synthetic-encrypted-lifecycle-token', true);
      expect(uni.getStorageSync('EXAM_USER_ID')).toBe('');
      const before = store.exportData();
      const promise = store.loadModels();
      const rejected = expect(promise).rejects.toMatchObject({ code: 'CONTEXT_CHANGED' });
      if (change === 'same-window') storageService.save('EXAM_USER_ID', 'synthetic-second-owner', true);
      else if (change === 'token-removal') storageService.remove('EXAM_TOKEN', true);
      else {
        uni.setStorageSync('_enc_EXAM_USER_ID', peerIdentity);
        window.dispatchEvent(
          new StorageEvent('storage', {
            key: change === 'encrypted-storage' ? '_enc_EXAM_USER_ID' : '__exam_storage__:_enc_EXAM_USER_ID'
          })
        );
      }
      expect(pending[0].abort).toHaveBeenCalledOnce();
      await rejected;
      // Even an A -> B -> A change and an adapter that ignores abort cannot revive the old read.
      storageService.save('EXAM_USER_ID', 'synthetic-crosswindow-owner', true);
      pending[0].success({ data: modelResult('late-old-account') });
      await Promise.resolve();
      expect(store.models).toEqual([]);
      expect(store.modelListState.phase).toBe('idle');
      expect(store.exportData()).toBe(before);
    }
  );
  it('普通学习写入保持读取许可；列表和用量互不取消，取消列表后用量仍可完成', async () => {
    const pending = requests(),
      list = store.loadModels(),
      usage = store.loadUsage();
    const rejected = expect(list).rejects.toMatchObject({ code: 'CANCELLED' });
    peer.commit({
      id: 'ordinary-profile',
      type: 'profile.set',
      data: { field: 'foundation', value: '正常观察', source: 'self_report', scope: '当前任务' }
    });
    notify();
    expect(pending.every((request) => request.abort.mock.calls.length === 0)).toBe(true);
    store.cancelModelReads('models');
    await rejected;
    expect(store.modelUsageState.phase).toBe('loading');
    pending[1].success({ data: usageResult });
    await usage;
    expect(store.usage.entitlement.weeklyUnits).toBe(10);
    expect(store.modelUsageState.phase).toBe('ready');
  });
  it('Store销毁终止读取，忽略取消的回执不更新旧实例', async () => {
    const pending = requests(),
      promise = store.loadUsage();
    const rejected = expect(promise).rejects.toMatchObject({ code: 'CANCELLED' });
    store.$dispose();
    await rejected;
    pending[0].success({ data: usageResult });
    await Promise.resolve();
    expect(store.usage).toBeNull();
    expect(pending[0].abort).toHaveBeenCalledOnce();
  });
  it('未登录可继续本地学习；读取提示登录且零网络请求', async () => {
    uni.removeStorageSync('EXAM_TOKEN');
    const transport = vi.spyOn(uni, 'request');
    await expect(store.loadModels()).resolves.toMatchObject({ success: false, code: 401 });
    expect(store.modelListState).toMatchObject({
      phase: 'error',
      message: '登录后可继续，本机记录保留。'
    });
    expect(transport).not.toHaveBeenCalled();
    expect(store.selectedMode).toBe('offline');
  });
  it('共享记录不可读时主动终止读取并清除已展示的旧配置，原学习数据不被覆盖', async () => {
    const pending = requests(),
      first = store.loadModels();
    pending[0].success({ data: modelResult() });
    await first;
    const original = store.exportData(),
      reading = store.loadUsage();
    const rejected = expect(reading).rejects.toMatchObject({ code: 'CONTEXT_CHANGED' });
    const read = vi.spyOn(learningRepository, 'read').mockImplementation(() => {
      throw new Error('fixture storage unavailable');
    });
    notify();
    await rejected;
    expect(pending[1].abort).toHaveBeenCalledOnce();
    expect(store.models).toEqual([]);
    expect(store.usage).toBeNull();
    expect(store.modelUsageState.phase).toBe('idle');
    read.mockRestore();
    expect(store.exportData()).toBe(original);
  });
});
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
