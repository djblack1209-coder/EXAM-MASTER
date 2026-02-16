/**
 * 双模设计令牌引擎 (Wise/Bitget) - v0 Enhanced
 * 生成时间: 2026-01-24
 * 架构: Level 9 GEMINI-ARCHITECT + v0 Design System
 * 版本: v2.0.0 (v0 Integration)
 */

import storageService from '@/services/storageService.js';
import { logger } from '@/utils/logger.js';
export const tokens = {
  // Wise模式 - 白昼清爽风格 (v0 Light Mode)
  light: {
    // 背景色系 (v0 Compatible)
    '--bg-body': '#F9FAFB',
    '--bg-card': '#FFFFFF',
    '--bg-hover': '#F3F4F6',
    '--bg-active': '#E5E7EB',

    // 文字色系 (v0 Compatible)
    '--text-primary': '#1A1D1F',
    '--text-secondary': '#6B7280',
    '--text-tertiary': '#9CA3AF',
    '--text-disabled': '#CED6E0',

    // 品牌色 (v0 Primary)
    '--brand-color': '#9FE870',
    '--brand-hover': '#8DD65A',
    '--brand-active': '#7BC444',

    // 功能色
    '--action-green': '#00B894',
    '--action-blue': '#0984E3',
    '--danger': '#EF4444',
    '--warning': '#FFA502',
    '--success': '#26DE81',
    '--info': '#4B7BEC',

    // 点缀色系统
    '--accent-warm': '#FFB84D',
    '--accent-cool': '#4ECDC4',
    '--accent-energy': '#FF6B6B',

    // 边框色 (v0 Compatible)
    '--border-light': '#E5E7EB',
    '--border-medium': '#CED6E0',
    '--border-dark': '#A4B0BE',

    // v0 特有变量 (NEW)
    '--glass-bg': 'rgba(255, 255, 255, 0.8)',
    '--glass-border': 'rgba(255, 255, 255, 0.5)',
    '--brand-glow': 'rgba(159, 232, 112, 0.3)',
    '--card-shadow': '0 2px 8px rgba(0, 0, 0, 0.08)',
    '--card-shadow-hover': '0 4px 16px rgba(0, 0, 0, 0.12)',

    // 圆角系统 (8点网格)
    '--radius-xs': '4px',
    '--radius-sm': '8px',
    '--radius-md': '12px',
    '--radius-lg': '16px',
    '--radius-xl': '24px',
    '--radius-2xl': '32px',
    '--radius-full': '9999px',

    // 间距系统 (8点网格)
    '--spacing-xs': '4px',
    '--spacing-sm': '8px',
    '--spacing-md': '16px',
    '--spacing-lg': '20px',
    '--spacing-xl': '24px',
    '--spacing-2xl': '32px',
    '--spacing-3xl': '40px',

    // 字重系统
    '--font-weight-regular': '400',
    '--font-weight-medium': '500',
    '--font-weight-semibold': '600',
    '--font-weight-bold': '700',
    '--font-weight-extrabold': '800',

    // 字体系统优化
    '--line-height-tight': '1.2',
    '--line-height-normal': '1.5',
    '--line-height-relaxed': '1.8',
    '--letter-spacing-tight': '-0.5px',
    '--letter-spacing-normal': '0.3px',
    '--letter-spacing-wide': '0.5px',

    // 阴影系统
    '--shadow-1': '0 2px 8px rgba(0,0,0,0.04)',
    '--shadow-2': '0 4px 16px rgba(0,0,0,0.08)',
    '--shadow-3': '0 8px 24px rgba(0,0,0,0.12)',

    // 光晕阴影系统
    '--shadow-glow-brand': '0 4px 12px rgba(159,232,112,0.3)',
    '--shadow-glow-brand-strong': '0 4px 12px rgba(159,232,112,0.4), 0 0 20px rgba(159,232,112,0.2)',
    '--shadow-glow-warm': '0 4px 12px rgba(255,184,77,0.3)',
    '--shadow-glow-cool': '0 4px 12px rgba(78,205,196,0.3)',
    '--shadow-glow-energy': '0 4px 12px rgba(255,107,107,0.3)',

    // 动画时长
    '--transition-fast': '0.15s',
    '--transition': '0.3s',
    '--transition-slow': '0.5s',

    // 缓动函数
    '--ease': 'cubic-bezier(0.4, 0, 0.2, 1)',
    '--ease-in': 'cubic-bezier(0.4, 0, 1, 1)',
    '--ease-out': 'cubic-bezier(0, 0, 0.2, 1)',
    '--ease-in-out': 'cubic-bezier(0.4, 0, 0.2, 1)'
  },

  // Bitget模式 - 黑夜赛博风格 (v0 Dark Mode)
  dark: {
    // 背景色系 (v0 Compatible)
    '--bg-body': '#080808',
    '--bg-card': '#0D1117',
    '--bg-hover': 'rgba(255,255,255,0.06)',
    '--bg-active': 'rgba(255,255,255,0.09)',

    // 文字色系 (v0 Compatible)
    '--text-primary': '#FFFFFF',
    '--text-secondary': '#9CA3AF',
    '--text-tertiary': '#6B7280',
    '--text-disabled': '#4B5A74',

    // 品牌色 (v0 Primary - Neon Cyan)
    '--brand-color': '#00F2FF',
    '--brand-hover': '#33F5FF',
    '--brand-active': '#00D9E6',

    // 功能色
    '--action-green': '#00F5A0',
    '--action-blue': '#4D9FFF',
    '--danger': '#FF2D75',
    '--warning': '#FFB800',
    '--success': '#00F5A0',
    '--info': '#4D9FFF',

    // 点缀色系统 (深色模式更鲜艳)
    '--accent-warm': '#FFD700',
    '--accent-cool': '#00F5FF',
    '--accent-energy': '#FF3366',

    // 边框色 (v0 Compatible)
    '--border-light': '#2D2D2D',
    '--border-medium': 'rgba(255,255,255,0.12)',
    '--border-dark': 'rgba(255,255,255,0.16)',

    // v0 特有变量 (NEW - Dark Mode)
    '--glass-bg': 'rgba(255, 255, 255, 0.05)',
    '--glass-border': 'rgba(255, 255, 255, 0.1)',
    '--brand-glow': 'rgba(0, 242, 255, 0.3)',
    '--card-shadow': '0 4px 16px rgba(0, 0, 0, 0.2)',
    '--card-shadow-hover': '0 8px 32px rgba(0, 0, 0, 0.3)',

    // 圆角系统 (与light保持一致)
    '--radius-xs': '4px',
    '--radius-sm': '8px',
    '--radius-md': '12px',
    '--radius-lg': '16px',
    '--radius-xl': '24px',
    '--radius-2xl': '32px',
    '--radius-full': '9999px',

    // 间距系统 (与light保持一致)
    '--spacing-xs': '4px',
    '--spacing-sm': '8px',
    '--spacing-md': '16px',
    '--spacing-lg': '20px',
    '--spacing-xl': '24px',
    '--spacing-2xl': '32px',
    '--spacing-3xl': '40px',

    // 字重系统 (深色模式字重更重)
    '--font-weight-regular': '400',
    '--font-weight-medium': '600',
    '--font-weight-semibold': '700',
    '--font-weight-bold': '800',
    '--font-weight-extrabold': '900',

    // 字体系统优化
    '--line-height-tight': '1.2',
    '--line-height-normal': '1.5',
    '--line-height-relaxed': '1.8',
    '--letter-spacing-tight': '-0.5px',
    '--letter-spacing-normal': '0.3px',
    '--letter-spacing-wide': '0.5px',

    // 阴影系统 (深色模式无阴影，使用光晕)
    '--shadow-1': 'none',
    '--shadow-2': 'none',
    '--shadow-3': 'none',

    // 光晕阴影系统 (深色模式光晕更强)
    '--shadow-glow-brand': '0 0 20px rgba(0,242,255,0.4), 0 0 40px rgba(0,242,255,0.2)',
    '--shadow-glow-brand-strong': '0 0 30px rgba(0,242,255,0.6), 0 0 60px rgba(0,242,255,0.3)',
    '--shadow-glow-warm': '0 0 20px rgba(255,215,0,0.4), 0 0 40px rgba(255,215,0,0.2)',
    '--shadow-glow-cool': '0 0 20px rgba(0,245,255,0.4), 0 0 40px rgba(0,245,255,0.2)',
    '--shadow-glow-energy': '0 0 20px rgba(255,51,102,0.4), 0 0 40px rgba(255,51,102,0.2)',

    // 动画时长 (深色模式稍慢)
    '--transition-fast': '0.2s',
    '--transition': '0.4s',
    '--transition-slow': '0.6s',

    // 缓动函数 (深色模式更平滑)
    '--ease': 'cubic-bezier(0.25, 0.8, 0.25, 1)',
    '--ease-in': 'cubic-bezier(0.4, 0, 1, 1)',
    '--ease-out': 'cubic-bezier(0, 0, 0.2, 1)',
    '--ease-in-out': 'cubic-bezier(0.65, 0, 0.35, 1)'
  }
};

/**
 * v0 动画关键帧 (NEW)
 * 这些动画将在全局样式中注入
 */
export const v0Animations = `
/* v0 Bubble floating animations */
@keyframes float {
  0%, 100% {
    transform: translateY(0px);
  }
  50% {
    transform: translateY(-8px);
  }
}

@keyframes float-delayed {
  0%, 100% {
    transform: translateY(0px);
  }
  50% {
    transform: translateY(-12px);
  }
}

@keyframes pulse-glow {
  0%, 100% {
    box-shadow: 0 0 20px var(--brand-glow), 0 0 40px var(--brand-glow);
  }
  50% {
    box-shadow: 0 0 30px var(--brand-glow), 0 0 60px var(--brand-glow);
  }
}

@keyframes breathe {
  0%, 100% {
    opacity: 0.6;
  }
  50% {
    opacity: 1;
  }
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes slideUp {
  from {
    transform: translateY(100%);
  }
  to {
    transform: translateY(0);
  }
}

/* Animation utility classes */
.animate-float {
  animation: float 4s ease-in-out infinite;
  will-change: transform;
}

.animate-float-delayed {
  animation: float-delayed 5s ease-in-out infinite;
  will-change: transform;
}

.animate-pulse-glow {
  animation: pulse-glow 3s ease-in-out infinite;
  will-change: box-shadow;
}

.animate-breathe {
  animation: breathe 2s ease-in-out infinite;
  will-change: opacity;
}

.animate-fade-in-up {
  animation: fadeInUp 0.5s ease-out forwards;
  will-change: transform, opacity;
}

/* Glassmorphism utility */
.glass {
  background: var(--glass-bg);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 0.5px solid var(--glass-border);
}

/* Gradient card for dark mode bubbles */
.bubble-gradient {
  background: linear-gradient(135deg, #1A1C1E 0%, #0D0E10 100%);
}

/* v0 Card hover effects */
.card-hover-effect {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.card-hover-effect:hover {
  transform: translateY(-2px);
  box-shadow: var(--card-shadow-hover);
}

/* v0 3D Card effect */
.card-3d {
  transform-style: preserve-3d;
  transition: transform 0.3s ease;
}

.card-3d:hover {
  transform: perspective(1000px) rotateX(2deg) rotateY(2deg);
}
`;

/**
 * 应用主题到DOM
 * @param {string} theme - 'light' | 'dark'
 */
export function applyTheme(theme = 'light') {
  // #ifndef MP-WEIXIN
  const root = document.documentElement;
  const themeTokens = tokens[theme] || tokens.light;

  Object.entries(themeTokens).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });

  // 注入 v0 动画样式
  let styleEl = document.getElementById('v0-animations');
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = 'v0-animations';
    document.head.appendChild(styleEl);
  }
  styleEl.textContent = v0Animations;
  // #endif

  // #ifdef MP-WEIXIN
  // 小程序环境下，主题通过 CSS 变量和类名控制，无需操作 DOM
  logger.log('[theme-engine] 小程序环境，主题:', theme);
  // #endif
}

/**
 * 获取当前主题
 * @returns {string} 'light' | 'dark'
 */
export function getCurrentTheme() {
  // #ifdef MP-WEIXIN
  // 使用新的 API 替代废弃的 getSystemInfoSync
  try {
    const appBaseInfo = uni.getAppBaseInfo();
    return appBaseInfo.theme === 'dark' ? 'dark' : 'light';
  } catch (e) {
    console.warn('[theme-engine] 获取主题失败:', e);
    return 'light';
  }
  // #endif

  // #ifndef MP-WEIXIN
  if (typeof window !== 'undefined') {
    const savedTheme = localStorage.getItem('theme_mode');
    if (savedTheme) return savedTheme;

    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    return prefersDark ? 'dark' : 'light';
  }
  return 'light';
  // #endif
}

/**
 * 监听主题变化
 * @param {Function} callback - 主题变化回调
 */
export function watchTheme(callback) {
  // #ifdef MP-WEIXIN
  uni.onThemeChange((res) => {
    const theme = res.theme === 'dark' ? 'dark' : 'light';
    callback(theme);
  });
  // #endif

  // #ifndef MP-WEIXIN
  if (typeof window !== 'undefined') {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e) => {
      callback(e.matches ? 'dark' : 'light');
    };
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }
  // #endif
}

/**
 * 切换主题
 * @param {string} theme - 'light' | 'dark'
 */
export function toggleTheme(theme) {
  applyTheme(theme);

  // #ifndef MP-WEIXIN
  if (typeof window !== 'undefined') {
    localStorage.setItem('theme_mode', theme);
  }
  // #endif

  // #ifdef MP-WEIXIN
  storageService.save('theme_mode', theme);
  // #endif
}

export default {
  tokens,
  v0Animations,
  applyTheme,
  getCurrentTheme,
  watchTheme,
  toggleTheme
};