<template>
	<view :class="['container', { 'dark-mode': isDark }]">
		<view class="aurora-bg"></view>

		<!-- 骨架屏 -->
		<school-skeleton v-if="isLoading" :isDark="isDark" :step="currentStep" />

		<view class="header-nav" v-show="!isLoading">
			<view :style="{ height: statusBarHeight + 'px' }"></view>
			<view class="nav-content">
				<text class="nav-back" @tap="handleBack">←</text>
				<text class="nav-title">智能择校助手</text>
				<view class="nav-placeholder"></view>
			</view>
		</view>

		<!-- 占位符，避免内容被导航栏遮挡（使用标准导航栏高度） -->
		<view :style="{ height: navBarHeight + 'px' }" v-show="!isLoading"></view>

		<!-- 压缩顶部间距：去掉重复叠加的状态栏偏移，仅保留适度 paddingTop -->
		<scroll-view scroll-y class="main-scroll" :style="{ paddingTop: '24px' }" v-show="!isLoading">
			<!-- 步骤进度条 - 添加设计系统工具类 -->
			<view class="step-bar glass-card ds-flex ds-flex-center">
				<view :class="['step-item', 'ds-flex-col', 'ds-flex-center', { active: currentStep >= 1 }]">
					<view class="step-dot ds-flex-center ds-rounded-full">
						<text v-if="currentStep > 1">✓</text>
						<text v-else>1</text>
					</view>
					<text class="ds-text-xs ds-font-medium">背景录入</text>
				</view>
				<view class="step-line" :class="{ active: currentStep >= 2 }"></view>
				<view :class="['step-item', 'ds-flex-col', 'ds-flex-center', { active: currentStep >= 2 }]">
					<view class="step-dot ds-flex-center ds-rounded-full">2</view>
					<text class="ds-text-xs ds-font-medium">智能推荐</text>
				</view>
			</view>

			<!-- 表单区域 - 优化样式 -->
			<view class="glass-card form-card" v-if="currentStep === 1">
				<view class="card-header ds-gap-sm">
					<text class="title ds-text-xl ds-font-bold">完善教育背景</text>
					<text class="subtitle ds-text-sm ds-text-secondary">AI 将基于您的背景分析上岸概率</text>
				</view>

				<view class="input-group ds-gap-xs">
					<text class="label ds-text-sm ds-font-semibold">本科/专科毕业院校</text>
					<input class="glass-input ds-touchable" v-model="formData.school" placeholder="请输入学校名称"
						placeholder-class="ph-style" />
				</view>

				<view class="input-group ds-gap-xs">
					<text class="label ds-text-sm ds-font-semibold">报考专业</text>
					<picker mode="selector" :range="majorOptions" @change="bindMajorChange">
						<view class="glass-input picker-val ds-flex ds-flex-between ds-touchable">
							<text :class="{ 'placeholder-text': !formData.targetMajor }">{{ formData.targetMajor ||
								'点击选择报考专业' }}</text>
							<text class="picker-arrow">▼</text>
						</view>
					</picker>
				</view>

				<view class="input-group ds-gap-xs">
					<text class="label ds-text-sm ds-font-semibold">报考类型</text>
					<view class="tab-group ds-flex ds-gap-xs">
						<view
							:class="['tab-item', 'ds-flex-center', 'ds-touchable', { active: formData.masterType === 'academic' }]"
							@tap="formData.masterType = 'academic'">学硕</view>
						<view
							:class="['tab-item', 'ds-flex-center', 'ds-touchable', { active: formData.masterType === 'professional' }]"
							@tap="formData.masterType = 'professional'">专硕</view>
					</view>
				</view>

				<view class="input-group ds-gap-xs">
					<text class="label ds-text-sm ds-font-semibold">目前学历</text>
					<view class="tab-group ds-flex ds-gap-xs">
						<view
							:class="['tab-item', 'ds-flex-center', 'ds-touchable', { active: formData.degree === 'bk' }]"
							@tap="formData.degree = 'bk'">本科全日制</view>
						<view
							:class="['tab-item', 'ds-flex-center', 'ds-touchable', { active: formData.degree === 'zk' }]"
							@tap="formData.degree = 'zk'">专科/同等学力</view>
					</view>
				</view>

				<view class="input-group ds-gap-xs">
					<text class="label ds-text-sm ds-font-semibold">英语证明</text>
					<picker mode="selector" :range="englishCertificates" @change="bindEnglishCertChange">
						<view class="glass-input picker-val ds-flex ds-flex-between ds-touchable">
							<text :class="{ 'placeholder-text': !formData.englishCert }">{{ formData.englishCert ||
								'点击选择英语证明' }}</text>
							<text class="picker-arrow">▼</text>
						</view>
					</picker>
				</view>

				<button class="primary-btn pulse-btn ds-flex-center ds-gap-sm" @tap="submitForm">
					<text>✨</text>
					开始 AI 择校匹配
				</button>
			</view>

			<!-- 结果区域 - 优化样式 -->
			<view class="result-container" v-if="currentStep === 2">
				<view class="result-header ds-flex ds-flex-between">
					<text class="rh-title ds-text-lg ds-font-bold">推荐 {{ filteredSchools.length }} 所院校</text>
					<view class="rh-filter ds-flex ds-flex-center ds-gap-xs ds-touchable" @click="showFilter = true">
						<text class="ds-text-xs ds-font-medium">{{ activeFilterCount > 0 ? `已选(${activeFilterCount})` :
							'筛选' }}</text>
						<text class="filter-arrow">▼</text>
					</view>
				</view>

				<view class="glass-card school-card ds-touchable" v-for="(school, index) in filteredSchools"
					:key="school.id" @click="navToDetail(school.id)">
					<view class="sc-head ds-flex">
						<!-- <image :src="school.logo" class="sc-logo ds-rounded" mode="aspectFit" /> -->
						<view class="sc-info">
							<view class="sc-name-row ds-flex">
								<text class="sc-name ds-text-lg ds-font-bold">{{ school.name }}</text>
								<text class="sc-loc ds-text-xs">📍 {{ school.location }}</text>
							</view>
							<view class="sc-tags ds-flex ds-gap-xs">
								<text v-for="(tag, tIdx) in school.tags" :key="tIdx"
									class="tag-item ds-text-xs ds-font-semibold">{{ tag }}</text>
							</view>
						</view>
						<view class="match-rate ds-flex-col ds-flex-center">
							<text class="mr-val ds-font-bold">{{ school.matchRate }}%</text>
							<text class="mr-lbl ds-text-xs">匹配度</text>
						</view>
					</view>

					<view class="sc-majors">
						<view v-for="(major, mIdx) in school.majors" :key="mIdx" class="major-item">
							<view class="mj-title">
								<text class="mj-code">[{{ major.code }}]</text>
								<text class="mj-name">{{ major.name }}</text>
								<text class="mj-type">{{ major.type }}</text>
							</view>
							<view class="mj-scores">
								<view class="score-col"><text class="sc-year">2025(预)</text><text class="sc-num high">{{
									major.scores && major.scores[0] ? major.scores[0].total : '-' }}</text></view>
								<view class="score-col"><text class="sc-year">2024</text><text class="sc-num">{{
									major.scores && major.scores[1] ? major.scores[1].total : '-' }}</text></view>
								<view class="score-col"><text class="sc-year">2023</text><text class="sc-num">{{
									major.scores && major.scores[2] ? major.scores[2].total : '-' }}</text></view>
								<view class="score-col"><text class="sc-year">英语</text><text class="sc-num sub">{{
									major.scores && major.scores[0] ? (major.scores[0].eng || '-') : '-' }}</text>
								</view>
							</view>
						</view>
					</view>

					<view class="card-footer ds-flex ds-gap-sm">
						<view class="cf-btn outline ds-flex-center ds-touchable"
							@click.stop="navToDetail(school.id, true)">招生简章</view>
						<view class="cf-btn ds-flex-center ds-touchable"
							:class="school.isTarget ? 'disabled' : 'primary'" @click.stop="toggleTarget(school)">
							{{ school.isTarget ? '已在目标库' : '＋ 加入目标' }}
						</view>
					</view>
				</view>

				<view class="empty-tip ds-flex-col ds-flex-center ds-gap-xs" v-if="filteredSchools.length === 0">
					<text class="ds-text-sm ds-text-secondary">没有符合筛选条件的学校...</text>
					<text class="reset-link ds-text-sm ds-font-medium" @click="resetFilter">重置筛选</text>
				</view>

				<view class="safe-area-bottom"></view>
			</view>

			<!-- 信息提示 -->
			<view class="info-tip" v-if="currentStep === 1">
				<text>🔒</text>
				<text>您的数据仅用于 AI 模型本地分析，不会被公开</text>
			</view>
		</scroll-view>

		<!-- 底部导航栏组件 -->
		<custom-tabbar :activeIndex="2" :isDark="isDark"></custom-tabbar>

		<!-- 筛选弹窗 - 优化样式 -->
		<view class="filter-mask" v-if="showFilter" @click="showFilter = false">
			<view class="filter-panel glass-card" @click.stop>
				<view class="fp-header ds-flex ds-flex-between">
					<text class="fp-title ds-text-xl ds-font-bold">院校筛选</text>
					<text class="fp-reset ds-text-sm ds-touchable" @click="resetFilter">重置</text>
				</view>

				<view class="fp-section">
					<text class="fp-label ds-text-sm ds-font-semibold">所在地区</text>
					<scroll-view scroll-x class="tag-scroll" :show-scrollbar="false">
						<view class="filter-tags ds-flex ds-gap-xs">
							<view class="ft-item ds-touchable ds-text-xs" :class="{ active: filter.location === '' }"
								@click="filter.location = ''">全部</view>
							<view class="ft-item ds-touchable ds-text-xs" v-for="loc in locations" :key="loc"
								:class="{ active: filter.location === loc }" @click="filter.location = loc">
								{{ loc }}
							</view>
						</view>
					</scroll-view>
				</view>

				<view class="fp-section">
					<text class="fp-label ds-text-sm ds-font-semibold">院校层次</text>
					<view class="filter-tags ds-flex ds-gap-xs">
						<view class="ft-item ds-touchable ds-text-xs" :class="{ active: filter.tag === '' }"
							@click="filter.tag = ''">不限</view>
						<view class="ft-item ds-touchable ds-text-xs" :class="{ active: filter.tag === '985' }"
							@click="filter.tag = '985'">
							985院校</view>
						<view class="ft-item ds-touchable ds-text-xs" :class="{ active: filter.tag === '211' }"
							@click="filter.tag = '211'">
							211院校</view>
						<view class="ft-item ds-touchable ds-text-xs" :class="{ active: filter.tag === '自划线' }"
							@click="filter.tag = '自划线'">
							34所自划线</view>
					</view>
				</view>

				<button class="fp-confirm-btn ds-flex-center ds-font-bold" @click="showFilter = false">查看结果</button>
			</view>
		</view>
	</view>
</template>

<script>
import CustomTabbar from '../../components/layout/custom-tabbar/custom-tabbar.vue';
import SchoolSkeleton from '../../components/base/school-skeleton/school-skeleton.vue';
import { lafService } from '../../services/lafService.js';

export default {
	components: {
		CustomTabbar,
		SchoolSkeleton
	},
	data() {
		return {
			statusBarHeight: 44,
			navBarHeight: 88, // 标准导航栏高度 = 44 + 44
			currentStep: 1,
			showFilter: false,
			isDark: false,
			isLoading: true, // 骨架屏加载状态

			formData: { school: '', targetMajor: '', masterType: 'academic', degree: 'bk', englishCert: '' },
			englishCertificates: ['无', 'B级', 'A级', '四级', '六级', '雅思', '托福', 'GRE', 'GMAT'],

			// 学硕专业列表
			academicMajors: [
				'计算机科学与技术',
				'软件工程',
				'信息与通信工程',
				'电子科学与技术',
				'控制科学与工程',
				'机械工程',
				'土木工程',
				'建筑学',
				'管理科学与工程',
				'工商管理',
				'应用经济学',
				'理论经济学',
				'法学',
				'马克思主义理论',
				'中国语言文学',
				'外国语言文学',
				'新闻传播学',
				'基础医学',
				'临床医学',
				'药学',
				'数学',
				'物理学',
				'化学',
				'其他'
			],

			// 专硕专业列表
			professionalMajors: [
				'电子信息',
				'机械',
				'材料与化工',
				'资源与环境',
				'能源动力',
				'土木水利',
				'生物与医药',
				'交通运输',
				'工商管理(MBA)',
				'公共管理(MPA)',
				'会计(MPAcc)',
				'金融',
				'应用统计',
				'税务',
				'国际商务',
				'保险',
				'资产评估',
				'审计',
				'法律',
				'社会工作',
				'警务',
				'教育',
				'汉语国际教育',
				'应用心理',
				'翻译',
				'新闻与传播',
				'出版',
				'文物与博物馆',
				'建筑学',
				'城市规划',
				'临床医学',
				'口腔医学',
				'公共卫生',
				'护理',
				'药学',
				'中药学',
				'艺术',
				'其他'
			],

			// 当前显示的专业选项（根据学硕/专硕动态切换）
			majorOptions: [],

			filter: { location: '', tag: '' },
			locations: ['北京', '上海', '浙江', '江苏', '湖北', '四川'],

			mockSchools: [
				{
					id: 10003, name: "清华大学", location: "北京", matchRate: 98, isTarget: false,
					logo: "https://api.dicebear.com/7.x/initials/svg?seed=THU&backgroundColor=663399",
					tags: ["985", "211", "双一流", "自划线"],
					majors: [{ name: "计算机科学与技术", code: "081200", type: "学硕", scores: [{ total: 365, eng: 50 }, { total: 360 }, { total: 355 }] }]
				},
				{
					id: 10001, name: "北京大学", location: "北京", matchRate: 95, isTarget: false,
					logo: "https://api.dicebear.com/7.x/initials/svg?seed=PKU&backgroundColor=990000",
					tags: ["985", "211", "双一流", "自划线"],
					majors: [{ name: "软件工程", code: "083500", type: "学硕", scores: [{ total: 350, eng: 55 }, { total: 345 }, { total: 340 }] }]
				},
				{
					id: 10335, name: "浙江大学", location: "浙江", matchRate: 92, isTarget: false,
					logo: "https://api.dicebear.com/7.x/initials/svg?seed=ZJU&backgroundColor=000099",
					tags: ["985", "211", "双一流"],
					majors: [{ name: "计算机科学与技术", code: "081200", type: "学硕", scores: [{ total: 368, eng: 55 }, { total: 365 }, { total: 360 }] }]
				},
				{
					id: 10248, name: "上海交通大学", location: "上海", matchRate: 88, isTarget: false,
					logo: "https://api.dicebear.com/7.x/initials/svg?seed=SJTU&backgroundColor=CC0000",
					tags: ["985", "211", "C9"],
					majors: [{ name: "电子信息", code: "085400", type: "专硕", scores: [{ total: 340, eng: 50 }, { total: 335 }, { total: 330 }] }]
				},
				{
					id: 10486, name: "武汉大学", location: "湖北", matchRate: 85, isTarget: false,
					logo: "https://api.dicebear.com/7.x/initials/svg?seed=WHU&backgroundColor=006400",
					tags: ["985", "211", "双一流"],
					majors: [{ name: "网络空间安全", code: "083900", type: "学硕", scores: [{ total: 330, eng: 50 }, { total: 325 }, { total: 320 }] }]
				}
			]
		};
	},
	onLoad() {
		const sys = uni.getSystemInfoSync();
		// 统一计算：状态栏高度
		this.statusBarHeight = sys.statusBarHeight || sys.safeAreaInsets?.top || 44;
		// 标准导航栏高度 = 状态栏高度 + 44px
		this.navBarHeight = this.statusBarHeight + 44;
		this.syncTargetStatus();

		// 初始化主题
		const savedTheme = uni.getStorageSync('theme_mode') || 'light';
		this.isDark = savedTheme === 'dark';

		// 监听全局主题更新事件
		uni.$on('themeUpdate', (mode) => {
			this.isDark = mode === 'dark';
		});

		// 延迟隐藏骨架屏，模拟数据加载
		setTimeout(() => {
			this.isLoading = false;
		}, 500);
	},
	onShow() {
		// 隐藏系统原生 TabBar
		uni.hideTabBar({
			animation: false
		});
	},
	onUnload() {
		// 移除事件监听
		uni.$off('themeUpdate');
	},
	computed: {
		filteredSchools() {
			return this.mockSchools.filter(school => {
				const matchLoc = this.filter.location ? school.location === this.filter.location : true;
				const matchTag = this.filter.tag ? school.tags.includes(this.filter.tag) : true;
				return matchLoc && matchTag;
			});
		},
		activeFilterCount() {
			let c = 0;
			if (this.filter.location) c++;
			if (this.filter.tag) c++;
			return c;
		}
	},
	watch: {
		'formData.masterType': {
			handler(newVal) {
				this.updateMajorOptions(newVal);
			},
			immediate: true
		}
	},
	methods: {
		updateMajorOptions(type) {
			if (type === 'academic') {
				this.majorOptions = this.academicMajors;
			} else {
				this.majorOptions = this.professionalMajors;
			}
			// 重置已选专业，如果不在新列表中
			if (this.formData.targetMajor && !this.majorOptions.includes(this.formData.targetMajor)) {
				this.formData.targetMajor = '';
			}
		},
		handleBack() {
			if (this.currentStep === 2) {
				this.currentStep = 1;
			} else {
				uni.navigateBack();
			}
		},
		bindEnglishCertChange(e) {
			this.formData.englishCert = this.englishCertificates[e.detail.value];
		},
		bindMajorChange(e) {
			this.formData.targetMajor = this.majorOptions[e.detail.value];
			console.log('[school] 📚 选择专业:', this.formData.targetMajor);
		},
		// 调用智谱AI API获取真实院校推荐数据
		async submitForm() {
			console.log('[school] 📝 开始提交择校表单');
			console.log('[school] 📊 表单数据:', JSON.stringify(this.formData, null, 2));

			if (!this.formData.school || !/^[一-龥a-zA-Z\s]+$/.test(this.formData.school)) {
				console.warn('[school] ⚠️ 表单验证失败: 院校名称无效');
				return uni.showToast({ title: '请输入有效的院校名称', icon: 'none' });
			}
			if (!this.formData.targetMajor) {
				console.warn('[school] ⚠️ 表单验证失败: 报考专业为空');
				return uni.showToast({ title: '请输入报考专业', icon: 'none' });
			}

			console.log('[school] ✅ 表单验证通过');

			try {
				uni.vibrateShort();
			} catch (e) { }

			// 显示Apple AI质感的Loading页面
			uni.showLoading({
				title: 'AI 分析中...',
				mask: true
			});

			// 设置超时保护标志，避免重复处理
			let isTimeoutHandled = false;

			// 设置超时保护（20秒后自动取消Loading并使用默认数据，优化用户体验）
			let loadingTimeout = setTimeout(() => {
				if (isTimeoutHandled) {
					console.log('[school] ⏱️ 超时处理已执行，跳过重复处理');
					return;
				}
				isTimeoutHandled = true;
				console.warn('[school] ⏱️ AI 分析超时（10秒），自动降级到默认数据');
				uni.hideLoading();
				uni.showToast({
					title: 'AI 分析超时，使用默认数据',
					icon: 'none',
					duration: 2000
				});
				// 切换到结果页面，使用默认模拟数据
				this.currentStep = 2;
				console.log('[school] ✅ 超时降级：切换到结果页面 (Step 2)');
				console.log('[school] 📊 当前推荐院校数量:', this.filteredSchools.length);
				loadingTimeout = null; // 标记已处理
			}, 10000); // 10秒超时（优化：缩短超时时间，提升用户体验）

			try {
				console.log('[school] 🤖 调用后端代理进行择校匹配...');

				// ✅ 使用后端代理调用（安全）- action: 'recommend'
				const response = await lafService.proxyAI('recommend', {
					school: this.formData.school,
					targetMajor: this.formData.targetMajor,
					masterType: this.formData.masterType === 'academic' ? '学术型硕士(学硕)' : '专业型硕士(专硕)',
					degree: this.formData.degree === 'bk' ? '本科全日制' : '专科/同等学力',
					englishCert: this.formData.englishCert
				});

				console.log('[school] 📥 后端代理请求完成，开始处理响应...');

				// 处理API响应
				if (response && response.code === 0 && response.data) {
					console.log('[school] ✅ API 响应解析成功');
					const content = response.data;
					console.log('[school]  AI 返回内容长度:', content.length);

					try {
						const parsedData = JSON.parse(content);
						console.log('[school] ✅ JSON 解析成功');

						// 更新院校数据
						let schoolsList = [];
						if (Array.isArray(parsedData)) {
							schoolsList = parsedData;
						} else if (parsedData.schools && Array.isArray(parsedData.schools)) {
							schoolsList = parsedData.schools;
						} else {
							// 如果API返回格式不符合预期，使用默认模拟数据
							console.warn('[school] ⚠️ API返回格式不符合预期，使用默认模拟数据');
							console.log('[school] 📊 返回数据结构:', Object.keys(parsedData));
							console.log('[school] 📄 返回数据预览:', JSON.stringify(parsedData).substring(0, 200));
						}

						// 规范化数据格式，确保每个专业都有完整的 scores 数组
						if (schoolsList.length > 0) {
							schoolsList = schoolsList.map(school => {
								// 确保有 majors 数组
								if (!school.majors || !Array.isArray(school.majors)) {
									school.majors = [];
								}

								// 规范化每个专业的 scores 数据
								school.majors = school.majors.map(major => {
									if (!major.scores || !Array.isArray(major.scores) || major.scores.length === 0) {
										// 如果没有 scores，创建默认结构
										major.scores = [
											{ total: '-', eng: '-' },
											{ total: '-' },
											{ total: '-' }
										];
									} else {
										// 确保至少有第一个元素
										if (!major.scores[0]) {
											major.scores[0] = { total: '-', eng: '-' };
										}
										// 确保第一个元素有 total 和 eng
										if (!major.scores[0].total) major.scores[0].total = '-';
										if (!major.scores[0].eng) major.scores[0].eng = '-';
										// 补充后续年份数据
										if (!major.scores[1]) major.scores[1] = { total: '-' };
										if (!major.scores[2]) major.scores[2] = { total: '-' };
									}
									return major;
								});

								return school;
							});

							this.mockSchools = schoolsList;
							console.log(`[school] ✅ 更新院校列表: ${schoolsList.length} 所院校（已规范化数据格式）`);
						}
					} catch (parseError) {
						console.error('[school] ❌ JSON 解析失败:', parseError);
						console.log('[school] 📄 原始内容预览:', content.substring(0, 200));
					}
				} else {
					// 修复验证：明确记录 statusCode 解析情况
					const statusCode = res?.statusCode;
					if (statusCode === undefined) {
						console.error('[school] ❌ API 响应异常: statusCode 为 undefined（修复前的问题）');
						console.log('[school] 📊 响应对象结构:', {
							resType: typeof res,
							resIsArray: Array.isArray(res),
							resKeys: res ? Object.keys(res) : [],
							resValue: res
						});
					} else if (statusCode !== 200) {
						console.warn(`[school] ⚠️ AI API 响应异常: statusCode = ${statusCode} (非 200)`);
					} else {
						console.warn('[school] ⚠️ AI API 响应格式异常: statusCode = 200 但缺少内容');
					}
					console.log('[school] 📊 响应详情:', {
						statusCode: statusCode,
						hasData: !!res?.data,
						dataKeys: res?.data ? Object.keys(res.data) : []
					});
				}

				// 清除超时定时器（如果请求成功，取消30秒超时保护）
				if (loadingTimeout) {
					clearTimeout(loadingTimeout);
					loadingTimeout = null;
					isTimeoutHandled = false; // 重置标志
				}

				// 如果30秒超时保护已经触发，不再重复处理
				if (isTimeoutHandled) {
					console.log('[school] ℹ️ 30秒超时保护已触发，跳过成功处理');
					return;
				}

				// 隐藏加载动画，切换到结果页面
				uni.hideLoading();
				this.currentStep = 2;
				console.log('[school] ✅ 切换到结果页面 (Step 2)');
				console.log('[school] 📊 当前推荐院校数量:', this.filteredSchools.length);
				uni.showToast({ title: '匹配成功', icon: 'success' });
			} catch (error) {
				// 清除超时定时器
				if (loadingTimeout) {
					clearTimeout(loadingTimeout);
					loadingTimeout = null;
				}

				// 如果30秒超时保护已经触发，不再重复处理错误
				if (isTimeoutHandled) {
					console.log('[school] ℹ️ 30秒超时保护已触发，跳过错误处理');
					return;
				}

				console.error('[school] ❌ AI推荐失败:', error);

				// 详细的错误处理和日志
				let errorMsg = 'AI推荐失败，使用默认数据';
				let errorType = 'unknown';

				if (error.errMsg) {
					if (error.errMsg.includes('timeout') || error.errMsg.includes('time out') || error.errMsg.includes('超时')) {
						errorMsg = 'AI 分析超时，使用默认数据';
						errorType = 'timeout';
						console.warn('[school] ⏱️ 请求超时（60秒）');
					} else if (error.statusCode === 401 || error.statusCode === 403) {
						errorMsg = 'API Key 无效，使用默认数据';
						errorType = 'auth';
						console.error('[school] 🔑 API Key 错误:', error.statusCode);
					} else if (error.statusCode >= 500) {
						errorMsg = 'AI 服务暂时不可用，使用默认数据';
						errorType = 'server';
						console.error('[school] 🖥️ 服务器错误:', error.statusCode);
					} else if (error.errMsg.includes('fail') || error.errMsg.includes('网络')) {
						errorMsg = '网络连接失败，使用默认数据';
						errorType = 'network';
						console.error('[school] 🌐 网络错误');
					}
				}

				console.log('[school] 📊 错误详情:', {
					type: errorType,
					message: errorMsg,
					originalError: error.errMsg || error.message || error
				});

				// 如果30秒超时保护已经触发，不再重复显示提示和切换页面
				if (!isTimeoutHandled) {
					uni.hideLoading();
					uni.showToast({
						title: errorMsg,
						icon: 'none',
						duration: 3000
					});

					// 切换到结果页面，使用默认模拟数据
					this.currentStep = 2;
					console.log('[school] ✅ 降级到默认数据，切换到结果页面 (Step 2)');
					console.log('[school] 📊 当前推荐院校数量:', this.filteredSchools.length);
				} else {
					console.log('[school] ℹ️ 30秒超时保护已处理，跳过重复的错误处理');
				}
			}
		},
		resetFilter() {
			this.filter = { location: '', tag: '' };
			this.showFilter = false;
		},
		toggleTarget(school) {
			school.isTarget = !school.isTarget;
			let targets = uni.getStorageSync('target_schools') || [];
			if (school.isTarget) {
				const exists = targets.some(t => t.id === school.id);
				if (!exists) {
					targets.push({ id: school.id, name: school.name, location: school.location, logo: school.logo });
					try {
						uni.vibrateShort();
					} catch (e) { }
					uni.showToast({ title: '已加入目标库', icon: 'success' });
				}
			} else {
				targets = targets.filter(t => t.id !== school.id);
				uni.showToast({ title: '已取消', icon: 'none' });
			}
			uni.setStorageSync('target_schools', targets);
		},
		syncTargetStatus() {
			const targets = uni.getStorageSync('target_schools') || [];
			const targetIds = targets.map(t => t.id);
			this.mockSchools.forEach(s => {
				if (targetIds.includes(s.id)) {
					s.isTarget = true;
				}
			});
		},
		navToDetail(id, openConsult = false) {
			console.log(`[school] 🔗 跳转到详情页: id=${id}, openConsult=${openConsult}`);

			// 查找对应的院校数据
			const school = this.mockSchools.find(s => s.id == id || s.id === id);
			if (school) {
				console.log(`[school] 📊 找到院校数据:`, {
					id: school.id,
					name: school.name,
					location: school.location,
					matchRate: school.matchRate,
					hasMajors: !!school.majors,
					majorsCount: school.majors?.length || 0
				});

				// 优化：传递完整数据到详情页，避免详情页重新查找
				// 使用 encodeURIComponent 确保数据安全传递
				const schoolDataStr = encodeURIComponent(JSON.stringify(school));
				uni.navigateTo({
					url: `/pages/school/detail?id=${id}&data=${schoolDataStr}&openConsult=${openConsult}`,
					success: () => {
						console.log(`[school] ✅ 页面跳转成功: /pages/school/detail?id=${id}`);
					},
					fail: (err) => {
						console.error(`[school] ❌ 页面跳转失败:`, err);
						uni.showToast({ title: '页面跳转失败', icon: 'none' });
					}
				});
			} else {
				console.warn(`[school] ⚠️ 未找到院校数据，id=${id}，将使用详情页的 Mock 数据`);
				// 即使找不到数据，也允许跳转，详情页会使用 Mock 数据
				uni.navigateTo({
					url: `/pages/school/detail?id=${id}&openConsult=${openConsult}`,
					success: () => {
						console.log(`[school] ✅ 页面跳转成功（使用详情页 Mock 数据）: /pages/school/detail?id=${id}`);
					},
					fail: (err) => {
						console.error(`[school] ❌ 页面跳转失败:`, err);
						uni.showToast({ title: '页面跳转失败', icon: 'none' });
					}
				});
			}
		}
	}
};
</script>

<style lang="scss" scoped>
/* --- CSS 变量适配层 --- */
.container {
	--bg-body: var(--bg-body);
	--text-primary: #1A1A1A;
	--text-secondary: #4A5568;
	--text-tertiary: #94A3B8;
	--card-bg: rgba(255, 255, 255, 0.8);
	--card-border: rgba(0, 0, 0, 0.05);
	--bg-hover: var(--bg-card);
	--border-light: rgba(255, 255, 255, 0.6);
	--brand-color: var(--accent-warm);
	--brand-color-light: #EBFDF5;

	min-height: 100vh;
	background: var(--bg-body);
	position: relative;
	overflow: hidden;
	transition: background-color 0.3s;
}

.container.dark-mode {
	--bg-body: var(--bg-body);
	--text-primary: var(--bg-card);
	--text-secondary: #b0b0b0;
	--text-tertiary: #8899a6;
	--card-bg: #1e3a0f;
	--card-border: #2d4e1f;
	--bg-hover: rgba(255, 255, 255, 0.1);
	--border-light: rgba(255, 255, 255, 0.2);
	--brand-color: var(--accent-warm);
	--brand-color-light: rgba(46, 204, 113, 0.2);
}

.container.dark-mode .aurora-bg {
	background: linear-gradient(135deg, var(--bg-body) 0%, #1a2e05 50%, var(--bg-body) 100%) !important;
	opacity: 0.8;
}

.aurora-bg {
	position: absolute;
	top: 0;
	width: 100%;
	height: 500rpx;
	background: linear-gradient(135deg, #A8E6CF 0%, #DCEDC1 100%);
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
	background: var(--card-bg);
	backdrop-filter: blur(20px);
	-webkit-backdrop-filter: blur(20px);
	border-bottom: 1px solid var(--card-border);

	.nav-content {
		height: 44px;
		/* 标准导航栏内容高度 */
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
	}
}

/* 导航栏样式 */
.header-nav {
	background: var(--card-bg);
	border-bottom: 1px solid var(--card-border);
}

/* 深色模式下的导航栏背景适配 */
.container.dark-mode .header-nav {
	background: var(--bg-body) !important;
	border-bottom: 1px solid #2d4e1f !important;
}

.container.dark-mode .header-nav .nav-content .nav-back,
.container.dark-mode .header-nav .nav-content .nav-title {
	color: var(--bg-card) !important;
}

.main-scroll {
	height: 100vh;
	padding: 30rpx;
	padding-bottom: calc(70px + env(safe-area-inset-bottom));
	box-sizing: border-box;
	position: relative;
	z-index: 1;
	background: var(--bg-body);
}

/* 通用玻璃卡片 - 使用 CSS 变量 */
.glass-card {
	background: var(--card-bg);
	backdrop-filter: blur(20px);
	border: 1px solid var(--card-border);
	border-radius: 40rpx;
	padding: 30rpx;
	margin-bottom: 30rpx;
	box-shadow: 0 8px 32px rgba(31, 38, 135, 0.05);
}

/* 步骤进度条 */
.step-bar {
	display: flex;
	align-items: center;
	justify-content: space-around;
	padding: 40rpx;

	.step-item {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 10rpx;
		opacity: 0.4;
		transition: all 0.3s;

		&.active {
			opacity: 1;

			.step-dot {
				background: var(--brand-color);
				color: white;
				border-color: var(--brand-color);
			}
		}

		.step-dot {
			width: 44rpx;
			height: 44rpx;
			border-radius: 22rpx;
			border: 2rpx solid var(--text-primary);
			display: flex;
			align-items: center;
			justify-content: center;
			font-size: 24rpx;
			transition: all 0.3s;
			font-weight: bold;
			color: var(--text-primary);
		}

		text {
			font-size: 24rpx;
			font-weight: bold;
			color: var(--text-primary);
		}
	}

	.step-line {
		flex: 1;
		height: 2rpx;
		background: var(--border-light);
		margin: 0 20rpx;
		margin-top: -30rpx;
		transition: all 0.3s;

		&.active {
			background: var(--brand-color);
		}
	}
}

/* 表单卡片 */
.form-card {
	padding: 50rpx 40rpx;

	.card-header {
		margin-bottom: 50rpx;

		.title {
			font-size: 40rpx;
			font-weight: 800;
			color: var(--text-primary);
			display: block;
			margin-bottom: 10rpx;
		}

		.subtitle {
			font-size: 24rpx;
			color: var(--text-tertiary);
		}
	}
}

.input-group {
	margin-bottom: 40rpx;

	.label {
		font-size: 28rpx;
		font-weight: 600;
		color: var(--text-primary);
		margin-bottom: 20rpx;
		display: block;
	}

	.glass-input {
		background: var(--bg-hover);
		border: 1rpx solid var(--border-light);
		border-radius: 24rpx;
		height: 100rpx;
		padding: 0 30rpx;
		display: flex;
		align-items: center;
		font-size: 28rpx;
		color: var(--text-primary);
		box-sizing: border-box;
		transition: all 0.3s;
	}

	.glass-input:focus-within {
		border-color: var(--brand-color);
		box-shadow: 0 0 15rpx rgba(46, 204, 113, 0.3);
	}

	/* 修复占位符颜色 */
	.ph-style {
		color: var(--text-tertiary) !important;
		opacity: 0.7;
	}

	.placeholder-text {
		color: var(--text-tertiary) !important;
		opacity: 0.7;
	}

	.picker-val {
		justify-content: space-between;
		color: var(--text-primary);

		.picker-arrow {
			font-size: 20rpx;
			color: var(--text-tertiary);
		}
	}
}

.tab-group {
	display: flex;
	gap: 20rpx;

	.tab-item {
		flex: 1;
		height: 100rpx;
		background: var(--bg-hover);
		border: 1rpx solid var(--card-border);
		border-radius: 24rpx;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 28rpx;
		color: var(--text-tertiary);
		transition: all 0.2s;

		&.active {
			background: var(--brand-color-light);
			border-color: var(--brand-color);
			color: var(--brand-color);
			font-weight: bold;
		}
	}
}

.primary-btn {
	margin-top: 60rpx;
	height: 110rpx;
	background: #2ECC71;
	color: white;
	border-radius: 30rpx;
	font-size: 32rpx;
	font-weight: bold;
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 15rpx;
	box-shadow: 0 10rpx 30rpx rgba(46, 204, 113, 0.3);
	border: none;

	&.pulse-btn {
		animation: pulse 2s infinite;
	}

	&::after {
		border: none;
	}
}

@keyframes pulse {

	0%,
	100% {
		box-shadow: 0 10rpx 30rpx rgba(46, 204, 113, 0.3);
	}

	50% {
		box-shadow: 0 10rpx 40rpx rgba(46, 204, 113, 0.5);
	}
}

.info-tip {
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 10rpx;
	padding: 20rpx;
	color: var(--text-tertiary);
	font-size: 24rpx;
	margin-bottom: 30rpx;
}

/* 结果区域 */
.result-container {
	animation: slideUp 0.3s;
}

.result-header {
	display: flex;
	justify-content: space-between;
	align-items: center;
	margin-bottom: 30rpx;
	padding: 0 10rpx;
}

.rh-title {
	font-size: 32rpx;
	font-weight: 700;
	color: var(--text-primary);
}

.rh-filter {
	font-size: 24rpx;
	color: var(--text-primary);
	background: var(--card-bg);
	padding: 10rpx 20rpx;
	border-radius: 20rpx;
	display: flex;
	align-items: center;
	gap: 8rpx;
	box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.05);
	border: 1px solid var(--card-border);
}

.filter-arrow {
	font-size: 20rpx;
	color: var(--text-tertiary);
}

.school-card {
	padding: 30rpx;

	.sc-head {
		display: flex;
		align-items: flex-start;
		margin-bottom: 24rpx;
		padding-bottom: 24rpx;
		border-bottom: 1rpx solid var(--card-border);
	}

	.sc-logo {
		width: 96rpx;
		height: 96rpx;
		border-radius: 16rpx;
		margin-right: 24rpx;
		background: var(--bg-hover);
		flex-shrink: 0;
	}

	.sc-info {
		flex: 1;
	}

	.sc-name-row {
		display: flex;
		align-items: baseline;
		margin-bottom: 12rpx;
	}

	.sc-name {
		font-size: 32rpx;
		font-weight: 700;
		color: var(--text-primary);
		margin-right: 16rpx;
	}

	.sc-loc {
		font-size: 22rpx;
		color: var(--text-tertiary);
	}

	.sc-tags {
		display: flex;
		gap: 12rpx;
		margin-top: 12rpx;
		flex-wrap: wrap;
	}

	.tag-item {
		font-size: 20rpx;
		color: var(--brand-color);
		background: var(--brand-color-light);
		padding: 4rpx 12rpx;
		border-radius: 8rpx;
		font-weight: 600;
	}

	.match-rate {
		display: flex;
		flex-direction: column;
		align-items: center;
		background: var(--brand-color-light);
		padding: 8rpx 16rpx;
		border-radius: 16rpx;
		flex-shrink: 0;
	}

	.mr-val {
		font-size: 32rpx;
		font-weight: 800;
		color: var(--brand-color);
		line-height: var(--line-height-normal);
	}

	.mr-lbl {
		font-size: 18rpx;
		color: var(--brand-color);
		opacity: 0.8;
		margin-top: 4rpx;
	}
}

.sc-majors {
	margin-bottom: 24rpx;
}

.major-item {
	margin-bottom: 24rpx;
	padding-bottom: 24rpx;
	border-bottom: 1rpx solid var(--card-border);

	&:last-child {
		margin-bottom: 0;
		padding-bottom: 0;
		border-bottom: none;
	}
}

.mj-title {
	font-size: 26rpx;
	margin-bottom: 16rpx;
	font-weight: 600;
	color: var(--text-primary);
	display: flex;
	align-items: center;
	flex-wrap: wrap;
}

.mj-code {
	color: var(--text-tertiary);
	margin-right: 12rpx;
	font-weight: 400;
}

.mj-name {
	margin-right: 12rpx;
	color: var(--text-primary);
}

.mj-type {
	font-size: 20rpx;
	background: var(--bg-hover);
	padding: 2rpx 8rpx;
	border-radius: 8rpx;
	color: #666;
	font-weight: 400;
}

.mj-scores {
	display: flex;
	justify-content: space-between;
	background: #F9F9F9;
	padding: 16rpx 24rpx;
	border-radius: 16rpx;
}

.score-col {
	display: flex;
	flex-direction: column;
	align-items: center;
	flex: 1;
}

.sc-year {
	font-size: 20rpx;
	color: #999;
	margin-bottom: 4rpx;
}

.sc-num {
	font-size: 28rpx;
	font-weight: 700;
	color: #333;
}

.sc-num.high {
	color: #FF3B30;
}

.sc-num.sub {
	color: #666;
	font-weight: 400;
}

.card-footer {
	display: flex;
	gap: 24rpx;
	margin-top: 24rpx;
}

.cf-btn {
	flex: 1;
	height: 72rpx;
	border-radius: 36rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	font-size: 26rpx;
	font-weight: 600;
	transition: 0.2s;
}

.cf-btn.outline {
	border: 1rpx solid var(--card-border);
	color: var(--text-primary);
	background: var(--bg-hover);
}

.cf-btn.primary {
	background: var(--brand-color);
	color: #FFF;
	box-shadow: 0 8rpx 20rpx rgba(46, 204, 113, 0.2);
}

.cf-btn.disabled {
	background: var(--bg-hover);
	color: var(--text-tertiary);
	box-shadow: none;
}

.empty-tip {
	text-align: center;
	color: var(--text-tertiary);
	font-size: 26rpx;
	margin-top: 80rpx;
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 16rpx;
}

.reset-link {
	color: var(--brand-color);
	text-decoration: underline;
}

/* 筛选弹窗 */
.filter-mask {
	position: fixed;
	inset: 0;
	background: rgba(0, 0, 0, 0.4);
	z-index: 200;
	display: flex;
	align-items: flex-end;
	backdrop-filter: blur(5px);
	animation: fadeIn 0.3s;
}

.filter-panel {
	width: 100%;
	border-radius: 40rpx 40rpx 0 0;
	padding: 48rpx;
	box-sizing: border-box;
	max-height: 70vh;
	animation: slideUp 0.3s;
}

.fp-header {
	display: flex;
	justify-content: space-between;
	align-items: center;
	margin-bottom: 48rpx;
}

.fp-title {
	font-size: 36rpx;
	font-weight: 700;
	color: var(--text-primary);
}

.fp-reset {
	font-size: 28rpx;
	color: var(--text-tertiary);
	padding: 8rpx 16rpx;
}

.fp-section {
	margin-bottom: 48rpx;
}

.fp-label {
	font-size: 28rpx;
	font-weight: 600;
	margin-bottom: 24rpx;
	display: block;
	color: var(--text-primary);
}

.tag-scroll {
	white-space: nowrap;
	width: 100%;
}

.filter-tags {
	display: flex;
	flex-wrap: wrap;
	gap: 20rpx;
}

.ft-item {
	background: var(--bg-hover);
	padding: 16rpx 32rpx;
	border-radius: 16rpx;
	font-size: 26rpx;
	color: var(--text-tertiary);
	border: 1rpx solid var(--card-border);
	transition: 0.2s;
}

.ft-item.active {
	background: var(--brand-color-light);
	color: var(--brand-color);
	border-color: var(--brand-color);
	font-weight: 600;
}

.fp-confirm-btn {
	width: 100%;
	background: #2ECC71;
	color: #FFF;
	border-radius: 50rpx;
	margin-top: 20rpx;
	height: 100rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	font-weight: 700;
	font-size: 32rpx;
	border: none;

	&::after {
		border: none;
	}
}

.safe-area-bottom {
	height: 80px;
	width: 100%;
}

@keyframes fadeIn {
	from {
		opacity: 0;
	}

	to {
		opacity: 1;
	}
}

@keyframes slideUp {
	from {
		transform: translateY(40rpx);
		opacity: 0;
	}

	to {
		transform: translateY(0);
		opacity: 1;
	}
}

/* 深色模式适配 - 极光背景 */
.container.dark-mode .aurora-bg {
	background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%) !important;
	opacity: 0.4;
	filter: blur(120px);
}
</style>
