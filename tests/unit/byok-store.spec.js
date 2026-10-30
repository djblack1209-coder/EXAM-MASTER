import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { storageService } from '@/services/storageService.js';
import { useConversationLearningStore } from '@/stores/modules/conversation-learning.js';
import { captureSession } from '@/services/auth-storage.js';
import { coachFixture } from '../fixtures/writing-coach.js';
import { explicitIntakeFacts } from '../../laf-backend/functions/_shared/learning-intake.js';
import {
  fetchLearningModels,
  saveLearningModelPreferences,
  generateLearningTurn,
  fetchLearningResult
} from '@/services/api/domains/learning.api.js';
vi.mock('@/services/api/domains/learning.api.js', async (original) => ({
  ...(await original()),
  fetchLearningModels: vi.fn(),
  saveLearningModelPreferences: vi.fn(),
  generateLearningTurn: vi.fn(),
  fetchLearningResult: vi.fn()
}));
const connection = (id) => ({
  id,
  provider: 'fixture',
  model: id,
  source: 'byok',
  configured: true,
  capabilities: { structured: true },
  connectionStatus: 'connected'
});
let store;
const login = (userId) => storageService.saveLoginSession({ userId, token: `fixture-${userId}` });
const catalog = (models = [], preferences = { selectedModelId: null, sharingAllowed: false }) => ({
  success: true,
  data: { models, preferences, presets: [], platformEnabled: false }
});
beforeEach(async () => {
  uni.clearStorageSync();
  await login('byok-owner');
  setActivePinia(createPinia());
  vi.mocked(saveLearningModelPreferences).mockReset().mockResolvedValue({ success: true });
  vi.mocked(fetchLearningModels).mockReset().mockResolvedValue(catalog());
  vi.mocked(generateLearningTurn).mockReset();
  vi.mocked(fetchLearningResult).mockReset();
  store = useConversationLearningStore();
});
afterEach(() => {
  store?.$dispose();
  vi.restoreAllMocks();
});
it('new accounts expose the connector action and reject sending without any model call', async () => {
  await store.loadModels();
  expect(store.needsConnection).toBe(true);
  expect(store.connectionGuide.action).toMatchObject({ type: 'open_connectors', panel: 'connectors' });
  await expect(store.send('我要学考研英语二')).rejects.toMatchObject({ code: 'NEEDS_CONNECTION' });
  expect(generateLearningTurn).not.toHaveBeenCalled();
});
it('server selection and consent restore on reopen, remain explicit on failure, and edits save for that owner', async () => {
  vi.mocked(fetchLearningModels).mockResolvedValue(
    catalog([connection('first'), { ...connection('second'), connectionStatus: 'failed' }], {
      selectedModelId: 'second',
      sharingAllowed: true
    })
  );
  await store.loadModels();
  expect(store.modelId).toBe('second');
  expect(store.sharingAllowed).toBe(true);
  store.$dispose();
  setActivePinia(createPinia());
  store = useConversationLearningStore();
  expect(store.sharingAllowed).toBe(true);
  await store.loadModels();
  expect(store.modelId).toBe('second');
  await store.selectModel('first');
  await store.setSharingAllowed(false);
  expect(saveLearningModelPreferences).toHaveBeenLastCalledWith(
    { selectedModelId: 'first', sharingAllowed: false },
    expect.objectContaining({ expectedOwner: 'byok-owner' })
  );
});
it('account switches clear the current view, models and consent while retaining guest and account records', async () => {
  store.start('Account private math');
  vi.mocked(fetchLearningModels).mockResolvedValue(
    catalog([connection('first')], { selectedModelId: 'first', sharingAllowed: true })
  );
  await store.loadModels();
  await login('different-owner');
  store.refresh();
  expect(store.state.owner).toBe('different-owner');
  expect(store.state.conversations).toHaveLength(0);
  expect(store.models).toEqual([]);
  expect(store.sharingAllowed).toBe(false);
  await login('byok-owner');
  store.refresh();
  expect(store.state.conversations[0].goal).toBe('Account private math');
  storageService._clearRevokedCredentials(captureSession());
  store.refresh();
  store.start('Guest private math');
  const guestRecord = JSON.stringify(store.state);
  await login('fresh-student');
  store.refresh();
  expect(store.state.conversations).toHaveLength(0);
  storageService._clearRevokedCredentials(captureSession());
  store.refresh();
  expect(store.state.conversations).toHaveLength(0);
  expect(
    uni.getStorageInfoSync().keys.some((key) => JSON.stringify(uni.getStorageSync(key)).includes('Guest private math'))
  ).toBe(true);
  expect(guestRecord).toContain('Guest private math');
});
async function prepareCoach() {
  vi.mocked(fetchLearningModels).mockResolvedValue(
    catalog([connection('first')], { selectedModelId: 'first', sharingAllowed: true })
  );
  await store.loadModels();
  store.startCoach('考研英语二，每天25分钟，2027-12-20考试');
  store.coachSave('profile', { profile: { exam: 'english2', minutes: 25, deadline: '2027-12-20' } });
}
it('terminal validation failures close the intent and make a manual retry observable', async () => {
  await prepareCoach();
  vi.mocked(generateLearningTurn).mockResolvedValueOnce({
    success: false,
    status: 'failed',
    error: 'COACH_INVALID',
    repairExhausted: true
  });
  await store.requestCoach('diagnostic');
  expect(store.active.coach.requests[0].status).toBe('closed');
  expect(store.retryState).toMatchObject({ phase: 'failed', errorCode: 'COACH_INVALID' });
  let finish;
  vi.mocked(generateLearningTurn).mockImplementationOnce(
    (body) =>
      new Promise((resolve) => {
        finish = () =>
          resolve({
            success: true,
            data: {
              requestId: body.requestId,
              requestBinding: body.requestBinding,
              modelId: body.modelId,
              coach: coachFixture(body.learningContext.coach)
            }
          });
      })
  );
  const retry = store.requestCoach('diagnostic');
  await vi.waitFor(() => expect(finish).toBeTypeOf('function'));
  expect(store.retryState.phase).toBe('running');
  finish();
  await retry;
  expect(store.retryState.phase).toBe('succeeded');
});
it('recovering an interrupted coach request does not require sharing consent or resend it', async () => {
  await prepareCoach();
  vi.mocked(generateLearningTurn).mockResolvedValueOnce({ success: false, error: 'TIMEOUT' });
  await store.requestCoach('diagnostic');
  const pending = store.active.coach.requests[0];
  await store.setSharingAllowed(false);
  vi.mocked(fetchLearningResult).mockResolvedValueOnce({
    success: true,
    data: {
      requestId: pending.id,
      requestBinding: pending.binding,
      modelId: pending.modelId,
      coach: coachFixture(pending.request)
    }
  });
  await store.requestCoach('diagnostic');
  expect(fetchLearningResult).toHaveBeenCalledOnce();
  expect(generateLearningTurn).toHaveBeenCalledOnce();
});
it('literal goal facts produce a draft and do not guess ambiguous choices or dates', () => {
  expect(explicitIntakeFacts('考研英语二，每天25分钟，2027-12-20考试')).toEqual({
    exam: 'english2',
    minutes: 25,
    deadline: '2027-12-20'
  });
  expect(explicitIntakeFacts('英语一还是英语二，每天20分钟或者30分钟，明年考试')).toEqual({});
});

it('混合摸底拒收后保留五项原答、关闭失败意图并允许下一步重试，不展示半截反馈', async () => {
  await prepareCoach();
  vi.mocked(generateLearningTurn).mockImplementationOnce(async (body) => ({
    success: true,
    data: {
      requestId: body.requestId,
      requestBinding: body.requestBinding,
      modelId: body.modelId,
      coach: coachFixture(body.learningContext.coach)
    }
  }));
  await store.requestCoach('diagnostic');
  for (const [index, card] of store.active.coach.diagnostic.cards.entries())
    store.coachSave('answer', { target: 'diagnostic', cardId: card.id, answer: `Synthetic answer ${index}` });
  const answers = structuredClone(
    store.active.coach.diagnostic.answers.map(({ cardId, answer }) => ({ cardId, answer }))
  );
  vi.mocked(generateLearningTurn).mockResolvedValueOnce({
    success: false,
    status: 'failed',
    error: 'COACH_INVALID',
    repairExhausted: true,
    message: '模型回复未通过教学校验，未计入学习成果；原答已保留，请手动重试。'
  });
  await store.requestCoach('feedback', 'diagnostic');
  expect(store.active.coach.diagnostic.feedback).toBeFalsy();
  expect(store.active.coach.diagnostic.answers.map(({ cardId, answer }) => ({ cardId, answer }))).toEqual(answers);
  expect(store.active.coach.requests.at(-1).status).toBe('closed');
  expect(store.retryState).toMatchObject({ phase: 'failed', errorCode: 'COACH_INVALID' });
  expect(store.coachError).toContain('原答已保留');
  vi.mocked(generateLearningTurn).mockImplementationOnce(async (body) => ({
    success: true,
    data: {
      requestId: body.requestId,
      requestBinding: body.requestBinding,
      modelId: body.modelId,
      coach: coachFixture(body.learningContext.coach)
    }
  }));
  await store.requestCoach('feedback', 'diagnostic');
  expect(store.retryState.phase).toBe('succeeded');
  expect(store.active.coach.diagnostic.feedback).toBeTruthy();
  expect(store.active.coach.diagnostic.answers.map(({ cardId, answer }) => ({ cardId, answer }))).toEqual(answers);
});
