import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const doQuizSource = readFileSync(resolve(process.cwd(), 'src/pages/practice-sub/do-quiz.vue'), 'utf8');
const practiceSource = readFileSync(resolve(process.cwd(), 'src/pages/practice/index.vue'), 'utf8');
const questionBankSource = readFileSync(resolve(process.cwd(), 'src/pages/practice-sub/question-bank.vue'), 'utf8');
const quizResultSource = readFileSync(
  resolve(process.cwd(), 'src/pages/practice-sub/components/quiz-result/quiz-result.vue'),
  'utf8'
);

describe('post-answer knowledge link flow', () => {
  it('does not expose post-answer graph deep links while graph is down', () => {
    expect(doQuizSource).not.toContain('@tap.stop="goKnowledgeLink"');
    expect(doQuizSource).not.toContain('practice_focus_knowledge_node');
  });

  it('keeps the practice center focused on paper training and smart review', () => {
    expect(practiceSource).not.toContain('focusedKnowledgeNode');
    expect(practiceSource).not.toContain('startKnowledgeNodeTraining');
    expect(questionBankSource).toContain('smart_review_ids');
  });

  it('does not let analytics recording duplicate answered question progress', () => {
    const methodStart = doQuizSource.indexOf('async recordAnswerToAnalytics(isCorrect, timeSpent)');
    const methodEnd = doQuizSource.indexOf('calculateSpeedScore', methodStart);
    const methodSource = doQuizSource.slice(methodStart, methodEnd);

    expect(methodStart).toBeGreaterThan(-1);
    expect(methodEnd).toBeGreaterThan(methodStart);
    expect(methodSource).not.toContain('this.answeredQuestions.push');
  });

  it('keeps the final quiz report focused on score, categories, and next steps', () => {
    expect(quizResultSource).not.toContain('buildSessionKnowledgeInsights');
    expect(quizResultSource).not.toContain('knowledge-insight-section');
    expect(quizResultSource).not.toContain('knowledgeInsights.focusNodes');
    expect(quizResultSource).toContain("emit('goWeakTraining')");
  });
});
