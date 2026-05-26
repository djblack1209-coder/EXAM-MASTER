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

    expect(banks.map((bank) => bank.id)).toEqual(
      expect.arrayContaining([
        'politics-2025',
        'politics-2024',
        'english1-2025',
        'english1-2005',
        'english1-2008',
        'english1-2009',
        'english1-2010',
        'english1-2011',
        'english1-2012'
      ])
    );
    expect(banks.map((bank) => bank.id)).not.toEqual(expect.arrayContaining(['english-2025', 'math-2025']));
    const bank = await loadBank('politics-2025');
    expect(bank.cards.length).toBeGreaterThan(0);
    expect(bank.cards[0]).toEqual(
      expect.objectContaining({
        question: expect.any(String),
        answer: expect.any(String)
      })
    );
    await expect(loadBank('english-2025')).rejects.toThrow('题库不存在或暂不可用');
    const englishDraft = await loadBank('english1-2025');
    expect(englishDraft.cards.length).toBeGreaterThan(0);
    const english2005 = await loadBank('english1-2005');
    expect(english2005.cards.length).toBeGreaterThan(0);
    expect(english2005.cards.find((card) => card.number === 21).passage).toEqual(expect.any(String));
    const english2006 = await loadBank('english1-2006');
    expect(english2006.cards.length).toBeGreaterThan(0);
    expect(english2006.cards.find((card) => card.number === 41).options).toHaveLength(7);
    expect(english2006.cards.find((card) => card.number === 41).passage).toEqual(expect.any(String));
    const english2010 = await loadBank('english1-2010');
    expect(english2010.cards).toHaveLength(52);
    expect(english2010.cards.find((card) => card.number === 46).targetSegment).toEqual(expect.any(String));
    const english2011 = await loadBank('english1-2011');
    expect(english2011.cards).toHaveLength(52);
    expect(english2011.cards.find((card) => card.number === 41).options).toHaveLength(7);
    expect(english2011.cards.find((card) => card.number === 46).targetSegment).toEqual(expect.any(String));
    const english2012 = await loadBank('english1-2012');
    expect(english2012.cards).toHaveLength(52);
    expect(english2012.cards.find((card) => card.number === 21).answer).toBe('D');
    await expect(loadBank('math-2025')).rejects.toThrow('题库不存在或暂不可用');
  });

  it('builds public-course navigation tree without exposing disabled banks', () => {
    const tree = getPracticeNavigationTree({ tracks: ['politics', 'english1'] });
    const politics = tree.find((item) => item.id === 'politics');
    const english = tree.find((item) => item.id === 'english');

    expect(politics.tracks[0].banks.some((bank) => bank.id === 'politics-2025')).toBe(true);
    expect(politics.tracks[0].banks.some((bank) => bank.id === 'politics-2024')).toBe(true);
    expect(politics.tracks[0].banks.find((bank) => bank.id === 'politics-2025').usageScope).toBe('self_study_draft');
    expect(politics.tracks[0].banks.find((bank) => bank.id === 'politics-2024').releaseLabel).toBe('自用草稿');
    expect(politics.tracks[0].pendingBanks.some((bank) => bank.year === '2025')).toBe(false);
    expect(politics.tracks[0].pendingBanks.some((bank) => bank.year === '2024')).toBe(false);
    expect(politics.tracks[0].coverage.publishedYears).toEqual([]);
    expect(politics.tracks[0].coverage.pendingYears).toEqual([2024, 2025]);
    expect(politics.tracks[0].pendingBanks.map((bank) => Number(bank.year))).toEqual([2023, 2022, 2021, 2020]);
    expect(politics.tracks[0].coverage.groupSourceRequired).toBe(false);
    expect(politics.tracks[0].yearSlots).toHaveLength(22);
    expect(politics.tracks[0].slotSummary).toEqual({ total: 22, ready: 0, draft: 2, organizing: 0, missing: 20 });
    expect(politics.tracks[0].yearSlots.find((slot) => slot.year === '2025')).toMatchObject({
      bankId: 'politics-2025',
      status: 'draft',
      statusLabel: '自练',
      clickable: true
    });
    expect(politics.tracks[0].yearSlots.find((slot) => slot.year === '2026')).toMatchObject({
      status: 'missing',
      statusLabel: '待入库',
      clickable: false
    });
    expect(english.tracks[0].banks.some((bank) => bank.id === 'english1-2025')).toBe(true);
    expect(english.tracks[0].banks.find((bank) => bank.id === 'english1-2025').usageScope).toBe('self_study_draft');
    expect(english.tracks[0].banks.some((bank) => bank.id === 'english1-2005')).toBe(true);
    expect(english.tracks[0].banks.find((bank) => bank.id === 'english1-2005').releaseLabel).toBe('正式题库');
    expect(english.tracks[0].banks.some((bank) => bank.id === 'english1-2006')).toBe(true);
    expect(english.tracks[0].banks.some((bank) => bank.id === 'english1-2010')).toBe(true);
    expect(english.tracks[0].banks.some((bank) => bank.id === 'english1-2011')).toBe(true);
    expect(english.tracks[0].banks.some((bank) => bank.id === 'english1-2012')).toBe(true);
    expect(english.tracks[0].pendingBanks.some((bank) => bank.id === 'english1-2025')).toBe(false);
    expect(english.tracks[0].pendingBanks.some((bank) => bank.id === 'english1-2025-source')).toBe(false);
    expect(english.tracks[0].pendingBanks.some((bank) => bank.id === 'english-2025')).toBe(false);
    expect(english.tracks[0].yearSlots).toHaveLength(22);
    expect(english.tracks[0].slotSummary).toEqual({ total: 22, ready: 8, draft: 1, organizing: 0, missing: 13 });
    expect(english.tracks[0].yearSlots.find((slot) => slot.year === '2012')).toMatchObject({
      bankId: 'english1-2012',
      status: 'ready',
      statusLabel: '正式',
      clickable: true
    });
    expect(english.tracks[0].yearSlots.find((slot) => slot.year === '2026')).toMatchObject({
      status: 'missing',
      actionLabel: '待入库',
      clickable: false
    });
    const math = getPracticeNavigationTree({ tracks: ['math1', 'math2', 'math3'] }).find((item) => item.id === 'math');
    expect(math.tracks.map((track) => track.pendingBanks[0]?.id)).toEqual(['math1-2025', 'math2-2025', 'math3-2025']);
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
    expect(politics.publishedYears).toEqual([]);
    expect(politics.pendingYears).toEqual([2024, 2025]);
    expect(politics.missingYears).toEqual([2026]);
    expect(politics.coverageRate).toBe(0);
    expect(politics.releaseState).toBe('empty');

    const english2 = coverage.tracks.find((item) => item.track === 'english2');
    expect(english2.publishedYears).toEqual([]);
    expect(english2.pendingYears).toEqual([2025]);
    expect(english2.missingYears).toEqual([2024, 2026]);
    expect(english2.releaseState).toBe('empty');

    const english1 = coverage.tracks.find((item) => item.track === 'english1');
    expect(english1.publishedYears).toEqual([]);
    expect(english1.pendingYears).toEqual([2025]);
  });

  it('uses the production coverage scope requested for current exam prep by default', () => {
    const coverage = buildPublicCourseCoverage({ tracks: ['english1'] });
    const english1 = coverage.tracks.find((item) => item.track === 'english1');

    expect(english1.requiredYears[0]).toBe(2005);
    expect(english1.requiredYears.at(-1)).toBe(2026);
    expect(coverage.summary.requiredSlots).toBe(22);
  });
});
