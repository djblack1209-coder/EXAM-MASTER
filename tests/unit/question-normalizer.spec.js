/**
 * question-normalizer 单元测试
 * 覆盖题目标准化、验证、批量处理、智能输入清洗
 */
import { describe, it, expect } from 'vitest';
import {
  normalizeQuestion,
  isValidQuestion,
  normalizeAndValidateQuestions,
  sanitizeAIInput
} from '@/utils/practice/question-normalizer.js';

// 标准题目模板
const validQ = {
  question: '以下哪个是正确的？',
  options: ['A. 选项1', 'B. 选项2', 'C. 选项3', 'D. 选项4'],
  answer: 'B',
  category: '数学'
};

describe('normalizeQuestion', () => {
  it('标准字段应原样保留', () => {
    const result = normalizeQuestion(validQ);
    expect(result.question).toBe('以下哪个是正确的？');
    expect(result.answer).toBe('B');
    expect(result.category).toBe('数学');
    expect(result.type).toBe('单选');
  });

  it('应兼容 title 字段作为题干', () => {
    const q = { title: '题目内容', options: ['A', 'B', 'C', 'D'], answer: 'A' };
    expect(normalizeQuestion(q).question).toBe('题目内容');
  });

  it('应兼容 content 字段作为题干', () => {
    const q = { content: '题目内容', options: ['A', 'B', 'C', 'D'], answer: 'C' };
    expect(normalizeQuestion(q).question).toBe('题目内容');
  });

  it('应兼容 correct_answer 字段', () => {
    const q = { question: 'Q', options: ['A', 'B', 'C', 'D'], correct_answer: 'c' };
    expect(normalizeQuestion(q).answer).toBe('C');
  });

  it('应兼容 correctAnswer 字段', () => {
    const q = { question: 'Q', options: ['A', 'B', 'C', 'D'], correctAnswer: 'd' };
    expect(normalizeQuestion(q).answer).toBe('D');
  });

  it('应兼容 subject 作为 category', () => {
    const q = { question: 'Q', options: [], answer: 'A', subject: '英语' };
    expect(normalizeQuestion(q).category).toBe('英语');
  });

  it('应兼容 analysis 作为 desc', () => {
    const q = { question: 'Q', options: [], answer: 'A', analysis: '解析内容' };
    expect(normalizeQuestion(q).desc).toBe('解析内容');
  });

  it('无 category 时默认为 未分类', () => {
    const q = { question: 'Q', options: [], answer: 'A' };
    expect(normalizeQuestion(q).category).toBe('未分类');
  });

  it('非数组 options 应转为空数组', () => {
    const q = { question: 'Q', options: 'not array', answer: 'A' };
    expect(normalizeQuestion(q).options).toEqual([]);
  });

  it('answer 应转大写首字母', () => {
    const q = { question: 'Q', options: [], answer: 'abc' };
    expect(normalizeQuestion(q).answer).toBe('A');
  });
});

describe('isValidQuestion', () => {
  it('标准题目应通过验证', () => {
    expect(isValidQuestion(validQ)).toBe(true);
  });

  it('空题干应不通过', () => {
    expect(isValidQuestion({ ...validQ, question: '' })).toBe(false);
    expect(isValidQuestion({ ...validQ, question: '   ' })).toBe(false);
  });

  it('选项不足4个应不通过', () => {
    expect(isValidQuestion({ ...validQ, options: ['A', 'B', 'C'] })).toBe(false);
  });

  it('非数组选项应不通过', () => {
    expect(isValidQuestion({ ...validQ, options: 'not array' })).toBe(false);
  });

  it('无效答案应不通过', () => {
    expect(isValidQuestion({ ...validQ, answer: 'E' })).toBe(false);
    expect(isValidQuestion({ ...validQ, answer: '' })).toBe(false);
    expect(isValidQuestion({ ...validQ, answer: null })).toBe(false);
  });

  it('ABCD 答案都应通过', () => {
    for (const a of ['A', 'B', 'C', 'D']) {
      expect(isValidQuestion({ ...validQ, answer: a })).toBe(true);
    }
  });
});

describe('normalizeAndValidateQuestions', () => {
  it('应过滤无效题目', () => {
    const input = [
      validQ,
      { question: '', options: ['A', 'B', 'C', 'D'], answer: 'A' }, // 空题干
      { question: 'Q2', options: ['A'], answer: 'A' } // 选项不足
    ];
    const result = normalizeAndValidateQuestions(input);
    expect(result).toHaveLength(1);
    expect(result[0].question).toBe('以下哪个是正确的？');
  });

  it('数字答案 0-3 应转为 A-D', () => {
    const input = [
      { question: 'Q', options: ['A', 'B', 'C', 'D'], answer: 0 },
      { question: 'Q2', options: ['A', 'B', 'C', 'D'], answer: 2 }
    ];
    const result = normalizeAndValidateQuestions(input);
    expect(result[0].answer).toBe('A');
    expect(result[1].answer).toBe('C');
  });

  it('correct 字段应作为答案备选', () => {
    const input = [{ question: 'Q', options: ['A', 'B', 'C', 'D'], correct: 1 }];
    const result = normalizeAndValidateQuestions(input);
    expect(result[0].answer).toBe('B');
  });

  it('无答案时默认为 A', () => {
    const input = [{ question: 'Q', options: ['A', 'B', 'C', 'D'] }];
    const result = normalizeAndValidateQuestions(input);
    expect(result[0].answer).toBe('A');
  });

  it('空数组输入应返回空数组', () => {
    expect(normalizeAndValidateQuestions([])).toEqual([]);
  });

  it('应保留原始额外字段', () => {
    const input = [{ ...validQ, difficulty: 3, source: '真题' }];
    const result = normalizeAndValidateQuestions(input);
    expect(result[0].difficulty).toBe(3);
    expect(result[0].source).toBe('真题');
  });
});

describe('sanitizeAIInput', () => {
  it('正常文本应原样返回', () => {
    expect(sanitizeAIInput('你好世界')).toBe('你好世界');
  });

  it('应移除控制字符', () => {
    expect(sanitizeAIInput('hello\x00world\x07test')).toBe('helloworldtest');
  });

  it('应保留换行符', () => {
    expect(sanitizeAIInput('line1\nline2')).toBe('line1\nline2');
  });

  it('应截断超长内容', () => {
    const long = 'a'.repeat(10000);
    expect(sanitizeAIInput(long, 100).length).toBe(100);
  });

  it('默认最大长度为 8000', () => {
    const long = 'b'.repeat(9000);
    expect(sanitizeAIInput(long).length).toBe(8000);
  });

  it('应 trim 首尾空白', () => {
    expect(sanitizeAIInput('  hello  ')).toBe('hello');
  });

  it('null/undefined/非字符串应返回空字符串', () => {
    expect(sanitizeAIInput(null)).toBe('');
    expect(sanitizeAIInput(undefined)).toBe('');
    expect(sanitizeAIInput(123)).toBe('');
    expect(sanitizeAIInput('')).toBe('');
  });
});
