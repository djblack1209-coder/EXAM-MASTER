<template>
  <view v-if="isLogin" class="friends-section">
    <!-- 标题栏 -->
    <view class="section-header">
      <text class="section-title">我的好友们</text>
      <view class="invite-btn" @click="handleInvite">
        <text class="invite-text">邀请好友</text>
      </view>
    </view>
    
    <!-- 好友列表 -->
    <view class="friends-list">
      <view 
        v-for="friend in friends"
        :key="friend.id"
        class="friend-item"
      >
        <!-- 左侧：头像 -->
        <image 
          class="friend-avatar" 
          :src="friend.avatar" 
          mode="aspectFill"
        />
        
        <!-- 中间：好友信息 -->
        <view class="friend-info">
          <view class="friend-name">{{ friend.name }}</view>
          <view class="friend-detail">
            <text class="detail-label">院校：</text>
            <text class="detail-value">{{ friend.school }}</text>
          </view>
          <view class="friend-detail">
            <text class="detail-label">学校：</text>
            <text class="detail-value">{{ friend.major }}</text>
          </view>
        </view>
        
        <!-- 右侧：状态和操作按钮 -->
        <view class="friend-actions">
          <view v-if="friend.online" class="online-status"></view>
          <view class="action-btns">
            <view class="action-btn chat-btn" @click="handleChat(friend)">
              💬
            </view>
            <view class="action-btn boost-btn" @click="handleBoost(friend)">
              🚀
            </view>
          </view>
        </view>
      </view>
      <view v-if="friends.length === 0" class="empty-tip">暂无好友</view>
    </view>
  </view>
  <view v-else class="friends-placeholder">
    登录后查看好友
  </view>
</template>

<script setup>
import { computed, onMounted, watch } from 'vue'
import { useUserStore } from '../../stores/index.js'

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
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24rpx;
}

.section-title {
  font-size: 32rpx;
  font-weight: bold;
  color: #333333;
}

.invite-btn {
  background: #07C160;
  border-radius: 40rpx;
  padding: 12rpx 32rpx;
}

.invite-text {
  font-size: 24rpx;
  color: #FFFFFF;
  font-weight: 500;
}

.friends-list {
  display: flex;
  flex-direction: column;
  gap: 24rpx;
}

.empty-tip {
  padding: 24rpx 0;
  text-align: center;
  font-size: 24rpx;
  color: #999999;
}

.friends-placeholder {
  margin: 0 24rpx 24rpx;
  padding: 32rpx;
  background: #FFFFFF;
  border-radius: 24rpx;
  color: #999999;
  font-size: 26rpx;
  text-align: center;
  box-shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.05);
}

.friend-item {
  background: #FFFFFF;
  border-radius: 24rpx;
  padding: 24rpx;
  display: flex;
  align-items: center;
  box-shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.05);
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
  font-size: 30rpx;
  font-weight: bold;
  color: #333333;
  margin-bottom: 8rpx;
}

.friend-detail {
  font-size: 24rpx;
  color: #666666;
  margin-top: 4rpx;
}

.detail-label {
  color: #999999;
}

.detail-value {
  color: #666666;
}

.friend-actions {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12rpx;
}

.online-status {
  width: 16rpx;
  height: 16rpx;
  border-radius: 50%;
  background: #52C41A;
  margin-bottom: 8rpx;
}

.action-btns {
  display: flex;
  gap: 12rpx;
}

.action-btn {
  width: 64rpx;
  height: 64rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32rpx;
  transition: transform 0.2s;
  
  &:active {
    transform: scale(0.95);
  }
}

.chat-btn {
  background: linear-gradient(135deg, #52C41A 0%, #73D13D 100%);
}

.boost-btn {
  background: linear-gradient(135deg, #FAAD14 0%, #FFC53D 100%);
}
</style>
