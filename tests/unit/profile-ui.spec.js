import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('profile page static UI contract', () => {
  const source = readFileSync(resolve(process.cwd(), 'src/pages/profile/index.vue'), 'utf8');

  it('does not render escaped HTML entities for menu arrows', () => {
    expect(source).not.toContain('<text class="menu-arrow">></text>');
    expect(source).toContain('<text class="menu-arrow">›</text>');
  });
});
