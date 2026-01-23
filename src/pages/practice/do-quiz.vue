<template>
	<view :class="['container', { 'dark-mode': isDark }]">
		<view class="aurora-bg"></view>

		<view class="nav-header" :style="{ paddingTop: statusBarHeight + 'px', height: navBarHeight + 'px' }">
			<view class="nav-content" :style="{ paddingRight: capsuleMargin + 'px', height: '44px' }">
				<view class="back-area" @tap="handleExit">
					<text class="back-icon">←</text>
					<text class="progress-text">{{ currentIndex + 1 }} / {{ questions.length }}</text>
				</view>
				<view class="timer-box">
					<text class="timer-icon">⏱</text>
					<text>{{ formatTime(seconds) }}</text>
				</view>
			</view>
		</view>

		<scroll-view scroll-y class="quiz-scroll" :style="{ paddingTop: navBarHeight + 'px' }">
			<view class="question-container" v-if="currentQuestion">
				<view class="glass-card question-card" v-if="currentQuestion">
					<view class="q-tag">{{ currentQuestion.type || '单选题' }}</view>
					<text class="q-content">{{ currentQuestion.question }}</text>
				</view>

				<view class="options-list" v-if="currentQuestion && currentQuestion.options">
					<view 
						v-for="(opt, idx) in currentQuestion.options" 
						:key="idx"
						:class="['glass-card', 'option-item', { 
							'selected': userChoice === idx, 
							'correct': hasAnswered && isCorrectOption(idx), 
							'wrong': hasAnswered && userChoice === idx && !isCorrectOption(idx), 
							'disabled': isAnalyzing || (hasAnswered && userChoice !== idx) 
						}]"
						@tap="selectOption(idx)"
					>
						<view class="opt-index">{{ getOptionLabel(idx) }}</view>
						<text class="opt-text">{{ opt }}</text>
						<view class="select-indicator" v-if="hasAnswered">
							<text v-if="isCorrectOption(idx)">✓</text>
							<text v-else-if="userChoice === idx && !isCorrectOption(idx)">✗</text>
							<text v-else-if="userChoice === idx">○</text>
						</view>
					</view>
				</view>
			</view>

			<!-- AI Loading 状态 -->
			<base-loading 
				v-if="isAnalyzing" 
				:text="'AI 正在深度解析逻辑...'"
				:is-dark="isDark"
			/>
			
			<!-- AI 反馈图层动画 -->
			<view class="ai-feedback-layer" v-if="isAnalyzing">
				<view class="scan-line"></view>
				<view class="thinking-box">
					<view class="pulse-ring"></view>
					<text class="ai-text">AI 正在深度解析逻辑...</text>
				</view>
			</view>

			<!-- 结果弹窗 -->
			<view :class="['result-pop', resultStatus]" v-if="showResult" @tap.stop>
				<view class="result-header" @tap.stop>
					<!-- 左侧图标作为关闭按钮 -->
					<view class="result-icon-btn" @tap.stop="closeResult">
						<text class="result-icon">{{ resultStatus === 'correct' ? '✓' : '✗' }}</text>
					</view>
					<text class="status-title">{{ resultStatus === 'correct' ? 'PASS' : 'LOGIC ERROR' }}</text>
				</view>
				
				<scroll-view scroll-y class="ai-analysis-scroll" v-if="resultStatus === 'wrong'">
					<view class="analysis-tag">
						<text class="sparkle-icon">✨</text>
						<text>AI 深度诊断</text>
					</view>
					<view class="answer-display">
						<text class="answer-label">正确答案：</text>
						<text class="answer-value">{{ currentQuestion ? currentQuestion.answer : 'A' }}</text>
					</view>
					<text class="analysis-body">{{ aiComment || (currentQuestion ? currentQuestion.desc : '暂无解析') }}</text>
				</scroll-view>
				
				<view class="ai-analysis-brief" v-else>
					<text class="label">AI 简评：</text>
					<text>{{ aiComment || (currentQuestion ? currentQuestion.desc : '暂无解析') }}</text>
				</view>
				
				<button class="next-btn" @tap="toNext">{{ resultStatus === 'correct' ? '进入下一题' : '继续挑战' }}</button>
			</view>
			
			<view class="footer-placeholder"></view>
		</scroll-view>
	</view>
</template>

<script>
import { lafService } from '../../services/lafService.js'
import { storageService } from '../../services/storageService.js'
import BaseLoading from '../../components/base-loading/base-loading.vue'

export default {
	components: {
		BaseLoading
	},
		data() {
		return {
			statusBarHeight: 44,
			navBarHeight: 88, // 标准导航栏高度 = 44 + 44
			capsuleMargin: 100,
			isDark: false,
			questions: [],
			currentIndex: 0,
			userChoice: null,
			hasAnswered: false,
			seconds: 0,
			timer: null,
			isAnalyzing: false,
			showResult: false,
			resultStatus: '', // 'correct' or 'wrong'
			aiComment: '',
		};
	},
	computed: {
		currentQuestion() {
			const q = this.questions[this.currentIndex];
			if (!q) return null;
			
			// 确保数据格式完整
			return {
				id: q.id || `q_${this.currentIndex}`,
				question: q.question || q.title || '题目加载中...',
				options: Array.isArray(q.options) ? q.options : [],
				answer: (q.answer || 'A').toString().toUpperCase().charAt(0),
				desc: q.desc || q.description || q.analysis || '暂无解析',
				category: q.category || '未分类',
				type: q.type || '单选'
			};
		},
		isCorrectOption() {
			return (idx) => {
				if (!this.currentQuestion) return false;
				const correctAnswer = this.currentQuestion.answer;
				const optionLabel = this.getOptionLabel(idx);
				
				// 支持 answer 为 'A'/'B'/'C'/'D'
				if (['A', 'B', 'C', 'D'].includes(correctAnswer)) {
					const isMatch = optionLabel === correctAnswer;
					console.log('[do-quiz] 答案匹配:', { optionLabel, correctAnswer, isMatch });
					return isMatch;
				}
				
				// 兼容选项内容匹配（如果answer不是A/B/C/D，可能是选项内容）
				const optionText = this.currentQuestion.options[idx] || '';
				const isMatch = optionText.startsWith(correctAnswer) || optionText.includes(correctAnswer);
				console.log('[do-quiz] 选项内容匹配:', { optionText, correctAnswer, isMatch });
				return isMatch;
			};
		}
	},
	onLoad() {
		this.initSystemUI();
		this.loadQuestions();
		this.startTimer();
	},
	onShow() {
		// 每次进入页面时同步主题
		this.isDark = storageService.get('theme_mode', 'light') === 'dark';
		
		// 监听全局主题切换事件，确保跟随应用设置实时切换
		uni.$on('themeUpdate', (mode) => {
			this.isDark = mode === 'dark';
		});
	},
	onUnload() {
		if (this.timer) {
			clearInterval(this.timer);
		}
		// 移除主题事件监听，避免重复绑定
		uni.$off('themeUpdate');
	},
	methods: {
		initSystemUI() {
			const sys = uni.getSystemInfoSync();
			// 统一计算：状态栏高度
			this.statusBarHeight = sys.statusBarHeight || sys.safeAreaInsets?.top || 44;
			// 标准导航栏高度 = 状态栏高度 + 44px
			this.navBarHeight = this.statusBarHeight + 44;
			
			// #ifdef MP-WECHAT
			try {
				const capsule = uni.getMenuButtonBoundingClientRect();
				if (capsule && capsule.width > 0) {
					const windowWidth = sys.windowWidth || sys.screenWidth;
					this.capsuleMargin = windowWidth - capsule.left + 10;
				} else {
					this.capsuleMargin = 100;
				}
			} catch (e) {
				console.log('获取胶囊按钮信息失败', e);
				this.capsuleMargin = 100;
			}
			// #endif
			// #ifndef MP-WECHAT
			this.capsuleMargin = 20;
			// #endif
			
			// 读取主题模式
			this.isDark = storageService.get('theme_mode', 'light') === 'dark';
		},
		loadQuestions() {
			// 从本地存储读取题库
			const bank = storageService.get('v30_bank', []);
			
			if (!bank || bank.length === 0) {
				uni.showModal({
					title: '题库空空如也',
					content: '请先去资料库导入学习资料，AI 将为您生成专属题目。',
					showCancel: false,
					confirmText: '去导入',
					success: (res) => {
						if (res.confirm) {
							uni.navigateTo({ 
								url: '/src/pages/practice/import-data',
								fail: () => {
									uni.navigateBack();
								}
							});
						} else {
							uni.navigateBack();
						}
					}
				});
				return;
			}
			
			// 验证并标准化题目数据
			this.questions = bank.map((q, index) => ({
				id: q.id || `q_${index}`,
				question: q.question || q.title || `题目 ${index + 1}`,
				options: Array.isArray(q.options) && q.options.length >= 4 ? q.options : [
					'A. 选项A',
					'B. 选项B',
					'C. 选项C',
					'D. 选项D'
				],
				answer: (q.answer || 'A').toString().toUpperCase().charAt(0),
				desc: q.desc || q.description || q.analysis || '暂无解析',
				category: q.category || '未分类',
				type: q.type || '单选'
			})).filter(q => q.question && q.question !== `题目 ${bank.indexOf(q) + 1}`); // 过滤无效题目
			
			if (this.questions.length === 0) {
				uni.showModal({
					title: '数据格式异常',
					content: '题库数据格式不正确，请重新导入资料',
					showCancel: false,
					success: () => {
						uni.navigateTo({ url: '/src/pages/practice/import-data' });
					}
				});
			}
		},
		// 从选项文本中提取标签（如 "A. 选项内容" -> "A"）
		getOptionLabel(idx) {
			if (!this.currentQuestion || !this.currentQuestion.options) return '';
			const option = this.currentQuestion.options[idx] || '';
			// 提取第一个字母作为标签
			const match = option.match(/^([A-D])\./);
			if (match) {
				return match[1].toUpperCase();
			}
			// 如果没有 "A." 格式，使用索引对应
			return ['A', 'B', 'C', 'D'][idx] || 'A';
		},
		startTimer() {
			this.timer = setInterval(() => { 
				this.seconds++; 
			}, 1000);
		},
		formatTime(s) {
			const m = Math.floor(s / 60);
			const rs = s % 60;
			return `${m < 10 ? '0' + m : m}:${rs < 10 ? '0' + rs : rs}`;
		},
		async selectOption(idx) {
			if (this.isAnalyzing || this.showResult || this.hasAnswered) return;
			
			this.userChoice = idx;
			
			// 震动反馈
			try {
				if (typeof uni.vibrateShort === 'function') {
					uni.vibrateShort();
				}
			} catch(e) {}
			
			const isCorrect = this.isCorrectOption(idx);
			this.resultStatus = isCorrect ? 'correct' : 'wrong';
			this.hasAnswered = true;
			
			// 添加调试日志
			console.log('[do-quiz] 答案判断:', {
				selectedIndex: idx,
				selectedLabel: this.getOptionLabel(idx),
				correctAnswer: this.currentQuestion.answer,
				isCorrect: isCorrect
			});
			
			if (isCorrect) {
				// 正确时：显示预设鼓励语并直接展示结果
				// ⚠️ 重要：答对题目不保存到错题本
				this.aiComment = "精彩！你的知识储备非常扎实，思路清晰，精准命中了考点关键。继续保持这种分析能力！";
				this.showResult = true;
				this.updateStudyStats();
				
				// 震动反馈
				try {
					if (typeof uni.vibrateShort === 'function') {
						uni.vibrateShort();
					}
				} catch(e) {}
			} else {
				// 错误时：先保存到错题本（不含 AI 解析）
				this.saveToMistakes();
				// 然后触发 AI 深度解析（会自动更新错题本中的 AI 解析字段）
				await this.fetchAIDeepAnalysis(this.currentQuestion, this.currentQuestion.options[idx]);
				this.updateStudyStats();
				this.showResult = true;
			}
		},
		async fetchAIDeepAnalysis(question, userChoice) {
			// 开启扫描线动画
			this.isAnalyzing = true;
			this.aiComment = "AI 导师正在审阅您的逻辑...";
			
			// 准备数据：提供完整的题目背景、选项、正确答案及用户的错误选择
			const questionText = question.question || question.title || '';
			const options = question.options || [];
			const correctAnswer = question.answer || '';
			const userAnswer = userChoice || '';

			try {
				// ✅ 使用后端代理调用（安全）- action: 'analyze'
				// 后端会自动添加 "你是一位专业的考研辅导专家..." 的 Prompt
				const response = await lafService.proxyAI('analyze', {
					question: questionText,
					options: options,
					userAnswer: userAnswer,
					correctAnswer: correctAnswer
				});

				// 处理响应
				if (response.code === 0 && response.data) {
					this.aiComment = response.data.trim();
					// 将 AI 解析同步保存到错题本
					this.updateMistakeWithAI(this.aiComment);
				} else {
					// API 返回错误
					console.warn('[do-quiz] AI 解析返回异常:', response.message);
					this.aiComment = "AI 解析暂时不可用，请结合参考答案进行复习。建议重新审视题干与选项的对应关系，查找知识点薄弱环节。";
					this.saveToMistakes();
				}
			} catch (e) {
				console.warn('[do-quiz] AI 解析请求失败，降级到本地解析:', e);
				
				// 根据错误类型提供更详细的提示
				let fallbackComment = "网络连接中断，AI 导师未能成功接入。建议重新审视题干与选项的对应关系，查看解析加深理解。";
				if (e.message && e.message.includes('timeout')) {
					fallbackComment = "AI 解析请求超时，请稍后重试。建议先查看题目解析，理解知识点。";
				} else if (e.message && e.message.includes('401')) {
					fallbackComment = "AI 服务配置异常，请联系管理员。建议先查看题目解析，理解知识点。";
				} else if (e.message && (e.message.includes('网络') || e.message.includes('fail'))) {
					fallbackComment = "网络连接中断，AI 导师未能成功接入。建议重新审视题干与选项的对应关系，查看解析加深理解。";
				}
				
				this.aiComment = fallbackComment;
				console.log('[do-quiz] ✅ 已使用降级文案，错题将保存到本地');
				this.saveToMistakes();
			} finally {
				this.isAnalyzing = false; // 关闭扫描动画
				
				// 震动反馈
				try {
					if (typeof uni.vibrateShort === 'function') {
						uni.vibrateShort();
					}
				} catch(e) {}
			}
		},
		async saveToMistakes() {
			// 将错题存入云端错题本（自动云端+本地同步）
			if (!this.currentQuestion) return;
			
			const questionText = this.currentQuestion.question || this.currentQuestion.title;
			const userAnswer = this.currentQuestion.options && this.currentQuestion.options[this.userChoice] 
				? String.fromCharCode(65 + this.userChoice) // A, B, C, D
				: '';
			const correctAnswer = this.currentQuestion.answer || '';
			
			// 检查是否已存在（先查本地缓存）
			const localMistakes = storageService.get('mistake_book', []);
			const existingMistake = localMistakes.find(m => 
				(m.question === questionText || m.question_content === questionText) || 
				(m.id && m.id === this.currentQuestion.id) ||
				(m._id && m._id === this.currentQuestion.id)
			);
			
			// 构建符合 Schema 的数据格式
			const mistakeData = {
				question_content: questionText,
				options: this.currentQuestion.options || [],
				user_answer: userAnswer,
				correct_answer: correctAnswer,
				analysis: this.aiComment || this.currentQuestion.desc || '',
				tags: this.currentQuestion.tags || [],
				wrong_count: existingMistake ? (existingMistake.wrong_count || existingMistake.wrongCount || 1) + 1 : 1,
				is_mastered: false
			};
			
			try {
				// 使用云端方法保存（自动云端+本地同步）
				const result = await storageService.saveMistake(mistakeData);
				
				if (result.success) {
					console.log('[do-quiz] 错题已保存到云端:', result.id);
					// 如果需要更新已有记录的错误次数，可以在这里处理
					if (existingMistake && result.source === 'cloud') {
						// 云端保存成功，更新本地缓存中的错误次数
						const updatedMistakes = storageService.get('mistake_book', []);
						const index = updatedMistakes.findIndex(m => 
							m.id === result.id || m._id === result.id
						);
						if (index >= 0) {
							updatedMistakes[index].wrong_count = mistakeData.wrong_count;
							storageService.save('mistake_book', updatedMistakes, true);
						}
					}
				} else {
					console.warn('[do-quiz] 错题保存失败，已降级到本地:', result.error);
				}
			} catch (error) {
				console.warn('[do-quiz] 保存错题异常，降级到本地存储:', error);
				// 异常时降级到本地保存
				const mistakes = storageService.get('mistake_book', []);
				const mistakeRecord = {
					...this.currentQuestion,
					question: questionText,
					question_content: questionText,
					userChoice: userAnswer,
					user_answer: userAnswer,
					answer: correctAnswer,
					correct_answer: correctAnswer,
					desc: this.aiComment || this.currentQuestion.desc || '',
					analysis: this.aiComment || this.currentQuestion.desc || '',
					addTime: new Date().toLocaleString(),
					timestamp: Date.now(),
					wrongCount: existingMistake ? (existingMistake.wrongCount || 1) + 1 : 1,
					wrong_count: existingMistake ? (existingMistake.wrong_count || existingMistake.wrongCount || 1) + 1 : 1,
					isMastered: false,
					is_mastered: false,
					sync_status: 'pending'
				};
				
				if (existingMistake) {
					const index = mistakes.findIndex(m => 
						(m.question === questionText || m.question_content === questionText) || 
						(m.id && m.id === this.currentQuestion.id)
					);
					if (index >= 0) {
						mistakes[index] = { ...mistakes[index], ...mistakeRecord };
					} else {
						mistakes.unshift(mistakeRecord);
					}
				} else {
					mistakes.unshift(mistakeRecord);
				}
				
				storageService.save('mistake_book', mistakes, true);
				console.log('[do-quiz] ✅ 已降级到本地保存，sync_status: pending');
			}
		},
		async updateMistakeWithAI(aiAnalysis) {
			// 将 AI 解析更新到错题本中的对应记录
			const mistakes = storageService.get('mistake_book', []);
			const questionText = this.currentQuestion.question || this.currentQuestion.title;
			
			const mistakeIndex = mistakes.findIndex(m => 
				(m.question === questionText || m.question_content === questionText) || 
				(m.id && m.id === this.currentQuestion.id) ||
				(m._id && m._id === this.currentQuestion.id)
			);
			
			if (mistakeIndex >= 0) {
				const mistake = mistakes[mistakeIndex];
				mistake.aiAnalysis = aiAnalysis;
				mistake.analysis = aiAnalysis; // 同时更新新字段
				mistake.hasAIAnalysis = true;
				
				// 如果有云端ID，尝试更新到云端
				const mistakeId = mistake.id || mistake._id;
				if (mistakeId && mistakeId.toString().startsWith('local_') === false) {
					// 云端记录，可以尝试更新（但云端没有单独的更新analysis方法，先更新本地）
					// 注意：如果需要更新云端，可以扩展云对象方法
				}
				
				// 更新本地缓存
				storageService.save('mistake_book', mistakes, true);
			}
		},
		updateStudyStats() {
			// 更新学习热力图数据
			const today = new Date().toISOString().split('T')[0];
			const stats = storageService.get('study_stats', {});
			stats[today] = (stats[today] || 0) + 1;
			storageService.save('study_stats', stats);
		},
		toNext() {
			// 重置状态
			this.showResult = false;
			this.isAnalyzing = false;
			
			if (this.currentIndex < this.questions.length - 1) {
				this.currentIndex++;
				this.hasAnswered = false;
				this.userChoice = null;
				this.showResult = false;
				this.aiComment = '';
				
				// 震动反馈
				try {
					if (typeof uni.vibrateShort === 'function') {
						uni.vibrateShort();
					}
				} catch(e) {}
			} else {
				// 练习完成
				uni.showModal({
					title: '🎉 练习完成',
					content: `本次共完成 ${this.questions.length} 道题目！`,
					showCancel: false,
					confirmText: '返回',
					success: () => {
						uni.navigateBack();
					}
				});
			}
		},
		handleExit() {
			uni.showModal({
				title: '确认退出？',
				content: '当前进度将自动保存。',
				success: (res) => { 
					if (res.confirm) {
						if (this.timer) {
							clearInterval(this.timer);
						}
						uni.navigateBack();
					}
				}
			});
		},
		closeResult() {
			// 关闭结果弹窗，但不进入下一题
			this.showResult = false;
			this.hasAnswered = false;
			this.userChoice = null;
			this.aiComment = '';
			this.isAnalyzing = false;
		}
	}
};
</script>

<style>
/* 容器样式 */
.container { 
	min-height: 100vh; 
	background: #F8FAFC; 
	position: relative; 
	overflow: hidden; 
}
.container.dark-mode { 
	background: #163300; 
	color: #FFF; 
}

/* 极光背景 */
.aurora-bg {
	position: absolute; 
	top: 0; 
	left: 0; 
	width: 100%; 
	height: 600rpx;
	background: radial-gradient(circle at 20% 20%, rgba(46, 204, 113, 0.15), transparent 50%),
	            radial-gradient(circle at 80% 0%, rgba(74, 144, 226, 0.15), transparent 50%);
	filter: blur(60px);
	z-index: 0;
}

/* 导航栏 */
.nav-header { 
	position: fixed; 
	top: 0; 
	width: 100%; 
	z-index: 100; 
	background: rgba(255,255,255,0.1); 
	backdrop-filter: blur(20px);
	-webkit-backdrop-filter: blur(20px);
}
.nav-content { 
	height: 50px; 
	display: flex; 
	align-items: center; 
	justify-content: space-between; 
	padding: 0 30rpx; 
}
.back-area { 
	display: flex; 
	align-items: center; 
	gap: 10rpx; 
}
.back-icon {
	font-size: 36rpx;
	color: #333;
	font-weight: bold;
}
.progress-text { 
	font-size: 28rpx; 
	font-weight: bold; 
	color: #333; 
}
.timer-box { 
	font-size: 24rpx; 
	color: #666; 
	background: rgba(0,0,0,0.05); 
	padding: 4rpx 20rpx; 
	border-radius: 20rpx;
	display: flex;
	align-items: center;
	gap: 8rpx;
}
.timer-icon {
	font-size: 24rpx;
}

/* 滚动区域 */
.quiz-scroll { 
	height: 100vh; 
	padding: 0 30rpx; 
	box-sizing: border-box; 
	position: relative;
	z-index: 1;
}

/* 玻璃卡片通用样式 */
.glass-card {
	background: rgba(255, 255, 255, 0.8); 
	backdrop-filter: blur(20px);
	-webkit-backdrop-filter: blur(20px);
	border: 1px solid rgba(255, 255, 255, 0.5); 
	border-radius: 40rpx;
	padding: 40rpx; 
	margin-bottom: 30rpx;
	box-shadow: 0 8px 32px rgba(31, 38, 135, 0.05);
}

/* 题目卡片 */
.question-card .q-tag { 
	display: inline-block; 
	background: #2ECC71; 
	color: #FFF; 
	font-size: 20rpx; 
	padding: 4rpx 16rpx; 
	border-radius: 10rpx; 
	margin-bottom: 20rpx; 
}
.question-card .q-content { 
	font-size: 34rpx; 
	font-weight: bold; 
	line-height: 1.6; 
	color: #1A1A1A; 
	display: block;
}

/* 选项列表 */
.options-list {
	margin-top: 20rpx;
}
.option-item { 
	display: flex; 
	align-items: center; 
	padding: 30rpx 40rpx; 
	transition: all 0.2s; 
	position: relative;
	cursor: pointer;
}
.option-item.selected { 
	border-color: #2ECC71; 
	background: rgba(46, 204, 113, 0.1); 
}
.option-item.correct {
	border-color: #2ECC71;
	background: rgba(46, 204, 113, 0.15);
}
.option-item.wrong {
	border-color: #E74C3C;
	background: rgba(231, 76, 60, 0.1);
}
.option-item.disabled {
	opacity: 0.5;
	pointer-events: none;
}
.opt-index { 
	width: 50rpx; 
	font-weight: 900; 
	color: #2ECC71; 
	font-size: 32rpx;
	flex-shrink: 0;
}
.opt-text { 
	flex: 1; 
	font-size: 30rpx; 
	color: #4A5568; 
	line-height: 1.5;
}
.select-indicator { 
	width: 40rpx; 
	height: 40rpx; 
	display: flex;
	align-items: center;
	justify-content: center;
	font-size: 32rpx;
	color: #2ECC71;
	flex-shrink: 0;
}

/* AI 反馈图层动画 */
.ai-feedback-layer {
	position: fixed; 
	top: 0; 
	left: 0; 
	width: 100%; 
	height: 100%;
	z-index: 200; 
	background: rgba(255,255,255,0.2); 
	backdrop-filter: blur(10px);
	-webkit-backdrop-filter: blur(10px);
	display: flex; 
	flex-direction: column; 
	align-items: center; 
	justify-content: center;
}
.scan-line {
	position: absolute; 
	top: 0; 
	left: 0; 
	width: 100%; 
	height: 6rpx;
	background: linear-gradient(90deg, transparent, #2ECC71, transparent);
	animation: scanMove 2s infinite;
}
@keyframes scanMove { 
	0% { top: 0; opacity: 0; } 
	50% { opacity: 1; } 
	100% { top: 100%; opacity: 0; } 
}

.thinking-box {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 30rpx;
}
.pulse-ring { 
	width: 140rpx; 
	height: 140rpx; 
	border: 4rpx solid #2ECC71; 
	border-radius: 50%; 
	animation: ringPulse 1.5s infinite; 
}
@keyframes ringPulse { 
	0% { transform: scale(0.8); opacity: 0.8; } 
	100% { transform: scale(1.6); opacity: 0; } 
}
.ai-text { 
	margin-top: 20rpx; 
	font-weight: bold; 
	color: #2ECC71; 
	font-size: 28rpx;
}

/* 结果弹窗 */
.result-pop {
	position: fixed; 
	bottom: 80rpx; 
	left: 30rpx; 
	right: 30rpx; 
	z-index: 300;
	padding: 40rpx; 
	border-radius: 40rpx; 
	backdrop-filter: blur(30px);
	-webkit-backdrop-filter: blur(30px);
	box-shadow: 0 20rpx 60rpx rgba(0,0,0,0.15);
	animation: slideUp 0.4s cubic-bezier(0.18, 0.89, 0.32, 1.28);
}
@keyframes slideUp { 
	from { transform: translateY(100%); opacity: 0; } 
	to { transform: translateY(0); opacity: 1; } 
}

.result-pop.correct { 
	background: rgba(46, 204, 113, 0.95); 
	color: #FFF; 
}
.result-pop.wrong { 
	background: rgba(231, 76, 60, 0.95); 
	color: #FFF; 
}

.result-header { 
	display: flex; 
	align-items: center; 
	justify-content: flex-start;
	gap: 20rpx; 
	margin-bottom: 20rpx; 
	position: relative;
}

.result-icon-btn {
	width: 80rpx;
	height: 80rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	border-radius: 50%;
	background: rgba(255, 255, 255, 0.2);
	backdrop-filter: blur(10px);
	cursor: pointer;
	transition: all 0.3s;
	flex-shrink: 0;
}

.result-icon-btn:active {
	background: rgba(255, 255, 255, 0.35);
	transform: scale(0.95);
}

.result-icon {
	font-size: 60rpx;
	font-weight: bold;
	color: #FFF;
}

.status-title { 
	font-size: 36rpx; 
	font-weight: 800; 
	flex: 1;
	text-align: center;
}

/* AI 深度诊断区域 */
.ai-analysis-scroll {
	max-height: 400rpx;
	margin-bottom: 30rpx;
	padding: 20rpx 0;
}
.analysis-tag {
	display: flex;
	align-items: center;
	gap: 10rpx;
	margin-bottom: 20rpx;
	padding: 10rpx 20rpx;
	background: rgba(255, 255, 255, 0.2);
	border-radius: 20rpx;
}
.sparkle-icon {
	font-size: 28rpx;
}
.analysis-tag text {
	font-size: 24rpx;
	font-weight: 600;
	opacity: 0.9;
}
.analysis-body {
	font-size: 28rpx;
	line-height: 1.8;
	white-space: pre-wrap;
	word-wrap: break-word;
	display: block;
	padding: 0 20rpx;
}
.answer-display {
	display: flex;
	align-items: center;
	gap: 10rpx;
	margin-bottom: 20rpx;
	padding: 0 20rpx;
}
.answer-label {
	font-size: 24rpx;
	color: rgba(255, 255, 255, 0.7);
}
.answer-value {
	font-size: 32rpx;
	font-weight: bold;
	color: #00FF80;
}

.ai-analysis-brief { 
	font-size: 26rpx; 
	margin-bottom: 30rpx; 
	line-height: 1.5; 
}
.ai-analysis-brief .label {
	font-weight: bold;
	margin-right: 10rpx;
}
.next-btn { 
	width: 100%;
	background: #FFF; 
	color: #333; 
	font-weight: bold; 
	border-radius: 20rpx; 
	border: none;
	padding: 20rpx 0;
	font-size: 28rpx;
	margin-top: 20rpx;
}

.footer-placeholder { 
	height: 300rpx; 
}

/* 深色模式适配 */
.container.dark-mode .glass-card {
	background: rgba(30, 30, 30, 0.8) !important;
	border-color: rgba(255, 255, 255, 0.1) !important;
	color: #EEE !important;
}
.container.dark-mode .q-content,
.container.dark-mode .opt-text {
	color: #FFF !important;
}
.container.dark-mode .progress-text,
.container.dark-mode .timer-box {
	color: #FFF !important;
}
.container.dark-mode .back-icon {
	color: #FFF !important;
}
</style>
