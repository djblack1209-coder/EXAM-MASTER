/**
 * 设计系统变量和工具类
 * 为基础组件提供统一的设计规范
 *
 * @version 1.0.0
 * @description 统一的设计系统，包含颜色、间距、圆角、阴影等变量
 */

// ==================== 颜色系统 ====================

/**
 * 主色调
 */
export const colors = {
  // 主色
  primary: '#00a96d',
  primaryLight: '#00E5FF',
  primaryDark: '#008055',

  // 功能色
  success: '#22c55e',
  warning: '#f59e0b',
  error: '#ef4444',
  info: '#3b82f6',

  // 中性色 - 浅色模式
  light: {
    textPrimary: '#1a1a1a',
    textSecondary: '#64748b',
    textTertiary: '#94a3b8',
    textDisabled: '#cbd5e1',
    bgPrimary: '#ffffff',
    bgSecondary: '#f8fafc',
    bgTertiary: '#f1f5f9',
    border: 'rgba(0, 0, 0, 0.1)',
    borderLight: 'rgba(0, 0, 0, 0.05)'
  },

  // 中性色 - 深色模式
  dark: {
    textPrimary: '#ffffff',
    textSecondary: 'rgba(255, 255, 255, 0.7)',
    textTertiary: 'rgba(255, 255, 255, 0.5)',
    textDisabled: 'rgba(255, 255, 255, 0.3)',
    bgPrimary: '#121212',
    bgSecondary: '#1e1e1e',
    bgTertiary: '#2a2a2a',
    border: 'rgba(255, 255, 255, 0.1)',
    borderLight: 'rgba(255, 255, 255, 0.05)'
  }
};

// ==================== 间距系统 ====================

/**
 * 间距规范 (rpx)
 */
export const spacing = {
  xs: 8,
  sm: 16,
  md: 24,
  lg: 32,
  xl: 48,
  xxl: 64
};

// ==================== 圆角系统 ====================

/**
 * 圆角规范 (rpx)
 */
export const radius = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  full: 9999
};

// ==================== 字体系统 ====================

/**
 * 字体大小规范 (rpx)
 */
export const fontSize = {
  xs: 20,
  sm: 24,
  base: 28,
  md: 32,
  lg: 36,
  xl: 40,
  xxl: 48,
  xxxl: 64
};

/**
 * 字重规范
 */
export const fontWeight = {
  normal: 400,
  medium: 500,
  semibold: 600,
  bold: 700
};

/**
 * 行高规范
 */
export const lineHeight = {
  tight: 1.2,
  normal: 1.5,
  relaxed: 1.75,
  loose: 2
};

// ==================== 阴影系统 ====================

/**
 * 阴影规范
 */
export const shadows = {
  sm: '0 2rpx 8rpx rgba(0, 0, 0, 0.08)',
  md: '0 4rpx 16rpx rgba(0, 0, 0, 0.1)',
  lg: '0 8rpx 32rpx rgba(0, 0, 0, 0.12)',
  xl: '0 16rpx 48rpx rgba(0, 0, 0, 0.15)',

  // 深色模式阴影
  dark: {
    sm: '0 2rpx 8rpx rgba(0, 0, 0, 0.3)',
    md: '0 4rpx 16rpx rgba(0, 0, 0, 0.4)',
    lg: '0 8rpx 32rpx rgba(0, 0, 0, 0.5)',
    xl: '0 16rpx 48rpx rgba(0, 0, 0, 0.6)'
  },

  // 发光效果
  glow: {
    primary: '0 0 20rpx rgba(0, 169, 109, 0.4)',
    cyan: '0 0 20rpx rgba(0, 229, 255, 0.4)',
    error: '0 0 20rpx rgba(239, 68, 68, 0.4)'
  }
};

// ==================== 动画系统 ====================

/**
 * 动画时长规范 (ms)
 */
export const duration = {
  fast: 150,
  normal: 300,
  slow: 500
};

/**
 * 缓动函数规范
 */
export const easing = {
  linear: 'linear',
  ease: 'ease',
  easeIn: 'ease-in',
  easeOut: 'ease-out',
  easeInOut: 'ease-in-out',
  spring: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
  smooth: 'cubic-bezier(0.4, 0, 0.2, 1)'
};

// ==================== 断点系统 ====================

/**
 * 响应式断点 (px)
 */
export const breakpoints = {
  xs: 320,
  sm: 375,
  md: 414,
  lg: 768,
  xl: 1024
};

// ==================== Z-Index 系统 ====================

/**
 * 层级规范
 */
export const zIndex = {
  base: 0,
  dropdown: 100,
  sticky: 200,
  fixed: 300,
  modalBackdrop: 400,
  modal: 500,
  popover: 600,
  tooltip: 700,
  toast: 800,
  loading: 900,
  max: 9999
};

// ==================== 工具函数 ====================

/**
 * 获取主题色
 * @param {string} theme - 'light' | 'dark'
 * @returns {object} 主题颜色对象
 */
export function getThemeColors(theme = 'light') {
  return theme === 'dark' ? colors.dark : colors.light;
}

/**
 * 转换 rpx 到 px
 * @param {number} rpx - rpx 值
 * @param {number} screenWidth - 屏幕宽度，默认 375
 * @returns {number} px 值
 */
export function rpxToPx(rpx, screenWidth = 375) {
  return (rpx / 750) * screenWidth;
}

/**
 * 转换 px 到 rpx
 * @param {number} px - px 值
 * @param {number} screenWidth - 屏幕宽度，默认 375
 * @returns {number} rpx 值
 */
export function pxToRpx(px, screenWidth = 375) {
  return (px / screenWidth) * 750;
}

/**
 * 生成 CSS 变量字符串
 * @param {string} theme - 'light' | 'dark'
 * @returns {string} CSS 变量字符串
 */
export function generateCSSVariables(theme = 'light') {
  const themeColors = getThemeColors(theme);

  return `
    --ds-primary: ${colors.primary};
    --ds-primary-light: ${colors.primaryLight};
    --ds-primary-dark: ${colors.primaryDark};
    
    --ds-success: ${colors.success};
    --ds-warning: ${colors.warning};
    --ds-error: ${colors.error};
    --ds-info: ${colors.info};
    
    --ds-text-primary: ${themeColors.textPrimary};
    --ds-text-secondary: ${themeColors.textSecondary};
    --ds-text-tertiary: ${themeColors.textTertiary};
    --ds-text-disabled: ${themeColors.textDisabled};
    
    --ds-bg-primary: ${themeColors.bgPrimary};
    --ds-bg-secondary: ${themeColors.bgSecondary};
    --ds-bg-tertiary: ${themeColors.bgTertiary};
    
    --ds-border: ${themeColors.border};
    --ds-border-light: ${themeColors.borderLight};
    
    --ds-spacing-xs: ${spacing.xs}rpx;
    --ds-spacing-sm: ${spacing.sm}rpx;
    --ds-spacing-md: ${spacing.md}rpx;
    --ds-spacing-lg: ${spacing.lg}rpx;
    --ds-spacing-xl: ${spacing.xl}rpx;
    
    --ds-radius-sm: ${radius.sm}rpx;
    --ds-radius-md: ${radius.md}rpx;
    --ds-radius-lg: ${radius.lg}rpx;
    --ds-radius-xl: ${radius.xl}rpx;
    
    --ds-font-xs: ${fontSize.xs}rpx;
    --ds-font-sm: ${fontSize.sm}rpx;
    --ds-font-base: ${fontSize.base}rpx;
    --ds-font-md: ${fontSize.md}rpx;
    --ds-font-lg: ${fontSize.lg}rpx;
    --ds-font-xl: ${fontSize.xl}rpx;
    
    --ds-shadow-sm: ${theme === 'dark' ? shadows.dark.sm : shadows.sm};
    --ds-shadow-md: ${theme === 'dark' ? shadows.dark.md : shadows.md};
    --ds-shadow-lg: ${theme === 'dark' ? shadows.dark.lg : shadows.lg};
    
    --ds-duration-fast: ${duration.fast}ms;
    --ds-duration-normal: ${duration.normal}ms;
    --ds-duration-slow: ${duration.slow}ms;
    
    --ds-easing: ${easing.smooth};
  `.trim();
}

/**
 * 组件尺寸配置
 */
export const componentSizes = {
  button: {
    small: { height: 56, padding: 24, fontSize: 24 },
    medium: { height: 72, padding: 32, fontSize: 28 },
    large: { height: 88, padding: 40, fontSize: 32 }
  },
  input: {
    small: { height: 56, padding: 16, fontSize: 24 },
    medium: { height: 72, padding: 24, fontSize: 28 },
    large: { height: 88, padding: 32, fontSize: 32 }
  },
  card: {
    small: { padding: 16, radius: 12 },
    medium: { padding: 24, radius: 16 },
    large: { padding: 32, radius: 24 }
  }
};

/**
 * 获取组件尺寸配置
 * @param {string} component - 组件名称
 * @param {string} size - 尺寸
 * @returns {object} 尺寸配置
 */
export function getComponentSize(component, size = 'medium') {
  return componentSizes[component]?.[size] || componentSizes[component]?.medium;
}

// 默认导出
export default {
  colors,
  spacing,
  radius,
  fontSize,
  fontWeight,
  lineHeight,
  shadows,
  duration,
  easing,
  breakpoints,
  zIndex,
  getThemeColors,
  rpxToPx,
  pxToRpx,
  generateCSSVariables,
  componentSizes,
  getComponentSize
};
