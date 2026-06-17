import { describe, expect, it } from 'vitest';
import { getAvailableBanks } from '@/config/bank-registry.js';
import { loadBankData } from '@/pages/practice-sub/bank-data-loader.js';

describe('English I 2023 published bank data', () => {
  it('registers and loads the verified 2023 Baidu Netdisk bank', async () => {
    expect(getAvailableBanks().map((bank) => bank.id)).toEqual(expect.arrayContaining(['english1-2023']));

    const bank = await loadBankData('english1-2023');
    expect(bank).toEqual(
      expect.objectContaining({
        id: 'english1-2023',
        quality: 'ready',
        publicationStatus: 'published',
        total_cards: 52
      })
    );
    expect(bank.cards).toHaveLength(52);
    expect(bank.cards.every((card) => card.answerEvidenceStatus === 'matched')).toBe(true);

    expect(bank.cards.find((card) => card.number === 1).answer).toBe('C');
    expect(bank.cards.find((card) => card.number === 21).answer).toBe('C');
    expect(bank.cards.find((card) => card.number === 40).answer).toBe('D');
    expect(bank.cards.find((card) => card.number === 41).answer).toBe('B');
    expect(bank.cards.find((card) => card.number === 45).answer).toBe('G');
    expect(bank.cards.find((card) => card.number === 46).targetSegment).toContain(
      'identify the lifestyle choices of customers'
    );
    expect(bank.cards.find((card) => card.number === 46).answer).toContain('客户生活方式的选择');
    expect(bank.cards.find((card) => card.number === 51).question).toContain(
      "Prof. Smith's research project on campus sports activities"
    );
    expect(bank.cards.find((card) => card.number === 52).question).toContain('Write an essay of 160-200 words');
  });
});
