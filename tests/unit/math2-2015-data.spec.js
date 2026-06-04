import { describe, expect, it } from 'vitest';
import { getAvailableBanks } from '@/config/bank-registry.js';
import { loadBankData } from '@/pages/practice-sub/bank-data-loader.js';

describe('Math II 2015 published bank data', () => {
  it('registers and loads the verified 2015 page-image bank', async () => {
    expect(getAvailableBanks().map((bank) => bank.id)).toEqual(expect.arrayContaining(['math2-2015']));

    const bank = await loadBankData('math2-2015');
    expect(bank).toEqual(
      expect.objectContaining({
        id: 'math2-2015',
        quality: 'ready',
        publicationStatus: 'published',
        total_cards: 23
      })
    );
    expect(bank.cards).toHaveLength(23);
    expect(bank.cards.every((card) => card.answerEvidenceStatus === 'matched')).toBe(true);

    expect(bank.cards.find((card) => card.number === 1).answer).toBe('D');
    expect(bank.cards.find((card) => card.number === 2).answer).toBe('B');
    expect(bank.cards.find((card) => card.number === 3).answer).toBe('A');
    expect(bank.cards.find((card) => card.number === 8).answer).toBe('A');
    expect(bank.cards.find((card) => card.number === 9).answer).toBe('48');
    expect(bank.cards.find((card) => card.number === 10).answer).toBe('n(n-1)(ln2)^(n-2)');
    expect(bank.cards.find((card) => card.number === 14).answer).toBe('21');
    expect(bank.cards.find((card) => card.number === 15).answer).toContain('a=-1');
    expect(bank.cards.find((card) => card.number === 16).answer).toContain('8/π');
    expect(bank.cards.find((card) => card.number === 20).answer).toBe('30min');
    expect(bank.cards.find((card) => card.number === 23).answer).toContain('a=4,b=5');
    expect(bank.cards.find((card) => card.number === 23).answerImages.at(-1).src).toBe(
      'question-bank/math2-2015/answer-page-14.jpg'
    );
    expect(bank.cards.find((card) => card.number === 3).questionImages.map((image) => image.src)).toEqual([
      'question-bank/math2-2015/question-03.jpg'
    ]);
  });
});
