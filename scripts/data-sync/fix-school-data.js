/**
 * 院校数据修复脚本
 * 
 * 功能：
 * 1. 修复本地数据中错误标记的双非院校
 * 2. 添加缺失的 is_985, is_211, is_double_first_class 字段
 * 3. 生成修复后的数据文件
 * 
 * 使用方法：
 * node scripts/data-sync/fix-school-data.js
 * 
 * @version 1.0.0
 */

const fs = require('fs')
const path = require('path')

// 真实的985院校代码列表（39所）
const REAL_985_CODES = [
  '10001', '10002', '10003', '10006', '10007', '10019', '10027', '10034', // 北京
  '10055', '10056', // 天津
  '10141', '10145', // 辽宁
  '10183', // 吉林
  '10213', // 黑龙江
  '10246', '10247', '10248', '10269', // 上海
  '10284', '10286', // 江苏
  '10335', // 浙江
  '10358', // 安徽
  '10384', // 福建
  '10422', '10423', // 山东
  '10486', '10487', // 湖北
  '10532', '10533', '91002', // 湖南
  '10558', '10561', // 广东
  '10610', '10614', // 四川
  '10611', // 重庆
  '10698', '10699', '10712', // 陕西
  '10730' // 甘肃
]

// 真实的211院校代码列表（112所，包含985）
const REAL_211_CODES = [
  // 985院校（39所）
  ...REAL_985_CODES,
  // 非985的211院校（73所）
  '10004', '10005', '10008', '10010', '10011', '10013', '10026', '10030', '10033', '10036', '10043', '10053', '10054', '10051', '10052', // 北京
  '10058', // 天津
  '10140', '10151', // 辽宁
  '10184', '10200', // 吉林
  '10217', '10225', '10226', // 黑龙江
  '10251', '10255', '10264', '10268', '10271', '10272', '10280', // 上海
  '10285', '10287', '10288', '10290', '10294', '10295', '10307', '10319', // 江苏
  '10357', '10359', // 安徽
  '10386', // 福建
  '10403', // 江西
  '10425', // 山东
  '10459', // 河南
  '10491', '10497', '10504', '10511', '10520', // 湖北
  '10530', '10542', // 湖南
  '10559', '10574', // 广东
  '10593', // 广西
  '10589', // 海南
  '10613', // 重庆
  '10626', '10651', // 四川
  '10657', // 贵州
  '10673', // 云南
  '10697', '10701', '10710', '10718', // 陕西
  '10736', // 甘肃
  '10743', // 青海
  '10749', // 宁夏
  '10755', '10759', // 新疆
  '10126', // 内蒙古
  '10694', // 西藏
  '10080' // 河北
]

// 双一流院校代码列表（147所，第二轮）
const REAL_DOUBLE_FIRST_CLASS_CODES = [
  // 所有211院校
  ...REAL_211_CODES,
  // 新增的双一流院校（非211）
  '10022', // 北京协和医学院
  '10025', // 首都医科大学
  '10028', // 首都经济贸易大学
  '10032', // 北京语言大学
  '10038', // 首都师范大学
  '10252', // 上海理工大学
  '10254', // 上海海事大学
  '10264', // 上海海洋大学
  '10273', // 上海对外经贸大学
  '10291', // 南京工业大学
  '10300', // 南京信息工程大学
  '10312', // 南京医科大学
  '10343', // 温州医科大学
  '10366', // 安徽医科大学
  '10389', // 福建农林大学
  '10394', // 福建师范大学
  '10421', // 江西财经大学
  '10445', // 山东师范大学
  '10475', // 河南大学
  '10534', // 湖南科技大学
  '10560', // 汕头大学
  '10564', // 华南农业大学
  '10570', // 广州医科大学
  '10590', // 深圳大学
  '11845', // 广东工业大学
  '10598', // 广西医科大学
  '10617', // 重庆邮电大学
  '10616', // 成都理工大学
  '10633', // 成都中医药大学
  '10674', // 昆明理工大学
  '10700', // 西安理工大学
  '10703', // 西安建筑科技大学
  '10731', // 兰州理工大学
  '10732'  // 兰州交通大学
]

/**
 * 修复学校数据
 */
function fixSchoolData(school) {
  const code = school.code
  
  // 判断真实的院校类型
  const is985 = REAL_985_CODES.includes(code)
  const is211 = REAL_211_CODES.includes(code)
  const isDoubleFirstClass = REAL_DOUBLE_FIRST_CLASS_CODES.includes(code)
  
  // 确定正确的level
  let level = 'normal'
  if (is985) {
    level = '985'
  } else if (is211) {
    level = '211'
  } else if (isDoubleFirstClass) {
    level = '双一流'
  }
  
  // 确定正确的tags
  const tags = []
  if (is985) tags.push('985')
  if (is211) tags.push('211')
  if (isDoubleFirstClass) tags.push('双一流')
  
  return {
    ...school,
    level,
    tags,
    is_985: is985,
    is_211: is211,
    is_double_first_class: isDoubleFirstClass,
    // 保留原有字段的兼容性
    is985,
    is211,
    isDoubleFirstClass
  }
}

/**
 * 主函数
 */
async function main() {
  console.log('='.repeat(60))
  console.log('院校数据修复脚本')
  console.log('='.repeat(60))
  
  const inputPath = path.join(__dirname, '../../data/schools/schools.json')
  const outputPath = path.join(__dirname, '../../data/schools/schools-fixed.json')
  const reportPath = path.join(__dirname, '../../data/schools/fix-report.json')
  
  // 读取原始数据
  console.log('\n读取原始数据...')
  const rawData = fs.readFileSync(inputPath, 'utf8')
  const schools = JSON.parse(rawData)
  console.log(`原始数据: ${schools.length} 所院校`)
  
  // 修复数据
  console.log('\n修复数据...')
  const fixedSchools = []
  const changes = []
  
  for (const school of schools) {
    const fixed = fixSchoolData(school)
    fixedSchools.push(fixed)
    
    // 记录变更
    if (school.level !== fixed.level || 
        JSON.stringify(school.tags) !== JSON.stringify(fixed.tags)) {
      changes.push({
        code: school.code,
        name: school.name,
        before: {
          level: school.level,
          tags: school.tags
        },
        after: {
          level: fixed.level,
          tags: fixed.tags
        }
      })
    }
  }
  
  // 统计
  const stats = {
    total: fixedSchools.length,
    by985: fixedSchools.filter(s => s.is985).length,
    by211: fixedSchools.filter(s => s.is211).length,
    byDoubleFirstClass: fixedSchools.filter(s => s.isDoubleFirstClass).length,
    byNormal: fixedSchools.filter(s => !s.isDoubleFirstClass).length,
    changesCount: changes.length
  }
  
  console.log('\n统计结果:')
  console.log(`- 总计: ${stats.total} 所`)
  console.log(`- 985院校: ${stats.by985} 所`)
  console.log(`- 211院校: ${stats.by211} 所`)
  console.log(`- 双一流院校: ${stats.byDoubleFirstClass} 所`)
  console.log(`- 普通院校: ${stats.byNormal} 所`)
  console.log(`- 修改记录: ${stats.changesCount} 条`)
  
  // 保存修复后的数据
  console.log('\n保存修复后的数据...')
  fs.writeFileSync(outputPath, JSON.stringify(fixedSchools, null, 2), 'utf8')
  console.log(`已保存到: ${outputPath}`)
  
  // 保存修复报告
  const report = {
    timestamp: new Date().toISOString(),
    stats,
    changes: changes.slice(0, 50), // 只保存前50条变更
    totalChanges: changes.length
  }
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8')
  console.log(`修复报告: ${reportPath}`)
  
  // 显示部分变更
  if (changes.length > 0) {
    console.log('\n部分变更记录:')
    changes.slice(0, 10).forEach(c => {
      console.log(`  ${c.code} ${c.name}: ${c.before.level} -> ${c.after.level}`)
    })
    if (changes.length > 10) {
      console.log(`  ... 还有 ${changes.length - 10} 条变更`)
    }
  }
  
  console.log('\n' + '='.repeat(60))
  console.log('修复完成!')
  console.log('='.repeat(60))
}

// 运行
main().catch(console.error)
