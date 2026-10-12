import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { TEMP_PRACTICE_QUESTIONS_KEY } from '@/services/quiz-session-contract.js';

const root = process.cwd();
const questionBankSource = fs.readFileSync(path.join(root, 'src/pages/practice-sub/question-bank.vue'), 'utf8');
const doQuizSource = fs.readFileSync(path.join(root, 'src/pages/practice-sub/do-quiz.vue'), 'utf8');

describe('question bank to quiz handoff', () => {
  it('stores random practice questions under the same key consumed by do-quiz', () => {
    expect(TEMP_PRACTICE_QUESTIONS_KEY).toBe('temp_practice_questions');
    expect(questionBankSource).toContain('TEMP_PRACTICE_QUESTIONS_KEY');
    expect(questionBankSource).toContain('getQuizQuestionId');
    expect(questionBankSource).toContain(':key="getQuizQuestionId(q) || idx"');
    expect(questionBankSource).toContain('id: getQuizQuestionId(q) || `qb_${i}`');
    expect(questionBankSource).not.toContain('v30_temp_practice');
    expect(questionBankSource).toContain('mode=temp_bank');
    expect(questionBankSource).toContain("safeNavigateTo('/pages/practice-sub/do-quiz?source=question-bank&mode=temp_bank')");
    expect(doQuizSource).toContain('TEMP_PRACTICE_QUESTIONS_KEY');
    expect(doQuizSource).toContain('getQuizQuestionId');
    expect(doQuizSource).toContain('id: getQuizQuestionId(q) || `temp_${index}`');
  });
});
