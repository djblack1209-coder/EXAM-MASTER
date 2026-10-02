import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Generates a value only. It never loads credentials, rotates keys or writes an environment file.
export function createRequestSigningSalt() {
  return randomBytes(32).toString('hex');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.stdout.write(createRequestSigningSalt() + '\n');
}
