<template>
  <view class="conversation-context" role="group" aria-label="共享对话筛选">
    <BaseButton variant="quiet" :aria-expanded="open" @tap="open = !open">
      <BaseIcon name="chat" size="18px" /><text>{{ selectedLabel }}</text
      ><BaseIcon name="chevron-down" size="16px" />
    </BaseButton>
    <view v-if="open" class="conversation-context-options">
      <BaseButton
        v-for="option in context.options.value"
        :key="option.id"
        variant="quiet"
        align="start"
        :selected="context.id.value === option.id"
        @tap="choose(option.id)"
        >{{ option.label }}</BaseButton
      >
    </view>
  </view>
</template>
<script setup>
import { computed, ref } from 'vue';
import { useConversationLearningStore } from '@/stores/modules/conversation-learning.js';
import { workspaceConversationContext } from '@/services/learning/workspace-context.js';
import BaseButton from '@/components/base/base-button/base-button.vue';
const context = workspaceConversationContext(useConversationLearningStore());
const open = ref(false);
const selectedLabel = computed(() => context.options.value.find((o) => o.id === context.id.value)?.label || '全部对话');
function choose(id) {
  context.id.value = id;
  open.value = false;
}
</script>
<style scoped>
.conversation-context {
  position: relative;
  min-width: 0;
}
.conversation-context > .base-button {
  max-width: 100%;
  color: var(--ink-2);
}
.conversation-context :deep(.base-button__content) {
  min-width: 0;
}
.conversation-context :deep(text) {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.conversation-context-options {
  display: flex;
  flex-direction: column;
  max-height: 240px;
  overflow: auto;
  padding: 4px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: var(--muse-panel);
}
.conversation-context-options .base-button {
  width: 100%;
}
</style>
