import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// 真实大文件回归测试：仅在本地开发环境有对应文件时才执行，CI 中自动跳过
const LOCAL_DOWNLOADS = resolve(process.env.HOME || '/tmp', 'Downloads');
const PDF_FILE = resolve(LOCAL_DOWNLOADS, '【李彬】基层自治制度考点笔记.pdf');
const PNG_FILE = resolve(LOCAL_DOWNLOADS, '预览图0.png');

const mocked = vi.hoisted(() => {
  const state = {
    jobSeq: 0,
    jobs: new Map()
  };

  const mockCloud = {
    database: () => ({
      command: { inc: (n) => ({ $inc: n }) },
      collection: () => ({
        doc: () => ({
          async get() {
            return { data: null };
          },
          async update() {
            return { updated: 1 };
          }
        }),
        where: () => ({
          async getOne() {
            return { data: null };
          }
        }),
        async add() {
          return { id: `db_${Date.now()}` };
        }
      })
    }),
    fetch: vi.fn(async ({ url, method, data }) => {
      if (url.endsWith('/jobs') && method === 'POST') {
        state.jobSeq += 1;
        const jobId = `job_mock_${state.jobSeq}`;
        const outputFormat = data?.tasks?.['convert-file']?.output_format || 'pdf';
        const outputFile = {
          filename: `result.${outputFormat}`,
          url: `https://example.com/${jobId}.${outputFormat}`,
          size: 1024
        };
        state.jobs.set(jobId, outputFile);

        return {
          status: 201,
          data: {
            data: {
              id: jobId,
              status: 'processing'
            }
          }
        };
      }

      const jobMatch = String(url).match(/\/jobs\/([^/?]+)/);
      if (jobMatch && method === 'GET') {
        const jobId = jobMatch[1];
        const file = state.jobs.get(jobId) || {
          filename: 'result.pdf',
          url: `https://example.com/${jobId}.pdf`,
          size: 1024
        };

        return {
          status: 200,
          data: {
            data: {
              id: jobId,
              status: 'finished',
              tasks: [
                {
                  operation: 'export/url',
                  status: 'finished',
                  result: {
                    files: [file]
                  }
                }
              ]
            }
          }
        };
      }

      return {
        status: 400,
        data: {
          message: 'unsupported mock request'
        }
      };
    })
  };

  return { mockCloud, state };
});

vi.mock('@lafjs/cloud', () => ({
  default: mocked.mockCloud
}));

vi.mock('../../laf-backend/node_modules/@lafjs/cloud/dist/index.js', () => ({
  default: mocked.mockCloud
}));

vi.mock('../../laf-backend/functions/login', () => ({
  verifyJWT: vi.fn(() => ({ userId: 'real_file_user_1' }))
}));

describe('文档转换真实文件回归（PDF + PNG）', () => {
  beforeAll(() => {
    process.env.API_KEY_PLACEHOLDER
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mocked.state.jobs.clear();
    mocked.state.jobSeq = 0;
  });

  it('真实 PDF 文件可完成 pdf2word 转换链路', async () => {
    if (!existsSync(PDF_FILE)) {
      expect(true).toBe(true);
      return;
    }

    const { default: handler } = await import('../../laf-backend/functions/doc-convert');
    const fileBase64 = readFileSync(PDF_FILE).toString('base64');

    const result = await handler({
      headers: { authorization: 'Bearer mock.jwt.token' },
      body: {
        action: 'convert',
        convertType: 'pdf2word',
        fileName: 'real-input.pdf',
        fileBase64
      }
    });

    const typedResult = /** @type {any} */ (result);
    expect(typedResult.code).toBe(0);
    expect(typedResult.data?.downloadUrl).toContain('https://example.com/');
    expect(typedResult.data?.files?.[0]?.filename).toContain('.docx');
  });

  it('真实 PNG 文件可完成 img2pdf 转换链路', async () => {
    if (!existsSync(PNG_FILE)) {
      expect(true).toBe(true);
      return;
    }

    const { default: handler } = await import('../../laf-backend/functions/doc-convert');
    const fileBase64 = readFileSync(PNG_FILE).toString('base64');

    const result = await handler({
      headers: { authorization: 'Bearer mock.jwt.token' },
      body: {
        action: 'convert',
        convertType: 'img2pdf',
        fileName: 'real-image.png',
        fileBase64
      }
    });

    const typedResult = /** @type {any} */ (result);
    expect(typedResult.code).toBe(0);
    expect(typedResult.data?.downloadUrl).toContain('https://example.com/');
    expect(typedResult.data?.files?.[0]?.filename).toContain('.pdf');
  });
});
