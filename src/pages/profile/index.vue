<template>
  <view ref="root" class="page" :class="{ 'dark-mode': isDark, 'reduce-motion': reducedMotion }">
    <!-- 自定义导航栏 -->
    <view class="nav-bar" :style="{ paddingTop: statusBarHeight + 'px' }">
      <view class="nav-content">
        <text class="nav-title">我的账户</text>
      </view>
    </view>

    <!-- 主内容 -->
    <scroll-view scroll-y class="main-scroll" :style="{ paddingTop: statusBarHeight + 44 + 'px' }">
      <!-- 用户信息 -->
      <view class="section user-section">
        <view class="profile-command-card">
          <view class="profile-top">
            <view class="avatar-wrap">
              <image
                class="avatar"
                :src="avatarUrl && !avatarFailed ? avatarUrl : defaultAvatar"
                mode="aspectFill"
                alt="账户头像"
                @error="avatarFailed = true"
              />
            </view>
            <view class="profile-copy">
              <text class="user-name">{{ userName }}</text>
              <button v-if="!isLoggedIn" class="login-hint" role="button" tabindex="0" @tap="goLogin">
                登录后同步学习轨迹
              </button>
              <text v-else class="login-hint">本地学习轨迹已启用</text>
            </view>
          </view>
          <view class="profile-pulse">
            <text class="pulse-title">你的学习记录</text>
          </view>
        </view>
      </view>

      <view class="section">
        <LearningOverview view="study-detail" />
      </view>

      <!-- 旧题库记录继续保留原口径 -->
      <view class="section">
        <text class="legacy-stats-label">历史题库记录</text>
        <view class="card stats-card">
          <view class="stat-item">
            <text class="stat-val">{{ studyTimeDisplay }}</text>
            <text class="stat-lbl">学习时长</text>
          </view>
          <view class="stat-divider" />
          <view class="stat-item">
            <text class="stat-val">{{ accuracyDisplay }}</text>
            <text class="stat-lbl">近期旧判对</text>
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
          <button
            class="menu-item"
            role="button"
            tabindex="0"
            hover-class="menu-hover"
            @tap="goTo('/pages/mistake/index')"
          >
            <text class="menu-text">错题本</text>
            <text class="menu-arrow">›</text>
          </button>
          <button
            class="menu-item"
            role="button"
            tabindex="0"
            hover-class="menu-hover"
            @tap="goTo('/pages/favorite/index')"
          >
            <text class="menu-text">我的收藏</text>
            <text class="menu-arrow">›</text>
          </button>
          <button
            class="menu-item"
            role="button"
            tabindex="0"
            hover-class="menu-hover"
            @tap="goTo('/pages/settings/privacy')"
          >
            <text class="menu-text">隐私政策</text>
            <text class="menu-arrow">›</text>
          </button>
          <button
            class="menu-item"
            role="button"
            tabindex="0"
            hover-class="menu-hover"
            @tap="goTo('/pages/settings/terms')"
          >
            <text class="menu-text">用户协议</text>
            <text class="menu-arrow">›</text>
          </button>
          <button class="menu-item menu-last" role="button" tabindex="0" hover-class="menu-hover" @tap="handleFeedback">
            <text class="menu-text">意见反馈</text>
            <text class="menu-arrow">›</text>
          </button>
        </view>
      </view>

      <!-- APP引流横幅 -->
      <view class="section">
        <view class="card app-banner">
          <text class="banner-title">从问题走向理解</text>
        </view>
      </view>

      <!-- 退出登录 -->
      <view v-if="isLoggedIn" class="section">
        <button class="logout-btn" role="button" tabindex="0" hover-class="btn-hover" @tap="handleLogout">
          <text class="logout-text">退出登录</text>
        </button>
      </view>

      <!-- 底部占位 -->
      <view :style="{ height: tabBarHeight + 96 + 'px' }" />
    </scroll-view>

    <!-- 底部导航栏 -->
    <CustomTabbar :active-index="2" />
    <CustomModal
      v-model:visible="showDialog"
      :is-dark="isDark"
      :title="dialog.title"
      :content="dialog.content"
      :show-cancel="dialog.kind === 'logout'"
      :mask-closable="dialog.kind === 'feedback'"
      :confirm-text="dialog.kind === 'logout' ? '退出登录' : '知道了'"
      @confirm="confirmDialog"
    />
  </view>
</template>

<script>
import CustomTabbar from '@/components/layout/custom-tabbar/custom-tabbar.vue';
import LearningOverview from '@/components/business/learning/learning-overview.vue';
import { useUserStore } from '@/stores/modules/user';
import { useStudyStore } from '@/stores/modules/study';
import { useThemeStore } from '@/stores/modules/theme.js';
import { storageService } from '@/services/storageService.js';
import { safeNavigateTo } from '@/utils/safe-navigate';
import { logger } from '@/utils/logger.js';
import CustomModal from '@/components/common/CustomModal.vue';
import { DEFAULT_AVATAR } from '@/config/brand.js';
import { bindLearningKeyboard } from '@/services/learning/keyboard-controls.js';
import { bindBusinessMotion } from '@/design/business-motion.js';

export default {
  components: { CustomTabbar, LearningOverview, CustomModal },

  data() {
    return {
      statusBarHeight: 44,
      tabBarHeight: 90,
      defaultAvatar: DEFAULT_AVATAR,
      avatarFailed: false,
      reducedMotion: true,
      showDialog: false,
      dialog: { kind: 'feedback', title: '意见反馈', content: '如有问题或建议，请通过微信联系我们' }
    };
  },

  computed: {
    themeStore() {
      return useThemeStore();
    },
    isDark() {
      return this.themeStore.isDark;
    },
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
      return this.userStore?.userInfo?.nickName || storageService.get('userInfo')?.nickName || '同学';
    },

    avatarUrl() {
      return this.userStore?.userInfo?.avatarUrl || storageService.get('userInfo')?.avatarUrl || '';
    },

    totalQuestions() {
      return this.studyStore?.studyProgress?.completedQuestions || 0;
    },

    accuracyDisplay() {
      const value = this.studyStore?.accuracy;
      return Number.isFinite(Number(this.totalQuestions)) &&
        Number(this.totalQuestions) > 0 &&
        typeof value === 'number' &&
        Number.isFinite(value) &&
        value >= 0 &&
        value <= 100
        ? `${value}%`
        : '—';
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
    this.syncTheme();
    this.initLayout();
    uni.$on('themeUpdate', this.syncTheme);
    uni.$on('updateTheme', this.syncTheme);
  },

  watch: {
    avatarUrl() {
      this.avatarFailed = false;
    }
  },
  mounted() {
    this.releaseKeyboard = bindLearningKeyboard(this.$refs.root);
    this.releaseMotion = bindBusinessMotion((reduced) => {
      this.reducedMotion = reduced;
    });
  },
  beforeUnmount() {
    this.releaseKeyboard?.();
    this.releaseMotion?.();
  },

  onShow() {
    this.syncTheme();
    // 每次进入刷新数据
    try {
      this.studyStore.restoreProgress();
      this.userStore.restoreUserInfo();
    } catch (e) {
      logger.warn('[Profile] data refresh failed:', e);
    }
  },

  onUnload() {
    uni.$off('themeUpdate', this.syncTheme);
    uni.$off('updateTheme', this.syncTheme);
  },

  methods: {
    syncTheme(mode) {
      if (['dark', 'light'].includes(mode) && this.themeStore.isDark !== (mode === 'dark')) {
        this.themeStore.setDarkMode(mode === 'dark');
      }
    },

    initLayout() {
      try {
        const info = uni.getWindowInfo();
        const statusBarHeight = Number(info.statusBarHeight || 0);
        this.statusBarHeight = statusBarHeight > 0 ? statusBarHeight : 16;
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
      this.dialog = { kind: 'feedback', title: '意见反馈', content: '如有问题或建议，请通过微信联系我们' };
      this.showDialog = true;
    },

    handleLogout() {
      this.dialog = { kind: 'logout', title: '确认退出', content: '退出后学习数据将保留在本地' };
      this.showDialog = true;
    },
    confirmDialog() {
      if (this.dialog.kind === 'logout') {
        try {
          this.userStore.logout();
          storageService.remove('userInfo');
          storageService.remove('EXAM_USER_ID');
          storageService.remove('EXAM_TOKEN');
          uni.$emit('loginStatusChanged', false);
          uni.showToast({ title: '已退出登录', icon: 'success' });
          setTimeout(() => {
            safeNavigateTo('/pages/index/index');
          }, 1000);
        } catch (e) {
          logger.error('[Profile] logout failed:', e);
        }
      }
    }
  }
};
</script>

<style lang="scss" scoped>
$primary: #c9b1ee;
$primary-light: #eee7f7;
$primary-deep: #332842;
$action-green: #785bbc;
$bg: #f0eefa;
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
  @include em-mobile-canvas;
  --space-glass: var(--bg-card);
  --space-ink: var(--text-primary);
  --space-muted: var(--text-secondary);
  --space-line: var(--border);
  --space-sage: var(--primary);
}

.legacy-stats-label {
  display: block;
  margin-bottom: 16rpx;
  color: var(--text-secondary);
  font-size: 24rpx;
}

.page.dark-mode {
  color: #f5f7fb;
  background:
    radial-gradient(circle at 16% 8%, rgba(201, 177, 238, 0.1) 0, rgba(201, 177, 238, 0) 32%),
    radial-gradient(circle at 82% 16%, rgba(155, 81, 224, 0.12) 0, rgba(155, 81, 224, 0) 34%),
    linear-gradient(180deg, #211a2e 0%, #211a2e 58%, #282032 100%);
}

/* 导航栏 */
.nav-bar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
  @include em-mobile-topbar;
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

.dark-mode .nav-bar {
  background: rgba(33, 26, 46, 0.82);
  box-shadow: 0 1rpx 0 rgba(255, 255, 255, 0.08);
}

.dark-mode .nav-title {
  color: #f5f7fb;
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
  @include em-mobile-glass-surface($radius-lg, $spacing-card);
}

.dark-mode .card,
.dark-mode .profile-command-card,
.dark-mode .logout-btn {
  background: rgba(45, 37, 63, 0.82);
  border: 1rpx solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 18rpx 48rpx rgba(0, 0, 0, 0.32);
}

/* 用户信息 */
.user-section {
  padding-top: 34rpx;
  padding-bottom: 16rpx;
}

.profile-command-card {
  @include em-mobile-glass-surface(36rpx, 34rpx);
  width: 100%;
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
  box-shadow: 0 14rpx 26rpx rgba(51, 40, 66, 0.12);
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

.dark-mode .avatar-placeholder {
  background: rgba(201, 177, 238, 0.12);
}

.dark-mode .avatar-text {
  color: #c9b1ee;
}

.profile-copy {
  flex: 1;
  min-width: 0;
}

.profile-kicker {
  display: block;
  color: rgba(51, 40, 66, 0.42);
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
  background: rgba(51, 40, 66, 0.88);
}

.dark-mode .profile-pulse {
  background:
    radial-gradient(circle at 18% 0%, rgba(201, 177, 238, 0.16) 0, rgba(201, 177, 238, 0) 38%), rgba(16, 19, 26, 0.88);
}

.dark-mode .pulse-title,
.dark-mode .login-hint {
  color: #c9b1ee;
}

.dark-mode .user-name,
.dark-mode .stat-val,
.dark-mode .menu-text,
.dark-mode .banner-title {
  color: #f5f7fb;
}

.dark-mode .profile-kicker,
.dark-mode .stat-lbl,
.dark-mode .menu-arrow,
.dark-mode .banner-desc {
  color: rgba(245, 247, 251, 0.58);
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
  @include em-mobile-number;
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

.dark-mode .stat-divider {
  background: rgba(255, 255, 255, 0.08);
}

/* 菜单 */
.menu-card {
  padding: 0;
}

.menu-item {
  @include em-mobile-pressable;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 28rpx $spacing-card;
  border-bottom: 1rpx solid rgba(0, 0, 0, 0.06);
}

.dark-mode .menu-item {
  border-bottom-color: rgba(255, 255, 255, 0.08);
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
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.82) 0%, rgba(238, 231, 247, 0.74) 100%), rgba(255, 255, 255, 0.68);
  padding: 40rpx $spacing-card;
}

.dark-mode .app-banner {
  background:
    radial-gradient(circle at 16% 0%, rgba(201, 177, 238, 0.12) 0, rgba(201, 177, 238, 0) 36%), rgba(45, 37, 63, 0.82);
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
  @include em-mobile-glass-surface($radius-sm, 24rpx);
  @include em-mobile-pressable;
  display: flex;
  justify-content: center;
}

.logout-text {
  font-size: 30rpx;
  color: $danger;
  font-weight: 500;
}

.btn-hover {
  opacity: 0.85;
}

/* Shared business surfaces retain the homepage's purple palette and reading typography. */
.page {
  --account-surface: var(--yozi-reading);
  --account-ink: #080909;
  --account-muted: #63596f;
  --account-line: #dbd5e6;
  --account-primary: #785bbc;
  --account-hover: #eee7f7;
  --space-glass: var(--account-surface);
  --space-ink: var(--account-ink);
  --space-muted: var(--account-muted);
  --space-line: var(--account-line);
  --space-sage: var(--account-primary);
  --space-notice: var(--account-hover);
  font-family: 'DM Sans', 'PingFang SC', 'Microsoft YaHei', sans-serif;
  background: var(--yozi-background);
  color: var(--account-ink);
}
.page.dark-mode {
  --account-surface: var(--yozi-reading);
  --account-ink: #f8f4ff;
  --account-muted: #d2c8e5;
  --account-line: #504164;
  --account-primary: #c9b1ee;
  --account-hover: #473457;
  background: var(--yozi-background);
}
.page .card,
.page .profile-command-card {
  background: var(--account-surface);
  border: 0;
  border-radius: 24px;
  box-shadow: var(--yozi-shadow);
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}
.page .profile-command-card,
.page .stats-card,
.page .app-banner {
  padding: 20px;
}
.page .menu-card {
  padding: 0;
}
.page .user-name,
.page .menu-text,
.page .stat-val,
.page .banner-title {
  color: var(--account-ink);
}
.page .profile-kicker,
.page .stat-lbl,
.page .menu-arrow,
.page .banner-desc,
.page .legacy-stats-label {
  color: var(--account-muted);
}
.page .login-hint {
  color: var(--account-primary);
}
.page .login-hint[role='button'],
.page .menu-item,
.page .logout-btn {
  min-height: 44px;
  margin-left: 0;
  margin-right: 0;
  border-radius: 12px;
  font-family: inherit;
  font-size: 14px;
  line-height: 1.65;
  text-align: left;
  background: transparent;
  transition:
    background-color 180ms ease,
    color 180ms ease;
  &::after {
    border: 0;
  }
  &:focus-visible {
    outline: 2px solid var(--account-primary);
    outline-offset: 2px;
  }
}
.page .login-hint[role='button'] {
  padding: 0;
  border: 0;
}
.page .menu-item {
  width: 100%;
  padding: 14px 20px;
  border-radius: 0;
  border-bottom-color: var(--account-line);
}
.page .menu-last {
  border-bottom: 0;
}
.page .menu-hover {
  background: var(--account-hover);
}
.page .logout-btn {
  width: 100%;
  padding: 12px 20px;
  background: var(--account-surface);
  border: 1px solid var(--account-line);
  box-shadow: none;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}
.page .login-hint[role='button']:active,
.page .menu-item:active,
.page .logout-btn:active {
  background: var(--account-hover);
  transform: none;
  transition-duration: 100ms;
}
@media (hover: hover) {
  .page .login-hint[role='button']:hover,
  .page .menu-item:hover,
  .page .logout-btn:hover {
    background: var(--account-hover);
  }
}
.page.reduce-motion button {
  animation: none !important;
  transition: none !important;
  transform: none !important;
}
@media (prefers-reduced-motion: reduce) {
  .page button {
    animation: none !important;
    transition: none !important;
    transform: none !important;
  }
}
</style>
