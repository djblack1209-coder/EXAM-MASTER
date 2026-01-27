<template>
  <view class="user-profile-card ds-card ds-touchable" :class="{ 'dark-mode': isDark }" @click="handleCardClick">
    <view class="profile-content ds-flex ds-flex-between">
      <!-- 左侧：用户头像 -->
      <image v-if="isLogin && userInfo?.avatarUrl" class="avatar" :src="userInfo.avatarUrl" mode="aspectFill" @error="onAvatarError" />
      <view v-else class="avatar avatar-placeholder"></view>

      <!-- 中间：用户信息 -->
      <view class="info-section">
        <view class="nickname ds-text-xl ds-font-bold">{{ isLogin ? userInfo?.nickName || '考研同学' : '点击登录' }}</view>
        <view v-if="isLogin" class="info-row ds-flex ds-gap-xs">
          <text class="info-text ds-text-sm">报考院校：清华大学</text>
          <text class="edit-icon">✏️</text>
        </view>
        <view v-if="isLogin" class="info-row ds-flex ds-gap-xs">
          <text class="info-text ds-text-sm">报考专业：计算机科学与技术</text>
          <text class="edit-icon">✏️</text>
        </view>
      </view>

      <!-- 右侧：查看计划按钮 -->
      <view v-if="isLogin" class="plan-btn ds-flex ds-flex-col ds-touch-target">
        <image class="calendar-icon" src="https://img.icons8.com/color/96/calendar--v1.png" mode="aspectFit" />
        <text class="plan-text ds-text-xs ds-font-medium">查看计划</text>
      </view>
    </view>
  </view>
</template>

<script setup>
import { computed } from 'vue'
import { useUserStore } from '../../stores/index.js'

// Props
defineProps({
  isDark: {
    type: Boolean,
    default: false
  }
})

const userStore = useUserStore()

const isLogin = computed(() => userStore.isLogin)
const userInfo = computed(() => userStore.userInfo)
const defaultAvatar = 'https://api.dicebear.com/7.x/avataaars/svg?seed=Guest'

// ✅ 图片加载失败处理
const onAvatarError = (e) => {
  e.target.src = defaultAvatar
}

const handleCardClick = async () => {
  if (!isLogin.value) {
    await userStore.login('weixin')
    return
  }

  uni.showToast({
    title: '查看学习计划',
    icon: 'none'
  })
}
</script>

<style lang="scss" scoped>
.user-profile-card {
  background: var(--ds-bg-primary);
  border-radius: 24rpx;
  padding: 32rpx;
  margin: 24rpx;
  box-shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.05);
  transition: all 150ms ease-out;

  &:active {
    transform: scale(0.98);
  }
}

.profile-content {
  align-items: center;
}

.avatar {
  width: 120rpx;
  height: 120rpx;
  border-radius: 60rpx;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  flex-shrink: 0;
}

.avatar-placeholder {
  background: #E6E6E6;
}

.info-section {
  flex: 1;
  margin-left: 24rpx;
  margin-right: 24rpx;
}

.nickname {
  color: var(--ds-text-primary);
  margin-bottom: 12rpx;
}

.info-row {
  align-items: center;
  margin-top: 8rpx;
}

.info-text {
  color: var(--ds-text-secondary);
}

.edit-icon {
  font-size: 24rpx;
  color: var(--ds-success);
}

.plan-btn {
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.calendar-icon {
  width: 56rpx;
  height: 56rpx;
  margin-bottom: 8rpx;
}

.plan-text {
  color: var(--ds-success);
}

/* 深色模式 */
. {
  .user-profile-card {
    box-shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.2);
  }

  .avatar-placeholder {
    background: #3a3a3c;
  }
}
</style>
