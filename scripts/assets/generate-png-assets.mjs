#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { homedir } from 'node:os';

const PROJECT_ROOT = resolve(new URL('../..', import.meta.url).pathname);
const DEFAULT_PROMPT_DOC = resolve(PROJECT_ROOT, 'docs/07-STYLING-SYSTEM.md');
const DEFAULT_OUTPUT_ROOT = resolve(PROJECT_ROOT, 'asset-inbox/png-redesign');
const DEFAULT_API_BASE_URL = 'https://api1.zhongzhuan.win';
const DEFAULT_IMAGE_MODEL = 'gpt-image-2';
const DEFAULT_IMAGE_MODEL_2K = 'gpt-image-2-2k';
const DEFAULT_MANIFEST_NAME = 'manifest.json';
const DEFAULT_GLOBAL_DIRECTION =
  'Modern premium exam preparation app asset, mature green education product, white and mint palette, primary green #9FE870, deep green #163300, glass-like depth where useful, crisp mobile-app details, quiet and professional.';
const DEFAULT_NEGATIVE_PROMPT =
  'No owl, no bird mascot, no childish mascot, no emoji, no sticker style, no graduation cap, no trophy, no rocket, no flame, no coins, no swords, no institution names, no teacher names, no QR code, no watermark, no readable text, no purple blue gradient, no beige brown theme, no clutter, no low resolution.';
const DEFAULT_PNG_SCAN_ROOTS = ['src', 'public/static', 'cdn-assets'];

function parseArgs(argv) {
  const args = {
    promptDoc: DEFAULT_PROMPT_DOC,
    outputRoot: DEFAULT_OUTPUT_ROOT,
    dryRun: false,
    limit: 0,
    only: '',
    modelPolicy: 'auto',
    requestSize: '1024x1024',
    retries: 2,
    skipExisting: false,
    validateOnly: false,
    manifestPath: ''
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--prompt-doc') args.promptDoc = resolve(argv[++i]);
    else if (arg === '--output-root') args.outputRoot = resolve(argv[++i]);
    else if (arg === '--limit') args.limit = Number(argv[++i] || 0);
    else if (arg === '--only') args.only = argv[++i] || '';
    else if (arg === '--model-policy') args.modelPolicy = argv[++i] || 'auto';
    else if (arg === '--request-size') args.requestSize = argv[++i] || '1024x1024';
    else if (arg === '--retries') args.retries = Number(argv[++i] || 0);
    else if (arg === '--skip-existing') args.skipExisting = true;
    else if (arg === '--validate-only') args.validateOnly = true;
    else if (arg === '--manifest') args.manifestPath = resolve(argv[++i]);
    else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`未知参数: ${arg}`);
    }
  }

  return args;
}

function printHelp() {
  console.log(`Usage:
  node scripts/assets/generate-png-assets.mjs --dry-run
  IMAGE_API_KEY=... node scripts/assets/generate-png-assets.mjs --limit 3

Environment:
  IMAGE_API_KEY       Required unless --dry-run. Never written to disk.
  IMAGE_API_BASE_URL  Default: ${DEFAULT_API_BASE_URL}
  IMAGE_MODEL         Default: ${DEFAULT_IMAGE_MODEL}
  IMAGE_MODEL_2K      Default: ${DEFAULT_IMAGE_MODEL_2K}

Options:
  --dry-run                 Parse prompts or current PNG inventory and print planned jobs only.
  --only <path-substring>   Generate matching asset paths only.
  --limit <n>               Limit number of jobs after filtering.
  --output-root <dir>       Default: asset-inbox/png-redesign
  --prompt-doc <path>       Optional Markdown table source. Defaults to docs/07-STYLING-SYSTEM.md.
  --model-policy <auto|base|2k>
  --request-size <size>     API generation size before local resize. Default: 1024x1024
  --retries <n>             Default: 2
  --skip-existing           Reuse existing valid files in output-root.
  --validate-only           Validate generated files without calling the API.
  --manifest <path>         Default: <output-root>/manifest.json
`);
}

function extractCodeBlockAfter(markdown, heading) {
  const start = markdown.indexOf(heading);
  if (start === -1) return '';
  const after = markdown.slice(start);
  const match = after.match(/```text\n([\s\S]*?)\n```/);
  return match ? match[1].trim() : '';
}

function parseSize(sizeText) {
  const match = String(sizeText).match(/(\d+)\s*x\s*(\d+)/i);
  if (!match) throw new Error(`无法解析尺寸: ${sizeText}`);
  return { width: Number(match[1]), height: Number(match[2]) };
}

function parseAssetRows(markdown) {
  const rows = [];
  for (const line of markdown.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('| `')) continue;
    const cells = trimmed
      .split('|')
      .slice(1, -1)
      .map((cell) => cell.trim());
    if (cells.length < 4) continue;

    const pathMatch = cells[0].match(/^`([^`]+)`$/);
    if (!pathMatch) continue;

    const { width, height } = parseSize(cells[1]);
    rows.push({
      path: pathMatch[1],
      width,
      height,
      background: cells[2],
      prompt: cells.slice(3).join(' | ').trim()
    });
  }
  return rows;
}

function listPngFiles(dirPath, output = []) {
  if (!existsSync(dirPath)) return output;
  for (const entry of readdirSync(dirPath, { withFileTypes: true })) {
    const fullPath = join(dirPath, entry.name);
    if (entry.isDirectory()) {
      listPngFiles(fullPath, output);
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.png')) {
      output.push(fullPath);
    }
  }
  return output;
}

function backgroundForPath(assetPath) {
  if (
    assetPath.includes('/icons/') ||
    assetPath.includes('/tabbar/') ||
    assetPath.includes('/badges/') ||
    assetPath.includes('/effects/') ||
    assetPath.endsWith('/logo.png')
  ) {
    return '透明';
  }
  return '浅绿或透明';
}

function promptForPath(assetPath) {
  if (assetPath.includes('/tabbar/')) {
    return 'Minimal mobile tab bar icon for a serious study product, rounded geometric linework, strong silhouette at small size, green active-state compatible, no text.';
  }
  if (assetPath.includes('/badges/')) {
    return 'Achievement badge based on knowledge nodes, progress rings, and glass material, mature study-product style, no trophy, no coins, no text.';
  }
  if (assetPath.includes('/effects/')) {
    return 'Subtle feedback effect for quiz progress, green-white particles or motion arcs, mature and premium, transparent background, no cartoon symbols.';
  }
  if (assetPath.includes('/illustrations/')) {
    return 'Modern exam-preparation illustration with study cards, progress paths, and abstract knowledge nodes, white and mint background, no people, no readable text.';
  }
  if (assetPath.includes('/images/') || assetPath.includes('/pwa-icons/')) {
    return 'Brand or app image for EXAM-MASTER, abstract open book and upward progress path, mature fintech education style, no readable text.';
  }
  return 'Modern green study app asset, crisp mobile UI style, centered composition, no readable text.';
}

function getPngDimensions(filePath) {
  const buffer = readFileSync(filePath);
  const pngSignature = '89504e470d0a1a0a';
  if (buffer.subarray(0, 8).toString('hex') !== pngSignature) {
    throw new Error(`不是 PNG 文件: ${filePath}`);
  }
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20)
  };
}

function discoverExistingPngAssets() {
  return DEFAULT_PNG_SCAN_ROOTS.flatMap((root) => listPngFiles(resolve(PROJECT_ROOT, root)))
    .sort()
    .map((filePath) => {
      const info = getPngDimensions(filePath);
      const path = filePath.slice(PROJECT_ROOT.length + 1).replace(/\\/g, '/');
      return {
        path,
        width: info.width,
        height: info.height,
        background: backgroundForPath(path),
        prompt: promptForPath(path)
      };
    });
}

function buildPrompt(asset, globalDirection, negativePrompt) {
  const wantsTransparent = asset.background.includes('透明');
  const transparency = wantsTransparent
    ? [
        'The final image must be a PNG asset intended for transparent background use.',
        'Generate the subject isolated on transparent background if supported.',
        'If true transparency is unavailable, use a perfectly flat solid #ff00ff chroma-key background, with no shadow or lighting variation, so the background can be removed cleanly.',
        'Do not use #ff00ff anywhere in the subject.'
      ].join(' ')
    : 'Use a clean white or very pale mint green background only if the asset requires a solid background.';

  return [
    `Use case: ${asset.path.includes('/icons/') || asset.path.includes('/tabbar/') ? 'logo-brand' : 'stylized-concept'}`,
    `Asset type: ${asset.path}`,
    `Target final size: ${asset.width}x${asset.height} PNG.`,
    `Primary request: ${asset.prompt}`,
    `Global style: ${globalDirection}`,
    `Background requirement: ${asset.background}. ${transparency}`,
    'Composition: centered, generous safe padding, crisp edges, readable at small mobile-app size.',
    'Color palette: Wise-like green #9FE870, deep green #163300, white and very pale mint; avoid saturated neon.',
    `Avoid: ${negativePrompt}`
  ].join('\n');
}

function chooseModel(asset, args) {
  if (args.modelPolicy === 'base') return process.env.IMAGE_MODEL || DEFAULT_IMAGE_MODEL;
  if (args.modelPolicy === '2k') return process.env.IMAGE_MODEL_2K || DEFAULT_IMAGE_MODEL_2K;
  const largeOrIllustration =
    asset.width > 256 ||
    asset.height > 256 ||
    asset.path.includes('/illustrations/') ||
    asset.path.includes('/images/');
  return largeOrIllustration
    ? process.env.IMAGE_MODEL_2K || DEFAULT_IMAGE_MODEL_2K
    : process.env.IMAGE_MODEL || DEFAULT_IMAGE_MODEL;
}

function wantsTransparent(asset) {
  return asset.background.includes('透明');
}

function normalizeBaseUrl(url) {
  return String(url || DEFAULT_API_BASE_URL).replace(/\/+$/, '');
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function generateOne(asset, prompt, model, args) {
  const apiKey = process.env.IMAGE_API_KEY;
  if (!apiKey) {
    throw new Error('IMAGE_API_KEY 未设置。为避免密钥落盘，请通过环境变量传入。');
  }

  const baseUrl = normalizeBaseUrl(process.env.IMAGE_API_BASE_URL || DEFAULT_API_BASE_URL);
  const endpoint = `${baseUrl}/v1/images/generations`;
  const body = {
    model,
    prompt,
    size: args.requestSize,
    n: 1,
    response_format: 'b64_json'
  };

  let lastError = null;
  for (let attempt = 0; attempt <= args.retries; attempt++) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });

      const text = await response.text();
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${text.slice(0, 500)}`);
      }

      const payload = JSON.parse(text);
      const item = payload?.data?.[0];
      if (!item) throw new Error('图片接口未返回 data[0]');

      if (item.b64_json) {
        return Buffer.from(item.b64_json, 'base64');
      }

      if (item.url) {
        const imageResponse = await fetch(item.url);
        if (!imageResponse.ok) throw new Error(`下载图片失败 HTTP ${imageResponse.status}`);
        return Buffer.from(await imageResponse.arrayBuffer());
      }

      throw new Error('图片接口未返回 b64_json 或 url');
    } catch (error) {
      lastError = error;
      if (attempt < args.retries) await sleep(1200 * (attempt + 1));
    }
  }

  throw lastError;
}

function resizeWithSips(filePath, width, height) {
  const result = spawnSync('sips', ['-z', String(height), String(width), filePath, '--out', filePath], {
    encoding: 'utf8'
  });
  if (result.status !== 0) {
    throw new Error(`sips resize failed: ${result.stderr || result.stdout}`);
  }
}

function ensurePng(filePath) {
  const buffer = readFileSync(filePath);
  const pngSignature = '89504e470d0a1a0a';
  if (buffer.subarray(0, 8).toString('hex') !== pngSignature) {
    throw new Error(`生成文件不是 PNG: ${filePath}`);
  }
}

function getImageInfo(filePath) {
  const result = spawnSync('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', '-g', 'hasAlpha', filePath], {
    encoding: 'utf8'
  });
  if (result.status !== 0) {
    throw new Error(`sips info failed: ${result.stderr || result.stdout}`);
  }

  const info = {};
  for (const line of result.stdout.split('\n')) {
    const match = line.match(/^\s*([^:]+):\s*(.+)$/);
    if (match) info[match[1].trim()] = match[2].trim();
  }
  return {
    width: Number(info.pixelWidth || 0),
    height: Number(info.pixelHeight || 0),
    hasAlpha: String(info.hasAlpha || '').toLowerCase() === 'yes'
  };
}

function getFileHash(filePath) {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex');
}

function chromaKeyHelperPath() {
  return resolve(
    process.env.CODEX_HOME || join(homedir(), '.codex'),
    'skills/.system/imagegen/scripts/remove_chroma_key.py'
  );
}

function removeChromaKeyIfNeeded(asset, filePath) {
  if (!wantsTransparent(asset)) return;
  const before = getImageInfo(filePath);
  if (before.hasAlpha) return;

  const helper = chromaKeyHelperPath();
  if (!existsSync(helper)) {
    throw new Error(`透明资产缺少 alpha，且未找到 chroma-key 后处理脚本: ${helper}`);
  }

  const tmpPath = `${filePath}.alpha.png`;
  const result = spawnSync(
    'python3',
    [
      helper,
      '--input',
      filePath,
      '--out',
      tmpPath,
      '--auto-key',
      'border',
      '--soft-matte',
      '--transparent-threshold',
      '12',
      '--opaque-threshold',
      '220',
      '--despill'
    ],
    { encoding: 'utf8' }
  );
  if (result.status !== 0) {
    throw new Error(`透明背景后处理失败: ${result.stderr || result.stdout}`);
  }
  renameSync(tmpPath, filePath);
}

function validateOutput(asset, filePath) {
  if (!existsSync(filePath)) throw new Error(`文件不存在: ${filePath}`);
  ensurePng(filePath);
  const info = getImageInfo(filePath);
  if (info.width !== asset.width || info.height !== asset.height) {
    throw new Error(
      `尺寸不匹配: ${asset.path} expected=${asset.width}x${asset.height} actual=${info.width}x${info.height}`
    );
  }
  if (wantsTransparent(asset) && !info.hasAlpha) {
    throw new Error(`透明资产没有 alpha 通道: ${asset.path}`);
  }
  return info;
}

function writeManifest(manifestPath, records) {
  mkdirSync(dirname(manifestPath), { recursive: true });
  writeFileSync(
    manifestPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        total: records.length,
        records
      },
      null,
      2
    ) + '\n'
  );
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const markdown = existsSync(args.promptDoc) ? readFileSync(args.promptDoc, 'utf8') : '';
  if (!args.manifestPath) args.manifestPath = join(args.outputRoot, DEFAULT_MANIFEST_NAME);
  const globalDirection = extractCodeBlockAfter(markdown, '### 1.2 全局视觉方向') || DEFAULT_GLOBAL_DIRECTION;
  const negativePrompt = extractCodeBlockAfter(markdown, '### 1.3 全局负面提示词') || DEFAULT_NEGATIVE_PROMPT;

  let assets = parseAssetRows(markdown);
  if (assets.length === 0) assets = discoverExistingPngAssets();
  if (args.only) assets = assets.filter((asset) => asset.path.includes(args.only));
  if (args.limit > 0) assets = assets.slice(0, args.limit);

  if (assets.length === 0) {
    throw new Error('未解析到任何 PNG 资产。');
  }

  console.log(`[png-assets] parsed=${assets.length} dryRun=${args.dryRun}`);
  console.log(`[png-assets] outputRoot=${args.outputRoot}`);
  console.log(`[png-assets] manifest=${args.manifestPath}`);

  const manifestRecords = [];
  for (const asset of assets) {
    const model = chooseModel(asset, args);
    const prompt = buildPrompt(asset, globalDirection, negativePrompt);
    const outputPath = join(args.outputRoot, asset.path);
    console.log(
      `[png-assets] ${args.dryRun ? 'plan' : 'generate'} ${asset.path} ${asset.width}x${asset.height} model=${model}`
    );

    if (args.dryRun) continue;

    mkdirSync(dirname(outputPath), { recursive: true });
    if (args.validateOnly || (args.skipExisting && existsSync(outputPath))) {
      const info = validateOutput(asset, outputPath);
      manifestRecords.push({
        path: asset.path,
        model,
        status: args.validateOnly ? 'validated' : 'skipped_existing',
        width: info.width,
        height: info.height,
        hasAlpha: info.hasAlpha,
        sha256: getFileHash(outputPath),
        prompt
      });
      continue;
    }

    const imageBytes = await generateOne(asset, prompt, model, args);
    writeFileSync(outputPath, imageBytes);
    ensurePng(outputPath);
    resizeWithSips(outputPath, asset.width, asset.height);
    removeChromaKeyIfNeeded(asset, outputPath);
    ensurePng(outputPath);
    const info = validateOutput(asset, outputPath);
    manifestRecords.push({
      path: asset.path,
      model,
      status: 'generated',
      width: info.width,
      height: info.height,
      hasAlpha: info.hasAlpha,
      sha256: getFileHash(outputPath),
      prompt
    });
  }

  if (!args.dryRun) {
    writeManifest(args.manifestPath, manifestRecords);
    console.log('[png-assets] done');
  }
}

main().catch((error) => {
  console.error(`[png-assets] failed: ${error.message}`);
  process.exit(1);
});
