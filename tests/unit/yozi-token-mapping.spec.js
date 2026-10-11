import { describe, expect, it } from 'vitest';
import board from '../fixtures/yozi-board-tokens.json';
import { resolve } from 'node:path';
import * as sass from 'sass';
import postcss from 'postcss';
import { tokens } from '@/design/tokens.js';
import { NAV_BAR_COLORS } from '@/composables/useTheme.js';

const sheet = sass.compile('src/styles/yozi-tokens.scss', { style: 'expanded' }).css;
const css = postcss.parse(sheet);
function properties(selector, media = false) {
  const result = {};
  css.walkRules((rule) => {
    if (
      rule.selector
        .split(',')
        .map((item) => item.trim().replace(/["']/g, ''))
        .includes(selector.replace(/["']/g, '')) &&
      (rule.parent.type === 'atrule') === media
    ) {
      rule.walkDecls((decl) => {
        result[decl.prop] = decl.value;
      });
    }
  });
  return result;
}
function resolveValue(properties, key) {
  return properties[key]?.replace(
    /var\((--[\w-]+)\)/g,
    (_match, name) => resolveValue(properties, name) ?? `MISSING:${name}`
  );
}
const light = properties(':root');
const dark = properties(":root[data-theme='dark']");

describe('Yozi single token source and transition mapping', () => {
  it.each(['light', 'dark'])('matches every reference-sheet primitive in %s', (theme) => {
    const actual = theme === 'light' ? light : dark;
    for (const [name, value] of Object.entries(board[theme])) {
      if (name === '--mascot') continue;
      // Sass normalizes quotation/whitespace but preserves all design values.
      expect(
        actual[name]
          ?.replace(/[\s"']/g, '')
          .replace(/\d*\.\d+/g, (number) => String(Number(number)))
          .toLowerCase(),
        name
      ).toBe(
        value
          .replace(/[\s"']/g, '')
          .replace(/\d*\.\d+/g, (number) => String(Number(number)))
          .toLowerCase()
      );
    }
  });
  it.each(['light', 'dark'])('resolves all aliases without missing values in %s', (theme) => {
    const actual = theme === 'light' ? light : dark;
    for (const key of Object.keys(actual)) expect(resolveValue(actual, key), key).not.toContain('MISSING:');
  });
  it('light and dark cover identical property names', () =>
    expect(Object.keys(light).sort()).toEqual(Object.keys(dark).sort()));
  it.each([
    ['--bg-page', '--canvas'],
    ['--text-main', '--ink'],
    ['--theme-primary', '--violet'],
    ['--space-paper', '--violet'],
    ['--space-glass', '--paper'],
    ['--yozi-reading', '--paper'],
    ['--yozi-button', '--clay-face'],
    ['--wot-color-theme', '--violet'],
    ['--radius-sm', '--r-sm']
  ])('%s binds to %s in both themes', (alias, primitive) => {
    for (const theme of [light, dark]) expect(resolveValue(theme, alias)).toBe(theme[primitive]);
  });
  it('defines all eight type roles and the reference spacing/radius scales', () => {
    for (const role of ['display', 'title-1', 'title-2', 'title-3', 'body', 'small', 'caption', 'number']) {
      expect(light[`--size-${role}`]).toMatch(/^\d+px$/);
      expect(light[`--leading-${role}`]).toMatch(/^\d+px$/);
    }
    expect(['xs', 'sm', 'md', 'lg', 'xl', 'pill'].map((key) => light[`--r-${key}`])).toEqual([
      '8px',
      '12px',
      '16px',
      '24px',
      '32px',
      '999px'
    ]);
    expect(['1', '2', '3', '4', '5', '6', '8', '10', '14'].map((key) => parseInt(light[`--s-${key}`]))).toEqual([
      4, 8, 12, 16, 20, 24, 32, 40, 56
    ]);
  });
  it('defines missing depth aliases with 4px sides and 1px pressed sides', () => {
    expect(resolveValue(light, '--em3d-depth-sm')).toContain('0 4px 0');
    expect(resolveValue(dark, '--em3d-depth-md')).toContain('0 4px 0');
    expect(resolveValue(light, '--em3d-depth-press')).toContain('0 1px 0');
    expect(light['--press-y']).toBe('3px');
  });
  it('system, explicit and native classes share the exact theme values', () => {
    for (const selector of ['.dark-mode', '.space-dark', '.theme-dark']) expect(properties(selector)).toEqual(dark);
    for (const selector of ['.space-light', '.theme-light']) expect(properties(selector)).toEqual(light);
    const system = properties(":root:not([data-theme='light'])", true);
    for (const key of ['--canvas', '--ink', '--clay-face', '--lift-1']) expect(system[key]).toBe(dark[key]);
  });
  it('native API values are read from the same primitives', () => {
    expect(NAV_BAR_COLORS.light.backgroundColor).toBe(light['--canvas']);
    expect(NAV_BAR_COLORS.dark.backgroundColor).toBe(dark['--canvas']);
    expect(tokens.light['--t-press']).toBe('110ms');
    expect(tokens.dark['--t-state']).toBe('180ms');
    expect(tokens.dark['--t-enter']).toBe('280ms');
  });
  it('legacy Sass names emit variable references, not independent colors', () => {
    const compiled = sass.compileString(
      '@use "legacy-aliases" as *; .probe {font-family: $font-family; color: $primary; background: $bg; border-radius: $radius-sm;}',
      { loadPaths: [resolve('src/styles')] }
    ).css;
    expect(compiled).toContain('font-family: var(--font-ui)');
    expect(compiled).toContain('color: var(--violet)');
    expect(compiled).toContain('background: var(--canvas)');
    expect(compiled).toContain('border-radius: var(--radius-sm)');
  });
});
