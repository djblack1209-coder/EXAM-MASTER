<template>
  <!-- 全屏强制接管：fixed 定位铺满整个屏幕 -->
  <view
    class="fixed inset-0 w-full h-full z-0"
    :class="{ 'dark-mode': isDark }"
    :style="{
      backgroundColor: 'var(--bg-page)',
      transition: 'background-color 0.3s ease'
    }"
  >
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

        <!-- ========== 用户信息卡片 ========== -->
        <view v-if="!isPageLoading" class="card user-card" hover-class="card-hover" @tap="handleUserCardClick">
          <view class="user-section">
            <!-- 头像 -->
            <view class="avatar-box" @tap.stop="handleAvatarTap">
              <image
                v-if="userAvatar && userAvatar.startsWith('http')"
                class="avatar-image"
                :src="userAvatar"
                mode="aspectFill"
              />
              <!-- ✅ F020: 未登录/无头像时使用默认头像图片代替 emoji -->
              <image
                v-else
                class="avatar-image avatar-default"
                src="/static/images/default-avatar.png"
                mode="aspectFill"
              />
              <view v-if="isLoggedIn" class="avatar-edit-badge">
                <text class="avatar-edit-icon"> 📷 </text>
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
            <view class="edit-btn" hover-class="btn-hover" @tap.stop="isLoggedIn ? handleEditProfile() : handleLogin()">
              <text class="edit-icon">
                {{ isLoggedIn ? '✏️' : '→' }}
              </text>
            </view>
          </view>
        </view>

        <!-- ========== 数据统计卡片 ========== -->
        <view v-if="!isPageLoading" class="card stats-card">
          <view class="stats-grid">
            <!-- 学习天数 -->
            <view class="stat-item" hover-class="stat-hover" @tap="handleStatTap('days')">
              <view class="stat-icon-box">
                <text class="stat-emoji"> 📅 </text>
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
                <text class="stat-emoji"> 🏆 </text>
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
                <text class="stat-emoji"> 🎯 </text>
              </view>
              <text class="stat-value"> {{ accuracyRate }}% </text>
              <text class="stat-label"> 正确率 </text>
            </view>
          </view>
        </view>

        <!-- ========== 问题54：打卡卡片 ========== -->
        <view v-if="!isPageLoading" class="card checkin-card">
          <view class="checkin-header">
            <view class="checkin-title-row">
              <text class="checkin-title"> 每日打卡 </text>
              <text v-if="checkInStreak > 0" class="checkin-streak"> 🔥 连续 {{ checkInStreak }} 天 </text>
            </view>
            <text class="checkin-subtitle"> 坚持打卡，养成学习好习惯 </text>
          </view>

          <view class="checkin-content">
            <!-- 打卡按钮 -->
            <view
              class="checkin-btn"
              :class="{ checked: todayChecked, 'not-checked': !todayChecked }"
              hover-class="btn-hover"
              @tap="handleCheckIn"
            >
              <text class="checkin-btn-icon">
                {{ todayChecked ? '✓' : '📝' }}
              </text>
              <text class="checkin-btn-text">
                {{ todayChecked ? '今日已打卡' : '立即打卡' }}
              </text>
            </view>

            <!-- 补签卡信息 -->
            <view v-if="recoveryCards > 0 || missedDaysCount > 0" class="recovery-info">
              <view v-if="recoveryCards > 0" class="recovery-cards">
                <text class="recovery-icon"> 🎫 </text>
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
            <text class="missed-icon"> ⚠️ </text>
            <text class="missed-text"> 您已断签 {{ missedDaysCount }} 天，快来打卡恢复连续记录吧！ </text>
          </view>
        </view>

        <!-- ========== 功能菜单卡片（分组） ========== -->
        <view v-if="!isPageLoading" class="card menu-card">
          <!-- 我的错题 -->
          <view class="menu-item" hover-class="menu-hover" @tap="navToMistake">
            <view class="menu-icon-box">
              <text class="menu-emoji"> 📚 </text>
            </view>
            <text class="menu-text"> 我的错题 </text>
            <text class="menu-arrow"> › </text>
          </view>

          <!-- 分隔线 -->
          <view class="menu-divider" />

          <!-- 学习统计 -->
          <view class="menu-item" hover-class="menu-hover" @tap="navToStudyDetail">
            <view class="menu-icon-box">
              <text class="menu-emoji"> 📊 </text>
            </view>
            <text class="menu-text"> 学习统计 </text>
            <text class="menu-arrow"> › </text>
          </view>

          <!-- 分隔线 -->
          <view class="menu-divider" />

          <!-- 系统设置 -->
          <view class="menu-item" hover-class="menu-hover" @tap="navToSettings">
            <view class="menu-icon-box">
              <text class="menu-emoji"> ⚙️ </text>
            </view>
            <text class="menu-text"> 系统设置 </text>
            <text class="menu-arrow"> › </text>
          </view>

          <!-- 分隔线 -->
          <view class="menu-divider" />

          <!-- 意见反馈 -->
          <view class="menu-item" hover-class="menu-hover" @tap="handleFeedback">
            <view class="menu-icon-box">
              <text class="menu-emoji"> 💬 </text>
            </view>
            <text class="menu-text"> 意见反馈 </text>
            <text class="menu-arrow"> › </text>
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
        <view v-if="!isPageLoading" class="theme-btn" hover-class="btn-hover" @tap="toggleTheme">
          <text class="theme-emoji">
            {{ isDark ? '🌙' : '☀️' }}
          </text>
          <text class="theme-text">
            {{ isDark ? '深色模式' : '浅色模式' }}
          </text>
        </view>

        <!-- ========== 退出登录按钮 ========== -->
        <view v-if="!isPageLoading && isLoggedIn" class="logout-btn" hover-class="logout-hover" @tap="handleLogout">
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
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { onShow, onHide, onShareAppMessage } from '@dcloudio/uni-app';
import CustomTabbar from '@/components/layout/custom-tabbar/custom-tabbar.vue';
import { useStudyStore } from '@/stores/modules/study';
import { useUserStore } from '@/stores/modules/user';
// 检查点4.4: 每日打卡 - 连续天数统计和补签卡
import { checkinStreak } from '@/services/checkin-streak.js';
import { streakRecovery } from '@/services/streak-recovery.js';
// ✅ 统一日志工具（生产环境自动禁用）
import { logger } from '@/utils/logger.js';
import { vibrateLight } from '@/utils/helpers/haptic.js';
import { safeNavigateTo } from '@/utils/safe-navigate';
// ✅ F019: 统一使用 storageService 进行数据缓存管理
import storageService from '@/services/storageService.js';
import config from '@/config/index.js';
import { requireLogin } from '@/utils/auth/loginGuard.js';

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
const studyDays = computed(() => studyStore.studyProgress?.studyDays || 0);
const accuracyRate = computed(() => {
  const progress = studyStore.studyProgress;
  if (!progress || !progress.totalQuestions || progress.totalQuestions === 0) {
    return 0;
  }
  return Math.round((progress.correctCount / progress.totalQuestions) * 100);
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
    try {
      const systemInfo = uni.getSystemInfoSync();
      isDark.value = systemInfo.theme === 'dark';
    } catch {
      isDark.value = false;
    }
  }
}

function loadData() {
  isPageLoading.value = true;
  try {
    userStore.restoreUserInfo?.();
    studyStore.restoreProgress?.();
    loadBadges();
    // 检查点4.4: 加载打卡数据
    loadCheckinData();
  } catch (error) {
    logger.error('[Profile] loadData error:', error);
    // P007: 提供用户反馈
    uni.showToast({ title: '个人数据加载失败，请下拉刷新重试', icon: 'none', duration: 2000 });
  } finally {
    // 短暂延迟后关闭骨架屏，确保数据已渲染
    setTimeout(() => {
      isPageLoading.value = false;
    }, 300);
  }
}

function loadBadges() {
  const achievements = storageService.get('learning_achievements', []);
  badgeCount.value = Array.isArray(achievements) ? achievements.length : 0;
}

// 检查点4.4: 加载打卡数据
async function loadCheckinData() {
  try {
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
    uni.showToast({ title: '打卡数据加载失败', icon: 'none', duration: 1500 });
  }
}

// 检查点4.4: 执行打卡
async function handleCheckIn() {
  if (!isLoggedIn.value) {
    requireLogin(() => handleCheckIn(), { message: '请先登录后再打卡' });
    return;
  }
  if (todayChecked.value) {
    uni.showToast({ title: '今日已打卡', icon: 'none' });
    return;
  }

  try {
    const result = await checkinStreak.checkIn();

    if (result.success) {
      todayChecked.value = true;
      checkInStreak.value = result.data.streak;

      // 显示打卡成功提示
      uni.showToast({
        title: `打卡成功！连续${result.data.streak}天`,
        icon: 'success',
        duration: 2000
      });

      // 如果有里程碑奖励
      if (result.data.milestone) {
        setTimeout(() => {
          uni.showModal({
            title: '🎉 里程碑达成！',
            content: `恭喜连续打卡${result.data.streak}天！\n获得 ${result.data.milestone.exp} 经验 + ${result.data.milestone.coins} 金币`,
            showCancel: false,
            confirmText: '太棒了'
          });
        }, 1500);
      }
    } else {
      uni.showToast({ title: result.message, icon: 'none' });
    }
  } catch (error) {
    logger.error('[Profile] handleCheckIn error:', error);
    uni.showToast({ title: '打卡失败，请稍后重试', icon: 'none' });
  }
}

// 检查点4.4: 使用补签卡
async function handleRecovery(date) {
  if (!isLoggedIn.value) {
    requireLogin(() => handleRecovery(date), { message: '请先登录后再补签' });
    return;
  }
  const checkResult = streakRecovery.canRecover(date);

  if (!checkResult.canRecover) {
    uni.showToast({ title: checkResult.reason, icon: 'none' });
    return;
  }

  // 显示补签选项
  const options = checkResult.options.filter((o) => o.available);
  if (options.length === 0) {
    uni.showToast({ title: '没有可用的补签方式', icon: 'none' });
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
    uni.showToast({ title: '请先获取补签卡', icon: 'none' });
    return;
  }

  try {
    const result = await streakRecovery.recover(date, method);

    if (result.success) {
      // 刷新打卡数据
      await loadCheckinData();

      uni.showToast({
        title: `补签成功！连续${result.data.streak}天`,
        icon: 'success'
      });
    } else {
      uni.showToast({ title: result.message, icon: 'none' });
    }
  } catch (error) {
    logger.error('[Profile] handleRecovery error:', error);
    uni.showToast({ title: '补签失败，请稍后重试', icon: 'none' });
  }
}

// 问题54：显示补签选项弹窗
function showRecoveryOptions() {
  // 获取可补签的日期列表
  const recoverableDates = streakRecovery.getRecoverableDates();

  if (recoverableDates.length === 0) {
    uni.showToast({ title: '没有可补签的日期', icon: 'none' });
    return;
  }

  // 筛选出可以补签的日期（最近7天内）
  const availableDates = recoverableDates.filter((d) => d.canRecover && d.daysAgo <= 7).slice(0, 5);

  if (availableDates.length === 0) {
    uni.showToast({ title: '没有可补签的日期', icon: 'none' });
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
        uni.showModal({
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
  // ✅ F019: 统一使用 storageService
  storageService.save('theme_mode', mode);
  uni.$emit('themeUpdate', mode);

  // 同步更新导航栏颜色
  try {
    uni.setNavigationBarColor({
      frontColor: isDark.value ? '#ffffff' : '#000000',
      backgroundColor: isDark.value ? '#000000' : '#ffffff',
      animation: { duration: 200 }
    });
  } catch (e) {
    logger.warn('[Profile] setNavigationBarColor failed', e);
  }

  vibrateLight();

  // 显示切换成功提示
  uni.showToast({
    title: isDark.value ? '已开启深色模式' : '已关闭深色模式',
    icon: 'none',
    duration: 1500
  });
}

function handleEditProfile() {
  uni.showModal({
    title: '编辑昵称',
    editable: true,
    placeholderText: '请输入新昵称',
    success: (res) => {
      if (res.confirm && res.content) {
        userStore.updateUserInfo?.({ nickName: res.content });
        uni.showToast({ title: '更新成功', icon: 'success' });
      } else if (res.confirm && !res.content) {
        uni.showToast({ title: '昵称不能为空', icon: 'none' });
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
    uni.showLoading({ title: '上传中...', mask: true });

    // 获取用户ID
    const userId = storageService.get('EXAM_USER_ID') || userStore.userInfo?._id;
    if (!userId) {
      uni.hideLoading();
      uni.showToast({ title: '请先登录', icon: 'none' });
      return;
    }

    // 上传到服务器
    const uploadRes = await uploadAvatarToServer(tempFilePath, userId);

    uni.hideLoading();

    if (uploadRes.success) {
      // 更新本地存储
      // ✅ F019: 统一使用 storageService
      const localUserInfo = storageService.get('userInfo', {});
      localUserInfo.avatarUrl = uploadRes.avatarUrl;
      storageService.save('userInfo', localUserInfo);

      // 更新 userStore
      userStore.updateUserInfo?.({ avatarUrl: uploadRes.avatarUrl });

      // 通知其他页面
      uni.$emit('userInfoUpdated', { avatarUrl: uploadRes.avatarUrl });

      uni.showToast({ title: '头像更新成功', icon: 'success' });
    } else {
      uni.showToast({ title: uploadRes.message || '上传失败', icon: 'none' });
    }
  } catch (error) {
    uni.hideLoading();
    logger.error('[Profile] chooseAndUploadAvatar error:', error);

    // 用户取消选择不提示错误
    if (error.errMsg && error.errMsg.includes('cancel')) {
      return;
    }

    uni.showToast({ title: '上传失败，请重试', icon: 'none' });
  }
}

// 上传头像到服务器
async function uploadAvatarToServer(filePath, userId) {
  return new Promise((resolve) => {
    // I005: 使用统一配置获取 API 基础地址（替代硬编码的旧 Laf 域名）
    const baseUrl = config.api.baseUrl;

    uni.uploadFile({
      url: `${baseUrl}/upload-avatar`,
      filePath: filePath,
      name: 'file',
      formData: {
        userId: userId,
        type: 'avatar'
      },
      header: {
        Authorization: `Bearer ${storageService.get('EXAM_TOKEN', '')}`
      },
      success: (res) => {
        try {
          const data = JSON.parse(res.data);
          if (data.code === 0 || data.success) {
            resolve({
              success: true,
              avatarUrl: data.data?.url || data.url || data.avatarUrl
            });
          } else {
            resolve({
              success: false,
              message: data.message || '上传失败'
            });
          }
        } catch (e) {
          logger.error('[Profile] parse upload response error:', e);
          resolve({ success: false, message: '解析响应失败' });
        }
      },
      fail: (err) => {
        logger.error('[Profile] uploadFile error:', err);
        resolve({ success: false, message: '网络错误' });
      }
    });
  });
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
  uni.showToast({ title: messages[type] || '', icon: 'none', duration: 2000 });
}

function navToMistake() {
  safeNavigateTo('/pages/mistake/index');
}

function navToStudyDetail() {
  safeNavigateTo('/pages/study-detail/index');
}

function navToSettings() {
  safeNavigateTo('/pages/settings/index');
}

function handleFeedback() {
  uni.showModal({
    title: '意见反馈',
    content: '如有问题或建议，请联系：\nfeedback@exam-master.com',
    showCancel: false,
    confirmText: '知道了'
  });
}

function handleLogout() {
  uni.showModal({
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
          // ✅ B021-3: 不再存储明文 user_id，无需清理
          storageService.remove('EXAM_TOKEN');

          // 通知其他页面登录状态变化
          uni.$emit('loginStatusChanged', false);

          uni.showToast({ title: '已退出登录', icon: 'success' });

          setTimeout(() => {
            uni.switchTab({ url: '/pages/index/index' });
          }, 1000);
        } catch (error) {
          logger.error('[Profile] 退出登录失败:', error);
          uni.showToast({ title: '退出失败，请重试', icon: 'none' });
        }
      }
    }
  });
}

// ========== 事件处理器（提升到模块作用域，确保 onHide 可访问） ==========
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
  path: '/pages/profile/index'
}));

onMounted(() => {
  initLayoutInfo();
  initTheme();
  loadData();

  // 监听主题更新事件
  uni.$on('themeUpdate', _themeHandler);

  // 监听登录状态变化
  uni.$on('loginStatusChanged', _loginHandler);

  // 监听用户信息更新
  uni.$on('userInfoUpdated', _userInfoHandler);

  // 监听系统主题变化
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
  // uni.hideTabBar({ animation: false });
  // F005: 通知 CustomTabbar 重新检测路由
  uni.$emit('tabbarRouteUpdate');
  // 每次进入页面强制刷新主题状态
  initTheme();
  // 刷新数据
  loadData();
});

onHide(() => {
  // 清理事件监听
  uni.$off('loginStatusChanged', _loginHandler);
  uni.$off('userInfoUpdated', _userInfoHandler);
  uni.$off('themeUpdate', _themeHandler);
});
</script>

<style lang="scss" scoped>
// ========== 基础布局 ==========
.fixed {
  position: fixed;
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
}

// ========== 通用卡片 ==========
.card {
  background-color: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: 24rpx;
  margin-bottom: 24rpx;
  transition: all 0.2s ease;
}

.card-hover {
  opacity: 0.9;
  transform: scale(0.99);
}

// ========== 用户卡片 ==========
.user-card {
  padding: 32rpx;
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
  background-color: var(--muted);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 28rpx;
  flex-shrink: 0;
  overflow: visible;
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
  background: linear-gradient(135deg, #9fe870 0%, #7bc653 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  border: 3rpx solid var(--bg-card);
  box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.15);
}

.avatar-edit-icon {
  font-size: 20rpx;
}

.user-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.user-name {
  font-size: 40rpx;
  font-weight: 700;
  line-height: 1.2;
  color: var(--text-main);
}

.user-id {
  font-size: 26rpx;
  line-height: 1.2;
  color: var(--text-sub);
}

.edit-btn {
  width: 88rpx;
  height: 88rpx;
  border-radius: 50%;
  background-color: var(--muted);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
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
  border-radius: 50%;
  background-color: var(--muted);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 16rpx;
}

.stat-emoji {
  font-size: 40rpx;
}

.stat-value {
  font-size: 48rpx;
  font-weight: 800;
  line-height: 1.1;
  margin-bottom: 8rpx;
  color: var(--text-main);
}

.stat-label {
  font-size: 24rpx;
  line-height: 1.2;
  color: var(--text-sub);
}

.stat-divider {
  width: 2rpx;
  height: 80rpx;
  background-color: var(--border-color);
  flex-shrink: 0;
}

// ========== 菜单卡片 ==========
.menu-card {
  padding: 0;
  overflow: hidden;
}

.menu-item {
  display: flex;
  align-items: center;
  padding: 28rpx 32rpx;
}

.menu-hover {
  background-color: var(--muted);
}

.menu-icon-box {
  width: 76rpx;
  height: 76rpx;
  border-radius: 50%;
  background-color: var(--muted);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 24rpx;
  flex-shrink: 0;
}

.menu-emoji {
  font-size: 36rpx;
}

.menu-text {
  flex: 1;
  font-size: 32rpx;
  font-weight: 500;
  color: var(--text-main);
}

.menu-arrow {
  font-size: 48rpx;
  font-weight: 300;
  flex-shrink: 0;
  color: var(--text-sub);
}

.menu-divider {
  height: 2rpx;
  background-color: var(--border-color);
  margin-left: 132rpx;
}

// ========== 关于卡片 ==========
.about-card {
  padding: 0;
  overflow: hidden;
}

.about-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 28rpx 32rpx;
}

.about-label {
  font-size: 28rpx;
  color: var(--text-sub);
}

.about-value {
  font-size: 28rpx;
  color: var(--text-main);
}

.about-divider {
  height: 2rpx;
  background-color: var(--border-color);
  margin-left: 32rpx;
  margin-right: 32rpx;
}

// ========== 主题切换按钮 ==========
.theme-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16rpx;
  padding: 28rpx;
  border-radius: 24rpx;
  margin-bottom: 24rpx;
  background-color: var(--bg-card);
  border: 1px solid var(--border-color);
}

.theme-emoji {
  font-size: 36rpx;
}

.theme-text {
  font-size: 30rpx;
  font-weight: 500;
  color: var(--text-main);
}

// ========== 退出按钮 ==========
.logout-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 28rpx;
  border-radius: 24rpx;
  margin-bottom: 24rpx;
  background-color: transparent;
  border: 1px solid var(--border-color);
}

.logout-text {
  font-size: 30rpx;
  font-weight: 500;
  color: var(--danger);
}

.logout-hover {
  background-color: var(--muted);
}

// ========== 按钮通用 hover ==========
.btn-hover {
  opacity: 0.7;
  transform: scale(0.95);
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
  background: linear-gradient(90deg, var(--muted) 25%, var(--bg-card) 50%, var(--muted) 75%);
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
  background-color: var(--glass-bg);
  border-bottom: 1px solid var(--border-color);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}

.nav-content {
  height: 88rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.nav-title {
  font-size: 36rpx;
  font-weight: 600;
  color: var(--text-main);
}

// ========== 问题54：打卡卡片样式 ==========
.checkin-card {
  padding: 32rpx;
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
  font-weight: 700;
  color: var(--text-main);
}

.checkin-streak {
  font-size: 26rpx;
  color: #e05a2b;
  font-weight: 600;
}

.checkin-subtitle {
  font-size: 24rpx;
  color: var(--text-sub);
}

.checkin-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24rpx;
}

.checkin-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12rpx;
  padding: 28rpx 40rpx;
  border-radius: 50rpx;
  transition: all 0.3s ease;
}

.checkin-btn.not-checked {
  background: linear-gradient(135deg, #9fe870 0%, #7bc653 100%);
  box-shadow: 0 8rpx 24rpx rgba(159, 232, 112, 0.4);
}

.checkin-btn.checked {
  background: var(--muted);
  border: 2rpx solid var(--border-color);
}

.checkin-btn-icon {
  font-size: 36rpx;
}

.checkin-btn-text {
  font-size: 30rpx;
  font-weight: 600;
  color: var(--text-main);
}

.checkin-btn.not-checked .checkin-btn-text {
  color: #1a1a1a;
}

.recovery-info {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 12rpx;
}

.recovery-cards {
  display: flex;
  align-items: center;
  gap: 8rpx;
}

.recovery-icon {
  font-size: 28rpx;
}

.recovery-text {
  font-size: 24rpx;
  color: var(--text-sub);
}

.use-recovery-btn {
  padding: 12rpx 24rpx;
  background: rgba(255, 107, 53, 0.1);
  border-radius: 20rpx;
  border: 1rpx solid rgba(255, 107, 53, 0.3);
}

.use-recovery-text {
  font-size: 24rpx;
  color: #e05a2b;
  font-weight: 500;
}

.missed-tip {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-top: 20rpx;
  padding: 16rpx 20rpx;
  background: rgba(255, 107, 53, 0.08);
  border-radius: 16rpx;
  border: 1rpx solid rgba(255, 107, 53, 0.2);
}

.missed-icon {
  font-size: 28rpx;
}

.missed-text {
  font-size: 24rpx;
  color: #e05a2b;
  flex: 1;
}

/* 骨架屏淡出过渡 */
.skeleton-fade-leave-active {
  transition: opacity 0.35s ease-out;
}
.skeleton-fade-leave-to {
  opacity: 0;
}
</style>
