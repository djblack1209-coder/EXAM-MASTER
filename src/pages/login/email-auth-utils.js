export function normalizeEmailAddress(email) {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

export function getRetryCooldownSeconds(retryAfter, fallback = 60) {
  const parsed = Number(retryAfter);
  if (Number.isFinite(parsed) && parsed > 0) {
    return Math.max(1, Math.ceil(parsed));
  }
  return fallback;
}

export function resolveEmailAuthErrorMessage(message, isRegisterMode = false) {
  const rawMessage = String(message || '').trim();

  if (!rawMessage) {
    return '操作失败';
  }

  if (rawMessage.includes('密码强度不足')) {
    return rawMessage.replace('密码强度不足:', '密码强度不足：');
  }

  if (rawMessage.includes('验证码')) {
    return '验证码错误或已过期';
  }

  if (rawMessage.includes('已注册') || rawMessage.includes('已存在')) {
    return '该邮箱已注册，请直接登录';
  }

  if (rawMessage.includes('不存在') || rawMessage.includes('未注册')) {
    return '该邮箱未注册，请先注册';
  }

  if (rawMessage.includes('频繁')) {
    return '操作太频繁，请稍后再试';
  }

  if (rawMessage.includes('密码')) {
    return isRegisterMode ? rawMessage : '邮箱或密码错误';
  }

  return rawMessage;
}
