<template>
  <view :class="['page-container', { 'dark-mode': isDark }]">
    <!-- 自定义导航栏 -->
    <view class="nav-header" :style="{ paddingTop: statusBarHeight + 'px' }">
      <view class="nav-content">
        <view class="nav-back" @tap="goBack">
          <text class="back-icon"> ← </text>
        </view>
        <text class="nav-title"> 文档转换 </text>
        <view class="nav-placeholder" />
      </view>
    </view>

    <!-- 主内容 -->
    <scroll-view scroll-y class="main-scroll" :style="{ paddingTop: statusBarHeight + 50 + 'px' }">
      <!-- 顶部描述卡片 -->
      <view class="hero-card">
        <view class="hero-icon-wrapper">
          <BaseIcon name="file" :size="56" class="hero-icon" />
        </view>
        <text class="hero-title"> 智能文档转换 </text>
        <text class="hero-desc"> 支持 PDF、Word、Excel、PPT 等格式互转 </text>
      </view>

      <!-- 转换类型选择 -->
      <view class="section">
        <text class="section-title"> 选择转换类型 </text>
        <view class="type-grid">
          <view
            v-for="item in convertTypes"
            :key="item.key"
            :class="['type-card', { active: selectedType === item.key }]"
            @tap="selectType(item.key)"
          >
            <view class="type-icon-box">
              <BaseIcon :name="getTypeIcon(item.key)" :size="32" class="type-icon" />
            </view>
            <view class="type-text">
              <text class="type-name">
                {{ item.name }}
              </text>
              <text class="type-desc">
                {{ item.desc }}
              </text>
            </view>
          </view>
        </view>
      </view>

      <!-- 文件选择区域 -->
      <view class="section">
        <text class="section-title"> 选择文件 </text>
        <view v-if="!selectedFile" id="e2e-doc-file-placeholder" class="file-placeholder" @tap="chooseFile">
          <view class="upload-icon-box">
            <BaseIcon name="upload" :size="44" class="upload-icon-text" />
          </view>
          <text class="upload-text"> 点击选择文件 </text>
          <text class="upload-hint">
            {{ acceptHint }}
          </text>
        </view>
        <view v-else class="file-info-card">
          <view class="file-icon-box">
            <BaseIcon name="file" :size="36" class="file-icon-text" />
          </view>
          <view class="file-detail">
            <text class="file-name">
              {{ selectedFile.name }}
            </text>
            <text class="file-size">
              {{ formatSize(selectedFile.size) }}
            </text>
            <text v-if="isReadingFile" class="file-reading"> 文件读取中... </text>
          </view>
          <view class="file-remove" @tap="removeFile">
            <BaseIcon name="close" :size="24" class="remove-icon" />
          </view>
        </view>
      </view>

      <!-- 转换进度 -->
      <view v-if="status !== 'idle'" class="section">
        <view v-if="status === 'uploading'" class="status-card status-loading">
          <view class="status-spinner" />
          <view class="status-text-group">
            <text class="status-title"> 正在上传文件 </text>
            <text class="status-hint"> 请稍候... </text>
          </view>
        </view>
        <view v-else-if="status === 'converting'" class="status-card status-loading">
          <view class="status-spinner" />
          <view class="status-text-group">
            <text class="status-title"> 正在转换中 </text>
            <text class="status-hint"> 智能正在处理您的文件... </text>
          </view>
        </view>
        <view v-else-if="status === 'done'" class="status-card status-done">
          <view class="status-done-icon">
            <BaseIcon name="success" :size="48" />
          </view>
          <view class="status-text-group">
            <text class="status-title"> 转换完成 </text>
            <text class="status-hint"> 文件已准备就绪 </text>
          </view>
        </view>
        <view v-else-if="status === 'error'" class="status-card status-error">
          <view class="status-error-icon">
            <BaseIcon name="warning" :size="40" class="error-mark" />
          </view>
          <view class="status-text-group">
            <text class="status-title"> 转换失败 </text>
            <text class="status-hint">
              {{ errorMsg }}
            </text>
          </view>
        </view>
      </view>

      <!-- 结果区域 -->
      <view v-if="resultUrl" class="section result-section">
        <button id="e2e-doc-download" class="btn-primary" hover-class="btn-hover" @tap="downloadResult">
          <text>下载转换结果</text>
        </button>
        <button id="e2e-doc-reset" class="btn-secondary" hover-class="btn-hover" @tap="resetAll">
          <text>继续转换</text>
        </button>
      </view>

      <!-- 底部安全区 -->
      <view class="bottom-safe" />
    </scroll-view>

    <!-- 底部操作栏 -->
    <view v-if="status === 'idle' && selectedFile" class="action-bar">
      <button
        id="e2e-doc-start-convert"
        class="btn-primary btn-full"
        hover-class="btn-hover"
        :disabled="!canConvert"
        @tap="startConvert"
      >
        <text>{{ isReadingFile ? '文件读取中...' : '开始转换' }}</text>
      </button>
    </view>
  </view>
</template>

<script>
import { lafService } from '@/services/lafService.js';
import { logger } from '@/utils/logger.js';
import { initTheme, onThemeUpdate, offThemeUpdate } from '@/composables/useTheme.js';
import { getStatusBarHeight } from '@/utils/core/system.js';
import { safeNavigateTo } from '@/utils/safe-navigate';
import { isUserLoggedIn } from '@/utils/auth/loginGuard.js';
import BaseIcon from '@/components/base/base-icon/base-icon.vue';

const CONVERT_TYPES = [
  { key: 'word2pdf', icon: 'W', name: 'Word→PDF', desc: 'doc/docx 转 PDF', accept: '.doc,.docx,.odt,.rtf' },
  { key: 'pdf2word', icon: 'P', name: 'PDF→Word', desc: 'PDF 转 docx', accept: '.pdf' },
  { key: 'excel2pdf', icon: 'E', name: 'Excel→PDF', desc: 'xls/xlsx 转 PDF', accept: '.xls,.xlsx,.ods' },
  { key: 'ppt2pdf', icon: 'S', name: 'PPT→PDF', desc: 'ppt/pptx 转 PDF', accept: '.ppt,.pptx,.odp' },
  { key: 'img2pdf', icon: 'I', name: '图片→PDF', desc: '图片合并为 PDF', accept: '.jpg,.jpeg,.png,.webp' },
  { key: 'pdf2img', icon: 'G', name: 'PDF→图片', desc: 'PDF 转 JPG/PNG', accept: '.pdf' }
];

const MAX_FILE_SIZE = 100 * 1024 * 1024;

export default {
  components: { BaseIcon },
  data() {
    return {
      statusBarHeight: 44,
      isDark: false,
      convertTypes: CONVERT_TYPES,
      selectedType: 'word2pdf',
      selectedFile: null,
      fileBase64: null,
      isReadingFile: false,
      status: 'idle', // idle | uploading | converting | done | error
      errorMsg: '',
      resultUrl: null,
      resultFiles: [],
      jobId: null,
      pollTimer: null,
      isPollingRequest: false
    };
  },

  computed: {
    currentType() {
      return CONVERT_TYPES.find((t) => t.key === this.selectedType);
    },
    acceptHint() {
      if (!this.currentType) return '';
      return `支持 ${this.currentType.accept} 格式，单文件不超过 ${Math.floor(MAX_FILE_SIZE / 1024 / 1024)}MB`;
    },
    canConvert() {
      return !!(
        this.selectedFile &&
        this.selectedType &&
        this.status === 'idle' &&
        this.fileBase64 &&
        !this.isReadingFile
      );
    }
  },

  onShareAppMessage() {
    return {
      title: '免费文档格式转换 - PDF/Word/Excel 互转',
      path: '/pages/tools/doc-convert',
      imageUrl: '/static/images/logo.png'
    };
  },
  onShareTimeline() {
    return {
      title: '免费文档格式转换 - 无需注册，即用即走',
      query: ''
    };
  },

  onLoad() {
    this.statusBarHeight = getStatusBarHeight();
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

  // ✅ P0-FIX: 页面隐藏时也清理轮询，防止后台持续请求
  onHide() {
    this.clearPollTimer();
  },

  methods: {
    isPrivacyScopeUndeclaredError(err) {
      const msg = String(err?.errMsg || '').toLowerCase();
      return Number(err?.errno) === 112 || msg.includes('privacy agreement') || msg.includes('scope is not declared');
    },

    showPrivacyScopeGuide() {
      uni.showModal({
        title: '文件权限未开启',
        content:
          '当前小程序未完成文件选择相关隐私声明，暂时无法读取本地文件。\n\n请先同意隐私指引并重启小程序；若仍失败，请在小程序后台隐私设置中勾选“选择文件（chooseMessageFile）”后重新发布。',
        showCancel: false,
        confirmText: '我知道了'
      });
    },

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

    getTypeIcon(type) {
      const iconMap = {
        word2pdf: 'file-doc',
        pdf2word: 'file-pdf',
        excel2pdf: 'file-xls',
        ppt2pdf: 'file-ppt',
        img2pdf: 'image',
        pdf2img: 'file-pdf'
      };
      return iconMap[type] || 'file';
    },

    chooseFile() {
      if (this.status !== 'idle') return;

      // #ifdef MP-WEIXIN
      const wxApi = globalThis.wx;
      if (!wxApi || typeof wxApi.chooseMessageFile !== 'function') {
        uni.showToast({ title: '当前环境不支持文件选择', icon: 'none' });
        return;
      }

      const chooseFromWechat = () => {
        wxApi.chooseMessageFile({
          count: 1,
          type: 'file',
          success: (res) => {
            if (res.tempFiles && res.tempFiles.length > 0) {
              const file = res.tempFiles[0];
              this.handleSelectedFile({
                name: file.name,
                size: file.size,
                path: file.path
              });
            }
          },
          fail: (err) => {
            if (err?.errMsg && err.errMsg.includes('cancel')) return;
            if (this.isPrivacyScopeUndeclaredError(err)) {
              logger.warn('[文档转换] 隐私协议未声明文件选择权限:', err);
              this.showPrivacyScopeGuide();
              return;
            }
            uni.showToast({ title: '选择文件失败', icon: 'none' });
          }
        });
      };

      if (typeof wxApi.requirePrivacyAuthorize === 'function') {
        wxApi.requirePrivacyAuthorize({
          success: () => {
            chooseFromWechat();
          },
          fail: (err) => {
            if (err?.errMsg && err.errMsg.includes('cancel')) return;
            if (this.isPrivacyScopeUndeclaredError(err)) {
              logger.warn('[文档转换] 隐私授权检查失败（未声明）:', err);
              this.showPrivacyScopeGuide();
              return;
            }
            logger.warn('[文档转换] 隐私授权检查失败，继续尝试文件选择:', err);
            chooseFromWechat();
          }
        });
      } else {
        chooseFromWechat();
      }
      // #endif

      // #ifdef APP-PLUS
      uni.chooseFile({
        count: 1,
        type: 'file',
        success: (res) => {
          if (res.tempFiles && res.tempFiles.length > 0) {
            const file = res.tempFiles[0];
            this.handleSelectedFile({
              name: file.name,
              size: file.size,
              path: file.path
            });
          }
        },
        fail: (err) => {
          if (err?.errMsg && err.errMsg.includes('cancel')) return;
          uni.showToast({ title: '选择文件失败', icon: 'none' });
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
          this.handleSelectedFile({
            name: file.name,
            size: file.size,
            raw: file
          });
        }
      };
      input.click();
      // #endif
    },

    getAcceptExtensions() {
      if (!this.currentType || !this.currentType.accept) return [];
      return this.currentType.accept
        .split(',')
        .map((item) => item.trim().toLowerCase().replace(/^\./, ''))
        .filter(Boolean);
    },

    getFileExtension(fileName) {
      const name = String(fileName || '').trim();
      const dotIndex = name.lastIndexOf('.');
      if (dotIndex < 0) return '';
      return name.slice(dotIndex + 1).toLowerCase();
    },

    validateFile(fileName, fileSize) {
      const ext = this.getFileExtension(fileName);
      const allowed = this.getAcceptExtensions();
      if (!ext || (allowed.length > 0 && !allowed.includes(ext))) {
        return {
          valid: false,
          message: `当前类型仅支持 ${this.currentType?.accept || '指定格式'} 文件`
        };
      }

      const size = Number(fileSize || 0);
      if (size <= 0) {
        return {
          valid: false,
          message: '文件为空，请重新选择'
        };
      }

      if (size > MAX_FILE_SIZE) {
        return {
          valid: false,
          message: `文件过大，最大支持 ${Math.floor(MAX_FILE_SIZE / 1024 / 1024)}MB`
        };
      }

      return { valid: true };
    },

    handleSelectedFile(file) {
      const checkResult = this.validateFile(file?.name, file?.size);
      if (!checkResult.valid) {
        uni.showToast({ title: checkResult.message || '文件格式不支持', icon: 'none' });
        return;
      }

      this.selectedFile = {
        name: file.name,
        size: file.size,
        path: file.path || ''
      };
      this.fileBase64 = null;
      this.errorMsg = '';
      this.resultUrl = null;
      this.resultFiles = [];
      this.jobId = null;
      this.isReadingFile = true;

      if (file.path) {
        this.readFileBase64(file.path);
        return;
      }

      if (file.raw) {
        this.readH5FileBase64(file.raw);
      }
    },

    readFileBase64(filePath) {
      // #ifdef MP-WEIXIN
      uni.getFileSystemManager().readFile({
        filePath,
        encoding: 'base64',
        success: (res) => {
          this.fileBase64 = res.data;
          this.isReadingFile = false;
        },
        fail: (err) => {
          this.isReadingFile = false;
          logger.error('读取文件失败:', err);
          uni.showToast({ title: '读取文件失败', icon: 'none' });
          this.removeFile();
        }
      });
      // #endif

      // #ifdef APP-PLUS
      plus.io.resolveLocalFileSystemURL(
        filePath,
        (entry) => {
          entry.file((file) => {
            const reader = new plus.io.FileReader();
            reader.onloadend = (e) => {
              const base64Data = e.target.result.split(',')[1] || '';
              this.fileBase64 = base64Data;
              this.isReadingFile = false;
            };
            reader.onerror = (err) => {
              this.isReadingFile = false;
              logger.error('读取文件失败:', err);
              uni.showToast({ title: '读取文件失败', icon: 'none' });
              this.removeFile();
            };
            reader.readAsDataURL(file);
          });
        },
        (err) => {
          this.isReadingFile = false;
          logger.error('解析文件路径失败:', err);
          uni.showToast({ title: '读取文件失败', icon: 'none' });
          this.removeFile();
        }
      );
      // #endif
    },

    readH5FileBase64(file) {
      // #ifdef H5
      const reader = new FileReader();
      reader.onload = (ev) => {
        this.fileBase64 = String(ev.target?.result || '').split(',')[1] || '';
        this.isReadingFile = false;
      };
      reader.onerror = (err) => {
        this.isReadingFile = false;
        logger.error('读取文件失败:', err);
        uni.showToast({ title: '读取文件失败', icon: 'none' });
        this.removeFile();
      };
      reader.readAsDataURL(file);
      // #endif
    },

    removeFile() {
      this.clearPollTimer();
      this.selectedFile = null;
      this.fileBase64 = null;
      this.isReadingFile = false;
      this.resultUrl = null;
      this.resultFiles = [];
      this.jobId = null;
      this.status = 'idle';
      this.errorMsg = '';
    },

    extractResultUrl(data) {
      if (!data || typeof data !== 'object') return '';
      if (typeof data.url === 'string' && data.url) return data.url;
      if (typeof data.downloadUrl === 'string' && data.downloadUrl) return data.downloadUrl;
      if (Array.isArray(data.files) && data.files.length > 0 && typeof data.files[0]?.url === 'string') {
        return data.files[0].url;
      }
      return '';
    },

    normalizeErrorMessage(error, fallback = '操作失败，请重试') {
      if (!error) return fallback;
      if (typeof error === 'string') return error;
      if (typeof error === 'object') {
        return error.message || error.msg || fallback;
      }
      return fallback;
    },

    async startConvert() {
      if (!isUserLoggedIn()) {
        uni.showModal({
          title: '请先登录',
          content: '登录后可使用文档转换功能',
          confirmText: '去登录',
          success: (res) => {
            if (res.confirm) {
              safeNavigateTo('/pages/login/index');
            }
          }
        });
        return;
      }

      if (this.isReadingFile) {
        uni.showToast({ title: '文件读取中，请稍候', icon: 'none' });
        return;
      }

      if (!this.selectedFile || !this.fileBase64) {
        uni.showToast({ title: '请先选择文件', icon: 'none' });
        return;
      }

      this.status = 'uploading';
      this.errorMsg = '';
      this.resultUrl = null;
      this.resultFiles = [];

      try {
        const res = await lafService.submitDocConvert(this.fileBase64, this.selectedFile.name, this.selectedType);

        if (res.code === 0 && res.data) {
          this.jobId = res.data.jobId || null;
          this.resultFiles = Array.isArray(res.data.files) ? res.data.files : [];
          const resultUrl = this.extractResultUrl(res.data);

          if (resultUrl) {
            this.resultUrl = resultUrl;
            this.status = 'done';
            return;
          }

          if (!this.jobId) {
            throw new Error('未获取到任务ID，请重试');
          }

          this.status = 'converting';
          this.startPolling();
        } else {
          throw new Error(res.message || '提交转换失败');
        }
      } catch (error) {
        logger.error('转换提交失败:', error);
        this.status = 'error';
        this.errorMsg = this.normalizeErrorMessage(error, '转换失败，请重试');
      }
    },

    startPolling() {
      if (!this.jobId) {
        this.status = 'error';
        this.errorMsg = '任务ID缺失，请重新提交';
        return;
      }

      let attempts = 0;
      const maxAttempts = 60;

      this.clearPollTimer();

      this.pollTimer = setInterval(async () => {
        if (this.isPollingRequest) {
          return;
        }

        this.isPollingRequest = true;
        attempts++;
        if (attempts > maxAttempts) {
          this.clearPollTimer();
          this.status = 'error';
          this.errorMsg = '转换超时，请重试';
          this.isPollingRequest = false;
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
          } else if (res.code !== 0) {
            this.clearPollTimer();
            this.status = 'error';
            this.errorMsg = res.message || '查询转换状态失败';
          }
        } catch (error) {
          logger.error('轮询状态失败:', error);
        } finally {
          this.isPollingRequest = false;
        }
      }, 2000);
    },

    async fetchResult() {
      try {
        const res = await lafService.getDocConvertResult(this.jobId);
        if (res.code === 0 && res.data) {
          this.resultFiles = Array.isArray(res.data.files) ? res.data.files : [];
          this.resultUrl = this.extractResultUrl(res.data);
          if (!this.resultUrl) {
            throw new Error('转换结果为空，请重试');
          }
          this.status = 'done';
        } else if (res.code === 202) {
          this.status = 'converting';
        } else {
          this.status = 'error';
          this.errorMsg = res.message || '获取结果失败';
        }
      } catch (error) {
        logger.error('获取结果失败:', error);
        this.status = 'error';
        this.errorMsg = this.normalizeErrorMessage(error, '获取结果失败');
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

      // #ifdef APP-PLUS
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
      uni.navigateTo({ url: '/pages/webview/webview?url=' + encodeURIComponent(this.resultUrl) });
      // #endif
    },

    resetAll() {
      this.clearPollTimer();
      this.selectedFile = null;
      this.fileBase64 = null;
      this.isReadingFile = false;
      this.status = 'idle';
      this.errorMsg = '';
      this.resultUrl = null;
      this.resultFiles = [];
      this.jobId = null;
    },

    clearPollTimer() {
      if (this.pollTimer) {
        clearInterval(this.pollTimer);
        this.pollTimer = null;
      }
      this.isPollingRequest = false;
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
  min-height: 100%;
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
  background:
    linear-gradient(180deg, var(--apple-specular-soft) 0%, transparent 42%),
    linear-gradient(160deg, var(--apple-glass-nav-bg) 0%, var(--apple-glass-card-bg) 100%);
  backdrop-filter: blur(24px) saturate(160%);
  -webkit-backdrop-filter: blur(24px) saturate(160%);
  border-bottom: 1rpx solid var(--apple-glass-border-strong);
  box-shadow: var(--apple-shadow-surface);

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
    background: rgba(255, 255, 255, 0.68);
    border: 1rpx solid rgba(255, 255, 255, 0.5);

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
  min-height: 100%;
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
  background:
    linear-gradient(180deg, var(--apple-specular-soft) 0%, transparent 36%),
    linear-gradient(160deg, var(--apple-glass-card-bg) 0%, var(--apple-group-bg) 100%);
  border-radius: 28rpx;
  border: 1rpx solid var(--apple-glass-border-strong);
  box-shadow: var(--apple-shadow-card);
  position: relative;
  overflow: hidden;

  .hero-icon-wrapper {
    width: 100rpx;
    height: 100rpx;
    border-radius: 999rpx;
    background: var(--apple-glass-pill-bg);
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 20rpx;
    box-shadow: var(--apple-shadow-surface);
    border: 1rpx solid rgba(255, 255, 255, 0.5);
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
  /* gap: 16rpx; -- replaced for Android WebView compat */
  & > view + view,
  & > text + text,
  & > view + text,
  & > text + view {
    margin-left: 16rpx;
  }
}

.type-card {
  width: calc(50% - 8rpx);
  display: flex;
  align-items: center;
  padding: 20rpx;
  background: linear-gradient(160deg, var(--apple-glass-card-bg) 0%, var(--apple-group-bg) 100%);
  border-radius: 24rpx;
  border: 2rpx solid rgba(255, 255, 255, 0.46);
  box-shadow: var(--apple-shadow-card);
  transition: all 0.25s ease;

  &.active {
    border-color: var(--cta-primary-border);
    background: var(--cta-primary-bg);
    box-shadow: var(--cta-primary-shadow);

    .dark-mode & {
      border-color: #8eaaef;
      background: rgba(91, 134, 229, 0.12);
    }
  }

  .type-icon-box {
    width: 64rpx;
    height: 64rpx;
    border-radius: 999rpx;
    background: var(--apple-glass-pill-bg);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    margin-right: 16rpx;
    border: 1rpx solid rgba(255, 255, 255, 0.5);
    box-shadow: var(--apple-shadow-surface);
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
  background: linear-gradient(160deg, var(--apple-glass-card-bg) 0%, var(--apple-group-bg) 100%);
  border: 2rpx dashed var(--apple-divider);
  border-radius: 24rpx;
  padding: 60rpx 30rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  transition: all 0.25s ease;
  box-shadow: var(--apple-shadow-card);

  .upload-icon-box {
    width: 80rpx;
    height: 80rpx;
    border-radius: 50%;
    background: var(--apple-glass-pill-bg);
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 16rpx;
  }

  .upload-icon-text {
    font-size: 48rpx;
    color: var(--text-primary);
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
  background: linear-gradient(160deg, var(--apple-glass-card-bg) 0%, var(--apple-group-bg) 100%);
  border-radius: 24rpx;
  padding: 24rpx;
  display: flex;
  align-items: center;
  box-shadow: var(--apple-shadow-card);
  border: 1rpx solid var(--apple-glass-border-strong);

  .file-icon-box {
    width: 64rpx;
    height: 64rpx;
    border-radius: 999rpx;
    background: var(--apple-glass-pill-bg);
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

    .file-reading {
      font-size: 22rpx;
      color: #5b86e5;
      margin-top: 4rpx;
      display: block;
    }
  }

  .file-remove {
    width: 56rpx;
    height: 56rpx;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.7);
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
  border-radius: 24rpx;
  /* gap: 20rpx; -- replaced for Android WebView compat */
  & > view + view,
  & > text + text,
  & > view + text,
  & > text + view {
    margin-left: 20rpx;
  }
  box-shadow: var(--apple-shadow-card);

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
  /* gap: 16rpx; -- replaced for Android WebView compat */
  & > view + view,
  & > text + text,
  & > view + text,
  & > text + view {
    margin-top: 16rpx;
  }
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
  padding-bottom: calc(24rpx + constant(safe-area-inset-bottom));
  padding-bottom: calc(24rpx + env(safe-area-inset-bottom, 0px));
  background:
    linear-gradient(180deg, var(--apple-specular-soft) 0%, transparent 42%),
    linear-gradient(160deg, var(--apple-glass-nav-bg) 0%, var(--apple-glass-card-bg) 100%);
  backdrop-filter: blur(24px) saturate(160%);
  -webkit-backdrop-filter: blur(24px) saturate(160%);
  border-top: 1rpx solid var(--apple-glass-border-strong);
  box-shadow: var(--apple-shadow-floating);
}

// 按钮
.btn-primary {
  background: var(--cta-primary-bg);
  color: var(--cta-primary-text);
  border: 1rpx solid var(--cta-primary-border);
  padding: 24rpx;
  border-radius: 999rpx;
  font-size: 30rpx;
  font-weight: 600;
  text-align: center;
  box-shadow: var(--cta-primary-shadow);

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
  background: rgba(255, 255, 255, 0.72);
  color: var(--text-primary, #111);
  border: 1rpx solid rgba(255, 255, 255, 0.5);
  padding: 24rpx;
  border-radius: 999rpx;
  font-size: 28rpx;
  text-align: center;
  box-shadow: var(--apple-shadow-surface);

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
    background: linear-gradient(160deg, rgba(16, 20, 28, 0.96) 0%, rgba(11, 14, 20, 0.98) 100%);
    border-bottom-color: rgba(124, 176, 255, 0.18);
  }

  .nav-back {
    background: rgba(16, 20, 28, 0.72);
  }

  .hero-card {
    background: linear-gradient(160deg, rgba(16, 20, 28, 0.94) 0%, rgba(12, 15, 22, 0.98) 100%);
    border-color: rgba(124, 176, 255, 0.18);
  }

  .type-card {
    background: linear-gradient(160deg, rgba(16, 20, 28, 0.94) 0%, rgba(12, 15, 22, 0.98) 100%);
    box-shadow: var(--apple-shadow-card);

    &.active {
      background: var(--cta-primary-bg);
    }
  }

  .file-placeholder {
    background: linear-gradient(160deg, rgba(16, 20, 28, 0.94) 0%, rgba(12, 15, 22, 0.98) 100%);
    border-color: rgba(124, 176, 255, 0.18);
  }

  .file-info-card {
    background: linear-gradient(160deg, rgba(16, 20, 28, 0.94) 0%, rgba(12, 15, 22, 0.98) 100%);
    box-shadow: var(--apple-shadow-card);

    .file-reading {
      color: #8eaaef;
    }
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
    background: linear-gradient(160deg, rgba(16, 20, 28, 0.96) 0%, rgba(11, 14, 20, 0.98) 100%);
    border-top-color: rgba(124, 176, 255, 0.18);
  }

  .btn-secondary {
    background: rgba(16, 20, 28, 0.72);
    border-color: rgba(124, 176, 255, 0.18);
  }
}

/* Final polish: document convert page unified with Apple / Liquid Glass */
.page-container {
  background: linear-gradient(
    180deg,
    var(--page-gradient-top) 0%,
    var(--page-gradient-mid) 52%,
    var(--page-gradient-bottom) 100%
  );
}

.dark-mode.page-container {
  background: linear-gradient(180deg, #04070d 0%, #0a1018 48%, #04070d 100%);
}

.section .section-title,
.hero-title,
.upload-text,
.file-name,
.status-title,
.btn-secondary {
  color: var(--text-main);
}

.hero-desc,
.type-desc,
.upload-hint,
.file-size,
.file-reading,
.status-hint {
  color: var(--text-sub);
}

.dark-mode .section .section-title,
.dark-mode .hero-title,
.dark-mode .upload-text,
.dark-mode .file-name,
.dark-mode .status-title,
.dark-mode .btn-secondary {
  color: #ffffff;
}

.dark-mode .hero-desc,
.dark-mode .type-desc,
.dark-mode .upload-hint,
.dark-mode .file-size,
.dark-mode .file-reading,
.dark-mode .status-hint {
  color: rgba(255, 255, 255, 0.68);
}

.hero-card,
.type-card,
.file-placeholder,
.file-info-card,
.status-card,
.btn-secondary {
  background:
    linear-gradient(180deg, var(--apple-specular-soft) 0%, transparent 42%),
    linear-gradient(160deg, rgba(255, 255, 255, 0.78) 0%, rgba(241, 248, 243, 0.54) 100%);
  border: 1rpx solid rgba(255, 255, 255, 0.48);
  box-shadow: var(--apple-shadow-card);
}

.dark-mode .hero-card,
.dark-mode .type-card,
.dark-mode .file-placeholder,
.dark-mode .file-info-card,
.dark-mode .status-card,
.dark-mode .btn-secondary {
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.08) 0%, transparent 42%),
    linear-gradient(160deg, rgba(18, 20, 28, 0.94) 0%, rgba(10, 12, 18, 0.9) 100%);
  border-color: rgba(255, 255, 255, 0.1);
}

.type-card {
  border-width: 1rpx;
}

.type-card.active {
  background: var(--cta-primary-bg);
  border-color: var(--cta-primary-border);
}

.dark-mode .type-card.active {
  background: var(--cta-primary-bg);
  border-color: var(--cta-primary-border);
}

.type-card .type-icon-box,
.file-placeholder .upload-icon-box,
.file-info-card .file-icon-box,
.file-info-card .file-remove {
  background: rgba(255, 255, 255, 0.72);
  border: 1rpx solid rgba(255, 255, 255, 0.46);
  box-shadow: var(--apple-shadow-surface);
}

.dark-mode .type-card .type-icon-box,
.dark-mode .file-placeholder .upload-icon-box,
.dark-mode .file-info-card .file-icon-box,
.dark-mode .file-info-card .file-remove {
  background: rgba(10, 132, 255, 0.14);
  border-color: rgba(10, 132, 255, 0.18);
}

.type-card .type-icon,
.file-placeholder .upload-icon-text {
  color: var(--text-main);
}

.dark-mode .type-card .type-icon,
.dark-mode .file-placeholder .upload-icon-text {
  color: #ffffff;
}

.file-info-card .file-reading {
  color: #22873a;
}

.dark-mode .file-info-card .file-reading {
  color: #7bc0ff;
}

.status-card.status-loading,
.status-card.status-done,
.status-card.status-error {
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.28) 0%, transparent 42%),
    linear-gradient(160deg, rgba(255, 255, 255, 0.74) 0%, rgba(241, 248, 243, 0.52) 100%);
}

.dark-mode .status-card.status-loading,
.dark-mode .status-card.status-done,
.dark-mode .status-card.status-error {
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.08) 0%, transparent 42%),
    linear-gradient(160deg, rgba(18, 20, 28, 0.94) 0%, rgba(10, 12, 18, 0.9) 100%);
}

.status-spinner {
  border-color: rgba(52, 199, 89, 0.16);
  border-top-color: #34c759;
}

.dark-mode .status-spinner {
  border-color: rgba(10, 132, 255, 0.16);
  border-top-color: #0a84ff;
}

.status-done-icon,
.status-error-icon {
  background: rgba(255, 255, 255, 0.72);
  border: 1rpx solid rgba(255, 255, 255, 0.46);
  box-shadow: var(--apple-shadow-surface);
}

.dark-mode .status-done-icon,
.dark-mode .status-error-icon {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.1);
}

.action-bar {
  left: 24rpx;
  right: 24rpx;
  bottom: 20rpx;
  border-radius: 34rpx;
  border: 1rpx solid var(--apple-glass-border-strong);
}
</style>
