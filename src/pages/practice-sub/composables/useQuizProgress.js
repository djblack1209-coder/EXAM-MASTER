/**
 * 答题进度管理 Composable
 *
 * 封装进度检查、恢复、自动保存、清除等逻辑。
 * 从 do-quiz.vue Options API 提取，供 <script setup> 迁移使用。
 *
 * @module composables/useQuizProgress
 * @example
 *   const progress = useQuizProgress();
 *   progress.checkUnfinishedProgress('math', 'algebra');
 *   progress.saveCurrentProgress({ currentIndex: 3, questions, answeredQuestions, seconds: 120, category: 'math', subCategory: 'algebra' });
 */

import { ref, onUnmounted } from 'vue';
import {
  saveQuizProgress,
  loadQuizProgress,
  clearQuizProgress,
  hasUnfinishedProgress,
  getProgressSummary
} from '@/composables/useQuizAutoSave.js';

/** 自动保存去抖延迟（毫秒） */
const SAVE_DEBOUNCE_DELAY = 1000;

/**
 * 答题进度管理 composable
 *
 * @returns {{
 *   showResumeModal: import('vue').Ref<boolean>,
 *   resumeModalContent: import('vue').Ref<string>,
 *   checkUnfinishedProgress: (category?: string, subCategory?: string) => boolean,
 *   restoreProgress: (refs: { currentIndex: import('vue').Ref<number>, questions: import('vue').Ref<Array>, answeredQuestions: import('vue').Ref<Array>, seconds: import('vue').Ref<number> }) => boolean,
 *   saveCurrentProgress: (params: { currentIndex: number, questions: Array, answeredQuestions: Array, seconds: number, category?: string, subCategory?: string }) => void,
 *   clearProgress: () => boolean,
 *   handleResumeConfirm: () => string,
 *   handleResumeCancel: () => string,
 * }}
 */
export function useQuizProgress() {
  // ---- 响应式状态 ----

  /** 是否显示恢复进度弹窗 */
  const showResumeModal = ref(false);

  /** 恢复弹窗的提示文本 */
  const resumeModalContent = ref('');

  // ---- 内部变量 ----

  /** @type {ReturnType<typeof setTimeout>|null} 去抖定时器 ID */
  let _saveDebounceTimer = null;

  // ---- 方法 ----

  /**
   * 检查是否有未完成的答题进度
   *
   * 如果有未完成进度，会自动设置弹窗内容并显示恢复弹窗。
   *
   * @param {string} [_category] - 题目分类（预留参数，当前底层 API 未使用）
   * @param {string} [_subCategory] - 题目子分类（预留参数，当前底层 API 未使用）
   * @returns {boolean} 是否有未完成进度
   */
  function checkUnfinishedProgress(_category, _subCategory) {
    // 底层 API 当前不区分分类，category / subCategory 为预留参数
    const hasProgress = hasUnfinishedProgress();

    if (hasProgress) {
      const summary = getProgressSummary();
      if (summary) {
        resumeModalContent.value =
          `检测到${summary.timeAgo}的答题记录：` +
          `已答 ${summary.answeredCount} 题，` +
          `用时 ${summary.formattedTime}，是否继续？`;
      } else {
        resumeModalContent.value = '检测到未完成的答题记录，是否继续？';
      }
      showResumeModal.value = true;
    }

    return hasProgress;
  }

  /**
   * 恢复已保存的答题进度
   *
   * 将存档数据写入传入的各个 ref，实现状态恢复。
   *
   * @param {{
   *   currentIndex: import('vue').Ref<number>,
   *   questions: import('vue').Ref<Array>,
   *   answeredQuestions: import('vue').Ref<Array>,
   *   seconds: import('vue').Ref<number>,
   * }} refs - 需要恢复的响应式引用对象
   * @returns {boolean} 是否恢复成功
   */
  function restoreProgress({ currentIndex, questions, answeredQuestions, seconds }) {
    const progress = loadQuizProgress();

    if (!progress) {
      return false;
    }

    // 逐个恢复 ref 的值
    if (typeof progress.currentIndex === 'number') {
      currentIndex.value = progress.currentIndex;
    }
    if (Array.isArray(progress.questions)) {
      questions.value = progress.questions;
    }
    if (Array.isArray(progress.answeredQuestions)) {
      answeredQuestions.value = progress.answeredQuestions;
    }
    if (typeof progress.seconds === 'number') {
      seconds.value = progress.seconds;
    }

    return true;
  }

  /**
   * 保存当前答题进度（带 1 秒去抖）
   *
   * 连续调用时只有最后一次生效，避免频繁写入存储。
   *
   * @param {{
   *   currentIndex: number,
   *   questions: Array,
   *   answeredQuestions: Array,
   *   seconds: number,
   *   category?: string,
   *   subCategory?: string,
   * }} params - 需要保存的进度数据
   */
  function saveCurrentProgress({ currentIndex, questions, answeredQuestions, seconds, category, subCategory }) {
    // 清除上一次的去抖定时器
    if (_saveDebounceTimer !== null) {
      clearTimeout(_saveDebounceTimer);
    }

    _saveDebounceTimer = setTimeout(() => {
      saveQuizProgress({
        currentIndex,
        questions,
        answeredQuestions,
        seconds,
        category,
        subCategory,
        savedAt: Date.now()
      });
      _saveDebounceTimer = null;
    }, SAVE_DEBOUNCE_DELAY);
  }

  /**
   * 清除已保存的答题进度
   *
   * @returns {boolean} 是否清除成功
   */
  function clearProgress() {
    return clearQuizProgress();
  }

  /**
   * 用户确认恢复进度
   *
   * 关闭弹窗并返回 'resume' 标识。
   *
   * @returns {string} 'resume'
   */
  function handleResumeConfirm() {
    showResumeModal.value = false;
    return 'resume';
  }

  /**
   * 用户取消恢复（重新开始）
   *
   * 关闭弹窗、清除存档并返回 'restart' 标识。
   *
   * @returns {string} 'restart'
   */
  function handleResumeCancel() {
    showResumeModal.value = false;
    clearQuizProgress();
    return 'restart';
  }

  // 组件卸载时清除去抖定时器，防止内存泄漏
  onUnmounted(() => {
    if (_saveDebounceTimer !== null) {
      clearTimeout(_saveDebounceTimer);
      _saveDebounceTimer = null;
    }
  });

  return {
    // 响应式状态
    showResumeModal,
    resumeModalContent,

    // 方法
    checkUnfinishedProgress,
    restoreProgress,
    saveCurrentProgress,
    clearProgress,
    handleResumeConfirm,
    handleResumeCancel
  };
}
