<template>
  <view v-if="visible" class="resume-modal-mask" @tap="handleMaskClick">
    <view class="resume-modal-content" @tap.stop>
      <view class="resume-sheet-handle" />
      <text class="modal-eyebrow"> Continue Session </text>
      <!-- 头部 -->
      <view class="modal-header">
        <view class="header-icon">
          <BaseIcon :name="iconName" :size="24" />
        </view>
        <text class="header-title">
          {{ title }}
        </text>
      </view>

      <!-- 草稿信息 -->
      <view v-if="draftInfo" class="draft-info">
        <view class="info-row">
          <text class="info-label"> 上次进度 </text>
          <text class="info-value"> 第 {{ draftInfo.currentIndex + 1 }} 题 </text>
        </view>
        <view class="info-row">
          <text class="info-label"> 已答题数 </text>
          <text class="info-value"> {{ draftInfo.answeredCount }} 道 </text>
        </view>
        <view class="info-row">
          <text class="info-label"> 用时 </text>
          <text class="info-value">
            {{ draftInfo.formattedTime }}
          </text>
        </view>
        <view class="info-row">
          <text class="info-label"> 保存时间 </text>
          <text class="info-value time-ago">
            {{ draftInfo.timeAgo }}
          </text>
        </view>
      </view>

      <!-- 提示文字 -->
      <view class="modal-tip">
        <text class="modal-tip-text">
          {{ tipText }}
        </text>
      </view>

      <!-- 操作按钮 -->
      <view class="modal-actions">
        <button class="btn-secondary" @tap="handleRestart">
          <text>重新开始</text>
        </button>
        <button class="btn-primary" @tap="handleResume">
          <text>继续答题</text>
        </button>
      </view>
    </view>
  </view>
</template>

<script setup>
import { computed } from 'vue';
import BaseIcon from '@/components/base/base-icon/base-icon.vue';

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  draftInfo: {
    type: Object,
    default: null
  },
  type: {
    type: String,
    default: 'quiz' // quiz, pk, import
  }
});

const emit = defineEmits(['resume', 'restart', 'close']);

const title = computed(() => {
  const titles = {
    quiz: '检测到未完成的练习',
    pk: '检测到未完成的对战',
    import: '检测到未完成的导入'
  };
  return titles[props.type] || titles.quiz;
});

const iconName = computed(() => {
  const icons = {
    quiz: 'note',
    pk: 'sword',
    import: 'download'
  };
  return icons[props.type] || icons.quiz;
});

const tipText = computed(() => {
  const tips = {
    quiz: '是否继续上次的练习？重新开始将清除之前的进度。',
    pk: '是否继续上次的对战？',
    import: '是否继续上次的导入任务？'
  };
  return tips[props.type] || tips.quiz;
});

function handleMaskClick() {
  emit('close');
}

function handleResume() {
  emit('resume', props.draftInfo);
}

function handleRestart() {
  emit('restart');
}
</script>

<style lang="scss" scoped>
.resume-modal-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(9, 18, 12, 0.32);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  z-index: 9999;
  padding: 40rpx 24rpx calc(24rpx + env(safe-area-inset-bottom, 0px));
}

.resume-modal-content {
  width: 100%;
  max-width: 700rpx;
  background:
    linear-gradient(180deg, var(--apple-specular-soft) 0%, transparent 42%),
    linear-gradient(160deg, var(--apple-glass-card-bg) 0%, var(--apple-group-bg) 100%);
  border: 1px solid var(--apple-glass-border-strong);
  border-radius: 36rpx 36rpx 28rpx 28rpx;
  padding: 18rpx 28rpx 30rpx;
  box-shadow: var(--apple-shadow-card);
  animation: modalSlideUp 0.3s ease-out;
}

.resume-sheet-handle {
  width: 84rpx;
  height: 8rpx;
  border-radius: 999rpx;
  background: rgba(0, 0, 0, 0.12);
  margin: 6rpx auto 16rpx;
}

.modal-eyebrow {
  display: block;
  text-align: center;
  margin-bottom: 16rpx;
  font-size: 20rpx;
  letter-spacing: 3rpx;
  text-transform: uppercase;
  color: var(--text-sub);
}

@keyframes modalSlideUp {
  from {
    opacity: 0;
    transform: translateY(40rpx);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.modal-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 32rpx;
}

.header-icon {
  width: 100rpx;
  height: 100rpx;
  background: color-mix(in srgb, var(--success) 12%, transparent);
  border: 1px solid color-mix(in srgb, var(--success) 18%, transparent);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 20rpx;
  box-shadow: var(--apple-shadow-surface);
}

.icon-emoji {
  font-size: 48rpx;
}

.header-title {
  font-size: 36rpx;
  font-weight: 700;
  color: var(--text-main);
}

.draft-info {
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.28) 0%, transparent 42%),
    linear-gradient(160deg, rgba(255, 255, 255, 0.74) 0%, rgba(241, 248, 243, 0.52) 100%);
  border: 1px solid rgba(255, 255, 255, 0.46);
  border-radius: 24rpx;
  padding: 24rpx;
  margin-bottom: 24rpx;
  box-shadow: var(--apple-shadow-surface);
}

.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12rpx 0;
}

.info-row:not(:last-child) {
  border-bottom: 1px solid var(--apple-divider);
}

.info-label {
  font-size: 28rpx;
  color: var(--text-sub);
}

.info-value {
  font-size: 28rpx;
  font-weight: 600;
  color: var(--text-main);
}

.info-value.time-ago {
  color: var(--success-dark);
}

.modal-tip {
  text-align: center;
  margin-bottom: 32rpx;
}

.modal-tip-text {
  font-size: 26rpx;
  color: var(--text-sub);
  line-height: 1.6;
}

.modal-actions {
  display: flex;
  /* gap: 20rpx; -- replaced for Android WebView compat */
}

.btn-secondary,
.btn-primary {
  flex: 1;
  height: 88rpx;
  border-radius: 44rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 30rpx;
  font-weight: 600;
  border: none;
  transition: all 0.2s;
}

.btn-secondary::after,
.btn-primary::after {
  border: none;
}

.btn-secondary {
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.28) 0%, transparent 42%),
    linear-gradient(160deg, rgba(255, 255, 255, 0.74) 0%, rgba(241, 248, 243, 0.52) 100%);
  color: var(--text-main);
  border: 1px solid rgba(255, 255, 255, 0.46);
  box-shadow: var(--apple-shadow-surface);
}

.btn-secondary:active {
  transform: scale(0.98);
}

.btn-primary {
  background: var(--cta-primary-bg);
  color: var(--cta-primary-text);
  border: 1rpx solid var(--cta-primary-border);
  box-shadow: var(--cta-primary-shadow);
}

.btn-primary:active {
  opacity: 0.9;
  transform: scale(0.98);
}

/* 暗色模式适配 */
.dark-mode .resume-modal-mask {
  background: rgba(3, 8, 14, 0.52);
}

.dark-mode .resume-modal-content {
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.08) 0%, transparent 42%),
    linear-gradient(160deg, rgba(18, 20, 28, 0.94) 0%, rgba(10, 12, 18, 0.9) 100%);
  border-color: rgba(255, 255, 255, 0.1);
}

.dark-mode .resume-sheet-handle {
  background: rgba(255, 255, 255, 0.16);
}

.dark-mode .modal-eyebrow,
.dark-mode .modal-tip-text,
.dark-mode .info-label {
  color: rgba(255, 255, 255, 0.68);
}

.dark-mode .header-icon {
  background: rgba(10, 132, 255, 0.14);
  border-color: rgba(10, 132, 255, 0.18);
}

.dark-mode .header-title {
  color: var(--text-inverse);
}

.dark-mode .draft-info {
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.08) 0%, transparent 42%),
    linear-gradient(160deg, rgba(18, 20, 28, 0.94) 0%, rgba(10, 12, 18, 0.9) 100%);
  border-color: rgba(255, 255, 255, 0.1);
}

.dark-mode .info-row:not(:last-child) {
  border-bottom-color: rgba(255, 255, 255, 0.1);
}

.dark-mode .info-value {
  color: var(--text-inverse);
}

.dark-mode .btn-secondary {
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.08) 0%, transparent 42%),
    linear-gradient(160deg, rgba(18, 20, 28, 0.94) 0%, rgba(10, 12, 18, 0.9) 100%);
  color: var(--text-inverse);
  border-color: rgba(255, 255, 255, 0.1);
}

.dark-mode .info-value.time-ago {
  color: var(--info-blue);
}
</style>
