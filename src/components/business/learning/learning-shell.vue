<template>
  <view ref="root" class="learning-space" :class="{ 'space-dark': theme.isDark }" :style="platformInsets">
    <view class="space-backdrop" aria-hidden="true">
      <image class="space-backdrop-image" src="/static/images/learning-room.webp" mode="aspectFill" />
      <view class="space-backdrop-tint" />
    </view>
    <view class="space-frame">
      <button
        v-if="menuOpen"
        class="sidebar-scrim"
        role="button"
        tabindex="0"
        aria-label="关闭学习目录"
        @tap="closeMenu"
      ></button>
      <view class="space-sidebar" :class="{ 'sidebar-open': menuOpen }">
        <view class="brand-row">
          <button
            class="brand-link"
            role="button"
            tabindex="0"
            aria-label="返回学习空间首页"
            @tap="safeNavigateTo('/pages/index/index')"
          >
            <image class="brand-mark" :src="BRAND.markOnDark" mode="aspectFit" :alt="BRAND.name" />
            <view class="brand-copy">
              <text class="brand-name">
                {{ BRAND.chinese }} <text class="brand-english">{{ BRAND.english }}</text>
              </text>
              <text class="brand-caption">你的学习空间</text>
            </view>
          </button>
          <button class="sidebar-close" role="button" tabindex="0" aria-label="关闭学习目录" @tap="closeMenu">
            <BaseIcon name="close" :size="36" color="#f8f5ee" />
          </button>
        </view>
        <button class="new-session" role="button" tabindex="0" :disabled="learning.busy" @tap="newSession">
          <BaseIcon name="plus" :size="32" color="#433f35" />
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
            <BaseIcon :name="item.icon" :size="36" color="#f8f5ee" />
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
          <BaseIcon name="search" :size="30" color="#f8f5ee" />
          <input
            ref="searchInput"
            v-model="query"
            class="search-input"
            aria-label="搜索学习对话"
            placeholder="搜索学习对话"
            placeholder-class="space-placeholder"
            maxlength="120"
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
            @tap="resume(conversation.id)"
          >
            <BaseIcon name="chat" :size="30" color="#f8f5ee" />
            <text>{{ conversation.goal }}</text>
          </button>
          <text v-if="!recent.length" class="sidebar-empty">
            {{ query ? '没有匹配的对话，试试另一个关键词。' : '从一个问题开始，学习会自动留在这里。' }}
          </text>
        </view>
        <button class="library-materials" role="button" tabindex="0" @tap="openMaterials">
          <BaseIcon name="folder" :size="34" color="#f8f5ee" />
          <view class="material-copy">
            <text>私人资料</text>
            <text class="sidebar-caption">
              {{
                learning.state.materials.length
                  ? `${learning.state.materials.length} 份已保存 · 在设备上`
                  : '选用自己的资料，也可直接开始'
              }}
            </text>
          </view>
          <BaseIcon name="arrow-right" :size="28" color="#f8f5ee" />
        </button>
        <view class="sidebar-footer">
          <view class="quiet-dot" />
          <text>核心学习工具免费</text>
          <button
            role="button"
            tabindex="0"
            class="theme-button"
            :aria-label="theme.isDark ? '切换浅色阅读' : '切换深色阅读'"
            @tap="theme.toggleTheme()"
          >
            <BaseIcon :name="theme.isDark ? 'sun' : 'moon'" :size="32" color="#f8f5ee" />
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
              <BaseIcon name="menu" :size="40" color="#f8f5ee" />
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
        <BaseIcon :name="item.icon" :size="38" color="#f8f5ee" />
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
import { BRAND } from '@/config/brand.js';
const props = defineProps({
  active: { type: String, default: 'learning' },
  title: { type: String, default: '对话学习' }
});
const emit = defineEmits(['materials', 'new']);
const learning = useConversationLearningStore();
const theme = useThemeStore();
const root = ref(null);
const menuButton = ref(null);
const searchInput = ref(null);
const menuOpen = ref(false);
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
watch(menuOpen, async (open) => {
  if (!open) return;
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
  unbind();
  const element = root.value?.$el || root.value;
  element?.removeEventListener?.('keydown', escapeMenu);
});
</script>
