<template>
  <!-- 占位元素，防止内容被底部固定栏遮挡 -->
  <view class="ai-entry-placeholder"></view>

  <!-- 固定底部的 AI 入口 -->
  <view class="ai-entry-fixed" :class="{ 'dark-mode': isDark }">
    <view class="section-header ds-flex ds-flex-between">
      <text class="title ds-text-lg ds-font-semibold">AI对话窗口</text>
    </view>

    <view class="entry-card ds-card">
      <!-- 左侧：锁图标 + 文字 -->
      <view class="left-info ds-flex ds-gap-md">
        <view class="lock-icon-wrapper">
          <text class="lock-icon">🤖</text>
        </view>
        <view class="text-wrapper ds-flex ds-flex-col ds-gap-xs">
          <text class="unlock-title ds-text-base ds-font-semibold">AI助教</text>
          <text class="unlock-desc ds-text-sm ds-text-secondary">有什么不懂的都可以问我</text>
        </view>
      </view>

      <!-- 底部输入行 -->
      <view class="input-row ds-flex ds-gap-md">
        <input class="subject-input" v-model="subjectInput" placeholder="输入问题..." placeholder- />
        <view class="unlock-btn ds-touchable ds-touch-target" @tap="handleUnlock">
          <text class="btn-text ds-text-sm ds-font-semibold">开始对话</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue'

// Props
defineProps({
  isDark: {
    type: Boolean,
    default: false
  }
})

const subjectInput = ref('')

const handleUnlock = () => {
  // 点击解锁处理

  // 暂时移除解锁逻辑，直接跳转到聊天页面（方便测试）
  // 后续可以根据需要恢复解锁验证

  // if (!subjectInput.value.trim()) {
  //   uni.showToast({
  //     title: '请输入专业代码或名称',
  //     icon: 'none'
  //   })
  //   return
  // }

  // 跳转到聊天页面
  uni.navigateTo({
    url: '/src/pages/chat/chat'
  })
}
</script>

<style lang="scss" scoped>
/* 占位元素，高度与固定栏一致 */
.ai-entry-placeholder {
  height: 340rpx;
}

/* 固定底部的容器 */
.ai-entry-fixed {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: var(--ds-bg-primary);
  padding: 24rpx 30rpx;
  padding-bottom: calc(24rpx + constant(safe-area-inset-bottom));
  padding-bottom: calc(24rpx + env(safe-area-inset-bottom));
  box-shadow: 0 -2rpx 10rpx rgba(0, 0, 0, 0.05);
  z-index: 100;
  transition: background-color 150ms ease-out;
}

.section-header {
  margin-bottom: 20rpx;
}

.title {
  color: var(--ds-text-primary);
}

.entry-card {
  background-color: var(--ds-bg-secondary);
  border-radius: 20rpx;
  padding: 24rpx;
  transition: background-color 150ms ease-out;
}

.left-info {
  align-items: center;
  margin-bottom: 20rpx;
}

.lock-icon-wrapper {
  width: 64rpx;
  height: 64rpx;
  background: linear-gradient(135deg, #E8E8E8 0%, #D0D0D0 100%);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: background 150ms ease-out;
}

.lock-icon {
  font-size: 32rpx;
}

.text-wrapper {
  flex: 1;
}

.unlock-title {
  color: var(--ds-text-primary);
}

.unlock-desc {
  color: var(--ds-text-secondary);
}

.input-row {
  align-items: center;
}

.subject-input {
  flex: 1;
  height: 72rpx;
  background-color: var(--ds-bg-primary);
  border-radius: 12rpx;
  padding: 0 24rpx;
  font-size: 26rpx;
  color: var(--ds-text-primary);
  border: 2rpx solid var(--ds-border-color);
  transition: all 150ms ease-out;

  &:focus {
    border-color: var(--ds-primary);
  }
}

.unlock-btn {
  min-width: 120rpx;
  height: 72rpx;
  background-color: transparent;
  border: 2rpx solid var(--ds-primary);
  border-radius: 12rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  padding: 0 16rpx;
  transition: all 150ms ease-out;

  &:active {
    background-color: var(--ds-primary);
    transform: scale(0.98);

    .btn-text {
      color: var(--bg-card);
    }
  }
}

.btn-text {
  color: var(--ds-primary);
  transition: color 150ms ease-out;
}

/* 深色模式 */
. {
  .ai-entry-fixed {
    box-shadow: 0 -2rpx 10rpx rgba(0, 0, 0, 0.3);
  }

  .lock-icon-wrapper {
    background: linear-gradient(135deg, #3a3a3c 0%, #2c2c2e 100%);
  }

  .subject-input {
    &::placeholder {
      color: var(--ds-text-tertiary);
    }
  }

  .unlock-btn {
    &:active {
      .btn-text {
        color: #1c1c1e;
      }
    }
  }
}
</style>
