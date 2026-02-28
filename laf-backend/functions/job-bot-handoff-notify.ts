/**
 * Job Bot 接管通知云函数
 *
 * 用途：接收桌面 Job Bot 的接管请求，并通过 Exam-Master 邮件链路通知候选人本人。
 *
 * 安全策略：
 * 1) 仅接受 POST
 * 2) 必须携带鉴权 token（Authorization: ${AUTH_HEADER} 或 x-job-bot-token）
 * 3) 数据落库审计 + 去重 + 频控
 */

import cloud from '@lafjs/cloud';
import crypto from 'crypto';

const db = cloud.database();

const EVENTS_COLLECTION = 'job_bot_handoff_events';
const RESERVED_EMAIL_DOMAINS = new Set(['example.com', 'example.net', 'example.org']);
const RESERVED_EMAIL_SUFFIXES = ['.example', '.invalid', '.localhost', '.test'];
const ALLOWED_INTENTS = new Set([
  'handoff',
  'project',
  'tech',
  'salary',
  'arrival',
  'team',
  'creative',
  'greet',
  'general'
]);

type NotifyConfig = {
  webhookToken: string;
  defaultReceiver: string;
  rateLimit: number;
  rateWindowMs: number;
  dedupeWindowMs: number;
  isProduction: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
  smtpFrom: string;
  smtpRetryTimes: number;
  smtpRetryDelayMs: number;
};

type HandoffMailPayload = {
  eventId: string;
  company: string;
  title: string;
  intent: string;
  hrMessage: string;
  autoReply: string;
  jobLink: string;
  createdAt: string;
  receiverMasked: string;
};

function escapeHtml(value: unknown): string {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getConfig(): NotifyConfig {
  const smtpPort = Number(process.env.SMTP_PORT || 465);

  return {
    webhookToken: String(process.env.JOB_BOT_HANDOFF_TOKEN || process.env.INTERNAL_API_KEY || '').trim(),
    defaultReceiver: String(process.env.JOB_BOT_HANDOFF_RECEIVER || process.env.SMTP_USER || '')
      .trim()
      .toLowerCase(),
    rateLimit: Math.max(1, Number(process.env.JOB_BOT_HANDOFF_RATE_LIMIT || 20)),
    rateWindowMs: Math.max(10_000, Number(process.env.JOB_BOT_HANDOFF_RATE_WINDOW_MS || 60_000)),
    dedupeWindowMs: Math.max(10_000, Number(process.env.JOB_BOT_HANDOFF_DEDUPE_WINDOW_MS || 120_000)),
    isProduction: process.env.NODE_ENV === 'production',
    smtpHost: String(process.env.SMTP_HOST || 'smtp.qq.com').trim(),
    smtpPort: Number.isFinite(smtpPort) ? smtpPort : 465,
    smtpUser: String(process.env.SMTP_USER || '').trim(),
    smtpPass: String(process.env.SMTP_PASS || '').trim(),
    smtpFrom: String(process.env.SMTP_FROM || 'Exam-Master <noreply@exam-master.com>').trim(),
    smtpRetryTimes: Math.max(1, Number(process.env.SMTP_RETRY_TIMES || 3)),
    smtpRetryDelayMs: Math.max(200, Number(process.env.SMTP_RETRY_DELAY_MS || 800))
  };
}

function getHeader(headers: Record<string, unknown> | undefined, headerName: string): string {
  if (!headers || typeof headers !== 'object') {
    return '';
  }

  const exact = headers[headerName];
  if (typeof exact === 'string') {
    return exact.trim();
  }

  const target = headerName.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === target && typeof value === 'string') {
      return value.trim();
    }
  }

  return '';
}

function extractBearerToken(rawToken: string): string {
  if (!rawToken) {
    return '';
  }

  const bearerMatch = rawToken.match(/^Bearer(?:\s+(.+))?$/i);
  if (!bearerMatch) {
    return rawToken.trim();
  }

  return String(bearerMatch[1] || '').trim();
}

function timingSafeEqualText(left: string, right: string): boolean {
  if (!left || !right) {
    return false;
  }

  const a = crypto.createHash('sha256').update(left, 'utf8').digest();
  const b = crypto.createHash('sha256').update(right, 'utf8').digest();
  return crypto.timingSafeEqual(a, b);
}

function normalizeText(value: unknown, maxLength: number): string {
  return String(value || '')
    .replace(/[\u200b\u200c\u200d]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .trim()
    .slice(0, Math.max(1, maxLength));
}

function normalizeEmail(value: unknown): string {
  return String(value || '')
    .trim()
    .toLowerCase();
}

function normalizeUrl(value: unknown): string {
  const raw = String(value || '').trim();
  if (!raw) {
    return '';
  }

  try {
    const parsed = new URL(raw);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return '';
    }
    return parsed.toString().slice(0, 300);
  } catch {
    return '';
  }
}

function isValidEmail(email: string): boolean {
  if (!email) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isReservedEmailDomain(email: string): boolean {
  if (!email.includes('@')) return true;

  const domain = String(email.split('@')[1] || '').toLowerCase();
  if (!domain) {
    return true;
  }

  if (RESERVED_EMAIL_DOMAINS.has(domain)) {
    return true;
  }

  return RESERVED_EMAIL_SUFFIXES.some((suffix) => domain.endsWith(suffix));
}

function maskEmail(email: string): string {
  if (!email.includes('@')) return '***';

  const [localPart, domain] = email.split('@');
  if (!localPart || !domain) return '***';
  if (localPart.length <= 2) return `${localPart[0] || '*'}***@${domain}`;

  return `${localPart[0]}***${localPart[localPart.length - 1]}@${domain}`;
}

function getClientIp(ctx: any): string {
  const forwarded = getHeader(ctx?.headers, 'x-forwarded-for');
  if (forwarded) {
    return String(forwarded.split(',')[0] || '').trim() || 'unknown';
  }

  const realIp = getHeader(ctx?.headers, 'x-real-ip');
  if (realIp) {
    return realIp;
  }

  const sourceIp = normalizeText(ctx?.requestContext?.identity?.sourceIp || '', 60);
  return sourceIp || 'unknown';
}

function buildDedupeHash(payload: { company: string; title: string; intent: string; hrMessage: string }): string {
  const raw = `${payload.company}|${payload.title}|${payload.intent}|${payload.hrMessage}`.toLowerCase();
  return crypto.createHash('sha1').update(raw).digest('hex');
}

function shouldRetryEmailError(error: any): boolean {
  const code = String(error?.code || '').toUpperCase();
  const message = String(error?.message || '').toLowerCase();

  if (['ETIMEDOUT', 'ESOCKET', 'ECONNECTION', 'EAI_AGAIN', 'ECONNRESET'].includes(code)) {
    return true;
  }

  if (message.includes('timeout') || message.includes('connection') || message.includes('socket')) {
    return true;
  }

  return false;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildMailHtml(payload: HandoffMailPayload): string {
  const companySafe = escapeHtml(payload.company);
  const titleSafe = escapeHtml(payload.title);
  const intentSafe = escapeHtml(payload.intent);
  const receiverMaskedSafe = escapeHtml(payload.receiverMasked);
  const createdAtSafe = escapeHtml(payload.createdAt);
  const eventIdSafe = escapeHtml(payload.eventId);
  const hrMessageSafe = escapeHtml(payload.hrMessage || '（无）');
  const autoReplySafe = escapeHtml(payload.autoReply || '（无）');
  const jobLinkSafe = normalizeUrl(payload.jobLink);

  return `
<div style="max-width:640px;margin:0 auto;padding:20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1f2937;line-height:1.6;">
  <h2 style="margin:0 0 10px;font-size:22px;color:#111827;">Job Bot 接管提醒</h2>
  <p style="margin:0 0 16px;color:#4b5563;">HR 已请求候选人本人接管，请尽快处理。</p>

  <div style="border:1px solid #e5e7eb;border-radius:10px;padding:14px;margin-bottom:14px;background:#f9fafb;">
    <p style="margin:4px 0;"><strong>公司：</strong>${companySafe}</p>
    <p style="margin:4px 0;"><strong>岗位：</strong>${titleSafe}</p>
    <p style="margin:4px 0;"><strong>意图：</strong>${intentSafe}</p>
    <p style="margin:4px 0;"><strong>接收邮箱：</strong>${receiverMaskedSafe}</p>
    <p style="margin:4px 0;"><strong>时间：</strong>${createdAtSafe}</p>
    <p style="margin:4px 0;"><strong>事件ID：</strong>${eventIdSafe}</p>
  </div>

  <div style="border-left:3px solid #3b82f6;padding:8px 12px;margin:0 0 12px;background:#eff6ff;">
    <p style="margin:0 0 6px;"><strong>HR 原话</strong></p>
    <p style="margin:0;color:#111827;">${hrMessageSafe}</p>
  </div>

  <div style="border-left:3px solid #10b981;padding:8px 12px;margin:0 0 12px;background:#ecfdf5;">
    <p style="margin:0 0 6px;"><strong>Bot 自动回复</strong></p>
    <p style="margin:0;color:#111827;">${autoReplySafe}</p>
  </div>

  ${jobLinkSafe ? `<p style="margin:12px 0 0;"><a href="${escapeHtml(jobLinkSafe)}" style="color:#2563eb;text-decoration:none;">查看岗位链接</a></p>` : ''}
</div>
`;
}

async function sendHandoffEmail(
  to: string,
  payload: HandoffMailPayload,
  requestId: string,
  config: NotifyConfig
): Promise<boolean> {
  if (!config.smtpUser || !config.smtpPass) {
    console.warn(`[${requestId}] SMTP 未配置，无法发送接管提醒邮件`);
    return false;
  }

  // 动态导入 nodemailer（Laf 运行时提供）
  const nodemailerMod = await import('nodemailer');
  const transporter = (nodemailerMod.default || nodemailerMod).createTransport({
    host: config.smtpHost,
    port: config.smtpPort,
    secure: config.smtpPort === 465,
    auth: {
      user: config.smtpUser,
      pass: config.smtpPass
    },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000
  });

  const mailOptions = {
    from: config.smtpFrom,
    to,
    subject: `【Exam-Master】Job Bot 接管提醒 - ${payload.company} / ${payload.title}`,
    text: [
      'Job Bot 接管提醒',
      `公司: ${payload.company}`,
      `岗位: ${payload.title}`,
      `意图: ${payload.intent}`,
      `时间: ${payload.createdAt}`,
      `事件ID: ${payload.eventId}`,
      '',
      `HR 原话: ${payload.hrMessage || '（无）'}`,
      `Bot 回复: ${payload.autoReply || '（无）'}`,
      payload.jobLink ? `岗位链接: ${payload.jobLink}` : ''
    ]
      .filter(Boolean)
      .join('\n'),
    html: buildMailHtml(payload)
  };

  for (let attempt = 1; attempt <= config.smtpRetryTimes; attempt++) {
    try {
      await transporter.sendMail(mailOptions);
      return true;
    } catch (error) {
      const canRetry = shouldRetryEmailError(error);
      console.error(`[${requestId}] 发送接管提醒失败(${attempt}/${config.smtpRetryTimes}):`, error);
      if (!canRetry || attempt === config.smtpRetryTimes) {
        break;
      }
      await sleep(config.smtpRetryDelayMs * attempt);
    }
  }

  return false;
}

async function safeUpdateEvent(eventId: string, patch: Record<string, unknown>): Promise<void> {
  if (!eventId) {
    return;
  }

  try {
    await db.collection(EVENTS_COLLECTION).doc(eventId).update(patch);
  } catch (error) {
    console.warn(`[job-bot-handoff] 更新事件状态失败: ${eventId}`, error);
  }
}

export default async function (ctx: any) {
  const requestId = `jobbot_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const config = getConfig();

  try {
    const method = String(ctx?.method || 'POST').toUpperCase();
    if (method !== 'POST') {
      return {
        code: 405,
        success: false,
        message: '仅支持 POST 请求',
        requestId
      };
    }

    if (!config.webhookToken) {
      return {
        code: 503,
        success: false,
        message: '服务端未配置 Job Bot Webhook 鉴权令牌',
        requestId
      };
    }

    const authHeader = getHeader(ctx?.headers, 'authorization');
    const bearerToken = extractBearerToken(authHeader);
    const customToken = normalizeText(getHeader(ctx?.headers, 'x-job-bot-token'), 200);
    const providedToken = bearerToken || customToken;

    if (!providedToken || !timingSafeEqualText(providedToken, config.webhookToken)) {
      return {
        code: 403,
        success: false,
        message: '无权访问该接口',
        requestId
      };
    }

    const body = ctx?.body && typeof ctx.body === 'object' ? ctx.body : {};
    const source = normalizeText(body.source || 'job-bot-desktop', 32).toLowerCase();
    const company = normalizeText(body.company, 120);
    const title = normalizeText(body.title, 120);
    const intentRaw = normalizeText(body.intent || 'handoff', 30).toLowerCase();
    const intent = ALLOWED_INTENTS.has(intentRaw) ? intentRaw : 'general';
    const hrMessage = normalizeText(body.hrMessage, 400);
    const autoReply = normalizeText(body.autoReply, 400);
    const jobLink = normalizeUrl(body.jobLink);

    if (source !== 'job-bot-desktop') {
      return {
        code: 400,
        success: false,
        message: '来源不合法，仅支持 job-bot-desktop',
        requestId
      };
    }

    if (!company) {
      return {
        code: 400,
        success: false,
        message: 'company 不能为空（公司名称）',
        requestId
      };
    }

    if (!title) {
      return {
        code: 400,
        success: false,
        message: 'title 不能为空（岗位名称）',
        requestId
      };
    }

    if (!hrMessage) {
      return {
        code: 400,
        success: false,
        message: 'hrMessage 不能为空（HR消息）',
        requestId
      };
    }

    const receiverFromBody = normalizeEmail(body.receiver);
    const receiver = receiverFromBody || normalizeEmail(config.defaultReceiver);

    if (!receiver) {
      return {
        code: 400,
        success: false,
        message: '未配置接收邮箱，请在 payload.receiver 或 JOB_BOT_HANDOFF_RECEIVER 中提供',
        requestId
      };
    }

    if (!isValidEmail(receiver)) {
      return {
        code: 400,
        success: false,
        message: '接收邮箱格式不正确',
        requestId
      };
    }

    if (isReservedEmailDomain(receiver)) {
      return {
        code: 400,
        success: false,
        message: '请使用真实可收件邮箱，示例域名不可用',
        requestId
      };
    }

    const collection = db.collection(EVENTS_COLLECTION);
    const now = Date.now();
    const clientIP = getClientIp(ctx);

    if (clientIP !== 'unknown') {
      const countResult = await collection
        .where({
          client_ip: clientIP,
          created_at: db.command.gt(now - config.rateWindowMs)
        })
        .count();

      if ((countResult?.total || 0) >= config.rateLimit) {
        return {
          code: 429,
          success: false,
          message: '请求过于频繁，请稍后再试',
          requestId
        };
      }
    }

    const dedupeHash = buildDedupeHash({ company, title, intent, hrMessage });
    const duplicate = await collection
      .where({
        dedupe_hash: dedupeHash,
        created_at: db.command.gt(now - config.dedupeWindowMs)
      })
      .getOne();

    if (duplicate?.data) {
      return {
        code: 0,
        success: true,
        message: '接管提醒已记录（去重）',
        data: {
          eventId: duplicate.data._id || duplicate.data.id || '',
          duplicate: true,
          delivered: Boolean(duplicate.data.delivered_at)
        },
        requestId
      };
    }

    const addRes = await collection.add({
      source,
      company,
      title,
      intent,
      hr_message: hrMessage,
      auto_reply: autoReply,
      job_link: jobLink,
      receiver,
      receiver_masked: maskEmail(receiver),
      client_ip: clientIP,
      dedupe_hash: dedupeHash,
      status: 'pending_mail',
      created_at: now,
      updated_at: now
    });

    const eventId = String(addRes?.id || '');
    const payload: HandoffMailPayload = {
      eventId: eventId || dedupeHash.slice(0, 12),
      company,
      title,
      intent,
      hrMessage,
      autoReply,
      jobLink,
      createdAt: new Date(now).toISOString(),
      receiverMasked: maskEmail(receiver)
    };

    const sent = await sendHandoffEmail(receiver, payload, requestId, config);
    if (!sent) {
      await safeUpdateEvent(eventId, {
        status: 'mail_failed',
        updated_at: Date.now(),
        last_error: 'smtp_send_failed_or_not_configured'
      });

      if (config.isProduction) {
        return {
          code: 502,
          success: false,
          message: '接管提醒记录成功，但邮件发送失败',
          requestId
        };
      }

      return {
        code: 0,
        success: true,
        message: '开发模式：接管提醒已记录，邮件暂未送达',
        data: {
          eventId: payload.eventId,
          duplicate: false,
          delivered: false,
          receiver: payload.receiverMasked
        },
        requestId
      };
    }

    await safeUpdateEvent(eventId, {
      status: 'delivered',
      delivered_at: Date.now(),
      updated_at: Date.now()
    });

    console.log(
      `[${requestId}] Job Bot 接管提醒已发送: ${payload.company} / ${payload.title} -> ${payload.receiverMasked}`
    );

    return {
      code: 0,
      success: true,
      message: '接管提醒已发送',
      data: {
        eventId: payload.eventId,
        duplicate: false,
        delivered: true,
        receiver: payload.receiverMasked
      },
      requestId
    };
  } catch (error: any) {
    console.error(`[${requestId}] Job Bot 接管通知异常:`, error);
    return {
      code: 500,
      success: false,
      message: '服务异常，请稍后重试',
      requestId
    };
  }
}
