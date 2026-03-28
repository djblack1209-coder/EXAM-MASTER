/**
 * 全链路测试 2: 刷题核心流程
 * 进度恢复 -> 正确率计算 -> 缓存容错
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';

vi.mock('@/utils/logger.js', () => ({
  logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn() }
}));
vi.mock('@/utils/core/performance.js', () => ({
  perfMonitor: { trackApi: vi.fn(), trackRender: vi.fn(), getReport: vi.fn(() => ({})) }
}));

describe('全链路: 刷题核心流程', () => {
  let pinia;

  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);
    global.__mockStorage = {};
    vi.clearAllMocks();
  });

  describe('Phase 1: StudyStore 进度管理', () => {
    it('初始状态 - 所有指标为零', async () => {
      const { useStudyStore } = await import('@/stores/modules/study.js');
      const studyStore = useStudyStore();

      expect(studyStore.studyProgress.totalQuestions).toBe(0);
      expect(studyStore.studyProgress.completedQuestions).toBe(0);
      expect(studyStore.accuracy).toBe(0);
    });

    it('restoreProgress 从缓存恢复', async () => {
      const { useStudyStore } = await import('@/stores/modules/study.js');
      const studyStore = useStudyStore();

      // 模拟缓存中有数据
      global.__mockStorage['EXAM_STUDY_PROGRESS'] = {
        progress: {
          totalQuestions: 200,
          completedQuestions: 81,
          correctQuestions: 61,
          studyDays: 0,
          studyMinutes: 0,
          lastStudyDate: null
        },
        history: [{ questionId: 'q_persist', isCorrect: true, timeSpent: 2000, timestamp: Date.now() }]
      };

      studyStore.restoreProgress();
      expect(studyStore.studyProgress.totalQuestions).toBe(200);
      expect(studyStore.studyProgress.completedQuestions).toBe(81);
      expect(studyStore.questionHistory).toHaveLength(1);
    });
  });

  describe('Phase 2: 边界场景', () => {
    it('accuracy 分母为零时返回 0', async () => {
      const { useStudyStore } = await import('@/stores/modules/study.js');
      const studyStore = useStudyStore();

      expect(studyStore.accuracy).toBe(0);
    });

    it('restoreProgress 缓存为空时不崩溃', async () => {
      const { useStudyStore } = await import('@/stores/modules/study.js');
      const studyStore = useStudyStore();

      // 无缓存数据
      studyStore.restoreProgress();
      expect(studyStore.studyProgress.totalQuestions).toBe(0);
    });
  });
});
