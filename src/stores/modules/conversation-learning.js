import { defineStore } from 'pinia';
import { rhythmOperations } from '@/services/learning/learning-rhythm.js';
import { conversationStrategy } from '../../../laf-backend/functions/_shared/learning-strategy.js';
import {
  createPrerequisiteQuestion,
  createPrerequisiteVariant,
  prerequisiteProgress
} from '../../../laf-backend/functions/_shared/learning-prerequisite.js';
import { computed, ref, onScopeDispose, watch } from 'vue';
import { pendingUploadJournal } from '@/services/learning/pending-upload-journal.js';
import { learningRepository, LEARNING_KEY } from '@/services/learning/learning-repository.js';
import { HISTORY_PACKAGE } from '../../../laf-backend/functions/_shared/learning-history.js';
import {
  observeTeaching,
  requestedTeachingMethod
} from '../../../laf-backend/functions/_shared/learning-teaching-observation.js';
import {
  summarizeLearning,
  questionKey,
  knowledgeScope,
  effectiveGrade,
  assert,
  operationFingerprint,
  normalizeRubric
} from '@/services/learning/learning-domain.js';
import {
  userDirective,
  nextStrategy,
  createArithmeticQuestion,
  createConditionQuestion,
  createConditionVariant,
  createArithmeticChallenge,
  createAlgebraQuestion,
  createAlgebraVariant,
  localTeaching,
  executeLearningTool
} from '@/services/learning/learning-tools.js';
import {
  parsePastedMaterial,
  questionFromMaterial,
  correctMaterialQuestion
} from '@/services/learning/material-intake.js';
import {
  fetchLearningModels,
  fetchLearningUsage,
  testLearningModel,
  generateLearningTurn,
  saveLearningModel,
  deleteLearningModel,
  cancelLearningTurn,
  fetchLearningResult,
  learningRequest
} from '@/services/api/domains/learning.api.js';
import { callLocalConnector, testLocalConnector, learningClientPlatform } from '@/services/learning/local-connector.js';
import {
  parseConnectedMaterial,
  testMaterialConnector,
  deleteConnectedMaterial,
  requestUploadRecovery,
  requestUploadMaintenance
} from '@/services/learning/material-connector.js';
import { synchronizeLearning, adoptRemoteConflict } from '@/services/learning/learning-sync.js';
import { learningStreamPlatform } from '@/services/learning/learning-stream.js';
import { safeLearningMessage } from '../../../laf-backend/functions/_shared/learning-stream-codec.js';
import { deriveConversationReview } from '@/services/learning/conversation-review.js';
import {
  validateVisualInput,
  normalizeSavedVisualReading,
  visualReadingText,
  VISION_ADAPTER
} from '../../../laf-backend/functions/_shared/learning-vision.js';

export function learningId(prefix = 'learn') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}
export const useConversationLearningStore = defineStore('conversation-learning', () => {
  const state = ref(learningRepository.read());
  const selectedConversationId = ref(state.value.conversations.at(-1)?.id || null);
  const busy = ref(false);
  const error = ref('');
  const models = ref([]);
  const modelPresets = ref([]);
  const modelId = ref('');
  const usage = ref(null);
  const localConnection = ref(null);
  const materialConnection = ref(null);
  const sharingAllowed = ref(false);
  const selectedMode = ref('offline');
  const streamEnabled = ref(false),
    streamPreview = ref('');
  const streamPlatform = learningStreamPlatform();
  const streamSupported = computed(
    () =>
      selectedMode.value === 'cloud' &&
      models.value.find((m) => m.id === modelId.value)?.capabilities?.stream === true &&
      streamPlatform !== 'unsupported'
  );
  let controller = null;
  let pendingCloudCall = null;
  const pendingUploads = ref(pendingUploadJournal.list());
  const materialBusy = ref(false);
  const materialProgress = ref(null);
  let materialController = null;
  let materialRequestContext = null;
  let materialIdentityConnection = null,
    materialIdentitySignature = null,
    materialIdentitySequence = 0;
  function materialIdentity() {
    const connection = materialConnection.value;
    const signature = connection
      ? JSON.stringify([
          connection.endpoint,
          connection.allowedOrigins,
          connection.consent,
          connection.token,
          connection.capabilities?.uploadRecovery?.storageId || null,
          connection.capabilities?.uploadMaintenance?.generation || null
        ])
      : null;
    if (connection !== materialIdentityConnection || signature !== materialIdentitySignature) {
      materialIdentityConnection = connection;
      materialIdentitySignature = signature;
      materialIdentitySequence++;
    }
    return materialIdentitySequence;
  }
  function recordContext() {
    try {
      return JSON.stringify(learningRepository.lifecycleContext());
    } catch {
      return null;
    }
  }
  function materialContext() {
    const records = recordContext();
    return records ? JSON.stringify([records, materialIdentity()]) : null;
  }
  function prepareMaterialAction() {
    learningRepository.prepareAsyncAction();
    const context = materialContext();
    assert(context, 'CONTEXT_CHANGED', '本机记录上下文不可用，请重新核对');
    return context;
  }
  watch(
    [() => state.value, materialIdentity],
    () => {
      if (materialRequestContext && materialContext() !== materialRequestContext) materialController?.abort();
    },
    { flush: 'sync' }
  );
  const syncBusy = ref(false);
  const syncConflict = ref(learningRepository.previewSyncConflict());
  let syncController = null;
  const syncProgress = ref(null);
  const historyBusy = ref(false),
    historyProgress = ref(null);
  let historyController = null;
  const active = computed(() => state.value.conversations.find((c) => c.id === selectedConversationId.value));
  const activeStrategy = computed(() => conversationStrategy(state.value, selectedConversationId.value));
  const activeQuestion = computed(() =>
    state.value.questions.find((q) => questionKey(q) === active.value?.activeQuestionKey)
  );
  const summary = computed(() => summarizeLearning(state.value));
  const canDiagnose = computed(() =>
    Boolean(
      activeQuestion.value &&
      createPrerequisiteQuestion('capability', activeQuestion.value, state.value.attempts, selectedConversationId.value)
    )
  );
  const diagnosticProgress = computed(() => prerequisiteProgress(state.value, activeQuestion.value));
  const teachingProgress = computed(() => observeTeaching(state.value));
  const currentPlan = computed(() => state.value.plans.find((p) => p.id === summary.value.tasks.planId));
  function refresh() {
    const next = learningRepository.read();
    if (next.owner !== state.value.owner) {
      controller?.abort();
      pendingCloudCall = null;
      streamPreview.value = '';
      streamEnabled.value = false;
      materialController?.abort();
      syncController?.abort();
      historyController?.abort();
      historyProgress.value = null;
      sharingAllowed.value = false;
      localConnection.value = null;
      materialConnection.value = null;
      models.value = [];
      modelPresets.value = [];
      usage.value = null;
      modelId.value = '';
      selectedMode.value = 'offline';
      error.value = '';
      materialProgress.value = null;
      selectedConversationId.value = next.conversations.at(-1)?.id || null;
    }
    state.value = next;
    pendingUploads.value = pendingUploadJournal.list();
    syncConflict.value = learningRepository.previewSyncConflict();
    return state.value;
  }
  const authEvents = ['user:logout', 'loginStatusChanged', 'auth:userdata'];
  for (const event of authEvents) uni.$on?.(event, refresh);
  const storageChanged = (event) => {
    const prefix = state.value.owner === 'guest' ? '' : `u_${state.value.owner}_`;
    const keys = [
      LEARNING_KEY,
      `${LEARNING_KEY}_lifecycle`,
      `${LEARNING_KEY}_privacy_pending`,
      `${LEARNING_KEY}_upload_pending`
    ].flatMap((key) => [`${prefix}${key}`, `__exam_storage__:${prefix}${key}`]);
    keys.push('EXAM_USER_ID', '__exam_storage__:EXAM_USER_ID');
    if (event.key !== null && !keys.includes(event.key)) return;
    if (event.storageArea && event.storageArea !== window.localStorage) return;
    try {
      refresh();
    } catch {
      materialController?.abort();
      materialConnection.value = null;
      error.value = '本机记录已变化且暂不可读，请重新核对；旧资料动作已取消。';
    }
  };
  if (typeof window !== 'undefined') window.addEventListener('storage', storageChanged);
  onScopeDispose(() => {
    if (typeof window !== 'undefined') window.removeEventListener('storage', storageChanged);
    for (const event of authEvents) uni.$off?.(event, refresh);
    controller?.abort();
    materialController?.abort();
    syncController?.abort();
    historyController?.abort();
  });
  function commit(type, data, id = learningId()) {
    const result = learningRepository.commit({ id, type, data });
    state.value = result.state;
    uni.$emit('conversationLearningUpdated');
    return result.result;
  }
  function notice(content, id = learningId('notice'), extras = {}) {
    return commit(
      'message.add',
      { conversationId: selectedConversationId.value, role: 'notice', content, ...extras },
      id
    );
  }
  function deliverTeaching(segment, id, origin = 'local_tool') {
    return commit(
      'teaching.deliver',
      {
        conversationId: selectedConversationId.value,
        questionKey: questionKey(activeQuestion.value),
        method: segment.method,
        content: segment.content,
        origin,
        helped: segment.helped,
        ...(segment.visualReading ? { visualReading: segment.visualReading } : {}),
        ...(segment.helped ? { level: segment.level } : {})
      },
      id
    );
  }
  function start(goal) {
    error.value = '';
    const conversation = commit('conversation.start', { goal });
    selectedConversationId.value = conversation.id;
    notice(
      '可以直接提出目标开始。基础、困难、时间和表达偏好可以边学边补充或跳过。网络调用须显式选择模型并同意共享当前上下文；当前连接状态以模型面板为准。'
    );
    const id = learningId('q');
    const question =
      createConditionQuestion(id, goal) ||
      createAlgebraQuestion(id, goal) ||
      createArithmeticQuestion(id, goal, activeStrategy.value.difficulty);
    if (question) addQuestion(question);
    return conversation;
  }
  function setRhythm(id) {
    assert(!busy.value, 'PRECONDITION', '请先结束或取消正在执行的请求，再调整学习节奏');
    for (const operation of rhythmOperations(id, selectedConversationId.value)) commit(operation.type, operation.data);
    if (id === 'review') {
      const target = summary.value.due[0] || summary.value.mistakes[0];
      if (target) focus(target.questionKey, target.conversationId || selectedConversationId.value, 'review');
      return { focused: Boolean(target) };
    }
    return { focused: false };
  }
  function addQuestion(question, condition = 'submitted') {
    const result = commit('question.add', { question });
    commit('question.focus', { conversationId: selectedConversationId.value, questionKey: result.questionKey });
    const tasks = currentPlan.value?.tasks || [];
    commit('plan.set', {
      tasks: [...tasks.map((t) => ({ ...t })), { title: question.prompt, questionKey: result.questionKey, condition }],
      reason: '将当前练习加入今日任务，完成条件为正式作答'
    });
    return result;
  }
  function scheduleAttempt(attempt) {
    if (effectiveGrade(attempt).status !== 'reliable') return;
    if (state.value.reviews.some((review) => review.attemptId === attempt.id)) return;
    // 使用同一份事实重建 FSRS，避免取消、更正、重试留下不可撤销的派生卡片。
    const attempts = state.value.attempts.filter(
      (a) => a.questionKey === attempt.questionKey && effectiveGrade(a).status === 'reliable'
    );
    const review = deriveConversationReview(attempts, state.value.reviews);
    if (!review?.evidenceIds.includes(attempt.id)) return;
    commit(
      'review.schedule',
      {
        attemptId: attempt.id,
        due: Math.max(attempt.at + 1000, review.due),
        rating: review.rating,
        policy: review.policy,
        evidenceIds: review.evidenceIds
      },
      `${attempt.id}:review`
    );
  }
  function submit(answer, explicit = false, id = learningId('answer'), options = {}) {
    const result = commit(
      'attempt.submit',
      { conversationId: selectedConversationId.value, answer, explicit, ...options },
      id
    );
    if (result.clarification) {
      notice(result.message, `${id}:clarification`);
      return result;
    }
    const grade = effectiveGrade(result);
    const feedback =
      grade.status !== 'reliable'
        ? grade.basis === 'missing_domain_condition'
          ? '作答已保存；还需补充原式不能取的 x 值，例如“x+1，x≠1”。未补全前暂不判错。'
          : grade.basis === 'original_expression_repeated'
            ? '原式已保存；请给出变形后的等价表达及定义域，再检验本次效果。'
            : '作答已保存，当前缺少可靠判分依据、表达超出校验范围或关键条件尚未校对。暂不记为可靠错题。'
        : grade.outcome === 'wrong'
          ? '作答已保存并判错，已进入错题视图。可以查看依据、提出纠正或继续讲解。'
          : grade.outcome === 'partial'
            ? '作答已保存，判为部分正确。首答统计单独列出部分正确次数；尚未通过完整检验，建议查看依据并补全。'
            : '作答已保存并判对。后续仍需独立检验和复测。';
    notice(feedback, `${id}:feedback`, { attemptId: result.id });
    scheduleAttempt(result);
    const strategy = nextStrategy(state.value, result);
    if (strategy) {
      commit('strategy.set', { ...strategy, deliveryManaged: true }, `${id}:strategy`);
      if (
        selectedMode.value === 'offline' &&
        activeQuestion.value?.id &&
        ['prerequisite', 'steps', 'example', 'analogy'].includes(strategy.method)
      ) {
        const segment = localTeaching(activeQuestion.value, strategy.method);
        if (segment) deliverTeaching(segment, `${id}:remediation`);
      }
    }
    if (grade.status === 'reliable') {
      const q = state.value.questions.find((q) => questionKey(q) === result.questionKey);
      commit(
        'profile.set',
        {
          field: 'difficulty',
          value:
            grade.outcome === 'correct'
              ? result.hints.length
                ? '本次需要提示'
                : result.kind === 'redo'
                  ? '本次原题重做，仍待复测'
                  : ['review', 'variant'].includes(result.kind)
                    ? '本次独立检验，仍待复测'
                    : '本次独立完成'
              : '本次需复测',
          source: 'observed',
          scope: knowledgeScope(q),
          evidenceIds: [result.id]
        },
        `${id}:observation`
      );
    }
    return result;
  }
  async function send(raw, options = {}) {
    if (options.visual) {
      const model = models.value.find((m) => m.id === modelId.value);
      assert(
        options.imageShareConsent === true && sharingAllowed.value,
        'IMAGE_CONSENT_REQUIRED',
        '图片请求缺本次授权'
      );
      assert(
        selectedMode.value === 'cloud' &&
          model?.source === 'byok' &&
          model?.capabilities?.vision &&
          model.visionAdapter === VISION_ADAPTER &&
          !streamEnabled.value &&
          learningClientPlatform() === 'h5',
        'VISION_UNSUPPORTED',
        '图片路径或型号尚未开放'
      );
      validateVisualInput([options.image], true, {
        questionKey: activeQuestion.value ? questionKey(activeQuestion.value) : null,
        source: activeQuestion.value?.source
      });
      assert(
        options.image.dataUrl === questionImage.value,
        'IMAGE_SOURCE_MISMATCH',
        '图片与本机当前题目提取版本不一致'
      );
    }
    if (busy.value) {
      const requested = userDirective(raw, state.value, selectedConversationId.value);
      if (requested?.type !== 'task.stop') {
        error.value = '当前模型任务仍在执行，可以先取消请求或停止当前任务';
        return;
      }
      cancel();
    }
    error.value = '';
    const id = options.id || learningId('turn');
    if (!active.value) start(raw);
    commit(
      'message.add',
      { conversationId: selectedConversationId.value, role: 'user', content: raw },
      `${id}:message`
    );
    const completed = state.value.events.find((event) =>
      [
        `${id}:local-teaching`,
        `${id}:reply`,
        `${id}:challenge`,
        `${id}:offline`,
        `${id}:diagnostic`,
        `${id}:independent-check`
      ].includes(event.id)
    );
    if (completed) return completed.result;
    if (/^(?:先修诊断|开始先修诊断)[。！!]?$/u.test(raw.trim())) return diagnosePrerequisite(id);
    if (/^独立检验原题[。！!]?$/u.test(raw.trim())) {
      assert(!active.value.stopped, 'STOPPED', '当前任务已停止，请先明确继续');
      const result = generateVariant();
      notice(
        '已加入原题的独立变式；请先独立作答，再查看帮助。基础小题通过不能代替这次检验。',
        `${id}:independent-check`
      );
      return result;
    }
    const directive = options.visual ? null : userDirective(raw, state.value, selectedConversationId.value);
    if (directive) {
      commit(directive.type, directive.data, `${id}:directive`);
      notice(
        directive.type === 'task.stop'
          ? '当前任务已停止。'
          : directive.type === 'strategy.auto'
            ? '已恢复本对话的自动教法；停止状态保持，后续按可靠作答调整。'
            : directive.type === 'task.resume'
              ? '当前任务已继续，原教法选择保留。'
              : '学习状态已更新，后续教学将采用新的设置。',
        `${id}:updated`
      );
      if (['task.stop', 'task.resume', 'strategy.auto', 'plan.set'].includes(directive.type)) return;
      if (active.value.stopped) return;
    } else if (active.value.stopped) {
      notice('当前任务已停止。请明确选择“继续当前任务”，或开始其他对话。', `${id}:stopped`);
      return;
    } else if (activeQuestion.value && !options.visual) {
      const result = submit(raw, false, `${id}:answer`);
      if (!result.clarification && (result.grade?.status === 'reliable' || selectedMode.value === 'offline'))
        return result;
    }
    if (selectedMode.value === 'offline') {
      if (directive?.type === 'strategy.set' && directive.data.method === 'challenge') {
        const challenge = createArithmeticChallenge(`${id}_challenge`, activeQuestion.value);
        if (challenge) {
          if (!state.value.questions.some((q) => questionKey(q) === questionKey(challenge))) addQuestion(challenge);
          notice('已加入组合运算挑战，改变运算顺序与符号条件；请独立作答，结果会用于校准后续教学。', `${id}:challenge`);
          return;
        }
      }
      const level = Math.min(3, Math.max(0, ...(active.value?.pendingHints || []).map((hint) => hint.level || 1)) + 1);
      const explanation =
        directive?.type === 'strategy.set'
          ? localTeaching(activeQuestion.value, activeStrategy.value.method, level)
          : null;
      if (explanation) {
        deliverTeaching(explanation, `${id}:local-teaching`);
        return;
      }
      notice(
        '当前没有连接在线模型。目标和消息已保存；可继续已有练习、导入资料，或打开模型连接。这里不会生成模拟 AI 回复。',
        `${id}:offline`
      );
      return;
    }
    assert(sharingAllowed.value, 'CONSENT_REQUIRED', '请先确认当前上下文的数据流向');
    busy.value = true;
    const requestController = new AbortController();
    controller = requestController;
    streamPreview.value = '';
    const mode = selectedMode.value,
      requestedModelId = modelId.value;
    const lifecycle = learningRepository.lifecycleRevision();
    const conversationId = selectedConversationId.value;
    const requestedQuestionKey = activeQuestion.value ? questionKey(activeQuestion.value) : null;
    const owner = state.value.owner;
    pendingCloudCall = mode === 'cloud' ? { id, owner } : null;
    const binding = state.value.events.find((e) => e.id === `${id}:request`)?.data.binding || learningId('binding');
    const request = {
      id,
      owner,
      conversationId,
      questionKey: requestedQuestionKey,
      modelId: requestedModelId,
      model: models.value.find((m) => m.id === requestedModelId)?.model || requestedModelId,
      binding,
      lifecycle,
      lockedMethod:
        directive?.type === 'strategy.set'
          ? directive.data.method
          : requestedTeachingMethod(state.value, conversationId)
    };
    if (options.visual) request.visualSource = options.image.source;
    const assertCurrent = () => {
      refresh();
      assert(!requestController.signal.aborted, 'CANCELLED', '请求已取消，旧模型响应未写入');
      assert(
        state.value.owner === owner &&
          selectedConversationId.value === conversationId &&
          (activeQuestion.value ? questionKey(activeQuestion.value) : null) === requestedQuestionKey &&
          learningRepository.lifecycleRevision() === lifecycle &&
          selectedMode.value === mode &&
          modelId.value === requestedModelId &&
          sharingAllowed.value &&
          (!request.visualSource || (questionImage.value === options.image.dataUrl && !streamEnabled.value)),
        'CONTEXT_CHANGED',
        '用户、题目、模型或共享授权已切换或变化，未写入旧模型响应'
      );
    };
    const payload = {
      requestId: id,
      requestBinding: binding,
      modelId: modelId.value,
      shareConsent: sharingAllowed.value,
      ...(options.visual ? { images: [options.image], imageShareConsent: true } : {}),
      messages: active.value.messages
        .filter((m) => ['user', 'assistant'].includes(m.role))
        .slice(-10)
        .map(({ role, content }) => ({ role, content: content.slice(0, 1800) })),
      learningContext: {
        owner,
        goal: active.value.goal,
        profile: state.value.profile.slice(-6).map(({ field, value, source, scope, evidenceIds }) => ({
          field,
          value: value.slice(0, 400),
          source,
          scope,
          evidenceIds: evidenceIds.slice(-4)
        })),
        strategy: activeStrategy.value,
        question: activeQuestion.value
          ? {
              prompt: activeQuestion.value.prompt,
              options: activeQuestion.value.options,
              scope: activeQuestion.value.scope,
              questionKey: questionKey(activeQuestion.value),
              source: activeQuestion.value.source,
              uncertainties: (activeQuestion.value.uncertainties || []).map(
                ({ field, reason, critical, resolved }) => ({
                  field,
                  reason,
                  critical,
                  resolved
                })
              ),
              rubric: activeQuestion.value.rubric || null
            }
          : null,
        attempt: state.value.attempts
          .filter((a) => a.conversationId === conversationId && a.questionKey === active.value?.activeQuestionKey)
          .at(-1)
          ? (() => {
              const a = state.value.attempts
                .filter((a) => a.conversationId === conversationId && a.questionKey === active.value?.activeQuestionKey)
                .at(-1);
              return {
                id: a.id,
                answer: a.answer,
                hints: a.hints.map((h) => ({ level: h.level, content: h.content.slice(0, 500) })),
                grade: effectiveGrade(a)
              };
            })()
          : null,
        summary: {
          first: summary.value.first,
          tasks: summary.value.tasks,
          teaching: observeTeaching(state.value, {
            conversationId,
            scope: activeQuestion.value ? knowledgeScope(activeQuestion.value) : undefined,
            limit: 3
          }).rows
        }
      }
    };
    try {
      if (mode === 'cloud') {
        assert(
          !streamEnabled.value || streamSupported.value,
          'STREAM_UNSUPPORTED',
          '当前模型或终端不支持所选流式模式；请主动选择非流式'
        );
        commit(
          'model.request',
          {
            conversationId,
            messageId: `${id}:message`,
            questionKey: requestedQuestionKey,
            requestId: id,
            modelId: requestedModelId,
            model: request.model,
            binding,
            lockedMethod: request.lockedMethod,
            ...(request.visualSource ? { visualSource: request.visualSource } : {})
          },
          `${id}:request`
        );
      }
      assertCurrent();
      const result =
        mode === 'local'
          ? await callLocalConnector(localConnection.value, payload, {
              signal: requestController.signal,
              platform: learningClientPlatform()
            })
          : await generateLearningTurn(payload, {
              signal: requestController.signal,
              expectedOwner: owner,
              stream: streamEnabled.value,
              expectedModel: request.model,
              onPreview: (text) => {
                assertCurrent();
                streamPreview.value = text;
              }
            });
      assertCurrent();
      streamPreview.value = '';
      if (mode === 'local' && result.success && localConnection.value) localConnection.value.status = 'model_verified';
      if (!result.success) {
        error.value = result.message;
        notice(result.message, `${id}:error`);
        return;
      }
      applyModelResult(result.data, request, requestController.signal);
    } catch (e) {
      if (state.value.owner === owner && selectedConversationId.value === conversationId)
        error.value = e.code === 'CANCELLED' ? '请求已取消，费用状态请查看模型用量' : e.message || '模型任务未完成';
    } finally {
      if (controller === requestController) {
        busy.value = false;
        controller = null;
        pendingCloudCall = null;
        streamPreview.value = '';
      }
    }
  }
  function applyModelResult(data, request, signal) {
    const { id, conversationId, questionKey: requestedQuestionKey } = request;
    assert(
      typeof data.message === 'string' &&
        data.message.length <= 8000 &&
        Array.isArray(data.tools || []) &&
        (data.tools || []).length <= 3,
      'INVALID_RESPONSE',
      '模型输出不合法'
    );
    let reading = null;
    if (request.visualSource) {
      assert(!(data.tools || []).length && !data.question, 'FORBIDDEN', '图片解读不执行判分、计划或建题');
      reading = normalizeSavedVisualReading(data.visualReading, request.visualSource);
    } else assert(!data.visualReading, 'FORBIDDEN', '没有图片授权的请求不能返回图片解读');
    const context = {
      conversationId,
      permissions: ['read', 'learn'],
      calls: 0,
      maxCalls: 3,
      deadline: Date.now() + 5000,
      origin: 'model',
      model: data.model || request.modelId,
      lockedMethod: request.lockedMethod,
      signal
    };
    for (const [index, call] of (data.tools || []).entries()) {
      assert(['progress', 'method', 'hint', 'assess', 'plan'].includes(call.name), 'FORBIDDEN', '模型工具未获授权');
      executeLearningTool(learningRepository, { ...call, id: `${id}:tool:${index}` }, context);
      refresh();
    }
    // 不信任工具执行前生成的成功宣称；教学文本仅表达建议，实际状态在固定进度视图显示。
    const safeMessage = safeLearningMessage(reading ? visualReadingText(reading) : data.message);
    if (requestedQuestionKey) {
      // 普通模型回复不能证明没有泄露帮助；保守标记，不让模型自报“独立掌握”。
      deliverTeaching(
        {
          method: activeStrategy.value.method,
          content: safeMessage,
          helped: true,
          level: 1,
          ...(reading ? { visualReading: reading } : {})
        },
        `${id}:reply`,
        'model_reply'
      );
    } else commit('message.add', { conversationId, role: 'assistant', content: safeMessage }, `${id}:reply`);
    if (data.question) {
      addQuestion({
        ...data.question,
        id: `${id}_q`,
        version: 1,
        scope: 'generated',
        validation: null,
        source: { kind: 'model_generated', model: data.model, verified: false }
      });
    }
  }
  const questionImage = computed(() => {
    const source = activeQuestion.value?.source;
    if (source?.kind !== 'private_material') return null;
    const material = state.value.materials.find((m) => m.id === source.materialId);
    const segment = material?.segments.find((s) => s.id === source.segmentId);
    if (
      material?.extractionVersion !== source.extractionVersion ||
      segment?.extractionEventId !== source.extractionEventId
    )
      return null;
    return segment?.preview || null;
  });
  async function interpretQuestionImage(consent, options = {}) {
    refresh();
    assert(
      consent === true && sharingAllowed.value,
      'IMAGE_CONSENT_REQUIRED',
      '请明确允许本次页图和当前上下文发送至所选模型'
    );
    assert(
      learningClientPlatform() === 'h5',
      'PLATFORM_UNSUPPORTED',
      '当前端尚未验收模型页图连接，可先在资料中校对文本'
    );
    assert(
      !busy.value && activeQuestion.value && !active.value.stopped,
      'PRECONDITION',
      '请先打开当前题目并结束或取消在途请求'
    );
    const model = models.value.find((m) => m.id === modelId.value);
    assert(
      selectedMode.value === 'cloud' &&
        model?.source === 'byok' &&
        model?.capabilities?.vision &&
        model.visionAdapter === VISION_ADAPTER &&
        !streamEnabled.value,
      'VISION_UNSUPPORTED',
      '请选择声明图片协议的自带API及非流式模式；本地和平台图片路径尚未开放，不会自动切换'
    );
    const q = activeQuestion.value,
      source = q.source;
    assert(questionImage.value, 'IMAGE_SOURCE_UNAVAILABLE', '本题原页图或提取版本已不可用，请先重新校对资料');
    const image = {
      dataUrl: questionImage.value,
      source: Object.fromEntries(
        ['materialId', 'segmentId', 'page', 'extractionVersion', 'extractionEventId'].map((k) => [k, source[k]])
      )
    };
    validateVisualInput([image], consent, { source, questionKey: questionKey(q) });
    return send(
      '请辅助解读当前原页图，区分题干、选项、纸面作答、教师批注和参考答案候选，列出需要局部校对的关键疑义；本次不判分。',
      { ...options, visual: true, image, imageShareConsent: true }
    );
  }
  // 请求意图是记录；它不代表模型执行成功，也不计为作答或工具成功。
  const recoverableRequest = computed(() => {
    const event = state.value.events
      .filter(
        (e) =>
          e.type === 'model.request' && e.data.conversationId === selectedConversationId.value && !e.data.historyOnly
      )
      .at(-1);
    if (
      !event ||
      state.value.events.some((e) =>
        [`${event.data.requestId}:reply`, `${event.data.requestId}:dismiss`].includes(e.id)
      )
    )
      return null;
    return event.data;
  });
  async function recoverModelResult() {
    refresh();
    const pending = recoverableRequest.value;
    assert(pending && !busy.value, 'PRECONDITION', '当前没有可读取的模型请求');
    assert(
      sharingAllowed.value && selectedMode.value === 'cloud' && modelId.value === pending.modelId,
      'CONSENT_REQUIRED',
      '请选择原模型并授权在当前对话应用已完成结果'
    );
    const owner = state.value.owner,
      lifecycle = learningRepository.lifecycleRevision();
    const requestController = new AbortController();
    controller = requestController;
    busy.value = true;
    streamPreview.value = '';
    const assertRecovery = () => {
      refresh();
      const eventIndex = state.value.events.findIndex((e) => e.id === `${pending.requestId}:request`);
      assert(
        !requestController.signal.aborted &&
          state.value.owner === owner &&
          lifecycle === learningRepository.lifecycleRevision() &&
          selectedConversationId.value === pending.conversationId &&
          selectedMode.value === 'cloud' &&
          modelId.value === pending.modelId &&
          sharingAllowed.value &&
          (active.value?.activeQuestionKey || null) === pending.questionKey &&
          active.value.messages.filter((m) => m.role === 'user').at(-1)?.id === pending.messageId &&
          eventIndex >= 0 &&
          state.value.events
            .slice(eventIndex + 1)
            .every(
              (e) =>
                e.id === `${pending.requestId}:error` ||
                e.id.startsWith(`${pending.requestId}:tool:`) ||
                e.id === `${pending.requestId}:reply`
            ),
        'CONTEXT_CHANGED',
        '学习上下文已变化，旧结果只保留在服务端，不应用旧工具'
      );
    };
    try {
      assertRecovery();
      const result = await fetchLearningResult(pending.requestId, {
        expectedOwner: owner,
        signal: requestController.signal
      });
      assertRecovery();
      if (!result.success) {
        error.value = result.message;
        return result;
      }
      assert(
        result.data.requestId === pending.requestId &&
          result.data.requestBinding === pending.binding &&
          result.data.modelId === pending.modelId &&
          result.data.model === pending.model,
        'CONTEXT_CHANGED',
        '已完成结果与当前请求关联不一致'
      );
      applyModelResult(result.data, { ...pending, id: pending.requestId }, requestController.signal);
      error.value = '';
      return result;
    } finally {
      if (controller === requestController) {
        busy.value = false;
        controller = null;
        streamPreview.value = '';
      }
    }
  }
  function cancel() {
    const pending = pendingCloudCall;
    pendingCloudCall = null;
    controller?.abort();
    streamPreview.value = '';
    if (pending && pending.owner === state.value.owner) {
      commit(
        'execution.record',
        { tool: 'model.cancel_request', version: '1', status: 'cancelled', errorCode: 'CLIENT_CANCELLED' },
        `${pending.id}:dismiss`
      );
      void cancelLearningTurn(pending.id, { expectedOwner: pending.owner })
        .then((result) => {
          if (!result.success && state.value.owner === pending.owner)
            error.value = '客户端已取消，服务端取消未确认；实际用量需查看模型用量状态';
        })
        .catch(() => {
          if (state.value.owner === pending.owner) error.value = '服务端取消未确认，实际用量需查看模型用量状态';
        });
    }
  }
  async function loadModels() {
    const owner = refresh().owner;
    const result = await fetchLearningModels();
    assert(refresh().owner === owner, 'CONTEXT_CHANGED', '用户已切换，未读取旧用户的模型配置');
    models.value = result.success ? result.data.models : [];
    modelPresets.value = result.success ? result.data.presets || [] : [];
    if (!result.success) error.value = result.message;
    return result;
  }
  async function testModel(id) {
    const owner = refresh().owner;
    const result = await testLearningModel(id, learningId('connection'));
    assert(refresh().owner === owner, 'CONTEXT_CHANGED', '用户已切换，未展示旧用户连接结果');
    await loadModels();
    return result;
  }
  async function loadUsage() {
    const owner = refresh().owner;
    const result = await fetchLearningUsage();
    assert(refresh().owner === owner, 'CONTEXT_CHANGED', '用户已切换，未读取旧用户的用量');
    usage.value = result.data || null;
    return result;
  }
  async function saveModel(profile, consent) {
    const owner = refresh().owner;
    const result = await saveLearningModel(profile, consent);
    assert(refresh().owner === owner, 'CONTEXT_CHANGED', '用户已切换，未展示旧用户的保存结果');
    if (result.success) await loadModels();
    return result;
  }
  async function removeModel(id) {
    const owner = refresh().owner;
    const result = await deleteLearningModel(id);
    assert(refresh().owner === owner, 'CONTEXT_CHANGED', '用户已切换，未展示旧用户的删除结果');
    if (result.success) await loadModels();
    return result;
  }
  function importText(input) {
    const material = parsePastedMaterial(input, learningId('material'));
    return commit('material.add', { material });
  }
  async function importFile(input) {
    assert(!materialBusy.value, 'BUSY', '资料正在处理中');
    refresh();
    if (input.materialId) {
      assert(
        state.value.materials.some((m) => m.id === input.materialId),
        'DELETED_DATA',
        '该资料已删除，请重新选择文件导入'
      );
      const material = state.value.materials.find((m) => m.id === input.materialId);
      if (material.original?.connectorOrigin)
        assert(
          materialConnection.value &&
            new URL(materialConnection.value.endpoint).origin === material.original.connectorOrigin,
          'TARGET_MISMATCH',
          '当前连接器不是保存原件的目标，未发送续页或重试请求'
        );
    }
    const context = prepareMaterialAction();
    assert(
      input.actionContext === undefined || input.actionContext === context,
      'CONTEXT_CHANGED',
      '记录或资料授权已变化，请重新选择；正文未发送'
    );
    const connection = materialConnection.value ? JSON.parse(JSON.stringify(materialConnection.value)) : null;
    materialBusy.value = true;
    materialController = new AbortController();
    materialRequestContext = context;
    const signal = materialController.signal;
    const checkContext = () => {
      assert(!signal.aborted, 'CANCELLED', '资料处理已取消');
      assert(materialContext() === context, 'CONTEXT_CHANGED', '账户、记录或资料授权已变更，旧资料结果未写入');
    };
    try {
      return await parseConnectedMaterial(connection, input, {
        platform: learningClientPlatform(),
        signal: materialController.signal,
        uploadId: learningId(
          connection?.capabilities?.uploadMaintenance?.available
            ? 'upload_' + connection.capabilities.uploadMaintenance.generation
            : 'upload'
        ),
        assertCurrent: checkContext,
        onUploadIntent: (entry) => {
          checkContext();
          pendingUploads.value = pendingUploadJournal.add(entry, state.value.owner);
        },
        onUploadSaved: (id) => {
          checkContext();
          pendingUploads.value = pendingUploadJournal.remove(id, state.value.owner);
        },
        onProgress: (progress) => {
          checkContext();
          materialProgress.value = progress;
        },
        onBatch: (material) => {
          checkContext();
          material = JSON.parse(JSON.stringify(material));
          assert(
            !(state.value.materialDeletions || []).some(
              (d) =>
                d.originalStatus === 'pending' &&
                d.original?.fileId === material.original?.connectorFileId &&
                d.original?.connectorOrigin === material.original?.connectorOrigin
            ),
            'DELETE_PENDING',
            '请先完成这份原件的删除，再确认重新导入；其他资料可继续使用'
          );
          // 重新上传是新的明确动作；迟到的旧提取仍被原墓碑拦截。
          const existing = state.value.materials.find(
            (m) =>
              m.fingerprint === material.fingerprint &&
              m.original?.connectorOrigin === material.original?.connectorOrigin
          );
          if (existing) material.id = existing.id;
          else if (
            (state.value.materialDeletions || []).some((d) =>
              (d.materialIds || [d.materialId]).includes(material.id)
            ) ||
            state.value.materials.some((m) => m.id === material.id)
          )
            material.id = learningId('material');
          const prior = state.value.events.find(
            (event) =>
              event.type === 'material.add' &&
              event.data.material.id === material.id &&
              operationFingerprint(event.data.material) === operationFingerprint(material)
          );
          return commit('material.add', { material }, prior?.id || learningId('extraction'));
        }
      });
    } finally {
      materialBusy.value = false;
      materialController = null;
      materialRequestContext = null;
    }
  }

  function uploadLinked(receipt, entry) {
    return (
      receipt.fileId &&
      state.value.materials.find(
        (material) =>
          material.original?.connectorFileId === receipt.fileId &&
          material.original?.connectorOrigin === entry.connectorOrigin
      )
    );
  }
  async function uploadAction(id, consent, close = false) {
    assert(consent === true, 'CONSENT_REQUIRED', '请明确确认核对或取消本次导入');
    assert(!materialBusy.value && !busy.value && !syncBusy.value, 'BUSY', '请等待当前动作结束');
    refresh();
    const entry = pendingUploads.value.find((item) => item.id === id);
    assert(entry, 'NOT_FOUND', '导入待办不存在');
    const context = prepareMaterialAction(),
      owner = state.value.owner;
    const connection = materialConnection.value ? JSON.parse(JSON.stringify(materialConnection.value)) : null;
    materialBusy.value = true;
    materialController = new AbortController();
    materialRequestContext = context;
    const signal = materialController.signal;
    const check = () =>
      assert(
        !signal.aborted && materialContext() === context,
        'CONTEXT_CHANGED',
        '账户、记录或资料授权已变化，导入待办保留'
      );
    try {
      let receipt = await requestUploadRecovery(connection, 'upload-receipt', entry, {
        platform: learningClientPlatform(),
        signal
      });
      check();
      const linked = uploadLinked(receipt, entry);
      if (close) {
        assert(!linked, 'HAS_SAVED_MATERIAL', '这份原件已关联保存资料，请使用资料删除范围预览；待办保留');
        receipt = await requestUploadRecovery(connection, 'close-upload', entry, {
          platform: learningClientPlatform(),
          signal
        });
        check();
      }
      if (linked || receipt.state === 'closed') pendingUploads.value = pendingUploadJournal.remove(id, owner);
      return { ...receipt, ...(linked ? { state: 'linked', materialId: linked.id } : {}), entry, context };
    } finally {
      materialBusy.value = false;
      materialController = null;
      materialRequestContext = null;
    }
  }
  const inspectUpload = (id, consent) => uploadAction(id, consent);
  const closeUpload = (id, consent) => uploadAction(id, consent, true);
  async function recoverUpload(id, consent) {
    const receipt = await inspectUpload(id, consent);
    if (receipt.state === 'linked') return receipt;
    assert(
      receipt.state === 'stored' && receipt.fileId,
      'ORIGINAL_UNAVAILABLE',
      '原件尚未收到或已不可用；可核对并取消登记，未重新上传'
    );
    assert(materialContext() === receipt.context, 'CONTEXT_CHANGED', '资料授权已变化，请重新确认恢复');
    const result = await importFile({
      name: '恢复的私人原件',
      size: receipt.entry.size,
      fileId: receipt.fileId,
      storageId: receipt.entry.storageId,
      startPage: 1,
      allowRecognition: receipt.entry.recognitionAllowed,
      recognitionEngine: receipt.entry.recognitionEngine,
      actionContext: receipt.context
    });
    assert(materialContext() === receipt.context, 'CONTEXT_CHANGED', '资料授权已变化，导入待办保留');
    pendingUploads.value = pendingUploadJournal.remove(id, state.value.owner);
    return result;
  }

  function previewPendingRemoval(id) {
    idleRecords();
    refresh();
    const entry = pendingUploads.value.find((item) => item.id === id);
    assert(entry, 'NOT_FOUND', '导入待办不存在');
    assert(recordContext(), 'CONTEXT_CHANGED', '本机记录上下文不可用，请重新核对');
    return {
      owner: state.value.owner,
      context: recordContext(),
      entry: JSON.parse(JSON.stringify(entry)),
      fingerprint: operationFingerprint(entry)
    };
  }
  function forgetPendingUpload(preview, consent) {
    assert(consent === true, 'CONSENT_REQUIRED', '请明确确认仅移除本机待办，远端原件未核验');
    idleRecords();
    refresh();
    const entry = pendingUploads.value.find((item) => item.id === preview?.entry?.id);
    assert(
      preview?.owner === state.value.owner &&
        preview.context &&
        preview.context === recordContext() &&
        entry &&
        operationFingerprint(entry) === preview.fingerprint,
      'CONTEXT_CHANGED',
      '账户、记录或定位待办已变化，请重新预览'
    );
    pendingUploads.value = pendingUploadJournal.remove(entry.id, state.value.owner);
    return { localRemoved: true, originalStatus: 'unverified' };
  }
  function restorePendingLocator(content, consent) {
    assert(consent === true, 'CONSENT_REQUIRED', '请明确确认恢复无正文定位待办');
    idleRecords();
    refresh();
    assert(recordContext(), 'CONTEXT_CHANGED', '本机记录上下文不可用，请重新核对');
    assert(typeof content === 'string' && content.length <= 2500, 'RESOURCE_LIMIT', '定位登记超过资源上限');
    let locator;
    try {
      locator = JSON.parse(content);
    } catch {
      assert(false, 'INVALID_LOCATOR', '定位登记JSON不合法');
    }
    assert(
      locator &&
        Object.keys(locator).length === 3 &&
        locator.format === 'wenli-upload-locator-v1' &&
        locator.owner === state.value.owner &&
        locator.entry &&
        Object.keys(locator.entry).length === 7,
      'INVALID_LOCATOR',
      '定位登记结构或账户不匹配，未恢复'
    );
    const existing = pendingUploads.value.find((item) => item.id === locator.entry.id);
    if (existing) {
      assert(
        operationFingerprint(existing) === operationFingerprint(locator.entry),
        'CONFLICT',
        '同编号定位信息不同，原待办保留'
      );
      return { restored: false, alreadyPresent: true };
    }
    pendingUploads.value = pendingUploadJournal.add(locator.entry, state.value.owner);
    return { restored: true, originalStatus: 'unverified' };
  }
  async function uploadMaintenanceAction(preview, consent) {
    assert(consent === true, 'CONSENT_REQUIRED', '请明确确认核对或整理导入登记');
    idleRecords();
    refresh();
    if (preview)
      assert(
        preview.owner === state.value.owner && preview.context === materialContext(),
        'CONTEXT_CHANGED',
        '账户或资料授权已变化，请重新预览'
      );
    const context = prepareMaterialAction(),
      owner = state.value.owner;
    const connection = materialConnection.value ? JSON.parse(JSON.stringify(materialConnection.value)) : null;
    materialBusy.value = true;
    materialController = new AbortController();
    materialRequestContext = context;
    const signal = materialController.signal;
    let result;
    try {
      result = await requestUploadMaintenance(connection, preview, { platform: learningClientPlatform(), signal });
      assert(
        !signal.aborted && materialContext() === context,
        'CONTEXT_CHANGED',
        '账户或资料授权已变化，维护回执未采用'
      );
    } finally {
      materialBusy.value = false;
      materialController = null;
      materialRequestContext = null;
    }
    materialConnection.value.capabilities.uploadMaintenance.generation = result.generation;
    return preview
      ? result
      : { ...result, owner, context: materialContext(), operationId: result.requestId || learningId('maintenance') };
  }
  const previewUploadMaintenance = (consent) => uploadMaintenanceAction(null, consent);
  const compactUploadReceipts = (preview, consent) => uploadMaintenanceAction(preview, consent);

  function cancelMaterial() {
    materialController?.abort();
  }
  function previewMaterialDeletion(materialId) {
    idleRecords();
    return learningRepository.previewMaterialDeletion(materialId);
  }
  async function retryOriginalDeletion(deletionId, consent) {
    assert(consent, 'CONSENT_REQUIRED', '原件删除需确认');
    idleRecords();
    const current = refresh();
    const deletion = (current.materialDeletions || []).find((d) => d.deletionId === deletionId);
    assert(deletion, 'NOT_FOUND', '删除任务不存在');
    if (deletion.originalStatus !== 'pending') return { status: deletion.originalStatus };
    materialBusy.value = true;
    materialController = new AbortController();
    const signal = materialController.signal;
    const context = { owner: current.owner, lifecycle: learningRepository.lifecycleRevision() };
    const check = () =>
      assert(
        learningRepository.read().owner === context.owner &&
          learningRepository.lifecycleRevision() === context.lifecycle,
        'CONTEXT_CHANGED',
        '账户或记录已变化，旧删除回执未写入'
      );
    try {
      await deleteConnectedMaterial(materialConnection.value, deletion.original, {
        platform: learningClientPlatform(),
        signal
      });
      check();
      commit(
        'material.original-deleted',
        { deletionId, fileId: deletion.original.fileId },
        learningId('original_deleted')
      );
      return { status: 'deleted' };
    } catch (error) {
      check();
      return { status: 'pending', message: error.message };
    } finally {
      materialBusy.value = false;
      materialController = null;
    }
  }
  async function deleteMaterial(preview, consent) {
    idleRecords();
    const result = learningRepository.deleteMaterial(preview, consent, learningId('material_delete'));
    refresh();
    uni.$emit('conversationLearningUpdated');
    const deletion = state.value.materialDeletions.find((d) => d.materialId === preview.materialId);
    const original = await retryOriginalDeletion(deletion.deletionId, true);
    return { ...result.result, original };
  }
  function structureQuestion(materialId, input) {
    const material = state.value.materials.find((m) => m.id === materialId);
    assert(material, 'NOT_FOUND', '资料不存在');
    return addQuestion(questionFromMaterial(material, input, learningId('private_q')));
  }
  function correctQuestion(q, patch, reason) {
    return addQuestion(correctMaterialQuestion(q, patch, reason));
  }
  function setRubric(criteria) {
    idleRecords();
    const question = activeQuestion.value;
    assert(question?.answerType === 'subjective' && !question.validation, 'PRECONDITION', '评分维度仅用于当前主观题');
    const rubric = normalizeRubric({
      id: learningId('rubric'),
      version: 1,
      source: { kind: 'user_defined', reference: null },
      criteria
    });
    // 生成新题版本，历史评估始终绑定原维度，不重写已发生的作答。
    return correctQuestion(
      question,
      { prompt: question.prompt, rubric, rubricRevisionOf: questionKey(question) },
      '用户设置或修正评分维度；历史版本保留'
    );
  }
  function correctAssessment(attemptId, reason) {
    const id = learningId('correction');
    const result = commit('assessment.correct', { attemptId, reason, outcome: null }, id);
    const question = state.value.attempts.find((attempt) => attempt.id === attemptId)?.questionKey;
    const attempts = state.value.attempts.filter((attempt) => attempt.questionKey === question);
    const review = deriveConversationReview(attempts, state.value.reviews);
    if (review)
      commit(
        'review.rebuild',
        {
          attemptId: review.evidenceIds.at(-1),
          due: Math.max(Date.now() + 1000, review.due),
          rating: review.rating,
          policy: review.policy,
          evidenceIds: review.evidenceIds,
          correctionId: id
        },
        `${id}:review`
      );
    return result;
  }
  function generateVariant() {
    assert(!busy.value && !active.value?.stopped, 'PRECONDITION', '请先结束请求或明确继续已停止的任务');
    const original = activeQuestion.value?.prerequisite
      ? state.value.questions.find((q) => questionKey(q) === activeQuestion.value.prerequisite.originalQuestionKey)
      : activeQuestion.value;
    assert(original, 'PRECONDITION', '请先选择原题');
    const variantId = learningId('variant');
    const algebra =
      createConditionVariant(variantId, original) ||
      createPrerequisiteVariant(variantId, original, activeQuestion.value) ||
      createAlgebraVariant(variantId, original);
    if (algebra) return addQuestion(algebra);
    const originalGoal = /^计算 ([+-]?\d{1,5}) ([+×*]) ([+-]?\d{1,5})。$/.exec(original.prompt);
    assert(
      original.source?.kind === 'executable' && originalGoal,
      'CAPABILITY_UNAVAILABLE',
      '当前有限验题器不支持此原题变式，需模型生成后独立复核'
    );
    const q = createArithmeticQuestion(
      learningId('variant'),
      `${originalGoal[1]} ${originalGoal[2]} ${originalGoal[3]}`,
      activeStrategy.value.difficulty,
      original
    );
    assert(q, 'CAPABILITY_UNAVAILABLE', '当前有限验题器不支持此变式，需模型生成后独立复核');
    return addQuestion(q);
  }
  function diagnosePrerequisite(id = learningId('diagnose')) {
    assert(!busy.value && !active.value?.stopped, 'PRECONDITION', '请先结束请求或明确继续已停止的任务');
    const q = createPrerequisiteQuestion(
      `${id}_question`,
      activeQuestion.value,
      state.value.attempts,
      selectedConversationId.value
    );
    assert(q, 'CAPABILITY_UNAVAILABLE', '当前原题没有受支持的可靠错答或未完整作答依据；不会生成无依据的小题');
    const result = addQuestion(q, 'independent_correct');
    notice(
      `已加入先修诊断小题。${q.prerequisite.reason}。先独立作答；需要时再请求提示，原题与未完成任务保留。`,
      `${id}:diagnostic`
    );
    return result;
  }
  function focus(question, conversationId = selectedConversationId.value, kind = null) {
    if (!conversationId) conversationId = start('继续学习').id;
    selectedConversationId.value = conversationId;
    commit('question.focus', { conversationId, questionKey: question, kind });
  }
  function exportData() {
    return learningRepository.exportData();
  }
  async function checkLocalConnection() {
    const connection = localConnection.value;
    assert(connection, 'PRECONDITION', '请先配置本地连接器');
    const owner = state.value.owner;
    const result = await testLocalConnector(connection, { platform: learningClientPlatform() });
    assert(
      learningRepository.read().owner === owner && localConnection.value === connection,
      'CONTEXT_CHANGED',
      '账户或连接已变更，未采用旧检查结果'
    );
    localConnection.value.status = 'connector_verified';
    localConnection.value.capabilities = result.capabilities;
    return result;
  }
  async function checkMaterialConnection() {
    const connection = materialConnection.value;
    const context = materialContext();
    assert(context, 'CONTEXT_CHANGED', '本机记录上下文不可用，未发起检查');
    const snapshot = connection ? JSON.parse(JSON.stringify(connection)) : null;
    const result = await testMaterialConnector(snapshot, { platform: learningClientPlatform() });
    assert(materialContext() === context, 'CONTEXT_CHANGED', '账户、记录或资料授权已变更，未采用旧检查结果');
    materialConnection.value.status = 'connector_verified';
    materialConnection.value.capabilities = {
      ...result.ocrEngines,
      uploadRecovery: result.uploadRecovery,
      uploadMaintenance: result.uploadMaintenance
    };
    return result;
  }
  function previewRestore(content) {
    assert(!busy.value && !materialBusy.value && !syncBusy.value, 'BUSY', '请等待当前任务结束后恢复');
    assert(typeof content === 'string' && content.length <= 12000000, 'RESOURCE_LIMIT', '备份超过资源上限');
    let value;
    try {
      value = JSON.parse(content);
    } catch {
      /* 原恢复器返回结构错误。 */
    }
    if (value?.format === HISTORY_PACKAGE || content.length > 1500000 || value?.events?.length > 500)
      return runHistory((options) => learningRepository.previewHistoryRestore(content, options));
    return learningRepository.previewRestore(content);
  }
  async function runHistory(prepare) {
    assert(!historyBusy.value, 'BUSY', '历史校验仍在执行，可先取消');
    historyBusy.value = true;
    historyProgress.value = null;
    historyController = new AbortController();
    const owner = state.value.owner;
    try {
      const result = await prepare({
        signal: historyController.signal,
        onProgress: (progress) => {
          if (!historyController?.signal.aborted && state.value.owner === owner) historyProgress.value = progress;
        }
      });
      assert(state.value.owner === owner, 'CONTEXT_CHANGED', '账户已变化，请重新校验历史');
      return result;
    } finally {
      historyBusy.value = false;
      historyController = null;
    }
  }
  function cancelHistory() {
    historyController?.abort();
  }
  function restoreData(content, preview) {
    assert(!busy.value && !materialBusy.value && !syncBusy.value, 'BUSY', '请等待当前任务结束后恢复');
    assert(preview?.owner === state.value.owner, 'OWNER_MISMATCH', '账户已切换，请重新预览');
    assert(!historyBusy.value, 'BUSY', '请等待历史校验完成');
    const result = preview.history
      ? learningRepository.restoreHistory(content, preview)
      : learningRepository.restoreData(content, preview.expectedRevision);
    state.value = result.state;
    selectedConversationId.value = state.value.conversations.at(-1)?.id || null;
    uni.$emit('conversationLearningUpdated');
    return result;
  }
  function rollbackRecords() {
    assert(!busy.value && !materialBusy.value && !syncBusy.value, 'BUSY', '请等待当前任务结束后撤销');
    state.value = learningRepository.rollback();
    selectedConversationId.value = state.value.conversations.at(-1)?.id || null;
    uni.$emit('conversationLearningUpdated');
  }
  function deleteData() {
    cancelHistory();
    cancel();
    cancelMaterial();
    cancelSync();
    state.value = learningRepository.deleteData();
    selectedConversationId.value = null;
    syncConflict.value = null;
  }
  function migrateLegacy() {
    state.value = learningRepository.migrateLegacy();
    return state.value;
  }
  function idleRecords() {
    assert(!busy.value && !materialBusy.value && !syncBusy.value && !historyBusy.value, 'BUSY', '请等待或取消当前任务');
  }
  function previewGuestMigration() {
    idleRecords();
    return runHistory((options) => learningRepository.previewGuestMigration(options));
  }
  function migrateGuest(preview, consent) {
    idleRecords();
    const result = learningRepository.migrateGuest(preview, consent);
    refresh();
    selectedConversationId.value = state.value.conversations.at(-1)?.id || null;
    uni.$emit('conversationLearningUpdated');
    return result;
  }
  async function runSync(action) {
    idleRecords();
    syncBusy.value = true;
    syncProgress.value = null;
    syncController = new AbortController();
    try {
      state.value = await action(syncController.signal);
      if (!active.value) selectedConversationId.value = state.value.conversations.at(-1)?.id || null;
      uni.$emit('conversationLearningUpdated');
      return state.value;
    } finally {
      syncBusy.value = false;
      syncController = null;
      refresh();
    }
  }
  function syncRecords(consent) {
    return runSync((signal) =>
      synchronizeLearning(learningRepository, consent, undefined, {
        signal,
        onProgress: (progress) => {
          if (!signal.aborted) syncProgress.value = progress;
        }
      })
    );
  }
  function cancelSync() {
    syncController?.abort();
  }
  function deleteCloudRecords(consent) {
    assert(consent, 'CONSENT_REQUIRED', '删除云端学习副本需要明确确认');
    return runSync(async (signal) => {
      const owner = learningRepository.read().owner;
      const result = await learningRequest('/learning-sync', { action: 'delete' }, { expectedOwner: owner, signal });
      assert(learningRepository.read().owner === owner, 'OWNER_MISMATCH', '账户已切换，未显示旧账户删除结果');
      assert(!signal.aborted, 'CANCELLED', '删除确认已取消；云端是否已删除需重新查询');
      assert(result.success && result.data?.deleted === true, 'DELETE_FAILED', result.message || '云端删除未确认');
      assert(
        result.data.modelResultCacheDeleted === true,
        'DELETE_INCOMPLETE',
        '学习副本已删除，但服务端未确认教学结果缓存清除；请升级后端并重试'
      );
      return learningRepository.read();
    });
  }
  function adoptCloudRecords(preview, consent) {
    return runSync((signal) => adoptRemoteConflict(learningRepository, preview, consent, undefined, { signal }));
  }
  function restoreConflictLocal(preview) {
    idleRecords();
    state.value = learningRepository.restoreConflictLocal(preview);
    selectedConversationId.value = state.value.conversations.at(-1)?.id || null;
    refresh();
    uni.$emit('conversationLearningUpdated');
  }
  function clearSyncConflict() {
    idleRecords();
    learningRepository.clearSyncConflict();
    syncConflict.value = null;
  }
  return {
    state,
    active,
    activeQuestion,
    summary,
    teachingProgress,
    currentPlan,
    selectedConversationId,
    activeStrategy,
    canDiagnose,
    diagnosticProgress,
    diagnosePrerequisite,
    busy,
    error,
    models,
    questionImage,
    interpretQuestionImage,
    modelPresets,
    testModel,
    checkLocalConnection,
    checkMaterialConnection,
    modelId,
    usage,
    selectedMode,
    streamEnabled,
    streamSupported,
    streamPlatform,
    streamPreview,
    recoverableRequest,
    recoverModelResult,
    localConnection,
    materialConnection,
    // 文件确认使用实际账户/记录生命周期；普通作答不会使已选文件失效。
    recordContext,
    prepareMaterialAction,
    materialContext,
    sharingAllowed,
    refresh,
    start,
    setRhythm,
    send,
    submit,
    cancel,
    commit,
    loadModels,
    loadUsage,
    saveModel,
    removeModel,
    importText,
    previewMaterialDeletion,
    deleteMaterial,
    retryOriginalDeletion,
    structureQuestion,
    correctQuestion,
    setRubric,
    correctAssessment,
    generateVariant,
    focus,
    exportData,
    previewRestore,
    historyBusy,
    historyProgress,
    cancelHistory,
    restoreData,
    rollbackRecords,
    deleteData,
    migrateLegacy,
    importFile,
    materialBusy,
    pendingUploads,
    inspectUpload,
    recoverUpload,
    closeUpload,
    previewPendingRemoval,
    forgetPendingUpload,
    restorePendingLocator,
    previewUploadMaintenance,
    compactUploadReceipts,
    materialProgress,
    cancelMaterial,
    syncRecords,
    syncBusy,
    syncProgress,
    syncConflict,
    cancelSync,
    deleteCloudRecords,
    adoptCloudRecords,
    restoreConflictLocal,
    clearSyncConflict,
    exportSyncConflict: (side) => learningRepository.exportSyncConflict(side),
    previewGuestMigration,
    migrateGuest
  };
});
