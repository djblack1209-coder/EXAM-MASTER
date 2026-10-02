import { effectiveGrade } from './learning-domain.js';
import { createNewCard, scheduleCard } from '../fsrs-service.js';

export const CONVERSATION_REVIEW_POLICY = 'reliable-due-v1';
// FSRS 只接受首次可靠检验与到期的显式复测。立即重做/提示修正仍保留事实，
// 不能通过连续发送同一个答案把复习间隔推远。
export function deriveConversationReview(attempts, reviews) {
  let card = null;
  let boundary = null;
  let rating = null;
  const evidenceIds = [];
  for (const attempt of attempts) {
    if (effectiveGrade(attempt).status !== 'reliable') continue;
    if (card && (attempt.kind !== 'review' || attempt.at < boundary)) continue;
    rating = effectiveGrade(attempt).outcome !== 'correct' ? 'again' : attempt.hints.length ? 'hard' : 'good';
    card = scheduleCard(card || createNewCard(new Date(attempt.at)), rating, new Date(attempt.at)).card;
    evidenceIds.push(attempt.id);
    // 已落盘的安排是当前日期事实，不因调度器模糊间隔或升级重算而改写。
    boundary = reviews.filter((review) => review.attemptId === attempt.id).at(-1)?.due || new Date(card.due).getTime();
  }
  return card ? { card, due: boundary, rating, evidenceIds, policy: CONVERSATION_REVIEW_POLICY } : null;
}
