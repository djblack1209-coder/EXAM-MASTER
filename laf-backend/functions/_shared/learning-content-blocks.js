export const CONTENT_BLOCKS_VERSION = 1;
const KINDS = new Set(['knowledge', 'example', 'note']);
const KEYS = new Set(['kind', 'title', 'body', 'points', 'steps', 'formula']);
function check(condition) {
  if (!condition) throw Object.assign(new Error('教学卡片结构不合法'), { code: 'CONTENT_BLOCKS_INVALID' });
}
function text(value, limit) {
  check(typeof value === 'string' && value.trim().length > 0 && value.length <= limit);
  return value;
}
function list(value, count, length) {
  check(Array.isArray(value) && value.length > 0 && value.length <= count);
  return value.map((item) => text(item, length));
}

// Presentation-only contract. Scores, plans, sources and executable actions belong to host facts/tools.
export function normalizeContentBlocks(value) {
  check(value && typeof value === 'object' && !Array.isArray(value));
  check(Object.keys(value).every((key) => ['version', 'items'].includes(key)));
  check(value.version === CONTENT_BLOCKS_VERSION && Array.isArray(value.items));
  check(value.items.length > 0 && value.items.length <= 6);
  const items = value.items.map((item) => {
    check(item && typeof item === 'object' && !Array.isArray(item));
    check(Object.keys(item).every((key) => KEYS.has(key)) && KINDS.has(item.kind));
    const output = { kind: item.kind, title: text(item.title, 120) };
    if (item.body !== undefined) output.body = text(item.body, 2000);
    if (item.points !== undefined) output.points = list(item.points, 4, 400);
    if (item.steps !== undefined) {
      check(item.kind === 'example');
      output.steps = list(item.steps, 6, 600);
    }
    if (item.formula !== undefined) output.formula = text(item.formula, 500);
    check(output.body || output.points || output.steps || output.formula);
    return output;
  });
  check(JSON.stringify(items).length <= 8000);
  return { version: CONTENT_BLOCKS_VERSION, items };
}

export function mapContentBlocks(value, transform) {
  const content = normalizeContentBlocks(value);
  return normalizeContentBlocks({
    ...content,
    items: content.items.map((item) => ({
      ...item,
      title: transform(item.title),
      ...(item.body ? { body: transform(item.body) } : {}),
      ...(item.formula ? { formula: transform(item.formula) } : {}),
      ...(item.points ? { points: item.points.map(transform) } : {}),
      ...(item.steps ? { steps: item.steps.map(transform) } : {})
    }))
  });
}
