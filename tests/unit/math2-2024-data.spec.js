import { describe, expect, it } from 'vitest';
import { getAvailableBanks } from '@/config/bank-registry.js';
import { loadBankData } from '@/pages/practice-sub/bank-data-loader.js';

describe('Math II 2024 published bank data', () => {
  it('registers and loads the verified 2024 Baidu Netdisk inline-answer PDF bank', async () => {
    expect(getAvailableBanks().map((bank) => bank.id)).toEqual(expect.arrayContaining(['math2-2024']));

    const bank = await loadBankData('math2-2024');
    expect(bank).toEqual(
      expect.objectContaining({
        id: 'math2-2024',
        quality: 'ready',
        publicationStatus: 'published',
        sourceEvidencePolicy: 'baidu_netdisk_official_paper_pdf_inline_answer_page_image_v1',
        total_cards: 22
      })
    );
    expect(bank.cards).toHaveLength(22);
    expect(bank.sourceFiles[0]).toMatchObject({
      role: 'paper_answer',
      localPath: 'data/raw-inbox/src_fd240e348c940376a5a94f7f-2024年数学二真题及参考答案.pdf',
      sha256: 'sha256:816055fddf8314a65e0e81c52c1fb16f823c72c3996b721d4531b843c8f5c72f',
      sourceId: 'src_fd240e348c940376a5a94f7f'
    });
    expect(bank.cards.every((card) => card.answerEvidenceStatus === 'matched')).toBe(true);

    expect(bank.cards.find((card) => card.number === 1).answer).toBe('C');
    expect(bank.cards.find((card) => card.number === 4).answer).toBe('D');
    expect(bank.cards.find((card) => card.number === 10).answer).toBe('B');
    expect(bank.cards.find((card) => card.number === 11).answer).toContain('(x - 1/2)^2 + y^2 = 1/4');
    expect(bank.cards.find((card) => card.number === 15).answer).toContain('3pi/2');
    expect(bank.cards.find((card) => card.number === 16).answer).toBe('-4');
    expect(bank.cards.find((card) => card.number === 17).answer).toContain('8/3 ln 3');
    expect(bank.cards.find((card) => card.number === 18).answer).toContain('y(x)=2x^3');
    expect(bank.cards.find((card) => card.number === 20).answer).toContain('1/25');
    expect(bank.cards.find((card) => card.number === 22).answer).toContain('a = 1, b = 2');
    expect(bank.cards.find((card) => card.number === 22).answer).toContain('6y1^2');

    expect(bank.cards.find((card) => card.number === 1).questionImages.map((image) => image.src)).toEqual([
      'question-bank/math2-2024/paper-page-01.jpg'
    ]);
    expect(bank.cards.find((card) => card.number === 22).questionImages.map((image) => image.src)).toEqual([
      'question-bank/math2-2024/paper-page-05.jpg'
    ]);
    expect(bank.cards.find((card) => card.number === 22).answerImages.at(-1).src).toBe(
      'question-bank/math2-2024/answer-page-05.jpg'
    );
  });
});
