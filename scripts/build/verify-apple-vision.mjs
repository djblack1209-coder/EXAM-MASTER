import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../../', import.meta.url));
const base = path.join(root, 'tmp/apple-vision-validation');
await mkdir(base, { recursive: true });
const work = await mkdtemp(path.join(base, 'run-'));
const sources = [
  'scripts/native/apple-vision.m',
  'tests/native/apple-vision/generate-fixture.m',
  'tests/native/apple-vision/test_apple_vision.py',
  'scripts/pipeline/private-material-parser.py'
];
const checks = [];
let passed = false;
function command(exe, args, timeout = 45000) {
  return new Promise((resolve, reject) => {
    const child = spawn(exe, args, {
      cwd: root,
      env: { PATH: process.env.PATH, TMPDIR: '/tmp' },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let stdout = '',
      stderr = '';
    child.stdout.on('data', (b) => {
      stdout = (stdout + b).slice(-10000);
    });
    child.stderr.on('data', (b) => {
      stderr = (stderr + b).slice(-10000);
    });
    const timer = setTimeout(() => child.kill('SIGKILL'), timeout);
    child.once('error', (e) => {
      clearTimeout(timer);
      reject(e);
    });
    child.once('exit', (code) => {
      clearTimeout(timer);
      code === 0 ? resolve(stdout + stderr) : reject(new Error('本机Apple验证未通过 (' + code + '): ' + stderr));
    });
  });
}
try {
  assert.equal(process.platform, 'darwin', '真实macOS不可用');
  const common = ['clang', '-fobjc-arc', '-fmodules', '-Wall', '-Werror', '-mmacosx-version-min=14.0'];
  const binary = path.join(work, 'wenli-apple-vision'),
    generator = path.join(work, 'generate-fixture');
  await command('xcrun', [
    ...common,
    '-framework',
    'Foundation',
    '-framework',
    'Vision',
    '-framework',
    'CoreML',
    '-framework',
    'ImageIO',
    '-framework',
    'CoreGraphics',
    sources[0],
    '-o',
    binary
  ]);
  checks.push('实际macOS SDK编译CPU Vision');
  await command('xcrun', [
    ...common,
    '-framework',
    'Foundation',
    '-framework',
    'CoreGraphics',
    '-framework',
    'CoreText',
    '-framework',
    'ImageIO',
    sources[1],
    '-o',
    generator
  ]);
  await command(generator, [work]);
  checks.push('真实CoreText合成中英文印刷、方向、空白和扫描PDF');
  const log = await command(
    path.join(root, '.venv-baidu/bin/python'),
    ['-m', 'tests.native.apple-vision.test_apple_vision', binary, work],
    180000
  );
  await writeFile(path.join(work, 'native-suite.log'), log);
  assert.match(log, /Ran 11 tests/);
  assert.match(log, /\nOK\s*$/);
  checks.push('11项真实Vision/Poppler/HTTP验证，含许可、容量、候选、续页及删除');
  passed = true;
} catch (error) {
  await writeFile(path.join(work, 'failure.log'), error.message + '\n');
  process.exitCode = process.platform === 'darwin' ? 1 : 2;
} finally {
  const hashes = {};
  for (const source of sources)
    hashes[source] = createHash('sha256')
      .update(await readFile(path.join(root, source)))
      .digest('hex');
  const report = {
    passed,
    checks,
    sourceHashes: hashes,
    reportDirectory: work,
    scope: '真实本机macOS14以上CPU Vision/合成输入；不证明移动桥或真实手写质量',
    coldInitialization: '仅合成自检首次45秒，私人解析识别12秒',
    actualDevices: false,
    realSupplierCalls: 0,
    fees: 0,
    productionWrites: 0
  };
  for (const name of [
    'wenli-apple-vision',
    'generate-fixture',
    'printed.png',
    'printed.jpg',
    'oriented.jpg',
    'blank.png',
    'scanned.pdf'
  ])
    await rm(path.join(work, name), { force: true });
  report.ownedBinariesAndFixturesRemoved = true;
  await writeFile(path.join(work, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
}
