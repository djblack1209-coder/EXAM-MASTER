/**
 * 学习数据分析模块 - 提供全面的学习统计和可视化数据
 *
 * 核心功能：
 * 1. 学习热力图数据 - 每日学习记录
 * 2. 正确率趋势分析 - 历史正确率变化
 * 3. 知识点掌握度分析 - 各知识点的掌握情况
 * 4. 学习时间分析 - 学习时长和效率
 * 5. 成就系统 - 激励学习
 * 6. 多维度学习报告 - 按时间、科目、知识点等维度分析
 * 7. 进步趋势追踪 - 长期学习进步分析
 * 8. 学习效率分析 - 识别高效学习时段
 * 9. 同水平对比 - 与同等目标用户对比
 * 10. 预测分数 - 基于学习数据预测考试分数
 */

import { getWeakKnowledgePoints, getLearningStats } from '../learning/adaptive-learning-engine.js';
import { logger } from '@/utils/logger.js';

const STORAGE_KEYS = {
  DAILY_STATS: 'learning_daily_stats',
  STREAK_DATA: 'learning_streak_data',
  ACHIEVEMENT_DATA: 'learning_achievements'
};

const ACHIEVEMENTS = {
  FIRST_QUESTION: { id: 'first_question', name: '初出茅庐', description: '完成第一道题目', icon: '🎯' },
  TEN_QUESTIONS: { id: 'ten_questions', name: '小试牛刀', description: '累计完成10道题目', icon: '📝' },
  HUNDRED_QUESTIONS: { id: 'hundred_questions', name: '勤学苦练', description: '累计完成100道题目', icon: '📚' },
  STREAK_3: { id: 'streak_3', name: '三天打鱼', description: '连续学习3天', icon: '🔥' },
  STREAK_7: { id: 'streak_7', name: '一周坚持', description: '连续学习7天', icon: '💪' },
  STREAK_30: { id: 'streak_30', name: '月度学霸', description: '连续学习30天', icon: '👑' },
  ACCURACY_80: { id: 'accuracy_80', name: '准确达人', description: '单日正确率达到80%', icon: '✨' }
};

class LearningAnalytics {
  constructor() {
    this.dailyStats = {};
    this.streakData = { currentStreak: 0, longestStreak: 0, lastStudyDate: null };
    this.achievements = [];
    this.isInitialized = false;
  }

  init() {
    if (this.isInitialized) return;
    this._loadDailyStats();
    this._loadStreakData();
    this._loadAchievements();
    this.isInitialized = true;

    // ✅ F013: 异步从后端拉取成就并合并（不阻塞本地使用）
    this._fetchAndMergeAchievementsFromServer();
  }

  recordAnswer(data) {
    this.init();
    const today = this._getDateString(new Date());
    const hour = new Date().getHours();

    if (!this.dailyStats[today]) {
      this.dailyStats[today] = {
        date: today,
        totalQuestions: 0,
        correctQuestions: 0,
        totalTime: 0,
        categories: {},
        hourlyDistribution: {}
      };
    }

    const todayStats = this.dailyStats[today];
    todayStats.totalQuestions++;
    if (data.isCorrect) todayStats.correctQuestions++;
    todayStats.totalTime += data.timeSpent || 0;

    const category = data.category || '未分类';
    if (!todayStats.categories[category]) {
      todayStats.categories[category] = { total: 0, correct: 0 };
    }
    todayStats.categories[category].total++;
    if (data.isCorrect) todayStats.categories[category].correct++;

    if (!todayStats.hourlyDistribution[hour]) {
      todayStats.hourlyDistribution[hour] = 0;
    }
    todayStats.hourlyDistribution[hour]++;

    this._updateStreak(today);
    this._checkAchievements(todayStats, hour);
    this._saveDailyStats();
    this._saveStreakData();
  }

  getHeatmapData(days = 365) {
    this.init();
    const result = [];
    const today = new Date();

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = this._getDateString(date);
      const stats = this.dailyStats[dateStr];
      result.push({
        date: dateStr,
        count: stats ? stats.totalQuestions : 0,
        level: this._getHeatmapLevel(stats ? stats.totalQuestions : 0)
      });
    }
    return result;
  }

  getAccuracyTrend(days = 30) {
    this.init();
    const result = [];
    const today = new Date();

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = this._getDateString(date);
      const stats = this.dailyStats[dateStr];
      const accuracy = stats && stats.totalQuestions > 0
        ? (stats.correctQuestions / stats.totalQuestions * 100).toFixed(1)
        : null;
      result.push({
        date: dateStr,
        accuracy: accuracy ? parseFloat(accuracy) : null,
        totalQuestions: stats ? stats.totalQuestions : 0
      });
    }
    return result;
  }

  getKnowledgePointAnalysis() {
    this.init();
    const categoryStats = {};

    for (const dateStr of Object.keys(this.dailyStats)) {
      const stats = this.dailyStats[dateStr];
      for (const [category, data] of Object.entries(stats.categories || {})) {
        if (!categoryStats[category]) {
          categoryStats[category] = { total: 0, correct: 0 };
        }
        categoryStats[category].total += data.total;
        categoryStats[category].correct += data.correct;
      }
    }

    const analysis = Object.entries(categoryStats).map(([category, data]) => {
      const accuracy = data.total > 0 ? (data.correct / data.total * 100) : 0;
      return {
        category,
        totalQuestions: data.total,
        correctQuestions: data.correct,
        accuracy: accuracy.toFixed(1),
        masteryLevel: accuracy >= 80 ? 'master' : accuracy >= 60 ? 'proficient' : 'learning'
      };
    });

    analysis.sort((a, b) => parseFloat(a.accuracy) - parseFloat(b.accuracy));

    return {
      categories: analysis,
      weakPoints: analysis.filter((a) => parseFloat(a.accuracy) < 60),
      strongPoints: analysis.filter((a) => parseFloat(a.accuracy) >= 80)
    };
  }

  getStreakData() {
    this.init();
    return {
      currentStreak: this.streakData.currentStreak,
      longestStreak: this.streakData.longestStreak,
      lastStudyDate: this.streakData.lastStudyDate,
      isStudiedToday: this.streakData.lastStudyDate === this._getDateString(new Date())
    };
  }

  getAchievements() {
    this.init();
    const allAchievements = Object.values(ACHIEVEMENTS).map((a) => ({
      ...a,
      unlocked: this.achievements.includes(a.id)
    }));
    return {
      unlocked: allAchievements.filter((a) => a.unlocked),
      locked: allAchievements.filter((a) => !a.unlocked),
      total: allAchievements.length
    };
  }

  getComprehensiveReport() {
    this.init();
    const stats = getLearningStats();
    const weakPoints = getWeakKnowledgePoints();
    const heatmap = this.getHeatmapData(30);
    const accuracyTrend = this.getAccuracyTrend(14);
    const knowledgeAnalysis = this.getKnowledgePointAnalysis();
    const streakData = this.getStreakData();
    const achievements = this.getAchievements();

    const learningScore = this._calculateLearningScore(stats, streakData, knowledgeAnalysis);

    return {
      overview: {
        learningScore,
        scoreLevel: this._getScoreLevel(learningScore),
        totalQuestions: stats.totalQuestions,
        overallAccuracy: stats.overallAccuracy,
        currentStreak: streakData.currentStreak
      },
      today: {
        questions: stats.todayQuestions,
        accuracy: stats.todayAccuracy,
        isStudied: streakData.isStudiedToday
      },
      trends: { heatmap, accuracyTrend },
      knowledge: knowledgeAnalysis,
      streak: streakData,
      achievements,
      recommendations: this._generateRecommendations(stats, weakPoints, streakData),
      generatedAt: Date.now()
    };
  }

  _getDateString(date) {
    return date.toISOString().split('T')[0];
  }

  _getHeatmapLevel(count) {
    if (count === 0) return 0;
    if (count < 5) return 1;
    if (count < 15) return 2;
    if (count < 30) return 3;
    return 4;
  }

  _updateStreak(today) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = this._getDateString(yesterday);

    if (this.streakData.lastStudyDate === today) return;

    if (this.streakData.lastStudyDate === yesterdayStr) {
      this.streakData.currentStreak++;
    } else {
      this.streakData.currentStreak = 1;
    }

    if (this.streakData.currentStreak > this.streakData.longestStreak) {
      this.streakData.longestStreak = this.streakData.currentStreak;
    }
    this.streakData.lastStudyDate = today;
  }

  _checkAchievements(todayStats, _hour) {
    const newAchievements = [];
    const totalQuestions = Object.values(this.dailyStats).reduce((sum, s) => sum + s.totalQuestions, 0);

    if (totalQuestions >= 1 && !this.achievements.includes('first_question')) {
      newAchievements.push('first_question');
    }
    if (totalQuestions >= 10 && !this.achievements.includes('ten_questions')) {
      newAchievements.push('ten_questions');
    }
    if (totalQuestions >= 100 && !this.achievements.includes('hundred_questions')) {
      newAchievements.push('hundred_questions');
    }
    if (this.streakData.currentStreak >= 3 && !this.achievements.includes('streak_3')) {
      newAchievements.push('streak_3');
    }
    if (this.streakData.currentStreak >= 7 && !this.achievements.includes('streak_7')) {
      newAchievements.push('streak_7');
    }
    if (this.streakData.currentStreak >= 30 && !this.achievements.includes('streak_30')) {
      newAchievements.push('streak_30');
    }

    if (todayStats.totalQuestions >= 5) {
      const todayAccuracy = todayStats.correctQuestions / todayStats.totalQuestions * 100;
      if (todayAccuracy >= 80 && !this.achievements.includes('accuracy_80')) {
        newAchievements.push('accuracy_80');
      }
    }

    if (newAchievements.length > 0) {
      this.achievements.push(...newAchievements);
      this._saveAchievements();
      // ✅ F013: 同步新解锁的成就到后端
      this._syncAchievementsToServer(newAchievements);
      for (const id of newAchievements) {
        const achievement = Object.values(ACHIEVEMENTS).find((a) => a.id === id);
        if (achievement) {
          uni.showToast({ title: '解锁成就：' + achievement.name, icon: 'none', duration: 3000 });
        }
      }
    }
  }

  _calculateLearningScore(stats, streakData, knowledgeAnalysis) {
    let score = 0;
    const accuracy = parseFloat(stats.overallAccuracy) || 0;
    score += Math.min(40, accuracy * 0.4);
    score += Math.min(20, streakData.currentStreak * 2);
    const strongRatio = knowledgeAnalysis.strongPoints.length / Math.max(1, knowledgeAnalysis.categories.length);
    score += strongRatio * 20;
    score += Math.min(20, (stats.totalQuestions || 0) / 50);
    return Math.round(score);
  }

  _getScoreLevel(score) {
    if (score >= 90) return { level: 'S', name: '学霸', color: '#FFD700' };
    if (score >= 80) return { level: 'A', name: '优秀', color: '#4CAF50' };
    if (score >= 70) return { level: 'B', name: '良好', color: '#2196F3' };
    if (score >= 60) return { level: 'C', name: '及格', color: '#FF9800' };
    return { level: 'D', name: '加油', color: '#F44336' };
  }

  _generateRecommendations(stats, weakPoints, streakData) {
    const recommendations = [];
    const accuracy = parseFloat(stats.overallAccuracy) || 0;

    if (accuracy < 60) {
      recommendations.push({ type: 'accuracy', priority: 'high', title: '提升正确率', content: '建议从基础题目开始练习' });
    }
    if (weakPoints.length > 0) {
      recommendations.push({ type: 'weak_point', priority: 'high', title: '强化薄弱知识点', content: '「' + weakPoints[0].category + '」需要重点练习' });
    }
    if (!streakData.isStudiedToday) {
      recommendations.push({ type: 'streak', priority: 'medium', title: '保持学习连续性', content: '今天还没学习哦' });
    }
    return recommendations;
  }

  _loadDailyStats() {
    try { this.dailyStats = storageService.get(STORAGE_KEYS.DAILY_STATS, {}); } catch (_e) { this.dailyStats = {}; }
  }

  _saveDailyStats() {
    try {
      const dates = Object.keys(this.dailyStats).sort();
      if (dates.length > 365) {
        for (const date of dates.slice(0, dates.length - 365)) delete this.dailyStats[date];
      }
      storageService.save(STORAGE_KEYS.DAILY_STATS, this.dailyStats);
    } catch (e) { console.error('[LearningAnalytics] 保存失败:', e); }
  }

  _loadStreakData() {
    try {
      this.streakData = storageService.get(
        STORAGE_KEYS.STREAK_DATA,
        { currentStreak: 0, longestStreak: 0, lastStudyDate: null }
      );
    } catch (_e) {
      this.streakData = { currentStreak: 0, longestStreak: 0, lastStudyDate: null };
    }
  }

  _saveStreakData() {
    try { storageService.save(STORAGE_KEYS.STREAK_DATA, this.streakData); } catch (e) { console.error('[LearningAnalytics] 保存连续学习数据失败:', e); }
  }

  _loadAchievements() {
    try {
      this.achievements = storageService.get(STORAGE_KEYS.ACHIEVEMENT_DATA, []);
    } catch (_e) {
      this.achievements = [];
    }
  }

  _saveAchievements() {
    try { storageService.save(STORAGE_KEYS.ACHIEVEMENT_DATA, this.achievements); } catch (e) { console.error('[LearningAnalytics] 保存成就数据失败:', e); }
  }

  /**
   * ✅ F013: 从后端拉取成就并与本地合并，同时触发后端自动检测
   * 策略：后端已解锁而本地没有的 → 添加到本地
   */
  async _fetchAndMergeAchievementsFromServer() {
    try {
      const userId = storageService.get('EXAM_USER_ID', null);
      if (!userId) return;

      const { lafService } = await import('@/services/lafService.js');
      if (!lafService) return;

      // 1. 先触发后端 check（根据用户数据自动解锁满足条件的成就）
      try {
        const checkRes = await lafService.checkAchievements();
        const newlyUnlocked = checkRes?.data?.newlyUnlocked || [];
        if (newlyUnlocked.length > 0) {
          for (const ach of newlyUnlocked) {
            if (ach.id && !this.achievements.includes(ach.id)) {
              this.achievements.push(ach.id);
            }
          }
          this._saveAchievements();
          // 显示第一个新解锁的成就
          const first = newlyUnlocked[0];
          uni.showToast({
            title: `解锁成就：${first.name || first.id}`,
            icon: 'none',
            duration: 3000
          });
          logger.log(
            `[LearningAnalytics] 后端自动检测解锁了 ${newlyUnlocked.length} 个成就`
          );
        }
      } catch (e) {
        console.warn('[LearningAnalytics] 后端成就检测失败:', e.message);
      }

      // 2. 拉取后端已解锁成就列表，合并到本地
      try {
        const res = await lafService.getAllAchievements();
        const allAch = res?.data?.achievements || [];
        const serverUnlocked = allAch
          .filter((a) => a.unlocked)
          .map((a) => a.id);

        let changed = false;
        for (const id of serverUnlocked) {
          if (id && !this.achievements.includes(id)) {
            this.achievements.push(id);
            changed = true;
          }
        }
        if (changed) {
          this._saveAchievements();
          logger.log(
            `[LearningAnalytics] 从后端合并成就，当前共 ${this.achievements.length} 个`
          );
        }
      } catch (e) {
        console.warn('[LearningAnalytics] 拉取后端成就列表失败:', e.message);
      }
    } catch (e) {
      console.warn('[LearningAnalytics] 成就后端拉取失败:', e.message);
    }
  }

  /**
   * ✅ F013: 同步成就到后端
   * 异步执行，不阻塞本地操作
   * @param {Array} newAchievementIds - 新解锁的成就ID列表
   */
  async _syncAchievementsToServer(newAchievementIds) {
    try {
      // ✅ B021: storageService.get('EXAM_USER_ID') 已自动处理加密/明文回退
      const userId = storageService.get('EXAM_USER_ID', null);
      if (!userId) return; // 未登录不同步

      const { lafService } = await import('@/services/lafService.js');
      if (!lafService) return;

      // 逐个解锁成就到后端
      for (const achievementId of newAchievementIds) {
        try {
          await lafService.unlockAchievement(achievementId);
        } catch (e) {
          console.warn(`[LearningAnalytics] 同步成就 ${achievementId} 失败:`, e.message);
        }
      }

      logger.log(`[LearningAnalytics] 已同步 ${newAchievementIds.length} 个成就到后端`);
    } catch (e) {
      // 同步失败不影响本地使用
      console.warn('[LearningAnalytics] 成就后端同步失败:', e.message);
    }
  }

  /**
   * 生成多维度学习报告
   * @param {Object} options - 报告选项
   * @returns {Object} 多维度学习报告
   */
  getMultiDimensionReport(options = {}) {
    this.init();

    const {
      timeRange = 'month', // day, week, month, year
      dimensions = ['time', 'category', 'knowledge'],
      includePredictions = false
    } = options;

    const report = {
      timeRange,
      generatedAt: Date.now(),
      dimensions: {},
      overview: this.getComprehensiveReport().overview
    };

    // 时间维度分析
    if (dimensions.includes('time')) {
      report.dimensions.time = this._getTimeDimensionAnalysis(timeRange);
    }

    // 科目维度分析
    if (dimensions.includes('category')) {
      report.dimensions.category = this.getKnowledgePointAnalysis();
    }

    // 知识点维度分析
    if (dimensions.includes('knowledge')) {
      report.dimensions.knowledge = this._getKnowledgeDimensionAnalysis();
    }

    // 效率维度分析
    if (dimensions.includes('efficiency')) {
      report.dimensions.efficiency = this.getLearningEfficiency();
    }

    // 预测分析
    if (includePredictions) {
      report.predictions = {
        score: this.predictScore(),
        progress: this.getProgressTrend(30)
      };
    }

    return report;
  }

  /**
   * 获取学习效率分析
   * @returns {Object} 学习效率分析
   */
  getLearningEfficiency() {
    this.init();

    const hourlyEfficiency = {};
    let totalQuestions = 0;
    let totalTime = 0;

    // 分析每个小时的学习效率
    for (const dateStr in this.dailyStats) {
      const stats = this.dailyStats[dateStr];
      totalQuestions += stats.totalQuestions;
      totalTime += stats.totalTime;

      for (const hourStr in stats.hourlyDistribution) {
        const hour = parseInt(hourStr);
        if (!hourlyEfficiency[hour]) {
          hourlyEfficiency[hour] = {
            questions: 0,
            time: 0,
            sessions: 0
          };
        }
        hourlyEfficiency[hour].questions += stats.hourlyDistribution[hour];
        hourlyEfficiency[hour].sessions += 1;
      }
    }

    // 计算每个小时的效率
    const efficiencyByHour = Object.entries(hourlyEfficiency).map(([hour, data]) => {
      const efficiency = data.sessions > 0 ? (data.questions / data.sessions).toFixed(1) : 0;
      return {
        hour: parseInt(hour),
        questions: data.questions,
        sessions: data.sessions,
        efficiency: parseFloat(efficiency),
        isPeak: parseFloat(efficiency) > 3 // 每小时超过3题视为高峰期
      };
    });

    // 找出最高效的时段
    efficiencyByHour.sort((a, b) => b.efficiency - a.efficiency);
    const peakHours = efficiencyByHour.filter((e) => e.isPeak).slice(0, 3);

    return {
      overall: {
        averageEfficiency: totalTime > 0 ? (totalQuestions / (totalTime / 60)).toFixed(2) : 0, // 每小时题目数
        totalQuestions,
        totalTime: totalTime / 60 // 转换为分钟
      },
      hourlyEfficiency: efficiencyByHour,
      peakHours,
      recommendedStudyTime: peakHours.map((h) => `${h.hour}:00-${h.hour + 1}:00`)
    };
  }

  /**
   * 获取进步趋势分析
   * @param {number} days - 分析天数
   * @returns {Object} 进步趋势分析
   */
  getProgressTrend(days = 30) {
    this.init();

    const trendData = [];
    const today = new Date();

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = this._getDateString(date);
      const stats = this.dailyStats[dateStr];

      if (stats && stats.totalQuestions > 0) {
        const accuracy = (stats.correctQuestions / stats.totalQuestions * 100).toFixed(1);
        trendData.push({
          date: dateStr,
          accuracy: parseFloat(accuracy),
          questions: stats.totalQuestions,
          time: stats.totalTime / 60 // 转换为分钟
        });
      }
    }

    // 计算趋势
    const trend = this._calculateTrend(trendData);

    return {
      data: trendData,
      trend: trend,
      improvementRate: trend.improvementRate,
      averageAccuracy: trend.averageAccuracy,
      bestDay: trend.bestDay,
      worstDay: trend.worstDay
    };
  }

  /**
   * 获取同水平对比报告
   * @returns {Object} 同水平对比报告
   */
  getPeerComparison() {
    this.init();

    // 获取当前用户数据
    const userReport = this.getComprehensiveReport();

    // 生成估算的同水平用户数据分布
    // ⚠️ 当前为本地统计估算，非真实用户数据
    // TODO: 后续应从服务器获取真实的匿名同水平用户统计数据
    const peerData = this._generatePeerData(userReport.overview);

    return {
      _isEstimated: true, // 标记：当前为本地估算，非真实同伴数据
      user: {
        score: userReport.overview.learningScore,
        accuracy: parseFloat(userReport.overview.overallAccuracy),
        streak: userReport.streak.currentStreak,
        questions: userReport.overview.totalQuestions
      },
      peers: peerData,
      comparison: {
        scorePercentile: this._calculatePercentile(
          userReport.overview.learningScore, peerData.map((p) => p.score)
        ),
        accuracyPercentile: this._calculatePercentile(
          parseFloat(userReport.overview.overallAccuracy), peerData.map((p) => p.accuracy)
        ),
        streakPercentile: this._calculatePercentile(
          userReport.streak.currentStreak, peerData.map((p) => p.streak)
        ),
        questionsPercentile: this._calculatePercentile(
          userReport.overview.totalQuestions, peerData.map((p) => p.questions)
        )
      },
      insights: this._generatePeerInsights(userReport.overview, peerData)
    };
  }

  /**
   * 预测考试分数
   * @returns {Object} 预测分数
   */
  predictScore() {
    this.init();

    const report = this.getComprehensiveReport();
    const trend = this.getProgressTrend(30);
    const efficiency = this.getLearningEfficiency();

    // 基于多种因素估算分数趋势
    // ⚠️ 仅为参考性估算，非专业预测模型
    // TODO: 后续应接入后端机器学习模型进行更准确的预测
    const baseScore = parseFloat(report.overview.overallAccuracy) || 0;
    const trendFactor = trend.improvementRate > 0 ? 1 + (trend.improvementRate / 100) : 0.95;
    const efficiencyFactor = parseFloat(efficiency.overall.averageEfficiency) > 2 ? 1.05 : 0.98;
    const streakFactor = report.streak.currentStreak > 7 ? 1.03 : 0.99;

    let predictedScore = baseScore * trendFactor * efficiencyFactor * streakFactor;
    predictedScore = Math.min(100, Math.max(0, predictedScore));

    return {
      _isEstimated: true, // 标记：仅为参考性估算
      predictedScore: predictedScore.toFixed(1),
      confidence: Math.min(95, Math.max(50, 70 + (report.overview.totalQuestions / 100))),
      factors: {
        baseScore: baseScore.toFixed(1),
        trendFactor: trendFactor.toFixed(2),
        efficiencyFactor: efficiencyFactor.toFixed(2),
        streakFactor: streakFactor.toFixed(2)
      },
      recommendations: this._generateScoreRecommendations(predictedScore, report)
    };
  }

  // ==================== 私有辅助方法 ====================

  /**
   * 获取时间维度分析
   * @param {string} timeRange - 时间范围
   * @returns {Object} 时间维度分析
   */
  _getTimeDimensionAnalysis(timeRange) {
    const now = new Date();
    let startDate;

    switch (timeRange) {
      case 'day':
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 1);
        break;
      case 'week':
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 7);
        break;
      case 'month':
        startDate = new Date(now);
        startDate.setMonth(startDate.getMonth() - 1);
        break;
      case 'year':
        startDate = new Date(now);
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
      default:
        startDate = new Date(now);
        startDate.setMonth(startDate.getMonth() - 1);
    }

    const data = [];
    const current = new Date(startDate);

    while (current <= now) {
      const dateStr = this._getDateString(current);
      const stats = this.dailyStats[dateStr];
      data.push({
        date: dateStr,
        questions: stats ? stats.totalQuestions : 0,
        accuracy: stats && stats.totalQuestions > 0
          ? (stats.correctQuestions / stats.totalQuestions * 100).toFixed(1) : 0,
        time: stats ? stats.totalTime / 60 : 0 // 转换为分钟
      });
      current.setDate(current.getDate() + 1);
    }

    return {
      data,
      summary: {
        totalQuestions: data.reduce((sum, d) => sum + d.questions, 0),
        averageAccuracy: data.length > 0
          ? (data.reduce((sum, d) => sum + parseFloat(d.accuracy), 0) / data.length).toFixed(1) : 0,
        totalTime: data.reduce((sum, d) => sum + d.time, 0)
      }
    };
  }

  /**
   * 获取知识点维度分析
   * @returns {Object} 知识点维度分析
   */
  _getKnowledgeDimensionAnalysis() {
    const analysis = this.getKnowledgePointAnalysis();

    // 按掌握度分组
    const masteryGroups = {
      master: analysis.categories.filter((c) => c.masteryLevel === 'master'),
      proficient: analysis.categories.filter((c) => c.masteryLevel === 'proficient'),
      learning: analysis.categories.filter((c) => c.masteryLevel === 'learning')
    };

    return {
      ...analysis,
      masteryDistribution: {
        master: masteryGroups.master.length,
        proficient: masteryGroups.proficient.length,
        learning: masteryGroups.learning.length,
        total: analysis.categories.length
      },
      recommendedFocus: analysis.weakPoints.slice(0, 3).map((w) => w.category)
    };
  }

  /**
   * 计算趋势
   * @param {Array} data - 趋势数据
   * @returns {Object} 趋势分析
   */
  _calculateTrend(data) {
    if (data.length === 0) {
      return {
        improvementRate: 0,
        averageAccuracy: 0,
        bestDay: null,
        worstDay: null
      };
    }

    const accuracies = data.map((d) => d.accuracy);
    const averageAccuracy = accuracies.reduce((sum, acc) => sum + acc, 0) / accuracies.length;

    // 计算改进率
    let improvementRate = 0;
    if (accuracies.length > 1) {
      const firstHalf = accuracies.slice(0, Math.floor(accuracies.length / 2));
      const secondHalf = accuracies.slice(Math.floor(accuracies.length / 2));
      const firstAvg = firstHalf.reduce((sum, acc) => sum + acc, 0) / firstHalf.length;
      const secondAvg = secondHalf.reduce((sum, acc) => sum + acc, 0) / secondHalf.length;
      improvementRate = firstAvg > 0 ? ((secondAvg - firstAvg) / firstAvg * 100) : 0;
    }

    // 找出最佳和最差的一天
    let bestDay = data[0];
    let worstDay = data[0];

    for (const day of data) {
      if (day.accuracy > bestDay.accuracy) bestDay = day;
      if (day.accuracy < worstDay.accuracy) worstDay = day;
    }

    return {
      improvementRate: improvementRate.toFixed(2),
      averageAccuracy: averageAccuracy.toFixed(2),
      bestDay,
      worstDay
    };
  }

  /**
   * 生成模拟的同水平用户数据
   * ⚠️ 注意：当前为本地估算，非真实同伴数据
   * TODO: 后续应从服务器获取真实的匿名同水平用户统计数据
   * @param {Object} userData - 用户数据
   * @returns {Array} 估算的同水平用户数据
   */
  _generatePeerData(userData) {
    const peers = [];
    const baseScore = userData.learningScore;
    const baseAccuracy = parseFloat(userData.overallAccuracy) || 0;
    const baseStreak = userData.currentStreak;
    const baseQuestions = userData.totalQuestions;

    // 基于用户数据生成估算的同水平分布（非真实用户）
    for (let i = 0; i < 10; i++) {
      peers.push({
        id: `estimated_${i}`,
        score: Math.round(baseScore + (Math.random() * 20 - 10)),
        accuracy: parseFloat((baseAccuracy + (Math.random() * 15 - 7.5)).toFixed(1)),
        streak: Math.max(0, Math.round(baseStreak + (Math.random() * 10 - 5))),
        questions: Math.max(0, Math.round(baseQuestions + (Math.random() * 100 - 50))),
        _isEstimated: true // 标记为估算数据，非真实用户
      });
    }

    return peers;
  }

  /**
   * 计算百分位数
   * @param {number} value - 用户值
   * @param {Array} peerValues - 同水平用户值
   * @returns {number} 百分位数
   */
  _calculatePercentile(value, peerValues) {
    const allValues = [...peerValues, value].sort((a, b) => a - b);
    const index = allValues.indexOf(value);
    return Math.round((index / (allValues.length - 1)) * 100);
  }

  /**
   * 生成同水平对比洞察
   * @param {Object} userData - 用户数据
   * @param {Array} peerData - 同水平用户数据
   * @returns {Array} 洞察
   */
  _generatePeerInsights(userData, peerData) {
    const insights = [];

    const avgPeerScore = peerData.reduce((sum, p) => sum + p.score, 0) / peerData.length;
    const avgPeerAccuracy = peerData.reduce((sum, p) => sum + p.accuracy, 0) / peerData.length;
    const avgPeerStreak = peerData.reduce((sum, p) => sum + p.streak, 0) / peerData.length;

    if (userData.learningScore > avgPeerScore) {
      insights.push('你的学习得分高于同水平用户平均水平，继续保持！');
    } else {
      insights.push('你的学习得分低于同水平用户平均水平，建议增加练习时间。');
    }

    if (parseFloat(userData.overallAccuracy) > avgPeerAccuracy) {
      insights.push('你的正确率高于同水平用户，解题能力较强。');
    } else {
      insights.push('你的正确率低于同水平用户，建议加强基础知识学习。');
    }

    if (userData.currentStreak > avgPeerStreak) {
      insights.push('你的连续学习天数高于同水平用户，学习习惯良好。');
    } else {
      insights.push('你的连续学习天数低于同水平用户，建议保持学习连续性。');
    }

    return insights;
  }
}


export const learningAnalytics = new LearningAnalytics();

export function recordAnswer(data) { return learningAnalytics.recordAnswer(data); }
export function getHeatmapData(days) { return learningAnalytics.getHeatmapData(days); }
export function getAccuracyTrend(days) { return learningAnalytics.getAccuracyTrend(days); }
export function getKnowledgePointAnalysis() { return learningAnalytics.getKnowledgePointAnalysis(); }
export function getStreakData() { return learningAnalytics.getStreakData(); }
export function getAchievements() { return learningAnalytics.getAchievements(); }
export function getComprehensiveReport() { return learningAnalytics.getComprehensiveReport(); }
export function getMultiDimensionReport(options) { return learningAnalytics.getMultiDimensionReport(options); }
export function getLearningEfficiency() { return learningAnalytics.getLearningEfficiency(); }
export function getProgressTrend(days) { return learningAnalytics.getProgressTrend(days); }
export function getPeerComparison() { return learningAnalytics.getPeerComparison(); }
export function predictScore() { return learningAnalytics.predictScore(); }

export { ACHIEVEMENTS };
export default learningAnalytics;
