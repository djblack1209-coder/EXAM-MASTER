import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import {
  buildSessionKnowledgeInsights,
  buildKnowledgeGraph,
  deriveKnowledgeVisualState,
  getKnowledgeNodeTrail,
  resolveQuestionKnowledge
} from '@/config/knowledge-graph.js';
import { useLearningTrajectoryStore } from '@/stores/modules/learning-trajectory-store.js';

describe('public-course knowledge graph', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('filters graph nodes by selected public-course tracks', () => {
    const graph = buildKnowledgeGraph({ tracks: ['english2', 'math2'] });
    const nodeIds = graph.nodes.map((item) => item.id);

    expect(nodeIds).toContain('track:english2');
    expect(nodeIds).toContain('track:math2');
    expect(nodeIds).toContain('module:english:reading');
    expect(nodeIds).toContain('module:math:linear');
    expect(nodeIds).not.toContain('module:politics:marxism');
    expect(nodeIds).not.toContain('module:math:probability');
  });

  it('maps question text to fine-grained knowledge nodes', () => {
    const nodeIds = resolveQuestionKnowledge(
      {
        subject: '数学',
        question: '用夹逼准则计算极限 lim(x→0) sin x / x'
      },
      { tracks: ['math1'] }
    );

    expect(nodeIds).toEqual(['topic:math:calculus:limit']);
  });

  it('derives visual mastery states for neural graph rendering', () => {
    expect(deriveKnowledgeVisualState({ attempts: 0 }).state).toBe('unknown');
    expect(deriveKnowledgeVisualState({ attempts: 10, correct: 9, streak: 1, lastCorrect: true }).state).toBe('primed');
    expect(deriveKnowledgeVisualState({ attempts: 10, correct: 9, streak: 2, lastCorrect: true }).state).toBe('strong');
    expect(deriveKnowledgeVisualState({ attempts: 10, correct: 9, streak: 0, lastCorrect: false }).state).toBe('weak');
  });

  it('records quiz attempts into node mastery state', () => {
    const store = useLearningTrajectoryStore();
    store.setExamProfile({ tracks: ['math1'] });

    const activity = store.recordQuestionAttempt(
      {
        id: 'q_limit_1',
        subject: '数学',
        question: '用夹逼准则计算极限'
      },
      {
        isCorrect: true,
        timeSpent: 18000,
        timestamp: 1710000000000,
        speedScore: 88,
        elo: { userRating: 1532, questionRating: 1468 }
      }
    );

    expect(activity.nodeIds).toEqual(['topic:math:calculus:limit']);
    expect(store.nodeStates['topic:math:calculus:limit']).toMatchObject({
      attempts: 1,
      correct: 1,
      streak: 1,
      totalTimeMs: 18000,
      lastCorrect: true,
      lastSpeedScore: 88,
      lastEloUserRating: 1532,
      lastEloQuestionRating: 1468
    });
  });

  it('returns an ordered knowledge trail for post-answer deep links', () => {
    const trail = getKnowledgeNodeTrail('micro:math:derivative:chain-rule');

    expect(trail.map((item) => item.id)).toEqual([
      'subject:math',
      'module:math:calculus',
      'topic:math:calculus:derivative',
      'micro:math:derivative:chain-rule'
    ]);
  });

  it('builds session-level knowledge insights for the quiz result screen', () => {
    const insights = buildSessionKnowledgeInsights(
      [
        {
          id: 'q_limit_1',
          subject: '数学',
          question: '用夹逼准则计算极限 lim(x→0) sin x / x'
        },
        {
          id: 'q_attitude_1',
          subject: '英语',
          question: 'Which of the following best shows the author attitude after however?'
        }
      ],
      [
        { index: 0, isCorrect: false, timeSpent: 48000, speedScore: 41 },
        { index: 1, isCorrect: true, timeSpent: 22000, speedScore: 86 }
      ],
      { tracks: ['math1', 'english1'] }
    );

    expect(insights.summary).toMatchObject({
      answerCount: 2,
      attemptedNodes: 2,
      weakNodes: 1,
      strongNodes: 0,
      averageMastery: 50
    });
    expect(insights.focusNodes[0]).toMatchObject({
      nodeId: 'topic:math:calculus:limit',
      label: '极限',
      state: 'weak',
      accuracy: 0,
      wrong: 1,
      avgSpeedScore: 41
    });
    expect(insights.focusNodes[0].chainText).toBe('考研数学 / 高等数学 / 极限');
    expect(insights.nodes.map((item) => item.nodeId)).toEqual([
      'topic:math:calculus:limit',
      'topic:english:reading:attitude'
    ]);
  });

  it('does not treat unrated flashcard flips as wrong knowledge attempts', () => {
    const insights = buildSessionKnowledgeInsights(
      [
        {
          id: 'q_flashcard_limit',
          subject: '数学',
          question: '夹逼准则的适用条件'
        }
      ],
      [{ index: 0, isCorrect: null, userChoice: 'flashcard_flip', timeSpent: 12000 }],
      { tracks: ['math1'] }
    );

    expect(insights.summary).toMatchObject({
      answerCount: 1,
      attemptedNodes: 0,
      weakNodes: 0,
      averageMastery: 0
    });
    expect(insights.focusNodes).toEqual([]);
  });
});
