/**
 * 全局错误处理服务
 * 统一处理应用中的各类错误
 */

class ErrorHandler {
	constructor() {
		this.errorLog = [];
		this.maxLogSize = 100; // 最多保存100条错误日志
		this.isProduction = process.env.NODE_ENV === 'production';
	}

	/**
	 * 处理错误
	 * @param {Error} error - 错误对象
	 * @param {Object} context - 错误上下文
	 */
	handle(error, context = {}) {
		const errorInfo = this.formatError(error, context);
		
		// 记录错误日志
		this.logError(errorInfo);
		
		// 显示用户友好的错误提示
		this.showUserMessage(errorInfo);
		
		// 生产环境上报错误（可选）
		if (this.isProduction) {
			this.reportError(errorInfo);
		}
		
		return errorInfo;
	}

	/**
	 * 格式化错误信息
	 */
	formatError(error, context) {
		return {
			timestamp: Date.now(),
			message: error.message || '未知错误',
			stack: error.stack || '',
			type: error.name || 'Error',
			context: {
				page: context.page || 'unknown',
				action: context.action || 'unknown',
				userId: context.userId || 'anonymous',
				...context
			},
			userAgent: this.getUserAgent()
		};
	}

	/**
	 * 记录错误日志
	 */
	logError(errorInfo) {
		// 添加到内存日志
		this.errorLog.unshift(errorInfo);
		
		// 限制日志大小
		if (this.errorLog.length > this.maxLogSize) {
			this.errorLog = this.errorLog.slice(0, this.maxLogSize);
		}
		
		// 保存到本地存储
		try {
			const storedLogs = uni.getStorageSync('error_logs') || [];
			storedLogs.unshift(errorInfo);
			uni.setStorageSync('error_logs', storedLogs.slice(0, 50)); // 本地只保存50条
		} catch (e) {
			console.error('[ErrorHandler] 保存错误日志失败:', e);
		}
		
		// 控制台输出（开发环境）
		if (!this.isProduction) {
			console.error('[ErrorHandler] 错误详情:', errorInfo);
		}
	}

	/**
	 * 显示用户友好的错误提示
	 */
	showUserMessage(errorInfo) {
		const userMessage = this.getUserFriendlyMessage(errorInfo);
		
		uni.showToast({
			title: userMessage,
			icon: 'none',
			duration: 3000
		});
	}

	/**
	 * 获取用户友好的错误消息
	 */
	getUserFriendlyMessage(errorInfo) {
		const { message, context } = errorInfo;
		
		// 网络错误
		if (message.includes('network') || message.includes('timeout') || message.includes('请求失败')) {
			return '网络连接失败，请检查网络';
		}
		
		// 认证错误
		if (message.includes('auth') || message.includes('token') || message.includes('登录')) {
			return '登录已过期，请重新登录';
		}
		
		// 数据错误
		if (message.includes('data') || message.includes('parse') || message.includes('JSON')) {
			return '数据格式错误，请稍后重试';
		}
		
		// AI服务错误
		if (context.action === 'ai_request') {
			return 'AI服务暂时不可用，请稍后重试';
		}
		
		// 文件上传错误
		if (context.action === 'file_upload') {
			return '文件上传失败，请检查文件格式';
		}
		
		// 默认错误消息
		return '操作失败，请稍后重试';
	}

	/**
	 * 上报错误到服务器（可选）
	 * NOTE: 错误上报服务暂未接入，当前仅记录到控制台
	 * 后续可接入 Sentry、Bugsnag 或自建错误收集服务
	 */
	reportError(errorInfo) {
		// 当前降级方案：仅记录到控制台，后续可接入第三方监控平台
		console.log('[ErrorHandler] 错误已记录，待上报:', errorInfo.message);
	}

	/**
	 * 获取用户代理信息
	 */
	getUserAgent() {
		try {
			const systemInfo = uni.getSystemInfoSync();
			return {
				platform: systemInfo.platform,
				system: systemInfo.system,
				version: systemInfo.version,
				model: systemInfo.model
			};
		} catch (e) {
			return { platform: 'unknown' };
		}
	}

	/**
	 * 获取错误日志
	 */
	getErrorLogs(limit = 20) {
		return this.errorLog.slice(0, limit);
	}

	/**
	 * 清除错误日志
	 */
	clearErrorLogs() {
		this.errorLog = [];
		try {
			uni.removeStorageSync('error_logs');
		} catch (e) {
			console.error('[ErrorHandler] 清除错误日志失败:', e);
		}
	}

	/**
	 * 处理Promise拒绝
	 */
	handlePromiseRejection(reason, promise) {
		const error = reason instanceof Error ? reason : new Error(String(reason));
		this.handle(error, {
			type: 'unhandledRejection',
			promise: promise
		});
	}

	/**
	 * 处理未捕获的错误
	 */
	handleUncaughtError(error) {
		this.handle(error, {
			type: 'uncaughtError'
		});
	}
}

// 创建单例
const errorHandler = new ErrorHandler();

// 全局错误处理
if (typeof uni !== 'undefined') {
	// 监听未捕获的Promise拒绝
	uni.onUnhandledRejection((res) => {
		errorHandler.handlePromiseRejection(res.reason, res.promise);
	});

	// 监听页面错误（如果支持）
	if (typeof uni.onError === 'function') {
		uni.onError((error) => {
			errorHandler.handleUncaughtError(new Error(error));
		});
	}
}

/**
 * 错误处理装饰器（用于包装异步函数）
 */
export function withErrorHandler(context = {}) {
	return function(target, propertyKey, descriptor) {
		const originalMethod = descriptor.value;
		
		descriptor.value = async function(...args) {
			try {
				return await originalMethod.apply(this, args);
			} catch (error) {
				errorHandler.handle(error, {
					...context,
					method: propertyKey,
					args: args
				});
				throw error; // 重新抛出，让调用者决定如何处理
			}
		};
		
		return descriptor;
	};
}

/**
 * 包装异步函数，自动处理错误
 */
export function wrapAsync(fn, context = {}) {
	return async function(...args) {
		try {
			return await fn.apply(this, args);
		} catch (error) {
			errorHandler.handle(error, context);
			return null; // 返回null表示失败
		}
	};
}

/**
 * 安全执行函数，捕获所有错误
 */
export function safeExecute(fn, context = {}, fallback = null) {
	try {
		const result = fn();
		if (result instanceof Promise) {
			return result.catch(error => {
				errorHandler.handle(error, context);
				return fallback;
			});
		}
		return result;
	} catch (error) {
		errorHandler.handle(error, context);
		return fallback;
	}
}

export { errorHandler };
export default errorHandler;