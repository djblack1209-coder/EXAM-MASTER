#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const action = process.argv[2];
if (!['web', 'build', 'dev'].includes(action)) throw new Error('desktop action must be web, build or dev');
let child;
let signal;
const forward = (value) => {
  signal = value;
  child?.kill(value);
};
for (const value of ['SIGINT', 'SIGTERM']) process.on(value, () => forward(value));

async function run(script, args, env = process.env) {
  if (signal) throw new Error('desktop command cancelled');
  const code = await new Promise((res, rej) => {
    child = spawn(process.execPath, [resolve(root, script), ...args], { cwd: root, env, stdio: 'inherit' });
    child.once('error', rej);
    child.once('exit', (status) => res(status ?? 1));
  });
  child = null;
  if (code) process.exit(code);
}

if (action === 'web') {
  const env = {
    ...process.env,
    YOZI_DESKTOP: '1',
    UNI_OUTPUT_DIR: resolve(process.env.UNI_OUTPUT_DIR || resolve(root, 'dist/build/desktop'))
  };
  await run('node_modules/@dcloudio/vite-plugin-uni/bin/uni.js', ['build', '-p', 'h5'], env);
  await run('scripts/build/copy-cdn-to-h5.mjs', [], env);
  await run('scripts/build/ui-quality-gate.js', ['--public-build', env.UNI_OUTPUT_DIR], env);
} else {
  if (action === 'dev') process.env.YOZI_BUILD_CHANNEL ||= 'dev';
  await run('node_modules/@tauri-apps/cli/tauri.js', [action, ...process.argv.slice(3)]);
}
