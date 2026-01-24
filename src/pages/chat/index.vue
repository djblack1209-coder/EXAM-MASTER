<template>
	<view class="chat-container">
		<!-- 导航栏 - 添加设计系统工具类 -->
		<view class="custom-nav">
			<view class="nav-left ds-flex ds-touchable" @click="handleBack">
				<text class="back-arrow">〈</text>
				<text class="ds-text-sm">智能刷题</text>
			</view>
			<view class="nav-center ds-flex-col ds-flex-center">
				<text class="nav-title ds-text-lg ds-font-bold">AI 助教</text>
				<text class="nav-subtitle ds-text-xs">Apple Intelligence</text>
			</view>
			<view class="nav-right"></view>
		</view>

		<!-- 功能按钮区域 - 优化布局 -->
		<view class="function-buttons ds-flex ds-gap-xs">
			<view class="function-btn ds-flex-col ds-flex-center ds-touchable" @click="handleMistakeAnalysis">
				<text class="btn-icon">📝</text>
				<text class="btn-text ds-text-xs ds-font-medium">错题分析</text>
			</view>
			<view class="function-btn ds-flex-col ds-flex-center ds-touchable" @click="handleKnowledgeQuery">
				<text class="btn-icon">❓</text>
				<text class="btn-text ds-text-xs ds-font-medium">知识答疑</text>
			</view>
		</view>

		<!-- 选择错题弹窗 - 优化样式 -->
		<view class="mistake-select-modal" v-if="showMistakeSelectModal">
			<view class="modal-bg" @click="closeMistakeSelect"></view>
			<view class="modal-content-select">
				<view class="modal-header-select ds-flex ds-flex-between">
					<text class="modal-title-select ds-text-xl ds-font-bold">选择要分析的错题</text>
					<view class="modal-close-select ds-flex-center ds-rounded-full ds-touchable"
						@click="closeMistakeSelect">
						<text class="modal-close-icon-select">×</text>
					</view>
				</view>
				<scroll-view scroll-y class="modal-scroll-select">
					<view v-for="(mistake, index) in allMistakes" :key="index"
						class="mistake-item-select ds-flex ds-touchable"
						:class="{ 'selected': selectedMistakeIndexes.includes(index) }"
						@click="toggleMistakeSelect(index)">
						<view class="select-checkbox ds-flex-center ds-rounded-full">
							<text class="checkbox-icon ds-font-bold"
								v-if="selectedMistakeIndexes.includes(index)">✓</text>
						</view>
						<view class="mistake-content-select">
							<text class="mistake-category-select ds-text-xs">{{ mistake.category || '未分类' }}</text>
							<text class="mistake-question-select ds-text-sm">{{ mistake.question.substring(0, 80) }}{{
								mistake.question.length > 80 ? '...' : '' }}</text>
						</view>
					</view>
				</scroll-view>
				<view class="modal-footer-select ds-flex ds-gap-xs">
					<button class="modal-btn-select secondary ds-font-bold" @click="closeMistakeSelect">取消</button>
					<button class="modal-btn-select primary ds-font-bold" @click="confirmMistakeAnalysis"
						:disabled="selectedMistakeIndexes.length === 0">
						分析选中错题 ({{ selectedMistakeIndexes.length }})
					</button>
				</view>
			</view>
		</view>

		<scroll-view scroll-y class="chat-body" :scroll-into-view="scrollId" scroll-with-animation
			@touchstart="hideKeyboard">
			<view class="message-list">
				<view v-for="(msg, idx) in messages" :key="idx" :id="'msg-' + idx" class="message-row ds-flex"
					:class="msg.role">
					<view class="avatar-box" v-if="msg.role === 'assistant'">
						<view class="ai-avatar ds-flex-center ds-rounded-full">
							<text class="ai-icon">🤖</text>
						</view>
					</view>

					<view class="bubble-wrapper">
						<view class="bubble">
							<rich-text :nodes="renderMarkdown(msg.content)"></rich-text>
						</view>
						<text class="time-stamp ds-text-xs" v-if="msg.showTime">{{ msg.time }}</text>
					</view>
				</view>

				<view class="message-row assistant ds-flex" v-if="isTyping">
					<view class="avatar-box">
						<view class="ai-avatar ds-flex-center ds-rounded-full">
							<text class="ai-icon">🤖</text>
						</view>
					</view>
					<view class="bubble typing-bubble ds-flex">
						<view class="dot-jump ds-rounded-full"></view>
						<view class="dot-jump ds-rounded-full"></view>
						<view class="dot-jump ds-rounded-full"></view>
					</view>
				</view>

				<view id="msg-bottom" style="height: 180rpx;"></view>
			</view>
		</scroll-view>

		<view class="input-area-wrapper" :style="{ bottom: keyboardHeight + 'px' }">
			<view class="input-bar ds-flex">
				<view class="input-inner">
					<textarea v-model="inputValue" placeholder="有问题尽管问我..." auto-height fixed :cursor-spacing="20"
						:adjust-position="false" @focus="onFocus" @blur="onBlur" />
				</view>
				<view class="send-btn ds-flex-center ds-rounded-full ds-touchable"
					:class="{ 'can-send': inputValue.trim() }" @click="handleSend">
					<text class="up-icon ds-font-semibold">↑</text>
				</view>
			</view>
		</view>
	</view>
</template>

<script>
import { getApiKey } from '../../../common/config.js'
import { storageService } from '../../services/storageService.js'
import { lafService } from '../../services/lafService.js'

export default {
	data() {
		return {
			chatUrl: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
			messages: [
				{ role: 'assistant', content: '你好！我是你的智能导师。我已经准备好为你解析这份资料中的难点。你想先从哪个章节开始？', time: '刚才', showTime: true }
			],
			inputValue: '',
			scrollId: '',
			keyboardHeight: 0,
			isTyping: false,
			isDark: false,
			showMistakeSelectModal: false,
			allMistakes: [],
			selectedMistakeIndexes: []
		};
	},
	onLoad() {
		this.isDark = storageService.get('theme_mode', 'light') === 'dark';
		uni.$on('themeUpdate', (mode) => {
			this.isDark = mode === 'dark';
		});
	},
	onUnload() {
		uni.$off('themeUpdate');
	},
	methods: {
		// --- 功能按钮处理 ---
		async handleMistakeAnalysis() {
			// 从错题本读取错题数据
			let mistakes = [];

			try {
				// 优先从云端获取错题
				const result = await storageService.getMistakes(1, 50);
				if (result && result.list && result.list.length > 0) {
					mistakes = result.list.map(m => ({
						question: m.question || m.question_content || m.title || '题目内容',
						options: m.options || [],
						userAnswer: m.userChoice || m.user_answer || '未知',
						correctAnswer: m.answer || m.correct_answer || '未知',
						category: m.category || '未分类',
						raw: m // 保存原始数据
					}));
				} else {
					// 降级到本地读取
					const localMistakes = storageService.get('mistake_book', []);
					if (localMistakes && localMistakes.length > 0) {
						mistakes = localMistakes.map(m => ({
							question: m.question || m.question_content || m.title || '题目内容',
							options: m.options || [],
							userAnswer: m.userChoice || m.user_answer || '未知',
							correctAnswer: m.answer || m.correct_answer || '未知',
							category: m.category || '未分类',
							raw: m
						}));
					}
				}
			} catch (error) {
				console.error('加载错题失败:', error);
				// 降级到本地读取
				const localMistakes = storageService.get('mistake_book', []);
				if (localMistakes && localMistakes.length > 0) {
					mistakes = localMistakes.map(m => ({
						question: m.question || m.question_content || m.title || '题目内容',
						options: m.options || [],
						userAnswer: m.userChoice || m.user_answer || '未知',
						correctAnswer: m.answer || m.correct_answer || '未知',
						category: m.category || '未分类',
						raw: m
					}));
				}
			}

			if (mistakes.length === 0) {
				this.messages.push({
					role: 'assistant',
					content: '太棒了！你目前没有错题记录，继续保持！',
					time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
					showTime: true
				});
				this.scrollToBottom();
				return;
			}

			// 显示选择错题弹窗
			this.allMistakes = mistakes;
			this.selectedMistakeIndexes = [];
			this.showMistakeSelectModal = true;
		},

		closeMistakeSelect() {
			this.showMistakeSelectModal = false;
			this.selectedMistakeIndexes = [];
		},

		toggleMistakeSelect(index) {
			const idx = this.selectedMistakeIndexes.indexOf(index);
			if (idx > -1) {
				this.selectedMistakeIndexes.splice(idx, 1);
			} else {
				this.selectedMistakeIndexes.push(index);
			}
		},

		async confirmMistakeAnalysis() {
			if (this.selectedMistakeIndexes.length === 0) {
				uni.showToast({ title: '请至少选择一道错题', icon: 'none' });
				return;
			}

			this.showMistakeSelectModal = false;

			// 获取选中的错题
			const selectedMistakes = this.selectedMistakeIndexes.map(idx => this.allMistakes[idx]);

			// 发送错题分析请求
			this.isTyping = true;
			const mistakeInfo = selectedMistakes.map((mistake, index) => {
				// 构建完整的选项信息
				let optionsText = '选项：\n';
				if (mistake.options && Array.isArray(mistake.options) && mistake.options.length > 0) {
					mistake.options.forEach((opt, idx) => {
						const label = String.fromCharCode(65 + idx); // A, B, C, D
						optionsText += `${label}. ${opt}\n`;
					});
				} else {
					optionsText += '选项信息缺失\n';
				}

				return `第${index + 1}题：
题目：${mistake.question}
${optionsText}用户答案：${mistake.userAnswer}
正确答案：${mistake.correctAnswer}`;
			}).join('\n\n');

			try {
				// ✅ 使用后端代理调用（安全）
				// 使用 analyze action 进行错题分析
				const response = await lafService.proxyAI('analyze', {
					question: mistakeInfo,
					userAnswer: '见上文',
					correctAnswer: '见上文'
				});

				let reply = "抱歉，由于网络波动，导师暂时离开了。";

				if (response.code === 0 && response.data) {
					reply = response.data;
					console.log('[Chat] ✅ 错题分析成功');
				} else {
					console.warn('[Chat] 错题分析响应异常:', response.message);
				}

				this.messages.push({
					role: 'assistant',
					content: reply,
					time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
					showTime: true
				});
				this.scrollToBottom();
				this.isTyping = false;

			} catch (error) {
				this.isTyping = false;
				console.error('[Chat] ❌ 错题分析请求失败:', error);

				let errorMsg = 'AI 解析请求超时，请稍后重试...';
				if (error.message && error.message.includes('网络')) {
					errorMsg = '网络连接失败';
				}

				uni.showToast({
					title: errorMsg,
					icon: 'none',
					duration: 3000
				});
			}

			// 清空选择
			this.selectedMistakeIndexes = [];
		},

		handleKnowledgeQuery() {
			this.inputValue = "请解释一下";
			uni.showToast({ title: '请输入您的问题', icon: 'none' });
		},

		// --- Wise 风格 Markdown 解析器（简洁清晰）---
		renderMarkdown(text) {
			if (!text) return "";

			console.log('[Chat] 🎨 开始渲染 Markdown，内容长度:', text.length);

			// 根据深色模式动态设置颜色
			const textColor = this.isDark ? '#ffffff' : '#000000';
			const codeBlockBg = this.isDark ? '#2d4e1f' : '#F5F5F7';
			const codeBlockColor = this.isDark ? '#b0b0b0' : '#000000';
			const codeBlockBorder = this.isDark ? '#3d5e2f' : '#E5E5EA';
			const quoteBorder = this.isDark ? '#4CAF50' : '#4CAF50';
			const quoteBg = this.isDark ? '#1e3a0f' : '#F1F8F4';
			const inlineCodeBg = this.isDark ? '#2d4e1f' : '#F5F5F7';
			const inlineCodeBorder = this.isDark ? '#3d5e2f' : '#E5E5EA';

			// 策略：使用占位符保护代码块，然后处理其他格式
			const codeBlockPlaceholders = [];
			let placeholderIndex = 0;

			// 1. 先处理代码块，用占位符替换
			let processedText = text.replace(/```([\s\S]*?)```/g, (match, code) => {
				const placeholder = `__CODE_BLOCK_${placeholderIndex}__`;
				codeBlockPlaceholders[placeholderIndex] = `<div style="background:${codeBlockBg};color:${codeBlockColor};padding:16rpx 20rpx;border-radius:12rpx;font-family:monospace;margin:12rpx 0;font-size:26rpx;line-height:1.6;white-space:pre-wrap;border:1px solid ${codeBlockBorder};">${code}</div>`;
				placeholderIndex++;
				return placeholder;
			});

			console.log('[Chat] 📦 代码块数量:', placeholderIndex);

			// 2. 处理引用块（浅绿色主题）
			processedText = processedText.replace(/^> (.*$)/gim, `<div style="border-left:4rpx solid ${quoteBorder};padding-left:16rpx;color:${textColor};margin:12rpx 0;line-height:1.6;background:${quoteBg};">$1</div>`);

			// 3. 处理列表（按行处理）
			const lines = processedText.split('\n');
			let inOrderedList = false;
			let inUnorderedList = false;
			const processedLines = [];

			for (let i = 0; i < lines.length; i++) {
				let line = lines[i];
				let trimmedLine = line.trim();

				// 如果是代码块占位符，直接添加
				if (trimmedLine.startsWith('__CODE_BLOCK_') && trimmedLine.endsWith('__')) {
					if (inOrderedList) {
						processedLines.push('</ol>');
						inOrderedList = false;
					}
					if (inUnorderedList) {
						processedLines.push('</ul>');
						inUnorderedList = false;
					}
					const index = parseInt(trimmedLine.match(/\d+/)[0]);
					processedLines.push(codeBlockPlaceholders[index]);
					continue;
				}

				// 跳过空行
				if (!trimmedLine) {
					if (inOrderedList) {
						processedLines.push('</ol>');
						inOrderedList = false;
					}
					if (inUnorderedList) {
						processedLines.push('</ul>');
						inUnorderedList = false;
					}
					processedLines.push('<br/>');
					continue;
				}

				// 检查有序列表
				const orderedMatch = trimmedLine.match(/^(\d+)[\.\)]\s+(.+)$/);
				// 检查无序列表
				const unorderedMatch = trimmedLine.match(/^[-*]\s+(.+)$/);

				if (orderedMatch) {
					// 处理列表项内容中的粗体和行内代码
					let content = orderedMatch[2];
					content = content.replace(/\*\*(.*?)\*\*/g, `<strong style="font-weight:700;color:${textColor};background:transparent;">$1</strong>`);
					content = content.replace(/`([^`]+)`/g, `<span style="background:${inlineCodeBg};color:${codeBlockColor};padding:4rpx 8rpx;border-radius:6rpx;font-family:monospace;font-size:26rpx;border:1px solid ${inlineCodeBorder};">$1</span>`);

					if (!inOrderedList) {
						if (inUnorderedList) {
							processedLines.push('</ul>');
							inUnorderedList = false;
						}
						processedLines.push(`<ol style="margin:12rpx 0;padding-left:40rpx;list-style-type:decimal;color:${textColor};background:transparent;">`);
						inOrderedList = true;
						console.log('[Chat] 📋 开始有序列表');
					}
					processedLines.push(`<li style="margin:8rpx 0;line-height:1.8;color:${textColor};font-size:30rpx;list-style-position:outside;background:transparent;padding:4rpx 0;font-weight:400;">${content}</li>`);
				} else if (unorderedMatch) {
					// 处理列表项内容中的粗体和行内代码
					let content = unorderedMatch[1];
					content = content.replace(/\*\*(.*?)\*\*/g, `<strong style="font-weight:700;color:${textColor};background:transparent;">$1</strong>`);
					content = content.replace(/`([^`]+)`/g, `<span style="background:${inlineCodeBg};color:${codeBlockColor};padding:4rpx 8rpx;border-radius:6rpx;font-family:monospace;font-size:26rpx;border:1px solid ${inlineCodeBorder};">$1</span>`);

					if (!inUnorderedList) {
						if (inOrderedList) {
							processedLines.push('</ol>');
							inOrderedList = false;
						}
						processedLines.push(`<ul style="margin:12rpx 0;padding-left:40rpx;list-style-type:disc;color:${textColor};background:transparent;">`);
						inUnorderedList = true;
						console.log('[Chat] 📋 开始无序列表');
					}
					processedLines.push(`<li style="margin:8rpx 0;line-height:1.8;color:${textColor};font-size:30rpx;list-style-position:outside;background:transparent;padding:4rpx 0;font-weight:400;">${content}</li>`);
				} else {
					// 普通行
					if (inOrderedList) {
						processedLines.push('</ol>');
						inOrderedList = false;
					}
					if (inUnorderedList) {
						processedLines.push('</ul>');
						inUnorderedList = false;
					}

					// 处理普通行的格式
					let processedLine = trimmedLine
						.replace(/\*\*(.*?)\*\*/g, `<strong style="font-weight:700;color:${textColor};background:transparent;">$1</strong>`)
						.replace(/`([^`]+)`/g, `<span style="background:${inlineCodeBg};color:${codeBlockColor};padding:4rpx 8rpx;border-radius:6rpx;font-family:monospace;font-size:26rpx;border:1px solid ${inlineCodeBorder};">$1</span>`);

					processedLines.push(`<div style="line-height:1.8;color:${textColor};font-size:30rpx;margin:6rpx 0;background:transparent;font-weight:400;">${processedLine}</div>`);
				}
			}

			// 闭合未关闭的列表
			if (inOrderedList) {
				processedLines.push('</ol>');
				console.log('[Chat] 📋 闭合有序列表');
			}
			if (inUnorderedList) {
				processedLines.push('</ul>');
				console.log('[Chat] 📋 闭合无序列表');
			}

			// 合并所有处理后的行
			const result = processedLines.join('');
			console.log('[Chat] ✅ Markdown 渲染完成，HTML 长度:', result.length);
			return result;
		},

		async handleSend() {
			if (!this.inputValue.trim() || this.isTyping) return;

			const content = this.inputValue.trim();
			this.messages.push({
				role: 'user',
				content: content,
				time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
				showTime: false
			});
			this.inputValue = '';
			this.scrollToBottom();

			this.isTyping = true;
			console.log('[Chat] 发送消息:', content);

			try {
				// ✅ 使用后端代理调用（安全）
				// 注意：当前后端 chat 模式是单轮问答，只传当前问题
				const response = await lafService.proxyAI('chat', {
					content: content
				});

				let reply = "抱歉，由于网络波动，导师暂时离开了。";

				if (response.code === 0 && response.data) {
					reply = response.data;
					console.log('[Chat] ✅ AI 回复成功，内容长度:', reply.length);
					console.log('[Chat] 📝 AI 回复内容预览:', reply.substring(0, 150) + '...');

					// 检查回复中是否包含列表和粗体
					const hasList = /^[-*]\s+|^\d+[\.\)]\s+/m.test(reply);
					const hasBold = /\*\*.*?\*\*/.test(reply);
					console.log('[Chat] 🎨 Markdown 格式检测:', { hasList, hasBold });
				} else {
					console.warn('[Chat] AI响应异常:', response.message);
				}

				this.messages.push({
					role: 'assistant',
					content: reply,
					time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
					showTime: true
				});
				this.scrollToBottom();
				this.isTyping = false;

			} catch (error) {
				console.error('[Chat] ❌ 发送消息异常:', error);
				this.isTyping = false;

				// 详细的错误处理
				let errorMsg = 'AI 思考超时，请重试';

				if (error.message) {
					if (error.message.includes('timeout') || error.message.includes('超时')) {
						errorMsg = 'AI 解析请求超时，请稍后重试...';
					} else if (error.message.includes('网络') || error.message.includes('连接')) {
						errorMsg = '网络连接失败，请检查网络设置';
					}
				}

				console.log('[Chat] 📊 错误详情:', {
					message: errorMsg,
					originalError: error.message || error
				});

				uni.showToast({
					title: errorMsg,
					icon: 'none',
					duration: 3000
				});
			}
		},

		scrollToBottom() {
			this.$nextTick(() => {
				this.scrollId = 'msg-bottom';
			});
		},
		onFocus(e) { this.keyboardHeight = e.detail.height || 0; this.scrollToBottom(); },
		onBlur() { this.keyboardHeight = 0; },
		hideKeyboard() { uni.hideKeyboard(); },
		handleBack() { uni.navigateBack(); }
	}
};
</script>

<style scoped>
/* Wise 风格：基于 Wise Bright Green (#9FE870) 的浅色背景 */
.chat-container {
	height: 100vh;
	background-color: #F0F9ED;
	/* 基于 Wise Bright Green 的浅色背景 */
	display: flex;
	flex-direction: column;
}

/* 1. 导航栏 */
.custom-nav {
	height: auto;
	min-height: 44px;
	padding-top: calc(env(safe-area-inset-top) + 10px);
	padding-bottom: 10px;
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding-left: 20rpx;
	padding-right: 20rpx;
	background: rgba(255, 255, 255, 0.95);
	backdrop-filter: blur(20px);
	border-bottom: 0.5px solid #C6C6C8;
	z-index: 999;
}

/* 2. 功能按钮区域 */
.function-buttons {
	display: flex;
	padding: 16rpx;
	background: rgba(255, 255, 255, 0.8);
	backdrop-filter: blur(20px);
	border-bottom: 0.5px solid #C6C6C8;
	gap: 12rpx;
}

.function-btn {
	flex: 1;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	padding: 20rpx;
	background: white;
	border: 0.5px solid #C6C6C8;
	border-radius: 12rpx;
	box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.05);
	transition: all 0.3s ease;
	cursor: pointer;
}

.function-btn:active {
	transform: scale(0.98);
	box-shadow: 0 1rpx 4rpx rgba(0, 0, 0, 0.1);
}

.btn-icon {
	font-size: 48rpx;
	margin-bottom: 8rpx;
}

.btn-text {
	font-size: 24rpx;
	color: #000;
	font-weight: 500;
}

.nav-left {
	display: flex;
	align-items: center;
	color: #007AFF;
	font-size: 30rpx;
}

.back-arrow {
	font-size: 36rpx;
	margin-right: 4rpx;
}

.nav-center {
	display: flex;
	flex-direction: column;
	align-items: center;
	position: absolute;
	left: 50%;
	transform: translateX(-50%);
}

.nav-title {
	font-size: 32rpx;
	font-weight: 700;
	color: #000;
}

.nav-subtitle {
	font-size: 18rpx;
	color: #8E8E93;
	text-transform: uppercase;
	letter-spacing: 2rpx;
}

/* 2. 消息列表 - 基于 Wise Bright Green 的浅色背景 */
.chat-body {
	flex: 1;
	background-color: #F0F9ED;
	/* 基于 Wise Bright Green 的浅色背景 */
}

.message-list {
	padding: 24rpx 20rpx;
}

.message-row {
	display: flex;
	margin-bottom: 24rpx;
	align-items: flex-end;
}

.user {
	flex-direction: row-reverse;
}

.avatar-box {
	width: 64rpx;
	height: 64rpx;
	margin-right: 16rpx;
	margin-bottom: 10rpx;
	flex-shrink: 0;
}

.ai-avatar {
	width: 64rpx;
	height: 64rpx;
	background: linear-gradient(135deg, #667EEA 0%, #764BA2 100%);
	border-radius: 50%;
	display: flex;
	align-items: center;
	justify-content: center;
	box-shadow: 0 4rpx 16rpx rgba(102, 126, 234, 0.4);
	position: relative;
	overflow: hidden;
}

.ai-avatar::before {
	content: '';
	position: absolute;
	top: -50%;
	left: -50%;
	width: 200%;
	height: 200%;
	background: radial-gradient(circle, rgba(255, 255, 255, 0.3) 0%, transparent 70%);
	animation: shine 3s ease-in-out infinite;
}

@keyframes shine {

	0%,
	100% {
		transform: rotate(0deg);
		opacity: 0;
	}

	50% {
		transform: rotate(180deg);
		opacity: 0.5;
	}
}

.ai-icon {
	font-size: 36rpx;
	position: relative;
	z-index: 1;
	filter: drop-shadow(0 2rpx 4rpx rgba(0, 0, 0, 0.2));
}

.bubble-wrapper {
	max-width: 72%;
	display: flex;
	flex-direction: column;
}

.user .bubble-wrapper {
	align-items: flex-end;
}

/* Wise 风格气泡 UI - 简洁清晰 */
.bubble {
	padding: 24rpx 32rpx;
	font-size: 30rpx;
	line-height: 1.7;
	position: relative;
	word-wrap: break-word;
	word-break: break-word;
}

/* Assistant 气泡：白色背景，深色文字，清晰可见 */
.assistant .bubble {
	background-color: #FFFFFF;
	/* 白色背景 */
	color: #000000;
	/* 深色文字（纯黑，确保在白色背景上清晰可见） */
	border-radius: 20rpx 20rpx 20rpx 6rpx;
	border: 1px solid #E0E0E0;
	/* 浅灰色边框，确保在浅绿背景上可见 */
	box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.08);
	/* 增强阴影，确保气泡突出 */
}

/* 确保 rich-text 中的内容清晰可见 - 通过内联样式已处理 */
/* Assistant 尖角 - 白色背景，浅灰边框 */
.assistant .bubble::after {
	content: "";
	position: absolute;
	left: -8rpx;
	bottom: 12rpx;
	width: 16rpx;
	height: 16rpx;
	background-color: #FFFFFF;
	/* 白色背景 */
	border-left: 1px solid #E0E0E0;
	/* 浅灰边框 */
	border-bottom: 1px solid #E0E0E0;
	/* 浅灰边框 */
	transform: rotate(45deg);
}

/* User 气泡：Wise 风格 - 蓝色背景，白色文字 */
.user .bubble {
	background: #007AFF;
	color: #FFFFFF;
	border-radius: 20rpx 20rpx 6rpx 20rpx;
	box-shadow: 0 2rpx 8rpx rgba(0, 122, 255, 0.2);
}

/* User 尖角 - Wise 风格 */
.user .bubble::after {
	content: "";
	position: absolute;
	right: -8rpx;
	bottom: 12rpx;
	width: 16rpx;
	height: 16rpx;
	background: #007AFF;
	transform: rotate(45deg);
}

.time-stamp {
	font-size: 22rpx;
	color: #8E8E93;
	margin-top: 8rpx;
	margin-left: 12rpx;
	font-weight: 400;
}

.user .time-stamp {
	margin-right: 12rpx;
	margin-left: 0;
}

/* 3. 输入栏 - Wise 风格 */
.input-area-wrapper {
	position: fixed;
	width: 100%;
	background: rgba(255, 255, 255, 0.98);
	backdrop-filter: blur(20px);
	border-top: 1px solid #E5E5EA;
	padding: 16rpx 20rpx calc(env(safe-area-inset-bottom) + 16rpx);
	transition: all 0.2s;
	box-shadow: 0 -2rpx 8rpx rgba(0, 0, 0, 0.04);
}

.input-bar {
	display: flex;
	align-items: flex-end;
	gap: 12rpx;
}

.input-inner {
	flex: 1;
	background: #F5F5F7;
	border-radius: 24rpx;
	padding: 14rpx 20rpx;
	border: 1px solid #E5E5EA;
}

.input-inner textarea {
	width: 100%;
	font-size: 30rpx;
	min-height: 44rpx;
	max-height: 200rpx;
	color: #1C1C1E;
	line-height: 1.5;
}

/* 发送按钮 - Wise 风格 */
.send-btn {
	width: 64rpx;
	height: 64rpx;
	background: #E5E5EA;
	border-radius: 50%;
	display: flex;
	align-items: center;
	justify-content: center;
	transition: all 0.3s ease;
	flex-shrink: 0;
}

.send-btn.can-send {
	background: #007AFF;
	transform: scale(1.05);
	box-shadow: 0 4rpx 12rpx rgba(0, 122, 255, 0.3);
}

.up-icon {
	color: #FFFFFF;
	font-size: 36rpx;
	font-weight: 600;
}

.send-btn:not(.can-send) .up-icon {
	color: #8E8E93;
}

/* Typing 动效 - 白色背景，浅灰边框 */
.typing-bubble {
	width: 100rpx;
	display: flex;
	justify-content: space-around;
	align-items: center;
	padding: 24rpx 28rpx;
	background-color: #FFFFFF;
	/* 白色背景 */
	border: 1px solid #E0E0E0;
	/* 浅灰边框 */
	border-radius: 20rpx 20rpx 20rpx 6rpx;
	box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.08);
	/* 增强阴影 */
}

.dot-jump {
	width: 10rpx;
	height: 10rpx;
	background: #8E8E93;
	border-radius: 50%;
	animation: jump 0.6s infinite alternate ease-in-out;
}

.dot-jump:nth-child(2) {
	animation-delay: 0.2s;
}

.dot-jump:nth-child(3) {
	animation-delay: 0.4s;
}

@keyframes jump {
	from {
		transform: translateY(0);
		opacity: 0.5;
	}

	to {
		transform: translateY(-8rpx);
		opacity: 1;
	}
}

/* Dark Mode Styles */
.chat-container.dark-mode {
	background-color: #163300;
}

.chat-container.dark-mode .custom-nav {
	background: rgba(22, 51, 0, 0.95);
	border-bottom-color: #2d4e1f;
}

.chat-container.dark-mode .nav-title {
	color: #ffffff;
}

.chat-container.dark-mode .nav-subtitle {
	color: #8899a6;
}

.chat-container.dark-mode .function-buttons {
	background: rgba(22, 51, 0, 0.8);
	border-bottom-color: #2d4e1f;
}

.chat-container.dark-mode .function-btn {
	background: #1e3a0f;
	border-color: #2d4e1f;
	box-shadow: none;
}

.chat-container.dark-mode .btn-text {
	color: #b0b0b0;
}

.chat-container.dark-mode .assistant .bubble {
	background-color: #1e3a0f;
	color: #ffffff;
}

.chat-container.dark-mode .assistant .bubble::after {
	background-color: #1e3a0f;
}

.chat-container.dark-mode .input-area-wrapper {
	background: rgba(22, 51, 0, 0.94);
	border-top-color: #2d4e1f;
}

.chat-container.dark-mode .input-inner {
	background: #1e3a0f;
	border-color: #2d4e1f;
}

.chat-container.dark-mode .input-inner textarea {
	color: #ffffff;
}

.chat-container.dark-mode .send-btn {
	background: #2d4e1f;
}

.chat-container.dark-mode .send-btn.can-send {
	background: #007AFF;
}

/* 选择错题弹窗 */
.mistake-select-modal {
	position: fixed;
	top: 0;
	left: 0;
	width: 100%;
	height: 100%;
	z-index: 10000;
	display: flex;
	align-items: center;
	justify-content: center;
	animation: fadeIn 0.3s ease-in-out;
}

.modal-bg {
	position: absolute;
	top: 0;
	left: 0;
	width: 100%;
	height: 100%;
	background: rgba(0, 0, 0, 0.7);
	backdrop-filter: blur(8px);
	z-index: 1;
}

.modal-content-select {
	position: relative;
	width: 90%;
	max-width: 700rpx;
	max-height: 80vh;
	background: #FFFFFF;
	border-radius: 30rpx;
	display: flex;
	flex-direction: column;
	z-index: 2;
	box-shadow: 0 20rpx 60rpx rgba(0, 0, 0, 0.3);
	overflow: hidden;
}

.modal-header-select {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 30rpx 40rpx;
	border-bottom: 1rpx solid #F0F0F0;
}

.modal-title-select {
	font-size: 36rpx;
	font-weight: bold;
	color: #333;
}

.modal-close-select {
	width: 60rpx;
	height: 60rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	border-radius: 50%;
	background: #F5F5F5;
	transition: all 0.2s;
}

.modal-close-select:active {
	background: #E0E0E0;
	transform: scale(0.95);
}

.modal-close-icon-select {
	font-size: 40rpx;
	color: #666;
	line-height: 1;
	font-weight: 300;
}

.modal-scroll-select {
	flex: 1;
	overflow-y: auto;
	padding: 20rpx;
	background: #FAFAFA;
}

.mistake-item-select {
	display: flex;
	align-items: center;
	padding: 24rpx;
	margin-bottom: 16rpx;
	background: #FFFFFF;
	border-radius: 20rpx;
	border: 2rpx solid #E0E0E0;
	transition: all 0.2s;
}

.mistake-item-select.selected {
	border-color: #007AFF;
	background: #F0F8FF;
}

.select-checkbox {
	width: 48rpx;
	height: 48rpx;
	border-radius: 50%;
	border: 2rpx solid #C0C0C0;
	display: flex;
	align-items: center;
	justify-content: center;
	margin-right: 20rpx;
	flex-shrink: 0;
	transition: all 0.2s;
}

.mistake-item-select.selected .select-checkbox {
	background: #007AFF;
	border-color: #007AFF;
}

.checkbox-icon {
	color: #FFFFFF;
	font-size: 28rpx;
	font-weight: bold;
}

.mistake-content-select {
	flex: 1;
	display: flex;
	flex-direction: column;
}

.mistake-category-select {
	font-size: 22rpx;
	color: #999;
	margin-bottom: 8rpx;
}

.mistake-question-select {
	font-size: 28rpx;
	color: #333;
	line-height: 1.5;
}

.modal-footer-select {
	display: flex;
	gap: 20rpx;
	padding: 30rpx 40rpx;
	border-top: 1rpx solid #F0F0F0;
	background: #FFFFFF;
}

.modal-btn-select {
	flex: 1;
	height: 88rpx;
	line-height: 88rpx;
	border-radius: 44rpx;
	font-size: 32rpx;
	font-weight: bold;
	border: none;
}

.modal-btn-select.secondary {
	background: #F5F5F5;
	color: #333;
}

.modal-btn-select.primary {
	background: #007AFF;
	color: #FFF;
}

.modal-btn-select[disabled] {
	opacity: 0.5;
}

.modal-btn-select::after {
	border: none;
}
</style>
