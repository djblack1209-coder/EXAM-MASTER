/**
 * Todo Store 补丁
 * 解决检查点1.3：待办事项编辑功能
 *
 * 功能：
 * 1. 新增待办
 * 2. 编辑待办
 * 3. 删除待办
 * 4. 排序功能
 * 5. 提醒功能
 */

// 存储键名
import storageService from '@/services/storageService.js';
import { logger } from '@/utils/logger.js';
const STORAGE_KEY = 'todo_tasks_v2';

/**
 * Todo Store 扩展方法
 * 用于补充现有 todo store 的功能
 */
export const todoStorePatch = {
  /**
   * 添加新待办
   * @param {Object} store - Pinia store 实例
   * @param {Object} todo - 待办数据
   */
  addTodo(store, todo) {
    const newTodo = {
      id: todo.id || `todo_${Date.now()}`,
      title: todo.text || todo.title,
      done: todo.completed || false,
      tag: todo.priority || 'Normal',
      reminderTime: todo.reminderTime || '',
      createdAt: todo.createdAt || Date.now(),
      updatedAt: Date.now(),
      order: store.tasks.length
    };

    store.tasks.unshift(newTodo);
    this.saveTasks(store.tasks);

    // 设置提醒
    if (newTodo.reminderTime) {
      this.scheduleReminder(newTodo);
    }

    logger.log('[TodoStorePatch] 添加待办:', newTodo.title);
    return newTodo;
  },

  /**
   * 更新待办
   * @param {Object} store - Pinia store 实例
   * @param {Object} todo - 待办数据
   */
  updateTodo(store, todo) {
    const index = store.tasks.findIndex((t) => t.id === todo.id);
    if (index === -1) {
      logger.warn('[TodoStorePatch] 待办不存在:', todo.id);
      return null;
    }

    const updatedTodo = {
      ...store.tasks[index],
      title: todo.text || todo.title || store.tasks[index].title,
      tag: todo.priority || store.tasks[index].tag,
      reminderTime: todo.reminderTime !== undefined ? todo.reminderTime : store.tasks[index].reminderTime,
      done: todo.completed !== undefined ? todo.completed : store.tasks[index].done,
      updatedAt: Date.now()
    };

    store.tasks[index] = updatedTodo;
    this.saveTasks(store.tasks);

    // 更新提醒
    if (updatedTodo.reminderTime) {
      this.scheduleReminder(updatedTodo);
    } else {
      this.cancelReminder(updatedTodo.id);
    }

    logger.log('[TodoStorePatch] 更新待办:', updatedTodo.title);
    return updatedTodo;
  },

  /**
   * 删除待办
   * @param {Object} store - Pinia store 实例
   * @param {string} todoId - 待办ID
   */
  deleteTodo(store, todoId) {
    const index = store.tasks.findIndex((t) => t.id === todoId);
    if (index === -1) {
      logger.warn('[TodoStorePatch] 待办不存在:', todoId);
      return false;
    }

    const deleted = store.tasks.splice(index, 1)[0];
    this.saveTasks(store.tasks);

    // 取消提醒
    this.cancelReminder(todoId);

    logger.log('[TodoStorePatch] 删除待办:', deleted.title);
    return true;
  },

  /**
   * 切换待办完成状态
   * @param {Object} store - Pinia store 实例
   * @param {string} todoId - 待办ID
   */
  toggleTodo(store, todoId) {
    const task = store.tasks.find((t) => t.id === todoId);
    if (!task) {
      logger.warn('[TodoStorePatch] 待办不存在:', todoId);
      return false;
    }

    task.done = !task.done;
    task.updatedAt = Date.now();

    if (task.done) {
      task.completedAt = Date.now();
      // 完成后取消提醒
      this.cancelReminder(todoId);
    } else {
      delete task.completedAt;
      // 恢复提醒
      if (task.reminderTime) {
        this.scheduleReminder(task);
      }
    }

    this.saveTasks(store.tasks);

    logger.log('[TodoStorePatch] 切换待办状态:', task.title, task.done);
    return true;
  },

  /**
   * 重新排序待办
   * @param {Object} store - Pinia store 实例
   * @param {number} fromIndex - 原位置
   * @param {number} toIndex - 目标位置
   */
  reorderTodos(store, fromIndex, toIndex) {
    if (fromIndex === toIndex) return;

    const [removed] = store.tasks.splice(fromIndex, 1);
    store.tasks.splice(toIndex, 0, removed);

    // 更新 order 字段
    store.tasks.forEach((task, index) => {
      task.order = index;
    });

    this.saveTasks(store.tasks);

    logger.log('[TodoStorePatch] 重新排序:', fromIndex, '->', toIndex);
  },

  /**
   * 批量删除已完成的待办
   * @param {Object} store - Pinia store 实例
   */
  clearCompleted(store) {
    const completedIds = store.tasks.filter((t) => t.done).map((t) => t.id);

    store.tasks = store.tasks.filter((t) => !t.done);
    this.saveTasks(store.tasks);

    // 取消所有已完成待办的提醒
    completedIds.forEach((id) => this.cancelReminder(id));

    logger.log('[TodoStorePatch] 清除已完成待办:', completedIds.length);
    return completedIds.length;
  },

  /**
   * 获取待办统计
   * @param {Object} store - Pinia store 实例
   */
  getStats(store) {
    const total = store.tasks.length;
    const completed = store.tasks.filter((t) => t.done).length;
    const pending = total - completed;
    const urgent = store.tasks.filter((t) => t.tag === 'Priority' && !t.done).length;
    const important = store.tasks.filter((t) => t.tag === 'Important' && !t.done).length;

    return {
      total,
      completed,
      pending,
      urgent,
      important,
      completionRate: total > 0 ? Math.round((completed / total) * 100) : 0
    };
  },

  /**
   * 保存待办到本地存储
   * @param {Array} tasks - 待办列表
   */
  saveTasks(tasks) {
    try {
      storageService.save(STORAGE_KEY, tasks);
    } catch (e) {
      logger.error('[TodoStorePatch] 保存失败:', e);
    }
  },

  /**
   * 从本地存储加载待办
   */
  loadTasks() {
    try {
      return storageService.get(STORAGE_KEY, []);
    } catch (e) {
      logger.error('[TodoStorePatch] 加载失败:', e);
      return [];
    }
  },

  /**
   * 设置提醒
   * @param {Object} todo - 待办数据
   */
  scheduleReminder(todo) {
    if (!todo.reminderTime) return;

    // 解析提醒时间
    const [hours, minutes] = todo.reminderTime.split(':').map(Number);
    const now = new Date();
    const reminderDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes);

    // 如果时间已过，设置为明天
    if (reminderDate <= now) {
      reminderDate.setDate(reminderDate.getDate() + 1);
    }

    const delay = reminderDate.getTime() - now.getTime();

    // 存储定时器ID
    const timerId = setTimeout(() => {
      this.showReminder(todo);
    }, delay);

    // 保存定时器引用
    if (!this._reminderTimers) {
      this._reminderTimers = {};
    }
    this._reminderTimers[todo.id] = timerId;

    logger.log('[TodoStorePatch] 设置提醒:', todo.title, '在', todo.reminderTime);
  },

  /**
   * 取消提醒
   * @param {string} todoId - 待办ID
   */
  cancelReminder(todoId) {
    if (this._reminderTimers && this._reminderTimers[todoId]) {
      clearTimeout(this._reminderTimers[todoId]);
      delete this._reminderTimers[todoId];
      logger.log('[TodoStorePatch] 取消提醒:', todoId);
    }
  },

  /**
   * 显示提醒通知
   * @param {Object} todo - 待办数据
   */
  showReminder(todo) {
    // 震动提醒
    try {
      uni.vibrateLong();
    } catch (e) {
      logger.log('[TodoStorePatch] 振动提醒失败:', e);
    }

    // 显示通知
    uni.showModal({
      title: '待办提醒',
      content: todo.title,
      confirmText: '完成',
      cancelText: '稍后',
      success: (res) => {
        if (res.confirm) {
          // 标记完成
          uni.$emit('todo:complete', todo.id);
        } else {
          // 延后提醒（15分钟后）
          setTimeout(
            () => {
              this.showReminder(todo);
            },
            15 * 60 * 1000
          );
        }
      }
    });

    // 本地通知（如果支持）
    // #ifdef APP-PLUS
    plus.push.createMessage(todo.title, JSON.stringify({ todoId: todo.id }), {
      title: '待办提醒',
      sound: 'system'
    });
    // #endif
  },

  /**
   * 导出待办数据
   * @param {Object} store - Pinia store 实例
   */
  exportTodos(store) {
    return JSON.stringify(store.tasks, null, 2);
  },

  /**
   * 导入待办数据
   * @param {Object} store - Pinia store 实例
   * @param {string} jsonData - JSON 数据
   */
  importTodos(store, jsonData) {
    try {
      const tasks = JSON.parse(jsonData);
      if (!Array.isArray(tasks)) {
        throw new Error('Invalid data format');
      }

      // 合并数据，避免重复
      const existingIds = new Set(store.tasks.map((t) => t.id));
      const newTasks = tasks.filter((t) => !existingIds.has(t.id));

      store.tasks = [...store.tasks, ...newTasks];
      this.saveTasks(store.tasks);

      logger.log('[TodoStorePatch] 导入待办:', newTasks.length);
      return newTasks.length;
    } catch (e) {
      logger.error('[TodoStorePatch] 导入失败:', e);
      return -1;
    }
  }
};

// 默认导出
export default todoStorePatch;

/**
 * 使用示例：
 *
 * import { useTodoStore } from '@/stores/modules/todo';
 * import { todoStorePatch } from '@/utils/todo-store-patch';
 *
 * const todoStore = useTodoStore();
 *
 * // 添加待办
 * todoStorePatch.addTodo(todoStore, {
 *   text: '完成作业',
 *   priority: 'Important',
 *   reminderTime: '18:00'
 * });
 *
 * // 更新待办
 * todoStorePatch.updateTodo(todoStore, {
 *   id: 'todo_123',
 *   text: '完成数学作业',
 *   priority: 'Priority'
 * });
 *
 * // 删除待办
 * todoStorePatch.deleteTodo(todoStore, 'todo_123');
 *
 * // 获取统计
 * const stats = todoStorePatch.getStats(todoStore);
 */
