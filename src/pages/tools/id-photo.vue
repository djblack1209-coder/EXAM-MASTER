<template>
  <view :class="['page-container', { 'dark-mode': isDark }]">
    <!-- 自定义导航栏 -->
    <view class="nav-header" :style="{ paddingTop: statusBarHeight + 'px' }">
      <view class="nav-content">
        <view class="nav-back" @tap="goBack">
          <text class="back-icon">
            ←
          </text>
        </view>
        <text class="nav-title">
          证件照制作
        </text>
        <view class="nav-placeholder" />
      </view>
    </view>

    <!-- 主内容 -->
    <scroll-view scroll-y class="main-scroll" :style="{ paddingTop: statusBarHeight + 50 + 'px' }">
      <!-- 顶部描述卡片 -->
      <view class="hero-card">
        <view class="hero-icon-wrapper">
          <text class="hero-icon">
            📷
          </text>
        </view>
        <text class="hero-title">
          智能证件照
        </text>
        <text class="hero-desc">
          智能抠图换背景，支持多种证件照尺寸
        </text>
      </view>

      <!-- 步骤指示器 -->
      <view class="steps-bar">
        <view v-for="(s, i) in steps" :key="i" :class="['step-item', { active: step >= i, done: step > i }]">
          <view class="step-dot">
            <text v-if="step > i" class="step-check">
              ✓
            </text>
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
        <view class="upload-area" @click="choosePhoto">
          <view class="upload-icon-box">
            <text class="upload-icon-text">
              +
            </text>
          </view>
          <text class="upload-text">
            选择或拍摄照片
          </text>
          <text class="upload-hint">
            建议正面免冠、光线均匀
          </text>
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
          <text class="config-label">
            证件照尺寸
          </text>
          <view class="option-grid">
            <view
              v-for="s in sizeOptions"
              :key="s.key"
              :class="['option-chip', { active: selectedSize === s.key }]"
              @click="selectedSize = s.key"
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
          <text class="config-label">
            背景颜色
          </text>
          <view class="color-row">
            <view
              v-for="c in colorOptions"
              :key="c.key"
              :class="['color-item', { active: selectedColor === c.key }]"
              @click="selectedColor = c.key"
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
            <text class="beauty-label">
              智能美颜
            </text>
            <text class="beauty-hint">
              自动优化肤色与光线
            </text>
          </view>
          <switch :checked="enableBeauty" color="#e84393" @change="enableBeauty = $event.detail.value" />
        </view>

        <button class="btn-primary" hover-class="btn-hover" @click="startProcess">
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
          <text class="processing-hint">
            AI 正在处理您的照片...
          </text>
        </view>
      </view>

      <!-- Step 3: 结果 -->
      <view v-else-if="step === 3" class="section">
        <view class="result-card">
          <image :src="resultImage" mode="aspectFit" class="result-img" />
        </view>
        <view class="result-actions">
          <button class="btn-primary" hover-class="btn-hover" @click="saveResult">
            <text>保存到相册</text>
          </button>
          <button class="btn-secondary" hover-class="btn-hover" @click="changeColor">
            <text>换个颜色</text>
          </button>
          <button class="btn-ghost" hover-class="btn-hover" @click="resetAll">
            <text>重新制作</text>
          </button>
        </view>
      </view>

      <view class="bottom-safe" />
    </scroll-view>
  </view>
</template>

<script>
import { lafService } from '@/services/lafService.js';
import { logger } from '@/utils/logger.js';
import { initTheme, onThemeUpdate, offThemeUpdate } from '@/composables/useTheme.js';
import { getStatusBarHeight } from '@/utils/core/system.js';

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

export default {
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
      foregroundBase64: ''
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
        const res = await lafService.getPhotoConfig();
        if (res.code === 0 && res.data) {
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

    choosePhoto() {
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
            uni.showToast({ title: '选择照片失败', icon: 'none' });
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
          uni.showToast({ title: '读取照片失败', icon: 'none' });
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
      img.onerror = () => uni.showToast({ title: '加载照片失败', icon: 'none' });
      img.src = path;
      // #endif
    },

    async startProcess() {
      this.step = 2;
      this.processingText = '正在智能抠图...';

      try {
        const res = await lafService.processIdPhoto(this.imageBase64, this.selectedColor, this.selectedSize, {
          beauty: this.enableBeauty
        });

        if (res.code === 0 && res.data) {
          const resultBase64 = res.data.resultImage || res.data.image;
          if (resultBase64) {
            this.resultImage = `data:image/png;base64,${resultBase64}`;
            if (res.data.foreground) {
              this.foregroundBase64 = res.data.foreground;
            }
            this.step = 3;
          } else {
            throw new Error('未返回处理结果');
          }
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

    async changeColor() {
      this.step = 1;
    },

    saveResult() {
      if (!this.resultImage) return;

      // #ifdef MP-WEIXIN
      const base64Data = this.resultImage.replace(/^data:image\/\w+;base64,/, '');
      const filePath = `${wx.env.USER_DATA_PATH}/id_photo_${Date.now()}.png`;

      uni.getFileSystemManager().writeFile({
        filePath,
        data: base64Data,
        encoding: 'base64',
        success: () => {
          uni.saveImageToPhotosAlbum({
            filePath,
            success: () => {
              uni.showToast({ title: '已保存到相册', icon: 'success' });
            },
            fail: (err) => {
              if (err.errMsg && err.errMsg.includes('auth deny')) {
                uni.showModal({
                  title: '提示',
                  content: '需要相册权限才能保存，是否前往设置？',
                  success: (r) => {
                    if (r.confirm) uni.openSetting();
                  }
                });
              } else {
                uni.showToast({ title: '保存失败', icon: 'none' });
              }
            }
          });
        },
        fail: () => {
          uni.showToast({ title: '保存失败', icon: 'none' });
        }
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
  background: linear-gradient(135deg, rgba(232, 67, 147, 0.08) 0%, rgba(253, 121, 168, 0.08) 100%);
  border-radius: 24rpx;
  border: 1rpx solid rgba(232, 67, 147, 0.12);

  .hero-icon-wrapper {
    width: 100rpx;
    height: 100rpx;
    border-radius: 28rpx;
    background: linear-gradient(135deg, #e84393, #fd79a8);
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 20rpx;
    box-shadow: 0 8rpx 24rpx rgba(232, 67, 147, 0.3);
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
  background: var(--bg-card, #fff);
  border-radius: 20rpx;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.04);
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
    background: var(--bg-secondary, #f5f5f7);
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 8rpx;
    transition: all 0.3s ease;
  }

  .step-num {
    font-size: 22rpx;
    color: var(--text-secondary, #666);
    font-weight: 600;
  }

  .step-check {
    font-size: 22rpx;
    color: #fff;
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
      background: #e84393;
    }
  }

  &.active {
    .step-dot {
      background: linear-gradient(135deg, #e84393, #fd79a8);
      box-shadow: 0 4rpx 12rpx rgba(232, 67, 147, 0.3);
    }

    .step-num {
      color: #fff;
    }

    .step-label {
      color: #e84393;
      font-weight: 600;
    }
  }

  &.done .step-dot {
    background: linear-gradient(135deg, #34c759, #30d158);
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
  background: var(--bg-card, #fff);
  border: 2rpx dashed rgba(232, 67, 147, 0.35);
  border-radius: 20rpx;
  padding: 80rpx 30rpx;
  display: flex;
  flex-direction: column;
  align-items: center;

  .upload-icon-box {
    width: 96rpx;
    height: 96rpx;
    border-radius: 50%;
    background: linear-gradient(135deg, rgba(232, 67, 147, 0.1), rgba(253, 121, 168, 0.1));
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 20rpx;
  }

  .upload-icon-text {
    font-size: 56rpx;
    color: #e84393;
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
  background: #000;
  border-radius: 20rpx;
  overflow: hidden;
  margin-bottom: 24rpx;
  display: flex;
  justify-content: center;

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
  gap: 12rpx;
}

.option-chip {
  padding: 16rpx 24rpx;
  background: var(--bg-card, #fff);
  border-radius: 16rpx;
  border: 2rpx solid transparent;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.04);
  transition: all 0.25s ease;

  &.active {
    border-color: #e84393;
    background: rgba(232, 67, 147, 0.06);
    box-shadow: 0 4rpx 12rpx rgba(232, 67, 147, 0.15);
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
  gap: 24rpx;
  flex-wrap: wrap;
}

.color-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8rpx;

  .color-circle {
    width: 64rpx;
    height: 64rpx;
    border-radius: 50%;
    border: 2rpx solid rgba(0, 0, 0, 0.08);
    transition: all 0.25s ease;
  }

  &.active .color-circle {
    box-shadow: 0 0 0 4rpx #e84393;
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
  background: var(--bg-card, #fff);
  padding: 24rpx;
  border-radius: 20rpx;
  margin-bottom: 32rpx;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.04);

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
  background: var(--bg-card, #fff);
  border-radius: 24rpx;
  box-shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.06);
  width: 100%;

  .processing-spinner {
    width: 80rpx;
    height: 80rpx;
    border: 6rpx solid rgba(232, 67, 147, 0.15);
    border-top-color: #e84393;
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
  background: var(--bg-card, #fff);
  border-radius: 20rpx;
  overflow: hidden;
  display: flex;
  justify-content: center;
  margin-bottom: 32rpx;
  box-shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.06);

  .result-img {
    width: 100%;
    height: 500rpx;
  }
}

.result-actions {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

// 按钮
.btn-primary {
  background: linear-gradient(135deg, #e84393 0%, #fd79a8 100%);
  color: #fff;
  border: none;
  padding: 24rpx;
  border-radius: 50rpx;
  font-size: 30rpx;
  font-weight: 600;
  text-align: center;
  box-shadow: 0 8rpx 24rpx rgba(232, 67, 147, 0.25);

  &::after {
    border: none;
  }
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

.btn-ghost {
  background: transparent;
  color: var(--text-secondary, #666);
  border: none;
  padding: 20rpx;
  font-size: 26rpx;
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
    background: linear-gradient(135deg, rgba(232, 67, 147, 0.15) 0%, rgba(253, 121, 168, 0.15) 100%);
    border-color: rgba(232, 67, 147, 0.25);
  }

  .steps-bar {
    background: var(--bg-card, #0d1117);
    box-shadow: none;
  }

  .step-item .step-dot {
    background: var(--bg-secondary, #1c1c1e);
  }

  .upload-area {
    background: var(--bg-card, #0d1117);
    border-color: rgba(232, 67, 147, 0.25);
  }

  .option-chip {
    background: var(--bg-card, #0d1117);
    box-shadow: none;

    &.active {
      background: rgba(232, 67, 147, 0.12);
    }
  }

  .color-item .color-circle {
    border-color: rgba(255, 255, 255, 0.12);
  }

  .beauty-card {
    background: var(--bg-card, #0d1117);
    box-shadow: none;
  }

  .processing-card {
    background: var(--bg-card, #0d1117);
    box-shadow: none;
  }

  .result-card {
    background: var(--bg-card, #0d1117);
    box-shadow: none;
  }

  .preview-card {
    background: #000;
  }

  .btn-secondary {
    background: var(--bg-card, #0d1117);
    border-color: rgba(255, 255, 255, 0.1);
  }
}

.bottom-safe {
  height: 120rpx;
}
</style>
