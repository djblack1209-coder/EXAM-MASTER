import { describe, expect, it } from 'vitest';
import { getAvailableBanks } from '@/config/bank-registry.js';
import { loadBankData } from '@/pages/practice-sub/bank-data-loader.js';

describe('English II 2014 published bank data', () => {
  it('registers and loads the verified 2014 text-layer bank', async () => {
    expect(getAvailableBanks().map((bank) => bank.id)).toEqual(expect.arrayContaining(['english2-2014']));

    const bank = await loadBankData('english2-2014');
    expect(bank).toEqual(
      expect.objectContaining({
        id: 'english2-2014',
        quality: 'ready',
        publicationStatus: 'published',
        total_cards: 48
      })
    );
    expect(bank.cards).toHaveLength(48);
    expect(bank.cards.every((card) => card.answerEvidenceStatus === 'matched')).toBe(true);

    expect(bank.cards.find((card) => card.number === 1).answer).toBe('B');
    expect(bank.cards.find((card) => card.number === 21).answer).toBe('B');
    expect(bank.cards.find((card) => card.number === 30).answer).toBe('D');
    expect(bank.cards.find((card) => card.number === 41).answer).toBe('D');
    expect(bank.cards.find((card) => card.number === 45).answer).toBe('A');
    expect(bank.cards.find((card) => card.number === 46).targetSegment).toContain(
      'Most people would define optimism'
    );
    expect(bank.cards.find((card) => card.number === 48).question).toContain('20年间中国城镇人口与乡村人口变化图');
    expect(bank.cards.find((card) => card.number === 48).answerEvidence.evidenceRole).toBe(
      'official_writing_prompt'
    );
  });
});
