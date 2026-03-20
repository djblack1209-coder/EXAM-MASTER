/**
 * useTodo — 待办事项交互逻辑
 * 从 todoMixin 迁移为 Composition API composable
 */
import { ref } from 'vue';
import { logger } from '@/utils/logger.js';
import { todoStorePatch } from '@/utils/helpers/todo-store-patch.js';
import { vibrateLight } from '@/utils/helpers/haptic.js';
import { isUserLoggedIn } from '@/utils/auth/loginGuard.js';

function _requireAuth(action) {
  if (isUserLoggedIn()) return true;
  uni.showToast({ title: '请先登录后' + action, icon: 'none' });
  return false;
}

export function useTodo(todoStore) {
  const showTodoEditor = ref(false);
  const editingTodo = ref(null);

  function handleEditPlan() {
    if (!_requireAuth('编辑计划')) return;
    vibrateLight();
    editingTodo.value = null;
    showTodoEditor.value = true;
  }

  function handleToggleTodo(todoId) {
    if (!_requireAuth('操作待办')) return;
    try {
      const success = todoStore.toggleTask(todoId);
      if (success) {
        try {
          uni.vibrateShort?.();
        } catch (_) {
          /* */
        }
      } else {
        logger.error('[useTodo] Todo not found:', todoId);
      }
    } catch (error) {
      logger.error('[useTodo] Toggle failed:', error);
      uni.showToast({ title: '操作失败，请重试', icon: 'none' });
    }
  }

  function handleTodoSave(todo) {
    if (!_requireAuth('保存待办')) return;
    if (editingTodo.value) {
      todoStorePatch.updateTodo(todoStore, todo);
    } else {
      todoStorePatch.addTodo(todoStore, todo);
    }
    showTodoEditor.value = false;
    editingTodo.value = null;
  }

  function handleTodoDelete(todoId) {
    if (!_requireAuth('删除待办')) return;
    todoStorePatch.deleteTodo(todoStore, todoId);
    showTodoEditor.value = false;
    editingTodo.value = null;
  }

  function openTodoEditor(todo) {
    editingTodo.value = {
      id: todo.id,
      text: todo.text,
      priority: todo.priority,
      completed: todo.completed
    };
    showTodoEditor.value = true;
  }

  return {
    showTodoEditor,
    editingTodo,
    handleEditPlan,
    handleToggleTodo,
    handleTodoSave,
    handleTodoDelete,
    openTodoEditor
  };
}
