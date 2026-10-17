import expressUtils from 'express/lib/utils.js';
import type { Request } from 'express';
import { normalizeClientIp } from '../functions/_shared/client-ip.js';

// Native host Nginx. Docker Compose explicitly pins its own bridge gateway /32.
export const DEFAULT_TRUSTED_PROXIES = '127.0.0.1/32,::1/128';

/** Express address/CIDR/alias syntax, deliberately excluding hop counts and trust-all. */
export function compileTrustedProxies(value = process.env.TRUST_PROXY): (address: string) => boolean {
  const config = value === undefined ? DEFAULT_TRUSTED_PROXIES : value.trim();
  if (config === 'false') return () => false;
  const addresses = config.split(',').map((address) => address.trim());
  if (addresses.some((address) => !address || /^(?:true|false|[0-9]+)$/i.test(address)))
    throw new Error('Invalid TRUST_PROXY: use proxy addresses/CIDRs, never hop counts or trust-all');
  try {
    const compiled = expressUtils.compileTrust(addresses);
    return (address: string) => {
      const normalized = normalizeClientIp(address);
      return normalized !== null && compiled(normalized);
    };
  } catch {
    throw new Error('Invalid TRUST_PROXY: expected Express proxy addresses/CIDRs');
  }
}

/** req.ip walks right-to-left, stopping at the nearest untrusted peer. */
export function resolveClientIp(req: Request): string | null {
  if (!normalizeClientIp(req.socket.remoteAddress)) return null;
  return normalizeClientIp(req.ip);
}
