import { prepareQuizQuestion, prepareQuizSelection } from '@/services/quiz-session-contract.js';
import {
  captureQuizOriginal,
  validateQuizOriginalData
} from '../../laf-backend/functions/_shared/learning-quiz-original.js';

/**
 * 闪卡数据适配器
 * 将 pdf2flashcard.py 生成的闪卡JSON 转换为 do-quiz.vue 的 v30_bank 格式
 * 相当于"翻译器"：把闪卡的数据格式翻译成做题页面能识别的格式
 */

/**
 * 将单张闪卡转为做题页面格式
 * @param {Object} card - 闪卡数据 {id, question, options: [{label, text}], answer, explanation, ...}
 * @returns {Object} - v30_bank格式 {id, question, options: ['A. xxx'], answer, desc, ...}
 */
export function adaptCard(card, defaults = {}) {
  validateQuizOriginalData(card);
  validateQuizOriginalData(defaults);
  const paperMeta = { ...(defaults.paper || defaults.paperMeta || {}), ...(card.paper || card.paperMeta || {}) };
  const paperId = card.paperId ?? paperMeta.id ?? defaults.paperId;
  const raw = {
    ...card,
    ...(paperId !== undefined ? { paperId } : {}),
    ...(!card.quizOriginal && Object.keys(defaults).length ? { importContext: defaults } : {})
  };
  const quizOriginal = captureQuizOriginal(raw);
  const prepared = prepareQuizQuestion({ ...raw, quizOriginal });
  if (!prepared) throw new Error('ORIGINAL_UNAVAILABLE');
  return {
    ...raw,
    ...prepared,
    quizOriginal,
    number: card.number ?? card.questionNumber ?? card.question_no ?? defaults.number ?? '',
    paperName: card.paperName ?? paperMeta.name ?? defaults.paperName ?? '',
    category: card.category ?? card.subject ?? defaults.subject ?? card.tags?.[0] ?? '未分类',
    year: card.year ?? defaults.year ?? ''
  };
}

export function adaptFlashcards(cards, defaults = {}) {
  if (!Array.isArray(cards)) throw new Error('INVALID_CARDS');
  const adapted = cards.map((card) => adaptCard(card, defaults));
  if (adapted.length && !prepareQuizSelection(adapted)) throw new Error('INCOMPLETE_SELECTION');
  return adapted;
}

/**
 * 从闪卡JSON文件数据导入到本地题库
 * @param {Object} flashcardData - 闪卡JSON完整数据 {source, subject, cards: [...]}
 * @param {Object} storageService - uni存储服务
 * @returns {Object} - {imported: 新增数量, updated: 更新数量, skipped: 跳过数量, total: 题库总量}
 */
export function importFlashcardsToBank(flashcardData, storageService, options = {}) {
  // 读取现有题库
  const storedBank = storageService.get('v30_bank');
  if (!Array.isArray(storedBank)) throw new Error('BANK_UNAVAILABLE');
  const existingBank = JSON.parse(JSON.stringify(storedBank));
  const existingIndexById = new Map(existingBank.map((q, index) => [q?.id ?? q?._id, index]));

  // 转换格式
  const adapted = adaptFlashcards(flashcardData.cards || [], {
    paperId: options.paperId ?? flashcardData.id ?? flashcardData.paperId ?? '',
    paperName: options.paperName || flashcardData.name || flashcardData.paperName || flashcardData.title || '',
    subject: options.subject || flashcardData.subject || '',
    year: flashcardData.year || '',
    ...captureQuizOriginal(flashcardData).fields,
    source: flashcardData.source ?? ''
  });

  // 去重导入
  let imported = 0;
  let updated = 0;
  let skipped = 0;

  for (const card of adapted) {
    const existingIndex = existingIndexById.get(card.id);
    if (existingIndex !== undefined) {
      const current = existingBank[existingIndex];
      if (
        existingBank.filter((q) => (q?.id ?? q?._id) === card.id).length !== 1 ||
        (current.paperId ?? '') !== (card.paperId ?? '')
      )
        throw new Error('SOURCE_ID_CONFLICT');
      const next = { ...current, ...card };
      // Do not attach stale content/source fields to the newly imported original.
      for (const key of Object.keys(captureQuizOriginal(current).fields)) {
        if (!Object.prototype.hasOwnProperty.call(card, key)) delete next[key];
      }
      if (JSON.stringify(current) === JSON.stringify(next)) {
        skipped++;
      } else {
        existingBank[existingIndex] = next;
        updated++;
      }
    } else {
      existingBank.push(card);
      existingIndexById.set(card.id, existingBank.length - 1);
      imported++;
    }
  }

  // 写回存储
  if (storageService.set('v30_bank', existingBank) !== true) throw new Error('BANK_SAVE_FAILED');
  if (JSON.stringify(storageService.get('v30_bank')) !== JSON.stringify(existingBank))
    throw new Error('BANK_SAVE_UNCONFIRMED');

  return {
    imported,
    updated,
    skipped,
    total: existingBank.length,
    subject: flashcardData.subject || '未知',
    year: flashcardData.year || ''
  };
}

/**
 * 获取题库统计信息
 * @param {Object} storageService - uni存储服务
 * @returns {Object} - 统计数据
 */
export function getBankStats(storageService) {
  const bank = storageService.get('v30_bank') || [];
  const bySubject = {};
  const byYear = {};

  for (const q of bank) {
    const subj = q.category || '未分类';
    const year = q.year || '未知';
    bySubject[subj] = (bySubject[subj] || 0) + 1;
    byYear[year] = (byYear[year] || 0) + 1;
  }

  return {
    total: bank.length,
    bySubject,
    byYear
  };
}
