import { describe, expect, it } from 'vitest';

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('登录页游客示例题库入口', () => {
  const source = readFileSync(resolve('src/pages/login/index.vue'), 'utf8');

  it('提供无需登录的示例题库试用入口', () => {
    expect(source).toContain('id="e2e-login-demo-btn"');
    expect(source).toContain('@tap="handleGuestDemoPractice"');
    expect(source).toContain('先体验示例题');
  });

  it('试用入口复用独立的示例题库启动流程', () => {
    expect(source).toContain("import { startGuestDemoPractice } from '@/utils/practice/demo-bank.js'");
    expect(source).toContain('const handleGuestDemoPractice = () =>');
    expect(source).toContain('startGuestDemoPractice({ destination:');
  });

  it('登录页品牌图不再引用旧吉祥物资源', () => {
    expect(source).not.toMatch(/mascot-owl|login-mascot|getAssetUrl\('illustrations', 'mascot/i);
    expect(source).toContain("getAssetUrl('images', 'logo')");
  });
});
