/**
 * 多Agent类型定义
 * 搬运自 OpenMAIC lib/types/ 并适配考研场景
 */

// Agent 角色类型
export type AgentRole = 'teacher' | 'student' | 'examiner';

// Agent 配置
export interface AgentConfig {
  role: AgentRole;
  name: string;
  avatar: string;
  model: string;
  systemPrompt: string;
  temperature: number;
  maxTokens: number;
}

// Agent 消息
export interface AgentMessage {
  id: string;
  role: AgentRole;
  agentName: string;
  content: string;
  type: 'text' | 'quiz' | 'whiteboard' | 'slide' | 'action';
  timestamp: number;
  metadata?: Record<string, unknown>;
}

// 课堂状态（搬运自 OpenMAIC lib/orchestration/ 的状态机设计）
export interface ClassroomState {
  sessionId: string;
  lessonId: string;
  currentSceneIndex: number;
  phase: ClassroomPhase;
  agents: AgentConfig[];
  messages: AgentMessage[];
  turnCount: number;
  maxTurns: number;
  userInput?: string;
  pendingActions: AgentAction[];
}

export type ClassroomPhase =
  | 'idle' // 等待开始
  | 'lecturing' // 老师讲课
  | 'discussing' // 讨论环节
  | 'quizzing' // 测验环节
  | 'reviewing' // 复习回顾
  | 'waiting_input' // 等待用户输入
  | 'completed'; // 课程结束

// Agent 动作（搬运自 OpenMAIC lib/action/ 的28+动作类型，精简为考研场景需要的）
export interface AgentAction {
  type: ActionType;
  agentRole: AgentRole;
  payload: Record<string, unknown>;
}

export type ActionType =
  | 'speak' // 发言
  | 'ask_question' // 提问
  | 'answer_question' // 回答
  | 'present_slide' // 展示幻灯片
  | 'draw_whiteboard' // 白板绘图
  | 'give_quiz' // 出题
  | 'grade_answer' // 批改
  | 'summarize' // 总结
  | 'encourage' // 鼓励
  | 'transition'; // 过渡到下一环节

// 导演图决策（搬运自 OpenMAIC lib/orchestration/director-graph）
export interface DirectorDecision {
  nextAgent: AgentRole;
  action: ActionType;
  reason: string;
}

// 课程大纲项
export interface OutlineItem {
  id: string;
  title: string;
  description: string;
  sceneType: SceneType;
  estimatedMinutes: number;
  order: number;
}

// 场景类型（搬运自 OpenMAIC，去掉 PBL 和 interactive 暂不需要的）
export type SceneType = 'slide' | 'quiz' | 'discussion';

// 场景数据
export interface Scene {
  id: string;
  type: SceneType;
  title: string;
  content: SlideContent | QuizContent | DiscussionContent;
  agents: AgentConfig[];
  order: number;
}

// 幻灯片内容
export interface SlideContent {
  slides: Array<{
    title: string;
    body: string;
    notes: string; // 老师讲解稿
    keyPoints: string[]; // 重点标注
  }>;
}

// 测验内容
export interface QuizContent {
  questions: Array<{
    id: string;
    type: 'single' | 'multiple' | 'short_answer';
    stem: string;
    options?: string[];
    correctAnswer: string | string[];
    explanation: string;
    difficulty: 'easy' | 'medium' | 'hard';
    knowledgePoint: string;
  }>;
}

// 讨论内容
export interface DiscussionContent {
  topic: string;
  guideQuestions: string[];
  expectedPoints: string[];
  agentPersonas: Array<{
    role: AgentRole;
    stance: string; // 讨论立场
    personality: string; // 性格特点
  }>;
}

// 课程数据（MongoDB lessons 集合）
export interface Lesson {
  _id?: string;
  userId: string;
  title: string;
  topic: string;
  subject: string; // 考研科目
  outline: OutlineItem[];
  scenes: Scene[];
  status: 'generating' | 'ready' | 'failed';
  progress: number;
  error?: string;
  created_at: number;
  updated_at: number;
}

// 课堂会话（MongoDB classroom_sessions 集合）
export interface ClassroomSession {
  _id?: string;
  lessonId: string;
  userId: string;
  state: ClassroomState;
  startedAt: number;
  lastActiveAt: number;
  completedAt?: number;
}

// AI批改结果（MongoDB ai_grade_results 集合）
export interface AiGradeResult {
  _id?: string;
  userId: string;
  lessonId?: string;
  sceneId?: string;
  questionId: string;
  userAnswer: string;
  isCorrect: boolean;
  score: number; // 0-100
  feedback: string; // AI个性化反馈
  suggestions: string[]; // 改进建议
  relatedKnowledge: string[]; // 关联知识点
  created_at: number;
}
