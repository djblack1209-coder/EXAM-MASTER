<template>
  <view class="chat-container">
    <view class="nav-bar">
      <image 
        src="https://img.icons8.com/ios-glyphs/30/333333/chevron-left.png" 
        class="back-icon" 
        @tap="goBack"
      ></image>
      <text class="nav-title">{{ friendName }}</text>
      <image 
        src="https://img.icons8.com/ios/50/333333/menu--v1.png" 
        class="menu-icon"
      ></image>
    </view>

    <scroll-view class="chat-list" scroll-y :scroll-top="scrollTop" scroll-with-animation>
      <view class="msg-row left">
        <image src="https://img.icons8.com/color/96/avatar.png" class="avatar"></image>
        <view class="bubble left-bubble">
          <text>兄弟，高数那个极限题你做出来了吗？🤯</text>
        </view>
      </view>

      <view class="msg-row right">
        <view class="bubble right-bubble">
          <text>做出来了，用洛必达法则做两次就行！</text>
        </view>
        <image src="https://img.icons8.com/color/96/user-male-circle--v1.png" class="avatar"></image>
      </view>

      <view class="msg-row left">
        <image src="https://img.icons8.com/color/96/avatar.png" class="avatar"></image>
        <view class="bubble left-bubble">
          <text>太强了！带带我！晚上自习室见？</text>
        </view>
      </view>
    </scroll-view>

    <view class="input-area">
      <image 
        src="https://img.icons8.com/ios/50/666666/microphone.png" 
        class="tool-icon"
        @tap="handleVoice"
      ></image>
      <input 
        type="text" 
        class="msg-input" 
        placeholder="发消息..." 
        confirm-type="send"
        v-model="messageText"
        @confirm="handleSend"
      />
      <image 
        src="https://img.icons8.com/ios/50/666666/happy--v1.png" 
        class="tool-icon"
        @tap="handleEmoji"
      ></image>
      <image 
        src="https://img.icons8.com/ios-filled/50/07C160/plus.png" 
        class="tool-icon send-icon"
        @tap="handleSend"
      ></image>
    </view>
  </view>
</template>

<script setup>
import { ref, onMounted } from 'vue'

const friendName = ref('AI助教') // 默认名字
const scrollTop = ref(9999)
const messageText = ref('')
const statusBarHeight = ref(20)

onMounted(() => {
  // 获取状态栏高度
  const sys = uni.getSystemInfoSync()
  statusBarHeight.value = sys.statusBarHeight || 20

  // 获取路由参数
  const pages = getCurrentPages()
  const currentPage = pages[pages.length - 1]
  if (currentPage.options && currentPage.options.name) {
    friendName.value = decodeURIComponent(currentPage.options.name)
  }
})

const goBack = () => {
  uni.navigateBack({
    fail: () => {
      uni.reLaunch({
        url: '/src/pages/index/index'
      })
    }
  })
}

const handleVoice = () => {
  uni.showToast({
    title: '语音功能开发中',
    icon: 'none'
  })
}

const handleEmoji = () => {
  uni.showToast({
    title: '表情功能开发中',
    icon: 'none'
  })
}

const handleSend = () => {
  if (!messageText.value.trim()) {
    return
  }
  
  // 这里可以添加发送消息的逻辑
  console.log('发送消息:', messageText.value)
  
  // 清空输入框
  messageText.value = ''
  
  uni.showToast({
    title: '消息已发送',
    icon: 'success'
  })
}
</script>

<style lang="scss" scoped>
.chat-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background-color: #F5F7FA;
}

.nav-bar {
  height: 44px;
  padding-top: v-bind('statusBarHeight + "px"');
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-left: 16px;
  padding-right: 16px;
  background-color: #FFFFFF;
  border-bottom: 1px solid #E5E5E5;
  z-index: 10;
  -webkit-tap-highlight-color: transparent;
}

.nav-title {
  font-size: 17px;
  font-weight: 600;
  color: #333;
  -webkit-font-smoothing: antialiased;
}

.back-icon, .menu-icon {
  width: 24px;
  height: 24px;
  -webkit-tap-highlight-color: transparent;
  
  &:active {
    opacity: 0.6;
  }
}

.chat-list {
  flex: 1;
  padding: 16px;
  box-sizing: border-box;
  background-color: #F5F7FA;
}

.msg-row {
  display: flex;
  margin-bottom: 20px;
  width: 100%;
  align-items: flex-start;
}

.msg-row.right {
  justify-content: flex-end;
}

.avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  flex-shrink: 0;
}

.bubble {
  max-width: 65%;
  padding: 10px 14px;
  border-radius: 12px;
  font-size: 15px;
  line-height: 1.4;
  position: relative;
  word-wrap: break-word;
  -webkit-font-smoothing: antialiased;
}

.left-bubble {
  background-color: white;
  color: #333;
  margin-left: 10px;
  border-top-left-radius: 2px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
}

.right-bubble {
  background-color: #07C160;
  color: white;
  margin-right: 10px;
  border-top-right-radius: 2px;
  box-shadow: 0 2px 4px rgba(7, 193, 96, 0.2);
}

.input-area {
  min-height: 56px;
  background-color: white;
  display: flex;
  align-items: center;
  padding: 10px 12px;
  padding-bottom: calc(10px + env(safe-area-inset-bottom));
  border-top: 1px solid #E5E5E5;
  box-sizing: border-box;
}

.tool-icon {
  width: 28px;
  height: 28px;
  margin: 0 8px;
  -webkit-tap-highlight-color: transparent;
  flex-shrink: 0;
  
  &:active {
    opacity: 0.6;
  }
}

.msg-input {
  flex: 1;
  height: 36px;
  background-color: #F5F5F5;
  border-radius: 18px;
  padding: 0 12px;
  font-size: 14px;
  color: #333;
  -webkit-font-smoothing: antialiased;
}

.send-icon {
  width: 28px;
  height: 28px;
}
</style>
