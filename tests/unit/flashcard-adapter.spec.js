import { describe, expect, it } from 'vitest';

import { adaptCard, importFlashcardsToBank } from '@/utils/flashcard-adapter.js';

describe('flashcard adapter', () => {
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
