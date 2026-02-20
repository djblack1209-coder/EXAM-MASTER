<template>
  <view :class="['container', { 'dark-mode': isDark }]">
    <!-- 自定义导航栏 -->
    <view class="custom-navbar">
      <view class="status-bar" />
      <view class="navbar-content">
        <view class="navbar-left" hover-class="nav-hover" @tap="goBack">
          <text class="back-icon"> ‹ </text>
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
              <text class="achievement-icon">
                {{ badge.icon }}
              </text>
              <text class="achievement-name">
                {{ badge.name }}
              </text>
            </view>
            <view v-if="achievements.length === 0" class="achievement-item empty">
              <text class="achievement-icon"> 🏅 </text>
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
              <text class="activity-icon">
                {{ activity.icon }}
              </text>
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
              <text class="activity-icon"> 📝 </text>
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
            <text class="btn-icon"> 🔥 </text>
            <text class="btn-text"> 发起 PK 挑战 </text>
          </button>
          <!-- 消息功能暂未开放，隐藏按钮 -->
          <!-- <button class="action-btn secondary" hover-class="btn-hover" @tap="handleSendMessage"
					:disabled="isActionLoading">
					<text class="btn-icon">💬</text>
					<text class="btn-text">发送消息</text>
				</button> -->
          <button
            class="action-btn danger"
            hover-class="btn-hover"
            :disabled="isActionLoading"
            @tap="handleRemoveFriend"
          >
            <text class="btn-icon"> 👋 </text>
            <text class="btn-text"> 删除好友 </text>
          </button>
        </view>
      </template>
    </scroll-view>
  </view>
</template>

<script>
import { socialService } from './socialService.js';
import { logger } from '@/utils/logger.js';
import { safeNavigateTo } from '@/utils/safe-navigate';
// 统一默认头像
const DEFAULT_AVATAR = '/static/images/default-avatar.png';
// ✅ F019: 统一使用 storageService
import storageService from '@/services/storageService.js';

export default {
  name: 'FriendProfile',
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
      uni.navigateBack({
        delta: 1,
        fail: () => {
          uni.switchTab({ url: '/pages/profile/index' });
        }
      });
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
          icon: '📅',
          text: `已坚持学习 ${this.friendInfo.studyDays} 天`,
          time: '持续中'
        });
      }

      if (this.friendInfo.score > 0) {
        activities.push({
          icon: '🏆',
          text: `累计获得 ${this.friendInfo.score} 分`,
          time: '总计'
        });
      }

      if (this.friendInfo.accuracy > 0) {
        activities.push({
          icon: '🎯',
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
            uni.showLoading({ title: '处理中...' });

            try {
              const result = await socialService.removeFriend(this.friendInfo.uid);

              uni.hideLoading();
              this.isActionLoading = false;

              if (result.code === 0) {
                uni.showToast({
                  title: '已删除好友',
                  icon: 'success'
                });
                // 返回上一页
                setTimeout(() => {
                  uni.navigateBack();
                }, 1500);
              } else {
                uni.showToast({
                  title: result.msg || '删除失败',
                  icon: 'none'
                });
              }
            } catch (err) {
              uni.hideLoading();
              this.isActionLoading = false;
              logger.error('[FriendProfile] 删除好友失败:', err);
              uni.showToast({
                title: '删除失败',
                icon: 'none'
              });
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
  background-color: var(--bg-card);
  z-index: 999;
  box-shadow: var(--shadow-sm);
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
  min-height: 100vh;
  box-sizing: border-box;
}

/* 玻璃卡片 */
.glass-card {
  background-color: var(--bg-card);
  border-radius: 24rpx;
  margin: 0 32rpx 24rpx;
  box-shadow: var(--shadow-md);
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
  border: 4rpx solid var(--brand-color);
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
  background: var(--gradient-primary);
  padding: 6rpx 20rpx;
  border-radius: 20rpx;
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
  border-top: 1rpx solid var(--border);
}

.stat-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8rpx;
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
  font-size: 32rpx;
  font-weight: 600;
  color: var(--text-primary);
}

/* 成就网格 */
.achievement-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 24rpx;
}

.achievement-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8rpx;
  padding: 20rpx 24rpx;
  background-color: var(--bg-secondary);
  border-radius: 16rpx;
  min-width: 140rpx;
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
  gap: 20rpx;
}

.activity-item {
  display: flex;
  align-items: flex-start;
  gap: 16rpx;
  padding: 16rpx;
  background-color: var(--bg-secondary);
  border-radius: 16rpx;
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
  gap: 4rpx;
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
  gap: 20rpx;
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12rpx;
  padding: 28rpx 0;
  border-radius: 48rpx;
  font-size: 30rpx;
  font-weight: 600;
  border: none;
}

.action-btn::after {
  border: none;
}

.action-btn.primary {
  background: var(--gradient-danger);
  color: #fff;
  box-shadow: var(--shadow-danger);
}

.action-btn.secondary {
  background: var(--gradient-primary);
  color: #fff;
  box-shadow: var(--shadow-success);
}

.action-btn.danger {
  background-color: var(--bg-secondary);
  color: var(--danger);
  border: 2rpx solid var(--danger);
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
  gap: 16rpx;
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
  gap: 32rpx;
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
  gap: 24rpx;
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
