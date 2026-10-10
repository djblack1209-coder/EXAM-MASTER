/**
 * 刷题核心引擎 Composable
 *
 * 封装题目加载、选项选择、导航切换、答案判定等核心逻辑。
 * 从 do-quiz.vue Options API 提取，供未来 <script setup> 迁移使用。
 *
 * @module composables/useQuizEngine
 * @example
 *   const engine = useQuizEngine({ smartPicker: true, adaptiveMode: true });
 *   engine.loadQuestions();
 *   engine.selectOption(2);
 *   engine.toNext();
 */

import { ref, computed } from 'vue';
import { storageService } from '@/services/storageService.js';
import { pickQuestions } from '@/pages/practice-sub/utils/smart-question-picker.js';
import { generateAdaptiveSequence, getNextRecommendedQuestion } from '@/utils/learning/adaptive-learning-engine.js';
import { logger } from '@/utils/logger.js';
import {
  buildQuizCompletionContent,
  getQuizOptionLabel,
  isCorrectQuizOption,
  normalizeQuizQuestion,
  prepareQuizQuestion,
  prepareQuizSelection,
  QUIZ_REVIEW_HANDOFF_KEY,
  readQuizReviewHandoff,
  readSinglePracticeHandoff
} from '@/services/quiz-session-contract.js';
import { getUserId } from '@/services/auth-storage.js';

/**
 * @param {Object} [options]
 * @param {boolean} [options.smartPicker=true] - 启用智能组题
 * @param {boolean} [options.adaptiveMode=true] - 启用自适应学习
 * @param {number}  [options.maxQuestions=20] - 单次最大题数
 * @param {number}  [options.reviewRatio=0.2] - 复习题占比
 */
export function useQuizEngine(options = {}) {
  const { smartPicker = true, adaptiveMode = true, maxQuestions = 20, reviewRatio = 0.2 } = options;

  // ---- reactive state ----
  const questions = ref([]);
  const currentIndex = ref(0);
  const userChoice = ref(null);
  const hasAnswered = ref(false);
  const resultStatus = ref(''); // 'correct' | 'wrong'
  const showResult = ref(false);
  const isNavigating = ref(false);
  const answerStartTime = ref(0);

  // ---- computed ----

  /** 当前题目（数据归一化） */
  const currentQuestion = computed(() => {
    const q = questions.value[currentIndex.value];
    if (!q) return null;
    return normalizeQuizQuestion(q, currentIndex.value, {
      defaultQuestion: '题目加载中...'
    });
  });

  /** 完成弹窗文案（由外部传入 answeredQuestions 计算） */
  function getCompleteModalContent(answeredQuestions, diagnosisLoading, diagnosisReady, diagnosisSummary) {
    return buildQuizCompletionContent({
      questions: questions.value,
      answeredQuestions,
      diagnosisLoading,
      diagnosisReady,
      diagnosisSummary
    });
  }

  // ---- helpers ----

  /** 从选项文本提取标签 A/B/C/D */
  function getOptionLabel(idx) {
    return getQuizOptionLabel(currentQuestion.value, idx);
  }

  /** 判断某选项是否为正确答案 */
  function isCorrectOption(idx) {
    return isCorrectQuizOption(currentQuestion.value, idx);
  }

  /** 加载时保存原件；指定题缺失时不切换为普通组题。 */
  function loadQuestions(params = {}) {
    const { mode = 'normal', singleId = '', reviewId = '', paperId = '' } = params;
    questions.value = [];
    const accept = (selected, key) => {
      if (!selected) return false;
      questions.value = selected;
      if (key) storageService.remove(key);
      answerStartTime.value = Date.now();
      return true;
    };
    if (mode === 'single') {
      let raw;
      try {
        raw = storageService.get('temp_practice_question', null, { migrateLegacy: false, throwOnError: true });
      } catch (_error) {
        return false;
      }
      return accept(readSinglePracticeHandoff(raw, singleId, getUserId() || ''), 'temp_practice_question');
    }
    if (mode === 'temp_bank') {
      return accept(
        prepareQuizSelection(storageService.get('temp_practice_questions', [], { migrateLegacy: false })),
        'temp_practice_questions'
      );
    }
    if (mode === 'smart_review') {
      try {
        const saved = storageService.get(QUIZ_REVIEW_HANDOFF_KEY, null, { migrateLegacy: false, throwOnError: true });
        return accept(readQuizReviewHandoff(saved, reviewId, getUserId() || '', paperId));
      } catch (_error) {
        return false;
      }
    }
    const bank = storageService.get('v30_bank', [], { migrateLegacy: false });
    let list = Array.isArray(bank) ? bank.map(prepareQuizQuestion).filter(Boolean) : [];

    if (smartPicker && list.length > 0) {
      list = pickQuestions(list, {
        count: Math.min(list.length, maxQuestions),
        mode: 'adaptive',
        includeReview: true,
        reviewRatio
      });
    } else if (adaptiveMode && list.length > 0) {
      list = generateAdaptiveSequence(list, {
        insertReviewQuestions: true,
        prioritizeWeak: true,
        maxReviewRatio: 0.3
      });
    }

    questions.value = list;
    answerStartTime.value = Date.now();
    return list.length > 0;
  }

  /**
   * 选择选项（仅设置状态，不触发副作用）
   * @param {number} idx - 选项索引
   * @returns {{ isCorrect: boolean } | null} 答题结果，已答过返回 null
   */
  function selectOption(idx) {
    if (showResult.value || hasAnswered.value) return null;
    userChoice.value = idx;
    hasAnswered.value = true;
    const correct = isCorrectOption(idx);
    resultStatus.value = correct ? 'correct' : 'wrong';
    return { isCorrect: correct };
  }

  /**
   * 进入下一题
   * @returns {'next'|'complete'|'blocked'} 导航结果
   */
  function toNext() {
    if (isNavigating.value) return 'blocked';
    isNavigating.value = true;

    showResult.value = false;

    if (currentIndex.value < questions.value.length - 1) {
      // 自适应模式：检查是否插入复习题
      if (adaptiveMode) {
        const rec = getNextRecommendedQuestion(currentIndex.value, questions.value);
        if (rec?.isReview) {
          questions.value.splice(currentIndex.value + 1, 0, rec.question);
          logger.log('[useQuizEngine] 插入复习题:', rec.reason);
        }
      }
      currentIndex.value++;
      resetQuestionState();
      setTimeout(() => {
        isNavigating.value = false;
      }, 300);
      return 'next';
    }

    // 已到最后一题
    setTimeout(() => {
      isNavigating.value = false;
    }, 300);
    return 'complete';
  }

  /** 跳转到上一题 */
  function goToPrev() {
    if (currentIndex.value > 0 && !hasAnswered.value) {
      currentIndex.value--;
      resetQuestionState();
    }
  }

  /**
   * 跳转到指定题目
   * @param {number} index
   */
  function jumpToQuestion(index) {
    if (index >= 0 && index < questions.value.length) {
      currentIndex.value = index;
      resetQuestionState();
    }
  }

  /** 重置当前题目的作答状态 */
  function resetQuestionState() {
    hasAnswered.value = false;
    userChoice.value = null;
    showResult.value = false;
    resultStatus.value = '';
    answerStartTime.value = Date.now();
  }

  return {
    // state
    questions,
    currentIndex,
    userChoice,
    hasAnswered,
    resultStatus,
    showResult,
    isNavigating,
    answerStartTime,
    // computed
    currentQuestion,
    // methods
    loadQuestions,
    selectOption,
    toNext,
    goToPrev,
    jumpToQuestion,
    resetQuestionState,
    getOptionLabel,
    isCorrectOption,
    getCompleteModalContent
  };
}
