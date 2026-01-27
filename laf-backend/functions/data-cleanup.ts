/**
 * 数据清洗云函数
 * 
 * 功能：清理开发期间产生的脏数据
 * 
 * 清理规则：
 * 1. 测试用户：ID 为 1、nickname 包含 "test"、"测试" 的用户
 * 2. 测试题目：标题包含 "test"、"测试"、"xxx" 的题目
 * 3. 测试记录：关联到测试用户的练习记录、错题记录
 * 4. 过期数据：超过 TTL 的幂等性记录
 * 
 * 安全措施：
 * - 仅管理员可执行
 * - 支持 dry-run 模式（预览不删除）
 * - 详细日志记录
 * 
 * @version 1.0.0
 * @author EXAM-MASTER Backend Team
 */

import cloud from '@lafjs/cloud'

const db = cloud.database()
const _ = db.command

// ==================== 环境配置 ====================
const IS_PRODUCTION = process.env.NODE_ENV === 'production'
// 安全提示：敏感信息必须通过环境变量配置，禁止硬编码
const SECRET_PLACEHOLDER

// ==================== 日志工具 ====================
const logger = {
  info: (...args: any[]) => console.log('[DataCleanup]', ...args),
  warn: (...args: any[]) => console.warn('[DataCleanup]', ...args),
  error: (...args: any[]) => console.error('[DataCleanup]', ...args)
}

// ==================== 脏数据匹配规则 ====================
const DIRTY_DATA_PATTERNS = {
  // 测试用户特征
  testUserPatterns: [
    /^test/i,
    /测试/,
    /^demo/i,
    /^admin$/i,
    /^user[0-9]+$/i
  ],
  
  // 测试题目特征
  testQuestionPatterns: [
    /^test/i,
    /测试/,
    /^xxx/i,
    /占位/,
    /示例题目/,
    /^demo/i
  ],
  
  // 需要清理的特定 ID
  specificIds: {
    users: ['1', '0', 'test', 'admin', 'demo'],
    questions: ['1', '0', 'test']
  }
}

// ==================== 主函数 ====================
export default async function (ctx) {
  const startTime = Date.now()
  const requestId = `cleanup_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  logger.info(`[${requestId}] 数据清洗任务开始`)

  try {
    const { adminSecret, dryRun = true, targets } = ctx.body || {}

    // 1. 权限验证
    if (adminSecret !== ADMIN_SECRET) {
      logger.warn(`[${requestId}] 权限验证失败`)
      return {
        code: 403,
        success: false,
        message: '权限不足，需要管理员密钥',
        requestId
      }
    }

    // 2. 生产环境额外确认
    if (IS_PRODUCTION && !dryRun) {
      logger.warn(`[${requestId}] 生产环境执行实际删除操作`)
    }

    // 3. 执行清理
    const results = {
      dryRun,
      environment: IS_PRODUCTION ? 'production' : 'development',
      cleaned: {},
      errors: []
    }

    // 默认清理所有类型
    const cleanupTargets = targets || ['users', 'questions', 'practice_records', 'mistake_book', 'idempotency_records', 'rankings', 'friends']

    // 4. 按顺序清理各类数据
    for (const target of cleanupTargets) {
      try {
        const cleanupResult = await cleanupCollection(target, dryRun, requestId)
        results.cleaned[target] = cleanupResult
      } catch (error) {
        logger.error(`[${requestId}] 清理 ${target} 失败:`, error)
        results.errors.push({ collection: target, error: error.message })
      }
    }

    // 5. 返回结果
    const duration = Date.now() - startTime
    logger.info(`[${requestId}] 数据清洗完成，耗时: ${duration}ms`)

    return {
      code: 0,
      success: true,
      data: results,
      message: dryRun ? '预览完成（未实际删除）' : '清理完成',
      requestId,
      duration
    }

  } catch (error) {
    const duration = Date.now() - startTime
    logger.error(`[${requestId}] 数据清洗异常:`, error)

    return {
      code: 500,
      success: false,
      message: '清理失败',
      error: error.message,
      requestId,
      duration
    }
  }
}

/**
 * 清理指定集合的脏数据
 */
async function cleanupCollection(collectionName: string, dryRun: boolean, requestId: string) {
  const collection = db.collection(collectionName)
  const result = {
    scanned: 0,
    matched: 0,
    deleted: 0,
    details: []
  }

  switch (collectionName) {
    case 'users':
      return await cleanupUsers(collection, dryRun, requestId)
    
    case 'questions':
      return await cleanupQuestions(collection, dryRun, requestId)
    
    case 'practice_records':
      return await cleanupPracticeRecords(collection, dryRun, requestId)
    
    case 'mistake_book':
      return await cleanupMistakeBook(collection, dryRun, requestId)
    
    case 'idempotency_records':
      return await cleanupIdempotencyRecords(collection, dryRun, requestId)
    
    case 'rankings':
      return await cleanupRankings(collection, dryRun, requestId)
    
    case 'friends':
      return await cleanupFriends(collection, dryRun, requestId)
    
    default:
      return { skipped: true, reason: '未知集合类型' }
  }
}

/**
 * 清理测试用户
 */
async function cleanupUsers(collection, dryRun: boolean, requestId: string) {
  const result = { scanned: 0, matched: 0, deleted: 0, details: [] }

  // 获取所有用户
  const allUsers = await collection.limit(1000).get()
  result.scanned = allUsers.data.length

  const toDelete = []

  for (const user of allUsers.data) {
    let shouldDelete = false
    let reason = ''

    // 检查特定 ID
    if (DIRTY_DATA_PATTERNS.specificIds.users.includes(user._id)) {
      shouldDelete = true
      reason = `特定测试ID: ${user._id}`
    }

    // 检查昵称模式
    if (!shouldDelete && user.nickname) {
      for (const pattern of DIRTY_DATA_PATTERNS.testUserPatterns) {
        if (pattern.test(user.nickname)) {
          shouldDelete = true
          reason = `昵称匹配测试模式: ${user.nickname}`
          break
        }
      }
    }

    // 检查 openid 模式（测试 openid 通常很短或有特殊格式）
    if (!shouldDelete && user.openid) {
      if (user.openid.length < 20 || /^test/i.test(user.openid)) {
        shouldDelete = true
        reason = `openid 异常: ${user.openid}`
      }
    }

    if (shouldDelete) {
      result.matched++
      result.details.push({ id: user._id, nickname: user.nickname, reason })
      toDelete.push(user._id)
    }
  }

  // 执行删除
  if (!dryRun && toDelete.length > 0) {
    for (const id of toDelete) {
      try {
        await collection.doc(id).remove()
        result.deleted++
      } catch (e) {
        logger.error(`[${requestId}] 删除用户失败: ${id}`, e)
      }
    }
  }

  logger.info(`[${requestId}] 用户清理: 扫描 ${result.scanned}, 匹配 ${result.matched}, 删除 ${result.deleted}`)
  return result
}

/**
 * 清理测试题目
 */
async function cleanupQuestions(collection, dryRun: boolean, requestId: string) {
  const result = { scanned: 0, matched: 0, deleted: 0, details: [] }

  const allQuestions = await collection.limit(2000).get()
  result.scanned = allQuestions.data.length

  const toDelete = []

  for (const question of allQuestions.data) {
    let shouldDelete = false
    let reason = ''

    // 检查特定 ID
    if (DIRTY_DATA_PATTERNS.specificIds.questions.includes(question._id)) {
      shouldDelete = true
      reason = `特定测试ID: ${question._id}`
    }

    // 检查题目内容
    if (!shouldDelete && question.content) {
      for (const pattern of DIRTY_DATA_PATTERNS.testQuestionPatterns) {
        if (pattern.test(question.content)) {
          shouldDelete = true
          reason = `内容匹配测试模式`
          break
        }
      }
    }

    // 检查题目标题
    if (!shouldDelete && question.title) {
      for (const pattern of DIRTY_DATA_PATTERNS.testQuestionPatterns) {
        if (pattern.test(question.title)) {
          shouldDelete = true
          reason = `标题匹配测试模式: ${question.title}`
          break
        }
      }
    }

    // 检查空题目
    if (!shouldDelete && (!question.content || question.content.trim().length < 5)) {
      shouldDelete = true
      reason = '题目内容为空或过短'
    }

    if (shouldDelete) {
      result.matched++
      result.details.push({ 
        id: question._id, 
        title: question.title?.substring(0, 50), 
        reason 
      })
      toDelete.push(question._id)
    }
  }

  // 执行删除
  if (!dryRun && toDelete.length > 0) {
    for (const id of toDelete) {
      try {
        await collection.doc(id).remove()
        result.deleted++
      } catch (e) {
        logger.error(`[${requestId}] 删除题目失败: ${id}`, e)
      }
    }
  }

  logger.info(`[${requestId}] 题目清理: 扫描 ${result.scanned}, 匹配 ${result.matched}, 删除 ${result.deleted}`)
  return result
}

/**
 * 清理孤立的练习记录（关联到已删除用户的记录）
 */
async function cleanupPracticeRecords(collection, dryRun: boolean, requestId: string) {
  const result = { scanned: 0, matched: 0, deleted: 0, details: [] }

  // 获取所有有效用户 ID
  const usersCollection = db.collection('users')
  const validUsers = await usersCollection.field({ _id: true }).limit(10000).get()
  const validUserIds = new Set(validUsers.data.map(u => u._id))

  // 获取练习记录
  const allRecords = await collection.limit(5000).get()
  result.scanned = allRecords.data.length

  const toDelete = []

  for (const record of allRecords.data) {
    let shouldDelete = false
    let reason = ''

    // 检查用户是否存在
    if (!validUserIds.has(record.user_id)) {
      shouldDelete = true
      reason = `用户不存在: ${record.user_id}`
    }

    // 检查测试用户 ID
    if (!shouldDelete && DIRTY_DATA_PATTERNS.specificIds.users.includes(record.user_id)) {
      shouldDelete = true
      reason = `测试用户记录: ${record.user_id}`
    }

    if (shouldDelete) {
      result.matched++
      result.details.push({ id: record._id, user_id: record.user_id, reason })
      toDelete.push(record._id)
    }
  }

  // 执行删除
  if (!dryRun && toDelete.length > 0) {
    for (const id of toDelete) {
      try {
        await collection.doc(id).remove()
        result.deleted++
      } catch (e) {
        logger.error(`[${requestId}] 删除练习记录失败: ${id}`, e)
      }
    }
  }

  logger.info(`[${requestId}] 练习记录清理: 扫描 ${result.scanned}, 匹配 ${result.matched}, 删除 ${result.deleted}`)
  return result
}

/**
 * 清理孤立的错题记录
 */
async function cleanupMistakeBook(collection, dryRun: boolean, requestId: string) {
  const result = { scanned: 0, matched: 0, deleted: 0, details: [] }

  // 获取所有有效用户 ID
  const usersCollection = db.collection('users')
  const validUsers = await usersCollection.field({ _id: true }).limit(10000).get()
  const validUserIds = new Set(validUsers.data.map(u => u._id))

  // 获取错题记录
  const allMistakes = await collection.limit(5000).get()
  result.scanned = allMistakes.data.length

  const toDelete = []

  for (const mistake of allMistakes.data) {
    let shouldDelete = false
    let reason = ''

    // 检查用户是否存在
    if (!validUserIds.has(mistake.user_id)) {
      shouldDelete = true
      reason = `用户不存在: ${mistake.user_id}`
    }

    // 检查测试用户 ID
    if (!shouldDelete && DIRTY_DATA_PATTERNS.specificIds.users.includes(mistake.user_id)) {
      shouldDelete = true
      reason = `测试用户记录: ${mistake.user_id}`
    }

    // 检查测试题目内容
    if (!shouldDelete && mistake.question_content) {
      for (const pattern of DIRTY_DATA_PATTERNS.testQuestionPatterns) {
        if (pattern.test(mistake.question_content)) {
          shouldDelete = true
          reason = '测试题目内容'
          break
        }
      }
    }

    if (shouldDelete) {
      result.matched++
      result.details.push({ id: mistake._id, user_id: mistake.user_id, reason })
      toDelete.push(mistake._id)
    }
  }

  // 执行删除
  if (!dryRun && toDelete.length > 0) {
    for (const id of toDelete) {
      try {
        await collection.doc(id).remove()
        result.deleted++
      } catch (e) {
        logger.error(`[${requestId}] 删除错题记录失败: ${id}`, e)
      }
    }
  }

  logger.info(`[${requestId}] 错题记录清理: 扫描 ${result.scanned}, 匹配 ${result.matched}, 删除 ${result.deleted}`)
  return result
}

/**
 * 清理过期的幂等性记录
 */
async function cleanupIdempotencyRecords(collection, dryRun: boolean, requestId: string) {
  const result = { scanned: 0, matched: 0, deleted: 0, details: [] }

  const now = Date.now()
  
  // 查询过期记录
  const expiredRecords = await collection.where({
    expires_at: _.lt(now)
  }).limit(1000).get()

  result.scanned = expiredRecords.data.length
  result.matched = expiredRecords.data.length

  // 执行删除
  if (!dryRun && expiredRecords.data.length > 0) {
    for (const record of expiredRecords.data) {
      try {
        await collection.doc(record._id).remove()
        result.deleted++
      } catch (e) {
        logger.error(`[${requestId}] 删除幂等记录失败: ${record._id}`, e)
      }
    }
  }

  logger.info(`[${requestId}] 幂等记录清理: 扫描 ${result.scanned}, 匹配 ${result.matched}, 删除 ${result.deleted}`)
  return result
}

/**
 * 清理测试排行榜数据
 */
async function cleanupRankings(collection, dryRun: boolean, requestId: string) {
  const result = { scanned: 0, matched: 0, deleted: 0, details: [] }

  // 获取所有有效用户 ID
  const usersCollection = db.collection('users')
  const validUsers = await usersCollection.field({ _id: true }).limit(10000).get()
  const validUserIds = new Set(validUsers.data.map(u => u._id))

  // 获取排行榜记录
  const allRankings = await collection.limit(2000).get()
  result.scanned = allRankings.data.length

  const toDelete = []

  for (const ranking of allRankings.data) {
    let shouldDelete = false
    let reason = ''

    // 检查用户是否存在
    if (!validUserIds.has(ranking.uid)) {
      shouldDelete = true
      reason = `用户不存在: ${ranking.uid}`
    }

    // 检查测试用户 ID
    if (!shouldDelete && DIRTY_DATA_PATTERNS.specificIds.users.includes(ranking.uid)) {
      shouldDelete = true
      reason = `测试用户记录: ${ranking.uid}`
    }

    // 检查测试昵称
    if (!shouldDelete && ranking.nick_name) {
      for (const pattern of DIRTY_DATA_PATTERNS.testUserPatterns) {
        if (pattern.test(ranking.nick_name)) {
          shouldDelete = true
          reason = `测试昵称: ${ranking.nick_name}`
          break
        }
      }
    }

    if (shouldDelete) {
      result.matched++
      result.details.push({ id: ranking._id, uid: ranking.uid, reason })
      toDelete.push(ranking._id)
    }
  }

  // 执行删除
  if (!dryRun && toDelete.length > 0) {
    for (const id of toDelete) {
      try {
        await collection.doc(id).remove()
        result.deleted++
      } catch (e) {
        logger.error(`[${requestId}] 删除排行榜记录失败: ${id}`, e)
      }
    }
  }

  logger.info(`[${requestId}] 排行榜清理: 扫描 ${result.scanned}, 匹配 ${result.matched}, 删除 ${result.deleted}`)
  return result
}

/**
 * 清理孤立的好友关系
 */
async function cleanupFriends(collection, dryRun: boolean, requestId: string) {
  const result = { scanned: 0, matched: 0, deleted: 0, details: [] }

  // 获取所有有效用户 ID
  const usersCollection = db.collection('users')
  const validUsers = await usersCollection.field({ _id: true }).limit(10000).get()
  const validUserIds = new Set(validUsers.data.map(u => u._id))

  // 获取好友关系
  const allFriends = await collection.limit(5000).get()
  result.scanned = allFriends.data.length

  const toDelete = []

  for (const friend of allFriends.data) {
    let shouldDelete = false
    let reason = ''

    // 检查双方用户是否都存在
    if (!validUserIds.has(friend.user_id)) {
      shouldDelete = true
      reason = `用户不存在: ${friend.user_id}`
    }

    if (!shouldDelete && !validUserIds.has(friend.friend_id)) {
      shouldDelete = true
      reason = `好友不存在: ${friend.friend_id}`
    }

    // 检查测试用户 ID
    if (!shouldDelete) {
      if (DIRTY_DATA_PATTERNS.specificIds.users.includes(friend.user_id) ||
          DIRTY_DATA_PATTERNS.specificIds.users.includes(friend.friend_id)) {
        shouldDelete = true
        reason = '涉及测试用户'
      }
    }

    if (shouldDelete) {
      result.matched++
      result.details.push({ 
        id: friend._id, 
        user_id: friend.user_id, 
        friend_id: friend.friend_id, 
        reason 
      })
      toDelete.push(friend._id)
    }
  }

  // 执行删除
  if (!dryRun && toDelete.length > 0) {
    for (const id of toDelete) {
      try {
        await collection.doc(id).remove()
        result.deleted++
      } catch (e) {
        logger.error(`[${requestId}] 删除好友关系失败: ${id}`, e)
      }
    }
  }

  logger.info(`[${requestId}] 好友关系清理: 扫描 ${result.scanned}, 匹配 ${result.matched}, 删除 ${result.deleted}`)
  return result
}
