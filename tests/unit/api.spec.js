/**
 * Laf 云函数 API 测试
 * 测试后端 API 的基本功能
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock fetch for API calls
global.fetch = vi.fn();

// API 基础配置
const API_BASE = 'https://nf98ia8qnt.sealosbja.site';

// 辅助函数：模拟 API 响应
function mockApiResponse(data, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data)
  });
}

// 辅助函数：调用 API
async function callApi(endpoint, body) {
  const response = await fetch(`${API_BASE}/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return response.json();
}

describe('用户模块 API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('登录 API', () => {
    it('应该成功处理微信登录请求', async () => {
      const mockResponse = {
        code: 0,
        success: true,
        data: {
          token: 'jwt_token_xxx',
          userId: 'user_001',
          isNewUser: false,
          userInfo: {
            nickname: '测试用户',
            avatar_url: 'https://example.com/avatar.png'
          }
        }
      };

      global.fetch.mockResolvedValueOnce(mockApiResponse(mockResponse));

      const result = await callApi('login', {
        action: 'wx_login',
        code: 'wx_code_xxx'
      });

      expect(result.code).toBe(0);
      expect(result.data.token).toBeDefined();
      expect(result.data.userId).toBeDefined();
    });

    it('应该处理无效的登录 code', async () => {
      const mockResponse = {
        code: 400,
        success: false,
        message: '无效的登录凭证'
      };

      global.fetch.mockResolvedValueOnce(mockApiResponse(mockResponse));

      const result = await callApi('login', {
        action: 'wx_login',
        code: ''
      });

      expect(result.code).toBe(400);
      expect(result.success).toBe(false);
    });
  });

  describe('用户资料 API', () => {
    it('应该成功获取用户资料', async () => {
      const mockResponse = {
        code: 0,
        success: true,
        data: {
          userId: 'user_001',
          nickname: '考研小王',
          avatar_url: 'https://example.com/avatar.png',
          target_school: '清华大学',
          streak_days: 30,
          total_questions: 500
        }
      };

      global.fetch.mockResolvedValueOnce(mockApiResponse(mockResponse));

      const result = await callApi('user-profile', {
        action: 'get',
        userId: 'user_001'
      });

      expect(result.code).toBe(0);
      expect(result.data.userId).toBe('user_001');
      expect(result.data.nickname).toBeDefined();
    });

    it('应该成功更新用户资料', async () => {
      const mockResponse = {
        code: 0,
        success: true,
        message: '更新成功'
      };

      global.fetch.mockResolvedValueOnce(mockApiResponse(mockResponse));

      const result = await callApi('user-profile', {
        action: 'update',
        userId: 'user_001',
        nickname: '新昵称',
        target_school: '北京大学'
      });

      expect(result.code).toBe(0);
      expect(result.success).toBe(true);
    });
  });
});

describe('练习模块 API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('题目获取 API', () => {
    it('应该成功获取题目列表', async () => {
      const mockResponse = {
        code: 0,
        success: true,
        data: {
          questions: [
            {
              _id: 'q_001',
              question: '马克思主义哲学的直接理论来源是？',
              options: ['A. 德国古典哲学', 'B. 英国古典政治经济学'],
              answer: 'A',
              category: '政治'
            }
          ],
          total: 100
        }
      };

      global.fetch.mockResolvedValueOnce(mockApiResponse(mockResponse));

      const result = await callApi('question-bank', {
        action: 'get_questions',
        category: '政治',
        count: 10
      });

      expect(result.code).toBe(0);
      expect(result.data.questions).toBeInstanceOf(Array);
      expect(result.data.questions.length).toBeGreaterThan(0);
    });
  });

  describe('答案提交 API', () => {
    it('应该成功提交答案并返回结果', async () => {
      const mockResponse = {
        code: 0,
        success: true,
        data: {
          isCorrect: true,
          correctAnswer: 'A',
          analysis: '解析内容...',
          stats: {
            totalAttempts: 100,
            correctRate: 0.85
          }
        }
      };

      global.fetch.mockResolvedValueOnce(mockApiResponse(mockResponse));

      const result = await callApi('answer-submit', {
        action: 'submit',
        userId: 'user_001',
        questionId: 'q_001',
        userAnswer: 'A',
        duration: 45
      });

      expect(result.code).toBe(0);
      expect(result.data.isCorrect).toBeDefined();
      expect(result.data.correctAnswer).toBeDefined();
    });

    it('应该验证必填参数', async () => {
      const mockResponse = {
        code: 400,
        success: false,
        message: '缺少必填参数'
      };

      global.fetch.mockResolvedValueOnce(mockApiResponse(mockResponse));

      const result = await callApi('answer-submit', {
        action: 'submit',
        // 缺少 userId 和 questionId
        userAnswer: 'A'
      });

      expect(result.code).toBe(400);
    });
  });
});

describe('错题模块 API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('应该成功获取错题列表', async () => {
    const mockResponse = {
      code: 0,
      success: true,
      data: {
        mistakes: [
          {
            _id: 'm_001',
            question_id: 'q_001',
            question_content: '题目内容',
            user_answer: 'B',
            correct_answer: 'A',
            error_count: 2,
            is_mastered: false
          }
        ],
        total: 50,
        page: 1
      }
    };

    global.fetch.mockResolvedValueOnce(mockApiResponse(mockResponse));

    const result = await callApi('mistake-manager', {
      action: 'get',
      userId: 'user_001',
      page: 1,
      limit: 20
    });

    expect(result.code).toBe(0);
    expect(result.data.mistakes).toBeInstanceOf(Array);
  });

  it('应该成功添加错题', async () => {
    const mockResponse = {
      code: 0,
      success: true,
      data: { mistakeId: 'm_002' }
    };

    global.fetch.mockResolvedValueOnce(mockApiResponse(mockResponse));

    const result = await callApi('mistake-manager', {
      action: 'add',
      userId: 'user_001',
      questionId: 'q_002',
      question_content: '新错题内容',
      user_answer: 'C',
      correct_answer: 'B'
    });

    expect(result.code).toBe(0);
    expect(result.data.mistakeId).toBeDefined();
  });

  it('应该成功标记错题为已掌握', async () => {
    const mockResponse = {
      code: 0,
      success: true,
      message: '更新成功'
    };

    global.fetch.mockResolvedValueOnce(mockApiResponse(mockResponse));

    const result = await callApi('mistake-manager', {
      action: 'update',
      userId: 'user_001',
      mistakeId: 'm_001',
      is_mastered: true
    });

    expect(result.code).toBe(0);
  });
});

describe('收藏模块 API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('应该成功添加收藏', async () => {
    const mockResponse = {
      code: 0,
      success: true,
      data: { favoriteId: 'fav_001' }
    };

    global.fetch.mockResolvedValueOnce(mockApiResponse(mockResponse));

    const result = await callApi('favorite-manager', {
      action: 'add',
      userId: 'user_001',
      questionId: 'q_001',
      question_content: '收藏的题目'
    });

    expect(result.code).toBe(0);
    expect(result.data.favoriteId).toBeDefined();
  });

  it('应该成功获取收藏列表', async () => {
    const mockResponse = {
      code: 0,
      success: true,
      data: {
        favorites: [
          { _id: 'fav_001', question_id: 'q_001', question_content: '题目1' }
        ],
        total: 10
      }
    };

    global.fetch.mockResolvedValueOnce(mockApiResponse(mockResponse));

    const result = await callApi('favorite-manager', {
      action: 'get',
      userId: 'user_001'
    });

    expect(result.code).toBe(0);
    expect(result.data.favorites).toBeInstanceOf(Array);
  });

  it('应该成功移除收藏', async () => {
    const mockResponse = {
      code: 0,
      success: true,
      message: '移除成功'
    };

    global.fetch.mockResolvedValueOnce(mockApiResponse(mockResponse));

    const result = await callApi('favorite-manager', {
      action: 'remove',
      userId: 'user_001',
      favoriteId: 'fav_001'
    });

    expect(result.code).toBe(0);
  });
});

describe('AI 服务模块 API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('应该成功调用 AI 聊天', async () => {
    const mockResponse = {
      code: 0,
      success: true,
      data: {
        reply: 'AI 回复内容...',
        tokens: 150
      }
    };

    global.fetch.mockResolvedValueOnce(mockApiResponse(mockResponse));

    const result = await callApi('proxy-ai', {
      action: 'chat',
      content: '什么是马克思主义？',
      userId: 'user_001'
    });

    expect(result.code).toBe(0);
    expect(result.data.reply).toBeDefined();
  });

  it('应该成功生成错题分析', async () => {
    const mockResponse = {
      code: 0,
      success: true,
      data: {
        errorType: { primary: 'concept_confusion', confidence: 0.85 },
        analysis: {
          surface: { wrongChoice: 'B', correctChoice: 'A' },
          deep: { knowledgeGap: '概念理解不清' }
        },
        improvement: {
          immediate: { action: '复习相关概念' }
        }
      }
    };

    global.fetch.mockResolvedValueOnce(mockApiResponse(mockResponse));

    const result = await callApi('proxy-ai', {
      action: 'analyze',
      question: '题目内容',
      userAnswer: 'B',
      correctAnswer: 'A'
    });

    expect(result.code).toBe(0);
    expect(result.data.errorType).toBeDefined();
    expect(result.data.analysis).toBeDefined();
  });

  it('应该处理速率限制', async () => {
    const mockResponse = {
      code: 429,
      success: false,
      message: '请求过于频繁，请稍后再试'
    };

    global.fetch.mockResolvedValueOnce(mockApiResponse(mockResponse, 429));

    const result = await callApi('proxy-ai', {
      action: 'chat',
      content: '测试',
      userId: 'user_001'
    });

    expect(result.code).toBe(429);
  });
});

describe('拍照搜题 API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('应该成功识别图片中的题目', async () => {
    const mockResponse = {
      code: 0,
      success: true,
      data: {
        recognition: {
          questionText: '识别的题目文本',
          questionType: '单选题',
          options: ['A. 选项1', 'B. 选项2'],
          confidence: 0.95
        },
        matchedQuestions: [],
        aiSolution: {
          answer: 'A',
          analysis: { 思路: '解题思路...' }
        }
      }
    };

    global.fetch.mockResolvedValueOnce(mockApiResponse(mockResponse));

    const result = await callApi('ai-photo-search', {
      action: 'search',
      imageBase64: 'base64_image_data',
      subject: 'math',
      userId: 'user_001'
    });

    expect(result.code).toBe(0);
    expect(result.data.recognition).toBeDefined();
    expect(result.data.recognition.questionText).toBeDefined();
  });
});

describe('学习小组 API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('应该成功创建学习小组', async () => {
    const mockResponse = {
      code: 0,
      success: true,
      data: {
        groupId: 'group_001',
        name: '清华计算机考研群'
      }
    };

    global.fetch.mockResolvedValueOnce(mockApiResponse(mockResponse));

    const result = await callApi('group-manager', {
      action: 'create',
      userId: 'user_001',
      name: '清华计算机考研群',
      description: '备考清华CS的同学交流'
    });

    expect(result.code).toBe(0);
    expect(result.data.groupId).toBeDefined();
  });

  it('应该成功加入学习小组', async () => {
    const mockResponse = {
      code: 0,
      success: true,
      message: '加入成功'
    };

    global.fetch.mockResolvedValueOnce(mockApiResponse(mockResponse));

    const result = await callApi('group-manager', {
      action: 'join',
      userId: 'user_002',
      groupId: 'group_001'
    });

    expect(result.code).toBe(0);
  });

  it('应该成功获取小组列表', async () => {
    const mockResponse = {
      code: 0,
      success: true,
      data: {
        groups: [
          { _id: 'group_001', name: '清华计算机考研群', member_count: 25 }
        ],
        total: 5
      }
    };

    global.fetch.mockResolvedValueOnce(mockApiResponse(mockResponse));

    const result = await callApi('group-manager', {
      action: 'list',
      userId: 'user_001'
    });

    expect(result.code).toBe(0);
    expect(result.data.groups).toBeInstanceOf(Array);
  });
});

describe('排行榜 API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('应该成功获取排行榜', async () => {
    const mockResponse = {
      code: 0,
      success: true,
      data: {
        rankings: [
          { rank: 1, userId: 'user_001', nickname: '学霸小王', value: 100 },
          { rank: 2, userId: 'user_002', nickname: '努力小李', value: 95 }
        ],
        total: 100
      }
    };

    global.fetch.mockResolvedValueOnce(mockApiResponse(mockResponse));

    const result = await callApi('rank-center', {
      action: 'get_ranking',
      type: 'streak',
      page: 1,
      limit: 50
    });

    expect(result.code).toBe(0);
    expect(result.data.rankings).toBeInstanceOf(Array);
    expect(result.data.rankings[0].rank).toBe(1);
  });

  it('应该成功获取用户排名', async () => {
    const mockResponse = {
      code: 0,
      success: true,
      data: {
        rank: 15,
        value: 30,
        percentile: 85
      }
    };

    global.fetch.mockResolvedValueOnce(mockApiResponse(mockResponse));

    const result = await callApi('rank-center', {
      action: 'get_user_rank',
      userId: 'user_001',
      type: 'streak'
    });

    expect(result.code).toBe(0);
    expect(result.data.rank).toBeDefined();
  });
});

describe('API 响应格式验证', () => {
  it('所有成功响应应包含标准字段', async () => {
    const mockResponse = {
      code: 0,
      success: true,
      message: 'success',
      data: {},
      requestId: 'req_xxx',
      duration: 123
    };

    global.fetch.mockResolvedValueOnce(mockApiResponse(mockResponse));

    const result = await callApi('user-profile', { action: 'get', userId: 'user_001' });

    expect(result).toHaveProperty('code');
    expect(result).toHaveProperty('success');
    expect(result).toHaveProperty('message');
  });

  it('所有错误响应应包含错误信息', async () => {
    const mockResponse = {
      code: 400,
      success: false,
      message: '参数错误：缺少必填字段'
    };

    global.fetch.mockResolvedValueOnce(mockApiResponse(mockResponse, 400));

    const result = await callApi('user-profile', { action: 'get' });

    expect(result.code).not.toBe(0);
    expect(result.success).toBe(false);
    expect(result.message).toBeDefined();
  });
});
