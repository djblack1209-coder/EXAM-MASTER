import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const mocked = vi.hoisted(() => {
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
        async add(payload) {
          return { id: payload?._id || 'rl_doc' };
        }
      })
    })
  };

  return { mockCloud };
});

vi.mock('@lafjs/cloud', () => ({
  default: mocked.mockCloud
}));

vi.mock('../../laf-backend/node_modules/@lafjs/cloud/dist/index.js', () => ({
  default: mocked.mockCloud
}));

vi.mock('../../laf-backend/functions/login', () => ({
  verifyJWT: vi.fn(() => ({ userId: 'u_doc_1' }))
}));

vi.mock('../../laf-backend/functions/_shared/auth-middleware', () => ({
  requireAuth: vi.fn((ctx) => {
    const token = ctx?.headers?.authorization?.replace('Bearer ', '') || '';
    if (!token) return { code: 401, success: false, message: '请先登录' };
    return { userId: 'u_doc_1' };
  }),
  isAuthError: (result) => result?.code === 401
}));

vi.mock('../../laf-backend/functions/_shared/api-response', async () => {
  const { createApiResponseMock } = await import('../../tests/__mocks__/api-response-mock.js');
  return createApiResponseMock();
});

vi.mock('../../laf-backend/functions/_shared/validator', () => ({
  validate: vi.fn((data, rules) => {
    // 简单校验逻辑：检查 required 字段
    const errors = [];
    for (const [key, rule] of Object.entries(rules)) {
      if (rule.required && !data[key]) {
        errors.push(`${key} 是必填项`);
      }
      if (rule.enum && data[key] && !rule.enum.includes(data[key])) {
        errors.push(`${key} 的值不在允许范围内`);
      }
    }
    return { valid: errors.length === 0, errors };
  })
}));

describe('[安全审计] doc-convert 输入校验', () => {
  beforeAll(() => {
    process.env.API_KEY_PLACEHOLDER
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('缺少 token 时应拒绝请求', async () => {
    const { default: handler } = await import('../../laf-backend/functions/doc-convert');

    const result = await handler({
      headers: {},
      body: {
        action: 'get_types'
      }
    });

    expect(result.code).toBe(401);
    expect(/** @type {any} */ (result).message).toContain('请先登录');
  });

  it('仅 body.token 不应通过鉴权（应要求 Header Token）', async () => {
    const { default: handler } = await import('../../laf-backend/functions/doc-convert');

    const result = await handler({
      headers: {},
      body: {
        action: 'get_types',
        token: 'body_token_only'
      }
    });

    expect(result.code).toBe(401);
  });

  it('仅 headers.token 不应通过鉴权（应要求 Authorization）', async () => {
    const { default: handler } = await import('../../laf-backend/functions/doc-convert');

    const result = await handler({
      headers: { token: 'token_header_only' },
      body: {
        action: 'get_types'
      }
    });

    expect(result.code).toBe(401);
  });

  it('非法 base64 内容应被拒绝', async () => {
    const { default: handler } = await import('../../laf-backend/functions/doc-convert');

    const result = await handler({
      headers: { authorization: 'Bearer mock.jwt.token' },
      body: {
        action: 'convert',
        convertType: 'pdf2img',
        fileName: 'sample.pdf',
        fileBase64: 'not_base64_@@@'
      }
    });

    expect(result.code).toBe(400);
    expect(/** @type {any} */ (result).message).toContain('非法 Base64');
  });

  it('扩展名与文件签名不匹配应被拒绝', async () => {
    const { default: handler } = await import('../../laf-backend/functions/doc-convert');

    const fakeTextBase64 = Buffer.from('hello world').toString('base64');

    const result = await handler({
      headers: { authorization: 'Bearer mock.jwt.token' },
      body: {
        action: 'convert',
        convertType: 'word2pdf',
        fileName: 'report.docx',
        fileBase64: fakeTextBase64
      }
    });

    expect(result.code).toBe(400);
    expect(/** @type {any} */ (result).message).toContain('文件内容与扩展名不匹配');
  });
});
