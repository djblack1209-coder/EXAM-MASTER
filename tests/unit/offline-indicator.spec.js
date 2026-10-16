import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import OfflineIndicator from '@/components/common/offline-indicator.vue';

const mocks = vi.hoisted(() => ({
  status: { isConnected: true, networkType: 'wifi', quality: 'good' },
  count: 2,
  listeners: {},
  unsubscribe: vi.fn(),
  process: vi.fn()
}));
vi.mock('@/utils/core/network-monitor.js', () => ({
  NETWORK_QUALITY: { GOOD: 'good', OFFLINE: 'offline' },
  networkMonitor: {
    getStatus: () => mocks.status,
    on: (name, callback) => {
      mocks.listeners[name] = callback;
      return mocks.unsubscribe;
    }
  }
}));
vi.mock('@/utils/core/offline-queue.js', () => ({
  offlineQueue: {
    getStatus: () => ({ queueLength: mocks.count }),
    addListener: () => mocks.unsubscribe,
    processQueue: mocks.process
  }
}));
vi.mock('@/utils/toast.js', () => ({ toast: { success: vi.fn(), info: vi.fn() } }));
let wrapper;
beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  mocks.status = { isConnected: true, networkType: 'wifi', quality: 'good' };
  mocks.count = 2;
  wrapper = mount(OfflineIndicator, {
    global: {
      stubs: { view: { template: '<div><slot /></div>' }, text: { template: '<span><slot /></span>' }, BaseIcon: true }
    }
  });
});
afterEach(() => {
  wrapper?.unmount();
  vi.useRealTimers();
});

it('opens details from the keyboard and dismisses through the shared button without starting a sync', async () => {
  const toggle = wrapper.find('.offline-indicator__compact');
  await toggle.trigger('keydown', { key: 'Enter' });
  expect(toggle.attributes('aria-expanded')).toBe('true');
  await wrapper.find('.action-btn--dismiss').trigger('keydown', { key: 'Enter' });
  expect(wrapper.find('.offline-indicator').exists()).toBe(false);
  expect(mocks.process).not.toHaveBeenCalled();
});

it('runs only one pending sync and keeps its action blocked until the response settles', async () => {
  let finish;
  mocks.process.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      })
  );
  await wrapper.find('.offline-indicator__compact').trigger('keydown', { key: ' ' });
  const sync = wrapper.find('.action-btn--sync');
  await sync.trigger('keydown', { key: 'Enter' });
  await sync.trigger('keydown', { key: 'Enter' });
  expect(mocks.process).toHaveBeenCalledTimes(1);
  expect(sync.attributes('disabled')).toBeDefined();
  finish({ success: true, processed: 2 });
  await flushPromises();
  expect(sync.attributes('disabled')).toBeUndefined();
});

it('keeps offline feedback readable, omits sync, and removes all subscriptions and timers on exit', async () => {
  mocks.listeners.change({ isConnected: false, networkType: 'none', quality: 'offline' });
  mocks.listeners.offline();
  await wrapper.vm.$nextTick();
  await wrapper.find('.offline-indicator__compact').trigger('keydown', { key: 'Enter' });
  expect(wrapper.text()).toContain('网络已断开');
  expect(wrapper.find('.action-btn--sync').exists()).toBe(false);
  wrapper.unmount();
  wrapper = null;
  expect(mocks.unsubscribe).toHaveBeenCalledTimes(5);
  expect(vi.getTimerCount()).toBe(0);
});
