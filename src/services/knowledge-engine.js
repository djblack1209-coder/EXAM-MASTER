/**
 * 知识图谱 × FSRS 融合调度引擎 (Knowledge-Graph FSRS Fusion Engine)
 *
 * 将知识点前置依赖关系（有向无环图）与 FSRS 间隔重复调度相融合，
 * 确保用户在推进学习路径时先掌握前置知识，再解锁后续模块。
 *
 * 核心逻辑:
 * 1. 维护一张考研知识点的前置依赖图 (PREREQUISITE_MAP)
 * 2. 结合 FSRS 可提取性 + 答题正确率，计算每个知识点的综合掌握度
 * 3. 通过拓扑排序 + 掌握度阈值，生成智能学习路径
 * 4. 提供知识图谱可视化所需的 nodes/edges 数据
 *
 * @module knowledge-engine
 * @see {@link module:fsrs-service} FSRS 调度服务
 * @see {@link module:composables/useKnowledgePoints} 知识点 UI 交互
 */

import { getReviewStats } from '@/services/fsrs-service.js';
import { storageService } from '@/services/storageService.js';
import { logger } from '@/utils/logger.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** 前置知识掌握度阈值 (70%)，低于此值视为未掌握 */
const MASTERY_THRESHOLD = 0.7;

/** 题库存储键 */
const _QUESTION_BANK_KEY = 'v30_bank';

/** 用户答题记录存储键 */
const USER_ANSWERS_KEY = 'v30_user_answers';

/**
 * FSRS 可提取性在综合掌握度中的权重
 * 综合掌握度 = FSRS_WEIGHT * avgRetrievability + (1 - FSRS_WEIGHT) * accuracyRate
 */
const FSRS_WEIGHT = 0.4;

/**
 * 每个知识点每次学习的默认推荐题目数量
 */
const DEFAULT_RECOMMENDED_COUNT = 10;

// ---------------------------------------------------------------------------
// Prerequisite Dependency Graph
// ---------------------------------------------------------------------------

/**
 * 考研知识点前置依赖图
 *
 * 键为知识点名称，值为其前置依赖的知识点数组。
 * 空数组表示该知识点无前置依赖，可直接开始学习。
 *
 * 依赖关系设计原则:
 * - 数学: 线性代数和概率统计均以高等数学为基础
 * - 英语: 词汇语法是一切阅读理解和输出能力的基石
 * - 政治: 各模块相对独立，时政依赖基础理论素养
 *
 * @type {Record<string, string[]>}
 */
const PREREQUISITE_MAP = {
  // 数学: 线代依赖高数基础，概率依赖高数+线代
  高等数学: [],
  线性代数: ['高等数学'],
  概率统计: ['高等数学', '线性代数'],

  // 英语: 写作依赖词汇+语法+阅读
  词汇语法: [],
  阅读理解: ['词汇语法'],
  完形填空: ['词汇语法', '阅读理解'],
  翻译: ['词汇语法', '阅读理解'],
  写作: ['词汇语法', '阅读理解', '翻译'],

  // 政治: 各模块相对独立，但时政依赖基础理论
  马原: [],
  毛中特: ['马原'],
  史纲: [],
  思修: [],
  时政: ['马原', '毛中特']
};

/**
 * 知识点名称到所属学科的映射（用于分组展示）
 * @type {Record<string, string>}
 */
const KNOWLEDGE_SUBJECT_MAP = {
  高等数学: 'math',
  线性代数: 'math',
  概率统计: 'math',
  词汇语法: 'english',
  阅读理解: 'english',
  完形填空: 'english',
  翻译: 'english',
  写作: 'english',
  马原: 'politics',
  毛中特: 'politics',
  史纲: 'politics',
  思修: 'politics',
  时政: 'politics'
};

/**
 * 知识点别名映射 — 将题目标签中的各种写法归一化到标准名称
 *
 * 题库中同一知识点可能有多种 tag/category 写法，
 * 需要统一映射到 PREREQUISITE_MAP 中的标准键名。
 *
 * @type {Record<string, string>}
 */
const ALIAS_MAP = {
  高数: '高等数学',
  高等数学: '高等数学',
  线代: '线性代数',
  线性代数: '线性代数',
  概率: '概率统计',
  概率论: '概率统计',
  概率统计: '概率统计',
  概率论与数理统计: '概率统计',
  词汇: '词汇语法',
  语法: '词汇语法',
  词汇语法: '词汇语法',
  阅读: '阅读理解',
  阅读理解: '阅读理解',
  完形: '完形填空',
  完形填空: '完形填空',
  翻译: '翻译',
  英译汉: '翻译',
  写作: '写作',
  作文: '写作',
  马原: '马原',
  马克思主义基本原理: '马原',
  毛中特: '毛中特',
  毛泽东思想: '毛中特',
  史纲: '史纲',
  中国近现代史纲要: '史纲',
  近现代史: '史纲',
  思修: '思修',
  思想道德修养: '思修',
  思想道德修养与法律基础: '思修',
  思修法基: '思修',
  时政: '时政',
  形势与政策: '时政',
  时事政治: '时政'
};

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * 将原始标签归一化为标准知识点名称
 *
 * @param {string} rawTag - 题目的 tag/category 原始值
 * @returns {string|null} 标准知识点名称，无法识别时返回 null
 * @private
 */
function _normalizeTag(rawTag) {
  if (!rawTag || typeof rawTag !== 'string') return null;
  const trimmed = rawTag.trim();
  return ALIAS_MAP[trimmed] ?? null;
}

/**
 * 从题目对象中提取知识点标签
 *
 * 题目可能在不同字段存放知识点信息，按优先级依次尝试:
 * tag > knowledgePoint > category > subject
 *
 * @param {Object} question - 题目对象
 * @returns {string|null} 归一化后的知识点名称
 * @private
 */
function _extractKnowledgePoint(question) {
  if (!question || typeof question !== 'object') return null;

  // 依次尝试多个可能的字段
  const candidates = [
    question.tag,
    question.knowledgePoint,
    question.knowledge_point,
    question.category,
    question.subject
  ];

  for (const raw of candidates) {
    if (!raw) continue;

    // 如果字段是数组（多标签），取第一个可识别的
    if (Array.isArray(raw)) {
      for (const item of raw) {
        const normalized = _normalizeTag(String(item));
        if (normalized) return normalized;
      }
      continue;
    }

    const normalized = _normalizeTag(String(raw));
    if (normalized) return normalized;
  }

  return null;
}

/**
 * 按知识点对题目进行分组
 *
 * @param {Array<Object>} allQuestions - 全部题目数组
 * @returns {Map<string, Array<Object>>} 知识点名称 → 题目数组
 * @private
 */
function _groupByKnowledgePoint(allQuestions) {
  /** @type {Map<string, Array<Object>>} */
  const groups = new Map();

  if (!Array.isArray(allQuestions)) return groups;

  for (const q of allQuestions) {
    const kp = _extractKnowledgePoint(q);
    if (!kp) continue;

    if (!groups.has(kp)) {
      groups.set(kp, []);
    }
    groups.get(kp).push(q);
  }

  return groups;
}

/**
 * 计算某个知识点下题目集合的综合掌握度
 *
 * 综合掌握度 = FSRS_WEIGHT × 平均可提取性 + (1 - FSRS_WEIGHT) × 答题正确率
 *
 * - 平均可提取性来自 FSRS getReviewStats 的 averageRetention
 * - 答题正确率来自 storageService 中的用户答题记录
 *
 * @param {Array<Object>} questions - 该知识点下的题目数组
 * @returns {number} 0~1 之间的综合掌握度
 * @private
 */
function _computeMastery(questions) {
  if (!questions || questions.length === 0) return 0;

  try {
    // --- FSRS 可提取性部分 ---
    const cardsForStats = questions
      .map((q) => ({
        questionId: q.id || q._id || q.questionId || q.question_id
      }))
      .filter((c) => c.questionId);

    const stats = getReviewStats(cardsForStats);
    const avgRetention = stats.averageRetention || 0;

    // --- 答题正确率部分 ---
    let userAnswers = null;
    try {
      userAnswers = storageService.get(USER_ANSWERS_KEY, null);
    } catch (_e) {
      // 读取失败时降级，仅使用 FSRS 数据
    }

    let accuracyRate = 0;
    if (userAnswers && typeof userAnswers === 'object') {
      let answered = 0;
      let correct = 0;

      for (const q of questions) {
        const qid = q.id || q._id || q.questionId || q.question_id;
        if (!qid) continue;

        const record = userAnswers[qid];
        if (record) {
          answered++;
          if (record.correct || record.isCorrect) {
            correct++;
          }
        }
      }

      accuracyRate = answered > 0 ? correct / answered : 0;
    }

    // --- 综合掌握度 ---
    // 如果完全没有 FSRS 数据（新用户），仅用正确率
    // 如果完全没有答题记录，仅用 FSRS 数据
    const hasFSRS = stats.totalCount > 0 && stats.totalCount > stats.newCount;
    const hasAccuracy = userAnswers !== null;

    if (hasFSRS && hasAccuracy) {
      return FSRS_WEIGHT * avgRetention + (1 - FSRS_WEIGHT) * accuracyRate;
    } else if (hasFSRS) {
      return avgRetention;
    } else if (hasAccuracy) {
      return accuracyRate;
    }

    return 0;
  } catch (e) {
    logger.warn('[KnowledgeEngine] 计算掌握度失败', e);
    return 0;
  }
}

/**
 * 计算推荐学习题目数量
 *
 * 根据掌握度和总题目数动态调整:
 * - 掌握度低 → 多练基础题
 * - 掌握度高 → 少量巩固即可
 *
 * @param {number} mastery - 0~1 综合掌握度
 * @param {number} totalQuestions - 该知识点总题目数
 * @returns {number} 推荐题目数量
 * @private
 */
function _recommendedCount(mastery, totalQuestions) {
  if (totalQuestions === 0) return 0;

  // 掌握度越低，推荐比例越高
  const ratio = Math.max(0.05, 1 - mastery); // 至少 5%
  const count = Math.ceil(totalQuestions * ratio);

  // 限制在 [5, DEFAULT_RECOMMENDED_COUNT * 3] 范围内
  return Math.max(5, Math.min(count, DEFAULT_RECOMMENDED_COUNT * 3));
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} StudyPathItem
 * @property {string} knowledgePoint - 知识点名称
 * @property {string} subject - 所属学科 ('math' | 'english' | 'politics')
 * @property {number} mastery - 综合掌握度 (0~1)
 * @property {number} masteryPercent - 掌握度百分比 (0~100)
 * @property {'ready'|'blocked'|'mastered'} status - 学习状态
 * @property {boolean} prerequisitesMet - 前置依赖是否全部达标
 * @property {number} questionCount - 该知识点下的题目总数
 * @property {number} recommendedQuestionCount - 推荐本次学习的题目数量
 * @property {string[]} blockedBy - 未达标的前置知识点列表
 * @property {string[]} prerequisites - 所有前置知识点列表
 */

/**
 * 生成智能学习路径
 *
 * 综合知识图谱依赖关系与 FSRS 掌握度数据，为用户生成有序的学习路径。
 *
 * 路径排序规则:
 * 1. 'mastered' 排最后（已掌握，无需优先学习）
 * 2. 'blocked' 排倒数（前置未满足，暂无法有效学习）
 * 3. 'ready' 排最前，按掌握度升序（最薄弱的优先补强）
 *
 * @param {Array<Object>} allQuestions - 用户的全部题目数组，每个题目应包含
 *   id/questionId 和 tag/category 等字段
 * @returns {StudyPathItem[]} 有序的学习路径数组
 */
export function getSmartStudyPath(allQuestions) {
  if (!Array.isArray(allQuestions) || allQuestions.length === 0) {
    logger.log('[KnowledgeEngine] getSmartStudyPath: 题目列表为空，返回空路径');
    return [];
  }

  try {
    const groups = _groupByKnowledgePoint(allQuestions);

    // 为依赖图中所有知识点构建掌握度缓存（包括题库中没有题目的知识点）
    /** @type {Map<string, number>} */
    const masteryCache = new Map();
    for (const kp of Object.keys(PREREQUISITE_MAP)) {
      const questions = groups.get(kp) || [];
      masteryCache.set(kp, _computeMastery(questions));
    }

    /** @type {StudyPathItem[]} */
    const path = [];

    for (const kp of Object.keys(PREREQUISITE_MAP)) {
      const questions = groups.get(kp) || [];
      const mastery = masteryCache.get(kp) || 0;
      const prerequisites = PREREQUISITE_MAP[kp] || [];

      // 检查前置依赖
      const blockedBy = [];
      for (const prereq of prerequisites) {
        const prereqMastery = masteryCache.get(prereq) || 0;
        if (prereqMastery < MASTERY_THRESHOLD) {
          blockedBy.push(prereq);
        }
      }

      const prerequisitesMet = blockedBy.length === 0;

      // 判定状态
      /** @type {'ready'|'blocked'|'mastered'} */
      let status = /** @type {'ready'|'blocked'|'mastered'} */ ('ready');
      if (mastery >= MASTERY_THRESHOLD) {
        status = /** @type {'mastered'} */ ('mastered');
      } else if (!prerequisitesMet) {
        status = /** @type {'blocked'} */ ('blocked');
      }

      path.push({
        knowledgePoint: kp,
        subject: KNOWLEDGE_SUBJECT_MAP[kp] || 'unknown',
        mastery,
        masteryPercent: Math.round(mastery * 100),
        status: /** @type {'ready'|'blocked'|'mastered'} */ (status),
        prerequisitesMet,
        questionCount: questions.length,
        recommendedQuestionCount: _recommendedCount(mastery, questions.length),
        blockedBy,
        prerequisites
      });
    }

    // 排序: ready(掌握度升序) → blocked(掌握度升序) → mastered(掌握度升序)
    const statusOrder = { ready: 0, blocked: 1, mastered: 2 };
    path.sort((a, b) => {
      const orderDiff = statusOrder[a.status] - statusOrder[b.status];
      if (orderDiff !== 0) return orderDiff;
      return a.mastery - b.mastery;
    });

    logger.log(
      `[KnowledgeEngine] 学习路径已生成: ${path.length} 个知识点`,
      `ready=${path.filter((p) => p.status === 'ready').length}`,
      `blocked=${path.filter((p) => p.status === 'blocked').length}`,
      `mastered=${path.filter((p) => p.status === 'mastered').length}`
    );

    return path;
  } catch (e) {
    logger.error('[KnowledgeEngine] getSmartStudyPath 失败', e);
    return [];
  }
}

/**
 * @typedef {Object} RecommendedTopic
 * @property {string} knowledgePoint - 推荐学习的知识点名称
 * @property {string} subject - 所属学科
 * @property {number} mastery - 当前掌握度 (0~1)
 * @property {number} masteryPercent - 掌握度百分比 (0~100)
 * @property {'ready'|'blocked'} status - 知识点当前状态
 * @property {number} recommendedQuestionCount - 推荐学习题目数量
 * @property {string|null} reason - 推荐理由
 * @property {string[]} blockedBy - 若为 blocked，列出阻塞的前置知识点
 */

/**
 * 获取当前最应该学习的单个知识点
 *
 * 选择逻辑:
 * 1. 在所有 'ready' 状态的知识点中，选掌握度最低的
 * 2. 如果没有 'ready' 的（全部 mastered 或 blocked），选第一个 blocked 的，
 *    并建议用户先去攻克其前置依赖
 * 3. 如果全部 mastered，返回 null（恭喜完成所有学习）
 *
 * @param {Array<Object>} allQuestions - 用户的全部题目数组
 * @returns {RecommendedTopic|null} 推荐的知识点，或 null（全部已掌握）
 */
export function getNextRecommendedTopic(allQuestions) {
  try {
    const path = getSmartStudyPath(allQuestions);
    if (path.length === 0) {
      logger.log('[KnowledgeEngine] getNextRecommendedTopic: 无学习路径数据');
      return null;
    }

    // 优先找 ready 状态中掌握度最低的（path 已按此排序）
    const readyItem = path.find((p) => p.status === 'ready');
    if (readyItem) {
      return {
        knowledgePoint: readyItem.knowledgePoint,
        subject: readyItem.subject,
        mastery: readyItem.mastery,
        masteryPercent: readyItem.masteryPercent,
        status: 'ready',
        recommendedQuestionCount: readyItem.recommendedQuestionCount,
        reason:
          readyItem.mastery === 0
            ? `「${readyItem.knowledgePoint}」还未开始学习，建议优先攻克`
            : `「${readyItem.knowledgePoint}」掌握度仅 ${readyItem.masteryPercent}%，是当前最薄弱环节`,
        blockedBy: []
      };
    }

    // 没有 ready 的，找第一个 blocked 的
    const blockedItem = path.find((p) => p.status === 'blocked');
    if (blockedItem) {
      const prereqNames = blockedItem.blockedBy.join('、');
      return {
        knowledgePoint: blockedItem.knowledgePoint,
        subject: blockedItem.subject,
        mastery: blockedItem.mastery,
        masteryPercent: blockedItem.masteryPercent,
        status: 'blocked',
        recommendedQuestionCount: blockedItem.recommendedQuestionCount,
        reason: `「${blockedItem.knowledgePoint}」的前置知识「${prereqNames}」尚未掌握，建议先学习前置内容`,
        blockedBy: blockedItem.blockedBy
      };
    }

    // 全部 mastered
    logger.log('[KnowledgeEngine] 所有知识点均已掌握');
    return null;
  } catch (e) {
    logger.error('[KnowledgeEngine] getNextRecommendedTopic 失败', e);
    return null;
  }
}

/**
 * @typedef {Object} KnowledgeMapNode
 * @property {string} id - 节点唯一标识（知识点名称）
 * @property {string} name - 显示名称
 * @property {string} subject - 所属学科
 * @property {number} mastery - 综合掌握度 (0~1)
 * @property {number} masteryPercent - 掌握度百分比 (0~100)
 * @property {'ready'|'blocked'|'mastered'} status - 当前状态
 * @property {number} questionCount - 题目总数
 */

/**
 * @typedef {Object} KnowledgeMapEdge
 * @property {string} source - 前置知识点 (被依赖方)
 * @property {string} target - 后续知识点 (依赖方)
 * @property {'prerequisite'} type - 边类型
 */

/**
 * @typedef {Object} KnowledgeMapData
 * @property {KnowledgeMapNode[]} nodes - 知识图谱节点
 * @property {KnowledgeMapEdge[]} edges - 知识图谱边（前置依赖关系）
 */

/**
 * 生成知识图谱可视化数据
 *
 * 返回的 nodes + edges 结构可直接用于前端图可视化库
 * （如 ECharts graph、D3.js force layout、vis.js 等）。
 *
 * @param {Array<Object>} allQuestions - 用户的全部题目数组
 * @returns {KnowledgeMapData} 图谱数据 { nodes, edges }
 */
export function getKnowledgeMapData(allQuestions) {
  try {
    const path = getSmartStudyPath(allQuestions);

    // 构建节点
    /** @type {KnowledgeMapNode[]} */
    const nodes = path.map((item) => {
      /** @type {KnowledgeMapNode} */
      const node = {
        id: item.knowledgePoint,
        name: item.knowledgePoint,
        subject: item.subject,
        mastery: item.mastery,
        masteryPercent: item.masteryPercent,
        status: item.status,
        questionCount: item.questionCount
      };
      return node;
    });

    // 构建边（从 PREREQUISITE_MAP 中提取所有依赖关系）
    /** @type {KnowledgeMapEdge[]} */
    const edges = [];
    for (const [target, prerequisites] of Object.entries(PREREQUISITE_MAP)) {
      for (const source of prerequisites) {
        edges.push({
          source,
          target,
          type: 'prerequisite'
        });
      }
    }

    logger.log(`[KnowledgeEngine] 知识图谱数据: ${nodes.length} nodes, ${edges.length} edges`);

    return { nodes, edges };
  } catch (e) {
    logger.error('[KnowledgeEngine] getKnowledgeMapData 失败', e);
    return { nodes: [], edges: [] };
  }
}

/**
 * @typedef {Object} PrerequisiteCheckResult
 * @property {boolean} met - 所有前置依赖是否已达标
 * @property {string[]} blockedBy - 未达标的前置知识点名称列表
 */

/**
 * 检查某个知识点的前置依赖是否全部满足
 *
 * 前置依赖满足的条件: 所有前置知识点的综合掌握度 > 70%
 *
 * @param {string} knowledgePoint - 知识点名称（支持别名，自动归一化）
 * @param {Array<Object>} allQuestions - 用户的全部题目数组
 * @returns {PrerequisiteCheckResult} 检查结果 { met, blockedBy }
 */
export function isPrerequisiteMet(knowledgePoint, allQuestions) {
  if (!knowledgePoint || typeof knowledgePoint !== 'string') {
    logger.warn('[KnowledgeEngine] isPrerequisiteMet: knowledgePoint 为空');
    return { met: true, blockedBy: [] };
  }

  try {
    // 归一化名称
    const normalizedKP = _normalizeTag(knowledgePoint) || knowledgePoint;

    // 获取前置依赖
    const prerequisites = PREREQUISITE_MAP[normalizedKP];
    if (!prerequisites || prerequisites.length === 0) {
      // 无前置依赖，直接满足
      return { met: true, blockedBy: [] };
    }

    // 未知知识点（不在依赖图中）
    if (prerequisites === undefined) {
      logger.log(`[KnowledgeEngine] 知识点 "${normalizedKP}" 不在依赖图中，视为无前置依赖`);
      return { met: true, blockedBy: [] };
    }

    // 按知识点分组题目
    const groups = _groupByKnowledgePoint(Array.isArray(allQuestions) ? allQuestions : []);

    // 逐个检查前置依赖的掌握度
    const blockedBy = [];
    for (const prereq of prerequisites) {
      const prereqQuestions = groups.get(prereq) || [];
      const mastery = _computeMastery(prereqQuestions);
      if (mastery < MASTERY_THRESHOLD) {
        blockedBy.push(prereq);
      }
    }

    return {
      met: blockedBy.length === 0,
      blockedBy
    };
  } catch (e) {
    logger.error('[KnowledgeEngine] isPrerequisiteMet 失败', e);
    return { met: true, blockedBy: [] };
  }
}

// ---------------------------------------------------------------------------
// Utility exports (for testing / advanced usage)
// ---------------------------------------------------------------------------

/**
 * 获取知识点的前置依赖图（只读副本）
 *
 * @returns {Readonly<Record<string, string[]>>}
 */
export function getPrerequisiteMap() {
  return Object.freeze({ ...PREREQUISITE_MAP });
}

/**
 * 获取知识点的学科归属映射（只读副本）
 *
 * @returns {Readonly<Record<string, string>>}
 */
export function getKnowledgeSubjectMap() {
  return Object.freeze({ ...KNOWLEDGE_SUBJECT_MAP });
}

/**
 * 获取掌握度阈值
 *
 * @returns {number} 0~1 之间的阈值
 */
export function getMasteryThreshold() {
  return MASTERY_THRESHOLD;
}
