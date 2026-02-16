/**
 * 学校数据 Schema 设计
 * 
 * 数据来源参考：
 * - 研究生招生信息网 (https://yz.chsi.com.cn)
 * - 粉笔考研
 * - 各高校研究生院官网
 * 
 * @version 1.0.0
 */

/**
 * 学校基本信息表 (schools)
 */
const schoolSchema = {
  _id: 'ObjectId',                    // 主键
  
  // 基本信息
  name: 'String',                     // 学校名称（如：清华大学）
  shortName: 'String',                // 简称（如：清华）
  englishName: 'String',              // 英文名（如：Tsinghua University）
  code: 'String',                     // 学校代码（如：10003）
  
  // 分类标签
  type: 'String',                     // 类型：综合/理工/师范/财经/医药/农林/政法/艺术/体育/民族/军事
  level: 'String',                    // 层次：985/211/双一流/普通本科
  tags: ['String'],                   // 标签：['985', '211', '双一流', 'C9联盟', '自划线']
  
  // 地理信息
  province: 'String',                 // 省份
  city: 'String',                     // 城市
  address: 'String',                  // 详细地址
  location: {                         // 经纬度（可选，用于地图展示）
    type: 'Point',
    coordinates: ['Number', 'Number'] // [经度, 纬度]
  },
  
  // 联系方式
  website: 'String',                  // 研究生院官网
  phone: 'String',                    // 招生办电话
  email: 'String',                    // 招生邮箱
  
  // 学校简介
  description: 'String',              // 学校简介
  history: 'String',                  // 历史沿革
  features: ['String'],               // 特色专业/学科
  
  // 排名信息
  ranking: {
    overall: 'Number',                // 综合排名
    qs: 'Number',                     // QS世界排名
    usnews: 'Number',                 // US News排名
    arwu: 'Number',                   // 软科排名
    year: 'Number'                    // 排名年份
  },
  
  // 研究生招生概况
  graduateInfo: {
    totalEnrollment: 'Number',        // 研究生总招生人数
    masterEnrollment: 'Number',       // 硕士招生人数
    doctorEnrollment: 'Number',       // 博士招生人数
    exemptionRate: 'Number',          // 推免比例
    year: 'Number'                    // 数据年份
  },
  
  // 图片资源
  logo: 'String',                     // 校徽URL
  banner: 'String',                   // 横幅图URL
  photos: ['String'],                 // 校园照片URLs
  
  // 元数据
  status: 'String',                   // 状态：active/inactive
  dataSource: 'String',               // 数据来源
  lastUpdated: 'Date',                // 最后更新时间
  createdAt: 'Date',
  updatedAt: 'Date'
}

/**
 * 专业信息表 (majors)
 */
const majorSchema = {
  _id: 'ObjectId',
  
  // 关联信息
  schoolId: 'ObjectId',               // 关联学校ID
  schoolName: 'String',               // 学校名称（冗余，便于查询）
  collegeId: 'ObjectId',              // 关联学院ID
  collegeName: 'String',              // 学院名称
  
  // 专业信息
  code: 'String',                     // 专业代码（如：085400）
  name: 'String',                     // 专业名称（如：电子信息）
  degree: 'String',                   // 学位类型：学术硕士/专业硕士
  category: 'String',                 // 学科门类：哲学/经济学/法学/教育学/文学/历史学/理学/工学/农学/医学/军事学/管理学/艺术学
  
  // 招生信息
  enrollment: {
    planned: 'Number',                // 计划招生人数
    actual: 'Number',                 // 实际招生人数
    exemption: 'Number',              // 推免人数
    year: 'Number'                    // 数据年份
  },
  
  // 考试科目
  subjects: [{
    code: 'String',                   // 科目代码
    name: 'String',                   // 科目名称
    type: 'String'                    // 类型：政治/外语/业务课一/业务课二
  }],
  
  // 参考书目
  references: [{
    name: 'String',                   // 书名
    author: 'String',                 // 作者
    publisher: 'String',              // 出版社
    isbn: 'String'                    // ISBN
  }],
  
  // 研究方向
  directions: [{
    code: 'String',                   // 方向代码
    name: 'String',                   // 方向名称
    tutor: 'String'                   // 导师（可选）
  }],
  
  // 学制与学费
  duration: 'Number',                 // 学制（年）
  tuition: 'Number',                  // 学费（元/年）
  
  // 备注
  notes: 'String',                    // 备注信息
  
  // 元数据
  status: 'String',
  dataSource: 'String',
  lastUpdated: 'Date',
  createdAt: 'Date',
  updatedAt: 'Date'
}

/**
 * 分数线表 (score_lines)
 */
const scoreLineSchema = {
  _id: 'ObjectId',
  
  // 关联信息
  schoolId: 'ObjectId',
  schoolName: 'String',
  majorId: 'ObjectId',
  majorCode: 'String',
  majorName: 'String',
  
  // 年份
  year: 'Number',                     // 考试年份
  
  // 分数线类型
  type: 'String',                     // 类型：国家线/自划线/复试线/调剂线
  
  // 分数详情
  scores: {
    total: 'Number',                  // 总分线
    politics: 'Number',               // 政治线
    english: 'Number',                // 英语线
    math: 'Number',                   // 数学线（如有）
    professional: 'Number'            // 专业课线
  },
  
  // 区域
  region: 'String',                   // A区/B区（国家线适用）
  
  // 备注
  notes: 'String',
  
  // 元数据
  dataSource: 'String',
  createdAt: 'Date',
  updatedAt: 'Date'
}

/**
 * 报录比表 (admission_ratios)
 */
const admissionRatioSchema = {
  _id: 'ObjectId',
  
  // 关联信息
  schoolId: 'ObjectId',
  schoolName: 'String',
  majorId: 'ObjectId',
  majorCode: 'String',
  majorName: 'String',
  
  // 年份
  year: 'Number',
  
  // 报录数据
  applicants: 'Number',               // 报名人数
  admitted: 'Number',                 // 录取人数
  ratio: 'Number',                    // 报录比（计算字段）
  
  // 推免数据
  exemptionApplicants: 'Number',      // 推免报名人数
  exemptionAdmitted: 'Number',        // 推免录取人数
  
  // 调剂数据
  adjustmentAdmitted: 'Number',       // 调剂录取人数
  
  // 元数据
  dataSource: 'String',
  createdAt: 'Date',
  updatedAt: 'Date'
}

/**
 * 学院信息表 (colleges)
 */
const collegeSchema = {
  _id: 'ObjectId',
  
  // 关联信息
  schoolId: 'ObjectId',
  schoolName: 'String',
  
  // 学院信息
  name: 'String',                     // 学院名称
  code: 'String',                     // 学院代码
  
  // 联系方式
  website: 'String',
  phone: 'String',
  email: 'String',
  address: 'String',
  
  // 简介
  description: 'String',
  
  // 元数据
  status: 'String',
  createdAt: 'Date',
  updatedAt: 'Date'
}

/**
 * 用户收藏表 (user_school_favorites)
 */
const userFavoriteSchema = {
  _id: 'ObjectId',
  
  userId: 'String',                   // 用户ID
  schoolId: 'ObjectId',               // 学校ID
  majorId: 'ObjectId',                // 专业ID（可选）
  
  // 收藏信息
  notes: 'String',                    // 用户备注
  priority: 'Number',                 // 优先级（1-5）
  status: 'String',                   // 状态：target/backup/considering
  
  createdAt: 'Date',
  updatedAt: 'Date'
}

/**
 * 索引设计
 * @version 1.1.0 - 增加复合索引和文本搜索索引
 */
const indexes = {
  schools: [
    { name: 1 },
    { code: 1, unique: true },
    { province: 1 },
    { level: 1 },
    { tags: 1 },
    { type: 1 },
    { 'ranking.overall': 1 },
    { status: 1, province: 1 },
    { status: 1, level: 1 },
    { status: 1, type: 1 },
    { status: 1, 'ranking.overall': 1 },
    { name: 'text', shortName: 'text', englishName: 'text' }
  ],
  majors: [
    { schoolId: 1 },
    { code: 1 },
    { name: 1 },
    { category: 1 },
    { degree: 1 },
    { schoolId: 1, code: 1, unique: true },
    { schoolId: 1, category: 1 },
    { schoolId: 1, collegeId: 1 },
    { name: 'text', code: 'text' }
  ],
  colleges: [
    { schoolId: 1 },
    { schoolId: 1, code: 1, unique: true },
    { name: 1 }
  ],
  score_lines: [
    { schoolId: 1, year: -1 },
    { majorId: 1, year: -1 },
    { year: -1, type: 1 },
    { type: 1, year: -1, region: 1 },
    { schoolId: 1, majorId: 1, year: -1 }
  ],
  admission_ratios: [
    { schoolId: 1, year: -1 },
    { majorId: 1, year: -1 },
    { schoolId: 1, majorId: 1, year: -1 }
  ],
  user_school_favorites: [
    { userId: 1 },
    { userId: 1, schoolId: 1, unique: true },
    { userId: 1, status: 1 },
    { userId: 1, priority: 1, createdAt: -1 }
  ]
}

module.exports = {
  schoolSchema,
  majorSchema,
  scoreLineSchema,
  admissionRatioSchema,
  collegeSchema,
  userFavoriteSchema,
  indexes
}
