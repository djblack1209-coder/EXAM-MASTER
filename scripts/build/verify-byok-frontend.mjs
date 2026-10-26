#!/usr/bin/env node
import crypto from 'node:crypto';
import { mkdtempSync, writeFileSync, unlinkSync, rmdirSync, lstatSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFile } from 'node:child_process';
import { parseArgs } from 'node:util';

// Never start/restart a service, connect directly to Mongo, or use production credentials.
const root = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const orphanWindow = { start: 1793033351000, end: 1793033351412 };

export function assertDevTest(env) {
  // Matches functions/_shared/build-channel.ts, with the QA port additionally pinned.
  if (
    !['dev', 'test'].includes(env.YOZI_BUILD_CHANNEL) ||
    !['development', 'test'].includes(env.NODE_ENV) ||
    env.HOST !== '127.0.0.1' ||
    env.DB_NAME !== 'yozi_dev_test' ||
    !/^mongodb:\/\/127\.0\.0\.1(?::\d+)?\/yozi_dev_test$/.test(env.MONGODB_URI || '') ||
    env.PORT !== '4382'
  )
    throw Object.assign(new Error('DEV_TEST_ONLY'), { code: 'DEV_TEST_ONLY' });
}

export function cleanupOptions(args) {
  const { values } = parseArgs({
    args,
    options: {
      'cleanup-orphans': { type: 'boolean' },
      'cleanup-account-file': { type: 'string' },
      'orphan-ms-start': { type: 'string' },
      'orphan-ms-end': { type: 'string' }
    },
    allowPositionals: false,
    strict: true
  });
  if (values['cleanup-account-file'] !== undefined) {
    if (
      !values['cleanup-account-file'] ||
      values['cleanup-orphans'] ||
      values['orphan-ms-start'] !== undefined ||
      values['orphan-ms-end'] !== undefined
    )
      throw Object.assign(new Error('CLEANUP_MODES_CONFLICT'), { code: 'CLEANUP_MODES_CONFLICT' });
    return { accountFile: resolve(values['cleanup-account-file']) };
  }
  if (!values['cleanup-orphans']) {
    if (values['orphan-ms-start'] !== undefined || values['orphan-ms-end'] !== undefined)
      throw Object.assign(new Error('ORPHAN_CLEANUP_FLAG_REQUIRED'), { code: 'ORPHAN_CLEANUP_FLAG_REQUIRED' });
    return null;
  }
  const start = Number(values['orphan-ms-start'] ?? orphanWindow.start);
  const end = Number(values['orphan-ms-end'] ?? orphanWindow.end);
  if (
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(end) ||
    start < orphanWindow.start ||
    end > orphanWindow.end ||
    start > end
  )
    throw Object.assign(new Error('ORPHAN_WINDOW_OUT_OF_SCOPE'), { code: 'ORPHAN_WINDOW_OUT_OF_SCOPE' });
  return { start, end };
}

export function readPrivateAccount(file) {
  if (!file) throw Object.assign(new Error(), { code: 'PRIVATE_ACCOUNT_FILE_REQUIRED' });
  const info = lstatSync(file);
  if (!info.isFile() || info.isSymbolicLink() || info.size > 16384 || (info.mode & 0o077) !== 0)
    throw Object.assign(new Error(), { code: 'PRIVATE_ACCOUNT_FILE_REQUIRED' });
  let account;
  try {
    account = JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    throw Object.assign(new Error(), { code: 'INVALID_ACCOUNT_FILE' });
  }
  if (!account || typeof account !== 'object' || Array.isArray(account))
    throw Object.assign(new Error(), { code: 'INVALID_ACCOUNT_FILE' });
  return account;
}

const safeCode = (value) =>
  typeof value === 'number' && Number.isFinite(value)
    ? String(value)
    : typeof value === 'string' && /^[A-Z0-9_:-]{1,80}$/.test(value)
      ? value
      : 'INVALID_RESPONSE';
function stepFailure(endpoint, code, responseCode) {
  const message = `QA_STEP_FAILED:${endpoint}:${safeCode(code)}${responseCode === undefined ? '' : `(code=${safeCode(responseCode)})`}`;
  return Object.assign(new Error(message), { code: 'QA_STEP_FAILED', endpoint, qaCode: safeCode(code) });
}
function check(condition, endpoint, code) {
  if (!condition) throw stepFailure(endpoint, code);
}
export function successfulResult(result) {
  return Boolean(
    result &&
    result.success !== false &&
    (result.code === undefined || result.code === 0) &&
    (result.success === true || result.code === 0)
  );
}
export function requireResult(result, endpoint) {
  if (!successfulResult(result))
    throw stepFailure(
      endpoint,
      result?.errorCode ||
        result?.error ||
        (result?.success === false && result?.code === 0 ? 'SUCCESS_FALSE' : result?.code),
      result?.code
    );
  return result.data;
}
const failureReason = (error) =>
  error.code === 'QA_STEP_FAILED' ? error.message : safeCode(error.cause?.code || error.code || 'UNEXPECTED_FAILURE');
function loginData(result) {
  const data = requireResult(result, 'login');
  check(
    typeof data?.token === 'string' && Boolean(data.token) && typeof data.userId === 'string' && Boolean(data.userId),
    'login',
    'INVALID_LOGIN_DATA'
  );
  return data;
}

// Importing this module is inert. Unit tests inject an in-memory transport; only the CLI writes a report.
export async function runSeedProcess(accountFile, env) {
  return new Promise((accept, reject) =>
    execFile(
      process.execPath,
      [resolve(root, 'scripts/build/seed-dev-test-models.mjs'), '--account-file', accountFile],
      { cwd: root, env, maxBuffer: 65536 },
      (_error, stdout) => {
        try {
          accept(JSON.parse(String(stdout).trim()));
        } catch {
          reject(
            Object.assign(new Error('SEED_FAILED; query original receipts before retrying'), { code: 'SEED_FAILED' })
          );
        }
      }
    )
  );
}

export async function verifyByokFrontend({
  env = process.env,
  args = [],
  fetchImpl = globalThis.fetch,
  readAccount = readPrivateAccount,
  seedModels = runSeedProcess
} = {}) {
  assertDevTest(env);
  const cleanupRange = cleanupOptions(args);
  const steps = Object.fromEntries(
    [
      'register',
      'two_connections',
      'discovery_and_switch',
      'intake',
      'diagnostic',
      'daily',
      'writing',
      'summary',
      'relogin_restore',
      'invalid_key',
      'delete_new_account',
      'delete_deepseek_account',
      'delete_claude_account'
    ].map((name) => [name, { status: 'unverified' }])
  );
  const report = { steps, calls: 0, actualCost: 0, pendingCosts: 0, blocked: [], serviceRestarted: false };
  let token,
    cleanupToken,
    userId,
    accountFile,
    privateDirectory,
    stage = 'register',
    accountMayExist = false,
    usageRecorded = false;
  const email = `codex.byok.${Date.now()}@example.test`,
    password = `Byok!${crypto.randomBytes(18).toString('hex')}`;
  async function request(path, body, credentials = token) {
    const endpoint = body?.action ? `${path}:${body.action}` : path;
    let response;
    try {
      response = await fetchImpl(`http://127.0.0.1:4382/${path}`, {
        method: path === 'health' ? 'GET' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(credentials ? { Authorization: `Bearer ${credentials}` } : {})
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: AbortSignal.timeout(path === 'health' ? 3000 : 150000)
      });
    } catch (error) {
      throw Object.assign(
        new Error('Local QA request could not complete; no alternate transport or replay was attempted'),
        {
          code: error.cause?.code || error.code || 'NETWORK_UNAVAILABLE',
          uncertain: path !== 'health',
          transport: true,
          endpoint
        }
      );
    }
    let result;
    try {
      result = await response.json();
    } catch {
      throw stepFailure(endpoint, 'INVALID_JSON', response.status);
    }
    if (response.ok === false && !(result?.success !== true && typeof result?.code === 'number' && result.code !== 0))
      throw stepFailure(endpoint, result?.errorCode || result?.error || 'HTTP_FAILED', result?.code ?? response.status);
    return result;
  }
  async function models(body, credentials = token) {
    return requireResult(await request('learning-models', body, credentials), `learning-models:${body.action}`);
  }
  async function usage(credentials = token) {
    return models({ action: 'usage' }, credentials);
  }
  function recordUsage(data) {
    check(Array.isArray(data?.calls), 'learning-models:usage', 'INVALID_USAGE_DATA');
    report.calls = data.calls.filter((call) => call.source === 'byok' && call.executionStage !== 'not_called').length;
    report.pendingCosts = data.calls.filter((call) => call.actualCost === null).length;
    report.actualCost = report.pendingCosts
      ? null
      : data.calls.reduce((total, call) => total + (call.actualCost || 0), 0);
    usageRecorded = true;
  }
  async function deleteIdle(credentials, current = undefined) {
    current ??= await usage(credentials);
    check(Array.isArray(current?.calls), 'learning-models:usage', 'INVALID_USAGE_DATA');
    const receipt = {
      calls: current.calls.length,
      pendingCosts: current.calls.filter((call) => call.actualCost === null).length,
      actualCost: current.calls.some((call) => call.actualCost === null)
        ? null
        : current.calls.reduce((total, call) => total + (call.actualCost || 0), 0)
    };
    if (current.calls.some((call) => call.status === 'reserved'))
      return { status: 'unverified', reason: 'REQUEST_PENDING; account retained', receipt };
    try {
      const result = requireResult(
        await request('account-delete', { action: 'request' }, credentials),
        'account-delete:request'
      );
      check(result?.deleted === true, 'account-delete:request', 'TEST_ACCOUNT_DELETE_NOT_CONFIRMED');
      check(result.billingRetained === true, 'account-delete:request', 'BILLING_RETENTION_NOT_CONFIRMED');
      return { status: 'passed', billingRetained: true, receipt };
    } catch (error) {
      error.receipt = receipt;
      throw error;
    }
  }
  async function existingAccount(targetEmail, password) {
    const result = await request(
      'login',
      {
        type: 'email',
        region: 'CN',
        email: targetEmail,
        ...(password ? { password } : { verifyCode: '000000' }),
        existingAccountOnly: true
      },
      null
    );
    if (result?.success !== true && result?.code === 404 && result?.error === 'ACCOUNT_NOT_FOUND') return null;
    return loginData(result);
  }
  async function healthCheck() {
    const health = await request('health', undefined, null);
    check(
      health?.status === 'ok' && (health.code === undefined || health.code === 0) && health.success !== false,
      'health',
      'UNHEALTHY'
    );
  }
  function recordFailure(error) {
    const reason = failureReason(error);
    if (error.transport) report.blocked.push({ step: 'local_QA_access', endpoint: error.endpoint, reason });
    return reason;
  }
  if (cleanupRange?.accountFile) {
    report.mode = 'cleanup-account-file';
    for (const name of Object.keys(steps)) delete steps[name];
    steps.cleanup_ui_account = { status: 'unverified' };
    try {
      const account = readAccount(cleanupRange.accountFile);
      check(
        typeof account.email === 'string' &&
          Boolean(account.email) &&
          typeof account.password === 'string' &&
          Boolean(account.password),
        'login',
        'ACCOUNT_CREDENTIALS_REQUIRED'
      );
      await healthCheck();
      const existing = await existingAccount(account.email, account.password);
      steps.cleanup_ui_account = existing ? await deleteIdle(existing.token) : { status: 'passed', absent: true };
    } catch (error) {
      steps.cleanup_ui_account = {
        status: 'unverified',
        reason: recordFailure(error),
        ...(error.receipt ? { receipt: error.receipt } : {})
      };
    }
    return report;
  }
  if (cleanupRange) {
    report.mode = 'cleanup-orphans';
    report.orphanWindow = cleanupRange;
    report.orphanCleanup = [];
    for (const name of Object.keys(steps)) delete steps[name];
    steps.cleanup_orphans = { status: 'unverified' };
    try {
      await healthCheck();
      for (let ms = cleanupRange.start; ms <= cleanupRange.end; ms++) {
        const syntheticAccount = `codex.byok.${ms}@example.test`;
        const entry = { syntheticAccount, status: 'unverified' };
        report.orphanCleanup.push(entry);
        const account = await existingAccount(syntheticAccount);
        const result = account ? await deleteIdle(account.token) : { status: 'passed', absent: true };
        Object.assign(entry, result);
      }
      steps.cleanup_orphans = {
        status: report.orphanCleanup.every((result) => result.status === 'passed') ? 'passed' : 'unverified',
        checked: report.orphanCleanup.length,
        deleted: report.orphanCleanup.filter((result) => result.billingRetained).length,
        absent: report.orphanCleanup.filter((result) => result.absent).length
      };
    } catch (error) {
      const reason = recordFailure(error);
      const last = report.orphanCleanup.at(-1);
      if (last?.status === 'unverified' && !last.reason) last.reason = reason;
      if (last && error.receipt) last.receipt = error.receipt;
      steps.cleanup_orphans = { status: 'unverified', reason };
    }
    return report;
  }
  try {
    // This read-only probe runs before account creation or reading any provider keys.
    await healthCheck();
    // The server can commit an account before the response arrives or passes validation.
    accountMayExist = true;
    report.syntheticAccount = email;
    report.registration = 'possibly_created';
    const loginResult = await request(
      'login',
      { type: 'email', region: 'CN', email, password, verifyCode: '000000' },
      null
    );
    cleanupToken = typeof loginResult?.data?.token === 'string' ? loginResult.data.token : undefined;
    const login = loginData(loginResult);
    token = login.token;
    cleanupToken = token;
    userId = login.userId;
    report.registration = 'confirmed';
    const initial = await models({ action: 'list' });
    check(initial?.needsConnection === true, 'learning-models:list', 'EXPECTED_EMPTY_CONNECTIONS');
    steps.register = { status: 'passed' };
    stage = 'two_connections';
    privateDirectory = mkdtempSync(resolve(tmpdir(), 'yozi-byok-account-'));
    accountFile = resolve(privateDirectory, 'account.json');
    writeFileSync(accountFile, JSON.stringify({ token }), { mode: 0o600 });
    const seeded = await seedModels(accountFile, env);
    report.seed = seeded;
    check(
      seeded.success === true &&
        seeded.connections?.length === 2 &&
        new Set(seeded.connections.map((item) => item.providerId)).size === 2,
      'seed-dev-test-models',
      'EXPECTED_TWO_FREE_PROVIDERS'
    );
    steps.two_connections = { status: 'passed' };
    stage = 'discovery_and_switch';
    let catalog = await models({ action: 'list' });
    const selectedConnections = seeded.connections.map((item) =>
      catalog.models.find(
        (model) => model.id === item.id && model.model === item.model && model.source === 'byok' && model.configured
      )
    );
    const chosen = selectedConnections.find((model) => model?.id === seeded.selectedModelId);
    check(chosen && selectedConnections.every(Boolean), 'learning-models:list', 'SEEDED_CONNECTION_MISSING');
    for (const model of selectedConnections) {
      const discovery = await models({ action: 'discover', profileId: model.id, refresh: true });
      check(
        discovery.models.some((row) => row.modelId === model.model),
        'learning-models:discover',
        'SELECTED_MODEL_NOT_LISTED'
      );
      await models({ action: 'preferences', preferences: { selectedModelId: model.id } });
      check(
        (await models({ action: 'list' })).preferences.selectedModelId === model.id,
        'learning-models:list',
        'SELECTED_MODEL_NOT_RESTORED'
      );
    }
    await models({ action: 'preferences', preferences: { selectedModelId: chosen.id, sharingAllowed: true } });
    steps.discovery_and_switch = { status: 'passed' };
    const load = (file) =>
      import(pathToFileURL(resolve(root, 'tmp/yozi-candidate-build/backend/functions/_shared', file)).href);
    globalThis.__YOZI_DEV_TEST__ = true;
    const domain = await load('learning-domain.js'),
      coach = await load('learning-writing-coach.js');
    let state = domain.emptyLearningState(userId, 'Asia/Shanghai'),
      sequence = 0;
    const operations = [],
      id = (prefix) => `${prefix}_${Date.now().toString(36)}_${++sequence}`;
    const apply = (type, data) => {
      const operation = { id: id('op'), type, data, at: Date.now() };
      const next = domain.applyLearningOperation(state, operation);
      state = next.state;
      operations.push(operation);
      return next.result;
    };
    stage = 'intake';
    const goal = '我准备考研英语二写作，每天学习25分钟，想练习应用文和大作文，基础是能写简单的英文句子。';
    let intakeId = id('intake');
    apply('intake.request', { requestId: intakeId, modelId: chosen.id, explicit: true });
    let reply = await models({
      action: 'test',
      modelId: chosen.id,
      requestId: intakeId,
      shareConsent: true,
      intake: { turns: [] }
    });
    apply('intake.result', {
      requestId: intakeId,
      modelId: chosen.id,
      reply: { message: reply.message, intake: reply.intake, question: reply.question, tools: reply.tools }
    });
    const turns = [{ question: reply.message, answer: goal }];
    intakeId = id('intake');
    apply('intake.request', { requestId: intakeId, modelId: chosen.id, answer: goal, explicit: true });
    reply = await models({
      action: 'test',
      modelId: chosen.id,
      requestId: intakeId,
      shareConsent: true,
      intake: { turns }
    });
    apply('intake.result', {
      requestId: intakeId,
      modelId: chosen.id,
      reply: { message: reply.message, intake: reply.intake, question: reply.question, tools: reply.tools }
    });
    check(state.intake.reply.intake.profile, 'learning-models:test', 'INTAKE_PROFILE_NOT_READY');
    const conversation = apply('intake.accept', { explicit: true });
    const conversationId = conversation.id,
      today = domain.dayKey(Date.now(), state.timezone);
    const currentCoach = () => state.conversations.find((item) => item.id === conversationId).coach;
    const currentDay = () => currentCoach().days.find((item) => item.day === today);
    async function infer(phase, target = phase) {
      const current = currentCoach(),
        bound = coach.coachInputFor(current, currentDay(), phase, target),
        requestId = id('coach'),
        binding = id('binding');
      const requestData = {
        contract: coach.WRITING_COACH_CONTRACT,
        phase,
        target,
        day: today,
        exam: current.profile.exam,
        minutes: current.profile.minutes,
        ...(current.profile.foundation ? { foundation: current.profile.foundation } : {}),
        essayType: coach.coachEssayType(current, today),
        ...bound,
        sources: [],
        weaknesses: coach.coachWeaknesses(current),
        ...(['feedback', 'essay'].includes(phase) ? { feedbackVersion: coach.COACH_FEEDBACK_VERSION } : {})
      };
      if (phase === 'essay') {
        const band = coach.coachWritingBandContext(current, currentDay(), requestId);
        if (band) requestData.writingBand = band;
      }
      apply('coach.request', {
        conversationId,
        explicit: true,
        requestId,
        binding,
        modelId: chosen.id,
        request: requestData
      });
      let result = await request('proxy-ai', {
        modelId: chosen.id,
        requestId,
        requestBinding: binding,
        shareConsent: true,
        messages: [{ role: 'user', content: bound.input }],
        learningContext: { owner: userId, goal, coach: requestData }
      });
      let endpoint = 'proxy-ai';
      if (!successfulResult(result) && (!result.status || result.status === 'reserved')) {
        result = await request('learning-models', { action: 'result', requestId });
        endpoint = 'learning-models:result';
      }
      const output = requireResult(result, endpoint);
      check(output?.requestId === requestId, endpoint, 'REQUEST_ID_MISMATCH');
      check(output.requestBinding === binding, endpoint, 'REQUEST_BINDING_MISMATCH');
      check(output.modelId === chosen.id, endpoint, 'MODEL_ID_MISMATCH');
      apply('coach.result', { conversationId, explicit: true, requestId, output: output.coach });
    }
    steps.intake = { status: 'passed' };
    stage = 'diagnostic';
    await infer('diagnostic');
    const answer =
      'I am writing to invite you to join our study group. We can practise English together and discuss our ideas every week. Please let me know if you are interested.';
    for (const card of currentCoach().diagnostic.cards)
      apply('coach.answer', {
        conversationId,
        target: 'diagnostic',
        cardId: card.id,
        answer: card.options?.[0]?.label || card.options?.[0] || answer
      });
    await infer('feedback', 'diagnostic');
    steps.diagnostic = { status: 'passed' };
    stage = 'daily';
    await infer('daily');
    for (const card of currentDay().pack.cards) {
      apply('coach.answer', {
        conversationId,
        cardId: card.id,
        answer: card.options?.[0]?.label || card.options?.[0] || answer
      });
      await infer('feedback', `card-${card.id}`);
    }
    steps.daily = { status: 'passed' };
    stage = 'writing';
    apply('coach.analysis', {
      conversationId,
      fields: {
        genre: 'letter',
        recipient: 'a friend',
        purpose: 'invite a friend to study together',
        points: 'purpose, activity details, invitation',
        words: '120-150'
      }
    });
    await infer('feedback', 'analysis');
    const paragraphs = [
      'Dear Alex, I am writing to invite you to join our English study group this Saturday. I hope we can work together to improve our writing skills.',
      'We plan to meet at the school library at nine in the morning. First, we will share our ideas about letter writing. Then we can practise useful expressions and give each other helpful feedback. Please bring a notebook and a short piece of your own writing.',
      'I believe this activity will be both useful and enjoyable. Please let me know if you are available. I look forward to hearing from you soon. Best wishes, Li Ming.'
    ];
    for (let index = 0; index < currentDay().pack.writing.patterns.length; index++) {
      apply('coach.paragraph', {
        conversationId,
        index,
        text: paragraphs[index],
        authorship: 'user_typed',
        rewrite: false
      });
      await infer('feedback', `paragraph-${index}`);
      apply('coach.paragraph', {
        conversationId,
        index,
        text: `${paragraphs[index]} Thank you for your time.`,
        authorship: 'user_typed',
        rewrite: true
      });
    }
    apply('coach.essaySubmit', { conversationId, explicit: true });
    await infer('essay');
    steps.writing = { status: 'passed' };
    stage = 'summary';
    await infer('summary');
    apply('coach.finish', { conversationId, explicit: true });
    requireResult(
      await request('learning-sync', { action: 'push', timezone: state.timezone, operations, returnSnapshot: false }),
      'learning-sync:push'
    );
    steps.summary = { status: 'passed' };
    stage = 'relogin_restore';
    token = null;
    const restored = loginData(
      await request('login', { type: 'email', region: 'CN', email, password, existingAccountOnly: true }, null)
    );
    token = restored.token;
    check(restored.userId === userId, 'login', 'RESTORED_USER_MISMATCH');
    catalog = await models({ action: 'list' });
    check(catalog.preferences.selectedModelId === chosen.id, 'learning-models:list', 'SELECTED_MODEL_NOT_RESTORED');
    check(catalog.preferences.sharingAllowed === true, 'learning-models:list', 'SHARING_CONSENT_NOT_RESTORED');
    check(
      seeded.connections.every((connection) =>
        catalog.models.some(
          (model) =>
            model.source === 'byok' &&
            model.id === connection.id &&
            model.model === connection.model &&
            model.configured
        )
      ),
      'learning-models:list',
      'CONNECTIONS_NOT_RESTORED'
    );
    steps.relogin_restore = { status: 'passed' };
    stage = 'invalid_key';
    const invalid = {
      id: 'invalid-key-probe',
      provider: chosen.provider,
      endpoint: chosen.endpoint,
      model: chosen.model,
      apiKey: 'invalid-placeholder-only-no-real-secret',
      structured: true
    };
    await models({ action: 'save', profile: invalid, shareConsent: true });
    const invalidResult = await request('learning-models', {
      action: 'test',
      modelId: invalid.id,
      requestId: id('invalid'),
      shareConsent: true
    });
    check(invalidResult?.connectionError === 'KEY_INVALID', 'learning-models:test', 'EXPECTED_KEY_INVALID');
    await models({ action: 'delete', profileId: invalid.id });
    steps.invalid_key = { status: 'passed' };
  } catch (error) {
    steps[stage] = {
      status: error.transport && !accountMayExist ? 'unverified' : 'failed',
      reason: recordFailure(error)
    };
  } finally {
    if (accountMayExist) {
      report.cleanupAttempted = true;
      try {
        if (!cleanupToken) {
          const recovered = await existingAccount(email);
          cleanupToken = recovered?.token;
          if (!recovered) steps.delete_new_account = { status: 'passed', absent: true };
        }
        if (cleanupToken) {
          const current = await usage(cleanupToken);
          recordUsage(current);
          steps.delete_new_account = await deleteIdle(cleanupToken, current);
        }
      } catch (error) {
        if (!usageRecorded) report.calls = report.actualCost = report.pendingCosts = null;
        steps.delete_new_account = {
          status: 'unverified',
          reason: recordFailure(error),
          ...(error.receipt ? { receipt: error.receipt } : {}),
          syntheticAccount: email
        };
      }
    }
    if (accountFile) unlinkSync(accountFile);
    if (privateDirectory) rmdirSync(privateDirectory);
  }
  // Old disposable accounts use normal login, usage and account-delete endpoints only.
  if (!report.blocked.length)
    for (const [name, oldEmail] of [
      ['delete_deepseek_account', 'deepseek.student.1026@example.com'],
      ['delete_claude_account', 'claude-ux-1025b@example.test']
    ]) {
      try {
        const old = await existingAccount(oldEmail);
        steps[name] = old ? await deleteIdle(old.token) : { status: 'passed', absent: true };
      } catch (error) {
        steps[name] = { status: 'unverified', reason: recordFailure(error) };
      }
    }
  return report;
}

async function main() {
  try {
    const report = await verifyByokFrontend({ args: process.argv.slice(2) });
    const reportFile =
      report.mode === 'cleanup-orphans'
        ? 'byok-frontend-20261026-orphan-cleanup.json'
        : report.mode === 'cleanup-account-file'
          ? 'byok-frontend-20261026-ui-account-cleanup.json'
          : 'byok-frontend-20261026-live.json';
    writeFileSync(resolve(root, 'tmp/codex-orders', reportFile), JSON.stringify(report, null, 2) + '\n');
    console.info(JSON.stringify(report));
    if (Object.values(report.steps).some((step) => step.status !== 'passed')) process.exitCode = 1;
  } catch (error) {
    console.error(failureReason(error));
    process.exitCode = 1;
  }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) void main();
