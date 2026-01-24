<template>
  <view 
    :class="['stats-card', isDark ? 'stats-card--dark' : 'stats-card--light']"
    :data-testid="`stats-card-${title.toLowerCase().replace(/\s+/g, '-')}`"
    @tap="handleClick"
  >
    <!-- Dark mode gradient overlay -->
    <view v-if="isDark" class="stats-card__gradient"></view>
    
    <!-- Content -->
    <view class="stats-card__content">
      <view class="stats-card__info">
        <text class="stats-card__title">{{ title }}</text>
        <text class="stats-card__value">{{ value }}</text>
        <text 
          v-if="change" 
          :class="['stats-card__change', `stats-card__change--${changeType}`]"
        >
          {{ change }}
        </text>
      </view>
      
      <view :class="['stats-card__icon', isDark ? 'stats-card__icon--dark' : 'stats-card__icon--light']">
        <text class="stats-card__icon-text">{{ icon }}</text>
      </view>
    </view>
  </view>
</template>

<script>
export default {
  name: 'StatsCard',
  props: {
    title: {
      type: String,
      required: true
    },
    value: {
      type: [String, Number],
      required: true
    },
    change: {
      type: String,
      default: ''
    },
    changeType: {
      type: String,
      default: 'neutral',
      validator: (value) => ['positive', 'negative', 'neutral'].includes(value)
    },
    icon: {
      type: String,
      required: true
    },
    isDark: {
      type: Boolean,
      default: false
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
.stats-card {
  position: relative;
  overflow: hidden;
  border-radius: var(--radius-lg);
  padding: 20px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  
  &--light {
    background: var(--bg-card);
    border: 1px solid var(--border-light);
    box-shadow: var(--card-shadow);
    
    &:active {
      box-shadow: var(--card-shadow-hover);
      transform: translateY(-2px);
    }
  }
  
  &--dark {
    background: var(--glass-bg);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 0.5px solid var(--border-light);
    
    &:active {
      border-color: var(--brand-color);
      box-shadow: var(--shadow-glow-brand);
      transform: translateY(-2px);
    }
  }
  
  &__gradient {
    position: absolute;
    inset: 0;
    background: linear-gradient(135deg, rgba(0, 242, 255, 0.05) 0%, transparent 100%);
    pointer-events: none;
    z-index: 0;
  }
  
  &__content {
    position: relative;
    z-index: 1;
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
  }
  
  &__info {
    display: flex;
    flex-direction: column;
    gap: 4px;
    flex: 1;
  }
  
  &__title {
    font-size: 14px;
    color: var(--text-secondary);
    font-weight: var(--font-weight-medium);
    line-height: var(--line-height-normal);
  }
  
  &__value {
    font-size: 24px;
    font-weight: var(--font-weight-bold);
    color: var(--text-primary);
    line-height: var(--line-height-tight);
    margin-top: 4px;
  }
  
  &__change {
    font-size: 12px;
    font-weight: var(--font-weight-medium);
    margin-top: 4px;
    
    &--positive {
      color: #10B981;
    }
    
    &--negative {
      color: #EF4444;
    }
    
    &--neutral {
      color: var(--text-secondary);
    }
  }
  
  &__icon {
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius-md);
    padding: 12px;
    flex-shrink: 0;
    
    &--light {
      background: rgba(159, 232, 112, 0.1);
    }
    
    &--dark {
      background: rgba(0, 242, 255, 0.1);
    }
  }
  
  &__icon-text {
    font-size: 24px;
    line-height: 1;
  }
}

/* Dark mode specific styles */
.stats-card--dark {
  .stats-card__icon-text {
    filter: drop-shadow(0 0 8px var(--brand-glow));
  }
}
</style>