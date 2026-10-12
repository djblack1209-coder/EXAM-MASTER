import { defineStore } from 'pinia';
import { createOatutorQuestion } from '../../../laf-backend/functions/_shared/learning-oatutor.js';
import {
  createSentenceQuestion,
  nextSentenceTask,
  sentenceAnswer,
  sentenceHint,
  sentenceRetestReady
} from '../../../laf-backend/functions/_shared/learning-sentence.js';
import { rhythmOperations } from '@/services/learning/learning-rhythm.js';
import {
  describeJourney,
  trainingReport,
  journeyRecap,
  journeyDate,
  deriveJourneyInsights,
  conversationTimeline,
  dailyConversationContext,
  JOURNEY_MODULES
} from '../../../laf-backend/functions/_shared/learning-journey.js';
import { createJourneyQuestions } from '@/services/learning/journey-training.js';
import { reminderJobs } from '../../../laf-backend/functions/_shared/learning-reminders.js';
import { createLearningCalendar } from '@/services/learning/learning-calendar.js';
import { conversationStrategy } from '../../../laf-backend/functions/_shared/learning-strategy.js';
import { ENERGY_VISUAL_CONTRACT, ENERGY_TEMPLATE } from '../../../laf-backend/functions/_shared/learning-visual.js';
import { DENSITY_TEMPLATE } from '../../../laf-backend/functions/_shared/learning-density.js';
import { PRESSURE_TEMPLATE } from '../../../laf-backend/functions/_shared/learning-pressure.js';
import {
  createScienceQuestion,
  nextScienceInput,
  scienceInput,
  scienceVisualHelpContent,
  scienceRetestReady
} from '../../../laf-backend/functions/_shared/learning-science.js';
import {
  sourceDiagram,
  confirmedDiagramRecipe,
  diagramHelpContent
} from '../../../laf-backend/functions/_shared/learning-diagram.js';
import {
  createNoticeQuestion,
  createWritingQuestion,
  EXTENDED_WRITING_CONTRACTS,
  writingGenre,
  writingGenreInfo,
  nextWritingTask,
  writingRetestReady,
  nextNoticeDay,
  publicWritingReference
} from '../../../laf-backend/functions/_shared/learning-writing.js';
import {
  VOCABULARY_REVIEW_CONTRACT,
  createVocabularyReviewQuestion,
  vocabularyReviewDay,
  vocabularyRetestReady,
  vocabularyUseFeedbackBasis
} from '../../../laf-backend/functions/_shared/learning-vocabulary.js';
import {
  createPrerequisiteQuestion,
  createPrerequisiteVariant,
  prerequisiteProgress
} from '../../../laf-backend/functions/_shared/learning-prerequisite.js';
import { computed, ref, shallowRef, onScopeDispose, watch } from 'vue';
import { pendingUploadJournal } from '@/services/learning/pending-upload-journal.js';
import { learningRepository, LEARNING_KEY } from '@/services/learning/learning-repository.js';
import { getUserId, getToken } from '@/services/auth-storage.js';
import {
  COMPUTE_CONTRACT,
  computeScopeFor,
  sameComputeSnapshot,
  normalizeComputeReference,
  computeReferenceText
} from '../../../laf-backend/functions/_shared/learning-compute-contract.js';
import {
  GRAMMAR_CONTRACT,
  grammarScopeFor,
  normalizeGrammarReference,
  grammarReferenceText
} from '../../../laf-backend/functions/_shared/learning-grammar-contract.js';
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
  normalizeRubric,
  normalizeLearningTask,
  dayKey,
  learningTaskContext,
  createMaterialObjectiveQuestion,
  createMaterialObjectiveVariant
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
  requestLearningComputation,
  requestLearningGrammar,
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
  let notificationObserver = null,
    notificationRefreshTimer = null;
  function attachNotifications(observer) {
    notificationObserver = observer;
  }
  watch(
    () => JSON.stringify([state.value.owner, recordContext(), state.value.revision]),
    () => {
      if (!notificationObserver) return;
      if (notificationRefreshTimer !== null) clearTimeout(notificationRefreshTimer);
      notificationRefreshTimer = setTimeout(() => {
        notificationRefreshTimer = null;
        notificationObserver.refresh().catch(() => undefined);
      }, 250);
    }
  );
  const selectedConversationId = ref(state.value.conversations.at(-1)?.id || null);
  const busy = ref(false);
  const error = ref('');
  const models = ref([]);
  const modelPresets = ref([]);
  const modelId = ref('');
  const usage = ref(null);
  const modelListState = ref({ phase: 'idle', message: '' });
  const modelUsageState = ref({ phase: 'idle', message: '' });
  const modelReads = new Map();
  let modelResourceContext = null;
  const localConnection = ref(null);
  const materialConnection = ref(null);
  const sharingAllowed = ref(false);
  const selectedMode = ref('offline');
  const streamEnabled = ref(false),
    streamPreview = ref('');
  const visualRequest = shallowRef(null);
  const streamPlatform = learningStreamPlatform();
  const streamSupported = computed(
    () =>
      selectedMode.value === 'cloud' &&
      models.value.find((m) => m.id === modelId.value)?.capabilities?.stream === true &&
      streamPlatform !== 'unsupported'
  );
  let controller = null;
  let pendingCloudCall = null;
  let computeRequest = null;
  const pendingUploads = ref(pendingUploadJournal.list());
  const materialBusy = ref(false);
  const materialProgress = ref(null);
  const materialImportState = ref(null);
  const materialConnectionBusy = ref(false);
  let materialController = null;
  let materialRequestContext = null;
  let materialImportContext = null;
  let materialConnectionController = null;
  let materialConnectionRequestContext = null;
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
  function resetModelResources() {
    cancelModelReads(undefined, 'CONTEXT_CHANGED');
    models.value = [];
    modelPresets.value = [];
    usage.value = null;
    modelListState.value = { phase: 'idle', message: '' };
    modelUsageState.value = { phase: 'idle', message: '' };
    modelResourceContext = null;
  }
  watch(
    () => state.value,
    () => {
      if (modelResourceContext && recordContext() !== modelResourceContext) {
        resetModelResources();
      }
    },
    { flush: 'sync' }
  );
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
      if (materialImportContext && materialContext() !== materialImportContext) {
        materialImportContext = null;
        materialProgress.value = null;
        materialImportState.value = null;
      }
      if (materialConnectionRequestContext && materialContext() !== materialConnectionRequestContext)
        materialConnectionController?.abort();
    },
    { flush: 'sync' }
  );
  const syncBusy = ref(false);
  const syncState = ref({ phase: 'idle', message: '', context: null, kind: null });
  const syncConflict = ref(learningRepository.previewSyncConflict());
  let syncController = null;
  let syncRequest = null;
  const syncProgress = ref(null);
  watch(
    () => state.value,
    () => {
      const context = recordContext();
      if (syncRequest?.context && context !== syncRequest.context) cancelSync({ clearFeedback: true });
      if (syncState.value.context && context !== syncState.value.context)
        syncState.value = { phase: 'idle', message: '', context: null, kind: null };
    },
    { flush: 'sync' }
  );
  const historyBusy = ref(false),
    historyProgress = ref(null);
  let historyController = null;
  let historyRequestContext = null;
  watch(
    () => state.value,
    () => {
      if (
        historyRequestContext &&
        (recordContext() !== historyRequestContext.context || state.value.revision !== historyRequestContext.revision)
      )
        cancelHistory();
    },
    { flush: 'sync' }
  );
  const active = computed(() => state.value.conversations.find((c) => c.id === selectedConversationId.value));
  const conversationLocation = shallowRef(null);
  const timeline = computed(() => conversationTimeline(state.value, selectedConversationId.value, { dayKey }));
  watch(
    [() => JSON.stringify([state.value.owner, recordContext()]), selectedConversationId],
    () => {
      conversationLocation.value = null;
    },
    { flush: 'sync' }
  );
  function locateConversation(conversationId, day = null, groupId = null) {
    if (busy.value) return;
    const session = state.value.conversations.find((c) => c.id === conversationId);
    assert(session, 'NOT_FOUND', '学习目标不存在');
    const chapters = conversationTimeline(state.value, conversationId, { dayKey });
    const chapter = day ? chapters.find((entry) => entry.day === day) : null;
    assert(!day || chapter, 'NOT_FOUND', '学习日期不存在');
    const group = groupId ? chapter?.groups.find((g) => g.id === groupId) : null;
    assert(!groupId || group, 'NOT_FOUND', '模块记录不存在');
    selectedConversationId.value = conversationId;
    if (group) selectedTrainingId.value = group.id;
    const message = group
      ? chapter.messages.find((m) => group.questionKeys.includes(m.questionKey))
      : chapter?.messages[0];
    conversationLocation.value = { conversationId, day, groupId, messageId: message?.id || null };
  }
  const activeStrategy = computed(() => conversationStrategy(state.value, selectedConversationId.value));
  const activeQuestion = computed(() =>
    state.value.questions.find((q) => questionKey(q) === active.value?.activeQuestionKey)
  );
  const canComputeReference = computed(() => {
    try {
      computeScopeFor(state.value, selectedConversationId.value);
      return true;
    } catch {
      return false;
    }
  });
  const canCheckGrammar = computed(() => {
    try {
      grammarScopeFor(state.value, selectedConversationId.value);
      return true;
    } catch {
      return false;
    }
  });
  function computeReferenceContext() {
    return JSON.stringify([recordContext(), state.value.revision, selectedConversationId.value, getToken()]);
  }
  watch(
    [() => state.value, selectedConversationId],
    () => {
      if (computeRequest && computeReferenceContext() !== computeRequest.context) computeRequest.controller.abort();
    },
    { flush: 'sync' }
  );
  watch(
    [
      () => state.value.owner,
      recordContext,
      selectedConversationId,
      () => active.value?.activeQuestionKey,
      () => active.value?.stopped
    ],
    () => {
      visualRequest.value = null;
    },
    { flush: 'sync' }
  );
  const calendarTime = ref(Date.now());
  const calendar = createLearningCalendar((at) => {
    calendarTime.value = at;
  });
  const observeCalendar = () => calendar.observe();
  const summary = computed(() => summarizeLearning(state.value, calendarTime.value));
  const todaySummary = computed(() => summarizeLearning(state.value, calendarTime.value, { range: 'day' }));
  const journey = computed(() =>
    describeJourney(state.value, selectedConversationId.value, calendarTime.value, { dayKey, effectiveGrade })
  );
  const journeySummary = computed(() =>
    active.value
      ? summarizeLearning(state.value, calendarTime.value, {
          range: 'day',
          conversationId: active.value.id,
          timezone: active.value.journey?.timezone || state.value.timezone
        })
      : null
  );
  const scopedSummary = (range = 'day', conversationId) =>
    summarizeLearning(state.value, calendarTime.value, {
      range,
      ...(conversationId
        ? {
            conversationId,
            timezone:
              state.value.conversations.find((c) => c.id === conversationId)?.journey?.timezone || state.value.timezone
          }
        : {})
    });
  function journeyContext() {
    return JSON.stringify([recordContext(), selectedConversationId.value, state.value.revision]);
  }
  function configureJourney(expectedContext, config) {
    idleRecords();
    refresh();
    assert(expectedContext === journeyContext() && active.value, 'CONTEXT_CHANGED', '学习已变化，请重新核对目标');
    return commit('journey.configure', { conversationId: active.value.id, ...config });
  }
  const selectedTrainingId = ref(null);
  watch(
    selectedConversationId,
    () => {
      selectedTrainingId.value = null;
    },
    { flush: 'sync' }
  );
  const trainingGroup = computed(() => {
    if (selectedTrainingId.value === 'question-only') return null;
    const groups = active.value?.trainingGroups || [];
    const selected = groups.find((group) => group.id === selectedTrainingId.value);
    if (selected) return selected;
    // 重开后的临时选择为空，沿已保存焦点恢复；独立变式不被旧整批结果遮住。
    const key = active.value?.activeQuestionKey;
    return key ? groups.find((group) => group.questionKeys.includes(key)) || null : groups.at(-1) || null;
  });
  const trainingResult = computed(() =>
    trainingGroup.value
      ? trainingReport(state.value, active.value.id, trainingGroup.value.id, { effectiveGrade })
      : null
  );
  const batchTrainingActive = computed(() => Boolean(trainingGroup.value && trainingGroup.value.mode !== 'guided'));
  const dailyRecap = computed(() =>
    journey.value
      ? journeyRecap(state.value, active.value.id, 'day', journey.value.day, null, { effectiveGrade })
      : null
  );
  const journeyInsights = computed(() =>
    journey.value
      ? deriveJourneyInsights(state.value, active.value.id, journey.value.day, { effectiveGrade, dayKey })
      : { comparisons: [], consolidation: [], handoff: '' }
  );
  function startWeakness(expectedContext, attemptId) {
    requireJourney(expectedContext);
    assert(
      journeyInsights.value.consolidation.some((row) => row.evidenceIds.includes(attemptId)),
      'CONTEXT_CHANGED',
      '巩固依据已变化，请重新查看'
    );
    const attempt = state.value.attempts.find((a) => a.id === attemptId && a.conversationId === active.value.id);
    assert(attempt, 'NOT_FOUND', '原答不存在');
    focus(attempt.questionKey, active.value.id);
    selectedTrainingId.value = 'question-only';
    if (effectiveGrade(attempt).status !== 'reliable') return { questionKey: attempt.questionKey, pending: true };
    return generateVariant();
  }
  const weeklyRecap = computed(() =>
    journey.value
      ? journeyRecap(state.value, active.value.id, 'week', journey.value.day, null, { effectiveGrade })
      : null
  );
  const moduleRecap = computed(() =>
    trainingGroup.value && journey.value
      ? journeyRecap(state.value, active.value.id, 'module', trainingGroup.value.day, trainingGroup.value.id, {
          effectiveGrade
        })
      : null
  );
  function confirmRecap(expectedContext, kind = 'day') {
    requireJourney(expectedContext);
    const recap = kind === 'module' ? moduleRecap.value : kind === 'week' ? weeklyRecap.value : dailyRecap.value;
    assert(recap?.submitted, 'PRECONDITION', '请先提交训练后复盘');
    if (recap.confirmed) return recap.confirmed;
    return commit('recap.confirm', {
      conversationId: active.value.id,
      kind,
      day: recap.day,
      groupId: recap.groupId,
      signature: recap.signature,
      explicit: true
    });
  }
  function planNextTraining(expectedContext, moduleId, size) {
    requireJourney(expectedContext);
    const day = new Date((journeyDate(journey.value.day) + 1) * 86400000).toISOString().slice(0, 10);
    return startTraining(journeyContext(), moduleId, size, day);
  }
  function configureReminder(expectedContext, config) {
    requireJourney(expectedContext, true);
    return commit('reminder.set', { conversationId: active.value.id, ...config });
  }
  function reminderQueue(at = Date.now()) {
    return reminderJobs(state.value, at, { dayKey });
  }
  const notificationContext = () => JSON.stringify(learningRepository.notificationConsentContext());
  function prepareNotificationConsent() {
    idleRecords();
    learningRepository.prepareAsyncAction();
    return notificationContext();
  }
  function reminderReceipt(job, status, channel, expectedLifecycle) {
    refresh();
    assert(
      !expectedLifecycle || recordContext() === expectedLifecycle,
      'CONTEXT_CHANGED',
      '账户或记录已变化，旧通知回执未保存'
    );
    return commit(
      'reminder.receipt',
      {
        conversationId: job.conversationId,
        reminderId: job.reminderId,
        generation: job.generation,
        day: job.day,
        status,
        channel
      },
      `${job.id}:${channel}:${status}`
    );
  }
  function openReminder(job) {
    refresh();
    const session = state.value.conversations.find((c) => c.id === job.conversationId);
    assert(
      Number.isFinite(job.dueAt) &&
        reminderQueue(job.dueAt).some(
          (current) =>
            current.id === job.id &&
            current.conversationId === job.conversationId &&
            current.reminderId === job.reminderId &&
            current.generation === job.generation &&
            current.kind === job.kind &&
            current.day === job.day &&
            current.dueAt === job.dueAt &&
            (current.questionKey || null) === (job.questionKey || null)
        ),
      'CONTEXT_CHANGED',
      '提醒已修改、学习已停止或完成，或属于其他账户'
    );
    selectedConversationId.value = session.id;
    if (job.questionKey) {
      const group = session.trainingGroups?.find((g) => !g.submittedBy && g.questionKeys.includes(job.questionKey));
      const dueReview = state.value.reviews.some(
        (r) => !r.cancelled && r.questionKey === job.questionKey && r.due <= Date.now()
      );
      focus(job.questionKey, session.id, dueReview && !group ? 'review' : undefined);
      selectedTrainingId.value = group ? group.id : 'question-only';
    } else selectedTrainingId.value = null;
    return session;
  }
  function requireJourney(expectedContext, allowStopped = false) {
    idleRecords();
    refresh();
    assert(
      expectedContext === journeyContext() && active.value?.journey,
      'CONTEXT_CHANGED',
      '学习已变化，请重新核对题组'
    );
    assert(allowStopped || !active.value.stopped, 'STOPPED', '当前学习已停止');
  }
  function commitJourneyBatch(operations) {
    const outcome = learningRepository.commitBatch(operations, state.value.revision);
    state.value = outcome.state;
    uni.$emit('conversationLearningUpdated');
    return outcome;
  }
  function startTraining(expectedContext, moduleId, size = 5, plannedDay) {
    requireJourney(expectedContext);
    const program = active.value.journey;
    const day = plannedDay || dayKey(Date.now(), program.timezone);
    const existing = active.value.trainingGroups?.find(
      (g) => g.day === day && g.moduleId === moduleId && !g.submittedBy
    );
    if (existing) {
      selectedTrainingId.value = existing.id;
      return existing;
    }
    const id = learningId('training');
    const count = program.mode === 'guided' ? 1 : size;
    const questions = createJourneyQuestions(state.value, active.value.id, moduleId, count, id);
    const keys = questions.map(questionKey);
    const module = JOURNEY_MODULES.find((m) => m.id === moduleId);
    const at = Date.now(),
      conversationId = active.value.id;
    const tasks = state.value.plans.filter((p) => p.day === day).at(-1)?.tasks || [];
    assert(tasks.length + keys.length <= 100, 'RESOURCE_LIMIT', '当日计划最多100项任务');
    commitJourneyBatch([
      ...questions.map((question, index) => ({ id: `${id}:q${index}`, type: 'question.add', at, data: { question } })),
      {
        id,
        type: 'training.open',
        at,
        data: {
          conversationId,
          moduleId,
          questionKeys: keys,
          day,
          minutes: Math.max(1, Math.min(Math.floor(program.minutes / program.moduleIds.length), module.minutes))
        }
      },
      {
        id: `${id}:plan`,
        type: 'plan.set',
        at,
        data: {
          day,
          reason: `用户明确安排${module.label}训练`,
          tasks: [
            ...tasks,
            ...keys.map((key, index) => ({
              id: `${id}:task${index}`,
              title: `${module.label} · 第${index + 1}题`,
              questionKey: key,
              condition: 'submitted'
            }))
          ]
        }
      },
      { id: `${id}:focus`, type: 'question.focus', at, data: { conversationId, questionKey: keys[0] } }
    ]);
    selectedTrainingId.value = id;
    return active.value.trainingGroups.find((g) => g.id === id);
  }
  function selectTraining(groupId) {
    assert(
      active.value?.trainingGroups?.some((g) => g.id === groupId),
      'NOT_FOUND',
      '题组不存在'
    );
    selectedTrainingId.value = groupId;
  }
  function submitTraining(expectedContext, groupId, answers) {
    requireJourney(expectedContext, true);
    const group = active.value.trainingGroups?.find((g) => g.id === groupId);
    assert(
      group &&
        Array.isArray(answers) &&
        answers.length === group.questionKeys.length &&
        answers.every((value) => typeof value === 'string' && value.trim()),
      'INVALID_INPUT',
      '请完成全部题目再统一交卷'
    );
    if (group.submittedBy) {
      assert(
        group.attemptIds.every((id, index) => state.value.attempts.find((a) => a.id === id)?.answer === answers[index]),
        'IDEMPOTENCY_CONFLICT',
        '这组原答已保存，修改请另行重做'
      );
      return trainingReport(state.value, active.value.id, groupId, { effectiveGrade });
    }
    assert(!active.value.stopped, 'STOPPED', '当前学习已停止');
    const conversationId = active.value.id,
      at = Date.now();
    const attemptIds = group.questionKeys.map((_, index) => `${groupId}:answer${index}`);
    const before = state.value;
    const outcome = commitJourneyBatch([
      ...group.questionKeys.flatMap((key, index) => [
        {
          id: `${groupId}:submit-focus${index}`,
          type: 'question.focus',
          at,
          data: { conversationId, questionKey: key }
        },
        {
          id: attemptIds[index],
          type: 'attempt.submit',
          at,
          data: { conversationId, answer: answers[index], explicit: true, trainingGroupId: groupId }
        }
      ]),
      {
        id: `${groupId}:complete`,
        type: 'training.complete',
        at,
        data: { conversationId, groupId, attemptIds, explicit: true }
      }
    ]);
    // 后续FSRS仍沿同一可靠作答政策；整批原答成功后才建立调度。
    for (const id of attemptIds) {
      const attempt = state.value.attempts.find((a) => a.id === id);
      if (attempt && !before.attempts.some((a) => a.id === id)) scheduleAttempt(attempt);
    }
    selectedTrainingId.value = groupId;
    return trainingReport(outcome.state, conversationId, groupId, { effectiveGrade });
  }
  function openTrainingFeedback(expectedContext, groupId, key) {
    requireJourney(expectedContext);
    const group = active.value.trainingGroups?.find(
      (g) => g.id === groupId && g.submittedBy && g.questionKeys.includes(key)
    );
    assert(group, 'PRECONDITION', '请先完成整批交卷');
    focus(key);
    const segment = activeQuestion.value.scienceExercise
      ? {
          method: 'explain',
          helped: true,
          level: 3,
          content: scienceVisualHelpContent(activeQuestion.value.scienceExercise.input)
        }
      : localTeaching(activeQuestion.value, 'explain');
    if (!segment) return '本题原答已保存，表达与评分仍待核对。';
    deliverTeaching(segment, `${groupId}:explain:${group.questionKeys.indexOf(key)}`);
    return segment.content;
  }
  const taskContext = computed(() => learningTaskContext(state.value, selectedConversationId.value));
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
      materialConnectionController?.abort();
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
      materialImportState.value = null;
      materialImportContext = null;
      selectedConversationId.value = next.conversations.at(-1)?.id || null;
    }
    state.value = next;
    calendar.read();
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
      `${LEARNING_KEY}_sync_conflict`,
      `${LEARNING_KEY}_upload_pending`
    ].flatMap((key) => [`${prefix}${key}`, `__exam_storage__:${prefix}${key}`]);
    keys.push('EXAM_USER_ID', '__exam_storage__:EXAM_USER_ID');
    if (event.key !== null && !keys.includes(event.key)) return;
    if (event.storageArea && event.storageArea !== window.localStorage) return;
    try {
      refresh();
    } catch {
      resetModelResources();
      cancelSync({ clearFeedback: true });
      cancelHistory();
      materialController?.abort();
      materialConnection.value = null;
      error.value = '本机记录已变化且暂不可读，请重新核对；旧资料动作已取消。';
    }
  };
  if (typeof window !== 'undefined') window.addEventListener('storage', storageChanged);
  onScopeDispose(() => {
    if (notificationRefreshTimer !== null) clearTimeout(notificationRefreshTimer);
    notificationObserver?.dispose();
    calendar.dispose();
    if (typeof window !== 'undefined') window.removeEventListener('storage', storageChanged);
    for (const event of authEvents) uni.$off?.(event, refresh);
    controller?.abort();
    cancelModelReads();
    materialController?.abort();
    materialConnectionController?.abort();
    cancelSync({ clearFeedback: true });
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
  function start(goal, task) {
    error.value = '';
    const conversation = commit('conversation.start', { goal, ...(task ? { task: normalizeLearningTask(task) } : {}) });
    selectedConversationId.value = conversation.id;
    const id = learningId('q');
    const genre = /^(?:英文|英语)说明(?:写作)?[。.!]?$/u.test(goal.trim())
      ? 'explanation'
      : /^(?:英文|英语)论证(?:写作)?[。.!]?$/u.test(goal.trim())
        ? 'argument'
        : /^(?:英文|英语)邮件(?:写作)?[。.!]?$/u.test(goal.trim())
          ? 'email'
          : /^(?:英文|英语)学术讨论(?:写作)?[。.!]?$/u.test(goal.trim())
            ? 'discussion'
            : /^中文叙事(?:写作)?[。.!]?$/u.test(goal.trim())
              ? 'narrative'
              : /^中文材料论证(?:写作)?[。.!]?$/u.test(goal.trim())
                ? 'material_argument'
                : null;
    const question =
      (/^函数运算带练[。.!]?$/u.test(goal.trim()) ? createOatutorQuestion(id, conversation.id) : null) ||
      (/^压强(?:、压力与接触面积|与压力)?[。.!]?$/u.test(goal.trim())
        ? createScienceQuestion(id, conversation.id, {
            template: PRESSURE_TEMPLATE,
            target: 'pressure',
            uniformContact: true,
            normalForceN: 72,
            areaCm2: 24
          })
        : null) ||
      (/^密度(?:、质量与体积|与质量)?[。.!]?$/u.test(goal.trim())
        ? createScienceQuestion(id, conversation.id, {
            template: DENSITY_TEMPLATE,
            target: 'density',
            massG: 120,
            volumeCm3: 50
          })
        : null) ||
      (/^功与动能[。.!]?$/u.test(goal.trim())
        ? createScienceQuestion(id, conversation.id, {
            template: ENERGY_TEMPLATE,
            massKg: 2,
            initialVelocityMps: 1,
            netForceN: 4,
            direction: 'right',
            physicalSeconds: 2
          })
        : null) ||
      (/^(?:英文|英语)句子组织[。.!]?$/u.test(goal.trim()) ? createSentenceQuestion(id, conversation.id) : null) ||
      (genre ? createWritingQuestion(id, conversation.id, genre) : null) ||
      (/^(?:英文|英语)通知(?:写作)?[。.!]?$/u.test(goal.trim()) ? createNoticeQuestion(id, conversation.id) : null) ||
      createConditionQuestion(id, goal) ||
      createAlgebraQuestion(id, goal) ||
      createArithmeticQuestion(id, goal, activeStrategy.value.difficulty);
    if (question) addQuestion(question);
    return conversation;
  }
  function writingContext() {
    return JSON.stringify([recordContext(), selectedConversationId.value, active.value?.activeQuestionKey]);
  }
  function oatutorContext() {
    return JSON.stringify([writingContext(), state.value.revision, !!active.value?.stopped]);
  }
  function requireOatutorContext(expectedContext) {
    idleRecords();
    refresh();
    assert(expectedContext === oatutorContext(), 'CONTEXT_CHANGED', '学习已变化，请回到当前带练');
    assert(active.value && !active.value.stopped && !busy.value, 'STOPPED', '当前任务已停止或正在处理');
    assert(activeQuestion.value?.oatutorExercise?.role === 'main', 'PRECONDITION', '请先选择函数带练');
  }
  function startOatutor(expectedContext, itemId) {
    requireOatutorContext(expectedContext);
    const existing = state.value.questions.find(
      (q) =>
        q.oatutorExercise?.role === 'main' &&
        q.oatutorExercise.conversationId === active.value.id &&
        q.oatutorExercise.itemId === itemId &&
        q.oatutorExercise.packVersion === 1
    );
    if (existing) return focus(questionKey(existing));
    return addQuestion(createOatutorQuestion(learningId('oatutor_q'), active.value.id, itemId));
  }
  function oatutorAction(expectedContext, action, nodeId, answer, submissionId) {
    requireOatutorContext(expectedContext);
    const operations = {
      open: 'oatutor.node.open',
      submit: 'oatutor.scaffold.submit',
      reference: 'oatutor.reference.read',
      final: 'oatutor.final.read'
    };
    assert(operations[action], 'INVALID_INPUT', '带练操作不支持');
    return commit(
      operations[action],
      {
        conversationId: active.value.id,
        questionKey: active.value.activeQuestionKey,
        ...(nodeId !== undefined ? { nodeId } : {}),
        ...(action === 'submit' ? { answer, explicit: true } : {})
      },
      submissionId || learningId('oatutor')
    );
  }
  function startWriting(expectedContext, genreId = writingGenre(activeQuestion.value)) {
    idleRecords();
    refresh();
    assert(expectedContext === writingContext(), 'CONTEXT_CHANGED', '学习已切换，请重新打开写作');
    assert(!active.value?.stopped, 'STOPPED', '当前任务已停止');
    const genre = writingGenreInfo(genreId);
    if (!active.value) return start(genre.goal);
    const existing =
      activeQuestion.value?.writingExercise && writingGenre(activeQuestion.value) === genreId
        ? activeQuestion.value
        : state.value.questions
            .filter(
              (q) =>
                q.writingExercise?.conversationId === selectedConversationId.value &&
                q.writingExercise.phase === 'independent' &&
                writingGenre(q) === genreId
            )
            .at(-1);
    if (existing) {
      const key = questionKey(existing);
      const helped =
        active.value.activeQuestionKey === key
          ? active.value.pendingHints.length
          : active.value.helpQueues?.find((entry) => entry.questionKey === key)?.hints.length;
      const submitted = state.value.attempts.some((a) => a.questionKey === key && a.conversationId === active.value.id);
      if (!helped && !submitted) return focus(key);
      return addQuestion(
        createWritingQuestion(
          learningId('notice_independent'),
          selectedConversationId.value,
          genreId,
          nextWritingTask(state.value, selectedConversationId.value, genreId),
          submitted ? key : null
        )
      );
    }
    return addQuestion(createWritingQuestion(learningId('writing_q'), selectedConversationId.value, genreId));
  }
  function recordWritingHelp(expectedContext, content, genreId = writingGenre(activeQuestion.value)) {
    idleRecords();
    refresh();
    assert(expectedContext === writingContext(), 'CONTEXT_CHANGED', '学习已切换，请重新打开写作');
    assert(!active.value?.stopped, 'STOPPED', '当前任务已停止');
    if (!activeQuestion.value?.writingExercise || writingGenre(activeQuestion.value) !== genreId) return false;
    assert(typeof content === 'string' && content.length <= 500, 'RESOURCE_LIMIT', '写作提示过长');
    return commit('hint.add', { conversationId: selectedConversationId.value, content, level: 1 });
  }
  function readWritingReference(expectedContext, referenceId, referenceVersion) {
    idleRecords();
    refresh();
    assert(expectedContext === writingContext(), 'CONTEXT_CHANGED', '学习已切换，请重新打开参考');
    assert(active.value && !active.value.stopped, 'STOPPED', '当前任务已停止');
    const reference = publicWritingReference(referenceId, referenceVersion);
    const result = commit('hint.add', {
      conversationId: selectedConversationId.value,
      questionKey: active.value.activeQuestionKey,
      referenceId,
      referenceVersion
    });
    return { hintId: result.hintId, reference };
  }
  function openVocabulary(expectedContext, word) {
    idleRecords();
    refresh();
    assert(expectedContext === writingContext(), 'CONTEXT_CHANGED', '写作已切换，请重新选择词语');
    const result = commit('vocabulary.open', {
      conversationId: selectedConversationId.value,
      writingQuestionKey: active.value?.activeQuestionKey,
      word
    });
    return state.value.questions.find((q) => questionKey(q) === result.questionKey);
  }
  function submitVocabulary(expectedContext, key, answer) {
    idleRecords();
    refresh();
    assert(expectedContext === writingContext(), 'CONTEXT_CHANGED', '写作已切换，旧词义选择未保存');
    return commit('vocabulary.submit', {
      conversationId: selectedConversationId.value,
      questionKey: key,
      answer,
      explicit: true
    });
  }
  function vocabularyTaskFor(key, phase = 'retest', delayDays = 1) {
    assert(
      ['retest', 'usage'].includes(phase) && [1, 3, 7].includes(delayDays) && (phase === 'retest' || delayDays === 1),
      'INVALID_INPUT',
      '词义复测间隔不支持'
    );
    const day =
      phase === 'retest'
        ? vocabularyReviewDay(dayKey(Date.now(), state.value.timezone), delayDays)
        : dayKey(Date.now(), state.value.timezone);
    const target = state.value.questions.find(
      (q) =>
        q.vocabularyReview?.originQuestionKey === key &&
        q.vocabularyReview.phase === phase &&
        (phase !== 'retest' || (q.vocabularyReview.dueDay === day && (q.vocabularyReview.delayDays ?? 1) === delayDays))
    );
    if (!target) return null;
    const plan = state.value.plans.filter((p) => p.day === day).at(-1);
    return plan?.tasks.some((t) => t.questionKey === questionKey(target))
      ? { questionKey: questionKey(target), day, conversationId: target.vocabularyReview.conversationId }
      : null;
  }
  function startVocabularyTask(expectedContext, key, phase, delayDays = 1) {
    idleRecords();
    refresh();
    assert(expectedContext === writingContext(), 'CONTEXT_CHANGED', '写作已切换，请重新打开词语任务');
    assert(active.value && !active.value.stopped, 'STOPPED', '当前任务已停止');
    assert(['retest', 'usage'].includes(phase), 'INVALID_INPUT', '词语任务类型不支持');
    assert(
      [1, 3, 7].includes(delayDays) && (phase === 'retest' || delayDays === 1),
      'INVALID_INPUT',
      '词义复测间隔不支持'
    );
    const origin = state.value.questions.find((q) => questionKey(q) === key);
    assert(
      origin?.vocabularyExercise?.writingQuestionKey === active.value.activeQuestionKey &&
        origin.vocabularyExercise.conversationId === selectedConversationId.value,
      'CONTEXT_CHANGED',
      '请回到原写作安排词语任务'
    );
    const attempt = state.value.attempts.find(
      (a) => a.questionKey === key && a.conversationId === selectedConversationId.value
    );
    assert(attempt, 'PRECONDITION', '请先确认词义选择');
    const existing = vocabularyTaskFor(key, phase, delayDays);
    if (existing) {
      if (phase === 'usage') focus(existing.questionKey, existing.conversationId);
      return existing;
    }
    const plannedDay = dayKey(Date.now(), state.value.timezone),
      day = phase === 'retest' ? vocabularyReviewDay(plannedDay, delayDays) : plannedDay;
    const plan = state.value.plans.filter((p) => p.day === day).at(-1);
    assert((plan?.tasks.length || 0) < 100, 'RESOURCE_LIMIT', '词语计划已满');
    let target = state.value.questions.find(
      (q) =>
        q.vocabularyReview?.originQuestionKey === key &&
        q.vocabularyReview.phase === phase &&
        (phase !== 'retest' || (q.vocabularyReview.dueDay === day && (q.vocabularyReview.delayDays ?? 1) === delayDays))
    );
    if (!target) {
      const count = state.value.questions.filter(
        (q) =>
          q.vocabularyReview?.senseId === origin.vocabularyExercise.senseId &&
          q.vocabularyReview.phase === 'retest' &&
          q.vocabularyReview.contract === VOCABULARY_REVIEW_CONTRACT
      ).length;
      target = createVocabularyReviewQuestion(
        learningId('vocabulary_task'),
        origin,
        attempt.id,
        phase,
        phase === 'retest' ? { day: plannedDay, timezone: state.value.timezone } : null,
        phase === 'retest' ? (delayDays === 1 ? count % 2 : delayDays === 3 ? 0 : 1) : 0,
        delayDays
      );
      commit('question.add', { question: target });
    }
    commit('plan.set', {
      day,
      tasks: [
        ...(plan?.tasks || []).map((t) => ({ ...t })),
        {
          id: `${target.id}:task`,
          title: target.prompt,
          questionKey: questionKey(target),
          condition: phase === 'retest' ? 'independent_correct' : 'submitted'
        }
      ],
      reason:
        phase === 'retest'
          ? delayDays === 1
            ? '用户安排明日词义复测，需无提示且正确'
            : `用户安排${delayDays}天后词义复测，需无提示且正确`
          : '用户开始自由写句；提交不代表用法正确'
    });
    if (phase === 'usage') focus(questionKey(target), target.vocabularyReview.conversationId);
    return { questionKey: questionKey(target), day, conversationId: target.vocabularyReview.conversationId };
  }
  function recordDiagramHelp(expectedContext, input) {
    idleRecords();
    refresh();
    assert(expectedContext === writingContext(), 'CONTEXT_CHANGED', '学习已切换，请重新确认原图');
    assert(active.value && !active.value.stopped, 'STOPPED', '当前任务已停止');
    const source = sourceDiagram(state.value, activeQuestion.value, selectedConversationId.value);
    assert(source, 'IMAGE_SOURCE_UNAVAILABLE', '本题原页图或提取版本已不可用');
    const recipe = confirmedDiagramRecipe(input, source);
    return commit('hint.add', {
      conversationId: selectedConversationId.value,
      content: diagramHelpContent(recipe, source.binding.page),
      level: 1
    });
  }
  function startScience(expectedContext, input) {
    idleRecords();
    refresh();
    assert(expectedContext === writingContext(), 'CONTEXT_CHANGED', '学习已切换，请重新打开演示');
    assert(!active.value?.stopped, 'STOPPED', '当前任务已停止');
    const observed = scienceInput(input);
    let next = nextScienceInput(observed);
    if (!active.value) start('物理独立检验');
    const original = activeQuestion.value;
    const sameExercise =
      original?.scienceExercise &&
      JSON.stringify(scienceInput(original.scienceExercise.input)) === JSON.stringify(observed);
    let parent =
      sameExercise || sourceDiagram(state.value, original, selectedConversationId.value) ? questionKey(original) : null;
    const findExisting = () =>
      state.value.questions.find(
        (q) =>
          q.scienceExercise?.phase === 'independent' &&
          q.scienceExercise.conversationId === selectedConversationId.value &&
          (q.parentQuestionKey || null) === parent &&
          JSON.stringify(q.scienceExercise.input) === JSON.stringify(next)
      );
    let existing = findExisting(),
      remaining = state.value.questions.length + 1;
    // 未使用的新题可复用；已看帮助或提交过的题目继续换条件，不能伪装成撤去支架的独立检验。
    while (existing) {
      const key = questionKey(existing);
      const helped =
        active.value.activeQuestionKey === key
          ? active.value.pendingHints.length
          : active.value.helpQueues?.find((entry) => entry.questionKey === key)?.hints.length;
      const submitted = state.value.attempts.some(
        (a) => a.questionKey === key && a.conversationId === selectedConversationId.value
      );
      if (!helped && !submitted) break;
      assert(--remaining > 0, 'RESOURCE_LIMIT', '独立检验需要可用的新条件');
      parent = key;
      next = nextScienceInput(existing.scienceExercise.input);
      existing = findExisting();
    }
    if (existing) return focus(questionKey(existing));
    return addQuestion(
      createScienceQuestion(learningId('science_q'), selectedConversationId.value, next, parent),
      'independent_correct'
    );
  }
  function requireSentenceContext(expectedContext) {
    idleRecords();
    refresh();
    assert(expectedContext === writingContext(), 'CONTEXT_CHANGED', '学习已切换，请回到当前句子');
    assert(active.value?.id && !active.value.stopped && !busy.value, 'STOPPED', '当前任务已停止或正在处理');
    assert(activeQuestion.value?.sentenceExercise, 'PRECONDITION', '请先选择句子任务');
  }
  function submitSentence(expectedContext, order) {
    requireSentenceContext(expectedContext);
    return submit(sentenceAnswer(activeQuestion.value, order), true);
  }
  function recordSentenceHelp(expectedContext) {
    requireSentenceContext(expectedContext);
    const content = sentenceHint(activeQuestion.value);
    if (
      !active.value.pendingHints.some((h) => h.content === content && h.questionKey === active.value.activeQuestionKey)
    )
      commit('hint.add', { conversationId: selectedConversationId.value, content, level: 1 });
    return content;
  }
  function startSentenceTask(expectedContext) {
    requireSentenceContext(expectedContext);
    const key = questionKey(activeQuestion.value);
    const submitted = state.value.attempts.some(
      (a) => a.questionKey === key && a.conversationId === selectedConversationId.value
    );
    return addQuestion(
      createSentenceQuestion(
        learningId('sentence_q'),
        selectedConversationId.value,
        nextSentenceTask(state.value, selectedConversationId.value),
        submitted ? key : null
      ),
      'independent_correct'
    );
  }
  const sentenceCanSubmit = () => {
    void calendarTime.value;
    return sentenceRetestReady(activeQuestion.value);
  };
  const sentenceRetest = computed(() => {
    const key = activeQuestion.value && questionKey(activeQuestion.value);
    for (const q of state.value.questions.slice().reverse()) {
      if (
        q.sentenceExercise?.phase !== 'retest' ||
        q.parentQuestionKey !== key ||
        q.sentenceExercise.conversationId !== selectedConversationId.value
      )
        continue;
      const plan = state.value.plans.filter((p) => p.day === q.sentenceExercise.dueDay).at(-1);
      if (plan?.tasks.some((t) => t.questionKey === questionKey(q)))
        return { questionKey: questionKey(q), day: plan.day, conversationId: q.sentenceExercise.conversationId };
    }
    return null;
  });
  function scheduleSentenceRetest(expectedContext) {
    requireSentenceContext(expectedContext);
    const key = questionKey(activeQuestion.value);
    assert(
      state.value.attempts.some((a) => a.questionKey === key && a.conversationId === selectedConversationId.value),
      'PRECONDITION',
      '请先提交当前句子的作答'
    );
    if (sentenceRetest.value) return sentenceRetest.value;
    const plannedDay = dayKey(Date.now(), state.value.timezone),
      day = nextNoticeDay(plannedDay);
    const plan = state.value.plans.filter((p) => p.day === day).at(-1);
    assert((plan?.tasks.length || 0) < 100, 'RESOURCE_LIMIT', '明日计划已满');
    let target = state.value.questions.find(
      (q) =>
        q.sentenceExercise?.phase === 'retest' &&
        q.sentenceExercise.conversationId === selectedConversationId.value &&
        q.parentQuestionKey === key &&
        q.sentenceExercise.dueDay === day
    );
    if (!target) {
      target = createSentenceQuestion(
        learningId('sentence_retest'),
        selectedConversationId.value,
        nextSentenceTask(state.value, selectedConversationId.value),
        key,
        { day: plannedDay, timezone: state.value.timezone }
      );
      commit('question.add', { question: target });
    }
    commit('plan.set', {
      day,
      tasks: [
        ...(plan?.tasks || []).map((t) => ({ ...t })),
        {
          id: `${target.id}:task`,
          title: target.prompt,
          questionKey: questionKey(target),
          condition: 'independent_correct'
        }
      ],
      reason: '用户安排明日新句子复测；需无提示且匹配本题组合'
    });
    return sentenceRetest.value;
  }
  function recordScienceHelp(expectedContext, input) {
    idleRecords();
    refresh();
    assert(expectedContext === writingContext(), 'CONTEXT_CHANGED', '学习已切换，请重新打开演示');
    assert(active.value && !active.value.stopped, 'STOPPED', '当前任务已停止');
    const q = activeQuestion.value;
    assert(q?.scienceExercise || q?.subject === '物理', 'PRECONDITION', '请回到当前物理题');
    if (q.scienceExercise?.input?.template === PRESSURE_TEMPLATE || input?.template === PRESSURE_TEMPLATE)
      assert(
        q.scienceExercise?.input?.template === PRESSURE_TEMPLATE &&
          JSON.stringify(scienceInput(input)) === JSON.stringify(scienceInput(q.scienceExercise.input)),
        'CONTEXT_CHANGED',
        '请回到当前压强题的条件。'
      );
    const content = scienceVisualHelpContent(input),
      key = questionKey(q);
    if (active.value.pendingHints.some((h) => h.questionKey === key && h.content === content && h.level === 1))
      return true;
    commit('hint.add', { conversationId: selectedConversationId.value, content, level: 1 });
    return true;
  }
  // 渲染订阅可见时钟，动作再次读取真实当前时间，不沿用后台或昨日值。
  const scienceCanSubmit = () => {
    void calendarTime.value;
    return scienceRetestReady(activeQuestion.value);
  };
  const writingCanSubmit = () => {
    void calendarTime.value;
    return writingRetestReady(activeQuestion.value);
  };
  const vocabularyCanSubmit = () => {
    void calendarTime.value;
    return vocabularyRetestReady(activeQuestion.value);
  };
  const scienceRetest = computed(() => {
    const key = activeQuestion.value && questionKey(activeQuestion.value);
    for (const q of state.value.questions) {
      if (
        q.scienceExercise?.phase !== 'retest' ||
        q.parentQuestionKey !== key ||
        q.scienceExercise.conversationId !== selectedConversationId.value
      )
        continue;
      const plan = state.value.plans.filter((p) => p.day === q.scienceExercise.dueDay).at(-1);
      if (plan?.tasks.some((t) => t.questionKey === questionKey(q)))
        return { questionKey: questionKey(q), day: plan.day, conversationId: q.scienceExercise.conversationId };
    }
    return null;
  });
  function scheduleScienceRetest() {
    idleRecords();
    refresh();
    assert(active.value && !active.value.stopped, 'STOPPED', '当前任务已停止');
    const original = activeQuestion.value,
      key = original && questionKey(original);
    assert(
      original?.scienceExercise &&
        state.value.attempts.some((a) => a.questionKey === key && a.conversationId === selectedConversationId.value),
      'PRECONDITION',
      '请先提交当前题目的作答'
    );
    if (scienceRetest.value) return scienceRetest.value;
    const plannedDay = dayKey(Date.now(), state.value.timezone),
      day = nextNoticeDay(plannedDay);
    const plan = state.value.plans.filter((p) => p.day === day).at(-1);
    assert((plan?.tasks.length || 0) < 100, 'RESOURCE_LIMIT', '明日计划已满');
    let target = state.value.questions.find(
      (q) =>
        q.scienceExercise?.phase === 'retest' &&
        q.scienceExercise.conversationId === selectedConversationId.value &&
        q.parentQuestionKey === key &&
        q.scienceExercise.dueDay === day
    );
    if (!target) {
      target = createScienceQuestion(
        learningId('science_retest'),
        selectedConversationId.value,
        nextScienceInput(original.scienceExercise.input),
        key,
        { day: plannedDay, timezone: state.value.timezone }
      );
      commit('question.add', { question: target });
    }
    commit('plan.set', {
      day,
      tasks: [
        ...(plan?.tasks || []).map((t) => ({ ...t })),
        {
          id: `${target.id}:task`,
          title: target.prompt,
          questionKey: questionKey(target),
          condition: 'independent_correct'
        }
      ],
      reason: '用户安排明日科学复测，需无提示且正确'
    });
    return scienceRetest.value;
  }
  const writingRetest = computed(() => {
    const key = activeQuestion.value && questionKey(activeQuestion.value);
    for (const q of state.value.questions.slice().reverse()) {
      if (
        q.writingExercise?.phase !== 'retest' ||
        q.parentQuestionKey !== key ||
        q.writingExercise.conversationId !== selectedConversationId.value
      )
        continue;
      const plan = state.value.plans.filter((p) => p.day === q.writingExercise.dueDay).at(-1);
      if (plan?.tasks.some((t) => t.questionKey === questionKey(q)))
        return { questionKey: questionKey(q), day: plan.day, conversationId: q.writingExercise.conversationId };
    }
    return null;
  });
  function writingAttempt(id = null) {
    const attempt = state.value.attempts
      .filter(
        (a) => a.questionKey === active.value?.activeQuestionKey && a.conversationId === selectedConversationId.value
      )
      .at(-1);
    assert(
      activeQuestion.value?.writingExercise && attempt && (!id || attempt.id === id),
      'CONTEXT_CHANGED',
      '请先提交当前写作的独立作答'
    );
    assert(
      !EXTENDED_WRITING_CONTRACTS.includes(activeQuestion.value.writingExercise.contract) ||
        !attempt.corrections?.length,
      'CONTEXT_CHANGED',
      '原答已校对，请提交新原答再获取反馈'
    );
    return attempt;
  }
  function feedbackAttempt(id = null) {
    if (activeQuestion.value?.vocabularyReview?.phase !== 'usage') return writingAttempt(id);
    vocabularyUseFeedbackBasis(activeQuestion.value, state.value);
    const attempt = state.value.attempts
      .filter(
        (a) => a.questionKey === active.value?.activeQuestionKey && a.conversationId === selectedConversationId.value
      )
      .at(-1);
    assert(!active.value?.stopped, 'STOPPED', '当前任务已停止');
    assert(
      attempt && (!id || attempt.id === id) && !attempt.corrections?.length,
      'CONTEXT_CHANGED',
      '请先提交当前原句；校对后需提交新的原句'
    );
    return attempt;
  }
  function scheduleWritingRetest() {
    idleRecords();
    refresh();
    assert(!active.value?.stopped, 'STOPPED', '当前任务已停止');
    writingAttempt();
    if (writingRetest.value) return writingRetest.value;
    const key = questionKey(activeQuestion.value),
      plannedDay = dayKey(Date.now(), state.value.timezone),
      day = nextNoticeDay(plannedDay);
    const plan = state.value.plans.filter((p) => p.day === day).at(-1);
    assert((plan?.tasks.length || 0) < 100, 'RESOURCE_LIMIT', '明日计划已满');
    // 计划保存失败时保留新题，重试复用同一题，不消耗另一任务或丢失原答。
    let target = state.value.questions.find(
      (q) =>
        q.writingExercise?.phase === 'retest' &&
        q.writingExercise.conversationId === selectedConversationId.value &&
        q.parentQuestionKey === key &&
        q.writingExercise.dueDay === day
    );
    if (!target) {
      target = createWritingQuestion(
        learningId('notice_retest'),
        selectedConversationId.value,
        writingGenre(activeQuestion.value),
        nextWritingTask(state.value, selectedConversationId.value, writingGenre(activeQuestion.value)),
        key,
        day,
        { day: plannedDay, timezone: state.value.timezone }
      );
      commit('question.add', { question: target });
    }
    commit('plan.set', {
      day,
      tasks: [
        ...(plan?.tasks || []).map((t) => ({ ...t })),
        { id: `${target.id}:task`, title: target.prompt, questionKey: questionKey(target), condition: 'submitted' }
      ],
      reason: '用户安排明日写作复测；提交不代表可靠掌握'
    });
    return writingRetest.value;
  }
  async function requestWritingFeedback() {
    idleRecords();
    refresh();
    assert(!active.value?.stopped, 'STOPPED', '当前任务已停止');
    const attempt = writingAttempt();
    assert(selectedMode.value !== 'offline', 'CAPABILITY_UNAVAILABLE', '请先连接模型');
    assert(sharingAllowed.value, 'CONSENT_REQUIRED', '请先确认数据流向');
    return send(
      '请按当前量表评阅已保存的写作原答，调用 assess 保存全部维度和准确原答引用。分值只是辅助，无法判断的维度留空。回复只讲一个最需要改进的地方和一个下一步，遵循我的教法。',
      { feedbackAttemptId: attempt.id }
    );
  }
  async function requestComputeReference(consent) {
    return requestUpstreamHelp(consent, false);
  }
  async function requestGrammarHelp(consent) {
    return requestUpstreamHelp(consent, true);
  }
  async function requestUpstreamHelp(consent, grammar) {
    const contract = grammar ? GRAMMAR_CONTRACT : COMPUTE_CONTRACT;
    const scopeFor = grammar ? grammarScopeFor : computeScopeFor;
    const normalize = grammar ? normalizeGrammarReference : normalizeComputeReference;
    const referenceText = grammar ? grammarReferenceText : computeReferenceText;
    const requestApi = grammar ? requestLearningGrammar : requestLearningComputation;
    idleRecords();
    learningRepository.prepareAsyncAction();
    refresh();
    assert(consent === true, 'CONSENT_REQUIRED', '请确认使用已同步的本题和原答获取建议');
    assert(
      state.value.owner !== 'guest' && getUserId() === state.value.owner && getToken(),
      'AUTH_REQUIRED',
      '登录并同步本题和原答后可获取建议'
    );
    const scope = scopeFor(state.value, selectedConversationId.value);
    const existing = active.value.messages.find(
      (m) =>
        m.upstreamReference?.contract === (grammar ? 'grammar-reference-v1' : 'sympy-reference-v1') &&
        m.upstreamReference.attemptId === scope.attemptId &&
        m.questionKey === scope.questionKey
    );
    if (existing) return { reused: true, messageId: existing.id };
    const request = { controller: new AbortController(), context: computeReferenceContext(), owner: state.value.owner };
    const epoch = `revision_${state.value.revision}`;
    computeRequest = request;
    controller = request.controller;
    busy.value = true;
    error.value = '';
    try {
      const response = await requestApi(
        {
          contract,
          action: grammar ? 'grammar_reference' : 'sympy_reference',
          consent: true,
          epoch,
          ...scope
        },
        { expectedOwner: request.owner, signal: request.controller.signal }
      );
      refresh();
      assert(
        !request.controller.signal.aborted && computeReferenceContext() === request.context,
        'CONTEXT_CHANGED',
        '任务已变化，未显示旧工具建议'
      );
      assert(response?.success, 'COMPUTE_FAILED', response?.message || '工具建议暂不可用，原答保持');
      const data = response.data;
      assert(
        data?.contract === contract &&
          data.ownerId === request.owner &&
          data.conversationId === scope.conversationId &&
          data.epoch === epoch &&
          data.gradingAuthority === false &&
          data.persisted === false &&
          data.requiresHelpRecord === true &&
          sameComputeSnapshot(data.expected, scope.expected),
        'INVALID_RESPONSE',
        '工具回执与本题原答不一致'
      );
      const reference = normalize(data.reference, state.value, scope.conversationId, scope.questionKey);
      // One atomic teaching event saves the help and message before either is displayed.
      computeRequest = null;
      return commit(
        'teaching.deliver',
        {
          conversationId: scope.conversationId,
          questionKey: scope.questionKey,
          method: 'explain',
          origin: 'upstream_reference',
          helped: true,
          level: 3,
          content: referenceText(reference),
          upstreamReference: reference
        },
        `${grammar ? 'grammar' : 'sympy'}_${reference.requestId}`
      );
    } catch (failure) {
      if (computeReferenceContext() === request.context) error.value = failure.message;
      throw failure;
    } finally {
      if (computeRequest === request) computeRequest = null;
      if (controller === request.controller) {
        controller = null;
        busy.value = false;
      }
    }
  }
  async function requestVocabularyFeedback() {
    idleRecords();
    refresh();
    assert(activeQuestion.value?.vocabularyReview?.phase === 'usage', 'PRECONDITION', '请打开自由写句任务');
    const attempt = feedbackAttempt();
    assert(selectedMode.value !== 'offline', 'CAPABILITY_UNAVAILABLE', '请先连接模型');
    assert(sharingAllowed.value, 'CONSENT_REQUIRED', '请先确认数据流向');
    return send(
      '请按当前词义和量表评阅我已提交的原句，仅调用 assess 保存全部维度和准确原答引用。核对词义、词形搭配和本句情境，无法判断的维度留空；不要按包含词语就判断用法正确。反馈一个改进点和一个下一步，遵循我的教法。',
      { feedbackAttemptId: attempt.id }
    );
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
      reason:
        condition === 'independent_correct'
          ? '将当前练习加入今日任务，完成条件为独立正确'
          : '将当前练习加入今日任务，完成条件为正式作答'
    });
    return result;
  }
  function scheduleAttempt(attempt) {
    if (state.value.questions.find((q) => questionKey(q) === attempt.questionKey)?.vocabularyReview) return;
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
            : '作答已保存，判分待核对。'
        : activeQuestion.value?.sentenceExercise
          ? grade.outcome === 'correct'
            ? '本题组合正确。'
            : '本题组合需调整。'
          : activeQuestion.value?.vocabularyReview
            ? grade.outcome === 'correct'
              ? '本句选对。'
              : '本句需再认。'
            : grade.outcome === 'wrong'
              ? '这次答错了，已加入错题。'
              : grade.outcome === 'partial'
                ? '部分正确，请补全答案。'
                : '答对了。';
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
    const training = active.value?.trainingGroups?.find(
      (g) =>
        g.mode === 'guided' && !g.submittedBy && g.questionKeys.length === 1 && g.questionKeys[0] === result.questionKey
    );
    if (training)
      commit(
        'training.complete',
        { conversationId: active.value.id, groupId: training.id, attemptIds: [result.id], explicit: true },
        `${training.id}:complete`
      );
    return result;
  }
  async function send(raw, options = {}) {
    if (options.feedbackAttemptId) {
      assert(!options.visual, 'FORBIDDEN', '写作反馈不发送图片');
      feedbackAttempt(options.feedbackAttemptId);
    }
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
      notice('请独立完成这道变式。', `${id}:independent-check`);
      return result;
    }
    if (active.value.journey && !options.visual && !options.feedbackAttemptId) {
      const request = raw.trim().replace(/[。！!]+$/u, '');
      if (/^(?:查看)?(?:今天|今日|本周|本模块)复盘$/u.test(request)) {
        const recap = request.includes('本周')
          ? weeklyRecap.value
          : request.includes('本模块')
            ? moduleRecap.value
            : dailyRecap.value;
        notice(
          recap?.submitted
            ? `已提交 ${recap.submitted} 题；可靠正确 ${recap.correct}；部分正确 ${recap.partial}；待核对 ${recap.pending}。\n${recap.modules.map((m) => `${m.label}：${m.next}`).join('\n')}`
            : '提交训练后即可复盘。',
          `${id}:offline`
        );
        return;
      }
      if (/^(?:完成|保存)(?:今天|今日|本周|本模块)复盘$/u.test(request)) {
        confirmRecap(
          journeyContext(),
          request.includes('本周') ? 'week' : request.includes('本模块') ? 'module' : 'day'
        );
        notice('本次复盘已保存。', `${id}:offline`);
        return;
      }
      if (/^(?:开始整批训练|继续今日学习|开始下一模块)$/u.test(request)) {
        assert(!active.value.stopped, 'STOPPED', '当前任务已停止，请先明确继续');
        const module = journey.value.current;
        if (module) startTraining(journeyContext(), module.id, module.id.startsWith('writing-') ? 1 : 5);
        notice(module ? `已打开${module.label}题组。` : '今日模块已提交，可以进行复盘。', `${id}:offline`);
        return;
      }
    }
    const directive = options.visual ? null : userDirective(raw, state.value, selectedConversationId.value);
    if (directive) {
      commit(directive.type, directive.data, `${id}:directive`);
      notice(
        directive.type === 'journey.configure'
          ? '训练节奏已保存，新题组按此节奏开始。'
          : directive.type === 'task.stop'
            ? '当前任务已停止。'
            : directive.type === 'strategy.auto'
              ? '已恢复自动教法。'
              : directive.type === 'task.resume'
                ? '已继续学习。'
                : '已切换教法。',
        `${id}:updated`
      );
      if (['task.stop', 'task.resume', 'strategy.auto', 'plan.set', 'journey.configure'].includes(directive.type))
        return;
      if (active.value.stopped) return;
    } else if (active.value.stopped) {
      notice('已停止，请先继续任务。', `${id}:stopped`);
      return;
    } else if (
      activeQuestion.value &&
      !options.visual &&
      !options.feedbackAttemptId &&
      !options.discussionOnly &&
      !activeQuestion.value.writingExercise
    ) {
      const result = submit(raw, false, `${id}:answer`);
      if (!result.clarification && (result.grade?.status === 'reliable' || selectedMode.value === 'offline'))
        return result;
    }
    if (selectedMode.value === 'offline') {
      if (directive?.type === 'strategy.set' && directive.data.method === 'challenge') {
        const challenge = createArithmeticChallenge(`${id}_challenge`, activeQuestion.value);
        if (challenge) {
          if (!state.value.questions.some((q) => questionKey(q) === questionKey(challenge))) addQuestion(challenge);
          notice('试试这道进阶题。', `${id}:challenge`);
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
      notice('尚未连接模型，请先连接。', `${id}:offline`);
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
      ...(options.feedbackAttemptId ? { feedbackAttemptId: options.feedbackAttemptId } : {}),
      lockedMethod:
        directive?.type === 'strategy.set'
          ? directive.data.method
          : requestedTeachingMethod(state.value, conversationId)
    };
    if (options.visual) request.visualSource = options.image.source;
    const assertCurrent = () => {
      refresh();
      if (request.feedbackAttemptId) feedbackAttempt(request.feedbackAttemptId);
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
    const useFeedback =
      options.feedbackAttemptId && activeQuestion.value?.vocabularyReview?.phase === 'usage'
        ? vocabularyUseFeedbackBasis(activeQuestion.value, state.value)
        : null;
    const dailyContext = dailyConversationContext(state.value, conversationId, Date.now(), { dayKey, effectiveGrade });
    const payload = {
      requestId: id,
      requestBinding: binding,
      modelId: modelId.value,
      shareConsent: sharingAllowed.value,
      ...(options.visual ? { images: [options.image], imageShareConsent: true } : {}),
      messages: dailyContext.messages,
      learningContext: {
        owner,
        goal: active.value.goal,
        task: active.value.task || normalizeLearningTask(),
        capabilities: { ...taskContext.value, visualization: ENERGY_VISUAL_CONTRACT },
        profile: [
          ...state.value.profile.slice(active.value.journey ? -5 : -6),
          ...(active.value.journey
            ? [
                {
                  field: 'preference',
                  source: 'self_report',
                  scope: `对话 ${conversationId}`,
                  evidenceIds: [],
                  value: `${active.value.journey.mode === 'guided' ? '单题带练' : active.value.journey.mode === 'timed' ? '限时训练、统一交卷' : '整批训练、统一交卷'}；目标：${active.value.journey.title}；每天${active.value.journey.minutes}分钟；今日路线：${journey.value.modules.map((m) => `${m.label} ${m.status}`).join('，')}。请按此节奏反馈，题组由明确开始的宿主任务提供。`
                }
              ]
            : [])
        ].map(({ field, value, source, scope, evidenceIds }) => ({
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
              rubric: activeQuestion.value.rubric || useFeedback?.rubric || null,
              ...(useFeedback
                ? {
                    vocabularyUse: {
                      contract: useFeedback.contract,
                      senseId: useFeedback.senseId,
                      senseVersion: useFeedback.senseVersion,
                      word: useFeedback.word,
                      meaning: useFeedback.meaning,
                      originPrompt: useFeedback.originPrompt
                    }
                  }
                : {})
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
          continuity: dailyContext.continuity,
          first: (journeySummary.value || summary.value).first,
          tasks: (journeySummary.value || summary.value).tasks,
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
            ...(request.feedbackAttemptId ? { feedbackAttemptId: request.feedbackAttemptId } : {}),
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
              assertCurrent,
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
    if (request.feedbackAttemptId) {
      feedbackAttempt(request.feedbackAttemptId);
      assert(
        !data.question &&
          data.tools?.length === 1 &&
          data.tools[0].name === 'assess' &&
          data.tools[0].arguments?.attemptId === request.feedbackAttemptId,
        'FORBIDDEN',
        '写作反馈只评阅当前已保存原答'
      );
      if (activeQuestion.value?.vocabularyReview?.phase === 'usage')
        assert(
          data.tools[0].arguments.rubricId === vocabularyUseFeedbackBasis(activeQuestion.value, state.value).rubric.id,
          'FORBIDDEN',
          '词句反馈需要当前词义的全部维度与原答引用'
        );
    }
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
    try {
      for (const [index, call] of (data.tools || []).entries()) {
        assert(
          ['progress', 'visualize', 'method', 'hint', 'assess', 'plan'].includes(call.name),
          'FORBIDDEN',
          '模型工具未获授权'
        );
        const outcome = executeLearningTool(learningRepository, { ...call, id: `${id}:tool:${index}` }, context);
        refresh();
        if (call.name === 'visualize')
          visualRequest.value = {
            id: `${id}:tool:${index}`,
            recipe: outcome.result,
            conversationId,
            questionKey: requestedQuestionKey,
            owner: state.value.owner,
            learningContext: writingContext(),
            context: recordContext()
          };
      }
    } catch (e) {
      refresh();
      const saved = state.value.events.filter(
        (event) =>
          event.id.startsWith(`${id}:tool:`) &&
          ['hint.add', 'strategy.set', 'assessment.assist', 'plan.set'].includes(event.type)
      ).length;
      // 只从实际保存的事件说明部分成功，不能显示模型事先声称的整体成功。
      if (saved) e.message = `已保存${saved}项操作，后续操作未完成：${e.message}`;
      throw e;
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
    if (
      data.question &&
      (!requestedQuestionKey || ['variant', 'challenge'].includes(request.lockedMethod || activeStrategy.value.method))
    ) {
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
    } catch (e) {
      if (state.value.owner === owner && selectedConversationId.value === pending.conversationId)
        error.value = e.message || '模型任务未完成';
      throw e;
    } finally {
      if (controller === requestController) {
        busy.value = false;
        controller = null;
        streamPreview.value = '';
      }
    }
  }
  function cancel() {
    visualRequest.value = null;
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
  function cancelModelReads(kind, code = 'CANCELLED') {
    for (const [key, operation] of modelReads) {
      if (kind && key !== kind) continue;
      modelReads.delete(key);
      operation.cancelReason = Object.assign(
        new Error(code === 'CONTEXT_CHANGED' ? '用户已切换或本机记录已更换，未读取旧模型结果' : '模型读取已取消'),
        { code }
      );
      operation.cancel(operation.cancelReason);
      operation.controller.abort();
      const status = key === 'models' ? modelListState : modelUsageState;
      status.value = { phase: 'idle', message: code === 'CANCELLED' ? '已取消读取，可以重新查看。' : '' };
    }
  }
  // 只管列表与用量读取；取消这里的请求不取消或重放任何模型推理。
  function readModelResource(kind) {
    try {
      refresh();
    } catch (failure) {
      resetModelResources();
      throw failure;
    }
    const context = recordContext();
    assert(context, 'CONTEXT_CHANGED', '本机记录上下文不可用，请重新核对');
    const existing = modelReads.get(kind);
    if (existing?.context === context) return existing.promise;
    const status = kind === 'models' ? modelListState : modelUsageState;
    const operation = { context, controller: new AbortController() };
    const cancelled = new Promise((_resolve, reject) => (operation.cancel = reject));
    modelReads.set(kind, operation);
    modelResourceContext = context;
    status.value = { phase: 'loading', message: kind === 'models' ? '正在读取云模型列表…' : '正在读取模型用量…' };
    const validObject = (value) => value && typeof value === 'object' && !Array.isArray(value);
    const nonempty = (value) => typeof value === 'string' && value.trim().length > 0;
    const numbers = (value, keys) =>
      validObject(value) && keys.every((key) => Number.isFinite(value[key]) && value[key] >= 0);
    const validCatalog = (data) =>
      validObject(data) &&
      Array.isArray(data.models) &&
      data.models.every(
        (model) =>
          validObject(model) &&
          ['id', 'provider', 'model'].every((key) => nonempty(model[key])) &&
          validObject(model.capabilities)
      ) &&
      new Set(data.models.map((model) => model.id)).size === data.models.length &&
      (data.presets === undefined ||
        (Array.isArray(data.presets) &&
          data.presets.every(
            (preset) =>
              validObject(preset) && ['id', 'provider', 'model', 'endpoint'].every((key) => nonempty(preset[key]))
          )));
    const validUsage = (data) =>
      data === null ||
      (validObject(data) &&
        numbers(data.entitlement, ['weeklyUnits', 'spent', 'reserved']) &&
        ['week', 'timezone', 'policyVersion'].every((key) => nonempty(data.entitlement[key])) &&
        numbers(data.cost, ['spent', 'reserved', 'pending']) &&
        (!data.byokBudget || numbers(data.byokBudget, ['used', 'limit', 'pendingCosts'])) &&
        (!data.resultCache ||
          (numbers(data.resultCache, ['entries', 'bytes']) &&
            numbers(data.resultCache.policy, ['maxEntries', 'maxBytes', 'ttlMs']))));
    const apply = (result) => {
      if (kind === 'models') {
        models.value = result.success ? result.data.models : [];
        modelPresets.value = result.success ? result.data.presets || [] : [];
      } else usage.value = result.success ? result.data : null;
      status.value = {
        code: result.success ? undefined : result.code,
        phase: !result.success
          ? 'error'
          : kind === 'models'
            ? models.value.length
              ? 'ready'
              : 'empty'
            : usage.value
              ? 'ready'
              : 'empty',
        message: !result.success
          ? typeof result.message === 'string' && result.message.trim()
            ? result.message
            : '读取未完成，请重试。'
          : kind === 'models'
            ? models.value.length
              ? `已读取 ${models.value.length} 个云模型，连接测试需单独发起。`
              : '当前没有可选云模型。可以继续本地学习，或配置自带云端 API。'
            : usage.value
              ? '模型用量已读取。'
              : '当前没有可显示的模型用量。'
      };
      return result;
    };
    operation.promise = (async () => {
      try {
        const request = kind === 'models' ? fetchLearningModels : fetchLearningUsage;
        let result = await Promise.race([
          request({ signal: operation.controller.signal, expectedOwner: getUserId() || undefined }),
          cancelled
        ]);
        refresh();
        assert(recordContext() === context, 'CONTEXT_CHANGED', '用户已切换或本机记录已更换，未读取旧模型结果');
        if (modelReads.get(kind) !== operation) throw operation.cancelReason;
        if (result.success && !(kind === 'models' ? validCatalog(result.data) : validUsage(result.data)))
          result = {
            success: false,
            code: 502,
            message:
              kind === 'models' ? '云模型列表响应不完整，请重试；不会自动选择模型。' : '模型用量响应不完整，请重试。'
          };
        return apply(result);
      } catch (failure) {
        if (modelReads.get(kind) !== operation) throw operation.cancelReason || failure;
        if (recordContext() !== context || failure.code === 'CONTEXT_CHANGED') {
          cancelModelReads(kind, 'CONTEXT_CHANGED');
          throw operation.cancelReason;
        }
        return apply({ success: false, code: 503, message: '读取服务暂不可用，请重试；本机学习记录保留。' });
      } finally {
        if (modelReads.get(kind) === operation) modelReads.delete(kind);
      }
    })();
    return operation.promise;
  }
  async function loadModels() {
    return readModelResource('models');
  }
  async function testModel(id) {
    const owner = refresh().owner;
    const result = await testLearningModel(id, learningId('connection'));
    assert(refresh().owner === owner, 'CONTEXT_CHANGED', '用户已切换，未展示旧用户连接结果');
    await loadModels();
    return result;
  }
  async function loadUsage() {
    return readModelResource('usage');
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
    assert(!materialBusy.value && !materialConnectionBusy.value, 'BUSY', '资料正在处理或检查连接');
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
    materialImportContext = context;
    materialProgress.value = null;
    materialImportState.value = { phase: 'processing' };
    materialController = new AbortController();
    materialRequestContext = context;
    const signal = materialController.signal;
    const checkContext = () => {
      assert(!signal.aborted, 'CANCELLED', '资料处理已取消');
      assert(materialContext() === context, 'CONTEXT_CHANGED', '账户、记录或资料授权已变更，旧资料结果未写入');
    };
    try {
      const result = await parseConnectedMaterial(connection, input, {
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
              m.original?.connectorOrigin === material.original?.connectorOrigin &&
              m.original?.storageId === material.original?.storageId
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
      checkContext();
      const outcomeMaterials = new Map();
      result.results.forEach((material) => {
        const saved = state.value.materials.find(
          (item) =>
            item.fingerprint === material.fingerprint &&
            item.original?.connectorOrigin === material.original?.connectorOrigin &&
            item.original?.storageId === material.original?.storageId
        );
        const current = saved || material;
        outcomeMaterials.set(current.id, current);
      });
      const segments = [...outcomeMaterials.values()].flatMap((material) => material.segments);
      const failedPages = segments.filter((segment) => segment.status === 'failed').length;
      const extractedSegments = segments.filter(
        (segment) => segment.status !== 'failed' && segment.content?.trim()
      ).length;
      materialImportState.value = {
        phase: result.nextPage || failedPages ? 'partial' : 'saved',
        failedPages,
        extractedSegments
      };
      return result;
    } catch (failure) {
      if (materialContext() === context) materialImportState.value = { phase: signal.aborted ? 'cancelled' : 'failed' };
      throw failure;
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
    materialConnectionController?.abort();
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
  function structureObjective(materialId, input) {
    idleRecords();
    assert(active.value && !active.value.stopped, 'PRECONDITION', '请先开始或明确继续学习任务');
    const material = state.value.materials.find((m) => m.id === materialId);
    return addQuestion(
      createMaterialObjectiveQuestion(learningId('material_q'), material, input),
      'independent_correct'
    );
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
    if (original.sentenceExercise) return startSentenceTask(writingContext());
    if (original.scienceExercise) return startScience(writingContext(), original.scienceExercise.input);
    if (original.writingExercise) {
      writingAttempt();
      return addQuestion(
        createWritingQuestion(
          variantId,
          selectedConversationId.value,
          writingGenre(original),
          nextWritingTask(state.value, selectedConversationId.value, writingGenre(original)),
          questionKey(original)
        )
      );
    }
    const materialVariant = createMaterialObjectiveVariant(variantId, original, state.value);
    if (materialVariant) return addQuestion(materialVariant, 'independent_correct');
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
    notice('先练习这个基础步骤。', `${id}:diagnostic`);
    return result;
  }
  function focus(question, conversationId, kind = null) {
    const target = state.value.questions.find((q) => questionKey(q) === question);
    const notice = target?.writingExercise || target?.scienceExercise || target?.vocabularyReview;
    if (notice) {
      assert(!conversationId || conversationId === notice.conversationId, 'FORBIDDEN', '任务属于另一对话');
      conversationId = notice.conversationId;
      if (!kind && notice.phase === 'retest') kind = 'review';
    }
    conversationId ||= selectedConversationId.value;
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
    assert(!materialBusy.value && !materialConnectionBusy.value, 'BUSY', '资料正在处理或检查连接');
    const connection = materialConnection.value;
    const context = materialContext();
    assert(context, 'CONTEXT_CHANGED', '本机记录上下文不可用，未发起检查');
    const snapshot = connection ? JSON.parse(JSON.stringify(connection)) : null;
    const controller = new AbortController();
    materialConnectionController = controller;
    materialConnectionRequestContext = context;
    materialConnectionBusy.value = true;
    if (connection) delete connection.status;
    try {
      const result = await testMaterialConnector(snapshot, {
        platform: learningClientPlatform(),
        signal: controller.signal
      });
      assert(materialContext() === context, 'CONTEXT_CHANGED', '账户、记录或资料授权已变更，未采用旧检查结果');
      assert(!controller.signal.aborted, 'CANCELLED', '资料连接检查已取消，尚未发送资料');
      connection.status = 'connector_verified';
      connection.capabilities = {
        ...result.ocrEngines,
        uploadRecovery: result.uploadRecovery,
        uploadMaintenance: result.uploadMaintenance
      };
      return result;
    } catch (failure) {
      assert(materialContext() === context, 'CONTEXT_CHANGED', '账户、记录或资料授权已变更，未采用旧检查结果');
      throw failure;
    } finally {
      if (materialConnectionController === controller) {
        materialConnectionBusy.value = false;
        materialConnectionController = null;
        materialConnectionRequestContext = null;
      }
    }
  }
  function previewRestore(content) {
    assert(!busy.value && !materialBusy.value && !syncBusy.value, 'BUSY', '请等待当前任务结束后恢复');
    assert(!historyBusy.value, 'BUSY', '历史校验仍在执行，可先取消');
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
    const controller = new AbortController();
    historyController = controller;
    const context = recordContext(),
      revision = state.value.revision;
    historyRequestContext = { context, revision };
    try {
      const result = await prepare({
        signal: controller.signal,
        onProgress: (progress) => {
          if (!controller.signal.aborted && recordContext() === context && state.value.revision === revision)
            historyProgress.value = progress;
        }
      });
      assert(!controller.signal.aborted, 'CANCELLED', '历史校验已取消，当前记录保留');
      assert(
        context && recordContext() === context && state.value.revision === revision,
        'CONTEXT_CHANGED',
        '账户或记录已变化，请重新校验历史'
      );
      return result;
    } finally {
      if (historyController === controller) {
        historyBusy.value = false;
        historyController = null;
        historyRequestContext = null;
        historyProgress.value = null;
      }
    }
  }
  function cancelHistory() {
    historyController?.abort();
    learningRepository.cancelPreview();
  }
  function restoreData(content, preview) {
    assert(!busy.value && !materialBusy.value && !syncBusy.value, 'BUSY', '请等待当前任务结束后恢复');
    assert(preview?.owner === state.value.owner, 'OWNER_MISMATCH', '账户已切换，请重新预览');
    assert(!historyBusy.value, 'BUSY', '请等待历史校验完成');
    const result = preview.history
      ? learningRepository.restoreHistory(content, preview)
      : learningRepository.restoreData(content, preview);
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
  function syncCancelledMessage(kind) {
    return kind === 'delete'
      ? '已取消等待删除结果，本机记录保留；云端是否已删除仍需核对，取消不能撤销已完成的删除。'
      : kind === 'adopt'
        ? '已取消采用云端记录，本机记录保留；请待请求收尾后再重试。'
        : '同步已取消，本机记录保留；已发送批次可能已保存云端，请待请求收尾后再明确重试。';
  }
  async function runSync(action, kind, message) {
    idleRecords();
    learningRepository.prepareAsyncAction();
    const request = {
      controller: new AbortController(),
      context: recordContext(),
      owner: state.value.owner,
      feedback: true,
      kind
    };
    assert(request.context, 'CONTEXT_CHANGED', '本机记录上下文不可用，未发起云端操作');
    syncRequest = request;
    syncController = request.controller;
    syncBusy.value = true;
    syncProgress.value = null;
    syncState.value = {
      phase: 'loading',
      kind,
      context: request.context,
      message:
        kind === 'delete'
          ? '正在请求删除云端学习副本，服务端结果尚未确认；本机记录保留。'
          : kind === 'adopt'
            ? '正在重新读取并核对云端冲突副本，采用前本机记录保留。'
            : '正在同步学习记录，本机记录保留；可取消等待，已发送批次可能已保存云端。'
    };
    let applied = false;
    try {
      const next = await action(request.controller.signal);
      assert(!request.controller.signal.aborted, 'CANCELLED', syncCancelledMessage(kind));
      assert(
        next.owner === request.owner && getUserId() === request.owner,
        'OWNER_MISMATCH',
        '账户已变化，未显示旧操作结果'
      );
      // 同步自身的提交会推进记录生命周期；先结束请求绑定，再更新当前界面。
      request.context = null;
      applied = true;
      syncState.value = { phase: 'success', kind, context: recordContext(), message };
      state.value = next;
      if (!active.value) selectedConversationId.value = state.value.conversations.at(-1)?.id || null;
      uni.$emit('conversationLearningUpdated');
      return state.value;
    } catch (failure) {
      if (request.feedback && syncRequest === request) {
        if (applied) syncState.value.message = `${message}页面更新未完成，请重新打开核对。`;
        else if (recordContext() === request.context)
          syncState.value = {
            phase: request.controller.signal.aborted ? 'cancelled' : 'error',
            kind,
            context: request.context,
            message: request.controller.signal.aborted ? syncCancelledMessage(kind) : failure.message
          };
        else syncState.value = { phase: 'idle', message: '', context: null, kind: null };
      }
      throw failure;
    } finally {
      if (syncRequest === request) {
        syncRequest = null;
        syncBusy.value = false;
        syncController = null;
        syncProgress.value = null;
        try {
          refresh();
        } catch (failure) {
          error.value = failure.message;
          if (applied && request.feedback) syncState.value.message = `${message}本机记录暂不能重读，请重新打开核对。`;
        }
      }
    }
  }
  function syncRecords(consent) {
    return runSync(
      (signal) =>
        synchronizeLearning(learningRepository, consent, undefined, {
          signal,
          onProgress: (progress) => {
            if (!signal.aborted) syncProgress.value = progress;
          }
        }),
      'sync',
      '本次同步完成，已按服务端事实重算；本机后续新增记录可再次同步。'
    );
  }
  function cancelSync({ clearFeedback = false } = {}) {
    if (clearFeedback) {
      if (syncRequest) syncRequest.feedback = false;
      syncState.value = { phase: 'idle', message: '', context: null, kind: null };
    } else if (syncRequest?.context && recordContext() === syncRequest.context)
      syncState.value = {
        phase: 'cancelled',
        kind: syncRequest.kind,
        context: syncRequest.context,
        message: syncCancelledMessage(syncRequest.kind)
      };
    syncController?.abort();
  }
  function deleteCloudRecords(consent) {
    assert(consent, 'CONSENT_REQUIRED', '删除云端学习副本需要明确确认');
    return runSync(
      async (signal) => {
        const owner = learningRepository.read().owner;
        const context = recordContext();
        syncProgress.value = { phase: '删除云端学习副本', calls: 1 };
        const result = await learningRequest('/learning-sync', { action: 'delete' }, { expectedOwner: owner, signal });
        assert(learningRepository.read().owner === owner, 'OWNER_MISMATCH', '账户已切换，未显示旧账户删除结果');
        assert(!signal.aborted, 'CANCELLED', '删除确认已取消；云端是否已删除需重新查询');
        assert(recordContext() === context, 'CONTEXT_CHANGED', '学习记录已变化，未显示旧删除回执；云端结果仍需核对');
        assert(result.success && result.data?.deleted === true, 'DELETE_FAILED', result.message || '云端删除未确认');
        assert(
          result.data.modelResultCacheDeleted === true,
          'DELETE_INCOMPLETE',
          '学习副本已删除，但服务端未确认教学结果缓存清除；请升级后端并重试'
        );
        return learningRepository.read();
      },
      'delete',
      '服务端已确认清除学习副本和教学结果缓存；费用事实与本机记录保留，后续主动同步或模型调用会产生新副本。'
    );
  }
  function adoptCloudRecords(preview, consent) {
    return runSync(
      (signal) =>
        adoptRemoteConflict(learningRepository, preview, consent, undefined, {
          signal,
          onProgress: (progress) => {
            if (!signal.aborted) syncProgress.value = progress;
          }
        }),
      'adopt',
      '已采用云端记录，原本机冲突副本仍保留。'
    );
  }
  function restoreConflictLocal(preview) {
    idleRecords();
    state.value = learningRepository.restoreConflictLocal(preview);
    selectedConversationId.value = state.value.conversations.at(-1)?.id || null;
    refresh();
    syncState.value = {
      phase: 'success',
      kind: 'local',
      context: recordContext(),
      message: '已恢复本机冲突副本，云端未变更。'
    };
    uni.$emit('conversationLearningUpdated');
  }
  function clearSyncConflict(preview) {
    idleRecords();
    assert(preview, 'PRECONDITION', '请先核对当前冲突副本');
    learningRepository.clearSyncConflict(preview);
    syncConflict.value = null;
    syncState.value = {
      phase: 'success',
      kind: 'archive',
      context: recordContext(),
      message: '冲突归档已移除，可重新同步；当前本机与云端记录保留。'
    };
  }
  return {
    state,
    active,
    activeQuestion,
    timeline,
    conversationLocation,
    locateConversation,
    summary,
    todaySummary,
    scopedSummary,
    journey,
    journeySummary,
    journeyContext,
    configureJourney,
    trainingGroup,
    trainingResult,
    batchTrainingActive,
    startTraining,
    submitTraining,
    selectTraining,
    openTrainingFeedback,
    dailyRecap,
    journeyInsights,
    startWeakness,
    weeklyRecap,
    moduleRecap,
    confirmRecap,
    planNextTraining,
    configureReminder,
    reminderQueue,
    reminderReceipt,
    openReminder,
    notificationContext,
    prepareNotificationConsent,
    attachNotifications,
    taskContext,
    teachingProgress,
    visualRequest,
    writingContext,
    startWriting,
    submitSentence,
    recordSentenceHelp,
    startSentenceTask,
    sentenceCanSubmit,
    sentenceRetest,
    scheduleSentenceRetest,
    recordWritingHelp,
    readWritingReference,
    openVocabulary,
    submitVocabulary,
    oatutorContext,
    startOatutor,
    oatutorAction,
    vocabularyTaskFor,
    startVocabularyTask,
    vocabularyCanSubmit,
    recordDiagramHelp,
    recordScienceHelp,
    startScience,
    scienceCanSubmit,
    writingCanSubmit,
    observeCalendar,
    scienceRetest,
    scheduleScienceRetest,
    writingRetest,
    scheduleWritingRetest,
    requestWritingFeedback,
    requestVocabularyFeedback,
    currentPlan,
    selectedConversationId,
    canComputeReference,
    computeReferenceContext,
    requestComputeReference,
    canCheckGrammar,
    requestGrammarHelp,
    activeStrategy,
    canDiagnose,
    diagnosticProgress,
    diagnosePrerequisite,
    busy,
    error,
    models,
    modelListState,
    modelUsageState,
    cancelModelReads,
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
    structureObjective,
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
    materialImportState,
    materialConnectionBusy,
    cancelMaterial,
    syncRecords,
    syncBusy,
    syncState,
    syncProgress,
    syncConflict,
    isSyncConflictCurrent: (preview) => learningRepository.isSyncConflictCurrent(preview),
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
