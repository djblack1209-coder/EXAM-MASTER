/**
 * AI老师Agent — 负责讲解、答疑、总结
 * 搬运自 OpenMAIC agent 配置，适配考研场景
 */

import { AgentConfig, AgentRole } from '../agents/agent-types.js';
import { getProvider, getModelForRole, ChatMessage, CompletionOptions } from '../ai-providers/provider-factory.js';

// 考研科目专业 prompt 模板
const SUBJECT_PROMPTS: Record<string, string> = {
  politics:
    '你精通考研政治，包括马克思主义基本原理、毛泽东思想和中国特色社会主义理论体系、中国近现代史纲要、思想道德修养与法律基础、形势与政策。善于用通俗易懂的方式讲解抽象理论，帮助学生建立知识框架。',
  english:
    '你精通考研英语，包括阅读理解、完形填空、翻译和写作。善于分析长难句结构，讲解词汇用法，传授解题技巧和写作模板。',
  math: '你精通考研数学，包括高等数学、线性代数和概率论与数理统计。善于用直观的方式讲解抽象概念，推导公式，分析典型例题的解题思路。',
  professional: '你精通该专业课的核心理论和应用，善于结合实际案例讲解概念，帮助学生理解和记忆。'
};

export const TEACHER_CONFIG: AgentConfig = {
  role: 'teacher' as AgentRole,
  name: '考研名师',
  avatar: '/static/avatars/teacher.png',
  model: getModelForRole('teacher'),
  temperature: 0.7,
  maxTokens: 4096,
  systemPrompt: '' // 动态生成
};

export function buildTeacherSystemPrompt(subject: string, topic: string): string {
  const subjectPrompt = SUBJECT_PROMPTS[subject] || SUBJECT_PROMPTS.professional;
  return `你是一位经验丰富的考研辅导老师。${subjectPrompt}

当前教学主题：${topic}

教学风格要求：
1. 讲解清晰有条理，先总后分，由浅入深
2. 重要知识点要强调，用【重点】标记
3. 适时提出问题引导学生思考
4. 对学生的回答给予积极反馈和纠正
5. 每个知识点讲完后做简短总结
6. 使用考研真题作为例子加深理解

输出格式：
- 讲解内容直接输出文本
- 需要出题时，输出 JSON 格式：{"action":"give_quiz","quiz":{...}}
- 需要总结时，输出 JSON 格式：{"action":"summarize","summary":"..."}
- 需要过渡时，输出 JSON 格式：{"action":"transition","next":"..."}`;
}

export async function teacherChat(
  messages: ChatMessage[],
  subject: string,
  topic: string,
  options?: Partial<CompletionOptions>
) {
  const provider = getProvider();
  const systemPrompt = buildTeacherSystemPrompt(subject, topic);

  const fullMessages: ChatMessage[] = [{ role: 'system', content: systemPrompt }, ...messages];

  return provider.chat(fullMessages, {
    model: getModelForRole('teacher'),
    temperature: 0.7,
    maxTokens: 4096,
    ...options
  });
}
