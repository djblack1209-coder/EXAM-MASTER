import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';

import { scanForbiddenClientSecrets } from '../../scripts/build/wechat-artifact-secret-scan.mjs';

describe('wechat artifact secret scan', () => {
  it('flags server-only env names in generated client artifacts', () => {
    const root = mkdtempSync(join(tmpdir(), 'exam-master-secret-scan-'));
    try {
      mkdirSync(join(root, 'config'), { recursive: true });
      writeFileSync(join(root, 'config/index.js'), 'const leak = "VITE_INVITE_SECRET";\n', 'utf8');

      const findings = scanForbiddenClientSecrets(root);

      expect(findings).toEqual([
        {
          file: 'config/index.js',
          token: 'VITE_INVITE_SECRET'
        }
      ]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
