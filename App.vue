<script>
import { useUserStore } from './src/stores'
import { qa, injectInterceptor, hookSetData } from './src/utils/debug/qa.js'
import { applyTheme, getCurrentTheme, watchTheme } from './src/design/theme-engine.js'

// 必须在 App() 之前执行
injectInterceptor()
hookSetData()

export default {
	onLaunch() {
		console.log('App Launch - GEMINI-ARCHITECT v9')

		// 挂载 QA 工具到全局
		if (typeof getApp === 'function') {
			const app = getApp()
			if (app) {
				app.qa = qa
			}
		}

		// 初始化双模主题系统
		this.initThemeSystem()

		// 执行静默登录
		this.performSilentLogin()
	},
	onShow() {
		console.log('App Show')
		// 每次显示时同步主题
		const currentTheme = getCurrentTheme()
		this.globalData.currentTheme = currentTheme
		applyTheme(currentTheme)
	},
	onHide() {
		console.log('App Hide')
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

			console.log('[ThemeEngine] 初始化完成，当前主题:', currentTheme)
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

			console.log('[ThemeEngine] 主题已切换:', theme)
		},

		/**
		 * 更新导航栏颜色
		 */
		updateNavigationBarColor(theme) {
			const isDark = theme === 'dark'
			uni.setNavigationBarColor({
				frontColor: isDark ? '#ffffff' : '#000000',
				backgroundColor: isDark ? '#0D1117' : '#F9FAFB',
				animation: {
					duration: 300,
					timingFunc: 'easeInOut'
				}
			}).catch(err => {
				console.log('设置导航栏颜色失败', err)
			})
		},

		/**
		 * 执行静默登录
		 */
		async performSilentLogin() {
			try {
				const userStore = useUserStore()
				const result = await userStore.silentLogin()

				if (result.success) {
					console.log('[App] 静默登录成功，用户ID:', result.userInfo?._id || result.userInfo?.id)
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
		qaLogs: []
	}
}
</script>

<style lang="scss">
/* ============================================
   GEMINI-ARCHITECT v9 全局样式系统
   双模设计令牌 (Wise/Bitget)
   ============================================ */

/* 导入通用样式 */
@import '@/common/styles/common.scss';

/* ============================================
   根元素配置
   ============================================ */
page {
	height: 100%;

	/* 默认主题 (Wise - 白昼模式) */
	--bg-body: #F9FAFB;
	--bg-card: #FFFFFF;
	--bg-hover: #F3F4F6;
	--bg-active: #E5E7EB;

	--text-primary: #2F3542;
	--text-secondary: #747D8C;
	--text-tertiary: #A4B0BE;
	--text-disabled: #CED6E0;

	--brand-color: #9FE870;
	--brand-hover: #8DD65A;
	--brand-active: #7BC444;

	--action-green: #00B894;
	--action-blue: #0984E3;
	--danger: #FF4757;
	--warning: #FFA502;
	--success: #26DE81;
	--info: #4B7BEC;

	--border-light: #E1E8ED;
	--border-medium: #CED6E0;
	--border-dark: #A4B0BE;

	--radius-xs: 4px;
	--radius-sm: 8px;
	--radius-md: 16px;
	--radius-lg: 24px;
	--radius-xl: 32px;
	--radius-full: 9999px;

	--spacing-xs: 4px;
	--spacing-sm: 8px;
	--spacing-md: 16px;
	--spacing-lg: 20px;
	--spacing-xl: 24px;
	--spacing-2xl: 32px;
	--spacing-3xl: 40px;

	--font-weight-regular: 400;
	--font-weight-medium: 500;
	--font-weight-semibold: 600;
	--font-weight-bold: 700;
	--font-weight-extrabold: 800;

	--shadow-1: 0 2px 8px rgba(0, 0, 0, 0.04);
	--shadow-2: 0 4px 16px rgba(0, 0, 0, 0.08);
	--shadow-3: 0 8px 24px rgba(0, 0, 0, 0.12);

	--transition-fast: 0.15s;
	--transition: 0.3s;
	--transition-slow: 0.5s;

	--ease: cubic-bezier(0.4, 0, 0.2, 1);

	/* 应用背景和文字色 */
	background-color: var(--bg-body);
	color: var(--text-primary);
	transition: background-color var(--transition) var(--ease),
		color var(--transition) var(--ease);
}

/* ============================================
   全局字体系统
   ============================================ */
page,
view,
text,
image,
button,
input,
textarea,
scroll-view {
	box-sizing: border-box;
	font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto',
		'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans',
		'Helvetica Neue', 'PingFang SC', 'Hiragino Sans GB',
		'Microsoft YaHei', sans-serif;
	-webkit-font-smoothing: antialiased;
	-moz-osx-font-smoothing: grayscale;
}

/* ============================================
   全局组件样式（使用设计令牌）
   ============================================ */
.glass-card {
	background: var(--bg-card);
	border: 1px solid var(--border-light);
	border-radius: var(--radius-md);
	padding: var(--spacing-md);
	color: var(--text-primary);
	transition: all var(--transition) var(--ease);
}

.glass-card:hover {
	background: var(--bg-hover);
	border-color: var(--border-medium);
}

.glass-btn {
	background: var(--bg-card);
	border: 1px solid var(--border-light);
	border-radius: var(--radius-sm);
	padding: var(--spacing-sm) var(--spacing-md);
	color: var(--text-primary);
	font-weight: var(--font-weight-medium);
	transition: all var(--transition-fast) var(--ease);
}

.glass-btn:active {
	background: var(--bg-active);
	transform: scale(0.98);
}

/* ============================================
   兼容旧版样式（逐步废弃）
   ============================================ */
.dark-mode {
	/* 旧版深色模式类名，保留以兼容现有代码 */
	--bg-main: var(--bg-body);
	--bg-card: var(--bg-card);
	--border-card: var(--border-light);
	--text-main: var(--text-primary);
	--text-title: var(--text-primary);
	--text-body: var(--text-secondary);
	--text-light: var(--text-tertiary);
	--accent-green: var(--brand-color);
	--accent-blue: var(--action-blue);
	--input-bg: var(--bg-hover);
	--input-border: var(--border-light);
	--tab-bg: var(--bg-card);
}

/* ============================================
   性能优化
   ============================================ */
/* 减少重绘 */
.will-change-transform {
	will-change: transform;
}

.will-change-opacity {
	will-change: opacity;
}

/* GPU 加速 */
.gpu-accelerated {
	transform: translateZ(0);
	backface-visibility: hidden;
	perspective: 1000px;
}
</style>
