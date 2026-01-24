<template>
  <view 
    :class="[
      'bubble-card',
      `bubble-card--${size}`,
      isDark ? 'bubble-card--dark' : 'bubble-card--light',
      isDark && 'animate-float'
    ]"
    :style="bubbleStyle"
    :data-testid="`bubble-card-${size}`"
    @tap="handleClick"
  >
    <!-- Dark mode glow effect -->
    <view 
      v-if="isDark && glowColor" 
      class="bubble-card__glow animate-breathe"
      :style="{ background: glowGradient }"
    ></view>
    
    <!-- Content slot -->
    <view class="bubble-card__content">
      <slot></slot>
    </view>
  </view>
</template>

<script>
export default {
  name: 'BubbleCard',
  props: {
    size: {
      type: String,
      default: 'md',
      validator: (value) => ['sm', 'md', 'lg', 'xl'].includes(value)
    },
    delay: {
      type: Number,
      default: 0
    },
    glowColor: {
      type: String,
      default: ''
    },
    isDark: {
      type: Boolean,
      default: false
    }
  },
  computed: {
    bubbleStyle() {
      const styles = {
        animationDelay: `${this.delay}ms`
      }
      
      // Add glow shadow for dark mode
      if (this.isDark && this.glowColor) {
        styles.boxShadow = `0 0 20px ${this.glowColor}30, 0 0 40px ${this.glowColor}20`
      }
      
      return styles
    },
    glowGradient() {
      if (!this.glowColor) return ''
      return `radial-gradient(circle at center, ${this.glowColor}20 0%, transparent 70%)`
    }
  },
  methods: {
    handleClick() {
      this.$emit('click')
    }
  }
}
</script>

<style lang="scss" scoped>
.bubble-card {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-full);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  cursor: pointer;
  
  // Size variants
  &--sm {
    width: 96px;
    height: 96px;
    
    @media (min-width: 768px) {
      width: 112px;
      height: 112px;
    }
  }
  
  &--md {
    width: 128px;
    height: 128px;
    
    @media (min-width: 768px) {
      width: 160px;
      height: 160px;
    }
  }
  
  &--lg {
    width: 160px;
    height: 160px;
    
    @media (min-width: 768px) {
      width: 208px;
      height: 208px;
    }
  }
  
  &--xl {
    width: 192px;
    height: 192px;
    
    @media (min-width: 768px) {
      width: 256px;
      height: 256px;
    }
  }
  
  // Light mode styles
  &--light {
    background: var(--bg-card);
    border: 1px solid var(--border-light);
    box-shadow: var(--card-shadow);
    border-radius: var(--radius-lg);
    
    &:active {
      box-shadow: var(--card-shadow-hover);
      transform: translateY(-2px);
    }
  }
  
  // Dark mode styles
  &--dark {
    background: var(--glass-bg);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 0.5px solid var(--glass-border);
    background-image: linear-gradient(135deg, #1A1C1E 0%, #0D0E10 100%);
    
    &:active {
      transform: scale(1.05);
    }
  }
  
  &__glow {
    position: absolute;
    inset: 0;
    border-radius: var(--radius-full);
    opacity: 0.5;
    pointer-events: none;
  }
  
  &__content {
    position: relative;
    z-index: 1;
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
  }
}

/* Floating animation for dark mode */
@keyframes float {
  0%, 100% {
    transform: translateY(0px);
  }
  50% {
    transform: translateY(-8px);
  }
}

.animate-float {
  animation: float 4s ease-in-out infinite;
}

/* Breathing glow animation */
@keyframes breathe {
  0%, 100% {
    opacity: 0.6;
  }
  50% {
    opacity: 1;
  }
}

.animate-breathe {
  animation: breathe 2s ease-in-out infinite;
}
</style>