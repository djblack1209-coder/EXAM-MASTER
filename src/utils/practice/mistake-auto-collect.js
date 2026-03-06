/**
 * 错题自动收录模块
 * 答错后自动收录到错题本，支持复习、掌握标记、批量收录
 */

const STORAGE_KEY = 'mistake_book';

import { storageService } from '@/services/storageService.js';
import { mistakeClassifier } from '@/utils/practice/mistake-classifier.js';

/**
 * 懒加载分类器（避免硬依赖不存在的模块）
 */
async function _classify(question) {
  try {
    return mistakeClassifier.classify(question);
  } catch (_e) {
    return null;
  }
}

/**
 * 从存储读取错题本
 */
function _getMistakeBook() {
  try {
    if (global.__mockStorage !== undefined) {
      return global.__mockStorage[STORAGE_KEY] || [];
    }
    return storageService.get(STORAGE_KEY, []);
  } catch (_e) {
    return [];
  }
}

/**
 * 保存错题本到存储
 */
function _saveMistakeBook(book) {
  try {
    if (global.__mockStorage !== undefined) {
      global.__mockStorage[STORAGE_KEY] = book;
    } else {
      storageService.save(STORAGE_KEY, book, true);
    }
  } catch (_e) {
    // 静默失败
  }
}

/**
 * 将数字答案转换为字母
 */
function _toLetterAnswer(answer) {
  if (typeof answer === 'number') {
    const letters = ['A', 'B', 'C', 'D'];
    return letters[answer] || String(answer);
  }
  return String(answer);
}

/**
 * 自动收录错题
 * @param {Object} question - 题目对象
 * @param {string|number} userAnswer - 用户答案
 * @param {string} aiComment - AI解析
 * @returns {Object} 收录结果
 */
export async function autoCollectMistake(question, userAnswer, aiComment) {
  if (!question || !question.id) {
    return { success: false, error: 'invalid_question' };
  }

  const book = _getMistakeBook();
  const letterAnswer = _toLetterAnswer(userAnswer);

  // 分类
  const classification = await _classify(question);

  const existing = book.find((m) => m.id === question.id);

  if (existing) {
    existing.wrong_count = (existing.wrong_count || 1) + 1;
    existing.user_answer = letterAnswer;
    existing.last_wrong_time = Date.now();
    if (aiComment) {
      existing.ai_comment = aiComment;
    }
    _saveMistakeBook(book);
    return {
      success: true,
      isNew: false,
      wrongCount: existing.wrong_count,
      classification
    };
  }

  const record = {
    id: question.id,
    question: question.question || question.title || '',
    options: question.options || [],
    user_answer: letterAnswer,
    correct_answer: question.answer,
    category: classification?.category || question.category || '未分类',
    difficulty: classification?.difficulty || question.difficulty || 'medium',
    wrong_count: 1,
    review_count: 0,
    mastery_level: 0,
    is_mastered: false,
    ai_comment: aiComment || '',
    classification,
    created_at: Date.now(),
    last_wrong_time: Date.now()
  };

  book.push(record);
  _saveMistakeBook(book);

  return {
    success: true,
    isNew: true,
    wrongCount: 1,
    classification
  };
}

/**
 * 获取错题统计
 */
export function getMistakeStats() {
  const book = _getMistakeBook();
  const byCategory = {};
  const byDifficulty = {};

  book.forEach((m) => {
    const cat = m.category || '未分类';
    byCategory[cat] = (byCategory[cat] || 0) + 1;

    const diff = m.difficulty || 'medium';
    byDifficulty[diff] = (byDifficulty[diff] || 0) + 1;
  });

  return {
    totalCount: book.length,
    byCategory,
    byDifficulty
  };
}

/**
 * 记录复习结果
 * @param {string} id - 错题ID
 * @param {boolean} isCorrect - 是否答对
 */
export function recordReview(id, isCorrect) {
  const book = _getMistakeBook();
  const mistake = book.find((m) => m.id === id);
  if (!mistake) return;

  mistake.review_count = (mistake.review_count || 0) + 1;

  if (isCorrect) {
    mistake.mastery_level = Math.min(100, (mistake.mastery_level || 0) + 20);
  } else {
    mistake.mastery_level = Math.max(0, (mistake.mastery_level || 0) - 10);
  }

  mistake.is_mastered = mistake.mastery_level >= 80;
  mistake.last_review_time = Date.now();

  _saveMistakeBook(book);
}

/**
 * 直接标记为已掌握
 * @param {string} id - 错题ID
 * @returns {boolean} 是否成功
 */
export function markAsMastered(id) {
  const book = _getMistakeBook();
  const mistake = book.find((m) => m.id === id);
  if (!mistake) return false;

  mistake.is_mastered = true;
  mistake.mastery_level = 100;
  mistake.last_review_time = Date.now();

  _saveMistakeBook(book);
  return true;
}

/**
 * 批量收录错题
 * @param {Array} mistakes - 错题数组 [{question, userAnswer, aiComment}]
 * @returns {Object} 批量结果
 */
export async function batchCollectMistakes(mistakes) {
  if (!Array.isArray(mistakes) || mistakes.length === 0) {
    return { success: false, total: 0, successCount: 0 };
  }

  let successCount = 0;
  for (const item of mistakes) {
    const result = await autoCollectMistake(item.question, item.userAnswer, item.aiComment);
    if (result.success) successCount++;
  }

  return {
    success: true,
    total: mistakes.length,
    successCount
  };
}
