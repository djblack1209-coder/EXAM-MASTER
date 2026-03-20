/**
 * 课程生成管线 — 共享模块
 * 搬运自 OpenMAIC lib/generation/ 的两阶段生成管线
 *
 * 阶段1：大纲生成（outline-generator）
 * 阶段2：场景内容生成（scene-generator）
 */

import { OutlineItem, Scene, SceneType, SlideContent, QuizContent, DiscussionContent } from '../agents/agent-types';
import { getProvider, ChatMessage } from '../ai-providers/provider-factory';

// ==================== 阶段1：大纲生成 ====================

export async function generateOutline(
  topic: string,
  subject: string,
  materials?: string,
  sceneCount: number = 6
): Promise<OutlineItem[]> {
  const provider = getProvider();

  const prompt = materials
    ? `根据以下学习资料，为考研科目「${subject}」的主题「${topic}」生成一个 ${sceneCount} 个章节的课程大纲。

学习资料：
${materials.substring(0, 8000)}

`
    : `为考研科目「${subject}」的主题「${topic}」生成一个 ${sceneCount} 个章节的课程大纲。
`;

  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: `你是一位考研课程设计专家。你需要生成结构化的课程大纲。

大纲要求：
1. 由浅入深，循序渐进
2. 每个章节明确标注场景类型：slide（讲解）、quiz（测验）、discussion（讨论）
3. 建议分布：60% slide + 25% quiz + 15% discussion
4. 每个章节预估学习时间（分钟）
5. 紧扣考研大纲和高频考点

严格按以下 JSON 格式输出，不要输出其他内容：
[
  {
    "id": "outline_1",
    "title": "章节标题",
    "description": "章节描述（2-3句话）",
    "sceneType": "slide|quiz|discussion",
    "estimatedMinutes": 5,
    "order": 1
  }
]`
    },
    { role: 'user', content: prompt }
  ];

  const result = await provider.chat(messages, {
    temperature: 0.5,
    maxTokens: 4096
  });

  return parseJsonFromResponse<OutlineItem[]>(result.content, []);
}

// ==================== 阶段2：场景内容生成 ====================

export async function generateScene(
  outlineItem: OutlineItem,
  subject: string,
  topic: string,
  previousContext?: string
): Promise<Scene> {
  switch (outlineItem.sceneType) {
    case 'slide':
      return generateSlideScene(outlineItem, subject, topic, previousContext);
    case 'quiz':
      return generateQuizScene(outlineItem, subject, topic, previousContext);
    case 'discussion':
      return generateDiscussionScene(outlineItem, subject, topic, previousContext);
    default:
      return generateSlideScene(outlineItem, subject, topic, previousContext);
  }
}

async function generateSlideScene(
  item: OutlineItem,
  subject: string,
  _topic: string,
  previousContext?: string
): Promise<Scene> {
  const provider = getProvider();

  const contextHint = previousContext ? `\n前面已讲内容摘要：${previousContext.substring(0, 2000)}` : '';

  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: `你是考研课程内容生成专家。为「${subject}」科目生成讲解幻灯片内容。${contextHint}

要求：
1. 生成 3-5 张幻灯片
2. 每张幻灯片有标题、正文、老师讲解稿、重点标注
3. 内容紧扣考研大纲，突出高频考点
4. 讲解稿要口语化，像真实老师在课堂上讲课

严格按以下 JSON 格式输出：
{
  "slides": [
    {
      "title": "幻灯片标题",
      "body": "正文内容（支持 Markdown）",
      "notes": "老师讲解稿（口语化）",
      "keyPoints": ["重点1", "重点2"]
    }
  ]
}`
    },
    { role: 'user', content: `请为章节「${item.title}」生成讲解内容。\n章节描述：${item.description}` }
  ];

  const result = await provider.chat(messages, { temperature: 0.6, maxTokens: 4096 });
  const content = parseJsonFromResponse<SlideContent>(result.content, { slides: [] });

  return {
    id: `scene_${item.id}`,
    type: 'slide' as SceneType,
    title: item.title,
    content,
    agents: [],
    order: item.order
  };
}

async function generateQuizScene(
  item: OutlineItem,
  subject: string,
  _topic: string,
  previousContext?: string
): Promise<Scene> {
  const provider = getProvider();

  const contextHint = previousContext ? `\n前面已讲内容摘要：${previousContext.substring(0, 2000)}` : '';

  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: `你是考研命题专家。为「${subject}」科目生成测验题目。${contextHint}

要求：
1. 生成 3-5 道题目
2. 题型分布：单选2道、多选1道、简答1-2道
3. 难度分布：简单1道、中等2道、困难1-2道
4. 每道题必须有详细解析和关联知识点
5. 参考历年考研真题风格

严格按以下 JSON 格式输出：
{
  "questions": [
    {
      "id": "q1",
      "type": "single|multiple|short_answer",
      "stem": "题目内容",
      "options": ["A. ...", "B. ...", "C. ...", "D. ..."],
      "correctAnswer": "A",
      "explanation": "详细解析",
      "difficulty": "easy|medium|hard",
      "knowledgePoint": "关联知识点"
    }
  ]
}`
    },
    { role: 'user', content: `请为章节「${item.title}」生成测验题目。\n章节描述：${item.description}` }
  ];

  const result = await provider.chat(messages, { temperature: 0.3, maxTokens: 4096 });
  const content = parseJsonFromResponse<QuizContent>(result.content, { questions: [] });

  return {
    id: `scene_${item.id}`,
    type: 'quiz' as SceneType,
    title: item.title,
    content,
    agents: [],
    order: item.order
  };
}

async function generateDiscussionScene(
  item: OutlineItem,
  subject: string,
  _topic: string,
  previousContext?: string
): Promise<Scene> {
  const provider = getProvider();

  const contextHint = previousContext ? `\n前面已讲内容摘要：${previousContext.substring(0, 2000)}` : '';

  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: `你是考研教学设计专家。为「${subject}」科目设计讨论环节。${contextHint}

要求：
1. 设计一个有深度的讨论话题
2. 提供 3-5 个引导问题
3. 列出讨论应覆盖的要点
4. 为 AI 同学设计不同的讨论立场和性格

严格按以下 JSON 格式输出：
{
  "topic": "讨论话题",
  "guideQuestions": ["引导问题1", "引导问题2"],
  "expectedPoints": ["要点1", "要点2"],
  "agentPersonas": [
    {
      "role": "student",
      "stance": "讨论立场",
      "personality": "性格特点"
    }
  ]
}`
    },
    { role: 'user', content: `请为章节「${item.title}」设计讨论环节。\n章节描述：${item.description}` }
  ];

  const result = await provider.chat(messages, { temperature: 0.7, maxTokens: 2048 });
  const content = parseJsonFromResponse<DiscussionContent>(result.content, {
    topic: item.title,
    guideQuestions: [],
    expectedPoints: [],
    agentPersonas: []
  });

  return {
    id: `scene_${item.id}`,
    type: 'discussion' as SceneType,
    title: item.title,
    content,
    agents: [],
    order: item.order
  };
}

// ==================== 工具函数 ====================

function parseJsonFromResponse<T>(content: string, fallback: T): T {
  try {
    // 尝试提取 JSON 块
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    const jsonStr = jsonMatch ? jsonMatch[1].trim() : content.trim();
    return JSON.parse(jsonStr) as T;
  } catch {
    // 尝试直接解析（可能没有代码块包裹）
    try {
      const start = content.indexOf('[') !== -1 ? content.indexOf('[') : content.indexOf('{');
      const end = content.lastIndexOf(']') !== -1 ? content.lastIndexOf(']') + 1 : content.lastIndexOf('}') + 1;
      if (start >= 0 && end > start) {
        return JSON.parse(content.substring(start, end)) as T;
      }
    } catch {
      // ignore
    }
    return fallback;
  }
}
