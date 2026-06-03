import { describe, expect, it } from 'vitest';
import { getAvailableBanks } from '@/config/bank-registry.js';
import { loadBankData } from '@/pages/practice-sub/bank-data-loader.js';

describe('Math II 2019 published bank data', () => {
  it('registers and loads the verified 2019 page-image bank', async () => {
    expect(getAvailableBanks().map((bank) => bank.id)).toEqual(expect.arrayContaining(['math2-2019']));

    const bank = await loadBankData('math2-2019');
    expect(bank).toEqual(
      expect.objectContaining({
        id: 'math2-2019',
        quality: 'ready',
        publicationStatus: 'published',
        total_cards: 23
      })
    );
    expect(bank.cards).toHaveLength(23);
    expect(bank.cards.every((card) => card.answerEvidenceStatus === 'matched')).toBe(true);

    expect(bank.cards.find((card) => card.number === 1).answer).toBe('C');
    expect(bank.cards.find((card) => card.number === 2).answer).toBe('B');
    expect(bank.cards.find((card) => card.number === 8).answer).toBe('C');
    expect(bank.cards.find((card) => card.number === 9).answer).toBe('4e^(3/2)');
    expect(bank.cards.find((card) => card.number === 10).answer).toBe('3π/2+2');
    expect(bank.cards.find((card) => card.number === 14).answer).toBe('-4');
    expect(bank.cards.find((card) => card.number === 17).answer).toContain('1/2π(e^4-e)');
    expect(bank.cards.find((card) => card.number === 20).answer).toContain('a=-3/4');
    expect(bank.cards.find((card) => card.number === 23).answer).toContain('x=3，y=-2');
    expect(bank.cards.find((card) => card.number === 23).answerImages.at(-1).src).toBe(
      'question-bank/math2-2019/answer-page-05.jpg'
    );
  });
});
