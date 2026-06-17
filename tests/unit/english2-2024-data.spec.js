import { describe, expect, it } from 'vitest';
import { getAvailableBanks } from '@/config/bank-registry.js';
import { loadBankData } from '@/pages/practice-sub/bank-data-loader.js';

describe('English II 2024 published bank data', () => {
  it('registers and loads the verified 2024 Baidu Netdisk bank', async () => {
    expect(getAvailableBanks().map((bank) => bank.id)).toEqual(expect.arrayContaining(['english2-2024']));

    const bank = await loadBankData('english2-2024');
    expect(bank).toEqual(
      expect.objectContaining({
        id: 'english2-2024',
        quality: 'ready',
        publicationStatus: 'published',
        total_cards: 48
      })
    );
    expect(bank.cards).toHaveLength(48);
    expect(bank.cards.every((card) => card.answerEvidenceStatus === 'matched')).toBe(true);

    expect(bank.cards.find((card) => card.number === 1).answer).toBe('C');
    expect(bank.cards.find((card) => card.number === 21).answer).toBe('C');
    expect(bank.cards.find((card) => card.number === 30).answer).toBe('C');
    expect(bank.cards.find((card) => card.number === 41).answer).toBe('C');
    expect(bank.cards.find((card) => card.number === 45).answer).toBe('B');
    expect(bank.cards.find((card) => card.number === 46).targetSegment).toContain(
      'With the smell of coffee and fresh bread floating in the air'
    );
    expect(bank.cards.find((card) => card.number === 46).answer).toContain('农贸市场');
    expect(bank.cards.find((card) => card.number === 47).question).toContain(
      'the protection of old hoses in an ancient town'
    );
    expect(bank.cards.find((card) => card.number === 48).question).toContain(
      '某高校劳动实践课学生主要收获调查'
    );
    expect(bank.cards.find((card) => card.number === 48).question).toContain('91.3%');
    expect(bank.cards.find((card) => card.number === 48).answerEvidence.evidenceRole).toBe(
      'official_writing_prompt'
    );
  });
});
