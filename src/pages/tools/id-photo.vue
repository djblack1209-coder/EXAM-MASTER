<template>
  <view :class="['page-container', { 'dark-mode': isDark }]">
    <PrivacyPopup />
    <!-- 自定义导航栏 -->
    <view class="nav-header" :style="{ paddingTop: statusBarHeight + 'px' }">
      <view class="nav-content">
        <view class="nav-back" @tap="goBack">
          <BaseIcon name="arrow-left" :size="36" />
        </view>
        <text class="nav-title"> 证件照制作 </text>
        <view class="nav-placeholder" />
      </view>
    </view>

    <!-- 主内容 -->
    <scroll-view scroll-y class="main-scroll" :style="{ paddingTop: statusBarHeight + 50 + 'px' }">
      <!-- 顶部描述卡片 -->
      <view class="hero-card">
        <view class="hero-icon-wrapper">
          <BaseIcon name="camera" :size="64" class="hero-icon" />
        </view>
        <text class="hero-title"> 智能证件照 </text>
        <text class="hero-desc"> 智能抠图换背景，支持多种证件照尺寸 </text>
      </view>

      <!-- 步骤指示器 -->
      <view class="steps-bar">
        <view v-for="(s, i) in steps" :key="i" :class="['step-item', { active: step >= i, done: step > i }]">
          <view class="step-dot">
            <BaseIcon v-if="step > i" name="check" :size="28" />
            <text v-else class="step-num">
              {{ i + 1 }}
            </text>
          </view>
          <text class="step-label">
            {{ s }}
          </text>
          <view v-if="i < steps.length - 1" :class="['step-line', { filled: step > i }]" />
        </view>
      </view>

      <!-- Step 0: 上传照片 -->
      <view v-if="step === 0" class="section">
        <view id="e2e-id-photo-upload" class="upload-area" @tap="choosePhoto">
          <view class="upload-icon-box">
            <BaseIcon name="upload" :size="48" class="upload-icon-text" />
          </view>
          <text class="upload-text"> 选择或拍摄照片 </text>
          <text class="upload-hint"> 建议正面免冠、光线均匀 </text>
        </view>
      </view>

      <!-- Step 1: 选择配置 -->
      <view v-else-if="step === 1" class="section">
        <!-- 预览 -->
        <view class="preview-card">
          <image :src="previewSrc" mode="aspectFit" class="preview-img" />
        </view>

        <!-- 尺寸选择 -->
        <view class="config-block">
          <text class="config-label"> 证件照尺寸 </text>
          <view class="option-grid">
            <view
              v-for="s in sizeOptions"
              :id="`e2e-id-photo-size-${s.key}`"
              :key="s.key"
              :class="['option-chip', { active: selectedSize === s.key }]"
              @tap="selectedSize = s.key"
            >
              <text class="option-name">
                {{ s.name }}
              </text>
              <text class="option-desc">
                {{ s.desc }}
              </text>
            </view>
          </view>
        </view>

        <!-- 背景颜色选择 -->
        <view class="config-block">
          <text class="config-label"> 背景颜色 </text>
          <view class="color-row">
            <view
              v-for="c in colorOptions"
              :id="`e2e-id-photo-color-${c.key}`"
              :key="c.key"
              :class="['color-item', { active: selectedColor === c.key }]"
              @tap="selectedColor = c.key"
            >
              <view class="color-circle" :style="{ background: c.hex }" />
              <text class="color-name">
                {{ c.name }}
              </text>
            </view>
          </view>
        </view>

        <!-- 美颜开关 -->
        <view class="beauty-card">
          <view class="beauty-info">
            <text class="beauty-label"> 智能美颜 </text>
            <text class="beauty-hint"> 自动优化肤色与光线 </text>
          </view>
          <switch
            :checked="enableBeauty"
            :color="isDark ? '#0a84ff' : '#34c759'"
            @change="enableBeauty = $event.detail.value"
          />
        </view>

        <button id="e2e-id-photo-start" class="btn-primary" hover-class="btn-hover" @tap="startProcess">
          <text>开始制作</text>
        </button>
      </view>

      <!-- Step 2: 处理中 -->
      <view v-else-if="step === 2" class="section center-section">
        <view class="processing-card">
          <view class="processing-spinner" />
          <text class="processing-title">
            {{ processingText }}
          </text>
          <text class="processing-hint"> 智能正在处理您的照片... </text>
        </view>
      </view>

      <!-- Step 3: 结果 -->
      <view v-else-if="step === 3" class="section">
        <view class="result-card">
          <image :src="resultImage" mode="aspectFit" class="result-img" />
        </view>
        <view class="result-actions">
          <button id="e2e-id-photo-save" class="btn-primary" hover-class="btn-hover" @tap="saveResult">
            <text>保存到相册</text>
          </button>
          <button id="e2e-id-photo-change-color" class="btn-secondary" hover-class="btn-hover" @tap="changeColor">
            <text>换个颜色</text>
          </button>
          <button id="e2e-id-photo-reset" class="btn-ghost" hover-class="btn-hover" @tap="resetAll">
            <text>重新制作</text>
          </button>
        </view>
      </view>

      <canvas canvas-id="idPhotoComposeCanvas" class="compose-canvas"></canvas>
      <view class="bottom-safe" />
    </scroll-view>
  </view>
</template>

<script>
import { toast } from '@/utils/toast.js';
import { useToolsStore } from '@/stores/modules/tools.js';
import { logger } from '@/utils/logger.js';
import { initTheme, onThemeUpdate, offThemeUpdate } from '@/composables/useTheme.js';
import { getStatusBarHeight } from '@/utils/core/system.js';
import { safeNavigateTo } from '@/utils/safe-navigate';
import { isUserLoggedIn } from '@/utils/auth/loginGuard.js';
import BaseIcon from '@/components/base/base-icon/base-icon.vue';
import PrivacyPopup from '@/components/common/privacy-popup.vue';
import { ensureMiniProgramScope, ensurePrivacyAuthorization } from './privacy-authorization.js';

const DEFAULT_SIZES = [
  { key: '1inch', name: '一寸', desc: '25×35mm' },
  { key: '2inch', name: '二寸', desc: '35×49mm' },
  { key: 'small2inch', name: '小二寸', desc: '33×48mm' },
  { key: 'passport', name: '护照', desc: '33×48mm' },
  { key: 'visa', name: '签证', desc: '35×45mm' }
];

const DEFAULT_COLORS = [
  { key: 'white', name: '白色', hex: '#FFFFFF' },
  { key: 'blue', name: '蓝色', hex: '#438EDB' },
  { key: 'red', name: '红色', hex: '#D03A3A' },
  { key: 'gray', name: '灰色', hex: '#F5F5F5' },
  { key: 'light_blue', name: '浅蓝', hex: '#4A90D9' },
  { key: 'dark_blue', name: '深蓝', hex: '#1E3A8A' }
];

const DEFAULT_SIZE_PIXELS = {
  '1inch': { width: 295, height: 413 },
  '2inch': { width: 413, height: 579 },
  small2inch: { width: 390, height: 567 },
  passport: { width: 390, height: 567 },
  visa: { width: 413, height: 531 }
};

export default {
  components: { BaseIcon, PrivacyPopup },
  setup() {
    const toolsStore = useToolsStore();
    return { toolsStore };
  },
  data() {
    return {
      statusBarHeight: 44,
      steps: ['上传照片', '选择配置', '处理中', '完成'],
      step: 0,
      previewSrc: '',
      imageBase64: '',
      sizeOptions: DEFAULT_SIZES,
      colorOptions: DEFAULT_COLORS,
      selectedSize: '1inch',
      selectedColor: 'blue',
      enableBeauty: false,
      isDark: false,
      processingText: '正在抠图...',
      resultImage: '',
      foregroundBase64: '',
      composeCanvasId: 'idPhotoComposeCanvas'
    };
  },

  onShareAppMessage() {
    return {
      title: '免费证件照换底色 - 考研考公报名必备',
      path: '/pages/tools/id-photo',
      imageUrl: '/static/images/logo.png'
    };
  },
  onShareTimeline() {
    return {
      title: '免费证件照换底色 - 不用下载APP，微信直接用',
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
    this.loadConfig();
  },

  onUnload() {
    offThemeUpdate(this._themeHandler);
  },

  methods: {
    goBack() {
      uni.navigateBack({ delta: 1 });
    },

    async loadConfig() {
      try {
        const res = await this.toolsStore.fetchPhotoConfig();
        if (res.success && res.data) {
          if (res.data.sizes) {
            this.sizeOptions = Object.entries(res.data.sizes).map(([key, v]) => ({
              key,
              name: v.name,
              desc: v.desc
            }));
          }
          if (res.data.colors) {
            this.colorOptions = Object.entries(res.data.colors).map(([key, v]) => ({
              key,
              name: v.name,
              hex: v.hex
            }));
          }
        }
      } catch (e) {
        logger.warn('加载配置失败，使用默认值:', e);
      }
    },

    async ensureMediaPermission(sourceType) {
      const privacyOk = await ensurePrivacyAuthorization();
      if (!privacyOk) {
        toast.info('需要先同意隐私授权');
        return false;
      }

      // #ifdef MP-WEIXIN
      if (sourceType === 'camera') {
        return ensureMiniProgramScope('scope.camera', {
          title: '相机权限提示',
          content: '需要相机权限才能拍摄证件照，是否前往设置开启？'
        });
      }
      // #endif

      return true;
    },

    choosePhoto() {
      // #ifndef MP-WEIXIN
      this.choosePhotoLegacy();
      return;
      // #endif

      uni.showActionSheet({
        itemList: ['拍照', '从相册选择'],
        success: async (res) => {
          const sourceType = res.tapIndex === 0 ? 'camera' : 'album';
          const canUse = await this.ensureMediaPermission(sourceType);
          if (!canUse) return;

          uni.chooseImage({
            count: 1,
            sizeType: ['compressed'],
            sourceType: [sourceType],
            success: (chooseRes) => {
              const path = chooseRes.tempFilePaths[0];
              this.previewSrc = path;
              this.readBase64(path);
            },
            fail: (err) => {
              if (err.errMsg && /deny|auth/i.test(err.errMsg)) {
                uni.showModal({
                  title: '权限提示',
                  content:
                    sourceType === 'camera'
                      ? '需要相机权限才能拍摄证件照，是否前往设置开启？'
                      : '需要相册权限才能选择照片，是否前往设置开启？',
                  success: (modalRes) => {
                    if (modalRes.confirm && typeof uni.openSetting === 'function') {
                      uni.openSetting();
                    }
                  }
                });
              } else if (err.errMsg && !err.errMsg.includes('cancel')) {
                toast.info(sourceType === 'camera' ? '拍照失败，请检查权限' : '选择照片失败');
              }
            }
          });
        },
        fail: () => {
          // ignore cancel
        }
      });
    },

    /* legacy path retained for compatibility */
    choosePhotoLegacy() {
      uni.chooseImage({
        count: 1,
        sizeType: ['compressed'],
        sourceType: ['album', 'camera'],
        success: (res) => {
          const path = res.tempFilePaths[0];
          this.previewSrc = path;
          this.readBase64(path);
        },
        fail: (err) => {
          if (err.errMsg && !err.errMsg.includes('cancel')) {
            toast.info('选择照片失败');
          }
        }
      });
    },

    readBase64(path) {
      // #ifdef MP-WEIXIN
      uni.getFileSystemManager().readFile({
        filePath: path,
        encoding: 'base64',
        success: (res) => {
          this.imageBase64 = res.data;
          this.step = 1;
        },
        fail: (err) => {
          logger.error('读取照片失败:', err);
          toast.info('读取照片失败');
        }
      });
      // #endif

      // #ifdef H5
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        canvas.getContext('2d').drawImage(img, 0, 0);
        this.imageBase64 = canvas.toDataURL('image/jpeg', 0.9).split(',')[1];
        this.step = 1;
      };
      img.onerror = () => toast.info('加载照片失败');
      img.src = path;
      // #endif

      // #ifdef APP-PLUS
      plus.io.resolveLocalFileSystemURL(
        path,
        (entry) => {
          entry.file((file) => {
            const reader = new plus.io.FileReader();
            reader.onloadend = (e) => {
              const base64Data = e.target.result.split(',')[1];
              this.imageBase64 = base64Data;
              this.step = 1;
            };
            reader.onerror = () => {
              toast.info('读取照片失败');
            };
            reader.readAsDataURL(file);
          });
        },
        () => {
          toast.info('读取照片失败');
        }
      );
      // #endif
    },

    async startProcess() {
      if (!isUserLoggedIn()) {
        uni.showModal({
          title: '请先登录',
          content: '登录后可使用证件照处理功能',
          confirmText: '去登录',
          success: (res) => {
            if (res.confirm) {
              safeNavigateTo('/pages/login/index');
            }
          }
        });
        return;
      }

      if (!this.imageBase64) {
        toast.info('请先上传照片');
        return;
      }

      this.step = 2;
      this.processingText = '正在智能抠图...';

      try {
        const res = await this.toolsStore.processPhoto(this.imageBase64, this.selectedColor, this.selectedSize, {
          beauty: this.enableBeauty
        });

        if (res.success && res.data) {
          const payload = res.data || {};
          const directResult = payload.resultImage || payload.image || '';
          const foreground = payload.foreground || payload.imageBase64 || directResult || '';
          const needComposite = payload.needComposite === true;

          if (needComposite) {
            if (!foreground) {
              throw new Error('未返回可合成的前景图');
            }

            this.processingText = '正在合成证件照...';
            this.resultImage = await this.composeResultImage({
              foregroundBase64: foreground,
              bgColorHex: payload.bgColorHex || this.getSelectedColorHex(),
              sizeConfig: payload.size
            });
            this.foregroundBase64 = foreground;
          } else if (directResult || foreground) {
            this.resultImage = this.normalizeImageSource(directResult || foreground);
            this.foregroundBase64 = payload.foreground || payload.imageBase64 || '';
          } else {
            throw new Error('未返回处理结果');
          }

          this.step = 3;
        } else {
          throw new Error(res.message || '处理失败');
        }
      } catch (error) {
        logger.error('证件照处理失败:', error);
        uni.showModal({
          title: '处理失败',
          content: error.message || '请确保照片为正面免冠照',
          showCancel: false
        });
        this.step = 1;
      }
    },

    getSelectedColorHex() {
      const color = (this.colorOptions || []).find((item) => item.key === this.selectedColor);
      return color?.hex || '#438EDB';
    },

    normalizeImageSource(input, mime = 'image/png') {
      const source = String(input || '').trim();
      if (!source) return '';
      if (/^(data:image\/|blob:|https?:\/\/|wxfile:\/\/|file:\/\/|\/)/i.test(source)) {
        return source;
      }
      return `data:${mime};base64,${source}`;
    },

    extractBase64Payload(input) {
      const source = String(input || '').trim();
      if (!source) return '';
      if (source.startsWith('data:image/')) {
        const commaIndex = source.indexOf(',');
        return commaIndex >= 0 ? source.slice(commaIndex + 1) : '';
      }
      if (/^(wxfile:\/\/|https?:\/\/|blob:|file:\/\/|\/)/i.test(source)) {
        return '';
      }
      return source;
    },

    resolveSizeConfig(sizeConfig) {
      const width = Number(sizeConfig?.width);
      const height = Number(sizeConfig?.height);
      if (Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0) {
        return {
          width: Math.round(width),
          height: Math.round(height)
        };
      }

      const fallback = DEFAULT_SIZE_PIXELS[this.selectedSize] || DEFAULT_SIZE_PIXELS['1inch'];
      return {
        width: fallback.width,
        height: fallback.height
      };
    },

    getImageInfo(src) {
      return new Promise((resolve, reject) => {
        uni.getImageInfo({
          src,
          success: (res) => resolve(res),
          fail: (err) => reject(new Error(err?.errMsg || '读取图片信息失败'))
        });
      });
    },

    writeBase64ToTempImage(base64) {
      const payload = this.extractBase64Payload(base64);
      if (!payload) {
        return Promise.reject(new Error('无效的图片数据'));
      }

      // #ifdef MP-WEIXIN
      return new Promise((resolve, reject) => {
        const filePath = `${wx.env.USER_DATA_PATH}/id_photo_fg_${Date.now()}.png`;
        uni.getFileSystemManager().writeFile({
          filePath,
          data: payload,
          encoding: 'base64',
          success: () => resolve(filePath),
          fail: (err) => reject(new Error(err?.errMsg || '写入临时图片失败'))
        });
      });
      // #endif

      // #ifndef MP-WEIXIN
      return Promise.resolve(this.normalizeImageSource(payload));
      // #endif
    },

    async composeResultImage({ foregroundBase64, bgColorHex, sizeConfig }) {
      const targetSize = this.resolveSizeConfig(sizeConfig);
      const bg = bgColorHex || this.getSelectedColorHex();

      // #ifdef H5
      return this.composeResultImageH5(foregroundBase64, bg, targetSize);
      // #endif

      // #ifndef H5
      return this.composeResultImageUni(foregroundBase64, bg, targetSize);
      // #endif
    },

    async composeResultImageUni(foregroundBase64, bgColorHex, targetSize) {
      // ✅ P0-FIX: 捕获文件写入和图片信息读取异常
      let sourcePath;
      try {
        sourcePath = await this.writeBase64ToTempImage(foregroundBase64);
      } catch (writeErr) {
        logger.error('[id-photo] 写入临时图片失败:', writeErr);
        throw new Error('图片处理失败，请重试');
      }

      let imageInfo;
      try {
        imageInfo = await this.getImageInfo(sourcePath);
      } catch (infoErr) {
        logger.error('[id-photo] 读取图片信息失败:', infoErr);
        throw new Error('图片信息读取失败，请重试');
      }

      const width = targetSize.width;
      const height = targetSize.height;
      const scale = Math.min(width / imageInfo.width, height / imageInfo.height);
      const drawWidth = Math.max(1, Math.round(imageInfo.width * scale));
      const drawHeight = Math.max(1, Math.round(imageInfo.height * scale));
      const dx = Math.round((width - drawWidth) / 2);
      const dy = Math.round((height - drawHeight) / 2);

      const ctx = uni.createCanvasContext(this.composeCanvasId, this);
      ctx.setFillStyle(bgColorHex || '#FFFFFF');
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(sourcePath, dx, dy, drawWidth, drawHeight);

      await new Promise((resolve) => ctx.draw(false, resolve));

      return new Promise((resolve, reject) => {
        uni.canvasToTempFilePath(
          {
            canvasId: this.composeCanvasId,
            fileType: 'png',
            quality: 1,
            width,
            height,
            destWidth: width,
            destHeight: height,
            success: (res) => resolve(res.tempFilePath),
            fail: (err) => reject(new Error(err?.errMsg || '导出证件照失败'))
          },
          this
        );
      });
    },

    composeResultImageH5(foregroundBase64, bgColorHex, targetSize) {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          try {
            const width = targetSize.width;
            const height = targetSize.height;
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext('2d');
            if (!ctx) {
              reject(new Error('创建画布失败'));
              return;
            }

            ctx.fillStyle = bgColorHex || '#FFFFFF';
            ctx.fillRect(0, 0, width, height);

            const scale = Math.min(width / img.width, height / img.height);
            const drawWidth = Math.max(1, Math.round(img.width * scale));
            const drawHeight = Math.max(1, Math.round(img.height * scale));
            const dx = Math.round((width - drawWidth) / 2);
            const dy = Math.round((height - drawHeight) / 2);
            ctx.drawImage(img, dx, dy, drawWidth, drawHeight);

            resolve(canvas.toDataURL('image/png'));
          } catch (err) {
            reject(new Error(err?.message || '合成证件照失败'));
          }
        };
        img.onerror = () => reject(new Error('加载前景图失败'));
        img.src = this.normalizeImageSource(foregroundBase64);
      });
    },

    saveImageToAlbum(filePath) {
      uni.saveImageToPhotosAlbum({
        filePath,
        success: () => {
          toast.success('已保存到相册');
        },
        fail: (err) => {
          if (err.errMsg && err.errMsg.includes('auth deny')) {
            uni.showModal({
              title: '提示',
              content: '需要相册权限才能保存，是否前往设置？',
              success: (res) => {
                if (res.confirm) uni.openSetting();
              }
            });
          } else {
            toast.info('保存失败');
          }
        }
      });
    },

    async changeColor() {
      this.step = 1;
    },

    saveResult() {
      if (!this.resultImage) return;

      // #ifdef MP-WEIXIN
      ensurePrivacyAuthorization().then((privacyOk) => {
        if (!privacyOk) {
          toast.info('需要先同意隐私授权');
          return;
        }

        ensureMiniProgramScope('scope.writePhotosAlbum', {
          title: '相册权限提示',
          content: '需要相册权限才能保存证件照，是否前往设置开启？'
        }).then((granted) => {
          if (!granted) {
            toast.info('未开启相册权限');
            return;
          }

          const src = String(this.resultImage || '');
          if (/^(wxfile:\/\/|\/)/i.test(src)) {
            this.saveImageToAlbum(src);
            return;
          }

          const base64Data = this.extractBase64Payload(src);
          if (!base64Data) {
            toast.info('保存失败');
            return;
          }

          const filePath = `${wx.env.USER_DATA_PATH}/id_photo_${Date.now()}.png`;
          uni.getFileSystemManager().writeFile({
            filePath,
            data: base64Data,
            encoding: 'base64',
            success: () => this.saveImageToAlbum(filePath),
            fail: () => {
              toast.info('保存失败');
            }
          });
        });
      });
      // #endif

      // #ifdef H5
      const link = document.createElement('a');
      link.href = this.resultImage;
      link.download = `id_photo_${Date.now()}.png`;
      link.click();
      // #endif
    },

    resetAll() {
      this.step = 0;
      this.previewSrc = '';
      this.imageBase64 = '';
      this.resultImage = '';
      this.foregroundBase64 = '';
      this.enableBeauty = false;
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

// 步骤指示器
.steps-bar {
  display: flex;
  align-items: flex-start;
  padding: 24rpx 16rpx;
  margin-bottom: 24rpx;
  background: linear-gradient(180deg, var(--apple-group-bg) 0%, var(--apple-glass-card-bg) 100%);
  border-radius: 24rpx;
  box-shadow: var(--apple-shadow-card);
  border: 1rpx solid var(--apple-glass-border-strong);
}

.step-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;

  .step-dot {
    width: 48rpx;
    height: 48rpx;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.68);
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 8rpx;
    transition: all 0.3s ease;
    border: 1rpx solid rgba(255, 255, 255, 0.5);
  }

  .step-num {
    font-size: 22rpx;
    color: var(--text-secondary, #666);
    font-weight: 600;
  }

  .step-check {
    font-size: 22rpx;
    color: var(--text-inverse);
    font-weight: 700;
  }

  .step-label {
    font-size: 20rpx;
    color: var(--text-secondary, #666);
  }

  .step-line {
    position: absolute;
    top: 24rpx;
    left: calc(50% + 28rpx);
    right: calc(-50% + 28rpx);
    height: 3rpx;
    background: var(--bg-secondary, #f5f5f7);
    transition: background 0.3s ease;

    &.filled {
      background: var(--cta-primary-bg);
    }
  }

  &.active {
    .step-dot {
      background: var(--cta-primary-bg);
      box-shadow: var(--cta-primary-shadow);
    }

    .step-num {
      color: var(--text-inverse);
    }

    .step-label {
      color: var(--primary);
      font-weight: 600;
    }
  }

  &.done .step-dot {
    background: linear-gradient(135deg, var(--success), var(--wise-green));
    box-shadow: 0 4rpx 12rpx rgba(52, 199, 89, 0.3);
  }
}

// 区块
.section {
  margin-bottom: 24rpx;
}

.center-section {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 500rpx;
}

// 上传区域
.upload-area {
  background: linear-gradient(160deg, var(--apple-glass-card-bg) 0%, var(--apple-group-bg) 100%);
  border: 2rpx dashed var(--apple-divider);
  border-radius: 24rpx;
  padding: 80rpx 30rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  box-shadow: var(--apple-shadow-card);

  .upload-icon-box {
    width: 96rpx;
    height: 96rpx;
    border-radius: 50%;
    background: var(--apple-glass-pill-bg);
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 20rpx;
  }

  .upload-icon-text {
    font-size: 56rpx;
    color: var(--text-primary);
    font-weight: 300;
    line-height: 1;
  }

  .upload-text {
    font-size: 30rpx;
    color: var(--text-primary, #111);
    font-weight: 500;
  }

  .upload-hint {
    font-size: 24rpx;
    color: var(--text-secondary, #666);
    margin-top: 10rpx;
  }
}

// 预览卡片
.preview-card {
  background: linear-gradient(160deg, rgba(10, 12, 16, 0.92) 0%, rgba(18, 22, 30, 0.98) 100%);
  border-radius: 24rpx;
  overflow: hidden;
  margin-bottom: 24rpx;
  display: flex;
  justify-content: center;
  border: 1rpx solid rgba(124, 176, 255, 0.18);
  box-shadow: var(--apple-shadow-floating);

  .preview-img {
    width: 100%;
    height: 400rpx;
  }
}

// 配置区块
.config-block {
  margin-bottom: 24rpx;

  .config-label {
    font-size: 28rpx;
    font-weight: 600;
    color: var(--text-primary, #111);
    margin-bottom: 16rpx;
    display: block;
  }
}

.option-grid {
  display: flex;
  flex-wrap: wrap;
  /* gap: 12rpx; -- replaced for Android WebView compat */
  & > view + view,
  & > text + text,
  & > view + text,
  & > text + view {
    margin-left: 12rpx;
  }
}

.option-chip {
  padding: 16rpx 24rpx;
  background: rgba(255, 255, 255, 0.68);
  border-radius: 999rpx;
  border: 2rpx solid rgba(255, 255, 255, 0.46);
  box-shadow: var(--apple-shadow-surface);
  transition: all 0.25s ease;

  &.active {
    border-color: var(--cta-primary-border);
    background: var(--cta-primary-bg);
    box-shadow: var(--cta-primary-shadow);
  }

  .option-name {
    font-size: 26rpx;
    font-weight: 600;
    color: var(--text-primary, #111);
    display: block;
  }

  .option-desc {
    font-size: 20rpx;
    color: var(--text-secondary, #666);
    margin-top: 2rpx;
  }
}

.color-row {
  display: flex;
  /* gap: 24rpx; -- replaced for Android WebView compat */
  & > view + view,
  & > text + text,
  & > view + text,
  & > text + view {
    margin-left: 24rpx;
  }
  flex-wrap: wrap;
}

.color-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  /* gap: 8rpx; -- replaced for Android WebView compat */
  & > view + view,
  & > text + text,
  & > view + text,
  & > text + view {
    margin-top: 8rpx;
  }

  .color-circle {
    width: 64rpx;
    height: 64rpx;
    border-radius: 50%;
    border: 2rpx solid rgba(0, 0, 0, 0.08);
    transition: all 0.25s ease;
  }

  &.active .color-circle {
    box-shadow: 0 0 0 4rpx var(--primary);
    transform: scale(1.1);
  }

  .color-name {
    font-size: 20rpx;
    color: var(--text-secondary, #666);
  }
}

// 美颜卡片
.beauty-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: linear-gradient(180deg, var(--apple-group-bg) 0%, var(--apple-glass-card-bg) 100%);
  padding: 24rpx;
  border-radius: 24rpx;
  margin-bottom: 32rpx;
  box-shadow: var(--apple-shadow-card);
  border: 1rpx solid var(--apple-glass-border-strong);

  .beauty-info {
    display: flex;
    flex-direction: column;
  }

  .beauty-label {
    font-size: 28rpx;
    font-weight: 600;
    color: var(--text-primary, #111);
  }

  .beauty-hint {
    font-size: 22rpx;
    color: var(--text-secondary, #666);
    margin-top: 4rpx;
  }
}

// 处理中
.processing-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 60rpx 40rpx;
  background: linear-gradient(160deg, var(--apple-glass-card-bg) 0%, var(--apple-group-bg) 100%);
  border-radius: 28rpx;
  box-shadow: var(--apple-shadow-floating);
  width: 100%;
  border: 1rpx solid var(--apple-glass-border-strong);

  .processing-spinner {
    width: 80rpx;
    height: 80rpx;
    border: 6rpx solid rgba(232, 67, 147, 0.15);
    border-top-color: var(--primary);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  .processing-title {
    font-size: 30rpx;
    font-weight: 600;
    color: var(--text-primary, #111);
    margin-top: 28rpx;
  }

  .processing-hint {
    font-size: 24rpx;
    color: var(--text-secondary, #666);
    margin-top: 10rpx;
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

// 结果
.result-card {
  background: linear-gradient(160deg, var(--apple-glass-card-bg) 0%, var(--apple-group-bg) 100%);
  border-radius: 24rpx;
  overflow: hidden;
  display: flex;
  justify-content: center;
  margin-bottom: 32rpx;
  box-shadow: var(--apple-shadow-card);
  border: 1rpx solid var(--apple-glass-border-strong);

  .result-img {
    width: 100%;
    height: 500rpx;
  }
}

.result-actions {
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

.btn-ghost {
  background: rgba(255, 255, 255, 0.28);
  color: var(--text-secondary, #666);
  border: 1rpx solid rgba(255, 255, 255, 0.42);
  padding: 20rpx;
  font-size: 26rpx;
  text-align: center;
  border-radius: 999rpx;

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

  .steps-bar {
    background: linear-gradient(180deg, rgba(16, 20, 28, 0.94) 0%, rgba(12, 15, 22, 0.98) 100%);
    box-shadow: var(--apple-shadow-card);
  }

  .step-item .step-dot {
    background: rgba(16, 20, 28, 0.72);
  }

  .upload-area {
    background: linear-gradient(160deg, rgba(16, 20, 28, 0.94) 0%, rgba(12, 15, 22, 0.98) 100%);
    border-color: rgba(124, 176, 255, 0.18);
  }

  .option-chip {
    background: rgba(16, 20, 28, 0.72);
    box-shadow: var(--apple-shadow-surface);

    &.active {
      background: var(--cta-primary-bg);
    }
  }

  .color-item .color-circle {
    border-color: rgba(255, 255, 255, 0.12);
  }

  .beauty-card {
    background: linear-gradient(180deg, rgba(16, 20, 28, 0.94) 0%, rgba(12, 15, 22, 0.98) 100%);
    box-shadow: var(--apple-shadow-card);
  }

  .processing-card {
    background: linear-gradient(160deg, rgba(16, 20, 28, 0.94) 0%, rgba(12, 15, 22, 0.98) 100%);
    box-shadow: var(--apple-shadow-floating);
  }

  .result-card {
    background: linear-gradient(160deg, rgba(16, 20, 28, 0.94) 0%, rgba(12, 15, 22, 0.98) 100%);
    box-shadow: var(--apple-shadow-card);
  }

  .preview-card {
    background: var(--background);
  }

  .btn-secondary {
    background: rgba(16, 20, 28, 0.72);
    border-color: rgba(124, 176, 255, 0.18);
  }
}

.bottom-safe {
  height: 120rpx;
}

.compose-canvas {
  position: fixed;
  left: -9999px;
  top: -9999px;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
}

/* Final polish: ID photo page unified with Apple / Liquid Glass */
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

.hero-title,
.config-block .config-label,
.beauty-label,
.processing-title,
.upload-text,
.option-chip .option-name,
.btn-secondary,
.btn-ghost {
  color: var(--text-main);
}

.hero-desc,
.step-item .step-label,
.upload-hint,
.option-chip .option-desc,
.color-item .color-name,
.beauty-hint,
.processing-hint,
.btn-ghost {
  color: var(--text-sub);
}

.dark-mode .hero-title,
.dark-mode .config-block .config-label,
.dark-mode .beauty-label,
.dark-mode .processing-title,
.dark-mode .upload-text,
.dark-mode .option-chip .option-name,
.dark-mode .btn-secondary,
.dark-mode .btn-ghost {
  color: var(--text-inverse);
}

.dark-mode .hero-desc,
.dark-mode .step-item .step-label,
.dark-mode .upload-hint,
.dark-mode .option-chip .option-desc,
.dark-mode .color-item .color-name,
.dark-mode .beauty-hint,
.dark-mode .processing-hint {
  color: rgba(255, 255, 255, 0.68);
}

.steps-bar,
.upload-area,
.preview-card,
.option-chip,
.beauty-card,
.processing-card,
.result-card,
.btn-secondary,
.btn-ghost {
  background:
    linear-gradient(180deg, var(--apple-specular-soft) 0%, transparent 42%),
    linear-gradient(160deg, rgba(255, 255, 255, 0.78) 0%, rgba(241, 248, 243, 0.54) 100%);
  border: 1rpx solid rgba(255, 255, 255, 0.48);
  box-shadow: var(--apple-shadow-card);
}

.dark-mode .steps-bar,
.dark-mode .upload-area,
.dark-mode .preview-card,
.dark-mode .option-chip,
.dark-mode .beauty-card,
.dark-mode .processing-card,
.dark-mode .result-card,
.dark-mode .btn-secondary,
.dark-mode .btn-ghost {
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.08) 0%, transparent 42%),
    linear-gradient(160deg, rgba(18, 20, 28, 0.94) 0%, rgba(10, 12, 18, 0.9) 100%);
  border-color: rgba(255, 255, 255, 0.1);
}

.step-item.active .step-label {
  color: var(--primary);
}

.dark-mode .step-item.active .step-label {
  color: var(--primary);
}

.step-item.done .step-dot {
  background: linear-gradient(135deg, rgba(52, 199, 89, 0.88), rgba(101, 219, 138, 0.96));
  box-shadow: var(--apple-shadow-surface);
}

.preview-card {
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.18) 0%, transparent 42%),
    linear-gradient(160deg, rgba(248, 251, 249, 0.86) 0%, rgba(237, 243, 239, 0.76) 100%);
}

.dark-mode .preview-card {
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.08) 0%, transparent 42%),
    linear-gradient(160deg, rgba(18, 20, 28, 0.94) 0%, rgba(10, 12, 18, 0.9) 100%);
}

.color-item.active .color-circle {
  box-shadow: 0 0 0 4rpx rgba(52, 199, 89, 0.24);
}

.dark-mode .color-item.active .color-circle {
  box-shadow: 0 0 0 4rpx rgba(10, 132, 255, 0.28);
}

.processing-card .processing-spinner {
  border-color: rgba(52, 199, 89, 0.16);
  border-top-color: var(--success);
}

.dark-mode .processing-card .processing-spinner {
  border-color: rgba(10, 132, 255, 0.16);
  border-top-color: var(--primary);
}
</style>
