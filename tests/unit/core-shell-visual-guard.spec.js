import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(process.cwd());

const CORE_VISUAL_EXPECTATIONS = [
  {
    file: 'src/pages/index/index.vue',
    required: [
      '@include em-mobile-canvas',
      '@include em-mobile-topbar',
      '@include em-mobile-glass-surface',
      '@include em-mobile-pressable',
      "height: tabBarHeight + 96 + 'px'"
    ]
  },
  {
    file: 'src/pages/practice/index.vue',
    required: [
      '@include em-mobile-canvas',
      '@include em-mobile-topbar',
      '@include em-mobile-deep-panel',
      '@include em-mobile-glass-surface',
      '@include em-mobile-primary-action',
      '@include em-mobile-pressable',
      "height: tabBarHeight + 96 + 'px'"
    ]
  },
  {
    file: 'src/pages/profile/index.vue',
    required: [
      '@include em-mobile-canvas',
      '@include em-mobile-topbar',
      '@include em-mobile-glass-surface',
      '@include em-mobile-pressable',
      "height: tabBarHeight + 96 + 'px'"
    ]
  },
  {
    file: 'src/pages/settings/index.vue',
    required: ['settings-container', 'apple-glass', 'wise-card', 'footer-safe', 'ds-touchable']
  }
];

describe('core shell visual guard', () => {
  it('keeps core pages on the shared lightweight financial visual language', () => {
    const offenders = [];

    for (const { file, required } of CORE_VISUAL_EXPECTATIONS) {
      const source = readFileSync(resolve(ROOT, file), 'utf8');

      for (const token of required) {
        if (!source.includes(token)) {
          offenders.push(`${file} -> missing ${token}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });
});
