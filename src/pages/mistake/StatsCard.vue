<template>
  <view
    :class="['stats-card', isDark ? 'stats-card--dark' : 'stats-card--light']"
    :data-testid="`stats-card-${title.toLowerCase().replace(/\s+/g, '-')}`"
    @tap="handleClick"
  >
    <!-- Dark mode gradient overlay -->
    <view v-if="isDark" class="stats-card__gradient" />

    <!-- Content -->
    <view class="stats-card__content">
      <view class="stats-card__info">
        <text class="stats-card__title">
          {{ title }}
        </text>
        <text class="stats-card__value">
          {{ value }}
        </text>
        <text v-if="change" :class="['stats-card__change', `stats-card__change--${changeType}`]">
          {{ change }}
        </text>
      </view>

      <view :class="['stats-card__icon', isDark ? 'stats-card__icon--dark' : 'stats-card__icon--light']">
        <BaseIcon :name="icon" :size="48" class="stats-card__icon-text" />
      </view>
    </view>
  </view>
</template>

<script setup>
import BaseIcon from '@/components/base/base-icon/base-icon.vue';

defineProps({
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
});

const emit = defineEmits(['click']);

function handleClick() {
  emit('click');
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
    border: 2rpx solid rgba(0, 0, 0, 0.04);
    box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.06);

    &:active {
      box-shadow: 0 8rpx 24rpx rgba(0, 0, 0, 0.1);
      transform: translateY(-2px);
    }
  }

  &--dark {
    background: var(--em3d-card-bg);
    border: 2rpx solid var(--border-light);

    &:active {
      border-color: var(--brand-color);
      box-shadow: var(--shadow-glow-brand);
      transform: translateY(-2px);
    }
  }

  &__gradient {
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    left: 0;
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
    /* gap: 4px; -- replaced for Android WebView compat */
    flex: 1;
  }

  &__title {
    font-size: 28rpx;
    color: var(--text-secondary);
    font-weight: 600;
    line-height: var(--line-height-normal);
  }

  &__value {
    font-size: 48rpx;
    font-weight: 800;
    color: var(--text-primary);
    line-height: var(--line-height-tight);
    margin-top: 4px;
  }

  &__change {
    font-size: 24rpx;
    font-weight: var(--font-weight-medium);
    margin-top: 4px;

    &--positive {
      color: var(--success);
    }

    &--negative {
      color: var(--danger);
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
      background: rgba(255, 75, 75, 0.08);
    }

    &--dark {
      background: rgba(0, 242, 255, 0.1);
    }
  }

  &__icon-text {
    font-size: 48rpx;
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
