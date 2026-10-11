import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const profileSource = readFileSync(resolve(process.cwd(), 'src/pages/profile/index.vue'), 'utf8');
const privacySource = readFileSync(resolve(process.cwd(), 'src/pages/settings/privacy.vue'), 'utf8');
const termsSource = readFileSync(resolve(process.cwd(), 'src/pages/settings/terms.vue'), 'utf8');

describe('settings legal and privacy scope', () => {
  it('exposes direct profile entries for privacy policy and user agreement', () => {
    expect(profileSource).toContain("goTo('/pages/settings/privacy')");
    expect(profileSource).toContain("goTo('/pages/settings/terms')");
    expect(profileSource).toContain("t('dashboard.copy106')");
    expect(profileSource).toContain("t('dashboard.copy107')");
  });

  it('keeps privacy policy aligned with the lightweight quiz product scope', () => {
    expect(privacySource).toContain('刷题记录、错题本、收藏和题库同步状态');
    expect(privacySource).toContain('刷题、复习和结果回顾');
    expect(privacySource).toContain('账号注销流程申请删除账号相关数据');
    expect(privacySource).toContain('7天冷静期');
    expect(privacySource).not.toContain('智能推荐题目');
    expect(privacySource).not.toContain('院校招生信息');
    expect(privacySource).not.toContain('升学保证');
  });

  it('keeps user agreement aligned with current mini-program capabilities', () => {
    expect(termsSource).toContain('公共课真题练习、错题复习、收藏和学习进度管理');
    expect(termsSource).toContain('学习辅助');
    expect(termsSource).toContain('考试通过承诺');
    expect(termsSource).not.toContain('择校分析');
    expect(termsSource).not.toContain('智能辅导');
    expect(termsSource).not.toContain('录取保证');
  });
});
