/**
 * 题目去重 Worker - 检查点2.4
 * 支持内容相似度98%去重
 * 
 * 功能：
 * 1. 精确匹配去重（questionId）
 * 2. 内容相似度去重（98%阈值）
 * 3. 批量去重处理
 * 4. 去重报告生成
 */

import { similarityComparison } from './similarity-comparison.js';

// 去重配置
const DEDUP_CONFIG = {
  // 相似度阈值（0-1），超过此值视为重复
  similarityThreshold: 0.98,
  // 是否启用模糊匹配
  enableFuzzyMatch: true,
  // 最大比较数量（性能优化）
  maxCompareCount: 1000,
  // 是否保留更完整的题目
  keepMoreComplete: true
};

/**
 * 题目去重器
 */
export const questionDedupWorker = {
  /**
   * 去重题目列表
   * @param {Array} questions - 待去重的题目列表
   * @param {Array} existingQuestions - 已有题目列表（可选）
   * @param {Object} options - 去重选项
   * @returns {Object} 去重结果
   */
  deduplicate(questions, existingQuestions = [], options = {}) {
    const config = { ...DEDUP_CONFIG, ...options };
    const startTime = Date.now();
    
    console.log('[QuestionDedup] 开始去重处理:', {
      newCount: questions.length,
      existingCount: existingQuestions.length,
      threshold: config.similarityThreshold
    });
    
    if (!Array.isArray(questions) || questions.length === 0) {
      return {
        success: true,
        uniqueQuestions: [],
        duplicates: [],
        stats: { total: 0, unique: 0, duplicate: 0, time: 0 }
      };
    }
    
    const uniqueQuestions = [];
    const duplicates = [];
    const seenHashes = new Set();
    const seenTexts = [];
    
    // 1. 先处理已有题目，建立索引
    existingQuestions.forEach(q => {
      const hash = this.generateHash(q);
      seenHashes.add(hash);
      seenTexts.push({
        text: this.normalizeText(q.question || q.title || ''),
        question: q
      });
    });
    
    // 2. 处理新题目
    for (const question of questions) {
      const hash = this.generateHash(question);
      const normalizedText = this.normalizeText(question.question || question.title || '');
      
      // 2.1 精确匹配（hash）
      if (seenHashes.has(hash)) {
        duplicates.push({
          question,
          reason: 'exact_match',
          matchedHash: hash
        });
        continue;
      }
      
      // 2.2 相似度匹配
      if (config.enableFuzzyMatch && normalizedText.length > 10) {
        let isDuplicate = false;
        let maxSimilarity = 0;
        let matchedQuestion = null;
        
        // 限制比较数量以优化性能
        const compareTexts = seenTexts.slice(-config.maxCompareCount);
        
        for (const seen of compareTexts) {
          const similarity = similarityComparison.calculate(normalizedText, seen.text);
          
          if (similarity > maxSimilarity) {
            maxSimilarity = similarity;
            matchedQuestion = seen.question;
          }
          
          if (similarity >= config.similarityThreshold) {
            isDuplicate = true;
            break;
          }
        }
        
        if (isDuplicate) {
          duplicates.push({
            question,
            reason: 'similarity_match',
            similarity: maxSimilarity,
            matchedQuestion
          });
          continue;
        }
      }
      
      // 2.3 不是重复，添加到结果
      seenHashes.add(hash);
      seenTexts.push({ text: normalizedText, question });
      uniqueQuestions.push(question);
    }
    
    const endTime = Date.now();
    const stats = {
      total: questions.length,
      unique: uniqueQuestions.length,
      duplicate: duplicates.length,
      duplicateRate: ((duplicates.length / questions.length) * 100).toFixed(2) + '%',
      time: endTime - startTime
    };
    
    console.log('[QuestionDedup] 去重完成:', stats);
    
    return {
      success: true,
      uniqueQuestions,
      duplicates,
      stats
    };
  },
  
  /**
   * 生成题目哈希
   * @param {Object} question - 题目对象
   * @returns {string} 哈希值
   */
  generateHash(question) {
    const text = this.normalizeText(question.question || question.title || '');
    const options = Array.isArray(question.options) 
      ? question.options.map(o => this.normalizeText(o)).sort().join('|')
      : '';
    return `${text}::${options}`;
  },
  
  /**
   * 标准化文本（用于比较）
   * @param {string} text - 原始文本
   * @returns {string} 标准化后的文本
   */
  normalizeText(text) {
    if (!text) return '';
    return text
      .toLowerCase()
      .replace(/\s+/g, '') // 移除空白
      .replace(/[，。、；：""''！？【】（）]/g, '') // 移除中文标点
      .replace(/[,.;:'"!?[\]()]/g, '') // 移除英文标点
      .replace(/[a-d]\./gi, '') // 移除选项标记如 A. B.
      .trim();
  },
  
  /**
   * 合并重复题目（保留更完整的版本）
   * @param {Object} q1 - 题目1
   * @param {Object} q2 - 题目2
   * @returns {Object} 合并后的题目
   */
  mergeQuestions(q1, q2) {
    // 计算完整度分数
    const score1 = this.calculateCompleteness(q1);
    const score2 = this.calculateCompleteness(q2);
    
    const base = score1 >= score2 ? q1 : q2;
    const other = score1 >= score2 ? q2 : q1;
    
    // 合并缺失字段
    return {
      ...base,
      desc: base.desc || other.desc,
      analysis: base.analysis || other.analysis,
      category: base.category || other.category,
      tags: [...new Set([...(base.tags || []), ...(other.tags || [])])],
      source: base.source || other.source
    };
  },
  
  /**
   * 计算题目完整度
   * @param {Object} question - 题目对象
   * @returns {number} 完整度分数
   */
  calculateCompleteness(question) {
    let score = 0;
    
    if (question.question || question.title) score += 30;
    if (Array.isArray(question.options) && question.options.length >= 4) score += 20;
    if (question.answer) score += 15;
    if (question.desc || question.analysis) score += 15;
    if (question.category && question.category !== '未分类') score += 10;
    if (Array.isArray(question.tags) && question.tags.length > 0) score += 5;
    if (question.source) score += 5;
    
    return score;
  },
  
  /**
   * 生成去重报告
   * @param {Object} result - 去重结果
   * @returns {string} 报告文本
   */
  generateReport(result) {
    const { stats, duplicates } = result;
    
    let report = `=== 题目去重报告 ===\n`;
    report += `处理时间: ${stats.time}ms\n`;
    report += `总题目数: ${stats.total}\n`;
    report += `唯一题目: ${stats.unique}\n`;
    report += `重复题目: ${stats.duplicate} (${stats.duplicateRate})\n\n`;
    
    if (duplicates.length > 0) {
      report += `--- 重复详情 ---\n`;
      duplicates.slice(0, 10).forEach((dup, idx) => {
        const q = dup.question;
        const preview = (q.question || q.title || '').substring(0, 50);
        report += `${idx + 1}. [${dup.reason}] ${preview}...\n`;
        if (dup.similarity) {
          report += `   相似度: ${(dup.similarity * 100).toFixed(1)}%\n`;
        }
      });
      
      if (duplicates.length > 10) {
        report += `... 还有 ${duplicates.length - 10} 条重复记录\n`;
      }
    }
    
    return report;
  }
};

/**
 * 快捷去重函数
 * @param {Array} questions - 题目列表
 * @param {Array} existingQuestions - 已有题目
 * @returns {Array} 去重后的题目
 */
export function deduplicateQuestions(questions, existingQuestions = []) {
  const result = questionDedupWorker.deduplicate(questions, existingQuestions);
  return result.uniqueQuestions;
}

export default questionDedupWorker;
