<!-- 待办事项编辑器组件：底部弹出编辑、新增/编辑/删除、优先级选择 -->
<template>
  <view v-if="visible" class="todo-editor-mask" @tap="handleClose">
    <view class="todo-editor-content" :class="{ 'editor-dark': isDark }" @tap.stop>
      <view class="drag-indicator" />

      <view class="editor-header">
        <view>
          <text class="editor-eyebrow"> Todo Editor </text>
          <text class="editor-title">
            {{ isEdit ? '编辑待办' : '新建待办' }}
          </text>
        </view>
        <view class="header-actions">
          <view v-if="isEdit" class="delete-btn" @tap="handleDelete">
            <BaseIcon name="delete" :size="32" />
          </view>
          <view class="close-btn" @tap="handleClose">
            <text class="close-icon"> × </text>
          </view>
        </view>
      </view>

      <view class="group-card input-section">
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
            <text class="clear-icon"> × </text>
          </view>
        </view>
      </view>

      <view class="group-card priority-section">
        <text class="section-label"> 优先级 </text>
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

      <view class="group-card reminder-section">
        <text class="section-label"> 提醒时间 </text>
        <view class="reminder-picker" @tap="showTimePicker">
          <text class="reminder-text">
            {{ reminderText }}
          </text>
          <text class="reminder-arrow"> › </text>
        </view>
      </view>

      <view v-if="isEdit" class="group-card quick-actions-block">
        <text class="section-label"> 快捷操作 </text>
        <view class="quick-actions">
          <view class="action-item" @tap="handleToggleComplete">
            <BaseIcon :name="todoData.completed ? 'refresh' : 'success'" :size="28" />
            <text class="action-text">
              {{ todoData.completed ? '标记未完成' : '标记完成' }}
            </text>
          </view>
          <view class="action-item" @tap="handleDuplicate">
            <BaseIcon name="copy" :size="28" />
            <text class="action-text"> 复制待办 </text>
          </view>
        </view>
      </view>

      <view class="editor-footer">
        <view class="btn-cancel" @tap="handleClose">
          <text class="btn-text"> 取消 </text>
        </view>
        <view class="btn-save" :class="{ 'btn-disabled': !todoText.trim() }" @tap="handleSave">
          <text class="btn-text">
            {{ isEdit ? '保存' : '添加' }}
          </text>
        </view>
      </view>
    </view>

    <!-- 时间选择器 -->
    <picker v-if="showPicker" mode="time" :value="reminderTime" @change="handleTimeChange" @cancel="showPicker = false">
      <view class="picker-trigger"> 选择时间 </view>
    </picker>
  </view>
</template>

<script>
import { logger } from '@/utils/logger.js';
import BaseIcon from '@/components/base/base-icon/base-icon.vue';

export default {
  name: 'TodoEditor',
  components: { BaseIcon },

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
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 9999;
  display: flex;
  align-items: flex-end;
  background: rgba(9, 18, 12, 0.32);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}

.todo-editor-content {
  width: 100%;
  padding: 14rpx 24rpx calc(24rpx + env(safe-area-inset-bottom));
  border-radius: 38rpx 38rpx 0 0;
  background:
    linear-gradient(180deg, var(--apple-specular-soft) 0%, transparent 42%),
    linear-gradient(160deg, var(--apple-glass-card-bg) 0%, var(--apple-group-bg) 100%);
  border: 1px solid var(--apple-glass-border-strong);
  box-shadow: 0 -20rpx 70rpx rgba(21, 49, 28, 0.18);
  animation: slideUp 0.26s ease;
}

.drag-indicator {
  width: 84rpx;
  height: 8rpx;
  border-radius: 999rpx;
  background: rgba(0, 0, 0, 0.12);
  margin: 6rpx auto 18rpx;
}

.editor-header,
.header-actions,
.delete-btn,
.close-btn,
.priority-item,
.reminder-picker,
.action-item,
.btn-cancel,
.btn-save,
.clear-btn {
  display: flex;
  align-items: center;
}

.editor-header {
  justify-content: space-between;
  /* gap: 16rpx; -- replaced for Android WebView compat */
  & > view + view,
  & > text + text,
  & > view + text,
  & > text + view {
    margin-left: 16rpx;
  }
  margin-bottom: 20rpx;
}

.editor-eyebrow,
.editor-title,
.section-label,
.priority-label,
.reminder-text,
.action-text,
.btn-text {
  display: block;
}

.editor-eyebrow {
  margin-bottom: 6rpx;
  font-size: 20rpx;
  letter-spacing: 3rpx;
  text-transform: uppercase;
  color: var(--text-secondary);
}

.editor-title {
  font-size: 36rpx;
  font-weight: 700;
  color: var(--text-main);
}

.header-actions {
  /* gap: 14rpx; -- replaced for Android WebView compat */
  & > view + view,
  & > text + text,
  & > view + text,
  & > text + view {
    margin-left: 14rpx;
  }
}

.delete-btn,
.close-btn,
.clear-btn {
  justify-content: center;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.62);
  border: 1px solid rgba(255, 255, 255, 0.42);
  box-shadow: var(--apple-shadow-surface);
  color: var(--text-main);
}

.delete-btn,
.close-btn {
  width: 60rpx;
  height: 60rpx;
}

.close-icon,
.clear-icon {
  color: var(--text-sub);
}

.close-icon {
  font-size: 40rpx;
}

.clear-btn {
  width: 48rpx;
  height: 48rpx;
}

.group-card {
  margin-bottom: 16rpx;
  padding: 22rpx;
  border-radius: 26rpx;
  background: rgba(255, 255, 255, 0.56);
  border: 1px solid rgba(255, 255, 255, 0.42);
  box-shadow: var(--apple-shadow-surface);
}

.section-label {
  margin-bottom: 14rpx;
  font-size: 24rpx;
  font-weight: 620;
  color: var(--text-secondary);
}

.input-wrapper {
  display: flex;
  align-items: center;
  /* gap: 12rpx; -- replaced for Android WebView compat */
  & > view + view,
  & > text + text,
  & > view + text,
  & > text + view {
    margin-left: 12rpx;
  }
  padding: 20rpx 22rpx;
  border-radius: 22rpx;
  background: rgba(255, 255, 255, 0.68);
  border: 1px solid rgba(255, 255, 255, 0.44);
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease;
}

.input-wrapper.input-focused {
  border-color: rgba(52, 199, 89, 0.34);
  box-shadow: 0 10rpx 24rpx rgba(52, 199, 89, 0.14);
}

.todo-input {
  flex: 1;
  font-size: 30rpx;
  color: var(--text-main);
}

.todo-input.input-dark {
  color: var(--text-main);
}

.priority-options {
  display: flex;
  /* gap: 12rpx; -- replaced for Android WebView compat */
  & > view + view,
  & > text + text,
  & > view + text,
  & > text + view {
    margin-left: 12rpx;
  }
}

.priority-item {
  flex: 1;
  justify-content: center;
  /* gap: 10rpx; -- replaced for Android WebView compat */
  & > view + view,
  & > text + text,
  & > view + text,
  & > text + view {
    margin-left: 10rpx;
  }
  padding: 18rpx 14rpx;
  border-radius: 999rpx;
  background: rgba(255, 255, 255, 0.68);
  border: 1px solid rgba(255, 255, 255, 0.44);
}

.priority-item.priority-selected {
  background: rgba(255, 255, 255, 0.88);
  box-shadow: var(--apple-shadow-surface);
}

.priority-dot {
  width: 14rpx;
  height: 14rpx;
  border-radius: 50%;
}

.priority-label,
.reminder-text,
.action-text,
.btn-text {
  font-size: 24rpx;
  color: var(--text-main);
}

.reminder-picker {
  justify-content: space-between;
  padding: 20rpx 22rpx;
  border-radius: 22rpx;
  background: rgba(255, 255, 255, 0.68);
  border: 1px solid rgba(255, 255, 255, 0.44);
}

.reminder-arrow {
  font-size: 32rpx;
  color: var(--text-sub);
}

.quick-actions {
  display: flex;
  /* gap: 12rpx; -- replaced for Android WebView compat */
  & > view + view,
  & > text + text,
  & > view + text,
  & > text + view {
    margin-left: 12rpx;
  }
}

.action-item {
  flex: 1;
  justify-content: center;
  /* gap: 8rpx; -- replaced for Android WebView compat */
  & > view + view,
  & > text + text,
  & > view + text,
  & > text + view {
    margin-left: 8rpx;
  }
  padding: 18rpx 12rpx;
  border-radius: 22rpx;
  background: rgba(255, 255, 255, 0.68);
  border: 1px solid rgba(255, 255, 255, 0.44);
}

.editor-footer {
  display: flex;
  /* gap: 14rpx; -- replaced for Android WebView compat */
  & > view + view,
  & > text + text,
  & > view + text,
  & > text + view {
    margin-left: 14rpx;
  }
  margin-top: 20rpx;
}

.btn-cancel,
.btn-save {
  flex: 1;
  justify-content: center;
  height: 88rpx;
  border-radius: 999rpx;
}

.btn-cancel {
  background: rgba(255, 255, 255, 0.62);
  border: 1px solid rgba(255, 255, 255, 0.42);
  box-shadow: var(--apple-shadow-surface);
}

.btn-save {
  background: var(--cta-primary-bg);
  border: 1px solid var(--cta-primary-border);
  box-shadow: var(--cta-primary-shadow);
}

.btn-save .btn-text {
  color: var(--cta-primary-text);
}

.btn-save.btn-disabled {
  opacity: 0.5;
  pointer-events: none;
}

.delete-btn:active,
.close-btn:active,
.clear-btn:active,
.priority-item:active,
.reminder-picker:active,
.action-item:active,
.btn-cancel:active,
.btn-save:active {
  transform: scale(0.97);
}

.editor-dark,
.editor-dark .group-card,
.editor-dark .delete-btn,
.editor-dark .close-btn,
.editor-dark .clear-btn,
.editor-dark .input-wrapper,
.editor-dark .priority-item,
.editor-dark .reminder-picker,
.editor-dark .action-item,
.editor-dark .btn-cancel {
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.08) 0%, transparent 42%),
    linear-gradient(160deg, rgba(18, 20, 28, 0.92) 0%, rgba(10, 12, 18, 0.88) 100%);
  border-color: rgba(255, 255, 255, 0.1);
}

.editor-dark .btn-save {
  background: var(--cta-primary-bg);
  border-color: var(--cta-primary-border);
}

.editor-dark .delete-btn,
.editor-dark .action-item {
  background:
    linear-gradient(180deg, rgba(10, 132, 255, 0.12) 0%, transparent 42%),
    linear-gradient(160deg, rgba(18, 20, 28, 0.94) 0%, rgba(10, 12, 18, 0.9) 100%);
  border-color: rgba(10, 132, 255, 0.18);
}

.editor-dark .close-btn,
.editor-dark .clear-btn {
  background:
    linear-gradient(180deg, rgba(95, 170, 255, 0.12) 0%, transparent 42%),
    linear-gradient(160deg, rgba(18, 20, 28, 0.94) 0%, rgba(10, 12, 18, 0.9) 100%);
  border-color: rgba(95, 170, 255, 0.18);
}

@keyframes slideUp {
  from {
    transform: translateY(100%);
  }

  to {
    transform: translateY(0);
  }
}
</style>
