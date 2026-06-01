import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(process.cwd());
const pagesJson = JSON.parse(readFileSync(resolve(ROOT, 'src/pages.json'), 'utf8'));

const DEFERRED_ROUTE_PATTERNS = [
  /professional-index/i,
  /\/?pages\/school/i,
  /\/?pages\/resource/i,
  /pk-battle/i,
  /\/?pk(?:\/|$|-)/i,
  /rank(?:ing|ings)?(?:\/|$|-)/i,
  /leaderboard/i,
  /invite/i,
  /friend/i,
  /social/i,
  /poster/i,
  /ai-tutor/i,
  /tutor/i
];

const CORE_PUBLIC_PAGE_FILES = [
  'src/pages/index/index.vue',
  'src/pages/practice/index.vue',
  'src/pages/profile/index.vue',
  'src/pages/settings/index.vue',
  'src/pages/practice-sub/do-quiz.vue',
  'src/pages/practice-sub/components/quiz-result/quiz-result.vue'
];

const DEFERRED_PUBLIC_COPY = [
  '择校',
  '目标院校',
  '报考院校',
  '专业课索引',
  '学校库',
  '排行榜',
  'PK',
  '邀请好友',
  '好友',
  '海报'
];

function collectRegisteredRoutes() {
  const mainRoutes = (pagesJson.pages || []).map((page) => page.path);
  const subRoutes = (pagesJson.subPackages || []).flatMap((pkg) =>
    (pkg.pages || []).map((page) => `${pkg.root}/${page.path}`)
  );
  const tabRoutes = ((pagesJson.tabBar && pagesJson.tabBar.list) || []).map((item) => item.pagePath);

  return [...mainRoutes, ...subRoutes, ...tabRoutes];
}

describe('mini program lightweight scope guard', () => {
  it('does not register deferred heavy-product routes in the mini program shell', () => {
    const registeredRoutes = collectRegisteredRoutes();
    const offenders = registeredRoutes.filter((route) =>
      DEFERRED_ROUTE_PATTERNS.some((pattern) => pattern.test(route))
    );

    expect(offenders).toEqual([]);
  });

  it('keeps core public pages free of deferred feature copy', () => {
    const offenders = [];

    for (const file of CORE_PUBLIC_PAGE_FILES) {
      const source = readFileSync(resolve(ROOT, file), 'utf8');

      for (const term of DEFERRED_PUBLIC_COPY) {
        if (source.includes(term)) {
          offenders.push(`${file} -> ${term}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });
});
