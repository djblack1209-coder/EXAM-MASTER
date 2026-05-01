#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PROJECT_ROOT = path.resolve(fileURLToPath(import.meta.url), '../../..');
const DEFAULT_ENV_FILES = [
  path.join(PROJECT_ROOT, '.env'),
  path.join(PROJECT_ROOT, '.env.production'),
  path.join(PROJECT_ROOT, 'laf-backend/.env')
];

function parseArgs(argv) {
  const options = {
    userId: '',
    ttlSeconds: 3600,
    output: '',
    print: false,
    envFiles: [...DEFAULT_ENV_FILES],
    useEnvFiles: true
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const [key, inlineValue] = arg.split('=');
    const nextValue = inlineValue ?? argv[index + 1];

    if (key === '--user-id') {
      options.userId = String(nextValue || '').trim();
      if (inlineValue === undefined) index += 1;
    } else if (key === '--ttl-seconds') {
      options.ttlSeconds = Number(nextValue);
      if (inlineValue === undefined) index += 1;
    } else if (key === '--output') {
      options.output = path.resolve(nextValue);
      if (inlineValue === undefined) index += 1;
    } else if (key === '--env-file') {
      options.envFiles.push(path.resolve(nextValue));
      options.useEnvFiles = true;
      if (inlineValue === undefined) index += 1;
    } else if (arg === '--no-env-files') {
      options.envFiles = [];
      options.useEnvFiles = false;
    } else if (arg === '--print') {
      options.print = true;
    } else if (arg === '--help' || arg === '-h') {
      options.help = true;
    }
  }

  return options;
}

function existsFile(filePath) {
  return fs.existsSync(filePath) && fs.statSync(filePath).isFile();
}

function normalizeEnvValue(value) {
  let normalized = String(value || '').trim();
  const quote = normalized[0];
  if ((quote === '"' || quote === "'") && normalized.endsWith(quote)) {
    normalized = normalized.slice(1, -1);
  }
  return normalized;
}

function parseEnvFile(filePath) {
  if (!existsFile(filePath)) return {};
  const result = {};
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(trimmed);
    if (!match) continue;
    result[match[1]] = normalizeEnvValue(match[2]);
  }
  return result;
}

function loadEnvFiles(filePaths) {
  return filePaths.reduce((merged, filePath) => ({ ...merged, ...parseEnvFile(filePath) }), {});
}

function base64urlJson(payload) {
  return Buffer.from(JSON.stringify(payload)).toString('base64url');
}

function createJwt({ userId, ttlSeconds, secret }) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = {
    userId,
    role: 'smoke',
    iat: now,
    exp: now + ttlSeconds
  };
  const signingInput = `${base64urlJson(header)}.${base64urlJson(payload)}`;
  const signature = crypto.createHmac('sha256', secret).update(signingInput).digest('base64url');
  return `${signingInput}.${signature}`;
}

function printHelp() {
  console.log(`Usage:
  node scripts/build/create-smoke-jwt.mjs --user-id <id> [--output data/smoke-token.env | --print]

Options:
  --user-id <id>       Existing smoke user id to embed in the token
  --ttl-seconds <n>    Token lifetime in seconds; default 3600
  --output <path>      Write SMOKE_TOKEN and SMOKE_USER_ID dotenv lines
  --print              Print token to stdout
  --env-file <path>    Additional dotenv file; later files override earlier files
  --no-env-files       Do not read local .env files; use process env only
`);
}

function run(argv = process.argv.slice(2), env = process.env) {
  const options = parseArgs(argv);
  if (options.help) {
    printHelp();
    return 0;
  }

  if (!options.userId) {
    throw new Error('--user-id is required and must refer to an existing smoke user');
  }
  if (!Number.isInteger(options.ttlSeconds) || options.ttlSeconds < 300 || options.ttlSeconds > 604800) {
    throw new Error('--ttl-seconds must be an integer between 300 and 604800');
  }
  if (!options.output && !options.print) {
    throw new Error('provide --output or --print');
  }

  const releaseEnv = options.useEnvFiles ? { ...loadEnvFiles(options.envFiles), ...env } : { ...env };
  const secret = String(releaseEnv.JWT_SECRET || '').trim();
  if (secret.length < 48) {
    throw new Error('JWT_SECRET must be configured and at least 48 characters');
  }

  const token = createJwt({ userId: options.userId, ttlSeconds: options.ttlSeconds, secret });
  if (options.output) {
    fs.mkdirSync(path.dirname(options.output), { recursive: true });
    fs.writeFileSync(options.output, `SMOKE_TOKEN=${token}\nSMOKE_USER_ID=${options.userId}\n`);
    console.error(`[create-smoke-jwt] wrote ${path.relative(PROJECT_ROOT, options.output)}`);
  }
  if (options.print) {
    console.log(token);
  }
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    process.exitCode = run();
  } catch (error) {
    console.error(`[create-smoke-jwt] ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
