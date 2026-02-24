<template>
  <view :class="['todo-list', isDark ? 'todo-dark' : 'todo-light']">
    <!-- 待办项列表 - 不排序，按原始顺序显示 -->
    <view class="todo-items">
      <view
        v-for="item in todos"
        :key="item.id"
        :class="['todo-item', isDark ? 'item-dark' : 'item-light', item.completed && 'item-completed']"
        @tap="handleToggle(item.id)"
        @longpress="handleLongPress(item)"
      >
        <!-- 左侧：状态图标 -->
        <view :class="['item-checkbox', item.completed && 'checkbox-completed']">
          <text v-if="item.completed" class="checkbox-icon">
            ✓
          </text>
        </view>

        <!-- 中间：任务文字 -->
        <text :class="['item-text', item.completed && 'text-completed']">
          {{ item.text }}
        </text>

        <!-- 右侧：优先级标签 -->
        <view :class="['item-badge', 'badge-' + getPriorityClass(item.priority)]">
          <text class="badge-text">
            {{ item.priority || '日常' }}
          </text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
// ✅ 统一日志工具（生产环境自动禁用）
import { logger } from '@/utils/logger.js';

// 定义props
const _props = defineProps({
  todos: {
    type: Array,
    default: () => []
  },
  isDark: {
    type: Boolean,
    default: false
  }
});

// 定义emits
const emit = defineEmits(['toggleTodo', 'editTodo']);

// 获取优先级class
const getPriorityClass = (priority) => {
  if (!priority) return 'normal';
  // 支持中文标签映射
  if (priority === '优先' || priority === 'Priority' || priority === 'high') return 'priority';
  if (priority === '重要' || priority === 'Important' || priority === 'medium') return 'important';
  if (priority === '日常' || priority === 'Normal' || priority === 'low') return 'normal';
  return 'normal';
};

// 处理点击切换
const handleToggle = (id) => {
  logger.log('[TodoList] Clicked todo ID:', id);

  // 震动反馈
  try {
    if (typeof uni !== 'undefined' && typeof uni.vibrateShort === 'function') {
      uni.vibrateShort({ type: 'light' });
    }
  } catch (_e) {
    logger.log('[TodoList] Vibration not supported');
  }

  // 触发父组件事件
  emit('toggleTodo', id);
};

// 处理长按编辑
const handleLongPress = (item) => {
  logger.log('[TodoList] Long press todo:', item);

  // 震动反馈
  try {
    if (typeof uni !== 'undefined' && typeof uni.vibrateShort === 'function') {
      uni.vibrateShort({ type: 'medium' });
    }
  } catch (_e) {
    logger.log('[TodoList] Vibration not supported');
  }

  // 触发编辑事件
  emit('editTodo', item);
};
</script>

<style lang="scss" scoped>
/* ==================== 待办列表容器 ==================== */
.todo-list {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 24rpx;
}

/* ==================== 待办项列表 ==================== */
.todo-items {
  display: flex;
  flex-direction: column;
  gap: 24rpx;
}

/* ==================== 单个待办项 ==================== */
.todo-item {
  display: flex;
  align-items: center;
  gap: 24rpx;
  padding: 32rpx;
  border-radius: 24rpx;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  border: 1rpx solid;
}

/* 浅色模式 */
.item-light {
  background: var(--bg-card);
  border-color: rgba(255, 255, 255, 0.3);
}

/* 深色模式 */
.item-dark {
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(24rpx);
  -webkit-backdrop-filter: blur(24rpx);
  border-color: rgba(255, 255, 255, 0.1);
}

/* 已完成项目样式 */
.item-completed {
  opacity: 0.6;
}

/* ==================== 复选框 ==================== */
.item-checkbox {
  width: 48rpx;
  height: 48rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  border: 2rpx solid #9ca3af;
  background: transparent;
  cursor: pointer;
}
.dark-mode .item-checkbox {
  border-color: #6b7280;
}

.item-checkbox:active {
  transform: scale(0.9);
}

.checkbox-completed {
  background: #10b981;
  border-color: #10b981;
  animation: checkboxPop 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

@keyframes checkboxPop {
  0% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.2);
  }
  100% {
    transform: scale(1);
  }
}

.checkbox-icon {
  font-size: 28rpx;
  color: #ffffff;
  font-weight: 700;
  line-height: 1;
}

/* ==================== 任务文字 ==================== */
.item-text {
  flex: 1;
  font-size: 28rpx;
  font-weight: 500;
  line-height: 1.5;
  min-width: 0;
  word-break: break-word;
}

/* 浅色模式文字 */
.todo-light .item-text {
  color: #1a1d1f;
}

/* 深色模式文字 - 白色 */
.todo-dark .item-text {
  color: #ffffff;
}

/* 已完成状态 */
.text-completed {
  text-decoration: line-through;
  opacity: 0.5;
}

/* ==================== 优先级标签 ==================== */
.item-badge {
  padding: 8rpx 24rpx;
  border-radius: 20rpx;
  flex-shrink: 0;
}

.badge-text {
  font-size: 20rpx;
  font-weight: 600;
  line-height: 1;
}

/* 优先 - 红色 */
.badge-priority {
  background: rgba(239, 68, 68, 0.1);
}

.badge-priority .badge-text {
  color: #ef4444;
}

/* 重要 - 黄色 */
.badge-important {
  background: rgba(245, 158, 11, 0.1);
}

.badge-important .badge-text {
  color: #f59e0b;
}

/* 日常 - 灰色 */
.badge-normal {
  background: rgba(156, 163, 175, 0.1);
}

.badge-normal .badge-text {
  color: #9ca3af;
}

/* 深色模式下的标签增强对比度 */
.todo-dark .badge-priority {
  background: rgba(239, 68, 68, 0.2);
}

.todo-dark .badge-priority .badge-text {
  color: #f87171;
}

.todo-dark .badge-important {
  background: rgba(245, 158, 11, 0.2);
}

.todo-dark .badge-important .badge-text {
  color: #fcd34d;
}

.todo-dark .badge-normal {
  background: rgba(156, 163, 175, 0.2);
}
</style>
