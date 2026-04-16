/**
 * 双模设计令牌引擎 (Wise-Light / Bitget-Dark) - v0 Enhanced
 * 同步时间: 2026-04-04
 * 架构: Level 9 GEMINI-ARCHITECT + v0 Design System
 * 版本: v4.0.0 (Wise-Light / Bitget-Dark 双模，与 App.vue + _dark-mode-vars.scss 严格对齐)
 */

import { logger } from '@/utils/logger.js';
export const tokens = {
  // Wise-Light 模式 - 灰蓝底 + 白色卡片 + 柔和蓝强调 (对齐 App.vue :root)
  light: {
    // 核心色系 (严格对齐 App.vue v4.0)
    '--background': '#f5f7fa',
    '--foreground': '#1a1d1f',
    '--card': '#ffffff',
    '--card-foreground': '#1a1d1f',
    '--primary': '#4a90e2',
    '--primary-foreground': '#ffffff',
    '--muted': '#e8eef4',
    '--muted-foreground': '#6b7280',
    '--border': '#e2e8f0',

    // 背景色系
    '--bg-body': '#f5f7fa',
    '--bg-page': '#f5f7fa',
    '--bg-card': '#ffffff',
    '--bg-secondary': '#e8eef4',
    '--bg-hover': '#e8eef4',
    '--bg-active': '#dde3ea',

    // 文字色系
    '--text-primary': '#1a1d1f',
    '--text-secondary': '#6b7280',
    '--text-sub': '#6b7280',
    '--text-tertiary': '#9ca3af',
    '--text-disabled': '#d1d5db',

    // 品牌色
    '--brand-color': '#4a90e2',
    '--brand-hover': '#5a9fe8',
    '--brand-active': '#3a7bd5',
    '--gradient-primary': 'linear-gradient(135deg, #5a9fe8 0%, #4a90e2 50%, #3a7bd5 100%)',
    '--brand-tint': 'rgba(74, 144, 226, 0.08)',
    '--brand-tint-strong': 'rgba(74, 144, 226, 0.16)',
    '--cta-primary-bg': 'linear-gradient(135deg, #5a9fe8 0%, #4a90e2 50%, #3a7bd5 100%)',
    '--cta-primary-text': '#ffffff',
    '--cta-primary-border': 'transparent',
    '--cta-primary-shadow': '0 12px 28px rgba(74, 144, 226, 0.22)',
    '--apple-glass-nav-bg': 'rgba(245, 247, 250, 0.78)',
    '--apple-glass-card-bg': 'rgba(255, 255, 255, 0.72)',
    '--apple-glass-pill-bg': 'rgba(255, 255, 255, 0.86)',
    '--apple-group-bg': 'rgba(255, 255, 255, 0.78)',
    '--apple-glass-border-strong': 'rgba(226, 232, 240, 0.82)',
    '--apple-specular-line': 'rgba(255, 255, 255, 0.72)',
    '--apple-specular-soft': 'rgba(255, 255, 255, 0.28)',
    '--apple-divider': 'rgba(0, 0, 0, 0.06)',
    '--apple-shadow-floating': '0 18px 42px rgba(0, 0, 0, 0.08)',
    '--apple-shadow-surface': '0 12px 32px rgba(0, 0, 0, 0.06)',
    '--apple-shadow-card': '0 8px 24px rgba(0, 0, 0, 0.05)',

    // 图标高亮阴影 (Splash Logo / 功能入口图标)
    '--icon-highlight': '0 4px 20px rgba(0, 0, 0, 0.06), 0 0 0 0.5px rgba(0, 0, 0, 0.04)',
    '--apple-chromatic-blue': 'rgba(74, 144, 226, 0.04)',
    '--apple-chromatic-pink': 'rgba(255, 45, 85, 0.03)',
    '--apple-chromatic-green': 'rgba(52, 211, 153, 0.03)',

    // 功能色
    '--action-green': '#34d399',
    '--action-blue': '#4a90e2',
    '--danger': '#ef4444',
    '--warning': '#f59e0b',
    '--success': '#34d399',
    '--info': '#4a90e2',

    // 点缀色系统
    '--accent-warm': '#f59e0b',
    '--accent-cool': '#5ac8fa',
    '--accent-energy': '#4a90e2',

    // 边框色 (v0 Compatible)
    '--border-light': '#e8eef4',
    '--border-medium': '#e2e8f0',
    '--border-dark': '#cbd5e1',

    // v0 特有变量
    '--glass-bg': 'rgba(255, 255, 255, 0.72)',
    '--glass-border': 'rgba(255, 255, 255, 0.82)',
    '--brand-glow': 'rgba(74, 144, 226, 0.18)',
    '--bg-card-alpha': 'rgba(255, 255, 255, 0.88)',
    '--page-gradient-top': '#f5f7fa',
    '--page-gradient-mid': '#eef2f7',
    '--page-gradient-bottom': '#e8edf3',
    '--card-shadow': '0 1px 3px rgba(0,0,0,0.04)',
    '--card-shadow-hover': '0 4px 14px rgba(0,0,0,0.06)',

    // 圆角系统
    '--radius-xs': '4px',
    '--radius-sm': '8px',
    '--radius-md': '16px',
    '--radius-lg': '24px',
    '--radius-xl': '32px',
    '--radius-2xl': '32px',
    '--radius-full': '9999px',

    // 间距系统
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

    // 阴影系统（中性色调，对齐 App.vue）
    '--shadow-1': '0 1px 3px rgba(0,0,0,0.04)',
    '--shadow-2': '0 4px 14px rgba(0,0,0,0.06)',
    '--shadow-3': '0 10px 24px rgba(0,0,0,0.1)',

    // 光晕阴影系统
    '--shadow-glow-brand': '0 4px 14px rgba(74,144,226,0.2)',
    '--shadow-glow-brand-strong': '0 4px 14px rgba(74,144,226,0.28), 0 0 20px rgba(74,144,226,0.12)',
    '--shadow-glow-warm': '0 4px 12px rgba(245,158,11,0.3)',
    '--shadow-glow-cool': '0 4px 12px rgba(90,200,250,0.3)',
    '--shadow-glow-energy': '0 4px 12px rgba(74,144,226,0.3)',

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

  // Bitget-Dark 模式 - 赛博朋克深蓝黑 + 霓虹青强调 (对齐 _dark-mode-vars.scss)
  dark: {
    // 核心色系 (严格对齐 _dark-mode-vars.scss)
    '--background': '#1a1c23',
    '--foreground': '#ffffff',
    '--card': '#22252d',
    '--card-foreground': '#ffffff',
    '--primary': '#00e0ff',
    '--primary-foreground': '#1a1c23',
    '--muted': '#2a2d36',
    '--muted-foreground': '#9ca3af',
    '--border': '#3a3d47',

    // 背景色系
    '--bg-body': '#1a1c23',
    '--bg-page': '#1a1c23',
    '--bg-card': '#22252d',
    '--bg-secondary': '#22252d',
    '--bg-hover': 'rgba(255,255,255,0.06)',
    '--bg-active': 'rgba(255,255,255,0.09)',

    // 文字色系
    '--text-primary': '#ffffff',
    '--text-secondary': '#9ca3af',
    '--text-sub': '#9ca3af',
    '--text-tertiary': '#6b7280',
    '--text-disabled': '#4b5563',

    // 品牌色
    '--brand-color': '#00e0ff',
    '--brand-hover': '#33e8ff',
    '--brand-active': '#00b8d4',
    '--gradient-primary': 'linear-gradient(135deg, #00e0ff 0%, #9b51e0 100%)',
    '--brand-tint': 'rgba(0, 224, 255, 0.14)',
    '--brand-tint-strong': 'rgba(0, 224, 255, 0.26)',
    '--cta-primary-bg': 'linear-gradient(135deg, #00e0ff 0%, #9b51e0 100%)',
    '--cta-primary-text': '#1a1c23',
    '--cta-primary-border': 'transparent',
    '--cta-primary-shadow': '0 12px 30px rgba(0, 224, 255, 0.32)',
    '--apple-glass-nav-bg': 'rgba(26, 28, 35, 0.76)',
    '--apple-glass-card-bg': 'rgba(34, 37, 45, 0.72)',
    '--apple-glass-pill-bg': 'rgba(42, 45, 54, 0.84)',
    '--apple-group-bg': 'rgba(34, 37, 45, 0.82)',
    '--apple-glass-border-strong': 'rgba(0, 224, 255, 0.16)',
    '--apple-specular-line': 'rgba(0, 224, 255, 0.12)',
    '--apple-specular-soft': 'rgba(255, 255, 255, 0.06)',
    '--apple-divider': 'rgba(255, 255, 255, 0.08)',
    '--apple-shadow-floating': '0 22px 54px rgba(0, 0, 0, 0.46)',
    '--apple-shadow-surface': '0 16px 40px rgba(0, 0, 0, 0.34)',
    '--apple-shadow-card': '0 10px 28px rgba(0, 0, 0, 0.28)',

    // 图标高亮阴影 (Splash Logo / 功能入口图标，暗色模式用品牌色辉光)
    '--icon-highlight': '0 0 24px rgba(0, 224, 255, 0.12), 0 0 0 0.5px rgba(0, 224, 255, 0.18)',
    '--apple-chromatic-blue': 'rgba(0, 224, 255, 0.08)',
    '--apple-chromatic-pink': 'rgba(155, 81, 224, 0.06)',
    '--apple-chromatic-green': 'rgba(52, 211, 153, 0.04)',

    // 功能色
    '--action-green': '#34d399',
    '--action-blue': '#00e0ff',
    '--danger': '#f87171',
    '--warning': '#f59e0b',
    '--success': '#34d399',
    '--info': '#00e0ff',

    // 点缀色系统 (赛博朋克风格)
    '--accent-warm': '#f59e0b',
    '--accent-cool': '#00e0ff',
    '--accent-energy': '#00e0ff',

    // 边框色 (v0 Compatible)
    '--border-light': '#3a3d47',
    '--border-medium': 'rgba(255,255,255,0.12)',
    '--border-dark': 'rgba(255,255,255,0.16)',

    // v0 特有变量
    '--glass-bg': 'rgba(34, 37, 45, 0.74)',
    '--glass-border': 'rgba(0, 224, 255, 0.14)',
    '--brand-glow': 'rgba(0, 224, 255, 0.35)',
    '--bg-card-alpha': 'rgba(34, 37, 45, 0.84)',
    '--page-gradient-top': '#1a1c23',
    '--page-gradient-mid': '#1e2029',
    '--page-gradient-bottom': '#1a1c23',
    '--card-shadow': '0 2px 8px rgba(0, 0, 0, 0.3)',
    '--card-shadow-hover': '0 4px 16px rgba(0, 0, 0, 0.4)',

    // 圆角系统 (与light保持一致)
    '--radius-xs': '4px',
    '--radius-sm': '8px',
    '--radius-md': '16px',
    '--radius-lg': '24px',
    '--radius-xl': '32px',
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

    // 字重系统 (深色模式字重更重以补偿对比度)
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

    // 阴影系统 (深色模式用更深沉的阴影)
    '--shadow-1': '0 1px 2px rgba(0,0,0,0.24)',
    '--shadow-2': '0 4px 12px rgba(0,0,0,0.32)',
    '--shadow-3': '0 10px 26px rgba(0,0,0,0.42)',

    // 光晕阴影系统 (霓虹风格光晕)
    '--shadow-glow-brand': '0 4px 20px rgba(0,224,255,0.3), 0 0 40px rgba(0,224,255,0.15)',
    '--shadow-glow-brand-strong': '0 4px 20px rgba(0,224,255,0.45), 0 0 40px rgba(0,224,255,0.2)',
    '--shadow-glow-warm': '0 0 20px rgba(245,158,11,0.4), 0 0 40px rgba(245,158,11,0.2)',
    '--shadow-glow-cool': '0 0 20px rgba(0,224,255,0.4), 0 0 40px rgba(0,224,255,0.2)',
    '--shadow-glow-energy': '0 0 20px rgba(155,81,224,0.4), 0 0 40px rgba(155,81,224,0.2)',

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
  background: linear-gradient(135deg, #22252d 0%, #1a1c23 100%);
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
  // App 端 service 层没有 document，需要安全检查
  if (typeof document === 'undefined' || !document.documentElement) {
    logger.log('[theme-engine] 非 DOM 环境，跳过主题应用:', theme);
    return;
  }
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
  // 优先读取用户手动设置的主题，其次跟随系统
  try {
    const saved = uni.getStorageSync('theme_mode');
    if (saved === 'dark' || saved === 'light') return saved;
    const appBaseInfo = uni.getAppBaseInfo();
    return appBaseInfo.theme === 'dark' ? 'dark' : 'light';
  } catch (e) {
    logger.warn('[theme-engine] 获取主题失败:', e);
    return 'light';
  }
  // #endif

  // #ifndef MP-WEIXIN
  // App/H5: 优先使用 uni.getStorageSync（比 localStorage 更可靠）
  try {
    const savedTheme = uni.getStorageSync('theme_mode');
    if (savedTheme) return savedTheme;
  } catch (_e) {
    logger.warn('[theme-engine] 读取已保存主题失败');
  }

  return 'light';
  // #endif
}

/**
 * 监听系统主题变化
 * @param {(theme: string) => void} callback
 * @returns {void}
 */
export function watchTheme(callback) {
  if (typeof callback !== 'function') return;

  if (typeof uni !== 'undefined' && typeof uni.onThemeChange === 'function') {
    uni.onThemeChange((result) => {
      callback(result?.theme === 'dark' ? 'dark' : 'light');
    });
  }
}

// toggleTheme 已移除 — 主题写入统一由 useThemeStore.setDarkMode() 负责
// theme-engine 仅保留纯渲染函数 applyTheme 和只读查询 getCurrentTheme / watchTheme

export default {
  tokens,
  v0Animations,
  applyTheme,
  getCurrentTheme,
  watchTheme
};
