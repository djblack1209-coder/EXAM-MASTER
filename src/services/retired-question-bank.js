import { normalizeLegacyReviewQuestion } from './quiz-session-contract.js';
import { validateCapturedQuizOriginal } from '../../laf-backend/functions/_shared/learning-quiz-original.js';

// Read-time compatibility only. Never migrate, regrade or remove saved records.
export function legacyQuestionView(record) {
  let original = record;
  if (record?.quizOriginal) {
    try {
      const captured = validateCapturedQuizOriginal(record.quizOriginal);
      original = { ...captured.fields, id: captured.id, quizOriginal: captured };
    } catch {
      original = null;
    }
  }
  const prompt =
    original?.question ??
    original?.question_content ??
    original?.questionContent ??
    original?.content ??
    original?.title;
  const available = typeof prompt === 'string' && Boolean(prompt.trim());
  const question = available ? normalizeLegacyReviewQuestion(original) : null;
  return {
    question,
    available,
    reviewable: Boolean(question),
    prompt: available ? prompt : '',
    answer: record?.user_answer ?? record?.userAnswer ?? record?.userChoice ?? '',
    result: record?.is_correct ?? record?.isCorrect ?? record?.result ?? null,
    at: record?.created_at ?? record?.createdAt ?? record?.timestamp ?? record?.last_wrong_time ?? null
  };
}

export function retiredBankResponse() {
  return { success: false, code: 410, error: 'QUESTION_BANK_RETIRED', message: '内置题库已下线' };
}
