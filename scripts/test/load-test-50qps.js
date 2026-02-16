/**
 * 后端压力测试脚本 - 50 QPS 并发测试
 * 
 * 测试目标：
 * 1. aiCoreService (proxy-ai) - GLM-4-Plus 超时处理机制
 * 2. studyService (rank-center, social-service) - 高并发稳定性
 * 
 * 运行方式：
 * node scripts/test/load-test-50qps.js
 * 
 * @version 1.0.0
 */

const BASE_URL = 'https://nf98ia8qnt.sealosbja.site'

// 测试配置
const CONFIG = {
  // 目标 QPS
  targetQPS: 50,
  // 测试持续时间（秒）
  duration: 30,
  // 请求超时时间（毫秒）
  timeout: 30000,
  // AI 服务超时阈值（毫秒）- GLM-4-Plus 预期响应时间
  aiTimeoutThreshold: 15000,
  // 普通服务超时阈值（毫秒）
  normalTimeoutThreshold: 3000
}

// 测试端点配置
const ENDPOINTS = {
  // AI 核心服务
  aiCore: {
    name: 'AI Core Service (proxy-ai)',
    endpoint: '/proxy-ai',
    method: 'POST',
    testCases: [
      {
        name: 'chat (glm-4-flash)',
        data: { action: 'chat', content: '考研英语阅读理解有什么技巧？' },
        expectedModel: 'glm-4-flash',
        timeoutThreshold: 10000
      },
      {
        name: 'adaptive_pick (glm-4.5-air)',
        data: {
          action: 'adaptive_pick',
          content: '推荐题目',
          userProfile: { correctRate: 70, questionCount: 3 }
        },
        expectedModel: 'glm-4.5-air',
        timeoutThreshold: 15000
      },
      {
        name: 'analyze (glm-4.5-air)',
        data: {
          action: 'analyze',
          content: '设函数f(x)在x=0处可导，求极限',
          question: '设函数f(x)在x=0处可导，且f(0)=0，则lim(x→0) f(x)/x = ?',
          userAnswer: 'A',
          correctAnswer: 'B'
        },
        expectedModel: 'glm-4.5-air',
        timeoutThreshold: 15000
      }
    ]
  },
  // 学习服务
  study: {
    name: 'Study Service (rank-center)',
    endpoint: '/rank-center',
    method: 'POST',
    testCases: [
      {
        name: 'get daily rank',
        data: { action: 'get', rankType: 'daily', limit: 50 },
        timeoutThreshold: 3000
      },
      {
        name: 'get user rank',
        data: { action: 'getUserRank', uid: 'test_user_001', rankType: 'daily' },
        timeoutThreshold: 3000
      },
      {
        name: 'update score',
        data: { action: 'update', uid: `stress_test_${Date.now()}`, score: 10, nickName: '压测用户' },
        timeoutThreshold: 3000
      }
    ]
  },
  // 社交服务
  social: {
    name: 'Social Service',
    endpoint: '/social-service',
    method: 'POST',
    testCases: [
      {
        name: 'search user',
        data: { action: 'search_user', keyword: '考研' },
        timeoutThreshold: 3000
      },
      {
        name: 'get friend list',
        data: { action: 'get_friend_list', userId: 'test_user_001' },
        timeoutThreshold: 3000
      }
    ]
  }
}

// 统计数据
const stats = {
  totalRequests: 0,
  successRequests: 0,
  failedRequests: 0,
  timeoutRequests: 0,
  latencies: [],
  errors: [],
  byEndpoint: {},
  startTime: null,
  endTime: null
}

/**
 * 发送单个请求
 */
async function sendRequest(endpoint, testCase) {
  const startTime = Date.now()
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`
  
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), CONFIG.timeout)
    
    const response = await fetch(`${BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Request-Id': requestId
      },
      body: JSON.stringify(testCase.data),
      signal: controller.signal
    })
    
    clearTimeout(timeoutId)
    
    const latency = Date.now() - startTime
    const data = await response.json()
    
    // 检查是否超时（虽然请求成功但响应时间过长）
    const isSlowResponse = latency > (testCase.timeoutThreshold || CONFIG.normalTimeoutThreshold)
    
    return {
      success: data.code === 0,
      latency,
      isSlowResponse,
      statusCode: response.status,
      data,
      requestId,
      testCase: testCase.name
    }
    
  } catch (error) {
    const latency = Date.now() - startTime
    const isTimeout = error.name === 'AbortError' || latency >= CONFIG.timeout
    
    return {
      success: false,
      latency,
      isTimeout,
      error: error.message,
      requestId,
      testCase: testCase.name
    }
  }
}

/**
 * 运行单个服务的压力测试
 */
async function runServiceTest(serviceKey, service) {
  console.log(`\n${'='.repeat(60)}`)
  console.log(`开始测试: ${service.name}`)
  console.log(`端点: ${service.endpoint}`)
  console.log(`目标 QPS: ${CONFIG.targetQPS}`)
  console.log(`持续时间: ${CONFIG.duration}秒`)
  console.log(`${'='.repeat(60)}\n`)
  
  // 初始化服务统计
  stats.byEndpoint[serviceKey] = {
    total: 0,
    success: 0,
    failed: 0,
    timeout: 0,
    slowResponse: 0,
    latencies: [],
    errors: []
  }
  
  const serviceStats = stats.byEndpoint[serviceKey]
  const testCases = service.testCases
  const intervalMs = 1000 / CONFIG.targetQPS
  const totalRequests = CONFIG.targetQPS * CONFIG.duration
  
  let requestCount = 0
  const startTime = Date.now()
  
  // 创建请求队列
  const promises = []
  
  // 按照目标 QPS 发送请求
  for (let i = 0; i < totalRequests; i++) {
    // 轮询测试用例
    const testCase = testCases[i % testCases.length]
    
    // 计算应该发送请求的时间
    const scheduledTime = startTime + (i * intervalMs)
    const now = Date.now()
    const delay = Math.max(0, scheduledTime - now)
    
    const promise = new Promise(resolve => {
      setTimeout(async () => {
        const result = await sendRequest(service.endpoint, testCase)
        
        // 更新统计
        serviceStats.total++
        stats.totalRequests++
        
        if (result.success) {
          serviceStats.success++
          stats.successRequests++
        } else {
          serviceStats.failed++
          stats.failedRequests++
          
          if (result.isTimeout) {
            serviceStats.timeout++
            stats.timeoutRequests++
          }
          
          serviceStats.errors.push({
            testCase: result.testCase,
            error: result.error || result.data?.message,
            latency: result.latency
          })
        }
        
        if (result.isSlowResponse) {
          serviceStats.slowResponse++
        }
        
        serviceStats.latencies.push(result.latency)
        stats.latencies.push(result.latency)
        
        // 进度输出
        requestCount++
        if (requestCount % 50 === 0) {
          const elapsed = (Date.now() - startTime) / 1000
          const currentQPS = (requestCount / elapsed).toFixed(1)
          const successRate = ((serviceStats.success / serviceStats.total) * 100).toFixed(1)
          console.log(`[进度] ${requestCount}/${totalRequests} 请求 | QPS: ${currentQPS} | 成功率: ${successRate}%`)
        }
        
        resolve(result)
      }, delay)
    })
    
    promises.push(promise)
  }
  
  // 等待所有请求完成
  await Promise.all(promises)
  
  // 计算统计数据
  const sortedLatencies = [...serviceStats.latencies].sort((a, b) => a - b)
  const p50 = sortedLatencies[Math.floor(sortedLatencies.length * 0.5)]
  const p95 = sortedLatencies[Math.floor(sortedLatencies.length * 0.95)]
  const p99 = sortedLatencies[Math.floor(sortedLatencies.length * 0.99)]
  const avg = serviceStats.latencies.reduce((a, b) => a + b, 0) / serviceStats.latencies.length
  const max = Math.max(...serviceStats.latencies)
  const min = Math.min(...serviceStats.latencies)
  
  // 输出服务测试结果
  console.log(`\n${'─'.repeat(60)}`)
  console.log(`${service.name} 测试结果`)
  console.log(`${'─'.repeat(60)}`)
  console.log(`总请求数: ${serviceStats.total}`)
  console.log(`成功请求: ${serviceStats.success} (${((serviceStats.success / serviceStats.total) * 100).toFixed(2)}%)`)
  console.log(`失败请求: ${serviceStats.failed} (${((serviceStats.failed / serviceStats.total) * 100).toFixed(2)}%)`)
  console.log(`超时请求: ${serviceStats.timeout}`)
  console.log(`慢响应数: ${serviceStats.slowResponse}`)
  console.log(`\n延迟统计:`)
  console.log(`  最小: ${min}ms`)
  console.log(`  最大: ${max}ms`)
  console.log(`  平均: ${avg.toFixed(0)}ms`)
  console.log(`  P50:  ${p50}ms`)
  console.log(`  P95:  ${p95}ms`)
  console.log(`  P99:  ${p99}ms`)
  
  if (serviceStats.errors.length > 0) {
    console.log(`\n错误样本 (前5个):`)
    serviceStats.errors.slice(0, 5).forEach((err, i) => {
      console.log(`  ${i + 1}. [${err.testCase}] ${err.error} (${err.latency}ms)`)
    })
  }
  
  return {
    service: service.name,
    stats: serviceStats,
    latencyStats: { min, max, avg, p50, p95, p99 }
  }
}

/**
 * GLM-4-Plus 超时处理机制专项测试
 */
async function testGLMTimeoutHandling() {
  console.log(`\n${'='.repeat(60)}`)
  console.log(`GLM-4-Plus 超时处理机制专项测试`)
  console.log(`${'='.repeat(60)}\n`)
  
  const testCases = [
    {
      name: '长文本生成 (预期较慢)',
      data: {
        action: 'generate_questions',
        content: '马克思主义哲学是科学的世界观和方法论。它是关于自然、社会和思维发展一般规律的科学，是无产阶级和人类解放的科学。马克思主义哲学的产生是哲学史上的伟大变革，它使哲学第一次成为科学形态的世界观。请根据这段内容生成5道考研政治选择题。',
        questionCount: 5
      },
      expectedTimeout: 20000
    },
    {
      name: '复杂分析任务',
      data: {
        action: 'analyze',
        content: '这是一道复杂的数学分析题',
        question: '设f(x)在[0,1]上连续，在(0,1)内可导，且f(0)=0, f(1)=1，证明存在ξ∈(0,1)使得f\'(ξ)=2ξ',
        userAnswer: '使用拉格朗日中值定理',
        correctAnswer: '构造辅助函数g(x)=f(x)-x²'
      },
      expectedTimeout: 15000
    },
    {
      name: '趋势预测 (大量数据处理)',
      data: {
        action: 'trend_predict',
        content: '预测2026年考研政治热点',
        historicalData: {
          '2024': ['中国式现代化', '新质生产力', '高质量发展'],
          '2023': ['党的二十大', '共同富裕', '全过程人民民主'],
          '2022': ['建党百年', '脱贫攻坚', '乡村振兴'],
          '2021': ['十四五规划', '双循环', '碳达峰碳中和']
        },
        examYear: 2026,
        subject: 'politics'
      },
      expectedTimeout: 18000
    }
  ]
  
  const results = []
  
  for (const testCase of testCases) {
    console.log(`\n测试: ${testCase.name}`)
    console.log(`预期超时阈值: ${testCase.expectedTimeout}ms`)
    
    const startTime = Date.now()
    
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), testCase.expectedTimeout + 5000)
      
      const response = await fetch(`${BASE_URL}/proxy-ai`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testCase.data),
        signal: controller.signal
      })
      
      clearTimeout(timeoutId)
      
      const latency = Date.now() - startTime
      const data = await response.json()
      
      const status = latency <= testCase.expectedTimeout ? 'PASS' : 'WARN'
      const timeoutHandled = data.code === 0 || (data.code === -1 && data.message?.includes('超时'))
      
      console.log(`  响应时间: ${latency}ms`)
      console.log(`  状态码: ${data.code}`)
      console.log(`  超时处理: ${timeoutHandled ? '正常' : '异常'}`)
      console.log(`  结果: [${status}]`)
      
      results.push({
        name: testCase.name,
        latency,
        expectedTimeout: testCase.expectedTimeout,
        passed: status === 'PASS',
        timeoutHandled
      })
      
    } catch (error) {
      const latency = Date.now() - startTime
      const isTimeout = error.name === 'AbortError'
      
      console.log(`  响应时间: ${latency}ms`)
      console.log(`  错误: ${error.message}`)
      console.log(`  是否超时: ${isTimeout}`)
      console.log(`  结果: [${isTimeout ? 'TIMEOUT' : 'FAIL'}]`)
      
      results.push({
        name: testCase.name,
        latency,
        expectedTimeout: testCase.expectedTimeout,
        passed: false,
        error: error.message,
        isTimeout
      })
    }
  }
  
  return results
}

/**
 * 生成测试报告
 */
function generateReport(serviceResults, timeoutResults) {
  console.log(`\n${'='.repeat(60)}`)
  console.log(`压力测试总报告`)
  console.log(`${'='.repeat(60)}`)
  console.log(`测试时间: ${new Date().toISOString()}`)
  console.log(`目标服务: ${BASE_URL}`)
  console.log(`目标 QPS: ${CONFIG.targetQPS}`)
  console.log(`测试时长: ${CONFIG.duration}秒`)
  
  console.log(`\n${'─'.repeat(60)}`)
  console.log(`总体统计`)
  console.log(`${'─'.repeat(60)}`)
  console.log(`总请求数: ${stats.totalRequests}`)
  console.log(`成功请求: ${stats.successRequests} (${((stats.successRequests / stats.totalRequests) * 100).toFixed(2)}%)`)
  console.log(`失败请求: ${stats.failedRequests} (${((stats.failedRequests / stats.totalRequests) * 100).toFixed(2)}%)`)
  console.log(`超时请求: ${stats.timeoutRequests}`)
  
  // 总体延迟统计
  if (stats.latencies.length > 0) {
    const sortedLatencies = [...stats.latencies].sort((a, b) => a - b)
    const p50 = sortedLatencies[Math.floor(sortedLatencies.length * 0.5)]
    const p95 = sortedLatencies[Math.floor(sortedLatencies.length * 0.95)]
    const p99 = sortedLatencies[Math.floor(sortedLatencies.length * 0.99)]
    const avg = stats.latencies.reduce((a, b) => a + b, 0) / stats.latencies.length
    
    console.log(`\n总体延迟:`)
    console.log(`  平均: ${avg.toFixed(0)}ms`)
    console.log(`  P50:  ${p50}ms`)
    console.log(`  P95:  ${p95}ms`)
    console.log(`  P99:  ${p99}ms`)
  }
  
  // 各服务统计
  console.log(`\n${'─'.repeat(60)}`)
  console.log(`各服务统计`)
  console.log(`${'─'.repeat(60)}`)
  
  for (const result of serviceResults) {
    console.log(`\n${result.service}:`)
    console.log(`  成功率: ${((result.stats.success / result.stats.total) * 100).toFixed(2)}%`)
    console.log(`  P95延迟: ${result.latencyStats.p95}ms`)
    console.log(`  超时数: ${result.stats.timeout}`)
    console.log(`  慢响应: ${result.stats.slowResponse}`)
  }
  
  // GLM 超时测试结果
  console.log(`\n${'─'.repeat(60)}`)
  console.log(`GLM-4-Plus 超时处理测试`)
  console.log(`${'─'.repeat(60)}`)
  
  for (const result of timeoutResults) {
    const status = result.passed ? 'PASS' : (result.isTimeout ? 'TIMEOUT' : 'FAIL')
    console.log(`  ${result.name}: [${status}] ${result.latency}ms / ${result.expectedTimeout}ms`)
  }
  
  // 结论和建议
  console.log(`\n${'─'.repeat(60)}`)
  console.log(`结论与建议`)
  console.log(`${'─'.repeat(60)}`)
  
  const successRate = (stats.successRequests / stats.totalRequests) * 100
  const timeoutRate = (stats.timeoutRequests / stats.totalRequests) * 100
  
  if (successRate >= 99) {
    console.log(`[PASS] 系统在 ${CONFIG.targetQPS} QPS 下表现优秀，成功率 ${successRate.toFixed(2)}%`)
  } else if (successRate >= 95) {
    console.log(`[WARN] 系统在 ${CONFIG.targetQPS} QPS 下基本稳定，但成功率 ${successRate.toFixed(2)}% 有提升空间`)
  } else {
    console.log(`[FAIL] 系统在 ${CONFIG.targetQPS} QPS 下不稳定，成功率仅 ${successRate.toFixed(2)}%`)
  }
  
  if (timeoutRate > 5) {
    console.log(`[WARN] 超时率 ${timeoutRate.toFixed(2)}% 较高，建议:`)
    console.log(`  1. 检查 GLM API 响应时间`)
    console.log(`  2. 考虑增加请求超时时间`)
    console.log(`  3. 实现请求重试机制`)
    console.log(`  4. 考虑使用更快的模型 (glm-4-flash) 处理简单请求`)
  }
  
  // 返回测试结果
  return {
    passed: successRate >= 95 && timeoutRate <= 10,
    successRate,
    timeoutRate,
    totalRequests: stats.totalRequests,
    serviceResults,
    timeoutResults
  }
}

/**
 * 主函数
 */
async function main() {
  console.log('========================================')
  console.log('后端压力测试 - 50 QPS')
  console.log('========================================\n')
  console.log(`目标服务器: ${BASE_URL}`)
  console.log(`测试配置:`)
  console.log(`  - 目标 QPS: ${CONFIG.targetQPS}`)
  console.log(`  - 持续时间: ${CONFIG.duration}秒`)
  console.log(`  - 请求超时: ${CONFIG.timeout}ms`)
  console.log(`  - AI超时阈值: ${CONFIG.aiTimeoutThreshold}ms`)
  
  stats.startTime = Date.now()
  
  const serviceResults = []
  
  // 1. 测试各服务
  for (const [key, service] of Object.entries(ENDPOINTS)) {
    const result = await runServiceTest(key, service)
    serviceResults.push(result)
  }
  
  // 2. GLM 超时处理专项测试
  const timeoutResults = await testGLMTimeoutHandling()
  
  stats.endTime = Date.now()
  
  // 3. 生成报告
  const report = generateReport(serviceResults, timeoutResults)
  
  console.log(`\n测试总耗时: ${((stats.endTime - stats.startTime) / 1000).toFixed(1)}秒`)
  
  // 返回退出码
  process.exit(report.passed ? 0 : 1)
}

// 执行
main().catch(error => {
  console.error('测试执行失败:', error)
  process.exit(1)
})
