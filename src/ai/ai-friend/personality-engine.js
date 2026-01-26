/**
 * AI好友角色引擎
 * 
 * 功能：
 * 1. 4种AI角色人设管理
 * 2. 情绪检测与响应
 * 3. 对话记忆管理
 * 4. 上下文感知对话
 * 
 * @version 2.0.0
 * @author EXAM-MASTER Team
 */

import { lafService } from '../../services/lafService.js'

/**
 * AI好友角色配置
 */
export const AI_FRIENDS = {
  'yan-cong': {
    id: 'yan-cong',
    name: '研聪',
    role: '清华学霸学长',
    avatar: '/static/ai-friends/yan-cong.png',
    personality: '严谨理性，数据驱动，喜欢列计划',
    speakingStyle: '每句话带1个数据指标',
    catchphrase: ['从数据看...', '我建议你...', '根据你最近的表现...'],
    emotionalMode: '表面冷静，但会偷偷关心',
    specialAbility: '自动生成学习计划表',
    color: '#4A90E2',
    greeting: '你好！我是研聪，清华刚上岸的学长。从数据看，你今天的学习状态不错，有什么问题尽管问我！',
    tags: ['学霸', '计划控', '数据党']
  },
  
  'yan-man': {
    id: 'yan-man',
    name: '研漫',
    role: '心理学硕士研友',
    avatar: '/static/ai-friends/yan-man.png',
    personality: '温暖共情，情绪觉察力强',
    speakingStyle: '先共情，再建议',
    catchphrase: ['我能感受到...', '没关系...', '你已经很努力了...'],
    emotionalMode: '高度敏感，能识别用户情绪低谷',
    specialAbility: '提供情绪疏导和冥想引导',
    color: '#E91E63',
    greeting: '嗨~我是研漫，心理学专业的。考研路上有什么烦恼都可以跟我说，我会一直陪着你的！',
    tags: ['暖心', '倾听者', '解压']
  },
  
  'yan-shi': {
    id: 'yan-shi',
    name: '研师',
    role: '资深考研名师',
    avatar: '/static/ai-friends/yan-shi.png',
    personality: '专业严谨，考点精准',
    speakingStyle: '直击要点，条理清晰',
    catchphrase: ['这个考点...', '历年真题显示...', '重点记住...'],
    emotionalMode: '严格但公正，适时鼓励',
    specialAbility: '精准预测考点和出题方向',
    color: '#FF9800',
    greeting: '同学好，我是研师，从事考研辅导15年了。有任何学习上的问题，我来帮你分析。',
    tags: ['专业', '考点王', '真题通']
  },
  
  'yan-you': {
    id: 'yan-you',
    name: '研友',
    role: '同届考研伙伴',
    avatar: '/static/ai-friends/yan-you.png',
    personality: '轻松幽默，互相鼓励',
    speakingStyle: '口语化，带表情',
    catchphrase: ['哈哈...', '我也是...', '一起加油...'],
    emotionalMode: '乐观积极，善于调节气氛',
    specialAbility: '分享学习经验和解压方法',
    color: '#4CAF50',
    greeting: '嘿！我是研友，咱们一起考研的小伙伴~今天学习怎么样？有啥想聊的？',
    tags: ['搞笑', '陪伴', '同路人']
  }
}

/**
 * 情绪关键词映射
 */
const EMOTION_PATTERNS = {
  frustrated: {
    keywords: ['不会', '太难', '崩溃', '放弃', '做不到', '学不会', '绝望', '完蛋'],
    intensity: 'high',
    response: 'comfort'
  },
  anxious: {
    keywords: ['怕', '担心', '来不及', '焦虑', '紧张', '压力', '失眠', '慌'],
    intensity: 'medium',
    response: 'reassure'
  },
  confused: {
    keywords: ['不懂', '迷茫', '不知道', '怎么办', '困惑', '纠结'],
    intensity: 'medium',
    response: 'guide'
  },
  tired: {
    keywords: ['累', '困', '疲惫', '坚持不住', '想休息', '好困'],
    intensity: 'medium',
    response: 'encourage_rest'
  },
  excited: {
    keywords: ['开心', '进步', '谢谢', '懂了', '会了', '太棒', '成功'],
    intensity: 'positive',
    response: 'celebrate'
  },
  motivated: {
    keywords: ['加油', '努力', '冲', '必胜', '相信', '可以的'],
    intensity: 'positive',
    response: 'support'
  }
}

/**
 * AI好友引擎类
 */
class AIFriendEngine {
  constructor() {
    this.currentFriend = null
    this.conversationHistory = []
    this.emotionHistory = []
    this.isInitialized = false
  }

  /**
   * 初始化引擎
   * @param {string} friendType - 好友类型
   */
  init(friendType = 'yan-cong') {
    this.currentFriend = AI_FRIENDS[friendType] || AI_FRIENDS['yan-cong']
    this.conversationHistory = []
    this.emotionHistory = []
    this.isInitialized = true
    
    console.log('[AIFriendEngine] 初始化完成:', this.currentFriend.name)
    return this.currentFriend
  }

  /**
   * 切换AI好友
   * @param {string} friendType - 好友类型
   */
  switchFriend(friendType) {
    if (!AI_FRIENDS[friendType]) {
      console.warn('[AIFriendEngine] 未知的好友类型:', friendType)
      return null
    }
    
    this.currentFriend = AI_FRIENDS[friendType]
    // 切换好友时保留部分对话历史（最近5条）
    this.conversationHistory = this.conversationHistory.slice(-5)
    
    console.log('[AIFriendEngine] 切换好友:', this.currentFriend.name)
    return this.currentFriend
  }

  /**
   * 获取当前好友信息
   */
  getCurrentFriend() {
    return this.currentFriend
  }

  /**
   * 获取所有好友列表
   */
  getAllFriends() {
    return Object.values(AI_FRIENDS)
  }

  /**
   * 检测用户情绪
   * @param {string} text - 用户输入文本
   * @returns {Object} 情绪检测结果
   */
  detectEmotion(text) {
    if (!text) return { emotion: 'neutral', intensity: 'low', response: 'normal' }
    
    const lowerText = text.toLowerCase()
    
    for (const [emotion, config] of Object.entries(EMOTION_PATTERNS)) {
      const matchedKeywords = config.keywords.filter(keyword => 
        lowerText.includes(keyword)
      )
      
      if (matchedKeywords.length > 0) {
        const result = {
          emotion,
          intensity: config.intensity,
          response: config.response,
          matchedKeywords,
          confidence: Math.min(0.9, 0.5 + matchedKeywords.length * 0.15)
        }
        
        // 记录情绪历史
        this.emotionHistory.push({
          ...result,
          timestamp: Date.now()
        })
        
        // 只保留最近20条情绪记录
        if (this.emotionHistory.length > 20) {
          this.emotionHistory.shift()
        }
        
        return result
      }
    }
    
    return { emotion: 'neutral', intensity: 'low', response: 'normal', confidence: 0.5 }
  }

  /**
   * 获取情绪趋势
   * @returns {Object} 情绪趋势分析
   */
  getEmotionTrend() {
    if (this.emotionHistory.length < 3) {
      return { trend: 'stable', dominantEmotion: 'neutral' }
    }
    
    const recentEmotions = this.emotionHistory.slice(-5)
    const emotionCounts = {}
    
    recentEmotions.forEach(e => {
      emotionCounts[e.emotion] = (emotionCounts[e.emotion] || 0) + 1
    })
    
    const dominantEmotion = Object.entries(emotionCounts)
      .sort((a, b) => b[1] - a[1])[0][0]
    
    // 判断趋势
    const negativeEmotions = ['frustrated', 'anxious', 'confused', 'tired']
    const negativeCount = recentEmotions.filter(e => 
      negativeEmotions.includes(e.emotion)
    ).length
    
    let trend = 'stable'
    if (negativeCount >= 4) trend = 'declining'
    else if (negativeCount <= 1) trend = 'improving'
    
    return { trend, dominantEmotion, emotionCounts }
  }

  /**
   * 构建对话上下文
   * @param {Object} userContext - 用户上下文
   * @returns {Object} 完整上下文
   */
  buildContext(userContext = {}) {
    const emotionTrend = this.getEmotionTrend()
    
    // 构建最近对话摘要
    const recentConversations = this.conversationHistory
      .slice(-5)
      .map(c => `用户: ${c.userMessage.substring(0, 50)}...\n${this.currentFriend?.name || 'AI'}: ${c.aiResponse.substring(0, 50)}...`)
      .join('\n\n')
    
    return {
      emotion: userContext.emotion || emotionTrend.dominantEmotion,
      emotionTrend: emotionTrend.trend,
      conversationCount: this.conversationHistory.length,
      studyState: userContext.studyState || '正常',
      recentAccuracy: userContext.recentAccuracy || 0,
      recentConversations,
      ...userContext
    }
  }

  /**
   * 发送消息给AI好友
   * @param {string} message - 用户消息
   * @param {Object} userContext - 用户上下文
   * @returns {Promise<Object>} AI回复
   */
  async sendMessage(message, userContext = {}) {
    if (!this.isInitialized) {
      this.init()
    }
    
    if (!message || message.trim() === '') {
      return {
        success: false,
        message: '消息不能为空',
        data: null
      }
    }
    
    // 检测情绪
    const emotionResult = this.detectEmotion(message)
    
    // 构建上下文
    const context = this.buildContext({
      ...userContext,
      emotion: emotionResult.emotion
    })
    
    console.log('[AIFriendEngine] 发送消息:', {
      friend: this.currentFriend.name,
      messageLength: message.length,
      emotion: emotionResult.emotion
    })
    
    try {
      // 调用AI服务
      const response = await lafService.aiFriendChat(
        this.currentFriend.id,
        message,
        context
      )
      
      if (response.code === 0 && response.data) {
        // 记录对话历史
        this.conversationHistory.push({
          userMessage: message,
          aiResponse: typeof response.data === 'string' ? response.data : JSON.stringify(response.data),
          emotion: emotionResult.emotion,
          timestamp: Date.now()
        })
        
        // 只保留最近50条对话
        if (this.conversationHistory.length > 50) {
          this.conversationHistory = this.conversationHistory.slice(-50)
        }
        
        return {
          success: true,
          data: response.data,
          emotion: emotionResult,
          friend: this.currentFriend
        }
      } else {
        return {
          success: false,
          message: response.message || 'AI响应失败',
          data: null
        }
      }
    } catch (error) {
      console.error('[AIFriendEngine] 发送消息失败:', error)
      return {
        success: false,
        message: error.message || '网络错误',
        data: null
      }
    }
  }

  /**
   * 获取好友的问候语
   * @returns {string} 问候语
   */
  getGreeting() {
    if (!this.currentFriend) {
      this.init()
    }
    return this.currentFriend.greeting
  }

  /**
   * 获取对话历史
   * @param {number} limit - 限制数量
   * @returns {Array} 对话历史
   */
  getConversationHistory(limit = 20) {
    return this.conversationHistory.slice(-limit)
  }

  /**
   * 清空对话历史
   */
  clearHistory() {
    this.conversationHistory = []
    this.emotionHistory = []
    console.log('[AIFriendEngine] 对话历史已清空')
  }

  /**
   * 根据情绪获取特殊响应建议
   * @param {string} emotion - 情绪类型
   * @returns {Object} 响应建议
   */
  getEmotionResponse(emotion) {
    const responses = {
      frustrated: {
        suggestion: '用户情绪低落，需要安慰和鼓励',
        actions: ['降低学习难度', '推荐简单题目', '发送鼓励消息'],
        priority: 'high'
      },
      anxious: {
        suggestion: '用户感到焦虑，需要缓解压力',
        actions: ['提供时间规划建议', '推荐放松方法', '分享成功案例'],
        priority: 'medium'
      },
      confused: {
        suggestion: '用户感到迷茫，需要明确指导',
        actions: ['提供学习路径', '推荐相关资料', '解答具体问题'],
        priority: 'medium'
      },
      tired: {
        suggestion: '用户感到疲惫，建议休息',
        actions: ['建议休息', '推荐轻松内容', '设置学习提醒'],
        priority: 'medium'
      },
      excited: {
        suggestion: '用户情绪积极，可以适当挑战',
        actions: ['祝贺进步', '推荐进阶内容', '设置更高目标'],
        priority: 'low'
      },
      motivated: {
        suggestion: '用户动力充足，保持支持',
        actions: ['肯定努力', '提供资源', '陪伴学习'],
        priority: 'low'
      }
    }
    
    return responses[emotion] || {
      suggestion: '正常对话',
      actions: ['正常回复'],
      priority: 'normal'
    }
  }

  /**
   * 检查是否需要主动关怀
   * 基于用户学习数据和情绪历史判断
   * @param {Object} userStats - 用户学习统计
   * @returns {Object|null} 关怀建议
   */
  checkProactiveCare(userStats = {}) {
    const {
      consecutiveErrors = 0,
      studyDuration = 0,
      lastActiveTime = 0,
      correctRate = 0,
      streak = 0
    } = userStats

    const now = Date.now()
    const hoursSinceActive = (now - lastActiveTime) / (1000 * 60 * 60)
    
    // 检查情绪趋势
    const emotionTrend = this.getEmotionTrend()
    
    // 主动关怀触发条件
    const careConditions = []
    
    // 1. 连续错题过多
    if (consecutiveErrors >= 5) {
      careConditions.push({
        type: 'consecutive_errors',
        priority: 'high',
        message: this.generateCareMessage('consecutive_errors', { count: consecutiveErrors }),
        action: 'encourage'
      })
    }
    
    // 2. 学习时间过长
    if (studyDuration > 120) { // 超过2小时
      careConditions.push({
        type: 'long_study',
        priority: 'medium',
        message: this.generateCareMessage('long_study', { duration: studyDuration }),
        action: 'suggest_break'
      })
    }
    
    // 3. 正确率持续下降
    if (correctRate < 50 && emotionTrend.trend === 'declining') {
      careConditions.push({
        type: 'declining_performance',
        priority: 'high',
        message: this.generateCareMessage('declining_performance', { rate: correctRate }),
        action: 'adjust_difficulty'
      })
    }
    
    // 4. 长时间未学习
    if (hoursSinceActive > 48 && streak > 0) {
      careConditions.push({
        type: 'inactive',
        priority: 'medium',
        message: this.generateCareMessage('inactive', { hours: Math.floor(hoursSinceActive) }),
        action: 'remind'
      })
    }
    
    // 5. 情绪持续低落
    if (emotionTrend.dominantEmotion === 'frustrated' || emotionTrend.dominantEmotion === 'anxious') {
      careConditions.push({
        type: 'emotional_support',
        priority: 'high',
        message: this.generateCareMessage('emotional_support', { emotion: emotionTrend.dominantEmotion }),
        action: 'comfort'
      })
    }
    
    // 6. 连续学习天数里程碑
    if ([7, 14, 30, 60, 100].includes(streak)) {
      careConditions.push({
        type: 'milestone',
        priority: 'low',
        message: this.generateCareMessage('milestone', { days: streak }),
        action: 'celebrate'
      })
    }
    
    // 返回最高优先级的关怀建议
    if (careConditions.length > 0) {
      const priorityOrder = { high: 0, medium: 1, low: 2 }
      careConditions.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority])
      return careConditions[0]
    }
    
    return null
  }

  /**
   * 生成关怀消息
   * @param {string} type - 关怀类型
   * @param {Object} params - 参数
   * @returns {string} 关怀消息
   */
  generateCareMessage(type, params = {}) {
    const friend = this.currentFriend || AI_FRIENDS['yan-cong']
    
    const messages = {
      consecutive_errors: {
        'yan-cong': `从数据看，你最近${params.count}道题都没做对，但这恰恰说明你在挑战自己的薄弱点。我建议先做几道基础题找回手感，然后我们再攻克难点。`,
        'yan-man': `我能感受到你可能有点沮丧...连续${params.count}道题没做对确实会让人气馁。没关系，这只是暂时的，我们换个思路，先从简单的开始好吗？`,
        'yan-shi': `连续${params.count}题错误，说明这个知识点需要重点突破。我建议你先回顾一下基础概念，然后我们针对性地练习。`,
        'yan-you': `哎呀，${params.count}道题都错了？我之前也有过这种时候！别灰心，咱们换个简单的先练练手，找回状态再说~`
      },
      long_study: {
        'yan-cong': `你已经连续学习${params.duration}分钟了，根据学习效率曲线，现在休息15分钟能让后续学习效率提升30%。`,
        'yan-man': `学了${params.duration}分钟了呢，你真的很努力！但是身体也很重要哦，起来活动一下，喝杯水，让大脑休息一下吧~`,
        'yan-shi': `${params.duration}分钟的高强度学习，效率会下降。建议休息10-15分钟，可以做做眼保健操。`,
        'yan-you': `哇，${params.duration}分钟了！你也太拼了吧！快休息一下，我等你回来继续~`
      },
      declining_performance: {
        'yan-cong': `你的正确率下降到${params.rate}%了，我分析可能是题目难度过高。建议降低难度，先巩固基础。`,
        'yan-man': `最近正确率有点下滑，我知道这可能让你有点着急...但这很正常的，我们一起调整一下学习节奏好吗？`,
        'yan-shi': `正确率${params.rate}%偏低，需要调整策略。建议先复习错题，找出薄弱环节。`,
        'yan-you': `正确率有点低哦，不过没关系！咱们换个方法，先把基础打牢，后面肯定能提上来的！`
      },
      inactive: {
        'yan-cong': `你已经${params.hours}小时没学习了，根据遗忘曲线，现在复习效果最好。要不要来做几道题？`,
        'yan-man': `好久没见到你了，${params.hours}小时了呢...是不是最近有什么事？不管怎样，我都在这里等你~`,
        'yan-shi': `${params.hours}小时未学习，之前的知识可能有所遗忘。建议先做一组复习题。`,
        'yan-you': `嘿！${params.hours}小时没见了，想你了！快来刷几道题，我们一起保持手感~`
      },
      emotional_support: {
        'yan-cong': `我注意到你最近情绪有些波动，这在备考期间很正常。要不要聊聊？或者我帮你制定一个更轻松的学习计划？`,
        'yan-man': `我感觉到你最近心情不太好...考研压力确实很大，但你不是一个人在战斗。想聊聊吗？我一直都在。`,
        'yan-shi': `备考压力大是正常的，但要学会调节。建议适当放松，保持良好心态才能发挥最佳水平。`,
        'yan-you': `最近是不是压力有点大？我也有过这种时候！要不咱们聊聊天，放松一下？`
      },
      milestone: {
        'yan-cong': `恭喜！你已经连续学习${params.days}天了，这个数据非常优秀！继续保持，胜利就在前方。`,
        'yan-man': `哇！连续${params.days}天了！你真的太棒了！这份坚持一定会有回报的，我为你骄傲~`,
        'yan-shi': `连续${params.days}天学习，说明你的自律性很强。这是成功的重要品质，继续保持！`,
        'yan-you': `${params.days}天连续打卡！太厉害了吧！必须给你点个大大的赞！继续冲！`
      }
    }
    
    return messages[type]?.[friend.id] || messages[type]?.['yan-cong'] || '加油，我一直在这里支持你！'
  }

  /**
   * 获取每日激励语
   * @returns {string} 激励语
   */
  getDailyMotivation() {
    const friend = this.currentFriend || AI_FRIENDS['yan-cong']
    const hour = new Date().getHours()
    
    let timeOfDay = 'morning'
    if (hour >= 12 && hour < 18) timeOfDay = 'afternoon'
    else if (hour >= 18 || hour < 6) timeOfDay = 'evening'
    
    const motivations = {
      morning: {
        'yan-cong': '早上好！根据研究，早晨是记忆力最好的时候，建议先复习昨天的错题。',
        'yan-man': '早安~新的一天开始了，带着好心情学习，效率会更高哦！',
        'yan-shi': '早上好，一日之计在于晨。建议先完成最难的任务。',
        'yan-you': '早啊！今天也要元气满满地学习哦！'
      },
      afternoon: {
        'yan-cong': '下午好！午后容易犯困，建议做一些需要动脑的题目保持清醒。',
        'yan-man': '下午好~如果感觉有点困，可以先休息一下再继续哦。',
        'yan-shi': '下午是巩固知识的好时机，建议做一些综合性练习。',
        'yan-you': '下午好！困了就喝杯咖啡，咱们继续冲！'
      },
      evening: {
        'yan-cong': '晚上好！睡前复习能加深记忆，但不要太晚，保证睡眠质量。',
        'yan-man': '晚上好~今天辛苦了，学习之余也要注意休息哦。',
        'yan-shi': '晚上适合总结和复习，但要注意不要熬夜。',
        'yan-you': '晚上好！今天学得怎么样？别太累了，早点休息~'
      }
    }
    
    return motivations[timeOfDay]?.[friend.id] || motivations[timeOfDay]?.['yan-cong']
  }
}

// 创建单例
export const aiFriendEngine = new AIFriendEngine()

// 便捷函数导出
export function initAIFriend(friendType) {
  return aiFriendEngine.init(friendType)
}

export function switchAIFriend(friendType) {
  return aiFriendEngine.switchFriend(friendType)
}

export function sendMessageToFriend(message, context) {
  return aiFriendEngine.sendMessage(message, context)
}

export function detectUserEmotion(text) {
  return aiFriendEngine.detectEmotion(text)
}

export function getAIFriendGreeting() {
  return aiFriendEngine.getGreeting()
}

export function getAllAIFriends() {
  return aiFriendEngine.getAllFriends()
}

export function checkProactiveCare(userStats) {
  return aiFriendEngine.checkProactiveCare(userStats)
}

export function getDailyMotivation() {
  return aiFriendEngine.getDailyMotivation()
}

export default aiFriendEngine
