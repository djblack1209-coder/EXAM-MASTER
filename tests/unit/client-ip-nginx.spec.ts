// @vitest-environment node
import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

type Directive = { words: string[]; children: Directive[] };

// Parse braces/semicolons without treating quoted JSON or comments as directives.
function parse(source: string): Directive[] {
  const tokens = source.match(/#[^\n]*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|[{};]|[^\s{};"'#]+/g) || [];
  const root: Directive[] = [];
  const stack = [root];
  let words: string[] = [];
  for (const token of tokens) {
    if (token.startsWith('#')) continue;
    if (token === '{' || token === ';') {
      const directive = { words, children: [] as Directive[] };
      stack[stack.length - 1].push(directive);
      if (token === '{') stack.push(directive.children);
      words = [];
    } else if (token === '}') {
      expect(words).toEqual([]);
      stack.pop();
    } else words.push(token);
  }
  expect(stack.length).toBe(1);
  expect(words).toEqual([]);
  return root;
}

const config = parse(readFileSync('deploy/tencent/nginx/yozi-ai.conf', 'utf8'));
const publicServers = config.filter(
  (node) =>
    node.words[0] === 'server' && node.children.some((d) => d.words[0] === 'listen' && /^(80|443)$/.test(d.words[1]))
);
const locations = (server: Directive) => server.children.filter((d) => d.words[0] === 'location');
const directive = (node: Directive, name: string) =>
  node.children.filter((d) => d.words[0] === name).map((d) => d.words.slice(1).join(' '));
const functions = [
  ...new Set(
    publicServers.flatMap((s) =>
      locations(s).flatMap((l) => {
        const match = l.words[2]?.match(/^\^\/\(([^)]+)\)\$$/);
        return match ? match[1].split('|') : [];
      })
    )
  )
];
const apiPaths = functions.flatMap((name) => [`/${name}`, `/exam-master/${name}`]);

function route(server: Directive, path: string): Directive {
  if (directive(server, 'return').length) return server;
  const all = locations(server);
  const exact = all.find((l) => l.words[1] === '=' && l.words[2] === path);
  if (exact) return exact;
  const prefix = all
    .filter((l) => !['=', '~', '~*'].includes(l.words[1]) && path.startsWith(l.words.at(-1)!))
    .sort((a, b) => b.words.at(-1)!.length - a.words.at(-1)!.length)[0];
  if (prefix?.words[1] === '^~') return prefix;
  return (
    all.find(
      (l) => ['~', '~*'].includes(l.words[1]) && new RegExp(l.words[2], l.words[1] === '~*' ? 'i' : '').test(path)
    ) || prefix!
  );
}

it('routes public API prefixes and function paths directly to the backend with overwritten transport headers', () => {
  expect(publicServers).toHaveLength(4);
  expect(functions.length).toBeGreaterThan(40);
  const https = publicServers.filter((s) => s.children.some((d) => d.words[0] === 'listen' && d.words[1] === '443'));
  expect(https).toHaveLength(2);
  const prefixBlocks = https.map((s) => locations(s).filter((l) => l.words.join(' ') === 'location /exam-master/'));
  prefixBlocks.forEach((blocks) => expect(blocks).toHaveLength(1));
  expect(prefixBlocks[0][0]).toEqual(prefixBlocks[1][0]);
  expect(directive(prefixBlocks[1][0], 'rewrite')).toEqual(['^/exam-master/(.*)$ /$1 break']);
  expect(directive(prefixBlocks[1][0], 'limit_req')).toEqual(['zone=global_api burst=30 nodelay']);
  expect(directive(prefixBlocks[1][0], 'proxy_set_header')).toContain('X-Forwarded-Proto $scheme');
  for (const server of publicServers) {
    for (const path of apiPaths) {
      const selected = route(server, path);
      expect(selected, `${server.words}: ${path}`).toBeDefined();
      if (directive(selected, 'return').length) {
        // Port 80 redirects domains; the default server explicitly rejects the prefix.
        expect(server.children.some((d) => d.words[0] === 'listen' && d.words[1] === '80')).toBe(true);
        expect(directive(selected, 'return')[0]).toMatch(/^(301|404) /);
        continue;
      }
      expect(directive(selected, 'proxy_pass'), path).toEqual(['http://yozi_ai_backend']);
      const headers = directive(selected, 'proxy_set_header');
      expect(
        headers.filter((h) => /^X-Forwarded-For /i.test(h)),
        path
      ).toEqual(['X-Forwarded-For $remote_addr']);
      expect(
        headers.filter((h) => /^X-Real-IP /i.test(h)),
        path
      ).toEqual(['X-Real-IP $remote_addr']);
    }
  }
});

it('never forwards a public API path through the local H5 server on port 8080', () => {
  for (const server of publicServers) {
    for (const path of apiPaths) {
      expect(directive(route(server, path), 'proxy_pass'), path).not.toContain('http://127.0.0.1:8080');
    }
  }
});
