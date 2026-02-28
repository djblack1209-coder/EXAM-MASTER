import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

const mocked = vi.hoisted(() => {
  const scenario = {
    whereCalls: [],
    addCalls: [],
    updateCalls: [],
    countQueue: [{ total: 0 }],
    getOneResult: { data: null }
  };

  function resetScenario() {
    scenario.whereCalls = [];
    scenario.addCalls = [];
    scenario.updateCalls = [];
    scenario.countQueue = [{ total: 0 }];
    scenario.getOneResult = { data: null };
  }

  const collection = {
    where(query) {
      scenario.whereCalls.push(query);
      return collection;
    },
    async count() {
      const next = scenario.countQueue.shift();
      return next || { total: 0 };
    },
    async getOne() {
      return scenario.getOneResult;
    },
    async add(payload) {
      scenario.addCalls.push(payload);
      return { id: 'evt_123' };
    },
    doc(id) {
      return {
        async update(patch) {
          scenario.updateCalls.push({ id, patch });
          return { id };
        }
      };
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

import handoffNotifyHandler from '../../laf-backend/functions/job-bot-handoff-notify';

describe('[安全审计] job-bot-handoff-notify 鉴权与投递语义', () => {
  const originalEnv = {
    NODE_ENV: process.env.NODE_ENV,
    JOB_BOT_HANDOFF_TOKEN: process.env.JOB_BOT_HANDOFF_TOKEN,
    JOB_BOT_HANDOFF_RECEIVER: process.env.JOB_BOT_HANDOFF_RECEIVER,
    SMTP_USER: process.env.SMTP_USER,
    SMTP_PASS: process.env.SMTP_PASS,
    SMTP_RETRY_TIMES: process.env.SMTP_RETRY_TIMES,
    SMTP_RETRY_DELAY_MS: process.env.SMTP_RETRY_DELAY_MS
  };

  beforeEach(() => {
    mocked.resetScenario();
    process.env.NODE_ENV = 'production';
    process.env.TOKEN_PLACEHOLDER
    process.env.JOB_BOT_HANDOFF_RECEIVER = 'owner@realmail.com';
    process.env.SMTP_USER = '';
    process.env.SMTP_PASS = '';
    process.env.SMTP_RETRY_TIMES = '1';
    process.env.SMTP_RETRY_DELAY_MS = '1';
  });

  afterAll(() => {
    Object.entries(originalEnv).forEach(([key, value]) => {
      process.env[key] = value;
    });
  });

  function buildCtx(overrides = {}) {
    return {
      method: 'POST',
      headers: { authorization: 'Bearer secret-token' },
      body: {
        source: 'job-bot-desktop',
        company: 'Exam-Master Inc',
        title: '全栈工程师',
        intent: 'handoff',
        hrMessage: '请候选人本人继续沟通',
        autoReply: '好的，我先邀请本人接管',
        jobLink: 'https://www.zhipin.com/job/abc'
      },
      requestContext: { identity: { sourceIp: '1.2.3.4' } },
      ...overrides
    };
  }

  it('缺少有效 token 时应返回 403', async () => {
    const result = await handoffNotifyHandler(
      buildCtx({
        headers: {}
      })
    );

    expect(result.code).toBe(403);
    expect(result.success).toBe(false);
  });

  it('命中去重窗口时应直接返回 duplicate=true', async () => {
    mocked.scenario.getOneResult = {
      data: { _id: 'evt_existing', delivered_at: Date.now() }
    };

    const result = await handoffNotifyHandler(buildCtx());

    expect(result.code).toBe(0);
    expect(result.success).toBe(true);
    expect(result.data.duplicate).toBe(true);
    expect(mocked.scenario.addCalls.length).toBe(0);
  });

  it('生产环境 SMTP 未配置时应返回 502 并标记 mail_failed', async () => {
    const result = await handoffNotifyHandler(buildCtx());

    expect(result.code).toBe(502);
    expect(result.success).toBe(false);
    expect(mocked.scenario.updateCalls.length).toBe(1);
    expect(mocked.scenario.updateCalls[0].id).toBe('evt_123');
    expect(mocked.scenario.updateCalls[0].patch.status).toBe('mail_failed');
  });

  it('receiver 使用示例域名时应直接拒绝', async () => {
    const result = await handoffNotifyHandler(
      buildCtx({
        body: {
          source: 'job-bot-desktop',
          company: 'Exam-Master Inc',
          title: '全栈工程师',
          intent: 'handoff',
          hrMessage: '请候选人本人继续沟通',
          receiver: 'candidate@example.com'
        }
      })
    );

    expect(result.code).toBe(400);
    expect(result.success).toBe(false);
    expect(result.message).toContain('示例域名');
    expect(mocked.scenario.addCalls.length).toBe(0);
  });

  it('jobLink 非 http/https 协议时应被清空后落库', async () => {
    const result = await handoffNotifyHandler(
      buildCtx({
        body: {
          source: 'job-bot-desktop',
          company: 'Exam-Master Inc',
          title: '全栈工程师',
          intent: 'handoff',
          hrMessage: '请候选人本人继续沟通',
          jobLink: 'javascript:alert(1)'
        }
      })
    );

    expect(result.code).toBe(502);
    expect(result.success).toBe(false);
    expect(mocked.scenario.addCalls.length).toBe(1);
    expect(mocked.scenario.addCalls[0].job_link).toBe('');
  });

  it('开发环境 SMTP 未配置时应返回记录成功且 delivered=false', async () => {
    process.env.NODE_ENV = 'development';

    const result = await handoffNotifyHandler(buildCtx());

    expect(result.code).toBe(0);
    expect(result.success).toBe(true);
    expect(result.data.delivered).toBe(false);
    expect(result.data.eventId).toBe('evt_123');
    expect(mocked.scenario.updateCalls.length).toBe(1);
    expect(mocked.scenario.updateCalls[0].patch.status).toBe('mail_failed');
  });
});
