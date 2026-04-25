/**
 * 闪卡题库加载 Composable
 * 提供加载闪卡题库到本地存储的能力
 */
import { ref, computed } from 'vue'
import { getAvailableBanks, loadBank } from '@/config/bank-registry.js'
import { importFlashcardsToBank, getBankStats } from '@/utils/flashcard-adapter.js'

// 简单的存储服务封装（兼容uni-app）
const storageService = {
  get(key) {
    try {
      const data = uni.getStorageSync(key)
      return data || null
    } catch {
      return null
    }
  },
  set(key, value) {
    try {
      uni.setStorageSync(key, value)
    } catch (e) {
      console.error('存储失败:', e)
    }
  },
}

export function useFlashcardBank() {
  const loading = ref(false)
  const availableBanks = ref(getAvailableBanks())

  // 题库统计
  const stats = computed(() => getBankStats(storageService))

  // 已加载的题库ID集合
  const loadedBankIds = computed(() => {
    const loaded = storageService.get('loaded_flashcard_banks') || []
    return new Set(loaded)
  })

  /**
   * 加载指定题库到本地存储
   * @param {string} bankId - 题库ID
   * @returns {Promise<Object>} - 导入结果
   */
  async function loadFlashcardBank(bankId) {
    loading.value = true
    try {
      // 加载闪卡JSON数据
      const data = await loadBank(bankId)

      // 转换格式并导入到v30_bank
      const result = importFlashcardsToBank(data, storageService)

      // 记录已加载的题库
      const loaded = storageService.get('loaded_flashcard_banks') || []
      if (!loaded.includes(bankId)) {
        loaded.push(bankId)
        storageService.set('loaded_flashcard_banks', loaded)
      }

      uni.showToast({
        title: `导入 ${result.imported} 题`,
        icon: 'success',
      })

      return result
    } catch (e) {
      console.error('加载题库失败:', e)
      uni.showToast({
        title: '加载失败',
        icon: 'none',
      })
      throw e
    } finally {
      loading.value = false
    }
  }

  /**
   * 加载所有可用题库
   */
  async function loadAllBanks() {
    let totalImported = 0
    for (const bank of availableBanks.value) {
      const result = await loadFlashcardBank(bank.id)
      totalImported += result.imported
    }
    return totalImported
  }

  /**
   * 快速开始刷题（加载题库 + 跳转做题页）
   */
  async function quickStart(bankId) {
    // 如果题库未加载，先加载
    if (!loadedBankIds.value.has(bankId)) {
      await loadFlashcardBank(bankId)
    }

    // 跳转到做题页
    uni.navigateTo({
      url: '/pages/practice-sub/do-quiz',
    })
  }

  return {
    loading,
    availableBanks,
    stats,
    loadedBankIds,
    loadFlashcardBank,
    loadAllBanks,
    quickStart,
  }
}
