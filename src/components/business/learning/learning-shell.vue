<template>
  <view
    ref="root"
    class="learning-space"
    :class="{
      'space-dark': theme.isDark,
      'space-light': !theme.isDark,
      'reduce-motion': reducedMotion,
      'space-future': theme.visualStyle === 'future',
      'space-playful': theme.visualStyle === 'playful'
    }"
    :style="platformInsets"
  >
    <view class="space-frame">
      <button
        v-if="menuOpen || menuLeaving"
        class="sidebar-scrim"
        :class="{ 'is-closing': menuLeaving }"
        role="button"
        tabindex="-1"
        :disabled="menuLeaving"
        :aria-disabled="menuLeaving"
        :aria-label="t('learning.kh3')"
        @tap="closeMenu"
      ></button>
      <BaseCard
        surface="glass"
        padding="none"
        class="space-sidebar"
        :class="{ 'sidebar-open': menuOpen, 'sidebar-leaving': menuLeaving }"
        :inert="menuLeaving || undefined"
      >
        <view class="brand-row">
          <BaseButton
            class="brand-link"
            align="start"
            :aria-label="t('learning.kej')"
            variant="quiet"
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
          </BaseButton>
          <BaseButton
            ref="closeButton"
            class="sidebar-close"
            icon-only
            icon="close"
            :label="t('learning.closeDirectory')"
            :aria-label="t('learning.kh3')"
            variant="quiet"
            @tap="closeMenu"
          />
        </view>
        <BaseButton
          class="new-session"
          :label="t('learning.k8t')"
          block
          :disabled="learning.busy"
          :aria-disabled="learning.busy"
          variant="primary"
          icon="plus"
          @tap="newSession"
        >
          <text>{{ t('learning.k8t') }}</text>
        </BaseButton>
        <view class="desktop-navigation" :aria-label="t('nav.learningViews')">
          <BaseButton
            v-for="item in navigation"
            :key="item.id"
            class="space-nav-item"
            align="start"
            :label="learningText(item.label)"
            :title="learningText(item.label)"
            :selected="active === item.id"
            :class="{ selected: active === item.id }"
            :aria-current="active === item.id ? 'page' : undefined"
            variant="quiet"
            @tap="openView(item.id)"
          >
            <BaseIcon
              :name="item.icon"
              :label="learningText(item.label)"
              :title="learningText(item.label)"
              :selected="active === item.id"
              :tone="active === item.id ? 'violet-ink' : 'ink-3'"
            />
            <text class="sidebar-label">{{ learningText(item.label) }}</text>
            <text v-if="item.id === 'mistake' && learning.summary.mistakes.length" class="nav-count">
              {{ learning.summary.mistakes.length }}
            </text>
          </BaseButton>
        </view>
        <view class="library-search">
          <BaseInput
            ref="searchInput"
            v-model="query"
            input-class="search-input"
            hide-label
            focus-visible-only
            :placeholder="t('learning.ki6')"
            maxlength="120"
            :label="t('learning.ki6')"
          />
        </view>
        <view class="recent-list" :aria-label="t('learning.k5p')">
          <view v-for="conversation in recent" :key="conversation.id" class="recent-conversation">
            <BaseButton
              class="recent-item"
              align="start"
              :selected="learning.selectedConversationId === conversation.id"
              :class="{ current: learning.selectedConversationId === conversation.id }"
              :disabled="learning.busy"
              :aria-disabled="learning.busy"
              variant="quiet"
              @tap="resume(conversation.id)"
            >
              <BaseIcon name="chat" tone="ink-3" />
              <text class="sidebar-label">{{ conversation.goal }}</text>
            </BaseButton>
            <view v-if="learning.selectedConversationId === conversation.id" class="conversation-directory">
              <view v-for="chapter in directoryDays" :key="chapter.day" class="directory-day">
                <BaseButton
                  class="directory-date"
                  align="start"
                  :disabled="learning.busy"
                  :aria-disabled="learning.busy"
                  variant="quiet"
                  @tap="locate(conversation.id, chapter.day)"
                >
                  {{ chapter.day.slice(5).replace('-', ' / ') }}
                </BaseButton>
                <BaseButton
                  v-for="group in chapter.groups"
                  :key="group.id"
                  class="directory-module"
                  align="start"
                  :disabled="learning.busy"
                  :aria-disabled="learning.busy"
                  :aria-label="t('learning.kv1', { v0: chapter.day, v1: learningText(group.label) })"
                  variant="quiet"
                  @tap="locate(conversation.id, chapter.day, group.id)"
                >
                  <text>{{ learningText(group.label) }}</text>
                  <BaseIcon name="arrow-right" tone="ink-3" />
                </BaseButton>
              </view>
              <BaseButton
                v-if="learning.timeline.length > directoryDayLimit"
                class="directory-earlier"
                align="start"
                :disabled="learning.busy"
                :aria-disabled="learning.busy"
                data-test="earlier-learning-days"
                variant="quiet"
                @tap="directoryDayLimit += 7"
                >{{ t('learning.kjp') }}</BaseButton
              >
            </view>
          </view>
        </view>
        <BaseButton class="library-materials" align="start" variant="quiet" @tap="openMaterials">
          <BaseIcon name="folder" tone="ink-3" />
          <view class="material-copy">
            <text class="sidebar-label">{{ t('learning.k5u') }}</text>
            <text v-if="learning.state.materials.length" class="sidebar-caption"
              >{{ learning.state.materials.length }}{{ t('learning.kkd') }}</text
            >
          </view>
          <BaseIcon name="arrow-right" tone="ink-3" />
        </BaseButton>
        <view class="sidebar-footer">
          <BaseButton
            :label="theme.isDark ? t('learning.kfr') : t('learning.kev')"
            class="theme-button"
            icon-only
            :icon="theme.isDark ? 'sun' : 'moon'"
            :aria-label="theme.isDark ? t('learning.kfr') : t('learning.kev')"
            variant="quiet"
            @tap="theme.toggleTheme()"
          />
        </view>
      </BaseCard>
      <view class="space-main" :inert="menuOpen || undefined">
        <view class="space-header">
          <view class="space-heading">
            <BaseButton
              ref="menuButton"
              class="mobile-menu"
              icon-only
              icon="menu"
              :label="t('learning.openDirectory')"
              :aria-label="t('learning.ksq')"
              :aria-expanded="menuOpen"
              variant="quiet"
              @tap="menuOpen = !menuOpen"
            />
            <text class="space-title">{{ title || t('pages.learning') }}</text>
            <BaseTag tone="neutral">{{ dateLabel }}</BaseTag>
          </view>
          <view class="space-header-actions"><slot name="controls"></slot></view>
        </view>
        <view class="space-content"><slot></slot></view>
      </view>
    </view>
    <BaseCard
      surface="glass"
      padding="none"
      class="mobile-dock"
      :aria-label="t('nav.learningViews')"
      :inert="menuOpen || undefined"
    >
      <BaseButton
        v-for="item in mobileNavigation"
        :key="item.id"
        :class="{ selected: active === item.id }"
        :aria-current="active === item.id ? 'page' : undefined"
        variant="quiet"
        @tap="openView(item.id)"
      >
        <BaseIcon
          :name="item.icon"
          :selected="active === item.id"
          :tone="active === item.id ? 'violet-ink' : 'ink-3'"
        />
        <text>{{ learningText(item.label) }}</text>
      </BaseButton>
    </BaseCard>
    <BaseEmpty v-if="error" state="error" :title="learningText(error)" />
  </view>
</template>
<script setup>
import BaseCard from '@/components/base/base-card/base-card.vue';
import BaseEmpty from '@/components/base/base-empty/base-empty.vue';
import { learningText } from '@/i18n/learning.js';
import BaseButton from '@/components/base/base-button/base-button.vue';
import BaseInput from '@/components/base/base-input/base-input.vue';

import { computed, ref, onMounted, onUnmounted, nextTick, watch } from 'vue';
import { useConversationLearningStore } from '@/stores/modules/conversation-learning.js';
import { useThemeStore } from '@/stores/modules/theme.js';
import { safeNavigateTo, requestProfilePanel } from '@/utils/safe-navigate';
import { bindLearningKeyboard } from '@/services/learning/keyboard-controls.js';
import { bindBusinessMotion } from '@/design/business-motion.js';
import { BRAND } from '@/config/brand.js';
import { publicError, t } from '@/i18n/index.js';
import { formatDate } from '@/i18n/format.js';
import BaseTag from '@/components/base/base-tag/base-tag.vue';
const props = defineProps({
  active: { type: String, default: 'learning' },
  title: { type: String, default: '' }
});
const emit = defineEmits(['materials', 'new']);
const learning = useConversationLearningStore();
const theme = useThemeStore();
const root = ref(null);
const menuButton = ref(null);
const closeButton = ref(null);
const searchInput = ref(null);
const menuOpen = ref(false);
const menuLeaving = ref(false);
const reducedMotion = ref(true);
const query = ref('');
const directoryDayLimit = ref(7);
const directoryDays = computed(() => learning.timeline.slice(-directoryDayLimit.value));
watch([() => learning.recordContext(), () => learning.selectedConversationId], () => {
  directoryDayLimit.value = 7;
});
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
const navigation = computed(() => [
  { id: 'learning', label: t('nav.learning'), icon: 'chat' },
  { id: 'mistake', label: t('nav.mistake'), icon: 'book-open' },
  { id: 'plan', label: t('nav.plan'), icon: 'calendar' },
  { id: 'study-detail', label: t('nav.stats'), icon: 'chart-bar' },
  { id: 'practice', label: t('pages.practice'), icon: 'pen' },
  { id: 'question-bank', label: t('pages.bank'), icon: 'books' },
  { id: 'favorite', label: t('pages.favorite'), icon: 'star' },
  { id: 'profile', label: t('pages.profile'), icon: 'user' },
  { id: 'settings', label: t('nav.settings'), icon: 'settings' }
]);
const mobileNavigation = computed(() =>
  navigation.value.filter((item) => ['learning', 'practice', 'mistake', 'profile'].includes(item.id))
);
const recent = computed(() =>
  [...learning.state.conversations]
    .reverse()
    .filter((item) => item.goal.toLocaleLowerCase().includes(query.value.trim().toLocaleLowerCase()))
    .slice(0, 8)
);
const dateLabel = computed(() => formatDate(learning.summary.day + 'T12:00:00'));
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
  (closeButton.value?.$el || closeButton.value)?.focus?.();
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
      ...(element?.querySelectorAll?.('.sidebar-open input, .sidebar-open button, .sidebar-open [role="button"]') || [])
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
  if (['settings', 'profile'].includes(view)) {
    requestProfilePanel(view);
    if (route === 'pages/profile/index') uni.$emit('profilePanel');
    else safeNavigateTo('/pages/profile/index');
    return;
  }
  const target =
    view === 'question-bank'
      ? '/pages/practice-sub/question-bank'
      : view === 'settings'
        ? '/pages/profile/index?panel=settings'
        : `/pages/${view}/index`;
  if (view === 'settings' || route !== target.slice(1)) safeNavigateTo(target);
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
  learning.locateConversation(id);
  menuOpen.value = false;
  if (getCurrentPages().at(-1)?.route !== 'pages/learning/index') safeNavigateTo('/pages/learning/index');
}
function locate(id, day, groupId = null) {
  learning.locateConversation(id, day, groupId);
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
    error.value = publicError(e);
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
