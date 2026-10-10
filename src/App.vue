<script>
import { toast } from '@/utils/toast.js';
import { useUserStore } from '@/stores';
import { applyTheme, getCurrentTheme, watchTheme } from '@/design/theme-runtime.js';
// ✅ 检查点 5.1: 导入分析服务
import { analytics } from '@/utils/analytics/event-bus-analytics.js';
// ✅ 检查点 5.2: 导入增强错误处理器
import { globalErrorHandler } from '@/utils/error/global-error-handler.js';
import { logger } from '@/utils/logger.js';
import { isUserLoggedIn } from '@/utils/auth/loginGuard.js';
import { safeNavigateTo } from '@/utils/safe-navigate.js';
import { NAV_BAR_COLORS } from '@/composables/useTheme.js';
import { useThemeStore } from '@/stores/modules/theme.js';
import { restoreUserParams as restoreFsrsParams } from '@/services/fsrs-service.js';
import { storageService } from '@/services/storageService.js';

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

    // 恢复 FSRS 间隔重复参数
    restoreFsrsParams();

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
    // 重开时同时恢复共享状态、页面颜色和原生导航栏。
    this.switchTheme(getCurrentTheme());
  },
  onHide() {
    // 应用进入后台 — uni-app 生命周期钩子
    // 当前无需额外操作：主题/用户状态已在各自 store 中实时持久化
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
        '/pages/learning/index',
        '/pages/mistake/index',
        '/pages/plan/index',
        '/pages/study-detail/index',
        '/pages/login/index',
        '/pages/login/onboarding',
        '/pages/login/wechat-callback',
        '/pages/settings/privacy',
        '/pages/settings/terms',
        '/pages/practice/index',
        '/pages/practice-sub/do-quiz',
        '/pages/practice-sub/question-bank',
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
      const currentTheme = getCurrentTheme();

      this.globalData.currentTheme = currentTheme;
      this.globalData.isDarkMode = currentTheme === 'dark';

      // 同步 store 状态（store 的 setDarkMode 会自动调用 applyTheme）
      try {
        const themeStore = useThemeStore(this.$pinia);
        themeStore.setDarkMode(currentTheme === 'dark');
      } catch (_e) {
        // store 未初始化时降级直接渲染
        applyTheme(currentTheme);
      }

      // 监听系统主题变化
      watchTheme((theme) => {
        // 如果用户没有手动设置主题，则跟随系统
        const userSetTheme = storageService.get('theme_mode', null);
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
     * 切换主题 — 委托给 useThemeStore 作为唯一写入源
     * App.vue 仅负责同步 globalData 和导航栏颜色
     */
    switchTheme(theme) {
      const isDark = theme === 'dark';

      // 委托 store 完成：持久化 + DOM 渲染 + 事件通知
      try {
        const themeStore = useThemeStore(this.$pinia);
        themeStore.setDarkMode(isDark);
      } catch (_e) {
        // store 未初始化时降级（仅在极早期启动阶段可能发生）
        applyTheme(theme);
        storageService.save('theme_mode', theme);
        uni.$emit('themeUpdate', theme);
      }

      // App.vue 独有职责：同步 globalData
      this.globalData.currentTheme = theme;
      this.globalData.isDarkMode = isDark;

      // App.vue 独有职责：更新导航栏颜色
      this.updateNavigationBarColor(theme);
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
@import './components/business/learning/learning-space.css';
/* wot-design-uni 基础变量 */
@import 'wot-design-uni/components/common/abstracts/variable.scss';
/* #ifdef H5 */
@font-face {
  font-family: 'DM Sans';
  src: url('/public/fonts/DMSans-Regular.woff2') format('woff2');
  font-weight: 400;
  font-display: swap;
}
@font-face {
  font-family: Epilogue;
  src: url('/public/fonts/Epilogue-Black.woff2') format('woff2');
  font-weight: 900;
  font-display: swap;
}
@font-face {
  font-family: 'DMS';
  font-style: normal;
  font-weight: 400;
  font-display: block;
  src: url(/public/fonts/FutureDMSans-400.woff2) format('woff2');
  unicode-range:
    U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC,
    U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}
@font-face {
  font-family: 'DMS';
  font-style: normal;
  font-weight: 500;
  font-display: block;
  src: url(/public/fonts/FutureDMSans-500.woff2) format('woff2');
  unicode-range:
    U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC,
    U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}
@font-face {
  font-family: 'Playfair Display';
  font-style: italic;
  font-weight: 400;
  font-display: block;
  src: url(/public/fonts/PlayfairDisplay-italic-400.woff2) format('woff2');
  unicode-range:
    U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC,
    U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}
@font-face {
  font-family: 'Playfair Display';
  font-style: normal;
  font-weight: 400;
  font-display: block;
  src: url(/public/fonts/PlayfairDisplay-normal-400.woff2) format('woff2');
  unicode-range:
    U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC,
    U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}
@font-face {
  font-family: 'Poppins';
  font-style: normal;
  font-weight: 400;
  font-display: block;
  src: url(/public/fonts/Poppins-normal-400.woff2) format('woff2');
  unicode-range:
    U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC,
    U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}
/* #endif */

/* ============================================
   EXAM-MASTER 全局配色系统 v4.0
    亮色: Playful Light (浅紫学习风格)
    暗色: Yozi AI Dark (紫色阅读风格) → _dark-mode-vars.scss
    ============================================ */

/* ============================================
   核心颜色变量定义
   ============================================ */

/* 浅色模式（默认） - Playful Light 浅紫学习风格 */
:root,
page {
  /* ====== 核心变量（浅紫底 + 白色卡片 + 蓝色强调色） ====== */
  --background: #eae8fc; /* 紫蓝材质底色 */
  --foreground: #080909; /* 主文字：近黑（高对比可读） */
  --card: var(--yozi-reading); /* 厚磨砂内容面 */
  --card-foreground: #080909; /* 卡片文字 */
  --primary: #785bbc; /* 品牌主色：紫色（仅用于按钮/图标强调） */
  --primary-foreground: #ffffff; /* 品牌主色文字：白色 */
  --muted: #eeeaf6; /* 弱化背景：浅紫灰 */
  --muted-foreground: #62576d; /* 紫色次要文字 */
  --border: #dbd5e6; /* 边框：浅灰（实色，更清晰） */
  --brand: #785bbc; /* 品牌色：紫色 */
  --brand-glow: color-mix(in srgb, var(--primary) 18%, transparent); /* 品牌光晕 */
  --glass-bg: rgba(255, 255, 255, 0.72); /* 毛玻璃背景：白色透明 */
  --glass-border: rgba(255, 255, 255, 0.82); /* 毛玻璃边框 */

  /* ====== 语义化别名（方便使用） ====== */
  --bg-page: var(--background);
  --bg-card: var(--card);
  --bg-secondary: #eeeaf6; /* 二级背景：浅紫灰 */
  --bg-glass: var(--glass-bg);
  --text-main: var(--foreground);
  --text-primary: var(--foreground);
  --text-sub: var(--muted-foreground);
  --text-secondary: var(--muted-foreground);
  --border-color: var(--border);
  --primary-light: color-mix(in srgb, var(--primary) 8%, transparent);
  --success-light: color-mix(in srgb, var(--success) 12%, transparent);
  --warning-light: color-mix(in srgb, var(--warning) 12%, transparent);
  --gradient-primary: linear-gradient(135deg, #9b7cc9 0%, #785bbc 50%, #65429e 100%);
  --page-gradient-top: #f0eefa;
  --page-gradient-mid: #f3effa;
  --page-gradient-bottom: #eee7f7;

  /* ====== 扩展功能色 ====== */
  --success: #34d399; /* 翡翠绿 */
  --warning: #f59e0b; /* 琥珀橙 */
  --danger: #ef4444; /* 红色 */
  --info: #785bbc; /* 主蓝（与品牌色统一） */
  --wise-blue: #785bbc; /* Wise 蓝（替代原 wise-green） */
  --wise-blue-dark: #65429e; /* Wise 蓝深色态 */
  --wise-green: #785bbc; /* 兼容别名：映射到 wise-blue，旧组件不受影响 */
  --wise-green-dark: #65429e; /* 兼容别名 */

  /* ====== 兼容变量桥接（解决旧页面/组件变量不一致） ====== */
  --brand-color: #785bbc;
  --brand-hover: #9b7cc9;
  --brand-active: #65429e;
  --color-primary: var(--brand-color);
  --color-primary-dark: #573686;
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
  --bg-tertiary: #e4ddef; /* 三级背景：冷紫灰 */
  --accent-warm: #f59e0b;
  --accent-cool: #5ac8fa;
  --accent-energy: #785bbc;
  --skeleton-bg: rgba(0, 0, 0, 0.04);
  --skeleton-line: rgba(0, 0, 0, 0.06);
  --skeleton-highlight: rgba(255, 255, 255, 0.96);
  --brand-tint: color-mix(in srgb, var(--primary) 8%, transparent);
  --brand-tint-strong: color-mix(in srgb, var(--primary) 16%, transparent);
  --brand-tint-subtle: color-mix(in srgb, var(--primary) 4%, transparent);
  --shadow-brand-sm: 0 8rpx 18rpx rgba(120, 91, 188, 0.12);
  --shadow-brand: 0 12rpx 28rpx rgba(120, 91, 188, 0.18);
  --shadow-brand-strong: 0 16rpx 34rpx rgba(120, 91, 188, 0.24);
  --cta-primary-bg: var(--gradient-primary);
  --cta-primary-text: #ffffff;
  --cta-primary-border: transparent;
  --cta-primary-shadow: 0 12rpx 28rpx rgba(120, 91, 188, 0.22);
  /* [已迁移] Apple Glass 变量已被 em3d 设计系统替代，保留 icon-highlight 供个别组件使用 */
  --icon-highlight: 0 4px 20px rgba(0, 0, 0, 0.06), 0 0 0 0.5px rgba(0, 0, 0, 0.04);

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

/* 深色模式 - Yozi AI Dark 紫色阅读风格（系统偏好） */
@media (prefers-color-scheme: dark) {
  /* #ifdef H5 */
  :root:not([data-theme]),
  :root:not([data-theme]) page
  /* #endif */
  /* #ifndef H5 */
  :root,
  page
  /* #endif */ {
    @include dark-mode-vars;
  }
}

/* 显式主题与学习空间共用深色材质。 */
:root[data-theme='dark'],
.space-dark,
.dark,
.dark-mode,
.page-dark {
  @include dark-mode-vars;
}

/* Resolve material fallbacks after every light/dark variant, including direct token users. */
@media (prefers-reduced-transparency: reduce), (prefers-contrast: more) {
  :root,
  page,
  :root:not([data-theme='light']),
  :root[data-theme='dark'],
  .space-dark,
  .dark,
  .dark-mode,
  .page-dark {
    --yozi-glass: var(--yozi-solid);
    --yozi-reading: var(--yozi-solid);
    --yozi-floating: var(--yozi-solid);
  }
}
@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  :root,
  page,
  :root:not([data-theme='light']),
  :root[data-theme='dark'],
  .space-dark,
  .dark,
  .dark-mode,
  .page-dark {
    --yozi-glass: var(--yozi-solid);
    --yozi-reading: var(--yozi-solid);
    --yozi-floating: var(--yozi-solid);
  }
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
  /* #ifdef H5 */
  :root:not([data-theme='light']) image
  /* #endif */
  /* #ifndef H5 */
  image
  /* #endif */ {
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

/* Existing card names share one frosted material. Nested groups do not add blur. */
.card,
.glass-card,
.apple-glass-card,
.apple-group-card {
  background: var(--yozi-reading);
  border: 0;
  border-radius: 24px;
  color: var(--text-main);
  box-shadow: var(--yozi-shadow);
}
.card,
.glass-card {
  padding: var(--spacing-md);
}
.apple-glass,
.apple-glass-pill {
  background: var(--yozi-glass);
  border: 0;
  box-shadow: var(--yozi-shadow);
  backdrop-filter: blur(24px) saturate(1.2);
  -webkit-backdrop-filter: blur(24px) saturate(1.2);
}
.apple-cta {
  min-height: 44px;
  border-radius: 12px;
  background: var(--yozi-button);
  color: var(--yozi-button-ink);
  border: 0;
  box-shadow: var(--yozi-button-shadow);
  transition:
    box-shadow 180ms ease,
    transform 180ms ease;
}
.apple-cta:active:not([disabled]) {
  transform: translateY(2px);
  box-shadow:
    inset 0 2px 4px rgba(30, 15, 65, 0.16),
    0 2px 0 var(--yozi-button-edge);
  transition-duration: 100ms;
}
@media (prefers-reduced-transparency: reduce), (prefers-contrast: more) {
  .card,
  .glass-card,
  .apple-glass,
  .apple-glass-card,
  .apple-glass-pill,
  .apple-group-card {
    background: var(--yozi-solid);
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
  }
}
@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .apple-glass,
  .apple-glass-pill {
    background: var(--yozi-solid);
  }
}
@media (prefers-reduced-motion: reduce) {
  .apple-cta {
    transition: none !important;
    transform: none !important;
  }
}

/* 按钮基础样式（新拟物化风格：胶囊圆角 + 双向阴影） */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-sm) var(--spacing-xl);
  border-radius: var(--em3d-radius-pill);
  font-weight: 700;
  font-size: 14px;
  letter-spacing: -0.01em;
  transition: var(--em3d-ease-press);
  cursor: pointer;
}

.btn:active {
  /* 新拟物化风格：不使用 translateY 位移 */
}

/* 主色按钮（新拟物化绿色凸起） */
.btn-primary {
  background-color: var(--em3d-primary);
  color: var(--em3d-text-inv);
  border: none;
  box-shadow:
    6rpx 6rpx 12rpx var(--em3d-primary-shadow),
    -3rpx -3rpx 8rpx rgba(255, 255, 255, 0.15);
}

.btn-primary:active {
  box-shadow:
    inset 4rpx 4rpx 8rpx var(--em3d-primary-shadow),
    inset -2rpx -2rpx 6rpx rgba(255, 255, 255, 0.1);
}

/* 次要按钮（新拟物化凸起） */
.btn-secondary {
  background-color: var(--em3d-card-bg);
  color: var(--em3d-text-1);
  border: none;
  box-shadow: var(--neu-shadow-md);
}

.btn-secondary:active {
  box-shadow: var(--neu-shadow-inset);
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

/* 输入框通用样式（新拟物化风格：凹陷内阴影 + 聚焦外发光） */
/* 注意: 这里去掉了原生的 input, textarea 裸标签选择器，避免污染 wot-design-uni 内部的组件样式 */
.input,
.textarea {
  background-color: var(--em3d-card-bg);
  color: var(--em3d-text-1);
  border: none;
  border-radius: var(--em3d-radius-md);
  padding: 24rpx 28rpx;
  font-size: 30rpx;
  line-height: 1.5;
  box-shadow: var(--neu-shadow-inset-sm);
  transition: var(--em3d-ease-smooth);
  outline: none;
  -webkit-appearance: none;
}

.input:focus,
.textarea:focus {
  border-color: var(--em3d-primary);
  box-shadow:
    var(--neu-shadow-inset-sm),
    0 0 0 6rpx var(--em3d-primary-light);
  background-color: var(--em3d-card-bg);
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

/* 卡片点击态 - 新拟物化凹陷效果 */
.card-hover:active,
.glass-card:active,
.stat-card:active {
  transform: scale(0.98);
  box-shadow: var(--neu-shadow-inset);
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
