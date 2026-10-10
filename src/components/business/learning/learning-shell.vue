<template>
  <view
    ref="root"
    class="learning-space"
    :class="{
      'space-dark': theme.isDark,
      'reduce-motion': reducedMotion,
      'space-future': theme.visualStyle === 'future',
      'space-playful': theme.visualStyle === 'playful'
    }"
    :style="platformInsets"
  >
    <view v-if="theme.visualStyle === 'future'" class="space-backdrop" aria-hidden="true">
      <image class="space-backdrop-image" :src="FUTURE_ASSETS.still" mode="aspectFill" />
    </view>
    <view class="space-frame">
      <button
        v-if="menuOpen || menuLeaving"
        class="sidebar-scrim"
        :class="{ 'is-closing': menuLeaving }"
        role="button"
        tabindex="-1"
        :disabled="menuLeaving"
        :aria-disabled="menuLeaving"
        aria-label="关闭学习目录"
        @tap="closeMenu"
      ></button>
      <view
        class="space-sidebar"
        :class="{ 'sidebar-open': menuOpen, 'sidebar-leaving': menuLeaving }"
        :inert="menuLeaving || undefined"
      >
        <view class="brand-row">
          <button
            class="brand-link"
            role="button"
            tabindex="0"
            aria-label="返回学习空间首页"
            @tap="safeNavigateTo('/pages/index/index')"
          >
            <image
              class="brand-mark"
              :src="theme.isDark ? BRAND.markOnDark : BRAND.mark"
              mode="aspectFit"
              :alt="BRAND.name"
            />
            <view class="brand-copy">
              <text class="brand-name">
                {{ BRAND.name }}
              </text>
            </view>
          </button>
          <button class="sidebar-close" role="button" tabindex="0" aria-label="关闭学习目录" @tap="closeMenu">
            <BaseIcon name="close" :size="36" :color="iconColor" />
          </button>
        </view>
        <button
          class="new-session"
          role="button"
          tabindex="0"
          :disabled="learning.busy"
          :aria-disabled="learning.busy"
          @tap="newSession"
        >
          <BaseIcon name="plus" :size="32" :color="theme.isDark ? '#20172f' : '#ffffff'" />
          <text>开始新对话</text>
        </button>
        <view class="desktop-navigation" aria-label="学习视图">
          <button
            v-for="item in navigation"
            :key="item.id"
            class="space-nav-item"
            :class="{ selected: active === item.id }"
            role="button"
            tabindex="0"
            :aria-current="active === item.id ? 'page' : undefined"
            @tap="openView(item.id)"
          >
            <BaseIcon :name="item.icon" :size="36" :color="iconColor" />
            <text>{{ item.label }}</text>
            <text v-if="item.id === 'mistake' && learning.summary.mistakes.length" class="nav-count">
              {{ learning.summary.mistakes.length }}
            </text>
          </button>
        </view>
        <view class="library-heading">
          <text>最近学习</text>
          <text class="library-count">{{ learning.state.conversations.length }}</text>
        </view>
        <view class="library-search">
          <BaseIcon name="search" :size="30" :color="iconColor" />
          <input
            ref="searchInput"
            v-model="query"
            class="search-input"
            aria-label="搜索学习对话"
            placeholder="搜索学习对话"
            placeholder-class="space-placeholder"
            maxlength="120"
            confirm-hold
          />
        </view>
        <view class="recent-list">
          <button
            v-for="conversation in recent"
            :key="conversation.id"
            class="recent-item"
            :class="{ current: learning.selectedConversationId === conversation.id }"
            role="button"
            tabindex="0"
            :disabled="learning.busy"
            :aria-disabled="learning.busy"
            @tap="resume(conversation.id)"
          >
            <BaseIcon name="chat" :size="30" :color="iconColor" />
            <text>{{ conversation.goal }}</text>
          </button>
          <text v-if="!recent.length" class="sidebar-empty">
            {{ query ? '未找到对话' : '暂无对话' }}
          </text>
        </view>
        <button class="library-materials" role="button" tabindex="0" @tap="openMaterials">
          <BaseIcon name="folder" :size="34" :color="iconColor" />
          <view class="material-copy">
            <text>私人资料</text>
            <text v-if="learning.state.materials.length" class="sidebar-caption"
              >{{ learning.state.materials.length }} 份</text
            >
          </view>
          <BaseIcon name="arrow-right" :size="28" :color="iconColor" />
        </button>
        <view class="sidebar-footer">
          <button
            role="button"
            tabindex="0"
            class="theme-button"
            :aria-label="theme.isDark ? '切换浅色阅读' : '切换深色阅读'"
            @tap="theme.toggleTheme()"
          >
            <BaseIcon :name="theme.isDark ? 'sun' : 'moon'" :size="32" :color="iconColor" />
          </button>
        </view>
      </view>
      <view class="space-main" :inert="menuOpen || undefined">
        <view class="space-header">
          <view class="space-heading">
            <button
              ref="menuButton"
              class="mobile-menu"
              role="button"
              tabindex="0"
              aria-label="打开学习目录"
              :aria-expanded="menuOpen"
              @tap="menuOpen = !menuOpen"
            >
              <BaseIcon name="menu" :size="40" :color="iconColor" />
            </button>
            <text class="space-title">{{ title }}</text>
            <text class="space-date">{{ dateLabel }}</text>
          </view>
          <view class="space-header-actions"><slot name="controls"></slot></view>
        </view>
        <view class="space-content"><slot></slot></view>
      </view>
    </view>
    <view class="mobile-dock" aria-label="学习视图" :inert="menuOpen || undefined">
      <button
        v-for="item in navigation"
        :key="item.id"
        role="button"
        tabindex="0"
        :class="{ selected: active === item.id }"
        :aria-current="active === item.id ? 'page' : undefined"
        @tap="openView(item.id)"
      >
        <BaseIcon :name="item.icon" :size="38" :color="iconColor" />
        <text>{{ item.label }}</text>
      </button>
    </view>
    <text v-if="error" class="space-error" role="alert">{{ error }}</text>
  </view>
</template>
<script setup>
import { computed, ref, onMounted, onUnmounted, nextTick, watch } from 'vue';
import { useConversationLearningStore } from '@/stores/modules/conversation-learning.js';
import { useThemeStore } from '@/stores/modules/theme.js';
import { safeNavigateTo } from '@/utils/safe-navigate';
import { bindLearningKeyboard } from '@/services/learning/keyboard-controls.js';
import { bindBusinessMotion } from '@/design/business-motion.js';
import { BRAND } from '@/config/brand.js';
import { FUTURE_ASSETS } from '@/design/future-motion.js';
const props = defineProps({
  active: { type: String, default: 'learning' },
  title: { type: String, default: '对话学习' }
});
const emit = defineEmits(['materials', 'new']);
const learning = useConversationLearningStore();
const theme = useThemeStore();
const iconColor = computed(() => (theme.isDark ? '#f0eefa' : '#080909'));
const root = ref(null);
const menuButton = ref(null);
const searchInput = ref(null);
const menuOpen = ref(false);
const menuLeaving = ref(false);
const reducedMotion = ref(true);
const query = ref('');
const platformInsets = ref({});
// #ifdef MP-WEIXIN
try {
  const windowInfo = uni.getWindowInfo();
  const capsule = uni.getMenuButtonBoundingClientRect();
  platformInsets.value = {
    '--space-status-top': `${windowInfo.statusBarHeight || 0}px`,
    '--space-capsule-right': `${windowInfo.windowWidth - capsule.left + 12}px`
  };
} catch (_error) {
  platformInsets.value = { '--space-status-top': '24px', '--space-capsule-right': '100px' };
}
// #endif
const error = ref('');
const navigation = [
  { id: 'learning', label: '对话', icon: 'chat' },
  { id: 'mistake', label: '错题', icon: 'book-open' },
  { id: 'plan', label: '计划', icon: 'calendar' },
  { id: 'study-detail', label: '统计', icon: 'chart-bar' }
];
const recent = computed(() =>
  [...learning.state.conversations]
    .reverse()
    .filter((item) => item.goal.toLocaleLowerCase().includes(query.value.trim().toLocaleLowerCase()))
    .slice(0, 8)
);
const dateLabel = computed(() => `${learning.summary.day.slice(5).replace('-', '月')}日`);
let unbind = () => undefined;
let releaseMotion = () => undefined;
let menuExitTimer = null;
watch(menuOpen, async (open) => {
  clearTimeout(menuExitTimer);
  menuLeaving.value = !open;
  if (!open) {
    menuExitTimer = setTimeout(
      () => {
        menuLeaving.value = false;
      },
      reducedMotion.value ? 0 : 240
    );
    return;
  }
  await nextTick();
  // #ifdef H5
  const element = searchInput.value?.$el || searchInput.value;
  (element?.querySelector?.('input') || element)?.focus?.();
  // #endif
});
async function closeMenu() {
  menuOpen.value = false;
  await nextTick();
  // #ifdef H5
  (menuButton.value?.$el || menuButton.value)?.focus?.();
  // #endif
}
function escapeMenu(event) {
  if (!menuOpen.value) return;
  if (event.key === 'Escape') {
    event.preventDefault();
    closeMenu();
  }
  // #ifdef H5
  if (event.key === 'Tab') {
    const element = root.value?.$el || root.value;
    const controls = [
      ...(element?.querySelectorAll?.('.sidebar-open input, .sidebar-open [role="button"]') || [])
    ].filter((node) => node.getClientRects().length && !node.hasAttribute('disabled'));
    const first = controls[0];
    const last = controls.at(-1);
    if (event.shiftKey && event.target === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && event.target === last) {
      event.preventDefault();
      first?.focus();
    }
  }
  // #endif
}
function openView(view) {
  menuOpen.value = false;
  const route = getCurrentPages().at(-1)?.route;
  if (route !== `pages/${view}/index`) safeNavigateTo(`/pages/${view}/index`);
}
function newSession() {
  if (learning.busy) return;
  learning.selectedConversationId = null;
  menuOpen.value = false;
  emit('new');
  if (getCurrentPages().at(-1)?.route !== 'pages/learning/index') safeNavigateTo('/pages/learning/index');
}
function resume(id) {
  if (learning.busy) return;
  learning.selectedConversationId = id;
  menuOpen.value = false;
  if (getCurrentPages().at(-1)?.route !== 'pages/learning/index') safeNavigateTo('/pages/learning/index');
}
function openMaterials() {
  menuOpen.value = false;
  if (props.active === 'learning') emit('materials');
  else safeNavigateTo('/pages/learning/index?panel=materials');
}
onMounted(() => {
  releaseMotion = bindBusinessMotion((reduced) => {
    reducedMotion.value = reduced;
    if (reduced && menuLeaving.value) {
      clearTimeout(menuExitTimer);
      menuLeaving.value = false;
    }
  });
  unbind = bindLearningKeyboard(root.value);
  const element = root.value?.$el || root.value;
  element?.addEventListener?.('keydown', escapeMenu);
  try {
    learning.refresh();
  } catch (e) {
    error.value = e.message;
  }
});
onUnmounted(() => {
  clearTimeout(menuExitTimer);
  releaseMotion();
  unbind();
  const element = root.value?.$el || root.value;
  element?.removeEventListener?.('keydown', escapeMenu);
});
</script>
