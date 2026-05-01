import { afterEach, describe, expect, it, vi } from 'vitest';

const originalUni = globalThis.uni;

describe('network monitor platform compatibility', () => {
  afterEach(() => {
    vi.resetModules();
    globalThis.uni = originalUni;
  });

  it('falls back to navigator status when H5 uni exists without network APIs', async () => {
    vi.resetModules();
    globalThis.uni = {
      onNetworkStatusChange: vi.fn(),
      offNetworkStatusChange: vi.fn()
    };

    const { networkMonitor } = await import('@/utils/core/network-monitor.js');

    expect(networkMonitor.getNetworkType()).toBe('wifi');
    expect(networkMonitor.isOnline()).toBe(true);
    expect(globalThis.uni.onNetworkStatusChange).toHaveBeenCalled();
  });
});
