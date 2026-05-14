import { describe, expect, it } from 'vitest';

import { adaptCard } from '@/utils/flashcard-adapter.js';

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
    expect(card.options).toEqual(['A. Alpha', 'B. Beta', 'C. Gamma', 'D. Delta']);
  });

  it('preserves passage and paper metadata for year-based papers', () => {
    const card = adaptCard(
      {
        id: 'english1-2025-text1-21',
        type: 'single_choice',
        question: 'What is the main idea of Text 1?',
        passage: 'Text 1 full reading passage.',
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
      passage: 'Text 1 full reading passage.',
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

  it('keeps translation cards in evidence-only mode without fake choice options', () => {
    const card = adaptCard(
      {
        id: 'english1-2025-046',
        type: 'translation',
        question: 'Translate sentence 46 into Chinese.',
        passage: 'Full Part C material.',
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
  });
});
