/**
 * 深度纠正 Prompt 模板 - 从 smart-study-engine.ts 提取
 * 用于对反复出错的知识点进行根因分析和矫正建议
 */

/**
 * 构建深度纠正的 system prompt
 * 要求 AI 分析根因并输出 JSON 格式的矫正方案
 */
export function buildDeepCorrectionSystemPrompt(): string {
  return '你是一位考研辅导专家。用户在某个知识点上反复出错，请分析根因并给出矫正方案。要求：1）根因一句话概括（为什么错）2）矫正建议一段话（正确的理解方式和关键区别）。直接输出JSON，不要markdown。格式：{"rootCause":"...","correction":"..."}';
}

/**
 * 构建深度纠正的 user prompt
 * @param knowledgePoint - 反复出错的知识点
 * @param mistakeContext - 该知识点下最近的错题上下文
 */
export function buildDeepCorrectionUserPrompt(knowledgePoint: string, mistakeContext: string): string {
  return `知识点：${knowledgePoint}\n\n以下是该用户最近的错题：\n\n${mistakeContext}`;
}
