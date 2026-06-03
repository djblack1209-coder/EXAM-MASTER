import { describe, expect, it } from 'vitest';
import { getAvailableBanks } from '@/config/bank-registry.js';
import { loadBankData } from '@/pages/practice-sub/bank-data-loader.js';

describe('Math III 2018 published bank data', () => {
  it('registers and loads the verified 2018 page-image bank', async () => {
    expect(getAvailableBanks().map((bank) => bank.id)).toEqual(expect.arrayContaining(['math3-2018']));

    const bank = await loadBankData('math3-2018');
    expect(bank).toEqual(
      expect.objectContaining({
        id: 'math3-2018',
        quality: 'ready',
        publicationStatus: 'published',
        total_cards: 23
      })
    );
    expect(bank.cards).toHaveLength(23);
    expect(bank.cards.every((card) => card.answerEvidenceStatus === 'matched')).toBe(true);

    expect(bank.cards.find((card) => card.number === 1).answer).toBe('D');
    expect(bank.cards.find((card) => card.number === 2).answer).toBe('D');
    expect(bank.cards.find((card) => card.number === 8).answer).toBe('B');
    expect(bank.cards.find((card) => card.number === 9).answer).toBe('y=4x-3');
    expect(bank.cards.find((card) => card.number === 14).answer).toBe('1/3');
    expect(bank.cards.find((card) => card.number === 15).answer).toContain('a=1');
    expect(bank.cards.find((card) => card.number === 16).answer).toContain('sqrt(3)π/32');
    expect(bank.cards.find((card) => card.number === 23).answerImages.at(-1).src).toContain(
      'question-bank/math3-2018/answer-page-14.jpg'
    );
    expect(bank.cards.find((card) => card.number === 8).questionImages.map((image) => image.src)).toEqual([
      'question-bank/math3-2018/question-08-a.jpg',
      'question-bank/math3-2018/question-08-b.jpg'
    ]);
    expect(bank.cards.find((card) => card.number === 14).question).not.toContain('答案');
  });
});
