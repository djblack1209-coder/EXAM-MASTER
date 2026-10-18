import { readFileSync, statSync } from 'node:fs';
import parser from 'vue-eslint-parser';
import {
  MODEL_ENDPOINTS,
  MODEL_CONNECTION_PRESETS,
  completeModelEndpoint
} from '../../laf-backend/functions/_shared/ai-providers/model-endpoints.js';

// 本机私有文档只解析数据节点；不执行HTML/JavaScript，不输出或复制原文与密钥。
function catalogRows(file) {
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
    return rows.init.elements.flatMap((row) => {
      if (row?.type !== 'ObjectExpression') return [];
      const props = Object.fromEntries(
        row.properties
          .filter((p) => p.type === 'Property' && !p.computed)
          .map((p) => [p.key.name || p.key.value, p.value])
      );
      return [props];
    });
  }
  throw new Error('Provider catalog data not found');
}

// Deliberately omit keys, account identities, notes, environment variables and raw HTML.
// A provider's historical "verified" label is not a fresh connectivity or free-quota test.
export function readFreeApiCatalog(file) {
  return catalogRows(file).map((props) => {
    const id = props.id?.type === 'Literal' && props.id.value;
    const providerId = id === 'gemini_x_auto' ? 'gemini' : id;
    const provider = MODEL_ENDPOINTS.find((item) => item.id === providerId);
    const baseURL = props.base?.type === 'Literal' && typeof props.base.value === 'string' ? props.base.value : '';
    const endpoint = completeModelEndpoint(baseURL);
    const models =
      props.models?.type === 'ArrayExpression'
        ? props.models.elements
            .filter((n) => n?.type === 'Literal' && typeof n.value === 'string' && n.value.length <= 120)
            .map((n) => n.value)
        : [];
    const status = props.status?.type === 'Literal' ? props.status.value : 'unknown';
    const credentialAvailable =
      props.keys?.type === 'ArrayExpression' &&
      props.keys.elements.some((n) => n?.type === 'Literal' && typeof n.value === 'string' && n.value.length >= 12);
    const baseMatchesOfficial = Boolean(
      provider &&
      (baseURL.replace(/\/$/, '') === provider.baseURL ||
        (providerId === 'cloudflare' &&
          endpoint !== baseURL &&
          endpoint.startsWith('https://api.cloudflare.com/client/v4/accounts/')))
    );
    return {
      id,
      providerId,
      provider: provider?.provider || 'Unknown',
      status,
      baseURL,
      endpoint: baseMatchesOfficial ? endpoint : null,
      baseMatchesOfficial,
      docs: provider?.docs || null,
      models: [...new Set(models)],
      modelEntries: models.length,
      credentialAvailable: Boolean(credentialAvailable),
      connectionStatus: 'untested',
      presetIds:
        baseMatchesOfficial && status === 'verified' && credentialAvailable
          ? MODEL_CONNECTION_PRESETS.filter((p) => p.endpoint === endpoint && models.includes(p.model)).map((p) => p.id)
          : []
    };
  });
}

export function readFreeApiCredential(file, provider, expectedBase) {
  for (const props of catalogRows(file)) {
    if (props.id?.type !== 'Literal' || props.id.value !== provider) continue;
    if (props.base?.type !== 'Literal' || props.base.value !== expectedBase || props.status?.value !== 'verified')
      throw new Error('Provider catalog entry is not the approved endpoint or verified snapshot');
    const key = props.keys?.type === 'ArrayExpression' && props.keys.elements[0];
    if (key?.type !== 'Literal' || typeof key.value !== 'string' || key.value.length < 12)
      throw new Error('No usable private key in approved catalog entry');
    return key.value;
  }
  throw new Error('Approved provider entry not found');
}
