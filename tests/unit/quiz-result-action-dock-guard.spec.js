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
    expect(source).toContain('.action-dock');
    expect(source).toContain('padding-bottom: calc(22rpx + env(safe-area-inset-bottom, 0px))');
    expect(source).toContain('border-top: 1rpx solid rgba(15, 23, 42, 0.08)');
    expect(source).toContain('.dark-mode .action-dock');
    expect(source).toContain('.dark-mode .secondary-btn');
  });

  it('keeps the report action hierarchy aligned with the shared clay palette', () => {
    expect(source).toContain('background: var(--clay-face)');
    expect(source).toContain('color: var(--on-clay)');
    expect(source).toContain('box-shadow: var(--clay-shadow)');
    expect(source).toContain('class="action-btn tertiary-btn"');
    expect(source).toContain('.tertiary-btn');
    expect(source).not.toContain('box-shadow: 0 6rpx 0 #1899d6');
    expect(source).not.toContain('background: #1cb0f6');
  });
});
