import { describe, expect, it } from 'vitest';
import { getAvailableBanks } from '@/config/bank-registry.js';
import { loadBankData } from '@/pages/practice-sub/bank-data-loader.js';

describe('English I 2019 published bank data', () => {
  it('registers and loads the verified 2019 English I bank without promotional or English II source bleed', async () => {
    expect(getAvailableBanks().map((bank) => bank.id)).toEqual(expect.arrayContaining(['english1-2019']));

    const bank = await loadBankData('english1-2019');
    expect(bank).toEqual(
      expect.objectContaining({
        id: 'english1-2019',
        quality: 'ready',
        publicationStatus: 'published',
        total_cards: 52
      })
    );
    expect(bank.cards).toHaveLength(52);
    expect(bank.cards.every((card) => card.answerEvidenceStatus === 'matched')).toBe(true);

    expect(bank.cards.find((card) => card.number === 1).answer).toBe('C');
    expect(bank.cards.find((card) => card.number === 21).answer).toBe('A');
    expect(bank.cards.find((card) => card.number === 26).answer).toBe('D');
    expect(bank.cards.find((card) => card.number === 30).answer).toBe('B');
    expect(bank.cards.find((card) => card.number === 41).answer).toBe('E');
    expect(bank.cards.find((card) => card.number === 45).answer).toBe('A');
    expect(bank.cards.find((card) => card.number === 46).targetSegment).toContain(
      'There is a great deal of this kind of nonsense in the medical journals'
    );
    expect(bank.cards.find((card) => card.number === 51).question).toContain('Aiding Rural Primary Schools');
    expect(bank.cards.find((card) => card.number === 52).question).toContain('picture below');
    expect(bank.cards.find((card) => card.number === 52).answerEvidence.evidenceRole).toBe(
      'official_writing_prompt'
    );
    expect(JSON.stringify(bank)).not.toContain('用“闪过”');
    expect(JSON.stringify(bank)).not.toContain('故事情节纯属虚构');
    expect(JSON.stringify(bank)).not.toContain('Museums');
  });
});
