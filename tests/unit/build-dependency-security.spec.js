import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import AdmZip from 'adm-zip';
import postcss from 'postcss';
import { transformSync } from '@babel/core';
import selectorParser from 'postcss-selector-parser';
let fixture;
afterEach(() => {
  if (fixture) rmSync(fixture, { recursive: true, force: true });
  fixture = undefined;
});
describe('构建依赖安全补丁兼容', () => {
  it('ZIP生成与解压可往返，拒绝通过目标符号链接覆盖隔离哨兵', () => {
    fixture = mkdtempSync(join(tmpdir(), 'exam-zip-security-'));
    const output = join(fixture, 'output');
    mkdirSync(output);
    const sentinel = join(fixture, 'sentinel.txt');
    writeFileSync(sentinel, 'unchanged');
    const archive = new AdmZip();
    archive.addFile('folder/file.txt', Buffer.from('中文学习材料'));
    const loaded = new AdmZip(archive.toBuffer());
    expect(loaded.readAsText('folder/file.txt')).toBe('中文学习材料');
    loaded.extractAllTo(output, true);
    expect(readFileSync(join(output, 'folder/file.txt'), 'utf8')).toBe('中文学习材料');
    symlinkSync(sentinel, join(output, 'sentinel.txt'));
    const attack = new AdmZip();
    attack.addFile('sentinel.txt', Buffer.from('must not overwrite'));
    expect(() => attack.extractAllTo(output, true)).toThrow();
    expect(readFileSync(sentinel, 'utf8')).toBe('unchanged');
  });
  it('无from的CSS来源映射不能读取用户指定的本机map', async () => {
    fixture = mkdtempSync(join(tmpdir(), 'exam-css-security-'));
    const file = join(fixture, 'private.map');
    writeFileSync(
      file,
      JSON.stringify({
        version: 3,
        sources: ['PRIVATE_SENTINEL'],
        sourcesContent: ['PRIVATE_SENTINEL'],
        names: [],
        mappings: 'AAAA'
      })
    );
    const result = await postcss([]).process(`a{color:red}/*# sourceMappingURL=${file} */`, { map: { inline: false } });
    expect(result.css).toContain('color:red');
    expect(JSON.stringify(result.map?.toJSON() || {})).not.toContain('PRIVATE_SENTINEL');
  });
  it('编译JavaScript只读取包内来源映射，拒绝绝对路径与上级目录越界', () => {
    fixture = mkdtempSync(join(tmpdir(), 'exam-babel-security-'));
    const project = join(fixture, 'project');
    mkdirSync(project);
    writeFileSync(join(project, 'package.json'), '{}');
    const sourceMap = (name) => JSON.stringify({ version: 3, sources: [name], names: [], mappings: 'AAAA' });
    const privateMap = join(fixture, 'private.map');
    writeFileSync(privateMap, sourceMap('PRIVATE_SENTINEL'));
    writeFileSync(join(project, 'local.map'), sourceMap('LOCAL_ALLOWED'));
    const compile = (reference) =>
      transformSync(`const result = 1;\n//# sourceMappingURL=${reference}`, {
        root: project,
        filename: join(project, 'input.js'),
        configFile: false,
        babelrc: false,
        sourceMaps: true
      });
    for (const reference of [privateMap, '../private.map']) {
      const result = compile(reference);
      expect(result.code).toContain('const result = 1');
      expect(JSON.stringify(result.map)).not.toContain('PRIVATE_SENTINEL');
    }
    expect(JSON.stringify(compile('local.map').map)).toContain('LOCAL_ALLOWED');
  });
  it('正常CSS选择器保持兼容，深层AST序列化/遍历/复制有界拒绝', () => {
    const normal = '.question > :is(.answer, [data-label="中文"]):not(.disabled)';
    expect(selectorParser().processSync(normal)).toBe(normal);
    const root = selectorParser.root();
    let parent = root;
    for (let index = 0; index < 300; index++) {
      const selector = selectorParser.selector();
      const pseudo = selectorParser.pseudo({ value: ':is' });
      parent.append(selector);
      selector.append(pseudo);
      parent = pseudo;
    }
    parent.append(selectorParser.className({ value: 'answer' }));
    for (const operation of [() => root.toString(), () => root.walk(() => {}), () => root.clone()]) {
      expect(operation).toThrow(/nesting depth/i);
    }
  });
});
