/**
 * 学校数据查询云函数
 * 
 * 功能：
 * 1. 学校列表查询（支持筛选、搜索、分页）
 * 2. 学校详情查询
 * 3. 专业查询
 * 4. 分数线查询
 * 5. 报录比查询
 * 6. 用户收藏管理
 * 
 * @version 1.0.0
 */

import cloud from '@lafjs/cloud'

const db = cloud.database()
const _ = db.command

export default async function (ctx) {
  const startTime = Date.now()
  const requestId = `school_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  
  try {
    const { action, data } = ctx.body || {}
    
    if (!action) {
      return { code: 400, message: '缺少 action 参数', requestId }
    }
    
    console.log(`[${requestId}] 学校查询: action=${action}`)
    
    switch (action) {
      // ==================== 学校查询 ====================
      case 'list':
        return await getSchoolList(data, requestId)
      
      case 'detail':
        return await getSchoolDetail(data, requestId)
      
      case 'search':
        return await searchSchools(data, requestId)
      
      case 'hot':
        return await getHotSchools(data, requestId)
      
      // ==================== 专业查询 ====================
      case 'majors':
        return await getMajors(data, requestId)
      
      case 'major_detail':
        return await getMajorDetail(data, requestId)
      
      // ==================== 分数线查询 ====================
      case 'score_lines':
        return await getScoreLines(data, requestId)
      
      case 'national_lines':
        return await getNationalLines(data, requestId)
      
      // ==================== 报录比查询 ====================
      case 'admission_ratios':
        return await getAdmissionRatios(data, requestId)
      
      // ==================== 用户收藏 ====================
      case 'add_favorite':
        return await addFavorite(ctx, data, requestId)
      
      case 'remove_favorite':
        return await removeFavorite(ctx, data, requestId)
      
      case 'get_favorites':
        return await getFavorites(ctx, data, requestId)
      
      // ==================== 统计数据 ====================
      case 'stats':
        return await getStats(requestId)
      
      case 'provinces':
        return await getProvinces(requestId)
      
      default:
        return { code: 400, message: `未知的 action: ${action}`, requestId }
    }
    
  } catch (error) {
    console.error(`[${requestId}] 学校查询异常:`, error)
    return {
      code: 500,
      message: error.message || '服务器错误',
      requestId,
      duration: Date.now() - startTime
    }
  }
}

/**
 * 获取学校列表
 */
async function getSchoolList(data, requestId) {
  const {
    page = 1,
    pageSize = 20,
    province,
    level,
    type,
    tags,
    sortBy = 'ranking',
    sortOrder = 'asc'
  } = data || {}
  
  // 构建查询条件
  const query = { status: 'active' }
  
  if (province) {
    query.province = province
  }
  
  if (level) {
    query.level = level
  }
  
  if (type) {
    query.type = type
  }
  
  if (tags && tags.length > 0) {
    query.tags = _.in(tags)
  }
  
  // 分页
  const skip = (page - 1) * pageSize
  
  // 排序
  const orderField = sortBy === 'ranking' ? 'ranking.overall' : sortBy
  const orderDirection = sortOrder === 'desc' ? 'desc' : 'asc'
  
  const [schools, countResult] = await Promise.all([
    db.collection('schools')
      .where(query)
      .orderBy(orderField, orderDirection)
      .skip(skip)
      .limit(pageSize)
      .field({
        _id: true,
        code: true,
        name: true,
        shortName: true,
        province: true,
        city: true,
        level: true,
        tags: true,
        type: true,
        logo: true,
        ranking: true,
        graduateInfo: true
      })
      .get(),
    db.collection('schools')
      .where(query)
      .count()
  ])
  
  return {
    code: 0,
    data: {
      list: schools.data || [],
      total: countResult.total || 0,
      page,
      pageSize
    },
    requestId
  }
}

/**
 * 获取学校详情
 */
async function getSchoolDetail(data, requestId) {
  const { schoolId, code } = data || {}
  
  if (!schoolId && !code) {
    return { code: 400, message: '缺少学校ID或代码', requestId }
  }
  
  const query = schoolId ? { _id: schoolId } : { code }
  
  const result = await db.collection('schools')
    .where(query)
    .getOne()
  
  if (!result.data) {
    return { code: 404, message: '学校不存在', requestId }
  }
  
  // 获取学院列表
  const colleges = await db.collection('colleges')
    .where({ schoolId: result.data._id })
    .get()
  
  // 获取最新分数线
  const latestScoreLines = await db.collection('score_lines')
    .where({ schoolId: result.data._id })
    .orderBy('year', 'desc')
    .limit(10)
    .get()
  
  return {
    code: 0,
    data: {
      ...result.data,
      colleges: colleges.data || [],
      latestScoreLines: latestScoreLines.data || []
    },
    requestId
  }
}

/**
 * 搜索学校
 */
async function searchSchools(data, requestId) {
  const { keyword, limit = 10 } = data || {}
  
  if (!keyword || keyword.trim() === '') {
    return { code: 400, message: '搜索关键词不能为空', requestId }
  }
  
  const searchTerm = keyword.trim()
  
  // 使用正则搜索（名称、简称、代码）
  const result = await db.collection('schools')
    .where({
      status: 'active',
      $or: [
        { name: { $regex: searchTerm, $options: 'i' } },
        { shortName: { $regex: searchTerm, $options: 'i' } },
        { code: { $regex: searchTerm, $options: 'i' } }
      ]
    })
    .limit(limit)
    .field({
      _id: true,
      code: true,
      name: true,
      shortName: true,
      province: true,
      level: true,
      tags: true,
      logo: true
    })
    .get()
  
  return {
    code: 0,
    data: result.data || [],
    requestId
  }
}

/**
 * 获取热门学校
 */
async function getHotSchools(data, requestId) {
  const { limit = 10, province } = data || {}
  
  const query = { status: 'active' }
  
  if (province) {
    query.province = province
  }
  
  // 按排名获取热门学校
  const result = await db.collection('schools')
    .where(query)
    .orderBy('ranking.overall', 'asc')
    .limit(limit)
    .field({
      _id: true,
      code: true,
      name: true,
      shortName: true,
      province: true,
      level: true,
      tags: true,
      logo: true,
      ranking: true
    })
    .get()
  
  return {
    code: 0,
    data: result.data || [],
    requestId
  }
}

/**
 * 获取专业列表
 */
async function getMajors(data, requestId) {
  const {
    schoolId,
    collegeId,
    category,
    degree,
    keyword,
    page = 1,
    pageSize = 20
  } = data || {}
  
  if (!schoolId) {
    return { code: 400, message: '缺少学校ID', requestId }
  }
  
  const query = { schoolId }
  
  if (collegeId) {
    query.collegeId = collegeId
  }
  
  if (category) {
    query.category = category
  }
  
  if (degree) {
    query.degree = degree
  }
  
  if (keyword) {
    query.$or = [
      { name: { $regex: keyword, $options: 'i' } },
      { code: { $regex: keyword, $options: 'i' } }
    ]
  }
  
  const skip = (page - 1) * pageSize
  
  const [majors, countResult] = await Promise.all([
    db.collection('majors')
      .where(query)
      .skip(skip)
      .limit(pageSize)
      .get(),
    db.collection('majors')
      .where(query)
      .count()
  ])
  
  return {
    code: 0,
    data: {
      list: majors.data || [],
      total: countResult.total || 0,
      page,
      pageSize
    },
    requestId
  }
}

/**
 * 获取专业详情
 */
async function getMajorDetail(data, requestId) {
  const { majorId } = data || {}
  
  if (!majorId) {
    return { code: 400, message: '缺少专业ID', requestId }
  }
  
  const result = await db.collection('majors')
    .where({ _id: majorId })
    .getOne()
  
  if (!result.data) {
    return { code: 404, message: '专业不存在', requestId }
  }
  
  // 获取历年分数线
  const scoreLines = await db.collection('score_lines')
    .where({ majorId })
    .orderBy('year', 'desc')
    .limit(5)
    .get()
  
  // 获取历年报录比
  const ratios = await db.collection('admission_ratios')
    .where({ majorId })
    .orderBy('year', 'desc')
    .limit(5)
    .get()
  
  return {
    code: 0,
    data: {
      ...result.data,
      scoreLines: scoreLines.data || [],
      admissionRatios: ratios.data || []
    },
    requestId
  }
}

/**
 * 获取分数线
 */
async function getScoreLines(data, requestId) {
  const { schoolId, majorId, year, type } = data || {}
  
  const query = {}
  
  if (schoolId) query.schoolId = schoolId
  if (majorId) query.majorId = majorId
  if (year) query.year = year
  if (type) query.type = type
  
  const result = await db.collection('score_lines')
    .where(query)
    .orderBy('year', 'desc')
    .limit(50)
    .get()
  
  return {
    code: 0,
    data: result.data || [],
    requestId
  }
}

/**
 * 获取国家线
 */
async function getNationalLines(data, requestId) {
  const { year, category, region } = data || {}
  
  const query = { type: '国家线' }
  
  if (year) query.year = year
  if (category) query.category = category
  if (region) query.region = region
  
  const result = await db.collection('score_lines')
    .where(query)
    .orderBy('year', 'desc')
    .get()
  
  return {
    code: 0,
    data: result.data || [],
    requestId
  }
}

/**
 * 获取报录比
 */
async function getAdmissionRatios(data, requestId) {
  const { schoolId, majorId, year } = data || {}
  
  const query = {}
  
  if (schoolId) query.schoolId = schoolId
  if (majorId) query.majorId = majorId
  if (year) query.year = year
  
  const result = await db.collection('admission_ratios')
    .where(query)
    .orderBy('year', 'desc')
    .limit(50)
    .get()
  
  return {
    code: 0,
    data: result.data || [],
    requestId
  }
}

/**
 * 添加收藏
 */
async function addFavorite(ctx, data, requestId) {
  const userId = ctx.user?.userId || ctx.body?.userId
  
  if (!userId) {
    return { code: 401, message: '未登录', requestId }
  }
  
  const { schoolId, majorId, notes, priority, status } = data || {}
  
  if (!schoolId) {
    return { code: 400, message: '缺少学校ID', requestId }
  }
  
  // 检查是否已收藏
  const existing = await db.collection('user_school_favorites')
    .where({ userId, schoolId })
    .getOne()
  
  if (existing.data) {
    // 更新收藏
    await db.collection('user_school_favorites')
      .doc(existing.data._id)
      .update({
        majorId,
        notes,
        priority,
        status,
        updatedAt: Date.now()
      })
    
    return { code: 0, message: '更新成功', requestId }
  }
  
  // 新增收藏
  await db.collection('user_school_favorites').add({
    userId,
    schoolId,
    majorId,
    notes: notes || '',
    priority: priority || 3,
    status: status || 'considering',
    createdAt: Date.now(),
    updatedAt: Date.now()
  })
  
  return { code: 0, message: '收藏成功', requestId }
}

/**
 * 取消收藏
 */
async function removeFavorite(ctx, data, requestId) {
  const userId = ctx.user?.userId || ctx.body?.userId
  
  if (!userId) {
    return { code: 401, message: '未登录', requestId }
  }
  
  const { schoolId } = data || {}
  
  if (!schoolId) {
    return { code: 400, message: '缺少学校ID', requestId }
  }
  
  await db.collection('user_school_favorites')
    .where({ userId, schoolId })
    .remove()
  
  return { code: 0, message: '取消收藏成功', requestId }
}

/**
 * 获取收藏列表
 */
async function getFavorites(ctx, data, requestId) {
  const userId = ctx.user?.userId || ctx.body?.userId
  
  if (!userId) {
    return { code: 401, message: '未登录', requestId }
  }
  
  const { status } = data || {}
  
  const query = { userId }
  if (status) query.status = status
  
  const favorites = await db.collection('user_school_favorites')
    .where(query)
    .orderBy('priority', 'asc')
    .orderBy('createdAt', 'desc')
    .get()
  
  // 获取学校详情
  const schoolIds = favorites.data?.map(f => f.schoolId) || []
  
  if (schoolIds.length > 0) {
    const schools = await db.collection('schools')
      .where({ _id: _.in(schoolIds) })
      .field({
        _id: true,
        code: true,
        name: true,
        shortName: true,
        province: true,
        level: true,
        tags: true,
        logo: true
      })
      .get()
    
    const schoolMap = new Map()
    schools.data?.forEach(s => schoolMap.set(s._id, s))
    
    // 合并数据
    const result = favorites.data?.map(f => ({
      ...f,
      school: schoolMap.get(f.schoolId) || null
    }))
    
    return { code: 0, data: result, requestId }
  }
  
  return { code: 0, data: [], requestId }
}

/**
 * 获取统计数据
 */
async function getStats(requestId) {
  const [schoolCount, majorCount, provinceCount] = await Promise.all([
    db.collection('schools').where({ status: 'active' }).count(),
    db.collection('majors').count(),
    db.collection('schools')
      .aggregate()
      .match({ status: 'active' })
      .group({ _id: '$province', count: { $sum: 1 } })
      .end()
  ])
  
  return {
    code: 0,
    data: {
      totalSchools: schoolCount.total || 0,
      totalMajors: majorCount.total || 0,
      byProvince: provinceCount.data || []
    },
    requestId
  }
}

/**
 * 获取省份列表
 */
async function getProvinces(requestId) {
  const result = await db.collection('schools')
    .aggregate()
    .match({ status: 'active' })
    .group({
      _id: '$province',
      count: { $sum: 1 }
    })
    .sort({ count: -1 })
    .end()
  
  const provinces = result.data?.map(p => ({
    name: p._id,
    count: p.count
  })) || []
  
  return {
    code: 0,
    data: provinces,
    requestId
  }
}
