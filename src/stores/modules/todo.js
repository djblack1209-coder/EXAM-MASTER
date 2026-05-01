/**
 * 任务列表 Store
 */
import { defineStore } from 'pinia';
import { storageService } from '@/services/storageService.js';
import { logger } from '@/utils/logger.js';

const STORAGE_KEY = 'my_tasks';
let todoIdCounter = 0;

function generateTodoId() {
  todoIdCounter += 1;
  return `${Date.now().toString(36)}_${todoIdCounter.toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

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

function normalizeBulkTask(task) {
  if (typeof task === 'string') {
    return { title: task };
  }
  return task && typeof task === 'object' ? task : { title: String(task || '') };
}

export const useTodoStore = defineStore('todo', {
  state: () => ({
    tasks: [],
    loading: false
  }),

  getters: {
    totalTasks: (state) => state.tasks.length,
    completedTasks: (state) => state.tasks.filter((task) => task.done).length,
    completionRate: (state) => {
      if (state.tasks.length === 0) return 0;
      return Math.round((state.tasks.filter((task) => task.done).length / state.tasks.length) * 100);
    },
    sortedTasks: (state) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return [...state.tasks].sort((a, b) => {
        if (a.done !== b.done) return a.done ? 1 : -1;
        return (priorityOrder[b.priority] || 0) - (priorityOrder[a.priority] || 0);
      });
    },
    pendingTodos: (state) => state.tasks.filter((task) => !task.done),
    todayTodos: (state) => state.tasks
  },

  actions: {
    saveTasks() {
      storageService.save(STORAGE_KEY, this.tasks, true);
    },

    initTasks() {
      this.loading = true;
      try {
        const savedTasks = storageService.get(STORAGE_KEY, []);
        this.tasks = Array.isArray(savedTasks) && savedTasks.length > 0 ? savedTasks : createDefaultTasks();
        this.saveTasks();
      } catch (error) {
        logger.error('[TodoStore] 初始化任务列表失败:', error);
        this.tasks = createDefaultTasks();
      } finally {
        this.loading = false;
      }
    },

    addTask(title, priority = 'medium', tag = '重要', tagColor = 'yellow') {
      if (!title || String(title).trim() === '') {
        logger.warn('[TodoStore] 任务标题为空，已忽略');
        return null;
      }

      const task = {
        id: generateTodoId(),
        title: String(title).trim(),
        done: false,
        priority,
        tag,
        tagColor,
        createdAt: new Date().toISOString()
      };

      this.tasks.unshift(task);
      this.saveTasks();
      return task;
    },

    addTodo(title, priority = 'medium') {
      return this.addTask(title, priority);
    },

    toggleTask(id) {
      const task = this.tasks.find((item) => item.id === id);
      if (!task) return false;
      task.done = !task.done;
      this.saveTasks();
      return true;
    },

    toggleTodo(id) {
      return this.toggleTask(id);
    },

    removeTask(id) {
      const index = this.tasks.findIndex((item) => item.id === id);
      if (index === -1) return false;
      this.tasks.splice(index, 1);
      this.saveTasks();
      return true;
    },

    updateTask(id, updates) {
      const task = this.tasks.find((item) => item.id === id);
      if (!task) return false;
      Object.assign(task, updates);
      this.saveTasks();
      return true;
    },

    clearCompleted() {
      this.tasks = this.tasks.filter((task) => !task.done);
      this.saveTasks();
    },

    bulkAddTasks(newTasks) {
      if (!Array.isArray(newTasks) || newTasks.length === 0) return;

      const tasksToAdd = newTasks.map((task) => ({
        id: generateTodoId(),
        done: false,
        priority: 'medium',
        tag: '重要',
        tagColor: 'yellow',
        createdAt: new Date().toISOString(),
        ...normalizeBulkTask(task)
      }));

      this.tasks.push(...tasksToAdd);
      this.saveTasks();
    },

    async loadTodos() {
      this.initTasks();
      return this.tasks;
    }
  }
});
