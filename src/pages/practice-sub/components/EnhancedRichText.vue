<template>
  <view class="enhanced-rich-text" :class="{ 'dark-mode': isDark }">
    <mp-html
      :content="processedContent"
      :tag-style="tagStyles"
      :lazy-load="true"
      :selectable="true"
      :preview-img="true"
      :use-anchor="false"
      @linktap="onLinkTap"
      @imgtap="onImageTap"
      @load="onLoad"
      @error="onError"
    />
  </view>
</template>

<script setup>
import { computed } from 'vue';
import mpHtml from 'mp-html/dist/uni-app/components/mp-html/mp-html.vue';

const props = defineProps({
  content: { type: String, default: '' },
  isDark: { type: Boolean, default: false },
  type: { type: String, default: 'question' } // 'question' | 'explanation' | 'note'
});

const emit = defineEmits(['image-tap', 'link-tap', 'load', 'error']);

// Process content - add wrapper styles, handle special patterns
const processedContent = computed(() => {
  if (!props.content) return '';
  let html = props.content;

  // If content looks like plain text (no HTML tags), wrap in paragraph
  if (!/<[a-z][\s\S]*>/i.test(html)) {
    // Convert line breaks to <br>
    html = html.replace(/\n/g, '<br>');
    html = `<p>${html}</p>`;
  }

  return html;
});

// Tag styles for consistent rendering
const tagStyles = computed(() => {
  const textColor = props.isDark ? '#e0e0e0' : '#1a1a2e';
  const codeBg = props.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)';
  const borderColor = props.isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)';

  return {
    p: `font-size: 30rpx; line-height: 1.8; color: ${textColor}; margin: 8rpx 0;`,
    h1: `font-size: 40rpx; font-weight: 700; color: ${textColor}; margin: 20rpx 0 12rpx;`,
    h2: `font-size: 36rpx; font-weight: 600; color: ${textColor}; margin: 16rpx 0 10rpx;`,
    h3: `font-size: 32rpx; font-weight: 600; color: ${textColor}; margin: 12rpx 0 8rpx;`,
    strong: `font-weight: 600; color: ${textColor};`,
    em: 'font-style: italic;',
    code: `background: ${codeBg}; padding: 4rpx 10rpx; border-radius: 6rpx; font-size: 26rpx; font-family: monospace;`,
    pre: `background: ${codeBg}; padding: 20rpx; border-radius: 12rpx; overflow-x: auto; margin: 12rpx 0; border: 1rpx solid ${borderColor};`,
    blockquote: `border-left: 6rpx solid var(--primary, #0f5f34); padding: 8rpx 20rpx; margin: 12rpx 0; background: ${codeBg};`,
    table: `width: 100%; border-collapse: collapse; margin: 12rpx 0; font-size: 26rpx;`,
    th: `background: ${codeBg}; padding: 12rpx 16rpx; border: 1rpx solid ${borderColor}; font-weight: 600; text-align: left;`,
    td: `padding: 12rpx 16rpx; border: 1rpx solid ${borderColor};`,
    img: 'max-width: 100%; border-radius: 8rpx; margin: 8rpx 0;',
    ul: 'padding-left: 32rpx; margin: 8rpx 0;',
    ol: 'padding-left: 32rpx; margin: 8rpx 0;',
    li: 'margin: 4rpx 0; line-height: 1.7;',
    a: 'color: var(--primary, #0f5f34); text-decoration: underline;',
    hr: `border: none; border-top: 1rpx solid ${borderColor}; margin: 16rpx 0;`
  };
});

function onLinkTap(e) {
  emit('link-tap', e);
}

function onImageTap(e) {
  emit('image-tap', e);
  // Default: preview image (mp-html handles this via preview-img prop)
}

function onLoad() {
  emit('load');
}

function onError(e) {
  emit('error', e);
}
</script>

<style lang="scss" scoped>
.enhanced-rich-text {
  width: 100%;
}
</style>
