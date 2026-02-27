<template>
  <view v-if="visible" class="quote-poster-modal" @tap="$emit('close')">
    <view class="quote-poster-content" @tap.stop>
      <view class="poster-card" :class="{ 'poster-dark': isDark }">
        <view class="poster-decoration">
          <view class="poster-circle poster-circle-1" />
          <view class="poster-circle poster-circle-2" />
        </view>
        <view class="poster-body">
          <text class="poster-quote">
            "{{ quote }}"
          </text>
          <text class="poster-author">
            —— {{ author }}
          </text>
          <view class="poster-date">
            <text class="poster-date-text">
              {{ currentDate }}
            </text>
          </view>
          <view class="poster-brand">
            <text class="brand-name">
              Exam-Master
            </text>
            <text class="brand-slogan">
              考研路上，与你同行
            </text>
          </view>
        </view>
      </view>
      <view class="poster-actions">
        <view class="poster-btn poster-btn-secondary" @tap="$emit('close')">
          <text>关闭</text>
        </view>
        <view class="poster-btn poster-btn-primary" @tap="$emit('save')">
          <text>保存图片</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
export default {
  name: 'QuotePosterModal',
  props: {
    visible: { type: Boolean, default: false },
    quote: { type: String, default: '' },
    author: { type: String, default: '' },
    isDark: { type: Boolean, default: false }
  },
  emits: ['close', 'save'],
  computed: {
    currentDate() {
      const now = new Date();
      return `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`;
    }
  }
};
</script>

<style lang="scss" scoped>
.quote-poster-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(10px);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.quote-poster-content {
  width: 90%;
  max-width: 640rpx;
  animation: slideUp 0.4s cubic-bezier(0.18, 0.89, 0.32, 1.28);
}

@keyframes slideUp {
  from {
    transform: translateY(100rpx);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

.poster-card {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 32rpx;
  padding: 64rpx 48rpx;
  position: relative;
  overflow: hidden;
  box-shadow: 0 40rpx 80rpx rgba(102, 126, 234, 0.4);
}

.poster-card.poster-dark {
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
  box-shadow: 0 40rpx 80rpx rgba(0, 0, 0, 0.5);
}

.poster-decoration {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
}

.poster-circle {
  position: absolute;
  border-radius: 50%;
  opacity: 0.2;
}

.poster-circle-1 {
  width: 300rpx;
  height: 300rpx;
  background: var(--bg-card);
  top: -100rpx;
  right: -100rpx;
}

.poster-circle-2 {
  width: 200rpx;
  height: 200rpx;
  background: var(--bg-card);
  bottom: -50rpx;
  left: -50rpx;
}

.poster-body {
  position: relative;
  z-index: 1;
  text-align: center;
}

.poster-quote {
  display: block;
  font-size: 36rpx;
  font-weight: 600;
  color: white;
  line-height: 1.8;
  margin-bottom: 32rpx;
  text-shadow: 0 4rpx 8rpx rgba(0, 0, 0, 0.2);
}

.poster-author {
  display: block;
  font-size: 26rpx;
  color: rgba(255, 255, 255, 0.8);
  margin-bottom: 48rpx;
}

.poster-date {
  margin-bottom: 48rpx;
}

.poster-date-text {
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.7);
  background: rgba(255, 255, 255, 0.15);
  padding: 8rpx 24rpx;
  border-radius: 20rpx;
}

.poster-brand {
  border-top: 1rpx solid rgba(255, 255, 255, 0.2);
  padding-top: 32rpx;
}

.brand-name {
  display: block;
  font-size: 28rpx;
  font-weight: 700;
  color: white;
  margin-bottom: 8rpx;
}

.brand-slogan {
  display: block;
  font-size: 22rpx;
  color: rgba(255, 255, 255, 0.7);
}

.poster-actions {
  display: flex;
  gap: 24rpx;
  margin-top: 32rpx;
}

.poster-btn {
  flex: 1;
  height: 88rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 44rpx;
  font-size: 28rpx;
  font-weight: 600;
  transition: all 0.3s ease;
}

.poster-btn:active {
  transform: scale(0.95);
}

.poster-btn-secondary {
  background: rgba(255, 255, 255, 0.2);
  color: white;
  backdrop-filter: blur(5px);
}

.poster-btn-primary {
  background: rgba(255, 255, 255, 0.9);
  color: #667eea;
}
.poster-dark .poster-btn-primary {
  background: rgba(255, 255, 255, 0.15);
  color: #a0b4ff;
}
</style>
