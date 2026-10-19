export class TrialError extends Error {
  code = 'TRIAL_CLOSED';
}
export function friendTrialPolicy(env = process.env) {
  if (env.LEARNING_FRIEND_TRIAL_ENABLED !== 'true') return null;
  const cap = Number(env.LEARNING_TRIAL_USER_LIMIT || 0);
  const emails = [
    ...new Set(
      String(env.LEARNING_TRIAL_EMAILS || '')
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean)
    )
  ];
  if (
    !Number.isInteger(cap) ||
    cap < 1 ||
    cap > 1000 ||
    !emails.length ||
    emails.length > cap ||
    emails.some((s) => s.length > 254 || !/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(s))
  )
    throw new TrialError('朋友试用尚未开放，请联系邀请人');
  // 白名单本身占用名额；更换名单会立即撤销旧名单的模型访问，不会累计放大人数上限。
  return { cap, emails };
}
export function assertTrialEmail(email: unknown, env = process.env) {
  const policy = friendTrialPolicy(env);
  if (policy && (typeof email !== 'string' || !policy.emails.includes(email.trim().toLowerCase())))
    throw new TrialError('暂未获得朋友试用资格，请联系邀请人');
}
export async function assertTrialUser(db: any, userId: string) {
  if (!friendTrialPolicy()) return;
  const user = (await db.collection('users').where({ _id: userId }).get()).data?.[0];
  assertTrialEmail(user?.email);
}
