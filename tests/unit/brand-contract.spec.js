import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { BRAND } from '@/config/brand.js';
import { ASSETS } from '@/config/static-assets.js';

describe('品牌显示与兼容合同', () => {
  it('H5、App、页面与 PWA 使用同一显示身份，技术标识保留', () => {
    const manifest = JSON.parse(readFileSync('src/manifest.json', 'utf8'));
    const pages = JSON.parse(readFileSync('src/pages.json', 'utf8'));
    expect(manifest.name).toBe(BRAND.name);
    expect(manifest.h5.title).toBe(BRAND.title);
    expect(pages.globalStyle.navigationBarTitleText).toBe('%pages.home%');
    for (const locale of ['zh-Hans', 'en']) {
      const labels = JSON.parse(readFileSync(`src/locale/${locale}.json`, 'utf8'));
      expect(labels['pages.home']).toBe(manifest.name);
    }
    expect(readFileSync('index.html', 'utf8')).toContain(`<title>${BRAND.title}</title>`);
    expect(readFileSync('vite.config.js', 'utf8')).toContain('short_name: BRAND.name');
    expect(JSON.parse(readFileSync('package.json', 'utf8')).name).toBe('yozi-ai');
    expect(manifest.appid).toBe('__UNI__8601AE2');
    const native = JSON.parse(readFileSync('src-tauri/tauri.conf.json', 'utf8'));
    expect(native.productName).toBe(BRAND.name);
    expect(native.identifier).toBe('cn.wangshiliang.wenli');
    expect(native.app.windows[0].title).toBe(BRAND.name);
  });
  it('品牌 PNG 可安装尺寸正确，分享沿当前 Logo，官方 SVG 保持本地', () => {
    for (const [path, size] of [
      ['src/static/images/logo.png', 256],
      ['public/static/pwa-icons/icon-192x192.png', 192],
      ['public/static/pwa-icons/icon-512x512.png', 512],
      ['public/static/pwa-icons/icon-512x512-maskable.png', 512]
    ]) {
      const png = readFileSync(path);
      expect(png.readUInt32BE(16)).toBe(size);
      expect(png.readUInt32BE(20)).toBe(size);
    }
    expect(ASSETS.logo).toBe(BRAND.icon);
    expect(ASSETS.appShareCover).toBe(BRAND.icon);
    expect(readFileSync(`src${BRAND.mark}`).length).toBeGreaterThan(0);
    for (const name of ['apple', 'google-g', 'wechat']) {
      const svg = readFileSync(`src/static/brand/${name}.svg`, 'utf8');
      expect(svg).toContain('viewBox=');
      expect(svg).not.toMatch(/<script|<foreignObject|@import|<text\b/i);
      expect(svg).not.toMatch(/\bhref="(?:https?:|file:|javascript:)/i);
    }
  });
});
