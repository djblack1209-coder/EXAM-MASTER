import { effectiveGrade, questionKey } from './learning-domain.js';
import {
  ALGEBRA_LIMITS,
  createAlgebraQuestion,
  NAMED_EQUATION_CONTRACT,
  NAMED_LINEAR_INEQUALITY_CONTRACT
} from '../../../laf-backend/functions/_shared/learning-algebra.js';
import { createFractionQuestion, FRACTION_CONTRACT } from '../../../laf-backend/functions/_shared/learning-fraction.js';
import { createScienceQuestion } from '../../../laf-backend/functions/_shared/learning-science.js';
import { DENSITY_TEMPLATE } from '../../../laf-backend/functions/_shared/learning-density.js';
import { PRESSURE_TEMPLATE } from '../../../laf-backend/functions/_shared/learning-pressure.js';
import { ENERGY_TEMPLATE, VELOCITY_GRAPH_TEMPLATE } from '../../../laf-backend/functions/_shared/learning-visual.js';
import {
  createWritingQuestion,
  EMAIL_WRITING_CONTRACT
} from '../../../laf-backend/functions/_shared/learning-writing.js';
import { createSentenceQuestion } from '../../../laf-backend/functions/_shared/learning-sentence.js';
import cachedPoem from './poetry-cache.json';

export const CHAT_ENTRY_CONTRACT = 'learning-chat-entry-v1';
const poem = Object.freeze({ ...cachedPoem });

// A school level alone is not a subject. Keep the same explicit math cue for clarification and suggestions.
export function hasChatMathTopic(raw) {
  return (
    typeof raw === 'string' &&
    /数学|方程|不等式|\b(?:maths?|mathematics|mathematical|equations?|inequalit(?:y|ies))\b/iu.test(raw)
  );
}

// Only explicit topic requests select a bounded original exercise. No skill or curriculum inference.
export function localChatOpening(raw) {
  const sentenceTopic = /^(?:(review|practice|study)\s+)?(?:English\s+)?sentence (?:building|ordering)[.!]?$/iu.exec(
    raw.trim()
  );
  if (sentenceTopic) return { goal: '英文句子组织', replaceActive: Boolean(sentenceTopic[1]) };
  const emailTopic = /^(?:(review|practice|study)\s+)?(?:(?:English\s+)?email writing|writing emails)[.!]?$/iu.exec(
    raw.trim()
  );
  if (emailTopic) return { goal: '英文邮件写作', replaceActive: Boolean(emailTopic[1]) };
  const graphTopic = /^(?:(review|practice|study)\s+)?velocity[-–— ]time graph[.!]?$/iu.exec(raw.trim());
  if (graphTopic) return { goal: '速度—时间图', replaceActive: Boolean(graphTopic[1]) };
  const englishTopic =
    /^(?:(review|practice|study)\s+)?(equations|linear inequalities|fractions|density|(?:contact )?pressure|work and kinetic energy)[.!]?$/iu.exec(
      raw.trim()
    );
  if (englishTopic)
    return {
      goal: {
        density: '密度',
        pressure: '压强',
        'contact pressure': '压强',
        'work and kinetic energy': '功与动能',
        fractions: '1/2 + 1/3',
        equations: '解关于 t 的方程 2*t+3=9',
        'linear inequalities': '解关于 t 的不等式 -2*t+6>0'
      }[englishTopic[2].toLowerCase()],
      replaceActive: Boolean(englishTopic[1])
    };
  const request = raw
    .trim()
    .replace(/[。！!]+$/u, '')
    .replace(/^(?:我想(?:要)?|想|请(?:帮我)?|帮我)\s*/u, '')
    .replace(/^(?:复习|练习|学习)\s*/u, '');
  if (/^(?:英文|英语)句子(?:组织|排序)$/u.test(request))
    return {
      goal: '英文句子组织',
      replaceActive: /^(?:(?:我想(?:要)?|想|请(?:帮我)?|帮我)\s*)?(?:复习|练习|学习)\s*/u.test(raw.trim())
    };
  if (/^(?:英文|英语)邮件(?:写作)?$/u.test(request))
    return {
      goal: '英文邮件写作',
      replaceActive: /^(?:(?:我想(?:要)?|想|请(?:帮我)?|帮我)\s*)?(?:复习|练习|学习)\s*/u.test(raw.trim())
    };
  if (/^(?:功[与和]动能|速度[—–－-]?时间图)$/u.test(request))
    return {
      goal: request.startsWith('速度') ? '速度—时间图' : '功与动能',
      replaceActive: /^(?:(?:我想(?:要)?|想|请(?:帮我)?|帮我)\s*)?(?:复习|练习|学习)\s*/u.test(raw.trim())
    };
  const topic =
    /^(?:(?:那就|先|从)\s*)?(一次不等式|方程|分数(?:四则|加减|乘除)?|密度(?:、质量与体积|与质量)?|压强(?:、压力与接触面积|与压力)?)(?:开始|入手)?(?:[,，]\s*(?:先)?(?:做|练)(?:一|1)道(?:题)?)?$/u.exec(
      request
    );
  if (topic)
    return {
      goal: topic[1].startsWith('压强')
        ? '压强'
        : topic[1].startsWith('密度')
          ? '密度'
          : topic[1].startsWith('分数')
            ? topic[1] === '分数乘除'
              ? '2/3 ÷ 4/5'
              : '1/2 + 1/3'
            : topic[1] === '方程'
              ? '解关于 t 的方程 2*t+3=9'
              : '解关于 t 的不等式 -2*t+6>0',
      replaceActive: /^(?:(?:我想(?:要)?|想|请(?:帮我)?|帮我)\s*)?(?:复习|练习|学习)\s*/u.test(raw.trim())
    };
  const marker = /^(?:题目|题干|原题|这道题)(?:[：:]\s*|是\s*)/u;
  const explicitQuestion = marker.test(request);
  const expression = request.replace(marker, '').trim();
  const fraction = expression.replace(/^(?:计算|算一算)\s*/u, '');
  if (createFractionQuestion('chat-preview', fraction)) return { goal: fraction, replaceActive: explicitQuestion };
  if (/^(?:(?:实数|整数|正数)(?:范围内)?\s*)?解(?:关于|方程|不等式|二次不等式)/u.test(expression))
    return { goal: expression, replaceActive: true };
  // Interpret only bounded, unambiguous x problems. The existing validator remains the sole authority.
  const symbols = expression.replace(/\\(?:frac|leq?|geq?)/gu, '');
  const comparisons = expression.replace(/\\leq?/gu, '≤').replace(/\\geq?/gu, '≥');
  const relations = comparisons.match(/<=|>=|[=<>≤≥]/gu) || [];
  if (
    expression.length <= ALGEBRA_LIMITS.characters &&
    /^[\d\sx.+\-−–*/^()（）{}=<>≤≥×·÷²³$]+$/u.test(symbols) &&
    symbols.includes('x') &&
    relations.length === 1
  ) {
    const sides = comparisons.split(/<=|>=|[=<>≤≥]/u);
    // A lone assignment/answer needs the original question, unless explicitly labelled as a question.
    if (explicitQuestion || !sides.some((side) => side.trim() === 'x')) {
      const goal = `解关于 x 的${relations[0] === '=' ? '方程' : '不等式'} ${expression}`;
      if (createAlgebraQuestion('chat-preview', goal)?.validation) return { goal, replaceActive: explicitQuestion };
    }
  }
  if (explicitQuestion || relations.length)
    return {
      message: '请补充完整题目、未知量和已知条件；这条暂不记为作答。',
      replaceActive: explicitQuestion,
      ...(explicitQuestion && expression ? { pendingPrompt: expression } : {})
    };
  return {
    message: /(?:英文|英语|English).*(?:写作|writing)|writing.*(?:English|emails?)/iu.test(raw)
      ? '想先练哪种写作？比如英文邮件，也可以直接贴题。'
      : /物理|physics/iu.test(raw)
        ? '想先练哪个知识点？比如密度，也可以直接贴题。'
        : hasChatMathTopic(raw)
          ? '想先练哪个知识点？比如方程或一次不等式，也可以直接贴题。'
          : '你想先解决哪道题或哪个知识点？可以直接贴题。'
  };
}

export function localDensityQuestion(id, conversationId, goal) {
  if (!/^密度(?:、质量与体积|与质量)?[。.!]?$/u.test(goal.trim()) || !conversationId) return null;
  return createScienceQuestion(id, conversationId, {
    template: DENSITY_TEMPLATE,
    target: 'density',
    massG: 120,
    volumeCm3: 50
  });
}

export function localPressureQuestion(id, conversationId, goal) {
  if (!/^压强(?:、压力与接触面积|与压力)?[。.!]?$/u.test(goal.trim()) || !conversationId) return null;
  return createScienceQuestion(id, conversationId, {
    template: PRESSURE_TEMPLATE,
    target: 'pressure',
    uniformContact: true,
    normalForceN: 72,
    areaCm2: 24
  });
}

export function localEnergyQuestion(id, conversationId, goal) {
  if (!/^功与动能[。.!]?$/u.test(goal.trim()) || !conversationId) return null;
  return createScienceQuestion(id, conversationId, {
    template: ENERGY_TEMPLATE,
    massKg: 2,
    initialVelocityMps: 1,
    netForceN: 4,
    direction: 'right',
    physicalSeconds: 2
  });
}

export function localVelocityGraphQuestion(id, conversationId, goal) {
  if (!/^速度—时间图[。.!]?$/u.test(goal.trim()) || !conversationId) return null;
  return createScienceQuestion(id, conversationId, {
    template: VELOCITY_GRAPH_TEMPLATE,
    points: [
      { time: 0, velocity: 2 },
      { time: 2, velocity: -2 },
      { time: 4, velocity: 0 }
    ]
  });
}

export function localChatQuestion(id, opening, conversationId) {
  if (opening.goal)
    return (
      createAlgebraQuestion(id, opening.goal) ||
      createFractionQuestion(id, opening.goal) ||
      localDensityQuestion(id, conversationId, opening.goal) ||
      localPressureQuestion(id, conversationId, opening.goal) ||
      localEnergyQuestion(id, conversationId, opening.goal) ||
      localVelocityGraphQuestion(id, conversationId, opening.goal) ||
      (opening.goal === '英文句子组织' && conversationId ? createSentenceQuestion(id, conversationId) : null) ||
      (opening.goal === '英文邮件写作' && conversationId ? createWritingQuestion(id, conversationId, 'email') : null)
    );
  if (!opening.pendingPrompt) return null;
  // A clearly supplied new question owns its pending answer; it never inherits the previous question's grade.
  return {
    id,
    version: 1,
    scope: 'private',
    prompt: opening.pendingPrompt,
    source: { kind: 'user_input' },
    validation: null,
    uncertainties: [{ field: '题意与独立判分依据', resolved: false }],
    publishable: false
  };
}

export function chatQuestionMessage(question) {
  if (question.sentenceExercise) return '点选词块组织句子，明确提交后保存作答。';
  if (question.writingExercise?.contract === EMAIL_WRITING_CONTRACT)
    return '先写一版完整邮件，明确提交后保存原稿；反馈暂待核对。';
  return question.validation
    ? '先从这道题开始。请发来你的完整答案，也可以说“带我一步步理解”。'
    : '这道题暂不能自动核验。可以保留原题和作答，或先练一道可核验的题。';
}

// This tiny verified cache is the nonblocking fallback. No model/API call, random choice, or student query.
export function poetryEncouragement(state, conversationId, attemptId, { available = true } = {}) {
  if (!available) return null;
  const conversation = state.conversations.find((item) => item.id === conversationId);
  const attempt = state.attempts.find((item) => item.id === attemptId && item.conversationId === conversationId);
  const question = state.questions.find((item) => questionKey(item) === attempt?.questionKey);
  const grade = attempt && effectiveGrade(attempt);
  if (
    !conversation ||
    conversation.stopped ||
    !attempt ||
    conversation.activeQuestionKey !== attempt.questionKey ||
    attempt.kind !== 'variant' ||
    !Array.isArray(attempt.hints) ||
    attempt.hints.length ||
    grade?.status !== 'reliable' ||
    grade.outcome !== 'correct' ||
    grade.authority !== 'executable' ||
    question?.subject !== '数学' ||
    !(
      [NAMED_EQUATION_CONTRACT, NAMED_LINEAR_INEQUALITY_CONTRACT].includes(question.algebra?.contract) ||
      question.source?.evidenceId === FRACTION_CONTRACT
    )
  )
    return null;
  const id = `${conversationId}:poetry:${poem.id}`;
  if (conversation.messages.some((message) => message.id === id) || state.events.some((event) => event.id === id))
    return null;
  return {
    id,
    content: `妙哉妙哉，这次独立变式答对了。\n「${poem.text}」\n——${poem.author}《${poem.title}》\n出处：${poem.edition}（题下注一作朱斌诗）。\n${poem.sourceUrl}`
  };
}

export function validatedPoetryReference(value) {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.keys(value).length !== 4 ||
    value.referenceId !== poem.id ||
    value.sourceUrl !== poem.sourceUrl ||
    value.provider !== 'https://poetry.palemoky.com' ||
    typeof value.upstreamPoemId !== 'string' ||
    !/^\d{1,12}$/u.test(value.upstreamPoemId)
  )
    return null;
  return Object.freeze({
    referenceId: value.referenceId,
    sourceUrl: value.sourceUrl,
    upstreamPoemId: value.upstreamPoemId,
    provider: value.provider
  });
}
