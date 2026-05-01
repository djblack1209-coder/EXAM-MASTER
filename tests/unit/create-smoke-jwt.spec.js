import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const SCRIPT = path.resolve(process.cwd(), 'scripts/build/create-smoke-jwt.mjs');

function verifyJwt(token, secret) {
  const [headerBase64, payloadBase64, signature] = token.split('.');
  const expected = crypto.createHmac('sha256', secret).update(`${headerBase64}.${payloadBase64}`).digest('base64url');
  return {
    header: JSON.parse(Buffer.from(headerBase64, 'base64url').toString('utf8')),
    payload: JSON.parse(Buffer.from(payloadBase64, 'base64url').toString('utf8')),
    signatureMatches: signature === expected
  };
}

describe('create smoke jwt', () => {
  it('prints a HS256 token with userId for strict cloud smoke', () => {
    const secret = 'unit-test-jwt-secret-for-smoke-token-generation-'.repeat(2);
    const result = spawnSync(
      process.execPath,
      [SCRIPT, '--user-id', 'smoke_user_1', '--ttl-seconds', '3600', '--no-env-files', '--print'],
      {
        cwd: process.cwd(),
        env: { PATH: process.env.PATH, JWT_SECRET: secret },
        encoding: 'utf8'
      }
    );

    expect(result.status, result.stderr || result.stdout).toBe(0);
    const token = result.stdout.trim();
    const verified = verifyJwt(token, secret);
    expect(verified.signatureMatches).toBe(true);
    expect(verified.header).toMatchObject({ alg: 'HS256', typ: 'JWT' });
    expect(verified.payload.userId).toBe('smoke_user_1');
    expect(verified.payload.role).toBe('smoke');
    expect(verified.payload.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });
});
