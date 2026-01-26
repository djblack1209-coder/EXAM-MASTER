/**
 * 系统信息工具函数
 * 适配最新的 uni-app API，避免废弃警告
 */

/**
 * 获取状态栏高度
 * @returns {number} 状态栏高度（px）
 */
export function getStatusBarHeight() {
	try {
		// #ifdef MP-WECHAT
		// 微信小程序使用新的 API
		const windowInfo = uni.getWindowInfo();
		return windowInfo.statusBarHeight || 44;
		// #endif
		
		// #ifndef MP-WECHAT
		// 其他平台使用兼容方案
		const sysInfo = uni.getSystemInfoSync();
		return sysInfo.statusBarHeight || sysInfo.safeAreaInsets?.top || 44;
		// #endif
	} catch (e) {
		// 降级方案
		console.warn('获取状态栏高度失败，使用默认值', e);
		return 44;
	}
}

/**
 * 获取标准导航栏高度（统一计算公式）
 * @returns {number} 导航栏高度（px）= 状态栏高度 + 44px
 */
export function getNavBarHeight() {
	try {
		const statusBarHeight = getStatusBarHeight();
		// 标准计算公式：状态栏高度 + 44px（iOS/Android 标准导航栏高度）
		return statusBarHeight + 44;
	} catch (e) {
		console.warn('获取导航栏高度失败，使用默认值', e);
		// 默认值：44（状态栏） + 44（导航栏） = 88px
		return 88;
	}
}

/**
 * 获取窗口高度
 * @returns {number} 窗口高度（px）
 */
export function getWindowHeight() {
	try {
		// #ifdef MP-WECHAT
		const windowInfo = uni.getWindowInfo();
		return windowInfo.windowHeight || 800;
		// #endif
		
		// #ifndef MP-WECHAT
		const sysInfo = uni.getSystemInfoSync();
		return sysInfo.windowHeight || sysInfo.screenHeight || 800;
		// #endif
	} catch (e) {
		console.warn('获取窗口高度失败，使用默认值', e);
		return 800;
	}
}

/**
 * 获取胶囊按钮信息（仅微信小程序）
 * @returns {Object|null} 胶囊按钮信息
 */
export function getMenuButtonBoundingClientRect() {
	// #ifdef MP-WECHAT
	try {
		return uni.getMenuButtonBoundingClientRect();
	} catch (e) {
		console.warn('获取胶囊按钮信息失败', e);
		return null;
	}
	// #endif
	
	// #ifndef MP-WECHAT
	return null;
	// #endif
}

/**
 * 获取设备像素比
 * @returns {number} 设备像素比
 */
export function getPixelRatio() {
	try {
		// #ifdef MP-WEIXIN
		const deviceInfo = uni.getDeviceInfo();
		return deviceInfo.pixelRatio || 1;
		// #endif
		
		// #ifndef MP-WEIXIN
		const sysInfo = uni.getSystemInfoSync();
		return sysInfo.pixelRatio || 1;
		// #endif
	} catch (e) {
		console.warn('获取设备像素比失败，使用默认值', e);
		return 1;
	}
}

/**
 * 获取设备信息（替代废弃的 getSystemInfoSync）
 * @returns {Object} 设备信息
 */
export function getDeviceInfo() {
	try {
		// #ifdef MP-WEIXIN
		const deviceInfo = uni.getDeviceInfo();
		return {
			brand: deviceInfo.brand || 'unknown',
			model: deviceInfo.model || 'unknown',
			system: deviceInfo.system || 'unknown',
			platform: deviceInfo.platform || 'unknown',
			pixelRatio: deviceInfo.pixelRatio || 1
		};
		// #endif
		
		// #ifndef MP-WEIXIN
		const sysInfo = uni.getSystemInfoSync();
		return {
			brand: sysInfo.brand || 'unknown',
			model: sysInfo.model || 'unknown',
			system: sysInfo.system || 'unknown',
			platform: sysInfo.platform || 'unknown',
			pixelRatio: sysInfo.pixelRatio || 1
		};
		// #endif
	} catch (e) {
		console.warn('获取设备信息失败', e);
		return {
			brand: 'unknown',
			model: 'unknown',
			system: 'unknown',
			platform: 'unknown',
			pixelRatio: 1
		};
	}
}

/**
 * 获取窗口信息（替代废弃的 getSystemInfoSync）
 * @returns {Object} 窗口信息
 */
export function getWindowInfo() {
	try {
		// #ifdef MP-WEIXIN
		const windowInfo = uni.getWindowInfo();
		return {
			windowWidth: windowInfo.windowWidth || 375,
			windowHeight: windowInfo.windowHeight || 667,
			screenWidth: windowInfo.screenWidth || 375,
			screenHeight: windowInfo.screenHeight || 667,
			statusBarHeight: windowInfo.statusBarHeight || 44,
			safeArea: windowInfo.safeArea || {}
		};
		// #endif
		
		// #ifndef MP-WEIXIN
		const sysInfo = uni.getSystemInfoSync();
		return {
			windowWidth: sysInfo.windowWidth || 375,
			windowHeight: sysInfo.windowHeight || 667,
			screenWidth: sysInfo.screenWidth || 375,
			screenHeight: sysInfo.screenHeight || 667,
			statusBarHeight: sysInfo.statusBarHeight || 44,
			safeArea: sysInfo.safeArea || {}
		};
		// #endif
	} catch (e) {
		console.warn('获取窗口信息失败', e);
		return {
			windowWidth: 375,
			windowHeight: 667,
			screenWidth: 375,
			screenHeight: 667,
			statusBarHeight: 44,
			safeArea: {}
		};
	}
}

/**
 * 获取应用基础信息（替代废弃的 getSystemInfoSync）
 * @returns {Object} 应用基础信息
 */
export function getAppBaseInfo() {
	try {
		// #ifdef MP-WEIXIN
		const appBaseInfo = uni.getAppBaseInfo();
		return {
			SDKVersion: appBaseInfo.SDKVersion || 'unknown',
			version: appBaseInfo.version || 'unknown',
			language: appBaseInfo.language || 'zh_CN',
			theme: appBaseInfo.theme || 'light'
		};
		// #endif
		
		// #ifndef MP-WEIXIN
		const sysInfo = uni.getSystemInfoSync();
		return {
			SDKVersion: sysInfo.SDKVersion || 'unknown',
			version: sysInfo.version || 'unknown',
			language: sysInfo.language || 'zh_CN',
			theme: sysInfo.theme || 'light'
		};
		// #endif
	} catch (e) {
		console.warn('获取应用基础信息失败', e);
		return {
			SDKVersion: 'unknown',
			version: 'unknown',
			language: 'zh_CN',
			theme: 'light'
		};
	}
}

/**
 * 获取系统主题（替代废弃的 getSystemInfoSync）
 * @returns {string} 'light' | 'dark'
 */
export function getSystemTheme() {
	try {
		// #ifdef MP-WEIXIN
		const appBaseInfo = uni.getAppBaseInfo();
		return appBaseInfo.theme === 'dark' ? 'dark' : 'light';
		// #endif
		
		// #ifndef MP-WEIXIN
		if (typeof window !== 'undefined') {
			const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
			return prefersDark ? 'dark' : 'light';
		}
		return 'light';
		// #endif
	} catch (e) {
		console.warn('获取系统主题失败', e);
		return 'light';
	}
}

/**
 * 获取完整的平台信息（用于分析和错误上报）
 * @returns {Object} 平台信息
 */
export function getPlatformInfo() {
	try {
		// #ifdef MP-WEIXIN
		const deviceInfo = uni.getDeviceInfo();
		const windowInfo = uni.getWindowInfo();
		const appBaseInfo = uni.getAppBaseInfo();
		return {
			platform: deviceInfo.platform || 'unknown',
			system: deviceInfo.system || 'unknown',
			version: appBaseInfo.version || 'unknown',
			model: deviceInfo.model || 'unknown',
			brand: deviceInfo.brand || 'unknown',
			screenWidth: windowInfo.screenWidth || 375,
			screenHeight: windowInfo.screenHeight || 667,
			language: appBaseInfo.language || 'zh_CN',
			pixelRatio: deviceInfo.pixelRatio || 1
		};
		// #endif
		
		// #ifndef MP-WEIXIN
		const sysInfo = uni.getSystemInfoSync();
		return {
			platform: sysInfo.platform || 'unknown',
			system: sysInfo.system || 'unknown',
			version: sysInfo.version || 'unknown',
			model: sysInfo.model || 'unknown',
			brand: sysInfo.brand || 'unknown',
			screenWidth: sysInfo.screenWidth || 375,
			screenHeight: sysInfo.screenHeight || 667,
			language: sysInfo.language || 'zh_CN',
			pixelRatio: sysInfo.pixelRatio || 1
		};
		// #endif
	} catch (e) {
		console.warn('获取平台信息失败', e);
		return {
			platform: 'unknown',
			system: 'unknown',
			version: 'unknown',
			model: 'unknown',
			brand: 'unknown',
			screenWidth: 375,
			screenHeight: 667,
			language: 'zh_CN',
			pixelRatio: 1
		};
	}
}

/**
 * 获取用户代理字符串（用于错误上报）
 * @returns {string} 用户代理字符串
 */
export function getUserAgent() {
	try {
		const info = getPlatformInfo();
		return `${info.platform}/${info.system}/${info.version}`;
	} catch (e) {
		return 'unknown';
	}
}
