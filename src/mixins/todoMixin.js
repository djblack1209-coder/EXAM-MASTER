/**
 * 待办事项 Mixin
 * 从 index/index.vue 提取的待办事项相关逻辑
 *
 * 提供：
 * - data: showTodoEditor, editingTodo
 * - methods: handleEditPlan, handleToggleTodo, handleTodoSave, handleTodoDelete, openTodoEditor
 *
 * 依赖：
 * - this.todoStore (来自宿主组件)
 * - logger, todoStorePatch, vibrateLight (导入)
 */
import { logger } from '@/utils/logger.js';
import { todoStorePatch } from '@/utils/helpers/todo-store-patch.js';
import { vibrateLight } from '@/utils/helpers/haptic.js';

export const todoMixin = {
  data() {
    return {
      showTodoEditor: false,
      editingTodo: null
    };
  },

  methods: {
    /**
     * 打开待办编辑器（新建模式）
     */
    handleEditPlan() {
      vibrateLight();
      this.editingTodo = null;
      this.showTodoEditor = true;
    },

    /**
     * 处理待办事项切换完成状态
     * @param {string|number} todoId - 待办事项ID
     */
    handleToggleTodo(todoId) {
      logger.log('[TodoMixin] Toggle todo ID:', todoId);

      try {
        const success = this.todoStore.toggleTask(todoId);
        if (success) {
          logger.log(`[TodoMixin] Todo ${todoId} toggled successfully`);
          try {
            if (typeof uni.vibrateShort === 'function') {
              uni.vibrateShort();
            }
          } catch (_) { /* 非关键操作 */ }
        } else {
          logger.error('[TodoMixin] Todo not found:', todoId);
        }
      } catch (error) {
        logger.error('[TodoMixin] Toggle todo failed:', error);
        uni.showToast({
          title: '操作失败，请重试',
          icon: 'none'
        });
      }
    },

    /**
     * 处理待办保存（新建或编辑）
     * @param {Object} todo - 待办数据
     */
    handleTodoSave(todo) {
      logger.log('[TodoMixin] Todo save:', todo);

      if (this.editingTodo) {
        todoStorePatch.updateTodo(this.todoStore, todo);
      } else {
        todoStorePatch.addTodo(this.todoStore, todo);
      }

      this.showTodoEditor = false;
      this.editingTodo = null;
    },

    /**
     * 处理待办删除
     * @param {string|number} todoId - 待办事项ID
     */
    handleTodoDelete(todoId) {
      logger.log('[TodoMixin] Todo delete:', todoId);
      todoStorePatch.deleteTodo(this.todoStore, todoId);
      this.showTodoEditor = false;
      this.editingTodo = null;
    },

    /**
     * 打开待办编辑器（编辑模式）
     * @param {Object} todo - 待编辑的待办数据
     */
    openTodoEditor(todo) {
      this.editingTodo = {
        id: todo.id,
        text: todo.text,
        priority: todo.priority,
        completed: todo.completed
      };
      this.showTodoEditor = true;
    }
  }
};

export default todoMixin;
