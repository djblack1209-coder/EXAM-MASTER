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
              <!-- 生命值装饰 -->
              <image class="heart-deco" src="./static/effects/heart-lives.png" mode="aspectFit" lazy-load />
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
            <BaseIcon name="cross" :size="32" class="btn-icon" />
            <text class="btn-text"> 删除好友 </text>
          </button>
        </view>
      </template>
    </scroll-view>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue';
import { onLoad, onUnload } from '@dcloudio/uni-app';
import { modal } from '@/utils/modal.js';
import { toast } from '@/utils/toast.js';
import { socialService } from './socialService.js';
import { logger } from '@/utils/logger.js';
import { safeNavigateTo, safeNavigateBack } from '@/utils/safe-navigate';
// ✅ F019: 统一使用 storageService
import storageService from '@/services/storageService.js';
import BaseIcon from '@/components/base/base-icon/base-icon.vue';

// 统一默认头像
const DEFAULT_AVATAR = '/static/images/default-avatar.png';

// --- 非响应式实例属性（定时器引用） ---
let _navTimer = null;

// --- 响应式状态 ---
const isDark = ref(false);
const isPageLoading = ref(true); // F018: 页面加载状态
const friendInfo = ref({});
const isActionLoading = ref(false);
const defaultAvatar = DEFAULT_AVATAR;
// 成就数据从好友信息中获取（achievement-manager 提供）
const achievements = ref([]);
// 模拟动态数据
const recentActivities = ref([]);

// --- 计算属性 ---
const isOnline = computed(() => {
  if (!friendInfo.value.last_active) return false;
  const now = Date.now();
  return now - friendInfo.value.last_active < 5 * 60 * 1000;
});

const statusText = computed(() => {
  if (isOnline.value) return '在线';
  if (!friendInfo.value.last_active) return '很久未见';

  const now = Date.now();
  const diff = now - friendInfo.value.last_active;
  const minutes = Math.floor(diff / (60 * 1000));
  const hours = Math.floor(diff / (60 * 60 * 1000));
  const days = Math.floor(diff / (24 * 60 * 60 * 1000));

  if (minutes < 60) return `${minutes}分钟前活跃`;
  if (hours < 24) return `${hours}小时前活跃`;
  if (days < 7) return `${days}天前活跃`;
  return '很久未见';
});

// --- 方法 ---

/** 返回上一页 */
function goBack() {
  safeNavigateBack();
}

/** 头像加载失败时使用默认头像 */
function onAvatarError() {
  logger.warn('[FriendProfile] 头像加载失败，使用默认头像');
  friendInfo.value.avatar = defaultAvatar;
}

/** 根据好友数据生成模拟动态 */
function generateActivities() {
  const activities = [];

  if (friendInfo.value.studyDays > 0) {
    activities.push({
      icon: 'calendar',
      text: `已坚持学习 ${friendInfo.value.studyDays} 天`,
      time: '持续中'
    });
  }

  if (friendInfo.value.score > 0) {
    activities.push({
      icon: 'trophy',
      text: `累计获得 ${friendInfo.value.score} 分`,
      time: '总计'
    });
  }

  if (friendInfo.value.accuracy > 0) {
    activities.push({
      icon: 'target',
      text: `答题正确率达到 ${friendInfo.value.accuracy}%`,
      time: '当前'
    });
  }

  recentActivities.value = activities;
}

/** 发起 PK 挑战 */
function handlePKChallenge() {
  if (isActionLoading.value) return;
  isActionLoading.value = true;

  logger.log('[FriendProfile] 发起 PK 挑战:', friendInfo.value.nickname);

  modal.show({
    title: '发起挑战',
    content: `确定要向 ${friendInfo.value.nickname} 发起 PK 挑战吗？`,
    confirmText: '挑战',
    success: (res) => {
      isActionLoading.value = false;
      if (res.confirm) {
        safeNavigateTo(
          `/pages/practice-sub/pk-battle?mode=friend&opponentId=${friendInfo.value.uid}&opponentName=${encodeURIComponent(friendInfo.value.nickname)}&opponentAvatar=${encodeURIComponent(friendInfo.value.avatar)}&opponentScore=${friendInfo.value.score}`
        );
      }
    },
    fail: () => {
      isActionLoading.value = false;
    }
  });
}

/** 删除好友 */
async function handleRemoveFriend() {
  if (isActionLoading.value) return;
  isActionLoading.value = true;

  logger.log('[FriendProfile] 删除好友:', friendInfo.value.nickname);

  modal.show({
    title: '删除好友',
    content: `确定要删除好友 ${friendInfo.value.nickname} 吗？删除后需要重新添加。`,
    confirmText: '删除',
    confirmColor: '#FF4757',
    success: async (res) => {
      if (res.confirm) {
        toast.loading('处理中...');

        try {
          const result = await socialService.removeFriend(friendInfo.value.uid);

          toast.hide();
          isActionLoading.value = false;

          if (result.code === 0) {
            toast.success('已删除好友');
            // 返回上一页
            _navTimer = setTimeout(() => {
              safeNavigateBack();
            }, 1500);
          } else {
            toast.info(result.msg || '删除失败');
          }
        } catch (err) {
          toast.hide();
          isActionLoading.value = false;
          logger.error('[FriendProfile] 删除好友失败:', err);
          toast.info('删除失败');
        }
      } else {
        isActionLoading.value = false;
      }
    },
    fail: () => {
      isActionLoading.value = false;
    }
  });
}

// --- 生命周期 / 页面钩子 ---

onLoad((options) => {
  logger.log('[FriendProfile] 页面加载, options:', options);
  isDark.value = storageService.get('theme_mode') === 'dark';

  // 从路由参数获取好友信息
  if (options) {
    friendInfo.value = {
      uid: options.uid || '',
      nickname: options.nickname ? decodeURIComponent(options.nickname) : '未命名',
      avatar: options.avatar ? decodeURIComponent(options.avatar) : defaultAvatar,
      score: parseInt(options.score) || 0,
      studyDays: parseInt(options.studyDays) || 0,
      accuracy: parseInt(options.accuracy) || 0,
      last_active: parseInt(options.lastActive) || 0
    };
  }

  // 生成模拟动态
  generateActivities();

  // F018: 数据加载完成
  isPageLoading.value = false;
});

// [R397] 页面卸载时清理待执行的导航延迟定时器
onUnload(() => {
  if (_navTimer) {
    clearTimeout(_navTimer);
    _navTimer = null;
  }
});
</script>

<style lang="scss" scoped>
.container {
  min-height: 100%;
  min-height: 100vh;
  background-color: var(--background);
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
  background: var(--bg-card);
  z-index: 999;
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.06);
  border-bottom: 2rpx solid rgba(0, 0, 0, 0.04);
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
  font-weight: 800;
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
  background: var(--bg-card);
  border-radius: 28rpx;
  margin: 0 32rpx 24rpx;
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.06);
  border: 2rpx solid rgba(0, 0, 0, 0.04);
}

.glass-card::before {
  content: none;
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
  border: 4rpx solid rgba(0, 0, 0, 0.04);
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.06);
}

.online-dot {
  position: absolute;
  bottom: 8rpx;
  right: 8rpx;
  width: 28rpx;
  height: 28rpx;
  background-color: #58cc02;
  border-radius: 50%;
  border: 4rpx solid #ffffff;
}

.dark-mode .online-dot {
  border-color: var(--bg-glass);
}

.level-badge {
  position: absolute;
  bottom: -8rpx;
  left: 50%;
  transform: translateX(-50%);
  background: var(--danger);
  padding: 6rpx 20rpx;
  border-radius: 999rpx;
  border: none;
  box-shadow: 0 4rpx 0 #cc3333;
}

.level-text {
  font-size: 22rpx;
  font-weight: 700;
  color: var(--text-inverse);
}

.info-section {
  text-align: center;
  margin-bottom: 32rpx;
}

.nickname {
  display: block;
  font-size: 40rpx;
  font-weight: 800;
  color: var(--text-primary);
  margin-bottom: 8rpx;
}

.status-text {
  font-size: 26rpx;
  color: var(--text-secondary);
}

/* 统计行 */
.stats-row {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  padding: 24rpx 0;
  border-top: 2rpx solid rgba(0, 0, 0, 0.04);
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
  font-weight: 800;
  color: var(--text-primary);
}

.stat-value.highlight {
  color: var(--danger);
}

.stat-label {
  font-size: 24rpx;
  color: var(--text-secondary);
  font-weight: 600;
}

.stat-divider {
  width: 2rpx;
  height: 60rpx;
  background-color: rgba(0, 0, 0, 0.04);
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
  font-weight: 800;
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
  background-color: rgba(255, 75, 75, 0.08);
  border-radius: 22rpx;
  min-width: 140rpx;
  border: 2rpx solid rgba(0, 0, 0, 0.04);
  box-shadow: none;
  margin-right: 24rpx;
  margin-bottom: 24rpx;
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
  color: var(--text-secondary);
  font-weight: 600;
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
  background-color: rgba(255, 75, 75, 0.06);
  border-radius: 22rpx;
  border: 2rpx solid rgba(0, 0, 0, 0.04);
  margin-bottom: 20rpx;
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
  font-weight: 700;
  color: var(--text-primary);
}

.activity-time {
  font-size: 22rpx;
  color: var(--text-secondary);
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
  font-weight: 700;
  border: none;
  margin-bottom: 20rpx;
}

.action-btn::after {
  border: none;
}

.action-btn.primary {
  background: var(--danger);
  color: var(--text-inverse);
  box-shadow: 0 8rpx 0 #cc3333;
  border-color: transparent;
}

.action-btn.secondary {
  background: #58cc02;
  color: var(--text-inverse);
  box-shadow: 0 8rpx 0 #46a302;
}

.action-btn.danger {
  background-color: var(--background);
  color: var(--text-primary);
  border: 2rpx solid rgba(0, 0, 0, 0.06);
  box-shadow: none;
}

.dark-mode .action-btn.danger {
  background-color: var(--overlay);
}

.btn-hover {
  opacity: 0.85;
  transform: translateY(4rpx);
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
    var(--bg-secondary, var(--muted)) 25%,
    var(--bg-hover, var(--border)) 50%,
    var(--bg-secondary, var(--muted)) 75%
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

/* 生命值装饰图标 */
.heart-deco {
  width: 48rpx;
  height: 48rpx;
}
</style>
