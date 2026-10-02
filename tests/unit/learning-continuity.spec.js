import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { storageService } from '@/services/storageService.js';
import { useAuthStore } from '@/stores/modules/auth.js';
import { useConversationLearningStore } from '@/stores/modules/conversation-learning.js';
import { createLearningRepository, LEARNING_KEY } from '@/services/learning/learning-repository.js';
import { emptyLearningState, applyLearningOperation, summarizeLearning } from '@/services/learning/learning-domain.js';
import { synchronizeLearning, adoptRemoteConflict } from '@/services/learning/learning-sync.js';

const at = Date.now() - 10000;
const op = (state, id, type, data) => applyLearningOperation(state, { id, type, data, at }).state;
function setup(guest, initial = emptyLearningState('u1', 'Asia/Shanghai')) {
  const map = new Map([[LEARNING_KEY, initial]]);
  const storage = {
    get: (key, fallback) => (map.has(key) ? structuredClone(map.get(key)) : fallback),
    save: (key, value) => {
      map.set(key, structuredClone(value));
      return true;
    },
    remove: (key) => {
      map.delete(key);
      return true;
    },
    getGuestLearningSnapshot: () => structuredClone(guest)
  };
  return { repo: createLearningRepository(storage, () => 'u1'), map, storage };
}
function guestState() {
  let state = emptyLearningState('guest', 'Asia/Shanghai');
  state = op(state, 'guest-c', 'conversation.start', { goal: '独立计算' });
  state = op(state, 'guest-q', 'question.add', {
    question: {
      id: 'q',
      version: 1,
      scope: 'generated',
      prompt: '计算 12 + 8。',
      source: { kind: 'executable' },
      validation: { type: 'number', answer: '20', authority: 'executable', evidenceId: 'independent-add' }
    }
  });
  state = op(state, 'guest-focus', 'question.focus', { conversationId: 'guest-c', questionKey: 'q@1' });
  state = op(state, 'guest-plan', 'plan.set', {
    tasks: [
      { id: 'guest-t', title: '独立算例', questionKey: 'q@1', condition: 'independent_correct' },
      { id: 'guest-pending', title: '尚未完成', condition: 'manual' }
    ]
  });
  state = op(state, 'guest-answer', 'attempt.submit', { conversationId: 'guest-c', answer: '20' });
  return state;
}
beforeEach(() => {
  uni.clearStorageSync();
  vi.clearAllMocks();
  setActivePinia(createPinia());
});

describe('账户连续性与访客归属', () => {
  it('真实退出清除会话而保留学习事实，登录另一账户不可读，登录原账户可重开', () => {
    uni.setStorageSync('EXAM_USER_ID', 'u1');
    const store = useConversationLearningStore();
    store.start('12 + 8');
    store.submit('19', true, 'retained-answer');
    const original = store.exportData();
    storageService.save('mistake_book', [{ id: 'legacy-private' }]);
    storageService.save('fsrs_card_legacy-private', { due: '2026-10-01' });
    storageService.saveDebounced('imported_files', [{ id: 'pending-private-import' }]);
    const logoutHandler = uni.$on.mock.calls.find(([name]) => name === 'user:logout')[1];
    useAuthStore().logout();
    logoutHandler();
    expect(store.state.owner).toBe('guest');
    expect(store.state.attempts).toHaveLength(0);
    uni.setStorageSync('EXAM_USER_ID', 'u2');
    store.refresh();
    expect(store.state.attempts).toHaveLength(0);
    uni.setStorageSync('EXAM_USER_ID', 'u1');
    store.refresh();
    expect(store.exportData()).toBe(original);
    expect(storageService.get('mistake_book')).toEqual([{ id: 'legacy-private' }]);
    expect(storageService.get('fsrs_card_legacy-private')).toEqual({ due: '2026-10-01' });
    expect(storageService.get('imported_files')).toEqual([{ id: 'pending-private-import' }]);
    storageService.clearUserData('u1');
    store.refresh();
    expect(store.state.attempts).toHaveLength(0);
    store.$dispose();
    expect(uni.$off).toHaveBeenCalledWith('user:logout', logoutHandler);
  });
  it('需确认，预览不写入；归属合并保留全部任务和完成证据，重复不增统计，可回滚', () => {
    let initial = op(emptyLearningState('u1', 'Asia/Shanghai'), 'account-plan', 'plan.set', {
      tasks: [
        { id: 'account-t', title: '账户已有任务', condition: 'manual' },
        { id: 'account-pending', title: '未完成账户任务', condition: 'manual' }
      ]
    });
    initial = op(initial, 'account-done', 'task.complete', { planId: 'account-plan', taskId: 'account-t' });
    const guest = guestState();
    const { repo } = setup(guest, initial);
    const preview = repo.previewGuestMigration();
    expect(preview).toMatchObject({ imported: 5, mergedPlans: 1 });
    expect(repo.read()).toEqual(initial);
    expect(() => repo.migrateGuest(preview, false)).toThrow('确认');
    const merged = repo.migrateGuest(preview, true).state;
    expect(merged.plans.at(-1).tasks).toHaveLength(4);
    expect(merged.plans.at(-1).tasks.filter((t) => t.completedBy)).toHaveLength(2);
    expect(summarizeLearning(merged).first.denominator).toBe(1);
    const next = repo.previewGuestMigration();
    expect(repo.migrateGuest(next, true).imported).toBe(0);
    expect(repo.read()).toEqual(merged);
    expect(repo.rollback()).toEqual(initial);
    expect(guest.owner).toBe('guest');
  });
  it('访客或账户在确认前变化，旧预览失效；存储失败保留两份原件', () => {
    const guest = guestState();
    const { repo, storage } = setup(guest);
    const preview = repo.previewGuestMigration();
    storage.getGuestLearningSnapshot = () =>
      op(guest, 'new-guest', 'message.add', { conversationId: 'guest-c', role: 'user', content: '新消息' });
    expect(() => repo.migrateGuest(preview, true)).toThrow('访客记录已更新');
    storage.getGuestLearningSnapshot = () => guest;
    storage.save = () => false;
    expect(() => repo.migrateGuest(preview, true)).toThrow('撤销标记');
    expect(repo.lifecycleRevision()).toBe(0);
    expect(repo.read().events).toHaveLength(0);
    expect(guest.events).toHaveLength(5);
  });
});

describe('资料异步结果与云端删除确认', () => {
  it('资料解析等待时切换账户，迟到片段不会写给新账户', async () => {
    uni.setStorageSync('EXAM_USER_ID', 'u1');
    const store = useConversationLearningStore();
    store.materialConnection = {
      endpoint: 'http://127.0.0.1:8765/parse',
      allowedOrigins: ['http://127.0.0.1:8765'],
      consent: true,
      token: 'TEST_ONLY_material_token_32_characters'
    };
    let finish;
    const transport = vi.spyOn(globalThis, 'fetch').mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        })
    );
    try {
      const result = store.importFile({ size: 100, contentBase64: 'TEST_ONLY', name: '合成材料' });
      const rejected = expect(result).rejects.toThrow('已取消');
      uni.setStorageSync('EXAM_USER_ID', 'u2');
      store.refresh();
      finish({
        ok: true,
        text: async () =>
          JSON.stringify({
            success: true,
            data: {
              id: 'synthetic-material',
              scope: 'private',
              segments: [{ id: 'page-1', content: '旧用户材料' }],
              totalPages: 1
            }
          })
      });
      await rejected;
      expect(store.state.materials).toHaveLength(0);
      expect(store.materialConnection).toBeNull();
    } finally {
      transport.mockRestore();
      store.$dispose();
    }
  });
  it('云端删除必须确认，只采纳真实成功结果；失败和取消不宣称已删除，本机保留', async () => {
    uni.setStorageSync('EXAM_USER_ID', 'u1');
    uni.setStorageSync('EXAM_TOKEN', 'TEST_ONLY_token');
    const store = useConversationLearningStore();
    store.start('12 + 8');
    const before = store.exportData();
    expect(() => store.deleteCloudRecords(false)).toThrow('明确确认');
    const transport = vi.spyOn(uni, 'request').mockImplementation((options) => {
      options.success({ data: { success: false, message: '隔离删除失败' } });
      return { abort: vi.fn() };
    });
    try {
      await expect(store.deleteCloudRecords(true)).rejects.toThrow('隔离删除失败');
      expect(store.exportData()).toBe(before);
      transport.mockImplementation((options) => {
        options.success({ data: { success: true, data: { deleted: true } } });
        return { abort: vi.fn() };
      });
      await expect(store.deleteCloudRecords(true)).rejects.toThrow('未确认教学结果缓存清除');
      expect(store.exportData()).toBe(before);
      transport.mockImplementation((options) => {
        options.success({ data: { success: true, data: { deleted: true, modelResultCacheDeleted: true } } });
        return { abort: vi.fn() };
      });
      await store.deleteCloudRecords(true);
      expect(store.exportData()).toBe(before);
      expect(transport.mock.calls.at(-1)[0].data.action).toBe('delete');
    } finally {
      transport.mockRestore();
      store.$dispose();
    }
  });
});

describe('同步冲突的保全与明确选择', () => {
  const dataset = (goal) => op(emptyLearningState('u1'), 'same-id', 'conversation.start', { goal });
  it('不覆盖同标识差异；保留并导出两份，云端采用须新读取，可恢复本机且不重复统计', async () => {
    const local = dataset('本机目标');
    const remote = dataset('云端目标');
    const { repo } = setup(null, local);
    const request = vi.fn(async () => ({ success: true, data: { state: remote } }));
    await expect(synchronizeLearning(repo, true, request)).rejects.toThrow('不同内容');
    expect(repo.read()).toEqual(local);
    expect(request).toHaveBeenCalledOnce();
    const preview = repo.previewSyncConflict();
    expect(preview.ids).toEqual(['same-id']);
    expect(JSON.parse(repo.exportSyncConflict('local'))).toEqual(local);
    expect(JSON.parse(repo.exportSyncConflict('remote'))).toEqual(remote);
    await adoptRemoteConflict(repo, preview, true, request);
    expect(repo.read()).toEqual(remote);
    repo.restoreConflictLocal(repo.previewSyncConflict());
    expect(repo.read()).toEqual(local);
    repo.clearSyncConflict();
    expect(repo.previewSyncConflict()).toBeNull();
  });
  it('云端或本机已变更时拒绝采用陈旧预览，归档不会静默覆盖', async () => {
    const local = dataset('本机');
    const remote = dataset('云端');
    const { repo } = setup(null, local);
    repo.captureSyncConflict(remote, ['same-id']);
    const preview = repo.previewSyncConflict();
    const changed = op(remote, 'remote-new', 'conversation.start', { goal: '新云端' });
    await expect(
      adoptRemoteConflict(repo, preview, true, async () => ({ success: true, data: { state: changed } }))
    ).rejects.toThrow('云端记录已更新');
    repo.commit({ id: 'local-new', type: 'conversation.start', data: { goal: '新本机' } });
    expect(() => repo.restoreConflictLocal(preview)).toThrow('已更新');
    expect(() => repo.captureSyncConflict(changed, ['same-id'])).toThrow('已有另一份');
    expect(JSON.parse(repo.exportSyncConflict('local'))).toEqual(local);
    expect(repo.read().events).toHaveLength(2);
  });
  it('网络等待期间相同 ID 的新本机操作也检测冲突，不能静默丢弃', async () => {
    const { repo } = setup(null);
    const remote = dataset('远端');
    let resolve;
    const result = synchronizeLearning(
      repo,
      true,
      () =>
        new Promise((r) => {
          resolve = r;
        })
    );
    const rejected = expect(result).rejects.toThrow('不同内容');
    repo.commit({ id: 'same-id', type: 'conversation.start', data: { goal: '本机晚到' } });
    resolve({ success: true, data: { state: remote } });
    await rejected;
    expect(repo.read().conversations[0].goal).toBe('本机晚到');
    expect(repo.previewSyncConflict().ids).toEqual(['same-id']);
  });
  it('取消和无效响应不覆盖本机，删除清理冲突派生副本', async () => {
    const local = dataset('本机');
    const { repo } = setup(null, local);
    const controller = new AbortController();
    const request = async () => {
      controller.abort();
      return { success: true, data: { state: local } };
    };
    await expect(synchronizeLearning(repo, true, request, { signal: controller.signal })).rejects.toThrow('已取消');
    await expect(
      synchronizeLearning(repo, true, async () => ({ success: true, data: { state: { owner: 'u1' } } }))
    ).rejects.toThrow('结构无效');
    expect(repo.read()).toEqual(local);
    repo.captureSyncConflict(dataset('不同云端'), ['same-id']);
    repo.deleteData();
    expect(repo.previewSyncConflict()).toBeNull();
  });
});
