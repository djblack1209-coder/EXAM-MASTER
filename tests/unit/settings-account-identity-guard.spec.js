import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const settingsSource = readFileSync(resolve(process.cwd(), 'src/pages/settings/index.vue'), 'utf8');

describe('settings account identity guard', () => {
  it('uses a normalized account identity for login badge and deletion entry visibility', () => {
    expect(settingsSource).toContain('const currentUserId = computed(() =>');
    expect(settingsSource).toContain('const isAccountLoggedIn = computed(() => Boolean(currentUserId.value))');

    expect(settingsSource).toContain('v-if="!isAccountLoggedIn" class="login-badge"');
    expect(settingsSource).toContain('v-if="isAccountLoggedIn" class="delete-account-section"');

    expect(settingsSource).not.toContain('v-if="!userInfo.uid" class="login-badge"');
    expect(settingsSource).not.toContain('v-if="userInfo.uid" class="delete-account-section"');
  });

  it('recognizes all supported restored user id shapes before account deletion status checks', () => {
    expect(settingsSource).toContain('return info.uid || info._id || info.userId || info.id');
    expect(settingsSource).toContain("storageService.get('EXAM_USER_ID', null)");
    expect(settingsSource).toContain('if (isAccountLoggedIn.value) {');
    expect(settingsSource).toContain('checkDeletionStatus();');
  });

  it('saves the normalized user id after local profile edits', () => {
    expect(settingsSource).toContain('const ensureLocalUserId = () =>');
    expect(settingsSource).toContain('userInfo.value.uid = `USER_${hex}`');
    expect(settingsSource).toContain("storageService.save('EXAM_USER_ID', currentUserId.value, true)");
    expect(settingsSource).not.toContain("storageService.save('EXAM_USER_ID', userInfo.value.uid, true)");
  });
});
