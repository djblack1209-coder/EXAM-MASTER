import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const tabbarPath = resolve(process.cwd(), 'src/components/layout/custom-tabbar/custom-tabbar.vue');
const tabPagePaths = [
  ['src/pages/index/index.vue', ':active-index="0"'],
  ['src/pages/practice/index.vue', ':active-index="1"'],
  ['src/pages/profile/index.vue', ':active-index="2"']
];

describe('custom tabbar visual interaction contract', () => {
  const source = readFileSync(tabbarPath, 'utf8');

  it('supports horizontal swipe switching on the floating tabbar', () => {
    expect(source).toContain('@touchstart');
    expect(source).toContain('@touchmove');
    expect(source).toContain('@touchend');
    expect(source).toContain('handleTouchStart');
    expect(source).toContain('handleTouchMove');
    expect(source).toContain('handleTouchEnd');
  });

  it('uses only selected Lucide fill and brand text, without the retired glass slider', () => {
    expect(source).toContain(':selected="visualActiveIndex === index"');
    expect(source).toContain("'violet-ink'");
    expect(source).not.toContain('tabbar-glider');
    expect(source).not.toContain('gliderStyle');
  });

  it('keeps the navigation surface still and uses shared glass tokens', () => {
    const styleBlock = source.split('<style lang="scss" scoped>')[1] || '';

    expect(styleBlock).not.toMatch(/transition:\s*all\b/);
    expect(styleBlock).toContain('background: var(--glass)');
    expect(styleBlock).toContain('color: var(--violet-ink)');
    expect(styleBlock).not.toMatch(/transform:.*scale/);
  });

  it('refreshes the actual route before calculating swipe target', () => {
    const touchStartBlock = source.match(/function handleTouchStart[\s\S]*?\n}/)?.[0] || '';
    const touchEndBlock = source.match(/function handleTouchEnd[\s\S]*?\n}/)?.[0] || '';

    expect(touchStartBlock).toContain('detectCurrentRoute()');
    expect(touchStartBlock).toContain('optimisticIndex.value = null');
    expect(touchEndBlock).toContain('const active = resolvedActiveIndex.value');
  });

  it('pins the active tab state from each cached top-level tab page', () => {
    for (const [pagePath, activeProp] of tabPagePaths) {
      const pageSource = readFileSync(resolve(process.cwd(), pagePath), 'utf8');

      expect(pageSource).toContain(`<CustomTabbar ${activeProp} />`);
    }
  });
});
