<!-- 统一空状态组件 v2.0：简单模式/引导模式/首页模式 -->
<template>
  <view :class="['empty-state', `empty-state--${theme}`, `empty-state--${size}`]">
    <!-- 装饰背景 -->
    <view v-if="showDecoration" class="empty-state__decoration">
      <view class="deco-circle deco-1" />
      <view class="deco-circle deco-2" />
      <view v-if="type === 'home'" class="deco-circle deco-3" />
    </view>

    <!-- 图标/动画区域 -->
    <view class="empty-state__icon" :class="{ 'animate-float': animated }">
      <text class="icon-emoji">
        {{ icon }}
      </text>
    </view>

    <!-- 标题 -->
    <text class="empty-state__title">
      {{ title }}
    </text>

    <!-- 描述 -->
    <text v-if="description" class="empty-state__desc">
      {{ description }}
    </text>

    <!-- 简单模式：单个按钮 -->
    <view v-if="type === 'simple' && showButton" class="empty-state__action">
      <view class="action-btn action-btn--primary" @tap="handleAction">
        <text v-if="buttonIcon" class="btn-icon">
          {{ buttonIcon }}
        </text>
        <text class="btn-text">
          {{ buttonText }}
        </text>
      </view>
    </view>

    <!-- 引导模式：单个引导按钮 -->
    <view v-if="type === 'guide' && showButton" class="empty-state__action">
      <view :class="['action-btn', theme === 'dark' ? 'action-btn--glow' : 'action-btn--primary']" @tap="handleAction">
        <text v-if="buttonIcon" class="btn-icon">
          {{ buttonIcon }}
        </text>
        <text class="btn-text">
          {{ buttonText }}
        </text>
      </view>
    </view>

    <!-- 首页模式：3个引导按钮 -->
    <view v-if="type === 'home'" class="empty-state__buttons">
      <view class="guide-btn guide-btn--primary" @tap="handleUpload">
        <view class="guide-btn__icon guide-btn__icon--green">
          <text>📤</text>
        </view>
        <view class="guide-btn__content">
          <text class="guide-btn__title"> 上传资料 </text>
          <text class="guide-btn__desc"> AI智能生成题库 </text>
        </view>
        <text class="guide-btn__arrow"> → </text>
      </view>

      <view class="guide-btn guide-btn--secondary" @tap="handleQuickStart">
        <view class="guide-btn__icon guide-btn__icon--orange">
          <text>⚡</text>
        </view>
        <view class="guide-btn__content">
          <text class="guide-btn__title"> 快速开始 </text>
          <text class="guide-btn__desc"> 体验示例题库 </text>
        </view>
        <text class="guide-btn__arrow"> → </text>
      </view>

      <view class="guide-btn guide-btn--tertiary" @tap="handleTutorial">
        <view class="guide-btn__icon guide-btn__icon--purple">
          <text>📖</text>
        </view>
        <view class="guide-btn__content">
          <text class="guide-btn__title"> 使用教程 </text>
          <text class="guide-btn__desc"> 3分钟快速上手 </text>
        </view>
        <text class="guide-btn__arrow"> → </text>
      </view>
    </view>

    <!-- 底部提示 -->
    <text v-if="hint" class="empty-state__hint">
      {{ hint }}
    </text>
  </view>
</template>

<script>
import { logger } from '@/utils/logger.js';
import { safeNavigateTo } from '@/utils/safe-navigate';
import storageService from '@/services/storageService.js';

export default {
  name: 'EmptyState',

  props: {
    /**
     * 组件类型
     * - simple: 简单空状态（默认）
     * - guide: 引导空状态
     * - home: 首页空状态（3个按钮）
     */
    type: {
      type: String,
      default: 'simple',
      validator: (v) => ['simple', 'guide', 'home'].includes(v)
    },

    /**
     * 主题
     * - light: 浅色主题
     * - dark: 深色主题
     * - auto: 跟随系统
     */
    theme: {
      type: String,
      default: 'light',
      validator: (v) => ['light', 'dark', 'auto'].includes(v)
    },

    /**
     * 尺寸
     * - small: 紧凑型
     * - medium: 标准型（默认）
     * - large: 大型
     */
    size: {
      type: String,
      default: 'medium',
      validator: (v) => ['small', 'medium', 'large'].includes(v)
    },

    // 图标（emoji）
    icon: {
      type: String,
      default: '📚'
    },

    // 标题
    title: {
      type: String,
      default: '暂无数据'
    },

    // 描述
    description: {
      type: String,
      default: ''
    },

    // 是否显示按钮
    showButton: {
      type: Boolean,
      default: true
    },

    // 按钮图标
    buttonIcon: {
      type: String,
      default: ''
    },

    // 按钮文案
    buttonText: {
      type: String,
      default: '立即添加'
    },

    // 底部提示
    hint: {
      type: String,
      default: ''
    },

    // 是否显示装饰
    showDecoration: {
      type: Boolean,
      default: true
    },

    // 是否启用动画
    animated: {
      type: Boolean,
      default: true
    }
  },

  emits: ['action', 'upload', 'quickStart', 'tutorial'],

  methods: {
    // 震动反馈
    vibrate() {
      try {
        if (typeof uni.vibrateShort === 'function') {
          uni.vibrateShort({ type: 'light' });
        }
      } catch (e) {
        logger.warn('[EmptyState] 震动反馈失败:', e.message || e);
      }
    },

    // 通用操作
    handleAction() {
      this.vibrate();
      this.$emit('action');
    },

    // 上传资料
    handleUpload() {
      this.vibrate();
      this.$emit('upload');
      safeNavigateTo('/pages/practice-sub/import-data');
    },

    // 快速开始
    handleQuickStart() {
      this.vibrate();
      this.$emit('quickStart');
      this.loadDemoQuestions();
    },

    // 查看教程
    handleTutorial() {
      this.vibrate();
      this.$emit('tutorial');

      uni.showModal({
        title: '📖 快速上手教程',
        content:
          '1. 上传学习资料（PDF/Word/图片）\n2. AI 自动提取知识点生成题目\n3. 开始刷题，错题自动收录\n4. 查看学习报告，持续进步',
        confirmText: '开始上传',
        cancelText: '稍后再说',
        success: (res) => {
          if (res.confirm) {
            this.handleUpload();
          }
        }
      });
    },

    // 加载示例题库
    async loadDemoQuestions() {
      uni.showLoading({ title: '加载示例题库...' });

      try {
        const demoQuestions = [
          {
            id: 'demo_1',
            question: '马克思主义哲学的直接理论来源是？',
            options: ['A. 德国古典哲学', 'B. 英国古典政治经济学', 'C. 法国空想社会主义', 'D. 古希腊哲学'],
            answer: 'A',
            analysis: '马克思主义哲学的直接理论来源是德国古典哲学，特别是黑格尔的辩证法和费尔巴哈的唯物主义。',
            category: '政治'
          },
          {
            id: 'demo_2',
            question: '下列选项中，属于唯物辩证法基本规律的是？',
            options: ['A. 质量互变规律', 'B. 因果规律', 'C. 形式逻辑规律', 'D. 价值规律'],
            answer: 'A',
            analysis: '唯物辩证法的三大基本规律是：对立统一规律、质量互变规律、否定之否定规律。',
            category: '政治'
          },
          {
            id: 'demo_3',
            question: '实践是检验真理的唯一标准，这是因为？',
            options: ['A. 实践具有直接现实性', 'B. 实践是认识的来源', 'C. 实践是认识的目的', 'D. 实践是认识发展的动力'],
            answer: 'A',
            analysis: '实践是检验真理的唯一标准，因为实践具有直接现实性的特点，能够把主观认识与客观实际联系起来。',
            category: '政治'
          }
        ];

        storageService.save('v30_bank', demoQuestions);
        uni.hideLoading();

        uni.showToast({
          title: '示例题库已加载',
          icon: 'success'
        });

        setTimeout(() => {
          uni.switchTab({
            url: '/pages/practice/index',
            fail: () => uni.reLaunch({ url: '/pages/practice/index' })
          });
        }, 1500);
      } catch (e) {
        uni.hideLoading();
        logger.error('[EmptyState] 加载示例题库失败:', e);
        uni.showToast({ title: '加载失败', icon: 'none' });
      }
    }
  }
};
</script>

<style lang="scss" scoped>
// ==================== 变量定义 ====================
$color-primary: #00a96d;
$color-primary-dark: #00e5ff;
$color-text-light: #1a1a1a;
$color-text-dark: #ffffff;
$color-text-secondary-light: #64748b;
$color-text-secondary-dark: rgba(255, 255, 255, 0.7);

// ==================== 主容器 ====================
.empty-state {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  border-radius: 24rpx;
  overflow: hidden;

  // 尺寸变体
  &--small {
    padding: 32rpx 24rpx;
    .empty-state__icon {
      width: 80rpx;
      height: 80rpx;
    }
    .icon-emoji {
      font-size: 48rpx;
    }
    .empty-state__title {
      font-size: 28rpx;
    }
    .empty-state__desc {
      font-size: 24rpx;
    }
  }

  &--medium {
    padding: 48rpx 32rpx;
    .empty-state__icon {
      width: 120rpx;
      height: 120rpx;
    }
    .icon-emoji {
      font-size: 64rpx;
    }
    .empty-state__title {
      font-size: 36rpx;
    }
    .empty-state__desc {
      font-size: 28rpx;
    }
  }

  &--large {
    padding: 64rpx 40rpx;
    .empty-state__icon {
      width: 160rpx;
      height: 160rpx;
    }
    .icon-emoji {
      font-size: 80rpx;
    }
    .empty-state__title {
      font-size: 40rpx;
    }
    .empty-state__desc {
      font-size: 30rpx;
    }
  }

  // 主题变体
  &--light {
    background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
    border: 1px solid rgba(0, 0, 0, 0.05);

    .empty-state__title {
      color: $color-text-light;
    }
    .empty-state__desc {
      color: $color-text-secondary-light;
    }
    .empty-state__hint {
      color: #94a3b8;
    }
  }

  &--dark {
    background: linear-gradient(135deg, rgba(30, 30, 30, 0.95) 0%, rgba(15, 15, 15, 0.98) 100%);
    border: 1px solid rgba(255, 255, 255, 0.1);

    .empty-state__title {
      color: $color-text-dark;
    }
    .empty-state__desc {
      color: $color-text-secondary-dark;
    }
    .empty-state__hint {
      color: rgba(255, 255, 255, 0.5);
    }
  }
}

// ==================== 装饰背景 ====================
.empty-state__decoration {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
  overflow: hidden;
}

.deco-circle {
  position: absolute;
  border-radius: 50%;
  opacity: 0.15;

  &.deco-1 {
    width: 200rpx;
    height: 200rpx;
    background: linear-gradient(135deg, #00e5ff, #00b8d4);
    top: -60rpx;
    right: -40rpx;
    animation: float 6s ease-in-out infinite;
  }

  &.deco-2 {
    width: 150rpx;
    height: 150rpx;
    background: linear-gradient(135deg, #9fe870, #4caf50);
    bottom: 100rpx;
    left: -30rpx;
    animation: float 5s ease-in-out infinite reverse;
  }

  &.deco-3 {
    width: 100rpx;
    height: 100rpx;
    background: linear-gradient(135deg, #ff6b6b, #ee5a24);
    top: 40%;
    right: 10%;
    animation: float 4s ease-in-out infinite;
  }
}

@keyframes float {
  0%,
  100% {
    transform: translateY(0) scale(1);
  }
  50% {
    transform: translateY(-20rpx) scale(1.05);
  }
}

// ==================== 图标区域 ====================
.empty-state__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 24rpx;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 50%;

  &.animate-float {
    animation: bounce 2s ease-in-out infinite;
  }
}

@keyframes bounce {
  0%,
  100% {
    transform: scale(1) translateY(0);
  }
  50% {
    transform: scale(1.1) translateY(-10rpx);
  }
}

// ==================== 文本区域 ====================
.empty-state__title {
  font-weight: 600;
  margin-bottom: 12rpx;
  text-align: center;
}

.empty-state__desc {
  text-align: center;
  line-height: 1.6;
  max-width: 500rpx;
  margin-bottom: 32rpx;
}

.empty-state__hint {
  font-size: 24rpx;
  margin-top: 24rpx;
  text-align: center;
}

// ==================== 简单/引导模式按钮 ====================
.empty-state__action {
  margin-top: 16rpx;
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20rpx 48rpx;
  border-radius: 40rpx;
  transition: all 0.3s ease;

  &:active {
    transform: scale(0.95);
  }

  &--primary {
    background: linear-gradient(135deg, $color-primary 0%, $color-primary-dark 100%);
    color: #ffffff;
    box-shadow: 0 4rpx 16rpx rgba(0, 169, 109, 0.3);
  }

  &--glow {
    background: linear-gradient(135deg, $color-primary-dark 0%, $color-primary-darker 100%);
    color: #000000;
    box-shadow: 0 0 20rpx rgba(0, 229, 255, 0.4);
  }

  .btn-icon {
    font-size: 28rpx;
    margin-right: 8rpx;
  }

  .btn-text {
    font-size: 28rpx;
    font-weight: 600;
  }
}

// ==================== 首页模式按钮 ====================
.empty-state__buttons {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 20rpx;
  margin-top: 16rpx;
}

.guide-btn {
  display: flex;
  align-items: center;
  padding: 24rpx;
  border-radius: 20rpx;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);

  &:active {
    transform: scale(0.98);
    opacity: 0.9;
  }

  &--primary {
    background: linear-gradient(135deg, $color-primary 0%, $color-primary-dark 100%);

    .guide-btn__title,
    .guide-btn__desc,
    .guide-btn__arrow {
      color: #ffffff;
    }

    .empty-state--dark & {
      box-shadow: 0 0 30rpx rgba(0, 169, 109, 0.4);
    }
  }

  &--secondary,
  &--tertiary {
    .empty-state--light & {
      background: #ffffff;
      border: 1px solid rgba(0, 0, 0, 0.1);

      .guide-btn__title {
        color: $color-text-light;
      }
      .guide-btn__desc {
        color: $color-text-secondary-light;
      }
      .guide-btn__arrow {
        color: #94a3b8;
      }
    }

    .empty-state--dark & {
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid rgba(255, 255, 255, 0.1);

      .guide-btn__title {
        color: $color-text-dark;
      }
      .guide-btn__desc {
        color: $color-text-secondary-dark;
      }
      .guide-btn__arrow {
        color: rgba(255, 255, 255, 0.4);
      }
    }
  }

  &__icon {
    width: 64rpx;
    height: 64rpx;
    border-radius: 16rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-right: 20rpx;
    font-size: 32rpx;

    &--green {
      background: rgba(255, 255, 255, 0.2);
    }
    &--orange {
      background: rgba(245, 158, 11, 0.15);
    }
    &--purple {
      background: rgba(139, 92, 246, 0.15);
    }
  }

  &__content {
    flex: 1;
  }

  &__title {
    display: block;
    font-size: 28rpx;
    font-weight: 600;
    margin-bottom: 4rpx;
  }

  &__desc {
    display: block;
    font-size: 22rpx;
  }

  &__arrow {
    font-size: 28rpx;
  }
}
</style>
