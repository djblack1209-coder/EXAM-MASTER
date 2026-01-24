<template>
  <view 
    :class="['welcome-banner', isDark ? 'welcome-banner--dark' : 'welcome-banner--light']"
    data-testid="welcome-banner"
  >
    <!-- Dark mode decorative blobs -->
    <view v-if="isDark" class="welcome-banner__blob welcome-banner__blob--1"></view>
    <view v-if="isDark" class="welcome-banner__blob welcome-banner__blob--2"></view>
    
    <!-- Content -->
    <view class="welcome-banner__content">
      <view class="welcome-banner__text">
        <text class="welcome-banner__title">Welcome back, {{ userName }}!</text>
        <text class="welcome-banner__subtitle">
          You have <text class="welcome-banner__highlight">{{ pendingCount }} questions</text> pending review. Keep up the momentum!
        </text>
      </view>
      
      <view class="welcome-banner__actions">
        <view 
          :class="['welcome-banner__button', 'welcome-banner__button--primary', isDark && 'animate-pulse-glow']"
          @tap="handleQuickPractice"
          data-testid="quick-practice-button"
        >
          <text class="welcome-banner__button-icon">⚡</text>
          <text class="welcome-banner__button-text">Quick Practice</text>
        </view>
        
        <view 
          class="welcome-banner__button welcome-banner__button--secondary"
          @tap="handleMockExam"
          data-testid="mock-exam-button"
        >
          <text class="welcome-banner__button-icon">⏱️</text>
          <text class="welcome-banner__button-text">Mock Exam</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
export default {
  name: 'WelcomeBanner',
  props: {
    userName: {
      type: String,
      default: 'John'
    },
    pendingCount: {
      type: Number,
      default: 23
    },
    isDark: {
      type: Boolean,
      default: false
    }
  },
  methods: {
    handleQuickPractice() {
      this.$emit('quick-practice')
      uni.switchTab({
        url: '/src/pages/practice/index'
      })
    },
    handleMockExam() {
      this.$emit('mock-exam')
      uni.navigateTo({
        url: '/src/pages/practice/do-quiz?mode=mock'
      })
    }
  }
}
</script>

<style lang="scss" scoped>
.welcome-banner {
  position: relative;
  overflow: hidden;
  border-radius: var(--radius-2xl);
  padding: 24px;
  margin-bottom: 32px;
  
  &--light {
    background: linear-gradient(to right, rgba(159, 232, 112, 0.1) 0%, rgba(159, 232, 112, 0.05) 50%, transparent 100%);
    border: 1px solid var(--border-light);
  }
  
  &--dark {
    background: var(--glass-bg);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 0.5px solid var(--border-light);
    background-image: linear-gradient(135deg, #1A1C1E 0%, #0D0E10 100%);
  }
  
  &__blob {
    position: absolute;
    border-radius: var(--radius-full);
    filter: blur(60px);
    pointer-events: none;
    
    &--1 {
      top: -80px;
      right: -80px;
      width: 256px;
      height: 256px;
      background: rgba(0, 242, 255, 0.1);
    }
    
    &--2 {
      bottom: -40px;
      left: -40px;
      width: 192px;
      height: 192px;
      background: rgba(159, 232, 112, 0.1);
    }
  }
  
  &__content {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    gap: 16px;
    
    @media (min-width: 768px) {
      flex-direction: row;
      align-items: center;
      justify-content: space-between;
    }
  }
  
  &__text {
    display: flex;
    flex-direction: column;
    gap: 8px;
    flex: 1;
  }
  
  &__title {
    font-size: 24px;
    font-weight: var(--font-weight-bold);
    color: var(--text-primary);
    line-height: var(--line-height-tight);
    
    @media (min-width: 768px) {
      font-size: 28px;
    }
  }
  
  &__subtitle {
    font-size: 15px;
    color: var(--text-secondary);
    line-height: var(--line-height-normal);
  }
  
  &__highlight {
    color: var(--brand-color);
    font-weight: var(--font-weight-medium);
  }
  
  &__actions {
    display: flex;
    gap: 12px;
    flex-shrink: 0;
  }
  
  &__button {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 20px;
    border-radius: var(--radius-lg);
    font-size: 15px;
    font-weight: var(--font-weight-medium);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    cursor: pointer;
    
    &--primary {
      background: var(--brand-color);
      color: #000000;
      
      &:active {
        transform: scale(0.95);
      }
    }
    
    &--secondary {
      background: transparent;
      border: 1px solid var(--border-light);
      color: var(--text-primary);
      
      &:active {
        background: var(--bg-hover);
      }
    }
  }
  
  &__button-icon {
    font-size: 16px;
    line-height: 1;
  }
  
  &__button-text {
    font-size: 15px;
    line-height: 1;
  }
}

/* Pulse glow animation for dark mode primary button */
@keyframes pulse-glow {
  0%, 100% {
    box-shadow: 0 0 20px var(--brand-glow), 0 0 40px var(--brand-glow);
  }
  50% {
    box-shadow: 0 0 30px var(--brand-glow), 0 0 60px var(--brand-glow);
  }
}

.animate-pulse-glow {
  animation: pulse-glow 3s ease-in-out infinite;
}
</style>