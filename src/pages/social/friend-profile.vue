<template>
  <view :class="['container', { 'dark-mode': isDark }]">
    <!-- 自定义导航栏 -->
    <view class="custom-navbar">
      <view class="status-bar" />
      <view class="navbar-content">
        <view class="navbar-left" hover-class="nav-hover" @tap="goBack">
          <text class="back-icon">
            <BaseIcon name="arrow-left" :size="36" />
          </text>
        </view>
        <view class="navbar-center">
          <text class="navbar-title"> 好友资料 </text>
        </view>
        <view class="navbar-right" />
      </view>
    </view>

    <!-- 主内容区 -->
    <scroll-view class="main-scroll" scroll-y>
      <!-- F018: 页面加载骨架屏 -->
      <view v-if="isPageLoading" class="skeleton-profile">
        <view class="skeleton-card glass-card">
          <view class="skeleton-avatar skeleton-pulse" />
          <view class="skeleton-nickname skeleton-pulse" />
          <view class="skeleton-status skeleton-pulse" />
          <view class="skeleton-stats-row">
            <view class="skeleton-stat skeleton-pulse" />
            <view class="skeleton-stat skeleton-pulse" />
            <view class="skeleton-stat skeleton-pulse" />
          </view>
        </view>
        <view class="skeleton-section glass-card">
          <view class="skeleton-section-title skeleton-pulse" />
          <view class="skeleton-grid">
            <view class="skeleton-badge skeleton-pulse" />
            <view class="skeleton-badge skeleton-pulse" />
            <view class="skeleton-badge skeleton-pulse" />
          </view>
        </view>
      </view>

      <!-- 用户信息卡片 -->
      <template v-else>
        <view class="profile-card glass-card">
          <!-- 头像区域 -->
          <view class="avatar-section">
            <view class="avatar-wrapper">
              <image
                class="avatar"
                :src="friendInfo.avatar || defaultAvatar"
                alt="头像"
                mode="aspectFill"
                @error="onAvatarError"
              />
              <view v-if="isOnline" class="online-dot" />
            </view>
            <view v-if="friendInfo.score" class="level-badge">
              <text class="level-text"> Lv.{{ Math.floor(friendInfo.score / 100) }} </text>
            </view>
          </view>

          <!-- 基本信息 -->
          <view class="info-section">
            <text class="nickname">
              {{ friendInfo.nickname || '未命名' }}
            </text>
            <text class="status-text">
              {{ statusText }}
            </text>
          </view>

          <!-- 统计数据 -->
          <view class="stats-row">
            <view class="stat-item">
              <text class="stat-value">
                {{ friendInfo.studyDays || 0 }}
              </text>
              <text class="stat-label"> 学习天数 </text>
            </view>
            <view class="stat-divider" />
            <view class="stat-item">
              <text class="stat-value"> {{ friendInfo.accuracy || 0 }}% </text>
              <text class="stat-label"> 正确率 </text>
            </view>
            <view class="stat-divider" />
            <view class="stat-item">
              <text class="stat-value highlight">
                {{ friendInfo.score || 0 }}
              </text>
              <text class="stat-label"> 总分 </text>
            </view>
          </view>
        </view>

        <!-- 学习成就 -->
        <view class="section-card glass-card">
          <view class="section-header">
            <text class="section-title"> 学习成就 </text>
          </view>
          <view class="achievement-grid">
            <view v-for="(badge, index) in achievements" :key="index" class="achievement-item">
              <BaseIcon :name="badge.icon" :size="40" class="achievement-icon" />
            </view>
            <view v-if="achievements.length === 0" class="achievement-item empty">
              <view class="achievement-icon">
                <BaseIcon name="medal" :size="40" />
              </view>
              <text class="achievement-name"> 暂无成就 </text>
            </view>
          </view>
        </view>

        <!-- 最近动态 -->
        <view class="section-card glass-card">
          <view class="section-header">
            <text class="section-title"> 最近动态 </text>
          </view>
          <view class="activity-list">
            <view v-for="(activity, index) in recentActivities" :key="index" class="activity-item">
              <BaseIcon :name="activity.icon" :size="32" class="activity-icon" />
              <view class="activity-content">
                <text class="activity-text">
                  {{ activity.text }}
                </text>
                <text class="activity-time">
                  {{ activity.time }}
                </text>
              </view>
            </view>
            <view v-if="recentActivities.length === 0" class="activity-item empty">
              <view class="activity-icon">
                <BaseIcon name="note" :size="32" />
              </view>
              <view class="activity-content">
                <text class="activity-text"> 暂无动态 </text>
              </view>
            </view>
          </view>
        </view>

        <!-- 底部操作区 -->
        <view class="action-section">
          <button
            class="action-btn primary"
            hover-class="btn-hover"
            :disabled="isActionLoading"
            @tap="handlePKChallenge"
          >
            <BaseIcon name="flame" :size="32" class="btn-icon" />
            <text class="btn-text"> 发起 PK 挑战 </text>
          </button>
          <!-- 消息功能暂未开放，隐藏按钮 -->
          <!-- <button class="action-btn secondary" hover-class="btn-hover" @tap="handleSendMessage"
					:disabled="isActionLoading">
					<text class="btn-icon">消息</text>
					<text class="btn-text">发送消息</text>
				</button> -->
          <button
            class="action-btn danger"
            hover-class="btn-hover"
            :disabled="isActionLoading"
            @tap="handleRemoveFriend"
          >
            <BaseIcon name="heart" :size="32" class="btn-icon" />
            <text class="btn-text"> 删除好友 </text>
          </button>
        </view>
      </template>
    </scroll-view>
  </view>
</template>

<script>
import { toast } from '@/utils/toast.js';
import { socialService } from './socialService.js';
import { logger } from '@/utils/logger.js';
import { safeNavigateTo, safeNavigateBack } from '@/utils/safe-navigate';
// 统一默认头像
const DEFAULT_AVATAR = '/static/images/default-avatar.png';
// ✅ F019: 统一使用 storageService
import storageService from '@/services/storageService.js';
import BaseIcon from '@/components/base/base-icon/base-icon.vue';

export default {
  name: 'FriendProfile',
  components: { BaseIcon },
  data() {
    return {
      isDark: false,
      isPageLoading: true, // F018: 页面加载状态
      friendInfo: {},
      isActionLoading: false,
      defaultAvatar: DEFAULT_AVATAR,
      // 成就数据从好友信息中获取（achievement-manager 提供）
      achievements: [],
      // 模拟动态数据
      recentActivities: []
    };
  },
  computed: {
    isOnline() {
      if (!this.friendInfo.last_active) return false;
      const now = Date.now();
      return now - this.friendInfo.last_active < 5 * 60 * 1000;
    },
    statusText() {
      if (this.isOnline) return '在线';
      if (!this.friendInfo.last_active) return '很久未见';

      const now = Date.now();
      const diff = now - this.friendInfo.last_active;
      const minutes = Math.floor(diff / (60 * 1000));
      const hours = Math.floor(diff / (60 * 60 * 1000));
      const days = Math.floor(diff / (24 * 60 * 60 * 1000));

      if (minutes < 60) return `${minutes}分钟前活跃`;
      if (hours < 24) return `${hours}小时前活跃`;
      if (days < 7) return `${days}天前活跃`;
      return '很久未见';
    }
  },
  onLoad(options) {
    logger.log('[FriendProfile] 页面加载, options:', options);
    this.isDark = storageService.get('theme_mode') === 'dark';

    // 从路由参数获取好友信息
    if (options) {
      this.friendInfo = {
        uid: options.uid || '',
        nickname: options.nickname ? decodeURIComponent(options.nickname) : '未命名',
        avatar: options.avatar ? decodeURIComponent(options.avatar) : this.defaultAvatar,
        score: parseInt(options.score) || 0,
        studyDays: parseInt(options.studyDays) || 0,
        accuracy: parseInt(options.accuracy) || 0,
        last_active: parseInt(options.lastActive) || 0
      };
    }

    // 生成模拟动态
    this.generateActivities();

    // F018: 数据加载完成
    this.isPageLoading = false;
  },
  methods: {
    goBack() {
      safeNavigateBack();
    },

    onAvatarError() {
      logger.warn('[FriendProfile] 头像加载失败，使用默认头像');
      this.friendInfo.avatar = this.defaultAvatar;
    },

    generateActivities() {
      // 根据好友数据生成模拟动态
      const activities = [];

      if (this.friendInfo.studyDays > 0) {
        activities.push({
          icon: 'calendar',
          text: `已坚持学习 ${this.friendInfo.studyDays} 天`,
          time: '持续中'
        });
      }

      if (this.friendInfo.score > 0) {
        activities.push({
          icon: 'trophy',
          text: `累计获得 ${this.friendInfo.score} 分`,
          time: '总计'
        });
      }

      if (this.friendInfo.accuracy > 0) {
        activities.push({
          icon: 'target',
          text: `答题正确率达到 ${this.friendInfo.accuracy}%`,
          time: '当前'
        });
      }

      this.recentActivities = activities;
    },

    handlePKChallenge() {
      if (this.isActionLoading) return;
      this.isActionLoading = true;

      logger.log('[FriendProfile] 发起 PK 挑战:', this.friendInfo.nickname);

      uni.showModal({
        title: '发起挑战',
        content: `确定要向 ${this.friendInfo.nickname} 发起 PK 挑战吗？`,
        confirmText: '挑战',
        success: (res) => {
          this.isActionLoading = false;
          if (res.confirm) {
            safeNavigateTo(
              `/pages/practice-sub/pk-battle?mode=friend&opponentId=${this.friendInfo.uid}&opponentName=${encodeURIComponent(this.friendInfo.nickname)}&opponentAvatar=${encodeURIComponent(this.friendInfo.avatar)}&opponentScore=${this.friendInfo.score}`
            );
          }
        },
        fail: () => {
          this.isActionLoading = false;
        }
      });
    },

    async handleRemoveFriend() {
      if (this.isActionLoading) return;
      this.isActionLoading = true;

      logger.log('[FriendProfile] 删除好友:', this.friendInfo.nickname);

      uni.showModal({
        title: '删除好友',
        content: `确定要删除好友 ${this.friendInfo.nickname} 吗？删除后需要重新添加。`,
        confirmText: '删除',
        confirmColor: '#FF4757',
        success: async (res) => {
          if (res.confirm) {
            toast.loading('处理中...');

            try {
              const result = await socialService.removeFriend(this.friendInfo.uid);

              toast.hide();
              this.isActionLoading = false;

              if (result.code === 0) {
                toast.success('已删除好友');
                // 返回上一页
                setTimeout(() => {
                  safeNavigateBack();
                }, 1500);
              } else {
                toast.info(result.msg || '删除失败');
              }
            } catch (err) {
              toast.hide();
              this.isActionLoading = false;
              logger.error('[FriendProfile] 删除好友失败:', err);
              toast.info('删除失败');
            }
          } else {
            this.isActionLoading = false;
          }
        },
        fail: () => {
          this.isActionLoading = false;
        }
      });
    }
  }
};
</script>

<style lang="scss" scoped>
.container {
  min-height: 100%;
  min-height: 100vh;
  background-color: var(--bg-body);
}

.container.dark-mode {
  background-color: var(--bg-body);
}

/* 导航栏 */
.custom-navbar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  background:
    linear-gradient(180deg, var(--apple-specular-soft) 0%, transparent 42%),
    linear-gradient(160deg, var(--apple-glass-nav-bg) 0%, var(--apple-glass-card-bg) 100%);
  z-index: 999;
  box-shadow: var(--apple-shadow-surface);
  border-bottom: 1rpx solid var(--apple-glass-border-strong);
}

.dark-mode .custom-navbar {
  background-color: var(--bg-glass);
  border-bottom: 1rpx solid var(--border);
}

.status-bar {
  height: var(--status-bar-height);
}

.navbar-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 88rpx;
  padding: 0 32rpx;
}

.navbar-left {
  width: 80rpx;
  height: 60rpx;
  display: flex;
  align-items: center;
  justify-content: flex-start;
}

.nav-hover {
  opacity: 0.7;
}

.back-icon {
  font-size: 48rpx;
  color: var(--text-primary);
  font-weight: 300;
}

.dark-mode .back-icon {
  color: var(--brand-color);
}

.navbar-center {
  flex: 1;
  text-align: center;
}

.navbar-title {
  font-size: 36rpx;
  font-weight: 600;
  color: var(--text-primary);
}

.dark-mode .navbar-title {
  color: var(--text-primary);
}

.navbar-right {
  width: 80rpx;
}

/* 主滚动区 */
.main-scroll {
  padding-top: calc(var(--status-bar-height) + 88rpx + 24rpx);
  padding-bottom: 48rpx;
  min-height: 100%;
  min-height: 100vh;
  box-sizing: border-box;
}

/* 玻璃卡片 */
.glass-card {
  position: relative;
  overflow: hidden;
  background:
    linear-gradient(180deg, var(--apple-specular-soft) 0%, transparent 36%),
    linear-gradient(160deg, var(--apple-glass-card-bg) 0%, var(--apple-group-bg) 100%);
  border-radius: 28rpx;
  margin: 0 32rpx 24rpx;
  box-shadow: var(--apple-shadow-card);
  border: 1rpx solid var(--apple-glass-border-strong);
}

.glass-card::before {
  content: '';
  position: absolute;
  left: 24rpx;
  right: 24rpx;
  top: 0;
  height: 1rpx;
  background: var(--apple-specular-soft);
}

.dark-mode .glass-card {
  background-color: var(--bg-glass);
  border: 1rpx solid var(--border);
}

/* 用户信息卡片 */
.profile-card {
  padding: 48rpx 32rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.avatar-section {
  position: relative;
  margin-bottom: 24rpx;
}

.avatar-wrapper {
  position: relative;
}

.avatar {
  width: 160rpx;
  height: 160rpx;
  border-radius: 50%;
  border: 4rpx solid rgba(255, 255, 255, 0.7);
  box-shadow: var(--apple-shadow-surface);
}

.online-dot {
  position: absolute;
  bottom: 8rpx;
  right: 8rpx;
  width: 28rpx;
  height: 28rpx;
  background-color: var(--success);
  border-radius: 50%;
  border: 4rpx solid var(--bg-card);
}

.dark-mode .online-dot {
  border-color: var(--bg-glass);
}

.level-badge {
  position: absolute;
  bottom: -8rpx;
  left: 50%;
  transform: translateX(-50%);
  background: var(--cta-primary-bg);
  padding: 6rpx 20rpx;
  border-radius: 999rpx;
  border: 1rpx solid var(--cta-primary-border);
  box-shadow: var(--cta-primary-shadow);
}

.level-text {
  font-size: 22rpx;
  font-weight: 600;
  color: #fff;
}

.info-section {
  text-align: center;
  margin-bottom: 32rpx;
}

.nickname {
  display: block;
  font-size: 40rpx;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 8rpx;
}

.status-text {
  font-size: 26rpx;
  color: var(--text-sub);
}

/* 统计行 */
.stats-row {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  padding: 24rpx 0;
  border-top: 1rpx solid var(--apple-divider);
}

.stat-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  /* gap: 8rpx; -- replaced for Android WebView compat */
}

.stat-value {
  font-size: 40rpx;
  font-weight: 700;
  color: var(--text-primary);
}

.stat-value.highlight {
  color: var(--brand-color);
}

.stat-label {
  font-size: 24rpx;
  color: var(--text-sub);
}

.stat-divider {
  width: 1rpx;
  height: 60rpx;
  background-color: var(--border);
}

/* 区块卡片 */
.section-card {
  padding: 32rpx;
}

.section-header {
  margin-bottom: 24rpx;
}

.section-title {
  font-size: 24rpx;
  font-weight: 620;
  letter-spacing: 3rpx;
  text-transform: uppercase;
  color: var(--text-secondary);
}

/* 成就网格 */
.achievement-grid {
  display: flex;
  flex-wrap: wrap;
  /* gap: 24rpx; -- replaced for Android WebView compat */
}

.achievement-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  /* gap: 8rpx; -- replaced for Android WebView compat */
  padding: 20rpx 24rpx;
  background-color: rgba(255, 255, 255, 0.62);
  border-radius: 22rpx;
  min-width: 140rpx;
  border: 1rpx solid rgba(255, 255, 255, 0.48);
  box-shadow: var(--apple-shadow-surface);
}

.dark-mode .achievement-item {
  background-color: var(--overlay);
}

.achievement-item.empty {
  opacity: 0.5;
}

.achievement-icon {
  font-size: 40rpx;
}

.achievement-name {
  font-size: 24rpx;
  color: var(--text-sub);
}

/* 动态列表 */
.activity-list {
  display: flex;
  flex-direction: column;
  /* gap: 20rpx; -- replaced for Android WebView compat */
}

.activity-item {
  display: flex;
  align-items: flex-start;
  /* gap: 16rpx; -- replaced for Android WebView compat */
  padding: 16rpx;
  background-color: rgba(255, 255, 255, 0.58);
  border-radius: 22rpx;
  border: 1rpx solid rgba(255, 255, 255, 0.46);
}

.dark-mode .activity-item {
  background-color: var(--overlay);
}

.activity-item.empty {
  opacity: 0.5;
}

.activity-icon {
  font-size: 32rpx;
  flex-shrink: 0;
}

.activity-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  /* gap: 4rpx; -- replaced for Android WebView compat */
}

.activity-text {
  font-size: 28rpx;
  color: var(--text-primary);
}

.activity-time {
  font-size: 22rpx;
  color: var(--text-sub);
}

/* 操作区 */
.action-section {
  padding: 32rpx;
  display: flex;
  flex-direction: column;
  /* gap: 20rpx; -- replaced for Android WebView compat */
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  /* gap: 12rpx; -- replaced for Android WebView compat */
  padding: 28rpx 0;
  border-radius: 999rpx;
  font-size: 30rpx;
  font-weight: 600;
  border: 1rpx solid rgba(255, 255, 255, 0.5);
}

.action-btn::after {
  border: none;
}

.action-btn.primary {
  background: rgba(255, 255, 255, 0.72);
  color: #c44536;
  box-shadow: var(--apple-shadow-surface);
  border-color: rgba(255, 130, 112, 0.34);
}

.action-btn.secondary {
  background: var(--gradient-primary);
  color: #fff;
  box-shadow: var(--shadow-success);
}

.action-btn.danger {
  background-color: rgba(255, 255, 255, 0.72);
  color: var(--text-primary);
  border: 1rpx solid rgba(255, 255, 255, 0.5);
  box-shadow: var(--apple-shadow-surface);
}

.dark-mode .action-btn.danger {
  background-color: var(--overlay);
}

.btn-hover {
  opacity: 0.85;
  transform: scale(0.98);
}

.action-btn:disabled {
  opacity: 0.5;
}

.btn-icon {
  font-size: 32rpx;
}

.btn-text {
  font-size: 30rpx;
}

/* F018: 骨架屏样式 */
.skeleton-profile {
  padding: 0 32rpx;
}

.skeleton-card {
  padding: 48rpx 32rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  /* gap: 16rpx; -- replaced for Android WebView compat */
  margin-bottom: 24rpx;
}

.skeleton-avatar {
  width: 160rpx;
  height: 160rpx;
  border-radius: 50%;
}

.skeleton-nickname {
  width: 200rpx;
  height: 40rpx;
  border-radius: 8rpx;
}

.skeleton-status {
  width: 140rpx;
  height: 26rpx;
  border-radius: 8rpx;
}

.skeleton-stats-row {
  display: flex;
  /* gap: 32rpx; -- replaced for Android WebView compat */
  width: 100%;
  justify-content: center;
  margin-top: 24rpx;
  padding-top: 24rpx;
  border-top: 1rpx solid var(--border);
}

.skeleton-stat {
  width: 120rpx;
  height: 60rpx;
  border-radius: 8rpx;
}

.skeleton-section {
  padding: 32rpx;
  margin-bottom: 24rpx;
}

.skeleton-section-title {
  width: 160rpx;
  height: 32rpx;
  border-radius: 8rpx;
  margin-bottom: 24rpx;
}

.skeleton-grid {
  display: flex;
  /* gap: 24rpx; -- replaced for Android WebView compat */
}

.skeleton-badge {
  width: 140rpx;
  height: 80rpx;
  border-radius: 16rpx;
}

.skeleton-pulse {
  background: linear-gradient(
    90deg,
    var(--bg-secondary, #f0f0f0) 25%,
    var(--bg-hover, #e0e0e0) 50%,
    var(--bg-secondary, #f0f0f0) 75%
  );
  background-size: 200% 100%;
  animation: skeletonPulse 1.5s ease-in-out infinite;
}

.dark-mode .skeleton-pulse {
  background: linear-gradient(
    90deg,
    var(--bg-glass, #2a2a2a) 25%,
    var(--overlay, #3a3a3a) 50%,
    var(--bg-glass, #2a2a2a) 75%
  );
  background-size: 200% 100%;
  animation: skeletonPulse 1.5s ease-in-out infinite;
}

@keyframes skeletonPulse {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}
</style>
