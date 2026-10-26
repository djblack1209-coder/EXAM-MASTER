const validCount = (value) => typeof value === 'number' && Number.isFinite(value) && value >= 0;
export function museAccountUsage(snapshot) {
  const entitlement = snapshot?.entitlement;
  const subscription = snapshot?.subscription;
  const tier = ['pro', 'max'].includes(subscription?.plan) ? subscription.plan : null;
  const valid = entitlement && ['weeklyUnits', 'spent', 'reserved'].every((key) => validCount(entitlement[key]));
  const quota = valid
    ? {
        limit: entitlement.weeklyUnits,
        used: entitlement.spent,
        reserved: entitlement.reserved,
        remaining: Math.max(0, entitlement.weeklyUnits - entitlement.spent - entitlement.reserved),
        percent:
          entitlement.weeklyUnits > 0
            ? Math.min(100, Math.round((entitlement.spent / entitlement.weeklyUnits) * 100))
            : null,
        week: entitlement.week,
        timezone: entitlement.timezone
      }
    : null;
  const models = new Map();
  // Only server receipts can establish tokens/costs; local request counts are
  // never promoted into provider usage, balances, or subscription entitlements.
  for (const call of Array.isArray(snapshot?.calls) ? snapshot.calls : []) {
    if (call.source !== 'byok') continue;
    const id = `${call.provider || ''}:${call.modelId || call.model}`;
    if (!models.has(id))
      models.set(id, {
        id,
        provider: call.provider || '',
        model: call.model || call.modelId,
        count: 0,
        tokens: 0,
        missingUsage: 0,
        cost: 0,
        pendingCost: 0
      });
    const row = models.get(id);
    row.count++;
    if (validCount(call.usage?.prompt_tokens) && validCount(call.usage?.completion_tokens))
      row.tokens += call.usage.prompt_tokens + call.usage.completion_tokens;
    else row.missingUsage++;
    if (call.costStatus === 'settled' && validCount(call.actualCost)) row.cost += call.actualCost;
    else if (call.costStatus !== 'not_called') row.pendingCost++;
  }
  return { tier, subscription: subscription || null, quota, models: [...models.values()] };
}
