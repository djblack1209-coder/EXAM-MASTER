/**
 * 学校数据爬取脚本
 * 
 * 数据来源：
 * 1. 研究生招生信息网 (https://yz.chsi.com.cn)
 * 2. 各高校研究生院官网
 * 
 * 使用方法：
 * node scripts/crawlers/school-crawler.js
 * 
 * 注意事项：
 * - 请遵守网站的 robots.txt 规则
 * - 控制爬取频率，避免对目标网站造成压力
 * - 仅用于学习和研究目的
 * 
 * @version 1.0.0
 */

const https = require('https')
const http = require('http')
const fs = require('fs')
const path = require('path')

// 配置
const CONFIG = {
  // 爬取延迟（毫秒）
  delay: 2000,
  
  // 输出目录
  outputDir: path.join(__dirname, '../../data/schools'),
  
  // 用户代理
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  
  // 超时时间
  timeout: 30000
}

// 985高校列表（核心数据）
const SCHOOLS_985 = [
  { code: '10001', name: '北京大学', province: '北京' },
  { code: '10003', name: '清华大学', province: '北京' },
  { code: '10246', name: '复旦大学', province: '上海' },
  { code: '10248', name: '上海交通大学', province: '上海' },
  { code: '10284', name: '南京大学', province: '江苏' },
  { code: '10335', name: '浙江大学', province: '浙江' },
  { code: '10558', name: '中山大学', province: '广东' },
  { code: '10486', name: '武汉大学', province: '湖北' },
  { code: '10487', name: '华中科技大学', province: '湖北' },
  { code: '10610', name: '四川大学', province: '四川' },
  { code: '10698', name: '西安交通大学', province: '陕西' },
  { code: '10213', name: '哈尔滨工业大学', province: '黑龙江' },
  { code: '10141', name: '大连理工大学', province: '辽宁' },
  { code: '10145', name: '东北大学', province: '辽宁' },
  { code: '10183', name: '吉林大学', province: '吉林' },
  { code: '10247', name: '同济大学', province: '上海' },
  { code: '10269', name: '华东师范大学', province: '上海' },
  { code: '10286', name: '东南大学', province: '江苏' },
  { code: '10384', name: '厦门大学', province: '福建' },
  { code: '10422', name: '山东大学', province: '山东' },
  { code: '10423', name: '中国海洋大学', province: '山东' },
  { code: '10532', name: '湖南大学', province: '湖南' },
  { code: '10533', name: '中南大学', province: '湖南' },
  { code: '10561', name: '华南理工大学', province: '广东' },
  { code: '10611', name: '重庆大学', province: '重庆' },
  { code: '10614', name: '电子科技大学', province: '四川' },
  { code: '10699', name: '西北工业大学', province: '陕西' },
  { code: '10712', name: '西北农林科技大学', province: '陕西' },
  { code: '10730', name: '兰州大学', province: '甘肃' },
  { code: '91002', name: '国防科技大学', province: '湖南' },
  { code: '10002', name: '中国人民大学', province: '北京' },
  { code: '10006', name: '北京航空航天大学', province: '北京' },
  { code: '10007', name: '北京理工大学', province: '北京' },
  { code: '10019', name: '中国农业大学', province: '北京' },
  { code: '10027', name: '北京师范大学', province: '北京' },
  { code: '10034', name: '中央民族大学', province: '北京' },
  { code: '10055', name: '南开大学', province: '天津' },
  { code: '10056', name: '天津大学', province: '天津' },
  { code: '10358', name: '中国科学技术大学', province: '安徽' }
]

// 211高校列表（部分，可扩展）
const SCHOOLS_211 = [
  { code: '10004', name: '北京交通大学', province: '北京' },
  { code: '10005', name: '北京工业大学', province: '北京' },
  { code: '10008', name: '北京科技大学', province: '北京' },
  { code: '10010', name: '北京化工大学', province: '北京' },
  { code: '10011', name: '北京邮电大学', province: '北京' },
  { code: '10013', name: '北京林业大学', province: '北京' },
  { code: '10026', name: '北京中医药大学', province: '北京' },
  { code: '10030', name: '北京外国语大学', province: '北京' },
  { code: '10033', name: '中国传媒大学', province: '北京' },
  { code: '10036', name: '对外经济贸易大学', province: '北京' },
  { code: '10038', name: '首都师范大学', province: '北京' },
  { code: '10043', name: '北京体育大学', province: '北京' },
  { code: '10053', name: '中国政法大学', province: '北京' },
  { code: '10054', name: '华北电力大学', province: '北京' },
  { code: '10058', name: '天津医科大学', province: '天津' },
  { code: '10140', name: '辽宁大学', province: '辽宁' },
  { code: '10151', name: '大连海事大学', province: '辽宁' },
  { code: '10186', name: '长春理工大学', province: '吉林' },
  { code: '10217', name: '哈尔滨工程大学', province: '黑龙江' },
  { code: '10225', name: '东北林业大学', province: '黑龙江' },
  { code: '10226', name: '东北农业大学', province: '黑龙江' },
  // ... 更多211高校
]

/**
 * 延迟函数
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * HTTP请求封装
 */
function fetchUrl(url, options = {}) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http
    
    const req = protocol.get(url, {
      headers: {
        'User-Agent': CONFIG.userAgent,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        ...options.headers
      },
      timeout: CONFIG.timeout
    }, (res) => {
      // 处理重定向
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        fetchUrl(res.headers.location, options).then(resolve).catch(reject)
        return
      }
      
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => resolve({ status: res.statusCode, data }))
    })
    
    req.on('error', reject)
    req.on('timeout', () => {
      req.destroy()
      reject(new Error('Request timeout'))
    })
  })
}

/**
 * 生成学校基础数据
 * 由于直接爬取可能涉及法律问题，这里生成模拟数据结构
 * 实际使用时可以手动补充真实数据
 */
function generateSchoolData(school, is985 = false) {
  const tags = []
  if (is985) {
    tags.push('985', '211', '双一流')
  } else {
    tags.push('211', '双一流')
  }
  
  return {
    code: school.code,
    name: school.name,
    shortName: school.name.replace('大学', '').replace('学院', ''),
    englishName: '',  // 需要手动补充
    type: '综合',     // 需要根据实际情况调整
    level: is985 ? '985' : '211',
    tags,
    province: school.province,
    city: school.province,  // 需要细化
    address: '',
    website: `https://yz.${school.name.toLowerCase().replace(/[^a-z]/g, '')}.edu.cn`,
    phone: '',
    email: '',
    description: `${school.name}是中国著名的高等学府，是国家"${is985 ? '985工程' : '211工程'}"重点建设大学。`,
    features: [],
    ranking: {
      overall: 0,
      year: 2024
    },
    graduateInfo: {
      totalEnrollment: 0,
      masterEnrollment: 0,
      doctorEnrollment: 0,
      exemptionRate: 0,
      year: 2024
    },
    logo: '',
    banner: '',
    photos: [],
    status: 'active',
    dataSource: 'manual',
    lastUpdated: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
}

/**
 * 生成所有学校数据
 */
async function generateAllSchoolData() {
  console.log('开始生成学校数据...')
  
  const allSchools = []
  
  // 生成985高校数据
  console.log(`处理 ${SCHOOLS_985.length} 所985高校...`)
  for (const school of SCHOOLS_985) {
    const data = generateSchoolData(school, true)
    allSchools.push(data)
  }
  
  // 生成211高校数据
  console.log(`处理 ${SCHOOLS_211.length} 所211高校...`)
  for (const school of SCHOOLS_211) {
    // 排除已在985列表中的学校
    if (!SCHOOLS_985.find(s => s.code === school.code)) {
      const data = generateSchoolData(school, false)
      allSchools.push(data)
    }
  }
  
  console.log(`共生成 ${allSchools.length} 所学校数据`)
  
  return allSchools
}

/**
 * 保存数据到文件
 */
function saveToFile(data, filename) {
  // 确保输出目录存在
  if (!fs.existsSync(CONFIG.outputDir)) {
    fs.mkdirSync(CONFIG.outputDir, { recursive: true })
  }
  
  const filepath = path.join(CONFIG.outputDir, filename)
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2), 'utf8')
  console.log(`数据已保存到: ${filepath}`)
}

/**
 * 主函数
 */
async function main() {
  console.log('='.repeat(50))
  console.log('学校数据生成工具')
  console.log('='.repeat(50))
  
  try {
    // 生成学校数据
    const schools = await generateAllSchoolData()
    
    // 保存到文件
    saveToFile(schools, 'schools.json')
    
    // 按省份分组保存
    const byProvince = {}
    schools.forEach(school => {
      if (!byProvince[school.province]) {
        byProvince[school.province] = []
      }
      byProvince[school.province].push(school)
    })
    saveToFile(byProvince, 'schools-by-province.json')
    
    // 生成统计信息
    const stats = {
      total: schools.length,
      by985: schools.filter(s => s.tags.includes('985')).length,
      by211: schools.filter(s => s.tags.includes('211')).length,
      byProvince: Object.keys(byProvince).map(p => ({
        province: p,
        count: byProvince[p].length
      })),
      generatedAt: new Date().toISOString()
    }
    saveToFile(stats, 'stats.json')
    
    console.log('\n='.repeat(50))
    console.log('生成完成！')
    console.log(`- 总计: ${stats.total} 所学校`)
    console.log(`- 985高校: ${stats.by985} 所`)
    console.log(`- 211高校: ${stats.by211} 所`)
    console.log('='.repeat(50))
    
  } catch (error) {
    console.error('生成失败:', error)
    process.exit(1)
  }
}

// 导出函数供其他模块使用
module.exports = {
  generateAllSchoolData,
  generateSchoolData,
  SCHOOLS_985,
  SCHOOLS_211,
  CONFIG
}

// 直接运行
if (require.main === module) {
  main()
}
