<template>
	<view :class="['container', { ' ': isDark }]">
		<view class="aurora-bg"></view>
		
		<view class="nav-bar" :style="{ paddingTop: statusBarHeight + 'px' }">
			<view class="nav-content">
				<view class="back-btn" @tap="navBack">
					<text>←</text>
				</view>
				<text class="nav-title">{{ schoolInfo.name || '院校详情' }}</text>
				<view class="share-btn" @tap="handleShare">
					<text>↗</text>
				</view>
			</view>
		</view>

		<scroll-view scroll-y="true" class="detail-scroll" :style="{ paddingTop: (statusBarHeight + 50) + 'px' }">
			<!-- 院校头部卡片 -->
			<view class="glass-card school-header-card">
				<image class="school-logo" :src="schoolInfo.logo || '/static/school-default.png'" mode="aspectFit"></image>
				<view class="header-main">
					<text class="school-name">{{ schoolInfo.name || '加载中...' }}</text>
					<view class="tag-row">
						<text class="type-tag">{{ getTypeTag(schoolInfo.tags) }}</text>
						<text class="location-tag">📍 {{ schoolInfo.location || '未知地区' }}</text>
						<text class="rank-tag" v-if="schoolInfo.matchRate">匹配度 {{ schoolInfo.matchRate }}%</text>
					</view>
				</view>
			</view>

			<!-- AI 预测录取概率卡片 -->
			<view class="glass-card ai-predict-card">
				<view class="card-title">
					<text class="sparkle-icon">✨</text>
					<text>AI 录取概率预测</text>
				</view>
				
				<view class="predict-main">
					<view class="water-ball-container">
						<view class="water-ball">
							<view class="wave-bg" :style="{ top: (100 - probability) + '%' }"></view>
							<view class="wave-front" :style="{ top: (100 - probability) + '%' }"></view>
							<view class="percent-content">
								<text class="num">{{ probability }}</text>
								<text class="unit">%</text>
							</view>
						</view>
						<view class="ball-glow"></view>
					</view>

					<view class="predict-info">
						<view class="status-tag" :style="{ color: statusColor }">{{ statusText }}</view>
						<text class="ai-summary">{{ aiReason || '点击下方按钮，由 AI 深度评估您的上岸概率' }}</text>
					</view>
				</view>

				<button class="predict-btn" :loading="isAnalyzing" @tap="fetchAIPrediction">
					{{ isAnalyzing ? 'AI 分析中...' : '更新 AI 深度评估' }}
				</button>
			</view>

			<!-- 核心数据统计 -->
			<view class="section-title">历年录取指标</view>
			<view class="stats-grid">
				<view class="glass-card stat-item">
					<text class="stat-val">{{ schoolInfo.scoreLine || '---' }}</text>
					<text class="stat-label">复试分数线</text>
				</view>
				<view class="glass-card stat-item">
					<text class="stat-val">{{ schoolInfo.ratio || '---' }}</text>
					<text class="stat-label">报录比</text>
				</view>
				<view class="glass-card stat-item">
					<text class="stat-val">{{ schoolInfo.passRate || '---' }}%</text>
					<text class="stat-label">招生人数</text>
				</view>
			</view>

			<!-- 院校简介 -->
			<view class="section-title">院校简介</view>
			<view class="glass-card intro-card">
				<text class="intro-text">{{ getSchoolDesc() }}</text>
			</view>

			<!-- 热门招生专业 -->
			<view class="section-title">热门招生专业</view>
			<view class="glass-card major-card" v-for="(major, index) in majorList" :key="index" @tap="viewMajorDetail(major)">
				<view class="major-info">
					<text class="major-name">{{ major.name }}</text>
					<text class="major-code">专业代码: {{ major.code }}</text>
					<text class="major-type" v-if="major.type">{{ major.type }}</text>
				</view>
				<text class="arrow-icon">→</text>
			</view>

			<view class="safe-area"></view>
		</scroll-view>

		<!-- 底部操作栏 -->
		<view class="bottom-action">
			<view class="glass-card action-container">
				<button class="ai-consult-btn" @tap="showAIConsult">
					<text>💬</text>
					<text>AI 咨询</text>
				</button>
				<button 
					:class="['target-btn', { 'is-added': isTarget }]" 
					@tap="toggleTarget"
				>
					{{ isTarget ? '从目标中移除' : '加入目标院校' }}
				</button>
			</view>
		</view>
		
		<!-- AI 咨询组件 -->
		<ai-consult 
			:visible="showAIConsultPanel" 
			:school-name="schoolInfo.name || '该院校'" 
			:school-info="schoolInfo"
			@close="hideAIConsult"
		></ai-consult>
	</view>
</template>

<script>
import AiConsult from '../../components/ai-consult/ai-consult.vue';
import { lafService } from '../../services/lafService.js';

export default {
	components: {
		AiConsult
	},
	data() {
		return {
			statusBarHeight: 44,
			isDark: false,
			schoolInfo: {},
			isTarget: false,
			schoolId: null,
			probability: 0, // 录取概率 0-100
			isAnalyzing: false,
			aiReason: '',
			showAIConsultPanel: false
		};
	},
	computed: {
		majorList() {
			if (this.schoolInfo.majors && this.schoolInfo.majors.length > 0) {
				return this.schoolInfo.majors;
			}
			return [
				{ name: '计算机科学与技术', code: '081200', type: '学硕' },
				{ name: '软件工程', code: '083500', type: '学硕' },
				{ name: '人工智能', code: '085410', type: '专硕' }
			];
		},
		statusText() {
			if (this.probability >= 80) return '势在必得';
			if (this.probability >= 50) return '大有可为';
			return '仍需努力';
		},
		statusColor() {
			if (this.probability >= 80) return '#2ECC71';
			if (this.probability >= 50) return '#4A90E2';
			return '#E74C3C';
		}
	},
	onLoad(options) {
		console.log('[detail] 📄 详情页加载，接收参数:', options);
		
		const sys = uni.getSystemInfoSync();
		this.statusBarHeight = sys.statusBarHeight || sys.safeAreaInsets?.top || 44;
		
		// 初始化深色模式
		this.isDark = uni.getStorageSync('theme_mode') === 'dark';
		uni.$on('updateTheme', (mode) => {
			this.isDark = mode === 'dark';
		});
		
		// 兼容两种传递方式：data 参数（优先）或 id 参数
		if (options.data) {
			try {
				this.schoolInfo = JSON.parse(decodeURIComponent(options.data));
				this.schoolId = this.schoolInfo.id;
				console.log('[detail] ✅ 从 data 参数解析院校信息:', { 
					id: this.schoolId, 
					name: this.schoolInfo.name,
					location: this.schoolInfo.location,
					matchRate: this.schoolInfo.matchRate,
					hasMajors: !!this.schoolInfo.majors,
					majorsCount: this.schoolInfo.majors?.length || 0
				});
				// 如果从列表页传递了完整数据，直接使用，不需要重新加载
				this.probability = this.schoolInfo.matchRate || 0;
			} catch (e) {
				console.error('[detail] ❌ 解析学校数据失败:', e);
				// 解析失败时降级到 id 加载
				if (options.id) {
					this.schoolId = options.id;
					this.loadSchoolDetail(options.id);
				}
			}
		} else if (options.id) {
			this.schoolId = options.id;
			console.log(`[detail] 🔍 开始加载院校详情: id=${options.id}`);
			this.loadSchoolDetail(options.id);
		} else {
			// Mock 初始数据用于开发预览
			console.warn('[detail] ⚠️ 未提供 id 参数，使用默认 Mock 数据');
			this.schoolInfo = {
				id: '10001',
				name: '北京大学',
				logo: 'https://api.dicebear.com/7.x/initials/svg?seed=PKU&backgroundColor=990000',
				location: '北京',
				tags: ['985', '211', '双一流', '自划线'],
				type: '双一流 / 985',
				rank: '1',
				scoreLine: '385',
				ratio: '12:1',
				passRate: '15',
				matchRate: 95
			};
			this.schoolId = this.schoolInfo.id;
		}
		
		// 检查是否需要自动打开 AI 咨询
		if (options.openConsult === 'true') {
			console.log('[detail] 💬 自动打开 AI 咨询面板');
			this.showAIConsultPanel = true;
			this.openConsultQuery = '请介绍一下该校的招生简章和核心优势';
		}
		
		// 初始检查是否已在收藏夹
		this.checkTargetStatus();
		console.log('[detail] ✅ 详情页初始化完成，院校信息:', { id: this.schoolId, name: this.schoolInfo.name });
	},
	onUnload() {
		uni.$off('updateTheme');
	},
	methods: {
		loadSchoolDetail(id) {
			console.log(`[detail] 🔍 开始加载院校详情: id=${id} (类型: ${typeof id})`);
			
			// Mock 数据映射
			const mockData = {
				10003: {
					id: 10003,
					name: "清华大学",
					logo: "https://api.dicebear.com/7.x/initials/svg?seed=THU&backgroundColor=663399",
					location: "北京",
					tags: ["985", "211", "双一流", "自划线"],
					scoreLine: '365',
					ratio: '14:1',
					passRate: '12',
					matchRate: 98,
					majors: [
						{ name: "计算机科学与技术", code: "081200", type: "学硕" },
						{ name: "软件工程", code: "083500", type: "学硕" }
					]
				},
				10001: {
					id: 10001,
					name: "北京大学",
					logo: "https://api.dicebear.com/7.x/initials/svg?seed=PKU&backgroundColor=990000",
					location: "北京",
					tags: ["985", "211", "双一流", "自划线"],
					scoreLine: '350',
					ratio: '12:1',
					passRate: '15',
					matchRate: 95,
					majors: [
						{ name: "软件工程", code: "083500", type: "学硕" },
						{ name: "人工智能", code: "085410", type: "专硕" }
					]
				},
				10335: {
					id: 10335,
					name: "浙江大学",
					logo: "https://api.dicebear.com/7.x/initials/svg?seed=ZJU&backgroundColor=000099",
					location: "浙江",
					tags: ["985", "211", "双一流"],
					scoreLine: '368',
					ratio: '10:1',
					passRate: '18',
					matchRate: 92,
					majors: [
						{ name: "计算机科学与技术", code: "081200", type: "学硕" }
					]
				},
				10248: {
					id: 10248,
					name: "上海交通大学",
					logo: "https://api.dicebear.com/7.x/initials/svg?seed=SJTU&backgroundColor=CC0000",
					location: "上海",
					tags: ["985", "211", "C9"],
					scoreLine: '340',
					ratio: '8:1',
					passRate: '20',
					matchRate: 88,
					majors: [
						{ name: "电子信息", code: "085400", type: "专硕" }
					]
				},
				10486: {
					id: 10486,
					name: "武汉大学",
					logo: "https://api.dicebear.com/7.x/initials/svg?seed=WHU&backgroundColor=006400",
					location: "湖北",
					tags: ["985", "211", "双一流"],
					scoreLine: '330',
					ratio: '6:1',
					passRate: '25',
					matchRate: 85,
					majors: [
						{ name: "网络空间安全", code: "083900", type: "学硕" }
					]
				}
			};
			
			// 确保 id 类型匹配（字符串或数字）
			const numericId = typeof id === 'string' ? parseInt(id, 10) : id;
			this.schoolInfo = mockData[numericId] || mockData[10003];
			
			// 设置初始概率为匹配度
			this.probability = this.schoolInfo.matchRate || 0;
			
			console.log(`[detail] ✅ 院校信息加载成功:`, { 
				id: this.schoolInfo.id, 
				name: this.schoolInfo.name, 
				location: this.schoolInfo.location,
				tags: this.schoolInfo.tags,
				matchRate: this.schoolInfo.matchRate,
				probability: this.probability,
				hasMajors: !!this.schoolInfo.majors,
				majorsCount: this.schoolInfo.majors?.length || 0,
				scoreLine: this.schoolInfo.scoreLine,
				ratio: this.schoolInfo.ratio
			});
			this.checkTargetStatus();
		},
		getTypeTag(tags) {
			if (!tags || tags.length === 0) return '综合类';
			// 优先显示最重要的标签
			if (tags.includes('985')) return '985';
			if (tags.includes('211')) return '211';
			return tags[0];
		},
		getSchoolDesc() {
			if (this.schoolInfo.desc) return this.schoolInfo.desc;
			const name = this.schoolInfo.name || '';
			return `${name}是一所历史悠久、学术实力雄厚的知名高校。该校在多个学科领域享有盛誉，为研究生培养提供了优质的学术资源和良好的学习环境。AI 正在持续搜集该校最新的考研招生简章、复试分数线等权威数据，为考生提供精准的择校参考。`;
		},
		checkTargetStatus() {
			if (!this.schoolId) return;
			const list = uni.getStorageSync('target_schools') || [];
			this.isTarget = list.some(item => item.id == this.schoolId || item.id === this.schoolId);
		},
		toggleTarget() {
			console.log('[detail] 🎯 开始切换目标院校状态');
			
			if (!this.schoolId && !this.schoolInfo.id) {
				console.warn('[detail] ⚠️ 院校数据未加载，无法操作');
				uni.showToast({ title: '数据加载中，请稍候', icon: 'none' });
				return;
			}
			
			try {
				if (typeof uni.vibrateShort === 'function') {
					uni.vibrateShort();
				}
			} catch(e) {}

			let list = uni.getStorageSync('target_schools') || [];
			const schoolId = this.schoolId || this.schoolInfo.id;
			
			console.log('[detail] 📊 当前状态:', {
				schoolId,
				schoolName: this.schoolInfo.name,
				isTarget: this.isTarget,
				currentListCount: list.length
			});

			if (this.isTarget) {
				// 移除
				const beforeCount = list.length;
				list = list.filter(item => item.id != schoolId && item.id !== schoolId);
				const afterCount = list.length;
				
				console.log('[detail] ➖ 从目标中移除:', {
					schoolId,
					schoolName: this.schoolInfo.name,
					beforeCount,
					afterCount,
					removed: beforeCount > afterCount
				});
				
				uni.setStorageSync('target_schools', list);
				this.isTarget = false;
				
				uni.showToast({ title: '已取消关注', icon: 'none' });
				console.log('[detail] ✅ 移除成功，已保存到本地存储');
			} else {
				// 添加：确保数据完整
				const schoolData = {
					id: schoolId,
					name: this.schoolInfo.name,
					location: this.schoolInfo.location,
					logo: this.schoolInfo.logo,
					matchRate: this.schoolInfo.matchRate
				};
				
				const exists = list.some(item => item.id == schoolId || item.id === schoolId);
				if (!exists) {
					list.push(schoolData);
					
					console.log('[detail] ➕ 添加到目标:', {
						schoolData,
						newListCount: list.length
					});
					
					uni.setStorageSync('target_schools', list);
					this.isTarget = true;
					
					uni.showToast({ title: '成功加入目标', icon: 'success' });
					console.log('[detail] ✅ 添加成功，已保存到本地存储');
					
					// 验证保存结果
					const savedList = uni.getStorageSync('target_schools') || [];
					const saved = savedList.some(item => item.id == schoolId || item.id === schoolId);
					console.log('[detail] 🔍 保存验证:', {
						saved,
						savedListCount: savedList.length
					});
				} else {
					console.warn('[detail] ⚠️ 院校已在目标列表中，无需重复添加');
					this.isTarget = true; // 同步状态
					uni.showToast({ title: '已在目标列表中', icon: 'none' });
				}
			}
		},
		navBack() { 
			uni.navigateBack(); 
		},
		handleShare() {
			uni.showToast({ title: '分享功能开发中', icon: 'none' });
		},
		showAIConsult() {
			this.showAIConsultPanel = true;
		},
		hideAIConsult() {
			this.showAIConsultPanel = false;
		},
		viewMajorDetail(major) {
			uni.showToast({ title: `${major.name} 详情开发中`, icon: 'none' });
		},
		async fetchAIPrediction() {
			if (this.isAnalyzing) {
				console.log('[detail] ⚠️ AI 预测正在进行中，跳过重复请求');
				return;
			}
			
			console.log('[detail] 🎯 开始 AI 录取概率预测');
			console.log('[detail] 📊 目标院校:', { 
				id: this.schoolId, 
				name: this.schoolInfo.name,
				currentProbability: this.probability
			});
			
			this.isAnalyzing = true;
			
			try {
				if (typeof uni.vibrateShort === 'function') {
					uni.vibrateShort();
				}
			} catch(e) {}

			// 获取用户当前学习数据
			const statsData = uni.getStorageSync('study_stats') || {};
			const doneCount = (uni.getStorageSync('v30_bank') || []).length;
			const mistakeCount = (uni.getStorageSync('mistake_book') || []).length;
			const studyDays = Object.keys(statsData).length;
			
			console.log('[detail] 📈 用户学习数据:', {
				studyDays,
				doneCount,
				mistakeCount
			});

			const prompt = `你是一个考研大数据分析专家。请根据以下背景预测学生进入【${this.schoolInfo.name}】的概率：
- 学生已坚持刷题：${studyDays} 天
- 累计刷题量：${doneCount} 道
- 错题积压：${mistakeCount} 道

要求：
1. 给出一个 40 到 95 之间的整数作为录取概率。
2. 提供一段 50 字以内的专业点评。
3. 格式：概率|点评`;

			try {
				console.log('[detail] 🤖 调用后端代理进行录取概率预测...');
				
				// ✅ 使用后端代理调用（安全）- action: 'predict'
				const response = await lafService.proxyAI('predict', {
					schoolName: this.schoolInfo.name,
					studyDays: studyDays,
					doneCount: doneCount,
					mistakeCount: mistakeCount
				});

				console.log('[detail] 📥 后端代理响应:', {
					code: response?.code,
					hasData: !!response?.data
				});

				if (response && response.code === 0 && response.data) {
					const result = response.data.trim();
					console.log('[detail] 📄 AI 返回内容:', result.substring(0, 100));
					
					const parts = result.split('|');
					const p = parseInt(parts[0]) || 60;
					this.probability = Math.max(40, Math.min(95, p));
					this.aiReason = parts[1] || parts[0] || '数据样本不足，建议增加模拟卷练习。';
					
					console.log('[detail] ✅ AI 预测成功:', {
						probability: this.probability,
						reason: this.aiReason.substring(0, 50)
					});
					
					uni.showToast({ 
						title: `预测完成：${this.probability}%`, 
						icon: 'success',
						duration: 2000
					});
				} else {
					// 降级方案：基于数据简单计算
					console.warn('[detail] ⚠️ AI API 响应异常，使用降级算法计算概率');
					const baseScore = Math.min(95, 40 + studyDays * 2 + Math.min(doneCount / 10, 30) - Math.min(mistakeCount / 5, 20));
					this.probability = Math.max(40, Math.min(95, Math.round(baseScore)));
					this.aiReason = `基于您已坚持 ${studyDays} 天、刷题 ${doneCount} 道的数据，${this.schoolInfo.name} 上岸概率为 ${this.probability}%。建议继续巩固错题，提升正确率。`;
					
					console.log('[detail] ✅ 降级算法计算完成:', {
						probability: this.probability,
						reason: this.aiReason.substring(0, 50)
					});
					
					uni.showToast({ 
						title: `预测完成：${this.probability}%`, 
						icon: 'success',
						duration: 2000
					});
				}
			} catch (e) {
				console.error('[detail] ❌ AI 预测失败:', e);
				// 降级方案
				const baseScore = Math.min(95, 40 + studyDays * 2 + Math.min(doneCount / 10, 30));
				this.probability = Math.max(40, Math.min(95, Math.round(baseScore)));
				this.aiReason = `基于您已坚持 ${studyDays} 天、刷题 ${doneCount} 道的数据，${this.schoolInfo.name} 上岸概率为 ${this.probability}%。建议继续巩固错题，提升正确率。`;
				
				console.log('[detail] ✅ 降级算法计算完成（异常情况）:', {
					probability: this.probability,
					reason: this.aiReason.substring(0, 50)
				});
				
				uni.showToast({ 
					title: `预测完成：${this.probability}%`, 
					icon: 'success',
					duration: 2000
				});
			} finally {
				this.isAnalyzing = false;
				console.log('[detail] ✅ AI 预测流程结束');
			}
		}
	}
};
</script>

<style>
/* --- 平铺式 CSS 样式适配 --- */
.container {
	--ball-bg: #E8F5E9;
	--wave-color: #2ECC71;
	--ball-glow: rgba(46, 204, 113, 0.2);
	--bg-body: var(--bg-body);
	--text-primary: #1A1A1A;
	--text-tertiary: #A0AEC0;
	--card-bg: rgba(255, 255, 255, 0.8);
	--card-border: rgba(0, 0, 0, 0.05);
	--brand-color: #2ECC71;
	
	min-height: 100vh;
	background: var(--bg-body);
	position: relative;
	overflow: hidden;
	transition: background 0.3s;
}

/* 深色模式荧光效果 */
.container. {
  --ball-bg: #1E293B;
  --wave-color: #00FF88;
  --ball-glow: rgba(0, 255, 136, 0.4);
  --bg-body: var(--bg-body);
  --text-primary: var(--bg-body);
  --text-tertiary: #64748B;
  --card-bg: rgba(30, 41, 59, 0.7);
  --card-border: rgba(255, 255, 255, 0.1);
  --brand-color: #00FF88;
}

.aurora-bg {
	position: absolute;
	top: 0;
	width: 100%;
	height: 500rpx;
	background: radial-gradient(circle at 50% 0%, rgba(46, 204, 113, 0.1), transparent);
	filter: blur(60px);
	z-index: 0;
}

. .aurora-bg {
	background: radial-gradient(circle at 50% 0%, rgba(0, 255, 136, 0.15), transparent);
}

.nav-bar {
	position: fixed;
	top: 0;
	width: 100%;
	z-index: 100;
	background: var(--card-bg);
	backdrop-filter: blur(20px);
	border-bottom: 1px solid var(--card-border);
}
.nav-content {
	height: 44px;
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 0 30rpx;
}
.back-btn {
	width: 60rpx;
	height: 60rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	font-size: 36rpx;
	color: var(--text-primary);
	font-weight: bold;
}
.nav-title {
	font-size: 32rpx;
	font-weight: bold;
	color: var(--text-primary);
}
.share-btn {
	width: 60rpx;
	height: 60rpx;
	display: flex;
	align-items: center;
	justify-content: flex-end;
	font-size: 36rpx;
	color: var(--text-primary);
}

.detail-scroll { 
	height: 100vh; padding: 0 30rpx; box-sizing: border-box; position: relative; z-index: 1; 
}

.glass-card {
	background: var(--card-bg);
	backdrop-filter: blur(20px);
	border: 1px solid var(--card-border);
	border-radius: 40rpx;
	box-shadow: 0 8px 32px rgba(31, 38, 135, 0.05);
	margin-bottom: 30rpx;
}

.school-header-card { 
	display: flex; padding: 40rpx; align-items: center; margin-top: 20rpx; 
}
.school-logo { 
	width: 140rpx; height: 140rpx; border-radius: 30rpx; background: #FFF; 
	box-shadow: 0 4rpx 12rpx rgba(0,0,0,0.1);
}
.header-main { 
	flex: 1; margin-left: 30rpx; 
}
.school-name {
	font-size: 40rpx;
	font-weight: 800;
	color: var(--text-primary);
	display: block;
	margin-bottom: 15rpx;
}
.tag-row { 
	display: flex; flex-wrap: wrap; gap: 10rpx; 
}
.tag-row text { 
	font-size: 20rpx; padding: 4rpx 16rpx; border-radius: 10rpx; 
}
.type-tag { 
	background: #EBFDF5; color: #2ECC71; font-weight: 600;
}
.location-tag { 
	background: #F0F4F8; color: #718096; 
}
.rank-tag { 
	background: #FFF5F5; color: #E74C3C; font-weight: 600;
}

.stats-grid { 
	display: flex; gap: 20rpx; margin-bottom: 30rpx; 
}
.stat-item { 
	flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; 
	padding: 30rpx 0; margin-bottom: 0; 
}
.stat-val {
	font-size: 36rpx;
	font-weight: 900;
	color: var(--text-primary);
}
.stat-label {
	font-size: 20rpx;
	color: var(--text-tertiary);
	margin-top: 8rpx;
}

.section-title {
	font-size: 32rpx;
	font-weight: 800;
	color: var(--text-primary);
	margin: 40rpx 0 20rpx 10rpx;
}

.intro-card { 
	padding: 40rpx; 
}
.intro-text {
	font-size: 28rpx;
	color: var(--text-tertiary);
	line-height: 1.8;
}

.major-card { 
	display: flex; align-items: center; justify-content: space-between; padding: 30rpx 40rpx; 
	transition: all 0.2s;
}
.major-card:active {
	transform: scale(0.98);
	background: rgba(255, 255, 255, 0.85);
}
.major-info { 
	flex: 1; 
}
.major-name {
	font-size: 30rpx;
	font-weight: bold;
	color: var(--text-primary);
	display: block;
	margin-bottom: 8rpx;
}
.major-code {
	font-size: 22rpx;
	color: var(--text-tertiary);
	display: block;
	margin-bottom: 4rpx;
}
.major-type { 
	font-size: 20rpx; color: #2ECC71; background: rgba(46, 204, 113, 0.1); 
	padding: 2rpx 12rpx; border-radius: 8rpx; display: inline-block;
}
.arrow-icon { 
	font-size: 32rpx; color: #CBD5E0; 
}

.bottom-action { 
	position: fixed; bottom: 0; left: 0; width: 100%; padding: 30rpx; 
	box-sizing: border-box; padding-bottom: calc(30rpx + env(safe-area-inset-bottom)); 
	z-index: 99;
}
.action-container { 
	display: flex; gap: 20rpx; margin-bottom: 0; padding: 20rpx; 
}
.ai-consult-btn { 
	flex: 1; height: 100rpx; border-radius: 24rpx; background: #F0F4F8; 
	color: #4A5568; font-size: 28rpx; font-weight: bold; display: flex; 
	align-items: center; justify-content: center; gap: 10rpx; border: none;
}
.ai-consult-btn::after {
	border: none;
}
.target-btn {
	flex: 2;
	height: 100rpx;
	border-radius: 24rpx;
	background: var(--brand-color);
	color: #FFF;
	font-size: 30rpx;
	font-weight: bold;
	border: none;
	box-shadow: 0 8rpx 24rpx rgba(46, 204, 113, 0.3);
	transition: all 0.3s;
}
.target-btn::after {
	border: none;
}
.target-btn.is-added { 
	background: #EDF2F7; color: #A0AEC0; box-shadow: none; 
}

.safe-area {
	height: 200rpx;
}

/* AI 预测卡片样式 */
.ai-predict-card {
	padding: 40rpx;
}
.card-title {
	font-size: 32rpx;
	font-weight: bold;
	color: var(--text-primary);
	margin-bottom: 40rpx;
	display: flex;
	align-items: center;
	gap: 10rpx;
}
.sparkle-icon {
	font-size: 28rpx;
}

.predict-main {
	display: flex;
	align-items: center;
	justify-content: space-around;
	margin-bottom: 30rpx;
}

/* 水位球核心样式 */
.water-ball-container {
	position: relative;
	width: 220rpx;
	height: 220rpx;
}
.water-ball {
	width: 100%;
	height: 100%;
	border-radius: 50%;
	background: var(--ball-bg);
	position: relative;
	overflow: hidden;
	border: 6rpx solid var(--card-border);
	z-index: 2;
}

/* 动态波浪实现 */
.wave-bg,
.wave-front {
	position: absolute;
	left: -50%;
	width: 200%;
	height: 200%;
	background: var(--wave-color);
	border-radius: 40%;
	transition: top 2s cubic-bezier(0.23, 1, 0.32, 1);
	animation: rotate 6s linear infinite;
}
.wave-bg {
	opacity: 0.3;
	animation-duration: 8s;
}
.wave-front {
	opacity: 0.6;
}

@keyframes rotate {
	from {
		transform: rotate(0deg);
	}
	to {
		transform: rotate(360deg);
	}
}

.percent-content {
	position: absolute;
	width: 100%;
	height: 100%;
	top: 0;
	left: 0;
	display: flex;
	align-items: center;
	justify-content: center;
	z-index: 3;
}
.percent-content .num {
	font-size: 56rpx;
	font-weight: 900;
	color: var(--text-primary);
	text-shadow: 0 2rpx 10rpx rgba(0,0,0,0.1);
}
.percent-content .unit {
	font-size: 24rpx;
	margin-left: 4rpx;
	color: var(--text-primary);
}

.ball-glow {
	position: absolute;
	bottom: -10rpx;
	left: 50%;
	transform: translateX(-50%);
	width: 80%;
	height: 20rpx;
	background: var(--ball-glow);
	filter: blur(15rpx);
	border-radius: 50%;
	z-index: 1;
}

.predict-info {
	flex: 1;
	margin-left: 40rpx;
}
.status-tag {
	font-size: 36rpx;
	font-weight: 900;
	margin-bottom: 10rpx;
	font-style: italic;
	display: block;
}
.ai-summary {
	font-size: 24rpx;
	color: var(--text-tertiary);
	line-height: 1.5;
	display: block;
}

.predict-btn {
	margin-top: 40rpx;
	height: 80rpx;
	border-radius: 40rpx;
	background: var(--brand-color);
	color: #FFF;
	font-size: 26rpx;
	font-weight: bold;
	border: none;
	display: flex;
	align-items: center;
	justify-content: center;
	width: 100%;
}
.predict-btn::after {
	border: none;
}
</style>
