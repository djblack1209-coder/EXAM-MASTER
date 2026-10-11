import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(resolve(process.cwd(), 'src/pages/practice-sub/do-quiz.vue'), 'utf8');

describe('do quiz answer motion guard', () => {
  it('keeps answer effects wired to the unified feedback sound channel', () => {
    expect(source).toContain("playQuizSound('correct')");
    expect(source).toContain("playQuizSound('wrong')");
    expect(source).toContain("this.correctAnimationClass = 'quiz-correct-animation'");
    expect(source).toContain("this.wrongAnimationClass = 'quiz-wrong-animation'");
  });

  it('keeps correct and wrong card motion active', () => {
    const result = readFileSync(
      resolve(process.cwd(), 'src/pages/practice-sub/components/quiz-result/quiz-result.vue'),
      'utf8'
    );
    expect(result).toContain('<YoziMascot');
    expect(result).toContain("'celebrate' : 'encourage'");
    expect(result).toContain('play="once"');
    const layout = readFileSync(resolve(process.cwd(), 'src/styles/yozi-pages.scss'), 'utf8');
    expect(layout).toContain('prefers-reduced-motion: reduce');
  });

  it('does not leave feedback classes as visual no-ops', () => {
    expect(source).not.toContain('.quiz-correct-animation {\n  animation: none;\n}\n\n.quiz-wrong-animation');
    expect(source).not.toContain('.quiz-wrong-animation {\n  animation: none;\n}\n\n/* ====================');
  });
});
