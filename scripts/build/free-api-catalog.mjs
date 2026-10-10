import { readFileSync, statSync } from 'node:fs';
import parser from 'vue-eslint-parser';

// 本机私有文档只解析数据节点；不执行HTML/JavaScript，不输出或复制原文与密钥。
export function readFreeApiCredential(file, provider, expectedBase) {
  const info = statSync(file);
  if (!info.isFile() || info.size > 512 * 1024 || (info.mode & 0o077) !== 0)
    throw new Error('Free API catalog must be a private local file, at most 512KB');
  const html = readFileSync(file, 'utf8');
  for (const match of html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)) {
    const ast = parser.parse(match[1], { ecmaVersion: 'latest', sourceType: 'script' });
    const rows = ast.body
      .filter((n) => n.type === 'VariableDeclaration')
      .flatMap((n) => n.declarations)
      .find((n) => n.id.name === 'rows' && n.init?.type === 'ArrayExpression');
    if (!rows) continue;
    for (const row of rows.init.elements) {
      if (row?.type !== 'ObjectExpression') continue;
      const props = Object.fromEntries(
        row.properties
          .filter((p) => p.type === 'Property' && !p.computed)
          .map((p) => [p.key.name || p.key.value, p.value])
      );
      if (props.id?.type !== 'Literal' || props.id.value !== provider) continue;
      if (props.base?.type !== 'Literal' || props.base.value !== expectedBase || props.status?.value !== 'verified')
        throw new Error('Provider catalog entry is not the approved endpoint or verified snapshot');
      const key = props.keys?.type === 'ArrayExpression' && props.keys.elements[0];
      if (key?.type !== 'Literal' || typeof key.value !== 'string' || key.value.length < 12)
        throw new Error('No usable private key in approved catalog entry');
      return key.value;
    }
  }
  throw new Error('Approved provider entry not found');
}
