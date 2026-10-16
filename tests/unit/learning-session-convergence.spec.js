import { afterEach, beforeEach, it, expect, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { watch } from 'vue';
import { storageService } from '@/services/storageService.js';
import { captureSession, checkSession, sessionCredentialProof } from '@/services/auth-storage.js';
import { obfuscate } from '@/utils/crypto/cipher.js';
import { useConversationLearningStore } from '@/stores/modules/conversation-learning.js';
let store;
const originalRead = uni.getStorageSync.getMockImplementation();
const login = (n = 1) =>
  storageService.saveLoginSession({ userId: `account-${n}`, token: `fixture-${n}`, userInfo: { id: `account-${n}` } });
function peer(n = 2) {
  for (const [key, value] of [
    ['EXAM_USER_ID', `account-${n}`],
    ['EXAM_TOKEN', `fixture-${n}`],
    [
      'EXAM_SESSION_EPOCH',
      {
        version: 1,
        epoch: `fixture-epoch-${n}`,
        owner: `account-${n}`,
        proof: sessionCredentialProof(`account-${n}`, `fixture-${n}`)
      }
    ]
  ])
    uni.setStorageSync(`_enc_${key}`, obfuscate(value));
}
function unavailable() {
  const read = uni.getStorageSync.getMockImplementation();
  return vi.spyOn(uni, 'getStorageSync').mockImplementation((key) => {
    if (key === '_enc_EXAM_SESSION_EPOCH') throw new Error('fixture read failure');
    return read(key);
  });
}
beforeEach(() => {
  uni.getStorageSync.mockImplementation(originalRead);
  uni.clearStorageSync();
  login();
  setActivePinia(createPinia());
  store = useConversationLearningStore();
  store.start('12 + 8');
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  store?.$dispose();
});
it('S6: guard-reentry-private-write-rejected', () => {
  store.sharingAllowed = true;
  let accepted = false;
  let calls = 0;
  const stop = watch(
    () => store.sharingAllowed,
    () => {
      if (++calls > 4) return;
      try {
        store.commit('profile.set', { field: 'foundation', value: 'stale', source: 'self_report', scope: 'fixture' });
        accepted = true;
      } catch {}
    },
    { flush: 'sync' }
  );
  peer();
  try {
    store.ensureSessionCurrent();
  } catch {}
  stop();
  expect(accepted).toBe(false);
  expect(calls).toBeLessThan(4);
  expect(store.state.owner).toBe('account-2');
});
it('S7: queued-old-removal-first-action-on-new-session', () => {
  peer();
  store.refresh();
  store.sharingAllowed = true;
  window.dispatchEvent(
    new StorageEvent('storage', { key: '_enc_EXAM_SESSION_EPOCH', oldValue: 'fixture-old', newValue: null })
  );
  expect(() => store.start('12 + 8')).not.toThrow();
  expect(store.state.owner).toBe('account-2');
});
it('regress-11-01: unavailable record notification preserves resources and visible facts', () => {
  store.models = [{ id: 'kept' }];
  store.modelPresets = [{ id: 'preset' }];
  store.usage = { spent: 1 };
  store.materialConnection = { endpoint: 'fixture' };
  const before = JSON.stringify(store.state);
  const session = captureSession();
  const read = unavailable();
  window.dispatchEvent(new StorageEvent('storage', { key: 'u_account-1_conversation_learning_v1' }));
  expect(store.models).toEqual([{ id: 'kept' }]);
  expect(store.modelPresets).toEqual([{ id: 'preset' }]);
  expect(store.usage).toEqual({ spent: 1 });
  expect(store.materialConnection).toEqual({ endpoint: 'fixture' });
  expect(JSON.stringify(store.state)).toBe(before);
  expect(store.error).toMatch(/重试/);
  read.mockImplementation(originalRead);
  expect(checkSession(session)).toBe('current');
  store.refresh();
  expect(JSON.stringify(store.state)).toBe(before);
});
it('regress-11-02: unavailable permits render and local cancellation, blocks writes', async () => {
  store.selectedMode = 'local';
  store.sharingAllowed = true;
  store.modelId = 'fixture';
  store.localConnection = {
    endpoint: 'http://127.0.0.1:8765/chat',
    allowedOrigins: ['http://127.0.0.1:8765'],
    token: 'TEST_ONLY_LOCAL_TOKEN_32_CHARACTERS',
    model: 'fixture',
    consent: true
  };
  let signal;
  vi.stubGlobal(
    'fetch',
    vi.fn((_url, options) => {
      signal = options.signal;
      return new Promise(() => {});
    })
  );
  const sending = store.send('继续');
  const settled = sending.catch(() => undefined);
  await Promise.resolve();
  expect(signal).toBeTruthy();
  const read = unavailable();
  expect(() => store.recordContext()).not.toThrow();
  expect(() => store.cancel()).not.toThrow();
  expect(signal.aborted).toBe(true);
  expect(() =>
    store.commit('profile.set', { field: 'foundation', value: 'blocked', source: 'self_report', scope: 'fixture' })
  ).toThrow(/重试/);
  read.mockImplementation(originalRead);
  peer();
  store.refresh();
  await settled;
});
it('regress-11-01: mid-read unavailability also preserves rendered projection', () => {
  const before = JSON.stringify(store.state);
  const context = store.recordContext();
  store.modelId = 'kept-model';
  store.materialConnection = { endpoint: 'kept' };
  const read = uni.getStorageSync.getMockImplementation();
  let blocked = false;
  vi.spyOn(uni, 'getStorageSync').mockImplementation((key) => {
    if (blocked && key === '_enc_EXAM_SESSION_EPOCH') throw new Error('fixture mid-read');
    const value = read(key);
    if (key === 'u_account-1_conversation_learning_v1') blocked = true;
    return value;
  });
  store.reloadRecords();
  expect(store.recordReadState).toBe('ready');
  expect(store.modelId).toBe('kept-model');
  expect(store.materialConnection).toEqual({ endpoint: 'kept' });
  expect(JSON.stringify(store.state)).toBe(before);
  expect(store.recordContext()).toBe(context);
});
