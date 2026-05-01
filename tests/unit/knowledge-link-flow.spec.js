import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const doQuizSource = readFileSync(resolve(process.cwd(), 'src/pages/practice-sub/do-quiz.vue'), 'utf8');
const practiceSource = readFileSync(resolve(process.cwd(), 'src/pages/practice/index.vue'), 'utf8');
const quizResultSource = readFileSync(
  resolve(process.cwd(), 'src/pages/practice-sub/components/quiz-result/quiz-result.vue'),
  'utf8'
);

describe('post-answer knowledge link flow', () => {
  it('lets users tap the answer feedback card to jump to the focused knowledge node', () => {
    expect(doQuizSource).toContain('@tap.stop="goKnowledgeLink"');
    expect(doQuizSource).toContain('practice_focus_knowledge_node');
  });

  it('renders the focused knowledge node in practice center and can start node training', () => {
    expect(practiceSource).toContain('focusedKnowledgeNode');
    expect(practiceSource).toContain('startKnowledgeNodeTraining');
    expect(practiceSource).toContain('smart_review_ids');
  });

  it('does not let analytics recording duplicate answered question progress', () => {
    const methodStart = doQuizSource.indexOf('async recordAnswerToAnalytics(isCorrect, timeSpent)');
    const methodEnd = doQuizSource.indexOf('recordKnowledgeAttempt(isCorrect, timeSpent', methodStart);
    const methodSource = doQuizSource.slice(methodStart, methodEnd);

    expect(methodStart).toBeGreaterThan(-1);
    expect(methodEnd).toBeGreaterThan(methodStart);
    expect(methodSource).not.toContain('this.answeredQuestions.push');
  });

  it('surfaces session knowledge insights in the final quiz report', () => {
    expect(quizResultSource).toContain('buildSessionKnowledgeInsights');
    expect(quizResultSource).toContain('knowledge-insight-section');
    expect(quizResultSource).toContain('knowledgeInsights.focusNodes');
    expect(quizResultSource).toContain("emit('goWeakTraining')");
  });
});
