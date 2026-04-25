/**
 * 闪卡题库注册表
 * 所有可用的闪卡题库在此注册，APP启动时按需加载
 * 新增题库只需：1.放JSON到flashcard-banks/ 2.在此注册
 */

// 题库注册表（懒加载，用到时才import）
const BANK_REGISTRY = [
  {
    id: 'politics-2025',
    subject: '政治',
    year: '2025',
    name: '2025考研政治真题',
    description: '33道选择题 + 10道分析题',
    // 动态导入，不会增加首屏加载体积
    loader: () => import('./flashcard-banks/politics-2025.json'),
  },
  // 后续新增题库在这里添加：
  // {
  //   id: 'politics-2024',
  //   subject: '政治',
  //   year: '2024',
  //   name: '2024考研政治真题',
  //   loader: () => import('./flashcard-banks/politics-2024.json'),
  // },
]

/**
 * 获取所有可用题库列表（不加载数据，只返回元信息）
 */
export function getAvailableBanks() {
  return BANK_REGISTRY.map(({ loader, ...meta }) => meta)
}

/**
 * 按ID加载某个题库的完整数据
 * @param {string} bankId - 题库ID
 * @returns {Promise<Object>} - 闪卡JSON数据
 */
export async function loadBank(bankId) {
  const entry = BANK_REGISTRY.find(b => b.id === bankId)
  if (!entry) {
    throw new Error(`题库不存在: ${bankId}`)
  }

  const module = await entry.loader()
  // 兼容ESM和CJS的default导出
  return module.default || module
}

/**
 * 按科目筛选题库
 * @param {string} subject - 科目名
 */
export function getBanksBySubject(subject) {
  return BANK_REGISTRY
    .filter(b => b.subject === subject)
    .map(({ loader, ...meta }) => meta)
}
