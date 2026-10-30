import { emptyLearningState } from '../../src/services/learning/learning-domain.js';

// Synthetic records for isolated accounts only. No public sample or production seed.
export function progressFixture(writingCount = 6, answerCount = 6) {
  const state = emptyLearningState('progress-qa', 'Asia/Shanghai');
  const at = Date.parse('2026-10-30T02:00:00Z');
  const day = {
    day: '2026-10-30',
    answers: [],
    drafts: [],
    rewrites: [],
    feedback: {},
    pack: { cards: [], writing: { prompt: '合成写作题', patterns: [] } }
  };
  const coach = {
    profile: { exam: 'english2', track: 'kaoyan-english-writing' },
    startedDay: day.day,
    timezone: state.timezone,
    days: [day],
    library: [],
    requests: []
  };
  const conversation = { id: 'writing', goal: '隔离呈现验收', at, messages: [], questionKeys: [], coach };
  state.conversations.push(conversation, { id: 'math', goal: '合成数学', at, messages: [], questionKeys: [] });
  for (let i = 0; i < writingCount; i++) {
    const id = `writing-answer-${i}`,
      resultId = `receipt-${i}`,
      requestId = `request-${i}`,
      cardId = `card${i}`;
    const answer = 'Synthetic answer ' + i;
    day.pack.cards.push({ id: cardId, kind: 'translation', title: '中译英', prompt: `合成短句题 ${i + 1}` });
    day.answers.push({ id, cardId, answer, at: at + i * 1000, assessmentStatus: 'assessed' });
    const feedback = {
      id: resultId,
      kind: 'feedback',
      target: `card-${cardId}`,
      feedbackVersion: 2,
      dimensions: ['语法', '搭配', '表达', '任务完成'].map((name) => ({
        name,
        score: name === '语法' && i >= 4 ? 1 : 2,
        evidence: [answer],
        comment: '合成批改结论'
      })),
      errors:
        i >= 4
          ? [
              {
                quoteId: 'q1',
                dimension: '语法',
                label: '主谓一致',
                errorText: answer,
                replacement: 'Synthetic correction'
              }
            ]
          : [],
      weaknesses: i >= 4 ? ['主谓一致'] : [],
      weaknessEvidence: i >= 4 ? [{ label: '主谓一致', quote: answer, classification: 'error' }] : [],
      lines: [{ original: answer, advice: '合成建议', rewrite: 'Synthetic correction' }],
      phrases: []
    };
    day.feedback[feedback.target] = feedback;
    coach.requests.push({
      id: requestId,
      at: at + i * 1000,
      status: 'completed',
      resultId,
      modelId: 'byok_progress_qa',
      request: {
        phase: 'feedback',
        target: feedback.target,
        day: day.day,
        feedbackVersion: 2,
        dimensionContract: 'writing-dimensions-v1'
      }
    });
    state.events.push(
      { id, type: 'coach.answer', at: at + i * 1000, data: { conversationId: conversation.id, cardId } },
      {
        id: resultId,
        type: 'coach.result',
        at: at + i * 1000 + 1,
        data: { conversationId: conversation.id, requestId, output: feedback }
      }
    );
  }
  for (let i = 0; i < answerCount; i++) {
    const question = {
      id: `math-q${i}`,
      version: 1,
      subject: '数学',
      knowledgePoint: '占比',
      prompt: `合成算术题 ${i + 1}`,
      answerType: 'number'
    };
    state.questions.push(question);
    state.attempts.push({
      id: `math-answer-${i}`,
      at: at + i * 1000,
      kind: 'first',
      hints: [],
      corrections: [],
      conversationId: 'math',
      questionKey: `${question.id}@1`,
      answer: '1',
      grade: { status: 'reliable', outcome: i === 5 ? 'wrong' : 'correct' }
    });
    state.events.push({
      id: `math-answer-${i}`,
      type: 'answer.submit',
      at: at + i * 1000,
      data: { conversationId: 'math', questionKey: `${question.id}@1` }
    });
  }
  state.revision = state.events.length;
  return state;
}
