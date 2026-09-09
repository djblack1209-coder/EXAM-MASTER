import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { storageService } from '@/services/storageService.js';
import { useFavoriteStore } from '@/stores/modules/favorite.js';
import { useLearningTrajectoryStore } from '@/stores/modules/learning-trajectory-store.js';
import { useStudyEngineStore } from '@/stores/modules/study-engine.js';
import { useStudyStore } from '@/stores/modules/study.js';
import questionFavoriteManager from '@/utils/favorite/question-favorite.js';

const question = {
  id: 'q_math_1',
  question: '设函数 f(x)=x²，求 f(2)。',
  options: ['A. 2', 'B. 4', 'C. 6', 'D. 8'],
  answer: 'B',
  category: '数学',
  subject: '数学',
  desc: '代入 x=2 可得 4。'
};

function dateAfter(days) {
  const date = new Date(Date.now() + days * 86400000);
  return date.toISOString().slice(0, 10);
}

describe('offline business closure', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    uni.clearStorageSync();
    questionFavoriteManager.isInitialized = false;
    questionFavoriteManager.favorites = [];
    questionFavoriteManager.folders = questionFavoriteManager.folders.slice(0, 4);
    storageService.save('v30_bank', [question], true);
    storageService.save(
      'mistake_book',
      [
        {
          id: 'm_math_1',
          question: question.question,
          options: question.options,
          correct_answer: 'B',
          user_answer: 'A',
          category: '数学',
          error_type: 'calculation_error',
          wrong_count: 2,
          created_at: Date.now() - 86400000
        }
      ],
      true
    );
  });

  it('keeps question favorites usable without a backend', async () => {
    const store = useFavoriteStore();
    await store.loadFavorites();
    store.loadFolders();
    store.loadStats();

    const added = await store.toggleFavorite(question);
    expect(added).toMatchObject({ success: true, action: 'added', isFavorited: true });
    expect(await store.checkIsFavorited(question.id)).toBe(true);
    expect(store.favorites).toHaveLength(1);
    expect(store.stats.totalCount).toBe(1);

    const folder = store.createFolder({ name: '数学重点' });
    expect(folder.success).toBe(true);
    expect(store.moveToFolder(added.id, folder.folder.id).success).toBe(true);
    expect(store.favorites[0].folderId).toBe(folder.folder.id);

    const removed = await store.removeFromFavorite(question.id);
    expect(removed).toMatchObject({ success: true, action: 'removed' });
    expect(await store.checkIsFavorited(question.id)).toBe(false);
    expect(store.favorites).toHaveLength(0);
  });

  it('derives mastery, error clusters, progress, and a plan from local attempts', async () => {
    const studyStore = useStudyStore();
    studyStore.recordQuestionAttempt({ question, isCorrect: false, timeSpent: 12000 });
    studyStore.recordQuestionAttempt({ question, isCorrect: true, timeSpent: 8000 });

    const trajectory = useLearningTrajectoryStore();
    trajectory.recordQuestionAttempt(question, { isCorrect: false, timeSpent: 12000 });

    const engine = useStudyEngineStore();
    const mastery = await engine.analyzeMastery();
    expect(mastery).toMatchObject({ success: true, source: 'local' });
    expect(mastery.data.summary.totalKnowledgePoints).toBeGreaterThan(0);
    expect(mastery.data.mastery[0]).toMatchObject({
      knowledgePoint: '数学',
      totalQuestions: 2,
      correctCount: 1,
      wrongCount: 1
    });

    const clusters = await engine.getErrorClusters();
    expect(clusters).toMatchObject({ success: true, source: 'local' });
    expect(clusters.data.summary.totalMistakes).toBe(1);
    expect(clusters.data.clusters[0]).toMatchObject({
      errorType: 'calculation_error',
      errorTypeName: '计算失误',
      knowledgePoints: ['数学']
    });

    const progress = await engine.getProgress();
    expect(progress).toMatchObject({ total: 2, completed: 2, correct: 1, mistakes: 1, source: 'local' });

    const plan = await engine.generateStudyPlan(dateAfter(3), 1);
    expect(plan).toMatchObject({ success: true, source: 'local' });
    expect(plan.data.plans.length).toBeGreaterThan(0);
    expect(plan.data.plans.length).toBeLessThanOrEqual(3);
    expect(plan.data.plan.plans).toEqual(plan.data.plans);
    expect(plan.data.plans[0].totalMinutes).toBeGreaterThan(0);
  });

  it('tracks local study sessions and refuses invalid plan dates', async () => {
    const engine = useStudyEngineStore();
    const started = await engine.startSession({ mode: 'review', questionCount: 1 });
    expect(started).toMatchObject({ success: true, source: 'local' });
    expect(engine.hasActiveSession).toBe(true);

    const ended = await engine.endSession({ answeredCount: 1, correctCount: 1 });
    expect(ended).toMatchObject({ success: true, source: 'local', data: { answeredCount: 1, correctCount: 1 } });
    expect(engine.hasActiveSession).toBe(false);
    expect(engine.sessionCount).toBe(1);

    const invalid = await engine.generateStudyPlan('not-a-date');
    expect(invalid).toMatchObject({ success: false, source: 'local' });
  });
});
