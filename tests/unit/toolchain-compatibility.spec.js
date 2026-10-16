// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { execFileSync, spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { once } from 'node:events';
import {
  lstatSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readlinkSync,
  rmSync,
  symlinkSync,
  writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { hfs } from '@humanfs/node';
import AdmZip from 'adm-zip';
const require = createRequire(import.meta.url);
const qs = require('qs');
const serialize = require('serialize-javascript');
const Jimp = require('jimp');
const selector = require('postcss-selector-parser');
const sourceMap = require('source-map-js');
const postcss = require('postcss');
const scopedStyle = require('@dcloudio/uni-cli-shared/dist/postcss/plugins/stylePluginScoped.js').default;
const vue = require('vue');
const serverRenderer = require('@vue/server-renderer');
let fixture;
afterEach(() => {
  if (fixture) rmSync(fixture, { recursive: true, force: true });
  fixture = undefined;
});
describe('开发工具链升级的真实依赖兼容', () => {
  it('真实Rollup模块图拒绝内部/外部braces，普通模块仍可产出', () => {
    const probe = spawnSync(
      process.execPath,
      [
        '--input-type=module',
        '-e',
        `
import assert from 'node:assert/strict';
import { rollup } from 'rollup';
import { guardRuntimeBuildDependencies } from './vite.config.js';
const guard = guardRuntimeBuildDependencies();
assert.equal(guard.apply, 'build');
const paths = [
  'braces',
  'braces/lib/compile.js',
  '\\0braces?commonjs-external',
  '/project/node_modules/braces/index.js',
  '/project/node_modules/.pnpm/braces@3.0.3/node_modules/braces/lib/expand.js',
  'C:\\\\project\\\\node_modules\\\\braces\\\\index.js'
];
for (const target of [...paths, 'external:braces', 'safe']) {
  const external = target === 'external:braces';
  const safe = target === 'safe';
  let bundle;
  try {
    bundle = await rollup({
      input: 'entry',
      onwarn() {},
      onLog() {},
      plugins: [{
        name: 'owned-runtime-fixture',
        resolveId(id) {
          if (id === 'entry') return id;
          if (id === 'fixture') return external ? { id: 'braces', external: true } : target;
        },
        load(id) {
          if (id === 'entry') return safe
            ? 'export const original = "原答保持";'
            : 'export { original } from "fixture";';
          return 'export const original = "fixture";';
        }
      }, guard]
    });
    const result = bundle.generate({ format: 'es' });
    if (safe) assert.match((await result).output[0].code, /原答保持/);
    else await assert.rejects(result, /Unresolved braces dependency/);
  } finally {
    await bundle?.close();
  }
}
process.stdout.write(JSON.stringify({ rejected: paths.length + 1, safe: true }));`
      ],
      {
        timeout: 10000,
        maxBuffer: 4096,
        encoding: 'utf8',
        env: { PATH: process.env.PATH, NODE_ENV: 'test', WENLI_ISOLATED_BUILD: '1' }
      }
    );
    expect(probe.error).toBeUndefined();
    expect(probe.status, probe.stderr).toBe(0);
    expect(JSON.parse(probe.stdout.trim().split('\n').at(-1))).toEqual({ rejected: 7, safe: true });
  });

  it('真实H5动态插槽可更新、清空和重挂，旧只读标记错误可复现', () => {
    const probe = spawnSync(
      process.execPath,
      [
        '--input-type=module',
        '-e',
        `
import { Window } from 'happy-dom';
import Module, { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { adaptH5SlotFlags } from './vite.config.js';
const require = createRequire(import.meta.url);
const file = require.resolve('@dcloudio/uni-h5-vue/dist/vue.runtime.cjs.js');
const original = fs.readFileSync(file, 'utf8');
const patched = adaptH5SlotFlags(true).transform(original, file);
assert.equal(adaptH5SlotFlags(false).transform(original, file), undefined);
assert.equal(adaptH5SlotFlags(true).transform(original, '/other-runtime.js'), undefined);
const results = [];
for (const adapted of [false, true]) {
  const window = new Window();
  for (const key of ['window','document','Node','Element','HTMLElement','SVGElement','ShadowRoot','navigator'])
    Object.defineProperty(globalThis, key, { value: window[key], configurable: true });
  globalThis.__UNI_FEATURE_WXS__ = false;
  const runtime = new Module(file);
  runtime.filename = file;
  runtime.paths = Module._nodeModulePaths(path.dirname(file));
  runtime._compile(adapted ? patched : original, file);
  const Vue = runtime.exports;
  const View = { setup(_, ctx) { return () => Vue.h('div', null, [Vue.renderSlot(ctx.slots, 'default')]); } };
  const root = document.createElement('div');
  document.body.append(root);
  const slots = value => ({ default: () => value ? [Vue.h('p', value)] : [], _: 2 });
  Vue.render(Vue.h(View, null, slots('原答6/8')), root);
  const update = () => Vue.render(Vue.h(View, null, slots('反馈与变式')), root);
  if (!adapted) assert.throws(update, /read only property '_'/);
  else {
    update();
    assert.equal(root.textContent, '反馈与变式');
    Vue.render(Vue.h(View, null, slots('')), root);
    assert.equal(root.textContent, '');
    Vue.render(null, root);
    Vue.render(Vue.h(View, null, slots('重开原答6/8')), root);
    assert.equal(root.textContent, '重开原答6/8');
    Vue.render(null, root);
  }
  await window.happyDOM.abort();
  results.push({ adapted });
}
process.stdout.write(JSON.stringify(results));`
      ],
      { timeout: 10000, maxBuffer: 4096, encoding: 'utf8', env: { PATH: process.env.PATH, NODE_ENV: 'test' } }
    );
    expect(probe.error).toBeUndefined();
    expect(probe.status, probe.stderr).toBe(0);
    expect(JSON.parse(probe.stdout)).toHaveLength(2);
  });
  it.each(['\r', '\n', '\t', '\f', ' '])('真实SSR拒绝%s拆分属性，合法中文与转义值保持', (space) => {
    const attributes = serverRenderer.ssrRenderAttrs({
      [`data-first${space}data-second`]: 'marker',
      'data-safe': '<课堂>&"'
    });
    expect(attributes).not.toContain('data-second');
    expect(attributes).toContain(' data-safe="&lt;课堂&gt;&amp;&quot;"');
  });
  it('真实Vue组件的SSR正文和正常属性保持，不能从不可信键产生第二个属性', async () => {
    const html = await serverRenderer.renderToString(
      vue.createSSRApp({
        render: () => vue.h('section', { 'data-first\rdata-second': 'marker', 'data-name': '课堂' }, '原答<保持>')
      })
    );
    expect(html).not.toContain('data-second');
    expect(html).toContain('data-name="课堂"');
    expect(html).toContain('原答&lt;保持&gt;');
  });
  it.each([
    '.a:hover > .b[data-name="中文"]',
    'page .root::before',
    '.foo ::v-deep(.bar)',
    ':is(.a,.b) .c',
    ':global(.root) .local',
    '.a\\:b#c',
    '[xlink|href="x"]',
    '#{$name} .item',
    'view + text',
    'button[disabled]',
    '.card:has(> .title)',
    '[data-test="a,b"]'
  ])('修补选择器仍保持有效CSS：%s', (input) => {
    expect(selector().processSync(input)).toBe(input);
  });
  it.each([
    ['.card :deep(.title){color:purple}', '.card .title{color:purple}'],
    [':global(.theme) .card{color:blue}', '.theme{color:blue}'],
    [':slotted(.answer){display:block}', '.answer{display:block}']
  ])('uni-app实际深层/全局/插槽处理保持：%s', (css, expected) => {
    expect(postcss([scopedStyle()]).process(css, { from: undefined }).css).toBe(expected);
  });
  it('十万个平面class选择器在原受限子进程完成，遍历和构造接口保持', () => {
    const probe = spawnSync(
      process.execPath,
      [
        '--max-old-space-size=192',
        '-e',
        `const parser = require('postcss-selector-parser'); const input = '.a'.repeat(100000); if (parser().processSync(input) !== input) process.exit(2); process.stdout.write('preserved');`
      ],
      { timeout: 2000, maxBuffer: 2048, encoding: 'utf8', env: { PATH: process.env.PATH } }
    );
    expect(probe.error).toBeUndefined();
    expect(probe.status).toBe(0);
    expect(probe.stdout).toBe('preserved');
    expect(
      selector((root) =>
        root.walkClasses((node) => {
          node.value = 'review-' + node.value;
        })
      ).processSync('.card > .answer')
    ).toBe('.review-card > .review-answer');
  });
  it('正常源码映射位置与源码正文完整往返，不改变构建内容', () => {
    const generator = new sourceMap.SourceMapGenerator({ file: 'built.js' });
    generator.addMapping({
      generated: { line: 1, column: 0 },
      original: { line: 3, column: 2 },
      source: 'original.js'
    });
    generator.setSourceContent('original.js', 'const answer = 3;');
    const consumer = new sourceMap.SourceMapConsumer(generator.toJSON());
    expect(consumer.originalPositionFor({ line: 1, column: 0 })).toMatchObject({
      source: 'original.js',
      line: 3,
      column: 2
    });
    const node = sourceMap.SourceNode.fromStringWithSourceMap('answer();\n', consumer);
    expect(node.toStringWithSourceMap({ file: 'built.js' }).code).toBe('answer();\n');
    expect(node.toStringWithSourceMap({ file: 'built.js' }).map.toJSON().sourcesContent).toEqual(['const answer = 3;']);
  });
  it.each([-1, 1.5, Infinity, '1', null, 1000000000])('无效/过大索引行%s在构造时拒绝', (line) => {
    expect(
      () =>
        new sourceMap.SourceMapConsumer({
          version: 3,
          sections: [
            { offset: { line, column: 0 }, map: { version: 3, sources: ['original.js'], names: [], mappings: 'AAAA' } }
          ]
        })
    ).toThrow(/offset.*(?:integers|exceed)/i);
  });
  it('嵌套索引偏移不能突破总上限；允许范围内但超出正文的行在子进程有界退出', () => {
    const map = { version: 3, sources: ['original.js'], names: [], mappings: 'AAAA' };
    expect(
      () =>
        new sourceMap.SourceMapConsumer({
          version: 3,
          sections: [
            {
              offset: { line: 9999999, column: 0 },
              map: { version: 3, sections: [{ offset: { line: 100, column: 0 }, map }] }
            }
          ]
        })
    ).toThrow(/offset.*exceed/i);
    const probe = spawnSync(
      process.execPath,
      [
        '--max-old-space-size=64',
        '-e',
        `const s=require('source-map-js'); const m={version:3,sections:[{offset:{line:1000000,column:0},map:{version:3,sources:['original.js'],sourcesContent:['original();'],names:[],mappings:'AAAA'}}]}; const node=s.SourceNode.fromStringWithSourceMap(${JSON.stringify('answer();\n')},new s.SourceMapConsumer(m));process.stdout.write(node.toString());`
      ],
      { timeout: 2000, maxBuffer: 2048, encoding: 'utf8', env: { PATH: process.env.PATH } }
    );
    expect(probe.error).toBeUndefined();
    expect(probe.status).toBe(0);
    expect(probe.stdout).toBe('answer();\n');
  });
  it('真实CJS调用已修复ESM解析器：零长度ASF和大ZIP探测在受限子进程终止', () => {
    const asf = Buffer.alloc(54);
    Buffer.from('3026b2758e66cf11a6d900aa0062ce6c', 'hex').copy(asf);
    asf.writeBigUInt64LE(54n, 16);
    asf.writeUInt32LE(1, 24);
    asf[28] = 1;
    asf[29] = 2;
    const zip = new AdmZip();
    zip.addFile('[Content_Types].xml', Buffer.alloc(2 * 1048576, 65));
    const code = `
      const fs = require('node:fs'), detector = require('file-type');
      const input = JSON.parse(fs.readFileSync(0, 'utf8'));
      (async () => {
        const results = [];
        for (const value of input) {
          try { results.push((await detector.fromBuffer(Buffer.from(value, 'base64')))?.ext || null); }
          catch { results.push('rejected'); }
        }
        process.stdout.write(JSON.stringify(results));
      })().catch(() => process.exit(1));
    `;
    const actual = JSON.parse(
      execFileSync(process.execPath, ['--max-old-space-size=64', '-e', code], {
        input: JSON.stringify([asf.toString('base64'), zip.toBuffer().toString('base64')]),
        encoding: 'utf8',
        timeout: 2000,
        env: { PATH: process.env.PATH }
      })
    );
    expect(actual).toHaveLength(2);
    expect(['zip', 'rejected', null]).toContain(actual[1]);
  });
  it('查询字符串正常往返，攻击性constructor.isBuffer不使序列化崩溃', () => {
    const query = qs.parse('goal[title]=%E4%B8%AD%E6%96%87&goal[tasks][0]=review');
    expect(qs.parse(qs.stringify(query))).toEqual(query);
    const attack = qs.parse('constructor[isBuffer]=not-a-function', { allowPrototypes: true });
    expect(() => qs.stringify(attack)).not.toThrow();
    expect({}.isBuffer).toBeUndefined();
  });
  it('递归复制普通文件，但符号链接保持链接，不读取外部正文写入复制件', async () => {
    fixture = mkdtempSync(join(tmpdir(), 'exam-humanfs-'));
    const source = join(fixture, 'source'),
      output = join(fixture, 'output'),
      privateDir = join(fixture, 'private');
    mkdirSync(source);
    mkdirSync(privateDir);
    writeFileSync(join(source, 'known.txt'), '正常构建文件');
    writeFileSync(join(privateDir, 'sentinel.txt'), 'PRIVATE_SENTINEL');
    symlinkSync(privateDir, join(source, 'outside'));
    symlinkSync(join(privateDir, 'sentinel.txt'), join(source, 'outside-file'));
    await hfs.copyAll(source, output);
    expect(readFileSync(join(output, 'known.txt'), 'utf8')).toBe('正常构建文件');
    expect(lstatSync(join(output, 'outside')).isSymbolicLink()).toBe(true);
    expect(lstatSync(join(output, 'outside-file')).isSymbolicLink()).toBe(true);
    expect(readlinkSync(join(output, 'outside'))).toBe(privateDir);
  });
  it('序列化配置仍支持日期/正则/中文，并拒绝伪造日期和正则注入', () => {
    const value = serialize({ title: '问理', pattern: /question/giu, at: new Date('2026-09-30T00:00:00Z') });
    expect(value).toContain('问理');
    expect(value).toContain('new Date(');
    expect(value).toContain('new RegExp(');
    expect(serialize({ content: '</script><script>sentinel</script>' })).not.toContain('</script>');
    const date = new Date('2026-09-30T00:00:00Z');
    date.toISOString = () => '");PRIVATE_SENTINEL();//';
    expect(() => serialize(date)).toThrow('Invalid Date');
    const pattern = /safe/g;
    Object.defineProperty(pattern, 'flags', { value: '");PRIVATE_SENTINEL();//' });
    expect(serialize(pattern)).not.toContain('PRIVATE_SENTINEL');
    expect(() => serialize({ 0: 'x', length: Number.MAX_SAFE_INTEGER })).not.toThrow();
  });
  it('Jimp PNG/JPEG读取与缩放、HTTP图片读取保持旧调用方式', async () => {
    const image = new Jimp(20, 16, 0x2468acff);
    const png = await image.getBufferAsync(Jimp.MIME_PNG),
      jpeg = await image.getBufferAsync(Jimp.MIME_JPEG);
    expect((await Jimp.read(png)).resize(10, 8).bitmap).toMatchObject({ width: 10, height: 8 });
    expect((await Jimp.read(jpeg)).bitmap).toMatchObject({ width: 20, height: 16 });
    const server = createServer((req, res) => {
      res.setHeader('Content-Type', 'image/png');
      res.end(png);
    });
    try {
      server.listen(0, '127.0.0.1');
      await once(server, 'listening');
      const remote = await Jimp.read(`http://127.0.0.1:${server.address().port}/fixture.png`);
      expect(remote.bitmap).toMatchObject({ width: 20, height: 16 });
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });
  it('微信自动化QR解码真实读取合成PNG，升级Jimp不破坏已有工具', async () => {
    const QRCode = require('qrcode-terminal/vendor/QRCode');
    const qr = new QRCode(-1, 1);
    const message = 'wenli-isolated-fixture';
    qr.addData(message);
    qr.make();
    const scale = 8,
      padding = 4,
      size = (qr.getModuleCount() + padding * 2) * scale;
    const image = new Jimp(size, size, 0xffffffff);
    for (let y = 0; y < qr.getModuleCount(); y++)
      for (let x = 0; x < qr.getModuleCount(); x++) {
        if (!qr.isDark(y, x)) continue;
        for (let dy = 0; dy < scale; dy++)
          for (let dx = 0; dx < scale; dx++)
            image.setPixelColor(0x000000ff, (x + padding) * scale + dx, (y + padding) * scale + dy);
      }
    const { decodeQrCode } = require('miniprogram-automator/out/util.js');
    expect(await decodeQrCode((await image.getBufferAsync(Jimp.MIME_PNG)).toString('base64'))).toBe(message);
  });
  it.each(['ws', 'miniprogram-automator/node_modules/ws'])(
    '%s真实本机WebSocket中文往返，显式片段预算拒绝攻击输入',
    async (path) => {
      const WebSocket = require(path);
      const Server = WebSocket.Server;
      const server = new Server({
        host: '127.0.0.1',
        port: 0,
        maxPayload: 1024,
        maxFragments: 2,
        maxBufferedChunks: 8
      });
      let client;
      let fragmentError;
      try {
        await once(server, 'listening');
        server.on('connection', (socket) => {
          socket.on('error', (error) => {
            fragmentError = error;
          });
          socket.on('message', (value) => socket.send(value));
        });
        client = new WebSocket(`ws://127.0.0.1:${server.address().port}`);
        await once(client, 'open');
        const response = once(client, 'message');
        client.send('中文学习');
        expect((await response)[0].toString()).toBe('中文学习');
        const closed = once(client, 'close');
        client.send('a', { fin: false });
        client.send('b', { fin: false });
        client.send('c', { fin: true });
        expect([1008, 1006]).toContain((await closed)[0]);
        expect(fragmentError?.message).toMatch(/Too many message fragments/);
      } finally {
        client?.terminate();
        for (const socket of server.clients) socket.terminate();
        await new Promise((resolve) => server.close(resolve));
      }
    }
  );
});
