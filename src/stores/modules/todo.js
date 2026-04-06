/**
 * 任务列表 Store（Composition API）
 * 管理今日计划的任务数据
 * ✅ 2.2: 消除重复默认任务、统一存储 key
 * ✅ H027: 从 Options API 迁移到 Composition API
 */

import { ref, computed } from 'vue';
import { defineStore } from 'pinia';
import { storageService } from '../../services/storageService.js';
import { logger } from '@/utils/logger.js';

/** 存储 key 常量（消除硬编码魔法字符串） */
const STORAGE_KEY = 'my_tasks';

// H-06 FIX: 使用自增计数器生成唯一 ID，避免 Date.now() 同毫秒碰撞
let _todoIdCounter = 0;
function generateTodoId() {
  return `${Date.now().toString(36)}_${(++_todoIdCounter).toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

/** 默认任务模板（消除重复定义） */
function createDefaultTasks() {
  return [
    { id: generateTodoId(), title: '完成 3 组政治选择题', done: false, priority: 'high', tag: '优先', tagColor: 'red' },
    {
      id: generateTodoId(),
      title: '英语阅读真题分析',
      done: false,
      priority: 'medium',
      tag: '重要',
      tagColor: 'yellow'
    },
    { id: generateTodoId(), title: '复习昨天错题本', done: false, priority: 'low', tag: '日常', tagColor: 'gray' }
  ];
}

export const useTodoStore = defineStore('todo', () => {
  // ==================== 状态 ====================
  const tasks = ref([]);
  const loading = ref(false);

  // ==================== 计算属性 ====================

  /** 获取任务总数 */
  const totalTasks = computed(() => tasks.value.length);

  /** 获取已完成任务数 */
  const completedTasks = computed(() => tasks.value.filter((task) => task.done).length);

  /** 获取任务完成百分比 */
  const completionRate = computed(() => {
    if (tasks.value.length === 0) return 0;
    return Math.round((tasks.value.filter((task) => task.done).length / tasks.value.length) * 100);
  });

  /** 获取按优先级排序的任务列表 */
  const sortedTasks = computed(() => {
    const priorityOrder = { high: 3, medium: 2, low: 1 };
    return [...tasks.value].sort((a, b) => {
      // 先按完成状态排序，未完成的在前面
      if (a.done !== b.done) {
        return a.done ? 1 : -1;
      }
      // 再按优先级排序
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  });

  // ==================== 方法 ====================

  /** 保存任务列表到本地存储 */
  function saveTasks() {
    storageService.save(STORAGE_KEY, tasks.value, true); // 静默失败
  }

  /** 初始化任务列表，从本地存储加载数据 */
  function initTasks() {
    loading.value = true;
    try {
      const savedTasks = storageService.get(STORAGE_KEY, []);
      if (savedTasks && Array.isArray(savedTasks) && savedTasks.length > 0) {
        // 检查并更新旧的标签格式
        tasks.value = savedTasks.map((task) => {
          if (task.tag === '高优') {
            task.tag = '优先';
            task.tagColor = 'red';
          } else if (task.tag === '待办') {
            task.tag = '重要';
            task.tagColor = 'yellow';
          }
          return task;
        });
        saveTasks();
      } else {
        tasks.value = createDefaultTasks();
        saveTasks();
      }
    } catch (error) {
      logger.error('初始化任务列表失败:', error);
      tasks.value = createDefaultTasks();
    } finally {
      loading.value = false;
    }
  }

  /**
   * 添加新任务
   * @param {string} title - 任务标题
   * @param {string} priority - 任务优先级，可选值：high, medium, low
   * @param {string} tag - 任务标签
   * @param {string} tagColor - 标签颜色
   */
  function addTask(title, priority = 'medium', tag = '重要', tagColor = 'yellow') {
    if (!title || title.trim() === '') {
      logger.error('任务标题不能为空');
      return;
    }

    const newTask = {
      id: generateTodoId(),
      title: title.trim(),
      done: false,
      priority,
      tag,
      tagColor,
      createdAt: new Date().toISOString()
    };

    tasks.value.unshift(newTask);
    saveTasks();

    return newTask;
  }

  /**
   * 删除任务
   * @param {number} id - 任务ID
   */
  function removeTask(id) {
    const index = tasks.value.findIndex((task) => task.id === id);
    if (index !== -1) {
      tasks.value.splice(index, 1);
      saveTasks();
      return true;
    }
    return false;
  }

  /**
   * 切换任务完成状态
   * @param {number} id - 任务ID
   */
  function toggleTask(id) {
    const task = tasks.value.find((task) => task.id === id);
    if (task) {
      task.done = !task.done;
      saveTasks();
      return true;
    }
    return false;
  }

  /**
   * 更新任务
   * @param {number} id - 任务ID
   * @param {Object} updates - 要更新的任务属性
   */
  function updateTask(id, updates) {
    const task = tasks.value.find((task) => task.id === id);
    if (task) {
      Object.assign(task, updates);
      saveTasks();
      return true;
    }
    return false;
  }

  /** 清空已完成任务 */
  function clearCompleted() {
    tasks.value = tasks.value.filter((task) => !task.done);
    saveTasks();
  }

  /**
   * 批量添加任务
   * @param {Array} newTasks - 要添加的任务数组
   */
  function bulkAddTasks(newTasks) {
    if (Array.isArray(newTasks) && newTasks.length > 0) {
      // H-06 FIX: 使用 generateTodoId() 替代 Date.now() + index
      const tasksToAdd = newTasks.map((task) => ({
        id: generateTodoId(),
        done: false,
        createdAt: new Date().toISOString(),
        ...task
      }));

      tasks.value.push(...tasksToAdd);
      saveTasks();
    }
  }

  return {
    // 状态
    tasks,
    loading,
    // 计算属性
    totalTasks,
    completedTasks,
    completionRate,
    sortedTasks,
    // 方法
    initTasks,
    saveTasks,
    addTask,
    removeTask,
    toggleTask,
    updateTask,
    clearCompleted,
    bulkAddTasks
  };
});
