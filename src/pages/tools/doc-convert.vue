<template>
  <view :class="['page-container', { 'dark-mode': isDark }]">
    <!-- 自定义导航栏 -->
    <view class="nav-header" :style="{ paddingTop: statusBarHeight + 'px' }">
      <view class="nav-content">
        <view class="nav-back" @tap="goBack">
          <text class="back-icon">←</text>
        </view>
        <text class="nav-title">文档转换</text>
        <view class="nav-placeholder" />
      </view>
    </view>

    <!-- 主内容 -->
    <scroll-view scroll-y class="main-scroll" :style="{ paddingTop: statusBarHeight + 50 + 'px' }">
      <!-- 顶部描述卡片 -->
      <view class="hero-card">
        <view class="hero-icon-wrapper">
          <text class="hero-icon">📄</text>
        </view>
        <text class="hero-title">智能文档转换</text>
        <text class="hero-desc">支持 PDF、Word、Excel、PPT 等格式互转</text>
      </view>

      <!-- 转换类型选择 -->
      <view class="section">
        <text class="section-title">选择转换类型</text>
        <view class="type-grid">
          <view
            v-for="item in convertTypes"
            :key="item.key"
            :class="['type-card', { active: selectedType === item.key }]"
            @click="selectType(item.key)"
          >
            <view class="type-icon-box">
              <text class="type-icon">{{ item.icon }}</text>
            </view>
            <view class="type-text">
              <text class="type-name">{{ item.name }}</text>
              <text class="type-desc">{{ item.desc }}</text>
            </view>
          </view>
        </view>
      </view>

      <!-- 文件选择区域 -->
      <view class="section">
        <text class="section-title">选择文件</text>
        <view v-if="!selectedFile" class="file-placeholder" @click="chooseFile">
          <view class="upload-icon-box">
            <text class="upload-icon-text">+</text>
          </view>
          <text class="upload-text">点击选择文件</text>
          <text class="upload-hint">{{ acceptHint }}</text>
        </view>
        <view v-else class="file-info-card">
          <view class="file-icon-box">
            <text class="file-icon-text">📎</text>
          </view>
          <view class="file-detail">
            <text class="file-name">{{ selectedFile.name }}</text>
            <text class="file-size">{{ formatSize(selectedFile.size) }}</text>
          </view>
          <view class="file-remove" @click="removeFile">
            <text class="remove-icon">✕</text>
          </view>
        </view>
      </view>

      <!-- 转换进度 -->
      <view v-if="status !== 'idle'" class="section">
        <view v-if="status === 'uploading'" class="status-card status-loading">
          <view class="status-spinner" />
          <view class="status-text-group">
            <text class="status-title">正在上传文件</text>
            <text class="status-hint">请稍候...</text>
          </view>
        </view>
        <view v-else-if="status === 'converting'" class="status-card status-loading">
          <view class="status-spinner" />
          <view class="status-text-group">
            <text class="status-title">正在转换中</text>
            <text class="status-hint">AI 正在处理您的文件...</text>
          </view>
        </view>
        <view v-else-if="status === 'done'" class="status-card status-done">
          <view class="status-done-icon">
            <text class="done-check">✓</text>
          </view>
          <view class="status-text-group">
            <text class="status-title">转换完成</text>
            <text class="status-hint">文件已准备就绪</text>
          </view>
        </view>
        <view v-else-if="status === 'error'" class="status-card status-error">
          <view class="status-error-icon">
            <text class="error-mark">!</text>
          </view>
          <view class="status-text-group">
            <text class="status-title">转换失败</text>
            <text class="status-hint">{{ errorMsg }}</text>
          </view>
        </view>
      </view>

      <!-- 结果区域 -->
      <view v-if="resultUrl" class="section result-section">
        <button class="btn-primary" hover-class="btn-hover" @click="downloadResult">
          <text>下载转换结果</text>
        </button>
        <button class="btn-secondary" hover-class="btn-hover" @click="resetAll">
          <text>继续转换</text>
        </button>
      </view>

      <!-- 底部安全区 -->
      <view class="bottom-safe" />
    </scroll-view>

    <!-- 底部操作栏 -->
    <view v-if="status === 'idle' && selectedFile" class="action-bar">
      <button class="btn-primary btn-full" hover-class="btn-hover" :disabled="!canConvert" @click="startConvert">
        <text>开始转换</text>
      </button>
    </view>
  </view>
</template>

<script>
import { lafService } from '@/services/lafService.js';
import { logger } from '@/utils/logger.js';
import { initTheme, onThemeUpdate, offThemeUpdate } from '@/composables/useTheme.js';

const CONVERT_TYPES = [
  { key: 'word2pdf', icon: 'W', name: 'Word→PDF', desc: 'doc/docx 转 PDF', accept: '.doc,.docx,.odt,.rtf' },
  { key: 'pdf2word', icon: 'P', name: 'PDF→Word', desc: 'PDF 转 docx', accept: '.pdf' },
  { key: 'excel2pdf', icon: 'E', name: 'Excel→PDF', desc: 'xls/xlsx 转 PDF', accept: '.xls,.xlsx,.ods' },
  { key: 'ppt2pdf', icon: 'S', name: 'PPT→PDF', desc: 'ppt/pptx 转 PDF', accept: '.ppt,.pptx,.odp' },
  { key: 'img2pdf', icon: 'I', name: '图片→PDF', desc: '图片合并为 PDF', accept: '.jpg,.jpeg,.png,.webp' },
  { key: 'pdf2img', icon: 'G', name: 'PDF→图片', desc: 'PDF 转 JPG/PNG', accept: '.pdf' }
];

export default {
  data() {
    return {
      statusBarHeight: 44,
      isDark: false,
      convertTypes: CONVERT_TYPES,
      selectedType: 'word2pdf',
      selectedFile: null,
      fileBase64: null,
      status: 'idle', // idle | uploading | converting | done | error
      errorMsg: '',
      resultUrl: null,
      jobId: null,
      pollTimer: null
    };
  },

  computed: {
    currentType() {
      return CONVERT_TYPES.find((t) => t.key === this.selectedType);
    },
    acceptHint() {
      if (!this.currentType) return '';
      return `支持 ${this.currentType.accept} 格式`;
    },
    canConvert() {
      return this.selectedFile && this.selectedType && this.status === 'idle';
    }
  },

  onLoad() {
    const sys = uni.getSystemInfoSync();
    this.statusBarHeight = sys.statusBarHeight || sys.safeAreaInsets?.top || 44;
    this.isDark = initTheme();
    this._themeHandler = (mode) => {
      this.isDark = mode === 'dark';
    };
    onThemeUpdate(this._themeHandler);
  },

  onUnload() {
    this.clearPollTimer();
    offThemeUpdate(this._themeHandler);
  },

  methods: {
    goBack() {
      uni.navigateBack({ delta: 1 });
    },

    selectType(key) {
      if (this.status !== 'idle') return;
      this.selectedType = key;
      if (this.selectedFile) {
        this.removeFile();
      }
    },

    chooseFile() {
      // #ifdef MP-WEIXIN
      wx.chooseMessageFile({
        count: 1,
        type: 'file',
        success: (res) => {
          if (res.tempFiles && res.tempFiles.length > 0) {
            const file = res.tempFiles[0];
            this.selectedFile = { name: file.name, size: file.size, path: file.path };
            this.readFileBase64(file.path);
          }
        },
        fail: (err) => {
          if (err.errMsg && !err.errMsg.includes('cancel')) {
            uni.showToast({ title: '选择文件失败', icon: 'none' });
          }
        }
      });
      // #endif

      // #ifdef H5
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = this.currentType ? this.currentType.accept : '*';
      input.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
          this.selectedFile = { name: file.name, size: file.size };
          const reader = new FileReader();
          reader.onload = (ev) => {
            this.fileBase64 = ev.target.result.split(',')[1];
          };
          reader.readAsDataURL(file);
        }
      };
      input.click();
      // #endif
    },

    readFileBase64(filePath) {
      // #ifdef MP-WEIXIN
      uni.getFileSystemManager().readFile({
        filePath,
        encoding: 'base64',
        success: (res) => {
          this.fileBase64 = res.data;
        },
        fail: (err) => {
          logger.error('读取文件失败:', err);
          uni.showToast({ title: '读取文件失败', icon: 'none' });
          this.removeFile();
        }
      });
      // #endif
    },

    removeFile() {
      this.selectedFile = null;
      this.fileBase64 = null;
      this.resultUrl = null;
      this.status = 'idle';
      this.errorMsg = '';
    },

    async startConvert() {
      if (!this.canConvert || !this.fileBase64) {
        uni.showToast({ title: '请先选择文件', icon: 'none' });
        return;
      }

      this.status = 'uploading';
      this.errorMsg = '';
      this.resultUrl = null;

      try {
        const res = await lafService.submitDocConvert(this.fileBase64, this.selectedFile.name, this.selectedType);

        if (res.code === 0 && res.data) {
          this.jobId = res.data.jobId;
          this.status = 'converting';
          this.startPolling();
        } else {
          throw new Error(res.message || '提交转换失败');
        }
      } catch (error) {
        logger.error('转换提交失败:', error);
        this.status = 'error';
        this.errorMsg = error.message || '转换失败，请重试';
      }
    },

    startPolling() {
      let attempts = 0;
      const maxAttempts = 60;

      this.pollTimer = setInterval(async () => {
        attempts++;
        if (attempts > maxAttempts) {
          this.clearPollTimer();
          this.status = 'error';
          this.errorMsg = '转换超时，请重试';
          return;
        }

        try {
          const res = await lafService.getDocConvertStatus(this.jobId);
          if (res.code === 0 && res.data) {
            const { status } = res.data;
            if (status === 'completed' || status === 'finished') {
              this.clearPollTimer();
              await this.fetchResult();
            } else if (status === 'error' || status === 'failed') {
              this.clearPollTimer();
              this.status = 'error';
              this.errorMsg = res.data.error || '转换失败';
            }
          }
        } catch (error) {
          logger.error('轮询状态失败:', error);
        }
      }, 2000);
    },

    async fetchResult() {
      try {
        const res = await lafService.getDocConvertResult(this.jobId);
        if (res.code === 0 && res.data && res.data.url) {
          this.resultUrl = res.data.url;
          this.status = 'done';
        } else {
          this.status = 'error';
          this.errorMsg = '获取结果失败';
        }
      } catch (error) {
        logger.error('获取结果失败:', error);
        this.status = 'error';
        this.errorMsg = '获取结果失败';
      }
    },

    downloadResult() {
      if (!this.resultUrl) return;

      // #ifdef MP-WEIXIN
      uni.showLoading({ title: '下载中...', mask: true });
      uni.downloadFile({
        url: this.resultUrl,
        success: (res) => {
          uni.hideLoading();
          if (res.statusCode === 200) {
            uni.openDocument({
              filePath: res.tempFilePath,
              showMenu: true,
              fail: () => {
                uni.showToast({ title: '打开文件失败', icon: 'none' });
              }
            });
          }
        },
        fail: () => {
          uni.hideLoading();
          uni.showToast({ title: '下载失败', icon: 'none' });
        }
      });
      // #endif

      // #ifdef H5
      window.open(this.resultUrl, '_blank');
      // #endif
    },

    resetAll() {
      this.clearPollTimer();
      this.selectedFile = null;
      this.fileBase64 = null;
      this.status = 'idle';
      this.errorMsg = '';
      this.resultUrl = null;
      this.jobId = null;
    },

    clearPollTimer() {
      if (this.pollTimer) {
        clearInterval(this.pollTimer);
        this.pollTimer = null;
      }
    },

    formatSize(bytes) {
      if (!bytes) return '';
      if (bytes < 1024) return bytes + ' B';
      if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
      return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }
  }
};
</script>

<style lang="scss" scoped>
.page-container {
  min-height: 100vh;
  background: var(--bg-secondary, #f5f5f7);
}

// 导航栏
.nav-header {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-bottom: 1rpx solid rgba(0, 0, 0, 0.06);

  .nav-content {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 24rpx;
    height: 88rpx;
  }

  .nav-back {
    width: 72rpx;
    height: 72rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.04);

    .back-icon {
      font-size: 36rpx;
      color: var(--text-primary, #111);
    }
  }

  .nav-title {
    font-size: 34rpx;
    font-weight: 600;
    color: var(--text-primary, #111);
  }

  .nav-placeholder {
    width: 72rpx;
  }
}

.main-scroll {
  min-height: 100vh;
  padding: 24rpx 32rpx;
  box-sizing: border-box;
}

// 顶部描述卡片
.hero-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 48rpx 32rpx 40rpx;
  margin-bottom: 32rpx;
  background: linear-gradient(135deg, rgba(54, 209, 220, 0.08) 0%, rgba(91, 134, 229, 0.08) 100%);
  border-radius: 24rpx;
  border: 1rpx solid rgba(91, 134, 229, 0.12);

  .hero-icon-wrapper {
    width: 100rpx;
    height: 100rpx;
    border-radius: 28rpx;
    background: linear-gradient(135deg, #36d1dc, #5b86e5);
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 20rpx;
    box-shadow: 0 8rpx 24rpx rgba(91, 134, 229, 0.3);
  }

  .hero-icon {
    font-size: 48rpx;
  }

  .hero-title {
    font-size: 36rpx;
    font-weight: 700;
    color: var(--text-primary, #111);
    margin-bottom: 8rpx;
  }

  .hero-desc {
    font-size: 24rpx;
    color: var(--text-secondary, #666);
  }
}

// 区块
.section {
  margin-bottom: 32rpx;

  .section-title {
    font-size: 30rpx;
    font-weight: 600;
    color: var(--text-primary, #111);
    margin-bottom: 20rpx;
    display: block;
  }
}

// 转换类型网格
.type-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
}

.type-card {
  width: calc(50% - 8rpx);
  display: flex;
  align-items: center;
  padding: 20rpx;
  background: var(--bg-card, #fff);
  border-radius: 20rpx;
  border: 2rpx solid transparent;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.04);
  transition: all 0.25s ease;

  &.active {
    border-color: #5b86e5;
    background: rgba(91, 134, 229, 0.06);
    box-shadow: 0 4rpx 16rpx rgba(91, 134, 229, 0.15);

    .dark-mode & {
      border-color: #8eaaef;
      background: rgba(91, 134, 229, 0.12);
    }
  }

  .type-icon-box {
    width: 64rpx;
    height: 64rpx;
    border-radius: 16rpx;
    background: linear-gradient(135deg, #36d1dc, #5b86e5);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    margin-right: 16rpx;
  }

  .type-icon {
    font-size: 26rpx;
    font-weight: 700;
    color: #fff;
  }

  .type-text {
    flex: 1;
    overflow: hidden;
  }

  .type-name {
    font-size: 26rpx;
    font-weight: 600;
    color: var(--text-primary, #111);
    display: block;
  }

  .type-desc {
    font-size: 20rpx;
    color: var(--text-secondary, #666);
    margin-top: 2rpx;
    display: block;
  }
}

// 文件选择
.file-placeholder {
  background: var(--bg-card, #fff);
  border: 2rpx dashed rgba(91, 134, 229, 0.35);
  border-radius: 20rpx;
  padding: 60rpx 30rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  transition: all 0.25s ease;

  .upload-icon-box {
    width: 80rpx;
    height: 80rpx;
    border-radius: 50%;
    background: linear-gradient(135deg, rgba(54, 209, 220, 0.12), rgba(91, 134, 229, 0.12));
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 16rpx;
  }

  .upload-icon-text {
    font-size: 48rpx;
    color: #5b86e5;
    font-weight: 300;
    line-height: 1;

    .dark-mode & {
      color: #8eaaef;
    }
  }

  .upload-text {
    font-size: 28rpx;
    color: var(--text-primary, #111);
    font-weight: 500;
  }

  .upload-hint {
    font-size: 22rpx;
    color: var(--text-secondary, #666);
    margin-top: 8rpx;
  }
}

.file-info-card {
  background: var(--bg-card, #fff);
  border-radius: 20rpx;
  padding: 24rpx;
  display: flex;
  align-items: center;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.04);

  .file-icon-box {
    width: 64rpx;
    height: 64rpx;
    border-radius: 16rpx;
    background: linear-gradient(135deg, rgba(54, 209, 220, 0.12), rgba(91, 134, 229, 0.12));
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    margin-right: 16rpx;
  }

  .file-icon-text {
    font-size: 28rpx;
  }

  .file-detail {
    flex: 1;
    overflow: hidden;

    .file-name {
      font-size: 26rpx;
      font-weight: 500;
      color: var(--text-primary, #111);
      display: block;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .file-size {
      font-size: 22rpx;
      color: var(--text-secondary, #666);
      margin-top: 4rpx;
      display: block;
    }
  }

  .file-remove {
    width: 56rpx;
    height: 56rpx;
    border-radius: 50%;
    background: rgba(255, 59, 48, 0.08);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;

    .remove-icon {
      font-size: 24rpx;
      color: #ff3b30;

      .dark-mode & {
        color: #ff6b6b;
      }
    }
  }
}

// 状态卡片
.status-card {
  display: flex;
  align-items: center;
  padding: 28rpx 24rpx;
  border-radius: 20rpx;
  gap: 20rpx;

  &.status-loading {
    background: rgba(91, 134, 229, 0.06);
    border: 1rpx solid rgba(91, 134, 229, 0.12);
  }

  &.status-done {
    background: rgba(52, 199, 89, 0.06);
    border: 1rpx solid rgba(52, 199, 89, 0.12);
  }

  &.status-error {
    background: rgba(255, 59, 48, 0.06);
    border: 1rpx solid rgba(255, 59, 48, 0.12);
  }
}

.status-spinner {
  width: 48rpx;
  height: 48rpx;
  border: 4rpx solid rgba(91, 134, 229, 0.2);
  border-top-color: #5b86e5;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  flex-shrink: 0;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.status-done-icon {
  width: 48rpx;
  height: 48rpx;
  border-radius: 50%;
  background: linear-gradient(135deg, #34c759, #30d158);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;

  .done-check {
    color: #fff;
    font-size: 26rpx;
    font-weight: 700;
  }
}

.status-error-icon {
  width: 48rpx;
  height: 48rpx;
  border-radius: 50%;
  background: linear-gradient(135deg, #ff3b30, #ff6961);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;

  .error-mark {
    color: #fff;
    font-size: 28rpx;
    font-weight: 700;
  }
}

.status-text-group {
  flex: 1;

  .status-title {
    font-size: 28rpx;
    font-weight: 600;
    color: var(--text-primary, #111);
    display: block;
  }

  .status-hint {
    font-size: 22rpx;
    color: var(--text-secondary, #666);
    margin-top: 4rpx;
    display: block;
  }
}

// 结果区域
.result-section {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

// 底部安全区
.bottom-safe {
  height: 200rpx;
}

// 底部操作栏
.action-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 24rpx 32rpx;
  padding-bottom: calc(24rpx + env(safe-area-inset-bottom, 0px));
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-top: 1rpx solid rgba(0, 0, 0, 0.06);
}

// 按钮
.btn-primary {
  background: linear-gradient(135deg, #36d1dc 0%, #5b86e5 100%);
  color: #fff;
  border: none;
  padding: 24rpx;
  border-radius: 50rpx;
  font-size: 30rpx;
  font-weight: 600;
  text-align: center;
  box-shadow: 0 8rpx 24rpx rgba(91, 134, 229, 0.25);

  &::after {
    border: none;
  }
  &:disabled,
  &[disabled] {
    opacity: 0.5;
    box-shadow: none;
  }
}

.btn-full {
  width: 100%;
}

.btn-secondary {
  background: var(--bg-card, #fff);
  color: var(--text-primary, #111);
  border: 1rpx solid var(--border, #e5e5e5);
  padding: 24rpx;
  border-radius: 50rpx;
  font-size: 28rpx;
  text-align: center;

  &::after {
    border: none;
  }
}

.btn-hover {
  opacity: 0.8;
  transform: scale(0.98);
}

// Dark mode overrides
.dark-mode {
  &.page-container {
    background: var(--bg-secondary, #1c1c1e);
  }

  .nav-header {
    background: rgba(13, 17, 23, 0.85);
    border-bottom-color: rgba(255, 255, 255, 0.06);
  }

  .nav-back {
    background: rgba(255, 255, 255, 0.1);
  }

  .hero-card {
    background: linear-gradient(135deg, rgba(54, 209, 220, 0.15) 0%, rgba(91, 134, 229, 0.15) 100%);
    border-color: rgba(91, 134, 229, 0.25);
  }

  .type-card {
    background: var(--bg-card, #0d1117);
    box-shadow: none;

    &.active {
      background: rgba(91, 134, 229, 0.12);
    }
  }

  .file-placeholder {
    background: var(--bg-card, #0d1117);
    border-color: rgba(91, 134, 229, 0.25);
  }

  .file-info-card {
    background: var(--bg-card, #0d1117);
    box-shadow: none;
  }

  .file-remove {
    background: rgba(255, 59, 48, 0.15);
  }

  .status-card {
    &.status-loading {
      background: rgba(91, 134, 229, 0.12);
      border-color: rgba(91, 134, 229, 0.2);
    }

    &.status-done {
      background: rgba(52, 199, 89, 0.12);
      border-color: rgba(52, 199, 89, 0.2);
    }

    &.status-error {
      background: rgba(255, 59, 48, 0.12);
      border-color: rgba(255, 59, 48, 0.2);
    }
  }

  .action-bar {
    background: rgba(13, 17, 23, 0.9);
    border-top-color: rgba(255, 255, 255, 0.06);
  }

  .btn-secondary {
    background: var(--bg-card, #0d1117);
    border-color: rgba(255, 255, 255, 0.1);
  }
}
</style>
