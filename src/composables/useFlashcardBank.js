/**
 * 闪卡题库加载 Composable
 * 提供加载闪卡题库到本地存储的能力
 */
import { ref, computed } from 'vue';
import { getAvailableBanks, loadBank } from '@/config/bank-registry.js';
import { importFlashcardsToBank, getBankStats } from '@/utils/flashcard-adapter.js';
import { storageService } from '@/services/storageService.js';
import { logger } from '@/utils/logger.js';

export function useFlashcardBank() {
  const loading = ref(false);
  const availableBanks = ref(getAvailableBanks());

  // 已加载的题库ID集合 — 使用 ref 保证响应式更新
  const _loadedSet = ref(new Set(storageService.get('loaded_flashcard_banks', []) || []));
  const loadedBankIds = computed(() => _loadedSet.value);

  // 题库统计
  const stats = computed(() =>
    getBankStats({
      get: (key) => storageService.get(key, [])
    })
  );

  /**
   * 加载指定题库到本地存储
   * @param {string} bankId - 题库ID
   * @returns {Promise<Object>} - 导入结果
   */
  async function loadFlashcardBank(bankId) {
    loading.value = true;
    try {
      // 加载闪卡JSON数据
      const data = await loadBank(bankId);

      // 转换格式并导入到 v30_bank
      // 使用与 do-quiz / useBankStatus 相同的 storageService（带用户隔离）
      const adapter = {
        get: (key) => storageService.get(key, []),
        set: (key, value) => storageService.save(key, value)
      };
      const result = importFlashcardsToBank(data, adapter);

      // 记录已加载的题库
      const loaded = storageService.get('loaded_flashcard_banks', []) || [];
      if (!loaded.includes(bankId)) {
        loaded.push(bankId);
        storageService.save('loaded_flashcard_banks', loaded);
      }

      // 响应式更新已加载集合
      _loadedSet.value = new Set(loaded);

      uni.showToast({
        title: `导入 ${result.imported} 题`,
        icon: 'success'
      });

      return result;
    } catch (e) {
      logger.error('[FlashcardBank] 加载题库失败:', e);
      uni.showToast({
        title: '加载失败',
        icon: 'none'
      });
      throw e;
    } finally {
      loading.value = false;
    }
  }

  /**
   * 加载所有可用题库
   */
  async function loadAllBanks() {
    let totalImported = 0;
    for (const bank of availableBanks.value) {
      const result = await loadFlashcardBank(bank.id);
      totalImported += result.imported;
    }
    return totalImported;
  }

  /**
   * 快速开始刷题（加载题库 + 跳转做题页）
   */
  async function quickStart(bankId) {
    // 如果题库未加载，先加载
    if (!loadedBankIds.value.has(bankId)) {
      await loadFlashcardBank(bankId);
    }

    // 跳转到做题页
    uni.navigateTo({
      url: '/pages/practice-sub/do-quiz'
    });
  }

  return {
    loading,
    availableBanks,
    stats,
    loadedBankIds,
    loadFlashcardBank,
    loadAllBanks,
    quickStart
  };
}
