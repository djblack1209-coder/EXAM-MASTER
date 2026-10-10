<template>
  <view ref="keyboardRoot">
    <view v-if="hasMistakes" class="bottom-bar">
      <button
        class="export-btn ds-flex ds-flex-center ds-gap-xs"
        role="button"
        tabindex="0"
        :disabled="isGenerating"
        @tap="prepareReport"
      >
        <BaseIcon name="chart-bar" :size="36" class="export-icon" />
        <view class="export-text-wrapper ds-flex-center"
          ><text class="export-text ds-text-sm ds-font-bold">{{
            isGenerating ? '正在生成图片…' : '生成历史记录汇总'
          }}</text></view
        >
      </button>
    </view>
    <canvas canvas-id="reportCanvas" class="report-canvas"></canvas>
    <view
      v-if="showReportModal"
      ref="dialogRoot"
      class="report-modal"
      role="dialog"
      aria-modal="true"
      aria-label="历史错题记录汇总"
    >
      <view class="modal-bg" @tap="closeReport" />
      <view class="modal-content">
        <view class="modal-header ds-flex ds-flex-between">
          <text class="modal-title ds-text-xl ds-font-bold">历史错题记录汇总</text>
          <button
            class="modal-close ds-flex-center ds-rounded-full ds-touchable"
            role="button"
            aria-label="关闭历史记录汇总"
            tabindex="0"
            @tap="closeReport"
          >
            <BaseIcon name="close" :size="24" />
          </button>
        </view>
        <scroll-view scroll-y class="modal-scroll">
          <image
            v-if="previewImage && reportImagePath"
            :src="reportImagePath"
            aria-label="历史记录汇总图片"
            mode="widthFix"
            class="report-image"
            @error="handleImageError"
          />
          <view v-else class="report-text-fallback">
            <view class="report-text-header"
              ><text class="report-text-title">{{ BRAND.name }}</text></view
            >
            <view class="report-text-userinfo"
              ><text class="report-text-name">{{ reportUserName }}</text></view
            >
            <view class="report-text-body"
              ><text class="report-text-content" selectable>{{ reportTextContent }}</text></view
            >
          </view>
        </scroll-view>
        <view class="modal-footer ds-flex ds-gap-xs">
          <button class="modal-btn secondary ds-font-bold" role="button" tabindex="0" @tap="closeReport">关闭</button>
          <button
            v-if="reportImagePath"
            class="modal-btn secondary ds-font-bold"
            role="button"
            tabindex="0"
            @tap="previewImage = !previewImage"
          >
            {{ previewImage ? '查看正文' : '查看图片' }}
          </button>
          <button
            v-if="reportImagePath"
            class="modal-btn primary ds-font-bold"
            role="button"
            tabindex="0"
            @tap="saveReport"
          >
            保存图片
          </button>
          <button class="modal-btn primary ds-font-bold" role="button" tabindex="0" @tap="copyReportText">
            复制完整汇总
          </button>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { BRAND } from '@/config/brand.js';
import { ref, computed, watch, nextTick, getCurrentInstance, onMounted, onBeforeUnmount } from 'vue';
import { bindLearningKeyboard, bindLearningDialog } from '@/services/learning/keyboard-controls.js';
import { toast } from '@/utils/toast.js';
import { logger } from '@/utils/logger.js';
import { modal } from '@/utils/modal.js';
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
  reportUserName = ref('学习者');
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
  if ((getUserId() || '') !== props.expectedOwnerId) return toast.info('账户已变化，请重新打开历史记录');
  const summary = summarizeLegacyMistakeRecords(props.mistakes);
  if (!summary?.recordCount) return toast.info('暂无可汇总的历史条目');
  closeReport();
  const generation = sequence;
  reportStamp = currentStamp();
  reportUserName.value = props.userInfo.nickName || '学习者';
  const categories = summary.categories.map((item) => `${item.category}：${item.count} 条`);
  reportTextContent.value = [
    `当前已载入 ${summary.recordCount} 条`,
    '统计仅限当前列表，判分依据待核对。',
    `生成时间：${new Date().toLocaleString()}`,
    ...(summary.omittedInvalidRows ? [`另有 ${summary.omittedInvalidRows} 条格式异常，原记录保留。`] : []),
    '',
    '原分类条目数',
    ...categories
  ].join('\n');
  showReportModal.value = true;
  isGenerating.value = true;
  const remaining = summary.categories.slice(8).reduce((sum, item) => sum + item.count, 0);
  const imageText = [
    reportTextContent.value.split('\n').slice(0, 3).join('\n'),
    '',
    ...categories.slice(0, 8),
    ...(remaining ? [`其余分类：${remaining} 条`] : []),
    '',
    '完整汇总可复制'
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
      drawLabel(ctx, '历史错题记录汇总', 50, 150, { fontSize: 28, color: theme.subText });
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
  toast.info('图片暂不可用，完整正文已保留');
}
function copyReportText() {
  if (!isReportCurrent()) return closeReport();
  uni.setClipboardData({
    data: reportTextContent.value,
    success: () => {
      if (isReportCurrent()) toast.success('汇总已复制');
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
      toast.success('已保存到相册');
      showReportModal.value = false;
    },
    fail: (err) => {
      if (!isReportCurrent()) return;
      logger.error(err);
      if (err.errMsg && err.errMsg.includes('auth')) {
        modal.show({
          title: '提示',
          content: '需要保存到相册权限',
          success: (res) => {
            if (res.confirm && isReportCurrent()) uni.openSetting();
          }
        });
      } else {
        toast.info('保存失败');
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
    toast.info('保存失败，请重试');
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
      toast.success('已保存到相册');
      showReportModal.value = false;
    },
    fail: (_err) => {
      toast.info('保存失败');
    }
  });
  // #endif
}
</script>

<style lang="scss" scoped>
/* 历史记录汇总按钮 */
.bottom-bar {
  position: fixed;
  bottom: 50rpx;
  left: 0;
  width: 100%;
  display: flex;
  justify-content: center;
  padding: 0 40rpx;
  box-sizing: border-box;
  z-index: 99;
}

.export-btn {
  width: 100%;
  max-width: 650rpx;
  min-width: 500rpx;
  height: 100rpx;
  background: var(--cta-primary-bg);
  color: var(--cta-primary-text);
  border-radius: 50rpx;
  font-weight: bold;
  display: flex;
  align-items: center;
  justify-content: center;
  /* gap: 12rpx; -- replaced for Android WebView compat */
  box-shadow: var(--cta-primary-shadow);
  border: 1rpx solid var(--cta-primary-border);
  padding: 0 30rpx;
  box-sizing: border-box;
}

.export-btn[disabled] {
  opacity: 0.7;
}

.export-btn::after {
  border: none;
}

.export-icon {
  font-size: 36rpx;
  flex-shrink: 0;
  line-height: var(--line-height-normal);
  display: block;
}

.export-text-wrapper {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
  overflow: visible;
}

.export-text {
  font-size: 30rpx;
  line-height: 1.4;
  white-space: nowrap;
  overflow: visible;
  text-overflow: clip;
  display: block;
  width: 100%;
  text-align: center;
}

/* Canvas 画布（隐藏） */
.report-canvas {
  width: 750px;
  height: 1334px;
  position: fixed;
  left: -9999px;
  top: -9999px;
  z-index: -1;
  opacity: 0;
  pointer-events: none;
}

/* 报告弹窗 */
.report-modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 10000;
  display: flex !important;
  align-items: center;
  justify-content: center;
  animation: fadeIn 0.3s ease-in-out;
  pointer-events: auto;
  visibility: visible !important;
  opacity: 1 !important;

  .modal-bg {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: var(--mask-dark);
    z-index: 1;
  }

  .modal-content {
    position: relative;
    width: 90%;
    max-width: 700rpx;
    max-height: 85vh;
    background: var(--bg-card);
    border-radius: 30rpx;
    display: flex;
    flex-direction: column;
    z-index: 2;
    box-shadow: 0 20rpx 60rpx rgba(0, 0, 0, 0.3);
    overflow: hidden;
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 30rpx 40rpx;
    border-bottom: 1rpx solid var(--border, var(--muted));

    .modal-title {
      font-size: 36rpx;
      font-weight: bold;
      color: var(--text-primary, #333);
    }

    .modal-close {
      width: 60rpx;
      height: 60rpx;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      background: var(--bg-secondary);
      transition: all 0.2s;

      &:active {
        background: var(--bg-secondary);
        transform: scale(0.95);
      }
    }

    .modal-close-icon {
      font-size: 40rpx;
      color: var(--ds-color-text-secondary);
      line-height: var(--line-height-normal);
      font-weight: 300;
    }
  }

  .modal-scroll {
    flex: 1;
    overflow-y: auto;
    padding: 20rpx;
    background: var(--bg-secondary);
  }

  .report-image {
    width: 100%;
    display: block;
    border-radius: 20rpx;
  }

  .modal-footer {
    display: flex;
    flex-wrap: wrap;
    gap: 12rpx;
    padding: 30rpx 40rpx;
    border-top: 1rpx solid var(--border, var(--muted));
    background: var(--bg-card);

    .modal-btn {
      flex: 1 1 200rpx;
      min-width: 0;
      height: 88rpx;
      line-height: 88rpx;
      border-radius: 44rpx;
      font-size: 32rpx;
      font-weight: bold;
      border: none;

      &.secondary {
        background: var(--bg-secondary);
        color: var(--text-primary, #333);
      }

      &.primary {
        background: var(--brand-color);
        color: var(--text-inverse);
      }

      &::after {
        border: none;
      }
    }
  }
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

/* E010: Canvas 不可用时的文本降级样式 */
.report-text-fallback {
  padding: 40rpx 30rpx;
  background: var(--bg-card);
  border-radius: 20rpx;

  .report-text-header {
    text-align: center;
    margin-bottom: 40rpx;
    padding-bottom: 30rpx;
    border-bottom: 2rpx solid var(--border, var(--border));
  }

  .report-text-title {
    display: block;
    font-size: 40rpx;
    font-weight: 700;
    color: var(--brand-color);
    margin-bottom: 12rpx;
  }

  .report-text-subtitle {
    display: block;
    font-size: 26rpx;
    color: var(--text-sub, #666);
  }

  .report-text-userinfo {
    margin-bottom: 30rpx;
    padding: 24rpx;
    background: var(--bg-secondary, var(--bg-secondary));
    border-radius: 16rpx;
  }

  .report-text-name {
    display: block;
    font-size: 36rpx;
    font-weight: 600;
    color: var(--text-primary, #333);
    margin-bottom: 8rpx;
  }

  .report-text-meta {
    display: block;
    font-size: 24rpx;
    color: var(--text-sub, #666);
  }

  .report-text-body {
    margin-bottom: 30rpx;
  }

  .report-text-content {
    font-size: 28rpx;
    color: var(--text-primary, #333);
    line-height: 1.8;
    white-space: pre-wrap;
    word-break: break-all;
  }

  .report-text-footer {
    text-align: center;
    padding-top: 30rpx;
    border-top: 2rpx solid var(--border, var(--border));

    text {
      font-size: 24rpx;
      color: var(--text-sub, #999);
    }
  }
}
</style>
