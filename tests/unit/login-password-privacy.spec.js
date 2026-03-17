import { describe, expect, it } from 'vitest';

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('登录页密码输入隐私保护', () => {
  const source = readFileSync(resolve('src/pages/login/index.vue'), 'utf8');

  const extractSection = (pattern) => {
    const match = source.match(pattern);
    expect(match, `section not found for pattern: ${pattern}`).toBeTruthy();
    return match?.[0] || '';
  };

  it('邮箱登录密码输入框启用密码隐藏属性', () => {
    const loginPasswordSection = extractSection(
      /v-if="!isRegister"[\s\S]*?id="e2e-login-toggle-password"[\s\S]*?<\/view>/
    );

    expect(loginPasswordSection).toMatch(/type="text"/);
    expect(loginPasswordSection).toMatch(/:password="!showLoginPassword"/);
    expect(loginPasswordSection).toMatch(/id="e2e-login-toggle-password"/);
  });

  it('邮箱注册密码输入框启用密码隐藏属性', () => {
    const registerPasswordSection = extractSection(
      /v-if="isRegister"[\s\S]*?设置密码[\s\S]*?id="e2e-login-toggle-register-password"[\s\S]*?<\/view>/
    );

    expect(registerPasswordSection).toMatch(/type="text"/);
    expect(registerPasswordSection).toMatch(/:password="!showRegisterPassword"/);
    expect(registerPasswordSection).toMatch(/id="e2e-login-toggle-register-password"/);
  });
});
