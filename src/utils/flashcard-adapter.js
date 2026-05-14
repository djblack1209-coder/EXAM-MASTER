import { normalizeQuizAnswer } from '@/services/quiz-session-contract.js';

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
  const paperMeta = {
    ...(defaults.paper || defaults.paperMeta || {}),
    ...(card.paper || card.paperMeta || {})
  };
  const passage = card.passage || card.context || card.material || card.article || '';

  return {
    id: card.id,
    question: card.question || '',
    passage,
    context: card.context || passage,
    material: card.material || passage,
    paperId: card.paperId || paperMeta.id || defaults.paperId || '',
    paperName: card.paperName || paperMeta.name || defaults.paperName || '',
    section: card.section || card.part || '',
    groupId: card.groupId || card.passageId || '',
    // 关键转换：{label, text}[] → 'A. xxx' 字符串数组
    options: (card.options || []).map((opt) => (typeof opt === 'string' ? opt : `${opt.label}. ${opt.text}`)),
    // 闪卡/分析题保留完整答案，多选题保留多字母答案，单选题规范为 A-D
    answer: normalizeQuizAnswer(card, card.type),
    desc: card.explanation || card.desc || '暂无解析',
    category: card.subject || defaults.subject || card.tags?.[0] || '未分类',
    // 保留原始 type 字段，do-quiz.vue 会根据它决定交互模式
    type: card.type || 'single_choice',
    difficulty: card.difficulty || 2,
    knowledgeNodeIds: card.knowledgeNodeIds || card.knowledge_points || [],
    knowledge_points: card.knowledge_points || card.knowledgeNodeIds || [],
    eloRating: card.eloRating || card.elo_rating || undefined,
    // 保留原始标签用于筛选
    tags: card.tags || [],
    year: card.year || defaults.year || '',
    source: card.source || defaults.source || ''
  };
}

/**
 * 批量转换闪卡数组
 * @param {Array} cards - 闪卡数据数组
 * @returns {Array} - v30_bank格式数组
 */
export function adaptFlashcards(cards, defaults = {}) {
  return cards.filter((c) => c.question && c.question.length > 5).map((card) => adaptCard(card, defaults));
}

/**
 * 从闪卡JSON文件数据导入到本地题库
 * @param {Object} flashcardData - 闪卡JSON完整数据 {source, subject, cards: [...]}
 * @param {Object} storageService - uni存储服务
 * @returns {Object} - {imported: 导入数量, skipped: 跳过数量, total: 题库总量}
 */
export function importFlashcardsToBank(flashcardData, storageService, options = {}) {
  // 读取现有题库
  const existingBank = storageService.get('v30_bank') || [];
  const existingIds = new Set(existingBank.map((q) => q.id));

  // 转换格式
  const adapted = adaptFlashcards(flashcardData.cards || [], {
    paperId: options.paperId || flashcardData.id || flashcardData.paperId || flashcardData.source || '',
    paperName: options.paperName || flashcardData.name || flashcardData.paperName || flashcardData.title || '',
    subject: options.subject || flashcardData.subject || '',
    year: flashcardData.year || '',
    source: flashcardData.source || ''
  });

  // 去重导入
  let imported = 0;
  let skipped = 0;

  for (const card of adapted) {
    if (existingIds.has(card.id)) {
      skipped++;
    } else {
      existingBank.push(card);
      existingIds.add(card.id);
      imported++;
    }
  }

  // 写回存储
  storageService.set('v30_bank', existingBank);

  return {
    imported,
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
