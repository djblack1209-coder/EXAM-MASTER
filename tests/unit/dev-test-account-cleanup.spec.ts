import { beforeEach, expect, it, vi } from 'vitest';
const fixture = vi.hoisted(() => ({ rows: new Map<string, any>(), dev: true }));
vi.mock('../../laf-backend/functions/_shared/build-channel', () => ({
  get DEV_TEST() {
    return fixture.dev;
  }
}));
vi.mock('../../laf-backend/functions/_shared/auth-middleware', () => ({
  requireAuth: () => ({ userId: 'fixture-owner' }),
  isAuthError: () => false
}));
vi.mock('../../laf-backend/functions/_shared/api-response', () => ({
  createLogger: () => ({ info() {}, warn() {}, error() {} }),
  checkRateLimitDistributed: async () => ({ allowed: true })
}));
vi.mock('@lafjs/cloud', () => ({
  default: {
    database: () => ({
      command: { or: (clauses: any[]) => ({ $or: clauses }) },
      collection: (name: string) => {
        const query = (filter: any) => {
          const matches = () =>
            [...fixture.rows].filter(
              ([key, row]) =>
                key.startsWith(`${name}:`) &&
                (filter.$or
                  ? filter.$or.some((clause: any) => Object.entries(clause).every(([k, v]) => row[k] === v))
                  : Object.entries(filter).every(([k, v]) => row[k] === v))
            );
          return {
            get: async () => ({ data: matches().map(([, value]) => structuredClone(value)) }),
            update: async (patch: any) => {
              const rows = matches();
              rows.forEach(([key, row]) => fixture.rows.set(key, { ...row, ...patch }));
              return { updated: rows.length };
            },
            remove: async () => {
              const rows = matches();
              rows.forEach(([key]) => fixture.rows.delete(key));
              return { deleted: rows.length };
            }
          };
        };
        return {
          where: query,
          doc: (id: string) => ({
            get: async () => ({ data: fixture.rows.get(`${name}:${id}`) }),
            update: async (patch: any) => {
              fixture.rows.set(`${name}:${id}`, { ...fixture.rows.get(`${name}:${id}`), ...patch });
              return { updated: 1 };
            },
            remove: async () => {
              fixture.rows.delete(`${name}:${id}`);
            }
          }),
          add: async (row: any) => {
            fixture.rows.set(`${name}:${row._id}`, structuredClone(row));
          }
        };
      }
    })
  }
}));
import deleteAccount from '../../laf-backend/functions/account-delete';
beforeEach(() => {
  fixture.dev = true;
  fixture.rows.clear();
  fixture.rows.set('users:fixture-owner', { _id: 'fixture-owner' });
  fixture.rows.set('users:other-owner', { _id: 'other-owner' });
  fixture.rows.set('learning_accounts:account', {
    _id: 'account',
    user_id: 'fixture-owner',
    cost: { spent: 0, pending: 1 },
    entitlement: { spent: 0 },
    calls: [
      {
        id: 'receipt',
        status: 'failed',
        costStatus: 'pending',
        actualCost: null,
        usage: { prompt_tokens: 10 },
        result: { message: 'private teaching' }
      }
    ]
  });
  fixture.rows.set('learning_model_keys:private', {
    _id: 'private',
    user_id: 'fixture-owner',
    vault: 'never-export-credential'
  });
});
it('deletes an idle test account through the normal endpoint and retains only usage/cost receipts', async () => {
  const result = await deleteAccount({ body: { action: 'request' } });
  expect(result).toMatchObject({ success: true, data: { deleted: true, billingRetained: true } });
  expect(fixture.rows.has('users:fixture-owner')).toBe(false);
  expect(fixture.rows.has('users:other-owner')).toBe(true);
  expect(fixture.rows.has('learning_model_keys:private')).toBe(false);
  const receipt = [...fixture.rows].find(([key]) => key.startsWith('learning_billing_receipts:'))?.[1];
  expect(receipt.calls[0]).toMatchObject({ costStatus: 'pending', actualCost: null, usage: { prompt_tokens: 10 } });
  expect(JSON.stringify(receipt)).not.toContain('private teaching');
  expect(JSON.stringify(receipt)).not.toContain('never-export-credential');
});
it('does not delete or export while a test request is in flight', async () => {
  fixture.rows.get('learning_accounts:account').calls[0].status = 'reserved';
  const before = JSON.stringify([...fixture.rows]);
  expect(await deleteAccount({ body: { action: 'request' } })).toMatchObject({
    success: false,
    error: 'REQUEST_PENDING'
  });
  expect(JSON.stringify([...fixture.rows])).toBe(before);
});
it('production keeps the seven-day cancellation period and does not purge on request', async () => {
  fixture.dev = false;
  expect(await deleteAccount({ body: { action: 'request' } })).toMatchObject({
    success: true,
    data: { coolingDays: 7 }
  });
  expect(fixture.rows.has('users:fixture-owner')).toBe(true);
  expect([...fixture.rows.keys()].some((key) => key.startsWith('learning_billing_receipts:'))).toBe(false);
});
