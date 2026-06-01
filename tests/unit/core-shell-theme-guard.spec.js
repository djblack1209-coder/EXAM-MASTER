import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(process.cwd());

const CORE_THEME_PAGES = [
  {
    file: 'src/pages/index/index.vue',
    required: [
      ":class=\"{ 'dark-mode': isDark }\"",
      "uni.$on('themeUpdate'",
      "uni.$on('updateTheme'",
      "uni.$off('themeUpdate'",
      "uni.$off('updateTheme'",
      '.page.dark-mode',
      '.dark-mode .nav-bar',
      '.dark-mode .card'
    ]
  },
  {
    file: 'src/pages/practice/index.vue',
    required: [
      ":class=\"{ 'dark-mode': isDark }\"",
      "uni.$on('themeUpdate'",
      "uni.$on('updateTheme'",
      "uni.$off('themeUpdate'",
      "uni.$off('updateTheme'",
      '.page.dark-mode',
      '.dark-mode .nav-bar',
      '.dark-mode .card'
    ]
  },
  {
    file: 'src/pages/profile/index.vue',
    required: [
      ":class=\"{ 'dark-mode': isDark }\"",
      "uni.$on('themeUpdate'",
      "uni.$on('updateTheme'",
      "uni.$off('themeUpdate'",
      "uni.$off('updateTheme'",
      '.page.dark-mode',
      '.dark-mode .nav-bar',
      '.dark-mode .card'
    ]
  },
  {
    file: 'src/pages/settings/index.vue',
    required: [
      ":class=\"{ 'dark-mode': isDark }\"",
      "uni.$on('themeUpdate'",
      "uni.$on('updateTheme'",
      "uni.$off('themeUpdate'",
      "uni.$off('updateTheme'",
      '.settings-container.dark-mode',
      '.dark-mode .user-card',
      '.dark-mode .settings-list'
    ]
  }
];

describe('core shell theme guard', () => {
  it('keeps core pages wired to theme events and dark-mode surface coverage', () => {
    const offenders = [];

    for (const { file, required } of CORE_THEME_PAGES) {
      const source = readFileSync(resolve(ROOT, file), 'utf8');

      for (const token of required) {
        if (!source.includes(token)) {
          offenders.push(`${file} -> missing ${token}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });
});
