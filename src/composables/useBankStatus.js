/**
 * useBankStatus — 题库状态管理
 * 从 practice/index.vue 提取的题库刷新、备份恢复、生成状态检测逻辑
 */
import { ref } from 'vue';
import { storageService } from '@/services/storageService.js';
import { logger } from '@/utils/logger.js';
import { getUserId } from '@/services/auth-storage.js';
import { isSeededPracticeRecord } from '@/services/quiz-session-contract.js';

export function useBankStatus() {
  const owner = getUserId() || '';
  const hasBank = ref(false);
  const totalQuestions = ref(0);
  const progressPercent = ref(0);
  const isPageLoading = ref(true);
  const isGeneratingQuestions = ref(false);

  // 内部标记：是否已完成首次加载
  let _hasLoadedOnce = false;

  /**
   * 刷新题库状态（无参版，兼容外部直接调用）
   */
  function refreshBankStatus() {
    try {
      const bankData = storageService.get('v30_bank', [], { migrateLegacy: false, throwOnError: true });
      const userAnswers = storageService.get('v30_user_answers', {}, { migrateLegacy: false, throwOnError: true });
      refreshBankWithData(bankData, userAnswers);
    } catch (error) {
      logger.warn('[刷题中心] 原题库暂不可读取，原资料保留', error);
      refreshBankWithData([], {});
    }
  }

  /**
   * 刷新题库状态（传入已读取的数据，避免重复读 storage）
   */
  function refreshBankWithData(bankFromService, userAnswers) {
    if (!_hasLoadedOnce) {
      isPageLoading.value = true;
    }
    logger.log('[刷题中心] 开始刷新题库状态');

    try {
      const ownedBank = (getUserId() || '') === owner && Array.isArray(bankFromService) ? bankFromService : [];
      const bank = ownedBank.filter((record) => !isSeededPracticeRecord(record));

      hasBank.value = bank.length > 0;
      totalQuestions.value = bank.length;

      logger.log('[刷题中心] 题库状态更新:', {
        hasBank: hasBank.value,
        totalQuestions: totalQuestions.value
      });

      // 计算学习进度
      const realIds = new Set(bank.map((question) => String(question?.id ?? question?._id)));
      const doneCount = Object.keys(userAnswers || {}).filter(
        (id) => bank.length === ownedBank.length || realIds.has(id)
      ).length;
      progressPercent.value = bank.length > 0 ? Math.round((doneCount / bank.length) * 100) : 0;
    } catch (err) {
      logger.error('[刷题中心] 刷新题库状态异常:', err);
    } finally {
      isPageLoading.value = false;
    }
    _hasLoadedOnce = true;
  }

  /**
   * 检查生成状态（传入已读取的 importedFiles 数据）
   * @param {Array} importedFiles - 已导入的文件列表
   * @param {boolean} isLooping - 当前是否正在循环生成
   * @param {Function} startProgressTimer - 启动进度定时器的回调
   * @param {number|null} progressTimer - 当前进度定时器 ID
   */
  function checkGenerationWithData(importedFiles, { isLooping, startProgressTimer, progressTimer }) {
    const generatingFile = (importedFiles || []).find((f) => f.status === 'generating');

    if (generatingFile && isLooping) {
      isGeneratingQuestions.value = true;
      if (startProgressTimer) startProgressTimer();
    } else {
      isGeneratingQuestions.value = false;
      if (progressTimer) {
        clearInterval(progressTimer);
      }
    }
  }

  return {
    // 响应式状态
    hasBank,
    totalQuestions,
    progressPercent,
    isPageLoading,
    isGeneratingQuestions,
    // 方法
    refreshBankStatus,
    refreshBankWithData,
    checkGenerationWithData
  };
}
