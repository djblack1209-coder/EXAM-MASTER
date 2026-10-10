import { describe, expect, it, vi } from 'vitest';
import { useBankStatus } from '@/composables/useBankStatus.js';
import storageService from '@/services/storageService.js';
import { aiGenerationMixin } from '@/pages/practice-sub/composables/ai-generation-mixin.js';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import SprintPage from '@/pages/practice-sub/sprint-mode.vue';
import SmartReviewPage from '@/pages/practice-sub/smart-review.vue';

describe('legacy bank reads and retired writers', () => {
  it.each([SprintPage, SmartReviewPage])(
    'old views display original counts without mastery or forecasts',
    async (Page) => {
      uni.setStorageSync('EXAM_USER_ID', 'group-reader');
      const protectedRows = {
        v30_bank: [{ id: 0, question: '原题', category: '数学', options: ['甲', '乙'], answer: 'A' }],
        v30_bank_backup: [{ id: 'unique', question: '唯一恢复原件' }],
        exam_date: '2025-01-01',
        v30_mistakes: [{ id: 0, isCorrect: false, reviewCount: 99 }],
        fsrs_records: [{ id: 0, retrievability: 0.99 }]
      };
      uni.setStorageSync('review_streak', { days: 99, lastDate: new Date().toDateString() });
      for (const [key, value] of Object.entries(protectedRows)) storageService.save(key, value, true);
      const wrapper = mount(Page, { global: { stubs: { BaseIcon: true } } });
      await nextTick();
      expect(wrapper.text()).toContain('1 道原题 · 作答后待核对');
      expect(wrapper.text()).not.toMatch(/掌握|提分|ROI|放弃|冲刺排名|记忆强度|连续复习|已完成|AI 正在/);
      for (const [key, value] of Object.entries(protectedRows))
        expect(storageService.get(key, null, { migrateLegacy: false })).toEqual(value);
      expect(uni.navigateTo).not.toHaveBeenCalled();
      wrapper.unmount();
    }
  );
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
  it.each(['normal', 'save-failure', 'owner-changed'])(
    'sprint %s uses complete owned selection and leaves the bank and unique recovery unchanged',
    (mode) => {
      uni.setStorageSync('EXAM_USER_ID', 'sprint-a');
      const bank = [
        {
          id: 0,
          question: '按照原文选择',
          type: 'multi_choice',
          options: ['甲', '乙', '丙'],
          answer: 'AC',
          category: '数学',
          passage: '原材料',
          source: { title: '原来源' }
        }
      ];
      storageService.save('v30_bank', bank, true);
      storageService.save('v30_bank_backup', [{ id: 'unique', question: '唯一恢复原件' }], true);
      const wrapper = mount(SprintPage, { global: { stubs: { BaseIcon: true } } });
      let spy;
      if (mode === 'save-failure') {
        const save = storageService.save.bind(storageService);
        spy = vi
          .spyOn(storageService, 'save')
          .mockImplementation((k, ...args) => (k === 'quiz_review_handoff_v1' ? false : save(k, ...args)));
      }
      if (mode === 'owner-changed') uni.setStorageSync('EXAM_USER_ID', 'sprint-b');
      const before = JSON.stringify(global.__mockStorage);
      wrapper.vm.$.setupState.startSprint({ name: '数学', roi: 1 });
      if (mode === 'normal') {
        expect(storageService.get('v30_bank', [], { migrateLegacy: false })).toEqual(bank);
        expect(storageService.get('v30_bank_backup')).toEqual([{ id: 'unique', question: '唯一恢复原件' }]);
        const handoff = storageService.get('quiz_review_handoff_v1');
        expect(handoff.questions[0].quizOriginal.fields).toMatchObject({
          answer: 'AC',
          passage: '原材料',
          source: { title: '原来源' }
        });
        expect(uni.navigateTo).toHaveBeenCalledWith(
          expect.objectContaining({ url: expect.stringContaining('reviewId=') })
        );
        expect(storageService.get('is_review_mode')).toBeNull();
      } else {
        expect(JSON.stringify(global.__mockStorage)).toBe(before);
        expect(uni.navigateTo).not.toHaveBeenCalled();
      }
      wrapper.unmount();
      spy?.mockRestore();
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
