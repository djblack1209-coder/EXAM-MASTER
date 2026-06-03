import { describe, expect, it } from 'vitest';
import { getAvailableBanks } from '@/config/bank-registry.js';
import { loadBankData } from '@/pages/practice-sub/bank-data-loader.js';

describe('English I 2020 published bank data', () => {
  it('registers and loads the verified 2020 English I bank without English II source bleed', async () => {
    expect(getAvailableBanks().map((bank) => bank.id)).toEqual(expect.arrayContaining(['english1-2020']));

    const bank = await loadBankData('english1-2020');
    expect(bank).toEqual(
      expect.objectContaining({
        id: 'english1-2020',
        quality: 'ready',
        publicationStatus: 'published',
        total_cards: 52
      })
    );
    expect(bank.cards).toHaveLength(52);
    expect(bank.cards.every((card) => card.answerEvidenceStatus === 'matched')).toBe(true);

    expect(bank.cards.find((card) => card.number === 1).answer).toBe('C');
    expect(bank.cards.find((card) => card.number === 21).answer).toBe('C');
    expect(bank.cards.find((card) => card.number === 30).answer).toBe('D');
    expect(bank.cards.find((card) => card.number === 41).answer).toBe('C');
    expect(bank.cards.find((card) => card.number === 45).answer).toBe('D');
    expect(bank.cards.find((card) => card.number === 46).targetSegment).toContain(
      "With the Church's teachings and ways of thinking"
    );
    expect(bank.cards.find((card) => card.number === 51).question).toContain(
      'upcoming singing contest'
    );
    expect(bank.cards.find((card) => card.number === 52).question).toContain('习惯');
    expect(JSON.stringify(bank)).not.toContain('手机阅读目的调查');
    expect(JSON.stringify(bank)).not.toContain('failure');
    expect(bank.cards.find((card) => card.number === 52).answerEvidence.evidenceRole).toBe(
      'official_writing_prompt'
    );
  });
});
