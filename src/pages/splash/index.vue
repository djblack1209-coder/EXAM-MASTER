<template>
  <view class="splash-container">
    <view class="content-wrapper">
      
      <image 
        class="logo-icon"
        src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDEwMjQgMTAyNCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNMjQwIDI1NmgtNDhjLTI2LjUgMC00OCAyMS41LTQ4IDQ4djUxMmMwIDI2LjUgMjEuNSA0OCA0OCA0OGg0OGMyNi41IDAgNDgtMjEuNSA0OC00OFYzMDRjMC0yNi41LTIxLjUtNDgtNDgtNDh6IG0yNTYgMGgtNDhjLTI2LjUgMC00OCAyMS41LTQ4IDQ4djUxMmMwIDI2LjUgMjEuNSA0OCA0OCA0OGg0OGMyNi41IDAgNDgtMjEuNSA0OC00OFYzMDRjMC0yNi41LTIxLjUtNDgtNDgtNDh6IiBmaWxsPSJub25lIiBzdHJva2U9IiNmZmZmZmYiIHN0cm9rZS13aWR0aD0iNjAiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIvPjxwYXRoIGQ9Ik0xOTIgODE2aDMwNE01NDQgODE2aDMwNE0xOTIgMzA0aDMwNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjZmZmZmZmIiBzdHJva2Utd2lkdGg9IjYwIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiLz48cGF0aCBkPSJNNzIwIDU1MFYyNTBNNjIwIDM1MGwxMDAtMTAwIDEwMCAxMDAiIGZpbGw9Im5vbmUiIHN0cm9rZT0iI2ZmZmZmZiIgc3Ryb2tlLXdpZHRoPSI3MCIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIi8+PHBhdGggZD0iTTg0OCA4MTZWNTAwIiBmaWxsPSJub25lIiBzdHJva2U9IiNmZmZmZmYiIHN0cm9rZS13aWR0aD0iNjAiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIvPjwvc3ZnPg=="
        mode="aspectFit"
      ></image>
      
      <text class="app-name">Exam-Master</text>
      
      <view class="loading-dots">
        <view class="dot"></view>
        <view class="dot"></view>
        <view class="dot"></view>
      </view>
    </view>

    <view class="footer-fluid">
      <view class="wave-layer layer-1"></view>
      <view class="wave-layer layer-2"></view>
      <view class="wave-layer layer-3"></view>
    </view>

    <view class="swoosh-arrow-container">
      <view class="arrow-body"></view>
      <view class="arrow-head"></view>
    </view>

  </view>
</template>

<script setup>
import { onMounted } from 'vue'

onMounted(() => {
  // 3秒后自动跳转到首页
  setTimeout(() => {
    uni.reLaunch({
      url: '/pages/index/index'
    })
  }, 3000)
})
</script>

<style lang="scss" scoped>
/* 全局容器 */
.splash-container {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background-color: var(--primary);
  overflow: hidden;
  transition: background-color 0.3s;
}

.splash-container.dark-mode {
  background-color: var(--bg-page);
}

/* 1. 内容区域 */
.content-wrapper {
  position: absolute;
  top: 32%; /* 稍微下移，符合原图比例 */
  left: 0;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  z-index: 50; /* 最高层级 */
}

.logo-icon {
  width: 100px;
  height: 100px;
  margin-bottom: 16px;
  /* 增加微弱的深色投影，让白色图标从绿色背景浮出来 */
  filter: drop-shadow(0 4px 0px rgba(0, 0, 0, 0.15));
}

.app-name {
  font-size: 28px;
  font-weight: 700;
  color: var(--primary-foreground);
  letter-spacing: 0.5px;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  -webkit-font-smoothing: antialiased;
}

.loading-dots {
  display: flex;
  margin-top: 24px;
  gap: 8px;
  
  .dot {
    width: 8px;
    height: 8px;
    background-color: var(--primary-foreground);
    border-radius: 50%;
    opacity: 0.6;
    animation: blink 1.5s infinite ease-in-out both;
    box-shadow: 0 0 12px var(--brand-glow);
  }
  
  .dot:nth-child(1) { 
    animation-delay: 0s; 
  }
  
  .dot:nth-child(2) { 
    animation-delay: 0.2s; 
  }
  
  .dot:nth-child(3) { 
    animation-delay: 0.4s; 
  }
}

@keyframes blink {
  0%, 100% { 
    opacity: 0.3; 
    transform: scale(0.8); 
  }
  50% { 
    opacity: 1; 
    transform: scale(1.1); 
  }
}

/* 2. 底部流体波浪 (关键还原点) */
.footer-fluid {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 35vh;
  z-index: 10;
  /* 裁剪溢出，保证底部整齐 */
  overflow: hidden;
}

.wave-layer {
  position: absolute;
  bottom: -50%;
  left: -20%;
  width: 140%;
  height: 100%;
  border-radius: 40% 60% 70% 30% / 40% 50% 60% 50%; /* 这种圆角能模拟波浪形状 */
  opacity: 0.9;
}

/* 蓝色层 (背景) */
.layer-1 {
  background: linear-gradient(120deg, #0052D4 0%, #4364F7 100%);
  bottom: -40%;
  left: -30%;
  transform: rotate(-10deg);
  opacity: 0.8;
  z-index: 1;
}

/* 青/黄层 (中间过渡) */
.layer-2 {
  background: linear-gradient(120deg, #20BDFF 0%, #A5FECB 100%);
  bottom: -55%;
  left: -10%;
  transform: rotate(5deg);
  border-radius: 30% 70% 70% 30% / 30% 30% 70% 70%;
  z-index: 2;
  opacity: 0.8;
}

/* 橙红层 (前景高光) */
.layer-3 {
  background: linear-gradient(90deg, #FFC107 0%, #FF5722 50%, #f7797d 100%);
  bottom: -60%;
  right: -20%;
  left: auto;
  width: 120%;
  transform: rotate(-5deg);
  border-radius: 50% 50% 0 0;
  z-index: 3;
}

/* 3. 大箭头 Swoosh (纯 CSS 绘制，不依赖图片) */
.swoosh-arrow-container {
  position: absolute;
  bottom: 8%;
  left: 0;
  width: 100%;
  height: 150px;
  z-index: 20; /* 在波浪之上 */
  /* 透视变形，制造"飞出"的感觉 */
  transform: rotate(-10deg) skewX(-15deg);
  opacity: 0.95;
  filter: drop-shadow(0 5px 15px rgba(0, 0, 0, 0.2));
}

.arrow-body {
  position: absolute;
  bottom: 20px;
  left: -20px;
  width: 80%; /* 长长的尾巴 */
  height: 18px; /* 箭身粗细 */
  background: linear-gradient(90deg, rgba(255, 255, 255, 0) 0%, rgba(255, 255, 255, 1) 40%);
  border-radius: 0 4px 4px 0;
}

.arrow-head {
  position: absolute;
  bottom: 9px; /* 微调对齐箭身 */
  left: 78%; /* 放在箭身末端 */
  width: 0; 
  height: 0; 
  border-top: 20px solid transparent;
  border-bottom: 20px solid transparent;
  border-left: 40px solid var(--primary-foreground); /* 箭头形状 */
}
</style>