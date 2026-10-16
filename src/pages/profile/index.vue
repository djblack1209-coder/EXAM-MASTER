<template>
  <LearningShell
    ref="root"
    class="yozi-page"
    :active="settingsMode ? 'settings' : 'profile'"
    :title="t(settingsMode ? 'nav.settings' : 'pages.profile')"
    :style="[tabBarStyle, $yoziInsets]"
    :class="{ 'dark-mode': isDark, 'theme-light': !isDark, 'reduce-motion': reducedMotion }"
  >
    <!-- 自定义导航栏 -->
    <!-- 主内容 -->
    <scroll-view scroll-y class="main-scroll">
      <!-- 用户信息 -->
      <view v-if="!settingsMode" class="section user-section">
        <view class="profile-command-card">
          <view class="profile-top">
            <view class="avatar-wrap">
              <image
                class="avatar"
                :src="avatarUrl && !avatarFailed ? avatarUrl : defaultAvatar"
                mode="aspectFill"
                :alt="t('dashboard.copy97')"
                @error="avatarFailed = true"
              />
            </view>
            <view class="profile-copy">
              <text class="user-name">{{ userName }}</text>
              <BaseButton v-if="!isLoggedIn" class="login-hint" variant="secondary" @tap="goLogin">{{
                t('dashboard.copy98')
              }}</BaseButton>
              <text v-else class="login-hint">{{ t('dashboard.copy99') }}</text>
            </view>
          </view>
        </view>
      </view>

      <!-- 旧题库记录继续保留原口径 -->
      <view v-if="!settingsMode && (totalQuestions || studyStore?.studyProgress?.studyMinutes)" class="section">
        <text class="legacy-stats-label">{{ t('dashboard.copy101') }}</text>
        <view class="stats-card"
          ><BaseStat :label="t('dashboard.copy102')" :value="studyStore?.studyProgress?.studyMinutes || 0" /><BaseStat
            :label="t('dashboard.copy103')"
            :value="totalQuestions" /><BaseListRow
            :label="t('dashboard.copy14')"
            :value="accuracyDisplay"
            :actionable="false"
        /></view>
      </view>

      <!-- 菜单列表 -->
      <view class="section">
        <view class="card menu-card">
          <BaseListRow class="language-setting" :label="$t('settings.language')" :actionable="false">
            <BaseInput
              id="language-picker"
              v-model="languageDraft"
              :options="languageOptions"
              :label="$t('settings.language')"
              hide-label
            />
          </BaseListRow>
          <view v-if="languageDraft !== languageCode" class="language-actions">
            <BaseButton class="language-save" variant="secondary" @tap="saveLanguage">{{
              $t('settings.save')
            }}</BaseButton>
            <BaseButton class="language-cancel" variant="secondary" @tap="languageDraft = languageCode">{{
              $t('settings.cancel')
            }}</BaseButton>
          </view>
          <BaseListRow :label="t('dashboard.copy104')" @tap="goTo('/pages/mistake/index')" />
          <BaseListRow :label="t('dashboard.copy105')" @tap="goTo('/pages/favorite/index')" />
          <BaseListRow :label="t('dashboard.copy106')" @tap="goTo('/pages/settings/privacy')" />
          <BaseListRow :label="t('dashboard.copy107')" @tap="goTo('/pages/settings/terms')" />
          <BaseListRow :label="t('dashboard.copy108')" @tap="handleFeedback" />
        </view>
      </view>

      <!-- 退出登录 -->
      <view v-if="isLoggedIn" class="section">
        <BaseButton class="logout-btn" variant="danger" danger-secondary @tap="handleLogout"
          ><text class="logout-text">{{ t('dashboard.copy110') }}</text></BaseButton
        >
      </view>

      <!-- 底部占位 -->
      <view class="yozi-tabbar-space" aria-hidden="true" />
    </scroll-view>

    <!-- 底部导航栏 -->

    <CustomModal
      v-model:visible="showDialog"
      :is-dark="isDark"
      :title="dialog.title"
      :content="dialog.content"
      :show-cancel="dialog.kind === 'logout'"
      :mask-closable="dialog.kind === 'feedback'"
      :confirm-text="dialog.kind === 'logout' ? t('dashboard.copy110') : t('dashboard.copy111')"
      @confirm="confirmDialog"
    />
  </LearningShell>
</template>

<script>
import LearningShell from '@/components/business/learning/learning-shell.vue';
import { getTabbarSafeAreaStyle } from '@/utils/core/system.js';
import '@/i18n/messages/dashboard.js';
import BaseListRow from '@/components/base/base-list-row/base-list-row.vue';
import BaseStat from '@/components/base/base-stat/base-stat.vue';
import BaseButton from '@/components/base/base-button/base-button.vue';
import BaseInput from '@/components/base/base-input/base-input.vue';
import '@/styles/yozi-pages.scss';

import { useUserStore } from '@/stores/modules/user';
import { useStudyStore } from '@/stores/modules/study';
import { useThemeStore } from '@/stores/modules/theme.js';
import { storageService } from '@/services/storageService.js';
import { safeNavigateTo, consumeProfilePanel } from '@/utils/safe-navigate';
import { logger } from '@/utils/logger.js';
import CustomModal from '@/components/common/CustomModal.vue';
import { DEFAULT_AVATAR } from '@/config/brand.js';
import { bindLearningKeyboard } from '@/services/learning/keyboard-controls.js';
import { bindBusinessMotion } from '@/design/business-motion.js';
import { currentLanguage, LANGUAGE_OPTIONS, setLanguage, t, translateRegisteredText } from '@/i18n/index.js';

export default {
  components: { LearningShell, BaseButton, BaseInput, BaseStat, BaseListRow, CustomModal },

  data() {
    return {
      settingsMode: false,
      languageDraft: currentLanguage.value,
      statusBarHeight: 44,
      tabBarStyle: {},
      defaultAvatar: DEFAULT_AVATAR,
      avatarFailed: false,
      reducedMotion: true,
      showDialog: false,
      dialog: { kind: 'feedback', title: t('dashboard.copy108'), content: t('dashboard.copy112') }
    };
  },

  computed: {
    languageOptions() {
      return LANGUAGE_OPTIONS.map((item) => ({
        ...item,
        label: t(item.value === 'en' ? 'dashboard.languageEnglish' : 'dashboard.languageChinese')
      }));
    },
    languageCode() {
      return currentLanguage.value;
    },
    languageDraftIndex() {
      return Math.max(
        0,
        this.languageOptions.findIndex((item) => item.value === this.languageDraft)
      );
    },
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
      if (!this.isLoggedIn) return t('dashboard.copy113');
      return this.userStore?.userInfo?.nickName || storageService.get('userInfo')?.nickName || t('dashboard.copy114');
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

  onLoad(options) {
    this.setProfilePanel(consumeProfilePanel() || options?.panel || 'profile');
    uni.$on('profilePanel', this.setProfilePanel);
    this.syncTheme();
    this.initLayout();
    uni.$on('themeUpdate', this.syncTheme);
    uni.$on('updateTheme', this.syncTheme);
  },

  watch: {
    languageCode(value) {
      this.languageDraft = value;
    },
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
    uni.$off('profilePanel', this.setProfilePanel);
    this.releaseKeyboard?.();
    this.releaseMotion?.();
  },

  onShow() {
    const panel = consumeProfilePanel();
    if (panel) this.setProfilePanel(panel);
    this.syncPanelTitle();
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
    setProfilePanel(panel) {
      this.settingsMode = (panel || consumeProfilePanel()) === 'settings';
      this.syncPanelTitle();
    },
    syncPanelTitle() {
      try {
        uni
          .setNavigationBarTitle?.({ title: t(this.settingsMode ? 'nav.settings' : 'pages.profile') })
          ?.catch?.(() => undefined);
      } catch {
        /* A page that is still loading will retry in onShow. */
      }
    },
    t,
    uiText(value) {
      return translateRegisteredText('dashboard', value);
    },
    selectLanguageDraft(event) {
      const item = this.languageOptions[Number(event.detail.value)];
      if (item) this.languageDraft = item.value;
    },
    saveLanguage() {
      if (!setLanguage(this.languageDraft)) uni.showToast({ title: t('settings.languageError'), icon: 'none' });
      this.syncPanelTitle();
    },
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
        this.tabBarStyle = getTabbarSafeAreaStyle();
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
      this.dialog = { kind: 'feedback', title: t('dashboard.copy108'), content: t('dashboard.copy112') };
      this.showDialog = true;
    },

    handleLogout() {
      this.dialog = { kind: 'logout', title: t('dashboard.copy115'), content: t('dashboard.copy116') };
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
          uni.showToast({ title: t('dashboard.copy117'), icon: 'success' });
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
