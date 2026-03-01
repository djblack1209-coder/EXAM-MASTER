/**
 * todo store 单元测试
 * 测试任务列表 Pinia store（含 2.2 修复验证）
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';

vi.mock('../../src/services/storageService.js', () => ({
  storageService: {
    get: vi.fn((key, defaultVal) => defaultVal),
    save: vi.fn()
  }
}));

describe('useTodoStore', () => {
  let store;

  beforeEach(async () => {
    vi.clearAllMocks();
    setActivePinia(createPinia());
    const { useTodoStore } = await import('@/stores/modules/todo.js');
    store = useTodoStore();
  });

  describe('getters', () => {
    it('totalTasks 返回任务总数', () => {
      store.tasks = [
        { id: 1, done: false },
        { id: 2, done: true }
      ];
      expect(store.totalTasks).toBe(2);
    });

    it('completedTasks 返回已完成数', () => {
      store.tasks = [
        { id: 1, done: false, priority: 'high' },
        { id: 2, done: true, priority: 'low' }
      ];
      expect(store.completedTasks).toBe(1);
    });

    it('completionRate 空列表返回 0', () => {
      store.tasks = [];
      expect(store.completionRate).toBe(0);
    });

    it('completionRate 计算正确百分比', () => {
      store.tasks = [
        { id: 1, done: true, priority: 'high' },
        { id: 2, done: false, priority: 'low' }
      ];
      expect(store.completionRate).toBe(50);
    });

    it('sortedTasks 未完成在前，高优先级在前', () => {
      store.tasks = [
        { id: 1, done: true, priority: 'high' },
        { id: 2, done: false, priority: 'low' },
        { id: 3, done: false, priority: 'high' }
      ];
      const sorted = store.sortedTasks;
      expect(sorted[0].id).toBe(3); // 未完成 + high
      expect(sorted[1].id).toBe(2); // 未完成 + low
      expect(sorted[2].id).toBe(1); // 已完成
    });
  });

  describe('actions', () => {
    it('initTasks 无存储数据时加载默认任务', () => {
      store.initTasks();
      expect(store.tasks.length).toBe(3);
      expect(store.tasks[0].title).toContain('政治选择题');
    });

    it('addTask 添加任务并持久化', () => {
      store.addTask('测试任务', 'high');
      expect(store.tasks.length).toBe(1);
      expect(store.tasks[0].title).toBe('测试任务');
      expect(store.tasks[0].done).toBe(false);
    });

    it('toggleTask 切换完成状态', () => {
      store.tasks = [{ id: 1, done: false, priority: 'low' }];
      store.toggleTask(1);
      expect(store.tasks[0].done).toBe(true);
    });

    it('removeTask 删除指定任务', () => {
      store.tasks = [
        { id: 1, done: false },
        { id: 2, done: false }
      ];
      store.removeTask(1);
      expect(store.tasks.length).toBe(1);
      expect(store.tasks[0].id).toBe(2);
    });

    it('bulkAddTasks 批量添加并生成唯一 ID', () => {
      const titles = ['任务A', '任务B'];
      store.bulkAddTasks(titles);
      expect(store.tasks.length).toBe(2);
      // H-06 FIX: ID 改为字符串格式（防止 Date.now() 同毫秒碰撞）
      const ids = store.tasks.map((task) => task.id);
      ids.forEach((id) => {
        expect(typeof id).toBe('string');
        expect(id.length).toBeGreaterThan(0);
      });
      // 验证 ID 唯一性
      expect(new Set(ids).size).toBe(ids.length);
    });
  });
});
