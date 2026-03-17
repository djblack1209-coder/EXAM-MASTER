import { describe, expect, it } from 'vitest';

import {
  getRetryCooldownSeconds,
  normalizeEmailAddress,
  resolveEmailAuthErrorMessage
} from '../../src/pages/login/email-auth-utils.js';

describe('email-auth-utils', () => {
  it('normalizes email to lowercase and trims spaces', () => {
    expect(normalizeEmailAddress(' Test.User@Example.COM ')).toBe('test.user@example.com');
  });

  it('keeps retry cooldown from backend when present', () => {
    expect(getRetryCooldownSeconds(42)).toBe(42);
    expect(getRetryCooldownSeconds('18')).toBe(18);
    expect(getRetryCooldownSeconds(undefined)).toBe(60);
  });

  it('keeps password strength message in register mode', () => {
    expect(resolveEmailAuthErrorMessage('密码强度不足: 密码需包含大写字母', true)).toBe(
      '密码强度不足： 密码需包含大写字母'
    );
  });

  it('maps generic password errors for login mode', () => {
    expect(resolveEmailAuthErrorMessage('密码错误', false)).toBe('邮箱或密码错误');
  });

  it('maps verification and existence errors to friendly copy', () => {
    expect(resolveEmailAuthErrorMessage('验证码已过期', true)).toBe('验证码错误或已过期');
    expect(resolveEmailAuthErrorMessage('该邮箱已存在', true)).toBe('该邮箱已注册，请直接登录');
    expect(resolveEmailAuthErrorMessage('该邮箱未注册', false)).toBe('该邮箱未注册，请先注册');
  });
});
