/**
 * field-normalizer 单元测试
 * 覆盖 snake_case/camelCase 转换、错题字段规范化、离线缓存映射
 */
import { describe, it, expect } from 'vitest';
import {
  toSnakeCase,
  toCamelCase,
  keysToSnakeCase,
  keysToCamelCase,
  normalizeMistake,
  normalizeMistakes,
  offlineMistakeToBackend
} from '@/utils/field-normalizer.js';

// ==================== 通用转换函数 ====================

describe('toSnakeCase', () => {
  it('camelCase → snake_case', () => {
    expect(toSnakeCase('questionContent')).toBe('question_content');
    expect(toSnakeCase('wrongCount')).toBe('wrong_count');
    expect(toSnakeCase('isMastered')).toBe('is_mastered');
  });

  it('已经是 snake_case 应不变', () => {
    expect(toSnakeCase('question_content')).toBe('question_content');
  });

  it('单个单词应不变', () => {
    expect(toSnakeCase('question')).toBe('question');
  });

  it('首字母大写应正确处理', () => {
    expect(toSnakeCase('QuestionContent')).toBe('question_content');
  });

  it('非字符串输入应原样返回', () => {
    expect(toSnakeCase(null)).toBe(null);
    expect(toSnakeCase(undefined)).toBe(undefined);
    expect(toSnakeCase('')).toBe('');
    expect(toSnakeCase(123)).toBe(123);
  });
});

describe('toCamelCase', () => {
  it('snake_case → camelCase', () => {
    expect(toCamelCase('question_content')).toBe('questionContent');
    expect(toCamelCase('wrong_count')).toBe('wrongCount');
    expect(toCamelCase('is_mastered')).toBe('isMastered');
  });

  it('已经是 camelCase 应不变', () => {
    expect(toCamelCase('questionContent')).toBe('questionContent');
  });

  it('单个单词应不变', () => {
    expect(toCamelCase('question')).toBe('question');
  });

  it('非字符串输入应原样返回', () => {
    expect(toCamelCase(null)).toBe(null);
    expect(toCamelCase(undefined)).toBe(undefined);
    expect(toCamelCase('')).toBe('');
  });
});

describe('keysToSnakeCase', () => {
  it('应转换所有键', () => {
    const input = { questionContent: '题目', wrongCount: 3, isMastered: false };
    const result = keysToSnakeCase(input);
    expect(result).toEqual({ question_content: '题目', wrong_count: 3, is_mastered: false });
  });

  it('值不应被修改', () => {
    const input = { myArray: [1, 2, 3], myObj: { nested: true } };
    const result = keysToSnakeCase(input);
    expect(result.my_array).toEqual([1, 2, 3]);
    expect(result.my_obj).toEqual({ nested: true });
  });

  it('非对象输入应原样返回', () => {
    expect(keysToSnakeCase(null)).toBe(null);
    expect(keysToSnakeCase(undefined)).toBe(undefined);
    expect(keysToSnakeCase([1, 2])).toEqual([1, 2]);
    expect(keysToSnakeCase('string')).toBe('string');
  });
});

describe('keysToCamelCase', () => {
  it('应转换所有键', () => {
    const input = { question_content: '题目', wrong_count: 3, is_mastered: false };
    const result = keysToCamelCase(input);
    expect(result).toEqual({ questionContent: '题目', wrongCount: 3, isMastered: false });
  });

  it('非对象输入应原样返回', () => {
    expect(keysToCamelCase(null)).toBe(null);
    expect(keysToCamelCase([1, 2])).toEqual([1, 2]);
  });
});

// ==================== 错题数据规范化 ====================

describe('normalizeMistake', () => {
  it('标准 snake_case 字段应保留', () => {
    const input = {
      question_content: '题目内容',
      correct_answer: 'B',
      user_answer: 'A',
      wrong_count: 3,
      is_mastered: false
    };
    const result = normalizeMistake(input);
    expect(result.question_content).toBe('题目内容');
    expect(result.correct_answer).toBe('B');
    expect(result.user_answer).toBe('A');
    expect(result.wrong_count).toBe(3);
    expect(result.is_mastered).toBe(false);
  });

  it('camelCase 别名应映射到标准字段', () => {
    const input = {
      questionContent: '题目',
      correctAnswer: 'C',
      userAnswer: 'D',
      wrongCount: 2,
      isMastered: true
    };
    const result = normalizeMistake(input);
    expect(result.question_content).toBe('题目');
    expect(result.correct_answer).toBe('C');
    expect(result.user_answer).toBe('D');
    expect(result.wrong_count).toBe(2);
    expect(result.is_mastered).toBe(true);
  });

  it('旧版别名应映射到标准字段', () => {
    const input = {
      question: '旧版题干',
      answer: 'A',
      userChoice: 'B'
    };
    const result = normalizeMistake(input);
    expect(result.question_content).toBe('旧版题干');
    expect(result.correct_answer).toBe('A');
    expect(result.user_answer).toBe('B');
  });

  it('标准字段优先于别名', () => {
    const input = {
      question_content: '标准题干',
      question: '旧版题干',
      questionContent: 'camelCase题干'
    };
    const result = normalizeMistake(input);
    expect(result.question_content).toBe('标准题干');
  });

  it('缺失字段应有默认值', () => {
    const result = normalizeMistake({});
    expect(result.wrong_count).toBe(1);
    expect(result.is_mastered).toBe(false);
    expect(result.review_count).toBe(0);
  });

  it('非对象输入应原样返回', () => {
    expect(normalizeMistake(null)).toBe(null);
    expect(normalizeMistake(undefined)).toBe(undefined);
    expect(normalizeMistake('string')).toBe('string');
  });

  it('额外字段应保留', () => {
    const input = { question_content: 'Q', tags: ['数学'], subject: '高数' };
    const result = normalizeMistake(input);
    expect(result.tags).toEqual(['数学']);
    expect(result.subject).toBe('高数');
  });
});

describe('normalizeMistakes', () => {
  it('应批量规范化', () => {
    const input = [
      { question: 'Q1', answer: 'A' },
      { questionContent: 'Q2', correctAnswer: 'B' }
    ];
    const result = normalizeMistakes(input);
    expect(result).toHaveLength(2);
    expect(result[0].question_content).toBe('Q1');
    expect(result[1].question_content).toBe('Q2');
  });

  it('非数组输入应返回空数组', () => {
    expect(normalizeMistakes(null)).toEqual([]);
    expect(normalizeMistakes(undefined)).toEqual([]);
    expect(normalizeMistakes('string')).toEqual([]);
  });

  it('空数组应返回空数组', () => {
    expect(normalizeMistakes([])).toEqual([]);
  });
});

// ==================== 离线缓存映射 ====================

describe('offlineMistakeToBackend', () => {
  it('camelCase 离线数据应转为 snake_case', () => {
    const cached = {
      questionContent: '离线题目',
      userAnswer: 'A',
      correctAnswer: 'B',
      wrongCount: 2,
      isMastered: false,
      createdAt: 1000000
    };
    const result = offlineMistakeToBackend(cached);
    expect(result.question_content).toBe('离线题目');
    expect(result.user_answer).toBe('A');
    expect(result.correct_answer).toBe('B');
    expect(result.wrong_count).toBe(2);
    expect(result.is_mastered).toBe(false);
    expect(result.created_at).toBe(1000000);
    expect(result.updated_at).toBeGreaterThan(0);
  });

  it('snake_case 数据应直接通过', () => {
    const cached = {
      question_content: '题目',
      user_answer: 'C',
      correct_answer: 'D',
      wrong_count: 1
    };
    const result = offlineMistakeToBackend(cached);
    expect(result.question_content).toBe('题目');
    expect(result.user_answer).toBe('C');
  });

  it('应保留 _id、subject、tags 等原始字段', () => {
    const cached = {
      _id: 'abc123',
      question: 'Q',
      subject: '数学',
      tags: ['高数'],
      options: ['A', 'B', 'C', 'D'],
      analysis: '解析'
    };
    const result = offlineMistakeToBackend(cached);
    expect(result._id).toBe('abc123');
    expect(result.subject).toBe('数学');
    expect(result.tags).toEqual(['高数']);
    expect(result.options).toEqual(['A', 'B', 'C', 'D']);
    expect(result.analysis).toBe('解析');
  });

  it('缺失字段应有默认值', () => {
    const result = offlineMistakeToBackend({});
    expect(result.question_id).toBe('');
    expect(result.question_content).toBe('');
    expect(result.wrong_count).toBe(1);
    expect(result.is_mastered).toBe(false);
  });

  it('非对象输入应原样返回', () => {
    expect(offlineMistakeToBackend(null)).toBe(null);
    expect(offlineMistakeToBackend(undefined)).toBe(undefined);
  });
});
