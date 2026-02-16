/**
 * 幂等性工具库
 * 
 * 确保核心接口（提交答案、支付/充值）支持幂等，
 * 防止网络重发导致重复扣费或重复记录。
 * 
 * 实现原理：
 * 1. 客户端生成唯一请求ID (idempotencyKey)
 * 2. 服务端在处理前检查该ID是否已处理过
 * 3. 如果已处理，直接返回之前的结果
 * 4. 如果未处理，执行业务逻辑并记录结果
 * 
 * @version 1.0.0
 * @author EXAM-MASTER Backend Team
 */

import cloud from '@lafjs/cloud'

const db = cloud.database()

// 幂等记录集合名
const IDEMPOTENCY_COLLECTION = 'idempotency_records'

// 幂等记录过期时间（24小时）
const IDEMPOTENCY_TTL = 24 * 60 * 60 * 1000

// 环境配置
const IS_PRODUCTION = process.env.NODE_ENV === 'production'
const LOG_LEVEL = process.env.LOG_LEVEL || (IS_PRODUCTION ? 'warn' : 'info')

// 日志工具
const logger = {
  info: (...args: unknown[]) => { if (LOG_LEVEL !== 'warn' && LOG_LEVEL !== 'error') console.log(...args) },
  warn: (...args: unknown[]) => { if (LOG_LEVEL !== 'error') console.warn(...args) },
  error: (...args: unknown[]) => console.error(...args)
}

// ==================== 类型定义 ====================

export interface IdempotencyRecord {
  _id?: string
  key: string                    // 幂等键
  user_id: string               // 用户ID
  action: string                // 操作类型
  status: 'processing' | 'completed' | 'failed'
  result?: unknown               // 处理结果
  created_at: number
  completed_at?: number
  expires_at: number
}

export interface IdempotencyOptions {
  userId: string
  action: string
  idempotencyKey: string
  ttl?: number                  // 自定义过期时间
}

export interface IdempotencyResult {
  isNew: boolean                // 是否是新请求
  isDuplicate: boolean          // 是否是重复请求
  previousResult?: unknown       // 之前的处理结果
  recordId?: string             // 记录ID
}

// ==================== 核心函数 ====================

/**
 * 生成幂等键
 * 格式: {userId}:{action}:{idempotencyKey}
 */
export function generateIdempotencyKey(
  userId: string, 
  action: string, 
  clientKey: string
): string {
  return `${userId}:${action}:${clientKey}`
}

/**
 * 检查并获取幂等记录
 * 
 * @returns 如果是重复请求，返回之前的结果；否则创建新记录
 */
export async function checkIdempotency(
  options: IdempotencyOptions
): Promise<IdempotencyResult> {
  const { userId, action, idempotencyKey, ttl = IDEMPOTENCY_TTL } = options
  
  // 生成完整的幂等键
  const fullKey = generateIdempotencyKey(userId, action, idempotencyKey)
  
  const collection = db.collection(IDEMPOTENCY_COLLECTION)
  const now = Date.now()
  
  try {
    // 1. 查找现有记录
    const existing = await collection.where({
      key: fullKey,
      expires_at: db.command.gt(now)  // 未过期
    }).getOne()
    
    if (existing.data) {
      const record = existing.data as IdempotencyRecord
      
      // 2. 如果已完成，返回之前的结果
      if (record.status === 'completed') {
        logger.info(`[Idempotency] 重复请求，返回缓存结果: ${fullKey}`)
        return {
          isNew: false,
          isDuplicate: true,
          previousResult: record.result,
          recordId: record._id
        }
      }
      
      // 3. 如果正在处理中，也视为重复请求
      if (record.status === 'processing') {
        // 检查是否处理超时（超过30秒视为超时）
        if (now - record.created_at > 30000) {
          // 超时，允许重新处理
          await collection.doc(record._id).update({
            status: 'processing',
            created_at: now
          })
          logger.warn(`[Idempotency] 处理超时，重新处理: ${fullKey}`)
          return {
            isNew: true,
            isDuplicate: false,
            recordId: record._id
          }
        }
        
        logger.warn(`[Idempotency] 请求正在处理中: ${fullKey}`)
        return {
          isNew: false,
          isDuplicate: true,
          previousResult: { code: 429, message: '请求正在处理中，请稍后' }
        }
      }
      
      // 4. 如果之前失败，允许重试
      if (record.status === 'failed') {
        await collection.doc(record._id).update({
          status: 'processing',
          created_at: now
        })
        logger.info(`[Idempotency] 重试之前失败的请求: ${fullKey}`)
        return {
          isNew: true,
          isDuplicate: false,
          recordId: record._id
        }
      }
    }
    
    // 5. 创建新记录
    const newRecord: IdempotencyRecord = {
      key: fullKey,
      user_id: userId,
      action,
      status: 'processing',
      created_at: now,
      expires_at: now + ttl
    }
    
    const insertResult = await collection.add(newRecord)
    
    logger.info(`[Idempotency] 新请求，创建记录: ${fullKey}`)
    
    return {
      isNew: true,
      isDuplicate: false,
      recordId: insertResult.id
    }
    
  } catch (error) {
    logger.error(`[Idempotency] 检查幂等性失败:`, error)
    // 出错时允许继续处理，但不保证幂等性
    return {
      isNew: true,
      isDuplicate: false
    }
  }
}

/**
 * 标记请求完成
 */
export async function markCompleted(
  recordId: string,
  result: unknown
): Promise<void> {
  if (!recordId) return
  
  const collection = db.collection(IDEMPOTENCY_COLLECTION)
  const now = Date.now()
  
  try {
    await collection.doc(recordId).update({
      status: 'completed',
      result,
      completed_at: now
    })
    logger.info(`[Idempotency] 标记完成: ${recordId}`)
  } catch (error) {
    logger.error(`[Idempotency] 标记完成失败:`, error)
  }
}

/**
 * 标记请求失败
 */
export async function markFailed(
  recordId: string,
  error: unknown
): Promise<void> {
  if (!recordId) return
  
  const collection = db.collection(IDEMPOTENCY_COLLECTION)
  const now = Date.now()
  
  try {
    await collection.doc(recordId).update({
      status: 'failed',
      result: { error: error?.message || String(error) },
      completed_at: now
    })
    logger.warn(`[Idempotency] 标记失败: ${recordId}`)
  } catch (err) {
    logger.error(`[Idempotency] 标记失败时出错:`, err)
  }
}

/**
 * 幂等性包装器
 * 
 * 使用方式：
 * const result = await withIdempotency(
 *   { userId, action: 'submit_answer', idempotencyKey: clientKey },
 *   async () => {
 *     // 业务逻辑
 *     return { code: 0, data: ... }
 *   }
 * )
 */
export async function withIdempotency<T>(
  options: IdempotencyOptions,
  handler: () => Promise<T>
): Promise<T> {
  // 1. 检查幂等性
  const idempotencyResult = await checkIdempotency(options)
  
  // 2. 如果是重复请求，直接返回之前的结果
  if (idempotencyResult.isDuplicate && idempotencyResult.previousResult) {
    return idempotencyResult.previousResult as T
  }
  
  // 3. 执行业务逻辑
  try {
    const result = await handler()
    
    // 4. 标记完成
    if (idempotencyResult.recordId) {
      await markCompleted(idempotencyResult.recordId, result)
    }
    
    return result
  } catch (error) {
    // 5. 标记失败
    if (idempotencyResult.recordId) {
      await markFailed(idempotencyResult.recordId, error)
    }
    throw error
  }
}

// ==================== 清理过期记录 ====================

/**
 * 清理过期的幂等记录
 * 建议通过定时任务每天执行一次
 */
export async function cleanupExpiredRecords(): Promise<{ deleted: number }> {
  const collection = db.collection(IDEMPOTENCY_COLLECTION)
  const now = Date.now()
  
  try {
    // 删除过期记录
    const result = await collection.where({
      expires_at: db.command.lt(now)
    }).remove()
    
    const deleted = result.deleted || 0
    logger.info(`[Idempotency] 清理过期记录: ${deleted} 条`)
    
    return { deleted }
  } catch (error) {
    logger.error(`[Idempotency] 清理过期记录失败:`, error)
    return { deleted: 0 }
  }
}

// ==================== 导出 ====================

export default {
  generateIdempotencyKey,
  checkIdempotency,
  markCompleted,
  markFailed,
  withIdempotency,
  cleanupExpiredRecords
}
