/**
 * Vitest 测试环境设置
 * Mock uni-app 全局 API
 */
import { vi } from 'vitest';

// Mock uni 全局对象
global.uni = {
  // 存储相关
  getStorageSync: vi.fn((key) => {
    const storage = global.__mockStorage || {};
    return storage[key] || '';
  }),
  setStorageSync: vi.fn((key, value) => {
    global.__mockStorage = global.__mockStorage || {};
    global.__mockStorage[key] = value;
  }),
  removeStorageSync: vi.fn((key) => {
    if (global.__mockStorage) {
      delete global.__mockStorage[key];
    }
  }),
  clearStorageSync: vi.fn(() => {
    global.__mockStorage = {};
  }),
  getStorageInfoSync: vi.fn(() => {
    const keys = Object.keys(global.__mockStorage || {});
    return {
      keys,
      currentSize: keys.length,
      limitSize: 10240
    };
  }),
  
  // 异步存储
  getStorage: vi.fn(({ key, success, fail }) => {
    try {
      const value = global.__mockStorage?.[key] || '';
      success?.({ data: value });
    } catch (e) {
      fail?.(e);
    }
  }),
  setStorage: vi.fn(({ key, data, success }) => {
    global.__mockStorage = global.__mockStorage || {};
    global.__mockStorage[key] = data;
    success?.();
  }),
  
  // 系统信息
  getSystemInfoSync: vi.fn(() => ({
    platform: 'devtools',
    model: 'iPhone 12',
    system: 'iOS 14.0',
    windowWidth: 375,
    windowHeight: 812,
    screenWidth: 375,
    screenHeight: 812,
    statusBarHeight: 44,
    safeAreaInsets: { top: 44, bottom: 34, left: 0, right: 0 },
    pixelRatio: 2
  })),
  
  // 导航相关
  navigateTo: vi.fn(({ url, success }) => {
    success?.();
    return Promise.resolve();
  }),
  redirectTo: vi.fn(({ url, success }) => {
    success?.();
    return Promise.resolve();
  }),
  switchTab: vi.fn(({ url, success }) => {
    success?.();
    return Promise.resolve();
  }),
  navigateBack: vi.fn(({ delta, success }) => {
    success?.();
    return Promise.resolve();
  }),
  reLaunch: vi.fn(({ url, success }) => {
    success?.();
    return Promise.resolve();
  }),
  
  // 提示相关
  showToast: vi.fn(({ title, icon, duration }) => {
    return Promise.resolve();
  }),
  hideToast: vi.fn(() => Promise.resolve()),
  showLoading: vi.fn(({ title }) => Promise.resolve()),
  hideLoading: vi.fn(() => Promise.resolve()),
  showModal: vi.fn(({ title, content, success }) => {
    success?.({ confirm: true, cancel: false });
    return Promise.resolve({ confirm: true, cancel: false });
  }),
  showActionSheet: vi.fn(({ itemList, success }) => {
    success?.({ tapIndex: 0 });
    return Promise.resolve({ tapIndex: 0 });
  }),
  
  // 网络请求
  request: vi.fn(({ url, method, data, success, fail }) => {
    success?.({ data: {}, statusCode: 200 });
    return { abort: vi.fn() };
  }),
  
  // 震动反馈
  vibrateShort: vi.fn(() => Promise.resolve()),
  vibrateLong: vi.fn(() => Promise.resolve()),
  
  // Canvas
  createCanvasContext: vi.fn(() => ({
    setFillStyle: vi.fn(),
    setStrokeStyle: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    clearRect: vi.fn(),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    draw: vi.fn((reserve, callback) => callback?.()),
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    scale: vi.fn()
  })),
  createSelectorQuery: vi.fn(() => ({
    in: vi.fn(() => ({
      select: vi.fn(() => ({
        fields: vi.fn(() => ({
          exec: vi.fn((callback) => callback?.([{ node: null, width: 375, height: 812 }]))
        })),
        boundingClientRect: vi.fn(() => ({
          exec: vi.fn((callback) => callback?.([{ width: 375, height: 100, top: 0, left: 0 }]))
        }))
      })),
      selectAll: vi.fn(() => ({
        boundingClientRect: vi.fn(() => ({
          exec: vi.fn((callback) => callback?.([]))
        }))
      }))
    }))
  })),
  
  // 文件相关
  chooseImage: vi.fn(({ count, success }) => {
    success?.({ tempFilePaths: ['/mock/image.png'] });
    return Promise.resolve({ tempFilePaths: ['/mock/image.png'] });
  }),
  uploadFile: vi.fn(({ url, filePath, success }) => {
    success?.({ data: '{"url": "/uploaded/image.png"}', statusCode: 200 });
    return { abort: vi.fn() };
  }),
  
  // 剪贴板
  setClipboardData: vi.fn(({ data, success }) => {
    success?.();
    return Promise.resolve();
  }),
  getClipboardData: vi.fn(({ success }) => {
    success?.({ data: '' });
    return Promise.resolve({ data: '' });
  }),
  
  // 页面相关
  pageScrollTo: vi.fn(() => Promise.resolve()),
  
  // 事件总线
  $emit: vi.fn(),
  $on: vi.fn(),
  $off: vi.fn(),
  $once: vi.fn()
};

// Mock getCurrentPages
global.getCurrentPages = vi.fn(() => [
  { route: 'pages/index/index', options: {} }
]);

// Mock getApp
global.getApp = vi.fn(() => ({
  globalData: {}
}));

// 清理函数 - 每个测试后重置
beforeEach(() => {
  global.__mockStorage = {};
  vi.clearAllMocks();
});

// 控制台警告过滤（可选）
const originalWarn = console.warn;
console.warn = (...args) => {
  // 过滤掉一些已知的无害警告
  if (args[0]?.includes?.('[Vue warn]')) {
    return;
  }
  originalWarn.apply(console, args);
};
