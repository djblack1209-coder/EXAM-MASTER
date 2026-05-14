/**
 * Development-only sample questions.
 *
 * This module is loaded dynamically only when mock/dev/audit demo mode is enabled.
 * Keep it out of normal production entry paths so sample content cannot become a
 * user-facing production question bank by accident.
 */
export const DEMO_QUESTIONS = [
  {
    id: 'demo_1',
    question: '马克思主义哲学的直接理论来源是？',
    options: ['A. 德国古典哲学', 'B. 英国古典政治经济学', 'C. 法国空想社会主义', 'D. 古希腊哲学'],
    answer: 'A',
    category: '政治',
    explanation: '马克思主义哲学的直接理论来源是德国古典哲学，特别是黑格尔的辩证法和费尔巴哈的唯物主义。'
  },
  {
    id: 'demo_2',
    question: '下列关于函数极限的说法，正确的是？',
    options: [
      'A. 函数极限存在则函数必连续',
      'B. 函数连续则极限必存在',
      'C. 极限存在则左右极限必相等',
      'D. 左右极限存在则极限必存在'
    ],
    answer: 'C',
    category: '数学',
    explanation: '函数极限存在的充要条件是左极限和右极限都存在且相等。'
  },
  {
    id: 'demo_3',
    question: 'The word "ubiquitous" most probably means ___.',
    options: ['A. rare', 'B. everywhere', 'C. dangerous', 'D. expensive'],
    answer: 'B',
    category: '英语',
    explanation: 'ubiquitous 意为"无处不在的"，与 everywhere 含义最接近。'
  }
];

export default DEMO_QUESTIONS;
