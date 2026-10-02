import { assert, questionKey, knowledgeScope, summarizeLearning, effectiveGrade } from './learning-domain.js';
import { algebraTeaching } from '../../../laf-backend/functions/_shared/learning-algebra.js';
import { conditionTeaching } from '../../../laf-backend/functions/_shared/learning-condition.js';
import { conditionProbeTeaching } from '../../../laf-backend/functions/_shared/learning-condition-probe.js';
import { RUBRIC_CONTRACT, RUBRIC_EVIDENCE_CONTRACT } from '../../../laf-backend/functions/_shared/learning-rubric.js';
export {
  createConditionQuestion,
  createConditionVariant
} from '../../../laf-backend/functions/_shared/learning-condition.js';
import { conversationStrategy } from '../../../laf-backend/functions/_shared/learning-strategy.js';
import {
  observeTeaching,
  requestedTeachingMethod
} from '../../../laf-backend/functions/_shared/learning-teaching-observation.js';
export {
  createAlgebraQuestion,
  createAlgebraVariant
} from '../../../laf-backend/functions/_shared/learning-algebra.js';

// 权限是宿主授予的，模型只能请求下面的工具，不能提升权限或修改参考答案。
export const LEARNING_TOOLS = Object.freeze({
  progress: { version: '1.0', permission: 'read', writes: false, costs: false, timeoutMs: 2000 },
  focus: { version: '1.0', permission: 'learn', writes: true, costs: false, timeoutMs: 2000 },
  submit: { version: '1.0', permission: 'learn', writes: true, costs: false, timeoutMs: 2000 },
  hint: { version: '1.0', permission: 'learn', writes: true, costs: false, timeoutMs: 2000 },
  method: { version: '1.0', permission: 'learn', writes: true, costs: false, timeoutMs: 2000 },
  assess: { version: '1.2', permission: 'learn', writes: true, costs: false, timeoutMs: 2000 },
  plan: { version: '1.0', permission: 'learn', writes: true, costs: false, timeoutMs: 2000 },
  stop: { version: '1.0', permission: 'learn', writes: true, costs: false, timeoutMs: 2000 }
});
export function executeLearningTool(repository, call, context) {
  const tool = LEARNING_TOOLS[call?.name];
  assert(tool, 'UNKNOWN_TOOL', '工具不在允许清单中');
  assert(context.permissions.includes(tool.permission), 'FORBIDDEN', '没有此工具权限');
  assert(!context.signal?.aborted, 'CANCELLED', '操作已取消');
  assert(context.calls < context.maxCalls && Date.now() <= context.deadline, 'BUDGET_LIMIT', '任务工具预算已用完');
  assert(
    call && call.arguments && typeof call.arguments === 'object' && !Array.isArray(call.arguments),
    'INVALID_INPUT',
    '工具参数不合法'
  );
  const allowed = {
    progress: [],
    focus: ['questionKey'],
    submit: ['answer'],
    hint: ['content', 'level'],
    method: ['method', 'difficulty', 'reason'],
    assess: ['attemptId', 'outcome', 'dimensions', 'feedback', 'rubricId'],
    plan: ['tasks', 'reason'],
    stop: []
  }[call.name];
  assert(
    Object.keys(call.arguments).every((key) => allowed.includes(key)),
    'FORBIDDEN',
    '工具参数超出权限'
  );
  context.calls += 1;
  const lockedMethod = context.lockedMethod || requestedTeachingMethod(repository.read(), context.conversationId);
  if (call.name === 'method' && lockedMethod)
    assert(call.arguments.method === lockedMethod, 'USER_PREFERENCE', '本轮应遵循用户明确指定的方法');
  if (call.name === 'plan') {
    const state = repository.read();
    assert(
      Array.isArray(call.arguments.tasks) && call.arguments.tasks.length <= 20,
      'RESOURCE_LIMIT',
      '模型每次最多组织20项任务'
    );
    assert(
      call.arguments.tasks.every(
        (t) => !t.questionKey || state.questions.some((q) => questionKey(q) === t.questionKey)
      ),
      'INVALID_INPUT',
      '计划不能关联不存在的题目'
    );
  }
  const started = Date.now();
  let result;
  let operationReused = false;
  let legacyAssessmentReplay = false;
  try {
    if (call.name === 'progress') {
      const state = repository.read();
      result = {
        ...summarizeLearning(state),
        teaching: observeTeaching(state, { conversationId: context.conversationId })
      };
    } else if (call.name === 'method' && lockedMethod)
      result = conversationStrategy(repository.read(), context.conversationId);
    else {
      const type = {
        focus: 'question.focus',
        submit: 'attempt.submit',
        hint: 'hint.add',
        method: 'strategy.set',
        assess: 'assessment.assist',
        plan: 'plan.set',
        stop: 'task.stop'
      }[call.name];
      // 模型不能替用户提交答案。submit 只由明确的用户作答触发。
      assert(call.name !== 'submit' || context.origin === 'user', 'FORBIDDEN', '模型不能代替用户作答');
      const assessmentState = call.name === 'assess' ? repository.read() : null;
      const assessmentKey = assessmentState?.attempts.find((a) => a.id === call.arguments.attemptId)?.questionKey;
      const assessmentQuestion = assessmentState?.questions.find((q) => questionKey(q) === assessmentKey);
      const priorAssessment = assessmentState?.events.find((e) => e.id === call.id);
      legacyAssessmentReplay =
        priorAssessment?.type === 'assessment.assist' &&
        [undefined, RUBRIC_CONTRACT].includes(priorAssessment.data.rubricContract);
      const rubricContract = legacyAssessmentReplay
        ? priorAssessment.data.rubricContract
        : assessmentQuestion?.rubric
          ? RUBRIC_EVIDENCE_CONTRACT
          : undefined;
      const outcome = repository.commit({
        id: call.id,
        type,
        data: {
          ...call.arguments,
          conversationId: context.conversationId,
          ...(call.name === 'method' ? { deliveryManaged: true } : {}),
          ...(call.name === 'method' ? { source: 'model' } : {}),
          ...(call.name === 'assess' ? { model: context.model || 'model' } : {}),
          ...(rubricContract ? { rubricContract } : {})
        }
      });
      result = outcome.result;
      operationReused = outcome.reused;
    }
    const priorReceipt = operationReused && repository.read().events.find((e) => e.id === `${call.id}:receipt`);
    if (priorReceipt)
      assert(
        priorReceipt.type === 'execution.record' &&
          priorReceipt.data.tool === call.name &&
          (priorReceipt.data.version === tool.version ||
            (legacyAssessmentReplay && ['1.0', '1.1'].includes(priorReceipt.data.version))) &&
          priorReceipt.data.status === 'success',
        'IDEMPOTENCY_CONFLICT',
        '原工具收据与重试任务不一致'
      );
    if (!priorReceipt)
      repository.commit({
        id: `${call.id}:receipt`,
        type: 'execution.record',
        data: {
          tool: call.name,
          version: tool.version,
          status: 'success',
          durationMs: Date.now() - started
        }
      });
    return { success: true, result, executionId: `${call.id}:receipt` };
  } catch (error) {
    repository.commit({
      id: `${call.id}:failure`,
      type: 'execution.record',
      data: {
        tool: call.name,
        version: tool.version,
        status: 'failed',
        errorCode: error.code || 'TOOL_FAILED'
      }
    });
    throw error;
  }
}
export function userDirective(raw, state, conversationId) {
  const value = raw.trim();
  const latest = conversationStrategy(state, conversationId).method;
  if (/^(停止|停下|结束当前任务)[。！!]?/.test(value)) return { type: 'task.stop', data: { conversationId } };
  if (/^(?:恢复自动教法|恢复自动教学|自动选择教法)[。！!]?$/u.test(value))
    return { type: 'strategy.auto', data: { conversationId, source: 'self_report' } };
  if (/^(?:继续当前任务|恢复当前任务)[。！!]?$/u.test(value))
    return { type: 'task.resume', data: { conversationId, source: 'self_report' } };
  const common = {
    conversationId,
    reason: `用户明确要求：${value.slice(0, 160)}`,
    evidenceIds: [],
    source: 'self_report',
    deliveryManaged: true
  };
  if (/直接讲解|不要反问/.test(value)) return { type: 'strategy.set', data: { ...common, method: 'explain' } };
  if (/画图|图形|图示|数轴/.test(value)) return { type: 'strategy.set', data: { ...common, method: 'diagram' } };
  if (/太简单|提高难度|综合挑战/.test(value))
    return { type: 'strategy.set', data: { ...common, method: 'challenge', difficulty: 'harder' } };
  if (/降低难度|太难|简单一点/.test(value))
    return { type: 'strategy.set', data: { ...common, method: 'steps', difficulty: 'easier' } };
  if (/换一个例子|换个例子/.test(value)) return { type: 'strategy.set', data: { ...common, method: 'example' } };
  if (/提示|给点线索/.test(value)) return { type: 'strategy.set', data: { ...common, method: 'hint' } };
  if (/引导|问我|提问/.test(value)) return { type: 'strategy.set', data: { ...common, method: 'question' } };
  if (/换方法|换一种/.test(value))
    return { type: 'strategy.set', data: { ...common, method: latest === 'analogy' ? 'steps' : 'analogy' } };
  if (/^(调整目标|我的目标)[：:是为 ]/.test(value))
    return {
      type: 'profile.set',
      data: {
        field: 'goal',
        conversationId,
        value: value.replace(/^(调整目标|我的目标)[：:是为 ]+/, ''),
        source: 'self_report',
        scope: '当前任务'
      }
    };
  if (/今天只复习错题/.test(value)) {
    const seen = new Set();
    const tasks = summarizeLearning(state)
      .mistakes.filter((a) => {
        if (seen.has(a.questionKey)) return false;
        seen.add(a.questionKey);
        return true;
      })
      .map((a) => ({
        id: `review_${a.questionKey}`,
        title: '错题复测',
        questionKey: a.questionKey,
        condition: 'submitted'
      }));
    return { type: 'plan.set', data: { tasks, reason: '用户要求今天只复习错题；旧计划版本保留' } };
  }
  const minutes = /(?:今天|每天|我)(?:只有|能投入|可以学习)?\s*(\d{1,3})\s*分钟/.exec(value);
  if (minutes)
    return {
      type: 'profile.set',
      data: { field: 'minutes', value: minutes[1], source: 'self_report', scope: '当前任务' }
    };
  if (/我的基础|基础较好|已经掌握基础|不懂抽象|抽象.*困难/.test(value))
    return {
      type: 'profile.set',
      data: { field: 'foundation', value: value.slice(0, 500), source: 'self_report', scope: '当前任务' }
    };
  return null;
}
export function nextStrategy(state, attempt) {
  if (
    conversationStrategy(state, attempt.conversationId).stopped ||
    requestedTeachingMethod(state, attempt.conversationId)
  )
    return null;
  const q = state.questions.find((item) => questionKey(item) === attempt.questionKey);
  if (!q || effectiveGrade(attempt)?.status !== 'reliable') return null;
  const questions = new Map(state.questions.map((item) => [questionKey(item), item]));
  const recent = state.attempts
    .filter((a) => {
      const question = questions.get(a.questionKey);
      if (attempt.conversationId && a.conversationId !== attempt.conversationId) return false;
      return knowledgeScope(question) === knowledgeScope(q) && effectiveGrade(a).status === 'reliable';
    })
    .slice(-2);
  const common = { source: 'observed', ...(attempt.conversationId ? { conversationId: attempt.conversationId } : {}) };
  if (recent.length === 2 && recent.every((a) => effectiveGrade(a).outcome === 'wrong')) {
    const observations = observeTeaching(state, {
      conversationId: attempt.conversationId,
      scope: knowledgeScope(q)
    }).rows;
    const latest = [...observations].reverse().find((row) => row.lastOutcome?.attemptId === attempt.id);
    if (latest?.status === 'blocked') {
      const method =
        latest.method === 'prerequisite'
          ? 'steps'
          : latest.method === 'steps'
            ? 'example'
            : latest.method === 'example'
              ? 'analogy'
              : 'steps';
      return {
        ...common,
        method,
        difficulty: 'easier',
        reason: '实际教学后仍在本题受阻，换一种表达并缩小步骤；不据此判断整科能力',
        evidenceIds: recent.map((a) => a.id)
      };
    }
    return {
      ...common,
      method: 'prerequisite',
      difficulty: 'easier',
      reason: '同一知识点最近两次可靠作答受阻，先检查先修概念并拆分步骤',
      evidenceIds: recent.map((a) => a.id)
    };
  }
  if (attempt.hints.length && effectiveGrade(attempt).outcome === 'correct')
    return {
      ...common,
      method: 'check',
      reason: '本次提示后正确，下一步独立检验；还不能证明教法有效或长期掌握',
      evidenceIds: [attempt.id]
    };
  return null;
}

export function localTeaching(question, method, level = 1) {
  const probe = conditionProbeTeaching(question, method, level);
  if (probe) return probe;
  const condition = conditionTeaching(question, method, level);
  if (condition) return condition;
  const algebra = algebraTeaching(question, method, level);
  if (algebra) return algebra;
  if (!question || question.source?.kind !== 'executable') return null;
  const match = /^计算 ([+-]?\d{1,5}) ([+×*]) ([+-]?\d{1,5})。$/.exec(question.prompt);
  if (!match) return null;
  const a = Number(match[1]),
    b = Number(match[3]);
  const answer = match[2] === '+' ? a + b : a * b;
  const sum = match[2] === '+';
  const direction = b >= 0 ? '向右' : '向左';
  const direct = `${a} ${match[2]} ${b} = ${answer}。这是有限整数工具的计算结果。`;
  const segments = {
    explain: { content: direct, level: 3 },
    question: {
      content: sum
        ? `第二个数 ${b} 的正负号意味着从起点向哪个方向移动？先回答方向，再计算。`
        : `两个因子分别是什么符号？先判断积的符号，不急着算大小。`,
      level: 1
    },
    hint: {
      content:
        level >= 3
          ? direct
          : level === 2
            ? sum
              ? `从 ${a} ${direction}移动 ${Math.abs(b)} 个单位。请自己确定终点。`
              : `先算 ${Math.abs(a)} × ${Math.abs(b)} 的绝对值，再结合两个因子的符号。`
            : sum
              ? '加正数向右，加负数向左。先判断方向。'
              : '同号相乘为正，异号为负；含零积为零。先判断符号。',
      level: Math.min(3, Math.max(1, level))
    },
    steps: {
      content: sum
        ? `① 起点为 ${a}。② 根据 ${b} 的符号${direction}。③ 移动 ${Math.abs(b)} 个单位，终点为 ${answer}。最后用逆运算检验。`
        : `① 绝对值相乘：${Math.abs(a)} × ${Math.abs(b)} = ${Math.abs(answer)}。② 检查符号：${direct}③ 含零时单独确认。`,
      level: 3
    },
    prerequisite: {
      content: sum
        ? '先补充先修概念：在数轴上，加正数向右，加负数向左，移动距离取绝对值。用这条规则检查原题的方向与距离；随后用独立变式检验效果。'
        : '先补充先修概念：两个负数相乘为正，一正一负相乘为负，含零时积为零。用这条规则检查原题的符号；随后用独立变式检验效果。',
      level: 1
    },
    example: {
      content: sum
        ? '先看另一个例题：5 + (-2)。从 5 向左走 2 个单位得到 3，再用 3 + 2 = 5 检验。现在回到原题，换用相同的方法。'
        : '先看另一个例题：-3 × 4。先算 3 × 4 = 12，异号决定结果为 -12。现在独立迁移到原题。',
      level: 2
    },
    analogy: {
      content: sum
        ? `可以把整数看成账户余额：增加正数是存入，增加负数是扣除。当前余额 ${a}，这次${b >= 0 ? '存入' : '扣除'} ${Math.abs(b)}。请把情境写回加法，再计算。`
        : '把乘法看成数值缩放：绝对值表示放大倍数，负号表示方向翻转；两个负号翻转两次。类比只帮助理解符号，还需按原式检验。',
      level: 2
    },
    diagram: sum
      ? {
          content: `数轴从 ${a} ${direction}移动 ${Math.abs(b)} 个单位，终点为 ${answer}。图形按数值比例呈现。`,
          level: 3
        }
      : null,
    check: {
      content: '请独立作答。已看到的讲解和提示仍会保留，切换教法不会清除帮助经历；可用新变式检验迁移。',
      helped: false
    },
    review: { content: '开始原题复测。此前经历保留；本次表现不能单独证明长期掌握。', helped: false }
  };
  const segment = segments[method];
  return segment ? { helped: true, method, ...segment } : null;
}

export function createArithmeticChallenge(id, parent) {
  const match =
    parent?.source?.kind === 'executable' && /^计算 ([+-]?\d{1,5}) \+ ([+-]?\d{1,5})。$/.exec(parent.prompt);
  if (!match) return null;
  const a = Number(match[1]),
    b = Number(match[2]);
  return {
    id,
    version: 1,
    scope: 'generated',
    prompt: `计算 (${a} + ${b}) × -2。`,
    subject: '数学',
    knowledgePoint: '运算顺序与符号',
    parentQuestionKey: questionKey(parent),
    variantChange: '组合加法、乘法与负数，检验运算顺序和符号迁移',
    source: { kind: 'executable', evidenceId: 'integer-combination-v1' },
    validation: {
      type: 'number',
      answer: String((a + b) * -2),
      authority: 'executable',
      evidenceId: 'integer-combination-v1'
    },
    validationResult: { solvable: true, verified: true },
    uncertainties: [],
    difficulty: 'harder'
  };
}

export function createArithmeticQuestion(id, goal, difficulty = 'self_report', parent = null) {
  // 有限的可执行验题工具，演示教学机制，不宣称覆盖全学科。
  const match = /^\s*([+-]?\d{1,5})\s*([+×*])\s*([+-]?\d{1,5})\s*[=？?]?\s*$/.exec(goal);
  if (!match) return null;
  const a = Number(match[1]);
  const b = Number(match[3]);
  const op = match[2];
  const answer = op === '+' ? a + b : a * b;
  if (parent)
    return {
      id,
      version: 1,
      prompt:
        op === '+' ? `已知一个数加 ${b} 得到 ${answer}，求这个数。` : `已知一个数乘 ${b} 得到 ${answer}，求这个数。`,
      scope: 'generated',
      source: { kind: 'executable', evidenceId: 'integer-arithmetic-v1' },
      subject: '数学',
      knowledgePoint: op === '+' ? '加法与逆运算' : '乘法与逆运算',
      parentQuestionKey: questionKey(parent),
      variantChange: '改变解题方向和表达',
      validation:
        op === '+' || b !== 0
          ? { type: 'number', answer: String(a), authority: 'executable', evidenceId: 'integer-arithmetic-v1' }
          : null,
      validationResult: { solvable: op === '+' || b !== 0, verified: op === '+' || b !== 0 },
      uncertainties: b === 0 && op !== '+' ? [{ resolved: false, field: '条件', reason: '零组不足以唯一确定答案' }] : []
    };
  return {
    id,
    version: 1,
    prompt: `计算 ${a} ${op} ${b}。`,
    scope: 'generated',
    subject: '数学',
    knowledgePoint: '整数运算',
    difficulty,
    source: { kind: 'executable', evidenceId: 'integer-arithmetic-v1' },
    validation: {
      type: 'number',
      answer: String(answer),
      authority: 'executable',
      evidenceId: 'integer-arithmetic-v1'
    },
    uncertainties: []
  };
}
