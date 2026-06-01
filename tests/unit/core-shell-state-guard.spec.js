import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(process.cwd());

const SHELL_STATE_EXPECTATIONS = [
  {
    file: 'src/pages/index/index.vue',
    required: ['isPageLoading', 'pageError', 'retryLoadData', 'shell-state-card', 'tabBarHeight']
  },
  {
    file: 'src/pages/practice/index.vue',
    required: ['isPageLoading', 'empty-track-card', 'loadingBankId', 'tabBarHeight']
  },
  {
    file: 'src/pages/profile/index.vue',
    required: ['isLoggedIn', 'login-hint', 'tabBarHeight']
  },
  {
    file: 'src/pages/settings/index.vue',
    required: ['isPageLoading', 'skeleton-settings', 'footer-safe', 'onErrorCaptured']
  }
];

describe('core shell state guard', () => {
  it('keeps loading, empty, error, and safe-area states visible in core shell pages', () => {
    const offenders = [];

    for (const { file, required } of SHELL_STATE_EXPECTATIONS) {
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
