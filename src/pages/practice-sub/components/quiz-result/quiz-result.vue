<template>
  <CustomModal
    :visible="visible"
    position="bottom"
    :title="t('quiz.copy165')"
    :show-actions="false"
    :is-dark="isDark"
    close-button
    escape-closable
    @cancel="emit('close')"
    ><view class="yozi-page-content">
      <view class="result-container">
        <!-- 完美得分庆祝：纯CSS动画（100%正确率触发，2.5s后淡出） -->

        <scroll-view scroll-y class="result-scroll">
          <!-- 高分庆祝：star-sparkle 闪烁（80%~99% 正确率） -->

          <!-- 正确率圆环 -->
          <view class="accuracy-section"
            ><YoziMascot
              v-if="visible"
              :pose="gradedCount > 0 && correctCount > wrongCount ? 'celebrate' : 'encourage'"
              play="once"
              size="state" /><BaseStat
              v-if="gradedCount > 0"
              :label="t('quiz.copy166')"
              :value="correctCount"
              :denominator="gradedCount" /><BaseStat
              v-else
              :label="t('quiz.copy167')"
              :value="neutralCount"
              :denominator="questions.length"
          /></view>

          <text class="accuracy-label">{{
            pendingCount > 0
              ? t('quiz.copy28')
              : reviewedCount === answeredCount && answeredCount > 0
                ? t('quiz.copy172')
                : legacyCount > 0
                  ? t('quiz.history')
                  : t('quiz.copy153')
          }}</text>
          <!-- 统计行 -->
          <view class="stats-row">
            <BaseStat :label="t('quiz.copy168')" :value="Number(answeredCount) || 0" :denominator="questions.length" />
            <view class="stat-divider" />
            <BaseStat
              :label="t('quiz.copy169')"
              :value="Number(progressSummary.legacyCorrectCount) || 0"
              :denominator="legacyCount"
            />
            <view class="stat-divider" />
            <BaseStat
              :label="t('quiz.copy170')"
              :value="Number(progressSummary.legacyWrongCount) || 0"
              :denominator="legacyCount"
            />
            <view class="stat-divider" />
            <BaseStat
              :label="
                pendingCount > 0
                  ? t('quiz.copy171')
                  : reviewedCount === answeredCount && answeredCount > 0
                    ? t('quiz.copy172')
                    : t('quiz.copy167')
              "
              :value="neutralCount > 0 ? neutralCount : Math.round(totalTime / Math.max(1, answeredCount) / 1000)"
              :unit="neutralCount > 0 ? '' : t('quiz.seconds')"
            />
          </view>

          <view v-if="legacyCount" class="motivational glass-card">
            <text>{{
              t('quiz.copy173', {
                v0: progressSummary.legacyAccuracy,
                v1: progressSummary.legacyCorrectCount,
                v2: legacyCount
              })
            }}</text>
          </view>

          <!-- 分类正确率 -->
          <view v-if="categoryBreakdown.length > 0" class="category-section glass-card">
            <text class="section-title">{{ t('quiz.copy174') }}</text>
            <view v-for="cat in categoryBreakdown" :key="cat.name" class="cat-row">
              <text class="cat-name">{{ uiText(cat.name) }}</text>
              <view class="cat-bar-bg">
                <view
                  class="cat-bar-fill"
                  :class="{ reviewed: cat.graded === 0 }"
                  :style="{ width: (cat.graded > 0 ? cat.accuracy : 100) + '%' }"
                />
              </view>
              <text class="cat-pct">{{ uiText(cat.label) }}</text>
            </view>
          </view>

          <!-- 激励文案 -->
          <view class="motivational glass-card">
            <text class="motivational-text">{{ uiText(motivationalText) }}</text>
          </view>

          <!-- 本地学习记录生成的建议 -->
          <view v-if="nextSteps.length > 0 || loadingNextSteps" class="next-steps glass-card">
            <text class="section-title">{{ t('quiz.copy175') }}</text>
            <BaseEmpty v-if="loadingNextSteps" state="loading" compact :title="t('quiz.copy31')" />
            <view v-else>
              <BaseButton
                v-for="(step, idx) in nextSteps"
                :key="idx"
                class="next-step-item"
                variant="secondary"
                @tap="handleNextStep(step)"
                ><view class="step-indicator" :class="[step.priority]" /><view class="step-content">
                  <text class="step-title">{{ uiText(step.title) }}</text>
                  <text class="step-subtitle">{{ uiText(step.subtitle) }}</text> </view
                ><text class="step-arrow"> <BaseIcon name="chevron-right" /> </text
              ></BaseButton>
            </view>
          </view>

          <view v-if="accuracy >= 60" class="completion-mark">
            <BaseIcon name="check-circle" />
          </view>

          <!-- XP 金币飞出动画 -->

          <view class="bottom-safe" />
        </scroll-view>

        <!-- 操作按钮 -->
        <view class="action-dock">
          <BaseButton
            v-if="hasNextRecommendation && gradedCount > 0"
            class="action-btn primary-btn"
            variant="primary"
            @tap="emit('continueNext')"
            >{{ t('quiz.copy176') }}</BaseButton
          >
          <BaseButton
            :variant="hasNextRecommendation && gradedCount > 0 ? 'secondary' : 'primary'"
            @tap="emit('viewReport')"
            >{{ gradedCount > 0 ? t('quiz.copy177') : t('quiz.copy178') }}</BaseButton
          >
          <BaseButton class="close-btn" variant="secondary" @tap="emit('close')">{{ t('quiz.copy46') }}</BaseButton>
        </view>
      </view>
    </view></CustomModal
  >
</template>

<script setup>
const uiText = (value) => translateRegisteredText('quiz', value);
import '@/pages/practice-sub/messages.js';
import { t, translateRegisteredText } from '@/i18n/index.js';
import YoziMascot from '@/components/base/yozi-mascot/yozi-mascot.vue';
import BaseStat from '@/components/base/base-stat/base-stat.vue';
import BaseButton from '@/components/base/base-button/base-button.vue';
import CustomModal from '@/components/common/CustomModal.vue';
import '@/styles/yozi-pages.scss';

import { ref, computed, watch, onUnmounted } from 'vue';
import { animateNumber } from '../../utils/micro-interactions.js';
import { useStudyEngineStore } from '@/stores/modules/study-engine.js';
import { summarizeQuizProgress } from '@/services/quiz-session-contract.js';
// 静态资源 CDN 映射（大图已迁出主包）
import { logger } from '@/utils/logger.js';
import BaseIcon from '@/components/base/base-icon/base-icon.vue';

const studyEngineStore = useStudyEngineStore();

const props = defineProps({
  visible: { type: Boolean, default: false },
  questions: { type: Array, default: () => [] },
  answeredQuestions: { type: Array, default: () => [] },
  totalTime: { type: Number, default: 0 },
  isDark: { type: Boolean, default: false },
  // AI诊断摘要（由do-quiz传入，替代假激励文案）
  diagnosisSummary: { type: String, default: '' },
  // 是否有AI推荐的下一组题
  hasNextRecommendation: { type: Boolean, default: false }
});

const emit = defineEmits([
  'viewReport',
  'close',
  'goMistakes',
  'goWeakTraining',
  'goNewPractice',
  'goAIPlan',
  'continueNext'
]);

// --- 基础统计 ---
const progressSummary = computed(() =>
  summarizeQuizProgress({
    questions: props.questions,
    answeredQuestions: props.answeredQuestions
  })
);
const correctCount = computed(() => progressSummary.value.correctCount);
const answeredCount = computed(() => progressSummary.value.answeredCount);
const wrongCount = computed(() => progressSummary.value.wrongCount);
const neutralCount = computed(() => progressSummary.value.neutralCount);
const pendingCount = computed(() => progressSummary.value.pendingCount);
const reviewedCount = computed(() => progressSummary.value.reviewedCount);
const legacyCount = computed(() => progressSummary.value.legacyGradedCount);
const gradedCount = computed(() => progressSummary.value.gradedCount);
const accuracy = computed(() => {
  return progressSummary.value.accuracy;
});

// --- 动画数字 ---
const displayAccuracy = ref(0);
let animHandle = null;

// --- 特效动画状态（animationend 后从 DOM 移除） ---
const showCelebration = ref(true);
const showHighScore = ref(true);
const showXpCoins = ref(true);

/** 完美得分庆祝动画结束 — 从 DOM 移除 */

/** 高分庆祝动画结束 — 从 DOM 移除 */

/** XP 金币飞出动画结束 — 从 DOM 移除 */

// --- 分类统计 ---
const categoryBreakdown = computed(() => {
  const map = new Map();
  for (const answer of props.answeredQuestions) {
    const name = props.questions[answer.index]?.category || '未分类';
    if (!map.has(name)) map.set(name, []);
    map.get(name).push(answer);
  }
  return [...map].map(([name, answers]) => {
    const summary = summarizeQuizProgress({ answeredQuestions: answers });
    const parts = [];
    if (summary.pendingCount) parts.push(t('quiz.copy179', { v0: summary.pendingCount }));
    if (summary.reviewedCount) parts.push(t('quiz.copy180', { v0: summary.reviewedCount }));
    if (summary.legacyGradedCount) parts.push(t('quiz.copy181', { v0: summary.legacyGradedCount }));
    if (summary.unclassifiedCount) parts.push(t('quiz.copy182', { v0: summary.unclassifiedCount }));
    return { name, graded: 0, accuracy: null, label: parts.join(' · ') };
  });
});

// --- 基于本地记录的学习建议 ---
const nextSteps = ref([]);
const loadingNextSteps = ref(false);

/** 根据本次做题表现生成推荐列表 */
async function loadNextSteps() {
  loadingNextSteps.value = true;
  try {
    if (gradedCount.value === 0) {
      nextSteps.value = [];
      return;
    }
    const steps = [];

    // 规则1：有错题 → 推荐去错题本
    if (wrongCount.value > 0) {
      steps.push({
        icon: 'note',
        title: t('quiz.copy92'),
        subtitle: t('quiz.copy183', { v0: wrongCount.value }),
        action: 'mistakes',
        priority: 'high'
      });
    }

    // 规则2：正确率低于60% → 推荐薄弱点训练
    if (gradedCount.value > 0 && accuracy.value < 60) {
      const gradedCategories = categoryBreakdown.value.filter((cat) => cat.graded > 0);
      const weakest = gradedCategories.length > 0 ? gradedCategories[gradedCategories.length - 1] : null;
      steps.push({
        icon: 'target',
        title: weakest ? t('quiz.strengthen', { name: uiText(weakest.name) }) : t('quiz.weakPractice'),
        subtitle: weakest ? t('quiz.lowAccuracy', { accuracy: weakest.accuracy }) : t('quiz.focusWeak'),
        action: 'weak-training',
        priority: 'high'
      });
    }

    // 规则3：正确率高于80% → 推荐挑战更难的
    if (accuracy.value >= 80) {
      steps.push({
        icon: 'award',
        title: t('quiz.copy184'),
        subtitle: t('quiz.copy185'),
        action: 'new-practice',
        priority: 'normal'
      });
    }

    // 规则4：从本地学习引擎读取掌握度，不调用模型。
    try {
      const result = await studyEngineStore.analyzeMastery();
      if (result?.data?.summary?.weakestPoint) {
        const weak = result.data.summary;
        steps.unshift({
          icon: 'sparkle',
          title: t('quiz.copy186', { v0: weak.weakestPoint }),
          subtitle: t('quiz.copy187', { v0: weak.weakCount, v1: weak.avgMastery }),
          action: 'ai-plan',
          priority: 'urgent'
        });
      }
    } catch (_e) {
      // 后端调用失败，静默降级（只用本地规则）
      logger.warn('[QuizResult] AI掌握度分析请求失败，使用本地推荐规则');
    }

    // 最多显示3条
    nextSteps.value = steps.slice(0, 3);
  } finally {
    loadingNextSteps.value = false;
  }
}

/** 点击推荐项，触发对应事件 */
function handleNextStep(step) {
  switch (step.action) {
    case 'mistakes':
      emit('goMistakes');
      break;
    case 'weak-training':
      emit('goWeakTraining');
      break;
    case 'new-practice':
      emit('goNewPractice');
      break;
    case 'ai-plan':
      emit('goAIPlan');
      break;
  }
}

// --- 动画延迟定时器 ---
let _animDelayTimer = null;

watch(
  () => props.visible,
  (val) => {
    // 清理上一次的延迟定时器（防止快速切换导致泄漏）
    if (_animDelayTimer) {
      clearTimeout(_animDelayTimer);
      _animDelayTimer = null;
    }
    if (val) {
      // 重置特效动画状态（允许重新触发）
      showCelebration.value = true;
      showHighScore.value = true;
      showXpCoins.value = true;
      displayAccuracy.value = 0;
      if (gradedCount.value > 0)
        _animDelayTimer = setTimeout(() => {
          _animDelayTimer = null;
          if (animHandle) animHandle.cancel();
          animHandle = animateNumber(0, accuracy.value, 1200, (v) => {
            displayAccuracy.value = v;
          });
        }, 300);
      // 异步加载本地学习建议
      loadNextSteps();
    }
  },
  { immediate: true }
);

onUnmounted(() => {
  if (_animDelayTimer) {
    clearTimeout(_animDelayTimer);
    _animDelayTimer = null;
  }
  if (animHandle) animHandle.cancel();
});

// --- 激励文案 — 优先使用真实AI诊断，降级到本地规则 ---
const motivationalText = computed(() => {
  // 有真实 AI 诊断数据时使用（由 do-quiz.vue 的 autoDiagnose 传入）
  if (pendingCount.value > 0 && gradedCount.value === 0) return t('quiz.copy188');
  if (legacyCount.value > 0) return t('quiz.copy189');
  if (progressSummary.value.unclassifiedCount > 0) return t('quiz.copy190');
  if (gradedCount.value > 0 && props.diagnosisSummary) return props.diagnosisSummary;
  if (gradedCount.value === 0) return t('quiz.copy191');

  // 降级：基于本次表现的本地规则文案
  if (accuracy.value >= 90) {
    const weakCat = categoryBreakdown.value.find((c) => c.graded > 0 && c.accuracy < 80);
    return weakCat ? t('quiz.copy192', { v0: weakCat.name }) : t('quiz.copy193');
  }
  if (accuracy.value >= 70) {
    const gradedCategories = categoryBreakdown.value.filter((c) => c.graded > 0);
    const worst = gradedCategories.length > 0 ? gradedCategories[gradedCategories.length - 1] : null;
    return worst
      ? t('quiz.copy194', { v0: worst.name, v1: worst.accuracy })
      : t('quiz.copy195', { v0: accuracy.value });
  }
  if (accuracy.value >= 50) {
    return t('quiz.copy196', { v0: accuracy.value });
  }
  return t('quiz.copy197', { v0: accuracy.value });
});
</script>
