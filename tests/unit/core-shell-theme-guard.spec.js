import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(process.cwd());

const CORE_THEME_PAGES = [
  {
    file: 'src/pages/index/index.vue',
    required: [
      "'dark-mode': isDark",
      "'theme-light': !isDark",
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
    required: ['<LearningShell', 'active="practice"']
  },
  {
    file: 'src/pages/profile/index.vue',
    required: [
      "'dark-mode': isDark",
      "uni.$on('themeUpdate'",
      "uni.$on('updateTheme'",
      "uni.$off('themeUpdate'",
      "uni.$off('updateTheme'",
      '.page.dark-mode',
      '.dark-mode .nav-bar',
      '.dark-mode .card'
    ]
  }
];

describe('core shell theme guard', () => {
  it('keeps core pages wired to theme events and dark-mode surface coverage', () => {
    for (const { file, required } of CORE_THEME_PAGES) {
      const page = readFileSync(resolve(ROOT, file), 'utf8');
      for (const entry of required.filter((x) => !x.startsWith('.'))) expect(page).toContain(entry);
      expect(page).toContain('useThemeStore');
      expect(page).toContain('@/styles/yozi-pages.scss');
    }
    const shell = readFileSync(resolve(ROOT, 'src/components/business/learning/learning-shell.vue'), 'utf8');
    expect(shell).toContain('useThemeStore');
    expect(shell).toContain("'space-dark': theme.isDark");
  });
});
