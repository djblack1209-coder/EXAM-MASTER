<template>
  <!-- 全屏强制接管：fixed 定位铺满整个屏幕 -->
  <view
    id="e2e-profile-root"
    class="fixed inset-0 w-full h-full z-0"
    :class="{ 'dark-mode': isDark }"
    :style="{
      transition: 'background 0.3s ease'
    }"
  >
    <!-- 微信隐私保护弹窗 -->
    <PrivacyPopup />
    <scroll-view scroll-y class="w-full h-full" :scroll-top="0" @scroll="onScroll">
      <!-- 内容区：顶部留出状态栏+导航栏空间，底部留出 TabBar 空间 -->
      <view
        class="content-wrapper"
        :style="{
          paddingTop: layoutInfo.statusBarHeight + 56 + 'px',
          paddingBottom: layoutInfo.tabBarHeight + 40 + 'px'
        }"
      >
        <!-- ========== 骨架屏加载状态 ========== -->
        <!-- #ifdef APP-PLUS -->
        <view v-if="isPageLoading" class="skeleton-wrapper">
          <view class="card skeleton-user-card">
            <view class="skeleton-avatar skeleton-animate" />
            <view class="skeleton-user-info">
              <view class="skeleton-name skeleton-animate" />
              <view class="skeleton-id skeleton-animate" />
            </view>
          </view>
          <view class="card skeleton-stats-card">
            <view v-for="i in 3" :key="i" class="skeleton-stat skeleton-animate" />
          </view>
          <view class="card skeleton-menu-card">
            <view v-for="i in 4" :key="i" class="skeleton-menu-item skeleton-animate" />
          </view>
        </view>
        <!-- #endif -->
        <!-- #ifndef APP-PLUS -->
        <!-- #ifndef APP-NVUE -->
        <transition name="skeleton-fade">
          <view v-if="isPageLoading" class="skeleton-wrapper">
            <view class="card skeleton-user-card">
              <view class="skeleton-avatar skeleton-animate" />
              <view class="skeleton-user-info">
                <view class="skeleton-name skeleton-animate" />
                <view class="skeleton-id skeleton-animate" />
              </view>
            </view>
            <view class="card skeleton-stats-card">
              <view v-for="i in 3" :key="i" class="skeleton-stat skeleton-animate" />
            </view>
            <view class="card skeleton-menu-card">
              <view v-for="i in 4" :key="i" class="skeleton-menu-item skeleton-animate" />
            </view>
          </view>
        </transition>
        <!-- #endif -->
        <!-- #ifdef APP-NVUE -->
        <template v-if="isPageLoading">
          <view class="card skeleton-user-card">
            <view class="skeleton-avatar skeleton-animate" />
            <view class="skeleton-user-info">
              <view class="skeleton-name skeleton-animate" />
              <view class="skeleton-id skeleton-animate" />
            </view>
          </view>
          <view class="card skeleton-stats-card">
            <view v-for="i in 3" :key="i" class="skeleton-stat skeleton-animate" />
          </view>
          <view class="card skeleton-menu-card">
            <view v-for="i in 4" :key="i" class="skeleton-menu-item skeleton-animate" />
          </view>
        </template>
        <!-- #endif -->
        <!-- #endif -->

        <!-- ========== 用户信息卡片 ========== -->
        <view v-if="!isPageLoading" class="card user-card" hover-class="card-hover" @tap="handleUserCardClick">
          <view class="user-section">
            <!-- 头像 -->
            <view class="avatar-box" @tap.stop="handleAvatarTap">
              <image
                v-if="userAvatar && userAvatar.startsWith('http')"
                class="avatar-image"
                :src="userAvatar"
                alt="头像"
                mode="aspectFill"
                lazy-load
              />
              <!-- [OK] F020: 未登录/无头像时使用默认头像图片代替 emoji -->
              <image
                v-else
                class="avatar-image avatar-default"
                src="/static/images/default-avatar.png"
                alt="头像"
                mode="aspectFill"
              />
              <view v-if="isLoggedIn" class="avatar-edit-badge">
                <BaseIcon name="camera" :size="20" />
              </view>
            </view>
            <!-- 用户信息 -->
            <view class="user-info">
              <text class="user-name">
                {{ userName }}
              </text>
              <text class="user-id" :class="{ 'login-hint': !isLoggedIn }">
                {{ isLoggedIn ? 'ID: ' + userId : '点击登录，同步学习数据' }}
              </text>
            </view>
            <!-- 编辑/登录按钮 -->
            <view
              id="e2e-profile-login-btn"
              class="edit-btn"
              hover-class="btn-hover"
              @tap.stop="isLoggedIn ? handleEditProfile() : handleLogin()"
            >
              <BaseIcon v-if="isLoggedIn" name="edit" :size="36" />
              <BaseIcon v-else name="arrow-right" :size="32" class="edit-icon" />
            </view>
          </view>
        </view>

        <!-- ========== 数据统计卡片 ========== -->
        <view v-if="!isPageLoading" class="card stats-card">
          <view class="stats-grid">
            <!-- 学习天数 -->
            <view class="stat-item" hover-class="stat-hover" @tap="handleStatTap('days')">
              <view class="stat-icon-box">
                <!-- 卡通图标替代装饰性 BaseIcon -->
                <image
                  class="feature-cartoon-icon"
                  src="/static/icons/clock-timer.png"
                  mode="aspectFit"
                  alt="学习天数"
                />
              </view>
              <text class="stat-value">
                {{ studyDays }}
              </text>
              <text class="stat-label"> 学习天数 </text>
            </view>

            <!-- 分隔线 -->
            <view class="stat-divider" />

            <!-- 获得勋章 -->
            <view class="stat-item" hover-class="stat-hover" @tap="handleStatTap('badges')">
              <view class="stat-icon-box">
                <!-- 卡通图标替代装饰性 BaseIcon -->
                <image
                  class="feature-cartoon-icon"
                  src="/static/icons/trophy-cup.png"
                  mode="aspectFit"
                  alt="获得勋章"
                />
              </view>
              <text class="stat-value">
                {{ badgeCount }}
              </text>
              <text class="stat-label"> 获得勋章 </text>
            </view>

            <!-- 分隔线 -->
            <view class="stat-divider" />

            <!-- 正确率 -->
            <view class="stat-item" hover-class="stat-hover" @tap="handleStatTap('accuracy')">
              <view class="stat-icon-box">
                <!-- 卡通图标替代装饰性 BaseIcon -->
                <image
                  class="feature-cartoon-icon"
                  src="/static/icons/target-bullseye.png"
                  mode="aspectFit"
                  alt="正确率"
                />
              </view>
              <text class="stat-value"> {{ accuracyRate }}% </text>
              <text class="stat-label"> 正确率 </text>
            </view>
          </view>
        </view>

        <!-- ========== 游戏化等级卡片 ========== -->
        <view v-if="!isPageLoading" class="card level-card">
          <view class="level-header">
            <view class="level-badge">
              <text class="level-number">{{ playerLevel }}</text>
            </view>
            <view class="level-info">
              <view class="level-title-row">
                <text class="level-title">Lv.{{ playerLevel }}</text>
                <text v-if="xpMultiplier > 1" class="xp-multiplier">{{ xpMultiplier }}x XP</text>
              </view>
              <view class="xp-bar-bg">
                <view class="xp-bar-fill" :style="{ width: levelProgress * 100 + '%' }" />
              </view>
              <text class="xp-text">{{ playerXp }} XP · 还需 {{ xpToNext }} 升级</text>
            </view>
          </view>

          <!-- 成就 + 连续学习 + 每日挑战 -->
          <view class="level-stats">
            <view class="level-stat-item">
              <text class="level-stat-value">连续 {{ currentStreak }}</text>
              <text class="level-stat-label">连续学习</text>
            </view>
            <view class="level-stat-divider" />
            <view class="level-stat-item">
              <text class="level-stat-value">{{ achievementCount }}</text>
              <text class="level-stat-label">成就解锁</text>
            </view>
            <view class="level-stat-divider" />
            <view v-if="dailyChallenge" class="level-stat-item">
              <text class="level-stat-value">
                {{ dailyChallenge.completed ? '完成' : '进行中' }} {{ dailyChallenge.progress }}/{{
                  dailyChallenge.target
                }}
              </text>
              <text class="level-stat-label">今日挑战</text>
            </view>
            <view v-else class="level-stat-item">
              <text class="level-stat-value">进行中 -</text>
              <text class="level-stat-label">今日挑战</text>
            </view>
          </view>
        </view>

        <!-- ========== 问题54：打卡卡片 ========== -->
        <view v-if="!isPageLoading" class="card checkin-card">
          <view class="checkin-header">
            <view class="checkin-title-row">
              <text class="checkin-title"> 每日打卡 </text>
              <view v-if="checkInStreak > 0" class="checkin-streak">
                <!-- 卡通火焰图标替代装饰性 BaseIcon -->
                <image
                  class="streak-flame-icon"
                  src="/static/icons/flame-streak.png"
                  mode="aspectFit"
                  alt="连续打卡火焰"
                />
                <text>连续 {{ checkInStreak }} 天</text>
              </view>
            </view>
            <text class="checkin-subtitle"> 坚持打卡，养成学习好习惯 </text>
          </view>

          <view class="checkin-content">
            <!-- 打卡按钮 -->
            <view
              id="e2e-profile-checkin-btn"
              class="checkin-btn"
              :class="{ checked: todayChecked, 'not-checked': !todayChecked }"
              hover-class="btn-hover"
              @tap="handleCheckIn"
            >
              <view class="checkin-btn-icon">
                <BaseIcon v-if="todayChecked" name="check" :size="36" />
                <BaseIcon v-else name="note" :size="36" />
              </view>
              <text class="checkin-btn-text">
                {{ todayChecked ? '今日已打卡' : '立即打卡' }}
              </text>
            </view>

            <!-- 补签卡信息 -->
            <view v-if="recoveryCards > 0 || missedDaysCount > 0" class="recovery-info">
              <view v-if="recoveryCards > 0" class="recovery-cards">
                <BaseIcon name="ticket" :size="28" />
                <text class="recovery-text"> 补签卡 x{{ recoveryCards }} </text>
              </view>
              <view
                v-if="missedDaysCount > 0 && recoveryCards > 0"
                class="use-recovery-btn"
                hover-class="btn-hover"
                @tap="showRecoveryOptions"
              >
                <text class="use-recovery-text"> 使用补签卡 </text>
              </view>
            </view>
          </view>

          <!-- 断签提示 -->
          <view v-if="missedDaysCount > 0 && !todayChecked" class="missed-tip">
            <view class="missed-icon">
              <BaseIcon name="warning" :size="28" />
            </view>
            <text class="missed-text"> 您已断签 {{ missedDaysCount }} 天，快来打卡恢复连续记录吧！ </text>
          </view>
        </view>

        <!-- ========== 功能菜单卡片（分组） ========== -->
        <view v-if="!isPageLoading" class="card menu-card">
          <!-- 我的错题 -->
          <view id="e2e-profile-menu-mistake" class="menu-item" hover-class="menu-hover" @tap="navToMistake">
            <view class="menu-icon-box">
              <BaseIcon name="books" :size="36" />
            </view>
            <text class="menu-text"> 我的错题 </text>
            <BaseIcon name="chevron-right" :size="24" class="menu-arrow" />
          </view>

          <!-- 分隔线 -->
          <view class="menu-divider" />

          <!-- 学习统计 -->
          <view id="e2e-profile-menu-study-detail" class="menu-item" hover-class="menu-hover" @tap="navToStudyDetail">
            <view class="menu-icon-box">
              <BaseIcon name="chart-bar" :size="36" />
            </view>
            <text class="menu-text"> 学习统计 </text>
            <BaseIcon name="chevron-right" :size="24" class="menu-arrow" />
          </view>

          <!-- 分隔线 -->
          <view class="menu-divider" />

          <!-- 系统设置 -->
          <view id="e2e-profile-menu-settings" class="menu-item" hover-class="menu-hover" @tap="navToSettings">
            <view class="menu-icon-box">
              <BaseIcon name="settings" :size="36" />
            </view>
            <text class="menu-text"> 系统设置 </text>
            <BaseIcon name="chevron-right" :size="24" class="menu-arrow" />
          </view>

          <!-- 分隔线 -->
          <view class="menu-divider" />

          <!-- 意见反馈 -->
          <view id="e2e-profile-menu-feedback" class="menu-item" hover-class="menu-hover" @tap="handleFeedback">
            <view class="menu-icon-box">
              <BaseIcon name="comment" :size="36" />
            </view>
            <text class="menu-text"> 意见反馈 </text>
            <BaseIcon name="chevron-right" :size="24" class="menu-arrow" />
          </view>
        </view>

        <!-- ========== 关于卡片 ========== -->
        <view v-if="!isPageLoading" class="card about-card">
          <view class="about-row">
            <text class="about-label"> 版本 </text>
            <text class="about-value"> v{{ appVersion }} </text>
          </view>
          <view class="about-divider" />
          <view class="about-row">
            <text class="about-label"> 开发者 </text>
            <text class="about-value"> Exam-Master Team </text>
          </view>
        </view>

        <!-- ========== 主题切换按钮 ========== -->
        <view
          v-if="!isPageLoading"
          id="e2e-profile-theme-btn"
          class="theme-btn"
          hover-class="btn-hover"
          @tap="toggleTheme"
        >
          <view class="theme-emoji">
            <BaseIcon v-if="isDark" name="moon" :size="36" />
            <BaseIcon v-else name="sun" :size="36" />
          </view>
          <text class="theme-text">
            {{ isDark ? '深色模式' : '浅色模式' }}
          </text>
        </view>

        <!-- ========== 退出登录按钮 ========== -->
        <view
          v-if="!isPageLoading && isLoggedIn"
          id="e2e-profile-logout-btn"
          class="logout-btn"
          hover-class="logout-hover"
          @tap="handleLogout"
        >
          <text class="logout-text"> 退出登录 </text>
        </view>
      </view>
    </scroll-view>

    <!-- 固定顶部导航栏 -->
    <view
      class="fixed-nav"
      :class="{ 'nav-scrolled': scrollY > 20 }"
      :style="{
        paddingTop: layoutInfo.statusBarHeight + 'px'
      }"
    >
      <view class="nav-content">
        <text class="nav-title"> 个人中心 </text>
      </view>
    </view>

    <!-- 底部 TabBar -->
    <CustomTabbar :is-dark="isDark" />

    <!-- 离线状态指示器 -->
    <OfflineIndicator :auto-show="true" position="top" :auto-hide-delay="5000" />
  </view>
</template>

<script setup>
import { modal } from '@/utils/modal.js';
import { toast } from '@/utils/toast.js';
import { ref, computed, onMounted, onBeforeUnmount, shallowRef, onErrorCaptured } from 'vue';
import { onShow, onHide, onShareAppMessage } from '@dcloudio/uni-app';
import CustomTabbar from '@/components/layout/custom-tabbar/custom-tabbar.vue';
import BaseIcon from '@/components/base/base-icon/base-icon.vue';
import PrivacyPopup from '@/components/common/privacy-popup.vue';
import { useStudyStore } from '@/stores/modules/study';
import { useUserStore } from '@/stores/modules/user';
// useGamificationStore — 动态导入减小主包体积
import { useProfileStore } from '@/stores/modules/profile';
import { useStatsStore } from '@/stores/modules/stats.js';
// 打卡和补签动态导入 — 瘦身主包
// import { checkinStreak } from '@/services/checkin-streak.js';
// import { streakRecovery } from '@/services/streak-recovery.js';
// [OK] 统一日志工具（生产环境自动禁用）
import { logger } from '@/utils/logger.js';

// 错误边界：捕获子组件运行时错误，防止整个页面白屏
onErrorCaptured((err, instance, info) => {
  logger.error('[个人中心] 子组件运行时错误:', err?.message || err, '| 来源:', info);
  return false;
});

import { vibrateLight } from '@/utils/helpers/haptic.js';
import { safeNavigateTo } from '@/utils/safe-navigate';
import { safeImport } from '@/utils/helpers/safe-import.js';
// [OK] F019: 统一使用 storageService 进行数据缓存管理
import storageService from '@/services/storageService.js';
import config from '@/config/index.js';
import { requireLogin } from '@/utils/auth/loginGuard.js';
import { getSystemTheme } from '@/utils/core/system.js';
import { NAV_BAR_COLORS } from '@/composables/useTheme.js';
import { filePathToBase64, inferImageMimeType } from '@/utils/helpers/image-base64.js';
// H025 FIX: 头像上传走 Service 层
import { uploadAvatar } from '@/services/api/domains/user.api.js';

// L6: 版本号从统一配置读取
const appVersion = config.appVersion || '1.0.0';

// ========== 响应式状态 ==========
const isDark = ref(false);
const scrollY = ref(0);
const badgeCount = ref(0);
const isPageLoading = ref(true); // 页面初始加载状态
// 检查点4.4: 打卡相关状态
const checkInStreak = ref(0); // 连续打卡天数
const todayChecked = ref(false); // 今日是否已打卡
// 动态加载的打卡模块引用
let _checkinStreak = null;
let _streakRecovery = null;
/** @type {number|null} 定时器ID跟踪（防泄漏） */
let _skeletonTimer = null;
let _milestoneTimer = null;
let _avatarReloadTimer = null;
let _logoutNavTimer = null;
const recoveryCards = ref(0); // 补签卡数量
const missedDaysCount = ref(0); // 问题54：断签天数

const layoutInfo = ref({
  statusBarHeight: 44,
  navBarHeight: 88,
  tabBarHeight: 90,
  safeAreaBottom: 0
});

// ========== Store ==========
const studyStore = useStudyStore();
const userStore = useUserStore();
// gamificationStore 延迟加载（动态导入减小主包体积）
const gamificationStore = shallowRef(null);
const profileStore = useProfileStore();
const statsStore = useStatsStore();

// ========== 游戏化计算属性（带 null 保护） ==========
const playerLevel = computed(() => gamificationStore.value?.level ?? 1);
const playerXp = computed(() => gamificationStore.value?.xp ?? 0);
const xpToNext = computed(() => gamificationStore.value?.xpToNextLevel ?? 100);
const levelProgress = computed(() => gamificationStore.value?.levelProgress ?? 0);
const currentStreak = computed(() => gamificationStore.value?.currentStreak ?? 0);
const achievementCount = computed(() => gamificationStore.value?.achievements?.length || 0);
const dailyChallenge = computed(() => gamificationStore.value?.dailyChallenge ?? null);
const xpMultiplier = computed(() => gamificationStore.value?.getXpMultiplier?.() ?? 1);

// ========== 计算属性 ==========
const isLoggedIn = computed(() => {
  return !!(userStore.isLogin || storageService.get('EXAM_USER_ID'));
});
const userName = computed(() => {
  if (!isLoggedIn.value) return '未登录';
  return userStore.userInfo?.nickName || storageService.get('userInfo')?.nickName || '学习者';
});
const userId = computed(() => {
  if (!isLoggedIn.value) return '点击登录';
  return userStore.userInfo?.userId || userStore.userInfo?._id || storageService.get('EXAM_USER_ID', '100001');
});
const studyDays = computed(() => statsStore.totalStudyDays || studyStore.studyProgress?.studyDays || 0);
const accuracyRate = computed(() => {
  // 优先使用后端统计数据
  if (statsStore.accuracy > 0) return statsStore.accuracy;
  // 降级到本地计算
  const progress = studyStore.studyProgress;
  if (!progress || !progress.totalQuestions || progress.totalQuestions === 0) {
    return 0;
  }
  return Math.round((progress.correctQuestions / progress.totalQuestions) * 100);
});

// 用户头像计算属性
const userAvatar = computed(() => {
  // 优先从 userStore 获取
  if (userStore.userInfo?.avatarUrl) {
    return userStore.userInfo.avatarUrl;
  }
  // 其次从本地存储获取
  const localUserInfo = storageService.get('userInfo');
  if (localUserInfo?.avatarUrl) {
    return localUserInfo.avatarUrl;
  }
  // 返回空，使用 emoji 默认头像
  return '';
});

// ========== 初始化方法 ==========
function initLayoutInfo() {
  try {
    const windowInfo = uni.getWindowInfo();
    const statusBarHeight = windowInfo.statusBarHeight || 44;
    const safeAreaBottom = windowInfo.safeAreaInsets?.bottom || 0;

    layoutInfo.value = {
      statusBarHeight,
      navBarHeight: statusBarHeight + 44,
      tabBarHeight: 60 + 12 + safeAreaBottom,
      safeAreaBottom
    };
  } catch {
    layoutInfo.value = {
      statusBarHeight: 44,
      navBarHeight: 88,
      tabBarHeight: 90,
      safeAreaBottom: 34
    };
  }
}

function initTheme() {
  // 优先读取用户保存的主题设置
  const savedTheme = storageService.get('theme_mode');
  if (savedTheme) {
    isDark.value = savedTheme === 'dark';
  } else {
    // 跟随系统
    isDark.value = getSystemTheme() === 'dark';
  }
}

function loadData() {
  isPageLoading.value = true;
  try {
    userStore.restoreUserInfo?.();
    studyStore.restoreProgress?.();
    gamificationStore.value?.restoreGamification?.();
    gamificationStore.value?.generateDailyChallenge?.();
    loadBadges();
    // 检查点4.4: 加载打卡数据
    loadCheckinData();
  } catch (error) {
    logger.error('[Profile] loadData error:', error);
    // P007: 提供用户反馈
    toast.info('个人数据加载失败，请下拉刷新重试');
  } finally {
    // 短暂延迟后关闭骨架屏，确保数据已渲染
    _skeletonTimer = setTimeout(() => {
      isPageLoading.value = false;
    }, 300);
  }
}

function loadBadges() {
  const achievements = storageService.get('learning_achievements', []);
  badgeCount.value = Array.isArray(achievements) ? achievements.length : 0;
}

// 检查点4.4: 加载打卡数据（动态导入瘦身主包）
async function loadCheckinData() {
  try {
    const [checkinMod, recoveryMod] = await Promise.all([
      safeImport(import('@/services/checkin-streak.js')),
      safeImport(import('@/services/streak-recovery.js'))
    ]);
    const checkinStreak = checkinMod.checkinStreak || checkinMod.default?.checkinStreak || checkinMod.default;
    const streakRecovery = recoveryMod.streakRecovery || recoveryMod.default?.streakRecovery || recoveryMod.default;
    // 缓存到模块变量供后续方法使用
    _checkinStreak = checkinStreak;
    _streakRecovery = streakRecovery;

    const userId = storageService.get('EXAM_USER_ID', 'default');
    await checkinStreak.init(userId);
    await streakRecovery.init(userId);

    const checkinInfo = checkinStreak.getCheckinInfo();
    checkInStreak.value = checkinInfo.currentStreak;
    todayChecked.value = checkinInfo.todayChecked;
    recoveryCards.value = streakRecovery.getRecoveryCards();
    missedDaysCount.value = checkinInfo.missedDays || 0; // 问题54：获取断签天数

    logger.log('[Profile] 打卡数据加载完成:', {
      streak: checkInStreak.value,
      todayChecked: todayChecked.value,
      recoveryCards: recoveryCards.value,
      missedDays: missedDaysCount.value
    });
  } catch (error) {
    logger.error('[Profile] loadCheckinData error:', error);
    // P007: 提供用户反馈，避免打卡数据静默丢失
    toast.info('打卡数据加载失败', 1500);
  }
}

// 检查点4.4: 执行打卡
async function handleCheckIn() {
  if (!isLoggedIn.value) {
    requireLogin(() => handleCheckIn(), { message: '请先登录后再打卡' });
    return;
  }
  if (todayChecked.value) {
    toast.info('今日已打卡');
    return;
  }

  try {
    const result = await _checkinStreak.checkIn();

    if (result.success && result.data) {
      todayChecked.value = true;
      checkInStreak.value = result.data.streak || 0;

      // 显示打卡成功提示
      toast.success(`打卡成功！连续${result.data.streak || 0}天`, 2000);

      // 如果有里程碑奖励
      if (result.data.milestone) {
        _milestoneTimer = setTimeout(() => {
          modal.show({
            title: '里程碑达成！',
            content: `恭喜连续打卡${result.data.streak}天！\n获得 ${result.data.milestone.exp} 经验 + ${result.data.milestone.coins} 金币`,
            showCancel: false,
            confirmText: '太棒了'
          });
        }, 1500);
      }
    } else {
      toast.info(result.message);
    }
  } catch (error) {
    logger.error('[Profile] handleCheckIn error:', error);
    toast.info('打卡失败，请稍后重试');
  }
}

// 检查点4.4: 使用补签卡
async function handleRecovery(date) {
  if (!isLoggedIn.value) {
    requireLogin(() => handleRecovery(date), { message: '请先登录后再补签' });
    return;
  }
  const checkResult = _streakRecovery.canRecover(date);

  if (!checkResult.canRecover) {
    toast.info(checkResult.reason);
    return;
  }

  // 显示补签选项
  const options = checkResult.options.filter((o) => o.available);
  if (options.length === 0) {
    toast.info('没有可用的补签方式');
    return;
  }

  // 优先使用免费补签
  const freeOption = options.find((o) => o.type === 'free');
  const cardOption = options.find((o) => o.type === 'card');

  let method = null;
  if (freeOption) {
    method = { type: 'free' };
  } else if (cardOption) {
    method = { type: 'card', cardType: cardOption.cardType };
  }

  if (!method) {
    toast.info('请先获取补签卡');
    return;
  }

  try {
    const result = await _streakRecovery.recover(date, method);

    if (result.success && result.data) {
      // 刷新打卡数据
      await loadCheckinData();

      toast.success(`补签成功！连续${result.data.streak || 0}天`);
    } else {
      toast.info(result.message);
    }
  } catch (error) {
    logger.error('[Profile] handleRecovery error:', error);
    toast.info('补签失败，请稍后重试');
  }
}

// 问题54：显示补签选项弹窗
function showRecoveryOptions() {
  // 获取可补签的日期列表
  const recoverableDates = _streakRecovery.getRecoverableDates();

  if (recoverableDates.length === 0) {
    toast.info('没有可补签的日期');
    return;
  }

  // 筛选出可以补签的日期（最近7天内）
  const availableDates = recoverableDates.filter((d) => d.canRecover && d.daysAgo <= 7).slice(0, 5);

  if (availableDates.length === 0) {
    toast.info('没有可补签的日期');
    return;
  }

  // 构建选项列表
  const dateOptions = availableDates.map((d) => {
    const dateObj = new Date(d.date);
    const month = dateObj.getMonth() + 1;
    const day = dateObj.getDate();
    return `${month}月${day}日 (${d.daysAgo}天前)`;
  });

  uni.showActionSheet({
    itemList: dateOptions,
    success: (res) => {
      const selectedDate = availableDates[res.tapIndex];
      if (selectedDate) {
        // 确认补签
        modal.show({
          title: '确认补签',
          content: `确定使用补签卡补签 ${dateOptions[res.tapIndex]} 吗？`,
          confirmText: '确认补签',
          success: (modalRes) => {
            if (modalRes.confirm) {
              handleRecovery(selectedDate.date);
            }
          }
        });
      }
    }
  });
}

// ========== 事件处理 ==========
function onScroll(e) {
  scrollY.value = e.detail.scrollTop;
}

function toggleTheme() {
  isDark.value = !isDark.value;
  const mode = isDark.value ? 'dark' : 'light';
  // [OK] F019: 统一使用 storageService
  storageService.save('theme_mode', mode);
  uni.$emit('themeUpdate', mode);

  // 同步更新导航栏颜色
  try {
    const colors = isDark.value ? NAV_BAR_COLORS.dark : NAV_BAR_COLORS.light;
    uni.setNavigationBarColor({
      frontColor: colors.frontColor,
      backgroundColor: colors.backgroundColor,
      animation: { duration: 200 }
    });
  } catch (e) {
    logger.warn('[Profile] setNavigationBarColor failed', e);
  }

  vibrateLight();

  // 显示切换成功提示
  toast.info(isDark.value ? '已开启深色模式' : '已关闭深色模式', 1500);
}

async function handleEditProfile() {
  modal.show({
    title: '编辑昵称',
    editable: true,
    placeholderText: '请输入新昵称',
    success: async (res) => {
      if (res.confirm && res.content) {
        const newName = res.content.trim();
        if (!newName) {
          toast.info('昵称不能为空');
          return;
        }
        try {
          // 1. 通过 profileStore 持久化到后端 MongoDB
          await profileStore.updateProfile({ action: 'update', nickname: newName });
          // 2. 同步更新 Pinia store + 本地存储
          userStore.updateUserInfo?.({ nickName: newName });
          // 3. 同步更新 login 页写入的 'userInfo' key（兼容双存储）
          const cached = storageService.get('userInfo', {});
          cached.nickName = newName;
          storageService.save('userInfo', cached);
          toast.success('更新成功');
        } catch (e) {
          logger.error('[Profile] 昵称更新失败:', e);
          toast.info('更新失败，请重试');
        }
      } else if (res.confirm && !res.content) {
        toast.info('昵称不能为空');
      }
    }
  });
}

// 处理用户卡片点击
function handleUserCardClick() {
  if (!isLoggedIn.value) {
    handleLogin();
  }
}

// 处理头像点击 - 上传新头像
function handleAvatarTap() {
  if (!isLoggedIn.value) {
    handleLogin();
    return;
  }

  vibrateLight();

  // 选择图片来源
  uni.showActionSheet({
    itemList: ['拍照', '从相册选择'],
    success: (res) => {
      const sourceType = res.tapIndex === 0 ? ['camera'] : ['album'];
      chooseAndUploadAvatar(sourceType);
    }
  });
}

// 选择并上传头像
async function chooseAndUploadAvatar(sourceType) {
  try {
    // 选择图片
    const chooseRes = await new Promise((resolve, reject) => {
      uni.chooseImage({
        count: 1,
        sizeType: ['compressed'],
        sourceType: sourceType,
        success: resolve,
        fail: reject
      });
    });

    if (!chooseRes.tempFilePaths || chooseRes.tempFilePaths.length === 0) {
      return;
    }

    const tempFilePath = chooseRes.tempFilePaths[0];

    // 显示上传中提示
    toast.loading('上传中...');

    // 获取用户ID
    const userId = storageService.get('EXAM_USER_ID') || userStore.userInfo?._id;
    if (!userId) {
      toast.hide();
      toast.info('请先登录');
      return;
    }

    // 上传到服务器
    const uploadRes = await uploadAvatarToServer(tempFilePath, userId);

    toast.hide();

    if (uploadRes.success) {
      // 更新本地存储
      // [OK] F019: 统一使用 storageService
      const localUserInfo = storageService.get('userInfo', {});
      localUserInfo.avatarUrl = uploadRes.avatarUrl;
      storageService.save('userInfo', localUserInfo);

      // 更新 userStore
      userStore.updateUserInfo?.({ avatarUrl: uploadRes.avatarUrl });

      // 通知其他页面
      uni.$emit('userInfoUpdated', { avatarUrl: uploadRes.avatarUrl });

      toast.success('头像更新成功');

      // [OK] P0-FIX: 强制刷新页面数据，确保头像立即显示
      _avatarReloadTimer = setTimeout(() => {
        loadData();
      }, 500);
    } else {
      toast.info(uploadRes.message || '上传失败');
    }
  } catch (error) {
    toast.hide();
    logger.error('[Profile] chooseAndUploadAvatar error:', error);

    // 用户取消选择不提示错误
    if (error.errMsg && error.errMsg.includes('cancel')) {
      return;
    }

    toast.info('上传失败，请重试');
  }
}

// 上传头像到服务器 — H025 FIX: 通过 Service 层 uploadAvatar 调用
async function uploadAvatarToServer(filePath, userId) {
  return uploadAvatar(filePath, userId, { filePathToBase64, inferImageMimeType });
}

// 处理登录
function handleLogin() {
  vibrateLight();

  // 跳转到登录页
  safeNavigateTo('/pages/login/index');
}

function handleStatTap(type) {
  const messages = {
    days: `累计学习 ${studyDays.value} 天`,
    badges: `已获得 ${badgeCount.value} 个勋章`,
    accuracy: `答题正确率 ${accuracyRate.value}%`
  };
  toast.info(messages[type] || '');
}

function navToMistake() {
  requireLogin(() => safeNavigateTo('/pages/mistake/index'), { message: '请先登录后查看错题集' });
}

function navToStudyDetail() {
  requireLogin(() => safeNavigateTo('/pages/study-detail/index'), { message: '请先登录后查看学习详情' });
}

function navToSettings() {
  safeNavigateTo('/pages/settings/index');
}

function handleFeedback() {
  modal.show({
    title: '意见反馈',
    content: '如有问题或建议，请联系：\nfeedback@exam-master.com',
    showCancel: false,
    confirmText: '知道了'
  });
}

function handleLogout() {
  modal.show({
    title: '确认退出',
    content: '确定要退出登录吗？',
    success: async (res) => {
      if (res.confirm) {
        try {
          // 调用 userStore 的 logout 方法
          userStore.logout();

          // 清除本地存储的用户信息
          storageService.remove('userInfo');
          storageService.remove('EXAM_USER_ID');
          // [OK] B021-3: 不再存储明文 user_id，无需清理
          storageService.remove('EXAM_TOKEN');

          // 通知其他页面登录状态变化
          uni.$emit('loginStatusChanged', false);

          toast.success('已退出登录');

          _logoutNavTimer = setTimeout(() => {
            uni.switchTab({ url: '/pages/index/index' });
          }, 1000);
        } catch (error) {
          logger.error('[Profile] 退出登录失败:', error);
          toast.info('退出失败，请重试');
        }
      }
    }
  });
}

// ========== 事件处理器（提升到模块作用域，确保 onHide 可访问） ==========
let _skipFirstShow = false; // 防止 onMounted + onShow 双重加载
const _themeHandler = (mode) => {
  isDark.value = mode === 'dark';
};
const _loginHandler = (isLoggedIn) => {
  logger.log('[Profile] 登录状态变化:', isLoggedIn);
  loadData();
};
const _userInfoHandler = (info) => {
  logger.log('[Profile] 用户信息更新:', info);
  loadData();
};

// ========== 生命周期 ==========

// [F2-FIX] 微信分享配置
onShareAppMessage(() => ({
  title: '个人中心 - Exam-Master 考研备考',
  path: '/pages/profile/index',
  imageUrl: '/static/images/app-share-cover.png'
}));

onMounted(async () => {
  initLayoutInfo();
  initTheme();

  // 动态导入 gamificationStore（减小主包体积）
  try {
    const gamMod = await safeImport(import('@/stores/modules/gamification'));
    const useGamificationStore = gamMod.useGamificationStore || gamMod.default?.useGamificationStore;
    gamificationStore.value = useGamificationStore();
  } catch {
    /* 游戏化功能降级 */
  }

  loadData();

  // 标记首次 onShow 跳过（onMounted 已加载数据）
  _skipFirstShow = true;

  // 监听系统主题变化（仅注册一次，不随 onHide 清理）
  try {
    uni.onThemeChange?.((res) => {
      const savedTheme = storageService.get('theme_mode');
      if (!savedTheme) {
        isDark.value = res.theme === 'dark';
      }
    });
  } catch {
    /* 主题监听非关键功能 */
  }
});

onShow(() => {
  // 原生 tabBar 已移除，无需隐藏
  // F005: 通知 CustomTabbar 重新检测路由
  uni.$emit('tabbarRouteUpdate');
  // 每次进入页面强制刷新主题状态
  initTheme();

  // 防止 onMounted + onShow 首次双重加载
  if (_skipFirstShow) {
    _skipFirstShow = false;
  } else {
    loadData();
  }

  // 安全修复：事件监听在 onShow 注册，与 onHide 的 $off 配对
  uni.$on('themeUpdate', _themeHandler);
  uni.$on('loginStatusChanged', _loginHandler);
  uni.$on('userInfoUpdated', _userInfoHandler);
});

onHide(() => {
  // 清理事件监听
  uni.$off('loginStatusChanged', _loginHandler);
  uni.$off('userInfoUpdated', _userInfoHandler);
  uni.$off('themeUpdate', _themeHandler);
});

// 组件销毁时清理所有定时器，防止内存泄漏
onBeforeUnmount(() => {
  if (_skeletonTimer) {
    clearTimeout(_skeletonTimer);
    _skeletonTimer = null;
  }
  if (_milestoneTimer) {
    clearTimeout(_milestoneTimer);
    _milestoneTimer = null;
  }
  if (_avatarReloadTimer) {
    clearTimeout(_avatarReloadTimer);
    _avatarReloadTimer = null;
  }
  if (_logoutNavTimer) {
    clearTimeout(_logoutNavTimer);
    _logoutNavTimer = null;
  }
});
</script>

<style lang="scss" scoped>
// ========== 基础布局 ==========
.fixed {
  position: fixed;
  background: var(--background);
}

.fixed::before,
.fixed::after {
  content: '';
  position: absolute;
  border-radius: 9999rpx;
  pointer-events: none;
  z-index: 0;
}

.fixed::before {
  width: 520rpx;
  height: 520rpx;
  top: -140rpx;
  left: -120rpx;
  background: radial-gradient(circle, rgba(88, 204, 2, 0.08) 0%, transparent 72%);
}

.fixed::after {
  width: 460rpx;
  height: 460rpx;
  right: -130rpx;
  top: 340rpx;
  background: radial-gradient(circle, rgba(88, 204, 2, 0.04) 0%, transparent 70%);
}

.inset-0 {
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
}

.w-full {
  width: 100%;
}

.h-full {
  height: 100%;
}

.z-0 {
  z-index: 0;
}

// ========== 内容区 ==========
.content-wrapper {
  padding-left: 32rpx;
  padding-right: 32rpx;
  position: relative;
  z-index: 1;
  padding-bottom: 24rpx;
}

// ========== 通用卡片 ==========
.card {
  position: relative;
  background: var(--bg-card);
  border: 2rpx solid rgba(0, 0, 0, 0.04);
  border-radius: 28rpx;
  margin-bottom: 24rpx;
  transition: all 0.24s ease;
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.06);
  overflow: hidden;
}

.card-hover {
  opacity: 0.9;
  transform: scale(0.99);
}

// ========== 用户卡片 ==========
.user-card {
  padding: 32rpx;
}

.user-card::before,
.checkin-card::before {
  content: '';
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  pointer-events: none;
  background: none;
}

.user-section {
  display: flex;
  align-items: center;
}

.avatar-box {
  position: relative;
  width: 120rpx;
  height: 120rpx;
  border-radius: 50%;
  background: rgba(88, 204, 2, 0.12);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 28rpx;
  flex-shrink: 0;
  overflow: visible;
  border: 2rpx solid rgba(0, 0, 0, 0.04);
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.06);
}

.avatar-emoji {
  font-size: 56rpx;
}

.avatar-image {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
}

.avatar-edit-badge {
  position: absolute;
  right: -4rpx;
  bottom: -4rpx;
  width: 40rpx;
  height: 40rpx;
  border-radius: 50%;
  background: #58cc02;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 3rpx solid var(--bg-card);
  box-shadow: 0 4rpx 0 #46a302;
}

.avatar-edit-icon {
  font-size: 20rpx;
}

.user-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  /* gap: 12rpx; -- replaced for Android WebView compat */
}

.user-name {
  font-size: 40rpx;
  font-weight: 800;
  line-height: 1.2;
  color: var(--text-primary);
}

.user-id {
  font-size: 26rpx;
  line-height: 1.2;
  color: var(--text-secondary);
}

.edit-btn {
  width: 88rpx;
  height: 88rpx;
  border-radius: 50%;
  background: var(--bg-card);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border: 2rpx solid rgba(0, 0, 0, 0.04);
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.06);
}

.edit-icon {
  font-size: 36rpx;
}

// ========== 统计卡片 ==========
.stats-card {
  padding: 32rpx 16rpx;
}

.stats-grid {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.stat-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12rpx 0;
}

.stat-hover {
  opacity: 0.7;
  transform: scale(0.95);
}

.stat-icon-box {
  width: 80rpx;
  height: 80rpx;
  border-radius: 22rpx;
  background: rgba(88, 204, 2, 0.12);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 16rpx;
  border: none;
}

.stat-emoji {
  font-size: 40rpx;
}

.stat-value {
  font-size: 48rpx;
  font-weight: 800;
  line-height: 1.1;
  margin-bottom: 8rpx;
  color: var(--text-primary);
}

.stat-label {
  font-size: 24rpx;
  font-weight: 600;
  line-height: 1.2;
  color: var(--text-secondary);
}

.stat-divider {
  width: 2rpx;
  height: 80rpx;
  background-color: rgba(0, 0, 0, 0.04);
  flex-shrink: 0;
}

// ========== 游戏化等级卡片 ==========
.level-card {
  padding: 32rpx;
}

.level-header {
  display: flex;
  align-items: center;
  margin-bottom: 28rpx;
}

.level-badge {
  width: 88rpx;
  height: 88rpx;
  border-radius: 50%;
  background: #58cc02;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 24rpx;
  flex-shrink: 0;
  box-shadow: 0 8rpx 0 #46a302;
}

.level-number {
  font-size: 36rpx;
  font-weight: 800;
  color: var(--text-inverse);
}

.level-info {
  flex: 1;
  min-width: 0;
}

.level-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12rpx;
}

.level-title {
  font-size: 32rpx;
  font-weight: 800;
  color: var(--text-primary);
}

.xp-multiplier {
  font-size: 22rpx;
  font-weight: 700;
  color: var(--warning);
  background: rgba(255, 150, 0, 0.12);
  padding: 4rpx 12rpx;
  border-radius: 12rpx;
}

.xp-bar-bg {
  height: 12rpx;
  background: rgba(0, 0, 0, 0.06);
  border-radius: 6rpx;
  overflow: hidden;
  margin-bottom: 8rpx;
}

.xp-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #58cc02, #89e219);
  border-radius: 6rpx;
  transition: width 0.5s ease-out;
}

.xp-text {
  font-size: 22rpx;
  color: var(--text-secondary);
}

.level-stats {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 24rpx;
  border-top: 2rpx solid rgba(0, 0, 0, 0.04);
}

.level-stat-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.level-stat-value {
  font-size: 28rpx;
  font-weight: 800;
  color: var(--text-primary);
  margin-bottom: 4rpx;
}

.level-stat-label {
  font-size: 22rpx;
  color: var(--text-secondary);
}

.level-stat-divider {
  width: 2rpx;
  height: 48rpx;
  background-color: rgba(0, 0, 0, 0.04);
  flex-shrink: 0;
}

.dark-mode .xp-bar-bg {
  background: rgba(255, 255, 255, 0.08);
}

// ========== 菜单卡片 ==========
.menu-card {
  padding: 0;
  overflow: hidden;
  background: var(--bg-card);
}

.menu-item {
  display: flex;
  align-items: center;
  min-height: 96rpx;
  padding: 28rpx 32rpx;
}

.menu-hover {
  background-color: rgba(0, 0, 0, 0.02);
}

.menu-icon-box {
  width: 76rpx;
  height: 76rpx;
  border-radius: 20rpx;
  background: rgba(88, 204, 2, 0.12);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 24rpx;
  flex-shrink: 0;
  border: none;
}

/* 我的错题 — 学习/数据类：绿色 */
.menu-item:nth-child(1) .menu-icon-box {
  background: rgba(88, 204, 2, 0.12);
}

/* 学习统计 — 学习/数据类：绿色 */
.menu-item:nth-child(3) .menu-icon-box {
  background: rgba(88, 204, 2, 0.12);
}

/* 系统设置 — 设置类：蓝色 */
.menu-item:nth-child(5) .menu-icon-box {
  background: rgba(28, 176, 246, 0.12);
}

/* 意见反馈 — 社交类：红色 */
.menu-item:nth-child(7) .menu-icon-box {
  background: rgba(255, 75, 75, 0.12);
}

.menu-emoji {
  font-size: 36rpx;
}

.menu-text {
  flex: 1;
  font-size: 32rpx;
  font-weight: 700;
  color: var(--text-primary);
}

.menu-arrow {
  font-size: 48rpx;
  font-weight: 300;
  flex-shrink: 0;
  color: var(--text-secondary);
}

.menu-divider {
  height: 2rpx;
  background-color: rgba(0, 0, 0, 0.04);
  margin-left: 132rpx;
}

// ========== 关于卡片 ==========
.about-card {
  padding: 0;
  overflow: hidden;
  background: var(--bg-card);
}

.about-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 28rpx 32rpx;
}

.about-label {
  font-size: 28rpx;
  font-weight: 600;
  color: var(--text-secondary);
}

.about-value {
  font-size: 28rpx;
  font-weight: 700;
  color: var(--text-primary);
}

.about-divider {
  height: 2rpx;
  background-color: rgba(0, 0, 0, 0.04);
  margin-left: 32rpx;
  margin-right: 32rpx;
}

// ========== 主题切换按钮 ==========
.theme-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  /* gap: 16rpx; -- replaced for Android WebView compat */
  padding: 28rpx;
  border-radius: 24rpx;
  margin-bottom: 24rpx;
  background-color: var(--bg-card);
  border: 2rpx solid rgba(0, 0, 0, 0.04);
  box-shadow: 0 8rpx 0 rgba(0, 0, 0, 0.08);
}

.theme-emoji {
  width: 64rpx;
  height: 64rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 999rpx;
  font-size: 36rpx;
}

.theme-text {
  font-size: 30rpx;
  font-weight: 700;
  color: var(--text-primary);
}

// ========== 退出按钮 ==========
.logout-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 28rpx;
  border-radius: 24rpx;
  margin-bottom: 24rpx;
  background-color: var(--bg-card);
  border: 2rpx solid rgba(255, 75, 75, 0.2);
  box-shadow: 0 8rpx 0 rgba(255, 75, 75, 0.15);
}

.logout-text {
  font-size: 30rpx;
  font-weight: 700;
  color: var(--danger);
}

.logout-hover {
  background-color: rgba(255, 75, 75, 0.06);
  transform: translateY(4rpx);
  box-shadow: 0 4rpx 0 rgba(255, 75, 75, 0.15);
}

// ========== 按钮通用 hover ==========
.btn-hover {
  opacity: 0.9;
  transform: translateY(4rpx);
}

// ========== 骨架屏样式 ==========
.skeleton-user-card {
  padding: 32rpx;
  display: flex;
  align-items: center;
}

.skeleton-avatar {
  width: 120rpx;
  height: 120rpx;
  border-radius: 50%;
  margin-right: 28rpx;
}

.skeleton-user-info {
  flex: 1;
}

.skeleton-name {
  width: 160rpx;
  height: 40rpx;
  border-radius: 8rpx;
  margin-bottom: 16rpx;
}

.skeleton-id {
  width: 120rpx;
  height: 26rpx;
  border-radius: 6rpx;
}

.skeleton-stats-card {
  padding: 32rpx 16rpx;
  display: flex;
  justify-content: space-around;
}

.skeleton-stat {
  width: 120rpx;
  height: 100rpx;
  border-radius: 16rpx;
}

.skeleton-menu-card {
  padding: 16rpx 0;
}

.skeleton-menu-item {
  height: 88rpx;
  margin: 8rpx 32rpx;
  border-radius: 16rpx;
}

.skeleton-animate {
  background: linear-gradient(90deg, var(--muted) 25%, var(--background) 50%, var(--muted) 75%);
  background-size: 200% 100%;
  animation: skeleton-loading 1.5s infinite;
}

@keyframes skeleton-loading {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}

// ========== 固定导航栏 ==========
.fixed-nav {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
  background-color: transparent;
  transition: all 0.3s ease;
}

.fixed-nav.nav-scrolled {
  background: var(--bg-card);
  border-bottom: 2rpx solid rgba(0, 0, 0, 0.04);
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.06);
}

.nav-content {
  height: 88rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.nav-title {
  font-size: 36rpx;
  font-weight: 800;
  color: var(--text-primary);
}

// ========== 问题54：打卡卡片样式 ==========
.checkin-card {
  position: relative;
  padding: 32rpx;
}

.dark-mode .card {
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.08) 0%, transparent 34%),
    linear-gradient(160deg, rgba(24, 26, 34, 0.76) 0%, rgba(18, 20, 28, 0.88) 100%);
}

.dark-mode .avatar-box,
.dark-mode .edit-btn,
.dark-mode .stat-icon-box,
.dark-mode .menu-icon-box {
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.1) 0%, transparent 44%),
    linear-gradient(160deg, rgba(28, 32, 40, 0.92) 0%, rgba(18, 20, 28, 0.88) 100%);
  border-color: rgba(255, 255, 255, 0.08);
  box-shadow: 0 12rpx 26rpx rgba(0, 0, 0, 0.24);
}

.dark-mode .avatar-edit-badge,
.dark-mode .edit-btn,
.dark-mode .stat-icon-box,
.dark-mode .menu-icon-box,
.dark-mode .theme-emoji,
.dark-mode .checkin-btn-icon,
.dark-mode .missed-icon {
  background:
    linear-gradient(180deg, rgba(10, 132, 255, 0.12) 0%, transparent 42%),
    linear-gradient(160deg, rgba(18, 20, 28, 0.94) 0%, rgba(10, 12, 18, 0.9) 100%);
  border-color: rgba(10, 132, 255, 0.18);
  box-shadow: var(--apple-shadow-surface);
}

.dark-mode .avatar-edit-badge,
.dark-mode .theme-emoji,
.dark-mode .checkin-btn-icon,
.dark-mode .missed-icon {
  border-style: solid;
  border-width: 1rpx;
}

.dark-mode .menu-hover {
  background-color: rgba(255, 255, 255, 0.04);
}

.dark-mode .menu-divider,
.dark-mode .about-divider {
  background-color: rgba(255, 255, 255, 0.08);
}

.checkin-header {
  margin-bottom: 24rpx;
}

.checkin-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8rpx;
}

.checkin-title {
  font-size: 34rpx;
  font-weight: 800;
  color: var(--text-primary);
}

.checkin-streak {
  font-size: 26rpx;
  color: var(--warning);
  font-weight: 700;
}
/* 卡通火焰图标 */
.streak-flame-icon {
  width: 56rpx;
  height: 56rpx;
}

.checkin-subtitle {
  font-size: 24rpx;
  color: var(--text-secondary);
}

.checkin-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  /* gap: 24rpx; -- replaced for Android WebView compat */
}

.checkin-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  /* gap: 12rpx; -- replaced for Android WebView compat */
  padding: 28rpx 40rpx;
  border-radius: 50rpx;
  transition: all 0.3s ease;
}

.checkin-btn.not-checked {
  background: #58cc02;
  border: none;
  box-shadow: 0 8rpx 0 #46a302;
}

.checkin-btn.checked {
  background: rgba(0, 0, 0, 0.04);
  border: 2rpx solid rgba(0, 0, 0, 0.04);
}

.checkin-btn-icon {
  width: 56rpx;
  height: 56rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 999rpx;
  font-size: 36rpx;
}

.checkin-btn-text {
  font-size: 30rpx;
  font-weight: 700;
  color: var(--text-primary);
}

.checkin-btn.not-checked .checkin-btn-text {
  color: var(--text-inverse);
}

.checkin-btn.not-checked .checkin-btn-icon {
  color: var(--text-inverse);
}

.recovery-info {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  /* gap: 12rpx; -- replaced for Android WebView compat */
}

.recovery-cards {
  display: flex;
  align-items: center;
  /* gap: 8rpx; -- replaced for Android WebView compat */
}

.recovery-icon {
  font-size: 28rpx;
}

.recovery-text {
  font-size: 24rpx;
  color: var(--text-secondary);
}

.use-recovery-btn {
  padding: 12rpx 24rpx;
  background: rgba(255, 150, 0, 0.12);
  border-radius: 20rpx;
  border: 2rpx solid var(--warning);
}

.use-recovery-text {
  font-size: 24rpx;
  color: var(--warning);
  font-weight: 600;
}

.missed-tip {
  display: flex;
  align-items: center;
  /* gap: 12rpx; -- replaced for Android WebView compat */
  margin-top: 20rpx;
  padding: 16rpx 20rpx;
  background: rgba(255, 150, 0, 0.08);
  border-radius: 16rpx;
  border: 2rpx solid rgba(255, 150, 0, 0.2);
}

.missed-icon {
  width: 48rpx;
  height: 48rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 999rpx;
  font-size: 28rpx;
}

.missed-text {
  font-size: 24rpx;
  color: var(--warning);
  flex: 1;
}

/* 骨架屏淡出过渡 */
.skeleton-fade-leave-active {
  transition: opacity 0.35s ease-out;
}
.skeleton-fade-leave-to {
  opacity: 0;
}

/* 功能级卡通图标（替代 BaseIcon size 36-79） */
.feature-cartoon-icon {
  width: 80rpx;
  height: 80rpx;
}
</style>
