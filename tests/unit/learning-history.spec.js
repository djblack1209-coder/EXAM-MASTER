import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { mount, flushPromises } from '@vue/test-utils';
import LearningPage from '@/pages/learning/index.vue';
import { useConversationLearningStore } from '@/stores/modules/conversation-learning.js';
import { storageService } from '@/services/storageService.js';
import { createLearningRepository, LEARNING_KEY } from '@/services/learning/learning-repository.js';
import { createHistoryStorage, readLocalHistory } from '@/services/learning/history-storage.js';
import pako from 'pako';
import { prepareLearningHistoryRestore } from '@/services/learning/learning-backup.js';
import { synchronizeLearning } from '@/services/learning/learning-sync.js';
import {
  emptyLearningState,
  applyLearningOperation,
  createLearningOperationBatch,
  summarizeLearning,
  normalizePrivateSyncOperation
} from '@/services/learning/learning-domain.js';
import { parsePastedMaterial } from '@/services/learning/material-intake.js';
import {
  HISTORY_FORMAT,
  createHistoryPackage,
  encodeHistory,
  decodeHistory,
  historyPageKey,
  readStoredHistory
} from '../../laf-backend/functions/_shared/learning-history.js';
import { historyFixture } from '../fixtures/learning/history-fixture.js';
vi.mock('@dcloudio/uni-app', () => ({ onShow: vi.fn(), onHide: vi.fn(), onLoad: vi.fn(), onBackPress: vi.fn() }));
let large;
beforeAll(() => {
  large = historyFixture();
}, 20000);
beforeEach(() => {
  uni.clearStorageSync();
  setActivePinia(createPinia());
  vi.clearAllMocks();
});
function setup(initial = emptyLearningState('u1')) {
  const map = new Map([[LEARNING_KEY, structuredClone(initial)]]);
  let currentOwner = 'u1';
  const raw = {
    get: (key, fallback) => (map.has(key) ? structuredClone(map.get(key)) : fallback),
    save: (key, value) => {
      map.set(key, structuredClone(value));
      return true;
    },
    remove: (key) => {
      map.delete(key);
      return true;
    }
  };
  const storage = createHistoryStorage(raw, () => currentOwner);
  return {
    map,
    raw,
    storage,
    repo: createLearningRepository(raw, () => currentOwner),
    owner: (v) => {
      currentOwner = v;
    }
  };
}
const content = (state) => JSON.stringify(createHistoryPackage(state));
const managedSnapshots = (map) =>
  [...map.values()]
    .filter((value) => value?.format === HISTORY_FORMAT)
    .map((value) => readLocalHistory(value, (key) => map.get(key), value.owner));
describe('有界历史分页与完整学习事实', () => {
  it('五 MiB 隔离存储可保存两万操作及恢复副本，重开、后续写入和回滚不丢学习事实', () => {
    let state = historyFixture('u1', 0, 0),
      batch = createLearningOperationBatch(state);
    const original = structuredClone(state);
    const messages = 19999 - state.events.length;
    for (let i = 0; i < messages; i++) {
      if (i && i % 100 === 0) {
        state = batch.finish();
        batch = createLearningOperationBatch(state);
      }
      batch.apply({
        id: `capacity${i.toString(36)}`,
        type: 'message.add',
        at: original.events[0].at,
        data: { conversationId: 'history-c', role: 'user', content: '容量' }
      });
    }
    state = batch.finish();
    expect(JSON.stringify(state).length).toBeLessThan(6000000);
    const { raw, storage, map, repo } = setup(original);
    const save = raw.save;
    raw.save = (key, value) => {
      const serialized = new Map([...map].map(([k, v]) => [k, JSON.stringify(v)]));
      serialized.set(key, JSON.stringify(value));
      const bytes = [...serialized].reduce((total, [k, v]) => total + 2 * (k.length + v.length), 0);
      return bytes <= 5 * 1024 * 1024 && save(key, value);
    };
    expect(storage.save(LEARNING_KEY, state)).toBe(true);
    expect(createLearningRepository(raw, () => 'u1').read()).toEqual(state);
    repo.commit({
      id: 'capacity-last',
      type: 'message.add',
      at: original.events[0].at,
      data: { conversationId: 'history-c', role: 'user', content: '最后一个操作' }
    });
    const full = createLearningRepository(raw, () => 'u1').read();
    expect(full.events).toHaveLength(20000);
    expect(full.events.slice(0, original.events.length)).toEqual(original.events);
    expect(summarizeLearning(full).first).toMatchObject({ numerator: 2, denominator: 6 });
    expect(summarizeLearning(full).tasks).toMatchObject({ numerator: 6, denominator: 10 });
    expect(repo.rollback()).toEqual(state);
    expect(repo.inspectHistory().generations).toBe(1);
  }, 20000);
  it('varied original text that needs a second generation exceeds a five MiB quota without replacing the accepted root or recovery', () => {
    const original = historyFixture('u1', 0, 0);
    let state = original,
      batch = createLearningOperationBatch(state),
      rng = 0x6d2b79f5;
    for (let i = 0; i < 600; i++) {
      if (i && i % 100 === 0) {
        state = batch.finish();
        batch = createLearningOperationBatch(state);
      }
      let content = '';
      for (let j = 0; j < 1400; j++) {
        rng = (Math.imul(rng, 1664525) + 1013904223) >>> 0;
        content += String.fromCodePoint(j % 3 ? 0x4e00 + (rng % 2000) : 0x61 + (rng % 26));
      }
      batch.apply({
        id: `varied-${i}`,
        type: 'message.add',
        at: original.events[0].at,
        data: { conversationId: 'history-c', role: 'user', content }
      });
    }
    state = batch.finish();
    const { raw, storage, map, repo } = setup(original),
      save = raw.save;
    let rejected = 0;
    raw.save = (key, value) => {
      const rows = new Map([...map].map(([k, v]) => [k, JSON.stringify(v)]));
      rows.set(key, JSON.stringify(value));
      if ([...rows].reduce((n, [k, v]) => n + 2 * (k.length + v.length), 0) > 5 * 1024 * 1024) {
        rejected++;
        return false;
      }
      return save(key, value);
    };
    expect(storage.save(LEARNING_KEY, state)).toBe(true);
    expect(storage.save(`${LEARNING_KEY}_recovery`, state)).toBe(true);
    const head = structuredClone(map.get(LEARNING_KEY));
    const changed = applyLearningOperation(state, {
      id: 'varied-after',
      type: 'message.add',
      at: Date.now(),
      data: { conversationId: 'history-c', role: 'user', content: '下一条明确消息' }
    }).state;
    expect(() => storage.save(LEARNING_KEY, changed)).toThrow('保存失败');
    expect(rejected).toBeGreaterThan(0);
    expect(map.get(LEARNING_KEY)).toEqual(head);
    expect(repo.read()).toEqual(state);
    expect(storage.get(`${LEARNING_KEY}_recovery`)).toEqual(state);
    expect(repo.inspectHistory().generations).toBe(1);
    expect(summarizeLearning(repo.read()).first).toMatchObject({ numerator: 2, denominator: 6 });
    expect(summarizeLearning(repo.read()).tasks).toMatchObject({ numerator: 6, denominator: 10 });
  }, 20000);

  it('超过旧上限仍保存完整快照，重开保留 2/6 首答、6/10 计划和提示经历，副本复用后可回滚', () => {
    expect(large.events.length).toBeGreaterThan(500);
    expect(JSON.stringify(large).length).toBeGreaterThan(1500000);
    const { repo, storage, map, raw } = setup();
    storage.save(LEARNING_KEY, large);
    expect(map.get(LEARNING_KEY).format).toBe(HISTORY_FORMAT);
    expect(repo.inspectHistory().pages).toBeGreaterThan(12);
    expect(createLearningRepository(raw, () => 'u1').read()).toEqual(large);
    const summary = summarizeLearning(repo.read());
    expect(summary.first).toMatchObject({ numerator: 2, denominator: 6 });
    expect(summary.tasks).toMatchObject({ numerator: 6, denominator: 10, rate: 0.6 });
    expect(repo.read().attempts.at(-1)).toMatchObject({ kind: 'revision', hints: [{ content: '先拆分个位与十位。' }] });
    storage.save(`${LEARNING_KEY}_recovery`, large);
    expect(repo.inspectHistory().generations).toBe(1);
    repo.commit({
      id: 'extra',
      type: 'message.add',
      at: Date.now(),
      data: { conversationId: 'history-c', role: 'user', content: '重开之后' }
    });
    expect(repo.inspectHistory().generations).toBe(2);
    expect(repo.rollback()).toEqual(large);
    expect(repo.inspectHistory().generations).toBe(1);
  });
  it('分页写入或根指针失败不替换当前事实，重读清理无引用页面，可重试', () => {
    for (const failAt of ['page', 'head']) {
      const { repo, storage, raw, map } = setup();
      const save = raw.save;
      let pages = 0;
      raw.save = (key, value) =>
        (failAt === 'head' && key === LEARNING_KEY) ||
        (failAt === 'page' &&
          key.includes('_history_') &&
          !key.endsWith('_catalog') &&
          !key.endsWith('_write') &&
          ++pages === 3)
          ? false
          : save(key, value);
      expect(() => storage.save(LEARNING_KEY, large)).toThrow('保存失败');
      raw.save = save;
      expect(repo.read().events).toHaveLength(0);
      expect([...map.keys()].filter((key) => /_history_[a-z0-9]+_.*_\d+$/.test(key))).toHaveLength(0);
      expect(storage.save(LEARNING_KEY, large)).toBe(true);
      expect(repo.read()).toEqual(large);
    }
  });
  it('根指针成功、目录收尾失败也不伪造成功，重读可恢复完整新版本', () => {
    const { repo, storage, raw } = setup();
    const save = raw.save;
    raw.save = (key, value) => (key.endsWith('_history_catalog') ? false : save(key, value));
    expect(() => storage.save(LEARNING_KEY, large)).toThrow('保存失败');
    raw.save = save;
    expect(repo.read()).toEqual(large);
    expect(repo.inspectHistory().generations).toBe(1);
  });
  it('只读窗口不清理另一个写入窗口尚未切换根目录的页面', () => {
    const { raw, map } = setup();
    const generation = 'writer_abcdefgh',
      key = historyPageKey(generation, 0);
    map.set(`${LEARNING_KEY}_history_write`, { owner: 'u1', record: { generation, count: 1 } });
    map.set(key, { owner: 'u1', generation, index: 0, text: '尚未提交' });
    const reader = createHistoryStorage(raw, () => 'u1', { canCleanup: () => false });
    expect(reader.get(LEARNING_KEY).events).toHaveLength(0);
    expect(map.has(key)).toBe(true);
    expect(() => reader.save(LEARNING_KEY, large)).toThrow('另一窗口');
    expect(() => reader.remove(LEARNING_KEY)).toThrow('另一窗口');
    const writer = createHistoryStorage(raw, () => 'u1');
    writer.get(LEARNING_KEY);
    expect(map.has(key)).toBe(false);
  });
  it('缺页、损坏、跨账户目录均拒绝，不以空记录代替；旧快照仍可读', () => {
    const { repo, storage, map, owner } = setup();
    storage.save(LEARNING_KEY, large);
    const manifest = map.get(LEARNING_KEY),
      key = historyPageKey(manifest.generation, 0),
      page = map.get(key);
    map.delete(key);
    expect(() => repo.read()).toThrow('缺失');
    map.set(key, { ...page, text: page.text + 'x' });
    expect(() => repo.read()).toThrow('损坏');
    map.set(key, page);
    owner('u2');
    expect(() => repo.read()).toThrow('其他账户');
    owner('u1');
    expect(repo.read()).toEqual(large);
    expect(setup().repo.read().events).toHaveLength(0);
  });
  it('旧原文分页与压缩分页混读完整 Unicode，旧读取器拒绝新格式而不覆盖原件', () => {
    const { repo, storage, raw, map } = setup();
    const state = applyLearningOperation(large, {
      id: 'history-unicode',
      type: 'message.add',
      at: Date.now(),
      data: { conversationId: 'history-c', role: 'user', content: '🦉学\n\\"'.repeat(800) }
    }).state;
    storage.save(LEARNING_KEY, state);
    const manifest = map.get(LEARNING_KEY),
      key = historyPageKey(manifest.generation, 0);
    const pages = encodeHistory(state, 'u1', manifest.generation).pages;
    map.set(key, { owner: 'u1', generation: manifest.generation, index: 0, text: pages[0] });
    expect(repo.read()).toEqual(state);
    const before = structuredClone([...map]);
    expect(() => readStoredHistory(manifest, raw.get, 'u1')).toThrow('损坏');
    expect([...map]).toEqual(before);
  });
  it('损坏、截断、额外尾部、膨胀压缩分页与伪造元信息拒绝，原根及恢复副本保留', () => {
    const { repo, storage, map } = setup();
    storage.save(LEARNING_KEY, large);
    storage.save(`${LEARNING_KEY}_recovery`, large);
    const manifest = map.get(LEARNING_KEY),
      key = historyPageKey(manifest.generation, 0),
      page = map.get(key);
    const bytes = Buffer.from(page.payload, 'base64');
    const changes = [
      { encoding: 'unknown' },
      { owner: 'u2' },
      { generation: 'other_abcdefgh' },
      { index: 1 },
      { characters: 120001 },
      { characters: page.characters - 1 },
      { payload: 'AB==' },
      { payload: page.payload + '!' },
      { payload: 'a'.repeat(120004) },
      { text: 'ignored' },
      { payload: bytes.subarray(0, -8).toString('base64') },
      { payload: Buffer.concat([bytes, Buffer.from('extra')]).toString('base64') },
      { payload: Buffer.from(pako.gzip('x'.repeat(1000000))).toString('base64') }
    ];
    for (const change of changes) {
      map.set(key, { ...page, ...change });
      expect(() => repo.read()).toThrow(/损坏|缺失|不匹配/);
      expect(map.get(LEARNING_KEY)).toEqual(manifest);
      expect(map.get(`${LEARNING_KEY}_recovery`)).toEqual(manifest);
    }
    map.set(key, page);
    expect(repo.read()).toEqual(large);
  });
  it('分页保持代理对完整 Unicode 字符的边界，不允许混合代际或声明超限', () => {
    const encoded = encodeHistory({ text: 'a'.repeat(119986) + '🦉'.repeat(100) }, 'u1', 'test_unicode');
    expect(decodeHistory(encoded.manifest, encoded.pages, 'u1').text.endsWith('🦉')).toBe(true);
    expect(encoded.pages.every((page) => !/[\uD800-\uDBFF]$/.test(page))).toBe(true);
    expect(() => decodeHistory({ ...encoded.manifest, characters: 6000001 }, encoded.pages, 'u1')).toThrow('超限');
  });
  it('资料删除清理当前、恢复和所有旧分页正文，整账户删除不留历史目录', () => {
    const { repo, storage, map } = setup();
    let state = structuredClone(large);
    const marker = 'TEST_ONLY_PRIVATE_LONG_HISTORY';
    const put = (id, type, data) => {
      state = applyLearningOperation(state, { id, type, at: Date.now(), data }).state;
    };
    put('material', 'material.add', { material: parsePastedMaterial(marker, 'm1') });
    put('private', 'conversation.start', { goal: marker });
    put('private-q', 'question.add', {
      question: {
        id: 'private-q',
        version: 1,
        scope: 'private',
        prompt: marker,
        source: { materialId: 'm1' },
        answerType: 'subjective'
      }
    });
    put('private-focus', 'question.focus', { conversationId: 'private', questionKey: 'private-q@1' });
    put('private-msg', 'message.add', { conversationId: 'private', role: 'user', content: marker });
    storage.save(LEARNING_KEY, state);
    storage.save(`${LEARNING_KEY}_recovery`, state);
    repo.deleteMaterial(repo.previewMaterialDeletion('m1'), true, 'history-delete');
    expect(JSON.stringify([...map.values()])).not.toContain(marker);
    expect(JSON.stringify(managedSnapshots(map))).not.toContain(marker);
    const livePages = new Set(
      [...map.values()]
        .filter((value) => value?.format === HISTORY_FORMAT)
        .flatMap((manifest) => manifest.checksums.map((_, index) => historyPageKey(manifest.generation, index)))
    );
    expect([...map.keys()].filter((key) => /^conversation_learning_v1_history_.+_\d+$/.test(key)).sort()).toEqual(
      [...livePages].sort()
    );
    expect(summarizeLearning(repo.read()).first).toMatchObject({ numerator: 2, denominator: 6 });
    repo.deleteData();
    expect(repo.read().events).toHaveLength(0);
    expect([...map.keys()].filter((key) => key.startsWith(LEARNING_KEY))).toEqual([`${LEARNING_KEY}_lifecycle`]);
    expect(map.get(`${LEARNING_KEY}_lifecycle`)).toEqual({
      owner: 'u1',
      contract: 'learning-lifecycle-v1',
      generation: expect.any(String)
    });
  });
  it('分页访客快照可以由真实存储读取；另一账户不能读取其页面', () => {
    const state = historyFixture('guest', 8, 7900);
    const encoded = encodeHistory(state, 'guest', 'guest_abcdefgh');
    uni.setStorageSync(LEARNING_KEY, encoded.manifest);
    encoded.pages.forEach((text, index) =>
      uni.setStorageSync(historyPageKey(encoded.manifest.generation, index), {
        owner: 'guest',
        generation: encoded.manifest.generation,
        index,
        text
      })
    );
    expect(storageService.getGuestLearningSnapshot()).toEqual(state);
    uni.setStorageSync(LEARNING_KEY, { ...encoded.manifest, owner: 'u2' });
    expect(() => storageService.getGuestLearningSnapshot()).toThrow('其他账户');
  });
  it('真实访客存储读取压缩页，账号切换后仍只返回完整访客原件，缺页拒绝', () => {
    const state = historyFixture('guest', 8, 7900);
    const storage = createHistoryStorage(storageService, () => 'guest');
    expect(storage.save(LEARNING_KEY, state)).toBe(true);
    uni.setStorageSync('EXAM_USER_ID', 'u1');
    expect(storageService.getGuestLearningSnapshot()).toEqual(state);
    const manifest = uni.getStorageSync(LEARNING_KEY);
    uni.removeStorageSync(historyPageKey(manifest.generation, 0));
    expect(() => storageService.getGuestLearningSnapshot()).toThrow('缺失');
  });
});
describe('分批备份恢复与同步', () => {
  it('Store 取消实际大历史校验，进度清空且原记录不变，重新预览仍可继续', async () => {
    const store = useConversationLearningStore();
    const backup = content({ ...large, owner: 'guest' });
    try {
      const before = JSON.parse(JSON.stringify(store.state));
      const pending = store.previewRestore(backup);
      expect(store.historyBusy).toBe(true);
      store.cancelHistory();
      await expect(pending).rejects.toMatchObject({ code: 'CANCELLED' });
      expect(store.historyBusy).toBe(false);
      expect(store.historyProgress).toBeNull();
      expect(store.state).toEqual(before);
      const preview = await store.previewRestore(backup);
      expect(preview.imported).toBe(large.events.length);
      expect(store.state).toEqual(before);
    } finally {
      store.$dispose();
    }
  }, 20000);
  it('实际大历史校验期间账户往返或新作答取消旧预览，不覆盖后续记录', async () => {
    const store = useConversationLearningStore();
    const backup = content({ ...large, owner: 'guest' });
    try {
      const pending = store.previewRestore(backup);
      uni.setStorageSync('EXAM_USER_ID', 'history-other-owner');
      store.refresh();
      uni.removeStorageSync('EXAM_USER_ID');
      store.refresh();
      await expect(pending).rejects.toMatchObject({ code: 'CANCELLED' });
      expect(store.state.owner).toBe('guest');
      expect(store.state.events).toHaveLength(0);
      store.start('12 + 8');
      const during = store.previewRestore(backup);
      store.submit('19', true, 'during-history-preview');
      await expect(during).rejects.toMatchObject({ code: 'CANCELLED' });
      expect(store.historyBusy).toBe(false);
      expect(store.state.attempts).toHaveLength(1);
      expect(store.state.attempts[0].answer).toBe('19');
      expect(store.state.events.some((event) => event.id === large.events[0].id)).toBe(false);
    } finally {
      store.$dispose();
    }
  }, 20000);
  it('大历史预览不写，确认合并完整事实，重复恢复不增计数，可撤销', async () => {
    const { repo } = setup(),
      backup = content(large);
    const preview = await repo.previewHistoryRestore(backup);
    expect(preview.imported).toBe(large.events.length);
    expect(repo.read().events).toHaveLength(0);
    const restored = repo.restoreHistory(backup, preview);
    expect(summarizeLearning(restored.state).first).toMatchObject({ numerator: 2, denominator: 6 });
    const again = await repo.previewHistoryRestore(repo.exportData());
    expect(repo.restoreHistory(repo.exportData(), again).imported).toBe(0);
    expect(repo.read().attempts).toHaveLength(7);
    expect(repo.rollback().events).toHaveLength(0);
  }, 20000);
  it('旧版大 JSON 备份也逐批重放，敏感字段与未知根字段仍拒绝', async () => {
    const { repo } = setup(),
      backup = JSON.stringify(large);
    const preview = await repo.previewRestore(backup);
    expect(preview.history).toBe(true);
    const restored = repo.restoreHistory(backup, preview);
    expect(restored.imported).toBe(large.events.length);
    const malicious = { ...large, apiKey: 'TEST_ONLY_SECRET' };
    await expect(repo.previewHistoryRestore(JSON.stringify(malicious))).rejects.toThrow('字段');
    malicious.apiKey = undefined;
    malicious.events = [{ id: 'attack', type: 'message.add', at: Date.now(), data: { constructor: 'unsafe' } }];
    await expect(repo.previewHistoryRestore(JSON.stringify(malicious))).rejects.toThrow('不安全');
  }, 20000);
  it('大访客历史预览、确认、重复迁移与撤销均保留原件，并检测访客确认前变化', async () => {
    const { repo, raw } = setup(),
      guest = { ...structuredClone(large), owner: 'guest' };
    raw.getGuestLearningSnapshot = () => structuredClone(guest);
    const preview = await repo.previewGuestMigration();
    expect(preview.history).toBe(true);
    expect(repo.read().events).toHaveLength(0);
    expect(() => repo.migrateGuest(preview, false)).toThrow('确认');
    repo.migrateGuest(preview, true);
    expect(summarizeLearning(repo.read()).first).toMatchObject({ numerator: 2, denominator: 6 });
    const again = await repo.previewGuestMigration();
    expect(repo.migrateGuest(again, true).imported).toBe(0);
    expect(repo.rollback().events).toHaveLength(0);
    const stale = await repo.previewGuestMigration();
    raw.getGuestLearningSnapshot = () => ({ ...guest, revision: guest.revision + 1 });
    expect(() => repo.migrateGuest(stale, true)).toThrow('访客记录已更新');
    expect(guest.events.length).toBe(large.events.length);
  }, 20000);
  it('取消、时间预算和校验期间新操作不覆盖，改写分页拒绝，伪造统计不会进入历史包', async () => {
    const { repo } = setup(),
      backup = content(large),
      controller = new AbortController();
    await expect(
      repo.previewHistoryRestore(backup, { signal: controller.signal, onProgress: () => controller.abort() })
    ).rejects.toThrow('取消');
    expect(repo.read().events).toHaveLength(0);
    await expect(repo.previewHistoryRestore(backup, { maxDurationMs: 0 })).rejects.toThrow('时间上限');
    let changed = false;
    await expect(
      repo.previewHistoryRestore(backup, {
        onProgress: () => {
          if (!changed) {
            changed = true;
            repo.commit({
              id: 'during',
              type: 'conversation.start',
              data: { goal: '预览期间的新操作' },
              at: Date.now()
            });
          }
        }
      })
    ).rejects.toThrow('已变化');
    expect(repo.read().events).toHaveLength(1);
    const corrupt = JSON.parse(backup);
    corrupt.pages[0] += 'x';
    await expect(repo.previewHistoryRestore(JSON.stringify(corrupt))).rejects.toThrow('损坏');
    expect(JSON.parse(backup).attempts).toBeUndefined();
  }, 20000);
  it('完整历史中的删除跨批重放；不允许备份隐式删除现有资料', async () => {
    let state = emptyLearningState('u1');
    const at = Date.now();
    const put = (id, type, data) => {
      state = applyLearningOperation(state, { id, type, data, at }).state;
    };
    put('c', 'conversation.start', { goal: '隔离' });
    put('m', 'material.add', { material: parsePastedMaterial('TEST_ONLY', 'm1') });
    for (let i = 0; i < 21; i++)
      put(`m${i}`, 'message.add', { conversationId: 'c', role: 'user', content: '独立消息' });
    const before = structuredClone(state);
    put('delete', 'material.delete', { materialId: 'm1', questionKeys: [] });
    expect(
      (await prepareLearningHistoryRestore(emptyLearningState('u1'), content(state))).state.materials
    ).toHaveLength(0);
    await expect(prepareLearningHistoryRestore(before, content(state))).rejects.toThrow('隐式清理');
  });
  it('云端有界分页与精简回执还原完整记录、重复不增加，混版/缺页/跨账户拒绝', async () => {
    const { repo } = setup(large);
    let remote = emptyLearningState('u1'),
      revision = 0;
    const request = vi.fn(async (_path, body) => {
      if (body.action === 'push') {
        const batch = createLearningOperationBatch(remote);
        for (const event of body.operations) batch.apply(normalizePrivateSyncOperation(event));
        remote = batch.finish();
        revision++;
        return {
          success: true,
          data: { snapshotRequired: true, accepted: body.operations.map((e) => e.id), revision }
        };
      }
      const wire = encodeHistory(remote, 'u1', `revision_${String(revision).padStart(8, '0')}`);
      if (body.action === 'page')
        return {
          success: true,
          data: {
            owner: 'u1',
            revision,
            generation: wire.manifest.generation,
            offset: body.offset,
            pages: wire.pages.slice(body.offset, body.offset + 3)
          }
        };
      return { success: true, data: remote.events.length ? { history: wire.manifest, revision } : { state: remote } };
    });
    await synchronizeLearning(repo, true, request);
    expect(repo.read()).toEqual(remote);
    expect(request.mock.calls.filter(([, b]) => b.action === 'push')).toHaveLength(7);
    // 单次测试不触发速率窗口；第二次使用独立调用预算且仅需读取。
    await synchronizeLearning(repo, true, request);
    expect(repo.read().attempts).toHaveLength(7);
    const bad = async (_path, body) =>
      body.action === 'pull'
        ? { success: true, data: { history: encodeHistory(remote, 'u1', 'revision_abcdefgh').manifest, revision } }
        : {
            success: true,
            data: { owner: 'u2', revision, generation: body.generation, offset: body.offset, pages: [] }
          };
    await expect(synchronizeLearning(repo, true, bad)).rejects.toThrow('分页无效');
    expect(repo.read()).toEqual(remote);
  }, 20000);
  it('持续失效仅重拉一次，取消分页读取保留本机事实', async () => {
    const { repo } = setup(),
      manifest = encodeHistory(large, 'u1', 'revision_abcdefgh').manifest;
    const request = vi.fn(async (_path, b) =>
      b.action === 'pull'
        ? { success: true, data: { history: manifest, revision: 1 } }
        : { success: false, error: 'STALE_SYNC' }
    );
    await expect(synchronizeLearning(repo, true, request)).rejects.toThrow('持续更新');
    expect(request).toHaveBeenCalledTimes(4);
    const controller = new AbortController();
    await expect(
      synchronizeLearning(
        repo,
        true,
        async (_p, b) => {
          const r = await request(_p, b);
          if (b.action === 'page') controller.abort();
          return r;
        },
        { signal: controller.signal }
      )
    ).rejects.toThrow('取消');
    expect(repo.read().events).toHaveLength(0);
  });
  it('对话只挂载50条，早页读取不被新消息拉走，原题定位和返回最新可操作', async () => {
    const state = historyFixture('guest', 80, 2);
    state.conversations[0].messages[5].questionKey = 'history-q0@1';
    storageService.save(LEARNING_KEY, state);
    const store = useConversationLearningStore();
    store.refresh();
    store.selectedConversationId = 'history-c';
    const wrapper = mount(LearningPage, {
      global: {
        stubs: {
          view: { template: '<div><slot /></div>' },
          text: { template: '<span><slot /></span>' },
          LearningShell: { template: '<div><slot /><slot name="controls" /></div>' },
          LearningOverview: true,
          NumberLine: true
        }
      }
    });
    const button = (label) => wrapper.findAll('button').find((node) => node.text().trim() === label);
    expect(wrapper.findAll('.message').length).toBeLessThanOrEqual(50);
    await button('更早消息').trigger('tap');
    expect(wrapper.text()).toContain('隔离消息0');
    store.commit(
      'message.add',
      { conversationId: 'history-c', role: 'user', content: '阅读早页时的新消息' },
      'ui-new-message'
    );
    await flushPromises();
    expect(wrapper.text()).toContain('隔离消息0');
    await button('回到最新').trigger('tap');
    expect(wrapper.text()).toContain('阅读早页时的新消息');
    const before = store.state.attempts.length;
    store.focus('history-q0@1');
    await flushPromises();
    expect(wrapper.text()).toContain('隔离消息5');
    expect(store.state.attempts).toHaveLength(before);
    wrapper.unmount();
    store.$dispose();
  });
});
