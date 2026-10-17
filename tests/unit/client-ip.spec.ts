// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import ts from '../../laf-backend/standalone/node_modules/typescript/lib/typescript.js';
import { normalizeClientIp, getClientIp } from '../../laf-backend/functions/_shared/client-ip';
import { compileTrustedProxies, resolveClientIp } from '../../laf-backend/standalone/client-ip';

const require = createRequire(new URL('../../laf-backend/standalone/package.json', import.meta.url));
const express = require('express');
function resolve(peer: string, forwarded: string, trust?: string, headers = {}) {
  const app = express();
  app.set('trust proxy', compileTrustedProxies(trust));
  const req = Object.create(app.request);
  req.app = app;
  req.socket = { remoteAddress: peer };
  req.headers = { 'x-forwarded-for': forwarded, ...headers };
  return resolveClientIp(req);
}

describe('trusted client IP', () => {
  it('ignores all forwarded headers on a direct untrusted connection', () => {
    expect(resolve('198.51.100.2', '203.0.113.99')).toBe('198.51.100.2');
    expect(resolve('127.0.0.1', '203.0.113.99', 'false')).toBe('127.0.0.1');
  });
  it('accepts one trusted proxy, ignoring a forged XFF prefix and other IP headers', () => {
    expect(
      resolve('::ffff:127.0.0.1', '203.0.113.99, 198.51.100.2', undefined, {
        'x-real-ip': '203.0.113.90',
        'cf-connecting-ip': '203.0.113.91',
        'true-client-ip': '203.0.113.92',
        'x-client-ip': '203.0.113.93',
        forwarded: 'for=203.0.113.94'
      })
    ).toBe('198.51.100.2');
  });
  it('walks multiple whitelisted proxies and stops at the first untrusted address', () => {
    expect(resolve('127.0.0.1', '203.0.113.99, 198.51.100.2, 10.2.0.3', 'loopback,10.2.0.3/32')).toBe('198.51.100.2');
    expect(resolve('127.0.0.1', '203.0.113.99, 198.51.100.2, 10.2.0.4', 'loopback,10.2.0.3/32')).toBe('10.2.0.4');
  });
  it('pins the Docker gateway only, including IPv4-mapped peers', () => {
    expect(resolve('::ffff:172.30.87.1', '198.51.100.2', '172.30.87.1/32')).toBe('198.51.100.2');
    expect(resolve('172.30.87.2', '198.51.100.2', '172.30.87.1/32')).toBe('172.30.87.2');
  });
  it.each([
    [' ::ffff:192.0.2.1 ', '192.0.2.1'],
    ['::ffff:c000:201', '192.0.2.1'],
    ['[::ffff:192.0.2.1]:1234', '192.0.2.1'],
    ['192.0.2.1:1234', '192.0.2.1'],
    ['[2001:0DB8::1]:443', '2001:db8::1'],
    ['2001:0DB8:0:0::1', '2001:db8::1']
  ])('normalizes %s', (value, result) => expect(normalizeClientIp(value)).toBe(result));
  it.each([
    undefined,
    [],
    '',
    'unknown',
    '999.1.1.1',
    '1.2.3.4,5.6.7.8',
    'example.com',
    '[::1]:99999',
    '1.2.3.4:0',
    'fe80::1%en0'
  ])('rejects invalid address %j', (value) => expect(normalizeClientIp(value)).toBeNull());
  it.each(['', ' ', 'true', '1', '2', 'loopback,', 'invalid', '10.0.0.0/33', '::1/129'])(
    'rejects unsafe proxy configuration %j',
    (value) => expect(() => compileTrustedProxies(value)).toThrow('Invalid TRUST_PROXY')
  );
  it('rejects missing/invalid transport addresses without trusting ctx.ip or headers', () => {
    expect(getClientIp({ ip: '192.0.2.1', headers: { 'x-real-ip': '192.0.2.2' } })).toBeNull();
    expect(resolve('', '192.0.2.1')).toBeNull();
    expect(resolve('127.0.0.1', 'invalid')).toBeNull();
  });
  it('uses only normalized transport metadata in historical Laf contexts', () => {
    expect(
      getClientIp({ socket: { remoteAddress: '::ffff:192.0.2.1' }, headers: { 'x-forwarded-for': '192.0.2.9' } })
    ).toBe('192.0.2.1');
  });
});

it('guards every function source against IP headers and alternate transport readers', () => {
  const forbidden = new Set([
    'x-forwarded-for',
    'x-real-ip',
    'cf-connecting-ip',
    'true-client-ip',
    'x-client-ip',
    'forwarded'
  ]);
  const violations: string[] = [];
  function scan(dir: string) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const file = join(dir, entry.name);
      if (entry.isDirectory()) scan(file);
      else if (/\.[jt]s$/.test(file) && file !== 'laf-backend/functions/_shared/client-ip.ts') {
        const ast = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
        function visit(node: any) {
          if (
            (ts.isStringLiteralLike(node) && forbidden.has(node.text.toLowerCase())) ||
            (ts.isPropertyAccessExpression(node) && ['remoteAddress', 'ip', ...forbidden].includes(node.name.text))
          )
            violations.push(`${file}:${ast.getLineAndCharacterOfPosition(node.getStart()).line + 1}`);
          ts.forEachChild(node, visit);
        }
        visit(ast);
      }
    }
  }
  scan('laf-backend/functions');
  expect(violations).toEqual([]);
});

it('pins the Compose gateway and overwrites every edge XFF header', () => {
  const compose = readFileSync('deploy/tencent/docker-compose.yml', 'utf8');
  expect(compose).toContain('TRUST_PROXY=${TRUST_PROXY-172.30.87.1/32}');
  expect(compose).toContain('gateway: 172.30.87.1');
  expect(compose).toContain("'127.0.0.1:3001:3000'");
  for (const file of ['deploy/tencent/nginx/yozi-ai.conf', 'deploy/tencent/nginx/conf.d/yozi-ai-h5.conf']) {
    const config = readFileSync(file, 'utf8');
    const headers = config.match(/proxy_set_header X-Forwarded-For [^;]+;/g) || [];
    expect(headers.length).toBeGreaterThan(0);
    expect(headers.every((value) => value === 'proxy_set_header X-Forwarded-For $remote_addr;')).toBe(true);
    expect(config).toContain('proxy_set_header X-Real-IP $remote_addr;');
  }
});
