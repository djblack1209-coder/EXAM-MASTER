import { captureSession, assertSession } from '../auth-storage.js';
import { learningRepository } from './learning-repository.js';
import { materialFingerprint } from './material-intake.js';
import { learningWriteLease } from './learning-write-lease.js';
import { assert, operationFingerprint } from './learning-domain.js';
import {
  createQuizOriginal,
  quizOriginalIdentity,
  validateQuizOriginalQuestion,
  assertQuizOriginalDisplay
} from '../../../laf-backend/functions/_shared/learning-quiz-original.js';
import { getQuizSelectionAnswer, isValidQuizAttemptId, isValidQuizSessionId } from '../quiz-session-contract.js';

export function quizReferenceObservationExists({ currentQuestion, sessionId, observationId }) {
  try {
    if (!isValidQuizSessionId(sessionId) || !isValidQuizAttemptId(observationId)) return false;
    const original = createQuizOriginal(currentQuestion),
      state = learningRepository.read();
    assertQuizOriginalDisplay(currentQuestion, original);
    const event = state.events.find((e) => e.id === `${observationId}:message`);
    const q = state.questions.find((row) => `${row.id}@${row.version}` === event?.data.questionKey);
    if (q)
      validateQuizOriginalQuestion({ ...q, prompt: currentQuestion.question, options: currentQuestion.options || [] });
    return (
      event?.type === 'message.add' &&
      event.data.conversationId === `quiz_${sessionId}` &&
      event.data.role === 'notice' &&
      event.data.content === '已查看本题参考，参考内容待核对；没有提交答案。' &&
      q?.quizOriginal &&
      quizOriginalIdentity(q.quizOriginal) === quizOriginalIdentity(original)
    );
  } catch (_error) {
    return false;
  }
}

// 查看和自评使用已有消息/帮助记录，不伪造答案、评分或复习调度。
export async function recordQuizLearningObservation({
  currentQuestion,
  sessionId,
  observationId,
  kind,
  rating,
  referenceId,
  canContinue = () => true,
  session: origin = captureSession()
}) {
  assert(isValidQuizSessionId(sessionId) && isValidQuizAttemptId(observationId), 'INVALID_INPUT', '记录编号不合法');
  assert(
    kind === 'reference_view' || (kind === 'self_rating' && [1, 2, 3, 4].includes(rating)),
    'INVALID_INPUT',
    '查看或自评不合法'
  );
  const q = JSON.parse(JSON.stringify(currentQuestion));
  const original = createQuizOriginal(q);
  assertQuizOriginalDisplay(q, original);
  assertSession(origin);
  const context = learningRepository.lifecycleContext();
  assert(canContinue(), 'CONTEXT_CHANGED', '原查看上下文已变化');
  await learningWriteLease.waitUntilWritable(context[0]);
  assertSession(origin);
  assert(
    canContinue() && JSON.stringify(learningRepository.lifecycleContext()) === JSON.stringify(context),
    'CONTEXT_CHANGED',
    '原查看上下文已变化'
  );
  const before = learningRepository.read(),
    session = `quiz_${sessionId}`;
  const logicalId = `bank_${q.bankId || q.subject || 'legacy'}_${q.id}`;
  const versions = before.questions.filter((row) => row.id === logicalId);
  const existing = versions.find(
    (row) => row.quizOriginal && quizOriginalIdentity(row.quizOriginal) === quizOriginalIdentity(original)
  );
  const version = existing?.version || Math.max(0, ...versions.map((row) => row.version)) + 1,
    key = `${logicalId}@${version}`;
  const saved = {
    id: logicalId,
    version,
    prompt: q.question,
    options: q.options || [],
    scope: 'legacy',
    subject: q.subject || q.category,
    knowledgePoint: q.knowledgePoint || q.sub_category,
    quizOriginal: original,
    source: {
      kind: 'existing_bank',
      sourceEvidenceId: q.sourceEvidenceId || null,
      fingerprint: materialFingerprint(quizOriginalIdentity(original)),
      answerEvidenceStatus: 'unknown'
    },
    validation: null
  };
  validateQuizOriginalQuestion(saved);
  const viewContent = '已查看本题参考，参考内容待核对；没有提交答案。';
  const content =
    kind === 'reference_view'
      ? viewContent
      : `本题记忆自评：${['忘了', '模糊', '记得', '简单'][rating - 1]}。这不是作答或可靠复习。`;
  const data = {
    conversationId: session,
    questionKey: key,
    role: kind === 'reference_view' ? 'notice' : 'user',
    content
  };
  const messageId = `${observationId}:message`,
    old = before.events.find((e) => e.id === messageId);
  if (old) {
    assert(
      old.type === 'message.add' && operationFingerprint(old.data) === operationFingerprint(data),
      'CONFLICT',
      '查看记录编号与原内容不一致'
    );
    return { success: true, reused: true, observationId, questionKey: key };
  }
  assert(!before.conversations.find((row) => row.id === session)?.stopped, 'STOPPED', '当前练习已停止');
  if (kind === 'self_rating') {
    const viewed = before.events.find((e) => e.id === `${referenceId}:message`);
    assert(
      viewed?.type === 'message.add' &&
        viewed.data.conversationId === session &&
        viewed.data.questionKey === key &&
        viewed.data.role === 'notice' &&
        viewed.data.content === viewContent,
      'PRECONDITION',
      '请先保存当前题目的查看记录'
    );
  }
  const commit = (type, id, value) => {
    assertSession(origin);
    return learningRepository.commit({ type, id, data: value }, undefined, { session: origin });
  };
  if (!before.conversations.some((row) => row.id === session))
    commit('conversation.start', session, { goal: '独立练习的查看与自评记录' });
  if (!existing) commit('question.add', `${observationId}:question`, { question: saved });
  commit('question.focus', `${observationId}:focus`, { conversationId: session, questionKey: key });
  if (kind === 'reference_view') {
    const raw = String(original.fields.answer ?? original.fields.correct_answer ?? original.fields.correctAnswer ?? '');
    commit('hint.add', `${observationId}:reference`, {
      conversationId: session,
      level: 1,
      content: `查看原参考（待核对）：${raw.slice(0, 2500)}${raw.length > 2500 ? '…（完整内容见原件）' : ''}`
    });
  }
  commit('message.add', messageId, data);
  return { success: true, observationId, questionKey: key };
}

export async function recordQuizLearningAttempt({
  currentQuestion,
  userAnswer,
  sessionId,
  attemptId,
  canContinue = () => true,
  session: origin = captureSession()
}) {
  const q = currentQuestion ? JSON.parse(JSON.stringify(currentQuestion)) : null;
  if (q?.id === undefined || q.id === null || String(q.id).trim() === '' || !sessionId || !attemptId)
    return { success: false, error: 'STABLE_ATTEMPT_ID_REQUIRED' };
  assertSession(origin);
  const context = learningRepository.lifecycleContext();
  assert(canContinue(), 'CONTEXT_CHANGED', '原作答上下文已变化');
  await learningWriteLease.waitUntilWritable(context[0]);
  assertSession(origin);
  assert(
    canContinue() && JSON.stringify(learningRepository.lifecycleContext()) === JSON.stringify(context),
    'CONTEXT_CHANGED',
    '原作答上下文已变化'
  );
  const session = `quiz_${sessionId}`;
  const commit = (type, id, data) => {
    assertSession(origin);
    return learningRepository.commit({ type, id, data }, undefined, { session: origin });
  };
  const before = learningRepository.read();
  const logicalId = `bank_${q.bankId || q.subject || 'legacy'}_${q.id}`;
  const quizOriginal = createQuizOriginal(q);
  const fingerprint = materialFingerprint(quizOriginalIdentity(quizOriginal));
  const legacyFingerprint = materialFingerprint(
    JSON.stringify([q.question || q.content || q.title, q.options || [], q.sourceEvidenceId || null])
  );
  const versions = before.questions.filter((item) => item.id === logicalId);
  const existing = versions.find(
    (item) => item.quizOriginal && quizOriginalIdentity(item.quizOriginal) === quizOriginalIdentity(quizOriginal)
  );
  const version = existing?.version || Math.max(0, ...versions.map((item) => item.version)) + 1;
  const key = `${logicalId}@${version}`;
  const savedQuestion = {
    id: logicalId,
    version,
    prompt: q.question || q.content || q.title,
    options: q.options || [],
    scope: 'legacy',
    subject: q.subject || q.category,
    knowledgePoint: q.knowledgePoint || q.sub_category,
    quizOriginal,
    source: {
      kind: 'existing_bank',
      sourceEvidenceId: q.sourceEvidenceId || null,
      fingerprint,
      answerEvidenceStatus: q.answerEvidenceStatus || 'unknown'
    },
    validation: null
  };
  validateQuizOriginalQuestion(savedQuestion);
  assertQuizOriginalDisplay(q, quizOriginal);
  const original = before.attempts.find((item) => item.id === attemptId);
  if (original) {
    const originalQuestion = versions.find((item) => `${item.id}@${item.version}` === original.questionKey);
    const sameOriginal = originalQuestion?.quizOriginal
      ? quizOriginalIdentity(originalQuestion.quizOriginal) === quizOriginalIdentity(quizOriginal)
      : originalQuestion?.source?.kind === 'existing_bank' &&
        originalQuestion.source.fingerprint === legacyFingerprint &&
        originalQuestion.prompt === (q.question || q.content || q.title) &&
        operationFingerprint(originalQuestion.options || []) === operationFingerprint(q.options || []) &&
        (originalQuestion.source.sourceEvidenceId || null) === (q.sourceEvidenceId || null);
    assert(
      original.conversationId === session && sameOriginal && original.answer === userAnswer,
      'CONFLICT',
      '原作答编号与内容不一致'
    );
    return { success: true, reused: true, state: before, result: original };
  }
  assert(!before.conversations.find((item) => item.id === session)?.stopped, 'STOPPED', '该练习已停止，原作答保留');
  if (!before.conversations.some((c) => c.id === session))
    commit('conversation.start', session, { goal: '独立练习记录' });
  if (!before.questions.some((item) => `${item.id}@${item.version}` === key)) {
    commit('question.add', `${session}:q:${q.id}:v${version}`, {
      question: savedQuestion
    });
  }
  commit('question.focus', `${attemptId}:focus`, { conversationId: session, questionKey: key });
  if (q.legacyReviewContext?.contract === 'legacy-review-view-v1' && q.legacyReviewContext.referenceViewed === true)
    commit('hint.add', `${attemptId}:legacy-reference`, {
      conversationId: session,
      level: 1,
      content: `重练前查看的历史参考（待核对）：${quizOriginal.fields.answer ?? quizOriginal.fields.correct_answer ?? quizOriginal.fields.correctAnswer ?? ''}\n${quizOriginal.fields.desc ?? quizOriginal.fields.analysis ?? ''}`
    });
  const result = commit('attempt.submit', attemptId, { conversationId: session, answer: userAnswer, explicit: true });
  // 旧客户端 isCorrect 不是服务端证据。保留待复核，不扩张首答可靠统计。
  return { success: true, ...result };
}

export async function restoreQuizLearningAttempts({
  questions,
  answeredQuestions,
  sessionId,
  canContinue = () => true,
  session: origin = captureSession()
}) {
  const result = { restored: 0, reused: 0, skipped: 0 };
  if (!isValidQuizSessionId(sessionId)) return result;
  const snapshot = JSON.parse(JSON.stringify({ questions, answeredQuestions }));
  assertSession(origin);
  const context = learningRepository.lifecycleContext();
  const jobs = [];
  const bindings = new Map();
  for (const record of snapshot.answeredQuestions || []) {
    const question = snapshot.questions?.[record.index];
    const answer = getQuizSelectionAnswer(question, record.userChoice);
    if (!isValidQuizAttemptId(record.attemptId) || question?.id !== record.questionId || !answer) {
      result.skipped++;
      continue;
    }
    const binding = JSON.stringify([question, answer]);
    assert(
      !bindings.has(record.attemptId) || bindings.get(record.attemptId) === binding,
      'CONFLICT',
      '恢复作答的原编号与内容不一致'
    );
    bindings.set(record.attemptId, binding);
    createQuizOriginal(question);
    jobs.push({ record, question, answer });
  }
  for (const { record, question, answer } of jobs) {
    assertSession(origin);
    const outcome = await recordQuizLearningAttempt({
      session: origin,
      currentQuestion: question,
      userAnswer: answer,
      sessionId,
      attemptId: record.attemptId,
      canContinue: () =>
        canContinue() && JSON.stringify(learningRepository.lifecycleContext()) === JSON.stringify(context)
    });
    if (outcome.reused) result.reused++;
    else if (outcome.success) result.restored++;
  }
  return result;
}
