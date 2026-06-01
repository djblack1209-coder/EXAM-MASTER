/**
 * 闪卡题库加载 Composable
 * 主包仅提供题库元数据和已加载状态；真实题库数据由 practice-sub 分包加载。
 */
import { ref, computed } from 'vue';
import { getAvailableBanks } from '@/config/bank-registry.js';
import { getBankStats } from '@/utils/flashcard-adapter.js';
import { storageService } from '@/services/storageService.js';
import { safeNavigateTo } from '@/utils/safe-navigate';

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

  function syncLoadedBankIds() {
    _loadedSet.value = new Set(storageService.get('loaded_flashcard_banks', []) || []);
  }

  function openQuestionBank(bankId = '') {
    const query = bankId ? `?bankId=${encodeURIComponent(bankId)}` : '';
    safeNavigateTo(`/pages/practice-sub/question-bank${query}`);
  }

  return {
    loading,
    availableBanks,
    stats,
    loadedBankIds,
    syncLoadedBankIds,
    openQuestionBank
  };
}
