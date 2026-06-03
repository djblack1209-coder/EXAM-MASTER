import { describe, expect, it } from 'vitest';
import { getAvailableBanks } from '@/config/bank-registry.js';
import { loadBankData } from '@/pages/practice-sub/bank-data-loader.js';

describe('English II 2012 published bank data', () => {
  it('registers and loads the verified 2012 text-layer bank', async () => {
    expect(getAvailableBanks().map((bank) => bank.id)).toEqual(expect.arrayContaining(['english2-2012']));

    const bank = await loadBankData('english2-2012');
    expect(bank).toEqual(
      expect.objectContaining({
        id: 'english2-2012',
        quality: 'ready',
        publicationStatus: 'published',
        total_cards: 48
      })
    );
    expect(bank.cards).toHaveLength(48);
    expect(bank.cards.every((card) => card.answerEvidenceStatus === 'matched')).toBe(true);

    expect(bank.cards.find((card) => card.number === 1).answer).toBe('A');
    expect(bank.cards.find((card) => card.number === 21).answer).toBe('A');
    expect(bank.cards.find((card) => card.number === 30).answer).toBe('C');
    expect(bank.cards.find((card) => card.number === 46).targetSegment).toContain('brain drain');
    expect(bank.cards.find((card) => card.number === 46).targetSegment).toContain('developing countries');
    expect(bank.cards.find((card) => card.number === 48).question).toContain('某公司员工工作满意度调查');
    expect(bank.cards.find((card) => card.number === 48).answerEvidence.evidenceRole).toBe(
      'official_writing_prompt'
    );
  });
});
