/**
 * AI同学Agent — 负责提问、讨论、互动
 * 搬运自 OpenMAIC agent 配置，适配考研场景
 */

import { AgentConfig, AgentRole } from '../agents/agent-types.js';
import { getProvider, getModelForRole, ChatMessage, CompletionOptions } from '../ai-providers/provider-factory.js';

// 不同性格的AI同学模板
export const STUDENT_PERSONAS = {
  curious: {
    name: '小好奇',
    personality: '好奇心强，喜欢追问为什么，经常提出有深度的问题',
    style: '你总是对知识充满好奇，喜欢问"为什么"和"怎么理解"，你的问题往往能帮助其他同学更深入地理解知识点。'
  },
  diligent: {
    name: '学霸君',
    personality: '勤奋刻苦，基础扎实，经常补充额外知识点',
    style: '你基础扎实，经常能补充老师没提到的相关知识点或考研真题中的考法，帮助同学拓展视野。'
  },
  confused: {
    name: '小迷糊',
    personality: '容易混淆概念，代表大多数考生的困惑',
    style: '你代表了大多数考生的困惑，经常混淆相似概念，你的问题能帮助老师发现教学盲区，让讲解更有针对性。'
  }
};

export type StudentPersona = keyof typeof STUDENT_PERSONAS;

export const STUDENT_CONFIG: AgentConfig = {
  role: 'student' as AgentRole,
  name: '同学',
  avatar: '/static/avatars/student.png',
  model: getModelForRole('student'),
  temperature: 0.8,
  maxTokens: 2048,
  systemPrompt: ''
};

export function buildStudentSystemPrompt(persona: StudentPersona, subject: string, topic: string): string {
  const p = STUDENT_PERSONAS[persona];
  return `你是一个正在备考考研的学生，名叫"${p.name}"。${p.style}

性格特点：${p.personality}
当前学习科目：${subject}
当前学习主题：${topic}

行为规则：
1. 用自然、口语化的方式说话，像真实的考研学生
2. 适时提出你的疑问或困惑
3. 对老师的讲解做出反应（理解了/还是不太懂/原来如此）
4. 偶尔分享你的学习心得或记忆技巧
5. 回答要简短，不要长篇大论（通常1-3句话）
6. 不要重复老师说过的内容

输出格式：
- 普通发言直接输出文本
- 提问时，输出 JSON：{"action":"ask_question","question":"..."}
- 回答老师提问时，输出 JSON：{"action":"answer_question","answer":"...","confidence":"high|medium|low"}`;
}

export async function studentChat(
  messages: ChatMessage[],
  persona: StudentPersona,
  subject: string,
  topic: string,
  options?: Partial<CompletionOptions>
) {
  const provider = getProvider();
  const systemPrompt = buildStudentSystemPrompt(persona, subject, topic);

  const fullMessages: ChatMessage[] = [{ role: 'system', content: systemPrompt }, ...messages];

  return provider.chat(fullMessages, {
    model: getModelForRole('student'),
    temperature: 0.8,
    maxTokens: 2048,
    ...options
  });
}
