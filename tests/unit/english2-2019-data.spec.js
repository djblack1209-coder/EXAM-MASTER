import { describe, expect, it } from 'vitest';
import { getAvailableBanks } from '@/config/bank-registry.js';
import { loadBankData } from '@/pages/practice-sub/bank-data-loader.js';

describe('English II 2019 published bank data', () => {
  it('registers and loads the verified 2019 text-layer bank', async () => {
    expect(getAvailableBanks().map((bank) => bank.id)).toEqual(expect.arrayContaining(['english2-2019']));

    const bank = await loadBankData('english2-2019');
    expect(bank).toEqual(
      expect.objectContaining({
        id: 'english2-2019',
        quality: 'ready',
        publicationStatus: 'published',
        total_cards: 48
      })
    );
    expect(bank.cards).toHaveLength(48);
    expect(bank.cards.every((card) => card.answerEvidenceStatus === 'matched')).toBe(true);

    expect(bank.cards.find((card) => card.number === 1).answer).toBe('C');
    expect(bank.cards.find((card) => card.number === 21).answer).toBe('C');
    expect(bank.cards.find((card) => card.number === 30).answer).toBe('A');
    expect(bank.cards.find((card) => card.number === 41).answer).toBe('D');
    expect(bank.cards.find((card) => card.number === 45).answer).toBe('B');
    expect(bank.cards.find((card) => card.number === 46).targetSegment).toContain(
      'It is easy to underestimate English writer James Herriot'
    );
    expect(bank.cards.find((card) => card.number === 46).targetSegment).not.toContain('英语（二）试题');
    expect(bank.cards.find((card) => card.number === 48).question).toContain(
      '某高校2013年和2018年本科毕业生去向统计'
    );
    expect(bank.cards.find((card) => card.number === 48).question).toContain('80.0%');
    expect(bank.cards.find((card) => card.number === 48).question).toContain('2013年');
    expect(bank.cards.find((card) => card.number === 48).question).toContain('2018年');
    expect(bank.cards.find((card) => card.number === 48).answerEvidence.evidenceRole).toBe(
      'official_writing_prompt'
    );
  });
});
