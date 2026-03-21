<template>
  <view class="question-renderer" :class="{ 'dark-mode': isDark }">
    <!-- 题目卡片 -->
    <view class="glass-card question-card">
      <view class="q-header">
        <view class="q-tag">{{ question.type || '单选' }}</view>
      </view>
      <RichText class="q-content" :content="displayQuestion" />
    </view>

    <!-- 单选：radio buttons -->
    <view v-if="qType === '单选'" class="options-list">
      <view
        v-for="(opt, idx) in question.options"
        :key="idx"
        :class="[
          'glass-card',
          'option-item',
          {
            selected: userChoice === idx,
            correct: hasAnswered && isCorrectIdx(idx),
            wrong: hasAnswered && userChoice === idx && !isCorrectIdx(idx),
            disabled: hasAnswered && userChoice !== idx
          }
        ]"
        hover-class="option-hover"
        @tap="onSingleSelect(idx)"
      >
        <view class="opt-index">{{ optionLabel(idx) }}</view>
        <RichText class="opt-text" :content="opt" />
      </view>
    </view>

    <!-- 多选：checkboxes -->
    <view v-else-if="qType === '多选'" class="options-list">
      <view
        v-for="(opt, idx) in question.options"
        :key="idx"
        :class="[
          'glass-card',
          'option-item',
          'multi',
          {
            selected: multiSelected.includes(idx),
            correct: hasAnswered && isCorrectIdx(idx),
            wrong: hasAnswered && multiSelected.includes(idx) && !isCorrectIdx(idx),
            disabled: hasAnswered
          }
        ]"
        hover-class="option-hover"
        @tap="onMultiToggle(idx)"
      >
        <view class="checkbox-icon">{{ multiSelected.includes(idx) ? '☑' : '☐' }}</view>
        <view class="opt-index">{{ optionLabel(idx) }}</view>
        <RichText class="opt-text" :content="opt" />
      </view>
      <button
        v-if="!hasAnswered && multiSelected.length > 0"
        class="submit-btn glass-card"
        hover-class="option-hover"
        @tap="onMultiSubmit"
      >
        确认提交（已选 {{ multiSelected.length }} 项）
      </button>
    </view>

    <!-- 判断：true/false toggle -->
    <view v-else-if="qType === '判断'" class="judge-row">
      <view
        :class="[
          'glass-card',
          'judge-btn',
          'judge-true',
          {
            selected: judgeChoice === true,
            correct: hasAnswered && isJudgeCorrect(true),
            wrong: hasAnswered && judgeChoice === true && !isJudgeCorrect(true),
            disabled: hasAnswered && judgeChoice !== true
          }
        ]"
        hover-class="option-hover"
        @tap="onJudge(true)"
      >
        <text class="judge-icon">✓</text>
        <text class="judge-label">正确</text>
      </view>
      <view
        :class="[
          'glass-card',
          'judge-btn',
          'judge-false',
          {
            selected: judgeChoice === false,
            correct: hasAnswered && isJudgeCorrect(false),
            wrong: hasAnswered && judgeChoice === false && !isJudgeCorrect(false),
            disabled: hasAnswered && judgeChoice !== false
          }
        ]"
        hover-class="option-hover"
        @tap="onJudge(false)"
      >
        <text class="judge-icon">✗</text>
        <text class="judge-label">错误</text>
      </view>
    </view>

    <!-- 填空：text inputs -->
    <view v-else-if="qType === '填空'" class="fill-area">
      <view v-for="(_, idx) in blanks" :key="idx" class="fill-row glass-card">
        <text class="fill-label">空 {{ idx + 1 }}</text>
        <input
          class="fill-input"
          :value="fillAnswers[idx]"
          :disabled="hasAnswered"
          placeholder="请输入答案"
          @input="onFillInput($event, idx)"
        />
      </view>
      <button
        v-if="!hasAnswered && fillAnswers.some((a) => a.trim())"
        class="submit-btn glass-card"
        hover-class="option-hover"
        @tap="onFillSubmit"
      >
        确认提交
      </button>
    </view>

    <!-- fallback: 当作单选 -->
    <view v-else class="options-list">
      <view
        v-for="(opt, idx) in question.options"
        :key="idx"
        :class="[
          'glass-card',
          'option-item',
          {
            selected: userChoice === idx,
            correct: hasAnswered && isCorrectIdx(idx),
            wrong: hasAnswered && userChoice === idx && !isCorrectIdx(idx),
            disabled: hasAnswered && userChoice !== idx
          }
        ]"
        hover-class="option-hover"
        @tap="onSingleSelect(idx)"
      >
        <view class="opt-index">{{ optionLabel(idx) }}</view>
        <RichText class="opt-text" :content="opt" />
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import RichText from '../RichText.vue';

const props = defineProps({
  question: { type: Object, default: () => ({}) },
  hasAnswered: { type: Boolean, default: false },
  userChoice: { type: [Number, String, Array, Boolean, null], default: null },
  isDark: { type: Boolean, default: false }
});

const emit = defineEmits(['answer']);

const LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
const optionLabel = (idx) => {
  const opt = (props.question.options || [])[idx] || '';
  const m = opt.match(/^([A-Z])\./);
  return m ? m[1] : LABELS[idx] || '';
};

const qType = computed(() => {
  const t = (props.question.type || '').trim();
  if (['单选', '单选题'].includes(t)) return '单选';
  if (['多选', '多选题'].includes(t)) return '多选';
  if (['判断', '判断题'].includes(t)) return '判断';
  if (['填空', '填空题'].includes(t)) return '填空';
  return t || '单选';
});

// --- 填空：检测 ___ 占位符 ---
const blanks = computed(() => {
  const text = props.question.question || '';
  const matches = text.match(/_{2,}/g);
  return matches && matches.length > 0 ? matches : ['___'];
});

const displayQuestion = computed(() => {
  if (qType.value !== '填空') return props.question.question || '';
  const text = props.question.question || '';
  let i = 0;
  return text.replace(/_{2,}/g, () => `____（${++i}）____`);
});

// --- 单选 ---
function onSingleSelect(idx) {
  if (props.hasAnswered) return;
  emit('answer', idx);
}

function isCorrectIdx(idx) {
  const ans = (props.question.answer || '').toUpperCase();
  const label = optionLabel(idx);
  if (ans.length === 1 && LABELS.includes(ans)) return label === ans;
  // 多选答案如 "AB"
  return ans.includes(label);
}

// --- 多选 ---
const multiSelected = ref([]);
watch(
  () => props.question,
  () => {
    multiSelected.value = [];
  },
  { deep: true }
);

function onMultiToggle(idx) {
  if (props.hasAnswered) return;
  const i = multiSelected.value.indexOf(idx);
  if (i >= 0) multiSelected.value.splice(i, 1);
  else multiSelected.value.push(idx);
}

function onMultiSubmit() {
  if (props.hasAnswered || multiSelected.value.length === 0) return;
  const labels = multiSelected.value
    .sort((a, b) => a - b)
    .map((i) => optionLabel(i))
    .join('');
  emit('answer', labels);
}

// --- 判断 ---
const judgeChoice = ref(null);
watch(
  () => props.question,
  () => {
    judgeChoice.value = null;
  },
  { deep: true }
);

function isJudgeCorrect(val) {
  const ans = (props.question.answer || '').trim();
  const isTrue = ['正确', '对', '√', '✓', 'T', 'true', 'A'].includes(ans);
  return val === isTrue;
}

function onJudge(val) {
  if (props.hasAnswered) return;
  judgeChoice.value = val;
  emit('answer', val ? '正确' : '错误');
}

// --- 填空 ---
const fillAnswers = ref([]);
watch(
  () => blanks.value,
  (b) => {
    fillAnswers.value = b.map(() => '');
  },
  { immediate: true }
);

function onFillInput(e, idx) {
  fillAnswers.value[idx] = e.detail.value || '';
}

function onFillSubmit() {
  if (props.hasAnswered) return;
  emit(
    'answer',
    fillAnswers.value.map((a) => a.trim())
  );
}
</script>

<style lang="scss" scoped>
.glass-card {
  background: var(--bg-glass);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid var(--border);
  border-radius: 40rpx;
  padding: 40rpx;
  margin-bottom: 30rpx;
  box-shadow: var(--shadow-md);
}
.question-card .q-header {
  margin-bottom: 20rpx;
}
.q-tag {
  display: inline-block;
  background: var(--primary);
  color: var(--text-primary-foreground);
  font-size: 20rpx;
  padding: 4rpx 16rpx;
  border-radius: 10rpx;
}
.q-content {
  font-size: 34rpx;
  font-weight: bold;
  line-height: 1.6;
  color: var(--text-primary);
}

/* options */
.options-list {
  margin-top: 20rpx;
}
.option-item {
  display: flex;
  align-items: center;
  padding: 30rpx 40rpx;
  transition: all 0.2s;
  position: relative;
}
.option-item.selected {
  border-color: var(--primary);
  background: var(--success-light);
}
.option-item.correct {
  border-color: var(--primary);
  background: var(--success-light);
}
.option-item.wrong {
  border-color: var(--danger);
  background: var(--danger-light);
}
.option-item.disabled {
  opacity: 0.5;
  pointer-events: none;
}
.opt-index {
  width: 50rpx;
  font-weight: 900;
  color: var(--primary);
  font-size: 32rpx;
  flex-shrink: 0;
}
.opt-text {
  flex: 1;
  font-size: 30rpx;
  color: var(--text-sub);
  line-height: 1.5;
}
.checkbox-icon {
  font-size: 36rpx;
  color: var(--primary);
  margin-right: 12rpx;
  flex-shrink: 0;
}
.option-hover {
  opacity: 0.85;
  transform: scale(0.98);
}

/* judge */
.judge-row {
  display: flex;
  margin-top: 20rpx;
}
.judge-row > .judge-btn {
  flex: 1;
}
.judge-row > .judge-btn:first-child {
  margin-right: 24rpx;
}
.judge-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48rpx 0;
  transition: all 0.25s;
}
.judge-icon {
  font-size: 72rpx;
  font-weight: bold;
}
.judge-label {
  font-size: 30rpx;
  font-weight: 600;
  margin-top: 12rpx;
  color: var(--text-primary);
}
.judge-true.selected,
.judge-true.correct {
  border-color: var(--primary);
  background: var(--success-light);
}
.judge-true .judge-icon {
  color: var(--success, #10b981);
}
.judge-false.selected {
  border-color: var(--danger);
  background: var(--danger-light);
}
.judge-false .judge-icon {
  color: var(--danger, #ef4444);
}
.judge-false.correct {
  border-color: var(--primary);
  background: var(--success-light);
}
.judge-btn.wrong {
  border-color: var(--danger);
  background: var(--danger-light);
}
.judge-btn.disabled {
  opacity: 0.5;
  pointer-events: none;
}

/* fill */
.fill-area {
  margin-top: 20rpx;
}
.fill-row {
  display: flex;
  align-items: center;
  padding: 24rpx 32rpx;
}
.fill-label {
  font-size: 26rpx;
  font-weight: 600;
  color: var(--primary);
  margin-right: 20rpx;
  flex-shrink: 0;
}
.fill-input {
  flex: 1;
  font-size: 30rpx;
  color: var(--text-primary);
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 16rpx;
  padding: 16rpx 20rpx;
}

/* submit */
.submit-btn {
  width: 100%;
  text-align: center;
  font-size: 30rpx;
  font-weight: bold;
  color: var(--text-primary-foreground);
  background: var(--cta-primary-bg, var(--primary));
  border: 1rpx solid var(--cta-primary-border, var(--primary));
  padding: 24rpx 0;
}
</style>
