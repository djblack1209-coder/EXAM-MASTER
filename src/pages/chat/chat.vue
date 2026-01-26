<template>
  <view class="chat-container">
    <!-- 导航栏 -->
    <view class="nav-bar">
      <image 
        src="https://img.icons8.com/ios-glyphs/30/333333/chevron-left.png" 
        class="back-icon" 
        @tap="goBack"
      ></image>
      <view class="nav-center" @tap="showFriendSelector = true">
        <image :src="currentFriend.avatar" class="friend-avatar-small"></image>
        <text class="nav-title">{{ currentFriend.name }}</text>
        <text class="nav-arrow">▼</text>
      </view>
      <image 
        src="https://img.icons8.com/ios/50/333333/menu--v1.png" 
        class="menu-icon"
        @tap="showMenu"
      ></image>
    </view>

    <!-- AI好友选择器弹窗 -->
    <view class="friend-selector-modal" v-if="showFriendSelector" @tap="showFriendSelector = false">
      <view class="friend-selector-content" @tap.stop>
        <view class="selector-header">
          <text class="selector-title">选择AI好友</text>
          <text class="selector-close" @tap="showFriendSelector = false">×</text>
        </view>
        <view class="friend-list">
          <view 
            v-for="friend in aiFriends" 
            :key="friend.type"
            class="friend-item"
            :class="{ active: currentFriend.type === friend.type }"
            @tap="selectFriend(friend)"
          >
            <image :src="friend.avatar" class="friend-avatar"></image>
            <view class="friend-info">
              <text class="friend-name">{{ friend.name }}</text>
              <text class="friend-role">{{ friend.role }}</text>
            </view>
            <view class="friend-check" v-if="currentFriend.type === friend.type">✓</view>
          </view>
        </view>
      </view>
    </view>

    <!-- 聊天消息列表 -->
    <scroll-view 
      class="chat-list" 
      scroll-y 
      :scroll-top="scrollTop" 
      scroll-with-animation
      :scroll-into-view="scrollIntoView"
    >
      <!-- 欢迎消息 -->
      <view class="welcome-card" v-if="messages.length === 0">
        <image :src="currentFriend.avatar" class="welcome-avatar"></image>
        <text class="welcome-name">{{ currentFriend.name }}</text>
        <text class="welcome-role">{{ currentFriend.role }}</text>
        <text class="welcome-intro">{{ currentFriend.intro }}</text>
      </view>

      <!-- 消息列表 -->
      <view 
        v-for="(msg, index) in messages" 
        :key="index"
        :id="'msg-' + index"
        class="msg-row"
        :class="msg.role"
      >
        <!-- AI消息 -->
        <template v-if="msg.role === 'assistant'">
          <image :src="currentFriend.avatar" class="avatar"></image>
          <view class="bubble left-bubble">
            <text>{{ msg.content }}</text>
            <text class="msg-time">{{ msg.time }}</text>
          </view>
        </template>
        <!-- 用户消息 -->
        <template v-else>
          <view class="bubble right-bubble">
            <text>{{ msg.content }}</text>
            <text class="msg-time">{{ msg.time }}</text>
          </view>
          <image src="https://img.icons8.com/color/96/user-male-circle--v1.png" class="avatar"></image>
        </template>
      </view>

      <!-- 正在输入指示器 -->
      <view class="msg-row assistant" v-if="isTyping">
        <image :src="currentFriend.avatar" class="avatar"></image>
        <view class="bubble left-bubble typing-bubble">
          <view class="typing-dots">
            <view class="dot"></view>
            <view class="dot"></view>
            <view class="dot"></view>
          </view>
        </view>
      </view>

      <view id="msg-bottom" style="height: 20px;"></view>
    </scroll-view>

    <!-- 情绪快捷标签 -->
    <view class="emotion-tags" v-if="showEmotionTags">
      <view 
        v-for="emotion in emotionOptions" 
        :key="emotion.value"
        class="emotion-tag"
        :class="{ active: currentEmotion === emotion.value }"
        @tap="selectEmotion(emotion.value)"
      >
        <text>{{ emotion.emoji }} {{ emotion.label }}</text>
      </view>
    </view>

    <!-- 输入区域 -->
    <view class="input-area">
      <view class="input-tools">
        <image 
          src="https://img.icons8.com/ios/50/666666/happy--v1.png" 
          class="tool-icon"
          @tap="toggleEmotionTags"
        ></image>
      </view>
      <input 
        type="text" 
        class="msg-input" 
        placeholder="和AI好友聊聊..." 
        confirm-type="send"
        v-model="messageText"
        @confirm="handleSend"
        @focus="onInputFocus"
      />
      <view 
        class="send-btn"
        :class="{ active: messageText.trim() }"
        @tap="handleSend"
      >
        <text class="send-icon">↑</text>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, reactive, onMounted, nextTick, computed } from 'vue'
import { lafService } from '../../services/lafService.js'
import { storageService } from '../../services/storageService.js'
// ✅ 统一日志工具（生产环境自动禁用）
import { logger } from '../../utils/logger.js'

// AI好友配置
const aiFriends = ref([
  {
    type: 'yan-cong',
    name: '研聪',
    role: '清华学霸',
    avatar: 'https://img.icons8.com/color/96/student-male--v1.png',
    intro: '清华计算机系研一在读，去年初试第3名上岸。表面高冷学霸，实际是个闷骚的数据控，喜欢用数据说话。',
    personality: '理性、高效、数据驱动',
    speakingStyle: '简洁有力，常引用数据'
  },
  {
    type: 'yan-man',
    name: '研漫',
    role: '心理导师',
    avatar: 'https://img.icons8.com/color/96/female-profile.png',
    intro: '北师大心理学硕士在读，专攻教育心理学。温暖如春风，共情能力极强，是大家的"树洞"。',
    personality: '温暖、共情、善于倾听',
    speakingStyle: '温柔体贴，善于引导'
  },
  {
    type: 'yan-shi',
    name: '研师',
    role: '985名师',
    avatar: 'https://img.icons8.com/color/96/teacher.png',
    intro: '某985高校副教授，有10年考研辅导经验。专业严谨但不古板，严格中带着关怀。',
    personality: '专业、严谨、经验丰富',
    speakingStyle: '直击要点，不说废话'
  },
  {
    type: 'yan-you',
    name: '研友',
    role: '同届伙伴',
    avatar: 'https://img.icons8.com/color/96/conference-call--v1.png',
    intro: '和你同届备考的研友，目标是人大新闻学院。乐观开朗，段子手，是备考路上的开心果。',
    personality: '乐观、幽默、接地气',
    speakingStyle: '轻松活泼，爱用表情'
  }
])

// 情绪选项
const emotionOptions = ref([
  { value: 'frustrated', emoji: '😫', label: '沮丧' },
  { value: 'anxious', emoji: '😰', label: '焦虑' },
  { value: 'excited', emoji: '🎉', label: '开心' },
  { value: 'tired', emoji: '😴', label: '疲惫' },
  { value: 'confused', emoji: '🤔', label: '困惑' },
  { value: 'neutral', emoji: '😊', label: '平静' }
])

// 状态
const currentFriend = ref(aiFriends.value[0])
const messages = ref([])
const messageText = ref('')
const scrollTop = ref(0)
const scrollIntoView = ref('')
const statusBarHeight = ref(20)
const isTyping = ref(false)
const showFriendSelector = ref(false)
const showEmotionTags = ref(false)
const currentEmotion = ref('neutral')
const conversationCount = ref(0)

// 用户学习状态（从本地获取）
const userContext = reactive({
  studyState: '正常',
  recentAccuracy: 0,
  streak: 0,
  recentConversations: ''
})

onMounted(async () => {
  // 获取状态栏高度
  const sys = uni.getSystemInfoSync()
  statusBarHeight.value = sys.statusBarHeight || 20

  // 获取路由参数
  const pages = getCurrentPages()
  const currentPage = pages[pages.length - 1]
  if (currentPage.options) {
    // 如果传入了好友类型
    if (currentPage.options.friendType) {
      const friendType = decodeURIComponent(currentPage.options.friendType)
      const friend = aiFriends.value.find(f => f.type === friendType)
      if (friend) {
        currentFriend.value = friend
      }
    }
    // 如果传入了好友名字（兼容旧版）
    if (currentPage.options.name) {
      const name = decodeURIComponent(currentPage.options.name)
      const friend = aiFriends.value.find(f => f.name === name)
      if (friend) {
        currentFriend.value = friend
      }
    }
  }

  // 加载用户学习数据
  await loadUserContext()
  
  // 加载历史对话
  await loadChatHistory()
})

// 加载用户上下文
const loadUserContext = async () => {
  try {
    // 从本地存储获取学习数据
    const studyStats = storageService.get('study_stats', {})
    userContext.recentAccuracy = studyStats.accuracy || 0
    userContext.streak = studyStats.streakDays || 0
    
    // 判断学习状态
    if (userContext.recentAccuracy < 50) {
      userContext.studyState = '需要加强'
    } else if (userContext.recentAccuracy > 80) {
      userContext.studyState = '状态良好'
    } else {
      userContext.studyState = '正常'
    }
  } catch (e) {
    logger.warn('[Chat] 加载用户上下文失败:', e)
  }
}

// 加载聊天历史
const loadChatHistory = async () => {
  try {
    const historyKey = `chat_history_${currentFriend.value.type}`
    const history = storageService.get(historyKey, [])
    if (history.length > 0) {
      messages.value = history.slice(-20) // 只加载最近20条
      conversationCount.value = history.length
      // 构建最近对话摘要
      userContext.recentConversations = history.slice(-3).map(m => 
        `${m.role === 'user' ? '用户' : currentFriend.value.name}: ${m.content.substring(0, 50)}`
      ).join('\n')
      
      nextTick(() => {
        scrollToBottom()
      })
    }
  } catch (e) {
    logger.warn('[Chat] 加载聊天历史失败:', e)
  }
}

// 保存聊天历史
const saveChatHistory = () => {
  try {
    const historyKey = `chat_history_${currentFriend.value.type}`
    storageService.set(historyKey, messages.value.slice(-50)) // 只保存最近50条
  } catch (e) {
    logger.warn('[Chat] 保存聊天历史失败:', e)
  }
}

// 选择AI好友
const selectFriend = async (friend) => {
  if (friend.type === currentFriend.value.type) {
    showFriendSelector.value = false
    return
  }
  
  // 保存当前对话
  saveChatHistory()
  
  // 切换好友
  currentFriend.value = friend
  messages.value = []
  conversationCount.value = 0
  showFriendSelector.value = false
  
  // 加载新好友的历史对话
  await loadChatHistory()
}

// 选择情绪
const selectEmotion = (emotion) => {
  currentEmotion.value = emotion
  showEmotionTags.value = false
  
  // 显示提示
  const emotionInfo = emotionOptions.value.find(e => e.value === emotion)
  if (emotionInfo) {
    uni.showToast({
      title: `已标记心情: ${emotionInfo.emoji}`,
      icon: 'none',
      duration: 1500
    })
  }
}

// 切换情绪标签显示
const toggleEmotionTags = () => {
  showEmotionTags.value = !showEmotionTags.value
}

// 发送消息
const handleSend = async () => {
  const content = messageText.value.trim()
  if (!content || isTyping.value) return
  
  // 添加用户消息
  const userMsg = {
    role: 'user',
    content: content,
    time: formatTime(new Date())
  }
  messages.value.push(userMsg)
  messageText.value = ''
  conversationCount.value++
  
  // 滚动到底部
  scrollToBottom()
  
  // 显示输入指示器
  isTyping.value = true
  
  try {
    // 调用AI好友对话API
    const response = await lafService.aiFriendChat(
      currentFriend.value.type,
      content,
      {
        emotion: currentEmotion.value,
        conversationCount: conversationCount.value,
        studyState: userContext.studyState,
        recentAccuracy: userContext.recentAccuracy,
        recentConversations: userContext.recentConversations
      }
    )
    
    isTyping.value = false
    
    let reply = '抱歉，我暂时无法回复，请稍后再试~'
    
    if (response.code === 0 && response.data) {
      reply = response.data
      logger.log('[Chat] AI回复成功')
    } else {
      logger.warn('[Chat] AI回复异常:', response.message)
    }
    
    // 添加AI回复
    const aiMsg = {
      role: 'assistant',
      content: reply,
      time: formatTime(new Date())
    }
    messages.value.push(aiMsg)
    
    // 更新最近对话摘要
    userContext.recentConversations = messages.value.slice(-3).map(m => 
      `${m.role === 'user' ? '用户' : currentFriend.value.name}: ${m.content.substring(0, 50)}`
    ).join('\n')
    
    // 保存聊天历史
    saveChatHistory()
    
    // 重置情绪为中性
    currentEmotion.value = 'neutral'
    
    // 滚动到底部
    scrollToBottom()
    
  } catch (error) {
    isTyping.value = false
    logger.error('[Chat] 发送消息失败:', error)
    
    uni.showToast({
      title: '发送失败，请重试',
      icon: 'none'
    })
  }
}

// 滚动到底部
const scrollToBottom = () => {
  nextTick(() => {
    scrollIntoView.value = 'msg-bottom'
    setTimeout(() => {
      scrollIntoView.value = ''
    }, 100)
  })
}

// 格式化时间
const formatTime = (date) => {
  const hours = date.getHours().toString().padStart(2, '0')
  const minutes = date.getMinutes().toString().padStart(2, '0')
  return `${hours}:${minutes}`
}

// 输入框获得焦点
const onInputFocus = () => {
  showEmotionTags.value = false
  scrollToBottom()
}

// 返回
const goBack = () => {
  // 保存聊天历史
  saveChatHistory()
  
  uni.navigateBack({
    fail: () => {
      uni.reLaunch({
        url: '/src/pages/index/index'
      })
    }
  })
}

// 显示菜单
const showMenu = () => {
  uni.showActionSheet({
    itemList: ['清空聊天记录', '查看好友资料'],
    success: (res) => {
      if (res.tapIndex === 0) {
        // 清空聊天记录
        uni.showModal({
          title: '确认清空',
          content: `确定要清空与${currentFriend.value.name}的聊天记录吗？`,
          success: (modalRes) => {
            if (modalRes.confirm) {
              messages.value = []
              conversationCount.value = 0
              saveChatHistory()
              uni.showToast({ title: '已清空', icon: 'success' })
            }
          }
        })
      } else if (res.tapIndex === 1) {
        // 查看好友资料
        uni.showModal({
          title: currentFriend.value.name,
          content: `${currentFriend.value.role}\n\n${currentFriend.value.intro}`,
          showCancel: false
        })
      }
    }
  })
}
</script>

<style lang="scss" scoped>
.chat-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background-color: var(--bg-secondary);
}

.nav-bar {
  height: 44px;
  padding-top: v-bind('statusBarHeight + "px"');
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-left: 16px;
  padding-right: 16px;
  background-color: var(--bg-card);
  border-bottom: 1px solid var(--border-light);
  z-index: 10;
}

.nav-center {
  display: flex;
  align-items: center;
  gap: 8px;
}

.friend-avatar-small {
  width: 28px;
  height: 28px;
  border-radius: 50%;
}

.nav-title {
  font-size: 17px;
  font-weight: 600;
  color: var(--text-primary);
}

.nav-arrow {
  font-size: 10px;
  color: var(--text-secondary);
}

.back-icon, .menu-icon {
  width: 24px;
  height: 24px;
  
  &:active {
    opacity: 0.6;
  }
}

/* 好友选择器弹窗 */
.friend-selector-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 100;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 100px;
}

.friend-selector-content {
  width: 90%;
  max-width: 350px;
  background: var(--bg-card);
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
}

.selector-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-light);
}

.selector-title {
  font-size: 17px;
  font-weight: 600;
  color: var(--text-primary);
}

.selector-close {
  font-size: 24px;
  color: var(--text-secondary);
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.friend-list {
  padding: 8px;
}

.friend-item {
  display: flex;
  align-items: center;
  padding: 12px;
  border-radius: 12px;
  margin-bottom: 4px;
  
  &:active {
    background: var(--bg-secondary);
  }
  
  &.active {
    background: var(--primary-light, rgba(0, 122, 255, 0.1));
  }
}

.friend-avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  margin-right: 12px;
}

.friend-info {
  flex: 1;
}

.friend-name {
  font-size: 16px;
  font-weight: 500;
  color: var(--text-primary);
  display: block;
}

.friend-role {
  font-size: 13px;
  color: var(--text-secondary);
  margin-top: 2px;
}

.friend-check {
  width: 24px;
  height: 24px;
  background: var(--primary, #007AFF);
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
}

/* 聊天列表 */
.chat-list {
  flex: 1;
  padding: 16px;
  box-sizing: border-box;
}

/* 欢迎卡片 */
.welcome-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 40px 20px;
  text-align: center;
}

.welcome-avatar {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  margin-bottom: 16px;
}

.welcome-name {
  font-size: 20px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 4px;
}

.welcome-role {
  font-size: 14px;
  color: var(--text-secondary);
  margin-bottom: 16px;
}

.welcome-intro {
  font-size: 14px;
  color: var(--text-secondary);
  line-height: 1.6;
  max-width: 280px;
}

/* 消息行 */
.msg-row {
  display: flex;
  margin-bottom: 16px;
  align-items: flex-end;
  
  &.user {
    flex-direction: row-reverse;
  }
}

.avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  flex-shrink: 0;
}

.bubble {
  max-width: 70%;
  padding: 10px 14px;
  border-radius: 16px;
  font-size: 15px;
  line-height: 1.5;
  position: relative;
}

.left-bubble {
  background-color: var(--bg-card);
  color: var(--text-primary);
  margin-left: 8px;
  border-bottom-left-radius: 4px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.right-bubble {
  background: linear-gradient(135deg, #007AFF, #5856D6);
  color: white;
  margin-right: 8px;
  border-bottom-right-radius: 4px;
  box-shadow: 0 2px 8px rgba(0, 122, 255, 0.3);
}

.msg-time {
  display: block;
  font-size: 11px;
  margin-top: 4px;
  opacity: 0.6;
}

/* 输入指示器 */
.typing-bubble {
  padding: 14px 18px;
}

.typing-dots {
  display: flex;
  gap: 4px;
}

.dot {
  width: 8px;
  height: 8px;
  background: var(--text-secondary);
  border-radius: 50%;
  animation: typing 1.4s infinite ease-in-out;
  
  &:nth-child(2) {
    animation-delay: 0.2s;
  }
  
  &:nth-child(3) {
    animation-delay: 0.4s;
  }
}

@keyframes typing {
  0%, 60%, 100% {
    transform: translateY(0);
    opacity: 0.4;
  }
  30% {
    transform: translateY(-4px);
    opacity: 1;
  }
}

/* 情绪标签 */
.emotion-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 12px 16px;
  background: var(--bg-card);
  border-top: 1px solid var(--border-light);
}

.emotion-tag {
  padding: 6px 12px;
  background: var(--bg-secondary);
  border-radius: 16px;
  font-size: 13px;
  color: var(--text-secondary);
  
  &:active {
    opacity: 0.7;
  }
  
  &.active {
    background: var(--primary, #007AFF);
    color: white;
  }
}

/* 输入区域 */
.input-area {
  display: flex;
  align-items: center;
  padding: 10px 12px;
  padding-bottom: calc(10px + env(safe-area-inset-bottom));
  background-color: var(--bg-card);
  border-top: 1px solid var(--border-light);
  gap: 8px;
}

.input-tools {
  display: flex;
  align-items: center;
}

.tool-icon {
  width: 28px;
  height: 28px;
  
  &:active {
    opacity: 0.6;
  }
}

.msg-input {
  flex: 1;
  height: 36px;
  background-color: var(--bg-secondary);
  border-radius: 18px;
  padding: 0 14px;
  font-size: 15px;
  color: var(--text-primary);
}

.send-btn {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--bg-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  
  &.active {
    background: linear-gradient(135deg, #007AFF, #5856D6);
    transform: scale(1.05);
  }
}

.send-icon {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-secondary);
  
  .send-btn.active & {
    color: white;
  }
}
</style>
