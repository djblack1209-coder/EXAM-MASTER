<template>
  <view class="enhanced-progress">
    <!-- 进度条标题 -->
    <view class="progress-header">
      <text class="progress-label">
        {{ label }}
      </text>
      <text class="progress-value" :style="{ color: valueColor }">
        {{ currentValue }}{{ unit }}
      </text>
    </view>

    <!-- 进度条容器 -->
    <view class="progress-bar-container">
      <!-- 最佳范围背景提示 -->
      <view
        v-if="optimalRange"
        class="optimal-range"
        :style="{
          left: `${optimalRange.start}%`,
          width: `${optimalRange.end - optimalRange.start}%`
        }"
      />

      <!-- 实际进度条 -->
      <view
        class="progress-bar"
        :class="progressClass"
        :style="{
          transform: `scaleX(${progress / 100})`,
          background: progressGradient
        }"
      />
    </view>

    <!-- 进度提示文案 -->
    <view v-if="showHint" class="progress-hint">
      <text class="hint-text">
        {{ hintText }}
      </text>
      <text class="hint-status" :class="statusClass">
        {{ statusText }}
      </text>
    </view>
  </view>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  // 进度条标签
  label: {
    type: String,
    default: '进度'
  },
  // 当前值
  currentValue: {
    type: [Number, String],
    required: true
  },
  // 单位
  unit: {
    type: String,
    default: ''
  },
  // 进度百分比 (0-100)
  progress: {
    type: Number,
    required: true,
    validator: (val) => val >= 0 && val <= 100
  },
  // 最佳范围 { start: 40, end: 80 }
  optimalRange: {
    type: Object,
    default: null
  },
  // 是否显示提示
  showHint: {
    type: Boolean,
    default: true
  },
  // 提示文本
  hintText: {
    type: String,
    default: ''
  },
  // 进度类型 'warm' | 'cool' | 'energy' | 'brand'
  type: {
    type: String,
    default: 'brand',
    validator: (val) => ['warm', 'cool', 'energy', 'brand'].includes(val)
  }
});

// 计算进度条渐变色
const progressGradient = computed(() => {
  const gradients = {
    brand: 'linear-gradient(90deg, var(--brand-color) 0%, var(--brand-hover) 100%)',
    warm: 'linear-gradient(90deg, var(--accent-warm) 0%, #FFD700 100%)',
    cool: 'linear-gradient(90deg, var(--accent-cool) 0%, var(--action-blue) 100%)',
    energy: 'linear-gradient(90deg, var(--accent-energy) 0%, var(--danger) 100%)'
  };
  return gradients[props.type] || gradients.brand;
});

// 计算进度条样式类
const progressClass = computed(() => {
  return `progress-bar--${props.type}`;
});

// 计算数值颜色
const valueColor = computed(() => {
  const colors = {
    brand: 'var(--brand-color)',
    warm: 'var(--accent-warm)',
    cool: 'var(--accent-cool)',
    energy: 'var(--accent-energy)'
  };
  return colors[props.type] || colors.brand;
});

// 计算状态文案
const statusText = computed(() => {
  if (!props.optimalRange) return '';

  const { start, end } = props.optimalRange;
  const progress = props.progress;

  if (progress < start) {
    return '加油！';
  } else if (progress >= start && progress <= end) {
    return '完美！';
  } else {
    return '注意休息';
  }
});

// 计算状态样式类
const statusClass = computed(() => {
  if (!props.optimalRange) return '';

  const { start, end } = props.optimalRange;
  const progress = props.progress;

  if (progress < start) {
    return 'status-low';
  } else if (progress >= start && progress <= end) {
    return 'status-optimal';
  } else {
    return 'status-high';
  }
});
</script>

<style lang="scss" scoped>
.enhanced-progress {
    width: 100%;
    padding: var(--spacing-md);
    background: var(--bg-card);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-1);
}

.progress-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--spacing-sm);
}

.progress-label {
    font-size: 28rpx;
    color: var(--text-secondary);
    font-weight: var(--font-weight-medium);
}

.progress-value {
    font-size: 40rpx;
    font-weight: var(--font-weight-bold);
    transition: color var(--transition) var(--ease);
}

.progress-bar-container {
    position: relative;
    width: 100%;
    height: 8px;
    background: var(--bg-hover);
    border-radius: var(--radius-full);
    overflow: visible;
    margin-bottom: var(--spacing-sm);
}

.optimal-range {
    position: absolute;
    top: 0;
    height: 100%;
    background: rgba(159, 232, 112, 0.1);
    border-radius: var(--radius-sm);
    z-index: 1;
    transition: all var(--transition) var(--ease);
}

.progress-bar {
    position: relative;
    height: 100%;
    border-radius: var(--radius-full);
    z-index: 2;
    width: 0;
    transform-origin: left;
    transition: transform 0.6s cubic-bezier(0.4, 0, 0.2, 1);
    will-change: transform;

    // 品牌色光晕
    &.progress-bar--brand {
        box-shadow: var(--shadow-glow-brand);
    }

    // 温暖色光晕
    &.progress-bar--warm {
        box-shadow: var(--shadow-glow-warm);
    }

    // 冷静色光晕
    &.progress-bar--cool {
        box-shadow: var(--shadow-glow-cool);
    }

    // 能量色光晕
    &.progress-bar--energy {
        box-shadow: var(--shadow-glow-energy);
    }
}

.progress-hint {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 24rpx;
}

.hint-text {
    color: var(--text-tertiary);
}

.hint-status {
    font-weight: var(--font-weight-semibold);
    transition: color var(--transition) var(--ease);

    &.status-low {
        color: var(--accent-energy);
    }

    &.status-optimal {
        color: var(--brand-color);
    }

    &.status-high {
        color: var(--warning);
    }
}
</style>
