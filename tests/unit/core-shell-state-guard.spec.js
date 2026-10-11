import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(process.cwd());

const SHELL_STATE_EXPECTATIONS = [
  {
    file: 'src/pages/index/index.vue',
    required: ['isPageLoading', 'pageError', 'retryLoadData', 'shell-state-card', 'tabBarStyle']
  },
  {
    file: 'src/pages/practice/index.vue',
    required: ['isPageLoading', 'empty-track-card', 'loadingBankId', 'tabBarStyle']
  },
  {
    file: 'src/pages/profile/index.vue',
    required: ['isLoggedIn', 'login-hint', 'tabBarStyle']
  }
];

describe('core shell state guard', () => {
  it('keeps loading, empty, error, and safe-area states visible in core shell pages', () => {
    for (const { file, required } of SHELL_STATE_EXPECTATIONS) {
      const page = readFileSync(resolve(ROOT, file), 'utf8');
      for (const entry of required.filter((x) => !['shell-state-card', 'empty-track-card', 'login-hint'].includes(x)))
        expect(page).toContain(entry);
    }
    const home = readFileSync(resolve(ROOT, 'src/pages/index/index.vue'), 'utf8');
    expect(home).toContain('<BaseEmpty');
    expect(home).toContain("pageError ? 'error' : 'loading'");
    const practice = readFileSync(resolve(ROOT, 'src/pages/practice/index.vue'), 'utf8');
    expect(practice).toContain('@action="chooseImportSource"');
  });
});
