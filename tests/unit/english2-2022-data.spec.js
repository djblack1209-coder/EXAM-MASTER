import { describe, expect, it } from 'vitest';
import { getAvailableBanks } from '@/config/bank-registry.js';
import { loadBankData } from '@/pages/practice-sub/bank-data-loader.js';

describe('English II 2022 published bank data', () => {
  it('registers and loads the verified 2022 Baidu Netdisk bank', async () => {
    expect(getAvailableBanks().map((bank) => bank.id)).toEqual(expect.arrayContaining(['english2-2022']));

    const bank = await loadBankData('english2-2022');
    expect(bank).toEqual(
      expect.objectContaining({
        id: 'english2-2022',
        quality: 'ready',
        publicationStatus: 'published',
        total_cards: 48
      })
    );
    expect(bank.cards).toHaveLength(48);
    expect(bank.cards.every((card) => card.answerEvidenceStatus === 'matched')).toBe(true);

    expect(bank.cards.find((card) => card.number === 1).answer).toBe('B');
    expect(bank.cards.find((card) => card.number === 21).answer).toBe('D');
    expect(bank.cards.find((card) => card.number === 30).answer).toBe('A');
    expect(bank.cards.find((card) => card.number === 41).answer).toBe('C');
    expect(bank.cards.find((card) => card.number === 45).answer).toBe('B');
    expect(bank.cards.find((card) => card.number === 46).targetSegment).toContain(
      'Unexpected results have two benefits'
    );
    expect(bank.cards.find((card) => card.number === 46).answer).toContain('创造性地解决问题');
    expect(bank.cards.find((card) => card.number === 47).question).toContain('campus food festival');
    expect(bank.cards.find((card) => card.number === 48).question).toContain(
      '2018—2020年我国快递业务量变动情况'
    );
    expect(bank.cards.find((card) => card.number === 48).answerEvidence.evidenceRole).toBe(
      'official_writing_prompt'
    );
  });
});
