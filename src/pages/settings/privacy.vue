<template>
  <view
    ref="keyboardRoot"
    class="page-container"
    :style="$yoziInsets"
    :class="{ 'dark-mode': isDark, 'theme-light': !isDark }"
  >
    <view class="top-nav">
      <BaseButton class="nav-back" variant="quiet" icon="arrow-left" icon-only :label="$t('ui.back')" @tap="goBack" />
      <text class="nav-title">{{ $t('pages.privacy') }}</text>
    </view>

    <scroll-view scroll-y class="content-scroll">
      <view class="content-section">
        <text class="update-date">{{ $t('policy.privacy0', { brand: BRAND.name }) }}</text>

        <view class="section">
          <text class="section-title">{{ $t('policy.privacy1', { brand: BRAND.name }) }}</text>
          <text class="section-text">{{ $t('policy.privacy2', { brand: BRAND.name }) }}</text>
        </view>

        <view class="section">
          <text class="section-title">{{ $t('policy.privacy3', { brand: BRAND.name }) }}</text>
          <text class="section-text">{{ $t('policy.privacy4', { brand: BRAND.name }) }}</text>
          <text class="section-text">{{ $t('policy.privacy5', { brand: BRAND.name }) }}</text>
          <text class="section-text">{{ $t('policy.privacy6', { brand: BRAND.name }) }}</text>
          <text class="section-text">{{ $t('policy.privacy7', { brand: BRAND.name }) }}</text>
          <text class="section-text">{{ $t('policy.privacy8', { brand: BRAND.name }) }}</text>
        </view>

        <view class="section">
          <text class="section-title">{{ $t('policy.privacy9', { brand: BRAND.name }) }}</text>
          <text class="section-text">{{ $t('policy.privacy10', { brand: BRAND.name }) }}</text>
          <text class="section-text">{{ $t('policy.privacy11', { brand: BRAND.name }) }}</text>
          <text class="section-text">{{ $t('policy.privacy12', { brand: BRAND.name }) }}</text>
          <text class="section-text">{{ $t('policy.privacy13', { brand: BRAND.name }) }}</text>
        </view>

        <view class="section">
          <text class="section-title">{{ $t('policy.privacy14', { brand: BRAND.name }) }}</text>
          <text class="section-text">{{ $t('policy.privacy15', { brand: BRAND.name }) }}</text>
          <text class="section-text">{{ $t('policy.privacy16', { brand: BRAND.name }) }}</text>
        </view>

        <view class="section">
          <text class="section-title">{{ $t('policy.privacy17', { brand: BRAND.name }) }}</text>
          <text class="section-text">{{ $t('policy.privacy18', { brand: BRAND.name }) }}</text>
        </view>

        <view class="section">
          <text class="section-title">{{ $t('policy.privacy19', { brand: BRAND.name }) }}</text>
          <text class="section-text">{{ $t('policy.privacy20', { brand: BRAND.name }) }}</text>
        </view>

        <view class="section">
          <text class="section-title">{{ $t('policy.privacy21', { brand: BRAND.name }) }}</text>
          <text class="section-text">{{ $t('policy.privacy22', { brand: BRAND.name }) }}</text>
        </view>

        <view class="section">
          <text class="section-title">{{ $t('policy.privacy23', { brand: BRAND.name }) }}</text>
          <text class="section-text">{{ $t('policy.privacy24', { brand: BRAND.name }) }}</text>
          <text class="section-text">{{ $t('policy.privacy25', { brand: BRAND.name }) }}</text>
          <text class="section-text">{{ $t('policy.privacy26', { brand: BRAND.name }) }}</text>
        </view>

        <view class="section">
          <text class="section-title">{{ $t('policy.privacy27', { brand: BRAND.name }) }}</text>
          <text class="section-text">{{ $t('policy.privacy28', { brand: BRAND.name }) }}</text>
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<script setup>
import './messages.js';
import { computed, ref, onMounted, onBeforeUnmount } from 'vue';
import BaseButton from '@/components/base/base-button/base-button.vue';
import { BRAND } from '@/config/brand.js';
import { useThemeStore } from '@/stores/modules/theme.js';
import { safeNavigateBack } from '@/utils/safe-navigate';
import { bindLearningKeyboard } from '@/services/learning/keyboard-controls.js';

const keyboardRoot = ref(null);
let unbindKeyboard = () => undefined;
onMounted(() => {
  unbindKeyboard = bindLearningKeyboard(keyboardRoot.value);
});
onBeforeUnmount(() => unbindKeyboard());

const themeStore = useThemeStore();
const isDark = computed(() => themeStore.isDark);

function goBack() {
  safeNavigateBack();
}
</script>

<style scoped>
.page-container {
  min-height: 100vh;
  color: var(--ink);
  background: var(--canvas);
  font: var(--weight-regular) var(--size-body)/var(--leading-body) var(--font-ui);
}
.top-nav {
  display: flex;
  align-items: center;
  padding: env(safe-area-inset-top, 0px) var(--s-4) 0;
  height: calc(env(safe-area-inset-top, 0px) + var(--control-height) + var(--s-4));
  gap: var(--s-3);
  box-sizing: border-box;
  max-width: var(--reading-measure);
  margin-inline: auto;
  background: var(--canvas);
  backdrop-filter: blur(var(--glass-blur));
  border-bottom: var(--border-thin) solid var(--glass-line);
}
.nav-title {
  color: var(--ink);
  font: var(--weight-ui-emphasis) var(--size-title-3)/var(--leading-title-3) var(--font-ui);
}
.content-scroll {
  height: calc(100vh - env(safe-area-inset-top, 0px) - var(--control-height) - var(--s-4));
}
.content-section {
  box-sizing: border-box;
  max-width: var(--reading-measure);
  margin: 0 auto;
  padding: var(--s-6) var(--s-4);
}
.update-date {
  font-size: var(--size-caption);
  color: var(--ink-3);
  margin-bottom: var(--s-6);
  display: block;
  line-height: var(--leading-small);
}
.section {
  padding-block: var(--s-5);
  border-bottom: var(--border-thin) solid var(--line);
  margin-bottom: var(--s-4);
}
.section-title {
  font: var(--weight-ui-emphasis) var(--size-title-3)/var(--leading-title-3) var(--font-ui);
  color: var(--ink);
  margin-bottom: var(--s-3);
  display: block;
}
.section-text {
  font-size: var(--size-body);
  color: var(--ink-2);
  line-height: var(--leading-body);
  margin-bottom: var(--s-3);
  display: block;
  overflow-wrap: anywhere;
}
.section-text:last-child {
  margin-bottom: 0;
}
</style>

<style scoped>
/* #ifdef MP-WEIXIN */
.top-nav {
  padding-top: var(--yozi-status-top, 0px);
  padding-right: calc(var(--yozi-capsule-right, 0px) + var(--s-3));
  height: calc(var(--yozi-status-top, 0px) + var(--control-height) + var(--s-4));
  background: var(--paper);
  backdrop-filter: none;
}
.content-scroll {
  height: calc(100vh - var(--yozi-status-top, 0px) - var(--control-height) - var(--s-4));
}
/* #endif */
</style>
