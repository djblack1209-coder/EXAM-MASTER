<template>
  <view class="settings-container">
    <!-- 导航栏 - 添加设计系统工具类 -->
    <view class="nav-bar ds-flex ds-flex-center">
      <text class="nav-title ds-text-lg ds-font-semibold">设置</text>
    </view>

    <!-- 用户卡片 - 优化布局 -->
    <view class="card user-card">
      <view class="user-row ds-flex">
        <image src="https://img.icons8.com/color/96/user-male-circle--v1.png" class="user-avatar ds-rounded-full"
          mode="aspectFit"></image>
        <view class="user-info">
          <text class="user-name ds-text-lg ds-font-bold">{{ userInfo.name }}</text>
          <view class="info-tag-row ds-flex ds-touchable" @tap="handleEditSchool">
            <text class="info-label ds-text-xs">报考院校: {{ userInfo.school || '未设置' }}</text>
            <image src="https://img.icons8.com/ios-glyphs/30/07C160/edit--v1.png" class="edit-icon"></image>
          </view>
          <view class="info-tag-row ds-flex ds-touchable" @tap="handleEditMajor">
            <text class="info-label ds-text-xs">报考专业: {{ userInfo.major || '未设置' }}</text>
            <image src="https://img.icons8.com/ios-glyphs/30/07C160/edit--v1.png" class="edit-icon"></image>
          </view>
        </view>
        <view class="plan-btn ds-flex-col ds-flex-center ds-touchable" @tap="handleViewPlan">
          <image src="https://img.icons8.com/fluency/48/calendar.png" class="plan-icon"></image>
          <text class="plan-text ds-text-xs">查看计划</text>
        </view>
      </view>
    </view>

    <!-- 进度卡片 - 优化样式 -->
    <view class="card progress-card ds-flex-col ds-flex-center ds-touchable" @tap="handleViewProgress">
      <view class="progress-circle ds-flex-center">
        <view class="inner-circle ds-flex-col ds-flex-center">
          <text class="progress-num ds-font-bold">{{ progressValue }}<text class="percent">%</text></text>
          <text class="progress-desc ds-text-xs">总计划完成度</text>
        </view>
      </view>
      <text class="click-hint ds-text-xs ds-text-secondary">点击查看详细进度</text>
    </view>

    <!-- 工具功能 -->
    <view class="section-header ds-text-sm ds-font-semibold">工具功能</view>
    <view class="tools-row ds-flex ds-gap-xs">
      <view class="tool-item ds-flex ds-touchable" @tap="handleTool('essay')">
        <image src="https://img.icons8.com/fluency/96/book.png" class="tool-icon"></image>
        <text class="tool-name ds-text-sm ds-font-medium">作文功能句</text>
      </view>
      <view class="tool-item ds-flex ds-touchable" @tap="handleTool('calculator')">
        <image src="https://img.icons8.com/fluency/96/calculator.png" class="tool-icon"></image>
        <text class="tool-name ds-text-sm ds-font-medium">高等数学计算器</text>
      </view>
    </view>

    <view class="tools-row ds-flex ds-gap-xs">
      <view class="tool-item ds-flex ds-touchable" @tap="navigateToFriends">
        <image src="https://img.icons8.com/fluency/96/conference-call.png" class="tool-icon"></image>
        <text class="tool-name ds-text-sm ds-font-medium">我的好友</text>
      </view>
      <view class="tool-item ds-flex ds-touchable" @tap="handleTool('settings')">
        <image src="https://img.icons8.com/fluency/96/settings.png" class="tool-icon"></image>
        <text class="tool-name ds-text-sm ds-font-medium">设置</text>
      </view>
    </view>

    <!-- 好友列表头部 -->
    <view class="friend-header-row ds-flex ds-flex-between">
      <text class="section-header ds-text-sm ds-font-semibold">我的好友们</text>
      <view class="invite-btn ds-touchable" @tap="showInviteModal = true">
        <text class="ds-text-xs ds-font-medium">邀请好友</text>
      </view>
    </view>

    <!-- 好友列表 -->
    <view class="friend-list">
      <view v-for="(friend, index) in friendList" :key="index" class="card friend-item ds-flex ds-touchable"
        @tap="navigateToChat(friend.name)">
        <image :src="friend.avatar" class="friend-avatar ds-rounded-full" mode="aspectFill"></image>
        <view class="friend-info">
          <view class="name-row ds-flex">
            <text class="friend-name ds-text-sm ds-font-semibold">{{ friend.name }}</text>
            <view class="status-dot ds-rounded-full"></view>
          </view>
          <text class="friend-detail ds-text-xs">院校: {{ friend.school }}</text>
          <text class="friend-detail ds-text-xs">专业: {{ friend.major }}</text>
        </view>
        <view class="friend-actions ds-flex ds-gap-xs">
          <image src="https://img.icons8.com/fluency/48/chat.png" class="action-icon ds-touchable"
            @tap.stop="navigateToChat(friend.name)"></image>
          <image src="https://img.icons8.com/fluency/48/rocket.png" class="action-icon ds-touchable"
            @tap.stop="handleEncourage(friend)"></image>
        </view>
      </view>
    </view>

    <view style="height: 100px;"></view>

    <InviteModal v-model:visible="showInviteModal" @close="showInviteModal = false" @openPoster="handleOpenPoster" />

    <PosterModal v-model:visible="showPosterModal" @close="showPosterModal = false" />

    <!-- 底部导航栏：统一使用 CustomTabbar -->
    <custom-tabbar :activeIndex="3" :isDark="false"></custom-tabbar>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import CustomTabbar from '../../components/custom-tabbar/custom-tabbar.vue'
import InviteModal from '../../components/InviteModal.vue'
import PosterModal from '../../components/PosterModal.vue'

// 隐藏系统原生 TabBar
onShow(() => {
  uni.hideTabBar({
    animation: false
  });
})

// 用户信息
const userInfo = ref({
  name: '考研战士',
  school: '清华大学',
  major: '计算机科学与技术'
})

// 进度值
const progressValue = ref(75)

// 模态框状态
const showInviteModal = ref(false)
const showPosterModal = ref(false)

// 好友列表
const friendList = ref([
  {
    name: '张巍',
    avatar: 'https://img.icons8.com/color/96/avatar.png',
    school: '清华大学',
    major: '计算机科学与技术'
  },
  {
    name: '王天弹',
    avatar: 'https://img.icons8.com/color/96/user-female-circle.png',
    school: '清华大学',
    major: '清华大学'
  },
  {
    name: '魏客',
    avatar: 'https://img.icons8.com/color/96/guest-male.png',
    school: '清华大学',
    major: '软件工程'
  }
])

// 编辑院校
const handleEditSchool = () => {
  uni.showModal({
    title: '编辑报考院校',
    editable: true,
    placeholderText: '请输入报考院校',
    success: (res) => {
      if (res.confirm && res.content) {
        userInfo.value.school = res.content
        uni.showToast({
          title: '更新成功',
          icon: 'success'
        })
      }
    }
  })
}

// 编辑专业
const handleEditMajor = () => {
  uni.showModal({
    title: '编辑报考专业',
    editable: true,
    placeholderText: '请输入报考专业',
    success: (res) => {
      if (res.confirm && res.content) {
        userInfo.value.major = res.content
        uni.showToast({
          title: '更新成功',
          icon: 'success'
        })
      }
    }
  })
}

// 查看计划
const handleViewPlan = () => {
  uni.switchTab({
    url: '/src/pages/school/index'
  })
}

// 查看进度
const handleViewProgress = () => {
  uni.showModal({
    title: '学习进度',
    content: `当前完成度：${progressValue.value}%\n继续加油！`,
    showCancel: false
  })
}

// 工具功能
const handleTool = (type) => {
  const tools = {
    essay: '作文功能句',
    calculator: '高等数学计算器',
    settings: '设置'
  }
  uni.showToast({
    title: `${tools[type]}功能开发中`,
    icon: 'none'
  })
}

// 跳转到好友列表
const navigateToFriends = () => {
  uni.navigateTo({
    url: '/src/pages/social/friend-list'
  })
}

// 跳转到聊天页面
const navigateToChat = (name) => {
  uni.navigateTo({
    url: `/pages/chat/index?name=${encodeURIComponent(name)}`
  })
}

// 鼓励好友
const handleEncourage = (friend) => {
  uni.showToast({
    title: `为${friend.name}加油！`,
    icon: 'success'
  })
}

// 打开海报弹窗
const handleOpenPoster = () => {
  showPosterModal.value = true
}
</script>

<style lang="scss" scoped>
/* 全局容器 */
.settings-container {
  min-height: 100vh;
  background-color: #F8F9FB;
  padding: 0 16px;
  padding-bottom: 80px;
  /* 为底部导航栏留出空间 */
  box-sizing: border-box;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

/* 1. 导航栏 */
.nav-bar {
  height: 44px;
  margin-top: 44px;
  /* 避开刘海屏 */
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 12px;
}

.nav-title {
  font-size: 18px;
  font-weight: 600;
  color: #333;
  -webkit-font-smoothing: antialiased;
}

/* 通用卡片 */
.card {
  background-color: white;
  border-radius: 16px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.03);
  margin-bottom: 16px;
  padding: 20px;
  -webkit-tap-highlight-color: transparent;

  &:active {
    opacity: 0.9;
    transform: scale(0.98);
  }
}

/* 2. 用户卡片 */
.user-row {
  display: flex;
  align-items: flex-start;
}

.user-avatar {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  margin-right: 12px;
  flex-shrink: 0;
}

.user-info {
  flex: 1;
  min-width: 0;
}

.user-name {
  font-size: 18px;
  font-weight: 700;
  color: #333;
  margin-bottom: 8px;
  display: block;
  -webkit-font-smoothing: antialiased;
}

.info-tag-row {
  display: flex;
  align-items: center;
  margin-bottom: 4px;
  -webkit-tap-highlight-color: transparent;

  &:active {
    opacity: 0.7;
  }
}

.info-label {
  font-size: 12px;
  color: #666;
  margin-right: 4px;
  -webkit-font-smoothing: antialiased;
}

.edit-icon {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
}

.plan-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-left: 8px;
  -webkit-tap-highlight-color: transparent;
  flex-shrink: 0;

  &:active {
    opacity: 0.7;
    transform: scale(0.95);
  }
}

.plan-icon {
  width: 24px;
  height: 24px;
  margin-bottom: 2px;
}

.plan-text {
  font-size: 10px;
  color: #333;
  -webkit-font-smoothing: antialiased;
}

/* 3. 进度卡片 */
.progress-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 30px 20px;
  -webkit-tap-highlight-color: transparent;
}

.progress-circle {
  width: 140px;
  height: 140px;
  border-radius: 50%;
  /* 核心：使用圆锥渐变画出 75% 的绿色进度 */
  background: conic-gradient(#07C160 0% 75%, #E0E0E0 75% 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 12px;
  position: relative;
}

.inner-circle {
  width: 124px;
  height: 124px;
  background-color: white;
  border-radius: 50%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.progress-num {
  font-size: 36px;
  font-weight: 700;
  color: #333;
  -webkit-font-smoothing: antialiased;
}

.percent {
  font-size: 16px;
}

.progress-desc {
  font-size: 12px;
  color: #666;
  margin-top: 4px;
  -webkit-font-smoothing: antialiased;
}

.click-hint {
  font-size: 12px;
  color: #999;
  -webkit-font-smoothing: antialiased;
}

/* 4. 工具功能 */
.section-header {
  font-size: 16px;
  font-weight: 600;
  color: #333;
  margin-bottom: 12px;
  margin-left: 4px;
  -webkit-font-smoothing: antialiased;
}

.tools-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 24px;
  gap: 12px;
}

.tool-item {
  flex: 1;
  background-color: white;
  border-radius: 16px;
  padding: 16px;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.03);
  -webkit-tap-highlight-color: transparent;

  &:active {
    opacity: 0.8;
    transform: scale(0.95);
  }
}

.tool-icon {
  width: 32px;
  height: 32px;
  margin-right: 8px;
  flex-shrink: 0;
}

.tool-name {
  font-size: 14px;
  font-weight: 500;
  color: #333;
  -webkit-font-smoothing: antialiased;
}

/* 5. 好友列表 */
.friend-header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.invite-btn {
  background-color: #07C160;
  color: white;
  font-size: 12px;
  padding: 6px 12px;
  border-radius: 14px;
  -webkit-tap-highlight-color: transparent;
  -webkit-font-smoothing: antialiased;

  &:active {
    opacity: 0.85;
    transform: scale(0.95);
  }
}

.friend-item {
  display: flex;
  align-items: center;
  padding: 16px;
  -webkit-tap-highlight-color: transparent;
}

.friend-avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  margin-right: 12px;
  flex-shrink: 0;
}

.friend-info {
  flex: 1;
  min-width: 0;
}

.name-row {
  display: flex;
  align-items: center;
  margin-bottom: 4px;
}

.friend-name {
  font-size: 16px;
  font-weight: 600;
  color: #333;
  margin-right: 6px;
  -webkit-font-smoothing: antialiased;
}

.status-dot {
  width: 8px;
  height: 8px;
  background-color: #07C160;
  border-radius: 50%;
  flex-shrink: 0;
}

.friend-detail {
  font-size: 11px;
  color: #999;
  display: block;
  line-height: 1.4;
  -webkit-font-smoothing: antialiased;
}

.friend-actions {
  display: flex;
  gap: 12px;
  flex-shrink: 0;
}

.action-icon {
  width: 28px;
  height: 28px;
  -webkit-tap-highlight-color: transparent;

  &:active {
    opacity: 0.7;
    transform: scale(0.9);
  }
}

/* 深色模式适配 */
.settings-container.dark-mode {
  background-color: var(--bg-body);

  .nav-title {
    color: var(--bg-card);
  }

  .card {
    background-color: #1e3a0f;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
  }

  .user-name {
    color: var(--bg-card);
  }

  .info-label {
    color: #b0b0b0;
  }

  .plan-text {
    color: var(--bg-card);
  }

  .section-header {
    color: var(--bg-card);
  }

  .tool-item {
    background-color: #1e3a0f;
  }

  .tool-name {
    color: var(--bg-card);
  }

  .friend-name {
    color: var(--bg-card);
  }

  .progress-num {
    color: #333;
    /* 保持进度条内部文字颜色 */
  }

  .inner-circle {
    background-color: var(--bg-card);
    /* 保持进度条内部背景 */
  }
}
</style>
