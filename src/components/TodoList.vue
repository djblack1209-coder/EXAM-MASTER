<!-- REFACTOR: Modern todo list with design system utilities -->
<template>
  <view class="todo-list ds-card" :class="{ ' ': isDark }">
    <!-- 标题栏 -->
    <view class="list-header ds-flex ds-flex-between">
      <text class="header-title ds-text-xl ds-font-bold ds-text-primary">To do</text>
      <text class="header-progress ds-text-lg ds-font-bold">{{ progressValue }}%</text>
    </view>

    <!-- 进度条 -->
    <view class="progress-bar">
      <view class="progress-fill" :style="{ width: progressValue + '%' }"></view>
    </view>

    <!-- 待办项列表 -->
    <view class="todo-items ds-flex-col ds-gap-md">
      <view v-for="(item, index) in todos" :key="item.id" class="todo-item" @tap="onToggleTodo(item.id)">
        <!-- 左侧：状态图标和任务文字 -->
        <view class="item-left">
          <view class="item-status-icon" :class="{ 'is-completed': item.completed, 'unchecked': !item.completed }">
            <svg v-if="item.completed" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white"
              stroke-width="4" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          </view>

          <text class="item-text" :class="{ 'is-completed': item.completed }">
            {{ item.text }}
          </text>
        </view>

        <!-- 右侧：优先级标签 -->
        <view class="item-priority" :class="'priority-' + getPriorityClass(item, index)">
          <text class="priority-text">{{ item.priority || '优先' }}</text>
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
    default: () => []
  },
  progress: {
    type: Number,
    default: null
  },
  isDark: {
    type: Boolean,
    default: false
  }
})

// 定义emits
const emit = defineEmits(['toggleTodo'])

// 计算完成进度
const progressValue = computed(() => {
  if (props.progress !== null) return props.progress
  if (props.todos.length === 0) return 0
  const completed = props.todos.filter(item => item.completed).length
  return Math.round((completed / props.todos.length) * 100)
})

// 获取优先级class - 根据优先级文本和索引分配不同颜色
const getPriorityClass = (item, index) => {
  // 根据优先级文本和索引分配颜色
  if (item.priority === '优先') {
    // 优先：根据索引分配不同颜色
    // 索引0: 浅绿色，索引1: 浅粉色，索引3: 浅紫色
    if (index === 0) return 'youxian-green'
    if (index === 1) return 'youxian-pink'
    if (index === 3) return 'youxian-purple'
    return 'youxian-green'
  } else if (item.priority === '重先') {
    // 重先：浅黄色背景，黄色文字
    return 'zhongxian-yellow'
  }
  return 'youxian-green'
}

// 切换待办状态
const onToggleTodo = (id) => {
  emit('toggleTodo', id)
}
</script>

<style lang="scss" scoped>
.todo-list {
  width: 100%;
  background: var(--bg-card);
  border-top-left-radius: 24px;
  border-top-right-radius: 24px;
  padding: 24px;
  box-shadow: 0px 4px 12px rgba(0, 0, 0, 0.08);
  box-sizing: border-box;

  .list-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;

    .header-title {
      font-size: 20px;
      font-weight: 700;
      color: #212121;
      -webkit-font-smoothing: antialiased;
    }

    .header-progress {
      font-size: 18px;
      font-weight: 700;
      color: #07C160;
      -webkit-font-smoothing: antialiased;
    }
  }

  .progress-bar {
    width: 100%;
    height: 6px;
    background: #E5E7EB;
    border-radius: 3px;
    margin-bottom: 16px;
    overflow: hidden;

    .progress-fill {
      height: 6px;
      background: #07C160;
      border-radius: 3px;
      transition: width 0.5s ease-in-out;
    }
  }

  .todo-items {
    display: flex;
    flex-direction: column;
    gap: 16px;

    .todo-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      -webkit-tap-highlight-color: transparent;
      box-sizing: border-box;

      .item-left {
        display: flex;
        align-items: center;
        gap: 12px;
        flex: 1;
        min-width: 0;

        .item-status-icon {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          transition: all 0.3s ease;

          /* 未完成状态 - 空心灰圆圈 */
          &.unchecked {
            background: transparent;
            border: 2px solid #9CA3AF;
          }

          /* 已完成状态 - 实心绿对勾 */
          &.is-completed {
            background: #07C160;
            border: none;

            /* 对勾SVG */
            svg {
              width: 16px;
              height: 16px;
            }
          }
        }

        .item-text {
          font-size: 16px;
          font-weight: 400;
          color: #212121;
          -webkit-font-smoothing: antialiased;

          &.is-completed {
            text-decoration: line-through;
            color: #9CA3AF;
          }
        }
      }

      .item-priority {
        padding: 4px 12px;
        border-radius: 6px;
        flex-shrink: 0;

        .priority-text {
          font-size: 12px;
          font-weight: 500;
          -webkit-font-smoothing: antialiased;
        }

        /* 优先 - 浅绿色背景 + 绿色文字 */
        &.priority-youxian-green {
          background: #D1FAE5;

          .priority-text {
            color: #07C160;
          }
        }

        /* 优先 - 浅粉色背景 + 粉色文字 */
        &.priority-youxian-pink {
          background: #FCE7F3;

          .priority-text {
            color: #EC4899;
          }
        }

        /* 优先 - 浅紫色背景 + 紫色文字 */
        &.priority-youxian-purple {
          background: #F3E8FF;

          .priority-text {
            color: #9333EA;
          }
        }

        /* 重先 - 浅黄色背景 + 黄色文字 */
        &.priority-zhongxian-yellow {
          background: #FEF3C7;

          .priority-text {
            color: #F59E0B;
          }
        }
      }
    }
  }
}

/* VISUAL: Dark mode styles */
.todo-list. {
  background: var(--ds-color-surface-secondary, #1c1c1e);
  box-shadow: 0px 4px 12px rgba(0, 0, 0, 0.3);

  .list-header {
    .header-title {
      color: var(--ds-color-text-primary, var(--bg-card));
    }

    .header-progress {
      color: var(--brand-color);
      /* Wise 绿色深色模式 */
    }
  }

  .progress-bar {
    background: #2c2c2e;

    .progress-fill {
      background: var(--brand-color);
    }
  }

  .todo-items {
    .todo-item {
      .item-left {
        .item-status-icon {
          &.unchecked {
            border-color: #6c757d;
          }

          &.is-completed {
            background: var(--brand-color);
          }
        }

        .item-text {
          color: var(--ds-color-text-primary, var(--bg-card));

          &.is-completed {
            color: #6c757d;
          }
        }
      }

      .item-priority {

        /* 深色模式下的优先级标签 */
        &.priority-youxian-green {
          background: rgba(159, 232, 112, 0.2);

          .priority-text {
            color: var(--brand-color);
          }
        }

        &.priority-youxian-pink {
          background: rgba(236, 72, 153, 0.2);

          .priority-text {
            color: #F472B6;
          }
        }

        &.priority-youxian-purple {
          background: rgba(147, 51, 234, 0.2);

          .priority-text {
            color: #A78BFA;
          }
        }

        &.priority-zhongxian-yellow {
          background: rgba(245, 158, 11, 0.2);

          .priority-text {
            color: #FCD34D;
          }
        }
      }
    }
  }
}
</style>
