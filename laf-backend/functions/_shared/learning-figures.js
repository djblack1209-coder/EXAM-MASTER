// Trusted host output only. No model markup is accepted by either renderer.
function escapeXml(value) {
  return String(value).replace(
    /[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[char]
  );
}
const color = (value) => (/^#(?:[\da-f]{3}|[\da-f]{6}|[\da-f]{8})$/i.test(value || '') ? value : 'none');
const rounded = (value) => Math.round(value * 1000) / 1000;
const svg = (width, height, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${body}</svg>`;

export function figureSvg(figure, palette) {
  const { nodes, edges } = figure;
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const paths = edges
    .map(([from, to]) => {
      const a = byId.get(from),
        b = byId.get(to);
      if (!a || !b) return '';
      const dx = b.x - a.x,
        dy = b.y - a.y,
        distance = Math.hypot(dx, dy);
      if (distance <= 38) return ''; // Overlapping circles have no visible connecting segment.
      const x = (dx / distance) * 19,
        y = (dy / distance) * 19;
      return `<path d="M${rounded(a.x + x)} ${rounded(a.y + y)} L${rounded(b.x - x)} ${rounded(b.y - y)}"/>`;
    })
    .join('');
  const body = nodes
    .map(
      (node) =>
        `<g><circle cx="${node.x}" cy="${node.y}" r="19" fill="${color(palette.node)}" stroke="${color(palette.line)}" stroke-width="1.6"/><text x="${node.x}" y="${node.y + 5}" text-anchor="middle" font-size="14" font-weight="600" fill="${color(palette.text)}">${escapeXml(node.label)}</text></g>`
    )
    .join('');
  // Padding in the viewBox keeps circles at coordinate 0 and at the bounds visible.
  const width = figure.width || 260,
    height = figure.height || 174;
  const left = Math.min(0, ...nodes.map((node) => node.x - 20));
  const top = Math.min(0, ...nodes.map((node) => node.y - 20));
  const right = Math.max(width, ...nodes.map((node) => node.x + 20));
  const bottom = Math.max(height, ...nodes.map((node) => node.y + 20));
  return svg(
    width,
    height,
    `<g fill="none" stroke="${color(palette.line)}" stroke-opacity="0.55" stroke-width="1.6">${paths}</g>${body}`
  ).replace(`viewBox="0 0 ${width} ${height}"`, `viewBox="${left} ${top} ${right - left} ${bottom - top}"`);
}

export function chartSvg(chart, palette) {
  if (chart.type !== 'donut' || !chart.series?.length) return '';
  const total = chart.total ?? chart.series.reduce((sum, item) => sum + item.value, 0);
  const circumference = 2 * Math.PI * 52;
  let offset = 0;
  const ring = (stroke, extra = '') =>
    `<circle cx="70" cy="70" r="52" fill="none" stroke="${color(stroke)}" stroke-width="16"${extra}/>`;
  const arcs = chart.series
    .map((item) => {
      const length = total > 0 ? (item.value / total) * circumference : 0;
      const arc = ring(
        palette[item.tone || 'default'],
        ` stroke-dasharray="${rounded(length)} ${rounded(circumference - length)}" stroke-dashoffset="${rounded(-offset)}" transform="rotate(-90 70 70)"`
      );
      offset += length;
      return length ? arc : '';
    })
    .join('');
  return svg(140, 140, ring(palette.track) + arcs);
}

// Migration/test utility only: parse a tiny grammar and rebuild every allowed attribute.
export function sanitizeSvgSubset(raw) {
  if (
    typeof raw !== 'string' ||
    new TextEncoder().encode(raw).length > 8192 ||
    /(?:javascript:|data:|https?:|style|url\(|\bon[\w-]*\s*=)/i.test(raw)
  )
    return '';
  const tags = new Set(['svg', 'g', 'path', 'circle', 'text']);
  const numeric = new Set([
    'width',
    'height',
    'stroke-width',
    'stroke-opacity',
    'font-size',
    'font-weight',
    'x',
    'y',
    'cx',
    'cy',
    'r',
    'stroke-dashoffset'
  ]);
  const output = [],
    stack = [];
  let position = 0,
    count = 0,
    root = false;
  const parts = raw.match(/<[^>]*>|[^<]+/g) || [];
  for (const part of parts) {
    if (raw.slice(position, position + part.length) !== part) return '';
    position += part.length;
    if (!part.startsWith('<')) {
      if (stack.at(-1) === 'text') output.push(escapeXml(part));
      else if (part.trim()) return '';
      continue;
    }
    const match = /^<(\/?)([a-z]+)([^<>]*?)(\/?)>$/i.exec(part);
    if (!match || !tags.has(match[2])) return '';
    const [, closing, tag, attrs, selfClosing] = match;
    if (closing) {
      if (attrs.trim() || selfClosing || stack.pop() !== tag) return '';
      output.push(`</${tag}>`);
      continue;
    }
    if (++count > 120 || (!stack.length && (root || tag !== 'svg')) || (stack.length && tag === 'svg')) return '';
    root = true;
    let rest = attrs,
      rebuilt = '';
    const seen = new Set();
    while (rest.trim()) {
      const attribute = /^\s+([\w-]+)\s*=\s*(?:"([^"<>]*)"|'([^'<>]*)')/.exec(rest);
      if (!attribute) return '';
      const name = attribute[1],
        value = attribute[2] ?? attribute[3];
      if (seen.has(name)) return '';
      seen.add(name);
      let valid = false;
      if (numeric.has(name)) valid = /^-?\d+(?:\.\d+)?$/.test(value) && Number.isFinite(Number(value));
      else if (name === 'fill' || name === 'stroke') valid = /^(?:none|#[\da-f]{3,8})$/i.test(value);
      else if (name === 'viewBox') valid = /^-?[\d.]+(?:[ ,]+-?[\d.]+){3}$/.test(value);
      else if (name === 'd') valid = /^[MLHVCSQTAZmlhvcsqtaz\d\s.,+-]+$/.test(value);
      else if (name === 'text-anchor') valid = ['start', 'middle', 'end'].includes(value);
      else if (name === 'stroke-dasharray') valid = /^[\d.]+(?:[ ,]+[\d.]+)*$/.test(value);
      else if (name === 'transform') valid = /^rotate\(-?[\d.]+(?:[ ,]+-?[\d.]+){2}\)$/.test(value);
      if (!valid) return '';
      rebuilt += ` ${name}="${escapeXml(value)}"`;
      rest = rest.slice(attribute[0].length);
    }
    output.push(`<${tag}${rebuilt}${selfClosing ? '/' : ''}>`);
    if (!selfClosing) stack.push(tag);
  }
  if (position !== raw.length || stack.length || !root) return '';
  return output.join('');
}
