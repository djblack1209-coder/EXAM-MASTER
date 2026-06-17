import { describe, expect, it } from 'vitest';
import { getAvailableBanks } from '@/config/bank-registry.js';
import { loadBankData } from '@/pages/practice-sub/bank-data-loader.js';

describe('Math III 2024 published bank data', () => {
  it('registers and loads the verified 2024 Baidu Netdisk inline-answer PDF bank', async () => {
    expect(getAvailableBanks().map((bank) => bank.id)).toEqual(expect.arrayContaining(['math3-2024']));

    const bank = await loadBankData('math3-2024');
    expect(bank).toEqual(
      expect.objectContaining({
        id: 'math3-2024',
        quality: 'ready',
        publicationStatus: 'published',
        sourceEvidencePolicy: 'baidu_netdisk_official_paper_pdf_inline_answer_page_image_v1',
        total_cards: 22
      })
    );
    expect(bank.cards).toHaveLength(22);
    expect(bank.sourceFiles[0]).toMatchObject({
      role: 'paper_answer',
      localPath: 'data/raw-inbox/src_d9c2b923d74ae9283b1647f1-2024年数学（三）真题及参考答案.pdf',
      sha256: 'sha256:26aeb5f9e1a3e62fc395ad8cf22392b4718c7f61f13b87ef2180f2c218d00984',
      sourceId: 'src_d9c2b923d74ae9283b1647f1'
    });
    expect(bank.cards.every((card) => card.answerEvidenceStatus === 'matched')).toBe(true);
    expect(bank.cards.every((card) => card.sourceEvidence.sourceType === 'baidu_netdisk_official_paper_pdf_page_image')).toBe(
      true
    );

    expect(bank.cards.find((card) => card.number === 1).answer).toBe('D');
    expect(bank.cards.find((card) => card.number === 4).answer).toBe('A');
    expect(bank.cards.find((card) => card.number === 10).answer).toBe('D');
    expect(bank.cards.find((card) => card.number === 11).answer).toBe('3');
    expect(bank.cards.find((card) => card.number === 12).answer).toContain('1/2 ln 3');
    expect(bank.cards.find((card) => card.number === 16).answer).toBe('2/3');
    expect(bank.cards.find((card) => card.number === 17).answer).toContain('8/3 ln 3');
    expect(bank.cards.find((card) => card.number === 18).answer).toContain('-1 - 2ln2');
    expect(bank.cards.find((card) => card.number === 21).answer).toContain('a = 1');
    expect(bank.cards.find((card) => card.number === 22).answer).toContain('(n+1)/n');
    expect(bank.cards.find((card) => card.number === 22).answer).toContain('(n+2)/(n+1)');

    expect(bank.cards.find((card) => card.number === 1).questionImages.map((image) => image.src)).toEqual([
      'question-bank/math3-2024/paper-page-01.jpg'
    ]);
    expect(bank.cards.find((card) => card.number === 22).questionImages.map((image) => image.src)).toEqual([
      'question-bank/math3-2024/paper-page-04.jpg',
      'question-bank/math3-2024/paper-page-05.jpg'
    ]);
    expect(bank.cards.find((card) => card.number === 22).answerImages.at(-1).src).toBe(
      'question-bank/math3-2024/answer-page-05.jpg'
    );
  });
});
