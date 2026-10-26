// Muse Design Components are presentation data. Never evaluate generated JSX,
// forward attributes to DOM, or turn a generated button into a learning action.
const TAGS = new Set([
  'box',
  'row',
  'col',
  'grid',
  'grid-item',
  'title',
  'text',
  'badge',
  'icon',
  'link',
  'table',
  'table-row',
  'table-cell',
  'caption',
  'divider',
  'list',
  'list-item'
]);
const ICONS = {
  'check-circle': 'check',
  'circle-check': 'check',
  'book-open': 'book-open',
  'arrow-right': 'arrow-right',
  'arrow-down': 'chevron-down',
  'arrow-up': 'arrow-up',
  'alert-triangle': 'alert',
  info: 'info',
  sparkles: 'sparkles'
};
const COLORS = new Set(['secondary', 'success', 'warning', 'danger']);
const SIZES = new Set(['xs', 'sm', 'lg', 'xl', '2xl']);
const node = (kind, children = [], extra = {}) => ({ kind, children, ...extra });
const literal = (text) => node('literal', [], { text });

export function museSafeLink(value) {
  try {
    if (typeof value !== 'string' || value.length > 2048) return '';
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : '';
  } catch {
    return '';
  }
}

function attributes(raw) {
  const found = Object.create(null);
  const re = /([a-zA-Z-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|\{([^}]*)\}))?/g;
  for (const match of raw.matchAll(re)) found[match[1]] = match[2] ?? match[3] ?? match[4] ?? 'true';
  const result = {};
  if (COLORS.has(found.color)) result.color = found.color;
  if (SIZES.has(found.size)) result.size = found.size;
  if (['medium', 'semibold'].includes(found.weight)) result.weight = found.weight;
  if (['md', 'lg', 'xl'].includes(found.radius)) result.radius = found.radius;
  if (['center', 'start'].includes(found.align)) result.align = found.align;
  if (found.justify === 'between') result.justify = 'between';
  if (found.background === 'surface-secondary') result.surface = true;
  if (found.border !== undefined && found.border !== 'false') result.border = true;
  if (found.wrap === 'wrap' || found.wrap === 'true') result.wrap = true;
  for (const name of ['padding', 'gap', 'columns']) {
    if (/^\d$/.test(found[name] || '')) result[name] = Math.min(6, Number(found[name]));
  }
  if (ICONS[found.name]) result.icon = ICONS[found.name];
  const href = museSafeLink(found.url);
  if (href) result.href = href;
  return result;
}

function inline(raw) {
  const output = [];
  const re = /\*\*([^*\n]+)\*\*|`([^`\n]+)`|\[([^\]\n]+)\]\(([^)\s]+)\)|\\\(([\s\S]*?)\\\)/g;
  let end = 0;
  for (const match of raw.matchAll(re)) {
    if (match.index > end) output.push(literal(raw.slice(end, match.index)));
    if (match[1]) output.push(node('strong', [literal(match[1])]));
    else if (match[2]) output.push(node('inline-code', [literal(match[2])]));
    else if (match[3]) output.push(node('link', [literal(match[3])], { attrs: { href: museSafeLink(match[4]) } }));
    else output.push(node('formula', [literal(match[5])]));
    end = match.index + match[0].length;
  }
  if (end < raw.length) output.push(literal(raw.slice(end)));
  return output;
}

function markdown(raw) {
  const lines = raw.split('\n');
  const output = [];
  let paragraph = [];
  const flush = () => {
    if (paragraph.length) output.push(node('paragraph', inline(paragraph.join('\n'))));
    paragraph = [];
  };
  const cells = (line) =>
    line
      .trim()
      .slice(1, -1)
      .split('|')
      .map((cell) => cell.trim());
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) {
      flush();
      continue;
    }
    if (/^\|.*\|\s*$/.test(line) && /^\|[\s:|\-]+\|\s*$/.test(lines[i + 1] || '')) {
      const columns = cells(line).length;
      if (columns <= 6) {
        flush();
        const rows = [
          node(
            'table-row',
            cells(line).map((cell) => node('table-cell', inline(cell)))
          )
        ];
        i += 2;
        while (i < lines.length && /^\|.*\|\s*$/.test(lines[i]) && cells(lines[i]).length === columns) {
          rows.push(
            node(
              'table-row',
              cells(lines[i]).map((cell) => node('table-cell', inline(cell)))
            )
          );
          i++;
        }
        i--;
        output.push(node('table', rows));
        continue;
      }
    }
    const heading = /^(#{1,3})\s+(.+)$/.exec(line);
    const item = /^\s*(?:[-*]|\d+\.)\s+(.+)$/.exec(line);
    if (heading) {
      flush();
      output.push(node('heading', inline(heading[2]), { level: heading[1].length + 1 }));
    } else if (/^\s*---+\s*$/.test(line)) {
      flush();
      output.push(node('divider'));
    } else if (item) {
      flush();
      output.push(node('list-item', inline(item[1])));
    } else if (/^>\s?/.test(line)) {
      flush();
      output.push(node('quote', inline(line.replace(/^>\s?/, ''))));
    } else paragraph.push(line);
  }
  flush();
  return output;
}

export function parseMuseRichContent(value) {
  const raw = String(value || '')
    .slice(0, 32000)
    .replace(/\r\n?/g, '\n');
  const root = node('root');
  const stack = [root];
  // Fenced and inline code take precedence over tags, including literal <box>.
  const token = /```[^\n]*\n[\s\S]*?(?:```|$)|`[^`\n]+`|<\/?([a-zA-Z][a-zA-Z-]*)\b([^>]*?)\/?\s*>/g;
  let end = 0;
  let count = 0;
  const append = (text) => stack.at(-1).children.push(...markdown(text));
  for (const match of raw.matchAll(token)) {
    if (++count > 400) break;
    if (match.index > end) append(raw.slice(end, match.index));
    const source = match[0];
    if (source.startsWith('```'))
      stack.at(-1).children.push(node('code', [literal(source.replace(/^```[^\n]*\n/, '').replace(/```$/, ''))]));
    else if (source.startsWith('`')) stack.at(-1).children.push(node('inline-code', [literal(source.slice(1, -1))]));
    else {
      const kind = match[1].toLowerCase();
      if (!TAGS.has(kind)) stack.at(-1).children.push(literal(source));
      else if (source.startsWith('</')) {
        const index = stack.map((item) => item.kind).lastIndexOf(kind);
        if (index > 0) stack.length = index;
      } else if (stack.length < 10) {
        const child = node(kind, [], { attrs: attributes(match[2] || '') });
        stack.at(-1).children.push(child);
        if (!source.endsWith('/>') && !['icon', 'divider'].includes(kind)) stack.push(child);
      }
    }
    end = match.index + source.length;
  }
  if (end < raw.length) append(raw.slice(end));
  return root.children;
}
