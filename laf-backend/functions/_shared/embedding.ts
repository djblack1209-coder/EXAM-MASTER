/**
 * 向量嵌入服务 — 调用智谱 embedding-3 模型生成文本向量
 * 用于 RAG 检索增强生成
 *
 * @version 1.0.0
 */

const EMBEDDING_URL = 'https://open.bigmodel.cn/api/paas/v4/embeddings';
const EMBEDDING_MODEL = 'embedding-3';

/**
 * 生成单个文本的嵌入向量
 * @param text - 输入文本（最大 8192 tokens）
 * @returns number[] - 2048维向量
 */
export async function getEmbedding(text: string): Promise<number[]> {
  const apiKey = process.env.AI_PROVIDER_KEY_PLACEHOLDER
  if (!apiKey) throw new Error('AI_PROVIDER_KEY_PLACEHOLDER

  // 截断过长文本
  const truncated = text.slice(0, 6000);

  const response = await fetch(EMBEDDING_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: truncated
    })
  });

  if (!response.ok) {
    throw new Error(`Embedding API error: ${response.status}`);
  }

  const result: any = await response.json();
  return result.data[0].embedding;
}

/**
 * 批量生成嵌入向量
 * @param texts - 文本数组（最多 64 条）
 * @returns number[][] - 向量数组
 */
export async function getBatchEmbeddings(texts: string[]): Promise<number[][]> {
  const apiKey = process.env.AI_PROVIDER_KEY_PLACEHOLDER
  if (!apiKey) throw new Error('AI_PROVIDER_KEY_PLACEHOLDER

  const batch = texts.slice(0, 64).map((t) => t.slice(0, 6000));

  const response = await fetch(EMBEDDING_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: batch
    })
  });

  if (!response.ok) {
    throw new Error(`Embedding API error: ${response.status}`);
  }

  const result: any = await response.json();
  return result.data.map((d: any) => d.embedding);
}

/**
 * 计算余弦相似度
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0,
    normA = 0,
    normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * 文本分块（用于长文档）
 * @param text - 原文
 * @param chunkSize - 每块最大字符数
 * @param overlap - 重叠字符数
 */
export function chunkText(text: string, chunkSize = 500, overlap = 100): string[] {
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    chunks.push(text.slice(start, end));
    start = end - overlap;
    if (start >= text.length) break;
  }
  return chunks;
}
