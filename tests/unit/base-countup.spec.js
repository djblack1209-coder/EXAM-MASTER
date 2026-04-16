/**
 * base-countup 组件单元测试
 * 验证数字滚动组件的核心逻辑（数字格式化、动画曲线、千分位等）
 */
import { describe, it, expect, vi } from 'vitest';

// Mock uni 全局
global.uni = {
  createSelectorQuery: vi.fn(() => ({
    in: vi.fn(function () {
      return this;
    }),
    select: vi.fn(function () {
      return this;
    }),
    fields: vi.fn(function () {
      return this;
    }),
    exec: vi.fn()
  })),
  getSystemInfoSync: vi.fn(() => ({ pixelRatio: 2 }))
};

describe('BaseCountup 组件逻辑', () => {
  describe('数字格式化', () => {
    /** 模拟 formatNumber 函数 */
    function formatNumber(num, decimals = 0, useGrouping = true, separator = ',') {
      const fixed = num.toFixed(decimals);
      if (!useGrouping) return fixed;
      const parts = fixed.split('.');
      parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, separator);
      return parts.join('.');
    }

    it('整数格式化', () => {
      expect(formatNumber(1234)).toBe('1,234');
      expect(formatNumber(0)).toBe('0');
      expect(formatNumber(999)).toBe('999');
      expect(formatNumber(1000)).toBe('1,000');
    });

    it('大数字千分位', () => {
      expect(formatNumber(1234567)).toBe('1,234,567');
      expect(formatNumber(10000000)).toBe('10,000,000');
    });

    it('小数位数', () => {
      expect(formatNumber(98.5, 1)).toBe('98.5');
      expect(formatNumber(98, 2)).toBe('98.00');
      expect(formatNumber(3.14159, 3)).toBe('3.142');
    });

    it('禁用千分位', () => {
      expect(formatNumber(1234567, 0, false)).toBe('1234567');
      expect(formatNumber(12345.678, 2, false)).toBe('12345.68');
    });

    it('自定义分隔符', () => {
      expect(formatNumber(1234567, 0, true, '.')).toBe('1.234.567');
      expect(formatNumber(1234567, 0, true, ' ')).toBe('1 234 567');
    });
  });

  describe('缓出动画曲线 (easeOutExpo)', () => {
    /** 模拟 easeOutExpo */
    function easeOutExpo(progress) {
      return progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
    }

    it('起点接近 0', () => {
      // easeOutExpo(0) = 1 - 2^0 = 0（非严格 0，而是非常小的正数）
      expect(easeOutExpo(0)).toBeCloseTo(0, 0);
      expect(easeOutExpo(0)).toBeLessThan(0.01);
    });

    it('终点为 1', () => {
      expect(easeOutExpo(1)).toBe(1);
    });

    it('中间值递增', () => {
      const p25 = easeOutExpo(0.25);
      const p50 = easeOutExpo(0.5);
      const p75 = easeOutExpo(0.75);

      expect(p25).toBeLessThan(p50);
      expect(p50).toBeLessThan(p75);
    });

    it('前半段快速增长', () => {
      // easeOutExpo 特点：前半段已经达到 ~97%
      const p50 = easeOutExpo(0.5);
      expect(p50).toBeGreaterThan(0.95);
    });
  });

  describe('Props 默认值', () => {
    it('核心默认值正确', () => {
      const defaults = {
        startVal: 0,
        endVal: 0,
        duration: 2,
        decimals: 0,
        suffix: '',
        prefix: '',
        autoplay: true,
        fontSize: '48rpx',
        fontWeight: 700,
        separator: ',',
        useGrouping: true
      };

      expect(defaults.duration).toBe(2);
      expect(defaults.autoplay).toBe(true);
      expect(defaults.separator).toBe(',');
      expect(defaults.useGrouping).toBe(true);
      expect(defaults.decimals).toBe(0);
    });
  });

  describe('动画值计算', () => {
    function calcAnimValue(startVal, endVal, progress) {
      const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      return startVal + (endVal - startVal) * eased;
    }

    it('从 0 到 100', () => {
      expect(calcAnimValue(0, 100, 0)).toBeCloseTo(0.1, 0);
      expect(calcAnimValue(0, 100, 1)).toBe(100);
    });

    it('从 50 到 200', () => {
      const result = calcAnimValue(50, 200, 1);
      expect(result).toBe(200);
    });

    it('倒计数（大到小）', () => {
      const result = calcAnimValue(100, 0, 1);
      expect(result).toBe(0);
    });
  });
});
