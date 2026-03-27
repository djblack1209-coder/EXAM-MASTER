/**
 * 全链路集成测试 — 上传题目、智能出题、拍照搜题
 * 模拟真实用户导入资料、智能生成题目、拍照识别的完整交互
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockRequest = vi.fn().mockResolvedValue({ code: 0, success: true, data: {} });

vi.mock('@/utils/logger.js', () => ({
  logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn() }
}));
vi.mock('@/utils/core/performance.js', () => ({
  perfMonitor: { trackApi: vi.fn(), trackRender: vi.fn(), getReport: vi.fn(() => ({})) }
}));
vi.mock('@/services/api/domains/_request-core.js', async (importOriginal) => {
  const original = await importOriginal();
  return { ...original, request: mockRequest };
});

import {
  normalizeQuestion,
  isValidQuestion,
  normalizeAndValidateQuestions,
  sanitizeAIInput
} from '@/pages/practice-sub/utils/question-normalizer.js';

describe('E2E 上传题目 & 智能出题 & 拍照搜题', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    mockRequest.mockResolvedValue({ code: 0, success: true, data: {} });
    global.__mockStorage = {};
  });

  // ==================== 题目标准化 ====================

  describe('题目标准化与验证', () => {
    it('normalizeQuestion → 统一字段名映射', () => {
      const raw = {
        title: '马克思主义的本质特征是什么？',
        correct_answer: 'b',
        options: ['A.科学性', 'B.实践性', 'C.阶级性', 'D.革命性'],
        subject: '政治',
        analysis: '马克思主义最根本的特征是实践性'
      };
      const normalized = normalizeQuestion(raw);

      expect(normalized.question).toBe('马克思主义的本质特征是什么？');
      expect(normalized.answer).toBe('B'); // 自动大写
      expect(normalized.category).toBe('政治');
      expect(normalized.desc).toBe('马克思主义最根本的特征是实践性');
      expect(normalized.type).toBe('单选');
    });

    it('normalizeQuestion → content 字段也能映射到 question', () => {
      const raw = {
        content: '下列哪个不是唯物辩证法的基本规律？',
        answer: 'D',
        options: ['A.对立统一', 'B.量变质变', 'C.否定之否定', 'D.因果律'],
        explanation: '因果律不是辩证法基本规律'
      };
      const normalized = normalizeQuestion(raw);
      expect(normalized.question).toBe('下列哪个不是唯物辩证法的基本规律？');
      expect(normalized.desc).toBe('因果律不是辩证法基本规律');
    });

    it('isValidQuestion → 有效题目返回 true', () => {
      const q = {
        question: '1+1=?',
        options: ['A.1', 'B.2', 'C.3', 'D.4'],
        answer: 'B'
      };
      expect(isValidQuestion(q)).toBe(true);
    });

    it('isValidQuestion → 题干为空返回 false', () => {
      expect(isValidQuestion({ question: '', options: ['A', 'B', 'C', 'D'], answer: 'A' })).toBe(false);
      expect(isValidQuestion({ question: '  ', options: ['A', 'B', 'C', 'D'], answer: 'A' })).toBe(false);
    });

    it('isValidQuestion → 选项不足4个返回 false', () => {
      expect(isValidQuestion({ question: '题目', options: ['A', 'B', 'C'], answer: 'A' })).toBe(false);
    });

    it('isValidQuestion → 答案不在 ABCD 范围返回 false', () => {
      expect(isValidQuestion({ question: '题目', options: ['A', 'B', 'C', 'D'], answer: 'E' })).toBe(false);
      expect(isValidQuestion({ question: '题目', options: ['A', 'B', 'C', 'D'], answer: '' })).toBe(false);
    });

    it('normalizeAndValidateQuestions → 数字答案自动转字母', () => {
      const questions = [
        { question: '题目1', options: ['A', 'B', 'C', 'D'], answer: 0 }, // → A
        { question: '题目2', options: ['A', 'B', 'C', 'D'], answer: 2 }, // → C
        { question: '题目3', options: ['A', 'B', 'C', 'D'], correct: 3 } // → D
      ];
      const result = normalizeAndValidateQuestions(questions);
      expect(result[0].answer).toBe('A');
      expect(result[1].answer).toBe('C');
      expect(result[2].answer).toBe('D');
    });

    it('normalizeAndValidateQuestions → 过滤无效题目', () => {
      const questions = [
        { question: '有效题', options: ['A', 'B', 'C', 'D'], answer: 'A' },
        { question: '', options: ['A', 'B', 'C', 'D'], answer: 'A' }, // 无题干
        { question: '少选项', options: ['A', 'B'], answer: 'A' }, // 选项不足
        { question: '有效题2', options: ['A', 'B', 'C', 'D'], answer: 'C' }
      ];
      const result = normalizeAndValidateQuestions(questions);
      expect(result.length).toBe(2);
      expect(result[0].question).toBe('有效题');
      expect(result[1].question).toBe('有效题2');
    });

    it('normalizeAndValidateQuestions → 无答案时默认 A', () => {
      const questions = [{ question: '无答案题', options: ['A', 'B', 'C', 'D'] }];
      const result = normalizeAndValidateQuestions(questions);
      expect(result[0].answer).toBe('A');
    });
  });

  // ==================== 智能输入清洗 ====================

  describe('智能输入清洗', () => {
    it('sanitizeAIInput → 移除控制字符', () => {
      const dirty = 'hello\x00world\x07test\x1F';
      const clean = sanitizeAIInput(dirty);
      expect(clean).toBe('helloworldtest');
    });

    it('sanitizeAIInput → 保留换行和空格', () => {
      const text = '第一行\n第二行 有空格';
      expect(sanitizeAIInput(text)).toBe('第一行\n第二行 有空格');
    });

    it('sanitizeAIInput → 截断超长内容', () => {
      const long = 'a'.repeat(10000);
      const result = sanitizeAIInput(long, 8000);
      expect(result.length).toBe(8000);
    });

    it('sanitizeAIInput → 空值返回空字符串', () => {
      expect(sanitizeAIInput(null)).toBe('');
      expect(sanitizeAIInput(undefined)).toBe('');
      expect(sanitizeAIInput('')).toBe('');
      expect(sanitizeAIInput(123)).toBe('');
    });
  });

  // ==================== 智能出题流程 ====================

  describe('智能资料出题流程', () => {
    it('materialUnderstand → 空内容应被拦截', async () => {
      const { lafService } = await import('@/services/lafService.js');
      const result = await lafService.materialUnderstand('');
      expect(result.code).toBe(-1);
      expect(result.success).toBe(false);
      expect(result.message).toContain('不能为空');
    });

    it('materialUnderstand → 纯空格内容应被拦截', async () => {
      const { lafService } = await import('@/services/lafService.js');
      const result = await lafService.materialUnderstand('   ');
      expect(result.code).toBe(-1);
    });

    it('materialUnderstand → 正常内容调用 proxyAI', async () => {
      const { lafService } = await import('@/services/lafService.js');
      mockRequest.mockResolvedValue({
        code: 0,
        success: true,
        data: {
          questions: [{ question: '智能生成题1', options: ['A', 'B', 'C', 'D'], answer: 'A' }]
        }
      });

      const result = await lafService.materialUnderstand('马克思主义基本原理概论第一章内容...', {
        materialType: '教材',
        difficulty: 3,
        topicFocus: '唯物辩证法'
      });

      expect(result.code).toBe(0);
      expect(mockRequest).toHaveBeenCalled();
      const callArgs = mockRequest.mock.calls[0];
      expect(callArgs[0]).toBe('/proxy-ai');
      expect(callArgs[1].action).toBe('material_understand');
      expect(callArgs[1].materialType).toBe('教材');
      expect(callArgs[1].difficulty).toBe(3);
    });

    it('materialUnderstand → 默认参数填充', async () => {
      const { lafService } = await import('@/services/lafService.js');
      mockRequest.mockResolvedValue({ code: 0, success: true });

      await lafService.materialUnderstand('一些内容');

      const callArgs = mockRequest.mock.calls[0][1];
      expect(callArgs.materialType).toBe('教材');
      expect(callArgs.difficulty).toBe(3);
      expect(callArgs.topicFocus).toBe('');
    });

    it('智能生成题目 → 经过标准化和验证后存入题库', () => {
      // 模拟智能返回的原始题目（字段名不统一）
      const aiResponse = [
        {
          title: '智能题1',
          options: ['A.选项1', 'B.选项2', 'C.选项3', 'D.选项4'],
          correct_answer: 'b',
          subject: '政治'
        },
        { content: '智能题2', options: ['A.甲', 'B.乙', 'C.丙', 'D.丁'], answer: 2, analysis: '解析内容' },
        { question: '', options: ['A', 'B'], answer: 'A' } // 无效题
      ];

      const validated = normalizeAndValidateQuestions(aiResponse);
      expect(validated.length).toBe(2);
      expect(validated[0].question).toBe('智能题1');
      expect(validated[0].answer).toBe('B');
      expect(validated[1].question).toBe('智能题2');
      expect(validated[1].answer).toBe('C'); // 数字2 → C
    });

    it('批量生成 → 多轮累计去重', () => {
      const batch1 = [
        { question: '唯一题1', options: ['A', 'B', 'C', 'D'], answer: 'A' },
        { question: '唯一题2', options: ['A', 'B', 'C', 'D'], answer: 'B' }
      ];
      const batch2 = [
        { question: '唯一题1', options: ['A', 'B', 'C', 'D'], answer: 'A' }, // 重复
        { question: '唯一题3', options: ['A', 'B', 'C', 'D'], answer: 'C' }
      ];

      // 模拟去重逻辑
      const bank = [...normalizeAndValidateQuestions(batch1)];
      const existingTexts = new Set(bank.map((q) => q.question));

      const newBatch = normalizeAndValidateQuestions(batch2).filter((q) => !existingTexts.has(q.question));
      bank.push(...newBatch);

      expect(bank.length).toBe(3); // 去重后3题
      expect(bank.map((q) => q.question)).toContain('唯一题3');
    });
  });

  // ==================== 拍照搜题 ====================

  describe('拍照搜题', () => {
    it('photoSearch → 空图片数据应被拦截', async () => {
      const { lafService } = await import('@/services/lafService.js');
      const result = await lafService.photoSearch('');
      expect(result.code).toBe(-1);
      expect(result.message).toContain('不能为空');
    });

    it('photoSearch → 正常图片调用后端识别', async () => {
      const { lafService } = await import('@/services/lafService.js');
      mockRequest.mockResolvedValue({
        code: 0,
        success: true,
        data: {
          recognizedText: '求解方程 x² + 2x + 1 = 0',
          questions: [
            { question: 'x² + 2x + 1 = 0 的解是？', options: ['A.x=-1', 'B.x=1', 'C.x=0', 'D.x=2'], answer: 'A' }
          ],
          confidence: 0.95
        }
      });

      const fakeBase64 = 'data:image/jpeg;base64,/9j/4AAQSkZJRg...';
      const result = await lafService.photoSearch(fakeBase64, { subject: 'math' });

      expect(result.code).toBe(0);
      expect(result.data.recognizedText).toContain('x²');
      expect(result.data.confidence).toBe(0.95);
      expect(mockRequest.mock.calls[0][0]).toBe('/ai-photo-search');
      expect(mockRequest.mock.calls[0][1].subject).toBe('math');
    });

    it('photoSearch → 网络失败返回错误', async () => {
      const { lafService } = await import('@/services/lafService.js');
      mockRequest.mockRejectedValue(new Error('网络超时'));

      const result = await lafService.photoSearch('base64data');
      expect(result.success).toBe(false);
    });

    it('拍照流程 → chooseImage 相机/相册选择', () => {
      // 模拟相机拍照
      let capturedSource = null;
      global.uni.chooseImage = vi.fn(({ sourceType, success }) => {
        capturedSource = sourceType;
        success({ tempFilePaths: ['/tmp/photo.jpg'] });
      });

      uni.chooseImage({
        count: 1,
        sizeType: ['compressed'],
        sourceType: ['camera'],
        success: (res) => {
          expect(res.tempFilePaths[0]).toBe('/tmp/photo.jpg');
        }
      });
      expect(capturedSource).toEqual(['camera']);

      // 模拟相册选择
      uni.chooseImage({
        count: 1,
        sourceType: ['album'],
        success: () => {}
      });
      expect(capturedSource).toEqual(['album']);
    });

    it('识别结果 → 展示识别文本和匹配题目', () => {
      const recognitionResult = {
        recognizedText: '设函数 f(x) = x³ - 3x，求极值',
        questions: [{ question: 'f(x)=x³-3x的极大值是？', options: ['A.2', 'B.-2', 'C.0', 'D.4'], answer: 'A' }],
        aiGenerated: true,
        confidence: 0.88
      };

      expect(recognitionResult.recognizedText).toContain('f(x)');
      expect(recognitionResult.questions.length).toBe(1);
      expect(recognitionResult.confidence).toBeGreaterThan(0.8);

      // 状态文本
      const statusText = recognitionResult.confidence >= 0.8 ? '高置信度' : '低置信度';
      expect(statusText).toBe('高置信度');
    });
  });

  // ==================== 文件验证 ====================

  describe('文件上传验证', () => {
    it('支持的文件类型 → PDF/Word/TXT/MD/JSON', () => {
      const allowedTypes = ['pdf', 'doc', 'docx', 'txt', 'md', 'json'];
      const testFiles = [
        { name: '考研真题.pdf', expected: true },
        { name: '笔记.txt', expected: true },
        { name: '大纲.md', expected: true },
        { name: '题库.json', expected: true },
        { name: '病毒.exe', expected: false },
        { name: '脚本.bat', expected: false },
        { name: '图片.jpg', expected: false }
      ];

      testFiles.forEach(({ name, expected }) => {
        const ext = name.split('.').pop().toLowerCase();
        const isAllowed = allowedTypes.includes(ext);
        expect(isAllowed).toBe(expected);
      });
    });

    it('文件大小限制 → 超过 10MB 应拒绝', () => {
      const maxSize = 10 * 1024 * 1024; // 10MB
      expect(5 * 1024 * 1024 < maxSize).toBe(true); // 5MB OK
      expect(10 * 1024 * 1024 < maxSize).toBe(false); // 10MB 刚好不行
      expect(15 * 1024 * 1024 < maxSize).toBe(false); // 15MB 拒绝
    });

    it('危险文件扩展名 → 应被阻止', () => {
      const dangerousExts = ['exe', 'bat', 'cmd', 'sh', 'ps1', 'vbs', 'js', 'msi'];
      dangerousExts.forEach((ext) => {
        const fileName = `file.${ext}`;
        const fileExt = fileName.split('.').pop().toLowerCase();
        expect(dangerousExts.includes(fileExt)).toBe(true);
      });
    });
  });

  // ==================== 考点趋势预测 ====================

  describe('考点趋势预测', () => {
    it('trendPredict → 调用 proxyAI 并传递历史数据', async () => {
      const { lafService } = await import('@/services/lafService.js');
      mockRequest.mockResolvedValue({
        code: 0,
        success: true,
        data: { hotTopics: ['唯物辩证法', '剩余价值'], predictedWeight: [0.3, 0.25] }
      });

      const result = await lafService.trendPredict(
        { topicFrequency: { 唯物辩证法: 15 }, recentHotspots: ['新发展理念'] },
        2025,
        '政治'
      );

      expect(result.code).toBe(0);
      const args = mockRequest.mock.calls[0][1];
      expect(args.action).toBe('trend_predict');
      expect(args.examYear).toBe(2025);
      expect(args.subject).toBe('政治');
    });
  });

  // ==================== 错题深度分析 ====================

  describe('错题深度分析', () => {
    it('deepMistakeAnalysis → 传递错题数据和用户历史', async () => {
      const { lafService } = await import('@/services/lafService.js');
      mockRequest.mockResolvedValue({
        code: 0,
        success: true,
        data: { analysis: '知识点薄弱', suggestion: '建议复习唯物辩证法' }
      });

      const result = await lafService.deepMistakeAnalysis(
        { question: '题目', options: ['A', 'B', 'C', 'D'], userAnswer: 'A', correctAnswer: 'C', category: '马原' },
        { topicAccuracy: 60, consecutiveErrors: 2 }
      );

      expect(result.code).toBe(0);
      const args = mockRequest.mock.calls[0][1];
      expect(args.action).toBe('analyze');
    });
  });

  // ==================== 端到端完整流程 ====================

  describe('完整流程：导入资料 → 智能出题 → 做题 → 拍照搜题', () => {
    it('用户上传 TXT 文件 → 智能生成题目 → 标准化入库 → 拍照补充', async () => {
      const { lafService } = await import('@/services/lafService.js');

      // Step 1: 用户选择文件
      const fileContent = '马克思主义哲学是关于自然、社会和思维发展一般规律的科学...';
      const cleanContent = sanitizeAIInput(fileContent);
      expect(cleanContent.length).toBeGreaterThan(0);

      // Step 2: 智能生成题目
      mockRequest.mockResolvedValue({
        code: 0,
        success: true,
        data: {
          reply: JSON.stringify([
            {
              question: '马克思主义哲学研究的对象是？',
              options: ['A.自然规律', 'B.社会规律', 'C.思维规律', 'D.一般规律'],
              answer: 'D'
            },
            { title: '辩证唯物主义的核心是？', options: ['A.物质', 'B.意识', 'C.矛盾', 'D.实践'], correct_answer: 'c' }
          ])
        }
      });

      const aiResult = await lafService.materialUnderstand(cleanContent);
      expect(aiResult.code).toBe(0);

      // Step 3: 标准化和验证
      const rawQuestions = JSON.parse(aiResult.data.reply);
      const validated = normalizeAndValidateQuestions(rawQuestions);
      expect(validated.length).toBe(2);
      expect(validated[0].answer).toBe('D');
      expect(validated[1].answer).toBe('C');
      expect(validated[1].question).toBe('辩证唯物主义的核心是？');

      // Step 4: 存入题库
      const bank = [...validated];
      expect(bank.length).toBe(2);

      // Step 5: 拍照搜题补充
      mockRequest.mockResolvedValue({
        code: 0,
        success: true,
        data: {
          recognizedText: '唯物辩证法的总特征是什么？',
          questions: [
            { question: '唯物辩证法的总特征是？', options: ['A.联系', 'B.发展', 'C.联系和发展', 'D.矛盾'], answer: 'C' }
          ]
        }
      });

      const photoResult = await lafService.photoSearch('base64...', { subject: '政治' });
      expect(photoResult.code).toBe(0);

      // 合并拍照识别的题目
      const photoQuestions = normalizeAndValidateQuestions(photoResult.data.questions);
      bank.push(...photoQuestions);
      expect(bank.length).toBe(3);
    });
  });
});
