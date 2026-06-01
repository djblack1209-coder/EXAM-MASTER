import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(resolve(process.cwd(), 'src/pages/practice-sub/do-quiz.vue'), 'utf8');

describe('do quiz result surface guard', () => {
  it('keeps backdrop taps separate from the next-question action', () => {
    expect(source).toContain('class="result-backdrop" @tap.stop />');
    expect(source).not.toContain('class="result-backdrop" @tap.stop="closeResult"');
  });

  it('places the next action in a dedicated bottom action row', () => {
    const actionRowIndex = source.indexOf('class="result-action-row"');
    const nextButtonIndex = source.indexOf('id="e2e-quiz-next-btn"');

    expect(actionRowIndex).toBeGreaterThan(-1);
    expect(nextButtonIndex).toBeGreaterThan(actionRowIndex);
    expect(source).toContain('class="result-next-btn result-primary-action"');
    expect(source).toContain('@tap.stop="closeResult"');
  });

  it('keeps result content scrollable while the primary action remains stable', () => {
    expect(source).toContain('class="result-content-scroll"');
    expect(source).toContain('max-height: calc(78vh - env(safe-area-inset-bottom))');
    expect(source).toContain('max-height: 52vh');
    expect(source).toContain('bottom: calc(120rpx + env(safe-area-inset-bottom))');
  });

  it('keeps accessibility and disabled state contracts on the primary action', () => {
    expect(source).toContain(':aria-disabled="isNavigating ? \'true\' : \'false\'"');
    expect(source).toContain(':class="{ disabled: isNavigating }"');
    expect(source).toContain('.result-primary-action.disabled');
  });

  it('keeps header status visual separate from the primary action', () => {
    expect(source).toContain('class="result-status-mark"');
    expect(source).toContain('.result-pop.correct .result-status-mark');
    expect(source).toContain('.result-pop.wrong .result-status-mark');
    expect(source).not.toContain('class="result-icon-btn result-primary-action"');
  });
});
