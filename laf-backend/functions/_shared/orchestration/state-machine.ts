/**
 * 多Agent编排状态机
 * 搬运自 OpenMAIC lib/orchestration/ 的 LangGraph 状态机设计
 * 适配为轻量级实现（不依赖 LangGraph 库，用纯状态机模式）
 *
 * 设计思路：
 * OpenMAIC 用 LangGraph 做多Agent编排，但 Laf 云函数是无状态的，
 * 不适合跑长时间的 LangGraph 图。所以我们搬运其「导演图」的设计思路，
 * 用纯状态机 + MongoDB 持久化来实现同样的效果。
 * 每次请求推进一步状态，前端轮询或 SSE 获取最新状态。
 */

import {
  ClassroomState,
  ClassroomPhase,
  AgentMessage,
  AgentRole,
  DirectorDecision,
  Scene
} from '../agents/agent-types';
import { teacherChat } from '../agents/teacher-agent';
import { studentChat, StudentPersona } from '../agents/student-agent';
import { generateQuiz, gradeAnswer } from '../agents/examiner-agent';
import { ChatMessage } from '../ai-providers/provider-factory';

// ==================== 导演图：决定下一步谁说话、做什么 ====================
// 搬运自 OpenMAIC lib/orchestration/director-graph 的轮次控制逻辑

/**
 * 导演决策 — 根据当前状态决定下一个Agent和动作
 * OpenMAIC 用 LangGraph 的条件边实现，这里用规则引擎简化
 */
export function directorDecide(state: ClassroomState): DirectorDecision {
  const { phase, turnCount, messages } = state;
  const lastMsg = messages[messages.length - 1];

  // 等待用户输入时，不自动推进
  if (phase === 'waiting_input') {
    return { nextAgent: 'teacher', action: 'speak', reason: 'waiting for user' };
  }

  // 课程结束
  if (phase === 'completed') {
    return { nextAgent: 'teacher', action: 'summarize', reason: 'lesson completed' };
  }

  // 讲课阶段的轮次控制（搬运 OpenMAIC 的 turn-based 逻辑）
  if (phase === 'lecturing') {
    // 每讲3轮，AI同学插入一个问题
    if (turnCount > 0 && turnCount % 3 === 0 && lastMsg?.role !== 'student') {
      return { nextAgent: 'student', action: 'ask_question', reason: 'periodic student question' };
    }
    // 每讲6轮，进入测验
    if (turnCount > 0 && turnCount % 6 === 0) {
      return { nextAgent: 'examiner', action: 'give_quiz', reason: 'periodic quiz check' };
    }
    // 默认老师继续讲
    return { nextAgent: 'teacher', action: 'speak', reason: 'continue lecture' };
  }

  // 讨论阶段
  if (phase === 'discussing') {
    // 轮流发言：老师 → 同学 → 老师 → 同学...
    if (!lastMsg || lastMsg.role === 'student') {
      return { nextAgent: 'teacher', action: 'speak', reason: 'teacher turn in discussion' };
    }
    if (turnCount < state.maxTurns) {
      return { nextAgent: 'student', action: 'answer_question', reason: 'student turn in discussion' };
    }
    return { nextAgent: 'teacher', action: 'summarize', reason: 'discussion wrap up' };
  }

  // 测验阶段
  if (phase === 'quizzing') {
    if (!lastMsg || lastMsg.type !== 'quiz') {
      return { nextAgent: 'examiner', action: 'give_quiz', reason: 'start quiz' };
    }
    // 等待用户答题
    return { nextAgent: 'examiner', action: 'grade_answer', reason: 'waiting for answer' };
  }

  // 复习阶段
  if (phase === 'reviewing') {
    return { nextAgent: 'teacher', action: 'summarize', reason: 'review summary' };
  }

  // 默认
  return { nextAgent: 'teacher', action: 'speak', reason: 'default' };
}

// ==================== 状态转换 ====================

/**
 * 根据场景类型决定初始阶段
 */
export function getInitialPhase(sceneType: string): ClassroomPhase {
  switch (sceneType) {
    case 'slide':
      return 'lecturing';
    case 'quiz':
      return 'quizzing';
    case 'discussion':
      return 'discussing';
    default:
      return 'lecturing';
  }
}

/**
 * 推进状态机一步
 * 返回新的 Agent 消息和更新后的状态
 */
export async function advanceState(
  state: ClassroomState,
  scene: Scene,
  userInput?: string
): Promise<{ newMessage: AgentMessage; updatedState: ClassroomState }> {
  const subject = (scene as any).subject || '专业课';
  const topic = scene.title;

  // 如果有用户输入，先加入消息历史
  if (userInput) {
    state.messages.push({
      id: `msg_${Date.now()}_user`,
      role: 'teacher' as AgentRole, // 用户消息标记
      agentName: '你',
      content: userInput,
      type: 'text',
      timestamp: Date.now(),
      metadata: { isUser: true }
    });
    // 用户输入后，从等待状态恢复
    if (state.phase === 'waiting_input') {
      state.phase = 'lecturing';
    }
  }

  // 导演决策
  const decision = directorDecide(state);

  // 构建对话历史（给AI的上下文）
  const chatHistory: ChatMessage[] = state.messages.slice(-10).map((m) => ({
    role: (m.metadata?.isUser ? 'user' : 'assistant') as 'user' | 'assistant',
    content: `[${m.agentName}]: ${m.content}`
  }));

  if (userInput) {
    chatHistory.push({ role: 'user', content: userInput });
  }

  let responseContent = '';
  let messageType: AgentMessage['type'] = 'text';

  // 根据决策调用对应Agent
  switch (decision.nextAgent) {
    case 'teacher': {
      const result = await teacherChat(chatHistory, subject, topic);
      responseContent = result.content;
      break;
    }
    case 'student': {
      const persona: StudentPersona =
        state.turnCount % 3 === 0 ? 'curious' : state.turnCount % 3 === 1 ? 'diligent' : 'confused';
      const result = await studentChat(chatHistory, persona, subject, topic);
      responseContent = result.content;
      break;
    }
    case 'examiner': {
      if (decision.action === 'give_quiz') {
        const sceneContent = JSON.stringify(scene.content);
        const result = await generateQuiz(subject, topic, sceneContent, 3);
        responseContent = result.content;
        messageType = 'quiz';
      } else if (decision.action === 'grade_answer' && userInput) {
        const lastQuiz = state.messages.filter((m) => m.type === 'quiz').pop();
        const result = await gradeAnswer(subject, topic, lastQuiz?.content || '', '', userInput);
        responseContent = result.content;
      }
      break;
    }
  }

  // 构建新消息
  const agentNames: Record<AgentRole, string> = {
    teacher: '考研名师',
    student: '同学',
    examiner: '出题官'
  };

  const newMessage: AgentMessage = {
    id: `msg_${Date.now()}_${decision.nextAgent}`,
    role: decision.nextAgent,
    agentName: agentNames[decision.nextAgent],
    content: responseContent,
    type: messageType,
    timestamp: Date.now(),
    metadata: { action: decision.action, reason: decision.reason }
  };

  // 更新状态
  const updatedState: ClassroomState = {
    ...state,
    messages: [...state.messages, newMessage],
    turnCount: state.turnCount + 1,
    // 测验后等待用户输入
    phase: messageType === 'quiz' ? 'waiting_input' : state.phase
  };

  // 检查是否需要转换阶段
  if (updatedState.turnCount >= updatedState.maxTurns) {
    updatedState.phase = 'completed';
  }

  return { newMessage, updatedState: updatedState };
}

/**
 * 创建初始课堂状态
 */
export function createInitialState(sessionId: string, lessonId: string, scene: Scene): ClassroomState {
  return {
    sessionId,
    lessonId,
    currentSceneIndex: 0,
    phase: getInitialPhase(scene.type),
    agents: scene.agents || [],
    messages: [],
    turnCount: 0,
    maxTurns: 20, // 每个场景最多20轮对话
    pendingActions: []
  };
}
