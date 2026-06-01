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
    expect(source).toContain('@keyframes correctPulse');
    expect(source).toContain('@keyframes wrongShake');
    expect(source).toContain('.quiz-correct-animation .question-card');
    expect(source).toContain('correctPulse 360ms cubic-bezier(0.16, 1, 0.3, 1)');
    expect(source).toContain('.quiz-wrong-animation .question-card');
    expect(source).toContain('wrongShake 360ms cubic-bezier(0.36, 0.07, 0.19, 0.97)');
  });

  it('does not leave feedback classes as visual no-ops', () => {
    expect(source).not.toContain('.quiz-correct-animation {\n  animation: none;\n}\n\n.quiz-wrong-animation');
    expect(source).not.toContain('.quiz-wrong-animation {\n  animation: none;\n}\n\n/* ====================');
  });
});
