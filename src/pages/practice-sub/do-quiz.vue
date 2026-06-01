<template>
  <view class="container" :class="{ 'dark-mode': isDark, 'wot-theme-dark': isDark }">
    <view class="aurora-bg" />

    <view class="nav-header" :style="{ paddingTop: statusBarHeight + 'px', height: navBarHeight + 'px' }">
      <view class="nav-content" :style="{ paddingRight: capsuleMargin + 'px', height: '44px' }">
        <view class="back-area" hover-class="item-hover" @tap="handleExit">
          <BaseIcon name="arrow-left" :size="36" />
          <text id="e2e-quiz-progress" class="progress-text" @tap.stop="showAnswerSheet = true">
            {{ currentIndex + 1 }} / {{ questions.length }}
          </text>
        </view>
        <QuizProgress :total="questions.length" :current="currentIndex" :answered="answeredQuestions" />
        <!-- 单题计时器显示 -->
        <view class="timer-group">
          <view
            v-if="questionTimerEnabled && !hasAnswered"
            class="question-timer-box"
            :class="{ warning: showTimeWarning, danger: questionTimeRemaining <= 10 }"
          >
            <view class="timer-icon">
              <BaseIcon name="timer" :size="28" />
            </view>
            <text class="question-time">
              {{ formatTime(questionTimeRemaining) }}
            </text>
          </view>
          <view class="timer-box">
            <text class="total-label"> 总 </text>
            <text>{{ formatTime(seconds) }}</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 学习节奏管理：连续学习休息提醒 -->
    <view v-if="showBreakReminder" class="break-reminder-bar">
      <text class="break-reminder-text">你已连续学习 {{ Math.floor(seconds / 60) }} 分钟，适当休息效率更高</text>
      <view class="break-reminder-actions">
        <text class="break-dismiss" @tap="showBreakReminder = false">继续</text>
      </view>
    </view>

    <view v-if="comboFeedback" class="combo-feedback" :class="`level-${comboFeedback.level}`">
      <text class="combo-title">{{ comboFeedback.title }}</text>
      <text class="combo-desc">{{ comboFeedback.desc }}</text>
    </view>

    <scroll-view
      id="e2e-quiz-scroll"
      :scroll-y="!showResult"
      class="quiz-scroll"
      :style="{ paddingTop: navBarHeight + 'px' }"
      @touchstart="onTouchStart"
      @touchmove="onTouchMove"
      @touchend="onTouchEnd"
    >
      <view v-if="showQuizLoading" class="quiz-loading-overlay glass-card">
        <view class="quiz-loading-orbit">
          <view class="quiz-loading-dot" />
          <view class="quiz-loading-dot secondary" />
        </view>
        <text class="quiz-loading-title">正在准备题目</text>
        <text class="quiz-loading-subtitle">加载本地题库与练习进度</text>
        <view class="quiz-loading-skeleton">
          <view class="quiz-loading-line long" />
          <view class="quiz-loading-line" />
          <view class="quiz-loading-line short" />
        </view>
      </view>

      <!-- Phase 3-4: 卡片堆叠 — 下一题预览（第二层） -->
      <view
        v-if="questions[currentIndex + 1] && cardStack"
        class="question-container stack-card"
        :style="cardStack.nextCardStyle.value"
      >
        <view class="glass-card question-card">
          <view class="q-header">
            <view class="q-tag">{{ questions[currentIndex + 1].type || '单选题' }}</view>
          </view>
          <view class="q-content-preview">{{ (questions[currentIndex + 1].question || '').substring(0, 60) }}...</view>
        </view>
      </view>

      <view
        v-if="currentQuestion"
        class="question-container"
        :class="[correctAnimationClass, wrongAnimationClass]"
        :style="
          cardStack && cardStack.deltaX.value
            ? cardStack.currentCardStyle.value
            : swipeDeltaX
              ? { transform: `translateX(${swipeDeltaX}px)`, transition: 'none' }
              : { transition: 'transform 0.3s ease' }
        "
      >
        <view
          v-if="currentQuestion"
          :class="[
            'glass-card',
            'question-card',
            {
              'card-answered': showResult,
              'card-correct': showResult && resultStatus === 'correct',
              'card-wrong': showResult && resultStatus === 'wrong'
            }
          ]"
        >
          <view class="q-header">
            <view class="q-tag">
              {{ questionTypeLabel }}
            </view>
            <view class="q-actions">
              <!-- 笔记按钮 -->
              <view
                class="note-btn"
                :class="{ 'has-notes': currentQuestionNotes.length > 0 }"
                hover-class="item-hover"
                @tap.stop="handleOpenNote"
              >
                <view class="note-icon">
                  <BaseIcon name="note" :size="28" />
                </view>
                <text v-if="currentQuestionNotes.length > 0" class="note-count">
                  {{ currentQuestionNotes.length }}
                </text>
              </view>
              <!-- 收藏按钮 -->
              <view
                class="favorite-btn"
                :class="{ 'is-favorited': isCurrentFavorited }"
                hover-class="item-hover"
                @tap.stop="handleToggleFavorite"
              >
                <view class="favorite-icon">
                  <BaseIcon :name="isCurrentFavorited ? 'star' : 'star-outline'" :size="28" />
                </view>
              </view>
            </view>
          </view>
          <view v-if="currentQuestionPassage" class="q-passage-card">
            <view class="q-passage-head">
              <view class="q-passage-title-block">
                <text class="q-passage-kicker">{{ currentQuestion.section || '阅读材料' }}</text>
                <text class="q-passage-tip">点选关键句，保存为第 {{ currentQuestionNumberText }} 题依据</text>
              </view>
              <text v-if="currentQuestion.paperName || currentQuestion.year" class="q-passage-meta">
                {{ currentQuestion.paperName || `${currentQuestion.year}年真题` }}
              </text>
            </view>
            <view v-if="currentQuestionFixedSequence.length" class="q-fixed-sequence">
              <text
                v-for="(item, itemIndex) in currentQuestionFixedSequence"
                :key="`${currentQuestion.id || currentIndex}-fixed-${itemIndex}`"
                class="q-fixed-sequence-item"
                :class="{ locked: isFixedParagraph(item) }"
              >
                {{ item }}
              </text>
            </view>
            <scroll-view scroll-y class="q-passage-scroll">
              <view v-if="currentQuestionPassageSegments.length" class="q-passage-segments">
                <view
                  v-for="(segment, segmentIndex) in currentQuestionPassageSegments"
                  :key="`${currentQuestion.id || currentIndex}-${segmentIndex}`"
                  class="q-passage-segment"
                  :class="{ active: isPassageSegmentSelected(segmentIndex) }"
                  hover-class="item-hover"
                  @tap="togglePassageSegment(segmentIndex)"
                >
                  <view class="q-segment-marker">
                    <text>{{ segmentIndex + 1 }}</text>
                  </view>
                  <RichText class="q-passage-content" :content="segment" />
                </view>
              </view>
              <RichText v-else class="q-passage-content" :content="currentQuestionPassage" />
            </scroll-view>
            <view v-if="currentPassageAnnotationText" class="q-passage-annotation">
              <text>{{ currentPassageAnnotationText }}</text>
              <text class="q-passage-clear" @tap="clearCurrentPassageAnnotations">清除</text>
            </view>
          </view>
          <RichText class="q-content" :content="currentQuestion.question" />
          <view v-if="currentQuestionImages.length" class="q-image-list">
            <view
              v-for="(image, imageIndex) in currentQuestionImages"
              :key="`${currentQuestion.id || currentIndex}-question-image-${imageIndex}`"
              class="q-image-card"
            >
              <image
                class="q-source-image"
                :src="image.src"
                :alt="image.alt || image.caption || '试卷原页'"
                mode="widthFix"
                lazy-load
                show-menu-by-longpress
              />
              <text v-if="image.caption" class="q-image-caption">{{ image.caption }}</text>
            </view>
          </view>
        </view>

        <view v-if="hasSelectableOptions" class="options-list">
          <view
            v-for="(opt, idx) in currentQuestion.options"
            :id="`e2e-quiz-option-${idx}`"
            :key="idx"
            :class="[
              'glass-card',
              'option-item',
              {
                selected: userChoice === idx,
                correct: hasAnswered && isCorrectOption(idx),
                wrong: hasAnswered && userChoice === idx && !isCorrectOption(idx),
                'option-folded': isOptionFolded(idx),
                'option-muted-after-answer': isOptionDeemphasized(idx),
                disabled: isAnalyzing || (hasAnswered && userChoice !== idx)
              }
            ]"
            hover-class="option-hover"
            @tap="selectOption(idx)"
          >
            <view class="opt-index">
              {{ getOptionLabel(idx) }}
            </view>
            <RichText class="opt-text" :content="opt" />
            <view v-if="hasAnswered" class="select-indicator">
              <BaseIcon v-if="isCorrectOption(idx)" name="check" :size="28" />
              <BaseIcon v-else-if="userChoice === idx && !isCorrectOption(idx)" name="cross" :size="28" />
              <view v-else-if="userChoice === idx" class="indicator-circle" />
            </view>
          </view>
        </view>

        <!-- 经典闪卡模式：翻转卡片 + FSRS 四级自评 -->
        <view v-if="isFlashcardMode" class="flashcard-area">
          <!-- 翻转前：显示"翻转查看答案"按钮 -->
          <view v-if="!flashcardFlipped" class="flashcard-reveal">
            <view class="flashcard-hint">想好答案了吗？</view>
            <view class="flashcard-reveal-btn" hover-class="item-hover" @tap="flipFlashcard">
              <BaseIcon name="eye" :size="32" />
              <text class="flashcard-reveal-text">翻转查看答案</text>
            </view>
          </view>

          <!-- 翻转后：显示答案 + FSRS 四级评分 -->
          <view v-else class="flashcard-answer-area">
            <view class="flashcard-answer-card glass-card">
              <view class="flashcard-answer-label">
                <BaseIcon name="check" :size="24" />
                <text>参考答案</text>
              </view>
              <scroll-view scroll-y class="flashcard-answer-scroll">
                <RichText class="flashcard-answer-content" :content="currentQuestion.answer || '暂无答案'" />
                <view v-if="currentAnswerImages.length" class="q-image-list answer-images">
                  <view
                    v-for="(image, imageIndex) in currentAnswerImages"
                    :key="`${currentQuestion.id || currentIndex}-answer-image-${imageIndex}`"
                    class="q-image-card"
                  >
                    <image
                      class="q-source-image"
                      :src="image.src"
                      :alt="image.alt || image.caption || '答案原页'"
                      mode="widthFix"
                      lazy-load
                      show-menu-by-longpress
                    />
                    <text v-if="image.caption" class="q-image-caption">{{ image.caption }}</text>
                  </view>
                </view>
              </scroll-view>
              <view v-if="currentQuestion.desc && currentQuestion.desc !== '暂无解析'" class="flashcard-explanation">
                <text class="flashcard-explanation-label">解析</text>
                <RichText class="flashcard-explanation-content" :content="currentQuestion.desc" />
              </view>
            </view>

            <!-- FSRS 四级自评按钮 -->
            <view class="flashcard-rate-hint">根据记忆情况自评：</view>
            <view class="fsrs-rating-row flashcard-rating">
              <view class="fsrs-rating-btn fsrs-again" @tap="rateFlashcardAndNext(1)">
                <text class="fsrs-rating-label">忘了</text>
                <text class="fsrs-rating-interval">{{ getFlashcardInterval('again') }}</text>
              </view>
              <view class="fsrs-rating-btn fsrs-hard" @tap="rateFlashcardAndNext(2)">
                <text class="fsrs-rating-label">模糊</text>
                <text class="fsrs-rating-interval">{{ getFlashcardInterval('hard') }}</text>
              </view>
              <view class="fsrs-rating-btn fsrs-good" @tap="rateFlashcardAndNext(3)">
                <text class="fsrs-rating-label">记得</text>
                <text class="fsrs-rating-interval">{{ getFlashcardInterval('good') }}</text>
              </view>
              <view class="fsrs-rating-btn fsrs-easy" @tap="rateFlashcardAndNext(4)">
                <text class="fsrs-rating-label">简单</text>
                <text class="fsrs-rating-interval">{{ getFlashcardInterval('easy') }}</text>
              </view>
            </view>
          </view>
        </view>
      </view>

      <view class="footer-placeholder" />
    </scroll-view>

    <!-- ✅ [P0重构] AI分析已改为非阻塞，移除全屏遮罩 -->
    <!-- AI解析在结果弹窗内异步加载，用户可随时点击下一题 -->

    <!-- 结果弹窗背景遮罩 -->
    <view v-if="showResult" class="result-backdrop" @tap.stop />

    <!-- 结果弹窗 -->
    <view v-if="showResult" :class="['result-pop', resultStatus]">
      <view class="result-header">
        <view class="result-status-mark">
          <BaseIcon :name="resultStatus === 'correct' ? 'check' : 'cross'" :size="30" />
        </view>
        <text class="status-title">
          {{ resultStatus === 'correct' ? '回答正确' : '再想想' }}
        </text>
      </view>

      <scroll-view scroll-y class="result-content-scroll">
        <view v-if="resultStatus === 'wrong'" class="ai-analysis-scroll">
          <view class="analysis-tag">
            <view class="sparkle-icon">
              <BaseIcon name="sparkle" :size="28" />
            </view>
            <text>解析</text>
            <!-- ✅ [P0重构] 内联AI加载指示器 -->
            <text v-if="!aiComment" class="ai-loading-hint">分析中...</text>
          </view>
          <!-- AI 个人历史微反馈 — 基于错题历史的一句话上下文提醒 -->
          <view v-if="personalHint" class="personal-hint-bar">
            <text class="personal-hint-text">{{ personalHint }}</text>
          </view>
          <view class="answer-display">
            <text class="answer-label"> 正确答案： </text>
            <text class="answer-value">
              {{ currentQuestion ? currentQuestion.answer : 'A' }}
            </text>
          </view>
          <view v-if="currentAnswerImages.length" class="q-image-list result-answer-images">
            <view
              v-for="(image, imageIndex) in currentAnswerImages"
              :key="`${currentQuestion.id || currentIndex}-result-answer-image-${imageIndex}`"
              class="q-image-card"
            >
              <image
                class="q-source-image"
                :src="image.src"
                :alt="image.alt || image.caption || '答案原页'"
                mode="widthFix"
                lazy-load
                show-menu-by-longpress
              />
              <text v-if="image.caption" class="q-image-caption">{{ image.caption }}</text>
            </view>
          </view>
          <view v-if="knowledgeCard" class="knowledge-card">
            <view class="knowledge-card-head">
              <text class="knowledge-label">考点</text>
              <text class="knowledge-title">{{ knowledgeCard.title }}</text>
            </view>
            <view v-if="knowledgeCard.tags.length" class="knowledge-tags">
              <text v-for="tag in knowledgeCard.tags" :key="tag" class="knowledge-tag">{{ tag }}</text>
            </view>
            <RichText v-if="knowledgeCard.detail" class="knowledge-detail" :content="knowledgeCard.detail" />
          </view>
          <RichText
            class="analysis-body"
            :content="aiComment || (currentQuestion ? currentQuestion.desc : '暂无解析')"
          />
        </view>

        <view v-else class="ai-analysis-brief">
          <view v-if="knowledgeCard" class="knowledge-card compact">
            <view class="knowledge-card-head">
              <text class="knowledge-label">考点</text>
              <text class="knowledge-title">{{ knowledgeCard.title }}</text>
            </view>
            <view v-if="knowledgeCard.tags.length" class="knowledge-tags">
              <text v-for="tag in knowledgeCard.tags" :key="tag" class="knowledge-tag">{{ tag }}</text>
            </view>
            <RichText v-if="knowledgeCard.detail" class="knowledge-detail" :content="knowledgeCard.detail" />
          </view>
          <view v-else>
            <text class="label">解析：</text>
            <RichText :content="aiComment || (currentQuestion ? currentQuestion.desc : '暂无解析')" />
            <view v-if="currentAnswerImages.length" class="q-image-list result-answer-images">
              <view
                v-for="(image, imageIndex) in currentAnswerImages"
                :key="`${currentQuestion.id || currentIndex}-brief-answer-image-${imageIndex}`"
                class="q-image-card"
              >
                <image
                  class="q-source-image"
                  :src="image.src"
                  :alt="image.alt || image.caption || '答案原页'"
                  mode="widthFix"
                  lazy-load
                  show-menu-by-longpress
                />
                <text v-if="image.caption" class="q-image-caption">{{ image.caption }}</text>
              </view>
            </view>
          </view>
        </view>

        <!-- 新增: FSRS 记忆引擎状态展示 -->
        <MemoryStatsRow v-if="memoryState" :memory-state="memoryState" />

        <!-- 新增: AI Tutor 智能体辅导反馈 -->
        <TutorFeedbackCard v-if="tutorFeedback" :feedback="tutorFeedback" />
      </scroll-view>

      <view class="result-action-row">
        <view
          id="e2e-quiz-next-btn"
          class="result-next-btn result-primary-action"
          :class="{ disabled: isNavigating }"
          hover-class="result-primary-action-hover"
          role="button"
          :aria-disabled="isNavigating ? 'true' : 'false'"
          @tap.stop="closeResult"
        >
          <view class="result-action-icon">
            <BaseIcon :name="resultStatus === 'correct' ? 'check' : 'arrow-right'" :size="30" />
          </view>
          <text class="result-primary-label">
            {{ isNavigating ? '加载中' : resultStatus === 'correct' ? '下一题' : '继续' }}
          </text>
        </view>
      </view>
    </view>

    <!-- ✅ 自定义弹窗：题库为空 -->
    <CustomModal
      :visible="showEmptyBankModal"
      type="upload"
      title="题库空空如也"
      content="请先到刷题中心加载题库，再开始练习。"
      confirm-text="去加载"
      :show-cancel="false"
      :is-dark="isDark"
      @confirm="handleEmptyBankConfirm"
    />

    <!-- ✅ 自定义弹窗：恢复进度 -->
    <CustomModal
      :visible="showResumeModal"
      type="info"
      title="检测到未完成的练习"
      :content="resumeModalContent"
      confirm-text="继续答题"
      cancel-text="重新开始"
      :show-cancel="true"
      :is-dark="isDark"
      @confirm="handleResumeConfirm"
      @cancel="handleResumeCancel"
    />

    <!-- ✅ 自定义弹窗：确认退出 -->
    <CustomModal
      :visible="showExitModal"
      type="warning"
      title="确认退出？"
      :content="
        answeredQuestions.length > 0
          ? `已完成 ${answeredQuestions.length} 道题，进度将自动保存，下次可继续答题。`
          : '确定要退出吗？'
      "
      confirm-text="确认退出"
      cancel-text="继续答题"
      :show-cancel="true"
      :is-dark="isDark"
      @confirm="handleExitConfirm"
      @cancel="showExitModal = false"
    />

    <!-- ✅ [P1重构] 练习完成 — 全屏结果页（含AI诊断+推荐下一步） -->
    <QuizResult
      :visible="showCompleteModal"
      :questions="questions"
      :answered-questions="answeredQuestions"
      :total-time="seconds * 1000"
      :is-dark="isDark"
      :diagnosis-summary="diagnosisSummary"
      :has-next-recommendation="hasNextRecommendation"
      @view-report="viewDiagnosisReport"
      @close="handleCompleteConfirm"
      @continue-next="handleCompleteAction"
      @go-mistakes="navigateFromResult('/pages/mistake/index')"
      @go-weak-training="navigateFromResult('/pages/practice-sub/do-quiz?mode=smart_review')"
      @go-new-practice="handleCompleteConfirm"
      @go-a-i-plan="navigateFromResult('/pages/practice-sub/do-quiz?mode=smart_review')"
    />

    <!-- ✅ 笔记输入弹窗 -->
    <view v-if="showNoteModal" class="note-modal-overlay" @tap="showNoteModal = false">
      <view class="note-modal" @tap.stop>
        <view class="note-modal-header">
          <text class="note-modal-title"> 添加笔记 </text>
          <view class="note-modal-close" hover-class="item-hover" @tap="showNoteModal = false">
            <BaseIcon name="close" :size="28" />
          </view>
        </view>
        <textarea
          v-model="noteContent"
          class="note-textarea"
          placeholder="记录你的学习心得..."
          :maxlength="500"
        ></textarea>
        <view class="note-tags">
          <view
            v-for="tag in availableNoteTags"
            :key="tag.id"
            class="note-tag"
            :class="{ selected: selectedNoteTags.includes(tag.id) }"
            :style="{ borderColor: tag.color }"
            hover-class="item-hover"
            @tap="toggleNoteTag(tag.id)"
          >
            <text>{{ tag.icon }} {{ tag.name }}</text>
          </view>
        </view>
        <view class="note-modal-footer">
          <wd-button plain custom-class="note-cancel-btn" @click="showNoteModal = false">取消</wd-button>
          <wd-button custom-class="note-save-btn" @click="handleSaveNote">保存</wd-button>
        </view>
      </view>
    </view>

    <AnswerSheet
      :visible="showAnswerSheet"
      :questions="questions"
      :current-index="currentIndex"
      :answered-questions="answeredQuestions"
      @jump="handleJumpToQuestion"
      @close="showAnswerSheet = false"
    />

    <!-- 离线状态指示器 -->
    <OfflineIndicator :auto-show="true" position="top" :auto-hide-delay="0" />
  </view>
</template>

<script>
import { modal } from '@/utils/modal.js';
import { toast } from '@/utils/toast.js';
import { storageService } from '@/services/storageService.js';
import CustomModal from '@/components/common/CustomModal.vue';
import { useStudyStore } from '@/stores/modules/study';

// ✅ P0-3: 导入自动保存功能
import {
  saveQuizProgress,
  loadQuizProgress,
  clearQuizProgress,
  hasUnfinishedProgress,
  getProgressSummary
} from '@/composables/useQuizAutoSave.js';
// ✅ 检查点 5.1: 导入分析服务
import { analytics } from '@/utils/analytics/event-bus-analytics.js';
import { getStatusBarHeight, getWindowInfo } from '@/utils/core/system.js';
// ✅ 检查点 5.3: 自适应学习引擎（懒加载：仅在 isAdaptiveMode 时动态导入）
// ✅ 导入题目收藏模块（通过 Store，自动走后端或本地）
import { useFavoriteStore } from '@/stores/modules/favorite.js';
// ✅ [P3] FSRS复习日程预览
import { scheduleMistakeReview } from './utils/mistake-fsrs-scheduler.js';
// ✅ 导入滑动手势模块
import {
  initSwipeGesture,
  bindSwipeCallbacks,
  handleTouchStart,
  handleTouchMove,
  handleTouchEnd
} from './swipe-gesture.js';
import {
  destroySoundResources,
  playClickSound,
  playCompleteFanfare,
  playFlipSound,
  playQuizSound
} from './utils/quiz-sound.js';
// ✅ Phase 3-4: 卡片堆叠切换
import { useCardStack } from './composables/useCardStack.js';
// ✅ 导入单题计时器模块
import { startTimer as startQuestionTimer, stopTimer as stopQuestionTimer } from './question-timer.js';
// ✅ 智能组题与自适应学习模块
import { pickQuestions } from './utils/smart-question-picker.js';
import { generateAdaptiveSequence, getNextRecommendedQuestion } from '@/utils/learning/adaptive-learning-engine.js';
// 离线缓存：使用统一的离线缓存服务
import { checkOfflineAvailability } from './services/offline-cache-service.js';
// ✅ 导入题目笔记模块
import { addQuestionNote, getNotesByQuestion, getNoteTags } from './question-note.js';
// ✅ P1: 提取的模块
import {
  saveToMistakes as saveMistake,
  updateMistakeWithAI as updateMistakeAI,
  generateMnemonic
} from './quiz-mistake-handler.js';
import { fetchAIDeepAnalysis as fetchAIAnalysis } from './quiz-ai-analysis.js';
import { recordAnswerToAnalytics as recordAnalytics } from './quiz-analytics-recorder.js';
// ✅ AI 打字机效果
import { useTypewriter } from './composables/useTypewriter.js';
// ✅ 统一日志工具（生产环境自动禁用）
import { logger } from '@/utils/logger.js';

import { useReviewStore } from '@/stores/modules/review.js';
import { safeNavigateTo, safeNavigateBack, safeRedirectTo } from '@/utils/safe-navigate';
import {
  calculateSpeedScore as calculateQuizSpeedScore,
  getQuestionEloRating,
  rankQuestionsByEloMatch,
  readEloState,
  saveEloState,
  updateEloRating
} from '@/utils/quiz-elo.js';
import BaseIcon from '@/components/base/base-icon/base-icon.vue';
// 静态资源 CDN 映射（大图已迁出主包）
import { ASSETS } from '@/config/static-assets.js';
import MemoryStatsRow from './components/quiz-result/MemoryStatsRow.vue';
import TutorFeedbackCard from './components/quiz-result/TutorFeedbackCard.vue';
import QuizResult from './components/quiz-result/quiz-result.vue';
import RichText from './components/RichText.vue';
import AnswerSheet from './components/answer-sheet/answer-sheet.vue';
import QuizProgress from './components/quiz-progress/quiz-progress.vue';
import { buildComboFeedback, calculateCorrectStreak } from './utils/session-feedback.js';
// ✅ [P0重构] 核心引擎 composable
import { useQuizEngine } from './composables/useQuizEngine.js';
import {
  buildQuizCompletionContent,
  buildQuizAnswerRecord,
  getQuizOptionLabel,
  getQuizQuestionTypeLabel,
  hasQuizSelectableOptions,
  isCorrectQuizOption,
  isQuizFlashcardMode,
  normalizeQuizQuestion,
  upsertQuizAnswerRecord
} from '@/services/quiz-session-contract.js';
import {
  scheduleAndSave,
  previewSchedule,
  formatInterval,
  loadCardState,
  createNewCard
} from '@/services/fsrs-service.js';
import { triggerOptimization } from './services/fsrs-optimizer-client.js';

function normalizePracticeQuestion(q, index, options = {}) {
  return normalizeQuizQuestion(q, index, options);
}

export default {
  components: {
    CustomModal,
    BaseIcon,
    MemoryStatsRow,
    TutorFeedbackCard,
    QuizResult,
    RichText,
    AnswerSheet,
    QuizProgress
  },

  // ✅ [P0重构] 桥接 useQuizEngine — 核心状态和纯逻辑由 composable 管理
  setup() {
    const engine = useQuizEngine({ smartPicker: true, adaptiveMode: true });
    const reviewStore = useReviewStore();
    return {
      quizEngine: engine,
      engineGetOptionLabel: engine.getOptionLabel,
      engineIsCorrectOption: engine.isCorrectOption,
      // ✅ reviewStore — 替代页面直接调用 lafService
      reviewStore
    };
  },
  data() {
    return {
      memoryState: null,
      fsrsPreview: null, // { again: {intervalDays}, hard: {intervalDays}, good: {intervalDays}, easy: {intervalDays} }
      tutorFeedback: '',
      // 经典闪卡模式状态
      flashcardFlipped: false,
      flashcardFsrsPreview: null,
      statusBarHeight: 44,
      navBarHeight: 88, // 标准导航栏高度 = 44 + 44
      capsuleMargin: 100,
      questions: [],
      currentIndex: 0,
      userChoice: null,
      hasAnswered: false,
      seconds: 0,
      timer: null,
      isAnalyzing: false,
      showResult: false,
      resultStatus: '', // 'correct' or 'wrong'
      aiComment: '',
      personalHint: '', // 基于个人历史的AI微反馈
      showBreakReminder: false, // 休息提醒显示状态
      breakReminderShown: false, // 是否已提醒过（每次练习只提醒一次）
      // ✅ P0-3: 已答题目记录（用于断点续答）
      answeredQuestions: [],
      // ✅ 自定义弹窗状态
      showEmptyBankModal: false,
      showResumeModal: false,
      showExitModal: false,
      showCompleteModal: false,
      resumeModalContent: '',
      // AI诊断闭环状态
      diagnosisLoading: false,
      sessionId: '', // 刷题会话ID（用于AI诊断）
      diagnosisId: '', // 诊断报告ID
      diagnosisReady: false, // 诊断是否完成
      diagnosisSummary: '', // 诊断摘要
      hasNextRecommendation: false, // ✅ [P1] AI是否已推荐下一组题目
      nextRecommendationIds: [], // ✅ [P1] AI推荐的下一组题目ID
      isDark: false,
      // ✅ 防重复点击状态
      isNavigating: false, // 防止快速连续点击"下一题"
      // ✅ 检查点 5.3: 自适应学习状态
      isAdaptiveMode: true, // 是否启用自适应模式
      currentReviewQuestion: null, // 当前复习题
      answerStartTime: 0, // 答题开始时间（用于计算用时）
      // ✅ 收藏状态
      isCurrentFavorited: false, // 当前题目是否已收藏
      // ✅ 滑动手势状态
      swipeDeltaX: 0, // 滑动偏移量
      isSwipeAnimating: false, // 是否正在滑动动画
      // ✅ Phase 3-4: 卡片堆叠切换
      cardStack: null, // useCardStack() 实例
      // ✅ 答题动画状态
      correctAnimationClass: '', // 正确答案动画类
      wrongAnimationClass: '', // 错误答案动画类
      comboFeedback: null,
      comboFeedbackTimer: null,
      // ✅ 单题计时器状态
      questionTimeLimit: 120, // 当前题目时限（秒）
      questionTimeRemaining: 120, // 剩余时间
      showTimeWarning: false, // 是否显示时间警告
      questionTimerEnabled: true, // 是否启用单题计时
      questionBankFingerprint: '',
      forceResumeProgress: false,
      // ✅ 智能组题状态
      smartPickerEnabled: true, // 是否启用智能组题
      currentQuestionDifficulty: 2, // 当前题目难度
      // ✅ 离线缓存状态
      isOfflineMode: false, // 是否处于离线模式
      offlineAvailable: false, // 是否有离线数据可用
      // ✅ 题目笔记状态
      currentQuestionNotes: [], // 当前题目的笔记
      showNoteModal: false, // 是否显示笔记弹窗
      noteContent: '', // 笔记内容
      selectedNoteTags: [], // 选中的笔记标签
      passageAnnotations: {},
      showAnswerSheet: false, // 答题卡显示状态
      mode: '', // 刷题模式：'' | 'single' | 'temp_bank' | 'smart_review'
      eloState: { userRating: 1500, questionRatings: {} },
      pendingTimers: [] // [AUDIT FIX R264] setTimeout 追踪，防止内存泄漏
    };
  },
  computed: {
    showQuizLoading() {
      return !this.currentQuestion && !this.showEmptyBankModal && !this.showResumeModal && !this.showCompleteModal;
    },
    completeModalContent() {
      return buildQuizCompletionContent({
        questions: this.questions,
        answeredQuestions: this.answeredQuestions || [],
        diagnosisLoading: this.diagnosisLoading,
        diagnosisReady: this.diagnosisReady,
        diagnosisSummary: this.diagnosisSummary,
        hasNextRecommendation: this.hasNextRecommendation,
        nextReviewDelayMs: this.getCompletionNextReviewDelayMs()
      });
    },
    currentQuestion() {
      const q = this.questions[this.currentIndex];
      if (!q) return null;

      return normalizeQuizQuestion(q, this.currentIndex, {
        defaultQuestion: '题目加载中...',
        resolveEloRating: (question) => getQuestionEloRating(question, this.eloState.questionRatings)
      });
    },
    quizProgressContext() {
      return {
        mode: this.mode || 'normal',
        paperId: this.paperId || '',
        questionBankFingerprint: this.questionBankFingerprint || ''
      };
    },
    currentQuestionPassage() {
      return (
        this.currentQuestion?.passage ||
        this.currentQuestion?.context ||
        this.currentQuestion?.material ||
        this.currentQuestion?.article ||
        ''
      );
    },
    currentQuestionPassageSegments() {
      return Array.isArray(this.currentQuestion?.passageSegments) ? this.currentQuestion.passageSegments : [];
    },
    currentQuestionImages() {
      return Array.isArray(this.currentQuestion?.questionImages) ? this.currentQuestion.questionImages : [];
    },
    currentAnswerImages() {
      return Array.isArray(this.currentQuestion?.answerImages) ? this.currentQuestion.answerImages : [];
    },
    currentQuestionNumberText() {
      return this.currentQuestion?.number || this.currentIndex + 1;
    },
    currentQuestionFixedSequence() {
      return Array.isArray(this.currentQuestion?.fixedSequence) ? this.currentQuestion.fixedSequence : [];
    },
    currentQuestionFixedParagraphs() {
      return Array.isArray(this.currentQuestion?.fixedParagraphs) ? this.currentQuestion.fixedParagraphs : [];
    },
    currentPassageAnnotationKey() {
      return this.currentQuestion?.id || this.currentQuestion?.question || `question-${this.currentIndex}`;
    },
    currentPassageAnnotations() {
      return this.passageAnnotations[this.currentPassageAnnotationKey] || [];
    },
    currentPassageAnnotationText() {
      const selected = this.currentPassageAnnotations;
      if (!selected.length) return '';
      return `已标注 ${selected.length} 个片段作为第 ${this.currentQuestionNumberText} 题依据`;
    },
    knowledgeCard() {
      if (!this.currentQuestion) return null;
      const tags = [
        this.currentQuestion.knowledge_point,
        this.currentQuestion.knowledgePoint,
        this.currentQuestion.section,
        this.currentQuestion.category,
        ...(Array.isArray(this.currentQuestion.knowledge_points) ? this.currentQuestion.knowledge_points : []),
        ...(Array.isArray(this.currentQuestion.tags) ? this.currentQuestion.tags : [])
      ]
        .filter(Boolean)
        .map((item) => String(item).trim())
        .filter(Boolean);
      const uniqueTags = Array.from(new Set(tags)).slice(0, 4);
      const title = uniqueTags[0] || this.questionTypeLabel || '当前题目';
      const explicitDetail =
        this.currentQuestion.knowledgeSummary ||
        this.currentQuestion.knowledge_summary ||
        this.currentQuestion.concept ||
        this.currentQuestion.keyPoint ||
        this.currentQuestion.key_point ||
        '';
      const detail = explicitDetail || (this.resultStatus === 'correct' ? this.aiComment || this.currentQuestion.desc || '' : '');

      if (!title && !detail) return null;
      return {
        title,
        tags: uniqueTags.slice(1),
        detail: detail && detail !== '暂无解析' ? detail : ''
      };
    },
    // 是否为闪卡模式（分析题或经典闪卡，无选项可选）
    isFlashcardMode() {
      return isQuizFlashcardMode(this.currentQuestion);
    },
    questionTypeLabel() {
      return getQuizQuestionTypeLabel(this.currentQuestion);
    },
    hasSelectableOptions() {
      return hasQuizSelectableOptions(this.currentQuestion);
    },
    isCorrectOption() {
      return (idx) => {
        return isCorrectQuizOption(this.currentQuestion, idx);
      };
    },
    isOptionFolded() {
      return (idx) => {
        if (!this.hasAnswered) return false;
        if (this.isCorrectOption(idx)) return false;
        return this.userChoice !== idx;
      };
    },
    isOptionDeemphasized() {
      return (idx) => {
        if (!this.hasAnswered) return false;
        return !this.isCorrectOption(idx) && this.userChoice !== idx;
      };
    },
    // ✅ 完美全对检测（用于庆祝动画）
    isPerfectScore() {
      return (
        this.showCompleteModal && this.answeredQuestions.length > 0 && this.answeredQuestions.every((a) => a.isCorrect)
      );
    },
    // ✅ 可用的笔记标签
    availableNoteTags() {
      return getNoteTags();
    }
  },

  // [F2-FIX] 微信分享配置
  onShareAppMessage() {
    return {
      title: '智能刷题 - Exam-Master 考研备考',
      path: '/pages/practice/index',
      imageUrl: ASSETS.appShareCover
    };
  },

  onLoad() {
    this.initSystemUI();

    // ✅ 生成刷题会话ID（用于AI诊断闭环）
    this.sessionId = `quiz_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    // ✅ F024: 统一使用 storageService 读取主题
    this.isDark = storageService.get('theme_mode', 'light') === 'dark';

    // E005: 注册主题监听一次（在 onLoad 而非 onShow，避免重复绑定）
    this._themeHandler = (mode) => {
      this.isDark = mode === 'dark';
    };
    uni.$on('themeUpdate', this._themeHandler);

    // ✅ 初始化滑动手势
    this.initSwipeGesture();
    this.loadPassageAnnotations();

    // ✅ Phase 3-4: 初始化卡片堆叠切换
    this.cardStack = useCardStack({
      onSwipeLeft: () => {
        if (!this.hasAnswered && this.currentIndex < this.questions.length - 1) {
          this.goToNextQuestion();
        }
      },
      onSwipeRight: () => {
        if (!this.hasAnswered && this.currentIndex > 0) {
          this.goToPrevQuestion();
        }
      }
    });

    // 读取页面参数（uni-app onLoad 接收 query 对象）
    const pages = getCurrentPages();
    const currentPage = pages[pages.length - 1];
    const query = currentPage?.$page?.options || currentPage?.options || {};
    this.mode = query.mode || '';
    this.paperId = query.paperId || query.paper_id || '';
    this.forceResumeProgress = query.resume === 'true';
    if (query.mode === 'single') {
      this._singleMode = true;
    }
    // ✅ [闭环核心] 智能复习模式：从smart-review页传入的复习题目
    if (query.mode === 'smart_review') {
      this._smartReviewMode = true;
    }
    this.eloState = readEloState(storageService);

    // E005: 延迟重计算，让 UI 先渲染
    this._safeTimeout(() => {
      this.loadQuestions();

      // ✅ P0-3: 检查是否有未完成的进度
      this.checkUnfinishedProgress();

      // ✅ 检查点 5.1: 追踪开始刷题事件
      analytics.trackStartPractice({
        questionCount: this.questions.length,
        mode: this.isAdaptiveMode ? 'adaptive' : 'normal'
      });

    }, 16);
  },
  onShow() {
    // 主题监听已在 onLoad 注册，仅刷新当前值
    this.isDark = storageService.get('theme_mode', 'light') === 'dark';
    // ✅ P1-1: 恢复计时器（onHide 时已暂停）
    if (this.questions && this.questions.length > 0 && !this.timer) {
      this.startTimer();
    }
  },
  onUnload() {
    if (this.timer) {
      clearInterval(this.timer);
    }
    stopQuestionTimer();
    this.clearComboFeedback();

    // [AUDIT FIX R264] 清理所有未完成的 setTimeout，防止内存泄漏
    this.pendingTimers.forEach(clearTimeout);
    this.pendingTimers = [];

    // 移除主题事件监听，避免重复绑定
    uni.$off('themeUpdate', this._themeHandler);

    // ✅ P0-3: 页面卸载时保存进度
    this.saveCurrentProgress(true);

    // ✅ FIX: 错题复习模式结束后恢复原题库
    this._restoreQuestionBankIfReview();

    destroySoundResources();
  },

  // ✅ P0-3: 页面隐藏时也保存进度（应对小程序被杀死的情况）
  onHide() {
    this.clearComboFeedback();
    // ✅ P1-1: 暂停计时器，避免后台持续计时
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    stopQuestionTimer();
    this.saveCurrentProgress(true);
  },
  methods: {
    // [AUDIT FIX R264] 安全的 setTimeout 包装，组件卸载时自动清理
    _safeTimeout(fn, delay) {
      const id = setTimeout(() => {
        this.pendingTimers = this.pendingTimers.filter((t) => t !== id);
        fn();
      }, delay);
      this.pendingTimers.push(id);
      return id;
    },
    // ✅ FIX: 恢复错题复习模式前的题库
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
    getFlashcardInterval(ratingKey) {
      const intervalDays = this.flashcardFsrsPreview?.[ratingKey]?.intervalDays;
      return intervalDays == null ? '' : this.formatFsrsInterval(intervalDays);
    },
    // ✅ P0-3: 检查未完成的进度
    checkUnfinishedProgress() {
      const progressContext = this.forceResumeProgress ? null : this.quizProgressContext;
      if (hasUnfinishedProgress(progressContext)) {
        const summary = getProgressSummary(progressContext);
        if (summary && summary.currentIndex > 0) {
          // ✅ 使用自定义弹窗
          this.resumeModalContent = `上次答到第 ${summary.currentIndex + 1} 题，用时 ${summary.formattedTime}（${summary.timeAgo}保存）。是否继续？`;
          this.showResumeModal = true;
        } else {
          this.startTimer();
        }
      } else {
        this.startTimer();
      }
    },

    // ✅ P0-3: 恢复进度
    restoreProgress() {
      const progress = loadQuizProgress(this.forceResumeProgress ? null : this.quizProgressContext);
      if (progress) {
        this.currentIndex = progress.currentIndex || 0;
        if (Array.isArray(progress.questions) && progress.questions.length > 0) {
          this.questions = progress.questions;
        }
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

    // ✅ P0-3: 保存当前进度
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
          answeredQuestions: this.answeredQuestions,
          questions: this.questions
        },
        immediate,
        this.quizProgressContext
      );

      if (success) {
        logger.log('[do-quiz] ✅ 进度已自动保存');
      }
    },

    initSystemUI() {
      // 统一计算：状态栏高度
      this.statusBarHeight = getStatusBarHeight();
      // 标准导航栏高度 = 状态栏高度 + 44px
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
    async loadQuestions() {
      // ✅ mode=single：从收藏页传入的单题练习
      if (this._singleMode) {
        const singleQ = storageService.get('temp_practice_question', null);
        if (singleQ) {
          this.questionBankFingerprint = this.buildQuestionBankFingerprint([singleQ]);
          this.questions = [
            normalizePracticeQuestion(
              {
                ...singleQ,
                id: singleQ.id || 'single_q',
                question: singleQ.question,
                desc: singleQ.desc || '暂无解析',
                category: singleQ.category || '未分类',
                type: singleQ.type || '单选',
                difficulty: singleQ.difficulty || 2
              },
              0,
              { fillMissingChoiceOptions: true }
            )
          ];
          storageService.remove('temp_practice_question');
          this.startTimer();
          return;
        }
      }

      // ✅ [零摩擦] mode=temp_bank：从拍照搜题直接进入练习
      if (this.mode === 'temp_bank') {
        const tempQuestions = storageService.get('temp_practice_questions', []);
        if (tempQuestions.length > 0) {
          this.questionBankFingerprint = this.buildQuestionBankFingerprint(tempQuestions);
          this.questions = tempQuestions.map((q, index) =>
            normalizePracticeQuestion(
              {
                ...q,
                id: q.id || `temp_${index}`,
                question: q.question || '',
                desc: q.desc || '暂无解析',
                category: q.category || '拍照搜题',
                type: q.type || '单选',
                difficulty: q.difficulty || 2,
                source: q.source || 'temp'
              },
              index,
              { fillMissingChoiceOptions: true }
            )
          );
          storageService.remove('temp_practice_questions');
          this.startTimer();
          return;
        }
      }

      // ✅ [闭环核心] mode=smart_review：从智能复习页传入的复习题目
      if (this._smartReviewMode) {
        const reviewIds = storageService.get('smart_review_ids', []) || [];
        if (reviewIds.length > 0) {
          const bank = storageService.get('v30_bank', []);
          const reviewQuestions = reviewIds
            .map((id) => bank.find((q) => (q.id || q._id) === id))
            .filter(Boolean)
            .map((q, index) =>
              normalizePracticeQuestion(
                {
                  ...q,
                  id: q.id || q._id || `review_${index}`,
                  question: q.question || q.title || `题目 ${index + 1}`,
                  desc: q.desc || q.description || q.explanation || q.analysis || '暂无解析',
                  category: q.category || '未分类',
                  type: q.type || '单选',
                  difficulty: q.difficulty || 2,
                  source: q.source || '',
                  year: q.year || ''
                },
                index
              )
            );
          if (reviewQuestions.length > 0) {
            this.questionBankFingerprint = this.buildQuestionBankFingerprint(reviewQuestions);
            this.questions = reviewQuestions;
            storageService.remove('smart_review_ids');
            this.startTimer();
            return;
          }
        }
        // 没找到复习题目，回退到普通模式
        toast.info('复习题目加载失败，已切换普通模式');
      }

      // 从本地存储读取题库
      const bank = storageService.get('v30_bank', []);

      if (!bank || bank.length === 0) {
        // ✅ 使用自定义弹窗
        this.showEmptyBankModal = true;
        return;
      }

      // 验证并标准化题目数据
      const activeBank = this.paperId ? bank.filter((q) => q.paperId === this.paperId) : bank;
      if (this.paperId && activeBank.length === 0) {
        toast.info('指定试卷加载失败，已切换全部题库');
      }

      const sourceQuestions = activeBank.length > 0 ? activeBank : bank;
      this.questionBankFingerprint = this.buildQuestionBankFingerprint(sourceQuestions);

      let questions = sourceQuestions
        .map((q, index) =>
          normalizePracticeQuestion(
            {
              ...q,
              id: q.id || `q_${index}`,
              question: q.question || q.title || `题目 ${index + 1}`,
              desc: q.desc || q.description || q.explanation || q.analysis || '暂无解析',
              category: q.category || '未分类',
              type: q.type || '单选',
              difficulty: q.difficulty || 2,
              source: q.source || '',
              year: q.year || ''
            },
            index
          )
        )
        .filter((q) => q.question && !/^题目 \d+$/.test(q.question)); // 过滤无效占位题目

      // ✅ 使用智能组题算法优化题目序列（懒加载）
      if (this.smartPickerEnabled && questions.length > 0) {
        questions = pickQuestions(questions, {
          count: Math.min(questions.length, 20),
          mode: 'adaptive',
          includeReview: true,
          reviewRatio: 0.2
        });
        logger.log('[do-quiz] ✅ 智能组题模式已启用');
      } else if (this.isAdaptiveMode && questions.length > 0) {
        // 降级到自适应学习引擎
        questions = generateAdaptiveSequence(questions, {
          insertReviewQuestions: true,
          prioritizeWeak: true,
          maxReviewRatio: 0.3
        });
        logger.log('[do-quiz] ✅ 自适应学习模式已启用，题目序列已优化');
      }

      this.questions = this.applyEloMatching(questions);

      if (this.questions.length === 0) {
        // ✅ 使用自定义弹窗
        this.showEmptyBankModal = true;
      }

      // ✅ 记录答题开始时间
      this.answerStartTime = Date.now();

      // ✅ 更新当前题目的收藏状态
      this.updateFavoriteStatus();

      // ✅ 启动单题计时器
      this.startQuestionTimer();
    },
    buildQuestionBankFingerprint(questions = []) {
      return (questions || [])
        .map((question, index) => question?.id || question?._id || question?.question || `q_${index}`)
        .map((id) => String(id))
        .sort()
        .join('|');
    },
    // 从选项文本中提取标签（如 "A. 选项内容" -> "A"）
    getOptionLabel(idx) {
      return getQuizOptionLabel(this.currentQuestion, idx);
    },
    loadPassageAnnotations() {
      this.passageAnnotations = storageService.get('passage_annotations', {}) || {};
    },
    savePassageAnnotations() {
      storageService.save('passage_annotations', this.passageAnnotations || {});
    },
    isPassageSegmentSelected(segmentIndex) {
      return this.currentPassageAnnotations.some((item) => Number(item.segmentIndex) === Number(segmentIndex));
    },
    isFixedParagraph(item) {
      return this.currentQuestionFixedParagraphs.some((fixed) => String(fixed) === String(item));
    },
    togglePassageSegment(segmentIndex) {
      if (!this.currentQuestion) return;

      const key = this.currentPassageAnnotationKey;
      const current = [...(this.passageAnnotations[key] || [])];
      const existingIndex = current.findIndex((item) => Number(item.segmentIndex) === Number(segmentIndex));

      if (existingIndex >= 0) {
        current.splice(existingIndex, 1);
      } else {
        current.push({
          questionId: this.currentQuestion.id,
          questionNumber: this.currentQuestionNumberText,
          paperId: this.currentQuestion.paperId || '',
          paperName: this.currentQuestion.paperName || '',
          section: this.currentQuestion.section || '',
          segmentIndex,
          text: this.currentQuestionPassageSegments[segmentIndex] || '',
          createdAt: Date.now()
        });
      }

      this.passageAnnotations = {
        ...this.passageAnnotations,
        [key]: current
      };
      this.savePassageAnnotations();
    },
    clearCurrentPassageAnnotations() {
      const key = this.currentPassageAnnotationKey;
      const next = { ...(this.passageAnnotations || {}) };
      delete next[key];
      this.passageAnnotations = next;
      this.savePassageAnnotations();
    },
    startTimer() {
      // 防重入：清除已有定时器，避免多次调用导致计时加速
      if (this.timer) {
        clearInterval(this.timer);
        this.timer = null;
      }
      this.timer = setInterval(() => {
        this.seconds++;
        // 学习节奏管理：连续45分钟提醒休息（仅提醒一次）
        if (this.seconds === 2700 && !this.breakReminderShown) {
          this.breakReminderShown = true;
          this.showBreakReminder = true;
        }
      }, 1000);
    },
    formatTime(s) {
      const m = Math.floor(s / 60);
      const rs = s % 60;
      return `${m < 10 ? '0' + m : m}:${rs < 10 ? '0' + rs : rs}`;
    },
    getCompletionNextReviewDelayMs() {
      const wrongCount = (this.answeredQuestions || []).filter((answer) => answer.isCorrect === false).length;
      if (wrongCount <= 0) return null;

      try {
        const previewMistake = { fsrs_due: Date.now() };
        const result = scheduleMistakeReview(previewMistake, 'again');
        return result.fsrs_due ? result.fsrs_due - Date.now() : null;
      } catch (_e) {
        return null;
      }
    },
    async selectOption(idx) {
      if (this.isAnalyzing || this.showResult || this.hasAnswered) return;

      playClickSound();
      this.userChoice = idx;
      this.hasAnswered = true;

      // ✅ 停止单题计时器并记录用时
      const timerResult = stopQuestionTimer();
      const timeSpent = timerResult.elapsed * 1000; // 转换为毫秒

      // 判断答案是否正确
      const isCorrect = this.isCorrectOption(idx);

      // FSRS 预览：计算 4 种评分的下次复习时间，显示在评分按钮上
      const questionId = this.currentQuestion?.id || this.currentQuestion?._id;
      if (questionId) {
        try {
          const card = loadCardState(questionId) || createNewCard();
          this.fsrsPreview = previewSchedule(card);
        } catch (err) {
          logger.warn('[DoQuiz] FSRS preview failed:', err);
          this.fsrsPreview = null;
        }
      }

      // ✅ 记录已答题目
      const speedScore = this.calculateSpeedScore(isCorrect, timeSpent);
      const elo = this.updateQuestionElo(isCorrect, speedScore);
      this.answeredQuestions = upsertQuizAnswerRecord(
        this.answeredQuestions,
        buildQuizAnswerRecord({
          question: this.currentQuestion,
          index: this.currentIndex,
          userChoice: idx,
          isCorrect,
          timeSpent,
          speedScore,
          elo
        })
      );

      // ✅ 记录答题数据到各个分析模块
      this.recordAnswerToAnalytics(isCorrect, timeSpent).catch((_err) => {
        /* silent analytics failure */
      });

      if (isCorrect) {
        // ✅ 播放正确答案动画
        this.playCorrectEffect();
        this.showComboFeedbackIfNeeded();

        // ✅ 延迟解锁防重复点击（300ms后允许再次点击）
        this._safeTimeout(() => {
          this.isNavigating = false;
        }, 300);

        this.resultStatus = 'correct';
        this.personalHint = '';
        this.updateStudyStats(isCorrect);
        this.showResult = true;
      } else {
        // ✅ 播放错误答案动画
        this.playWrongEffect();
        this.clearComboFeedback();

        this.resultStatus = 'wrong';
        // ✅ [P0重构] 非阻塞AI分析：先立即显示结果（题目自带解析），AI异步增强
        this.aiComment = ''; // 清空，让模板先显示 currentQuestion.desc
        this.personalHint = this._buildPersonalHint(); // 生成个人历史微反馈
        this.updateStudyStats(isCorrect);
        this.showResult = true; // 立即显示结果弹窗，不等AI

        // 错误时：先保存到错题本（不含智能解析）
        this.saveToMistakes().catch((_err) => {
          /* silent save failure */
        });
        // AI深度解析异步执行，完成后自动替换解析内容（打字机效果）
        this.fetchAIDeepAnalysis(this.currentQuestion, this.currentQuestion.options[idx]).catch((aiErr) => {
          logger.warn('[do-quiz] AI深度解析失败，不影响答题流程:', aiErr);
        });
        // ✅ [差异化壁垒] 异步生成记忆口诀/助记符（不阻塞）
        generateMnemonic({
          currentQuestion: this.currentQuestion,
          correctAnswer: this.currentQuestion.answer
        }).catch(() => {
          /* silent */
        });
      }
    },
    // ✅ [P0重构] AI深度解析 — 非阻塞：不再显示全屏遮罩，异步增强已显示的解析内容
    async fetchAIDeepAnalysis(question, userChoice) {
      // 不再设置 isAnalyzing = true（不阻塞UI）

      // 初始化打字机（懒创建）
      if (!this._typewriter) {
        this._typewriter = useTypewriter({
          speed: 25,
          initialDelay: 100,
          onChar: (text) => {
            this.aiComment = text;
          }
        });
      }

      try {
        const result = await fetchAIAnalysis({ question, userChoice });

        if (result.success) {
          // 将智能解析同步保存到错题本（用完整文本）
          this.updateMistakeWithAI(result.comment);
        }

        // 用打字机效果逐字显示 AI 回复（替换题目自带解析）
        await this._typewriter.startTyping(result.comment);
      } catch (e) {
        // 静默失败，用户已经能看到题目自带解析
        logger.warn('[do-quiz] AI解析异步增强失败:', e);
      }
    },
    // ✅ P1: 委托给 quiz-mistake-handler.js
    async saveToMistakes() {
      await saveMistake({
        currentQuestion: this.currentQuestion,
        userChoice: this.userChoice,
        aiComment: this.aiComment
      });
    },
    // ✅ P1: 委托给 quiz-mistake-handler.js
    updateMistakeWithAI(aiAnalysis) {
      updateMistakeAI({
        currentQuestion: this.currentQuestion,
        aiAnalysis
      });
    },
    async updateStudyStats(isCorrect = this.resultStatus === 'correct') {
      try {
        const studyStore = useStudyStore();
        studyStore.restoreProgress();
        studyStore.recordQuestionAttempt({
          question: this.currentQuestion,
          isCorrect,
          timeSpent: Date.now() - (this.answerStartTime || Date.now()),
          timestamp: Date.now()
        });
      } catch (e) {
        logger.warn('[do-quiz] study progress update failed:', e);
      }

      // 更新学习热力图数据
      const today = new Date().toISOString().split('T')[0];
      const stats = storageService.get('study_stats', {});
      stats[today] = (stats[today] || 0) + 1;
      storageService.save('study_stats', stats);
      // 更新今日答题计数（驱动首页每日目标环）
      const todayCount = parseInt(uni.getStorageSync('today_answer_count') || '0');
      const todayDate = uni.getStorageSync('today_answer_date') || '';
      if (todayDate !== today) {
        // 日期变更，重置计数
        uni.setStorageSync('today_answer_count', '1');
        uni.setStorageSync('today_answer_date', today);
      } else {
        uni.setStorageSync('today_answer_count', String(todayCount + 1));
      }
      // 上报后端统计（异步，不阻塞本地保存）
      try {
        const { useStatsStore } = await import('@/stores/modules/stats.js');
        const statsStore = useStatsStore();
        // 每次答题算1分钟学习时长（近似）
        statsStore.reportStudyTime(1);
        // 每日首次答题时更新连续学习天数
        statsStore.reportStreak();
      } catch (_e) {
        // 上报失败不影响答题流程
      }
    },
    formatFsrsInterval(days) {
      return formatInterval(days);
    },
    rateAndNext(rating) {
      const questionId = this.currentQuestion?.id || this.currentQuestion?._id;
      if (questionId) {
        try {
          scheduleAndSave(questionId, rating);
        } catch (err) {
          logger.warn('[DoQuiz] FSRS schedule failed:', err);
        }
      }
      // 每 50 次答题触发一次 FSRS 参数优化（非阻塞）
      const reviewCount = parseInt(uni.getStorageSync('fsrs_review_count') || '0') + 1;
      uni.setStorageSync('fsrs_review_count', String(reviewCount));
      if (reviewCount % 50 === 0) {
        triggerOptimization().catch(() => {
          /* no-op */
        });
      }
      this.fsrsPreview = null;
      this.toNext();
    },
    // 经典闪卡：翻转查看答案
    flipFlashcard() {
      this.flashcardFlipped = true;
      this.hasAnswered = true;

      // 停止单题计时器
      const timerResult = stopQuestionTimer();
      const timeSpent = timerResult.elapsed * 1000;

      // 计算 FSRS 预览（四级评分的下次复习时间）
      const questionId = this.currentQuestion?.id || this.currentQuestion?._id;
      if (questionId) {
        try {
          const card = loadCardState(questionId) || createNewCard();
          this.flashcardFsrsPreview = previewSchedule(card);
        } catch (err) {
          logger.warn('[DoQuiz] Flashcard FSRS preview failed:', err);
          this.flashcardFsrsPreview = null;
        }
      }

      // 记录已答题目（闪卡模式不判断对错，由用户自评）
      this.answeredQuestions = upsertQuizAnswerRecord(
        this.answeredQuestions,
        buildQuizAnswerRecord({
          question: this.currentQuestion,
          index: this.currentIndex,
          userChoice: 'flashcard_flip',
          isCorrect: null,
          timeSpent
        })
      );

      playFlipSound();
    },
    // 经典闪卡：自评后进入下一题
    rateFlashcardAndNext(rating) {
      const questionId = this.currentQuestion?.id || this.currentQuestion?._id;
      if (questionId) {
        try {
          scheduleAndSave(questionId, rating);
        } catch (err) {
          logger.warn('[DoQuiz] Flashcard FSRS schedule failed:', err);
        }
      }

      const latestAnswer = [...this.answeredQuestions].reverse().find((item) => item.index === this.currentIndex);
      const timeSpent = latestAnswer?.timeSpent || 0;
      this.answeredQuestions = upsertQuizAnswerRecord(
        this.answeredQuestions,
        buildQuizAnswerRecord({
          question: this.currentQuestion,
          index: this.currentIndex,
          userChoice: `flashcard_rating_${rating}`,
          isCorrect: rating >= 3,
          timeSpent,
          rating
        })
      );

      // 更新学习统计
      this.updateStudyStats(rating >= 3);

      if (rating >= 3) {
        this.playCorrectEffect();
      }

      // FSRS 优化计数
      const reviewCount = parseInt(uni.getStorageSync('fsrs_review_count') || '0') + 1;
      uni.setStorageSync('fsrs_review_count', String(reviewCount));
      if (reviewCount % 50 === 0) {
        triggerOptimization().catch((_err) => {
          /* silent optimization failure */
        });
      }

      this.flashcardFsrsPreview = null;
      this.toNext();
    },
    async toNext() {
      // ✅ 防重复点击保护
      if (this.isNavigating) {
        return;
      }
      this.isNavigating = true;

      // 重置状态
      this.showResult = false;
      this.isAnalyzing = false;
      this.clearComboFeedback();

      // 停止打字机效果（如果正在进行）
      if (this._typewriter) {
        this._typewriter.stopTyping();
      }

      if (this.currentIndex < this.questions.length - 1) {
        playClickSound();
        // ✅ 检查点 5.3: 检查是否需要插入复习题
        if (this.isAdaptiveMode) {
          const recommendation = getNextRecommendedQuestion(this.currentIndex, this.questions);
          if (recommendation && recommendation.isReview) {
            // 插入复习题
            this.questions.splice(this.currentIndex + 1, 0, recommendation.question);
            logger.log('[do-quiz] ✅ 插入复习题:', recommendation.reason);

            // 显示复习提示
            toast.info('复习时间到！', 1500);
          }
        }

        this.currentIndex++;
        this.hasAnswered = false;
        this.userChoice = null;
        this.showResult = false;
        this.aiComment = '';
        // 重置闪卡翻转状态
        this.flashcardFlipped = false;
        this.flashcardFsrsPreview = null;

        // ✅ 重置答题开始时间
        this.answerStartTime = Date.now();

        // ✅ P0-3: 进入下一题时保存进度
        this.saveCurrentProgress();

        // ✅ 延迟解锁防重复点击（300ms后允许再次点击）
        this._safeTimeout(() => {
          this.isNavigating = false;
        }, 300);
      } else {
        // ✅ P0-3: 练习完成，清除进度
        clearQuizProgress();

        // ✅ 检查点 5.1: 追踪完成练习事件
        analytics.trackConversion('COMPLETE_SESSION', {
          totalQuestions: this.questions.length,
          correctCount: this.answeredQuestions.filter((a) => a.isCorrect).length,
          totalTime: this.seconds
        });

        // ✅ [闭环核心] 自动触发AI诊断（不等用户点击）
        playCompleteFanfare();
        this.showCompleteModal = true;
        this.autoDiagnose();
      }
    },
    handleExit() {
      // ✅ 使用自定义弹窗
      this.showExitModal = true;
    },

    // ✅ 处理退出确认
    handleExitConfirm() {
      this.showExitModal = false;
      // P0-3: 退出前保存进度
      this.saveCurrentProgress();

      if (this.timer) {
        clearInterval(this.timer);
      }
      stopQuestionTimer();
      safeNavigateBack();
    },

    // ✅ 处理题库为空确认
    handleEmptyBankConfirm() {
      this.showEmptyBankModal = false;
      safeNavigateTo('/pages/practice/index');
    },

    // ✅ 处理恢复进度确认
    handleResumeConfirm() {
      this.showResumeModal = false;
      this.restoreProgress();
    },

    // ✅ 处理恢复进度取消（重新开始）
    handleResumeCancel() {
      this.showResumeModal = false;
      clearQuizProgress();
      this.startTimer();
    },

    // ✅ [闭环核心] 自动诊断 + AI推荐下一组 — 刷题结束后台自动触发
    async autoDiagnose() {
      if (!this.sessionId || this.answeredQuestions.length < 3) {
        return;
      }
      this.diagnosisLoading = true;
      try {
        // 并行：诊断 + 获取下一组推荐
        const [diagRes, recRes] = await Promise.allSettled([
          this.reviewStore.generateDiagnosis({ sessionId: this.sessionId }),
          this.reviewStore.fetchSmartRecommendations({ count: 10 })
        ]);

        // 处理诊断结果
        if (diagRes.status === 'fulfilled' && diagRes.value.success && diagRes.value.data) {
          this.diagnosisId = diagRes.value.data._id;
          const d = diagRes.value.data.diagnosis || {};
          this.diagnosisReady = true;
          const weakStr = (d.weakPoints || [])
            .slice(0, 3)
            .map((w) => w.knowledgePoint)
            .join('、');
          this.diagnosisSummary = d.overallLevel
            ? `${d.overallLevel}（${d.accuracy || 0}%）${weakStr ? '\n薄弱点：' + weakStr : ''}\n${d.encouragement || ''}`
            : '诊断完成';
        }

        // 处理推荐结果 — AI自动推荐下一组
        if (recRes.status === 'fulfilled' && recRes.value.success && recRes.value.data) {
          const ids = (recRes.value.data.questions || recRes.value.data || [])
            .map((q) => q.id || q._id)
            .filter(Boolean);
          if (ids.length > 0) {
            this.nextRecommendationIds = ids;
            this.hasNextRecommendation = true;
          }
        }
      } catch (e) {
        logger.warn('[do-quiz] 自动诊断失败:', e);
      } finally {
        this.diagnosisLoading = false;
      }
    },

    // ✅ [P1重构] 完成弹窗主按钮 — 根据是否有推荐决定行为
    handleCompleteAction() {
      if (this.hasNextRecommendation && this.nextRecommendationIds.length > 0) {
        // AI已推荐下一组，直接开始
        this.showCompleteModal = false;
        uni.setStorageSync('smart_review_ids', this.nextRecommendationIds);
        safeRedirectTo('/pages/practice-sub/do-quiz?mode=smart_review');
      } else {
        // 没有推荐，查看诊断报告
        this.viewDiagnosisReport();
      }
    },

    // ✅ 查看诊断报告
    viewDiagnosisReport() {
      this.showCompleteModal = false;
      if (this.diagnosisId) {
        modal.show({
          title: '练习诊断',
          content: this.diagnosisSummary || '诊断已完成，请继续复习错题并保持练习节奏。',
          confirmText: '开始复习',
          cancelText: '返回',
          success: (res) => {
            if (res.confirm) {
              safeNavigateTo('/pages/practice-sub/do-quiz?mode=smart_review');
            } else {
              safeNavigateBack();
            }
          }
        });
      } else if (this.diagnosisLoading) {
        // 还在诊断中，等一下
        toast.info('AI 正在分析中，请稍候...');
        this.showCompleteModal = true;
      } else {
        // 诊断失败，直接返回
        safeNavigateBack();
      }
    },

    // ✅ 处理练习完成确认
    handleCompleteConfirm() {
      this.showCompleteModal = false;
      this.isNavigating = false;
      safeNavigateBack();
    },

    // ✅ AI推荐下一步 → 跳转到指定页面
    navigateFromResult(url) {
      this.showCompleteModal = false;
      safeNavigateTo(url);
    },

    /**
     * 基于个人历史生成一句话AI微反馈（纯本地，零延迟）
     * 在用户答错时调用，根据该知识点的历史错误次数给出上下文提醒
     */
    _buildPersonalHint() {
      if (!this.currentQuestion) return '';
      const cat = this.currentQuestion.category || '';
      if (!cat) return '';

      // 统计本次练习中该知识点的错误次数
      const catWrongCount = this.answeredQuestions.filter(
        (a) => !a.isCorrect && this.questions[a.index]?.category === cat
      ).length;

      // 统计总体该知识点的历史错误
      const mistakes = storageService.get('mistake_book', []);
      const catMistakes = mistakes.filter((m) => (m.category || m.knowledge_point || '') === cat);
      const totalWrong = catMistakes.length;

      if (totalWrong >= 5) {
        return `你在「${cat}」上已累计错${totalWrong}题，建议做完后去错题本集中突破这个知识点。`;
      }
      if (catWrongCount >= 2) {
        return `本次在「${cat}」已错${catWrongCount}题，这可能是你的薄弱点。`;
      }
      if (totalWrong >= 2) {
        return `「${cat}」是你的高频易错知识点（累计${totalWrong}次），注意审题。`;
      }
      return `记住这道题的考点：「${cat}」`;
    },

    // ✅ [闭环核心] AI智能诊断 — 刷题结束后触发
    async handleDiagnosis() {
      if (this.diagnosisLoading) return;
      if (!this.sessionId) {
        toast.info('会话数据不足，无法诊断');
        this.handleCompleteConfirm();
        return;
      }

      this.diagnosisLoading = true;
      try {
        const res = await this.reviewStore.generateDiagnosis({ sessionId: this.sessionId });
        if (res.success && res.data) {
          this.showCompleteModal = false;
          const d = res.data.diagnosis || {};
          modal.show({
            title: `诊断结果：${d.overallLevel || '完成'}`,
            content: `正确率 ${d.accuracy || 0}%\n${d.encouragement || '继续加油！'}\n\n薄弱点：${(d.weakPoints || []).map((w) => w.knowledgePoint).join('、') || '无'}\n\n建议：${d.studyPlan?.immediate || '复习错题'}`,
            confirmText: '开始复习',
            cancelText: '返回',
            success: (modalRes) => {
              if (modalRes.confirm) {
                safeNavigateTo('/pages/mistake/index');
              } else {
                safeNavigateBack();
              }
            }
          });
        } else {
          toast.info(res.message || '诊断失败');
        }
      } catch (e) {
        logger.warn('[do-quiz] AI诊断失败:', e);
        toast.info('诊断失败，请稍后重试');
      } finally {
        this.diagnosisLoading = false;
      }
    },

    closeResult() {
      if (this.hasAnswered) {
        this.rateAndNext(this.resultStatus === 'correct' ? 3 : 1);
        return;
      }
      this.showResult = false;
      this.isAnalyzing = false;
    },

    // ==================== 滑动手势相关方法 ====================

    // ✅ 初始化滑动手势
    initSwipeGesture() {
      initSwipeGesture();

      // 绑定滑动回调
      bindSwipeCallbacks({
        onSwipeLeft: (_data) => {
          // 向左滑动 = 下一题
          if (!this.hasAnswered && this.currentIndex < this.questions.length - 1) {
            this.goToNextQuestion();
          }
        },
        onSwipeRight: (_data) => {
          // 向右滑动 = 上一题
          if (!this.hasAnswered && this.currentIndex > 0) {
            this.goToPrevQuestion();
          }
        },
        onSwipeMove: (data) => {
          // 滑动过程中更新偏移量
          if (!this.hasAnswered) {
            this.swipeDeltaX = data.deltaX;
          }
        },
        onSwipeEnd: (_data) => {
          // 滑动结束，重置偏移量
          this.swipeDeltaX = 0;
        },
        onBoundaryReached: (data) => {
          // 到达边界时的反馈已在模块内处理
          logger.log('[do-quiz] 到达边界:', data.boundary);
        }
      });

      logger.log('[do-quiz] ✅ 滑动手势已初始化');
    },

    // ✅ 触摸开始
    onTouchStart(event) {
      if (this.hasAnswered || this.isAnalyzing) return;
      handleTouchStart(event, this.getSwipeContext());
      // Phase 3-4: 卡片堆叠触摸
      if (this.cardStack) this.cardStack.onTouchStart(event);
    },

    // ✅ 触摸移动
    onTouchMove(event) {
      if (this.hasAnswered || this.isAnalyzing) return;
      handleTouchMove(event, this.getSwipeContext());
      // Phase 3-4: 卡片堆叠跟随
      if (this.cardStack) this.cardStack.onTouchMove(event);
    },

    // ✅ 触摸结束
    onTouchEnd(event) {
      if (this.hasAnswered || this.isAnalyzing) return;
      handleTouchEnd(event, this.getSwipeContext());
      // Phase 3-4: 卡片堆叠释放
      if (this.cardStack) this.cardStack.onTouchEnd(event);
    },

    // ✅ 获取滑动上下文
    getSwipeContext() {
      return {
        currentIndex: this.currentIndex,
        totalQuestions: this.questions.length,
        hasAnswered: this.hasAnswered
      };
    },

    // ✅ 跳转到上一题
    goToPrevQuestion() {
      if (this.currentIndex > 0) {
        this.currentIndex--;
        this.resetQuestionState();
        this.updateFavoriteStatus();
        logger.log('[do-quiz] ✅ 滑动切换到上一题:', this.currentIndex);
      }
    },

    // ✅ 跳转到下一题
    goToNextQuestion() {
      if (this.currentIndex < this.questions.length - 1) {
        this.currentIndex++;
        this.resetQuestionState();
        this.updateFavoriteStatus();
        logger.log('[do-quiz] ✅ 滑动切换到下一题:', this.currentIndex);
      }
    },

    // ✅ 重置题目状态
    resetQuestionState() {
      this.hasAnswered = false;
      this.userChoice = null;
      this.showResult = false;
      this.aiComment = '';
      this.answerStartTime = Date.now();
      this.correctAnimationClass = '';
      this.wrongAnimationClass = '';
      this.showTimeWarning = false;

      // ✅ 重新启动单题计时器
      this.startQuestionTimer();

      // ✅ 更新当前题目的笔记
      this.updateQuestionNotes();
    },

    // ==================== 收藏功能相关方法 ====================

    // ✅ 切换收藏状态（通过 Store，登录时走后端）
    async handleToggleFavorite() {
      if (!this.currentQuestion) return;

      const favoriteStore = useFavoriteStore();
      const result = await favoriteStore.toggleFavorite(this.currentQuestion);
      this.isCurrentFavorited = result.isFavorited;

      playClickSound();

      logger.log('[do-quiz] ✅ 收藏状态切换:', result);
    },

    // ✅ 更新当前题目的收藏状态
    async updateFavoriteStatus() {
      if (this.currentQuestion) {
        const favoriteStore = useFavoriteStore();
        this.isCurrentFavorited = await favoriteStore.checkIsFavorited(
          this.currentQuestion.id || this.currentQuestion.question
        );
      }
    },

    // ==================== 答题动画相关方法 ====================

    // ✅ 播放正确答案动画
    playCorrectEffect() {
      playQuizSound('correct');
      this.correctAnimationClass = 'quiz-correct-animation';
      this._safeTimeout(() => {
        this.correctAnimationClass = '';
      }, 360);
    },

    // 播放错误答案动画
    playWrongEffect() {
      playQuizSound('wrong');
      this.wrongAnimationClass = 'quiz-wrong-animation';
      this._safeTimeout(() => {
        this.wrongAnimationClass = '';
      }, 360);
    },

    showComboFeedbackIfNeeded() {
      const feedback = buildComboFeedback(calculateCorrectStreak(this.answeredQuestions));
      if (!feedback) return;

      this.comboFeedback = feedback;
      playQuizSound('combo', { level: feedback.level });
      if (this.comboFeedbackTimer) {
        clearTimeout(this.comboFeedbackTimer);
      }
      this.comboFeedbackTimer = this._safeTimeout(() => {
        this.comboFeedback = null;
        this.comboFeedbackTimer = null;
      }, 1300);
    },

    clearComboFeedback() {
      if (this.comboFeedbackTimer) {
        clearTimeout(this.comboFeedbackTimer);
        this.comboFeedbackTimer = null;
      }
      this.comboFeedback = null;
    },

    // ==================== 单题计时器相关方法 ====================

    // ✅ 启动单题计时器
    startQuestionTimer() {
      if (!this.questionTimerEnabled || !this.currentQuestion) return;

      const difficulty = this.currentQuestion.difficulty || 2;
      this.currentQuestionDifficulty = difficulty;

      const timerResult = startQuestionTimer({
        difficulty,
        onTick: (data) => {
          this.questionTimeRemaining = data.remaining;
          this.showTimeWarning = data.progress >= 0.8;
        },
        onWarning: (data) => {
          if (data.level === 'warning') {
            toast.info(data.message);
          }
        },
        onTimeout: (_data) => {
          // 超时处理
          if (!this.hasAnswered) {
            toast.info('时间到！');
          }
        }
      });

      this.questionTimeLimit = timerResult.timeLimit;
      this.questionTimeRemaining = timerResult.remaining;

      logger.log('[do-quiz] ✅ 单题计时器已启动:', {
        timeLimit: timerResult.timeLimit,
        difficulty
      });
    },

    // ==================== 数据分析记录方法 ====================

    // ✅ P1: 委托给 quiz-analytics-recorder.js（组件状态更新保留在组件内）
    async recordAnswerToAnalytics(isCorrect, timeSpent) {
      const questionData = await recordAnalytics({
        currentQuestion: this.currentQuestion,
        isCorrect,
        timeSpent,
        userChoice: this.userChoice,
        questionTimeLimit: this.questionTimeLimit,
        getOptionLabel: (idx) => this.getOptionLabel(idx),
        sessionId: this.sessionId
      });

      // 答题进度已在 selectOption 中写入；这里仅回填分析状态，避免进度翻倍。
      if (questionData) {
        const recordIndex = this.answeredQuestions.findIndex((item) => {
          return item.index === this.currentIndex && item.questionId === this.currentQuestion.id;
        });
        if (recordIndex >= 0) {
          this.answeredQuestions.splice(recordIndex, 1, {
            ...this.answeredQuestions[recordIndex],
            analyticsRecordedAt: Date.now()
          });
        }
      }
    },
    calculateSpeedScore(isCorrect, timeSpent) {
      return calculateQuizSpeedScore({
        isCorrect,
        timeSpentMs: timeSpent,
        timeLimitMs: Number(this.questionTimeLimit || 120) * 1000,
        difficulty: this.currentQuestion?.difficulty || 3
      });
    },

    applyEloMatching(questions = []) {
      return rankQuestionsByEloMatch(questions, {
        userRating: this.eloState.userRating,
        questionRatings: this.eloState.questionRatings
      });
    },

    updateQuestionElo(isCorrect, speedScore) {
      const questionId = this.currentQuestion?.id || this.currentQuestion?._id;
      const currentQuestionRating = getQuestionEloRating(this.currentQuestion || {}, this.eloState.questionRatings);
      const result = updateEloRating({
        userRating: this.eloState.userRating,
        questionRating: currentQuestionRating,
        isCorrect,
        speedScore
      });
      this.eloState.userRating = result.userRating;
      if (questionId) {
        this.eloState.questionRatings = {
          ...this.eloState.questionRatings,
          [questionId]: result.questionRating
        };
      }
      saveEloState(storageService, this.eloState);
      return result;
    },

    // ==================== 离线缓存相关方法 ====================

    // ✅ 检查离线数据可用性
    checkOfflineData() {
      const status = checkOfflineAvailability();
      this.offlineAvailable = status.available;
      this.isOfflineMode = !status.isOnline && status.available;

      if (this.isOfflineMode) {
        toast.info('已切换到离线模式');
      }

      logger.log('[do-quiz] 离线状态:', status);
    },

    // ==================== 题目笔记相关方法 ====================

    // ✅ 打开笔记弹窗
    handleOpenNote() {
      if (!this.currentQuestion) return;

      // 加载当前题目的笔记
      this.currentQuestionNotes = getNotesByQuestion(this.currentQuestion.id || this.currentQuestion.question);

      // 重置输入状态
      this.noteContent = '';
      this.selectedNoteTags = [];
      this.showNoteModal = true;
    },

    // ✅ 切换笔记标签
    toggleNoteTag(tagId) {
      const index = this.selectedNoteTags.indexOf(tagId);
      if (index >= 0) {
        this.selectedNoteTags.splice(index, 1);
      } else {
        this.selectedNoteTags.push(tagId);
      }
    },

    // ✅ 保存笔记
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

        // 更新当前题目的笔记列表
        this.currentQuestionNotes = getNotesByQuestion(this.currentQuestion.id || this.currentQuestion.question);

        this.showNoteModal = false;
        this.noteContent = '';
        this.selectedNoteTags = [];
      } else {
        toast.info('保存失败');
      }
    },

    // ✅ 更新当前题目的笔记
    updateQuestionNotes() {
      if (this.currentQuestion) {
        this.currentQuestionNotes = getNotesByQuestion(this.currentQuestion.id || this.currentQuestion.question);
      }
    },

    // ✅ 答题卡跳转到指定题目
    handleJumpToQuestion(index) {
      this.showAnswerSheet = false;
      this.currentIndex = index;
      this.resetQuestionState();
      this.updateFavoriteStatus();
      logger.log('[do-quiz] ✅ 跳转到题目:', index);
    }
  }
};
</script>

<style lang="scss" scoped>
/* [AUDIT FIX R135] */
/* 容器样式 */
.container {
  min-height: 100%;
  min-height: 100vh;
  background:
    radial-gradient(circle at 18% 0%, rgba(159, 232, 112, 0.14) 0, rgba(159, 232, 112, 0) 34%),
    linear-gradient(180deg, #f7f9f4 0%, #eef3f6 100%);
  position: relative;
  overflow: hidden;
  color: #1d1d1f;
}

.container.dark-mode {
  background:
    radial-gradient(circle at 20% 0%, rgba(0, 224, 255, 0.12) 0, rgba(0, 224, 255, 0) 34%),
    radial-gradient(circle at 86% 12%, rgba(155, 81, 224, 0.1) 0, rgba(155, 81, 224, 0) 32%),
    linear-gradient(180deg, #10131a 0%, #1a1c23 62%, #11141c 100%);
  color: #f5f7fb;
}

/* 极光背景 */
.aurora-bg {
  display: none;
}

.combo-feedback {
  position: fixed;
  top: calc(132rpx + env(safe-area-inset-top));
  left: 50%;
  z-index: 420;
  min-width: 240rpx;
  max-width: 540rpx;
  padding: 18rpx 28rpx;
  border-radius: 999rpx;
  border: 1rpx solid rgba(15, 23, 42, 0.08);
  background: rgba(255, 255, 255, 0.9);
  box-shadow:
    0 18rpx 44rpx rgba(15, 23, 42, 0.14),
    inset 0 1rpx 0 rgba(255, 255, 255, 0.92);
  transform: translateX(-50%);
  animation: comboFloat 1.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  pointer-events: none;
}

.combo-title,
.combo-desc {
  display: block;
  text-align: center;
}

.combo-title {
  font-size: 28rpx;
  font-weight: 860;
  color: #10281a;
  line-height: 1.2;
  font-variant-numeric: tabular-nums;
}

.combo-desc {
  margin-top: 4rpx;
  font-size: 20rpx;
  font-weight: 650;
  color: rgba(16, 40, 26, 0.66);
  line-height: 1.3;
}

.combo-feedback.level-2,
.combo-feedback.level-3,
.combo-feedback.level-4 {
  border-color: rgba(117, 221, 255, 0.34);
  background:
    linear-gradient(135deg, rgba(159, 232, 112, 0.94) 0%, rgba(117, 221, 255, 0.94) 100%);
}

.dark-mode .combo-feedback {
  border-color: rgba(255, 255, 255, 0.1);
  background: rgba(34, 37, 45, 0.92);
  box-shadow:
    0 18rpx 46rpx rgba(0, 0, 0, 0.34),
    inset 0 1rpx 0 rgba(255, 255, 255, 0.08);
}

.dark-mode .combo-feedback.level-2,
.dark-mode .combo-feedback.level-3,
.dark-mode .combo-feedback.level-4 {
  background:
    linear-gradient(135deg, rgba(14, 165, 233, 0.86) 0%, rgba(34, 211, 238, 0.82) 100%),
    rgba(20, 24, 32, 0.94);
}

.dark-mode .combo-title {
  color: #f5f7fb;
}

.dark-mode .combo-desc {
  color: rgba(245, 247, 251, 0.7);
}

@keyframes comboFloat {
  0% {
    opacity: 0;
    transform: translate(-50%, 16rpx) scale(0.96);
  }
  16% {
    opacity: 1;
    transform: translate(-50%, 0) scale(1);
  }
  78% {
    opacity: 1;
    transform: translate(-50%, -4rpx) scale(1);
  }
  100% {
    opacity: 0;
    transform: translate(-50%, -18rpx) scale(0.98);
  }
}

/* 导航栏 */
.nav-header {
  position: fixed;
  top: 0;
  width: 100%;
  z-index: 100;
  background: rgba(245, 245, 247, 0.92);
  box-shadow: 0 1rpx 0 rgba(0, 0, 0, 0.06);
}

.dark-mode .nav-header {
  background: rgba(16, 19, 26, 0.84);
  box-shadow: 0 1rpx 0 rgba(255, 255, 255, 0.08);
}
.nav-content {
  height: 50px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 30rpx;
}
.back-area {
  display: flex;
  align-items: center;
  @include em-flex-gap(10rpx, row);
}
.back-icon {
  font-size: 36rpx;
  color: var(--text-primary);
  font-weight: bold;
}
.progress-text {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 104rpx;
  font-size: 28rpx;
  font-weight: 700;
  color: #1d1d1f;
  white-space: nowrap;
  line-height: 1;
}

.dark-mode .progress-text {
  color: #f5f7fb;
}
.timer-box {
  font-size: 24rpx;
  color: #5f6672;
  background: #ffffff;
  padding: 4rpx 20rpx;
  border-radius: 20rpx;
  display: flex;
  align-items: center;
  @include em-flex-gap(8rpx, row);
}

.dark-mode .timer-box,
.dark-mode .question-timer-box {
  color: #f5f7fb;
  background: rgba(255, 255, 255, 0.07);
  border-color: rgba(255, 255, 255, 0.08);
}
.timer-icon {
  font-size: 24rpx;
}

/* 计时器组 */
.timer-group {
  display: flex;
  align-items: center;
  @include em-flex-gap(12rpx, row);
}

.total-label {
  font-size: 24rpx;
  color: var(--text-sub);
  opacity: 0.7;
}

/* 单题计时器 */
.question-timer-box {
  font-size: 26rpx;
  font-weight: 700;
  color: #1d1d1f;
  background: #ffffff;
  border: 1rpx solid rgba(0, 0, 0, 0.06);
  padding: 6rpx 24rpx;
  border-radius: 24rpx;
  display: flex;
  align-items: center;
  @include em-flex-gap(8rpx, row);
  transition: all 0.3s ease;
}

.question-timer-box .timer-icon {
  font-size: 26rpx;
}

.question-timer-box .question-time {
  min-width: 80rpx;
  text-align: center;
}

/* 时间警告状态 */
.question-timer-box.warning {
  background: #fff7e6;
  color: #9a5b00;
  animation: timerPulse 1s ease-in-out infinite;
}

/* 时间危险状态 */
.question-timer-box.danger {
  background: #fff1f0;
  color: #b42318;
  animation: timerShake 0.5s ease-in-out infinite;
}

@keyframes timerPulse {
  0%,
  100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.05);
  }
}

@keyframes timerShake {
  0%,
  100% {
    transform: translateX(0);
  }
  25% {
    transform: translateX(-4rpx);
  }
  75% {
    transform: translateX(4rpx);
  }
}

/* 滚动区域 */
.quiz-scroll {
  height: 100%;
  height: 100vh;
  padding: 0 28rpx;
  box-sizing: border-box;
  position: relative;
  z-index: 1;
}

/* 玻璃卡片通用样式 */
.glass-card {
  background: rgba(255, 255, 255, 0.9);
  border: 1rpx solid rgba(15, 23, 42, 0.06);
  border-radius: 28rpx;
  padding: 36rpx;
  margin-bottom: 24rpx;
  box-shadow: 0 16rpx 42rpx rgba(15, 23, 42, 0.08);
}

.dark-mode .glass-card {
  background: rgba(34, 37, 45, 0.86);
  border-color: rgba(255, 255, 255, 0.08);
  box-shadow: 0 18rpx 48rpx rgba(0, 0, 0, 0.34);
}

.quiz-loading-overlay {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  margin-top: 28rpx;
  overflow: hidden;
}

.quiz-loading-orbit {
  position: relative;
  width: 70rpx;
  height: 70rpx;
  margin-bottom: 28rpx;
  border: 2rpx solid rgba(31, 122, 77, 0.18);
  border-radius: 50%;
}

.quiz-loading-dot {
  position: absolute;
  top: 8rpx;
  left: 50%;
  width: 18rpx;
  height: 18rpx;
  margin-left: -9rpx;
  border-radius: 50%;
  background: #1f7a4d;
  transform-origin: 9rpx 27rpx;
  animation: quizLoadingOrbit 1.1s linear infinite;
}

.quiz-loading-dot.secondary {
  top: auto;
  bottom: 8rpx;
  opacity: 0.32;
  animation-delay: -0.55s;
}

.quiz-loading-title {
  font-size: 36rpx;
  font-weight: 760;
  color: #1d1d1f;
  line-height: 1.28;
}

.quiz-loading-subtitle {
  margin-top: 10rpx;
  color: #5f6672;
  font-size: 26rpx;
  line-height: 1.5;
}

.quiz-loading-skeleton {
  width: 100%;
  margin-top: 34rpx;
}

.quiz-loading-line {
  width: 72%;
  height: 18rpx;
  margin-top: 18rpx;
  border-radius: 999rpx;
  background: linear-gradient(90deg, rgba(31, 122, 77, 0.08), rgba(31, 122, 77, 0.18), rgba(31, 122, 77, 0.08));
  background-size: 220% 100%;
  animation: quizLoadingPulse 1.25s ease-in-out infinite;
}

.quiz-loading-line.long {
  width: 92%;
}

.quiz-loading-line.short {
  width: 48%;
}

@keyframes quizLoadingOrbit {
  from {
    transform: rotate(0deg) translateY(-27rpx);
  }
  to {
    transform: rotate(360deg) translateY(-27rpx);
  }
}

@keyframes quizLoadingPulse {
  0% {
    background-position: 120% 0;
    opacity: 0.58;
  }
  50% {
    opacity: 1;
  }
  100% {
    background-position: -120% 0;
    opacity: 0.58;
  }
}

/* Phase 3-4: 卡片堆叠样式 */
.stack-card {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  pointer-events: none;
}
.stack-card .glass-card {
  opacity: 0.7;
}
.q-content-preview {
  font-size: 28rpx;
  color: var(--text-secondary);
  line-height: 1.5;
  overflow: hidden;
  max-height: 80rpx;
}

/* 3D 卡片翻转效果 */
.question-container {
  perspective: 1200rpx;
}

.question-card {
  position: relative;
  overflow: visible;
  transition: transform 0.4s cubic-bezier(0.32, 0.72, 0, 1);
  transform-style: preserve-3d;
  backface-visibility: hidden;
}

.question-card::before {
  content: '';
  position: absolute;
  top: 18rpx;
  right: 28rpx;
  left: 28rpx;
  height: 1rpx;
  border-radius: 999rpx;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.72), transparent);
  pointer-events: none;
}

.question-card.card-answered {
  animation: none;
}

.question-card.card-correct {
  border-color: rgba(52, 199, 89, 0.34);
  animation: correctGlow 420ms ease-out;
}

.question-card.card-wrong {
  border-color: rgba(255, 59, 48, 0.34);
  animation: wrongGlow 420ms ease-out;
}

@keyframes cardFlipPulse {
  0% {
    transform: rotateY(0deg) scale(1);
  }
  30% {
    transform: rotateY(12deg) scale(0.97);
  }
  60% {
    transform: rotateY(-6deg) scale(1.01);
  }
  100% {
    transform: rotateY(0deg) scale(1);
  }
}

@keyframes correctGlow {
  0% {
    box-shadow: 0 0 0 0 rgba(52, 199, 89, 0.5);
  }
  50% {
    box-shadow: 0 0 40rpx 10rpx rgba(52, 199, 89, 0.3);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(52, 199, 89, 0);
  }
}

@keyframes wrongGlow {
  0% {
    box-shadow: 0 0 0 0 rgba(255, 59, 48, 0.5);
  }
  50% {
    box-shadow: 0 0 40rpx 10rpx rgba(255, 59, 48, 0.3);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(255, 59, 48, 0);
  }
}

/* 题目卡片 */
.question-card .q-tag {
  display: inline-block;
  background: rgba(31, 122, 77, 0.08);
  color: #1f7a4d;
  font-size: 24rpx;
  font-weight: 700;
  padding: 8rpx 18rpx;
  border-radius: 999rpx;
  margin-bottom: 20rpx;
}

.dark-mode .question-card .q-tag {
  background: rgba(0, 224, 255, 0.12);
  color: #75ddff;
}
.question-card .q-content {
  font-size: 34rpx;
  font-weight: 700;
  line-height: 1.6;
  color: #1d1d1f;
  display: block;
}

.dark-mode .question-card .q-content {
  color: #f5f7fb;
}

.q-passage-card {
  margin-bottom: 28rpx;
  padding: 24rpx;
  border: 1rpx solid rgba(0, 0, 0, 0.06);
  border-radius: 22rpx;
  background: #fafafa;
}

.dark-mode .q-passage-card,
.dark-mode .q-passage-segment,
.dark-mode .q-fixed-sequence-item,
.dark-mode .q-image-card {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.08);
}

.dark-mode .q-passage-content,
.dark-mode .knowledge-title,
.dark-mode .knowledge-detail {
  color: #f5f7fb;
}

.q-passage-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
  margin-bottom: 14rpx;
}

.q-passage-title-block {
  min-width: 0;
  flex: 1;
}

.q-passage-kicker {
  display: block;
  color: #8e8e93;
  font-size: 21rpx;
  font-weight: 760;
}

.q-passage-tip {
  display: block;
  margin-top: 6rpx;
  color: #8e8e93;
  font-size: 21rpx;
  font-weight: 650;
  line-height: 1.35;
}

.q-passage-meta {
  flex-shrink: 0;
  color: #8e8e93;
  font-size: 20rpx;
  font-weight: 700;
}

.q-fixed-sequence {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10rpx;
  margin-bottom: 16rpx;
}

.q-fixed-sequence-item {
  min-width: 52rpx;
  padding: 8rpx 12rpx;
  border: 1rpx solid rgba(0, 0, 0, 0.08);
  border-radius: 999rpx;
  background: #ffffff;
  color: #5f6672;
  text-align: center;
  font-size: 21rpx;
  font-weight: 760;
}

.q-fixed-sequence-item.locked {
  border-color: rgba(31, 122, 77, 0.22);
  background: rgba(31, 122, 77, 0.08);
  color: #1f7a4d;
}

.q-passage-scroll {
  max-height: 620rpx;
}

.q-passage-segments {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.q-passage-segment {
  display: flex;
  align-items: flex-start;
  gap: 14rpx;
  padding: 16rpx 18rpx;
  border: 1rpx solid transparent;
  border-radius: 18rpx;
  background: #ffffff;
}

.q-passage-segment.active {
  border-color: rgba(31, 122, 77, 0.32);
  background: rgba(31, 122, 77, 0.08);
}

.q-segment-marker {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 38rpx;
  height: 38rpx;
  border-radius: 50%;
  background: #f2f3f5;
  color: #5f6672;
  font-size: 20rpx;
  font-weight: 800;
}

.q-passage-segment.active .q-segment-marker {
  background: #1f7a4d;
  color: #fff;
}

.q-passage-content {
  display: block;
  color: #1d1d1f;
  font-size: 27rpx;
  line-height: 1.72;
}

.q-passage-annotation {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
  margin-top: 16rpx;
  padding-top: 14rpx;
  border-top: 1rpx solid rgba(0, 0, 0, 0.06);
  color: #5f6672;
  font-size: 22rpx;
  font-weight: 700;
}

.q-passage-clear {
  flex-shrink: 0;
  color: #1f7a4d;
}

.q-image-list {
  display: flex;
  flex-direction: column;
  gap: 18rpx;
  margin-top: 24rpx;
}

.q-image-list.answer-images,
.q-image-list.result-answer-images {
  margin-top: 20rpx;
}

.q-image-card {
  overflow: hidden;
  border: 1rpx solid rgba(0, 0, 0, 0.08);
  border-radius: 18rpx;
  background: #ffffff;
}

.q-source-image {
  display: block;
  width: 100%;
  background: #ffffff;
}

.q-image-caption {
  display: block;
  padding: 12rpx 16rpx;
  border-top: 1rpx solid rgba(0, 0, 0, 0.06);
  color: #5f6672;
  font-size: 22rpx;
  font-weight: 650;
  line-height: 1.4;
}

/* 选项列表 */
.options-list {
  margin-top: 20rpx;
}
.option-item {
  display: flex;
  align-items: center;
  min-height: 96rpx;
  padding: 28rpx 32rpx;
  background: rgba(255, 255, 255, 0.92);
  border: 1rpx solid rgba(15, 23, 42, 0.08);
  border-radius: 24rpx;
  transition:
    transform 170ms cubic-bezier(0.16, 1, 0.3, 1),
    opacity 170ms ease,
    border-color 170ms ease,
    background-color 170ms ease,
    box-shadow 170ms ease;
  position: relative;
}
.option-item:active {
  transform: scale(0.975);
}
.option-item.selected {
  border-color: #1f7a4d;
  background: rgba(31, 122, 77, 0.08);
  box-shadow: 0 12rpx 30rpx rgba(31, 122, 77, 0.08);
}
.option-item.correct {
  border-color: #34c759;
  background: rgba(52, 199, 89, 0.08);
  box-shadow: 0 14rpx 34rpx rgba(52, 199, 89, 0.12);
}
.option-item.wrong {
  border-color: #ff3b30;
  background: rgba(255, 59, 48, 0.08);
  box-shadow: 0 14rpx 34rpx rgba(255, 59, 48, 0.1);
}
.option-item.option-folded {
  max-height: 64rpx;
  padding-top: 16rpx;
  padding-bottom: 16rpx;
  opacity: 0.34;
  box-shadow: none;
}
.option-item.option-folded .opt-text {
  max-height: 36rpx;
  overflow: hidden;
  color: #8e8e93;
}
.option-item.option-muted-after-answer {
  background: rgba(255, 255, 255, 0.72);
}
.option-item.disabled {
  opacity: 0.46;
  pointer-events: none;
}
.opt-index {
  font-weight: 760;
  color: #1d1d1f;
  background: #f2f3f5;
  font-size: 32rpx;
  flex-shrink: 0;
  width: 56rpx;
  height: 56rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  margin-right: 20rpx;
}

.option-item.correct .opt-index {
  color: #ffffff;
  background: #34c759;
}

.option-item.wrong .opt-index {
  color: #ffffff;
  background: #ff3b30;
}
.opt-text {
  flex: 1;
  font-size: 30rpx;
  color: #1d1d1f;
  font-weight: 500;
  line-height: 1.5;
  word-break: break-all;
}

.dark-mode .option-item {
  background: rgba(34, 37, 45, 0.86);
  border-color: rgba(255, 255, 255, 0.08);
}

.dark-mode .option-item.selected {
  border-color: rgba(0, 224, 255, 0.4);
  background: rgba(0, 224, 255, 0.09);
}

.dark-mode .opt-index {
  color: #f5f7fb;
  background: rgba(255, 255, 255, 0.08);
}

.dark-mode .opt-text {
  color: #f5f7fb;
}
.select-indicator {
  width: 40rpx;
  height: 40rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32rpx;
  color: var(--primary);
  flex-shrink: 0;
}

/* 智能反馈图层动画 */
.ai-feedback-layer {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 200;
  background: var(--overlay);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
.scan-line {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 6rpx;
  background: linear-gradient(90deg, transparent, var(--primary), transparent);
  will-change: transform, opacity;
  animation: scanMove 2s infinite;
}
@keyframes scanMove {
  0% {
    transform: translateY(0);
    opacity: 0;
  }
  50% {
    opacity: 1;
  }
  100% {
    transform: translateY(100vh);
    opacity: 0;
  }
}

.thinking-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  @include em-flex-gap(30rpx);
}
.pulse-ring {
  width: 140rpx;
  height: 140rpx;
  border: 4rpx solid var(--primary);
  border-radius: 50%;
  animation: ringPulse 1.5s infinite;
}
@keyframes ringPulse {
  0% {
    transform: scale(0.8);
    opacity: 0.8;
  }
  100% {
    transform: scale(1.6);
    opacity: 0;
  }
}
.ai-text {
  margin-top: 20rpx;
  font-weight: bold;
  color: var(--primary);
  font-size: 28rpx;
}

/* 结果弹窗 */
.result-pop {
  position: fixed;
  /* 适配 iPhone 14/15 Pro 底部安全区域：使用 env() 动态计算 bottom 值 */
  bottom: calc(120rpx + constant(safe-area-inset-bottom));
  bottom: calc(120rpx + env(safe-area-inset-bottom));
  left: 30rpx;
  right: 30rpx;
  z-index: 300;
  padding: 34rpx;
  max-height: calc(78vh - env(safe-area-inset-bottom));
  overflow: hidden;
  display: flex;
  flex-direction: column;
  background: rgba(255, 255, 255, 0.94);
  border: 1rpx solid rgba(15, 23, 42, 0.08);
  border-radius: 32rpx;
  box-shadow:
    0 -8rpx 40rpx rgba(15, 23, 42, 0.12),
    inset 0 1rpx 0 rgba(255, 255, 255, 0.86);
  animation: slideUpResult 0.35s cubic-bezier(0.32, 0.72, 0, 1) forwards;

  /* FSRS 按钮色彩变量 — 基于全局语义色的半透明变体 */
  --fsrs-again-bg: color-mix(in srgb, var(--danger) 30%, transparent);
  --fsrs-again-border: color-mix(in srgb, var(--danger) 50%, transparent);
  --fsrs-hard-bg: color-mix(in srgb, var(--warning) 30%, transparent);
  --fsrs-hard-border: color-mix(in srgb, var(--warning) 50%, transparent);
  --fsrs-good-bg: color-mix(in srgb, var(--success) 25%, transparent);
  --fsrs-good-border: color-mix(in srgb, var(--success) 40%, transparent);
  --fsrs-easy-bg: color-mix(in srgb, var(--info) 25%, transparent);
  --fsrs-easy-border: color-mix(in srgb, var(--info) 40%, transparent);
}

.dark-mode .result-pop {
  background: rgba(34, 37, 45, 0.94);
  border-color: rgba(255, 255, 255, 0.1);
  box-shadow:
    0 -10rpx 46rpx rgba(0, 0, 0, 0.42),
    inset 0 1rpx 0 rgba(255, 255, 255, 0.08);
}
@keyframes slideUpResult {
  from {
    transform: translateY(100%);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

/* 结果弹窗背景遮罩 */
.result-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.18);
  z-index: 299;
  animation: fadeInBackdrop 0.2s ease forwards;
}
@keyframes fadeInBackdrop {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.result-pop.correct {
  color: #1d1d1f;
}
.result-pop.wrong {
  color: #1d1d1f;
}

.result-header {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  @include em-flex-gap(18rpx, row);
  margin-bottom: 22rpx;
  position: relative;
}

.result-status-mark {
  width: 64rpx;
  height: 64rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  flex-shrink: 0;
  background: rgba(15, 23, 42, 0.06);
  color: #1d1d1f;
}

.result-primary-action {
  width: 100%;
  border-radius: 999rpx;
  background: linear-gradient(135deg, #1d1d1f 0%, #30343b 100%);
  color: #ffffff;
  box-shadow: 0 12rpx 28rpx rgba(15, 23, 42, 0.16);
}

.result-pop.correct .result-status-mark {
  background: rgba(159, 232, 112, 0.2);
  color: #1f7a4d;
}

.result-pop.wrong .result-status-mark {
  background: rgba(255, 123, 114, 0.15);
  color: #b42318;
}

.dark-mode .result-status-mark {
  background: rgba(255, 255, 255, 0.08);
  color: #f5f7fb;
}

.dark-mode .result-pop.correct .result-status-mark {
  background: rgba(159, 232, 112, 0.16);
  color: #9fe870;
}

.dark-mode .result-pop.wrong .result-status-mark {
  background: rgba(255, 123, 114, 0.18);
  color: #ffb4ab;
}

.result-pop.correct .result-primary-action {
  background: linear-gradient(135deg, #9fe870 0%, #75ddff 100%);
}

.result-pop.correct .result-action-icon,
.result-pop.correct .result-primary-label {
  color: #10281a;
}

.result-pop.wrong .result-primary-action {
  background: linear-gradient(135deg, #ff7b72 0%, #f59e0b 100%);
}

.dark-mode .result-pop.wrong .result-primary-action,
.dark-mode .result-pop.correct .result-primary-action {
  box-shadow: 0 14rpx 34rpx rgba(0, 0, 0, 0.22);
}

.result-primary-action-hover,
.result-primary-action:active {
  transform: scale(0.98);
  opacity: 0.9;
  box-shadow: none;
}

.result-primary-action.disabled {
  opacity: 0.72;
}

.result-action-row {
  position: relative;
  z-index: 2;
  margin-top: 28rpx;
  padding-top: 24rpx;
  border-top: 1rpx solid rgba(15, 23, 42, 0.08);
}

.dark-mode .result-action-row {
  border-top-color: rgba(255, 255, 255, 0.08);
}

.result-next-btn {
  min-height: 92rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  @include em-flex-gap(12rpx, row);
  transition:
    transform 0.22s ease,
    opacity 0.22s ease,
    box-shadow 0.22s ease;
}

.result-action-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  color: #ffffff;
}

.result-primary-label {
  font-size: 28rpx;
  font-weight: 700;
  color: #ffffff;
}

.status-title {
  position: relative;
  z-index: 1;
  font-size: 36rpx;
  font-weight: 760;
  flex: 1;
  text-align: left;
}

.dark-mode .status-title,
.dark-mode .ai-analysis-brief,
.dark-mode .analysis-body,
.dark-mode .answer-display {
  color: #f5f7fb;
}

.result-content-scroll {
  position: relative;
  z-index: 1;
  min-height: 0;
  max-height: 52vh;
  flex: 1;
}

/* 智能深度诊断区域 */
.ai-analysis-scroll {
  position: relative;
  z-index: 1;
  padding: 4rpx 0 10rpx;
}
.analysis-tag {
  display: flex;
  align-items: center;
  @include em-flex-gap(10rpx, row);
  margin-bottom: 20rpx;
  padding: 10rpx 20rpx;
  background: #f2f3f5;
  border-radius: 18rpx;
}

.dark-mode .analysis-tag {
  background: rgba(255, 255, 255, 0.07);
}
.sparkle-icon {
  font-size: 28rpx;
}
.analysis-tag text {
  font-size: 24rpx;
  font-weight: 600;
  opacity: 0.9;
  color: #5f6672;
}
.analysis-body {
  font-size: 28rpx;
  line-height: 1.8;
  white-space: pre-wrap;
  word-wrap: break-word;
  display: block;
  padding: 0 20rpx;
  color: #1d1d1f;
}
/* AI个人历史微反馈 */
.personal-hint-bar {
  margin: 8rpx 20rpx 16rpx;
  padding: 12rpx 16rpx;
  background: color-mix(in srgb, var(--warning) 10%, transparent);
  border-radius: 12rpx;
  border-left: 4rpx solid var(--warning, #f59e0b);
}
.personal-hint-text {
  font-size: 24rpx;
  color: var(--warning, #b45309);
  line-height: 1.5;
}
.dark-mode .personal-hint-bar {
  background: rgba(245, 158, 11, 0.15);
}
.dark-mode .personal-hint-text {
  color: var(--warning, #fbbf24);
}
/* 学习节奏：休息提醒条 */
.break-reminder-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16rpx 30rpx;
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.12), rgba(168, 85, 247, 0.12));
  border-bottom: 1rpx solid rgba(99, 102, 241, 0.2);
}
.break-reminder-text {
  font-size: 24rpx;
  color: var(--text-accent, #6366f1);
  flex: 1;
}
.break-dismiss {
  font-size: 24rpx;
  color: var(--text-accent, #6366f1);
  font-weight: 600;
  padding: 6rpx 20rpx;
  border-radius: 12rpx;
  background: rgba(99, 102, 241, 0.15);
}
.dark-mode .break-reminder-text {
  color: var(--text-accent, #a78bfa);
}
.dark-mode .break-dismiss {
  color: var(--text-accent, #a78bfa);
  background: rgba(99, 102, 241, 0.2);
}
.answer-display {
  display: flex;
  align-items: center;
  @include em-flex-gap(10rpx, row);
  margin-bottom: 20rpx;
  padding: 0 20rpx;
}
.answer-label {
  font-size: 24rpx;
  color: #8e8e93;
}
.answer-value {
  font-size: 32rpx;
  font-weight: 700;
  color: #1f7a4d;
}

.dark-mode .answer-label {
  color: rgba(245, 247, 251, 0.58);
}

.dark-mode .answer-value {
  color: #75ddff;
}

.knowledge-card {
  margin: 0 20rpx 22rpx;
  padding: 22rpx;
  border: 1rpx solid rgba(31, 122, 77, 0.12);
  border-radius: 20rpx;
  background: rgba(31, 122, 77, 0.06);
}

.dark-mode .knowledge-card {
  border-color: rgba(0, 224, 255, 0.14);
  background: rgba(0, 224, 255, 0.08);
}

.dark-mode .knowledge-tag {
  background: rgba(255, 255, 255, 0.08);
  color: rgba(245, 247, 251, 0.74);
}

.knowledge-card.compact {
  margin: 0 0 20rpx;
}

.knowledge-card-head {
  display: flex;
  align-items: baseline;
  gap: 12rpx;
}

.knowledge-label {
  flex-shrink: 0;
  padding: 4rpx 10rpx;
  border-radius: 999rpx;
  background: rgba(31, 122, 77, 0.12);
  color: #1f7a4d;
  font-size: 20rpx;
  font-weight: 850;
}

.knowledge-title {
  min-width: 0;
  color: #1d1d1f;
  font-size: 27rpx;
  font-weight: 760;
  line-height: 1.35;
}

.knowledge-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8rpx;
  margin-top: 14rpx;
}

.knowledge-tag {
  padding: 5rpx 10rpx;
  border-radius: 999rpx;
  background: #ffffff;
  color: #5f6672;
  font-size: 20rpx;
  font-weight: 700;
}

.knowledge-detail {
  display: block;
  margin-top: 14rpx;
  color: #3f4652;
  font-size: 25rpx;
  line-height: 1.64;
}

.ai-analysis-brief {
  position: relative;
  z-index: 1;
  font-size: 26rpx;
  margin-bottom: 30rpx;
  line-height: 1.5;
  color: #1d1d1f;
}
.ai-analysis-brief .label {
  font-weight: 700;
  margin-right: 10rpx;
  color: #5f6672;
}

.footer-placeholder {
  height: 300rpx;
  /* 适配 iPhone 底部安全区域 */
  padding-bottom: constant(safe-area-inset-bottom);
  padding-bottom: env(safe-area-inset-bottom, 0px);
}

/* ==================== 新增样式：收藏按钮 ==================== */
.q-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20rpx;
}

.q-actions {
  display: flex;
  align-items: center;
  @include em-flex-gap(16rpx, row);
}

.favorite-btn {
  width: 60rpx;
  height: 60rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: rgba(255, 150, 0, 0.12);
  transition: all 0.3s ease;
}

.favorite-btn:active {
  transform: scale(0.9);
}

.favorite-btn.is-favorited {
  background: rgba(255, 150, 0, 0.2);
}

.favorite-btn.is-favorited .favorite-icon {
  color: var(--warning);
}

.favorite-icon {
  font-size: 32rpx;
  color: var(--text-sub);
  transition: all 0.3s ease;
}

/* ==================== 新增样式：答题动画 ==================== */
@keyframes correctPulse {
  0% {
    transform: scale(1);
    opacity: 1;
  }
  30% {
    transform: scale(1.05);
  }
  60% {
    transform: scale(0.98);
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}

@keyframes wrongShake {
  0%,
  100% {
    transform: translateX(0);
  }
  10%,
  30%,
  50%,
  70%,
  90% {
    transform: translateX(-8rpx);
  }
  20%,
  40%,
  60%,
  80% {
    transform: translateX(8rpx);
  }
}

.quiz-correct-animation {
  animation: none;
}

.quiz-correct-animation .question-card {
  animation:
    correctPulse 360ms cubic-bezier(0.16, 1, 0.3, 1),
    correctGlow 420ms ease-out;
}

.quiz-wrong-animation {
  animation: none;
}

.quiz-wrong-animation .question-card {
  animation:
    wrongShake 360ms cubic-bezier(0.36, 0.07, 0.19, 0.97),
    wrongGlow 420ms ease-out;
}

/* ==================== 新增样式：滑动提示 ==================== */
.swipe-hint {
  position: absolute;
  bottom: 200rpx;
  left: 50%;
  transform: translateX(-50%);
  font-size: 24rpx;
  color: var(--text-sub);
  opacity: 0.6;
  display: flex;
  align-items: center;
  @include em-flex-gap(10rpx, row);
}

.swipe-hint-icon {
  font-size: 28rpx;
}

/* ==================== 新增样式：笔记按钮 ==================== */
.note-btn {
  width: 60rpx;
  height: 60rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--bg-secondary);
  transition: all 0.3s ease;
  position: relative;
}

.note-btn:active {
  transform: scale(0.9);
}

.note-btn.has-notes {
  background: linear-gradient(135deg, var(--primary), var(--primary));
}

.note-btn.has-notes .note-icon {
  filter: brightness(1.2);
}

.note-icon {
  font-size: 28rpx;
}

.note-count {
  position: absolute;
  top: -4rpx;
  right: -4rpx;
  min-width: 28rpx;
  height: 28rpx;
  background: var(--danger);
  color: var(--text-inverse, #fff);
  font-size: 20rpx;
  font-weight: bold;
  border-radius: 14rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 6rpx;
}

/* ==================== 新增样式：笔记弹窗 ==================== */
.note-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--overlay, rgba(0, 0, 0, 0.5));
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40rpx;
}

.note-modal {
  width: 100%;
  max-width: 600rpx;
  background: var(--bg-card);
  border-radius: 32rpx;
  padding: 40rpx;
  box-shadow: var(--shadow-xl);
}

.note-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 30rpx;
}

.note-modal-title {
  font-size: 36rpx;
  font-weight: bold;
  color: var(--text-primary);
}

.note-modal-close {
  width: 48rpx;
  height: 48rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32rpx;
  color: var(--text-sub);
}

.note-textarea {
  width: 100%;
  height: 200rpx;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 16rpx;
  padding: 20rpx;
  font-size: 28rpx;
  color: var(--text-primary);
  margin-bottom: 24rpx;
  box-sizing: border-box;
}

.note-tags {
  display: flex;
  flex-wrap: wrap;
  @include em-flex-gap(16rpx, row);
  margin-bottom: 30rpx;
}

.note-tag {
  padding: 10rpx 20rpx;
  border: 2rpx solid var(--border);
  border-radius: 20rpx;
  font-size: 24rpx;
  color: var(--text-sub);
  background: var(--bg-secondary);
  transition: all 0.2s ease;
}

.note-tag.selected {
  background: var(--primary);
  color: var(--text-primary-foreground);
  border-color: var(--primary);
}

.note-modal-footer {
  display: flex;
  @include em-flex-gap(20rpx, row);
}

.note-cancel-btn {
  flex: 1;
  height: 80rpx;
  background: var(--bg-secondary);
  color: var(--text-sub);
  font-size: 28rpx;
  border-radius: 16rpx;
  border: none;
}

.note-save-btn {
  flex: 1;
  height: 80rpx;
  background: var(--cta-primary-bg);
  color: var(--cta-primary-text);
  font-size: 28rpx;
  font-weight: bold;
  border-radius: 16rpx;
  border: 1rpx solid var(--cta-primary-border);
  box-shadow: var(--cta-primary-shadow);
}

/* hover-class 反馈 */
.item-hover {
  opacity: 0.7;
}

.option-hover {
  opacity: 0.85;
  transform: scale(0.98);
}

/* FSRS 智能评分按钮（答对/答错各显示2个） */
.fsrs-rating-row {
  display: flex;
  /* gap: 16rpx; -- replaced for Android WebView compat */
  margin-top: 20rpx;
}
.fsrs-rating-btn + .fsrs-rating-btn {
  margin-left: 16rpx;
}

.fsrs-rating-btn {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 20rpx 8rpx;
  border-radius: 20rpx;
  min-height: 100rpx;
  margin: 0;
  line-height: 1.3;
  transition:
    transform 0.15s,
    opacity 0.15s;
}

.fsrs-rating-btn::after {
  border: 0;
}

.fsrs-rating-btn:active {
  transform: scale(0.95);
  opacity: 0.85;
}

.result-pop .fsrs-rating-btn {
  background: rgba(255, 255, 255, 0.92);
  border-color: rgba(255, 255, 255, 0.72);
}

.result-pop .fsrs-rating-label {
  color: #1a1d26;
}

.result-pop .fsrs-rating-interval {
  color: rgba(26, 29, 38, 0.68);
}

.fsrs-again {
  background: rgba(255, 75, 75, 0.12);
  border: 1rpx solid rgba(255, 59, 48, 0.16);
  box-shadow: none;
}

.fsrs-hard {
  background: rgba(255, 150, 0, 0.12);
  border: 1rpx solid rgba(255, 149, 0, 0.16);
  box-shadow: none;
}

.fsrs-good {
  background: rgba(88, 204, 2, 0.12);
  border: 1rpx solid rgba(52, 199, 89, 0.16);
  box-shadow: none;
}

.fsrs-easy {
  background: rgba(28, 176, 246, 0.12);
  border: 1rpx solid rgba(31, 122, 77, 0.16);
  box-shadow: none;
}

.fsrs-rating-label {
  font-size: 28rpx;
  font-weight: 700;
}

.fsrs-again .fsrs-rating-label {
  color: var(--danger);
}
.fsrs-hard .fsrs-rating-label {
  color: var(--warning);
}
.fsrs-good .fsrs-rating-label {
  color: #58cc02;
}
.fsrs-easy .fsrs-rating-label {
  color: var(--info);
}

.fsrs-rating-interval {
  font-size: 22rpx;
  color: var(--text-secondary);
  margin-top: 6rpx;
}

/* ==================== 经典闪卡模式 ==================== */
.flashcard-area {
  padding: 0 30rpx 40rpx;
}

/* 翻转前：查看答案按钮 */
.flashcard-reveal {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 60rpx 0;
}

.flashcard-hint {
  font-size: 28rpx;
  color: var(--text-secondary);
  margin-bottom: 30rpx;
}

.flashcard-reveal-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 28rpx 60rpx;
  background: #1d1d1f;
  border-radius: 22rpx;
  box-shadow: none;
  transition:
    transform 0.15s,
    box-shadow 0.15s;
}

.flashcard-reveal-btn:active {
  transform: scale(0.98);
  box-shadow: none;
}

.flashcard-reveal-text {
  font-size: 32rpx;
  font-weight: 700;
  color: #fff;
  margin-left: 12rpx;
}

.flashcard-reveal-btn .base-icon {
  color: #fff;
}

/* 翻转后：答案卡片 */
.flashcard-answer-area {
  animation: flashcardReveal 0.35s ease-out;
}

@keyframes flashcardReveal {
  from {
    opacity: 0;
    transform: translateY(20rpx) scale(0.97);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.flashcard-answer-card {
  padding: 30rpx;
  border-left: 6rpx solid #1f7a4d;
}

.flashcard-answer-label {
  display: flex;
  align-items: center;
  font-size: 26rpx;
  font-weight: 700;
  color: #1f7a4d;
  margin-bottom: 20rpx;
}

.flashcard-answer-label text {
  margin-left: 8rpx;
}

.flashcard-answer-scroll {
  max-height: 500rpx;
}

.flashcard-answer-content {
  font-size: 28rpx;
  line-height: 1.8;
  white-space: pre-wrap;
  word-wrap: break-word;
  color: var(--text-primary);
}

.flashcard-explanation {
  margin-top: 24rpx;
  padding-top: 24rpx;
  border-top: 1rpx solid var(--overlay);
}

.flashcard-explanation-label {
  font-size: 24rpx;
  font-weight: 600;
  color: var(--text-secondary);
  margin-bottom: 12rpx;
  display: block;
}

.flashcard-explanation-content {
  font-size: 26rpx;
  line-height: 1.7;
  color: var(--text-secondary);
  white-space: pre-wrap;
  word-wrap: break-word;
}

/* 闪卡模式评分提示 */
.flashcard-rate-hint {
  font-size: 24rpx;
  color: var(--text-secondary);
  text-align: center;
  margin-top: 30rpx;
  margin-bottom: 12rpx;
}

/* 闪卡模式四级评分按钮（全部显示，不分对错） */
.flashcard-rating {
  margin-top: 0;
}

.flashcard-rating .fsrs-rating-btn {
  min-height: 110rpx;
}

/* 暗色模式适配 */
.dark-mode .flashcard-reveal-btn {
  background: linear-gradient(135deg, #00a65e, #008a4c);
  box-shadow: 0 8rpx 0 #006b38;
}

.dark-mode .flashcard-answer-card {
  border-left-color: #00a65e;
}

.dark-mode .flashcard-answer-label {
  color: #58cc02;
}

.dark-mode .q-image-card {
  border-color: rgba(255, 255, 255, 0.12);
  background: #111827;
}

.dark-mode .q-image-caption {
  border-top-color: rgba(255, 255, 255, 0.12);
  color: #cbd5e1;
}

/* ✅ 完成庆祝动画 */
@keyframes celebrateScale {
  0% {
    transform: scale(0.8);
    opacity: 0;
  }
  50% {
    transform: scale(1.05);
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}

@keyframes celebrateStars {
  0% {
    transform: rotate(0deg) scale(0);
    opacity: 0;
  }
  50% {
    transform: rotate(180deg) scale(1.2);
    opacity: 1;
  }
  100% {
    transform: rotate(360deg) scale(1);
    opacity: 0.8;
  }
}

.complete-celebrate {
  animation: celebrateScale 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
}

/* 完美全对时的特殊效果 */
.perfect-score-glow {
  position: relative;
}
.perfect-score-glow::after {
  content: '';
  position: absolute;
  inset: -20rpx;
  border-radius: 50rpx;
  background: radial-gradient(circle, rgba(255, 215, 0, 0.3) 0%, transparent 70%);
  animation: celebrateStars 2s ease-in-out infinite;
  pointer-events: none;
}

</style>
