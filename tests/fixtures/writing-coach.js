// Synthetic responses for isolated flow verification; never shipped as teaching content.
import { WRITING_METHOD, COACH_FEEDBACK_VERSION } from '../../laf-backend/functions/_shared/learning-writing-coach.js';
export function coachFixture(request) {
  if (request.phase === 'diagnostic')
    return {
      kind: 'diagnostic',
      cards: WRITING_METHOD.diagnostic.map((title, i) => ({
        id: `d${i + 1}`,
        kind: 'diagnostic',
        title,
        prompt: `测试题${i + 1}`,
        sourceId: request.sources[0]?.id || null
      }))
    };
  if (request.phase === 'daily')
    return {
      kind: 'daily',
      cards: [
        'collocation',
        'collocation',
        'collocation',
        'translate_zh',
        'translate_zh',
        'translate_en',
        'translate_en',
        'long_sentence'
      ].map((kind, i) => ({
        id: `c${i}`,
        kind,
        title: `训练${i}`,
        prompt: `合成题目${i}`,
        example: 'Synthetic example.',
        sourceId: request.sources[0]?.id || null
      })),
      writing: {
        prompt: 'Write a letter to invite a friend to a reading event. About 100 words.',
        patterns: [['I am writing to invite you to...'], ['I look forward to your reply.']],
        sourceId: null
      }
    };
  if (request.phase === 'summary')
    return { kind: 'summary', learned: ['已提交搭配、翻译、长难句与两段改写'], tomorrow: ['先复习句式，再继续训练'] };
  return {
    kind: request.phase,
    target: request.target,
    lines: [
      {
        original: request.input.split('\n')[0],
        advice: '合成反馈：注意主谓一致。',
        rewrite: 'This is a synthetic revision.'
      }
    ],
    weaknesses: ['主谓一致'],
    ...(request.feedbackVersion === COACH_FEEDBACK_VERSION
      ? { weaknessEvidence: [{ label: '主谓一致', quote: request.input.split('\n')[0], classification: 'error' }] }
      : {}),
    phrases: ['I am writing to invite you to...'],
    dimensions: request.phase === 'essay' ? WRITING_METHOD.feedback.map((name) => ({ name, comment: '合成反馈' })) : []
  };
}
