import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

const mocked = vi.hoisted(() => {
  const scenario = {
    whereCalls: [],
    addCalls: [],
    getOneResult: { data: null },
    countQueue: [{ total: 0 }, { total: 0 }]
  };

  function resetScenario() {
    scenario.whereCalls = [];
    scenario.addCalls = [];
    scenario.getOneResult = { data: null };
    scenario.countQueue = [{ total: 0 }, { total: 0 }];
  }

  const collection = {
    where(query) {
      scenario.whereCalls.push(query);
      return collection;
    },
    async getOne() {
      return scenario.getOneResult;
    },
    async count() {
      const next = scenario.countQueue.shift();
      return next || { total: 0 };
    },
    async add(payload) {
      scenario.addCalls.push(payload);
      return { id: 'mock_code_id' };
    }
  };

  const mockDb = {
    command: {
      gt: (value) => ({ $gt: value })
    },
    collection() {
      return collection;
    }
  };

  return {
    scenario,
    resetScenario,
    mockDb
  };
});

vi.mock('@lafjs/cloud', () => ({
  default: {
    database: () => mocked.mockDb
  }
}));

vi.mock('../../laf-backend/node_modules/@lafjs/cloud/dist/index.js', () => ({
  default: {
    database: () => mocked.mockDb
  }
}));

import sendEmailCodeHandler from '../../laf-backend/functions/send-email-code';

describe('[安全审计] send-email-code 敏感信息与错误返回', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalSmtpUser = process.env.SMTP_USER;
  const originalSmtpPass = process.env.SMTP_PASS;

  beforeEach(() => {
    mocked.resetScenario();
    process.env.SMTP_USER = '';
    process.env.SMTP_PASS = '';
  });

  afterAll(() => {
    process.env.NODE_ENV = originalNodeEnv;
    process.env.SMTP_USER = originalSmtpUser;
    process.env.SMTP_PASS = originalSmtpPass;
  });

  it('生产环境邮件发送失败时应返回 502，不应伪装成功', async () => {
    process.env.NODE_ENV = 'production';

    const result = await sendEmailCodeHandler({
      body: { email: 'user@example.com' },
      headers: {}
    });

    expect(result.code).toBe(502);
    expect(result.success).toBe(false);
  });

  it('缺少邮箱参数时应返回 400 且 success=false', async () => {
    process.env.NODE_ENV = 'production';

    const result = await sendEmailCodeHandler({
      body: {},
      headers: {}
    });

    expect(result.code).toBe(400);
    expect(result.success).toBe(false);
    expect(result.message).toContain('不能为空');
  });

  it('1分钟内重复发送时应返回 429 且 success=false', async () => {
    process.env.NODE_ENV = 'production';
    mocked.scenario.getOneResult = { data: { _id: 'existing_code' } };

    const result = await sendEmailCodeHandler({
      body: { email: 'user@example.com' },
      headers: {}
    });

    expect(result.code).toBe(429);
    expect(result.success).toBe(false);
    expect(result.message).toContain('发送太频繁');
  });

  it('非生产环境失败提示不应泄露验证码内容', async () => {
    process.env.NODE_ENV = 'development';

    const result = await sendEmailCodeHandler({
      body: { email: 'user@example.com' },
      headers: {}
    });

    expect(result.code).toBe(0);
    expect(result.message).not.toMatch(/\b\d{6}\b/);
  });

  it('邮箱应先归一化后再写入数据库，避免大小写绕过频控', async () => {
    process.env.NODE_ENV = 'development';

    await sendEmailCodeHandler({
      body: { email: 'Test.User@Example.COM ' },
      headers: {}
    });

    expect(mocked.scenario.whereCalls.length).toBeGreaterThan(0);
    expect(mocked.scenario.whereCalls[0].email).toBe('test.user@example.com');

    const addPayload = mocked.scenario.addCalls[0];
    expect(addPayload).toBeTruthy();
    expect(addPayload.email).toBe('test.user@example.com');
  });
});
