import { describe, expect, it } from 'vitest';

import { adaptCard, importFlashcardsToBank } from '@/utils/flashcard-adapter.js';
import { prepareQuizQuestion, createSinglePracticeHandoff } from '@/services/quiz-session-contract.js';

describe('flashcard adapter', () => {
  it('captures object options, numeric reference, reading, media and provenance before display formatting', () => {
    const raw = {
      id: 0,
      question: '按照完整原材料选择。',
      options: [
        { label: 'A', text: '甲', page: 2 },
        { label: 'B', text: '乙', page: 3 }
      ],
      answer: 1,
      type: 'single_choice',
      passage: '完整原材料',
      audio: { transcript: '原音频文字' },
      source: { title: '原来源', page: 4 },
      sourceLicense: { status: 'unknown' },
      question_version: 9,
      questionImages: [{ src: 'question-bank/paper/page.png', caption: '原页', crop: [1, 2, 3, 4] }]
    };
    const before = JSON.stringify(raw),
      card = adaptCard(raw);
    expect(card.answer).toBe('B');
    expect(card.options).toEqual(['甲', '乙']);
    const { id: _id, ...fields } = raw;
    expect(card.quizOriginal.fields).toMatchObject(fields);
    expect(card.quizOriginal.fields).not.toHaveProperty('id');
    expect(card.quizOriginal.id).toBe(0);
    expect(JSON.stringify(raw)).toBe(before);
    const prepared = prepareQuizQuestion(card);
    expect(prepared).not.toBeNull();
    expect(createSinglePracticeHandoff(prepared, 'owner').question.quizOriginal).toEqual(card.quizOriginal);
  });
  it.each(['missing-answer', 'wrong-label', 'duplicate-id', 'credentials'])(
    'preflights all cards and refuses %s without mutating a bank or writing',
    (damage) => {
      const cards = [
        { id: 0, question: '原题正文', options: ['甲', '乙'], answer: 'B' },
        { id: 'two', question: '第二题正文', options: ['甲', '乙'], answer: 'A' }
      ];
      if (damage === 'missing-answer') delete cards[1].answer;
      if (damage === 'wrong-label')
        cards[1].options = [
          { label: 'B', text: '甲' },
          { label: 'A', text: '乙' }
        ];
      if (damage === 'duplicate-id') cards[1].id = 0;
      if (damage === 'credentials') cards[1].source = { api_key: 'synthetic-only' };
      const old = [{ id: 'keep', question: '原有题目', options: ['甲', '乙'], answer: 'A' }];
      const before = JSON.stringify(old),
        writes = [];
      const storage = {
        get: () => old,
        set: (...args) => {
          writes.push(args);
          return true;
        }
      };
      expect(() => importFlashcardsToBank({ cards }, storage)).toThrow();
      expect(JSON.stringify(old)).toBe(before);
      expect(writes).toEqual([]);
    }
  );
  it('preserves explicit parent import context without inventing question source, answer or id', () => {
    const raw = { id: 'card', question: '原题', options: ['甲', '乙'], answer: 'A' };
    const context = {
      paperId: 'parent-paper',
      source: { title: '父级资料' },
      sourceLicense: '父级许可待核对',
      year: '2025'
    };
    const card = adaptCard(raw, context);
    expect(card.quizOriginal.fields.importContext).toEqual(context);
    expect(card.quizOriginal.fields.source).toBeUndefined();
    expect(card.paperId).toBe('parent-paper');
    expect(prepareQuizQuestion(card)).not.toBeNull();
  });
  it.each(['other-paper', 'duplicate-existing'])('does not overwrite %s records when ids collide', (damage) => {
    const old = [{ id: 0, paperId: 'old-paper', question: '原题', options: ['甲', '乙'], answer: 'A' }];
    if (damage === 'duplicate-existing') old.push({ ...old[0] });
    const before = JSON.stringify(old),
      writes = [];
    const storage = {
      get: () => old,
      set: (...args) => {
        writes.push(args);
        return true;
      }
    };
    expect(() =>
      importFlashcardsToBank({ cards: [{ id: 0, question: '新题', options: ['甲', '乙'], answer: 'B' }] }, storage, {
        paperId: damage === 'other-paper' ? 'new-paper' : 'old-paper'
      })
    ).toThrow('SOURCE_ID_CONFLICT');
    expect(JSON.stringify(old)).toBe(before);
    expect(writes).toEqual([]);
  });
  it('does not mutate the stored bank through a returned reference when saving fails', () => {
    const old = [{ id: 'same', question: '保留原题', options: ['甲', '乙'], answer: 'B' }];
    const before = JSON.stringify(old);
    const storage = { get: () => old, set: () => false };
    expect(() => importFlashcardsToBank({ cards: [{ ...old[0], question: '替换的新题' }] }, storage)).toThrow(
      'BANK_SAVE_FAILED'
    );
    expect(JSON.stringify(old)).toBe(before);
  });
  it('does not return an import success when the persisted readback differs', () => {
    const storage = { get: () => [], set: () => true };
    expect(() =>
      importFlashcardsToBank(
        { cards: [{ id: 0, question: '完整新题正文', options: ['甲', '乙'], answer: 'B' }] },
        storage
      )
    ).toThrow('BANK_SAVE_UNCONFIRMED');
  });
  it('preserves complete multi-choice answers when importing flashcards', () => {
    const card = adaptCard({
      id: 'politics-2025-017',
      type: 'multi_choice',
      question: 'Select all correct options',
      options: [
        { label: 'A', text: 'Alpha' },
        { label: 'B', text: 'Beta' },
        { label: 'C', text: 'Gamma' },
        { label: 'D', text: 'Delta' }
      ],
      answer: 'AC',
      explanation: 'A and C are correct.'
    });

    expect(card.answer).toBe('AC');
    expect(card.type).toBe('multi_choice');
    expect(card.options).toEqual(['Alpha', 'Beta', 'Gamma', 'Delta']);
  });

  it('normalizes text-only option objects without leaving punctuation prefixes', () => {
    const card = adaptCard({
      id: 'english1-option-object',
      type: 'single_choice',
      question: 'Choose the best answer.',
      options: [{ text: 'among' }, { text: 'between' }, { value: 'across' }, { content: 'behind' }],
      answer: 'A'
    });

    expect(card.options).toEqual(['among', 'between', 'across', 'behind']);
  });

  it('preserves passage and paper metadata for year-based papers', () => {
    const card = adaptCard(
      {
        id: 'english1-2025-text1-21',
        number: 21,
        type: 'single_choice',
        question: 'What is the main idea of Text 1?',
        passage: 'Text 1 full reading passage.',
        passageSegments: ['Text 1 full reading passage.'],
        options: ['A. One', 'B. Two', 'C. Three', 'D. Four'],
        answer: 'B',
        section: '阅读理解 Text 1',
        groupId: 'text1'
      },
      {
        paperId: 'english1-2025',
        paperName: '2025考研英语一真题',
        subject: '英语',
        year: '2025'
      }
    );

    expect(card).toMatchObject({
      number: 21,
      passage: 'Text 1 full reading passage.',
      passageSegments: ['Text 1 full reading passage.'],
      context: 'Text 1 full reading passage.',
      material: 'Text 1 full reading passage.',
      paperId: 'english1-2025',
      paperName: '2025考研英语一真题',
      section: '阅读理解 Text 1',
      groupId: 'text1',
      category: '英语',
      year: '2025'
    });
  });

  it('preserves fixed paragraph sequence metadata for ordering questions', () => {
    const card = adaptCard({
      id: 'english1-2011-041',
      number: 41,
      type: 'single_choice',
      question: '段落排序第 41 空',
      passage: 'G -> 41 -> 42 -> E -> 43 -> 44 -> 45',
      fixedSequence: ['G', '41', '42', 'E', '43', '44', '45'],
      fixedParagraphs: ['G', 'E'],
      options: [
        { label: 'A', text: 'Paragraph A' },
        { label: 'B', text: 'Paragraph B' }
      ],
      answer: 'B'
    });

    expect(card.fixedSequence).toEqual(['G', '41', '42', 'E', '43', '44', '45']);
    expect(card.fixedParagraphs).toEqual(['G', 'E']);
  });

  it('keeps translation cards in evidence-only mode without fake choice options', () => {
    const card = adaptCard(
      {
        id: 'english1-2025-046',
        type: 'translation',
        question: 'Translate sentence 46 into Chinese.',
        passage: 'Full Part C material.',
        targetSegment: 'Sentence 46 to translate.',
        answer: '参考译文'
      },
      {
        paperId: 'english1-2025',
        paperName: '2025考研英语一真题',
        subject: '英语',
        year: '2025'
      }
    );

    expect(card.type).toBe('translation');
    expect(card.options).toEqual([]);
    expect(card.answer).toBe('参考译文');
    expect(card.passage).toBe('Full Part C material.');
    expect(card.targetSegment).toBe('Sentence 46 to translate.');
  });

  it('preserves PDF page images for formula-heavy math papers', () => {
    const card = adaptCard(
      {
        id: 'math1-2025-017',
        number: 17,
        type: 'short_answer',
        question: '2025考研数学一第17题。题干、公式和图形以试卷原页图为准。',
        answer: '3/10 ln 2 + pi/10',
        explanation: '完整演算过程见答案原页图。',
        questionImages: [
          {
            src: 'question-bank/math1-2025/paper-page-04.jpg',
            caption: '试卷原页 p.4'
          }
        ],
        answerImages: ['question-bank/math1-2025/answer-page-10.jpg']
      },
      {
        paperId: 'math1-2025',
        paperName: '2025考研数学一真题',
        subject: '数学',
        year: '2025'
      }
    );

    expect(card.type).toBe('short_answer');
    expect(card.options).toEqual([]);
    expect(card.questionImages).toEqual([
      expect.objectContaining({
        src: 'question-bank/math1-2025/paper-page-04.jpg',
        caption: '试卷原页 p.4'
      })
    ]);
    expect(card.answerImages).toEqual([
      expect.objectContaining({
        src: 'question-bank/math1-2025/answer-page-10.jpg'
      })
    ]);
  });

  it('updates an already imported paper card so stale local bank data does not block practice', () => {
    const state = {
      v30_bank: [
        {
          id: 'english1-2011-021',
          question: 'Old question text',
          options: ['A. old'],
          answer: 'A',
          paperId: 'english1-2011',
          last_attempt_at: 1763650000000
        }
      ]
    };
    const storage = {
      get: (key) => state[key] || [],
      set: (key, value) => {
        state[key] = value;
        return true;
      }
    };

    const result = importFlashcardsToBank(
      {
        id: 'english1-2011',
        name: '2011考研英语一真题',
        subject: '英语',
        year: '2011',
        cards: [
          {
            id: 'english1-2011-021',
            number: 21,
            type: 'single_choice',
            question: 'Updated question text',
            options: [
              { label: 'A', text: 'Alpha' },
              { label: 'B', text: 'Beta' },
              { label: 'C', text: 'Gamma' },
              { label: 'D', text: 'Delta' }
            ],
            answer: 'B',
            passage: 'Full passage.'
          }
        ]
      },
      storage,
      { paperId: 'english1-2011', paperName: '2011考研英语一真题', subject: '英语' }
    );

    expect(result).toMatchObject({ imported: 0, updated: 1, skipped: 0, total: 1 });
    expect(state.v30_bank[0]).toMatchObject({
      question: 'Updated question text',
      options: ['Alpha', 'Beta', 'Gamma', 'Delta'],
      answer: 'B',
      passage: 'Full passage.',
      last_attempt_at: 1763650000000
    });
  });
});
