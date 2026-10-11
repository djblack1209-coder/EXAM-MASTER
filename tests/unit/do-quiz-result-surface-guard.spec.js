import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(resolve(process.cwd(), 'src/pages/practice-sub/do-quiz.vue'), 'utf8');

describe('do quiz result surface guard', () => {
  it('keeps backdrop taps separate from the next-question action', () => {
    expect(source).toContain('<CustomModal');
    expect(source).toContain(':visible="showResult"');
    expect(source).toContain('@cancel="showResult = false"');
    expect(source).not.toContain('class="result-backdrop"');
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
    expect(source).toContain('class="result-action-row"');
    const modal = readFileSync(resolve(process.cwd(), 'src/components/common/CustomModal.vue'), 'utf8');
    expect(modal).toContain('overflow-y: auto');
    expect(modal).toContain('env(safe-area-inset-bottom)');
  });

  it('keeps accessibility and disabled state contracts on the primary action', () => {
    expect(source).toContain('id="e2e-quiz-next-btn"');
    expect(source).toContain(':disabled="isNavigating"');
    const button = readFileSync(resolve(process.cwd(), 'src/components/base/base-button/base-button.vue'), 'utf8');
    expect(button).toContain(':aria-disabled="blocked"');
    expect(button).toContain(':tabindex="blocked ? -1 : 0"');
  });

  it('keeps header status visual separate from the primary action', () => {
    expect(source).toContain('class="result-status-mark"');
    expect(source).toContain("resultStatus === 'pending'");
    expect(source).toContain('result-primary-action');
    expect(source).not.toContain('class="result-icon-btn result-primary-action"');
  });
});
