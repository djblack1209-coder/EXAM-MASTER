<!-- RichText：渲染 Markdown + KaTeX 数学公式 -->
<template>
  <view class="rich-text-wrap">
    <rich-text :nodes="renderedHtml" />
  </view>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue';
import { renderMarkdownAsync } from '../composables/useMarkdownRenderer';

const props = defineProps({
  content: {
    type: String,
    default: ''
  }
});

const renderedHtml = ref('');

// 竞态防护计数器：确保快速切换 content 时只有最新的渲染结果生效
let _renderSeq = 0;

async function doRender() {
  if (!props.content) {
    renderedHtml.value = '';
    return;
  }
  const seq = ++_renderSeq;
  const html = await renderMarkdownAsync(props.content);
  // 仅当没有更新的渲染请求时才赋值（防止旧结果覆盖新结果）
  if (seq === _renderSeq) {
    renderedHtml.value = html;
  }
}

watch(() => props.content, doRender);
onMounted(doRender);
</script>

<style lang="scss" scoped>
.rich-text-wrap {
  width: 100%;
  font: var(--weight-regular) var(--size-body)/var(--leading-body) var(--font-ui);
  color: var(--ink);
  word-break: break-word;
  overflow: hidden;
}

// ---- KaTeX 公式样式 ----

.rich-text-wrap :deep(.katex) {
  font-size: 1.05em;
  white-space: normal;
}

.rich-text-wrap :deep(.katex-display) {
  display: block;
  text-align: center;
  margin: var(--s-2) 0;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}
</style>
