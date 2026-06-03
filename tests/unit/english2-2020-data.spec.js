import { describe, expect, it } from 'vitest';
import { getAvailableBanks } from '@/config/bank-registry.js';
import { loadBankData } from '@/pages/practice-sub/bank-data-loader.js';

describe('English II 2020 published bank data', () => {
  it('registers and loads the verified 2020 text-layer bank', async () => {
    expect(getAvailableBanks().map((bank) => bank.id)).toEqual(expect.arrayContaining(['english2-2020']));

    const bank = await loadBankData('english2-2020');
    expect(bank).toEqual(
      expect.objectContaining({
        id: 'english2-2020',
        quality: 'ready',
        publicationStatus: 'published',
        total_cards: 48
      })
    );
    expect(bank.cards).toHaveLength(48);
    expect(bank.cards.every((card) => card.answerEvidenceStatus === 'matched')).toBe(true);

    expect(bank.cards.find((card) => card.number === 1).answer).toBe('B');
    expect(bank.cards.find((card) => card.number === 21).answer).toBe('A');
    expect(bank.cards.find((card) => card.number === 30).answer).toBe('A');
    expect(bank.cards.find((card) => card.number === 41).answer).toBe('E');
    expect(bank.cards.find((card) => card.number === 45).answer).toBe('C');
    expect(bank.cards.find((card) => card.number === 46).targetSegment).toContain(
      "It's almost impossible to go through life without experiencing some kind of failure"
    );
    expect(bank.cards.find((card) => card.number === 46).targetSegment).not.toContain('公众号');
    expect(bank.cards.find((card) => card.number === 48).question).toContain('某高校学生手机阅读目的调查');
    expect(bank.cards.find((card) => card.number === 48).question).toContain('59.5%');
    expect(bank.cards.find((card) => card.number === 48).question).toContain('21.3%');
    expect(bank.cards.find((card) => card.number === 48).question).toContain('17.0%');
    expect(bank.cards.find((card) => card.number === 48).question).toContain('2.2%');
    expect(bank.cards.find((card) => card.number === 48).answerEvidence.evidenceRole).toBe(
      'official_writing_prompt'
    );
  });
});
