/**
 * AI出题官Agent — 负责出题、批改、反馈
 * 搬运自 OpenMAIC app/api/quiz-grade/ 的批改逻辑，适配考研场景
 */

import { AgentConfig, AgentRole } from '../agents/agent-types';
import { getProvider, getModelForRole, ChatMessage, CompletionOptions } from '../ai-providers/provider-factory';

export const EXAMINER_CONFIG: AgentConfig = {
  role: 'examiner' as AgentRole,
  name: '出题官',
  avatar: '/static/avatars/examiner.png',
  model: getModelForRole('examiner'),
  temperature: 0.3, // 出题和批改需要更确定性的输出
  maxTokens: 4096,
  systemPrompt: ''
};

export function buildExaminerSystemPrompt(subject: string, topic: string): string {
  return `你是一位严谨的考研命题专家和阅卷老师。你负责根据教学内容出题和批改。

当前科目：${subject}
当前主题：${topic}

出题规则：
1. 题目必须紧扣当前教学内容和考研大纲
2. 难度分布：简单30%、中等50%、困难20%
3. 题型包括：单选题、多选题、简答题
4. 每道题必须有详细解析和关联知识点
5. 参考历年考研真题的出题风格

批改规则：
1. 客观题严格按标准答案判分
2. 主观题从要点覆盖、逻辑性、表述准确性三个维度评分
3. 给出具体的得分和扣分原因
4. 提供个性化的改进建议
5. 关联相关知识点，帮助学生查漏补缺

输出格式（出题）：
\`\`\`json
{
  "action": "give_quiz",
  "quiz": {
    "questions": [
      {
        "id": "q1",
        "type": "single|multiple|short_answer",
        "stem": "题目内容",
        "options": ["A. ...", "B. ...", "C. ...", "D. ..."],
        "correctAnswer": "A",
        "explanation": "解析内容",
        "difficulty": "easy|medium|hard",
        "knowledgePoint": "关联知识点"
      }
    ]
  }
}
\`\`\`

输出格式（批改）：
\`\`\`json
{
  "action": "grade_answer",
  "result": {
    "isCorrect": true/false,
    "score": 85,
    "feedback": "批改反馈",
    "suggestions": ["建议1", "建议2"],
    "relatedKnowledge": ["知识点1", "知识点2"]
  }
}
\`\`\``;
}

// 生成测验题目
export async function generateQuiz(
  subject: string,
  topic: string,
  context: string,
  questionCount: number = 5,
  options?: Partial<CompletionOptions>
) {
  const provider = getProvider();
  const systemPrompt = buildExaminerSystemPrompt(subject, topic);

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    {
      role: 'user',
      content: `根据以下教学内容，出 ${questionCount} 道测验题：\n\n${context}\n\n请严格按照 JSON 格式输出。`
    }
  ];

  return provider.chat(messages, {
    model: getModelForRole('examiner'),
    temperature: 0.3,
    maxTokens: 4096,
    ...options
  });
}

// AI批改答案
export async function gradeAnswer(
  subject: string,
  topic: string,
  question: string,
  correctAnswer: string,
  userAnswer: string,
  options?: Partial<CompletionOptions>
) {
  const provider = getProvider();
  const systemPrompt = buildExaminerSystemPrompt(subject, topic);

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    {
      role: 'user',
      content: `请批改以下答案：

题目：${question}
标准答案：${correctAnswer}
学生答案：${userAnswer}

请严格按照批改 JSON 格式输出。`
    }
  ];

  return provider.chat(messages, {
    model: getModelForRole('examiner'),
    temperature: 0.2,
    maxTokens: 2048,
    ...options
  });
}
