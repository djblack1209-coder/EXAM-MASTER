import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const practiceSource = readFileSync(resolve(process.cwd(), 'src/pages/practice/index.vue'), 'utf8');

describe('practice public release guard', () => {
  it('shows a deliberate release-pending state when no verified public bank is published', () => {
    expect(practiceSource).toContain('hasPublishedBanks');
    expect(practiceSource).toContain('PUBLIC RELEASE GUARD');
    expect(practiceSource).toContain('官方真题题库暂未公开');
    expect(practiceSource).toContain('题源证据、答案 hash、解析校验全部通过后');
    expect(practiceSource).toContain('bankAvailabilityText');
  });

  it('keeps the knowledge map available from empty tracks instead of exposing a dead end', () => {
    expect(practiceSource).toContain('selectedTrackStats');
    expect(practiceSource).toContain('empty-track-stats');
    expect(practiceSource).toContain('查看知识地图');
    expect(practiceSource).toContain('@tap="selectMode(\'knowledge_graph\')"');
    expect(practiceSource).toContain('待入库年份');
  });
});
