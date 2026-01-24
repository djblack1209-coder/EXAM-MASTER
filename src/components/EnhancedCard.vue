<template>
    <view class="enhanced-card" :class="cardClasses" @click="handleClick">
        <!-- 卡片内容 -->
        <slot></slot>
    </view>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
    // 卡片类型 'default' | 'glass' | 'elevated' | 'outlined'
    variant: {
        type: String,
        default: 'default',
        validator: (val) => ['default', 'glass', 'elevated', 'outlined'].includes(val)
    },
    // 是否可悬停
    hoverable: {
        type: Boolean,
        default: false
    },
    // 是否可点击
    clickable: {
        type: Boolean,
        default: false
    },
    // 光晕类型 'none' | 'brand' | 'warm' | 'cool' | 'energy'
    glow: {
        type: String,
        default: 'none',
        validator: (val) => ['none', 'brand', 'warm', 'cool', 'energy'].includes(val)
    },
    // 内边距 'none' | 'small' | 'medium' | 'large'
    padding: {
        type: String,
        default: 'medium',
        validator: (val) => ['none', 'small', 'medium', 'large'].includes(val)
    }
})

const emit = defineEmits(['click'])

// 计算卡片样式类
const cardClasses = computed(() => {
    return [
        `card--${props.variant}`,
        `card--padding-${props.padding}`,
        {
            'card--hoverable': props.hoverable,
            'card--clickable': props.clickable,
            [`card--glow-${props.glow}`]: props.glow !== 'none'
        }
    ]
})

// 处理点击事件
const handleClick = (e) => {
    if (props.clickable) {
        emit('click', e)
    }
}
</script>

<style lang="scss" scoped>
.enhanced-card {
    border-radius: var(--radius-md);
    transition: all var(--transition) var(--ease);

    // 内边距变体
    &.card--padding-none {
        padding: 0;
    }

    &.card--padding-small {
        padding: var(--spacing-sm);
    }

    &.card--padding-medium {
        padding: var(--spacing-md);
    }

    &.card--padding-large {
        padding: var(--spacing-lg);
    }

    // 默认卡片
    &.card--default {
        background: var(--bg-card);
        box-shadow: var(--shadow-1);
    }

    // 毛玻璃卡片 (Glassmorphism)
    &.card--glass {
        background: rgba(255, 255, 255, 0.1);
        backdrop-filter: blur(20px) saturate(180%);
        -webkit-backdrop-filter: blur(20px) saturate(180%);
        border: 1px solid rgba(255, 255, 255, 0.2);
        box-shadow:
            0 8px 32px rgba(0, 0, 0, 0.1),
            inset 0 1px 1px rgba(255, 255, 255, 0.2);
    }

    // 浮起卡片
    &.card--elevated {
        background: var(--bg-card);
        box-shadow: var(--shadow-2);
    }

    // 描边卡片
    &.card--outlined {
        background: var(--bg-card);
        border: 1px solid var(--border-light);
        box-shadow: none;
    }

    // 可悬停效果
    &.card--hoverable:hover {
        transform: translateY(-4px);

        &.card--default {
            box-shadow: var(--shadow-2);
        }

        &.card--glass {
            box-shadow:
                0 12px 40px rgba(0, 0, 0, 0.15),
                inset 0 1px 1px rgba(255, 255, 255, 0.3);
        }

        &.card--elevated {
            box-shadow: var(--shadow-3);
        }

        &.card--outlined {
            border-color: var(--border-medium);
            box-shadow: var(--shadow-1);
        }
    }

    // 可点击效果
    &.card--clickable {
        cursor: pointer;

        &:active {
            transform: translateY(-2px);
        }
    }

    // 品牌色光晕
    &.card--glow-brand {
        box-shadow: var(--shadow-glow-brand);

        &:hover {
            box-shadow: var(--shadow-glow-brand-strong);
        }
    }

    // 温暖色光晕
    &.card--glow-warm {
        box-shadow: var(--shadow-glow-warm);

        &:hover {
            box-shadow: 0 4px 16px rgba(255, 184, 77, 0.4), 0 0 30px rgba(255, 184, 77, 0.3);
        }
    }

    // 冷静色光晕
    &.card--glow-cool {
        box-shadow: var(--shadow-glow-cool);

        &:hover {
            box-shadow: 0 4px 16px rgba(78, 205, 196, 0.4), 0 0 30px rgba(78, 205, 196, 0.3);
        }
    }

    // 能量色光晕
    &.card--glow-energy {
        box-shadow: var(--shadow-glow-energy);

        &:hover {
            box-shadow: 0 4px 16px rgba(255, 107, 107, 0.4), 0 0 30px rgba(255, 107, 107, 0.3);
        }
    }
}
</style>
