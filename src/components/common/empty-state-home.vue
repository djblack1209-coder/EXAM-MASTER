/**
 * 首页空状态组件 - 增强版
 * 解决检查点1.1：空状态仅显示"暂无数据"文字问题
 * 
 * 功能：
 * 1. Lottie 动画展示
 * 2. 3个引导按钮（上传资料、快速练习、查看教程）
 * 3. 支持深色/浅色模式
 * 4. 新用户引导流程
 */
<template>
  <view :class="['empty-state-home', isDark ? 'state-dark' : 'state-light']">
    <!-- 装饰背景 -->
    <view class="decoration-layer">
      <view class="deco-circle deco-1"></view>
      <view class="deco-circle deco-2"></view>
      <view class="deco-circle deco-3"></view>
    </view>
    
    <!-- Lottie 动画区域 -->
    <view class="animation-wrapper">
      <!-- 使用 uni-app 的 animation 组件或 canvas 实现 Lottie -->
      <view class="lottie-placeholder" :class="{ 'animate-float': !isLoading }">
        <text class="lottie-emoji">{{ animationEmoji }}</text>
      </view>
      <!-- 实际 Lottie 动画（需要引入 lottie-miniprogram） -->
      <!-- <canvas type="2d" id="lottie-canvas" class="lottie-canvas"></canvas> -->
    </view>
    
    <!-- 标题区域 -->
    <view class="title-section">
      <text class="main-title">{{ title }}</text>
      <text class="sub-title">{{ subtitle }}</text>
    </view>
    
    <!-- 3个引导按钮 -->
    <view class="guide-buttons">
      <view 
        class="guide-btn btn-primary"
        :class="{ 'btn-glow': isDark }"
        @tap="handleUpload"
      >
        <view class="btn-icon-wrapper">
          <text class="btn-icon">📤</text>
        </view>
        <view class="btn-content">
          <text class="btn-title">上传资料</text>
          <text class="btn-desc">AI智能生成题库</text>
        </view>
        <text class="btn-arrow">→</text>
      </view>
      
      <view 
        class="guide-btn btn-secondary"
        @tap="handleQuickStart"
      >
        <view class="btn-icon-wrapper icon-orange">
          <text class="btn-icon">⚡</text>
        </view>
        <view class="btn-content">
          <text class="btn-title">快速开始</text>
          <text class="btn-desc">体验示例题库</text>
        </view>
        <text class="btn-arrow">→</text>
      </view>
      
      <view 
        class="guide-btn btn-tertiary"
        @tap="handleTutorial"
      >
        <view class="btn-icon-wrapper icon-purple">
          <text class="btn-icon">📖</text>
        </view>
        <view class="btn-content">
          <text class="btn-title">使用教程</text>
          <text class="btn-desc">3分钟快速上手</text>
        </view>
        <text class="btn-arrow">→</text>
      </view>
    </view>
    
    <!-- 底部提示 -->
    <view class="footer-hint">
      <text class="hint-text">{{ hint }}</text>
    </view>
  </view>
</template>

<script>
// 引入引导流程管理
import { onboardingFlow } from '../../utils/onboarding-flow.js';
// ✅ 统一日志工具（生产环境自动禁用）
import { logger } from '../../utils/logger.js';

export default {
  name: 'EmptyStateHome',
  
  props: {
    // 标题
    title: {
      type: String,
      default: '开启你的学习之旅'
    },
    // 副标题
    subtitle: {
      type: String,
      default: '上传学习资料，AI 将为你智能生成专属题库'
    },
    // 底部提示
    hint: {
      type: String,
      default: '支持 PDF、Word、图片等多种格式'
    },
    // 动画 emoji（Lottie 加载前的占位）
    animationEmoji: {
      type: String,
      default: '🚀'
    },
    // 深色模式
    isDark: {
      type: Boolean,
      default: false
    },
    // Lottie 动画 URL
    lottieUrl: {
      type: String,
      default: ''
    }
  },
  
  data() {
    return {
      isLoading: true,
      lottieInstance: null
    };
  },
  
  mounted() {
    this.initLottie();
    // 记录空状态展示
    onboardingFlow.trackEvent('empty_state_shown', { page: 'home' });
  },
  
  beforeUnmount() {
    if (this.lottieInstance) {
      this.lottieInstance.destroy();
    }
  },
  
  methods: {
    // 初始化 Lottie 动画
    async initLottie() {
      try {
        // 如果有 Lottie URL，尝试加载
        if (this.lottieUrl) {
          // 这里需要引入 lottie-miniprogram
          // const lottie = require('lottie-miniprogram');
          // this.lottieInstance = lottie.loadAnimation({...});
        }
      } catch (e) {
        logger.warn('[EmptyStateHome] Lottie 加载失败，使用 emoji 占位');
      } finally {
        this.isLoading = false;
      }
    },
    
    // 震动反馈
    vibrate() {
      try {
        if (typeof uni.vibrateShort === 'function') {
          uni.vibrateShort({ type: 'light' });
        }
      } catch (e) {}
    },
    
    // 上传资料
    handleUpload() {
      this.vibrate();
      onboardingFlow.trackEvent('guide_btn_click', { action: 'upload' });
      this.$emit('upload');
      
      // 默认跳转到导入页
      uni.navigateTo({ url: '/src/pages/practice/import-data' });
    },
    
    // 快速开始
    handleQuickStart() {
      this.vibrate();
      onboardingFlow.trackEvent('guide_btn_click', { action: 'quick_start' });
      this.$emit('quickStart');
      
      // 加载示例题库
      this.loadDemoQuestions();
    },
    
    // 查看教程
    handleTutorial() {
      this.vibrate();
      onboardingFlow.trackEvent('guide_btn_click', { action: 'tutorial' });
      this.$emit('tutorial');
      
      // 显示教程弹窗或跳转
      uni.showModal({
        title: '📖 快速上手教程',
        content: '1. 上传学习资料（PDF/Word/图片）\n2. AI 自动提取知识点生成题目\n3. 开始刷题，错题自动收录\n4. 查看学习报告，持续进步',
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
        // 示例题库数据
        const demoQuestions = [
          {
            id: 'demo_1',
            question: '以下哪个是 JavaScript 的基本数据类型？',
            options: ['Array', 'Object', 'String', 'Function'],
            answer: 2,
            explanation: 'String 是 JavaScript 的基本数据类型之一，而 Array、Object、Function 都是引用类型。'
          },
          {
            id: 'demo_2',
            question: 'Vue 3 中，以下哪个是组合式 API？',
            options: ['data()', 'methods', 'setup()', 'computed'],
            answer: 2,
            explanation: 'setup() 是 Vue 3 组合式 API 的入口函数。'
          },
          {
            id: 'demo_3',
            question: 'HTTP 状态码 404 表示什么？',
            options: ['服务器错误', '请求成功', '资源未找到', '重定向'],
            answer: 2,
            explanation: '404 Not Found 表示请求的资源在服务器上不存在。'
          }
        ];
        
        // 保存到本地
        uni.setStorageSync('v30_bank', demoQuestions);
        
        uni.hideLoading();
        uni.showToast({
          title: '示例题库已加载',
          icon: 'success'
        });
        
        // 刷新页面
        setTimeout(() => {
          uni.switchTab({ 
            url: '/src/pages/practice/index',
            fail: (err) => {
              logger.error('[EmptyStateHome] switchTab 失败:', err);
              uni.reLaunch({ url: '/src/pages/practice/index' });
            }
          });
        }, 1500);
        
      } catch (e) {
        uni.hideLoading();
        uni.showToast({
          title: '加载失败，请重试',
          icon: 'none'
        });
      }
    }
  }
};
</script>

<style lang="scss" scoped>
.empty-state-home {
  position: relative;
  padding: 48rpx 32rpx;
  border-radius: 32rpx;
  overflow: hidden;
  margin: 24rpx 0;
}

.state-light {
  background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
  border: 1px solid rgba(0, 0, 0, 0.05);
}

.state-dark {
  background: linear-gradient(135deg, rgba(30, 30, 30, 0.95) 0%, rgba(15, 15, 15, 0.98) 100%);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

/* 装饰背景 */
.decoration-layer {
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
}

.deco-1 {
  width: 200rpx;
  height: 200rpx;
  background: linear-gradient(135deg, #00E5FF, #00B8D4);
  top: -60rpx;
  right: -40rpx;
  animation: float 6s ease-in-out infinite;
}

.deco-2 {
  width: 150rpx;
  height: 150rpx;
  background: linear-gradient(135deg, #9FE870, #4CAF50);
  bottom: 100rpx;
  left: -30rpx;
  animation: float 5s ease-in-out infinite reverse;
}

.deco-3 {
  width: 100rpx;
  height: 100rpx;
  background: linear-gradient(135deg, #FF6B6B, #EE5A24);
  top: 40%;
  right: 10%;
  animation: float 4s ease-in-out infinite;
}

@keyframes float {
  0%, 100% { transform: translateY(0) scale(1); }
  50% { transform: translateY(-20rpx) scale(1.05); }
}

/* Lottie 动画区域 */
.animation-wrapper {
  display: flex;
  justify-content: center;
  margin-bottom: 32rpx;
}

.lottie-placeholder {
  width: 160rpx;
  height: 160rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 50%;
}

.animate-float {
  animation: bounce 2s ease-in-out infinite;
}

@keyframes bounce {
  0%, 100% { transform: scale(1) translateY(0); }
  50% { transform: scale(1.1) translateY(-10rpx); }
}

.lottie-emoji {
  font-size: 80rpx;
}

.lottie-canvas {
  width: 200rpx;
  height: 200rpx;
}

/* 标题区域 */
.title-section {
  text-align: center;
  margin-bottom: 40rpx;
}

.main-title {
  display: block;
  font-size: 40rpx;
  font-weight: 700;
  margin-bottom: 12rpx;
  
  .state-light & { color: #1a1a1a; }
  .state-dark & { color: #ffffff; }
}

.sub-title {
  display: block;
  font-size: 28rpx;
  line-height: 1.6;
  
  .state-light & { color: #666666; }
  .state-dark & { color: rgba(255, 255, 255, 0.7); }
}

/* 引导按钮 */
.guide-buttons {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
  margin-bottom: 32rpx;
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
}

.btn-primary {
  background: linear-gradient(135deg, #00a96d 0%, #008055 100%);
  
  .btn-title, .btn-desc, .btn-arrow {
    color: #ffffff;
  }
}

.btn-glow {
  box-shadow: 0 0 30rpx rgba(0, 169, 109, 0.4);
}

.btn-secondary {
  .state-light & {
    background: #ffffff;
    border: 1px solid rgba(0, 0, 0, 0.1);
  }
  .state-dark & {
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.1);
  }
}

.btn-tertiary {
  .state-light & {
    background: #f8fafc;
    border: 1px solid rgba(0, 0, 0, 0.05);
  }
  .state-dark & {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.08);
  }
}

.btn-icon-wrapper {
  width: 64rpx;
  height: 64rpx;
  border-radius: 16rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 20rpx;
  background: rgba(255, 255, 255, 0.2);
}

.icon-orange {
  background: rgba(245, 158, 11, 0.15);
}

.icon-purple {
  background: rgba(139, 92, 246, 0.15);
}

.btn-icon {
  font-size: 32rpx;
}

.btn-content {
  flex: 1;
}

.btn-title {
  display: block;
  font-size: 28rpx;
  font-weight: 600;
  margin-bottom: 4rpx;
  
  .btn-secondary &, .btn-tertiary & {
    .state-light & { color: #1a1a1a; }
    .state-dark & { color: #ffffff; }
  }
}

.btn-desc {
  display: block;
  font-size: 22rpx;
  
  .btn-secondary &, .btn-tertiary & {
    .state-light & { color: #666666; }
    .state-dark & { color: rgba(255, 255, 255, 0.6); }
  }
}

.btn-arrow {
  font-size: 28rpx;
  
  .btn-secondary &, .btn-tertiary & {
    .state-light & { color: #999999; }
    .state-dark & { color: rgba(255, 255, 255, 0.4); }
  }
}

/* 底部提示 */
.footer-hint {
  text-align: center;
}

.hint-text {
  font-size: 24rpx;
  
  .state-light & { color: #999999; }
  .state-dark & { color: rgba(255, 255, 255, 0.5); }
}
</style>
