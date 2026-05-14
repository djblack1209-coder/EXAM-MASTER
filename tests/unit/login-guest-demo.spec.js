import { describe, expect, it } from 'vitest';

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('登录页生产入口', () => {
  const source = readFileSync(resolve('src/pages/login/index.vue'), 'utf8');

  it('不再暴露游客示例题库试用入口', () => {
    expect(source).not.toContain('id="e2e-login-demo-btn"');
    expect(source).not.toContain('handleGuestDemoPractice');
    expect(source).not.toContain('@/utils/practice/demo-bank.js');
    expect(source).not.toContain('先体验示例题');
  });

  it('登录页品牌图不再引用旧吉祥物资源', () => {
    expect(source).not.toMatch(/mascot-owl|login-mascot|getAssetUrl\('illustrations', 'mascot/i);
    expect(source).toContain("getAssetUrl('images', 'logo')");
  });
});
