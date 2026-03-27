/**
 * formatters.js 单元测试
 * T006: 工具函数测试覆盖
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { formatRelativeTime, getInitials } from '@/utils/formatters.js';

// 固定时间点：2026-02-11 12:00:00 UTC
const FIXED_NOW = new Date(2026, 1, 11, 12, 0, 0).getTime();

describe('formatters.js', () => {
  // 用 vi.spyOn 替代 vi.useFakeTimers（后者在 afterEach 中 useRealTimers 时会超时）
  let dateNowSpy;

  beforeEach(() => {
    dateNowSpy = vi.spyOn(Date, 'now').mockReturnValue(FIXED_NOW);
  });

  afterEach(() => {
    dateNowSpy.mockRestore();
  });

  describe('formatRelativeTime', () => {
    it('空值返回 fallback', () => {
      expect(formatRelativeTime(null)).toBe('刚刚');
      expect(formatRelativeTime(undefined)).toBe('刚刚');
      expect(formatRelativeTime(0)).toBe('刚刚');
      expect(formatRelativeTime('')).toBe('刚刚');
    });

    it('自定义 fallback', () => {
      expect(formatRelativeTime(null, '暂无')).toBe('暂无');
    });

    it('不到1分钟返回"刚刚"', () => {
      expect(formatRelativeTime(FIXED_NOW - 30 * 1000)).toBe('刚刚');
      expect(formatRelativeTime(FIXED_NOW - 59 * 1000)).toBe('刚刚');
    });

    it('分钟级别', () => {
      expect(formatRelativeTime(FIXED_NOW - 60 * 1000)).toBe('1分钟前');
      expect(formatRelativeTime(FIXED_NOW - 5 * 60 * 1000)).toBe('5分钟前');
      expect(formatRelativeTime(FIXED_NOW - 59 * 60 * 1000)).toBe('59分钟前');
    });

    it('小时级别', () => {
      expect(formatRelativeTime(FIXED_NOW - 60 * 60 * 1000)).toBe('1小时前');
      expect(formatRelativeTime(FIXED_NOW - 3 * 60 * 60 * 1000)).toBe('3小时前');
      expect(formatRelativeTime(FIXED_NOW - 23 * 60 * 60 * 1000)).toBe('23小时前');
    });

    it('天级别', () => {
      expect(formatRelativeTime(FIXED_NOW - 24 * 60 * 60 * 1000)).toBe('1天前');
      expect(formatRelativeTime(FIXED_NOW - 7 * 24 * 60 * 60 * 1000)).toBe('7天前');
    });

    it('接受字符串日期', () => {
      // 1小时前 = FIXED_NOW - 3600000
      const oneHourAgo = new Date(FIXED_NOW - 3600000).toISOString();
      expect(formatRelativeTime(oneHourAgo)).toBe('1小时前');
    });

    it('接受 Date 对象', () => {
      const date = new Date(FIXED_NOW - 3600000);
      expect(formatRelativeTime(date)).toBe('1小时前');
    });

    it('接受数字时间戳', () => {
      expect(formatRelativeTime(FIXED_NOW - 120000)).toBe('2分钟前');
    });
  });

  describe('getInitials', () => {
    it('空值返回空字符串', () => {
      expect(getInitials(null)).toBe('');
      expect(getInitials(undefined)).toBe('');
      expect(getInitials('')).toBe('');
    });

    it('默认名称"小伙伴"返回空', () => {
      expect(getInitials('小伙伴')).toBe('');
    });

    it('英文名取首字母', () => {
      expect(getInitials('John Doe')).toBe('JD');
      expect(getInitials('Alice Bob')).toBe('AB');
    });

    it('中文名取前两个字符', () => {
      expect(getInitials('张三')).toBe('张三');
      expect(getInitials('李四五')).toBe('李四');
    });

    it('单字符名称', () => {
      expect(getInitials('A')).toBe('A');
      expect(getInitials('张')).toBe('张');
    });

    it('结果大写', () => {
      expect(getInitials('john doe')).toBe('JD');
      expect(getInitials('abc')).toBe('AB');
    });
  });
});
