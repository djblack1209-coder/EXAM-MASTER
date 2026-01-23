/**
 * 日期时间工具函数
 * 提供优化的时间显示和问候语功能
 */

/**
 * 获取带问候语的时间显示
 * @returns {Object} 包含时间显示和问候语的对象
 */
export const getGreetingTime = () => {
  const date = new Date();
  const hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, '0');
  
  // 获取中文星期
  const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  const weekDay = weekDays[date.getDay()];
  
  // 问候语逻辑
  let greeting = '';
  if (hours < 12) greeting = '早上好';
  else if (hours < 18) greeting = '下午好';
  else greeting = '晚上好';

  return {
    timeDisplay: `${hours}:${minutes} ${weekDay}`, // 14:30 周二
    greetingText: greeting
  };
};

/**
 * 格式化日期为指定格式
 * @param {Date} date 日期对象
 * @param {string} format 格式字符串，默认为 'YYYY-MM-DD HH:mm'
 * @returns {string} 格式化后的日期字符串
 */
export const formatDate = (date, format = 'YYYY-MM-DD HH:mm') => {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const seconds = date.getSeconds().toString().padStart(2, '0');
  
  return format
    .replace('YYYY', year)
    .replace('MM', month)
    .replace('DD', day)
    .replace('HH', hours)
    .replace('mm', minutes)
    .replace('ss', seconds);
};

/**
 * 获取距离指定日期的剩余时间
 * @param {Date|string} targetDate 目标日期
 * @returns {Object} 包含天、时、分、秒的对象
 */
export const getRemainingTime = (targetDate) => {
  const now = new Date();
  const target = new Date(targetDate);
  const diff = target - now;
  
  if (diff <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0 };
  }
  
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);
  
  return { days, hours, minutes, seconds };
};

/**
 * 获取当前月份的第一天和最后一天
 * @returns {Object} 包含第一天和最后一天的对象
 */
export const getMonthRange = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  
  return { firstDay, lastDay };
};

/**
 * 判断是否为今天
 * @param {Date|string} date 日期对象或日期字符串
 * @returns {boolean} 是否为今天
 */
export const isToday = (date) => {
  const now = new Date();
  const target = new Date(date);
  
  return now.toDateString() === target.toDateString();
};
