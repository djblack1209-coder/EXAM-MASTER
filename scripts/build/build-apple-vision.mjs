import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../../', import.meta.url));
if (process.argv.slice(2).join(' ') !== '--build-only')
  throw new Error('必须明确--build-only；仅在本机编译，不下载/安装/部署');
if (process.platform !== 'darwin') {
  console.error('真实macOS SDK不可用，未构建Apple Vision适配器');
  process.exitCode = 2;
} else {
  const sdk = spawnSync('xcrun', ['--show-sdk-path'], { encoding: 'utf8' });
  if (sdk.error || sdk.status !== 0) {
    console.error('真实macOS SDK不可用，未构建Apple Vision适配器');
    process.exitCode = 2;
  } else {
    const base = path.join(root, 'tmp/apple-vision-builds');
    await mkdir(base, { recursive: true });
    const work = await mkdtemp(path.join(base, 'build-'));
    const binary = path.join(work, 'wenli-apple-vision');
    try {
      const args = [
        'clang',
        '-fobjc-arc',
        '-fmodules',
        '-Wall',
        '-Werror',
        '-mmacosx-version-min=14.0',
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
        '-framework',
        'CoreText',
        'scripts/native/apple-vision.m',
        '-o',
        binary
      ];
      const r = spawnSync('xcrun', args, { cwd: root, encoding: 'utf8', timeout: 60000 });
      if (r.error || r.status !== 0)
        throw new Error('Apple Vision编译未通过：' + (r.stderr?.slice(0, 3000) || '编译器不可用'));
      const hash = (b) => createHash('sha256').update(b).digest('hex');
      const report = {
        built: true,
        binary,
        source: 'scripts/native/apple-vision.m',
        sourceSHA256: hash(await readFile(path.join(root, 'scripts/native/apple-vision.m'))),
        binarySHA256: hash(await readFile(binary)),
        sdk: sdk.stdout.trim(),
        scope: 'macOS14以上本机CLI，不是iOS/Android/微信设备桥',
        installed: false,
        deviceVerified: false
      };
      await writeFile(path.join(work, 'build-report.json'), JSON.stringify(report, null, 2) + '\n');
      console.log(JSON.stringify(report, null, 2));
    } catch (error) {
      await rm(work, { recursive: true, force: true });
      throw error;
    }
  }
}
