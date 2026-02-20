<template>
  <view class="settings-container" :class="{ 'dark-mode': isDark }">
    <!-- 顶部导航 - 添加设计系统工具类 -->
    <view class="top-nav">
      <text class="nav-back" @tap="handleGoBack"> ← </text>
      <text class="nav-title ds-text-display ds-font-bold"> 设置 </text>
      <view class="nav-placeholder" />
    </view>

    <!-- F018: 页面加载骨架屏 -->
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

    <!-- 用户信息卡片 - Wise风格重新设计 -->
    <view v-show="!isPageLoading" class="user-card wise-card">
      <div class="user-header">
        <view class="avatar-section" @tap="handleAvatarClick">
          <button class="avatar-btn" open-type="chooseAvatar" @chooseavatar="onChooseAvatar">
            <image class="avatar" :src="userInfo.avatarUrl || defaultAvatar" mode="aspectFill" @error="onAvatarError" />
          </button>
          <view v-if="!userInfo.uid" class="login-badge"> 点击登录 </view>
          <view v-else class="login-badge logged-in"> 已登录 </view>
        </view>
        <div class="user-info-section">
          <input
            type="nickname"
            class="nickname-input"
            :value="userInfo.nickName || '考研人'"
            placeholder="点击设置昵称"
            placeholder-class="nickname-placeholder"
            maxlength="20"
            @blur="onNicknameChange"
          />
          <div class="info-grid">
            <div class="info-item" @tap="handleEditSchool">
              <text class="info-label"> 报考院校 </text>
              <text class="info-value">
                {{ userSchoolInfo.school || '未设置' }}
              </text>
            </div>
            <div class="info-item" @tap="handleEditMajor">
              <text class="info-label"> 报考专业 </text>
              <text class="info-value">
                {{ userSchoolInfo.major || '未设置' }}
              </text>
            </div>
          </div>
        </div>

        <!-- 目标院校管理弹窗 -->
        <view v-if="showTargetSchoolsModal" class="modal-mask" @tap="showTargetSchoolsModal = false">
          <view class="modal-content" @tap.stop>
            <view class="modal-header">
              <text class="modal-title"> 目标院校管理 </text>
              <text class="close-btn" @tap="showTargetSchoolsModal = false"> ✕ </text>
            </view>
            <view class="modal-body">
              <view v-if="targetSchools.length === 0" class="empty-targets">
                <text>暂无目标院校</text>
                <button class="add-btn" @tap="handleAddTargetSchool">去添加目标院校</button>
              </view>
              <view v-else class="target-list">
                <view
                  v-for="(school, index) in targetSchools"
                  :key="school.id || school.name || index"
                  class="target-item"
                >
                  <image class="target-avatar" :src="school.logo" lazy-load />
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
      </div>
      <div class="stats-section">
        <div class="stat-card">
          <text class="stat-value">
            {{ studyDays }}
          </text>
          <text class="stat-label"> 坚持天数 </text>
        </div>
        <div class="stat-card" @tap="handleTargetSchoolClick">
          <text class="stat-value">
            {{ targetSchools.length }}
          </text>
          <text class="stat-label"> 目标院校 </text>
        </div>
      </div>
    </view>

    <!-- F002: 好友入口（已提取为独立组件） -->
    <FriendsEntryCard />

    <!-- F002: AI 导师列表（已提取为独立组件） -->
    <AITutorList :target-schools="targetSchools" @start-chat="startAIChat" />

    <!-- 设置选项 - 优化样式 -->
    <div class="section">
      <div class="settings-list">
        <!-- 语音伴学 -->
        <div class="setting-item ds-flex ds-flex-between">
          <div class="setting-info">
            <text class="setting-title ds-text-sm ds-font-medium"> AI 语音伴学 </text>
            <text class="setting-desc ds-text-xs"> 导师回答后自动朗读 </text>
          </div>
          <switch
            :color="isDark ? 'var(--primary)' : 'var(--primary)'"
            :checked="isVoiceEnabled"
            @change="toggleVoice"
          />
        </div>

        <!-- 深色模式（自动切换 Wise/Bitget 主题） -->
        <div class="setting-item ds-flex ds-flex-between">
          <div class="setting-info">
            <text class="setting-title ds-text-sm ds-font-medium"> 深色模式 </text>
            <text class="setting-desc ds-text-xs"> 护眼模式，夜间更舒适 </text>
          </div>
          <switch :color="isDark ? 'var(--primary)' : 'var(--primary)'" :checked="isDark" @change="toggleDark" />
        </div>

        <!-- 清除缓存 -->
        <div class="setting-item ds-flex ds-flex-between ds-touchable" @tap="handleClearCache">
          <div class="setting-info">
            <text class="setting-title ds-text-sm ds-font-medium"> 清除缓存数据 </text>
            <text class="setting-desc ds-text-xs"> 释放存储空间 </text>
          </div>
          <text class="cache-size ds-text-xs">
            {{ cacheSize }}
          </text>
        </div>
      </div>
    </div>

    <!-- 退出登录（已提取为独立组件） -->
    <LogoutButton @logged-out="userInfo = {}" />

    <!-- 底部安全区域 -->
    <div class="footer-safe"></div>

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

    <!-- F002: AI 对话弹窗（已提取为独立组件） -->
    <AIChatModal :visible="showChat" :tutor="currentTutor" :voice-enabled="isVoiceEnabled" @close="showChat = false" />
  </view>
</template>

<script setup>
// Vue 原生钩子
import { ref, onMounted, onUnmounted } from 'vue';
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
import config from '@/config/index.js';
import { lafService } from '@/services/lafService.js';
import { useThemeStore } from '@/stores';
// ✅ 统一日志工具（生产环境自动禁用）
import { logger } from '@/utils/logger.js';
// 统一默认头像
const DEFAULT_AVATAR = '/static/images/default-avatar.png';
import { safeNavigateTo } from '@/utils/safe-navigate';
import { isUserLoggedIn } from '@/utils/auth/loginGuard.js';

// 基础状态
const userInfo = ref({});
const userSchoolInfo = ref({}); // 用户学校信息（报考院校、专业）
const defaultAvatar = DEFAULT_AVATAR; // 默认头像
const studyDays = ref(1);
const targetSchools = ref([]);
const cacheSize = ref('0KB');
const isDark = ref(false);
const isVoiceEnabled = ref(true); // 语音开关
const isPageLoading = ref(true); // F018: 页面加载状态
// F002-S5: isLoggingOut moved to LogoutButton component
const showTargetSchoolsModal = ref(false); // 目标院校管理弹窗
const showInviteModal = ref(false); // 邀请好友弹窗
const showPosterModal = ref(false); // 海报生成弹窗
const inviteCode = ref('EXAM8888'); // 邀请码（可以从后端获取）
const showThemeSelector = ref(false); // 主题选择器弹窗

// 主题系统
let _themeStore = null;
// F002: 对话逻辑已提取到 AIChatModal 组件，仅保留控制状态
const showChat = ref(false);
const currentTutor = ref({});

// F002: onlineFriends, watcher, and tutor init moved to AITutorList.vue

onMounted(() => {
  loadData();

  // 初始化主题系统
  _themeStore = useThemeStore();

  // 同步主题状态
  const savedTheme = storageService.get('theme_mode', 'light');
  isDark.value = savedTheme === 'dark';

  // F003: 存储回调引用，确保 $off 只移除自己的监听器
  _themeHandler = (mode) => {
    isDark.value = mode === 'dark';
  };
  _updateThemeHandler = (mode) => {
    isDark.value = mode === 'dark';
  };
  uni.$on('themeUpdate', _themeHandler);
  // ✅ FIX: Register updateTheme listener here (was previously at module scope with null handler)
  uni.$on('updateTheme', _updateThemeHandler);
});

// 监听全局主题更新事件，确保主题状态正确同步
let _themeHandler = null;
let _updateThemeHandler = null;
// ✅ FIX: uni.$on moved into onMounted — registering null handler at module scope was a no-op

onShow(() => {
  // 每次显示时重新加载数据，确保登录状态和头像同步
  loadData();

  // ✅ FIX: Use isDark.value instead of shadowing the outer ref with a local const
  const currentIsDark = storageService.get('theme_mode') === 'dark';
  isDark.value = currentIsDark;
  uni
    .setNavigationBarColor({
      frontColor: currentIsDark ? '#ffffff' : '#000000',
      backgroundColor: currentIsDark ? 'var(--bg-body)' : 'var(--bg-page)',
      animation: { duration: 0 }
    })
    .catch((err) => {
      logger.log('设置导航栏颜色失败', err);
    });
});

onUnmounted(() => {
  // F003: 传入回调引用，只移除自己注册的监听器
  if (_themeHandler) uni.$off('themeUpdate', _themeHandler);
  if (_updateThemeHandler) uni.$off('updateTheme', _updateThemeHandler);
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
  uni.navigateBack({
    fail: () => {
      uni.switchTab({ url: '/pages/profile/index' });
    }
  });
};

const loadData = () => {
  try {
    userInfo.value = storageService.get('userInfo', {});
    userSchoolInfo.value = storageService.get('user_school_info', {});
    targetSchools.value = storageService.get('target_schools', []);
    const stats = storageService.get('study_stats', {});
    studyDays.value = Object.keys(stats).length || 1;
    isVoiceEnabled.value = storageService.get('voice_enabled', true) !== false;

    uni.getStorageInfo({
      success: (res) => {
        cacheSize.value = (res.currentSize || 0) + 'KB';
      }
    });
  } catch (e) {
    logger.error('[settings] 加载数据失败:', e);
  } finally {
    isPageLoading.value = false; // F018: 数据加载完成
  }
};

// 编辑报考院校 - 直接使用搜索弹窗（school 是 tabBar 页面，switchTab 不支持 query params 和 events）
const handleEditSchool = () => {
  if (!isUserLoggedIn()) {
    uni.showToast({ title: '请先登录后编辑院校', icon: 'none' });
    return;
  }
  showSchoolSearchModal();
};

// 备用：院校搜索弹窗
const showSchoolSearchModal = () => {
  uni.showModal({
    title: '搜索报考院校',
    editable: true,
    placeholderText: '输入院校名称或代码搜索',
    content: '',
    success: async (res) => {
      if (res.confirm && res.content) {
        const keyword = res.content.trim();
        if (!keyword) {
          uni.showToast({ title: '请输入搜索关键词', icon: 'none' });
          return;
        }

        uni.showLoading({ title: '搜索中...' });
        try {
          // 调用后端搜索院校
          const response = await lafService.searchSchools(keyword, 10);
          uni.hideLoading();

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
                uni.showToast({ title: '院校已更新', icon: 'success' });
              }
            });
          } else {
            uni.showToast({ title: '未找到匹配的院校', icon: 'none' });
          }
        } catch (error) {
          uni.hideLoading();
          logger.error('[Settings] 搜索院校失败:', error);
          uni.showToast({ title: '搜索失败，请重试', icon: 'none' });
        }
      }
    }
  });
};

// 编辑报考专业
const handleEditMajor = () => {
  if (!isUserLoggedIn()) {
    uni.showToast({ title: '请先登录后编辑专业', icon: 'none' });
    return;
  }
  uni.showModal({
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
          uni.showToast({ title: isEmpty ? '专业名称不能为空' : '专业名称包含不支持的特殊字符', icon: 'none' });
          return;
        }
        userSchoolInfo.value.major = major;
        storageService.save('user_school_info', userSchoolInfo.value);
        uni.showToast({
          title: '更新成功',
          icon: 'success'
        });
      }
    }
  });
};

const toggleVoice = (e) => {
  isVoiceEnabled.value = e.detail.value;
  storageService.save('voice_enabled', isVoiceEnabled.value);
  uni.showToast({
    title: isVoiceEnabled.value ? '已开启语音伴学' : '已关闭语音伴学',
    icon: 'none'
  });
};

const toggleDark = (e) => {
  isDark.value = e.detail.value;
  const mode = isDark.value ? 'dark' : 'light';
  // 使用主题工具函数统一处理
  setTheme(mode);

  const toastMsg = isDark.value
    ? isNightTime()
      ? '已开启深色模式（护眼模式已激活）'
      : '已开启深色模式'
    : '已关闭深色模式';
  uni.showToast({ title: toastMsg, icon: 'none' });
};

const handleClearCache = () => {
  uni.showModal({
    title: '提示',
    content: '确定清理缓存吗？（登录信息和主题设置将保留）',
    success: (res) => {
      if (res.confirm) {
        // ✅ FIX: Selective cache clear — preserve auth tokens, user info, and theme settings
        // uni.clearStorageSync() would destroy JWT tokens and log the user out
        const preserveKeys = [
          'EXAM_USER_ID',
          'EXAM_TOKEN',
          'userInfo',
          'user_school_info',
          'theme_mode',
          'voice_enabled',
          'target_schools'
        ];
        const preserved = {};
        for (const key of preserveKeys) {
          try {
            const val = storageService.get(key);
            if (val !== undefined && val !== null) {
              preserved[key] = val;
            }
          } catch (e) {
            /* ignore */
          }
        }
        uni.clearStorageSync();
        for (const [key, val] of Object.entries(preserved)) {
          storageService.save(key, val);
        }
        loadData();
        uni.showToast({ title: '缓存已清理', icon: 'success' });
      }
    }
  });
};

// F002-S5: handleLogout moved to LogoutButton component

// 移除目标院校
const removeTargetSchool = (index) => {
  uni.showModal({
    title: '确认删除',
    content: `确定要删除目标院校 "${targetSchools.value[index].name}" 吗？`,
    confirmColor: '#FF3B30',
    success: (res) => {
      if (res.confirm) {
        // 从数组中删除
        targetSchools.value.splice(index, 1);
        // 更新本地存储
        storageService.save('target_schools', targetSchools.value);
        uni.showToast({ title: '已删除目标院校', icon: 'success' });
      }
    }
  });
};

// 处理目标院校点击
const handleTargetSchoolClick = () => {
  if (targetSchools.value.length > 0) {
    showTargetSchoolsModal.value = true;
  } else {
    // 跳转到择校页面（TabBar页面，使用switchTab）
    uni.switchTab({
      url: '/pages/school/index',
      success: () => {
        logger.log('[Settings] ✅ 已跳转到择校页面');
      },
      fail: (err) => {
        logger.error('[Settings] ❌ 跳转择校页面失败:', err);
        uni.showToast({ title: '跳转失败', icon: 'none' });
      }
    });
  }
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
      uni.showToast({ title: '跳转失败', icon: 'none' });
    }
  });
};

// 头像选择防抖锁
const isChoosingAvatar = ref(false);

// ✅ F020: 上传头像到服务器（异步，不阻塞本地保存）
async function _uploadAvatarToServer(filePath) {
  try {
    const userId = storageService.get('EXAM_USER_ID') || userInfo.value?.uid || userInfo.value?._id;
    if (!userId) return;

    // I005: 使用统一配置获取 API 基础地址（替代硬编码的旧 Laf 域名）
    const baseUrl = config.api.baseUrl;
    const token = storageService.get('EXAM_TOKEN', '');

    const res = await new Promise((resolve) => {
      uni.uploadFile({
        url: `${baseUrl}/upload-avatar`,
        filePath,
        name: 'file',
        formData: { userId, type: 'avatar' },
        header: { Authorization: `Bearer ${token}` },
        success: (r) => {
          try {
            const data = JSON.parse(r.data);
            if (data.code === 0 || data.success) {
              resolve({
                success: true,
                avatarUrl: data.data?.url || data.url || data.avatarUrl
              });
            } else {
              resolve({ success: false });
            }
          } catch {
            resolve({ success: false });
          }
        },
        fail: () => resolve({ success: false })
      });
    });

    if (res.success && res.avatarUrl) {
      // 用服务器返回的永久URL替换临时路径
      userInfo.value.avatarUrl = res.avatarUrl;
      storageService.save('userInfo', userInfo.value);
      uni.$emit('userInfoUpdated', { avatarUrl: res.avatarUrl });
      logger.log('[Settings] ✅ 头像已上传到服务器:', res.avatarUrl);
    }
  } catch (e) {
    console.warn('[Settings] 头像上传到服务器失败:', e.message);
  }
}

// 微信最新登录规范：获取头像
const onChooseAvatar = (e) => {
  if (!isUserLoggedIn()) {
    uni.showToast({ title: '请先登录后设置头像', icon: 'none' });
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
      // 强制触发响应式更新（确保头像立即显示）
      const updatedUserInfo = { ...userInfo.value };
      userInfo.value = {};
      setTimeout(() => {
        userInfo.value = updatedUserInfo;
      }, 50);
      // 显示成功提示
      uni.showToast({ title: '头像已更新', icon: 'success' });
      // ✅ F020: 异步上传到服务器（不阻塞本地保存）
      _uploadAvatarToServer(avatarUrl);
      // 如果没有登录，完成登录流程
      if (!userInfo.value.uid) {
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
          // 强制触发响应式更新
          const updatedInfo = { ...userInfo.value };
          userInfo.value = {};
          setTimeout(() => {
            userInfo.value = updatedInfo;
          }, 50);
          uni.showToast({ title: '头像已更新', icon: 'success' });
          // ✅ F020: 异步上传到服务器
          _uploadAvatarToServer(tempFilePath);
          if (!userInfo.value.uid) {
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
    uni.showToast({ title: '头像更新失败', icon: 'none' });
  } finally {
    // 1秒后解锁
    setTimeout(() => {
      isChoosingAvatar.value = false;
    }, 1000);
  }
};

// 输入验证：过滤危险字符和 Emoji
const sanitizeInput = (input, maxLength = 50, allowEmoji = false) => {
  if (!input) return '';
  let result = String(input)
    // 过滤危险字符：< > " ' & 和控制字符
    .replace(/[<>"'&\x00-\x1F\x7F]/g, '');

  // 可选：过滤 Emoji 和特殊字符，只保留中文、英文、数字和常用标点
  if (!allowEmoji) {
    result = result.replace(/[^\u4e00-\u9fa5a-zA-Z0-9\s\-_.,!?，。！？、]/g, '');
  }

  return result.trim().slice(0, maxLength);
};

// 微信最新登录规范：获取昵称
const onNicknameChange = (e) => {
  if (!isUserLoggedIn()) {
    uni.showToast({ title: '请先登录后修改昵称', icon: 'none' });
    return;
  }
  const rawNickName = e.detail.value;
  // 安全过滤昵称（最大20字符）
  const nickName = sanitizeInput(rawNickName, 20);

  if (!nickName) {
    const isEmpty = !rawNickName || !rawNickName.trim();
    uni.showToast({ title: isEmpty ? '昵称不能为空' : '昵称包含不支持的特殊字符', icon: 'none' });
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
  uni.showToast({ title: '昵称已更新', icon: 'success' });
  // #endif
};

// 真实登录闭环 - 使用统一的 userStore 登录
const doRealLogin = async () => {
  // #ifdef MP-WEIXIN
  uni.showLoading({ title: '登录中...' });

  try {
    // 使用 userStore 的统一登录方法
    const { useUserStore } = await import('@/stores/modules/user');
    const userStore = useUserStore();

    const result = await userStore.login(false); // 非静默模式

    uni.hideLoading();

    if (result.success) {
      // 更新本地 userInfo
      userInfo.value = {
        ...userInfo.value,
        uid: result.userInfo?.userId || result.userInfo?._id,
        ...result.userInfo
      };

      // 保存头像和昵称（如果用户已设置）
      if (userInfo.value.avatarUrl || userInfo.value.nickName) {
        saveUserInfo();
      }

      uni.showToast({ title: '登录成功', icon: 'success' });

      // 通知其他页面登录状态变化
      uni.$emit('loginStatusChanged', true);

      logger.log('[Settings] ✅ 登录完成，用户信息:', {
        uid: userInfo.value.uid,
        nickName: userInfo.value.nickName,
        hasAvatar: !!userInfo.value.avatarUrl
      });
    } else {
      uni.showToast({ title: result.error?.message || '登录失败', icon: 'none' });
    }
  } catch (error) {
    uni.hideLoading();
    logger.error('[Settings] ❌ 登录失败', error);
    uni.showToast({ title: '登录失败，请重试', icon: 'none' });
  }
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
    userInfo.value.uid = 'USER_' + Date.now() + '_' + Math.floor(Math.random() * 10000);
  }
  saveUserInfo();
  uni.showToast({ title: '信息已保存', icon: 'success' });
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

  // 强制触发响应式更新
  const updatedInfo = { ...userInfo.value };
  userInfo.value = {};
  setTimeout(() => {
    userInfo.value = updatedInfo;
  }, 50);

  // 通知其他页面用户信息已更新
  uni.$emit('userInfoUpdated', updatedInfo);
};

// 头像点击事件处理（优化：确保登录功能正常）
const handleAvatarClick = () => {
  logger.log('[Settings] 👤 头像被点击，当前登录状态:', !!userInfo.value.uid);

  if (!userInfo.value.uid) {
    // 未登录状态，提示用户点击头像按钮进行登录
    uni.showModal({
      title: '登录提示',
      content: '请点击头像按钮选择头像和昵称完成登录',
      showCancel: false,
      confirmText: '知道了'
    });
  } else {
    // 已登录，显示用户信息
    uni.showToast({
      title: `已登录：${userInfo.value.nickName || '考研人'}`,
      icon: 'none',
      duration: 2000
    });
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

// 关闭邀请弹窗
const handleCloseInviteModal = () => {
  showInviteModal.value = false;
};

// 打开海报生成弹窗
const handleOpenPoster = () => {
  showInviteModal.value = false; // 先关闭邀请弹窗
  setTimeout(() => {
    showPosterModal.value = true; // 然后打开海报弹窗
  }, 300); // 延迟300ms，让关闭动画完成
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
  min-height: 100vh;
  background-color: var(--bg-body, var(--bg-card));
  padding: 32rpx;
  /* 8px网格 */
  padding-bottom: 100px;
  box-sizing: border-box;
  color: var(--text-sub);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  transition: background-color 0.3s ease;
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
  margin-top: 40px;
  margin-bottom: 32rpx;
  /* 8px网格 */
  animation: fadeInUp 0.5s ease-out forwards;
  opacity: 0;
  animation-delay: 0.05s;
}

.nav-title {
  font-size: 64rpx;
  font-weight: 700;
  color: var(--text-primary, var(--text-primary));
  line-height: 1.3;
  /* 大标题紧凑 */
  letter-spacing: -0.5px;
  /* 大标题紧凑 */
}

/* 用户信息卡片 - 全新顶级设计（紧凑、现代、高粘性） */
.user-card.wise-card {
  background: var(--gradient-primary);
  border: none;
  border-radius: 24px;
  padding: 20px;
  margin-bottom: 20px;
  box-shadow: var(--shadow-lg);
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
}

/* 添加光晕效果 */
.user-card.wise-card::before {
  content: '';
  position: absolute;
  top: -50%;
  left: -50%;
  width: 200%;
  height: 200%;
  background: var(--gradient-radial-light);
  opacity: 0;
  transition: opacity 0.4s ease;
  pointer-events: none;
}

.user-card.wise-card:hover::before {
  opacity: 1;
}

.user-card.wise-card:hover {
  box-shadow: var(--shadow-xl);
  transform: translateY(-4px);
}

.user-header {
  display: flex;
  align-items: center;
  margin-bottom: 16px;
  gap: 16px;
}

.avatar-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
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
  background: var(--overlay);
  color: white;
  font-size: 22rpx;
  font-weight: 700;
  padding: 3px 10px;
  border-radius: 10px;
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  text-align: center;
  width: 100%;
  box-shadow: var(--shadow-sm);
}

.login-badge.logged-in {
  background: var(--bg-glass);
}

.user-info-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.nickname-input {
  font-size: 44rpx;
  font-weight: 700;
  color: white;
  background-color: transparent;
  border: none;
  padding: 0;
  width: 100%;
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif;
  text-shadow: var(--shadow-sm);
  letter-spacing: -0.5px;
  line-height: 1.3;
  /* 添加呼吸感 */
}

.nickname-placeholder {
  color: var(--overlay);
}

.info-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.info-item {
  background: var(--bg-glass);
  border-radius: 10px;
  padding: 10px;
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid var(--border);
}

.info-item:active {
  background: var(--overlay);
  transform: scale(0.97);
}

.info-label {
  display: block;
  font-size: 20rpx;
  color: var(--text-primary-foreground);
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
  color: white;
  font-weight: 700;
  text-shadow: var(--shadow-sm);
  line-height: 1.5;
  /* 添加呼吸感 */
}

.stats-section {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  padding-top: 16px;
  border-top: 1px solid var(--border);
}

.stat-card {
  background: var(--bg-glass);
  border-radius: 12px;
  padding: 14px;
  text-align: center;
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid var(--border);
}

.stat-card:active {
  background: var(--overlay);
  transform: scale(0.97);
}

.stat-value {
  display: block;
  font-size: 56rpx;
  font-weight: 900;
  color: white;
  margin-bottom: 3px;
  line-height: 1.2;
  /* 数值轻微呼吸感 */
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif;
  text-shadow: var(--shadow-sm);
  letter-spacing: -0.5px;
  /* 数字紧凑 */
}

.stat-label {
  font-size: 24rpx;
  color: var(--text-primary-foreground);
  font-weight: 600;
  letter-spacing: 0.3px;
  line-height: 1.5;
  /* 添加呼吸感 */
}

/* 深色模式下的用户卡片（Bitget风格） */
.dark-mode .user-card.wise-card {
  background: linear-gradient(135deg, var(--bg-secondary) 0%, var(--bg-card) 100%);
  box-shadow: var(--shadow-lg);
}

.dark-mode .user-card.wise-card::before {
  background: radial-gradient(circle, var(--primary-light) 0%, transparent 70%);
}

.dark-mode .user-card.wise-card:hover {
  box-shadow: var(--shadow-xl);
}

/* 通用区块样式 - 像素完美版 */
.section {
  margin-bottom: 32rpx;
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
  gap: 12px;
}

.section-title {
  font-size: 40rpx;
  font-weight: 600;
  color: var(--text-primary, var(--text-primary));
  margin: 0;
  line-height: 1.5;
  /* 添加呼吸感 */
  letter-spacing: 0.3px;
  /* 轻微拉开 */
}

/* F002: online-badge 样式已移至 AITutorList.vue */

.invite-btn-small {
  display: flex;
  align-items: center;
  gap: 4px;
  background-color: var(--brand-color);
  color: white;
  padding: 6px 12px;
  border-radius: 16px;
  font-size: 24rpx;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  -webkit-tap-highlight-color: transparent;
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
  color: white;
}

/* F002: AI导师列表样式已移至 AITutorList.vue */

/* 设置选项列表 */
.settings-list {
  background-color: var(--card-bg, var(--bg-card));
  border: 1px solid var(--card-border, #e9ecef);
  border-radius: 16px;
  overflow: hidden;
  box-shadow: var(--shadow-sm);
}

.setting-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid var(--card-border, #e9ecef);
  transition: background-color 0.2s ease;
  cursor: pointer;
}

.setting-item:last-child {
  border-bottom: none;
}

.setting-item:hover {
  background-color: var(--success-light);
}

.setting-info {
  display: flex;
  flex-direction: column;
}

.setting-title {
  font-size: 32rpx;
  font-weight: 500;
  color: var(--text-primary, var(--text-primary));
  margin-bottom: 4px;
  line-height: 1.5;
  /* 添加呼吸感 */
  letter-spacing: 0.3px;
  /* 轻微拉开 */
}

.setting-desc {
  font-size: 24rpx;
  color: var(--text-secondary, #495057);
  line-height: 1.5;
  /* 添加呼吸感 */
  letter-spacing: 0.3px;
  /* 轻微拉开 */
}

.cache-size {
  font-size: 28rpx;
  color: var(--text-secondary, #495057);
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
  background-color: var(--overlay-dark);
  backdrop-filter: blur(5px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background-color: var(--card-bg, var(--bg-card));
  border: 1px solid var(--card-border, #e9ecef);
  border-radius: 20px;
  width: 90%;
  max-width: 400px;
  max-height: 80vh;
  overflow: hidden;
  box-shadow: var(--shadow-xl);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid var(--card-border, #e9ecef);
}

.modal-title {
  font-size: 36rpx;
  font-weight: 600;
  color: var(--text-primary, var(--text-primary));
}

.close-btn {
  font-size: 48rpx;
  color: var(--text-tertiary);
  cursor: pointer;
  transition: color 0.2s ease;
}

.close-btn:hover {
  color: var(--text-primary, var(--text-primary));
}

.modal-body {
  padding: 20px;
  max-height: 60vh;
  overflow-y: auto;
}

.empty-targets {
  text-align: center;
  padding: 40px 20px;
  color: var(--text-tertiary, #9e9e9e);
}

.add-btn {
  margin-top: 20px;
  background-color: var(--brand-color, #00a96d);
  color: white;
  border: none;
  border-radius: 16px;
  padding: 12px 24px;
  font-size: 28rpx;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.add-btn:hover {
  background-color: var(--success-dark);
  transform: translateY(-2px);
}

.target-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.target-item {
  display: flex;
  align-items: center;
  padding: 16px;
  background-color: var(--card-bg, var(--bg-card));
  border: 1px solid var(--card-border, #e9ecef);
  border-radius: 12px;
  transition: all 0.2s ease;
}

.target-item:hover {
  background-color: var(--success-light);
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
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
  font-weight: 600;
  color: var(--text-primary, var(--text-primary));
  margin-bottom: 4px;
}

.target-location {
  font-size: 24rpx;
  color: var(--text-tertiary, #9e9e9e);
}

.target-actions {
  display: flex;
  gap: 8px;
}

.action-btn {
  padding: 6px 12px;
  border-radius: 8px;
  font-size: 24rpx;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.delete-btn {
  color: var(--danger);
  background-color: var(--danger-light);
}

.delete-btn:hover {
  background-color: var(--danger-light);
  opacity: 0.8;
}

/* F002: AI 对话窗样式已移至 AIChatModal.vue */

/* F002: 好友入口卡片样式已移至 FriendsEntryCard.vue */

/* 问题9修复：邀请按钮重新设计 */
.invite-btn-header {
  display: flex;
  align-items: center;
  gap: 4px;
  background: linear-gradient(135deg, var(--brand-color) 0%, var(--success-dark) 100%);
  color: white;
  padding: 8px 16px;
  border-radius: 20px;
  font-size: 24rpx;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: var(--shadow-success);
  -webkit-tap-highlight-color: transparent;
}

.invite-btn-header:hover {
  box-shadow: var(--shadow-success);
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
  color: white;
}

/* F002: 主题选择器样式已移至 ThemeSelectorModal.vue */

.setting-arrow {
  font-size: 40rpx;
  color: var(--text-secondary, #495057);
  opacity: 0.4;
}

/* F002: 表情选择器样式已移至 AIChatModal.vue */

/* F018: 骨架屏样式 */
.skeleton-settings {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.skeleton-user-card {
  height: 180px;
  border-radius: 24px;
}

.skeleton-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
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

/* 骨架屏淡出过渡 */
.skeleton-fade-leave-active {
  transition: opacity 0.35s ease-out;
}
.skeleton-fade-leave-to {
  opacity: 0;
}
</style>
