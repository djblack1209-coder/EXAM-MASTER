import { describe, expect, it } from 'vitest';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { request } from 'node:http';

import { MOBILE_SMOKE_ROUTES, MOBILE_VIEWPORTS, serveStatic } from '../../scripts/build/mobile-viewport-smoke.mjs';

function readMedia(url, headers = {}, method = 'GET') {
  return new Promise((resolve, reject) => {
    const call = request(url, { headers, method }, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () =>
        resolve({ status: response.statusCode, headers: response.headers, body: Buffer.concat(chunks).toString() })
      );
      response.on('error', reject);
    });
    call.on('error', reject);
    call.end();
  });
}

describe('mobile viewport smoke config', () => {
  it('covers the mobile shell critical path', () => {
    expect(MOBILE_SMOKE_ROUTES).toEqual([
      '/pages/splash/index',
      '/pages/login/onboarding',
      '/pages/index/index',
      '/pages/practice/index',
      '/pages/practice-sub/question-bank',
      '/pages/practice-sub/do-quiz',
      '/pages/mistake/index',
      '/pages/profile/index'
    ]);
  });

  it('covers narrow and large phone viewports', () => {
    expect(MOBILE_VIEWPORTS).toEqual([
      { width: 360, height: 800, name: 'android-compact' },
      { width: 375, height: 812, name: 'iphone-x' },
      { width: 390, height: 844, name: 'iphone-regular' },
      { width: 430, height: 932, name: 'iphone-large' }
    ]);
  });

  it('serves video byte ranges so actual homepage frame seeking can work', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'exam-media-range-'));
    const content = Buffer.from('0123456789abcdef');
    await writeFile(path.join(root, 'gaze.mp4'), content);
    const { server, port } = await serveStatic(root);
    try {
      const url = `http://127.0.0.1:${port}/gaze.mp4`;
      const partial = await readMedia(url, { Range: 'bytes=2-5' });
      expect(partial.status).toBe(206);
      expect(partial.headers['content-type']).toBe('video/mp4');
      expect(partial.headers['content-range']).toBe('bytes 2-5/16');
      expect(partial.body).toBe('2345');
      const suffix = await readMedia(url, { Range: 'bytes=-3' });
      expect(suffix.status).toBe(206);
      expect(suffix.body).toBe('def');
      const invalid = await readMedia(url, { Range: 'bytes=16-' });
      expect(invalid.status).toBe(416);
      expect(invalid.headers['content-range']).toBe('bytes */16');
      const head = await readMedia(url, {}, 'HEAD');
      expect(head.headers['content-length']).toBe('16');
      expect(head.headers['accept-ranges']).toBe('bytes');
      expect(head.body).toBe('');
    } finally {
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
      await rm(root, { recursive: true, force: true });
    }
  });
});
