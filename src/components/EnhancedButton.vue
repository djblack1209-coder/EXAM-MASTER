<template>
    <button class="enhanced-button" :class="buttonClasses" :disabled="disabled || loading" @click="handleClick">
        <!-- 加载状态 -->
        <view v-if="loading" class="button-loading">
            <view class="loading-spinner"></view>
        </view>

        <!-- 按钮内容 -->
        <view class="button-content" :class="{ 'button-content--hidden': loading }">
            <slot></slot>
        </view>
    </button>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
    // 按钮类型 'primary' | 'secondary' | 'warm' | 'cool' | 'energy' | 'ghost'
    type: {
        type: String,
        default: 'primary',
        validator: (val) => ['primary', 'secondary', 'warm', 'cool', 'energy', 'ghost'].includes(val)
    },
    // 按钮尺寸 'small' | 'medium' | 'large'
    size: {
        type: String,
        default: 'medium',
        validator: (val) => ['small', 'medium', 'large'].includes(val)
    },
    // 是否禁用
    disabled: {
        type: Boolean,
        default: false
    },
    // 是否加载中
    loading: {
        type: Boolean,
        default: false
    },
    // 是否块级按钮
    block: {
        type: Boolean,
        default: false
    },
    // 是否圆形按钮
    round: {
        type: Boolean,
        default: false
    }
})

const emit = defineEmits(['click'])

// 计算按钮样式类
const buttonClasses = computed(() => {
    return [
        `button--${props.type}`,
        `button--${props.size}`,
        {
            'button--block': props.block,
            'button--round': props.round,
            'button--disabled': props.disabled,
            'button--loading': props.loading
        }
    ]
})

// 处理点击事件
const handleClick = (e) => {
    if (!props.disabled && !props.loading) {
        emit('click', e)
    }
}
</script>

<style lang="scss" scoped>
.enhanced-button {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: none;
    outline: none;
    cursor: pointer;
    font-weight: var(--font-weight-semibold);
    transition: all var(--transition) var(--ease);
    overflow: hidden;

    // 尺寸变体
    &.button--small {
        height: 32px;
        padding: 0 var(--spacing-md);
        font-size: 14px;
        border-radius: var(--radius-sm);
    }

    &.button--medium {
        height: 40px;
        padding: 0 var(--spacing-lg);
        font-size: 15px;
        border-radius: var(--radius-md);
    }

    &.button--large {
        height: 48px;
        padding: 0 var(--spacing-xl);
        font-size: 16px;
        border-radius: var(--radius-md);
    }

    // 块级按钮
    &.button--block {
        width: 100%;
        display: flex;
    }

    // 圆形按钮
    &.button--round {
        border-radius: var(--radius-full);
    }

    // 主要按钮 - 品牌色光晕
    &.button--primary {
        background: var(--brand-color);
        color: #FFFFFF;
        box-shadow: var(--shadow-glow-brand);

        &:hover:not(.button--disabled) {
            background: var(--brand-hover);
            transform: translateY(-2px);
            box-shadow: var(--shadow-glow-brand-strong);
        }

        &:active:not(.button--disabled) {
            transform: translateY(0);
            box-shadow: var(--shadow-glow-brand);
        }
    }

    // 次要按钮
    &.button--secondary {
        background: var(--bg-hover);
        color: var(--text-primary);
        box-shadow: var(--shadow-1);

        &:hover:not(.button--disabled) {
            background: var(--bg-active);
            transform: translateY(-2px);
            box-shadow: var(--shadow-2);
        }

        &:active:not(.button--disabled) {
            transform: translateY(0);
            box-shadow: var(--shadow-1);
        }
    }

    // 温暖色按钮 - 橙黄光晕
    &.button--warm {
        background: var(--accent-warm);
        color: #FFFFFF;
        box-shadow: var(--shadow-glow-warm);

        &:hover:not(.button--disabled) {
            background: #FFD700;
            transform: translateY(-2px);
            box-shadow: 0 4px 16px rgba(255, 184, 77, 0.4), 0 0 30px rgba(255, 184, 77, 0.3);
        }

        &:active:not(.button--disabled) {
            transform: translateY(0);
            box-shadow: var(--shadow-glow-warm);
        }
    }

    // 冷静色按钮 - 青色光晕
    &.button--cool {
        background: var(--accent-cool);
        color: #FFFFFF;
        box-shadow: var(--shadow-glow-cool);

        &:hover:not(.button--disabled) {
            background: var(--action-blue);
            transform: translateY(-2px);
            box-shadow: 0 4px 16px rgba(78, 205, 196, 0.4), 0 0 30px rgba(78, 205, 196, 0.3);
        }

        &:active:not(.button--disabled) {
            transform: translateY(0);
            box-shadow: var(--shadow-glow-cool);
        }
    }

    // 能量色按钮 - 珊瑚红光晕
    &.button--energy {
        background: var(--accent-energy);
        color: #FFFFFF;
        box-shadow: var(--shadow-glow-energy);

        &:hover:not(.button--disabled) {
            background: var(--danger);
            transform: translateY(-2px);
            box-shadow: 0 4px 16px rgba(255, 107, 107, 0.4), 0 0 30px rgba(255, 107, 107, 0.3);
        }

        &:active:not(.button--disabled) {
            transform: translateY(0);
            box-shadow: var(--shadow-glow-energy);
        }
    }

    // 幽灵按钮
    &.button--ghost {
        background: transparent;
        color: var(--brand-color);
        border: 1px solid var(--brand-color);
        box-shadow: none;

        &:hover:not(.button--disabled) {
            background: rgba(159, 232, 112, 0.1);
            transform: translateY(-2px);
            box-shadow: var(--shadow-glow-brand);
        }

        &:active:not(.button--disabled) {
            transform: translateY(0);
            box-shadow: none;
        }
    }

    // 禁用状态
    &.button--disabled {
        opacity: 0.5;
        cursor: not-allowed;
        transform: none !important;
        box-shadow: none !important;
    }

    // 加载状态
    &.button--loading {
        cursor: wait;
    }
}

.button-content {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-xs);
    transition: opacity var(--transition) var(--ease);

    &.button-content--hidden {
        opacity: 0;
    }
}

.button-loading {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
}

.loading-spinner {
    width: 16px;
    height: 16px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top-color: #FFFFFF;
    border-radius: var(--radius-full);
    animation: spin 0.6s linear infinite;
}

@keyframes spin {
    to {
        transform: rotate(360deg);
    }
}
</style>
