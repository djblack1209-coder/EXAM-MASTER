import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vueParser from 'vue-eslint-parser';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const sourceExtensions = new Set(['.js', '.mjs', '.cjs', '.ts', '.vue', '.py', '.sh', '.css', '.scss']);
const excluded = /(^|\/)(node_modules|uni_modules|dist|tmp|output|logs|\.git|__pycache__)(\/|$)/;

export function literalImports(content, file) {
  if (file.endsWith('.ts')) {
    const text = content.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    return [...text.matchAll(/(?:\bfrom\s*|\b(?:import|require)\s*\(\s*|\bimport\s*)['"]([^'"]+)['"]/g)].map(
      (m) => m[1]
    );
  }
  const input = content.replace(/^#![^\n]*/, (line) => ' '.repeat(line.length));
  const { ast } = vueParser.parseForESLint(input, { ecmaVersion: 2022, sourceType: 'module', filePath: file });
  const references = new Set();
  const seen = new WeakSet();
  function visit(node) {
    if (!node || typeof node !== 'object' || seen.has(node)) return;
    seen.add(node);
    if (
      ['ImportDeclaration', 'ExportNamedDeclaration', 'ExportAllDeclaration', 'ImportExpression'].includes(node.type) &&
      typeof node.source?.value === 'string'
    )
      references.add(node.source.value);
    if (
      node.type === 'CallExpression' &&
      node.callee?.type === 'Identifier' &&
      node.callee.name === 'require' &&
      typeof node.arguments?.[0]?.value === 'string'
    )
      references.add(node.arguments[0].value);
    for (const [key, value] of Object.entries(node)) {
      if (['parent', 'tokens', 'comments', 'templateBody'].includes(key)) continue;
      if (Array.isArray(value)) value.forEach(visit);
      else visit(value);
    }
  }
  visit(ast);
  return [...references];
}

export function resolveLocalReference(file, reference, projectRoot = root) {
  const clean = reference.split(/[?#]/)[0];
  let base;
  if (clean.startsWith('@/')) base = path.join(projectRoot, 'src', clean.slice(2));
  else if (clean.startsWith('.')) base = path.resolve(projectRoot, path.dirname(file), clean);
  else return null;
  const candidates = [base];
  if (base.endsWith('.js')) candidates.push(base.slice(0, -3) + '.ts', base.slice(0, -3) + '.d.ts');
  for (const ext of ['.js', '.mjs', '.ts', '.vue', '.json', '.scss', '.css']) {
    candidates.push(base + ext, path.join(base, 'index' + ext));
  }
  const found = candidates.find((candidate) => existsSync(candidate) && statSync(candidate).isFile());
  return found ? path.relative(projectRoot, found).split(path.sep).join('/') : false;
}

export function scanRepository(projectRoot = root) {
  const listed = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], {
    cwd: projectRoot,
    encoding: 'utf8'
  }).split('\0');
  const files = [...new Set(listed)].filter((file) => file && !excluded.test(file));
  const existing = files.filter((file) => existsSync(path.join(projectRoot, file)));
  const sources = existing.filter((file) => sourceExtensions.has(path.extname(file)));
  const documents = existing.filter((file) => file.endsWith('.md'));
  const missingImports = [];
  const parseErrors = [];
  const brokenLinks = [];
  const imports = [];
  const hashes = new Map();
  let sourceBytes = 0;
  for (const file of sources) {
    const raw = readFileSync(path.join(projectRoot, file));
    sourceBytes += raw.length;
    const hash = createHash('sha256').update(raw).digest('hex');
    hashes.set(hash, [...(hashes.get(hash) || []), file]);
    if (!/\.(?:[cm]?js|ts|vue)$/.test(file)) continue;
    let references;
    try {
      references = literalImports(raw.toString(), file);
    } catch (error) {
      parseErrors.push({ file, message: error.message });
      continue;
    }
    for (const reference of references) {
      const target = resolveLocalReference(file, reference, projectRoot);
      if (target === null) continue;
      if (target === false) missingImports.push({ file, reference });
      else imports.push({ file, target });
    }
  }
  for (const file of documents) {
    const text = readFileSync(path.join(projectRoot, file), 'utf8').replace(/```[\s\S]*?```/g, '');
    for (const match of text.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g)) {
      const link = match[1]
        .trim()
        .replace(/^<|>$/g, '')
        .split(/\s+["']/)[0];
      if (/^(?:[a-z][a-z\d+.-]*:|#|\/)/i.test(link)) continue;
      let target;
      try {
        target = decodeURI(link.split('#')[0]);
      } catch {
        brokenLinks.push({ file, link });
        continue;
      }
      if (target && !existsSync(path.resolve(projectRoot, path.dirname(file), target))) {
        brokenLinks.push({ file, link });
      }
    }
  }
  const referenced = new Set(imports.map((entry) => entry.target));
  const reviewCandidates = sources.filter(
    (file) =>
      /^src\/(?:components|services|composables|utils)\//.test(file) &&
      /\.(js|vue)$/.test(file) &&
      !referenced.has(file)
  );
  const missingScripts = [];
  for (const manifest of ['package.json', 'laf-backend/package.json', 'laf-backend/standalone/package.json']) {
    if (!existing.includes(manifest)) continue;
    const pkg = JSON.parse(readFileSync(path.join(projectRoot, manifest), 'utf8'));
    for (const [name, command] of Object.entries(pkg.scripts || {})) {
      for (const match of command.matchAll(/(?:^|\s)(scripts\/[\w./-]+\.(?:js|mjs|py|sh))/g)) {
        if (!existsSync(path.resolve(projectRoot, path.dirname(manifest), match[1]))) {
          missingScripts.push({ manifest, name, target: match[1] });
        }
      }
    }
  }
  return {
    generatedAt: new Date().toISOString(),
    counts: {
      existing: existing.length,
      missingTracked: files.length - existing.length,
      sources: sources.length,
      documents: documents.length,
      sourceBytes
    },
    missingImports,
    parseErrors,
    missingScripts,
    brokenLinks,
    exactSourceDuplicates: [...hashes.values()].filter((group) => group.length > 1),
    reviewCandidates,
    limitations: [
      'JS/Vue literal imports use AST; TypeScript uses a conservative textual inventory. Dynamic loaders, auto-imports and platform branches require manual review.',
      'No files are deleted or executed. Secrets, ignored data and third-party vendored code are excluded.',
      'Zero inbound literal references do not prove a module is unused.'
    ]
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const report = scanRepository();
  const output = path.join(root, 'tmp/maintenance/repository-health.json');
  mkdirSync(path.dirname(output), { recursive: true });
  writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
  console.log(
    JSON.stringify({
      ...report.counts,
      missingImports: report.missingImports.length,
      parseErrors: report.parseErrors.length,
      missingScripts: report.missingScripts.length,
      brokenLinks: report.brokenLinks.length,
      duplicateGroups: report.exactSourceDuplicates.length,
      reviewCandidates: report.reviewCandidates.length,
      output
    })
  );
  if (
    process.argv.includes('--strict') &&
    (report.missingScripts.length ||
      report.brokenLinks.length ||
      report.parseErrors.length ||
      report.missingImports.some((item) => !item.file.startsWith('tests/')))
  )
    process.exitCode = 1;
}
