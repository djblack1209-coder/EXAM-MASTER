<template>
  <view class="container" :class="{ 'dark-mode': isDark, 'wot-theme-dark': isDark }">
    <view class="aurora-bg" />

    <view class="nav-header" :style="{ paddingTop: statusBarHeight + 'px', height: navBarHeight + 'px' }">
      <view class="nav-content" :style="{ paddingRight: capsuleMargin + 'px', height: '44px' }">
        <view class="back-area" hover-class="item-hover" @tap="handleExit">
          <BaseIcon name="arrow-left" :size="36" />
          <text id="e2e-quiz-progress" class="progress-text" @tap.stop="handleOpenAnswerSheet">
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
              {{ currentQuestion.source === 'guest_demo' ? '示例 · ' : '' }}{{ questionTypeLabel }}
            </view>
            <view class="q-actions">
              <!-- 笔记按钮 -->
              <view
                class="note-btn"
                :class="{ 'has-notes': currentQuestionNotes.length > 0, 'is-action-locked': isQuestionActionLocked }"
                hover-class="item-hover"
                @tap.stop="handleOpenNote()"
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
                :class="{ 'is-favorited': isCurrentFavorited, 'is-action-locked': isQuestionActionLocked }"
                hover-class="item-hover"
                @tap.stop="handleToggleFavorite()"
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
          <view
            v-if="currentQuestion.type === 'translation' && currentQuestion.targetSegment"
            id="e2e-quiz-translation-target"
            class="q-translation-target"
          >
            <RichText :content="currentQuestion.targetSegment" />
          </view>
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
                selected: isOptionSelected(idx),
                correct: hasAnswered && isCorrectOption(idx),
                wrong: hasAnswered && isOptionSelected(idx) && !isCorrectOption(idx),
                'option-folded': isOptionFolded(idx),
                'option-muted-after-answer': isOptionDeemphasized(idx),
                disabled: isAnalyzing || isNavigating || hasAnswered
              }
            ]"
            hover-class="option-hover"
            role="button"
            :aria-label="`${getOptionLabel(idx)}. ${opt}`"
            :aria-pressed="isOptionSelected(idx)"
            :aria-disabled="isAnalyzing || isNavigating || hasAnswered"
            :tabindex="isAnalyzing || isNavigating || hasAnswered ? -1 : 0"
            @tap="selectOption(idx)"
            @keydown.enter.prevent="selectOption(idx)"
            @keydown.space.prevent="selectOption(idx)"
          >
            <view class="opt-index">
              {{ getOptionLabel(idx) }}
            </view>
            <RichText class="opt-text" :content="opt" />
            <view v-if="hasAnswered" class="select-indicator">
              <BaseIcon v-if="isCorrectOption(idx)" name="check" :size="28" />
              <BaseIcon v-else-if="isOptionSelected(idx) && !isCorrectOption(idx)" name="cross" :size="28" />
              <view v-else-if="isOptionSelected(idx)" class="indicator-circle" />
            </view>
          </view>
          <wd-button
            v-if="!hasAnswered"
            id="e2e-quiz-submit-choice"
            custom-class="choice-submit"
            :disabled="!canSubmitChoice"
            role="button"
            :aria-disabled="!canSubmitChoice"
            :tabindex="canSubmitChoice ? 0 : -1"
            @click="submitChoice"
            @keydown.enter.prevent="submitChoice"
            @keydown.space.prevent="submitChoice"
          >
            提交作答
          </wd-button>
        </view>

        <view v-if="currentAnswerRecord && !showResult" class="answer-sync" role="status" aria-live="polite">
          <text>{{ answerSyncText }}</text>
          <wd-button v-if="canRetryAnswerSync" size="small" @click="retryAnswerSync">重试同步</wd-button>
        </view>

        <!-- 经典闪卡：查看参考与独立自评记录。 -->
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

            <view
              v-if="recordingObservation || observationError"
              role="status"
              aria-live="polite"
              class="flashcard-rate-hint"
            >
              <text>{{ recordingObservation ? '保存中…' : observationError }}</text>
              <button v-if="!referenceSaved && !recordingObservation" @tap="flipFlashcard">重试保存查看记录</button>
            </view>
            <!-- 记忆自评不直接安排可靠复习。 -->
            <view class="flashcard-rate-hint">根据记忆情况自评：</view>
            <view class="fsrs-rating-row flashcard-rating">
              <view
                class="fsrs-rating-btn fsrs-again"
                role="button"
                :tabindex="referenceSaved && !recordingObservation ? 0 : -1"
                :aria-disabled="!referenceSaved || recordingObservation"
                @tap="rateFlashcardAndNext(1)"
                @keydown.enter.prevent="rateFlashcardAndNext(1)"
                @keydown.space.prevent="rateFlashcardAndNext(1)"
              >
                <text class="fsrs-rating-label">忘了</text>
                <text class="fsrs-rating-interval">{{ getFlashcardInterval('again') }}</text>
              </view>
              <view
                class="fsrs-rating-btn fsrs-hard"
                role="button"
                :tabindex="referenceSaved && !recordingObservation ? 0 : -1"
                :aria-disabled="!referenceSaved || recordingObservation"
                @tap="rateFlashcardAndNext(2)"
                @keydown.enter.prevent="rateFlashcardAndNext(2)"
                @keydown.space.prevent="rateFlashcardAndNext(2)"
              >
                <text class="fsrs-rating-label">模糊</text>
                <text class="fsrs-rating-interval">{{ getFlashcardInterval('hard') }}</text>
              </view>
              <view
                class="fsrs-rating-btn fsrs-good"
                role="button"
                :tabindex="referenceSaved && !recordingObservation ? 0 : -1"
                :aria-disabled="!referenceSaved || recordingObservation"
                @tap="rateFlashcardAndNext(3)"
                @keydown.enter.prevent="rateFlashcardAndNext(3)"
                @keydown.space.prevent="rateFlashcardAndNext(3)"
              >
                <text class="fsrs-rating-label">记得</text>
                <text class="fsrs-rating-interval">{{ getFlashcardInterval('good') }}</text>
              </view>
              <view
                class="fsrs-rating-btn fsrs-easy"
                role="button"
                :tabindex="referenceSaved && !recordingObservation ? 0 : -1"
                :aria-disabled="!referenceSaved || recordingObservation"
                @tap="rateFlashcardAndNext(4)"
                @keydown.enter.prevent="rateFlashcardAndNext(4)"
                @keydown.space.prevent="rateFlashcardAndNext(4)"
              >
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
          <BaseIcon
            :name="resultStatus === 'pending' ? 'info' : resultStatus === 'correct' ? 'check' : 'cross'"
            :size="30"
          />
        </view>
        <text class="status-title">
          {{ resultStatus === 'pending' ? '已记录，待核对' : resultStatus === 'correct' ? '回答正确' : '再想想' }}
        </text>
      </view>

      <scroll-view scroll-y class="result-content-scroll">
        <view v-if="currentAnswerRecord" class="answer-sync" role="status" aria-live="polite">
          <text>{{ answerSyncText }}</text>
          <wd-button v-if="canRetryAnswerSync" size="small" @click="retryAnswerSync">重试同步</wd-button>
        </view>

        <view v-if="resultStatus === 'wrong' || resultStatus === 'pending'" class="ai-analysis-scroll">
          <view class="analysis-tag">
            <view class="sparkle-icon">
              <BaseIcon name="sparkle" :size="28" />
            </view>
            <text>解析</text>
            <!-- ✅ [P0重构] 内联AI加载指示器 -->
            <text v-if="resultStatus === 'wrong' && !aiComment" class="ai-loading-hint">分析中...</text>
          </view>
          <!-- AI 个人历史微反馈 — 基于错题历史的一句话上下文提醒 -->
          <view v-if="personalHint" class="personal-hint-bar">
            <text class="personal-hint-text">{{ personalHint }}</text>
          </view>
          <view class="answer-display">
            <text class="answer-label">{{ resultStatus === 'pending' ? '参考答案：' : '正确答案：' }}</text>
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

      <view class="result-assist-row">
        <view
          class="result-assist-btn"
          :class="{ active: currentQuestionNotes.length > 0 }"
          hover-class="result-assist-hover"
          role="button"
          @tap.stop="handleResultOpenNote"
        >
          <view class="result-assist-icon">
            <BaseIcon name="note" :size="26" />
          </view>
          <text class="result-assist-label">笔记</text>
          <text v-if="currentQuestionNotes.length > 0" class="result-assist-badge">
            {{ currentQuestionNotes.length }}
          </text>
        </view>
        <view
          class="result-assist-btn"
          :class="{ active: isCurrentFavorited }"
          hover-class="result-assist-hover"
          role="button"
          @tap.stop="handleResultToggleFavorite"
        >
          <view class="result-assist-icon">
            <BaseIcon :name="isCurrentFavorited ? 'star' : 'star-outline'" :size="26" />
          </view>
          <text class="result-assist-label">{{ isCurrentFavorited ? '已收藏' : '收藏' }}</text>
        </view>
        <view
          class="result-assist-btn"
          hover-class="result-assist-hover"
          role="button"
          @tap.stop="handleOpenAnswerSheet"
        >
          <view class="result-assist-icon">
            <BaseIcon name="book-open" :size="26" />
          </view>
          <text class="result-assist-label">答题卡</text>
        </view>
      </view>

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
      :title="resumeUnavailable ? '续答暂不可用' : '题库空空如也'"
      :content="resumeUnavailable ? '请返回刷题中心重试，原记录已保留。' : '请先到刷题中心加载题库，再开始练习。'"
      :confirm-text="resumeUnavailable ? '返回' : '去加载'"
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
            <view class="note-tag-dot" :style="{ background: tag.color }" />
            <text>{{ tag.name }}</text>
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
      :jump-locked="isAnswerSheetJumpLocked"
      @jump="handleJumpToQuestion"
      @close="showAnswerSheet = false"
    />

    <!-- 离线状态指示器 -->
    <OfflineIndicator :auto-show="true" position="top" :auto-hide-delay="0" />
  </view>
</template>

<script>
import { BRAND } from '@/config/brand.js';
import { modal } from '@/utils/modal.js';
import { toast } from '@/utils/toast.js';
import { storageService } from '@/services/storageService.js';
import CustomModal from '@/components/common/CustomModal.vue';

// ✅ P0-3: 导入自动保存功能
import {
  saveQuizProgress,
  loadQuizProgress,
  clearQuizProgress,
  getRecoverableQuizProgress,
  isQuizProgressComplete
} from '@/composables/useQuizAutoSave.js';
import { getUserId, getToken } from '@/services/auth-storage.js';
import { restoreQuizLearningAttempts } from '@/services/learning/quiz-learning-bridge.js';
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
import {
  startTimer as startQuestionTimer,
  stopTimer as stopQuestionTimer,
  pauseTimer as pauseQuestionTimer,
  resumeTimer as resumeQuestionTimer,
  getRemaining as getQuestionTime
} from './question-timer.js';
// ✅ 智能组题与自适应学习模块
import { pickQuestions } from './utils/smart-question-picker.js';
import { generateAdaptiveSequence, getNextRecommendedQuestion } from '@/utils/learning/adaptive-learning-engine.js';
// 离线缓存：使用统一的离线缓存服务
import { checkOfflineAvailability } from './services/offline-cache-service.js';
// ✅ 导入题目笔记模块
import { addQuestionNote, getNotesByQuestion, getNoteTags } from './question-note.js';
// ✅ P1: 提取的模块
import { saveToMistakes as saveMistake, updateMistakeWithAI as updateMistakeAI } from './quiz-mistake-handler.js';
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
import { ASSETS, getStaticAssetUrl } from '@/config/static-assets.js';
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
  isValidQuizAttemptId,
  createQuizAttemptId,
  getQuizOptionLabel,
  getQuizQuestionTypeLabel,
  getQuizAnswerRecordOutcome,
  LEGACY_REVIEW_HANDOFF_KEY,
  readLegacyReviewHandoff,
  summarizeQuizProgress,
  getQuizSelectionAnswer,
  hasQuizSelectableOptions,
  isCorrectQuizOption,
  isCorrectQuizSelection,
  isQuizMultiChoice,
  isQuizFlashcardMode,
  normalizeQuizQuestion,
  prepareQuizQuestion,
  prepareQuizSelection,
  QUIZ_REVIEW_HANDOFF_KEY,
  readQuizReviewHandoff,
  readSinglePracticeHandoff,
  upsertQuizAnswerRecord
} from '@/services/quiz-session-contract.js';
import { formatInterval } from '@/services/fsrs-service.js';
import {
  recordQuizLearningObservation,
  quizReferenceObservationExists
} from '@/services/learning/quiz-learning-bridge.js';

function normalizePracticeQuestion(q, index, options = {}) {
  return normalizeQuizQuestion(q, index, options);
}

function quizRecordOwnerMatches(page) {
  if (page.quizOwnerId !== null && page.quizOwnerId !== undefined) return (getUserId() || '') === page.quizOwnerId;
  return (page.mode !== 'legacy_review' && !page.resumeProgressIdentity) || (getUserId() || '') === page.resumeOwnerId;
}

function resumeTargetMatches(page, progress) {
  if (!page.resumeProgressIdentity) return !page.forceResumeProgress;
  return (
    progress !== null &&
    JSON.stringify(progress) === page.resumeProgressIdentity &&
    (getUserId() || '') === page.resumeOwnerId
  );
}

function rejectQuizResume(page) {
  page.resumeUnavailable = true;
  page.showResumeModal = false;
  page.questions = [];
  page.answeredQuestions = [];
  page.currentIndex = 0;
  page.userChoice = null;
  page.hasAnswered = false;
  page.questionBankFingerprint = '';
  page.showEmptyBankModal = true;
  if (page.timer) clearInterval(page.timer);
  page.timer = null;
  stopQuestionTimer(page.questionTimerToken);
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
      referenceObservationId: '',
      selfRatingObservationId: '',
      referenceSaved: false,
      recordingObservation: false,
      observationError: '',
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
      resultStatus: '', // 'pending', 'correct' or 'wrong'
      syncingAttemptIds: [],
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
      questionTimerToken: null,
      questionTimerBinding: '',
      questionTimerEnabled: true, // 是否启用单题计时
      questionBankFingerprint: '',
      forceResumeProgress: false,
      quizPageClosed: false,
      resumeUnavailable: false,
      resumeProgressIdentity: '',
      resumeOwnerId: '',
      quizOwnerId: null,
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
      legacyReviewId: '',
      singlePracticeId: '',
      smartReviewId: '',
      eloState: { userRating: 1500, questionRatings: {} },
      pendingTimers: [] // [AUDIT FIX R264] setTimeout 追踪，防止内存泄漏
    };
  },
  computed: {
    currentAnswerRecord() {
      return this.answeredQuestions.find(
        (item) =>
          item.index === this.currentIndex &&
          item.questionId === this.currentQuestion?.id &&
          item.source === 'reference_match'
      );
    },
    answerSyncText() {
      const record = this.currentAnswerRecord;
      if (!record) return '';
      if (this.syncingAttemptIds.includes(record.attemptId)) return '正在同步…';
      if (record.submission?.status === 'received') return '已同步，判分待核对';
      if (record.submission?.status === 'local_only' && record.submission.localSaved) return '仅保存在本机';
      if (record.submission?.localSaved) return '已保存在本机，同步未完成';
      return '保存状态待确认';
    },
    canRetryAnswerSync() {
      const record = this.currentAnswerRecord;
      return Boolean(
        record?.attemptId &&
        typeof record.userAnswer === 'string' &&
        record.ownerId &&
        record.ownerId === (getUserId() || '') &&
        getToken() &&
        record.submission?.status !== 'received' &&
        !this.syncingAttemptIds.includes(record.attemptId) &&
        !this.quizPageClosed &&
        !this.showResumeModal &&
        !this.resumeUnavailable
      );
    },
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
        questionBankFingerprint: this.questionBankFingerprint || '',
        ...((this.mode === 'smart_review' ? this.smartReviewId : this.singlePracticeId)
          ? { handoffId: this.mode === 'smart_review' ? this.smartReviewId : this.singlePracticeId }
          : {})
      };
    },
    isAnswerSheetJumpLocked() {
      return this.showResult || this.isAnalyzing || this.isNavigating;
    },
    isQuestionActionLocked() {
      return (
        !quizRecordOwnerMatches(this) ||
        this.quizPageClosed ||
        this.showResult ||
        this.isAnalyzing ||
        this.isNavigating ||
        this.showResumeModal ||
        this.resumeUnavailable
      );
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
      return (this.currentQuestion?.questionImages || []).map((image) => ({
        ...image,
        src: getStaticAssetUrl(image.src) || image.src
      }));
    },
    currentAnswerImages() {
      return (this.currentQuestion?.answerImages || []).map((image) => ({
        ...image,
        src: getStaticAssetUrl(image.src) || image.src
      }));
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
      const detail =
        explicitDetail || (this.resultStatus === 'correct' ? this.aiComment || this.currentQuestion.desc || '' : '');

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
    canSubmitChoice() {
      return (
        quizRecordOwnerMatches(this) &&
        !this.quizPageClosed &&
        !this.isAnalyzing &&
        !this.isNavigating &&
        !this.showResult &&
        !this.hasAnswered &&
        !this.showResumeModal &&
        !this.resumeUnavailable &&
        Boolean(getQuizSelectionAnswer(this.currentQuestion, this.userChoice))
      );
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
        return !this.isOptionSelected(idx);
      };
    },
    isOptionDeemphasized() {
      return (idx) => {
        if (!this.hasAnswered) return false;
        return !this.isCorrectOption(idx) && !this.isOptionSelected(idx);
      };
    },
    // ✅ 完美全对检测（用于庆祝动画）
    isPerfectScore() {
      return (
        this.showCompleteModal &&
        this.answeredQuestions.length > 0 &&
        this.answeredQuestions.every((a) => getQuizAnswerRecordOutcome(a) === 'correct')
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
      title: `智能刷题 - ${BRAND.name} 考研备考`,
      path: '/pages/practice/index',
      imageUrl: ASSETS.appShareCover
    };
  },

  onLoad(initialQuery = {}) {
    this.quizOwnerId = getUserId() || '';
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
    const routeQuery = {};
    // #ifdef H5
    if (typeof location !== 'undefined' && location.hash.split('?')[0] === '#/pages/practice-sub/do-quiz') {
      const params = new URLSearchParams(location.hash.split('?')[1] || '');
      for (const key of ['resume', 'mode', 'paperId', 'paper_id', 'reviewId', 'singleId']) {
        if (params.has(key)) routeQuery[key] = params.get(key);
      }
    }
    // #endif
    const query = {
      ...(currentPage?.$page?.options || currentPage?.options || {}),
      ...routeQuery,
      ...(initialQuery && typeof initialQuery === 'object' ? initialQuery : {})
    };
    this.mode = query.mode || '';
    if (this.mode === 'legacy_review') this.resumeOwnerId = getUserId() || '';
    this.legacyReviewId = query.reviewId || '';
    this.singlePracticeId = query.singleId || '';
    this.smartReviewId = this.mode === 'smart_review' ? query.reviewId || '' : '';
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
    if (!quizRecordOwnerMatches(this)) return rejectQuizResume(this);
    // 主题监听已在 onLoad 注册，仅刷新当前值
    this.isDark = storageService.get('theme_mode', 'light') === 'dark';
    // ✅ P1-1: 恢复计时器（onHide 时已暂停）
    if (this.questions && this.questions.length > 0 && !this.timer) {
      this.startTimer();
      if (!this.hasAnswered && !this.showResumeModal) resumeQuestionTimer(this.questionTimerToken);
    }
  },
  onUnload() {
    this.quizPageClosed = true;
    if (this.timer) {
      clearInterval(this.timer);
    }
    stopQuestionTimer(this.questionTimerToken);
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
    pauseQuestionTimer(this.questionTimerToken);
    this.saveCurrentProgress(true);
  },
  methods: {
    // [AUDIT FIX R264] 安全的 setTimeout 包装，组件卸载时自动清理
    _safeTimeout(fn, delay) {
      const id = setTimeout(() => {
        this.pendingTimers = this.pendingTimers.filter((t) => t !== id);
        if (!this.quizPageClosed && quizRecordOwnerMatches(this)) fn();
      }, delay);
      this.pendingTimers.push(id);
      return id;
    },
    // 旧备份没有本次原件/版本恢复授权，退出只保留现场。
    _restoreQuestionBankIfReview() {
      return { restored: false, reason: 'EXPLICIT_RESTORE_REQUIRED' };
    },
    getFlashcardInterval(ratingKey) {
      const intervalDays = this.flashcardFsrsPreview?.[ratingKey]?.intervalDays;
      return intervalDays == null ? '' : this.formatFsrsInterval(intervalDays);
    },
    // ✅ P0-3: 检查未完成的进度
    checkUnfinishedProgress() {
      if (this.resumeUnavailable) return;
      const progressContext = this.forceResumeProgress ? null : this.quizProgressContext;
      const progress = this.forceResumeProgress ? getRecoverableQuizProgress() : loadQuizProgress(progressContext);
      if (
        progress &&
        !isQuizProgressComplete(progress) &&
        (progress.currentIndex > 0 || progress.answeredQuestions.length > 0)
      ) {
        this.resumeProgressIdentity = JSON.stringify(progress);
        this.resumeOwnerId = getUserId() || '';
        const minutes = Math.floor(progress.seconds / 60);
        const seconds = Math.floor(progress.seconds % 60);
        this.resumeModalContent = `上次答到第 ${progress.currentIndex + 1} 题，用时 ${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}。是否继续？`;
        pauseQuestionTimer(this.questionTimerToken);
        this.showResumeModal = true;
      } else {
        if (this.forceResumeProgress) {
          rejectQuizResume(this);
          return;
        }
        this.startTimer();
      }
    },

    // ✅ P0-3: 恢复进度
    restoreProgress() {
      if (this.resumeProgressIdentity && (getUserId() || '') !== this.resumeOwnerId) {
        rejectQuizResume(this);
        return;
      }
      const progress = this.forceResumeProgress
        ? getRecoverableQuizProgress()
        : loadQuizProgress(this.quizProgressContext);
      if (!resumeTargetMatches(this, progress)) {
        rejectQuizResume(this);
        return;
      }
      if (progress) {
        if (progress.sessionId) this.sessionId = progress.sessionId;
        this.currentIndex = progress.currentIndex || 0;
        if (Array.isArray(progress.questions) && progress.questions.length > 0) {
          this.questions = progress.questions;
        }
        this.seconds = progress.seconds || 0;
        this.answeredQuestions = progress.answeredQuestions || [];
        this.aiComment = progress.aiComment || '';
        const question = this.questions[this.currentIndex];
        const observed = this.answeredQuestions.find(
          (row) => row.index === this.currentIndex && row.questionId === question?.id
        );
        if (isQuizFlashcardMode(question) && observed?.source === 'reference_view') {
          this.flashcardFlipped = true;
          this.referenceObservationId = observed.observationId || '';
          this.referenceSaved = quizReferenceObservationExists({
            currentQuestion: normalizeQuizQuestion(question),
            sessionId: this.sessionId,
            observationId: this.referenceObservationId
          });
          this.observationError = this.referenceSaved ? '' : '查看记录未确认，请重试';
        }

        const submittedChoice =
          hasQuizSelectableOptions(question) &&
          observed?.source === 'reference_match' &&
          isValidQuizAttemptId(observed.attemptId);
        this.hasAnswered = !!submittedChoice;
        this.userChoice = submittedChoice
          ? Array.isArray(observed.userChoice)
            ? [...observed.userChoice]
            : observed.userChoice
          : null;
        this.showResult = !!submittedChoice;
        if (submittedChoice) this.resultStatus = 'pending';

        if (progress.sessionId) {
          const sessionId = this.sessionId;
          const owner = getUserId() || '';
          restoreQuizLearningAttempts({
            questions: this.questions,
            answeredQuestions: this.answeredQuestions,
            sessionId,
            canContinue: () => !this.quizPageClosed && this.sessionId === sessionId && (getUserId() || '') === owner
          })
            .then((result) => {
              if (result.restored) uni.$emit('conversationLearningUpdated');
            })
            .catch(() => {
              logger.warn('[do-quiz] 原作答仍保留，本地学习记录待恢复');
              if (!this.quizPageClosed && this.sessionId === sessionId && (getUserId() || '') === owner) {
                toast.info('作答已保留，学习记录待恢复');
              }
            });
        }

        logger.log('[do-quiz] ✅ 进度已恢复:', {
          currentIndex: this.currentIndex,
          seconds: this.seconds,
          answeredCount: this.answeredQuestions.length
        });

        toast.success('进度已恢复');
      }
      this.startTimer();
      if (!this.hasAnswered) this.startQuestionTimer(progress?.questionTiming?.elapsedMs || 0);
    },

    // ✅ P0-3: 保存当前进度
    saveCurrentProgress(immediate = false) {
      if (!quizRecordOwnerMatches(this) || this.showResumeModal || this.resumeUnavailable) return;
      // 只有在有题目且已开始答题时才保存
      if (
        this.questions.length === 0 ||
        (this.currentIndex === 0 && !this.hasAnswered && this.answeredQuestions.length === 0)
      ) {
        return;
      }

      // 如果已完成所有题目，清除进度
      if (this.hasAnswered && isQuizProgressComplete(this)) {
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
          questions: this.questions,
          sessionId: this.sessionId,
          questionTiming:
            !this.hasAnswered && this.questionTimerToken
              ? {
                  index: this.currentIndex,
                  questionId: this.questions[this.currentIndex]?.id,
                  elapsedMs: getQuestionTime(this.questionTimerToken).elapsedMs
                }
              : undefined
        },
        immediate,
        this.quizProgressContext
      );

      if (success) {
        logger.log(immediate ? '[do-quiz] 进度保存已确认' : '[do-quiz] 已安排保存进度');
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
      if (this.quizOwnerId === null || this.quizOwnerId === undefined) this.quizOwnerId = getUserId() || '';
      if (!quizRecordOwnerMatches(this)) return rejectQuizResume(this);
      if (this.forceResumeProgress) {
        const progress = getRecoverableQuizProgress();
        if (!progress) {
          rejectQuizResume(this);
          return;
        }
        this.questions = progress.questions;
        this.mode = progress.context?.mode === 'normal' ? '' : progress.context?.mode || '';
        this.paperId = progress.context?.paperId || '';
        this._singleMode = this.mode === 'single';
        this.singlePracticeId = this._singleMode ? progress.context?.handoffId || '' : '';
        this._smartReviewMode = this.mode === 'smart_review';
        this.smartReviewId = this._smartReviewMode ? progress.context?.handoffId || '' : '';
        this.questionBankFingerprint =
          progress.context?.questionBankFingerprint || this.buildQuestionBankFingerprint(this.questions);
        this.resumeProgressIdentity = JSON.stringify(progress);
        this.resumeOwnerId = getUserId() || '';
        return;
      }
      if (this.mode === 'legacy_review') {
        const questions = readLegacyReviewHandoff(
          storageService.get(LEGACY_REVIEW_HANDOFF_KEY, null, { migrateLegacy: false }),
          this.legacyReviewId,
          getUserId() || ''
        );
        if (!questions) {
          this.questions = [];
          this.questionBankFingerprint = '';
          this.resumeUnavailable = true;
          this.showEmptyBankModal = true;
          toast.info('重练入口已变化，请返回历史记录重新选择');
          return;
        }
        this.questions = questions.map((question, index) => normalizePracticeQuestion(question, index));
        this.questionBankFingerprint = this.buildQuestionBankFingerprint(this.questions);
        this.resumeOwnerId = getUserId() || '';
        this.startQuestionTimer();
        return;
      }
      // 指定入口必须完整命中，失败时保留交接资料供返回重选。
      const unavailable = (message) => {
        rejectQuizResume(this);
        toast.info(message);
      };
      const accept = (questions, consumedKey) => {
        this.questions = questions;
        this.questionBankFingerprint = this.buildQuestionBankFingerprint(questions);
        if (consumedKey) storageService.remove(consumedKey);
        this.startTimer();
        this.startQuestionTimer();
      };
      if (this._singleMode) {
        let singleQ;
        try {
          singleQ = storageService.get('temp_practice_question', null, { migrateLegacy: false, throwOnError: true });
        } catch (_error) {
          return unavailable('原题暂不可读取，请返回重试');
        }
        const selected = readSinglePracticeHandoff(singleQ, this.singlePracticeId, getUserId() || '');
        if (!selected) return unavailable('原题资料不完整，请返回重新选择');
        accept(selected, 'temp_practice_question');
        return;
      }
      if (this.mode === 'temp_bank') {
        const raw = storageService.get('temp_practice_questions', [], { migrateLegacy: false });
        const selected = prepareQuizSelection(raw);
        if (!selected) return unavailable('原题资料不完整，请返回重新选择');
        accept(selected, 'temp_practice_questions');
        return;
      }

      if (this._smartReviewMode && this.smartReviewId) {
        let selected;
        try {
          selected = readQuizReviewHandoff(
            storageService.get(QUIZ_REVIEW_HANDOFF_KEY, null, { migrateLegacy: false, throwOnError: true }),
            this.smartReviewId,
            this.quizOwnerId,
            this.paperId
          );
        } catch (_error) {
          return unavailable('复习原题暂不可读取，请返回重试');
        }
        if (!selected) return unavailable('复习入口已变化，请返回重新选择');
        accept(selected);
        return;
      }
      const bank = storageService.get('v30_bank', [], { migrateLegacy: false });
      // 整卷刷新使用当前账户的完整试卷，不依赖已消费的临时编号。
      if (this.paperId) {
        const raw = Array.isArray(bank) ? bank.filter((q) => q?.paperId === this.paperId) : [];
        const selected = prepareQuizSelection(raw);
        if (!selected) return unavailable('本卷题目未完整载入，请返回题库重试');
        accept(selected);
        return;
      }
      if (this._smartReviewMode) {
        return unavailable('请返回重新选择复习题目');
      }

      // 普通组题只使用有完整原件的题目；显示默认值不进入原件快照。
      let questions = Array.isArray(bank) ? bank.map(prepareQuizQuestion).filter(Boolean) : [];
      this.questionBankFingerprint = this.buildQuestionBankFingerprint(questions);

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
        .map((question, index) => question?.id ?? question?._id ?? question?.question ?? `q_${index}`)
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
      s = Math.max(0, Math.ceil(Number(s) || 0));
      const m = Math.floor(s / 60);
      const rs = s % 60;
      return `${m < 10 ? '0' + m : m}:${rs < 10 ? '0' + rs : rs}`;
    },
    getCompletionNextReviewDelayMs() {
      const wrongCount = (this.answeredQuestions || []).filter(
        (answer) => getQuizAnswerRecordOutcome(answer) === 'wrong'
      ).length;
      if (wrongCount <= 0) return null;

      try {
        const previewMistake = { fsrs_due: Date.now() };
        const result = scheduleMistakeReview(previewMistake, 'again');
        return result.fsrs_due ? result.fsrs_due - Date.now() : null;
      } catch (_e) {
        return null;
      }
    },
    isOptionSelected(idx) {
      return Array.isArray(this.userChoice) ? this.userChoice.includes(idx) : this.userChoice === idx;
    },
    selectOption(idx) {
      if (
        !quizRecordOwnerMatches(this) ||
        this.quizPageClosed ||
        this.isAnalyzing ||
        this.isNavigating ||
        this.showResult ||
        this.hasAnswered ||
        this.showResumeModal ||
        this.resumeUnavailable
      )
        return;
      if (!hasQuizSelectableOptions(this.currentQuestion)) return;
      if (!Number.isInteger(idx) || idx < 0 || idx >= this.currentQuestion.options.length) return;
      playClickSound();
      if (isQuizMultiChoice(this.currentQuestion)) {
        const selected = Array.isArray(this.userChoice) ? this.userChoice : [];
        this.userChoice = selected.includes(idx)
          ? selected.filter((index) => index !== idx)
          : [...selected, idx].sort((a, b) => a - b);
      } else {
        this.userChoice = idx;
      }
    },
    async submitChoice() {
      // 账户存储并非响应式；不能只依赖可能已缓存的按钮状态。
      if (!quizRecordOwnerMatches(this)) return rejectQuizResume(this);
      if (!this.canSubmitChoice) return;
      const choice = Array.isArray(this.userChoice) ? [...this.userChoice] : this.userChoice;
      const submittedAnswer = getQuizSelectionAnswer(this.currentQuestion, choice);
      // ✅ 停止单题计时器并记录用时
      const timerResult = stopQuestionTimer(this.questionTimerToken);
      if (timerResult.success === false) return;
      this.hasAnswered = true;
      const timeSpent = timerResult.elapsedMs ?? timerResult.elapsed * 1000; // 转换为毫秒

      // 本地答案只提供参考匹配；可靠判分由独立依据决定。
      const referenceMatch = isCorrectQuizSelection(this.currentQuestion, choice);
      this.answeredQuestions = upsertQuizAnswerRecord(
        this.answeredQuestions,
        buildQuizAnswerRecord({
          question: this.currentQuestion,
          index: this.currentIndex,
          userChoice: choice,
          userAnswer: submittedAnswer,
          source: 'reference_match',
          referenceMatch,
          timeSpent,
          attemptId: createQuizAttemptId(),
          ownerId: getUserId() || ''
        })
      );
      this.saveCurrentProgress(true);
      this.recordAnswerToAnalytics(referenceMatch, timeSpent).catch(() => {
        logger.warn('[do-quiz] 原答同步未完成，本地原答保留');
      });
      this.updateStudyStats();
      this.resultStatus = 'pending';
      this.aiComment = '';
      this.personalHint = '';
      this.fsrsPreview = null;
      this.clearComboFeedback();
      this.showResult = true;
    },
    // ✅ [P0重构] AI深度解析 — 非阻塞：不再显示全屏遮罩，异步增强已显示的解析内容
    async fetchAIDeepAnalysis(question, userChoice) {
      if (!quizRecordOwnerMatches(this) || this.quizPageClosed) return;
      const frozen = JSON.parse(JSON.stringify(question)),
        index = this.currentIndex;
      const owner = getUserId() || '',
        token = getToken() || '';
      const generation = (this._analysisGeneration = (this._analysisGeneration || 0) + 1);
      const current = () =>
        !this.quizPageClosed &&
        quizRecordOwnerMatches(this) &&
        this._analysisGeneration === generation &&
        this.currentIndex === index &&
        JSON.stringify(this.currentQuestion) === JSON.stringify(frozen) &&
        (getUserId() || '') === owner &&
        (getToken() || '') === token;
      this._typewriter?.stopTyping();
      try {
        const result = await fetchAIAnalysis({ question: frozen, userChoice });
        if (!current()) return;
        const writer = useTypewriter({
          speed: 25,
          initialDelay: 100,
          onChar: (text) => {
            if (current()) this.aiComment = text;
            else writer.stopTyping();
          }
        });
        this._typewriter = writer;
        await writer.startTyping(result.comment);
      } catch (_error) {
        logger.warn('[do-quiz] 解析显示未完成，原件保持');
      }
    },
    // ✅ P1: 委托给 quiz-mistake-handler.js
    async saveToMistakes() {
      return await saveMistake({
        currentQuestion: this.currentQuestion,
        userChoice: this.userChoice,
        aiComment: this.aiComment
      });
    },
    // ✅ P1: 委托给 quiz-mistake-handler.js
    updateMistakeWithAI(aiAnalysis) {
      return updateMistakeAI({
        currentQuestion: this.currentQuestion,
        aiAnalysis
      });
    },
    async updateStudyStats() {
      // 仅累计明确作答次数，不将参考匹配写入掌握度或估算学习时长。
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
    },
    formatFsrsInterval(days) {
      return formatInterval(days);
    },
    rateAndNext(_rating) {
      if (!quizRecordOwnerMatches(this) || this.quizPageClosed || this.resumeUnavailable || !this.hasAnswered) return;
      this.fsrsPreview = null;
      return this.toNext();
    },
    // 看参考只记录帮助，不制造原答、判分、卡片或优化次数。
    async flipFlashcard() {
      if (
        !quizRecordOwnerMatches(this) ||
        this.quizPageClosed ||
        this.isQuestionActionLocked ||
        this.recordingObservation ||
        this.referenceSaved ||
        !isQuizFlashcardMode(this.currentQuestion)
      )
        return;
      const question = JSON.parse(JSON.stringify(this.currentQuestion)),
        index = this.currentIndex,
        sessionId = this.sessionId;
      const owner = getUserId() || '',
        token = getToken() || '';
      const current = () =>
        !this.quizPageClosed &&
        quizRecordOwnerMatches(this) &&
        this.sessionId === sessionId &&
        this.currentIndex === index &&
        JSON.stringify(this.currentQuestion) === JSON.stringify(question) &&
        (getUserId() || '') === owner &&
        (getToken() || '') === token;
      this.referenceObservationId ||= createQuizAttemptId();
      this.flashcardFlipped = true;
      this.flashcardFsrsPreview = null;
      this.recordingObservation = true;
      this.observationError = '';
      const measured = stopQuestionTimer(this.questionTimerToken);
      if (measured.success === false) return;
      const timeSpent = measured.elapsedMs ?? measured.elapsed * 1000;
      try {
        await recordQuizLearningObservation({
          currentQuestion: question,
          sessionId,
          observationId: this.referenceObservationId,
          kind: 'reference_view',
          canContinue: current
        });
        if (!current()) return;
        this.referenceSaved = true;
        this.hasAnswered = true;
        this.answeredQuestions = upsertQuizAnswerRecord(
          this.answeredQuestions,
          buildQuizAnswerRecord({
            question,
            index,
            userChoice: 'flashcard_flip',
            isCorrect: null,
            mode: 'flashcard',
            source: 'reference_view',
            observationId: this.referenceObservationId,
            timeSpent
          })
        );
        this.saveCurrentProgress(true);
        playFlipSound();
      } catch (_error) {
        if (current()) this.observationError = '查看记录未保存，请重试';
      } finally {
        if (current()) this.recordingObservation = false;
      }
    },
    async rateFlashcardAndNext(rating) {
      if (
        !quizRecordOwnerMatches(this) ||
        this.quizPageClosed ||
        this.isQuestionActionLocked ||
        this.recordingObservation ||
        !this.flashcardFlipped ||
        !this.referenceSaved ||
        !isQuizFlashcardMode(this.currentQuestion) ||
        ![1, 2, 3, 4].includes(rating)
      )
        return;
      const question = JSON.parse(JSON.stringify(this.currentQuestion)),
        index = this.currentIndex,
        sessionId = this.sessionId;
      const owner = getUserId() || '',
        token = getToken() || '';
      const current = () =>
        !this.quizPageClosed &&
        quizRecordOwnerMatches(this) &&
        this.sessionId === sessionId &&
        this.currentIndex === index &&
        JSON.stringify(this.currentQuestion) === JSON.stringify(question) &&
        (getUserId() || '') === owner &&
        (getToken() || '') === token;
      this.selfRatingObservationId ||= createQuizAttemptId();
      this.recordingObservation = true;
      this.observationError = '';
      try {
        await recordQuizLearningObservation({
          currentQuestion: question,
          sessionId,
          observationId: this.selfRatingObservationId,
          kind: 'self_rating',
          rating,
          referenceId: this.referenceObservationId,
          canContinue: current
        });
        if (!current()) return;
        const latest = this.answeredQuestions.find((item) => item.index === index && item.questionId === question.id);
        this.answeredQuestions = upsertQuizAnswerRecord(
          this.answeredQuestions,
          buildQuizAnswerRecord({
            question,
            index,
            userChoice: `flashcard_rating_${rating}`,
            isCorrect: null,
            timeSpent: latest?.timeSpent || 0,
            rating,
            mode: 'flashcard',
            source: 'self_rating',
            observationId: this.selfRatingObservationId,
            referenceId: this.referenceObservationId
          })
        );
        this.saveCurrentProgress(true);
        this.flashcardFsrsPreview = null;
        this.recordingObservation = false;
        await this.toNext();
      } catch (_error) {
        if (current()) this.observationError = '自评未保存，请重试';
      } finally {
        if (current()) this.recordingObservation = false;
      }
    },
    async toNext() {
      if (
        !quizRecordOwnerMatches(this) ||
        this.quizPageClosed ||
        this.recordingObservation ||
        this.showResumeModal ||
        this.resumeUnavailable ||
        this.questions.length === 0
      )
        return;
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
        this.referenceObservationId = '';
        this.selfRatingObservationId = '';
        this.referenceSaved = false;
        this.observationError = '';
        this.recordingObservation = false;

        // ✅ 重置答题开始时间
        this.answerStartTime = Date.now();
        this.startQuestionTimer();

        // ✅ P0-3: 进入下一题时保存进度
        this.saveCurrentProgress();

        // ✅ 延迟解锁防重复点击（300ms后允许再次点击）
        this._safeTimeout(() => {
          this.isNavigating = false;
        }, 300);
      } else {
        if (!isQuizProgressComplete(this)) {
          const nextIndex = this.questions.findIndex(
            (q, index) =>
              !this.answeredQuestions.some(
                (record) => record.index === index && String(record.questionId) === String(q.id ?? q._id)
              )
          );
          this.currentIndex = Math.max(0, nextIndex);
          this.resetQuestionState();
          this.updateFavoriteStatus();
          this.saveCurrentProgress(true);
          this.isNavigating = false;
          toast.info('还有未作答的题目');
          return;
        }
        // ✅ P0-3: 练习完成，清除进度
        clearQuizProgress();

        // ✅ 检查点 5.1: 追踪完成练习事件
        analytics.trackConversion('COMPLETE_SESSION', {
          totalQuestions: this.questions.length,
          correctCount: this.answeredQuestions.filter((a) => getQuizAnswerRecordOutcome(a) === 'correct').length,
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
      stopQuestionTimer(this.questionTimerToken);
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
      if (this.resumeProgressIdentity && (getUserId() || '') !== this.resumeOwnerId) {
        rejectQuizResume(this);
        return;
      }
      const progress = this.forceResumeProgress
        ? getRecoverableQuizProgress()
        : loadQuizProgress(this.quizProgressContext);
      if (!resumeTargetMatches(this, progress)) {
        rejectQuizResume(this);
        return;
      }
      this.showResumeModal = false;
      clearQuizProgress();
      this.resumeProgressIdentity = '';
      this.resumeOwnerId = this.mode === 'legacy_review' ? getUserId() || '' : '';
      this.startTimer();
    },

    // ✅ [闭环核心] 自动诊断 + AI推荐下一组 — 刷题结束后台自动触发
    async autoDiagnose() {
      if (!this.sessionId || summarizeQuizProgress({ answeredQuestions: this.answeredQuestions }).gradedCount < 3) {
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
          const ids = (recRes.value.data.questions || recRes.value.data || []).map((q) => q.id ?? q._id);
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
      if (!quizRecordOwnerMatches(this)) return toast.info('账户已变化，请返回重新选择');
      if (this.hasNextRecommendation && this.nextRecommendationIds.length > 0) {
        const result = storageService.prepareQuizReview({
          ids: this.nextRecommendationIds,
          expectedOwner: this.quizOwnerId
        });
        if (!result.success) return toast.info('下一组原题未确认保存，请返回重新选择');
        this.showCompleteModal = false;
        safeRedirectTo(result.url);
      } else {
        // 没有推荐，查看诊断报告
        this.viewDiagnosisReport();
      }
    },

    // ✅ 查看诊断报告
    viewDiagnosisReport() {
      this.showCompleteModal = false;
      if (summarizeQuizProgress({ answeredQuestions: this.answeredQuestions }).gradedCount === 0) {
        safeNavigateTo('/pages/study-detail/index');
        return;
      }
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
      return '';
    },

    // ✅ [闭环核心] AI智能诊断 — 刷题结束后触发
    async handleDiagnosis() {
      if (!quizRecordOwnerMatches(this) || this.quizPageClosed) return;
      if (summarizeQuizProgress({ answeredQuestions: this.answeredQuestions }).gradedCount === 0) {
        toast.info('参考作答和自评不能生成可靠诊断');
        safeNavigateTo('/pages/study-detail/index');
        return;
      }
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
      if (this.hasAnswered && this.resultStatus === 'pending') {
        this.toNext();
        return;
      }
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
      this.flashcardFlipped = false;
      this.flashcardFsrsPreview = null;
      this.referenceObservationId = '';
      this.selfRatingObservationId = '';
      this.referenceSaved = false;
      this.observationError = '';
      this.recordingObservation = false;
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
    async handleToggleFavorite(options = {}) {
      if (!quizRecordOwnerMatches(this)) return rejectQuizResume(this);
      if (!this.currentQuestion) return;
      if (this.isQuestionActionLocked && !options.allowDuringResult) {
        toast.info('请先完成当前题目的反馈');
        return;
      }

      const favoriteStore = useFavoriteStore();
      const result = await favoriteStore.toggleFavorite(
        this.currentQuestion,
        'default',
        this.quizOwnerId ?? getUserId() ?? ''
      );
      if (!quizRecordOwnerMatches(this) || this.quizPageClosed) return;
      this.isCurrentFavorited = result.isFavorited;
      if (!result.success) toast.info(result.message || '收藏未保存，请重试');

      playClickSound();

      logger.log('[do-quiz] ✅ 收藏状态切换:', result);
    },

    handleResultToggleFavorite() {
      return this.handleToggleFavorite({ allowDuringResult: true });
    },

    // ✅ 更新当前题目的收藏状态
    async updateFavoriteStatus() {
      if (this.currentQuestion) {
        const favoriteStore = useFavoriteStore();
        if (!quizRecordOwnerMatches(this)) return;
        const question = this.currentQuestion;
        const saved = await favoriteStore.checkIsFavorited(question);
        if (quizRecordOwnerMatches(this) && this.currentQuestion?.id === question.id) this.isCurrentFavorited = saved;
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
    startQuestionTimer(initialElapsedMs = 0) {
      if (
        !this.currentQuestion ||
        this.hasAnswered ||
        !quizRecordOwnerMatches(this) ||
        this.quizPageClosed ||
        this.showResumeModal
      )
        return;
      const binding = JSON.stringify([
        this.quizOwnerId,
        this.sessionId,
        this.currentIndex,
        this.questionBankFingerprint
      ]);
      const current = getQuestionTime(this.questionTimerToken);
      if (this.questionTimerBinding === binding && current.active) {
        resumeQuestionTimer(this.questionTimerToken);
        return;
      }

      const difficulty = this.currentQuestion.difficulty || 2;
      this.currentQuestionDifficulty = difficulty;

      const currentBinding = () =>
        !this.quizPageClosed && quizRecordOwnerMatches(this) && this.questionTimerBinding === binding;
      const timerResult = startQuestionTimer({
        difficulty,
        initialElapsedMs,
        notificationsEnabled: this.questionTimerEnabled,
        onTick: (data) => {
          if (!currentBinding()) return;
          this.questionTimeRemaining = data.remaining;
          this.showTimeWarning = data.progress >= 0.8;
        },
        onWarning: (data) => {
          if (!currentBinding()) return;
          if (data.level === 'warning') {
            toast.info(data.message);
          }
        },
        onTimeout: (_data) => {
          // 超时处理
          if (currentBinding() && !this.hasAnswered) {
            toast.info('时间到！');
          }
        }
      });

      this.questionTimerToken = timerResult.token;
      this.questionTimerBinding = binding;
      this.questionTimeLimit = timerResult.timeLimit;
      this.questionTimeRemaining = timerResult.remaining;

      logger.log('[do-quiz] ✅ 单题计时器已启动:', {
        timeLimit: timerResult.timeLimit,
        difficulty
      });
    },

    // ==================== 数据分析记录方法 ====================

    // ✅ P1: 委托给 quiz-analytics-recorder.js（组件状态更新保留在组件内）
    async retryAnswerSync() {
      if (!this.canRetryAnswerSync) return;
      await this.recordAnswerToAnalytics();
    },
    async recordAnswerToAnalytics() {
      if (!quizRecordOwnerMatches(this)) return;
      const question = this.currentQuestion;
      const index = this.currentIndex;
      const sessionId = this.sessionId;
      const owner = getUserId() || '';
      const token = getToken() || '';
      const record = this.answeredQuestions.find((item) => item.index === index && item.questionId === question?.id);
      if (
        !record?.attemptId ||
        record.ownerId !== owner ||
        typeof record.userAnswer !== 'string' ||
        this.syncingAttemptIds.includes(record.attemptId) ||
        this.quizPageClosed
      )
        return;
      const attemptId = record.attemptId;
      const choice = Array.isArray(record.userChoice) ? [...record.userChoice] : record.userChoice;
      const stillCurrent = () =>
        !this.quizPageClosed &&
        this.sessionId === sessionId &&
        (getUserId() || '') === owner &&
        (getToken() || '') === token;
      this.syncingAttemptIds.push(attemptId);
      try {
        const questionData = await recordAnalytics({
          currentQuestion: question,
          isCorrect: record.referenceMatch,
          timeSpent: record.timeSpent,
          userChoice: choice,
          questionTimeLimit: this.questionTimeLimit,
          getOptionLabel: () => record.userAnswer,
          sessionId,
          attemptId,
          canContinue: stillCurrent
        });
        if (!stillCurrent() || this.currentIndex !== index || this.currentQuestion?.id !== question.id) return;
        const recordIndex = this.answeredQuestions.findIndex(
          (item) => item.index === index && item.questionId === question.id && item.attemptId === attemptId
        );
        if (recordIndex >= 0 && questionData?.submission) {
          this.answeredQuestions.splice(recordIndex, 1, {
            ...this.answeredQuestions[recordIndex],
            submission: questionData.submission
          });
          this.saveCurrentProgress(true);
        }
      } catch {
        logger.warn('[do-quiz] 原答同步未完成，可重试');
      } finally {
        this.syncingAttemptIds = this.syncingAttemptIds.filter((id) => id !== attemptId);
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
    handleOpenNote(options = {}) {
      if (!this.currentQuestion) return;
      if (this.isQuestionActionLocked && !options.allowDuringResult) {
        toast.info('请先完成当前题目的反馈');
        return;
      }

      // 加载当前题目的笔记
      this.currentQuestionNotes = getNotesByQuestion(this.currentQuestion.id || this.currentQuestion.question);

      // 重置输入状态
      this.noteContent = '';
      this.selectedNoteTags = [];
      this.showNoteModal = true;
    },

    handleResultOpenNote() {
      this.handleOpenNote({ allowDuringResult: true });
    },

    handleOpenAnswerSheet() {
      this.showAnswerSheet = true;
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
      if (this.isAnswerSheetJumpLocked) {
        toast.info('请先完成当前题目的反馈');
        return;
      }
      if (index < 0 || index >= this.questions.length || index === this.currentIndex) {
        this.showAnswerSheet = false;
        return;
      }
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

  background: var(--yozi-background);
  position: relative;
  overflow: hidden;
  color: #1d1d1f;
}

.container.dark-mode {
  background: var(--yozi-background);
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
  background: linear-gradient(135deg, rgba(159, 232, 112, 0.94) 0%, rgba(117, 221, 255, 0.94) 100%);
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
    linear-gradient(135deg, rgba(14, 165, 233, 0.86) 0%, rgba(34, 211, 238, 0.82) 100%), rgba(20, 24, 32, 0.94);
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
  background: var(--yozi-reading);

  border: 0;

  border-radius: 24px;
  padding: 36rpx;
  margin-bottom: 24rpx;

  box-shadow: var(--yozi-shadow);
}

.dark-mode .glass-card {
  background: var(--yozi-reading);
  border-color: rgba(255, 255, 255, 0.08);

  box-shadow: var(--yozi-shadow);

  border: 0;

  border-radius: 24px;
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

.q-translation-target {
  margin-top: 20rpx;
  padding: 24rpx;
  border-radius: 16rpx;
  background: var(--yozi-solid);
  color: var(--foreground);
  font-size: 32rpx;
  line-height: 1.7;
  text-decoration: underline;
  text-underline-offset: 4px;
}

.q-passage-card {
  margin-bottom: 28rpx;
  padding: 24rpx;
  border: 1rpx solid rgba(0, 0, 0, 0.06);
  border-radius: 22rpx;

  background: var(--muted);
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

  background: var(--muted);
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
  min-height: max(44px, 96rpx);
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
.option-item:focus-visible {
  outline: 2px solid var(--yozi-focus, #7367f0);
  outline-offset: 2px;
}
.choice-submit {
  display: block;
  width: 100%;
  min-height: 44px;
  margin-top: 16px;
  background: var(--yozi-button);
  color: var(--yozi-button-ink);
  box-shadow: var(--yozi-button-shadow);
}
.choice-submit:focus-visible {
  outline: 2px solid var(--yozi-focus, #7367f0);
  outline-offset: 2px;
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

  background: var(--yozi-floating);
  border: 1rpx solid rgba(15, 23, 42, 0.08);
  border-radius: 32rpx;

  box-shadow: var(--yozi-shadow);
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

  @include em-mobile-primary-action;
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
  background: var(--yozi-button);

  box-shadow: var(--yozi-button-shadow);
}

.result-pop.correct .result-action-icon,
.result-pop.correct .result-primary-label {
  color: var(--yozi-button-ink);
}

.result-pop.wrong .result-primary-action {
  background: var(--yozi-button);

  box-shadow: var(--yozi-button-shadow);
}

.dark-mode .result-pop.wrong .result-primary-action,
.dark-mode .result-pop.correct .result-primary-action {
  box-shadow: 0 14rpx 34rpx rgba(0, 0, 0, 0.22);
}

.result-primary-action-hover,
.result-primary-action:active {
  transform: translateY(2px);
  opacity: 0.9;

  box-shadow:
    inset 0 2px 4px rgba(30, 15, 65, 0.16),
    0 2px 0 var(--yozi-button-edge);

  transition-duration: 100ms;
}

.result-primary-action.disabled {
  opacity: 0.72;
}

.result-action-row {
  position: relative;
  z-index: 2;
  margin-top: 20rpx;
  padding-top: 24rpx;
  border-top: 1rpx solid rgba(15, 23, 42, 0.08);
}

.dark-mode .result-action-row {
  border-top-color: rgba(255, 255, 255, 0.08);
}

.result-next-btn {
  min-height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  @include em-flex-gap(12rpx, row);

  transition:
    transform 180ms ease,
    box-shadow 180ms ease;
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

  color: var(--yozi-button-ink);
}

.answer-sync {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
  padding: 16rpx 8rpx;
  font-size: 24rpx;
  color: var(--text-secondary);
  :deep(button) {
    min-height: 44px;
  }
}

.result-assist-row {
  position: relative;
  z-index: 2;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12rpx;
  margin-top: 22rpx;
}

.result-assist-btn {
  min-width: 0;
  min-height: 76rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
  padding: 0 14rpx;
  border: 1rpx solid rgba(15, 23, 42, 0.08);
  border-radius: 20rpx;
  background: rgba(255, 255, 255, 0.68);
  color: #3f4652;
  transition:
    transform 0.18s ease,
    opacity 0.18s ease,
    background 0.18s ease;
}

.result-assist-btn.active {
  border-color: rgba(31, 122, 77, 0.22);
  background: rgba(159, 232, 112, 0.14);
  color: #1f7a4d;
}

.result-assist-hover,
.result-assist-btn:active {
  transform: scale(0.97);
  opacity: 0.86;
}

.result-assist-icon {
  width: 32rpx;
  height: 32rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.result-assist-label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 23rpx;
  font-weight: 750;
}

.result-assist-badge {
  min-width: 28rpx;
  height: 28rpx;
  padding: 0 7rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 999rpx;
  background: rgba(31, 122, 77, 0.12);
  color: #1f7a4d;
  font-size: 18rpx;
  font-weight: 850;
}

.dark-mode .result-assist-btn {
  border-color: rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.06);
  color: rgba(245, 247, 251, 0.76);
}

.dark-mode .result-assist-btn.active {
  border-color: rgba(117, 221, 255, 0.24);
  background: rgba(0, 224, 255, 0.1);
  color: #75ddff;
}

.dark-mode .result-assist-badge {
  background: rgba(117, 221, 255, 0.12);
  color: #75ddff;
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

.favorite-btn.is-action-locked,
.note-btn.is-action-locked {
  opacity: 0.52;
  transform: none;
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
  display: flex;
  align-items: center;
  gap: 8rpx;
  padding: 10rpx 20rpx;
  border: 2rpx solid var(--border);
  border-radius: 20rpx;
  font-size: 24rpx;
  color: var(--text-sub);
  background: var(--bg-secondary);
  transition: all 0.2s ease;
}

.note-tag-dot {
  width: 12rpx;
  height: 12rpx;
  border-radius: 999rpx;
  flex-shrink: 0;
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

  @include em-mobile-primary-action;
}

.flashcard-reveal-btn:active {
  transform: translateY(2px);

  box-shadow:
    inset 0 2px 4px rgba(30, 15, 65, 0.16),
    0 2px 0 var(--yozi-button-edge);

  transition-duration: 100ms;
}

.flashcard-reveal-text {
  font-size: 32rpx;
  font-weight: 700;

  color: var(--yozi-button-ink);
  margin-left: 12rpx;
}

.flashcard-reveal-btn .base-icon {
  color: var(--yozi-button-ink);
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
  background: var(--yozi-button);

  box-shadow: var(--yozi-button-shadow);
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
