import { getAvailableBanks } from '@/config/bank-registry.js';
import { decodeBankData } from './bank-data-codec.js';
import { COMPRESSED_BANK_DATA_BY_ID } from './bank-data-table.js';

/**
 * 按 ID 加载题库完整数据。此模块必须只由 practice-sub 分包导入。
 *
 * @param {string} bankId
 * @returns {Promise<Object>}
 */
export async function loadBankData(bankId) {
  const isPublished = getAvailableBanks().some((bank) => bank.id === bankId);
  const compressedBase64 = COMPRESSED_BANK_DATA_BY_ID[bankId];
  if (!isPublished || !compressedBase64) {
    throw new Error(`题库不存在或暂不可用: ${bankId}`);
  }

  return decodeBankData(bankId, compressedBase64);
}
