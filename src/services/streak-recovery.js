/**
 * 断签补签卡逻辑服务
 * 检查点4.4: 每日打卡 - 补签卡系统
 * 
 * 功能：
 * - 补签卡获取与使用
 * - 断签恢复逻辑
 * - 补签限制规则
 * - 补签卡商城
 */

import { ref, reactive, computed } from 'vue'
import { checkinStreak, CHECKIN_STATUS } from './checkin-streak'

// 补签卡类型
const RECOVERY_CARD_TYPE = {
  NORMAL: 'normal',           // 普通补签卡（补1天）
  SUPER: 'super',             // 超级补签卡（补3天）
  ULTIMATE: 'ultimate'        // 终极补签卡（补7天）
}

// 补签卡配置
const RECOVERY_CARD_CONFIG = {
  [RECOVERY_CARD_TYPE.NORMAL]: {
    name: '普通补签卡',
    description: '可补签1天',
    days: 1,
    price: { coins: 50 },
    icon: '🎫'
  },
  [RECOVERY_CARD_TYPE.SUPER]: {
    name: '超级补签卡',
    description: '可补签3天',
    days: 3,
    price: { coins: 120 },
    icon: '🎟️'
  },
  [RECOVERY_CARD_TYPE.ULTIMATE]: {
    name: '终极补签卡',
    description: '可补签7天',
    days: 7,
    price: { coins: 250 },
    icon: '🏆'
  }
}

// 补签规则
const RECOVERY_RULES = {
  maxRecoveryDays: 7,           // 最多可补签天数
  recoveryWindowDays: 30,       // 补签时间窗口（30天内的断签可补）
  dailyRecoveryLimit: 3,        // 每日补签次数限制
  freeRecoveryPerMonth: 1       // 每月免费补签次数
}

// 补签卡获取途径
const CARD_SOURCES = {
  PURCHASE: 'purchase',         // 购买
  STREAK_REWARD: 'streak',      // 连续打卡奖励
  ACTIVITY: 'activity',         // 活动获得
  INVITE: 'invite',             // 邀请好友
  AD: 'ad'                      // 看广告
}

class StreakRecoveryService {
  constructor() {
    // 补签卡库存
    this.inventory = reactive({
      [RECOVERY_CARD_TYPE.NORMAL]: 0,
      [RECOVERY_CARD_TYPE.SUPER]: 0,
      [RECOVERY_CARD_TYPE.ULTIMATE]: 0
    })
    
    // 补签记录
    this.recoveryHistory = reactive([])
    
    // 今日补签次数
    this.todayRecoveryCount = ref(0)
    
    // 本月免费补签次数
    this.monthlyFreeRecovery = ref(RECOVERY_RULES.freeRecoveryPerMonth)
    
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
      await this._loadData()
      this._checkMonthlyReset()
      this._checkDailyReset()
      
      console.log('[StreakRecovery] Initialized:', {
        inventory: { ...this.inventory },
        monthlyFree: this.monthlyFreeRecovery.value
      })
      
    } catch (error) {
      console.error('[StreakRecovery] Init error:', error)
    }
  }
  
  /**
   * 检查是否可以补签
   * @param {string} date - 要补签的日期 (YYYY-MM-DD)
   */
  canRecover(date) {
    const result = {
      canRecover: false,
      reason: '',
      options: []
    }
    
    // 检查日期是否在补签窗口内
    const targetDate = new Date(date)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    const diffDays = Math.floor((today - targetDate) / (1000 * 60 * 60 * 24))
    
    if (diffDays <= 0) {
      result.reason = '不能补签今天或未来的日期'
      return result
    }
    
    if (diffDays > RECOVERY_RULES.recoveryWindowDays) {
      result.reason = `只能补签${RECOVERY_RULES.recoveryWindowDays}天内的断签`
      return result
    }
    
    // 检查是否已经打卡
    const checkinInfo = checkinStreak.getCheckinInfo()
    const history = checkinStreak.data.checkinHistory
    const existingRecord = history.find(r => r.date === date)
    
    if (existingRecord && existingRecord.status !== CHECKIN_STATUS.MISSED) {
      result.reason = '该日期已打卡或已补签'
      return result
    }
    
    // 检查今日补签次数
    if (this.todayRecoveryCount.value >= RECOVERY_RULES.dailyRecoveryLimit) {
      result.reason = `今日补签次数已达上限(${RECOVERY_RULES.dailyRecoveryLimit}次)`
      return result
    }
    
    // 检查可用的补签方式
    const options = []
    
    // 免费补签
    if (this.monthlyFreeRecovery.value > 0 && diffDays === 1) {
      options.push({
        type: 'free',
        name: '免费补签',
        description: `本月剩余${this.monthlyFreeRecovery.value}次`,
        available: true
      })
    }
    
    // 补签卡
    for (const [type, config] of Object.entries(RECOVERY_CARD_CONFIG)) {
      if (this.inventory[type] > 0 && config.days >= diffDays) {
        options.push({
          type: 'card',
          cardType: type,
          name: config.name,
          description: `剩余${this.inventory[type]}张`,
          available: true
        })
      }
    }
    
    // 购买补签卡
    options.push({
      type: 'purchase',
      name: '购买补签卡',
      description: '前往商城购买',
      available: true
    })
    
    if (options.length > 0) {
      result.canRecover = true
      result.options = options
    } else {
      result.reason = '没有可用的补签方式'
    }
    
    return result
  }
  
  /**
   * 执行补签
   * @param {string} date - 要补签的日期
   * @param {Object} method - 补签方式 { type: 'free' | 'card', cardType?: string }
   */
  async recover(date, method) {
    // 检查是否可以补签
    const checkResult = this.canRecover(date)
    if (!checkResult.canRecover) {
      return {
        success: false,
        message: checkResult.reason
      }
    }
    
    try {
      let usedMethod = null
      
      if (method.type === 'free') {
        // 使用免费补签
        if (this.monthlyFreeRecovery.value <= 0) {
          return { success: false, message: '本月免费补签次数已用完' }
        }
        this.monthlyFreeRecovery.value -= 1
        usedMethod = { type: 'free' }
        
      } else if (method.type === 'card') {
        // 使用补签卡
        const cardType = method.cardType
        if (!this.inventory[cardType] || this.inventory[cardType] <= 0) {
          return { success: false, message: '补签卡不足' }
        }
        this.inventory[cardType] -= 1
        usedMethod = { type: 'card', cardType }
      }
      
      // 执行补签
      await this._doRecover(date, usedMethod)
      
      // 更新今日补签次数
      this.todayRecoveryCount.value += 1
      
      // 保存数据
      await this._saveData()
      
      // 触发事件
      this._emit('recovered', {
        date,
        method: usedMethod,
        newStreak: checkinStreak.data.currentStreak
      })
      
      return {
        success: true,
        message: '补签成功',
        data: {
          date,
          method: usedMethod,
          streak: checkinStreak.data.currentStreak
        }
      }
      
    } catch (error) {
      console.error('[StreakRecovery] Recover error:', error)
      return {
        success: false,
        message: error.message || '补签失败'
      }
    }
  }
  
  /**
   * 执行补签操作
   */
  async _doRecover(date, method) {
    // 添加补签记录到打卡历史
    const record = {
      date,
      status: CHECKIN_STATUS.RECOVERED,
      streak: 0, // 补签不增加连续天数显示
      recoveredAt: new Date().toISOString(),
      method
    }
    
    // 插入到正确的位置
    const history = checkinStreak.data.checkinHistory
    const insertIndex = history.findIndex(r => r.date > date)
    
    if (insertIndex === -1) {
      history.push(record)
    } else {
      history.splice(insertIndex, 0, record)
    }
    
    // 重新计算连续天数
    this._recalculateStreak()
    
    // 记录补签历史
    this.recoveryHistory.push({
      date,
      recoveredAt: new Date().toISOString(),
      method
    })
  }
  
  /**
   * 重新计算连续天数
   */
  _recalculateStreak() {
    const history = checkinStreak.data.checkinHistory
    if (history.length === 0) {
      checkinStreak.data.currentStreak = 0
      return
    }
    
    // 从今天往前数连续天数
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    let streak = 0
    let currentDate = new Date(today)
    
    while (true) {
      const dateStr = this._getDateString(currentDate)
      const record = history.find(r => r.date === dateStr)
      
      if (record && (record.status === CHECKIN_STATUS.CHECKED || record.status === CHECKIN_STATUS.RECOVERED)) {
        streak++
        currentDate.setDate(currentDate.getDate() - 1)
      } else {
        break
      }
    }
    
    checkinStreak.data.currentStreak = streak
    
    // 更新最长连续
    if (streak > checkinStreak.data.longestStreak) {
      checkinStreak.data.longestStreak = streak
    }
  }
  
  /**
   * 获取补签卡库存
   */
  getInventory() {
    return {
      ...this.inventory,
      monthlyFreeRemaining: this.monthlyFreeRecovery.value,
      todayRecoveryRemaining: RECOVERY_RULES.dailyRecoveryLimit - this.todayRecoveryCount.value
    }
  }
  
  /**
   * 添加补签卡
   */
  addCard(cardType, count = 1, source = CARD_SOURCES.PURCHASE) {
    if (!RECOVERY_CARD_CONFIG[cardType]) {
      console.error('[StreakRecovery] Invalid card type:', cardType)
      return false
    }
    
    this.inventory[cardType] += count
    
    this._emit('cardAdded', {
      cardType,
      count,
      source,
      newTotal: this.inventory[cardType]
    })
    
    this._saveData()
    return true
  }
  
  /**
   * 购买补签卡
   */
  async purchaseCard(cardType, quantity = 1) {
    const config = RECOVERY_CARD_CONFIG[cardType]
    if (!config) {
      return { success: false, message: '无效的补签卡类型' }
    }
    
    const totalPrice = config.price.coins * quantity
    
    // NOTE: 金币系统暂未实现，当前跳过余额检查直接发放补签卡
    // 后续接入金币系统时取消下方注释：
    // const userCoins = await getUserCoins()
    // if (userCoins < totalPrice) {
    //   return { success: false, message: '金币不足' }
    // }
    // await deductCoins(totalPrice)
    
    // 当前降级方案：直接添加补签卡（测试阶段免费）
    this.addCard(cardType, quantity, CARD_SOURCES.PURCHASE)
    
    return {
      success: true,
      message: `成功购买${quantity}张${config.name}`,
      data: {
        cardType,
        quantity,
        totalPrice,
        newTotal: this.inventory[cardType]
      }
    }
  }
  
  /**
   * 获取补签卡商城列表
   */
  getShopList() {
    return Object.entries(RECOVERY_CARD_CONFIG).map(([type, config]) => ({
      type,
      ...config,
      owned: this.inventory[type]
    }))
  }
  
  /**
   * 获取可补签的日期列表
   */
  getRecoverableDates() {
    const dates = []
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    const history = checkinStreak.data.checkinHistory
    
    for (let i = 1; i <= RECOVERY_RULES.recoveryWindowDays; i++) {
      const date = new Date(today)
      date.setDate(date.getDate() - i)
      const dateStr = this._getDateString(date)
      
      const record = history.find(r => r.date === dateStr)
      
      if (!record || record.status === CHECKIN_STATUS.MISSED) {
        const checkResult = this.canRecover(dateStr)
        dates.push({
          date: dateStr,
          daysAgo: i,
          canRecover: checkResult.canRecover,
          options: checkResult.options,
          reason: checkResult.reason
        })
      }
    }
    
    return dates
  }
  
  /**
   * 检查月度重置
   */
  _checkMonthlyReset() {
    const now = new Date()
    const lastReset = uni.getStorageSync(`recovery_monthly_reset_${this.userId}`)
    
    if (lastReset) {
      const lastResetDate = new Date(lastReset)
      if (lastResetDate.getMonth() !== now.getMonth() || lastResetDate.getFullYear() !== now.getFullYear()) {
        // 新的月份，重置免费次数
        this.monthlyFreeRecovery.value = RECOVERY_RULES.freeRecoveryPerMonth
        uni.setStorageSync(`recovery_monthly_reset_${this.userId}`, now.toISOString())
      }
    } else {
      uni.setStorageSync(`recovery_monthly_reset_${this.userId}`, now.toISOString())
    }
  }
  
  /**
   * 检查每日重置
   */
  _checkDailyReset() {
    const now = new Date()
    const today = this._getDateString(now)
    const lastReset = uni.getStorageSync(`recovery_daily_reset_${this.userId}`)
    
    if (lastReset !== today) {
      this.todayRecoveryCount.value = 0
      uni.setStorageSync(`recovery_daily_reset_${this.userId}`, today)
    }
  }
  
  /**
   * 获取日期字符串
   */
  _getDateString(date) {
    return date.toISOString().split('T')[0]
  }
  
  /**
   * 加载数据
   */
  async _loadData() {
    try {
      const key = `recovery_${this.userId}`
      const saved = uni.getStorageSync(key)
      
      if (saved) {
        const data = JSON.parse(saved)
        Object.assign(this.inventory, data.inventory || {})
        this.recoveryHistory.splice(0, this.recoveryHistory.length, ...(data.history || []))
        this.monthlyFreeRecovery.value = data.monthlyFree ?? RECOVERY_RULES.freeRecoveryPerMonth
        this.todayRecoveryCount.value = data.todayCount || 0
      }
    } catch (error) {
      console.error('[StreakRecovery] Load error:', error)
    }
  }
  
  /**
   * 保存数据
   */
  async _saveData() {
    try {
      const key = `recovery_${this.userId}`
      uni.setStorageSync(key, JSON.stringify({
        inventory: { ...this.inventory },
        history: this.recoveryHistory.slice(-100),
        monthlyFree: this.monthlyFreeRecovery.value,
        todayCount: this.todayRecoveryCount.value
      }))
    } catch (error) {
      console.error('[StreakRecovery] Save error:', error)
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
          console.error(`[StreakRecovery] Event handler error:`, e)
        }
      })
    }
  }
}

// 单例导出
export const streakRecovery = new StreakRecoveryService()

// 导出类和常量
export { 
  StreakRecoveryService, 
  RECOVERY_CARD_TYPE, 
  RECOVERY_CARD_CONFIG, 
  RECOVERY_RULES,
  CARD_SOURCES 
}

// Vue组合式API Hook
export function useStreakRecovery() {
  const inventory = computed(() => streakRecovery.getInventory())
  const shopList = computed(() => streakRecovery.getShopList())
  const recoverableDates = computed(() => streakRecovery.getRecoverableDates())
  
  return {
    inventory,
    shopList,
    recoverableDates,
    init: (userId) => streakRecovery.init(userId),
    canRecover: (date) => streakRecovery.canRecover(date),
    recover: (date, method) => streakRecovery.recover(date, method),
    purchaseCard: (type, qty) => streakRecovery.purchaseCard(type, qty),
    addCard: (type, count, source) => streakRecovery.addCard(type, count, source),
    onRecovered: (callback) => streakRecovery.on('recovered', callback),
    onCardAdded: (callback) => streakRecovery.on('cardAdded', callback)
  }
}
