/**
 * 任务列表 Store
 * 管理今日计划的任务数据
 * ✅ 2.2: 消除重复默认任务、统一存储 key
 */

import { defineStore } from 'pinia';
import { storageService } from '../../services/storageService.js';

/** 存储 key 常量（消除硬编码魔法字符串） */
const STORAGE_KEY = 'my_tasks';

/** 默认任务模板（消除重复定义） */
function createDefaultTasks() {
  return [
    { id: Date.now() + 1, title: '完成 3 组政治选择题', done: false, priority: 'high', tag: '优先', tagColor: 'red' },
    { id: Date.now() + 2, title: '英语阅读真题分析', done: false, priority: 'medium', tag: '重要', tagColor: 'yellow' },
    { id: Date.now() + 3, title: '复习昨天错题本', done: false, priority: 'low', tag: '日常', tagColor: 'gray' }
  ];
}

export const useTodoStore = defineStore('todo', {
  state: () => ({
    // 任务列表，包含 id、标题、完成状态、优先级、标签等信息
    tasks: [],
    // 任务加载状态
    loading: false
  }),

  getters: {
    /**
     * 获取任务总数
     */
    totalTasks: (state) => state.tasks.length,

    /**
     * 获取已完成任务数
     */
    completedTasks: (state) => state.tasks.filter((task) => task.done).length,

    /**
     * 获取任务完成百分比
     */
    completionRate: (state) => {
      if (state.tasks.length === 0) return 0;
      return Math.round((state.tasks.filter((task) => task.done).length / state.tasks.length) * 100);
    },

    /**
     * 获取按优先级排序的任务列表
     */
    sortedTasks: (state) => {
      // 优先级排序：high > medium > low
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return [...state.tasks].sort((a, b) => {
        // 先按完成状态排序，未完成的在前面
        if (a.done !== b.done) {
          return a.done ? 1 : -1;
        }
        // 再按优先级排序
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      });
    }
  },

  actions: {
    /**
     * 初始化任务列表，从本地存储加载数据
     */
    initTasks() {
      this.loading = true;
      try {
        const savedTasks = storageService.get(STORAGE_KEY, []);
        if (savedTasks && Array.isArray(savedTasks) && savedTasks.length > 0) {
          // 检查并更新旧的标签格式
          this.tasks = savedTasks.map((task) => {
            if (task.tag === '高优') {
              task.tag = '优先';
              task.tagColor = 'red';
            } else if (task.tag === '待办') {
              task.tag = '重要';
              task.tagColor = 'yellow';
            }
            return task;
          });
          this.saveTasks();
        } else {
          this.tasks = createDefaultTasks();
          this.saveTasks();
        }
      } catch (error) {
        console.error('初始化任务列表失败:', error);
        this.tasks = createDefaultTasks();
      } finally {
        this.loading = false;
      }
    },

    /**
     * 保存任务列表到本地存储
     */
    saveTasks() {
      storageService.save(STORAGE_KEY, this.tasks, true); // 静默失败
    },

    /**
     * 添加新任务
     * @param {string} title - 任务标题
     * @param {string} priority - 任务优先级，可选值：high, medium, low
     * @param {string} tag - 任务标签
     * @param {string} tagColor - 标签颜色
     */
    addTask(title, priority = 'medium', tag = '重要', tagColor = 'yellow') {
      if (!title || title.trim() === '') {
        console.error('任务标题不能为空');
        return;
      }

      // 创建新任务对象
      const newTask = {
        id: Date.now(),
        title: title.trim(),
        done: false,
        priority,
        tag,
        tagColor,
        createdAt: new Date().toISOString()
      };

      // 添加到任务列表
      this.tasks.unshift(newTask);

      // 保存到本地存储
      this.saveTasks();

      return newTask;
    },

    /**
     * 删除任务
     * @param {number} id - 任务ID
     */
    removeTask(id) {
      const index = this.tasks.findIndex((task) => task.id === id);
      if (index !== -1) {
        this.tasks.splice(index, 1);
        this.saveTasks();
        return true;
      }
      return false;
    },

    /**
     * 切换任务完成状态
     * @param {number} id - 任务ID
     */
    toggleTask(id) {
      const task = this.tasks.find((task) => task.id === id);
      if (task) {
        task.done = !task.done;
        this.saveTasks();
        return true;
      }
      return false;
    },

    /**
     * 更新任务
     * @param {number} id - 任务ID
     * @param {Object} updates - 要更新的任务属性，包含标题、优先级、标签等
     */
    updateTask(id, updates) {
      const task = this.tasks.find((task) => task.id === id);
      if (task) {
        Object.assign(task, updates);
        this.saveTasks();
        return true;
      }
      return false;
    },

    /**
     * 清空已完成任务
     */
    clearCompleted() {
      this.tasks = this.tasks.filter((task) => !task.done);
      this.saveTasks();
    },

    /**
     * 批量添加任务
     * @param {Array} newTasks - 要添加的任务数组
     */
    bulkAddTasks(newTasks) {
      if (Array.isArray(newTasks) && newTasks.length > 0) {
        // ✅ 2.2: 使用整数 ID，与 addTask 保持一致（避免浮点数 ID）
        const tasksToAdd = newTasks.map((task, index) => ({
          id: Date.now() + index,
          done: false,
          createdAt: new Date().toISOString(),
          ...task
        }));

        this.tasks.push(...tasksToAdd);
        this.saveTasks();
      }
    }
  }
});
