<script>
import { useUserStore } from './src/stores'
import { qa, injectInterceptor, hookSetData } from './src/utils/debug/qa.js'

// 必须在 App() 之前执行
injectInterceptor()
hookSetData()

// 注意：Console 日志复制功能已移除，请使用 Raycast 或其他工具复制日志

export default {
	onLaunch() {
		console.log('App Launch')
		
		// 挂载 QA 工具到全局
		if (typeof getApp === 'function') {
			const app = getApp()
			if (app) {
				app.qa = qa
				
				// 注意：Console 日志复制工具已移除，请使用 Raycast 或其他工具
			}
		}
		
		// 初始化应用配置
		// 注意：已移除原生tabBar配置，使用自定义BottomNavbar组件
		// 注意：hideTabBar 需要在页面 onShow 中调用，不能在这里调用（会报错）
		
		// 读取保存的主题模式
		const savedTheme = uni.getStorageSync('theme_mode') || 'light'
		this.globalData.isDarkMode = savedTheme === 'dark'
		this.applyTheme(savedTheme)
		
		// 全局监听主题切换事件
		uni.$on('updateTheme', (mode) => {
			const isDark = mode === 'dark'
			this.globalData.isDarkMode = isDark
			this.applyTheme(mode)
		})
		
		// 执行静默登录
		this.performSilentLogin()
	},
	onShow() {
		console.log('App Show')
		// 每次显示时同步主题
		const savedTheme = uni.getStorageSync('theme_mode') || 'light'
		this.globalData.isDarkMode = savedTheme === 'dark'
		this.applyTheme(savedTheme)
	},
	onHide() {
		console.log('App Hide')
	},
	methods: {
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
					// 静默登录失败不影响应用使用，用户可以稍后手动登录
				}
			} catch (error) {
				console.error('[App] 静默登录异常:', error)
			}
		},
		applyTheme(mode) {
			// 保存主题模式
			uni.setStorageSync('theme_mode', mode)
			
			// 触发全局主题更新事件，让所有页面响应
			uni.$emit('themeUpdate', mode)
			
			// 更新状态栏颜色
			this.updateNavigationBarColor(mode)
		},
		updateNavigationBarColor(mode) {
			const isDark = mode === 'dark'
			uni.setNavigationBarColor({
				frontColor: isDark ? '#ffffff' : '#000000',
				backgroundColor: isDark ? '#163300' : '#F8FAFC',
				animation: {
					duration: 300,
					timingFunc: 'easeInOut'
				}
			}).catch(err => {
				console.log('设置导航栏颜色失败', err)
			})
		}
	},
	globalData: {
		isDarkMode: false,
		qaLogs: [] // QA 日志容器
	}
}
</script>

<style lang="scss">
/* 全局样式 */
@import '@/common/styles/common.scss';

/* ============================================
   全局 CSS 变量定义 - 浅色模式（默认）
   ============================================ */
page {
	height: 100%;
	
	/* 基础颜色变量 - 浅色模式 (Wise 风格) */
	--bg-main: #FFFFFF;
	--bg-card: #FFFFFF;
	--border-card: #EFEFEF;
	--text-main: #163300; /* Wise Dark Green */
	--text-title: #163300;
	--text-body: #454545;
	--text-light: #767676;
	
	/* 品牌色 */
	--accent-green: #9FE870; /* Wise Lime */
	--accent-green-light: #F2F9EE;
	--accent-blue: #00B9FF;
	
	/* 输入框 */
	--input-bg: #F2F2F2;
	--input-border: #E0E0E0;
	
	/* TabBar 背景 */
	--tab-bg: #FFFFFF;
	
	/* 默认背景色和文字色 */
	background-color: var(--bg-main);
	color: var(--text-body);
	transition: background-color 0.3s, color 0.3s;
}

/* ============================================
   深色模式 CSS 变量覆盖 - 增强对比度
   ============================================ */
.dark-mode {
	--bg-main: #163300; /* Wise Dark Green Background */
	--bg-card: rgba(255, 255, 255, 0.05);
	--border-card: rgba(255, 255, 255, 0.1);
	--text-main: #FFFFFF; 
	--text-title: #FFFFFF; 
	--text-body: #E2E8F0; 
	--text-light: #A0AEC0; 
	
	/* 品牌色 */
	--accent-green: #9FE870; /* Wise Lime */
	--accent-green-light: rgba(159, 232, 112, 0.2);
	--accent-blue: #00B9FF;
	
	/* 输入框 */
	--input-bg: rgba(255, 255, 255, 0.1);
	--input-border: rgba(255, 255, 255, 0.2);
	
	/* TabBar 背景 */
	--tab-bg: #163300;
	
	/* 深色模式下的极光背景 */
	.aurora-bg {
		opacity: 0.2;
		filter: blur(120px);
	}
}

/* ============================================
   智能护眼模式（深夜模式）
   当处于 23:00 - 05:00 时自动启用
   ============================================ */
.dark-mode.night-mode {
	filter: sepia(20%);
}

/* ============================================
   全局字体设置
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
	font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
	transition: background-color 0.3s, color 0.3s;
}

/* ============================================
   全局组件样式（使用 CSS 变量）
   ============================================ */
.glass-card {
	background: var(--bg-card);
	border: 1px solid var(--border-card);
	color: var(--text-body);
}

.dark-mode .glass-card {
	background: var(--bg-card);
	border-color: var(--border-card);
	color: var(--text-body);
}

.dark-mode .aurora-bg {
	background: linear-gradient(135deg, #163300 0%, #1a2e05 50%, #0f3460 100%) !important;
}

.dark-mode .header-nav {
	background: rgba(22, 51, 0, 0.8) !important;
	border-bottom: 1px solid rgba(255, 255, 255, 0.1) !important;
}

.dark-mode .glass-btn {
	background: rgba(255, 255, 255, 0.1) !important;
	border: 1px solid rgba(255, 255, 255, 0.2) !important;
}
</style>
