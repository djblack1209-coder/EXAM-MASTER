<template>
  <view id="e2e-settings-root" class="settings-container" :class="{ 'dark-mode': isDark }">
    <!-- 顶部导航 - 添加设计系统工具类 -->
    <view
      class="top-nav apple-glass"
      :style="{ paddingTop: statusBarHeight + 'px', paddingRight: capsuleSafeRight + 'px' }"
    >
      <view id="e2e-settings-back" class="nav-back" @tap="handleGoBack"><BaseIcon name="arrow-left" :size="36" /></view>
      <text class="nav-title ds-text-display ds-font-bold"> 设置 </text>
      <view class="nav-placeholder" />
    </view>

    <!-- F018: 页面加载骨架屏 -->
    <!-- #ifdef APP-PLUS -->
    <view v-if="isPageLoading" class="skeleton-settings">
      <view class="skeleton-user-card skeleton-pulse" />
      <view class="skeleton-section">
        <view class="skeleton-entry skeleton-pulse" />
      </view>
      <view class="skeleton-section">
        <view class="skeleton-item skeleton-pulse" />
        <view class="skeleton-item skeleton-pulse" />
        <view class="skeleton-item skeleton-pulse" />
      </view>
    </view>
    <!-- #endif -->
    <!-- #ifndef APP-PLUS -->
    <!-- #ifndef APP-NVUE -->
    <transition name="skeleton-fade">
      <view v-if="isPageLoading" class="skeleton-settings">
        <view class="skeleton-user-card skeleton-pulse" />
        <view class="skeleton-section">
          <view class="skeleton-entry skeleton-pulse" />
        </view>
        <view class="skeleton-section">
          <view class="skeleton-item skeleton-pulse" />
          <view class="skeleton-item skeleton-pulse" />
          <view class="skeleton-item skeleton-pulse" />
        </view>
      </view>
    </transition>
    <!-- #endif -->
    <!-- #ifdef APP-NVUE -->
    <view v-if="isPageLoading" class="skeleton-settings">
      <view class="skeleton-user-card skeleton-pulse" />
      <view class="skeleton-section">
        <view class="skeleton-entry skeleton-pulse" />
      </view>
      <view class="skeleton-section">
        <view class="skeleton-item skeleton-pulse" />
        <view class="skeleton-item skeleton-pulse" />
        <view class="skeleton-item skeleton-pulse" />
      </view>
    </view>
    <!-- #endif -->
    <!-- #endif -->

    <!-- 用户信息卡片 - Wise风格重新设计 -->
    <view v-show="!isPageLoading" class="user-card wise-card apple-glass-card">
      <view class="user-header">
        <view class="avatar-section" @tap="handleAvatarClick">
          <!-- #ifdef MP-WEIXIN -->
          <button class="avatar-btn" open-type="chooseAvatar" @chooseavatar="onChooseAvatar">
            <image
              class="avatar"
              :src="userInfo.avatarUrl || defaultAvatar"
              alt="头像"
              mode="aspectFill"
              @error="onAvatarError"
            />
          </button>
          <!-- #endif -->
          <!-- #ifndef MP-WEIXIN -->
          <view class="avatar-btn" @tap="onChooseAvatarApp">
            <image
              class="avatar"
              :src="userInfo.avatarUrl || defaultAvatar"
              alt="头像"
              mode="aspectFill"
              @error="onAvatarError"
            />
          </view>
          <!-- #endif -->
          <view v-if="!userInfo.uid" class="login-badge"> 点击登录 </view>
          <view v-else class="login-badge logged-in"> 已登录 </view>
        </view>
        <view class="user-info-section">
          <input
            type="nickname"
            class="nickname-input"
            :value="userInfo.nickName || '考研人'"
            placeholder="点击设置昵称"
            placeholder-class="nickname-placeholder"
            maxlength="20"
            @blur="onNicknameChange"
          />
          <view class="info-grid">
            <view class="info-item" @tap="handleEditSchool">
              <text class="info-label"> 报考院校 </text>
              <text class="info-value">
                {{ userSchoolInfo.school || '未设置' }}
              </text>
            </view>
            <view class="info-item" @tap="handleEditMajor">
              <text class="info-label"> 报考专业 </text>
              <text class="info-value">
                {{ userSchoolInfo.major || '未设置' }}
              </text>
            </view>
          </view>
          <!-- 考试日期设置（D017: 新用户引导设置） -->
          <view class="exam-date-row">
            <text class="info-label">考试日期</text>
            <picker mode="date" :value="examDate" :start="todayDateStr" @change="onExamDateChange">
              <view class="exam-date-picker">
                <text v-if="examDate" class="exam-date-value">{{ examDateDisplay }}</text>
                <text v-else class="exam-date-placeholder">点击设置考试日期</text>
                <BaseIcon name="arrow-right" :size="24" />
              </view>
            </picker>
          </view>
        </view>

        <!-- 目标院校管理弹窗 -->
        <view v-if="showTargetSchoolsModal" class="modal-mask" @tap="showTargetSchoolsModal = false">
          <view class="modal-content target-modal-card" @tap.stop>
            <view class="target-modal-handle" />
            <view class="modal-header target-modal-header">
              <view>
                <text class="target-modal-eyebrow"> Target Schools </text>
                <text class="modal-title"> 目标院校管理 </text>
              </view>
              <text
                id="e2e-settings-target-modal-close"
                class="close-btn target-modal-close"
                @tap="showTargetSchoolsModal = false"
              >
                <BaseIcon name="close" :size="32" />
              </text>
            </view>
            <view class="modal-body target-modal-body">
              <view v-if="targetSchools.length === 0" class="empty-targets">
                <text class="empty-target-text">暂无目标院校</text>
                <button class="add-btn" @tap="handleAddTargetSchool">去添加目标院校</button>
              </view>
              <view v-else class="target-list">
                <view
                  v-for="(school, index) in targetSchools"
                  :key="school.id || school.name || index"
                  class="target-item"
                >
                  <image
                    class="target-avatar"
                    :src="school.logo || '/static/images/default-avatar.png'"
                    alt="Exam Master"
                    mode="aspectFill"
                    lazy-load
                    @error="
                      (e) => {
                        e.target && (e.target.src = '/static/images/default-avatar.png');
                      }
                    "
                  />
                  <view class="target-info">
                    <text class="target-name">
                      {{ school.name }}
                    </text>
                    <text class="target-location">
                      {{ school.location }}
                    </text>
                  </view>
                  <view class="target-actions">
                    <text class="action-btn delete-btn" @tap="removeTargetSchool(index)"> 删除 </text>
                  </view>
                </view>
              </view>
            </view>
          </view>
        </view>
      </view>
      <view class="stats-section">
        <view class="stat-card">
          <text class="stat-value">
            {{ studyDays }}
          </text>
          <text class="stat-label"> 坚持天数 </text>
        </view>
        <view id="e2e-settings-target-school-stat" class="stat-card" @tap="handleTargetSchoolClick">
          <text class="stat-value">
            {{ targetSchools.length }}
          </text>
          <text class="stat-label"> 目标院校 </text>
        </view>
      </view>
    </view>

    <!-- F002: 好友入口（已提取为独立组件） -->
    <FriendsEntryCard />

    <!-- 邀请好友入口卡片 -->
    <view class="section">
      <view class="invite-entry-card apple-group-card" @tap="openInviteModal">
        <view class="invite-entry-left">
          <image class="feature-cartoon-icon" src="/static/icons/share-arrow.png" mode="aspectFit" alt="邀请好友" />
          <view class="invite-entry-info">
            <text class="setting-title ds-text-sm ds-font-medium">邀请好友一起备考</text>
            <text class="setting-desc ds-text-xs">邀请好友可获得 VIP 体验天数奖励</text>
          </view>
        </view>
        <view v-if="inviteClaimableCount > 0" class="invite-entry-badge">
          <text class="invite-badge-text">{{ inviteClaimableCount }}个奖励可领</text>
        </view>
        <BaseIcon v-else name="arrow-right" :size="28" />
      </view>
    </view>

    <!-- F002: 智能导师列表（已提取为独立组件） -->
    <AITutorList :target-schools="targetSchools" @start-chat="startAIChat" />

    <!-- 设置选项 - 优化样式 -->
    <view class="section">
      <view class="settings-list apple-group-card">
        <!-- 语音伴学 -->
        <view class="setting-item ds-flex ds-flex-between">
          <view class="setting-info">
            <text class="setting-title ds-text-sm ds-font-medium"> 智能语音伴学 </text>
            <text class="setting-desc ds-text-xs"> 导师回答后自动朗读 </text>
          </view>
          <em3d-switch id="e2e-settings-voice-switch" :model-value="isVoiceEnabled" @change="toggleVoice3d" />
        </view>

        <!-- 深色模式（自动切换 Wise/Bitget 主题） -->
        <view class="setting-item ds-flex ds-flex-between">
          <view class="setting-info">
            <text class="setting-title ds-text-sm ds-font-medium"> 深色模式 </text>
            <text class="setting-desc ds-text-xs"> 护眼模式，夜间更舒适 </text>
          </view>
          <em3d-switch id="e2e-settings-dark-switch" :model-value="isDark" @change="toggleDark3d" />
        </view>

        <!-- 安全/隐私 -->
        <view class="setting-item ds-flex ds-flex-between">
          <view class="setting-info" style="flex-direction: row; align-items: center; display: flex">
            <!-- 卡通盾牌图标装饰 -->
            <image
              class="feature-cartoon-icon"
              src="./static/icons/shield-check.png"
              mode="aspectFit"
              style="margin-right: 16rpx"
            />
            <view>
              <text class="setting-title ds-text-sm ds-font-medium"> 安全与隐私 </text>
              <text class="setting-desc ds-text-xs"> 数据安全，放心使用 </text>
            </view>
          </view>
        </view>

        <!-- 清除缓存 -->
        <view
          id="e2e-settings-clear-cache"
          class="setting-item ds-flex ds-flex-between ds-touchable"
          @tap="handleClearCache"
        >
          <view class="setting-info">
            <text class="setting-title ds-text-sm ds-font-medium"> 清除缓存数据 </text>
            <text class="setting-desc ds-text-xs"> 释放存储空间 </text>
          </view>
          <text class="cache-size ds-text-xs">
            {{ cacheSize }}
          </text>
        </view>
      </view>
    </view>

    <!-- 退出登录（已提取为独立组件） -->
    <LogoutButton @logged-out="userInfo = {}" />

    <!-- C5: 注销账号（微信审核硬性要求） -->
    <view v-if="userInfo.uid" class="delete-account-section">
      <!-- 注销冷静期状态提示 -->
      <view v-if="deletionStatus.status === 'pending_deletion'" class="deletion-pending-card">
        <view class="deletion-pending-header">
          <text class="deletion-pending-icon">
            <BaseIcon name="warning" :size="32" />
          </text>
          <text class="deletion-pending-title"> 账号注销中 </text>
        </view>
        <text class="deletion-pending-desc">
          剩余 {{ deletionStatus.remainingDays }} 天后将永久删除所有数据，冷静期内可撤销
        </text>
        <view class="deletion-cancel-btn ds-touchable" @tap="handleCancelDeletion">
          <text class="deletion-cancel-text"> 撤销注销 </text>
        </view>
      </view>
      <!-- 正常状态：显示注销按钮 -->
      <view v-else id="e2e-settings-delete-account" class="delete-account-btn ds-touchable" @tap="handleDeleteAccount">
        <text class="delete-account-eyebrow"> Account </text>
        <text class="delete-account-desc"> 注销后将进入冷静期，期间可撤销，逾期后账号与学习数据将永久删除。 </text>
        <text class="delete-account-text"> 注销账号 </text>
      </view>
    </view>

    <!-- 底部安全区域 -->
    <view class="footer-safe" />

    <!-- F005: 移除非 tabBar 页面的自定义导航栏 -->

    <!-- 邀请好友弹窗 -->
    <InviteModal
      v-if="showInviteModal"
      :invite-code="inviteCode"
      @close="handleCloseInviteModal"
      @open-poster="handleOpenPoster"
    />

    <!-- 海报生成弹窗 -->
    <PosterModal v-if="showPosterModal" :visible="showPosterModal" @close="handleClosePosterModal" />

    <!-- F002: 主题选择器弹窗（已提取为独立组件） -->
    <ThemeSelectorModal :visible="showThemeSelector" @close="showThemeSelector = false" />

    <!-- F002: 智能对话弹窗（已提取为独立组件） -->
    <AIChatModal :visible="showChat" :tutor="currentTutor" :voice-enabled="isVoiceEnabled" @close="showChat = false" />
  </view>
</template>

<script setup>
import { modal } from '@/utils/modal.js';
import { toast } from '@/utils/toast.js';
// Vue 原生钩子
import { ref, computed, onMounted, onUnmounted, onErrorCaptured } from 'vue';
import { safeNavigateBack } from '@/utils/safe-navigate';
// UniApp 特有钩子
import { onShow } from '@dcloudio/uni-app';
// F005: CustomTabbar removed — settings is not a tabBar page
import AIChatModal from './AIChatModal.vue';
import AITutorList from './AITutorList.vue';
import ThemeSelectorModal from './ThemeSelectorModal.vue';
import FriendsEntryCard from './FriendsEntryCard.vue';
import LogoutButton from './LogoutButton.vue';
import InviteModal from './InviteModal.vue';
import PosterModal from './PosterModal.vue';
import { setTheme, isNightTime } from './theme.js';
import { storageService } from '@/services/storageService.js';
import { useSchoolStore } from '@/stores/modules/school';
import { useProfileStore } from '@/stores/modules/profile';
import { useInviteStore } from '@/stores/modules/invite.js';
import { useThemeStore } from '@/stores';
import { NAV_BAR_COLORS } from '@/composables/useTheme.js';
// ✅ 统一日志工具（生产环境自动禁用）
import { logger } from '@/utils/logger.js';

// 错误边界：捕获子组件运行时错误，防止整个页面白屏
onErrorCaptured((err, instance, info) => {
  logger.error('[设置] 子组件运行时错误:', err?.message || err, '| 来源:', info);
  return false;
});

// 统一默认头像
const DEFAULT_AVATAR = '/static/images/default-avatar.png';
import { isUserLoggedIn } from '@/utils/auth/loginGuard.js';
import { filePathToBase64, inferImageMimeType } from '@/utils/helpers/image-base64.js';
// H025 FIX: 头像上传走 Service 层
import { uploadAvatar } from '@/services/api/domains/user.api.js';
import { getStatusBarHeight, getCapsuleSafeRight } from '@/utils/core/system.js';
import BaseIcon from '@/components/base/base-icon/base-icon.vue';
import { sanitizeInput } from '@/utils/security/sanitize.js';

// 初始化 Store
const schoolStore = useSchoolStore();
const profileStore = useProfileStore();

// 基础状态
const userInfo = ref({});
const userSchoolInfo = ref({}); // 用户学校信息（报考院校、专业）
const defaultAvatar = DEFAULT_AVATAR; // 默认头像
const studyDays = ref(1);
const targetSchools = ref([]);
const cacheSize = ref('0KB');
const isDark = ref(false);
const statusBarHeight = ref(44);
const capsuleSafeRight = ref(20);
const isVoiceEnabled = ref(true); // 语音开关
const isPageLoading = ref(true); // F018: 页面加载状态
// F002-S5: isLoggingOut moved to LogoutButton component
const showTargetSchoolsModal = ref(false); // 目标院校管理弹窗
const showInviteModal = ref(false); // 邀请好友弹窗
const showPosterModal = ref(false); // 海报生成弹窗
const showThemeSelector = ref(false); // 主题选择器弹窗

// 邀请系统（通过 Store 从后端获取真实邀请码）
const inviteStore = useInviteStore();
const inviteCode = computed(() => inviteStore.inviteCode || 'EXAM8888');
const inviteClaimableCount = computed(() => inviteStore.claimableCount);
// C5: 注销状态
const deletionStatus = ref({ status: 'active', remainingDays: null });
// D017: 考试日期
const examDate = ref('');
/** 今天的日期字符串（picker 的最小可选日期） */
const todayDateStr = computed(() => new Date().toISOString().slice(0, 10));
/** 考试日期的友好显示（如 "2026-12-26 周六"） */
const examDateDisplay = computed(() => {
  if (!examDate.value) return '';
  const d = new Date(examDate.value);
  const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  const diff = Math.ceil((d - new Date()) / 86400000);
  const diffText = diff > 0 ? `（还有${diff}天）` : diff === 0 ? '（就是今天）' : '';
  return `${examDate.value} ${weekDays[d.getDay()]}${diffText}`;
});

// 主题系统
let _themeStore = null;
// [H11-FIX] 定时器追踪
const _timers = [];
// F002: 对话逻辑已提取到 AIChatModal 组件，仅保留控制状态
const showChat = ref(false);
const currentTutor = ref({});

// F002: onlineFriends, watcher, and tutor init moved to AITutorList.vue

onMounted(() => {
  statusBarHeight.value = getStatusBarHeight();
  capsuleSafeRight.value = getCapsuleSafeRight();
  loadData();

  // 初始化主题系统
  _themeStore = useThemeStore();

  // 同步主题状态
  const savedTheme = storageService.get('theme_mode', 'light');
  isDark.value = savedTheme === 'dark';

  // F003: 存储回调引用，确保 $off 只移除自己的监听器
  // 两个事件名（themeUpdate / updateTheme）做同一件事，共用同一个 handler
  _themeHandler = (mode) => {
    isDark.value = mode === 'dark';
  };
  _updateThemeHandler = _themeHandler;
  uni.$on('themeUpdate', _themeHandler);
  uni.$on('updateTheme', _updateThemeHandler);
});

// 监听全局主题更新事件，确保主题状态正确同步
let _themeHandler = null;
let _updateThemeHandler = null;
// ✅ FIX: uni.$on moved into onMounted — registering null handler at module scope was a no-op

onShow(() => {
  statusBarHeight.value = getStatusBarHeight();
  capsuleSafeRight.value = getCapsuleSafeRight();

  // 每次显示时重新加载数据，确保登录状态和头像同步
  loadData();

  // ✅ FIX: Use isDark.value instead of shadowing the outer ref with a local const
  const currentIsDark = storageService.get('theme_mode') === 'dark';
  isDark.value = currentIsDark;
  try {
    const colors = currentIsDark ? NAV_BAR_COLORS.dark : NAV_BAR_COLORS.light;
    uni.setNavigationBarColor({
      frontColor: colors.frontColor,
      backgroundColor: colors.backgroundColor,
      animation: { duration: 0 }
    });
  } catch (_e) {
    logger.log('设置导航栏颜色失败', _e);
  }
});

onUnmounted(() => {
  // F003: 传入回调引用，只移除自己注册的监听器
  if (_themeHandler) uni.$off('themeUpdate', _themeHandler);
  if (_updateThemeHandler) uni.$off('updateTheme', _updateThemeHandler);
  // H11: 清理所有 setTimeout，防止内存泄漏
  _timers.forEach((t) => clearTimeout(t));
  _timers.length = 0;
});

// F002: initAudio, initRecorder, handleTouchStart, handleTouchEnd, processVoice,
// toggleInputMode, emoji logic, escapeHtml, renderMarkdown, startAIChat, closeChat,
// sendToAI, scrollChatToBottom, playTTS — all moved to AIChatModal.vue

// F002: startAIChat now just opens the modal
const startAIChat = (tutor) => {
  currentTutor.value = tutor;
  showChat.value = true;
};

const handleGoBack = () => {
  safeNavigateBack();
};

const loadData = () => {
  try {
    userInfo.value = storageService.get('userInfo', {});
    userSchoolInfo.value = storageService.get('user_school_info', {});
    targetSchools.value = storageService.get('target_schools', []);
    const stats = storageService.get('study_stats', {});
    studyDays.value = Object.keys(stats).length || 1;
    isVoiceEnabled.value = storageService.get('voice_enabled', true) !== false;
    // D017: 加载考试日期
    examDate.value = storageService.get('exam_date', '');

    uni.getStorageInfo({
      success: (res) => {
        cacheSize.value = (res.currentSize || 0) + 'KB';
      }
    });

    // C5: 查询注销状态（已登录时）
    if (userInfo.value.uid) {
      checkDeletionStatus();
    }
  } catch (e) {
    logger.error('[settings] 加载数据失败:', e);
  } finally {
    isPageLoading.value = false; // F018: 数据加载完成
  }
};

// 编辑报考院校 - 直接使用搜索弹窗（school 是 tabBar 页面，switchTab 不支持 query params 和 events）
const handleEditSchool = () => {
  if (!isUserLoggedIn()) {
    toast.info('请先登录后编辑院校');
    return;
  }
  showSchoolSearchModal();
};

// 备用：院校搜索弹窗
const showSchoolSearchModal = () => {
  modal.show({
    title: '搜索报考院校',
    editable: true,
    placeholderText: '输入院校名称或代码搜索',
    content: '',
    success: async (res) => {
      if (res.confirm && res.content) {
        const keyword = res.content.trim();
        if (!keyword) {
          toast.info('请输入搜索关键词');
          return;
        }

        toast.loading('搜索中...');
        try {
          // 调用后端搜索院校
          const response = await schoolStore.searchSchools(keyword, 10);
          toast.hide();

          if (response.code === 0 && response.data && response.data.length > 0) {
            // 显示搜索结果供用户选择
            const schools = response.data;
            const itemList = schools.map((s) => `${s.name} (${s.code || s.location || ''})`);
            uni.showActionSheet({
              itemList,
              success: (selectRes) => {
                const selectedSchool = schools[selectRes.tapIndex];
                userSchoolInfo.value.school = selectedSchool.name;
                userSchoolInfo.value.schoolCode = selectedSchool.code || '';
                storageService.save('user_school_info', userSchoolInfo.value);
                toast.success('院校已更新');
              }
            });
          } else {
            toast.info('未找到匹配的院校');
          }
        } catch (error) {
          toast.hide();
          logger.error('[Settings] 搜索院校失败:', error);
          toast.info('搜索失败，请重试');
        }
      }
    }
  });
};

// 编辑报考专业
const handleEditMajor = () => {
  if (!isUserLoggedIn()) {
    toast.info('请先登录后编辑专业');
    return;
  }
  modal.show({
    title: '编辑报考专业',
    editable: true,
    placeholderText: '请输入报考专业（最多30字）',
    content: userSchoolInfo.value.major || '',
    success: (res) => {
      if (res.confirm && res.content) {
        // 安全过滤输入（最大30字符）
        const major = sanitizeInput(res.content, 30);
        if (!major) {
          const isEmpty = !res.content || !res.content.trim();
          toast.info(isEmpty ? '专业名称不能为空' : '专业名称包含不支持的特殊字符');
          return;
        }
        userSchoolInfo.value.major = major;
        storageService.save('user_school_info', userSchoolInfo.value);
        toast.success('更新成功');
      }
    }
  });
};

// D017: 考试日期变更处理
const onExamDateChange = (e) => {
  const dateStr = e.detail.value;
  examDate.value = dateStr;
  storageService.save('exam_date', dateStr);
  // 同时写入 uni storage（兼容 sprint-mode.vue 的 uni.getStorageSync 读取）
  uni.setStorageSync('exam_date', dateStr);
  toast.success('考试日期已设置');
};

const _toggleVoice = (e) => {
  isVoiceEnabled.value = e.detail.value;
  storageService.save('voice_enabled', isVoiceEnabled.value);
  toast.info(isVoiceEnabled.value ? '已开启语音伴学' : '已关闭语音伴学');
};

// Em3dSwitch 版本（直接接收布尔值）
const toggleVoice3d = (val) => {
  isVoiceEnabled.value = val;
  storageService.save('voice_enabled', val);
  toast.info(val ? '已开启语音伴学' : '已关闭语音伴学');
};

const _toggleDark = (e) => {
  isDark.value = e.detail.value;
  const mode = isDark.value ? 'dark' : 'light';
  // 使用主题工具函数统一处理
  setTheme(mode);

  const toastMsg = isDark.value
    ? isNightTime()
      ? '已开启深色模式（护眼模式已激活）'
      : '已开启深色模式'
    : '已关闭深色模式';
  toast.info(toastMsg);
};

// Em3dSwitch 版本（直接接收布尔值）
const toggleDark3d = (val) => {
  isDark.value = val;
  const mode = val ? 'dark' : 'light';
  setTheme(mode);
  const toastMsg = val ? (isNightTime() ? '已开启深色模式（护眼模式已激活）' : '已开启深色模式') : '已关闭深色模式';
  toast.info(toastMsg);
};

const handleClearCache = () => {
  modal.show({
    title: '提示',
    content: '确定清理缓存吗？（登录信息和主题设置将保留）',
    success: (res) => {
      if (res.confirm) {
        storageService.clear(true, {
          preserveGlobal: true,
          preserveKeys: ['user_school_info', 'target_schools']
        });
        loadData();
        toast.success('缓存已清理');
      }
    }
  });
};

// F002-S5: handleLogout moved to LogoutButton component

// C5: 注销账号处理
const handleDeleteAccount = () => {
  modal.show({
    title: '注销账号',
    content: '注销后将有7天冷静期，期间可撤销。冷静期结束后账号数据将被永久删除，且无法恢复。确定要注销吗？',
    confirmText: '确定注销',
    confirmColor: 'var(--danger)',
    success: async (res) => {
      if (res.confirm) {
        toast.loading('提交中...');
        try {
          const result = await profileStore.requestAccountDeletion();
          toast.hide();
          if (result.success) {
            // 刷新注销状态显示
            await checkDeletionStatus();
            modal.show({
              title: '注销申请已提交',
              content: result.message || '7天冷静期内可在此页面撤销注销',
              showCancel: false
            });
          } else {
            toast.info(result.message || '操作失败');
          }
        } catch (_e) {
          toast.hide();
          toast.info('网络异常，请重试');
        }
      }
    }
  });
};

// C5: 查询注销状态
const checkDeletionStatus = async () => {
  try {
    const result = await profileStore.getAccountDeletionStatus();
    if (result.success && result.data) {
      deletionStatus.value = result.data;
    }
  } catch (e) {
    logger.warn('[settings] 查询注销状态失败:', e);
  }
};

// C5: 撤销注销
const handleCancelDeletion = () => {
  modal.show({
    title: '撤销注销',
    content: '确定要撤销注销申请吗？撤销后账号将恢复正常使用。',
    confirmText: '确定撤销',
    success: async (res) => {
      if (res.confirm) {
        toast.loading('处理中...');
        try {
          const result = await profileStore.cancelAccountDeletion();
          toast.hide();
          if (result.success) {
            deletionStatus.value = { status: 'active', remainingDays: null };
            toast.success('注销已撤销');
          } else {
            toast.info(result.message || '操作失败');
          }
        } catch (_e) {
          toast.hide();
          toast.info('网络异常，请重试');
        }
      }
    }
  });
};

// 移除目标院校
const removeTargetSchool = (index) => {
  modal.show({
    title: '确认删除',
    content: `确定要删除目标院校 "${targetSchools.value[index].name}" 吗？`,
    confirmColor: 'var(--danger)',
    success: (res) => {
      if (res.confirm) {
        // 从数组中删除
        targetSchools.value.splice(index, 1);
        // 更新本地存储
        storageService.save('target_schools', targetSchools.value);
        toast.success('已删除目标院校');
      }
    }
  });
};

// 处理目标院校点击
const handleTargetSchoolClick = () => {
  showTargetSchoolsModal.value = true;
};

// 处理添加目标院校
const handleAddTargetSchool = () => {
  showTargetSchoolsModal.value = false;
  // 跳转到择校页面（TabBar页面，使用switchTab）
  uni.switchTab({
    url: '/pages/school/index',
    success: () => {
      logger.log('[Settings] ✅ 已跳转到择校页面');
    },
    fail: (err) => {
      logger.error('[Settings] ❌ 跳转择校页面失败:', err);
      toast.info('跳转失败');
    }
  });
};

// 头像选择防抖锁
const isChoosingAvatar = ref(false);

// ✅ F020: 上传头像到服务器（异步，不阻塞本地保存）
// H025 FIX: 通过 Service 层 uploadAvatar 调用，消除分层违规
async function _uploadAvatarToServer(filePath) {
  try {
    const userId = storageService.get('EXAM_USER_ID') || userInfo.value?.uid || userInfo.value?._id;
    if (!userId) return;

    const res = await uploadAvatar(filePath, userId, { filePathToBase64, inferImageMimeType });

    if (res.success && res.avatarUrl) {
      // 用服务器返回的永久URL替换临时路径
      userInfo.value.avatarUrl = res.avatarUrl;
      storageService.save('userInfo', userInfo.value);
      uni.$emit('userInfoUpdated', { avatarUrl: res.avatarUrl });
      logger.log('[Settings] ✅ 头像已上传到服务器:', res.avatarUrl);
    }
  } catch (e) {
    logger.warn('[Settings] 头像上传到服务器失败:', e.message);
  }
}

// 微信最新登录规范：获取头像
// App 端头像选择（非微信环境）
const onChooseAvatarApp = () => {
  onChooseAvatar({});
};

const onChooseAvatar = (e) => {
  if (!isUserLoggedIn()) {
    toast.info('请先登录后设置头像');
    return;
  }
  // 防抖：如果正在选择，直接返回
  if (isChoosingAvatar.value) {
    logger.log('[Settings] ⚠️ 头像选择进行中，忽略重复点击');
    return;
  }

  // 加锁
  isChoosingAvatar.value = true;

  try {
    // #ifdef MP-WEIXIN
    const { avatarUrl } = e.detail;
    if (avatarUrl) {
      logger.log('[Settings] 📸 头像已选择:', avatarUrl);
      // 更新用户头像（立即更新，确保UI响应）
      userInfo.value.avatarUrl = avatarUrl;
      // 如果已有用户信息，保留其他字段
      if (!userInfo.value.nickName) {
        userInfo.value.nickName = userInfo.value.nickName || '考研人';
      }
      // 保存用户信息到本地
      storageService.save('userInfo', userInfo.value);
      logger.log('[Settings] ✅ 头像已保存到本地存储');
      // 触发响应式更新（Vue 3 Proxy 可直接赋值触发）
      userInfo.value = { ...userInfo.value };
      // 显示成功提示
      toast.success('头像已更新');
      // ✅ F020: 异步上传到服务器（不阻塞本地保存）
      _uploadAvatarToServer(avatarUrl);
      // 如果没有登录，完成登录流程（在清空前保存 uid 判断）
      const needLogin = !userInfo.value.uid;
      if (needLogin) {
        doRealLogin();
      }
    }
    // #endif

    // #ifndef MP-WEIXIN
    // 非微信环境，使用 uni.chooseImage 让用户选择真实图片
    uni.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempFilePath = res.tempFilePaths[0];
        if (tempFilePath) {
          logger.log('[Settings] 📸 非微信环境头像已选择:', tempFilePath);
          userInfo.value.avatarUrl = tempFilePath;
          if (!userInfo.value.nickName) {
            userInfo.value.nickName = '考研人';
          }
          storageService.save('userInfo', userInfo.value);
          // 触发响应式更新
          userInfo.value = { ...userInfo.value };
          toast.success('头像已更新');
          // ✅ F020: 异步上传到服务器
          _uploadAvatarToServer(tempFilePath);
          const needLogin = !userInfo.value.uid;
          if (needLogin) {
            doRealLogin();
          }
        }
      },
      fail: () => {
        logger.log('[Settings] 用户取消了头像选择');
      }
    });
    // #endif
  } catch (error) {
    logger.error('[Settings] ❌ 头像选择失败', error);
    toast.info('头像更新失败');
  } finally {
    // 1秒后解锁
    _timers.push(
      setTimeout(() => {
        isChoosingAvatar.value = false;
      }, 1000)
    );
  }
};

// R14: sanitizeInput 已提取为全局工具 @/utils/security/sanitize.js

// 微信最新登录规范：获取昵称
const onNicknameChange = (e) => {
  if (!isUserLoggedIn()) {
    toast.info('请先登录后修改昵称');
    return;
  }
  const rawNickName = e.detail.value;
  // 安全过滤昵称（最大20字符）
  const nickName = sanitizeInput(rawNickName, 20);

  if (!nickName) {
    const isEmpty = !rawNickName || !rawNickName.trim();
    toast.info(isEmpty ? '昵称不能为空' : '昵称包含不支持的特殊字符');
    return;
  }

  // #ifdef MP-WEIXIN
  userInfo.value.nickName = nickName;
  // 如果头像已存在，保留头像；否则使用本地默认头像
  if (!userInfo.value.avatarUrl) {
    userInfo.value.avatarUrl = DEFAULT_AVATAR;
  }
  doRealLogin();
  // #endif

  // #ifndef MP-WEIXIN
  // 非微信环境
  userInfo.value.nickName = nickName;
  // 如果头像已存在，保留头像；否则使用本地默认头像
  if (!userInfo.value.avatarUrl) {
    userInfo.value.avatarUrl = DEFAULT_AVATAR;
  }
  saveUserInfo();
  toast.success('昵称已更新');
  // #endif
};

// 真实登录闭包 - 跳转到统一登录页，确保用户同意隐私协议
const doRealLogin = async () => {
  // #ifdef MP-WEIXIN
  // 微信环境：必须跳转登录页，让用户主动同意隐私协议后登录
  uni.navigateTo({
    url: '/pages/login/index',
    fail: (err) => {
      logger.error('[Settings] 跳转登录页失败:', err);
      toast.info('请前往登录页完成登录');
    }
  });
  // #endif

  // #ifndef MP-WEIXIN
  // 非微信环境，直接保存本地信息
  // 确保头像和昵称都存在
  if (!userInfo.value.avatarUrl) {
    userInfo.value.avatarUrl = DEFAULT_AVATAR;
  }
  if (!userInfo.value.nickName) {
    userInfo.value.nickName = '考研人';
  }
  if (!userInfo.value.uid) {
    // 生成随机 ID，兼容所有平台
    let hex;
    try {
      const randomBytes = new Uint8Array(16);
      (globalThis.crypto || globalThis.msCrypto).getRandomValues(randomBytes);
      hex = Array.from(randomBytes)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    } catch (_e) {
      // fallback: 非加密安全但功能可用
      hex = Date.now().toString(16) + Math.random().toString(16).slice(2, 18);
    }
    userInfo.value.uid = 'USER_' + hex;
  }
  saveUserInfo();
  toast.success('信息已保存');
  // #endif
};

// 保存用户信息到本地缓存
const saveUserInfo = () => {
  logger.log('[Settings] 💾 保存用户信息:', {
    uid: userInfo.value.uid,
    nickName: userInfo.value.nickName,
    avatarUrl: userInfo.value.avatarUrl ? '已设置' : '未设置'
  });

  // 保存到本地存储（通过 storageService 自动加密敏感数据）
  storageService.save('userInfo', userInfo.value);

  // 同时保存 userId 到统一的 key（加密存储）
  if (userInfo.value.uid) {
    storageService.save('EXAM_USER_ID', userInfo.value.uid, true);
  }

  // 触发响应式更新（Vue 3 Proxy 直接赋值即可）
  userInfo.value = { ...userInfo.value };

  // 通知其他页面用户信息已更新
  uni.$emit('userInfoUpdated', userInfo.value);
};

// 头像点击事件处理（优化：确保登录功能正常）
const handleAvatarClick = () => {
  logger.log('[Settings] 👤 头像被点击，当前登录状态:', !!userInfo.value.uid);

  if (!userInfo.value.uid) {
    // 未登录状态，提示用户点击头像按钮进行登录
    modal.show({
      title: '登录提示',
      content: '请点击头像按钮选择头像和昵称完成登录',
      showCancel: false,
      confirmText: '知道了'
    });
  } else {
    // 已登录，显示用户信息
    toast.info(`已登录：${userInfo.value.nickName || '考研人'}`);
  }
};

// 头像加载错误处理
const onAvatarError = (e) => {
  logger.log('[Settings] ⚠️ 头像加载失败，使用默认头像', e);
  // 注意：不要在这里修改 userInfo.avatarUrl，否则会覆盖用户选择的头像
  // 只在真正加载失败时使用默认头像显示，但不保存到 userInfo
  // 如果头像URL无效，让用户重新选择
  if (userInfo.value.avatarUrl && userInfo.value.avatarUrl !== defaultAvatar) {
    logger.log('[Settings] ⚠️ 头像URL无效，但保留用户选择:', userInfo.value.avatarUrl);
    // 不修改 userInfo，让用户重新选择
  }
};

// 打开邀请弹窗（从后端获取真实邀请码）
const openInviteModal = async () => {
  showInviteModal.value = true;
  // 异步拉取邀请信息（不阻塞弹窗打开）
  inviteStore.fetchInviteInfo().catch((err) => {
    logger.warn('[Settings] 拉取邀请信息失败:', err);
  });
};

// 关闭邀请弹窗
const handleCloseInviteModal = () => {
  showInviteModal.value = false;
};

// 打开海报生成弹窗
const handleOpenPoster = () => {
  showInviteModal.value = false; // 先关闭邀请弹窗
  _timers.push(
    setTimeout(() => {
      showPosterModal.value = true; // 然后打开海报弹窗
    }, 300)
  ); // 延迟300ms，让关闭动画完成
};

// 关闭海报弹窗
const handleClosePosterModal = () => {
  showPosterModal.value = false;
};

// F002: navigateToFriends moved to FriendsEntryCard.vue

// F002: selectTheme moved to ThemeSelectorModal.vue
</script>

<style lang="scss" scoped>
/* 基础样式 - 像素完美版 */
.settings-container {
  min-height: 100%;
  min-height: 100vh;
  background: linear-gradient(
    180deg,
    var(--page-gradient-top) 0%,
    var(--page-gradient-mid) 48%,
    var(--page-gradient-bottom) 100%
  );
  --hero-text: var(--text-primary);
  --hero-subtext: rgba(26, 29, 31, 0.72);
  padding: 32rpx;
  /* 8px网格 */
  padding-bottom: 100px;
  box-sizing: border-box;
  color: var(--text-sub);
  transition: background 0.3s ease;
  position: relative;
  overflow: hidden;
}

.settings-container::before,
.settings-container::after {
  content: '';
  position: absolute;
  border-radius: 9999rpx;
  pointer-events: none;
  z-index: 0;
}

.settings-container::before {
  width: 520rpx;
  height: 520rpx;
  top: -160rpx;
  right: -120rpx;
  background: radial-gradient(circle, var(--brand-tint-strong) 0%, transparent 72%);
}

.settings-container::after {
  width: 460rpx;
  height: 460rpx;
  left: -130rpx;
  bottom: 180rpx;
  background: radial-gradient(circle, var(--brand-tint) 0%, transparent 70%);
}

/* 添加fadeInUp动画 */
@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 深色模式 */
.settings-container.dark-mode {
  --bg-body: var(--bg-body);
  --text-secondary: var(--text-sub);
  --text-primary: var(--text-primary);
  --hero-text: var(--text-primary);
  --hero-subtext: var(--text-sub);
  --card-bg: var(--bg-glass);
  --card-border: var(--border);
  --brand-color: var(--primary);
  --action-blue: var(--primary-light);
  --danger-red: var(--danger);
  --bg-hover: var(--bg-glass);
  --input-placeholder: var(--text-sub);
}

/* 顶部导航 - 像素完美版 */
.top-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 32rpx;
  position: sticky;
  top: 0;
  z-index: 100;
  border-radius: 24rpx;
  padding-left: 16rpx;
  /* 8px网格 */
  animation: fadeInUp 0.5s ease-out forwards;
  opacity: 0;
  animation-delay: 0.05s;
}

.nav-back {
  width: 88rpx;
  height: 88rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 44rpx;
  color: var(--text-primary);
}

.nav-title {
  font-size: 56rpx;
  font-weight: 800;
  color: var(--text-primary);
  line-height: 1.3;
  /* 大标题紧凑 */
  letter-spacing: -0.5px;
  /* 大标题紧凑 */
}

.nav-placeholder {
  width: 88rpx;
  height: 88rpx;
}

/* 用户信息卡片 - 全新顶级设计（紧凑、现代、高粘性） */
.user-card.wise-card {
  position: relative;
  z-index: 1;
  background:
    linear-gradient(180deg, var(--apple-specular-soft, rgba(255, 255, 255, 0.2)) 0%, transparent 42%),
    linear-gradient(160deg, var(--bg-secondary) 0%, var(--bg-card) 48%, var(--bg-secondary) 100%);
  border: 1px solid var(--apple-glass-border-strong);
  border-radius: 24px;
  padding: 20px;
  margin-bottom: 20px;
  box-shadow: var(--apple-shadow-floating);
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
}

/* 添加光晕效果 */
.user-card.wise-card::before {
  content: '';
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  background:
    radial-gradient(circle at 12% 18%, rgba(255, 255, 255, 0.56) 0%, transparent 30%),
    radial-gradient(circle at 84% 24%, rgba(15, 95, 52, 0.16) 0%, transparent 30%),
    linear-gradient(90deg, transparent 16%, rgba(255, 255, 255, 0.72) 50%, transparent 84%);
  background-size:
    auto,
    auto,
    100% 1px;
  background-repeat: no-repeat;
  opacity: 1;
  transition: opacity 0.4s ease;
  pointer-events: none;
}

.user-card.wise-card:hover::before {
  opacity: 1;
}

.user-card.wise-card:hover {
  box-shadow: 0 22rpx 50rpx rgba(16, 40, 26, 0.18);
  transform: translateY(-2px);
}

.user-header {
  display: flex;
  align-items: center;
  margin-bottom: 16px;
  /* gap: 16px; -- replaced for Android WebView compat */
}

.avatar-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  /* gap: 6px; -- replaced for Android WebView compat */
  cursor: pointer;
  position: relative;
}

.avatar-btn {
  background: none;
  padding: 0;
  border: none;
  line-height: normal;
  position: relative;
}

.avatar-btn::after {
  border: none;
}

.avatar {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  object-fit: cover;
  border: 3px solid var(--overlay);
  box-shadow: var(--shadow-md);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.avatar-section:hover .avatar {
  transform: scale(1.08);
  border-color: var(--border);
  box-shadow: var(--shadow-lg);
}

.login-badge {
  background: var(--apple-glass-pill-bg);
  color: var(--text-primary);
  font-size: 24rpx;
  font-weight: 700;
  padding: 3px 10px;
  border-radius: 10px;
  border: 1px solid var(--apple-divider);
  text-align: center;
  width: 100%;
  box-shadow: 0 8rpx 18rpx rgba(16, 40, 26, 0.08);
}

.login-badge.logged-in {
  background: rgba(15, 95, 52, 0.12);
}

.user-info-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  /* gap: 10px; -- replaced for Android WebView compat */
}

.nickname-input {
  font-size: 44rpx;
  font-weight: 800;
  color: var(--text-primary);
  background-color: transparent;
  border: none;
  padding: 0;
  width: 100%;
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Noto Sans SC', 'Roboto', sans-serif;
  text-shadow: var(--shadow-sm);
  letter-spacing: -0.5px;
  line-height: 1.3;
  /* 添加呼吸感 */
}

.nickname-placeholder {
  color: var(--hero-subtext);
}

.info-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  /* gap: 8px; -- replaced for Android WebView compat */
}
.info-grid > view:nth-child(even) {
  margin-left: 8px;
}
.info-grid > view:nth-child(n + 3) {
  margin-top: 8px;
}

.info-item {
  background: rgba(255, 255, 255, 0.52);
  border-radius: 16px;
  padding: 10px;
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  border: 1px solid rgba(255, 255, 255, 0.54);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.44);
}

.info-item:active {
  background: rgba(255, 255, 255, 0.64);
  transform: scale(0.97);
}

.info-label {
  display: block;
  font-size: 24rpx;
  color: var(--text-secondary);
  margin-bottom: 3px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  line-height: 1.5;
  /* 添加呼吸感 */
}

.info-value {
  display: block;
  font-size: 26rpx;
  color: var(--text-primary);
  font-weight: 800;
  text-shadow: var(--shadow-sm);
  line-height: 1.5;
  /* 添加呼吸感 */
}

/* D017: 考试日期设置行 */
.exam-date-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 16rpx;
  padding: 16rpx 20rpx;
  background: rgba(255, 255, 255, 0.52);
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.54);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.44);
}

.exam-date-picker {
  display: flex;
  align-items: center;
}

.exam-date-value {
  font-size: 26rpx;
  color: var(--primary);
  font-weight: 700;
  margin-right: 8rpx;
}

.exam-date-placeholder {
  font-size: 26rpx;
  color: var(--text-tertiary);
  margin-right: 8rpx;
}

.stats-section {
  display: grid;
  grid-template-columns: 1fr 1fr;
  /* gap: 10px; -- replaced for Android WebView compat */
  padding-top: 16px;
  border-top: 1px solid var(--border);
}
.stats-section > view:nth-child(even) {
  margin-left: 10px;
}
.stats-section > view:nth-child(n + 3) {
  margin-top: 10px;
}

.stat-card {
  background: rgba(255, 255, 255, 0.56);
  border-radius: 18px;
  padding: 14px;
  text-align: center;
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  border: 1px solid rgba(255, 255, 255, 0.58);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.44);
}

.stat-card:active {
  background: rgba(255, 255, 255, 0.68);
  transform: scale(0.97);
}

.stat-value {
  display: block;
  font-size: 56rpx;
  font-weight: 800;
  color: var(--text-primary);
  margin-bottom: 3px;
  line-height: 1.2;
  /* 数值轻微呼吸感 */
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Noto Sans SC', 'Roboto', sans-serif;
  text-shadow: var(--shadow-sm);
  letter-spacing: -0.5px;
  /* 数字紧凑 */
}

.stat-label {
  font-size: 24rpx;
  color: var(--text-secondary);
  font-weight: 600;
  letter-spacing: 0.3px;
  line-height: 1.5;
  /* 添加呼吸感 */
}

/* 深色模式下的用户卡片（Bitget风格） */
.dark-mode .user-card.wise-card {
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.08) 0%, transparent 38%),
    linear-gradient(160deg, rgba(18, 24, 34, 0.84) 0%, rgba(13, 17, 24, 0.92) 100%);
  box-shadow: var(--apple-shadow-floating);
}

.dark-mode .user-card.wise-card::before {
  background:
    radial-gradient(circle at 12% 18%, rgba(255, 255, 255, 0.12) 0%, transparent 30%),
    radial-gradient(circle at 84% 22%, rgba(10, 132, 255, 0.18) 0%, transparent 32%),
    linear-gradient(90deg, transparent 16%, rgba(255, 255, 255, 0.22) 50%, transparent 84%);
}

.dark-mode .user-card.wise-card:hover {
  box-shadow: var(--shadow-xl);
}

.dark-mode .login-badge {
  background: rgba(255, 255, 255, 0.08);
  color: var(--text-primary);
  border-color: rgba(255, 255, 255, 0.12);
}

.dark-mode .login-badge.logged-in {
  background: rgba(10, 132, 255, 0.16);
}

.dark-mode .info-item,
.dark-mode .stat-card {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.08);
  box-shadow: inset 0 1rpx 0 rgba(255, 255, 255, 0.08);
}

.dark-mode .exam-date-row {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.08);
}

.dark-mode .info-label,
.dark-mode .stat-label {
  color: rgba(255, 255, 255, 0.68);
}

.dark-mode .settings-list {
  border-color: rgba(255, 255, 255, 0.1);
}

.dark-mode .setting-item {
  border-bottom-color: rgba(255, 255, 255, 0.08);
}

.dark-mode .setting-item:hover {
  background-color: rgba(255, 255, 255, 0.04);
}

/* 通用区块样式 - 像素完美版 */
.section {
  margin-bottom: 32rpx;
  position: relative;
  z-index: 1;
  /* 8px网格 */
  animation: fadeInUp 0.5s ease-out forwards;
  opacity: 0;
}

/* 延迟动画 */
.section:nth-child(1) {
  animation-delay: 0.1s;
}

.section:nth-child(2) {
  animation-delay: 0.2s;
}

.section:nth-child(3) {
  animation-delay: 0.3s;
}

.section:nth-child(4) {
  animation-delay: 0.4s;
}

.section:nth-child(5) {
  animation-delay: 0.5s;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.header-actions {
  display: flex;
  align-items: center;
  /* gap: 12px; -- replaced for Android WebView compat */
}

.section-title {
  font-size: 24rpx;
  font-weight: 700;
  color: var(--text-secondary);
  margin: 0;
  line-height: 1.5;
  letter-spacing: 1.4rpx;
  text-transform: uppercase;
}

/* F002: online-badge 样式已移至 AITutorList.vue */

/* 邀请好友入口卡片 */
.invite-entry-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24rpx 28rpx;
  background: linear-gradient(160deg, var(--apple-glass-card-bg) 0%, var(--apple-group-bg) 100%);
  border: 1px solid var(--apple-glass-border-strong);
  border-radius: 28rpx;
  box-shadow: var(--apple-shadow-card);
}

.invite-entry-left {
  display: flex;
  align-items: center;
  flex: 1;
}

.invite-entry-info {
  margin-left: 16rpx;
  display: flex;
  flex-direction: column;
}

.invite-entry-badge {
  background: var(--danger, #ff4b4b);
  color: #ffffff;
  font-size: 20rpx;
  padding: 6rpx 16rpx;
  border-radius: 999rpx;
  font-weight: 600;
  white-space: nowrap;
}

.invite-badge-text {
  color: #ffffff;
  font-size: 20rpx;
}

.invite-btn-small {
  display: flex;
  align-items: center;
  /* gap: 4px; -- replaced for Android WebView compat */
  background: var(--cta-primary-bg);
  color: var(--cta-primary-text);
  padding: 6px 12px;
  border: 1px solid var(--cta-primary-border);
  border-radius: 16px;
  font-size: 24rpx;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  -webkit-tap-highlight-color: transparent;
  box-shadow: var(--cta-primary-shadow);
}

.invite-btn-small:active {
  opacity: 0.85;
  transform: scale(0.95);
}

.invite-icon {
  font-size: 28rpx;
}

.invite-text-small {
  font-size: 24rpx;
  color: inherit;
}

/* F002: 智能导师列表样式已移至 AITutorList.vue */

/* 设置选项列表 */
.settings-list {
  background-color: transparent;
  border: 1px solid rgba(255, 255, 255, 0.38);
  border-radius: 16px;
  overflow: hidden;
  box-shadow: var(--apple-shadow-surface);
}

.setting-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  min-height: 96rpx;
  padding: 22px 20px;
  border-bottom: 1px solid var(--apple-divider);
  transition:
    background-color 0.2s ease,
    transform 0.2s ease;
  cursor: pointer;
}

.setting-item:last-child {
  border-bottom: none;
}

.setting-item:hover {
  background-color: rgba(255, 255, 255, 0.18);
}

.setting-info {
  display: flex;
  flex-direction: column;
}

.setting-title {
  font-size: 32rpx;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 4px;
  line-height: 1.5;
  /* 添加呼吸感 */
  letter-spacing: 0.3px;
  /* 轻微拉开 */
}

.setting-desc {
  font-size: 24rpx;
  color: var(--text-secondary);
  line-height: 1.5;
  /* 添加呼吸感 */
  letter-spacing: 0.3px;
  /* 轻微拉开 */
}

.cache-size {
  font-size: 28rpx;
  color: var(--text-secondary);
}
/* 卡通图标通用样式 */
.feature-cartoon-icon {
  width: 80rpx;
  height: 80rpx;
}

/* C5: 注销账号 */
.delete-account-section {
  margin: 30rpx 32rpx 0;
  position: relative;
  z-index: 1;
}

.delete-account-btn {
  display: flex;
  flex-direction: column;
  /* gap: 10rpx; -- replaced for Android WebView compat */
  padding: 24rpx 28rpx;
  border-radius: 28rpx;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.18) 0%, transparent 42%),
    linear-gradient(160deg, rgba(255, 255, 255, 0.82) 0%, rgba(246, 236, 235, 0.72) 100%);
  border: 1px solid rgba(255, 255, 255, 0.48);
  box-shadow: var(--apple-shadow-surface);
}

.delete-account-eyebrow,
.delete-account-desc,
.delete-account-text {
  display: block;
}

.delete-account-eyebrow {
  font-size: 22rpx;
  letter-spacing: 3rpx;
  text-transform: uppercase;
  color: rgba(160, 52, 46, 0.74);
}

.delete-account-desc {
  font-size: 24rpx;
  line-height: 1.6;
  color: rgba(115, 55, 49, 0.78);
}

.delete-account-text {
  font-size: 28rpx;
  font-weight: 650;
  color: var(--danger);
}

.deletion-pending-card {
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.16) 0%, transparent 42%),
    linear-gradient(160deg, rgba(255, 248, 246, 0.84) 0%, rgba(248, 232, 230, 0.72) 100%);
  border: 1px solid rgba(255, 99, 90, 0.24);
  border-radius: 28rpx;
  padding: 24rpx;
  box-shadow: var(--apple-shadow-surface);
}
.deletion-pending-header {
  display: flex;
  align-items: center;
  /* gap: 8rpx; -- replaced for Android WebView compat */
  margin-bottom: 12rpx;
}
.deletion-pending-icon {
  font-size: 32rpx;
}
.deletion-pending-title {
  font-size: 28rpx;
  font-weight: 600;
  color: var(--danger);
}
.deletion-pending-desc {
  font-size: 24rpx;
  color: var(--text-secondary);
  line-height: 1.5;
  margin-bottom: 20rpx;
}
.deletion-cancel-btn {
  background: var(--cta-primary-bg);
  border: 1px solid var(--cta-primary-border);
  border-radius: 999rpx;
  padding: 16rpx 0;
  text-align: center;
  box-shadow: var(--cta-primary-shadow);
}
.deletion-cancel-text {
  font-size: 28rpx;
  color: var(--cta-primary-text);
  font-weight: 500;
}

.dark-mode .delete-account-btn {
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.08) 0%, transparent 42%),
    linear-gradient(160deg, rgba(36, 17, 20, 0.94) 0%, rgba(24, 12, 15, 0.9) 100%);
  border-color: rgba(255, 255, 255, 0.1);
}

.dark-mode .delete-account-eyebrow {
  color: rgba(255, 142, 134, 0.78);
}

.dark-mode .delete-account-desc {
  color: rgba(255, 255, 255, 0.66);
}

.dark-mode .delete-account-text {
  color: var(--danger);
}

.dark-mode .deletion-pending-card {
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.08) 0%, transparent 42%),
    linear-gradient(160deg, rgba(36, 17, 20, 0.94) 0%, rgba(24, 12, 15, 0.9) 100%);
  border-color: rgba(255, 142, 134, 0.2);
}

/* 底部安全区域 */
.footer-safe {
  height: 20px;
}

/* 目标院校管理弹窗样式 */
.modal-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(9, 18, 12, 0.3);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background:
    linear-gradient(180deg, var(--apple-specular-soft) 0%, transparent 42%),
    linear-gradient(160deg, var(--apple-glass-card-bg) 0%, var(--apple-group-bg) 100%);
  border: 1px solid var(--apple-glass-border-strong);
  border-radius: 28px;
  width: 90%;
  max-width: 400px;
  max-height: 80vh;
  overflow: hidden;
  box-shadow: var(--apple-shadow-card);
}

.target-modal-card {
  padding: 14rpx 16rpx 18rpx;
}

.target-modal-handle {
  width: 84rpx;
  height: 8rpx;
  border-radius: 999rpx;
  background: rgba(0, 0, 0, 0.12);
  margin: 6rpx auto 18rpx;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 12px 18px;
  border-bottom: 1px solid var(--apple-divider);
}

.modal-title {
  font-size: 36rpx;
  font-weight: 650;
  color: var(--text-main);
}

.target-modal-eyebrow {
  display: block;
  margin-bottom: 6rpx;
  font-size: 20rpx;
  letter-spacing: 3rpx;
  text-transform: uppercase;
  color: var(--text-secondary);
}

.close-btn {
  width: 60rpx;
  height: 60rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.62);
  border: 1px solid rgba(255, 255, 255, 0.42);
  box-shadow: var(--apple-shadow-surface);
  font-size: 42rpx;
  color: var(--text-main);
}

.close-btn:hover {
  color: var(--text-main);
}

.modal-body {
  padding: 18px 12px 10px;
  max-height: 60vh;
  overflow-y: auto;
}

.empty-targets {
  text-align: center;
  padding: 40px 20px;
  color: var(--text-sub);
}

.empty-target-text {
  display: block;
  font-size: 26rpx;
}

.add-btn {
  margin-top: 20px;
  background: var(--cta-primary-bg);
  color: var(--cta-primary-text);
  border: 1px solid var(--cta-primary-border);
  border-radius: 16px;
  padding: 12px 24px;
  font-size: 28rpx;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: var(--cta-primary-shadow);
}

.add-btn:hover {
  opacity: 0.92;
  transform: translateY(-2px);
}

.target-list {
  display: flex;
  flex-direction: column;
  /* gap: 16px; -- replaced for Android WebView compat */
}

.target-item {
  display: flex;
  align-items: center;
  padding: 18px 16px;
  background: rgba(255, 255, 255, 0.56);
  border: 1px solid rgba(255, 255, 255, 0.42);
  border-radius: 22px;
  transition: all 0.2s ease;
  box-shadow: var(--apple-shadow-surface);
}

.target-item:hover {
  background-color: rgba(255, 255, 255, 0.72);
  transform: translateY(-2px);
  box-shadow: var(--apple-shadow-card);
}

.target-avatar {
  width: 50px;
  height: 50px;
  border-radius: 25px;
  margin-right: 16px;
  object-fit: cover;
}

.target-info {
  flex: 1;
}

.target-name {
  display: block;
  font-size: 32rpx;
  font-weight: 650;
  color: var(--text-main);
  margin-bottom: 4px;
}

.target-location {
  font-size: 24rpx;
  color: var(--text-sub);
}

.target-actions {
  display: flex;
  /* gap: 8px; -- replaced for Android WebView compat */
}

.action-btn {
  padding: 10px 14px;
  border-radius: 999rpx;
  font-size: 24rpx;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.delete-btn {
  color: var(--danger);
  background-color: rgba(255, 99, 90, 0.12);
  border: 1px solid rgba(255, 99, 90, 0.24);
}

.delete-btn:hover {
  background-color: var(--danger-light);
  opacity: 0.8;
}

/* F002: 智能对话窗样式已移至 AIChatModal.vue */

/* F002: 好友入口卡片样式已移至 FriendsEntryCard.vue */

/* 问题9修复：邀请按钮重新设计 */
.invite-btn-header {
  display: flex;
  align-items: center;
  /* gap: 4px; -- replaced for Android WebView compat */
  background: var(--cta-primary-bg);
  color: var(--cta-primary-text);
  padding: 8px 16px;
  border: 1px solid var(--cta-primary-border);
  border-radius: 20px;
  font-size: 24rpx;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: var(--cta-primary-shadow);
  -webkit-tap-highlight-color: transparent;
}

.invite-btn-header:hover {
  box-shadow: var(--cta-primary-shadow);
  opacity: 0.9;
  transform: translateY(-1px);
}

.invite-btn-header:active {
  opacity: 0.9;
  transform: translateY(0) scale(0.98);
}

.invite-icon-header {
  font-size: 28rpx;
}

.invite-text-header {
  font-size: 24rpx;
  color: inherit;
}

/* F002: 主题选择器样式已移至 ThemeSelectorModal.vue */

.setting-arrow {
  font-size: 40rpx;
  color: var(--text-secondary);
  opacity: 0.4;
}

/* F002: 表情选择器样式已移至 AIChatModal.vue */

/* F018: 骨架屏样式 */
.skeleton-settings {
  display: flex;
  flex-direction: column;
  /* gap: 20px; -- replaced for Android WebView compat */
}

.skeleton-user-card {
  height: 180px;
  border-radius: 24px;
}

.skeleton-section {
  display: flex;
  flex-direction: column;
  /* gap: 12px; -- replaced for Android WebView compat */
}

.skeleton-entry {
  height: 72px;
  border-radius: 16px;
}

.skeleton-item {
  height: 56px;
  border-radius: 12px;
}

.skeleton-pulse {
  background: linear-gradient(90deg, var(--bg-secondary) 25%, var(--bg-hover) 50%, var(--bg-secondary) 75%);
  background-size: 200% 100%;
  animation: skeletonPulse 1.5s ease-in-out infinite;
}

.dark-mode .skeleton-pulse {
  background: linear-gradient(90deg, var(--bg-glass) 25%, var(--overlay) 50%, var(--bg-glass) 75%);
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

/* 骨架屏淡出过渡 */
.skeleton-fade-leave-active {
  transition: opacity 0.35s ease-out;
}
.skeleton-fade-leave-to {
  opacity: 0;
}
</style>
