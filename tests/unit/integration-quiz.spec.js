/**
 * 全链路测试 2: 刷题核心流程
 * 选题 -> 答题 -> 记录 -> 进度更新 -> 错题自动收录
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
      expect(studyStore.completionRate).toBe(0);
      expect(studyStore.accuracy).toBe(0);
    });

    it('updateProgress 增量更新进度', async () => {
      const { useStudyStore } = await import('@/stores/modules/study.js');
      const studyStore = useStudyStore();

      studyStore.updateProgress({ totalQuestions: 100, completedQuestions: 30, correctQuestions: 25 });

      expect(studyStore.studyProgress.totalQuestions).toBe(100);
      expect(studyStore.completionRate).toBe(30);
      expect(studyStore.accuracy).toBe(83.3);
    });

    it('recordAnswer 记录答题并自动更新进度', async () => {
      const { useStudyStore } = await import('@/stores/modules/study.js');
      const studyStore = useStudyStore();

      studyStore.updateProgress({ totalQuestions: 50 });

      // 答对 3 题
      studyStore.recordAnswer('q1', true, 5000);
      studyStore.recordAnswer('q2', true, 3000);
      studyStore.recordAnswer('q3', true, 4000);
      // 答错 1 题
      studyStore.recordAnswer('q4', false, 8000);

      expect(studyStore.studyProgress.completedQuestions).toBe(4);
      expect(studyStore.studyProgress.correctQuestions).toBe(3);
      expect(studyStore.accuracy).toBe(75);
      expect(studyStore.questionHistory).toHaveLength(4);
      // 最新的在前面
      expect(studyStore.questionHistory[0].questionId).toBe('q4');
    });

    it('questionHistory 最多保留 100 条', async () => {
      const { useStudyStore } = await import('@/stores/modules/study.js');
      const studyStore = useStudyStore();

      for (let i = 0; i < 110; i++) {
        studyStore.recordAnswer(`q_${i}`, i % 2 === 0, 1000);
      }

      expect(studyStore.questionHistory.length).toBeLessThanOrEqual(100);
    });

    it('setCurrentQuestion 设置和清除当前题目', async () => {
      const { useStudyStore } = await import('@/stores/modules/study.js');
      const studyStore = useStudyStore();

      const question = { id: 'q_test', question: '马克思主义的本质特征是？', options: ['A', 'B', 'C', 'D'] };
      studyStore.setCurrentQuestion(question);
      expect(studyStore.currentQuestion).toEqual(question);

      studyStore.setCurrentQuestion(null);
      expect(studyStore.currentQuestion).toBeNull();
    });

    it('saveProgress + restoreProgress 持久化与恢复', async () => {
      const { useStudyStore } = await import('@/stores/modules/study.js');
      const studyStore = useStudyStore();

      studyStore.updateProgress({ totalQuestions: 200, completedQuestions: 80, correctQuestions: 60 });
      studyStore.recordAnswer('q_persist', true, 2000);

      // 验证数据已写入存储
      expect(uni.setStorageSync).toHaveBeenCalled();

      // 模拟重新打开应用
      const studyStore2 = useStudyStore();
      studyStore2.resetProgress();
      expect(studyStore2.studyProgress.totalQuestions).toBe(0);

      // 模拟从缓存恢复（需要 mock 存储中有数据）
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

      studyStore2.restoreProgress();
      expect(studyStore2.studyProgress.totalQuestions).toBe(200);
      expect(studyStore2.studyProgress.completedQuestions).toBe(81);
      expect(studyStore2.questionHistory).toHaveLength(1);
    });

    it('resetProgress 重置所有进度', async () => {
      const { useStudyStore } = await import('@/stores/modules/study.js');
      const studyStore = useStudyStore();

      studyStore.updateProgress({ totalQuestions: 100, completedQuestions: 50 });
      studyStore.recordAnswer('q_reset', true, 1000);

      studyStore.resetProgress();

      expect(studyStore.studyProgress.totalQuestions).toBe(0);
      expect(studyStore.studyProgress.completedQuestions).toBe(0);
      expect(studyStore.questionHistory).toHaveLength(0);
      expect(studyStore.currentQuestion).toBeNull();
    });
  });

  describe('Phase 2: 完整答题流程模拟', () => {
    it('模拟一轮 10 题练习', async () => {
      const { useStudyStore } = await import('@/stores/modules/study.js');
      const studyStore = useStudyStore();

      studyStore.updateProgress({ totalQuestions: 500 });

      const questions = Array.from({ length: 10 }, (_, i) => ({
        id: `quiz_${i}`,
        question: `题目 ${i + 1}`,
        options: ['A', 'B', 'C', 'D'],
        answer: 'A'
      }));

      const answers = [true, true, false, true, true, false, true, true, true, false];

      for (let i = 0; i < questions.length; i++) {
        studyStore.setCurrentQuestion(questions[i]);
        expect(studyStore.currentQuestion.id).toBe(questions[i].id);

        studyStore.recordAnswer(questions[i].id, answers[i], Math.random() * 10000);
      }

      studyStore.setCurrentQuestion(null);

      expect(studyStore.studyProgress.completedQuestions).toBe(10);
      expect(studyStore.studyProgress.correctQuestions).toBe(7);
      expect(studyStore.accuracy).toBe(70);
      expect(studyStore.questionHistory).toHaveLength(10);
    });

    it('连续多轮练习累计统计', async () => {
      const { useStudyStore } = await import('@/stores/modules/study.js');
      const studyStore = useStudyStore();

      studyStore.updateProgress({ totalQuestions: 1000 });

      // 第一轮：5 题全对
      for (let i = 0; i < 5; i++) {
        studyStore.recordAnswer(`round1_${i}`, true, 3000);
      }
      expect(studyStore.accuracy).toBe(100);

      // 第二轮：5 题全错
      for (let i = 0; i < 5; i++) {
        studyStore.recordAnswer(`round2_${i}`, false, 5000);
      }
      expect(studyStore.accuracy).toBe(50);
      expect(studyStore.studyProgress.completedQuestions).toBe(10);
    });
  });

  describe('Phase 3: 边界场景', () => {
    it('completionRate 分母为零时返回 0', async () => {
      const { useStudyStore } = await import('@/stores/modules/study.js');
      const studyStore = useStudyStore();

      expect(studyStore.completionRate).toBe(0);
    });

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
