/**
 * Smart Study Engine — 智能学习引擎
 *
 * 4 个核心功能的共享后端：
 * 1. analyze_mastery  — 计算各知识点掌握度，识别薄弱点 (F4)
 * 2. error_clustering  — 错题归因聚类分析 (F1)
 * 3. sprint_priority   — 冲刺模式 ROI 优先级排序 (F2)
 * 4. generate_plan     — AI 自适应学习计划生成 (F3)
 *
 * 核心公式（搬运自 open-spaced-repetition/ts-fsrs + Leetcode-Mastery-Scheduler）：
 * - 可提取性 R(t) = (1 + t/(9*S))^(-1)    — FSRS forgetting curve
 * - 掌握度 M = 0.4*R_avg + 0.6*accuracy     — knowledge-engine.js composite
 * - 冲刺ROI = (1-M) × weight × exam_probability / estimated_hours
 *
 * @version 1.0.0
 */

import cloud from '@lafjs/cloud';
import { requireAuth, isAuthError } from './_shared/auth-middleware';
import {
  success,
  badRequest,
  unauthorized,
  serverError,
  generateRequestId,
  checkRateLimitDistributed,
  createLogger
} from './_shared/api-response';
import { retrievability } from './_shared/fsrs-scheduler';
// import { getProvider, ChatMessage } from './_shared/ai-providers/provider-factory'; // 预留 AI 增强

const db = cloud.database();
const logger = createLogger('[SmartStudyEngine]');

// ==================== Constants ====================

/** 知识点先修关系图 DAG（搬运自 knowledge-engine.js） */
const PREREQUISITE_MAP: Record<string, string[]> = {
  高等数学: [],
  线性代数: ['高等数学'],
  概率统计: ['线性代数'],
  词汇语法: [],
  阅读理解: ['词汇语法'],
  完形填空: ['阅读理解'],
  翻译: ['阅读理解'],
  写作: ['完形填空', '翻译'],
  马原: [],
  毛中特: ['马原'],
  时政: ['毛中特'],
  史纲: [],
  思修: []
};

/** 别名映射（搬运自 knowledge-engine.js） */
const ALIAS_MAP: Record<string, string> = {
  高数: '高等数学',
  微积分: '高等数学',
  高等数学: '高等数学',
  线代: '线性代数',
  线性代数: '线性代数',
  概率论: '概率统计',
  概率统计: '概率统计',
  数理统计: '概率统计',
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
  马克思主义: '马原',
  毛中特: '毛中特',
  毛概: '毛中特',
  时政: '时政',
  时事政治: '时政',
  史纲: '史纲',
  近代史: '史纲',
  思修: '思修',
  思想道德: '思修'
};

/** 科目映射 */
const SUBJECT_MAP: Record<string, string> = {
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
  时政: 'politics',
  史纲: 'politics',
  思修: 'politics'
};

/** 掌握度等级（搬运自 RunMaestro/Maestro 的 threshold 模式） */
const MASTERY_LEVELS = [
  { id: 'unlearned', name: '未学习', threshold: 0, color: '#9CA3AF' },
  { id: 'weak', name: '薄弱', threshold: 0.01, color: '#EF4444' },
  { id: 'developing', name: '发展中', threshold: 30, color: '#F59E0B' },
  { id: 'proficient', name: '熟练', threshold: 60, color: '#3B82F6' },
  { id: 'mastered', name: '掌握', threshold: 85, color: '#10B981' }
] as const;

type MasteryLevelDef = { id: string; name: string; threshold: number; color: string };

/** 获取掌握度等级 — 搬运自 RunMaestro/Maestro getLevelForPercentage */
function getMasteryLevel(percentage: number): MasteryLevelDef {
  let level: MasteryLevelDef = MASTERY_LEVELS[0];
  for (const lvl of MASTERY_LEVELS) {
    if (percentage >= lvl.threshold) level = lvl as unknown as MasteryLevelDef;
  }
  return level;
}

// retrievability 函数已从 _shared/fsrs-scheduler 导入，不再内联

/**
 * 拓扑排序 — 搬运自 teableio/teable topologicalSort.ts
 * 返回按依赖顺序排列的知识点列表
 */
function topologicalSort(graph: Record<string, string[]>): string[] {
  const visited = new Set<string>();
  const result: string[] = [];

  function dfs(node: string) {
    if (visited.has(node)) return;
    visited.add(node);
    for (const dep of graph[node] || []) {
      dfs(dep);
    }
    result.push(node);
  }

  for (const node of Object.keys(graph)) {
    dfs(node);
  }
  return result;
}

/** Duplicate removed — see line 116 */

/** 标签/分类 → 规范知识点名 */
function normalizeKnowledgePoint(tag: string): string | null {
  if (!tag) return null;
  const trimmed = tag.trim();
  return ALIAS_MAP[trimmed] || null;
}

// ==================== Shared Data Fetchers ====================

interface MistakeDoc {
  _id: string;
  user_id: string;
  question_id?: string;
  question_content: string;
  options?: string[];
  user_answer?: string;
  correct_answer?: string;
  analysis?: string;
  category: string;
  sub_category?: string;
  tags?: any[];
  error_type?: string;
  difficulty?: string;
  wrong_count: number;
  review_count: number;
  correct_streak: number;
  is_mastered: boolean;
  stability?: number;
  difficulty_fsrs?: number;
  due?: number;
  last_review?: number;
  elapsed_days?: number;
  created_at?: number;
}

async function getUserMistakes(userId: string): Promise<MistakeDoc[]> {
  const result = await db.collection('mistake_book').where({ user_id: userId }).limit(1000).get();
  return result.data || [];
}

async function getUserPracticeRecords(userId: string, limit = 500): Promise<any[]> {
  const result = await db
    .collection('practice_records')
    .where({ user_id: userId })
    .orderBy('created_at', 'desc')
    .limit(limit)
    .get();
  return result.data || [];
}

// ==================== Action: analyze_mastery (F4) ====================

interface KnowledgePointMastery {
  knowledgePoint: string;
  subject: string;
  totalQuestions: number;
  correctCount: number;
  wrongCount: number;
  accuracy: number;
  avgRetrievability: number;
  mastery: number; // 0-100
  masteryLevel: MasteryLevelDef;
  isWeak: boolean;
  prerequisites: string[];
  prerequisitesMet: boolean;
  recentTrend: 'improving' | 'declining' | 'stable';
  errorTypes: Record<string, number>;
}

async function analyzeMastery(userId: string): Promise<KnowledgePointMastery[]> {
  const mistakes = await getUserMistakes(userId);
  const records = await getUserPracticeRecords(userId);
  const now = Date.now();

  // 按知识点聚合
  const kpMap = new Map<
    string,
    {
      total: number;
      correct: number;
      wrong: number;
      retrievabilities: number[];
      errorTypes: Record<string, number>;
      recentCorrect: number;
      recentTotal: number;
    }
  >();

  // 从错题本提取知识点数据
  for (const m of mistakes) {
    const kp = normalizeKnowledgePoint(m.sub_category || m.category);
    if (!kp) continue;

    if (!kpMap.has(kp)) {
      kpMap.set(kp, {
        total: 0,
        correct: 0,
        wrong: 0,
        retrievabilities: [],
        errorTypes: {},
        recentCorrect: 0,
        recentTotal: 0
      });
    }
    const entry = kpMap.get(kp)!;
    entry.wrong += m.wrong_count || 1;
    entry.total += (m.wrong_count || 1) + (m.correct_streak || 0);
    entry.correct += m.correct_streak || 0;

    // FSRS 可提取性
    if (m.stability && m.stability > 0) {
      const elapsedDays = m.last_review ? (now - m.last_review) / (1000 * 60 * 60 * 24) : m.elapsed_days || 0;
      entry.retrievabilities.push(retrievability(elapsedDays, m.stability));
    }

    // 错误类型统计
    if (m.error_type) {
      entry.errorTypes[m.error_type] = (entry.errorTypes[m.error_type] || 0) + 1;
    }

    // 近期趋势（30天内）
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
    if (m.created_at && m.created_at > thirtyDaysAgo) {
      entry.recentTotal++;
      if (m.is_mastered) entry.recentCorrect++;
    }
  }

  // 从练习记录补充数据
  for (const r of records) {
    const kp = normalizeKnowledgePoint(r.sub_category || r.category);
    if (!kp) continue;
    if (!kpMap.has(kp)) {
      kpMap.set(kp, {
        total: 0,
        correct: 0,
        wrong: 0,
        retrievabilities: [],
        errorTypes: {},
        recentCorrect: 0,
        recentTotal: 0
      });
    }
    const entry = kpMap.get(kp)!;
    entry.total++;
    if (r.is_correct) entry.correct++;
    else entry.wrong++;
  }

  // 计算掌握度
  const results: KnowledgePointMastery[] = [];
  const masteryMap = new Map<string, number>(); // 供 prerequisitesMet 计算

  for (const [kp, data] of kpMap) {
    const accuracy = data.total > 0 ? (data.correct / data.total) * 100 : 0;
    const avgR =
      data.retrievabilities.length > 0
        ? (data.retrievabilities.reduce((a, b) => a + b, 0) / data.retrievabilities.length) * 100
        : 50; // 无 FSRS 数据时默认 50%

    // 掌握度 = 0.4*R + 0.6*accuracy（搬运自 knowledge-engine.js）
    const mastery = 0.4 * avgR + 0.6 * accuracy;
    masteryMap.set(kp, mastery);

    // 近期趋势
    let trend: 'improving' | 'declining' | 'stable' = 'stable';
    if (data.recentTotal >= 3) {
      const recentAcc = data.recentCorrect / data.recentTotal;
      const overallAcc = accuracy / 100;
      if (recentAcc > overallAcc + 0.1) trend = 'improving';
      else if (recentAcc < overallAcc - 0.1) trend = 'declining';
    }

    results.push({
      knowledgePoint: kp,
      subject: SUBJECT_MAP[kp] || 'other',
      totalQuestions: data.total,
      correctCount: data.correct,
      wrongCount: data.wrong,
      accuracy: Math.round(accuracy * 10) / 10,
      avgRetrievability: Math.round(avgR * 10) / 10,
      mastery: Math.round(mastery * 10) / 10,
      masteryLevel: getMasteryLevel(mastery),
      isWeak: mastery < 60,
      prerequisites: PREREQUISITE_MAP[kp] || [],
      prerequisitesMet: true, // 下面再计算
      recentTrend: trend,
      errorTypes: data.errorTypes
    });
  }

  // 计算先修条件是否满足
  for (const item of results) {
    item.prerequisitesMet = item.prerequisites.every((prereq) => (masteryMap.get(prereq) || 0) >= 70);
  }

  // 按掌握度升序（最薄弱的排前面）
  results.sort((a, b) => a.mastery - b.mastery);

  return results;
}

// ==================== Action: error_clustering (F1) ====================

interface ErrorCluster {
  clusterId: string;
  errorType: string;
  errorTypeName: string;
  knowledgePoints: string[];
  questionCount: number;
  examples: Array<{ questionContent: string; userAnswer: string; correctAnswer: string }>;
  severity: 'high' | 'medium' | 'low';
  suggestion: string;
  trend: 'increasing' | 'decreasing' | 'stable';
}

const ERROR_TYPE_NAMES: Record<string, string> = {
  concept_confusion: '概念混淆',
  calculation_error: '计算失误',
  memory_lapse: '记忆遗忘',
  logic_error: '逻辑推理错误',
  careless_mistake: '粗心大意',
  knowledge_gap: '知识盲区',
  time_pressure: '时间不足',
  unknown: '未分类'
};

async function errorClustering(userId: string): Promise<ErrorCluster[]> {
  const mistakes = await getUserMistakes(userId);
  if (mistakes.length === 0) return [];

  // 按 error_type + category 聚类
  const clusterMap = new Map<string, MistakeDoc[]>();
  for (const m of mistakes) {
    if (m.is_mastered) continue; // 已掌握的不参与
    const key = `${m.error_type || 'unknown'}::${m.category || '综合'}`;
    if (!clusterMap.has(key)) clusterMap.set(key, []);
    clusterMap.get(key)!.push(m);
  }

  const now = Date.now();
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
  const sixtyDaysAgo = now - 60 * 24 * 60 * 60 * 1000;

  const clusters: ErrorCluster[] = [];
  for (const [key, items] of clusterMap) {
    const [errorType, _category] = key.split('::');

    // 收集涉及的知识点
    const kpSet = new Set<string>();
    for (const m of items) {
      const kp = normalizeKnowledgePoint(m.sub_category || m.category);
      if (kp) kpSet.add(kp);
    }

    // 严重度 = 题目数量 + 平均错误次数
    const avgWrongCount = items.reduce((s, m) => s + (m.wrong_count || 1), 0) / items.length;
    const severity: 'high' | 'medium' | 'low' =
      items.length >= 10 || avgWrongCount >= 3 ? 'high' : items.length >= 5 || avgWrongCount >= 2 ? 'medium' : 'low';

    // 趋势：近30天 vs 30-60天前
    const recent = items.filter((m) => m.created_at && m.created_at > thirtyDaysAgo).length;
    const older = items.filter(
      (m) => m.created_at && m.created_at > sixtyDaysAgo && m.created_at <= thirtyDaysAgo
    ).length;
    const trend: 'increasing' | 'decreasing' | 'stable' =
      recent > older * 1.3 ? 'increasing' : recent < older * 0.7 ? 'decreasing' : 'stable';

    // 示例题目（最多3道）
    const examples = items.slice(0, 3).map((m) => ({
      questionContent: (m.question_content || '').substring(0, 200),
      userAnswer: m.user_answer || '',
      correctAnswer: m.correct_answer || ''
    }));

    // 建议
    const suggestions: Record<string, string> = {
      concept_confusion: '建议回顾基础概念定义，对比易混淆知识点的区别与联系',
      calculation_error: '建议放慢计算速度，养成分步检验的习惯',
      memory_lapse: '建议增加复习频率，使用间隔重复强化记忆',
      logic_error: '建议多做推理练习，画思维导图理清逻辑链条',
      careless_mistake: '建议做题时标记关键条件，做完后逐题检查',
      knowledge_gap: '建议系统学习该知识点，从基础概念开始补齐',
      time_pressure: '建议限时训练提高解题速度，优先练习高频考点',
      unknown: '建议分析错因后补充错误类型标签'
    };

    clusters.push({
      clusterId: key,
      errorType,
      errorTypeName: ERROR_TYPE_NAMES[errorType] || errorType,
      knowledgePoints: Array.from(kpSet),
      questionCount: items.length,
      examples,
      severity,
      suggestion: suggestions[errorType] || suggestions.unknown,
      trend
    });
  }

  // 按严重度排序
  const severityOrder = { high: 0, medium: 1, low: 2 };
  clusters.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return clusters;
}

// ==================== Action: deep_correction (R077) ====================
// 自动深度矫正：当某知识点错误次数 >=3 时，AI 分析根因 + 推荐同类题

interface DeepCorrectionResult {
  knowledgePoint: string;
  rootCause: string; // AI 分析的根因（为什么反复错）
  correction: string; // 矫正建议（关键区别/正确理解）
  similarQuestions: Array<{
    // 推荐的同类题
    questionId: string;
    content: string;
    similarity: number;
  }>;
  recentMistakes: Array<{
    // 最近的错题证据
    question: string;
    userAnswer: string;
    correctAnswer: string;
  }>;
  createdAt: number;
  status: 'pending' | 'read' | 'completed';
}

async function deepCorrection(userId: string, knowledgePoint?: string): Promise<DeepCorrectionResult[]> {
  const db = cloud.database();
  const _ = db.command;

  // 1. 查找该用户错误次数 >= 3 的知识点（或指定知识点）
  const matchCondition: any = { user_id: userId, wrong_count: _.gte(3) };
  if (knowledgePoint) {
    matchCondition.knowledge_point = knowledgePoint;
  }

  const { data: mistakes } = await db
    .collection('mistake_book')
    .where(matchCondition)
    .orderBy('wrong_count', 'desc')
    .limit(50)
    .get();

  if (!mistakes || mistakes.length === 0) {
    return [];
  }

  // 2. 按知识点分组
  const grouped: Record<string, typeof mistakes> = {};
  for (const m of mistakes) {
    const kp = m.knowledge_point || m.category || '未分类';
    if (!grouped[kp]) grouped[kp] = [];
    grouped[kp].push(m);
  }

  // 3. 检查哪些知识点近 7 天没生成过矫正
  const sevenDaysAgo = Date.now() - 7 * 24 * 3600 * 1000;
  const { data: existingCorrections } = await db
    .collection('deep_corrections')
    .where({
      user_id: userId,
      created_at: _.gte(sevenDaysAgo)
    })
    .get();

  const recentKPs = new Set((existingCorrections || []).map((c: any) => c.knowledge_point));

  // 4. 对每个需要矫正的知识点生成诊断
  const results: DeepCorrectionResult[] = [];
  const { getEmbedding, cosineSimilarity: cosineSimEmbed } = await import('./_shared/embedding.js');

  for (const [kp, kpMistakes] of Object.entries(grouped)) {
    if (recentKPs.has(kp)) continue; // 7天内已诊断，跳过
    if (kpMistakes.length < 3) continue;

    // 取最近 5 道错题
    const recent5 = kpMistakes
      .sort((a: any, b: any) => (b.updated_at || b.created_at || 0) - (a.updated_at || a.created_at || 0))
      .slice(0, 5);

    // 4a. 用 LLM 分析根因
    const mistakeContext = recent5
      .map(
        (m: any, i: number) =>
          `错题${i + 1}: ${(m.question_content || m.question || '').substring(0, 200)}\n` +
          `用户答: ${m.user_answer || '未知'}\n正确答: ${m.correct_answer || '未知'}`
      )
      .join('\n\n');

    let rootCause = '';
    let correction = '';

    try {
      const { getProvider } = await import('./_shared/ai-providers/provider-factory.js');
      const provider = getProvider();
      const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
        {
          role: 'system',
          content:
            '你是一位考研辅导专家。用户在某个知识点上反复出错，请分析根因并给出矫正方案。要求：1）根因一句话概括（为什么错）2）矫正建议一段话（正确的理解方式和关键区别）。直接输出JSON，不要markdown。格式：{"rootCause":"...","correction":"..."}'
        },
        {
          role: 'user',
          content: `知识点：${kp}\n\n以下是该用户最近的错题：\n\n${mistakeContext}`
        }
      ];

      const aiResponse = await provider.chat(messages, {
        temperature: 0.3,
        maxTokens: 500
      });

      try {
        const jsonStr = aiResponse.content || '';
        const start = jsonStr.indexOf('{');
        const end = jsonStr.lastIndexOf('}') + 1;
        const parsed = JSON.parse(jsonStr.substring(start, end) || '{}');
        rootCause = parsed.rootCause || '该知识点存在理解偏差';
        correction = parsed.correction || '建议回顾基础概念，重点区分易混淆点';
      } catch {
        rootCause = '该知识点存在理解偏差，需要针对性练习';
        correction = '建议回顾相关基础概念，并通过同类题反复练习巩固';
      }
    } catch (aiErr: any) {
      logger.warn(`[deep_correction] AI 分析失败: ${aiErr.message}`);
      rootCause = '该知识点反复出错，建议针对性强化';
      correction = '建议回顾基础概念并进行同类题练习';
    }

    // 4b. 从题库中推荐同类题（基于知识点匹配 + embedding相似度）
    let similarQuestions: DeepCorrectionResult['similarQuestions'] = [];
    try {
      // 先按知识点/分类简单匹配
      const { data: candidates } = await db
        .collection('question_bank')
        .where({
          $or: [{ knowledge_point: kp }, { category: kp }]
        })
        .limit(20)
        .get();

      if (candidates && candidates.length > 0) {
        // 排除已错过的题目
        const mistakeIds = new Set(kpMistakes.map((m: any) => m.question_id));
        const filtered = candidates.filter((c: any) => !mistakeIds.has(c._id));

        if (filtered.length > 0) {
          // 用 embedding 计算与错题的相似度，取最相似的 3 道
          const errorText = recent5.map((m: any) => m.question_content || m.question || '').join(' ');
          const errorVec = await getEmbedding(errorText.substring(0, 2000));

          const scored = [];
          for (const cand of filtered.slice(0, 10)) {
            try {
              const candVec = await getEmbedding((cand.content || cand.question || '').substring(0, 2000));
              scored.push({
                questionId: cand._id,
                content: (cand.content || cand.question || '').substring(0, 150),
                similarity: cosineSimEmbed(errorVec, candVec)
              });
            } catch {
              /* skip failed embeddings */
            }
          }

          similarQuestions = scored.sort((a, b) => b.similarity - a.similarity).slice(0, 3);
        }
      }

      // 如果 embedding 没找到足够结果，回退到纯知识点匹配
      if (similarQuestions.length === 0 && candidates && candidates.length > 0) {
        const mistakeIds = new Set(kpMistakes.map((m: any) => m.question_id));
        similarQuestions = candidates
          .filter((c: any) => !mistakeIds.has(c._id))
          .slice(0, 3)
          .map((c: any) => ({
            questionId: c._id,
            content: (c.content || c.question || '').substring(0, 150),
            similarity: 0.5 // 知识点匹配但未计算embedding
          }));
      }
    } catch (embErr: any) {
      logger.warn(`[deep_correction] 同类题匹配失败: ${embErr.message}`);
    }

    const correctionDoc = {
      knowledgePoint: kp,
      rootCause,
      correction,
      similarQuestions,
      recentMistakes: recent5.map((m: any) => ({
        question: (m.question_content || m.question || '').substring(0, 200),
        userAnswer: m.user_answer || '未知',
        correctAnswer: m.correct_answer || '未知'
      })),
      createdAt: Date.now(),
      status: 'pending' as const
    };

    // 5. 存入 deep_corrections 集合
    await db.collection('deep_corrections').add({
      user_id: userId,
      knowledge_point: kp,
      ...correctionDoc,
      created_at: Date.now()
    });

    results.push(correctionDoc);

    // 限制每次最多生成 3 个矫正（避免LLM调用过多）
    if (results.length >= 3) break;
  }

  return results;
}

// ==================== Action: sprint_priority (F2) ====================

interface SprintItem {
  knowledgePoint: string;
  subject: string;
  mastery: number;
  retrievability: number;
  roi: number; // 投入产出比
  estimatedMinutes: number; // 预估所需时间
  questionCount: number; // 可用题目数
  priority: 'must_do' | 'should_do' | 'nice_to_have' | 'skip';
  reason: string;
}

async function sprintPriority(
  userId: string,
  examDate: string
): Promise<{
  items: SprintItem[];
  daysRemaining: number;
  dailyBudgetMinutes: number;
  strategy: string;
}> {
  const masteryData = await analyzeMastery(userId);
  const examTimestamp = new Date(examDate).getTime();
  const now = Date.now();
  const daysRemaining = Math.max(1, Math.ceil((examTimestamp - now) / (1000 * 60 * 60 * 24)));

  // 动态时间预算：考前天数越少 → 每天越紧凑
  const dailyBudgetMinutes = daysRemaining <= 7 ? 480 : daysRemaining <= 30 ? 360 : 240;

  // 考研各科目权重（总分500分）
  const subjectWeights: Record<string, number> = {
    math: 150 / 500, // 数学150分
    english: 100 / 500, // 英语100分
    politics: 100 / 500, // 政治100分
    other: 150 / 500 // 专业课150分
  };

  const items: SprintItem[] = masteryData.map((kp) => {
    const weight = subjectWeights[kp.subject] || 0.2;
    const gap = Math.max(0, 100 - kp.mastery) / 100; // 提升空间 0-1

    // ROI = (提升空间 × 科目权重) / 预估时间
    // 预估时间 = 基础30分钟 + 每5道错题加10分钟
    const estimatedMinutes = 30 + Math.ceil(kp.wrongCount / 5) * 10;
    const roi = gap > 0 ? (gap * weight * 100) / (estimatedMinutes / 60) : 0;

    // 优先级判定
    let priority: SprintItem['priority'];
    let reason: string;

    if (kp.mastery >= 85) {
      priority = 'skip';
      reason = '已掌握，无需额外复习';
    } else if (kp.mastery < 30 && daysRemaining <= 14) {
      priority = 'skip';
      reason = `掌握度仅${kp.mastery.toFixed(0)}%，${daysRemaining}天内难以突破，建议战略放弃`;
    } else if (!kp.prerequisitesMet) {
      priority = 'should_do';
      reason = `先修知识未掌握（${kp.prerequisites.join('、')}），建议先补前置`;
    } else if (roi > 5) {
      priority = 'must_do';
      reason = `ROI最高（${roi.toFixed(1)}），投入产出比最优`;
    } else if (roi > 2) {
      priority = 'should_do';
      reason = `ROI中等（${roi.toFixed(1)}），建议优先安排`;
    } else {
      priority = 'nice_to_have';
      reason = `ROI较低（${roi.toFixed(1)}），有余力再复习`;
    }

    return {
      knowledgePoint: kp.knowledgePoint,
      subject: kp.subject,
      mastery: kp.mastery,
      retrievability: kp.avgRetrievability,
      roi: Math.round(roi * 10) / 10,
      estimatedMinutes,
      questionCount: kp.totalQuestions,
      priority,
      reason
    };
  });

  // 按 ROI 降序排列
  items.sort((a, b) => b.roi - a.roi);

  // 策略文案
  let strategy: string;
  if (daysRemaining <= 7) {
    strategy = `考前${daysRemaining}天冲刺：只攻 must_do 项，每天${dailyBudgetMinutes / 60}小时，放弃低ROI知识点`;
  } else if (daysRemaining <= 30) {
    strategy = `考前${daysRemaining}天强化：集中攻克 must_do + should_do，每天${dailyBudgetMinutes / 60}小时`;
  } else {
    strategy = `距考试${daysRemaining}天：均衡复习，优先薄弱点，每天${dailyBudgetMinutes / 60}小时`;
  }

  return { items, daysRemaining, dailyBudgetMinutes, strategy };
}

// ==================== Action: generate_plan (F3) ====================

interface DailyPlan {
  date: string; // YYYY-MM-DD
  tasks: Array<{
    knowledgePoint: string;
    subject: string;
    action: 'new_learn' | 'review' | 'drill' | 'mock';
    durationMinutes: number;
    questionCount: number;
    reason: string;
  }>;
  totalMinutes: number;
}

async function generatePlan(
  userId: string,
  examDate: string,
  dailyHours: number = 6
): Promise<{
  plans: DailyPlan[];
  phases: Array<{ name: string; startDate: string; endDate: string; focus: string }>;
  summary: string;
}> {
  const masteryData = await analyzeMastery(userId);
  const examTimestamp = new Date(examDate).getTime();
  const now = Date.now();
  const daysRemaining = Math.max(1, Math.ceil((examTimestamp - now) / (1000 * 60 * 60 * 24)));
  const dailyMinutes = dailyHours * 60;

  // 拓扑排序确定学习顺序
  const topoOrder = topologicalSort(PREREQUISITE_MAP);

  // 将知识点按拓扑顺序排列
  // 将知识点按拓扑顺序过滤（掌握度低于85的需要重点学习）
  topoOrder.filter((kp) => masteryData.some((m) => m.knowledgePoint === kp && m.mastery < 85));

  // 阶段划分
  const phases: Array<{ name: string; startDate: string; endDate: string; focus: string }> = [];
  const today = new Date();

  if (daysRemaining >= 90) {
    // 基础→强化→冲刺 三阶段
    const phase1End = Math.floor(daysRemaining * 0.4);
    const phase2End = Math.floor(daysRemaining * 0.75);
    phases.push(
      {
        name: '基础夯实',
        startDate: formatDate(today),
        endDate: formatDate(addDays(today, phase1End)),
        focus: '补齐知识盲区，建立知识框架'
      },
      {
        name: '强化提升',
        startDate: formatDate(addDays(today, phase1End + 1)),
        endDate: formatDate(addDays(today, phase2End)),
        focus: '专项突破薄弱点，大量刷题'
      },
      {
        name: '冲刺模考',
        startDate: formatDate(addDays(today, phase2End + 1)),
        endDate: formatDate(addDays(today, daysRemaining - 1)),
        focus: '模拟考试，查漏补缺，高ROI复习'
      }
    );
  } else if (daysRemaining >= 30) {
    phases.push(
      {
        name: '强化突破',
        startDate: formatDate(today),
        endDate: formatDate(addDays(today, Math.floor(daysRemaining * 0.6))),
        focus: '聚焦薄弱点，定向刷题'
      },
      {
        name: '冲刺收官',
        startDate: formatDate(addDays(today, Math.floor(daysRemaining * 0.6) + 1)),
        endDate: formatDate(addDays(today, daysRemaining - 1)),
        focus: '高ROI复习，模拟考试'
      }
    );
  } else {
    phases.push({
      name: '极限冲刺',
      startDate: formatDate(today),
      endDate: formatDate(addDays(today, daysRemaining - 1)),
      focus: '只攻高ROI知识点，战略放弃低收益项'
    });
  }

  // 生成未来7天的具体计划
  const plans: DailyPlan[] = [];
  const planDays = Math.min(7, daysRemaining);

  for (let d = 0; d < planDays; d++) {
    const date = formatDate(addDays(today, d));
    let remainingMinutes = dailyMinutes;
    const tasks: DailyPlan['tasks'] = [];

    // 1. 先安排 FSRS 到期复习（占 30% 时间）
    const reviewKPs = masteryData
      .filter((kp) => kp.avgRetrievability < 70 && kp.mastery >= 30) // 有遗忘风险但不是全新的
      .sort((a, b) => a.avgRetrievability - b.avgRetrievability) // R 最低的优先
      .slice(0, 3);

    for (const kp of reviewKPs) {
      if (remainingMinutes <= 0) break;
      const duration = Math.min(30, remainingMinutes);
      tasks.push({
        knowledgePoint: kp.knowledgePoint,
        subject: kp.subject,
        action: 'review',
        durationMinutes: duration,
        questionCount: Math.ceil(duration / 3),
        reason: `可提取性${kp.avgRetrievability.toFixed(0)}%，有遗忘风险`
      });
      remainingMinutes -= duration;
    }

    // 2. 薄弱点新学/强化（占 50% 时间）
    const weakKPs = masteryData
      .filter((kp) => kp.isWeak && kp.prerequisitesMet)
      .sort((a, b) => a.mastery - b.mastery)
      .slice(0, 3);

    for (const kp of weakKPs) {
      if (remainingMinutes <= 0) break;
      const duration = Math.min(60, remainingMinutes);
      tasks.push({
        knowledgePoint: kp.knowledgePoint,
        subject: kp.subject,
        action: kp.mastery < 10 ? 'new_learn' : 'drill',
        durationMinutes: duration,
        questionCount: Math.ceil(duration / 4),
        reason: `掌握度仅${kp.mastery.toFixed(0)}%，需重点突破`
      });
      remainingMinutes -= duration;
    }

    // 3. 剩余时间做综合练习/模考（20% 时间）
    if (remainingMinutes > 20) {
      tasks.push({
        knowledgePoint: '综合练习',
        subject: 'mixed',
        action: d % 3 === 0 ? 'mock' : 'drill',
        durationMinutes: remainingMinutes,
        questionCount: Math.ceil(remainingMinutes / 3),
        reason: d % 3 === 0 ? '定期模考检验学习效果' : '综合练习巩固已学内容'
      });
    }

    plans.push({
      date,
      tasks,
      totalMinutes: dailyMinutes - Math.max(0, remainingMinutes)
    });
  }

  const summary =
    `为你生成了${planDays}天学习计划（共${phases.length}个阶段），距考试${daysRemaining}天。` +
    `当前${masteryData.filter((k) => k.isWeak).length}个薄弱知识点需重点突破。` +
    `每日${dailyHours}小时，按「复习30% + 突破50% + 综合20%」分配。`;

  return { plans, phases, summary };
}

// ==================== Utility ====================

function formatDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

function addDays(d: Date, n: number): Date {
  const result = new Date(d);
  result.setDate(result.getDate() + n);
  return result;
}

// ==================== Main Handler ====================

export default async function (ctx: any) {
  const requestId = generateRequestId('sse');

  try {
    const authResult = requireAuth(ctx);
    if (isAuthError(authResult)) {
      return unauthorized('请先登录');
    }

    const userId = authResult.userId;
    const { action, ...params } = ctx.body || {};

    // 限流：20次/分钟
    const rateLimitResult = await checkRateLimitDistributed(`smart_study:${userId}`, 20, 60000);
    if (!rateLimitResult.allowed) {
      return { code: 429, success: false, message: '请求过于频繁，请稍后再试' };
    }

    logger.info(`[${requestId}] action=${action}, userId=${userId}`);

    switch (action) {
      case 'analyze_mastery': {
        const data = await analyzeMastery(userId);
        const weakPoints = data.filter((k) => k.isWeak);
        return success({
          mastery: data,
          summary: {
            totalKnowledgePoints: data.length,
            weakCount: weakPoints.length,
            masteredCount: data.filter((k) => k.mastery >= 85).length,
            avgMastery:
              data.length > 0 ? Math.round((data.reduce((s, k) => s + k.mastery, 0) / data.length) * 10) / 10 : 0,
            weakestPoint: weakPoints[0]?.knowledgePoint || null
          }
        });
      }

      case 'error_clustering': {
        const clusters = await errorClustering(userId);
        return success({
          clusters,
          summary: {
            totalClusters: clusters.length,
            highSeverity: clusters.filter((c) => c.severity === 'high').length,
            totalMistakes: clusters.reduce((s, c) => s + c.questionCount, 0),
            topErrorType: clusters[0]?.errorTypeName || null
          }
        });
      }

      case 'deep_correction': {
        const corrections = await deepCorrection(userId, params.knowledgePoint);
        return success({
          corrections,
          summary: {
            totalCorrections: corrections.length,
            knowledgePoints: corrections.map((c) => c.knowledgePoint)
          }
        });
      }

      case 'get_pending_corrections': {
        const db2 = cloud.database();
        const { data } = await db2
          .collection('deep_corrections')
          .where({ user_id: userId, status: 'pending' })
          .orderBy('created_at', 'desc')
          .limit(5)
          .get();
        return success({ corrections: data || [] });
      }

      case 'mark_correction_read': {
        if (!params.correctionId) {
          return badRequest('请提供 correctionId');
        }
        const db2 = cloud.database();
        await db2
          .collection('deep_corrections')
          .where({ _id: params.correctionId, user_id: userId })
          .update({ status: 'read' });
        return success({ message: '已标记已读' });
      }

      case 'sprint_priority': {
        if (!params.examDate) {
          return badRequest('请提供考试日期 examDate (YYYY-MM-DD)');
        }
        const data = await sprintPriority(userId, params.examDate);
        return success(data);
      }

      case 'generate_plan': {
        if (!params.examDate) {
          return badRequest('请提供考试日期 examDate (YYYY-MM-DD)');
        }
        const data = await generatePlan(userId, params.examDate, params.dailyHours || 6);
        return success(data);
      }

      default:
        return badRequest(
          `未知 action: ${action}，支持: analyze_mastery, error_clustering, deep_correction, get_pending_corrections, mark_correction_read, sprint_priority, generate_plan`
        );
    }
  } catch (error: any) {
    logger.error(`[${requestId}] 智能学习引擎异常:`, error);
    return serverError('服务暂时不可用，请稍后重试');
  }
}
