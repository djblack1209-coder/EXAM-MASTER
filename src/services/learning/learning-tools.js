import { proposalStatus } from '../../../laf-backend/functions/_shared/learning-proposals.js';
import {
  ENTRY_TOOL_NAMES,
  ENTRY_TOOL_SCHEMAS,
  validateEntryCall,
  entryCandidateOperation,
  queryEntries,
  aggregateEntries
} from '../../../laf-backend/functions/_shared/learning-entries.js';
export { ENTRY_TOOL_SCHEMAS };
import {
  assert,
  questionKey,
  attemptSubmissionType,
  ORIGINAL_ANSWER_OPERATION,
  knowledgeScope,
  summarizeLearning,
  effectiveGrade,
  learningTaskContext
} from './learning-domain.js';
import { algebraTeaching } from '../../../laf-backend/functions/_shared/learning-algebra.js';
import { conditionTeaching } from '../../../laf-backend/functions/_shared/learning-condition.js';
import { conditionProbeTeaching } from '../../../laf-backend/functions/_shared/learning-condition-probe.js';
import { fieldProbeTeaching } from '../../../laf-backend/functions/_shared/learning-field-probe.js';
import {
  createExactArithmeticQuestion,
  exactArithmeticTeaching
} from '../../../laf-backend/functions/_shared/learning-arithmetic.js';
export { createExactArithmeticVariant } from '../../../laf-backend/functions/_shared/learning-arithmetic.js';
import { createFractionQuestion, fractionTeaching } from '../../../laf-backend/functions/_shared/learning-fraction.js';
import { densityHelpContent } from '../../../laf-backend/functions/_shared/learning-density.js';
import { pressureHelpContent } from '../../../laf-backend/functions/_shared/learning-pressure.js';
import {
  gradeScienceAnswer,
  ENERGY_TRANSFER_CONTRACT,
  GRAPH_TRANSFER_CONTRACT,
  DENSITY_TRANSFER_CONTRACT,
  PRESSURE_TRANSFER_CONTRACT
} from '../../../laf-backend/functions/_shared/learning-science.js';
export { createFractionVariant } from '../../../laf-backend/functions/_shared/learning-fraction.js';
import { RUBRIC_CONTRACT, RUBRIC_EVIDENCE_CONTRACT } from '../../../laf-backend/functions/_shared/learning-rubric.js';
export {
  createConditionQuestion,
  createConditionVariant
} from '../../../laf-backend/functions/_shared/learning-condition.js';
import { conversationStrategy } from '../../../laf-backend/functions/_shared/learning-strategy.js';
import { visualRecipe } from '../../../laf-backend/functions/_shared/learning-visual.js';
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
  ...Object.fromEntries(
    ENTRY_TOOL_NAMES.map((name) => [
      name,
      {
        version: '1.0',
        permission: ['entry.query', 'entry.aggregate'].includes(name) ? 'read' : 'learn',
        writes: ['entry.create', 'entry.update'].includes(name),
        costs: false,
        timeoutMs: 2000
      }
    ])
  ),
  progress: { version: '1.0', permission: 'read', writes: false, costs: false, timeoutMs: 2000 },
  visualize: { version: '1.0', permission: 'read', writes: false, costs: false, timeoutMs: 2000 },
  focus: { version: '1.0', permission: 'learn', writes: true, costs: false, timeoutMs: 2000 },
  submit: { version: '1.0', permission: 'learn', writes: true, costs: false, timeoutMs: 2000 },
  hint: { version: '1.0', permission: 'learn', writes: true, costs: false, timeoutMs: 2000 },
  method: { version: '1.0', permission: 'learn', writes: true, costs: false, timeoutMs: 2000 },
  assess: { version: '1.2', permission: 'learn', writes: true, costs: false, timeoutMs: 2000 },
  plan: { version: '2.0', permission: 'learn', writes: true, costs: false, timeoutMs: 2000 },
  stop: { version: '1.0', permission: 'learn', writes: true, costs: false, timeoutMs: 2000 }
});
export function executeLearningTool(repository, call, context) {
  context.assertCurrent?.();
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
  if (ENTRY_TOOL_NAMES.includes(call.name)) validateEntryCall(call.name, call.arguments);
  const allowed =
    {
      progress: [],
      visualize: [
        'points',
        'template',
        'outward',
        'backward',
        'direction',
        'massKg',
        'netForceN',
        'initialVelocityMps',
        'physicalSeconds',
        'segments'
      ],
      focus: ['questionKey'],
      submit: ['answer'],
      hint: ['content', 'level'],
      method: ['method', 'difficulty', 'reason'],
      assess: ['attemptId', 'outcome', 'dimensions', 'feedback', 'rubricId'],
      plan: ['tasks', 'reason'],
      stop: []
    }[call.name] || Object.keys(ENTRY_TOOL_SCHEMAS[call.name]?.properties || call.arguments);
  assert(
    Object.keys(call.arguments).every((key) => allowed.includes(key)),
    'FORBIDDEN',
    '工具参数超出权限'
  );
  context.calls += 1;
  const lockedMethod = context.lockedMethod || requestedTeachingMethod(repository.read(), context.conversationId);
  if (call.name === 'method' && lockedMethod)
    assert(call.arguments.method === lockedMethod, 'USER_PREFERENCE', '本轮应遵循用户明确指定的方法');
  if (call.name === 'visualize' && lockedMethod)
    assert(lockedMethod === 'diagram', 'USER_PREFERENCE', '用户指定其他教法时不自动切换为互动观察');
  if (call.name === 'visualize') {
    const session = repository.read().conversations.find((c) => c.id === context.conversationId);
    assert(session && !session.stopped, 'STOPPED', '没有当前学习任务或任务已停止，未生成新动画');
  }
  const started = Date.now();
  let result;
  let operationReused = false;
  let legacyAssessmentReplay = false;
  let legacyPlanReplay = false;
  try {
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
    if (call.name === 'entry.query') result = queryEntries(repository.read(), call.arguments, context);
    else if (call.name === 'entry.aggregate') result = aggregateEntries(repository.read(), call.arguments, context);
    else if (['entry.create', 'entry.update'].includes(call.name)) {
      const state = repository.read();
      if (context.sourceMessageId)
        assert(
          call.arguments.sourceRefs.every((r) => r.messageId === context.sourceMessageId),
          'FORBIDDEN',
          '候选必须来自本次用户消息'
        );
      const operation = entryCandidateOperation(state, call.name, call.arguments, context.conversationId);
      if (!operation.duplicate) {
        context.assertCurrent?.();
        repository.commit(
          { id: operation.id, type: operation.type, data: operation.data, at: operation.at },
          state.revision
        );
      }
      result = {
        proposalId: operation.proposalId,
        status: operation.proposalId ? proposalStatus(repository.read(), operation.proposalId) : 'unchanged',
        duplicate: !!operation.duplicate
      };
    } else if (call.name === 'visualize') result = visualRecipe(call.arguments);
    else if (call.name === 'progress') {
      const state = repository.read();
      result = {
        ...summarizeLearning(state),
        task: learningTaskContext(state, context.conversationId),
        teaching: observeTeaching(state, { conversationId: context.conversationId })
      };
    } else if (call.name === 'method' && lockedMethod)
      result = conversationStrategy(repository.read(), context.conversationId);
    else {
      let type = {
        focus: 'question.focus',
        submit: 'attempt.submit',
        hint: 'hint.add',
        method: 'strategy.set',
        assess: 'assessment.assist',
        plan: 'message.add',
        stop: 'task.stop'
      }[call.name];
      legacyPlanReplay =
        call.name === 'plan' &&
        repository.read().events.some((event) => event.id === call.id && event.type === 'plan.set');
      if (legacyPlanReplay) type = 'plan.set';
      // 模型不能替用户提交答案。submit 只由明确的用户作答触发。
      assert(call.name !== 'submit' || context.origin === 'user', 'FORBIDDEN', '模型不能代替用户作答');
      if (call.name === 'submit') {
        const state = repository.read();
        const session = state.conversations.find((item) => item.id === context.conversationId);
        const question = state.questions.find((item) => questionKey(item) === session?.activeQuestionKey);
        type = attemptSubmissionType(question, state.events.find((event) => event.id === call.id)?.type);
      }
      const assessmentState = call.name === 'assess' ? repository.read() : null;
      const assessmentKey = assessmentState?.attempts.find((a) => a.id === call.arguments.attemptId)?.questionKey;
      const assessmentQuestion = assessmentState?.questions.find((q) => questionKey(q) === assessmentKey);
      const priorAssessment = assessmentState?.events.find((e) => e.id === call.id);
      legacyAssessmentReplay =
        priorAssessment?.type === 'assessment.assist' &&
        [undefined, RUBRIC_CONTRACT].includes(priorAssessment.data.rubricContract);
      const rubricContract = legacyAssessmentReplay
        ? priorAssessment.data.rubricContract
        : assessmentQuestion?.rubric ||
            (assessmentQuestion?.vocabularyReview?.phase === 'usage' && call.arguments.rubricId)
          ? RUBRIC_EVIDENCE_CONTRACT
          : undefined;
      context.assertCurrent?.();
      const outcome = repository.commit({
        id: call.id,
        type,
        data:
          call.name === 'plan' && !legacyPlanReplay
            ? {
                conversationId: context.conversationId,
                role: 'assistant',
                content: '计划建议已准备，请确认后采用。',
                proposal: { type: 'plan.set', data: call.arguments }
              }
            : {
                ...call.arguments,
                conversationId: context.conversationId,
                ...(call.name === 'submit' && type === ORIGINAL_ANSWER_OPERATION ? { explicit: true } : {}),
                ...(call.name === 'method' ? { deliveryManaged: true } : {}),
                ...(call.name === 'method' ? { source: 'model' } : {}),
                ...(call.name === 'assess' ? { model: context.model || 'model' } : {}),
                ...(rubricContract ? { rubricContract } : {})
              }
      });
      result = outcome.result;
      operationReused = outcome.reused;
    }
    if (call.name === 'submit' && result.clarification)
      return { success: false, clarification: true, result, executionId: null };
    const priorReceipt = operationReused && repository.read().events.find((e) => e.id === `${call.id}:receipt`);
    if (priorReceipt)
      assert(
        priorReceipt.type === 'execution.record' &&
          priorReceipt.data.tool === call.name &&
          (priorReceipt.data.version === tool.version ||
            (legacyAssessmentReplay && ['1.0', '1.1'].includes(priorReceipt.data.version)) ||
            (legacyPlanReplay && priorReceipt.data.version === '1.0')) &&
          priorReceipt.data.status === 'success',
        'IDEMPOTENCY_CONFLICT',
        '原工具收据与重试任务不一致'
      );
    if (!priorReceipt && !['entry.query', 'entry.aggregate'].includes(call.name)) {
      context.assertCurrent?.();
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
    }
    return { success: true, result, executionId: `${call.id}:receipt` };
  } catch (error) {
    context.assertCurrent?.();
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
  // A saved answer or quoted passage has no authority to operate the learning session.
  if (/^(?:我的答案是|我的答案[：:]|答案是|我认为)/u.test(value)) return null;
  const request = value
    .replace(/^(?:请(?:你)?(?:帮我)?|麻烦(?:你)?(?:帮我)?|帮我|我想(?:要)?|我希望)\s*/u, '')
    .replace(/[。！!？?]+$/u, '')
    .trim();
  const latest = conversationStrategy(state, conversationId).method;
  if (/^(?:停止(?:当前任务)?|停下(?:当前任务)?|结束当前任务)(?:[,，；;。！!][\s\S]*)?$/u.test(request))
    return { type: 'task.stop', data: { conversationId } };
  if (/^(?:恢复自动教法|恢复自动教学|自动选择教法)$/u.test(request))
    return { type: 'strategy.auto', data: { conversationId, source: 'self_report' } };
  if (/^(?:继续当前任务|恢复当前任务)$/u.test(request))
    return { type: 'task.resume', data: { conversationId, source: 'self_report' } };
  const rhythm = /^(?:以后|保持|切换到|使用)?(整批训练|单题带练|限时训练)(?:[,，]\s*统一批改)?$/u.exec(request);
  const journey = state.conversations.find((c) => c.id === conversationId)?.journey;
  if (rhythm && journey)
    return {
      type: 'journey.configure',
      data: {
        conversationId,
        title: journey.title,
        startDay: journey.startDay,
        durationDays: journey.durationDays,
        minutes: journey.minutes,
        moduleIds: journey.moduleIds,
        mode: { 整批训练: 'batch', 单题带练: 'guided', 限时训练: 'timed' }[rhythm[1]]
      }
    };
  const common = {
    conversationId,
    reason: `用户明确要求：${value.slice(0, 160)}`,
    evidenceIds: [],
    source: 'self_report',
    deliveryManaged: true
  };
  if (/^(?:直接讲解(?:这道题|当前题目)?(?:[,，]\s*不要(?:再)?反问(?:我)?)?|不要(?:再)?反问(?:我)?)$/u.test(request))
    return { type: 'strategy.set', data: { ...common, method: 'explain' } };
  if (/^(?:用)?(?:画图|图形|图示|数轴)(?:讲解|解释|说明|表示)?(?:这道题|当前题目)?$/u.test(request))
    return { type: 'strategy.set', data: { ...common, method: 'diagram' } };
  if (/^(?:这道题)?(?:太简单(?:了)?|提高难度|综合挑战)$/u.test(request))
    return { type: 'strategy.set', data: { ...common, method: 'challenge', difficulty: 'harder' } };
  if (/^(?:这道题)?(?:降低难度|太难(?:了)?|简单一点)$/u.test(request))
    return { type: 'strategy.set', data: { ...common, method: 'steps', difficulty: 'easier' } };
  if (/^(?:换一个例子|换个例子)$/u.test(request))
    return { type: 'strategy.set', data: { ...common, method: 'example' } };
  if (/^(?:(?:给我|给点)?提示|给点线索)$/u.test(request))
    return { type: 'strategy.set', data: { ...common, method: 'hint' } };
  if (
    /^(?:这道题我不会[,，]\s*)?带我一步步理解$/u.test(request) ||
    /^(?:walk me through (?:this question )?step by step|give me a hint)[.!]?$/iu.test(request) ||
    (latest === 'hint' && /^(?:继续提示|再给一点提示)$/u.test(request))
  )
    return { type: 'strategy.set', data: { ...common, method: 'hint' } };
  if (/^(?:引导(?:我)?|问我|提问(?:我)?)$/u.test(request))
    return { type: 'strategy.set', data: { ...common, method: 'question' } };
  if (/^(?:换方法|换一种(?:方法|教法|讲法)?)$/u.test(request))
    return { type: 'strategy.set', data: { ...common, method: latest === 'analogy' ? 'steps' : 'analogy' } };
  if (/^(调整目标|我的目标)[：:是为 ]/u.test(request))
    return {
      type: 'profile.set',
      data: {
        field: 'goal',
        conversationId,
        value: request.replace(/^(调整目标|我的目标)[：:是为 ]+/u, ''),
        source: 'self_report',
        scope: '当前任务'
      }
    };
  if (/^今天只复习错题$/u.test(request)) {
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
  const minutes = /^(?:今天|每天|我(?:今天|每天)?)(?:只有|能投入|可以学习)?\s*(\d{1,3})\s*分钟$/u.exec(request);
  if (minutes)
    return {
      type: 'profile.set',
      data: { field: 'minutes', value: minutes[1], source: 'self_report', scope: '当前任务' }
    };
  if (/^(?:我的基础|基础较好$|已经掌握基础$|不懂抽象$|抽象(?:理解)?困难$)/u.test(request))
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
  if ([ENERGY_TRANSFER_CONTRACT, GRAPH_TRANSFER_CONTRACT].includes(question?.scienceExercise?.contract)) {
    if (gradeScienceAnswer(question, question.validation?.answer).status !== 'reliable') return null;
    if (['check', 'review'].includes(method))
      return { method, helped: false, content: '请按本题条件独立选择准确值，原有帮助经历保留。' };
    if (!['explain', 'hint', 'steps', 'prerequisite', 'question'].includes(method)) return null;
    return {
      method,
      helped: true,
      level: 1,
      content:
        question.scienceExercise.contract === GRAPH_TRANSFER_CONTRACT
          ? '先按折点分段，过零的直线段再在速度为零处拆开。每段用三角形或梯形面积计算：正负面积的大小相加得到路程，带符号面积相加得到位移。不要把负速度当作负路程，也不要把位移直接当成路程。'
          : '先用合力除以质量求加速度，再由初速度和时间求末速度、有符号位移。合力总功为合力乘以有符号位移；末动能为质量乘以末速度平方的一半。核对总功等于动能变化，不能把路程代替位移，也不能把负速度算成负动能。'
    };
  }
  if ([DENSITY_TRANSFER_CONTRACT, PRESSURE_TRANSFER_CONTRACT].includes(question?.scienceExercise?.contract)) {
    if (gradeScienceAnswer(question, question.validation?.answer).status !== 'reliable') return null;
    if (['check', 'review'].includes(method))
      return { method, helped: false, content: '请按本题条件独立选择准确值，原有帮助经历保留。' };
    if (!['explain', 'hint', 'steps', 'prerequisite', 'question'].includes(method)) return null;
    return {
      method,
      helped: true,
      level: 1,
      content: (question.scienceExercise.contract === PRESSURE_TRANSFER_CONTRACT
        ? pressureHelpContent
        : densityHelpContent)(question.scienceExercise.input)
    };
  }
  if (
    question?.materialExercise &&
    ['material-objective-v1', 'material-objective-v2', 'material-objective-v3'].includes(
      question.validation?.evidenceId
    )
  ) {
    if (['check', 'review'].includes(method))
      return {
        method,
        helped: false,
        content: '请按所给资料独立作答。字面校验只依据该文本，不证明完整阅读理解或官方等级。'
      };
    if (!['explain', 'hint', 'steps', 'prerequisite'].includes(method)) return null;
    const { from, to } = question.validation.inputs;
    const kind = question.materialExercise.kind;
    const hint =
      kind === 'literal'
        ? `定位字段“${from.key}”，逐字引用其冒号后的值；不要用自己的推测替换原文。`
        : kind === 'difference'
          ? '先区分比较期与基期，再用比较期减基期；结果可为负数。'
          : kind === 'share_percent'
            ? '先区分部分与整体，再用部分除以整体，最后换成百分数；占比不用先减去基期。'
            : '先求现期减基期，再除以基期，最后换成百分数；不要把增量直接当增长率。';
    const calculation =
      kind === 'literal'
        ? `所给文本中“${from.key}”对应“${from.value}”。`
        : kind === 'difference'
          ? `所给文本中的增量为 ${to.value} - ${from.value} = ${question.validation.answer}。`
          : kind === 'share_percent'
            ? `所给文本中的占比为 ${from.value} / ${to.value} × 100%。须带百分号。`
            : `所给文本中的增长率为 (${to.value} - ${from.value}) / ${from.value} × 100%。须带百分号。`;
    return {
      method,
      helped: true,
      level: method === 'hint' ? Math.min(3, level) : 3,
      content: `${hint}${method === 'hint' && level < 3 ? '' : calculation}${kind !== 'literal' && ['material-objective-v2', 'material-objective-v3'].includes(question.materialExercise.contract) ? '保留精确结果，循环小数用分数，不四舍五入。' : ''}这里只核验该文本中的字面或数值关系；错答不自动诊断为某种认知缺陷。请再用不同字段独立复测。`
    };
  }
  const field = fieldProbeTeaching(question, method, level);
  if (field) return field;
  const probe = conditionProbeTeaching(question, method, level);
  if (probe) return probe;
  const condition = conditionTeaching(question, method, level);
  if (condition) return condition;
  const algebra = algebraTeaching(question, method, level);
  if (algebra) return algebra;
  const arithmetic = exactArithmeticTeaching(question, method, level);
  const fraction = fractionTeaching(question, method, level);
  if (fraction) return fraction;
  if (arithmetic) return arithmetic;
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
  const fraction = createFractionQuestion(id, goal, difficulty, parent);
  if (fraction) return fraction;
  const exact = createExactArithmeticQuestion(id, goal, difficulty, parent);
  if (exact) return exact;
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
