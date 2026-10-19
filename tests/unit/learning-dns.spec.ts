import { afterEach, expect, it, vi } from 'vitest';
import { Resolver } from 'node:dns/promises';
import {
  learningLookup,
  resolveCloudEndpoint
} from '../../laf-backend/functions/_shared/ai-providers/learning-provider';
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});
it('单进程解析器仍拒绝内网配置、混合地址和解析超时；不修改全局 DNS', async () => {
  vi.stubEnv('LEARNING_DNS_SERVERS', '127.0.0.1');
  await expect(learningLookup('model.example', {})).rejects.toMatchObject({ code: 'DNS_CONFIG_INVALID' });
  vi.stubEnv('LEARNING_DNS_SERVERS', '1.1.1.1');
  const a = vi.spyOn(Resolver.prototype, 'resolve4').mockResolvedValue(['8.8.8.8'] as any);
  vi.spyOn(Resolver.prototype, 'resolve6').mockRejectedValue({ code: 'ENODATA' });
  expect((await resolveCloudEndpoint('https://model.example/chat', ['https://model.example'])).address.address).toBe(
    '8.8.8.8'
  );
  a.mockResolvedValue(['8.8.8.8', '198.18.0.1'] as any);
  await expect(resolveCloudEndpoint('https://model.example/chat', ['https://model.example'])).rejects.toMatchObject({
    code: 'SSRF_BLOCKED'
  });
  a.mockRejectedValue({ code: 'ETIMEOUT' });
  await expect(learningLookup('model.example', {})).rejects.toMatchObject({ code: 'ETIMEOUT' });
});
