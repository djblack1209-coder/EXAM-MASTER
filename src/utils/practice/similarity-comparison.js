/**
 * 相似度比较工具 - 检查点2.4
 * 支持多种文本相似度算法
 * 
 * 功能：
 * 1. Jaccard 相似度
 * 2. 余弦相似度
 * 3. 编辑距离相似度
 * 4. 综合相似度计算
 */

/**
 * 相似度比较器
 */
export const similarityComparison = {
  /**
   * 计算综合相似度
   * @param {string} text1 - 文本1
   * @param {string} text2 - 文本2
   * @returns {number} 相似度 0-1
   */
  calculate(text1, text2) {
    if (!text1 || !text2) return 0;
    if (text1 === text2) return 1;
    
    // 使用多种算法加权计算
    const jaccard = this.jaccardSimilarity(text1, text2);
    const cosine = this.cosineSimilarity(text1, text2);
    const levenshtein = this.levenshteinSimilarity(text1, text2);
    
    // 加权平均（Jaccard 0.3, Cosine 0.4, Levenshtein 0.3）
    const weighted = jaccard * 0.3 + cosine * 0.4 + levenshtein * 0.3;
    
    return weighted;
  },
  
  /**
   * Jaccard 相似度（基于词集合）
   * @param {string} text1 - 文本1
   * @param {string} text2 - 文本2
   * @returns {number} 相似度 0-1
   */
  jaccardSimilarity(text1, text2) {
    const set1 = new Set(this.tokenize(text1));
    const set2 = new Set(this.tokenize(text2));
    
    if (set1.size === 0 && set2.size === 0) return 1;
    if (set1.size === 0 || set2.size === 0) return 0;
    
    // 计算交集
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    // 计算并集
    const union = new Set([...set1, ...set2]);
    
    return intersection.size / union.size;
  },
  
  /**
   * 余弦相似度（基于词频向量）
   * @param {string} text1 - 文本1
   * @param {string} text2 - 文本2
   * @returns {number} 相似度 0-1
   */
  cosineSimilarity(text1, text2) {
    const tokens1 = this.tokenize(text1);
    const tokens2 = this.tokenize(text2);
    
    if (tokens1.length === 0 && tokens2.length === 0) return 1;
    if (tokens1.length === 0 || tokens2.length === 0) return 0;
    
    // 构建词频向量
    const freq1 = this.getFrequency(tokens1);
    const freq2 = this.getFrequency(tokens2);
    
    // 获取所有词
    const allWords = new Set([...Object.keys(freq1), ...Object.keys(freq2)]);
    
    // 计算点积和模长
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;
    
    for (const word of allWords) {
      const f1 = freq1[word] || 0;
      const f2 = freq2[word] || 0;
      dotProduct += f1 * f2;
      norm1 += f1 * f1;
      norm2 += f2 * f2;
    }
    
    if (norm1 === 0 || norm2 === 0) return 0;
    
    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
  },
  
  /**
   * Levenshtein 编辑距离相似度
   * @param {string} text1 - 文本1
   * @param {string} text2 - 文本2
   * @returns {number} 相似度 0-1
   */
  levenshteinSimilarity(text1, text2) {
    const distance = this.levenshteinDistance(text1, text2);
    const maxLength = Math.max(text1.length, text2.length);
    
    if (maxLength === 0) return 1;
    
    return 1 - distance / maxLength;
  },
  
  /**
   * 计算 Levenshtein 编辑距离
   * @param {string} s1 - 字符串1
   * @param {string} s2 - 字符串2
   * @returns {number} 编辑距离
   */
  levenshteinDistance(s1, s2) {
    // 优化：如果字符串太长，使用采样比较
    if (s1.length > 500 || s2.length > 500) {
      s1 = s1.substring(0, 500);
      s2 = s2.substring(0, 500);
    }
    
    const m = s1.length;
    const n = s2.length;
    
    // 创建距离矩阵
    const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
    
    // 初始化
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    
    // 填充矩阵
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (s1[i - 1] === s2[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1];
        } else {
          dp[i][j] = Math.min(
            dp[i - 1][j] + 1,     // 删除
            dp[i][j - 1] + 1,     // 插入
            dp[i - 1][j - 1] + 1  // 替换
          );
        }
      }
    }
    
    return dp[m][n];
  },
  
  /**
   * 分词（简单实现）
   * @param {string} text - 文本
   * @returns {Array} 词列表
   */
  tokenize(text) {
    if (!text) return [];
    
    // 中文按字符分割，英文按单词分割
    const tokens = [];
    
    // 提取中文字符
    const chineseChars = text.match(/[\u4e00-\u9fa5]/g) || [];
    tokens.push(...chineseChars);
    
    // 提取英文单词
    const englishWords = text.match(/[a-zA-Z]+/g) || [];
    tokens.push(...englishWords.map(w => w.toLowerCase()));
    
    // 提取数字
    const numbers = text.match(/\d+/g) || [];
    tokens.push(...numbers);
    
    return tokens;
  },
  
  /**
   * 计算词频
   * @param {Array} tokens - 词列表
   * @returns {Object} 词频对象
   */
  getFrequency(tokens) {
    const freq = {};
    for (const token of tokens) {
      freq[token] = (freq[token] || 0) + 1;
    }
    return freq;
  },
  
  /**
   * N-gram 相似度
   * @param {string} text1 - 文本1
   * @param {string} text2 - 文本2
   * @param {number} n - N值，默认2
   * @returns {number} 相似度 0-1
   */
  ngramSimilarity(text1, text2, n = 2) {
    const ngrams1 = this.getNgrams(text1, n);
    const ngrams2 = this.getNgrams(text2, n);
    
    if (ngrams1.size === 0 && ngrams2.size === 0) return 1;
    if (ngrams1.size === 0 || ngrams2.size === 0) return 0;
    
    const intersection = new Set([...ngrams1].filter(x => ngrams2.has(x)));
    const union = new Set([...ngrams1, ...ngrams2]);
    
    return intersection.size / union.size;
  },
  
  /**
   * 获取 N-gram 集合
   * @param {string} text - 文本
   * @param {number} n - N值
   * @returns {Set} N-gram 集合
   */
  getNgrams(text, n) {
    const ngrams = new Set();
    if (!text || text.length < n) return ngrams;
    
    for (let i = 0; i <= text.length - n; i++) {
      ngrams.add(text.substring(i, i + n));
    }
    
    return ngrams;
  },
  
  /**
   * 快速相似度检查（用于大量数据预筛选）
   * @param {string} text1 - 文本1
   * @param {string} text2 - 文本2
   * @param {number} threshold - 阈值
   * @returns {boolean} 是否可能相似
   */
  quickCheck(text1, text2, threshold = 0.9) {
    // 长度差异过大，直接返回不相似
    const lenRatio = Math.min(text1.length, text2.length) / Math.max(text1.length, text2.length);
    if (lenRatio < threshold * 0.8) return false;
    
    // 首尾字符检查
    if (text1.length > 10 && text2.length > 10) {
      const prefix1 = text1.substring(0, 10);
      const prefix2 = text2.substring(0, 10);
      const suffix1 = text1.substring(text1.length - 10);
      const suffix2 = text2.substring(text2.length - 10);
      
      // 如果首尾都不相似，可能不相似
      if (prefix1 !== prefix2 && suffix1 !== suffix2) {
        const prefixSim = this.jaccardSimilarity(prefix1, prefix2);
        const suffixSim = this.jaccardSimilarity(suffix1, suffix2);
        if (prefixSim < 0.5 && suffixSim < 0.5) return false;
      }
    }
    
    return true;
  }
};

/**
 * 快捷相似度计算函数
 * @param {string} text1 - 文本1
 * @param {string} text2 - 文本2
 * @returns {number} 相似度 0-1
 */
export function calculateSimilarity(text1, text2) {
  return similarityComparison.calculate(text1, text2);
}

/**
 * 批量相似度比较
 * @param {string} target - 目标文本
 * @param {Array} candidates - 候选文本列表
 * @param {number} threshold - 相似度阈值
 * @returns {Array} 相似的候选项
 */
export function findSimilar(target, candidates, threshold = 0.9) {
  return candidates
    .map((candidate, index) => ({
      index,
      text: candidate,
      similarity: similarityComparison.calculate(target, candidate)
    }))
    .filter(item => item.similarity >= threshold)
    .sort((a, b) => b.similarity - a.similarity);
}

export default similarityComparison;
