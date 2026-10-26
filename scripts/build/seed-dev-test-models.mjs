#!/usr/bin/env node
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { readFreeApiCatalog, readFreeApiCredential } from './free-api-catalog.mjs';
import { assertDevTest, readPrivateAccount, requireResult, successfulResult } from './verify-byok-frontend.mjs';

const root = resolve(fileURLToPath(new URL('../..', import.meta.url)));
export const FREE_SEED_ORIGINS = Object.freeze([
  'https://api.z.ai',
  'https://openrouter.ai',
  'https://open.bigmodel.cn'
]);
export const FREE_SEED_CHOICES = Object.freeze([
  { providerId: 'zai', id: 'dev-zai-byok', model: 'glm-4.7-flash', structured: true },
  {
    providerId: 'openrouter',
    id: 'dev-openrouter-byok',
    model: 'nvidia/nemotron-3-ultra-550b-a55b:free',
    structured: false
  },
  { providerId: 'zhipu', id: 'dev-zhipu-byok', model: 'glm-4.7-flash', structured: true }
]);
const machineCode = (value) => (typeof value === 'string' && /^[A-Z0-9_:-]{1,80}$/.test(value) ? value : 'UNAVAILABLE');
const classify = (result) =>
  machineCode(
    result?.connectionError ||
      result?.errorCode ||
      result?.error ||
      (result?.code === 429 ? 'RATE_LIMITED' : result?.status === 'reserved' ? 'TIMEOUT' : 'UNAVAILABLE')
  );

export async function seedFreeModels({
  env = process.env,
  accountFile,
  fetchImpl = globalThis.fetch,
  readAccount = readPrivateAccount,
  readCatalog = readFreeApiCatalog,
  readCredential = readFreeApiCredential,
  pricing
} = {}) {
  assertDevTest(env);
  const account = readAccount(accountFile);
  let token = typeof account.token === 'string' ? account.token : undefined;
  const report = {
    success: false,
    connections: [],
    attempts: [],
    providerCalls: null,
    actualCost: null,
    pendingCosts: null
  };
  let before;
  async function request(path, body) {
    let response;
    try {
      response = await fetchImpl(`http://127.0.0.1:4382/${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(150000)
      });
    } catch (error) {
      throw Object.assign(new Error('QA_TRANSPORT_UNAVAILABLE'), {
        code: machineCode(error.cause?.code || error.code),
        transport: true
      });
    }
    let result;
    try {
      result = await response.json();
    } catch {
      throw Object.assign(new Error('QA_INVALID_JSON'), { code: 'QA_INVALID_JSON', transport: true });
    }
    if (response.ok === false && successfulResult(result))
      throw Object.assign(new Error(), { code: 'QA_HTTP_FAILURE', transport: true });
    return result;
  }
  const models = async (body) =>
    requireResult(await request('learning-models', body), `learning-models:${body.action}`);
  try {
    if (!token) {
      if (
        typeof account.email !== 'string' ||
        !account.email ||
        typeof account.password !== 'string' ||
        !account.password
      )
        throw Object.assign(new Error(), { code: 'ACCOUNT_CREDENTIALS_REQUIRED' });
      const login = requireResult(
        await request('login', {
          type: 'email',
          region: 'CN',
          email: account.email,
          password: account.password,
          existingAccountOnly: true
        }),
        'login'
      );
      if (!login?.token) throw Object.assign(new Error(), { code: 'INVALID_LOGIN_DATA' });
      token = login.token;
    }
    before = await models({ action: 'list' });
    const catalogFile = resolve(homedir(), 'Desktop/Free-llm-API.html');
    const catalog = readCatalog(catalogFile);
    const freePricing =
      pricing ||
      (
        await import(
          pathToFileURL(
            resolve(root, 'tmp/yozi-candidate-build/backend/functions/_shared/ai-providers/free-model-presets.js')
          ).href
        )
      ).freeModelPricing;
    for (const choice of FREE_SEED_CHOICES) {
      if (report.connections.length === 2) break;
      const row = catalog.find(
        (item) =>
          item.id === choice.providerId &&
          item.baseMatchesOfficial &&
          item.status === 'verified' &&
          item.credentialAvailable &&
          item.models.includes(choice.model)
      );
      const attempt = {
        providerId: choice.providerId,
        provider: row?.provider || choice.providerId,
        model: choice.model,
        status: 'unverified'
      };
      report.attempts.push(attempt);
      if (!row || !freePricing({ model: choice.model, endpoint: row.endpoint })) {
        Object.assign(attempt, { status: 'skipped', classification: 'NO_REVIEWED_FREE_ROUTE' });
        continue;
      }
      const existing = before.models.find((item) => item.id === choice.id);
      if (existing && (existing.model !== choice.model || existing.endpoint !== row.endpoint)) {
        Object.assign(attempt, { status: 'skipped', classification: 'EXISTING_PROFILE_MISMATCH' });
        continue;
      }
      const requestId = `seed_${choice.providerId}_${Date.now()}_${report.attempts.length}`;
      attempt.requestId = requestId;
      if (!existing?.configured)
        try {
          await models({
            action: 'save',
            shareConsent: true,
            profile: {
              id: choice.id,
              provider: row.provider,
              endpoint: row.endpoint,
              model: choice.model,
              structured: choice.structured,
              apiKey: readCredential(catalogFile, row.id, row.baseURL)
            }
          });
        } catch (error) {
          Object.assign(attempt, {
            status: 'failed',
            classification: machineCode(error.qaCode || error.code || 'CREDENTIAL_UNAVAILABLE')
          });
          if (error.transport) throw error;
          continue;
        }
      let result;
      let queried = false;
      let uncertain = false;
      try {
        attempt.testRequested = true;
        result = await request('learning-models', {
          action: 'test',
          modelId: choice.id,
          requestId,
          shareConsent: true
        });
      } catch (error) {
        Object.assign(attempt, { status: 'unverified', classification: machineCode(error.code), requestPending: true });
        if (['EPERM', 'EACCES'].includes(error.code)) throw error;
        uncertain = true;
        queried = true;
        // A lost response can follow a real call. Query this request once; never replay it.
        result = await request('learning-models', { action: 'result', requestId });
      }
      if (!successfulResult(result)) {
        const originalClassification = classify(result);
        // Timeouts and pending requests get a read of the original receipt, not another inference.
        if (
          !queried &&
          (result?.status === 'reserved' ||
            ['TIMEOUT', 'UPSTREAM_TIMEOUT', 'NETWORK_UNAVAILABLE'].includes(originalClassification))
        ) {
          const recovered = await request('learning-models', { action: 'result', requestId });
          result = recovered;
          if (!successfulResult(result)) attempt.classification = originalClassification;
        }
      }
      if (successfulResult(result)) {
        Object.assign(attempt, { status: 'passed', classification: 'CONNECTED', requestPending: false });
        report.connections.push({
          id: choice.id,
          providerId: choice.providerId,
          provider: row.provider,
          model: choice.model,
          structured: choice.structured,
          requestId,
          status: 'connected'
        });
      } else {
        Object.assign(attempt, {
          status: 'failed',
          classification: attempt.classification || classify(result),
          requestPending:
            result?.status === 'reserved' || (uncertain && !['failed', 'cancelled'].includes(result?.status))
        });
        // Do not remove an in-flight profile or a pre-existing user connection.
        if (!attempt.requestPending && !existing)
          try {
            await models({ action: 'delete', profileId: choice.id });
          } catch (error) {
            attempt.cleanupUnverified = machineCode(error.qaCode || error.code);
            if (error.transport) throw error;
          }
      }
      // Each provider is attempted once. All candidates are exact reviewed zero-price routes;
      // account-trial providers and paid aliases are never candidates.
    }
    if (report.connections.length === 2) {
      const primary = report.connections.find((item) => item.structured) || report.connections[0];
      await models({ action: 'preferences', preferences: { selectedModelId: primary.id } });
      report.selectedModelId = primary.id;
      report.success = true;
    } else report.error = 'INSUFFICIENT_FREE_PROVIDERS';
  } catch (error) {
    report.error = error.code === 'QA_STEP_FAILED' ? error.message : machineCode(error.code);
  } finally {
    if (token) {
      try {
        const usage = await models({ action: 'usage' });
        const requestIds = new Set(report.attempts.map((item) => item.requestId).filter(Boolean));
        const calls = usage.calls.filter((call) => requestIds.has(call.id) || requestIds.has(call.repairOf));
        report.providerCalls = calls.filter((call) => call.executionStage !== 'not_called').length;
        report.pendingCosts = calls.filter((call) => call.actualCost == null).length;
        report.actualCost = report.pendingCosts ? null : calls.reduce((sum, call) => sum + call.actualCost, 0);
        for (const attempt of report.attempts) {
          const receipts = calls.filter((call) => call.id === attempt.requestId || call.repairOf === attempt.requestId);
          if (receipts.length)
            attempt.receipts = receipts.map((call) => ({
              requestId: call.id,
              status: call.status,
              executionStage: call.executionStage,
              actualCost: call.actualCost ?? null
            }));
          else if (attempt.testRequested) {
            attempt.receiptUnverified = true;
            report.providerCalls = report.actualCost = report.pendingCosts = null;
          }
        }
      } catch {
        report.usageUnverified = true;
      }
    }
  }
  return report;
}

async function main() {
  try {
    const { values } = parseArgs({ options: { 'account-file': { type: 'string' } } });
    const report = await seedFreeModels({ accountFile: values['account-file'] });
    console.info(JSON.stringify(report));
    if (!report.success) process.exitCode = 1;
  } catch (error) {
    console.error(machineCode(error.code));
    process.exitCode = 1;
  }
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) void main();
