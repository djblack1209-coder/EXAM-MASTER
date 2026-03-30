/**
 * RAG 文档索引云函数
 *
 * 将题库题目或自定义资料分块、生成嵌入向量，写入 document_chunks 集合，
 * 为 RAG 检索增强生成提供知识库。
 *
 * 支持操作：
 *   index_questions - 按题库 bankId 索引题目
 *   index_material  - 索引自定义文本资料
 *
 * @version 1.0.0
 */

import cloud from '@lafjs/cloud';
import { requireAuth, isAuthError } from './_shared/auth-middleware.js';
import {
  success,
  badRequest,
  unauthorized,
  serverError,
  generateRequestId,
  createLogger,
  wrapResponse,
  checkRateLimitDistributed,
  tooManyRequests
} from './_shared/api-response.js';
import { getBatchEmbeddings, chunkText } from './_shared/embedding.js';

const db = cloud.database();
const logger = createLogger('[RAGIngest]');

// ==================== 常量 ====================

/** 嵌入 API 批量大小（每批发送条数，控制速率） */
const EMBEDDING_BATCH_SIZE = 20;

/** 批次间等待毫秒数（避免触发 API 速率限制） */
const BATCH_DELAY_MS = 200;

/** 分块参数 */
const CHUNK_SIZE = 500;
const CHUNK_OVERLAP = 100;

/** MongoDB 批量写入分片大小 */
const DB_BATCH_SIZE = 50;

/** 单次索引最大题目数 */
const MAX_QUESTIONS = 500;

/** 单次索引最大文本长度（字符） */
const MAX_TEXT_LENGTH = 200_000;

// ==================== 类型定义 ====================

interface ChunkDocument {
  user_id: string;
  source_type: 'question' | 'material';
  source_id: string;
  chunk_index: number;
  text: string;
  embedding: number[];
  metadata: Record<string, any>;
  created_at: number;
}

// ==================== 主函数 ====================

export default async function (ctx) {
  const startTime = Date.now();
  const requestId = generateRequestId('rag_ingest');

  try {
    // ---- 认证 ----
    const authResult = requireAuth(ctx);
    if (isAuthError(authResult)) {
      return wrapResponse(unauthorized('请先登录'), requestId, startTime);
    }
    const { userId } = authResult;

    // 分布式频率限制（每用户每5分钟5次 — 嵌入API消耗大）
    const rateResult = await checkRateLimitDistributed(`rag:${userId}`, 5, 300_000);
    if (!rateResult.allowed) {
      logger.warn(`[${requestId}] RAG索引请求频率过高: userId=${userId}`);
      return wrapResponse(tooManyRequests('索引请求过于频繁，请5分钟后再试'), requestId, startTime);
    }

    const { action, data } = ctx.body || {};

    if (!action || typeof action !== 'string') {
      return wrapResponse(badRequest('缺少 action 参数'), requestId, startTime);
    }

    logger.info(`[${requestId}] 用户 ${userId} 发起 RAG 索引请求: action=${action}`);

    switch (action) {
      case 'index_questions':
        return wrapResponse(await indexQuestions(userId, data, requestId), requestId, startTime);
      case 'index_material':
        return wrapResponse(await indexMaterial(userId, data, requestId), requestId, startTime);
      default:
        return wrapResponse(badRequest(`未知的 action: ${action}`), requestId, startTime);
    }
  } catch (error: any) {
    logger.error(`[${requestId}] RAG 索引异常:`, error);
    // [AUDIT FIX R135] 不向客户端暴露内部错误详情，仅记录日志
    return wrapResponse(serverError('RAG 索引服务异常，请稍后重试'), requestId, startTime);
  }
}

// ==================== 索引题目 ====================

async function indexQuestions(userId: string, data: any, requestId: string) {
  const { bankId } = data || {};

  if (!bankId || typeof bankId !== 'string') {
    return badRequest('缺少 bankId 参数');
  }

  logger.info(`[${requestId}] 开始索引题库: bankId=${bankId}`);

  // 读取题目
  const questionsResult = await db.collection('questions').where({ bank_id: bankId }).limit(MAX_QUESTIONS).get();

  const questions = questionsResult.data || [];

  if (questions.length === 0) {
    return badRequest(`题库 ${bankId} 中未找到题目`);
  }

  logger.info(`[${requestId}] 找到 ${questions.length} 道题目，开始分块`);

  // 删除该题库已有的向量数据（重新索引）
  try {
    await db
      .collection('document_chunks')
      .where({ user_id: userId, source_type: 'question', source_id: bankId })
      .remove({ multi: true });
    logger.info(`[${requestId}] 已清理旧索引数据`);
  } catch (e) {
    logger.warn(`[${requestId}] 清理旧索引数据失败（可能不存在）:`, e);
  }

  // 分块
  const allChunks: Array<{ text: string; questionId: string; chunkIndex: number; metadata: Record<string, any> }> = [];

  for (const q of questions) {
    const content = buildQuestionText(q);
    const chunks = chunkText(content, CHUNK_SIZE, CHUNK_OVERLAP);

    for (let i = 0; i < chunks.length; i++) {
      allChunks.push({
        text: chunks[i],
        questionId: q._id,
        chunkIndex: i,
        metadata: {
          question_id: q._id,
          bank_id: bankId,
          category: q.category || '',
          sub_category: q.sub_category || '',
          type: q.type || '',
          difficulty: q.difficulty || '',
          total_chunks: chunks.length
        }
      });
    }
  }

  logger.info(`[${requestId}] 共生成 ${allChunks.length} 个分块，开始生成嵌入向量`);

  // 批量生成嵌入并写入
  const totalIndexed = await batchEmbedAndStore(
    allChunks.map((c) => c.text),
    allChunks.map((c) => ({
      user_id: userId,
      source_type: 'question' as const,
      source_id: bankId,
      chunk_index: c.chunkIndex,
      metadata: c.metadata
    })),
    requestId
  );

  logger.info(`[${requestId}] 题库索引完成: ${totalIndexed} 个分块已写入`);

  return success(
    {
      indexed: totalIndexed,
      questions: questions.length,
      chunks: allChunks.length,
      bankId
    },
    `成功索引 ${questions.length} 道题目（${totalIndexed} 个分块）`
  );
}

// ==================== 索引资料 ====================

async function indexMaterial(userId: string, data: any, requestId: string) {
  const { text, title, materialId } = data || {};

  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return badRequest('缺少 text 参数');
  }

  if (text.length > MAX_TEXT_LENGTH) {
    return badRequest(`文本过长，最大支持 ${MAX_TEXT_LENGTH} 个字符`);
  }

  const safeTitle = typeof title === 'string' ? title.slice(0, 200) : '未命名资料';
  const sourceId = materialId || `material_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

  logger.info(`[${requestId}] 开始索引资料: title=${safeTitle}, length=${text.length}`);

  // 删除同一资料的旧索引
  if (materialId) {
    try {
      await db
        .collection('document_chunks')
        .where({ user_id: userId, source_type: 'material', source_id: materialId })
        .remove({ multi: true });
      logger.info(`[${requestId}] 已清理旧资料索引`);
    } catch (e) {
      logger.warn(`[${requestId}] 清理旧资料索引失败:`, e);
    }
  }

  // 分块
  const chunks = chunkText(text.trim(), CHUNK_SIZE, CHUNK_OVERLAP);

  logger.info(`[${requestId}] 共生成 ${chunks.length} 个分块，开始生成嵌入向量`);

  const totalIndexed = await batchEmbedAndStore(
    chunks,
    chunks.map((_, i) => ({
      user_id: userId,
      source_type: 'material' as const,
      source_id: sourceId,
      chunk_index: i,
      metadata: {
        title: safeTitle,
        material_id: sourceId,
        total_chunks: chunks.length
      }
    })),
    requestId
  );

  logger.info(`[${requestId}] 资料索引完成: ${totalIndexed} 个分块已写入`);

  return success(
    {
      indexed: totalIndexed,
      chunks: chunks.length,
      sourceId,
      title: safeTitle
    },
    `成功索引资料「${safeTitle}」（${totalIndexed} 个分块）`
  );
}

// ==================== 工具函数 ====================

/**
 * 构建题目的文本内容（用于嵌入）
 */
function buildQuestionText(question: any): string {
  const parts: string[] = [];

  if (question.question) parts.push(`题目：${question.question}`);
  if (question.type) parts.push(`类型：${question.type}`);
  if (question.options && Array.isArray(question.options)) {
    parts.push(`选项：${question.options.join(' | ')}`);
  }
  if (question.answer) parts.push(`答案：${question.answer}`);
  if (question.correct_answer) parts.push(`正确答案：${question.correct_answer}`);
  if (question.analysis) parts.push(`解析：${question.analysis}`);
  if (question.tags && Array.isArray(question.tags)) {
    parts.push(`标签：${question.tags.join('、')}`);
  }

  return parts.join('\n');
}

/**
 * 批量生成嵌入向量并写入数据库
 */
async function batchEmbedAndStore(
  texts: string[],
  chunkMetas: Array<{
    user_id: string;
    source_type: 'question' | 'material';
    source_id: string;
    chunk_index: number;
    metadata: Record<string, any>;
  }>,
  requestId: string
): Promise<number> {
  let totalStored = 0;

  for (let i = 0; i < texts.length; i += EMBEDDING_BATCH_SIZE) {
    const batchTexts = texts.slice(i, i + EMBEDDING_BATCH_SIZE);
    const batchMetas = chunkMetas.slice(i, i + EMBEDDING_BATCH_SIZE);

    try {
      // 生成嵌入向量
      const embeddings = await getBatchEmbeddings(batchTexts);

      // 构建文档
      const docs: ChunkDocument[] = batchTexts.map((text, idx) => ({
        user_id: batchMetas[idx].user_id,
        source_type: batchMetas[idx].source_type,
        source_id: batchMetas[idx].source_id,
        chunk_index: batchMetas[idx].chunk_index,
        text,
        embedding: embeddings[idx],
        metadata: batchMetas[idx].metadata,
        created_at: Date.now()
      }));

      // 分片写入数据库
      for (let j = 0; j < docs.length; j += DB_BATCH_SIZE) {
        const dbBatch = docs.slice(j, j + DB_BATCH_SIZE);
        await db.collection('document_chunks').add(dbBatch);
        totalStored += dbBatch.length;
      }

      logger.info(`[${requestId}] 已处理 ${Math.min(i + EMBEDDING_BATCH_SIZE, texts.length)}/${texts.length} 个分块`);
    } catch (error: any) {
      logger.error(`[${requestId}] 批次 ${i}-${i + EMBEDDING_BATCH_SIZE} 嵌入失败:`, error?.message);
      // 继续处理下一批，不中断整个流程
    }

    // 批次间延迟，避免速率限制
    if (i + EMBEDDING_BATCH_SIZE < texts.length) {
      await sleep(BATCH_DELAY_MS);
    }
  }

  return totalStored;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
