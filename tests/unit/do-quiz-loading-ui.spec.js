import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const doQuizPath = resolve(process.cwd(), 'src/pages/practice-sub/do-quiz.vue');

describe('do quiz loading experience', () => {
  const source = readFileSync(doQuizPath, 'utf8');

  it('shows a dedicated loading surface while the first question is being prepared', () => {
    expect(source).toContain('v-if="showQuizLoading"');
    expect(source).toContain('quiz-loading-overlay');
    expect(source).toContain('quiz-loading-skeleton');
  });

  it('does not keep the loading surface visible over blocking modals', () => {
    const computedBlock = source.match(/showQuizLoading\(\)[\s\S]*?\n    }/)?.[0] || '';

    expect(computedBlock).toContain('!this.currentQuestion');
    expect(computedBlock).toContain('!this.showEmptyBankModal');
    expect(computedBlock).toContain('!this.showResumeModal');
    expect(computedBlock).toContain('!this.showCompleteModal');
  });
});
