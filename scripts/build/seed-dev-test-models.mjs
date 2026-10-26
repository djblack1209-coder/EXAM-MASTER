#!/usr/bin/env node
import { readFileSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { readFreeApiCatalog, readFreeApiCredential } from './free-api-catalog.mjs';
import { DEV_TEST } from '../../tmp/yozi-candidate-build/backend/functions/_shared/build-channel.js';
import { freeModelPricing } from '../../tmp/yozi-candidate-build/backend/functions/_shared/ai-providers/free-model-presets.js';

const { values } = parseArgs({ options: { 'account-file': { type: 'string' } } });
const database = new URL(process.env.MONGODB_URI || '');
if (
  !DEV_TEST ||
  database.hostname !== '127.0.0.1' ||
  database.pathname !== '/yozi_dev_test' ||
  process.env.PORT !== '4382'
)
  throw new Error('Only the isolated loopback dev/test backend is supported.');
const file = resolve(values['account-file'] || '');
if (!values['account-file'] || !statSync(file).isFile() || statSync(file).size > 16384 || statSync(file).mode & 0o077)
  throw new Error('Provide a private 0600 JSON account file containing email/password or token.');
const account = JSON.parse(readFileSync(file, 'utf8'));
let token = account.token;
async function request(path, body) {
  const response = await fetch(`http://127.0.0.1:4382/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(150000)
  });
  const result = await response.json();
  if (!result.success)
    throw new Error(`Dev/test request failed: ${path} (${result.error || result.errorCode || result.code})`);
  return result.data;
}
if (!token) {
  if (!account.email || !account.password)
    throw new Error('An existing test account is required; this script does not register accounts.');
  token = (await request('login', { type: 'email', region: 'CN', email: account.email, password: account.password }))
    .token;
}
const before = await request('learning-models', { action: 'list' });
const catalogFile = resolve(homedir(), 'Desktop/Free-llm-API.html');
const catalog = readFreeApiCatalog(catalogFile);
const choices = [
  { providerId: 'zai', id: 'dev-zai-byok', model: 'glm-4.7-flash', structured: true },
  {
    providerId: 'openrouter',
    id: 'dev-openrouter-byok',
    model: 'nvidia/nemotron-3-ultra-550b-a55b:free',
    structured: false
  }
];
const saved = [];
for (const choice of choices) {
  const row = catalog.find(
    (item) =>
      item.id === choice.providerId &&
      item.baseMatchesOfficial &&
      item.status === 'verified' &&
      item.models.includes(choice.model)
  );
  if (!row || !freeModelPricing({ model: choice.model, endpoint: row.endpoint }))
    throw new Error(`Reviewed exact free route unavailable: ${choice.providerId}`);
  // Idempotent reruns keep the existing vault key. Credential text is never printed or written.
  if (!before.models.some((item) => item.id === choice.id && item.model === choice.model && item.configured))
    await request('learning-models', {
      action: 'save',
      shareConsent: true,
      profile: {
        id: choice.id,
        provider: row.provider,
        endpoint: row.endpoint,
        model: choice.model,
        structured: choice.structured,
        apiKey: readFreeApiCredential(catalogFile, row.id, row.baseURL)
      }
    });
  const requestId = `seed_${choice.providerId}_${Date.now()}`;
  // Each connection is tested exactly once; timeout is not replayed and the receipt stays queryable.
  await request('learning-models', { action: 'test', modelId: choice.id, requestId, shareConsent: true });
  saved.push({ id: choice.id, provider: row.provider, requestId, status: 'connected' });
}
await request('learning-models', { action: 'preferences', preferences: { selectedModelId: choices[0].id } });
const usage = await request('learning-models', { action: 'usage' });
const calls = usage.calls.filter((call) => saved.some((entry) => entry.requestId === call.id));
console.info(
  JSON.stringify({
    connections: saved,
    providerCalls: calls.length,
    actualCost: calls.every((call) => call.actualCost === 0) ? 0 : null,
    pendingCosts: calls.filter((call) => call.actualCost === null).length
  })
);
