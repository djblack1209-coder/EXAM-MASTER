import { describe, expect, it } from 'vitest';

import {
  buildQuizCompletionContent,
  buildQuizKnowledgeFeedback,
  buildQuizAnswerRecord,
  getQuizOptionLabel,
  getQuizQuestionTypeLabel,
  hasQuizSelectableOptions,
  getQuizSelectionAnswer,
  getQuizAnswerRecordOutcome,
  isCorrectQuizSelection,
  isCorrectQuizOption,
  isQuizFlashcardMode,
  normalizeQuizAnswer,
  normalizeQuizQuestion,
  normalizeLegacyReviewQuestion,
  readLegacyReviewHandoff,
  summarizeQuizProgress,
  upsertQuizAnswerRecord
} from '@/services/quiz-session-contract.js';
import { calculateCorrectStreak } from '@/pages/practice-sub/utils/session-feedback.js';

describe('quiz session contract', () => {
  it('preserves complete legacy multiple-choice references and full original material', () => {
    const raw = {
      id: 'old-multi',
      question: '完整原题',
      options: ['A. 甲', 'B. 乙', 'C. 丙'],
      correct_answer: 'C、A',
      type: '多选题',
      passage: '完整材料',
      targetSegment: '原画线'
    };
    const before = JSON.stringify(raw);
    expect(normalizeLegacyReviewQuestion(raw)).toMatchObject({
      id: 'old-multi',
      answer: 'AC',
      type: 'multi_choice',
      passage: '完整材料',
      targetSegment: '原画线',
      scoringAuthority: false
    });
    expect(JSON.stringify(raw)).toBe(before);
    expect(normalizeLegacyReviewQuestion({ ...raw, answer: 0, type: '单选' }).answer).toBe('A');
  });

  it.each([
    { id: null },
    { question: '' },
    { options: [] },
    { options: ['甲', ''] },
    { answer: null },
    { answer: '' },
    { answer: false },
    { answer: '参考A' },
    { answer: 'Z' },
    { answer: 2 },
    { options: ['B. 乙', 'A. 甲'] },
    { type: 'single_choice', answer: 'AB' }
  ])('does not invent missing or ambiguous legacy question fields: %j', (invalid) => {
    const raw = { id: 'old-one', question: '原题', options: ['甲', '乙'], answer: 'B', ...invalid };
    const before = JSON.stringify(raw);
    expect(normalizeLegacyReviewQuestion(raw)).toBeNull();
    expect(JSON.stringify(raw)).toBe(before);
  });

  it('binds legacy handoff to its current owner and exact launch identity, rejecting partial data', () => {
    const question = { id: 'old-one', question: '原题', options: ['甲', '乙'], answer: 'B' };
    const handoff = {
      contract: 'legacy-review-handoff-v1',
      id: 'launch-original',
      ownerId: 'owner-a',
      questions: [question]
    };
    expect(readLegacyReviewHandoff(handoff, handoff.id, handoff.ownerId)).toHaveLength(1);
    expect(readLegacyReviewHandoff(handoff, 'launch-other', handoff.ownerId)).toBeNull();
    expect(readLegacyReviewHandoff(handoff, handoff.id, 'owner-b')).toBeNull();
    expect(
      readLegacyReviewHandoff({ ...handoff, questions: [question, question] }, handoff.id, handoff.ownerId)
    ).toBeNull();
    expect(
      readLegacyReviewHandoff({ ...handoff, questions: [{ ...question, answer: '' }] }, handoff.id, handoff.ownerId)
    ).toBeNull();
    const copy = readLegacyReviewHandoff(handoff, handoff.id, handoff.ownerId);
    copy[0].options[0] = 'changed';
    expect(handoff.questions[0].options[0]).toBe('甲');
  });
  it('separates pending reference matches from grades and reviews without changing historical payloads', () => {
    const records = [true, false].map((referenceMatch, index) =>
      buildQuizAnswerRecord({
        question: { id: `pending-${index}` },
        index,
        userChoice: index,
        userAnswer: index ? 'B' : 'A',
        isCorrect: referenceMatch,
        referenceMatch,
        source: 'reference_match'
      })
    );
    expect(records.every((r) => r.isCorrect === null && r.grade.status === 'pending')).toBe(true);
    const before = JSON.stringify(records);
    expect(summarizeQuizProgress({ questions: [{}, {}], answeredQuestions: records })).toMatchObject({
      answeredCount: 2,
      pendingCount: 2,
      gradedCount: 0,
      correctCount: 0,
      wrongCount: 0,
      reviewedCount: 0
    });
    expect(getQuizAnswerRecordOutcome({ ...records[0], isCorrect: true })).toBe('pending');
    expect(calculateCorrectStreak(records)).toBe(0);
    expect(buildQuizCompletionContent({ questions: [{}, {}], answeredQuestions: records })).toBe(
      '本次已记录 2 题，2 题待核对'
    );
    expect(JSON.stringify(records)).toBe(before);
  });
  it.each([
    {},
    { isCorrect: null },
    { isCorrect: null, correct: true },
    { isCorrect: false, correct: true },
    { isCorrect: 'true' },
    { isCorrect: true, grade: null },
    { isCorrect: true, grade: { status: 'reliable', outcome: 'correct' } },
    { isCorrect: false, submission_contract: 'unknown' }
  ])('does not infer grading or review from unknown provenance %j', (record) => {
    const before = JSON.stringify(record);
    expect(getQuizAnswerRecordOutcome(record)).toBe('unclassified');
    expect(summarizeQuizProgress({ answeredQuestions: [record] })).toMatchObject({
      accuracy: null,
      gradedCount: 0,
      reviewedCount: 0,
      legacyGradedCount: 0,
      unclassifiedCount: 1
    });
    expect(calculateCorrectStreak([record])).toBe(0);
    expect(JSON.stringify(record)).toBe(before);
  });
  it('preserves a mixed legacy/reference/review distribution without granting scoring authority', () => {
    const records = [
      { isCorrect: true },
      { isCorrect: false },
      { correct: true },
      { isCorrect: true, grade: { status: 'pending' } },
      { userChoice: 'flashcard_rating_3', isCorrect: true },
      {}
    ].map((record, index) => ({ ...record, index }));
    expect(summarizeQuizProgress({ answeredQuestions: records })).toMatchObject({
      answeredCount: 6,
      scoringAuthority: false,
      legacyCorrectCount: 2,
      legacyWrongCount: 1,
      legacyAccuracy: 67,
      pendingCount: 1,
      reviewedCount: 1,
      unclassifiedCount: 1,
      accuracy: null
    });
    expect(calculateCorrectStreak([{ isCorrect: true }, { isCorrect: true }])).toBe(0);
  });
  it('does not turn self confidence into an exam accuracy, wrong point or perfect-score streak', () => {
    const self = { userChoice: 'flashcard_rating_3', isCorrect: true };
    expect(getQuizAnswerRecordOutcome(self)).toBe('reviewed');
    expect(getQuizAnswerRecordOutcome({ userChoice: 'flashcard_flip', isCorrect: false })).toBe('reviewed');
    expect(calculateCorrectStreak([{ userChoice: 0, isCorrect: true }, self])).toBe(0);
    expect(buildQuizCompletionContent({ questions: [{}], answeredQuestions: [{ ...self, index: 0 }] })).toBe(
      '本次查看或自评 1 题'
    );
  });
  it('keeps historical self ratings out of correctness without rewriting their original payload', () => {
    const records = [
      { questionId: 'choice', index: 0, userChoice: 0, isCorrect: true },
      { questionId: 'remembered', index: 1, userChoice: 'flashcard_rating_3', rating: 3, isCorrect: true },
      { questionId: 'forgotten', index: 2, userChoice: 'flashcard_rating_1', rating: 1, isCorrect: false }
    ];
    const before = JSON.stringify(records);
    expect(summarizeQuizProgress({ questions: [{}, {}, {}], answeredQuestions: records })).toMatchObject({
      answeredCount: 3,
      gradedCount: 0,
      correctCount: 0,
      wrongCount: 0,
      neutralCount: 3,
      reviewedCount: 2,
      legacyGradedCount: 1,
      legacyAccuracy: 100,
      accuracy: null
    });
    expect(JSON.stringify(records)).toBe(before);
  });
  it.each(['multi_choice', 'multiple_choice', '多选'])(
    'compares the complete selection set for %s without treating one correct option as the entire answer',
    (type) => {
      const question = { type, options: ['一', '二', '三', '四'], answer: 'AC' };
      expect(getQuizSelectionAnswer(question, [2, 0])).toBe('AC');
      expect(isCorrectQuizSelection(question, [2, 0])).toBe(true);
      expect(isCorrectQuizSelection(question, [0])).toBe(false);
      expect(isCorrectQuizSelection(question, [0, 1, 2])).toBe(false);
      expect(isCorrectQuizSelection(question, [1, 3])).toBe(false);
      expect(getQuizSelectionAnswer(question, 0)).toBe('');
    }
  );

  it('keeps single-choice labels and rejects malformed or unavailable selection/key shapes', () => {
    const question = { type: 'single_choice', options: ['一', '二', '三', '四'], answer: 'C' };
    expect(getQuizSelectionAnswer(question, 2)).toBe('C');
    expect(isCorrectQuizSelection(question, 2)).toBe(true);
    expect(isCorrectQuizSelection(question, 0)).toBe(false);
    for (const selection of [null, undefined, [], [2], -1, 4, NaN, Infinity, '2', 0.5]) {
      expect(getQuizSelectionAnswer(question, selection)).toBe('');
      expect(isCorrectQuizSelection(question, selection)).toBe(false);
    }
    for (const answer of ['', 'C is correct', 'AC', 'Z']) {
      expect(isCorrectQuizSelection({ ...question, answer }, 2)).toBe(false);
    }
    for (const selection of [[], [0, 0], [0, 4], ['0'], [0.5]]) {
      expect(getQuizSelectionAnswer({ ...question, type: 'multi_choice' }, selection)).toBe('');
    }
    expect(getQuizSelectionAnswer({ ...question, type: 'translation' }, 2)).toBe('');
    expect(getQuizSelectionAnswer(null, 0)).toBe('');
  });

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

  it('normalizes paper metadata and reading passage context for paper questions', () => {
    const question = normalizeQuizQuestion(
      {
        id: 'english1-2025-text1-21',
        question: 'What is the main idea of Text 1?',
        passage: 'Text 1 full reading passage.',
        answer: 'B',
        paperId: 'english1-2025',
        paperName: '2025考研英语一真题',
        section: '阅读理解 Text 1',
        groupId: 'text1'
      },
      0
    );

    expect(question).toMatchObject({
      passage: 'Text 1 full reading passage.',
      passageSegments: ['Text 1 full reading passage.'],
      context: 'Text 1 full reading passage.',
      material: 'Text 1 full reading passage.',
      paperId: 'english1-2025',
      paperName: '2025考研英语一真题',
      section: '阅读理解 Text 1',
      groupId: 'text1'
    });
  });

  it('preserves fixed sequence metadata for paragraph-ordering papers', () => {
    const question = normalizeQuizQuestion(
      {
        id: 'english1-2011-041',
        question: '段落排序第 41 空',
        passage: 'G -> 41 -> 42 -> E -> 43 -> 44 -> 45',
        fixedSequence: ['G', '41', '42', 'E', '43', '44', '45'],
        fixedParagraphs: ['G', 'E'],
        options: ['A. Paragraph A', 'B. Paragraph B'],
        answer: 'B'
      },
      0
    );

    expect(question.fixedSequence).toEqual(['G', '41', '42', 'E', '43', '44', '45']);
    expect(question.fixedParagraphs).toEqual(['G', 'E']);
    expect(question.options).toEqual(['Paragraph A', 'Paragraph B']);
  });

  it('preserves rendered PDF page image metadata for math paper cards', () => {
    const question = normalizeQuizQuestion(
      {
        id: 'math1-2025-017',
        question: '2025考研数学一第17题。题干、公式和图形以试卷原页图为准。',
        answer: '3/10 ln 2 + pi/10',
        type: 'short_answer',
        questionImages: [{ src: '/static/question-bank/math1-2025/paper-page-04.jpg', caption: '试卷原页 p.4' }],
        answerImages: [{ src: '/static/question-bank/math1-2025/answer-page-10.jpg', caption: '答案速查 p.10' }]
      },
      0
    );

    expect(question.questionImages).toEqual([
      expect.objectContaining({ src: '/static/question-bank/math1-2025/paper-page-04.jpg' })
    ]);
    expect(question.answerImages).toEqual([
      expect.objectContaining({ src: '/static/question-bank/math1-2025/answer-page-10.jpg' })
    ]);
    expect(isQuizFlashcardMode(question)).toBe(true);
  });

  it('splits long reading passages into tappable evidence segments', () => {
    const question = normalizeQuizQuestion(
      {
        id: 'english1-2025-text2-26',
        question: 'What surprised the author?',
        passage:
          'Scientists often defend energy-intensive work. The author noticed a different attitude in recent debates. Some researchers suggested reducing their work rather than improving infrastructure.\n\nLUMI offers a cleaner model. It uses low-carbon power and reuses heat for the surrounding city.'
      },
      0
    );

    expect(question.passageSegments).toEqual([
      'Scientists often defend energy-intensive work. The author noticed a different attitude in recent debates. Some researchers suggested reducing their work rather than improving infrastructure.',
      'LUMI offers a cleaner model. It uses low-carbon power and reuses heat for the surrounding city.'
    ]);
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
    expect(question.options).toEqual(['Alpha', 'Beta', 'Gamma', 'Delta']);
    expect(question.difficulty).toBe(3);
    expect(getQuizOptionLabel(question, 0)).toBe('A');
    expect(getQuizOptionLabel({ options: ['B. Beta'] }, 0)).toBe('B');
    expect(isCorrectQuizOption(question, 2)).toBe(true);
    expect(isCorrectQuizOption(question, 1)).toBe(false);
  });

  it('strips embedded option labels because the quiz UI renders labels separately', () => {
    const question = normalizeQuizQuestion(
      {
        id: 'choice_002',
        question: 'Which one is correct?',
        options: ['A. Alpha', 'B、Beta', 'C：Gamma', 'D) Delta'],
        answer: 'D'
      },
      0
    );

    expect(question.options).toEqual(['Alpha', 'Beta', 'Gamma', 'Delta']);
    expect(getQuizOptionLabel(question, 3)).toBe('D');
    expect(isCorrectQuizOption(question, 3)).toBe(true);
  });

  it('normalizes object-shaped options before rendering', () => {
    const question = normalizeQuizQuestion(
      {
        id: 'choice_003',
        question: 'Which one is correct?',
        options: [{ label: 'A', text: 'Alpha' }, { text: 'Beta' }, { value: 'Gamma' }, { content: 'Delta' }],
        answer: 'B'
      },
      0
    );

    expect(question.options).toEqual(['Alpha', 'Beta', 'Gamma', 'Delta']);
    expect(getQuizOptionLabel(question, 1)).toBe('B');
    expect(isCorrectQuizOption(question, 1)).toBe(true);
  });

  it('preserves multi-choice answer labels while normalizing single-choice answers', () => {
    expect(
      normalizeQuizAnswer({
        type: 'multi_choice',
        answer: 'C A C',
        options: ['A. Alpha', 'B. Beta', 'C. Gamma', 'D. Delta']
      })
    ).toBe('AC');
    expect(
      normalizeQuizQuestion(
        {
          id: 'multi_001',
          question: 'Select all correct options',
          type: 'multi_choice',
          answer: 'AC',
          options: ['A. Alpha', 'B. Beta', 'C. Gamma', 'D. Delta']
        },
        0
      ).answer
    ).toBe('AC');
    expect(normalizeQuizAnswer({ type: 'single_choice', answer: 'C. Gamma' })).toBe('C');

    const question = normalizeQuizQuestion(
      {
        id: 'multi_002',
        question: 'Select all correct options',
        type: 'multi_choice',
        answer: 'CA',
        options: ['A. Alpha', 'B. Beta', 'C. Gamma', 'D. Delta']
      },
      0
    );
    expect(question.answer).toBe('AC');
    expect(isCorrectQuizOption(question, 0)).toBe(true);
    expect(isCorrectQuizOption(question, 1)).toBe(false);
    expect(isCorrectQuizOption(question, 2)).toBe(true);
  });

  it('keeps numeric zero as the answer identity without merging an empty-id record', () => {
    const record = buildQuizAnswerRecord({ question: { id: 0 }, index: 0, userChoice: 0, source: 'reference_match' });
    expect(record.questionId).toBe(0);
    const rows = upsertQuizAnswerRecord([{ questionId: '', index: 0, userChoice: 1 }], record);
    expect(rows).toHaveLength(2);
    expect(rows[1].questionId).toBe(0);
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

    expect(summary).toMatchObject({
      total: 4,
      currentIndex: 2,
      answeredCount: 3,
      gradedCount: 0,
      correctCount: 0,
      wrongCount: 0,
      neutralCount: 3,
      pendingCount: 0,
      reviewedCount: 0,
      unclassifiedCount: 1,
      legacyCorrectCount: 1,
      legacyWrongCount: 1,
      legacyAccuracy: 50,
      progressRate: 0.75,
      accuracy: null
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

    expect(content).toBe('本次已记录 3 题，2 题旧记录，1 题判分依据不明');
  });

  it('uses diagnosis states when building completion content', () => {
    expect(
      buildQuizCompletionContent({
        questions: [{ id: 'q1' }],
        answeredQuestions: [{ questionId: 'q1', index: 0, isCorrect: true }],
        diagnosisLoading: true
      })
    ).toBe('本次已记录 1 题，1 题旧记录');

    expect(
      buildQuizCompletionContent({
        questions: [{ id: 'q1' }],
        answeredQuestions: [{ questionId: 'q1', index: 0, isCorrect: true }],
        diagnosisReady: true,
        diagnosisSummary: '稳定掌握'
      })
    ).toBe('本次已记录 1 题，1 题旧记录');
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
    const translation = normalizeQuizQuestion(
      {
        id: 'english1-2025-046',
        question: 'Translate sentence 46 into Chinese.',
        answer: '参考译文',
        type: 'translation',
        options: ['A. 不应显示']
      },
      2,
      { fillMissingChoiceOptions: true }
    );

    expect(getQuizQuestionTypeLabel(translation)).toBe('翻译题');
    expect(isQuizFlashcardMode(translation)).toBe(true);
    expect(hasQuizSelectableOptions(translation)).toBe(false);
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
      summary: '薄弱点，当前掌握 42%，已记录到复习计划'
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
      summary: '待点亮，当前掌握 0%，已记录到复习计划'
    });
  });
});
