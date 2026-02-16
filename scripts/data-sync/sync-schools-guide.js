/**
 * 院校数据同步与验证指南
 * 
 * P0 级任务：数据注入与完整性验证
 * 
 * 问题现状：
 * - 当前数据库仅有 202 所院校（主要是985/211）
 * - 研招网共有 923 个研究生招生单位
 * - 缺少约 721 所院校数据（包括大量双非一本院校）
 * 
 * @version 1.0.0
 * @date 2026-01-27
 */

// ============================================
// 一、数据现状分析
// ============================================

const DATA_STATUS = {
  current: 202,           // 当前数据库院校数量
  expected: 923,          // 研招网研究生招生单位总数
  missing: 721,           // 缺失数量
  completeness: '21.9%'   // 完整度
}

// ============================================
// 二、字段映射问题
// ============================================

/**
 * 本地数据结构 (data/schools/schools.json)
 * 使用 level 和 tags 字段
 */
const LOCAL_SCHEMA = {
  code: '10299',
  name: '江苏大学',
  level: '211',           // 层次标记
  tags: ['211', '双一流'] // 标签数组
}

/**
 * 云函数爬虫数据结构 (school-crawler-api.js)
 * 使用布尔字段
 */
const CRAWLER_SCHEMA = {
  code: '10299',
  name: '江苏大学',
  is985: false,
  is211: false,
  isDoubleFirstClass: false,
  isSelfDetermined: false,
  hasGraduateSchool: false
}

// ============================================
// 三、数据错误示例
// ============================================

/**
 * 江苏大学数据错误
 * 
 * 实际情况：江苏大学是"双非"一本院校
 * - 非985
 * - 非211  
 * - 非双一流
 * 
 * 当前错误标记：
 * - level: "211"
 * - tags: ["211", "双一流"]
 */
const JIANGSU_UNIVERSITY_ERROR = {
  code: '10299',
  name: '江苏大学',
  currentWrong: {
    level: '211',
    tags: ['211', '双一流']
  },
  shouldBe: {
    level: 'normal',
    tags: [],
    is985: false,
    is211: false,
    isDoubleFirstClass: false
  }
}

// ============================================
// 四、操作指南
// ============================================

const OPERATION_GUIDE = {
  // 步骤1：在Laf云函数控制台执行全量爬取
  step1: {
    title: '执行全量同步',
    description: '在生产环境云函数控制台手动触发 crawl_all',
    method: 'POST',
    endpoint: '/school-crawler-api',
    body: {
      action: 'crawl_all'
    },
    expectedResult: {
      crawledCount: 923,
      errorCount: 0
    }
  },
  
  // 步骤2：验证数据完整性
  step2: {
    title: '验证数据完整性',
    description: '检查数据库院校数量',
    method: 'POST',
    endpoint: '/school-crawler-api',
    body: {
      action: 'status'
    },
    expectedResult: {
      totalCached: 923,
      status: 'complete'
    }
  },
  
  // 步骤3：抽查双非院校
  step3: {
    title: '抽查双非一本院校',
    description: '验证江苏大学等双非院校数据',
    testSchools: [
      { code: '10299', name: '江苏大学', province: '江苏', shouldBe: { is985: false, is211: false, isDoubleFirstClass: false } },
      { code: '10337', name: '浙江工业大学', province: '浙江', shouldBe: { is985: false, is211: false, isDoubleFirstClass: false } },
      { code: '10488', name: '武汉科技大学', province: '湖北', shouldBe: { is985: false, is211: false, isDoubleFirstClass: false } }
    ]
  },
  
  // 步骤4：验证字段标记
  step4: {
    title: '验证字段标记',
    description: '确认 is_985, is_211, is_double_first_class 标记正确',
    validationRules: {
      '985院校': { is985: true, is211: true, isDoubleFirstClass: true, count: 39 },
      '211非985': { is985: false, is211: true, isDoubleFirstClass: true, count: 73 },
      '双一流非211': { is985: false, is211: false, isDoubleFirstClass: true, count: 25 },
      '普通院校': { is985: false, is211: false, isDoubleFirstClass: false, count: 786 }
    }
  }
}

// ============================================
// 五、验证脚本
// ============================================

/**
 * 验证院校数据完整性
 * 在云函数中执行
 */
async function validateSchoolData(db) {
  const results = {
    totalCount: 0,
    by985: 0,
    by211: 0,
    byDoubleFirstClass: 0,
    byNormal: 0,
    errors: []
  }
  
  // 获取总数
  const countResult = await db.collection('crawler_schools').count()
  results.totalCount = countResult.total || 0
  
  // 验证指标
  if (results.totalCount < 900) {
    results.errors.push({
      type: 'INCOMPLETE_DATA',
      message: `院校数量(${results.totalCount})少于900，数据不完整`,
      expected: 923,
      actual: results.totalCount
    })
  }
  
  // 统计各类院校
  const stats = await db.collection('crawler_schools')
    .aggregate()
    .group({
      _id: null,
      total: { $sum: 1 },
      count985: { $sum: { $cond: ['$is985', 1, 0] } },
      count211: { $sum: { $cond: ['$is211', 1, 0] } },
      countDoubleFirstClass: { $sum: { $cond: ['$isDoubleFirstClass', 1, 0] } }
    })
    .end()
  
  if (stats.data && stats.data[0]) {
    results.by985 = stats.data[0].count985
    results.by211 = stats.data[0].count211
    results.byDoubleFirstClass = stats.data[0].countDoubleFirstClass
    results.byNormal = results.totalCount - results.byDoubleFirstClass
  }
  
  // 验证985数量（应该是39所）
  if (results.by985 !== 39) {
    results.errors.push({
      type: 'WRONG_985_COUNT',
      message: `985院校数量错误`,
      expected: 39,
      actual: results.by985
    })
  }
  
  // 验证211数量（应该是112所）
  if (results.by211 < 110 || results.by211 > 115) {
    results.errors.push({
      type: 'WRONG_211_COUNT',
      message: `211院校数量异常`,
      expected: '110-115',
      actual: results.by211
    })
  }
  
  return results
}

/**
 * 抽查特定院校数据
 */
async function spotCheckSchools(db) {
  const testCases = [
    // 双非一本院校（应该都是false）
    { code: '10299', name: '江苏大学', expected: { is985: false, is211: false, isDoubleFirstClass: false } },
    { code: '10337', name: '浙江工业大学', expected: { is985: false, is211: false, isDoubleFirstClass: false } },
    { code: '10488', name: '武汉科技大学', expected: { is985: false, is211: false, isDoubleFirstClass: false } },
    // 985院校（应该都是true）
    { code: '10003', name: '清华大学', expected: { is985: true, is211: true, isDoubleFirstClass: true } },
    { code: '10001', name: '北京大学', expected: { is985: true, is211: true, isDoubleFirstClass: true } },
    // 211非985院校
    { code: '10004', name: '北京交通大学', expected: { is985: false, is211: true, isDoubleFirstClass: true } }
  ]
  
  const results = []
  
  for (const testCase of testCases) {
    const school = await db.collection('crawler_schools')
      .where({ code: testCase.code })
      .getOne()
    
    if (!school.data) {
      results.push({
        code: testCase.code,
        name: testCase.name,
        status: 'NOT_FOUND',
        error: '院校数据不存在'
      })
      continue
    }
    
    const actual = {
      is985: school.data.is985 || false,
      is211: school.data.is211 || false,
      isDoubleFirstClass: school.data.isDoubleFirstClass || false
    }
    
    const isCorrect = 
      actual.is985 === testCase.expected.is985 &&
      actual.is211 === testCase.expected.is211 &&
      actual.isDoubleFirstClass === testCase.expected.isDoubleFirstClass
    
    results.push({
      code: testCase.code,
      name: testCase.name,
      status: isCorrect ? 'PASS' : 'FAIL',
      expected: testCase.expected,
      actual: actual
    })
  }
  
  return results
}

// ============================================
// 六、修复脚本
// ============================================

/**
 * 修复本地数据中的错误标记
 * 将错误标记的双非院校修正
 */
const SCHOOLS_TO_FIX = [
  // 这些院校在本地数据中被错误标记为211/双一流
  // 实际上它们是双非院校
  { code: '10299', name: '江苏大学', correctLevel: 'normal', correctTags: [] },
  { code: '10337', name: '浙江工业大学', correctLevel: 'normal', correctTags: [] },
  { code: '10338', name: '浙江理工大学', correctLevel: 'normal', correctTags: [] },
  { code: '10346', name: '杭州电子科技大学', correctLevel: 'normal', correctTags: [] },
  { code: '10356', name: '中国计量大学', correctLevel: 'normal', correctTags: [] },
  { code: '10488', name: '武汉科技大学', correctLevel: 'normal', correctTags: [] },
  { code: '10489', name: '长江大学', correctLevel: 'normal', correctTags: [] },
  { code: '10490', name: '武汉工程大学', correctLevel: 'normal', correctTags: [] },
  { code: '10500', name: '湖北工业大学', correctLevel: 'normal', correctTags: [] }
]

// ============================================
// 导出
// ============================================

module.exports = {
  DATA_STATUS,
  OPERATION_GUIDE,
  JIANGSU_UNIVERSITY_ERROR,
  SCHOOLS_TO_FIX,
  validateSchoolData,
  spotCheckSchools
}

// ============================================
// 使用说明
// ============================================

console.log(`
================================================================================
                    院校数据同步与验证指南
================================================================================

【当前问题】
- 数据库仅有 ${DATA_STATUS.current} 所院校，缺少 ${DATA_STATUS.missing} 所
- 部分双非院校被错误标记为211/双一流（如江苏大学）
- 字段结构不一致（level/tags vs is985/is211/isDoubleFirstClass）

【操作步骤】

1. 执行全量同步
   POST /school-crawler-api
   Body: { "action": "crawl_all" }
   
2. 验证数据完整性
   POST /school-crawler-api
   Body: { "action": "status" }
   预期: totalCached >= 900
   
3. 抽查双非院校
   - 江苏大学(10299): is985=false, is211=false, isDoubleFirstClass=false
   - 浙江工业大学(10337): is985=false, is211=false, isDoubleFirstClass=false
   - 武汉科技大学(10488): is985=false, is211=false, isDoubleFirstClass=false

4. 验证字段标记
   - 985院校: 39所
   - 211院校: 112所
   - 双一流院校: 137所

================================================================================
`)
