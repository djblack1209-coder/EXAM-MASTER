import { describe, expect, it } from 'vitest';
import { getAvailableBanks } from '@/config/bank-registry.js';
import { loadBankData } from '@/pages/practice-sub/bank-data-loader.js';

describe('Politics 2023 published bank data', () => {
  it('does not publish the candidate bank until Baidu answer evidence covers every question', async () => {
    expect(getAvailableBanks().map((bank) => bank.id)).not.toEqual(expect.arrayContaining(['politics-2023']));
    await expect(loadBankData('politics-2023')).rejects.toThrow('题库不存在或暂不可用');
  });
});
