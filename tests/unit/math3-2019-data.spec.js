import { describe, expect, it } from 'vitest';
import { getAvailableBanks } from '@/config/bank-registry.js';
import { loadBankData } from '@/pages/practice-sub/bank-data-loader.js';

describe('Math III 2019 published bank data', () => {
  it('registers and loads the verified 2019 page-image bank', async () => {
    expect(getAvailableBanks().map((bank) => bank.id)).toEqual(expect.arrayContaining(['math3-2019']));

    const bank = await loadBankData('math3-2019');
    expect(bank).toEqual(
      expect.objectContaining({
        id: 'math3-2019',
        quality: 'ready',
        publicationStatus: 'published',
        total_cards: 23
      })
    );
    expect(bank.cards).toHaveLength(23);
    expect(bank.cards.every((card) => card.answerEvidenceStatus === 'matched')).toBe(true);
    expect(bank.cards.find((card) => card.number === 1).answer).toBe('C');
    expect(bank.cards.find((card) => card.number === 4).answer).toBe('B');
    expect(bank.cards.find((card) => card.number === 4).questionImages.map((image) => image.src)).toEqual([
      'question-bank/math3-2019/question-04-a.jpg',
      'question-bank/math3-2019/question-04-b.jpg'
    ]);
    expect(bank.cards.find((card) => card.number === 8).answer).toBe('A');
    expect(bank.cards.find((card) => card.number === 9).answer).toBe('e^(-1)');
    expect(bank.cards.find((card) => card.number === 14).answer).toBe('2/3');
    expect(bank.cards.find((card) => card.number === 21).answer).toContain('x=3');
    expect(bank.cards.find((card) => card.number === 22).questionImages.map((image) => image.src)).toEqual([
      'question-bank/math3-2019/question-22-a.jpg',
      'question-bank/math3-2019/question-22-b.jpg'
    ]);
    expect(bank.cards.find((card) => card.number === 23).answerImages.at(-1).src).toBe(
      'question-bank/math3-2019/answer-page-12.jpg'
    );
  });
});
