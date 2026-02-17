/**
 * ELO 匹配器 - 检查点2.5
 * 基于 ELO 评分系统的 PK 对战匹配机制
 *
 * 功能：
 * 1. ELO 评分计算
 * 2. 智能匹配（评分相近优先）
 * 3. 匹配动画控制
 * 4. 机器人对手生成
 */

// ELO 配置
import storageService from '@/services/storageService.js';
import { logger } from '@/utils/logger.js';
import config from '@/config/index.js';
const ELO_CONFIG = {
  // 初始评分
  initialRating: 1000,
  // K 因子（影响评分变化幅度）
  kFactor: 32,
  // 匹配评分差异阈值
  matchThreshold: 200,
  // 匹配超时时间（毫秒）
  matchTimeout: 30000,
  // 匹配动画时间（毫秒）
  animationDuration: 3000
};

// 存储键名
const ELO_STORAGE_KEY = 'EXAM_USER_ELO';
const MATCH_HISTORY_KEY = 'EXAM_MATCH_HISTORY';

/**
 * ELO 匹配器
 */
export const eloMatchmaker = {
  /**
   * 获取用户 ELO 评分
   * @param {string} userId - 用户ID（可选）
   * @returns {number} ELO 评分
   */
  getUserRating(userId = null) {
    try {
      const eloData = storageService.get(ELO_STORAGE_KEY, {});
      const key = userId || 'current_user';
      return eloData[key] || ELO_CONFIG.initialRating;
    } catch (error) {
      console.error('[ELOMatchmaker] 获取评分失败:', error);
      return ELO_CONFIG.initialRating;
    }
  },

  /**
   * 更新用户 ELO 评分
   * @param {number} newRating - 新评分
   * @param {string} userId - 用户ID（可选）
   */
  updateUserRating(newRating, userId = null) {
    try {
      const eloData = storageService.get(ELO_STORAGE_KEY, {});
      const key = userId || 'current_user';
      eloData[key] = Math.max(100, Math.round(newRating)); // 最低100分
      storageService.save(ELO_STORAGE_KEY, eloData);
      logger.log('[ELOMatchmaker] 评分已更新:', eloData[key]);
    } catch (error) {
      console.error('[ELOMatchmaker] 更新评分失败:', error);
    }
  },

  /**
   * 计算预期胜率
   * @param {number} ratingA - 玩家A评分
   * @param {number} ratingB - 玩家B评分
   * @returns {number} 玩家A的预期胜率 0-1
   */
  calculateExpectedScore(ratingA, ratingB) {
    return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
  },

  /**
   * 计算新评分
   * @param {number} currentRating - 当前评分
   * @param {number} opponentRating - 对手评分
   * @param {number} actualScore - 实际得分（1=胜, 0.5=平, 0=负）
   * @returns {number} 新评分
   */
  calculateNewRating(currentRating, opponentRating, actualScore) {
    const expectedScore = this.calculateExpectedScore(currentRating, opponentRating);
    const newRating = currentRating + ELO_CONFIG.kFactor * (actualScore - expectedScore);
    return Math.round(newRating);
  },

  /**
   * 开始匹配
   * @param {Object} options - 匹配选项
   * @returns {Promise<Object>} 匹配结果
   */
  async startMatching(options = {}) {
    const {
      onProgress,
      onFound,
      timeout = ELO_CONFIG.matchTimeout
    } = options;

    const userRating = this.getUserRating();
    const startTime = Date.now();

    logger.log('[ELOMatchmaker] 开始匹配，用户评分:', userRating);

    return new Promise((resolve, _reject) => {
      let currentPhase = 0;
      const phases = [
        { text: '正在寻找实力相当的研友...', duration: 1000 },
        { text: '扩大搜索范围...', duration: 1500 },
        { text: '匹配评分相近的对手...', duration: 1500 },
        { text: '即将匹配成功...', duration: 1000 }
      ];

      // 模拟匹配进度
      const progressInterval = setInterval(() => {
        if (currentPhase < phases.length) {
          const phase = phases[currentPhase];
          if (onProgress) {
            onProgress({
              phase: currentPhase,
              text: phase.text,
              progress: ((currentPhase + 1) / phases.length) * 100
            });
          }
          currentPhase++;
        }
      }, 1000);

      // 匹配超时处理
      const timeoutTimer = setTimeout(() => {
        clearInterval(progressInterval);

        // 超时后匹配机器人
        const bot = this.generateBot(userRating);
        logger.log('[ELOMatchmaker] 匹配超时，分配机器人对手:', bot.name);

        if (onFound) {
          onFound(bot);
        }

        resolve({
          success: true,
          opponent: bot,
          isBot: true,
          matchTime: Date.now() - startTime
        });
      }, timeout);

      // 模拟真实匹配（随机时间后找到对手）
      const matchDelay = Math.random() * (timeout - 2000) + 2000;
      setTimeout(() => {
        clearInterval(progressInterval);
        clearTimeout(timeoutTimer);

        // 生成匹配的对手
        const opponent = this.generateBot(userRating);

        logger.log('[ELOMatchmaker] 匹配成功:', {
          opponent: opponent.name,
          rating: opponent.rating,
          matchTime: Date.now() - startTime
        });

        if (onFound) {
          onFound(opponent);
        }

        resolve({
          success: true,
          opponent,
          isBot: true, // 当前版本都是机器人
          matchTime: Date.now() - startTime
        });
      }, matchDelay);
    });
  },

  /**
   * 生成机器人对手
   * @param {number} userRating - 用户评分
   * @returns {Object} 机器人对手信息
   */
  generateBot(userRating) {
    // 机器人名字库
    const botNames = [
      '考研一哥', '上岸锦鲤', '学霸张', '考研小白', '满分狂魔',
      '夜猫子', '题海战士', '知识库', '逻辑王', '记忆大师',
      '刷题达人', '考研先锋', '学习机器', '知识猎手', '考研战神'
    ];

    // 根据用户评分生成相近评分的机器人
    const ratingOffset = (Math.random() - 0.5) * ELO_CONFIG.matchThreshold * 2;
    const botRating = Math.round(userRating + ratingOffset);

    // 根据评分确定等级
    let level;
    if (botRating >= 1500) level = 'Lv.95';
    else if (botRating >= 1300) level = 'Lv.85';
    else if (botRating >= 1100) level = 'Lv.75';
    else if (botRating >= 900) level = 'Lv.65';
    else level = 'Lv.55';

    // 随机选择名字
    const name = botNames[Math.floor(Math.random() * botNames.length)];

    // 生成头像（使用 DiceBear API）
    const avatarSeed = name + Date.now();
    const avatar = `${config.externalCdn.dicebearBaseUrl}/avataaars/svg?seed=${encodeURIComponent(avatarSeed)}`;

    // 根据评分差异设置机器人难度
    const difficulty = this.calculateBotDifficulty(userRating, botRating);

    return {
      id: `bot_${Date.now()}`,
      name,
      avatar,
      level,
      rating: botRating,
      isBot: true,
      difficulty,
      // 机器人行为参数
      behavior: {
        // 答题速度（秒）
        answerSpeed: { min: 3, max: 15 },
        // 正确率
        accuracy: difficulty.accuracy,
        // 是否会抢答
        canRush: difficulty.canRush
      }
    };
  },

  /**
   * 计算机器人难度
   * @param {number} userRating - 用户评分
   * @param {number} botRating - 机器人评分
   * @returns {Object} 难度参数
   */
  calculateBotDifficulty(userRating, botRating) {
    const ratingDiff = botRating - userRating;

    // 根据评分差异调整难度
    if (ratingDiff > 100) {
      // 机器人评分更高，更难
      return { accuracy: 0.8, canRush: true, level: 'hard' };
    } else if (ratingDiff < -100) {
      // 机器人评分更低，更简单
      return { accuracy: 0.5, canRush: false, level: 'easy' };
    } else {
      // 评分相近，中等难度
      return { accuracy: 0.65, canRush: Math.random() > 0.5, level: 'medium' };
    }
  },

  /**
   * 处理对战结果
   * @param {Object} result - 对战结果
   * @returns {Object} 评分变化
   */
  processMatchResult(result) {
    const { userScore, opponentScore, opponent } = result;

    const userRating = this.getUserRating();
    const opponentRating = opponent.rating || ELO_CONFIG.initialRating;

    // 计算实际得分
    let actualScore;
    if (userScore > opponentScore) {
      actualScore = 1; // 胜利
    } else if (userScore < opponentScore) {
      actualScore = 0; // 失败
    } else {
      actualScore = 0.5; // 平局
    }

    // 计算新评分
    const newRating = this.calculateNewRating(userRating, opponentRating, actualScore);
    const ratingChange = newRating - userRating;

    // 更新评分
    this.updateUserRating(newRating);

    // 记录对战历史
    this.recordMatchHistory({
      opponent,
      userScore,
      opponentScore,
      ratingBefore: userRating,
      ratingAfter: newRating,
      ratingChange,
      timestamp: Date.now()
    });

    logger.log('[ELOMatchmaker] 对战结果处理完成:', {
      result: actualScore === 1 ? '胜利' : actualScore === 0 ? '失败' : '平局',
      ratingBefore: userRating,
      ratingAfter: newRating,
      change: ratingChange > 0 ? `+${ratingChange}` : ratingChange
    });

    return {
      ratingBefore: userRating,
      ratingAfter: newRating,
      ratingChange,
      isWin: actualScore === 1,
      isDraw: actualScore === 0.5
    };
  },

  /**
   * 记录对战历史
   * @param {Object} record - 对战记录
   */
  recordMatchHistory(record) {
    try {
      const history = storageService.get(MATCH_HISTORY_KEY, []);
      history.unshift(record);
      // 只保留最近50条记录
      if (history.length > 50) {
        history.length = 50;
      }
      storageService.save(MATCH_HISTORY_KEY, history);
    } catch (error) {
      console.error('[ELOMatchmaker] 记录历史失败:', error);
    }
  },

  /**
   * 获取对战历史
   * @param {number} limit - 数量限制
   * @returns {Array} 对战历史
   */
  getMatchHistory(limit = 10) {
    try {
      const history = storageService.get(MATCH_HISTORY_KEY, []);
      return history.slice(0, limit);
    } catch (error) {
      console.error('[ELOMatchmaker] 获取历史失败:', error);
      return [];
    }
  },

  /**
   * 获取用户统计
   * @returns {Object} 统计信息
   */
  getUserStats() {
    const history = this.getMatchHistory(50);
    const rating = this.getUserRating();

    const wins = history.filter((h) => h.ratingChange > 0).length;
    const losses = history.filter((h) => h.ratingChange < 0).length;
    const draws = history.filter((h) => h.ratingChange === 0).length;

    return {
      rating,
      totalMatches: history.length,
      wins,
      losses,
      draws,
      winRate: history.length > 0 ? ((wins / history.length) * 100).toFixed(1) + '%' : '0%',
      recentForm: history.slice(0, 5).map((h) => h.ratingChange > 0 ? 'W' : h.ratingChange < 0 ? 'L' : 'D').join('')
    };
  },

  /**
   * 获取段位信息
   * @param {number} rating - 评分（可选，默认当前用户）
   * @returns {Object} 段位信息
   */
  getRankInfo(rating = null) {
    const r = rating || this.getUserRating();

    const ranks = [
      { name: '学渣', min: 0, max: 600, icon: '🥉', color: '#9e9e9e' },
      { name: '学弱', min: 600, max: 800, icon: '🥈', color: '#78909c' },
      { name: '学民', min: 800, max: 1000, icon: '🥇', color: '#4caf50' },
      { name: '学霸', min: 1000, max: 1200, icon: '⭐', color: '#2196f3' },
      { name: '学神', min: 1200, max: 1400, icon: '🌟', color: '#9c27b0' },
      { name: '学圣', min: 1400, max: 1600, icon: '💫', color: '#ff9800' },
      { name: '学仙', min: 1600, max: 1800, icon: '✨', color: '#f44336' },
      { name: '学帝', min: 1800, max: Infinity, icon: '👑', color: '#ffd700' }
    ];

    const rank = ranks.find((rank) => r >= rank.min && r < rank.max) || ranks[0];
    const nextRank = ranks.find((rank) => rank.min > r);

    return {
      ...rank,
      rating: r,
      progress: nextRank ? ((r - rank.min) / (nextRank.min - rank.min) * 100).toFixed(1) : 100,
      pointsToNext: nextRank ? nextRank.min - r : 0
    };
  }
};

export default eloMatchmaker;
