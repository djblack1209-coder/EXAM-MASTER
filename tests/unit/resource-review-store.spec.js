import { beforeEach, describe, expect, it, vi } from 'vitest';
import { browseQuestions, getQuestionBankRandom, getQuestionBankStats } from '@/services/api/domains/practice.api.js';
import { createPinia, setActivePinia } from 'pinia';

vi.mock('@/services/api/domains/practice.api.js', () => ({
  browseQuestions: vi.fn(async () => ({ code: -1, success: false })),
  getQuestionBankRandom: vi.fn(async () => ({ code: -1, success: false })),
  getQuestionBankStats: vi.fn(async () => ({ code: -1, success: false }))
}));

vi.mock('@/services/api/domains/resource.api.js', () => ({
  getByCategory: vi.fn(async () => ({
    code: 0,
    data: { resources: [{ id: 'r2', title: '英语阅读', category: 'article' }], total: 1, hasMore: false }
  })),
  getHotResources: vi.fn(async () => ({ code: 0, data: [{ id: 'r1', title: '热门资源' }] })),
  getRecommendations: vi.fn(async () => ({
    code: 0,
    data: { resources: [{ id: 'r0', title: '推荐资源' }], personalized: false }
  })),
  searchResources: vi.fn(async () => ({
    code: 0,
    data: { resources: [{ id: 'r3', title: '数学工具' }], total: 1, keyword: '数学' }
  }))
}));

describe('resource and review stores', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    uni.setStorageSync('v30_bank', [
      { id: 'q1', question: '英语阅读', category: '英语', difficulty: 'easy', source: '2000真题' },
      { id: 'q2', question: '数学极限', category: '数学', difficulty: 'medium', source: '2001真题' }
    ]);
    uni.setStorageSync('imported_files', [
      { id: 'upload_001', name: 'english.pdf', status: 'completed', source: '本地文件', date: '2026-04-30' }
    ]);
  });

  it('review store exposes question-bank page APIs with local fallback', async () => {
    const { useReviewStore } = await import('@/stores/modules/review.js');
    const store = useReviewStore();

    const stats = await store.fetchQuestionBankStats();
    const questions = await store.browseQuestions({ category: '英语', page: 1, pageSize: 20 });
    const random = await store.fetchQuestionBankRandom({ category: '数学', count: 1 });

    expect(stats.success).toBe(true);
    expect(stats.data.total).toBe(2);
    expect(stats.data.categories.find((item) => item.category === '英语')?.total).toBe(1);
    expect(questions.data.list).toHaveLength(1);
    expect(questions.data.list[0]._id).toBe('q1');
    expect(random.data).toHaveLength(1);
    expect(random.data[0].category).toBe('数学');
  });

  it('treats HTTP 200 application auth failures as failed remote calls and falls back locally', async () => {
    browseQuestions.mockResolvedValueOnce({
      code: 401,
      success: false,
      message: '缺少认证 token，请重新登录'
    });
    getQuestionBankRandom.mockResolvedValueOnce({
      code: 401,
      success: false,
      message: '缺少认证 token，请重新登录'
    });
    getQuestionBankStats.mockResolvedValueOnce({
      code: 401,
      success: false,
      message: '缺少认证 token，请重新登录'
    });

    const { useReviewStore } = await import('@/stores/modules/review.js');
    const store = useReviewStore();

    const stats = await store.fetchQuestionBankStats();
    const questions = await store.browseQuestions({ category: '英语', page: 1, pageSize: 20 });
    const random = await store.fetchQuestionBankRandom({ category: '数学', count: 1 });

    expect(stats).toMatchObject({ success: true, source: 'local' });
    expect(questions).toMatchObject({ success: true, source: 'local' });
    expect(random).toMatchObject({ success: true, source: 'local' });
    expect(questions.data.list[0]._id).toBe('q1');
    expect(random.data[0].category).toBe('数学');
  });

  it('resource store exposes resource page APIs and refreshes intake snapshot', async () => {
    const { useResourceStore } = await import('@/stores/modules/resource.js');
    const store = useResourceStore();

    await store.fetchRecommendations();
    await store.fetchHotResources();
    await store.fetchByCategory({ category: 'article', page: 1, pageSize: 20 });
    await store.search({ keyword: '数学', page: 1, pageSize: 20 });
    const snapshot = store.refreshIntakeSnapshot();

    expect(store.recommendations[0].title).toBe('推荐资源');
    expect(store.hotResources[0].title).toBe('热门资源');
    expect(store.categoryResources[0].title).toBe('英语阅读');
    expect(store.searchResults[0].title).toBe('数学工具');
    expect(snapshot.imports.completed).toBe(1);
    expect(store.intakeSnapshot.bank.totalQuestions).toBe(2);
  });
});
