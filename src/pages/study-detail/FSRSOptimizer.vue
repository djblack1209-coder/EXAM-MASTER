<template>
  <view class="fsrs-card">
    <!-- 初始加载状态 -->
    <view v-if="loading" class="fsrs-loading">
      <text class="fsrs-loading-text">加载中...</text>
    </view>

    <view v-else>
      <view class="fsrs-header">
        <view class="fsrs-title-row">
          <text class="fsrs-icon">[智能]</text>
          <text class="fsrs-title">记忆模型</text>
          <view v-if="status.has_custom_params" class="fsrs-badge">已个性化</view>
        </view>
        <text class="fsrs-subtitle">
          {{
            status.has_custom_params
              ? `已优化 ${status.optimize_count} 次 · 基于 ${status.review_log_count} 条复习记录`
              : '完成更多复习后可优化你的专属记忆模型'
          }}
        </text>
      </view>

      <!-- 进度条：复习记录收集进度 -->
      <view v-if="!status.can_optimize && !status.has_custom_params" class="fsrs-progress-section">
        <view class="fsrs-progress-bar">
          <view class="fsrs-progress-fill" :style="{ width: progressPercent + '%' }" />
        </view>
        <text class="fsrs-progress-text">
          {{ status.review_log_count || 0 }} / {{ status.min_logs_required }} 条复习记录
        </text>
      </view>

      <!-- 留存率曲线（简化版 sparkline） -->
      <view v-if="curve.length > 0" class="fsrs-curve-section">
        <view class="fsrs-curve-header">
          <text class="fsrs-curve-title">记忆留存率</text>
          <text class="fsrs-retention-value">目标 {{ Math.round((status.request_retention || 0.9) * 100) }}%</text>
        </view>
        <view class="fsrs-curve-chart">
          <view
            v-for="(point, idx) in curveDisplay"
            :key="idx"
            class="fsrs-bar"
            :style="{ height: point.retention + '%', backgroundColor: barColor(point.retention) }"
          />
        </view>
        <view class="fsrs-curve-labels">
          <text class="fsrs-curve-label">1天</text>
          <text class="fsrs-curve-label">{{ Math.round(curveDisplay.length / 2) }}天</text>
          <text class="fsrs-curve-label">{{ curveDisplay.length }}天</text>
        </view>
      </view>

      <!-- 优化按钮 -->
      <view class="fsrs-action">
        <button
          class="fsrs-btn"
          :class="{ 'fsrs-btn-disabled': !canOptimize }"
          :disabled="!canOptimize || optimizing"
          @tap="handleOptimize"
        >
          <text v-if="optimizing">优化中...</text>
          <text v-else-if="!status.can_optimize">复习记录不足</text>
          <text v-else-if="status.cooldown_remaining > 0">{{ cooldownText }}</text>
          <text v-else>{{ status.has_custom_params ? '重新优化' : '开始优化' }}</text>
        </button>
      </view>
    </view>
    <!-- v-else 结束 -->
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useReviewStore } from '@/stores/modules/review.js';
import { loadUserFSRSParams } from '@/pages/practice-sub/utils/mistake-fsrs-scheduler';
import { toast } from '@/utils/toast.js';

const reviewStore = useReviewStore();

const status = ref({
  has_custom_params: false,
  optimize_count: 0,
  optimized_at: null,
  request_retention: 0.9,
  review_log_count: 0,
  min_logs_required: 50,
  can_optimize: false,
  cooldown_remaining: 0
});

const curve = ref([]);
const optimizing = ref(false);
// 初始数据加载状态
const loading = ref(false);

const progressPercent = computed(() => {
  const { review_log_count = 0, min_logs_required = 50 } = status.value;
  return Math.min(100, Math.round((review_log_count / min_logs_required) * 100));
});

const canOptimize = computed(() => {
  return status.value.can_optimize && status.value.cooldown_remaining <= 0 && !optimizing.value;
});

const cooldownText = computed(() => {
  const hours = Math.ceil(status.value.cooldown_remaining / 3600000);
  return `${hours}小时后可优化`;
});

// 取最多 30 个点用于展示
const curveDisplay = computed(() => {
  const data = curve.value;
  if (data.length <= 30) return data;
  const step = Math.ceil(data.length / 30);
  return data.filter((_, i) => i % step === 0).slice(0, 30);
});

function barColor(retention) {
  if (retention >= 80) return '#34d399';
  if (retention >= 60) return '#fbbf24';
  return '#f87171';
}

async function loadStatus() {
  try {
    const res = await reviewStore.fetchFSRSStatus();
    if (res?.success && res.data) {
      status.value = res.data;
    }
  } catch (_e) {
    toast.error('记忆模型状态加载失败');
  }
}

async function loadCurve() {
  try {
    const res = await reviewStore.fetchRetentionCurve();
    if (res?.success && res.data?.curve) {
      curve.value = res.data.curve;
    }
  } catch (_e) {
    toast.error('留存率数据加载失败');
  }
}

async function handleOptimize() {
  if (!canOptimize.value) return;
  optimizing.value = true;
  try {
    const res = await reviewStore.optimizeFSRS();
    if (res?.success && res.data) {
      toast.success('记忆模型已优化');
      // 重新加载状态和曲线
      await Promise.all([loadStatus(), loadCurve()]);
      // 通知前端调度器加载新参数
      if (res.data.request_retention) {
        // 从用户 profile 获取完整参数（包含 w 向量）
        const statusRes = await reviewStore.fetchFSRSStatus();
        if (statusRes?.success && statusRes.data?.has_custom_params) {
          // 参数已存储在后端，前端通过 user profile 获取
          loadUserFSRSParams({
            w: res.data.w,
            request_retention: res.data.request_retention
          });
        }
      }
    } else {
      toast.info(res?.message || '优化失败');
    }
  } catch (_e) {
    toast.info('优化失败，请稍后重试');
  } finally {
    optimizing.value = false;
  }
}

onMounted(async () => {
  loading.value = true;
  await Promise.all([loadStatus(), loadCurve()]);
  loading.value = false;
});
</script>

<style scoped>
.fsrs-card {
  background: rgba(255, 255, 255, 0.72);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-radius: 20rpx;
  padding: 32rpx;
  margin-bottom: 24rpx;
}
.fsrs-header {
  margin-bottom: 24rpx;
}
.fsrs-title-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-bottom: 8rpx;
}
.fsrs-icon {
  font-size: 36rpx;
}
.fsrs-title {
  font-size: 32rpx;
  font-weight: 600;
  color: #1a1a2e;
}
.fsrs-badge {
  font-size: 20rpx;
  color: #6366f1;
  background: rgba(99, 102, 241, 0.1);
  padding: 4rpx 16rpx;
  border-radius: 20rpx;
}
.fsrs-subtitle {
  font-size: 24rpx;
  color: #8b8fa3;
  line-height: 1.5;
}

.fsrs-progress-section {
  margin-bottom: 24rpx;
}
.fsrs-progress-bar {
  height: 12rpx;
  background: rgba(0, 0, 0, 0.06);
  border-radius: 6rpx;
  overflow: hidden;
}
.fsrs-progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #6366f1, #8b5cf6);
  border-radius: 6rpx;
  transition: width 0.6s ease;
}
.fsrs-progress-text {
  font-size: 22rpx;
  color: #8b8fa3;
  margin-top: 8rpx;
}

.fsrs-curve-section {
  margin-bottom: 24rpx;
}
.fsrs-curve-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16rpx;
}
.fsrs-curve-title {
  font-size: 26rpx;
  color: #1a1a2e;
  font-weight: 500;
}
.fsrs-retention-value {
  font-size: 22rpx;
  color: #6366f1;
}
.fsrs-curve-chart {
  display: flex;
  align-items: flex-end;
  gap: 4rpx;
  height: 120rpx;
  padding: 0 4rpx;
}
.fsrs-bar {
  flex: 1;
  min-width: 6rpx;
  border-radius: 4rpx 4rpx 0 0;
  transition: height 0.3s ease;
}
.fsrs-curve-labels {
  display: flex;
  justify-content: space-between;
  margin-top: 8rpx;
}
.fsrs-curve-label {
  font-size: 20rpx;
  color: #b0b3c6;
}

.fsrs-action {
  margin-top: 8rpx;
}
.fsrs-btn {
  width: 100%;
  height: 72rpx;
  line-height: 72rpx;
  text-align: center;
  font-size: 28rpx;
  font-weight: 500;
  color: #fff;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  border-radius: 16rpx;
  border: none;
}
.fsrs-btn-disabled {
  background: #e5e7eb;
  color: #9ca3af;
}
/* 初始加载状态 */
.fsrs-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 48rpx 0;
}
.fsrs-loading-text {
  font-size: 26rpx;
  color: #8b8fa3;
}
</style>
