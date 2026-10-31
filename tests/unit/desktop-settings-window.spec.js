import { afterEach, expect, it, vi } from 'vitest';
import { openDesktopSettings, restoreDesktopSettingsFocus } from '@/services/desktop/windows.js';
import { invoke } from '@tauri-apps/api/core';
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));
afterEach(() => {
  restoreDesktopSettingsFocus();
  vi.clearAllMocks();
  document.body.innerHTML = '';
});
it('coalesces rapid opens and queues panel changes without constructing another native window', async () => {
  let release;
  invoke
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = resolve;
        })
    )
    .mockResolvedValue(undefined);
  const first = openDesktopSettings('settings');
  expect(openDesktopSettings('settings')).toBe(first);
  const next = openDesktopSettings('connectors');
  await vi.waitFor(() => expect(invoke).toHaveBeenCalledTimes(1));
  release();
  await Promise.all([first, next]);
  expect(invoke.mock.calls).toEqual([
    ['open_desktop_settings', { panel: 'settings' }],
    ['open_desktop_settings', { panel: 'connectors' }]
  ]);
});
it('returns focus to the original input and retains its draft when settings closes', async () => {
  document.body.innerHTML = '<textarea>未提交的原答</textarea><button>设置</button>';
  const input = document.querySelector('textarea');
  input.focus();
  invoke.mockResolvedValue(undefined);
  await openDesktopSettings('settings');
  document.querySelector('button').focus();
  restoreDesktopSettingsFocus();
  expect(document.activeElement).toBe(input);
  expect(input.value).toBe('未提交的原答');
});
it('rejects unknown panels before invoking native code', async () => {
  await expect(openDesktopSettings('remote')).rejects.toThrow();
  expect(invoke).not.toHaveBeenCalled();
});
