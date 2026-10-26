<template>
  <view class="muse-rich-text"><MuseRichNode v-for="(node, index) in nodes" :key="index" :node="node" /></view>
</template>
<script setup>
import { computed } from 'vue';
import { parseMuseRichContent } from '@/services/learning/muse-rich-content.js';
import MuseRichNode from './muse-rich-node.vue';
const props = defineProps({ content: { type: String, default: '' } });
const nodes = computed(() => parseMuseRichContent(props.content));
</script>
<style scoped>
.muse-rich-text {
  min-width: 0;
  width: 100%;
  font-size: 15px;
  line-height: 23px;
}
</style>
