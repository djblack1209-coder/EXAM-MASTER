import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const practiceSource = readFileSync(resolve(process.cwd(), 'src/pages/practice/index.vue'), 'utf8');

describe('practice public release guard', () => {
  it('shows a quiet user-facing empty state when no public bank is available', () => {
    expect(practiceSource).toContain('hasPublishedBanks');
    expect(practiceSource).toContain('暂无可练真题');
    expect(practiceSource).toContain('可以先体验示例题，或查看完整知识体系。');
    expect(practiceSource).toContain('体验示例题');
    expect(practiceSource).toContain('看知识图谱');
    expect(practiceSource).toContain('bankAvailabilityText');
    expect(practiceSource).not.toContain('PUBLIC RELEASE GUARD');
    expect(practiceSource).not.toContain('题源证据');
    expect(practiceSource).not.toContain('答案 hash');
    expect(practiceSource).not.toContain('解析校验');
  });

  it('keeps the knowledge map available from empty tracks instead of exposing a dead end', () => {
    expect(practiceSource).toContain('empty-track-card');
    expect(practiceSource).toContain('emptyTrackDesc');
    expect(practiceSource).toContain('查看知识地图');
    expect(practiceSource).toContain('@tap="selectMode(\'knowledge_graph\')"');
    expect(practiceSource).not.toContain('待入库年份');
  });
});
