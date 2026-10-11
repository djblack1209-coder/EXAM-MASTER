<template>
  <view class="fsrs-card">
    <!-- 初始加载状态 -->
    <BaseEmpty v-if="loading" state="loading" :title="t('study.copy16')" />

    <view v-else>
      <view class="fsrs-header">
        <view class="fsrs-title-row">
          <text class="fsrs-icon">{{ t('study.copy17') }}</text>
          <text class="fsrs-title">{{ t('study.copy18') }}</text>
          <view v-if="status.has_custom_params" class="fsrs-badge">{{ t('study.copy19') }}</view>
        </view>
        <text class="fsrs-subtitle">
          {{
            status.has_custom_params
              ? t('study.copy20', { v0: status.optimize_count, v1: status.review_log_count })
              : t('study.copy21')
          }}
        </text>
      </view>

      <!-- 进度条：复习记录收集进度 -->
      <view v-if="!status.can_optimize && !status.has_custom_params" class="fsrs-progress-section">
        <view class="fsrs-progress-bar">
          <view class="fsrs-progress-fill" :style="{ width: progressPercent + '%' }" />
        </view>
        <text class="fsrs-progress-text">
          {{ t('study.copy22', { v0: status.review_log_count || 0, v1: status.min_logs_required }) }}</text
        >
      </view>

      <!-- 留存率曲线（简化版 sparkline） -->
      <view v-if="curve.length > 0" class="fsrs-curve-section">
        <view class="fsrs-curve-header">
          <text class="fsrs-curve-title">{{ t('study.copy23') }}</text>
          <text class="fsrs-retention-value">{{
            t('study.copy24', { v0: Math.round((status.request_retention || 0.9) * 100) })
          }}</text>
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
          <text class="fsrs-curve-label">{{ t('study.copy25') }}</text>
          <text class="fsrs-curve-label">{{ t('study.copy26', { v0: Math.round(curveDisplay.length / 2) }) }}</text>
          <text class="fsrs-curve-label">{{ t('study.copy26', { v0: curveDisplay.length }) }}</text>
        </view>
      </view>

      <!-- 优化按钮 -->
      <view class="fsrs-action">
        <BaseButton class="fsrs-btn" :disabled="!canOptimize || optimizing" variant="primary" @tap="handleOptimize"
          ><text v-if="optimizing">{{ t('study.copy27') }}</text
          ><text v-else-if="!status.can_optimize">{{ t('study.copy28') }}</text
          ><text v-else-if="status.cooldown_remaining > 0">{{ uiText(cooldownText) }}</text
          ><text v-else>{{ status.has_custom_params ? t('study.copy29') : t('study.copy30') }}</text></BaseButton
        >
      </view>
    </view>
    <!-- v-else 结束 -->
  </view>
</template>

<script setup>
const uiText = (value) => translateRegisteredText('study', value);
import '@/pages/study-detail/messages.js';
import { t, translateRegisteredText } from '@/i18n/index.js';
import BaseEmpty from '@/components/base/base-empty/base-empty.vue';
import BaseButton from '@/components/base/base-button/base-button.vue';
import '@/styles/yozi-pages.scss';

import { ref, computed, onMounted } from 'vue';
import { useReviewStore } from '@/stores/modules/review.js';
import { loadUserFSRSParams } from './utils/mistake-fsrs-scheduler';
import { toast } from '@/utils/toast.js';
import { logger } from '@/utils/logger.js';

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
  return t('study.copy31', { v0: hours });
});

// 取最多 30 个点用于展示
const curveDisplay = computed(() => {
  const data = curve.value;
  if (data.length <= 30) return data;
  const step = Math.ceil(data.length / 30);
  return data.filter((_, i) => i % step === 0).slice(0, 30);
});

function barColor(retention) {
  if (retention >= 80) return 'var(--mint)';
  if (retention >= 60) return 'var(--apricot)';
  return 'var(--coral)';
}

async function loadStatus() {
  try {
    const res = await reviewStore.fetchFSRSStatus();
    if (res?.success && res.data) {
      status.value = res.data;
    }
  } catch (_e) {
    logger.error('[FSRSOptimizer] 记忆模型状态加载失败', _e);
    toast.error(t('study.copy32'));
  }
}

async function loadCurve() {
  try {
    const res = await reviewStore.fetchRetentionCurve();
    if (res?.success && res.data?.curve) {
      curve.value = res.data.curve;
    }
  } catch (_e) {
    logger.error('[FSRSOptimizer] 留存率曲线数据加载失败', _e);
    toast.error(t('study.copy33'));
  }
}

async function handleOptimize() {
  if (!canOptimize.value) return;
  optimizing.value = true;
  try {
    const res = await reviewStore.optimizeFSRS();
    if (res?.success && res.data) {
      toast.success(t('study.copy34'));
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
      toast.info(res?.message || t('study.copy35'));
    }
  } catch (_e) {
    logger.error('[FSRSOptimizer] FSRS优化执行失败', _e);
    toast.info(t('study.copy36'));
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
