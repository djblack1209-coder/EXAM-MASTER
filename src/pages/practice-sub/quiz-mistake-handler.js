/**
 * 错题本处理模块
 * 从 do-quiz.vue 提取，负责错题的云端/本地保存与智能解析更新
 *
 * ⚠️ 隐藏约束（Chesterton's Fence）：
 * - 双字段兼容：wrongCount/wrong_count、question/question_content 等是迁移期产物，必须同时写入
 * - 云端失败时降级到本地存储，本地记录标记 sync_status: 'pending'
 * - existingMistake 查找同时匹配 question 文本和 id/_id，因为历史数据格式不统一
 */

import { storageService } from '@/services/storageService.js';
import { logger } from '@/utils/logger.js';
import { lafService } from '@/services/lafService.js';
import { toast } from '@/utils/toast.js';

/**
 * 保存错题到错题本（云端优先，失败降级本地）
 * @param {Object} params
 * @param {Object} params.currentQuestion - 当前题目对象
 * @param {number} params.userChoice - 用户选择的选项索引
 * @param {string} params.aiComment - 智能解析评论
 */
export async function saveToMistakes({ currentQuestion, userChoice, aiComment }) {
  if (!currentQuestion) return;

  const loader = toast.loading('保存错题中...');

  const questionText = currentQuestion.question || currentQuestion.title;
  const userAnswer =
    currentQuestion.options && currentQuestion.options[userChoice]
      ? String.fromCharCode(65 + userChoice) // A, B, C, D
      : '';
  const correctAnswer = currentQuestion.answer || '';

  // 检查是否已存在（先查本地缓存）
  const localMistakes = storageService.get('mistake_book', []);
  const existingMistake = localMistakes.find(
    (m) =>
      m.question === questionText ||
      m.question_content === questionText ||
      (m.id && m.id === currentQuestion.id) ||
      (m._id && m._id === currentQuestion.id)
  );

  // 构建符合 Schema 的数据格式
  const mistakeData = {
    question_content: questionText,
    options: currentQuestion.options || [],
    user_answer: userAnswer,
    correct_answer: correctAnswer,
    analysis: aiComment || currentQuestion.desc || '',
    tags: currentQuestion.tags || [],
    wrong_count: existingMistake ? (existingMistake.wrong_count || existingMistake.wrongCount || 1) + 1 : 1,
    is_mastered: false
  };

  try {
    // 使用云端方法保存（自动云端+本地同步）
    const result = await storageService.saveMistake(mistakeData);

    loader.hide();

    if (result.success) {
      logger.log('[quiz-mistake] 错题已保存到云端:', result.id);
      // 如果需要更新已有记录的错误次数，可以在这里处理
      if (existingMistake && result.source === 'cloud') {
        // 云端保存成功，更新本地缓存中的错误次数
        const updatedMistakes = storageService.get('mistake_book', []);
        const index = updatedMistakes.findIndex((m) => m.id === result.id || m._id === result.id);
        if (index >= 0) {
          updatedMistakes[index].wrong_count = mistakeData.wrong_count;
          storageService.save('mistake_book', updatedMistakes, true);
        }
      }
    } else {
      logger.warn('[quiz-mistake] 错题保存失败，已降级到本地:', result.error);
    }
  } catch (error) {
    loader.hide();
    logger.warn('[quiz-mistake] 保存错题异常，降级到本地存储:', error);
    // 异常时降级到本地保存
    const mistakes = storageService.get('mistake_book', []);
    const mistakeRecord = {
      ...currentQuestion,
      question: questionText,
      question_content: questionText,
      userChoice: userAnswer,
      user_answer: userAnswer,
      answer: correctAnswer,
      correct_answer: correctAnswer,
      desc: aiComment || currentQuestion.desc || '',
      analysis: aiComment || currentQuestion.desc || '',
      addTime: new Date().toLocaleString(),
      timestamp: Date.now(),
      wrongCount: existingMistake ? (existingMistake.wrongCount || 1) + 1 : 1,
      wrong_count: existingMistake ? (existingMistake.wrong_count || existingMistake.wrongCount || 1) + 1 : 1,
      isMastered: false,
      is_mastered: false,
      sync_status: 'pending'
    };

    if (existingMistake) {
      const index = mistakes.findIndex(
        (m) =>
          m.question === questionText || m.question_content === questionText || (m.id && m.id === currentQuestion.id)
      );
      if (index >= 0) {
        mistakes[index] = { ...mistakes[index], ...mistakeRecord };
      } else {
        mistakes.unshift(mistakeRecord);
      }
    } else {
      mistakes.unshift(mistakeRecord);
    }

    storageService.save('mistake_book', mistakes, true);
    logger.log('[quiz-mistake] ✅ 已降级到本地保存，sync_status: pending');
  }
}

/**
 * 将智能解析更新到错题本中的对应记录
 * @param {Object} params
 * @param {Object} params.currentQuestion - 当前题目对象
 * @param {string} params.aiAnalysis - 智能解析内容
 */
export function updateMistakeWithAI({ currentQuestion, aiAnalysis }) {
  const mistakes = storageService.get('mistake_book', []);
  const questionText = currentQuestion.question || currentQuestion.title;

  const mistakeIndex = mistakes.findIndex(
    (m) =>
      m.question === questionText ||
      m.question_content === questionText ||
      (m.id && m.id === currentQuestion.id) ||
      (m._id && m._id === currentQuestion.id)
  );

  if (mistakeIndex >= 0) {
    const mistake = mistakes[mistakeIndex];
    mistake.aiAnalysis = aiAnalysis;
    mistake.analysis = aiAnalysis; // 同时更新新字段
    mistake.hasAIAnalysis = true;

    // 如果有云端ID，尝试更新到云端
    const mistakeId = mistake.id || mistake._id;
    if (mistakeId && mistakeId.toString().startsWith('local_') === false) {
      // 云端记录，可以尝试更新（但云端没有单独的更新analysis方法，先更新本地）
      // 注意：如果需要更新云端，可以扩展云对象方法
    }

    // 更新本地缓存
    storageService.save('mistake_book', mistakes, true);
  }
}

/**
 * ✅ [差异化壁垒] AI自动生成记忆口诀/助记符
 * 借鉴 AnkiAIUtils 的概念：每道错题自动生成一个记忆钩子
 * 异步调用，不阻塞答题流程
 *
 * @param {Object} params
 * @param {Object} params.currentQuestion - 当前题目对象
 * @param {string} params.correctAnswer - 正确答案
 */
export async function generateMnemonic({ currentQuestion, correctAnswer }) {
  if (!currentQuestion) return;

  const questionText = currentQuestion.question || currentQuestion.title || '';
  const answer = correctAnswer || currentQuestion.answer || '';

  try {
    // 读取用户学习风格配置
    let styleHint = '';
    try {
      const config = storageService.get('learning_style_config');
      if (config?.style === 'visual') styleHint = '用图形化/表格化的方式呈现助记符。';
      else if (config?.style === 'verbal') styleHint = '用押韵或顺口溜的方式。';
      else if (config?.style === 'example') styleHint = '用一个生动的类比或故事。';
    } catch (_e) {
      /* use default */
    }

    const response = await lafService.proxyAI('analyze', {
      question: questionText,
      options: currentQuestion.options || [],
      correctAnswer: answer,
      userAnswer: '',
      mnemonicMode: true,
      learningStyleHint: `[助记符生成] 请为这道题的正确答案生成一个简短的记忆口诀或助记符（不超过30字），帮助学生快速记住关键知识点。要求朗朗上口、容易联想。${styleHint}`
    });

    if (response.code === 0 && response.data) {
      const mnemonic = response.data.trim();

      // 保存到错题记录
      const mistakes = storageService.get('mistake_book', []);
      const idx = mistakes.findIndex(
        (m) =>
          m.question === questionText || m.question_content === questionText || (m.id && m.id === currentQuestion.id)
      );

      if (idx >= 0) {
        mistakes[idx].mnemonic = mnemonic;
        mistakes[idx].hasMnemonic = true;
        storageService.save('mistake_book', mistakes, true);
        logger.log('[quiz-mistake] 助记符已生成:', mnemonic);
      }

      return mnemonic;
    }
  } catch (e) {
    logger.warn('[quiz-mistake] 助记符生成失败（不影响主流程）:', e);
  }
  return null;
}
