/**
 * Chat 意图识别器 — 将用户自然语言映射到应用功能
 *
 * 参考: lemonai/intent-detection (GitHub)
 * 设计: 纯前端正则匹配，零延迟，无需 API 调用
 *
 * 使用方式:
 *   import { detectIntent, QUICK_ACTIONS } from '@/utils/chat/intent-detector.js'
 *   const intent = detectIntent('帮我出10道数学题')
 *   // → { action: 'generate_quiz', params: { count: 10, subject: '数学' }, confidence: 0.9, label: '出题' }
 */

// 意图规则表：模式 → 动作
const INTENT_RULES = [
  // ===== 出题/练习 =====
  {
    action: 'generate_quiz',
    patterns: [
      /(?:帮我|给我|来|出|生成|做).*?(\d+)?.*?(?:道|个|组)?.*?(?:题|试题|练习|选择题|填空题|大题)/,
      /我想(?:做|练|刷)(?:题|练习)/,
      /开始(?:练习|做题|答题|刷题)/
    ],
    extractParams: (match) => {
      const count = match[1] ? parseInt(match[1]) : null;
      // 检测科目
      const subjectMap = {
        数学: '数学',
        英语: '英语',
        政治: '政治',
        专业课: '专业课',
        高数: '数学',
        线代: '数学',
        概率: '数学'
      };
      let subject = null;
      for (const [keyword, subj] of Object.entries(subjectMap)) {
        if (match.input.includes(keyword)) {
          subject = subj;
          break;
        }
      }
      return { count, subject };
    },
    label: '出题练习',
    route: '/pages/practice-sub/do-quiz'
  },

  // ===== 复习 =====
  {
    action: 'start_review',
    patterns: [
      /(?:开始|进行|去)?复习/,
      /(?:复习|回顾).*(?:错题|卡片|单词)/,
      /有.*?(?:要|该|需要)复习/,
      /今[天日].*复习/
    ],
    label: '开始复习',
    route: '/pages/practice-sub/smart-review'
  },

  // ===== 错题 =====
  {
    action: 'review_mistakes',
    patterns: [/(?:看看|查看|分析|复习).*?错题/, /错题.*?(?:本|集|记录|分析)/, /哪.*?(?:错|做错|不会)/],
    label: '错题分析',
    route: '/pages/mistake/index'
  },

  // ===== 学习计划 =====
  {
    action: 'make_plan',
    patterns: [
      /(?:制定|生成|规划|安排).*?(?:计划|规划|日程|安排)/,
      /(?:学习|复习|备考).*?计划/,
      /(?:今天|这周|本周).*?(?:该学|怎么学|学什么)/,
      /接下来.*?(?:该学|学什么|怎么安排)/
    ],
    label: '制定计划',
    route: '/pages/plan/index'
  },

  // ===== 模考 =====
  {
    action: 'mock_exam',
    patterns: [/模[拟考].*?[考试]/, /(?:来一场|进行|开始).*?模[拟考]/, /(?:真题|模拟).*?(?:测试|考试)/],
    label: '模拟考试',
    route: '/pages/practice-sub/mock-exam'
  },

  // ===== 查学校 =====
  {
    action: 'search_school',
    patterns: [
      /(?:查|搜|找|看看).*?(?:学校|院校|大学|研究生|报录比|分数线)/,
      /(?:想考|报考|目标).*?(?:哪个|什么|哪所)/
    ],
    label: '查院校',
    route: '/pages/school/index'
  },

  // ===== 知识点分析 =====
  {
    action: 'analyze_weakness',
    patterns: [
      /(?:分析|诊断|检查).*?(?:薄弱|弱项|掌握|水平)/,
      /(?:哪[些个]|什么).*?(?:薄弱|不会|不懂|不行)/,
      /我的.*?(?:弱点|弱项|短板)/
    ],
    label: '薄弱分析',
    route: '/pages/practice-sub/diagnosis-report'
  }
];

/**
 * 检测用户输入的意图
 * @param {string} text - 用户输入文本
 * @returns {{ action: string, params: object, confidence: number, label: string, route: string } | null}
 */
export function detectIntent(text) {
  if (!text || typeof text !== 'string') return null;
  const trimmed = text.trim();
  if (trimmed.length < 2 || trimmed.length > 200) return null;

  for (const rule of INTENT_RULES) {
    for (const pattern of rule.patterns) {
      const match = trimmed.match(pattern);
      if (match) {
        return {
          action: rule.action,
          params: rule.extractParams ? rule.extractParams(match) : {},
          confidence: match[0].length / trimmed.length, // 匹配比例作为置信度
          label: rule.label,
          route: rule.route
        };
      }
    }
  }
  return null;
}

/**
 * 快捷动作列表 — 显示在 Chat 输入框上方
 */
export const QUICK_ACTIONS = [
  { icon: 'lightning', label: '出题', text: '帮我出一组题', action: 'generate_quiz' },
  { icon: 'flame', label: '复习', text: '开始今日复习', action: 'start_review' },
  { icon: 'target', label: '计划', text: '制定学习计划', action: 'make_plan' },
  { icon: 'brain', label: '弱项', text: '分析我的薄弱点', action: 'analyze_weakness' }
];

/**
 * 生成意图确认消息 — 用于在 Chat 中显示
 * @param {object} intent - detectIntent 的返回值
 * @returns {string} 确认消息
 */
export function getIntentConfirmMessage(intent) {
  if (!intent) return '';
  const messages = {
    generate_quiz: intent.params?.subject
      ? `好的，我来帮你出${intent.params.count || '一组'}${intent.params.subject}题 →`
      : `好的，准备出题了 →`,
    start_review: '开始今日复习，用遗忘曲线帮你安排最佳时机 →',
    review_mistakes: '来看看错题，找到薄弱点 →',
    make_plan: '根据你的考试时间和掌握情况，生成专属学习计划 →',
    mock_exam: '准备好了？来一场模拟考试 →',
    search_school: '帮你查院校信息 →',
    analyze_weakness: '正在分析你的学习数据，找出薄弱环节 →'
  };
  return messages[intent.action] || '';
}
