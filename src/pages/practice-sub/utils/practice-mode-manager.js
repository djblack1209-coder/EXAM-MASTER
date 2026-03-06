/**
 * 练习模式管理器 - 管理不同的练习模式
 *
 * 核心功能：
 * 1. 专项突破模式 - 针对特定知识点或题型的集中练习
 * 2. 限时训练模式 - 模拟考试时间压力，提升答题速度
 * 3. 错题变式练习 - 基于错题生成相似题型，强化知识点掌握
 * 4. 章节测试 - 按教材章节组织的测试，确保章节内容掌握
 * 5. 综合练习 - 混合多种题型和知识点的全面练习
 */

import { storageService } from '@/services/storageService.js';
import { questionQualityOptimizer } from './question-quality-optimizer.js';
import { pickQuestions } from './smart-question-picker.js';

// 练习模式配置
const PRACTICE_MODES = {
  NORMAL: {
    id: 'normal',
    name: '综合练习',
    description: '混合多种题型和知识点的全面练习',
    icon: 'mode-sequential',
    defaultSettings: {
      questionCount: 20,
      timeLimit: 0, // 无时间限制
      includeAllTypes: true,
      difficultyRange: [1, 3]
    }
  },
  SPECIAL_TOPIC: {
    id: 'special_topic',
    name: '专项突破',
    description: '针对特定知识点或题型的集中练习',
    icon: 'mode-targeted',
    defaultSettings: {
      questionCount: 15,
      timeLimit: 0,
      topic: '',
      questionType: '',
      difficultyRange: [1, 3]
    }
  },
  TIME_LIMITED: {
    id: 'time_limited',
    name: '限时训练',
    description: '模拟考试时间压力，提升答题速度',
    icon: 'mode-timed',
    defaultSettings: {
      questionCount: 10,
      timeLimit: 600, // 10分钟
      questionTypes: ['单选', '多选'],
      difficultyRange: [2, 3]
    }
  },
  MISTAKE_VARIANT: {
    id: 'mistake_variant',
    name: '错题变式',
    description: '基于错题生成相似题型，强化知识点掌握',
    icon: 'mode-review',
    defaultSettings: {
      questionCount: 10,
      timeLimit: 0,
      includeOriginal: false,
      difficultyAdjustment: 0
    }
  },
  CHAPTER_TEST: {
    id: 'chapter_test',
    name: '章节测试',
    description: '按教材章节组织的测试，确保章节内容掌握',
    icon: 'mode-reading',
    defaultSettings: {
      questionCount: 25,
      timeLimit: 900, // 15分钟
      chapter: '',
      includeAllDifficulties: true
    }
  }
};

/**
 * 练习模式管理器
 */
class PracticeModeManager {
  constructor() {
    this.currentMode = null;
    this.currentSettings = null;
    this.practiceHistory = [];
  }

  /**
   * 获取所有支持的练习模式
   * @returns {Array} 练习模式列表
   */
  getAvailableModes() {
    return Object.values(PRACTICE_MODES);
  }

  /**
   * 初始化练习模式
   * @param {string} modeId - 模式ID
   * @param {Object} settings - 模式设置
   * @returns {Object} 初始化结果
   */
  initMode(modeId, settings = {}) {
    const modeConfig = PRACTICE_MODES[modeId];
    if (!modeConfig) {
      throw new Error(`不支持的练习模式: ${modeId}`);
    }

    this.currentMode = modeConfig;
    this.currentSettings = {
      ...modeConfig.defaultSettings,
      ...settings
    };

    return {
      success: true,
      mode: modeConfig,
      settings: this.currentSettings
    };
  }

  /**
   * 生成练习题目
   * @param {Object} options - 生成选项
   * @returns {Array} 题目列表
   */
  async generatePracticeQuestions(_options = {}) {
    if (!this.currentMode) {
      throw new Error('请先初始化练习模式');
    }

    const bank = storageService.get('v30_bank', []);
    if (bank.length === 0) {
      throw new Error('题库为空，请先导入资料');
    }

    let questions = [...bank];

    // 根据模式过滤题目
    switch (this.currentMode.id) {
      case 'special_topic':
        questions = this._filterSpecialTopicQuestions(questions, this.currentSettings);
        break;

      case 'time_limited':
        questions = this._filterTimeLimitedQuestions(questions, this.currentSettings);
        break;

      case 'mistake_variant':
        questions = this._generateMistakeVariants(this.currentSettings);
        break;

      case 'chapter_test':
        questions = this._filterChapterQuestions(questions, this.currentSettings);
        break;

      default: {
        // 综合练习 - 使用智能组题
        return pickQuestions(questions, {
          count: this.currentSettings.questionCount,
          mode: 'adaptive',
          includeReview: true,
          reviewRatio: 0.2
        });
      }
    }

    // 优化题目质量
    questions = questionQualityOptimizer.optimizeQuestions(questions, {
      removeDuplicates: true,
      fixFormat: true,
      addMetadata: true
    });

    // 限制题目数量
    questions = questions.slice(0, this.currentSettings.questionCount);

    return questions;
  }

  /**
   * 开始练习会话
   * @param {Object} options - 会话选项
   * @returns {Object} 会话信息
   */
  async startPracticeSession(options = {}) {
    const questions = await this.generatePracticeQuestions(options);

    const session = {
      id: `session_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      mode: this.currentMode.id,
      modeName: this.currentMode.name,
      startTime: Date.now(),
      questionCount: questions.length,
      timeLimit: this.currentSettings.timeLimit,
      questions: questions,
      answeredQuestions: [],
      currentIndex: 0,
      settings: this.currentSettings
    };

    // 保存会话信息
    storageService.save('current_practice_session', session);

    return session;
  }

  /**
   * 结束练习会话
   * @param {string} sessionId - 会话ID
   * @param {Object} results - 练习结果
   * @returns {Object} 会话总结
   */
  endPracticeSession(sessionId, results) {
    const session = storageService.get('current_practice_session', null);
    if (!session || session.id !== sessionId) {
      throw new Error('会话不存在');
    }

    const endTime = Date.now();
    const duration = endTime - session.startTime;

    // 计算得分和正确率
    const correctCount = results.answeredQuestions.filter((q) => q.isCorrect).length;
    const totalCount = results.answeredQuestions.length;
    const accuracy = totalCount > 0 ? (correctCount / totalCount) * 100 : 0;

    const summary = {
      sessionId: session.id,
      mode: session.mode,
      modeName: session.modeName,
      startTime: session.startTime,
      endTime: endTime,
      duration: duration,
      questionCount: session.questionCount,
      answeredCount: totalCount,
      correctCount: correctCount,
      accuracy: accuracy,
      timeLimit: session.timeLimit,
      timeUsed: duration,
      settings: session.settings,
      weakPoints: this._identifyWeakPoints(results.answeredQuestions)
    };

    // 保存练习历史
    this._savePracticeHistory(summary);

    // 清除当前会话
    storageService.remove('current_practice_session');

    return summary;
  }

  /**
   * 获取练习历史
   * @param {number} limit - 限制数量
   * @returns {Array} 练习历史记录
   */
  getPracticeHistory(limit = 20) {
    const history = storageService.get('practice_history', []);
    return history.slice(0, limit);
  }

  /**
   * 获取模式推荐
   * @param {Object} userProfile - 用户画像
   * @returns {Array} 推荐的练习模式
   */
  getRecommendedModes(userProfile = {}) {
    const _modes = this.getAvailableModes();
    const recommendations = [];

    // 基于用户历史和薄弱点推荐模式
    const history = this.getPracticeHistory(10);
    const weakPoints = this._getUserWeakPoints(userProfile);

    // 推荐逻辑
    if (weakPoints.length > 0) {
      recommendations.push(PRACTICE_MODES.SPECIAL_TOPIC);
    }

    if (history.length > 0) {
      const avgTimePerQuestion =
        history.reduce((sum, h) => {
          return sum + h.duration / h.questionCount;
        }, 0) / history.length;

      if (avgTimePerQuestion > 30) {
        // 平均每题超过30秒
        recommendations.push(PRACTICE_MODES.TIME_LIMITED);
      }
    }

    // 确保推荐列表不重复
    const uniqueRecommendations = [...new Set([...recommendations, PRACTICE_MODES.NORMAL])];
    return uniqueRecommendations.slice(0, 3);
  }

  // ==================== 私有方法 ====================

  /**
   * 过滤专项突破题目
   */
  _filterSpecialTopicQuestions(questions, settings) {
    return questions.filter((q) => {
      let match = true;

      // 按知识点过滤
      if (settings.topic) {
        const topic = settings.topic.toLowerCase();
        match =
          match &&
          ((q.category && q.category.toLowerCase().includes(topic)) ||
            (q.knowledge_points && q.knowledge_points.some((kp) => kp.toLowerCase().includes(topic))));
      }

      // 按题型过滤
      if (settings.questionType) {
        match = match && q.type === settings.questionType;
      }

      // 按难度过滤
      if (settings.difficultyRange) {
        const difficulty = q.difficulty || 2;
        match = match && difficulty >= settings.difficultyRange[0] && difficulty <= settings.difficultyRange[1];
      }

      return match;
    });
  }

  /**
   * 过滤限时训练题目
   */
  _filterTimeLimitedQuestions(questions, settings) {
    return questions.filter((q) => {
      let match = true;

      // 按题型过滤
      if (settings.questionTypes && settings.questionTypes.length > 0) {
        match = match && settings.questionTypes.includes(q.type);
      }

      // 按难度过滤
      if (settings.difficultyRange) {
        const difficulty = q.difficulty || 2;
        match = match && difficulty >= settings.difficultyRange[0] && difficulty <= settings.difficultyRange[1];
      }

      return match;
    });
  }

  /**
   * 生成错题变式
   */
  _generateMistakeVariants(settings) {
    const mistakes = storageService.get('mistake_book', []);
    if (mistakes.length === 0) {
      // 无错题时返回普通题目
      const bank = storageService.get('v30_bank', []);
      return bank.slice(0, settings.questionCount);
    }

    // 基于错题生成相似题目
    const variants = mistakes.map((mistake) => {
      // 这里简化处理，实际应该使用智能生成相似题目
      // 目前返回原始错题
      return {
        ...mistake,
        id: `variant_${mistake.id || Date.now()}`,
        isVariant: true,
        originalQuestion: mistake.question || mistake.question_content
      };
    });

    return variants.slice(0, settings.questionCount);
  }

  /**
   * 过滤章节题目
   */
  _filterChapterQuestions(questions, settings) {
    return questions.filter((q) => {
      // 按章节过滤
      if (settings.chapter) {
        const chapter = settings.chapter.toLowerCase();
        return (
          (q.sub_category && q.sub_category.toLowerCase().includes(chapter)) ||
          (q.tags && q.tags.some((tag) => tag.toLowerCase().includes(chapter)))
        );
      }
      return true;
    });
  }

  /**
   * 识别薄弱点
   */
  _identifyWeakPoints(answeredQuestions) {
    const weakPoints = {};

    answeredQuestions.forEach((q) => {
      if (!q.isCorrect && q.category) {
        weakPoints[q.category] = (weakPoints[q.category] || 0) + 1;
      }
    });

    // 转换为数组并排序
    return Object.entries(weakPoints)
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count);
  }

  /**
   * 保存练习历史
   */
  _savePracticeHistory(summary) {
    const history = storageService.get('practice_history', []);
    history.unshift(summary);

    // 限制历史记录数量
    if (history.length > 100) {
      history.splice(100);
    }

    storageService.save('practice_history', history);
  }

  /**
   * 获取用户薄弱点
   */
  _getUserWeakPoints(_userProfile) {
    const history = this.getPracticeHistory(10);
    const weakPoints = {};

    history.forEach((session) => {
      if (session.weakPoints) {
        session.weakPoints.forEach((point) => {
          weakPoints[point.category] = (weakPoints[point.category] || 0) + point.count;
        });
      }
    });

    return Object.entries(weakPoints)
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }
}

// 创建单例
export const practiceModeManager = new PracticeModeManager();

// 便捷函数
export async function startPracticeMode(modeId, settings = {}) {
  practiceModeManager.initMode(modeId, settings);
  return await practiceModeManager.startPracticeSession();
}

export function getAvailablePracticeModes() {
  return practiceModeManager.getAvailableModes();
}

export function getRecommendedPracticeModes(userProfile = {}) {
  return practiceModeManager.getRecommendedModes(userProfile);
}

export function getPracticeHistory(limit = 20) {
  return practiceModeManager.getPracticeHistory(limit);
}

export default practiceModeManager;
