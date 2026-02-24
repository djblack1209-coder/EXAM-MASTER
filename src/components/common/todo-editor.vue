<!-- 待办事项编辑器组件：底部弹出编辑、新增/编辑/删除、优先级选择 -->
<template>
  <view v-if="visible" class="todo-editor-mask" @tap="handleClose">
    <view class="todo-editor-content" :class="{ 'editor-dark': isDark }" @tap.stop>
      <!-- 拖拽指示条 -->
      <view class="drag-indicator" />

      <!-- 头部 -->
      <view class="editor-header">
        <text class="editor-title">
          {{ isEdit ? '编辑待办' : '新建待办' }}
        </text>
        <view class="header-actions">
          <view v-if="isEdit" class="delete-btn" @tap="handleDelete">
            <text class="delete-icon">
              🗑️
            </text>
          </view>
          <view class="close-btn" @tap="handleClose">
            <text class="close-icon">
              ×
            </text>
          </view>
        </view>
      </view>

      <!-- 输入区域 -->
      <view class="input-section">
        <view class="input-wrapper" :class="{ 'input-focused': isFocused }">
          <input
            v-model="todoText"
            class="todo-input"
            :class="{ 'input-dark': isDark }"
            placeholder="输入待办事项..."
            :placeholder-style="isDark ? 'color: rgba(255,255,255,0.4)' : 'color: #999'"
            maxlength="100"
            @focus="isFocused = true"
            @blur="isFocused = false"
            @confirm="handleSave"
          />
          <view v-if="todoText" class="clear-btn" @tap="todoText = ''">
            <text class="clear-icon">
              ×
            </text>
          </view>
        </view>
      </view>

      <!-- 优先级选择 -->
      <view class="priority-section">
        <text class="section-label">
          优先级
        </text>
        <view class="priority-options">
          <view
            v-for="item in priorityOptions"
            :key="item.value"
            :class="['priority-item', selectedPriority === item.value && 'priority-selected']"
            :style="{ borderColor: selectedPriority === item.value ? item.color : 'transparent' }"
            @tap="selectedPriority = item.value"
          >
            <view class="priority-dot" :style="{ background: item.color }" />
            <text class="priority-label">
              {{ item.label }}
            </text>
          </view>
        </view>
      </view>

      <!-- 提醒时间（可选） -->
      <view class="reminder-section">
        <text class="section-label">
          提醒时间
        </text>
        <view class="reminder-picker" @tap="showTimePicker">
          <text class="reminder-text">
            {{ reminderText }}
          </text>
          <text class="reminder-arrow">
            ›
          </text>
        </view>
      </view>

      <!-- 快捷操作 -->
      <view v-if="isEdit" class="quick-actions">
        <view class="action-item" @tap="handleToggleComplete">
          <text class="action-icon">
            {{ todoData.completed ? '↩️' : '✅' }}
          </text>
          <text class="action-text">
            {{ todoData.completed ? '标记未完成' : '标记完成' }}
          </text>
        </view>
        <view class="action-item" @tap="handleDuplicate">
          <text class="action-icon">
            📋
          </text>
          <text class="action-text">
            复制待办
          </text>
        </view>
      </view>

      <!-- 底部按钮 -->
      <view class="editor-footer">
        <view class="btn-cancel" @tap="handleClose">
          <text class="btn-text">
            取消
          </text>
        </view>
        <view class="btn-save" :class="{ 'btn-disabled': !todoText.trim() }" @tap="handleSave">
          <text class="btn-text">
            {{ isEdit ? '保存' : '添加' }}
          </text>
        </view>
      </view>
    </view>

    <!-- 时间选择器 -->
    <picker
      v-if="showPicker"
      mode="time"
      :value="reminderTime"
      @change="handleTimeChange"
      @cancel="showPicker = false"
    >
      <view />
    </picker>
  </view>
</template>

<script>
import { logger } from '@/utils/logger.js';

export default {
  name: 'TodoEditor',

  props: {
    // 是否显示
    visible: {
      type: Boolean,
      default: false
    },
    // 编辑的待办数据（为空则为新建）
    todoData: {
      type: Object,
      default: () => ({})
    },
    // 深色模式
    isDark: {
      type: Boolean,
      default: false
    }
  },

  emits: ['close', 'update:visible', 'save', 'delete', 'toggle'],

  data() {
    return {
      todoText: '',
      selectedPriority: '日常',
      reminderTime: '',
      isFocused: false,
      showPicker: false,

      priorityOptions: [
        { value: '优先', label: '优先', color: '#EF4444' },
        { value: '重要', label: '重要', color: '#F59E0B' },
        { value: '日常', label: '日常', color: '#9CA3AF' }
      ]
    };
  },

  computed: {
    isEdit() {
      return this.todoData && this.todoData.id;
    },

    reminderText() {
      return this.reminderTime || '不提醒';
    }
  },

  watch: {
    visible(val) {
      if (val) {
        this.initData();
      }
    },

    todoData: {
      handler(val) {
        if (val && val.id) {
          this.initData();
        }
      },
      deep: true
    }
  },

  methods: {
    // 初始化数据
    initData() {
      if (this.isEdit) {
        this.todoText = this.todoData.text || '';
        this.selectedPriority = this.todoData.priority || '日常';
        this.reminderTime = this.todoData.reminderTime || '';
      } else {
        this.todoText = '';
        this.selectedPriority = '日常';
        this.reminderTime = '';
      }
    },

    // 关闭编辑器
    handleClose() {
      this.$emit('close');
      this.$emit('update:visible', false);
    },

    // 保存待办
    handleSave() {
      const text = this.todoText.trim();
      if (!text) {
        uni.showToast({
          title: '请输入待办内容',
          icon: 'none'
        });
        return;
      }

      // 震动反馈
      try {
        uni.vibrateShort({ type: 'light' });
      } catch (e) {
        logger.warn('[TodoEditor] 震动反馈失败:', e.message || e);
      }

      const todoItem = {
        id: this.isEdit ? this.todoData.id : `todo_${Date.now()}`,
        text,
        priority: this.selectedPriority,
        reminderTime: this.reminderTime,
        completed: this.isEdit ? this.todoData.completed : false,
        createdAt: this.isEdit ? this.todoData.createdAt : Date.now(),
        updatedAt: Date.now()
      };

      this.$emit('save', todoItem);
      this.handleClose();

      uni.showToast({
        title: this.isEdit ? '已保存' : '已添加',
        icon: 'success'
      });
    },

    // 删除待办
    handleDelete() {
      uni.showModal({
        title: '确认删除',
        content: '确定要删除这个待办事项吗？',
        confirmColor: '#EF4444',
        success: (res) => {
          if (res.confirm) {
            // 震动反馈
            try {
              uni.vibrateShort({ type: 'medium' });
            } catch (e) {
              logger.warn('[TodoEditor] vibrateShort failed in handleDelete', e);
            }

            this.$emit('delete', this.todoData.id);
            this.handleClose();

            uni.showToast({
              title: '已删除',
              icon: 'none'
            });
          }
        }
      });
    },

    // 切换完成状态
    handleToggleComplete() {
      // 震动反馈
      try {
        uni.vibrateShort({ type: 'light' });
      } catch (e) {
        logger.warn('[TodoEditor] vibrateShort failed in handleToggleComplete', e);
      }

      this.$emit('toggle', this.todoData.id);

      uni.showToast({
        title: this.todoData.completed ? '已标记未完成' : '已完成',
        icon: 'none'
      });
    },

    // 复制待办
    handleDuplicate() {
      const newTodo = {
        id: `todo_${Date.now()}`,
        text: this.todoText + ' (副本)',
        priority: this.selectedPriority,
        reminderTime: '',
        completed: false,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      this.$emit('save', newTodo);

      uni.showToast({
        title: '已复制',
        icon: 'success'
      });
    },

    // 显示时间选择器
    showTimePicker() {
      this.showPicker = true;
    },

    // 时间选择变化
    handleTimeChange(e) {
      this.reminderTime = e.detail.value;
      this.showPicker = false;
    }
  }
};
</script>

<style lang="scss" scoped>
.todo-editor-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(10rpx);
  z-index: 9999;
  display: flex;
  align-items: flex-end;
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.todo-editor-content {
  width: 100%;
  background: #ffffff;
  border-radius: 32rpx 32rpx 0 0;
  padding: 16rpx 32rpx 32rpx;
  padding-bottom: calc(32rpx + env(safe-area-inset-bottom));
  animation: slideUp 0.3s cubic-bezier(0.4, 0, 0.2, 1);

  &.editor-dark {
    background: #1a1a1a;
  }
}

@keyframes slideUp {
  from {
    transform: translateY(100%);
  }
  to {
    transform: translateY(0);
  }
}

/* 拖拽指示条 */
.drag-indicator {
  width: 80rpx;
  height: 8rpx;
  background: rgba(0, 0, 0, 0.1);
  border-radius: 4rpx;
  margin: 0 auto 24rpx;

  .editor-dark & {
    background: rgba(255, 255, 255, 0.2);
  }
}

/* 头部 */
.editor-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 32rpx;
}

.editor-title {
  font-size: 36rpx;
  font-weight: 700;

  .todo-editor-content:not(.editor-dark) & {
    color: #1a1a1a;
  }
  .editor-dark & {
    color: #ffffff;
  }
}

.header-actions {
  display: flex;
  gap: 16rpx;
}

.delete-btn,
.close-btn {
  width: 60rpx;
  height: 60rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.05);

  .editor-dark & {
    background: rgba(255, 255, 255, 0.1);
  }

  &:active {
    opacity: 0.7;
  }
}

.delete-icon {
  font-size: 28rpx;
}

.close-icon {
  font-size: 40rpx;
  color: var(--ds-color-text-tertiary);
}

/* 输入区域 */
.input-section {
  margin-bottom: 32rpx;
}

.input-wrapper {
  display: flex;
  align-items: center;
  padding: 24rpx;
  border-radius: 20rpx;
  background: rgba(0, 0, 0, 0.03);
  border: 2rpx solid transparent;
  transition: all 0.3s ease;

  .editor-dark & {
    background: rgba(255, 255, 255, 0.05);
  }

  &.input-focused {
    border-color: #10b981;
    background: rgba(16, 185, 129, 0.05);

    .editor-dark & {
      border-color: #34d399;
      background: rgba(16, 185, 129, 0.1);
    }
  }
}

.todo-input {
  flex: 1;
  font-size: 32rpx;

  .todo-editor-content:not(.editor-dark) & {
    color: #1a1a1a;
  }
  &.input-dark {
    color: #ffffff;
  }
}

.clear-btn {
  width: 48rpx;
  height: 48rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.1);

  .editor-dark & {
    background: rgba(255, 255, 255, 0.2);
  }
}

.clear-icon {
  font-size: 28rpx;
  color: var(--ds-color-text-tertiary);
}

/* 优先级选择 */
.priority-section,
.reminder-section {
  margin-bottom: 24rpx;
}

.section-label {
  display: block;
  font-size: 26rpx;
  font-weight: 600;
  margin-bottom: 16rpx;

  .todo-editor-content:not(.editor-dark) & {
    color: #666666;
  }
  .editor-dark & {
    color: rgba(255, 255, 255, 0.7);
  }
}

.priority-options {
  display: flex;
  gap: 16rpx;
}

.priority-item {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12rpx;
  padding: 20rpx;
  border-radius: 16rpx;
  background: rgba(0, 0, 0, 0.03);
  border: 2rpx solid transparent;
  transition: all 0.3s ease;

  .editor-dark & {
    background: rgba(255, 255, 255, 0.05);
  }

  &.priority-selected {
    background: rgba(16, 185, 129, 0.1);
  }

  &:active {
    opacity: 0.7;
  }
}

.priority-dot {
  width: 16rpx;
  height: 16rpx;
  border-radius: 50%;
}

.priority-label {
  font-size: 26rpx;

  .todo-editor-content:not(.editor-dark) & {
    color: #1a1a1a;
  }
  .editor-dark & {
    color: #ffffff;
  }
}

/* 提醒时间 */
.reminder-picker {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24rpx;
  border-radius: 16rpx;
  background: rgba(0, 0, 0, 0.03);

  .editor-dark & {
    background: rgba(255, 255, 255, 0.05);
  }

  &:active {
    opacity: 0.7;
  }
}

.reminder-text {
  font-size: 28rpx;

  .todo-editor-content:not(.editor-dark) & {
    color: #1a1a1a;
  }
  .editor-dark & {
    color: #ffffff;
  }
}

.reminder-arrow {
  font-size: 32rpx;
  color: var(--ds-color-text-tertiary);
}

/* 快捷操作 */
.quick-actions {
  display: flex;
  gap: 16rpx;
  margin-bottom: 32rpx;
  padding-top: 24rpx;
  border-top: 1rpx solid rgba(0, 0, 0, 0.05);

  .editor-dark & {
    border-color: rgba(255, 255, 255, 0.1);
  }
}

.action-item {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
  padding: 20rpx;
  border-radius: 16rpx;
  background: rgba(0, 0, 0, 0.03);

  .editor-dark & {
    background: rgba(255, 255, 255, 0.05);
  }

  &:active {
    opacity: 0.7;
  }
}

.action-icon {
  font-size: 28rpx;
}

.action-text {
  font-size: 24rpx;

  .todo-editor-content:not(.editor-dark) & {
    color: #666666;
  }
  .editor-dark & {
    color: rgba(255, 255, 255, 0.7);
  }
}

/* 底部按钮 */
.editor-footer {
  display: flex;
  gap: 24rpx;
  margin-top: 16rpx;
}

.btn-cancel,
.btn-save {
  flex: 1;
  height: 88rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 44rpx;
  font-size: 30rpx;
  font-weight: 600;
  transition: all 0.3s ease;

  &:active {
    transform: scale(0.98);
  }
}

.btn-cancel {
  background: rgba(0, 0, 0, 0.05);

  .editor-dark & {
    background: rgba(255, 255, 255, 0.1);
  }

  .btn-text {
    .todo-editor-content:not(.editor-dark) & {
      color: #666666;
    }
    .editor-dark & {
      color: rgba(255, 255, 255, 0.7);
    }
  }
}

.btn-save {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);

  .btn-text {
    color: #ffffff;
  }

  &.btn-disabled {
    opacity: 0.5;
    pointer-events: none;
  }
}
</style>
