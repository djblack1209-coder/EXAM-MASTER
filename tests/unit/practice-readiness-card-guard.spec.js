import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(resolve(process.cwd(), 'src/pages/practice/index.vue'), 'utf8');

describe('practice readiness card guard', () => {
  it('surfaces public-course bank readiness in user-facing language', () => {
    for (const field of [
      'readinessTitle',
      'readinessPercent',
      'readinessSummary.publishedSlots',
      'readinessSummary.pendingSlots',
      'readinessSummary.missingSlots'
    ])
      expect(source).toContain(field);
    expect(source).toContain('<BaseStat');
    expect(source).toContain(
      'readinessSummary.publishedSlots + readinessSummary.pendingSlots + readinessSummary.missingSlots'
    );
  });

  it('uses the neutral coverage contract instead of backend release wording', () => {
    expect(source).toContain('buildPublicCourseCoverage');
    expect(source).toContain('publicCourseCoverage()');
    expect(source).toContain('selectedTrackReadinessText');
    expect(source).toContain('coverageRate');
    expect(source).not.toContain('题库发布校验');
    expect(source).not.toContain('releaseReadiness');
    expect(source).not.toContain('答案 hash');
    expect(source).not.toContain('SourceEvidence');
  });

  it('keeps readiness card styled in the shared Yozi material system', () => {
    expect(source).toContain('class="readiness-card"');
    expect(source).toContain('@/styles/yozi-pages.scss');
    const layout = readFileSync(resolve(process.cwd(), 'src/styles/yozi-pages.scss'), 'utf8');
    expect(layout).toContain('var(--paper)');
    expect(layout).toContain('var(--ink)');
  });
});
