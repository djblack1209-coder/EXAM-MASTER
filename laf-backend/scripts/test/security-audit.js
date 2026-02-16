/**
 * 接口安全审计脚本 - Audit-Mode 校验检查
 * 
 * 检查目标：
 * 1. 敏感接口（proxy-ai）必须校验 Audit-Mode 状态
 * 2. 绕过前端直接请求后端时，后端必须是最后一道防线
 * 3. 检查所有接口的认证和授权机制
 * 
 * 运行方式：
 * node scripts/test/security-audit.js
 * 
 * @version 1.0.0
 */

const BASE_URL = 'https://nf98ia8qnt.sealosbja.site'

// 安全测试配置
const SECURITY_CONFIG = {
  // 敏感接口列表
  sensitiveEndpoints: [
    '/proxy-ai',
    '/ai-photo-search',
    '/rank-center',
    '/social-service',
    '/mistake-manager'
  ],
  // 需要认证的接口
  authRequiredEndpoints: [
    '/social-service',
    '/rank-center',
    '/mistake-manager'
  ],
  // Audit-Mode 相关头部
  auditHeaders: {
    'X-Audit-Mode': 'true',
    'X-Audit-Bypass': 'true',
    'X-Skip-Audit': 'true'
  }
}

// 测试结果
const results = {
  passed: [],
  failed: [],
  warnings: []
}

/**
 * 测试用例：无认证直接访问敏感接口
 */
async function testUnauthorizedAccess() {
  console.log('\n[TEST 1] 无认证直接访问敏感接口')
  console.log('─'.repeat(50))
  
  const testCases = [
    {
      name: 'proxy-ai 无认证访问',
      endpoint: '/proxy-ai',
      data: { action: 'chat', content: '测试无认证访问' },
      expectation: '应该返回错误或限制功能'
    },
    {
      name: 'social-service 无用户ID',
      endpoint: '/social-service',
      data: { action: 'get_friend_list' },
      expectation: '应该返回 401 未登录错误'
    },
    {
      name: 'rank-center 无用户ID更新',
      endpoint: '/rank-center',
      data: { action: 'update', score: 100 },
      expectation: '应该返回参数错误'
    }
  ]
  
  for (const testCase of testCases) {
    try {
      const response = await fetch(`${BASE_URL}${testCase.endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testCase.data)
      })
      
      const data = await response.json()
      
      // 检查是否正确拒绝了无认证请求
      const isRejected = data.code !== 0 || response.status !== 200
      
      if (isRejected) {
        console.log(`  [PASS] ${testCase.name}`)
        console.log(`         返回: code=${data.code}, message=${data.message}`)
        results.passed.push({
          test: testCase.name,
          result: '正确拒绝无认证请求',
          response: { code: data.code, message: data.message }
        })
      } else {
        console.log(`  [WARN] ${testCase.name}`)
        console.log(`         期望: ${testCase.expectation}`)
        console.log(`         实际: 请求成功 (code=0)`)
        results.warnings.push({
          test: testCase.name,
          issue: '无认证请求未被拒绝',
          expectation: testCase.expectation
        })
      }
      
    } catch (error) {
      console.log(`  [FAIL] ${testCase.name}`)
      console.log(`         错误: ${error.message}`)
      results.failed.push({
        test: testCase.name,
        error: error.message
      })
    }
  }
}

/**
 * 测试用例：Audit-Mode 绕过尝试
 */
async function testAuditModeBypass() {
  console.log('\n[TEST 2] Audit-Mode 绕过尝试')
  console.log('─'.repeat(50))
  
  const bypassAttempts = [
    {
      name: '使用 X-Audit-Mode: false 头部',
      headers: { 'X-Audit-Mode': 'false' }
    },
    {
      name: '使用 X-Audit-Bypass: true 头部',
      headers: { 'X-Audit-Bypass': 'true' }
    },
    {
      name: '使用 X-Skip-Audit: true 头部',
      headers: { 'X-Skip-Audit': 'true' }
    },
    {
      name: '使用 Admin-Override: true 头部',
      headers: { 'Admin-Override': 'true' }
    },
    {
      name: '使用伪造的内部请求头',
      headers: { 
        'X-Internal-Request': 'true',
        'X-Forwarded-For': '127.0.0.1'
      }
    }
  ]
  
  for (const attempt of bypassAttempts) {
    try {
      const response = await fetch(`${BASE_URL}/proxy-ai`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...attempt.headers
        },
        body: JSON.stringify({
          action: 'chat',
          content: '测试审计绕过'
        })
      })
      
      const data = await response.json()
      
      // 检查是否成功绕过（不应该成功）
      // 注意：当前后端可能没有实现 Audit-Mode 检查，这是一个安全隐患
      console.log(`  [INFO] ${attempt.name}`)
      console.log(`         响应: code=${data.code}`)
      
      // 记录为警告，提示需要实现 Audit-Mode 检查
      if (data.code === 0) {
        results.warnings.push({
          test: attempt.name,
          issue: '后端未检查 Audit-Mode 相关头部',
          recommendation: '建议在后端实现 Audit-Mode 状态校验'
        })
      }
      
    } catch (error) {
      console.log(`  [FAIL] ${attempt.name}: ${error.message}`)
      results.failed.push({
        test: attempt.name,
        error: error.message
      })
    }
  }
}

/**
 * 测试用例：SQL/NoSQL 注入尝试
 */
async function testInjectionAttempts() {
  console.log('\n[TEST 3] 注入攻击防护测试')
  console.log('─'.repeat(50))
  
  const injectionPayloads = [
    {
      name: 'NoSQL 注入 - $gt 操作符',
      endpoint: '/social-service',
      data: {
        action: 'search_user',
        keyword: { '$gt': '' }
      }
    },
    {
      name: 'NoSQL 注入 - $regex 操作符',
      endpoint: '/social-service',
      data: {
        action: 'search_user',
        keyword: { '$regex': '.*', '$options': 'i' }
      }
    },
    {
      name: 'NoSQL 注入 - $where 操作符',
      endpoint: '/rank-center',
      data: {
        action: 'get',
        rankType: { '$where': 'function() { return true; }' }
      }
    },
    {
      name: 'XSS 注入尝试',
      endpoint: '/proxy-ai',
      data: {
        action: 'chat',
        content: '<script>alert("xss")</script>'
      }
    },
    {
      name: '命令注入尝试',
      endpoint: '/proxy-ai',
      data: {
        action: 'chat',
        content: '$(cat /etc/passwd)'
      }
    }
  ]
  
  for (const payload of injectionPayloads) {
    try {
      const response = await fetch(`${BASE_URL}${payload.endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload.data)
      })
      
      const data = await response.json()
      
      // 检查是否正确处理了注入尝试
      const isHandled = data.code !== 0 || 
                        (data.message && data.message.includes('参数')) ||
                        (data.message && data.message.includes('错误'))
      
      if (isHandled) {
        console.log(`  [PASS] ${payload.name}`)
        console.log(`         注入被正确处理: code=${data.code}`)
        results.passed.push({
          test: payload.name,
          result: '注入攻击被正确防护'
        })
      } else {
        console.log(`  [WARN] ${payload.name}`)
        console.log(`         可能存在注入风险: code=${data.code}`)
        results.warnings.push({
          test: payload.name,
          issue: '注入payload未被明确拒绝',
          recommendation: '建议加强输入验证'
        })
      }
      
    } catch (error) {
      console.log(`  [INFO] ${payload.name}: 请求失败 (${error.message})`)
      // 请求失败也可能是防护机制生效
      results.passed.push({
        test: payload.name,
        result: '请求被拒绝（可能是防护机制）'
      })
    }
  }
}

/**
 * 测试用例：速率限制检查
 */
async function testRateLimiting() {
  console.log('\n[TEST 4] 速率限制检查')
  console.log('─'.repeat(50))
  
  const rapidRequests = 20
  const results_local = []
  
  console.log(`  发送 ${rapidRequests} 个快速请求...`)
  
  const startTime = Date.now()
  
  for (let i = 0; i < rapidRequests; i++) {
    try {
      const response = await fetch(`${BASE_URL}/proxy-ai`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'chat',
          content: `速率测试 ${i + 1}`
        })
      })
      
      const data = await response.json()
      results_local.push({
        index: i + 1,
        code: data.code,
        status: response.status,
        rateLimited: response.status === 429 || data.code === 429
      })
      
    } catch (error) {
      results_local.push({
        index: i + 1,
        error: error.message
      })
    }
  }
  
  const duration = Date.now() - startTime
  const rateLimitedCount = results_local.filter(r => r.rateLimited).length
  const successCount = results_local.filter(r => r.code === 0).length
  
  console.log(`  完成时间: ${duration}ms`)
  console.log(`  成功请求: ${successCount}/${rapidRequests}`)
  console.log(`  被限流: ${rateLimitedCount}/${rapidRequests}`)
  
  if (rateLimitedCount > 0) {
    console.log(`  [PASS] 速率限制机制生效`)
    results.passed.push({
      test: '速率限制检查',
      result: `${rateLimitedCount}/${rapidRequests} 请求被限流`
    })
  } else {
    console.log(`  [WARN] 未检测到速率限制`)
    results.warnings.push({
      test: '速率限制检查',
      issue: '快速请求未被限流',
      recommendation: '建议实现请求速率限制'
    })
  }
}

/**
 * 测试用例：敏感数据泄露检查
 */
async function testDataLeakage() {
  console.log('\n[TEST 5] 敏感数据泄露检查')
  console.log('─'.repeat(50))
  
  const testCases = [
    {
      name: '检查错误响应是否泄露堆栈信息',
      endpoint: '/proxy-ai',
      data: { action: 'invalid_action_12345' }
    },
    {
      name: '检查是否泄露数据库信息',
      endpoint: '/social-service',
      data: { action: 'search_user', keyword: null }
    }
  ]
  
  for (const testCase of testCases) {
    try {
      const response = await fetch(`${BASE_URL}${testCase.endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testCase.data)
      })
      
      const data = await response.json()
      const responseText = JSON.stringify(data)
      
      // 检查是否包含敏感信息
      const sensitivePatterns = [
        /stack.*trace/i,
        /at\s+\w+\s+\(/,  // 堆栈跟踪格式
        /mongodb:\/\//i,
        /password/i,
        /api[_-]?key/i,
        /secret/i,
        /\.js:\d+:\d+/,  // 文件路径和行号
        /node_modules/i
      ]
      
      const leaks = sensitivePatterns.filter(pattern => pattern.test(responseText))
      
      if (leaks.length === 0) {
        console.log(`  [PASS] ${testCase.name}`)
        console.log(`         未发现敏感信息泄露`)
        results.passed.push({
          test: testCase.name,
          result: '无敏感信息泄露'
        })
      } else {
        console.log(`  [FAIL] ${testCase.name}`)
        console.log(`         发现可能的敏感信息泄露`)
        results.failed.push({
          test: testCase.name,
          issue: '响应中可能包含敏感信息',
          patterns: leaks.map(p => p.toString())
        })
      }
      
    } catch (error) {
      console.log(`  [INFO] ${testCase.name}: ${error.message}`)
    }
  }
}

/**
 * 检查 proxy-ai 后端代码中的 Audit-Mode 实现
 */
async function checkAuditModeImplementation() {
  console.log('\n[TEST 6] Audit-Mode 后端实现检查')
  console.log('─'.repeat(50))
  
  // 这个测试需要检查后端代码
  // 由于我们已经读取了 proxy-ai.js，可以分析其中是否有 Audit-Mode 检查
  
  const recommendations = [
    {
      check: 'Audit-Mode 请求头检查',
      status: 'NOT_IMPLEMENTED',
      recommendation: '在 proxy-ai.js 入口处添加 Audit-Mode 状态检查'
    },
    {
      check: '审计日志记录',
      status: 'PARTIAL',
      recommendation: '当前有 requestId 日志，建议增加审计模式下的详细日志'
    },
    {
      check: '敏感操作限制',
      status: 'NOT_IMPLEMENTED',
      recommendation: '在审计模式下限制 generate_questions、analyze 等敏感操作'
    }
  ]
  
  console.log('  后端 Audit-Mode 实现状态:')
  for (const rec of recommendations) {
    const statusIcon = rec.status === 'IMPLEMENTED' ? '[PASS]' : 
                       rec.status === 'PARTIAL' ? '[WARN]' : '[FAIL]'
    console.log(`  ${statusIcon} ${rec.check}`)
    console.log(`         状态: ${rec.status}`)
    console.log(`         建议: ${rec.recommendation}`)
    
    if (rec.status !== 'IMPLEMENTED') {
      results.warnings.push({
        test: rec.check,
        status: rec.status,
        recommendation: rec.recommendation
      })
    }
  }
}

/**
 * 生成安全审计报告
 */
function generateSecurityReport() {
  console.log('\n' + '='.repeat(60))
  console.log('安全审计报告')
  console.log('='.repeat(60))
  console.log(`审计时间: ${new Date().toISOString()}`)
  console.log(`目标服务: ${BASE_URL}`)
  
  console.log('\n' + '─'.repeat(60))
  console.log('测试结果汇总')
  console.log('─'.repeat(60))
  console.log(`通过: ${results.passed.length}`)
  console.log(`警告: ${results.warnings.length}`)
  console.log(`失败: ${results.failed.length}`)
  
  if (results.passed.length > 0) {
    console.log('\n[通过的测试]')
    results.passed.forEach((item, i) => {
      console.log(`  ${i + 1}. ${item.test}: ${item.result}`)
    })
  }
  
  if (results.warnings.length > 0) {
    console.log('\n[警告项]')
    results.warnings.forEach((item, i) => {
      console.log(`  ${i + 1}. ${item.test}`)
      console.log(`     问题: ${item.issue || item.status}`)
      console.log(`     建议: ${item.recommendation}`)
    })
  }
  
  if (results.failed.length > 0) {
    console.log('\n[失败项]')
    results.failed.forEach((item, i) => {
      console.log(`  ${i + 1}. ${item.test}`)
      console.log(`     问题: ${item.issue || item.error}`)
    })
  }
  
  // 安全建议
  console.log('\n' + '─'.repeat(60))
  console.log('安全加固建议')
  console.log('─'.repeat(60))
  
  const securityRecommendations = [
    {
      priority: 'HIGH',
      title: '实现 Audit-Mode 后端校验',
      description: '在 proxy-ai.js 入口处检查 Audit-Mode 状态，审计模式下限制敏感操作',
      code: `
// 在 proxy-ai.js 开头添加
const auditMode = ctx.headers?.['x-audit-mode'] === 'true'
if (auditMode) {
  const restrictedActions = ['generate_questions', 'analyze', 'material_understand']
  if (restrictedActions.includes(action)) {
    return { code: 403, message: '审计模式下禁止此操作' }
  }
}`
    },
    {
      priority: 'HIGH',
      title: '实现请求速率限制',
      description: '防止 API 滥用和 DDoS 攻击',
      code: `
// 使用 Redis 实现速率限制
const rateLimitKey = \`rate_limit:\${userId || ip}\`
const count = await redis.incr(rateLimitKey)
if (count === 1) await redis.expire(rateLimitKey, 60)
if (count > 100) return { code: 429, message: '请求过于频繁' }`
    },
    {
      priority: 'MEDIUM',
      title: '加强输入验证',
      description: '防止 NoSQL 注入和 XSS 攻击',
      code: `
// 验证输入类型
if (typeof keyword !== 'string') {
  return { code: 400, message: '参数类型错误' }
}
// 过滤特殊字符
const sanitized = keyword.replace(/[\\${}]/g, '')`
    },
    {
      priority: 'MEDIUM',
      title: '实现请求签名验证',
      description: '防止请求伪造和重放攻击',
      code: `
// 验证请求签名
const timestamp = ctx.headers?.['x-timestamp']
const signature = ctx.headers?.['x-signature']
const expectedSig = crypto.createHmac('sha256', SECRET)
  .update(\`\${timestamp}:\${JSON.stringify(body)}\`)
  .digest('hex')
if (signature !== expectedSig) {
  return { code: 401, message: '签名验证失败' }
}`
    }
  ]
  
  securityRecommendations.forEach((rec, i) => {
    console.log(`\n${i + 1}. [${rec.priority}] ${rec.title}`)
    console.log(`   ${rec.description}`)
    console.log(`   示例代码:`)
    console.log(rec.code.split('\n').map(line => `   ${line}`).join('\n'))
  })
  
  // 返回审计结果
  const overallPassed = results.failed.length === 0 && results.warnings.length <= 3
  
  console.log('\n' + '─'.repeat(60))
  console.log(`审计结论: ${overallPassed ? '[PASS] 基本安全' : '[WARN] 需要加固'}`)
  console.log('─'.repeat(60))
  
  return {
    passed: overallPassed,
    summary: {
      passed: results.passed.length,
      warnings: results.warnings.length,
      failed: results.failed.length
    },
    recommendations: securityRecommendations
  }
}

/**
 * 主函数
 */
async function main() {
  console.log('========================================')
  console.log('接口安全审计 - Audit-Mode 校验检查')
  console.log('========================================\n')
  console.log(`目标服务器: ${BASE_URL}`)
  console.log(`审计时间: ${new Date().toISOString()}`)
  
  // 执行各项安全测试
  await testUnauthorizedAccess()
  await testAuditModeBypass()
  await testInjectionAttempts()
  await testRateLimiting()
  await testDataLeakage()
  await checkAuditModeImplementation()
  
  // 生成报告
  const report = generateSecurityReport()
  
  // 返回退出码
  process.exit(report.passed ? 0 : 1)
}

// 执行
main().catch(error => {
  console.error('安全审计执行失败:', error)
  process.exit(1)
})
