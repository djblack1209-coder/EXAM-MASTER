import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StorageService } from '@/services/storageService.js';
import { captureSession, checkSession, getToken } from '@/services/auth-storage.js';
import { createPinia, setActivePinia } from 'pinia';
import { useConversationLearningStore } from '@/stores/modules/conversation-learning.js';
import { workspaceDrafts } from '@/services/learning/workspace-drafts.js';
import ProfilePage from '@/pages/profile/index.vue';

let storage;
beforeEach(() => {
  uni.clearStorageSync();
  storage = new StorageService();
  storage.saveLoginSession({ userId: 'reset-owner', token: 'fixture-reset-token', userInfo: { id: 'reset-owner' } });
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  uni.clearStorageSync();
});
const snapshot = () => Object.fromEntries(uni.getStorageInfoSync().keys.map((k) => [k, uni.getStorageSync(k)]));
describe('explicit local reset transaction', () => {
  it('clears all local account records, material/history copies, secrets and preferences and invalidates old work', async () => {
    const session = captureSession();
    for (const key of [
      'u_reset-owner_conversation_learning_v1',
      'u_other_conversation_learning_v1_history_page_1',
      'conversation_learning_v1_recovery',
      'draft',
      'material_cache',
      'ai_connection',
      '_enc_apiKey',
      'theme_mode',
      'language'
    ])
      uni.setStorageSync(key, { private: 'synthetic' });
    expect(await storage.resetLocalData(session)).toEqual({ success: true });
    expect(captureSession().owner).toBe('guest');
    expect(getToken()).toBeNull();
    expect(checkSession(session)).toBe('changed');
    expect(
      uni
        .getStorageInfoSync()
        .keys.every((k) =>
          [
            'EXAM_IDENTITY_GENERATION',
            'EXAM_SESSION_ENABLED',
            'EXAM_SESSION_REVOCATION',
            'EXAM_LOGIN_ATTEMPT'
          ].includes(k)
        )
    ).toBe(true);
    expect(storage.save('conversation_learning_v1', { stale: true }, true, session)).toBe(false);
  });
  it('coalesces repeated confirmations and never deletes a later login on an old confirmation', async () => {
    const session = captureSession(),
      write = vi.spyOn(uni, 'removeStorageSync');
    const one = storage.resetLocalData(session),
      two = storage.resetLocalData(session);
    expect(one).toBe(two);
    expect((await one).success).toBe(true);
    storage.saveLoginSession({ userId: 'later', token: 'fixture-later', userInfo: {} });
    const count = write.mock.calls.length;
    await storage.resetLocalData(session);
    expect(write.mock.calls.length).toBe(count);
    expect(captureSession().owner).toBe('later');
  });
  it.each(['throw', 'silent'])(
    'rolls back a %s deletion failure and permits retry without a disk backup',
    async (mode) => {
      uni.setStorageSync('u_reset-owner_conversation_learning_v1', { draft: 'private fixture' });
      uni.setStorageSync('_enc_apiKey', 'fixture-secret');
      const before = snapshot(),
        session = captureSession(),
        original = uni.removeStorageSync;
      let failed = false;
      const remove = vi.spyOn(uni, 'removeStorageSync').mockImplementation((key) => {
        if (key === '_enc_apiKey' && !failed) {
          failed = true;
          if (mode === 'throw') throw new Error('disk failure');
          return;
        }
        return original(key);
      });
      expect(await storage.resetLocalData(session)).toEqual({ success: false, code: 'RESET_ROLLED_BACK' });
      expect(snapshot()).toEqual(before);
      expect(checkSession(session)).toBe('current');
      remove.mockRestore();
      expect((await storage.resetLocalData(session)).success).toBe(true);
    }
  );
  it('refuses a changed account and an unavailable learning write lease before deleting anything', async () => {
    const session = captureSession(),
      before = snapshot();
    const result = await storage.resetLocalData(session, {
      assertWritable: () => {
        throw new Error('other writer');
      }
    });
    expect(result.success).toBe(false);
    expect(snapshot()).toEqual(before);
    storage.saveLoginSession({ userId: 'changed', token: 'fixture-new', userInfo: {} });
    const changed = snapshot();
    expect((await storage.resetLocalData(session)).success).toBe(false);
    expect(snapshot()).toEqual(changed);
  });
  it('opening/cancelling confirmation writes nothing; only explicit confirm resets and navigates', async () => {
    const reset = vi.fn().mockResolvedValue({ success: true });
    const page = {
      resetBusy: false,
      resetError: '',
      dialogSequence: 0,
      showDialog: false,
      dialog: {},
      learning: { resetLocalData: reset },
      themeStore: { $reset: vi.fn() }
    };
    const before = snapshot();
    ProfilePage.methods.handleLocalReset.call(page);
    expect(page.dialog.kind).toBe('reset');
    expect(page.dialog.content).toContain('云端保险库不删除');
    page.showDialog = false; // CustomModal cancel only closes its own visibility.
    expect(snapshot()).toEqual(before);
    expect(reset).not.toHaveBeenCalled();
    ProfilePage.methods.handleLocalReset.call(page);
    await ProfilePage.methods.confirmDialog.call(page);
    expect(reset).toHaveBeenCalledOnce();
    // Core shell actions use the committed safe navigation contract, including its fallback callbacks.
    expect(uni.navigateTo).toHaveBeenCalledOnce();
    expect(uni.navigateTo).toHaveBeenCalledWith({
      url: '/pages/index/index',
      animationType: 'slide-in-right',
      animationDuration: 300,
      success: expect.any(Function),
      fail: expect.any(Function),
      complete: expect.any(Function)
    });
    expect(uni.reLaunch).not.toHaveBeenCalled();
  });
  it('keeps failed resets retryable and preference options draft-only', async () => {
    const page = {
      resetBusy: false,
      resetError: '',
      dialog: { kind: 'reset', session: captureSession() },
      learning: { resetLocalData: vi.fn().mockResolvedValue({ success: false, code: 'RESET_ROLLED_BACK' }) }
    };
    await ProfilePage.methods.confirmDialog.call(page);
    expect(page.resetBusy).toBe(false);
    expect(page.resetError).toContain('请重试');
    const before = snapshot();
    ProfilePage.methods.chooseAppearance.call(page, 'dark');
    ProfilePage.methods.chooseLanguage.call(page, 'en');
    expect(page.draftAppearance).toBe('dark');
    expect(page.draftLanguage).toBe('en');
    expect(snapshot()).toEqual(before);
  });
});

it('the real store returns a successful reset receipt despite intentionally revoking its originating session', async () => {
  setActivePinia(createPinia());
  const store = useConversationLearningStore();
  store.refresh();
  const session = captureSession(),
    context = store.recordContext(),
    drafts = workspaceDrafts(store);
  drafts.save(context, 'composer', { text: 'synthetic draft' });
  store.localConnection = { token: 'synthetic-connection-token', endpoint: 'http://127.0.0.1:12345' };
  store.modelId = 'fixture';
  store.models = [{ id: 'fixture' }];
  const receipt = await store.resetLocalData(session);
  expect(receipt.success).toBe(true);
  expect(checkSession(session)).toBe('changed');
  expect(store.state.conversations).toEqual([]);
  expect(store.localConnection).toBeNull();
  expect(store.modelId).toBe('');
  expect(store.models).toEqual([]);
  expect(drafts.read(store.recordContext(), 'composer')).toEqual({});
  store.$dispose();
});

it('clears physical uni H5 preferences with the compatibility journal, preserves unrelated origin keys and rolls both back together', async () => {
  const values = new Map([
    ['yozi_language', '{"data":"en","type":"string"}'],
    ['theme_mode', 'light'],
    ['unrelated-editor', 'keep']
  ]);
  const raw = {
    get length() {
      return values.size;
    },
    key: (i) => [...values.keys()][i],
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: vi.fn((key) => {
      if (key === 'theme_mode' && fail) {
        fail = false;
        throw Error('fixture');
      }
      values.delete(key);
    })
  };
  let fail = true;
  vi.stubGlobal('localStorage', raw);
  const session = captureSession();
  expect((await storage.resetLocalData(session)).code).toBe('RESET_ROLLED_BACK');
  expect(values.get('yozi_language')).toContain('en');
  expect(values.get('theme_mode')).toBe('light');
  expect((await storage.resetLocalData(session)).success).toBe(true);
  expect([...values.entries()]).toEqual([['unrelated-editor', 'keep']]);
});
