<template>
  <!-- 顶部导航栏 -->
  <view class="header-position-wrapper">
    <view class="status-bar-placeholder" />
    <view :class="['header-content-area', scrollY > 50 && 'header-scrolled', scrollY > 50 && 'apple-glass']">
      <!-- 左侧：圆形胶囊头像 -->
      <view class="header-avatar apple-glass-pill" @tap="handleAvatarTap">
        <image class="avatar-img" :src="displayAvatarUrl" alt="头像" mode="aspectFill" @error="onAvatarError" />
      </view>
      <!-- 中间：搜索框 -->
      <view class="header-search apple-glass-pill" @tap="handleSearchTap">
        <view class="search-icon-wrapper">
          <BaseIcon name="search" :size="24" />
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

<script setup>
import { ref, computed, watch } from 'vue';
import { toast } from '@/utils/toast.js';
/**
 * IndexHeaderBar — 首页顶部导航栏（头像 + 搜索框）
 * F002-I1b: 从 index/index.vue 提取
 */
import { storageService } from '@/services/storageService.js';
import { safeNavigateTo } from '@/utils/safe-navigate';
import { vibrateLight } from '@/utils/helpers/haptic.js';
import { logger } from '@/utils/logger.js';
import BaseIcon from '@/components/base/base-icon/base-icon.vue';

const props = defineProps({
  /** 当前滚动偏移量，用于毛玻璃效果 */
  scrollY: { type: Number, default: 0 },
  /** 用户头像URL */
  avatarUrl: { type: String, default: '/static/images/default-avatar.png' },
  /** 是否已登录 */
  isLoggedIn: { type: Boolean, default: false }
});

const emit = defineEmits(['open-login-modal']);

const searchKeyword = ref('');
const avatarLoadFailed = ref(false);

/** 实际显示的头像URL：加载失败时降级为默认头像 */
const displayAvatarUrl = computed(() => {
  if (avatarLoadFailed.value) {
    return '/static/images/default-avatar.png';
  }
  return props.avatarUrl || '/static/images/default-avatar.png';
});

// 当外部传入新的 avatarUrl 时，重置失败状态以重新尝试加载
watch(
  () => props.avatarUrl,
  () => {
    avatarLoadFailed.value = false;
  }
);

function onAvatarError() {
  logger.warn('[IndexHeaderBar] 头像加载失败，降级为默认头像');
  avatarLoadFailed.value = true;
}

function handleSearchTap() {
  // 聚焦搜索框（input会自动聚焦）
}

function onSearchFocus() {
  vibrateLight();
}

function doSearch() {
  const keyword = (searchKeyword.value || '').trim();
  if (!keyword) {
    toast.info('请输入搜索内容');
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
      fail: () => uni.reLaunch({ url: '/pages/practice/index' })
    });
  } else {
    toast.info(`未找到"${keyword}"相关题目`);
  }
}

function handleAvatarTap() {
  vibrateLight();

  if (!props.isLoggedIn) {
    emit('open-login-modal');
  } else {
    uni.switchTab({
      url: '/pages/profile/index',
      fail: () => {
        safeNavigateTo('/pages/settings/index');
      }
    });
  }
}
</script>

<style lang="scss" scoped>
.header-position-wrapper {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
  background: transparent;
  pointer-events: none;
}

.status-bar-placeholder {
  height: calc(var(--status-bar-height, 44px) + 88rpx);
}

.header-content-area {
  display: flex;
  align-items: center;
  height: 88rpx;
  padding: 0 28rpx;
  /* gap: 20rpx; -- tag-name sibling selectors removed (WeChat WXSS restriction) */
  background: transparent;
  pointer-events: auto;
  border-bottom: 1rpx solid transparent;
  transition:
    background 0.3s ease,
    backdrop-filter 0.3s ease,
    border-color 0.3s ease;
}

.header-content-area.header-scrolled {
  border-bottom-color: transparent;
  box-shadow: none;
}

.header-avatar {
  flex-shrink: 0;
  width: 88rpx;
  height: 88rpx;
  border-radius: 50%;
  overflow: hidden;
  padding: 4rpx;
  border: 1rpx solid rgba(255, 255, 255, 0.36);
  box-shadow: 0 10rpx 24rpx rgba(16, 40, 26, 0.1);
  transition: transform 0.2s ease;
}

.header-avatar:active {
  transform: scale(0.94);
}

.avatar-img {
  width: 100%;
  height: 100%;
  border-radius: 50%;
}

.header-search {
  flex: 1;
  display: flex;
  align-items: center;
  min-height: 72rpx;
  border-radius: 999rpx;
  padding: 0 22rpx;
  /* gap: 12rpx; -- tag-name sibling selectors removed (WeChat WXSS restriction) */
  border: 1rpx solid rgba(255, 255, 255, 0.5);
  transition: all 0.3s ease;
}

.header-search:active {
  transform: scale(0.99);
  box-shadow: 0 10rpx 24rpx rgba(16, 40, 26, 0.12);
}

.search-icon-wrapper {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.search-icon {
  font-size: 28rpx;
  opacity: 0.7;
}

.search-input {
  flex: 1;
  font-size: 26rpx;
  color: var(--text-primary, #1f2937);
  background: transparent;
  height: 72rpx;
  line-height: 72rpx;
}

.search-placeholder {
  color: var(--text-sub, #8a8a92);
  font-size: 26rpx;
}

@media screen and (max-width: 375px) {
  .status-bar-placeholder {
    height: calc(var(--status-bar-height, 44px) + 76rpx);
  }

  .header-content-area {
    height: 76rpx;
    padding: 0 20rpx;
  }

  .header-avatar {
    width: 80rpx;
    height: 80rpx;
  }

  .header-search {
    min-height: 64rpx;
    padding: 0 18rpx;
  }

  .search-input {
    font-size: 24rpx;
    height: 64rpx;
    line-height: 64rpx;
  }

  .search-placeholder {
    font-size: 24rpx;
  }
}

/* ---- 暗色模式覆盖 ---- */
.page-dark .header-avatar {
  border-color: var(--border, rgba(255, 255, 255, 0.12));
  box-shadow: var(--shadow-sm, 0 4rpx 12rpx rgba(0, 0, 0, 0.3));
}

.page-dark .header-search {
  border-color: var(--border, rgba(255, 255, 255, 0.12));
}

.page-dark .header-search:active {
  box-shadow: var(--shadow-sm, 0 4rpx 12rpx rgba(0, 0, 0, 0.3));
}

.page-dark .search-icon-wrapper {
  opacity: 0.85;
}
</style>
