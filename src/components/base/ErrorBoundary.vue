<!--
  错误边界组件 - Vue 3 Error Boundary
  用于捕获子组件的渲染错误，防止整个页面崩溃
  
  使用方式：
  <ErrorBoundary>
    <YourComponent />
  </ErrorBoundary>
-->
<template>
  <view v-if="hasError" class="error-boundary" :class="{ 'dark-mode': isDark }">
    <view class="error-content">
      <text class="error-icon">{{ errorIcon }}</text>
      <text class="error-title">{{ errorTitle }}</text>
      <text class="error-message">{{ errorMessage }}</text>
      <button class="retry-btn ds-touchable" @tap="handleRetry">
        <text class="retry-text">{{ retryText }}</text>
      </button>
    </view>
  </view>
  <slot v-else></slot>
</template>

<script>
import { logger } from '@/utils/logger.js'

export default {
  name: 'ErrorBoundary',
  props: {
    // 自定义错误图标
    icon: {
      type: String,
      default: '😵'
    },
    // 自定义错误标题
    title: {
      type: String,
      default: '页面加载出错了'
    },
    // 自定义错误消息
    message: {
      type: String,
      default: '请点击重试按钮刷新页面'
    },
    // 重试按钮文字
    retry: {
      type: String,
      default: '点击重试'
    },
    // 是否在控制台输出错误
    logError: {
      type: Boolean,
      default: true
    }
  },
  data() {
    return {
      hasError: false,
      error: null,
      errorInfo: null,
      isDark: false
    }
  },
  computed: {
    errorIcon() {
      return this.icon
    },
    errorTitle() {
      return this.title
    },
    errorMessage() {
      return this.message
    },
    retryText() {
      return this.retry
    }
  },
  created() {
    this.isDark = uni.getStorageSync('theme_mode') === 'dark'
    
    // 监听主题变化
    uni.$on('themeUpdate', (theme) => {
      this.isDark = theme === 'dark'
    })
  },
  // Vue 3 错误捕获钩子
  errorCaptured(err, instance, info) {
    this.hasError = true
    this.error = err
    this.errorInfo = info
    
    if (this.logError) {
      logger.error('[ErrorBoundary] 捕获到组件错误:', {
        message: err?.message,
        stack: err?.stack,
        info: info,
        component: instance?.$options?.name || 'Unknown'
      })
    }
    
    // 触发错误事件，供父组件监听
    this.$emit('error', { error: err, info: info })
    
    // 返回 false 阻止错误继续向上传播
    return false
  },
  methods: {
    handleRetry() {
      // 重置错误状态
      this.hasError = false
      this.error = null
      this.errorInfo = null
      
      // 触发重试事件
      this.$emit('retry')
      
      // 强制重新渲染子组件
      this.$forceUpdate()
    },
    // 手动触发错误状态（用于测试）
    triggerError(error) {
      this.hasError = true
      this.error = error
    },
    // 手动重置错误状态
    reset() {
      this.hasError = false
      this.error = null
      this.errorInfo = null
    }
  },
  beforeUnmount() {
    uni.$off('themeUpdate')
  }
}
</script>

<style lang="scss" scoped>
.error-boundary {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 300rpx;
  padding: 48rpx;
  background-color: var(--bg-card, #FFFFFF);
  border-radius: 24rpx;
  margin: 24rpx;
}

.dark-mode.error-boundary {
  background-color: var(--bg-glass, #1C1C1E);
}

.error-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.error-icon {
  font-size: 120rpx;
  margin-bottom: 24rpx;
  opacity: 0.8;
}

.error-title {
  font-size: 32rpx;
  font-weight: 600;
  color: var(--text-main, var(--ds-color-text-primary, #111111));
  margin-bottom: 16rpx;
}

.dark-mode .error-title {
  color: var(--text-main, var(--ds-color-text-primary, #FFFFFF));
}

.error-message {
  font-size: 26rpx;
  color: var(--text-sub, var(--ds-color-text-secondary, #666666));
  margin-bottom: 32rpx;
  line-height: 1.5;
}

.dark-mode .error-message {
  color: var(--text-sub, var(--ds-color-text-secondary, #A0AEC0));
}

.retry-btn {
  background: var(--gradient-primary, linear-gradient(135deg, #9FE870 0%, #7BC653 100%));
  color: #1A1A1A;
  border-radius: 48rpx;
  padding: 20rpx 48rpx;
  font-size: 28rpx;
  font-weight: 600;
  border: none;
  box-shadow: 0 4rpx 16rpx rgba(159, 232, 112, 0.3);
  transition: all 150ms ease-out;
}

.retry-btn::after {
  border: none;
}

.retry-btn:active {
  transform: scale(0.98);
  box-shadow: 0 2rpx 8rpx rgba(159, 232, 112, 0.2);
}

.retry-text {
  color: #1A1A1A;
}
</style>
