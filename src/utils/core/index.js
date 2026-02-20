/**
 * 工具函数集合
 */

/**
 * 防抖函数
 * @param {Function} fn - 需要防抖的函数
 * @param {Number} delay - 延迟时间（毫秒）
 */
import storageService from '@/services/storageService.js';
import { logger } from '../logger.js';
export const debounce = (fn, delay = 300) => {
  let timer = null;
  return function (...args) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      fn.apply(this, args);
    }, delay);
  };
};

/**
 * 节流函数
 * @param {Function} fn - 需要节流的函数
 * @param {Number} interval - 时间间隔（毫秒）
 */
export const throttle = (fn, interval = 300) => {
  let last = 0;
  return function (...args) {
    const now = Date.now();
    if (now - last >= interval) {
      last = now;
      fn.apply(this, args);
    }
  };
};

/**
 * 格式化日期
 * @param {Date|String|Number} date - 日期
 * @param {String} format - 格式（默认：YYYY-MM-DD HH:mm:ss）
 */
export const formatDate = (date, format = 'YYYY-MM-DD HH:mm:ss') => {
  if (!date) return '';

  const d = new Date(date);
  if (isNaN(d.getTime())) return '';

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hour = String(d.getHours()).padStart(2, '0');
  const minute = String(d.getMinutes()).padStart(2, '0');
  const second = String(d.getSeconds()).padStart(2, '0');

  return format
    .replace('YYYY', year)
    .replace('MM', month)
    .replace('DD', day)
    .replace('HH', hour)
    .replace('mm', minute)
    .replace('ss', second);
};

/**
 * 格式化数字（千分位）
 * @param {Number} num - 数字
 */
export const formatNumber = (num) => {
  if (isNaN(num)) return '0';
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
};

/**
 * 深拷贝
 * @param {Any} obj - 需要拷贝的对象
 */
export const deepClone = (obj) => {
  if (obj === null || typeof obj !== 'object') return obj;

  if (obj instanceof Date) return new Date(obj);
  if (obj instanceof Array) return obj.map((item) => deepClone(item));

  const clonedObj = {};
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      clonedObj[key] = deepClone(obj[key]);
    }
  }

  return clonedObj;
};

/**
 * 获取随机字符串
 * @param {Number} length - 长度
 */
export const randomString = (length = 16) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

/**
 * 存储到本地
 * @param {String} key - 键名
 * @param {Any} value - 值
 */
export const setStorage = (key, value) => {
  try {
    storageService.save(key, value);
    return true;
  } catch (error) {
    logger.error('存储失败：', error);
    return false;
  }
};

/**
 * 从本地读取
 * @param {String} key - 键名
 */
export const getStorage = (key) => {
  try {
    return storageService.get(key);
  } catch (error) {
    logger.error('读取失败：', error);
    return null;
  }
};

/**
 * 从本地删除
 * @param {String} key - 键名
 */
export const removeStorage = (key) => {
  try {
    storageService.remove(key);
    return true;
  } catch (error) {
    logger.error('删除失败：', error);
    return false;
  }
};

export default {
  debounce,
  throttle,
  formatDate,
  formatNumber,
  deepClone,
  randomString,
  setStorage,
  getStorage,
  removeStorage
};
