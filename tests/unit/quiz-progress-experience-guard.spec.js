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
  it('keeps a clear progress meter with percent and moving thumb', () => {
    expect(source).toContain('class="progress-meter-wrap"');
    expect(source).toContain('class="progress-percent"');
    expect(source).toContain('{{ progressPercent }}%');
    expect(source).toContain('class="progress-meter-thumb"');
    expect(source).toContain(':style="{ left: progressPercent + \'%\' }"');
    expect(source).toContain('transition: left 280ms cubic-bezier(0.16, 1, 0.3, 1)');
  });

  it('keeps answer distribution visible without counting neutral reviews as wrong', () => {
    expect(source).toContain("status.startsWith('legacy_')");
    expect(source).toContain('getQuizAnswerRecordOutcome(item)');
    expect(source).toContain('`${legacy} 旧记录`');
    expect(source).toContain('.dot-reviewed');
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
    expect(source).toContain('第 {{ safeCurrent }} / {{ safeTotal }} 题');
  });

  it('keeps dark-mode coverage for progress details', () => {
    expect(source).toContain('.dark-mode .progress-meter');
    expect(source).toContain('.dark-mode .progress-meter-thumb');
    expect(source).toContain('.dark-mode .progress-percent');
    expect(source).toContain('.dark-mode .dot-reviewed');
  });
});
