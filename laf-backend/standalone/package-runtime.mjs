import { copyFileSync, existsSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const backend = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(backend, 'standalone/dist');
if (!existsSync(path.join(output, 'standalone/server.js'))) throw new Error('Compile successfully before packaging.');

function walk(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(file);
    else if (entry.name.endsWith('.js') && entry.name !== 'ts-fsrs-bundle.js') {
      let content = readFileSync(file, 'utf8');
      let shim = path
        .relative(path.dirname(file), path.join(output, 'standalone/cloud-shim.js'))
        .split(path.sep)
        .join('/');
      if (!shim.startsWith('.')) shim = './' + shim;
      content = content.replace(/(['"])@lafjs\/cloud\1/g, (_, quote) => quote + shim + quote);
      if (/require\(['"](?:\.\/|\.\/_shared\/)ts-fsrs-bundle['"]\)/.test(content)) {
        content = content.replace(
          /require\((['"])(\.\/(?:_shared\/)?)ts-fsrs-bundle\1\)/g,
          'require($1$2ts-fsrs-bundle.cjs$1)'
        );
        content =
          "import { createRequire } from 'node:module';\nconst require = createRequire(import.meta.url);\n" + content;
      }
      writeFileSync(file, content);
    }
  }
}

walk(output);
const bundle = path.join(output, 'functions/_shared/ts-fsrs-bundle.js');
// The vendored .ts file is already JavaScript/CommonJS. Copy its bytes unchanged;
// TypeScript's Node16 emit appends `export {}`, which is invalid in CommonJS.
copyFileSync(path.join(backend, 'functions/_shared/ts-fsrs-bundle.ts'), bundle.replace(/\.js$/, '.cjs'));
if (existsSync(bundle)) unlinkSync(bundle);
for (const entry of readdirSync(path.join(backend, 'functions'))) {
  if (entry.endsWith('.yaml'))
    copyFileSync(path.join(backend, 'functions', entry), path.join(output, 'functions', entry));
}
// Native ESM resolution searches ancestors, not NODE_PATH or a sibling node_modules.
writeFileSync(path.join(output, 'package.json'), JSON.stringify({ type: 'module', private: true }) + '\n');
console.log('Packaged native ESM functions, cloud adapter, metadata and unchanged CommonJS FSRS bundle.');
