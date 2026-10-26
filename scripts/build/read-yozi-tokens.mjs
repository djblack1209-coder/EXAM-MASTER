import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** 构建时从唯一 SCSS 源读取原生 API 需要的原始值；不把 SCSS 解析器带入客户端。 */
export function readYoziTokens() {
  const source = readFileSync(fileURLToPath(new URL('../../src/styles/yozi-tokens.scss', import.meta.url)), 'utf8');
  const read = (name) => {
    const block = source.match(new RegExp(`@mixin yozi-${name} \\{([\\s\\S]*?)\\n\\}`))?.[1];
    if (!block) throw new Error(`Missing Yozi ${name} token block`);
    return Object.fromEntries(
      [...block.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map(([, key, value]) => [key, value.trim()])
    );
  };
  const light = read('light');
  const muse = Object.fromEntries(
    ['light', 'dark'].map((theme) => {
      const block = source.match(new RegExp(`\\.muse-space\\.space-${theme},[\\s\\S]*?\\{([\\s\\S]*?)\\n\\}`))?.[1];
      if (!block) throw new Error(`Missing Muse ${theme} token block`);
      const colors = Object.fromEntries(
        [...block.matchAll(/(--[\w-]+):\s*([^;]+);/g)]
          .filter(([, key]) =>
            ['--violet', '--line-strong', '--muse-rich-success', '--muse-rich-warning', '--muse-rich-danger'].includes(
              key
            )
          )
          .map(([, key, value]) => [key, value.trim()])
      );
      return [theme, colors];
    })
  );
  return { light, dark: { ...light, ...read('dark') }, muse };
}

/** Declarative native fallback, generated from the same source as runtime colors. */
export function readYoziNativeTheme(tokens = readYoziTokens()) {
  return Object.fromEntries(
    ['light', 'dark'].map((theme) => [
      theme,
      {
        navBackground: tokens[theme]['--canvas'],
        navText: theme === 'dark' ? 'white' : 'black',
        pageBackground: tokens[theme]['--canvas'],
        backgroundText: theme === 'dark' ? 'light' : 'dark',
        tabText: tokens[theme]['--ink-3'],
        tabSelected: tokens[theme]['--violet-ink'],
        tabBackground: tokens[theme]['--paper']
      }
    ])
  );
}
