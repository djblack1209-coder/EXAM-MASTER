import { describe, expect, it } from 'vitest';
import { getAvailableBanks } from '@/config/bank-registry.js';
import { loadBankData } from '@/pages/practice-sub/bank-data-loader.js';

describe('Math III 2020 published bank data', () => {
  it('registers and loads the verified 2020 page-image bank', async () => {
    expect(getAvailableBanks().map((bank) => bank.id)).toEqual(expect.arrayContaining(['math3-2020']));

    const bank = await loadBankData('math3-2020');
    expect(bank).toEqual(
      expect.objectContaining({
        id: 'math3-2020',
        quality: 'ready',
        publicationStatus: 'published',
        total_cards: 23
      })
    );
    expect(bank.cards).toHaveLength(23);
    expect(bank.cards.every((card) => card.answerEvidenceStatus === 'matched')).toBe(true);

    expect(bank.cards.find((card) => card.number === 1).answer).toBe('B');
    expect(bank.cards.find((card) => card.number === 2).answer).toBe('C');
    expect(bank.cards.find((card) => card.number === 6).answer).toBe('D');
    expect(bank.cards.find((card) => card.number === 6).questionImages.map((image) => image.src)).toEqual([
      'question-bank/math3-2020/question-06-a.jpg',
      'question-bank/math3-2020/question-06-b.jpg'
    ]);
    expect(bank.cards.find((card) => card.number === 8).answer).toBe('C');
    expect(bank.cards.find((card) => card.number === 9).answer).toBe('(π - 1)dx - dy');
    expect(bank.cards.find((card) => card.number === 12).answer).toBe('π ln 2 - π/3');
    expect(bank.cards.find((card) => card.number === 14).answer).toBe('8/7');
    expect(bank.cards.find((card) => card.number === 15).answer).toContain('b=-e/2');
    expect(bank.cards.find((card) => card.number === 16).answer).toContain('-1/216');
    expect(bank.cards.find((card) => card.number === 17).answer).toContain('e^(-x)cos2x');
    expect(bank.cards.find((card) => card.number === 18).answer).toContain('3π^2/128');
    expect(bank.cards.find((card) => card.number === 20).answer).toContain('a=4');
    expect(bank.cards.find((card) => card.number === 21).answer).toContain('[[0,6],[1,-1]]');
    expect(bank.cards.find((card) => card.number === 22).answer).toContain('相关系数为 1/3');
    expect(bank.cards.find((card) => card.number === 23).answerImages.at(-1).src).toBe(
      'question-bank/math3-2020/answer-page-13.jpg'
    );
  });
});
