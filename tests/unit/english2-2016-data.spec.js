import { describe, expect, it } from 'vitest';
import { getAvailableBanks } from '@/config/bank-registry.js';
import { loadBankData } from '@/pages/practice-sub/bank-data-loader.js';

describe('English II 2016 published bank data', () => {
  it('registers and loads the verified 2016 text-layer bank', async () => {
    expect(getAvailableBanks().map((bank) => bank.id)).toEqual(expect.arrayContaining(['english2-2016']));

    const bank = await loadBankData('english2-2016');
    expect(bank).toEqual(
      expect.objectContaining({
        id: 'english2-2016',
        quality: 'ready',
        publicationStatus: 'published',
        total_cards: 48
      })
    );
    expect(bank.cards).toHaveLength(48);
    expect(bank.cards.every((card) => card.answerEvidenceStatus === 'matched')).toBe(true);

    expect(bank.cards.find((card) => card.number === 1).answer).toBe('C');
    expect(bank.cards.find((card) => card.number === 21).answer).toBe('B');
    expect(bank.cards.find((card) => card.number === 30).answer).toBe('C');
    expect(bank.cards.find((card) => card.number === 41).answer).toBe('C');
    expect(bank.cards.find((card) => card.number === 45).answer).toBe('D');
    expect(bank.cards.find((card) => card.number === 46).targetSegment).toContain(
      'The supermarket is designed to lure customers'
    );
    expect(bank.cards.find((card) => card.number === 48).question).toContain('某高校学生旅游目的调查');
    expect(bank.cards.find((card) => card.number === 48).question).toContain('欣赏风景 37%');
    expect(bank.cards.find((card) => card.number === 48).question).toContain('缓解压力 33%');
    expect(bank.cards.find((card) => card.number === 48).answerEvidence.evidenceRole).toBe(
      'official_writing_prompt'
    );
  });
});
