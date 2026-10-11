import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import QuizResult from '@/pages/practice-sub/components/quiz-result/quiz-result.vue';

vi.mock('@/stores/modules/study-engine.js', () => ({
  useStudyEngineStore: () => ({ analyzeMastery: async () => null })
}));

const source = readFileSync(
  resolve(process.cwd(), 'src/pages/practice-sub/components/quiz-result/quiz-result.vue'),
  'utf8'
);

describe('quiz result progress semantics guard', () => {
  it('uses the shared distribution without treating missing grades as incorrect', () => {
    expect(source).toContain('summarizeQuizProgress');
    expect(source).not.toContain('const wrongCount = computed(() => totalCount.value - correctCount.value)');
  });
  it.each([
    [{ isCorrect: null, referenceMatch: false, grade: { status: 'pending' } }, '已记录，待核对', '1 待核对'],
    [{ isCorrect: true, userChoice: 'flashcard_rating_3' }, '已查看/自评', '1 已查看/自评'],
    [{ isCorrect: true }, '历史记录', '1 旧记录'],
    [{ isCorrect: false }, '历史记录', '1 旧记录'],
    [{ isCorrect: true, grade: { status: 'reliable' } }, '暂未判分', '1 依据不明'],
    [{}, '暂未判分', '1 依据不明']
  ])('shows %j with its actual provenance and no grade-based advice', async (record, title, category) => {
    const answeredQuestions = [{ index: 0, ...record }];
    const before = JSON.stringify(answeredQuestions);
    const wrapper = mount(QuizResult, {
      props: {
        visible: true,
        questions: [{ category: '原题' }],
        answeredQuestions,
        diagnosisSummary: '旧缓存声称稳定掌握',
        hasNextRecommendation: true
      },
      global: {
        stubs: { BaseIcon: true, WdPopup: { props: ['modelValue'], template: '<div v-if="modelValue"><slot /></div>' } }
      }
    });
    try {
      await flushPromises();
      expect(wrapper.find('.accuracy-label').text()).toBe(title);
      expect(wrapper.find('.cat-pct').text()).toBe(category);
      expect(wrapper.find('.ring-unit').exists()).toBe(false);
      expect(
        wrapper.findAll('.next-step-item, .celebration-overlay, .highscore-celebration, .xp-coins-flyout')
      ).toHaveLength(0);
      expect(wrapper.text()).not.toContain('旧缓存声称稳定掌握');
      expect(wrapper.text()).not.toContain('继续刷下一组');
      expect(wrapper.text()).toContain('查看学习记录');
      expect(wrapper.text()).not.toContain('已记录复习');
      expect(JSON.stringify(answeredQuestions)).toBe(before);
    } finally {
      wrapper.unmount();
    }
  });
  it('shows the historical denominator separately from reviews and pending answers', async () => {
    const records = [
      { isCorrect: true },
      { isCorrect: false },
      { isCorrect: true, userChoice: 'flashcard_rating_3' },
      { grade: { status: 'pending' } }
    ].map((r, index) => ({ ...r, index }));
    const wrapper = mount(QuizResult, {
      props: { visible: true, questions: records.map(() => ({ category: '混合记录' })), answeredQuestions: records },
      global: {
        stubs: { BaseIcon: true, WdPopup: { props: ['modelValue'], template: '<div v-if="modelValue"><slot /></div>' } }
      }
    });
    try {
      await flushPromises();
      expect(wrapper.text()).toContain('旧判对比例 50%（1/2）');
      expect(wrapper.find('.cat-pct').text()).toBe('1 待核对 · 1 已查看/自评 · 2 旧记录');
      expect(wrapper.find('.ring-unit').exists()).toBe(false);
    } finally {
      wrapper.unmount();
    }
  });
});
