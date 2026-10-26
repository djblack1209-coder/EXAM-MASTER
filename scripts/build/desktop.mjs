#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, lstatSync, mkdirSync, realpathSync, renameSync } from 'node:fs';

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
  if (code) throw Object.assign(new Error(`desktop command exited ${code}`), { exitCode: code });
}

async function shelterBundle() {
  if (process.platform !== 'darwin') return;
  const source = resolve(root, 'src-tauri/target/release/bundle/macos/Yozi AI.app');
  if (!existsSync(source)) return;
  if (lstatSync(source).isSymbolicLink() || realpathSync(source) !== source)
    throw new Error('Bundle path must be local');
  const directory = resolve(
    root,
    process.env.YOZI_DESKTOP_BUNDLE_DIR || `tmp/desktop-candidate-${Date.now()}-${process.pid}.noindex`
  );
  if (!directory.startsWith(`${root}/tmp/`) || !directory.endsWith('.noindex'))
    throw new Error('Candidate must remain in tmp/*.noindex');
  mkdirSync(directory, { recursive: true });
  if (realpathSync(directory) !== directory || existsSync(resolve(directory, 'Yozi AI.app')))
    throw new Error('Preserve existing candidate; choose an unused .noindex directory');
  let code;
  try {
    const native = (command, args) =>
      new Promise((res, rej) => {
        const task = spawn(command, args, { stdio: 'inherit' });
        child = task;
        task.once('error', rej);
        task.once('exit', (status) => {
          if (child === task) child = null;
          res(status ?? 1);
        });
      });
    // The Rust binary's linker signature alone is not a valid bundle signature.
    // Preserve a configured distribution identity; local unsigned candidates get an ad-hoc seal.
    if (
      !process.env.APPLE_SIGNING_IDENTITY &&
      (await native('/usr/bin/codesign', ['--verify', '--deep', '--strict', source]))
    ) {
      if (await native('/usr/bin/codesign', ['--force', '--sign', '-', '--timestamp=none', source]))
        throw new Error('Local candidate signing failed');
    }
    if (await native('/usr/bin/codesign', ['--verify', '--deep', '--strict', source]))
      throw new Error('Candidate signature verification failed');
    // Unregister while the bundle exists: lsregister cannot resolve a moved path.
    code = await native(
      '/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister',
      ['-u', source]
    );
  } finally {
    // Retain the bundle in .noindex even if the system registration service fails.
    renameSync(source, resolve(directory, 'Yozi AI.app'));
  }
  if (code) throw new Error(`Candidate retained; Launch Services unregister exited ${code}`);
  console.info(`[desktop] Candidate retained at ${directory}/Yozi AI.app`);
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
  try {
    await run('node_modules/@tauri-apps/cli/tauri.js', [action, ...process.argv.slice(3)]);
  } finally {
    // Failed/cancelled packaging may also have produced an indexed bundle.
    if (action === 'build') await shelterBundle();
  }
}
