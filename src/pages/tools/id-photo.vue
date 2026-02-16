<template>
  <view class="id-photo-container">
    <!-- 顶部标题栏 -->
    <view class="header">
      <text class="title">
        证件照制作
      </text>
      <text class="subtitle">
        智能抠图换背景，支持多种证件照尺寸
      </text>
    </view>

    <!-- 步骤指示器 -->
    <view class="steps">
      <view v-for="(s, i) in steps" :key="i" :class="['step', { active: step >= i, done: step > i }]">
        <text class="step-num">
          {{ step > i ? '✓' : i + 1 }}
        </text>
        <text class="step-label">
          {{ s }}
        </text>
      </view>
    </view>

    <!-- Step 0: 上传照片 -->
    <view v-if="step === 0" class="step-content">
      <view class="upload-area" @click="choosePhoto">
        <text class="upload-icon">
          +
        </text>
        <text class="upload-text">
          选择或拍摄照片
        </text>
        <text class="upload-hint">
          建议正面免冠、光线均匀
        </text>
      </view>
    </view>

    <!-- Step 1: 选择配置 -->
    <view v-else-if="step === 1" class="step-content">
      <!-- 预览 -->
      <view class="preview-box">
        <image :src="previewSrc" mode="aspectFit" class="preview-img" />
      </view>

      <!-- 尺寸选择 -->
      <view class="config-section">
        <text class="config-title">
          证件照尺寸
        </text>
        <view class="option-grid">
          <view
            v-for="s in sizeOptions"
            :key="s.key"
            :class="['option-item', { active: selectedSize === s.key }]"
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
      <view class="config-section">
        <text class="config-title">
          背景颜色
        </text>
        <view class="color-grid">
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
      <view class="config-section beauty-row">
        <text class="config-title">
          智能美颜
        </text>
        <switch :checked="enableBeauty" color="#e84393" @change="enableBeauty = $event.detail.value" />
      </view>

      <button class="btn-primary" hover-class="btn-hover" @click="startProcess">
        <text>开始制作</text>
      </button>
    </view>

    <!-- Step 2: 处理中 -->
    <view v-else-if="step === 2" class="step-content center">
      <view class="processing">
        <view class="processing-spinner" />
        <text class="processing-text">
          {{ processingText }}
        </text>
        <text class="processing-hint">
          AI 正在处理您的照片...
        </text>
      </view>
    </view>

    <!-- Step 3: 结果 -->
    <view v-else-if="step === 3" class="step-content">
      <view class="result-preview">
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
  </view>
</template>

<script>
import { lafService } from '@/services/lafService.js';
import { logger } from '@/utils/logger.js';

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
      steps: ['上传照片', '选择配置', '处理中', '完成'],
      step: 0,
      previewSrc: '',
      imageBase64: '',
      sizeOptions: DEFAULT_SIZES,
      colorOptions: DEFAULT_COLORS,
      selectedSize: '1inch',
      selectedColor: 'blue',
      enableBeauty: false,
      processingText: '正在抠图...',
      resultImage: '',
      // 缓存抠图结果，换颜色时不用重新抠图
      foregroundBase64: ''
    };
  },

  onLoad() {
    this.loadConfig();
  },

  methods: {
    async loadConfig() {
      try {
        const res = await lafService.getPhotoConfig();
        if (res.code === 0 && res.data) {
          if (res.data.sizes) {
            this.sizeOptions = Object.entries(res.data.sizes).map(([key, v]) => ({
              key, name: v.name, desc: v.desc
            }));
          }
          if (res.data.colors) {
            this.colorOptions = Object.entries(res.data.colors).map(([key, v]) => ({
              key, name: v.name, hex: v.hex
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
        const res = await lafService.processIdPhoto(
          this.imageBase64,
          this.selectedColor,
          this.selectedSize,
          { beauty: this.enableBeauty }
        );

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
      // 回到配置步骤让用户选新颜色，保留已有数据
      this.step = 1;
    },

    saveResult() {
      if (!this.resultImage) return;

      // #ifdef MP-WEIXIN
      // 先将 base64 写入临时文件
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
                  success: (r) => { if (r.confirm) uni.openSetting(); }
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
.id-photo-container {
  min-height: 100vh;
  background: var(--bg-secondary);
  display: flex;
  flex-direction: column;
}

.header {
  padding: 30rpx;
  background: linear-gradient(135deg, #e84393 0%, #fd79a8 100%);
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

.steps {
  display: flex;
  padding: 24rpx 30rpx;
  background: var(--bg-card);
  gap: 8rpx;

  .step {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    opacity: 0.4;

    &.active { opacity: 1; }
    &.done { opacity: 0.7; }

    .step-num {
      width: 44rpx;
      height: 44rpx;
      border-radius: 50%;
      background: var(--bg-secondary);
      color: var(--text-sub);
      font-size: 24rpx;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    &.active .step-num {
      background: #e84393;
      color: #fff;
    }

    &.done .step-num {
      background: #4CAF50;
      color: #fff;
    }

    .step-label {
      font-size: 20rpx;
      color: var(--text-sub);
      margin-top: 6rpx;
    }
  }
}

.step-content {
  flex: 1;
  padding: 20rpx;

  &.center {
    display: flex;
    align-items: center;
    justify-content: center;
  }
}

.upload-area {
  background: var(--bg-card);
  border: 2rpx dashed var(--text-sub);
  border-radius: 16rpx;
  padding: 100rpx 30rpx;
  display: flex;
  flex-direction: column;
  align-items: center;

  .upload-icon {
    font-size: 80rpx;
    color: #e84393;
    line-height: 1;
  }

  .upload-text {
    font-size: 30rpx;
    color: var(--text-main);
    margin-top: 20rpx;
  }

  .upload-hint {
    font-size: 24rpx;
    color: var(--text-sub);
    margin-top: 10rpx;
  }
}

.preview-box {
  background: #000;
  border-radius: 16rpx;
  overflow: hidden;
  margin-bottom: 24rpx;
  display: flex;
  justify-content: center;

  .preview-img {
    width: 100%;
    height: 400rpx;
  }
}

.config-section {
  margin-bottom: 24rpx;

  .config-title {
    font-size: 28rpx;
    font-weight: 600;
    color: var(--text-main);
    margin-bottom: 16rpx;
    display: block;
  }
}

.option-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
}

.option-item {
  padding: 16rpx 24rpx;
  background: var(--bg-card);
  border-radius: 12rpx;
  border: 2rpx solid transparent;

  &.active {
    border-color: #e84393;
    background: rgba(232, 67, 147, 0.08);
  }

  .option-name {
    font-size: 26rpx;
    color: var(--text-main);
    display: block;
  }

  .option-desc {
    font-size: 20rpx;
    color: var(--text-sub);
  }
}

.color-grid {
  display: flex;
  gap: 24rpx;
  flex-wrap: wrap;
}

.color-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8rpx;

  &.active .color-circle {
    box-shadow: 0 0 0 4rpx #e84393;
  }

  .color-circle {
    width: 64rpx;
    height: 64rpx;
    border-radius: 50%;
    border: 2rpx solid #ddd;
  }

  .color-name {
    font-size: 20rpx;
    color: var(--text-sub);
  }
}

.beauty-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--bg-card);
  padding: 20rpx 24rpx;
  border-radius: 12rpx;
  margin-bottom: 30rpx;

  .config-title {
    margin-bottom: 0;
  }
}

.processing {
  display: flex;
  flex-direction: column;
  align-items: center;

  .processing-spinner {
    width: 80rpx;
    height: 80rpx;
    border: 6rpx solid rgba(232, 67, 147, 0.2);
    border-top-color: #e84393;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  .processing-text {
    font-size: 30rpx;
    color: var(--text-main);
    margin-top: 24rpx;
  }

  .processing-hint {
    font-size: 24rpx;
    color: var(--text-sub);
    margin-top: 10rpx;
  }
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.result-preview {
  background: #f0f0f0;
  border-radius: 16rpx;
  overflow: hidden;
  display: flex;
  justify-content: center;
  margin-bottom: 30rpx;

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

.btn-primary {
  background: linear-gradient(135deg, #e84393 0%, #fd79a8 100%);
  color: #fff;
  border: none;
  padding: 24rpx;
  border-radius: 50rpx;
  font-size: 30rpx;
  text-align: center;

  &::after { border: none; }
}

.btn-secondary {
  background: var(--bg-card);
  color: var(--text-main);
  border: none;
  padding: 24rpx;
  border-radius: 50rpx;
  font-size: 28rpx;
  text-align: center;

  &::after { border: none; }
}

.btn-ghost {
  background: transparent;
  color: var(--text-sub);
  border: none;
  padding: 20rpx;
  font-size: 26rpx;
  text-align: center;

  &::after { border: none; }
}
</style>
