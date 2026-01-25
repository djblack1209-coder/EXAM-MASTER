<template>
    <view class="enhanced-avatar" :class="[
        `size-${size}`,
        `status-${status}`,
        { 'has-glow': showGlow },
        { 'is-clickable': clickable }
    ]" :style="avatarStyle" @click="handleClick">
        <!-- 头像容器 -->
        <view class="avatar-container">
            <!-- 品牌色边框 -->
            <view class="avatar-border" v-if="showBorder"></view>

            <!-- 头像图片 -->
            <image v-if="src" :src="src" class="avatar-image" mode="aspectFill" @error="handleError" />

            <!-- 默认头像（文字） -->
            <view v-else class="avatar-placeholder">
                <text class="placeholder-text">{{ placeholderText }}</text>
            </view>

            <!-- 状态指示器 -->
            <view v-if="status !== 'none'" class="status-indicator" :class="`indicator-${status}`">
                <view class="indicator-dot"></view>
            </view>

            <!-- 徽章 -->
            <view v-if="badge" class="avatar-badge" :class="`badge-${badgeType}`">
                <text class="badge-text">{{ badge }}</text>
            </view>
        </view>

        <!-- 标签 -->
        <view v-if="label" class="avatar-label">
            <text class="label-text">{{ label }}</text>
        </view>
    </view>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
    // 头像图片URL
    src: {
        type: String,
        default: ''
    },
    // 尺寸
    size: {
        type: String,
        default: 'medium',
        validator: (value) => ['small', 'medium', 'large', 'xlarge'].includes(value)
    },
    // 占位文字（当没有图片时显示）
    placeholder: {
        type: String,
        default: ''
    },
    // 状态
    status: {
        type: String,
        default: 'none',
        validator: (value) => ['none', 'online', 'busy', 'away', 'offline'].includes(value)
    },
    // 是否显示光晕
    showGlow: {
        type: Boolean,
        default: false
    },
    // 是否显示品牌色边框
    showBorder: {
        type: Boolean,
        default: false
    },
    // 徽章文字
    badge: {
        type: [String, Number],
        default: ''
    },
    // 徽章类型
    badgeType: {
        type: String,
        default: 'primary',
        validator: (value) => ['primary', 'success', 'warning', 'error'].includes(value)
    },
    // 标签文字
    label: {
        type: String,
        default: ''
    },
    // 是否可点击
    clickable: {
        type: Boolean,
        default: false
    },
    // 自定义样式
    customStyle: {
        type: Object,
        default: () => ({})
    }
})

const emit = defineEmits(['click', 'error'])

// 占位文字处理
const placeholderText = computed(() => {
    if (props.placeholder) {
        // 取第一个字符（支持中文和英文）
        return props.placeholder.charAt(0).toUpperCase()
    }
    return '?'
})

// 头像样式
const avatarStyle = computed(() => {
    return {
        ...props.customStyle
    }
})

// 处理点击
const handleClick = () => {
    if (props.clickable) {
        emit('click')
    }
}

// 处理图片加载失败
const handleError = (e) => {
    emit('error', e)
}
</script>

<style lang="scss" scoped>
.enhanced-avatar {
    display: inline-flex;
    flex-direction: column;
    align-items: center;
    gap: var(--spacing-xs);

    &.is-clickable {
        cursor: pointer;

        .avatar-container {
            transition: transform 0.3s ease;
    will-change: transform;

            &:active {
                transform: scale(0.95);
            }
        }
    }
}

// 头像容器
.avatar-container {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    overflow: visible;
}

// 品牌色边框
.avatar-border {
    position: absolute;
    top: -4px;
    left: -4px;
    right: -4px;
    bottom: -4px;
    border-radius: 50%;
    background: linear-gradient(135deg,
            var(--brand-primary) 0%,
            var(--brand-secondary) 100%);
    z-index: 0;
}

// 头像图片
.avatar-image {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    object-fit: cover;
    position: relative;
    z-index: 1;
    background: var(--bg-tertiary);
}

// 默认头像
.avatar-placeholder {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    background: linear-gradient(135deg,
            var(--brand-primary) 0%,
            var(--brand-secondary) 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    z-index: 1;

    .placeholder-text {
        font-weight: 600;
        color: white;
        text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
    }
}

// 状态指示器
.status-indicator {
    position: absolute;
    bottom: 0;
    right: 0;
    border-radius: 50%;
    background: var(--bg-primary);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);

    .indicator-dot {
        border-radius: 50%;
        animation: statusPulse 2s ease-in-out infinite;
    will-change: transform, opacity;
    }

    &.indicator-online .indicator-dot {
        background: var(--success);
        box-shadow: 0 0 8px var(--success);
    }

    &.indicator-busy .indicator-dot {
        background: var(--error);
        box-shadow: 0 0 8px var(--error);
    }

    &.indicator-away .indicator-dot {
        background: var(--warning);
        box-shadow: 0 0 8px var(--warning);
    }

    &.indicator-offline .indicator-dot {
        background: var(--text-tertiary);
    }
}

// 徽章
.avatar-badge {
    position: absolute;
    top: -4px;
    right: -4px;
    min-width: 20px;
    height: 20px;
    padding: 0 6px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);

    .badge-text {
        font-size: 11px;
        font-weight: 700;
        color: white;
        line-height: 1;
    }

    &.badge-primary {
        background: var(--brand-primary);
    }

    &.badge-success {
        background: var(--success);
    }

    &.badge-warning {
        background: var(--warning);
    }

    &.badge-error {
        background: var(--error);
    }
}

// 标签
.avatar-label {
    max-width: 100%;
    text-align: center;

    .label-text {
        font-size: var(--font-sm);
        color: var(--text-secondary);
        display: block;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
}

// 尺寸变体
.size-small {
    .avatar-container {
        width: 32px;
        height: 32px;
    }

    .placeholder-text {
        font-size: 14px;
    }

    .status-indicator {
        width: 12px;
        height: 12px;

        .indicator-dot {
            width: 8px;
            height: 8px;
        }
    }

    .avatar-badge {
        min-width: 16px;
        height: 16px;
        padding: 0 4px;

        .badge-text {
            font-size: 10px;
        }
    }
}

.size-medium {
    .avatar-container {
        width: 48px;
        height: 48px;
    }

    .placeholder-text {
        font-size: 18px;
    }

    .status-indicator {
        width: 16px;
        height: 16px;

        .indicator-dot {
            width: 10px;
            height: 10px;
        }
    }
}

.size-large {
    .avatar-container {
        width: 64px;
        height: 64px;
    }

    .placeholder-text {
        font-size: 24px;
    }

    .status-indicator {
        width: 20px;
        height: 20px;

        .indicator-dot {
            width: 12px;
            height: 12px;
        }
    }

    .avatar-badge {
        min-width: 24px;
        height: 24px;
        padding: 0 8px;

        .badge-text {
            font-size: 12px;
        }
    }
}

.size-xlarge {
    .avatar-container {
        width: 96px;
        height: 96px;
    }

    .placeholder-text {
        font-size: 36px;
    }

    .status-indicator {
        width: 24px;
        height: 24px;

        .indicator-dot {
            width: 16px;
            height: 16px;
        }
    }

    .avatar-badge {
        min-width: 28px;
        height: 28px;
        padding: 0 10px;

        .badge-text {
            font-size: 14px;
        }
    }
}

// 光晕效果
.has-glow {
    .avatar-container {
        filter: drop-shadow(0 0 12px var(--brand-primary-alpha));
        animation: glowPulse 3s ease-in-out infinite;
    }

    &.status-online .avatar-container {
        filter: drop-shadow(0 0 12px var(--success-alpha));
    }

    &.status-busy .avatar-container {
        filter: drop-shadow(0 0 12px var(--error-alpha));
    }

    &.status-away .avatar-container {
        filter: drop-shadow(0 0 12px var(--warning-alpha));
    }
}

// 动画
@keyframes statusPulse {

    0%,
    100% {
        transform: scale(1);
        opacity: 1;
    }

    50% {
        transform: scale(1.1);
        opacity: 0.8;
    }
}

@keyframes glowPulse {

    0%,
    100% {
        filter: drop-shadow(0 0 12px var(--brand-primary-alpha));
    }

    50% {
        filter: drop-shadow(0 0 20px var(--brand-primary-alpha));
    }
}
</style>
