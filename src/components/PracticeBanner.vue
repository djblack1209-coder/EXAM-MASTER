<template>
  <view class="practice-banner" @tap="onBannerTap">
    <text class="banner-text">刷题</text>
    
    <view class="banner-arrow">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
        <path d="M9 18l6-6-6-6" />
      </svg>
    </view>
  </view>
</template>

<script setup>
// 定义emits
const emit = defineEmits(['bannerTap'])

// 跳转到刷题页面
const onBannerTap = () => {
  emit('bannerTap')
  uni.switchTab({
    url: '/src/pages/practice/index'
  })
}
</script>

<style lang="scss" scoped>
.practice-banner {
  width: 100%;
  height: 80px;
  border-radius: 16px;
  margin-bottom: 0;
  margin-top: 16px;
  padding: 0 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  box-shadow: 0px 4px 12px rgba(0, 0, 0, 0.08);
  transition: all 0.2s ease;
  -webkit-tap-highlight-color: transparent;
  position: relative;
  overflow: hidden;
  box-sizing: border-box;
  
  /* 占位符渐变背景 */
  background: linear-gradient(to right, #4facfe 0%, #00f2fe 100%);
  
  &:active {
    opacity: 0.85;
    transform: scale(0.98);
  }
  
  .banner-text {
    font-size: 20px;
    font-weight: 700;
    color: #FFFFFF;
    -webkit-font-smoothing: antialiased;
    position: relative;
    z-index: 1;
  }
  
  .banner-arrow {
    width: 40px;
    height: 40px;
    background: #07C160;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    z-index: 1;
    flex-shrink: 0;
    box-shadow: 0px 2px 8px rgba(0, 0, 0, 0.15);
    
    /* 练习卡片右箭头SVG */
    .banner-arrow svg {
      width: 24px;
      height: 24px;
    }
  }
}
</style>
