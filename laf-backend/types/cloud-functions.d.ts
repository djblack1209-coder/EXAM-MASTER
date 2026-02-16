/**
 * Exam-Master 后端共享类型定义
 *
 * 消除云函数中的 `any` 类型，提供统一的接口定义
 *
 * @version 1.0.0
 */

// ==================== 基础类型 ====================

/** 通用日志函数签名 */
export type LogFn = (...args: unknown[]) => void

/** 标准 Logger 接口 */
export interface Logger {
  info: LogFn
  warn: LogFn
  error: LogFn
}

/** MongoDB 文档基础字段 */
export interface BaseDocument {
  _id?: string
  created_at?: number
  updated_at?: number
}

/** 分页参数 */
export interface PaginationParams {
  page?: number
  limit?: number
  pageSize?: number
}

/** 通用 handler 请求数据 */
export interface HandlerData extends PaginationParams {
  [key: string]: unknown
}

// ==================== 用户相关 ====================

export interface UserDocument extends BaseDocument {
  email?: string
  nickname?: string
  avatar_url?: string
  openid?: string
  h5_openid?: string
  unionid?: string
  qq_openid?: string
  password_hash?: string
  role?: string
  status?: string
  login_count?: number
  last_login_at?: number
  achievements?: UserAchievement[]
  streak_days?: number
  total_study_days?: number
  total_questions?: number
  total_correct?: number
  pk_count?: number
  pk_wins?: number
  mastered_mistakes?: number
  coins?: number
}

export interface UserAchievement {
  id: string
  unlocked_at: number
}

export interface LoginParams {
  type: string
  code?: string
  email?: string
  password?: string
  verifyCode?: string
  nickname?: string
  avatarUrl?: string
  userInfo?: WxUserInfo
}

export interface WxUserInfo {
  nickName?: string
  avatarUrl?: string
  gender?: number
}

export interface LoginValidationResult {
  valid: boolean
  error?: string
  sanitized?: LoginParams
}

// ==================== 错题相关 ====================

export interface MistakeDocument extends BaseDocument {
  user_id: string
  question_content?: string
  correct_answer?: string
  user_answer?: string
  analysis?: string
  category?: string
  error_type?: string
  is_mastered?: boolean
  next_review_time?: number
  review_count?: number
  options?: string[]
  tags?: string[]
  source?: string
  difficulty?: number
  _content_hash?: string
}

export interface MistakeData {
  question_content?: string
  correct_answer?: string
  user_answer?: string
  analysis?: string
  category?: string
  error_type?: string
  options?: string[]
  tags?: string[]
  source?: string
  difficulty?: number
}

export interface MistakeValidationResult {
  valid: boolean
  error?: string
  sanitized?: MistakeData
}

// ==================== PK 对战 ====================

export interface PkBattleDocument extends BaseDocument {
  player1_id: string
  player2_id?: string
  player1_score?: number
  player2_score?: number
  status?: string
  questions?: PkQuestion[]
  winner_id?: string
  finished_at?: number
}

export interface PkQuestion {
  id: string
  content: string
  options: string[]
  correct_answer: string
}

export interface PlayerInfo {
  uid: string
  score: number
  answers?: Record<string, string>
  finish_time?: number
}

export interface ClientInfo {
  platform?: string
  version?: string
  ip?: string
  [key: string]: unknown
}

export interface AntiCheatResult {
  passed: boolean
  reasons: string[]
}

// ==================== 学习资源 ====================

export interface ResourceDocument extends BaseDocument {
  title?: string
  description?: string
  category?: string
  subject?: string
  url?: string
  cover_url?: string
  author?: string
  status?: string
  view_count?: number
  favorite_count?: number
  tags?: string[]
  difficulty?: number
}

export interface EnrichedResource extends ResourceDocument {
  category_name?: string
  category_icon?: string
  category_color?: string
}

// ==================== 学习目标 ====================

export interface LearningGoalDocument extends BaseDocument {
  user_id: string
  type: string
  title?: string
  target_value?: number
  current_value?: number
  status?: string
  deadline?: number
}

export interface GoalUpdateData {
  title?: string
  target_value?: number
  status?: string
  deadline?: number
  updated_at?: number
}

// ==================== 排行榜 ====================

export interface RankCacheEntry<T = unknown> {
  data: T
  expireAt: number
}

export interface RankDocument extends BaseDocument {
  user_id: string
  score: number
  rank_type?: string
  period?: string
  nickname?: string
  avatar_url?: string
}

// ==================== 答题提交 ====================

export interface SubmitParams {
  questionId: string
  answer: string
  timeSpent?: number
  practiceType?: string
  category?: string
}

export interface SubmitValidationResult {
  valid: boolean
  error?: string
  sanitized?: SubmitParams
}

// ==================== 用户统计 ====================

export interface StudyStatsDocument extends BaseDocument {
  user_id: string
  date: string
  study_time?: number
  questions_count?: number
  correct_count?: number
  subjects?: Record<string, number>
}

// ==================== 数据库查询 ====================

/** MongoDB 查询条件对象 */
export type DbQuery = Record<string, unknown>

/** MongoDB 更新数据对象 */
export type DbUpdateData = Record<string, unknown>

// ==================== 幂等性 ====================

export interface IdempotencyResult {
  _id?: string
  status?: string
  result?: unknown
}

// ==================== JWT ====================

export interface JwtPayload {
  uid: string
  exp?: number
  iat?: number
  [key: string]: unknown
}

// ==================== 验证工具 ====================

export interface ValidationResult {
  valid: boolean
  error?: string
}
