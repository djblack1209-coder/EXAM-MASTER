import { isIP } from 'node:net';

/** Normalize a single transport address; never accepts a list, hostname or zone ID. */
export function normalizeClientIp(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  let ip = value.trim();
  const bracketed = ip.match(/^\[([^\]]+)\](?::([0-9]+))?$/);
  const withPort = ip.match(/^(\d+\.\d+\.\d+\.\d+):([0-9]+)$/);
  const endpoint = bracketed || withPort;
  if (endpoint) {
    if (endpoint[2] && (Number(endpoint[2]) < 1 || Number(endpoint[2]) > 65535)) return null;
    ip = endpoint[1];
  }
  if (ip.includes('%') || !isIP(ip)) return null;
  if (isIP(ip) === 4) return ip;
  const canonical = new URL(`http://[${ip}]/`).hostname.slice(1, -1);
  const mapped = canonical.match(/^::ffff:([a-f0-9]{1,4}):([a-f0-9]{1,4})$/);
  if (!mapped) return canonical;
  const high = parseInt(mapped[1], 16);
  const low = parseInt(mapped[2], 16);
  return [high >> 8, high & 255, low >> 8, low & 255].join('.');
}

/**
 * Standalone supplies the once-resolved trusted address in this transport field.
 * Historical Laf compatibility uses only its socket peer, never request headers/ctx.ip.
 */
export function getClientIp(ctx: any): string | null {
  return normalizeClientIp(ctx?.socket?.remoteAddress);
}

export function clientIpUnavailable() {
  return { code: 503, success: false, message: '暂时无法确认请求来源，请稍后重试', retryAfter: 5 };
}
