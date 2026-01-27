/**
 * 空状态引导组件
 * ✅ P0-1 新增：解决新用户冷启动路径断裂问题
 * 
 * 功能：
 * 1. 显示友好的空状态提示
 * 2. 提供明确的行动引导
 * 3. 支持深色/浅色模式
 * 4. 支持 Lottie 动画（可选）
 */
<template>
  <view :class="['empty-guide', isDark ? 'empty-guide-dark' : 'empty-guide-light']">
    <!-- 装饰气泡 -->
    <view v-if="isDark" class="decoration-bubble bubble-1"></view>
    <view v-if="isDark" class="decoration-bubble bubble-2"></view>
    
    <!-- 图标/动画区域 -->
    <view class="empty-icon-wrapper">
      <text class="empty-icon">{{ icon }}</text>
    </view>
    
    <!-- 标题 -->
    <text class="empty-title">{{ title }}</text>
    
    <!-- 描述 -->
    <text class="empty-desc">{{ description }}</text>
    
    <!-- 行动按钮 -->
    <view v-if="showButton" class="empty-action">
      <view 
        :class="['action-btn', isDark ? 'btn-glow' : 'btn-solid']" 
        @tap="handleAction"
      >
        <text class="btn-icon">{{ buttonIcon }}</text>
        <text class="btn-text">{{ buttonText }}</text>
      </view>
    </view>
    
    <!-- 次要提示 -->
    <text v-if="hint" class="empty-hint">{{ hint }}</text>
  </view>
</template>

<script>
export default {
  name: 'EmptyGuide',
  
  props: {
    // 图标（emoji 或图标类名）
    icon: {
      type: String,
      default: '📚'
    },
    // 标题
    title: {
      type: String,
      default: '暂无数据'
    },
    // 描述文案
    description: {
      type: String,
      default: '这里空空如也，快去添加内容吧'
    },
    // 是否显示按钮
    showButton: {
      type: Boolean,
      default: true
    },
    // 按钮图标
    buttonIcon: {
      type: String,
      default: '➕'
    },
    // 按钮文案
    buttonText: {
      type: String,
      default: '立即添加'
    },
    // 底部提示
    hint: {
      type: String,
      default: ''
    },
    // 深色模式
    isDark: {
      type: Boolean,
      default: false
    },
    // 引导类型（用于埋点）
    guideType: {
      type: String,
      default: 'default'
    }
  },
  
  methods: {
    handleAction() {
      // 震动反馈
      try {
        if (typeof uni.vibrateShort === 'function') {
          uni.vibrateShort();
        }
      } catch (e) {}
      
      // 触发事件
      this.$emit('action', { type: this.guideType });
    }
  }
}
</script>

<style lang="scss" scoped>
.empty-guide {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60rpx 40rpx;
  border-radius: 24rpx;
  position: relative;
  overflow: hidden;
  margin: 20rpx 0;
  
  &.empty-guide-light {
    background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
    border: 1px solid rgba(0, 0, 0, 0.05);
  }
  
  &.empty-guide-dark {
    background: linear-gradient(135deg, rgba(30, 30, 30, 0.9) 0%, rgba(20, 20, 20, 0.95) 100%);
    border: 1px solid rgba(255, 255, 255, 0.1);
    box-shadow: 0 0 40rpx rgba(0, 229, 255, 0.1);
  }
}

// 装饰气泡
.decoration-bubble {
  position: absolute;
  border-radius: 50%;
  opacity: 0.3;
  
  &.bubble-1 {
    width: 120rpx;
    height: 120rpx;
    background: radial-gradient(circle, #00E5FF 0%, transparent 70%);
    top: -20rpx;
    right: -20rpx;
    animation: float 4s ease-in-out infinite;
  }
  
  &.bubble-2 {
    width: 80rpx;
    height: 80rpx;
    background: radial-gradient(circle, #9FE870 0%, transparent 70%);
    bottom: -10rpx;
    left: 20rpx;
    animation: float 3s ease-in-out infinite reverse;
  }
}

@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-10rpx); }
}

// 图标区域
.empty-icon-wrapper {
  width: 120rpx;
  height: 120rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 24rpx;
  
  .empty-icon {
    font-size: 72rpx;
    animation: bounce 2s ease-in-out infinite;
  }
}

@keyframes bounce {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.1); }
}

// 标题
.empty-title {
  font-size: 36rpx;
  font-weight: 600;
  margin-bottom: 12rpx;
  
  .empty-guide-light & {
    color: #1a1a1a;
  }
  
  .empty-guide-dark & {
    color: #ffffff;
  }
}

// 描述
.empty-desc {
  font-size: 28rpx;
  text-align: center;
  line-height: 1.6;
  max-width: 500rpx;
  margin-bottom: 32rpx;
  
  .empty-guide-light & {
    color: var(--ds-color-text-secondary);
  }
  
  .empty-guide-dark & {
    color: rgba(255, 255, 255, 0.7);
  }
}

// 行动按钮
.empty-action {
  .action-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20rpx 48rpx;
    border-radius: 40rpx;
    transition: all 0.3s ease;
    
    &:active {
      transform: scale(0.95);
    }
    
    &.btn-solid {
      background: linear-gradient(135deg, #00a96d 0%, #008055 100%);
      color: #ffffff;
      box-shadow: 0 4rpx 16rpx rgba(0, 169, 109, 0.3);
    }
    
    &.btn-glow {
      background: linear-gradient(135deg, #00E5FF 0%, #00B8D4 100%);
      color: var(--text-inverse, #000000);
      box-shadow: 0 0 20rpx rgba(0, 229, 255, 0.4);
    }
    
    .btn-icon {
      font-size: 28rpx;
      margin-right: 8rpx;
    }
    
    .btn-text {
      font-size: 28rpx;
      font-weight: 600;
    }
  }
}

// 底部提示
.empty-hint {
  font-size: 24rpx;
  margin-top: 24rpx;
  
  .empty-guide-light & {
    color: var(--ds-color-text-tertiary);
  }
  
  .empty-guide-dark & {
    color: rgba(255, 255, 255, 0.5);
  }
}
</style>
