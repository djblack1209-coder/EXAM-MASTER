<template>
  <view class="custom-modal-mask" v-if="visible" @tap="handleMaskClick">
    <view class="custom-modal-container" :class="[type, { 'dark': isDark }]" @tap.stop>
      <!-- 装饰气泡 -->
      <view v-if="isDark" class="decoration-bubble bubble-1"></view>
      <view v-if="isDark" class="decoration-bubble bubble-2"></view>
      
      <!-- 图标区域 -->
      <view class="modal-icon-wrapper" :class="type">
        <text class="modal-icon">{{ iconMap[type] || icon }}</text>
      </view>
      
      <!-- 标题 -->
      <text class="modal-title">{{ title }}</text>
      
      <!-- 内容 -->
      <text class="modal-content">{{ content }}</text>
      
      <!-- 按钮区域 -->
      <view class="modal-buttons" :class="{ 'single': !showCancel }">
        <view 
          v-if="showCancel" 
          class="modal-btn cancel-btn" 
          @tap="handleCancel"
        >
          <text>{{ cancelText }}</text>
        </view>
        <view 
          class="modal-btn confirm-btn" 
          :class="type"
          @tap="handleConfirm"
        >
          <text>{{ confirmText }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
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
  
  data() {
    return {
      iconMap: {
        info: '💡',
        success: '✅',
        warning: '⚠️',
        error: '❌',
        question: '❓',
        empty: '📭',
        upload: '📤',
        study: '📚'
      }
    }
  },
  
  methods: {
    handleMaskClick() {
      if (this.maskClosable) {
        this.$emit('cancel')
        this.$emit('update:visible', false)
      }
    },
    
    handleConfirm() {
      // 震动反馈
      try {
        if (typeof uni.vibrateShort === 'function') {
          uni.vibrateShort()
        }
      } catch (e) {}
      
      this.$emit('confirm')
      this.$emit('update:visible', false)
    },
    
    handleCancel() {
      this.$emit('cancel')
      this.$emit('update:visible', false)
    }
  }
}
</script>

<style lang="scss" scoped>
.custom-modal-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.custom-modal-container {
  width: 600rpx;
  background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
  border-radius: 32rpx;
  padding: 48rpx 40rpx;
  position: relative;
  overflow: hidden;
  animation: slideUp 0.3s ease;
  box-shadow: 0 20rpx 60rpx rgba(0, 0, 0, 0.15);
  
  &.dark {
    background: linear-gradient(135deg, rgba(40, 40, 40, 0.95) 0%, rgba(30, 30, 30, 0.98) 100%);
    border: 1px solid rgba(255, 255, 255, 0.1);
    box-shadow: 0 20rpx 60rpx rgba(0, 0, 0, 0.4), 0 0 40rpx rgba(0, 229, 255, 0.1);
  }
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
    background: radial-gradient(circle, #00E5FF 0%, transparent 70%);
    top: -30rpx;
    right: -30rpx;
  }
  
  &.bubble-2 {
    width: 80rpx;
    height: 80rpx;
    background: radial-gradient(circle, #9FE870 0%, transparent 70%);
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
    background: linear-gradient(135deg, #E3F2FD 0%, #BBDEFB 100%);
  }
  &.success {
    background: linear-gradient(135deg, #E8F5E9 0%, #C8E6C9 100%);
  }
  &.warning {
    background: linear-gradient(135deg, #FFF3E0 0%, #FFE0B2 100%);
  }
  &.error {
    background: linear-gradient(135deg, #FFEBEE 0%, #FFCDD2 100%);
  }
  &.empty, &.upload, &.study {
    background: linear-gradient(135deg, #F3E5F5 0%, #E1BEE7 100%);
  }
  
  .dark & {
    &.info { background: linear-gradient(135deg, rgba(0, 229, 255, 0.2) 0%, rgba(0, 229, 255, 0.1) 100%); }
    &.success { background: linear-gradient(135deg, rgba(159, 232, 112, 0.2) 0%, rgba(159, 232, 112, 0.1) 100%); }
    &.warning { background: linear-gradient(135deg, rgba(255, 193, 7, 0.2) 0%, rgba(255, 193, 7, 0.1) 100%); }
    &.error { background: linear-gradient(135deg, rgba(244, 67, 54, 0.2) 0%, rgba(244, 67, 54, 0.1) 100%); }
    &.empty, &.upload, &.study { background: linear-gradient(135deg, rgba(156, 39, 176, 0.2) 0%, rgba(156, 39, 176, 0.1) 100%); }
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
  color: #1a1a1a;
  margin-bottom: 16rpx;
  
  .dark & {
    color: #ffffff;
  }
}

// 内容
.modal-content {
  display: block;
  text-align: center;
  font-size: 28rpx;
  color: var(--ds-color-text-secondary);
  line-height: 1.6;
  margin-bottom: 40rpx;
  white-space: pre-wrap;
  
  .dark & {
    color: rgba(255, 255, 255, 0.7);
  }
}

// 按钮区域
.modal-buttons {
  display: flex;
  gap: 20rpx;
  
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
  background: #f5f5f5;
  color: var(--ds-color-text-secondary);
  
  .dark & {
    background: rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.7);
  }
}

.confirm-btn {
  background: linear-gradient(135deg, #00a96d 0%, #008055 100%);
  color: #ffffff;
  box-shadow: 0 4rpx 16rpx rgba(0, 169, 109, 0.3);
  
  &.warning {
    background: linear-gradient(135deg, #FF9800 0%, #F57C00 100%);
    box-shadow: 0 4rpx 16rpx rgba(255, 152, 0, 0.3);
  }
  
  &.error {
    background: linear-gradient(135deg, #F44336 0%, #D32F2F 100%);
    box-shadow: 0 4rpx 16rpx rgba(244, 67, 54, 0.3);
  }
  
  .dark & {
    background: linear-gradient(135deg, #00E5FF 0%, #00B8D4 100%);
    color: #000000;
    box-shadow: 0 4rpx 16rpx rgba(0, 229, 255, 0.3);
    
    &.warning {
      background: linear-gradient(135deg, #FFB74D 0%, #FFA726 100%);
    }
    
    &.error {
      background: linear-gradient(135deg, #EF5350 0%, #E53935 100%);
      color: #ffffff;
    }
  }
}

.single .confirm-btn {
  max-width: 400rpx;
}
</style>
