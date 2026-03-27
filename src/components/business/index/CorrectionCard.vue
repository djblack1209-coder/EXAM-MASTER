<template>
  <view v-if="corrections.length > 0" class="correction-section">
    <view v-for="(item, index) in corrections" :key="index" class="correction-card">
      <view class="correction-header">
        <BaseIcon name="brain" :size="36" />
        <view class="correction-title-wrap">
          <text class="correction-label">AI 深度诊断</text>
          <text class="correction-kp">{{ item.knowledge_point || item.knowledgePoint }}</text>
        </view>
      </view>

      <view class="correction-body">
        <view class="root-cause">
          <text class="cause-label">错因分析</text>
          <text class="cause-text">{{ item.rootCause || item.root_cause }}</text>
        </view>
        <view class="correction-advice">
          <text class="advice-label">矫正建议</text>
          <text class="advice-text">{{ item.correction }}</text>
        </view>
      </view>

      <view class="correction-actions">
        <view class="btn-correction-start" @tap="startCorrection(item)">
          <BaseIcon name="target" :size="28" />
          <text>开始矫正练习</text>
        </view>
        <text class="btn-dismiss" @tap="dismiss(item)">稍后再看</text>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import BaseIcon from '@/components/base/base-icon/base-icon.vue';
import { lafService } from '@/services/lafService.js';
import { safeNavigateTo } from '@/utils/safe-navigate';
import { logger } from '@/utils/logger.js';

const corrections = ref([]);

async function loadCorrections() {
  try {
    const res = await lafService.request('/smart-study-engine', {
      action: 'get_pending_corrections'
    });
    if (res?.success && res.data?.corrections) {
      corrections.value = res.data.corrections;
    }
  } catch (e) {
    logger.warn('[CorrectionCard] 加载矫正数据失败:', e?.message);
  }
}

function startCorrection(item) {
  // Navigate to do-quiz with correction mode, passing the similar question IDs
  const questionIds = (item.similarQuestions || item.similar_questions || [])
    .map((q) => q.questionId || q.question_id)
    .filter(Boolean)
    .join(',');

  const kp = item.knowledge_point || item.knowledgePoint || '';

  safeNavigateTo(
    `/pages/practice-sub/do-quiz?mode=correction&knowledgePoint=${encodeURIComponent(kp)}&questionIds=${encodeURIComponent(questionIds)}`
  );

  // Mark as read
  dismiss(item);
}

async function dismiss(item) {
  const id = item._id;
  if (id) {
    try {
      await lafService.request('/smart-study-engine', {
        action: 'mark_correction_read',
        correctionId: id
      });
    } catch {
      /* silent */
    }
  }
  corrections.value = corrections.value.filter((c) => c._id !== id);
}

onMounted(() => {
  loadCorrections();
});

// Expose reload for parent to call on refresh
defineExpose({ reload: loadCorrections });
</script>

<style lang="scss" scoped>
/* ==================== Deep Correction Card ==================== */
.correction-section {
  margin: 20rpx 30rpx;
  display: flex;
  flex-direction: column;
  /* gap: 20rpx; -- replaced for MP WebView compat */
}

.correction-card {
  background: var(--card, #eaf9d5);
  background: linear-gradient(135deg, var(--card, #eaf9d5) 0%, rgba(255, 237, 213, 0.85) 100%);
  border-radius: var(--radius-lg, 24rpx);
  border-left: 8rpx solid #f59e0b;
  padding: 32rpx 28rpx;
  box-shadow:
    0 4rpx 20rpx rgba(245, 158, 11, 0.12),
    0 1rpx 4rpx rgba(0, 0, 0, 0.04);
  position: relative;
  overflow: hidden;
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease;
}

.correction-card::before {
  content: '';
  position: absolute;
  top: -40rpx;
  right: -40rpx;
  width: 160rpx;
  height: 160rpx;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(245, 158, 11, 0.1) 0%, transparent 70%);
  pointer-events: none;
}

.correction-card:active {
  transform: scale(0.99);
}

/* Dark mode */
.page-dark .correction-card,
.dark .correction-card {
  background: linear-gradient(135deg, rgba(45, 35, 20, 0.9) 0%, rgba(55, 40, 25, 0.85) 100%);
  border-left-color: #d97706;
  box-shadow:
    0 4rpx 20rpx rgba(0, 0, 0, 0.25),
    0 1rpx 4rpx rgba(0, 0, 0, 0.15);
}

.page-dark .correction-card::before,
.dark .correction-card::before {
  background: radial-gradient(circle, rgba(245, 158, 11, 0.06) 0%, transparent 70%);
}

/* Header */
.correction-header {
  display: flex;
  align-items: center;
  /* gap: 16rpx; -- replaced for MP WebView compat */
  margin-bottom: 24rpx;
}

.correction-title-wrap {
  display: flex;
  flex-direction: column;
  /* gap: 4rpx; -- replaced for MP WebView compat */
}

.correction-label {
  font-size: 22rpx;
  font-weight: 600;
  color: #b45309;
  letter-spacing: 1rpx;
  text-transform: uppercase;
}

.page-dark .correction-label,
.dark .correction-label {
  color: #fbbf24;
}

.correction-kp {
  font-size: 32rpx;
  font-weight: 700;
  color: var(--text-primary, #1a1a1a);
  line-height: 1.3;
}

/* Body */
.correction-body {
  display: flex;
  flex-direction: column;
  /* gap: 20rpx; -- replaced for MP WebView compat */
  margin-bottom: 28rpx;
}

.root-cause,
.correction-advice {
  display: flex;
  flex-direction: column;
  /* gap: 8rpx; -- replaced for MP WebView compat */
}

.cause-label,
.advice-label {
  font-size: 22rpx;
  font-weight: 600;
  color: #92400e;
  padding: 2rpx 14rpx;
  background: rgba(245, 158, 11, 0.12);
  border-radius: 8rpx;
  align-self: flex-start;
}

.page-dark .cause-label,
.page-dark .advice-label,
.dark .cause-label,
.dark .advice-label {
  color: #fbbf24;
  background: rgba(245, 158, 11, 0.15);
}

.cause-text {
  font-size: 28rpx;
  font-weight: 500;
  color: var(--text-primary, #374151);
  line-height: 1.6;
}

.advice-text {
  font-size: 26rpx;
  color: var(--text-secondary, #6b7280);
  line-height: 1.7;
}

/* Actions */
.correction-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  /* gap: 20rpx; -- replaced for MP WebView compat */
}

.btn-correction-start {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  /* gap: 10rpx; -- replaced for MP WebView compat */
  padding: 22rpx 0;
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
  color: #fff;
  font-size: 28rpx;
  font-weight: 700;
  border-radius: 16rpx;
  box-shadow: 0 4rpx 16rpx rgba(245, 158, 11, 0.35);
  transition: all 0.2s ease;
}

.btn-correction-start:active {
  transform: scale(0.96);
  opacity: 0.9;
}

.page-dark .btn-correction-start,
.dark .btn-correction-start {
  background: linear-gradient(135deg, #d97706 0%, #b45309 100%);
  box-shadow: 0 4rpx 16rpx rgba(217, 119, 6, 0.3);
}

.btn-dismiss {
  font-size: 26rpx;
  color: var(--text-tertiary, #9ca3af);
  padding: 10rpx 20rpx;
  flex-shrink: 0;
}

.btn-dismiss:active {
  opacity: 0.6;
}
</style>
