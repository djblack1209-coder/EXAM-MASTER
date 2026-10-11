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
  return { light, dark: { ...light, ...read('dark') } };
}
