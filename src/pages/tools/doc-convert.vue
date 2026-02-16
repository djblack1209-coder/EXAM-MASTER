<template>
  <view class="doc-convert-container">
    <!-- 顶部标题栏 -->
    <view class="header">
      <text class="title">
        文档转换
      </text>
      <text class="subtitle">
        支持 PDF、Word、Excel、PPT 等格式互转
      </text>
    </view>

    <!-- 转换类型选择 -->
    <view class="type-grid">
      <view
        v-for="item in convertTypes"
        :key="item.key"
        :class="['type-card', { active: selectedType === item.key }]"
        @click="selectType(item.key)"
      >
        <text class="type-icon">
          {{ item.icon }}
        </text>
        <text class="type-name">
          {{ item.name }}
        </text>
        <text class="type-desc">
          {{ item.desc }}
        </text>
      </view>
    </view>

    <!-- 文件选择区域 -->
    <view class="file-area">
      <view v-if="!selectedFile" class="file-placeholder" @click="chooseFile">
        <text class="upload-icon">
          +
        </text>
        <text class="upload-text">
          点击选择文件
        </text>
        <text class="upload-hint">
          {{ acceptHint }}
        </text>
      </view>
      <view v-else class="file-info">
        <view class="file-detail">
          <text class="file-name">
            {{ selectedFile.name }}
          </text>
          <text class="file-size">
            {{ formatSize(selectedFile.size) }}
          </text>
        </view>
        <text class="file-remove" @click="removeFile">
          ✕
        </text>
      </view>
    </view>

    <!-- 转换进度 -->
    <view v-if="status !== 'idle'" class="progress-area">
      <view v-if="status === 'uploading'" class="progress-item">
        <view class="progress-spinner" />
        <text class="progress-text">
          正在上传文件...
        </text>
      </view>
      <view v-else-if="status === 'converting'" class="progress-item">
        <view class="progress-spinner" />
        <text class="progress-text">
          正在转换中，请稍候...
        </text>
      </view>
      <view v-else-if="status === 'done'" class="progress-item done">
        <text class="done-icon">
          ✓
        </text>
        <text class="progress-text">
          转换完成
        </text>
      </view>
      <view v-else-if="status === 'error'" class="progress-item error">
        <text class="error-icon">
          !
        </text>
        <text class="progress-text">
          {{ errorMsg }}
        </text>
      </view>
    </view>

    <!-- 结果区域 -->
    <view v-if="resultUrl" class="result-area">
      <button class="btn-primary" hover-class="btn-hover" @click="downloadResult">
        <text>下载转换结果</text>
      </button>
      <button class="btn-secondary" hover-class="btn-hover" @click="resetAll">
        <text>继续转换</text>
      </button>
    </view>

    <!-- 底部操作栏 -->
    <view v-if="status === 'idle' && selectedFile" class="action-bar">
      <button
        class="btn-primary"
        hover-class="btn-hover"
        :disabled="!canConvert"
        @click="startConvert"
      >
        <text>开始转换</text>
      </button>
    </view>
  </view>
</template>

<script>
import { lafService } from '@/services/lafService.js';
import { logger } from '@/utils/logger.js';

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
      convertTypes: CONVERT_TYPES,
      selectedType: 'word2pdf',
      selectedFile: null,
      fileBase64: null,
      status: 'idle', // idle | uploading | converting | done | error
      errorMsg: '',
      resultUrl: null,
      taskId: null,
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

  onUnload() {
    this.clearPollTimer();
  },

  methods: {
    selectType(key) {
      if (this.status !== 'idle') return;
      this.selectedType = key;
      // 切换类型时清除已选文件（格式可能不兼容）
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
        success: (res) => { this.fileBase64 = res.data; },
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
        const res = await lafService.submitDocConvert(
          this.fileBase64,
          this.selectedFile.name,
          this.selectedType
        );

        if (res.code === 0 && res.data) {
          this.taskId = res.data.taskId;
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
      const maxAttempts = 60; // 最多轮询60次（约2分钟）

      this.pollTimer = setInterval(async () => {
        attempts++;
        if (attempts > maxAttempts) {
          this.clearPollTimer();
          this.status = 'error';
          this.errorMsg = '转换超时，请重试';
          return;
        }

        try {
          const res = await lafService.getDocConvertStatus(this.taskId);
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
        const res = await lafService.getDocConvertResult(this.taskId);
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
      this.taskId = null;
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
.doc-convert-container {
  min-height: 100vh;
  background: var(--bg-secondary);
  display: flex;
  flex-direction: column;
  padding-bottom: 180rpx;
}

.header {
  padding: 30rpx;
  background: linear-gradient(135deg, #36d1dc 0%, #5b86e5 100%);
  color: #fff;

  .title {
    font-size: 36rpx;
    font-weight: bold;
    display: block;
  }

  .subtitle {
    font-size: 24rpx;
    opacity: 0.8;
    margin-top: 10rpx;
    display: block;
  }
}

.type-grid {
  display: flex;
  flex-wrap: wrap;
  padding: 20rpx;
  gap: 16rpx;
}

.type-card {
  width: calc(33.33% - 12rpx);
  background: var(--bg-card);
  border-radius: 16rpx;
  padding: 24rpx 16rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  border: 2rpx solid transparent;
  transition: all 0.2s;

  &.active {
    border-color: #5b86e5;
    background: rgba(91, 134, 229, 0.08);
  }

  .type-icon {
    width: 64rpx;
    height: 64rpx;
    border-radius: 16rpx;
    background: linear-gradient(135deg, #36d1dc 0%, #5b86e5 100%);
    color: #fff;
    font-size: 28rpx;
    font-weight: bold;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .type-name {
    font-size: 24rpx;
    font-weight: 600;
    color: var(--text-main);
    margin-top: 12rpx;
  }

  .type-desc {
    font-size: 20rpx;
    color: var(--text-sub);
    margin-top: 4rpx;
  }
}

.file-area {
  margin: 20rpx;
}

.file-placeholder {
  background: var(--bg-card);
  border: 2rpx dashed var(--text-sub);
  border-radius: 16rpx;
  padding: 60rpx 30rpx;
  display: flex;
  flex-direction: column;
  align-items: center;

  .upload-icon {
    font-size: 64rpx;
    color: #5b86e5;
    line-height: 1;
  }

  .upload-text {
    font-size: 28rpx;
    color: var(--text-main);
    margin-top: 16rpx;
  }

  .upload-hint {
    font-size: 22rpx;
    color: var(--text-sub);
    margin-top: 8rpx;
  }
}

.file-info {
  background: var(--bg-card);
  border-radius: 16rpx;
  padding: 24rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;

  .file-detail {
    flex: 1;
    overflow: hidden;

    .file-name {
      font-size: 28rpx;
      color: var(--text-main);
      display: block;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .file-size {
      font-size: 22rpx;
      color: var(--text-sub);
      margin-top: 6rpx;
      display: block;
    }
  }

  .file-remove {
    font-size: 32rpx;
    color: var(--text-sub);
    padding: 10rpx 20rpx;
  }
}

.progress-area {
  margin: 20rpx;
}

.progress-item {
  background: var(--bg-card);
  border-radius: 16rpx;
  padding: 30rpx;
  display: flex;
  align-items: center;
  gap: 20rpx;

  &.done {
    .done-icon {
      width: 48rpx;
      height: 48rpx;
      background: #4CAF50;
      color: #fff;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 28rpx;
    }
  }

  &.error {
    .error-icon {
      width: 48rpx;
      height: 48rpx;
      background: #f44336;
      color: #fff;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 28rpx;
      font-weight: bold;
    }
  }

  .progress-text {
    font-size: 28rpx;
    color: var(--text-main);
  }
}

.progress-spinner {
  width: 48rpx;
  height: 48rpx;
  border: 4rpx solid rgba(91, 134, 229, 0.3);
  border-top-color: #5b86e5;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.result-area {
  margin: 20rpx;
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.action-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 30rpx;
  background: var(--bg-card);
  box-shadow: 0 -4rpx 20rpx rgba(0, 0, 0, 0.05);
}

.btn-primary {
  background: linear-gradient(135deg, #36d1dc 0%, #5b86e5 100%);
  color: #fff;
  border: none;
  padding: 24rpx;
  border-radius: 50rpx;
  font-size: 30rpx;
  text-align: center;

  &::after { border: none; }
  &:disabled, &[disabled] { opacity: 0.5; }
}

.btn-secondary {
  background: var(--bg-secondary);
  color: var(--text-main);
  border: none;
  padding: 24rpx;
  border-radius: 50rpx;
  font-size: 28rpx;
  text-align: center;

  &::after { border: none; }
}
</style>
