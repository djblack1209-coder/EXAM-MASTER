<template>
  <view ref="root" class="muse-page muse-ideas">
    <view class="muse-page-head"
      ><text class="muse-page-title" role="heading" aria-level="1">{{ t('muse.ideas') }}</text></view
    >
    <view class="muse-page-scroll"
      ><view class="muse-page-body">
        <view v-for="section in sections" :key="section.id" class="idea-section"
          ><text class="idea-section-title" role="heading" aria-level="2">{{ section.label }}</text
          ><view v-for="item in section.items" :key="item.id" class="idea-row"
            ><BaseButton class="idea-main" variant="quiet" align="start" :label="item.title" @tap="start(item)"
              ><view class="idea-icon"><BaseIcon :name="item.icon" size="20px" /></view
              ><view class="idea-copy"
                ><text class="idea-title">{{ item.title }}</text
                ><text v-if="item.body" class="idea-body">{{ item.body }}</text></view
              ></BaseButton
            ><BaseButton
              class="idea-more"
              variant="quiet"
              icon="ellipsis"
              icon-only
              :label="`${item.title} 的选项`"
              :aria-expanded="menuFor === item.id"
              @tap="menuFor = menuFor === item.id ? '' : item.id"
            /><view v-if="menuFor === item.id" class="idea-menu" role="group" :aria-label="`${item.title} 的选项`"
              ><text class="idea-reason">{{ item.reason }}</text
              ><BaseButton variant="quiet" align="start" icon="arrow-right" @tap="start(item)">开始</BaseButton
              ><BaseButton variant="quiet" align="start" icon="close" @tap="dismiss(item)">不感兴趣</BaseButton></view
            ></view
          ></view
        >
        <view v-if="!sections.length" class="idea-empty" role="status"
          ><view class="idea-empty-mark"><BaseIcon name="bulb" size="26px" /></view><text>暂时没有新的灵感</text></view
        >
        <text v-if="error" role="alert">{{ error }}</text>
      </view></view
    >
  </view>
</template>
<script setup>
import { computed, ref, watch, onMounted, onUnmounted } from 'vue';
import { useConversationLearningStore } from '@/stores/modules/conversation-learning.js';
import { ideaDismissals, museLearningIdeas } from '@/services/learning/muse-learning-ideas.js';
import { workspaceDrafts } from '@/services/learning/workspace-drafts.js';
import { safeNavigateTo } from '@/utils/safe-navigate.js';
import BaseButton from '@/components/base/base-button/base-button.vue';
import '@/i18n/muse.js';
import { t } from '@/i18n/index.js';
const learning = useConversationLearningStore();
const root = ref(null),
  menuFor = ref(''),
  error = ref(''),
  dismissed = ref(new Set());
const drafts = workspaceDrafts(learning);
const dismissals = computed(() => ideaDismissals(learning.state.owner));
watch(
  [() => learning.recordContext(), () => learning.state.owner],
  () => {
    dismissed.value = dismissals.value.ids();
    menuFor.value = '';
  },
  { immediate: true }
);
const sections = computed(() => museLearningIdeas(learning.state, learning.calendarTime, dismissed.value));
function start(item) {
  if (learning.busy) return;
  menuFor.value = '';
  try {
    if (item.conversationId) learning.locateConversation(item.conversationId);
    else {
      learning.selectedConversationId = null;
      // Only prefill: the learner still reads and sends the message themselves.
      drafts.save(learning.recordContext(), 'chat:new', { draft: item.draft });
    }
    error.value = '';
    safeNavigateTo('/pages/learning/index');
  } catch (e) {
    error.value = e.message;
  }
}
function dismiss(item) {
  menuFor.value = '';
  if (!dismissals.value.dismiss(item.id)) {
    error.value = '没能保存，请重试';
    return;
  }
  error.value = '';
  dismissed.value = dismissals.value.ids();
}
function keydown(event) {
  if (event.key === 'Escape' && menuFor.value) {
    event.preventDefault();
    menuFor.value = '';
  }
}
onMounted(() => (root.value?.$el || root.value)?.addEventListener?.('keydown', keydown));
onUnmounted(() => (root.value?.$el || root.value)?.removeEventListener?.('keydown', keydown));
</script>
<style src="./muse-pages.css"></style>
<style scoped>
/* Muse Ideas (A-ideas, layout only): titled sections of icon, title and two-line rows with a trailing menu. */
.muse-ideas .muse-page-head {
  max-width: 940px;
}
.idea-section {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.idea-section + .idea-section {
  margin-top: 14px;
}
.idea-section-title {
  margin-bottom: 6px;
  font-size: 15px;
  line-height: 22px;
  font-weight: 600;
}
.idea-row {
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: 4px;
}
.muse-page .idea-main {
  flex: 1;
  min-width: 0;
  min-height: 56px;
  height: auto;
  padding: 10px 12px;
  border-radius: 14px;
  font-weight: 400;
}
.idea-main :deep(.base-button__content) {
  width: 100%;
  align-items: flex-start;
  gap: 14px;
}
.idea-main:hover {
  background: var(--muse-rich-surface);
}
.idea-icon {
  width: 36px;
  height: 36px;
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  background: var(--muse-raised);
  color: var(--ink-2);
}
.idea-icon :deep(.base-icon) {
  color: inherit !important;
}
.idea-copy {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
  text-align: left;
}
.idea-title {
  font-size: 14px;
  line-height: 20px;
  font-weight: 600;
  color: var(--ink);
  overflow-wrap: anywhere;
  white-space: normal;
}
.idea-body {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
  font-size: 13px;
  line-height: 19px;
  color: var(--ink-3);
  overflow-wrap: anywhere;
  white-space: normal;
}
.muse-page .idea-more {
  flex: none;
  width: 44px;
  min-height: 44px;
  padding: 0;
  margin-top: 6px;
  color: var(--ink-3);
}
.idea-menu {
  position: absolute;
  right: 0;
  top: 52px;
  z-index: 12;
  width: 240px;
  display: flex;
  flex-direction: column;
  padding: 8px;
  border-radius: 16px;
  background: var(--muse-popover);
  box-shadow:
    var(--lift-2),
    0 0 0 1px var(--line-strong);
}
.muse-page .idea-menu .base-button {
  width: 100%;
  border-radius: 10px;
}
.idea-reason {
  padding: 6px 12px 8px;
  font-size: 12px;
  line-height: 17px;
  color: var(--ink-3);
}
.idea-empty {
  min-height: 220px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: var(--ink-2);
  font-size: 14px;
  font-weight: 600;
}
.idea-empty-mark {
  width: 56px;
  height: 56px;
  border-radius: 18px;
  background: var(--muse-rich-surface);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--ink-3);
}
.idea-empty-mark :deep(.base-icon) {
  color: inherit !important;
}
</style>
