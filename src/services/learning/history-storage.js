import {
  HISTORY_FORMAT,
  HISTORY_LIMITS,
  encodeHistory,
  readStoredHistory,
  historyPageKey,
  historyAssert
} from '../../../laf-backend/functions/_shared/learning-history.js';
// 官方构建不含 C 源码的 #ifdef 注释，避免 uni-app 条件编译误删算法。
import pako from 'pako/dist/pako.min.js';
import { base64Encode, base64Decode } from '../../utils/crypto/cipher.js';

const pageEncoding = 'learning-page-gzip-v1';
function encodeLocalPage(page) {
  const payload = base64Encode(pako.gzip(page.text, { to: 'string' }));
  const { text, ...identity } = page;
  const compressed = { ...identity, encoding: pageEncoding, characters: text.length, payload };
  return payload.length <= HISTORY_LIMITS.pageCharacters &&
    JSON.stringify(compressed).length < JSON.stringify(page).length
    ? compressed
    : page;
}

// 只压缩设备物理分页，公开备份、云端协议与逻辑长度仍沿原合同。
export function readLocalHistory(value, get, owner) {
  return readStoredHistory(
    value,
    (key) => {
      const page = get(key);
      if (page?.encoding === undefined) return page;
      historyAssert(
        page.owner === owner &&
          page.generation === value.generation &&
          historyPageKey(page.generation, page.index) === key,
        'MISSING_HISTORY_PAGE',
        '历史分页缺失或账户不匹配'
      );
      const valid = (condition) => historyAssert(condition, 'CORRUPT_HISTORY_PAGE', '历史分页损坏，未采用不完整记录');
      valid(
        page.encoding === pageEncoding &&
          Object.keys(page).every((field) =>
            ['owner', 'generation', 'index', 'encoding', 'characters', 'payload'].includes(field)
          ) &&
          Number.isInteger(page.characters) &&
          page.characters > 0 &&
          page.characters <= HISTORY_LIMITS.pageCharacters &&
          typeof page.payload === 'string' &&
          page.payload.length > 0 &&
          page.payload.length <= HISTORY_LIMITS.pageCharacters &&
          page.payload.length % 4 === 0 &&
          /^[A-Za-z0-9+/]+={0,2}$/.test(page.payload)
      );
      const binary = base64Decode(page.payload);
      valid(base64Encode(binary) === page.payload);
      const chunks = [];
      let characters = 0;
      const inflater = new pako.Inflate({ to: 'string', chunkSize: 4096, windowBits: 31 });
      inflater.onData = (chunk) => {
        characters += chunk.length;
        // 在解码过程中终止膨胀载荷，避免先无限解压再检查长度。
        valid(characters <= page.characters && inflater.strm.total_out <= HISTORY_LIMITS.pageCharacters * 3);
        chunks.push(chunk);
      };
      // pako 1.x 的 true 可结束未完整的流；仅接受自动到达 gzip 尾部的流。
      valid(inflater.push(binary, false) && inflater.ended && !inflater.err && inflater.strm.avail_in === 0);
      const text = chunks.join('');
      valid(text.length === page.characters);
      return { owner: page.owner, generation: page.generation, index: page.index, text };
    },
    owner
  );
}
const root = 'conversation_learning_v1';
const managed = [root, `${root}_recovery`, `${root}_migration_backup`, `${root}_sync_conflict`];
const catalogKey = `${root}_history_catalog`,
  pendingKey = `${root}_history_write`;
export function createHistoryStorage(storage, owner, { canCleanup = () => true } = {}) {
  const getRaw = (key) => storage.get(key, null);
  const records = () => {
    const value = getRaw(catalogKey);
    historyAssert(!value || value.owner === owner(), 'OWNER_MISMATCH', '历史目录属于其他账户');
    return value?.records || [];
  };
  const put = (key, value) =>
    historyAssert(storage.save(key, value, true), 'STORAGE_FAILED', '历史分页保存失败，未确认完成；请重新读取后重试');
  function cleanup() {
    const all = records(),
      pending = getRaw(pendingKey);
    historyAssert(!pending || pending.owner === owner(), 'OWNER_MISMATCH', '历史写入属于其他账户');
    historyAssert(
      Array.isArray(all) &&
        all.length <= 8 &&
        [...all, ...(pending ? [pending.record] : [])].every(
          (item) =>
            item &&
            /^[a-z0-9_-]{8,80}$/.test(item.generation) &&
            Number.isInteger(item.count) &&
            item.count > 0 &&
            item.count <= 110
        ),
      'INVALID_HISTORY',
      '历史清理目录不合法，原分页保留'
    );
    const candidates = pending
      ? [...all.filter((item) => item.generation !== pending.record.generation), pending.record]
      : all;
    const heads = managed.map(getRaw).filter((v) => v?.format === HISTORY_FORMAT);
    historyAssert(
      heads.every((v) => v.owner === owner()),
      'OWNER_MISMATCH',
      '历史目录属于其他账户'
    );
    const live = new Set(heads.map((v) => v.generation));
    // 只读窗口不能把另一个窗口尚未切换目录的页面当垃圾清除。
    if ((pending || candidates.some((item) => !live.has(item.generation))) && !canCleanup()) return;
    for (const item of candidates.filter((item) => !live.has(item.generation)))
      for (let i = 0; i < item.count; i++)
        if (getRaw(historyPageKey(item.generation, i)) !== null)
          historyAssert(
            storage.remove(historyPageKey(item.generation, i), true),
            'STORAGE_FAILED',
            '未引用历史分页清理待重试'
          );
    const retained = candidates.filter((item) => live.has(item.generation));
    if (pending || retained.length !== all.length) put(catalogKey, { owner: owner(), records: retained });
    if (pending) historyAssert(storage.remove(pendingKey, true), 'STORAGE_FAILED', '历史写入已保存，收尾待重试');
  }
  function read(key, fallback = null) {
    if (managed.includes(key)) cleanup();
    const value = storage.get(key, fallback);
    return readLocalHistory(value, getRaw, owner());
  }
  return {
    ...storage,
    get: read,
    save(key, value, silent = true) {
      if (!managed.includes(key)) return storage.save(key, value, silent);
      historyAssert(canCleanup(), 'OTHER_WINDOW_ACTIVE', '另一窗口正在保存历史，请稍后重试');
      cleanup();
      const text = JSON.stringify(value);
      if (text.length < HISTORY_LIMITS.pageCharacters) {
        const saved = storage.save(key, value, silent);
        if (saved) cleanup();
        return saved;
      }
      // 恢复副本复用完整相同的已保存页面；不只凭校验和认定内容相同。
      for (const candidate of managed.map(getRaw).filter((v) => v?.format === HISTORY_FORMAT && v.owner === owner()))
        if (JSON.stringify(readLocalHistory(candidate, getRaw, owner())) === text) {
          const saved = storage.save(key, candidate, silent);
          if (saved) cleanup();
          return saved;
        }
      const generation = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
      const { manifest, pages } = encodeHistory(value, owner(), generation, HISTORY_LIMITS.stateCharacters * 2);
      put(pendingKey, { owner: owner(), record: { generation, count: pages.length } });
      try {
        pages.forEach((text, index) =>
          put(historyPageKey(generation, index), encodeLocalPage({ owner: owner(), generation, index, text }))
        );
        // 原子替换小目录，未完成的分页永不成为当前事实。
        put(key, manifest);
        cleanup();
        return true;
      } catch (error) {
        // 收尾失败保留无正文 journal，下一读取继续；根指针未写入时原记录仍在。
        throw error;
      }
    },
    remove(key, silent = true) {
      if (managed.includes(key)) historyAssert(canCleanup(), 'OTHER_WINDOW_ACTIVE', '另一窗口正在保存历史，请稍后重试');
      const result = storage.remove(key, silent);
      if (result && managed.includes(key)) cleanup();
      return result;
    },
    getGuestLearningSnapshot: () => storage.getGuestLearningSnapshot?.(),
    clearHistoryCatalog() {
      cleanup();
      historyAssert(records().length === 0, 'PRECONDITION', '尚有正在使用的历史分页');
      return getRaw(catalogKey) === null || storage.remove(catalogKey, true);
    },
    inspectHistory() {
      cleanup();
      return {
        format: HISTORY_FORMAT,
        generations: records().length,
        pages: records().reduce((sum, item) => sum + item.count, 0),
        maxCharacters: HISTORY_LIMITS.stateCharacters
      };
    }
  };
}
