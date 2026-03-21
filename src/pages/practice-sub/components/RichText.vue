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

async function doRender() {
  if (!props.content) {
    renderedHtml.value = '';
    return;
  }
  renderedHtml.value = await renderMarkdownAsync(props.content);
}

watch(() => props.content, doRender);
onMounted(doRender);
</script>

<style lang="scss" scoped>
.rich-text-wrap {
  width: 100%;
  line-height: 1.7;
  font-size: 30rpx;
  color: var(--text-primary, #1a1a1a);
  word-break: break-word;
  overflow: hidden;
}

// ---- 以下样式通过 :deep 穿透到 rich-text 内部渲染的 HTML 节点 ----

.rich-text-wrap :deep(h1),
.rich-text-wrap :deep(h2),
.rich-text-wrap :deep(h3),
.rich-text-wrap :deep(h4) {
  font-weight: 600;
  margin: 16rpx 0 8rpx;
  color: var(--text-primary, #1a1a1a);
}

.rich-text-wrap :deep(h1) {
  font-size: 40rpx;
}
.rich-text-wrap :deep(h2) {
  font-size: 36rpx;
}
.rich-text-wrap :deep(h3) {
  font-size: 34rpx;
}
.rich-text-wrap :deep(h4) {
  font-size: 32rpx;
}

.rich-text-wrap :deep(p) {
  margin: 8rpx 0;
}

.rich-text-wrap :deep(strong) {
  font-weight: 600;
}

.rich-text-wrap :deep(em) {
  font-style: italic;
}

// 行内代码
.rich-text-wrap :deep(code) {
  background: var(--code-bg, rgba(0, 0, 0, 0.06));
  color: var(--code-color, #c7254e);
  padding: 2rpx 8rpx;
  border-radius: 6rpx;
  font-size: 26rpx;
  font-family: Menlo, Monaco, Consolas, monospace;
}

// 代码块
.rich-text-wrap :deep(pre) {
  background: var(--code-block-bg, #f6f8fa);
  border-radius: 12rpx;
  padding: 20rpx;
  margin: 12rpx 0;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

.rich-text-wrap :deep(pre code) {
  background: none;
  color: var(--code-block-color, #24292e);
  padding: 0;
  font-size: 24rpx;
  white-space: pre-wrap;
  word-break: break-all;
}

// 列表
.rich-text-wrap :deep(ul),
.rich-text-wrap :deep(ol) {
  padding-left: 40rpx;
  margin: 8rpx 0;
}

.rich-text-wrap :deep(li) {
  margin: 4rpx 0;
}

// 引用
.rich-text-wrap :deep(blockquote) {
  border-left: 6rpx solid var(--brand-color, #10b981);
  padding: 8rpx 20rpx;
  margin: 12rpx 0;
  background: var(--blockquote-bg, rgba(0, 0, 0, 0.03));
  color: var(--text-secondary, #64748b);
}

// 表格
.rich-text-wrap :deep(table) {
  width: 100%;
  border-collapse: collapse;
  margin: 12rpx 0;
  font-size: 26rpx;
}

.rich-text-wrap :deep(th),
.rich-text-wrap :deep(td) {
  border: 1rpx solid var(--table-border, #e2e8f0);
  padding: 10rpx 14rpx;
  text-align: left;
}

.rich-text-wrap :deep(th) {
  background: var(--table-header-bg, #f1f5f9);
  font-weight: 600;
}

// 链接
.rich-text-wrap :deep(a) {
  color: var(--brand-color, #10b981);
  text-decoration: none;
}

// 分割线
.rich-text-wrap :deep(hr) {
  border: none;
  border-top: 1rpx solid var(--divider-color, #e2e8f0);
  margin: 16rpx 0;
}

// 图片
.rich-text-wrap :deep(img) {
  max-width: 100%;
  border-radius: 8rpx;
}

// ---- KaTeX 公式样式 ----

.rich-text-wrap :deep(.katex) {
  font-size: 1.05em;
  white-space: normal;
}

.rich-text-wrap :deep(.katex-display) {
  display: block;
  text-align: center;
  margin: 16rpx 0;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

// ---- 深色模式覆盖 ----

.dark .rich-text-wrap,
.theme-dark .rich-text-wrap {
  color: var(--text-primary, #e2e8f0);

  :deep(h1),
  :deep(h2),
  :deep(h3),
  :deep(h4) {
    color: var(--text-primary, #e2e8f0);
  }

  :deep(code) {
    background: var(--code-bg, rgba(255, 255, 255, 0.1));
    color: var(--code-color, #f0abfc);
  }

  :deep(pre) {
    background: var(--code-block-bg, rgba(255, 255, 255, 0.06));
  }

  :deep(pre code) {
    color: var(--code-block-color, #e2e8f0);
  }

  :deep(blockquote) {
    background: var(--blockquote-bg, rgba(255, 255, 255, 0.04));
    color: var(--text-secondary, rgba(255, 255, 255, 0.7));
  }

  :deep(th) {
    background: var(--table-header-bg, rgba(255, 255, 255, 0.08));
  }

  :deep(th),
  :deep(td) {
    border-color: var(--table-border, rgba(255, 255, 255, 0.12));
  }

  :deep(hr) {
    border-top-color: var(--divider-color, rgba(255, 255, 255, 0.12));
  }
}
</style>
