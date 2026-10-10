import { storageService } from '../storageService.js';
import { getUserId } from '../auth-storage.js';
import { learningRepository } from './learning-repository.js';
import { assert } from './learning-domain.js';
export const UPLOAD_PENDING_KEY = 'conversation_learning_v1_upload_pending';
export const MAX_PENDING_UPLOADS = 20;
export function createPendingUploadJournal(
  storage = storageService,
  owner = () => getUserId() || 'guest',
  write = () => learningRepository.assertWriteAccess()
) {
  function validateEntries(entries) {
    assert(entries.length <= MAX_PENDING_UPLOADS, 'RESOURCE_LIMIT', '导入待办已达上限，请先处理未确认原件');
    for (const e of entries) {
      let validOrigin = false;
      try {
        validOrigin =
          typeof e?.connectorOrigin === 'string' &&
          e.connectorOrigin.length <= 512 &&
          new URL(e.connectorOrigin).origin === e.connectorOrigin;
      } catch {
        /* 保留原待办，不覆盖损坏登记。 */
      }
      assert(
        e &&
          Object.keys(e).length === 7 &&
          typeof e.id === 'string' &&
          /^[a-zA-Z0-9_-]{8,80}$/.test(e.id) &&
          validOrigin &&
          typeof e.storageId === 'string' &&
          /^[a-f0-9]{32}$/.test(e.storageId) &&
          Number.isSafeInteger(e.size) &&
          e.size > 0 &&
          e.size <= 10485760 &&
          typeof e.recognitionAllowed === 'boolean' &&
          ['tesseract', 'apple-vision', 'docling'].includes(e.recognitionEngine) &&
          Number.isSafeInteger(e.createdAt) &&
          e.createdAt >= 0,
        'INVALID_JOURNAL',
        '未确认原件登记不合法，原待办保留'
      );
    }
    assert(new Set(entries.map((e) => e.id)).size === entries.length, 'INVALID_JOURNAL', '导入登记编号冲突，待办保留');
  }
  function list() {
    const journal = storage.get(UPLOAD_PENDING_KEY, null);
    assert(
      journal === null ||
        (journal.owner === owner() &&
          journal.contract === 'wenli-upload-journal-v1' &&
          Array.isArray(journal.entries) &&
          journal.entries.length <= MAX_PENDING_UPLOADS &&
          Object.keys(journal).length === 3),
      'INVALID_JOURNAL',
      '未确认原件登记不合法，原待办保留'
    );
    const entries = journal?.entries || [];
    validateEntries(entries);
    return JSON.parse(JSON.stringify(entries));
  }
  function save(entries, expectedOwner) {
    assert(owner() === expectedOwner, 'CONTEXT_CHANGED', '账户已变化，原导入待办保留');
    validateEntries(entries);
    write();
    const journal = { owner: owner(), contract: 'wenli-upload-journal-v1', entries };
    assert(JSON.stringify(journal).length <= 25000, 'RESOURCE_LIMIT', '导入待办已达上限，请先处理未确认原件');
    assert(storage.save(UPLOAD_PENDING_KEY, journal, true), 'STORAGE_FAILED', '导入待办保存失败，未继续发送或确认完成');
  }
  return {
    list,
    add(entry, expectedOwner) {
      const entries = list();
      assert(
        entries.length < MAX_PENDING_UPLOADS && !entries.some((e) => e.id === entry.id),
        'RESOURCE_LIMIT',
        '导入待办已达上限或编号冲突，请先核对原件'
      );
      const item = {
        id: entry.id,
        connectorOrigin: entry.connectorOrigin,
        storageId: entry.storageId,
        size: entry.size,
        recognitionAllowed: entry.recognitionAllowed,
        recognitionEngine: entry.recognitionEngine,
        createdAt: entry.createdAt === undefined ? Date.now() : entry.createdAt
      };
      save([...entries, item], expectedOwner);
      return list();
    },
    remove(id, expectedOwner) {
      save(
        list().filter((e) => e.id !== id),
        expectedOwner
      );
      return list();
    }
  };
}
export const pendingUploadJournal = createPendingUploadJournal();
