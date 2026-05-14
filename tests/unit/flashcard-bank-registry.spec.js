import { describe, expect, it } from 'vitest';
import {
  buildPublicCourseCoverage,
  getAvailableBanks,
  getPracticeNavigationTree,
  loadBank
} from '@/config/bank-registry.js';

describe('published flashcard bank registry', () => {
  it('publishes at least one usable bank for the real practice flow', async () => {
    const banks = getAvailableBanks();

    expect(banks.map((bank) => bank.id)).toEqual(expect.arrayContaining(['politics-2025', 'politics-2024']));
    expect(banks.map((bank) => bank.id)).not.toEqual(
      expect.arrayContaining(['english-2025', 'math-2025', 'english1-2025', 'english1-2010'])
    );
    const bank = await loadBank('politics-2025');
    expect(bank.cards.length).toBeGreaterThan(0);
    expect(bank.cards[0]).toEqual(
      expect.objectContaining({
        question: expect.any(String),
        answer: expect.any(String)
      })
    );
    await expect(loadBank('english-2025')).rejects.toThrow('题库不存在或暂不可用');
    await expect(loadBank('english1-2025')).rejects.toThrow('题库不存在或暂不可用');
    await expect(loadBank('math-2025')).rejects.toThrow('题库不存在或暂不可用');
  });

  it('builds public-course navigation tree without exposing disabled banks', () => {
    const tree = getPracticeNavigationTree({ tracks: ['politics', 'english1'] });
    const politics = tree.find((item) => item.id === 'politics');
    const english = tree.find((item) => item.id === 'english');

    expect(politics.tracks[0].banks.some((bank) => bank.id === 'politics-2025')).toBe(true);
    expect(politics.tracks[0].banks.some((bank) => bank.id === 'politics-2024')).toBe(true);
    expect(politics.tracks[0].pendingBanks.some((bank) => bank.year === '2025')).toBe(false);
    expect(politics.tracks[0].pendingBanks.some((bank) => bank.year === '2024')).toBe(false);
    expect(politics.tracks[0].coverage.publishedYears).toEqual([2024, 2025]);
    expect(politics.tracks[0].pendingBanks.map((bank) => Number(bank.year))).toEqual([2023, 2022, 2021, 2020]);
    expect(politics.tracks[0].coverage.pendingYears).toEqual([]);
    expect(politics.tracks[0].coverage.groupSourceRequired).toBe(false);
    expect(english.tracks[0].banks).toEqual([]);
    expect(english.tracks[0].pendingBanks.some((bank) => bank.id === 'english1-2025')).toBe(true);
    expect(english.tracks[0].pendingBanks.some((bank) => bank.id === 'english1-2025-source')).toBe(false);
    expect(english.tracks[0].pendingBanks.some((bank) => bank.id === 'english-2025')).toBe(false);
    const math = getPracticeNavigationTree({ tracks: ['math1', 'math2', 'math3'] }).find((item) => item.id === 'math');
    expect(math.tracks.map((track) => track.pendingBanks[0]?.id)).toEqual([
      'math1-2025',
      'math2-2025',
      'math3-2025'
    ]);
    expect(math.tracks.flatMap((track) => track.pendingBanks.map((bank) => bank.id))).not.toContain('math-2025');
    expect(english.tracks[0].modes.map((mode) => mode.id)).toEqual(['past_exam', 'timed_sprint', 'weakness']);
    expect(english.tracks[0].modes.map((mode) => mode.id)).not.toContain('knowledge_graph');
  });

  it('builds a public-course year coverage matrix from published and pending banks', () => {
    const coverage = buildPublicCourseCoverage({ minYear: 2024, maxYear: 2026 });

    expect(coverage.summary.trackCount).toBe(6);
    expect(coverage.summary.requiredSlots).toBe(18);
    expect(coverage.summary.groupSourceRequired).toBe(false);

    const politics = coverage.tracks.find((item) => item.track === 'politics');
    expect(politics.publishedYears).toEqual([2024, 2025]);
    expect(politics.pendingYears).toEqual([]);
    expect(politics.missingYears).toEqual([2026]);
    expect(politics.coverageRate).toBe(0.6667);
    expect(politics.releaseState).toBe('partial');

    const english2 = coverage.tracks.find((item) => item.track === 'english2');
    expect(english2.publishedYears).toEqual([]);
    expect(english2.pendingYears).toEqual([2025]);
    expect(english2.missingYears).toEqual([2024, 2026]);
    expect(english2.releaseState).toBe('empty');
  });
});
