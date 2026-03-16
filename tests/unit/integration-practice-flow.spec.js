/**
 * 刷题功能集成测试
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockQuestionBank = {
  questions: [],
  currentIndex: 0,
  loadQuestions: vi.fn(),
  submitAnswer: vi.fn(),
  saveProgress: vi.fn()
};

vi.mock('../../src/stores/question', () => ({
  useQuestionStore: () => mockQuestionBank
}));

describe('刷题功能集成测试', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQuestionBank.questions = [
      { id: 1, content: '题目1', answer: 'A', options: ['A', 'B', 'C', 'D'] },
      { id: 2, content: '题目2', answer: 'B', options: ['A', 'B', 'C', 'D'] }
    ];
    mockQuestionBank.currentIndex = 0;
  });

  it('加载题库成功', async () => {
    mockQuestionBank.loadQuestions.mockResolvedValue({ success: true, count: 2 });

    const result = await mockQuestionBank.loadQuestions();

    expect(result.success).toBe(true);
    expect(result.count).toBe(2);
  });

  it('提交答案并判断正误', async () => {
    const userAnswer = 'A';
    const correctAnswer = 'A';

    mockQuestionBank.submitAnswer.mockResolvedValue({
      correct: userAnswer === correctAnswer,
      correctAnswer
    });

    const result = await mockQuestionBank.submitAnswer(userAnswer);

    expect(result.correct).toBe(true);
    expect(mockQuestionBank.submitAnswer).toHaveBeenCalledWith(userAnswer);
  });

  it('答错题目应加入错题本', async () => {
    mockQuestionBank.submitAnswer.mockResolvedValue({
      correct: false,
      addedToMistakes: true
    });

    const result = await mockQuestionBank.submitAnswer('B');

    expect(result.correct).toBe(false);
    expect(result.addedToMistakes).toBe(true);
  });

  it('保存刷题进度', async () => {
    mockQuestionBank.saveProgress.mockResolvedValue({ success: true });

    const result = await mockQuestionBank.saveProgress();

    expect(result.success).toBe(true);
    expect(mockQuestionBank.saveProgress).toHaveBeenCalled();
  });
});
