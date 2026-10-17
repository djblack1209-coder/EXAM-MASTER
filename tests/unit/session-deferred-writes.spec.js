import { seedLegacyTask } from '../fixtures/legacy-queue.js';
import { afterEach, beforeEach, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { storageService } from '@/services/storageService.js';
import { captureSession, checkSession, getUserId } from '@/services/auth-storage.js';
import { createNewCard, scheduleCard, saveCardState, loadCardState } from '@/services/fsrs-service.js';
import { OfflineQueue } from '@/utils/core/offline-queue.js';
import { saveQuizProgress, clearQuizProgress, isQuizProgressComplete } from '@/composables/useQuizAutoSave.js';
const originalRead = uni.getStorageSync.getMockImplementation();
const source = readFileSync('src/pages/practice-sub/do-quiz.vue', 'utf8');
// Execute the real page methods without a platform UI runtime.
function method(name, end) {
  const start =
    source.indexOf(`    ${name}(`) >= 0 ? source.indexOf(`    ${name}(`) : source.indexOf(`    async ${name}(`);
  const text = source.slice(start, source.indexOf(end, start));
  return new Function(
    'storageService',
    'uni',
    'checkSession',
    'quizRecordOwnerMatches',
    'clearQuizProgress',
    'saveQuizProgress',
    'isQuizProgressComplete',
    'getQuestionTime',
    'logger',
    `return ({${text}}).${name}`
  )(
    storageService,
    uni,
    checkSession,
    (p) => p.quizRecordOwner === (getUserId() || ''),
    clearQuizProgress,
    saveQuizProgress,
    isQuizProgressComplete,
    () => ({ elapsedMs: 0 }),
    { log() {} }
  );
}
const stats = method('updateStudyStats', '    formatFsrsInterval(');
const save = method('saveCurrentProgress', '    initSystemUI(');
const login = (n = 1) =>
  storageService.saveLoginSession({ userId: `account-${n}`, token: `fixture-${n}`, userInfo: { id: `account-${n}` } });
beforeEach(() => {
  uni.getStorageSync.mockImplementation(originalRead);
  uni.clearStorageSync();
  login();
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
it('WRITES-1: scheduled FSRS card retains origin through delayed persistence', () => {
  const card = scheduleCard(createNewCard(), 'good').card;
  login(2);
  expect(saveCardState('fixture', card)).toBe(false);
  expect(loadCardState('fixture')).toBeNull();
});
it('WRITES-1: unbound card requires an explicit origin', () => {
  const card = structuredClone(createNewCard());
  expect(saveCardState('fixture', card)).toBe(false);
  expect(saveCardState('fixture', card, captureSession())).toBe(true);
});
it('WRITES-2: answer counters never migrate from A into B', async () => {
  await stats.call({ boundLoginSession: captureSession() });
  storageService._clearRevokedCredentials();
  login(2);
  storageService.migrateUserKeys();
  expect(storageService.get('today_answer_count', null)).toBeNull();
  expect(storageService.get('study_stats', {})).toEqual({});
});
it('WRITES-2: stale stats page writes no global counter', async () => {
  const boundLoginSession = captureSession();
  login();
  const before = JSON.stringify(global.__mockStorage);
  await stats.call({ boundLoginSession });
  expect(JSON.stringify(global.__mockStorage)).toBe(before);
});
it('WRITES-2: ambiguous raw keys cannot migrate on login or read', () => {
  uni.setStorageSync('ambiguous_data', { owner: 'account-1' });
  storageService.migrateUserKeys();
  expect(storageService.get('ambiguous_data', null)).toBeNull();
  expect(uni.getStorageSync('ambiguous_data')).toEqual({ owner: 'account-1' });
});
it('WRITES-3: old practice lifecycle cannot replace same-account new progress', () => {
  const boundLoginSession = captureSession();
  login();
  const progress = {
    currentIndex: 1,
    hasAnswered: false,
    answeredQuestions: [],
    questions: [{ id: 'new' }, { id: 'new2' }]
  };
  expect(saveQuizProgress(progress, true)).toBe(true);
  const before = JSON.stringify(global.__mockStorage);
  save.call(
    { ...progress, questions: [{ id: 'old' }, { id: 'old2' }], quizRecordOwner: 'account-1', boundLoginSession },
    true
  );
  expect(JSON.stringify(global.__mockStorage)).toBe(before);
});
it('WRITES-4: local mistake removal receives the mutex session', async () => {
  storageService._clearRevokedCredentials();
  storageService.save('mistake_book', [{ id: 'local-fixture' }], true);
  expect(await storageService.removeMistake('local-fixture')).toMatchObject({ success: true });
  expect(storageService.get('mistake_book', [])).toEqual([]);
});
it('inflight-1: queued login cannot survive logout', async () => {
  const writes = [];
  vi.stubGlobal('navigator', {
    locks: {
      request: (_name, _options, fn) =>
        new Promise((resolve, reject) => {
          writes.push(() => {
            try {
              resolve(fn());
            } catch (error) {
              reject(error);
            }
          });
        })
    }
  });
  const pending = Promise.resolve(login(2)).catch((error) => error);
  vi.stubGlobal('navigator', {});
  await storageService._clearRevokedCredentials();
  writes.shift()();
  expect(await pending).toBeInstanceOf(Error);
  expect(captureSession()?.owner).toBe('guest');
});
it('inflight-3: unavailable queue initialization preserves pending payload', () => {
  const session = captureSession();
  const item = { id: 'fixture', timestamp: Date.now(), session, requestData: { value: 1 } };
  uni.setStorageSync('EXAM_OFFLINE_QUEUE', [item]);
  const read = uni.getStorageSync.getMockImplementation();
  vi.spyOn(uni, 'getStorageSync').mockImplementation((key) => {
    if (key === '_enc_EXAM_SESSION_EPOCH') throw new Error('fixture read failure');
    return read(key);
  });
  const queue = new OfflineQueue();
  expect(queue.queue).toHaveLength(1);
  expect(uni.getStorageSync('EXAM_OFFLINE_QUEUE')).toEqual([item]);
});

it('WRITES-1: copied cards cannot acquire the next account through scheduling', () => {
  const card = structuredClone(createNewCard());
  login(2);
  expect(() => scheduleCard(card, 'good')).toThrow();
});
it('WRITES-1: an explicit current session cannot overwrite an existing card binding', () => {
  const card = createNewCard();
  login(2);
  expect(saveCardState('fixture', card, captureSession())).toBe(false);
});
it('WRITES-2: proven guest values migrate once, changed raw values stay unassigned', () => {
  storageService._clearRevokedCredentials();
  storageService.save('guest_note', { text: 'guest' }, true);
  storageService.save('guest_changed', { text: 'guest' }, true);
  login();
  uni.setStorageSync('guest_changed', { text: 'new unscoped value' });
  expect(storageService.migrateUserKeys()).toBe(1);
  expect(storageService.get('guest_note')).toEqual({ text: 'guest' });
  expect(storageService.get('guest_changed', null)).toBeNull();
  expect(uni.getStorageSync('guest_changed')).toEqual({ text: 'new unscoped value' });
});
it('inflight-3: unavailable after request completion preserves retry count and pending work', async () => {
  const queue = new OfflineQueue();
  queue.isOnline = false;
  let blocked = false;
  const read = uni.getStorageSync.getMockImplementation();
  vi.spyOn(uni, 'getStorageSync').mockImplementation((key) => {
    if (blocked && key === '_enc_EXAM_SESSION_EPOCH') throw new Error('fixture unavailable');
    return read(key);
  });
  seedLegacyTask(queue, {
    requestFn: async () => {
      blocked = true;
    },
    requestData: { fixture: true }
  });
  queue.queue[0].retryCount = 2;
  queue._saveToStorage(queue.queue[0]);
  queue.isOnline = true;
  await queue.processQueue();
  expect(queue.queue).toHaveLength(1);
  expect(queue.queue[0].retryCount).toBe(2);
  blocked = false;
});
