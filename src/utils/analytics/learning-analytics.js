/**
 * 学习分析模块
 * 记录答题数据用于学习分析
 */

const _records = [];

/**
 * 记录一次答题
 * @param {Object} data - 答题数据
 * @param {string} data.questionId - 题目ID
 * @param {boolean} data.isCorrect - 是否正确
 * @param {number} data.timeSpent - 耗时(ms)
 */
export function recordAnswer(data) {
  if (!data) return;
  _records.push({
    ...data,
    timestamp: Date.now()
  });
}

/**
 * 获取所有记录
 */
export function getRecords() {
  return [..._records];
}

/**
 * 清空记录
 */
export function clearRecords() {
  _records.length = 0;
}
