/**
 * safeImport — 兼容微信小程序的动态导入
 *
 * 微信小程序编译时会把 ES Module 的 import() 转成同步 require()，
 * 导致返回值不是 Promise 而是模块对象本身。
 * 用 Promise.resolve() 包裹后，无论编译器怎么处理都能统一以 async 方式消费。
 *
 * @param {Promise|Object} importResult - import('xxx') 的返回值
 * @returns {Promise<Object>} 永远返回 Promise
 *
 * @example
 * // 替换前 (小程序中 .then 会报错)
 * import('@/stores/modules/review.js').then(mod => ...)
 *
 * // 替换后
 * safeImport(import('@/stores/modules/review.js')).then(mod => ...)
 */
export function safeImport(importResult) {
  // 如果 import() 已经返回 Promise（H5/App 环境），直接透传
  // 如果被编译为同步 require()，用 Promise.resolve 包一层
  return Promise.resolve(importResult);
}
