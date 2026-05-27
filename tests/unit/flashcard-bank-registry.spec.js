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
        'english1-2005',
        'english1-2008',
        'english1-2009',
        'english1-2010',
        'english1-2011',
        'english1-2012',
        'english1-2013',
        'english1-2014'
      ])
    );
    expect(banks.map((bank) => bank.id)).toEqual(expect.arrayContaining(['english1-2025']));
    expect(banks.map((bank) => bank.id)).toEqual(
      expect.arrayContaining([
        'politics-2025',
        'politics-2024',
        'politics-2014',
        'politics-2012',
        'politics-2011',
        'politics-2009',
        'politics-2010',
        'politics-2008',
        'politics-2007',
        'politics-2006',
        'politics-2005'
      ])
    );
    expect(banks.map((bank) => bank.id)).not.toEqual(expect.arrayContaining(['english-2025', 'math-2025']));
    expect(banks.map((bank) => bank.id)).toEqual(expect.arrayContaining(['english2-2025']));
    const bank = await loadBank('english1-2005');
    expect(bank.cards.length).toBeGreaterThan(0);
    expect(bank.cards[0]).toEqual(
      expect.objectContaining({
        question: expect.any(String),
        answer: expect.any(String)
      })
    );
    await expect(loadBank('english-2025')).rejects.toThrow('题库不存在或暂不可用');
    const politics2025 = await loadBank('politics-2025');
    expect(politics2025.cards).toHaveLength(38);
    expect(politics2025.cards.every((card) => card.answerEvidenceStatus === 'matched')).toBe(true);
    expect(politics2025.cards.find((card) => card.number === 1).answer).toBe('C');
    expect(politics2025.cards.find((card) => card.number === 38).type).toBe('analysis');
    const politics2024 = await loadBank('politics-2024');
    expect(politics2024.cards).toHaveLength(38);
    expect(politics2024.cards.every((card) => card.answerEvidenceStatus === 'matched')).toBe(true);
    expect(politics2024.cards.find((card) => card.number === 1).answer).toBe('A');
    expect(politics2024.cards.find((card) => card.number === 33).answer).toBe('ACD');
    const politics2005 = await loadBank('politics-2005');
    expect(politics2005.cards).toHaveLength(37);
    expect(politics2005.cards.every((card) => card.answerEvidenceStatus === 'matched')).toBe(true);
    expect(politics2005.cards.find((card) => card.number === 1).answer).toBe('B');
    expect(politics2005.cards.find((card) => card.number === 30).answer).toBe('ABCD');
    expect(politics2005.cards.find((card) => card.number === 37).type).toBe('analysis');
    expect(politics2005.cards.find((card) => card.number === 37).answerImages.at(-1).src).toContain(
      'question-bank/politics-2005/paper-page-12.jpg'
    );
    const politics2006 = await loadBank('politics-2006');
    expect(politics2006.cards).toHaveLength(38);
    expect(politics2006.cards.every((card) => card.answerEvidenceStatus === 'matched')).toBe(true);
    expect(politics2006.cards.find((card) => card.number === 1).answer).toBe('C');
    expect(politics2006.cards.find((card) => card.number === 33).answer).toBe('ACD');
    expect(politics2006.cards.find((card) => card.number === 38).type).toBe('analysis');
    expect(politics2006.cards.find((card) => card.number === 38).answerImages.at(-1).src).toContain(
      'question-bank/politics-2006/paper-page-12.jpg'
    );
    const politics2007 = await loadBank('politics-2007');
    expect(politics2007.cards).toHaveLength(38);
    expect(politics2007.cards.every((card) => card.answerEvidenceStatus === 'matched')).toBe(true);
    expect(politics2007.cards.find((card) => card.number === 1).answer).toBe('B');
    expect(politics2007.cards.find((card) => card.number === 33).answer).toBe('ABCD');
    expect(politics2007.cards.find((card) => card.number === 38).type).toBe('analysis');
    expect(politics2007.cards.find((card) => card.number === 38).answerImages.at(-1).src).toContain(
      'question-bank/politics-2007/paper-page-20.jpg'
    );
    const politics2008 = await loadBank('politics-2008');
    expect(politics2008.cards).toHaveLength(38);
    expect(politics2008.cards.every((card) => card.answerEvidenceStatus === 'matched')).toBe(true);
    expect(politics2008.cards.find((card) => card.number === 1).answer).toBe('D');
    expect(politics2008.cards.find((card) => card.number === 33).answer).toBe('ABCD');
    expect(politics2008.cards.find((card) => card.number === 38).type).toBe('analysis');
    expect(politics2008.cards.find((card) => card.number === 38).answerImages.at(-1).src).toContain(
      'question-bank/politics-2008/paper-page-16.jpg'
    );
    const politics2009 = await loadBank('politics-2009');
    expect(politics2009.cards).toHaveLength(38);
    expect(politics2009.cards.every((card) => card.answerEvidenceStatus === 'matched')).toBe(true);
    expect(politics2009.cards.find((card) => card.number === 1).answer).toBe('A');
    expect(politics2009.cards.find((card) => card.number === 33).answer).toBe('BCD');
    expect(politics2009.cards.find((card) => card.number === 38).type).toBe('analysis');
    expect(politics2009.cards.find((card) => card.number === 38).answerImages.at(-1).src).toContain(
      'question-bank/politics-2009/paper-page-11.jpg'
    );
    const politics2010 = await loadBank('politics-2010');
    expect(politics2010.cards).toHaveLength(38);
    expect(politics2010.cards.every((card) => card.answerEvidenceStatus === 'matched')).toBe(true);
    expect(politics2010.cards.find((card) => card.number === 1).answer).toBe('A');
    expect(politics2010.cards.find((card) => card.number === 21).answer).toBe('ABC');
    expect(politics2010.cards.find((card) => card.number === 21).questionImages).toEqual([]);
    expect(politics2010.cards.find((card) => card.number === 31).answer).toBe('BD');
    expect(politics2010.cards.find((card) => card.number === 33).answer).toBe('ABC');
    expect(politics2010.cards.find((card) => card.number === 38).type).toBe('analysis');
    expect(politics2010.cards.find((card) => card.number === 38).answerImages.at(-1).src).toContain(
      'question-bank/politics-2010/answer-page-27.jpg'
    );
    const politics2011 = await loadBank('politics-2011');
    expect(politics2011.cards).toHaveLength(38);
    expect(politics2011.cards.every((card) => card.answerEvidenceStatus === 'matched')).toBe(true);
    expect(politics2011.cards.find((card) => card.number === 1).answer).toBe('C');
    expect(politics2011.cards.find((card) => card.number === 33).answer).toBe('ABCD');
    expect(politics2011.cards.find((card) => card.number === 38).type).toBe('analysis');
    expect(politics2011.cards.find((card) => card.number === 38).answerImages.at(-1).src).toContain(
      'question-bank/politics-2011/answer-page-11.jpg'
    );
    const politics2012 = await loadBank('politics-2012');
    expect(politics2012.cards).toHaveLength(38);
    expect(politics2012.cards.every((card) => card.answerEvidenceStatus === 'matched')).toBe(true);
    expect(politics2012.cards.find((card) => card.number === 1).answer).toBe('A');
    expect(politics2012.cards.find((card) => card.number === 22).answer).toBe('ABD');
    expect(politics2012.cards.find((card) => card.number === 33).answer).toBe('BCD');
    expect(politics2012.cards.find((card) => card.number === 38).type).toBe('analysis');
    expect(politics2012.cards.find((card) => card.number === 38).answerImages.at(-1).src).toContain(
      'question-bank/politics-2012/answer-page-23.jpg'
    );
    const politics2014 = await loadBank('politics-2014');
    expect(politics2014.cards).toHaveLength(38);
    expect(politics2014.cards.every((card) => card.answerEvidenceStatus === 'matched')).toBe(true);
    expect(politics2014.cards.find((card) => card.number === 1).answer).toBe('B');
    expect(politics2014.cards.find((card) => card.number === 17).answer).toBe('BD');
    expect(politics2014.cards.find((card) => card.number === 33).answer).toBe('ACD');
    expect(politics2014.cards.find((card) => card.number === 38).type).toBe('analysis');
    expect(politics2014.cards.find((card) => card.number === 38).answerImages.at(-1).src).toContain(
      'question-bank/politics-2014/answer-page-12.jpg'
    );
    const english2025 = await loadBank('english1-2025');
    expect(english2025.cards).toHaveLength(52);
    expect(english2025.cards.every((card) => card.answerEvidenceStatus === 'matched')).toBe(true);
    expect(english2025.cards.find((card) => card.number === 51).answerEvidence.evidenceRole).toBe(
      'official_writing_prompt'
    );
    const english22025 = await loadBank('english2-2025');
    expect(english22025.cards).toHaveLength(48);
    expect(english22025.cards.every((card) => card.answerEvidenceStatus === 'matched')).toBe(true);
    expect(english22025.cards.find((card) => card.number === 21).passage).toEqual(expect.any(String));
    expect(english22025.cards.find((card) => card.number === 30).answer).toBe('C');
    expect(english22025.cards.find((card) => card.number === 48).answerEvidence.evidenceRole).toBe(
      'official_writing_prompt'
    );
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
    const english2013 = await loadBank('english1-2013');
    expect(english2013.cards).toHaveLength(52);
    expect(english2013.cards.every((card) => card.answerEvidenceStatus === 'matched')).toBe(true);
    expect(english2013.cards.find((card) => card.number === 41).options).toHaveLength(7);
    expect(english2013.cards.find((card) => card.number === 46).targetSegment).toContain('photographs');
    expect(english2013.cards.find((card) => card.number === 52).answerEvidence.evidenceRole).toBe(
      'official_writing_prompt'
    );
    const english2014 = await loadBank('english1-2014');
    expect(english2014.cards).toHaveLength(52);
    expect(english2014.cards.every((card) => card.answerEvidenceStatus === 'matched')).toBe(true);
    expect(english2014.cards.find((card) => card.number === 31).answer).toBe('D');
    expect(english2014.cards.find((card) => card.number === 31).passage).toContain('Fundamental Physics Prize');
    expect(english2014.cards.find((card) => card.number === 41).options).toHaveLength(7);
    expect(english2014.cards.find((card) => card.number === 50).targetSegment).toContain('suffering is inevitable');
    expect(english2014.cards.find((card) => card.number === 52).answerEvidence.evidenceRole).toBe(
      'official_writing_prompt'
    );
    await expect(loadBank('math-2025')).rejects.toThrow('题库不存在或暂不可用');
    const math12025 = await loadBank('math1-2025');
    expect(math12025.cards).toHaveLength(22);
    expect(math12025.cards.every((card) => card.answerEvidenceStatus === 'matched')).toBe(true);
    expect(math12025.cards.find((card) => card.number === 1).answer).toBe('B');
    expect(math12025.cards.find((card) => card.number === 17).questionImages[0].src).toContain(
      'question-bank/math1-2025/paper-page-04.jpg'
    );
    expect(math12025.cards.find((card) => card.number === 22).answerImages.at(-1).src).toContain(
      'question-bank/math1-2025/answer-page-11.jpg'
    );
    const math22025 = await loadBank('math2-2025');
    expect(math22025.cards).toHaveLength(22);
    expect(math22025.cards.every((card) => card.answerEvidenceStatus === 'matched')).toBe(true);
    expect(math22025.cards.find((card) => card.number === 1).answer).toBe('A');
    expect(math22025.cards.find((card) => card.number === 22).answer).toContain('a = 4');
    expect(math22025.cards.find((card) => card.number === 22).answerImages.at(-1).src).toContain(
      'question-bank/math2-2025/answer-page-14.jpg'
    );
  });

  it('builds public-course navigation tree without exposing disabled banks', () => {
    const tree = getPracticeNavigationTree({ tracks: ['politics', 'english1'] });
    const politics = tree.find((item) => item.id === 'politics');
    const english = tree.find((item) => item.id === 'english');

    expect(politics.tracks[0].banks.map((bank) => bank.id)).toEqual([
      'politics-2025',
      'politics-2024',
      'politics-2014',
      'politics-2012',
      'politics-2011',
      'politics-2010',
      'politics-2009',
      'politics-2008',
      'politics-2007',
      'politics-2006',
      'politics-2005'
    ]);
    expect(politics.tracks[0].pendingBanks.some((bank) => bank.year === '2025')).toBe(false);
    expect(politics.tracks[0].pendingBanks.some((bank) => bank.year === '2024')).toBe(false);
    expect(politics.tracks[0].coverage.publishedYears).toEqual([
      2005, 2006, 2007, 2008, 2009, 2010, 2011, 2012, 2014, 2024, 2025
    ]);
    expect(politics.tracks[0].coverage.pendingYears).toEqual([]);
    expect(politics.tracks[0].pendingBanks.map((bank) => Number(bank.year))).toEqual([2023, 2022, 2021, 2020]);
    expect(politics.tracks[0].coverage.groupSourceRequired).toBe(false);
    expect(politics.tracks[0].yearSlots).toHaveLength(22);
    expect(politics.tracks[0].slotSummary).toEqual({ total: 22, ready: 11, organizing: 0, missing: 11 });
    expect(politics.tracks[0].yearSlots.find((slot) => slot.year === '2025')).toMatchObject({
      bankId: 'politics-2025',
      status: 'ready',
      statusLabel: '正式',
      clickable: true
    });
    expect(politics.tracks[0].yearSlots.find((slot) => slot.year === '2024')).toMatchObject({
      bankId: 'politics-2024',
      status: 'ready',
      statusLabel: '正式',
      clickable: true
    });
    expect(politics.tracks[0].yearSlots.find((slot) => slot.year === '2005')).toMatchObject({
      bankId: 'politics-2005',
      status: 'ready',
      statusLabel: '正式',
      clickable: true
    });
    expect(politics.tracks[0].yearSlots.find((slot) => slot.year === '2006')).toMatchObject({
      bankId: 'politics-2006',
      status: 'ready',
      statusLabel: '正式',
      clickable: true
    });
    expect(politics.tracks[0].yearSlots.find((slot) => slot.year === '2007')).toMatchObject({
      bankId: 'politics-2007',
      status: 'ready',
      statusLabel: '正式',
      clickable: true
    });
    expect(politics.tracks[0].yearSlots.find((slot) => slot.year === '2008')).toMatchObject({
      bankId: 'politics-2008',
      status: 'ready',
      statusLabel: '正式',
      clickable: true
    });
    expect(politics.tracks[0].yearSlots.find((slot) => slot.year === '2009')).toMatchObject({
      bankId: 'politics-2009',
      status: 'ready',
      statusLabel: '正式',
      clickable: true
    });
    expect(politics.tracks[0].yearSlots.find((slot) => slot.year === '2010')).toMatchObject({
      bankId: 'politics-2010',
      status: 'ready',
      statusLabel: '正式',
      clickable: true
    });
    expect(politics.tracks[0].yearSlots.find((slot) => slot.year === '2011')).toMatchObject({
      bankId: 'politics-2011',
      status: 'ready',
      statusLabel: '正式',
      clickable: true
    });
    expect(politics.tracks[0].yearSlots.find((slot) => slot.year === '2012')).toMatchObject({
      bankId: 'politics-2012',
      status: 'ready',
      statusLabel: '正式',
      clickable: true
    });
    expect(politics.tracks[0].yearSlots.find((slot) => slot.year === '2014')).toMatchObject({
      bankId: 'politics-2014',
      status: 'ready',
      statusLabel: '正式',
      clickable: true
    });
    expect(politics.tracks[0].yearSlots.find((slot) => slot.year === '2026')).toMatchObject({
      status: 'missing',
      statusLabel: '待入库',
      clickable: false
    });
    expect(english.tracks[0].banks.some((bank) => bank.id === 'english1-2025')).toBe(true);
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
    expect(english.tracks[0].slotSummary).toEqual({ total: 22, ready: 11, organizing: 0, missing: 11 });
    expect(english.tracks[0].yearSlots.find((slot) => slot.year === '2012')).toMatchObject({
      bankId: 'english1-2012',
      status: 'ready',
      statusLabel: '正式',
      clickable: true
    });
    expect(english.tracks[0].yearSlots.find((slot) => slot.year === '2013')).toMatchObject({
      bankId: 'english1-2013',
      status: 'ready',
      statusLabel: '正式',
      clickable: true
    });
    expect(english.tracks[0].yearSlots.find((slot) => slot.year === '2014')).toMatchObject({
      bankId: 'english1-2014',
      status: 'ready',
      statusLabel: '正式',
      clickable: true
    });
    expect(english.tracks[0].yearSlots.find((slot) => slot.year === '2025')).toMatchObject({
      bankId: 'english1-2025',
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
    expect(math.tracks.map((track) => track.pendingBanks[0]?.id)).toEqual([
      'math1-2024-pending-source',
      'math2-2024-pending-source',
      'math3-2025'
    ]);
    expect(math.tracks[0].banks.some((bank) => bank.id === 'math1-2025')).toBe(true);
    expect(math.tracks[1].banks.some((bank) => bank.id === 'math2-2025')).toBe(true);
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
    expect(english2.publishedYears).toEqual([2025]);
    expect(english2.pendingYears).toEqual([]);
    expect(english2.missingYears).toEqual([2024, 2026]);
    expect(english2.releaseState).toBe('partial');

    const english1 = coverage.tracks.find((item) => item.track === 'english1');
    expect(english1.publishedYears).toEqual([2025]);
    expect(english1.pendingYears).toEqual([]);

    const math1 = coverage.tracks.find((item) => item.track === 'math1');
    expect(math1.publishedYears).toEqual([2025]);
    expect(math1.pendingYears).toEqual([]);
    expect(math1.missingYears).toEqual([2024, 2026]);
    expect(math1.releaseState).toBe('partial');

    const math2 = coverage.tracks.find((item) => item.track === 'math2');
    expect(math2.publishedYears).toEqual([2025]);
    expect(math2.pendingYears).toEqual([]);
    expect(math2.missingYears).toEqual([2024, 2026]);
    expect(math2.releaseState).toBe('partial');
  });

  it('uses the production coverage scope requested for current exam prep by default', () => {
    const coverage = buildPublicCourseCoverage({ tracks: ['english1'] });
    const english1 = coverage.tracks.find((item) => item.track === 'english1');

    expect(english1.requiredYears[0]).toBe(2005);
    expect(english1.requiredYears.at(-1)).toBe(2026);
    expect(coverage.summary.requiredSlots).toBe(22);
  });
});
