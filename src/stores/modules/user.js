/**
 * 用户信息状态管理
 */

import { defineStore } from 'pinia'
import { ref } from 'vue'
import { APP_CONFIG } from '../../../common/config'
import { storageService } from '../../services/storageService.js'
import { lafService } from '../../services/lafService.js'

export const useUserStore = defineStore('user', () => {
  // 状态定义
  const token = ref('')
  const userInfo = ref(null)
  const isLogin = ref(false)
  const planProgress = ref(75)
  const friendsList = ref([])

  const syncLoginStatus = () => {
    isLogin.value = !!token.value && !!userInfo.value
  }

  /**
   * 设置 Token
   */
  const setToken = (newToken) => {
    token.value = newToken
    syncLoginStatus()
    // 持久化存储
    storageService.save(APP_CONFIG.cacheKeys.token, newToken, true)
  }

  /**
   * 设置用户信息
   */
  const setUserInfo = (info) => {
    userInfo.value = info
    syncLoginStatus()
    // 持久化存储
    storageService.save(APP_CONFIG.cacheKeys.userInfo, info, true)
  }

  /**
   * 微信小程序静默登录（使用 Laf 后端）
   * @param {boolean} silent - 是否静默登录（不显示错误提示）
   * @returns {Promise<Object>} 返回登录结果 { success: boolean, userInfo?: Object, error?: Error }
   */
  const login = async (silent = true) => {
    try {
      // 1. 调用 uni.login 获取 code
      const loginRes = await new Promise((resolve, reject) => {
        uni.login({
          provider: 'weixin',
          success: resolve,
          fail: reject
        })
      })

      const code = loginRes?.code
      if (!code) {
        throw new Error('获取登录凭证失败')
      }

      // 2. 调用 Laf 登录接口
      try {
        const res = await lafService.request('/login', { code })
        
        if (res.code === 0 && res.data && res.data.userId) {
          const userId = res.data.userId
          
          // 保存 userId
          uni.setStorageSync('EXAM_USER_ID', userId)
          storageService.save('user_id', userId, true)
          storageService.save('EXAM_USER_ID', userId, true)
          
          // 构建用户信息对象（兼容现有代码）
          const userData = {
            _id: userId,
            id: userId,
            userId: userId,
            ...res.data // 保留后端返回的其他字段
          }
          
          setUserInfo(userData)
          isLogin.value = true
          
          // 如果后端返回了 token，也保存
          if (res.data.token) {
            setToken(res.data.token)
          }
          
          console.log('✅ Laf 登录成功:', userId)
          
          return { 
            success: true, 
            userInfo: userData 
          }
        } else {
          throw new Error(res.message || '登录失败')
        }
      } catch (lafError) {
        console.error('❌ 迁移后的登录失败:', lafError)
        const error = new Error(lafError.message || '登录服务不可用')
        
        if (!silent) {
          uni.showToast({
            title: error.message,
            icon: 'none',
            duration: 3000
          })
        }
        
        return { success: false, error }
      }
    } catch (error) {
      console.error('[UserStore] 登录异常：', error)
      
      if (!silent) {
        uni.showToast({
          title: error.message || '登录失败',
          icon: 'none',
          duration: 3000
        })
      }
      
      return { success: false, error }
    }
  }

  /**
   * 登出
   */
  const logout = () => {
    token.value = ''
    userInfo.value = null
    isLogin.value = false
    // 清除缓存
    storageService.remove(APP_CONFIG.cacheKeys.token, true)
    storageService.remove(APP_CONFIG.cacheKeys.userInfo, true)
  }

  /**
   * 获取好友列表
   */
  const fetchFriends = async () => {
    if (!isLogin.value) {
      friendsList.value = []
      return []
    }

    const mockFriends = [
      {
        id: 1,
        name: '林夏',
        school: '华中科技大学',
        major: '计算机科学与技术',
        avatar: 'https://api.dicebear.com/7.x/avataaars/png?seed=LinXia',
        online: true
      },
      {
        id: 2,
        name: '周然',
        school: '中山大学',
        major: '软件工程',
        avatar: 'https://api.dicebear.com/7.x/avataaars/png?seed=ZhouRan',
        online: false
      }
    ]

    friendsList.value = mockFriends
    return mockFriends
  }

  /**
   * 从缓存恢复用户信息
   */
  const restoreUserInfo = () => {
    const cachedToken = storageService.get(APP_CONFIG.cacheKeys.token, null)
    const cachedUserInfo = storageService.get(APP_CONFIG.cacheKeys.userInfo, null)
    // 优先使用 EXAM_USER_ID，兼容旧的 user_id
    const cachedUserId = storageService.get('EXAM_USER_ID', null) || storageService.get('user_id', null)
    
    if (cachedToken) {
      token.value = cachedToken
    }
    if (cachedUserInfo) {
      userInfo.value = cachedUserInfo
      // 确保 user_id 存在
      if (!cachedUserInfo._id && cachedUserId) {
        userInfo.value._id = cachedUserId
        userInfo.value.id = cachedUserId
        userInfo.value.userId = cachedUserId
      }
    } else if (cachedUserId) {
      // 如果只有 userId，也尝试恢复基本用户信息
      userInfo.value = {
        _id: cachedUserId,
        id: cachedUserId,
        userId: cachedUserId
      }
    }
    syncLoginStatus()
  }
  
  /**
   * 静默登录（应用启动时自动调用）
   * 如果已有 token，先尝试恢复；如果没有，则执行登录
   */
  const silentLogin = async () => {
    // 先尝试恢复缓存的用户信息
    restoreUserInfo()
    
    // 如果没有登录信息，执行静默登录
    if (!isLogin.value) {
      return await login(true) // 静默模式，不显示错误提示
    }
    
    return { success: true, userInfo: userInfo.value }
  }

  return {
    // 状态
    token,
    userInfo,
    isLogin,
    planProgress,
    friendsList,
    
    // 方法
    setToken,
    setUserInfo,
    login,
    logout,
    fetchFriends,
    restoreUserInfo,
    silentLogin
  }
})
