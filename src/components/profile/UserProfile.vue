<template>
  <view class="user-profile-card" @click="handleCardClick">
    <view class="profile-content">
      <!-- 左侧：用户头像 -->
      <image 
        v-if="isLogin && userInfo?.avatarUrl"
        class="avatar" 
        :src="userInfo.avatarUrl" 
        mode="aspectFill"
      />
      <view v-else class="avatar avatar-placeholder"></view>
      
      <!-- 中间：用户信息 -->
      <view class="info-section">
        <view class="nickname">{{ isLogin ? userInfo?.nickName || '考研同学' : '点击登录' }}</view>
        <view v-if="isLogin" class="info-row">
          <text class="info-text">报考院校：清华大学</text>
          <text class="edit-icon">✏️</text>
        </view>
        <view v-if="isLogin" class="info-row">
          <text class="info-text">报考专业：计算机科学与技术</text>
          <text class="edit-icon">✏️</text>
        </view>
      </view>
      
      <!-- 右侧：查看计划按钮 -->
      <view v-if="isLogin" class="plan-btn">
        <image
          class="calendar-icon"
          src="https://img.icons8.com/color/96/calendar--v1.png"
          mode="aspectFit"
        />
        <text class="plan-text">查看计划</text>
      </view>
    </view>
  </view>
</template>

<script setup>
import { computed } from 'vue'
import { useUserStore } from '../../stores/index.js'

const userStore = useUserStore()

const isLogin = computed(() => userStore.isLogin)
const userInfo = computed(() => userStore.userInfo)

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
  background: #FFFFFF;
  border-radius: 24rpx;
  padding: 32rpx;
  margin: 24rpx;
  box-shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.05);
}

.profile-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
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
  font-size: 36rpx;
  font-weight: bold;
  color: #333333;
  margin-bottom: 12rpx;
}

.info-row {
  display: flex;
  align-items: center;
  margin-top: 8rpx;
}

.info-text {
  font-size: 26rpx;
  color: #666666;
  margin-right: 8rpx;
}

.edit-icon {
  font-size: 24rpx;
  color: #52C41A;
}

.plan-btn {
  display: flex;
  flex-direction: column;
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
  font-size: 22rpx;
  color: #52C41A;
  font-weight: 500;
}
</style>
