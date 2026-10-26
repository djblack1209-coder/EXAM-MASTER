// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import {
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readlinkSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync
} from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const dependencies = join(root, 'laf-backend/standalone/node_modules');
const outputs = [];
afterEach(() => {
  for (const output of outputs.splice(0)) rmSync(output, { recursive: true, force: true });
});
function compiled() {
  const output = mkdtempSync(join(root, 'tmp/byok-package-unit-'));
  outputs.push(output);
  mkdirSync(join(output, 'standalone'));
  mkdirSync(join(output, 'functions/_shared'), { recursive: true });
  writeFileSync(
    join(output, 'standalone/server.js'),
    "import express from 'express'; export const ready = typeof express === 'function';\n"
  );
  return output;
}
function pack(output) {
  return spawnSync(
    process.execPath,
    ['laf-backend/standalone/package-runtime.mjs', '--output', relative(root, output)],
    {
      cwd: root,
      encoding: 'utf8'
    }
  );
}
describe('isolated backend packages carry their existing runtime dependency link', () => {
  it('links dependencies, resolves native ESM without starting a server, and can be repackaged safely', () => {
    const output = compiled();
    const require = createRequire(pathToFileURL(join(dependencies, '../package.json')));
    const installedModule = require.resolve('express');
    const before = readFileSync(installedModule);
    expect(pack(output).status).toBe(0);
    const link = join(output, 'node_modules');
    expect(lstatSync(link).isSymbolicLink()).toBe(true);
    expect(readlinkSync(link)).toBe(dependencies);
    expect(realpathSync(link)).toBe(realpathSync(dependencies));
    const check = execFileSync(
      process.execPath,
      [
        '--input-type=module',
        '-e',
        `const m = await import(${JSON.stringify(pathToFileURL(join(output, 'standalone/server.js')).href)}); if (!m.ready) process.exit(1);`
      ],
      { cwd: root }
    );
    expect(check.toString()).toBe('');
    expect(pack(output).status).toBe(0);
    expect(readFileSync(installedModule)).toEqual(before);
  });
  it.each(['directory', 'foreign-link', 'broken-link'])('refuses to replace existing %s dependencies', (kind) => {
    const output = compiled();
    const link = join(output, 'node_modules');
    if (kind === 'directory') mkdirSync(link);
    else symlinkSync(kind === 'foreign-link' ? join(output, 'functions') : join(output, 'missing'), link);
    const before = readFileSync(join(output, 'standalone/server.js'));
    expect(pack(output).status).not.toBe(0);
    expect(lstatSync(link).isDirectory()).toBe(kind === 'directory');
    expect(readFileSync(join(output, 'standalone/server.js'))).toEqual(before);
  });
  it('still rejects other symbolic links instead of walking into private or shared directories', () => {
    const output = compiled();
    symlinkSync(dependencies, join(output, 'functions/foreign'));
    expect(pack(output).status).not.toBe(0);
    expect(() => lstatSync(join(output, 'node_modules'))).toThrow();
  });
});
