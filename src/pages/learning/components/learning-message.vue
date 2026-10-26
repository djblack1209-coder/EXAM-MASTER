<template>
  <view class="learning-message-content">
    <MuseRichText v-if="content" :content="content" />
    <LearningContentCards v-if="validatedBlocks" :content="validatedBlocks" />
  </view>
</template>
<script setup>
import { computed } from 'vue';
import LearningContentCards from './learning-content-cards.vue';
import MuseRichText from '@/components/business/learning/muse-rich-text.vue';
import { normalizeContentBlocks } from '../../../../laf-backend/functions/_shared/learning-content-blocks.js';
const props = defineProps({ content: { type: String, default: '' }, contentBlocks: { type: Object, default: null } });
const validatedBlocks = computed(() => {
  try {
    return props.contentBlocks ? normalizeContentBlocks(props.contentBlocks) : null;
  } catch {
    return null;
  }
});
</script>
<style scoped>
.learning-message-content {
  min-width: 0;
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
</style>
