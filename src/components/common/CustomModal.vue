<template>
  <WdPopup
    :model-value="visible"
    :duration="reducedMotion ? 0 : 180"
    :close-on-click-modal="maskClosable"
    :z-index="9999"
    transition="fade"
    custom-style="width:calc(100vw - 40px);max-width:440px;background:transparent;overflow:visible;border-radius:24px;"
    modal-style="background:rgba(33,26,46,.42);"
    @close="handleCancel"
    @after-enter="bindDialog"
    @after-leave="emit('closed')"
  >
    <view
      ref="dialog"
      class="custom-modal-container"
      :class="[`modal-type-${type}`, { dark: isDark, 'is-closing': !visible, 'reduced-motion': reducedMotion }]"
      :style="{ '--modal-motion-duration': reducedMotion ? '0ms' : '180ms' }"
      role="dialog"
      :aria-modal="visible ? 'true' : undefined"
      :aria-hidden="!visible || undefined"
      :aria-labelledby="titleId"
      :aria-describedby="content && !editable ? contentId : undefined"
      :inert="!visible || undefined"
      tabindex="-1"
      @tap.stop
    >
      <view class="modal-icon-wrapper" :class="`modal-icon-${type}`" aria-hidden="true">
        <BaseIcon :name="icon || iconMap[type] || 'info'" :size="48" :color="iconColor" />
      </view>
      <text :id="titleId" class="modal-title">{{ title }}</text>
      <text v-if="content && !editable" :id="contentId" class="modal-content">{{ content }}</text>
      <textarea
        v-if="editable && !nativeInput"
        ref="editableInput"
        v-model="inputText"
        class="modal-input"
        :aria-label="title"
        :placeholder="placeholderText"
        placeholder-class="modal-input-placeholder"
        :maxlength="-1"
      ></textarea>
      <textarea
        v-if="editable && nativeInput"
        ref="editableInput"
        v-model="inputText"
        class="modal-input"
        :aria-label="title"
        :placeholder="placeholderText"
        placeholder-class="modal-input-placeholder"
        :maxlength="-1"
        :focus="visible"
      ></textarea>
      <text v-if="editable && !inputText.trim()" class="modal-input-help">填写内容后才能确认</text>
      <view class="modal-buttons" :class="{ single: !showCancel }">
        <button
          v-if="showCancel"
          ref="cancelButton"
          class="modal-btn cancel-btn"
          role="button"
          tabindex="0"
          @tap="handleCancel"
        >
          {{ cancelText }}
        </button>
        <button
          ref="confirmButton"
          class="modal-btn confirm-btn"
          role="button"
          tabindex="0"
          :disabled="isConfirmDisabled"
          :aria-disabled="isConfirmDisabled"
          :aria-busy="confirmLoading"
          @tap="handleConfirm"
        >
          <WdLoading v-if="confirmLoading && !reducedMotion" :size="18" :color="isDark ? '#20172f' : '#ffffff'" />
          <text>{{ confirmLoading ? loadingText : confirmText }}</text>
        </button>
      </view>
    </view>
  </WdPopup>
</template>

<script setup>
import { computed, getCurrentInstance, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import WdPopup from 'wot-design-uni/components/wd-popup/wd-popup.vue';
import WdLoading from 'wot-design-uni/components/wd-loading/wd-loading.vue';
import BaseIcon from '@/components/base/base-icon/base-icon.vue';
import { bindLearningDialog, bindLearningKeyboard } from '@/services/learning/keyboard-controls.js';
import { bindBusinessMotion } from '@/design/business-motion.js';

const props = defineProps({
  visible: { type: Boolean, default: false },
  type: { type: String, default: 'info' },
  icon: { type: String, default: '' },
  title: { type: String, default: '提示' },
  content: { type: String, default: '' },
  confirmText: { type: String, default: '确定' },
  cancelText: { type: String, default: '取消' },
  showCancel: { type: Boolean, default: true },
  maskClosable: { type: Boolean, default: false },
  isDark: { type: Boolean, default: false },
  confirmDisabled: { type: Boolean, default: false },
  confirmLoading: { type: Boolean, default: false },
  loadingText: { type: String, default: '处理中' },
  editable: { type: Boolean, default: false },
  placeholderText: { type: String, default: '' }
});
const emit = defineEmits(['cancel', 'update:visible', 'confirm', 'closed']);
const dialog = ref(null);
const cancelButton = ref(null);
const confirmButton = ref(null);
const editableInput = ref(null);
const inputText = ref('');
const isConfirmDisabled = computed(
  () => props.confirmDisabled || props.confirmLoading || (props.editable && !inputText.value.trim())
);
// H5 enters focus through the dialog controller; native textarea uses its documented focus property.
let nativeInput = true;
// #ifdef H5
nativeInput = false;
// #endif
const reducedMotion = ref(true);
const instanceId = getCurrentInstance().uid;
const titleId = `wenli-modal-title-${instanceId}`;
const contentId = `wenli-modal-content-${instanceId}`;
const iconColor = computed(() => (props.isDark ? '#c9b1ee' : '#785bbc'));
const iconMap = {
  info: 'bulb',
  success: 'success',
  warning: 'warning',
  error: 'error',
  question: 'question',
  empty: 'empty',
  upload: 'upload',
  study: 'books'
};
let releaseDialog = null;
let releaseKeyboard = () => undefined;
let releaseMotion = () => undefined;
let closing = false;

function handleConfirm() {
  if (isConfirmDisabled.value || !props.visible || closing) return;
  closing = true;
  if (props.editable) emit('confirm', inputText.value);
  else emit('confirm');
  emit('update:visible', false);
}
function handleCancel() {
  if (!props.visible || closing) return;
  closing = true;
  emit('cancel');
  emit('update:visible', false);
}
function bindDialog() {
  if (!props.visible || releaseDialog || !dialog.value) return;
  releaseKeyboard = bindLearningKeyboard(dialog.value);
  const input = editableInput.value?.$el || editableInput.value;
  releaseDialog = bindLearningDialog(dialog.value, {
    initialFocus: props.editable
      ? input?.querySelector?.('textarea') || input
      : props.showCancel
        ? cancelButton.value
        : confirmButton.value,
    onEscape: () => {
      if (props.showCancel || props.maskClosable) handleCancel();
    }
  });
}
function releaseFocus() {
  releaseKeyboard();
  releaseDialog?.();
  releaseDialog = null;
}
// Lazy popup content can mount after the visibility watcher, including with zero-duration motion.
watch(dialog, bindDialog, { flush: 'post' });
watch(
  () => props.visible,
  async (open) => {
    if (!open) {
      inputText.value = '';
      releaseFocus();
      return;
    }
    closing = false;
    inputText.value = props.editable ? props.content : '';
    await nextTick();
    bindDialog();
  },
  { immediate: true, flush: 'post' }
);
onMounted(() => {
  releaseMotion = bindBusinessMotion((reduced) => {
    reducedMotion.value = reduced;
  });
});
onUnmounted(() => {
  releaseFocus();
  releaseMotion();
});
</script>

<style lang="scss" scoped>
.custom-modal-container {
  --modal-surface: rgba(246, 243, 255, 0.84);
  --modal-ink: #080909;
  --modal-muted: #62576d;
  --modal-line: #dbd5e6;
  --modal-primary: #785bbc;
  --modal-on-primary: #ffffff;
  --modal-soft: #eee7f7;
  box-sizing: border-box;
  width: 100%;
  max-height: calc(100vh - 40px);
  max-height: calc(100dvh - 40px);
  padding: 24px;
  overflow-y: auto;
  background: var(--modal-surface);
  color: var(--modal-ink);
  border: 0;
  border-radius: 24px;
  box-shadow: var(--yozi-shadow);
  backdrop-filter: blur(24px) saturate(1.15);
  -webkit-backdrop-filter: blur(24px) saturate(1.15);
  font-family: 'DM Sans', 'PingFang SC', 'Microsoft YaHei', sans-serif;
  animation: wenli-dialog-enter var(--modal-motion-duration) cubic-bezier(0.2, 0, 0, 1);
  &.dark {
    --modal-surface: rgba(46, 38, 65, 0.9);
    --modal-ink: #f8f4ff;
    --modal-muted: #d2c8e5;
    --modal-line: #504164;
    --modal-primary: #c9b1ee;
    --modal-on-primary: #20172f;
    --modal-soft: #473457;
  }
  &.is-closing {
    animation: none;
    transform: translateY(6px);
    transition: transform var(--modal-motion-duration) ease-in;
  }
  &.reduced-motion {
    animation: none;
    transition: none;
    transform: none;
    .modal-btn {
      animation: none !important;
      transition: none !important;
      transform: none !important;
    }
  }
}
@keyframes wenli-dialog-enter {
  from {
    transform: translateY(6px);
  }
  to {
    transform: translateY(0);
  }
}
.modal-icon-wrapper {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 48px;
  height: 48px;
  margin: 0 auto 16px;
  border-radius: 50%;
  background: var(--modal-soft);
}
.modal-title {
  display: block;
  margin-bottom: 12px;
  text-align: center;
  font-size: 18px;
  font-weight: 700;
  color: var(--modal-ink);
}
.modal-content {
  display: block;
  margin-bottom: 24px;
  text-align: center;
  white-space: pre-wrap;
  font-size: 14px;
  line-height: 1.65;
  color: var(--modal-muted);
}
.modal-buttons {
  display: flex;
  gap: 12px;
}
.modal-input {
  box-sizing: border-box;
  width: 100%;
  height: 88px;
  padding: 12px;
  margin-bottom: 16px;
  border: 1px solid var(--modal-line);
  border-radius: 12px;
  background: var(--modal-surface);
  color: var(--modal-ink);
  font: inherit;
  font-size: 14px;
  line-height: 1.65;
  caret-color: var(--modal-primary);
  &:focus-within {
    outline: 2px solid var(--modal-primary);
    outline-offset: 2px;
  }
}
.modal-input-placeholder,
.modal-input-help {
  color: var(--modal-muted);
  font-size: 14px;
}
.modal-input-help {
  display: block;
  margin: -4px 0 16px;
}
.modal-btn {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 8px;
  flex: 1;
  margin: 0;
  min-width: 0;
  min-height: 44px;
  padding: 10px 16px;
  box-sizing: border-box;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.5;
  font-family: inherit;
  transition:
    background-color 180ms ease,
    box-shadow 180ms ease,
    transform 180ms ease;
  &::after {
    border: 0;
  }
  &:focus-visible {
    outline: 2px solid var(--modal-primary);
    outline-offset: 2px;
  }
  &:active {
    transition-duration: 100ms;
  }
}
.cancel-btn {
  color: var(--modal-primary);
  background: var(--modal-soft);
  border: 0;
  box-shadow: var(--yozi-control-shadow);
  &:active {
    background: var(--modal-soft);
  }
}
.confirm-btn {
  background: var(--yozi-button);
  color: var(--yozi-button-ink);
  border: 0;
  box-shadow: var(--yozi-button-shadow);
  &[disabled] {
    opacity: 0.55;
  }
  &:active:not([disabled]) {
    transform: translateY(2px);
    box-shadow:
      inset 0 2px 4px rgba(30, 15, 65, 0.16),
      0 2px 0 var(--yozi-button-edge);
  }
}
@media (hover: hover) and (pointer: fine) {
  .cancel-btn:hover {
    background: var(--modal-soft);
  }
  .confirm-btn:hover:not([disabled]):not(:active) {
    filter: brightness(1.05);
  }
}
@media (max-width: 520px) {
  .custom-modal-container {
    padding: 20px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .custom-modal-container,
  .modal-btn {
    animation: none !important;
    transition: none !important;
    transform: none !important;
  }
}
@media (prefers-reduced-transparency: reduce), (prefers-contrast: more) {
  .custom-modal-container {
    background: #f0edfc;
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
  }
  .custom-modal-container.dark {
    background: #30283f;
  }
}
@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .custom-modal-container {
    background: #f0edfc;
  }
  .custom-modal-container.dark {
    background: #30283f;
  }
}
</style>
