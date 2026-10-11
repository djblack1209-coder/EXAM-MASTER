import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  resolve(process.cwd(), 'src/pages/practice-sub/components/quiz-result/quiz-result.vue'),
  'utf8'
);

describe('quiz result action dock guard', () => {
  it('keeps completion actions outside the scrollable report content', () => {
    const scrollEndIndex = source.indexOf('</scroll-view>');
    const dockIndex = source.indexOf('class="action-dock"');

    expect(scrollEndIndex).toBeGreaterThan(-1);
    expect(dockIndex).toBeGreaterThan(scrollEndIndex);
    expect(source).not.toContain('class="action-row"');
  });

  it('keeps a stable bottom dock with safe-area and dark-mode coverage', () => {
    expect(source).toContain('class="action-dock"');
    expect(source).toContain('position="bottom"');
    expect(source).toContain(':is-dark="isDark"');
    const modal = readFileSync(resolve(process.cwd(), 'src/components/common/CustomModal.vue'), 'utf8');
    expect(modal).toContain('env(safe-area-inset-bottom)');
  });

  it('keeps the report action hierarchy aligned with the shared clay palette', () => {
    expect(source).toContain('<BaseButton');
    const button = readFileSync(resolve(process.cwd(), 'src/components/base/base-button/base-button.vue'), 'utf8');
    expect(button).toContain('background: var(--clay-face)');
    expect(button).toContain('box-shadow: var(--clay-shadow)');
    expect(source).toContain('variant="secondary"');
    expect(source).not.toContain('background: #1cb0f6');
  });
});
