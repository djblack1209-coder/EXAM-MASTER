<template>
  <!-- 顶部导航栏：外层定位容器完全透明 -->
  <view
    class="header-position-wrapper"
    style="position: fixed; top: 0; left: 0; right: 0; z-index: 100;
      background-color: transparent !important;
      background: transparent !important; pointer-events: none;"
  >
    <!-- 状态栏占位：透明 -->
    <view class="status-bar-placeholder" style="background: transparent !important;" />
    <!-- 内容区域：恢复点击，背景透明（滚动后才显示毛玻璃） -->
    <view
      :class="['header-content-area', scrollY > 50 && 'header-scrolled']"
      style="pointer-events: auto;"
    >
      <!-- 左侧：圆形胶囊头像 -->
      <view class="header-avatar" @tap="handleAvatarTap">
        <image
          class="avatar-img"
          :src="displayAvatarUrl"
          mode="aspectFill"
          @error="onAvatarError"
        />
      </view>
      <!-- 中间：搜索框 -->
      <view class="header-search" @tap="handleSearchTap">
        <view class="search-icon-wrapper">
          <text class="search-icon">
            &#x1F50D;
          </text>
        </view>
        <input
          v-model="searchKeyword"
          class="search-input"
          type="text"
          placeholder="搜索题目、知识点..."
          placeholder-class="search-placeholder"
          confirm-type="search"
          :adjust-position="false"
          @confirm="doSearch"
          @focus="onSearchFocus"
        />
      </view>
    </view>
  </view>
</template>

<script>
/**
 * IndexHeaderBar — 首页顶部导航栏（头像 + 搜索框）
 * F002-I1b: 从 index/index.vue 提取
 */
import { storageService } from '@/services/storageService.js';
import { safeNavigateTo } from '@/utils/safe-navigate';
import { vibrateLight } from '@/utils/helpers/haptic.js';
import { logger } from '@/utils/logger.js';

export default {
  name: 'IndexHeaderBar',

  props: {
    /** 当前滚动偏移量，用于毛玻璃效果 */
    scrollY: { type: Number, default: 0 },
    /** 用户头像URL */
    avatarUrl: { type: String, default: '/static/images/default-avatar.png' },
    /** 是否已登录 */
    isLoggedIn: { type: Boolean, default: false }
  },

  emits: ['open-login-modal'],

  data() {
    return {
      searchKeyword: '',
      avatarLoadFailed: false
    };
  },

  computed: {
    /** 实际显示的头像URL：加载失败时降级为默认头像 */
    displayAvatarUrl() {
      if (this.avatarLoadFailed) {
        return '/static/images/default-avatar.png';
      }
      return this.avatarUrl || '/static/images/default-avatar.png';
    }
  },

  watch: {
    // 当外部传入新的 avatarUrl 时，重置失败状态以重新尝试加载
    avatarUrl() {
      this.avatarLoadFailed = false;
    }
  },

  methods: {
    onAvatarError() {
      logger.warn('[IndexHeaderBar] 头像加载失败，降级为默认头像');
      this.avatarLoadFailed = true;
    },

    handleSearchTap() {
      // 聚焦搜索框（input会自动聚焦）
    },

    onSearchFocus() {
      vibrateLight();
    },

    doSearch() {
      const keyword = (this.searchKeyword || '').trim();
      if (!keyword) {
        uni.showToast({ title: '请输入搜索内容', icon: 'none' });
        return;
      }

      vibrateLight();

      // 在题库中搜索
      const questionBank = storageService.get('v30_bank', []);
      const results = questionBank.filter((q) => {
        const text = (q.question || q.title || q.content || '').toLowerCase();
        const tags = (q.tags || []).join(' ').toLowerCase();
        const category = (q.category || q.subject || '').toLowerCase();
        const kw = keyword.toLowerCase();
        return text.includes(kw) || tags.includes(kw) || category.includes(kw);
      });

      if (results.length > 0) {
        storageService.save('search_results', results);
        storageService.save('search_keyword', keyword);
        uni.switchTab({
          url: '/pages/practice/index',
          success: () => {
            uni.$emit('searchResults', { keyword, count: results.length });
          },
          fail: () => uni.reLaunch({ url: '/pages/practice/index' })
        });
      } else {
        uni.showToast({
          title: `未找到"${keyword}"相关题目`,
          icon: 'none',
          duration: 2000
        });
      }
    },

    handleAvatarTap() {
      vibrateLight();

      if (!this.isLoggedIn) {
        this.$emit('open-login-modal');
      } else {
        uni.switchTab({
          url: '/pages/profile/index',
          fail: () => {
            safeNavigateTo('/pages/settings/index');
          }
        });
      }
    }
  }
};
</script>

<style lang="scss" scoped>
/* 外层定位容器：绝对不能有任何背景色 */
.header-position-wrapper {
  /* 所有背景相关属性都在 inline style 中用 !important 强制透明 */
}

/* 状态栏占位 */
.status-bar-placeholder {
  height: calc(var(--status-bar-height, 44px) + 100rpx);
}

/* 内容区域：默认透明背景 */
.header-content-area {
  display: flex;
  align-items: center;
  height: 100rpx;
  padding: 0 24rpx;
  gap: 20rpx;
  background: transparent;
  transition: background 0.3s ease, backdrop-filter 0.3s ease;
}

.header-content-area.header-scrolled {
  background: var(--bg-glass);
  backdrop-filter: blur(20rpx);
  -webkit-backdrop-filter: blur(20rpx);
}

/* 左侧圆形胶囊头像 */
.header-avatar {
  flex-shrink: 0;
  width: 76rpx;
  height: 76rpx;
  border-radius: 50%;
  overflow: hidden;
  border: 4rpx solid rgba(255, 255, 255, 0.6);
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.1);
  transition: transform 0.2s ease;
}

.header-avatar:active {
  transform: scale(0.92);
}

.avatar-img {
  width: 100%;
  height: 100%;
  border-radius: 50%;
}

/* 中间搜索框 */
.header-search {
  flex: 1;
  display: flex;
  align-items: center;
  height: 68rpx;
  background: var(--bg-card, rgba(245, 245, 245, 0.8));
  border-radius: 34rpx;
  padding: 0 24rpx;
  gap: 12rpx;
  border: 2rpx solid var(--border, rgba(0, 0, 0, 0.06));
  transition: all 0.3s ease;
}

.header-search:active {
  border-color: var(--primary, #10B981);
}

.search-icon-wrapper {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.search-icon {
  font-size: 28rpx;
  opacity: 0.5;
}

.search-input {
  flex: 1;
  font-size: 28rpx;
  color: var(--text-primary, #1F2937);
  background: transparent;
  height: 68rpx;
  line-height: 68rpx;
}

.search-placeholder {
  color: var(--text-sub, #9CA3AF);
  font-size: 28rpx;
}
</style>
