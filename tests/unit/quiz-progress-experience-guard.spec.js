import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

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
    expect(source).toContain(":style=\"{ left: progressPercent + '%' }\"");
    expect(source).toContain('transition: left 280ms cubic-bezier(0.16, 1, 0.3, 1)');
  });

  it('keeps answer distribution visible without counting neutral reviews as wrong', () => {
    expect(source).toContain('const correctCount = computed');
    expect(source).toContain('const wrongCount = computed');
    expect(source).toContain("item.isCorrect === true ? 'correct' : item.isCorrect === false ? 'wrong' : 'reviewed'");
    expect(source).toContain('`${answeredCount.value} 已答 · ${correctCount.value} 对 ${wrongCount.value} 错`');
    expect(source).toContain('.dot-reviewed');
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
