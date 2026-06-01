import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  resolve(process.cwd(), 'src/pages/practice-sub/components/quiz-result/quiz-result.vue'),
  'utf8'
);

describe('quiz result progress semantics guard', () => {
  it('reuses the shared quiz progress summary contract', () => {
    expect(source).toContain("import { summarizeQuizProgress } from '@/services/quiz-session-contract.js'");
    expect(source).toContain('const progressSummary = computed(() =>');
    expect(source).toContain('summarizeQuizProgress({');
    expect(source).toContain('const answeredCount = computed(() => progressSummary.value.answeredCount)');
    expect(source).toContain('const neutralCount = computed(() => progressSummary.value.neutralCount)');
    expect(source).toContain('return progressSummary.value.accuracy');
  });

  it('does not treat neutral flashcard records as wrong answers', () => {
    expect(source).toContain('const wrongCount = computed(() => progressSummary.value.wrongCount)');
    expect(source).not.toContain('const wrongCount = computed(() => totalCount.value - correctCount.value)');
    expect(source).not.toContain('return Math.round((correctCount.value / totalCount.value) * 100)');
  });

  it('surfaces reviewed records without calling them mistakes', () => {
    expect(source).toContain("{{ neutralCount > 0 ? '已复习' : '平均用时' }}");
    expect(source).toContain("{{ cat.graded > 0 ? `${cat.accuracy}%` : '已复习' }}");
    expect(source).toContain(':class="{ reviewed: cat.graded === 0 }"');
    expect(source).toContain('.cat-bar-fill.reviewed');
  });

  it('keeps category accuracy based on graded records only', () => {
    expect(source).toContain('if (!map[cat]) map[cat] = { answered: 0, graded: 0, correct: 0, neutral: 0 }');
    expect(source).toContain('if (a.isCorrect === true)');
    expect(source).toContain('} else if (a.isCorrect === false) {');
    expect(source).toContain('accuracy: d.graded > 0 ? Math.round((d.correct / d.graded) * 100) : 0');
  });
});
