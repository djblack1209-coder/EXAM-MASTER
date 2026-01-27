<template>
	<view class="container">
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
				
				<button class="next-btn" hover-class="ds-hover-btn" @tap="toNext">{{ resultStatus === 'correct' ? '进入下一题' : '继续挑战' }}</button>
			</view>
			
			<view class="footer-placeholder"></view>
		</scroll-view>
		
		<!-- ✅ 自定义弹窗：题库为空 -->
		<custom-modal
			:visible="showEmptyBankModal"
			type="upload"
			title="📚 题库空空如也"
			content="请先去资料库导入学习资料，AI 将为您生成专属题目。"
			confirm-text="去导入"
			:show-cancel="false"
			:is-dark="isDark"
			@confirm="handleEmptyBankConfirm"
		/>
		
		<!-- ✅ 自定义弹窗：恢复进度 -->
		<custom-modal
			:visible="showResumeModal"
			type="info"
			title="📝 检测到未完成的练习"
			:content="resumeModalContent"
			confirm-text="继续答题"
			cancel-text="重新开始"
			:show-cancel="true"
			:is-dark="isDark"
			@confirm="handleResumeConfirm"
			@cancel="handleResumeCancel"
		/>
		
		<!-- ✅ 自定义弹窗：确认退出 -->
		<custom-modal
			:visible="showExitModal"
			type="warning"
			title="确认退出？"
			:content="answeredQuestions.length > 0 ? `已完成 ${answeredQuestions.length} 道题，进度将自动保存，下次可继续答题。` : '确定要退出吗？'"
			confirm-text="确认退出"
			cancel-text="继续答题"
			:show-cancel="true"
			:is-dark="isDark"
			@confirm="handleExitConfirm"
			@cancel="showExitModal = false"
		/>
		
		<!-- ✅ 自定义弹窗：练习完成 -->
		<custom-modal
			:visible="showCompleteModal"
			type="success"
			title="🎉 练习完成"
			:content="`本次共完成 ${questions.length} 道题目！`"
			confirm-text="返回"
			:show-cancel="false"
			:is-dark="isDark"
			@confirm="handleCompleteConfirm"
		/>
	</view>
</template>

<script>
import { lafService } from '../../services/lafService.js'
import { storageService } from '../../services/storageService.js'
import BaseLoading from '../../components/base/base-loading/base-loading.vue'
import CustomModal from '../../components/common/CustomModal.vue'
// ✅ P0-3: 导入自动保存功能
import { 
	saveQuizProgress, 
	loadQuizProgress, 
	clearQuizProgress, 
	hasUnfinishedProgress,
	getProgressSummary 
} from '../../composables/useQuizAutoSave.js'
// ✅ 检查点 5.1: 导入分析服务
import { analytics } from '../../utils/analytics/event-bus-analytics.js'
// ✅ 检查点 5.3: 导入自适应学习引擎
import { 
	adaptiveLearningEngine, 
	generateAdaptiveSequence,
	getNextRecommendedQuestion,
	recordAnswer 
} from '../../utils/learning/adaptive-learning-engine.js'
// ✅ 统一日志工具（生产环境自动禁用）
import { logger } from '../../utils/logger.js'

export default {
	components: {
		BaseLoading,
		CustomModal
	},
	data() {
		return {
			statusBarHeight: 44,
			navBarHeight: 88, // 标准导航栏高度 = 44 + 44
			capsuleMargin: 100,
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
			// ✅ P0-3: 已答题目记录（用于断点续答）
			answeredQuestions: [],
			// ✅ 自定义弹窗状态
			showEmptyBankModal: false,
			showResumeModal: false,
			showExitModal: false,
			showCompleteModal: false,
			resumeModalContent: '',
			isDark: false,
			// ✅ 防重复点击状态
			isNavigating: false,  // 防止快速连续点击"下一题"
			// ✅ 检查点 5.3: 自适应学习状态
			isAdaptiveMode: true,  // 是否启用自适应模式
			currentReviewQuestion: null,  // 当前复习题
			answerStartTime: 0  // 答题开始时间（用于计算用时）
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
					logger.log('[do-quiz] 答案匹配:', { optionLabel, correctAnswer, isMatch });
					return isMatch;
				}
				
				// 兼容选项内容匹配（如果answer不是A/B/C/D，可能是选项内容）
				const optionText = this.currentQuestion.options[idx] || '';
				const isMatch = optionText.startsWith(correctAnswer) || optionText.includes(correctAnswer);
				logger.log('[do-quiz] 选项内容匹配:', { optionText, correctAnswer, isMatch });
				return isMatch;
			};
		}
	},
	onLoad() {
		this.initSystemUI();
		this.loadQuestions();
		
		// ✅ 初始化主题
		this.isDark = uni.getStorageSync('theme_mode') === 'dark';
		
		// ✅ P0-3: 检查是否有未完成的进度
		this.checkUnfinishedProgress();
		
		// ✅ 检查点 5.1: 追踪开始刷题事件
		analytics.trackStartPractice({
			questionCount: this.questions.length,
			mode: this.isAdaptiveMode ? 'adaptive' : 'normal'
		});
	},
	onShow() {
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
		
		// ✅ P0-3: 页面卸载时保存进度
		this.saveCurrentProgress();
	},
	
	// ✅ P0-3: 页面隐藏时也保存进度（应对小程序被杀死的情况）
	onHide() {
		this.saveCurrentProgress();
	},
	methods: {
		// ✅ P0-3: 检查未完成的进度
		checkUnfinishedProgress() {
			if (hasUnfinishedProgress()) {
				const summary = getProgressSummary();
				if (summary && summary.currentIndex > 0) {
					// ✅ 使用自定义弹窗
					this.resumeModalContent = `上次答到第 ${summary.currentIndex + 1} 题，用时 ${summary.formattedTime}（${summary.timeAgo}保存）。是否继续？`;
					this.showResumeModal = true;
				} else {
					this.startTimer();
				}
			} else {
				this.startTimer();
			}
		},
		
		// ✅ P0-3: 恢复进度
		restoreProgress() {
			const progress = loadQuizProgress();
			if (progress) {
				this.currentIndex = progress.currentIndex || 0;
				this.seconds = progress.seconds || 0;
				this.answeredQuestions = progress.answeredQuestions || [];
				this.aiComment = progress.aiComment || '';
				
				// 如果上次已作答但未进入下一题，重置作答状态
				this.hasAnswered = false;
				this.userChoice = null;
				this.showResult = false;
				
				logger.log('[do-quiz] ✅ 进度已恢复:', {
					currentIndex: this.currentIndex,
					seconds: this.seconds,
					answeredCount: this.answeredQuestions.length
				});
				
				uni.showToast({
					title: '进度已恢复',
					icon: 'success',
					duration: 1500
				});
			}
			this.startTimer();
		},
		
		// ✅ P0-3: 保存当前进度
		saveCurrentProgress() {
			// 只有在有题目且已开始答题时才保存
			if (this.questions.length === 0 || this.currentIndex === 0 && !this.hasAnswered) {
				return;
			}
			
			// 如果已完成所有题目，清除进度
			if (this.currentIndex >= this.questions.length - 1 && this.hasAnswered) {
				clearQuizProgress();
				logger.log('[do-quiz] 练习已完成，清除进度');
				return;
			}
			
			const success = saveQuizProgress({
				currentIndex: this.currentIndex,
				userChoice: this.userChoice,
				hasAnswered: this.hasAnswered,
				seconds: this.seconds,
				aiComment: this.aiComment,
				answeredQuestions: this.answeredQuestions
			});
			
			if (success) {
				logger.log('[do-quiz] ✅ 进度已自动保存');
			}
		},
		
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
			logger.log('获取胶囊按钮信息失败', e);
			this.capsuleMargin = 100;
		}
		// #endif
		// #ifndef MP-WECHAT
		this.capsuleMargin = 20;
		// #endif
	},
		loadQuestions() {
			// 从本地存储读取题库
			const bank = storageService.get('v30_bank', []);
			
			if (!bank || bank.length === 0) {
				// ✅ 使用自定义弹窗
				this.showEmptyBankModal = true;
				return;
			}
			
			// 验证并标准化题目数据
			let questions = bank.map((q, index) => ({
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
			
			// ✅ 检查点 5.3: 使用自适应学习引擎优化题目序列
			if (this.isAdaptiveMode && questions.length > 0) {
				questions = generateAdaptiveSequence(questions, {
					insertReviewQuestions: true,
					prioritizeWeak: true,
					maxReviewRatio: 0.3
				});
				logger.log('[do-quiz] ✅ 自适应学习模式已启用，题目序列已优化');
			}
			
			this.questions = questions;
			
			if (this.questions.length === 0) {
				// ✅ 使用自定义弹窗
				this.showEmptyBankModal = true;
			}
			
			// ✅ 记录答题开始时间
			this.answerStartTime = Date.now();
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
			this.hasAnswered = true;
			
			// 判断答案是否正确
			if (this.isCorrectOption(idx)) {
				// 正确时：震动反馈
				try {
					if (typeof uni.vibrateShort === 'function') {
						uni.vibrateShort();
					}
				} catch(e) { logger.warn('Vibrate feedback failed on correct answer', e); }
				
				// ✅ 延迟解锁防重复点击（300ms后允许再次点击）
				setTimeout(() => {
					this.isNavigating = false;
				}, 300);
				
				this.updateStudyStats();
				this.showResult = true;
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
					logger.warn('[do-quiz] AI 解析返回异常:', response.message);
					this.aiComment = "AI 解析暂时不可用，请结合参考答案进行复习。建议重新审视题干与选项的对应关系，查找知识点薄弱环节。";
					this.saveToMistakes();
				}
			} catch (e) {
				logger.warn('[do-quiz] AI 解析请求失败，降级到本地解析:', e);
				
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
				logger.log('[do-quiz] ✅ 已使用降级文案，错题将保存到本地');
				this.saveToMistakes();
			} finally {
				this.isAnalyzing = false; // 关闭扫描动画
				
				// 震动反馈
				try {
					if (typeof uni.vibrateShort === 'function') {
						uni.vibrateShort();
					}
				} catch(e) { logger.warn('Vibrate feedback failed after AI analysis', e); }
			}
		},
		async saveToMistakes() {
			// 将错题存入云端错题本（自动云端+本地同步）
			if (!this.currentQuestion) return;
			
			uni.showLoading({ title: '保存错题中...', mask: false });
			
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
				
				uni.hideLoading();
				
				if (result.success) {
					logger.log('[do-quiz] 错题已保存到云端:', result.id);
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
					logger.warn('[do-quiz] 错题保存失败，已降级到本地:', result.error);
				}
			} catch (error) {
				uni.hideLoading();
				logger.warn('[do-quiz] 保存错题异常，降级到本地存储:', error);
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
				logger.log('[do-quiz] ✅ 已降级到本地保存，sync_status: pending');
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
			// ✅ 防重复点击保护
			if (this.isNavigating) {
				return;
			}
			this.isNavigating = true;
			
			// 重置状态
			this.showResult = false;
			this.isAnalyzing = false;
			
			if (this.currentIndex < this.questions.length - 1) {
				// ✅ 检查点 5.3: 检查是否需要插入复习题
				if (this.isAdaptiveMode) {
					const recommendation = getNextRecommendedQuestion(this.currentIndex, this.questions);
					if (recommendation && recommendation.isReview) {
						// 插入复习题
						this.questions.splice(this.currentIndex + 1, 0, recommendation.question);
						logger.log('[do-quiz] ✅ 插入复习题:', recommendation.reason);
						
						// 显示复习提示
						uni.showToast({
							title: '复习时间到！',
							icon: 'none',
							duration: 1500
						});
					}
				}
				
				this.currentIndex++;
				this.hasAnswered = false;
				this.userChoice = null;
				this.showResult = false;
				this.aiComment = '';
				
				// ✅ 重置答题开始时间
				this.answerStartTime = Date.now();
				
				// ✅ P0-3: 进入下一题时保存进度
				this.saveCurrentProgress();
				
				// 震动反馈
				try {
					if (typeof uni.vibrateShort === 'function') {
						uni.vibrateShort();
					}
				} catch(e) { logger.warn('Vibrate feedback failed on next question', e); }
				
				// ✅ 延迟解锁防重复点击（300ms后允许再次点击）
				setTimeout(() => {
					this.isNavigating = false;
				}, 300);
			} else {
				// ✅ P0-3: 练习完成，清除进度
				clearQuizProgress();
				
				// ✅ 检查点 5.1: 追踪完成练习事件
				analytics.trackConversion('COMPLETE_SESSION', {
					totalQuestions: this.questions.length,
					correctCount: this.answeredQuestions.filter(a => a.isCorrect).length,
					totalTime: this.seconds
				});
				
				// ✅ 使用自定义弹窗
				this.showCompleteModal = true;
			}
		},
		handleExit() {
			// ✅ 使用自定义弹窗
			this.showExitModal = true;
		},
		
		// ✅ 处理退出确认
		handleExitConfirm() {
			this.showExitModal = false;
			// P0-3: 退出前保存进度
			this.saveCurrentProgress();
			
			if (this.timer) {
				clearInterval(this.timer);
			}
			uni.navigateBack();
		},
		
		// ✅ 处理题库为空确认
		handleEmptyBankConfirm() {
			this.showEmptyBankModal = false;
			uni.navigateTo({ 
				url: '/pages/practice/import-data',
				fail: () => {
					uni.navigateBack();
				}
			});
		},
		
		// ✅ 处理恢复进度确认
		handleResumeConfirm() {
			this.showResumeModal = false;
			this.restoreProgress();
		},
		
		// ✅ 处理恢复进度取消（重新开始）
		handleResumeCancel() {
			this.showResumeModal = false;
			clearQuizProgress();
			this.startTimer();
		},
		
		// ✅ 处理练习完成确认
		handleCompleteConfirm() {
			this.showCompleteModal = false;
			this.isNavigating = false;  // 重置防重复点击状态
			uni.navigateBack();
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
	background: var(--bg-page); 
	position: relative; 
	overflow: hidden; 
}

/* 极光背景 */
.aurora-bg {
	position: absolute; 
	top: 0; 
	left: 0; 
	width: 100%; 
	height: 600rpx;
	background: var(--gradient-aurora);
	filter: blur(60px);
	z-index: 0;
}

/* 导航栏 */
.nav-header { 
	position: fixed; 
	top: 0; 
	width: 100%; 
	z-index: 100; 
	background: var(--bg-glass); 
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
	color: var(--text-primary);
	font-weight: bold;
}
.progress-text { 
	font-size: 28rpx; 
	font-weight: bold; 
	color: var(--text-primary); 
}
.timer-box { 
	font-size: 24rpx; 
	color: var(--text-sub); 
	background: var(--bg-secondary); 
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
	background: var(--bg-glass); 
	backdrop-filter: blur(20px);
	-webkit-backdrop-filter: blur(20px);
	border: 1px solid var(--border); 
	border-radius: 40rpx;
	padding: 40rpx; 
	margin-bottom: 30rpx;
	box-shadow: var(--shadow-md);
}

/* 题目卡片 */
.question-card .q-tag { 
	display: inline-block; 
	background: var(--primary); 
	color: var(--text-primary-foreground); 
	font-size: 20rpx; 
	padding: 4rpx 16rpx; 
	border-radius: 10rpx; 
	margin-bottom: 20rpx; 
}
.question-card .q-content { 
	font-size: 34rpx; 
	font-weight: bold; 
	line-height: 1.6; 
	color: var(--text-primary); 
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
	border-color: var(--primary); 
	background: var(--success-light); 
}
.option-item.correct {
	border-color: var(--primary);
	background: var(--success-light);
}
.option-item.wrong {
	border-color: var(--danger);
	background: var(--danger-light);
}
.option-item.disabled {
	opacity: 0.5;
	pointer-events: none;
}
.opt-index { 
	width: 50rpx; 
	font-weight: 900; 
	color: var(--primary); 
	font-size: 32rpx;
	flex-shrink: 0;
}
.opt-text { 
	flex: 1; 
	font-size: 30rpx; 
	color: var(--text-sub); 
	line-height: 1.5;
	word-break: break-all;
}
.select-indicator { 
	width: 40rpx; 
	height: 40rpx; 
	display: flex;
	align-items: center;
	justify-content: center;
	font-size: 32rpx;
	color: var(--primary);
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
	background: var(--overlay); 
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
	background: linear-gradient(90deg, transparent, var(--primary), transparent);
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
	border: 4rpx solid var(--primary); 
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
	color: var(--primary); 
	font-size: 28rpx;
}

/* 结果弹窗 */
.result-pop {
	position: fixed; 
	/* 适配 iPhone 14/15 Pro 底部安全区域：使用 env() 动态计算 bottom 值 */
	bottom: calc(40rpx + constant(safe-area-inset-bottom));
	bottom: calc(40rpx + env(safe-area-inset-bottom));
	left: 30rpx; 
	right: 30rpx; 
	z-index: 300;
	padding: 40rpx; 
	border-radius: 40rpx; 
	backdrop-filter: blur(30px);
	-webkit-backdrop-filter: blur(30px);
	box-shadow: var(--shadow-xl, 0 8px 32px rgba(0, 0, 0, 0.12));
	animation: slideUp 0.4s cubic-bezier(0.18, 0.89, 0.32, 1.28);
}
@keyframes slideUp { 
	from { transform: translateY(100%); opacity: 0; } 
	to { transform: translateY(0); opacity: 1; } 
}

.result-pop.correct { 
	background: var(--success); 
	color: var(--text-primary-foreground); 
}
.result-pop.wrong { 
	background: var(--danger); 
	color: var(--text-primary-foreground); 
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
	background: var(--overlay);
	backdrop-filter: blur(10px);
	cursor: pointer;
	transition: all 0.3s;
	flex-shrink: 0;
}

.result-icon-btn:active {
	background: var(--bg-secondary);
	transform: scale(0.95);
}

.result-icon {
	font-size: 60rpx;
	font-weight: bold;
	color: var(--text-primary-foreground);
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
	background: var(--overlay);
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
	color: var(--text-sub);
}
.answer-value {
	font-size: 32rpx;
	font-weight: bold;
	color: var(--success-light);
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
	background: var(--bg-glass); 
	color: var(--text-primary); 
	font-weight: bold; 
	border-radius: 20rpx; 
	border: none;
	padding: 20rpx 0;
	font-size: 28rpx;
	margin-top: 20rpx;
}

.footer-placeholder { 
	height: 300rpx;
	/* 适配 iPhone 底部安全区域 */
	padding-bottom: constant(safe-area-inset-bottom);
	padding-bottom: env(safe-area-inset-bottom);
}
</style>