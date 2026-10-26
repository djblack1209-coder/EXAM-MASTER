import { expect, it, vi } from 'vitest';
import { requireActiveUser } from '../../laf-backend/functions/_shared/active-user';
const database = (user: any, fail = false) => {
  const where = vi.fn(() => ({
    get: async () => {
      if (fail) throw new Error('unit outage');
      return { data: user ? [user] : [] };
    }
  }));
  return { collection: vi.fn(() => ({ where })), where };
};
it.each([null, { is_deleted: true }, { status: 'deleted' }, { status: 'blocked' }, { account_status: 'deleted' }])(
  'rejects an absent, deleted or blocked account: %j',
  async (user) => {
    const db = database(user);
    expect(await requireActiveUser(db, 'owner')).toMatchObject({
      code: 401,
      success: false,
      errorCode: 'ACCOUNT_UNAVAILABLE'
    });
    expect(db.collection).toHaveBeenCalledExactlyOnceWith('users');
    expect(db.where).toHaveBeenCalledExactlyOnceWith({ _id: 'owner' });
  }
);
it.each([{ status: 'active' }, { account_status: 'pending_deletion' }])(
  'keeps an existing eligible account: %j',
  async (user) => {
    expect(await requireActiveUser(database(user), 'owner')).toBeNull();
  }
);
it('fails closed on DB errors without claiming credentials are invalid', async () => {
  expect(await requireActiveUser(database(null, true), 'owner')).toMatchObject({
    code: 503,
    errorCode: 'AUTH_CHECK_UNAVAILABLE'
  });
});
