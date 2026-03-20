<template>
  <view v-if="question && question.options" class="options-list">
    <view
      v-for="(opt, idx) in question.options"
      :id="`e2e-quiz-option-${idx}`"
      :key="idx"
      :class="[
        'glass-card',
        'option-item',
        {
          selected: userChoice === idx,
          correct: hasAnswered && isCorrectOption(idx),
          wrong: hasAnswered && userChoice === idx && !isCorrectOption(idx),
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
</template>

<script setup>
import { defineProps, defineEmits } from 'vue';

defineProps({
  question: {
    type: Object,
    required: true
  },
  userChoice: {
    type: Number,
    default: null
  },
  hasAnswered: {
    type: Boolean,
    default: false
  },
  isAnalyzing: {
    type: Boolean,
    default: false
  },
  isCorrectOption: {
    type: Function,
    required: true
  },
  getOptionLabel: {
    type: Function,
    required: true
  }
});

const emit = defineEmits(['select']);

const selectOption = (idx) => {
  emit('select', idx);
};
</script>

<style scoped>
/* Scoped styles will go here if needed, usually global or imported */
</style>
