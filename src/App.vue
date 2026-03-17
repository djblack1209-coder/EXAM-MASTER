<script>
import { useUserStore } from '@/stores';
import { applyTheme, getCurrentTheme, watchTheme } from '@/design/theme-engine.js';
// ✅ 检查点 5.1: 导入分析服务
import { analytics } from '@/utils/analytics/event-bus-analytics.js';
// ✅ 检查点 5.2: 导入增强错误处理器
import { globalErrorHandler } from '@/utils/error/global-error-handler.js';
import { logger } from '@/utils/logger.js';

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
      uni
        .setNavigationBarColor({
          frontColor: isDark ? '#ffffff' : '#000000',
          backgroundColor: isDark ? '#0b0b0f' : '#b8eb89',
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

        uni.showToast({
          title: '登录已过期，请重新登录',
          icon: 'none',
          duration: 2000
        });

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
/* 全局按钮动画反馈样式 (P010) */
@use './styles/button-animations.scss';
/* 深色模式变量 mixin（单一来源，消除3x重复） */
@use './styles/_dark-mode-vars.scss' as *;

/* ============================================
   EXAM-MASTER 全局配色系统 v3.1
   深色模式变量已提取到 _dark-mode-vars.scss
   ============================================ */

/* ============================================
   核心颜色变量定义 (从 index.vue 提取)
   ============================================ */

/* 浅色模式（默认） - 绿色 + 白色 */
:root,
page {
  /* ====== 核心变量 (严格来自 index.vue) ====== */
  --background: #b8eb89; /* 页面背景：Wise风清新绿 */
  --foreground: #10281a; /* 主文字：深绿黑 */
  --card: #eaf9d5; /* 卡片背景：浅绿层 */
  --card-foreground: #10281a; /* 卡片文字：深绿黑 */
  --primary: #0f5f34; /* 品牌主色：深绿 */
  --primary-foreground: #ffffff; /* 品牌主色文字：白色 */
  --muted: #d0ecad; /* 弱化背景：浅绿 */
  --muted-foreground: #35533f; /* 弱化文字 */
  --border: #98cd6f; /* 边框：青草绿 */
  --brand: #0f5f34; /* 品牌色：深绿 */
  --brand-glow: rgba(15, 95, 52, 0.28); /* 品牌光晕 */
  --glass-bg: rgba(247, 255, 239, 0.66); /* 毛玻璃背景 */
  --glass-border: rgba(255, 255, 255, 0.72); /* 毛玻璃边框 */

  /* ====== 语义化别名（方便使用） ====== */
  --bg-page: var(--background);
  --bg-card: var(--card);
  --bg-secondary: #d4f2b4;
  --bg-glass: var(--glass-bg);
  --text-main: var(--foreground);
  --text-primary: var(--foreground);
  --text-sub: var(--muted-foreground);
  --text-secondary: var(--muted-foreground);
  --border-color: var(--border);
  --primary-light: rgba(15, 95, 52, 0.16);
  --success-light: rgba(16, 185, 129, 0.2);
  --warning-light: rgba(245, 158, 11, 0.2);
  --gradient-primary: linear-gradient(135deg, #1a8048 0%, #0f5f34 100%);
  --page-gradient-top: #d5f8b2;
  --page-gradient-mid: #b8eb89;
  --page-gradient-bottom: #caf2a4;

  /* ====== 扩展功能色 ====== */
  --success: #10b981;
  --warning: #f59e0b;
  --danger: #ef4444;
  --info: #3b82f6;

  /* ====== 兼容变量桥接（解决旧页面/组件变量不一致） ====== */
  --brand-color: #0f5f34;
  --brand-hover: #157141;
  --brand-active: #0d522e;
  --color-primary: var(--brand-color);
  --color-primary-dark: #0b4827;
  --text-tertiary: #8e98a8;
  --text-inverse: #ffffff;
  --text-primary-foreground: var(--primary-foreground);
  --theme-primary: var(--brand-color);
  --theme-text: var(--text-main);
  --theme-text-secondary: var(--text-sub);
  --theme-border: var(--border-color);
  --theme-card-bg: var(--bg-card);
  --theme-bg-secondary: var(--bg-secondary);
  --theme-bg-elevated: #ffffff;
  --theme-primary-light: rgba(15, 95, 52, 0.16);
  --danger-red: var(--danger);
  --success-green: var(--success);
  --info-blue: var(--info);
  --danger-light: rgba(239, 68, 68, 0.1);
  --overlay: rgba(15, 23, 42, 0.36);
  --mask-dark: rgba(15, 23, 42, 0.56);
  --bg-overlay: rgba(15, 23, 42, 0.36);
  --bg-card-alpha: rgba(247, 255, 239, 0.78);
  --shadow-success: 0 10rpx 30rpx rgba(15, 95, 52, 0.22);
  --shadow-danger: 0 10rpx 30rpx rgba(239, 68, 68, 0.18);
  --bg-body: var(--bg-page);
  --card-bg: var(--bg-card);
  --bg-tertiary: #bddd95;
  --accent-warm: #f59e0b;
  --accent-cool: #34d399;
  --accent-energy: #22c55e;
  --skeleton-bg: rgba(220, 220, 228, 0.72);
  --skeleton-line: rgba(236, 236, 242, 0.9);
  --skeleton-highlight: rgba(255, 255, 255, 0.98);
  --brand-tint: rgba(15, 95, 52, 0.14);
  --brand-tint-strong: rgba(15, 95, 52, 0.26);
  --brand-tint-subtle: rgba(15, 95, 52, 0.08);
  --shadow-brand-sm: 0 8rpx 18rpx rgba(15, 95, 52, 0.22);
  --shadow-brand: 0 12rpx 28rpx rgba(15, 95, 52, 0.3);
  --shadow-brand-strong: 0 16rpx 34rpx rgba(15, 95, 52, 0.36);
  --cta-primary-bg: rgba(255, 255, 255, 0.96);
  --cta-primary-text: #10281a;
  --cta-primary-border: rgba(16, 40, 26, 0.08);
  --cta-primary-shadow: 0 12rpx 28rpx rgba(16, 40, 26, 0.16);
  --apple-glass-nav-bg: rgba(250, 255, 246, 0.74);
  --apple-glass-card-bg: rgba(255, 255, 255, 0.68);
  --apple-glass-pill-bg: rgba(255, 255, 255, 0.82);
  --apple-group-bg: rgba(247, 255, 239, 0.82);
  --apple-glass-border-strong: rgba(255, 255, 255, 0.78);
  --apple-specular-line: rgba(255, 255, 255, 0.68);
  --apple-specular-soft: rgba(255, 255, 255, 0.24);
  --apple-divider: rgba(16, 40, 26, 0.08);
  --apple-shadow-floating: 0 18rpx 42rpx rgba(16, 40, 26, 0.18);
  --apple-shadow-surface: 0 12rpx 32rpx rgba(16, 40, 26, 0.12);
  --apple-shadow-card: 0 8rpx 24rpx rgba(16, 40, 26, 0.1);
  --apple-chromatic-blue: rgba(0, 180, 255, 0.05);
  --apple-chromatic-pink: rgba(255, 100, 200, 0.04);
  --apple-chromatic-green: rgba(100, 255, 180, 0.035);

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

  /* 阴影系统 */
  --shadow-sm: 0 1px 3px rgba(17, 17, 26, 0.04);
  --shadow-md: 0 4px 14px rgba(17, 17, 26, 0.07);
  --shadow-lg: 0 10px 24px rgba(17, 17, 26, 0.12);
  --shadow-xl: 0 18px 38px rgba(17, 17, 26, 0.16);
}

/* 深色模式 - 黑色 + 蓝色（系统偏好） */
@media (prefers-color-scheme: dark) {
  :root,
  page {
    @include dark-mode-vars;
  }
}

/* 手动深色模式类（支持用户切换） */
.dark,
.dark-mode {
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

/* 卡片组件 */
.card {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: var(--spacing-md);
  color: var(--text-main);
  box-shadow: var(--shadow-md);
  transition: all var(--transition-normal) var(--ease-default);
}

/* 毛玻璃卡片 */
.glass-card {
  background: var(--glass-bg);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  padding: var(--spacing-md);
  color: var(--text-main);
  transition: all var(--transition-normal) var(--ease-default);
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
    0 8rpx 20rpx rgba(16, 40, 26, 0.08);
}

.apple-cta {
  min-height: 88rpx;
  border-radius: 999rpx;
  background: var(--cta-primary-bg);
  color: var(--cta-primary-text);
  border: 1px solid var(--cta-primary-border);
  box-shadow: var(--cta-primary-shadow);
}

/* 按钮基础样式 */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-sm) var(--spacing-md);
  border-radius: var(--radius-sm);
  font-weight: var(--font-weight-medium);
  font-size: 14px;
  transition: all var(--transition-fast) var(--ease-default);
  cursor: pointer;
}

.btn:active {
  transform: scale(0.98);
}

/* 主色按钮 */
.btn-primary {
  background: var(--primary);
  color: var(--primary-foreground);
  border: none;
}

/* 次要按钮 */
.btn-secondary {
  background: var(--bg-card);
  color: var(--text-main);
  border: 1px solid var(--border-color);
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
  transition: all 0.15s ease-out;
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
</style>
