/**
 * 错题自动收录器 - 检查点2.3
 * 自动将错题写入错题本并进行分类标签
 *
 * 功能：
 * 1. 自动收录错题到 mistake-store
 * 2. 智能分类标签（知识点、难度、错误类型）
 * 3. 统计错误频次
 */

import { mistakeClassifier } from './mistake-classifier.js';
import storageService from '@/services/storageService.js';
import { logger } from '@/utils/logger.js';

// 存储键名
const MISTAKE_BOOK_KEY = 'mistake_book';
const MISTAKE_STATS_KEY = 'mistake_stats';

/**
 * 自动收录错题
 * @param {Object} question - 题目信息
 * @param {string|number} userAnswer - 用户答案
 * @param {string} aiAnalysis - AI解析（可选）
 * @returns {Object} 收录结果
 */
export async function autoCollectMistake(question, userAnswer, aiAnalysis = '') {
  if (!question) {
    console.warn('[MistakeAutoCollect] 题目信息为空');
    return { success: false, error: 'invalid_question' };
  }

  try {
    // 1. 获取现有错题本
    const mistakeBook = storageService.get(MISTAKE_BOOK_KEY, []);

    // 2. 检查是否已存在
    const questionText = question.question || question.title || '';
    const existingIndex = mistakeBook.findIndex((m) =>
      m.question === questionText ||
      m.question_content === questionText ||
      (m.id && m.id === question.id)
    );

    // 3. 智能分类
    const classification = await mistakeClassifier.classify(question, userAnswer);

    // 4. 构建错题记录
    const mistakeRecord = {
      id: question.id || `mistake_${Date.now()}`,
      question: questionText,
      question_content: questionText,
      options: question.options || [],
      user_answer: formatAnswer(userAnswer),
      correct_answer: question.answer || '',
      analysis: aiAnalysis || question.desc || question.analysis || '',

      // 分类标签
      tags: classification.tags || [],
      category: classification.category || question.category || '未分类',
      difficulty: classification.difficulty || 'medium',
      error_type: classification.errorType || 'unknown',
      knowledge_points: classification.knowledgePoints || [],

      // 统计信息
      wrong_count: 1,
      review_count: 0,
      is_mastered: false,
      mastery_level: 0, // 0-100

      // 时间戳
      first_wrong_time: Date.now(),
      last_wrong_time: Date.now(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),

      // 同步状态
      sync_status: 'pending'
    };

    // 5. 更新或新增
    if (existingIndex >= 0) {
      // 已存在，更新错误次数和时间
      const existing = mistakeBook[existingIndex];
      mistakeRecord.wrong_count = (existing.wrong_count || 1) + 1;
      mistakeRecord.first_wrong_time = existing.first_wrong_time || Date.now();
      mistakeRecord.review_count = existing.review_count || 0;
      mistakeRecord.mastery_level = Math.max(0, (existing.mastery_level || 0) - 10); // 再次错误降低掌握度

      // 合并标签（去重）
      const existingTags = existing.tags || [];
      mistakeRecord.tags = [...new Set([...existingTags, ...mistakeRecord.tags])];

      mistakeBook[existingIndex] = { ...existing, ...mistakeRecord };
      logger.log('[MistakeAutoCollect] 更新已有错题，错误次数:', mistakeRecord.wrong_count);
    } else {
      // 新增
      mistakeBook.unshift(mistakeRecord);
      logger.log('[MistakeAutoCollect] 新增错题');
    }

    // 6. 保存（异步写入避免大数据阻塞UI）
    storageService.save(MISTAKE_BOOK_KEY, mistakeBook);

    // 7. 更新统计
    updateMistakeStats(classification);

    logger.log('[MistakeAutoCollect] 错题收录成功:', {
      id: mistakeRecord.id,
      tags: mistakeRecord.tags,
      category: mistakeRecord.category,
      wrongCount: mistakeRecord.wrong_count
    });

    return {
      success: true,
      mistakeId: mistakeRecord.id,
      isNew: existingIndex < 0,
      wrongCount: mistakeRecord.wrong_count,
      classification
    };

  } catch (error) {
    console.error('[MistakeAutoCollect] 收录错题失败:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 格式化答案
 * @param {string|number} answer - 原始答案
 * @returns {string} 格式化后的答案
 */
function formatAnswer(answer) {
  if (typeof answer === 'number') {
    return String.fromCharCode(65 + answer); // 0->A, 1->B, etc.
  }
  return String(answer).toUpperCase();
}

/**
 * 更新错题统计
 * @param {Object} classification - 分类信息
 */
function updateMistakeStats(classification) {
  try {
    const stats = storageService.get(MISTAKE_STATS_KEY, {
      totalCount: 0,
      byCategory: {},
      byDifficulty: {},
      byErrorType: {},
      byKnowledgePoint: {}
    });

    stats.totalCount++;

    // 按分类统计
    if (classification.category) {
      stats.byCategory[classification.category] = (stats.byCategory[classification.category] || 0) + 1;
    }

    // 按难度统计
    if (classification.difficulty) {
      stats.byDifficulty[classification.difficulty] = (stats.byDifficulty[classification.difficulty] || 0) + 1;
    }

    // 按错误类型统计
    if (classification.errorType) {
      stats.byErrorType[classification.errorType] = (stats.byErrorType[classification.errorType] || 0) + 1;
    }

    // 按知识点统计
    if (classification.knowledgePoints) {
      classification.knowledgePoints.forEach((kp) => {
        stats.byKnowledgePoint[kp] = (stats.byKnowledgePoint[kp] || 0) + 1;
      });
    }

    stats.lastUpdated = Date.now();
    storageService.save(MISTAKE_STATS_KEY, stats);

  } catch (error) {
    console.error('[MistakeAutoCollect] 更新统计失败:', error);
  }
}

/**
 * 获取错题统计
 * @returns {Object} 统计信息
 */
export function getMistakeStats() {
  return storageService.get(MISTAKE_STATS_KEY, {
    totalCount: 0,
    byCategory: {},
    byDifficulty: {},
    byErrorType: {},
    byKnowledgePoint: {}
  });
}

/**
 * 批量收录错题
 * @param {Array} mistakes - 错题列表
 * @returns {Object} 收录结果
 */
export async function batchCollectMistakes(mistakes) {
  if (!Array.isArray(mistakes) || mistakes.length === 0) {
    return { success: false, error: 'invalid_input' };
  }

  const results = [];
  for (const mistake of mistakes) {
    const result = await autoCollectMistake(
      mistake.question,
      mistake.userAnswer,
      mistake.aiAnalysis
    );
    results.push(result);
  }

  const successCount = results.filter((r) => r.success).length;
  logger.log('[MistakeAutoCollect] 批量收录完成:', {
    total: mistakes.length,
    success: successCount,
    failed: mistakes.length - successCount
  });

  return {
    success: true,
    total: mistakes.length,
    successCount,
    results
  };
}

/**
 * 标记错题为已掌握
 * @param {string} mistakeId - 错题ID
 * @returns {boolean} 是否成功
 */
export function markAsMastered(mistakeId) {
  try {
    const mistakeBook = storageService.get(MISTAKE_BOOK_KEY, []);
    const index = mistakeBook.findIndex((m) => m.id === mistakeId);

    if (index >= 0) {
      mistakeBook[index].is_mastered = true;
      mistakeBook[index].mastery_level = 100;
      mistakeBook[index].updated_at = new Date().toISOString();
      storageService.save(MISTAKE_BOOK_KEY, mistakeBook);
      return true;
    }
    return false;
  } catch (error) {
    console.error('[MistakeAutoCollect] 标记掌握失败:', error);
    return false;
  }
}

/**
 * 增加复习次数
 * @param {string} mistakeId - 错题ID
 * @param {boolean} isCorrect - 复习时是否答对
 * @returns {boolean} 是否成功
 */
export function recordReview(mistakeId, isCorrect = false) {
  try {
    const mistakeBook = storageService.get(MISTAKE_BOOK_KEY, []);
    const index = mistakeBook.findIndex((m) => m.id === mistakeId);

    if (index >= 0) {
      const mistake = mistakeBook[index];
      mistake.review_count = (mistake.review_count || 0) + 1;

      // 根据复习结果调整掌握度
      if (isCorrect) {
        mistake.mastery_level = Math.min(100, (mistake.mastery_level || 0) + 20);
        if (mistake.mastery_level >= 80) {
          mistake.is_mastered = true;
        }
      } else {
        mistake.mastery_level = Math.max(0, (mistake.mastery_level || 0) - 10);
        mistake.is_mastered = false;
      }

      mistake.updated_at = new Date().toISOString();
      mistakeBook[index] = mistake;
      storageService.save(MISTAKE_BOOK_KEY, mistakeBook);
      return true;
    }
    return false;
  } catch (error) {
    console.error('[MistakeAutoCollect] 记录复习失败:', error);
    return false;
  }
}

export default {
  autoCollectMistake,
  batchCollectMistakes,
  getMistakeStats,
  markAsMastered,
  recordReview
};
