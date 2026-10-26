import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { reactive, nextTick } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import Control from '@/components/business/learning/muse-model-control.vue';
import Feedback from '@/components/business/learning/muse-model-feedback.vue';
import BaseInput from '@/components/base/base-input/base-input.vue';
import BaseCheckbox from '@/components/base/base-checkbox/base-checkbox.vue';
import { createRequire } from 'node:module';
// Load the inert Node CLI with Node's loader rather than Vite's browser asset transform.
const { assertDevTest, cleanupOptions, requireResult, verifyByokFrontend } = createRequire(import.meta.url)(
  '../../scripts/build/verify-byok-frontend.mjs'
);
const mock = vi.hoisted(() => ({ learning: null }));
vi.mock('@/stores/modules/conversation-learning.js', () => ({ useConversationLearningStore: () => mock.learning }));
let wrapper;
beforeEach(() => {
  setActivePinia(createPinia());
  mock.learning = reactive({
    busy: false,
    intakeBusy: false,
    modelId: 'one',
    sharingAllowed: true,
    needsConnection: false,
    models: [
      { id: 'one', provider: 'A', model: 'model-a', source: 'byok', configured: true, connectionStatus: 'connected' },
      { id: 'two', provider: 'B', model: 'model-b', source: 'byok', configured: true, connectionStatus: 'connected' },
      { id: 'platform', provider: 'Platform', model: 'platform-model', source: 'platform', configured: true }
    ],
    selectModel: vi.fn().mockResolvedValue({ success: true }),
    setSharingAllowed: vi.fn().mockResolvedValue({ success: true }),
    recordContext: () => 'fixture-owner'
  });
});
afterEach(() => wrapper?.unmount());
it('shows the current provider/model and switches only through the saved connection action', async () => {
  wrapper = mount(Control);
  expect(wrapper.text()).toContain('A · model-a');
  expect(wrapper.getComponent(BaseInput).props('options')).toHaveLength(2);
  await wrapper.get('select').setValue('two');
  await flushPromises();
  expect(mock.learning.selectModel).toHaveBeenCalledExactlyOnceWith('two');
  expect(mock.learning.modelId).toBe('one');
});
it('restores the sharing checkbox and persists explicit changes through its Store action', async () => {
  wrapper = mount(Control);
  expect(wrapper.getComponent(BaseCheckbox).props('modelValue')).toBe(true);
  wrapper.getComponent(BaseCheckbox).vm.$emit('update:modelValue', false);
  await flushPromises();
  expect(mock.learning.setSharingAllowed).toHaveBeenCalledExactlyOnceWith(false);
});
it('disables switching while busy and offers a connector entry for an unavailable model', async () => {
  mock.learning.busy = true;
  mock.learning.models[0].connectionStatus = 'failed';
  mock.learning.models[0].lastError = 'MODEL_UNAVAILABLE';
  wrapper = mount(Control);
  expect(wrapper.get('select').attributes('disabled')).toBeDefined();
  expect(wrapper.text()).toContain('型号不存在或已下线');
  mock.learning.busy = false;
  await nextTick();
  await wrapper
    .findAll('button')
    .find((button) => button.text().trim() === 'AI 连接器')
    .trigger('tap');
  expect(wrapper.emitted('connect')).toHaveLength(1);
});
it('does not present unselected models as usable choices', () => {
  mock.learning.models[1].requiresModelSelection = true;
  wrapper = mount(Control);
  expect(
    wrapper
      .getComponent(BaseInput)
      .props('options')
      .map((option) => option.value)
  ).toEqual(['one']);
});
it.each([
  ['NEEDS_CONNECTION', '打开 AI 连接器', 'open_connectors'],
  ['TIMEOUT', '查询原请求', 'query_result'],
  ['COACH_INVALID', '重新评估', 'retry'],
  ['UNSUPPORTED_DISCOVERY', '手填型号', 'manual_model']
])('maps %s into safe text and a working action', async (error, label, type) => {
  wrapper = mount(Feedback, { props: { failure: { error, message: 'untrusted provider response' } } });
  expect(wrapper.text()).not.toContain('untrusted provider response');
  if (error === 'NEEDS_CONNECTION') expect(wrapper.attributes('role')).toBe('status');
  await wrapper.find('button').trigger('tap');
  expect(wrapper.get('button').text().trim()).toBe(label);
  expect(wrapper.emitted('action')[0][0]).toMatchObject({ type });
});
it('shows running, success and failure feedback without exposing raw response text', async () => {
  wrapper = mount(Feedback, { props: { state: { phase: 'running' } } });
  expect(wrapper.text()).toContain('正在处理');
  await wrapper.setProps({ state: { phase: 'succeeded' } });
  expect(wrapper.text()).toContain('已收到结果');
  await wrapper.setProps({ state: { phase: 'failed', errorCode: 'KEY_INVALID' } });
  expect(wrapper.text()).toContain('密钥无效');
});

describe('BYOK verification script with an in-memory transport only', () => {
  const env = {
    NODE_ENV: 'test',
    YOZI_BUILD_CHANNEL: 'test',
    HOST: '127.0.0.1',
    DB_NAME: 'yozi_dev_test',
    MONGODB_URI: 'mongodb://127.0.0.1:27017/yozi_dev_test',
    PORT: '4382'
  };
  const credentials = { userId: 'fixture-user', token: 'private-unit-test-token' };
  const missing = { code: 404, success: false, error: 'ACCOUNT_NOT_FOUND' };
  const emptyUsage = { code: 0, success: true, data: { calls: [] } };
  const deleted = { code: 0, success: true, data: { deleted: true, billingRetained: true } };
  const cleanupArgs = ['--cleanup-orphans'];
  const oneOrphan = [...cleanupArgs, '--orphan-ms-start', '1793033351001', '--orphan-ms-end', '1793033351001'];

  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => {
        throw new Error('REAL_NETWORK_FORBIDDEN_IN_UNIT_TEST');
      })
    );
  });
  afterEach(() => {
    expect(globalThis.fetch).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  function transport(handler) {
    return vi.fn(async (url, options) => {
      const path = new URL(url).pathname.slice(1);
      const body = options.body ? JSON.parse(options.body) : undefined;
      const result = handler(path, body, options);
      if (result instanceof Error) throw result;
      if (result?.invalidJson)
        return {
          ok: true,
          status: 200,
          json: async () => {
            throw new SyntaxError();
          }
        };
      if (result === undefined) throw Object.assign(new Error(), { code: 'UNEXPECTED_STUB_REQUEST' });
      return {
        ok: result.code === undefined || result.code < 400,
        status: result.code >= 400 ? result.code : 200,
        json: async () => result
      };
    });
  }
  const run = (fetchImpl, args = []) => verifyByokFrontend({ env, args, fetchImpl });
  const requests = (fetchImpl, path) =>
    fetchImpl.mock.calls
      .filter(([url]) => new URL(url).pathname === `/${path}`)
      .map(([, options]) => ({ ...options, body: options.body ? JSON.parse(options.body) : undefined }));
  function registrationTransport(overrides = {}) {
    return transport((path, body, options) => {
      if (overrides[path]) return overrides[path](body, options);
      if (path === 'health') return { status: 'ok' };
      if (path === 'login') return body.email.startsWith('codex.byok.') ? { code: 0, data: credentials } : missing;
      if (path === 'learning-models')
        return body.action === 'usage' ? emptyUsage : { code: 0, success: true, data: { needsConnection: false } };
      if (path === 'account-delete') return deleted;
    });
  }

  // Fixtures checked against login.ts; learning-models.ts (including model-discovery.ts),
  // proxy-ai.ts, learning-sync.ts, learning-compute.ts and account-delete.ts.
  it.each([
    ['login', { code: 0, data: credentials }],
    ['learning-models:list', { code: 0, success: true, data: { models: [], needsConnection: true } }],
    ['learning-models:discover', { code: 0, success: true, data: { models: [] } }],
    ['learning-models:preferences', { code: 0, success: true, data: { selectedModelId: 'fixture' } }],
    ['learning-models:save', { code: 0, success: true, data: { id: 'fixture', keySaved: true } }],
    ['learning-models:delete', { code: 0, success: true, data: { removed: true } }],
    ['learning-models:usage', emptyUsage],
    ['learning-models:test', { code: 0, success: true, data: { requestId: 'fixture-request' } }],
    ['learning-models:result', { code: 0, success: true, data: { requestId: 'fixture-request' }, reused: true }],
    ['proxy-ai', { code: 0, success: true, data: { requestId: 'fixture-request', requestBinding: 'fixture-binding' } }],
    ['learning-sync:push', { code: 0, success: true, data: { revision: 1 } }],
    ['learning-compute', { code: 0, success: true, data: { gradingAuthority: false, persisted: false } }],
    ['account-delete:request', deleted],
    ['success-only envelope', { success: true, data: { value: 'fixture' } }]
  ])('accepts the verified success envelope for %s without changing its data', (endpoint, result) => {
    expect(requireResult(result, endpoint)).toBe(result.data);
  });

  it.each([
    [{ code: 503, success: false, errorCode: 'DISCOVERY_DISABLED' }, 'DISCOVERY_DISABLED(code=503)'],
    [{ code: 429, success: false }, '429(code=429)'],
    [{ code: 0, success: false }, 'SUCCESS_FALSE(code=0)'],
    [{ code: 503, success: true }, '503(code=503)'],
    [{ code: '0' }, '0(code=0)'],
    [{}, 'INVALID_RESPONSE'],
    [null, 'INVALID_RESPONSE']
  ])('rejects unsuccessful or conflicting envelopes with endpoint and code: %j', (result, reason) => {
    expect(() => requireResult(result, 'learning-models:discover')).toThrow(
      `QA_STEP_FAILED:learning-models:discover:${reason}`
    );
    try {
      requireResult(result, 'learning-models:discover');
    } catch (error) {
      expect(error.code).toBe('QA_STEP_FAILED');
      expect(error.code).not.toBe('ERR_ASSERTION');
    }
  });
  it('never includes raw provider text or secrets in a failure reason', () => {
    expect(() => requireResult({ success: false, code: 503, error: 'Bearer secret-provider-key' }, 'proxy-ai')).toThrow(
      'QA_STEP_FAILED:proxy-ai:INVALID_RESPONSE(code=503)'
    );
  });

  it.each([
    ['NODE_ENV', 'production'],
    ['YOZI_BUILD_CHANNEL', 'release'],
    ['HOST', '0.0.0.0'],
    ['DB_NAME', 'yozi'],
    ['MONGODB_URI', 'mongodb://remote.example/yozi_dev_test'],
    ['MONGODB_URI', 'mongodb://127.0.0.1/yozi'],
    ['PORT', '4383']
  ])('refuses non-isolated %s before any request', async (key, value) => {
    const fetchImpl = vi.fn();
    await expect(verifyByokFrontend({ env: { ...env, [key]: value }, args: cleanupArgs, fetchImpl })).rejects.toThrow(
      'DEV_TEST_ONLY'
    );
    expect(fetchImpl).not.toHaveBeenCalled();
  });
  it('accepts the explicitly isolated dev environment too', () => {
    expect(() => assertDevTest({ ...env, NODE_ENV: 'development', YOZI_BUILD_CHANNEL: 'dev' })).not.toThrow();
  });
  it.each([
    ['--orphan-ms-start', '1793033351000'],
    [...cleanupArgs, '--orphan-ms-start', '1793033350999'],
    [...cleanupArgs, '--orphan-ms-end', '1793033351413'],
    [...cleanupArgs, '--orphan-ms-start', '1793033351002', '--orphan-ms-end', '1793033351001'],
    [...cleanupArgs, '--orphan-ms-start', '1793033351000.5'],
    [...cleanupArgs, '--orphan-ms-start', 'not-a-number'],
    ['--unknown-cleanup']
  ])('refuses out-of-scope or incomplete cleanup arguments before network: %j', async (...args) => {
    const fetchImpl = vi.fn();
    await expect(verifyByokFrontend({ env, args, fetchImpl })).rejects.toThrow();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('accepts code-zero login and cleans up when a later response validation fails', async () => {
    const fetchImpl = registrationTransport();
    const report = await run(fetchImpl);
    expect(report.registration).toBe('confirmed');
    expect(report.steps.register).toMatchObject({
      status: 'failed',
      reason: 'QA_STEP_FAILED:learning-models:list:EXPECTED_EMPTY_CONNECTIONS'
    });
    expect(report.blocked).toEqual([]);
    expect(report.cleanupAttempted).toBe(true);
    expect(report.steps.delete_new_account).toMatchObject({ status: 'passed', billingRetained: true });
    expect(requests(fetchImpl, 'account-delete')).toHaveLength(1);
    expect(requests(fetchImpl, 'account-delete')[0].headers.Authorization).toBe(`Bearer ${credentials.token}`);
    expect(JSON.stringify(report)).not.toContain(credentials.token);
    expect(JSON.stringify(report)).not.toContain(requests(fetchImpl, 'login')[0].body.password);
  });
  it('retains a returned cleanup token even when the login envelope indicates failure', async () => {
    const fetchImpl = registrationTransport({
      login: (body) =>
        body.existingAccountOnly
          ? missing
          : { code: 503, success: false, error: 'SESSION_WRITE_FAILED', data: credentials }
    });
    const report = await run(fetchImpl);
    expect(report.steps.register.reason).toBe('QA_STEP_FAILED:login:SESSION_WRITE_FAILED(code=503)');
    expect(report.registration).toBe('possibly_created');
    expect(report.steps.delete_new_account.status).toBe('passed');
    expect(report.blocked).toEqual([]);
  });
  it.each(['invalid-data', 'invalid-json', 'timeout', 'server-error'])(
    'recovers a possibly-created account through existing-only login after %s',
    async (failure) => {
      const fetchImpl = registrationTransport({
        login: (body) => {
          if (!body.email.startsWith('codex.byok.')) return missing;
          if (body.existingAccountOnly) return { code: 0, data: credentials };
          return {
            'invalid-data': { code: 0, data: { userId: credentials.userId } },
            'invalid-json': { invalidJson: true },
            timeout: Object.assign(new Error(), { code: 'ETIMEDOUT' }),
            'server-error': { code: 500, success: false, error: 'LOGIN_FAILED' }
          }[failure];
        }
      });
      const report = await run(fetchImpl);
      const logins = requests(fetchImpl, 'login').filter((entry) => entry.body.email.startsWith('codex.byok.'));
      expect(logins).toHaveLength(2);
      expect(logins[0].body.existingAccountOnly).toBeUndefined();
      expect(logins[1].body).toMatchObject({
        email: logins[0].body.email,
        existingAccountOnly: true,
        verifyCode: '000000'
      });
      expect(logins[1].body.password).toBeUndefined();
      expect(report.cleanupAttempted).toBe(true);
      expect(report.steps.delete_new_account.status).toBe('passed');
      expect(report.steps.register.status).toBe('failed');
      if (failure === 'timeout')
        expect(report.blocked).toMatchObject([{ step: 'local_QA_access', endpoint: 'login', reason: 'ETIMEDOUT' }]);
      else {
        expect(report.blocked).toEqual([]);
        expect(report.steps.register.reason).toMatch(/^QA_STEP_FAILED:login:/);
      }
    }
  );
  it('confirms absence without ever registering again after a failed login', async () => {
    const fetchImpl = registrationTransport({
      login: (body) => (body.existingAccountOnly ? missing : { code: 400, success: false, error: 'INPUT_INVALID' })
    });
    const report = await run(fetchImpl);
    expect(report.steps.delete_new_account).toEqual({ status: 'passed', absent: true });
    expect(requests(fetchImpl, 'account-delete')).toHaveLength(0);
    expect(report.steps.register.reason).toBe('QA_STEP_FAILED:login:INPUT_INVALID(code=400)');
    expect(report.blocked).toEqual([]);
  });
  it('records an actual health transport refusal without attempting login or cleanup', async () => {
    const fetchImpl = transport(() => Object.assign(new Error(), { code: 'EPERM' }));
    const report = await run(fetchImpl);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(report.steps.register).toEqual({ status: 'unverified', reason: 'EPERM' });
    expect(report.blocked).toEqual([{ step: 'local_QA_access', endpoint: 'health', reason: 'EPERM' }]);
    expect(report.cleanupAttempted).toBeUndefined();
  });
  it('retains accounts with reserved calls and records unknown costs as unknown', async () => {
    const fetchImpl = registrationTransport({
      'learning-models': (body) =>
        body.action === 'usage'
          ? { code: 0, success: true, data: { calls: [{ source: 'byok', status: 'reserved', actualCost: null }] } }
          : { code: 0, data: { needsConnection: false } }
    });
    const report = await run(fetchImpl);
    expect(report.steps.delete_new_account).toMatchObject({
      status: 'unverified',
      reason: 'REQUEST_PENDING; account retained'
    });
    expect(requests(fetchImpl, 'account-delete')).toHaveLength(0);
    expect(report).toMatchObject({ actualCost: null, pendingCosts: 1 });
  });
  it('does not delete or claim zero costs when usage cannot be confirmed', async () => {
    const fetchImpl = registrationTransport({
      'learning-models': () => ({ code: 503, success: false, error: 'USAGE_UNAVAILABLE' })
    });
    const report = await run(fetchImpl);
    expect(report.steps.delete_new_account.reason).toBe(
      'QA_STEP_FAILED:learning-models:usage:USAGE_UNAVAILABLE(code=503)'
    );
    expect(report).toMatchObject({ calls: null, actualCost: null, pendingCosts: null });
    expect(requests(fetchImpl, 'account-delete')).toHaveLength(0);
  });
  it.each([
    [{ code: 0, data: { deleted: false, billingRetained: true } }, 'TEST_ACCOUNT_DELETE_NOT_CONFIRMED'],
    [{ code: 0, data: { deleted: true, billingRetained: false } }, 'BILLING_RETENTION_NOT_CONFIRMED'],
    [{ code: 503, success: false, error: 'PURGE_FAILED' }, 'PURGE_FAILED(code=503)']
  ])('reports unconfirmed deletion with the precise interface and error code', async (response, reason) => {
    const fetchImpl = registrationTransport({ 'account-delete': () => response });
    const report = await run(fetchImpl);
    expect(report.steps.delete_new_account).toMatchObject({
      status: 'unverified',
      reason: `QA_STEP_FAILED:account-delete:request:${reason}`
    });
    expect(report.calls).toBe(0);
    expect(requests(fetchImpl, 'account-delete')).toHaveLength(1);
  });

  it('cleans the inclusive authorized orphan window only, using existing-only login and retained billing', async () => {
    const survivors = new Set(['codex.byok.1793033351001@example.test']);
    const fetchImpl = transport((path, body) => {
      if (path === 'health') return { status: 'ok' };
      if (path === 'login') return survivors.has(body.email) ? { code: 0, data: credentials } : missing;
      if (path === 'learning-models' && body.action === 'usage') return emptyUsage;
      if (path === 'account-delete') {
        survivors.clear();
        return deleted;
      }
    });
    expect(cleanupOptions(cleanupArgs)).toEqual({ start: 1793033351000, end: 1793033351412 });
    const report = await run(fetchImpl, cleanupArgs);
    expect(report.steps).toEqual({ cleanup_orphans: { status: 'passed', checked: 413, deleted: 1, absent: 412 } });
    const logins = requests(fetchImpl, 'login');
    expect(logins).toHaveLength(413);
    expect(logins[0].body.email).toBe('codex.byok.1793033351000@example.test');
    expect(logins.at(-1).body.email).toBe('codex.byok.1793033351412@example.test');
    for (const { body } of logins) {
      expect(body).toMatchObject({ existingAccountOnly: true, verifyCode: '000000' });
      expect(body.password).toBeUndefined();
    }
    expect(report.orphanCleanup[1]).toMatchObject({
      status: 'passed',
      billingRetained: true,
      receipt: { calls: 0, actualCost: 0, pendingCosts: 0 }
    });
    expect([...new Set(fetchImpl.mock.calls.map(([url]) => new URL(url).pathname))]).toEqual([
      '/health',
      '/login',
      '/learning-models',
      '/account-delete'
    ]);
    expect(JSON.stringify(report)).not.toContain(credentials.token);
    const repeated = await run(fetchImpl, oneOrphan);
    expect(repeated.steps.cleanup_orphans).toMatchObject({ status: 'passed', deleted: 0, absent: 1 });
    expect(requests(fetchImpl, 'account-delete')).toHaveLength(1);
  });
  it('keeps an orphan with in-flight requests and never runs seed or inference', async () => {
    const fetchImpl = transport((path, body) => {
      if (path === 'health') return { status: 'ok' };
      if (path === 'login') return { code: 0, data: credentials };
      if (path === 'learning-models' && body.action === 'usage')
        return { code: 0, data: { calls: [{ status: 'reserved', actualCost: null }] } };
    });
    const report = await run(fetchImpl, oneOrphan);
    expect(report.steps.cleanup_orphans.status).toBe('unverified');
    expect(report.orphanCleanup[0]).toMatchObject({
      status: 'unverified',
      reason: 'REQUEST_PENDING; account retained'
    });
    expect(requests(fetchImpl, 'account-delete')).toHaveLength(0);
  });
  it('stops orphan cleanup on an API error and identifies the exact failed account and step', async () => {
    const fetchImpl = transport((path) =>
      path === 'health' ? { status: 'ok' } : { code: 503, success: false, error: 'LOGIN_FAILED' }
    );
    const report = await run(fetchImpl, cleanupArgs);
    expect(report.steps.cleanup_orphans).toEqual({
      status: 'unverified',
      reason: 'QA_STEP_FAILED:login:LOGIN_FAILED(code=503)'
    });
    expect(report.orphanCleanup).toEqual([
      {
        syntheticAccount: 'codex.byok.1793033351000@example.test',
        status: 'unverified',
        reason: 'QA_STEP_FAILED:login:LOGIN_FAILED(code=503)'
      }
    ]);
    expect(report.blocked).toEqual([]);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});
