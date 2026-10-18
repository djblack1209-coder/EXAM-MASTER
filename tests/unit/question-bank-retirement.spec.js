import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { legacyQuestionView, retiredBankResponse } from '@/services/retired-question-bank.js';
import { createQuizOriginal } from '../../laf-backend/functions/_shared/learning-quiz-original.js';
import { auditRetiredBank } from '../../scripts/build/retired-bank-gate.mjs';
import { scanPublicBuild } from '../../scripts/build/ui-quality-gate.js';
import { buildReleaseBlockerBacklog } from '../../scripts/build/release-blocker-backlog.mjs';

const owned = [];
function directory() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'yozi-retirement-'));
  owned.push(dir);
  return dir;
}
afterEach(() => {
  for (const dir of owned.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

describe('public bank retirement', () => {
  it('reads a saved original without changing its answer, result or time', () => {
    const question = { id: 'own-1', question: '2 + 3 = ?', options: ['4', '5'], answer: 'B' };
    const record = {
      ...question,
      quizOriginal: createQuizOriginal(question),
      user_answer: 'A',
      is_correct: false,
      created_at: 123
    };
    const before = JSON.stringify(record);
    expect(legacyQuestionView(record)).toMatchObject({
      available: true,
      reviewable: true,
      prompt: question.question,
      answer: 'A',
      result: false,
      at: 123
    });
    expect(JSON.stringify(record)).toBe(before);
  });
  it('keeps a missing-original record unchanged and excludes it from review', () => {
    const record = { id: 'retired-1', question_id: 'old-bank-1', user_answer: 'C', is_correct: true, created_at: 456 };
    const before = JSON.stringify(record);
    expect(legacyQuestionView(record)).toMatchObject({
      available: false,
      reviewable: false,
      question: null,
      answer: 'C',
      result: true,
      at: 456
    });
    expect(JSON.stringify(record)).toBe(before);
  });
  it('preserves readable text even if the reference is insufficient for review', () => {
    expect(legacyQuestionView({ id: 'own-2', question: 'A saved prompt without an answer key' })).toMatchObject({
      available: true,
      reviewable: false
    });
  });
  it('returns an explicit retirement failure rather than an empty successful bank', () => {
    expect(retiredBankResponse()).toMatchObject({ success: false, code: 410, error: 'QUESTION_BANK_RETIRED' });
  });
  it('finds old images and compressed data in nested artifacts', () => {
    const dir = directory();
    const image = path.join(dir, 'static/question-bank/old/paper.jpg');
    fs.mkdirSync(path.dirname(image), { recursive: true });
    fs.writeFileSync(image, 'image');
    const table = path.join(dir, 'pages/practice-sub/bank-data-table.js');
    fs.mkdirSync(path.dirname(table), { recursive: true });
    fs.writeFileSync(table, 'compressed');
    expect(auditRetiredBank(directory(), [dir]).findings).toHaveLength(2);
    fs.writeFileSync(path.join(dir, 'index.html'), '<main>Yozi AI</main>');
    expect(scanPublicBuild(dir).findings.some((item) => item.category === 'retired-bank')).toBe(true);
  });
  it('accepts a bank-free artifact, while refusing a missing artifact', () => {
    const root = directory(),
      artifact = directory();
    fs.writeFileSync(path.join(artifact, 'index.html'), '<main>Yozi AI</main>');
    expect(auditRetiredBank(root, [artifact]).ok).toBe(true);
    expect(auditRetiredBank(root, [path.join(root, 'missing')]).ok).toBe(false);
  });
  it('keeps external evidence blocking even after the bank retires', () => {
    const report = buildReleaseBlockerBacklog({
      contentMode: 'conversation',
      retirementAudit: { contract: 'public-bank-retirement-v1', ok: true }
    });
    expect(report.verdict).toBe('blocked');
    expect(report.items.some((item) => item.id === 'input_report:external_audit')).toBe(true);
    expect(report.items.some((item) => item.id === 'input_report:question_audit')).toBe(false);
    expect(report.items.some((item) => item.workstream === 'content_retirement')).toBe(false);
  });
  it('blocks missing retirement proof even with no bank coverage requirement', () => {
    const report = buildReleaseBlockerBacklog({ contentMode: 'conversation' });
    expect(report.items.some((item) => item.workstream === 'content_retirement')).toBe(true);
  });
});
