import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import {
  recordQuizLearningAttempt,
  recordQuizLearningObservation,
  quizReferenceObservationExists
} from '@/services/learning/quiz-learning-bridge.js';
import storageService from '@/services/storageService.js';
import { learningWriteLease } from '@/services/learning/learning-write-lease.js';
import { updateMistakeWithAI } from '@/pages/practice-sub/quiz-mistake-handler.js';
import { learningRepository } from '@/services/learning/learning-repository.js';
import { materialFingerprint } from '@/services/learning/material-intake.js';
import {
  applyLearningOperation,
  gradeAnswer,
  normalizePrivateSyncOperation,
  emptyLearningState
} from '@/services/learning/learning-domain.js';
import { deriveAlgebraQuestion } from '../../laf-backend/functions/_shared/learning-algebra.js';
import { normalizeLegacyReviewQuestion, normalizeQuizQuestion } from '@/services/quiz-session-contract.js';
import { adaptCard } from '@/utils/flashcard-adapter.js';
import { prepareQuizQuestion } from '@/services/quiz-session-contract.js';

const question = () => ({
  id: 'original-reading',
  question: '请选择原文出现的两项。',
  options: ['月亮', '太阳', '小河', '雪山'],
  type: 'multi_choice',
  answer: 'AC',
  desc: '历史参考待核对。',
  passage: 'The moon shone over a quiet river.\n\nThe bridge was empty.',
  passageSegments: ['The moon shone over a quiet river.', 'The bridge was empty.'],
  targetSegment: 'The bridge was empty.',
  questionImages: [{ src: '/static/private-original.png', caption: '原题附图' }],
  audio: { src: '/static/private-original.mp3', transcript: 'The moon shone.' },
  source: { title: '合成原件', page: 2, locator: { section: '阅读', paragraph: 1 } },
  sourceSha256: 'a'.repeat(64),
  sourceEvidenceId: 'private-synthetic-reading',
  sourceLicense: '本轮原创合成材料',
  question_version: 1,
  wrong_count: 3,
  is_mastered: false
});
const input = (q = question(), attemptId = 'quiz_answer_reading') => ({
  currentQuestion: q,
  userAnswer: 'AC',
  sessionId: 'original_reading',
  attemptId
});
beforeEach(() => uni.clearStorageSync());
afterEach(() => vi.restoreAllMocks());

it('imported labelled objects and numeric references remain exact private originals in an explicit pending answer and replay', async () => {
  const raw = {
    id: 0,
    question: '按原资料选择。',
    type: 'single_choice',
    options: [
      { label: 'A', text: '甲', page: 1 },
      { label: 'B', text: '乙', page: 2 }
    ],
    answer: 1,
    passage: '完整原文',
    source: { title: '原来源' },
    sourceLicense: { status: 'unknown' },
    question_version: 4
  };
  const q = prepareQuizQuestion(adaptCard(raw, { paperId: 'import-paper', source: { title: '文件来源' } }));
  expect(q).not.toBeNull();
  await recordQuizLearningAttempt({
    currentQuestion: q,
    userAnswer: 'B',
    sessionId: 'object_original',
    attemptId: 'quiz_answer_object'
  });
  const state = learningRepository.read();
  expect(state.attempts).toHaveLength(1);
  expect(state.attempts[0].grade.status).toBe('pending');
  expect(state.reviews).toEqual([]);
  expect(state.questions[0].quizOriginal.fields.options).toEqual(raw.options);
  expect(state.questions[0].quizOriginal.fields.answer).toBe(1);
  expect(state.questions[0].quizOriginal.fields.sourceLicense).toEqual(raw.sourceLicense);
  await recordQuizLearningAttempt({
    currentQuestion: q,
    userAnswer: 'B',
    sessionId: 'object_original',
    attemptId: 'quiz_answer_object'
  });
  expect(learningRepository.read().attempts).toHaveLength(1);
  expect(learningRepository.read().questions[0].quizOriginal).toEqual(state.questions[0].quizOriginal);
});
it.each(['options', 'source', 'answer', 'passage'])(
  'import display cannot replace its %s while retaining a trusted original',
  (field) => {
    const card = adaptCard({
      id: 'imported',
      question: '原题',
      options: [
        { label: 'A', text: '甲' },
        { label: 'B', text: '乙' }
      ],
      answer: 1,
      source: { title: '原来源' },
      passage: '原材料'
    });
    const value = { options: ['甲', '替换选项'], source: { title: '替换来源' }, answer: 'A', passage: '替换材料' }[
      field
    ];
    expect(prepareQuizQuestion({ ...card, [field]: value })).toBeNull();
  }
);

it('reference viewing and self assessment persist in the same core without raw answers, grades or reviews', async () => {
  const q = normalizeQuizQuestion({ ...question(), id: 0, type: 'analysis', options: [], answer: '原参考正文' });
  const input = {
    currentQuestion: q,
    sessionId: 'quiz_observation',
    observationId: 'view-original',
    kind: 'reference_view'
  };
  storageService.save('fsrs_card_0', { due: 7, reps: 9 }, true);
  uni.setStorageSync('fsrs_review_count', '49');
  await recordQuizLearningObservation(input);
  const viewed = learningRepository.read();
  expect(viewed.attempts).toEqual([]);
  expect(viewed.reviews).toEqual([]);
  expect(viewed.conversations[0].pendingHints).toHaveLength(1);
  const accepted = JSON.stringify(viewed);
  expect(quizReferenceObservationExists({ ...input })).toBe(true);
  expect(quizReferenceObservationExists({ ...input, currentQuestion: { ...q, question: '被改写的题干' } })).toBe(false);
  await expect(recordQuizLearningObservation(input)).resolves.toMatchObject({ reused: true });
  expect(JSON.stringify(learningRepository.read())).toBe(accepted);
  await recordQuizLearningObservation({
    ...input,
    kind: 'self_rating',
    rating: 3,
    referenceId: input.observationId,
    observationId: 'self-original'
  });
  const rated = learningRepository.read();
  let replay = emptyLearningState(rated.owner, rated.timezone);
  for (const event of rated.events) replay = applyLearningOperation(replay, normalizePrivateSyncOperation(event)).state;
  expect(replay.questions).toEqual(rated.questions);
  expect(replay.conversations).toEqual(rated.conversations);
  expect(replay.attempts).toEqual(rated.attempts);
  expect(replay.reviews).toEqual(rated.reviews);
  expect(replay.events.find((e) => e.type === 'question.add').data.question.publishable).toBe(false);
  expect(rated.conversations[0].messages).toHaveLength(2);
  expect(rated.conversations[0].messages[1].content).toContain('记忆自评：记得');
  expect(rated.questions[0].quizOriginal).toEqual(q.quizOriginal);
  expect(rated.questions[0].validation).toBeNull();
  expect(rated.attempts).toEqual([]);
  expect(rated.reviews).toEqual([]);
  expect(storageService.get('fsrs_card_0')).toEqual({ due: 7, reps: 9 });
  expect(uni.getStorageSync('fsrs_review_count')).toBe('49');
  await expect(
    recordQuizLearningObservation({
      ...input,
      kind: 'self_rating',
      rating: 4,
      referenceId: input.observationId,
      observationId: 'self-original'
    })
  ).rejects.toMatchObject({ code: 'CONFLICT' });
  expect(learningRepository.read()).toEqual(rated);
});

it.each(['missing-reference', 'altered-original', 'stopped', 'save-failure'])(
  'reference observation %s keeps accepted facts and never invents an answer',
  async (damage) => {
    const q = normalizeQuizQuestion({ ...question(), type: 'analysis', options: [], answer: '原参考' });
    const input = {
      currentQuestion: q,
      sessionId: 'quiz_observation',
      observationId: 'view-original',
      kind: 'reference_view'
    };
    await recordQuizLearningObservation(input);
    if (damage === 'stopped')
      learningRepository.commit({
        id: 'stop-observation',
        type: 'task.stop',
        data: { conversationId: 'quiz_quiz_observation' }
      });
    const before = learningRepository.read();
    if (damage === 'altered-original') q.passage = '其他原文';
    if (damage === 'save-failure') vi.spyOn(storageService, 'save').mockReturnValue(false);
    await expect(
      recordQuizLearningObservation({
        ...input,
        observationId: 'new-self',
        kind: 'self_rating',
        rating: 2,
        referenceId: damage === 'missing-reference' ? 'other-view' : input.observationId
      })
    ).rejects.toBeDefined();
    expect(learningRepository.read()).toEqual(before);
  }
);

it('an observation waiting for a write lease rejects an owner switch without copying private originals', async () => {
  uni.setStorageSync('EXAM_USER_ID', 'observer-a');
  let release;
  vi.spyOn(learningWriteLease, 'waitUntilWritable').mockImplementation(
    () =>
      new Promise((r) => {
        release = r;
      })
  );
  const pending = recordQuizLearningObservation({
    currentQuestion: normalizeQuizQuestion(question()),
    sessionId: 'quiz_owner',
    observationId: 'owner-view',
    kind: 'reference_view'
  });
  uni.setStorageSync('EXAM_USER_ID', 'observer-b');
  const before = JSON.stringify(global.__mockStorage);
  release();
  await expect(pending).rejects.toMatchObject({ code: 'CONTEXT_CHANGED' });
  expect(JSON.stringify(global.__mockStorage)).toBe(before);
});

it('late legacy AI suggestions do not overwrite an old original or its answer/counts', () => {
  const old = { ...question(), analysis: '原解析', user_answer: 'B', wrong_count: 7 };
  storageService.save('mistake_book', [old], true);
  const before = JSON.stringify(global.__mockStorage);
  expect(updateMistakeWithAI({ currentQuestion: question(), aiAnalysis: '未经核对的新解析' })).toMatchObject({
    success: false,
    code: 'ORIGINAL_IMMUTABLE'
  });
  expect(JSON.stringify(global.__mockStorage)).toBe(before);
});

it('captures raw labels, type, reference and image metadata before handoff/display normalization', async () => {
  const raw = {
    _id: 'raw-format',
    question_content: '请选择原题中的两项。',
    options: ['A. 月亮', 'B. 太阳', 'C. 小河'],
    type: '多选',
    correct_answer: 'A,C',
    questionImages: [{ url: '/static/original.png', caption: '原来的图片说明' }],
    passage: 'Moon and river.',
    analysis: '原来的解析',
    description: '额外保存的说明'
  };
  const before = JSON.stringify(raw);
  const displayed = normalizeQuizQuestion(normalizeLegacyReviewQuestion(raw));
  expect(displayed.options).toEqual(['月亮', '太阳', '小河']);
  await recordQuizLearningAttempt(input(displayed));
  const fields = learningRepository.read().questions[0].quizOriginal.fields;
  for (const key of [
    'question_content',
    'options',
    'type',
    'correct_answer',
    'questionImages',
    'passage',
    'analysis',
    'description'
  ])
    expect(fields[key]).toEqual(raw[key]);
  expect(JSON.stringify(raw)).toBe(before);
});

it('rejects a changed display paired with a stale captured original before replay or partial writes', async () => {
  const displayed = normalizeQuizQuestion(question());
  await recordQuizLearningAttempt(input(displayed));
  const before = learningRepository.read();
  await expect(recordQuizLearningAttempt(input({ ...displayed, question: '被改动的显示题干' }))).rejects.toBeDefined();
  expect(learningRepository.read()).toEqual(before);
  await expect(
    recordQuizLearningAttempt(input({ ...displayed, options: ['其他甲', '其他乙'] }, 'quiz_answer_other_display'))
  ).rejects.toBeDefined();
  expect(learningRepository.read()).toEqual(before);
});

it.each(['passage', 'source', 'sourceLicense', 'questionImages', 'audio'])(
  'a stale captured original rejects altered displayed %s without changing an accepted answer',
  async (field) => {
    const displayed = normalizeQuizQuestion(question());
    await recordQuizLearningAttempt(input(displayed));
    const before = learningRepository.read();
    await expect(
      recordQuizLearningAttempt(input({ ...displayed, [field]: field === 'questionImages' ? [] : '其他资料' }))
    ).rejects.toMatchObject({ code: 'SOURCE_MISMATCH' });
    expect(learningRepository.read()).toEqual(before);
  }
);

it.each(['question_content', 'content', 'title'])(
  'keeps a raw %s body instead of a placeholder while storing its original name',
  async (field) => {
    const raw = {
      id: 'raw-body-' + field,
      [field]: '真实原题正文。',
      options: ['A. 甲', 'B. 乙'],
      answer: 'B',
      images: [{ src: '/static/original.png' }]
    };
    const displayed = normalizeQuizQuestion(raw);
    expect(displayed.question).toBe(raw[field]);
    expect(displayed.questionImages).toHaveLength(1);
    await recordQuizLearningAttempt({ ...input(displayed), userAnswer: 'B' });
    expect(learningRepository.read().questions[0].quizOriginal.fields[field]).toBe(raw[field]);
  }
);

it('a choice placeholder cannot turn an incomplete source into stored question facts', async () => {
  const displayed = normalizeQuizQuestion(
    { id: 'incomplete-options', question: '没有完整选项的原题。', options: [], answer: 'A' },
    0,
    { fillMissingChoiceOptions: true }
  );
  const before = JSON.stringify(global.__mockStorage);
  await expect(recordQuizLearningAttempt(input(displayed))).rejects.toMatchObject({ code: 'SOURCE_MISMATCH' });
  expect(JSON.stringify(global.__mockStorage)).toBe(before);
});

it('preserves complete original reading, target, media and source claims without granting grading authority', async () => {
  const q = question(),
    before = JSON.stringify(q);
  await recordQuizLearningAttempt(input(q));
  const saved = learningRepository.read();
  expect(saved.questions[0].quizOriginal?.fields).toMatchObject({
    passage: q.passage,
    passageSegments: q.passageSegments,
    targetSegment: q.targetSegment,
    questionImages: q.questionImages,
    audio: q.audio,
    source: q.source,
    sourceSha256: q.sourceSha256,
    sourceLicense: q.sourceLicense,
    question_version: 1,
    answer: 'AC'
  });
  expect(saved.questions[0].validation).toBeNull();
  expect(saved.attempts[0].grade.status).toBe('pending');
  expect(saved.reviews).toEqual([]);
  expect(JSON.stringify(q)).toBe(before);
});

it.each(['passage', 'targetSegment', 'questionImages', 'sourceSha256', 'sourceLicense', 'question_version', 'answer'])(
  'a changed %s creates another question version while old raw answers remain bound',
  async (field) => {
    const q = question();
    await recordQuizLearningAttempt(input(q));
    const original = learningRepository.read().attempts[0];
    const changed = { ...q, [field]: field === 'question_version' ? 2 : field === 'questionImages' ? [] : '改变了' };
    await recordQuizLearningAttempt(input(changed, 'quiz_answer_changed'));
    const saved = learningRepository.read();
    expect(saved.questions).toHaveLength(2);
    expect(saved.questions[1].version).toBe(2);
    expect(saved.attempts[0]).toEqual(original);
    expect(saved.attempts[1].questionKey).not.toBe(original.questionKey);
    expect(saved.attempts.every((a) => a.grade.status === 'pending')).toBe(true);
  }
);

it('a changed original cannot reuse an accepted attempt identifier or write partial facts', async () => {
  const q = question();
  await recordQuizLearningAttempt(input(q));
  const before = learningRepository.read();
  await expect(recordQuizLearningAttempt(input({ ...q, passage: '替换材料' }))).rejects.toMatchObject({
    code: 'CONFLICT'
  });
  expect(learningRepository.read()).toEqual(before);
});

it('counters and view hints do not change question identity, and reordered source keys reuse the complete version', async () => {
  const q = question();
  await recordQuizLearningAttempt(input(q));
  await recordQuizLearningAttempt(
    input(
      {
        ...q,
        wrong_count: 99,
        is_mastered: true,
        source: { locator: { paragraph: 1, section: '阅读' }, page: 2, title: '合成原件' },
        legacyReviewContext: { contract: 'legacy-review-view-v1', referenceViewed: true }
      },
      'quiz_answer_same_original'
    )
  );
  const saved = learningRepository.read();
  expect(saved.questions).toHaveLength(1);
  expect(saved.attempts[1].hints).toHaveLength(1);
  expect(saved.questions[0].quizOriginal).toBeDefined();
});

it('old partial receipts replay unchanged, and a new attempt receives a separate complete version', async () => {
  const q = question(),
    session = 'quiz_original_reading';
  const old = {
    id: 'bank_legacy_original-reading',
    version: 1,
    prompt: q.question,
    options: q.options,
    scope: 'legacy',
    source: {
      kind: 'existing_bank',
      sourceEvidenceId: q.sourceEvidenceId,
      fingerprint: materialFingerprint(JSON.stringify([q.question, q.options, q.sourceEvidenceId])),
      answerEvidenceStatus: 'unknown'
    },
    validation: null
  };
  learningRepository.commit({ id: session, type: 'conversation.start', data: { goal: '旧原答' } });
  learningRepository.commit({ id: 'old-add', type: 'question.add', data: { question: old } });
  learningRepository.commit({
    id: 'old-focus',
    type: 'question.focus',
    data: { conversationId: session, questionKey: `${old.id}@1` }
  });
  learningRepository.commit({
    id: 'quiz_answer_reading',
    type: 'attempt.submit',
    data: { conversationId: session, answer: 'AC', explicit: true }
  });
  const before = learningRepository.read();
  expect((await recordQuizLearningAttempt(input(q))).reused).toBe(true);
  expect(learningRepository.read()).toEqual(before);
  await recordQuizLearningAttempt(input(q, 'quiz_answer_new_complete'));
  const saved = learningRepository.read();
  expect(saved.questions).toHaveLength(2);
  expect(saved.questions[0]).toEqual(before.questions[0]);
  expect(saved.questions[1].quizOriginal?.fields.passage).toBe(q.passage);
  expect(saved.attempts[0]).toEqual(before.attempts[0]);
});

it('invalid oversized or credential-bearing source fails before any learning fact is written', async () => {
  for (const change of [
    { passage: 'x'.repeat(1_800_001) },
    { question: 'x'.repeat(8001) },
    { options: ['甲', { caption: '不是选项文字' }] },
    { source: { title: '原件', apiKey: 'not-a-real-key' } },
    { source: 'https://example.invalid/source?token=synthetic-private-token' },
    { source: 'https://example.invalid/source?%74oken=synthetic-private-token' },
    { source: 'https://synthetic:private@example.invalid/source' }
  ]) {
    const before = JSON.stringify(global.__mockStorage);
    await expect(recordQuizLearningAttempt(input({ ...question(), ...change }))).rejects.toBeDefined();
    expect(JSON.stringify(global.__mockStorage)).toBe(before);
  }
});

it.each(['prompt', 'scope', 'validation', 'options', 'id'])(
  'shared local and server contracts reject a forged %s while keeping existing records',
  async (field) => {
    await recordQuizLearningAttempt(input());
    const saved = learningRepository.read(),
      q = JSON.parse(JSON.stringify(saved.questions[0]));
    const changed = {
      ...q,
      [field]:
        field === 'validation'
          ? { type: 'choice', answer: 'AC', authority: 'human_reviewed', evidenceId: 'forged' }
          : field === 'options'
            ? ['改甲', '改乙']
            : field === 'scope'
              ? 'generated'
              : '改变了'
    };
    const operation = { id: 'forged-' + field, type: 'question.add', data: { question: changed } };
    expect(() => normalizePrivateSyncOperation(operation)).toThrow();
    expect(() => applyLearningOperation(saved, operation)).toThrow();
    expect(learningRepository.read()).toEqual(saved);
  }
);

it('a historical bank question stays pending even if its text resembles independently supported arithmetic', async () => {
  const q = {
    id: 'historical-algebra',
    question: '在实数范围内解方程 2*x+3=7，写出全部精确解。',
    type: 'analysis',
    options: [],
    answer: '2',
    passage: '原材料另有条件：x 不等于 2。来源待核对。'
  };
  expect(deriveAlgebraQuestion(q.question).validation).toBeTruthy();
  await recordQuizLearningAttempt({ ...input(q), userAnswer: '2' });
  const saved = learningRepository.read();
  expect(saved.questions[0].validation).toBeNull();
  const operation = saved.events.find((event) => event.type === 'question.add');
  expect(normalizePrivateSyncOperation(operation).data.question.validation).toBeNull();
  expect(saved.attempts[0].grade.status).toBe('pending');
  expect(gradeAnswer(saved.questions[0], '2')).toMatchObject({ status: 'pending' });
  expect(saved.reviews).toEqual([]);
});
