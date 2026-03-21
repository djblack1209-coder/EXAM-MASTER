<template>
  <view v-if="visible" class="custom-modal-mask" @tap="handleMaskClick">
    <view class="custom-modal-container apple-glass-card" :class="[type, { dark: isDark }]" @tap.stop>
      <view class="modal-handle" />
      <!-- 装饰气泡 -->
      <view v-if="isDark" class="decoration-bubble bubble-1" />
      <view v-if="isDark" class="decoration-bubble bubble-2" />

      <!-- 图标区域 -->
      <view class="modal-icon-wrapper" :class="type">
        <BaseIcon :name="iconMap[type] || icon || 'info'" :size="48" />
      </view>

      <!-- 标题 -->
      <text class="modal-title">
        {{ title }}
      </text>

      <!-- 内容 -->
      <text class="modal-content">
        {{ content }}
      </text>

      <!-- 按钮区域 -->
      <view class="modal-buttons" :class="{ single: !showCancel }">
        <view v-if="showCancel" class="modal-btn cancel-btn apple-glass-pill" @tap="handleCancel">
          <text>{{ cancelText }}</text>
        </view>
        <view class="modal-btn confirm-btn apple-cta" :class="type" @tap="handleConfirm">
          <text>{{ confirmText }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import { logger } from '@/utils/logger.js';
import BaseIcon from '@/components/base/base-icon/base-icon.vue';
/**
 * 自定义弹窗组件
 * ✅ PM要求：替换原生弹窗，消除"塑料感"
 *
 * 使用方式：
 * <custom-modal
 *   :visible="showModal"
 *   type="info"
 *   title="提示"
 *   content="这是一条提示信息"
 *   @confirm="handleConfirm"
 *   @cancel="handleCancel"
 * />
 */
export default {
  name: 'CustomModal',
  components: { BaseIcon },

  props: {
    // 是否显示
    visible: {
      type: Boolean,
      default: false
    },
    // 弹窗类型：info, success, warning, error
    type: {
      type: String,
      default: 'info'
    },
    // 自定义图标
    icon: {
      type: String,
      default: ''
    },
    // 标题
    title: {
      type: String,
      default: '提示'
    },
    // 内容
    content: {
      type: String,
      default: ''
    },
    // 确认按钮文字
    confirmText: {
      type: String,
      default: '确定'
    },
    // 取消按钮文字
    cancelText: {
      type: String,
      default: '取消'
    },
    // 是否显示取消按钮
    showCancel: {
      type: Boolean,
      default: true
    },
    // 点击遮罩是否关闭
    maskClosable: {
      type: Boolean,
      default: false
    },
    // 深色模式
    isDark: {
      type: Boolean,
      default: false
    }
  },

  emits: ['cancel', 'update:visible', 'confirm'],

  data() {
    return {
      iconMap: {
        info: 'bulb',
        success: 'success',
        warning: 'warning',
        error: 'error',
        question: 'question',
        empty: 'empty',
        upload: 'upload',
        study: 'books'
      }
    };
  },

  methods: {
    handleMaskClick() {
      if (this.maskClosable) {
        this.$emit('cancel');
        this.$emit('update:visible', false);
      }
    },

    handleConfirm() {
      // 震动反馈
      try {
        if (typeof uni.vibrateShort === 'function') {
          uni.vibrateShort();
        }
      } catch (e) {
        logger.warn('[CustomModal] 震动反馈失败:', e.message || e);
      }

      this.$emit('confirm');
      this.$emit('update:visible', false);
    },

    handleCancel() {
      this.$emit('cancel');
      this.$emit('update:visible', false);
    }
  }
};
</script>

<style lang="scss" scoped>
.custom-modal-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(9, 18, 12, 0.32);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.custom-modal-container {
  width: 600rpx;
  background:
    linear-gradient(180deg, var(--apple-specular-soft) 0%, transparent 42%),
    linear-gradient(160deg, var(--apple-glass-card-bg) 0%, var(--apple-group-bg) 100%);
  border: 1px solid var(--apple-glass-border-strong);
  border-radius: 36rpx;
  padding: 18rpx 40rpx 40rpx;
  position: relative;
  overflow: hidden;
  animation: slideUp 0.3s ease;
  box-shadow: var(--apple-shadow-floating);

  &.dark {
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.08) 0%, transparent 42%),
      linear-gradient(160deg, rgba(18, 20, 28, 0.94) 0%, rgba(10, 12, 18, 0.9) 100%);
    border: 1px solid rgba(255, 255, 255, 0.1);
    box-shadow: var(--apple-shadow-floating);
  }
}

.modal-handle {
  width: 84rpx;
  height: 8rpx;
  border-radius: 999rpx;
  background: rgba(0, 0, 0, 0.12);
  margin: 6rpx auto 22rpx;
}

.dark .modal-handle {
  background: rgba(255, 255, 255, 0.16);
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(40rpx) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

// 装饰气泡
.decoration-bubble {
  position: absolute;
  border-radius: 50%;
  opacity: 0.3;
  pointer-events: none;

  &.bubble-1 {
    width: 120rpx;
    height: 120rpx;
    background: radial-gradient(circle, rgba(95, 170, 255, 0.28) 0%, transparent 70%);
    top: -30rpx;
    right: -30rpx;
  }

  &.bubble-2 {
    width: 80rpx;
    height: 80rpx;
    background: radial-gradient(circle, rgba(107, 208, 150, 0.22) 0%, transparent 70%);
    bottom: 40rpx;
    left: -20rpx;
  }
}

// 图标区域
.modal-icon-wrapper {
  width: 100rpx;
  height: 100rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 24rpx;

  &.info {
    background: rgba(52, 199, 89, 0.12);
  }
  &.success {
    background: rgba(52, 199, 89, 0.12);
  }
  &.warning {
    background: rgba(255, 159, 10, 0.14);
  }
  &.error {
    background: rgba(255, 99, 90, 0.14);
  }
  &.empty,
  &.upload,
  &.study {
    background: rgba(52, 199, 89, 0.12);
  }

  .dark &,
  .dark-mode & {
    &.info {
      background: rgba(10, 132, 255, 0.14);
    }
    &.success {
      background: rgba(10, 132, 255, 0.14);
    }
    &.warning {
      background: rgba(255, 159, 10, 0.16);
    }
    &.error {
      background: rgba(255, 99, 90, 0.16);
    }
    &.empty,
    &.upload,
    &.study {
      background: rgba(10, 132, 255, 0.14);
    }
  }

  .modal-icon {
    font-size: 48rpx;
  }
}

// 标题
.modal-title {
  display: block;
  text-align: center;
  font-size: 36rpx;
  font-weight: 600;
  color: var(--text-main);
  margin-bottom: 16rpx;

  .dark &,
  .dark-mode & {
    color: #ffffff;
  }
}

// 内容
.modal-content {
  display: block;
  text-align: center;
  font-size: 28rpx;
  color: var(--text-sub);
  line-height: 1.6;
  margin-bottom: 40rpx;
  white-space: pre-wrap;

  .dark &,
  .dark-mode & {
    color: rgba(255, 255, 255, 0.7);
  }
}

// 按钮区域
.modal-buttons {
  display: flex;
  /* gap: 20rpx; -- removed tag-name selectors for WeChat component compat */

  &.single {
    justify-content: center;
  }
}

.modal-btn {
  flex: 1;
  height: 88rpx;
  border-radius: 44rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 30rpx;
  font-weight: 600;
  transition: all 0.2s ease;

  &:active {
    transform: scale(0.95);
  }
}

.cancel-btn {
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.28) 0%, transparent 42%),
    linear-gradient(160deg, rgba(255, 255, 255, 0.74) 0%, rgba(241, 248, 243, 0.52) 100%);
  color: var(--text-main);
  border: 1rpx solid rgba(255, 255, 255, 0.46);
  box-shadow: var(--apple-shadow-surface);

  .dark &,
  .dark-mode & {
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.08) 0%, transparent 42%),
      linear-gradient(160deg, rgba(18, 20, 28, 0.94) 0%, rgba(10, 12, 18, 0.9) 100%);
    color: rgba(255, 255, 255, 0.8);
    border-color: rgba(255, 255, 255, 0.1);
  }
}

.confirm-btn {
  background: var(--cta-primary-bg);
  color: var(--cta-primary-text);
  border: 1rpx solid var(--cta-primary-border);
  box-shadow: var(--cta-primary-shadow);

  &.warning {
    background: rgba(255, 159, 10, 0.14);
    color: #b56a00;
    border-color: rgba(255, 159, 10, 0.18);
    box-shadow: var(--apple-shadow-surface);
  }

  &.error {
    background: rgba(255, 99, 90, 0.14);
    color: #c53d35;
    border-color: rgba(255, 99, 90, 0.18);
    box-shadow: var(--apple-shadow-surface);
  }
}

.custom-modal-container.dark .confirm-btn.warning {
  background: rgba(255, 159, 10, 0.16);
  color: #ffd29a;
}

.custom-modal-container.dark .confirm-btn.error {
  background: rgba(255, 99, 90, 0.16);
  color: #ffb1ab;
}

.single .confirm-btn {
  max-width: 400rpx;
}
</style>
