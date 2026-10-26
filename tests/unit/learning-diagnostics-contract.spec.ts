import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  boundedResponseDiagnostics,
  checkResponseDiagnostics,
  canCaptureResponseDiagnostics,
  responseDiagnosticPolicy,
  isDiagReadable,
  projectResponseDiagnostics,
  DIAGNOSTIC_VERSION,
  DIAGNOSTIC_TTL_MS,
  newAccount,
  reserveCall,
  settleCall,
  mutateAccount,
  type DiagnosticPolicy
} from '../../laf-backend/functions/_shared/learning-account';
import { modelResultPolicy } from '../../laf-backend/functions/_shared/learning-model-resources';

// All inputs are handwritten fixtures. No environment switch, database or network is enabled.
const OWNER = 'qa-fixture-owner';
const NOW = 1700000000000;
const open: DiagnosticPolicy = { devTest: true, production: false, capture: true, ownerRead: true, owners: [OWNER] };
const resultPolicy = modelResultPolicy('');
const diag = (extra = {}) => ({ version: DIAGNOSTIC_VERSION, capturedAt: NOW, failureStage: 'schema', ...extra });
const input = (id: string) => ({ id, fingerprint: id, source: 'byok', model: 'fixture', maxCost: 0, units: 0 });
const reserved = (id: string) => reserveCall(newAccount(OWNER), input(id), NOW, resultPolicy).account;
const failure = { success: false, actualCost: 0, responseDiagnostics: diag() };
afterEach(() => vi.restoreAllMocks());

describe('诊断v2默认关闭离线合同', () => {
  it('实测最长合法元数据并保持新对象、闭合与固定事件码', () => {
    const maximum: any = diag({ capturedAt: Number.MAX_SAFE_INTEGER, failureStage: 'http_envelope', httpStatus: 599 });
    for (const name of [
      'envelopeType',
      'choicesType',
      'choiceType',
      'messageType',
      'contentType',
      'reasoning_contentType',
      'reasoningType',
      'thinkingType',
      'finishReasonType',
      'expectedType',
      'actualType'
    ])
      maximum[name] = 'invalid_json';
    for (const name of [
      'responseBytes',
      'contentChars',
      'reasoning_contentChars',
      'reasoningChars',
      'thinkingChars',
      'syntaxPosition'
    ])
      maximum[name] = 2097152;
    Object.assign(maximum, {
      failureStage: 'json_parse',
      positionUnit: 'utf16_code_unit',
      networkStage: 'received',
      mimeCategory: 'missing',
      envelopeJson: 'invalid',
      finishReason: 'content_filter',
      startToken: 'object',
      syntaxEnd: false,
      hasJsonFence: false,
      hasThinkingPrefix: false,
      hasBom: false
    });
    const copy = boundedResponseDiagnostics(maximum);
    expect(copy).not.toBe(maximum);
    expect(copy).toEqual(maximum);
    const bytes = Buffer.byteLength(JSON.stringify(copy));
    expect(bytes).toBeLessThanOrEqual(1024);
    console.info(`DIAG_FIXTURE_MAX_BYTES=${bytes}`);
    const cyclic: any = diag();
    cyclic.content = cyclic;
    let accessed = 0;
    const accessor = Object.defineProperty(diag(), 'httpStatus', {
      enumerable: true,
      get: () => {
        accessed++;
        throw new Error('fixture');
      }
    });
    for (const invalid of [
      null,
      [],
      cyclic,
      accessor,
      { ...diag(), raw: 'fixture-private' },
      diag({ responseBytes: Infinity }),
      diag({ httpStatus: 0 }),
      diag({ contentChars: 1.5 }),
      diag({ syntaxEnd: null }),
      diag({ failureStage: 'transport' }),
      diag({ version: 'legacy' }),
      diag({ syntaxPosition: 1 }),
      diag({ syntaxPosition: 1, positionUnit: 'byte' })
    ]) {
      const checked = checkResponseDiagnostics(invalid);
      expect(checked).toEqual({ diagnostic: null, event: 'DIAG_OMITTED_SCHEMA' });
      expect(JSON.stringify(checked)).not.toContain('fixture-private');
    }
    expect(accessed).toBe(0);
  });

  it('生产、关闭、取消、成功和多owner不写，异常诊断不影响结算', () => {
    expect(responseDiagnosticPolicy()).toMatchObject({ capture: false, ownerRead: false });
    const variants = [
      { ...open, production: true },
      { ...open, devTest: false },
      { ...open, capture: false },
      { ...open, ownerRead: false },
      { ...open, owners: [] },
      { ...open, owners: [OWNER, 'other'] },
      { ...open, owners: ['other'] }
    ];
    for (const policy of variants) {
      expect(canCaptureResponseDiagnostics(OWNER, policy)).toBe(false);
      expect(settleCall(reserved('gate'), 'gate', failure, NOW, resultPolicy, policy).call).not.toHaveProperty(
        'responseDiagnostics'
      );
    }
    for (const extra of [{ success: true }, { cancelled: true }])
      expect(
        settleCall(reserved('status'), 'status', { ...failure, ...extra }, NOW, resultPolicy, open).call
      ).not.toHaveProperty('responseDiagnostics');
    const events = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const original = reserved('bad');
    const baseline = settleCall(original, 'bad', failure, NOW, resultPolicy, { ...open, capture: false });
    const rejected = settleCall(
      original,
      'bad',
      { ...failure, responseDiagnostics: diag({ message: 'fixture-private' }) },
      NOW,
      resultPolicy,
      open
    );
    expect(rejected.account).toEqual(baseline.account);
    expect(events).toHaveBeenCalledExactlyOnceWith('DIAG_OMITTED_SCHEMA');
  });

  it('第32份写入、第33份停写，过期新版本仍占位，遗留不计数不删除', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const account = newAccount(OWNER);
    account.calls = Array.from({ length: 31 }, (_, i) => ({
      id: `old${i}`,
      status: 'failed',
      responseDiagnostics: diag({ capturedAt: 1 })
    }));
    account.calls.push({ id: 'legacy', status: 'failed', responseDiagnostics: { httpStatus: 500 } });
    const first = settleCall(
      reserveCall(account, input('32'), NOW, resultPolicy).account,
      '32',
      failure,
      NOW,
      resultPolicy,
      open
    ).account;
    expect(first.calls.at(-1).responseDiagnostics).toEqual(diag());
    const second = settleCall(
      reserveCall(first, input('33'), NOW, resultPolicy).account,
      '33',
      failure,
      NOW,
      resultPolicy,
      open
    ).account;
    expect(second.calls.at(-1)).not.toHaveProperty('responseDiagnostics');
    expect(second.calls.slice(0, 32)).toEqual(account.calls);
    expect(console.warn).toHaveBeenCalledWith('DIAG_OMITTED_CAPACITY');
  });

  it('CAS竞争后重新计数，不追加第二次写或抹去账单', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    let account: any = reserved('race');
    account.calls.unshift(
      ...Array.from({ length: 31 }, (_, i) => ({ id: `old${i}`, status: 'failed', responseDiagnostics: diag() }))
    );
    let updates = 0;
    const db = {
      collection: () => ({
        where: (query: any) => ({
          get: async () => ({ data: [structuredClone(account)] }),
          update: async (next: any) => {
            updates++;
            if (updates === 1) {
              account.calls.push({ id: 'concurrent', status: 'failed', responseDiagnostics: diag() });
              account.revision++;
              return { updated: 0 };
            }
            if (account.revision !== query.revision) return { updated: 0 };
            account = { ...account, ...structuredClone(next) };
            return { updated: 1 };
          }
        }),
        add: vi.fn(() => {
          throw new Error('Unexpected fixture insert');
        })
      })
    };
    const beforeCost = structuredClone(account.cost);
    const settled = await mutateAccount(db, OWNER, (fresh) =>
      settleCall(fresh, 'race', failure, NOW, resultPolicy, open)
    );
    expect(updates).toBe(2);
    expect(settled.call).not.toHaveProperty('responseDiagnostics');
    expect(account.calls.filter((call: any) => boundedResponseDiagnostics(call.responseDiagnostics))).toHaveLength(32);
    expect(account.cost).toEqual(beforeCost);
  });

  it('24小时、未来和遗留只影响可读性，不修改数据或越过owner/requestId', () => {
    const value = diag();
    expect(isDiagReadable(value, NOW + DIAGNOSTIC_TTL_MS - 1)).toBe(true);
    expect(isDiagReadable(value, NOW + DIAGNOSTIC_TTL_MS)).toBe(false);
    expect(isDiagReadable(value, NOW - 1)).toBe(false);
    expect(isDiagReadable({ httpStatus: 500 }, NOW)).toBe(false);
    const account = {
      user_id: OWNER,
      calls: [{ id: 'own', status: 'failed', errorCode: 'untrusted-fixture', responseDiagnostics: value }]
    };
    const before = JSON.stringify(account);
    expect(projectResponseDiagnostics(account, 'own', OWNER, NOW, open)).toEqual({
      diagnosticsState: 'available',
      responseDiagnostics: value
    });
    expect(projectResponseDiagnostics(account, 'missing', OWNER, NOW, open)).toEqual({
      diagnosticsState: 'unavailable'
    });
    expect(projectResponseDiagnostics({ ...account, user_id: 'other' }, 'own', OWNER, NOW, open)).toEqual({});
    expect(projectResponseDiagnostics(account, 'own', OWNER, NOW, { ...open, ownerRead: false })).toEqual({});
    expect(projectResponseDiagnostics(account, 'own', OWNER, NOW + DIAGNOSTIC_TTL_MS, open)).toEqual({
      diagnosticsState: 'unavailable'
    });
    expect(JSON.stringify(projectResponseDiagnostics(account, 'own', OWNER, NOW, open))).not.toContain(
      'untrusted-fixture'
    );
    expect(JSON.stringify(account)).toBe(before);
  });
});
