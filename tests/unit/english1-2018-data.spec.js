import { describe, expect, it } from 'vitest';
import { getAvailableBanks } from '@/config/bank-registry.js';
import { loadBankData } from '@/pages/practice-sub/bank-data-loader.js';

describe('English I 2018 published bank data', () => {
  it('registers and loads the verified 2018 English I bank without stale answer pollution', async () => {
    expect(getAvailableBanks().map((bank) => bank.id)).toEqual(expect.arrayContaining(['english1-2018']));

    const bank = await loadBankData('english1-2018');
    expect(bank).toEqual(
      expect.objectContaining({
        id: 'english1-2018',
        quality: 'ready',
        publicationStatus: 'published',
        total_cards: 52
      })
    );
    expect(bank.cards).toHaveLength(52);
    expect(bank.cards.every((card) => card.answerEvidenceStatus === 'matched')).toBe(true);

    expect(bank.cards.find((card) => card.number === 1).answer).toBe('C');
    expect(bank.cards.find((card) => card.number === 21).answer).toBe('D');
    expect(bank.cards.find((card) => card.number === 26).answer).toBe('D');
    expect(bank.cards.find((card) => card.number === 30).answer).toBe('A');
    expect(bank.cards.find((card) => card.number === 41).answer).toBe('E');
    expect(bank.cards.find((card) => card.number === 45).answer).toBe('D');
    expect(bank.cards.find((card) => card.number === 46).targetSegment).toContain(
      'By the date of his birth Europe was witnessing the passing of the religious drama'
    );
    expect(bank.cards.find((card) => card.number === 51).question).toContain('graduation ceremony');
    expect(bank.cards.find((card) => card.number === 52).question).toContain('选课进行时');
    expect(bank.cards.find((card) => card.number === 52).answerEvidence.evidenceRole).toBe(
      'official_writing_prompt'
    );
    expect(JSON.stringify(bank)).not.toContain('手机阅读目的调查');
    expect(JSON.stringify(bank)).not.toContain('failure');
    expect(bank.cards.find((card) => card.number === 26).answer).not.toContain(
      'A new survey by Harvard University'
    );
  });
});
