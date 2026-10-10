import { describe, expect, it, vi } from 'vitest';
import { useBankStatus } from '@/composables/useBankStatus.js';
import storageService from '@/services/storageService.js';
import { aiGenerationMixin } from '@/pages/practice-sub/composables/ai-generation-mixin.js';

describe('legacy bank reads and retired writers', () => {
  it('sign-out cache cleanup preserves originals, recovery and favourites in their owning namespace', () => {
    uni.setStorageSync('EXAM_USER_ID', 'owner-a');
    const keys = [
      'v30_bank',
      'v30_bank_backup',
      'v30_bank_backup_before_clear',
      'v30_user_answers',
      'question_favorites',
      'favorite_folders',
      'favorite_settings'
    ];
    for (const key of keys) storageService.save(key, [{ id: 'protected', question: '完整原件' }], true);
    storageService.save('ordinary_cache', { cached: true }, true);
    storageService.clearUserData('owner-a', { preserveLearning: true });
    for (const key of keys)
      expect(storageService.get(key, null, { migrateLegacy: false })).toEqual([
        { id: 'protected', question: '完整原件' }
      ]);
    expect(storageService.get('ordinary_cache')).toBeNull();
  });
  it('generic login migration leaves private guest original keys for an explicit import', () => {
    const keys = ['v30_bank', 'v30_bank_backup', 'loaded_flashcard_banks', 'question_favorites'];
    for (const key of keys) storageService.save(key, [{ id: 'guest', question: '访客原件' }], true);
    uni.setStorageSync('EXAM_USER_ID', 'later-owner');
    const before = JSON.stringify(global.__mockStorage);
    expect(storageService.migrateUserKeys()).toBe(0);
    expect(JSON.stringify(global.__mockStorage)).toBe(before);
  });
  it.each(['v30_bank', 'loaded_flashcard_banks', 'v30_bank_backup', 'temp_practice_question'])(
    'default reads cannot claim unscoped %s even when a caller opts into old generic migration',
    (key) => {
      const raw =
        key === 'temp_practice_question'
          ? { id: 'guest', question: '访客原件' }
          : [{ id: 'guest', question: '访客原件' }];
      storageService.save(key, raw, true);
      uni.setStorageSync('EXAM_USER_ID', 'later-owner');
      const before = JSON.stringify(global.__mockStorage);
      expect(storageService.get(key, null)).toBeNull();
      expect(storageService.get(key, null, { migrateLegacy: true })).toBeNull();
      expect(JSON.stringify(global.__mockStorage)).toBe(before);
    }
  );
  it.each(['array', 'string'])('an empty bank stays empty when %s recovery data exists', (format) => {
    const backup = [{ id: 'protected', question: '必须留在备份里的原题', options: ['甲', '乙'], answer: 'A' }];
    storageService.save('v30_bank', [], true);
    storageService.save('v30_bank_backup', format === 'array' ? backup : JSON.stringify(backup), true);
    const before = JSON.stringify(global.__mockStorage),
      status = useBankStatus();
    status.refreshBankStatus();
    expect(status.totalQuestions.value).toBe(0);
    expect(status.hasBank.value).toBe(false);
    expect(JSON.stringify(global.__mockStorage)).toBe(before);
  });
  it('does not claim a guest bank or resume private backup while refreshing another account', () => {
    storageService.save('v30_bank', [{ id: 'guest', question: '访客原件' }], true);
    uni.setStorageSync('EXAM_USER_ID', 'owner-a');
    storageService.save('v30_bank_backup', [{ id: 'backup-a', question: 'A恢复原件' }], true);
    const before = JSON.stringify(global.__mockStorage),
      status = useBankStatus();
    status.refreshBankStatus();
    expect(JSON.stringify(global.__mockStorage)).toBe(before);
    expect(status.totalQuestions.value).toBe(0);
  });
  it.each(['_saveQuestionBank', '_restoreFromBackup', 'clearAll', 'clearQuizBank'])(
    'retired %s cannot replace or delete bank/backup or claim a new generated result',
    (method) => {
      storageService.save('v30_bank', [{ id: 'keep', question: '现题库原件' }], true);
      storageService.save('v30_bank_backup', JSON.stringify([{ id: 'unique', question: '唯一恢复原件' }]), true);
      const context = {
        refreshBankStatus: vi.fn(),
        updateGenerationProgress: vi.fn(),
        generatedCount: 7,
        readOffset: 19,
        chunkSize: 100,
        isLooping: false,
        showQuizManageModal: true
      };
      const before = JSON.stringify(global.__mockStorage);
      const result = aiGenerationMixin.methods[method].call(
        context,
        [{ id: 'replacement', question: '不准偷偷替换的内容' }],
        1
      );
      const dialog = uni.showModal.mock.calls.at(-1)?.[0];
      if (dialog) dialog.success({ confirm: true });
      expect(result?.success === false || result === false).toBe(true);
      expect(JSON.stringify(global.__mockStorage)).toBe(before);
      expect(context.generatedCount).toBe(7);
      expect(context.readOffset).toBe(19);
      expect(context.refreshBankStatus).not.toHaveBeenCalled();
    }
  );
});
