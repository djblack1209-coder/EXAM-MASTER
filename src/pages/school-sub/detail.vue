<template>
  <view id="e2e-school-detail-root" :class="['container', { 'dark-mode': isDark }]">
    <view class="aurora-bg" />

    <view class="nav-bar" :style="{ paddingTop: statusBarHeight + 'px' }">
      <view class="nav-content" :style="{ paddingRight: capsuleSafeRight + 'px' }">
        <view id="e2e-school-detail-back-btn" class="back-btn" @tap="navBack">
          <text>←</text>
        </view>
        <text class="nav-title">
          {{ schoolInfo.name || '院校详情' }}
        </text>
        <view id="e2e-school-detail-share-btn" class="share-btn" @tap="handleShare">
          <BaseIcon name="arrow-right" :size="36" />
        </view>
      </view>
    </view>

    <scroll-view scroll-y="true" class="detail-scroll" :style="{ paddingTop: statusBarHeight + 50 + 'px' }">
      <!-- 骨架屏加载状态 -->
      <!-- #ifdef APP-PLUS -->
      <view v-if="isPageLoading" class="skeleton-loading">
        <view class="skeleton-header-card">
          <view class="skeleton-logo skeleton-animate" />
          <view class="skeleton-info">
            <view class="skeleton-name skeleton-animate" />
            <view class="skeleton-tags skeleton-animate" />
          </view>
        </view>
        <view class="skeleton-predict-card skeleton-animate" />
        <view class="skeleton-stats">
          <view v-for="i in 3" :key="i" class="skeleton-stat skeleton-animate" />
        </view>
        <view class="skeleton-intro skeleton-animate" />
      </view>
      <!-- #endif -->
      <!-- #ifndef APP-PLUS -->
      <!-- #ifndef APP-NVUE -->
      <transition name="skeleton-fade">
        <view v-if="isPageLoading" class="skeleton-loading">
          <view class="skeleton-header-card">
            <view class="skeleton-logo skeleton-animate" />
            <view class="skeleton-info">
              <view class="skeleton-name skeleton-animate" />
              <view class="skeleton-tags skeleton-animate" />
            </view>
          </view>
          <view class="skeleton-predict-card skeleton-animate" />
          <view class="skeleton-stats">
            <view v-for="i in 3" :key="i" class="skeleton-stat skeleton-animate" />
          </view>
          <view class="skeleton-intro skeleton-animate" />
        </view>
      </transition>
      <!-- #endif -->
      <!-- #ifdef APP-NVUE -->
      <view v-if="isPageLoading" class="skeleton-loading">
        <view class="skeleton-header-card">
          <view class="skeleton-logo skeleton-animate" />
          <view class="skeleton-info">
            <view class="skeleton-name skeleton-animate" />
            <view class="skeleton-tags skeleton-animate" />
          </view>
        </view>
        <view class="skeleton-predict-card skeleton-animate" />
        <view class="skeleton-stats">
          <view v-for="i in 3" :key="i" class="skeleton-stat skeleton-animate" />
        </view>
        <view class="skeleton-intro skeleton-animate" />
      </view>
      <!-- #endif -->
      <!-- #endif -->

      <!-- 实际内容 -->
      <template v-if="!isPageLoading">
        <!-- 院校头部卡片 -->
        <view class="glass-card school-header-card">
          <image class="school-logo" :src="schoolInfo.logo || '/static/images/default-avatar.png'" mode="aspectFit" />
          <view class="header-main">
            <text class="school-name">
              {{ schoolInfo.name || '加载中...' }}
            </text>
            <view class="tag-row">
              <text class="type-tag">
                {{ getTypeTag(schoolInfo.tags) }}
              </text>
              <view class="location-tag" style="display: inline-flex; align-items: center">
                <BaseIcon name="target" :size="20" style="margin-right: 4rpx" />
                <text>{{ schoolInfo.location || '未知地区' }}</text>
              </view>
              <text v-if="schoolInfo.matchRate" class="rank-tag"> 匹配度 {{ schoolInfo.matchRate }}% </text>
            </view>
          </view>
        </view>

        <!-- 智能预测录取概率卡片 -->
        <view class="glass-card ai-predict-card">
          <view class="card-title">
            <BaseIcon class="sparkle-icon" name="sparkle" :size="28" />
            <text>智能录取概率预测</text>
          </view>

          <view class="predict-main">
            <view class="water-ball-container">
              <view class="water-ball">
                <view class="wave-bg" :style="{ transform: `translateY(${(100 - probability) / 2}%)` }" />
                <view class="wave-front" :style="{ transform: `translateY(${(100 - probability) / 2}%)` }" />
                <view class="percent-content">
                  <text class="num">
                    {{ probability }}
                  </text>
                  <text class="unit"> % </text>
                </view>
              </view>
              <view class="ball-glow" />
            </view>

            <view class="predict-info">
              <view class="status-tag" :style="{ color: statusColor }">
                {{ statusText }}
              </view>
              <text class="ai-summary">
                {{ aiReason || '点击下方按钮，由智能深度评估您的上岸概率' }}
              </text>
            </view>
          </view>

          <button
            id="e2e-school-detail-predict-btn"
            class="predict-btn"
            hover-class="btn-hover"
            :loading="isAnalyzing"
            @tap="fetchAIPrediction"
          >
            {{ isAnalyzing ? '智能分析中...' : '更新智能深度评估' }}
          </button>
        </view>

        <!-- 核心数据统计 -->
        <view class="section-title"> 历年录取指标 </view>
        <view class="stats-grid">
          <view class="glass-card stat-item">
            <text class="stat-val">
              {{ schoolInfo.scoreLine || '---' }}
            </text>
            <text class="stat-label"> 复试分数线 </text>
          </view>
          <view class="glass-card stat-item">
            <text class="stat-val">
              {{ schoolInfo.ratio || '---' }}
            </text>
            <text class="stat-label"> 报录比 </text>
          </view>
          <view class="glass-card stat-item">
            <text class="stat-val"> {{ schoolInfo.passRate || '---' }}% </text>
            <text class="stat-label"> 招生人数 </text>
          </view>
        </view>

        <!-- 院校简介 -->
        <view class="section-title"> 院校简介 </view>
        <view class="glass-card intro-card">
          <text class="intro-text">
            {{ getSchoolDesc() }}
          </text>
        </view>

        <!-- 热门招生专业 -->
        <view class="section-title"> 热门招生专业 </view>
        <view
          v-for="(major, index) in majorList"
          :id="`e2e-school-detail-major-${index}`"
          :key="index"
          class="glass-card major-card"
          @tap="viewMajorDetail(major)"
        >
          <view class="major-info">
            <text class="major-name">
              {{ major.name }}
            </text>
            <text class="major-code"> 专业代码: {{ major.code }} </text>
            <text v-if="major.type" class="major-type">
              {{ major.type }}
            </text>
          </view>
          <text class="arrow-icon"> → </text>
        </view>

        <view class="safe-area" />
      </template>
    </scroll-view>

    <!-- 底部操作栏 -->
    <view class="bottom-action">
      <view class="glass-card action-container">
        <button id="e2e-school-detail-consult-btn" class="ai-consult-btn" hover-class="btn-hover" @tap="showAIConsult">
          <BaseIcon name="comment" :size="28" />
          <text>智能咨询</text>
        </button>
        <button
          id="e2e-school-detail-target-btn"
          :class="['target-btn', { 'is-added': isTarget }]"
          hover-class="btn-hover"
          @tap="toggleTarget"
        >
          {{ isTarget ? '从目标中移除' : '加入目标院校' }}
        </button>
      </view>
    </view>

    <!-- 智能咨询组件 -->
    <AiConsult
      :visible="showAIConsultPanel"
      :school-name="schoolInfo.name || '该院校'"
      :school-info="schoolInfo"
      @close="hideAIConsult"
    />
  </view>
</template>

<script>
import { lafService } from '@/services/lafService.js';
import config from '@/config/index.js';
// ✅ 统一日志工具（生产环境自动禁用）
import { logger } from '@/utils/logger.js';
import { getStatusBarHeight, getCapsuleSafeRight } from '@/utils/core/system.js';
// ✅ F019: 统一使用 storageService
import storageService from '@/services/storageService.js';
import BaseIcon from '@/components/base/base-icon/base-icon.vue';

export default {
  components: {
    BaseIcon,
    // ✅ 懒加载：AiConsult 620行组件，仅在用户点击"智能咨询"时才需要
    AiConsult: () => import('./ai-consult.vue')
  },
  data() {
    return {
      statusBarHeight: 44,
      capsuleSafeRight: 20,
      isDark: false,
      schoolInfo: {},
      isTarget: false,
      schoolId: null,
      probability: 0, // 录取概率 0-100
      isAnalyzing: false,
      aiReason: '',
      showAIConsultPanel: false,
      isPageLoading: true // 页面加载状态
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
      if (this.probability >= 80) return 'var(--success-green)';
      if (this.probability >= 50) return 'var(--info-blue)';
      return 'var(--danger-red)';
    }
  },
  onLoad(options) {
    if (!options) options = {};
    logger.log('[detail] 📄 详情页加载，接收参数:', options);

    this.statusBarHeight = getStatusBarHeight();
    this.capsuleSafeRight = getCapsuleSafeRight();

    // 初始化深色模式
    this.isDark = storageService.get('theme_mode') === 'dark';
    this._themeHandler = (mode) => {
      this.isDark = mode === 'dark';
    };
    uni.$on('themeUpdate', this._themeHandler);

    // 兼容两种传递方式：缓存数据（优先）或 id 参数
    const cachedData = options.id ? storageService.get(`school_detail_${options.id}`) : null;
    if (cachedData) {
      try {
        this.schoolInfo = cachedData;
        this.schoolId = this.schoolInfo.id;
        logger.log('[detail] ✅ 从缓存解析院校信息:', {
          id: this.schoolId,
          name: this.schoolInfo.name,
          location: this.schoolInfo.location,
          matchRate: this.schoolInfo.matchRate,
          hasMajors: !!this.schoolInfo.majors,
          majorsCount: this.schoolInfo.majors?.length || 0
        });
        // 如果从列表页传递了完整数据，直接使用，不需要重新加载
        this.probability = this.schoolInfo.matchRate || 0;
        this.isPageLoading = false;
        // 清理临时缓存
        try {
          storageService.remove(`school_detail_${options.id}`);
        } catch (_e) {
          /* cache cleanup non-critical */
        }
      } catch (_e) {
        logger.error('[detail] ❌ 解析学校缓存数据失败:', _e);
        // 解析失败时降级到 id 加载
        if (options.id) {
          this.schoolId = options.id;
          this.loadSchoolDetail(options.id);
        }
      }
    } else if (options.data) {
      // 兼容旧的 data 参数传递方式
      try {
        this.schoolInfo = JSON.parse(decodeURIComponent(options.data));
        this.schoolId = this.schoolInfo.id;
        this.probability = this.schoolInfo.matchRate || 0;
        this.isPageLoading = false;
      } catch (_e) {
        logger.error('[detail] ❌ 解析学校数据失败:', _e);
        if (options.id) {
          this.schoolId = options.id;
          this.loadSchoolDetail(options.id);
        }
      }
    } else if (options.id) {
      this.schoolId = options.id;
      logger.log(`[detail] 🔍 开始加载院校详情: id=${options.id}`);
      this.loadSchoolDetail(options.id);
    } else {
      // ✅ P001: Mock 数据仅在开发环境可用，生产环境显示错误提示
      if (config.isDev) {
        logger.warn('[detail] ⚠️ [DEV] 未提供 id 参数，使用默认 Mock 数据');
        this.schoolInfo = {
          id: '10001',
          name: '北京大学（开发预览）',
          logo: `${config.externalCdn.dicebearBaseUrl}/initials/svg?seed=PKU&backgroundColor=990000`,
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
        this.isPageLoading = false;
      } else {
        logger.error('[detail] ❌ 未提供院校 id 参数');
        this.showLoadError('unknown');
      }
    }

    // 检查是否需要自动打开智能咨询
    if (options.openConsult === 'true') {
      logger.log('[detail] 💬 自动打开智能咨询面板');
      this.showAIConsultPanel = true;
      this.openConsultQuery = '请介绍一下该校的招生简章和核心优势';
    }

    // 初始检查是否已在收藏夹
    this.checkTargetStatus();
    logger.log('[detail] ✅ 详情页初始化完成，院校信息:', { id: this.schoolId, name: this.schoolInfo.name });
  },
  onUnload() {
    uni.$off('themeUpdate', this._themeHandler);
  },
  methods: {
    async loadSchoolDetail(id) {
      logger.log(`[detail] 🔍 开始加载院校详情: id=${id} (类型: ${typeof id})`);
      this.isPageLoading = true;

      try {
        // 从后端获取学校详情
        const response = await lafService.getSchoolDetail(id);

        if (response && response.code === 0 && response.data) {
          const school = response.data;
          this.schoolInfo = {
            id: school.code || school._id,
            name: school.name,
            logo:
              school.logo ||
              `${config.externalCdn.dicebearBaseUrl}/initials/svg?seed=${school.shortName || school.name}&backgroundColor=663399`,
            location: school.province || school.city,
            tags: school.tags || [],
            scoreLine: school.latestScoreLines?.[0]?.total || '-',
            ratio: school.graduateInfo?.admissionRatio || '-',
            passRate: school.graduateInfo?.passRate || '-',
            matchRate: this.calculateMatchRate(school), // ✅ P003: 基于用户画像的真实匹配算法
            majors: school.colleges?.flatMap((c) => c.majors || []) || [],
            desc: school.description
          };

          this.probability = this.schoolInfo.matchRate || 0;
          logger.log(`[detail] ✅ 从后端加载院校详情成功:`, this.schoolInfo.name);
          this.checkTargetStatus();
          this.isPageLoading = false;
          return;
        } else {
          // 后端返回错误，显示加载失败状态
          logger.warn('[detail] ⚠️ 后端获取失败，显示加载失败状态');
          this.showLoadError(id);
        }
      } catch (error) {
        logger.warn('[detail] ⚠️ 后端获取异常，显示加载失败状态:', error);
        this.showLoadError(id);
      }
    },

    /**
     * 显示加载失败状态
     */
    showLoadError(id) {
      this.schoolInfo = {
        id: id,
        name: '数据加载失败',
        logo: '/static/images/default-avatar.png',
        location: '-',
        tags: [],
        scoreLine: '-',
        ratio: '-',
        passRate: '-',
        matchRate: 0,
        majors: [],
        desc: '无法获取院校数据，请检查网络连接后重试。'
      };
      this.probability = 0;
      this.isPageLoading = false;

      uni.showToast({
        title: '数据加载失败，请稍后重试',
        icon: 'none',
        duration: 2000
      });
    },

    /**
     * P003: 基于用户画像和院校数据的真实匹配度算法
     * 综合考虑：用户学习数据、院校层次、分数线等维度
     * Calculate match rate based on user study profile
     * 基于用户画像的真实匹配算法
     * @param {Object} school - School data object
     * @param {string[]} [school.tags] - School tags (e.g. '985', '211')
     * @param {string} [school.code] - School code
     * @param {string} [school._id] - School ID
     * @returns {number} Match rate 30-98
     */
    calculateMatchRate(school) {
      try {
        const statsData = storageService.get('study_stats', {});
        const doneCount = storageService.get('v30_bank', []).length;
        const mistakeCount = storageService.get('mistake_book', []).length;
        const studyDays = Object.keys(statsData).length;
        const targetSchools = storageService.get('target_schools', []);

        // 基础分 60 分
        let score = 60;

        // 维度1: 学习投入度 (最高 +15)
        if (studyDays >= 90) score += 15;
        else if (studyDays >= 30) score += 10;
        else if (studyDays >= 7) score += 5;

        // 维度2: 刷题量 (最高 +10)
        if (doneCount >= 500) score += 10;
        else if (doneCount >= 200) score += 7;
        else if (doneCount >= 50) score += 4;

        // 维度3: 错题率控制 (最高 +5)
        if (doneCount > 0) {
          const errorRate = mistakeCount / doneCount;
          if (errorRate < 0.2) score += 5;
          else if (errorRate < 0.4) score += 3;
        }

        // 维度4: 院校层次匹配 (调整 -10 ~ +10)
        const tags = school.tags || [];
        const is985 = tags.includes('985');
        const is211 = tags.includes('211');
        if (is985) {
          // 985 院校竞争激烈，适当降低匹配度
          score -= studyDays < 30 || doneCount < 100 ? 10 : 3;
        } else if (is211) {
          score -= studyDays < 14 || doneCount < 50 ? 5 : 0;
        } else {
          score += 5; // 普通院校匹配度更高
        }

        // 维度5: 是否已设为目标院校 (+5 表示用户有明确意向)
        const isTarget = targetSchools.some((t) => t.id === (school.code || school._id));
        if (isTarget) score += 5;

        // 限制范围 30-98
        return Math.max(30, Math.min(98, Math.round(score)));
      } catch (e) {
        logger.warn('[detail] ⚠️ 匹配度计算异常，使用默认值:', e);
        return 65;
      }
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
      return `${name}是一所历史悠久、学术实力雄厚的知名高校。该校在多个学科领域享有盛誉，为研究生培养提供了优质的学术资源和良好的学习环境。智能正在持续搜集该校最新的考研招生简章、复试分数线等权威数据，为考生提供精准的择校参考。`;
    },
    checkTargetStatus() {
      if (!this.schoolId) return;
      const list = storageService.get('target_schools', []);
      const currentId = String(this.schoolId);
      this.isTarget = list.some((item) => String(item.id) === currentId);
    },
    toggleTarget() {
      logger.log('[detail] 🎯 开始切换目标院校状态');

      if (!this.schoolId && !this.schoolInfo.id) {
        logger.warn('[detail] ⚠️ 院校数据未加载，无法操作');
        uni.showToast({ title: '数据加载中，请稍候', icon: 'none' });
        return;
      }

      try {
        if (typeof uni.vibrateShort === 'function') {
          uni.vibrateShort();
        }
      } catch (_e) {
        logger.warn('Failed to trigger vibration on toggle target', _e);
      }

      let list = storageService.get('target_schools', []);
      const schoolId = String(this.schoolId || this.schoolInfo.id || '');
      if (!schoolId) {
        uni.showToast({ title: '院校信息异常', icon: 'none' });
        return;
      }

      logger.log('[detail] 📊 当前状态:', {
        schoolId,
        schoolName: this.schoolInfo.name,
        isTarget: this.isTarget,
        currentListCount: list.length
      });

      if (this.isTarget) {
        // 移除
        const beforeCount = list.length;
        list = list.filter((item) => String(item.id) !== schoolId);
        const afterCount = list.length;

        logger.log('[detail] ➖ 从目标中移除:', {
          schoolId,
          schoolName: this.schoolInfo.name,
          beforeCount,
          afterCount,
          removed: beforeCount > afterCount
        });

        storageService.save('target_schools', list);
        this.isTarget = false;

        uni.showToast({ title: '已取消关注', icon: 'none' });
        logger.log('[detail] ✅ 移除成功，已保存到本地存储');
      } else {
        // 添加：确保数据完整
        const schoolData = {
          id: schoolId,
          name: this.schoolInfo.name,
          location: this.schoolInfo.location,
          logo: this.schoolInfo.logo,
          matchRate: this.schoolInfo.matchRate
        };

        const exists = list.some((item) => String(item.id) === schoolId);
        if (!exists) {
          list.push(schoolData);

          logger.log('[detail] ➕ 添加到目标:', {
            schoolData,
            newListCount: list.length
          });

          storageService.save('target_schools', list);
          this.isTarget = true;

          uni.showToast({ title: '成功加入目标', icon: 'success' });
          logger.log('[detail] ✅ 添加成功，已保存到本地存储');

          // 验证保存结果
          const savedList = storageService.get('target_schools', []);
          const saved = savedList.some((item) => item.id === schoolId);
          logger.log('[detail] 🔍 保存验证:', {
            saved,
            savedListCount: savedList.length
          });
        } else {
          logger.warn('[detail] ⚠️ 院校已在目标列表中，无需重复添加');
          this.isTarget = true; // 同步状态
          uni.showToast({ title: '已在目标列表中', icon: 'none' });
        }
      }
    },
    navBack() {
      uni.navigateBack();
    },
    handleShare() {
      // #ifdef MP-WEIXIN
      this.copySchoolInfo();
      uni.showToast({
        title: '已复制院校信息，可通过右上角继续分享',
        icon: 'none',
        duration: 2500
      });
      // #endif

      // #ifdef APP-PLUS
      // App 环境：使用 uni.share
      if (typeof uni.share !== 'undefined') {
        uni.share({
          provider: 'weixin',
          scene: 'WXSceneSession',
          type: 0,
          href: `${config.deepLink.h5BaseUrl}/school/${this.schoolId}`,
          title: `${this.schoolInfo.name} - 考研院校推荐`,
          summary: `${this.schoolInfo.name}，${this.schoolInfo.location}，匹配度${this.schoolInfo.matchRate}%`,
          imageUrl: this.schoolInfo.logo,
          success: () => {
            uni.showToast({ title: '分享成功', icon: 'success' });
          },
          fail: () => {
            this.copySchoolInfo();
          }
        });
      } else {
        this.copySchoolInfo();
      }
      // #endif

      // #ifdef H5
      // H5 环境
      if (navigator.share) {
        navigator
          .share({
            title: `${this.schoolInfo.name} - 考研院校推荐`,
            text: `${this.schoolInfo.name}，${this.schoolInfo.location}，匹配度${this.schoolInfo.matchRate}%`,
            url: ''
          })
          .catch(() => {
            this.copySchoolInfo();
          });
      } else {
        this.copySchoolInfo();
      }
      // #endif
    },
    copySchoolInfo() {
      const info = `【${this.schoolInfo.name}】\n${this.schoolInfo.location}\n匹配度：${this.schoolInfo.matchRate}%\n复试线：${this.schoolInfo.scoreLine || '---'}分\n报录比：${this.schoolInfo.ratio || '---'}\n\n来自 Exam-Master 考研神器`;
      uni.setClipboardData({
        data: info,
        success: () => {
          uni.showToast({ title: '院校信息已复制', icon: 'success' });
        }
      });
    },
    showAIConsult() {
      this.showAIConsultPanel = true;
    },
    hideAIConsult() {
      this.showAIConsultPanel = false;
    },
    viewMajorDetail(major) {
      // 显示专业详情弹窗
      uni.showModal({
        title: `${major.name}`,
        content: `专业代码：${major.code}\n类型：${major.type || '学硕'}\n\n该专业是${this.schoolInfo.name}的热门招生专业，每年吸引大量考生报考。\n\n建议：\n1. 关注该专业历年分数线\n2. 了解导师研究方向\n3. 准备专业课复习资料`,
        confirmText: '查看更多',
        cancelText: '关闭',
        success: (res) => {
          if (res.confirm) {
            // 跳转到专业详情页或显示更多信息
            uni.showToast({
              title: '更多专业信息正在整理中',
              icon: 'none',
              duration: 2000
            });
          }
        }
      });
    },
    async fetchAIPrediction() {
      if (this.isAnalyzing) {
        logger.log('[detail] ⚠️ 智能预测正在进行中，跳过重复请求');
        return;
      }

      logger.log('[detail] 🎯 开始智能录取概率预测');
      logger.log('[detail] 📊 目标院校:', {
        id: this.schoolId,
        name: this.schoolInfo.name,
        currentProbability: this.probability
      });

      this.isAnalyzing = true;

      try {
        if (typeof uni.vibrateShort === 'function') {
          uni.vibrateShort();
        }
      } catch (_e) {
        logger.warn('Failed to trigger vibration on analyze probability', _e);
      }

      // 获取用户当前学习数据
      const statsData = storageService.get('study_stats', {});
      const doneCount = storageService.get('v30_bank', []).length;
      const mistakeCount = storageService.get('mistake_book', []).length;
      const studyDays = Object.keys(statsData).length;

      logger.log('[detail] 📈 用户学习数据:', {
        studyDays,
        doneCount,
        mistakeCount
      });

      const _prompt = `你是一个考研大数据分析专家。请根据以下背景预测学生进入【${this.schoolInfo.name}】的概率：
- 学生已坚持刷题：${studyDays} 天
- 累计刷题量：${doneCount} 道
- 错题积压：${mistakeCount} 道

要求：
1. 给出一个 40 到 95 之间的整数作为录取概率。
2. 提供一段 50 字以内的专业点评。
3. 格式：概率|点评`;

      try {
        logger.log('[detail] 🤖 调用后端代理进行录取概率预测...');

        // ✅ 使用后端代理调用（安全）- action: 'predict'
        const response = await lafService.proxyAI('predict', {
          content: `请预测以下考生的录取概率：目标院校${this.schoolInfo.name}，已备考${studyDays}天，完成${doneCount}题，错题${mistakeCount}道`,
          schoolName: this.schoolInfo.name,
          studyDays: studyDays,
          doneCount: doneCount,
          mistakeCount: mistakeCount
        });

        logger.log('[detail] 📥 后端代理响应:', {
          code: response?.code,
          hasData: !!response?.data
        });

        if (response && response.code === 0 && response.data) {
          const raw =
            response.data && typeof response.data === 'object' && typeof response.data.reply === 'string'
              ? response.data.reply
              : response.data;
          const result = typeof raw === 'string' ? raw.trim() : '';
          logger.log('[detail] 📄 智能返回内容:', result.substring(0, 100));

          let parsedProbability = 60;
          let parsedReason = '数据样本不足，建议增加模拟卷练习。';
          if (!result && raw && typeof raw === 'object') {
            const objectProbability = Number(raw.probability || raw.matchRate || raw.score);
            if (Number.isFinite(objectProbability)) {
              parsedProbability = objectProbability;
            }
            if (typeof raw.reason === 'string' && raw.reason.trim()) {
              parsedReason = raw.reason.trim();
            }
          } else if (result) {
            const parts = result
              .split('|')
              .map((part) => part.trim())
              .filter(Boolean);
            const mainText = parts[0] || result;
            const numberMatch = mainText.match(/\d{2,3}/);
            if (numberMatch) {
              parsedProbability = parseInt(numberMatch[0], 10);
            }
            parsedReason = parts[1] || (parts.length > 1 ? parts.slice(1).join('；') : mainText) || parsedReason;
          }

          this.probability = Math.max(40, Math.min(95, parsedProbability));
          this.aiReason = parsedReason;

          logger.log('[detail] ✅ 智能预测成功:', {
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
          logger.warn('[detail] ⚠️ 智能 API 响应异常，使用降级算法计算概率');
          const baseScore = Math.min(
            95,
            40 + studyDays * 2 + Math.min(doneCount / 10, 30) - Math.min(mistakeCount / 5, 20)
          );
          this.probability = Math.max(40, Math.min(95, Math.round(baseScore)));
          this.aiReason = `基于您已坚持 ${studyDays} 天、刷题 ${doneCount} 道的数据，${this.schoolInfo.name} 上岸概率为 ${this.probability}%。建议继续巩固错题，提升正确率。`;

          logger.log('[detail] ✅ 降级算法计算完成:', {
            probability: this.probability,
            reason: this.aiReason.substring(0, 50)
          });

          uni.showToast({
            title: `预测完成：${this.probability}%`,
            icon: 'success',
            duration: 2000
          });
        }
      } catch (_e) {
        logger.error('[detail] ❌ 智能预测失败:', _e);
        // 降级方案
        const baseScore = Math.min(95, 40 + studyDays * 2 + Math.min(doneCount / 10, 30));
        this.probability = Math.max(40, Math.min(95, Math.round(baseScore)));
        this.aiReason = `基于您已坚持 ${studyDays} 天、刷题 ${doneCount} 道的数据，${this.schoolInfo.name} 上岸概率为 ${this.probability}%。建议继续巩固错题，提升正确率。`;

        logger.log('[detail] ✅ 降级算法计算完成（异常情况）:', {
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
        logger.log('[detail] ✅ 智能预测流程结束');
      }
    }
  }
};
</script>

<style lang="scss" scoped>
/* --- 平铺式 CSS 样式适配 --- */
.container {
  --ball-bg: var(--success-light);
  --wave-color: var(--success);
  --ball-glow: var(--success-glow);
  --bg-body: var(--bg-body);
  --text-primary: var(--text-primary);
  --text-tertiary: var(--text-sub);
  --card-bg: var(--bg-card);
  --card-border: var(--border);
  --brand-color: var(--success);

  min-height: 100%;

  min-height: 100vh;
  background: var(--bg-body);
  position: relative;
  overflow: hidden;
  transition: background 0.3s;
}

/* 深色模式荧光效果 */
.container.dark-mode {
  --ball-bg: var(--bg-secondary);
  --wave-color: var(--primary);
  --ball-glow: var(--primary-glow);
  --bg-body: var(--bg-body);
  --text-primary: var(--text-primary);
  --text-tertiary: var(--text-sub);
  --card-bg: var(--bg-card);
  --card-border: var(--border);
  --brand-color: var(--primary);
}

.aurora-bg {
  position: absolute;
  top: 0;
  width: 100%;
  height: 500rpx;
  background: var(--gradient-aurora);
  filter: blur(60px);
  z-index: 0;
}

.dark-mode .aurora-bg {
  background: var(--gradient-aurora-dark);
}

.nav-bar {
  position: fixed;
  top: 0;
  width: 100%;
  z-index: 100;
  background:
    linear-gradient(180deg, var(--apple-specular-soft) 0%, transparent 42%),
    linear-gradient(160deg, var(--apple-glass-nav-bg) 0%, var(--apple-glass-card-bg) 100%);
  backdrop-filter: blur(24px) saturate(160%);
  -webkit-backdrop-filter: blur(24px) saturate(160%);
  border-bottom: 1px solid var(--apple-glass-border-strong);
  box-shadow: var(--apple-shadow-surface);
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
  height: 100%;
  height: 100vh;
  padding: 0 30rpx;
  box-sizing: border-box;
  position: relative;
  z-index: 1;
}

.glass-card {
  position: relative;
  overflow: hidden;
  background:
    linear-gradient(180deg, var(--apple-specular-soft) 0%, transparent 36%),
    linear-gradient(160deg, var(--apple-glass-card-bg) 0%, var(--apple-group-bg) 100%);
  backdrop-filter: blur(22px) saturate(150%);
  -webkit-backdrop-filter: blur(22px) saturate(150%);
  border: 1px solid var(--apple-glass-border-strong);
  border-radius: 40rpx;
  box-shadow: var(--apple-shadow-card);
  margin-bottom: 30rpx;
}

.glass-card::before {
  content: '';
  position: absolute;
  left: 24rpx;
  right: 24rpx;
  top: 0;
  height: 1rpx;
  background: var(--apple-specular-soft);
}

.school-header-card {
  display: flex;
  padding: 40rpx;
  align-items: center;
  margin-top: 20rpx;
}
.school-logo {
  width: 140rpx;
  height: 140rpx;
  border-radius: 32rpx;
  background: rgba(255, 255, 255, 0.7);
  border: 1rpx solid rgba(255, 255, 255, 0.5);
  box-shadow: var(--apple-shadow-surface);
}
.header-main {
  flex: 1;
  margin-left: 30rpx;
}
.school-name {
  font-size: 40rpx;
  font-weight: 800;
  color: var(--text-primary);
  display: block;
  margin-bottom: 15rpx;
}
.tag-row {
  display: flex;
  flex-wrap: wrap;
  /* gap: 10rpx; -- replaced for Android WebView compat */
  & > view + view,
  & > text + text,
  & > view + text,
  & > text + view {
    margin-left: 10rpx;
  }
}
.tag-row text {
  font-size: 20rpx;
  padding: 8rpx 18rpx;
  border-radius: 999rpx;
}
.type-tag {
  background: rgba(255, 255, 255, 0.7);
  color: var(--text-primary);
  border: 1rpx solid rgba(255, 255, 255, 0.5);
  font-weight: 600;
}
.location-tag {
  background: rgba(255, 255, 255, 0.56);
  color: var(--text-sub);
  border: 1rpx solid rgba(255, 255, 255, 0.46);
}
.rank-tag {
  background: rgba(255, 255, 255, 0.66);
  color: var(--text-primary);
  border: 1rpx solid rgba(255, 255, 255, 0.48);
  font-weight: 600;
}

.stats-grid {
  display: flex;
  /* gap: 20rpx; -- replaced for Android WebView compat */
  & > view + view,
  & > text + text,
  & > view + text,
  & > text + view {
    margin-left: 20rpx;
  }
  margin-bottom: 30rpx;
}
.stat-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 30rpx 0;
  margin-bottom: 0;
  border-radius: 28rpx;
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
  font-size: 24rpx;
  font-weight: 620;
  letter-spacing: 3rpx;
  text-transform: uppercase;
  color: var(--text-secondary);
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
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 30rpx 40rpx;
  transition: all 0.2s;
}
.major-card:active {
  transform: scale(0.98);
  background: rgba(255, 255, 255, 0.22);
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
  font-size: 20rpx;
  color: var(--text-primary);
  background: rgba(255, 255, 255, 0.64);
  padding: 6rpx 14rpx;
  border-radius: 999rpx;
  border: 1rpx solid rgba(255, 255, 255, 0.48);
  display: inline-block;
}
.arrow-icon {
  font-size: 32rpx;
  color: var(--text-tertiary);
}

.bottom-action {
  position: fixed;
  bottom: 0;
  left: 0;
  width: 100%;
  padding: 30rpx;
  box-sizing: border-box;
  padding-bottom: calc(30rpx + constant(safe-area-inset-bottom));
  padding-bottom: calc(30rpx + env(safe-area-inset-bottom));
  z-index: 99;
}
.action-container {
  display: flex;
  /* gap: 20rpx; -- replaced for Android WebView compat */
  & > view + view,
  & > text + text,
  & > view + text,
  & > text + view {
    margin-left: 20rpx;
  }
  margin-bottom: 0;
  padding: 20rpx;
  background:
    linear-gradient(180deg, var(--apple-specular-soft) 0%, transparent 40%),
    linear-gradient(160deg, var(--apple-glass-nav-bg) 0%, var(--apple-glass-card-bg) 100%);
  border: 1rpx solid var(--apple-glass-border-strong);
  box-shadow: var(--apple-shadow-floating);
}
.ai-consult-btn {
  flex: 1;
  height: 100rpx;
  border-radius: 999rpx;
  background: rgba(255, 255, 255, 0.72);
  color: var(--text-primary);
  font-size: 28rpx;
  font-weight: bold;
  display: flex;
  align-items: center;
  justify-content: center;
  /* gap: 10rpx; -- replaced for Android WebView compat */
  & > view + view,
  & > text + text,
  & > view + text,
  & > text + view {
    margin-left: 10rpx;
  }
  border: 1rpx solid rgba(255, 255, 255, 0.5);
  box-shadow: var(--apple-shadow-surface);
}
.ai-consult-btn::after {
  border: none;
}
.target-btn {
  flex: 2;
  height: 100rpx;
  border-radius: 999rpx;
  background: var(--cta-primary-bg);
  color: var(--cta-primary-text);
  font-size: 30rpx;
  font-weight: bold;
  border: 1rpx solid var(--cta-primary-border);
  box-shadow: var(--cta-primary-shadow);
  transition: all 0.3s;
}
.target-btn::after {
  border: none;
}
.target-btn.is-added {
  background: rgba(255, 255, 255, 0.7);
  color: var(--text-primary);
  box-shadow: var(--apple-shadow-surface);
}

.safe-area {
  height: 200rpx;
}

/* 智能预测卡片样式 */
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
  /* gap: 10rpx; -- replaced for Android WebView compat */
  & > view + view,
  & > text + text,
  & > view + text,
  & > text + view {
    margin-left: 10rpx;
  }
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
  top: 0;
  left: -50%;
  width: 200%;
  height: 200%;
  background: var(--wave-color);
  border-radius: 40%;
  transition: transform 2s cubic-bezier(0.23, 1, 0.32, 1);
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
  text-shadow: var(--shadow-text);
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
  filter: blur(8px);
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
  border-radius: 999rpx;
  background: var(--cta-primary-bg);
  color: var(--cta-primary-text);
  font-size: 26rpx;
  font-weight: bold;
  border: 1rpx solid var(--cta-primary-border);
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  box-shadow: var(--cta-primary-shadow);
}
.predict-btn::after {
  border: none;
}

/* 骨架屏样式 */
.skeleton-loading {
  padding: 20rpx 0;
}

.skeleton-header-card {
  display: flex;
  padding: 40rpx;
  background: var(--card-bg);
  border-radius: 40rpx;
  margin-bottom: 30rpx;
}

.skeleton-logo {
  width: 140rpx;
  height: 140rpx;
  border-radius: 30rpx;
  flex-shrink: 0;
}

.skeleton-info {
  flex: 1;
  margin-left: 30rpx;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.skeleton-name {
  width: 200rpx;
  height: 40rpx;
  border-radius: 8rpx;
  margin-bottom: 20rpx;
}

.skeleton-tags {
  width: 280rpx;
  height: 28rpx;
  border-radius: 6rpx;
}

.skeleton-predict-card {
  height: 320rpx;
  border-radius: 40rpx;
  margin-bottom: 30rpx;
}

.skeleton-stats {
  display: flex;
  /* gap: 20rpx; -- replaced for Android WebView compat */
  & > view + view,
  & > text + text,
  & > view + text,
  & > text + view {
    margin-left: 20rpx;
  }
  margin-bottom: 30rpx;
}

.skeleton-stat {
  flex: 1;
  height: 120rpx;
  border-radius: 40rpx;
}

.skeleton-intro {
  height: 200rpx;
  border-radius: 40rpx;
}

.skeleton-animate {
  background: linear-gradient(90deg, var(--bg-secondary) 25%, var(--card-bg) 50%, var(--bg-secondary) 75%);
  background-size: 200% 100%;
  animation: skeleton-loading 1.5s infinite;
}

@keyframes skeleton-loading {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}

/* 骨架屏淡出过渡 */
.skeleton-fade-leave-active {
  transition: opacity 0.35s ease-out;
}
.skeleton-fade-leave-to {
  opacity: 0;
}
</style>
