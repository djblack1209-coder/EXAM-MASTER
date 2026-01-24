/**
 * 登录鉴权中间件
 * 用于保护需要登录才能访问的功能
 */

import { useUserStore } from '../../stores'

/**
 * 检查用户是否已登录
 * @returns {boolean} 是否已登录
 */
export function isUserLoggedIn() {
    const userStore = useUserStore()

    // 检查多个条件确保用户已登录
    const hasUserInfo = !!userStore.userInfo
    const hasUserId = !!(userStore.userInfo?._id || userStore.userInfo?.userId)
    const isLoginFlag = userStore.isLogin

    // 同时检查本地存储
    const cachedUserInfo = uni.getStorageSync('userInfo')
    const cachedUserId = uni.getStorageSync('EXAM_USER_ID') || uni.getStorageSync('user_id')

    return (hasUserInfo && hasUserId && isLoginFlag) || (cachedUserInfo && cachedUserId)
}

/**
 * 获取当前用户ID
 * @returns {string|null} 用户ID或null
 */
export function getCurrentUserId() {
    const userStore = useUserStore()

    return userStore.userInfo?._id ||
        userStore.userInfo?.userId ||
        uni.getStorageSync('EXAM_USER_ID') ||
        uni.getStorageSync('user_id') ||
        null
}

/**
 * 获取当前用户信息
 * @returns {Object|null} 用户信息或null
 */
export function getCurrentUserInfo() {
    const userStore = useUserStore()

    return userStore.userInfo || uni.getStorageSync('userInfo') || null
}

/**
 * 登录保护中间件 - 检查登录状态，未登录则跳转登录页
 * @param {Function} callback - 登录后执行的回调函数
 * @param {Object} options - 配置选项
 * @param {string} options.loginUrl - 登录页面路径，默认 '/src/pages/settings/index'
 * @param {string} options.message - 未登录提示消息
 * @param {boolean} options.showToast - 是否显示提示，默认 true
 * @returns {boolean} 是否已登录
 */
export function requireLogin(callback, options = {}) {
    const {
        loginUrl = '/src/pages/settings/index',
        message = '请先登录',
        showToast = true
    } = options

    if (isUserLoggedIn()) {
        // 已登录，执行回调
        if (typeof callback === 'function') {
            callback()
        }
        return true
    } else {
        // 未登录，显示提示并跳转
        if (showToast) {
            uni.showToast({
                title: message,
                icon: 'none',
                duration: 2000
            })
        }

        // 延迟跳转，让用户看到提示
        setTimeout(() => {
            uni.navigateTo({
                url: loginUrl,
                fail: (err) => {
                    console.error('[LoginGuard] 跳转登录页失败:', err)
                    // 如果 navigateTo 失败，尝试 switchTab（可能是 tabBar 页面）
                    uni.switchTab({
                        url: loginUrl,
                        fail: () => {
                            console.error('[LoginGuard] switchTab 也失败了')
                        }
                    })
                }
            })
        }, showToast ? 1500 : 0)

        return false
    }
}

/**
 * 异步登录保护 - 返回 Promise
 * @param {Object} options - 配置选项
 * @returns {Promise<boolean>} 是否已登录
 */
export function requireLoginAsync(options = {}) {
    return new Promise((resolve, reject) => {
        const isLoggedIn = requireLogin(() => {
            resolve(true)
        }, {
            ...options,
            showToast: options.showToast !== false
        })

        if (!isLoggedIn) {
            reject(new Error('用户未登录'))
        }
    })
}

/**
 * 页面级登录保护 - 在页面 onLoad 中使用
 * @param {Object} pageInstance - 页面实例（this）
 * @param {Object} options - 配置选项
 * @returns {boolean} 是否已登录
 */
export function pageRequireLogin(pageInstance, options = {}) {
    const isLoggedIn = isUserLoggedIn()

    if (!isLoggedIn) {
        const {
            loginUrl = '/src/pages/settings/index',
            message = '请先登录后使用此功能',
            showToast = true,
            redirectBack = true
        } = options

        if (showToast) {
            uni.showToast({
                title: message,
                icon: 'none',
                duration: 2000
            })
        }

        // 保存当前页面路径，登录后可以返回
        if (redirectBack && pageInstance) {
            const pages = getCurrentPages()
            const currentPage = pages[pages.length - 1]
            if (currentPage) {
                const currentRoute = currentPage.route
                const currentOptions = currentPage.options

                // 构建完整路径
                let fullPath = '/' + currentRoute
                if (currentOptions && Object.keys(currentOptions).length > 0) {
                    const query = Object.keys(currentOptions)
                        .map(key => `${key}=${currentOptions[key]}`)
                        .join('&')
                    fullPath += '?' + query
                }

                uni.setStorageSync('redirect_after_login', fullPath)
            }
        }

        // 跳转到登录页
        setTimeout(() => {
            uni.redirectTo({
                url: loginUrl,
                fail: (err) => {
                    console.error('[LoginGuard] 页面重定向失败:', err)
                    uni.navigateTo({
                        url: loginUrl,
                        fail: () => {
                            uni.switchTab({ url: loginUrl })
                        }
                    })
                }
            })
        }, showToast ? 1500 : 0)
    }

    return isLoggedIn
}

/**
 * 登录后重定向到之前的页面
 */
export function redirectAfterLogin() {
    const redirectUrl = uni.getStorageSync('redirect_after_login')

    if (redirectUrl) {
        // 清除重定向记录
        uni.removeStorageSync('redirect_after_login')

        // 跳转回原页面
        uni.redirectTo({
            url: redirectUrl,
            fail: (err) => {
                console.error('[LoginGuard] 重定向失败:', err)
                // 如果重定向失败，跳转到首页
                uni.switchTab({
                    url: '/src/pages/index/index'
                })
            }
        })
    } else {
        // 没有重定向记录，跳转到首页
        uni.switchTab({
            url: '/src/pages/index/index'
        })
    }
}

/**
 * 功能级登录保护装饰器（用于 methods）
 * @param {string} message - 未登录提示消息
 * @returns {Function} 装饰器函数
 */
export function loginRequired(message = '请先登录') {
    return function (target, propertyKey, descriptor) {
        const originalMethod = descriptor.value

        descriptor.value = function (...args) {
            if (isUserLoggedIn()) {
                return originalMethod.apply(this, args)
            } else {
                uni.showToast({
                    title: message,
                    icon: 'none',
                    duration: 2000
                })

                setTimeout(() => {
                    uni.navigateTo({
                        url: '/src/pages/settings/index'
                    })
                }, 1500)

                return false
            }
        }

        return descriptor
    }
}

/**
 * 批量检查功能权限
 * @param {Array<string>} features - 功能列表
 * @returns {Object} 权限映射对象
 */
export function checkFeaturePermissions(features = []) {
    const isLoggedIn = isUserLoggedIn()
    const permissions = {}

    features.forEach(feature => {
        permissions[feature] = isLoggedIn
    })

    return permissions
}

/**
 * 静默登录检查 - 不显示任何提示
 * @returns {boolean} 是否已登录
 */
export function silentLoginCheck() {
    return isUserLoggedIn()
}

/**
 * 登录状态监听器
 * @param {Function} callback - 登录状态变化时的回调
 * @returns {Function} 取消监听的函数
 */
export function watchLoginStatus(callback) {
    const checkInterval = setInterval(() => {
        const isLoggedIn = isUserLoggedIn()
        callback(isLoggedIn)
    }, 1000)

    // 返回取消监听的函数
    return () => {
        clearInterval(checkInterval)
    }
}

/**
 * 导出默认对象
 */
export default {
    isUserLoggedIn,
    getCurrentUserId,
    getCurrentUserInfo,
    requireLogin,
    requireLoginAsync,
    pageRequireLogin,
    redirectAfterLogin,
    loginRequired,
    checkFeaturePermissions,
    silentLoginCheck,
    watchLoginStatus
}
