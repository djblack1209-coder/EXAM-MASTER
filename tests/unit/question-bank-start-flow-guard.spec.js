import { createPinia, setActivePinia } from 'pinia';
import { mount } from '@vue/test-utils';
import { flushPromises } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import QuestionBankPage from '@/pages/practice-sub/question-bank.vue';
import storageService from '@/services/storageService.js';
import { loadBankData } from '@/pages/practice-sub/bank-data-loader.js';
import { toast } from '@/utils/toast.js';

const pageHooks = vi.hoisted(() => ({}));
vi.mock('@dcloudio/uni-app', () => ({
  onShow: (fn) => {
    pageHooks.show = fn;
  },
  onHide: (fn) => {
    pageHooks.hide = fn;
  },
  onUnload: (fn) => {
    pageHooks.unload = fn;
  }
}));

vi.mock('@/pages/practice-sub/bank-data-loader.js', () => ({
  loadBankData: vi.fn()
}));

vi.mock('@/utils/toast.js', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn()
  }
}));

function mountQuestionBank() {
  storageService.save('exam_profile', { tracks: ['politics'] });
  return mount(QuestionBankPage, {
    global: {
      stubs: {
        BaseIcon: true
      }
    }
  });
}

describe('question bank start flow', () => {
  it('does not claim unscoped guest questions or loaded markers merely by opening the bank page', async () => {
    storageService.save('v30_bank', [{ id: 'guest', question: '访客原题' }], true);
    storageService.save('loaded_flashcard_banks', ['politics-2025'], true);
    uni.setStorageSync('EXAM_USER_ID', 'owner-a');
    const before = JSON.stringify(global.__mockStorage),
      wrapper = mountQuestionBank();
    await flushPromises();
    // exam_profile is a global UI preference written by the mount fixture itself.
    const expected = JSON.parse(before);
    expected.exam_profile = { tracks: ['politics'] };
    expect(global.__mockStorage).toEqual(expected);
    expect(storageService.get('v30_bank', [], { migrateLegacy: false })).toEqual([]);
    wrapper.unmount();
  });
  beforeEach(() => {
    for (const key of Object.keys(pageHooks)) delete pageHooks[key];
    loadBankData.mockReset();
    toast.success.mockReset();
    toast.error.mockReset();
    toast.info.mockReset();
  });

  it.each(['hide', 'unload', 'unmount'])(
    'ignores a paper received after %s without writing or navigating',
    async (leave) => {
      let receive;
      loadBankData.mockImplementation(
        () =>
          new Promise((resolve) => {
            receive = resolve;
          })
      );
      const wrapper = mountQuestionBank();
      await flushPromises();
      await wrapper.find('.slot-action').trigger('tap');
      const before = JSON.stringify(global.__mockStorage);
      if (leave === 'unmount') wrapper.unmount();
      else pageHooks[leave]?.();
      receive({ cards: [{ id: 'late', question: '迟到题目的完整题干', options: ['甲', '乙'], answer: 'A' }] });
      await flushPromises();
      expect(JSON.stringify(global.__mockStorage)).toBe(before);
      expect(global.uni.navigateTo).not.toHaveBeenCalled();
      expect(toast.success).not.toHaveBeenCalled();
      expect(toast.error).not.toHaveBeenCalled();
      if (leave !== 'unmount') wrapper.unmount();
    }
  );

  it.each(['resolve', 'reject'])(
    'keeps a new explicit load active when an abandoned request later %s',
    async (outcome) => {
      const pending = [];
      loadBankData.mockImplementation(
        () =>
          new Promise((resolve, reject) => {
            pending.push({ resolve, reject });
          })
      );
      const wrapper = mountQuestionBank();
      await flushPromises();
      await wrapper.find('.slot-action').trigger('tap');
      pageHooks.hide();
      pageHooks.show();
      await flushPromises();
      expect(loadBankData).toHaveBeenCalledTimes(1);
      await wrapper.find('.slot-action').trigger('tap');
      expect(loadBankData).toHaveBeenCalledTimes(2);
      const before = JSON.stringify(global.__mockStorage);
      if (outcome === 'resolve')
        pending[0].resolve({ cards: [{ id: 'old', question: '过期题目完整题干', answer: 'A' }] });
      else pending[0].reject(new Error('abandoned load failed'));
      await flushPromises();
      expect(JSON.stringify(global.__mockStorage)).toBe(before);
      expect(global.uni.navigateTo).not.toHaveBeenCalled();
      expect(toast.error).not.toHaveBeenCalled();
      await wrapper.find('.slot-action').trigger('tap');
      expect(loadBankData).toHaveBeenCalledTimes(2);
      pending[1].resolve({
        cards: [{ id: 'current', question: '本次题目的完整题干', options: ['甲', '乙'], answer: 'A' }]
      });
      await flushPromises();
      expect(storageService.get('quiz_review_handoff_v1').questions.map((q) => q.id)).toEqual(['current']);
      expect(global.uni.navigateTo).toHaveBeenCalledTimes(1);
      wrapper.unmount();
    }
  );

  it('does not revive an abandoned result after returning to the page', async () => {
    let receive;
    loadBankData.mockImplementation(
      () =>
        new Promise((resolve) => {
          receive = resolve;
        })
    );
    const wrapper = mountQuestionBank();
    await flushPromises();
    await wrapper.find('.slot-action').trigger('tap');
    const before = JSON.stringify(global.__mockStorage);
    pageHooks.hide();
    pageHooks.show();
    receive({ cards: [{ id: 'old', question: '过期题目完整题干', answer: 'A' }] });
    await flushPromises();
    expect(JSON.stringify(global.__mockStorage)).toBe(before);
    expect(global.uni.navigateTo).not.toHaveBeenCalled();
    expect(loadBankData).toHaveBeenCalledTimes(1);
    wrapper.unmount();
  });

  it('routes loaded papers through safe navigation with a verified question id set', async () => {
    loadBankData.mockResolvedValue({
      id: 'politics-2025',
      name: '2025考研政治真题',
      subject: '政治',
      year: '2025',
      cards: [
        {
          id: 'politics-2025-001',
          question: '第一题题干内容足够长',
          options: ['A. A', 'B. B'],
          answer: 'A',
          type: 'single_choice'
        }
      ]
    });

    const wrapper = mountQuestionBank();
    await flushPromises();

    await wrapper.find('.slot-action').trigger('tap');
    await flushPromises();

    expect(loadBankData).toHaveBeenCalledWith('politics-2025');
    const handoff = storageService.get('quiz_review_handoff_v1');
    expect(handoff.questions.map((q) => q.id)).toEqual(['politics-2025-001']);
    expect(storageService.get('smart_review_ids', [])).toEqual([]);
    expect(global.uni.navigateTo).toHaveBeenCalledWith(
      expect.objectContaining({
        url: `/pages/practice-sub/do-quiz?mode=smart_review&reviewId=${handoff.id}&paperId=politics-2025`
      })
    );
    expect(toast.error).not.toHaveBeenCalled();

    wrapper.unmount();
  });

  it('does not navigate when an imported paper has no usable questions', async () => {
    loadBankData.mockResolvedValue({
      id: 'politics-2025',
      name: '2025考研政治真题',
      subject: '政治',
      year: '2025',
      cards: []
    });

    const wrapper = mountQuestionBank();
    await flushPromises();

    await wrapper.find('.slot-action').trigger('tap');
    await flushPromises();

    expect(storageService.get('smart_review_ids', [])).toEqual([]);
    expect(global.uni.navigateTo).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith('本卷暂无可练题目');

    wrapper.unmount();
  });

  it.each(['owner', 'token'])('does not import a late load into the changed %s or navigate', async (change) => {
    uni.setStorageSync('EXAM_USER_ID', 'owner-a');
    storageService.save('EXAM_TOKEN', 'session-a');
    let reply;
    loadBankData.mockImplementation(
      () =>
        new Promise((resolve) => {
          reply = resolve;
        })
    );
    const wrapper = mountQuestionBank();
    await flushPromises();
    await wrapper.find('.slot-action').trigger('tap');
    if (change === 'owner') uni.setStorageSync('EXAM_USER_ID', 'owner-b');
    else storageService.save('EXAM_TOKEN', 'session-b');
    const before = JSON.stringify(global.__mockStorage);
    reply({ cards: [{ id: 0, question: '完整零号题目', options: ['A.甲', 'B.乙'], answer: 'B' }] });
    await flushPromises();
    expect(JSON.stringify(global.__mockStorage)).toBe(before);
    expect(global.uni.navigateTo).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.info).toHaveBeenCalledWith('账户已变化，请返回题库重新选择');
    wrapper.unmount();
  });
  it.each(['v30_bank', 'quiz_review_handoff_v1'])(
    'does not navigate after %s save failure and retains old bank',
    async (failedKey) => {
      const old = [{ id: 'keep', question: '原银行题', options: ['甲', '乙'], answer: 'A' }];
      storageService.save('v30_bank', old);
      loadBankData.mockResolvedValue({
        cards: [{ id: 0, question: '完整零号题目', options: ['A.甲', 'B.乙'], answer: 'B' }]
      });
      const originalSave = storageService.save.bind(storageService);
      const spy = vi
        .spyOn(storageService, 'save')
        .mockImplementation((key, ...args) => (key === failedKey ? false : originalSave(key, ...args)));
      const wrapper = mountQuestionBank();
      await flushPromises();
      await wrapper.find('.slot-action').trigger('tap');
      await flushPromises();
      expect(global.uni.navigateTo).not.toHaveBeenCalled();
      if (failedKey === 'v30_bank') {
        expect(storageService.get('v30_bank')).toEqual(old);
        expect(toast.success).not.toHaveBeenCalled();
      } else expect(storageService.get('v30_bank').map((q) => q.id)).toEqual(['keep', 0]);
      expect(toast.error).toHaveBeenCalled();
      wrapper.unmount();
      spy.mockRestore();
    }
  );
});

beforeEach(() => setActivePinia(createPinia()));
