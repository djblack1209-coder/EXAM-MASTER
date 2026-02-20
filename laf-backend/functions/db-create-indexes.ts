/**
 * 数据库索引迁移脚本
 * B010 + B012 + B002: 为 MongoDB 集合添加必要索引
 *
 * 使用方式：
 * 1. 在 Laf 控制台的云函数中创建此函数
 * 2. 调用一次即可完成索引创建
 * 3. 索引创建是幂等操作，重复执行不会报错
 *
 * B002 更新：补充 13 个缺失集合的索引，修正 mistakes → mistake_book 集合名
 * B003 更新：修正 rankings/favorites/learning_goals 索引字段名与实际查询不匹配问题，
 *   补充 crawler_schools/crawler_meta/user_profiles/data_backups 集合索引，
 *   补充 goal_progress 复合索引，补充 users.nickname 索引
 * B004 更新：补充 9 个缺失索引（rankings 按周期查询、mistake_book 按 error_type/tags、
 *   practice_records 按 is_correct、favorites 按 source、learning_resources 文本索引+subject、
 *   users 按 total_questions），修正 rankings 过时索引
 *
 * @version 1.3.0
 */

import cloud from '@lafjs/cloud';
import { createLogger } from './_shared/api-response';

const logger = createLogger('[DbIndexes]');
const db = cloud.database();

export default async function (ctx) {
  try {
    // [C3-FIX] 管理工具函数需要管理员权限
    const adminSecret = ctx.headers?.['x-admin-secret'] || ctx.body?.adminSecret;
    if (!adminSecret || adminSecret !== process.env.ADMIN_SECRET) {
      return { code: 403, success: false, message: '需要管理员权限，请提供 ADMIN_SECRET' };
    }

    const results = [];

    // ==================== 用户表索引 (B012) ====================
    try {
      const usersCol = db.collection('users');
      await usersCol.createIndex({ email: 1 }, { unique: true, sparse: true, name: 'idx_email' });
      await usersCol.createIndex({ openid: 1 }, { sparse: true, name: 'idx_openid' });
      await usersCol.createIndex({ h5_openid: 1 }, { sparse: true, name: 'idx_h5_openid' });
      await usersCol.createIndex({ unionid: 1 }, { sparse: true, name: 'idx_unionid' });
      await usersCol.createIndex({ created_at: -1 }, { name: 'idx_created_at' });
      // 补充: social-service.ts 按 nickname 正则搜索
      await usersCol.createIndex({ nickname: 1 }, { sparse: true, name: 'idx_nickname' });
      // B004: user-stats.ts 按 total_questions 排名查询
      await usersCol.createIndex({ total_questions: -1 }, { sparse: true, name: 'idx_total_questions' });
      results.push({ collection: 'users', status: 'ok', indexes: 7 });
    } catch (e) {
      results.push({ collection: 'users', status: 'error', message: e.message });
    }

    // ==================== 错题本索引 (B010 - 修正: mistakes → mistake_book, userId → user_id) ====================
    try {
      const mistakeBookCol = db.collection('mistake_book');
      await mistakeBookCol.createIndex({ user_id: 1, created_at: -1 }, { name: 'idx_user_created' });
      await mistakeBookCol.createIndex(
        { user_id: 1, category: 1, created_at: -1 },
        { name: 'idx_user_category_created' }
      );
      await mistakeBookCol.createIndex({ user_id: 1, is_mastered: 1 }, { name: 'idx_user_mastered' });
      await mistakeBookCol.createIndex({ user_id: 1, _content_hash: 1 }, { name: 'idx_user_content_hash' });
      // B004: mistake-manager.ts 按 error_type 过滤
      await mistakeBookCol.createIndex(
        { user_id: 1, error_type: 1, created_at: -1 },
        { name: 'idx_user_errortype_created' }
      );
      // B004: mistake-manager.ts 按 tags 数组过滤
      await mistakeBookCol.createIndex({ user_id: 1, tags: 1, created_at: -1 }, { name: 'idx_user_tags_created' });
      results.push({ collection: 'mistake_book', status: 'ok', indexes: 6 });
    } catch (e) {
      results.push({ collection: 'mistake_book', status: 'error', message: e.message });
    }

    // ==================== 题库表索引 ====================
    try {
      const questionsCol = db.collection('questions');
      await questionsCol.createIndex({ userId: 1, category: 1 }, { name: 'idx_user_category' });
      await questionsCol.createIndex({ userId: 1, created_at: -1 }, { name: 'idx_user_created' });
      results.push({ collection: 'questions', status: 'ok', indexes: 2 });
    } catch (e) {
      results.push({ collection: 'questions', status: 'error', message: e.message });
    }

    // ==================== 学习目标表索引 ====================
    try {
      const goalsCol = db.collection('learning_goals');
      // 修正: 实际查询使用 user_id 而非 userId (learning-goal.ts)
      await goalsCol.createIndex({ user_id: 1, status: 1 }, { name: 'idx_user_status' });
      await goalsCol.createIndex({ user_id: 1, type: 1, status: 1 }, { name: 'idx_user_type_status' });
      await goalsCol.createIndex({ user_id: 1, created_at: -1 }, { name: 'idx_user_created' });
      results.push({ collection: 'learning_goals', status: 'ok', indexes: 3 });
    } catch (e) {
      results.push({ collection: 'learning_goals', status: 'error', message: e.message });
    }

    // ==================== 成就表索引 ====================
    try {
      const achievementsCol = db.collection('achievements');
      await achievementsCol.createIndex({ userId: 1 }, { name: 'idx_user' });
      await achievementsCol.createIndex(
        { userId: 1, achievementId: 1 },
        { unique: true, name: 'idx_user_achievement' }
      );
      results.push({ collection: 'achievements', status: 'ok', indexes: 2 });
    } catch (e) {
      results.push({ collection: 'achievements', status: 'error', message: e.message });
    }

    // ==================== PK 对战表索引 ====================
    try {
      const battlesCol = db.collection('pk_battles');
      await battlesCol.createIndex({ status: 1, created_at: -1 }, { name: 'idx_status_created' });
      await battlesCol.createIndex({ 'players.userId': 1, status: 1 }, { name: 'idx_player_status' });
      results.push({ collection: 'pk_battles', status: 'ok', indexes: 2 });
    } catch (e) {
      results.push({ collection: 'pk_battles', status: 'error', message: e.message });
    }

    // ==================== 排行榜表索引 ==================
    try {
      const rankCol = db.collection('rankings');
      // B004: 旧索引 { type: 1, score: -1 } 已过时，rank-center.ts 使用按周期的字段
      // 保留旧索引以兼容可能的其他查询，新增实际查询所需的索引
      await rankCol.createIndex({ type: 1, score: -1 }, { name: 'idx_type_score' });
      // 修正: 实际查询使用 uid 而非 userId (rank-center.ts, pk-battle.ts)
      await rankCol.createIndex({ uid: 1 }, { name: 'idx_uid' });
      // B004: rank-center.ts 按日/周/月/总分排行查询
      await rankCol.createIndex({ daily_date: 1, daily_score: -1 }, { name: 'idx_daily_date_score' });
      await rankCol.createIndex({ weekly_start: 1, weekly_score: -1 }, { name: 'idx_weekly_start_score' });
      await rankCol.createIndex({ monthly_start: 1, monthly_score: -1 }, { name: 'idx_monthly_start_score' });
      await rankCol.createIndex({ total_score: -1 }, { name: 'idx_total_score' });
      results.push({ collection: 'rankings', status: 'ok', indexes: 6 });
    } catch (e) {
      results.push({ collection: 'rankings', status: 'error', message: e.message });
    }

    // ==================== 学习小组表索引 ====================
    try {
      const groupsCol = db.collection('groups');
      await groupsCol.createIndex({ status: 1, created_at: -1 }, { name: 'idx_status_created' });
      await groupsCol.createIndex({ 'members.userId': 1 }, { name: 'idx_member_user' });
      results.push({ collection: 'groups', status: 'ok', indexes: 2 });
    } catch (e) {
      results.push({ collection: 'groups', status: 'error', message: e.message });
    }

    // ==================== 院校表索引 ====================
    try {
      const schoolsCol = db.collection('schools');
      await schoolsCol.createIndex({ name: 'text' }, { name: 'idx_name_text' });
      await schoolsCol.createIndex({ province: 1, is985: 1 }, { name: 'idx_province_985' });
      await schoolsCol.createIndex({ province: 1, is211: 1 }, { name: 'idx_province_211' });
      results.push({ collection: 'schools', status: 'ok', indexes: 3 });
    } catch (e) {
      results.push({ collection: 'schools', status: 'error', message: e.message });
    }

    // ==================== 专业表索引 (B015) ====================
    try {
      const majorsCol = db.collection('majors');
      await majorsCol.createIndex({ schoolId: 1, category: 1 }, { name: 'idx_school_category' });
      await majorsCol.createIndex({ schoolId: 1, degree: 1 }, { name: 'idx_school_degree' });
      await majorsCol.createIndex({ name: 'text', code: 'text' }, { name: 'idx_name_code_text' });
      results.push({ collection: 'majors', status: 'ok', indexes: 3 });
    } catch (e) {
      results.push({ collection: 'majors', status: 'error', message: e.message });
    }

    // ==================== 分数线表索引 ====================
    try {
      const scoreLinesCol = db.collection('score_lines');
      await scoreLinesCol.createIndex({ schoolId: 1, year: -1 }, { name: 'idx_school_year' });
      await scoreLinesCol.createIndex({ majorId: 1, year: -1 }, { name: 'idx_major_year' });
      results.push({ collection: 'score_lines', status: 'ok', indexes: 2 });
    } catch (e) {
      results.push({ collection: 'score_lines', status: 'error', message: e.message });
    }

    // ==================== 收藏表索引 ====================
    try {
      const favoritesCol = db.collection('favorites');
      // 修正: 实际查询使用 user_id/question_id 而非 userId/targetId (favorite-manager.ts)
      await favoritesCol.createIndex({ user_id: 1, created_at: -1 }, { name: 'idx_user_created' });
      await favoritesCol.createIndex({ user_id: 1, question_id: 1 }, { unique: true, name: 'idx_user_question' });
      await favoritesCol.createIndex(
        { user_id: 1, category: 1, created_at: -1 },
        { name: 'idx_user_category_created' }
      );
      // B004: favorite-manager.ts 按 source 过滤
      await favoritesCol.createIndex({ user_id: 1, source: 1, created_at: -1 }, { name: 'idx_user_source_created' });
      results.push({ collection: 'favorites', status: 'ok', indexes: 4 });
    } catch (e) {
      results.push({ collection: 'favorites', status: 'error', message: e.message });
    }

    // ==================== 验证码表索引 ====================
    try {
      const codesCol = db.collection('email_codes');
      await codesCol.createIndex({ email: 1, created_at: -1 }, { name: 'idx_email_created' });
      await codesCol.createIndex({ created_at: 1 }, { expireAfterSeconds: 600, name: 'idx_ttl_10min' });
      results.push({ collection: 'email_codes', status: 'ok', indexes: 2 });
    } catch (e) {
      results.push({ collection: 'email_codes', status: 'error', message: e.message });
    }

    // ==================== 邀请表索引 ====================
    try {
      const invitesCol = db.collection('invites');
      await invitesCol.createIndex({ inviterId: 1, inviteeId: 1 }, { unique: true, name: 'idx_inviter_invitee' });
      await invitesCol.createIndex({ inviteeId: 1 }, { name: 'idx_invitee' });
      results.push({ collection: 'invites', status: 'ok', indexes: 2 });
    } catch (e) {
      results.push({ collection: 'invites', status: 'error', message: e.message });
    }

    // ==================== 邀请统计表索引 ====================
    try {
      const inviteStatsCol = db.collection('invite_stats');
      await inviteStatsCol.createIndex({ userId: 1 }, { unique: true, name: 'idx_user' });
      results.push({ collection: 'invite_stats', status: 'ok', indexes: 1 });
    } catch (e) {
      results.push({ collection: 'invite_stats', status: 'error', message: e.message });
    }

    // ==================== B002: 以下为新增的缺失集合索引 ====================

    // ==================== 练习记录表索引 ====================
    try {
      const practiceCol = db.collection('practice_records');
      await practiceCol.createIndex({ user_id: 1, created_at: -1 }, { name: 'idx_user_created' });
      await practiceCol.createIndex({ user_id: 1, category: 1, created_at: -1 }, { name: 'idx_user_category_created' });
      // B004: answer-submit.ts 按 is_correct 过滤
      await practiceCol.createIndex(
        { user_id: 1, is_correct: 1, created_at: -1 },
        { name: 'idx_user_correct_created' }
      );
      results.push({ collection: 'practice_records', status: 'ok', indexes: 3 });
    } catch (e) {
      results.push({ collection: 'practice_records', status: 'error', message: e.message });
    }

    // ==================== 幂等记录表索引 ====================
    try {
      const idempotencyCol = db.collection('idempotency_records');
      await idempotencyCol.createIndex({ key: 1, expires_at: 1 }, { name: 'idx_key_expires' });
      await idempotencyCol.createIndex({ expires_at: 1 }, { expireAfterSeconds: 0, name: 'idx_ttl_auto' });
      results.push({ collection: 'idempotency_records', status: 'ok', indexes: 2 });
    } catch (e) {
      results.push({ collection: 'idempotency_records', status: 'error', message: e.message });
    }

    // ==================== 好友表索引 ====================
    try {
      const friendsCol = db.collection('friends');
      await friendsCol.createIndex({ user_id: 1, friend_id: 1 }, { unique: true, name: 'idx_user_friend' });
      await friendsCol.createIndex({ user_id: 1, status: 1 }, { name: 'idx_user_status' });
      await friendsCol.createIndex({ friend_id: 1, status: 1, created_at: -1 }, { name: 'idx_friend_status_created' });
      results.push({ collection: 'friends', status: 'ok', indexes: 3 });
    } catch (e) {
      results.push({ collection: 'friends', status: 'error', message: e.message });
    }

    // ==================== AI 好友记忆表索引 ====================
    try {
      const aiMemoryCol = db.collection('ai_friend_memory');
      await aiMemoryCol.createIndex({ user_id: 1, friend_type: 1, created_at: -1 }, { name: 'idx_user_type_created' });
      // 兼容 proxy-ai.ts 中的驼峰字段名
      await aiMemoryCol.createIndex({ userId: 1, friendType: 1 }, { name: 'idx_userId_friendType' });
      results.push({ collection: 'ai_friend_memory', status: 'ok', indexes: 2 });
    } catch (e) {
      results.push({ collection: 'ai_friend_memory', status: 'error', message: e.message });
    }

    // ==================== 每日统计表索引 ====================
    try {
      const dailyStatsCol = db.collection('daily_stats');
      await dailyStatsCol.createIndex({ user_id: 1, date_key: 1 }, { unique: true, name: 'idx_user_datekey' });
      await dailyStatsCol.createIndex({ user_id: 1, date: 1 }, { name: 'idx_user_date' });
      results.push({ collection: 'daily_stats', status: 'ok', indexes: 2 });
    } catch (e) {
      results.push({ collection: 'daily_stats', status: 'error', message: e.message });
    }

    // ==================== 目标进度表索引 ====================
    try {
      const goalProgressCol = db.collection('goal_progress');
      await goalProgressCol.createIndex({ user_id: 1, goal_type: 1, date: 1 }, { name: 'idx_user_type_date' });
      // 补充: learning-goal.ts 按 goal_id + date_key 查询
      await goalProgressCol.createIndex({ goal_id: 1, date_key: 1 }, { name: 'idx_goal_datekey' });
      await goalProgressCol.createIndex({ goal_id: 1 }, { name: 'idx_goal' });
      results.push({ collection: 'goal_progress', status: 'ok', indexes: 3 });
    } catch (e) {
      results.push({ collection: 'goal_progress', status: 'error', message: e.message });
    }

    // ==================== 学习进度表索引 ====================
    try {
      const learningProgressCol = db.collection('learning_progress');
      await learningProgressCol.createIndex(
        { user_id: 1, resource_id: 1 },
        { unique: true, name: 'idx_user_resource' }
      );
      results.push({ collection: 'learning_progress', status: 'ok', indexes: 1 });
    } catch (e) {
      results.push({ collection: 'learning_progress', status: 'error', message: e.message });
    }

    // ==================== 学习资源表索引 ====================
    try {
      const resourcesCol = db.collection('learning_resources');
      await resourcesCol.createIndex(
        { status: 1, recommend_weight: -1, view_count: -1 },
        { name: 'idx_status_recommend' }
      );
      await resourcesCol.createIndex({ status: 1, category: 1, view_count: -1 }, { name: 'idx_status_category_views' });
      await resourcesCol.createIndex(
        { status: 1, category: 1, created_at: -1 },
        { name: 'idx_status_category_created' }
      );
      // B004: learning-resource.ts 按 subject 过滤 + 关键词搜索
      await resourcesCol.createIndex({ status: 1, subject: 1, view_count: -1 }, { name: 'idx_status_subject_views' });
      await resourcesCol.createIndex({ status: 1, subject: 1, created_at: -1 }, { name: 'idx_status_subject_created' });
      // B004: 文本索引用于关键词搜索（替代 $regex 全表扫描）
      await resourcesCol.createIndex({ title: 'text', description: 'text', tags: 'text' }, { name: 'idx_search_text' });
      results.push({ collection: 'learning_resources', status: 'ok', indexes: 6 });
    } catch (e) {
      results.push({ collection: 'learning_resources', status: 'error', message: e.message });
    }

    // ==================== PK 记录表索引 ====================
    try {
      const pkRecordsCol = db.collection('pk_records');
      await pkRecordsCol.createIndex({ 'player1.uid': 1, created_at: -1 }, { name: 'idx_player1_created' });
      await pkRecordsCol.createIndex({ 'player2.uid': 1, created_at: -1 }, { name: 'idx_player2_created' });
      results.push({ collection: 'pk_records', status: 'ok', indexes: 2 });
    } catch (e) {
      results.push({ collection: 'pk_records', status: 'error', message: e.message });
    }

    // ==================== 资源收藏表索引 ====================
    try {
      const resFavCol = db.collection('resource_favorites');
      await resFavCol.createIndex({ user_id: 1, resource_id: 1 }, { unique: true, name: 'idx_user_resource' });
      await resFavCol.createIndex({ user_id: 1, created_at: -1 }, { name: 'idx_user_created' });
      results.push({ collection: 'resource_favorites', status: 'ok', indexes: 2 });
    } catch (e) {
      results.push({ collection: 'resource_favorites', status: 'error', message: e.message });
    }

    // ==================== 可疑行为表索引 ====================
    try {
      const suspiciousCol = db.collection('suspicious_behaviors');
      await suspiciousCol.createIndex({ uid: 1, created_at: -1 }, { name: 'idx_uid_created' });
      results.push({ collection: 'suspicious_behaviors', status: 'ok', indexes: 1 });
    } catch (e) {
      results.push({ collection: 'suspicious_behaviors', status: 'error', message: e.message });
    }

    // ==================== 用户封禁表索引 ====================
    try {
      const bansCol = db.collection('user_bans');
      await bansCol.createIndex({ uid: 1, expires_at: 1 }, { name: 'idx_uid_expires' });
      results.push({ collection: 'user_bans', status: 'ok', indexes: 1 });
    } catch (e) {
      results.push({ collection: 'user_bans', status: 'error', message: e.message });
    }

    // ==================== 安全审计日志表索引 (S005) ====================
    try {
      const auditCol = db.collection('security_audit_logs');
      await auditCol.createIndex({ event: 1, timestamp: -1 }, { name: 'idx_event_time' });
      await auditCol.createIndex({ 'context.userId': 1, timestamp: -1 }, { name: 'idx_user_time' });
      await auditCol.createIndex({ severity: 1, timestamp: -1 }, { name: 'idx_severity_time' });
      await auditCol.createIndex(
        { created_at: 1 },
        { expireAfterSeconds: 7776000, name: 'idx_ttl_90days' } // 90天自动清理
      );
      results.push({ collection: 'security_audit_logs', status: 'ok', indexes: 4 });
    } catch (e) {
      results.push({ collection: 'security_audit_logs', status: 'error', message: e.message });
    }

    // ==================== 补充: 爬虫院校表索引 (school-crawler-api.ts) ====================
    try {
      const crawlerSchoolsCol = db.collection('crawler_schools');
      await crawlerSchoolsCol.createIndex({ code: 1 }, { unique: true, name: 'idx_code' });
      await crawlerSchoolsCol.createIndex({ province: 1, code: 1 }, { name: 'idx_province_code' });
      await crawlerSchoolsCol.createIndex({ type: 1 }, { name: 'idx_type' });
      await crawlerSchoolsCol.createIndex({ name: 'text' }, { name: 'idx_name_text' });
      results.push({ collection: 'crawler_schools', status: 'ok', indexes: 4 });
    } catch (e) {
      results.push({ collection: 'crawler_schools', status: 'error', message: e.message });
    }

    // ==================== 补充: 爬虫元数据表索引 ====================
    try {
      const crawlerMetaCol = db.collection('crawler_meta');
      await crawlerMetaCol.createIndex({ type: 1 }, { unique: true, name: 'idx_type' });
      results.push({ collection: 'crawler_meta', status: 'ok', indexes: 1 });
    } catch (e) {
      results.push({ collection: 'crawler_meta', status: 'error', message: e.message });
    }

    // ==================== 补充: 用户画像表索引 (learning-resource.ts) ====================
    try {
      const userProfilesCol = db.collection('user_profiles');
      await userProfilesCol.createIndex({ user_id: 1 }, { unique: true, name: 'idx_user' });
      results.push({ collection: 'user_profiles', status: 'ok', indexes: 1 });
    } catch (e) {
      results.push({ collection: 'user_profiles', status: 'error', message: e.message });
    }

    // ==================== 补充: 数据备份表索引 (data-cleanup.ts) ====================
    try {
      const backupsCol = db.collection('data_backups');
      await backupsCol.createIndex({ backup_id: 1 }, { unique: true, name: 'idx_backup_id' });
      await backupsCol.createIndex({ created_at: -1 }, { name: 'idx_created' });
      results.push({ collection: 'data_backups', status: 'ok', indexes: 2 });
    } catch (e) {
      results.push({ collection: 'data_backups', status: 'error', message: e.message });
    }

    const totalIndexes = results.reduce((sum, r) => sum + (r.indexes || 0), 0);
    const failedCollections = results.filter((r) => r.status === 'error');

    return {
      code: failedCollections.length > 0 ? 1 : 0,
      message: `索引创建完成: ${totalIndexes} 个索引, ${results.length} 个集合, ${failedCollections.length} 个失败`,
      data: results
    };
  } catch (error) {
    logger.error('[db-create-indexes] 索引创建脚本异常:', error);
    return {
      code: 500,
      message: '索引创建脚本执行异常',
      error: (error as Error).message
    };
  }
}
