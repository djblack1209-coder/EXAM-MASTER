/**
 * 双模设计令牌引擎 (Wise/Bitget)
 * 生成时间: 2026-01-24
 * 架构: Level 9 GEMINI-ARCHITECT
 */

export const tokens = {
    // Wise模式 - 白昼清爽风格
    light: {
        // 背景色系
        '--bg-body': '#F9FAFB',
        '--bg-card': '#FFFFFF',
        '--bg-hover': '#F3F4F6',
        '--bg-active': '#E5E7EB',

        // 文字色系
        '--text-primary': '#2F3542',
        '--text-secondary': '#747D8C',
        '--text-tertiary': '#A4B0BE',
        '--text-disabled': '#CED6E0',

        // 品牌色
        '--brand-color': '#9FE870',
        '--brand-hover': '#8DD65A',
        '--brand-active': '#7BC444',

        // 功能色
        '--action-green': '#00B894',
        '--action-blue': '#0984E3',
        '--danger': '#FF4757',
        '--warning': '#FFA502',
        '--success': '#26DE81',
        '--info': '#4B7BEC',

        // 点缀色系统 (Phase 3新增)
        '--accent-warm': '#FFB84D',      // 橙黄 - 学习进度、成就
        '--accent-cool': '#4ECDC4',      // 青色 - 统计数据、冷静提示
        '--accent-energy': '#FF6B6B',    // 珊瑚红 - 紧急提醒、倒计时

        // 边框色
        '--border-light': '#E1E8ED',
        '--border-medium': '#CED6E0',
        '--border-dark': '#A4B0BE',

        // 圆角系统 (8点网格)
        '--radius-xs': '4px',
        '--radius-sm': '8px',
        '--radius-md': '16px',
        '--radius-lg': '24px',
        '--radius-xl': '32px',
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

        // 阴影系统
        '--shadow-1': '0 2px 8px rgba(0,0,0,0.04)',
        '--shadow-2': '0 4px 16px rgba(0,0,0,0.08)',
        '--shadow-3': '0 8px 24px rgba(0,0,0,0.12)',

        // 光晕阴影系统 (Phase 3新增)
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

    // Bitget模式 - 黑夜赛博风格
    dark: {
        // 背景色系
        '--bg-body': '#0D1117',
        '--bg-card': 'rgba(255,255,255,0.03)',
        '--bg-card-glass': 'backdrop-filter: blur(10px)',
        '--bg-hover': 'rgba(255,255,255,0.06)',
        '--bg-active': 'rgba(255,255,255,0.09)',

        // 文字色系
        '--text-primary': '#FFFFFF',
        '--text-secondary': '#8B9BB4',
        '--text-tertiary': '#6B7A94',
        '--text-disabled': '#4B5A74',

        // 品牌色 (霓虹青色)
        '--brand-color': '#00F2FF',
        '--brand-hover': '#33F5FF',
        '--brand-active': '#00D9E6',
        '--brand-glow': '0 0 20px rgba(0,242,255,0.3)',

        // 功能色
        '--action-green': '#00F5A0',
        '--action-blue': '#4D9FFF',
        '--danger': '#FF2D75',
        '--warning': '#FFB800',
        '--success': '#00F5A0',
        '--info': '#4D9FFF',

        // 点缀色系统 (Phase 3新增 - 深色模式更鲜艳)
        '--accent-warm': '#FFD700',      // 金黄 - 学习进度、成就
        '--accent-cool': '#00F5FF',      // 霓虹青 - 统计数据、冷静提示
        '--accent-energy': '#FF3366',    // 霓虹粉 - 紧急提醒、倒计时

        // 边框色
        '--border-light': 'rgba(255,255,255,0.08)',
        '--border-medium': 'rgba(255,255,255,0.12)',
        '--border-dark': 'rgba(255,255,255,0.16)',

        // 圆角系统 (与light保持一致)
        '--radius-xs': '4px',
        '--radius-sm': '8px',
        '--radius-md': '16px',
        '--radius-lg': '24px',
        '--radius-xl': '32px',
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

        // 阴影系统 (深色模式无阴影，使用光晕)
        '--shadow-1': 'none',
        '--shadow-2': 'none',
        '--shadow-3': 'none',

        // 光晕阴影系统 (Phase 3新增 - 深色模式光晕更强)
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
}

/**
 * 应用主题到DOM
 * @param {string} theme - 'light' | 'dark'
 */
export function applyTheme(theme = 'light') {
    const root = document.documentElement
    const themeTokens = tokens[theme] || tokens.light

    Object.entries(themeTokens).forEach(([key, value]) => {
        root.style.setProperty(key, value)
    })
}

/**
 * 获取当前主题
 * @returns {string} 'light' | 'dark'
 */
export function getCurrentTheme() {
    // #ifdef MP-WEIXIN
    const systemInfo = uni.getSystemInfoSync()
    return systemInfo.theme === 'dark' ? 'dark' : 'light'
    // #endif
}

/**
 * 监听主题变化
 * @param {Function} callback - 主题变化回调
 */
export function watchTheme(callback) {
    // #ifdef MP-WEIXIN
    uni.onThemeChange((res) => {
        const theme = res.theme === 'dark' ? 'dark' : 'light'
        callback(theme)
    })
    // #endif

    // #ifndef MP-WEIXIN
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    mediaQuery.addEventListener('change', (e) => {
        callback(e.matches ? 'dark' : 'light')
    })
    // #endif
}

export default {
    tokens,
    applyTheme,
    getCurrentTheme,
    watchTheme
}
