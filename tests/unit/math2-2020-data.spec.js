import { describe, expect, it } from 'vitest';
import { getAvailableBanks } from '@/config/bank-registry.js';
import { loadBankData } from '@/pages/practice-sub/bank-data-loader.js';

describe('Math II 2020 published bank data', () => {
  it('registers and loads the verified 2020 page-image bank', async () => {
    expect(getAvailableBanks().map((bank) => bank.id)).toEqual(expect.arrayContaining(['math2-2020']));

    const bank = await loadBankData('math2-2020');
    expect(bank).toEqual(
      expect.objectContaining({
        id: 'math2-2020',
        quality: 'ready',
        publicationStatus: 'published',
        total_cards: 23
      })
    );
    expect(bank.cards).toHaveLength(23);
    expect(bank.cards.every((card) => card.answerEvidenceStatus === 'matched')).toBe(true);

    expect(bank.cards.find((card) => card.number === 1).answer).toBe('D');
    expect(bank.cards.find((card) => card.number === 2).answer).toBe('C');
    expect(bank.cards.find((card) => card.number === 8).answer).toBe('D');
    expect(bank.cards.find((card) => card.number === 9).answer).toBe('-1/2');
    expect(bank.cards.find((card) => card.number === 10).answer).toBe('2(√2-1)');
    expect(bank.cards.find((card) => card.number === 14).answer).toBe('a^4-4a^2');
    expect(bank.cards.find((card) => card.number === 15).answer).toContain('y=x/e+1/(2e)');
    expect(bank.cards.find((card) => card.number === 21).answer).toContain('y=Cx^(3/2)');
    expect(bank.cards.find((card) => card.number === 23).answer).toContain('特征值为 2 和 -3');
    expect(bank.cards.find((card) => card.number === 23).answerImages.at(-1).src).toBe(
      'question-bank/math2-2020/answer-page-16.jpg'
    );
  });
});
