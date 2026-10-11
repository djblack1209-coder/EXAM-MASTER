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

  it('review store exposes question-bank page APIs with local fallback', async () => {
    const { useReviewStore } = await import('@/stores/modules/review.js');
    const store = useReviewStore();

    const stats = await store.fetchQuestionBankStats();
    const questions = await store.browseQuestions({ category: '英语', page: 1, pageSize: 20 });
    const random = await store.fetchQuestionBankRandom({ category: '数学', count: 1 });

    expect(stats).toMatchObject({ success: true, source: 'local' });
    expect(questions).toMatchObject({ success: true, source: 'local' });
    expect(random).toMatchObject({ success: true, source: 'local' });
    expect(stats.data.total).toBe(2);
    expect(stats.data.categories.find((item) => item.category === '英语')?.total).toBe(1);
    expect(questions.data.list).toHaveLength(1);
    expect(questions.data.list[0]._id).toBe('q1');
    expect(random.data).toHaveLength(1);
    expect(random.data[0]._id).toBe('q2');
    expect(random.data[0].category).toBe('数学');
    expect(store.questionBankStats).toEqual(stats.data);
    expect(store.questionBankList).toEqual(questions.data.list);
  });

  it('treats HTTP 200 application auth failures as failed remote calls and falls back locally', async () => {
    for (const api of [browseQuestions, getQuestionBankRandom, getQuestionBankStats]) {
      api.mockResolvedValueOnce({
        code: 401,
        success: false,
        message: '缺少认证 token，请重新登录'
      });
    }

    const { useReviewStore } = await import('@/stores/modules/review.js');
    const store = useReviewStore();

    const stats = await store.fetchQuestionBankStats();
    const questions = await store.browseQuestions({ category: '英语', page: 1, pageSize: 20 });
    const random = await store.fetchQuestionBankRandom({ category: '数学', count: 1 });

    expect(stats).toMatchObject({ success: true, source: 'local' });
    expect(questions).toMatchObject({ success: true, source: 'local' });
    expect(random).toMatchObject({ success: true, source: 'local' });
    expect(stats.data.total).toBe(2);
    expect(stats.data.categories.find((item) => item.category === '英语')?.total).toBe(1);
    expect(questions.data.list).toHaveLength(1);
    expect(questions.data.list[0]._id).toBe('q1');
    expect(random.data).toHaveLength(1);
    expect(random.data[0]._id).toBe('q2');
    expect(random.data[0].category).toBe('数学');
    expect(store.questionBankStats).toEqual(stats.data);
    expect(store.questionBankList).toEqual(questions.data.list);
  });
});
