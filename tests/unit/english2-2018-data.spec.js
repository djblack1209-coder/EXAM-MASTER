import { describe, expect, it } from 'vitest';
import { getAvailableBanks } from '@/config/bank-registry.js';
import { loadBankData } from '@/pages/practice-sub/bank-data-loader.js';

describe('English II 2018 published bank data', () => {
  it('registers and loads the verified 2018 text-layer bank', async () => {
    expect(getAvailableBanks().map((bank) => bank.id)).toEqual(expect.arrayContaining(['english2-2018']));

    const bank = await loadBankData('english2-2018');
    expect(bank).toEqual(
      expect.objectContaining({
        id: 'english2-2018',
        quality: 'ready',
        publicationStatus: 'published',
        total_cards: 48
      })
    );
    expect(bank.cards).toHaveLength(48);
    expect(bank.cards.every((card) => card.answerEvidenceStatus === 'matched')).toBe(true);

    expect(bank.cards.find((card) => card.number === 1).answer).toBe('D');
    expect(bank.cards.find((card) => card.number === 21).answer).toBe('B');
    expect(bank.cards.find((card) => card.number === 30).answer).toBe('C');
    expect(bank.cards.find((card) => card.number === 41).answer).toBe('A');
    expect(bank.cards.find((card) => card.number === 45).answer).toBe('D');
    expect(bank.cards.find((card) => card.number === 46).targetSegment).toContain(
      'A fifth grader gets a homework assignment to select his future career path'
    );
    expect(bank.cards.find((card) => card.number === 46).targetSegment).not.toContain('英语（二）试题');
    expect(bank.cards.find((card) => card.number === 48).question).toContain(
      '2017年某市消费者选择餐厅时的关注因素'
    );
    expect(bank.cards.find((card) => card.number === 48).question).toContain('特色36.3%');
    expect(bank.cards.find((card) => card.number === 48).question).toContain('服务26.8%');
    expect(bank.cards.find((card) => card.number === 48).question).toContain('环境23.8%');
    expect(bank.cards.find((card) => card.number === 48).question).toContain('价格8.4%');
    expect(bank.cards.find((card) => card.number === 48).question).toContain('其他4.7%');
    expect(bank.cards.find((card) => card.number === 48).answerEvidence.evidenceRole).toBe(
      'official_writing_prompt'
    );
  });
});
