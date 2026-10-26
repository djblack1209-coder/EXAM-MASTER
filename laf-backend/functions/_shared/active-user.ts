// Signature validity alone does not prove the account still exists after deletion.
// Query only the authenticated owner and fail closed without treating DB outages as logout.
export async function requireActiveUser(database: any, userId: string) {
  try {
    const user = (await database.collection('users').where({ _id: userId }).get()).data?.[0];
    if (
      !user ||
      user.is_deleted === true ||
      ['deleted', 'blocked'].includes(user.status) ||
      user.account_status === 'deleted'
    )
      return { code: 401, success: false, errorCode: 'ACCOUNT_UNAVAILABLE', message: '账户不可用，请重新登录' };
    return null;
  } catch {
    return {
      code: 503,
      success: false,
      errorCode: 'AUTH_CHECK_UNAVAILABLE',
      message: '账户服务暂时不可用，请稍后重试'
    };
  }
}
