/**
 * 压力测试脚本
 * 
 * 功能：对 aiCoreService 和 studyService 进行 50 QPS 的并发压力测试
 * 
 * 使用方法：
 * 1. 配置环境变量 LAF_API_URL
 * 2. 运行: npx ts-node scripts/load-test.ts
 * 
 * @version 1.0.0
 * @author EXAM-MASTER Backend Team
 */

// 配置
const LAF_API_URL = process.env.LAF_API_URL || 'https://your-laf-app.laf.run'
const TEST_DURATION_SECONDS = 60  // 测试持续时间
const TARGET_QPS = 50             // 目标 QPS
const TIMEOUT_MS = 60000          // 请求超时时间

// 测试结果统计
interface TestResult {
  endpoint: string
  totalRequests: number
  successCount: number
  failCount: number
  timeoutCount: number
  avgResponseTime: number
  maxResponseTime: number
  minResponseTime: number
  p95ResponseTime: number
  p99ResponseTime: number
  errorTypes: Record<string, number>
}

// 模拟请求
async function makeRequest(endpoint: string, payload: any): Promise<{ success: boolean; duration: number; error?: string }> {
  const startTime = Date.now()
  
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS)
    
    const response = await fetch(`${LAF_API_URL}/${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Audit-Mode': 'test',
        'X-Audit-Token': `${Date.now()}_test`
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    })
    
    clearTimeout(timeoutId)
    
    const duration = Date.now() - startTime
    const data = await response.json()
    
    if (data.code === 0 || data.success) {
      return { success: true, duration }
    } else {
      return { success: false, duration, error: data.message || 'Unknown error' }
    }
    
  } catch (error: any) {
    const duration = Date.now() - startTime
    
    if (error.name === 'AbortError') {
      return { success: false, duration, error: 'TIMEOUT' }
    }
    
    return { success: false, duration, error: error.message || 'Network error' }
  }
}

// 计算百分位数
function percentile(arr: number[], p: number): number {
  if (arr.length === 0) return 0
  const sorted = [...arr].sort((a, b) => a - b)
  const index = Math.ceil((p / 100) * sorted.length) - 1
  return sorted[Math.max(0, index)]
}

// 运行压力测试
async function runLoadTest(endpoint: string, payloadGenerator: () => any): Promise<TestResult> {
  console.log(`\n🚀 开始测试 ${endpoint}...`)
  console.log(`   目标 QPS: ${TARGET_QPS}`)
  console.log(`   持续时间: ${TEST_DURATION_SECONDS}s`)
  console.log(`   超时时间: ${TIMEOUT_MS}ms`)
  
  const responseTimes: number[] = []
  const errorTypes: Record<string, number> = {}
  let successCount = 0
  let failCount = 0
  let timeoutCount = 0
  
  const intervalMs = 1000 / TARGET_QPS
  const totalRequests = TARGET_QPS * TEST_DURATION_SECONDS
  
  const startTime = Date.now()
  const promises: Promise<void>[] = []
  
  for (let i = 0; i < totalRequests; i++) {
    const delay = i * intervalMs
    
    const promise = new Promise<void>(async (resolve) => {
      await new Promise(r => setTimeout(r, delay))
      
      const result = await makeRequest(endpoint, payloadGenerator())
      
      responseTimes.push(result.duration)
      
      if (result.success) {
        successCount++
      } else {
        failCount++
        
        if (result.error === 'TIMEOUT') {
          timeoutCount++
        }
        
        const errorKey = result.error || 'Unknown'
        errorTypes[errorKey] = (errorTypes[errorKey] || 0) + 1
      }
      
      // 进度显示
      const progress = Math.round(((i + 1) / totalRequests) * 100)
      if (progress % 10 === 0) {
        process.stdout.write(`\r   进度: ${progress}%`)
      }
      
      resolve()
    })
    
    promises.push(promise)
  }
  
  await Promise.all(promises)
  
  const totalDuration = Date.now() - startTime
  const actualQPS = totalRequests / (totalDuration / 1000)
  
  console.log(`\n   实际 QPS: ${actualQPS.toFixed(2)}`)
  
  return {
    endpoint,
    totalRequests,
    successCount,
    failCount,
    timeoutCount,
    avgResponseTime: responseTimes.length > 0 ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length : 0,
    maxResponseTime: Math.max(...responseTimes, 0),
    minResponseTime: Math.min(...responseTimes, Infinity),
    p95ResponseTime: percentile(responseTimes, 95),
    p99ResponseTime: percentile(responseTimes, 99),
    errorTypes
  }
}

// 打印测试结果
function printResult(result: TestResult) {
  console.log(`\n📊 测试结果: ${result.endpoint}`)
  console.log('─'.repeat(50))
  console.log(`   总请求数: ${result.totalRequests}`)
  console.log(`   成功数: ${result.successCount} (${((result.successCount / result.totalRequests) * 100).toFixed(2)}%)`)
  console.log(`   失败数: ${result.failCount} (${((result.failCount / result.totalRequests) * 100).toFixed(2)}%)`)
  console.log(`   超时数: ${result.timeoutCount}`)
  console.log(`   平均响应时间: ${result.avgResponseTime.toFixed(2)}ms`)
  console.log(`   最小响应时间: ${result.minResponseTime.toFixed(2)}ms`)
  console.log(`   最大响应时间: ${result.maxResponseTime.toFixed(2)}ms`)
  console.log(`   P95 响应时间: ${result.p95ResponseTime.toFixed(2)}ms`)
  console.log(`   P99 响应时间: ${result.p99ResponseTime.toFixed(2)}ms`)
  
  if (Object.keys(result.errorTypes).length > 0) {
    console.log(`   错误类型分布:`)
    for (const [type, count] of Object.entries(result.errorTypes)) {
      console.log(`     - ${type}: ${count}`)
    }
  }
}

// 主函数
async function main() {
  console.log('═'.repeat(60))
  console.log('  EXAM-MASTER 后端压力测试')
  console.log('═'.repeat(60))
  console.log(`\n📍 API 地址: ${LAF_API_URL}`)
  
  // 测试 1: proxy-ai (aiCoreService)
  const aiResult = await runLoadTest('proxy-ai', () => ({
    action: 'chat',
    content: '什么是考研？',
    userId: `test_${Date.now()}`
  }))
  printResult(aiResult)
  
  // 测试 2: rank-center (studyService)
  const rankResult = await runLoadTest('rank-center', () => ({
    action: 'get',
    rankType: 'daily',
    limit: 10
  }))
  printResult(rankResult)
  
  // 测试 3: social-service
  const socialResult = await runLoadTest('social-service', () => ({
    action: 'get_friend_list',
    userId: `test_${Date.now()}`
  }))
  printResult(socialResult)
  
  // 汇总报告
  console.log('\n' + '═'.repeat(60))
  console.log('  测试汇总')
  console.log('═'.repeat(60))
  
  const allResults = [aiResult, rankResult, socialResult]
  const totalSuccess = allResults.reduce((sum, r) => sum + r.successCount, 0)
  const totalFail = allResults.reduce((sum, r) => sum + r.failCount, 0)
  const totalTimeout = allResults.reduce((sum, r) => sum + r.timeoutCount, 0)
  const totalRequests = allResults.reduce((sum, r) => sum + r.totalRequests, 0)
  
  console.log(`\n   总请求数: ${totalRequests}`)
  console.log(`   总成功率: ${((totalSuccess / totalRequests) * 100).toFixed(2)}%`)
  console.log(`   总超时数: ${totalTimeout}`)
  
  // 判断测试是否通过
  const successRate = totalSuccess / totalRequests
  const avgP99 = allResults.reduce((sum, r) => sum + r.p99ResponseTime, 0) / allResults.length
  
  console.log('\n' + '─'.repeat(60))
  
  if (successRate >= 0.95 && avgP99 < TIMEOUT_MS) {
    console.log('✅ 压力测试通过！')
    console.log(`   - 成功率 ${(successRate * 100).toFixed(2)}% >= 95%`)
    console.log(`   - 平均 P99 响应时间 ${avgP99.toFixed(2)}ms < ${TIMEOUT_MS}ms`)
  } else {
    console.log('❌ 压力测试未通过！')
    if (successRate < 0.95) {
      console.log(`   - 成功率 ${(successRate * 100).toFixed(2)}% < 95%`)
    }
    if (avgP99 >= TIMEOUT_MS) {
      console.log(`   - 平均 P99 响应时间 ${avgP99.toFixed(2)}ms >= ${TIMEOUT_MS}ms`)
    }
  }
  
  console.log('\n' + '═'.repeat(60))
}

// 运行
main().catch(console.error)
