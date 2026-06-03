import { describe, expect, it } from 'vitest';
import { getAvailableBanks } from '@/config/bank-registry.js';
import { loadBankData } from '@/pages/practice-sub/bank-data-loader.js';

describe('Math III 2016 published bank data', () => {
  it('registers and loads the verified 2016 page-image bank', async () => {
    expect(getAvailableBanks().map((bank) => bank.id)).toEqual(expect.arrayContaining(['math3-2016']));

    const bank = await loadBankData('math3-2016');
    expect(bank).toEqual(
      expect.objectContaining({
        id: 'math3-2016',
        quality: 'ready',
        publicationStatus: 'published',
        total_cards: 23
      })
    );
    expect(bank.cards).toHaveLength(23);
    expect(bank.cards.every((card) => card.answerEvidenceStatus === 'matched')).toBe(true);

    expect(bank.cards.find((card) => card.number === 1).answer).toContain('a=1');
    expect(bank.cards.find((card) => card.number === 7).answer).toBe('A');
    expect(bank.cards.find((card) => card.number === 11).answer).toBe('D');
    expect(bank.cards.find((card) => card.number === 14).answer).toBe('C');
    expect(bank.cards.find((card) => card.number === 15).answer).toContain('4/3');
    expect(bank.cards.find((card) => card.number === 23).answerImages.at(-1).src).toContain(
      'question-bank/math3-2016/answer-page-19.jpg'
    );
    expect(bank.cards.find((card) => card.number === 11).questionImages[0].src).toContain(
      'question-bank/math3-2016/question-11.jpg'
    );
    expect(bank.cards.find((card) => card.number === 11).question).not.toContain('[D]');
  });
});
