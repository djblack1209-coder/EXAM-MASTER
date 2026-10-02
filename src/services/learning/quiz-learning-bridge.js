import { learningRepository } from './learning-repository.js';
import { materialFingerprint } from './material-intake.js';

export function recordQuizLearningAttempt({ currentQuestion: q, userAnswer, sessionId, attemptId }) {
  if (!q?.id || !sessionId || !attemptId) return { success: false, error: 'STABLE_ATTEMPT_ID_REQUIRED' };
  const session = `quiz_${sessionId}`;
  const commit = (type, id, data) => learningRepository.commit({ type, id, data });
  const before = learningRepository.read();
  const logicalId = `bank_${q.bankId || q.subject || 'legacy'}_${q.id}`;
  const fingerprint = materialFingerprint(
    JSON.stringify([q.question || q.content || q.title, q.options || [], q.sourceEvidenceId || null])
  );
  const versions = before.questions.filter((item) => item.id === logicalId);
  const existing = versions.find((item) => item.source?.fingerprint === fingerprint);
  const version = existing?.version || Math.max(0, ...versions.map((item) => item.version)) + 1;
  const key = `${logicalId}@${version}`;
  if (!before.conversations.some((c) => c.id === session))
    commit('conversation.start', session, { goal: '独立练习记录' });
  if (!before.questions.some((item) => `${item.id}@${item.version}` === key)) {
    commit('question.add', `${session}:q:${q.id}:v${version}`, {
      question: {
        id: logicalId,
        version,
        prompt: q.question || q.content || q.title,
        options: q.options || [],
        scope: 'legacy',
        subject: q.subject || q.category,
        knowledgePoint: q.knowledgePoint || q.sub_category,
        source: {
          kind: 'existing_bank',
          sourceEvidenceId: q.sourceEvidenceId || null,
          fingerprint,
          answerEvidenceStatus: q.answerEvidenceStatus || 'unknown'
        },
        validation: null
      }
    });
  }
  commit('question.focus', `${attemptId}:focus`, { conversationId: session, questionKey: key });
  const result = commit('attempt.submit', attemptId, { conversationId: session, answer: userAnswer, explicit: true });
  // 旧客户端 isCorrect 不是服务端证据。保留待复核，不扩张首答可靠统计。
  return { success: true, ...result };
}
