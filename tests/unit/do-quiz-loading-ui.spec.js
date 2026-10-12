import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import DoQuizPage from '@/pages/practice-sub/do-quiz.vue';

const doQuizPath = resolve(process.cwd(), 'src/pages/practice-sub/do-quiz.vue');

describe('do quiz loading experience', () => {
  const source = readFileSync(doQuizPath, 'utf8');

  it('shows a dedicated loading surface while the first question is being prepared', () => {
    expect(source).toContain('v-if="showQuizLoading"');
    expect(source).toContain('<BaseEmpty');
    expect(source).toContain('state="loading"');
  });

  it('does not keep the loading surface visible over blocking modals', () => {
    const computedBlock = source.match(/showQuizLoading\(\)[\s\S]*?\n    }/)?.[0] || '';

    expect(computedBlock).toContain('!this.currentQuestion');
    expect(computedBlock).toContain('!this.showEmptyBankModal');
    expect(computedBlock).toContain('!this.showResumeModal');
    expect(computedBlock).toContain('!this.showCompleteModal');
  });

  it.each([
    [0, 0, '0 / 0'],
    [3, 0, '1 / 3'],
    [3, 2, '3 / 3'],
    [3, 9, '3 / 3'],
    [3, -1, '1 / 3'],
    [3, NaN, '1 / 3']
  ])('shows a bounded question position for %s questions and index %s', (count, currentIndex, expected) => {
    expect(DoQuizPage.computed.quizProgressLabel.call({ questions: Array(count), currentIndex })).toBe(expected);
  });
});
