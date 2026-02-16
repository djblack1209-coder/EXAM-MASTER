/**
 * 新用户创建触发器
 * 
 * 触发条件：users 集合新增文档
 * 
 * 功能：
 * 1. 初始化用户学习计划
 * 2. 发放新手成就
 * 3. 初始化排行榜记录
 */

import cloud from '@lafjs/cloud'

const db = cloud.database()

export default async function (ctx) {
  const { doc } = ctx // 新创建的用户文档
  
  if (!doc || !doc._id) {
    console.warn('[Trigger] 无效的用户文档')
    return
  }
  
  const userId = doc._id
  const now = Date.now()
  
  console.log(`[Trigger] 新用户创建: ${userId}`)
  
  try {
    // 1. 创建默认学习计划
    const defaultPlan = {
      user_id: userId,
      title: '考研备考计划',
      target_date: getDefaultExamDate(),
      daily_goal: 30,
      daily_study_minutes: 120,
      subjects: [
        { name: '政治', weight: 0.25, daily_questions: 8 },
        { name: '英语', weight: 0.25, daily_questions: 8 },
        { name: '数学', weight: 0.3, daily_questions: 9 },
        { name: '专业课', weight: 0.2, daily_questions: 5 }
      ],
      progress: {
        total_days: 0,
        completed_days: 0,
        total_questions: 0,
        completed_questions: 0
      },
      daily_records: [],
      is_active: true,
      created_at: now,
      updated_at: now
    }
    
    await db.collection('study_plans').add(defaultPlan)
    console.log(`[Trigger] 创建默认学习计划: ${userId}`)
    
    // 2. 发放新手成就
    const firstLoginAchievement = {
      id: 'first_login',
      name: '初来乍到',
      description: '首次登录应用',
      unlocked_at: now
    }
    
    await db.collection('users').doc(userId).update({
      achievements: db.command.push(firstLoginAchievement)
    })
    console.log(`[Trigger] 发放新手成就: ${userId}`)
    
    // 3. 初始化排行榜记录
    const today = new Date().toISOString().split('T')[0]
    const rankRecord = {
      uid: userId,
      nick_name: doc.nickname || '考研学子',
      avatar_url: doc.avatar_url || '',
      total_score: 0,
      daily_score: 0,
      daily_date: today,
      weekly_score: 0,
      weekly_start: getWeekStart(),
      monthly_score: 0,
      monthly_start: getMonthStart(),
      created_at: now,
      updated_at: now
    }
    
    await db.collection('rankings').add(rankRecord)
    console.log(`[Trigger] 初始化排行榜记录: ${userId}`)
    
  } catch (error) {
    console.error(`[Trigger] 新用户初始化失败: ${userId}`, error)
  }
}

/**
 * 获取默认考试日期（当年12月最后一个周末）
 */
function getDefaultExamDate() {
  const now = new Date()
  let year = now.getFullYear()
  
  // 如果已经过了12月，则设为下一年
  if (now.getMonth() === 11 && now.getDate() > 25) {
    year++
  }
  
  // 找到12月最后一个周六
  const dec31 = new Date(year, 11, 31)
  const dayOfWeek = dec31.getDay()
  const lastSaturday = 31 - (dayOfWeek === 6 ? 0 : (dayOfWeek + 1))
  
  return `${year}-12-${lastSaturday}`
}

/**
 * 获取本周开始日期
 */
function getWeekStart() {
  const now = new Date()
  const day = now.getDay()
  const diff = now.getDate() - day + (day === 0 ? -6 : 1)
  const weekStart = new Date(now.setDate(diff))
  return weekStart.toISOString().split('T')[0]
}

/**
 * 获取本月开始日期
 */
function getMonthStart() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
}
