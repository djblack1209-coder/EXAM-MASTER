<template>
  <CustomModal
    :visible="visible"
    title="学习图片"
    :show-actions="false"
    close-button
    mask-closable
    :is-dark="theme.isDark"
    @cancel="close"
  >
    <view class="study-share">
      <image v-if="image" class="study-share-preview" :src="image" mode="widthFix" alt="学习数据分享图片预览" />
      <view v-else class="study-share-loading" role="status">{{ error || '正在生成…' }}</view>
      <BaseButton v-if="error" variant="quiet" @tap="render">重试</BaseButton>
      <BaseCheckbox :model-value="observations" :disabled="busy" @update:model-value="observations = $event"
        >包含 AI 评估</BaseCheckbox
      >
      <view class="study-share-actions">
        <BaseButton v-if="canShare" variant="quiet" :disabled="busy || !image" @tap="share">分享</BaseButton>
        <BaseButton variant="primary" icon="download" :disabled="busy || !image" :loading="busy" @tap="save"
          >保存图片</BaseButton
        >
      </view>
      <text v-if="message" class="study-share-status" role="status">{{ message }}</text>
    </view>
  </CustomModal>
  <!-- #ifndef H5 -->
  <canvas :canvas-id="canvasId" :id="canvasId" class="study-share-canvas" />
  <!-- #endif -->
</template>
<script setup>
import { computed, getCurrentInstance, nextTick, onUnmounted, ref, watch } from 'vue';
import CustomModal from '@/components/common/CustomModal.vue';
import BaseButton from '@/components/base/base-button/base-button.vue';
import BaseCheckbox from '@/components/base/base-checkbox/base-checkbox.vue';
import { BRAND } from '@/config/brand.js';
import { useThemeStore } from '@/stores/modules/theme.js';
import { useConversationLearningStore } from '@/stores/modules/conversation-learning.js';
import { scopeWorkspaceState } from '@/services/learning/workspace-context.js';
import { captureSession, checkSession } from '@/services/auth-storage.js';
import { isDesktopRuntime } from '@/services/desktop/runtime.js';
import { saveDesktopLearningFile } from '@/services/desktop/learning-files.js';
import { POSTER_SIZE, paintStudyPoster, studyPosterData } from '@/services/learning/study-poster.js';
const props = defineProps({
  visible: Boolean,
  day: { type: String, default: null },
  category: { type: String, default: 'all' }
});
const emit = defineEmits(['close']);
const learning = useConversationLearningStore(),
  theme = useThemeStore();
const image = ref(''),
  observations = ref(false),
  error = ref(''),
  message = ref(''),
  busy = ref(false);
const owner = getCurrentInstance()?.proxy,
  canvasId = `study-share-${getCurrentInstance()?.uid || 0}`;
let serial = 0,
  alive = true,
  rendered = null;
const downloads = new Map();
function releaseDownloads() {
  for (const [url, timer] of downloads) {
    clearTimeout(timer);
    URL.revokeObjectURL(url);
  }
  downloads.clear();
}
const context = () => JSON.stringify([learning.recordContext(), learning.state.revision, props.day, props.category]);
const current = (saved) =>
  alive && props.visible && checkSession(saved.session) === 'current' && saved.context === context();
const canShare = computed(() => {
  // #ifdef H5
  if (!(
    !isDesktopRuntime() &&
    typeof navigator !== 'undefined' &&
    typeof navigator.share === 'function' &&
    typeof navigator.canShare === 'function' &&
    typeof File === 'function' &&
    image.value.startsWith('data:image/png;base64,')
  ))
    return false;
  try {
    return navigator.canShare({ files: [imageFile(image.value)] });
  } catch {
    return false;
  }
  // #endif
  // #ifndef H5
  return false;
  // #endif
});
function imageFile(source) {
  // #ifdef H5
  const binary = atob(source.split(',')[1]);
  return new File([Uint8Array.from(binary, (value) => value.charCodeAt(0))], 'Yozi-AI.png', { type: 'image/png' });
  // #endif
}
function close() {
  ++serial;
  image.value = '';
  rendered = null;
  emit('close');
}
async function render() {
  const attempt = ++serial;
  image.value = '';
  error.value = '';
  message.value = '';
  rendered = null;
  if (!props.visible) return;
  const saved = { session: captureSession(), context: context() };
  const valid = () => attempt === serial && current(saved);
  try {
    const model = studyPosterData(scopeWorkspaceState(learning.state, props.category), learning.calendarTime, {
      day: props.day,
      observations: observations.value
    });
    let result;
    // #ifdef H5
    {
      const canvas = document.createElement('canvas');
      canvas.width = POSTER_SIZE.width * POSTER_SIZE.scale;
      canvas.height = POSTER_SIZE.height * POSTER_SIZE.scale;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('图片生成失败，请重试');
      const mascot = await new Promise((resolve, reject) => {
        const picture = new window.Image();
        picture.onload = () => resolve(picture);
        picture.onerror = () => reject(new Error('品牌图片未加载，请重试'));
        picture.src = BRAND.mark;
      });
      if (!valid()) return;
      ctx.scale(POSTER_SIZE.scale, POSTER_SIZE.scale);
      paintStudyPoster(ctx, model, mascot);
      result = canvas.toDataURL('image/png');
    }
    // #endif
    // #ifndef H5
    if (!result) {
      await nextTick();
      const mascot = await new Promise((resolve, reject) =>
        uni.getImageInfo({ src: BRAND.mark, success: resolve, fail: reject })
      );
      if (!valid()) return;
      const ctx = uni.createCanvasContext(canvasId, owner);
      paintStudyPoster(ctx, model, mascot.path);
      await new Promise((resolve) => ctx.draw(false, resolve));
      const file = await new Promise((resolve, reject) =>
        uni.canvasToTempFilePath(
          {
            canvasId,
            width: 360,
            height: 480,
            destWidth: 1080,
            destHeight: 1440,
            fileType: 'png',
            success: resolve,
            fail: reject
          },
          owner
        )
      );
      result = file.tempFilePath;
    }
    // #endif
    if (valid()) {
      image.value = result;
      rendered = saved;
    }
  } catch (failure) {
    if (valid()) error.value = failure.message || '图片生成失败，请重试';
  }
}
function assertCurrent(saved) {
  if (!saved || !current(saved)) throw new Error('学习记录已变化，请重新生成图片');
}
async function save() {
  if (busy.value || !image.value || !rendered) return;
  const saved = rendered,
    source = image.value;
  busy.value = true;
  message.value = '';
  try {
    assertCurrent(saved);
    // #ifdef H5
    if (isDesktopRuntime()) {
      const bytes = Array.from(atob(source.split(',')[1]), (value) => value.charCodeAt(0));
      const result = await saveDesktopLearningFile(
        'poster',
        JSON.stringify({ format: 'yozi-learning-poster-v1', png: bytes }),
        { session: saved.session, isCurrent: () => current(saved) }
      );
      if (result.saved && current(saved)) message.value = '图片已保存';
    } else {
      const bytes = Uint8Array.from(atob(source.split(',')[1]), (value) => value.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes], { type: 'image/png' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `Yozi-AI-${props.day || '学习记录'}.png`;
      document.body.appendChild(link);
      assertCurrent(saved);
      link.click();
      link.remove();
      downloads.set(
        url,
        setTimeout(() => {
          URL.revokeObjectURL(url);
          downloads.delete(url);
        }, 15000)
      );
      if (current(saved)) message.value = '图片已生成';
    }
    // #endif
    // #ifndef H5
    await new Promise((resolve, reject) =>
      uni.saveImageToPhotosAlbum({ filePath: source, success: resolve, fail: reject })
    );
    if (current(saved)) message.value = '已保存到相册';
    // #endif
  } catch (failure) {
    if (current(saved)) message.value = failure.message || '图片未保存，请检查相册权限后重试';
  } finally {
    busy.value = false;
  }
}
async function share() {
  if (busy.value || !image.value || !rendered) return;
  const saved = rendered;
  try {
    assertCurrent(saved);
    // #ifdef H5
    const file = imageFile(image.value);
    if (!navigator.canShare({ files: [file] })) {
      message.value = '请先保存图片';
      return;
    }
    await navigator.share({ files: [file] });
    // #endif
  } catch (failure) {
    if (failure.name !== 'AbortError' && current(saved)) message.value = '请先保存图片';
  }
}
watch(
  () => [props.visible, props.day, observations.value, context()],
  async () => {
    if (!props.visible) {
      ++serial;
      image.value = '';
      rendered = null;
      observations.value = false;
      return;
    }
    await render();
  }
);
onUnmounted(() => {
  releaseDownloads();
  alive = false;
  ++serial;
  image.value = '';
  rendered = null;
});
</script>
<style scoped>
.study-share {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}
.study-share .study-share-preview {
  width: min(100%, 300px);
  border-radius: 12px;
  opacity: 1;
  filter: none;
}
.study-share-loading {
  min-height: 220px;
  display: flex;
  align-items: center;
  color: var(--ink-2);
}
.study-share-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  width: 100%;
}
.study-share-status {
  font-size: 13px;
  color: var(--ink-2);
}
.study-share-canvas {
  position: fixed;
  left: -10000px;
  width: 360px;
  height: 480px;
}
</style>
