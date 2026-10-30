import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { applyNativeTheme, readNativeInsets } from '@/design/native-theme.js';
import { readYoziNativeTheme } from '../../scripts/build/read-yozi-tokens.mjs';
import { tokens } from '@/design/tokens.js';

beforeEach(() => {
  uni.setNavigationBarColor = vi.fn();
  uni.setBackgroundColor = vi.fn();
  uni.setBackgroundTextStyle = vi.fn();
});
describe('native theme and capsule protection', () => {
  it.each(['light', 'dark'])('updates %s native background, text and status together', (theme) => {
    applyNativeTheme(theme);
    expect(uni.setNavigationBarColor).toHaveBeenCalledWith(
      expect.objectContaining({
        backgroundColor: tokens[theme]['--canvas'],
        frontColor: theme === 'dark' ? '#ffffff' : '#000000'
      })
    );
    expect(uni.setBackgroundColor).toHaveBeenCalledWith(
      expect.objectContaining({
        backgroundColorTop: tokens[theme]['--canvas'],
        backgroundColorBottom: tokens[theme]['--canvas']
      })
    );
  });
  it('falls back safely on old clients or rejected native API calls', () => {
    uni.setNavigationBarColor.mockImplementation(() => {
      throw Error('unsupported');
    });
    expect(() => applyNativeTheme('dark')).not.toThrow();
  });
  it('declarative themes equal the token-derived palette and all routes resolve them', () => {
    const theme = JSON.parse(readFileSync('src/theme.json', 'utf8'));
    expect(theme).toEqual(readYoziNativeTheme(tokens));
    const pages = JSON.parse(readFileSync('src/pages.json', 'utf8'));
    for (const style of [
      pages.globalStyle,
      ...pages.pages.map((p) => p.style),
      ...pages.subPackages.flatMap((p) => p.pages.map((p) => p.style))
    ]) {
      const resolved = { ...pages.globalStyle, ...style };
      expect(resolved.navigationBarBackgroundColor).toBe('@navBackground');
      expect(theme.light[resolved.navigationBarBackgroundColor.slice(1)]).toBe(tokens.light['--canvas']);
    }
  });
  it('measures status, capsule bottom and right reserve without fixed device assumptions', () => {
    uni.getWindowInfo = vi.fn(() => ({ statusBarHeight: 54, windowWidth: 390 }));
    uni.getMenuButtonBoundingClientRect = vi.fn(() => ({ left: 296, bottom: 90 }));
    expect(readNativeInsets()).toEqual({
      '--yozi-status-top': '54px',
      '--yozi-nav-top': '90px',
      '--yozi-capsule-right': '94px'
    });
  });
});
