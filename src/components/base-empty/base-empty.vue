<template>
  <view class="empty-container" :class="{ 'dark-mode': isDark }">
    <view class="empty-content">
      <text class="empty-icon">{{ icon || '📭' }}</text>
      <text class="empty-title">{{ title || '暂无数据' }}</text>
      <text class="empty-desc" v-if="desc">{{ desc }}</text>
      <button v-if="showButton" class="empty-button" @tap="handleAction">
        {{ buttonText || '去添加' }}
      </button>
    </view>
  </view>
</template>

<script>
export default {
  name: 'BaseEmpty',
  props: {
    icon: {
      type: String,
      default: '📭'
    },
    title: {
      type: String,
      default: '暂无数据'
    },
    desc: {
      type: String,
      default: ''
    },
    showButton: {
      type: Boolean,
      default: false
    },
    buttonText: {
      type: String,
      default: '去添加'
    },
    isDark: {
      type: Boolean,
      default: false
    }
  },
  methods: {
    handleAction() {
      this.$emit('action')
    }
  }
}
</script>

<style lang="scss" scoped>
.empty-container {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 400rpx;
  padding: 60rpx 40rpx;
}

.empty-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20rpx;
  text-align: center;
}

.empty-icon {
  font-size: 120rpx;
  opacity: 0.6;
  margin-bottom: 20rpx;
}

.empty-title {
  font-size: 32rpx;
  font-weight: 600;
  color: var(--text-title, #163300);
  margin-bottom: 10rpx;
}

.dark-mode .empty-title {
  color: var(--text-title, #FFFFFF);
}

.empty-desc {
  font-size: 28rpx;
  color: var(--text-light, #767676);
  line-height: 1.6;
  max-width: 500rpx;
}

.dark-mode .empty-desc {
  color: var(--text-light, #A0AEC0);
}

.empty-button {
  margin-top: 30rpx;
  padding: 20rpx 60rpx;
  background: var(--accent-green, #9FE870);
  color: #163300;
  border-radius: 50rpx;
  font-size: 28rpx;
  font-weight: 600;
  border: none;
}

.empty-button::after {
  border: none;
}
</style>
