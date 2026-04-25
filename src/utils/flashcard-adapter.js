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
export function adaptCard(card) {
  return {
    id: card.id,
    question: card.question || '',
    // 关键转换：{label, text}[] → 'A. xxx' 字符串数组
    options: (card.options || []).map(opt =>
      typeof opt === 'string' ? opt : `${opt.label}. ${opt.text}`
    ),
    answer: (card.answer || '').charAt(0).toUpperCase(),
    desc: card.explanation || card.desc || '暂无解析',
    category: card.subject || card.tags?.[0] || '未分类',
    type: card.type === 'choice' ? '单选' : card.type === 'analysis' ? '分析' : '单选',
    difficulty: card.difficulty || 2,
    // 保留原始标签用于筛选
    tags: card.tags || [],
    year: card.year || '',
    source: card.source || '',
  }
}

/**
 * 批量转换闪卡数组
 * @param {Array} cards - 闪卡数据数组
 * @returns {Array} - v30_bank格式数组
 */
export function adaptFlashcards(cards) {
  return cards.filter(c => c.question && c.question.length > 5).map(adaptCard)
}

/**
 * 从闪卡JSON文件数据导入到本地题库
 * @param {Object} flashcardData - 闪卡JSON完整数据 {source, subject, cards: [...]}
 * @param {Object} storageService - uni存储服务
 * @returns {Object} - {imported: 导入数量, skipped: 跳过数量, total: 题库总量}
 */
export function importFlashcardsToBank(flashcardData, storageService) {
  // 读取现有题库
  const existingBank = storageService.get('v30_bank') || []
  const existingIds = new Set(existingBank.map(q => q.id))

  // 转换格式
  const adapted = adaptFlashcards(flashcardData.cards || [])

  // 去重导入
  let imported = 0
  let skipped = 0

  for (const card of adapted) {
    if (existingIds.has(card.id)) {
      skipped++
    } else {
      existingBank.push(card)
      existingIds.add(card.id)
      imported++
    }
  }

  // 写回存储
  storageService.set('v30_bank', existingBank)

  return {
    imported,
    skipped,
    total: existingBank.length,
    subject: flashcardData.subject || '未知',
    year: flashcardData.year || '',
  }
}

/**
 * 获取题库统计信息
 * @param {Object} storageService - uni存储服务
 * @returns {Object} - 统计数据
 */
export function getBankStats(storageService) {
  const bank = storageService.get('v30_bank') || []
  const bySubject = {}
  const byYear = {}

  for (const q of bank) {
    const subj = q.category || '未分类'
    const year = q.year || '未知'
    bySubject[subj] = (bySubject[subj] || 0) + 1
    byYear[year] = (byYear[year] || 0) + 1
  }

  return {
    total: bank.length,
    bySubject,
    byYear,
  }
}
