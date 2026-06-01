import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const doQuizPath = resolve(process.cwd(), 'src/pages/practice-sub/do-quiz.vue');

describe('do quiz resume contract', () => {
  const source = readFileSync(doQuizPath, 'utf8');

  it('honors resume=true by restoring the saved question snapshot without current-bank context filtering', () => {
    expect(source).toContain('forceResumeProgress');
    expect(source).toContain("query.resume === 'true'");
    expect(source).toContain('this.forceResumeProgress ? null : this.quizProgressContext');
  });
});
