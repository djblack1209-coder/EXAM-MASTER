/**
 * 数据清洗脚本 - 清空开发期间产生的脏数据
 * 
 * 清理规则：
 * 1. 测试用户：ID 为 1 或 openid 包含 "test" 的用户
 * 2. 测试题目：标题包含 "test"、"测试" 的题目
 * 3. 测试错题记录
 * 4. 测试练习记录
 * 5. 测试排行榜数据
 * 
 * 使用方式：
 * 1. 在 Laf/Sealos 控制台创建此云函数
 * 2. 设置环境变量 CLEANUP_SECRET 作为执行密钥
 * 3. 调用时传入 { secret: "your-secret", dryRun: true } 先预览
 * 4. 确认无误后传入 { secret: "your-secret", dryRun: false } 执行清理
 * 
 * @version 1.0.0
 * @author EXAM-MASTER Backend Team
 */

import cloud from '@lafjs/cloud'

const db = cloud.database()
const _ = db.command

// 清理密钥（必须在环境变量中配置）
// 安全提示：敏感信息必须通过环境变量配置，禁止硬编码
const SECRET_PLACEHOLDER

// 测试数据识别规则
const TEST_PATTERNS = {
  // 用户相关
  userIds: ['1', 'test', 'user_001', 'test_user'],
  openidPatterns: ['test', 'mock', 'fake', 'demo'],
  nicknamePatterns: ['测试', 'test', 'Test', 'TEST', '演示'],
  
  // 题目相关
  questionPatterns: ['test', 'Test', 'TEST', '测试', '演示', 'demo', 'Demo'],
  
  // 通用测试标记
  testMarkers: ['_test', '-test', 'test_', 'test-', 'mock', 'fake', 'demo']
}

interface CleanupResult {
  collection: string
  found: number
  deleted: number
  samples: any[]
}

export default async function (ctx) {
  const startTime = Date.now()
  const requestId = `cleanup_${Date.now()}`

  console.log(`[${requestId}] 数据清洗脚本开始执行`)

  try {
    // 1. 验证密钥
    const { secret, dryRun = true } = ctx.body || {}

    if (!secret || secret !== CLEANUP_SECRET) {
      console.warn(`[${requestId}] 密钥验证失败`)
      return {
        code: 403,
        success: false,
        message: '密钥验证失败，拒绝执行',
        requestId
      }
    }

    console.log(`[${requestId}] 执行模式: ${dryRun ? '预览(DRY RUN)' : '实际删除'}`)

    const results: CleanupResult[] = []

    // 2. 清理测试用户
    const usersResult = await cleanupTestUsers(dryRun, requestId)
    results.push(usersResult)

    // 3. 清理测试题目
    const questionsResult = await cleanupTestQuestions(dryRun, requestId)
    results.push(questionsResult)

    // 4. 清理测试错题记录
    const mistakesResult = await cleanupTestMistakes(dryRun, requestId)
    results.push(mistakesResult)

    // 5. 清理测试练习记录
    const practiceResult = await cleanupTestPracticeRecords(dryRun, requestId)
    results.push(practiceResult)

    // 6. 清理测试排行榜数据
    const rankingsResult = await cleanupTestRankings(dryRun, requestId)
    results.push(rankingsResult)

    // 7. 清理测试好友关系
    const friendsResult = await cleanupTestFriends(dryRun, requestId)
    results.push(friendsResult)

    // 8. 汇总结果
    const totalFound = results.reduce((sum, r) => sum + r.found, 0)
    const totalDeleted = results.reduce((sum, r) => sum + r.deleted, 0)

    const duration = Date.now() - startTime
    console.log(`[${requestId}] 数据清洗完成，耗时: ${duration}ms`)

    return {
      code: 0,
      success: true,
      message: dryRun 
        ? `预览完成：发现 ${totalFound} 条测试数据待清理` 
        : `清理完成：已删除 ${totalDeleted} 条测试数据`,
      dryRun,
      summary: {
        totalFound,
        totalDeleted
      },
      details: results,
      requestId,
      duration
    }

  } catch (error) {
    const duration = Date.now() - startTime
    console.error(`[${requestId}] 数据清洗异常:`, error)

    return {
      code: 500,
      success: false,
      message: '数据清洗执行失败',
      error: error.message,
      requestId,
      duration
    }
  }
}

/**
 * 清理测试用户
 */
async function cleanupTestUsers(dryRun: boolean, requestId: string): Promise<CleanupResult> {
  const collection = db.collection('users')
  
  // 获取所有用户，在内存中筛选测试数据
  const allUsers = await collection.limit(1000).get()
  
  const testUsers = allUsers.data.filter(user => {
    // 检查 ID
    if (TEST_PATTERNS.userIds.includes(user._id)) return true
    
    // 检查 openid
    const openid = (user.openid || '').toLowerCase()
    if (TEST_PATTERNS.openidPatterns.some(p => openid.includes(p))) return true
    
    // 检查昵称
    const nickname = user.nickname || ''
    if (TEST_PATTERNS.nicknamePatterns.some(p => nickname.includes(p))) return true
    
    return false
  })

  console.log(`[${requestId}] 发现 ${testUsers.length} 个测试用户`)

  let deleted = 0
  if (!dryRun && testUsers.length > 0) {
    for (const user of testUsers) {
      await collection.doc(user._id).remove()
      deleted++
    }
    console.log(`[${requestId}] 已删除 ${deleted} 个测试用户`)
  }

  return {
    collection: 'users',
    found: testUsers.length,
    deleted,
    samples: testUsers.slice(0, 5).map(u => ({
      _id: u._id,
      nickname: u.nickname,
      openid: u.openid?.substring(0, 15) + '...'
    }))
  }
}

/**
 * 清理测试题目
 */
async function cleanupTestQuestions(dryRun: boolean, requestId: string): Promise<CleanupResult> {
  const collection = db.collection('questions')
  
  // 获取所有题目，在内存中筛选测试数据
  const allQuestions = await collection.limit(2000).get()
  
  const testQuestions = allQuestions.data.filter(q => {
    const question = q.question || ''
    const source = q.source || ''
    
    // 检查题目内容
    if (TEST_PATTERNS.questionPatterns.some(p => question.includes(p))) return true
    
    // 检查来源
    if (TEST_PATTERNS.questionPatterns.some(p => source.includes(p))) return true
    
    // 检查 ID 是否为测试 ID
    if (TEST_PATTERNS.testMarkers.some(m => (q._id || '').includes(m))) return true
    
    return false
  })

  console.log(`[${requestId}] 发现 ${testQuestions.length} 道测试题目`)

  let deleted = 0
  if (!dryRun && testQuestions.length > 0) {
    for (const q of testQuestions) {
      await collection.doc(q._id).remove()
      deleted++
    }
    console.log(`[${requestId}] 已删除 ${deleted} 道测试题目`)
  }

  return {
    collection: 'questions',
    found: testQuestions.length,
    deleted,
    samples: testQuestions.slice(0, 5).map(q => ({
      _id: q._id,
      question: q.question?.substring(0, 50) + '...',
      source: q.source
    }))
  }
}

/**
 * 清理测试错题记录
 */
async function cleanupTestMistakes(dryRun: boolean, requestId: string): Promise<CleanupResult> {
  const collection = db.collection('mistake_book')
  
  // 获取所有错题记录
  const allMistakes = await collection.limit(2000).get()
  
  const testMistakes = allMistakes.data.filter(m => {
    const userId = m.user_id || ''
    const content = m.question_content || ''
    
    // 检查用户 ID
    if (TEST_PATTERNS.userIds.includes(userId)) return true
    if (TEST_PATTERNS.testMarkers.some(marker => userId.includes(marker))) return true
    
    // 检查题目内容
    if (TEST_PATTERNS.questionPatterns.some(p => content.includes(p))) return true
    
    return false
  })

  console.log(`[${requestId}] 发现 ${testMistakes.length} 条测试错题记录`)

  let deleted = 0
  if (!dryRun && testMistakes.length > 0) {
    for (const m of testMistakes) {
      await collection.doc(m._id).remove()
      deleted++
    }
    console.log(`[${requestId}] 已删除 ${deleted} 条测试错题记录`)
  }

  return {
    collection: 'mistake_book',
    found: testMistakes.length,
    deleted,
    samples: testMistakes.slice(0, 5).map(m => ({
      _id: m._id,
      user_id: m.user_id,
      question_content: m.question_content?.substring(0, 30) + '...'
    }))
  }
}

/**
 * 清理测试练习记录
 */
async function cleanupTestPracticeRecords(dryRun: boolean, requestId: string): Promise<CleanupResult> {
  const collection = db.collection('practice_records')
  
  // 获取所有练习记录
  const allRecords = await collection.limit(5000).get()
  
  const testRecords = allRecords.data.filter(r => {
    const userId = r.user_id || ''
    const questionId = r.question_id || ''
    
    // 检查用户 ID
    if (TEST_PATTERNS.userIds.includes(userId)) return true
    if (TEST_PATTERNS.testMarkers.some(marker => userId.includes(marker))) return true
    
    // 检查题目 ID
    if (TEST_PATTERNS.testMarkers.some(marker => questionId.includes(marker))) return true
    
    return false
  })

  console.log(`[${requestId}] 发现 ${testRecords.length} 条测试练习记录`)

  let deleted = 0
  if (!dryRun && testRecords.length > 0) {
    for (const r of testRecords) {
      await collection.doc(r._id).remove()
      deleted++
    }
    console.log(`[${requestId}] 已删除 ${deleted} 条测试练习记录`)
  }

  return {
    collection: 'practice_records',
    found: testRecords.length,
    deleted,
    samples: testRecords.slice(0, 5).map(r => ({
      _id: r._id,
      user_id: r.user_id,
      question_id: r.question_id
    }))
  }
}

/**
 * 清理测试排行榜数据
 */
async function cleanupTestRankings(dryRun: boolean, requestId: string): Promise<CleanupResult> {
  const collection = db.collection('rankings')
  
  // 获取所有排行榜数据
  const allRankings = await collection.limit(1000).get()
  
  const testRankings = allRankings.data.filter(r => {
    const uid = r.uid || ''
    const nickName = r.nick_name || ''
    
    // 检查用户 ID
    if (TEST_PATTERNS.userIds.includes(uid)) return true
    if (TEST_PATTERNS.testMarkers.some(marker => uid.includes(marker))) return true
    
    // 检查昵称
    if (TEST_PATTERNS.nicknamePatterns.some(p => nickName.includes(p))) return true
    
    return false
  })

  console.log(`[${requestId}] 发现 ${testRankings.length} 条测试排行榜数据`)

  let deleted = 0
  if (!dryRun && testRankings.length > 0) {
    for (const r of testRankings) {
      await collection.doc(r._id).remove()
      deleted++
    }
    console.log(`[${requestId}] 已删除 ${deleted} 条测试排行榜数据`)
  }

  return {
    collection: 'rankings',
    found: testRankings.length,
    deleted,
    samples: testRankings.slice(0, 5).map(r => ({
      _id: r._id,
      uid: r.uid,
      nick_name: r.nick_name
    }))
  }
}

/**
 * 清理测试好友关系
 */
async function cleanupTestFriends(dryRun: boolean, requestId: string): Promise<CleanupResult> {
  const collection = db.collection('friends')
  
  // 获取所有好友关系
  const allFriends = await collection.limit(2000).get()
  
  const testFriends = allFriends.data.filter(f => {
    const userId = f.user_id || ''
    const friendId = f.friend_id || ''
    
    // 检查用户 ID
    if (TEST_PATTERNS.userIds.includes(userId)) return true
    if (TEST_PATTERNS.userIds.includes(friendId)) return true
    if (TEST_PATTERNS.testMarkers.some(marker => userId.includes(marker))) return true
    if (TEST_PATTERNS.testMarkers.some(marker => friendId.includes(marker))) return true
    
    return false
  })

  console.log(`[${requestId}] 发现 ${testFriends.length} 条测试好友关系`)

  let deleted = 0
  if (!dryRun && testFriends.length > 0) {
    for (const f of testFriends) {
      await collection.doc(f._id).remove()
      deleted++
    }
    console.log(`[${requestId}] 已删除 ${deleted} 条测试好友关系`)
  }

  return {
    collection: 'friends',
    found: testFriends.length,
    deleted,
    samples: testFriends.slice(0, 5).map(f => ({
      _id: f._id,
      user_id: f.user_id,
      friend_id: f.friend_id
    }))
  }
}
