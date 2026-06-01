import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const doQuizSource = readFileSync(resolve(process.cwd(), 'src/pages/practice-sub/do-quiz.vue'), 'utf8');

describe('do quiz formal feedback experience', () => {
  it('folds unrelated wrong options after answering', () => {
    expect(doQuizSource).toContain("'option-folded': isOptionFolded(idx)");
    expect(doQuizSource).toContain('option-item.option-folded');
    expect(doQuizSource).toContain('userChoice !== idx');
  });

  it('shows a knowledge card in the result surface', () => {
    expect(doQuizSource).toContain('v-if="knowledgeCard"');
    expect(doQuizSource).toContain('class="knowledge-card"');
    expect(doQuizSource).toContain('currentQuestion.knowledge_points');
  });

  it('keeps sound and haptic feedback for answer confirmation', () => {
    expect(doQuizSource).toContain("playQuizSound('correct')");
    expect(doQuizSource).toContain("playQuizSound('wrong')");
    expect(doQuizSource).toContain('playCorrectEffect()');
    expect(doQuizSource).toContain('playWrongEffect()');
  });
});
