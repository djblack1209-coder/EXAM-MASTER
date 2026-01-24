<template>
	<view :class="['container', { ' ': isDark }]">
		<view class="aurora-bg"></view>

		<!-- 匹配阶段 -->
		<view class="matching-stage" v-if="gameState === 'matching'">
			<view class="radar-scanner">
				<view class="radar-circle radar-1"></view>
				<view class="radar-circle radar-2"></view>
				<view class="radar-circle radar-3"></view>
				<view class="radar-line"></view>
			</view>
			<view class="match-core">
				<view class="avatar-ring pulse">
					<image class="user-avatar" :src="userInfo.avatarUrl || defaultAvatar" mode="aspectFill"></image>
				</view>
				<view class="vs-text">VS</view>
				<view class="avatar-ring opponent-ring" :class="{ 'found': opponentFound }">
					<image class="user-avatar" :src="opponent.avatar || defaultAvatar" mode="aspectFill"></image>
					<view class="search-overlay" v-if="!opponentFound">
						<view class="search-icon">🔍</view>
					</view>
				</view>
			</view>
			<view class="match-status">
				<text class="status-title">{{ opponentFound ? '匹配成功！' : '正在寻找实力相当的研友...' }}</text>
				<text class="status-tip" v-if="opponentFound">{{ opponent.name }} 已加入对战</text>
			</view>
			<view class="exit-btn" @tap="handleExit" v-if="!opponentFound">
				<text>取消匹配</text>
			</view>
		</view>

		<!-- 红光警告遮罩（最后5秒） -->
		<view class="red-warning-overlay" v-if="showRedWarning && gameState === 'battle'"></view>
		
		<!-- 对战阶段 - iOS 风格重构 -->
		<view class="pk-container" v-if="gameState === 'battle'">
			<view class="top-bar" :style="{ marginTop: '10px' }">
				<view class="icon-btn" @tap="handleQuit">
					<text >✕</text>
				</view>
				<view class="round-badge">
					<text>Round {{ currentIndex + 1 }} / {{ questions.length }}</text>
				</view>
				<view class="icon-btn ghost"></view>
			</view>

			<view class="battle-stage" :style="{ marginTop: '30px' }">
				<view class="player-card left">
					<image :src="userInfo.avatarUrl || defaultAvatar" class="avatar" mode="aspectFill"></image>
					<text class="score me">{{ myScore }}</text>
					<view class="progress-track">
						<view class="progress-fill me" :style="{ width: (myScore / 500) * 100 + '%' }"></view>
					</view>
				</view>

				<text class="vs-text">VS</text>

				<view class="player-card right">
					<image :src="opponent.avatar || defaultAvatar" class="avatar" mode="aspectFill"></image>
					<text class="score opp">{{ opponentScore }}</text>
					<view class="progress-track">
						<view class="progress-fill opp" :style="{ width: (opponentScore / 500) * 100 + '%' }" :class="{ 'rush': opponentRushing }"></view>
					</view>
				</view>
			</view>

			<view class="question-card">
				<view class="question-header">
					<view class="tag">单选</view>
					<view class="timer-badge" :class="{ 'warning': timeLeft <= 10, 'danger': timeLeft <= 5 }">
						<text class="timer-text">{{ timeLeft }}s</text>
					</view>
				</view>
				<text class="q-text">{{ currentQuestion.question || currentQuestion.title || '题目加载中...' }}</text>
				<!-- 调试信息 -->
				<view v-if="false" >
					<text>题目索引: {{ currentIndex }} / {{ questions.length }}</text>
					<text>选项数量: {{ currentQuestion?.options?.length || 0 }}</text>
					<text>gameState: {{ gameState }}</text>
					<text>showAns: {{ showAns }}</text>
				</view>
			</view>

			<view class="options-group">
				<button 
					class="opt-btn" 
					v-for="(opt, idx) in currentQuestion.options" 
					:key="idx"
					:class="{
						'selected': userChoice === idx,
						'correct': showAns && isCorrectOption(idx),
						'wrong': showAns && userChoice === idx && !isCorrectOption(idx),
						'disabled': showAns
					}"
					@tap.stop="handleSelect(idx)"
					@click.stop="handleSelect(idx)"
					:disabled="showAns"
					:data-index="idx"
					style="position: relative; z-index: 10; background: transparent; border: none; padding: 0; margin: 0;"
				>
					<view class="opt-btn-inner">
						<view class="letter">{{ ['A','B','C','D'][idx] }}</view>
						<text class="content">{{ opt }}</text>
						<view class="opt-icon" v-if="showAns">
							<text v-if="isCorrectOption(idx)">✓</text>
							<text v-else-if="userChoice === idx && !isCorrectOption(idx)">✗</text>
						</view>
					</view>
				</button>
			</view>
			
			<!-- 临时测试：显示当前状态 -->
			<view v-if="false" >
				<text>gameState: {{ gameState }}</text>
				<text>showAns: {{ showAns }}</text>
				<text>options: {{ currentQuestion?.options?.length || 0 }}</text>
			</view>
			
			<!-- 调试信息（开发环境） -->
			<view class="debug-info" v-if="false" >
				<text>gameState: {{ gameState }}</text>
				<text>showAns: {{ showAns }}</text>
				<text>currentIndex: {{ currentIndex }}</text>
				<text>optionsCount: {{ currentQuestion?.options?.length || 0 }}</text>
			</view>
			
			<view class="opponent-status" v-if="opponentAnswered && !showAns" :style="{ marginBottom: 'calc(env(safe-area-inset-bottom, 0px) + 20px)' }">
				<text class="opponent-tip">{{ opponent.name }} 已答题 ✓</text>
			</view>
			
			<!-- 临时测试按钮（用于验证点击事件） -->
			<view v-if="false" style="position: fixed; bottom: 100px; left: 20px; z-index: 9999;">
				<button @tap="handleSelect(0)" style="background: red; color: white; padding: 20rpx;">
					测试点击选项 0
				</button>
				<text style="color: white; display: block; margin-top: 20rpx;">
					gameState: {{ gameState }}, showAns: {{ showAns }}
				</text>
			</view>
		</view>

		<!-- 结算阶段 -->
		<view class="result-stage" v-if="gameState === 'result'" @tap.stop="handleResultStageClick">
			<view class="result-glass glass-card" @tap.stop>
				<view class="result-header">
					<view class="result-icon" :class="{ 'victory': myScore >= opponentScore, 'defeat': myScore < opponentScore }">
						<text>{{ myScore >= opponentScore ? '🏆' : '😔' }}</text>
					</view>
					<text class="result-title" :class="{ 'victory': myScore >= opponentScore, 'defeat': myScore < opponentScore }">
						{{ myScore >= opponentScore ? 'VICTORY' : 'DEFEAT' }}
					</text>
					<text class="result-subtitle">战绩对比：{{ myScore }} VS {{ opponentScore }}</text>
				</view>
				
				<!-- AI 战报分析卡片 -->
				<view class="ai-report-box">
					<view class="ai-header">
						<text class="ai-icon">🤖</text>
						<text class="ai-title">AI 犀利点评</text>
					</view>
					<text class="ai-text">{{ aiSummary || 'AI 正在分析本场对局...' }}</text>
				</view>

				<view class="action-btns">
					<button class="btn-share" @tap.stop="handleShare">分享战报</button>
					<button class="btn-rank" @tap.stop="goToRank">查看排行榜</button>
					<button class="btn-again" @tap.stop="resetGame">再来一局</button>
					<button class="btn-home" @tap.stop="goHome">返回首页</button>
					<button class="btn-exit" @tap.stop="handleExitFromResult">退出</button>
				</view>
			</view>
		</view>
		
		<!-- 隐藏的画布，用于生成分享海报 -->
		<canvas 
			canvas-id="shareCanvas" 
			:style="{ width: '375px', height: '600px', position: 'fixed', left: '9000px', top: '0' }"
		></canvas>
	</view>
</template>

<script>
import { lafService } from '../../services/lafService.js'

export default {
	data() {
		return {
			gameState: 'matching', // matching, battle, result
			isDark: false,
			statusBarHeight: 44,
			userInfo: {},
			defaultAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Guest',
			opponent: { name: '寻找中...', avatar: '', level: '' },
			opponentFound: false,
			currentIndex: 0,
			questions: [],
			myScore: 0,
			opponentScore: 0,
			userChoice: null,
			opponentChoice: null,
			opponentAnswered: false,
			showAns: false,
			aiSummary: 'AI 正在分析本场对局...',
			opProgress: 0,
			myProgress: 0,
			opponentRushing: false,
			opponentTimers: [],
			questionTimer: null, // 题目倒计时定时器
			timeLeft: 30, // 每道题剩余时间（秒）
			isGeneratingShare: false, // 是否正在生成分享海报
			isScoreUploaded: false, // 是否已上传分数（防止重复上传）
			showRedWarning: false, // 是否显示红光警告
			// 战绩数据（用于分享海报）
			accuracy: 0, // 正确率
			averageTime: 0, // 平均答题时间（秒）
			knowledgePoints: [], // 掌握的知识点
			// 预设虚拟对手库
			mockBots: [
				{ name: '考研一哥', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=King', level: 'Lv.88' },
				{ name: '上岸锦鲤', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Lucky', level: 'Lv.75' },
				{ name: '学霸张', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Zhang', level: 'Lv.82' },
				{ name: '考研小白', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Newbie', level: 'Lv.60' },
				{ name: '满分狂魔', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Perfect', level: 'Lv.95' },
				{ name: '夜猫子', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Night', level: 'Lv.70' },
				{ name: '题海战士', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Warrior', level: 'Lv.85' },
				{ name: '知识库', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Library', level: 'Lv.90' }
			]
		};
	},
	computed: {
		currentQuestion() {
			const q = this.questions[this.currentIndex];
			if (!q) {
				console.warn('[TEST-10.1] ⚠️ 当前题目不存在:', {
					currentIndex: this.currentIndex,
					questionsLength: this.questions.length
				});
				return { question: '加载中...', options: [] };
			}
			
			// 数据规范化：确保题目格式正确
			let options = q.options || [];
			
			// 修复AI回传格式问题：确保options是数组且格式正确
			if (!Array.isArray(options)) {
				console.warn('[PK-BATTLE] ⚠️ options不是数组，尝试转换:', options);
				// 尝试从字符串解析
				if (typeof options === 'string') {
					try {
						options = JSON.parse(options);
					} catch (e) {
						console.error('[PK-BATTLE] ❌ 无法解析options字符串:', e);
						options = [];
					}
				} else if (typeof options === 'object' && options !== null) {
					// 如果是对象，尝试转换为数组
					options = Object.values(options);
				} else {
					options = [];
				}
			}
			
			// 确保每个选项都是字符串，且去除前后空格
			options = options.map(opt => {
				if (typeof opt === 'string') {
					return opt.trim();
				} else if (typeof opt === 'object' && opt !== null) {
					// 如果选项是对象，尝试提取文本
					return (opt.text || opt.content || opt.label || String(opt)).trim();
				}
				return String(opt).trim();
			}).filter(opt => opt.length > 0); // 过滤空选项
			
			// 如果选项数量不足4个，补充空选项
			while (options.length < 4) {
				options.push(`选项${options.length + 1}`);
			}
			
			// 限制选项数量为4个
			options = options.slice(0, 4);
			
			const normalized = {
				question: (q.question || q.title || '题目加载中...').trim(),
				options: options,
				answer: (q.answer || 'A').toString().toUpperCase().charAt(0),
				type: q.type || '单选',
				id: q.id || `q_${this.currentIndex}`
			};
			
			// 调试日志
			if (this.currentIndex === 0) {
				console.log('[PK-BATTLE] 📝 currentQuestion 计算属性:', {
					hasQuestion: !!normalized.question,
					hasOptions: Array.isArray(normalized.options),
					optionsCount: normalized.options.length,
					options: normalized.options,
					answer: normalized.answer,
					rawQuestion: q
				});
			}
			
			return normalized;
		},
		isCorrectOption() {
			return (idx) => {
				if (!this.currentQuestion || !this.showAns) return false;
				const correctAnswer = this.currentQuestion.answer;
				if (['A', 'B', 'C', 'D'].includes(correctAnswer)) {
					return ['A', 'B', 'C', 'D'][idx] === correctAnswer;
				}
				return this.currentQuestion.options[idx] === correctAnswer || 
				       this.currentQuestion.options[idx].startsWith(correctAnswer);
			};
		}
	},
	onLoad(options) {
		console.log('[TEST-10.1] 🎮 PK 对战页面加载');
		console.log('[TEST-10.1] 📋 页面参数:', options);
		
		// 检查路由参数（从排行榜跳转时可能传递 opponent 参数）
		if (options && options.opponent) {
			console.log('[TEST-10.1] 📋 检测到 opponent 参数:', decodeURIComponent(options.opponent));
		}
		
		this.initData();
		this.startMatching();
	},
	onUnload() {
		this.clearAllTimers();
	},
	methods: {
		initData() {
			console.log('[TEST-10.1] 🔧 初始化 PK 对战数据');
			
			const sys = uni.getSystemInfoSync();
			this.statusBarHeight = sys.statusBarHeight || sys.safeAreaInsets?.top || 44;
			this.userInfo = uni.getStorageSync('userInfo') || { nickName: '考研人', avatarUrl: '' };
			this.isDark = uni.getStorageSync('theme_mode') === 'dark';
			
			console.log('[TEST-10.1] 👤 用户信息:', {
				nickName: this.userInfo.nickName,
				hasAvatar: !!this.userInfo.avatarUrl
			});
			
			// 加载题库（随机抽取5道题）
			const allQuestions = uni.getStorageSync('v30_bank') || [];
			
			console.log('[TEST-10.1] 📚 题库状态:', {
				totalQuestions: allQuestions.length,
				hasQuestions: allQuestions.length > 0
			});
			
			if (allQuestions.length === 0) {
				console.warn('[TEST-10.1] ⚠️ 题库为空，无法开始对战');
				uni.showModal({
					title: '提示',
					content: '题库为空，请先导入资料后再来对战',
					showCancel: false,
					success: () => uni.navigateBack()
				});
				return;
			}
			
			// 随机抽取5道题
			const shuffled = [...allQuestions].sort(() => Math.random() - 0.5);
			this.questions = shuffled.slice(0, Math.min(5, shuffled.length));
			
			console.log('[TEST-10.1] ✅ 题目加载完成:', {
				selectedCount: this.questions.length,
				firstQuestion: this.questions[0] ? {
					hasQuestion: !!this.questions[0].question,
					hasOptions: Array.isArray(this.questions[0].options),
					optionsCount: this.questions[0].options?.length || 0
				} : null
			});
		},
		startMatching() {
			console.log('[TEST-10.1] 🔍 开始匹配对手');
			console.log('[TEST-10.1] 📊 当前状态:', {
				gameState: this.gameState,
				opponentFound: this.opponentFound,
				mockBotsCount: this.mockBots.length
			});
			
			// 模拟匹配过程（1.5-3秒随机延迟）
			const matchDelay = Math.random() * 1500 + 1500; // 1.5-3秒
			
			console.log('[TEST-10.1] ⏱️ 匹配延迟:', `${(matchDelay / 1000).toFixed(1)}秒`);
			
			setTimeout(() => {
				// 随机选择一个虚拟对手
				const randomBot = this.mockBots[Math.floor(Math.random() * this.mockBots.length)];
				this.opponent = { 
					name: randomBot.name, 
					avatar: randomBot.avatar,
					level: randomBot.level
				};
				this.opponentFound = true;
				
				console.log('[TEST-10.1] ✅ 匹配成功！');
				console.log('[TEST-10.1] 👥 对手信息:', {
					name: this.opponent.name,
					avatar: this.opponent.avatar,
					level: this.opponent.level,
					opponentFound: this.opponentFound
				});
				
				// 1秒后进入对战
				setTimeout(() => {
					console.log('[TEST-10.1] ⚔️ 进入对战阶段');
					console.log('[TEST-10.1] 📊 状态切换: matching -> battle');
					this.gameState = 'battle';
					this.startBattle();
				}, 1000);
			}, matchDelay);
		},
		startBattle() {
			console.log('[TEST-10.1] 🎯 开始对战');
			console.log('[TEST-10.1] 📊 对战状态:', {
				gameState: this.gameState,
				currentIndex: this.currentIndex,
				questionsCount: this.questions.length,
				opponentName: this.opponent.name,
				myScore: this.myScore,
				opponentScore: this.opponentScore
			});
			
			// 重置分数上传标志位（新一局开始）
			this.isScoreUploaded = false;
			
			// 开始第一题的对战
			this.currentIndex = 0;
			
			if (this.questions.length === 0) {
				console.error('[TEST-10.1] ❌ 题目为空，无法开始对战');
				uni.showToast({
					title: '题目加载失败',
					icon: 'none'
				});
				return;
			}
			
			console.log('[TEST-10.1] 📝 第一题信息:', {
				hasQuestion: !!this.currentQuestion.question,
				hasOptions: Array.isArray(this.currentQuestion.options),
				optionsCount: this.currentQuestion.options?.length || 0
			});
			
			this.simulateOpponentAnswer(0);
			this.startQuestionTimer(); // 启动第一题的倒计时
		},
		startQuestionTimer() {
			// 清除之前的倒计时
			if (this.questionTimer) {
				clearInterval(this.questionTimer);
				this.questionTimer = null;
			}
			
			// 重置倒计时和红光警告
			this.timeLeft = 30;
			this.showRedWarning = false;
			
			// 启动倒计时
			this.questionTimer = setInterval(() => {
				this.timeLeft--;
				
				// 最后5秒显示红光警告
				if (this.timeLeft <= 5 && this.timeLeft > 0) {
					this.showRedWarning = true;
				} else if (this.timeLeft > 5) {
					this.showRedWarning = false;
				}
				
				// 时间到了，自动判定错误
				if (this.timeLeft <= 0) {
					this.showRedWarning = false;
					this.handleTimeOut();
				}
			}, 1000);
		},
		handleTimeOut() {
			console.log('[PK-BATTLE] ⏰ 答题超时，自动判定错误');
			
			// 清除倒计时
			if (this.questionTimer) {
				clearInterval(this.questionTimer);
				this.questionTimer = null;
			}
			
			// 如果已经显示答案，不再处理
			if (this.showAns) {
				return;
			}
			
			// 自动判定为错误（选择 -1 表示超时）
			this.userChoice = -1;
			this.showAns = true;
			
			// 震动反馈
			try {
				if (typeof uni.vibrateShort === 'function') {
					uni.vibrateShort();
				}
			} catch(e) {}
			
			// 显示超时提示
			uni.showToast({
				title: '答题超时',
				icon: 'none',
				duration: 1500
			});
			
			// 1.5秒后进入下一题
			setTimeout(() => {
				this.goToNextQuestion();
			}, 1500);
		},
		goToNextQuestion() {
			console.log('[TEST-10.2] ⏭️ 准备进入下一题');
			this.showAns = false;
			this.userChoice = null;
			this.opponentChoice = null;
			this.opponentAnswered = false;
			
			if (this.currentIndex < this.questions.length - 1) {
				this.currentIndex++;
				console.log('[TEST-10.2] 📝 进入下一题:', {
					currentIndex: this.currentIndex,
					totalQuestions: this.questions.length
				});
				// 开始下一题的机器人答题
				this.simulateOpponentAnswer(this.currentIndex);
				// 启动新题目的倒计时
				this.startQuestionTimer();
			} else {
				console.log('[TEST-10.2] 🏁 所有题目完成，进入结算');
				this.finishGame();
			}
		},
		simulateOpponentAnswer(questionIndex) {
			// 检查游戏状态，如果已经结束则不再答题
			if (questionIndex >= this.questions.length || this.gameState !== 'battle') {
				console.warn('[TEST-10.2] ⚠️ 对手答题被跳过:', {
					questionIndex: questionIndex,
					questionsLength: this.questions.length,
					gameState: this.gameState
				});
				return;
			}
			
			const question = this.questions[questionIndex];
			if (!question) {
				console.error('[TEST-10.2] ❌ 题目不存在，无法模拟对手答题:', questionIndex);
				return;
			}
			
			// 规范化正确答案：确保格式为 A/B/C/D
			const correctAnswerRaw = question.answer;
			const correctAnswer = correctAnswerRaw.toString().toUpperCase().charAt(0);
			const correctIndex = ['A', 'B', 'C', 'D'].indexOf(correctAnswer);
			
			console.log('[TEST-10.2] 🤖 开始模拟对手答题:', {
				questionIndex: questionIndex,
				correctAnswer: correctAnswer,
				correctIndex: correctIndex,
				currentIndex: this.currentIndex,
				gameState: this.gameState
			});
			
			// 机器人答题时间：3-8秒随机（模拟思考时间）
			const answerTime = Math.random() * 5000 + 3000; // 3-8秒
			
			console.log('[TEST-10.2] ⏱️ 对手将在', (answerTime / 1000).toFixed(1), '秒后答题');
			
			// 机器人正确率：70%
			const willAnswerCorrectly = Math.random() < 0.7;
			
			const timer = setTimeout(() => {
				// 再次检查游戏状态，防止在答题过程中游戏已结束
				if (this.gameState !== 'battle') {
					console.warn('[TEST-10.2] ⚠️ 游戏已结束，取消对手答题:', {
						questionIndex: questionIndex,
						gameState: this.gameState
					});
					return;
				}
				
				// 对手答题
				this.opponentAnswered = true;
				
				// 确定对手选择的选项
				if (willAnswerCorrectly && correctIndex >= 0) {
					// 70%概率答对，且答案格式正确
					this.opponentChoice = correctIndex;
				} else if (willAnswerCorrectly && correctIndex < 0) {
					// 70%概率答对，但答案格式不对，随机选一个
					this.opponentChoice = Math.floor(Math.random() * (question.options?.length || 4));
				} else {
					// 30%概率答错（随机选一个错误答案）
					const wrongOptions = [0, 1, 2, 3].filter(i => i !== correctIndex);
					if (wrongOptions.length > 0) {
						this.opponentChoice = wrongOptions[Math.floor(Math.random() * wrongOptions.length)];
					} else {
						// 如果所有选项都是正确答案（异常情况），随机选一个
						this.opponentChoice = Math.floor(Math.random() * (question.options?.length || 4));
					}
				}
				
				// 判断对手是否正确（直接判断，不依赖 showAns）
				// 因为 isCorrectOption 需要 showAns 为 true，所以这里直接判断
				const isOpponentCorrect = correctIndex >= 0 && this.opponentChoice === correctIndex;
				
				console.log('[TEST-10.2] 🤖 对手答题完成:', {
					questionIndex: questionIndex,
					opponentChoice: this.opponentChoice,
					selectedLabel: ['A', 'B', 'C', 'D'][this.opponentChoice],
					correctAnswer: correctAnswer,
					correctIndex: correctIndex,
					isOpponentCorrect: isOpponentCorrect,
					opponentScoreBefore: this.opponentScore,
					gameState: this.gameState
				});
				
				if (isOpponentCorrect) {
					// 对手答对，增加得分并显示冲刺动画
					this.opponentScore += 20;
					this.opponentRushing = true;
					console.log('[TEST-10.2] ✅ 对手答对了！分数 +20，当前分数:', this.opponentScore);
					setTimeout(() => {
						this.opponentRushing = false;
					}, 500);
				} else {
					console.log('[TEST-10.2] ❌ 对手答错了，分数不变，当前分数:', this.opponentScore);
				}
				
				// 更新对手进度条
				this.opProgress = ((questionIndex + 1) / this.questions.length) * 100;
				console.log('[TEST-10.2] 📊 对手进度更新:', {
					opProgress: this.opProgress,
					questionIndex: questionIndex + 1,
					totalQuestions: this.questions.length
				});
				
			}, answerTime);
			
			this.opponentTimers.push(timer);
			console.log('[TEST-10.2] 📝 对手答题定时器已创建，当前定时器数量:', this.opponentTimers.length);
		},
		handleSelect(idx) {
			// 立即打印，确保事件触发
			console.log('[TEST-10.2] 🎯 选项被点击 - 立即响应:', idx);
			
			console.log('[TEST-10.2] 🎯 选项被点击:', {
				index: idx,
				optionLabel: ['A', 'B', 'C', 'D'][idx],
				showAns: this.showAns,
				gameState: this.gameState,
				currentIndex: this.currentIndex,
				hasCurrentQuestion: !!this.currentQuestion,
				hasOptions: Array.isArray(this.currentQuestion?.options),
				optionsCount: this.currentQuestion?.options?.length || 0
			});
			
			// 检查状态
			if (this.gameState !== 'battle') {
				console.warn('[TEST-10.2] ⚠️ 当前不在对战状态，无法答题:', {
					gameState: this.gameState
				});
				return;
			}
			
			if (this.showAns) {
				console.log('[TEST-10.2] ⚠️ 已显示答案，禁止重复点击');
				return; // 只有在显示答案时才禁止点击，对手答题后仍可继续
			}
			
			if (!this.currentQuestion || !this.currentQuestion.options || this.currentQuestion.options.length === 0) {
				console.error('[TEST-10.2] ❌ 题目数据不完整，无法答题:', {
					currentQuestion: this.currentQuestion
				});
				uni.showToast({
					title: '题目加载中，请稍候',
					icon: 'none'
				});
				return;
			}
			
			console.log('[TEST-10.2] ✅ 开始处理答题');
			
			this.userChoice = idx;
			this.showAns = true;
			
			// 震动反馈
			try {
				if (typeof uni.vibrateShort === 'function') {
					uni.vibrateShort();
				}
			} catch(e) {}

			// 判断是否正确
			const isCorrect = this.isCorrectOption(idx);
			console.log('[TEST-10.2] 📊 答题结果:', {
				selectedIndex: idx,
				selectedLabel: ['A', 'B', 'C', 'D'][idx],
				correctAnswer: this.currentQuestion.answer,
				isCorrect: isCorrect,
				myScoreBefore: this.myScore
			});
			
			if (isCorrect) {
				this.myScore += 20;
				console.log('[TEST-10.2] ✅ 答对了！分数 +20，当前分数:', this.myScore);
			} else {
				console.log('[TEST-10.2] ❌ 答错了，分数不变');
			}
			
			// 更新我的进度条
			this.myProgress = ((this.currentIndex + 1) / this.questions.length) * 100;
			
			// 清除倒计时
			if (this.questionTimer) {
				clearInterval(this.questionTimer);
				this.questionTimer = null;
			}

			// 1.5秒后进入下一题
			setTimeout(() => {
				this.goToNextQuestion();
			}, 1500);
		},
		async finishGame() {
			console.log('[TEST-10.2] 🏁 开始结算游戏');
			console.log('[TEST-10.2] 📊 最终分数:', {
				myScore: this.myScore,
				opponentScore: this.opponentScore,
				result: this.myScore > this.opponentScore ? '胜利' : (this.myScore < this.opponentScore ? '惜败' : '平局'),
				totalQuestions: this.questions.length,
				currentIndex: this.currentIndex
			});
			
			// 立即清理所有定时器（防止对手继续答题）
			this.clearAllTimers();
			console.log('[TEST-10.2] ✅ 已清理所有定时器');
			
			// 计算战绩数据（用于分享海报）
			const correctCount = Math.floor(this.myScore / 20);
			this.accuracy = this.questions.length > 0 ? Math.round((correctCount / this.questions.length) * 100) : 0;
			// 模拟平均答题时间（实际应该记录真实时间）
			this.averageTime = 1.2 + Math.random() * 0.6; // 1.2-1.8秒
			// 模拟掌握的知识点
			this.knowledgePoints = this.questions.slice(0, correctCount).map(q => q.category || '未分类').filter((v, i, a) => a.indexOf(v) === i);
			
			// 切换到结算状态（必须在清理定时器之后）
			this.gameState = 'result';
			console.log('[TEST-10.2] ✅ 状态已切换到 result');
			console.log('[TEST-10.2] 🎯 结算页应该显示，gameState =', this.gameState);
			
			// 调用智谱 AI 生成针对性战后分析
			console.log('[TEST-10.2] 🤖 开始生成 AI 分析...');
			await this.fetchAISummary();
			console.log('[TEST-10.2] ✅ AI 分析完成');
			
			// TEST-10.3: 自动上传分数到排行榜（结算页显示时触发）
			console.log('[TEST-10.3] 🏆 结算页已显示，开始自动上传分数到排行榜');
			console.log('[TEST-10.3] 📊 PK 本局得分:', this.myScore);
			// 注意：uploadScoreToRank 现在是 async 方法，但不等待结果（静默上传）
			// uploadScoreToRank 内部已有锁机制，防止重复上传
			this.uploadScoreToRank().catch(err => {
				console.error('[TEST-10.3] ❌ 上传分数失败（静默）:', err);
			});
			
			// 验证结算页状态
			this.$nextTick(() => {
				console.log('[TEST-10.2] 🔍 结算页状态验证:', {
					gameState: this.gameState,
					shouldShowResult: this.gameState === 'result',
					myScore: this.myScore,
					opponentScore: this.opponentScore,
					aiSummary: this.aiSummary
				});
			});
		},
		async fetchAISummary() {
			// 设置 Loading 状态
			this.aiSummary = "AI 正在分析战局...";
			
			const correctCount = Math.floor(this.myScore / 20);
			const accuracy = this.questions.length > 0 
				? Math.round((correctCount / this.questions.length) * 100) 
				: 0;
			
			const result = this.myScore > this.opponentScore ? '胜利' : (this.myScore < this.opponentScore ? '惜败' : '平局');
			
			console.log('[pk-battle] 🤖 调用后端代理生成 AI 战报...');

			try {
				// ✅ 使用后端代理调用（安全）- action: 'pk_summary'
				const response = await lafService.proxyAI('pk_summary', {
					myScore: this.myScore,
					opponentScore: this.opponentScore,
					totalQuestions: this.questions.length,
					accuracy: accuracy,
					result: result,
					opponentName: this.opponent.name
				});

				console.log('[pk-battle] 📥 后端代理响应:', {
					code: response?.code,
					hasData: !!response?.data
				});

				if (response && response.code === 0 && response.data) {
					let comment = response.data.trim();
					// 清洗可能存在的引号和多余标记
					comment = comment.replace(/["""]/g, "");
					comment = comment.replace(/```json\s*/gi, '');
					comment = comment.replace(/```\s*/g, '');
					this.aiSummary = comment;
					console.log('[pk-battle] ✅ AI 战报生成成功');
				} else {
					throw new Error("AI 响应异常");
				}
				
			} catch (e) {
				console.error('[TEST-10.2] ❌ AI 战报生成失败:', e);
				
				// 检查是否是401未登录错误
				if (e.message && e.message.includes('未登录')) {
					console.warn('[TEST-10.2] ⚠️ AI 服务需要登录，使用降级方案');
				}
				
				// 降级方案：如果 AI 挂了，随机显示一条本地库
				const fallback = result === '胜利' ? [
					"胜败乃兵家常事，但这局你赢了！手速和准确率都不错，继续保持！",
					"这手速，阅卷老师都追不上！精准度碾压对手，看来知识点掌握得很扎实。",
					"大获全胜！这波操作我给满分，继续保持这种学习状态！"
				] : result === '惜败' ? [
					"差点就赢了，建议少吃一口饭，多背一个词，下次一定能反超！",
					"对手很厉害，但你的潜力更大，再多刷几题就能反超。",
					"虽然惜败，但表现可圈可点。胜败乃兵家常事，大侠请重新来过！"
				] : [
					"势均力敌！这局平局，下局见分晓。",
					"实力与运气并存，这波操作我给满分！再来一局决胜负！",
					"平分秋色！看来双方都很强，不如再战一局？"
				];
				this.aiSummary = fallback[Math.floor(Math.random() * fallback.length)];
				console.log('[TEST-10.2] ✅ 已使用降级方案，评语:', this.aiSummary);
			}
		},
		goHome() {
			// 使用 switchTab 跳转到首页（TabBar 页面）
			uni.switchTab({ 
				url: '/src/pages/index/index',
				fail: () => {
					uni.showToast({ title: '跳转失败', icon: 'none' });
				}
			});
		},
		goToRank() {
			// TEST-10.3: 跳转到排行榜页面
			console.log('[TEST-10.3] 📊 用户点击"查看排行榜"，准备跳转');
			uni.navigateTo({
				url: '/src/pages/practice/rank',
				success: () => {
					console.log('[TEST-10.3] ✅ 已跳转到排行榜页面');
				},
				fail: (err) => {
					console.error('[TEST-10.3] ❌ 跳转排行榜失败:', err);
					uni.showToast({ title: '跳转失败', icon: 'none' });
				}
			});
		},
		clearAllTimers() {
			// 清除对手答题定时器
			const timerCount = this.opponentTimers.length;
			this.opponentTimers.forEach(timer => {
				if (timer) {
					clearTimeout(timer);
				}
			});
			this.opponentTimers = [];
			console.log('[TEST-10.2] 🧹 已清除', timerCount, '个对手答题定时器');
			
			// 清除题目倒计时
			if (this.questionTimer) {
				clearInterval(this.questionTimer);
				this.questionTimer = null;
				console.log('[TEST-10.2] 🧹 已清除题目倒计时定时器');
			}
		},
		resetGame() {
			this.clearAllTimers();
			this.gameState = 'matching';
			this.currentIndex = 0;
			this.myScore = 0;
			this.opponentScore = 0;
			this.myProgress = 0;
			this.opProgress = 0;
			this.opponentFound = false;
			this.opponent = { name: '寻找中...', avatar: '' };
			this.aiSummary = 'AI 正在分析本场对局...';
			this.userChoice = null;
			this.opponentChoice = null;
			this.opponentAnswered = false;
			this.showAns = false;
			this.opponentRushing = false;
			this.timeLeft = 30;
			this.accuracy = 0;
			this.averageTime = 0;
			this.knowledgePoints = [];
			this.isScoreUploaded = false; // 重置分数上传标志
			
			// 重新随机抽取题目
			const allQuestions = uni.getStorageSync('v30_bank') || [];
			const shuffled = [...allQuestions].sort(() => Math.random() - 0.5);
			this.questions = shuffled.slice(0, Math.min(5, shuffled.length));
			
			this.startMatching();
		},
		handleResultStageClick(e) {
			// 点击结算页空白区域，不做任何操作（已通过 @tap.stop 阻止冒泡）
			// 如果需要点击空白处返回，可以在这里实现
			console.log('[PK-BATTLE] 点击结算页空白区域');
		},
		handleExitFromResult() {
			// 从结算页退出
			uni.showModal({
				title: '确认退出？',
				content: '退出后将返回首页',
				success: (res) => {
					if (res.confirm) {
						this.clearAllTimers();
						this.goHome();
					}
				}
			});
		},
		// 生成海报并上传分数 - 全新设计理念：知识的碰撞与荣耀时刻
		async handleShare() {
			// 防止重复点击
			if (this.isGeneratingShare) {
				return;
			}
			
			this.isGeneratingShare = true;
			// 使用 mask: true 禁用 Loading 期间的交互
			uni.showLoading({ 
				title: '生成战报中...',
				mask: true // 禁用交互，防止点击退出
			});
			
			// 设置超时处理，避免无限等待
			const timeoutTimer = setTimeout(() => {
				if (this.isGeneratingShare) {
					console.error('[PK-BATTLE] 生成战报超时');
					uni.hideLoading();
					this.isGeneratingShare = false;
					uni.showToast({ 
						title: '生成战报超时，请稍后重试', 
						icon: 'none',
						duration: 2000
					});
				}
			}, 10000); // 10秒超时
			
			try {
			// A. 自动静默上传分数到排行榜（数据闭环）
			// uploadScoreToRank 内部已有锁机制，防止重复上传
			console.log('[TEST-10.3] 📤 分享时尝试上传分数（如果尚未上传）');
			this.uploadScoreToRank().catch(err => {
				console.error('[TEST-10.3] ❌ 分享时上传分数失败:', err);
			});

				// B. 开始 Canvas 绘图 - 全新设计理念
				const ctx = uni.createCanvasContext('shareCanvas', this);
				const W = 375; // 画布宽
				const H = 600; // 画布高（增加高度以容纳更多内容）
				
				const isVictory = this.myScore >= this.opponentScore;
				
				// ========== 胜利版海报设计 ==========
				if (isVictory) {
					// -- 1. 背景 - 皇家蓝与紫罗兰极光渐变 --
					const gradient = ctx.createLinearGradient(0, 0, W, H);
					gradient.addColorStop(0, '#1E3A8A'); // 皇家蓝
					gradient.addColorStop(0.5, '#7C3AED'); // 紫罗兰
					gradient.addColorStop(1, '#1E3A8A');
					ctx.setFillStyle(gradient);
					ctx.fillRect(0, 0, W, H);
					
					// 金色流光点缀
					ctx.setFillStyle('rgba(255, 215, 0, 0.2)');
					ctx.fillRect(0, 0, W, 4);
					
					// -- 2. 头部：荣耀宣告 --
					ctx.setFontSize(32);
					ctx.setFillStyle('#FFD700'); // 金色
					ctx.setTextAlign('center');
					ctx.fillText('PK 胜利！', W / 2, 60);
					
					ctx.setFontSize(14);
					ctx.setFillStyle('rgba(255, 255, 255, 0.8)');
					ctx.fillText('在知识巅峰对决中胜出！', W / 2, 85);
					
					// -- 3. 核心对决区（非对称设计）--
					// 左侧（赢家 - 自身视角）
					// 头像框（带金色月桂叶特效）
					ctx.setFillStyle('rgba(255, 215, 0, 0.3)');
					ctx.beginPath();
					ctx.arc(100, 150, 50, 0, Math.PI * 2);
					ctx.fill();
					
					ctx.setFontSize(18);
					ctx.setFillStyle('var(--bg-card)');
					ctx.fillText(this.userInfo.nickName || '考研人', 100, 220);
					
					// 核心比分 - 巨大发光数字
					ctx.setFontSize(80);
					ctx.setFillStyle('#FFD700');
					ctx.fillText(this.myScore.toString(), 100, 280);
					
					ctx.setFontSize(12);
					ctx.setFillStyle('rgba(255, 255, 255, 0.7)');
					ctx.fillText('本局得分', 100, 300);
					
					// 中间 VS 闪电符号
					ctx.setFontSize(24);
					ctx.setFillStyle('#FFD700');
					ctx.fillText('⚡', W / 2, 200);
					
					// 右侧（对手）
					ctx.setFillStyle('rgba(255, 255, 255, 0.2)');
					ctx.beginPath();
					ctx.arc(275, 150, 40, 0, Math.PI * 2);
					ctx.fill();
					
					ctx.setFontSize(14);
					ctx.setFillStyle('rgba(255, 255, 255, 0.6)');
					ctx.fillText(this.opponent.name, 275, 220);
					
					ctx.setFontSize(48);
					ctx.setFillStyle('rgba(255, 255, 255, 0.5)');
					ctx.fillText(this.opponentScore.toString(), 275, 260);
					
					// -- 4. 战绩深度分析区（三个卡片）--
					const cardY = 350;
					const cardWidth = (W - 60) / 3;
					
					// 卡片1：精准度
					ctx.setFillStyle('rgba(255, 255, 255, 0.15)');
					ctx.fillRect(20, cardY, cardWidth - 10, 100);
					ctx.setFontSize(20);
					ctx.setFillStyle('#FFD700');
					ctx.fillText('🎯', 20 + (cardWidth - 10) / 2, cardY + 30);
					ctx.setFontSize(16);
					ctx.setFillStyle('var(--bg-card)');
					ctx.fillText(`${this.accuracy}%`, 20 + (cardWidth - 10) / 2, cardY + 55);
					ctx.setFontSize(11);
					ctx.setFillStyle('rgba(255, 255, 255, 0.7)');
					ctx.fillText('精准度', 20 + (cardWidth - 10) / 2, cardY + 75);
					
					// 卡片2：速度压制
					ctx.setFillStyle('rgba(255, 255, 255, 0.15)');
					ctx.fillRect(20 + cardWidth, cardY, cardWidth - 10, 100);
					ctx.setFontSize(20);
					ctx.setFillStyle('#FFD700');
					ctx.fillText('⚡', 20 + cardWidth + (cardWidth - 10) / 2, cardY + 30);
					ctx.setFontSize(16);
					ctx.setFillStyle('var(--bg-card)');
					ctx.fillText(`${this.averageTime.toFixed(1)}s`, 20 + cardWidth + (cardWidth - 10) / 2, cardY + 55);
					ctx.setFontSize(11);
					ctx.setFillStyle('rgba(255, 255, 255, 0.7)');
					ctx.fillText('快如闪电', 20 + cardWidth + (cardWidth - 10) / 2, cardY + 75);
					
					// 卡片3：知识点覆盖
					ctx.setFillStyle('rgba(255, 255, 255, 0.15)');
					ctx.fillRect(20 + cardWidth * 2, cardY, cardWidth - 10, 100);
					ctx.setFontSize(20);
					ctx.setFillStyle('#FFD700');
					ctx.fillText('📚', 20 + cardWidth * 2 + (cardWidth - 10) / 2, cardY + 30);
					ctx.setFontSize(16);
					ctx.setFillStyle('var(--bg-card)');
					ctx.fillText(`${this.knowledgePoints.length}`, 20 + cardWidth * 2 + (cardWidth - 10) / 2, cardY + 55);
					ctx.setFontSize(11);
					ctx.setFillStyle('rgba(255, 255, 255, 0.7)');
					ctx.fillText('知识点', 20 + cardWidth * 2 + (cardWidth - 10) / 2, cardY + 75);
					
					// -- 5. 底部：激励文案 --
					ctx.setFontSize(14);
					ctx.setFillStyle('var(--bg-card)');
					ctx.fillText('保持状态，下一个状元就是你！', W / 2, 520);
					
					ctx.setFontSize(11);
					ctx.setFillStyle('rgba(255, 255, 255, 0.6)');
					ctx.fillText('Exam Master - 考研刷题助手', W / 2, 550);
				} else {
					// ========== 失败版海报设计 ==========
					// -- 1. 背景 - 静谧蓝与青色渐变 --
					const gradient = ctx.createLinearGradient(0, 0, W, H);
					gradient.addColorStop(0, '#0EA5E9'); // 静谧蓝
					gradient.addColorStop(0.5, '#06B6D4'); // 青色
					gradient.addColorStop(1, '#0EA5E9');
					ctx.setFillStyle(gradient);
					ctx.fillRect(0, 0, W, H);
					
					// 暖橙色点缀（鼓励、希望）
					ctx.setFillStyle('rgba(255, 165, 0, 0.15)');
					ctx.fillRect(0, 0, W, 4);
					
					// -- 2. 头部：鼓励标题 --
					ctx.setFontSize(28);
					ctx.setFillStyle('var(--bg-card)');
					ctx.setTextAlign('center');
					ctx.fillText('惜败！差一点点就赢了', W / 2, 60);
					
					// -- 3. 核心对决区 --
					ctx.setFontSize(64);
					ctx.setFillStyle('var(--bg-card)');
					ctx.fillText(this.myScore.toString(), W / 2, 180);
					
					ctx.setFontSize(14);
					ctx.setFillStyle('rgba(255, 255, 255, 0.8)');
					ctx.fillText('VS', W / 2, 220);
					
					ctx.setFontSize(48);
					ctx.setFillStyle('rgba(255, 255, 255, 0.6)');
					ctx.fillText(this.opponentScore.toString(), W / 2, 260);
					
					// -- 4. 本局进步点 --
					ctx.setFillStyle('rgba(255, 255, 255, 0.15)');
					ctx.fillRect(30, 300, W - 60, 80);
					
					ctx.setFontSize(14);
					ctx.setFillStyle('#FFA500'); // 暖橙色
					ctx.fillText('本局进步点', W / 2, 330);
					
					ctx.setFontSize(12);
					ctx.setFillStyle('rgba(255, 255, 255, 0.8)');
					ctx.fillText('虽然输了，但你的历史类题目全对！', W / 2, 360);
					
					// -- 5. 差距分析 --
					ctx.setFontSize(12);
					ctx.setFillStyle('rgba(255, 255, 255, 0.7)');
					ctx.fillText('对手比你快了0.5秒', W / 2, 420);
					ctx.fillText('引导用户去提升速度', W / 2, 440);
					
					// -- 6. 底部：鼓励文案 --
					ctx.setFontSize(14);
					ctx.setFillStyle('var(--bg-card)');
					ctx.fillText('不服！再战一局', W / 2, 520);
					
					ctx.setFontSize(11);
					ctx.setFillStyle('rgba(255, 255, 255, 0.6)');
					ctx.fillText('Exam Master - 考研刷题助手', W / 2, 550);
				}
			
				// C. 渲染并导出图片
				ctx.draw(false, () => {
					setTimeout(() => { // 延时确保绘制完成
						clearTimeout(timeoutTimer); // 清除超时定时器
						
						uni.canvasToTempFilePath({
							canvasId: 'shareCanvas',
							width: W,
							height: H,
							destWidth: W * 3, // 3倍超清
							destHeight: H * 3,
							success: (res) => {
								uni.hideLoading();
								this.isGeneratingShare = false;
								// 全屏预览海报
								uni.previewImage({
									urls: [res.tempFilePath],
									fail: () => {
										uni.showToast({ title: '预览失败', icon: 'none' });
									}
								});
							},
							fail: (err) => {
								console.error('[PK-BATTLE] 绘图失败', err);
								uni.hideLoading();
								this.isGeneratingShare = false;
								uni.showToast({ title: '绘图失败，请稍后重试', icon: 'none' });
							}
						}, this);
					}, 1000); // 增加延时，确保绘制完成
				});
			} catch (error) {
				// 捕获所有错误，确保关闭 Loading
				console.error('[PK-BATTLE] 生成战报异常:', error);
				clearTimeout(timeoutTimer);
				uni.hideLoading();
				this.isGeneratingShare = false;
				uni.showToast({ 
					title: '生成战报失败，请稍后重试', 
					icon: 'none',
					duration: 2000
				});
			}
		},
		
		// 辅助方法：上传分数到排行榜
		async uploadScoreToRank() {
			// 🔒 锁机制：防止重复上传
			if (this.isScoreUploaded) {
				console.log('[TEST-10.3] ⏭️ 分数已上传，跳过重复上传');
				return;
			}
			// 立即设置标志位，防止并发调用
			this.isScoreUploaded = true;
			
			console.log('[TEST-9.3] 🏆 开始上传分数到排行榜');
			console.log('[TEST-10.3] 🏆 开始上传分数到排行榜');
			
			// 优先使用 EXAM_USER_ID（与登录系统一致）
			const userId = uni.getStorageSync('EXAM_USER_ID') || '';
			const userInfo = uni.getStorageSync('userInfo') || {};
			
			// 如果没登录，就不传了
			if (!userId && !userInfo.nickName) {
				console.warn('[TEST-9.3] ⚠️ 用户未登录，跳过上传分数');
				console.warn('[TEST-10.3] ⚠️ 用户未登录，跳过上传分数');
				return;
			}
			
			// 确保所有必要字段都有值（提供默认值）
			const nickName = userInfo.nickName || userInfo.name || '考研人';
			const avatarUrl = userInfo.avatarUrl || userInfo.avatar || this.defaultAvatar;
			const finalUserId = userId || userInfo.uid || `temp_${Date.now()}`;
			
			// TEST-10.3: 获取当前总分数，然后累加 PK 本局得分
			let currentTotalScore = 0;
			try {
				console.log('[TEST-10.3] 🔍 开始获取当前总分数...');
				// 先获取排行榜数据，查找当前用户的总分数
				const rankRes = await lafService.rankCenter({ action: 'get_rank' });
				console.log('[TEST-10.3] 📥 排行榜 API 响应:', {
					code: rankRes?.code,
					hasData: !!rankRes?.data,
					dataLength: rankRes?.data?.length || 0
				});
				
				if (rankRes && rankRes.code === 0 && rankRes.data) {
					console.log('[TEST-10.3] 🔍 查找用户记录:', {
						userId: finalUserId,
						nickName: nickName,
						totalRecords: rankRes.data.length
					});
					
					const myRecord = rankRes.data.find(item => 
						item._id === finalUserId || 
						item.nickName === nickName ||
						item.name === nickName
					);
					
					if (myRecord) {
						console.log('[TEST-10.3] ✅ 找到用户记录:', {
							_id: myRecord._id,
							nickName: myRecord.nickName,
							score: myRecord.score,
							scoreType: typeof myRecord.score
						});
						
						if (myRecord.score !== undefined && myRecord.score !== null) {
							currentTotalScore = Number(myRecord.score) || 0;
							console.log('[TEST-10.3] 📊 获取到当前总分数:', currentTotalScore);
						} else {
							console.warn('[TEST-10.3] ⚠️ 用户记录中没有 score 字段，使用 0 作为初始分数');
						}
					} else {
						console.log('[TEST-10.3] ⚠️ 未找到用户记录，使用 0 作为初始分数（可能是新用户）');
					}
				} else {
					console.warn('[TEST-10.3] ⚠️ 排行榜 API 返回无效数据，使用 0 作为初始分数');
				}
			} catch (err) {
				console.error('[TEST-10.3] ❌ 获取当前总分数失败，使用 0 作为初始分数:', err);
			}
			
			// 计算新总分数 = 当前总分数 + PK 本局得分
			const pkScore = this.myScore; // PK 本局得分（0-100分）
			const newTotalScore = currentTotalScore + pkScore;
			
			console.log('[TEST-10.3] 📊 分数计算:', {
				currentTotalScore: currentTotalScore,
				pkScore: pkScore,
				newTotalScore: newTotalScore,
				calculation: `${currentTotalScore} + ${pkScore} = ${newTotalScore}`
			});
			
			const uploadData = {
				action: 'update_score',
				uid: finalUserId, // 兼容旧版本后端
				userId: finalUserId, // Sealos 后端可能期望这个字段名
				nickName: nickName, // 必须：昵称（有默认值）
				avatarUrl: avatarUrl, // 必须：头像URL（有默认值）
				score: newTotalScore // 必须：总分数（当前总分数 + PK 本局得分）
			};
			
			console.log('[TEST-9.3] 📤 发送分数更新请求:', {
				url: '/rank-center',
				action: 'update_score',
				userId: finalUserId,
				score: newTotalScore,
				nickName: nickName,
				hasAvatarUrl: !!avatarUrl
			});
			
			console.log('[TEST-10.3] 📤 发送分数更新请求:', {
				url: '/rank-center',
				action: 'update_score',
				userId: finalUserId,
				currentTotalScore: currentTotalScore,
				pkScore: pkScore,
				newTotalScore: newTotalScore,
				nickName: nickName,
				hasAvatarUrl: !!avatarUrl
			});
			
			console.log('[TEST-9.3] 📤 发送数据（完整）:', JSON.stringify(uploadData, null, 2));
			console.log('[TEST-10.3] 📤 发送数据（完整）:', JSON.stringify(uploadData, null, 2));
			console.log('[TEST-9.3] 📤 字段验证:', {
				hasUid: !!uploadData.uid,
				hasUserId: !!uploadData.userId,
				hasNickName: !!uploadData.nickName,
				hasAvatarUrl: !!uploadData.avatarUrl,
				hasScore: typeof uploadData.score === 'number',
				scoreValue: uploadData.score,
				uidValue: uploadData.uid,
				userIdValue: uploadData.userId
			});
			
			// 已迁移到 Sealos：使用 lafService.rankCenter 替代 uniCloud.callFunction('rank-center')
			// 静默上传，不显示 loading（避免打断用户体验）
			lafService.rankCenter(uploadData)
				.then(res => {
					// 标志位已在方法开头设置，这里只记录成功日志
					console.log('[TEST-9.3] ✅ 分数上传成功:', {
						code: res?.code,
						message: res?.msg,
						newRecord: res?.newRecord,
						oldScore: res?.oldScore,
						newScore: res?.newScore || newTotalScore
					});
					console.log('[TEST-10.3] ✅ 分数上传成功:', {
						code: res?.code,
						message: res?.msg,
						newRecord: res?.newRecord,
						oldScore: res?.oldScore || currentTotalScore,
						newScore: res?.newScore || newTotalScore,
						pkScore: pkScore,
						scoreIncrement: pkScore,
						isScoreUploaded: this.isScoreUploaded
					});
					// 可选：静默提示
					// uni.showToast({ title: '已上传排行榜', icon: 'success', duration: 1000 });
				})
				.catch(err => {
					// 🔒 修复 Module 10 Bug: 采用 "Fire and Forget" 策略
					// 上传失败时，不重置标志位，防止重复上传
					// 原因：网络超时可能导致数据已写入但响应失败，重试会造成重复上传
					console.error('[TEST-9.3] ❌ 上传分数失败（已锁定，不再重试）:', err);
					console.error('[TEST-10.3] ❌ 上传分数失败（已锁定，不再重试）:', err);
					console.log('[TEST-10.3] 🔒 isScoreUploaded 保持为 true，防止重复上传');
					// 静默失败，不影响用户分享体验
				});
		},
		handleExit() {
			uni.showModal({
				title: '确认退出？',
				content: '退出后将丢失当前匹配进度',
				success: (res) => {
					if (res.confirm) {
						this.clearAllTimers();
						uni.navigateBack();
					}
				}
			});
		},
		handleQuit() {
			uni.showModal({
				title: '退出对战',
				content: '中途退出将视为放弃本局，确定吗？',
				confirmColor: '#FF3B30', // iOS 红
				success: (res) => {
					if (res.confirm) {
						this.clearAllTimers();
						// 返回首页（TabBar 页面）
						uni.switchTab({ 
							url: '/src/pages/index/index',
							fail: () => {
								uni.navigateBack();
							}
						});
					}
				}
			});
		}
	}
};
</script>

<style>
/* iOS 风格全局容器 */
.container { 
	min-height: 100vh; 
	background-color: var(--text-primary); 
	background-image: linear-gradient(180deg, #1C1C1E 0%, var(--text-primary) 100%);
	color: var(--bg-card);
	font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', sans-serif;
	position: relative;
}
.container. {
	background: var(--bg-body);
}

/* 极光背景 */
.aurora-bg {
	position: absolute; 
	top: 0; 
	left: 0; 
	width: 100%; 
	height: 100%;
	background: radial-gradient(circle at 10% 10%, rgba(0, 229, 255, 0.15), transparent 40%),
	            radial-gradient(circle at 90% 90%, rgba(255, 60, 60, 0.15), transparent 40%);
	z-index: 0;
	animation: auroraShift 8s ease-in-out infinite;
	pointer-events: none; /* 确保背景不拦截点击事件 */
}

@keyframes auroraShift {
	0%, 100% { opacity: 0.6; }
	50% { opacity: 1; }
}

/* 雷达扫描动画 */
.radar-scanner {
	position: absolute;
	top: 50%;
	left: 50%;
	transform: translate(-50%, -50%);
	width: 400rpx;
	height: 400rpx;
	z-index: 1;
}

.radar-circle {
	position: absolute;
	top: 50%;
	left: 50%;
	transform: translate(-50%, -50%);
	border: 2rpx solid rgba(0, 229, 255, 0.3);
	border-radius: 50%;
}

.radar-circle.radar-1 {
	width: 300rpx;
	height: 300rpx;
	animation: radarPulse 2s infinite;
}

.radar-circle.radar-2 {
	width: 350rpx;
	height: 350rpx;
	animation: radarPulse 2s infinite 0.3s;
}

.radar-circle.radar-3 {
	width: 400rpx;
	height: 400rpx;
	animation: radarPulse 2s infinite 0.6s;
}

.radar-line {
	position: absolute;
	top: 50%;
	left: 50%;
	width: 200rpx;
	height: 2rpx;
	background: linear-gradient(90deg, transparent, rgba(0, 229, 255, 0.8), transparent);
	transform-origin: left center;
	animation: radarRotate 2s linear infinite;
}

@keyframes radarPulse {
	0% { opacity: 1; transform: translate(-50%, -50%) scale(0.8); }
	100% { opacity: 0; transform: translate(-50%, -50%) scale(1.2); }
}

@keyframes radarRotate {
	0% { transform: translate(-50%, -50%) rotate(0deg); }
	100% { transform: translate(-50%, -50%) rotate(360deg); }
}

/* 匹配阶段 */
.matching-stage { 
	height: 100%; 
	display: flex; 
	flex-direction: column; 
	align-items: center; 
	justify-content: center; 
	z-index: 10; 
	position: relative;
	padding-top: calc(env(safe-area-inset-top, 0px) + 60px); /* 增加顶部间距，避免头像与刘海屏重叠 */
	padding-bottom: env(safe-area-inset-bottom, 0px);
	box-sizing: border-box;
}
.match-core { 
	display: flex; 
	align-items: center; 
	gap: 40rpx; 
	margin-bottom: 60rpx; 
	position: relative;
	z-index: 2;
}
.avatar-ring { 
	width: 180rpx; 
	height: 180rpx; 
	border-radius: 90rpx; 
	border: 4rpx solid #00E5FF; 
	padding: 10rpx; 
	background: rgba(30, 30, 30, 0.8); 
	position: relative;
	backdrop-filter: blur(10px);
}
.user-avatar { 
	width: 100%; 
	height: 100%; 
	border-radius: 50%; 
}
.vs-text { 
	font-size: 60rpx; 
	font-weight: 900; 
	font-style: italic; 
	color: #FFF; 
	text-shadow: 0 0 20rpx rgba(0, 229, 255, 0.5);
}
.opponent-ring { 
	border-color: #666; 
}
.opponent-ring.found { 
	border-color: #FF3C3C; 
	animation: foundPulse 0.5s ease-out;
}
.search-overlay { 
	position: absolute; 
	top: 0; 
	left: 0; 
	width: 100%; 
	height: 100%; 
	background: rgba(0, 0, 0, 0.5); 
	border-radius: 50%; 
	display: flex;
	align-items: center;
	justify-content: center;
}
.search-icon {
	font-size: 60rpx;
	opacity: 0.6;
	animation: pulse 1.5s infinite;
}
.match-status {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 20rpx;
	position: relative;
	z-index: 2;
}
.status-title {
	font-size: 36rpx;
	font-weight: bold;
	color: #FFF;
}
.status-tip {
	font-size: 24rpx;
	color: rgba(255, 255, 255, 0.6);
}
.exit-btn {
	margin-top: 60rpx;
	padding: 20rpx 60rpx;
	background: rgba(255, 255, 255, 0.1);
	border-radius: 50rpx;
	font-size: 28rpx;
	color: #FFF;
	border: 1rpx solid rgba(255, 255, 255, 0.2);
	position: relative;
	z-index: 2;
}

/* 全局：深空黑 */
.pk-container {
	min-height: 100vh;
	background: radial-gradient(circle at center top, #2C2C2E 0%, var(--text-primary) 100%);
	padding: 0 24px;
	padding-top: calc(env(safe-area-inset-top, 0px) + 30px); /* 增加顶部间距，整体下移，避免与胶囊按钮重叠 */
	padding-bottom: env(safe-area-inset-bottom, 0px); /* 底部安全区域 */
	color: #fff;
	position: relative;
	z-index: 1; /* 确保在对战阶段时，pk-container 在 aurora-bg 之上 */
	box-sizing: border-box;
}

/* 顶部栏 */
.top-bar {
	display: flex;
	justify-content: space-between;
	align-items: center;
	margin-bottom: 20px; /* 减少底部间距，整体下移 */
	margin-top: 10px; /* 增加顶部间距 */
}

.icon-btn {
	width: 36px;
	height: 36px;
	background: rgba(255, 255, 255, 0.15);
	border-radius: 50%;
	display: flex;
	align-items: center;
	justify-content: center;
	backdrop-filter: blur(10px);
	transition: all 0.2s;
}

.icon-btn:active {
	background: rgba(255, 255, 255, 0.25);
	transform: scale(0.95);
}

.icon-btn.ghost {
	opacity: 0;
}

.round-badge {
	background: rgba(0, 0, 0, 0.5);
	border: 1px solid rgba(255, 255, 255, 0.1);
	padding: 4px 14px;
	border-radius: 100px;
	font-size: 13px;
	color: #8E8E93;
	font-weight: 600;
}

/* 战场区 */
.battle-stage {
	display: flex;
	justify-content: space-between;
	align-items: center;
	margin-bottom: 40px;
	margin-top: 20px; /* 与顶部栏保持间距，避免与胶囊按钮重叠 */
}

.player-card {
	display: flex;
	flex-direction: column;
	align-items: center;
	width: 80px;
}

.avatar {
	width: 64px;
	height: 64px;
	border-radius: 50%;
	border: 2px solid rgba(255, 255, 255, 0.1);
	margin-bottom: 8px;
	box-shadow: 0 8px 16px rgba(0, 0, 0, 0.5);
}

.score {
	font-size: 28px;
	font-weight: 800;
	line-height: 1;
	margin-bottom: 6px;
}

.score.me {
	color: #00E5FF;
	text-shadow: 0 0 10px rgba(0, 229, 255, 0.3);
}

.score.opp {
	color: #FF3B30;
	text-shadow: 0 0 10px rgba(255, 59, 48, 0.3);
}

.progress-track {
	width: 100%;
	height: 4px;
	background: #333;
	border-radius: 2px;
	overflow: hidden;
}

.progress-fill {
	height: 100%;
	transition: width 0.3s;
	border-radius: 2px;
}

.progress-fill.me {
	background: #00E5FF;
}

.progress-fill.opp {
	background: #FF3B30;
}

.progress-fill.opp.rush {
	animation: barRush 0.5s ease-out;
}

@keyframes barRush {
	0% { transform: scaleX(1); }
	50% { transform: scaleX(1.05); }
	100% { transform: scaleX(1); }
}

.vs-text {
	font-style: italic;
	font-weight: 900;
	font-size: 24px;
	color: #3A3A3C;
}

/* 题目卡片 */
.question-card {
	background: rgba(44, 44, 46, 0.6);
	backdrop-filter: blur(20px);
	-webkit-backdrop-filter: blur(20px);
	border-radius: 20px;
	padding: 24px;
	min-height: 100px;
	margin-bottom: 24px;
	border: 1px solid rgba(255, 255, 255, 0.05);
}

.question-header {
	display: flex;
	justify-content: space-between;
	align-items: center;
	margin-bottom: 12px;
}

.tag {
	display: inline-block;
	background: #0A84FF;
	font-size: 10px;
	padding: 2px 6px;
	border-radius: 4px;
	font-weight: bold;
	color: var(--bg-card);
}

.timer-badge {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	background: rgba(52, 199, 89, 0.2);
	border: 1px solid rgba(52, 199, 89, 0.5);
	border-radius: 12px;
	padding: 4px 12px;
	min-width: 50px;
	transition: all 0.3s;
}

.timer-badge.warning {
	background: rgba(255, 193, 7, 0.2);
	border-color: rgba(255, 193, 7, 0.5);
	animation: pulse-warning 1s infinite;
}

.timer-badge.danger {
	background: rgba(255, 59, 48, 0.2);
	border-color: rgba(255, 59, 48, 0.5);
	animation: pulse-danger 0.5s infinite;
}

.timer-text {
	font-size: 14px;
	font-weight: bold;
	color: #34C759;
}

.timer-badge.warning .timer-text {
	color: #FFC107;
}

.timer-badge.danger .timer-text {
	color: #FF3B30;
}

@keyframes pulse-warning {
	0%, 100% { opacity: 1; }
	50% { opacity: 0.7; }
}

@keyframes pulse-danger {
	0%, 100% { opacity: 1; transform: scale(1); }
	50% { opacity: 0.8; transform: scale(1.05); }
}

.q-text {
	font-size: 17px;
	line-height: 1.5;
	font-weight: 500;
	color: var(--bg-card);
}

/* 选项列表 */
.options-group {
	display: flex;
	flex-direction: column;
	gap: 12px;
	padding-bottom: calc(env(safe-area-inset-bottom) + 20px); /* 底部安全区域 + 额外间距 */
	margin-bottom: 20px;
}

.opt-btn {
	background: transparent;
	border: none;
	padding: 0;
	margin: 0;
	width: 100%;
	position: relative;
	z-index: 10;
	cursor: pointer;
	-webkit-tap-highlight-color: transparent;
}

.opt-btn::after {
	border: none;
}

.opt-btn-inner {
	background: rgba(28, 28, 30, 1);
	padding: 16px 20px;
	border-radius: 16px;
	display: flex;
	align-items: center;
	border: 1px solid transparent;
	transition: all 0.2s;
	width: 100%;
	box-sizing: border-box;
}

.opt-btn:active .opt-btn-inner {
	transform: scale(0.98);
	background: #3A3A3C;
}

.opt-btn.disabled {
	pointer-events: none;
	opacity: 0.6;
}

.letter {
	width: 28px;
	height: 28px;
	background: #3A3A3C;
	border-radius: 50%;
	text-align: center;
	line-height: 28px;
	font-size: 14px;
	font-weight: bold;
	color: #AEAEB2;
	margin-right: 14px;
	flex-shrink: 0;
}

.content {
	font-size: 16px;
	color: #fff;
	flex: 1;
}

.opt-icon {
	font-size: 18px;
	font-weight: bold;
	margin-left: 8px;
	flex-shrink: 0;
}

/* 状态色 */
.opt-btn.selected .opt-btn-inner {
	border-color: #0A84FF;
	background: rgba(10, 132, 255, 0.1);
}

.opt-btn.selected .letter {
	background: #0A84FF;
	color: #fff;
}

.opt-btn.correct .opt-btn-inner {
	border-color: #34C759;
	background: rgba(52, 199, 89, 0.1);
}

.opt-btn.wrong .opt-btn-inner {
	border-color: #FF3B30;
	background: rgba(255, 59, 48, 0.1);
}

.opt-btn.correct {
	border-color: #30D158;
	background: rgba(48, 209, 88, 0.15);
}

.opt-btn.correct .letter {
	background: #30D158;
	color: #fff;
}

.opt-btn.correct .opt-icon {
	color: #30D158;
}

.opt-btn.wrong {
	border-color: #FF453A;
	background: rgba(255, 69, 58, 0.15);
}

.opt-btn.wrong .letter {
	background: #FF453A;
	color: #fff;
}

.opt-btn.wrong .opt-icon {
	color: #FF453A;
}

.opponent-status {
	text-align: center;
	padding: 20px;
	margin: 20px 0;
	margin-bottom: calc(env(safe-area-inset-bottom, 0px) + 40px); /* 再次上移，增加与底部按钮的间距 */
}

.opponent-tip {
	color: rgba(255, 255, 255, 0.6);
	font-size: 14px;
}

.footer-placeholder {
	height: 100rpx;
}

/* 结算 - 绿色主题，高级质感 */
.result-stage { 
	height: 100vh; 
	display: flex; 
	align-items: center; 
	justify-content: center; 
	padding: 40rpx; 
	box-sizing: border-box; 
	position: relative;
	z-index: 10;
	background: linear-gradient(135deg, var(--bg-body) 0%, #0F2400 50%, var(--bg-body) 100%);
	background-size: 200% 200%;
	animation: gradientShift 8s ease infinite;
}
@keyframes gradientShift {
	0%, 100% { background-position: 0% 50%; }
	50% { background-position: 100% 50%; }
}
.result-glass { 
	width: 100%; 
	padding: 60rpx 40rpx; 
	text-align: center;
	background: rgba(22, 51, 0, 0.85);
	backdrop-filter: blur(30px);
	-webkit-backdrop-filter: blur(30px);
	border-radius: 32rpx;
	border: 1px solid rgba(159, 232, 112, 0.2);
	box-shadow: 0 20rpx 60rpx rgba(0, 0, 0, 0.3),
	            0 0 40rpx rgba(159, 232, 112, 0.1);
}
.result-header {
	margin-bottom: 40rpx;
}
.result-icon {
	font-size: 120rpx;
	margin-bottom: 20rpx;
	animation: resultBounce 0.5s ease-out;
}
@keyframes resultBounce {
	0% { transform: scale(0); }
	50% { transform: scale(1.2); }
	100% { transform: scale(1); }
}
.result-title { 
	font-size: 80rpx; 
	font-weight: 900; 
	display: block; 
	margin-bottom: 10rpx; 
	letter-spacing: 4rpx;
}
.result-title.victory {
	color: var(--brand-color); /* Wise 绿色 */
	text-shadow: 0 0 30rpx rgba(159, 232, 112, 0.6),
	             0 0 60rpx rgba(159, 232, 112, 0.3);
}
.result-title.defeat {
	color: #FF6B6B; /* 柔和的红色 */
	text-shadow: 0 0 30rpx rgba(255, 107, 107, 0.5);
}
.result-subtitle { 
	font-size: 28rpx; 
	color: rgba(255, 255, 255, 0.7); 
	display: block;
}
/* AI 战报分析卡片样式 - 绿色主题，高级质感 */
.ai-report-box {
	margin: 40rpx 0;
	padding: 30rpx;
	background: rgba(159, 232, 112, 0.08); /* Wise 绿色微透明 */
	border-radius: 24rpx;
	border: 1px solid rgba(159, 232, 112, 0.25);
	width: 100%;
	box-sizing: border-box;
	animation: fadeIn 0.5s ease;
	position: relative;
	overflow: hidden;
	backdrop-filter: blur(10px);
	-webkit-backdrop-filter: blur(10px);
}

.ai-report-box::before {
	content: '';
	position: absolute;
	top: 0;
	left: -100%;
	width: 100%;
	height: 100%;
	background: linear-gradient(90deg, transparent, rgba(159, 232, 112, 0.15), transparent);
	animation: shine 3s infinite;
}

@keyframes shine {
	0% { left: -100%; }
	100% { left: 100%; }
}

.ai-header {
	display: flex;
	align-items: center;
	margin-bottom: 16rpx;
	position: relative;
	z-index: 1;
}

.ai-icon {
	font-size: 32rpx;
	margin-right: 12rpx;
}

.ai-title {
	color: var(--brand-color); /* Wise 绿色 */
	font-size: 28rpx;
	font-weight: bold;
	text-shadow: 0 0 10rpx rgba(159, 232, 112, 0.5);
}

.ai-text {
	color: var(--bg-card);
	font-size: 28rpx;
	line-height: 1.8;
	text-align: left;
	display: block;
	white-space: pre-wrap;
	position: relative;
	z-index: 1;
	font-weight: 500;
	text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
	min-height: 60rpx;
}

/* 兼容原有的 ai-summary 样式 */
.ai-summary { 
	background: rgba(255, 255, 255, 0.05); 
	padding: 30rpx; 
	border-radius: 20rpx; 
	margin: 40rpx 0; 
	text-align: left; 
	border: 1rpx solid rgba(255, 255, 255, 0.1);
}
.ai-summary .tag { 
	display: inline-block; 
	background: #00E5FF; 
	color: #000; 
	font-size: 20rpx; 
	padding: 4rpx 12rpx; 
	border-radius: 6rpx; 
	margin-bottom: 10rpx; 
	font-weight: bold;
}
.summary-text { 
	font-size: 26rpx; 
	color: rgba(255, 255, 255, 0.8); 
	line-height: 1.6; 
	display: block;
	white-space: pre-wrap;
}

.action-btns { 
	display: flex; 
	flex-wrap: wrap;
	gap: 20rpx; 
	margin-top: 40rpx;
}
.btn-share { 
	flex: 1; 
	min-width: calc(50% - 10rpx);
	background: rgba(159, 232, 112, 0.15); 
	border-radius: 16rpx; 
	font-size: 28rpx;
	border: 1px solid rgba(159, 232, 112, 0.3);
	color: var(--brand-color);
	padding: 20rpx 0;
	font-weight: 600;
	transition: all 0.3s ease;
}
.btn-share:active {
	background: rgba(159, 232, 112, 0.25);
	transform: scale(0.98);
}
.btn-share::after {
	border: none;
}
.btn-again { 
	flex: 1; 
	min-width: calc(50% - 10rpx);
	background: linear-gradient(135deg, var(--brand-color), #7ED321); 
	color: var(--bg-body); 
	border-radius: 16rpx; 
	font-size: 28rpx;
	border: none;
	padding: 20rpx 0;
	font-weight: bold;
	box-shadow: 0 4rpx 12rpx rgba(159, 232, 112, 0.3);
	transition: all 0.3s ease;
}
.btn-again:active {
	transform: scale(0.98);
	box-shadow: 0 2rpx 8rpx rgba(159, 232, 112, 0.2);
}
.btn-again::after {
	border: none;
}
.btn-rank {
	flex: 1;
	min-width: calc(50% - 10rpx);
	background: linear-gradient(135deg, #FFD700, #FFA500);
	color: var(--bg-body);
	border-radius: 16rpx;
	font-size: 28rpx;
	border: none;
	padding: 20rpx 0;
	font-weight: bold;
	box-shadow: 0 4rpx 12rpx rgba(255, 215, 0, 0.3);
	transition: all 0.3s ease;
}
.btn-rank:active {
	transform: scale(0.98);
	box-shadow: 0 2rpx 8rpx rgba(255, 215, 0, 0.2);
}
.btn-rank::after {
	border: none;
}
.btn-home {
	flex: 1;
	min-width: 100%;
	background: rgba(255, 255, 255, 0.08);
	border-radius: 16rpx;
	font-size: 28rpx;
	border: 1px solid rgba(255, 255, 255, 0.15);
	color: rgba(255, 255, 255, 0.9);
	padding: 20rpx 0;
	font-weight: 500;
	transition: all 0.3s ease;
}
.btn-home:active {
	background: rgba(255, 255, 255, 0.12);
	transform: scale(0.98);
}
.btn-home::after {
	border: none;
}
.btn-exit {
	flex: 1;
	min-width: 100%;
	background: rgba(255, 107, 107, 0.15);
	border-radius: 16rpx;
	font-size: 28rpx;
	border: 1px solid rgba(255, 107, 107, 0.3);
	color: #FF6B6B;
	padding: 20rpx 0;
	margin-top: 20rpx;
	font-weight: 500;
	transition: all 0.3s ease;
}
.btn-exit:active {
	background: rgba(255, 107, 107, 0.25);
	transform: scale(0.98);
}
.btn-exit::after {
	border: none;
}

/* 动画 */
@keyframes pulse { 
	0% { opacity: 0.3; } 
	50% { opacity: 1; } 
	100% { opacity: 0.3; } 
}
.pulse {
	animation: pulse 2s infinite;
}
@keyframes foundPulse {
	0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(255, 60, 60, 0.7); }
	50% { transform: scale(1.05); box-shadow: 0 0 0 20rpx rgba(255, 60, 60, 0); }
	100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(255, 60, 60, 0); }
}
@keyframes fadeIn {
	from { opacity: 0; transform: translateY(20rpx); }
	to { opacity: 1; transform: translateY(0); }
}

/* 红光警告遮罩（最后5秒）- 参考苹果AI呼吸感 */
.red-warning-overlay {
	position: fixed;
	top: 0;
	left: 0;
	right: 0;
	bottom: 0;
	background: rgba(255, 0, 0, 0.4);
	z-index: 9998;
	pointer-events: none;
	animation: redWarningBreath 1.5s ease-in-out infinite;
}

@keyframes redWarningBreath {
	0% {
		opacity: 0.15;
		background: rgba(255, 0, 0, 0.15);
		filter: blur(0px);
	}
	50% {
		opacity: 0.6;
		background: rgba(255, 0, 0, 0.6);
		filter: blur(2px);
	}
	100% {
		opacity: 0.15;
		background: rgba(255, 0, 0, 0.15);
		filter: blur(0px);
	}
}
</style>
