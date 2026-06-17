import { describe, expect, it } from 'vitest';
import { getAvailableBanks } from '@/config/bank-registry.js';
import { loadBankData } from '@/pages/practice-sub/bank-data-loader.js';

describe('English II 2021 published bank data', () => {
  it('registers and loads the verified 2021 Baidu Netdisk bank', async () => {
    expect(getAvailableBanks().map((bank) => bank.id)).toEqual(expect.arrayContaining(['english2-2021']));

    const bank = await loadBankData('english2-2021');
    expect(bank).toEqual(
      expect.objectContaining({
        id: 'english2-2021',
        quality: 'ready',
        publicationStatus: 'published',
        total_cards: 48
      })
    );
    expect(bank.cards).toHaveLength(48);
    expect(bank.cards.every((card) => card.answerEvidenceStatus === 'matched')).toBe(true);

    expect(bank.cards.find((card) => card.number === 1).answer).toBe('B');
    expect(bank.cards.find((card) => card.number === 21).answer).toBe('B');
    expect(bank.cards.find((card) => card.number === 30).answer).toBe('B');
    expect(bank.cards.find((card) => card.number === 41).answer).toBe('C');
    expect(bank.cards.find((card) => card.number === 45).answer).toBe('B');
    expect(bank.cards.find((card) => card.number === 46).targetSegment).toContain(
      'interacting with strangers actually brings a boost in mood'
    );
    expect(bank.cards.find((card) => card.number === 46).answer).toContain('与陌生人交谈');
    expect(bank.cards.find((card) => card.number === 48).question).toContain('某市居民体育锻炼方式调查');
    expect(bank.cards.find((card) => card.number === 48).question).toContain('54.3%');
    expect(bank.cards.find((card) => card.number === 48).question).toContain('47.7%');
    expect(bank.cards.find((card) => card.number === 48).question).toContain('23.9%');
    expect(bank.cards.find((card) => card.number === 48).question).toContain('15.8%');
    expect(bank.cards.find((card) => card.number === 48).answerEvidence.evidenceRole).toBe(
      'official_writing_prompt'
    );
  });
});
