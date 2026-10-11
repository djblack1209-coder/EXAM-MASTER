import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(process.cwd());

describe('core shell visual guard', () => {
  it('keeps core pages on the shared lightweight financial visual language', () => {
    for (const file of ['index', 'practice', 'profile']) {
      const page = readFileSync(resolve(ROOT, 'src/pages/' + file + '/index.vue'), 'utf8');
      expect(page).toContain('@/styles/yozi-pages.scss');
      expect(page).toContain('BaseButton');
      expect(page).not.toContain('@include em-mobile-pressable');
    }
  });
});
