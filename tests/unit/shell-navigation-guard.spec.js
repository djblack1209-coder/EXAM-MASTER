import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(process.cwd());
const CORE_SHELL_PAGES = [
  'src/pages/index/index.vue',
  'src/pages/practice/index.vue',
  'src/pages/profile/index.vue',
  'src/pages/settings/index.vue'
];

const DIRECT_ROUTE_CALL = /uni\.(navigateTo|switchTab|redirectTo|reLaunch)\s*\(/g;

describe('core shell navigation guard', () => {
  it('routes core shell page actions through safe navigation helpers', () => {
    const offenders = [];

    for (const file of CORE_SHELL_PAGES) {
      const source = readFileSync(resolve(ROOT, file), 'utf8');
      const matches = source.match(DIRECT_ROUTE_CALL) || [];

      for (const match of matches) {
        offenders.push(`${file} -> ${match}`);
      }
    }

    expect(offenders).toEqual([]);
  });
});
