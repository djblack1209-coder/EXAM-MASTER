import { describe, expect, it } from 'vitest';

import {
  buildMobileModuleInventory,
  normalizePagePath
} from '../../scripts/build/mobile-module-inventory.mjs';

describe('mobile module inventory', () => {
  it('normalizes page files and route declarations consistently', () => {
    expect(normalizePagePath('src/pages/practice-sub/do-quiz.vue')).toBe('pages/practice-sub/do-quiz');
    expect(normalizePagePath('pages/login/index')).toBe('pages/login/index');
  });

  it('classifies exposed, hidden, and historical mobile modules', () => {
    const inventory = buildMobileModuleInventory({
      pagesConfig: {
        pages: [{ path: 'pages/index/index' }, { path: 'pages/practice/index' }],
        subPackages: [{ root: 'pages/practice-sub', pages: [{ path: 'do-quiz' }] }]
      },
      pageFiles: [
        'src/pages/index/index.vue',
        'src/pages/practice/index.vue',
        'src/pages/practice-sub/do-quiz.vue',
        'src/pages/resource/index.vue',
        'src/pages/plan/index.vue',
        'src/pages/study-detail/index.vue',
        'src/pages/common/404.vue'
      ]
    });

    expect(inventory.exposedRoutes).toEqual([
      'pages/index/index',
      'pages/practice/index',
      'pages/practice-sub/do-quiz'
    ]);
    expect(inventory.hiddenPageFiles).toContain('pages/resource/index');
    expect(inventory.historicalModules.resource.pages).toEqual(['pages/resource/index']);
    expect(inventory.historicalModules.plan.pages).toEqual(['pages/plan/index']);
    expect(inventory.historicalModules.studyDetail.pages).toEqual(['pages/study-detail/index']);
    expect(inventory.orphanedCommonPages).toEqual(['pages/common/404']);
  });

  it('excludes colocated page components from page route inventory', () => {
    const inventory = buildMobileModuleInventory({
      pagesConfig: {
        pages: [{ path: 'pages/mistake/index' }]
      },
      pageFiles: [
        'src/pages/mistake/index.vue',
        'src/pages/mistake/MistakeCard.vue',
        'src/pages/practice-sub/components/answer-sheet/answer-sheet.vue'
      ]
    });

    expect(inventory.hiddenPageFiles).toEqual([]);
  });
});
