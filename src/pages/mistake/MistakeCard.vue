<template>
  <view class="glass-card mistake-card">
    <view class="card-tag">{{ item.category || item.subject || '未分类' }}</view>
    <text class="question-text">{{ item.question ?? item.question_content ?? '原题未保存' }}</text>
    <view class="options-list">
      <view v-for="(option, optionIndex) in options" :key="optionIndex" class="option-row">
        <text class="opt-idx">{{ getQuizOptionLabel({ options }, optionIndex) }}</text>
        <text class="opt-text">{{ option }}</text>
      </view>
    </view>
    <view v-if="mode === 'recite' || localShowAnalysis" class="analysis-box">
      <view class="correct-ans">历史参考：{{ reference ?? '未保存' }} · 待核对</view>
      <view v-if="originalAnswer !== undefined && originalAnswer !== null" class="analysis-content">
        <text class="label">原作答：</text>{{ originalAnswer }}
      </view>
      <view class="analysis-content"
        ><text class="label">历史解析：</text>{{ item.desc ?? item.analysis ?? '未保存' }}</view
      >
    </view>
    <view class="card-footer">
      <text class="time-text">{{ formatDate(item.addTime ?? item.created_at ?? item.timestamp) }}</text>
      <view v-if="(item.wrongCount ?? item.wrong_count ?? 0) > 1" class="wrong-count">
        <BaseIcon name="warning" :size="20" class="count-icon" />
        <text class="count-text">旧错误次数 {{ item.wrongCount ?? item.wrong_count }}</text>
      </view>
      <view class="actions">
        <button
          v-if="mode === 'quiz'"
          class="action-btn sm"
          role="button"
          tabindex="0"
          @tap="toggleAnalysis"
          @keydown.enter.prevent="toggleAnalysis"
          @keydown.space.prevent="toggleAnalysis"
        >
          {{ localShowAnalysis ? '隐藏参考' : '查看参考' }}
        </button>
        <button
          class="action-btn sm primary"
          role="button"
          :disabled="!reviewable"
          :aria-disabled="!reviewable"
          :tabindex="reviewable ? 0 : -1"
          @tap="startPractice"
          @keydown.enter.prevent="startPractice"
          @keydown.space.prevent="startPractice"
        >
          重做此题
        </button>
        <button
          class="action-btn sm del"
          role="button"
          tabindex="0"
          @tap="emit('remove', index)"
          @keydown.enter.prevent="emit('remove', index)"
          @keydown.space.prevent="emit('remove', index)"
        >
          移除
        </button>
      </view>
    </view>
    <text v-if="!reviewable" class="time-text">原题或参考资料不完整，原记录保留。</text>
  </view>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import BaseIcon from '@/components/base/base-icon/base-icon.vue';
import { useStudyEngineStore } from '@/stores/modules/study-engine.js';
import {
  getQuizOptionLabel,
  normalizeLegacyReviewQuestion,
  legacyReviewQuestionIdentity
} from '@/services/quiz-session-contract.js';
import { toast } from '@/utils/toast.js';
import { safeNavigateTo } from '@/utils/safe-navigate';
const props = defineProps({
  item: { type: Object, required: true },
  index: { type: Number, required: true },
  mode: { type: String, default: 'quiz' },
  mistakes: { type: Array, default: () => [] },
  expectedOwnerId: { type: String, default: null }
});
const emit = defineEmits(['remove']);
const engine = useStudyEngineStore();
const localShowAnalysis = ref(false),
  referenceViewed = ref(props.mode === 'recite');
const options = computed(() => (Array.isArray(props.item.options) ? props.item.options : []));
const reference = computed(() => props.item.answer ?? props.item.correct_answer ?? props.item.correctAnswer);
const originalAnswer = computed(() => props.item.user_answer ?? props.item.userAnswer ?? props.item.userChoice);
const reviewable = computed(() => !!normalizeLegacyReviewQuestion(props.item));
watch(
  () => [legacyReviewQuestionIdentity(props.item), props.expectedOwnerId],
  () => {
    localShowAnalysis.value = false;
    referenceViewed.value = props.mode === 'recite';
  }
);
watch(
  () => props.mode,
  (mode) => {
    if (mode === 'recite') referenceViewed.value = true;
  }
);
function toggleAnalysis() {
  localShowAnalysis.value = !localShowAnalysis.value;
  if (localShowAnalysis.value) referenceViewed.value = true;
}
function formatDate(value) {
  if (value === undefined || value === null) return '';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return `${date.getMonth() + 1}月${date.getDate()}日 ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}
function startPractice() {
  const id = props.item.id ?? props.item._id;
  const result = engine.prepareLegacyReview({
    expectedOwnerId: props.expectedOwnerId,
    recordIds: [id],
    expectedQuestions: [props.item],
    referenceViewedIds: referenceViewed.value ? [id] : []
  });
  if (!result.success) return toast.info(result.message || '原条目暂不能重练，请重新打开历史记录');
  safeNavigateTo(result.url);
}
</script>

<style lang="scss" scoped>
.glass-card {
  background: var(--bg-card);
  border: 2rpx solid rgba(0, 0, 0, 0.04);
  border-radius: 28rpx;
  padding: 30rpx;
  margin-bottom: 30rpx;
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.06);
}

/* 错题卡片 */
.mistake-card {
  position: relative;
  padding: 40rpx;

  .card-tag {
    position: absolute;
    top: 0;
    right: 40rpx;
    background: rgba(255, 75, 75, 0.1);
    color: var(--danger);
    font-size: 20rpx;
    font-weight: 600;
    padding: 10rpx 20rpx;
    border-radius: 0 0 20rpx 20rpx;
  }

  .question-text {
    font-size: 30rpx;
    line-height: 1.6;
    color: var(--text-primary);
    margin-bottom: 30rpx;
    margin-top: 10rpx;
    display: block;
    font-weight: 700;
  }
}

.options-list {
  margin-bottom: 30rpx;
}

.option-row {
  display: flex;
  margin-bottom: 16rpx;
  align-items: flex-start;

  .opt-idx {
    width: 48rpx;
    font-weight: 800;
    color: var(--text-secondary);
    flex-shrink: 0;
    font-size: 28rpx;

    &.correct {
      color: var(--success);
    }

    &.wrong {
      color: var(--danger);
    }
  }

  .opt-text {
    font-size: 28rpx;
    color: var(--text-primary);
    line-height: 1.5;
    flex: 1;
  }
}

.analysis-box {
  background: var(--bg-secondary);
  border-radius: 20rpx;
  padding: 30rpx;
  margin-bottom: 30rpx;
  border-left: 8rpx solid var(--primary);
  animation: fadeIn 0.3s;

  .correct-ans {
    font-weight: bold;
    color: var(--text-primary);
    margin-bottom: 20rpx;
    font-size: 28rpx;
    display: block;
  }

  .analysis-content {
    font-size: 26rpx;
    color: var(--text-primary);
    line-height: 1.6;

    .label {
      font-weight: bold;
      color: var(--text-primary);
    }
  }
}

.card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12rpx;
  padding-top: 20rpx;
  border-top: 1rpx solid var(--border);

  .time-text {
    font-size: 22rpx;
    color: var(--text-sub);
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 12rpx;
    /* gap: 16rpx; -- replaced for Android WebView compat */
  }

  .action-btn {
    min-height: 44px;
    padding: 10rpx 24rpx;
    border-radius: 20rpx;
    font-size: 24rpx;
    border: none;

    &.sm {
      background: var(--bg-secondary);
      color: var(--text-sub);
    }

    &.del {
      background: var(--danger-light);
      color: var(--danger);
    }

    &.primary {
      background: var(--primary);
      color: var(--primary-foreground);
      font-weight: bold;
    }

    &[disabled] {
      opacity: 0.5;
    }

    &::after {
      border: none;
    }
  }

  .wrong-count {
    display: flex;
    align-items: center;
    /* gap: 8rpx; -- replaced for Android WebView compat */
    font-size: 22rpx;
    color: var(--warning);
  }

  .count-icon {
    font-size: 20rpx;
  }
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
</style>
