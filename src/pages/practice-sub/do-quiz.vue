<template>
  <LearningShell
    class="yozi-page container"
    active="practice"
    :title="$t('pages.quiz')"
    :class="{ 'dark-mode': isDark, 'theme-light': !isDark, 'wot-theme-dark': isDark }"
  >
    <view class="aurora-bg" />

    <view v-if="questions.length" class="nav-header" :style="{ paddingTop: statusBarHeight + 'px' }">
      <view class="nav-content" :style="{ paddingRight: capsuleMargin + 'px' }">
        <view class="back-area"
          ><BaseButton
            variant="quiet"
            icon="arrow-left"
            icon-only
            :label="t('quiz.copy46')"
            @tap="handleExit"
          /><BaseButton id="e2e-quiz-progress" variant="quiet" :label="t('quiz.copy39')" @tap="handleOpenAnswerSheet">{{
            t('quiz.copy39')
          }}</BaseButton></view
        >
        <QuizProgress :total="questions.length" :current="currentIndex" :answered="answeredQuestions" />
        <!-- 单题计时器显示 -->
        <view class="timer-group">
          <view
            v-if="questionTimerEnabled && !hasAnswered"
            class="question-timer-box"
            :class="{ warning: showTimeWarning, danger: questionTimeRemaining <= 10 }"
          >
            <view class="timer-icon">
              <BaseIcon name="timer" />
            </view>
            <text class="question-time">
              {{ formatTime(questionTimeRemaining) }}
            </text>
          </view>
          <view class="timer-box">
            <text class="total-label">{{ t('quiz.copy0') }}</text>
            <text>{{ formatTime(seconds) }}</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 学习节奏管理：连续学习休息提醒 -->
    <view v-if="showBreakReminder" class="break-reminder-bar">
      <text class="break-reminder-text">{{ t('quiz.copy1', { v0: Math.floor(seconds / 60) }) }}</text>
      <view class="break-reminder-actions">
        <BaseButton class="break-dismiss" variant="secondary" @tap="showBreakReminder = false">{{
          t('quiz.copy2')
        }}</BaseButton>
      </view>
    </view>

    <view v-if="comboFeedback" class="combo-feedback" :class="`level-${comboFeedback.level}`">
      <text class="combo-title">{{ uiText(comboFeedback.title) }}</text>
      <text class="combo-desc">{{ comboFeedback.desc }}</text>
    </view>

    <scroll-view
      id="e2e-quiz-scroll"
      :scroll-y="!showResult"
      class="quiz-scroll"
      @touchstart="onTouchStart"
      @touchmove="onTouchMove"
      @touchend="onTouchEnd"
    >
      <BaseEmpty v-if="showQuizLoading" state="loading" :title="t('quiz.copy3')" />

      <!-- Phase 3-4: 卡片堆叠 — 下一题预览（第二层） -->
      <view
        v-if="questions[currentIndex + 1] && cardStack"
        class="question-container stack-card"
        :style="cardStack.nextCardStyle.value"
      >
        <view class="glass-card question-card">
          <view class="q-header">
            <view class="q-tag">{{ questions[currentIndex + 1].type || t('quiz.copy4') }}</view>
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
              {{ uiText(questionTypeLabel) }}
            </view>
            <view class="q-actions">
              <!-- 笔记按钮 -->
              <BaseButton
                class="note-btn"
                :disabled="isQuestionActionLocked"
                :label="t('quiz.copy36')"
                variant="secondary"
                @tap.stop="handleOpenNote()"
                ><view class="note-icon"> <BaseIcon name="note" /> </view
                ><text v-if="currentQuestionNotes.length > 0" class="note-count">
                  {{ currentQuestionNotes.length }}
                </text></BaseButton
              >
              <!-- 收藏按钮 -->
              <BaseButton
                class="favorite-btn"
                :disabled="isQuestionActionLocked"
                :label="t('quiz.copy38')"
                variant="secondary"
                @tap.stop="handleToggleFavorite()"
                ><view class="favorite-icon"> <BaseIcon :name="isCurrentFavorited ? 'star' : 'star-outline'" /> </view
              ></BaseButton>
            </view>
          </view>
          <view v-if="currentQuestionPassage" class="q-passage-card">
            <view class="q-passage-head">
              <view class="q-passage-title-block">
                <text class="q-passage-kicker">{{ currentQuestion.section || t('quiz.copy6') }}</text>
                <text class="q-passage-tip">{{ t('quiz.copy7', { v0: currentQuestionNumberText }) }}</text>
              </view>
              <text v-if="currentQuestion.paperName || currentQuestion.year" class="q-passage-meta">
                {{ currentQuestion.paperName || t('quiz.copy8', { v0: currentQuestion.year }) }}
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
              <text>{{ uiText(currentPassageAnnotationText) }}</text>
              <BaseButton class="q-passage-clear" variant="secondary" @tap="clearCurrentPassageAnnotations">{{
                t('quiz.copy9')
              }}</BaseButton>
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
                :alt="image.alt || image.caption || t('quiz.copy10')"
                mode="widthFix"
                lazy-load
                show-menu-by-longpress
              />
              <text v-if="image.caption" class="q-image-caption">{{ image.caption }}</text>
            </view>
          </view>
        </view>

        <view v-if="hasSelectableOptions" class="options-list"
          ><BaseOptions
            :label="t('quiz.copy11')"
            :options="quizOptions"
            :model-value="userChoice === null ? '' : userChoice"
            :multiple="quizMultiple"
            :disabled="isAnalyzing || isNavigating || hasAnswered || showResult"
            @update:model-value="selectQuizDraft"
            ><template #option="{ option }"><RichText :content="option.label" /></template></BaseOptions
          ><BaseButton
            id="e2e-quiz-submit-choice"
            class="choice-submit"
            :disabled="!hasAnswered && !canSubmitChoice"
            @tap="hasAnswered ? (showResult = true) : submitChoice()"
            >{{ hasAnswered ? t('quiz.feedback') : t('quiz.copy12') }}</BaseButton
          ></view
        >

        <view v-if="currentAnswerRecord && !showResult" class="answer-sync" role="status" aria-live="polite">
          <text>{{ uiText(answerSyncText) }}</text>
          <BaseButton v-if="canRetryAnswerSync" variant="secondary" @tap="retryAnswerSync">{{
            t('quiz.copy13')
          }}</BaseButton>
        </view>

        <!-- 经典闪卡：查看参考与独立自评记录。 -->
        <view v-if="isFlashcardMode" class="flashcard-area">
          <!-- 翻转前：显示"翻转查看答案"按钮 -->
          <view v-if="!flashcardFlipped" class="flashcard-reveal">
            <view class="flashcard-hint">{{ t('quiz.copy14') }}</view>
            <BaseButton class="flashcard-reveal-btn" variant="secondary" @tap="flipFlashcard"
              ><BaseIcon name="eye" /><text class="flashcard-reveal-text">{{ t('quiz.copy15') }}</text></BaseButton
            >
          </view>

          <!-- 翻转后：显示答案 + FSRS 四级评分 -->
          <view v-else class="flashcard-answer-area">
            <view class="flashcard-answer-card glass-card">
              <view class="flashcard-answer-label yozi-icon-row">
                <BaseIcon name="check" />
                <text>{{ t('quiz.copy16') }}</text>
              </view>
              <scroll-view scroll-y class="flashcard-answer-scroll">
                <RichText class="flashcard-answer-content" :content="currentQuestion.answer || t('quiz.copy17')" />
                <view v-if="currentAnswerImages.length" class="q-image-list answer-images">
                  <view
                    v-for="(image, imageIndex) in currentAnswerImages"
                    :key="`${currentQuestion.id || currentIndex}-answer-image-${imageIndex}`"
                    class="q-image-card"
                  >
                    <image
                      class="q-source-image"
                      :src="image.src"
                      :alt="image.alt || image.caption || t('quiz.copy18')"
                      mode="widthFix"
                      lazy-load
                      show-menu-by-longpress
                    />
                    <text v-if="image.caption" class="q-image-caption">{{ image.caption }}</text>
                  </view>
                </view>
              </scroll-view>
              <view
                v-if="currentQuestion.desc && currentQuestion.desc !== t('quiz.copy19')"
                class="flashcard-explanation"
              >
                <text class="flashcard-explanation-label">{{ t('quiz.copy20') }}</text>
                <RichText class="flashcard-explanation-content" :content="currentQuestion.desc" />
              </view>
            </view>

            <view
              v-if="recordingObservation || observationError"
              role="status"
              aria-live="polite"
              class="flashcard-rate-hint"
            >
              <text>{{ recordingObservation ? t('quiz.copy21') : observationError }}</text>
              <BaseButton
                v-if="!referenceSaved && !recordingObservation"
                class="flashcard-reveal-btn"
                variant="secondary"
                @tap="flipFlashcard"
                >{{ t('quiz.copy22') }}</BaseButton
              >
            </view>
            <!-- 记忆自评不直接安排可靠复习。 -->
            <view class="flashcard-rate-hint">{{ t('quiz.copy23') }}</view>
            <view class="fsrs-rating-row flashcard-rating">
              <BaseButton class="fsrs-rating-btn fsrs-again" variant="secondary" @tap="rateFlashcardAndNext(1)"
                ><text class="fsrs-rating-label">{{ t('quiz.copy24') }}</text
                ><text class="fsrs-rating-interval">{{ getFlashcardInterval('again') }}</text></BaseButton
              >
              <BaseButton class="fsrs-rating-btn fsrs-hard" variant="secondary" @tap="rateFlashcardAndNext(2)"
                ><text class="fsrs-rating-label">{{ t('quiz.copy25') }}</text
                ><text class="fsrs-rating-interval">{{ getFlashcardInterval('hard') }}</text></BaseButton
              >
              <BaseButton class="fsrs-rating-btn fsrs-good" variant="secondary" @tap="rateFlashcardAndNext(3)"
                ><text class="fsrs-rating-label">{{ t('quiz.copy26') }}</text
                ><text class="fsrs-rating-interval">{{ getFlashcardInterval('good') }}</text></BaseButton
              >
              <BaseButton class="fsrs-rating-btn fsrs-easy" variant="secondary" @tap="rateFlashcardAndNext(4)"
                ><text class="fsrs-rating-label">{{ t('quiz.copy27') }}</text
                ><text class="fsrs-rating-interval">{{ getFlashcardInterval('easy') }}</text></BaseButton
              >
            </view>
          </view>
        </view>
      </view>

      <view class="footer-placeholder" />
    </scroll-view>

    <!-- ✅ [P0重构] AI分析已改为非阻塞，移除全屏遮罩 -->
    <!-- AI解析在结果弹窗内异步加载，用户可随时点击下一题 -->

    <!-- 结果弹窗背景遮罩 -->

    <!-- 结果弹窗 -->
    <CustomModal
      :visible="showResult"
      position="bottom"
      :show-actions="false"
      :is-dark="isDark"
      close-button
      escape-closable
      :title="
        t(resultStatus === 'pending' ? 'quiz.copy28' : resultStatus === 'correct' ? 'quiz.copy29' : 'quiz.copy30')
      "
      @cancel="showResult = false"
      ><template #title>
        <view class="result-header yozi-icon-row">
          <view class="result-status-mark">
            <BaseIcon :name="resultStatus === 'pending' ? 'info' : resultStatus === 'correct' ? 'check' : 'cross'" />
          </view>
          <text class="status-title">
            {{
              uiText(
                resultStatus === 'pending'
                  ? t('quiz.copy28')
                  : resultStatus === 'correct'
                    ? t('quiz.copy29')
                    : t('quiz.copy30')
              )
            }}
          </text>
        </view>
      </template>
      <view :class="['result-pop', resultStatus]">
        <scroll-view scroll-y class="result-content-scroll">
          <view v-if="currentAnswerRecord" class="answer-sync" role="status" aria-live="polite">
            <text>{{ uiText(answerSyncText) }}</text>
            <BaseButton v-if="canRetryAnswerSync" variant="secondary" @tap="retryAnswerSync">{{
              t('quiz.copy13')
            }}</BaseButton>
          </view>

          <view v-if="resultStatus === 'wrong' || resultStatus === 'pending'" class="ai-analysis-scroll">
            <view class="analysis-tag yozi-icon-row">
              <view class="sparkle-icon">
                <BaseIcon name="sparkle" />
              </view>
              <text>{{ t('quiz.copy20') }}</text>
              <!-- ✅ [P0重构] 内联AI加载指示器 -->
              <text v-if="resultStatus === 'wrong' && !aiComment" class="ai-loading-hint">{{ t('quiz.copy31') }}</text>
            </view>
            <!-- AI 个人历史微反馈 — 基于错题历史的一句话上下文提醒 -->
            <view v-if="personalHint" class="personal-hint-bar">
              <text class="personal-hint-text">{{ personalHint }}</text>
            </view>
            <view class="answer-display">
              <text class="answer-label">{{
                uiText(resultStatus === 'pending' ? t('quiz.copy32') : t('quiz.copy33'))
              }}</text>
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
                  :alt="image.alt || image.caption || t('quiz.copy18')"
                  mode="widthFix"
                  lazy-load
                  show-menu-by-longpress
                />
                <text v-if="image.caption" class="q-image-caption">{{ image.caption }}</text>
              </view>
            </view>
            <view v-if="knowledgeCard" class="knowledge-card">
              <view class="knowledge-card-head">
                <text class="knowledge-label">{{ t('quiz.copy34') }}</text>
                <text class="knowledge-title">{{ knowledgeCard.title }}</text>
              </view>
              <view v-if="knowledgeCard.tags.length" class="knowledge-tags">
                <text v-for="tag in knowledgeCard.tags" :key="tag" class="knowledge-tag">{{ tag }}</text>
              </view>
              <RichText v-if="knowledgeCard.detail" class="knowledge-detail" :content="knowledgeCard.detail" />
            </view>
            <RichText
              class="analysis-body"
              :content="aiComment || (currentQuestion ? currentQuestion.desc : t('quiz.copy19'))"
            />
          </view>

          <view v-else class="ai-analysis-brief">
            <view v-if="knowledgeCard" class="knowledge-card compact">
              <view class="knowledge-card-head">
                <text class="knowledge-label">{{ t('quiz.copy34') }}</text>
                <text class="knowledge-title">{{ knowledgeCard.title }}</text>
              </view>
              <view v-if="knowledgeCard.tags.length" class="knowledge-tags">
                <text v-for="tag in knowledgeCard.tags" :key="tag" class="knowledge-tag">{{ tag }}</text>
              </view>
              <RichText v-if="knowledgeCard.detail" class="knowledge-detail" :content="knowledgeCard.detail" />
            </view>
            <view v-else>
              <text class="label">{{ t('quiz.copy35') }}</text>
              <RichText :content="aiComment || (currentQuestion ? currentQuestion.desc : t('quiz.copy19'))" />
              <view v-if="currentAnswerImages.length" class="q-image-list result-answer-images">
                <view
                  v-for="(image, imageIndex) in currentAnswerImages"
                  :key="`${currentQuestion.id || currentIndex}-brief-answer-image-${imageIndex}`"
                  class="q-image-card"
                >
                  <image
                    class="q-source-image"
                    :src="image.src"
                    :alt="image.alt || image.caption || t('quiz.copy18')"
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
          <BaseButton class="result-assist-btn" variant="secondary" @tap.stop="handleResultOpenNote"
            ><view class="result-assist-icon"> <BaseIcon name="note" /> </view
            ><text class="result-assist-label">{{ t('quiz.copy36') }}</text
            ><text v-if="currentQuestionNotes.length > 0" class="result-assist-badge">
              {{ currentQuestionNotes.length }}
            </text></BaseButton
          >
          <BaseButton class="result-assist-btn" variant="secondary" @tap.stop="handleResultToggleFavorite"
            ><view class="result-assist-icon"> <BaseIcon :name="isCurrentFavorited ? 'star' : 'star-outline'" /> </view
            ><text class="result-assist-label">{{
              isCurrentFavorited ? t('quiz.copy37') : t('quiz.copy38')
            }}</text></BaseButton
          >
          <BaseButton class="progress-text" variant="secondary" @tap.stop="handleOpenAnswerSheet"
            ><view class="result-assist-icon"> <BaseIcon name="book-open" /> </view
            ><text class="result-assist-label">{{ t('quiz.copy39') }}</text></BaseButton
          >
        </view>

        <view class="result-action-row">
          <BaseButton
            id="e2e-quiz-next-btn"
            class="result-next-btn result-primary-action"
            :disabled="isNavigating"
            variant="primary"
            @tap.stop="closeResult"
            ><view class="result-action-icon">
              <BaseIcon :name="resultStatus === 'correct' ? 'check' : 'arrow-right'" /> </view
            ><text class="result-primary-label">
              {{
                uiText(
                  isNavigating ? t('quiz.copy40') : resultStatus === 'correct' ? t('quiz.copy41') : t('quiz.copy2')
                )
              }}
            </text></BaseButton
          >
        </view>
      </view></CustomModal
    >

    <!-- ✅ 自定义弹窗：题库为空 -->
    <CustomModal
      :visible="showEmptyBankModal"
      type="upload"
      :title="resumeUnavailable ? t('quiz.copy42') : t('quiz.copy43')"
      :content="resumeUnavailable ? t('quiz.copy44') : ''"
      :confirm-text="resumeUnavailable ? t('quiz.copy46') : t('pages.practice')"
      :show-cancel="false"
      :is-dark="isDark"
      @confirm="handleEmptyBankConfirm"
      ><template #title
        ><BaseEmpty :title="resumeUnavailable ? t('quiz.copy42') : t('quiz.copy43')" mascot-size="state" /></template
    ></CustomModal>

    <!-- ✅ 自定义弹窗：恢复进度 -->
    <CustomModal
      :visible="showResumeModal"
      type="info"
      :title="t('quiz.copy48')"
      :content="resumeModalContent"
      :confirm-text="t('quiz.copy49')"
      :cancel-text="t('quiz.copy50')"
      :show-cancel="true"
      :is-dark="isDark"
      @confirm="handleResumeConfirm"
      @cancel="handleResumeCancel"
    />

    <!-- ✅ 自定义弹窗：确认退出 -->
    <CustomModal
      :visible="showExitModal"
      type="warning"
      :title="t('quiz.copy51')"
      :content="answeredQuestions.length > 0 ? t('quiz.copy52', { v0: answeredQuestions.length }) : t('quiz.copy53')"
      :confirm-text="t('quiz.copy54')"
      :cancel-text="t('quiz.copy49')"
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
    <CustomModal
      :visible="showNoteModal"
      :title="t('quiz.copy55')"
      :is-dark="isDark"
      :show-actions="false"
      close-button
      mask-closable
      @cancel="showNoteModal = false"
      ><view class="yozi-page-content"
        ><BaseInput
          v-model="noteContent"
          :label="t('quiz.copy56')"
          multiline
          :placeholder="t('quiz.copy57')"
          :maxlength="500"
        /><view class="note-tags"
          ><BaseChip
            v-for="tag in availableNoteTags"
            :key="tag.id"
            :model-value="selectedNoteTags.includes(tag.id)"
            @update:model-value="toggleNoteTag(tag.id)"
            >{{ uiText(tag.name) }}</BaseChip
          ></view
        ><view class="button-row"
          ><BaseButton class="note-modal-overlay" variant="secondary" @tap="showNoteModal = false">{{
            t('quiz.copy58')
          }}</BaseButton
          ><BaseButton class="note-save-btn" @tap="handleSaveNote">{{ t('quiz.copy59') }}</BaseButton></view
        ></view
      ></CustomModal
    >

    <AnswerSheet
      :visible="showAnswerSheet"
      :is-dark="isDark"
      :questions="questions"
      :current-index="currentIndex"
      :answered-questions="answeredQuestions"
      :jump-locked="isAnswerSheetJumpLocked"
      @jump="handleJumpToQuestion"
      @close="showAnswerSheet = false"
    />

    <!-- 离线状态指示器 -->
    <OfflineIndicator :auto-show="true" position="top" :auto-hide-delay="0" />
  </LearningShell>
  <CustomModal
    v-if="pageDialog"
    :visible="true"
    :title="pageDialog.title"
    :content="pageDialog.content"
    :editable="pageDialog.editable"
    :placeholder-text="pageDialog.placeholderText"
    :confirm-text="pageDialog.confirmText"
    :cancel-text="pageDialog.cancelText"
    :show-cancel="pageDialog.showCancel !== false"
    :type="pageDialog.confirmColor ? 'error' : 'info'"
    escape-closable
    @confirm="settleDialog(true, $event)"
    @cancel="settleDialog(false)"
  />
</template>

<script>
import LearningShell from '@/components/business/learning/learning-shell.vue';
import '@/pages/practice-sub/messages.js';
import { publicError, t, translateRegisteredText } from '@/i18n/index.js';
import { useThemeStore } from '@/stores/modules/theme.js';
import BaseEmpty from '@/components/base/base-empty/base-empty.vue';
import BaseInput from '@/components/base/base-input/base-input.vue';
import BaseOptions from '@/components/base/base-options/base-options.vue';
import BaseChip from '@/components/base/base-chip/base-chip.vue';
import BaseButton from '@/components/base/base-button/base-button.vue';
import '@/styles/yozi-pages.scss';

import { BRAND } from '@/config/brand.js';
import { usePageDialog } from '@/composables/usePageDialog.js';
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
import { getUserId, getToken, captureSession, checkSession } from '@/services/auth-storage.js';
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
  if (checkSession(page.boundLoginSession) !== 'current') return false;
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
    LearningShell,
    BaseButton,
    BaseChip,
    BaseOptions,
    BaseInput,
    BaseEmpty,
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
    const { pageDialog, settleDialog, modal: pageModal } = usePageDialog();
    const engine = useQuizEngine({ smartPicker: true, adaptiveMode: true });
    const reviewStore = useReviewStore();
    return {
      pageDialog,
      settleDialog,
      pageModal,
      quizEngine: engine,
      engineGetOptionLabel: engine.getOptionLabel,
      engineIsCorrectOption: engine.isCorrectOption,
      // ✅ reviewStore 统一处理页面复习请求
      reviewStore
    };
  },
  data() {
    return {
      boundLoginSession: captureSession(),
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
      mode: '', // 刷题模式：'' | 'single' | 'temp_bank' | 'smart_review' | 'timed_sprint'
      legacyReviewId: '',
      singlePracticeId: '',
      smartReviewId: '',
      eloState: { userRating: 1500, questionRatings: {} },
      pendingTimers: [] // [AUDIT FIX R264] setTimeout 追踪，防止内存泄漏
    };
  },
  computed: {
    isDark() {
      return useThemeStore().isDark;
    },
    quizMultiple() {
      return isQuizMultiChoice(this.currentQuestion);
    },
    quizOptions() {
      return (this.currentQuestion?.options || []).map((label, value) => ({
        value,
        label,
        key: this.getOptionLabel(value),
        state:
          this.hasAnswered && this.isOptionSelected(value)
            ? this.resultStatus === 'pending'
              ? 'pending'
              : this.isCorrectOption(value)
                ? 'correct'
                : 'wrong'
            : this.hasAnswered && this.resultStatus !== 'pending' && this.isCorrectOption(value)
              ? 'correct'
              : 'default'
      }));
    },
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
      if (this.syncingAttemptIds.includes(record.attemptId)) return t('quiz.copy60');
      if (record.submission?.status === 'received') return t('quiz.copy61');
      if (record.submission?.status === 'local_only' && record.submission.localSaved) return t('quiz.copy62');
      if (record.submission?.localSaved) return t('quiz.copy63');
      return t('quiz.copy64');
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
    quizProgressLabel() {
      const total = this.questions.length;
      if (total <= 0) return '0 / 0';
      const index = Number(this.currentIndex);
      return `${Math.max(1, Math.min((Number.isFinite(index) ? Math.floor(index) : 0) + 1, total))} / ${total}`;
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
        defaultQuestion: t('quiz.copy65'),
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
      return t('quiz.copy66', { v0: selected.length, v1: this.currentQuestionNumberText });
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
      const title = uniqueTags[0] || this.questionTypeLabel || t('quiz.currentQuestion');
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
        detail: detail && detail !== t('quiz.copy19') ? detail : ''
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
      title: t('quiz.copy67', { v0: BRAND.name }),
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

    // E005: 注册主题监听一次（在 onLoad 而非 onShow，避免重复绑定）
    this._themeHandler = () => undefined;
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
    if (!this.forceResumeProgress && this.mode === 'timed_sprint') {
      this.isAdaptiveMode = false;
      this.smartPickerEnabled = false;
      this.questionTimerEnabled = true;
    }
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
    t,
    uiText(value) {
      return translateRegisteredText('quiz', value);
    },
    selectQuizDraft(next) {
      if (this.quizMultiple) {
        const previous = Array.isArray(this.userChoice) ? this.userChoice : [];
        const changed = [...new Set([...previous, ...next])].find(
          (value) => previous.includes(value) !== next.includes(value)
        );
        if (changed !== undefined) this.selectOption(changed);
      } else this.selectOption(next);
    },
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
        this.resumeModalContent = t('quiz.resume', {
          number: progress.currentIndex + 1,
          time: String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0')
        });
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
          this.observationError = this.referenceSaved ? '' : t('quiz.viewUnconfirmed');
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
            canContinue: () =>
              checkSession(this.boundLoginSession) === 'current' &&
              !this.quizPageClosed &&
              this.sessionId === sessionId &&
              (getUserId() || '') === owner
          })
            .then((result) => {
              if (result.restored) uni.$emit('conversationLearningUpdated');
            })
            .catch(() => {
              logger.warn('[do-quiz] 原作答仍保留，本地学习记录待恢复');
              if (!this.quizPageClosed && this.sessionId === sessionId && (getUserId() || '') === owner) {
                toast.info(t('quiz.copy68'));
              }
            });
        }

        logger.log('[do-quiz] ✅ 进度已恢复:', {
          currentIndex: this.currentIndex,
          seconds: this.seconds,
          answeredCount: this.answeredQuestions.length
        });

        toast.success(t('quiz.copy69'));
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
        clearQuizProgress(this.boundLoginSession);
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
        this.quizProgressContext,
        this.boundLoginSession
      );

      if (success) {
        logger.log('[App] 诊断事件');
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
        if (this.mode === 'timed_sprint') {
          this.isAdaptiveMode = false;
          this.smartPickerEnabled = false;
          this.questionTimerEnabled = true;
        }
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
          toast.info(t('quiz.copy70'));
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
        if (consumedKey) storageService.remove(consumedKey, true, this.boundLoginSession);
        this.startTimer();
        this.startQuestionTimer();
      };
      if (this._singleMode) {
        let singleQ;
        try {
          singleQ = storageService.get('temp_practice_question', null, { migrateLegacy: false, throwOnError: true });
        } catch (_error) {
          return unavailable(t('quiz.copy71'));
        }
        const selected = readSinglePracticeHandoff(singleQ, this.singlePracticeId, getUserId() || '');
        if (!selected) return unavailable(t('quiz.copy72'));
        accept(selected, 'temp_practice_question');
        return;
      }
      if (this.mode === 'temp_bank') {
        const raw = storageService.get('temp_practice_questions', [], { migrateLegacy: false });
        const selected = prepareQuizSelection(raw);
        if (!selected) return unavailable(t('quiz.copy72'));
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
          return unavailable(t('quiz.copy73'));
        }
        if (!selected) return unavailable(t('quiz.copy74'));
        accept(selected);
        return;
      }
      const bank = storageService.get('v30_bank', [], { migrateLegacy: false });
      // 整卷刷新使用当前账户的完整试卷，不依赖已消费的临时编号。
      if (this.paperId) {
        const raw = Array.isArray(bank) ? bank.filter((q) => q?.paperId === this.paperId) : [];
        const selected = prepareQuizSelection(raw);
        if (!selected) return unavailable(t('quiz.copy75'));
        accept(selected);
        return;
      }
      if (this._smartReviewMode) {
        return unavailable(t('quiz.copy76'));
      }

      // 普通组题只使用有完整原件的题目；显示默认值不进入原件快照。
      let questions = Array.isArray(bank) ? bank.map(prepareQuizQuestion).filter(Boolean) : [];
      if (this.mode === 'timed_sprint') questions = questions.slice(0, 20);
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

      this.questions = this.mode === 'timed_sprint' ? questions : this.applyEloMatching(questions);

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
      storageService.save('passage_annotations', this.passageAnnotations || {}, true, this.boundLoginSession);
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
        (getToken() || '') === token &&
        checkSession(this.boundLoginSession) === 'current';
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
      const session = this.boundLoginSession;
      if (checkSession(session) !== 'current') return false;
      const today = new Date().toISOString().split('T')[0];
      const options = { session, migrateLegacy: false };
      const stats = storageService.get('study_stats', {}, options);
      stats[today] = (stats[today] || 0) + 1;
      if (!storageService.save('study_stats', stats, true, session)) return false;
      const date = storageService.get('today_answer_date', '', options);
      const count = Number.parseInt(storageService.get('today_answer_count', '0', options), 10) || 0;
      if (!storageService.save('today_answer_count', String(date === today ? count + 1 : 1), true, session))
        return false;
      return storageService.save('today_answer_date', today, true, session);
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
        (getToken() || '') === token &&
        checkSession(this.boundLoginSession) === 'current';
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
        if (current()) this.observationError = t('quiz.viewUnsaved');
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
        (getToken() || '') === token &&
        checkSession(this.boundLoginSession) === 'current';
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
        if (current()) this.observationError = t('quiz.rateUnsaved');
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
            toast.info(t('quiz.copy77'), 1500);
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
          toast.info(t('quiz.copy78'));
          return;
        }
        // ✅ P0-3: 练习完成，清除进度
        clearQuizProgress(this.boundLoginSession);

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
      clearQuizProgress(this.boundLoginSession);
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
            ? `${d.overallLevel}（${d.accuracy || 0}%）${weakStr ? '\n' + t('quiz.weakPoints') + weakStr : ''}\n${d.encouragement || ''}`
            : t('quiz.diagnosed');
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
      if (!quizRecordOwnerMatches(this)) return toast.info(t('quiz.copy79'));
      if (this.hasNextRecommendation && this.nextRecommendationIds.length > 0) {
        const result = storageService.prepareQuizReview({
          ids: this.nextRecommendationIds,
          expectedOwner: this.quizOwnerId
        });
        if (!result.success) return toast.info(t('quiz.copy80'));
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
        this.pageModal.show({
          title: t('quiz.copy81'),
          content: this.diagnosisSummary || t('quiz.copy82'),
          confirmText: t('quiz.copy83'),
          cancelText: t('quiz.copy46'),
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
        toast.info(t('quiz.copy84'));
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
        toast.info(t('quiz.copy85'));
        safeNavigateTo('/pages/study-detail/index');
        return;
      }
      if (this.diagnosisLoading) return;
      if (!this.sessionId) {
        toast.info(t('quiz.copy86'));
        this.handleCompleteConfirm();
        return;
      }

      this.diagnosisLoading = true;
      try {
        const res = await this.reviewStore.generateDiagnosis({ sessionId: this.sessionId });
        if (res.success && res.data) {
          this.showCompleteModal = false;
          const d = res.data.diagnosis || {};
          this.pageModal.show({
            title: t('quiz.copy87', { v0: d.overallLevel || t('quiz.copy88') }),
            content: t('quiz.copy89', {
              v0: d.accuracy || 0,
              v1: d.encouragement || t('quiz.copy90'),
              v2: (d.weakPoints || []).map((w) => w.knowledgePoint).join('、') || t('quiz.copy91'),
              v3: d.studyPlan?.immediate || t('quiz.copy92')
            }),
            confirmText: t('quiz.copy83'),
            cancelText: t('quiz.copy46'),
            success: (modalRes) => {
              if (modalRes.confirm) {
                safeNavigateTo('/pages/mistake/index');
              } else {
                safeNavigateBack();
              }
            }
          });
        } else {
          toast.info(publicError(res) || t('quiz.copy93'));
        }
      } catch (e) {
        logger.warn('[do-quiz] AI诊断失败:', e);
        toast.info(t('quiz.copy94'));
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
        toast.info(t('quiz.copy95'));
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
      if (!result.success) toast.info(publicError(result) || t('quiz.copy96'));

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
            toast.info(publicError(data));
          }
        },
        onTimeout: (_data) => {
          // 超时处理
          if (currentBinding() && !this.hasAnswered) {
            toast.info(t('quiz.copy97'));
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
        (getToken() || '') === token &&
        checkSession(this.boundLoginSession) === 'current';
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
        toast.info(t('quiz.copy98'));
      }

      logger.log('[do-quiz] 离线状态:', status);
    },

    // ==================== 题目笔记相关方法 ====================

    // ✅ 打开笔记弹窗
    handleOpenNote(options = {}) {
      if (!this.currentQuestion) return;
      if (this.isQuestionActionLocked && !options.allowDuringResult) {
        toast.info(t('quiz.copy95'));
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
        toast.info(t('quiz.copy99'));
        return;
      }

      const result = addQuestionNote(
        {
          questionId: this.currentQuestion.id || this.currentQuestion.question,
          questionContent: this.currentQuestion.question,
          content: this.noteContent.trim(),
          tags: this.selectedNoteTags,
          category: this.currentQuestion.category
        },
        this.boundLoginSession
      );

      if (result.success) {
        toast.success(t('quiz.copy100'));

        // 更新当前题目的笔记列表
        this.currentQuestionNotes = getNotesByQuestion(this.currentQuestion.id || this.currentQuestion.question);

        this.showNoteModal = false;
        this.noteContent = '';
        this.selectedNoteTags = [];
      } else {
        toast.info(t('quiz.copy101'));
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
        toast.info(t('quiz.copy95'));
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
