import { describe, expect, it } from 'vitest';
import {
  buildPublicCourseCoverage,
  getAvailableBanks,
  getPracticeNavigationTree
} from '@/config/bank-registry.js';
import { COMPRESSED_BANK_DATA_BY_ID } from '@/pages/practice-sub/bank-data-table.js';
import { loadBankData } from '@/pages/practice-sub/bank-data-loader.js';

describe('published flashcard bank registry', () => {
  it('backs every published bank with generated compressed data in the practice subpackage', () => {
    const publishedIds = getAvailableBanks().map((bank) => bank.id).sort();

    expect(Object.keys(COMPRESSED_BANK_DATA_BY_ID).sort()).toEqual(publishedIds);
    expect(COMPRESSED_BANK_DATA_BY_ID['english1-2000']).toBeUndefined();
    expect(COMPRESSED_BANK_DATA_BY_ID['english1-2001']).toBeUndefined();
  });

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
        'english1-2014',
        'english1-2016',
        'english1-2017'
      ])
    );
    expect(banks.map((bank) => bank.id)).toEqual(expect.arrayContaining(['english1-2025']));
    expect(banks.map((bank) => bank.id)).toEqual(
      expect.arrayContaining([
        'politics-2025',
        'politics-2024',
        'politics-2022',
        'politics-2021',
        'politics-2020',
        'politics-2019',
        'politics-2018',
        'politics-2017',
        'politics-2016',
        'politics-2015',
        'politics-2014',
        'politics-2013',
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
    const bank = await loadBankData('english1-2005');
    expect(bank.cards.length).toBeGreaterThan(0);
    expect(bank.cards[0]).toEqual(
      expect.objectContaining({
        question: expect.any(String),
        answer: expect.any(String)
      })
    );
    await expect(loadBankData('english-2025')).rejects.toThrow('题库不存在或暂不可用');
    const politics2025 = await loadBankData('politics-2025');
    expect(politics2025.cards).toHaveLength(38);
    expect(politics2025.cards.every((card) => card.answerEvidenceStatus === 'matched')).toBe(true);
    expect(politics2025.cards.find((card) => card.number === 1).answer).toBe('C');
    expect(politics2025.cards.find((card) => card.number === 38).type).toBe('analysis');
    const politics2024 = await loadBankData('politics-2024');
    expect(politics2024.cards).toHaveLength(38);
    expect(politics2024.cards.every((card) => card.answerEvidenceStatus === 'matched')).toBe(true);
    expect(politics2024.cards.find((card) => card.number === 1).answer).toBe('A');
    expect(politics2024.cards.find((card) => card.number === 33).answer).toBe('ACD');
    const politics2005 = await loadBankData('politics-2005');
    expect(politics2005.cards).toHaveLength(37);
    expect(politics2005.cards.every((card) => card.answerEvidenceStatus === 'matched')).toBe(true);
    expect(politics2005.cards.find((card) => card.number === 1).answer).toBe('B');
    expect(politics2005.cards.find((card) => card.number === 30).answer).toBe('ABCD');
    expect(politics2005.cards.find((card) => card.number === 37).type).toBe('analysis');
    expect(politics2005.cards.find((card) => card.number === 37).answerImages.at(-1).src).toContain(
      'question-bank/politics-2005/paper-page-12.jpg'
    );
    const politics2006 = await loadBankData('politics-2006');
    expect(politics2006.cards).toHaveLength(38);
    expect(politics2006.cards.every((card) => card.answerEvidenceStatus === 'matched')).toBe(true);
    expect(politics2006.cards.find((card) => card.number === 1).answer).toBe('C');
    expect(politics2006.cards.find((card) => card.number === 33).answer).toBe('ACD');
    expect(politics2006.cards.find((card) => card.number === 38).type).toBe('analysis');
    expect(politics2006.cards.find((card) => card.number === 38).answerImages.at(-1).src).toContain(
      'question-bank/politics-2006/paper-page-12.jpg'
    );
    const politics2007 = await loadBankData('politics-2007');
    expect(politics2007.cards).toHaveLength(38);
    expect(politics2007.cards.every((card) => card.answerEvidenceStatus === 'matched')).toBe(true);
    expect(politics2007.cards.find((card) => card.number === 1).answer).toBe('B');
    expect(politics2007.cards.find((card) => card.number === 33).answer).toBe('ABCD');
    expect(politics2007.cards.find((card) => card.number === 38).type).toBe('analysis');
    expect(politics2007.cards.find((card) => card.number === 38).answerImages.at(-1).src).toContain(
      'question-bank/politics-2007/paper-page-20.jpg'
    );
    const politics2008 = await loadBankData('politics-2008');
    expect(politics2008.cards).toHaveLength(38);
    expect(politics2008.cards.every((card) => card.answerEvidenceStatus === 'matched')).toBe(true);
    expect(politics2008.cards.find((card) => card.number === 1).answer).toBe('D');
    expect(politics2008.cards.find((card) => card.number === 33).answer).toBe('ABCD');
    expect(politics2008.cards.find((card) => card.number === 38).type).toBe('analysis');
    expect(politics2008.cards.find((card) => card.number === 38).answerImages.at(-1).src).toContain(
      'question-bank/politics-2008/paper-page-16.jpg'
    );
    const politics2009 = await loadBankData('politics-2009');
    expect(politics2009.cards).toHaveLength(38);
    expect(politics2009.cards.every((card) => card.answerEvidenceStatus === 'matched')).toBe(true);
    expect(politics2009.cards.find((card) => card.number === 1).answer).toBe('A');
    expect(politics2009.cards.find((card) => card.number === 33).answer).toBe('BCD');
    expect(politics2009.cards.find((card) => card.number === 38).type).toBe('analysis');
    expect(politics2009.cards.find((card) => card.number === 38).answerImages.at(-1).src).toContain(
      'question-bank/politics-2009/paper-page-11.jpg'
    );
    const politics2010 = await loadBankData('politics-2010');
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
    const politics2011 = await loadBankData('politics-2011');
    expect(politics2011.cards).toHaveLength(38);
    expect(politics2011.cards.every((card) => card.answerEvidenceStatus === 'matched')).toBe(true);
    expect(politics2011.cards.find((card) => card.number === 1).answer).toBe('C');
    expect(politics2011.cards.find((card) => card.number === 33).answer).toBe('ABCD');
    expect(politics2011.cards.find((card) => card.number === 38).type).toBe('analysis');
    expect(politics2011.cards.find((card) => card.number === 38).answerImages.at(-1).src).toContain(
      'question-bank/politics-2011/answer-page-11.jpg'
    );
    const politics2012 = await loadBankData('politics-2012');
    expect(politics2012.cards).toHaveLength(38);
    expect(politics2012.cards.every((card) => card.answerEvidenceStatus === 'matched')).toBe(true);
    expect(politics2012.cards.find((card) => card.number === 1).answer).toBe('A');
    expect(politics2012.cards.find((card) => card.number === 22).answer).toBe('ABD');
    expect(politics2012.cards.find((card) => card.number === 33).answer).toBe('BCD');
    expect(politics2012.cards.find((card) => card.number === 38).type).toBe('analysis');
    expect(politics2012.cards.find((card) => card.number === 38).answerImages.at(-1).src).toContain(
      'question-bank/politics-2012/answer-page-23.jpg'
    );
    const politics2013 = await loadBankData('politics-2013');
    expect(politics2013.cards).toHaveLength(38);
    expect(politics2013.cards.every((card) => card.answerEvidenceStatus === 'matched')).toBe(true);
    expect(politics2013.cards.find((card) => card.number === 1).answer).toBe('C');
    expect(politics2013.cards.find((card) => card.number === 17).answer).toBe('ACD');
    expect(politics2013.cards.find((card) => card.number === 19).answer).toBe('CD');
    expect(politics2013.cards.find((card) => card.number === 33).answer).toBe('CD');
    expect(politics2013.cards.find((card) => card.number === 38).type).toBe('analysis');
    expect(politics2013.cards.find((card) => card.number === 38).answerImages.at(-1).src).toContain(
      'question-bank/politics-2013/paper-page-17.jpg'
    );
    const politics2014 = await loadBankData('politics-2014');
    expect(politics2014.cards).toHaveLength(38);
    expect(politics2014.cards.every((card) => card.answerEvidenceStatus === 'matched')).toBe(true);
    expect(politics2014.cards.find((card) => card.number === 1).answer).toBe('B');
    expect(politics2014.cards.find((card) => card.number === 17).answer).toBe('BD');
    expect(politics2014.cards.find((card) => card.number === 33).answer).toBe('ACD');
    expect(politics2014.cards.find((card) => card.number === 38).type).toBe('analysis');
    expect(politics2014.cards.find((card) => card.number === 38).answerImages.at(-1).src).toContain(
      'question-bank/politics-2014/answer-page-12.jpg'
    );
    const politics2015 = await loadBankData('politics-2015');
    expect(politics2015.cards).toHaveLength(38);
    expect(politics2015.cards.every((card) => card.answerEvidenceStatus === 'matched')).toBe(true);
    expect(politics2015.cards.find((card) => card.number === 1).answer).toBe('B');
    expect(politics2015.cards.find((card) => card.number === 17).answer).toBe('ABC');
    expect(politics2015.cards.find((card) => card.number === 33).answer).toBe('ABD');
    expect(politics2015.cards.find((card) => card.number === 38).type).toBe('analysis');
    expect(politics2015.cards.find((card) => card.number === 38).answerImages.at(-1).src).toContain(
      'question-bank/politics-2015/answer-page-20.jpg'
    );
    const politics2016 = await loadBankData('politics-2016');
    expect(politics2016.cards).toHaveLength(38);
    expect(politics2016.cards.every((card) => card.answerEvidenceStatus === 'matched')).toBe(true);
    expect(politics2016.cards.find((card) => card.number === 1).answer).toBe('B');
    expect(politics2016.cards.find((card) => card.number === 17).answer).toBe('CD');
    expect(politics2016.cards.find((card) => card.number === 21).answer).toBe('CD');
    expect(politics2016.cards.find((card) => card.number === 33).answer).toBe('ABD');
    expect(politics2016.cards.find((card) => card.number === 38).type).toBe('analysis');
    expect(politics2016.cards.find((card) => card.number === 38).answerImages.at(-1).src).toContain(
      'question-bank/politics-2016/answer-page-19.jpg'
    );
    const politics2017 = await loadBankData('politics-2017');
    expect(politics2017.cards).toHaveLength(38);
    expect(politics2017.cards.every((card) => card.answerEvidenceStatus === 'matched')).toBe(true);
    expect(politics2017.cards.find((card) => card.number === 1).answer).toBe('A');
    expect(politics2017.cards.find((card) => card.number === 17).answer).toBe('ABC');
    expect(politics2017.cards.find((card) => card.number === 23).answer).toBe('ABCD');
    expect(politics2017.cards.find((card) => card.number === 30).answer).toBe('AC');
    expect(politics2017.cards.find((card) => card.number === 33).answer).toBe('ACD');
    expect(politics2017.cards.find((card) => card.number === 38).type).toBe('analysis');
    expect(politics2017.cards.find((card) => card.number === 38).answerImages.at(-1).src).toContain(
      'question-bank/politics-2017/answer-page-20.jpg'
    );
    const politics2018 = await loadBankData('politics-2018');
    expect(politics2018.cards).toHaveLength(38);
    expect(politics2018.cards.every((card) => card.answerEvidenceStatus === 'matched')).toBe(true);
    expect(politics2018.cards.find((card) => card.number === 1).answer).toBe('C');
    expect(politics2018.cards.find((card) => card.number === 2).answer).toBe('A');
    expect(politics2018.cards.find((card) => card.number === 17).answer).toBe('ACD');
    expect(politics2018.cards.find((card) => card.number === 24).answer).toBe('ABC');
    expect(politics2018.cards.find((card) => card.number === 26).answer).toBe('AC');
    expect(politics2018.cards.find((card) => card.number === 33).answer).toBe('BCD');
    expect(politics2018.cards.find((card) => card.number === 38).type).toBe('analysis');
    expect(politics2018.cards.find((card) => card.number === 38).answerImages.at(-1).src).toContain(
      'question-bank/politics-2018/answer-page-17.jpg'
    );
    const politics2019 = await loadBankData('politics-2019');
    expect(politics2019.cards).toHaveLength(38);
    expect(politics2019.cards.every((card) => card.answerEvidenceStatus === 'matched')).toBe(true);
    expect(politics2019.cards.find((card) => card.number === 1).answer).toBe('C');
    expect(politics2019.cards.find((card) => card.number === 5).answer).toBe('A');
    expect(politics2019.cards.find((card) => card.number === 10).answer).toBe('A');
    expect(politics2019.cards.find((card) => card.number === 13).answer).toBe('D');
    expect(politics2019.cards.find((card) => card.number === 29).answer).toBe('AC');
    expect(politics2019.cards.find((card) => card.number === 30).answer).toBe('ABC');
    expect(politics2019.cards.find((card) => card.number === 33).answer).toBe('ABCD');
    expect(politics2019.cards.find((card) => card.number === 38).type).toBe('analysis');
    expect(politics2019.cards.find((card) => card.number === 38).answerImages.at(-1).src).toContain(
      'question-bank/politics-2019/answer-page-22.jpg'
    );
    const politics2020 = await loadBankData('politics-2020');
    expect(politics2020.cards).toHaveLength(38);
    expect(politics2020.cards.every((card) => card.answerEvidenceStatus === 'matched')).toBe(true);
    expect(politics2020.cards.find((card) => card.number === 1).answer).toBe('C');
    expect(politics2020.cards.find((card) => card.number === 6).answer).toBe('A');
    expect(politics2020.cards.find((card) => card.number === 17).answer).toBe('AB');
    expect(politics2020.cards.find((card) => card.number === 21).answer).toBe('ABD');
    expect(politics2020.cards.find((card) => card.number === 24).answer).toBe('ABCD');
    expect(politics2020.cards.find((card) => card.number === 29).answer).toBe('BCD');
    expect(politics2020.cards.find((card) => card.number === 33).answer).toBe('ABCD');
    expect(politics2020.cards.find((card) => card.number === 38).type).toBe('analysis');
    expect(politics2020.cards.find((card) => card.number === 38).answerImages.at(-1).src).toContain(
      'question-bank/politics-2020/answer-page-16.jpg'
    );
    const politics2021 = await loadBankData('politics-2021');
    expect(politics2021.cards).toHaveLength(38);
    expect(politics2021.cards.every((card) => card.answerEvidenceStatus === 'matched')).toBe(true);
    expect(politics2021.cards.find((card) => card.number === 1).answer).toBe('A');
    expect(politics2021.cards.find((card) => card.number === 4).answer).toBe('B');
    expect(politics2021.cards.find((card) => card.number === 17).answer).toBe('AD');
    expect(politics2021.cards.find((card) => card.number === 22).answer).toBe('BCD');
    expect(politics2021.cards.find((card) => card.number === 27).answer).toBe('AC');
    expect(politics2021.cards.find((card) => card.number === 33).answer).toBe('ACD');
    expect(politics2021.cards.find((card) => card.number === 38).type).toBe('analysis');
    expect(politics2021.cards.find((card) => card.number === 38).answerImages.at(-1).src).toContain(
      'question-bank/politics-2021/answer-page-20.jpg'
    );
    const politics2022 = await loadBankData('politics-2022');
    expect(politics2022.cards).toHaveLength(38);
    expect(politics2022.cards.every((card) => card.answerEvidenceStatus === 'matched')).toBe(true);
    expect(politics2022.cards.find((card) => card.number === 1).answer).toBe('C');
    expect(politics2022.cards.find((card) => card.number === 6).answer).toBe('A');
    expect(politics2022.cards.find((card) => card.number === 17).answer).toBe('BCD');
    expect(politics2022.cards.find((card) => card.number === 22).answer).toBe('ABD');
    expect(politics2022.cards.find((card) => card.number === 27).answer).toBe('BCD');
    expect(politics2022.cards.find((card) => card.number === 33).answer).toBe('ABC');
    expect(politics2022.cards.find((card) => card.number === 1).questionImages).toEqual([]);
    expect(politics2022.cards.find((card) => card.number === 38).type).toBe('analysis');
    expect(politics2022.cards.find((card) => card.number === 38).answerImages.at(-1).src).toContain(
      'question-bank/politics-2022/answer-page-31.jpg'
    );
    const english2025 = await loadBankData('english1-2025');
    expect(english2025.cards).toHaveLength(52);
    expect(english2025.cards.every((card) => card.answerEvidenceStatus === 'matched')).toBe(true);
    expect(english2025.cards.find((card) => card.number === 51).answerEvidence.evidenceRole).toBe(
      'official_writing_prompt'
    );
    const english22025 = await loadBankData('english2-2025');
    expect(english22025.cards).toHaveLength(48);
    expect(english22025.cards.every((card) => card.answerEvidenceStatus === 'matched')).toBe(true);
    expect(english22025.cards.find((card) => card.number === 21).passage).toEqual(expect.any(String));
    expect(english22025.cards.find((card) => card.number === 30).answer).toBe('C');
    expect(english22025.cards.find((card) => card.number === 48).answerEvidence.evidenceRole).toBe(
      'official_writing_prompt'
    );
    const english2005 = await loadBankData('english1-2005');
    expect(english2005.cards.length).toBeGreaterThan(0);
    expect(english2005.cards.find((card) => card.number === 21).passage).toEqual(expect.any(String));
    const english2006 = await loadBankData('english1-2006');
    expect(english2006.cards.length).toBeGreaterThan(0);
    expect(english2006.cards.find((card) => card.number === 41).options).toHaveLength(7);
    expect(english2006.cards.find((card) => card.number === 41).passage).toEqual(expect.any(String));
    const english2010 = await loadBankData('english1-2010');
    expect(english2010.cards).toHaveLength(52);
    expect(english2010.cards.find((card) => card.number === 46).targetSegment).toEqual(expect.any(String));
    const english2011 = await loadBankData('english1-2011');
    expect(english2011.cards).toHaveLength(52);
    expect(english2011.cards.find((card) => card.number === 41).options).toHaveLength(7);
    expect(english2011.cards.find((card) => card.number === 46).targetSegment).toEqual(expect.any(String));
    const english2012 = await loadBankData('english1-2012');
    expect(english2012.cards).toHaveLength(52);
    expect(english2012.cards.find((card) => card.number === 21).answer).toBe('D');
    const english2013 = await loadBankData('english1-2013');
    expect(english2013.cards).toHaveLength(52);
    expect(english2013.cards.every((card) => card.answerEvidenceStatus === 'matched')).toBe(true);
    expect(english2013.cards.find((card) => card.number === 41).options).toHaveLength(7);
    expect(english2013.cards.find((card) => card.number === 46).targetSegment).toContain('photographs');
    expect(english2013.cards.find((card) => card.number === 52).answerEvidence.evidenceRole).toBe(
      'official_writing_prompt'
    );
    const english2014 = await loadBankData('english1-2014');
    expect(english2014.cards).toHaveLength(52);
    expect(english2014.cards.every((card) => card.answerEvidenceStatus === 'matched')).toBe(true);
    expect(english2014.cards.find((card) => card.number === 31).answer).toBe('D');
    expect(english2014.cards.find((card) => card.number === 31).passage).toContain('Fundamental Physics Prize');
    expect(english2014.cards.find((card) => card.number === 41).options).toHaveLength(7);
    expect(english2014.cards.find((card) => card.number === 50).targetSegment).toContain('suffering is inevitable');
    expect(english2014.cards.find((card) => card.number === 52).answerEvidence.evidenceRole).toBe(
      'official_writing_prompt'
    );
    const english2016 = await loadBankData('english1-2016');
    expect(english2016.cards).toHaveLength(52);
    expect(english2016.cards.every((card) => card.answerEvidenceStatus === 'matched')).toBe(true);
    expect(english2016.cards.find((card) => card.number === 1).answer).toBe('C');
    expect(english2016.cards.find((card) => card.number === 21).answer).toBe('B');
    expect(english2016.cards.find((card) => card.number === 41).options).toHaveLength(7);
    expect(english2016.cards.find((card) => card.number === 46).targetSegment).toContain('mentally healthy');
    expect(english2016.cards.find((card) => card.number === 52).answerEvidence.evidenceRole).toBe(
      'official_writing_prompt'
    );
    const english2017 = await loadBankData('english1-2017');
    expect(english2017.cards).toHaveLength(52);
    expect(english2017.cards.every((card) => card.answerEvidenceStatus === 'matched')).toBe(true);
    expect(english2017.cards.find((card) => card.number === 1).answer).toBe('A');
    expect(english2017.cards.find((card) => card.number === 21).answer).toBe('A');
    expect(english2017.cards.find((card) => card.number === 41).options).toHaveLength(7);
    expect(english2017.cards.find((card) => card.number === 46).targetSegment).toContain('English speakers');
    expect(english2017.cards.find((card) => card.number === 52).answerEvidence.evidenceRole).toBe(
      'official_writing_prompt'
    );
    await expect(loadBankData('math-2025')).rejects.toThrow('题库不存在或暂不可用');
    const math12025 = await loadBankData('math1-2025');
    expect(math12025.cards).toHaveLength(22);
    expect(math12025.cards.every((card) => card.answerEvidenceStatus === 'matched')).toBe(true);
    expect(math12025.cards.find((card) => card.number === 1).answer).toBe('B');
    expect(math12025.cards.find((card) => card.number === 17).questionImages[0].src).toContain(
      'question-bank/math1-2025/paper-page-04.jpg'
    );
    expect(math12025.cards.find((card) => card.number === 22).answerImages.at(-1).src).toContain(
      'question-bank/math1-2025/answer-page-11.jpg'
    );
    for (const year of ['2008', '2009', '2010', '2011', '2012', '2013', '2014', '2015', '2016', '2017']) {
      const math1Bank = await loadBankData(`math1-${year}`);
      expect(math1Bank.cards).toHaveLength(23);
      expect(math1Bank.cards.every((card) => card.answerEvidenceStatus === 'matched')).toBe(true);
      expect(math1Bank.cards.find((card) => card.number === 1).answer.trim()).not.toBe('');
      expect(math1Bank.cards.find((card) => card.number === 23).answerImages.at(-1).src).toContain(
        `question-bank/math1-${year}/`
      );
    }
    const math22025 = await loadBankData('math2-2025');
    expect(math22025.cards).toHaveLength(22);
    expect(math22025.cards.every((card) => card.answerEvidenceStatus === 'matched')).toBe(true);
    expect(math22025.cards.find((card) => card.number === 1).answer).toBe('A');
    expect(math22025.cards.find((card) => card.number === 22).answer).toContain('a = 4');
    expect(math22025.cards.find((card) => card.number === 22).answerImages.at(-1).src).toContain(
      'question-bank/math2-2025/answer-page-14.jpg'
    );
    const math22011 = await loadBankData('math2-2011');
    expect(math22011.cards).toHaveLength(23);
    expect(math22011.cards.every((card) => card.answerEvidenceStatus === 'matched')).toBe(true);
    expect(math22011.cards.find((card) => card.number === 1).answer).toBe('C');
    expect(math22011.cards.find((card) => card.number === 9).answer).toBe('sqrt(2)');
    expect(math22011.cards.find((card) => card.number === 14).answer).toBe('2');
    expect(math22011.cards.find((card) => card.number === 23).answerImages.at(-1).src).toContain(
      'question-bank/math2-2011/answer-page-09.jpg'
    );
    const math22014 = await loadBankData('math2-2014');
    expect(math22014.cards).toHaveLength(23);
    expect(math22014.cards.every((card) => card.answerEvidenceStatus === 'matched')).toBe(true);
    expect(math22014.cards.find((card) => card.number === 1).answer).toBe('B');
    expect(math22014.cards.find((card) => card.number === 14).answer).toBe('[-2, 2]');
    expect(math22014.cards.find((card) => card.number === 23).answerImages.at(-1).src).toContain(
      'question-bank/math2-2014/answer-page-16.jpg'
    );
    const math32005 = await loadBankData('math3-2005');
    expect(math32005.cards).toHaveLength(23);
    expect(math32005.cards.every((card) => card.answerEvidenceStatus === 'matched')).toBe(true);
    expect(math32005.cards.find((card) => card.number === 1).answer).toBe('2');
    expect(math32005.cards.find((card) => card.number === 7).answer).toBe('B');
    expect(math32005.cards.find((card) => card.number === 23).answerImages.at(-1).src).toContain(
      'question-bank/math3-2005/answer-page-17.jpg'
    );
    const math32006 = await loadBankData('math3-2006');
    expect(math32006.cards).toHaveLength(23);
    expect(math32006.cards.every((card) => card.answerEvidenceStatus === 'matched')).toBe(true);
    expect(math32006.cards.find((card) => card.number === 1).answer).toBe('1');
    expect(math32006.cards.find((card) => card.number === 7).answer).toBe('A');
    expect(math32006.cards.find((card) => card.number === 23).answerImages.at(-1).src).toContain(
      'question-bank/math3-2006/answer-page-19.jpg'
    );
    const math32007 = await loadBankData('math3-2007');
    expect(math32007.cards).toHaveLength(24);
    expect(math32007.cards.every((card) => card.answerEvidenceStatus === 'matched')).toBe(true);
    expect(math32007.cards.find((card) => card.number === 1).answer).toBe('B');
    expect(math32007.cards.find((card) => card.number === 11).answer).toBe('0');
    expect(math32007.cards.find((card) => card.number === 24).questionImages).toEqual([]);
    expect(math32007.cards.find((card) => card.number === 24).answerImages.at(-1).src).toContain(
      'question-bank/math3-2007/answer-page-13.jpg'
    );
    const math32011 = await loadBankData('math3-2011');
    expect(math32011.cards).toHaveLength(23);
    expect(math32011.cards.every((card) => card.answerEvidenceStatus === 'matched')).toBe(true);
    expect(math32011.cards.find((card) => card.number === 1).answer).toBe('C');
    expect(math32011.cards.find((card) => card.number === 23).questionImages[0].src).toContain(
      'question-bank/math3-2011/question-23.jpg'
    );
    const math32012 = await loadBankData('math3-2012');
    expect(math32012.cards).toHaveLength(23);
    expect(math32012.cards.every((card) => card.answerEvidenceStatus === 'matched')).toBe(true);
    expect(math32012.cards.find((card) => card.number === 1).answer).toBe('C');
    expect(math32012.cards.find((card) => card.number === 14).answer).toBe('3/4');
    expect(math32012.cards.find((card) => card.number === 23).questionImages[0].src).toContain(
      'question-bank/math3-2012/question-23.jpg'
    );
    const math32013 = await loadBankData('math3-2013');
    expect(math32013.cards).toHaveLength(23);
    expect(math32013.cards.every((card) => card.answerEvidenceStatus === 'matched')).toBe(true);
    expect(math32013.cards.find((card) => card.number === 1).answer).toBe('D');
    expect(math32013.cards.find((card) => card.number === 14).answer).toBe('2e^2');
    expect(math32013.cards.find((card) => card.number === 23).questionImages[0].src).toContain(
      'question-bank/math3-2013/question-23.jpg'
    );
    const math32014 = await loadBankData('math3-2014');
    expect(math32014.cards).toHaveLength(23);
    expect(math32014.cards.every((card) => card.answerEvidenceStatus === 'matched')).toBe(true);
    expect(math32014.cards.find((card) => card.number === 1).answer).toBe('A');
    expect(math32014.cards.find((card) => card.number === 23).questionImages[0].src).toContain(
      'question-bank/math3-2014/question-23.jpg'
    );
    const math32015 = await loadBankData('math3-2015');
    expect(math32015.cards).toHaveLength(23);
    expect(math32015.cards.every((card) => card.answerEvidenceStatus === 'matched')).toBe(true);
    expect(math32015.cards.find((card) => card.number === 1).answer).toBe('D');
    expect(math32015.cards.find((card) => card.number === 14).answer).toBe('1/2');
    expect(math32015.cards.find((card) => card.number === 23).questionImages[0].src).toContain(
      'question-bank/math3-2015/question-23.jpg'
    );
  });

  it('builds public-course navigation tree without exposing disabled banks', () => {
    const tree = getPracticeNavigationTree({ tracks: ['politics', 'english1'] });
    const politics = tree.find((item) => item.id === 'politics');
    const english = tree.find((item) => item.id === 'english');

    expect(politics.tracks[0].banks.map((bank) => bank.id)).toEqual([
      'politics-2025',
      'politics-2024',
      'politics-2022',
      'politics-2021',
      'politics-2020',
      'politics-2019',
      'politics-2018',
      'politics-2017',
      'politics-2016',
      'politics-2015',
      'politics-2014',
      'politics-2013',
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
      2005, 2006, 2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022,
      2024, 2025
    ]);
    expect(politics.tracks[0].coverage.pendingYears).toEqual([]);
    expect(politics.tracks[0].pendingBanks.map((bank) => Number(bank.year))).toEqual([2023]);
    expect(politics.tracks[0].coverage.groupSourceRequired).toBe(false);
    expect(politics.tracks[0].yearSlots).toHaveLength(22);
    expect(politics.tracks[0].slotSummary).toEqual({ total: 22, ready: 20, organizing: 0, missing: 2 });
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
    expect(politics.tracks[0].yearSlots.find((slot) => slot.year === '2021')).toMatchObject({
      bankId: 'politics-2021',
      status: 'ready',
      statusLabel: '正式',
      clickable: true
    });
    expect(politics.tracks[0].yearSlots.find((slot) => slot.year === '2022')).toMatchObject({
      bankId: 'politics-2022',
      status: 'ready',
      statusLabel: '正式',
      clickable: true
    });
    expect(politics.tracks[0].yearSlots.find((slot) => slot.year === '2018')).toMatchObject({
      bankId: 'politics-2018',
      status: 'ready',
      statusLabel: '正式',
      clickable: true
    });
    expect(politics.tracks[0].yearSlots.find((slot) => slot.year === '2019')).toMatchObject({
      bankId: 'politics-2019',
      status: 'ready',
      statusLabel: '正式',
      clickable: true
    });
    expect(politics.tracks[0].yearSlots.find((slot) => slot.year === '2020')).toMatchObject({
      bankId: 'politics-2020',
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
    expect(politics.tracks[0].yearSlots.find((slot) => slot.year === '2013')).toMatchObject({
      bankId: 'politics-2013',
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
    expect(politics.tracks[0].yearSlots.find((slot) => slot.year === '2015')).toMatchObject({
      bankId: 'politics-2015',
      status: 'ready',
      statusLabel: '正式',
      clickable: true
    });
    expect(politics.tracks[0].yearSlots.find((slot) => slot.year === '2016')).toMatchObject({
      bankId: 'politics-2016',
      status: 'ready',
      statusLabel: '正式',
      clickable: true
    });
    expect(politics.tracks[0].yearSlots.find((slot) => slot.year === '2017')).toMatchObject({
      bankId: 'politics-2017',
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
    expect(english.tracks[0].banks.some((bank) => bank.id === 'english1-2016')).toBe(true);
    expect(english.tracks[0].banks.some((bank) => bank.id === 'english1-2017')).toBe(true);
    expect(english.tracks[0].pendingBanks.some((bank) => bank.id === 'english1-2025')).toBe(false);
    expect(english.tracks[0].pendingBanks.some((bank) => bank.id === 'english1-2025-source')).toBe(false);
    expect(english.tracks[0].pendingBanks.some((bank) => bank.id === 'english-2025')).toBe(false);
    expect(english.tracks[0].yearSlots).toHaveLength(22);
    expect(english.tracks[0].slotSummary).toEqual({ total: 22, ready: 14, organizing: 0, missing: 8 });
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
    expect(english.tracks[0].yearSlots.find((slot) => slot.year === '2016')).toMatchObject({
      bankId: 'english1-2016',
      status: 'ready',
      statusLabel: '正式',
      clickable: true
    });
    expect(english.tracks[0].yearSlots.find((slot) => slot.year === '2017')).toMatchObject({
      bankId: 'english1-2017',
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
      undefined,
      'math2-2024-pending-source',
      'math3-2024-pending-source'
    ]);
    expect(math.tracks[0].banks.some((bank) => bank.id === 'math1-2025')).toBe(true);
    expect(math.tracks[0].banks.some((bank) => bank.id === 'math1-2024')).toBe(true);
    expect(math.tracks[1].banks.some((bank) => bank.id === 'math2-2025')).toBe(true);
    expect(math.tracks[2].banks.some((bank) => bank.id === 'math3-2025')).toBe(true);
    expect(math.tracks[2].banks.some((bank) => bank.id === 'math3-2005')).toBe(true);
    expect(math.tracks[2].banks.some((bank) => bank.id === 'math3-2006')).toBe(true);
    expect(math.tracks[2].banks.some((bank) => bank.id === 'math3-2007')).toBe(true);
    expect(math.tracks[2].banks.some((bank) => bank.id === 'math3-2011')).toBe(true);
    expect(math.tracks[2].banks.some((bank) => bank.id === 'math3-2012')).toBe(true);
    expect(math.tracks[1].banks.some((bank) => bank.id === 'math2-2014')).toBe(true);
    expect(math.tracks[2].banks.some((bank) => bank.id === 'math3-2013')).toBe(true);
    expect(math.tracks[2].banks.some((bank) => bank.id === 'math3-2014')).toBe(true);
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
    expect(math1.publishedYears).toEqual([2024, 2025]);
    expect(math1.pendingYears).toEqual([]);
    expect(math1.missingYears).toEqual([2026]);
    expect(math1.releaseState).toBe('partial');

    const math2 = coverage.tracks.find((item) => item.track === 'math2');
    expect(math2.publishedYears).toEqual([2025]);
    expect(math2.pendingYears).toEqual([]);
    expect(math2.missingYears).toEqual([2024, 2026]);
    expect(math2.releaseState).toBe('partial');

    const math3 = coverage.tracks.find((item) => item.track === 'math3');
    expect(math3.publishedYears).toEqual([2025]);
    expect(math3.pendingYears).toEqual([]);
    expect(math3.missingYears).toEqual([2024, 2026]);
    expect(math3.releaseState).toBe('partial');
  });

  it('uses the production coverage scope requested for current exam prep by default', () => {
    const coverage = buildPublicCourseCoverage({ tracks: ['english1'] });
    const english1 = coverage.tracks.find((item) => item.track === 'english1');

    expect(english1.requiredYears[0]).toBe(2005);
    expect(english1.requiredYears.at(-1)).toBe(2026);
    expect(coverage.summary.requiredSlots).toBe(22);
  });

  it('starts English II public-course coverage from the first real exam year', () => {
    const coverage = buildPublicCourseCoverage({ tracks: ['english2'], minYear: 2005, maxYear: 2020 });
    const english2 = coverage.tracks.find((item) => item.track === 'english2');

    expect(english2.requiredYears[0]).toBe(2010);
    expect(english2.requiredYears.at(-1)).toBe(2020);
    expect(english2.requiredYears).not.toContain(2009);
    expect(coverage.summary.requiredSlots).toBe(11);
  });
});
