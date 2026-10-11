import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import QuizProgress from '@/pages/practice-sub/components/quiz-progress/quiz-progress.vue';

const source = readFileSync(
  resolve(process.cwd(), 'src/pages/practice-sub/components/quiz-progress/quiz-progress.vue'),
  'utf8'
);

describe('quiz progress experience guard', () => {
  it('keeps the current question denominator and shared navigation controls', () => {
    expect(source).toContain('<BaseStat');
    expect(source).toContain(':value="safeCurrent"');
    expect(source).toContain(':denominator="safeTotal"');
    expect(source).toContain('<BaseButton');
    expect(source).toContain('variant="quiet"');
  });

  it('keeps answer distribution visible without counting neutral reviews as wrong', () => {
    expect(source).toContain("status.startsWith('legacy_')");
    expect(source).toContain('getQuizAnswerRecordOutcome(item)');
    expect(source).toContain("t('quiz.progress.legacy'");
    expect(source).toContain('dot-${status}');
  });

  it('renders legacy true/false self ratings as reviews without changing their stored flags', () => {
    const answered = [
      { index: 0, isCorrect: true, userChoice: 0 },
      { index: 1, isCorrect: true, userChoice: 'flashcard_rating_3' },
      { index: 2, isCorrect: false, userChoice: 'flashcard_rating_1' }
    ];
    const before = JSON.stringify(answered);
    const wrapper = mount(QuizProgress, { props: { total: 4, current: 3, answered } });
    expect(wrapper.text()).toContain('3 已记录 · 2 已查看/自评 · 1 旧记录 · 剩 1');
    expect(wrapper.findAll('.dot-reviewed')).toHaveLength(2);
    expect(wrapper.findAll('.dot-wrong')).toHaveLength(0);
    expect(JSON.stringify(answered)).toBe(before);
    wrapper.unmount();
  });

  it('uses safe totals and accessible progress copy', () => {
    expect(source).toContain('v-for="idx in safeTotal"');
    expect(source).toContain('const progressAriaLabel = computed');
    expect(source).toContain(':aria-label="progressAriaLabel"');
    expect(source).toContain("t('quiz.progress.aria'");
  });

  it('uses the shared themed control implementation', () => {
    expect(source).toContain('@/components/base/base-button/base-button.vue');
    expect(source).toContain('@/components/base/base-stat/base-stat.vue');
    expect(source).not.toMatch(/#[0-9a-f]{3,8}\b/i);
  });
});
