import { describe, expect, it } from 'vitest';
import { getAvailableBanks } from '@/config/bank-registry.js';
import { loadBankData } from '@/pages/practice-sub/bank-data-loader.js';

describe('English II 2023 published bank data', () => {
  it('registers and loads the verified 2023 Baidu Netdisk bank', async () => {
    expect(getAvailableBanks().map((bank) => bank.id)).toEqual(expect.arrayContaining(['english2-2023']));

    const bank = await loadBankData('english2-2023');
    expect(bank).toEqual(
      expect.objectContaining({
        id: 'english2-2023',
        quality: 'ready',
        publicationStatus: 'published',
        total_cards: 48
      })
    );
    expect(bank.cards).toHaveLength(48);
    expect(bank.cards.every((card) => card.answerEvidenceStatus === 'matched')).toBe(true);

    expect(bank.cards.find((card) => card.number === 1).answer).toBe('B');
    expect(bank.cards.find((card) => card.number === 21).answer).toBe('A');
    expect(bank.cards.find((card) => card.number === 30).answer).toBe('D');
    expect(bank.cards.find((card) => card.number === 41).answer).toBe('D');
    expect(bank.cards.find((card) => card.number === 45).answer).toBe('G');
    expect(bank.cards.find((card) => card.number === 46).targetSegment).toContain(
      'William Wordsworth became famous for his poems about nature'
    );
    expect(bank.cards.find((card) => card.number === 46).answer).toContain('华兹华斯');
    expect(bank.cards.find((card) => card.number === 47).question).toContain('art exhibition and a robot show');
    expect(bank.cards.find((card) => card.number === 48).question).toContain(
      '2012-2021年我国居民健康素养水平'
    );
    expect(bank.cards.find((card) => card.number === 48).question).toContain('25.40%');
    expect(bank.cards.find((card) => card.number === 48).answerEvidence.evidenceRole).toBe(
      'official_writing_prompt'
    );
  });
});
