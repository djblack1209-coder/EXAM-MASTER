/** Runtime theme contract: identifiers only; palette behavior is tested in yozi-token-mapping. */
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { applyTheme, getCurrentTheme, watchTheme } from '@/design/theme-runtime.js';
import { storageService } from '@/services/storageService.js';
vi.mock('@/services/storageService.js', () => ({ storageService: { get: vi.fn(() => null) } }));

beforeEach(() => {
  vi.clearAllMocks();
  storageService.get.mockReturnValue(null);
  document.documentElement.style.cssText = '';
  document.documentElement.removeAttribute('data-theme');
  vi.stubGlobal('uni', { getStorageSync: vi.fn(() => ''), getAppBaseInfo: vi.fn(() => ({})) });
  vi.stubGlobal('window', { matchMedia: vi.fn(() => ({ matches: false })) });
});
afterEach(() => vi.unstubAllGlobals());

describe('theme render and preference contract', () => {
  it.each(['light', 'dark'])('sets %s identifier without overriding tokens or injecting animation styles', (theme) => {
    applyTheme(theme);
    expect(document.documentElement.getAttribute('data-theme')).toBe(theme);
    expect(document.documentElement.style.cssText).toBe('');
    expect(document.getElementById('v0-animations')).toBeNull();
  });
  it.each([undefined, 'unknown', null])('falls back to light for %s', (value) => {
    applyTheme(value);
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });
  it('switches repeatedly without stale inline values', () => {
    for (let n = 0; n < 10; n++) applyTheme(n % 2 ? 'light' : 'dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(document.documentElement.style.cssText).toBe('');
  });
  it('uses explicit storage preference before system', () => {
    storageService.get.mockReturnValue('light');
    uni.getAppBaseInfo.mockReturnValue({ theme: 'dark' });
    expect(getCurrentTheme()).toBe('light');
  });
  it('supports legacy raw uni preferences', () => {
    uni.getStorageSync.mockReturnValue('dark');
    expect(getCurrentTheme()).toBe('dark');
  });
  it.each(['light', 'dark'])('follows uni system theme %s when no preference exists', (theme) => {
    uni.getAppBaseInfo.mockReturnValue({ theme });
    expect(getCurrentTheme()).toBe(theme);
  });
  it('uses browser system preference when native information is absent', () => {
    window.matchMedia.mockReturnValue({ matches: true });
    expect(getCurrentTheme()).toBe('dark');
  });
  it('uses browser fallback when native APIs fail', () => {
    uni.getStorageSync.mockImplementation(() => {
      throw Error('unsupported');
    });
    window.matchMedia.mockReturnValue({ matches: true });
    expect(getCurrentTheme()).toBe('dark');
  });
  it('defaults to light when all system information is absent', () => expect(getCurrentTheme()).toBe('light'));
  it('registers and releases the exact native theme callback', () => {
    uni.onThemeChange = vi.fn();
    uni.offThemeChange = vi.fn();
    const listener = vi.fn();
    const release = watchTheme(listener);
    const handler = uni.onThemeChange.mock.calls[0][0];
    handler({ theme: 'dark' });
    expect(listener).toHaveBeenCalledWith('dark');
    release();
    expect(uni.offThemeChange).toHaveBeenCalledWith(handler);
  });
  it('registers and releases browser media listener', () => {
    const media = { matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() };
    window.matchMedia.mockReturnValue(media);
    const listener = vi.fn();
    const release = watchTheme(listener);
    const handler = media.addEventListener.mock.calls[0][1];
    media.matches = true;
    handler();
    expect(listener).toHaveBeenCalledWith('dark');
    release();
    expect(media.removeEventListener).toHaveBeenCalledWith('change', handler);
  });
  it('is safe in the native service layer without DOM', () => {
    vi.stubGlobal('document', undefined);
    expect(() => applyTheme('dark')).not.toThrow();
  });
});
