<!-- MarkdownRenderer v2 — AI 聊天消息 Markdown 渲染组件（mp-html 版本） -->
<!--
  v2 升级（Round 14）:
    - 从 rich-text 升级为 mp-html（已在项目中，搬运自 EnhancedRichText 模式）
    - 解锁功能：可选文本、图片点击预览、链接点击处理、更好的表格渲染
    - 保留 v1 的代码高亮（highlight.js 内联样式）+ KaTeX 公式 + 亮暗双主题
-->
<template>
  <view class="markdown-body" :class="{ 'dark-mode': isDark }">
    <mp-html
      :content="renderedHtml"
      :tag-style="tagStyles"
      :lazy-load="true"
      :selectable="true"
      :preview-img="true"
      :use-anchor="false"
      @linktap="onLinkTap"
      @imgtap="onImageTap"
    />
    <!-- 流式光标 -->
    <text v-if="streaming" class="stream-cursor">▋</text>
  </view>
</template>

<script setup>
import { logger } from '@/utils/logger.js';
import { toast } from '@/utils/toast.js';
import { ref, computed, watch, onMounted } from 'vue';
import { renderMarkdownAsync } from '@/pages/practice-sub/composables/useMarkdownRenderer';
import mpHtml from 'mp-html/dist/uni-app/components/mp-html/mp-html.vue';

const props = defineProps({
  content: { type: String, default: '' },
  isDark: { type: Boolean, default: false },
  streaming: { type: Boolean, default: false }
});

const emit = defineEmits(['link-tap', 'image-tap']);

const renderedHtml = ref('');

// 防抖渲染 — 流式输出时避免每字符都触发完整 markdown 解析
let _renderTimer = null;
const RENDER_DEBOUNCE_MS = 80; // 流式时 80ms 节流

async function doRender() {
  if (!props.content) {
    renderedHtml.value = '';
    return;
  }
  try {
    renderedHtml.value = await renderMarkdownAsync(props.content, { isDark: props.isDark });
  } catch (e) {
    logger.warn('[MarkdownRenderer] render failed, fallback to raw text:', e?.message);
    renderedHtml.value = props.content;
    // 非流式模式下提示用户渲染异常（流式输出时避免频繁弹提示）
    if (!props.streaming) {
      toast.info('内容渲染异常，已显示原始文本');
    }
  }
}

function debouncedRender() {
  if (_renderTimer) clearTimeout(_renderTimer);
  if (props.streaming) {
    // 流式输出：节流渲染
    _renderTimer = setTimeout(doRender, RENDER_DEBOUNCE_MS);
  } else {
    // 非流式：立即渲染
    doRender();
  }
}

watch(() => props.content, debouncedRender);
watch(
  () => props.streaming,
  (val) => {
    // 流式结束时立即做一次最终渲染
    if (!val) doRender();
  }
);
// v2: 暗色模式切换时重新渲染（代码高亮颜色需要重新生成）
watch(
  () => props.isDark,
  () => doRender()
);
onMounted(doRender);

// v2: mp-html 动态样式（响应暗色模式）
const tagStyles = computed(() => {
  const textColor = props.isDark ? '#e2e8f0' : '#1a1a1a';
  const codeBg = props.isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)';
  const borderColor = props.isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)';

  return {
    p: `color: ${textColor}; margin: 8rpx 0; line-height: 1.7;`,
    h1: `font-size: 38rpx; font-weight: 600; color: ${textColor}; margin: 16rpx 0 8rpx;`,
    h2: `font-size: 34rpx; font-weight: 600; color: ${textColor}; margin: 16rpx 0 8rpx;`,
    h3: `font-size: 32rpx; font-weight: 600; color: ${textColor}; margin: 12rpx 0 8rpx;`,
    h4: `font-size: 30rpx; font-weight: 600; color: ${textColor}; margin: 12rpx 0 8rpx;`,
    strong: `font-weight: 600; color: ${textColor};`,
    em: 'font-style: italic;',
    code: `background: ${codeBg}; padding: 2rpx 8rpx; border-radius: 6rpx; font-size: 26rpx; font-family: Menlo,Monaco,Consolas,monospace;`,
    blockquote: `border-left: 6rpx solid var(--brand-color, #10b981); padding: 8rpx 20rpx; margin: 12rpx 0; background: ${codeBg}; color: var(--text-secondary, #64748b);`,
    table: `width: 100%; border-collapse: collapse; margin: 12rpx 0; font-size: 26rpx;`,
    th: `background: ${codeBg}; padding: 10rpx 14rpx; border: 1rpx solid ${borderColor}; font-weight: 600; text-align: left;`,
    td: `padding: 10rpx 14rpx; border: 1rpx solid ${borderColor};`,
    img: 'max-width: 100%; border-radius: 8rpx; margin: 8rpx 0;',
    ul: 'padding-left: 40rpx; margin: 8rpx 0;',
    ol: 'padding-left: 40rpx; margin: 8rpx 0;',
    li: 'margin: 4rpx 0; line-height: 1.7;',
    a: 'color: var(--brand-color, #10b981); text-decoration: underline;',
    hr: `border: none; border-top: 1rpx solid ${borderColor}; margin: 16rpx 0;`
  };
});

// v2: 链接点击处理
function onLinkTap(e) {
  emit('link-tap', e);
  // 默认行为：复制链接到剪贴板
  if (e && e.href) {
    uni.setClipboardData({
      data: e.href,
      success: () => {
        toast.success('链接已复制');
      }
    });
  }
}

// v2: 图片点击处理（mp-html 自动预览，这里只是事件通知）
function onImageTap(e) {
  emit('image-tap', e);
}
</script>

<style lang="scss">
/* 注意：mp-html 内部样式需要全局或 :deep 穿透，这里不加 scoped */

.markdown-body {
  font-size: 28rpx;
  line-height: 1.7;
  color: var(--text-primary, #1a1a1a);
  word-wrap: break-word;
  word-break: break-word;
  overflow: hidden;
}

.markdown-body .stream-cursor {
  display: inline-block;
  color: var(--primary, #0f5f34);
  animation: md-cursor-blink 0.8s step-end infinite;
  margin-left: 2rpx;
  font-weight: 400;
  font-size: 28rpx;
}

@keyframes md-cursor-blink {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0;
  }
}

/* ---- 代码块容器（由 code-highlight.js 生成的 div 包裹） ---- */
.markdown-body pre {
  background: var(--code-block-bg, #f6f8fa);
  border-radius: 12rpx;
  padding: 20rpx;
  margin: 12rpx 0;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  position: relative;
}

.markdown-body pre code {
  background: none;
  color: var(--code-block-color, #24292e);
  padding: 0;
  font-size: 24rpx;
  white-space: pre-wrap;
  word-break: break-all;
}

/* ---- KaTeX 公式 ---- */
.markdown-body .katex {
  font-size: 1.05em;
  white-space: normal;
}

.markdown-body .katex-display {
  display: block;
  text-align: center;
  margin: 16rpx 0;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

/* ---- 暗黑模式 ---- */
.markdown-body.dark-mode {
  color: var(--text-primary, #e2e8f0);
}

.markdown-body.dark-mode h1,
.markdown-body.dark-mode h2,
.markdown-body.dark-mode h3,
.markdown-body.dark-mode h4 {
  color: var(--text-primary, #e2e8f0);
}

.markdown-body.dark-mode code {
  background: var(--code-bg, rgba(255, 255, 255, 0.1));
  color: var(--code-color, #f0abfc);
}

.markdown-body.dark-mode pre {
  background: var(--code-block-bg, rgba(255, 255, 255, 0.06));
}

.markdown-body.dark-mode pre code {
  color: var(--code-block-color, #e2e8f0);
}

.markdown-body.dark-mode blockquote {
  background: var(--blockquote-bg, rgba(255, 255, 255, 0.04));
  color: var(--text-secondary, rgba(255, 255, 255, 0.7));
}

.markdown-body.dark-mode th {
  background: var(--table-header-bg, rgba(255, 255, 255, 0.08));
}

.markdown-body.dark-mode th,
.markdown-body.dark-mode td {
  border-color: var(--table-border, rgba(255, 255, 255, 0.12));
}

.markdown-body.dark-mode hr {
  border-top-color: var(--divider-color, rgba(255, 255, 255, 0.12));
}

.markdown-body.dark-mode .stream-cursor {
  color: var(--primary, #4ade80);
}
</style>
