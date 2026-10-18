import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { browseQuestions, getQuestionBankRandom, getQuestionBankStats } from '@/services/api/domains/practice.api.js';

vi.mock('@/services/api/domains/practice.api.js', () => ({
  browseQuestions: vi.fn(),
  getQuestionBankRandom: vi.fn(),
  getQuestionBankStats: vi.fn()
}));

describe('review store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    for (const api of [browseQuestions, getQuestionBankRandom, getQuestionBankStats]) {
      api.mockReset().mockResolvedValue({ code: -1, success: false });
    }
    uni.setStorageSync('v30_bank', [
      { id: 'q1', question: '英语阅读', category: '英语', difficulty: 'easy', source: '2000真题' },
      { id: 'q2', question: '数学极限', category: '数学', difficulty: 'medium', source: '2001真题' }
    ]);
  });

  it.each(['fetchQuestionBankStats', 'browseQuestions', 'fetchQuestionBankRandom'])(
    'retired %s preserves cached originals and never uses remote or local fallback',
    async (method) => {
      const { useReviewStore } = await import('@/stores/modules/review.js');
      const before = uni.getStorageSync('v30_bank'),
        store = useReviewStore();
      expect(await store[method]()).toMatchObject({ success: false, code: 410 });
      expect(uni.getStorageSync('v30_bank')).toEqual(before);
      for (const api of [browseQuestions, getQuestionBankRandom, getQuestionBankStats])
        expect(api).not.toHaveBeenCalled();
      expect(store.questionBankStats).toEqual({ total: 0, categories: [] });
      expect(store.questionBankList).toEqual([]);
    }
  );
});
