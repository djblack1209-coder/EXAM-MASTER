'use strict';

/**
 * 智谱 AI 代理云函数
 * 
 * ⚠️ 安全提示：
 * 1. 生产环境请将 API Key 配置到 uniCloud 云函数的环境变量中
 * 2. 在 HBuilderX 中：右键云函数 -> 云函数配置 -> 环境变量 -> 添加 AI_PROVIDER_KEY_PLACEHOLDER
 * 3. 或使用 uniCloud.init() 从云函数配置中读取
 * 
 * 当前使用默认Key仅用于开发测试，生产环境必须移除！
 */
const ZHIPU_API_URL = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';

// ⚠️ 开发环境默认Key（生产环境应移除，改为从环境变量读取）
// 推荐配置方式：在云函数配置中添加环境变量 AI_PROVIDER_KEY_PLACEHOLDER
const AI_PROVIDER_KEY_PLACEHOLDER

exports.main = async (event, context) => {
	try {
		// 获取前端传来的参数
		const { messages, model = 'glm-4', temperature = 0.7, max_tokens = 2048 } = event;
		
		// 验证必要参数
		if (!messages || !Array.isArray(messages) || messages.length === 0) {
			return {
				code: 400,
				message: '参数错误：messages 必须是非空数组',
				data: null
			};
		}
		
		// 构建请求体
		const requestBody = {
			model: model,
			messages: messages,
			temperature: temperature,
			max_tokens: max_tokens
		};
		
		// 使用 uniCloud.httpclient 发送 POST 请求
		const response = await uniCloud.httpclient.request(ZHIPU_API_URL, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Authorization': `Bearer ${AI_PROVIDER_KEY_PLACEHOLDER
			},
			data: requestBody,
			dataType: 'json',
			timeout: 60000 // 60秒超时
		});
		
		// 检查响应状态
		if (response.status !== 200) {
			return {
				code: response.status,
				message: `请求失败：HTTP ${response.status}`,
				data: response.data
			};
		}
		
		// 返回 AI 的响应结果
		return {
			code: 200,
			message: '请求成功',
			data: response.data
		};
		
	} catch (error) {
		// 异常捕获，返回错误信息
		console.error('proxy-ai 错误:', error);
		
		return {
			code: 500,
			message: error.message || '服务器内部错误',
			data: null,
			error: process.env.NODE_ENV === 'development' ? error.stack : undefined
		};
	}
};
