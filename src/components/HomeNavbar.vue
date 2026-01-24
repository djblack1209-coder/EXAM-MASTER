<!-- REFACTOR: Modern home navbar with design system utilities -->
<template>
  <view class="home-navbar ds-navbar" :class="{ ' ': isDark }" :style="navbarStyle">
    <!-- 状态栏占位 -->
    <view class="status-bar" :style="{ height: statusBarHeight + 'px' }"></view>

    <!-- 导航栏内容区 -->
    <view class="navbar-content ds-flex ds-flex-between" :style="contentStyle">
      <!-- 左侧：头像 + 欢迎语 -->
      <view class="navbar-left ds-flex ds-gap-sm">
        <image class="user-avatar ds-avatar" :src="userAvatar" mode="aspectFill"></image>
        <text class="welcome-text ds-text-lg ds-font-semibold ds-text-primary">{{ welcomeText }}</text>
      </view>

      <!-- 右侧：功能按钮 (避开胶囊) -->
      <view class="navbar-right ds-flex ds-gap-xs" :style="rightButtonStyle">
        <view class="icon-btn ds-touchable ds-touch-target ds-flex-center" @tap="onHelp">
          <text class="icon-text">?</text>
        </view>
        <view class="icon-btn ds-touchable ds-touch-target ds-flex-center" @tap="onMoreMenu">
          <text class="icon-text">⋯</text>
        </view>
        <view class="icon-btn ds-touchable ds-touch-target ds-flex-center" @tap="onCamera">
          <text class="icon-text">○</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useNavbar } from '../utils/helpers/useNavbar.js'

// 定义props
const props = defineProps({
  userAvatar: {
    type: String,
    default: 'https://mmbiz.qpic.cn/mmbiz/icTdbqWNOwNRna42FI242Lcia07jQodd2FJGIYQfG0LAJGFxM4FbnQP6yfMxBgJ0F3YRqJCJ1aPAK2dQagdusBZg/0'
  },
  userName: {
    type: String,
    default: 'Alex'
  },
  isDark: {
    type: Boolean,
    default: false
  }
})

// 定义emits
const emit = defineEmits(['inviteFriend'])

// 使用导航栏适配hook
const { statusBarHeight, menuButton, navbarHeight } = useNavbar()

// 获取当前时间段的问候语
const getGreeting = () => {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

// 欢迎文字
const welcomeText = computed(() => {
  return `${getGreeting()}, ${props.userName}!`
})

// 导航栏整体样式
const navbarStyle = computed(() => {
  return {
    height: navbarHeight.value + 'px'
  }
})

// 内容区样式（胶囊高度区域）
const contentStyle = computed(() => {
  const gap = menuButton.value.top - statusBarHeight.value
  return {
    height: menuButton.value.height + gap * 2 + 'px',
    paddingTop: gap + 'px',
    paddingBottom: gap + 'px'
  }
})

// 右侧按钮样式 - 关键：避开胶囊
const rightButtonStyle = computed(() => {
  const gap = menuButton.value.top - statusBarHeight.value
  // 右侧安全距离：胶囊宽度 + 额外间距（确保不被遮挡）
  const rightSafeMargin = 12

  return {
    top: (gap + 2) + 'px',
    right: (menuButton.value.width + rightSafeMargin) + 'px'
  }
})

// 更多菜单点击事件
const onMoreMenu = () => {
  uni.showActionSheet({
    itemList: ['邀请好友', '设置提醒', '分享海报'],
    success: (res) => {
      if (res.tapIndex === 0) {
        emit('inviteFriend')
      }
    }
  })
}

// 帮助按钮点击事件
const onHelp = () => {
  uni.showModal({
    title: '使用帮助',
    content: '点击倒计时卡片可以设置考试日期\n点击刷题卡片进入刷题页面\n勾选待办事项可以标记完成',
    showCancel: false
  })
}

// 相机按钮点击事件
const onCamera = () => {
  uni.showActionSheet({
    itemList: ['扫描题目', '拍照搜题', '从相册选择'],
    success: (res) => {
      uni.showToast({
        title: ['扫描题目', '拍照搜题', '从相册选择'][res.tapIndex],
        icon: 'none'
      })
    }
  })
}
</script>

<style lang="scss" scoped>
.home-navbar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 999;
  /* 透明背景 */
  background: transparent;
  /* 移除阴影 */
  box-shadow: none;
  /* 性能优化 */
  transform: translateZ(0);
  will-change: transform;

  .status-bar {
    width: 100%;
  }

  .navbar-content {
    position: relative;
    width: 100%;
    padding-left: 32rpx;
    padding-right: 32rpx;
    display: flex;
    align-items: center;
    justify-content: space-between;
    box-sizing: border-box;

    .navbar-left {
      display: flex;
      align-items: center;
      flex: 1;
      min-width: 0; // 防止文字溢出
      gap: 20rpx;

      .user-avatar {
        width: 80rpx;
        height: 80rpx;
        border-radius: 50%;
        /* 白色边框+阴影 */
        border: 4rpx solid var(--bg-card);
        box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.1);
        /* 性能优化 */
        transform: translateZ(0);
        backface-visibility: hidden;
      }

      .welcome-text {
        font-size: 34rpx;
        font-weight: 600;
        color: #1F2937;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        /* 文本渲染优化 */
        -webkit-font-smoothing: antialiased;
      }
    }

    .navbar-right {
      position: absolute;
      display: flex;
      align-items: center;
      gap: 20rpx;

      .icon-btn {
        width: 68rpx;
        height: 68rpx;
        border-radius: 50%;
        background: rgba(16, 185, 129, 0.1);
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        /* 性能优化 */
        transform: translateZ(0);
        will-change: transform, background-color;
        -webkit-tap-highlight-color: transparent;

        &:active {
          background: rgba(16, 185, 129, 0.2);
          transform: scale(0.92) translateZ(0);
        }

        .icon-text {
          font-size: 40rpx;
          font-weight: 600;
          color: #4B5563;
        }
      }
    }
  }
}

/* VISUAL: Dark mode styles */
.home-navbar. {
  /* 深色模式透明背景 */
  background: transparent;
  box-shadow: none;

  .navbar-left {
    .user-avatar {
      border-color: rgba(255, 255, 255, 0.1);
      box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.3);
    }

    .welcome-text {
      color: var(--ds-color-text-primary, var(--bg-card));
    }
  }

  .navbar-right {
    .icon-btn {
      background: rgba(159, 232, 112, 0.15);

      &:active {
        background: rgba(159, 232, 112, 0.25);
      }

      .icon-text {
        color: #E5E7EB;
      }
    }
  }
}
</style>
