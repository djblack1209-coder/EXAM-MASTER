/**
 * AI 功能集成测试脚本
 * 
 * 用于验证 AI 核心功能升级后的正确性
 * 
 * 运行方式：
 * node scripts/test/test-ai-upgrade.js
 * 
 * @version 1.0.0
 */

const BASE_URL = 'https://nf98ia8qnt.sealosbja.site'

// 测试配置
const TEST_CONFIG = {
  timeout: 30000,
  verbose: true
}

// 测试用例
const testCases = [
  {
    name: '拍照搜题 - 基础识别',
    endpoint: '/ai-photo-search',
    method: 'POST',
    data: {
      // 使用一个简单的测试图片 base64（实际测试时替换为真实图片）
      imageBase64: 'test_image_placeholder',
      subject: 'math'
    },
    expectedFields: ['code', 'data', 'requestId'],
    skip: true // 需要真实图片才能测试
  },
  {
    name: 'AI代理 - 智能组题',
    endpoint: '/proxy-ai',
    method: 'POST',
    data: {
      action: 'adaptive_pick',
      content: '请为我推荐适合的练习题',
      userProfile: {
        targetSchool: '清华大学',
        weakSubjects: ['数学'],
        correctRate: 65,
        streak: 7,
        questionCount: 5
      },
      mistakeStats: {
        '高等数学': { count: 10, rate: 0.4 },
        '线性代数': { count: 5, rate: 0.6 }
      },
      recentPractice: {
        avgDuration: 45,
        consecutiveCorrect: 3,
        consecutiveWrong: 0
      }
    },
    expectedFields: ['code', 'data', 'model']
  },
  {
    name: 'AI代理 - AI好友聊天',
    endpoint: '/proxy-ai',
    method: 'POST',
    data: {
      action: 'friend_chat',
      content: '我最近学习压力好大，感觉有点焦虑',
      friendType: 'yan-man',
      context: {
        emotion: 'anxious',
        conversationCount: 0,
        studyState: '正常',
        recentAccuracy: 60
      }
    },
    expectedFields: ['code', 'data']
  },
  {
    name: 'AI代理 - 错题分析',
    endpoint: '/proxy-ai',
    method: 'POST',
    data: {
      action: 'analyze',
      content: '设函数f(x)在x=0处可导，且f(0)=0，则lim(x→0) f(x)/x = ?',
      question: '设函数f(x)在x=0处可导，且f(0)=0，则lim(x→0) f(x)/x = ?',
      userAnswer: 'A',
      correctAnswer: 'B',
      context: {
        topicAccuracy: 50,
        consecutiveErrors: 2
      }
    },
    expectedFields: ['code', 'data']
  },
  {
    name: 'AI代理 - 资料理解出题',
    endpoint: '/proxy-ai',
    method: 'POST',
    data: {
      action: 'material_understand',
      content: '马克思主义哲学是科学的世界观和方法论。它是关于自然、社会和思维发展一般规律的科学，是无产阶级和人类解放的科学。马克思主义哲学的产生是哲学史上的伟大变革，它使哲学第一次成为科学形态的世界观。',
      materialType: '教材',
      difficulty: 3,
      topicFocus: '马克思主义哲学'
    },
    expectedFields: ['code', 'data']
  },
  {
    name: 'AI代理 - 趋势预测',
    endpoint: '/proxy-ai',
    method: 'POST',
    data: {
      action: 'trend_predict',
      content: '请预测2025年考研政治可能的考点',
      historicalData: {
        '2024': ['中国式现代化', '新质生产力'],
        '2023': ['党的二十大', '共同富裕'],
        '2022': ['建党百年', '全过程人民民主']
      },
      examYear: 2025,
      subject: 'politics'
    },
    expectedFields: ['code', 'data']
  },
  {
    name: 'AI代理 - 通用聊天',
    endpoint: '/proxy-ai',
    method: 'POST',
    data: {
      action: 'chat',
      content: '考研英语阅读理解有什么技巧？'
    },
    expectedFields: ['code', 'data']
  }
]

// 测试执行器
async function runTests() {
  console.log('========================================')
  console.log('AI 功能集成测试')
  console.log('========================================\n')
  
  const results = {
    total: 0,
    passed: 0,
    failed: 0,
    skipped: 0
  }
  
  for (const testCase of testCases) {
    results.total++
    
    if (testCase.skip) {
      console.log(`[SKIP] ${testCase.name}`)
      results.skipped++
      continue
    }
    
    try {
      console.log(`[TEST] ${testCase.name}...`)
      
      const startTime = Date.now()
      const response = await fetch(`${BASE_URL}${testCase.endpoint}`, {
        method: testCase.method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(testCase.data)
      })
      
      const data = await response.json()
      const duration = Date.now() - startTime
      
      // 验证响应
      let passed = true
      const errors = []
      
      // 检查必需字段
      for (const field of testCase.expectedFields) {
        if (!(field in data)) {
          passed = false
          errors.push(`缺少字段: ${field}`)
        }
      }
      
      // 检查返回码
      if (data.code !== 0) {
        passed = false
        errors.push(`返回码错误: ${data.code}, 消息: ${data.message}`)
      }
      
      if (passed) {
        console.log(`[PASS] ${testCase.name} (${duration}ms)`)
        results.passed++
        
        if (TEST_CONFIG.verbose) {
          console.log(`       响应预览: ${JSON.stringify(data).substring(0, 200)}...`)
        }
      } else {
        console.log(`[FAIL] ${testCase.name}`)
        console.log(`       错误: ${errors.join(', ')}`)
        results.failed++
      }
      
    } catch (error) {
      console.log(`[FAIL] ${testCase.name}`)
      console.log(`       异常: ${error.message}`)
      results.failed++
    }
    
    console.log('')
  }
  
  // 输出汇总
  console.log('========================================')
  console.log('测试汇总')
  console.log('========================================')
  console.log(`总计: ${results.total}`)
  console.log(`通过: ${results.passed}`)
  console.log(`失败: ${results.failed}`)
  console.log(`跳过: ${results.skipped}`)
  console.log(`通过率: ${((results.passed / (results.total - results.skipped)) * 100).toFixed(1)}%`)
  
  return results
}

// 性能基准测试
async function runBenchmark() {
  console.log('\n========================================')
  console.log('性能基准测试')
  console.log('========================================\n')
  
  const benchmarks = [
    {
      name: '快速聊天 (glm-4-flash)',
      endpoint: '/proxy-ai',
      data: {
        action: 'chat',
        content: '你好'
      },
      iterations: 3,
      expectedP95: 1500
    },
    {
      name: '智能组题 (glm-4.5-air)',
      endpoint: '/proxy-ai',
      data: {
        action: 'adaptive_pick',
        content: '推荐题目',
        userProfile: { correctRate: 70, questionCount: 3 }
      },
      iterations: 2,
      expectedP95: 3000
    }
  ]
  
  for (const benchmark of benchmarks) {
    const latencies = []
    
    console.log(`[BENCH] ${benchmark.name}...`)
    
    for (let i = 0; i < benchmark.iterations; i++) {
      const startTime = Date.now()
      
      try {
        await fetch(`${BASE_URL}${benchmark.endpoint}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(benchmark.data)
        })
        
        latencies.push(Date.now() - startTime)
      } catch (e) {
        console.log(`        迭代 ${i + 1} 失败: ${e.message}`)
      }
    }
    
    if (latencies.length > 0) {
      const sorted = latencies.sort((a, b) => a - b)
      const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length
      const p95 = sorted[Math.floor(sorted.length * 0.95)] || sorted[sorted.length - 1]
      
      const status = p95 <= benchmark.expectedP95 ? 'PASS' : 'WARN'
      
      console.log(`        平均: ${Math.round(avg)}ms, P95: ${p95}ms, 期望P95: ${benchmark.expectedP95}ms [${status}]`)
    }
    
    console.log('')
  }
}

// 主函数
async function main() {
  console.log('开始 AI 功能测试...\n')
  console.log(`目标服务器: ${BASE_URL}\n`)
  
  // 运行功能测试
  const results = await runTests()
  
  // 运行性能测试
  await runBenchmark()
  
  // 返回退出码
  process.exit(results.failed > 0 ? 1 : 0)
}

// 执行
main().catch(console.error)
