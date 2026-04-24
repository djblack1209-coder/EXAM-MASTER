<!-- 统一空状态组件 v2.0：简单模式/引导模式/首页模式 -->
<template>
  <view :class="['empty-state', `empty-state--${theme}`, `empty-state--${size}`]">
    <!-- 装饰背景 -->
    <view v-if="showDecoration" class="empty-state__decoration">
      <view class="deco-circle deco-1" />
      <view class="deco-circle deco-2" />
      <view v-if="type === 'home'" class="deco-circle deco-3" />
    </view>

    <!-- 图标/插图区域 -->
    <image
      v-if="effectiveIllustration"
      :src="effectiveIllustration"
      class="empty-state__illustration"
      mode="aspectFit"
      lazy-load
      :alt="title || '空状态插图'"
    />
    <view v-else class="empty-state__icon" :class="{ 'animate-float': animated }">
      <BaseIcon :name="icon" :size="80" />
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
          <BaseIcon name="upload" :size="36" />
        </view>
        <view class="guide-btn__content">
          <text class="guide-btn__title"> 上传资料 </text>
          <text class="guide-btn__desc"> 智能生成题库 </text>
        </view>
        <BaseIcon name="arrow-right" :size="24" class="guide-btn__arrow" />
      </view>

      <view class="guide-btn guide-btn--secondary" @tap="handleQuickStart">
        <view class="guide-btn__icon guide-btn__icon--orange">
          <BaseIcon name="lightning" :size="36" />
        </view>
        <view class="guide-btn__content">
          <text class="guide-btn__title"> 快速开始 </text>
          <text class="guide-btn__desc"> 体验示例题库 </text>
        </view>
        <BaseIcon name="arrow-right" :size="24" class="guide-btn__arrow" />
      </view>

      <view class="guide-btn guide-btn--tertiary" @tap="handleTutorial">
        <view class="guide-btn__icon guide-btn__icon--purple">
          <BaseIcon name="book" :size="36" />
        </view>
        <view class="guide-btn__content">
          <text class="guide-btn__title"> 使用教程 </text>
          <text class="guide-btn__desc"> 3分钟快速上手 </text>
        </view>
        <BaseIcon name="arrow-right" :size="24" class="guide-btn__arrow" />
      </view>
    </view>

    <!-- 底部提示 -->
    <text v-if="hint" class="empty-state__hint">
      {{ hint }}
    </text>
  </view>
</template>

<script setup>
import { ref, computed, onBeforeUnmount } from 'vue';
import { modal } from '@/utils/modal.js';
import { toast } from '@/utils/toast.js';
import { logger } from '@/utils/logger.js';
import { safeNavigateTo } from '@/utils/safe-navigate';
import storageService from '@/services/storageService.js';
import BaseIcon from '@/components/base/base-icon/base-icon.vue';
import { getAssetUrl } from '@/config/static-assets.js';

// ==================== Props 定义 ====================
const props = defineProps({
  /**
   * 组件类型
   * - simple: 简单空状态（默认）
   * - guide: 引导空状态
   * - home: 首页空状态（3个按钮）
   * - search: 搜索空状态
   */
  type: {
    type: String,
    default: 'simple',
    validator: (v) => ['simple', 'guide', 'home', 'search'].includes(v)
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

  // 图标名称（对应 BaseIcon 的 name）
  icon: {
    type: String,
    default: 'books'
  },

  // 插图路径（传入后替代图标显示）
  illustration: {
    type: String,
    default: ''
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
});

// ==================== Emits 定义 ====================
const emit = defineEmits(['action', 'upload', 'quickStart', 'tutorial']);

// ==================== 计算属性 ====================
/**
 * 根据组件类型自动匹配默认插图
 * 优先使用外部传入的 illustration prop，否则使用类型默认插图
 */
const effectiveIllustration = computed(() => {
  if (props.illustration) return props.illustration;
  const defaults = {
    home: getAssetUrl('illustrations', 'empty-journey'),
    search: getAssetUrl('illustrations', 'empty-search')
  };
  return defaults[props.type] || '';
});

// ==================== 响应式状态 ====================
/** 导航定时器ID */
const navTimerId = ref(null);

// ==================== 生命周期 ====================
onBeforeUnmount(() => {
  if (navTimerId.value) {
    clearTimeout(navTimerId.value);
    navTimerId.value = null;
  }
});

// ==================== 方法 ====================

// 震动反馈
function vibrate() {
  try {
    if (typeof uni.vibrateShort === 'function') {
      uni.vibrateShort({ type: 'light' });
    }
  } catch (e) {
    logger.warn('[EmptyState] 震动反馈失败:', e.message || e);
  }
}

// 通用操作
function handleAction() {
  vibrate();
  emit('action');
}

// 上传资料
function handleUpload() {
  vibrate();
  emit('upload');
  safeNavigateTo('/pages/practice-sub/import-data');
}

// 快速开始
function handleQuickStart() {
  vibrate();
  emit('quickStart');
  loadDemoQuestions();
}

// 查看教程
function handleTutorial() {
  vibrate();
  emit('tutorial');

  modal.show({
    title: '快速上手教程',
    content:
      '1. 上传学习资料（PDF/Word/图片）\n2. 智能自动提取知识点生成题目\n3. 开始刷题，错题自动收录\n4. 查看学习报告，持续进步',
    confirmText: '开始上传',
    cancelText: '稍后再说',
    success: (res) => {
      if (res.confirm) {
        handleUpload();
      }
    }
  });
}

// 加载示例题库
async function loadDemoQuestions() {
  toast.loading('加载示例题库...');

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
    toast.hide();

    toast.success('示例题库已加载');

    navTimerId.value = setTimeout(() => {
      uni.switchTab({
        url: '/pages/practice/index',
        fail: () => uni.reLaunch({ url: '/pages/practice/index' })
      });
    }, 1500);
  } catch (e) {
    toast.hide();
    logger.error('[EmptyState] 加载示例题库失败:', e);
    toast.info('加载失败');
  }
}
</script>

<style lang="scss" scoped>
/* ==================== Duolingo Design System 2.0 ==================== */

// 主色调变量
$duo-green: #58cc02;
$duo-green-dark: #46a302;
$duo-green-light: rgba(88, 204, 2, 0.1);
$duo-green-glow: rgba(88, 204, 2, 0.25);
$duo-title: var(--text-primary);
$duo-desc: var(--text-secondary);
$duo-hint: var(--text-tertiary, #c4c4c4);
$duo-radius: 28rpx;
$duo-btn-radius: 24rpx;
$duo-orange: var(--warning);
$duo-orange-dark: #e08600;
$duo-purple: var(--purple-light, #ce82ff);
$duo-purple-dark: #a855f7;

// ==================== 入场动画 ====================
@keyframes duo-bounce-in {
  0% {
    opacity: 0;
    transform: scale(0.3) translateY(40rpx);
  }
  50% {
    opacity: 1;
    transform: scale(1.08) translateY(-10rpx);
  }
  70% {
    transform: scale(0.95) translateY(4rpx);
  }
  100% {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

@keyframes duo-slide-up {
  0% {
    opacity: 0;
    transform: translateY(32rpx);
  }
  100% {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes duo-float {
  0%,
  100% {
    transform: translateY(0) scale(1);
  }
  50% {
    transform: translateY(-16rpx) scale(1.04);
  }
}

@keyframes duo-bounce-loop {
  0%,
  100% {
    transform: scale(1) translateY(0);
  }
  40% {
    transform: scale(1.08) translateY(-12rpx);
  }
  60% {
    transform: scale(0.97) translateY(4rpx);
  }
}

@keyframes duo-deco-drift {
  0%,
  100% {
    transform: translate(0, 0) rotate(0deg);
  }
  33% {
    transform: translate(10rpx, -14rpx) rotate(4deg);
  }
  66% {
    transform: translate(-8rpx, 8rpx) rotate(-3deg);
  }
}

// ==================== 主容器 ====================
.empty-state {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  border-radius: $duo-radius;
  overflow: hidden;

  // ---- 尺寸变体 ----
  &--small {
    padding: 32rpx 24rpx;

    .empty-state__icon {
      width: 96rpx;
      height: 96rpx;
      margin-bottom: 20rpx;
    }

    .empty-state__title {
      font-size: 32rpx;
    }

    .empty-state__desc {
      font-size: 24rpx;
    }
  }

  &--medium {
    padding: 48rpx 36rpx;

    .empty-state__icon {
      width: 136rpx;
      height: 136rpx;
      margin-bottom: 28rpx;
    }

    .empty-state__title {
      font-size: 44rpx;
    }

    .empty-state__desc {
      font-size: 28rpx;
    }
  }

  &--large {
    padding: 64rpx 44rpx;

    .empty-state__icon {
      width: 176rpx;
      height: 176rpx;
      margin-bottom: 36rpx;
    }

    .empty-state__title {
      font-size: 48rpx;
    }

    .empty-state__desc {
      font-size: 30rpx;
    }
  }

  // ---- 浅色主题 ----
  &--light {
    background: var(--bg-card);
    border: 2rpx solid var(--border, #e5e5e5);
    box-shadow:
      0 4rpx 0 var(--border, #e5e5e5),
      0 12rpx 32rpx rgba(0, 0, 0, 0.06);

    .empty-state__title {
      color: $duo-title;
    }

    .empty-state__desc {
      color: $duo-desc;
    }

    .empty-state__hint {
      color: var(--text-tertiary, #c4c4c4);
    }
  }

  // ---- 深色主题 ----
  &--dark {
    background: var(--bg-card, #1f1f1f);
    border: 2rpx solid var(--border, #3a3a3a);
    box-shadow:
      0 4rpx 0 rgba(0, 0, 0, 0.3),
      0 12rpx 32rpx rgba(0, 0, 0, 0.3);

    .empty-state__title {
      // [P0修复] 原值 var(--bg-secondary) 是背景色变量，暗色下解析为深色→文字不可见
      color: var(--text-primary, #f0f0f0);
    }

    .empty-state__desc {
      color: var(--text-sub, rgba(255, 255, 255, 0.6));
    }

    .empty-state__hint {
      color: var(--text-tertiary, rgba(255, 255, 255, 0.4));
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
  opacity: 0.5;

  &.deco-1 {
    width: 180rpx;
    height: 180rpx;
    background: $duo-green-light;
    top: -50rpx;
    right: -30rpx;
    animation: duo-deco-drift 8s ease-in-out infinite;
  }

  &.deco-2 {
    width: 140rpx;
    height: 140rpx;
    background: rgba(88, 204, 2, 0.06);
    bottom: 80rpx;
    left: -40rpx;
    animation: duo-deco-drift 6s ease-in-out infinite reverse;
  }

  &.deco-3 {
    width: 100rpx;
    height: 100rpx;
    background: rgba(255, 150, 0, 0.08);
    top: 40%;
    right: 12%;
    animation: duo-deco-drift 7s ease-in-out infinite 1s;
  }
}

// 深色装饰覆盖
.empty-state--dark .deco-circle.deco-1 {
  background: rgba(88, 204, 2, 0.08);
}

.empty-state--dark .deco-circle.deco-2 {
  background: rgba(88, 204, 2, 0.04);
}

.empty-state--dark .deco-circle.deco-3 {
  background: rgba(255, 150, 0, 0.06);
}

// ==================== 图标区域 ====================
.empty-state__illustration {
  width: 320rpx;
  height: 260rpx;
  margin-bottom: 32rpx;
}

.empty-state__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: $duo-green-light;
  border: 3rpx solid rgba(88, 204, 2, 0.15);
  animation: duo-bounce-in 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) both;

  &.animate-float {
    animation:
      duo-bounce-in 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) both,
      duo-bounce-loop 3s ease-in-out 0.8s infinite;
  }
}

// 深色图标背景
.empty-state--dark .empty-state__icon {
  background: rgba(88, 204, 2, 0.12);
  border-color: rgba(88, 204, 2, 0.2);
}

// ==================== 文本区域 ====================
.empty-state__title {
  font-weight: 800;
  text-align: center;
  margin-bottom: 12rpx;
  letter-spacing: 0.5rpx;
  animation: duo-slide-up 0.5s ease-out 0.25s both;
}

.empty-state__desc {
  font-weight: 500;
  text-align: center;
  line-height: 1.6;
  max-width: 500rpx;
  margin-bottom: 36rpx;
  animation: duo-slide-up 0.5s ease-out 0.4s both;
}

.empty-state__hint {
  font-size: 24rpx;
  font-weight: 500;
  margin-top: 28rpx;
  text-align: center;
  animation: duo-slide-up 0.5s ease-out 0.6s both;
}

// ==================== 简单/引导模式按钮 ====================
.empty-state__action {
  margin-top: 20rpx;
  animation: duo-slide-up 0.5s ease-out 0.55s both;
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 22rpx 56rpx;
  border-radius: $duo-btn-radius;
  transition: transform 0.12s ease;
  position: relative;

  // 3D Duolingo 按钮 - 浅色
  &--primary {
    background: $duo-green;
    color: var(--text-inverse);
    border: none;
    box-shadow: 0 8rpx 0 $duo-green-dark;

    &:active {
      transform: translateY(6rpx);
      box-shadow: 0 2rpx 0 $duo-green-dark;
    }
  }

  // 深色主题发光按钮
  &--glow {
    background: $duo-green;
    color: var(--text-inverse);
    border: none;
    box-shadow:
      0 8rpx 0 $duo-green-dark,
      0 0 24rpx $duo-green-glow;

    &:active {
      transform: translateY(6rpx);
      box-shadow:
        0 2rpx 0 $duo-green-dark,
        0 0 16rpx $duo-green-glow;
    }
  }

  .btn-icon {
    font-size: 30rpx;
    margin-right: 10rpx;
  }

  .btn-text {
    font-size: 30rpx;
    font-weight: 700;
    letter-spacing: 1rpx;
  }
}

// ==================== 首页模式按钮 ====================
.empty-state__buttons {
  width: 100%;
  display: flex;
  flex-direction: column;
  margin-top: 20rpx;
}

.guide-btn {
  display: flex;
  align-items: center;
  padding: 28rpx;
  border-radius: $duo-btn-radius;
  transition: transform 0.12s ease;
  position: relative;
  margin-bottom: 16rpx;
  animation: duo-slide-up 0.5s ease-out both;

  &:last-child {
    margin-bottom: 0;
  }

  // 交错入场延迟
  &:nth-child(1) {
    animation-delay: 0.45s;
  }
  &:nth-child(2) {
    animation-delay: 0.55s;
  }
  &:nth-child(3) {
    animation-delay: 0.65s;
  }

  // ---- 主按钮（上传资料）3D绿色 ----
  &--primary {
    background: $duo-green;
    border: none;
    box-shadow: 0 6rpx 0 $duo-green-dark;

    &:active {
      transform: translateY(4rpx);
      box-shadow: 0 2rpx 0 $duo-green-dark;
    }

    .guide-btn__title,
    .guide-btn__arrow {
      color: var(--text-inverse);
    }

    .guide-btn__desc {
      color: rgba(255, 255, 255, 0.8);
    }
  }

  // ---- 次要按钮（快速开始 / 教程）----
  &--secondary,
  &--tertiary {
    .empty-state--light & {
      background: var(--bg-secondary, #f7f7f7);
      border: 2rpx solid var(--border, #e5e5e5);
      box-shadow: 0 4rpx 0 var(--border, #e5e5e5);

      &:active {
        transform: translateY(3rpx);
        box-shadow: 0 1rpx 0 var(--border, #e5e5e5);
      }

      .guide-btn__title {
        color: $duo-title;
      }

      .guide-btn__desc {
        color: $duo-desc;
      }

      .guide-btn__arrow {
        color: var(--text-tertiary, #c4c4c4);
      }
    }

    .empty-state--dark & {
      background: var(--muted, #2a2a2a);
      border: 2rpx solid var(--border, #3a3a3a);
      box-shadow: 0 4rpx 0 rgba(0, 0, 0, 0.3);

      &:active {
        transform: translateY(3rpx);
        box-shadow: 0 1rpx 0 rgba(0, 0, 0, 0.3);
      }

      .guide-btn__title {
        // [P0修复] 原值 var(--bg-secondary) 是背景色变量→暗色下文字不可见
        color: var(--text-primary, #f0f0f0);
      }

      .guide-btn__desc {
        color: var(--text-sub, rgba(255, 255, 255, 0.6));
      }

      .guide-btn__arrow {
        color: var(--text-tertiary, rgba(255, 255, 255, 0.3));
      }
    }
  }

  // ---- 图标区域 ----
  &__icon {
    width: 72rpx;
    height: 72rpx;
    border-radius: 20rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-right: 20rpx;

    &--green {
      background: rgba(255, 255, 255, 0.25);
    }

    &--orange {
      background: rgba(255, 150, 0, 0.12);
    }

    &--purple {
      background: rgba(206, 130, 255, 0.12);
    }
  }

  &__content {
    flex: 1;
  }

  &__title {
    display: block;
    font-size: 30rpx;
    font-weight: 700;
    margin-bottom: 4rpx;
    letter-spacing: 0.5rpx;
  }

  &__desc {
    display: block;
    font-size: 24rpx;
    font-weight: 500;
  }

  &__arrow {
    font-size: 28rpx;
  }
}

// 深色主题主按钮发光
.empty-state--dark .guide-btn--primary {
  box-shadow:
    0 6rpx 0 $duo-green-dark,
    0 0 20rpx $duo-green-glow;

  &:active {
    box-shadow:
      0 2rpx 0 $duo-green-dark,
      0 0 12rpx $duo-green-glow;
  }
}

// 深色主题图标覆盖
.empty-state--dark .guide-btn__icon--green {
  background: rgba(88, 204, 2, 0.2);
}

.empty-state--dark .guide-btn__icon--orange {
  background: rgba(255, 150, 0, 0.15);
}

.empty-state--dark .guide-btn__icon--purple {
  background: rgba(206, 130, 255, 0.15);
}
</style>
