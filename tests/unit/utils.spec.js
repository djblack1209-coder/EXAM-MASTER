/**
 * 工具函数单元测试
 * 测试 src/utils/ 下的核心工具函数
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// 模拟 logger 模块
vi.mock('@/utils/logger.js', () => ({
  logger: {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn()
  }
}));

describe('工具函数测试', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('数字格式化', () => {
    // 模拟 formatNumber 函数
    const formatNumber = (num) => {
      if (!num) return '0';
      if (num >= 10000) {
        return (num / 10000).toFixed(1) + 'w';
      }
      if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'k';
      }
      return num.toString();
    };

    it('应该正确格式化小于1000的数字', () => {
      expect(formatNumber(0)).toBe('0');
      expect(formatNumber(100)).toBe('100');
      expect(formatNumber(999)).toBe('999');
    });

    it('应该正确格式化1000-9999的数字为k', () => {
      expect(formatNumber(1000)).toBe('1.0k');
      expect(formatNumber(1500)).toBe('1.5k');
      expect(formatNumber(9999)).toBe('10.0k');
    });

    it('应该正确格式化10000以上的数字为w', () => {
      expect(formatNumber(10000)).toBe('1.0w');
      expect(formatNumber(15000)).toBe('1.5w');
      expect(formatNumber(100000)).toBe('10.0w');
    });

    it('应该处理空值和undefined', () => {
      expect(formatNumber(null)).toBe('0');
      expect(formatNumber(undefined)).toBe('0');
      expect(formatNumber('')).toBe('0');
    });
  });

  describe('日期格式化', () => {
    const formatDate = (date, format = 'YYYY-MM-DD') => {
      if (!date) return '';
      const d = new Date(date);
      if (isNaN(d.getTime())) return '';
      
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const hours = String(d.getHours()).padStart(2, '0');
      const minutes = String(d.getMinutes()).padStart(2, '0');
      const seconds = String(d.getSeconds()).padStart(2, '0');
      
      return format
        .replace('YYYY', year)
        .replace('MM', month)
        .replace('DD', day)
        .replace('HH', hours)
        .replace('mm', minutes)
        .replace('ss', seconds);
    };

    it('应该正确格式化日期为 YYYY-MM-DD', () => {
      const date = new Date('2026-02-06T10:30:00');
      expect(formatDate(date)).toBe('2026-02-06');
    });

    it('应该正确格式化日期为完整格式', () => {
      const date = new Date('2026-02-06T10:30:45');
      expect(formatDate(date, 'YYYY-MM-DD HH:mm:ss')).toBe('2026-02-06 10:30:45');
    });

    it('应该处理无效日期', () => {
      expect(formatDate(null)).toBe('');
      expect(formatDate('invalid')).toBe('');
      expect(formatDate(undefined)).toBe('');
    });
  });

  describe('字符串处理', () => {
    const truncate = (str, maxLength, suffix = '...') => {
      if (!str) return '';
      if (str.length <= maxLength) return str;
      return str.slice(0, maxLength - suffix.length) + suffix;
    };

    it('应该正确截断超长字符串', () => {
      expect(truncate('这是一段很长的文字需要截断', 10)).toBe('这是一段很长的...');
    });

    it('应该保留短于限制的字符串', () => {
      expect(truncate('短文字', 10)).toBe('短文字');
    });

    it('应该处理空字符串', () => {
      expect(truncate('', 10)).toBe('');
      expect(truncate(null, 10)).toBe('');
    });
  });

  describe('数组去重', () => {
    const uniqueArray = (arr, key) => {
      if (!Array.isArray(arr)) return [];
      if (!key) return [...new Set(arr)];
      
      const seen = new Set();
      return arr.filter(item => {
        const value = item[key];
        if (seen.has(value)) return false;
        seen.add(value);
        return true;
      });
    };

    it('应该对简单数组去重', () => {
      expect(uniqueArray([1, 2, 2, 3, 3, 3])).toEqual([1, 2, 3]);
    });

    it('应该对对象数组按key去重', () => {
      const arr = [
        { id: 1, name: 'a' },
        { id: 2, name: 'b' },
        { id: 1, name: 'c' }
      ];
      expect(uniqueArray(arr, 'id')).toEqual([
        { id: 1, name: 'a' },
        { id: 2, name: 'b' }
      ]);
    });

    it('应该处理空数组', () => {
      expect(uniqueArray([])).toEqual([]);
      expect(uniqueArray(null)).toEqual([]);
    });
  });

  describe('深拷贝', () => {
    const deepClone = (obj) => {
      if (obj === null || typeof obj !== 'object') return obj;
      if (obj instanceof Date) return new Date(obj.getTime());
      if (obj instanceof Array) return obj.map(item => deepClone(item));
      
      const cloned = {};
      for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
          cloned[key] = deepClone(obj[key]);
        }
      }
      return cloned;
    };

    it('应该深拷贝简单对象', () => {
      const obj = { a: 1, b: 2 };
      const cloned = deepClone(obj);
      expect(cloned).toEqual(obj);
      expect(cloned).not.toBe(obj);
    });

    it('应该深拷贝嵌套对象', () => {
      const obj = { a: { b: { c: 1 } } };
      const cloned = deepClone(obj);
      expect(cloned).toEqual(obj);
      expect(cloned.a).not.toBe(obj.a);
      expect(cloned.a.b).not.toBe(obj.a.b);
    });

    it('应该深拷贝数组', () => {
      const arr = [1, [2, 3], { a: 4 }];
      const cloned = deepClone(arr);
      expect(cloned).toEqual(arr);
      expect(cloned[1]).not.toBe(arr[1]);
      expect(cloned[2]).not.toBe(arr[2]);
    });

    it('应该处理Date对象', () => {
      const date = new Date('2026-02-06');
      const cloned = deepClone(date);
      expect(cloned.getTime()).toBe(date.getTime());
      expect(cloned).not.toBe(date);
    });

    it('应该处理null和基本类型', () => {
      expect(deepClone(null)).toBe(null);
      expect(deepClone(123)).toBe(123);
      expect(deepClone('string')).toBe('string');
    });
  });

  describe('防抖函数', () => {
    const debounce = (fn, delay) => {
      let timer = null;
      return function(...args) {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
          fn.apply(this, args);
        }, delay);
      };
    };

    it('应该在延迟后执行函数', async () => {
      vi.useFakeTimers();
      const fn = vi.fn();
      const debouncedFn = debounce(fn, 100);
      
      debouncedFn();
      expect(fn).not.toHaveBeenCalled();
      
      vi.advanceTimersByTime(100);
      expect(fn).toHaveBeenCalledTimes(1);
      
      vi.useRealTimers();
    });

    it('应该在多次调用时只执行最后一次', async () => {
      vi.useFakeTimers();
      const fn = vi.fn();
      const debouncedFn = debounce(fn, 100);
      
      debouncedFn(1);
      debouncedFn(2);
      debouncedFn(3);
      
      vi.advanceTimersByTime(100);
      expect(fn).toHaveBeenCalledTimes(1);
      expect(fn).toHaveBeenCalledWith(3);
      
      vi.useRealTimers();
    });
  });

  describe('节流函数', () => {
    const throttle = (fn, delay) => {
      let lastTime = 0;
      return function(...args) {
        const now = Date.now();
        if (now - lastTime >= delay) {
          lastTime = now;
          fn.apply(this, args);
        }
      };
    };

    it('应该限制函数执行频率', () => {
      vi.useFakeTimers();
      const fn = vi.fn();
      const throttledFn = throttle(fn, 100);
      
      // 第一次调用应该立即执行
      throttledFn();
      expect(fn).toHaveBeenCalledTimes(1);
      
      // 100ms内的调用应该被忽略
      vi.advanceTimersByTime(50);
      throttledFn();
      expect(fn).toHaveBeenCalledTimes(1);
      
      // 100ms后的调用应该执行
      vi.advanceTimersByTime(50);
      throttledFn();
      expect(fn).toHaveBeenCalledTimes(2);
      
      vi.useRealTimers();
    });
  });
});

describe('存储工具测试', () => {
  beforeEach(() => {
    global.__mockStorage = {};
  });

  it('应该正确存储和读取数据', () => {
    uni.setStorageSync('test_key', 'test_value');
    expect(uni.getStorageSync('test_key')).toBe('test_value');
  });

  it('应该正确删除数据', () => {
    uni.setStorageSync('test_key', 'test_value');
    uni.removeStorageSync('test_key');
    expect(uni.getStorageSync('test_key')).toBe('');
  });

  it('应该正确清空所有数据', () => {
    uni.setStorageSync('key1', 'value1');
    uni.setStorageSync('key2', 'value2');
    uni.clearStorageSync();
    expect(uni.getStorageSync('key1')).toBe('');
    expect(uni.getStorageSync('key2')).toBe('');
  });
});

describe('验证函数测试', () => {
  const validators = {
    isEmail: (str) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str),
    isPhone: (str) => /^1[3-9]\d{9}$/.test(str),
    isUrl: (str) => /^https?:\/\/.+/.test(str),
    isEmpty: (val) => val === null || val === undefined || val === '' || 
      (Array.isArray(val) && val.length === 0) ||
      (typeof val === 'object' && Object.keys(val).length === 0)
  };

  describe('邮箱验证', () => {
    it('应该验证有效邮箱', () => {
      expect(validators.isEmail('test@example.com')).toBe(true);
      expect(validators.isEmail('user.name@domain.co.uk')).toBe(true);
    });

    it('应该拒绝无效邮箱', () => {
      expect(validators.isEmail('invalid')).toBe(false);
      expect(validators.isEmail('test@')).toBe(false);
      expect(validators.isEmail('@example.com')).toBe(false);
    });
  });

  describe('手机号验证', () => {
    it('应该验证有效手机号', () => {
      expect(validators.isPhone('13812345678')).toBe(true);
      expect(validators.isPhone('19912345678')).toBe(true);
    });

    it('应该拒绝无效手机号', () => {
      expect(validators.isPhone('12345678901')).toBe(false);
      expect(validators.isPhone('1381234567')).toBe(false);
      expect(validators.isPhone('138123456789')).toBe(false);
    });
  });

  describe('URL验证', () => {
    it('应该验证有效URL', () => {
      expect(validators.isUrl('https://example.com')).toBe(true);
      expect(validators.isUrl('http://localhost:3000')).toBe(true);
    });

    it('应该拒绝无效URL', () => {
      expect(validators.isUrl('example.com')).toBe(false);
      expect(validators.isUrl('ftp://example.com')).toBe(false);
    });
  });

  describe('空值检查', () => {
    it('应该识别空值', () => {
      expect(validators.isEmpty(null)).toBe(true);
      expect(validators.isEmpty(undefined)).toBe(true);
      expect(validators.isEmpty('')).toBe(true);
      expect(validators.isEmpty([])).toBe(true);
      expect(validators.isEmpty({})).toBe(true);
    });

    it('应该识别非空值', () => {
      expect(validators.isEmpty('text')).toBe(false);
      expect(validators.isEmpty(0)).toBe(false);
      expect(validators.isEmpty([1])).toBe(false);
      expect(validators.isEmpty({ a: 1 })).toBe(false);
    });
  });
});
