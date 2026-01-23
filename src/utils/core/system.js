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
		// #ifdef MP-WECHAT
		const deviceInfo = uni.getDeviceInfo();
		return deviceInfo.pixelRatio || 1;
		// #endif
		
		// #ifndef MP-WECHAT
		const sysInfo = uni.getSystemInfoSync();
		return sysInfo.pixelRatio || 1;
		// #endif
	} catch (e) {
		console.warn('获取设备像素比失败，使用默认值', e);
		return 1;
	}
}
