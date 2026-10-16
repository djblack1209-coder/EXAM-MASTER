import { it, expect } from 'vitest';
import { ESLint } from 'eslint';
it('WRITES-4: storage code rejects undefined session holders at lint time', async () => {
  const [result] = await new ESLint().lintText('export function remove() { return current.session; }', {
    filePath: 'src/services/storageService.js'
  });
  expect(result.messages.some((message) => message.ruleId === 'no-undef')).toBe(true);
});
