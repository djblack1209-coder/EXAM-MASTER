/**
 * P1 特征测试：quiz-mistake-handler / quiz-ai-analysis / quiz-analytics-recorder
 * 锁定从 do-quiz.vue 提取出的 3 个模块的行为
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================================
// quiz-mistake-handler.js 测试
// ============================================================

// Mock storageService（被 quiz-mistake-handler 直接导入）
vi.mock('@/services/storageService.js', () => {
  const store = {};
  return {
    storageService: {
      get: vi.fn((key, defaultVal) => store[key] ?? defaultVal),
      save: vi.fn((key, val) => {
        store[key] = val;
      }),
      saveMistake: vi.fn(async (_data) => ({
        success: true,
        id: 'mock_id_1',
        source: 'cloud'
      })),
      _store: store // 暴露给测试用
    }
  };
});

// Mock ai.api.js（被 quiz-ai-analysis 直接导入）
vi.mock('@/services/api/domains/ai.api.js', () => ({
  proxyAI: vi.fn(async (_action, _data) => ({
    code: 0,
    data: 'Mock 智能解析：这道题考查的是...',
    success: true
  }))
}));

// Mock logger
vi.mock('@/utils/logger.js', () => ({
  logger: {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}));

// Mock question-timer（被 quiz-analytics-recorder 导入）
vi.mock('../../src/pages/practice-sub/question-timer.js', () => ({
  startTimer: vi.fn(() => ({ timeLimit: 120, remaining: 120 })),
  stopTimer: vi.fn(() => ({ elapsed: 5 })),
  recordTime: vi.fn()
}));

// Mock offline-cache（被 quiz-analytics-recorder 导入）
vi.mock('../../src/pages/practice-sub/offline-cache.js', () => ({
  checkOfflineAvailability: vi.fn(() => ({ available: false, isOnline: true })),
  saveOfflineAnswer: vi.fn()
}));

// Mock learning-analytics（被 quiz-analytics-recorder 导入，已迁移到分包）
vi.mock('@/pages/practice-sub/utils/learning-analytics.js', () => ({
  recordAnswer: vi.fn()
}));

// Mock smart-question-picker（被 quiz-analytics-recorder 直接导入）
vi.mock('../../src/pages/practice-sub/utils/smart-question-picker.js', () => ({
  recordSmartAnswer: vi.fn(),
  pickQuestions: vi.fn((q) => q)
}));

// ============================================================
// 导入被测模块（必须在 vi.mock 之后）
// ============================================================
import { saveToMistakes, updateMistakeWithAI } from '../../src/pages/practice-sub/quiz-mistake-handler.js';
import { fetchAIDeepAnalysis } from '../../src/pages/practice-sub/quiz-ai-analysis.js';
import { recordAnswerToAnalytics } from '../../src/pages/practice-sub/quiz-analytics-recorder.js';
import { storageService } from '@/services/storageService.js';
import { proxyAI } from '@/services/api/domains/ai.api.js';
import { recordTime } from '../../src/pages/practice-sub/question-timer.js';
import { saveOfflineAnswer } from '../../src/pages/practice-sub/offline-cache.js';
import { recordAnswer } from '@/pages/practice-sub/utils/learning-analytics.js';

// ============================================================
// 测试用的 fixture
// ============================================================
const mockQuestion = {
  id: 'q_1',
  question: '以下哪个是正确的？',
  title: '以下哪个是正确的？',
  options: ['A. 选项A', 'B. 选项B', 'C. 选项C', 'D. 选项D'],
  answer: 'B',
  desc: '参考解析：B 是正确答案',
  category: '政治',
  type: '单选',
  difficulty: 3,
  tags: ['马原']
};

// ============================================================
// quiz-mistake-handler.js
// ============================================================
describe('quiz-mistake-handler — 特征测试', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storageService._store.mistake_book = undefined;
  });

  describe('saveToMistakes()', () => {
    it('应调用 uni.showLoading 和 storageService.saveMistake', async () => {
      await saveToMistakes({
        currentQuestion: mockQuestion,
        userChoice: 0, // 选了 A（错误）
        aiComment: '这是智能的解析'
      });

      expect(uni.showLoading).toHaveBeenCalledWith({
        title: '保存错题中...',
        mask: true
      });
      expect(storageService.saveMistake).toHaveBeenCalledTimes(1);

      const savedData = storageService.saveMistake.mock.calls[0][0];
      expect(savedData.question_content).toBe('以下哪个是正确的？');
      expect(savedData.user_answer).toBe('A');
      expect(savedData.correct_answer).toBe('B');
      expect(savedData.analysis).toBe('这是智能的解析');
      expect(savedData.wrong_count).toBe(1);
      expect(savedData.is_mastered).toBe(false);
    });

    it('currentQuestion 为空时应直接返回', async () => {
      await saveToMistakes({
        currentQuestion: null,
        userChoice: 0,
        aiComment: ''
      });

      expect(uni.showLoading).not.toHaveBeenCalled();
      expect(storageService.saveMistake).not.toHaveBeenCalled();
    });

    it('已存在错题时 wrong_count 应递增', async () => {
      // 预设本地已有一条错题
      storageService.get.mockReturnValueOnce([
        {
          question: '以下哪个是正确的？',
          wrong_count: 2,
          id: 'q_1'
        }
      ]);

      await saveToMistakes({
        currentQuestion: mockQuestion,
        userChoice: 0,
        aiComment: ''
      });

      const savedData = storageService.saveMistake.mock.calls[0][0];
      expect(savedData.wrong_count).toBe(3);
    });

    it('云端保存失败时应降级到本地存储', async () => {
      storageService.saveMistake.mockRejectedValueOnce(new Error('网络错误'));

      await saveToMistakes({
        currentQuestion: mockQuestion,
        userChoice: 0,
        aiComment: ''
      });

      // 应调用 uni.hideLoading
      expect(uni.hideLoading).toHaveBeenCalled();
      // 应调用 storageService.save 降级保存
      expect(storageService.save).toHaveBeenCalledWith('mistake_book', expect.any(Array), true);
    });

    it('降级保存的记录应包含双字段兼容格式', async () => {
      storageService.saveMistake.mockRejectedValueOnce(new Error('fail'));
      storageService.get.mockReturnValueOnce([]); // 空错题本

      await saveToMistakes({
        currentQuestion: mockQuestion,
        userChoice: 0,
        aiComment: '智能说...'
      });

      const savedArray = storageService.save.mock.calls[0][1];
      const record = savedArray[0];

      // 双字段兼容
      expect(record.question).toBe('以下哪个是正确的？');
      expect(record.question_content).toBe('以下哪个是正确的？');
      expect(record.userChoice).toBe('A');
      expect(record.user_answer).toBe('A');
      expect(record.answer).toBe('B');
      expect(record.correct_answer).toBe('B');
      expect(record.wrongCount).toBe(1);
      expect(record.wrong_count).toBe(1);
      expect(record.isMastered).toBe(false);
      expect(record.is_mastered).toBe(false);
      expect(record.sync_status).toBe('pending');
    });
  });

  describe('updateMistakeWithAI()', () => {
    it('应更新错题本中对应记录的智能解析', () => {
      const existingMistakes = [
        {
          question: '以下哪个是正确的？',
          id: 'q_1',
          analysis: '旧解析'
        }
      ];
      storageService.get.mockReturnValueOnce(existingMistakes);

      updateMistakeWithAI({
        currentQuestion: mockQuestion,
        aiAnalysis: '新的智能深度解析'
      });

      expect(storageService.save).toHaveBeenCalledWith(
        'mistake_book',
        expect.arrayContaining([
          expect.objectContaining({
            aiAnalysis: '新的智能深度解析',
            analysis: '新的智能深度解析',
            hasAIAnalysis: true
          })
        ]),
        true
      );
    });

    it('错题本中无匹配记录时不应崩溃', () => {
      storageService.get.mockReturnValueOnce([]);

      expect(() => {
        updateMistakeWithAI({
          currentQuestion: mockQuestion,
          aiAnalysis: '解析内容'
        });
      }).not.toThrow();

      // 不应调用 save（因为没找到匹配记录）
      expect(storageService.save).not.toHaveBeenCalled();
    });
  });
});

// ============================================================
// quiz-ai-analysis.js
// ============================================================
describe('quiz-ai-analysis — 特征测试', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('fetchAIDeepAnalysis()', () => {
    it('成功时应返回智能解析内容', async () => {
      const result = await fetchAIDeepAnalysis({
        question: mockQuestion,
        userChoice: 'A. 选项A'
      });

      expect(result.success).toBe(true);
      expect(result.comment).toBe('Mock 智能解析：这道题考查的是...');
    });

    it('应调用 proxyAI 并传入正确参数', async () => {
      await fetchAIDeepAnalysis({
        question: mockQuestion,
        userChoice: 'A. 选项A'
      });

      expect(proxyAI).toHaveBeenCalledWith('analyze', {
        question: '以下哪个是正确的？',
        options: mockQuestion.options,
        userAnswer: 'A. 选项A',
        correctAnswer: 'B'
      });
    });

    it('API 返回错误码时应返回降级文案', async () => {
      proxyAI.mockResolvedValueOnce({
        code: 500,
        data: null,
        message: '服务异常'
      });

      const result = await fetchAIDeepAnalysis({
        question: mockQuestion,
        userChoice: 'A'
      });

      expect(result.success).toBe(false);
      expect(result.comment).toContain('智能解析暂时不可用');
    });

    it('网络超时时应返回超时降级文案', async () => {
      proxyAI.mockRejectedValueOnce(new Error('timeout'));

      const result = await fetchAIDeepAnalysis({
        question: mockQuestion,
        userChoice: 'A'
      });

      expect(result.success).toBe(false);
      expect(result.comment).toContain('超时');
    });

    it('401 错误时应返回配置异常降级文案', async () => {
      proxyAI.mockRejectedValueOnce(new Error('401 Unauthorized'));

      const result = await fetchAIDeepAnalysis({
        question: mockQuestion,
        userChoice: 'A'
      });

      expect(result.success).toBe(false);
      expect(result.comment).toContain('配置异常');
    });

    it('网络错误时应返回网络中断降级文案', async () => {
      proxyAI.mockRejectedValueOnce(new Error('网络连接失败'));

      const result = await fetchAIDeepAnalysis({
        question: mockQuestion,
        userChoice: 'A'
      });

      expect(result.success).toBe(false);
      expect(result.comment).toContain('网络连接中断');
    });
  });
});

// ============================================================
// quiz-analytics-recorder.js
// ============================================================
describe('quiz-analytics-recorder — 特征测试', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('recordAnswerToAnalytics()', () => {
    it('应返回 questionData 对象', async () => {
      const result = await recordAnswerToAnalytics({
        currentQuestion: mockQuestion,
        isCorrect: true,
        timeSpent: 5000,
        userChoice: 1,
        questionTimeLimit: 120,
        getOptionLabel: (idx) => ['A', 'B', 'C', 'D'][idx]
      });

      expect(result).toEqual({
        questionId: 'q_1',
        category: '政治',
        difficulty: 3,
        isCorrect: true,
        timeSpent: 5000
      });
    });

    it('currentQuestion 为空时应返回 null', async () => {
      const result = await recordAnswerToAnalytics({
        currentQuestion: null,
        isCorrect: true,
        timeSpent: 5000,
        userChoice: 1,
        questionTimeLimit: 120,
        getOptionLabel: () => 'A'
      });

      expect(result).toBeNull();
    });

    it('应调用 recordAnswer（学习分析模块）', async () => {
      await recordAnswerToAnalytics({
        currentQuestion: mockQuestion,
        isCorrect: false,
        timeSpent: 8000,
        userChoice: 0,
        questionTimeLimit: 120,
        getOptionLabel: (idx) => ['A', 'B', 'C', 'D'][idx]
      });

      expect(recordAnswer).toHaveBeenCalledWith(
        expect.objectContaining({
          questionId: 'q_1',
          isCorrect: false,
          timeSpent: 8000
        })
      );
    });

    it('应调用 recordTime（计时器模块）', async () => {
      await recordAnswerToAnalytics({
        currentQuestion: mockQuestion,
        isCorrect: true,
        timeSpent: 3000,
        userChoice: 1,
        questionTimeLimit: 90,
        getOptionLabel: (idx) => ['A', 'B', 'C', 'D'][idx]
      });

      expect(recordTime).toHaveBeenCalledWith(
        expect.objectContaining({
          questionId: 'q_1',
          timeLimit: 90
        })
      );
    });

    it('应调用 saveOfflineAnswer（离线缓存模块）', async () => {
      await recordAnswerToAnalytics({
        currentQuestion: mockQuestion,
        isCorrect: true,
        timeSpent: 4000,
        userChoice: 1,
        questionTimeLimit: 120,
        getOptionLabel: (idx) => ['A', 'B', 'C', 'D'][idx]
      });

      expect(saveOfflineAnswer).toHaveBeenCalledWith(
        expect.objectContaining({
          questionId: 'q_1',
          userAnswer: 'B',
          correctAnswer: 'B',
          isCorrect: true
        })
      );
    });

    it('子模块失败时不应影响其他模块记录', async () => {
      // 让 recordAnswer 抛异常
      recordAnswer.mockImplementationOnce(() => {
        throw new Error('boom');
      });

      const result = await recordAnswerToAnalytics({
        currentQuestion: mockQuestion,
        isCorrect: true,
        timeSpent: 5000,
        userChoice: 1,
        questionTimeLimit: 120,
        getOptionLabel: (idx) => ['A', 'B', 'C', 'D'][idx]
      });

      // 应该仍然返回结果（不崩溃）
      expect(result).toBeTruthy();
      // recordTime 和 saveOfflineAnswer 应该仍然被调用
      expect(recordTime).toHaveBeenCalled();
      expect(saveOfflineAnswer).toHaveBeenCalled();
    });
  });
});
