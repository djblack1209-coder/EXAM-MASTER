import { describe, expect, it } from 'vitest';
import { getAvailableBanks } from '@/config/bank-registry.js';
import { loadBankData } from '@/pages/practice-sub/bank-data-loader.js';

describe('English II 2017 published bank data', () => {
  it('registers and loads the verified 2017 text-layer bank', async () => {
    expect(getAvailableBanks().map((bank) => bank.id)).toEqual(expect.arrayContaining(['english2-2017']));

    const bank = await loadBankData('english2-2017');
    expect(bank).toEqual(
      expect.objectContaining({
        id: 'english2-2017',
        quality: 'ready',
        publicationStatus: 'published',
        total_cards: 48
      })
    );
    expect(bank.cards).toHaveLength(48);
    expect(bank.cards.every((card) => card.answerEvidenceStatus === 'matched')).toBe(true);

    expect(bank.cards.find((card) => card.number === 1).answer).toBe('C');
    expect(bank.cards.find((card) => card.number === 21).answer).toBe('A');
    expect(bank.cards.find((card) => card.number === 30).answer).toBe('A');
    expect(bank.cards.find((card) => card.number === 41).answer).toBe('E');
    expect(bank.cards.find((card) => card.number === 45).answer).toBe('F');
    expect(bank.cards.find((card) => card.number === 46).targetSegment).toContain(
      'My dream has always been to work somewhere in an area between fashion and publishing'
    );
    expect(bank.cards.find((card) => card.number === 48).question).toContain('2013-2015年我国博物馆数量和参观人数');
    expect(bank.cards.find((card) => card.number === 48).question).toContain('4165');
    expect(bank.cards.find((card) => card.number === 48).question).toContain('4692');
    expect(bank.cards.find((card) => card.number === 48).question).toContain('6378');
    expect(bank.cards.find((card) => card.number === 48).question).toContain('7811');
    expect(bank.cards.find((card) => card.number === 48).answerEvidence.evidenceRole).toBe(
      'official_writing_prompt'
    );
  });
});
