<template>
  <view :class="['container', { 'dark-mode': isDark, 'wot-theme-dark': isDark }]">
    <!-- 顶部导航 -->
    <view class="nav-bar" :style="{ paddingTop: statusBarHeight + 'px' }">
      <view class="nav-content">
        <view class="back-btn" @tap="handleBack">
          <BaseIcon name="arrow-left" :size="36" />
        </view>
        <text class="nav-title">
          {{ isExamStarted ? '模拟考试' : '考试设置' }}
        </text>
        <view v-if="isExamStarted && !isExamFinished" class="timer-display">
          <view class="timer-icon">
            <BaseIcon name="timer" :size="28" />
          </view>
          <text class="timer-text">
            {{ formatTime(remainingTime) }}
          </text>
        </view>
      </view>
    </view>

    <!-- 考试设置页面 -->
    <view
      v-if="!isExamStarted && !isPageLoading"
      id="e2e-mock-setup"
      class="setup-container"
      :style="{ paddingTop: statusBarHeight + 50 + 'px' }"
    >
      <view class="glass-card setup-card">
        <text class="setup-title"> <BaseIcon name="note" :size="32" /> 模拟考试设置 </text>

        <view class="setting-item">
          <text class="setting-label"> 题目数量 </text>
          <view class="setting-options">
            <view
              v-for="num in [10, 20, 30, 50]"
              :id="`e2e-mock-count-${num}`"
              :key="num"
              :class="['option-btn', { active: questionCount === num }]"
              @tap="questionCount = num"
            >
              <text>{{ num }}题</text>
            </view>
          </view>
        </view>

        <view class="setting-item">
          <text class="setting-label"> 考试时长 </text>
          <view class="setting-options">
            <view
              v-for="time in [15, 30, 45, 60]"
              :key="time"
              :class="['option-btn', { active: examDuration === time }]"
              @tap="examDuration = time"
            >
              <text>{{ time }}分钟</text>
            </view>
          </view>
        </view>

        <view class="setting-item">
          <text class="setting-label"> 题目类型 </text>
          <view class="setting-options">
            <view :class="['option-btn', { active: questionType === 'all' }]" @tap="questionType = 'all'">
              <text>全部</text>
            </view>
            <view :class="['option-btn', { active: questionType === 'mistakes' }]" @tap="questionType = 'mistakes'">
              <text>错题</text>
            </view>
          </view>
        </view>

        <view class="exam-info">
          <text class="info-text"> <BaseIcon name="chart-bar" :size="28" /> 当前题库共 {{ totalQuestions }} 道题 </text>
        </view>

        <button
          id="e2e-mock-start-btn"
          class="start-btn"
          hover-class="btn-scale-sm"
          :disabled="totalQuestions < questionCount"
          @tap="startExam"
        >
          <view class="btn-icon">
            <BaseIcon name="rocket" :size="32" />
          </view>
          <text class="btn-text"> 开始考试 </text>
        </button>
      </view>
    </view>

    <!-- 骨架屏加载状态 -->
    <!-- #ifdef APP-PLUS -->
    <view v-if="isPageLoading" class="setup-container" :style="{ paddingTop: statusBarHeight + 50 + 'px' }">
      <view class="glass-card setup-card">
        <view class="skeleton-title skeleton-animate" />
        <view v-for="i in 4" :key="i" class="skeleton-setting">
          <view class="skeleton-label skeleton-animate" />
          <view class="skeleton-options">
            <view v-for="j in 4" :key="j" class="skeleton-option skeleton-animate" />
          </view>
        </view>
        <view class="skeleton-btn skeleton-animate" />
      </view>
    </view>
    <!-- #endif -->
    <!-- #ifndef APP-PLUS -->
    <!-- #ifndef APP-NVUE -->
    <transition name="skeleton-fade">
      <view v-if="isPageLoading" class="setup-container" :style="{ paddingTop: statusBarHeight + 50 + 'px' }">
        <view class="glass-card setup-card">
          <view class="skeleton-title skeleton-animate" />
          <view v-for="i in 4" :key="i" class="skeleton-setting">
            <view class="skeleton-label skeleton-animate" />
            <view class="skeleton-options">
              <view v-for="j in 4" :key="j" class="skeleton-option skeleton-animate" />
            </view>
          </view>
          <view class="skeleton-btn skeleton-animate" />
        </view>
      </view>
    </transition>
    <!-- #endif -->
    <!-- #ifdef APP-NVUE -->
    <view v-if="isPageLoading" class="setup-container" :style="{ paddingTop: statusBarHeight + 50 + 'px' }">
      <view class="glass-card setup-card">
        <view class="skeleton-title skeleton-animate" />
        <view v-for="i in 4" :key="i" class="skeleton-setting">
          <view class="skeleton-label skeleton-animate" />
          <view class="skeleton-options">
            <view v-for="j in 4" :key="j" class="skeleton-option skeleton-animate" />
          </view>
        </view>
        <view class="skeleton-btn skeleton-animate" />
      </view>
    </view>
    <!-- #endif -->
    <!-- #endif -->

    <!-- 考试进行中 -->
    <scroll-view
      v-if="isExamStarted && !isExamFinished"
      scroll-y
      class="exam-container"
      :style="{ paddingTop: statusBarHeight + 50 + 'px' }"
    >
      <!-- 进度条 -->
      <view class="progress-bar">
        <view class="progress-fill" :style="{ width: progressPercent + '%' }" />
      </view>
      <text id="e2e-mock-progress" class="progress-text"> {{ currentIndex + 1 }} / {{ examQuestions.length }} </text>

      <!-- 当前题目 -->
      <view v-if="currentQuestion" class="glass-card question-card">
        <text class="question-number"> 第 {{ currentIndex + 1 }} 题 </text>
        <text id="e2e-mock-question-text" class="question-text">
          {{ currentQuestion.question || currentQuestion.question_content }}
        </text>

        <view class="options-list">
          <view
            v-for="(opt, idx) in currentQuestion.options"
            :id="`e2e-mock-option-${idx}`"
            :key="idx"
            :class="['option-item', { selected: userAnswers[currentIndex] === idx }]"
            @tap="selectAnswer(idx)"
          >
            <text class="option-label">
              {{ ['A', 'B', 'C', 'D'][idx] }}
            </text>
            <text class="option-text">
              {{ opt }}
            </text>
          </view>
        </view>
      </view>

      <!-- 导航按钮 -->
      <view class="nav-buttons">
        <button
          id="e2e-mock-prev-btn"
          class="nav-btn prev"
          hover-class="btn-scale-sm"
          :disabled="currentIndex === 0 || isNavigating"
          @tap="prevQuestion"
        >
          上一题
        </button>
        <button
          v-if="currentIndex < examQuestions.length - 1"
          id="e2e-mock-next-btn"
          class="nav-btn next"
          hover-class="btn-scale-sm"
          :disabled="isNavigating"
          @tap="nextQuestion"
        >
          下一题
        </button>
        <button
          v-else
          id="e2e-mock-submit-btn"
          class="nav-btn submit"
          hover-class="btn-scale-sm"
          :disabled="isSubmitting"
          @tap="submitExam"
        >
          {{ isSubmitting ? '提交中...' : '提交试卷' }}
        </button>
      </view>

      <!-- 答题卡 -->
      <view class="answer-sheet">
        <text class="sheet-title"> 答题卡 </text>
        <view class="sheet-grid">
          <view
            v-for="(q, idx) in examQuestions"
            :key="idx"
            :class="[
              'sheet-item',
              {
                answered: userAnswers[idx] !== undefined,
                current: idx === currentIndex
              }
            ]"
            @tap="jumpToQuestion(idx)"
          >
            <text>{{ idx + 1 }}</text>
          </view>
        </view>
      </view>

      <view class="safe-area" />
    </scroll-view>

    <!-- 考试结果 -->
    <scroll-view
      v-if="isExamFinished"
      scroll-y
      class="result-container"
      :style="{ paddingTop: statusBarHeight + 50 + 'px' }"
    >
      <view id="e2e-mock-result" class="glass-card result-card">
        <text class="result-title"> <BaseIcon name="celebrate" :size="36" /> 考试完成 </text>

        <view class="score-display">
          <text id="e2e-mock-score" class="score-number">
            {{ score }}
          </text>
          <text class="score-unit"> 分 </text>
        </view>

        <view class="result-stats">
          <view class="stat-item">
            <text class="stat-value correct">
              {{ correctCount }}
            </text>
            <text class="stat-label"> 正确 </text>
          </view>
          <view class="stat-item">
            <text class="stat-value wrong">
              {{ wrongCount }}
            </text>
            <text class="stat-label"> 错误 </text>
          </view>
          <view class="stat-item">
            <text class="stat-value"> {{ accuracy }}% </text>
            <text class="stat-label"> 正确率 </text>
          </view>
        </view>

        <view class="result-message">
          <text>{{ getResultMessage() }}</text>
        </view>

        <view class="result-actions">
          <wd-button type="info" custom-class="action-btn review" @click="reviewExam">
            <BaseIcon name="book" :size="28" /> 查看解析
          </wd-button>
          <wd-button id="e2e-mock-retry-btn" type="primary" custom-class="action-btn retry" @click="retryExam">
            <BaseIcon name="refresh" :size="28" /> 再考一次
          </wd-button>
        </view>
      </view>

      <!-- 错题列表 -->
      <view v-if="wrongQuestions.length > 0" class="glass-card wrong-list">
        <text class="list-title"> <BaseIcon name="cross" :size="28" /> 错题回顾 </text>
        <view v-for="(item, idx) in wrongQuestions" :key="idx" class="wrong-item">
          <text class="wrong-question">
            {{ idx + 1 }}. {{ (item.question || item.question_content || '题目内容缺失').substring(0, 50) }}...
          </text>
          <view class="wrong-answer">
            <text class="user-ans"> 你的答案: {{ ['A', 'B', 'C', 'D'][item.userAnswer] }} </text>
            <text class="correct-ans"> 正确答案: {{ item.answer || item.correct_answer }} </text>
          </view>
        </view>
      </view>

      <view class="safe-area" />
    </scroll-view>
  </view>
</template>

<script>
import { toast } from '@/utils/toast.js';
import { logger } from '@/utils/logger.js';
import { safeNavigateTo, safeNavigateBack } from '@/utils/safe-navigate';
import { getStatusBarHeight } from '@/utils/core/system.js';
// ✅ F024: 统一使用 storageService
import storageService from '@/services/storageService.js';
// ✅ P002: 引入 reviewStore，替代直接调用 lafService
import { useReviewStore } from '@/stores/modules/review.js';
import BaseIcon from '@/components/base/base-icon/base-icon.vue';
import { requireLogin } from '@/utils/auth/loginGuard.js';

export default {
  components: { BaseIcon },
  setup() {
    const reviewStore = useReviewStore();
    return { reviewStore };
  },
  data() {
    return {
      statusBarHeight: 44,
      isDark: false,
      isPageLoading: true, // 页面初始加载状态

      // 考试设置
      questionCount: 20,
      examDuration: 30, // 分钟
      questionType: 'all',

      // 考试状态
      isExamStarted: false,
      isExamFinished: false,
      examQuestions: [],
      userAnswers: {},
      currentIndex: 0,

      // 计时器
      remainingTime: 0, // 秒
      timerInterval: null,

      // 结果
      score: 0,
      correctCount: 0,
      wrongCount: 0,
      wrongQuestions: [],

      // 防重复点击
      isSubmitting: false,
      isNavigating: false,

      // E2E 调试模式（跳过后端拉题）
      isE2EMode: false,

      // E005: 从 computed 移至 data，避免每次渲染反序列化题库
      totalQuestions: 0
    };
  },

  computed: {
    currentQuestion() {
      return this.examQuestions[this.currentIndex];
    },

    progressPercent() {
      if (this.examQuestions.length === 0) return 0;
      return Math.round(((this.currentIndex + 1) / this.examQuestions.length) * 100);
    },

    accuracy() {
      if (this.examQuestions.length === 0) return 0;
      return Math.round((this.correctCount / this.examQuestions.length) * 100);
    }
  },

  onLoad() {
    this.statusBarHeight = getStatusBarHeight();

    // ✅ F024: 统一使用 storageService 读取主题
    this.isDark = storageService.get('theme_mode', 'light') === 'dark';
    this._themeHandler = (mode) => {
      this.isDark = mode === 'dark';
    };
    uni.$on('themeUpdate', this._themeHandler);

    // E005: 缓存题库数据，避免 totalQuestions computed 每次反序列化
    try {
      const bank = storageService.get('v30_bank', []);
      this.totalQuestions = bank.length;
      this._cachedBank = bank;
    } catch (err) {
      logger.error('[模拟考试] 加载题库异常:', err);
      this.totalQuestions = 0;
      this._cachedBank = [];
    } finally {
      this.isPageLoading = false;
    }

    // [F5-FIX] 检查是否有未完成的考试
    this._checkUnfinishedExam();

    try {
      const pages = getCurrentPages();
      const currentPage = pages[pages.length - 1];
      const query = currentPage?.$page?.options || currentPage?.options || {};
      const e2eFlag = String(query.e2e || '').toLowerCase();
      this.isE2EMode = e2eFlag === '1' || e2eFlag === 'true';
    } catch {
      this.isE2EMode = false;
    }
  },

  onUnload() {
    uni.$off('themeUpdate', this._themeHandler);
    this.clearTimer();
    // 清理导航防抖定时器
    if (this._navTimer) {
      clearTimeout(this._navTimer);
      this._navTimer = null;
    }
    // [F5-FIX] 退出时保存进度（如果考试进行中）
    this._saveExamProgress();
  },

  // [F5-FIX] 切后台 / 接电话时自动保存进度
  onHide() {
    if (this.isExamStarted && !this.isExamFinished) {
      this._saveExamProgress();
    }
  },

  // [F2-FIX] 微信分享配置
  onShareAppMessage() {
    return {
      title: '模拟考试 - Exam-Master 考研备考',
      path: '/pages/practice-sub/mock-exam'
    };
  },

  methods: {
    handleBack() {
      // ✅ P0-FIX: 提交期间禁止退出，防止数据损坏
      if (this.isSubmitting) {
        toast.info('正在提交中，请稍候');
        return;
      }
      if (this.isExamStarted && !this.isExamFinished) {
        uni.showModal({
          title: '确认退出',
          content: '退出后可从上次进度继续考试，确定退出吗？',
          success: (res) => {
            if (res.confirm) {
              this._saveExamProgress();
              this.clearTimer();
              safeNavigateBack();
            }
          }
        });
      } else {
        safeNavigateBack();
      }
    },

    // [F5-FIX] 保存考试进度到本地
    _saveExamProgress() {
      if (!this.isExamStarted || this.isExamFinished) return;
      try {
        storageService.save('MOCK_EXAM_PROGRESS', {
          examQuestions: this.examQuestions,
          userAnswers: this.userAnswers,
          currentIndex: this.currentIndex,
          remainingTime: this.remainingTime,
          correctCount: this.correctCount,
          wrongCount: this.wrongCount,
          wrongQuestions: this.wrongQuestions,
          questionCount: this.questionCount,
          examDuration: this.examDuration,
          savedAt: Date.now()
        });
        logger.log('[MockExam] 考试进度已保存, index:', this.currentIndex);
      } catch (e) {
        logger.warn('[MockExam] 保存进度失败:', e);
      }
    },

    // [F5-FIX] 检查并恢复未完成的考试
    _checkUnfinishedExam() {
      try {
        const progress = storageService.get('MOCK_EXAM_PROGRESS');
        if (!progress || !progress.examQuestions?.length) return;
        // 24小时过期
        if (Date.now() - progress.savedAt > 24 * 60 * 60 * 1000) {
          storageService.remove('MOCK_EXAM_PROGRESS');
          return;
        }
        uni.showModal({
          title: '发现未完成的考试',
          content: `上次答到第 ${progress.currentIndex + 1}/${progress.questionCount} 题，剩余 ${Math.floor(progress.remainingTime / 60)} 分钟，是否继续？`,
          confirmText: '继续考试',
          cancelText: '重新开始',
          success: (res) => {
            if (res.confirm) {
              this._restoreExamProgress(progress);
            } else {
              storageService.remove('MOCK_EXAM_PROGRESS');
            }
          }
        });
      } catch (e) {
        logger.warn('[MockExam] 检查未完成考试失败:', e);
      }
    },

    // [F5-FIX] 恢复考试进度
    _restoreExamProgress(progress) {
      this.examQuestions = progress.examQuestions;
      this.userAnswers = progress.userAnswers || {};
      this.currentIndex = progress.currentIndex || 0;
      this.remainingTime = progress.remainingTime || 0;
      this.correctCount = progress.correctCount || 0;
      this.wrongCount = progress.wrongCount || 0;
      this.wrongQuestions = progress.wrongQuestions || [];
      this.questionCount = progress.questionCount || 20;
      this.examDuration = progress.examDuration || 30;
      this.isExamStarted = true;
      this.isExamFinished = false;
      storageService.remove('MOCK_EXAM_PROGRESS');
      this.startTimer();
      logger.log('[MockExam] 考试进度已恢复, index:', this.currentIndex);
    },

    async startExam() {
      // ✅ P002: 优先从后端获取真实题库数据，本地数据作为降级方案
      let sourceQuestions = [];
      let dataSource = 'local';

      if (!this.isE2EMode) {
        try {
          // 尝试从后端获取随机题目
          const response = await this.reviewStore.fetchRandomQuestions({
            count: this.questionCount
          });

          if (response && response.success && response.data) {
            const backendQuestions = Array.isArray(response.data) ? response.data : response.data.list || [];
            if (backendQuestions.length >= this.questionCount) {
              sourceQuestions = backendQuestions;
              dataSource = 'backend';
              logger.log('[MockExam] ✅ 从后端获取题目成功:', backendQuestions.length);
            }
          }
        } catch (err) {
          logger.warn('[MockExam] ⚠️ 后端获取题目失败，降级使用本地数据:', err.message || err);
        }
      }

      // 降级：使用本地缓存题库
      if (sourceQuestions.length < this.questionCount) {
        const bank = this._cachedBank || storageService.get('v30_bank', []);

        if (bank.length < this.questionCount) {
          toast.info(`题库不足${this.questionCount}道题`);
          return;
        }

        sourceQuestions = [...bank];
        dataSource = 'local';

        if (this.questionType === 'mistakes') {
          const mistakes = storageService.get('mistake_book', []);
          if (mistakes.length >= this.questionCount) {
            sourceQuestions = [...mistakes];
          }
        }
      }

      // 打乱顺序并抽取
      this.examQuestions = this.shuffleArray(sourceQuestions).slice(0, this.questionCount);

      // ✅ P0-FIX: 最终验证题目数量，防止空考试
      if (!this.examQuestions || this.examQuestions.length === 0) {
        toast.info('题目加载失败，请重试');
        return;
      }

      this.userAnswers = {};
      this.currentIndex = 0;
      this.remainingTime = this.examDuration * 60;
      this.isExamStarted = true;
      this.isExamFinished = false;

      // 开始计时
      this.startTimer();

      logger.log('[MockExam] 考试开始:', {
        questionCount: this.examQuestions.length,
        duration: this.examDuration,
        dataSource
      });
    },

    shuffleArray(array) {
      const arr = [...array];
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    },

    startTimer() {
      this.clearTimer();
      this.timerInterval = setInterval(() => {
        if (this.remainingTime > 0) {
          this.remainingTime--;
        } else {
          this.timeUp();
        }
      }, 1000);
    },

    clearTimer() {
      if (this.timerInterval) {
        clearInterval(this.timerInterval);
        this.timerInterval = null;
      }
    },

    timeUp() {
      this.clearTimer();
      uni.showModal({
        title: '时间到',
        content: '考试时间已结束，系统将自动提交试卷',
        showCancel: false,
        success: () => {
          this.calculateResult();
        }
      });
    },

    formatTime(seconds) {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    },

    selectAnswer(idx) {
      // Vue 3 中数组索引赋值已自动响应式，无需 $set
      this.userAnswers[this.currentIndex] = idx;
    },

    prevQuestion() {
      if (this.currentIndex > 0) {
        this.currentIndex--;
      }
    },

    nextQuestion() {
      if (this.isNavigating) return;
      this.isNavigating = true;

      if (this.currentIndex < this.examQuestions.length - 1) {
        this.currentIndex++;
      }

      // 短暂延迟后解锁，保存引用以便 onUnload 清理
      this._navTimer = setTimeout(() => {
        this.isNavigating = false;
      }, 300);
    },

    jumpToQuestion(idx) {
      this.currentIndex = idx;
    },

    submitExam() {
      if (this.isSubmitting) return;

      const unanswered = this.examQuestions.length - Object.keys(this.userAnswers).length;

      if (unanswered > 0) {
        uni.showModal({
          title: '提示',
          content: `还有 ${unanswered} 道题未作答，确定提交吗？`,
          success: (res) => {
            if (res.confirm) {
              this.isSubmitting = true;
              this.calculateResult();
            }
          }
        });
      } else {
        this.isSubmitting = true;
        this.calculateResult();
      }
    },

    calculateResult() {
      this.clearTimer();

      this.correctCount = 0;
      this.wrongCount = 0;
      this.wrongQuestions = [];

      this.examQuestions.forEach((q, idx) => {
        const userAnswer = this.userAnswers[idx];
        const correctAnswer = q.answer || q.correct_answer || 'A';
        const correctIndex = ['A', 'B', 'C', 'D'].indexOf(correctAnswer.toUpperCase());

        if (userAnswer === correctIndex) {
          this.correctCount++;
        } else {
          this.wrongCount++;
          this.wrongQuestions.push({
            ...q,
            userAnswer: userAnswer
          });
        }
      });

      this.score =
        this.examQuestions.length > 0 ? Math.round((this.correctCount / this.examQuestions.length) * 100) : 0;
      this.isExamFinished = true;
      this.isSubmitting = false;

      // 保存考试记录
      this.saveExamRecord();

      logger.log('[MockExam] 考试结束:', {
        score: this.score,
        correct: this.correctCount,
        wrong: this.wrongCount
      });
    },

    saveExamRecord() {
      const records = storageService.get('exam_records', []);
      records.unshift({
        date: Date.now(),
        questionCount: this.examQuestions.length,
        duration: this.examDuration,
        score: this.score,
        correctCount: this.correctCount,
        wrongCount: this.wrongCount,
        accuracy: this.accuracy
      });
      // 只保留最近20条记录
      storageService.save('exam_records', records.slice(0, 20));
    },

    getResultMessage() {
      if (this.score >= 90) return '太棒了！你已经掌握得非常好！';
      if (this.score >= 80) return '很不错！继续保持！';
      if (this.score >= 60) return '及格了！还有提升空间！';
      return '需要加油！多复习错题吧！';
    },

    reviewExam() {
      // 跳转到错题本查看
      requireLogin(() => safeNavigateTo('/pages/mistake/index'), { message: '请先登录后查看错题集' });
    },

    retryExam() {
      this.isExamStarted = false;
      this.isExamFinished = false;
      this.examQuestions = [];
      this.userAnswers = {};
      this.currentIndex = 0;
      this.wrongQuestions = [];
    }
  }
};
</script>

<style lang="scss" scoped>
.container {
  min-height: 100%;
  min-height: 100vh;
  background: var(--bg-secondary, #f5f5f7);
}

.nav-bar {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  z-index: 100;
  background:
    linear-gradient(180deg, var(--apple-specular-soft) 0%, transparent 42%),
    linear-gradient(160deg, var(--apple-glass-nav-bg) 0%, var(--apple-glass-card-bg) 100%);
  backdrop-filter: blur(24px) saturate(160%);
  -webkit-backdrop-filter: blur(24px) saturate(160%);
  border-bottom: 1px solid var(--apple-glass-border-strong);
  box-shadow: var(--apple-shadow-surface);
}

.nav-content {
  height: 50px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 30rpx;
}

.back-btn {
  width: 88rpx;
  height: 88rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 36rpx;
  color: var(--text-primary);
  font-weight: bold;
}

.nav-title {
  font-size: 32rpx;
  font-weight: bold;
  color: var(--text-primary);
}

.timer-display {
  display: flex;
  align-items: center;
  /* gap: 8rpx; -- replaced for Android WebView compat */
  background: rgba(255, 255, 255, 0.72);
  padding: 8rpx 16rpx;
  border-radius: 999rpx;
  border: 1rpx solid rgba(255, 255, 255, 0.5);
  box-shadow: var(--apple-shadow-surface);
}
.timer-display > view + view {
  margin-left: 8rpx;
}

.timer-icon {
  font-size: 24rpx;
}

.timer-text {
  font-size: 26rpx;
  font-weight: bold;
  color: var(--danger);
}

.glass-card {
  position: relative;
  overflow: hidden;
  background:
    linear-gradient(180deg, var(--apple-specular-soft) 0%, transparent 36%),
    linear-gradient(160deg, var(--apple-glass-card-bg) 0%, var(--apple-group-bg) 100%);
  backdrop-filter: blur(22px) saturate(150%);
  -webkit-backdrop-filter: blur(22px) saturate(150%);
  border: 1px solid var(--apple-glass-border-strong);
  border-radius: 40rpx;
  padding: 40rpx;
  margin: 30rpx;
  box-shadow: var(--apple-shadow-card);
}

.glass-card::before {
  content: '';
  position: absolute;
  left: 24rpx;
  right: 24rpx;
  top: 0;
  height: 1rpx;
  background: var(--apple-specular-soft);
}

/* 设置页面 */
.setup-container {
  padding-bottom: 100rpx;
}

.setup-title {
  font-size: 40rpx;
  font-weight: bold;
  color: var(--text-primary);
  display: block;
  margin-bottom: 40rpx;
  text-align: center;
}

.setting-item {
  margin-bottom: 40rpx;
}

.setting-label {
  font-size: 28rpx;
  color: var(--text-sub);
  display: block;
  margin-bottom: 20rpx;
}

.setting-options {
  display: flex;
  /* gap: 16rpx; -- replaced for Android WebView compat */
  flex-wrap: wrap;
}
.setting-options > .option-btn {
  margin-right: 16rpx;
  margin-bottom: 16rpx;
}

.option-btn {
  padding: 16rpx 32rpx;
  border-radius: 999rpx;
  background: rgba(255, 255, 255, 0.68);
  color: var(--text-sub);
  font-size: 26rpx;
  transition: all 0.2s;
  border: 1rpx solid rgba(255, 255, 255, 0.5);
  box-shadow: var(--apple-shadow-surface);
}

.option-btn.active {
  background: var(--cta-primary-bg);
  color: var(--cta-primary-text);
  border: 1rpx solid var(--cta-primary-border);
  box-shadow: var(--cta-primary-shadow);
  font-weight: bold;
}

.exam-info {
  text-align: center;
  margin: 40rpx 0;
}

.info-text {
  font-size: 26rpx;
  color: var(--text-sub);
}

.start-btn {
  width: 100%;
  height: 100rpx;
  background: var(--cta-primary-bg);
  color: var(--cta-primary-text);
  border: 1rpx solid var(--cta-primary-border);
  border-radius: 50rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  /* gap: 16rpx; -- replaced for Android WebView compat */
  box-shadow: var(--cta-primary-shadow);
}
.start-btn > view + view {
  margin-left: 16rpx;
}

.start-btn[disabled] {
  opacity: 0.5;
}

.btn-icon {
  font-size: 36rpx;
}

.btn-text {
  font-size: 32rpx;
  font-weight: bold;
  color: inherit;
}

/* 考试页面 */
.exam-container {
  height: 100%;
  height: 100vh;
  padding: 0 30rpx;
  box-sizing: border-box;
}

.progress-bar {
  height: 8rpx;
  background: rgba(16, 40, 26, 0.08);
  border-radius: 4rpx;
  margin: 20rpx 0;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--primary);
  border-radius: 4rpx;
  transition: width 0.3s;
}

.progress-text {
  font-size: 24rpx;
  color: var(--text-sub);
  text-align: center;
  display: block;
  margin-bottom: 20rpx;
}

.question-card {
  margin: 0 0 30rpx 0;
}

.question-number {
  font-size: 24rpx;
  color: var(--primary);
  font-weight: bold;
  display: block;
  margin-bottom: 20rpx;
}

.question-text {
  font-size: 32rpx;
  color: var(--text-primary);
  line-height: 1.6;
  display: block;
  margin-bottom: 40rpx;
}

.options-list {
  display: flex;
  flex-direction: column;
  /* gap: 20rpx; -- replaced for Android WebView compat */
}
.options-list > .option-item + .option-item {
  margin-top: 20rpx;
}

.option-item {
  display: flex;
  align-items: flex-start;
  padding: 24rpx;
  background: rgba(255, 255, 255, 0.6);
  border-radius: 24rpx;
  border: 2rpx solid rgba(255, 255, 255, 0.42);
  transition: all 0.2s;
  box-shadow: var(--apple-shadow-surface);
}

.option-item.selected {
  background: rgba(255, 255, 255, 0.88);
  border-color: var(--cta-primary-border);
  box-shadow: var(--cta-primary-shadow);
}

.option-label {
  width: 48rpx;
  height: 48rpx;
  background: rgba(255, 255, 255, 0.82);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 26rpx;
  font-weight: bold;
  color: var(--text-sub);
  margin-right: 20rpx;
  flex-shrink: 0;
  border: 1rpx solid rgba(255, 255, 255, 0.5);
}

.option-item.selected .option-label {
  background: var(--primary);
  color: var(--primary-foreground);
}

.option-text {
  font-size: 28rpx;
  color: var(--text-primary);
  line-height: 1.5;
  flex: 1;
}

.nav-buttons {
  display: flex;
  /* gap: 20rpx; -- replaced for Android WebView compat */
  margin: 30rpx 0;
}
.nav-buttons > .nav-btn + .nav-btn {
  margin-left: 20rpx;
}

.nav-btn {
  flex: 1;
  height: 88rpx;
  border-radius: 999rpx;
  font-size: 28rpx;
  font-weight: bold;
  border: 1rpx solid rgba(255, 255, 255, 0.5);
}

.nav-btn.prev {
  background: rgba(255, 255, 255, 0.72);
  color: var(--text-primary);
  box-shadow: var(--apple-shadow-surface);
}

.nav-btn.next {
  background: var(--cta-primary-bg);
  color: var(--cta-primary-text);
  border: 1rpx solid var(--cta-primary-border);
  box-shadow: var(--cta-primary-shadow);
}

.nav-btn.submit {
  background: var(--cta-primary-bg);
  color: var(--cta-primary-text);
  border: 1rpx solid var(--cta-primary-border);
  box-shadow: var(--cta-primary-shadow);
}

.nav-btn[disabled] {
  opacity: 0.5;
}

/* 答题卡 */
.answer-sheet {
  background: linear-gradient(180deg, var(--apple-group-bg) 0%, var(--apple-glass-card-bg) 100%);
  border-radius: 32rpx;
  padding: 30rpx;
  margin-bottom: 30rpx;
  border: 1rpx solid var(--apple-glass-border-strong);
  box-shadow: var(--apple-shadow-card);
}

.sheet-title {
  font-size: 28rpx;
  font-weight: bold;
  color: var(--text-primary);
  display: block;
  margin-bottom: 20rpx;
}

.sheet-grid {
  display: flex;
  flex-wrap: wrap;
  /* gap: 16rpx; -- replaced for Android WebView compat */
}
.sheet-grid > .sheet-item {
  margin-right: 16rpx;
  margin-bottom: 16rpx;
}

.sheet-item {
  width: 60rpx;
  height: 60rpx;
  border-radius: 16rpx;
  background: rgba(255, 255, 255, 0.68);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24rpx;
  color: var(--text-sub);
  border: 1rpx solid rgba(255, 255, 255, 0.5);
}

.sheet-item.answered {
  background: var(--primary);
  color: var(--primary-foreground);
}

.sheet-item.current {
  border: 2rpx solid var(--primary);
}

/* 结果页面 */
.result-container {
  height: 100%;
  height: 100vh;
  padding: 0 30rpx;
  box-sizing: border-box;
}

.result-card {
  text-align: center;
  margin-top: 20rpx;
}

.result-title {
  font-size: 40rpx;
  font-weight: bold;
  color: var(--text-primary);
  display: block;
  margin-bottom: 40rpx;
}

.score-display {
  display: flex;
  align-items: baseline;
  justify-content: center;
  margin-bottom: 40rpx;
}

.score-number {
  font-size: 120rpx;
  font-weight: 900;
  color: var(--primary);
}

.score-unit {
  font-size: 36rpx;
  color: var(--text-sub);
  margin-left: 8rpx;
}

.result-stats {
  display: flex;
  justify-content: space-around;
  margin-bottom: 40rpx;
}

.stat-item {
  text-align: center;
}

.stat-value {
  font-size: 48rpx;
  font-weight: bold;
  display: block;
}

.stat-value.correct {
  color: var(--success);
}

.stat-value.wrong {
  color: var(--danger);
}

.stat-label {
  font-size: 24rpx;
  color: var(--text-sub);
}

.result-message {
  padding: 30rpx;
  background: rgba(255, 255, 255, 0.56);
  border-radius: 24rpx;
  margin-bottom: 40rpx;
  border: 1rpx solid rgba(255, 255, 255, 0.46);
}

.result-message text {
  font-size: 28rpx;
  color: var(--text-primary);
}

.result-actions {
  display: flex;
  /* gap: 20rpx; -- replaced for Android WebView compat */
}
.result-actions > .action-btn + .action-btn {
  margin-left: 20rpx;
}

.action-btn {
  flex: 1;
  height: 88rpx;
  border-radius: 999rpx;
  font-size: 28rpx;
  font-weight: bold;
  border: 1rpx solid rgba(255, 255, 255, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
}

.action-btn.review {
  background: rgba(255, 255, 255, 0.72);
  color: var(--text-primary);
  box-shadow: var(--apple-shadow-surface);
}

.action-btn.retry {
  background: var(--cta-primary-bg);
  color: var(--cta-primary-text);
  border: 1rpx solid var(--cta-primary-border);
  box-shadow: var(--cta-primary-shadow);
}

/* 错题列表 */
.wrong-list {
  margin-top: 30rpx;
}

.list-title {
  font-size: 32rpx;
  font-weight: bold;
  color: var(--text-primary);
  display: block;
  margin-bottom: 30rpx;
}

.wrong-item {
  padding: 24rpx;
  background: rgba(255, 255, 255, 0.58);
  border-radius: 24rpx;
  margin-bottom: 20rpx;
  border: 1rpx solid rgba(255, 255, 255, 0.46);
}

.wrong-question {
  font-size: 26rpx;
  color: var(--text-primary);
  display: block;
  margin-bottom: 16rpx;
}

.wrong-answer {
  display: flex;
  /* gap: 20rpx; -- replaced for Android WebView compat */
  font-size: 24rpx;
}
.wrong-answer > text + text {
  margin-left: 20rpx;
}

.user-ans {
  color: var(--danger);
}

.correct-ans {
  color: var(--success);
}

.safe-area {
  height: 100rpx;
}

/* 骨架屏样式 */
.skeleton-title {
  width: 200rpx;
  height: 40rpx;
  border-radius: 8rpx;
  margin: 0 auto 40rpx;
}

.skeleton-setting {
  margin-bottom: 40rpx;
}

.skeleton-label {
  width: 120rpx;
  height: 28rpx;
  border-radius: 6rpx;
  margin-bottom: 20rpx;
}

.skeleton-options {
  display: flex;
  /* gap: 16rpx; -- replaced for Android WebView compat */
  flex-wrap: wrap;
}

.skeleton-option {
  width: 120rpx;
  height: 56rpx;
  border-radius: 20rpx;
}

.skeleton-btn {
  width: 100%;
  height: 100rpx;
  border-radius: 50rpx;
  margin-top: 40rpx;
}

.skeleton-animate {
  background: linear-gradient(90deg, var(--bg-secondary) 25%, var(--bg-card) 50%, var(--bg-secondary) 75%);
  background-size: 200% 100%;
  animation: skeleton-loading 1.5s infinite;
}

@keyframes skeleton-loading {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}

/* 骨架屏淡出过渡 */
.skeleton-fade-leave-active {
  transition: opacity 0.35s ease-out;
}
.skeleton-fade-leave-to {
  opacity: 0;
}

/* 暗色模式 */
.dark-mode {
  background: var(--bg-page, #0b0b0f);
  color: var(--text-primary, #f5f5f7);
}
.dark-mode .nav-bar {
  background: var(--bg-card, #1c1c1e);
}
.dark-mode .nav-title {
  color: var(--text-primary, #f5f5f7);
}
.dark-mode .back-btn {
  color: var(--text-primary, #f5f5f7);
}
.dark-mode .glass-card {
  background: var(--bg-card, #1c1c1e);
  border-color: var(--border, rgba(255, 255, 255, 0.1));
}
.dark-mode .setting-label {
  color: var(--text-primary, #f5f5f7);
}
.dark-mode .progress-bar {
  background: var(--bg-secondary, #2c2c2e);
}
.dark-mode .option-item {
  background: var(--bg-card, #1c1c1e);
  border-color: var(--border, rgba(255, 255, 255, 0.1));
  color: var(--text-primary, #f5f5f7);
}
.dark-mode .option-item.selected {
  background: var(--bg-secondary, #2c2c2e);
  border-color: var(--cta-primary-border);
}
.dark-mode .option-label {
  background: var(--bg-secondary, #2c2c2e);
  color: var(--text-secondary, #8e8e93);
}
.dark-mode .question-card {
  background: var(--bg-card, #1c1c1e);
}
.dark-mode .result-card {
  background: var(--bg-card, #1c1c1e);
  border-color: var(--border, rgba(255, 255, 255, 0.1));
}
.dark-mode .result-message {
  background: var(--bg-secondary, #2c2c2e);
  border-color: var(--border, rgba(255, 255, 255, 0.1));
}
.dark-mode .sheet-item {
  background: var(--bg-secondary, #2c2c2e);
  color: var(--text-primary, #f5f5f7);
  border-color: var(--border, rgba(255, 255, 255, 0.1));
}
.dark-mode .nav-btn {
  background: var(--bg-card, #1c1c1e);
  color: var(--text-primary, #f5f5f7);
  border-color: var(--border, rgba(255, 255, 255, 0.1));
}
.dark-mode .nav-btn.next,
.dark-mode .nav-btn.submit {
  background: var(--cta-primary-bg);
  color: var(--cta-primary-text);
}
.dark-mode .option-btn {
  background: var(--bg-secondary, #2c2c2e);
  color: var(--text-secondary, #8e8e93);
  border-color: var(--border, rgba(255, 255, 255, 0.1));
}
.dark-mode .option-btn.active {
  background: var(--cta-primary-bg);
  color: var(--cta-primary-text);
}
.dark-mode .timer-display {
  background: var(--bg-secondary, #2c2c2e);
  border-color: var(--border, rgba(255, 255, 255, 0.1));
}
.dark-mode .wrong-item {
  background: var(--bg-secondary, #2c2c2e);
  border-color: var(--border, rgba(255, 255, 255, 0.1));
}
.dark-mode .answer-sheet {
  background: var(--bg-card, #1c1c1e);
  border-color: var(--border, rgba(255, 255, 255, 0.1));
}
</style>
