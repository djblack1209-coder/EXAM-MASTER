/**
 * storageService.js 单元测试
 * T001/T006: 核心服务层测试覆盖
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as practiceApi from '@/services/api/domains/practice.api.js';
import { getLoginSessionEpoch, getToken, getUserId } from '@/services/auth-storage.js';
import { obfuscate, deobfuscate } from '@/utils/crypto/cipher.js';

// Mock logger
vi.mock('@/utils/logger.js', () => ({
  logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
  default: { log: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() }
}));

// 存储单元测试隔离现有练习 API，允许专门验证存储运行时的延迟挂载。
vi.mock('@/services/api/domains/practice.api.js', () => ({
  addMistake: vi.fn().mockResolvedValue({ code: 0, data: {} }),
  getMistakes: vi.fn().mockResolvedValue({ code: 0, data: [] }),
  removeMistake: vi.fn().mockResolvedValue({ code: 0 }),
  batchRemoveMistakes: vi.fn().mockResolvedValue({ code: 0 }),
  updateMistakeStatus: vi.fn().mockResolvedValue({ code: 0 }),
  updateMistakeFields: vi.fn().mockResolvedValue({ code: 0 }),
  batchSyncMistakes: vi.fn().mockResolvedValue({ code: 0 })
}));

describe('storageService', () => {
  let storageService;

  beforeEach(async () => {
    Object.values(practiceApi).forEach((method) => method.mockReset());
    practiceApi.addMistake.mockResolvedValue({ code: 0, data: {} });
    practiceApi.getMistakes.mockResolvedValue({ code: 0, data: [] });
    practiceApi.removeMistake.mockResolvedValue({ ok: true, deleted: 1, code: 0 });
    practiceApi.batchRemoveMistakes.mockResolvedValue({ ok: true, deleted: 1, code: 0 });
    practiceApi.updateMistakeStatus.mockResolvedValue({ code: 0 });
    practiceApi.updateMistakeFields.mockResolvedValue({ code: 0 });
    practiceApi.batchSyncMistakes.mockResolvedValue({ code: 0 });
    global.__mockStorage = {};
    const mod = await import('@/services/storageService.js');
    storageService = mod.storageService;
  });

  describe('统一身份变化订阅', () => {
    it.each([
      'EXAM_USER_ID',
      'EXAM_TOKEN',
      'EXAM_SESSION_EPOCH',
      'userInfo',
      'EXAM_USER_INFO',
      'access_token',
      'refresh_token',
      'token_expire_time'
    ])('%s 的加密保存、全部浏览器别名与删除都通知，取消订阅后停止', (key) => {
      const listener = vi.fn();
      const stop = storageService.onIdentityChange(listener);
      try {
        expect(storageService.save(key, 'synthetic-identity-value', true)).toBe(true);
        expect(uni.getStorageSync(key)).toBe('');
        expect(uni.getStorageSync(`_enc_${key}`)).toBeTruthy();
        expect(listener).toHaveBeenCalledTimes(1);
        for (const alias of [key, `_enc_${key}`, `__exam_storage__:${key}`, `__exam_storage__:_enc_${key}`]) {
          window.dispatchEvent(new StorageEvent('storage', { key: alias }));
        }
        expect(listener).toHaveBeenCalledTimes(5);
        storageService.remove(key, true);
        expect(listener).toHaveBeenCalledTimes(6);
        window.dispatchEvent(new StorageEvent('storage', { key: 'theme_mode' }));
        expect(listener).toHaveBeenCalledTimes(6);
        stop();
        storageService.save(key, 'later-synthetic-identity', true);
        window.dispatchEvent(new StorageEvent('storage', { key: `_enc_${key}` }));
        expect(listener).toHaveBeenCalledTimes(6);
      } finally {
        stop();
      }
    });
    it('clear、当前账户资料清理与兼容登录事件共用通知；无关账户清理不通知', () => {
      storageService.save('EXAM_USER_ID', 'identity-cleanup-owner', true);
      storageService.save('temporary-data', 'synthetic', true);
      const listener = vi.fn();
      const stop = storageService.onIdentityChange(listener);
      try {
        storageService.clearUserData('another-owner');
        expect(listener).not.toHaveBeenCalled();
        storageService.clearUserData();
        expect(listener).toHaveBeenCalledOnce();
        expect(listener).toHaveBeenLastCalledWith({ type: 'records' });
        for (const event of ['user:logout', 'loginStatusChanged', 'auth:userdata', 'auth:restore']) {
          uni.$on.mock.calls.findLast(([name]) => name === event)[1]();
          expect(listener).toHaveBeenLastCalledWith(event === 'user:logout' ? { type: 'logout' } : undefined);
        }
        expect(listener).toHaveBeenCalledTimes(5);
        window.dispatchEvent(new StorageEvent('storage', { key: null }));
        expect(listener).toHaveBeenCalledTimes(6);
        expect(listener).toHaveBeenLastCalledWith({ type: 'logout' });
        storageService.clear(true, { preserveGlobal: false });
        expect(listener).toHaveBeenCalledTimes(7);
      } finally {
        stop();
      }
    });
  });

  describe('登录会话代号', () => {
    const identity = { userId: 'epoch-upgrade-owner', token: 'synthetic-epoch-token', userInfo: { nickname: '合成' } };
    it('成功登录原子通知并加密保存；同账户同令牌再次登录也换代', () => {
      const snapshots = [];
      const stop = storageService.onIdentityChange(() => snapshots.push([getUserId(), getLoginSessionEpoch()]));
      try {
        storageService.saveLoginSession(identity);
        const first = getLoginSessionEpoch();
        expect(first).toBeTruthy();
        expect(snapshots).toEqual([[identity.userId, first]]);
        expect(uni.getStorageSync('EXAM_SESSION_EPOCH')).toBe('');
        expect(uni.getStorageSync('_enc_EXAM_SESSION_EPOCH')).not.toContain(first);
        storageService.saveLoginSession(identity);
        expect(getLoginSessionEpoch()).not.toBe(first);
        expect(snapshots).toHaveLength(2);
        expect(snapshots[1]).toEqual([identity.userId, getLoginSessionEpoch()]);
      } finally {
        stop();
      }
    });
    it('已有无代号身份首次读取升级，不强制退出或重写身份，再读复用', () => {
      uni.setStorageSync('EXAM_USER_ID', identity.userId);
      uni.setStorageSync('EXAM_TOKEN', identity.token);
      expect(getLoginSessionEpoch()).toBeNull();
      const epoch = storageService.getSessionEpoch();
      expect(epoch).toBeTruthy();
      expect(storageService.getSessionEpoch()).toBe(epoch);
      expect(getUserId()).toBe(identity.userId);
      expect(getToken()).toBe(identity.token);
      expect(uni.getStorageSync('EXAM_TOKEN')).toBe(identity.token);
    });
    it('访客或身份不完整不生成代号', () => {
      expect(storageService.getSessionEpoch()).toBeNull();
      storageService.save('EXAM_USER_ID', identity.userId, true);
      expect(storageService.getSessionEpoch()).toBeNull();
      expect(uni.getStorageSync('_enc_EXAM_SESSION_EPOCH')).toBe('');
    });
    it.each(['plain', 'empty-plain', 'encrypted-prefix'])(
      '%s浏览器迁移先写新格式再删旧格式，事件不发撤销且无敏感迁移元数据',
      (format) => {
        const listener = vi.fn(),
          stop = storageService.onIdentityChange(listener);
        const events = [];
        localStorage.clear();
        vi.stubGlobal('uni', {});
        const set = localStorage.setItem.getMockImplementation(),
          remove = localStorage.removeItem.getMockImplementation();
        try {
          storageService.saveLoginSession(identity);
          const epoch = getLoginSessionEpoch();
          const source = format === 'encrypted-prefix' ? '_enc_EXAM_TOKEN' : 'EXAM_TOKEN';
          if (format !== 'empty-plain') localStorage.removeItem('__exam_storage__:_enc_EXAM_TOKEN');
          localStorage.setItem(
            source,
            format === 'empty-plain' ? '' : format === 'plain' ? identity.token : obfuscate(identity.token)
          );
          const setSpy = vi.spyOn(localStorage, 'setItem').mockImplementation((key, value) => {
            const oldValue = localStorage.getItem(key);
            set(key, value);
            events.push({ key, oldValue, newValue: value });
          });
          const removeSpy = vi.spyOn(localStorage, 'removeItem').mockImplementation((key) => {
            const oldValue = localStorage.getItem(key);
            remove(key);
            if (oldValue !== null) events.push({ key, oldValue, newValue: null });
          });
          listener.mockClear();
          expect(storageService.save('EXAM_TOKEN', identity.token, true)).toBe(true);
          for (const event of events) window.dispatchEvent(new StorageEvent('storage', event));
          expect(listener.mock.calls.every(([change]) => change?.type !== 'logout')).toBe(true);
          expect(getLoginSessionEpoch()).toBe(epoch);
          expect(getToken()).toBe(identity.token);
          const newWrite = events.findIndex(
            (event) => event.key === '__exam_storage__:_enc_EXAM_TOKEN' && event.newValue !== null
          );
          const oldDelete = events.findIndex((event) => event.key === source && event.newValue === null);
          expect(oldDelete).toBeGreaterThan(newWrite);
          for (const event of events.filter((event) => event.key.startsWith('__exam_identity_migration_v1:'))) {
            expect(JSON.stringify(event)).not.toContain(identity.token);
            expect(JSON.stringify(event)).not.toContain(epoch);
          }
          expect(
            Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i)).some((key) =>
              key.startsWith('__exam_identity_migration_v1:')
            )
          ).toBe(false);
          // The same removal after the bracket is a real revocation, even with restored identity.
          window.dispatchEvent(
            new StorageEvent('storage', { key: source, oldValue: 'synthetic-old-value', newValue: null })
          );
          expect(listener).toHaveBeenLastCalledWith({ type: 'logout' });
          setSpy.mockRestore();
          removeSpy.mockRestore();
        } finally {
          stop();
          vi.unstubAllGlobals();
          localStorage.clear();
        }
      }
    );
    it('加密迁移写入未成功时保留明文与会话代号', () => {
      storageService.saveLoginSession(identity);
      const epoch = getLoginSessionEpoch();
      uni.removeStorageSync('_enc_EXAM_TOKEN');
      uni.setStorageSync('EXAM_TOKEN', identity.token);
      const write = uni.setStorageSync.getMockImplementation();
      const spy = vi.spyOn(uni, 'setStorageSync').mockImplementation((key, value) => {
        if (key === '_enc_EXAM_TOKEN') throw new Error('SYNTHETIC_QUOTA_FAILURE');
        write(key, value);
      });
      try {
        expect(storageService.save('EXAM_TOKEN', identity.token, true)).toBe(false);
        expect(uni.getStorageSync('EXAM_TOKEN')).toBe(identity.token);
        expect(getLoginSessionEpoch()).toBe(epoch);
      } finally {
        spy.mockRestore();
      }
    });
    it('续期、重复保存、资料更新和保留全局的清理均不换代', () => {
      storageService.saveLoginSession(identity);
      const epoch = getLoginSessionEpoch();
      for (const [key, value] of [
        ['EXAM_TOKEN', 'synthetic-refreshed-token'],
        ['EXAM_USER_ID', identity.userId],
        ['userInfo', { nickname: '更新' }],
        ['access_token', 'synthetic-access-token'],
        ['refresh_token', 'synthetic-refresh-token'],
        ['token_expire_time', 1234567890]
      ]) {
        storageService.save(key, value, true);
        expect(getLoginSessionEpoch()).toBe(epoch);
      }
      storageService.clear(true);
      expect(getLoginSessionEpoch()).toBe(epoch);
    });
    it.each(['EXAM_TOKEN', 'EXAM_USER_ID', 'access_token', 'refresh_token', 'EXAM_SESSION_EPOCH'])(
      '删除%s同时撤销代号，只读核对不得重新创建',
      (key) => {
        storageService.saveLoginSession(identity);
        storageService.remove(key, true);
        expect(getLoginSessionEpoch()).toBeNull();
        expect(storageService.getSessionEpoch({ migrateLegacy: false })).toBeNull();
        expect(uni.getStorageSync('_enc_EXAM_SESSION_EPOCH')).toBe('');
      }
    );
    it.each(['empty-token', 'account', 'clear'])('%s撤销已保存代号', (kind) => {
      storageService.saveLoginSession(identity);
      if (kind === 'empty-token') storageService.save('EXAM_TOKEN', '', true);
      else if (kind === 'account') storageService.save('EXAM_USER_ID', 'other-epoch-owner', true);
      else storageService.clear(true, { preserveGlobal: false });
      expect(getLoginSessionEpoch()).toBeNull();
    });
    it('代号保存失败不宣称新登录成功，并保留之前完整身份', () => {
      storageService.saveLoginSession(identity);
      const epoch = getLoginSessionEpoch();
      const write = uni.setStorageSync.getMockImplementation();
      const spy = vi.spyOn(uni, 'setStorageSync').mockImplementation((key, value) => {
        if (key === '_enc_EXAM_SESSION_EPOCH') throw new Error('SYNTHETIC_QUOTA_FAILURE');
        write(key, value);
      });
      const listener = vi.fn(),
        stop = storageService.onIdentityChange(listener);
      try {
        expect(() => storageService.saveLoginSession(identity)).toThrow('登录状态未保存');
        expect(getLoginSessionEpoch()).toBe(epoch);
        expect(listener).toHaveBeenCalledExactlyOnceWith(undefined);
      } finally {
        stop();
        spy.mockRestore();
      }
    });
    it.each(['EXAM_USER_ID', 'EXAM_TOKEN', 'EXAM_SESSION_EPOCH'])(
      '积压的%s删除事件只通知撤销类型，不泄露oldValue/newValue',
      (key) => {
        storageService.saveLoginSession(identity);
        const listener = vi.fn(),
          stop = storageService.onIdentityChange(listener);
        try {
          window.dispatchEvent(
            new StorageEvent('storage', { key: `_enc_${key}`, oldValue: 'synthetic-old-ciphertext', newValue: null })
          );
          expect(listener).toHaveBeenCalledExactlyOnceWith({ type: 'logout' });
        } finally {
          stop();
        }
      }
    );
  });

  describe('旧错题请求的账户与保存边界', () => {
    it.each(['reply', 'throw', 'relogin'])('迟到新增 %s 不写入后来账户或新登录会话', async (outcome) => {
      uni.setStorageSync('EXAM_USER_ID', 'writer-owner');
      storageService.save('EXAM_TOKEN', 'original-session');
      let resolve, reject;
      practiceApi.addMistake.mockImplementationOnce(
        () =>
          new Promise((done, fail) => {
            resolve = done;
            reject = fail;
          })
      );
      const pending = storageService.addMistake({ question: '必须留在原账户的题目', user_answer: 'B' });
      await vi.waitFor(() => expect(resolve).toBeTypeOf('function'));
      if (outcome === 'relogin')
        storageService.saveLoginSession({
          userId: 'writer-owner',
          token: 'new-session',
          userInfo: { id: 'writer-owner' }
        });
      else uni.setStorageSync('EXAM_USER_ID', 'later-owner');
      storageService.save('mistake_book', [{ id: 'keep', question: '后来会话原件' }], true);
      const before = JSON.stringify(global.__mockStorage);
      if (outcome === 'throw') reject(new Error('ISOLATED_OFFLINE'));
      else resolve({ code: 0, id: 'old-cloud-id' });
      expect(await pending).toMatchObject({ success: false, code: 'CONTEXT_CHANGED' });
      expect(JSON.stringify(global.__mockStorage)).toBe(before);
    });
    it('排队新增固定调用时的原文，串行读取不能丢掉新保存条目', async () => {
      uni.setStorageSync('EXAM_USER_ID', 'writer-owner');
      let release;
      storageService._mistakeBookMutex = new Promise((done) => {
        release = done;
      });
      const original = { question: '明确选择时的原题', options: ['原选项'] };
      practiceApi.addMistake.mockResolvedValueOnce({ code: 0, id: 'saved-one' });
      const pending = storageService.addMistake(original);
      original.question = '后来修改的草稿';
      original.options[0] = '后来选项';
      release();
      expect((await pending).success).toBe(true);
      expect(practiceApi.addMistake.mock.calls.at(-1)[1]).toMatchObject({
        question_content: '明确选择时的原题',
        options: ['原选项']
      });
      expect(storageService.get('mistake_book')[0].question).toBe('明确选择时的原题');
    });
    it.each(['guest', 'cloud', 'offline'])('新增 %s 的本机保存失败不报成功且保留原件', async (mode) => {
      if (mode !== 'guest') uni.setStorageSync('EXAM_USER_ID', 'writer-owner');
      storageService.save('mistake_book', [{ id: 'keep', question: '受保护旧题' }], true);
      const before = JSON.stringify(global.__mockStorage);
      if (mode === 'cloud') practiceApi.addMistake.mockResolvedValueOnce({ code: 0, id: 'remote-saved' });
      if (mode === 'offline') practiceApi.addMistake.mockRejectedValueOnce(new Error('ISOLATED_OFFLINE'));
      const save = vi.spyOn(storageService, 'save').mockReturnValue(false);
      try {
        expect(await storageService.addMistake({ question: '新增题目原文' })).toMatchObject({
          success: false,
          code: 'STORAGE_FAILED',
          ...(mode === 'cloud' ? { remoteSaved: true, id: 'remote-saved' } : {})
        });
        expect(JSON.stringify(global.__mockStorage)).toBe(before);
      } finally {
        save.mockRestore();
      }
    });
    it.each([true, false])('旧掌握标记 %s 不能凭空新增学习事实', async (mastered) => {
      uni.setStorageSync('EXAM_USER_ID', 'writer-owner');
      storageService.save(
        'mistake_book',
        [{ id: 0, question: '旧题原文', is_mastered: false, last_practice_time: 17 }],
        true
      );
      const before = JSON.stringify(global.__mockStorage);
      expect(await storageService.updateMistakeStatus(0, mastered)).toMatchObject({
        success: false,
        code: 'RELIABLE_REVIEW_REQUIRED'
      });
      expect(practiceApi.updateMistakeStatus).not.toHaveBeenCalled();
      expect(JSON.stringify(global.__mockStorage)).toBe(before);
    });
    it.each(['read', 'write'])('冲突处理迟到的 %s 不改变新账户且不继续旧请求', async (step) => {
      uni.setStorageSync('EXAM_USER_ID', 'writer-owner');
      const row = {
        id: 'same',
        question_content: '完整原题',
        user_answer: 'B',
        tags: ['需保存的标签'],
        sync_status: 'conflict'
      };
      storageService.save('mistake_book', [row], true);
      if (step === 'write') practiceApi.getMistakes.mockResolvedValueOnce({ code: 0, data: [row] });
      let resolve;
      practiceApi[step === 'read' ? 'getMistakes' : 'updateMistakeFields'].mockImplementationOnce(
        () =>
          new Promise((done) => {
            resolve = done;
          })
      );
      const pending = storageService.resolveConflict('same', 'local');
      await vi.waitFor(() => expect(resolve).toBeTypeOf('function'));
      uni.setStorageSync('EXAM_USER_ID', 'later-owner');
      storageService.save('mistake_book', [{ id: 'same', question: '另一个账户原件' }], true);
      const before = JSON.stringify(global.__mockStorage);
      resolve(step === 'read' ? { code: 0, data: [row] } : { code: 0 });
      expect(await pending).toMatchObject({ success: false, code: 'CONTEXT_CHANGED' });
      expect(JSON.stringify(global.__mockStorage)).toBe(before);
      if (step === 'read') expect(practiceApi.updateMistakeFields).not.toHaveBeenCalled();
    });
    it('冲突读不到精确云端编号时不能用旧副本伪装解决', async () => {
      uni.setStorageSync('EXAM_USER_ID', 'writer-owner');
      const row = {
        id: 'same',
        question: '旧题',
        sync_status: 'conflict',
        _conflict_cloud_data: { id: 'same', question: '旧云端副本' }
      };
      storageService.save('mistake_book', [row], true);
      practiceApi.getMistakes.mockResolvedValueOnce({ code: 0, data: { list: [{ id: 'other', question: '其他题' }] } });
      const before = JSON.stringify(global.__mockStorage);
      expect(await storageService.resolveConflict('same', 'cloud')).toMatchObject({
        success: false,
        code: 'CONFLICT_UNCONFIRMED'
      });
      expect(JSON.stringify(global.__mockStorage)).toBe(before);
    });
    it('材料或原答不同的冲突不能自动拼接，失败保存不能修改原数组', async () => {
      uni.setStorageSync('EXAM_USER_ID', 'writer-owner');
      const row = {
        id: 'same',
        question_content: '相同题干',
        passage: '第一版完整材料',
        user_answer: 'B',
        sync_status: 'conflict'
      };
      storageService.save('mistake_book', [row], true);
      practiceApi.getMistakes.mockResolvedValueOnce({ code: 0, data: [{ ...row, passage: '第二版材料' }] });
      const before = JSON.stringify(global.__mockStorage);
      expect(await storageService.resolveConflict('same', 'merge')).toMatchObject({
        success: false,
        code: 'SOURCE_CONFLICT'
      });
      expect(practiceApi.updateMistakeFields).not.toHaveBeenCalled();
      expect(JSON.stringify(global.__mockStorage)).toBe(before);
      practiceApi.getMistakes.mockResolvedValueOnce({ code: 0, data: { list: [row] } });
      const save = vi.spyOn(storageService, 'save').mockReturnValue(false);
      try {
        expect(await storageService.resolveConflict('same', 'cloud')).toMatchObject({
          success: false,
          code: 'STORAGE_FAILED'
        });
        expect(JSON.stringify(global.__mockStorage)).toBe(before);
      } finally {
        save.mockRestore();
      }
    });
    it('同步响应不明确时保留待办，不立即逐条重复发送', async () => {
      uni.setStorageSync('EXAM_USER_ID', 'writer-owner');
      storageService.save('mistake_book', [{ id: 'local_one', question: '待同步原文', sync_status: 'pending' }], true);
      practiceApi.batchSyncMistakes.mockRejectedValueOnce(new Error('OBSERVATION_TIMEOUT'));
      const before = JSON.stringify(global.__mockStorage);
      expect(await storageService.syncPendingMistakes()).toMatchObject({ success: false, code: 'SYNC_UNCONFIRMED' });
      expect(practiceApi.addMistake).not.toHaveBeenCalled();
      expect(JSON.stringify(global.__mockStorage)).toBe(before);
    });
    it('直接缓存变动和重复云端编号都不能覆盖待办原件', async () => {
      uni.setStorageSync('EXAM_USER_ID', 'writer-owner');
      const rows = [
        { id: 'local_one', question: '第一份原件', sync_status: 'pending' },
        { id: 'local_two', question: '第二份原件', sync_status: 'pending' }
      ];
      storageService.save('mistake_book', rows, true);
      const before = JSON.stringify(global.__mockStorage);
      practiceApi.batchSyncMistakes.mockResolvedValueOnce({
        code: 0,
        results: rows.map((row) => ({ oldId: row.id, newId: 'same-cloud-id', success: true }))
      });
      expect(await storageService.syncPendingMistakes()).toMatchObject({ success: false, code: 'SYNC_UNCONFIRMED' });
      expect(JSON.stringify(global.__mockStorage)).toBe(before);
      let resolve;
      practiceApi.batchSyncMistakes.mockImplementationOnce(
        () =>
          new Promise((done) => {
            resolve = done;
          })
      );
      const pending = storageService.syncPendingMistakes();
      await vi.waitFor(() => expect(resolve).toBeTypeOf('function'));
      storageService.save('mistake_book', [...rows, { id: 'later', question: '后来新增的原文' }], true);
      const changed = JSON.stringify(global.__mockStorage);
      resolve({ code: 0, results: [{ oldId: 'local_one', newId: 'cloud_one', success: true }] });
      expect(await pending).toMatchObject({ success: false, code: 'CONTEXT_CHANGED', remoteSynced: 1 });
      expect(JSON.stringify(global.__mockStorage)).toBe(changed);
    });
    it('冲突批处理在账户变化后不再处理下一个同名编号', async () => {
      uni.setStorageSync('EXAM_USER_ID', 'writer-owner');
      storageService.save(
        'mistake_book',
        ['one', 'two'].map((id) => ({ id, question_content: '相同原文', sync_status: 'conflict' })),
        true
      );
      let resolve;
      practiceApi.getMistakes.mockImplementationOnce(
        () =>
          new Promise((done) => {
            resolve = done;
          })
      );
      const pending = storageService.resolveAllConflicts();
      await vi.waitFor(() => expect(resolve).toBeTypeOf('function'));
      uni.setStorageSync('EXAM_USER_ID', 'later-owner');
      storageService.save('mistake_book', [{ id: 'two', question: '新账户同名原件', sync_status: 'conflict' }], true);
      const before = JSON.stringify(global.__mockStorage);
      resolve({ code: 0, data: [{ id: 'one', question_content: '相同原文' }] });
      expect(await pending).toMatchObject({ success: false, code: 'CONTEXT_CHANGED', resolved: 0 });
      expect(practiceApi.getMistakes).toHaveBeenCalledTimes(1);
      expect(practiceApi.updateMistakeFields).not.toHaveBeenCalled();
      expect(JSON.stringify(global.__mockStorage)).toBe(before);
    });
    it('已取消响应不触发本机降级或修改记录', async () => {
      uni.setStorageSync('EXAM_USER_ID', 'writer-owner');
      storageService.save('mistake_book', [{ id: 'keep', question: '原件' }], true);
      const before = JSON.stringify(global.__mockStorage);
      practiceApi.addMistake.mockResolvedValueOnce({ success: false, error: { error: { errorType: 'cancelled' } } });
      expect(await storageService.addMistake({ question: '取消的新增' })).toMatchObject({
        success: false,
        code: 'CONTEXT_CHANGED'
      });
      expect(JSON.stringify(global.__mockStorage)).toBe(before);
    });
    it('新增与读取共用队列，成功原件不被迟到分页擦掉', async () => {
      uni.setStorageSync('EXAM_USER_ID', 'writer-owner');
      let resolve;
      practiceApi.addMistake.mockImplementationOnce(
        () =>
          new Promise((done) => {
            resolve = done;
          })
      );
      const adding = storageService.addMistake({ question: '完整新增原件', user_answer: 'B' });
      await vi.waitFor(() => expect(resolve).toBeTypeOf('function'));
      practiceApi.getMistakes.mockResolvedValueOnce({ code: 0, data: [] });
      const reading = storageService.getMistakes();
      expect(practiceApi.getMistakes).not.toHaveBeenCalled();
      resolve({ code: 0, id: 'cloud-original' });
      expect((await adding).success).toBe(true);
      await reading;
      expect(storageService.get('mistake_book')).toEqual([
        expect.objectContaining({ id: 'cloud-original', question: '完整新增原件', user_answer: 'B' })
      ]);
    });
    it('相同原件仅合并元数据；未确认的写入仍保留冲突', async () => {
      uni.setStorageSync('EXAM_USER_ID', 'writer-owner');
      const local = {
        id: 'same',
        question_content: '相同完整原文',
        user_answer: 'B',
        tags: ['本机标签'],
        sync_status: 'conflict',
        updated_at: 2
      };
      const cloud = { ...local, tags: ['云端标签'], updated_at: 1, sync_status: 'synced' };
      storageService.save('mistake_book', [local], true);
      practiceApi.getMistakes.mockResolvedValueOnce({ code: 0, data: { list: [cloud] } });
      practiceApi.updateMistakeFields.mockResolvedValueOnce({ code: 500, success: false });
      const before = JSON.stringify(global.__mockStorage);
      expect(await storageService.resolveConflict('same', 'merge')).toMatchObject({
        success: false,
        code: 'CONFLICT_UNCONFIRMED'
      });
      expect(JSON.stringify(global.__mockStorage)).toBe(before);
      practiceApi.getMistakes.mockResolvedValueOnce({ code: 0, data: [cloud] });
      practiceApi.updateMistakeFields.mockResolvedValueOnce({ code: 0, success: true });
      expect(await storageService.resolveConflict('same', 'merge')).toMatchObject({
        success: true,
        cloudPersisted: true
      });
      expect(storageService.get('mistake_book')[0]).toMatchObject({
        question_content: local.question_content,
        user_answer: 'B',
        tags: ['本机标签', '云端标签'],
        sync_status: 'synced'
      });
      expect(practiceApi.updateMistakeFields.mock.calls.at(-1)[2]).toEqual({ tags: ['本机标签', '云端标签'] });
      storageService.save('mistake_book', [local], true);
      practiceApi.getMistakes.mockResolvedValueOnce({
        code: 0,
        data: [{ ...cloud, review_count: 5, is_mastered: true }]
      });
      practiceApi.updateMistakeFields.mockClear();
      const protectedBook = JSON.stringify(global.__mockStorage);
      expect(await storageService.resolveConflict('same', 'merge')).toMatchObject({
        success: false,
        code: 'LEGACY_STATE_CONFLICT'
      });
      expect(practiceApi.updateMistakeFields).not.toHaveBeenCalled();
      expect(JSON.stringify(global.__mockStorage)).toBe(protectedBook);
    });
    it('登录后的历史读取与待办同步不迁移无归属的访客原件', async () => {
      storageService.save('mistake_book', [{ id: 'guest-only', question: '访客原文', sync_status: 'pending' }], true);
      const guest = global.__mockStorage.mistake_book;
      uni.setStorageSync('EXAM_USER_ID', 'signed-in-owner');
      practiceApi.getMistakes.mockRejectedValueOnce(new Error('ISOLATED_OFFLINE'));
      expect((await storageService.getMistakes()).list).toEqual([]);
      expect((await storageService.syncPendingMistakes()).synced).toBe(0);
      expect(practiceApi.batchSyncMistakes).not.toHaveBeenCalled();
      expect(global.__mockStorage.mistake_book).toEqual(guest);
    });
    it('待办在确认之后或同步等待期间变化时，不回写另一账户或发送后来加入的原文', async () => {
      uni.setStorageSync('EXAM_USER_ID', 'sync-owner');
      const expected = [{ id: 'local_old', question: '明确确认的原文', sync_status: 'pending' }];
      storageService.save(
        'mistake_book',
        [...expected, { id: 'local_new', question: '后来加入的原文', sync_status: 'pending' }],
        true
      );
      expect(await storageService.syncPendingMistakes({ expectedRecords: expected })).toMatchObject({
        success: false,
        code: 'CONTEXT_CHANGED'
      });
      expect(practiceApi.batchSyncMistakes).not.toHaveBeenCalled();
      storageService.save('mistake_book', expected, true);
      let resolve;
      practiceApi.batchSyncMistakes.mockImplementationOnce(
        () =>
          new Promise((done) => {
            resolve = done;
          })
      );
      const pending = storageService.syncPendingMistakes({ expectedRecords: expected });
      await vi.waitFor(() => expect(resolve).toBeTypeOf('function'));
      uni.setStorageSync('EXAM_USER_ID', 'later-owner');
      storageService.save('mistake_book', [{ id: 'local_old', question: '新账户原件' }], true);
      const before = JSON.stringify(global.__mockStorage);
      resolve({ code: 0, data: { results: [{ localId: 'local_old', success: true, id: 'remote_old' }] } });
      expect(await pending).toMatchObject({ success: false, code: 'CONTEXT_CHANGED' });
      expect(JSON.stringify(global.__mockStorage)).toBe(before);
    });
    it('分页读取保留尚未载入的缓存原条目，只更新本页的相同编号', async () => {
      uni.setStorageSync('EXAM_USER_ID', 'page-owner');
      const rows = Array.from({ length: 80 }, (_, id) => ({ id: `row-${id}`, question: `原题${id}` }));
      storageService.save('mistake_book', rows, true);
      practiceApi.getMistakes.mockResolvedValueOnce({
        code: 0,
        data: { list: [{ ...rows[0], question: '当前版本' }], total: 80, hasMore: true }
      });
      const result = await storageService.getMistakes(1, 1);
      expect(result.list).toHaveLength(1);
      const cached = storageService.get('mistake_book');
      expect(cached).toHaveLength(80);
      expect(cached.find((row) => row.id === 'row-0').question).toBe('当前版本');
      expect(cached.find((row) => row.id === 'row-79')).toEqual(rows[79]);
    });
    it.each(['removeMistake', 'batchRemoveMistakes', 'getMistakes'])(
      '迟到 %s 不修改切换后的账户缓存',
      async (method) => {
        uni.setStorageSync('EXAM_USER_ID', 'request-owner');
        storageService.save('mistake_book', [{ id: 'shared-id', question: '原账户题目' }], true);
        let resolve;
        practiceApi[method].mockImplementationOnce(
          () =>
            new Promise((done) => {
              resolve = done;
            })
        );
        const pending = storageService[method](
          ...(method === 'getMistakes' ? [] : [method === 'removeMistake' ? 'shared-id' : ['shared-id']])
        );
        await vi.waitFor(() => expect(resolve).toBeTypeOf('function'));
        uni.setStorageSync('EXAM_USER_ID', 'later-owner');
        storageService.save('mistake_book', [{ id: 'shared-id', question: '新账户题目' }], true);
        const before = JSON.stringify(global.__mockStorage);
        resolve({ ok: true, deleted: 1, code: 0, data: [{ id: 'shared-id', question: '迟到旧题' }] });
        expect(await pending).toMatchObject({ success: false, code: 'CONTEXT_CHANGED' });
        expect(JSON.stringify(global.__mockStorage)).toBe(before);
      }
    );
    it('队列等待期间账户变化时拒绝原删除，零远端请求', async () => {
      uni.setStorageSync('EXAM_USER_ID', 'queue-owner');
      let release;
      storageService._mistakeBookMutex = new Promise((resolve) => {
        release = resolve;
      });
      const pending = storageService.batchRemoveMistakes(['same']);
      uni.setStorageSync('EXAM_USER_ID', 'later-owner');
      storageService.save('mistake_book', [{ id: 'same', question: '受保护新条目' }], true);
      const before = JSON.stringify(global.__mockStorage);
      release();
      expect(await pending).toMatchObject({ success: false, code: 'CONTEXT_CHANGED' });
      expect(practiceApi.batchRemoveMistakes).not.toHaveBeenCalled();
      expect(JSON.stringify(global.__mockStorage)).toBe(before);
    });
    it.each(['removeMistake', 'batchRemoveMistakes'])('本机保存失败时 %s 保留原条目且不报成功', async (method) => {
      const original = [
        { id: 0, question: '编号零原题' },
        { id: 'keep', question: '未选择条目' }
      ];
      storageService.save('mistake_book', original, true);
      const save = vi.spyOn(storageService, 'save').mockReturnValue(false);
      try {
        const result = await storageService[method](method === 'removeMistake' ? 0 : [0]);
        expect(result.success).toBe(false);
        expect(storageService.get('mistake_book')).toEqual(original);
      } finally {
        save.mockRestore();
      }
    });
  });

  describe('save / get 基础操作', () => {
    it('save 存储普通数据', () => {
      const result = storageService.save('test_key', 'test_value');
      expect(result).toBe(true);
      expect(uni.setStorageSync).toHaveBeenCalled();
    });

    it('get 读取普通数据', () => {
      global.__mockStorage['test_key'] = 'hello';
      const value = storageService.get('test_key');
      expect(value).toBe('hello');
    });

    it('get 缺失键返回默认值', () => {
      const value = storageService.get('nonexistent', 'default_val');
      expect(value).toBe('default_val');
    });

    it('save 对象数据', () => {
      const obj = { name: 'test', count: 42 };
      storageService.save('obj_key', obj);
      expect(uni.setStorageSync).toHaveBeenCalled();
    });

    it('save 数组数据', () => {
      const arr = [1, 2, 3];
      storageService.save('arr_key', arr);
      expect(uni.setStorageSync).toHaveBeenCalled();
    });

    it('smart_review_ids 使用全局瞬态键，跨页面跳转时不加用户前缀', () => {
      global.__mockStorage.EXAM_USER_ID = 'user_001';

      const ids = ['politics-2025-001'];
      expect(storageService.save('smart_review_ids', ids)).toBe(true);

      expect(global.__mockStorage.smart_review_ids).toEqual(ids);
      expect(global.__mockStorage.u_user_001_smart_review_ids).toBeUndefined();
      expect(storageService.get('smart_review_ids', [])).toEqual(ids);
    });

    it('strict compat reads observe another window and reject malformed or unreadable originals', async () => {
      const originalUni = global.uni,
        originalWx = global.wx;
      let readFailure;
      try {
        vi.resetModules();
        delete global.uni;
        delete global.wx;
        const { storageService: strictStorage } = await import('@/services/storageService.js');
        const key = '__exam_storage__:question_favorites';
        strictStorage.save('question_favorites', [{ id: 'first' }], true);
        expect(strictStorage.get('question_favorites')).toEqual([{ id: 'first' }]);
        localStorage.setItem(key, JSON.stringify({ value: [{ id: 'other-window' }] }));
        expect(strictStorage.get('question_favorites', [], { migrateLegacy: false, throwOnError: true })).toEqual([
          { id: 'other-window' }
        ]);
        localStorage.setItem(key, '{broken original');
        expect(() => strictStorage.get('question_favorites', [], { throwOnError: true })).toThrow();
        expect(localStorage.getItem(key)).toBe('{broken original');
        readFailure = vi.spyOn(localStorage, 'getItem').mockImplementation(() => {
          throw Error('synthetic read failure');
        });
        expect(() => strictStorage.get('question_favorites', [], { throwOnError: true })).toThrow(
          '登录状态暂不可读，请重试'
        );
      } finally {
        readFailure?.mockRestore();
        global.uni = originalUni;
        global.wx = originalWx;
        vi.resetModules();
      }
    });

    it('模块加载后注入 uni 时仍写入当前运行时存储', async () => {
      const originalUni = global.uni;
      const originalWx = global.wx;
      const runtimeStorage = {};
      try {
        vi.resetModules();
        delete global.uni;
        delete global.wx;
        const { storageService: lateStorageService } = await import('@/services/storageService.js');
        global.uni = {
          getStorageSync: vi.fn((key) =>
            Object.prototype.hasOwnProperty.call(runtimeStorage, key) ? runtimeStorage[key] : ''
          ),
          setStorageSync: vi.fn((key, value) => {
            runtimeStorage[key] = value;
          }),
          removeStorageSync: vi.fn((key) => {
            delete runtimeStorage[key];
          }),
          getStorageInfoSync: vi.fn(() => ({
            keys: Object.keys(runtimeStorage),
            currentSize: Object.keys(runtimeStorage).length,
            limitSize: 10240
          })),
          showToast: vi.fn()
        };

        expect(lateStorageService.save('late_key', 'late_value')).toBe(true);
        expect(global.uni.setStorageSync).toHaveBeenCalledWith('late_key', 'late_value');
        expect(lateStorageService.get('late_key')).toBe('late_value');
      } finally {
        global.uni = originalUni;
        global.wx = originalWx;
      }
    });

    it('微信小程序端未挂载 global uni 时回退到 wx 持久存储', async () => {
      const originalUni = global.uni;
      const originalWx = global.wx;
      const runtimeStorage = {};
      try {
        vi.resetModules();
        delete global.uni;
        global.wx = {
          getStorageSync: vi.fn((key) =>
            Object.prototype.hasOwnProperty.call(runtimeStorage, key) ? runtimeStorage[key] : ''
          ),
          setStorageSync: vi.fn((key, value) => {
            runtimeStorage[key] = value;
          }),
          removeStorageSync: vi.fn((key) => {
            delete runtimeStorage[key];
          }),
          getStorageInfoSync: vi.fn(() => ({
            keys: Object.keys(runtimeStorage),
            currentSize: Object.keys(runtimeStorage).length,
            limitSize: 10240
          })),
          showToast: vi.fn()
        };

        const { storageService: wxStorageService } = await import('@/services/storageService.js');

        expect(wxStorageService.save('wx_key', 'wx_value')).toBe(true);
        expect(global.wx.setStorageSync).toHaveBeenCalledWith('wx_key', 'wx_value');
        expect(wxStorageService.get('wx_key')).toBe('wx_value');
        const changed = vi.fn();
        const stop = wxStorageService.onIdentityChange(changed);
        try {
          expect(wxStorageService.save('EXAM_USER_ID', 'synthetic-wx-owner', true)).toBe(true);
          expect(runtimeStorage.EXAM_USER_ID).toBeUndefined();
          expect(runtimeStorage._enc_EXAM_USER_ID).toBeTruthy();
          expect(changed).toHaveBeenCalledOnce();
          wxStorageService.remove('EXAM_USER_ID', true);
          expect(changed).toHaveBeenCalledTimes(2);
        } finally {
          stop();
        }
      } finally {
        global.uni = originalUni;
        global.wx = originalWx;
      }
    });
  });

  describe('saveDebounced', () => {
    it('clear 会取消待执行的防抖写入，避免清空后恢复旧数据', () => {
      vi.useFakeTimers();
      try {
        storageService.saveDebounced('temp_cache_key', 'stale_value');
        storageService.clear(true, { preserveGlobal: false });
        vi.advanceTimersByTime(600);

        expect(global.__mockStorage.temp_cache_key).toBeUndefined();
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe('remove / clear', () => {
    it('remove 删除指定键', () => {
      storageService.remove('some_key');
      expect(uni.removeStorageSync).toHaveBeenCalled();
    });

    it('clear 默认保留全局键，仅清理业务缓存，并迁移明文敏感键', () => {
      global.__mockStorage = {
        EXAM_TOKEN: 'token_123',
        EXAM_USER_ID: 'user_123',
        userInfo: { uid: 'user_123' },
        theme_mode: 'dark',
        temp_cache_key: 'to_remove'
      };

      storageService.clear();

      expect(storageService.get('EXAM_TOKEN')).toBe('token_123');
      expect(storageService.get('EXAM_USER_ID')).toBe('user_123');
      expect(storageService.get('userInfo')).toEqual({ uid: 'user_123' });
      expect(global.__mockStorage.EXAM_TOKEN).toBeUndefined();
      expect(global.__mockStorage.EXAM_USER_ID).toBeUndefined();
      expect(global.__mockStorage.userInfo).toBeUndefined();
      expect(global.__mockStorage._enc_EXAM_TOKEN).toBeTruthy();
      expect(global.__mockStorage._enc_EXAM_USER_ID).toBeTruthy();
      expect(global.__mockStorage._enc_userInfo).toBeTruthy();
      expect(global.__mockStorage.theme_mode).toBe('dark');
      expect(global.__mockStorage.temp_cache_key).toBeUndefined();
      expect(uni.clearStorageSync).not.toHaveBeenCalled();
    });

    it('clear 可显式关闭保留策略并执行全清', () => {
      global.__mockStorage = { EXAM_TOKEN: 'token_123', temp_cache_key: 'to_remove' };

      storageService.clear(false, { preserveGlobal: false });

      expect(uni.clearStorageSync).not.toHaveBeenCalled();
      expect(uni.getStorageSync('EXAM_IDENTITY_GENERATION')).toBeGreaterThan(0);
      expect(global.__mockStorage).toEqual({
        EXAM_IDENTITY_GENERATION: expect.any(Number),
        EXAM_SESSION_REVOCATION: expect.any(String),
        EXAM_LOGIN_ATTEMPT: expect.any(String)
      });
    });
  });

  describe('has', () => {
    it('存在的键返回 true', () => {
      global.__mockStorage['existing'] = 'value';
      expect(storageService.has('existing')).toBe(true);
    });

    it('不存在的键返回 false', () => {
      expect(storageService.has('missing_key')).toBe(false);
    });
  });

  describe('saveBatch / getBatch', () => {
    it('saveBatch 批量存储', () => {
      const data = { key1: 'val1', key2: 'val2', key3: 'val3' };
      const result = storageService.saveBatch(data);
      expect(result).toBe(true);
    });

    it('getBatch 批量读取', () => {
      global.__mockStorage['k1'] = 'v1';
      global.__mockStorage['k2'] = 'v2';
      const result = storageService.getBatch(['k1', 'k2', 'k3']);
      expect(result).toHaveProperty('k1', 'v1');
      expect(result).toHaveProperty('k2', 'v2');
    });
  });

  describe('敏感数据加密', () => {
    it('EXAM_TOKEN 存储时使用加密键', () => {
      storageService.save('EXAM_TOKEN', 'my_secret_token');
      // 应该调用 setStorageSync，且键名包含 _enc_ 前缀
      const calls = /** @type {any} */ (uni.setStorageSync).mock.calls;
      const encCall = calls.find((c) => c[0].includes('_enc_'));
      expect(encCall).toBeTruthy();
    });

    it('userInfo 存储时使用加密键', () => {
      storageService.save('userInfo', { name: 'test' });
      const calls = /** @type {any} */ (uni.setStorageSync).mock.calls;
      const encCall = calls.find((c) => c[0].includes('_enc_'));
      expect(encCall).toBeTruthy();
    });
  });

  describe('getStorageInfo', () => {
    it('返回存储信息对象', () => {
      const info = storageService.getStorageInfo();
      expect(info).toBeDefined();
    });
  });

  describe('getAllKeys', () => {
    it('返回键名数组', () => {
      const keys = storageService.getAllKeys();
      expect(Array.isArray(keys)).toBe(true);
    });
  });

  describe('getMistakes 本地降级', () => {
    it('返回按时间排序的分页结果时不改变本地缓存原始顺序', async () => {
      const originalMistakes = [
        { id: 'old', created_at: 1, is_mastered: false },
        { id: 'new', created_at: 2, is_mastered: false }
      ];
      storageService.save('mistake_book', originalMistakes, true);

      const result = await storageService.getMistakes(1, 20);

      expect(result.list.map((item) => item.id)).toEqual(['new', 'old']);
      expect(storageService.get('mistake_book').map((item) => item.id)).toEqual(['old', 'new']);
    });
  });
});

describe('阶段5一致会话与存储入口', () => {
  it('serializes complete logins and rejects a conflicting registration until explicit retry', async () => {
    const { storageService } = await import('@/services/storageService.js');
    const { captureSession, checkSession, sessionForRequest } = await import('@/services/auth-storage.js');
    uni.clearStorageSync();
    const previous = navigator.locks;
    let tail = Promise.resolve();
    const request = vi.fn((_name, _options, write) => {
      const job = tail.then(write);
      tail = job.catch(() => undefined);
      return job;
    });
    Object.defineProperty(navigator, 'locks', { configurable: true, value: { request } });
    try {
      const receipts = await Promise.allSettled([
        storageService.saveLoginSession({ userId: 'lock-A', token: 'fixture-token-A', userInfo: {} }),
        storageService.saveLoginSession({ userId: 'lock-B', token: 'fixture-token-B', userInfo: {} })
      ]);
      expect(receipts.map((item) => item.status)).toEqual(['fulfilled', 'rejected']);
      await storageService.saveLoginSession({ userId: 'lock-B', token: 'fixture-token-B', userInfo: {} });
      const session = captureSession();
      expect(Object.isFrozen(session)).toBe(true);
      expect(Object.keys(session)).toEqual(['owner', 'epoch', 'proof']);
      expect(session.proof).toMatch(/^[a-f0-9]{64}$/);
      expect(session.owner).toBe('lock-B');
      expect(sessionForRequest(session).token).toBe('fixture-token-B');
      expect(checkSession(session)).toBe('current');
      expect(request.mock.calls.every(([name]) => name === 'exam-master:login-session-v1')).toBe(true);
    } finally {
      if (previous) Object.defineProperty(navigator, 'locks', { configurable: true, value: previous });
      else delete navigator.locks;
    }
  });
  it('uses an irreversible SHA-256 proof and rejects a mixed identity within the same epoch', async () => {
    const { createHash } = await import('node:crypto');
    const { storageService } = await import('@/services/storageService.js');
    const { captureSession, checkSession, sessionCredentialProof } = await import('@/services/auth-storage.js');
    for (const pair of [
      ['owner', 'fixture-token'],
      ['账户', 'fixture-长令牌']
    ])
      expect(sessionCredentialProof(...pair)).toBe(createHash('sha256').update(JSON.stringify(pair)).digest('hex'));
    uni.clearStorageSync();
    await storageService.saveLoginSession({ userId: 'snapshot-A', token: 'fixture-token-A', userInfo: {} });
    const session = captureSession();
    uni.setStorageSync('_enc_EXAM_TOKEN', obfuscate('fixture-token-B'));
    expect(checkSession(session)).toBe('current');
    expect(getToken()).toBe('fixture-token-A');
    const record = deobfuscate(uni.getStorageSync('_enc_EXAM_SESSION_EPOCH'));
    uni.setStorageSync('_enc_EXAM_SESSION_EPOCH', obfuscate({ ...record, token: 'fixture-token-B' }));
    expect(captureSession()).toBeNull();
    expect(checkSession(session)).toBe('unavailable');
  });
  it('distinguishes transient read failure from confirmed revocation and never falls back to stale credentials', async () => {
    const { storageService } = await import('@/services/storageService.js');
    const { captureSession, checkSession } = await import('@/services/auth-storage.js');
    uni.clearStorageSync();
    await storageService.saveLoginSession({ userId: 'snapshot-A', token: 'fixture-token-A', userInfo: {} });
    const session = captureSession(),
      read = uni.getStorageSync.getMockImplementation();
    let failed = false;
    const spy = vi.spyOn(uni, 'getStorageSync').mockImplementation((key) => {
      if (!failed && key === '_enc_EXAM_SESSION_EPOCH') {
        failed = true;
        throw new Error('fixture-read');
      }
      return read(key);
    });
    try {
      expect(checkSession(session)).toBe('unavailable');
    } finally {
      spy.mockRestore();
    }
    expect(checkSession(session)).toBe('current');
    storageService.remove('EXAM_SESSION_EPOCH', true);
    expect(checkSession(session)).toBe('changed');
    storageService.getSessionEpoch();
    expect(getToken()).toBeNull();
    expect(storageService.getSessionEpoch()).toBeNull();
  });
  it('binds debounce at enqueue and rejects stale remove/saveBatch without touching B', async () => {
    const { storageService } = await import('@/services/storageService.js');
    const { captureSession } = await import('@/services/auth-storage.js');
    uni.clearStorageSync();
    await storageService.saveLoginSession({ userId: 'deferred-A', token: 'fixture-token-A', userInfo: {} });
    const session = captureSession();
    vi.useFakeTimers();
    try {
      storageService.saveDebounced('mistake_book', [{ private: 'PRIVATE_A' }], true, session);
      await storageService.saveLoginSession({ userId: 'deferred-B', token: 'fixture-token-B', userInfo: {} });
      expect(storageService.remove('mistake_book', true, session)).toBe(false);
      expect(storageService.saveBatch({ mistake_book: [{ private: 'PRIVATE_A' }] }, true, session)).toBe(false);
      await vi.advanceTimersByTimeAsync(501);
      expect(uni.getStorageSync('u_deferred-B_mistake_book')).toBe('');
    } finally {
      storageService.flushPendingWrites();
      vi.useRealTimers();
    }
  });
});

describe('跨窗口撤销清理与登录事务', () => {
  it('does not clear a completed later login while waiting to clean revoked credentials', async () => {
    const { storageService } = await import('@/services/storageService.js');
    uni.clearStorageSync();
    await storageService.saveLoginSession({ userId: 'cleanup-A', token: 'fixture-token-A', userInfo: {} });
    storageService.remove('EXAM_SESSION_EPOCH', true);
    const previous = navigator.locks;
    let cleanup;
    Object.defineProperty(navigator, 'locks', {
      configurable: true,
      value: {
        request: vi.fn(
          (_name, _options, write) =>
            new Promise((resolve) => {
              cleanup = () => resolve(write());
            })
        )
      }
    });
    try {
      const oldCleanup = storageService._clearRevokedCredentials();
      // Finish another window's transaction before the queued cleanup gets the Web Lock.
      delete navigator.locks;
      await storageService.saveLoginSession({ userId: 'cleanup-B', token: 'fixture-token-B', userInfo: {} });
      cleanup();
      await oldCleanup;
      expect(getUserId()).toBe('cleanup-B');
      expect(getToken()).toBe('fixture-token-B');
      expect(getLoginSessionEpoch()).toBeTruthy();
    } finally {
      if (previous) Object.defineProperty(navigator, 'locks', { configurable: true, value: previous });
      else delete navigator.locks;
    }
  });
});
