<template>
  <view v-if="visible" class="mini-guide-overlay" @tap.stop="nextStep">
    <!-- Dark overlay with hole -->
    <view class="guide-mask" />

    <!-- Tooltip -->
    <view class="guide-tooltip" :style="tooltipStyle">
      <text class="guide-title">{{ currentStep.title }}</text>
      <text class="guide-desc">{{ currentStep.description }}</text>
      <view class="guide-footer">
        <text class="guide-progress">{{ stepIndex + 1 }} / {{ steps.length }}</text>
        <text class="guide-action" @tap.stop="nextStep">
          {{ stepIndex < steps.length - 1 ? '下一步' : '知道了' }}
        </text>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { storageService } from '@/services/storageService.js';

const props = defineProps({
  steps: { type: Array, default: () => [] },
  storageKey: { type: String, default: '' }
});

const emit = defineEmits(['complete']);

const visible = ref(false);
const stepIndex = ref(0);

const currentStep = computed(() => props.steps[stepIndex.value] || {});

const tooltipStyle = computed(() => {
  const step = currentStep.value;
  if (step.position === 'bottom') {
    return { top: '40%', left: '10%', right: '10%' };
  }
  return { bottom: '30%', left: '10%', right: '10%' };
});

function nextStep() {
  if (stepIndex.value < props.steps.length - 1) {
    stepIndex.value++;
  } else {
    visible.value = false;
    if (props.storageKey) {
      const completed = storageService.get('ONBOARDING_COMPLETED') || {};
      completed[props.storageKey] = true;
      storageService.save('ONBOARDING_COMPLETED', completed);
    }
    emit('complete');
  }
}

onMounted(() => {
  if (props.storageKey) {
    const completed = storageService.get('ONBOARDING_COMPLETED') || {};
    if (!completed[props.storageKey] && props.steps.length > 0) {
      // Delay to let page render
      setTimeout(() => {
        visible.value = true;
      }, 1500);
    }
  }
});
</script>

<style lang="scss" scoped>
.mini-guide-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
}

.guide-mask {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
}

.guide-tooltip {
  position: absolute;
  background: var(--bg-card, #fff);
  border-radius: 24rpx;
  padding: 32rpx;
  box-shadow: 0 8rpx 32rpx rgba(0, 0, 0, 0.15);
  z-index: 1;
}

.guide-title {
  font-size: 32rpx;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 12rpx;
  display: block;
}

.guide-desc {
  font-size: 26rpx;
  color: var(--text-sub);
  line-height: 1.6;
  margin-bottom: 24rpx;
  display: block;
}

.guide-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.guide-progress {
  font-size: 24rpx;
  color: var(--text-sub);
}

.guide-action {
  font-size: 28rpx;
  font-weight: 600;
  color: var(--primary, #0f5f34);
  padding: 8rpx 24rpx;
  border-radius: 12rpx;
  background: rgba(15, 95, 52, 0.08);
}
</style>
