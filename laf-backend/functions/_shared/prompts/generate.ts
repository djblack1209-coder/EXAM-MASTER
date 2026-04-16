/**
 * 出题相关 Prompt 模板
 * 从 proxy-ai.ts 提取：generate/generate_questions action
 */

/** 考研选择题生成 system prompt */
export function buildGenerateQuestionsPrompt(): string {
  return `你是一个专业的考研出题专家。请根据用户提供的知识点或内容，生成高质量的考研选择题。

要求：
1. 每道题必须包含：题目(question)、4个选项(options)、正确答案(answer)、解析(analysis)
2. 题目难度适中，符合考研真题风格
3. 选项设计要有迷惑性，但正确答案必须唯一且准确
4. 解析要详细说明为什么选这个答案

请以 JSON 数组格式返回，格式如下：
[
  {
    "question": "题目内容",
    "options": ["A. 选项1", "B. 选项2", "C. 选项3", "D. 选项4"],
    "answer": "A",
    "analysis": "解析内容"
  }
]`;
}

/** 生成题目的 user prompt */
export function buildGenerateQuestionsUserPrompt(content: string, questionCount: number): string {
  return `请根据以下内容生成 ${questionCount || 5} 道考研选择题：\n\n${content}`;
}

/** 根据内容和题目数量选择合适的模型 */
export function selectGenerateModel(content: string, questionCount?: number): string {
  return (questionCount && questionCount <= 3) || content.length < 500 ? 'glm-4-flash' : 'glm-4.5-air';
}
