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
    return {
      id: q.id || `q_${currentIndex.value}`,
      question: q.question || q.title || '题目加载中...',
      options: Array.isArray(q.options) ? q.options : [],
      answer: (q.answer || 'A').toString().toUpperCase().charAt(0),
      desc: q.desc || q.description || q.analysis || '暂无解析',
      category: q.category || '未分类',
      type: q.type || '单选',
      difficulty: q.difficulty || 2
    };
  });

  /** 完成弹窗文案（由外部传入 answeredQuestions 计算） */
  function getCompleteModalContent(answeredQuestions, diagnosisLoading, diagnosisReady, diagnosisSummary) {
    const total = questions.value.length;
    const correct = answeredQuestions.filter((a) => a.isCorrect).length;
    const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;
    const base = `本次完成 ${total} 题，正确率 ${accuracy}%`;
    if (diagnosisLoading) return `${base}\n\nAI 正在分析你的答题数据...`;
    if (diagnosisReady && diagnosisSummary) return `${base}\n\n${diagnosisSummary}`;
    return `${base}\n\n点击查看 AI 诊断报告`;
  }

  // ---- helpers ----

  /** 从选项文本提取标签 A/B/C/D */
  function getOptionLabel(idx) {
    if (!currentQuestion.value?.options) return '';
    const option = currentQuestion.value.options[idx] || '';
    const match = option.match(/^([A-D])\./);
    return match ? match[1].toUpperCase() : ['A', 'B', 'C', 'D'][idx] || 'A';
  }

  /** 判断某选项是否为正确答案 */
  function isCorrectOption(idx) {
    if (!currentQuestion.value) return false;
    const correctAnswer = currentQuestion.value.answer;
    const optionLabel = getOptionLabel(idx);
    if (['A', 'B', 'C', 'D'].includes(correctAnswer)) {
      return optionLabel === correctAnswer;
    }
    const optionText = currentQuestion.value.options[idx] || '';
    return optionText.startsWith(correctAnswer) || optionText.includes(correctAnswer);
  }

  /** 标准化单个题目对象 */
  function _normalizeQuestion(q, index) {
    return {
      id: q.id || `q_${index}`,
      question: q.question || q.title || `题目 ${index + 1}`,
      options:
        Array.isArray(q.options) && q.options.length >= 4
          ? q.options
          : ['A. 选项A', 'B. 选项B', 'C. 选项C', 'D. 选项D'],
      answer: (q.answer || 'A').toString().toUpperCase().charAt(0),
      desc: q.desc || q.description || q.analysis || '暂无解析',
      category: q.category || '未分类',
      type: q.type || '单选',
      difficulty: q.difficulty || 2
    };
  }

  // ---- core methods ----

  /**
   * 加载题目（支持 single / smart_review / 普通模式）
   * @param {Object} [params]
   * @param {'normal'|'single'|'smart_review'} [params.mode='normal']
   * @returns {boolean} 是否成功加载到题目
   */
  function loadQuestions(params = {}) {
    const { mode = 'normal' } = params;

    // 单题模式
    if (mode === 'single') {
      const singleQ = storageService.get('temp_practice_question', null);
      if (singleQ) {
        questions.value = [_normalizeQuestion(singleQ, 0)];
        storageService.remove('temp_practice_question');
        answerStartTime.value = Date.now();
        return true;
      }
      return false;
    }

    // 智能复习模式
    if (mode === 'smart_review') {
      const reviewIds = uni.getStorageSync('smart_review_ids') || [];
      if (reviewIds.length > 0) {
        const bank = storageService.get('v30_bank', []);
        const reviewQuestions = reviewIds
          .map((id) => bank.find((q) => (q.id || q._id) === id))
          .filter(Boolean)
          .map((q, i) => _normalizeQuestion(q, i));
        if (reviewQuestions.length > 0) {
          questions.value = reviewQuestions;
          uni.removeStorageSync('smart_review_ids');
          answerStartTime.value = Date.now();
          return true;
        }
      }
      // 回退到普通模式
    }

    // 普通模式：从本地题库加载
    const bank = storageService.get('v30_bank', []);
    if (!bank || bank.length === 0) return false;

    let list = bank.map((q, i) => _normalizeQuestion(q, i)).filter((q) => q.question && !/^题目 \d+$/.test(q.question));

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
