<template>
	<view :class="['container', { 'dark-mode': isDark }]">
		<view class="aurora-bg"></view>

		<!-- 骨架屏 -->
		<mistake-skeleton v-if="isInitLoading" :isDark="isDark" />

		<!-- 导航栏 - 添加设计系统工具类 -->
		<view class="header-nav" :style="{ paddingTop: statusBarHeight + 'px' }" v-show="!isInitLoading">
			<view class="nav-content ds-flex ds-flex-between">
				<text class="nav-back ds-touchable" @tap="goBack">←</text>
				<text class="nav-title ds-text-lg ds-font-semibold">我的错题本</text>
				<view class="nav-actions">
					<!-- 移除垃圾桶图标 -->
					<view class="nav-placeholder"></view>
				</view>
			</view>
		</view>

		<scroll-view scroll-y class="main-scroll" :style="{ paddingTop: (statusBarHeight + 50) + 'px' }"
			@scrolltolower="loadMore" v-show="!isInitLoading">
			<!-- 统计卡片区域 -->
			<view class="stats-grid" v-if="mistakes.length > 0">
				<stats-card title="错题总数" :value="mistakes.length" icon="📝" :isDark="isDark" />
				<stats-card title="待复习" :value="pendingReviewCount" icon="🔄" change="需要巩固"
					changeType="neutral" :isDark="isDark" />
			</view>

			<!-- 模式切换 - 优化布局 -->
			<view class="mode-switch glass-card ds-flex ds-gap-xs" v-if="mistakes.length > 0">
				<view :class="['mode-item', 'ds-flex-center', 'ds-touchable', { active: mode === 'quiz' }]"
					@tap="switchMode('quiz')">
					<text class="ds-text-sm ds-font-medium">刷题模式</text>
				</view>
				<view :class="['mode-item', 'ds-flex-center', 'ds-touchable', { active: mode === 'recite' }]"
					@tap="switchMode('recite')">
					<text class="ds-text-sm ds-font-medium">背诵模式</text>
				</view>
			</view>

			<!-- 空状态 - 优化样式 -->
			<view v-if="mistakes.length === 0 && !isInitLoading" class="empty-box ds-flex-col ds-flex-center">
				<text class="empty-icon">🎉</text>
				<text class="empty-title ds-text-lg ds-font-bold">太厉害了！</text>
				<text class="empty-text ds-text-sm">暂时没有错题，继续保持这个状态！</text>
				<text class="empty-hint ds-text-xs">刷题过程中答错的题目会自动收录到这里</text>
				<view class="go-practice-btn ds-touchable" @tap="goBack">
					<text>📝 去刷题</text>
				</view>
			</view>

			<!-- 错题列表 -->
			<view v-for="(item, index) in mistakes" :key="index" class="glass-card mistake-card">
				<view class="card-tag">{{ getCategory(item) }}</view>
				<text class="question-text">{{ item.question || item.question_content || '题目内容加载中...' }}</text>

				<!-- 错题重做区域 -->
				<view v-if="item.isPracticing" class="practice-area">
					<view class="options-list practice-options">
						<view v-for="(opt, i) in item.options" :key="i" class="option-row"
							:class="{ 'selected': practiceChoices[index] === i, 'disabled': isAnalyzing }"
							@tap="selectPracticeOption(index, i)">
							<text class="opt-idx">{{ ['A', 'B', 'C', 'D'][i] }}</text>
							<text class="opt-text">{{ opt }}</text>
						</view>
					</view>
					<view class="practice-actions">
						<button class="action-btn primary" @tap="submitPractice(index)"
							:disabled="practiceChoices[index] === undefined || isAnalyzing">
							提交答案
						</button>
						<button class="action-btn" @tap="cancelPractice(index)">取消</button>
					</view>
					<view class="practice-result" v-if="practiceResults[index]">
						<text class="result-icon" :class="practiceResults[index].isCorrect ? 'correct' : 'wrong'">
							{{ practiceResults[index].isCorrect ? '✓' : '✗' }}
						</text>
						<text class="result-text">
							{{ practiceResults[index].isCorrect ? '回答正确！' : '回答错误，再试一次！' }}
						</text>
						<text class="result-desc">
							{{ practiceResults[index].feedback }}
						</text>
					</view>
				</view>

				<!-- 普通错题展示区域 -->
				<view v-else>
					<view class="options-list">
						<view v-for="(opt, i) in item.options" :key="i" class="option-row">
							<text class="opt-idx" :class="{
								'correct': (mode === 'recite' || item.showAnalysis) && ['A', 'B', 'C', 'D'][i] === (item.answer || item.correct_answer),
								'wrong': (mode === 'recite' || item.showAnalysis) && item.userChoice && item.userChoice.charAt(0) === ['A', 'B', 'C', 'D'][i] && item.userChoice.charAt(0) !== (item.answer || item.correct_answer)
							}">
								{{ ['A', 'B', 'C', 'D'][i] }}
							</text>
							<text class="opt-text">{{ opt }}</text>
						</view>
					</view>

					<view class="analysis-box" v-if="mode === 'recite' || item.showAnalysis">
						<view class="correct-ans">正确答案：{{ item.answer || item.correct_answer || '未知' }}</view>
						<view class="analysis-content">
							<text class="label">AI 解析：</text>
							{{ item.desc || item.analysis || '暂无解析' }}
						</view>
					</view>
				</view>

				<view class="card-footer">
					<text class="time-text">{{ formatDate(item.addTime || item.created_at || item.timestamp) }}</text>
					<view class="wrong-count" v-if="(item.wrongCount || item.wrong_count || 0) > 1">
						<text class="count-icon">⚠️</text>
						<text class="count-text">错误 {{ item.wrongCount || item.wrong_count || 1 }} 次</text>
					</view>
					<view class="actions">
						<button class="action-btn sm" @tap="toggleAnalysis(index)"
							v-if="mode === 'quiz' && !item.isPracticing">
							{{ item.showAnalysis ? '隐藏解析' : '查看解析' }}
						</button>
						<button class="action-btn sm primary" @tap="startPractice(index)" v-if="!item.isPracticing">
							重做此题
						</button>
						<button class="action-btn sm del" @tap="removeMistake(index)"
							v-if="!item.isPracticing">移除</button>
					</view>
				</view>
			</view>

			<!-- 一键清空按钮（显示在列表最底部） - 优化样式 -->
			<view v-if="mistakes.length > 0 && !isLoading" class="clear-all-section">
				<button class="clear-all-btn ds-flex ds-flex-center ds-gap-xs ds-touchable" @tap="clearAllMistakes">
					<text class="clear-all-icon">🗑️</text>
					<text class="clear-all-text ds-text-sm ds-font-semibold">清空所有错题</text>
				</button>
			</view>

			<view class="safe-area"></view>
		</scroll-view>

		<!-- 生成 AI 诊断报告按钮 - 优化样式 -->
		<view class="bottom-bar" v-if="mistakes.length > 0">
			<button class="export-btn ds-flex ds-flex-center ds-gap-xs" @tap="prepareReport" :disabled="isGenerating">
				<text class="export-icon">📊</text>
				<view class="export-text-wrapper ds-flex-center">
					<text class="export-text ds-text-sm ds-font-bold">
						{{ isGenerating ? 'AI 正在深度诊断...' : '生成 AI 诊断报告' }}
					</text>
				</view>
			</button>
		</view>

		<!-- Canvas 用于绘制报告 -->
		<canvas canvas-id="reportCanvas" class="report-canvas"></canvas>

		<!-- 自定义Loading界面 -->
		<view class="custom-loading-mask" v-if="showCustomLoading">
			<view class="custom-loading-card">
				<view class="loading-spinner">
					<view class="spinner-ring"></view>
				</view>
				<text class="loading-text">AI 正在深度诊断...</text>
				<text class="loading-desc">请稍候，正在生成专属报告</text>
			</view>
		</view>

		<!-- 报告预览弹窗 - 优化样式 -->
		<view class="report-modal" v-if="showReportModal" v-show="showReportModal">
			<view class="modal-bg" @tap="closeReport"></view>
			<view class="modal-content">
				<view class="modal-header ds-flex ds-flex-between">
					<text class="modal-title ds-text-xl ds-font-bold">AI 诊断报告</text>
					<view class="modal-close ds-flex-center ds-rounded-full ds-touchable" @tap="closeReport">
						<text class="modal-close-icon">×</text>
					</view>
				</view>
				<scroll-view scroll-y class="modal-scroll">
					<image v-if="reportImagePath" :src="reportImagePath" mode="widthFix" class="report-image"
						@error="handleImageError" @load="handleImageLoad"></image>
					<view v-else class="loading-placeholder">
						<text class="ds-text-sm">图片加载中...</text>
					</view>
				</scroll-view>
				<view class="modal-footer ds-flex ds-gap-xs">
					<button class="modal-btn secondary ds-font-bold" @tap="closeReport">关闭</button>
					<button class="modal-btn primary ds-font-bold" @tap="saveReport"
						:disabled="!reportImagePath">保存到相册</button>
				</view>
			</view>
		</view>
	</view>
</template>

<script>
import { lafService } from '../../services/lafService.js'
import { storageService } from '../../services/storageService.js'
import MistakeSkeleton from '../../components/base/mistake-skeleton/mistake-skeleton.vue'
import StatsCard from '../../components/v0/StatsCard.vue'
// ✅ 检查点 5.1: 导入分析服务
import { analytics } from '../../utils/analytics/event-bus-analytics.js'
// ✅ 检查点 5.3: 导入自适应学习引擎
import { recordReview } from '../../utils/learning/adaptive-learning-engine.js'
// ✅ 统一日志工具（生产环境自动禁用）
import { logger } from '../../utils/logger.js'

export default {
	components: {
		MistakeSkeleton,
		StatsCard
	},
	data() {
		return {
			statusBarHeight: 44,
			mistakes: [],
			mode: 'quiz', // 'quiz' 或 'recite'
			isGenerating: false,
			userInfo: {},
			isDark: false,
			// 错题重做相关数据
			practiceChoices: {}, // { index: choiceIndex }
			practiceResults: {}, // { index: { isCorrect: boolean, feedback: string } }
			isAnalyzing: false,
			showReportModal: false,
			reportImagePath: '',
			showCustomLoading: false, // 自定义loading界面
			// 分页相关
			currentPage: 1,
			pageSize: 20,
			hasMore: true,
			isLoading: false,
			isInitLoading: true // 初始骨架屏加载状态
		};
	},
	onLoad(options) {
		const sys = uni.getSystemInfoSync();
		this.statusBarHeight = sys.statusBarHeight || sys.safeAreaInsets?.top || 44;

		// 初始化主题
		const savedTheme = storageService.get('theme_mode', 'light');
		this.isDark = savedTheme === 'dark';

		// 监听全局主题更新事件
		uni.$on('themeUpdate', (mode) => {
			this.isDark = mode === 'dark';
		});

	},
	onUnload() {
		// 移除事件监听
		uni.$off('themeUpdate');
	},
	computed: {
		// 待复习错题数量（错误次数>=2的题目）
		pendingReviewCount() {
			return this.mistakes.filter(item => (item.wrongCount || item.wrong_count || 1) >= 2).length;
		}
	},
	onShow() {
		this.loadData(true); // 重置并重新加载
		this.loadUserInfo();
		// 自动同步待同步的错题
		this.syncPendingMistakes();
	},
	methods: {
		loadMore() {
			const nextPage = this.currentPage + 1;
			logger.log(`[mistake-book] 📄 触底加载: page=${nextPage}, isLoading=${this.isLoading}, hasMore=${this.hasMore}`);
			if (this.isLoading || !this.hasMore) {
				logger.log(`[mistake-book] ⏸️ 分页加载被阻止 - isLoading: ${this.isLoading}, hasMore: ${this.hasMore}`);
				return;
			}
			this.currentPage = nextPage;
			logger.log(`[mistake-book] ➡️ 开始加载第 ${this.currentPage} 页（追加模式）`);
			this.loadData(false);
		},
		loadUserInfo() {
			this.userInfo = storageService.get('userInfo', { nickName: '考研人' });
		},
		async syncPendingMistakes() {
			try {
				logger.log('[mistake-book] 开始自动同步待同步错题...');
				const result = await storageService.syncPendingMistakes();
				if (result.synced > 0) {
					logger.log(`[mistake-book] ✅ 同步完成: ${result.synced} 条错题已同步到云端`);
					// 如果同步成功，重新加载列表以显示更新后的 ID
					if (result.synced > 0) {
						// 延迟一下，确保本地存储已更新
						setTimeout(() => {
							this.loadData(true);
						}, 300);
					}
				} else if (result.failed > 0) {
					logger.warn(`[mistake-book] ⚠️ 同步部分失败: ${result.failed} 条错题未能同步`);
				}
			} catch (error) {
				logger.error('[mistake-book] 同步待同步错题异常:', error);
			}
		},
		async loadData(reset = false) {
			if (this.isLoading) {
				logger.log('[mistake-book] ⏸️ 加载中，跳过重复请求');
				return;
			}

			this.isLoading = true;
			logger.log(`[mistake-book] 🔄 开始加载数据 - reset: ${reset}, currentPage: ${this.currentPage}, pageSize: ${this.pageSize}`);

			try {
				if (reset) {
					this.currentPage = 1;
					this.mistakes = [];
					logger.log('[mistake-book] 🔄 重置状态，从第1页开始加载');
				}

				logger.log(`[mistake-book] 📡 调用 storageService.getMistakes(${this.currentPage}, ${this.pageSize})`);
				// 使用云端方法获取错题列表
				const result = await storageService.getMistakes(this.currentPage, this.pageSize);
				logger.log('[mistake-book] ✅ 数据加载完成:', {
					count: result?.list?.length || 0,
					total: result?.total || 0,
					page: result?.page || this.currentPage,
					hasMore: result?.hasMore || false,
					source: result?.source || 'unknown'
				});

				if (result && result.list) {
					const beforeCount = this.mistakes.length;
					if (reset) {
						this.mistakes = result.list;
						logger.log(`[mistake-book] ✅ 重置模式：加载了 ${result.list.length} 条错题`);
					} else {
						// 追加数据（用于分页加载）
						this.mistakes = [...this.mistakes, ...result.list];
						logger.log(`[mistake-book] ✅ 追加模式：从 ${beforeCount} 条增加到 ${this.mistakes.length} 条（新增 ${result.list.length} 条）`);
					}

					this.hasMore = result.hasMore || false;
					logger.log(`[mistake-book] 📊 当前状态 - 总错题数: ${this.mistakes.length}, hasMore: ${this.hasMore}, currentPage: ${this.currentPage}`);

					// 空状态检查
					if (this.mistakes.length === 0) {
						logger.log(`[mistake-book] 📭 空状态：错题列表为空，显示空状态UI`);
					}

					// 初始化 showAnalysis 属性
					this.mistakes.forEach(item => {
						if (item.showAnalysis === undefined) {
							this.$set(item, 'showAnalysis', false);
						}
					});

					// 如果从云端获取，本地缓存已在 storageService.getMistakes 中更新（包含合并逻辑）
					if (result.source === 'cloud' && this.currentPage === 1) {
						logger.log('[mistake-book] ✅ 云端数据已加载并合并本地待同步数据');
					}
				} else {
					// 降级到本地读取
					this.mistakes = storageService.get('mistake_book', []);
					this.mistakes.forEach(item => {
						if (item.showAnalysis === undefined) {
							this.$set(item, 'showAnalysis', false);
						}
					});
				}
			} catch (error) {
				logger.error('加载错题列表失败:', error);
				// 降级到本地读取
				this.mistakes = storageService.get('mistake_book', []);
				this.mistakes.forEach(item => {
					if (item.showAnalysis === undefined) {
						this.$set(item, 'showAnalysis', false);
					}
				});
			} finally {
				this.isLoading = false;
				this.isInitLoading = false; // 隐藏骨架屏
			}
		},
		goBack() {
			// 从空状态跳转到刷题页面
			uni.switchTab({
				url: '/src/pages/practice/index'
			});
		},
		clearAllMistakes() {
			// 一键清空所有错题
			if (this.mistakes.length === 0) {
				return uni.showToast({ title: '已经没有错题了', icon: 'none' });
			}

			uni.showModal({
				title: '清空错题本',
				content: `确定要清空所有 ${this.mistakes.length} 道错题吗？此操作不可恢复。`,
				confirmColor: '#FF3B30',
				success: async (res) => {
					if (res.confirm) {
						uni.showLoading({ title: '清空中...' });

						try {
							logger.log('[mistake-book] 🧹 开始清空所有错题...');

							// 获取所有错题的 ID
							const mistakeIds = this.mistakes
								.map(m => m.id || m._id)
								.filter(Boolean);

							// 批量删除云端错题
							let deletedCount = 0;
							for (const id of mistakeIds) {
								try {
									const result = await storageService.removeMistake(id);
									if (result.success) {
										deletedCount++;
									}
								} catch (error) {
									logger.warn(`[mistake-book] ⚠️ 删除错题失败: ${id}`, error);
								}
							}

							// 清空本地缓存
							storageService.remove('mistake_book');

							// 清空列表
							this.mistakes = [];
							this.currentPage = 1;
							this.hasMore = false;

							logger.log(`[mistake-book] ✅ 清空完成: 已删除 ${deletedCount}/${mistakeIds.length} 条云端错题，本地缓存已清空`);
							logger.log(`[mistake-book] 📭 空状态：错题列表为空，显示空状态UI`);

							uni.hideLoading();
							const totalCount = mistakeIds.length;
							uni.showToast({
								title: totalCount > 0 ? `已清空 ${totalCount} 道错题` : '已清空所有错题',
								icon: 'success',
								duration: 2000
							});

							// 触发空状态显示（延迟一下确保 UI 更新）
							this.$nextTick(() => {
								this.$forceUpdate();
							});
						} catch (error) {
							logger.error('[mistake-book] ❌ 清空错题失败:', error);
							uni.hideLoading();
							uni.showToast({
								title: '清空失败，请重试',
								icon: 'none',
								duration: 2000
							});
						}
					}
				}
			});
		},
		formatDate(ts) {
			if (!ts) return '未知时间';

			// 支持多种时间格式
			let timestamp = ts;

			// 如果是字符串格式的时间（如 "2026/1/21 12:30:00"），尝试解析
			if (typeof ts === 'string') {
				// 尝试解析字符串格式的时间
				const parsed = new Date(ts);
				if (!isNaN(parsed.getTime())) {
					timestamp = parsed.getTime();
				} else {
					return '未知时间';
				}
			}

			// 如果是时间戳（数字），直接使用
			const d = new Date(timestamp);
			if (isNaN(d.getTime())) {
				return '未知时间';
			}

			return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${d.getMinutes().toString().padStart(2, '0')}`;
		},
		getCategory(item) {
			return item.category || '未分类';
		},
		switchMode(newMode) {
			// 切换模式，确保Vue响应式更新
			this.mode = newMode;
			// 强制触发视图更新
			this.$forceUpdate();
		},
		toggleAnalysis(index) {
			this.mistakes[index].showAnalysis = !this.mistakes[index].showAnalysis;
			// 仅更新本地缓存（UI状态，不需要同步到云端）
			storageService.save('mistake_book', this.mistakes, true);
		},
		async removeMistake(index) {
			const mistake = this.mistakes[index];
			if (!mistake) return;

			uni.showModal({
				title: '移除题目',
				content: '掌握了吗？移除后无法恢复。',
				confirmColor: '#FF3B30',
				success: async (res) => {
					if (res.confirm) {
						uni.showLoading({ title: '删除中...' });

						try {
							// 使用云端方法删除
							const mistakeId = mistake.id || mistake._id;
							logger.log(`[mistake-book] 开始删除错题: ${mistakeId} (index: ${index})`);
							const result = await storageService.removeMistake(mistakeId);

							if (result.success) {
								// 从列表中移除
								this.mistakes.splice(index, 1);
								logger.log(`[mistake-book] ✅ 删除成功，列表剩余 ${this.mistakes.length} 条错题`);
								uni.showToast({ title: '已移除', icon: 'success' });
							} else {
								// 如果云端删除失败，尝试本地删除
								logger.warn(`[mistake-book] ⚠️ 删除失败，降级到本地删除: ${result.error}`);
								this.mistakes.splice(index, 1);
								storageService.save('mistake_book', this.mistakes, true);
								uni.showToast({ title: '已移除（本地）', icon: 'none' });
							}
						} catch (error) {
							logger.error('[mistake-book] 删除错题异常:', error);
							// 降级到本地删除
							this.mistakes.splice(index, 1);
							storageService.save('mistake_book', this.mistakes, true);
							uni.showToast({ title: '已移除（本地）', icon: 'none' });
						} finally {
							uni.hideLoading();
						}
					}
				}
			});
		},
		exportToCanvas() {
			if (this.mistakes.length === 0) return;
			uni.showLoading({ title: '正在生成试卷...' });

			// 这里简化处理，实际可以使用 canvas 生成图片
			setTimeout(() => {
				uni.hideLoading();
				uni.showToast({
					title: '导出功能即将上线',
					icon: 'none'
				});
			}, 1000);
		},
		async prepareReport() {
			if (this.mistakes.length === 0) {
				return uni.showToast({ title: '先刷题积累错题才能生成报告哦', icon: 'none' });
			}

			if (this.isGenerating) return;

			// 重置状态
			this.isGenerating = true;
			this.showCustomLoading = true;
			this.showReportModal = false;
			this.reportImagePath = '';

			// 汇总所有错题的标题和分类
			const mistakeSummary = this.mistakes.map((m, i) => {
				const questionText = (m.question || m.question_content || m.title || '题目内容').substring(0, 50);
				const safeQuestionText = questionText.replace(/[\u0000-\u001F\u007F-\u009F\u2000-\u200B]/g, '').trim();
				const category = m.category || '未分类';
				const safeCategory = category.replace(/[\u0000-\u001F\u007F-\u009F\u2000-\u200B]/g, '').trim();
				return `${i + 1}. [${safeCategory}] ${safeQuestionText}`;
			}).join('\n');

			try {
				// ✅ 使用后端代理调用（安全）- action: 'report'
				// 后端会自动添加 "你是一位资深考研规划师..." 的 Prompt
				const response = await lafService.proxyAI('report', {
					userName: this.userInfo.nickName || '考研人',
					mistakeSummary: mistakeSummary,
					mistakeCount: this.mistakes.length
				});

				// 处理响应
				if (response.code === 0 && response.data) {
					const reportText = response.data.trim();
					const finalReportText = typeof reportText === 'string' ? reportText : JSON.stringify(reportText);

					// 调用绘制报告
					try {
						await this.drawReport(finalReportText);
						logger.log('[mistake] 报告生成完成，等待弹窗显示');
					} catch (drawError) {
						logger.error('[mistake] 绘制报告失败:', drawError);
						this.showCustomLoading = false;
						this.isGenerating = false;
					}
				} else {
					// API 返回错误
					logger.error('[mistake] AI报告生成失败:', response.message);
					this.showCustomLoading = false;
					this.isGenerating = false;
					uni.showToast({ title: '报告生成失败，请重试', icon: 'none', duration: 3000 });
				}
			} catch (e) {
				logger.error('[mistake] AI 报告生成失败', e);
				this.showCustomLoading = false;
				this.isGenerating = false;

				let errorMsg = '网络错误，请检查网络后重试';
				if (e.message && e.message.includes('timeout')) {
					errorMsg = '请求超时，请稍后重试';
				} else if (e.message && e.message.includes('401')) {
					errorMsg = 'AI 服务配置异常，请联系管理员';
				} else if (e.message && e.message.includes('500')) {
					errorMsg = '服务器错误，请稍后重试';
				} else if (e.message && e.message.includes('JSON')) {
					errorMsg = '数据解析失败，请重试';
				}

				uni.showToast({
					title: errorMsg,
					icon: 'none',
					duration: 3000
				});
			}
		},
		closeReport() {
			logger.log('[mistake] 关闭报告弹窗');
			this.$set(this, 'showReportModal', false);
			// 延迟清空图片路径
			setTimeout(() => {
				this.$set(this, 'reportImagePath', '');
			}, 300);
		},
		handleImageError(e) {
			logger.error('[mistake] 图片加载失败:', e);
			uni.showToast({
				title: '图片加载失败',
				icon: 'none',
				duration: 2000
			});
			// 如果图片加载失败，关闭弹窗
			this.showReportModal = false;
		},
		handleImageLoad() {
			logger.log('[mistake] 图片加载成功');
		},
		saveReport() {
			if (!this.reportImagePath) return;

			// #ifdef MP-WECHAT
			uni.saveImageToPhotosAlbum({
				filePath: this.reportImagePath,
				success: () => {
					uni.showToast({ title: '已保存到相册', icon: 'success' });
					this.showReportModal = false;
				},
				fail: (err) => {
					logger.error(err);
					if (err.errMsg && err.errMsg.includes('auth')) {
						uni.showModal({
							title: '提示',
							content: '需要保存到相册权限',
							success: (res) => {
								if (res.confirm) uni.openSetting();
							}
						});
					} else {
						uni.showToast({ title: '保存失败', icon: 'none' });
					}
				}
			});
			// #endif

			// #ifndef MP-WECHAT
			uni.saveImageToPhotosAlbum({
				filePath: this.reportImagePath,
				success: () => {
					uni.showToast({ title: '已保存到相册', icon: 'success' });
					this.showReportModal = false;
				},
				fail: (err) => {
					uni.showToast({ title: '保存失败', icon: 'none' });
				}
			});
			// #endif
		},
		drawReport(aiSummary) {
			return new Promise((resolve, reject) => {
				// 确保aiSummary是字符串格式
				if (!aiSummary || typeof aiSummary !== 'string') {
					logger.error('[mistake] drawReport: aiSummary必须是字符串', typeof aiSummary);
					aiSummary = String(aiSummary || '报告生成失败，请重试');
				}

				logger.log('[mistake] 开始绘制报告，内容长度:', aiSummary.length);

				try {
					// 获取canvas上下文
					const ctx = uni.createCanvasContext('reportCanvas', this);
					if (!ctx) {
						throw new Error('Canvas上下文创建失败');
					}

					const isDark = this.isDark;

					// 定义主题色
					const theme = {
						bgStart: isDark ? 'var(--bg-body)' : '#E8F5E9',
						bgEnd: isDark ? '#1E3A0F' : 'var(--bg-card)',
						titleColor: isDark ? '#2ECC71' : '#27AE60',
						mainText: isDark ? '#F1F5F9' : '#1A1A1A',
						subText: isDark ? '#94A3B8' : '#666666',
						cardBg: isDark ? 'rgba(30, 58, 15, 0.8)' : 'rgba(255, 255, 255, 0.8)',
						accent: '#2ECC71',
						dividerColor: isDark ? 'rgba(255, 255, 255, 0.1)' : '#E0E0E0'
					};

					// 绘制渐变背景
					const grad = ctx.createLinearGradient(0, 0, 0, 1334);
					grad.addColorStop(0, theme.bgStart);
					grad.addColorStop(1, theme.bgEnd);
					ctx.setFillStyle(grad);
					ctx.fillRect(0, 0, 750, 1334);

					// 绘制装饰光晕
					ctx.setGlobalAlpha(isDark ? 0.2 : 0.5);
					ctx.beginPath();
					ctx.arc(750, 0, 400, 0, 2 * Math.PI);
					ctx.setFillStyle(theme.accent);
					ctx.fill();
					ctx.setGlobalAlpha(1.0);

					// 标题
					ctx.setFillStyle(theme.titleColor);
					ctx.setFontSize(48);
					ctx.fillText('Exam Master', 50, 150);
					ctx.setFontSize(28);
					ctx.setFillStyle(theme.subText);
					ctx.fillText('AI 智能诊断报告', 50, 200);

					// 用户信息卡片
					this.drawStyledCard(ctx, 50, 250, 650, 180, 30, theme.cardBg);

					ctx.setFillStyle(theme.mainText);
					ctx.setFontSize(42);
					ctx.textAlign = 'left';
					const userName = this.userInfo.nickName || '考研人';
					ctx.fillText(userName, 100, 330);

					ctx.setFontSize(26);
					ctx.setFillStyle(theme.subText);
					const now = new Date();
					const dateStr = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`;
					ctx.fillText(`错题总数：${this.mistakes.length} 道  |  生成日期：${dateStr}`, 100, 390);

					// 能力雷达图
					const capabilityData = this.calculateCapabilityData();
					if (capabilityData && capabilityData.length > 0) {
						ctx.setFontSize(32);
						ctx.setFillStyle(theme.mainText);
						ctx.textAlign = 'left';
						ctx.fillText('学科能力模型', 80, 490);
						this.drawRadarChart(ctx, 375, 730, 160, capabilityData, theme);
					}

					// AI解析标题
					ctx.setFillStyle(theme.titleColor);
					ctx.setFontSize(32);
					ctx.textAlign = 'left';
					ctx.fillText('AI 深度诊断', 50, 1000);

					ctx.setStrokeStyle(theme.dividerColor);
					ctx.setLineWidth(2);
					ctx.beginPath();
					ctx.moveTo(50, 1020);
					ctx.lineTo(700, 1020);
					ctx.stroke();

					// AI解析正文
					ctx.setFillStyle(theme.mainText);
					ctx.setFontSize(28);
					this.drawWrappedText(ctx, aiSummary, 80, 1060, 590, 50);

					// 底部标语
					ctx.setFontSize(24);
					ctx.setFillStyle(theme.subText);
					ctx.textAlign = 'center';
					ctx.fillText('汗水铸就辉煌 · AI 伴你上岸', 375, 1330);

					// 执行绘制
					ctx.draw(false, () => {
						logger.log('[mistake] Canvas绘制完成');

						// 延迟后导出，确保canvas已完全渲染
						setTimeout(() => {
							logger.log('[mistake] 开始导出Canvas为图片');

							uni.canvasToTempFilePath({
								canvasId: 'reportCanvas',
								success: (res) => {
									logger.log('[mistake] Canvas导出成功:', res);

									const imagePath = res.tempFilePath || res.tempFilePaths?.[0] || '';

									if (!imagePath) {
										logger.error('[mistake] 图片路径为空');
										this.showCustomLoading = false;
										this.isGenerating = false;
										uni.showToast({
											title: '图片生成失败',
											icon: 'none',
											duration: 3000
										});
										reject(new Error('图片路径为空'));
										return;
									}

									logger.log('[mistake] 图片路径:', imagePath);

									// 使用$set确保响应式更新
									this.$set(this, 'reportImagePath', imagePath);
									this.$set(this, 'showCustomLoading', false);
									this.$set(this, 'isGenerating', false);

									// 等待一个tick后显示弹窗
									this.$nextTick(() => {
										this.$set(this, 'showReportModal', true);

										logger.log('[mistake] 弹窗状态已设置:', {
											showReportModal: this.showReportModal,
											reportImagePath: this.reportImagePath
										});

										// 强制更新视图
										this.$nextTick(() => {
											this.$forceUpdate();

											// 再次延迟确保弹窗显示
											setTimeout(() => {
												logger.log('[mistake] 最终状态:', {
													showReportModal: this.showReportModal,
													hasImage: !!this.reportImagePath
												});

												// 验证弹窗是否显示
												if (this.showReportModal && this.reportImagePath) {
													logger.log('[mistake] ✓ 报告弹窗应已显示');
													resolve(imagePath);
												} else {
													logger.warn('[mistake] ⚠ 弹窗可能未正确显示');
													// 即使验证失败也resolve，因为状态已设置
													resolve(imagePath);
												}
											}, 300);
										});
									});
								},
								fail: (err) => {
									logger.error('[mistake] Canvas导出失败:', err);
									this.showCustomLoading = false;
									this.isGenerating = false;
									uni.showToast({
										title: '图片生成失败：' + (err.errMsg || '未知错误'),
										icon: 'none',
										duration: 3000
									});
									reject(err);
								}
							}, this);
						}, 1500); // 延迟1.5秒确保canvas完全渲染
					});
				} catch (error) {
					logger.error('[mistake] drawReport执行失败:', error);
					this.showCustomLoading = false;
					this.isGenerating = false;
					uni.showToast({
						title: '报告生成失败：' + (error.message || '未知错误'),
						icon: 'none',
						duration: 3000
					});
					reject(error);
				}
			});
		},
		// --- 新增：计算各学科能力数据 ---
		calculateCapabilityData() {
			const allQuestions = storageService.get('v30_bank', []);
			const mistakes = this.mistakes || [];

			// 如果没有题库数据，返回模拟数据用于演示效果
			if (allQuestions.length === 0) {
				return [
					{ category: '马原', rate: 0.65 },
					{ category: '毛中特', rate: 0.85 },
					{ category: '思修', rate: 0.92 },
					{ category: '史纲', rate: 0.7 },
					{ category: '当代', rate: 0.55 }
				];
			}

			const stats = {};
			// 1. 初始化并统计各科总题数
			allQuestions.forEach(q => {
				const cat = q.category || '其他';
				if (!stats[cat]) stats[cat] = { total: 0, mistakes: 0 };
				stats[cat].total++;
			});

			// 2. 统计各科错题数
			mistakes.forEach(m => {
				const cat = m.category || '其他';
				if (stats[cat]) stats[cat].mistakes++;
			});

			// 3. 计算正确率并格式化数据 (为了视觉美观，最低分设为 0.3)
			const data = Object.keys(stats).map(cat => {
				const correctRate = (stats[cat].total - stats[cat].mistakes) / stats[cat].total;
				return {
					category: cat,
					rate: Math.max(0.3, correctRate || 0.3) // 防止除零或过低
				};
			});

			// 按正确率排序，取前 6 个主要维度，避免雷达图过于拥挤
			return data.sort((a, b) => b.rate - a.rate).slice(0, 6);
		},
		// --- 新增：Canvas 雷达图绘制通用函数 ---
		drawRadarChart(ctx, x, y, r, data, theme) {
			if (!data || data.length === 0) return;

			const numPoints = data.length;
			const angleStep = (2 * Math.PI) / numPoints;

			ctx.save();
			ctx.translate(x, y);
			ctx.rotate(-Math.PI / 2); // 旋转使第一个点位于正上方

			// 1. 绘制蜘蛛网背景 (5层同心多边形)
			ctx.setStrokeStyle(theme.subText);
			ctx.setLineWidth(1);
			ctx.setGlobalAlpha(0.2); // 降低背景网格透明度
			for (let level = 1; level <= 5; level++) {
				const levelRadius = (r / 5) * level;
				ctx.beginPath();
				for (let i = 0; i < numPoints; i++) {
					const angle = i * angleStep;
					const px = levelRadius * Math.cos(angle);
					const py = levelRadius * Math.sin(angle);
					if (i === 0) {
						ctx.moveTo(px, py);
					} else {
						ctx.lineTo(px, py);
					}
				}
				ctx.closePath();
				ctx.stroke();
			}

			// 2. 绘制轴线和文字标签
			ctx.setFontSize(24);
			ctx.setFillStyle(theme.mainText);
			ctx.setTextAlign('center');
			ctx.setTextBaseline('middle');
			ctx.setGlobalAlpha(0.8);
			ctx.setLineWidth(1);
			ctx.setStrokeStyle(theme.subText);

			for (let i = 0; i < numPoints; i++) {
				const angle = i * angleStep;
				const endX = r * Math.cos(angle);
				const endY = r * Math.sin(angle);
				const labelRadius = r + 40; // 文字离轴尖端的距离

				// 轴线
				ctx.beginPath();
				ctx.moveTo(0, 0);
				ctx.lineTo(endX, endY);
				ctx.stroke();

				// 标签 (需要反向旋转画布以保持文字水平)
				ctx.save();
				const labelX = labelRadius * Math.cos(angle);
				const labelY = labelRadius * Math.sin(angle);
				ctx.translate(labelX, labelY);
				// 计算文字应该旋转的角度，使文字水平显示
				// 由于画布已经旋转了 -Math.PI/2，所以需要额外旋转 Math.PI/2 + angle 来使文字水平
				ctx.rotate(Math.PI / 2 + angle);
				ctx.fillText(data[i].category, 0, 0);
				ctx.restore();
			}

			// 3. 绘制能力数据多边形
			ctx.setGlobalAlpha(1.0);
			ctx.beginPath();
			for (let i = 0; i < numPoints; i++) {
				const angle = i * angleStep;
				const dataRadius = r * data[i].rate;
				const px = dataRadius * Math.cos(angle);
				const py = dataRadius * Math.sin(angle);
				if (i === 0) {
					ctx.moveTo(px, py);
				} else {
					ctx.lineTo(px, py);
				}
			}
			ctx.closePath();

			// 填充半透明主题色
			ctx.setFillStyle(theme.accent);
			ctx.setGlobalAlpha(0.4);
			ctx.fill();

			// 描边高亮主题色
			ctx.setGlobalAlpha(1.0);
			ctx.setLineWidth(4);
			ctx.setStrokeStyle(theme.accent);
			ctx.setLineJoin('round');
			ctx.stroke();

			// 绘制数据点圆点
			ctx.setFillStyle('var(--bg-card)');
			ctx.setStrokeStyle(theme.accent);
			ctx.setLineWidth(2);
			for (let i = 0; i < numPoints; i++) {
				const angle = i * angleStep;
				const dataRadius = r * data[i].rate;
				const px = dataRadius * Math.cos(angle);
				const py = dataRadius * Math.sin(angle);
				ctx.beginPath();
				ctx.arc(px, py, 6, 0, 2 * Math.PI);
				ctx.fill();
				ctx.stroke();
			}

			ctx.restore();
		},
		// 辅助方法：绘制带阴影的圆角卡片
		drawStyledCard(ctx, x, y, w, h, r, fill) {
			ctx.save();
			// 深色模式下阴影更明显
			const shadowOpacity = this.isDark ? 0.3 : 0.1;
			ctx.setShadow(0, 4, 20, `rgba(0, 0, 0, ${shadowOpacity})`);
			ctx.beginPath();
			ctx.setFillStyle(fill);
			ctx.moveTo(x + r, y);
			ctx.arcTo(x + w, y, x + w, y + h, r);
			ctx.arcTo(x + w, y + h, x, y + h, r);
			ctx.arcTo(x, y + h, x, y, r);
			ctx.arcTo(x, y, x + w, y, r);
			ctx.closePath();
			ctx.fill();
			ctx.restore();
		},
		// 保留旧方法以兼容（已废弃，使用 drawStyledCard）
		drawRoundRect(ctx, x, y, w, h, r) {
			const fill = this.isDark ? 'rgba(30, 41, 59, 0.8)' : 'rgba(255,255,255,0.9)';
			this.drawStyledCard(ctx, x, y, w, h, r, fill);
		},
		// 文本换行绘制（支持中英文混合）
		drawWrappedText(ctx, text, x, y, maxWidth, lineHeight) {
			// 处理换行符
			const paragraphs = text.split('\n');
			let currentY = y;

			paragraphs.forEach((para, pIdx) => {
				if (pIdx > 0) {
					currentY += lineHeight * 0.5; // 段落间距
				}

				// 按字符分割（支持中文）
				const chars = para.split('');
				let line = '';

				for (let n = 0; n < chars.length; n++) {
					const testLine = line + chars[n];
					const metrics = ctx.measureText(testLine);

					if (metrics.width > maxWidth && n > 0) {
						ctx.fillText(line, x, currentY);
						line = chars[n];
						currentY += lineHeight;

						// 防止超出画布
						if (currentY > 1200) {
							ctx.fillText('...', x, currentY);
							return;
						}
					} else {
						line = testLine;
					}
				}

				if (line && currentY <= 1200) {
					ctx.fillText(line, x, currentY);
					currentY += lineHeight;
				}
			});
		},
		// 保留旧方法以兼容（已废弃，使用 drawWrappedText）
		drawText(ctx, text, x, y, maxWidth, lineHeight) {
			this.drawWrappedText(ctx, text, x, y, maxWidth, lineHeight);
		},
		// 错题重做相关方法
		startPractice(index) {
			// 开始错题重做
			this.$set(this.mistakes[index], 'isPracticing', true);
			this.$set(this.practiceChoices, index, undefined);
			this.$set(this.practiceResults, index, null);
		},
		selectPracticeOption(index, optionIndex) {
			// 选择答案
			this.$set(this.practiceChoices, index, optionIndex);
		},
		submitPractice(index) {
			// 提交答案
			if (this.practiceChoices[index] === undefined) {
				logger.log('[mistake-book] ⚠️ 未选择答案，无法提交');
				return;
			}

			const mistake = this.mistakes[index];
			const mistakeId = mistake.id || mistake._id;
			const selectedOption = this.practiceChoices[index];
			const selectedAnswer = ['A', 'B', 'C', 'D'][selectedOption];
			const correctAnswer = mistake.answer?.toUpperCase() || 'A';
			const correctOptionIndex = ['A', 'B', 'C', 'D'].indexOf(correctAnswer);
			const isCorrect = selectedOption === correctOptionIndex;

			logger.log(`[mistake-book] 📝 提交重做答案 - 错题ID: ${mistakeId}, 选择: ${selectedAnswer}, 正确答案: ${correctAnswer}, 是否正确: ${isCorrect}`);

			this.isAnalyzing = true;

			// 模拟AI分析延迟
			setTimeout(() => {
				this.isAnalyzing = false;

				// 更新练习结果
				const feedback = isCorrect
					? '太棒了！你已经掌握了这道题。'
					: `再想想！正确答案是 ${correctAnswer}。`;

				this.$set(this.practiceResults, index, {
					isCorrect,
					feedback
				});

				// ✅ 检查点 5.1: 追踪复习错题事件
				analytics.trackReviewMistake(mistakeId, isCorrect, {
					category: mistake.category,
					wrongCount: mistake.wrong_count || mistake.wrongCount || 1
				});
				
				// ✅ 检查点 5.3: 记录复习结果到自适应学习引擎
				if (mistakeId) {
					recordReview(mistakeId, isCorrect);
				}

				// 如果答对了，更新错题状态
				if (isCorrect) {
					logger.log(`[mistake-book] ✅ 答案正确，开始更新掌握状态 - 错题ID: ${mistakeId}`);

					// 更新本地状态
					this.$set(mistake, 'is_mastered', true);
					this.$set(mistake, 'isMastered', true);
					this.$set(mistake, 'isPracticing', false);
					this.$set(mistake, 'last_practice_time', Date.now());

					logger.log(`[mistake-book] ✅ 本地状态已更新 - is_mastered: true, last_practice_time: ${Date.now()}`);

					// 使用云端方法更新状态
					if (mistakeId) {
						logger.log(`[mistake-book] 📡 调用 storageService.updateMistakeStatus(${mistakeId}, true)`);
						storageService.updateMistakeStatus(mistakeId, true)
							.then(result => {
								if (result.success) {
									logger.log(`[mistake-book] ✅ 云端状态更新成功 - source: ${result.source}`);
									// 同步更新本地缓存
									storageService.save('mistake_book', this.mistakes, true);
									logger.log(`[mistake-book] ✅ 本地缓存已同步更新`);
								} else {
									logger.warn(`[mistake-book] ⚠️ 云端状态更新失败: ${result.error}`);
									// 降级到本地更新
									storageService.save('mistake_book', this.mistakes, true);
									logger.log(`[mistake-book] ✅ 已降级到本地更新`);
								}
							})
							.catch(err => {
								logger.error('[mistake-book] ❌ 更新错题状态异常:', err);
								// 降级到本地更新
								storageService.save('mistake_book', this.mistakes, true);
								logger.log(`[mistake-book] ✅ 已降级到本地更新（异常处理）`);
							});
					} else {
						// 如果没有ID，仅更新本地
						logger.warn('[mistake-book] ⚠️ 错题ID为空，仅更新本地状态');
						storageService.save('mistake_book', this.mistakes, true);
					}

					// 震动反馈
					try {
						if (typeof uni.vibrateShort === 'function') {
							uni.vibrateShort();
						}
					} catch (e) { }
				} else {
					logger.log(`[mistake-book] ❌ 答案错误，不更新掌握状态`);
				}
			}, 500);
		},
		cancelPractice(index) {
			// 取消练习
			this.$set(this.mistakes[index], 'isPracticing', false);
			this.$set(this.practiceChoices, index, undefined);
			this.$set(this.practiceResults, index, null);
		}
	}
};
</script>

<style lang="scss" scoped>
/* 统计卡片网格 */
.stats-grid {
	display: grid;
	grid-template-columns: repeat(2, 1fr);
	gap: 24rpx;
	padding: 0 30rpx;
	margin-bottom: 30rpx;
}

.container {
	min-height: 100vh;
	background: var(--bg-page);
	position: relative;
	overflow: hidden;
}

.aurora-bg {
	position: absolute;
	top: 0;
	width: 100%;
	height: 500rpx;
	background: var(--gradient-primary);
	filter: blur(80px);
	opacity: 0.6;
	z-index: 0;
}

.header-nav {
	position: fixed;
	top: 0;
	left: 0;
	width: 100%;
	z-index: 100;
	background: var(--bg-glass);
	backdrop-filter: blur(20px);

	.nav-content {
		height: 50px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0 30rpx;

		.nav-back {
			font-size: 36rpx;
			color: var(--text-primary);
			font-weight: bold;
		}

		.nav-title {
			font-size: 34rpx;
			font-weight: 600;
			color: var(--text-primary);
		}

		.nav-placeholder {
			width: 36rpx;
		}

		.nav-actions {
			display: flex;
			align-items: center;
		}

		.nav-clear-btn {
			display: flex;
			align-items: center;
			gap: 8rpx;
			padding: 8rpx 16rpx;
			border-radius: 20rpx;
			background: var(--danger-light);
			transition: all 0.2s;

			&:active {
				background: var(--danger-light);
				transform: scale(0.95);
			}

			.clear-icon {
				font-size: 28rpx;
			}

			.clear-text {
				font-size: 24rpx;
				color: var(--danger);
				font-weight: 500;
			}
		}
	}
}

.main-scroll {
	height: 100vh;
	padding: 30rpx;
	box-sizing: border-box;
	position: relative;
	z-index: 1;
}

.glass-card {
	background: var(--bg-card);
	backdrop-filter: blur(20px);
	border: 1px solid var(--border);
	border-radius: 40rpx;
	padding: 30rpx;
	margin-bottom: 30rpx;
	box-shadow: var(--shadow-md);
}

.mode-switch {
	display: flex;
	padding: 10rpx;
	border-radius: 20rpx;
	gap: 10rpx;

	.mode-item {
		flex: 1;
		padding: 20rpx 40rpx;
		border-radius: 20rpx;
		font-size: 26rpx;
		text-align: center;
		transition: 0.3s;
		color: var(--text-sub);

		&.active {
			background: var(--primary);
			color: var(--primary-foreground);
			font-weight: bold;
			box-shadow: var(--shadow-md);
		}
	}
}

.empty-box {
	text-align: center;
	padding-top: 150rpx;
	padding-bottom: 100rpx;

	.empty-icon {
		font-size: 160rpx;
		display: block;
		margin-bottom: 30rpx;
		animation: bounce 2s ease-in-out infinite;
	}
	
	@keyframes bounce {
		0%, 100% { transform: translateY(0); }
		50% { transform: translateY(-20rpx); }
	}
	
	.empty-title {
		color: var(--text-primary);
		font-size: 40rpx;
		font-weight: 700;
		margin-bottom: 16rpx;
		display: block;
	}

	.empty-text {
		color: var(--text-sub);
		font-size: 28rpx;
		margin-bottom: 16rpx;
		display: block;
	}
	
	.empty-hint {
		color: var(--text-sub);
		font-size: 24rpx;
		opacity: 0.7;
		margin-bottom: 60rpx;
		display: block;
	}

	.go-practice-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 12rpx;
		padding: 24rpx 64rpx;
		background: var(--gradient-primary);
		color: var(--primary-foreground);
		border-radius: 50rpx;
		font-weight: 600;
		font-size: 30rpx;
		box-shadow: var(--shadow-lg);
		transition: all 0.3s ease;
	}
	
	.go-practice-btn:active {
		transform: scale(0.95);
		opacity: 0.9;
	}
}

/* 错题卡片 */
.mistake-card {
	position: relative;
	padding: 40rpx;

	.card-tag {
		position: absolute;
		top: 0;
		right: 40rpx;
		background: var(--primary-light);
		color: var(--primary);
		font-size: 20rpx;
		padding: 10rpx 20rpx;
		border-radius: 0 0 20rpx 20rpx;
	}

	.question-text {
		font-size: 30rpx;
		line-height: 1.6;
		color: var(--text-primary);
		margin-bottom: 30rpx;
		margin-top: 10rpx;
		display: block;
		font-weight: 600;
	}
}

.options-list {
	margin-bottom: 30rpx;
}

.option-row {
	display: flex;
	margin-bottom: 16rpx;
	align-items: flex-start;

	.opt-idx {
		width: 48rpx;
		font-weight: 700;
		color: var(--text-sub);
		flex-shrink: 0;
		font-size: 28rpx;

		&.correct {
			color: var(--success);
		}

		&.wrong {
			color: var(--danger);
		}
	}

	.opt-text {
		font-size: 28rpx;
		color: var(--text-primary);
		line-height: 1.5;
		flex: 1;
	}
}

.analysis-box {
	background: var(--bg-secondary);
	border-radius: 20rpx;
	padding: 30rpx;
	margin-bottom: 30rpx;
	border-left: 8rpx solid var(--primary);
	animation: fadeIn 0.3s;

	.correct-ans {
		font-weight: bold;
		color: var(--success);
		margin-bottom: 20rpx;
		font-size: 28rpx;
		display: block;
	}

	.analysis-content {
		font-size: 26rpx;
		color: var(--text-primary);
		line-height: 1.6;

		.label {
			font-weight: bold;
			color: var(--text-primary);
		}
	}
}

.card-footer {
	display: flex;
	justify-content: space-between;
	align-items: center;
	padding-top: 20rpx;
	border-top: 1rpx solid #F0F0F0;

	.time-text {
		font-size: 22rpx;
		color: var(--text-sub);
	}

	.actions {
		display: flex;
		gap: 16rpx;
	}

	.action-btn {
		padding: 10rpx 24rpx;
		border-radius: 20rpx;
		font-size: 24rpx;
		border: none;

		&.sm {
			background: var(--bg-secondary);
			color: var(--text-sub);
		}

		&.del {
			background: var(--danger-light);
			color: var(--danger);
		}

		&.primary {
			background: var(--primary);
			color: var(--primary-foreground);
			font-weight: bold;
		}

		&[disabled] {
			opacity: 0.5;
		}

		&::after {
			border: none;
		}
	}

	/* 练习选项样式 */
	.practice-options {
		margin-bottom: 20rpx;
	}

	.practice-options .option-row {
		padding: 20rpx;
		border-radius: 16rpx;
		background: var(--bg-secondary);
		transition: all 0.2s;
		cursor: pointer;

		&.selected {
			background: var(--primary-light);
			border: 1px solid var(--primary);
		}

		&.disabled {
			opacity: 0.6;
			cursor: not-allowed;
		}
	}

	.practice-result {
		margin-top: 30rpx;
		padding: 20rpx;
		border-radius: 16rpx;
		background: var(--bg-secondary);
	}

	.result-icon {
		font-size: 36rpx;
		font-weight: bold;
		margin-right: 10rpx;

		&.correct {
			color: var(--success);
		}

		&.wrong {
			color: var(--danger);
		}
	}

	.result-text {
		font-size: 28rpx;
		font-weight: bold;
		margin-bottom: 10rpx;
	}

	/* 报告弹窗 */
	.report-modal {
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		z-index: 10000;
		display: flex !important;
		align-items: center;
		justify-content: center;
		animation: fadeIn 0.3s ease-in-out;
		pointer-events: auto;
		visibility: visible !important;
		opacity: 1 !important;

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

		.modal-content {
			position: relative;
			width: 90%;
			max-width: 700rpx;
			max-height: 85vh;
			background: var(--bg-card);
			border-radius: 30rpx;
			display: flex;
			flex-direction: column;
			z-index: 2;
			box-shadow: 0 20rpx 60rpx rgba(0, 0, 0, 0.3);
			overflow: hidden;
		}

		.modal-header {
			display: flex;
			align-items: center;
			justify-content: space-between;
			padding: 30rpx 40rpx;
			border-bottom: 1rpx solid #F0F0F0;

			.modal-title {
				font-size: 36rpx;
				font-weight: bold;
				color: #333;
			}

			.modal-close {
				width: 60rpx;
				height: 60rpx;
				display: flex;
				align-items: center;
				justify-content: center;
				border-radius: 50%;
				background: #F5F5F5;
				transition: all 0.2s;

				&:active {
					background: #E0E0E0;
					transform: scale(0.95);
				}
			}

			.modal-close-icon {
				font-size: 40rpx;
				color: #666;
				line-height: var(--line-height-normal);
				font-weight: 300;
			}
		}

		.modal-scroll {
			flex: 1;
			overflow-y: auto;
			padding: 20rpx;
			background: #FAFAFA;
		}

		.report-image {
			width: 100%;
			display: block;
			border-radius: 20rpx;
		}

		.modal-footer {
			display: flex;
			gap: 20rpx;
			padding: 30rpx 40rpx;
			border-top: 1rpx solid #F0F0F0;
			background: var(--bg-card);

			.modal-btn {
				flex: 1;
				height: 88rpx;
				line-height: 88rpx;
				border-radius: 44rpx;
				font-size: 32rpx;
				font-weight: bold;
				border: none;

				&.secondary {
					background: #F5F5F5;
					color: #333;
				}

				&.primary {
					background: #2ECC71;
					color: #FFF;
				}

				&::after {
					border: none;
				}
			}
		}
	}

	@keyframes fadeIn {
		from {
			opacity: 0;
		}

		to {
			opacity: 1;
		}
	}

	.result-desc {
		font-size: 26rpx;
		color: var(--text-sub);
		line-height: 1.5;
	}

	.wrong-count {
		display: flex;
		align-items: center;
		gap: 8rpx;
		font-size: 22rpx;
		color: var(--warning);
	}

	.count-icon {
		font-size: 20rpx;
	}
}

.fab-btn {
	position: fixed;
	bottom: 60rpx;
	left: 50%;
	transform: translateX(-50%);
	width: 300rpx;
	height: 90rpx;
	background: var(--bg-card);
	color: var(--text-primary);
	border-radius: 45rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 10rpx;
	font-size: 28rpx;
	box-shadow: var(--shadow-lg);
	z-index: 99;
}

.safe-area {
	height: 200rpx;
}

/* 一键清空按钮区域（列表底部） */
.clear-all-section {
	padding: 40rpx 30rpx;
	display: flex;
	justify-content: center;
}

.clear-all-btn {
	width: 100%;
	max-width: 600rpx;
	height: 88rpx;
	padding: 0 32rpx;
	background: var(--danger-light);
	border: 2rpx solid var(--danger);
	border-radius: 44rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 12rpx;
	transition: all 0.2s;
	box-shadow: var(--shadow-sm);
}

.clear-all-btn:active {
	background: var(--danger-light);
	transform: scale(0.98);
	box-shadow: var(--shadow-xs);
}

.clear-all-btn::after {
	border: none;
}

.clear-all-icon {
	font-size: 36rpx;
	line-height: var(--line-height-normal);
}

.clear-all-text {
	font-size: 30rpx;
	color: var(--danger);
	font-weight: 600;
	white-space: nowrap;
}

/* AI 诊断报告按钮 */
.bottom-bar {
	position: fixed;
	bottom: 50rpx;
	left: 0;
	width: 100%;
	display: flex;
	justify-content: center;
	padding: 0 40rpx;
	box-sizing: border-box;
	z-index: 99;
}

.export-btn {
	width: 100%;
	max-width: 650rpx;
	min-width: 500rpx;
	height: 100rpx;
	background: var(--gradient-primary);
	color: var(--primary-foreground);
	border-radius: 50rpx;
	font-weight: bold;
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 12rpx;
	box-shadow: var(--shadow-lg);
	border: none;
	padding: 0 30rpx;
	box-sizing: border-box;
}

.export-btn[disabled] {
	opacity: 0.7;
}

.export-btn::after {
	border: none;
}

.export-icon {
	font-size: 36rpx;
	flex-shrink: 0;
	line-height: var(--line-height-normal);
	display: block;
}

.export-text-wrapper {
	flex: 1;
	display: flex;
	align-items: center;
	justify-content: center;
	min-width: 0;
	overflow: visible;
}

.export-text {
	font-size: 30rpx;
	line-height: 1.4;
	white-space: nowrap;
	overflow: visible;
	text-overflow: clip;
	display: block;
	width: 100%;
	text-align: center;
}

/* 自定义Loading界面 */
.custom-loading-mask {
	position: fixed;
	top: 0;
	left: 0;
	width: 100%;
	height: 100%;
	background: var(--overlay);
	backdrop-filter: blur(10px);
	display: flex;
	align-items: center;
	justify-content: center;
	z-index: 9998;
	animation: fadeIn 0.3s ease-in-out;
}

.custom-loading-card {
	background: var(--bg-card);
	border-radius: 30rpx;
	padding: 60rpx 50rpx;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	box-shadow: var(--shadow-xl);
	min-width: 400rpx;
}

.loading-spinner {
	width: 120rpx;
	height: 120rpx;
	position: relative;
	margin-bottom: 40rpx;
}

.spinner-ring {
	width: 120rpx;
	height: 120rpx;
	border: 6rpx solid var(--border);
	border-top-color: var(--primary);
	border-radius: 50%;
	animation: spin 1s linear infinite;
}

@keyframes spin {
	0% {
		transform: rotate(0deg);
	}

	100% {
		transform: rotate(360deg);
	}
}

.loading-text {
	font-size: 32rpx;
	font-weight: 600;
	color: var(--text-primary);
	margin-bottom: 16rpx;
	white-space: nowrap;
	overflow: visible;
}

.loading-desc {
	font-size: 24rpx;
	color: var(--text-sub);
	text-align: center;
	line-height: 1.5;
}

.loading-placeholder {
	padding: 100rpx;
	text-align: center;
	color: var(--text-sub);
}

/* Canvas 画布（隐藏） */
.report-canvas {
	width: 750px;
	height: 1334px;
	position: fixed;
	left: -9999px;
	top: -9999px;
	z-index: -1;
	opacity: 0;
	pointer-events: none;
}

@keyframes fadeIn {
	from {
		opacity: 0;
		transform: translateY(-10rpx);
	}

	to {
		opacity: 1;
		transform: translateY(0);
	}
}

/* 深色模式适配 */
.container.dark-mode {
	--bg-color: var(--bg-body);
	--text-primary: var(--bg-card);
	--text-sub: #b0b0b0;
	--card-bg: #1e3a0f;
	--card-border: #2d4e1f;
	background-color: var(--bg-color);
}

.container.dark-mode .nav-title {
	color: var(--text-primary);
}

.container.dark-mode .nav-back {
	color: var(--text-primary);
}

.container.dark-mode .nav-clear-btn {
	background: rgba(255, 59, 48, 0.2);

	.clear-text {
		color: #FF6B6B;
	}
}

.container.dark-mode .clear-all-btn {
	background: rgba(255, 59, 48, 0.2);
	border-color: rgba(255, 59, 48, 0.4);

	.clear-all-text {
		color: #FF6B6B;
	}
}

.container.dark-mode .question-text {
	color: var(--text-primary);
}

.container.dark-mode .glass-card {
	background: var(--card-bg);
	border-color: var(--card-border);
}

.container.dark-mode .mode-item {
	color: var(--text-sub);
}

.container.dark-mode .mode-item.active {
	background: #2ECC71;
	color: #FFF;
}

.container.dark-mode .aurora-bg {
	background: linear-gradient(135deg, var(--bg-body) 0%, #1a2e05 50%, var(--bg-body) 100%) !important;
	opacity: 0.8;
}
</style>