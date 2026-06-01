import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  resolve(process.cwd(), 'src/pages/practice-sub/components/answer-sheet/answer-sheet.vue'),
  'utf8'
);

describe('answer sheet experience guard', () => {
  it('keeps a compact review summary beyond answered count and accuracy', () => {
    expect(source).toContain('class="sheet-insight-row"');
    expect(source).toContain('correctCount');
    expect(source).toContain('wrongCount');
    expect(source).toContain('reviewedCount');
    expect(source).toContain('remainingCount');
    expect(source).toContain('剩 {{ remainingCount }}');
  });

  it('does not count neutral flashcard reviews as wrong or graded accuracy', () => {
    expect(source).toContain("item.isCorrect === true ? 'correct' : item.isCorrect === false ? 'wrong' : 'reviewed'");
    expect(source).toContain('const gradedCount = computed(() => correctCount.value + wrongCount.value)');
    expect(source).toContain('return Math.round((correctCount.value / gradedCount.value) * 100)');
    expect(source).toContain('.cell-reviewed .cell-num');
  });

  it('keeps reviewed status visible in the grid and legend', () => {
    expect(source).toContain("classes.push(status ? `cell-${status}` : 'cell-unanswered')");
    expect(source).toContain('dot-reviewed');
    expect(source).toContain('已复习</text>');
  });

  it('keeps dark-mode coverage for answer-sheet review details', () => {
    expect(source).toContain('.dark-mode .insight-pill');
    expect(source).toContain('.dark-mode .cell-reviewed .cell-num');
    expect(source).toContain('.dark-mode .dot-reviewed');
  });
});
