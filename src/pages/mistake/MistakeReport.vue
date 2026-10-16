<template>
  <view ref="keyboardRoot">
    <view v-if="hasMistakes" class="bottom-bar">
      <BaseButton class="export-btn" :disabled="isGenerating" variant="secondary" @tap="prepareReport"
        ><BaseIcon name="chart-bar" class="export-icon" /><view class="export-text-wrapper ds-flex-center"
          ><text class="export-text ds-text-sm ds-font-bold">{{
            isGenerating ? t('mistake.copy63') : t('mistake.copy64')
          }}</text></view
        ></BaseButton
      >
    </view>
    <canvas canvas-id="reportCanvas" class="report-canvas"></canvas>
    <CustomModal
      :visible="showReportModal"
      :title="t('mistake.copy65')"
      :show-actions="false"
      :is-dark="isDark"
      close-button
      mask-closable
      @cancel="closeReport"
      ><view class="yozi-page-content">
        <view class="modal-content">
          <scroll-view scroll-y class="modal-scroll">
            <image
              v-if="previewImage && reportImagePath"
              :src="reportImagePath"
              :aria-label="t('mistake.copy66')"
              mode="widthFix"
              class="report-image"
              @error="handleImageError"
            />
            <view v-else class="report-text-fallback">
              <view class="report-text-header"
                ><text class="report-text-title">{{ uiText(BRAND.name) }}</text></view
              >
              <view class="report-text-userinfo"
                ><text class="report-text-name">{{ reportUserName }}</text></view
              >
              <view class="report-text-body"
                ><text class="report-text-content" selectable>{{ uiText(reportTextContent) }}</text></view
              >
            </view>
          </scroll-view>
          <view class="modal-footer ds-flex ds-gap-xs">
            <BaseButton class="modal-bg" variant="secondary" @tap="closeReport">{{ t('mistake.copy67') }}</BaseButton>
            <BaseButton
              v-if="reportImagePath"
              class="modal-btn secondary"
              variant="secondary"
              @tap="previewImage = !previewImage"
              >{{ previewImage ? t('mistake.copy68') : t('mistake.copy69') }}</BaseButton
            >
            <BaseButton v-if="reportImagePath" class="modal-btn primary" variant="secondary" @tap="saveReport">{{
              t('mistake.copy70')
            }}</BaseButton>
            <BaseButton class="modal-btn primary" variant="primary" @tap="copyReportText">{{
              t('mistake.copy71')
            }}</BaseButton>
          </view>
        </view>
      </view></CustomModal
    >
  </view>
  <CustomModal
    v-if="pageDialog"
    :visible="true"
    :title="pageDialog.title"
    :content="pageDialog.content"
    :editable="pageDialog.editable"
    :placeholder-text="pageDialog.placeholderText"
    :confirm-text="pageDialog.confirmText"
    :cancel-text="pageDialog.cancelText"
    :show-cancel="pageDialog.showCancel !== false"
    :type="pageDialog.confirmColor ? 'error' : 'info'"
    escape-closable
    @confirm="settleDialog(true, $event)"
    @cancel="settleDialog(false)"
  />
</template>

<script setup>
const uiText = (value) => translateRegisteredText('mistake', value);
import '@/pages/mistake/messages.js';
import { t, currentLanguage, translateRegisteredText } from '@/i18n/index.js';
import BaseButton from '@/components/base/base-button/base-button.vue';
import CustomModal from '@/components/common/CustomModal.vue';
import '@/styles/yozi-pages.scss';

import { BRAND } from '@/config/brand.js';
import { ref, computed, watch, nextTick, getCurrentInstance, onMounted, onBeforeUnmount } from 'vue';
import { bindLearningKeyboard, bindLearningDialog } from '@/services/learning/keyboard-controls.js';
import { toast } from '@/utils/toast.js';
import { logger } from '@/utils/logger.js';
import { usePageDialog } from '@/composables/usePageDialog.js';
import { getUserId } from '@/services/auth-storage.js';
import { summarizeLegacyMistakeRecords } from '@/services/quiz-session-contract.js';
import {
  getCanvasTheme,
  drawStyledCard as drawCard,
  drawWrappedText as drawText,
  drawDivider,
  canvasToImage,
  drawLabel,
  drawReportBackground
} from './canvas-report.js';
import BaseIcon from '@/components/base/base-icon/base-icon.vue';
const { pageDialog, settleDialog, modal } = usePageDialog();
const props = defineProps({
  mistakes: { type: Array, default: () => [] },
  userInfo: { type: Object, default: () => ({}) },
  isDark: { type: Boolean, default: false },
  expectedOwnerId: { type: String, default: null }
});
const instance = getCurrentInstance();
const isGenerating = ref(false),
  showReportModal = ref(false),
  reportImagePath = ref(''),
  reportTextContent = ref(''),
  previewImage = ref(false),
  reportUserName = ref(t('mistake.learner'));
const hasMistakes = computed(() => props.mistakes.length > 0);
const keyboardRoot = ref(null),
  dialogRoot = ref(null);
let releaseKeyboard, releaseDialog;
onMounted(() => {
  releaseKeyboard = bindLearningKeyboard(keyboardRoot.value);
});
watch(showReportModal, async (visible) => {
  releaseDialog?.();
  releaseDialog = null;
  if (!visible) return;
  await nextTick();
  if (showReportModal.value && isReportCurrent())
    releaseDialog = bindLearningDialog(dialogRoot.value, { onEscape: closeReport });
});
let active = true,
  sequence = 0,
  reportStamp = '',
  cancelRendering;
const currentStamp = () =>
  JSON.stringify([props.expectedOwnerId, getUserId() || '', props.mistakes, props.userInfo, props.isDark]);
function isReportCurrent() {
  return active && (getUserId() || '') === props.expectedOwnerId && reportStamp === currentStamp();
}
function discardImage(path) {
  if (typeof path === 'string' && path.startsWith('blob:')) URL.revokeObjectURL?.(path);
}
function closeReport() {
  discardImage(reportImagePath.value);
  sequence++;
  cancelRendering?.();
  reportStamp = '';
  showReportModal.value = false;
  isGenerating.value = false;
  reportImagePath.value = '';
  reportTextContent.value = '';
  previewImage.value = false;
}
watch(() => JSON.stringify([props.mistakes, props.expectedOwnerId, props.userInfo, props.isDark]), closeReport);
onBeforeUnmount(() => {
  active = false;
  closeReport();
  releaseKeyboard?.();
  releaseDialog?.();
});
async function prepareReport() {
  if (isGenerating.value) return;
  if ((getUserId() || '') !== props.expectedOwnerId) return toast.info(t('mistake.copy23'));
  const summary = summarizeLegacyMistakeRecords(props.mistakes);
  if (!summary?.recordCount) return toast.info(t('mistake.copy72'));
  closeReport();
  const generation = sequence;
  reportStamp = currentStamp();
  reportUserName.value = props.userInfo.nickName || t('mistake.learner');
  const categories = summary.categories.map((item) =>
    t('mistake.categoryCount', { category: uiText(item.category), count: item.count })
  );
  reportTextContent.value = [
    t('mistake.loaded', { count: summary.recordCount }),
    t('mistake.scope'),
    t('mistake.generated', { date: new Date().toLocaleString(currentLanguage.value) }),
    ...(summary.omittedInvalidRows ? [t('mistake.invalid', { count: summary.omittedInvalidRows })] : []),
    '',
    t('mistake.categories'),
    ...categories
  ].join('\n');
  showReportModal.value = true;
  isGenerating.value = true;
  const remaining = summary.categories.slice(8).reduce((sum, item) => sum + item.count, 0);
  const imageText = [
    reportTextContent.value.split('\n').slice(0, 3).join('\n'),
    '',
    ...categories.slice(0, 8),
    ...(remaining ? [t('mistake.remaining', { count: remaining })] : []),
    '',
    t('mistake.copyReport')
  ].join('\n');
  try {
    await drawReport(imageText, generation);
  } finally {
    if (generation === sequence && isReportCurrent()) isGenerating.value = false;
  }
}
function drawReport(content, generation) {
  if (typeof uni.createCanvasContext !== 'function') return Promise.resolve();
  return new Promise((resolve) => {
    let finished = false;
    const finish = (path) => {
      if (finished) {
        if (path !== reportImagePath.value) discardImage(path);
        return;
      }
      finished = true;
      clearTimeout(timeout);
      if (cancelRendering === cancel) cancelRendering = null;
      if (path && generation === sequence && isReportCurrent()) reportImagePath.value = path;
      else discardImage(path);
      resolve();
    };
    const cancel = () => finish();
    const timeout = setTimeout(cancel, 8000);
    cancelRendering = cancel;
    try {
      const ctx = uni.createCanvasContext('reportCanvas', instance.proxy),
        theme = getCanvasTheme(props.isDark);
      if (!ctx) return finish();
      drawReportBackground(ctx, 750, 1334, theme, props.isDark);
      drawLabel(ctx, BRAND.name, 50, 100, { fontSize: 48, color: theme.titleColor });
      drawLabel(ctx, t('mistake.copy65'), 50, 150, { fontSize: 28, color: theme.subText });
      drawCard(ctx, 50, 190, 650, 120, 30, theme.cardBg, props.isDark);
      drawLabel(ctx, reportUserName.value, 90, 260, { fontSize: 32, color: theme.mainText });
      drawDivider(ctx, 50, 700, 340, theme.dividerColor);
      ctx.setFillStyle(theme.mainText);
      ctx.setFontSize(28);
      drawText(ctx, content, 80, 390, 590, 45, 1200);
      ctx.draw(false, () => {
        if (finished || generation !== sequence || !isReportCurrent()) return finish();
        canvasToImage('reportCanvas', instance.proxy)
          .then(finish)
          .catch(() => finish());
      });
    } catch (error) {
      logger.warn('[MistakeReport] 图片未生成，完整正文保留', error);
      finish();
    }
  });
}
function handleImageError() {
  if (!isReportCurrent()) return closeReport();
  reportImagePath.value = '';
  previewImage.value = false;
  toast.info(t('mistake.copy73'));
}
function copyReportText() {
  if (!isReportCurrent()) return closeReport();
  uni.setClipboardData({
    data: reportTextContent.value,
    success: () => {
      if (isReportCurrent()) toast.success(t('mistake.copy74'));
    }
  });
}
function saveReport() {
  if (!isReportCurrent() || !reportImagePath.value) return;

  // #ifdef MP-WEIXIN
  uni.saveImageToPhotosAlbum({
    filePath: reportImagePath.value,
    success: () => {
      if (!isReportCurrent()) return;
      toast.success(t('mistake.copy75'));
      showReportModal.value = false;
    },
    fail: (err) => {
      if (!isReportCurrent()) return;
      logger.error('[App] 诊断事件');
      if (err.errMsg && err.errMsg.includes('auth')) {
        modal.show({
          title: t('mistake.copy76'),
          content: t('mistake.copy77'),
          success: (res) => {
            if (res.confirm && isReportCurrent()) uni.openSetting();
          }
        });
      } else {
        toast.info(t('mistake.copy78'));
      }
    }
  });
  // #endif

  // #ifdef H5
  const link = document.createElement('a');
  let downloadUrl;
  try {
    const path = reportImagePath.value;
    if (path.startsWith('data:image/png;base64,')) {
      const binary = atob(path.slice('data:image/png;base64,'.length));
      const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
      downloadUrl = URL.createObjectURL(new Blob([bytes], { type: 'image/png' }));
    }
    link.href = downloadUrl || path;
    link.download = 'yozi-history-records.png';
    document.body.appendChild(link);
    link.click();
  } catch (_error) {
    toast.info(t('mistake.copy79'));
  } finally {
    link.remove();
    if (downloadUrl) URL.revokeObjectURL(downloadUrl);
  }
  // #endif
  // #ifdef APP-PLUS
  uni.saveImageToPhotosAlbum({
    filePath: reportImagePath.value,
    success: () => {
      if (!isReportCurrent()) return;
      toast.success(t('mistake.copy75'));
      showReportModal.value = false;
    },
    fail: (_err) => {
      toast.info(t('mistake.copy78'));
    }
  });
  // #endif
}
</script>
