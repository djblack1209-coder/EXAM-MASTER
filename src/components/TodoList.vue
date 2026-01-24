<!-- REFACTOR: Modern todo list with design system utilities -->
<template>
  <view :class="['todo-list', isDark ? 'todo-dark' : 'todo-light']">
    <!-- 待办项列表 -->
    <view class="todo-items">
      <view 
        v-for="item in sortedTodos" 
        :key="item.id" 
        :class="['todo-item', isDark ? 'item-dark' : 'item-light', item.completed && 'item-completed']"
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
import { computed, ref } from 'vue'

// 定义props
const props = defineProps({
  todos: {
    type: Array,
    default: () => [
      { id: 1, text: '复习数学第三章', completed: false, priority: 'Priority' },
      { id: 2, text: '完成物理作业', completed: false, priority: 'Important' },
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

// 本地待办列表状态 - 直接使用 props.todos，不需要本地副本
// 排序后的待办列表：未完成在前，已完成在后
const sortedTodos = computed(() => {
  return [...props.todos].sort((a, b) => {
    if (a.completed === b.completed) return 0
    return a.completed ? 1 : -1
  })
})

// 获取优先级class
const getPriorityClass = (item) => {
  const priority = item.priority || 'Priority'
  if (priority === 'Priority') return 'priority'
  if (priority === 'Important') return 'important'
  if (priority === 'Normal') return 'normal'
  return 'priority'
}

// 切换待办状态 - 只触发事件，不修改本地状态
const onToggleTodo = (id) => {
  // 震动反馈
  try {
    if (typeof uni.vibrateShort === 'function') {
      uni.vibrateShort({ type: 'light' })
    }
  } catch (e) {
    console.log('Vibration not supported')
  }
  
  // 触发父组件事件
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
  border: 2rpx solid #9CA3AF;
  background: transparent;
  cursor: pointer;
}

.item-checkbox:active {
  transform: scale(0.9);
}

.checkbox-completed {
  background: #10B981;
  border-color: #10B981;
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