/**
 * 首页静态数据配置
 * 将硬编码的模拟数据抽取到配置文件，便于维护和后续迁移到后端
 *
 * 动态加载策略：
 * - 静态常量作为本地 fallback，保证离线可用
 * - fetchHomeData() 异步从后端拉取最新数据，成功后缓存到本地
 * - 调用方可选择使用静态常量（同步）或 fetchHomeData()（异步）
 *
 * @module config/home-data
 */

import { storageService } from '@/services/storageService.js';
import { lafService } from '@/services/lafService.js';

/**
 * 励志金句库（30条精选）— 本地 fallback
 */
export const QUOTE_LIBRARY = [
  { text: '成功不是终点，失败也不是终结，唯有勇气才是永恒。', author: '丘吉尔' },
  { text: '天才是1%的灵感加上99%的汗水。', author: '爱迪生' },
  { text: '不积跬步，无以至千里；不积小流，无以成江海。', author: '荀子' },
  { text: '宝剑锋从磨砺出，梅花香自苦寒来。', author: '古训' },
  { text: '书山有路勤为径，学海无涯苦作舟。', author: '韩愈' },
  { text: '业精于勤，荒于嬉；行成于思，毁于随。', author: '韩愈' },
  { text: '黑发不知勤学早，白首方悔读书迟。', author: '颜真卿' },
  { text: '少壮不努力，老大徒伤悲。', author: '汉乐府' },
  { text: '读书破万卷，下笔如有神。', author: '杜甫' },
  { text: '学而不思则罔，思而不学则殆。', author: '孔子' },
  { text: '知之者不如好之者，好之者不如乐之者。', author: '孔子' },
  { text: '三人行，必有我师焉。', author: '孔子' },
  { text: '温故而知新，可以为师矣。', author: '孔子' },
  { text: '学如逆水行舟，不进则退。', author: '古训' },
  { text: '千里之行，始于足下。', author: '老子' },
  { text: '路漫漫其修远兮，吾将上下而求索。', author: '屈原' },
  { text: '天行健，君子以自强不息。', author: '周易' },
  { text: '有志者事竟成，破釜沉舟，百二秦关终属楚。', author: '蒲松龄' },
  { text: '苦心人天不负，卧薪尝胆，三千越甲可吞吴。', author: '蒲松龄' },
  { text: '世上无难事，只怕有心人。', author: '古训' },
  { text: '只要功夫深，铁杵磨成针。', author: '古训' },
  { text: '精诚所至，金石为开。', author: '庄子' },
  { text: '锲而不舍，金石可镂。', author: '荀子' },
  { text: '绳锯木断，水滴石穿。', author: '罗大经' },
  { text: '不经一番寒彻骨，怎得梅花扑鼻香。', author: '黄檗禅师' },
  { text: '吃得苦中苦，方为人上人。', author: '古训' },
  { text: '今日事今日毕，莫将今事待明日。', author: '古训' },
  { text: '一寸光阴一寸金，寸金难买寸光阴。', author: '古训' },
  { text: '勤能补拙是良训，一分辛苦一分才。', author: '华罗庚' },
  { text: '书籍是人类进步的阶梯。', author: '高尔基' }
];

/**
 * 公式定理列表
 * 后续可从后端动态加载或按学科分类
 */
export const FORMULA_LIST = [
  { name: '勾股定理', formula: 'a² + b² = c²', category: '几何' },
  { name: '求根公式', formula: 'x = (-b ± √(b²-4ac)) / 2a', category: '代数' },
  { name: '三角函数', formula: 'sin²θ + cos²θ = 1', category: '三角' },
  { name: '导数公式', formula: "(xⁿ)' = nxⁿ⁻¹", category: '微积分' },
  { name: '积分公式', formula: '∫x = xⁿ⁺¹/(n+1) + C', category: '微积分' },
  { name: '等差数列', formula: 'aₙ = a₁ + (n-1)d', category: '数列' },
  { name: '等比数列', formula: 'aₙ = a₁ · qⁿ⁻¹', category: '数列' },
  { name: '排列公式', formula: 'Aₙᵐ = n!/(n-m)!', category: '排列组合' },
  { name: '组合公式', formula: 'Cₙᵐ = n!/[m!(n-m)!]', category: '排列组合' },
  { name: '二项式定理', formula: '(a+b)ⁿ = Σ Cₙᵏ aⁿ⁻ᵏbᵏ', category: '代数' }
];

/**
 * 默认知识点模板
 * 当无法从题库计算时使用的默认结构
 */
export const DEFAULT_KNOWLEDGE_POINTS = [
  { id: 1, title: '错题集', icon: 'category-mistakes', color: '#EF4444' },
  { id: 2, title: '热门考点', icon: 'category-hot', color: '#F59E0B' },
  { id: 3, title: '练习题', icon: 'category-practice', color: '#00F2FF' },
  { id: 4, title: '核心概念', icon: 'category-concept', color: '#9FE870' },
  { id: 5, title: '公式定理', icon: 'category-formula', color: '#A855F7' },
  { id: 6, title: '阅读理解', icon: 'category-reading', color: '#EC4899' }
];

/**
 * 默认学习偏好
 */
export const DEFAULT_USER_PREFERENCES = {
  preferredSubjects: [],
  learningStyle: 'visual',
  studyTimePreference: 'morning',
  targetScore: 0
};

/**
 * 示例题库（新用户快速开始用）
 */
export const DEMO_QUESTIONS = [
  {
    id: 'demo_1',
    question: '马克思主义哲学的直接理论来源是？',
    options: ['A. 德国古典哲学', 'B. 英国古典政治经济学', 'C. 法国空想社会主义', 'D. 古希腊哲学'],
    answer: 0,
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
    answer: 2,
    category: '数学',
    explanation: '函数极限存在的充要条件是左极限和右极限都存在且相等。'
  },
  {
    id: 'demo_3',
    question: 'The word "ubiquitous" most probably means ___.',
    options: ['A. rare', 'B. everywhere', 'C. dangerous', 'D. expensive'],
    answer: 1,
    category: '英语',
    explanation: 'ubiquitous 意为"无处不在的"，与 everywhere 含义最接近。'
  }
];

// ==================== 动态加载支持 ====================

const CACHE_KEY = 'home_data_remote';
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24小时缓存

/**
 * 从后端异步拉取首页动态数据（金句、公式等），成功后缓存到本地。
 * 失败时静默降级为本地静态数据，不影响页面渲染。
 *
 * @returns {Promise<{ quotes: Array, formulas: Array }>}
 */
export async function fetchHomeData() {
  try {
    // 1. 检查本地缓存是否有效
    const cached = storageService.get(CACHE_KEY, null);
    if (cached && cached._ts && Date.now() - cached._ts < CACHE_TTL) {
      return {
        quotes: cached.quotes || QUOTE_LIBRARY,
        formulas: cached.formulas || FORMULA_LIST
      };
    }

    // 2. 尝试从后端拉取
    if (!lafService || typeof lafService.getHomeData !== 'function') {
      // 后端接口尚未实现，静默降级
      return { quotes: QUOTE_LIBRARY, formulas: FORMULA_LIST };
    }

    const res = await lafService.getHomeData();
    const data = res?.data || {};

    const result = {
      quotes: Array.isArray(data.quotes) && data.quotes.length > 0 ? data.quotes : QUOTE_LIBRARY,
      formulas: Array.isArray(data.formulas) && data.formulas.length > 0 ? data.formulas : FORMULA_LIST
    };

    // 3. 写入缓存
    storageService.save(CACHE_KEY, { ...result, _ts: Date.now() });

    return result;
  } catch (_e) {
    // 网络失败、接口不存在等情况，静默降级
    return { quotes: QUOTE_LIBRARY, formulas: FORMULA_LIST };
  }
}
