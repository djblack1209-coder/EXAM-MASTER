import type { ModelConfig } from './learning-provider.js';

export type AuxiliaryTask = 'conversation_name' | 'reminder_copy';
type ModelIdentity = Readonly<Pick<ModelConfig, 'provider' | 'model' | 'endpoint'>>;

export type AuxiliaryModelPolicy = {
  enabled?: boolean;
  // Backend-owned configuration only; never accept this policy from model text or a client request.
  models?: Partial<Record<AuxiliaryTask, string>>;
};

export type AuxiliaryPrice = {
  model: string;
  inputPerMillion: number;
  outputPerMillion: number;
  currency: 'CNY' | 'USD';
  priceVersion: string;
  validUntil: number;
};

export type AuxiliaryModelOptions = {
  policy?: AuxiliaryModelPolicy;
  // A caller must obtain this from the existing budget checks; this function reserves nothing.
  budgetAvailable?: boolean;
  auxiliaryFailed?: boolean;
  pricing?: { main: AuxiliaryPrice; auxiliary: AuxiliaryPrice };
  now?: number;
};

export type AuxiliaryModelDecision = {
  model: string;
  useAuxiliary: boolean;
  reason:
    | 'disabled'
    | 'unsupported_task'
    | 'not_allowlisted'
    | 'budget_unavailable'
    | 'auxiliary_failed'
    | 'pricing_unconfirmed'
    | 'not_cheaper'
    | 'auxiliary';
};

// Exact native-provider routes only. Regional endpoints remain separate, including Z.ai / 智谱.
// These are candidates, not availability/price assertions. No gateway or arbitrary model is inferred.
export const AUXILIARY_MODEL_ALLOWLIST = Object.freeze([
  Object.freeze({
    provider: '智谱',
    endpoint: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
    mainModel: 'glm-4.7',
    models: Object.freeze(['glm-4.7-flash'])
  }),
  Object.freeze({
    provider: 'Z.ai',
    endpoint: 'https://api.z.ai/api/paas/v4/chat/completions',
    mainModel: 'glm-4.7',
    models: Object.freeze(['glm-4.7-flash', 'glm-4.5-flash'])
  })
]);

function validPrice(price: AuxiliaryPrice | undefined, now: number): price is AuxiliaryPrice {
  return Boolean(
    price &&
    Number.isFinite(price.inputPerMillion) &&
    price.inputPerMillion >= 0 &&
    Number.isFinite(price.outputPerMillion) &&
    price.outputPerMillion >= 0 &&
    ['CNY', 'USD'].includes(price.currency) &&
    typeof price.priceVersion === 'string' &&
    price.priceVersion.trim() &&
    Number.isFinite(price.validUntil) &&
    price.validUntil > now
  );
}

/**
 * Pure, unwired task policy. Only the returned model ID may differ for this auxiliary task.
 * Never clone a credential-bearing ModelConfig, read credentials/env, mutate the main model or call a provider.
 * A fallback is not authorization to retry/spend: normal auth, isolation, budget and idempotency still apply.
 */
export function auxiliaryModelForTask(
  task: string,
  main: ModelIdentity,
  options: AuxiliaryModelOptions = {}
): AuxiliaryModelDecision {
  const fallback = (reason: AuxiliaryModelDecision['reason']): AuxiliaryModelDecision => ({
    model: main.model,
    useAuxiliary: false,
    reason
  });
  if (!options.policy || options.policy.enabled !== true) return fallback('disabled');
  if (task !== 'conversation_name' && task !== 'reminder_copy') return fallback('unsupported_task');
  if (options.auxiliaryFailed === true) return fallback('auxiliary_failed');
  if (options.budgetAvailable !== true) return fallback('budget_unavailable');

  const candidate = options.policy.models?.[task];
  const route = AUXILIARY_MODEL_ALLOWLIST.find(
    (item) => item.provider === main.provider && item.endpoint === main.endpoint && item.mainModel === main.model
  );
  if (!route || !route.models.includes(candidate)) return fallback('not_allowlisted');

  const now = options.now ?? Date.now();
  const mainPrice = options.pricing?.main;
  const auxiliaryPrice = options.pricing?.auxiliary;
  if (
    !Number.isFinite(now) ||
    !validPrice(mainPrice, now) ||
    !validPrice(auxiliaryPrice, now) ||
    mainPrice.model !== main.model ||
    auxiliaryPrice.model !== candidate ||
    mainPrice.currency !== auxiliaryPrice.currency
  )
    return fallback('pricing_unconfirmed');
  // Both input/output must be no dearer, and at least one strictly cheaper. No cached/tool prices are assumed.
  if (
    auxiliaryPrice.inputPerMillion > mainPrice.inputPerMillion ||
    auxiliaryPrice.outputPerMillion > mainPrice.outputPerMillion ||
    (auxiliaryPrice.inputPerMillion === mainPrice.inputPerMillion &&
      auxiliaryPrice.outputPerMillion === mainPrice.outputPerMillion)
  )
    return fallback('not_cheaper');

  return { model: candidate, useAuxiliary: true, reason: 'auxiliary' };
}
