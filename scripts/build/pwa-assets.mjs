import fs from 'node:fs';
import path from 'node:path';

const PWA_ICON_FILENAMES = ['icon-192x192.png', 'icon-512x512-maskable.png', 'icon-512x512.png'];

export function copyPwaRuntimeAssets({ sourceFile, outDir, registerSourceFile }) {
  if (!sourceFile || !outDir || !fs.existsSync(sourceFile)) throw new Error('PWA cache cleanup source is required');
  fs.mkdirSync(outDir, { recursive: true });
  fs.copyFileSync(sourceFile, path.join(outDir, 'sw-cache-cleanup.js'));
  if (registerSourceFile) {
    if (!fs.existsSync(registerSourceFile)) throw new Error('PWA update registration source is required');
    fs.copyFileSync(registerSourceFile, path.join(outDir, 'registerSW.js'));
  }
}

export function copyPwaIconAssets({ sourceDir, outDir }) {
  if (!sourceDir || !outDir || !fs.existsSync(sourceDir)) return [];

  const targetDir = path.join(outDir, 'static/pwa-icons');
  fs.mkdirSync(targetDir, { recursive: true });

  const copied = [];
  for (const filename of PWA_ICON_FILENAMES) {
    const source = path.join(sourceDir, filename);
    if (!fs.existsSync(source)) continue;

    fs.copyFileSync(source, path.join(targetDir, filename));
    copied.push(filename);
  }

  return copied;
}
