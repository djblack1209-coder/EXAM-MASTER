import { describe, expect, it } from 'vitest';
import { getAvailableBanks } from '@/config/bank-registry.js';
import { loadBankData } from '@/pages/practice-sub/bank-data-loader.js';

describe('English II 2013 published bank data', () => {
  it('registers and loads the verified 2013 text-layer bank', async () => {
    expect(getAvailableBanks().map((bank) => bank.id)).toEqual(expect.arrayContaining(['english2-2013']));

    const bank = await loadBankData('english2-2013');
    expect(bank).toEqual(
      expect.objectContaining({
        id: 'english2-2013',
        quality: 'ready',
        publicationStatus: 'published',
        total_cards: 48
      })
    );
    expect(bank.cards).toHaveLength(48);
    expect(bank.cards.every((card) => card.answerEvidenceStatus === 'matched')).toBe(true);

    expect(bank.cards.find((card) => card.number === 1).answer).toBe('A');
    expect(bank.cards.find((card) => card.number === 21).answer).toBe('A');
    expect(bank.cards.find((card) => card.number === 30).answer).toBe('D');
    expect(bank.cards.find((card) => card.number === 41).answer).toBe('F');
    expect(bank.cards.find((card) => card.number === 45).answer).toBe('D');
    expect(bank.cards.find((card) => card.number === 46).targetSegment).toContain('Hair opened on Broadway');
    expect(bank.cards.find((card) => card.number === 48).question).toContain('某高校学生兼职情况');
    expect(bank.cards.find((card) => card.number === 48).answerEvidence.evidenceRole).toBe(
      'official_writing_prompt'
    );
  });
});
