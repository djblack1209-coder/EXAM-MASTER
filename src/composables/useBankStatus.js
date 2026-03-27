/**
 * useBankStatus — 题库状态管理
 * 从 practice/index.vue 提取的题库刷新、备份恢复、生成状态检测逻辑
 */
import { ref } from 'vue';
import { storageService } from '@/services/storageService.js';
import { logger } from '@/utils/logger.js';
import { toast } from '@/utils/toast.js';

export function useBankStatus() {
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
    const bankData = storageService.get('v30_bank', []);
    const userAnswers = storageService.get('v30_user_answers', {});
    refreshBankWithData(bankData, userAnswers);
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
      let bank = bankFromService;

      // 仅在数据为空时才尝试备份恢复
      if (!bank || bank.length === 0) {
        const bankFromUni = storageService.get('v30_bank', []);
        if (bankFromUni.length > 0) {
          bank = bankFromUni;
        } else {
          logger.warn('[刷题中心] 题库数据为空，尝试从备份恢复...');
          bank = _tryRestoreFromBackup() || [];
        }
      }

      hasBank.value = bank.length > 0;
      totalQuestions.value = bank.length;

      logger.log('[刷题中心] 题库状态更新:', {
        hasBank: hasBank.value,
        totalQuestions: totalQuestions.value
      });

      // 计算学习进度
      const doneCount = Object.keys(userAnswers || {}).length;
      progressPercent.value = bank.length > 0 ? Math.round((doneCount / bank.length) * 100) : 0;
    } catch (err) {
      logger.error('[刷题中心] 刷新题库状态异常:', err);
    } finally {
      isPageLoading.value = false;
    }
    _hasLoadedOnce = true;
  }

  /**
   * 从备份恢复题库数据
   */
  function _tryRestoreFromBackup() {
    const backupKeys = ['v30_bank_backup', 'v30_bank_backup_before_clear'];

    for (const backupKey of backupKeys) {
      try {
        const backupFromUni = storageService.get(backupKey);
        const backupFromService = storageService.get(backupKey, null);

        for (const backup of [backupFromUni, backupFromService]) {
          if (!backup) continue;
          try {
            const restoredData = typeof backup === 'string' ? JSON.parse(backup) : backup;
            if (Array.isArray(restoredData) && restoredData.length > 0) {
              logger.log(`[刷题中心] 从备份恢复题库 (${backupKey}):`, restoredData.length, '道题');
              storageService.save('v30_bank', restoredData);
              toast.success(`已从备份恢复 ${restoredData.length} 道题`, 2000);
              return restoredData;
            }
          } catch (parseErr) {
            logger.warn(`[刷题中心] 解析备份失败 (${backupKey}):`, parseErr);
          }
        }
      } catch (restoreErr) {
        logger.warn(`[刷题中心] 恢复备份失败 (${backupKey}):`, restoreErr);
      }
    }

    logger.warn('[刷题中心] 所有备份都不可用');
    return null;
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
