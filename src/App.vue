<script>
import { toast } from '@/utils/toast.js';
import { useUserStore } from '@/stores';
import { applyTheme, getCurrentTheme, watchTheme } from '@/design/theme-engine.js';
// ✅ 检查点 5.1: 导入分析服务
import { analytics } from '@/utils/analytics/event-bus-analytics.js';
// ✅ 检查点 5.2: 导入增强错误处理器
import { globalErrorHandler } from '@/utils/error/global-error-handler.js';
import { logger } from '@/utils/logger.js';
import { isUserLoggedIn } from '@/utils/auth/loginGuard.js';
import { safeNavigateTo } from '@/utils/safe-navigate.js';
import { NAV_BAR_COLORS } from '@/composables/useTheme.js';

export default {
  onLaunch() {
    // 生产环境静默启动

    // ✅ 检查点 5.1: 初始化分析服务
    analytics.init({
      enableDebug: process.env.NODE_ENV !== 'production'
    });

    // ✅ 检查点 5.2: 全局错误处理已在 main.js 中通过 globalErrorHandler.init() 统一注册
    // 包括 uni.onError、uni.onUnhandledRejection、错误持久化、去重等

    // ✅ 2.4: 初始化全局 API 错误拦截（认证失败自动跳转登录）
    this.initApiErrorInterceptor();

    // ✅ R14: 全局路由守卫 — 拦截未登录用户访问需登录页面
    this.initRouteGuard();

    // 初始化双模主题系统
    this.initThemeSystem();

    // 执行静默登录
    this.performSilentLogin();
  },
  onError(error) {
    // 委托给统一错误处理器（避免重复注册 uni.onError）
    globalErrorHandler.report('Vue Error', error);
  },
  onUnhandledRejection(event) {
    // 委托给统一错误处理器
    globalErrorHandler.report('Unhandled Promise Rejection', event.reason);
  },
  onShow() {
    // 每次显示时同步主题
    const currentTheme = getCurrentTheme();
    this.globalData.currentTheme = currentTheme;
    applyTheme(currentTheme);
  },
  onHide() {
    // 应用进入后台
  },
  methods: {
    /**
     * ✅ R14: 全局路由守卫
     * 拦截 navigateTo / redirectTo，未登录用户无法进入需要登录的页面
     * 公开页面白名单之外的所有页面都需要登录
     */
    initRouteGuard() {
      // 公开页面白名单 — 不需要登录即可访问
      const PUBLIC_PAGES = [
        '/pages/splash/index',
        '/pages/index/index',
        '/pages/login/onboarding',
        '/pages/login/index',
        '/pages/login/wechat-callback',
        '/pages/login/qq-callback',
        '/pages/settings/privacy',
        '/pages/settings/terms',
        '/pages/settings/index',
        '/pages/school/index',
        '/pages/school-sub/detail',
        '/pages/practice/index',
        '/pages/profile/index'
      ];

      const checkAuth = (args) => {
        if (!args || !args.url) return;
        // 提取路径（去掉查询参数）
        const path = args.url.split('?')[0];
        // 公开页面放行
        if (PUBLIC_PAGES.some((p) => path.startsWith(p))) return;
        // 已登录放行
        if (isUserLoggedIn()) return;
        // 未登录：阻止跳转，弹窗引导登录
        logger.log(`[RouteGuard] 拦截未登录访问: ${path}`);
        toast.info('请先登录后使用此功能');
        setTimeout(() => {
          safeNavigateTo('/pages/login/index');
        }, 300);
        // 返回 false 阻止原始跳转
        return false;
      };

      // 拦截 navigateTo
      uni.addInterceptor('navigateTo', {
        invoke: checkAuth
      });
      // 拦截 redirectTo
      uni.addInterceptor('redirectTo', {
        invoke: checkAuth
      });
      // 拦截 reLaunch（防止通过 reLaunch 绕过登录）
      uni.addInterceptor('reLaunch', {
        invoke: checkAuth
      });
    },

    /**
     * 初始化双模主题系统
     */
    initThemeSystem() {
      // 读取保存的主题或使用系统主题
      const savedTheme = uni.getStorageSync('theme_mode');
      const currentTheme = savedTheme || getCurrentTheme();

      this.globalData.currentTheme = currentTheme;
      this.globalData.isDarkMode = currentTheme === 'dark';

      // 应用主题
      applyTheme(currentTheme);

      // 监听系统主题变化
      watchTheme((theme) => {
        // 如果用户没有手动设置主题，则跟随系统
        const userSetTheme = uni.getStorageSync('theme_mode');
        if (!userSetTheme) {
          this.switchTheme(theme);
        }
      });

      // 全局监听主题切换事件
      uni.$on('updateTheme', (mode) => {
        this.switchTheme(mode);
      });

      // 主题初始化完成
    },

    /**
     * 切换主题
     */
    switchTheme(theme) {
      this.globalData.currentTheme = theme;
      this.globalData.isDarkMode = theme === 'dark';

      // 应用设计令牌
      applyTheme(theme);

      // 保存用户选择
      uni.setStorageSync('theme_mode', theme);

      // 触发全局主题更新事件
      uni.$emit('themeUpdate', theme);

      // 更新状态栏颜色
      this.updateNavigationBarColor(theme);

      // 主题切换完成
    },

    /**
     * 更新导航栏颜色
     */
    updateNavigationBarColor(theme) {
      const isDark = theme === 'dark';
      const colors = isDark ? NAV_BAR_COLORS.dark : NAV_BAR_COLORS.light;
      uni
        .setNavigationBarColor({
          frontColor: colors.frontColor,
          backgroundColor: colors.backgroundColor,
          animation: {
            duration: 300,
            timingFunc: 'easeInOut'
          }
        })
        .catch(() => {
          // 设置导航栏颜色失败，静默处理
        });
    },

    /**
     * ✅ 2.4: 全局 API 错误拦截器
     * 监听 lafService 发出的 authFailure 事件，统一处理认证失败
     */
    initApiErrorInterceptor() {
      let isRedirecting = false;
      // [Phase5] 启动保护：前 3 秒内不触发 authFailure 导航，避免 webviewId 竞态
      const appReadyTime = Date.now() + 3000;

      uni.$on('authFailure', ({ statusCode, path }) => {
        logger.log(`[App] 认证失败拦截: statusCode=${statusCode}, path=${path}`);

        // 防止重复跳转
        if (isRedirecting) return;

        // 启动期静默忽略，页面 webview 尚未就绪
        if (Date.now() < appReadyTime) {
          logger.log('[App] 启动期忽略 authFailure，避免 routeDone 竞态');
          return;
        }

        isRedirecting = true;

        // 清除本地登录态
        try {
          const userStore = useUserStore();
          userStore.logout && userStore.logout();
        } catch (_e) {
          // 静默处理
        }

        toast.info('登录已过期，请重新登录');

        // 延迟跳转，让 toast 显示
        setTimeout(() => {
          const pages = getCurrentPages();
          const currentRoute = pages.length > 0 ? pages[pages.length - 1].route : '';
          // 避免在登录页重复跳转
          if (!currentRoute.includes('login')) {
            uni.navigateTo({
              url: '/pages/login/index',
              fail: () => {
                // [Phase5] 不再 switchTab 回当前页，避免 webview 混乱
                uni.reLaunch({ url: '/pages/login/index' });
              }
            });
          }
          isRedirecting = false;
        }, 1500);
      });
    },

    /**
     * 执行静默登录
     */
    async performSilentLogin() {
      try {
        const userStore = useUserStore();
        const result = await userStore.silentLogin();

        if (result.success) {
          // 缓存恢复成功，通知其他页面
          uni.$emit('loginStatusChanged', true);
          logger.log('[App] 缓存恢复登录成功');
        }
        // 无缓存是新用户的正常状态，不输出警告
      } catch (error) {
        logger.error('[App] 登录恢复异常:', error);
      }
    }
  },
  globalData: {
    currentTheme: 'light',
    isDarkMode: false
  }
};
</script>

<style lang="scss">
/* Wot Design Uni Theme Mapping */
@use './styles/_wot-theme.scss';
/* 全局按钮动画反馈样式 (P010) */
@use './styles/button-animations.scss';
/* 深色模式变量 mixin（单一来源，消除3x重复） */
@use './styles/_dark-mode-vars.scss' as *;
/* 3D 立体设计系统 — uiverse.io 风格原子组件 */
@use './styles/_em3d-design-system.scss';
/* wot-design-uni 基础变量 */
@import 'wot-design-uni/components/common/abstracts/variable.scss';

/* ============================================
   EXAM-MASTER 全局配色系统 v4.0
    亮色: Wise-Light (蓝色金融科技风格)
    暗色: Bitget-Dark (赛博朋克风格) → _dark-mode-vars.scss
    ============================================ */

/* ============================================
   核心颜色变量定义
   ============================================ */

/* 浅色模式（默认） - Wise-Light 金融科技风格：灰蓝底 + 柔和蓝强调 */
:root,
page {
  /* ====== 核心变量（灰蓝底 + 白色卡片 + 蓝色强调色） ====== */
  --background: #f5f7fa; /* 页面背景：淡灰蓝（Wise 金融风格） */
  --foreground: #1a1d1f; /* 主文字：近黑（高对比可读） */
  --card: #ffffff; /* 卡片背景：纯白（与灰蓝底拉开层次） */
  --card-foreground: #1a1d1f; /* 卡片文字 */
  --primary: #4a90e2; /* 品牌主色：柔和蓝（仅用于按钮/图标强调） */
  --primary-foreground: #ffffff; /* 品牌主色文字：白色 */
  --muted: #e8eef4; /* 弱化背景：浅灰蓝 */
  --muted-foreground: #6b7280; /* 弱化文字：中性灰 */
  --border: #e2e8f0; /* 边框：浅灰（实色，更清晰） */
  --brand: #4a90e2; /* 品牌色：柔和蓝 */
  --brand-glow: color-mix(in srgb, var(--primary) 18%, transparent); /* 品牌光晕 */
  --glass-bg: rgba(255, 255, 255, 0.72); /* 毛玻璃背景：白色透明 */
  --glass-border: rgba(255, 255, 255, 0.82); /* 毛玻璃边框 */

  /* ====== 语义化别名（方便使用） ====== */
  --bg-page: var(--background);
  --bg-card: var(--card);
  --bg-secondary: #e8eef4; /* 二级背景：浅灰蓝 */
  --bg-glass: var(--glass-bg);
  --text-main: var(--foreground);
  --text-primary: var(--foreground);
  --text-sub: var(--muted-foreground);
  --text-secondary: var(--muted-foreground);
  --border-color: var(--border);
  --primary-light: color-mix(in srgb, var(--primary) 8%, transparent);
  --success-light: color-mix(in srgb, var(--success) 12%, transparent);
  --warning-light: color-mix(in srgb, var(--warning) 12%, transparent);
  --gradient-primary: linear-gradient(135deg, #5a9fe8 0%, #4a90e2 50%, #3a7bd5 100%);
  --page-gradient-top: #f5f7fa;
  --page-gradient-mid: #eef2f7;
  --page-gradient-bottom: #e8edf3;

  /* ====== 扩展功能色 ====== */
  --success: #34d399; /* 翡翠绿 */
  --warning: #f59e0b; /* 琥珀橙 */
  --danger: #ef4444; /* 红色 */
  --info: #4a90e2; /* 主蓝（与品牌色统一） */
  --wise-blue: #4a90e2; /* Wise 蓝（替代原 wise-green） */
  --wise-blue-dark: #3a7bd5; /* Wise 蓝深色态 */
  --wise-green: #4a90e2; /* 兼容别名：映射到 wise-blue，旧组件不受影响 */
  --wise-green-dark: #3a7bd5; /* 兼容别名 */

  /* ====== 兼容变量桥接（解决旧页面/组件变量不一致） ====== */
  --brand-color: #4a90e2;
  --brand-hover: #5a9fe8;
  --brand-active: #3a7bd5;
  --color-primary: var(--brand-color);
  --color-primary-dark: #2e6bbf;
  --text-tertiary: #9ca3af; /* 三级灰 */
  --text-inverse: #ffffff;
  --text-primary-foreground: var(--primary-foreground);
  --theme-primary: var(--brand-color);
  --theme-text: var(--text-main);
  --theme-text-secondary: var(--text-sub);
  --theme-border: var(--border-color);
  --theme-card-bg: var(--bg-card);
  --theme-bg-secondary: var(--bg-secondary);
  --theme-bg-elevated: #ffffff;
  --theme-primary-light: color-mix(in srgb, var(--primary) 8%, transparent);
  --danger-red: var(--danger);
  --success-green: var(--success);
  --info-blue: var(--info);
  --danger-light: color-mix(in srgb, var(--danger) 10%, transparent);
  --overlay: rgba(0, 0, 0, 0.3);
  --mask-dark: rgba(0, 0, 0, 0.5);
  --bg-overlay: rgba(0, 0, 0, 0.3);
  --bg-card-alpha: rgba(255, 255, 255, 0.88);
  --shadow-success: 0 10rpx 30rpx rgba(52, 211, 153, 0.18);
  --shadow-danger: 0 10rpx 30rpx rgba(239, 68, 68, 0.16);
  --bg-body: var(--bg-page);
  --card-bg: var(--bg-card);
  --bg-tertiary: #dde3ea; /* 三级背景：冷灰蓝 */
  --accent-warm: #f59e0b;
  --accent-cool: #5ac8fa;
  --accent-energy: #4a90e2;
  --skeleton-bg: rgba(0, 0, 0, 0.04);
  --skeleton-line: rgba(0, 0, 0, 0.06);
  --skeleton-highlight: rgba(255, 255, 255, 0.96);
  --brand-tint: color-mix(in srgb, var(--primary) 8%, transparent);
  --brand-tint-strong: color-mix(in srgb, var(--primary) 16%, transparent);
  --brand-tint-subtle: color-mix(in srgb, var(--primary) 4%, transparent);
  --shadow-brand-sm: 0 8rpx 18rpx rgba(74, 144, 226, 0.12);
  --shadow-brand: 0 12rpx 28rpx rgba(74, 144, 226, 0.18);
  --shadow-brand-strong: 0 16rpx 34rpx rgba(74, 144, 226, 0.24);
  --cta-primary-bg: var(--gradient-primary);
  --cta-primary-text: #ffffff;
  --cta-primary-border: transparent;
  --cta-primary-shadow: 0 12rpx 28rpx rgba(74, 144, 226, 0.22);
  --apple-glass-nav-bg: rgba(245, 247, 250, 0.78);
  --apple-glass-card-bg: rgba(255, 255, 255, 0.72);
  --apple-glass-pill-bg: rgba(255, 255, 255, 0.86);
  --apple-group-bg: rgba(255, 255, 255, 0.78);
  --apple-glass-border-strong: rgba(226, 232, 240, 0.82);
  --apple-specular-line: rgba(255, 255, 255, 0.72);
  --apple-specular-soft: rgba(255, 255, 255, 0.28);
  --apple-divider: rgba(0, 0, 0, 0.06);
  --apple-shadow-floating: 0 18rpx 42rpx rgba(0, 0, 0, 0.08);
  --apple-shadow-surface: 0 12rpx 32rpx rgba(0, 0, 0, 0.06);
  --apple-shadow-card: 0 8rpx 24rpx rgba(0, 0, 0, 0.05);
  --icon-highlight: 0 4px 20px rgba(0, 0, 0, 0.06), 0 0 0 0.5px rgba(0, 0, 0, 0.04);
  --apple-chromatic-blue: color-mix(in srgb, var(--primary) 4%, transparent);
  --apple-chromatic-pink: rgba(255, 45, 85, 0.03);
  --apple-chromatic-green: color-mix(in srgb, var(--success) 3%, transparent);

  /* ====== 设计系统令牌 ====== */
  /* 圆角系统 */
  --radius-xs: 4px;
  --radius-sm: 8px;
  --radius-md: 16px;
  --radius-lg: 24px;
  --radius-xl: 32px;
  --radius-full: 9999px;

  /* 间距系统 */
  --spacing-xs: 4px;
  --spacing-sm: 8px;
  --spacing-md: 16px;
  --spacing-lg: 20px;
  --spacing-xl: 24px;
  --spacing-2xl: 32px;
  --spacing-3xl: 40px;

  /* 字重系统 */
  --font-weight-regular: 400;
  --font-weight-medium: 500;
  --font-weight-semibold: 600;
  --font-weight-bold: 700;
  --font-weight-extrabold: 800;

  /* 过渡系统 */
  --transition-fast: 0.15s;
  --transition-normal: 0.3s;
  --transition-slow: 0.5s;
  --ease-default: cubic-bezier(0.4, 0, 0.2, 1);
  --ease-bounce: cubic-bezier(0.68, -0.55, 0.265, 1.55);

  /* 阴影系统（中性色调） */
  --shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.04);
  --shadow-md: 0 4px 14px rgba(0, 0, 0, 0.06);
  --shadow-lg: 0 10px 24px rgba(0, 0, 0, 0.1);
  --shadow-xl: 0 18px 38px rgba(0, 0, 0, 0.14);

  /* 设计系统 ds-* 变量映射（供 base 组件使用） */
  --ds-spacing-xs: var(--spacing-xs);
  --ds-spacing-sm: var(--spacing-sm);
  --ds-spacing-md: var(--spacing-md);
  --ds-spacing-lg: var(--spacing-lg);
  --ds-spacing-xl: var(--spacing-xl);
  --ds-radius-sm: var(--radius-sm);
  --ds-radius-md: var(--radius-md);
  --ds-radius-lg: var(--radius-lg);
  --ds-radius-full: var(--radius-full);
  --ds-color-accent-green: var(--primary);
  --ds-color-accent-green-light: var(--primary-light);
  --ds-color-surface: var(--bg-card);
  --ds-color-surface-elevated: var(--bg-secondary);
  --ds-font-size-base: 28rpx;
  --ds-font-size-sm: 24rpx;
  --ds-font-size-lg: 32rpx;
  --ds-line-height-relaxed: 1.6;
  --ds-transition-base: 250ms ease-out;
}

/* 深色模式 - Bitget-Dark 赛博朋克风格（系统偏好） */
@media (prefers-color-scheme: dark) {
  :root,
  page {
    @include dark-mode-vars;
  }
}

/* 手动深色模式类（支持用户切换） */
.dark,
.dark-mode,
.page-dark {
  @include dark-mode-vars;
}

/* ============================================
   全局默认样式重置
   ============================================ */
page {
  height: 100%;
  background-color: var(--bg-page);
  color: var(--text-main);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 14px;
  line-height: 1.5;
  transition:
    background-color var(--transition-normal) var(--ease-default),
    color var(--transition-normal) var(--ease-default);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* 深色模式下图片亮度调整 */
@media (prefers-color-scheme: dark) {
  image {
    opacity: 0.9;
    filter: brightness(0.9);
  }
}

/* ============================================
   全局元素样式
   ============================================ */
view,
text,
image,
button,
input,
textarea,
scroll-view {
  box-sizing: border-box;
  font-family: inherit;
}

/* ============================================
   全局工具类 (使用语义化变量)
   ============================================ */

/* 卡片组件（Apple HIG 风格：大圆角 + 极细描边 + 弥散阴影） */
.card {
  background: var(--bg-card);
  border: 0.5px solid var(--border-color);
  border-radius: var(--radius-lg);
  padding: var(--spacing-md);
  color: var(--text-main);
  box-shadow: var(--shadow-md);
  transition:
    transform var(--transition-normal) var(--ease-default),
    box-shadow var(--transition-normal) var(--ease-default),
    opacity var(--transition-normal) var(--ease-default);
}

/* 毛玻璃卡片（Apple HIG 风格：大圆角 + 极细描边） */
.glass-card {
  background: var(--glass-bg);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border: 0.5px solid var(--glass-border);
  border-radius: var(--radius-lg);
  padding: var(--spacing-md);
  color: var(--text-main);
  transition:
    transform var(--transition-normal) var(--ease-default),
    box-shadow var(--transition-normal) var(--ease-default),
    opacity var(--transition-normal) var(--ease-default);
}

.apple-glass,
.apple-glass-card,
.apple-glass-pill,
.apple-group-card {
  position: relative;
  isolation: isolate;
  overflow: hidden;
}

.apple-glass {
  background:
    linear-gradient(180deg, var(--apple-specular-soft) 0%, transparent 42%),
    linear-gradient(90deg, transparent 10%, var(--apple-specular-line) 50%, transparent 90%),
    linear-gradient(160deg, var(--apple-glass-nav-bg) 0%, var(--apple-glass-card-bg) 100%);
  background-repeat: no-repeat;
  background-size:
    100% 100%,
    100% 1px,
    100% 100%;
  background-position:
    0 0,
    0 0,
    0 0;
  border: 1px solid var(--apple-glass-border-strong);
  backdrop-filter: blur(24px) saturate(165%) brightness(1.04);
  -webkit-backdrop-filter: blur(24px) saturate(165%) brightness(1.04);
  box-shadow:
    inset 1rpx 0 0 var(--apple-chromatic-blue),
    inset -1rpx 0 0 var(--apple-chromatic-pink),
    inset 0 1rpx 0 var(--apple-specular-soft),
    var(--apple-shadow-floating);
}

.apple-glass-card {
  background:
    linear-gradient(180deg, var(--apple-specular-soft) 0%, transparent 38%),
    linear-gradient(90deg, transparent 16%, var(--apple-specular-line) 50%, transparent 84%),
    linear-gradient(160deg, var(--apple-glass-card-bg) 0%, var(--apple-group-bg) 100%);
  background-repeat: no-repeat;
  background-size:
    100% 100%,
    100% 1px,
    100% 100%;
  background-position:
    0 0,
    0 0,
    0 0;
  border: 1px solid var(--glass-border);
  backdrop-filter: blur(22px) saturate(150%) brightness(1.03);
  -webkit-backdrop-filter: blur(22px) saturate(150%) brightness(1.03);
  box-shadow:
    inset 1rpx 0 0 rgba(255, 255, 255, 0.08),
    inset -1rpx 0 0 rgba(255, 255, 255, 0.04),
    inset 0 1rpx 0 var(--apple-specular-soft),
    var(--apple-shadow-card);
}

.apple-group-card {
  background:
    linear-gradient(180deg, var(--apple-specular-soft) 0%, transparent 34%),
    linear-gradient(180deg, var(--apple-group-bg) 0%, var(--apple-glass-card-bg) 100%);
  border: 1px solid var(--glass-border);
  backdrop-filter: blur(20px) saturate(145%);
  -webkit-backdrop-filter: blur(20px) saturate(145%);
  box-shadow:
    inset 0 1rpx 0 var(--apple-specular-soft),
    var(--apple-shadow-surface);
}

.apple-glass-pill {
  background:
    linear-gradient(180deg, var(--apple-specular-soft) 0%, transparent 50%),
    linear-gradient(160deg, var(--apple-glass-pill-bg) 0%, rgba(255, 255, 255, 0.58) 100%);
  border: 1px solid var(--apple-divider);
  backdrop-filter: blur(18px) saturate(145%) brightness(1.03);
  -webkit-backdrop-filter: blur(18px) saturate(145%) brightness(1.03);
  box-shadow:
    inset 0 1rpx 0 var(--apple-specular-soft),
    0 8rpx 20rpx rgba(0, 0, 0, 0.06);
}

.apple-cta {
  min-height: 88rpx;
  border-radius: 999rpx;
  background: var(--cta-primary-bg);
  color: var(--cta-primary-text);
  border: 1px solid var(--cta-primary-border);
  box-shadow: var(--cta-primary-shadow);
}

/* 按钮基础样式（Apple HIG 风格：胶囊圆角 + 中等字重） */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-sm) var(--spacing-xl);
  border-radius: var(--radius-full);
  font-weight: var(--font-weight-semibold);
  font-size: 14px;
  letter-spacing: -0.01em;
  transition:
    transform var(--transition-fast) var(--ease-default),
    box-shadow var(--transition-fast) var(--ease-default),
    filter var(--transition-fast) var(--ease-default),
    opacity var(--transition-fast) var(--ease-default);
  cursor: pointer;
}

.btn:active {
  transform: scale(0.97);
  opacity: 0.85;
}

/* 主色按钮（渐变背景 + 品牌阴影） */
.btn-primary {
  background: var(--gradient-primary);
  color: var(--primary-foreground);
  border: none;
  box-shadow: var(--shadow-brand-sm);
}

/* 次要按钮（白底 + 极细描边） */
.btn-secondary {
  background: var(--bg-card);
  color: var(--text-main);
  border: 0.5px solid var(--border-color);
  box-shadow: var(--shadow-sm);
}

/* 文字颜色工具类 */
.text-main {
  color: var(--text-main);
}
.text-sub {
  color: var(--text-sub);
}
.text-primary {
  color: var(--primary);
}
.text-success {
  color: var(--success);
}
.text-warning {
  color: var(--warning);
}
.text-danger {
  color: var(--danger);
}

/* 背景颜色工具类 */
.bg-page {
  background-color: var(--bg-page);
}
.bg-card {
  background-color: var(--bg-card);
}

/* 输入框通用样式（Apple HIG 风格：通透底色 + focus ring） */
/* 注意: 这里去掉了原生的 input, textarea 裸标签选择器，避免污染 wot-design-uni 内部的组件样式 */
.input,
.textarea {
  background: var(--muted);
  color: var(--text-main);
  border: 0.5px solid transparent;
  border-radius: var(--radius-md);
  padding: 24rpx 28rpx;
  font-size: 30rpx;
  line-height: 1.5;
  transition: all 0.2s ease-out;
  outline: none;
  -webkit-appearance: none;
}

.input:focus,
.textarea:focus {
  border-color: var(--primary);
  box-shadow: 0 0 0 3px var(--primary-light);
  background: var(--bg-card);
}

/* ============================================
   性能优化
   ============================================ */
.will-change-transform {
  will-change: transform;
}

.will-change-opacity {
  will-change: opacity;
}

.gpu-accelerated {
  transform: translateZ(0);
  backface-visibility: hidden;
  perspective: 1000px;
}

/* ============================================
   ✅ PM要求：全局点击态反馈
   消除"塑料感"，提升交互质感
   ============================================ */

/* 通用点击态 - 适用于所有可点击元素 */
.clickable,
.touchable,
[hover-class] {
  transition:
    transform 0.15s ease-out,
    box-shadow 0.15s ease-out,
    opacity 0.15s ease-out;
  -webkit-tap-highlight-color: transparent;
}

.clickable:active,
.touchable:active {
  transform: scale(0.96);
  opacity: 0.8;
}

/* 卡片点击态 - 带阴影收缩效果 */
.card-hover:active,
.glass-card:active,
.stat-card:active {
  transform: scale(0.98) translateY(2rpx);
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.15);
}

/* 按钮点击态 - 带亮度变化 */
.btn:active,
.action-btn:active,
button:active {
  transform: scale(0.95);
  filter: brightness(0.9);
}

/* 列表项点击态 - 背景高亮 */
.list-item:active,
.activity-item:active,
.option-item:active {
  background: rgba(0, 0, 0, 0.05);
}

/* 深色模式下的列表项点击态 */
.dark-mode .list-item:active,
.dark-mode .activity-item:active,
.dark-mode .option-item:active,
page[data-theme='dark'] .list-item:active,
page[data-theme='dark'] .activity-item:active,
page[data-theme='dark'] .option-item:active {
  background: rgba(255, 255, 255, 0.1);
}

/* 图标点击态 - 旋转缩放 */
.icon-btn:active,
.theme-toggle:active,
.nav-back:active,
.nav-add:active {
  transform: scale(0.85) rotate(-5deg);
  opacity: 0.7;
}

/* 气泡点击态 - 弹性效果 */
.bubble-card:active,
.knowledge-bubble:active {
  transform: scale(0.92);
  transition: transform 0.1s ease-out;
}

/* 头像点击态 */
.user-avatar:active,
.avatar-ring:active {
  transform: scale(0.9);
  box-shadow: 0 0 20rpx rgba(0, 229, 255, 0.5);
}

/* 禁用点击态的元素 */
.no-feedback:active,
[disabled]:active {
  transform: none !important;
  opacity: 1 !important;
  filter: none !important;
}

/* #ifdef H5 */
/* H5 环境：隐藏原生 tabBar，使用自定义胶囊 tabBar (custom-tabbar.vue) */
/* 原生 tabBar 和自定义 tabBar 同时显示会互相遮挡 */
uni-tabbar,
.uni-tabbar-bottom {
  display: none !important;
}
/* #endif */
</style>
