import { describe, expect, it } from 'vitest';
import { getAvailableBanks } from '@/config/bank-registry.js';
import { loadBankData } from '@/pages/practice-sub/bank-data-loader.js';

describe('Math II 2017 published bank data', () => {
  it('registers and loads the verified 2017 page-image bank', async () => {
    expect(getAvailableBanks().map((bank) => bank.id)).toEqual(expect.arrayContaining(['math2-2017']));

    const bank = await loadBankData('math2-2017');
    expect(bank).toEqual(
      expect.objectContaining({
        id: 'math2-2017',
        quality: 'ready',
        publicationStatus: 'published',
        total_cards: 23
      })
    );
    expect(bank.cards).toHaveLength(23);
    expect(bank.cards.every((card) => card.answerEvidenceStatus === 'matched')).toBe(true);

    expect(bank.cards.find((card) => card.number === 1).answer).toBe('A');
    expect(bank.cards.find((card) => card.number === 4).answer).toBe('C');
    expect(bank.cards.find((card) => card.number === 6).answer).toBe('C');
    expect(bank.cards.find((card) => card.number === 8).answer).toBe('B');
    expect(bank.cards.find((card) => card.number === 9).answer).toBe('y=x+2');
    expect(bank.cards.find((card) => card.number === 14).answer).toBe('-1');
    expect(bank.cards.find((card) => card.number === 15).answer).toContain('2/3');
    expect(bank.cards.find((card) => card.number === 18).answer).toContain('y(1)=1');
    expect(bank.cards.find((card) => card.number === 20).answer).toContain('5π/4');
    expect(bank.cards.find((card) => card.number === 23).answer).toContain('a=2');
    expect(bank.cards.find((card) => card.number === 23).answerImages.at(-1).src).toBe(
      'question-bank/math2-2017/answer-page-10.jpg'
    );
    expect(bank.cards.find((card) => card.number === 23).questionImages.map((image) => image.src)).toEqual([
      'question-bank/math2-2017/question-23.jpg'
    ]);
    expect(bank.cards.find((card) => card.number === 13).question).not.toContain('详解');
  });
});
