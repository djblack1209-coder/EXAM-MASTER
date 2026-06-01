import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(process.cwd());
const DO_QUIZ_FILE = 'src/pages/practice-sub/do-quiz.vue';
const DIRECT_ROUTE_CALL = /uni\.(navigateTo|switchTab|redirectTo|reLaunch)\s*\(/g;

describe('do quiz navigation guard', () => {
  it('routes quiz-session exits and result actions through safe navigation helpers', () => {
    const source = readFileSync(resolve(ROOT, DO_QUIZ_FILE), 'utf8');
    const offenders = source.match(DIRECT_ROUTE_CALL) || [];

    expect(offenders).toEqual([]);
    expect(source).toContain('safeNavigateTo');
    expect(source).toContain('safeNavigateBack');
    expect(source).toContain('safeRedirectTo');
  });
});
