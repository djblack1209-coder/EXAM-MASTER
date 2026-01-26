/**
 * 打卡连续天数统计服务
 * 检查点4.4: 每日打卡 - 连续天数统计
 * 
 * 功能：
 * - 每日打卡记录
 * - 连续天数计算
 * - 打卡日历展示
 * - 打卡奖励计算
 * - 断签检测
 */

import { ref, reactive, computed } from 'vue'

// 打卡状态
const CHECKIN_STATUS = {
  NOT_CHECKED: 'not_checked',   // 未打卡
  CHECKED: 'checked',           // 已打卡
  MISSED: 'missed',             // 已断签
  RECOVERED: 'recovered'        // 已补签
}

// 奖励配置
const REWARD_CONFIG = {
  // 基础奖励
  base: { exp: 5, coins: 2 },
  // 连续奖励倍数
  streakMultiplier: {
    3: 1.5,    // 连续3天，1.5倍
    7: 2,      // 连续7天，2倍
    14: 2.5,   // 连续14天，2.5倍
    30: 3,     // 连续30天，3倍
    60: 4,     // 连续60天，4倍
    100: 5     // 连续100天，5倍
  },
  // 里程碑奖励
  milestones: {
    7: { exp: 50, coins: 30, badge: 'streak_7' },
    30: { exp: 200, coins: 100, badge: 'streak_30' },
    100: { exp: 1000, coins: 500, badge: 'streak_100' },
    365: { exp: 5000, coins: 2000, badge: 'streak_365' }
  }
}

class CheckinStreakService {
  constructor() {
    // 打卡数据
    this.data = reactive({
      currentStreak: 0,         // 当前连续天数
      longestStreak: 0,         // 最长连续天数
      totalCheckins: 0,         // 总打卡天数
      lastCheckinDate: null,    // 最后打卡日期
      checkinHistory: [],       // 打卡历史 [{date, status, reward}]
      todayChecked: false,      // 今日是否已打卡
      missedDays: 0,            // 断签天数
      recoveryCards: 0          // 补签卡数量
    })
    
    // 用户ID
    this.userId = null
    
    // 事件监听器
    this.listeners = new Map()
  }
  
  /**
   * 初始化
   */
  async init(userId) {
    this.userId = userId
    
    try {
      // 加载数据
      await this._loadData()
      
      // 检查今日状态
      this._checkTodayStatus()
      
      // 检查是否断签
      this._checkMissedDays()
      
      console.log('[CheckinStreak] Initialized:', {
        currentStreak: this.data.currentStreak,
        todayChecked: this.data.todayChecked
      })
      
    } catch (error) {
      console.error('[CheckinStreak] Init error:', error)
    }
  }
  
  /**
   * 执行打卡
   */
  async checkIn() {
    // 检查是否已打卡
    if (this.data.todayChecked) {
      return {
        success: false,
        message: '今日已打卡',
        data: this.getCheckinInfo()
      }
    }
    
    const today = this._getDateString(new Date())
    const yesterday = this._getDateString(this._getYesterday())
    
    // 检查是否连续
    const isConsecutive = this.data.lastCheckinDate === yesterday
    
    // 更新连续天数
    if (isConsecutive || !this.data.lastCheckinDate) {
      this.data.currentStreak += 1
    } else {
      // 断签了，重新开始
      this.data.currentStreak = 1
    }
    
    // 更新最长连续
    if (this.data.currentStreak > this.data.longestStreak) {
      this.data.longestStreak = this.data.currentStreak
    }
    
    // 计算奖励
    const reward = this._calculateReward()
    
    // 记录打卡
    const checkinRecord = {
      date: today,
      status: CHECKIN_STATUS.CHECKED,
      streak: this.data.currentStreak,
      reward
    }
    
    this.data.checkinHistory.push(checkinRecord)
    this.data.lastCheckinDate = today
    this.data.totalCheckins += 1
    this.data.todayChecked = true
    this.data.missedDays = 0
    
    // 检查里程碑
    const milestone = this._checkMilestone()
    
    // 保存数据
    await this._saveData()
    
    // 触发事件
    this._emit('checkin', {
      streak: this.data.currentStreak,
      reward,
      milestone
    })
    
    return {
      success: true,
      message: '打卡成功',
      data: {
        streak: this.data.currentStreak,
        reward,
        milestone,
        ...this.getCheckinInfo()
      }
    }
  }
  
  /**
   * 计算奖励
   */
  _calculateReward() {
    const { base, streakMultiplier } = REWARD_CONFIG
    
    // 获取倍数
    let multiplier = 1
    const streakDays = Object.keys(streakMultiplier)
      .map(Number)
      .sort((a, b) => b - a)
    
    for (const days of streakDays) {
      if (this.data.currentStreak >= days) {
        multiplier = streakMultiplier[days]
        break
      }
    }
    
    return {
      exp: Math.round(base.exp * multiplier),
      coins: Math.round(base.coins * multiplier),
      multiplier
    }
  }
  
  /**
   * 检查里程碑
   */
  _checkMilestone() {
    const { milestones } = REWARD_CONFIG
    const milestone = milestones[this.data.currentStreak]
    
    if (milestone) {
      this._emit('milestone', {
        days: this.data.currentStreak,
        reward: milestone
      })
      return milestone
    }
    
    return null
  }
  
  /**
   * 检查今日状态
   */
  _checkTodayStatus() {
    const today = this._getDateString(new Date())
    this.data.todayChecked = this.data.lastCheckinDate === today
  }
  
  /**
   * 检查断签天数
   */
  _checkMissedDays() {
    if (!this.data.lastCheckinDate) {
      this.data.missedDays = 0
      return
    }
    
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    const lastCheckin = new Date(this.data.lastCheckinDate)
    lastCheckin.setHours(0, 0, 0, 0)
    
    const diffTime = today.getTime() - lastCheckin.getTime()
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
    
    // 超过1天未打卡视为断签
    if (diffDays > 1) {
      this.data.missedDays = diffDays - 1
      
      // 触发断签事件
      this._emit('missed', {
        missedDays: this.data.missedDays,
        lastStreak: this.data.currentStreak
      })
    }
  }
  
  /**
   * 获取打卡信息
   */
  getCheckinInfo() {
    return {
      currentStreak: this.data.currentStreak,
      longestStreak: this.data.longestStreak,
      totalCheckins: this.data.totalCheckins,
      todayChecked: this.data.todayChecked,
      lastCheckinDate: this.data.lastCheckinDate,
      missedDays: this.data.missedDays,
      recoveryCards: this.data.recoveryCards,
      nextReward: this._calculateReward(),
      nextMilestone: this._getNextMilestone()
    }
  }
  
  /**
   * 获取下一个里程碑
   */
  _getNextMilestone() {
    const { milestones } = REWARD_CONFIG
    const milestoneDays = Object.keys(milestones).map(Number).sort((a, b) => a - b)
    
    for (const days of milestoneDays) {
      if (days > this.data.currentStreak) {
        return {
          days,
          remaining: days - this.data.currentStreak,
          reward: milestones[days]
        }
      }
    }
    
    return null
  }
  
  /**
   * 获取月度打卡日历
   */
  getMonthCalendar(year, month) {
    const calendar = []
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const today = this._getDateString(new Date())
    
    // 填充日历
    for (let day = 1; day <= lastDay.getDate(); day++) {
      const date = this._getDateString(new Date(year, month, day))
      const record = this.data.checkinHistory.find(r => r.date === date)
      
      calendar.push({
        date,
        day,
        status: record?.status || (date < today ? CHECKIN_STATUS.MISSED : CHECKIN_STATUS.NOT_CHECKED),
        isToday: date === today,
        isFuture: date > today,
        streak: record?.streak || 0
      })
    }
    
    return calendar
  }
  
  /**
   * 获取打卡统计
   */
  getStatistics() {
    const now = new Date()
    const thisMonth = this.data.checkinHistory.filter(r => {
      const date = new Date(r.date)
      return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear()
    })
    
    const thisWeek = this.data.checkinHistory.filter(r => {
      const date = new Date(r.date)
      const weekStart = new Date(now)
      weekStart.setDate(now.getDate() - now.getDay())
      weekStart.setHours(0, 0, 0, 0)
      return date >= weekStart
    })
    
    return {
      total: this.data.totalCheckins,
      thisMonth: thisMonth.length,
      thisWeek: thisWeek.length,
      currentStreak: this.data.currentStreak,
      longestStreak: this.data.longestStreak,
      averagePerWeek: this._calculateAveragePerWeek()
    }
  }
  
  /**
   * 计算周平均打卡
   */
  _calculateAveragePerWeek() {
    if (this.data.checkinHistory.length === 0) return 0
    
    const firstCheckin = new Date(this.data.checkinHistory[0].date)
    const now = new Date()
    const weeks = Math.max(1, Math.ceil((now - firstCheckin) / (7 * 24 * 60 * 60 * 1000)))
    
    return Math.round((this.data.totalCheckins / weeks) * 10) / 10
  }
  
  /**
   * 获取日期字符串
   */
  _getDateString(date) {
    return date.toISOString().split('T')[0]
  }
  
  /**
   * 获取昨天日期
   */
  _getYesterday() {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    return yesterday
  }
  
  /**
   * 加载数据
   */
  async _loadData() {
    try {
      const key = `checkin_${this.userId}`
      const saved = uni.getStorageSync(key)
      
      if (saved) {
        const data = JSON.parse(saved)
        Object.assign(this.data, data)
      }
    } catch (error) {
      console.error('[CheckinStreak] Load error:', error)
    }
  }
  
  /**
   * 保存数据
   */
  async _saveData() {
    try {
      const key = `checkin_${this.userId}`
      uni.setStorageSync(key, JSON.stringify({
        currentStreak: this.data.currentStreak,
        longestStreak: this.data.longestStreak,
        totalCheckins: this.data.totalCheckins,
        lastCheckinDate: this.data.lastCheckinDate,
        checkinHistory: this.data.checkinHistory.slice(-365), // 只保留一年
        recoveryCards: this.data.recoveryCards
      }))
    } catch (error) {
      console.error('[CheckinStreak] Save error:', error)
    }
  }
  
  /**
   * 添加补签卡
   */
  addRecoveryCards(count) {
    this.data.recoveryCards += count
    this._saveData()
  }
  
  /**
   * 获取补签卡数量
   */
  getRecoveryCards() {
    return this.data.recoveryCards
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
          console.error(`[CheckinStreak] Event handler error:`, e)
        }
      })
    }
  }
}

// 单例导出
export const checkinStreak = new CheckinStreakService()

// 导出类和常量
export { CheckinStreakService, CHECKIN_STATUS, REWARD_CONFIG }

// Vue组合式API Hook
export function useCheckinStreak() {
  const checkinInfo = computed(() => checkinStreak.getCheckinInfo())
  const statistics = computed(() => checkinStreak.getStatistics())
  
  return {
    checkinInfo,
    statistics,
    init: (userId) => checkinStreak.init(userId),
    checkIn: () => checkinStreak.checkIn(),
    getMonthCalendar: (year, month) => checkinStreak.getMonthCalendar(year, month),
    getRecoveryCards: () => checkinStreak.getRecoveryCards(),
    addRecoveryCards: (count) => checkinStreak.addRecoveryCards(count),
    onCheckin: (callback) => checkinStreak.on('checkin', callback),
    onMissed: (callback) => checkinStreak.on('missed', callback),
    onMilestone: (callback) => checkinStreak.on('milestone', callback)
  }
}
