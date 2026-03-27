/**
 * RAG 语义检索云函数
 *
 * 接收用户查询，生成查询向量，从 document_chunks 集合中检索
 * 语义最相关的文档分块，返回 Top-K 结果。
 *
 * 检索策略：
 *   1. 优先使用 MongoDB Atlas $vectorSearch（需要配置向量索引）
 *   2. 降级方案：拉取用户分块后在内存中计算余弦相似度（适用于小数据集）
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
  wrapResponse
} from './_shared/api-response.js';
import { getEmbedding, cosineSimilarity } from './_shared/embedding.js';

const db = cloud.database();
const logger = createLogger('[RAGQuery]');

// ==================== 常量 ====================

/** 默认返回条数 */
const DEFAULT_TOP_K = 5;

/** 最大返回条数 */
const MAX_TOP_K = 20;

/** 内存检索最大分块数（超过此数量将截断） */
const MAX_IN_MEMORY_CHUNKS = 5000;

/** 相似度最低阈值（低于此值不返回） */
const MIN_SIMILARITY_THRESHOLD = 0.3;

// ==================== 类型定义 ====================

interface QueryFilters {
  category?: string;
  source_type?: 'question' | 'material';
}

interface RetrievalResult {
  text: string;
  score: number;
  source_type: string;
  source_id: string;
  chunk_index: number;
  metadata: Record<string, any>;
}

// ==================== 主函数 ====================

export default async function (ctx) {
  const startTime = Date.now();
  const requestId = generateRequestId('rag_query');

  try {
    // ---- 认证 ----
    const authResult = requireAuth(ctx);
    if (isAuthError(authResult)) {
      return wrapResponse(unauthorized('请先登录'), requestId, startTime);
    }
    const { userId } = authResult;

    const { query, topK, filters } = ctx.body || {};

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return wrapResponse(badRequest('缺少 query 参数'), requestId, startTime);
    }

    if (query.length > 2000) {
      return wrapResponse(badRequest('query 长度不能超过 2000 个字符'), requestId, startTime);
    }

    const safeTopK = Math.max(
      1,
      Math.min(typeof topK === 'number' && Number.isFinite(topK) ? Math.floor(topK) : DEFAULT_TOP_K, MAX_TOP_K)
    );
    const safeFilters: QueryFilters = {};
    if (filters && typeof filters === 'object') {
      if (typeof filters.category === 'string') safeFilters.category = filters.category;
      if (filters.source_type === 'question' || filters.source_type === 'material') {
        safeFilters.source_type = filters.source_type;
      }
    }

    logger.info(`[${requestId}] 用户 ${userId} 发起 RAG 查询: query="${query.slice(0, 50)}...", topK=${safeTopK}`);

    // 生成查询向量
    let queryEmbedding: number[];
    try {
      queryEmbedding = await getEmbedding(query.trim());
    } catch (error: any) {
      logger.error(`[${requestId}] 查询向量生成失败:`, error?.message);
      return wrapResponse(serverError('查询向量生成失败，请稍后重试', error?.message), requestId, startTime);
    }

    // 尝试 Atlas $vectorSearch，失败则降级到内存检索
    let results: RetrievalResult[];
    try {
      results = await vectorSearchAtlas(userId, queryEmbedding, safeTopK, safeFilters, requestId);
    } catch (atlasError: any) {
      logger.warn(`[${requestId}] Atlas $vectorSearch 不可用，降级到内存检索:`, atlasError?.message);
      results = await inMemorySearch(userId, queryEmbedding, safeTopK, safeFilters, requestId);
    }

    logger.info(`[${requestId}] 检索完成: 返回 ${results.length} 条结果`);

    return wrapResponse(
      success(
        {
          results,
          query: query.trim(),
          topK: safeTopK,
          total: results.length,
          strategy: results.length > 0 ? 'vector_search' : 'no_results'
        },
        `检索到 ${results.length} 条相关内容`
      ),
      requestId,
      startTime
    );
  } catch (error: any) {
    logger.error(`[${requestId}] RAG 查询异常:`, error);
    return wrapResponse(serverError('RAG 检索服务异常，请稍后重试', error?.message), requestId, startTime);
  }
}

// ==================== Atlas $vectorSearch ====================

async function vectorSearchAtlas(
  userId: string,
  queryEmbedding: number[],
  topK: number,
  filters: QueryFilters,
  _requestId: string
): Promise<RetrievalResult[]> {
  const collection = db.collection('document_chunks');

  // 构建 $vectorSearch filter
  const filter: Record<string, any> = { user_id: userId };
  if (filters.source_type) filter.source_type = filters.source_type;
  if (filters.category) filter['metadata.category'] = filters.category;

  // MongoDB Atlas Vector Search 聚合管道
  const pipeline = [
    {
      $vectorSearch: {
        index: 'vector_index',
        path: 'embedding',
        queryVector: queryEmbedding,
        numCandidates: topK * 10,
        limit: topK,
        filter
      }
    },
    {
      $addFields: {
        score: { $meta: 'vectorSearchScore' }
      }
    },
    {
      $project: {
        _id: 0,
        text: 1,
        score: 1,
        source_type: 1,
        source_id: 1,
        chunk_index: 1,
        metadata: 1
      }
    }
  ];

  const result = await collection.aggregate(pipeline).end();
  const docs = result.data || [];

  return docs
    .filter((doc: any) => doc.score >= MIN_SIMILARITY_THRESHOLD)
    .map((doc: any) => ({
      text: doc.text,
      score: Math.round(doc.score * 10000) / 10000,
      source_type: doc.source_type,
      source_id: doc.source_id,
      chunk_index: doc.chunk_index,
      metadata: doc.metadata || {}
    }));
}

// ==================== 内存检索（降级方案） ====================

async function inMemorySearch(
  userId: string,
  queryEmbedding: number[],
  topK: number,
  filters: QueryFilters,
  requestId: string
): Promise<RetrievalResult[]> {
  // 构建查询条件
  const query: Record<string, any> = { user_id: userId };
  if (filters.source_type) query.source_type = filters.source_type;
  if (filters.category) query['metadata.category'] = filters.category;

  // 分批拉取用户的所有分块（Laf 单次 limit 最大 1000）
  const allChunks: any[] = [];
  let skip = 0;
  const batchSize = 1000;

  while (allChunks.length < MAX_IN_MEMORY_CHUNKS) {
    const batch = await db.collection('document_chunks').where(query).skip(skip).limit(batchSize).get();

    const docs = batch.data || [];
    if (docs.length === 0) break;

    allChunks.push(...docs);
    skip += batchSize;

    if (docs.length < batchSize) break;
  }

  logger.info(`[${requestId}] 内存检索: 加载 ${allChunks.length} 个分块`);

  if (allChunks.length === 0) {
    return [];
  }

  // 计算余弦相似度并排序
  const scored = allChunks
    .map((chunk) => ({
      text: chunk.text,
      score: cosineSimilarity(queryEmbedding, chunk.embedding),
      source_type: chunk.source_type,
      source_id: chunk.source_id,
      chunk_index: chunk.chunk_index,
      metadata: chunk.metadata || {}
    }))
    .filter((item) => item.score >= MIN_SIMILARITY_THRESHOLD)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  // 保留 4 位小数
  return scored.map((item) => ({
    ...item,
    score: Math.round(item.score * 10000) / 10000
  }));
}
