<template>
  <view 
    :class="['activity-item', isDark ? 'activity-item--dark' : 'activity-item--light']"
    :data-testid="`activity-item-${status}`"
    @tap="handleClick"
  >
    <!-- Icon -->
    <view :class="['activity-item__icon', `activity-item__icon--${status}`]">
      <text class="activity-item__icon-text">{{ icon }}</text>
    </view>
    
    <!-- Content -->
    <view class="activity-item__content">
      <text class="activity-item__title">{{ title }}</text>
      <text class="activity-item__subtitle">{{ subtitle }}</text>
    </view>
    
    <!-- Meta -->
    <view class="activity-item__meta">
      <text class="activity-item__time">{{ time }}</text>
      <view :class="['activity-item__badge', `activity-item__badge--${status}`]">
        <text class="activity-item__badge-text">{{ statusText }}</text>
      </view>
    </view>
  </view>
</template>

<script>
export default {
  name: 'ActivityItem',
  props: {
    title: {
      type: String,
      required: true
    },
    subtitle: {
      type: String,
      required: true
    },
    time: {
      type: String,
      required: true
    },
    icon: {
      type: String,
      required: true
    },
    status: {
      type: String,
      default: 'completed',
      validator: (value) => ['completed', 'in-progress', 'pending'].includes(value)
    },
    isDark: {
      type: Boolean,
      default: false
    }
  },
  computed: {
    statusText() {
      const statusMap = {
        'completed': 'Done',
        'in-progress': 'Active',
        'pending': 'Pending'
      }
      return statusMap[this.status] || 'Done'
    }
  },
  methods: {
    handleClick() {
      this.$emit('click', {
        title: this.title,
        status: this.status
      })
    }
  }
}
</script>

<style lang="scss" scoped>
.activity-item {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  border-radius: var(--radius-md);
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  
  &--light {
    background: var(--bg-card);
    border: 1px solid var(--border-light);
    
    &:active {
      background: var(--bg-hover);
    }
  }
  
  &--dark {
    background: var(--glass-bg);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    
    &:active {
      background: rgba(255, 255, 255, 0.08);
    }
  }
  
  &__icon {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    width: 48px;
    height: 48px;
    border-radius: var(--radius-full);
    
    &--completed {
      background: rgba(16, 185, 129, 0.1);
      color: #10B981;
    }
    
    &--in-progress {
      background: rgba(0, 242, 255, 0.1);
      color: #00F2FF;
    }
    
    &--pending {
      background: var(--bg-hover);
      color: var(--text-secondary);
    }
  }
  
  &__icon-text {
    font-size: 20px;
    line-height: 1;
  }
  
  &__content {
    display: flex;
    flex-direction: column;
    gap: 4px;
    flex: 1;
    min-width: 0;
  }
  
  &__title {
    font-size: 15px;
    font-weight: var(--font-weight-medium);
    color: var(--text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  
  &__subtitle {
    font-size: 13px;
    color: var(--text-secondary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  
  &__meta {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 4px;
    flex-shrink: 0;
  }
  
  &__time {
    font-size: 12px;
    color: var(--text-secondary);
  }
  
  &__badge {
    padding: 4px 8px;
    border-radius: var(--radius-full);
    font-size: 11px;
    font-weight: var(--font-weight-medium);
    
    &--completed {
      background: rgba(16, 185, 129, 0.1);
      color: #10B981;
    }
    
    &--in-progress {
      background: rgba(0, 242, 255, 0.1);
      color: #00F2FF;
    }
    
    &--pending {
      background: var(--bg-hover);
      color: var(--text-secondary);
    }
  }
  
  &__badge-text {
    font-size: 11px;
    line-height: 1;
  }
}
</style>