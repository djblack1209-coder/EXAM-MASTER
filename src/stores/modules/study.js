/**
 * 学习进度状态管理
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { APP_CONFIG } from '../../../common/config'
import { storageService } from '../../services/storageService.js'

export const useStudyStore = defineStore('study', () => {
  // 学习进度数据
  const studyProgress = ref({
    totalQuestions: 0,        // 总题目数
    completedQuestions: 0,    // 已完成题目数
    correctQuestions: 0,      // 正确题目数
    studyDays: 0,            // 学习天数
    studyMinutes: 0,         // 学习分钟数
    lastStudyDate: null      // 最后学习日期
  })

  // 当前做题记录
  const currentQuestion = ref(null)
  const questionHistory = ref([])

  // 计算属性
  const completionRate = computed(() => {
    if (studyProgress.value.totalQuestions === 0) return 0
    return (studyProgress.value.completedQuestions / studyProgress.value.totalQuestions * 100).toFixed(1)
  })

  const accuracy = computed(() => {
    if (studyProgress.value.completedQuestions === 0) return 0
    return (studyProgress.value.correctQuestions / studyProgress.value.completedQuestions * 100).toFixed(1)
  })

  /**
   * 更新学习进度
   */
  const updateProgress = (progress) => {
    studyProgress.value = { ...studyProgress.value, ...progress }
    // 持久化存储
    saveProgress()
  }

  /**
   * 设置当前题目
   */
  const setCurrentQuestion = (question) => {
    currentQuestion.value = question
  }

  /**
   * 添加答题记录
   */
  const addQuestionHistory = (record) => {
    questionHistory.value.unshift(record)
    // 限制历史记录数量
    if (questionHistory.value.length > 100) {
      questionHistory.value = questionHistory.value.slice(0, 100)
    }
  }

  /**
   * 记录答题结果
   */
  const recordAnswer = (questionId, isCorrect, timeSpent) => {
    const record = {
      questionId,
      isCorrect,
      timeSpent,
      timestamp: Date.now()
    }
    
    addQuestionHistory(record)
    
    // 更新进度
    studyProgress.value.completedQuestions++
    if (isCorrect) {
      studyProgress.value.correctQuestions++
    }
    
    saveProgress()
  }

  /**
   * 保存进度到本地
   */
  const saveProgress = () => {
    storageService.save(APP_CONFIG.cacheKeys.studyProgress, {
      progress: studyProgress.value,
      history: questionHistory.value
    }, true) // 静默失败，避免频繁提示
  }

  /**
   * 从缓存恢复进度
   */
  const restoreProgress = () => {
    const cached = storageService.get(APP_CONFIG.cacheKeys.studyProgress, null)
    if (cached) {
      if (cached.progress) {
        studyProgress.value = cached.progress
      }
      if (cached.history) {
        questionHistory.value = cached.history
      }
    }
  }

  /**
   * 重置进度
   */
  const resetProgress = () => {
    studyProgress.value = {
      totalQuestions: 0,
      completedQuestions: 0,
      correctQuestions: 0,
      studyDays: 0,
      studyMinutes: 0,
      lastStudyDate: null
    }
    questionHistory.value = []
    currentQuestion.value = null
    saveProgress()
  }

  return {
    // 状态
    studyProgress,
    currentQuestion,
    questionHistory,
    completionRate,
    accuracy,
    
    // 方法
    updateProgress,
    setCurrentQuestion,
    addQuestionHistory,
    recordAnswer,
    saveProgress,
    restoreProgress,
    resetProgress
  }
})
