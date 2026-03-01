/**
 * 发送邮箱验证码云函数
 *
 * 请求参数：
 * - email: string (必填) - 邮箱地址
 *
 * 返回格式：
 * { code: 0, message: '验证码已发送' }
 */

import cloud from '@lafjs/cloud';
import crypto from 'crypto';

// 邮件服务配置（使用环境变量）
const SMTP_HOST = process.env.SMTP_HOST || 'smtp.qq.com';
const SMTP_PORT = Number(process.env.SMTP_PORT || 465);
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const SMTP_FROM = process.env.SMTP_FROM || 'Exam-Master <noreply@exam-master.com>';
const SMTP_RETRY_TIMES = Math.max(1, Number(process.env.SMTP_RETRY_TIMES || 3));
const SMTP_RETRY_DELAY_MS = Math.max(200, Number(process.env.SMTP_RETRY_DELAY_MS || 800));

const RESERVED_EMAIL_DOMAINS = new Set(['example.com', 'example.net', 'example.org']);
const RESERVED_EMAIL_SUFFIXES = ['.example', '.invalid', '.localhost', '.test'];

// 获取数据库实例
const db = cloud.database();

function normalizeEmail(email) {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

function maskEmail(email) {
  if (typeof email !== 'string' || !email.includes('@')) return '***';
  const [localPart, domain] = email.split('@');
  if (!localPart || !domain) return '***';
  if (localPart.length <= 2) return `${localPart[0] || '*'}***@${domain}`;
  return `${localPart[0]}***${localPart[localPart.length - 1]}@${domain}`;
}

function isReservedEmailDomain(email) {
  if (typeof email !== 'string' || !email.includes('@')) return true;
  const domain = email.split('@')[1].toLowerCase();

  if (!domain) {
    return true;
  }

  if (RESERVED_EMAIL_DOMAINS.has(domain)) {
    return true;
  }

  return RESERVED_EMAIL_SUFFIXES.some((suffix) => domain.endsWith(suffix));
}

export default async function (ctx) {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

  try {
    const { email: rawEmail } = ctx.body || {};
    const email = normalizeEmail(rawEmail);

    // 参数校验
    if (!email) {
      return {
        code: 400,
        success: false,
        message: '邮箱地址不能为空',
        requestId
      };
    }

    // M-10 FIX: 使用与 login.ts 一致的严格邮箱正则
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email)) {
      return {
        code: 400,
        success: false,
        message: '邮箱格式不正确',
        requestId
      };
    }

    if (isReservedEmailDomain(email)) {
      return {
        code: 400,
        success: false,
        message: '请使用真实可收件邮箱，示例域名不可用',
        requestId
      };
    }

    // 检查发送频率（1分钟内只能发送一次）
    const codesCollection = db.collection('email_codes');
    const now = Date.now();

    const recentCode = await codesCollection
      .where({
        email,
        created_at: db.command.gt(now - 60 * 1000)
      })
      .getOne();

    if (recentCode.data) {
      return {
        code: 429,
        success: false,
        message: '发送太频繁，请1分钟后再试',
        requestId
      };
    }

    // 安全修复：同一邮箱每日最多发送 10 次验证码，防止邮件轰炸
    const dailyCount = await codesCollection
      .where({
        email,
        created_at: db.command.gt(now - 24 * 60 * 60 * 1000)
      })
      .count();

    if (dailyCount.total >= 10) {
      return {
        code: 429,
        success: false,
        message: '今日验证码发送次数已达上限，请明天再试',
        requestId
      };
    }

    // 安全修复：基于 IP 的全局限流（每个 IP 每小时最多 20 次）
    const clientIP = ctx.headers?.['x-forwarded-for']?.split(',')[0]?.trim() || ctx.headers?.['x-real-ip'] || 'unknown';

    if (clientIP !== 'unknown') {
      const ipHourlyCount = await codesCollection
        .where({
          client_ip: clientIP,
          created_at: db.command.gt(now - 60 * 60 * 1000)
        })
        .count();

      if (ipHourlyCount.total >= 20) {
        return {
          code: 429,
          success: false,
          message: '请求过于频繁，请稍后再试',
          requestId
        };
      }
    }

    // 生成6位验证码
    const code = crypto.randomInt(100000, 999999).toString();

    // 先保存验证码，确保后续校验可追踪
    const codeDoc = await codesCollection.add({
      email,
      code,
      client_ip: clientIP,
      used: false,
      created_at: Date.now()
    });

    // 发送邮件
    const emailSent = await sendEmail(email, code);

    if (!emailSent) {
      // 邮件发送失败
      console.warn(`[${requestId}] 邮件发送失败，准备回滚验证码记录`);

      // 回滚未送达验证码，避免用户因 1 分钟限流无法立即重试
      try {
        if (codeDoc?.id && typeof codesCollection.doc === 'function') {
          await codesCollection.doc(codeDoc.id).remove();
        } else {
          console.warn(`[${requestId}] 当前数据库适配器不支持按 doc 回滚验证码记录`);
        }
      } catch (rollbackError) {
        console.error(`[${requestId}] 验证码回滚失败:`, rollbackError);
      }

      // 不返回验证码，避免泄露
      if (process.env.NODE_ENV !== 'production') {
        return {
          code: 0,
          success: true,
          message: '开发模式：验证码已生成，但邮件发送失败',
          requestId
        };
      }

      return {
        code: 502,
        success: false,
        message: '邮件服务暂时不可用，请稍后再试',
        requestId
      };
    }

    console.log(`[${requestId}] 验证码已发送到: ${maskEmail(email)}`);

    return {
      code: 0,
      success: true,
      message: '验证码已发送，请查收邮件',
      requestId
    };
  } catch (error) {
    console.error(`[${requestId}] 发送验证码异常:`, error);

    return {
      code: 500,
      success: false,
      message: '服务异常，请稍后重试',
      requestId
    };
  }
}

/**
 * 发送邮件
 */
async function sendEmail(to, code) {
  // 如果没有配置SMTP，跳过发送
  if (!SMTP_USER || !SMTP_PASS) {
    console.warn('SMTP未配置，跳过邮件发送');
    return false;
  }

  // 使用 nodemailer 发送邮件（动态导入，Laf 运行时提供）
  const nodemailer = await import('nodemailer');
  const transporter = (nodemailer.default || nodemailer).createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000
  });

  const mailOptions = {
    from: SMTP_FROM,
    to,
    subject: '【Exam-Master】邮箱验证码',
    html: `
        <div style="max-width: 600px; margin: 0 auto; padding: 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #2E7D32; margin: 0;">Exam-Master</h1>
            <p style="color: #666; margin-top: 8px;">AI助力，一战成硕</p>
          </div>
          
          <div style="background: #f5f5f5; border-radius: 12px; padding: 30px; text-align: center;">
            <p style="color: #333; font-size: 16px; margin: 0 0 20px;">您的验证码是：</p>
            <div style="background: #fff; border-radius: 8px; padding: 20px; display: inline-block;">
              <span style="font-size: 32px; font-weight: bold; color: #2E7D32; letter-spacing: 8px;">${code}</span>
            </div>
            <p style="color: #999; font-size: 14px; margin-top: 20px;">验证码10分钟内有效，请勿泄露给他人</p>
          </div>
          
          <div style="text-align: center; margin-top: 30px; color: #999; font-size: 12px;">
            <p>如果您没有请求此验证码，请忽略此邮件</p>
            <p>© 2026 Exam-Master. All rights reserved.</p>
          </div>
        </div>
      `
  };

  for (let attempt = 1; attempt <= SMTP_RETRY_TIMES; attempt++) {
    try {
      await transporter.sendMail(mailOptions);
      return true;
    } catch (error) {
      const canRetry = shouldRetryEmailError(error);
      console.error(`发送邮件失败(第 ${attempt}/${SMTP_RETRY_TIMES} 次):`, error);

      if (!canRetry || attempt >= SMTP_RETRY_TIMES) {
        return false;
      }

      await sleep(SMTP_RETRY_DELAY_MS * attempt);
    }
  }

  return false;
}

function shouldRetryEmailError(error) {
  const code = String(error?.code || '').toUpperCase();
  const responseCode = Number(error?.responseCode || 0);

  if (code === 'EAUTH') {
    return false;
  }

  if (responseCode >= 500 && responseCode < 600) {
    return true;
  }

  if (responseCode >= 400 && responseCode < 500) {
    return false;
  }

  return ['ETIMEDOUT', 'ESOCKET', 'ECONNECTION', 'ECONNRESET', 'EAI_AGAIN', 'ENOTFOUND'].includes(code);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
