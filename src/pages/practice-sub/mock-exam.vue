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

<script setup>
import { ref, computed } from 'vue';
import { onLoad, onUnload, onHide, onShareAppMessage } from '@dcloudio/uni-app';
import { modal } from '@/utils/modal.js';
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

// Store 实例
const reviewStore = useReviewStore();

// ========== 响应式状态 ==========

// 页面基础状态
const statusBarHeight = ref(44);
const isDark = ref(false);
const isPageLoading = ref(true); // 页面初始加载状态

// 考试设置
const questionCount = ref(20);
const examDuration = ref(30); // 分钟
const questionType = ref('all');

// 考试状态
const isExamStarted = ref(false);
const isExamFinished = ref(false);
const examQuestions = ref([]);
const userAnswers = ref({});
const currentIndex = ref(0);

// 计时器
const remainingTime = ref(0); // 秒

// 结果
const score = ref(0);
const correctCount = ref(0);
const wrongCount = ref(0);
const wrongQuestions = ref([]);

// 防重复点击
const isSubmitting = ref(false);
const isNavigating = ref(false);

// E2E 调试模式（跳过后端拉题）
const isE2EMode = ref(false);

// E005: 题库总数，从 computed 移至 ref，避免每次渲染反序列化题库
const totalQuestions = ref(0);

// ========== 非响应式变量（定时器 / 缓存 / 事件引用） ==========

let timerInterval = null;
let _cachedBank = [];
let _themeHandler = null;
let _navTimer = null;

// ========== 计算属性 ==========

/** 当前题目 */
const currentQuestion = computed(() => examQuestions.value[currentIndex.value]);

/** 进度百分比 */
const progressPercent = computed(() => {
  if (examQuestions.value.length === 0) return 0;
  return Math.round(((currentIndex.value + 1) / examQuestions.value.length) * 100);
});

/** 正确率 */
const accuracy = computed(() => {
  if (examQuestions.value.length === 0) return 0;
  return Math.round((correctCount.value / examQuestions.value.length) * 100);
});

// ========== 方法 ==========

/** 格式化倒计时显示 */
function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/** 打乱数组顺序（Fisher-Yates 洗牌） */
function shuffleArray(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** 启动倒计时 */
function startTimer() {
  clearTimer();
  timerInterval = setInterval(() => {
    if (remainingTime.value > 0) {
      remainingTime.value--;
    } else {
      timeUp();
    }
  }, 1000);
}

/** 清除计时器 */
function clearTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

/** 时间到，自动提交 */
function timeUp() {
  clearTimer();
  modal.show({
    title: '时间到',
    content: '考试时间已结束，系统将自动提交试卷',
    showCancel: false,
    success: () => {
      calculateResult();
    }
  });
}

/** 返回按钮处理 */
function handleBack() {
  // ✅ P0-FIX: 提交期间禁止退出，防止数据损坏
  if (isSubmitting.value) {
    toast.info('正在提交中，请稍候');
    return;
  }
  if (isExamStarted.value && !isExamFinished.value) {
    modal.show({
      title: '确认退出',
      content: '退出后可从上次进度继续考试，确定退出吗？',
      success: (res) => {
        if (res.confirm) {
          _saveExamProgress();
          clearTimer();
          safeNavigateBack();
        }
      }
    });
  } else {
    safeNavigateBack();
  }
}

/** [F5-FIX] 保存考试进度到本地 */
function _saveExamProgress() {
  if (!isExamStarted.value || isExamFinished.value) return;
  try {
    storageService.save('MOCK_EXAM_PROGRESS', {
      examQuestions: examQuestions.value,
      userAnswers: userAnswers.value,
      currentIndex: currentIndex.value,
      remainingTime: remainingTime.value,
      correctCount: correctCount.value,
      wrongCount: wrongCount.value,
      wrongQuestions: wrongQuestions.value,
      questionCount: questionCount.value,
      examDuration: examDuration.value,
      savedAt: Date.now()
    });
    logger.log('[MockExam] 考试进度已保存, index:', currentIndex.value);
  } catch (e) {
    logger.warn('[MockExam] 保存进度失败:', e);
  }
}

/** [F5-FIX] 检查并恢复未完成的考试 */
function _checkUnfinishedExam() {
  try {
    const progress = storageService.get('MOCK_EXAM_PROGRESS');
    if (!progress || !progress.examQuestions?.length) return;
    // 24小时过期
    if (Date.now() - progress.savedAt > 24 * 60 * 60 * 1000) {
      storageService.remove('MOCK_EXAM_PROGRESS');
      return;
    }
    modal.show({
      title: '发现未完成的考试',
      content: `上次答到第 ${progress.currentIndex + 1}/${progress.questionCount} 题，剩余 ${Math.floor(progress.remainingTime / 60)} 分钟，是否继续？`,
      confirmText: '继续考试',
      cancelText: '重新开始',
      success: (res) => {
        if (res.confirm) {
          _restoreExamProgress(progress);
        } else {
          storageService.remove('MOCK_EXAM_PROGRESS');
        }
      }
    });
  } catch (e) {
    logger.warn('[MockExam] 检查未完成考试失败:', e);
  }
}

/** [F5-FIX] 恢复考试进度 */
function _restoreExamProgress(progress) {
  examQuestions.value = progress.examQuestions;
  userAnswers.value = progress.userAnswers || {};
  currentIndex.value = progress.currentIndex || 0;
  remainingTime.value = progress.remainingTime || 0;
  correctCount.value = progress.correctCount || 0;
  wrongCount.value = progress.wrongCount || 0;
  wrongQuestions.value = progress.wrongQuestions || [];
  questionCount.value = progress.questionCount || 20;
  examDuration.value = progress.examDuration || 30;
  isExamStarted.value = true;
  isExamFinished.value = false;
  storageService.remove('MOCK_EXAM_PROGRESS');
  startTimer();
  logger.log('[MockExam] 考试进度已恢复, index:', currentIndex.value);
}

/** 开始考试 */
async function startExam() {
  // ✅ P002: 优先从后端获取真实题库数据，本地数据作为降级方案
  let sourceQuestions = [];
  let dataSource = 'local';

  if (!isE2EMode.value) {
    try {
      // 尝试从后端获取随机题目
      const response = await reviewStore.fetchRandomQuestions({
        count: questionCount.value
      });

      if (response && response.success && response.data) {
        const backendQuestions = Array.isArray(response.data) ? response.data : response.data.list || [];
        if (backendQuestions.length >= questionCount.value) {
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
  if (sourceQuestions.length < questionCount.value) {
    const bank = _cachedBank.length > 0 ? _cachedBank : storageService.get('v30_bank', []);

    if (bank.length < questionCount.value) {
      toast.info(`题库不足${questionCount.value}道题`);
      return;
    }

    sourceQuestions = [...bank];
    dataSource = 'local';

    if (questionType.value === 'mistakes') {
      const mistakes = storageService.get('mistake_book', []);
      if (mistakes.length >= questionCount.value) {
        sourceQuestions = [...mistakes];
      }
    }
  }

  // 打乱顺序并抽取
  examQuestions.value = shuffleArray(sourceQuestions).slice(0, questionCount.value);

  // ✅ P0-FIX: 最终验证题目数量，防止空考试
  if (!examQuestions.value || examQuestions.value.length === 0) {
    toast.info('题目加载失败，请重试');
    return;
  }

  userAnswers.value = {};
  currentIndex.value = 0;
  remainingTime.value = examDuration.value * 60;
  isExamStarted.value = true;
  isExamFinished.value = false;

  // 开始计时
  startTimer();

  logger.log('[MockExam] 考试开始:', {
    questionCount: examQuestions.value.length,
    duration: examDuration.value,
    dataSource
  });
}

/** 选择答案 */
function selectAnswer(idx) {
  // Vue 3 Proxy 响应式，动态属性赋值自动追踪
  userAnswers.value[currentIndex.value] = idx;
}

/** 上一题 */
function prevQuestion() {
  if (currentIndex.value > 0) {
    currentIndex.value--;
  }
}

/** 下一题 */
function nextQuestion() {
  if (isNavigating.value) return;
  isNavigating.value = true;

  if (currentIndex.value < examQuestions.value.length - 1) {
    currentIndex.value++;
  }

  // 短暂延迟后解锁，保存引用以便 onUnload 清理
  _navTimer = setTimeout(() => {
    isNavigating.value = false;
  }, 300);
}

/** 跳转到指定题目 */
function jumpToQuestion(idx) {
  currentIndex.value = idx;
}

/** 提交试卷 */
function submitExam() {
  if (isSubmitting.value) return;

  const unanswered = examQuestions.value.length - Object.keys(userAnswers.value).length;

  if (unanswered > 0) {
    modal.show({
      title: '提示',
      content: `还有 ${unanswered} 道题未作答，确定提交吗？`,
      success: (res) => {
        if (res.confirm) {
          isSubmitting.value = true;
          calculateResult();
        }
      }
    });
  } else {
    isSubmitting.value = true;
    calculateResult();
  }
}

/** 计算考试结果 */
function calculateResult() {
  clearTimer();

  correctCount.value = 0;
  wrongCount.value = 0;
  wrongQuestions.value = [];

  examQuestions.value.forEach((q, idx) => {
    const userAnswer = userAnswers.value[idx];
    const correctAnswer = q.answer || q.correct_answer || 'A';
    const correctIdx = ['A', 'B', 'C', 'D'].indexOf(correctAnswer.toUpperCase());

    if (userAnswer === correctIdx) {
      correctCount.value++;
    } else {
      wrongCount.value++;
      wrongQuestions.value.push({
        ...q,
        userAnswer: userAnswer
      });
    }
  });

  score.value =
    examQuestions.value.length > 0 ? Math.round((correctCount.value / examQuestions.value.length) * 100) : 0;
  isExamFinished.value = true;
  isSubmitting.value = false;

  // 保存考试记录
  saveExamRecord();

  logger.log('[MockExam] 考试结束:', {
    score: score.value,
    correct: correctCount.value,
    wrong: wrongCount.value
  });
}

/** 保存考试记录到本地 */
function saveExamRecord() {
  const records = storageService.get('exam_records', []);
  records.unshift({
    date: Date.now(),
    questionCount: examQuestions.value.length,
    duration: examDuration.value,
    score: score.value,
    correctCount: correctCount.value,
    wrongCount: wrongCount.value,
    accuracy: accuracy.value
  });
  // 只保留最近20条记录
  storageService.save('exam_records', records.slice(0, 20));
}

/** 获取结果评语 */
function getResultMessage() {
  if (score.value >= 90) return '太棒了！你已经掌握得非常好！';
  if (score.value >= 80) return '很不错！继续保持！';
  if (score.value >= 60) return '及格了！还有提升空间！';
  return '需要加油！多复习错题吧！';
}

/** 查看解析（跳转到错题本） */
function reviewExam() {
  requireLogin(() => safeNavigateTo('/pages/mistake/index'), { message: '请先登录后查看错题集' });
}

/** 重新考试 */
function retryExam() {
  isExamStarted.value = false;
  isExamFinished.value = false;
  examQuestions.value = [];
  userAnswers.value = {};
  currentIndex.value = 0;
  wrongQuestions.value = [];
}

// ========== 页面生命周期 ==========

onLoad(() => {
  statusBarHeight.value = getStatusBarHeight();

  // ✅ F024: 统一使用 storageService 读取主题
  isDark.value = storageService.get('theme_mode', 'light') === 'dark';
  _themeHandler = (mode) => {
    isDark.value = mode === 'dark';
  };
  uni.$on('themeUpdate', _themeHandler);

  // E005: 缓存题库数据，避免每次反序列化
  try {
    const bank = storageService.get('v30_bank', []);
    totalQuestions.value = bank.length;
    _cachedBank = bank;
  } catch (err) {
    logger.error('[模拟考试] 加载题库异常:', err);
    totalQuestions.value = 0;
    _cachedBank = [];
  } finally {
    isPageLoading.value = false;
  }

  // [F5-FIX] 检查是否有未完成的考试
  _checkUnfinishedExam();

  // 读取 E2E 调试模式标识
  try {
    const pages = getCurrentPages();
    const currentPage = pages[pages.length - 1];
    const query = currentPage?.$page?.options || currentPage?.options || {};
    const e2eFlag = String(query.e2e || '').toLowerCase();
    isE2EMode.value = e2eFlag === '1' || e2eFlag === 'true';
  } catch {
    isE2EMode.value = false;
  }
});

onUnload(() => {
  uni.$off('themeUpdate', _themeHandler);
  clearTimer();
  // 清理导航防抖定时器
  if (_navTimer) {
    clearTimeout(_navTimer);
    _navTimer = null;
  }
  // [F5-FIX] 退出时保存进度（如果考试进行中）
  _saveExamProgress();
});

// [F5-FIX] 切后台 / 接电话时自动保存进度
onHide(() => {
  if (isExamStarted.value && !isExamFinished.value) {
    _saveExamProgress();
  }
});

// [F2-FIX] 微信分享配置
onShareAppMessage(() => ({
  title: '模拟考试 - Exam-Master 考研备考',
  path: '/pages/practice-sub/mock-exam',
  imageUrl: '/static/images/app-share-cover.png'
}));
</script>

<style lang="scss" scoped>
.container {
  min-height: 100%;
  min-height: 100vh;
  background: var(--background);
}

.nav-bar {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  z-index: 100;
  background: var(--bg-card);
  backdrop-filter: blur(24px) saturate(160%);
  -webkit-backdrop-filter: blur(24px) saturate(160%);
  border-bottom: 2rpx solid rgba(0, 0, 0, 0.04);
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.06);
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
  font-weight: 800;
  color: var(--text-primary);
}

.timer-display {
  display: flex;
  align-items: center;
  /* gap: 8rpx; -- replaced for Android WebView compat */
  background: var(--bg-card);
  padding: 8rpx 16rpx;
  border-radius: 999rpx;
  border: 2rpx solid rgba(0, 0, 0, 0.04);
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.06);
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
  background: var(--bg-card);
  border: 2rpx solid rgba(0, 0, 0, 0.04);
  border-radius: 28rpx;
  padding: 40rpx;
  margin: 30rpx;
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.06);
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
  font-weight: 800;
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
  color: var(--text-secondary);
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
  background: var(--bg-card);
  color: var(--text-secondary);
  font-size: 26rpx;
  transition: all 0.2s;
  border: 2rpx solid rgba(0, 0, 0, 0.04);
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.06);
}

.option-btn.active {
  background: var(--info);
  color: var(--text-inverse);
  border: 2rpx solid var(--info);
  box-shadow: 0 8rpx 0 #0e8ac0;
  font-weight: 800;
}

.option-btn.active:active {
  transform: translateY(4rpx);
  box-shadow: 0 4rpx 0 #0e8ac0;
}

.exam-info {
  text-align: center;
  margin: 40rpx 0;
}

.info-text {
  font-size: 26rpx;
  color: var(--text-secondary);
}

.start-btn {
  width: 100%;
  height: 100rpx;
  background: var(--info);
  color: var(--text-inverse);
  border: none;
  border-radius: 50rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  /* gap: 16rpx; -- replaced for Android WebView compat */
  box-shadow: 0 8rpx 0 #0e8ac0;
}
.start-btn:active {
  transform: translateY(4rpx);
  box-shadow: 0 4rpx 0 #0e8ac0;
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
  font-weight: 800;
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
  background: rgba(0, 0, 0, 0.06);
  border-radius: 4rpx;
  margin: 20rpx 0;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--info);
  border-radius: 4rpx;
  transition: width 0.3s;
}

.progress-text {
  font-size: 24rpx;
  color: var(--text-secondary);
  text-align: center;
  display: block;
  margin-bottom: 20rpx;
}

.question-card {
  margin: 0 0 30rpx 0;
}

.question-number {
  font-size: 24rpx;
  color: var(--info);
  font-weight: 800;
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
  background: var(--bg-card);
  border-radius: 24rpx;
  border: 2rpx solid rgba(0, 0, 0, 0.04);
  transition: all 0.2s;
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.06);
}

.option-item.selected {
  background: rgba(28, 176, 246, 0.12);
  border-color: var(--info);
  box-shadow: 0 4rpx 16rpx rgba(28, 176, 246, 0.15);
}

.option-label {
  width: 48rpx;
  height: 48rpx;
  background: rgba(28, 176, 246, 0.12);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 26rpx;
  font-weight: 800;
  color: var(--text-secondary);
  margin-right: 20rpx;
  flex-shrink: 0;
  border: none;
}

.option-item.selected .option-label {
  background: var(--info);
  color: var(--text-inverse);
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
  font-weight: 800;
  border: none;
}

.nav-btn.prev {
  background: var(--bg-card);
  color: var(--text-primary);
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.06);
  border: 2rpx solid rgba(0, 0, 0, 0.04);
}

.nav-btn.next {
  background: var(--info);
  color: var(--text-inverse);
  box-shadow: 0 8rpx 0 #0e8ac0;
}

.nav-btn.next:active {
  transform: translateY(4rpx);
  box-shadow: 0 4rpx 0 #0e8ac0;
}

.nav-btn.submit {
  background: #58cc02;
  color: var(--text-inverse);
  box-shadow: 0 8rpx 0 #46a302;
}

.nav-btn.submit:active {
  transform: translateY(4rpx);
  box-shadow: 0 4rpx 0 #46a302;
}

.nav-btn[disabled] {
  opacity: 0.5;
}

/* 答题卡 */
.answer-sheet {
  background: var(--bg-card);
  border-radius: 28rpx;
  padding: 30rpx;
  margin-bottom: 30rpx;
  border: 2rpx solid rgba(0, 0, 0, 0.04);
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.06);
}

.sheet-title {
  font-size: 28rpx;
  font-weight: 800;
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
  background: var(--bg-card);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24rpx;
  color: var(--text-secondary);
  border: 2rpx solid rgba(0, 0, 0, 0.04);
}

.sheet-item.answered {
  background: var(--info);
  color: var(--text-inverse);
}

.sheet-item.current {
  border: 2rpx solid var(--info);
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
  font-weight: 800;
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
  font-weight: 800;
  color: var(--info);
}

.score-unit {
  font-size: 36rpx;
  color: var(--text-secondary);
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
  font-weight: 800;
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
  color: var(--text-secondary);
}

.result-message {
  padding: 30rpx;
  background: var(--bg-card);
  border-radius: 24rpx;
  margin-bottom: 40rpx;
  border: 2rpx solid rgba(0, 0, 0, 0.04);
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
  font-weight: 800;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
}

.action-btn.review {
  background: var(--bg-card);
  color: var(--text-primary);
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.06);
  border: 2rpx solid rgba(0, 0, 0, 0.04);
}

.action-btn.retry {
  background: var(--info);
  color: var(--text-inverse);
  box-shadow: 0 8rpx 0 #0e8ac0;
}

.action-btn.retry:active {
  transform: translateY(4rpx);
  box-shadow: 0 4rpx 0 #0e8ac0;
}

/* 错题列表 */
.wrong-list {
  margin-top: 30rpx;
}

.list-title {
  font-size: 32rpx;
  font-weight: 800;
  color: var(--text-primary);
  display: block;
  margin-bottom: 30rpx;
}

.wrong-item {
  padding: 24rpx;
  background: var(--bg-card);
  border-radius: 24rpx;
  margin-bottom: 20rpx;
  border: 2rpx solid rgba(0, 0, 0, 0.04);
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
