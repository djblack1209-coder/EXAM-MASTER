import { describe, expect, it } from 'vitest';

import { normalizeAppRuntimeHtml } from '../../scripts/build/app-runtime-html.js';

describe('app runtime html normalization', () => {
  it('keeps runtime assets relative and injects missing stylesheets', () => {
    const html = `<!doctype html>
<html>
  <head>
    <script type="module" crossorigin src="/static/js/index.js"></script>
  </head>
  <body>
    <div id="app"></div>
  </body>
</html>`;

    const normalized = normalizeAppRuntimeHtml(html, ['./static/css/index.css']);

    expect(normalized).toContain('<script src="./static/js/index.js"></script>');
    expect(normalized).toContain('<link rel="stylesheet" href="./static/css/index.css" />');
    expect(normalized).not.toContain('crossorigin');
    expect(normalized).not.toContain('type="module"');
    expect(normalized).not.toContain('src="/static/js/index.js"');
  });

  it('does not duplicate stylesheet links that already exist', () => {
    const html = `<!doctype html>
<html>
  <head>
    <link rel="stylesheet" href="./static/css/index.css" />
    <script src="./static/js/index.js"></script>
  </head>
</html>`;

    const normalized = normalizeAppRuntimeHtml(html, ['./static/css/index.css']);
    const stylesheetCount = normalized.match(/\.\/static\/css\/index\.css/g)?.length ?? 0;

    expect(stylesheetCount).toBe(1);
  });
});
