<template>
  <view class="page">
    <!-- 自定义导航栏 -->
    <view class="nav-bar" :style="{ paddingTop: statusBarHeight + 'px' }">
      <view class="nav-content">
        <text class="nav-title">我的</text>
      </view>
    </view>

    <!-- 主内容 -->
    <scroll-view scroll-y class="main-scroll" :style="{ paddingTop: statusBarHeight + 44 + 'px' }">
      <!-- 用户信息 -->
      <view class="section user-section">
        <view class="profile-command-card">
          <view class="profile-top">
            <view class="avatar-wrap">
              <image v-if="avatarUrl" class="avatar" :src="avatarUrl" mode="aspectFill" />
              <view v-else class="avatar avatar-placeholder">
                <text class="avatar-text">{{ initials }}</text>
              </view>
            </view>
            <view class="profile-copy">
              <text class="profile-kicker">LEARNING ASSET</text>
              <text class="user-name">{{ userName }}</text>
              <text v-if="!isLoggedIn" class="login-hint" @tap="goLogin">登录后同步学习轨迹</text>
              <text v-else class="login-hint">本地学习轨迹已启用</text>
            </view>
          </view>
          <view class="profile-pulse">
            <text class="pulse-title">下一阶段核心能力</text>
            <text class="pulse-desc">错题资产、复习间隔、知识图谱会在这里收拢成个人备考画像。</text>
          </view>
        </view>
      </view>

      <!-- 统计卡片 -->
      <view class="section">
        <view class="card stats-card">
          <view class="stat-item">
            <text class="stat-val">{{ studyTimeDisplay }}</text>
            <text class="stat-lbl">学习时长</text>
          </view>
          <view class="stat-divider" />
          <view class="stat-item">
            <text class="stat-val">{{ accuracy }}%</text>
            <text class="stat-lbl">掌握率</text>
          </view>
          <view class="stat-divider" />
          <view class="stat-item">
            <text class="stat-val">{{ totalQuestions }}</text>
            <text class="stat-lbl">总做题</text>
          </view>
        </view>
      </view>

      <!-- 菜单列表 -->
      <view class="section">
        <view class="card menu-card">
          <view class="menu-item" hover-class="menu-hover" @tap="goTo('/pages/mistake/index')">
            <text class="menu-text">错题本</text>
            <text class="menu-arrow">›</text>
          </view>
          <view class="menu-item" hover-class="menu-hover" @tap="goTo('/pages/settings/privacy')">
            <text class="menu-text">隐私政策</text>
            <text class="menu-arrow">›</text>
          </view>
          <view class="menu-item" hover-class="menu-hover" @tap="goTo('/pages/settings/terms')">
            <text class="menu-text">用户协议</text>
            <text class="menu-arrow">›</text>
          </view>
          <view class="menu-item menu-last" hover-class="menu-hover" @tap="handleFeedback">
            <text class="menu-text">意见反馈</text>
            <text class="menu-arrow">›</text>
          </view>
        </view>
      </view>

      <!-- APP引流横幅 -->
      <view class="section">
        <view class="card app-banner">
          <text class="banner-title">知识神经图谱即将接入</text>
          <text class="banner-desc">把每一次答题映射到知识点、薄弱链路和下一轮复习任务。</text>
        </view>
      </view>

      <!-- 退出登录 -->
      <view v-if="isLoggedIn" class="section">
        <view class="logout-btn" hover-class="btn-hover" @tap="handleLogout">
          <text class="logout-text">退出登录</text>
        </view>
      </view>

      <!-- 底部占位 -->
      <view :style="{ height: tabBarHeight + 96 + 'px' }" />
    </scroll-view>

    <!-- 底部导航栏 -->
    <CustomTabbar :active-index="2" />
  </view>
</template>

<script>
import CustomTabbar from '@/components/layout/custom-tabbar/custom-tabbar.vue';
import { useUserStore } from '@/stores/modules/user';
import { useStudyStore } from '@/stores/modules/study';
import { storageService } from '@/services/storageService.js';
import { safeNavigateTo } from '@/utils/safe-navigate';
import { logger } from '@/utils/logger.js';

export default {
  components: { CustomTabbar },

  data() {
    return {
      statusBarHeight: 44,
      tabBarHeight: 90
    };
  },

  computed: {
    userStore() {
      return useUserStore();
    },
    studyStore() {
      return useStudyStore();
    },

    isLoggedIn() {
      return !!(this.userStore?.isLogin || storageService.get('EXAM_USER_ID'));
    },

    userName() {
      if (!this.isLoggedIn) return '未登录';
      return this.userStore?.userInfo?.nickName || storageService.get('userInfo')?.nickName || '考研人 同学';
    },

    avatarUrl() {
      return this.userStore?.userInfo?.avatarUrl || storageService.get('userInfo')?.avatarUrl || '';
    },

    initials() {
      const name = this.userName;
      if (!name || name === '未登录') return '?';
      return name.charAt(0);
    },

    totalQuestions() {
      return this.studyStore?.studyProgress?.completedQuestions || 0;
    },

    accuracy() {
      return this.studyStore?.accuracy || 0;
    },

    studyTimeDisplay() {
      const min = this.studyStore?.studyProgress?.studyMinutes || 0;
      if (min < 60) return min + 'min';
      const h = Math.floor(min / 60);
      const m = min % 60;
      return h + 'h ' + (m > 0 ? m + 'min' : '');
    }
  },

  onLoad() {
    this.initLayout();
  },

  onShow() {
    // 每次进入刷新数据
    try {
      this.studyStore.restoreProgress();
      this.userStore.restoreUserInfo();
    } catch (e) {
      logger.warn('[Profile] data refresh failed:', e);
    }
  },

  methods: {
    initLayout() {
      try {
        const info = uni.getWindowInfo();
        this.statusBarHeight = info.statusBarHeight || 44;
        const safeBottom = info.safeAreaInsets?.bottom || 0;
        this.tabBarHeight = 60 + 12 + safeBottom;
      } catch (_e) {
        logger.warn('[Profile] layout init failed');
      }
    },

    goTo(url) {
      safeNavigateTo(url);
    },

    goLogin() {
      safeNavigateTo('/pages/login/index');
    },

    handleFeedback() {
      uni.showModal({
        title: '意见反馈',
        content: '如有问题或建议，请通过微信联系我们',
        showCancel: false,
        confirmText: '知道了'
      });
    },

    handleLogout() {
      uni.showModal({
        title: '确认退出',
        content: '退出后学习数据将保留在本地',
        success: (res) => {
          if (res.confirm) {
            try {
              this.userStore.logout();
              storageService.remove('userInfo');
              storageService.remove('EXAM_USER_ID');
              storageService.remove('EXAM_TOKEN');
              uni.$emit('loginStatusChanged', false);
              uni.showToast({ title: '已退出登录', icon: 'success' });
              setTimeout(() => {
                uni.switchTab({ url: '/pages/index/index' });
              }, 1000);
            } catch (e) {
              logger.error('[Profile] logout failed:', e);
            }
          }
        }
      });
    }
  }
};
</script>

<style lang="scss" scoped>
$primary: #9fe870;
$primary-light: #eafbe2;
$primary-deep: #163300;
$action-green: #00b86b;
$bg: #f4f8f2;
$card-bg: #ffffff;
$text-main: #1a1d26;
$text-sub: #5f6672;
$text-weak: #9ca3af;
$danger: #ef4444;
$radius-lg: 24rpx;
$radius-sm: 12rpx;
$spacing-page: 32rpx;
$spacing-card: 32rpx;
$spacing-section: 24rpx;

.page {
  min-height: 100vh;
  background: linear-gradient(180deg, #fafcf8 0%, $bg 44%, #eef5f0 100%);
  font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Noto Sans SC', sans-serif;
}

/* 导航栏 */
.nav-bar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
  background: rgba(250, 252, 248, 0.92);
  border-bottom: 1rpx solid rgba(22, 51, 0, 0.06);
}
.nav-content {
  height: 44px;
  display: flex;
  align-items: center;
  padding: 0 $spacing-page;
}
.nav-title {
  font-size: 36rpx;
  font-weight: 700;
  color: $primary-deep;
}

.main-scroll {
  height: 100vh;
  box-sizing: border-box;
}

.section {
  padding: 0 $spacing-page;
  margin-bottom: $spacing-section;
}

.card {
  background: $card-bg;
  border-radius: $radius-lg;
  padding: $spacing-card;
  border: 1rpx solid rgba(22, 51, 0, 0.05);
  box-shadow: 0 10rpx 30rpx rgba(22, 51, 0, 0.06);
}

/* 用户信息 */
.user-section {
  padding-top: 34rpx;
  padding-bottom: 16rpx;
}

.profile-command-card {
  width: 100%;
  box-sizing: border-box;
  padding: 34rpx;
  border-radius: 36rpx;
  background: linear-gradient(145deg, #ffffff 0%, #f3fdeb 100%);
  border: 1rpx solid rgba(22, 51, 0, 0.07);
  box-shadow: 0 20rpx 54rpx rgba(22, 51, 0, 0.1);
}

.profile-top {
  display: flex;
  align-items: center;
}

.avatar-wrap {
  margin-right: 24rpx;
}

.avatar {
  width: 116rpx;
  height: 116rpx;
  border-radius: 50%;
  border: 4rpx solid rgba(255, 255, 255, 0.86);
  box-shadow: 0 14rpx 26rpx rgba(22, 51, 0, 0.12);
}

.avatar-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  background: $primary-light;
}

.avatar-text {
  font-size: 48rpx;
  font-weight: 700;
  color: $primary-deep;
}

.profile-copy {
  flex: 1;
  min-width: 0;
}

.profile-kicker {
  display: block;
  color: rgba(22, 51, 0, 0.42);
  font-size: 18rpx;
  font-weight: 900;
  letter-spacing: 1.8rpx;
  margin-bottom: 8rpx;
}

.user-name {
  font-size: 36rpx;
  font-weight: 700;
  color: $text-main;
  display: block;
  line-height: 1.2;
}

.login-hint {
  font-size: 26rpx;
  color: $action-green;
  margin-top: 8rpx;
  display: block;
}

.profile-pulse {
  margin-top: 28rpx;
  padding: 24rpx;
  border-radius: 24rpx;
  background: rgba(22, 51, 0, 0.88);
}

.pulse-title {
  display: block;
  color: $primary;
  font-size: 26rpx;
  font-weight: 900;
}

.pulse-desc {
  display: block;
  margin-top: 10rpx;
  color: rgba(255, 255, 255, 0.7);
  font-size: 24rpx;
  line-height: 1.5;
}

/* 统计卡片 */
.stats-card {
  display: flex;
  align-items: center;
  justify-content: space-around;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
}

.stat-val {
  font-size: 40rpx;
  font-weight: 700;
  color: $text-main;
  line-height: 1.2;
}

.stat-lbl {
  font-size: 24rpx;
  color: $text-sub;
  margin-top: 8rpx;
}

.stat-divider {
  width: 1rpx;
  height: 60rpx;
  background: rgba(0, 0, 0, 0.08);
}

/* 菜单 */
.menu-card {
  padding: 0;
}

.menu-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 28rpx $spacing-card;
  border-bottom: 1rpx solid rgba(0, 0, 0, 0.06);
}

.menu-last {
  border-bottom: none;
}

.menu-text {
  font-size: 30rpx;
  color: $text-main;
}

.menu-arrow {
  font-size: 28rpx;
  color: $text-weak;
}

.menu-hover {
  background: rgba(0, 0, 0, 0.02);
}

/* APP横幅 */
.app-banner {
  display: flex;
  flex-direction: column;
  align-items: center;
  align-items: flex-start;
  background: linear-gradient(135deg, $primary-light 0%, $card-bg 100%);
  padding: 40rpx $spacing-card;
}

.banner-title {
  font-size: 30rpx;
  font-weight: 800;
  color: $primary-deep;
}

.banner-desc {
  font-size: 24rpx;
  color: $text-sub;
  margin-top: 8rpx;
  line-height: 1.5;
}

/* 退出登录 */
.logout-btn {
  padding: 24rpx;
  display: flex;
  justify-content: center;
  border-radius: $radius-sm;
  background: $card-bg;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.04);
}

.logout-text {
  font-size: 30rpx;
  color: $danger;
  font-weight: 500;
}

.btn-hover {
  opacity: 0.85;
}
</style>
