/**
 * RAG 检索器 — 从用户上传的学习资料中检索相关内容
 * 支持 Atlas $vectorSearch 和内存暴力搜索两种模式，自动降级
 *
 * @version 1.0.0
 */

import cloud from '@lafjs/cloud';
import { getEmbedding, cosineSimilarity } from './embedding';
import { createLogger } from './api-response';

const logger = createLogger('[RAG]');

/**
 * 检索 RAG 上下文 — 根据用户查询从知识库中召回最相关的文档片段
 * @param userId - 用户 ID，用于过滤该用户的文档
 * @param query - 用户的查询文本
 * @param topK - 返回的最相关片段数量，默认 3
 * @returns 格式化后的参考资料字符串，无结果时返回空字符串
 */
export async function retrieveRAGContext(userId: string, query: string, topK = 3): Promise<string> {
  try {
    const db = cloud.database();
    const queryEmbedding = await getEmbedding(query);
    let scored: Array<{ text: string; source: string; score: number }> = [];

    // 优先尝试 Atlas $vectorSearch（性能更好）
    try {
      const pipeline = [
        {
          $vectorSearch: {
            index: 'vector_index',
            path: 'embedding',
            queryVector: queryEmbedding,
            numCandidates: topK * 10,
            limit: topK,
            filter: { user_id: userId }
          }
        },
        {
          $addFields: { score: { $meta: 'vectorSearchScore' } }
        },
        {
          $project: { _id: 0, text: 1, score: 1, source_type: 1, metadata: 1 }
        }
      ];
      const result = await db.collection('document_chunks').aggregate(pipeline).end();
      const docs = result.data || [];
      scored = docs
        .filter((doc: any) => doc.score >= 0.35)
        .map((doc: any) => ({
          text: doc.text,
          source: doc.metadata?.title || doc.source_type || '',
          score: doc.score
        }));
    } catch (_atlasErr) {
      // Atlas $vectorSearch 不可用，降级为内存暴力搜索
      const chunks = await db.collection('document_chunks').where({ user_id: userId }).limit(500).get();

      if (!chunks.data || chunks.data.length === 0) return '';

      scored = chunks.data
        .filter((c: any) => c.embedding && c.embedding.length > 0)
        .map((chunk: any) => ({
          text: chunk.text,
          source: chunk.metadata?.title || chunk.source_type || '',
          score: cosineSimilarity(queryEmbedding, chunk.embedding)
        }))
        .filter((item: any) => item.score > 0.35)
        .sort((a: any, b: any) => b.score - a.score)
        .slice(0, topK);
    }

    if (scored.length === 0) return '';

    // 格式化参考资料输出
    const context = scored
      .map((s, i) => `[参考${i + 1}] (来源:${s.source || '学习资料'}, 相关度:${(s.score * 100).toFixed(0)}%) ${s.text}`)
      .join('\n\n');

    return `\n\n===== 以下是来自用户学习资料的相关参考内容 =====\n${context}\n===== 参考内容结束 =====\n\n请优先基于以上参考资料回答问题。如果参考资料中没有相关内容，再使用你的通用知识回答，并注明这不是来自用户的资料。`;
  } catch (err: any) {
    logger.warn('[RAG] 检索失败，降级为无增强模式:', err.message);
    return '';
  }
}
