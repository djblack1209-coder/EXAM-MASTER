import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const logoutSource = readFileSync(resolve(process.cwd(), 'src/pages/settings/LogoutButton.vue'), 'utf8');
const settingsSource = readFileSync(resolve(process.cwd(), 'src/pages/settings/index.vue'), 'utf8');

describe('settings logout flow guard', () => {
  it('routes logout completion through safe navigation instead of direct relaunch', () => {
    expect(logoutSource).toContain("import { safeNavigateTo } from '@/utils/safe-navigate'");
    expect(logoutSource).toContain("safeNavigateTo('/pages/index/index')");
    expect(logoutSource).not.toContain("uni.reLaunch({ url: '/pages/index/index' })");
  });

  it('keeps logout clearing sensitive identity keys and broadcasting status', () => {
    expect(logoutSource).toContain("storageService.remove('userInfo')");
    expect(logoutSource).toContain("storageService.remove('EXAM_USER_ID')");
    expect(logoutSource).toContain("storageService.remove('EXAM_TOKEN')");
    expect(logoutSource).toContain("uni.$emit('loginStatusChanged', false)");
    expect(logoutSource).toContain("toast.success('已退出登录')");
  });

  it('resets account deletion state when settings receives logout', () => {
    expect(settingsSource).toContain('<LogoutButton @logged-out="handleLoggedOut" />');
    expect(settingsSource).toContain('const handleLoggedOut = () =>');
    expect(settingsSource).toContain('userInfo.value = {}');
    expect(settingsSource).toContain("deletionStatus.value = { status: 'active', remainingDays: null }");
  });
});
