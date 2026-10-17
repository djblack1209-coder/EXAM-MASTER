import { it, expect, vi, afterEach } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from '@babel/parser';
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});
it.each(['development', 'production'])(
  'regress-4: %s logger excludes identifiers, tokens, content and error stacks',
  async (env) => {
    vi.resetModules();
    vi.stubEnv('NODE_ENV', env);
    const { logger } = await import('@/utils/logger.js');
    const spies = ['log', 'warn', 'error', 'table'].map((method) =>
      vi.spyOn(console, method).mockImplementation(() => {})
    );
    const privateValue = 'PRIVATE_ACCOUNT_TOKEN_CONTENT';
    logger.error('[StorageService] 保存失败', { account: privateValue }, new Error(privateValue), privateValue, 2);
    logger.table([{ value: privateValue }]);
    expect(JSON.stringify(spies.flatMap((spy) => spy.mock.calls))).not.toContain(privateValue);
    expect(spies[2]).toHaveBeenCalledWith('[StorageService] 保存失败', 2);
  }
);
it('regress-4: every src logger label is static; dynamic data cannot enter first argument', () => {
  function loggerFiles(directory) {
    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
      if (entry.name.startsWith('.')) return [];
      const file = join(directory, entry.name);
      if (entry.isDirectory()) return loggerFiles(file);
      if (!entry.isFile()) return [];
      const content = readFileSync(file);
      return !content.includes(0) && /logger\.(log|debug|info|warn|error|group)\(/.test(content.toString('utf8'))
        ? [file]
        : [];
    });
  }
  const files = loggerFiles('src');
  expect(files.length).toBeGreaterThan(0);
  const violations = [];
  function visit(node, file) {
    if (!node || typeof node !== 'object') return;
    if (
      node.type === 'CallExpression' &&
      node.callee.type === 'MemberExpression' &&
      node.callee.object.name === 'logger'
    ) {
      const first = node.arguments[0];
      if (first && first.type !== 'StringLiteral') violations.push(`${file}:${node.loc.start.line}`);
    }
    for (const value of Object.values(node))
      if (Array.isArray(value)) value.forEach((v) => visit(v, file));
      else if (value && typeof value === 'object') visit(value, file);
  }
  for (const file of files) {
    if (file.endsWith('/logger.js')) continue;
    const text = readFileSync(file, 'utf8');
    const script = file.endsWith('.vue') ? text.match(/<script[^>]*>([\s\S]*?)<\/script>/)?.[1] : text;
    if (script) visit(parse(script, { sourceType: 'module', plugins: ['typescript'] }), file);
  }
  expect(violations).toEqual([]);
});
it('regress-4: persisted and in-memory runtime logs exclude private error messages', async () => {
  const { globalErrorHandler } = await import('@/utils/error/global-error-handler.js');
  globalErrorHandler.clearErrorLogs();
  globalErrorHandler.report('Runtime Error', new Error('PRIVATE_ERROR_CONTENT'));
  expect(JSON.stringify(globalErrorHandler.getErrorLogs())).not.toContain('PRIVATE_ERROR_CONTENT');
  expect(JSON.stringify(uni.getStorageSync('runtime_errors'))).not.toContain('PRIVATE_ERROR_CONTENT');
  globalErrorHandler.clearErrorLogs();
});
