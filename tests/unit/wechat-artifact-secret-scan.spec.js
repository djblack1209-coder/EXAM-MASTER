import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';

import { scanForbiddenClientSecrets } from '../../scripts/build/wechat-artifact-secret-scan.mjs';

describe('wechat artifact secret scan', () => {
  it.each(['VITE_INVITE_SECRET', 'WX_SECRET', 'WX_MOBILE_SECRET', 'QQ_MINI_SECRET'])(
    'flags server-only %s in generated client artifacts',
    (token) => {
      const root = mkdtempSync(join(tmpdir(), 'yozi-ai-secret-scan-'));
      try {
        mkdirSync(join(root, 'config'), { recursive: true });
        writeFileSync(join(root, 'config/index.js'), `const leak = "${token}";\n`, 'utf8');

        const findings = scanForbiddenClientSecrets(root);

        expect(findings).toEqual([
          {
            file: 'config/index.js',
            token
          }
        ]);
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    }
  );
});
