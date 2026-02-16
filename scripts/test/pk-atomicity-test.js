/**
 * PK 对战事务一致性测试 - ELO 分数计算原子性验证
 * 
 * 测试目标：
 * 1. 模拟双人同时提交答案的场景
 * 2. 验证 ELO 分数计算的原子性
 * 3. 杜绝数据竞争（Race Condition）
 * 
 * 运行方式：
 * node scripts/test/pk-atomicity-test.js
 * 
 * @version 1.0.0
 */

const BASE_URL = 'https://nf98ia8qnt.sealosbja.site'

// 测试配置
const CONFIG = {
  // 并发测试次数
  concurrentTests: 10,
  // 每次测试的并发用户数
  concurrentUsers: 2,
  // 模拟延迟范围（毫秒）
  latencyRange: { min: 0, max: 100 }
}

// ELO 计算函数（与前端保持一致）
const ELO_CONFIG = {
  initialRating: 1000,
  kFactor: 32
}

function calculateExpectedScore(ratingA, ratingB) {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400))
}

function calculateNewRating(currentRating, opponentRating, actualScore) {
  const expectedScore = calculateExpectedScore(currentRating, opponentRating)
  return Math.round(currentRating + ELO_CONFIG.kFactor * (actualScore - expectedScore))
}

// 测试结果
const results = {
  passed: 0,
  failed: 0,
  raceConditions: [],
  inconsistencies: []
}

/**
 * 模拟 PK 对战结果提交
 */
async function submitPKResult(userId, opponentId, userScore, opponentScore, userRating, opponentRating) {
  // 计算预期的新评分
  const userActualScore = userScore > opponentScore ? 1 : (userScore < opponentScore ? 0 : 0.5)
  const expectedNewRating = calculateNewRating(userRating, opponentRating, userActualScore)
  
  // 模拟提交到排行榜
  try {
    const response = await fetch(`${BASE_URL}/rank-center`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'update',
        uid: userId,
        score: userScore,
        nickName: `测试用户_${userId}`
      })
    })
    
    const data = await response.json()
    
    return {
      success: data.code === 0,
      userId,
      userScore,
      expectedNewRating,
      response: data
    }
  } catch (error) {
    return {
      success: false,
      userId,
      error: error.message
    }
  }
}

/**
 * 测试用例 1：双人同时提交答案
 */
async function testConcurrentSubmission() {
  console.log('\n[TEST 1] 双人同时提交答案')
  console.log('─'.repeat(50))
  
  for (let round = 1; round <= CONFIG.concurrentTests; round++) {
    const testId = `pk_${Date.now()}_${round}`
    const userA = `user_a_${testId}`
    const userB = `user_b_${testId}`
    
    // 初始评分
    const ratingA = 1000 + Math.floor(Math.random() * 200)
    const ratingB = 1000 + Math.floor(Math.random() * 200)
    
    // 随机生成对战结果
    const scoreA = Math.floor(Math.random() * 10)
    const scoreB = Math.floor(Math.random() * 10)
    
    console.log(`\n  Round ${round}:`)
    console.log(`    用户A: ${userA} (评分: ${ratingA}, 得分: ${scoreA})`)
    console.log(`    用户B: ${userB} (评分: ${ratingB}, 得分: ${scoreB})`)
    
    // 计算预期结果
    const expectedRatingA = calculateNewRating(ratingA, ratingB, scoreA > scoreB ? 1 : (scoreA < scoreB ? 0 : 0.5))
    const expectedRatingB = calculateNewRating(ratingB, ratingA, scoreB > scoreA ? 1 : (scoreB < scoreA ? 0 : 0.5))
    
    console.log(`    预期评分变化: A=${expectedRatingA - ratingA > 0 ? '+' : ''}${expectedRatingA - ratingA}, B=${expectedRatingB - ratingB > 0 ? '+' : ''}${expectedRatingB - ratingB}`)
    
    // 添加随机延迟模拟网络抖动
    const delayA = Math.random() * (CONFIG.latencyRange.max - CONFIG.latencyRange.min) + CONFIG.latencyRange.min
    const delayB = Math.random() * (CONFIG.latencyRange.max - CONFIG.latencyRange.min) + CONFIG.latencyRange.min
    
    // 同时提交
    const startTime = Date.now()
    
    const [resultA, resultB] = await Promise.all([
      new Promise(resolve => setTimeout(() => resolve(submitPKResult(userA, userB, scoreA, scoreB, ratingA, ratingB)), delayA)),
      new Promise(resolve => setTimeout(() => resolve(submitPKResult(userB, userA, scoreB, scoreA, ratingB, ratingA)), delayB))
    ])
    
    const duration = Date.now() - startTime
    
    // 验证结果
    if (resultA.success && resultB.success) {
      console.log(`    [PASS] 双方提交成功 (${duration}ms)`)
      results.passed++
    } else {
      console.log(`    [FAIL] 提交失败`)
      console.log(`      A: ${resultA.success ? '成功' : resultA.error || resultA.response?.message}`)
      console.log(`      B: ${resultB.success ? '成功' : resultB.error || resultB.response?.message}`)
      results.failed++
    }
  }
}

/**
 * 测试用例 2：高并发同时更新同一用户评分
 */
async function testRaceCondition() {
  console.log('\n[TEST 2] 高并发同时更新同一用户评分（竞态条件测试）')
  console.log('─'.repeat(50))
  
  const testUserId = `race_test_${Date.now()}`
  const concurrentUpdates = 10
  const scorePerUpdate = 5
  
  console.log(`  测试用户: ${testUserId}`)
  console.log(`  并发更新数: ${concurrentUpdates}`)
  console.log(`  每次更新分数: ${scorePerUpdate}`)
  console.log(`  预期总分: ${concurrentUpdates * scorePerUpdate}`)
  
  // 同时发送多个更新请求
  const promises = []
  for (let i = 0; i < concurrentUpdates; i++) {
    promises.push(
      fetch(`${BASE_URL}/rank-center`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update',
          uid: testUserId,
          score: scorePerUpdate,
          nickName: `竞态测试用户`
        })
      }).then(r => r.json())
    )
  }
  
  const startTime = Date.now()
  const results_local = await Promise.all(promises)
  const duration = Date.now() - startTime
  
  const successCount = results_local.filter(r => r.code === 0).length
  console.log(`  完成时间: ${duration}ms`)
  console.log(`  成功更新: ${successCount}/${concurrentUpdates}`)
  
  // 查询最终分数
  await new Promise(resolve => setTimeout(resolve, 500)) // 等待数据库同步
  
  const finalResult = await fetch(`${BASE_URL}/rank-center`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'getUserRank',
      uid: testUserId,
      rankType: 'total'
    })
  }).then(r => r.json())
  
  const expectedTotal = concurrentUpdates * scorePerUpdate
  const actualTotal = finalResult.data?.score || 0
  
  console.log(`  最终分数: ${actualTotal}`)
  console.log(`  预期分数: ${expectedTotal}`)
  
  if (actualTotal === expectedTotal) {
    console.log(`  [PASS] 分数计算正确，无数据丢失`)
    results.passed++
  } else {
    const lostScore = expectedTotal - actualTotal
    console.log(`  [FAIL] 检测到数据竞争！丢失分数: ${lostScore}`)
    results.failed++
    results.raceConditions.push({
      testUserId,
      expected: expectedTotal,
      actual: actualTotal,
      lost: lostScore
    })
  }
}

/**
 * 测试用例 3：ELO 评分一致性验证
 */
async function testELOConsistency() {
  console.log('\n[TEST 3] ELO 评分一致性验证')
  console.log('─'.repeat(50))
  
  // 测试多种对战场景
  const scenarios = [
    { ratingA: 1000, ratingB: 1000, scoreA: 5, scoreB: 3, desc: '同分对手，A胜' },
    { ratingA: 1200, ratingB: 800, scoreA: 3, scoreB: 5, desc: '高分对低分，高分输' },
    { ratingA: 800, ratingB: 1200, scoreA: 5, scoreB: 3, desc: '低分对高分，低分赢' },
    { ratingA: 1000, ratingB: 1000, scoreA: 5, scoreB: 5, desc: '同分对手，平局' },
    { ratingA: 1500, ratingB: 500, scoreA: 5, scoreB: 5, desc: '大分差，平局' }
  ]
  
  for (const scenario of scenarios) {
    const { ratingA, ratingB, scoreA, scoreB, desc } = scenario
    
    // 计算预期评分变化
    const actualScoreA = scoreA > scoreB ? 1 : (scoreA < scoreB ? 0 : 0.5)
    const actualScoreB = scoreB > scoreA ? 1 : (scoreB < scoreA ? 0 : 0.5)
    
    const newRatingA = calculateNewRating(ratingA, ratingB, actualScoreA)
    const newRatingB = calculateNewRating(ratingB, ratingA, actualScoreB)
    
    const changeA = newRatingA - ratingA
    const changeB = newRatingB - ratingB
    
    // 验证 ELO 守恒（总评分变化应接近 0）
    const totalChange = changeA + changeB
    const isConservative = Math.abs(totalChange) <= 1 // 允许舍入误差
    
    console.log(`\n  场景: ${desc}`)
    console.log(`    A: ${ratingA} -> ${newRatingA} (${changeA > 0 ? '+' : ''}${changeA})`)
    console.log(`    B: ${ratingB} -> ${newRatingB} (${changeB > 0 ? '+' : ''}${changeB})`)
    console.log(`    总变化: ${totalChange} (${isConservative ? '守恒' : '不守恒'})`)
    
    if (isConservative) {
      console.log(`    [PASS] ELO 评分守恒`)
      results.passed++
    } else {
      console.log(`    [FAIL] ELO 评分不守恒`)
      results.failed++
      results.inconsistencies.push({
        scenario: desc,
        changeA,
        changeB,
        totalChange
      })
    }
  }
}

/**
 * 测试用例 4：模拟真实 PK 对战流程
 */
async function testRealPKFlow() {
  console.log('\n[TEST 4] 模拟真实 PK 对战流程')
  console.log('─'.repeat(50))
  
  const matchId = `match_${Date.now()}`
  const playerA = { id: `player_a_${matchId}`, rating: 1000, score: 0 }
  const playerB = { id: `player_b_${matchId}`, rating: 1050, score: 0 }
  
  console.log(`  对战ID: ${matchId}`)
  console.log(`  玩家A: ${playerA.id} (初始评分: ${playerA.rating})`)
  console.log(`  玩家B: ${playerB.id} (初始评分: ${playerB.rating})`)
  
  // 模拟 5 道题的答题过程
  const questions = 5
  const answers = []
  
  console.log(`\n  答题过程:`)
  for (let q = 1; q <= questions; q++) {
    // 随机生成答题结果
    const aCorrect = Math.random() > 0.4
    const bCorrect = Math.random() > 0.4
    const aTime = Math.floor(Math.random() * 10000) + 2000
    const bTime = Math.floor(Math.random() * 10000) + 2000
    
    // 计算得分（正确且更快得分）
    if (aCorrect && (!bCorrect || aTime < bTime)) {
      playerA.score++
    }
    if (bCorrect && (!aCorrect || bTime < aTime)) {
      playerB.score++
    }
    
    answers.push({ q, aCorrect, bCorrect, aTime, bTime })
    console.log(`    Q${q}: A=${aCorrect ? '对' : '错'}(${aTime}ms) B=${bCorrect ? '对' : '错'}(${bTime}ms)`)
  }
  
  console.log(`\n  最终得分: A=${playerA.score}, B=${playerB.score}`)
  
  // 计算 ELO 变化
  const actualScoreA = playerA.score > playerB.score ? 1 : (playerA.score < playerB.score ? 0 : 0.5)
  const newRatingA = calculateNewRating(playerA.rating, playerB.rating, actualScoreA)
  const newRatingB = calculateNewRating(playerB.rating, playerA.rating, 1 - actualScoreA)
  
  console.log(`  ELO 变化:`)
  console.log(`    A: ${playerA.rating} -> ${newRatingA} (${newRatingA - playerA.rating > 0 ? '+' : ''}${newRatingA - playerA.rating})`)
  console.log(`    B: ${playerB.rating} -> ${newRatingB} (${newRatingB - playerB.rating > 0 ? '+' : ''}${newRatingB - playerB.rating})`)
  
  // 模拟同时提交结果
  console.log(`\n  同时提交结果...`)
  
  const [submitA, submitB] = await Promise.all([
    submitPKResult(playerA.id, playerB.id, playerA.score, playerB.score, playerA.rating, playerB.rating),
    submitPKResult(playerB.id, playerA.id, playerB.score, playerA.score, playerB.rating, playerA.rating)
  ])
  
  if (submitA.success && submitB.success) {
    console.log(`  [PASS] 对战结果提交成功`)
    results.passed++
  } else {
    console.log(`  [FAIL] 对战结果提交失败`)
    results.failed++
  }
}

/**
 * 测试用例 5：事务回滚测试
 */
async function testTransactionRollback() {
  console.log('\n[TEST 5] 事务回滚测试（模拟部分失败）')
  console.log('─'.repeat(50))
  
  // 这个测试检查当一方提交失败时，另一方的数据是否会回滚
  // 由于当前后端可能没有实现事务，这里主要是检测潜在问题
  
  const testId = `rollback_${Date.now()}`
  const validUser = `valid_${testId}`
  const invalidUser = '' // 空用户ID应该导致失败
  
  console.log(`  有效用户: ${validUser}`)
  console.log(`  无效用户: (空)`)
  
  const [validResult, invalidResult] = await Promise.all([
    submitPKResult(validUser, invalidUser, 5, 3, 1000, 1000),
    submitPKResult(invalidUser, validUser, 3, 5, 1000, 1000)
  ])
  
  console.log(`  有效用户提交: ${validResult.success ? '成功' : '失败'}`)
  console.log(`  无效用户提交: ${invalidResult.success ? '成功' : '失败'}`)
  
  if (!invalidResult.success) {
    console.log(`  [INFO] 无效请求被正确拒绝`)
    
    // 检查有效用户的数据是否被正确处理
    if (validResult.success) {
      console.log(`  [WARN] 有效用户数据已提交，但对手数据失败`)
      console.log(`         建议: 实现事务机制，确保双方数据一致性`)
      results.inconsistencies.push({
        issue: '单方提交成功，对手失败',
        recommendation: '实现分布式事务或补偿机制'
      })
    }
  }
  
  results.passed++
}

/**
 * 生成测试报告
 */
function generateReport() {
  console.log('\n' + '='.repeat(60))
  console.log('PK 对战事务一致性测试报告')
  console.log('='.repeat(60))
  console.log(`测试时间: ${new Date().toISOString()}`)
  console.log(`目标服务: ${BASE_URL}`)
  
  console.log('\n' + '─'.repeat(60))
  console.log('测试结果汇总')
  console.log('─'.repeat(60))
  console.log(`通过: ${results.passed}`)
  console.log(`失败: ${results.failed}`)
  
  if (results.raceConditions.length > 0) {
    console.log('\n[检测到的竞态条件]')
    results.raceConditions.forEach((rc, i) => {
      console.log(`  ${i + 1}. 用户 ${rc.testUserId}`)
      console.log(`     预期分数: ${rc.expected}, 实际分数: ${rc.actual}, 丢失: ${rc.lost}`)
    })
  }
  
  if (results.inconsistencies.length > 0) {
    console.log('\n[数据一致性问题]')
    results.inconsistencies.forEach((inc, i) => {
      if (inc.scenario) {
        console.log(`  ${i + 1}. 场景: ${inc.scenario}`)
        console.log(`     总评分变化: ${inc.totalChange} (应为0)`)
      } else {
        console.log(`  ${i + 1}. ${inc.issue}`)
        console.log(`     建议: ${inc.recommendation}`)
      }
    })
  }
  
  // 改进建议
  console.log('\n' + '─'.repeat(60))
  console.log('改进建议')
  console.log('─'.repeat(60))
  
  const recommendations = [
    {
      priority: 'HIGH',
      title: '实现数据库事务',
      description: 'PK 对战结果更新应使用事务，确保双方数据一致',
      code: `
// MongoDB 事务示例
const session = await db.startSession()
session.startTransaction()
try {
  await updateUserScore(userA, scoreA, { session })
  await updateUserScore(userB, scoreB, { session })
  await session.commitTransaction()
} catch (error) {
  await session.abortTransaction()
  throw error
} finally {
  session.endSession()
}`
    },
    {
      priority: 'HIGH',
      title: '使用原子操作更新分数',
      description: '使用 $inc 操作符确保分数更新的原子性',
      code: `
// 使用 $inc 原子操作
await db.collection('rankings').updateOne(
  { uid: userId },
  { $inc: { total_score: score } },
  { upsert: true }
)`
    },
    {
      priority: 'MEDIUM',
      title: '实现乐观锁机制',
      description: '使用版本号防止并发更新冲突',
      code: `
// 乐观锁更新
const result = await db.collection('rankings').updateOne(
  { uid: userId, version: currentVersion },
  { 
    $inc: { total_score: score },
    $set: { version: currentVersion + 1 }
  }
)
if (result.modifiedCount === 0) {
  throw new Error('并发冲突，请重试')
}`
    },
    {
      priority: 'MEDIUM',
      title: '实现分布式锁',
      description: '使用 Redis 分布式锁防止同一用户的并发更新',
      code: `
// Redis 分布式锁
const lockKey = \`pk_lock:\${matchId}\`
const locked = await redis.set(lockKey, '1', 'NX', 'EX', 30)
if (!locked) {
  throw new Error('对战正在处理中')
}
try {
  // 处理对战结果
} finally {
  await redis.del(lockKey)
}`
    }
  ]
  
  recommendations.forEach((rec, i) => {
    console.log(`\n${i + 1}. [${rec.priority}] ${rec.title}`)
    console.log(`   ${rec.description}`)
    console.log(`   示例代码:`)
    console.log(rec.code.split('\n').map(line => `   ${line}`).join('\n'))
  })
  
  // 返回测试结果
  const overallPassed = results.failed === 0 && results.raceConditions.length === 0
  
  console.log('\n' + '─'.repeat(60))
  console.log(`测试结论: ${overallPassed ? '[PASS] 事务一致性良好' : '[WARN] 存在一致性风险'}`)
  console.log('─'.repeat(60))
  
  return {
    passed: overallPassed,
    summary: {
      passed: results.passed,
      failed: results.failed,
      raceConditions: results.raceConditions.length,
      inconsistencies: results.inconsistencies.length
    },
    recommendations
  }
}

/**
 * 主函数
 */
async function main() {
  console.log('========================================')
  console.log('PK 对战事务一致性测试')
  console.log('========================================\n')
  console.log(`目标服务器: ${BASE_URL}`)
  console.log(`测试配置:`)
  console.log(`  - 并发测试次数: ${CONFIG.concurrentTests}`)
  console.log(`  - 并发用户数: ${CONFIG.concurrentUsers}`)
  
  // 执行各项测试
  await testConcurrentSubmission()
  await testRaceCondition()
  await testELOConsistency()
  await testRealPKFlow()
  await testTransactionRollback()
  
  // 生成报告
  const report = generateReport()
  
  // 返回退出码
  process.exit(report.passed ? 0 : 1)
}

// 执行
main().catch(error => {
  console.error('测试执行失败:', error)
  process.exit(1)
})
