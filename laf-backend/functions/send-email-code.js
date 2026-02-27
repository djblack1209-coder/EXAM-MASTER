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
const SMTP_PORT = process.env.SMTP_PORT || 465;
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const SMTP_FROM = process.env.SMTP_FROM || 'Exam-Master <noreply@exam-master.com>';

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

export default async function (ctx) {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

  try {
    const { email: rawEmail } = ctx.body || {};
    const email = normalizeEmail(rawEmail);

    // 参数校验
    if (!email) {
      return {
        code: 400,
        message: '邮箱地址不能为空',
        requestId
      };
    }

    // 邮箱格式验证
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return {
        code: 400,
        message: '邮箱格式不正确',
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
          message: '请求过于频繁，请稍后再试',
          requestId
        };
      }
    }

    // 生成6位验证码
    const code = crypto.randomInt(100000, 999999).toString();

    // 保存验证码到数据库
    await codesCollection.add({
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
      console.warn(`[${requestId}] 邮件发送失败，验证码已保存到数据库`);

      // 不返回验证码，避免泄露
      if (process.env.NODE_ENV !== 'production') {
        return {
          code: 0,
          message: '开发模式：验证码已生成，但邮件发送失败',
          requestId
        };
      }

      return {
        code: 502,
        message: '邮件服务暂时不可用，请稍后再试',
        requestId
      };
    }

    console.log(`[${requestId}] 验证码已发送到: ${maskEmail(email)}`);

    return {
      code: 0,
      message: '验证码已发送，请查收邮件',
      requestId
    };
  } catch (error) {
    console.error(`[${requestId}] 发送验证码异常:`, error);

    return {
      code: 500,
      message: '服务异常，请稍后重试',
      requestId
    };
  }
}

/**
 * 发送邮件
 */
async function sendEmail(to, code) {
  try {
    // 如果没有配置SMTP，跳过发送
    if (!SMTP_USER || !SMTP_PASS) {
      console.warn('SMTP未配置，跳过邮件发送');
      return false;
    }

    // 使用 nodemailer 发送邮件
    const nodemailer = require('nodemailer');

    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: true,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS
      }
    });

    const mailOptions = {
      from: SMTP_FROM,
      to: to,
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

    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error('发送邮件失败:', error);
    return false;
  }
}
