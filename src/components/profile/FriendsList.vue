<template>
  <view v-if="isLogin" class="friends-section" :class="{ 'dark-mode': isDark }">
    <!-- 标题栏 -->
    <view class="section-header ds-flex ds-flex-between">
      <text class="section-title ds-text-lg ds-font-bold">我的好友们</text>
      <view class="invite-btn ds-touchable" @click="handleInvite">
        <text class="invite-text ds-text-xs ds-font-medium">邀请好友</text>
      </view>
    </view>

    <!-- 好友列表 -->
    <view class="friends-list ds-flex ds-flex-col ds-gap-md">
      <view v-for="friend in friends" :key="friend.id" class="friend-item ds-card ds-flex">
        <!-- 左侧：头像 -->
        <image class="friend-avatar" :src="friend.avatar" mode="aspectFill" />

        <!-- 中间：好友信息 -->
        <view class="friend-info">
          <view class="friend-name ds-text-base ds-font-bold">{{ friend.name }}</view>
          <view class="friend-detail ds-text-xs">
            <text class="detail-label ds-text-secondary">院校：</text>
            <text class="detail-value">{{ friend.school }}</text>
          </view>
          <view class="friend-detail ds-text-xs">
            <text class="detail-label ds-text-secondary">学校：</text>
            <text class="detail-value">{{ friend.major }}</text>
          </view>
        </view>

        <!-- 右侧：状态和操作按钮 -->
        <view class="friend-actions ds-flex ds-flex-col ds-gap-xs">
          <view v-if="friend.online" class="online-status"></view>
          <view class="action-btns ds-flex ds-gap-xs">
            <view class="action-btn chat-btn ds-touchable ds-touch-target" @click="handleChat(friend)">💬</view>
            <view class="action-btn boost-btn ds-touchable ds-touch-target" @click="handleBoost(friend)">🚀</view>
          </view>
        </view>
      </view>
      <view v-if="friends.length === 0" class="empty-tip ds-text-xs ds-text-secondary">暂无好友</view>
    </view>
  </view>
  <view v-else class="friends-placeholder ds-card ds-text-sm ds-text-secondary" :class="{ 'dark-mode': isDark }">登录后查看好友
  </view>
</template>

<script setup>
import { computed, onMounted, watch } from 'vue'
import { useUserStore } from '../../stores/index.js'

// Props
defineProps({
  isDark: {
    type: Boolean,
    default: false
  }
})

// defineEmits 是编译器宏，无需手动导入
const emit = defineEmits(['invite'])
const userStore = useUserStore()

const isLogin = computed(() => userStore.isLogin)
const friends = computed(() => userStore.friendsList)

const handleInvite = () => {
  emit('invite')
}

const handleChat = (friend) => {
  uni.showToast({
    title: `与${friend.name}聊天`,
    icon: 'none'
  })
}

const handleBoost = (friend) => {
  uni.showToast({
    title: `给${friend.name}加油`,
    icon: 'none'
  })
}

const loadFriends = async () => {
  await userStore.fetchFriends()
}

onMounted(() => {
  if (isLogin.value) {
    loadFriends()
  }
})

watch(isLogin, (value) => {
  if (value) {
    loadFriends()
  } else {
    userStore.fetchFriends()
  }
})
</script>

<style lang="scss" scoped>
.friends-section {
  margin: 0 24rpx 24rpx;
}

.section-header {
  align-items: center;
  margin-bottom: 24rpx;
}

.section-title {
  color: var(--ds-text-primary);
}

.invite-btn {
  background: var(--ds-success);
  border-radius: 40rpx;
  padding: 12rpx 32rpx;
  transition: all 150ms ease-out;

  &:active {
    transform: scale(0.98);
    background: var(--ds-success-dark);
  }
}

.invite-text {
  color: #FFFFFF;
}

.friends-list {
  /* ds-flex ds-flex-col ds-gap-md 已应用 */
}

.empty-tip {
  padding: 24rpx 0;
  text-align: center;
}

.friends-placeholder {
  margin: 0 24rpx 24rpx;
  padding: 32rpx;
  background: var(--ds-bg-primary);
  border-radius: 24rpx;
  text-align: center;
  box-shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.05);
  transition: all 150ms ease-out;
}

.friend-item {
  background: var(--ds-bg-primary);
  border-radius: 24rpx;
  padding: 24rpx;
  align-items: center;
  box-shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.05);
  transition: all 150ms ease-out;
}

.friend-avatar {
  width: 100rpx;
  height: 100rpx;
  border-radius: 50rpx;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  margin-right: 20rpx;
  flex-shrink: 0;
}

.friend-info {
  flex: 1;
}

.friend-name {
  color: var(--ds-text-primary);
  margin-bottom: 8rpx;
}

.friend-detail {
  color: var(--ds-text-secondary);
  margin-top: 4rpx;
}

.detail-label {
  color: var(--ds-text-secondary);
}

.detail-value {
  color: var(--ds-text-secondary);
}

.friend-actions {
  align-items: center;
}

.online-status {
  width: 16rpx;
  height: 16rpx;
  border-radius: 50%;
  background: var(--ds-success);
  margin-bottom: 8rpx;
}

.action-btns {
  /* ds-flex ds-gap-xs 已应用 */
}

.action-btn {
  width: 64rpx;
  height: 64rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32rpx;
  transition: all 150ms ease-out;

  &:active {
    transform: scale(0.95);
  }
}

.chat-btn {
  background: linear-gradient(135deg, var(--ds-success) 0%, #73D13D 100%);
}

.boost-btn {
  background: linear-gradient(135deg, #FAAD14 0%, #FFC53D 100%);
}

/* 深色模式 */
.dark-mode {
  .friends-placeholder {
    box-shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.2);
  }

  .friend-item {
    box-shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.2);
  }

  .invite-btn {
    &:active {
      .invite-text {
        color: #1c1c1e;
      }
    }
  }

  .invite-text {
    color: #1c1c1e;
  }
}
</style>
