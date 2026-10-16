<template>
  <view>
    <FutureLanding v-if="theme.visualStyle === 'future'" @open="open" />
    <PlayfulLanding v-else @open="open" />
    <slot></slot>
  </view>
</template>
<script setup>
import FutureLanding from './future-landing.vue';
import PlayfulLanding from './playful-landing.vue';
import { useThemeStore } from '@/stores/modules/theme.js';
import { useConversationLearningStore } from '@/stores/modules/conversation-learning.js';
import { safeNavigateTo } from '@/utils/safe-navigate.js';
defineEmits(['legacy']);
const theme = useThemeStore();
const learning = useConversationLearningStore();
function open(target) {
  if (target === 'start') {
    learning.selectedConversationId = null;
    safeNavigateTo('/pages/learning/index');
    return;
  }
  if (target === 'desktop' || target === 'web') {
    theme.setVisualStyle(target === 'desktop' ? 'future' : 'playful');
    return;
  }
  if (target === 'materials' || target === 'connections') {
    safeNavigateTo('/pages/learning/index?panel=' + target);
    return;
  }
  safeNavigateTo(target === 'account' ? '/pages/profile/index' : '/pages/' + target + '/index');
}
</script>
<style scoped>
.landing-welcome {
  padding: var(--s-4) 0 var(--s-8);
}
.landing-title {
  white-space: pre-line;
  display: block;
  font-size: var(--size-number);
  letter-spacing: -0.03em;
  line-height: 1.3;
  font-weight: var(--weight-regular);
}
.landing-start {
  padding: var(--s-6);
}
.landing-actions {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: var(--s-4);
  margin-top: var(--s-3);
  margin-bottom: var(--s-4);
}
.landing-start .button-row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--s-2);
}
.landing-below {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--s-4);
  margin-top: var(--s-5);
}
.landing-below-single {
  grid-template-columns: 1fr;
}
.continue-panel {
  padding: var(--s-5);
}
.continue-panel .section-title {
  font-size: var(--size-body);
}
.learning-space .continue-session {
  width: 100%;
  justify-content: space-between;
  text-align: left;
  padding: var(--s-5) 0;
}
.continue-session .continue-copy {
  flex: 1;
  min-width: 0;
}
.continue-title {
  display: block;
  font-size: var(--size-title-3);
  overflow-wrap: anywhere;
  margin-bottom: var(--s-2);
}
.landing-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--s-4);
  margin-top: var(--s-6);
  font-size: var(--size-caption);
  color: var(--ink-3);
}
.learning-space .account-link {
  font-size: var(--size-caption);
}
@media (max-width: 1100px) {
  .landing-below {
    grid-template-columns: 1fr;
  }
}
@media (max-width: 520px) {
  .landing-title {
    white-space: pre-line;
    font-size: var(--size-number);
  }
  .landing-start {
    padding: var(--s-5);
  }
  .landing-actions {
    align-items: flex-start;
    flex-direction: column;
    gap: var(--s-3);
  }
  .landing-footer {
    align-items: flex-start;
    flex-direction: column;
    gap: var(--s-2);
  }
}
@media (prefers-reduced-transparency: reduce), (prefers-contrast: more) {
}
</style>
