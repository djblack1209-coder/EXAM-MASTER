<script>
import { useUserStore } from './src/stores'
import { qa, injectInterceptor, hookSetData } from './src/utils/debug/qa.js'
import { applyTheme, getCurrentTheme, watchTheme } from './src/design/theme-engine.js'
// ✅ 检查点 5.1: 导入分析服务
import { analytics } from './src/utils/analytics/event-bus-analytics.js'
// ✅ 检查点 5.2: 导入增强错误处理器
import { globalErrorHandler } from './src/utils/error/global-error-handler.js'
import { sentryPatch as sentry } from './src/utils/error/sentry-mini-program-patch.js'

// 必须在 App() 之前执行
injectInterceptor()
hookSetData()

export default {
	onLaunch() {
		// 生产环境静默启动

		// 挂载 QA 工具到全局
		if (typeof getApp === 'function') {
			const app = getApp()
			if (app) {
				app.qa = qa
			}
		}

		// ✅ 检查点 5.1: 初始化分析服务
		analytics.init({
			enableDebug: process.env.NODE_ENV !== 'production'
		})

		// ✅ 检查点 5.2: 初始化增强错误处理器
		globalErrorHandler.init()
		
		// ✅ 检查点 5.2: 初始化 Sentry（需要配置 DSN）
		sentry.init({
			dsn: '', // TODO: 配置实际的 Sentry DSN
			environment: process.env.NODE_ENV || 'development',
			release: '1.0.0'
		})

		// 初始化全局错误捕捉
		this.initGlobalErrorHandler()

		// 初始化双模主题系统
		this.initThemeSystem()

		// 执行静默登录
		this.performSilentLogin()
	},
	onError(error) {
		// Vue 错误捕捉
		this.handleGlobalError('Vue Error', error)
	},
	onUnhandledRejection(event) {
		// Promise 未捕获的 rejection
		this.handleGlobalError('Unhandled Promise Rejection', event.reason)
	},
	onShow() {
		// 每次显示时同步主题
		const currentTheme = getCurrentTheme()
		this.globalData.currentTheme = currentTheme
		applyTheme(currentTheme)
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
			const savedTheme = uni.getStorageSync('theme_mode')
			const currentTheme = savedTheme || getCurrentTheme()

			this.globalData.currentTheme = currentTheme
			this.globalData.isDarkMode = currentTheme === 'dark'

			// 应用主题
			applyTheme(currentTheme)

			// 监听系统主题变化
			watchTheme((theme) => {
				// 如果用户没有手动设置主题，则跟随系统
				const userSetTheme = uni.getStorageSync('theme_mode')
				if (!userSetTheme) {
					this.switchTheme(theme)
				}
			})

			// 全局监听主题切换事件
			uni.$on('updateTheme', (mode) => {
				this.switchTheme(mode)
			})

			// 主题初始化完成
		},

		/**
		 * 切换主题
		 */
		switchTheme(theme) {
			this.globalData.currentTheme = theme
			this.globalData.isDarkMode = theme === 'dark'

			// 应用设计令牌
			applyTheme(theme)

			// 保存用户选择
			uni.setStorageSync('theme_mode', theme)

			// 触发全局主题更新事件
			uni.$emit('themeUpdate', theme)

			// 更新状态栏颜色
			this.updateNavigationBarColor(theme)

			// 主题切换完成
		},

		/**
		 * 更新导航栏颜色
		 */
		updateNavigationBarColor(theme) {
			const isDark = theme === 'dark'
			uni.setNavigationBarColor({
				frontColor: isDark ? '#ffffff' : '#000000',
				backgroundColor: isDark ? '#080808' : '#9FE870',
				animation: {
					duration: 300,
					timingFunc: 'easeInOut'
				}
			}).catch(() => {
				// 设置导航栏颜色失败，静默处理
			})
		},

		/**
		 * 初始化全局错误处理器
		 */
		initGlobalErrorHandler() {
			// 创建错误日志目录
			const errorLogs = []
			this.globalData.errorLogs = errorLogs

			// 监听全局错误事件
			uni.onError((error) => {
				this.handleGlobalError('Runtime Error', error)
			})

			// 监听未处理的 Promise rejection
			uni.onUnhandledRejection((event) => {
				this.handleGlobalError('Unhandled Promise Rejection', event.reason)
			})

			// 全局错误捕捉已初始化
		},

		/**
		 * 处理全局错误
		 */
		handleGlobalError(type, error) {
			const errorInfo = {
				type,
				message: error?.message || String(error),
				stack: error?.stack || '',
				timestamp: new Date().toISOString(),
				page: getCurrentPages().length > 0 ? getCurrentPages()[getCurrentPages().length - 1].route : 'unknown'
			}

			// 保存到内存
			if (this.globalData.errorLogs) {
				this.globalData.errorLogs.push(errorInfo)
				// 只保留最近50条错误
				if (this.globalData.errorLogs.length > 50) {
					this.globalData.errorLogs.shift()
				}
			}

			// 保存到本地存储（用于调试）
			try {
				const storedErrors = uni.getStorageSync('runtime_errors') || []
				storedErrors.push(errorInfo)
				// 只保留最近100条
				if (storedErrors.length > 100) {
					storedErrors.splice(0, storedErrors.length - 100)
				}
				uni.setStorageSync('runtime_errors', storedErrors)
			} catch (e) {
				console.error('[ErrorHandler] 保存错误日志失败:', e)
			}

			// 控制台输出
			console.error(`[${type}]`, errorInfo.message)
			if (errorInfo.stack) {
				console.error('Stack:', errorInfo.stack)
			}

			// 在开发环境显示错误提示
			// #ifdef MP-WEIXIN
			if (typeof __wxConfig !== 'undefined' && __wxConfig.envVersion === 'develop') {
				uni.showToast({
					title: `错误: ${errorInfo.message.substring(0, 20)}...`,
					icon: 'none',
					duration: 3000
				})
			}
			// #endif
		},

		/**
		 * 执行静默登录
		 */
		async performSilentLogin() {
			try {
				const userStore = useUserStore()
				const result = await userStore.silentLogin()

				if (result.success) {
					// 静默登录成功
				} else {
					console.warn('[App] 静默登录失败:', result.error?.message || '未知错误')
				}
			} catch (error) {
				console.error('[App] 静默登录异常:', error)
			}
		}
	},
	globalData: {
		currentTheme: 'light',
		isDarkMode: false,
		qaLogs: [],
		errorLogs: []
	}
}
</script>

<style lang="scss">
/* ============================================
   EXAM-MASTER 全局配色系统 v3.0
   严格基于 index.vue 的颜色实现 1:1 提取
   ============================================ */

/* 导入通用样式 - 使用 Sass 3.0 兼容语法 */
@use '@/common/styles/common.scss' as common;

/* ============================================
   核心颜色变量定义 (从 index.vue 提取)
   ============================================ */

/* 浅色模式（默认） - Wise 风格 */
:root, page {
	/* ====== 核心变量 (严格来自 index.vue) ====== */
	--background: #9FE870;                      /* 页面背景：Wise绿 */
	--foreground: #1A1D1F;                      /* 主文字：深灰黑 */
	--card: #FFFFFF;                            /* 卡片背景：纯白 */
	--card-foreground: #1A1D1F;                 /* 卡片文字：深灰黑 */
	--primary: #FFFFFF;                         /* 品牌主色：白色 */
	--primary-foreground: #1A1D1F;              /* 品牌主色文字：深灰黑 */
	--muted: rgba(255, 255, 255, 0.3);          /* 弱化背景：半透明白 */
	--muted-foreground: #2D3748;                /* 弱化文字：中灰 */
	--border: rgba(255, 255, 255, 0.3);         /* 边框：半透明白 */
	--brand: #FFFFFF;                           /* 品牌色：白色 */
	--brand-glow: rgba(255, 255, 255, 0.3);     /* 品牌光晕：半透明白 */
	--glass-bg: rgba(255, 255, 255, 0.2);       /* 毛玻璃背景：半透明白 */
	--glass-border: rgba(255, 255, 255, 0.4);   /* 毛玻璃边框：半透明白 */

	/* ====== 语义化别名（方便使用） ====== */
	--bg-page: var(--background);
	--bg-card: var(--card);
	--bg-secondary: #F5F5F7;
	--bg-glass: var(--glass-bg);
	--text-main: var(--foreground);
	--text-primary: var(--foreground);
	--text-sub: var(--muted-foreground);
	--text-secondary: var(--muted-foreground);
	--border-color: var(--border);
	--primary-light: rgba(159, 232, 112, 0.2);
	--success-light: rgba(16, 185, 129, 0.2);
	--warning-light: rgba(245, 158, 11, 0.2);
	--gradient-primary: linear-gradient(135deg, #9FE870 0%, #7BC653 100%);

	/* ====== 扩展功能色 ====== */
	--success: #10B981;
	--warning: #F59E0B;
	--danger: #EF4444;
	--info: #3B82F6;

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
	--shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.02);
	--shadow-md: 0 2px 8px rgba(0, 0, 0, 0.04);
	--shadow-lg: 0 4px 16px rgba(0, 0, 0, 0.08);
	--shadow-xl: 0 8px 24px rgba(0, 0, 0, 0.12);
}

/* 深色模式 - Bitget 风格 */
@media (prefers-color-scheme: dark) {
	:root, page {
		/* ====== 核心变量 (严格来自 index.vue 的 .dark 类) ====== */
		--background: #080808;                      /* 页面背景：纯黑 */
		--foreground: #FFFFFF;                      /* 主文字：白色 */
		--card: #0D1117;                            /* 卡片背景：次级黑 */
		--card-foreground: #FFFFFF;                 /* 卡片文字：白色 */
		--primary: #00F2FF;                         /* 品牌主色：青色 */
		--primary-foreground: #080808;              /* 品牌主色文字：纯黑 */
		--muted: #1A1C1E;                           /* 弱化背景：深灰 */
		--muted-foreground: #9CA3AF;                /* 弱化文字：中灰 */
		--border: #2D2D2D;                          /* 边框：深灰 */
		--brand: #00F2FF;                           /* 品牌色：青色 */
		--brand-glow: rgba(0, 242, 255, 0.3);       /* 品牌光晕：青色半透明 */
		--glass-bg: rgba(255, 255, 255, 0.05);      /* 毛玻璃背景：极淡白 */
		--glass-border: rgba(255, 255, 255, 0.1);   /* 毛玻璃边框：淡白 */

		/* ====== 语义化别名（方便使用） ====== */
		--bg-page: var(--background);
		--bg-card: var(--card);
		--bg-secondary: #1C1C1E;
		--bg-glass: var(--glass-bg);
		--text-main: var(--foreground);
		--text-primary: var(--foreground);
		--text-sub: var(--muted-foreground);
		--text-secondary: var(--muted-foreground);
		--border-color: var(--border);
		--primary-light: rgba(0, 242, 255, 0.2);
		--success-light: rgba(16, 185, 129, 0.2);
		--warning-light: rgba(245, 158, 11, 0.2);
		--gradient-primary: linear-gradient(135deg, #00F2FF 0%, #0A84FF 100%);

		/* 阴影系统（深色模式下更强） */
		--shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.2);
		--shadow-md: 0 2px 8px rgba(0, 0, 0, 0.3);
		--shadow-lg: 0 4px 16px rgba(0, 0, 0, 0.4);
		--shadow-xl: 0 8px 24px rgba(0, 0, 0, 0.5);
	}
}

/* 手动深色模式类（支持用户切换） */
.dark, .dark-mode {
	/* ====== 核心变量 (严格来自 index.vue 的 .dark 类) ====== */
	--background: #080808;                      /* 页面背景：纯黑 */
	--foreground: #FFFFFF;                      /* 主文字：白色 */
	--card: #0D1117;                            /* 卡片背景：次级黑 */
	--card-foreground: #FFFFFF;                 /* 卡片文字：白色 */
	--primary: #00F2FF;                         /* 品牌主色：青色 */
	--primary-foreground: #080808;              /* 品牌主色文字：纯黑 */
	--muted: #1A1C1E;                           /* 弱化背景：深灰 */
	--muted-foreground: #9CA3AF;                /* 弱化文字：中灰 */
	--border: #2D2D2D;                          /* 边框：深灰 */
	--brand: #00F2FF;                           /* 品牌色：青色 */
	--brand-glow: rgba(0, 242, 255, 0.3);       /* 品牌光晕：青色半透明 */
	--glass-bg: rgba(255, 255, 255, 0.05);      /* 毛玻璃背景：极淡白 */
	--glass-border: rgba(255, 255, 255, 0.1);   /* 毛玻璃边框：淡白 */

	/* ====== 语义化别名（方便使用） ====== */
	--bg-page: var(--background);
	--bg-card: var(--card);
	--bg-secondary: #1C1C1E;
	--bg-glass: var(--glass-bg);
	--text-main: var(--foreground);
	--text-primary: var(--foreground);
	--text-sub: var(--muted-foreground);
	--text-secondary: var(--muted-foreground);
	--border-color: var(--border);
	--primary-light: rgba(0, 242, 255, 0.2);
	--success-light: rgba(16, 185, 129, 0.2);
	--warning-light: rgba(245, 158, 11, 0.2);
	--gradient-primary: linear-gradient(135deg, #00F2FF 0%, #0A84FF 100%);

	/* 阴影系统（深色模式下更强） */
	--shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.2);
	--shadow-md: 0 2px 8px rgba(0, 0, 0, 0.3);
	--shadow-lg: 0 4px 16px rgba(0, 0, 0, 0.4);
	--shadow-xl: 0 8px 24px rgba(0, 0, 0, 0.5);
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
	transition: background-color var(--transition-normal) var(--ease-default),
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
.text-main { color: var(--text-main); }
.text-sub { color: var(--text-sub); }
.text-primary { color: var(--primary); }
.text-success { color: var(--success); }
.text-warning { color: var(--warning); }
.text-danger { color: var(--danger); }

/* 背景颜色工具类 */
.bg-page { background-color: var(--bg-page); }
.bg-card { background-color: var(--bg-card); }

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
page[data-theme="dark"] .list-item:active,
page[data-theme="dark"] .activity-item:active,
page[data-theme="dark"] .option-item:active {
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