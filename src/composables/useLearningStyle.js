/**
 * useLearningStyle — 个性化学习风格配置
 * 借鉴 Mr.Ranedeer AI Tutor 的个性化配置理念
 *
 * 用户可配置学习深度、风格偏好、AI沟通方式，
 * 这些参数会注入到AI诊断和解析的prompt中，
 * 让AI的反馈风格匹配用户偏好。
 */
import { ref, computed } from 'vue';
import { storageService } from '@/services/storageService.js';

// 学习深度等级（借鉴 Mr.Ranedeer 的 depth 概念）
export const DEPTH_LEVELS = [
  {
    id: 'basic',
    label: '基础巩固',
    desc: '侧重概念理解和基础题',
    promptHint: '用简单直白的语言解释，多举例子，避免复杂推导'
  },
  { id: 'standard', label: '稳步提升', desc: '兼顾基础和中等难度', promptHint: '平衡解释深度，适当展示推导过程' },
  {
    id: 'advanced',
    label: '冲刺高分',
    desc: '侧重难题和易错点',
    promptHint: '深入分析解题思路，指出常见陷阱，给出举一反三的变式'
  },
  {
    id: 'expert',
    label: '满分突破',
    desc: '极限训练，追求零失误',
    promptHint: '精准定位知识盲区，用最简洁的方式点明关键，不需要基础铺垫'
  }
];

// 学习风格（借鉴 Mr.Ranedeer 的 learning style）
export const LEARNING_STYLES = [
  { id: 'visual', label: '图表型', desc: '偏好图示、表格、对比', promptHint: '多用对比表格、分类列举、结构化呈现' },
  { id: 'verbal', label: '文字型', desc: '偏好详细文字解释', promptHint: '用完整的文字叙述，逻辑清晰，层层递进' },
  {
    id: 'example',
    label: '案例型',
    desc: '偏好通过例题理解',
    promptHint: '先给出典型例题，再总结规律，用例子驱动理解'
  },
  {
    id: 'socratic',
    label: '启发型',
    desc: '偏好引导式思考',
    promptHint: '不直接给答案，用提问引导思考，逐步揭示解题路径'
  }
];

// AI沟通语气
export const TONE_OPTIONS = [
  { id: 'encouraging', label: '鼓励型', promptHint: '语气温暖鼓励，肯定进步，错误时安慰并引导' },
  { id: 'neutral', label: '客观型', promptHint: '语气客观中性，直接指出问题和解法' },
  { id: 'strict', label: '严格型', promptHint: '语气严谨，高标准要求，直接指出不足' }
];

const STORAGE_KEY = 'learning_style_config';

const DEFAULT_CONFIG = {
  depth: 'standard',
  style: 'example',
  tone: 'encouraging',
  targetScore: 0, // 目标分数（0=未设置）
  weakSubjects: [] // 自认薄弱科目
};

export function useLearningStyle() {
  const config = ref({ ...DEFAULT_CONFIG });

  // 从本地存储恢复
  function restore() {
    const saved = storageService.get(STORAGE_KEY);
    if (saved) {
      config.value = { ...DEFAULT_CONFIG, ...saved };
    }
  }

  // 保存到本地存储
  function save() {
    storageService.save(STORAGE_KEY, config.value);
  }

  function setDepth(depth) {
    config.value.depth = depth;
    save();
  }
  function setStyle(style) {
    config.value.style = style;
    save();
  }
  function setTone(tone) {
    config.value.tone = tone;
    save();
  }
  function setTargetScore(score) {
    config.value.targetScore = score;
    save();
  }
  function setWeakSubjects(subjects) {
    config.value.weakSubjects = subjects;
    save();
  }

  // 生成注入AI prompt的个性化指令（核心输出）
  const aiPromptDirective = computed(() => {
    const depth = DEPTH_LEVELS.find((d) => d.id === config.value.depth) || DEPTH_LEVELS[1];
    const style = LEARNING_STYLES.find((s) => s.id === config.value.style) || LEARNING_STYLES[2];
    const tone = TONE_OPTIONS.find((t) => t.id === config.value.tone) || TONE_OPTIONS[0];

    let directive = `[学习者画像] 深度：${depth.label}，风格：${style.label}，语气：${tone.label}。\n`;
    directive += `[解析要求] ${depth.promptHint}。${style.promptHint}。${tone.promptHint}。`;

    if (config.value.targetScore > 0) {
      directive += `\n[目标] 考研目标分数 ${config.value.targetScore} 分，请据此调整解析深度。`;
    }
    if (config.value.weakSubjects.length > 0) {
      directive += `\n[薄弱科目] ${config.value.weakSubjects.join('、')}，遇到相关知识点请额外详细解释。`;
    }

    return directive;
  });

  // 初始化时恢复
  restore();

  return {
    config,
    aiPromptDirective,
    setDepth,
    setStyle,
    setTone,
    setTargetScore,
    setWeakSubjects,
    restore,
    save,
    DEPTH_LEVELS,
    LEARNING_STYLES,
    TONE_OPTIONS
  };
}
