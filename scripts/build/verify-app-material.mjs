import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// 只在唯一忽略目录创建合成文件，不读生产配置/用户原件、不下载SDK、不发网络。
const root = fileURLToPath(new URL('../../', import.meta.url));
const output = path.join(root, 'tmp/app-material-validation');
await mkdir(output, { recursive: true });
const work = await mkdtemp(path.join(output, 'run-'));
const javaHome =
  process.env.YOZI_TEST_JAVA_HOME ||
  process.env.WENLI_TEST_JAVA_HOME ||
  '/opt/homebrew/opt/openjdk/libexec/openjdk.jdk/Contents/Home';
const sources = [
  'nativeplugins/Yozi-Connector/android/src/cn/yozi/connector/MaterialFiles.java',
  'nativeplugins/Yozi-Connector/android/src/cn/yozi/connector/ConnectorTransport.java',
  'nativeplugins/Yozi-Connector/ios/src/YoziMaterialFiles.h',
  'nativeplugins/Yozi-Connector/ios/src/YoziMaterialFiles.m',
  'tests/native/app-material/MaterialHarness.java',
  'tests/native/app-material/material-harness.m'
];
const checks = [];
const children = [];
function command(exe, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(exe, args, {
      cwd: root,
      env: { PATH: process.env.PATH, TMPDIR: work },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    children.push(child);
    let stdout = '',
      stderr = '';
    child.stdout.on('data', (b) => {
      stdout += b;
    });
    child.stderr.on('data', (b) => {
      stderr = (stderr + b).slice(-4000);
    });
    const timer = setTimeout(() => child.kill('SIGKILL'), 45000);
    child.once('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.once('exit', (code) => {
      clearTimeout(timer);
      code === 0 ? resolve(stdout.trim()) : reject(new Error(path.basename(exe) + ' 未通过 (' + code + '): ' + stderr));
    });
  });
}
let fatal;
try {
  assert.equal(process.platform, 'darwin', '双内核测试需要真实macOS Foundation');
  const classes = path.join(work, 'classes');
  await mkdir(classes);
  await command(path.join(javaHome, 'bin/javac'), [
    '--release',
    '8',
    '-d',
    classes,
    sources[0],
    sources[1],
    sources[4]
  ]);
  await command('xcrun', [
    'clang',
    '-fobjc-arc',
    '-fmodules',
    '-Wall',
    '-Werror',
    '-framework',
    'Foundation',
    '-I',
    'nativeplugins/Yozi-Connector/ios/src',
    sources[3],
    sources[5],
    '-o',
    path.join(work, 'foundation-harness')
  ]);
  for (const [kernel, exe, args] of [
    ['Java', path.join(javaHome, 'bin/java'), ['-cp', classes, 'MaterialHarness', path.join(work, 'java-fixtures')]],
    ['Foundation', path.join(work, 'foundation-harness'), [path.join(work, 'foundation-fixtures')]]
  ]) {
    const value = await command(exe, args);
    assert.equal(value.split('\n').at(-1), 'ok');
    for (const line of value.split('\n'))
      if (line.startsWith('check\t')) checks.push({ kernel, name: line.slice(6), passed: true });
    console.log(kernel + ': ' + checks.filter((c) => c.kernel === kernel).length + ' 项真实文件检查通过');
  }
} catch (error) {
  fatal = error.message;
  process.exitCode = 1;
} finally {
  for (const child of children) if (child.exitCode === null) child.kill('SIGKILL');
  await rm(work, { recursive: true, force: true });
  const sourceHashes = {};
  for (const source of sources)
    sourceHashes[source] = createHash('sha256')
      .update(await readFile(path.join(root, source)))
      .digest('hex');
  const report = {
    passed: !fatal,
    checks,
    ...(fatal ? { error: fatal } : {}),
    sourceHashes,
    scope:
      'macOS真实JDK文件/管道及Foundation NSFileCoordinator/FilePresenter/NSInputStream；不是DCloud SDK、系统文件选择器或移动安全作用域/设备验收',
    cleanup: { syntheticFilesAndBinariesRemoved: true, ownedChildrenStopped: true },
    externalCalls: 0
  };
  await writeFile(path.join(output, 'latest.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ passed: report.passed, checks: checks.length, ...(fatal ? { error: fatal } : {}) }));
}
