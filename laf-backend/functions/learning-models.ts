import cloud from '@lafjs/cloud';
import crypto from 'node:crypto';
import { requireAuth, isAuthError } from './_shared/auth-middleware.js';
import { checkRateLimitDistributed } from './_shared/api-response.js';
import proxyAI, { configuredModels } from './proxy-ai.js';
import { FREE_MODEL_PRESETS, modelConnectionState } from './_shared/ai-providers/free-model-presets.js';
import {
  mutateAccount,
  encryptModelKey,
  recoverStaleReservations,
  cancelCall,
  byokCallLimit
} from './_shared/learning-account.js';
import { validateCloudEndpoint } from './_shared/ai-providers/learning-provider.js';
import { refreshSubscriptionEntitlement } from './_shared/learning-subscription.js';
import { cancelActiveLearningCall } from './_shared/learning-model-runtime.js';
import {
  maintainModelResources,
  modelResultPolicy,
  modelResultUnavailable
} from './_shared/learning-model-resources.js';

export default async function (ctx: any) {
  const auth = requireAuth(ctx);
  if (isAuthError(auth)) return auth;
  const limit = await checkRateLimitDistributed(`learning-models:${auth.userId}`, 30, 60000);
  if (!limit.allowed) return { code: 429, success: false, message: '请求过于频繁' };
  const db = cloud.database();
  const body = ctx.body || {};
  try {
    if (body.action === 'test') {
      if (typeof body.modelId !== 'string' || body.shareConsent !== true)
        return { code: 400, success: false, message: '连接测试会真实调用指定模型，需明确确认' };
      return proxyAI({
        ...ctx,
        body: {
          modelId: body.modelId,
          requestId: body.requestId,
          shareConsent: true,
          messages: [
            {
              role: 'user',
              content: '这是连接测试，不是学习作答。仅返回JSON：message为“连接成功”，question为null，tools为空数组。'
            }
          ],
          learningContext: { owner: auth.userId, purpose: 'connection_test' }
        }
      });
    }
    if (body.action === 'result') {
      if (typeof body.requestId !== 'string' || !/^[a-zA-Z0-9_:-]{1,160}$/.test(body.requestId))
        return { code: 400, success: false, message: '请求标识不合法' };
      const id = `learning_${crypto.createHash('sha256').update(auth.userId).digest('hex')}`;
      const account = (await db.collection('learning_accounts').where({ _id: id, user_id: auth.userId }).get())
        .data?.[0];
      const policy = modelResultPolicy();
      const maintained = account
        ? await mutateAccount(db, auth.userId, (a) => maintainModelResources(a, Date.now(), policy))
        : null;
      const call = maintained?.account.calls.find((c: any) => c.id === body.requestId);
      if (!call) return { code: 404, success: false, message: '本账户没有此模型请求' };
      if (call.resultDeletedAt) return modelResultUnavailable(call, Date.now(), policy);
      if (call.status === 'completed')
        return (
          modelResultUnavailable(call, Date.now(), policy) || {
            code: 0,
            success: true,
            data: call.result,
            reused: true
          }
        );
      return {
        code: call.status === 'reserved' ? 409 : call.status === 'cancelled' ? 499 : 503,
        success: false,
        status: call.status,
        message:
          call.status === 'reserved'
            ? '模型任务仍在执行，尚无可用结果；读取不会重试模型'
            : '模型任务未完成或已取消，没有可应用的结果；请查看实际用量'
      };
    }
    if (body.action === 'cancel') {
      const { call } = await mutateAccount(db, auth.userId, (account) => cancelCall(account, body.requestId));
      cancelActiveLearningCall(auth.userId, body.requestId);
      return {
        code: 0,
        success: true,
        data: {
          requestId: call.id,
          cancellationRecorded: Boolean(call.cancelRequestedAt),
          status: call.status,
          executionStopped: call.costStatus === 'not_called'
        }
      };
    }
    if (body.action === 'list' || body.action === 'usage') {
      const policy = modelResultPolicy();
      const { account, cache } = await mutateAccount(db, auth.userId, (account) =>
        maintainModelResources(
          refreshSubscriptionEntitlement(recoverStaleReservations(account).account, Date.now()),
          Date.now(),
          policy
        )
      );
      if (body.action === 'usage')
        return {
          code: 0,
          success: true,
          data: {
            entitlement: account.entitlement,
            cost: account.cost,
            resultCache: cache,
            byokBudget: {
              limit: byokCallLimit(),
              used: account.calls.filter((call: any) => call.source === 'byok').length,
              pendingCosts: account.calls.filter((call: any) => call.source === 'byok' && call.costStatus === 'pending')
                .length
            },
            calls: account.calls.map(({ result, fingerprint, ...call }: any) => call),
            commercialEnabled: false,
            policyStatus: 'development_unconfirmed'
          }
        };
      const redact = (configured: any) => {
        const { apiKey, vault, keyRef, keyEnv, ...model } = configured;
        return {
          ...model,
          configured: Boolean(apiKey || keyRef),
          ...modelConnectionState(configured, account.calls),
          dataFlow: 'client_to_backend_to_named_provider'
        };
      };
      return {
        code: 0,
        success: true,
        data: {
          models: [...configuredModels(), ...account.profiles].map(redact),
          platformEnabled: process.env.LEARNING_PLATFORM_CALLS_ENABLED === 'true',
          coreLearningFree: true,
          keyStorage: 'server_aes_gcm',
          whoCanDecrypt: 'deployment_operator_with_vault_key',
          commercialEnabled: false,
          resultCache: cache,
          presets: FREE_MODEL_PRESETS
        }
      };
    }
    if (body.action === 'save') {
      const p = body.profile;
      if (
        !p ||
        !/^[a-zA-Z0-9_-]{1,60}$/.test(p.id) ||
        typeof p.model !== 'string' ||
        !p.model ||
        p.model.length > 120 ||
        typeof p.apiKey !== 'string' ||
        !p.apiKey.trim() ||
        p.apiKey.length > 500 ||
        body.shareConsent !== true
      ) {
        return { code: 400, success: false, message: '模型配置不合法或未确认服务端保存密钥' };
      }
      validateCloudEndpoint(p.endpoint, (process.env.LEARNING_ALLOWED_ORIGINS || '').split(',').filter(Boolean));
      const preset = FREE_MODEL_PRESETS.find((item) => item.model === p.model && item.endpoint === p.endpoint);
      const keyRef = `model_key_${crypto.randomUUID()}`;
      const vault = encryptModelKey(p.apiKey, auth.userId, p.id, process.env.LEARNING_VAULT_KEY || '');
      const profile = {
        id: p.id,
        provider: String(p.provider || 'custom').slice(0, 80),
        model: p.model,
        endpoint: p.endpoint,
        source: 'byok',
        maxOutput: 1000,
        // 默认能力保守，协议兼容不等于视觉或原生工具可用。
        capabilities: {
          structured: p.structured === true,
          tools: false,
          vision: p.vision === true,
          stream: p.stream === true
        },
        ...(p.vision === true ? { visionAdapter: 'openai-image-url-v1' as const } : {}),
        keyRef,
        ...(preset ? { pricing: preset.pricing, terms: preset.terms, privacy: preset.privacy } : {})
      };
      await db.collection('learning_model_keys').add({ _id: keyRef, user_id: auth.userId, profile_id: p.id, vault });
      const replacedRefs = new Set<string>();
      try {
        await mutateAccount(db, auth.userId, (account) => {
          if (account.profiles.length >= 5 && !account.profiles.some((item: any) => item.id === p.id))
            throw new Error('PROFILE_LIMIT');
          account.profiles
            .filter((item: any) => item.id === p.id)
            .forEach((item: any) => replacedRefs.add(item.keyRef));
          account.profiles = [...account.profiles.filter((item: any) => item.id !== p.id), profile];
          return { account };
        });
      } catch (error) {
        await db.collection('learning_model_keys').where({ _id: keyRef, user_id: auth.userId }).remove();
        throw error;
      }
      for (const ref of replacedRefs)
        if (ref && ref !== keyRef)
          await db.collection('learning_model_keys').where({ _id: ref, user_id: auth.userId }).remove();
      return { code: 0, success: true, data: { id: profile.id, keySaved: true, connectionStatus: 'untested' } };
    }
    if (body.action === 'delete' && typeof body.profileId === 'string') {
      const removedRefs = new Set<string>();
      await mutateAccount(db, auth.userId, (account) => {
        account.profiles.filter((p: any) => p.id === body.profileId).forEach((p: any) => removedRefs.add(p.keyRef));
        account.profiles = account.profiles.filter((p: any) => p.id !== body.profileId);
        return { account };
      });
      for (const ref of removedRefs)
        if (ref) await db.collection('learning_model_keys').where({ _id: ref, user_id: auth.userId }).remove();
      return { code: 0, success: true, data: { removed: true, backups: '需按部署备份保留政策到期清除' } };
    }
    return { code: 400, success: false, message: '不支持的模型操作' };
  } catch (error: any) {
    return {
      code: 503,
      success: false,
      error: error.code || 'CONFIG_FAILED',
      message: '模型配置未保存，请检查服务端保险库和端点白名单'
    };
  }
}
