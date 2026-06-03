import { describe, expect, it } from 'vitest';
import { getAvailableBanks } from '@/config/bank-registry.js';
import { loadBankData } from '@/pages/practice-sub/bank-data-loader.js';

describe('Math III 2017 published bank data', () => {
  it('registers and loads the verified 2017 page-image bank', async () => {
    expect(getAvailableBanks().map((bank) => bank.id)).toEqual(expect.arrayContaining(['math3-2017']));

    const bank = await loadBankData('math3-2017');
    expect(bank).toEqual(
      expect.objectContaining({
        id: 'math3-2017',
        quality: 'ready',
        publicationStatus: 'published',
        total_cards: 23
      })
    );
    expect(bank.cards).toHaveLength(23);
    expect(bank.cards.every((card) => card.answerEvidenceStatus === 'matched')).toBe(true);

    expect(bank.cards.find((card) => card.number === 1).answer).toBe('A');
    expect(bank.cards.find((card) => card.number === 4).answer).toBe('C');
    expect(bank.cards.find((card) => card.number === 8).answer).toBe('B');
    expect(bank.cards.find((card) => card.number === 9).answer).toBe('π^3/2');
    expect(bank.cards.find((card) => card.number === 14).answer).toBe('9/2');
    expect(bank.cards.find((card) => card.number === 15).answer).toContain('2/3');
    expect(bank.cards.find((card) => card.number === 23).answerImages.at(-1).src).toContain(
      'question-bank/math3-2017/answer-page-09.jpg'
    );
    expect(bank.cards.find((card) => card.number === 23).questionImages.map((image) => image.src)).toEqual([
      'question-bank/math3-2017/question-23-a.jpg',
      'question-bank/math3-2017/question-23-b.jpg'
    ]);
    expect(bank.cards.find((card) => card.number === 13).question).not.toContain('详解');
  });
});
