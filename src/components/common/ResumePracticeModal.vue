<template>
  <view v-if="visible" class="resume-modal-mask" @tap="handleMaskClick">
    <view class="resume-modal-content" @tap.stop>
      <!-- 头部 -->
      <view class="modal-header">
        <view class="header-icon">
          <text class="icon-emoji">
            {{ iconEmoji }}
          </text>
        </view>
        <text class="header-title">
          {{ title }}
        </text>
      </view>

      <!-- 草稿信息 -->
      <view v-if="draftInfo" class="draft-info">
        <view class="info-row">
          <text class="info-label">
            上次进度
          </text>
          <text class="info-value">
            第 {{ draftInfo.currentIndex + 1 }} 题
          </text>
        </view>
        <view class="info-row">
          <text class="info-label">
            已答题数
          </text>
          <text class="info-value">
            {{ draftInfo.answeredCount }} 道
          </text>
        </view>
        <view class="info-row">
          <text class="info-label">
            用时
          </text>
          <text class="info-value">
            {{ draftInfo.formattedTime }}
          </text>
        </view>
        <view class="info-row">
          <text class="info-label">
            保存时间
          </text>
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

<script>
export default {
  name: 'ResumePracticeModal',
  props: {
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
  },
  emits: ['resume', 'restart'],
  computed: {
    title() {
      const titles = {
        quiz: '检测到未完成的练习',
        pk: '检测到未完成的对战',
        import: '检测到未完成的导入'
      };
      return titles[this.type] || titles.quiz;
    },
    iconEmoji() {
      const icons = {
        quiz: '📝',
        pk: '⚔️',
        import: '📥'
      };
      return icons[this.type] || icons.quiz;
    },
    tipText() {
      const tips = {
        quiz: '是否继续上次的练习？重新开始将清除之前的进度。',
        pk: '是否继续上次的对战？',
        import: '是否继续上次的导入任务？'
      };
      return tips[this.type] || tips.quiz;
    }
  },
  methods: {
    handleMaskClick() {
      // 点击遮罩不关闭，强制用户做出选择
    },
    handleResume() {
      this.$emit('resume', this.draftInfo);
    },
    handleRestart() {
      this.$emit('restart');
    }
  }
};
</script>

<style lang="scss" scoped>
.resume-modal-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  padding: 40rpx;
}

.resume-modal-content {
  width: 100%;
  max-width: 600rpx;
  background: var(--bg-card, #ffffff);
  border-radius: 32rpx;
  padding: 48rpx 40rpx;
  box-shadow: 0 20rpx 60rpx rgba(0, 0, 0, 0.15);
  animation: modalSlideUp 0.3s ease-out;
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
  background: var(--primary-light, #e8f4fd);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 20rpx;
}

.icon-emoji {
  font-size: 48rpx;
}

.header-title {
  font-size: 36rpx;
  font-weight: 700;
  color: var(--text-primary, #1a1a1a);
}

.draft-info {
  background: var(--bg-secondary, #f5f5f5);
  border-radius: 20rpx;
  padding: 24rpx;
  margin-bottom: 24rpx;
}

.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12rpx 0;
}

.info-row:not(:last-child) {
  border-bottom: 1px solid var(--border, #eee);
}

.info-label {
  font-size: 28rpx;
  color: var(--text-secondary, #666);
}

.info-value {
  font-size: 28rpx;
  font-weight: 600;
  color: var(--text-primary, #1a1a1a);
}

.info-value.time-ago {
  color: var(--primary, #007aff);
}

.modal-tip {
  text-align: center;
  margin-bottom: 32rpx;
}

.modal-tip-text {
	font-size: 26rpx;
	color: var(--text-secondary, #666);
	line-height: 1.6;
}

.modal-actions {
  display: flex;
  gap: 20rpx;
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

.btn-secondary {
  background: var(--bg-secondary, #f5f5f5);
  color: var(--text-secondary, #666);
}

.btn-secondary:active {
  background: var(--bg-tertiary, #e5e5e5);
}

.btn-primary {
  background: var(--primary, #007aff);
  color: #ffffff;
}

.btn-primary:active {
  background: var(--primary-dark, #0056b3);
  transform: scale(0.98);
}

/* 暗色模式适配 */
.dark-mode .resume-modal-content {
  background: var(--bg-card-dark, #1c1c1e);
}

.dark-mode .header-icon {
  background: rgba(0, 122, 255, 0.2);
}

.dark-mode .header-title {
  color: var(--text-primary-dark, #ffffff);
}

.dark-mode .draft-info {
  background: var(--bg-secondary-dark, #2c2c2e);
}

.dark-mode .info-row:not(:last-child) {
  border-bottom-color: var(--border-dark, #3a3a3c);
}

.dark-mode .info-label {
  color: var(--text-secondary-dark, #8e8e93);
}

.dark-mode .info-value {
  color: var(--text-primary-dark, #ffffff);
}

.dark-mode .modal-tip-text {
	color: var(--text-secondary-dark, #8e8e93);
}

.dark-mode .btn-secondary {
  background: var(--bg-secondary-dark, #2c2c2e);
  color: var(--text-secondary-dark, #8e8e93);
}
</style>
