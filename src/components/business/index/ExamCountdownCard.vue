<template>
  <view :class="['countdown-card', isDark ? 'countdown-dark' : 'countdown-light']" @longpress="shareCountdown">
    <!-- Top row: label + settings -->
    <view class="countdown-header">
      <text class="countdown-label">考研倒计时</text>
      <view class="countdown-settings" hover-class="hover-scale" @tap.stop="$emit('edit-date')">
        <BaseIcon name="settings" :size="28" />
      </view>
    </view>

    <!-- Main countdown numbers -->
    <view class="countdown-numbers">
      <view class="number-block main-days">
        <text class="number-value">{{ days }}</text>
        <text class="number-unit">天</text>
      </view>
      <view class="number-separator">
        <text class="separator-dot">:</text>
      </view>
      <view class="number-block">
        <text class="number-value small">{{ hours }}</text>
        <text class="number-unit">时</text>
      </view>
      <view class="number-separator">
        <text class="separator-dot">:</text>
      </view>
      <view class="number-block">
        <text class="number-value small">{{ minutes }}</text>
        <text class="number-unit">分</text>
      </view>
    </view>

    <!-- Stage message -->
    <view class="countdown-stage">
      <text class="stage-text">{{ stageMessage }}</text>
    </view>

    <!-- Exam date display -->
    <text class="exam-date-text">{{ examDateDisplay }}</text>
  </view>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { formatDate } from '@/utils/date.js';
import { toast } from '@/utils/toast.js';
import BaseIcon from '@/components/base/base-icon/base-icon.vue';

const props = defineProps({
  // Exam date as ISO string or timestamp
  examDate: { type: [String, Number], default: '' },
  isDark: { type: Boolean, default: false }
});

defineEmits(['edit-date']);

const now = ref(Date.now());
let timer = null;

onMounted(() => {
  timer = setInterval(() => {
    now.value = Date.now();
  }, 60000); // Update every minute
});

onUnmounted(() => {
  if (timer) clearInterval(timer);
});

const targetTime = computed(() => {
  if (props.examDate) {
    return new Date(props.examDate).getTime();
  }
  // Default: next December 21 (考研初试 typically third weekend of December)
  const thisYear = new Date().getFullYear();
  const dec21 = new Date(thisYear, 11, 21).getTime();
  return Date.now() < dec21 ? dec21 : new Date(thisYear + 1, 11, 21).getTime();
});

const diff = computed(() => Math.max(0, targetTime.value - now.value));
const days = computed(() => Math.floor(diff.value / 86400000));
const hours = computed(() => Math.floor((diff.value % 86400000) / 3600000));
const minutes = computed(() => Math.floor((diff.value % 3600000) / 60000));

const examDateDisplay = computed(() => {
  return formatDate(targetTime.value, 'YYYY年MM月DD日');
});

const stageMessage = computed(() => {
  const d = days.value;
  if (d <= 0) return '考试日，全力以赴！';
  if (d <= 3) return '最后冲刺，调整状态';
  if (d <= 7) return '考前一周，查漏补缺';
  if (d <= 30) return '冲刺阶段，每天都算数';
  if (d <= 60) return '强化阶段，稳步提升';
  if (d <= 90) return '三个月，足以改变一切';
  if (d <= 180) return '半年备战，节奏为王';
  if (d <= 365) return '时间充裕，打好基础';
  return '提前布局，赢在起跑线';
});

function shareCountdown() {
  toast.info('长按分享功能开发中');
}
</script>

<style lang="scss" scoped>
.countdown-card {
  border-radius: 28rpx;
  padding: 32rpx;
  margin-bottom: 24rpx;
  position: relative;
  overflow: hidden;
}

.countdown-light {
  background: linear-gradient(135deg, #0f5f34 0%, #1a8048 50%, #10b981 100%);
  box-shadow: 0 8rpx 32rpx rgba(15, 95, 52, 0.25);
}

.countdown-dark {
  background: linear-gradient(135deg, #064e2b 0%, #0d6b3e 50%, #0a9060 100%);
  box-shadow: 0 8rpx 32rpx rgba(10, 144, 96, 0.2);
}

.countdown-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20rpx;
}

.countdown-label {
  font-size: 26rpx;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.85);
  letter-spacing: 2rpx;
}

.countdown-settings {
  width: 48rpx;
  height: 48rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.15);
}

.settings-icon {
  font-size: 24rpx;
}

.countdown-numbers {
  display: flex;
  align-items: flex-end;
  justify-content: center;
  /* gap: 8rpx; -- replaced for MP WebView compat */
  margin-bottom: 20rpx;
}

.number-block {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.number-value {
  font-size: 88rpx;
  font-weight: 800;
  color: #ffffff;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}

.number-value.small {
  font-size: 52rpx;
}

.number-unit {
  font-size: 22rpx;
  color: rgba(255, 255, 255, 0.7);
  margin-top: 4rpx;
}

.number-separator {
  padding-bottom: 24rpx;
}

.separator-dot {
  font-size: 40rpx;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.5);
}

.countdown-stage {
  text-align: center;
  margin-bottom: 8rpx;
}

.stage-text {
  font-size: 28rpx;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.95);
}

.exam-date-text {
  display: block;
  text-align: center;
  font-size: 22rpx;
  color: rgba(255, 255, 255, 0.55);
}

.main-days .number-value {
  text-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.15);
}
</style>
