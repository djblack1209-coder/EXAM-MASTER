import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(resolve(process.cwd(), 'src/pages/practice/index.vue'), 'utf8');

describe('practice readiness card guard', () => {
  it('surfaces public-course bank readiness in user-facing language', () => {
    expect(source).toContain('题库就绪度');
    expect(source).toContain('readinessTitle');
    expect(source).toContain('readinessPercent');
    expect(source).toContain('readinessSummary.publishedSlots');
    expect(source).toContain('readinessSummary.pendingSlots');
    expect(source).toContain('readinessSummary.missingSlots');
    expect(source).toContain('正式</text>');
    expect(source).toContain('整理中</text>');
    expect(source).toContain('待入库</text>');
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

  it('keeps readiness card styled in the shared financial shell system', () => {
    expect(source).toContain('class="readiness-card"');
    expect(source).toContain('.readiness-progress-fill');
    expect(source).toContain('linear-gradient(90deg, #9fe870 0%, #75ddff 100%)');
    expect(source).toContain('.dark-mode .readiness-card');
    expect(source).toContain('.dark-mode .readiness-track-line');
  });
});
