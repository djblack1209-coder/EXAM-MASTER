/**
 * 用户状态管理模块
 * 检查点4.3: 学习成就系统 - 成就解锁集成
 * 
 * 功能：
 * - 用户信息管理
 * - 成就系统集成
 * - 成就解锁触发
 */

import { achievementEngine, useAchievements } from '../../services/achievement-engine.js'
import { badgeAnimator } from '../../services/badge-animator.js'

// 初始状态
const state = {
  userInfo: null,
  isLoggedIn: false,
  // 成就相关
  achievements: [],
  unlockedAchievements: [],
  achievementStats: {
    total: 0,
    unlocked: 0,
    percentage: 0,
    totalExp: 0,
    totalCoins: 0
  }
}

// Getters
const getters = {
  userInfo: (state) => state.userInfo,
  isLoggedIn: (state) => state.isLoggedIn,
  achievements: (state) => state.achievements,
  unlockedAchievements: (state) => state.unlockedAchievements,
  achievementStats: (state) => state.achievementStats
}

// Mutations
const mutations = {
  SET_USER_INFO(state, userInfo) {
    state.userInfo = userInfo
    state.isLoggedIn = !!userInfo
  },
  
  SET_ACHIEVEMENTS(state, achievements) {
    state.achievements = achievements
  },
  
  SET_UNLOCKED_ACHIEVEMENTS(state, achievements) {
    state.unlockedAchievements = achievements
  },
  
  SET_ACHIEVEMENT_STATS(state, stats) {
    state.achievementStats = stats
  },
  
  // 检查点4.3: 成就解锁mutation
  ACHIEVEMENT_UNLOCK(state, achievement) {
    // 添加到已解锁列表
    if (!state.unlockedAchievements.find(a => a.id === achievement.id)) {
      state.unlockedAchievements.push(achievement)
    }
    
    // 更新统计
    state.achievementStats.unlocked = state.unlockedAchievements.length
    state.achievementStats.percentage = Math.round(
      (state.achievementStats.unlocked / state.achievementStats.total) * 100
    )
    
    // 累加奖励
    if (achievement.reward) {
      state.achievementStats.totalExp += achievement.reward.exp || 0
      state.achievementStats.totalCoins += achievement.reward.coins || 0
    }
  }
}

// Actions
const actions = {
  // 初始化用户
  async initUser({ commit, dispatch }) {
    try {
      const userInfo = uni.getStorageSync('userInfo')
      const userId = uni.getStorageSync('EXAM_USER_ID')
      
      if (userInfo) {
        commit('SET_USER_INFO', userInfo)
      }
      
      // 初始化成就系统
      if (userId) {
        await dispatch('initAchievements', userId)
      }
      
    } catch (error) {
      console.error('[UserStore] initUser error:', error)
    }
  },
  
  // 检查点4.3: 初始化成就系统
  async initAchievements({ commit }, userId) {
    try {
      // 初始化成就引擎
      await achievementEngine.init(userId)
      
      // 获取成就数据
      const achievements = achievementEngine.getAllAchievements()
      const unlockedAchievements = achievementEngine.getUnlockedAchievements()
      const stats = achievementEngine.getOverallStats()
      
      commit('SET_ACHIEVEMENTS', achievements)
      commit('SET_UNLOCKED_ACHIEVEMENTS', unlockedAchievements)
      commit('SET_ACHIEVEMENT_STATS', stats)
      
      // 监听成就解锁事件
      achievementEngine.on('unlock', (achievement) => {
        commit('ACHIEVEMENT_UNLOCK', achievement)
        
        // 显示Badge动画和Toast
        badgeAnimator.showUnlock(achievement)
        
        console.log('[UserStore] Achievement unlocked:', achievement.name)
      })
      
      console.log('[UserStore] Achievements initialized:', {
        total: stats.total,
        unlocked: stats.unlocked
      })
      
    } catch (error) {
      console.error('[UserStore] initAchievements error:', error)
    }
  },
  
  // 检查点4.3: 更新用户统计并检查成就解锁
  async updateUserStats({ state }, { statType, value, options }) {
    try {
      // 更新统计数据，成就引擎会自动检查是否触发解锁
      await achievementEngine.updateStats(statType, value, options)
      
      console.log('[UserStore] Stats updated:', { statType, value })
      
    } catch (error) {
      console.error('[UserStore] updateUserStats error:', error)
    }
  },
  
  // 检查点4.3: 触发学习相关成就检查
  async checkStudyAchievements({ dispatch }, studyData) {
    const { studyHours, studyCount } = studyData
    
    if (studyHours) {
      await dispatch('updateUserStats', {
        statType: 'studyHours',
        value: studyHours,
        options: { increment: false }
      })
    }
    
    if (studyCount) {
      await dispatch('updateUserStats', {
        statType: 'studyCount',
        value: 1,
        options: { increment: true }
      })
    }
  },
  
  // 检查点4.3: 触发练习相关成就检查
  async checkPracticeAchievements({ dispatch }, practiceData) {
    const { quizCount, isPerfect, accuracy } = practiceData
    
    if (quizCount) {
      await dispatch('updateUserStats', {
        statType: 'quizCount',
        value: quizCount,
        options: { increment: true }
      })
    }
    
    if (isPerfect) {
      await dispatch('updateUserStats', {
        statType: 'perfectQuizCount',
        value: 1,
        options: { increment: true }
      })
    }
    
    if (accuracy !== undefined) {
      await dispatch('updateUserStats', {
        statType: 'accuracy',
        value: accuracy,
        options: { increment: false }
      })
    }
  },
  
  // 检查点4.3: 触发社交相关成就检查
  async checkSocialAchievements({ dispatch }, socialData) {
    const { friendCount, pkWin } = socialData
    
    if (friendCount) {
      await dispatch('updateUserStats', {
        statType: 'friendCount',
        value: friendCount,
        options: { increment: false }
      })
    }
    
    if (pkWin) {
      await dispatch('updateUserStats', {
        statType: 'pkWinCount',
        value: 1,
        options: { increment: true }
      })
    }
  },
  
  // 检查点4.3: 触发连续打卡成就检查
  async checkStreakAchievements({ dispatch }, streakDays) {
    await dispatch('updateUserStats', {
      statType: 'streakDays',
      value: streakDays,
      options: { increment: false }
    })
  },
  
  // 更新用户信息
  updateUserInfo({ commit }, userInfo) {
    commit('SET_USER_INFO', userInfo)
    uni.setStorageSync('userInfo', userInfo)
  },
  
  // 清除用户信息
  clearUserInfo({ commit }) {
    commit('SET_USER_INFO', null)
    uni.removeStorageSync('userInfo')
    uni.removeStorageSync('EXAM_USER_ID')
  }
}

export default {
  namespaced: true,
  state,
  getters,
  mutations,
  actions
}

// 导出便捷方法
export function useUserStore() {
  return {
    // 检查点4.3: 成就解锁便捷方法
    checkAchievementUnlock: async (statType, value) => {
      await achievementEngine.updateStats(statType, value)
    },
    
    getAchievements: () => achievementEngine.getAllAchievements(),
    getUnlockedAchievements: () => achievementEngine.getUnlockedAchievements(),
    getAchievementStats: () => achievementEngine.getOverallStats()
  }
}
