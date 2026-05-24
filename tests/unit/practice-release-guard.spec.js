import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const practiceSource = readFileSync(resolve(process.cwd(), 'src/pages/practice/index.vue'), 'utf8');

describe('practice page user-facing content', () => {
  it('keeps the practice entry focused on user actions instead of backend release details', () => {
    expect(practiceSource).toContain('查看真题目录');
    expect(practiceSource).toContain('bankAvailabilityText');
    expect(practiceSource).toContain('公共课训练');
    expect(practiceSource).toContain('trainingCoverageText');
    expect(practiceSource).not.toContain('题库发布校验');
    expect(practiceSource).not.toContain('官方真题题库暂未公开');
    expect(practiceSource).not.toContain('答案 hash');
    expect(practiceSource).not.toContain('hasPublishedBanks');
  });

  it('routes empty tracks to the year-based paper directory while graph mode is down', () => {
    expect(practiceSource).toContain('查看真题目录');
    expect(practiceSource).toContain('该方向暂无可练题库');
    expect(practiceSource).toContain('按年份整理为整卷练习');
    expect(practiceSource).not.toContain('knowledge_graph');
    expect(practiceSource).not.toContain('知识地图');
  });
});
