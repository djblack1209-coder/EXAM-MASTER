import { describe, expect, it } from 'vitest';
import { getAvailableBanks } from '@/config/bank-registry.js';
import { loadBankData } from '@/pages/practice-sub/bank-data-loader.js';

describe('English I 2022 published bank data', () => {
  it('registers and loads the verified 2022 Baidu Netdisk bank', async () => {
    expect(getAvailableBanks().map((bank) => bank.id)).toEqual(expect.arrayContaining(['english1-2022']));

    const bank = await loadBankData('english1-2022');
    expect(bank).toEqual(
      expect.objectContaining({
        id: 'english1-2022',
        quality: 'ready',
        publicationStatus: 'published',
        total_cards: 52
      })
    );
    expect(bank.cards).toHaveLength(52);
    expect(bank.cards.every((card) => card.answerEvidenceStatus === 'matched')).toBe(true);

    expect(bank.cards.find((card) => card.number === 1).answer).toBe('A');
    expect(bank.cards.find((card) => card.number === 21).answer).toBe('A');
    expect(bank.cards.find((card) => card.number === 40).answer).toBe('C');
    expect(bank.cards.find((card) => card.number === 41).answer).toBe('F');
    expect(bank.cards.find((card) => card.number === 45).answer).toBe('G');
    expect(bank.cards.find((card) => card.number === 46).targetSegment).toContain('battle between those who made codes');
    expect(bank.cards.find((card) => card.number === 46).answer).toContain('加密者与破译者');
    expect(bank.cards.find((card) => card.number === 51).question).toContain('international innovation contest');
    expect(bank.cards.find((card) => card.number === 52).question).toContain('Write an essay of 160-200 words');
  });
});
