<!-- REFACTOR: Modern todo list with design system utilities -->
<template>
  <view :class="['todo-list', isDark ? 'todo-dark' : 'todo-light']">
    <!-- 待办项列表 -->
    <view class="todo-items">
      <view 
        v-for="(item, index) in todos" 
        :key="item.id" 
        :class="['todo-item', isDark ? 'item-dark' : 'item-light']"
        @tap="onToggleTodo(item.id)"
      >
        <!-- 左侧：状态图标 -->
        <view :class="['item-checkbox', item.completed && 'checkbox-completed']">
          <text v-if="item.completed" class="checkbox-icon">✓</text>
        </view>

        <!-- 中间：任务文字 -->
        <text :class="['item-text', item.completed && 'text-completed']">
          {{ item.text }}
        </text>

        <!-- 右侧：优先级标签 -->
        <view :class="['item-badge', 'badge-' + getPriorityClass(item)]">
          <text class="badge-text">{{ item.priority || 'Priority' }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { computed } from 'vue'

// 定义props
const props = defineProps({
  todos: {
    type: Array,
    default: () => [
      { id: 1, text: '复习数学第三章', completed: false, priority: 'Priority' },
      { id: 2, text: '完成物理作业', completed: true, priority: 'Important' },
      { id: 3, text: '准备英语演讲', completed: false, priority: 'Normal' }
    ]
  },
  isDark: {
    type: Boolean,
    default: false
  }
})

// 定义emits
const emit = defineEmits(['toggleTodo'])

// 获取优先级class
const getPriorityClass = (item) => {
  const priority = item.priority || 'Priority'
  if (priority === 'Priority') return 'priority'
  if (priority === 'Important') return 'important'
  if (priority === 'Normal') return 'normal'
  return 'priority'
}

// 切换待办状态
const onToggleTodo = (id) => {
  emit('toggleTodo', id)
}
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
  background: #FFFFFF;
  border-color: rgba(255, 255, 255, 0.3);
}

.item-light:active {
  transform: translateY(-2rpx);
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.08);
}

/* 深色模式 */
.item-dark {
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(24rpx);
  -webkit-backdrop-filter: blur(24rpx);
  border-color: rgba(255, 255, 255, 0.1);
}

.item-dark:active {
  transform: translateY(-2rpx);
  box-shadow: 0 4rpx 16rpx rgba(0, 242, 255, 0.1);
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
  border: 2rpx solid #9CA3AF;
  background: transparent;
}

.checkbox-completed {
  background: #10B981;
  border-color: #10B981;
}

.checkbox-icon {
  font-size: 28rpx;
  color: #FFFFFF;
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
  color: #1A1D1F;
}

/* 深色模式文字 - 白色 */
.todo-dark .item-text {
  color: #FFFFFF;
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

/* Priority - 绿色 */
.badge-priority {
  background: rgba(16, 185, 129, 0.1);
}

.badge-priority .badge-text {
  color: #10B981;
}

/* Important - 黄色 */
.badge-important {
  background: rgba(245, 158, 11, 0.1);
}

.badge-important .badge-text {
  color: #F59E0B;
}

/* Normal - 灰色 */
.badge-normal {
  background: rgba(156, 163, 175, 0.1);
}

.badge-normal .badge-text {
  color: #9CA3AF;
}

/* 深色模式下的标签增强对比度 */
.todo-dark .badge-priority {
  background: rgba(16, 185, 129, 0.2);
}

.todo-dark .badge-important {
  background: rgba(245, 158, 11, 0.2);
}

.todo-dark .badge-important .badge-text {
  color: #FCD34D;
}

.todo-dark .badge-normal {
  background: rgba(156, 163, 175, 0.2);
}
</style>