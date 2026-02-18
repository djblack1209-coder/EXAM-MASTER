// 智能学习计划管理器
// 实现动态计划调整、多维度计划管理、智能提醒等功能

import { storageService } from '@/services/storageService.js';
import { getLearningReport } from '@/utils/learning/smart-question-picker.js';
import { getStreakData, getComprehensiveReport } from './utils/learning-analytics.js';
import { logger } from '@/utils/logger.js';

class IntelligentPlanManager {
  constructor() {
    this.plans = [];
    this.learningData = {};
    this.reminders = [];
    this.init();
  }

  init() {
    this.loadPlans();
    this.loadLearningData();
    this.loadReminders();
  }

  // 加载学习计划
  loadPlans() {
    try {
      this.plans = storageService.get('study_plans', []);
      this.enrichPlansWithAnalytics();
    } catch (error) {
      logger.error('[IntelligentPlanManager] 加载计划失败:', error);
      this.plans = [];
    }
  }

  // 加载学习数据
  loadLearningData() {
    try {
      const report = getComprehensiveReport();
      const streakData = getStreakData();
      this.learningData = {
        report,
        streakData,
        lastUpdated: Date.now()
      };
    } catch (error) {
      logger.error('[IntelligentPlanManager] 加载学习数据失败:', error);
      this.learningData = {};
    }
  }

  // 加载提醒设置
  loadReminders() {
    try {
      this.reminders = storageService.get('study_reminders', []);
    } catch (error) {
      logger.error('[IntelligentPlanManager] 加载提醒失败:', error);
      this.reminders = [];
    }
  }

  // 为计划添加分析数据
  enrichPlansWithAnalytics() {
    this.plans = this.plans.map((plan) => {
      const enrichedPlan = {
        ...plan,
        analytics: {
          completionRate: this.calculateCompletionRate(plan),
          progressTrend: this.getProgressTrend(plan),
          recommendedAdjustments: this.getRecommendedAdjustments(plan)
        }
      };
      return enrichedPlan;
    });
  }

  // 计算计划完成率
  calculateCompletionRate(plan) {
    if (!plan.tasks || plan.tasks.length === 0) {
      return plan.progress || 0;
    }
    const completedTasks = plan.tasks.filter((task) => task.completed).length;
    return Math.round((completedTasks / plan.tasks.length) * 100);
  }

  // 获取进度趋势（基于历史完成率计算）
  getProgressTrend(plan) {
    const baseRate = this.calculateCompletionRate(plan);
    const daysRemaining = this.getDaysRemaining(plan);
    const totalDays = this.getTotalDays(plan);
    const elapsed = Math.max(1, totalDays - daysRemaining);

    // 计算预期进度 vs 实际进度的差值作为趋势
    const expectedRate = Math.min(100, Math.round((elapsed / Math.max(1, totalDays)) * 100));
    const trend = baseRate - expectedRate; // 正值=超前，负值=落后

    return {
      current: baseRate,
      trend: Math.round(trend),
      projected: Math.min(100, Math.max(0, Math.round(baseRate + (trend * daysRemaining / Math.max(1, elapsed)))))
    };
  }

  // 获取计划总天数
  getTotalDays(plan) {
    const startDate = new Date(plan.startDate);
    const endDate = new Date(plan.endDate);
    const diffTime = endDate - startDate;
    return Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
  }

  // 获取推荐调整
  getRecommendedAdjustments(plan) {
    const adjustments = [];
    const completionRate = this.calculateCompletionRate(plan);
    const daysRemaining = this.getDaysRemaining(plan);

    if (completionRate < 30 && daysRemaining < 7) {
      adjustments.push({
        type: 'task_reduction',
        message: '建议减少每日任务量，确保核心内容完成',
        priority: 'high'
      });
    }

    if (completionRate > 80 && daysRemaining > 3) {
      adjustments.push({
        type: 'task_increase',
        message: '进度良好，可适当增加任务量',
        priority: 'medium'
      });
    }

    return adjustments;
  }

  // 获取剩余天数
  getDaysRemaining(plan) {
    const endDate = new Date(plan.endDate);
    const today = new Date();
    const diffTime = endDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  }

  // 创建多维度学习计划
  createMultiDimensionPlan(options) {
    const {
      name,
      goal,
      startDate,
      endDate,
      dailyDuration,
      reminderTime,
      category,
      priority,
      dimensions = ['short', 'medium', 'long'] // 短期、中期、长期
    } = options;

    const plan = {
      id: `plan_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      name,
      goal,
      startDate,
      endDate,
      dailyDuration,
      reminderTime,
      category,
      priority,
      status: 'not_started',
      progress: 0,
      dimensions,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      tasks: [],
      milestones: this.generateMilestones(options),
      analytics: {
        completionRate: 0,
        progressTrend: {
          current: 0,
          trend: 0,
          projected: 0
        },
        recommendedAdjustments: []
      }
    };

    // 生成任务
    plan.tasks = this.generateTasks(plan);

    // 保存计划
    this.plans.unshift(plan);
    this.savePlans();

    // 设置提醒
    if (reminderTime) {
      this.setReminder(plan);
    }

    return plan;
  }

  // 生成里程碑
  generateMilestones(options) {
    const {
      startDate,
      endDate,
      goal,
      category
    } = options;

    const milestones = [];
    const start = new Date(startDate);
    const end = new Date(endDate);
    const totalDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24));

    // 生成三个主要里程碑
    const milestonePoints = [0.33, 0.66, 1.0];

    milestonePoints.forEach((point, index) => {
      const milestoneDate = new Date(start.getTime() + point * totalDays * 24 * 60 * 60 * 1000);
      const milestoneGoal = this.getMilestoneGoal(index, goal, category);

      milestones.push({
        id: `milestone_${Date.now()}_${index}`,
        title: this.getMilestoneTitle(index),
        goal: milestoneGoal,
        date: milestoneDate.toISOString().split('T')[0],
        completed: false,
        order: index
      });
    });

    return milestones;
  }

  // 获取里程碑标题
  getMilestoneTitle(index) {
    const titles = ['基础阶段完成', '强化阶段完成', '冲刺阶段完成'];
    return titles[index] || `里程碑 ${index + 1}`;
  }

  // 获取里程碑目标
  getMilestoneGoal(index, mainGoal, category) {
    const goalTemplates = {
      数学: [
        '完成基础知识点学习，掌握基本概念和公式',
        '完成强化训练，掌握解题技巧和方法',
        '完成冲刺复习，熟练掌握考点和难点'
      ],
      英语: [
        '完成词汇和语法基础学习',
        '完成阅读和写作强化训练',
        '完成真题模拟和冲刺复习'
      ],
      政治: [
        '完成基础知识学习，构建知识体系',
        '完成强化训练，掌握重点难点',
        '完成冲刺复习，熟练掌握时政和考点'
      ],
      专业课: [
        '完成基础知识点学习，构建知识框架',
        '完成强化训练，掌握核心内容',
        '完成冲刺复习，熟练掌握考点和热点'
      ],
      综合: [
        '完成基础阶段学习，掌握基本概念',
        '完成强化阶段学习，提升解题能力',
        '完成冲刺阶段学习，全面备考'
      ]
    };

    const templates = goalTemplates[category] || goalTemplates.综合;
    return templates[index] || mainGoal;
  }

  // 生成任务
  generateTasks(plan) {
    const tasks = [];
    const start = new Date(plan.startDate);
    const end = new Date(plan.endDate);
    const totalDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24));

    // 根据计划类型生成不同的任务
    if (plan.dimensions.includes('short')) {
      // 短期任务：每日任务
      for (let i = 0; i < totalDays; i++) {
        const taskDate = new Date(start.getTime() + i * 24 * 60 * 60 * 1000);
        tasks.push({
          id: `task_daily_${Date.now()}_${i}`,
          title: `每日学习任务 ${i + 1}`,
          description: this.generateDailyTaskDescription(plan, i, totalDays),
          date: taskDate.toISOString().split('T')[0],
          duration: plan.dailyDuration,
          completed: false,
          type: 'daily',
          priority: this.getTaskPriority(i, totalDays, plan.priority)
        });
      }
    }

    if (plan.dimensions.includes('medium')) {
      // 中期任务：每周任务
      const weeks = Math.ceil(totalDays / 7);
      for (let i = 0; i < weeks; i++) {
        const weekStart = new Date(start.getTime() + i * 7 * 24 * 60 * 60 * 1000);
        tasks.push({
          id: `task_weekly_${Date.now()}_${i}`,
          title: `第 ${i + 1} 周学习任务`,
          description: this.generateWeeklyTaskDescription(plan, i, weeks),
          date: weekStart.toISOString().split('T')[0],
          duration: '7天',
          completed: false,
          type: 'weekly',
          priority: 'medium'
        });
      }
    }

    if (plan.dimensions.includes('long')) {
      // 长期任务：阶段任务
      const phases = 3; // 基础、强化、冲刺
      const phaseDays = Math.ceil(totalDays / phases);
      for (let i = 0; i < phases; i++) {
        const phaseStart = new Date(start.getTime() + i * phaseDays * 24 * 60 * 60 * 1000);
        tasks.push({
          id: `task_phase_${Date.now()}_${i}`,
          title: this.getPhaseTitle(i),
          description: this.generatePhaseTaskDescription(plan, i, phases),
          date: phaseStart.toISOString().split('T')[0],
          duration: `${phaseDays}天`,
          completed: false,
          type: 'phase',
          priority: 'high'
        });
      }
    }

    return tasks;
  }

  // 获取阶段标题
  getPhaseTitle(index) {
    const titles = ['基础阶段学习', '强化阶段学习', '冲刺阶段学习'];
    return titles[index] || `阶段 ${index + 1} 学习`;
  }

  // 生成每日任务描述
  generateDailyTaskDescription(plan, dayIndex, totalDays) {
    const progressPercentage = (dayIndex / totalDays) * 100;
    let description = `完成每日 ${plan.dailyDuration} 的学习任务`;

    if (progressPercentage < 33) {
      description += '，重点掌握基础知识';
    } else if (progressPercentage < 66) {
      description += '，重点强化解题能力';
    } else {
      description += '，重点冲刺复习考点';
    }

    return description;
  }

  // 生成每周任务描述
  generateWeeklyTaskDescription(plan, weekIndex, _totalWeeks) {
    return `完成第 ${weekIndex + 1} 周的学习任务，重点关注 ${plan.category} 的核心知识点`;
  }

  // 生成阶段任务描述
  generatePhaseTaskDescription(plan, phaseIndex, _totalPhases) {
    const phaseDescriptions = {
      0: `完成 ${plan.category} 的基础阶段学习，构建知识框架`,
      1: `完成 ${plan.category} 的强化阶段学习，提升解题能力`,
      2: `完成 ${plan.category} 的冲刺阶段学习，全面备考`
    };
    return phaseDescriptions[phaseIndex] || `完成第 ${phaseIndex + 1} 阶段的学习任务`;
  }

  // 获取任务优先级
  getTaskPriority(dayIndex, totalDays, basePriority) {
    const progressPercentage = (dayIndex / totalDays) * 100;

    // 开始和结束阶段优先级较高
    if (progressPercentage < 10 || progressPercentage > 90) {
      return 'high';
    }
    return basePriority;
  }

  // 动态调整计划
  adjustPlan(planId, learningProgress) {
    const planIndex = this.plans.findIndex((p) => p.id === planId);
    if (planIndex === -1) {
      logger.warn('[IntelligentPlanManager] 计划不存在:', planId);
      return null;
    }

    const plan = this.plans[planIndex];
    const adjustedPlan = {
      ...plan,
      progress: learningProgress || plan.progress,
      updatedAt: Date.now(),
      tasks: this.adjustTasks(plan, learningProgress),
      analytics: {
        ...plan.analytics,
        completionRate: this.calculateCompletionRate(plan),
        progressTrend: this.getProgressTrend(plan),
        recommendedAdjustments: this.getRecommendedAdjustments(plan)
      }
    };

    this.plans[planIndex] = adjustedPlan;
    this.savePlans();

    return adjustedPlan;
  }

  // 调整任务
  adjustTasks(plan, learningProgress) {
    const tasks = [...plan.tasks];
    const completionRate = learningProgress || this.calculateCompletionRate(plan);

    // 根据完成率调整任务难度和数量
    tasks.forEach((task) => {
      if (!task.completed) {
        // 基于完成率调整任务优先级
        if (completionRate < 30) {
          // 完成率低，降低未完成任务的优先级
          if (task.priority === 'high') {
            task.priority = 'medium';
          }
        } else if (completionRate > 80) {
          // 完成率高，提高未完成任务的优先级
          if (task.priority === 'low') {
            task.priority = 'medium';
          }
        }
      }
    });

    return tasks;
  }

  // 设置提醒
  setReminder(plan) {
    const reminder = {
      id: `reminder_${Date.now()}`,
      planId: plan.id,
      planName: plan.name,
      time: plan.reminderTime,
      active: true,
      createdAt: Date.now()
    };

    this.reminders.push(reminder);
    this.saveReminders();

    // 这里可以集成系统提醒 API
    this.scheduleSystemReminder(reminder);

    return reminder;
  }

  // 调度系统提醒
  scheduleSystemReminder(reminder) {
    // 模拟系统提醒设置
    logger.log('[IntelligentPlanManager] 设置提醒:', reminder);

    // 实际项目中，这里可以使用:
    // - 微信小程序的订阅消息
    // - 系统的本地通知 API
    // - 服务器推送通知
  }

  // 获取智能提醒
  getIntelligentReminders() {
    const intelligentReminders = [];
    const learningReport = getLearningReport();
    const streakData = getStreakData();

    // 基于学习习惯的提醒
    if (streakData.currentStreak > 3) {
      intelligentReminders.push({
        type: 'streak_reminder',
        message: `你已经连续学习 ${streakData.currentStreak} 天了，继续保持！`,
        priority: 'medium',
        time: this.getOptimalStudyTime()
      });
    }

    // 基于学习进度的提醒
    if (learningReport && learningReport.overview && learningReport.overview.overallAccuracy < 60) {
      intelligentReminders.push({
        type: 'progress_reminder',
        message: '你的学习进度需要加强，建议增加练习时间',
        priority: 'high',
        time: this.getOptimalStudyTime()
      });
    }

    return intelligentReminders;
  }

  // 获取最佳学习时间
  getOptimalStudyTime() {
    // 基于用户历史学习数据推荐最佳学习时间
    // 暂时返回默认时间
    return '09:00';
  }

  // 保存计划
  savePlans() {
    try {
      storageService.save('study_plans', this.plans);
      logger.log('[IntelligentPlanManager] 计划保存成功:', this.plans.length);
    } catch (error) {
      logger.error('[IntelligentPlanManager] 计划保存失败:', error);
    }
  }

  // 保存学习数据
  saveLearningData() {
    try {
      storageService.save('learning_data', this.learningData);
    } catch (error) {
      logger.error('[IntelligentPlanManager] 学习数据保存失败:', error);
    }
  }

  // 保存提醒
  saveReminders() {
    try {
      storageService.save('study_reminders', this.reminders);
    } catch (error) {
      logger.error('[IntelligentPlanManager] 提醒保存失败:', error);
    }
  }

  // 加载学习数据
  loadLearningData() {
    try {
      this.learningData = storageService.get('learning_data', {});
    } catch (error) {
      logger.error('[IntelligentPlanManager] 学习数据加载失败:', error);
      this.learningData = {};
    }
  }

  // 加载提醒
  loadReminders() {
    try {
      this.reminders = storageService.get('study_reminders', []);
    } catch (error) {
      logger.error('[IntelligentPlanManager] 提醒加载失败:', error);
      this.reminders = [];
    }
  }

  // 获取计划列表
  getPlans() {
    return this.plans;
  }

  // 获取计划详情
  getPlan(planId) {
    return this.plans.find((p) => p.id === planId);
  }

  // 更新计划状态
  updatePlanStatus(planId, status) {
    const planIndex = this.plans.findIndex((p) => p.id === planId);
    if (planIndex === -1) {
      return false;
    }

    this.plans[planIndex] = {
      ...this.plans[planIndex],
      status,
      updatedAt: Date.now()
    };

    this.savePlans();
    return true;
  }

  // 标记任务完成
  completeTask(planId, taskId) {
    const planIndex = this.plans.findIndex((p) => p.id === planId);
    if (planIndex === -1) {
      return false;
    }

    const plan = this.plans[planIndex];
    const taskIndex = plan.tasks.findIndex((t) => t.id === taskId);
    if (taskIndex === -1) {
      return false;
    }

    plan.tasks[taskIndex] = {
      ...plan.tasks[taskIndex],
      completed: true,
      completedAt: Date.now()
    };

    // 更新计划进度
    const completedTasks = plan.tasks.filter((t) => t.completed).length;
    plan.progress = Math.round((completedTasks / plan.tasks.length) * 100);
    plan.updatedAt = Date.now();

    // 检查是否完成所有任务
    if (completedTasks === plan.tasks.length) {
      plan.status = 'completed';
    } else if (plan.status === 'not_started') {
      plan.status = 'in_progress';
    }

    this.plans[planIndex] = plan;
    this.savePlans();

    return true;
  }

  // 删除计划
  deletePlan(planId) {
    const planIndex = this.plans.findIndex((p) => p.id === planId);
    if (planIndex === -1) {
      return false;
    }

    this.plans.splice(planIndex, 1);
    this.savePlans();

    // 同时删除相关提醒
    this.reminders = this.reminders.filter((r) => r.planId !== planId);
    this.saveReminders();

    return true;
  }

  // 获取计划分析报告
  getPlanAnalysis(planId) {
    const plan = this.getPlan(planId);
    if (!plan) {
      return null;
    }

    return {
      plan,
      analytics: {
        completionRate: this.calculateCompletionRate(plan),
        taskDistribution: this.getTaskDistribution(plan),
        progressTrend: this.getProgressTrend(plan),
        recommendedAdjustments: this.getRecommendedAdjustments(plan),
        estimatedCompletion: this.getEstimatedCompletion(plan)
      }
    };
  }

  // 获取任务分布
  getTaskDistribution(plan) {
    const distribution = {
      daily: 0,
      weekly: 0,
      phase: 0,
      highPriority: 0,
      mediumPriority: 0,
      lowPriority: 0
    };

    plan.tasks.forEach((task) => {
      if (task.type in distribution) {
        distribution[task.type]++;
      }
      if (task.priority in distribution) {
        distribution[task.priority]++;
      }
    });

    return distribution;
  }

  // 获取预计完成时间
  getEstimatedCompletion(plan) {
    const completionRate = this.calculateCompletionRate(plan);
    const daysElapsed = this.getDaysElapsed(plan);
    const _daysRemaining = this.getDaysRemaining(plan);

    if (completionRate === 0) {
      return plan.endDate;
    }

    const estimatedTotalDays = (daysElapsed / completionRate) * 100;
    const startTime = new Date(plan.startDate).getTime();
    const estimatedCompletionDate = new Date(startTime + estimatedTotalDays * 24 * 60 * 60 * 1000);

    return estimatedCompletionDate.toISOString().split('T')[0];
  }

  // 获取已过天数
  getDaysElapsed(plan) {
    const start = new Date(plan.startDate);
    const today = new Date();
    const diffTime = today - start;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  }
}

// 导出单例
const intelligentPlanManager = new IntelligentPlanManager();
export { intelligentPlanManager };
export default intelligentPlanManager;