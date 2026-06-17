import { describe, expect, it } from 'vitest';
import { getAvailableBanks } from '@/config/bank-registry.js';
import { loadBankData } from '@/pages/practice-sub/bank-data-loader.js';

describe('English I 2024 published bank data', () => {
  it('registers and loads the verified 2024 Baidu Netdisk bank', async () => {
    expect(getAvailableBanks().map((bank) => bank.id)).toEqual(expect.arrayContaining(['english1-2024']));

    const bank = await loadBankData('english1-2024');
    expect(bank).toEqual(
      expect.objectContaining({
        id: 'english1-2024',
        quality: 'ready',
        publicationStatus: 'published',
        total_cards: 52
      })
    );
    expect(bank.cards).toHaveLength(52);
    expect(bank.cards.every((card) => card.answerEvidenceStatus === 'matched')).toBe(true);

    expect(bank.cards.find((card) => card.number === 1).answer).toBe('D');
    expect(bank.cards.find((card) => card.number === 21).answer).toBe('D');
    expect(bank.cards.find((card) => card.number === 40).answer).toBe('B');
    expect(bank.cards.find((card) => card.number === 41).answer).toBe('E');
    expect(bank.cards.find((card) => card.number === 45).answer).toBe('B');
    expect(bank.cards.find((card) => card.number === 46).targetSegment).toContain(
      'They sometimes travel more than sixty miles'
    );
    expect(bank.cards.find((card) => card.number === 46).answer).toContain('跋涉 60 多英');
    expect(bank.cards.find((card) => card.number === 51).question).toContain(
      'oral report on an ancient Chinese scientist'
    );
    expect(bank.cards.find((card) => card.number === 52).question).toContain('某市近三年公园数量');
    expect(bank.cards.find((card) => card.number === 52).question).toContain('2022年670座');
    expect(bank.cards.find((card) => card.number === 52).answerEvidence.evidenceRole).toBe(
      'official_writing_prompt'
    );
  });
});
