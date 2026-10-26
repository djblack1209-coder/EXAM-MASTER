import { afterEach, describe, expect, it, vi } from 'vitest';
import https from 'node:https';
import {
  auxiliaryModelForTask,
  type AuxiliaryModelOptions
} from '../../laf-backend/functions/_shared/ai-providers/auxiliary-model-policy';

const now = Date.parse('2026-10-22T00:00:00Z');
const main = Object.freeze({
  provider: '智谱',
  model: 'glm-4.7',
  endpoint: 'https://open.bigmodel.cn/api/paas/v4/chat/completions'
});
function options(): AuxiliaryModelOptions {
  return {
    now,
    policy: { enabled: true, models: { conversation_name: 'glm-4.7-flash', reminder_copy: 'glm-4.7-flash' } },
    budgetAvailable: true,
    pricing: {
      // Synthetic public metadata, not a live tariff or account budget.
      main: {
        model: main.model,
        inputPerMillion: 2,
        outputPerMillion: 8,
        currency: 'CNY',
        priceVersion: 'fixture-main',
        validUntil: now + 1
      },
      auxiliary: {
        model: 'glm-4.7-flash',
        inputPerMillion: 0,
        outputPerMillion: 0,
        currency: 'CNY',
        priceVersion: 'fixture-auxiliary',
        validUntil: now + 1
      }
    }
  };
}
function fallback(result: ReturnType<typeof auxiliaryModelForTask>, reason: string, model = main.model) {
  expect(result).toEqual({ model, useAuxiliary: false, reason });
}

afterEach(() => vi.restoreAllMocks());

describe('任务级同厂商辅助模型策略（默认关闭、无调用）', () => {
  it('默认关闭，不能因提供候选或字符串 true 隐式开启', () => {
    fallback(auxiliaryModelForTask('conversation_name', main), 'disabled');
    for (const enabled of [undefined, false, 'true', 1]) {
      const opt = options();
      opt.policy!.enabled = enabled as boolean;
      fallback(auxiliaryModelForTask('conversation_name', main, opt), 'disabled');
    }
  });

  it.each(['conversation_name', 'reminder_copy'])('只对已开启且明确选择的 %s 返回候选', (task) => {
    expect(auxiliaryModelForTask(task, main, options())).toEqual({
      model: 'glm-4.7-flash',
      useAuxiliary: true,
      reason: 'auxiliary'
    });
  });

  it.each(['chat', 'writing_feedback', '', '__proto__', 'constructor'])('未知/主对话任务 %s 保持主型号', (task) => {
    fallback(auxiliaryModelForTask(task, main, options()), 'unsupported_task');
  });

  it('两个任务独立配置，缺失候选不自动选择其他任务或白名单的首项', () => {
    const opt = options();
    delete opt.policy!.models!.reminder_copy;
    fallback(auxiliaryModelForTask('reminder_copy', main, opt), 'not_allowlisted');
    expect(auxiliaryModelForTask('conversation_name', main, opt).useAuxiliary).toBe(true);
  });

  it.each(['glm-4.7-flashx', 'gemini-2.5-flash-lite', 'unknown', 'glm-4.7', 'GLM-4.7-Flash', ''])(
    '拒绝未列入精确白名单的候选 %s',
    (candidate) => {
      const opt = options();
      opt.policy!.models!.conversation_name = candidate;
      fallback(auxiliaryModelForTask('conversation_name', main, opt), 'not_allowlisted');
    }
  );

  it.each([
    { provider: 'Google Gemini' },
    { provider: 'Z.ai' },
    { provider: 'unknown' },
    { endpoint: 'https://api.z.ai/api/paas/v4/chat/completions' },
    { endpoint: 'https://openrouter.ai/api/v1/chat/completions' },
    { endpoint: 'https://open.bigmodel.cn.evil.example/api/paas/v4/chat/completions' },
    { endpoint: `${main.endpoint}?key=synthetic-value` },
    { model: 'unknown' },
    { model: 'glm-4.7-flash' }
  ])('厂商/区域端点/主型号不匹配时回退 %j', (patch) => {
    const input = { ...main, ...patch };
    fallback(auxiliaryModelForTask('conversation_name', input, options()), 'not_allowlisted', input.model);
  });

  it.each(['glm-4.7-flash', 'glm-4.5-flash'])('Z.ai 仅在其原官方端点接受 %s', (candidate) => {
    const input = { ...main, provider: 'Z.ai', endpoint: 'https://api.z.ai/api/paas/v4/chat/completions' };
    const opt = options();
    opt.policy!.models!.conversation_name = candidate;
    opt.pricing!.auxiliary.model = candidate;
    expect(auxiliaryModelForTask('conversation_name', input, opt)).toEqual({
      model: candidate,
      useAuxiliary: true,
      reason: 'auxiliary'
    });
    if (candidate === 'glm-4.5-flash')
      fallback(auxiliaryModelForTask('conversation_name', main, opt), 'not_allowlisted');
  });

  it.each([false, undefined])('预算不足或未确认（%s）回退主型号，不修改预算', (budgetAvailable) => {
    const opt = options();
    opt.budgetAvailable = budgetAvailable;
    const before = structuredClone(opt);
    fallback(auxiliaryModelForTask('reminder_copy', main, opt), 'budget_unavailable');
    expect(opt).toEqual(before);
  });

  it('失败回执只返回主型号，不抛错、不重试或自动换厂商', () => {
    const opt = options();
    opt.auxiliaryFailed = true;
    fallback(auxiliaryModelForTask('conversation_name', main, opt), 'auxiliary_failed');
    fallback(auxiliaryModelForTask('reminder_copy', main, opt), 'auxiliary_failed');
  });

  it('价格缺失、过期、货币不一致或非法数据均不降级', () => {
    const absent = options();
    delete absent.pricing;
    fallback(auxiliaryModelForTask('conversation_name', main, absent), 'pricing_unconfirmed');
    for (const side of ['main', 'auxiliary'] as const) {
      for (const patch of [
        { model: 'another-model' },
        { inputPerMillion: NaN },
        { outputPerMillion: Infinity },
        { inputPerMillion: -1 },
        { outputPerMillion: -1 },
        { currency: 'EUR' },
        { currency: 'USD' },
        { priceVersion: '' },
        { priceVersion: ' ' },
        { validUntil: now },
        { validUntil: now - 1 },
        { validUntil: Infinity }
      ]) {
        const opt = options();
        Object.assign(opt.pricing![side], patch);
        fallback(auxiliaryModelForTask('conversation_name', main, opt), 'pricing_unconfirmed');
      }
    }
    const invalidTime = options();
    invalidTime.now = NaN;
    fallback(auxiliaryModelForTask('conversation_name', main, invalidTime), 'pricing_unconfirmed');
  });

  it('两项价格均不更贵且至少一项更低才算便宜，免费主型号不发生假降价', () => {
    for (const [inputPerMillion, outputPerMillion] of [
      [3, 0],
      [0, 9],
      [2, 8]
    ]) {
      const opt = options();
      Object.assign(opt.pricing!.auxiliary, { inputPerMillion, outputPerMillion });
      fallback(auxiliaryModelForTask('conversation_name', main, opt), 'not_cheaper');
    }
    const free = options();
    Object.assign(free.pricing!.main, { inputPerMillion: 0, outputPerMillion: 0 });
    fallback(auxiliaryModelForTask('conversation_name', main, free), 'not_cheaper');
    const cheaper = options();
    cheaper.pricing!.auxiliary.inputPerMillion = 2;
    expect(auxiliaryModelForTask('conversation_name', main, cheaper).useAuxiliary).toBe(true);
  });

  it('不读取密钥、不返回配置、不记录日志、不发请求且主型号保持原样', () => {
    const guardedMain = { ...main };
    const opt = options();
    const secretRead = vi.fn(() => {
      throw new Error('credential access forbidden');
    });
    for (const target of [guardedMain, opt, opt.policy]) {
      for (const key of ['apiKey', 'keyRef', 'keyEnv', 'vault'])
        Object.defineProperty(target, key, { enumerable: true, get: secretRead });
      Object.freeze(target);
    }
    const output = ['log', 'warn', 'error', 'info', 'debug'].map((method) =>
      vi.spyOn(console, method as 'log').mockImplementation(() => {})
    );
    const request = vi.spyOn(https, 'request').mockImplementation(() => {
      throw new Error('network forbidden');
    });
    const results = [
      auxiliaryModelForTask('conversation_name', guardedMain, opt),
      auxiliaryModelForTask('chat', guardedMain, opt),
      auxiliaryModelForTask('reminder_copy', guardedMain)
    ];
    expect(secretRead).not.toHaveBeenCalled();
    expect(request).not.toHaveBeenCalled();
    output.forEach((spy) => expect(spy).not.toHaveBeenCalled());
    expect(results[0].model).toBe('glm-4.7-flash');
    expect(guardedMain.model).toBe('glm-4.7');
    expect(guardedMain.endpoint).toBe(main.endpoint);
    expect(JSON.stringify(results)).not.toMatch(/apiKey|keyRef|keyEnv|vault|synthetic-value/);
    results.forEach((result) => expect(Object.keys(result).sort()).toEqual(['model', 'reason', 'useAuxiliary']));
  });
});
