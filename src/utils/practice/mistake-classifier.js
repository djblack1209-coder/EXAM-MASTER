/**
 * 错题分类器
 * 根据题目内容自动分类和标记知识点
 */

export const mistakeClassifier = {
  /**
   * 分类题目
   * @param {Object} question - 题目对象
   * @returns {Object} 分类结果
   */
  classify(question) {
    const category = question?.category || '未分类';
    return {
      tags: [],
      category,
      difficulty: 'medium',
      errorType: 'unknown',
      knowledgePoints: []
    };
  }
};
