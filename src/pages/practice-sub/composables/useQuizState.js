/**
 * 答题状态管理 Mixin
 *
 * 职责：核心答题数据、题目加载、进度保存/恢复、收藏、笔记、离线缓存、系统UI初始化
 * 使用方式：在 do-quiz.vue 中通过 mixins: [quizStateMixin] 合并
 *
 * @module composables/useQuizState
 */

import { storageService } from '@/services/storageService.js';
import { toast } from '@/utils/toast.js';
import { today as getToday } from '@/utils/date.js';
import {
  saveQuizProgress,
  loadQuizProgress,
  clearQuizProgress,
  hasUnfinishedProgress,
  getProgressSummary
} from '@/composables/useQuizAutoSave.js';
import { getStatusBarHeight, getWindowInfo } from '@/utils/core/system.js';
import { toggleFavorite, isFavorited } from '@/utils/favorite/question-favorite.js';
import { pickQuestions } from '../utils/smart-question-picker.js';
import { generateAdaptiveSequence } from '@/utils/learning/adaptive-learning-engine.js';
import { checkOfflineAvailability, offlineCache } from '@/services/offline-cache-service.js';
import { addQuestionNote, getNotesByQuestion, getNoteTags } from '../question-note.js';
import { logger } from '@/utils/logger.js';
import { safeNavigateTo } from '@/utils/safe-navigate';

export const quizStateMixin = {
  data() {
    return {
      // 题目与答题核心状态
      questions: [],
      currentIndex: 0,
      userChoice: null,
      hasAnswered: false,
      showResult: false,
      resultStatus: '', // 'correct' 或 'wrong'
      aiComment: '',
      answeredQuestions: [], // 已答题目记录（用于断点续答和统计）

      // 弹窗状态
      showEmptyBankModal: false,
      showResumeModal: false,
      resumeModalContent: '',

      // 主题与模式
      isDark: false,
      correctionMode: false, // 矫正练习模式
      isAdaptiveMode: true, // 自适应学习模式
      currentReviewQuestion: null, // 当前复习题
      smartPickerEnabled: true, // 智能组题

      // 收藏状态
      isCurrentFavorited: false,

      // 离线缓存状态
      isOfflineMode: false,
      offlineAvailable: false,

      // 题目笔记状态
      currentQuestionNotes: [],
      showNoteModal: false,
      noteContent: '',
      selectedNoteTags: [],

      // 系统UI尺寸
      statusBarHeight: 44,
      navBarHeight: 88,
      capsuleMargin: 100
    };
  },

  computed: {
    // 当前题目（数据归一化，确保模板能安全访问所有字段）
    currentQuestion() {
      const q = this.questions[this.currentIndex];
      if (!q) return null;
      return {
        id: q.id || `q_${this.currentIndex}`,
        question: q.question || q.title || '题目加载中...',
        options: Array.isArray(q.options) ? q.options : [],
        answer: (q.answer || 'A').toString().toUpperCase().charAt(0),
        desc: q.desc || q.description || q.analysis || '暂无解析',
        category: q.category || '未分类',
        type: q.type || '单选',
        difficulty: q.difficulty || 2
      };
    },

    // 判断某选项是否为正确答案（返回函数，供模板中 :class 绑定调用）
    isCorrectOption() {
      return (idx) => {
        if (!this.currentQuestion) return false;
        const correctAnswer = this.currentQuestion.answer;
        const optionLabel = this.getOptionLabel(idx);
        if (['A', 'B', 'C', 'D'].includes(correctAnswer)) {
          return optionLabel === correctAnswer;
        }
        // 兼容选项内容匹配
        const optionText = this.currentQuestion.options[idx] || '';
        return optionText.startsWith(correctAnswer) || optionText.includes(correctAnswer);
      };
    },

    // 完美全对检测（用于庆祝动画）
    isPerfectScore() {
      return (
        this.showCompleteModal && this.answeredQuestions.length > 0 && this.answeredQuestions.every((a) => a.isCorrect)
      );
    },

    // 可用的笔记标签
    availableNoteTags() {
      return getNoteTags();
    }
  },

  methods: {
    // ==================== 系统UI初始化 ====================

    // 初始化系统UI参数（状态栏高度、胶囊按钮边距等）
    initSystemUI() {
      this.statusBarHeight = getStatusBarHeight();
      this.navBarHeight = this.statusBarHeight + 44;

      // #ifdef MP-WEIXIN
      try {
        const capsule = uni.getMenuButtonBoundingClientRect();
        if (capsule && capsule.width > 0) {
          const winInfo = getWindowInfo();
          const windowWidth = winInfo.windowWidth || winInfo.screenWidth;
          this.capsuleMargin = windowWidth - capsule.left + 10;
        } else {
          this.capsuleMargin = 100;
        }
      } catch (e) {
        logger.log('获取胶囊按钮信息失败', e);
        this.capsuleMargin = 100;
      }
      // #endif
      // #ifndef MP-WEIXIN
      this.capsuleMargin = 20;
      // #endif
    },

    // ==================== 题目加载 ====================

    // 加载题目（支持单题、题库、拍照搜题、矫正、智能复习等多种模式）
    async loadQuestions() {
      // 单题练习模式：从收藏页传入
      if (this._singleMode) {
        const singleQ = storageService.get('temp_practice_question', null);
        if (singleQ) {
          this.questions = [
            {
              id: singleQ.id || 'single_q',
              question: singleQ.question,
              options:
                Array.isArray(singleQ.options) && singleQ.options.length >= 4
                  ? singleQ.options
                  : ['A. 选项A', 'B. 选项B', 'C. 选项C', 'D. 选项D'],
              answer: (singleQ.answer || 'A').toString().toUpperCase().charAt(0),
              desc: singleQ.desc || '暂无解析',
              category: singleQ.category || '未分类',
              type: '单选',
              difficulty: 2
            }
          ];
          storageService.remove('temp_practice_question');
          this.startTimer();
          return;
        }
      }

      // 题库练习模式：从题库页传入的随机练习题目
      if (this._questionBankMode) {
        const tempQuestions = storageService.get('v30_temp_practice', []);
        if (tempQuestions && tempQuestions.length > 0) {
          this.questions = tempQuestions.map((q, index) => ({
            id: q.id || `qb_${index}`,
            question: q.question || '',
            options: Array.isArray(q.options) && q.options.length >= 2 ? q.options : [],
            answer: (q.answer || 'A').toString().toUpperCase().charAt(0),
            desc: q.desc || '暂无解析',
            category: q.category || '题库',
            type: q.type || '单选',
            difficulty: q.difficulty || 2,
            source: q.source || '题库'
          }));
          storageService.remove('v30_temp_practice');
          this.startTimer();
          return;
        }
      }

      // 拍照搜题临时练习模式
      if (this._tempBankMode) {
        const tempQuestions = storageService.get('temp_practice_questions', []);
        if (tempQuestions.length > 0) {
          this.questions = tempQuestions.map((q, index) => ({
            id: q.id || `temp_${index}`,
            question: q.question || '',
            options: Array.isArray(q.options) && q.options.length >= 2 ? q.options : [],
            answer: (q.answer || 'A').toString().toUpperCase().charAt(0),
            desc: q.desc || '暂无解析',
            category: q.category || '拍照搜题',
            type: '单选',
            difficulty: q.difficulty || 2,
            source: q.source || 'temp'
          }));
          storageService.remove('temp_practice_questions');
          this.startTimer();
          return;
        }
      }

      // 矫正练习模式：从首页矫正卡片传入的指定题目
      if (this._correctionMode) {
        this.correctionMode = true;
        const ids = this._correctionQuestionIds || [];
        if (ids.length > 0) {
          const bank = storageService.get('v30_bank', []);
          const correctionQuestions = ids
            .map((id) => bank.find((q) => (q.id || q._id) === id))
            .filter(Boolean)
            .map((q, index) => ({
              id: q.id || q._id || `correction_${index}`,
              question: q.question || q.title || `题目 ${index + 1}`,
              options:
                Array.isArray(q.options) && q.options.length >= 4
                  ? q.options
                  : ['A. 选项A', 'B. 选项B', 'C. 选项C', 'D. 选项D'],
              answer: (q.answer || 'A').toString().toUpperCase().charAt(0),
              desc: q.desc || q.description || q.analysis || '暂无解析',
              category: q.category || this._correctionKP || '矫正练习',
              type: q.type || '单选',
              difficulty: q.difficulty || 2
            }));
          if (correctionQuestions.length > 0) {
            this.questions = correctionQuestions;
            this.startTimer();
            return;
          }
        }
        toast.info('矫正题目加载失败，已切换普通模式');
      }

      // 智能复习模式：从智能复习页传入的复习题目
      if (this._smartReviewMode) {
        const reviewIds = storageService.get('smart_review_ids', []);
        if (reviewIds.length > 0) {
          const bank = storageService.get('v30_bank', []);
          const reviewQuestions = reviewIds
            .map((id) => bank.find((q) => (q.id || q._id) === id))
            .filter(Boolean)
            .map((q, index) => ({
              id: q.id || q._id || `review_${index}`,
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
            }));
          if (reviewQuestions.length > 0) {
            this.questions = reviewQuestions;
            storageService.remove('smart_review_ids');
            this.startTimer();
            return;
          }
        }
        toast.info('复习题目加载失败，已切换普通模式');
      }

      // 普通模式：从本地存储读取题库
      const bank = storageService.get('v30_bank', []);

      if (!bank || bank.length === 0) {
        // 离线降级：题库为空时尝试从离线缓存获取题目
        if (!offlineCache.isOnline) {
          const cached = offlineCache.getCachedQuestions('all', 20);
          if (cached.length > 0) {
            this.questions = cached.map((q, index) => ({
              id: q.id || q._id || `offline_${index}`,
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
            }));
            this.isOfflineMode = true;
            toast.info('离线模式：使用缓存题目');
            this.answerStartTime = Date.now();
            this.updateFavoriteStatus();
            this.startQuestionTimer();
            return;
          }
        }
        this.showEmptyBankModal = true;
        return;
      }

      // 验证并标准化题目数据
      let questions = bank
        .map((q, index) => ({
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
        }))
        .filter((q) => q.question && !/^题目 \d+$/.test(q.question));

      // 使用智能组题算法优化题目序列
      if (this.smartPickerEnabled && questions.length > 0) {
        questions = pickQuestions(questions, {
          count: Math.min(questions.length, 20),
          mode: 'adaptive',
          includeReview: true,
          reviewRatio: 0.2
        });
        logger.log('[do-quiz] ✅ 智能组题模式已启用');
      } else if (this.isAdaptiveMode && questions.length > 0) {
        questions = generateAdaptiveSequence(questions, {
          insertReviewQuestions: true,
          prioritizeWeak: true,
          maxReviewRatio: 0.3
        });
        logger.log('[do-quiz] ✅ 自适应学习模式已启用，题目序列已优化');
      }

      this.questions = questions;

      // 离线缓存：将获取到的题目缓存供无网络时使用
      if (this.questions.length > 0) {
        try {
          const category = this.questions[0]?.category || 'all';
          offlineCache.cacheQuestions(this.questions, category);
        } catch (_e) {
          /* 缓存失败不影响主流程 */
        }
      }

      if (this.questions.length === 0) {
        this.showEmptyBankModal = true;
      }

      // 记录答题开始时间
      this.answerStartTime = Date.now();
      // 更新当前题目的收藏状态
      this.updateFavoriteStatus();
      // 启动单题计时器
      this.startQuestionTimer();
    },

    // 从选项文本中提取标签（如 "A. 选项内容" -> "A"）
    getOptionLabel(idx) {
      if (!this.currentQuestion || !this.currentQuestion.options) return '';
      const option = this.currentQuestion.options[idx] || '';
      const match = option.match(/^([A-D])\./);
      if (match) {
        return match[1].toUpperCase();
      }
      return ['A', 'B', 'C', 'D'][idx] || 'A';
    },

    // 恢复错题复习模式前的题库
    _restoreQuestionBankIfReview() {
      try {
        const isReview = storageService.get('is_review_mode', false);
        if (isReview) {
          const backup = storageService.get('v30_bank_backup', []);
          if (backup.length > 0) {
            storageService.save('v30_bank', backup);
          }
          storageService.remove('is_review_mode');
          storageService.remove('v30_bank_backup');
          storageService.remove('temp_review_questions');
        }
      } catch (_e) {
        // 静默处理，不影响页面退出
      }
    },

    // ==================== 进度管理 ====================

    // 检查是否有未完成的答题进度
    checkUnfinishedProgress() {
      if (hasUnfinishedProgress()) {
        const summary = getProgressSummary();
        if (summary && summary.currentIndex > 0) {
          this.resumeModalContent = `上次答到第 ${summary.currentIndex + 1} 题，用时 ${summary.formattedTime}（${summary.timeAgo}保存）。是否继续？`;
          this.showResumeModal = true;
        } else {
          this.startTimer();
        }
      } else {
        this.startTimer();
      }
    },

    // 从本地恢复之前的答题进度
    restoreProgress() {
      const progress = loadQuizProgress();
      if (progress) {
        this.currentIndex = progress.currentIndex || 0;
        this.seconds = progress.seconds || 0;
        this.answeredQuestions = progress.answeredQuestions || [];
        this.aiComment = progress.aiComment || '';

        // 如果上次已作答但未进入下一题，重置作答状态
        this.hasAnswered = false;
        this.userChoice = null;
        this.showResult = false;

        logger.log('[do-quiz] ✅ 进度已恢复:', {
          currentIndex: this.currentIndex,
          seconds: this.seconds,
          answeredCount: this.answeredQuestions.length
        });

        toast.success('进度已恢复');
      }
      this.startTimer();
    },

    // 保存当前答题进度（支持即时保存和延迟保存）
    saveCurrentProgress(immediate = false) {
      // 只有在有题目且已开始答题时才保存
      if (this.questions.length === 0 || (this.currentIndex === 0 && !this.hasAnswered)) {
        return;
      }

      // 如果已完成所有题目，清除进度
      if (this.currentIndex >= this.questions.length - 1 && this.hasAnswered) {
        clearQuizProgress();
        logger.log('[do-quiz] 练习已完成，清除进度');
        return;
      }

      const success = saveQuizProgress(
        {
          currentIndex: this.currentIndex,
          userChoice: this.userChoice,
          hasAnswered: this.hasAnswered,
          seconds: this.seconds,
          aiComment: this.aiComment,
          answeredQuestions: this.answeredQuestions
        },
        immediate
      );

      if (success) {
        logger.log('[do-quiz] ✅ 进度已自动保存');
      }
    },

    // ==================== 学习统计 ====================

    // 更新学习热力图和每日答题计数
    updateStudyStats() {
      const todayStr = getToday();
      const stats = storageService.get('study_stats', {});
      stats[todayStr] = (stats[todayStr] || 0) + 1;
      storageService.save('study_stats', stats);

      // 更新今日答题计数（驱动首页每日目标环）
      const todayCount = parseInt(storageService.get('today_answer_count', '0'));
      const todayDate = storageService.get('today_answer_date', '');
      if (todayDate !== todayStr) {
        storageService.save('today_answer_count', '1');
        storageService.save('today_answer_date', todayStr);
      } else {
        storageService.save('today_answer_count', String(todayCount + 1));
      }
    },

    // ==================== 收藏功能 ====================

    // 切换当前题目的收藏状态
    handleToggleFavorite() {
      if (!this.currentQuestion) return;

      const result = toggleFavorite(this.currentQuestion);
      this.isCurrentFavorited = !this.isCurrentFavorited;

      try {
        if (typeof uni.vibrateShort === 'function') {
          uni.vibrateShort({ type: 'light' });
        }
      } catch {
        /* ignore */
      }

      logger.log('[do-quiz] ✅ 收藏状态切换:', result);
    },

    // 更新当前题目的收藏状态
    updateFavoriteStatus() {
      if (this.currentQuestion) {
        this.isCurrentFavorited = isFavorited(this.currentQuestion.id || this.currentQuestion.question);
      }
    },

    // ==================== 笔记功能 ====================

    // 打开笔记弹窗并加载当前题目的笔记
    handleOpenNote() {
      if (!this.currentQuestion) return;
      this.currentQuestionNotes = getNotesByQuestion(this.currentQuestion.id || this.currentQuestion.question);
      this.noteContent = '';
      this.selectedNoteTags = [];
      this.showNoteModal = true;
    },

    // 切换笔记标签选中状态
    toggleNoteTag(tagId) {
      const index = this.selectedNoteTags.indexOf(tagId);
      if (index >= 0) {
        this.selectedNoteTags.splice(index, 1);
      } else {
        this.selectedNoteTags.push(tagId);
      }
    },

    // 保存当前笔记
    handleSaveNote() {
      if (!this.noteContent.trim()) {
        toast.info('请输入笔记内容');
        return;
      }

      const result = addQuestionNote({
        questionId: this.currentQuestion.id || this.currentQuestion.question,
        questionContent: this.currentQuestion.question,
        content: this.noteContent.trim(),
        tags: this.selectedNoteTags,
        category: this.currentQuestion.category
      });

      if (result.success) {
        toast.success('笔记已保存');
        this.currentQuestionNotes = getNotesByQuestion(this.currentQuestion.id || this.currentQuestion.question);
        this.showNoteModal = false;
        this.noteContent = '';
        this.selectedNoteTags = [];
      } else {
        toast.info('保存失败');
      }
    },

    // 更新当前题目的笔记列表
    updateQuestionNotes() {
      if (this.currentQuestion) {
        this.currentQuestionNotes = getNotesByQuestion(this.currentQuestion.id || this.currentQuestion.question);
      }
    },

    // ==================== 离线缓存 ====================

    // 检查离线数据可用性
    checkOfflineData() {
      const status = checkOfflineAvailability();
      this.offlineAvailable = status.available;
      this.isOfflineMode = !status.isOnline && status.available;

      if (this.isOfflineMode) {
        toast.info('已切换到离线模式');
      }

      logger.log('[do-quiz] 离线状态:', status);
    },

    // ==================== 弹窗处理 ====================

    // 题库为空时点击确认 → 跳转到导入数据页面
    handleEmptyBankConfirm() {
      this.showEmptyBankModal = false;
      safeNavigateTo('/pages/practice-sub/import-data');
    },

    // 恢复进度确认
    handleResumeConfirm() {
      this.showResumeModal = false;
      this.restoreProgress();
    },

    // 恢复进度取消（重新开始）
    handleResumeCancel() {
      this.showResumeModal = false;
      clearQuizProgress();
      this.startTimer();
    }
  }
};
