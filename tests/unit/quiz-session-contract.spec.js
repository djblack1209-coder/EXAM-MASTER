import { describe, expect, it } from 'vitest';

import {
  buildQuizCompletionContent,
  buildQuizKnowledgeFeedback,
  buildQuizAnswerRecord,
  getQuizQuestionId,
  getQuizOptionLabel,
  getQuizQuestionTypeLabel,
  hasQuizSelectableOptions,
  isCorrectQuizOption,
  isPublishedPracticeBankSource,
  isQuizFlashcardMode,
  isReleasedPracticeBankSource,
  normalizeQuizQuestion,
  selectQuizQuestionsByIds,
  shouldRestoreLegacyReviewBank,
  summarizeQuizAnswers,
  summarizeQuizProgress,
  upsertQuizAnswerRecord
} from '@/services/quiz-session-contract.js';

describe('quiz session contract', () => {
  it('normalizes analysis and flashcard questions without losing answer evidence fields', () => {
    const question = normalizeQuizQuestion(
      {
        _id: 'fc_2000_01',
        title: '简述阅读理解主旨题的定位步骤',
        answer: '先定位题干关键词，再回到段落中心句核验。',
        explanation: '主旨题不能只看单句，需要回到段落结构。',
        type: 'analysis',
        subject: '英语一',
        source: '2000 英语一答案解析',
        year: 2000,
        knowledge_points: ['english-reading-main-idea']
      },
      2
    );

    expect(question).toMatchObject({
      id: 'fc_2000_01',
      question: '简述阅读理解主旨题的定位步骤',
      answer: '先定位题干关键词，再回到段落中心句核验。',
      desc: '主旨题不能只看单句，需要回到段落结构。',
      category: '英语一',
      type: 'analysis',
      source: '2000 英语一答案解析',
      year: 2000,
      knowledgeNodeIds: ['english-reading-main-idea'],
      knowledge_points: ['english-reading-main-idea']
    });
    expect(question.options).toEqual([]);
  });

  it('normalizes choice questions and checks answers by stable option labels', () => {
    const question = normalizeQuizQuestion(
      {
        id: 'choice_001',
        question: 'Which one is correct?',
        options: ['Alpha', 'Beta', 'Gamma', 'Delta'],
        answer: 'c',
        difficulty: '3'
      },
      0
    );

    expect(question.answer).toBe('C');
    expect(question.difficulty).toBe(3);
    expect(getQuizOptionLabel(question, 0)).toBe('A');
    expect(getQuizOptionLabel({ options: ['B. Beta'] }, 0)).toBe('B');
    expect(isCorrectQuizOption(question, 2)).toBe(true);
    expect(isCorrectQuizOption(question, 1)).toBe(false);
  });

  it('builds and upserts answer records by question and index', () => {
    const baseQuestion = normalizeQuizQuestion({ id: 'q1', question: 'Q1', answer: 'A' }, 0);
    const first = buildQuizAnswerRecord({
      question: baseQuestion,
      index: 0,
      userChoice: 0,
      isCorrect: true,
      timeSpent: 18000,
      speedScore: 92,
      elo: { userRating: 1512, questionRating: 1478 },
      now: 1770000000000
    });
    const updated = buildQuizAnswerRecord({
      question: baseQuestion,
      index: 0,
      userChoice: 'flashcard_rating_4',
      isCorrect: true,
      timeSpent: 22000,
      rating: 4,
      now: 1770000001000
    });

    const records = upsertQuizAnswerRecord(upsertQuizAnswerRecord([], first), updated);

    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      questionId: 'q1',
      index: 0,
      userChoice: 'flashcard_rating_4',
      isCorrect: true,
      timeSpent: 22000,
      rating: 4,
      answeredAt: 1770000001000
    });
  });

  it('summarizes progress without treating neutral flashcard records as wrong answers', () => {
    const summary = summarizeQuizProgress({
      questions: [{ id: 'q1' }, { id: 'q2' }, { id: 'q3' }, { id: 'q4' }],
      answeredQuestions: [
        { questionId: 'q1', index: 0, isCorrect: true },
        { questionId: 'q2', index: 1, isCorrect: false },
        { questionId: 'q3', index: 2, isCorrect: null }
      ],
      currentIndex: 2
    });

    expect(summary).toEqual({
      total: 4,
      currentIndex: 2,
      answeredCount: 3,
      gradedCount: 2,
      correctCount: 1,
      wrongCount: 1,
      neutralCount: 1,
      progressRate: 0.75,
      accuracy: 50
    });
  });

  it('selects quiz questions by id with one bank pass while preserving requested order', () => {
    const idReads = [];
    const bank = Array.from({ length: 5 }, (_, index) => {
      const question = { title: `Question ${index}` };
      Object.defineProperty(question, 'id', {
        enumerable: true,
        get() {
          idReads.push(index);
          return `q${index}`;
        }
      });
      return question;
    });

    const selected = selectQuizQuestionsByIds(bank, ['q3', 'q1', 'missing', 'q3']);

    expect(selected.map((item) => item.title)).toEqual(['Question 3', 'Question 1', 'Question 3']);
    expect(idReads).toHaveLength(bank.length);
  });

  it('uses all supported question identity fields for review handoff', () => {
    const bank = [
      { questionId: 'card_1', title: 'FSRS card id' },
      { question_id: 'card_2', title: 'backend question id' },
      { id: 'card_3', title: 'normalized id' },
      { _id: 'card_4', title: 'database id' }
    ];

    expect(getQuizQuestionId(bank[0])).toBe('card_1');
    expect(selectQuizQuestionsByIds(bank, ['card_2', 'card_4', 'card_1']).map((item) => item.title)).toEqual([
      'backend question id',
      'database id',
      'FSRS card id'
    ]);
    expect(normalizeQuizQuestion({ question_id: 'card_5', title: 'normalized backend id' }, 0).id).toBe('card_5');
    expect(
      buildQuizAnswerRecord({
        question: { questionId: 'card_6', question: 'answer identity' },
        index: 0
      }).questionId
    ).toBe('card_6');
  });

  it('classifies practice bank sources for released training and published-bank browsing', () => {
    expect(isReleasedPracticeBankSource({ type: 'published_registry' })).toBe(true);
    expect(isReleasedPracticeBankSource({ type: 'guest_demo' })).toBe(true);
    expect(isReleasedPracticeBankSource({ type: 'local_only' })).toBe(false);
    expect(isReleasedPracticeBankSource(null)).toBe(false);

    expect(isPublishedPracticeBankSource({ type: 'published_registry' })).toBe(true);
    expect(isPublishedPracticeBankSource({ type: 'guest_demo' })).toBe(false);
    expect(isPublishedPracticeBankSource({ type: 'local_only' })).toBe(false);
  });

  it('restores a legacy review backup only when the current bank was replaced by review questions', () => {
    const backupBank = [{ id: 'official_1', question: 'official bank question' }];
    const reviewQuestions = [
      { id: 'mistake_1', question: 'review question 1', answer: 'A', isReview: true },
      { id: 'mistake_2', question: 'review question 2', answer: 'B', isReview: true }
    ];

    expect(
      shouldRestoreLegacyReviewBank({
        currentBank: reviewQuestions,
        backupBank,
        reviewQuestions
      })
    ).toBe(true);

    expect(
      shouldRestoreLegacyReviewBank({
        currentBank: [{ id: 'official_2', question: 'current released bank question', answer: 'C' }],
        backupBank,
        reviewQuestions
      })
    ).toBe(false);

    expect(
      shouldRestoreLegacyReviewBank({
        currentBank: reviewQuestions,
        backupBank: [],
        reviewQuestions
      })
    ).toBe(false);
  });

  it('summarizes answer records and builds an answered index map in one contract call', () => {
    const summary = summarizeQuizAnswers([
      { index: 0, isCorrect: true, timeSpent: 2000 },
      { index: 1, isCorrect: false, timeSpent: 4000 },
      { index: 2, isCorrect: null }
    ]);

    expect(summary).toEqual({
      answeredByIndex: {
        0: true,
        1: false,
        2: null
      },
      answeredCount: 3,
      correctCount: 1,
      wrongCount: 1,
      neutralCount: 1,
      gradedCount: 2,
      totalTimeMs: 6000,
      averageTimeMs: 2000
    });
  });

  it('builds completion content from deduped graded answers and schedule hints', () => {
    const content = buildQuizCompletionContent({
      questions: [{ id: 'q1' }, { id: 'q2' }, { id: 'q3' }, { id: 'q4' }],
      answeredQuestions: [
        { questionId: 'q1', index: 0, isCorrect: false },
        { questionId: 'q1', index: 0, isCorrect: true },
        { questionId: 'q2', index: 1, isCorrect: false },
        { questionId: 'q3', index: 2, isCorrect: null }
      ],
      nextReviewDelayMs: 45 * 60 * 1000,
      hasNextRecommendation: true
    });

    expect(content).toBe('本次完成 4 题，正确率 50%\n1 道错题已加入复习计划，约 45 分钟后首次复习\n\nAI 已根据薄弱点为你准备了下一组练习');
  });

  it('uses diagnosis states when building completion content', () => {
    expect(
      buildQuizCompletionContent({
        questions: [{ id: 'q1' }],
        answeredQuestions: [{ questionId: 'q1', index: 0, isCorrect: true }],
        diagnosisLoading: true
      })
    ).toBe('本次完成 1 题，正确率 100%\n\nAI 正在分析你的答题数据...');

    expect(
      buildQuizCompletionContent({
        questions: [{ id: 'q1' }],
        answeredQuestions: [{ questionId: 'q1', index: 0, isCorrect: true }],
        diagnosisReady: true,
        diagnosisSummary: '稳定掌握'
      })
    ).toBe('本次完成 1 题，正确率 100%\n\n稳定掌握');
  });

  it('classifies quiz question display modes for mobile shells', () => {
    const analysis = normalizeQuizQuestion(
      {
        id: 'analysis_001',
        question: '阅读理解定位步骤',
        answer: '先定位关键词',
        type: 'analysis',
        options: ['A. 干扰项']
      },
      0
    );
    const choice = normalizeQuizQuestion(
      {
        id: 'choice_001',
        question: '选择正确项',
        answer: 'B',
        type: 'multi_choice',
        options: ['A. 选项一', 'B. 选项二']
      },
      1
    );

    expect(getQuizQuestionTypeLabel(analysis)).toBe('分析题');
    expect(isQuizFlashcardMode(analysis)).toBe(true);
    expect(hasQuizSelectableOptions(analysis)).toBe(false);
    expect(getQuizQuestionTypeLabel(choice)).toBe('多选题');
    expect(isQuizFlashcardMode(choice)).toBe(false);
    expect(hasQuizSelectableOptions(choice)).toBe(true);
    expect(getQuizQuestionTypeLabel({ type: 'custom_drill' })).toBe('custom_drill');
    expect(getQuizQuestionTypeLabel(null)).toBe('单选题');
  });

  it('builds knowledge feedback view data from graph inputs', () => {
    const feedback = buildQuizKnowledgeFeedback({
      activity: {
        nodeIds: ['english-reading-main-idea'],
        speedScore: 78
      },
      question: {
        category: '英语一'
      },
      node: {
        label: '主旨题',
        tracks: ['english']
      },
      trail: [
        { id: 'english', label: '英语', type: 'subject', tracks: ['english'] },
        { id: 'reading', label: '阅读理解', type: 'module', tracks: ['english'] },
        { id: 'english-reading-main-idea', label: '主旨题', type: 'knowledge', tracks: ['english'] }
      ],
      visual: {
        state: 'weak',
        color: '#FFB020',
        mastery: 42
      },
      speedScore: 90
    });

    expect(feedback).toEqual({
      nodeId: 'english-reading-main-idea',
      label: '主旨题',
      color: '#FFB020',
      speedScore: 78,
      tracks: ['english'],
      trail: [
        { id: 'english', label: '英语', type: 'subject', tracks: ['english'] },
        { id: 'reading', label: '阅读理解', type: 'module', tracks: ['english'] },
        { id: 'english-reading-main-idea', label: '主旨题', type: 'knowledge', tracks: ['english'] }
      ],
      chainText: '英语 / 阅读理解 / 主旨题',
      summary: '薄弱点，当前掌握 42%，已同步到首页图谱'
    });
  });

  it('builds fallback knowledge feedback when no graph node is matched', () => {
    const feedback = buildQuizKnowledgeFeedback({
      activity: {},
      question: {
        category: '公共课综合'
      },
      speedScore: 64
    });

    expect(feedback).toMatchObject({
      nodeId: '',
      label: '公共课综合',
      color: '#DDE8DD',
      speedScore: 64,
      tracks: [],
      trail: [],
      chainText: '',
      summary: '待点亮，当前掌握 0%，已同步到首页图谱'
    });
  });
});
