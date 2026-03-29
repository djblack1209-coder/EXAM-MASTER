import { Agent, Team } from 'ai-agent-team';

export class AgentService {
  /**
   * Provide dynamic feedback for a wrong answer
   */
  async provideTutorFeedback(questionContent: string, userAnswer: string, correctAnswer: string) {
    // In a real env, configure the LLM provider inside ai-agent-team.
    // For our moat, we construct a tutor persona to gently guide the student.
    const tutorAgent = new Agent({
      name: 'Tutor',
      role: 'A gentle and Socratic post-grad tutor',
      goal: "Analyze the student's mistake and provide a hint or concise explanation.",
      background: 'You are an expert at breaking down complex exam concepts without giving away the answer immediately.'
    });

    const team = new Team({
      agents: [tutorAgent],
      tasks: [
        {
          description: `The student answered "${userAnswer}" to the question "${questionContent}". The correct answer is "${correctAnswer}". Briefly explain why the student might have made this mistake and what the core concept is. Keep it under 50 words.`,
          expectedOutput: 'A short, encouraging explanation.'
        }
      ]
    });

    try {
      const result = await team.start();
      return result;
    } catch (e) {
      console.error('Agent failed:', e instanceof Error ? e.message : 'unknown error');
      return '这道题有点难度，再复习一下核心考点吧！';
    }
  }
}
