<template>
  <!-- 占位元素，防止内容被底部固定栏遮挡 -->
  <view class="ai-entry-placeholder"></view>
  
  <!-- 固定底部的 AI 入口 -->
  <view class="ai-entry-fixed">
    <view class="section-header">
      <text class="title">AI对话窗口</text>
    </view>
    
    <view class="entry-card">
      <!-- 左侧：锁图标 + 文字 -->
      <view class="left-info">
        <view class="lock-icon-wrapper">
          <text class="lock-icon">🤖</text>
        </view>
        <view class="text-wrapper">
          <text class="unlock-title">AI助教</text>
          <text class="unlock-desc">有什么不懂的都可以问我</text>
        </view>
      </view>
      
      <!-- 底部输入行 -->
      <view class="input-row">
        <input 
          class="subject-input" 
          v-model="subjectInput"
          placeholder="输入问题..."
          placeholder-style="color: #CCCCCC;"
        />
        <view class="unlock-btn" @tap="handleUnlock">
          <text class="btn-text">开始对话</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue'

const subjectInput = ref('')

const handleUnlock = () => {
  console.log('点击解锁，输入内容:', subjectInput.value)
  
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
  background-color: #FFFFFF;
  padding: 24rpx 30rpx;
  padding-bottom: calc(24rpx + constant(safe-area-inset-bottom));
  padding-bottom: calc(24rpx + env(safe-area-inset-bottom));
  box-shadow: 0 -2rpx 10rpx rgba(0, 0, 0, 0.05);
  z-index: 100;
}

.section-header {
  margin-bottom: 20rpx;
}

.title {
  font-size: 32rpx;
  font-weight: 600;
  color: #333333;
}

.entry-card {
  background-color: #F8F9FA;
  border-radius: 20rpx;
  padding: 24rpx;
}

.left-info {
  display: flex;
  align-items: center;
  gap: 20rpx;
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
}

.lock-icon {
  font-size: 32rpx;
}

.text-wrapper {
  display: flex;
  flex-direction: column;
  gap: 6rpx;
}

.unlock-title {
  font-size: 30rpx;
  font-weight: 600;
  color: #333333;
}

.unlock-desc {
  font-size: 24rpx;
  color: #999999;
}

.input-row {
  display: flex;
  align-items: center;
  gap: 20rpx;
}

.subject-input {
  flex: 1;
  height: 72rpx;
  background-color: #FFFFFF;
  border-radius: 12rpx;
  padding: 0 24rpx;
  font-size: 26rpx;
  color: #333333;
  border: 2rpx solid #E8E8E8;
  
  &:focus {
    border-color: #07C160;
  }
}

.unlock-btn {
  width: 120rpx;
  height: 72rpx;
  background-color: transparent;
  border: 2rpx solid #07C160;
  border-radius: 12rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all 0.2s ease;
  
  &:active {
    background-color: #07C160;
    
    .btn-text {
      color: #FFFFFF;
    }
  }
}

.btn-text {
  font-size: 28rpx;
  color: #07C160;
  font-weight: 600;
}
</style>
