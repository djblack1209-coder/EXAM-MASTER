import { describe, expect, it } from 'vitest';
import {
  buildPublicCourseCoverage,
  getAvailableBanks,
  getPracticeNavigationTree,
  loadBank
} from '@/config/bank-registry.js';

describe('published flashcard bank registry', () => {
  it('does not publish banks while answer evidence is incomplete', async () => {
    const banks = getAvailableBanks();

    expect(banks).toEqual([]);
    await expect(loadBank('politics-2024')).rejects.toThrow('题库不存在或未发布');
  });

  it('builds public-course navigation tree without exposing disabled banks', () => {
    const tree = getPracticeNavigationTree({ tracks: ['politics', 'english1'] });
    const politics = tree.find((item) => item.id === 'politics');
    const english = tree.find((item) => item.id === 'english');

    expect(politics.tracks[0].banks.some((bank) => bank.id === 'politics-2025')).toBe(false);
    expect(politics.tracks[0].pendingBanks.some((bank) => bank.id === 'politics-2025')).toBe(true);
    expect(politics.tracks[0].banks.some((bank) => bank.id === 'politics-2024')).toBe(false);
    expect(politics.tracks[0].pendingBanks.some((bank) => bank.id === 'politics-2024')).toBe(true);
    expect(politics.tracks[0].coverage.publishedYears).toEqual([]);
    expect(politics.tracks[0].coverage.pendingYears).toEqual([2024, 2025]);
    expect(politics.tracks[0].coverage.groupSourceRequired).toBe(false);
    expect(english.tracks[0].modes.map((mode) => mode.id)).toContain('knowledge_graph');
    expect(english.tracks[0].modes.find((mode) => mode.id === 'knowledge_graph')?.label).toBe('知识地图');
  });

  it('builds a public-course year coverage matrix from published and pending banks', () => {
    const coverage = buildPublicCourseCoverage({ minYear: 2024, maxYear: 2026 });

    expect(coverage.summary.trackCount).toBe(6);
    expect(coverage.summary.requiredSlots).toBe(18);
    expect(coverage.summary.groupSourceRequired).toBe(false);

    const politics = coverage.tracks.find((item) => item.track === 'politics');
    expect(politics.publishedYears).toEqual([]);
    expect(politics.pendingYears).toEqual([2024, 2025]);
    expect(politics.missingYears).toEqual([2026]);
    expect(politics.coverageRate).toBe(0);
    expect(politics.releaseState).toBe('empty');

    const english2 = coverage.tracks.find((item) => item.track === 'english2');
    expect(english2.publishedYears).toEqual([]);
    expect(english2.missingYears).toEqual([2024, 2025, 2026]);
    expect(english2.releaseState).toBe('empty');
  });
});
