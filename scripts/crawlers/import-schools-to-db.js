/**
 * 学校数据导入脚本
 * 
 * 将生成的学校数据导入到 MongoDB 数据库
 * 
 * 使用方法：
 * 1. 确保 MongoDB 连接配置正确
 * 2. 运行: node scripts/crawlers/import-schools-to-db.js
 * 
 * @version 1.0.0
 */

const fs = require('fs')
const path = require('path')

// 数据文件路径
const SCHOOLS_FILE = path.join(__dirname, '../../data/schools/schools.json')

/**
 * 读取学校数据
 */
function loadSchoolsData() {
  if (!fs.existsSync(SCHOOLS_FILE)) {
    console.error('学校数据文件不存在，请先运行 school-crawler.js 生成数据')
    process.exit(1)
  }
  
  const data = fs.readFileSync(SCHOOLS_FILE, 'utf8')
  return JSON.parse(data)
}

/**
 * 生成 MongoDB 导入脚本
 */
function generateMongoImportScript(schools) {
  const outputPath = path.join(__dirname, '../../data/schools/mongo-import.js')
  
  const script = `// MongoDB 学校数据导入脚本
// 使用方法: mongo exam-master mongo-import.js
// 或在 MongoDB Shell 中执行

db = db.getSiblingDB('exam-master');

// 清空现有数据（可选）
// db.schools.drop();

// 创建索引
db.schools.createIndex({ code: 1 }, { unique: true });
db.schools.createIndex({ name: 1 });
db.schools.createIndex({ province: 1 });
db.schools.createIndex({ level: 1 });
db.schools.createIndex({ type: 1 });
db.schools.createIndex({ tags: 1 });
db.schools.createIndex({ 'ranking.overall': 1 });
db.schools.createIndex({ status: 1 });
db.schools.createIndex({ 
  name: 'text', 
  shortName: 'text' 
}, { 
  name: 'schools_text_search'
});

// 导入学校数据
const schools = ${JSON.stringify(schools, null, 2)};

let inserted = 0;
let updated = 0;
let errors = 0;

schools.forEach(function(school) {
  try {
    const existing = db.schools.findOne({ code: school.code });
    if (existing) {
      db.schools.updateOne(
        { code: school.code },
        { $set: { ...school, updatedAt: new Date().toISOString() } }
      );
      updated++;
    } else {
      db.schools.insertOne(school);
      inserted++;
    }
  } catch (e) {
    print('Error importing school: ' + school.name + ' - ' + e.message);
    errors++;
  }
});

print('');
print('='.repeat(50));
print('学校数据导入完成！');
print('- 新增: ' + inserted + ' 所');
print('- 更新: ' + updated + ' 所');
print('- 错误: ' + errors + ' 所');
print('- 总计: ' + db.schools.countDocuments({ status: 'active' }) + ' 所');
print('='.repeat(50));
`

  fs.writeFileSync(outputPath, script, 'utf8')
  console.log(`MongoDB 导入脚本已生成: ${outputPath}`)
  return outputPath
}

/**
 * 生成 Laf 云函数导入代码
 */
function generateLafImportCode(schools) {
  const outputPath = path.join(__dirname, '../../data/schools/laf-import-schools.js')
  
  const code = `/**
 * Laf 云函数 - 学校数据批量导入
 * 
 * 使用方法：
 * 1. 在 Laf 控制台创建新的云函数
 * 2. 复制此代码到云函数中
 * 3. 执行云函数完成导入
 */

import cloud from '@lafjs/cloud'

const db = cloud.database()

// 学校数据
const SCHOOLS_DATA = ${JSON.stringify(schools, null, 2)};

export default async function (ctx) {
  const startTime = Date.now()
  
  console.log('开始导入学校数据...')
  console.log('总计: ' + SCHOOLS_DATA.length + ' 所学校')
  
  let inserted = 0
  let updated = 0
  let errors = 0
  
  for (const school of SCHOOLS_DATA) {
    try {
      // 检查是否已存在
      const existing = await db.collection('schools')
        .where({ code: school.code })
        .getOne()
      
      if (existing.data) {
        // 更新
        await db.collection('schools')
          .doc(existing.data._id)
          .update({
            ...school,
            updatedAt: new Date().toISOString()
          })
        updated++
      } else {
        // 新增
        await db.collection('schools').add({
          ...school,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        })
        inserted++
      }
    } catch (error) {
      console.error('导入失败: ' + school.name, error.message)
      errors++
    }
  }
  
  const duration = Date.now() - startTime
  
  return {
    code: 0,
    message: '学校数据导入完成',
    data: {
      total: SCHOOLS_DATA.length,
      inserted,
      updated,
      errors,
      duration: duration + 'ms'
    }
  }
}
`

  fs.writeFileSync(outputPath, code, 'utf8')
  console.log(`Laf 导入代码已生成: ${outputPath}`)
  return outputPath
}

/**
 * 主函数
 */
async function main() {
  console.log('='.repeat(50))
  console.log('学校数据导入脚本生成器')
  console.log('='.repeat(50))
  
  // 加载数据
  const schools = loadSchoolsData()
  console.log(`已加载 ${schools.length} 所学校数据`)
  
  // 生成 MongoDB 导入脚本
  generateMongoImportScript(schools)
  
  // 生成 Laf 导入代码
  generateLafImportCode(schools)
  
  console.log('')
  console.log('='.repeat(50))
  console.log('导入脚本生成完成！')
  console.log('')
  console.log('使用方法:')
  console.log('1. MongoDB 直接导入:')
  console.log('   mongo exam-master data/schools/mongo-import.js')
  console.log('')
  console.log('2. Laf 云函数导入:')
  console.log('   将 data/schools/laf-import-schools.js 内容复制到 Laf 云函数中执行')
  console.log('='.repeat(50))
}

// 运行
main().catch(console.error)
