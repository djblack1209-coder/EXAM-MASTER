<template>
  <view :class="['page-container', { 'dark-mode': isDark }]">
    <!-- 自定义导航栏 -->
    <view class="nav-header" :style="{ paddingTop: statusBarHeight + 'px' }">
      <view class="nav-content">
        <view class="nav-back" @tap="goBack">
          <BaseIcon name="arrow-left" :size="36" />
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
          <!-- 卡通图标替代装饰性 BaseIcon -->
          <image class="hero-cartoon-icon" src="/static/icons/doc-convert.png" mode="aspectFit" alt="" />
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

<script setup>
import { ref, computed } from 'vue';
import { onLoad, onUnload, onHide, onShareAppMessage, onShareTimeline } from '@dcloudio/uni-app';
import { modal } from '@/utils/modal.js';
import { toast } from '@/utils/toast.js';
import { useToolsStore } from '@/stores/modules/tools.js';
import { logger } from '@/utils/logger.js';
import { initTheme, onThemeUpdate, offThemeUpdate } from '@/composables/useTheme.js';
import { getStatusBarHeight } from '@/utils/core/system.js';
import { safeNavigateTo } from '@/utils/safe-navigate';
import { isUserLoggedIn } from '@/utils/auth/loginGuard.js';
import BaseIcon from '@/components/base/base-icon/base-icon.vue';

// 转换类型配置
const CONVERT_TYPES = [
  { key: 'word2pdf', icon: 'W', name: 'Word→PDF', desc: 'doc/docx 转 PDF', accept: '.doc,.docx,.odt,.rtf' },
  { key: 'pdf2word', icon: 'P', name: 'PDF→Word', desc: 'PDF 转 docx', accept: '.pdf' },
  { key: 'excel2pdf', icon: 'E', name: 'Excel→PDF', desc: 'xls/xlsx 转 PDF', accept: '.xls,.xlsx,.ods' },
  { key: 'ppt2pdf', icon: 'S', name: 'PPT→PDF', desc: 'ppt/pptx 转 PDF', accept: '.ppt,.pptx,.odp' },
  { key: 'img2pdf', icon: 'I', name: '图片→PDF', desc: '图片合并为 PDF', accept: '.jpg,.jpeg,.png,.webp' },
  { key: 'pdf2img', icon: 'G', name: 'PDF→图片', desc: 'PDF 转 JPG/PNG', accept: '.pdf' }
];

// 文件大小上限 100MB
const MAX_FILE_SIZE = 100 * 1024 * 1024;

// Store
const toolsStore = useToolsStore();

// ========== 响应式状态 ==========
const statusBarHeight = ref(44);
const isDark = ref(false);
const convertTypes = CONVERT_TYPES; // 静态数据，无需 ref
const selectedType = ref('word2pdf');
const selectedFile = ref(null);
const fileBase64 = ref(null);
const isReadingFile = ref(false);
const status = ref('idle'); // idle | uploading | converting | done | error
const errorMsg = ref('');
const resultUrl = ref(null);
const resultFiles = ref([]);
const jobId = ref(null);

// ========== 非响应式变量（定时器 / 标志位） ==========
let pollTimer = null;
let isPollingRequest = false;
let _themeHandler = null;

// ========== 计算属性 ==========
const currentType = computed(() => {
  return CONVERT_TYPES.find((t) => t.key === selectedType.value);
});

const acceptHint = computed(() => {
  if (!currentType.value) return '';
  return `支持 ${currentType.value.accept} 格式，单文件不超过 ${Math.floor(MAX_FILE_SIZE / 1024 / 1024)}MB`;
});

const canConvert = computed(() => {
  return !!(
    selectedFile.value &&
    selectedType.value &&
    status.value === 'idle' &&
    fileBase64.value &&
    !isReadingFile.value
  );
});

// ========== 分享配置 ==========
onShareAppMessage(() => ({
  title: '免费文档格式转换 - PDF/Word/Excel 互转',
  path: '/pages/tools/doc-convert',
  imageUrl: '/static/images/logo.png'
}));

onShareTimeline(() => ({
  title: '免费文档格式转换 - 无需注册，即用即走',
  query: ''
}));

// ========== 生命周期 ==========
onLoad(() => {
  statusBarHeight.value = getStatusBarHeight();
  isDark.value = initTheme();
  _themeHandler = (mode) => {
    isDark.value = mode === 'dark';
  };
  onThemeUpdate(_themeHandler);
});

onUnload(() => {
  clearPollTimer();
  offThemeUpdate(_themeHandler);
});

// 页面隐藏时也清理轮询，防止后台持续请求
onHide(() => {
  clearPollTimer();
});

// ========== 方法 ==========

/** 判断是否为隐私协议未声明错误 */
function isPrivacyScopeUndeclaredError(err) {
  const msg = String(err?.errMsg || '').toLowerCase();
  return Number(err?.errno) === 112 || msg.includes('privacy agreement') || msg.includes('scope is not declared');
}

/** 显示隐私权限引导弹窗 */
function showPrivacyScopeGuide() {
  modal.show({
    title: '文件权限未开启',
    content:
      '当前小程序未完成文件选择相关隐私声明，暂时无法读取本地文件。\n\n请先同意隐私指引并重启小程序；若仍失败，请在小程序后台隐私设置中勾选"选择文件（chooseMessageFile）"后重新发布。',
    showCancel: false,
    confirmText: '我知道了'
  });
}

/** 返回上一页 */
function goBack() {
  uni.navigateBack({ delta: 1 });
}

/** 选择转换类型 */
function selectType(key) {
  if (status.value !== 'idle') return;
  selectedType.value = key;
  if (selectedFile.value) {
    removeFile();
  }
}

/** 根据转换类型返回图标名称 */
function getTypeIcon(type) {
  const iconMap = {
    word2pdf: 'file-doc',
    pdf2word: 'file-pdf',
    excel2pdf: 'file-xls',
    ppt2pdf: 'file-ppt',
    img2pdf: 'image',
    pdf2img: 'file-pdf'
  };
  return iconMap[type] || 'file';
}

/** 选择文件（多平台兼容） */
function chooseFile() {
  if (status.value !== 'idle') return;

  // #ifdef MP-WEIXIN
  const wxApi = globalThis.wx;
  if (!wxApi || typeof wxApi.chooseMessageFile !== 'function') {
    toast.info('当前环境不支持文件选择');
    return;
  }

  const chooseFromWechat = () => {
    wxApi.chooseMessageFile({
      count: 1,
      type: 'file',
      success: (res) => {
        if (res.tempFiles && res.tempFiles.length > 0) {
          const file = res.tempFiles[0];
          handleSelectedFile({
            name: file.name,
            size: file.size,
            path: file.path
          });
        }
      },
      fail: (err) => {
        if (err?.errMsg && err.errMsg.includes('cancel')) return;
        if (isPrivacyScopeUndeclaredError(err)) {
          logger.warn('[文档转换] 隐私协议未声明文件选择权限:', err);
          showPrivacyScopeGuide();
          return;
        }
        toast.info('选择文件失败');
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
        if (isPrivacyScopeUndeclaredError(err)) {
          logger.warn('[文档转换] 隐私授权检查失败（未声明）:', err);
          showPrivacyScopeGuide();
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
        handleSelectedFile({
          name: file.name,
          size: file.size,
          path: file.path
        });
      }
    },
    fail: (err) => {
      if (err?.errMsg && err.errMsg.includes('cancel')) return;
      toast.info('选择文件失败');
    }
  });
  // #endif

  // #ifdef H5
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = currentType.value ? currentType.value.accept : '*';
  input.onchange = (e) => {
    const file = e.target.files[0];
    if (file) {
      handleSelectedFile({
        name: file.name,
        size: file.size,
        raw: file
      });
    }
  };
  input.click();
  // #endif
}

/** 获取当前类型允许的扩展名列表 */
function getAcceptExtensions() {
  if (!currentType.value || !currentType.value.accept) return [];
  return currentType.value.accept
    .split(',')
    .map((item) => item.trim().toLowerCase().replace(/^\./, ''))
    .filter(Boolean);
}

/** 从文件名中提取扩展名 */
function getFileExtension(fileName) {
  const name = String(fileName || '').trim();
  const dotIndex = name.lastIndexOf('.');
  if (dotIndex < 0) return '';
  return name.slice(dotIndex + 1).toLowerCase();
}

/** 校验文件格式和大小 */
function validateFile(fileName, fileSize) {
  const ext = getFileExtension(fileName);
  const allowed = getAcceptExtensions();
  if (!ext || (allowed.length > 0 && !allowed.includes(ext))) {
    return {
      valid: false,
      message: `当前类型仅支持 ${currentType.value?.accept || '指定格式'} 文件`
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
}

/** 处理已选文件 */
function handleSelectedFile(file) {
  const checkResult = validateFile(file?.name, file?.size);
  if (!checkResult.valid) {
    toast.info(checkResult.message || '文件格式不支持');
    return;
  }

  selectedFile.value = {
    name: file.name,
    size: file.size,
    path: file.path || ''
  };
  fileBase64.value = null;
  errorMsg.value = '';
  resultUrl.value = null;
  resultFiles.value = [];
  jobId.value = null;
  isReadingFile.value = true;

  if (file.path) {
    readFileBase64(file.path);
    return;
  }

  if (file.raw) {
    readH5FileBase64(file.raw);
  }
}

/** 读取文件为 Base64（小程序 / App） */
function readFileBase64(filePath) {
  // #ifdef MP-WEIXIN
  uni.getFileSystemManager().readFile({
    filePath,
    encoding: 'base64',
    success: (res) => {
      fileBase64.value = res.data;
      isReadingFile.value = false;
    },
    fail: (err) => {
      isReadingFile.value = false;
      logger.error('读取文件失败:', err);
      toast.info('读取文件失败');
      removeFile();
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
          fileBase64.value = base64Data;
          isReadingFile.value = false;
        };
        reader.onerror = (err) => {
          isReadingFile.value = false;
          logger.error('读取文件失败:', err);
          toast.info('读取文件失败');
          removeFile();
        };
        reader.readAsDataURL(file);
      });
    },
    (err) => {
      isReadingFile.value = false;
      logger.error('解析文件路径失败:', err);
      toast.info('读取文件失败');
      removeFile();
    }
  );
  // #endif
}

/** 读取文件为 Base64（H5） */
function readH5FileBase64(file) {
  // #ifdef H5
  const reader = new FileReader();
  reader.onload = (ev) => {
    fileBase64.value = String(ev.target?.result || '').split(',')[1] || '';
    isReadingFile.value = false;
  };
  reader.onerror = (err) => {
    isReadingFile.value = false;
    logger.error('读取文件失败:', err);
    toast.info('读取文件失败');
    removeFile();
  };
  reader.readAsDataURL(file);
  // #endif
}

/** 移除已选文件并重置状态 */
function removeFile() {
  clearPollTimer();
  selectedFile.value = null;
  fileBase64.value = null;
  isReadingFile.value = false;
  resultUrl.value = null;
  resultFiles.value = [];
  jobId.value = null;
  status.value = 'idle';
  errorMsg.value = '';
}

/** 从后端返回数据中提取下载链接 */
function extractResultUrl(data) {
  if (!data || typeof data !== 'object') return '';
  if (typeof data.url === 'string' && data.url) return data.url;
  if (typeof data.downloadUrl === 'string' && data.downloadUrl) return data.downloadUrl;
  if (Array.isArray(data.files) && data.files.length > 0 && typeof data.files[0]?.url === 'string') {
    return data.files[0].url;
  }
  return '';
}

/** 规范化错误消息 */
function normalizeErrorMessage(error, fallback = '操作失败，请重试') {
  if (!error) return fallback;
  if (typeof error === 'string') return error;
  if (typeof error === 'object') {
    return error.message || error.msg || fallback;
  }
  return fallback;
}

/** 开始转换 */
async function startConvert() {
  if (!isUserLoggedIn()) {
    modal.show({
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

  if (isReadingFile.value) {
    toast.info('文件读取中，请稍候');
    return;
  }

  if (!selectedFile.value || !fileBase64.value) {
    toast.info('请先选择文件');
    return;
  }

  status.value = 'uploading';
  errorMsg.value = '';
  resultUrl.value = null;
  resultFiles.value = [];

  try {
    const res = await toolsStore.submitConvert(fileBase64.value, selectedFile.value.name, selectedType.value);

    if (res.success && res.data) {
      jobId.value = res.data.jobId || null;
      resultFiles.value = Array.isArray(res.data.files) ? res.data.files : [];
      const url = extractResultUrl(res.data);

      if (url) {
        resultUrl.value = url;
        status.value = 'done';
        return;
      }

      if (!jobId.value) {
        throw new Error('未获取到任务ID，请重试');
      }

      status.value = 'converting';
      startPolling();
    } else {
      throw new Error(res.error?.message || '提交转换失败');
    }
  } catch (error) {
    logger.error('转换提交失败:', error);
    status.value = 'error';
    errorMsg.value = normalizeErrorMessage(error, '转换失败，请重试');
  }
}

/** 开始轮询转换状态 */
function startPolling() {
  if (!jobId.value) {
    status.value = 'error';
    errorMsg.value = '任务ID缺失，请重新提交';
    return;
  }

  let attempts = 0;
  const maxAttempts = 60;

  clearPollTimer();

  pollTimer = setInterval(async () => {
    if (isPollingRequest) {
      return;
    }

    isPollingRequest = true;
    attempts++;
    if (attempts > maxAttempts) {
      clearPollTimer();
      status.value = 'error';
      errorMsg.value = '转换超时，请重试';
      isPollingRequest = false;
      return;
    }

    try {
      const res = await toolsStore.pollConvertStatus(jobId.value);
      if (res.success && res.data) {
        // 注意：解构时用 jobStatus 避免与外层 ref 同名
        const jobStatus = res.data.status;
        if (jobStatus === 'completed' || jobStatus === 'finished') {
          clearPollTimer();
          await fetchResult();
        } else if (jobStatus === 'error' || jobStatus === 'failed') {
          clearPollTimer();
          status.value = 'error';
          errorMsg.value = res.data.error || '转换失败';
        }
      } else if (!res.success) {
        clearPollTimer();
        status.value = 'error';
        errorMsg.value = res.error?.message || '查询转换状态失败';
      }
    } catch (error) {
      logger.error('轮询状态失败:', error);
    } finally {
      isPollingRequest = false;
    }
  }, 2000);
}

/** 获取转换结果 */
async function fetchResult() {
  try {
    const res = await toolsStore.fetchConvertResult(jobId.value);
    if (res.success && res.data) {
      resultFiles.value = Array.isArray(res.data.files) ? res.data.files : [];
      resultUrl.value = extractResultUrl(res.data);
      if (!resultUrl.value) {
        throw new Error('转换结果为空，请重试');
      }
      status.value = 'done';
    } else {
      status.value = 'error';
      errorMsg.value = res.error?.message || '获取结果失败';
    }
  } catch (error) {
    logger.error('获取结果失败:', error);
    status.value = 'error';
    errorMsg.value = normalizeErrorMessage(error, '获取结果失败');
  }
}

/** 下载转换结果（多平台兼容） */
function downloadResult() {
  if (!resultUrl.value) return;

  // #ifdef MP-WEIXIN
  toast.loading('下载中...');
  uni.downloadFile({
    url: resultUrl.value,
    success: (res) => {
      toast.hide();
      if (res.statusCode === 200) {
        uni.openDocument({
          filePath: res.tempFilePath,
          showMenu: true,
          fail: () => {
            toast.info('打开文件失败');
          }
        });
      }
    },
    fail: () => {
      toast.hide();
      toast.info('下载失败');
    }
  });
  // #endif

  // #ifdef APP-PLUS
  toast.loading('下载中...');
  uni.downloadFile({
    url: resultUrl.value,
    success: (res) => {
      toast.hide();
      if (res.statusCode === 200) {
        uni.openDocument({
          filePath: res.tempFilePath,
          showMenu: true,
          fail: () => {
            toast.info('打开文件失败');
          }
        });
      }
    },
    fail: () => {
      toast.hide();
      toast.info('下载失败');
    }
  });
  // #endif

  // #ifdef H5
  uni.navigateTo({ url: '/pages/webview/webview?url=' + encodeURIComponent(resultUrl.value) });
  // #endif
}

/** 重置所有状态，准备下一次转换 */
function resetAll() {
  clearPollTimer();
  selectedFile.value = null;
  fileBase64.value = null;
  isReadingFile.value = false;
  status.value = 'idle';
  errorMsg.value = '';
  resultUrl.value = null;
  resultFiles.value = [];
  jobId.value = null;
}

/** 清除轮询定时器 */
function clearPollTimer() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  isPollingRequest = false;
}

/** 格式化文件大小为可读字符串 */
function formatSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}
</script>

<style lang="scss" scoped>
.page-container {
  min-height: 100%;
  min-height: 100vh;
  background: var(--background);
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
    font-weight: 800;
    color: var(--text-primary);
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

  /* 英雄级卡通图标（替代 BaseIcon size>=56） */
  .hero-cartoon-icon {
    width: 100rpx;
    height: 100rpx;
  }

  .hero-title {
    font-size: 36rpx;
    font-weight: 800;
    color: var(--text-primary);
    margin-bottom: 8rpx;
  }

  .hero-desc {
    font-size: 24rpx;
    color: var(--text-secondary);
  }
}

// 区块
.section {
  margin-bottom: 32rpx;

  .section-title {
    font-size: 30rpx;
    font-weight: 800;
    color: var(--text-primary);
    margin-bottom: 20rpx;
    display: block;
  }
}

// 转换类型网格
.type-grid {
  display: flex;
  flex-wrap: wrap;
  /* gap: 16rpx; -- replaced for Android WebView compat */
  justify-content: space-between;
}

.type-card {
  width: calc(50% - 8rpx);
  display: flex;
  align-items: center;
  padding: 20rpx;
  margin-bottom: 16rpx;
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
      border-color: var(--primary);
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
    color: var(--text-inverse);
  }

  .type-text {
    flex: 1;
    overflow: hidden;
  }

  .type-name {
    font-size: 26rpx;
    font-weight: 700;
    color: var(--text-primary);
    display: block;
  }

  .type-desc {
    font-size: 20rpx;
    color: var(--text-secondary);
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
      color: var(--primary);
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
      color: var(--primary);
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
      color: var(--danger);

      .dark-mode & {
        color: var(--danger);
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
    background: color-mix(in srgb, var(--success) 6%, transparent);
    border: 1rpx solid color-mix(in srgb, var(--success) 12%, transparent);
  }

  &.status-error {
    background: color-mix(in srgb, var(--danger) 6%, transparent);
    border: 1rpx solid color-mix(in srgb, var(--danger) 12%, transparent);
  }
}

.status-spinner {
  width: 48rpx;
  height: 48rpx;
  border: 4rpx solid rgba(91, 134, 229, 0.2);
  border-top-color: var(--primary);
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
  background: linear-gradient(135deg, var(--success), var(--wise-green));
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;

  .done-check {
    color: var(--text-inverse);
    font-size: 26rpx;
    font-weight: 700;
  }
}

.status-error-icon {
  width: 48rpx;
  height: 48rpx;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--danger), var(--danger));
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;

  .error-mark {
    color: var(--text-inverse);
    font-size: 28rpx;
    font-weight: 700;
  }
}

.status-text-group {
  flex: 1;

  .status-title {
    font-size: 28rpx;
    font-weight: 700;
    color: var(--text-primary);
    display: block;
  }

  .status-hint {
    font-size: 22rpx;
    color: var(--text-secondary);
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
  background: var(--primary);
  color: var(--text-inverse);
  border: none;
  padding: 24rpx;
  border-radius: 999rpx;
  font-size: 30rpx;
  font-weight: 800;
  text-align: center;
  box-shadow: 0 8rpx 0 #22a09c;

  &:active {
    transform: translateY(4rpx);
    box-shadow: 0 4rpx 0 #22a09c;
  }

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
      color: var(--primary);
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
  background: linear-gradient(180deg, var(--background) 0%, var(--page-gradient-mid) 48%, var(--background) 100%);
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
  color: var(--text-inverse);
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
  color: var(--text-inverse);
}

.file-info-card .file-reading {
  color: var(--success-dark);
}

.dark-mode .file-info-card .file-reading {
  color: var(--primary);
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
  border-top-color: var(--success);
}

.dark-mode .status-spinner {
  border-color: rgba(10, 132, 255, 0.16);
  border-top-color: var(--primary);
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
