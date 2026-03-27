/**
 * 特征测试 (Characterization Test) — adaptive-learning-engine.js
 *
 * 目的：锁定当前行为，确保三合一重构后输入A永远得到输出B。
 * 不验证逻辑是否"正确"，只验证行为不变。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock logger
vi.mock('@/utils/logger.js', () => ({
  logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn() }
}));

// Mock storageService
vi.mock('@/services/storageService.js', () => ({
  default: {
    get: vi.fn((key, defaultVal) => defaultVal),
    save: vi.fn()
  }
}));

// 导入规范路径（重构后的唯一来源）
import {
  adaptiveLearningEngine,
  generateAdaptiveSequence,
  getReviewQuestions,
  getNextRecommendedQuestion,
  recordAnswer,
  getWeakKnowledgePoints,
  getLearningStats,
  recordReview
} from '@/utils/learning/adaptive-learning-engine.js';

describe('AdaptiveLearningEngine — 特征测试', () => {
  beforeEach(() => {
    // 重置单例状态
    adaptiveLearningEngine.isInitialized = false;
    adaptiveLearningEngine.mistakeBook = [];
    adaptiveLearningEngine.learningHistory = [];
    adaptiveLearningEngine.knowledgeMap = {};
    adaptiveLearningEngine.reviewSchedule = [];
    vi.clearAllMocks();
  });

  // ==================== 导出完整性 ====================

  describe('模块导出', () => {
    it('应导出单例实例', () => {
      expect(adaptiveLearningEngine).toBeDefined();
      expect(adaptiveLearningEngine.constructor.name).toBe('AdaptiveLearningEngine');
    });

    it('应导出所有便捷函数', () => {
      expect(typeof generateAdaptiveSequence).toBe('function');
      expect(typeof getReviewQuestions).toBe('function');
      expect(typeof getNextRecommendedQuestion).toBe('function');
      expect(typeof recordAnswer).toBe('function');
      expect(typeof getWeakKnowledgePoints).toBe('function');
      expect(typeof getLearningStats).toBe('function');
      expect(typeof recordReview).toBe('function');
    });
  });

  // ==================== 初始化行为 ====================

  describe('init()', () => {
    it('首次调用应初始化，第二次应跳过', () => {
      adaptiveLearningEngine.init();
      expect(adaptiveLearningEngine.isInitialized).toBe(true);

      // 第二次调用不应重新加载
      const spy = vi.spyOn(adaptiveLearningEngine, '_loadMistakeBook');
      adaptiveLearningEngine.init();
      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    });
  });

  // ==================== generateAdaptiveSequence ====================

  describe('generateAdaptiveSequence()', () => {
    it('空数组输入应返回空数组', () => {
      const result = generateAdaptiveSequence([], {});
      expect(result).toEqual([]);
    });

    it('null 输入应返回空数组', () => {
      const result = generateAdaptiveSequence(null, {});
      expect(result).toEqual([]);
    });

    it('应返回包含所有原始题目的序列（无错题本时不插入复习题）', () => {
      const questions = [
        { id: 'q1', question: '题目1', category: '数学' },
        { id: 'q2', question: '题目2', category: '英语' },
        { id: 'q3', question: '题目3', category: '政治' }
      ];
      const result = generateAdaptiveSequence(questions);
      // 无错题本 → 无复习题 → 长度应等于原始长度
      expect(result.length).toBe(3);
      // 所有原始题目都应存在
      const ids = result.map((q) => q.id);
      expect(ids).toContain('q1');
      expect(ids).toContain('q2');
      expect(ids).toContain('q3');
    });

    it('禁用所有选项时应返回原始序列的副本', () => {
      const questions = [
        { id: 'q1', question: '题目1', category: '数学' }
      ];
      const result = generateAdaptiveSequence(questions, {
        insertReviewQuestions: false,
        prioritizeWeak: false
      });
      expect(result).toEqual(questions);
    });
  });

  // ==================== getReviewQuestions ====================

  describe('getReviewQuestions()', () => {
    it('错题本为空时应返回空数组', () => {
      const result = getReviewQuestions(10);
      expect(result).toEqual([]);
    });

    it('已掌握的题目不应出现在复习列表中', () => {
      adaptiveLearningEngine.mistakeBook = [
        { id: 'm1', question: '已掌握', is_mastered: true, last_review_time: Date.now() }
      ];
      adaptiveLearningEngine.isInitialized = true;

      const result = getReviewQuestions(10);
      expect(result).toEqual([]);
    });

    it('记忆保持率低的题目应出现在复习列表中', () => {
      // 设置一个很久以前的错题（记忆保持率应该很低）
      adaptiveLearningEngine.mistakeBook = [
        {
          id: 'm1',
          question: '需要复习',
          is_mastered: false,
          last_wrong_time: Date.now() - 30 * 24 * 60 * 60 * 1000, // 30天前
          wrong_count: 3,
          review_count: 0
        }
      ];
      adaptiveLearningEngine.isInitialized = true;

      const result = getReviewQuestions(10);
      expect(result.length).toBe(1);
      expect(result[0].id).toBe('m1');
      expect(result[0]).toHaveProperty('retention');
      expect(result[0]).toHaveProperty('priority');
    });

    it('应尊重 limit 参数', () => {
      adaptiveLearningEngine.mistakeBook = Array.from({ length: 20 }, (_, i) => ({
        id: `m${i}`,
        question: `题目${i}`,
        is_mastered: false,
        last_wrong_time: Date.now() - 30 * 24 * 60 * 60 * 1000,
        wrong_count: 1,
        review_count: 0
      }));
      adaptiveLearningEngine.isInitialized = true;

      const result = getReviewQuestions(5);
      expect(result.length).toBe(5);
    });
  });

  // ==================== recordAnswer ====================

  describe('recordAnswer()', () => {
    it('应将记录添加到学习历史', () => {
      const question = { id: 'q1', category: '数学' };
      recordAnswer(question, true, 5000);

      expect(adaptiveLearningEngine.learningHistory.length).toBe(1);
      const record = adaptiveLearningEngine.learningHistory[0];
      expect(record.questionId).toBe('q1');
      expect(record.category).toBe('数学');
      expect(record.isCorrect).toBe(true);
      expect(record.timeSpent).toBe(5000);
      expect(record.timestamp).toBeGreaterThan(0);
    });

    it('答错时应更新复习计划', () => {
      const question = { id: 'q1', category: '数学' };
      recordAnswer(question, false, 3000);

      expect(adaptiveLearningEngine.reviewSchedule.length).toBe(1);
      expect(adaptiveLearningEngine.reviewSchedule[0].questionId).toBe('q1');
    });

    it('答对时不应更新复习计划（非复习题）', () => {
      const question = { id: 'q1', category: '数学' };
      recordAnswer(question, true, 3000);

      expect(adaptiveLearningEngine.reviewSchedule.length).toBe(0);
    });
  });

  // ==================== getWeakKnowledgePoints ====================

  describe('getWeakKnowledgePoints()', () => {
    it('无知识图谱数据时应返回空数组', () => {
      const result = getWeakKnowledgePoints();
      expect(result).toEqual([]);
    });

    it('正确率低于60%的知识点应被标记为薄弱', () => {
      adaptiveLearningEngine.knowledgeMap = {
        '数学': { total: 10, correct: 3, lastPractice: Date.now() }, // 30% → 薄弱
        '英语': { total: 10, correct: 8, lastPractice: Date.now() } // 80% → 不薄弱
      };
      adaptiveLearningEngine.isInitialized = true;

      const result = getWeakKnowledgePoints();
      expect(result.length).toBe(1);
      expect(result[0].category).toBe('数学');
      expect(result[0].accuracy).toBeCloseTo(0.3);
      expect(result[0]).toHaveProperty('recommendation');
    });

    it('应按正确率升序排序', () => {
      adaptiveLearningEngine.knowledgeMap = {
        '数学': { total: 10, correct: 5, lastPractice: Date.now() }, // 50%
        '政治': { total: 10, correct: 2, lastPractice: Date.now() }, // 20%
        '英语': { total: 10, correct: 4, lastPractice: Date.now() } // 40%
      };
      adaptiveLearningEngine.isInitialized = true;

      const result = getWeakKnowledgePoints();
      expect(result.length).toBe(3);
      expect(result[0].category).toBe('政治'); // 最薄弱
      expect(result[1].category).toBe('英语');
      expect(result[2].category).toBe('数学');
    });
  });

  // ==================== getLearningStats ====================

  describe('getLearningStats()', () => {
    it('无数据时应返回零值统计', () => {
      const stats = getLearningStats();
      expect(stats.totalQuestions).toBe(0);
      expect(stats.totalCorrect).toBe(0);
      expect(stats.overallAccuracy).toBe(0);
      expect(stats.todayQuestions).toBe(0);
      expect(stats.mistakeCount).toBe(0);
      expect(stats.masteredCount).toBe(0);
    });

    it('应正确计算总体统计', () => {
      adaptiveLearningEngine.learningHistory = [
        { questionId: 'q1', isCorrect: true, timestamp: Date.now() },
        { questionId: 'q2', isCorrect: false, timestamp: Date.now() },
        { questionId: 'q3', isCorrect: true, timestamp: Date.now() }
      ];
      adaptiveLearningEngine.isInitialized = true;

      const stats = getLearningStats();
      expect(stats.totalQuestions).toBe(3);
      expect(stats.totalCorrect).toBe(2);
      expect(stats.overallAccuracy).toBe('66.7');
      expect(stats.todayQuestions).toBe(3);
    });
  });

  // ==================== recordReview ====================

  describe('recordReview()', () => {
    it('答对复习题应增加掌握度', () => {
      adaptiveLearningEngine.mistakeBook = [
        { id: 'm1', question: '复习题', mastery_level: 60, is_mastered: false, review_count: 0 }
      ];
      adaptiveLearningEngine.isInitialized = true;

      recordReview('m1', true);

      const mistake = adaptiveLearningEngine.mistakeBook[0];
      expect(mistake.mastery_level).toBe(80);
      expect(mistake.is_mastered).toBe(true); // 80 >= 80 → 已掌握
      expect(mistake.review_count).toBe(1);
    });

    it('答错复习题应降低掌握度', () => {
      adaptiveLearningEngine.mistakeBook = [
        { id: 'm1', question: '复习题', mastery_level: 50, is_mastered: false, review_count: 0 }
      ];
      adaptiveLearningEngine.isInitialized = true;

      recordReview('m1', false);

      const mistake = adaptiveLearningEngine.mistakeBook[0];
      expect(mistake.mastery_level).toBe(40); // 50 - 10
      expect(mistake.is_mastered).toBe(false);
    });

    it('掌握度不应低于0', () => {
      adaptiveLearningEngine.mistakeBook = [
        { id: 'm1', question: '复习题', mastery_level: 5, is_mastered: false, review_count: 0 }
      ];
      adaptiveLearningEngine.isInitialized = true;

      recordReview('m1', false);

      expect(adaptiveLearningEngine.mistakeBook[0].mastery_level).toBe(0);
    });

    it('未找到错题时不应崩溃', () => {
      adaptiveLearningEngine.mistakeBook = [];
      adaptiveLearningEngine.isInitialized = true;

      // 不应抛出异常
      expect(() => recordReview('nonexistent', true)).not.toThrow();
    });
  });

  // ==================== getNextRecommendedQuestion ====================

  describe('getNextRecommendedQuestion()', () => {
    it('非复习位置应返回原序列的下一题', () => {
      const questions = [
        { id: 'q1', question: '题目1' },
        { id: 'q2', question: '题目2' },
        { id: 'q3', question: '题目3' }
      ];

      const result = getNextRecommendedQuestion(0, questions); // 第1题后
      expect(result.isReview).toBe(false);
      expect(result.question.id).toBe('q2');
    });

    it('最后一题后应返回null', () => {
      const questions = [{ id: 'q1', question: '题目1' }];
      const result = getNextRecommendedQuestion(0, questions);
      expect(result).toBeNull();
    });

    it('在复习位置（第5题后）且有复习题时应返回复习题', () => {
      // 设置一个需要复习的错题
      adaptiveLearningEngine.mistakeBook = [
        {
          id: 'm1',
          question: '需要复习',
          is_mastered: false,
          last_wrong_time: Date.now() - 30 * 24 * 60 * 60 * 1000,
          wrong_count: 3,
          review_count: 0
        }
      ];
      adaptiveLearningEngine.isInitialized = true;

      const questions = Array.from({ length: 20 }, (_, i) => ({
        id: `q${i}`, question: `题目${i}`
      }));

      const result = getNextRecommendedQuestion(4, questions); // currentIndex=4 → 第5题后
      expect(result.isReview).toBe(true);
      expect(result.question._isReview).toBe(true);
      expect(result.reason).toContain('遗忘曲线');
    });
  });

  // ==================== 单例一致性（修复验证） ====================

  describe('单例一致性', () => {
    it('多次导入应返回同一个实例', async () => {
      const mod1 = await import('@/utils/learning/adaptive-learning-engine.js');
      const mod2 = await import('@/utils/learning/adaptive-learning-engine.js');
      expect(mod1.adaptiveLearningEngine).toBe(mod2.adaptiveLearningEngine);
    });
  });
});
