/**
 * 成就解锁引擎
 * 检查点4.3: 学习成就系统 - 成就解锁逻辑
 * 
 * 功能：
 * - 成就定义与配置
 * - 目标完成检测
 * - 成就解锁触发
 * - 解锁通知（Badge + Toast）
 * - 成就进度追踪
 */

import { ref, reactive, computed, watch } from 'vue'
import { badgeAnimator } from './badge-animator'
// ✅ 检查点 5.1: 导入分析服务
import { analytics } from '../utils/analytics/event-bus-analytics.js'

// 成就类型
const ACHIEVEMENT_TYPE = {
  STUDY: 'study',           // 学习类
  PRACTICE: 'practice',     // 练习类
  STREAK: 'streak',         // 连续类
  SOCIAL: 'social',         // 社交类
  CHALLENGE: 'challenge',   // 挑战类
  SPECIAL: 'special'        // 特殊类
}

// 成就稀有度
const RARITY = {
  COMMON: 'common',         // 普通
  RARE: 'rare',             // 稀有
  EPIC: 'epic',             // 史诗
  LEGENDARY: 'legendary'    // 传说
}

// 成就定义
const ACHIEVEMENTS = {
  // 学习类成就
  first_study: {
    id: 'first_study',
    name: '初出茅庐',
    description: '完成第一次学习',
    icon: '📚',
    type: ACHIEVEMENT_TYPE.STUDY,
    rarity: RARITY.COMMON,
    condition: { type: 'study_count', value: 1 },
    reward: { exp: 10, coins: 5 }
  },
  study_10_hours: {
    id: 'study_10_hours',
    name: '勤奋学子',
    description: '累计学习10小时',
    icon: '⏰',
    type: ACHIEVEMENT_TYPE.STUDY,
    rarity: RARITY.RARE,
    condition: { type: 'study_hours', value: 10 },
    reward: { exp: 50, coins: 20 }
  },
  study_100_hours: {
    id: 'study_100_hours',
    name: '学霸养成',
    description: '累计学习100小时',
    icon: '🎓',
    type: ACHIEVEMENT_TYPE.STUDY,
    rarity: RARITY.EPIC,
    condition: { type: 'study_hours', value: 100 },
    reward: { exp: 200, coins: 100 }
  },
  
  // 练习类成就
  first_quiz: {
    id: 'first_quiz',
    name: '小试牛刀',
    description: '完成第一次练习',
    icon: '✏️',
    type: ACHIEVEMENT_TYPE.PRACTICE,
    rarity: RARITY.COMMON,
    condition: { type: 'quiz_count', value: 1 },
    reward: { exp: 10, coins: 5 }
  },
  quiz_100: {
    id: 'quiz_100',
    name: '百题斩',
    description: '完成100道练习题',
    icon: '💯',
    type: ACHIEVEMENT_TYPE.PRACTICE,
    rarity: RARITY.RARE,
    condition: { type: 'quiz_count', value: 100 },
    reward: { exp: 100, coins: 50 }
  },
  quiz_1000: {
    id: 'quiz_1000',
    name: '千题王者',
    description: '完成1000道练习题',
    icon: '👑',
    type: ACHIEVEMENT_TYPE.PRACTICE,
    rarity: RARITY.EPIC,
    condition: { type: 'quiz_count', value: 1000 },
    reward: { exp: 500, coins: 200 }
  },
  perfect_score: {
    id: 'perfect_score',
    name: '完美答卷',
    description: '单次练习全部正确',
    icon: '🌟',
    type: ACHIEVEMENT_TYPE.PRACTICE,
    rarity: RARITY.RARE,
    condition: { type: 'perfect_quiz', value: 1 },
    reward: { exp: 30, coins: 15 }
  },
  accuracy_90: {
    id: 'accuracy_90',
    name: '精准射手',
    description: '总正确率达到90%',
    icon: '🎯',
    type: ACHIEVEMENT_TYPE.PRACTICE,
    rarity: RARITY.EPIC,
    condition: { type: 'accuracy', value: 90 },
    reward: { exp: 150, coins: 80 }
  },
  
  // 连续类成就
  streak_3: {
    id: 'streak_3',
    name: '三日坚持',
    description: '连续打卡3天',
    icon: '🔥',
    type: ACHIEVEMENT_TYPE.STREAK,
    rarity: RARITY.COMMON,
    condition: { type: 'streak_days', value: 3 },
    reward: { exp: 20, coins: 10 }
  },
  streak_7: {
    id: 'streak_7',
    name: '周周不断',
    description: '连续打卡7天',
    icon: '📅',
    type: ACHIEVEMENT_TYPE.STREAK,
    rarity: RARITY.RARE,
    condition: { type: 'streak_days', value: 7 },
    reward: { exp: 50, coins: 30 }
  },
  streak_30: {
    id: 'streak_30',
    name: '月度达人',
    description: '连续打卡30天',
    icon: '🏆',
    type: ACHIEVEMENT_TYPE.STREAK,
    rarity: RARITY.EPIC,
    condition: { type: 'streak_days', value: 30 },
    reward: { exp: 200, coins: 100 }
  },
  streak_100: {
    id: 'streak_100',
    name: '百日传奇',
    description: '连续打卡100天',
    icon: '💎',
    type: ACHIEVEMENT_TYPE.STREAK,
    rarity: RARITY.LEGENDARY,
    condition: { type: 'streak_days', value: 100 },
    reward: { exp: 1000, coins: 500 }
  },
  
  // 社交类成就
  first_friend: {
    id: 'first_friend',
    name: '初识好友',
    description: '添加第一个好友',
    icon: '🤝',
    type: ACHIEVEMENT_TYPE.SOCIAL,
    rarity: RARITY.COMMON,
    condition: { type: 'friend_count', value: 1 },
    reward: { exp: 15, coins: 10 }
  },
  pk_win_first: {
    id: 'pk_win_first',
    name: '首战告捷',
    description: '赢得第一场PK',
    icon: '⚔️',
    type: ACHIEVEMENT_TYPE.SOCIAL,
    rarity: RARITY.COMMON,
    condition: { type: 'pk_win', value: 1 },
    reward: { exp: 20, coins: 10 }
  },
  pk_win_10: {
    id: 'pk_win_10',
    name: 'PK达人',
    description: '赢得10场PK',
    icon: '🥊',
    type: ACHIEVEMENT_TYPE.SOCIAL,
    rarity: RARITY.RARE,
    condition: { type: 'pk_win', value: 10 },
    reward: { exp: 80, coins: 40 }
  },
  
  // 挑战类成就
  speed_demon: {
    id: 'speed_demon',
    name: '闪电侠',
    description: '10秒内答对一题',
    icon: '⚡',
    type: ACHIEVEMENT_TYPE.CHALLENGE,
    rarity: RARITY.RARE,
    condition: { type: 'fast_answer', value: 10 },
    reward: { exp: 30, coins: 15 }
  },
  night_owl: {
    id: 'night_owl',
    name: '夜猫子',
    description: '凌晨学习',
    icon: '🦉',
    type: ACHIEVEMENT_TYPE.CHALLENGE,
    rarity: RARITY.RARE,
    condition: { type: 'night_study', value: 1 },
    reward: { exp: 25, coins: 10 }
  },
  early_bird: {
    id: 'early_bird',
    name: '早起鸟',
    description: '早上6点前学习',
    icon: '🐦',
    type: ACHIEVEMENT_TYPE.CHALLENGE,
    rarity: RARITY.RARE,
    condition: { type: 'early_study', value: 1 },
    reward: { exp: 25, coins: 10 }
  }
}

class AchievementEngine {
  constructor() {
    // 用户成就数据
    this.userAchievements = reactive({
      unlocked: new Set(),      // 已解锁成就ID
      progress: {},             // 成就进度
      lastUnlocked: null,       // 最近解锁
      totalExp: 0,              // 总经验
      totalCoins: 0             // 总金币
    })
    
    // 用户统计数据
    this.userStats = reactive({
      studyCount: 0,
      studyHours: 0,
      quizCount: 0,
      perfectQuizCount: 0,
      accuracy: 0,
      streakDays: 0,
      friendCount: 0,
      pkWinCount: 0,
      fastAnswerCount: 0,
      nightStudyCount: 0,
      earlyStudyCount: 0
    })
    
    // 待显示的解锁队列
    this.unlockQueue = []
    this.isShowingUnlock = false
    
    // 事件监听器
    this.listeners = new Map()
  }
  
  /**
   * 初始化用户成就数据
   */
  async init(userId) {
    try {
      // 从存储加载数据
      const savedData = await this._loadFromStorage(userId)
      
      if (savedData) {
        this.userAchievements.unlocked = new Set(savedData.unlocked || [])
        this.userAchievements.progress = savedData.progress || {}
        this.userAchievements.totalExp = savedData.totalExp || 0
        this.userAchievements.totalCoins = savedData.totalCoins || 0
        
        Object.assign(this.userStats, savedData.stats || {})
      }
      
      console.log('[AchievementEngine] Initialized:', {
        unlocked: this.userAchievements.unlocked.size,
        totalExp: this.userAchievements.totalExp
      })
      
    } catch (error) {
      console.error('[AchievementEngine] Init error:', error)
    }
  }
  
  /**
   * 更新用户统计数据并检查成就
   */
  async updateStats(statType, value, options = {}) {
    const { increment = true, checkAchievements = true } = options
    
    // 更新统计
    if (increment) {
      this.userStats[statType] = (this.userStats[statType] || 0) + value
    } else {
      this.userStats[statType] = value
    }
    
    console.log(`[AchievementEngine] Stats updated: ${statType} = ${this.userStats[statType]}`)
    
    // 检查成就
    if (checkAchievements) {
      await this._checkAchievements(statType)
    }
    
    // 保存数据
    await this._saveToStorage()
  }
  
  /**
   * 检查成就解锁
   */
  async _checkAchievements(triggerType) {
    const conditionTypeMap = {
      studyCount: 'study_count',
      studyHours: 'study_hours',
      quizCount: 'quiz_count',
      perfectQuizCount: 'perfect_quiz',
      accuracy: 'accuracy',
      streakDays: 'streak_days',
      friendCount: 'friend_count',
      pkWinCount: 'pk_win',
      fastAnswerCount: 'fast_answer',
      nightStudyCount: 'night_study',
      earlyStudyCount: 'early_study'
    }
    
    const conditionType = conditionTypeMap[triggerType]
    if (!conditionType) return
    
    // 遍历所有成就
    for (const [id, achievement] of Object.entries(ACHIEVEMENTS)) {
      // 跳过已解锁
      if (this.userAchievements.unlocked.has(id)) continue
      
      // 检查条件类型是否匹配
      if (achievement.condition.type !== conditionType) continue
      
      // 检查是否达成
      const currentValue = this.userStats[triggerType]
      const targetValue = achievement.condition.value
      
      // 更新进度
      this.userAchievements.progress[id] = {
        current: currentValue,
        target: targetValue,
        percentage: Math.min(100, Math.round((currentValue / targetValue) * 100))
      }
      
      // 检查是否解锁
      if (currentValue >= targetValue) {
        await this._unlockAchievement(achievement)
      }
    }
  }
  
  /**
   * 解锁成就
   */
  async _unlockAchievement(achievement) {
    const { id, name, icon, reward, rarity } = achievement
    
    // 标记为已解锁
    this.userAchievements.unlocked.add(id)
    this.userAchievements.lastUnlocked = {
      ...achievement,
      unlockedAt: Date.now()
    }
    
    // 发放奖励
    if (reward) {
      this.userAchievements.totalExp += reward.exp || 0
      this.userAchievements.totalCoins += reward.coins || 0
    }
    
    console.log(`[AchievementEngine] Achievement unlocked: ${name}`)
    
    // ✅ 检查点 5.1: 追踪"解锁成就"事件
    analytics.trackUnlockAchievement(id, name, {
      rarity: rarity,
      reward: reward,
      type: achievement.type
    })
    
    // 添加到显示队列
    this.unlockQueue.push(achievement)
    
    // 触发显示
    this._processUnlockQueue()
    
    // 触发事件
    this._emit('unlock', achievement)
    
    // 保存数据
    await this._saveToStorage()
  }
  
  /**
   * 处理解锁显示队列
   */
  async _processUnlockQueue() {
    if (this.isShowingUnlock || this.unlockQueue.length === 0) return
    
    this.isShowingUnlock = true
    
    while (this.unlockQueue.length > 0) {
      const achievement = this.unlockQueue.shift()
      
      // 显示Badge动画
      await badgeAnimator.showUnlock(achievement)
      
      // 显示Toast
      this._showUnlockToast(achievement)
      
      // 等待动画完成
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
    
    this.isShowingUnlock = false
  }
  
  /**
   * 显示解锁Toast
   */
  _showUnlockToast(achievement) {
    const { name, icon, reward, rarity } = achievement
    
    // 根据稀有度设置样式
    const rarityColors = {
      [RARITY.COMMON]: '#909399',
      [RARITY.RARE]: '#409eff',
      [RARITY.EPIC]: '#9b59b6',
      [RARITY.LEGENDARY]: '#f39c12'
    }
    
    uni.showToast({
      title: `${icon} 解锁成就：${name}`,
      icon: 'none',
      duration: 3000
    })
    
    // 如果有奖励，显示奖励提示
    if (reward && (reward.exp || reward.coins)) {
      setTimeout(() => {
        const rewardText = []
        if (reward.exp) rewardText.push(`+${reward.exp}经验`)
        if (reward.coins) rewardText.push(`+${reward.coins}金币`)
        
        uni.showToast({
          title: rewardText.join(' '),
          icon: 'none',
          duration: 2000
        })
      }, 1500)
    }
  }
  
  /**
   * 获取所有成就列表
   */
  getAllAchievements() {
    return Object.values(ACHIEVEMENTS).map(achievement => ({
      ...achievement,
      unlocked: this.userAchievements.unlocked.has(achievement.id),
      progress: this.userAchievements.progress[achievement.id] || {
        current: 0,
        target: achievement.condition.value,
        percentage: 0
      }
    }))
  }
  
  /**
   * 获取已解锁成就
   */
  getUnlockedAchievements() {
    return this.getAllAchievements().filter(a => a.unlocked)
  }
  
  /**
   * 获取未解锁成就
   */
  getLockedAchievements() {
    return this.getAllAchievements().filter(a => !a.unlocked)
  }
  
  /**
   * 按类型获取成就
   */
  getAchievementsByType(type) {
    return this.getAllAchievements().filter(a => a.type === type)
  }
  
  /**
   * 获取成就进度
   */
  getProgress(achievementId) {
    return this.userAchievements.progress[achievementId] || null
  }
  
  /**
   * 获取总体统计
   */
  getOverallStats() {
    const total = Object.keys(ACHIEVEMENTS).length
    const unlocked = this.userAchievements.unlocked.size
    
    return {
      total,
      unlocked,
      percentage: Math.round((unlocked / total) * 100),
      totalExp: this.userAchievements.totalExp,
      totalCoins: this.userAchievements.totalCoins
    }
  }
  
  /**
   * 从存储加载数据
   */
  async _loadFromStorage(userId) {
    try {
      const key = `achievements_${userId}`
      const data = uni.getStorageSync(key)
      return data ? JSON.parse(data) : null
    } catch (error) {
      console.error('[AchievementEngine] Load error:', error)
      return null
    }
  }
  
  /**
   * 保存到存储
   */
  async _saveToStorage() {
    try {
      const key = `achievements_${this.userId || 'default'}`
      const data = {
        unlocked: Array.from(this.userAchievements.unlocked),
        progress: this.userAchievements.progress,
        totalExp: this.userAchievements.totalExp,
        totalCoins: this.userAchievements.totalCoins,
        stats: { ...this.userStats }
      }
      uni.setStorageSync(key, JSON.stringify(data))
    } catch (error) {
      console.error('[AchievementEngine] Save error:', error)
    }
  }
  
  /**
   * 添加事件监听
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event).add(callback)
    return () => this.off(event, callback)
  }
  
  /**
   * 移除事件监听
   */
  off(event, callback) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).delete(callback)
    }
  }
  
  /**
   * 触发事件
   */
  _emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(cb => {
        try {
          cb(data)
        } catch (e) {
          console.error(`[AchievementEngine] Event handler error:`, e)
        }
      })
    }
  }
}

// 单例导出
export const achievementEngine = new AchievementEngine()

// 导出常量和类
export { ACHIEVEMENT_TYPE, RARITY, ACHIEVEMENTS, AchievementEngine }

// Vue组合式API Hook
export function useAchievements() {
  const achievements = computed(() => achievementEngine.getAllAchievements())
  const unlockedAchievements = computed(() => achievementEngine.getUnlockedAchievements())
  const overallStats = computed(() => achievementEngine.getOverallStats())
  
  return {
    achievements,
    unlockedAchievements,
    overallStats,
    init: (userId) => achievementEngine.init(userId),
    updateStats: (type, value, options) => achievementEngine.updateStats(type, value, options),
    getProgress: (id) => achievementEngine.getProgress(id),
    getByType: (type) => achievementEngine.getAchievementsByType(type),
    onUnlock: (callback) => achievementEngine.on('unlock', callback)
  }
}
