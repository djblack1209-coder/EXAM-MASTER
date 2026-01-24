<template>
    <view v-if="visible" class="glass-modal" :class="{ 'is-closing': isClosing }" @click="handleMaskClick">
        <!-- 毛玻璃背景 -->
        <view class="modal-backdrop"></view>

        <!-- 模态框内容 -->
        <view class="modal-container" :class="[
            `position-${position}`,
            `size-${size}`
        ]" :style="containerStyle" @click.stop>
            <!-- 关闭按钮 -->
            <view v-if="showClose" class="modal-close" @click="handleClose">
                <text class="close-icon">✕</text>
            </view>

            <!-- 头部 -->
            <view v-if="title || $slots.header" class="modal-header">
                <slot name="header">
                    <text class="header-title">{{ title }}</text>
                    <text v-if="subtitle" class="header-subtitle">{{ subtitle }}</text>
                </slot>
            </view>

            <!-- 内容 -->
            <view class="modal-body" :class="{ 'has-footer': $slots.footer || confirmText }">
                <slot></slot>
            </view>

            <!-- 底部 -->
            <view v-if="$slots.footer || confirmText" class="modal-footer">
                <slot name="footer">
                    <view class="footer-actions">
                        <view v-if="cancelText" class="action-button button-cancel" @click="handleCancel">
                            <text class="button-text">{{ cancelText }}</text>
                        </view>
                        <view v-if="confirmText" class="action-button button-confirm" @click="handleConfirm">
                            <text class="button-text">{{ confirmText }}</text>
                        </view>
                    </view>
                </slot>
            </view>
        </view>
    </view>
</template>

<script setup>
import { ref, computed, watch } from 'vue'

const props = defineProps({
    // 是否显示
    visible: {
        type: Boolean,
        default: false
    },
    // 标题
    title: {
        type: String,
        default: ''
    },
    // 副标题
    subtitle: {
        type: String,
        default: ''
    },
    // 位置
    position: {
        type: String,
        default: 'center',
        validator: (value) => ['center', 'bottom', 'top'].includes(value)
    },
    // 尺寸
    size: {
        type: String,
        default: 'medium',
        validator: (value) => ['small', 'medium', 'large', 'full'].includes(value)
    },
    // 是否显示关闭按钮
    showClose: {
        type: Boolean,
        default: true
    },
    // 点击遮罩是否关闭
    maskClosable: {
        type: Boolean,
        default: true
    },
    // 确认按钮文字
    confirmText: {
        type: String,
        default: ''
    },
    // 取消按钮文字
    cancelText: {
        type: String,
        default: ''
    },
    // 自定义样式
    customStyle: {
        type: Object,
        default: () => ({})
    }
})

const emit = defineEmits(['update:visible', 'confirm', 'cancel', 'close'])

const isClosing = ref(false)

// 容器样式
const containerStyle = computed(() => {
    return {
        ...props.customStyle
    }
})

// 监听visible变化
watch(() => props.visible, (newVal) => {
    if (!newVal) {
        isClosing.value = false
    }
})

// 处理遮罩点击
const handleMaskClick = () => {
    if (props.maskClosable) {
        handleClose()
    }
}

// 处理关闭
const handleClose = () => {
    isClosing.value = true
    setTimeout(() => {
        emit('update:visible', false)
        emit('close')
    }, 300) // 等待关闭动画完成
}

// 处理确认
const handleConfirm = () => {
    emit('confirm')
}

// 处理取消
const handleCancel = () => {
    emit('cancel')
    handleClose()
}
</script>

<style lang="scss" scoped>
.glass-modal {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    animation: fadeIn 0.3s ease;

    &.is-closing {
        animation: fadeOut 0.3s ease;

        .modal-container {
            animation: slideOut 0.3s ease;
        }
    }
}

// 毛玻璃背景
.modal-backdrop {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.4);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
}

// 模态框容器
.modal-container {
    position: relative;
    background: var(--bg-glass);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border-radius: var(--radius-xl);
    box-shadow: var(--shadow-xl);
    border: 1px solid var(--border-glass);
    overflow: hidden;
    animation: slideIn 0.3s ease;
    max-height: 80vh;
    display: flex;
    flex-direction: column;

    // 位置变体
    &.position-center {
        margin: var(--spacing-xl);
    }

    &.position-bottom {
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        border-bottom-left-radius: 0;
        border-bottom-right-radius: 0;
        animation: slideInBottom 0.3s ease;
    }

    &.position-top {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        border-top-left-radius: 0;
        border-top-right-radius: 0;
        animation: slideInTop 0.3s ease;
    }

    // 尺寸变体
    &.size-small {
        width: 300px;
    }

    &.size-medium {
        width: 400px;
    }

    &.size-large {
        width: 600px;
    }

    &.size-full {
        width: calc(100% - var(--spacing-xl) * 2);
        height: calc(100% - var(--spacing-xl) * 2);
        max-height: none;
    }
}

// 关闭按钮
.modal-close {
    position: absolute;
    top: var(--spacing-md);
    right: var(--spacing-md);
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: var(--bg-tertiary);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    z-index: 1;
    transition: all 0.3s ease;

    &:hover {
        background: var(--bg-hover);
        transform: rotate(90deg);
    }

    &:active {
        transform: rotate(90deg) scale(0.9);
    }

    .close-icon {
        font-size: 18px;
        color: var(--text-secondary);
        font-weight: 300;
    }
}

// 头部
.modal-header {
    padding: var(--spacing-xl);
    padding-bottom: var(--spacing-md);
    border-bottom: 1px solid var(--border-glass);

    .header-title {
        display: block;
        font-size: var(--font-xl);
        font-weight: 600;
        color: var(--text-primary);
        margin-bottom: var(--spacing-xs);
    }

    .header-subtitle {
        display: block;
        font-size: var(--font-sm);
        color: var(--text-secondary);
    }
}

// 内容
.modal-body {
    flex: 1;
    padding: var(--spacing-xl);
    overflow-y: auto;
    color: var(--text-primary);

    &.has-footer {
        padding-bottom: var(--spacing-md);
    }

    // 自定义滚动条
    &::-webkit-scrollbar {
        width: 6px;
    }

    &::-webkit-scrollbar-track {
        background: transparent;
    }

    &::-webkit-scrollbar-thumb {
        background: var(--bg-tertiary);
        border-radius: 3px;

        &:hover {
            background: var(--bg-hover);
        }
    }
}

// 底部
.modal-footer {
    padding: var(--spacing-md) var(--spacing-xl) var(--spacing-xl);
    border-top: 1px solid var(--border-glass);

    .footer-actions {
        display: flex;
        gap: var(--spacing-md);
        justify-content: flex-end;
    }

    .action-button {
        padding: var(--spacing-sm) var(--spacing-xl);
        border-radius: var(--radius-md);
        cursor: pointer;
        transition: all 0.3s ease;
        min-width: 80px;
        text-align: center;

        .button-text {
            font-size: var(--font-md);
            font-weight: 500;
        }

        &.button-cancel {
            background: var(--bg-tertiary);

            .button-text {
                color: var(--text-secondary);
            }

            &:hover {
                background: var(--bg-hover);
            }

            &:active {
                transform: scale(0.95);
            }
        }

        &.button-confirm {
            background: var(--brand-primary);
            box-shadow: var(--shadow-glow-brand);

            .button-text {
                color: white;
            }

            &:hover {
                background: var(--brand-secondary);
                box-shadow: var(--shadow-glow-brand-strong);
            }

            &:active {
                transform: scale(0.95);
            }
        }
    }
}

// 动画
@keyframes fadeIn {
    from {
        opacity: 0;
    }

    to {
        opacity: 1;
    }
}

@keyframes fadeOut {
    from {
        opacity: 1;
    }

    to {
        opacity: 0;
    }
}

@keyframes slideIn {
    from {
        opacity: 0;
        transform: scale(0.9) translateY(-20px);
    }

    to {
        opacity: 1;
        transform: scale(1) translateY(0);
    }
}

@keyframes slideOut {
    from {
        opacity: 1;
        transform: scale(1) translateY(0);
    }

    to {
        opacity: 0;
        transform: scale(0.9) translateY(-20px);
    }
}

@keyframes slideInBottom {
    from {
        transform: translateY(100%);
    }

    to {
        transform: translateY(0);
    }
}

@keyframes slideInTop {
    from {
        transform: translateY(-100%);
    }

    to {
        transform: translateY(0);
    }
}
</style>
