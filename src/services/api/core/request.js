/**
 * Sealos 后端服务封装
 * 已从阿里云 uniCloud 迁移到 Sealos
 *
 * ✅ P1-2: 统一错误处理 + 自动重试机制
 * ✅ P1-3: JSDoc 类型注释
 *
 * ┌─────────────────────────────────────────────────────────────┐
 * │                    方法索引（按领域分区）                      │
 * ├─────────────────────────────────────────────────────────────┤
 * │ 🔧 基础设施层（L23-415）                                     │
 * │   _requestSign()        FNV-1a 请求签名（防篡改）             │
 * │   normalizeResponse()   统一响应规范化                        │
 * │   normalizeError()      标准化错误对象                        │
 * │   delay()               指数退避延迟                          │
 * │   _checkNetwork()       网络连通性预检                        │
 * │   _checkRateLimit()     前端 API 限流器                       │
 * │   request()             通用请求方法（重试+缓存+去重+签名）     │
 * ├─────────────────────────────────────────────────────────────┤
 * │ 🤖 智能服务（L440-871）                                       │
 * │   proxyAI()             智能代理请求（核心，含兼容桥接）         │
 * │   aiFriendChat()        智能好友角色化对话                     │
 * │   adaptiveQuestionPick() 智能组题                             │
 * │   materialUnderstand()  资料理解出题                          │
 * │   trendPredict()        考点趋势预测                          │
 * │   deepMistakeAnalysis() 错题深度分析                          │
 * │   photoSearch()         拍照搜题（视觉识别）                   │
 * │   getAiFriendMemory()   获取智能好友对话记忆                  │
 * ├─────────────────────────────────────────────────────────────┤
 * │ 🏫 学校数据（L936-1026）                                     │
 * │   getSchoolList()       获取学校列表                          │
 * │   getSchoolDetail()     获取学校详情                          │
 * │   searchSchools()                               │
 * │   getHotSchools()       获取热门学校                          │
 * │   getProvinces()        获取省份列表                          │
 * ├─────────────────────────────────────────────────────────────┤
 * │ 🔐 认证与用户（L1028-1129）                                   │
 * │   login()               统一登录接口                          │
 * │   sendEmailCode()       发送邮箱验证码                        │
 * │   updateUserProfile()   更新用户资料                          │
 * ├─────────────────────────────────────────────────────────────┤
 * │ ⭐ 收藏管理（L1131-1236）                                    │
 * │   addFavorite()         添加收藏                              │
 * │   getFavorites()        获取收藏列表                          │
 * │   removeFavorite()      删除收藏                              │
 * │   checkFavorite()       检查是否已收藏                        │
 * ├─────────────────────────────────────────────────────────────┤
 * │ 📚 学习资源（L1238-1320）                                    │
 * │   getLearningResources() 获取推荐学习资源                     │
 * │   getHotResources()     获取热门资源                          │
 * │   searchResources()     搜索学习资源                          │
 * │   getResourceCategories() 获取资源分类                        │
 * ├─────────────────────────────────────────────────────────────┤
 * │ 🎯 学习目标（L1322-1412）                                    │
 * │   syncLearningGoals()   同步学习目标到后端                    │
 * │   getLearningGoals()    获取后端学习目标                      │
 * │   recordGoalProgress()  记录学习目标进度                      │
 * ├─────────────────────────────────────────────────────────────┤
 * │ 🏆 成就系统（L1414-1503）                                    │
 * │   checkAchievements()   检查并同步成就                        │
 * │   getAllAchievements()  获取所有成就                           │
 * │   unlockAchievement()   解锁指定成就                          │
 * ├─────────────────────────────────────────────────────────────┤
 * │ 🎮 其他服务                                                   │
 * │   rankCenter()          排行榜服务（L577）                    │
 * │   socialService()       社交服务/好友系统（L599）              │
 * │   getQuestionBank()     获取题库数据（L616）                   │
 * │   getRandomQuestions()  随机获取题目（L638）                   │
 * │   getStudyStats()       获取学习统计（L661）                   │
 * │   getUserStatsOverview() 用户统计概览（L1577）                 │
 * │   handleInvite()        处理邀请（L1512）                     │
 * │   claimInviteReward()   领取邀请奖励（L1534）                 │
 * │   getInviteInfo()       获取邀请信息（L1555）                 │
 * └─────────────────────────────────────────────────────────────┘
 *
 * ⚠️ 隐藏约束（Chesterton's Fence）：
 * - _requestSign 使用 FNV-1a 而非 crypto：小程序环境无原生 crypto API
 * - proxyAI 中 response.code = 0 强制注入：兼容新旧 API 格式的桥接补丁
 * - getStudyStats 使用原生存储读取本地兜底：避免 storageService 循环依赖
 * - unlockAchievement 中直接用 uni.setStorageSync：同上，避免循环依赖
 * - 所有业务方法都是 request() 的薄封装，不宜拆分到独立文件
 *
 * @module services/lafService
 */

// ✅ P0-2: 使用相对路径导入配置（避免别名解析问题）

import config from '../../../config/index.js';
// ✅ B021: 使用独立的 auth-storage 模块读取敏感数据（避免循环依赖）

// ✅ 6.3: 性能监控集成

// ✅ 从统一配置读取，支持环境变量

// ✅ 3.5: 请求签名函数（FNV-1a 哈希，轻量级防篡改）
function _requestSign(path, timestamp) {
  const raw = `${path}:${timestamp}:${config.security.requestSignSalt}`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < raw.length; i++) {
    hash ^= raw.charCodeAt(i);
    hash = (hash * 0x01000193) >>> 0;
  }
  return hash.toString(36);
}

// ==================== P1-2/I001: 统一响应格式工具 ====================
