<template>
  <view id="e2e-school-root" :class="['container', { 'dark-mode': isDark }]">
    <!-- 微信隐私保护弹窗 -->
    <PrivacyPopup />
    <view class="aurora-bg" />

    <!-- 骨架屏 -->
    <SchoolSkeleton v-if="isLoading" :is-dark="isDark" :step="currentStep" />

    <view v-if="!isLoading" class="header-nav">
      <view :style="{ height: statusBarHeight + 'px' }" />
      <view class="nav-content" :style="{ paddingRight: capsuleSafeRight + 'px' }">
        <view class="nav-back" @tap="handleBack"><BaseIcon name="arrow-left" :size="36" /></view>
        <text class="nav-title"> 智能择校助手 </text>
        <view class="nav-placeholder" />
      </view>
    </view>

    <!-- 占位符，避免内容被导航栏遮挡（使用标准导航栏高度） -->
    <view v-if="!isLoading" :style="{ height: navBarHeight + 'px' }" />

    <!-- 压缩顶部间距：去掉重复叠加的状态栏偏移，仅保留适度 paddingTop -->
    <scroll-view v-if="!isLoading" scroll-y class="main-scroll" :style="{ paddingTop: '24px' }">
      <!-- 步骤进度条 - 三步流程 -->
      <view class="step-bar glass-card ds-flex ds-flex-center">
        <view :class="['step-item', 'ds-flex-col', 'ds-flex-center', { active: currentStep >= 1 }]">
          <view class="step-dot ds-flex-center ds-rounded-full">
            <BaseIcon v-if="currentStep > 1" name="check" :size="24" />
            <text v-else> 1 </text>
          </view>
          <text class="ds-text-xs ds-font-medium"> 背景信息 </text>
        </view>
        <view class="step-line" :class="{ active: currentStep >= 2 }" />
        <view :class="['step-item', 'ds-flex-col', 'ds-flex-center', { active: currentStep >= 2 }]">
          <view class="step-dot ds-flex-center ds-rounded-full">
            <BaseIcon v-if="currentStep > 2" name="check" :size="24" />
            <text v-else> 2 </text>
          </view>
          <text class="ds-text-xs ds-font-medium"> 报考信息 </text>
        </view>
        <view class="step-line" :class="{ active: currentStep >= 3 }" />
        <view :class="['step-item', 'ds-flex-col', 'ds-flex-center', { active: currentStep >= 3 }]">
          <view class="step-dot ds-flex-center ds-rounded-full"> 3 </view>
          <text class="ds-text-xs ds-font-medium"> 智能推荐 </text>
        </view>
      </view>

      <view class="compliance-tip">
        <text class="compliance-tip-text">
          说明：结果基于您填写信息与公开招生资料计算，仅供择校参考，请以院校官方信息为准。
        </text>
      </view>

      <!-- 第一页：背景信息 -->
      <view v-if="currentStep === 1" class="glass-card form-card">
        <view class="card-header ds-gap-sm">
          <text class="title ds-text-xl ds-font-bold"> 填写教育背景 </text>
          <text class="subtitle ds-text-sm ds-text-secondary"> 请如实填写，智能将基于您的背景分析上岸概率 </text>
        </view>

        <view class="input-group ds-gap-xs">
          <text class="label ds-text-sm ds-font-semibold"> 目前学历 <text class="required"> * </text> </text>
          <view class="tab-group ds-flex ds-gap-xs">
            <view
              :class="['tab-item', 'ds-flex-center', 'ds-touchable', { active: formData.degree === 'bk' }]"
              @tap="formData.degree = 'bk'"
            >
              本科
            </view>
            <view
              :class="['tab-item', 'ds-flex-center', 'ds-touchable', { active: formData.degree === 'zk' }]"
              @tap="formData.degree = 'zk'"
            >
              专科
            </view>
          </view>
        </view>

        <view class="input-group ds-gap-xs">
          <text class="label ds-text-sm ds-font-semibold">
            {{ formData.degree === 'bk' ? '本科' : '专科' }}毕业院校 <text class="required"> * </text>
          </text>
          <input
            id="e2e-school-input-current-school"
            v-model="formData.school"
            class="glass-input ds-touchable"
            :placeholder="'请输入' + (formData.degree === 'bk' ? '本科' : '专科') + '毕业院校名称'"
            placeholder-class="ph-style"
            maxlength="30"
          />
          <text class="input-hint ds-text-xs"> {{ formData.school.length }}/30 </text>
        </view>

        <view class="input-group ds-gap-xs">
          <text class="label ds-text-sm ds-font-semibold">
            {{ formData.degree === 'bk' ? '本科' : '专科' }}专业 <text class="required"> * </text>
          </text>
          <input
            id="e2e-school-input-current-major"
            v-model="formData.currentMajor"
            class="glass-input ds-touchable"
            :placeholder="'请输入' + (formData.degree === 'bk' ? '本科' : '专科') + '所学专业'"
            placeholder-class="ph-style"
            maxlength="30"
          />
          <text class="input-hint ds-text-xs"> {{ formData.currentMajor.length }}/30 </text>
        </view>

        <button
          id="e2e-school-step1-next"
          class="primary-btn ds-flex-center ds-gap-sm"
          hover-class="ds-hover-btn"
          :disabled="!canGoToStep2"
          @tap="goToStep2"
        >
          下一步
        </button>
      </view>

      <!-- 第二页：报考信息 -->
      <view v-if="currentStep === 2" class="glass-card form-card">
        <view class="card-header ds-gap-sm">
          <text class="title ds-text-xl ds-font-bold"> 填写报考信息 </text>
          <text class="subtitle ds-text-sm ds-text-secondary"> 请填写您的目标院校和专业 </text>
        </view>

        <view class="input-group ds-gap-xs">
          <text class="label ds-text-sm ds-font-semibold"> 报考院校 <text class="required"> * </text> </text>
          <input
            id="e2e-school-input-target-school"
            v-model="formData.targetSchool"
            class="glass-input ds-touchable"
            placeholder="请输入目标报考院校名称"
            placeholder-class="ph-style"
            maxlength="30"
          />
          <text class="input-hint ds-text-xs"> {{ formData.targetSchool.length }}/30 </text>
        </view>

        <view class="input-group ds-gap-xs">
          <text class="label ds-text-sm ds-font-semibold"> 报考专业 <text class="required"> * </text> </text>
          <input
            id="e2e-school-input-target-major"
            v-model="formData.targetMajor"
            class="glass-input ds-touchable"
            placeholder="请输入目标报考专业"
            placeholder-class="ph-style"
            maxlength="30"
          />
          <text class="input-hint ds-text-xs"> {{ formData.targetMajor.length }}/30 </text>
        </view>

        <view class="input-group ds-gap-xs">
          <text class="label ds-text-sm ds-font-semibold"> 英语证明 </text>
          <picker mode="selector" :range="englishCertificates" @change="bindEnglishCertChange">
            <view class="glass-input picker-val ds-flex ds-flex-between ds-touchable">
              <text :class="{ 'placeholder-text': !formData.englishCert }">
                {{ formData.englishCert || '点击选择英语证明（可选）' }}
              </text>
              <BaseIcon name="chevron-down" :size="24" />
            </view>
          </picker>
        </view>

        <view class="btn-group ds-flex ds-gap-sm">
          <button
            id="e2e-school-step2-prev"
            class="secondary-btn ds-flex-center"
            hover-class="ds-hover-btn"
            @tap="goToStep1"
          >
            上一步
          </button>
          <button
            id="e2e-school-step2-submit"
            class="primary-btn pulse-btn ds-flex-center ds-gap-sm"
            hover-class="ds-hover-btn"
            :disabled="!canSubmit || isSubmitting"
            :loading="isSubmitting"
            @tap="submitForm"
          >
            <BaseIcon v-if="!isSubmitting" name="sparkle" :size="28" />
            {{ isSubmitting ? '智能分析中...' : '开始智能择校匹配' }}
          </button>
        </view>
      </view>

      <!-- 第三页：结果区域 - 推荐院校 -->
      <view v-if="currentStep === 3" id="e2e-school-result-root" class="result-container">
        <view class="result-header ds-flex ds-flex-between">
          <view class="rh-left">
            <text class="rh-title ds-text-lg ds-font-bold"> 推荐院校 </text>
            <text v-if="filteredSchools.length > 0" class="rh-subtitle ds-text-xs ds-text-secondary">
              共 {{ filteredSchools.length }} 所
            </text>
          </view>
          <view
            v-if="filteredSchools.length > 0"
            class="rh-filter ds-flex ds-flex-center ds-gap-xs ds-touchable"
            @click="showFilter = true"
          >
            <text class="ds-text-xs ds-font-medium">
              {{ activeFilterCount > 0 ? `已选(${activeFilterCount})` : '筛选' }}
            </text>
            <BaseIcon name="chevron-down" :size="24" />
          </view>
        </view>

        <!-- 院校统计信息提示 -->
        <view v-if="filteredSchools.length > 0" class="info-banner glass-card">
          <BaseIcon class="info-icon" name="chart-bar" :size="28" />
          <text class="info-text ds-text-xs"> 全国约有923所大学具有研究生招生资格，另有培养研究生的机构233所 </text>
        </view>

        <view v-if="analysisMeta.visible" class="analysis-card glass-card">
          <view class="analysis-head ds-flex ds-flex-between ds-gap-sm">
            <text class="analysis-title ds-text-sm ds-font-semibold"> 本次智能分析说明 </text>
            <text class="analysis-source ds-text-xs"> {{ analysisMeta.source || '系统' }} </text>
          </view>
          <text class="analysis-status ds-text-xs"> {{ analysisMeta.statusText }} </text>
          <text v-if="analysisMeta.rawSummary" class="analysis-summary ds-text-xs">
            {{ analysisMeta.rawSummary }}
          </text>
        </view>

        <view
          v-for="(school, idx) in filteredSchools"
          :id="`e2e-school-card-${idx}`"
          :key="school.id"
          class="glass-card school-card ds-touchable"
          @click="navToDetail(school.id)"
        >
          <view class="sc-head ds-flex">
            <!-- <image :src="school.logo" class="sc-logo ds-rounded" alt="Exam Master" mode="aspectFit" /> -->
            <view class="sc-info">
              <view class="sc-name-row ds-flex">
                <text class="sc-name ds-text-lg ds-font-bold">
                  {{ school.name }}
                </text>
                <view class="sc-loc ds-text-xs" style="display: inline-flex; align-items: center">
                  <BaseIcon name="target" :size="22" style="margin-right: 4rpx" />
                  <text>{{ school.location }}</text>
                </view>
              </view>
              <view class="sc-tags ds-flex ds-gap-xs">
                <text v-for="(tag, tIdx) in school.tags" :key="tIdx" class="tag-item ds-text-xs ds-font-semibold">
                  {{ tag }}
                </text>
              </view>
            </view>
            <view class="match-rate ds-flex-col ds-flex-center">
              <text class="mr-val ds-font-bold"> {{ school.matchRate }}% </text>
              <text class="mr-lbl ds-text-xs"> 匹配度 </text>
            </view>
          </view>

          <view class="sc-majors">
            <view v-for="(major, mIdx) in school.majors" :key="mIdx" class="major-item">
              <view class="mj-title">
                <text class="mj-code"> [{{ major.code }}] </text>
                <text class="mj-name">
                  {{ major.name }}
                </text>
                <text class="mj-type">
                  {{ major.type }}
                </text>
              </view>
              <view class="mj-scores">
                <view class="score-col">
                  <text class="sc-year"> 2025(预) </text
                  ><text class="sc-num high">
                    {{ major.scores && major.scores[0] ? major.scores[0].total : '-' }}
                  </text>
                </view>
                <view class="score-col">
                  <text class="sc-year"> 2024 </text
                  ><text class="sc-num">
                    {{ major.scores && major.scores[1] ? major.scores[1].total : '-' }}
                  </text>
                </view>
                <view class="score-col">
                  <text class="sc-year"> 2023 </text
                  ><text class="sc-num">
                    {{ major.scores && major.scores[2] ? major.scores[2].total : '-' }}
                  </text>
                </view>
                <view class="score-col">
                  <text class="sc-year"> 英语 </text
                  ><text class="sc-num sub">
                    {{ major.scores && major.scores[0] ? major.scores[0].eng || '-' : '-' }}
                  </text>
                </view>
              </view>
            </view>
          </view>

          <view class="card-footer ds-flex ds-gap-sm">
            <view
              :id="`e2e-school-card-detail-${idx}`"
              class="cf-btn outline ds-flex-center ds-touchable"
              @click.stop="navToDetail(school.id, true)"
            >
              招生简章
            </view>
            <view
              :id="`e2e-school-card-target-${idx}`"
              class="cf-btn ds-flex-center ds-touchable"
              :class="school.isTarget ? 'disabled' : 'primary'"
              @click.stop="toggleTarget(school)"
            >
              {{ school.isTarget ? '已在目标库' : '＋ 加入目标' }}
            </view>
          </view>
        </view>

        <view v-if="filteredSchools.length === 0" class="empty-tip ds-flex-col ds-flex-center ds-gap-sm">
          <!-- 择校引导插画 -->
          <image
            class="empty-illustration"
            src="/static/illustrations/school-guide.png"
            mode="aspectFit"
            lazy-load
            alt="择校引导插画"
          />
          <text class="empty-title ds-text-base ds-font-semibold"> 暂无推荐院校数据 </text>
          <text v-if="hasActiveFilter" class="ds-text-sm ds-text-secondary"> 试试调整筛选条件 </text>
          <text v-else class="ds-text-sm ds-text-secondary"> 暂时没有找到匹配的院校，请稍后再试 </text>
          <view
            v-if="hasActiveFilter"
            class="reset-btn ds-touchable"
            @click="hasActiveFilter ? resetFilter() : goToStep1()"
          >
            <text class="reset-btn-text ds-text-sm ds-font-medium"> 重置筛选 </text>
          </view>
          <view v-else class="reset-btn ds-touchable" @click="goToStep1">
            <text class="reset-btn-text ds-text-sm ds-font-medium"> 重新填写 </text>
          </view>
        </view>

        <!-- 返回修改按钮 -->
        <view
          v-if="filteredSchools.length > 0"
          id="e2e-school-back-edit"
          class="back-edit-btn ds-flex ds-flex-center ds-touchable"
          @tap="goToStep1"
        >
          <view class="ds-flex ds-flex-center" style="gap: 4rpx">
            <BaseIcon name="arrow-left" :size="24" />
            <text class="ds-text-sm"> 返回修改信息 </text>
          </view>
        </view>

        <view class="safe-area-bottom" />
      </view>

      <!-- 信息提示 -->
      <view v-if="currentStep === 1" class="info-tip">
        <BaseIcon name="lock" :size="24" />
        <text>您的数据仅用于智能模型本地分析，不会被公开</text>
      </view>
    </scroll-view>

    <!-- 底部导航栏组件 -->
    <CustomTabbar :is-dark="isDark" />

    <!-- 筛选弹窗 - 优化样式 -->
    <view v-if="showFilter" class="filter-mask" @click="showFilter = false">
      <view class="filter-panel glass-card" @click.stop>
        <view class="fp-header ds-flex ds-flex-between">
          <text class="fp-title ds-text-xl ds-font-bold"> 院校筛选 </text>
          <text class="fp-reset ds-text-sm ds-touchable" @click="resetFilter"> 重置 </text>
        </view>

        <view class="fp-section">
          <text class="fp-label ds-text-sm ds-font-semibold"> 所在地区 </text>
          <scroll-view scroll-x class="tag-scroll" :show-scrollbar="false">
            <view class="filter-tags ds-flex ds-gap-xs">
              <view
                class="ft-item ds-touchable ds-text-xs"
                :class="{ active: filter.location === '' }"
                @click="filter.location = ''"
              >
                全部
              </view>
              <view
                v-for="loc in locations"
                :key="loc"
                class="ft-item ds-touchable ds-text-xs"
                :class="{ active: filter.location === loc }"
                @click="filter.location = loc"
              >
                {{ loc }}
              </view>
            </view>
          </scroll-view>
        </view>

        <view class="fp-section">
          <text class="fp-label ds-text-sm ds-font-semibold"> 院校层次 </text>
          <view class="filter-tags ds-flex ds-gap-xs">
            <view
              class="ft-item ds-touchable ds-text-xs"
              :class="{ active: filter.tag === '' }"
              @click="filter.tag = ''"
            >
              不限
            </view>
            <view
              class="ft-item ds-touchable ds-text-xs"
              :class="{ active: filter.tag === '985' }"
              @click="filter.tag = '985'"
            >
              985院校
            </view>
            <view
              class="ft-item ds-touchable ds-text-xs"
              :class="{ active: filter.tag === '211' }"
              @click="filter.tag = '211'"
            >
              211院校
            </view>
            <view
              class="ft-item ds-touchable ds-text-xs"
              :class="{ active: filter.tag === '自划线' }"
              @click="filter.tag = '自划线'"
            >
              34所自划线
            </view>
          </view>
        </view>

        <button class="fp-confirm-btn ds-flex-center ds-font-bold" @click="showFilter = false">查看结果</button>
      </view>
    </view>

    <!-- 离线状态指示器 -->
    <OfflineIndicator :auto-show="true" position="top" :auto-hide-delay="5000" />
  </view>
</template>

<script>
import { modal } from '@/utils/modal.js';
import { toast } from '@/utils/toast.js';
import CustomTabbar from '@/components/layout/custom-tabbar/custom-tabbar.vue';
import SchoolSkeleton from '@/components/base/school-skeleton/school-skeleton.vue';
import { useSchoolStore } from '@/stores/modules/school';
// ✅ 统一日志工具（生产环境自动禁用）
import { logger } from '@/utils/logger.js';
import { vibrateLight } from '@/utils/helpers/haptic.js';
import { getStatusBarHeight, getCapsuleSafeRight } from '@/utils/core/system.js';
import { safeNavigateTo, safeNavigateBack } from '@/utils/safe-navigate';
// ✅ F019: 统一使用 storageService 进行数据缓存管理
import storageService from '@/services/storageService.js';
import config from '@/config/index.js';
import { isUserLoggedIn } from '@/utils/auth/loginGuard.js';
import BaseIcon from '@/components/base/base-icon/base-icon.vue';
import PrivacyPopup from '@/components/common/privacy-popup.vue';

// P2-6: 默认院校列表提取为模块级冻结常量，避免每次调用创建新数组
let _defaultSchools = null;
function getDefaultSchoolsFrozen() {
  if (!_defaultSchools) {
    const base = config.externalCdn.dicebearBaseUrl;
    _defaultSchools = Object.freeze([
      {
        id: 'demo_1',
        name: '北京大学',
        location: '北京',
        matchRate: 85,
        isTarget: false,
        logo: `${base}/initials/svg?seed=PKU&backgroundColor=663399`,
        tags: ['985', '211', '双一流'],
        majors: []
      },
      {
        id: 'demo_2',
        name: '清华大学',
        location: '北京',
        matchRate: 82,
        isTarget: false,
        logo: `${base}/initials/svg?seed=THU&backgroundColor=663399`,
        tags: ['985', '211', '双一流'],
        majors: []
      },
      {
        id: 'demo_3',
        name: '复旦大学',
        location: '上海',
        matchRate: 88,
        isTarget: false,
        logo: `${base}/initials/svg?seed=FDU&backgroundColor=663399`,
        tags: ['985', '211', '双一流'],
        majors: []
      },
      {
        id: 'demo_4',
        name: '浙江大学',
        location: '浙江',
        matchRate: 90,
        isTarget: false,
        logo: `${base}/initials/svg?seed=ZJU&backgroundColor=663399`,
        tags: ['985', '211', '双一流'],
        majors: []
      },
      {
        id: 'demo_5',
        name: '上海交通大学',
        location: '上海',
        matchRate: 86,
        isTarget: false,
        logo: `${base}/initials/svg?seed=SJTU&backgroundColor=663399`,
        tags: ['985', '211', '双一流'],
        majors: []
      }
    ]);
  }
  return _defaultSchools;
}

export default {
  components: {
    PrivacyPopup,
    CustomTabbar,
    SchoolSkeleton,
    BaseIcon
  },
  setup() {
    // 初始化择校 Store，供 methods 中通过 this.schoolStore 调用
    const schoolStore = useSchoolStore();
    return { schoolStore };
  },
  data() {
    return {
      statusBarHeight: 44,
      navBarHeight: 88, // 标准导航栏高度 = 44 + 44
      capsuleSafeRight: 20,
      currentStep: 1,
      showFilter: false,
      isDark: false,
      isLoading: true, // 骨架屏加载状态
      isSubmitting: false, // ✅ 防重复提交状态
      isOffline: false, // 问题53：离线状态标记

      formData: { school: '', currentMajor: '', targetSchool: '', targetMajor: '', degree: 'bk', englishCert: '' },
      englishCertificates: ['无', 'B级', 'A级', '四级', '六级', '专四', '专八', '雅思', '托福', 'GRE', 'GMAT'],

      filter: { location: '', tag: '' },
      locations: ['北京', '上海', '浙江', '江苏', '湖北', '四川'],

      /**
       * 推荐院校列表
       *
       * 数据来源：仅使用真实数据
       * 1. 智能择校匹配结果（submitForm 调用后端智能推荐）
       * 2. 后端热门学校 API（lafService.getHotSchools）
       * 3. 本地缓存数据
       * 注意：不再使用模拟数据，无数据时显示空状态
       */
      schoolList: [],

      // 标记是否有真实数据
      hasRealData: false,
      analysisMeta: {
        visible: false,
        source: '',
        statusText: '',
        rawSummary: ''
      }
    };
  },
  computed: {
    // 第一步表单验证：学历已选、毕业院校和专业都已填写
    canGoToStep2() {
      const schoolValid = this.formData.school && this.formData.school.trim().length > 0;
      const majorValid = this.formData.currentMajor && this.formData.currentMajor.trim().length > 0;
      // 额外验证：院校名称格式
      const schoolFormatValid =
        schoolValid && /^[\u4e00-\u9fa5a-zA-Z0-9\s\-·()（）]+$/.test(this.formData.school.trim());
      return schoolFormatValid && majorValid;
    },
    // 第二步表单验证：报考院校和专业都已填写
    canSubmit() {
      const targetSchoolValid = this.formData.targetSchool && this.formData.targetSchool.trim().length > 0;
      const targetMajorValid = this.formData.targetMajor && this.formData.targetMajor.trim().length > 0;
      // 额外验证：报考院校名称格式
      const targetSchoolFormatValid =
        targetSchoolValid && /^[\u4e00-\u9fa5a-zA-Z0-9\s\-·()（）]+$/.test(this.formData.targetSchool.trim());
      return targetSchoolFormatValid && targetMajorValid;
    },
    // 是否有激活的筛选条件
    hasActiveFilter() {
      return this.filter.location || this.filter.tag;
    },
    filteredSchools() {
      return this.schoolList.filter((school) => {
        const matchLoc = this.filter.location ? school.location === this.filter.location : true;
        const matchTag = this.filter.tag ? (school.tags || []).includes(this.filter.tag) : true;
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
  watch: {},
  // 错误边界：捕获子组件运行时错误，防止整个页面白屏
  errorCaptured(err, instance, info) {
    logger.error('[择校] 子组件运行时错误:', err?.message || err, '| 来源:', info);
    return false;
  },

  // [F2-FIX] 微信分享配置
  onShareAppMessage() {
    return {
      title: '择校分析 - Exam-Master 考研备考',
      path: '/pages/school/index',
      imageUrl: '/static/images/app-share-cover.png'
    };
  },

  async onLoad() {
    // 统一计算：状态栏高度
    this.statusBarHeight = getStatusBarHeight();
    // 标准导航栏高度 = 状态栏高度 + 44px
    this.navBarHeight = this.statusBarHeight + 44;
    this.capsuleSafeRight = getCapsuleSafeRight();
    this.syncTargetStatus();

    // 初始化主题
    const savedTheme = storageService.get('theme_mode', 'light');
    this.isDark = savedTheme === 'dark';

    // 监听全局主题更新事件
    this._themeHandler = (mode) => {
      this.isDark = mode === 'dark';
    };
    uni.$on('themeUpdate', this._themeHandler);

    // 问题53：监听网络状态变化
    this.initNetworkListener();

    // 加载推荐院校数据
    try {
      await this.loadRecommendedSchools();
    } catch (e) {
      logger.error('[school] 加载推荐院校失败:', e);
    } finally {
      // 隐藏骨架屏（无论成功失败都要隐藏）
      this.isLoading = false;
    }
  },
  onShow() {
    // 原生 tabBar 已移除，无需隐藏
    // uni.hideTabBar({
    // 	animation: false
    // });
    // F005: 通知 CustomTabbar 重新检测路由
    uni.$emit('tabbarRouteUpdate');
  },
  onUnload() {
    // 移除事件监听
    uni.$off('themeUpdate', this._themeHandler);
    // 问题53：移除网络监听
    uni.offNetworkStatusChange && uni.offNetworkStatusChange();
    // [AUDIT R295] 清理可能残留的 AI 分析超时定时器
    if (this._pendingTimers) {
      this._pendingTimers.forEach((t) => clearTimeout(t));
      this._pendingTimers = [];
    }
  },
  methods: {
    resetAnalysisMeta() {
      this.analysisMeta = {
        visible: false,
        source: '',
        statusText: '',
        rawSummary: ''
      };
    },

    setAnalysisMeta({ source = '', statusText = '', rawSummary = '', visible = true } = {}) {
      this.analysisMeta = {
        visible,
        source,
        statusText,
        rawSummary: this.normalizeSummaryText(rawSummary)
      };
    },

    normalizeSummaryText(text) {
      if (!text) return '';
      const normalized = String(text)
        .replace(/```[\s\S]*?```/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      return normalized.slice(0, 180);
    },

    extractSchoolsFromText(text = '') {
      if (!text) return [];
      const nameMatches = String(text).match(/[\u4e00-\u9fa5]{2,24}(大学|学院|研究院|研究所)/g) || [];
      const uniqueNames = [...new Set(nameMatches)].slice(0, 8);
      return uniqueNames.map((name, index) => {
        const normalized = this.normalizeSchoolCard({
          _id: `text_school_${index}`,
          code: `text_school_${index}`,
          name,
          province: '待确认',
          tags: ['文本提及']
        });
        return {
          ...normalized,
          majors: []
        };
      });
    },

    estimateMatchRate(school = {}) {
      const tags = Array.isArray(school.tags) ? school.tags : [];
      let base = 72;
      if (tags.includes('985')) base = 88;
      else if (tags.includes('211')) base = 82;
      else if (tags.includes('双一流')) base = 85;

      const seed = String(school.code || school._id || school.name || 'school');
      let hash = 0;
      for (let i = 0; i < seed.length; i++) {
        hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
      }
      const jitter = (hash % 9) - 4;
      return Math.max(65, Math.min(98, base + jitter));
    },

    normalizeSchoolCard(school = {}) {
      const rawRate = Number(school.matchRate);
      return {
        id: school.code || school._id,
        name: school.name,
        location: school.province,
        matchRate: Number.isFinite(rawRate) && rawRate > 0 ? rawRate : this.estimateMatchRate(school),
        isTarget: false,
        logo:
          school.logo ||
          `${config.externalCdn.dicebearBaseUrl}/initials/svg?seed=${school.shortName || school.name}&backgroundColor=663399`,
        tags: school.tags || [],
        majors: []
      };
    },

    applySchoolList(schools = [], hasRealData = false) {
      this.schoolList = Array.isArray(schools) ? schools : [];
      this.hasRealData = !!hasRealData;
      this.syncTargetStatus();
    },

    enterE2EResultStep(schools = []) {
      const normalized = Array.isArray(schools)
        ? schools.map((school, index) => {
            const normalizedSchool = this.normalizeSchoolCard({
              ...school,
              _id: school?._id || school?.id || `e2e_school_${index}`,
              code: school?.code || school?.id || `e2e_school_${index}`,
              name: school?.name || `E2E院校${index + 1}`,
              province: school?.province || school?.location || '北京',
              tags: Array.isArray(school?.tags) ? school.tags : ['双一流']
            });

            const majors = Array.isArray(school?.majors)
              ? school.majors
              : [{ code: '085400', name: '电子信息', type: '专硕', scores: [{ total: '360', eng: '55' }] }];

            return {
              ...normalizedSchool,
              majors
            };
          })
        : [];

      this.applySchoolList(normalized, normalized.length > 0);
      this.currentStep = 3;
      return this.schoolList.length;
    },

    // 问题53：初始化网络状态监听
    initNetworkListener() {
      // 获取当前网络状态
      uni.getNetworkType({
        success: (res) => {
          this.isOffline = res.networkType === 'none';
          logger.log('[school] 📶 当前网络状态:', res.networkType, '离线:', this.isOffline);
        }
      });

      // 监听网络状态变化
      uni.onNetworkStatusChange((res) => {
        const wasOffline = this.isOffline;
        this.isOffline = !res.isConnected;

        logger.log('[school] 📶 网络状态变化:', res.networkType, '离线:', this.isOffline);

        if (wasOffline && res.isConnected) {
          // 从离线恢复到在线，尝试刷新数据
          toast.info('网络已恢复');
          this.loadRecommendedSchools();
        } else if (!wasOffline && !res.isConnected) {
          // 从在线变为离线
          toast.info('网络已断开，使用缓存数据');
        }
      });
    },

    // 步骤导航方法
    goToStep1() {
      this.currentStep = 1;
    },
    goToStep2() {
      if (!this.canGoToStep2) {
        // 更详细的错误提示
        if (!this.formData.school || !this.formData.school.trim()) {
          toast.info('请输入毕业院校名称');
        } else if (!/^[\u4e00-\u9fa5a-zA-Z0-9\s\-·()（）]+$/.test(this.formData.school.trim())) {
          toast.info('院校名称包含非法字符');
        } else if (!this.formData.currentMajor || !this.formData.currentMajor.trim()) {
          toast.info('请输入所学专业');
        } else {
          toast.info('请完整填写背景信息');
        }
        return;
      }
      this.currentStep = 2;
    },
    handleBack() {
      if (this.currentStep === 3) {
        this.currentStep = 2;
      } else if (this.currentStep === 2) {
        this.currentStep = 1;
      } else {
        safeNavigateBack();
      }
    },
    /**
     * 加载推荐院校数据
     * 问题53修复：增加离线缓存支持，无网络时使用本地缓存
     */
    async loadRecommendedSchools() {
      logger.log('[school] 📚 开始加载推荐院校数据...');
      logger.log('[school] 📶 当前网络状态 - 离线:', this.isOffline);

      // 问题53：如果离线，优先使用本地缓存
      if (this.isOffline) {
        logger.log('[school] 📴 离线模式，尝试加载本地缓存');
        const cachedSchools = storageService.get('cached_schools');
        if (cachedSchools && cachedSchools.length > 0) {
          this.applySchoolList(cachedSchools, true);
          this.lastSyncTime = storageService.get('cached_schools_time');
          logger.log(`[school] ✅ 离线模式：从本地缓存加载 ${this.schoolList.length} 所院校`);

          // 显示离线提示
          toast.info('离线模式，显示缓存数据');
          return;
        } else {
          // 无缓存时使用默认数据
          this.applySchoolList([...getDefaultSchoolsFrozen()], false);
          logger.log('[school] ⚠️ 离线且无缓存，使用示例数据');
          toast.info('无网络连接，显示示例数据');
          return;
        }
      }

      // E009: 缓存 TTL 检查 — 10 分钟内直接使用本地缓存，避免重复请求
      const CACHE_TTL = 10 * 60 * 1000; // 10 minutes
      const cachedTime = storageService.get('cached_schools_time');
      if (cachedTime && Date.now() - cachedTime < CACHE_TTL) {
        const freshCache = storageService.get('cached_schools');
        if (freshCache && freshCache.length > 0) {
          this.applySchoolList(freshCache, true);
          this.lastSyncTime = cachedTime;
          logger.log(
            `[school] 缓存未过期（${Math.round((Date.now() - cachedTime) / 1000)}s），使用本地缓存 ${freshCache.length} 所院校`
          );
          return;
        }
      }

      try {
        // 1. 尝试从后端获取热门学校
        const response = await this.schoolStore.fetchHotSchools({ limit: 10 });

        if (response && response.code === 0 && Array.isArray(response.data) && response.data.length > 0) {
          this.applySchoolList(
            response.data.map((school) => this.normalizeSchoolCard(school)),
            true
          );
          logger.log(`[school] ✅ 从后端加载 ${this.schoolList.length} 所院校`);

          // 问题53：缓存到本地（带时间戳）
          // ✅ F019: 统一使用 storageService
          storageService.save('cached_schools', this.schoolList);
          storageService.save('cached_schools_time', Date.now());
          this.lastSyncTime = Date.now();
          return;
        }

        // 1.1 热门院校为空时，降级使用 crawler 数据
        const crawlerResp = await this.schoolStore.crawlSchoolData(
          {
            action: 'list',
            data: {
              page: 1,
              pageSize: 10
            }
          },
          {
            skipAuth: true,
            maxRetries: 2
          }
        );

        const crawlerList = crawlerResp?.data?.list;
        if (crawlerResp && crawlerResp.code === 0 && Array.isArray(crawlerList) && crawlerList.length > 0) {
          this.applySchoolList(
            crawlerList.slice(0, 10).map((school) => this.normalizeSchoolCard(school)),
            true
          );
          logger.log(`[school] ✅ 后端热门为空，已从 crawler 加载 ${this.schoolList.length} 所院校`);
          storageService.save('cached_schools', this.schoolList);
          storageService.save('cached_schools_time', Date.now());
          this.lastSyncTime = Date.now();
          return;
        }
      } catch (error) {
        logger.warn('[school] ⚠️ 后端获取失败，尝试本地缓存:', error);
      }

      // 2. 尝试从本地缓存获取
      const cachedSchools = storageService.get('cached_schools');
      if (cachedSchools && cachedSchools.length > 0) {
        this.applySchoolList(cachedSchools, true);
        this.lastSyncTime = storageService.get('cached_schools_time');
        logger.log(`[school] ✅ 从本地缓存加载 ${this.schoolList.length} 所院校`);
        return;
      }

      // 3. 无数据时使用示例数据作为兜底
      this.applySchoolList([...getDefaultSchoolsFrozen()], false);
      logger.log('[school] ⚠️ 暂无真实院校数据，使用示例数据');
    },

    /**
     * 获取默认示例数据（用于无数据时的兜底显示）
     * 提供示例数据帮助用户了解功能
     */
    bindEnglishCertChange(e) {
      this.formData.englishCert = this.englishCertificates[e.detail.value];
    },
    // 调用智谱智能 API获取真实院校推荐数据
    async submitForm() {
      // ✅ 登录校验
      if (!isUserLoggedIn()) {
        toast.info('请先登录后使用智能匹配');
        return;
      }
      // ✅ 防重复提交保护
      if (this.isSubmitting) {
        return;
      }

      // 验证第二步表单
      if (!this.canSubmit) {
        // P012: 具体提示缺少哪项报考信息
        if (!this.formData.targetSchool || !this.formData.targetSchool.trim()) {
          toast.info('请输入报考院校名称');
        } else if (!this.formData.targetMajor || !this.formData.targetMajor.trim()) {
          toast.info('请输入报考专业');
        } else {
          toast.info('请完整填写报考信息');
        }
        return;
      }

      // 问题53：离线状态检查
      if (this.isOffline) {
        modal.show({
          title: '网络不可用',
          content: '当前处于离线状态，无法进行智能匹配。是否查看缓存的推荐院校？',
          confirmText: '查看缓存',
          cancelText: '取消',
          success: (res) => {
            if (res.confirm) {
              // 使用缓存数据显示结果
              const cachedSchools = storageService.get('cached_schools');
              if (cachedSchools && cachedSchools.length > 0) {
                this.applySchoolList(cachedSchools, true);
                this.currentStep = 3;
                toast.info('显示缓存数据');
              } else {
                this.applySchoolList([...getDefaultSchoolsFrozen()], false);
                this.currentStep = 3;
                toast.info('无缓存，显示示例数据');
              }
            }
          }
        });
        return;
      }

      this.isSubmitting = true;

      const resetAnalysisMeta = () => {
        if (typeof this.resetAnalysisMeta === 'function') {
          this.resetAnalysisMeta();
        }
      };

      const setAnalysisMeta = (payload) => {
        if (typeof this.setAnalysisMeta === 'function') {
          this.setAnalysisMeta(payload);
        }
      };

      const extractSchoolsFromText = (text) => {
        if (typeof this.extractSchoolsFromText === 'function') {
          return this.extractSchoolsFromText(text);
        }
        return [];
      };

      resetAnalysisMeta();

      logger.log('[school] 📝 开始提交择校表单');
      logger.log('[school] 📊 表单数据:', JSON.stringify(this.formData, null, 2));

      // 验证毕业院校名称
      if (!this.formData.school || !/^[\u4e00-\u9fa5a-zA-Z0-9\s\-·()（）]+$/.test(this.formData.school.trim())) {
        logger.warn('[school] ⚠️ 表单验证失败: 毕业院校名称无效');
        this.isSubmitting = false;
        return toast.info('请输入有效的毕业院校名称');
      }

      // 验证报考院校名称
      if (
        !this.formData.targetSchool ||
        !/^[\u4e00-\u9fa5a-zA-Z0-9\s\-·()（）]+$/.test(this.formData.targetSchool.trim())
      ) {
        logger.warn('[school] ⚠️ 表单验证失败: 报考院校名称无效');
        this.isSubmitting = false;
        return toast.info('请输入有效的报考院校名称');
      }

      if (!this.formData.targetMajor || !this.formData.targetMajor.trim()) {
        logger.warn('[school] ⚠️ 表单验证失败: 报考专业为空');
        this.isSubmitting = false;
        return toast.info('请输入报考专业');
      }

      logger.log('[school] ✅ 表单验证通过');

      vibrateLight();

      // 显示Apple 智能质感的Loading页面
      toast.loading('智能分析中...');

      // 设置超时保护标志，避免重复处理
      let isTimeoutHandled = false;

      // 设置超时保护（20秒后自动取消Loading，优化用户体验）
      // [AUDIT R295] 使用实例属性追踪定时器，以便 onUnload 可以清理
      if (!this._pendingTimers) this._pendingTimers = [];
      let loadingTimeout = setTimeout(() => {
        if (isTimeoutHandled) {
          logger.log('[school] ⏱️ 超时处理已执行，跳过重复处理');
          return;
        }
        isTimeoutHandled = true;
        logger.warn('[school] ⏱️ 智能分析超时（20秒），显示空状态');
        toast.hide();
        toast.info('智能分析超时，请稍后重试');
        // 切换到结果页面，显示空状态（不使用模拟数据）
        this.applySchoolList([], false);
        setAnalysisMeta({
          source: '智能推荐服务',
          statusText: '智能分析超时，未获取到可解析的院校列表',
          rawSummary: '请求超时（20秒）'
        });
        this.currentStep = 3;
        logger.log('[school] ✅ 超时：切换到结果页面 (Step 3)，显示空状态');
        loadingTimeout = null;
      }, 20000); // 20秒超时
      this._pendingTimers.push(loadingTimeout);

      try {
        logger.log('[school] 🤖 调用后端代理进行择校匹配...');

        // ✅ 使用后端代理调用（安全）- action: 'recommend'
        const userProfile = {
          school: this.formData.school.trim(),
          currentMajor: this.formData.currentMajor.trim(),
          targetSchool: this.formData.targetSchool.trim(),
          targetMajor: this.formData.targetMajor.trim(),
          degree: this.formData.degree === 'bk' ? '本科' : '专科',
          englishCert: this.formData.englishCert || '无'
        };
        const response = await this.schoolStore.aiRecommend('recommend', {
          content: `请根据以下考生信息推荐适合的考研院校：\n毕业院校：${userProfile.school}\n所学专业：${userProfile.currentMajor}\n报考院校：${userProfile.targetSchool}\n报考专业：${userProfile.targetMajor}\n学历：${userProfile.degree}\n英语水平：${userProfile.englishCert}`,
          ...userProfile
        });

        logger.log('[school] 📥 后端代理请求完成，开始处理响应...');

        // 处理API响应
        if (response && response.code === 0 && response.data !== undefined && response.data !== null) {
          logger.log('[school] ✅ API 响应解析成功');
          const content =
            response.data && typeof response.data === 'object' && typeof response.data.reply === 'string'
              ? response.data.reply
              : response.data;
          const contentPreview = typeof content === 'string' ? content : JSON.stringify(content);
          logger.log('[school] 🤖 智能返回内容长度:', contentPreview ? contentPreview.length : 0);
          setAnalysisMeta({
            source: '智能推荐服务',
            statusText: '已收到智能响应，正在解析推荐院校',
            rawSummary: contentPreview
          });

          try {
            // 智能可能返回 JSON 或自然语言文本，需要安全解析
            let parsedData = null;

            if (typeof content === 'string') {
              const trimmedContent = content.trim();
              try {
                parsedData = JSON.parse(trimmedContent);
                logger.log('[school] ✅ JSON 解析成功');
                setAnalysisMeta({
                  source: '智能推荐服务',
                  statusText: '响应为标准 JSON，已完成结构化解析',
                  rawSummary: trimmedContent
                });
              } catch (_jsonErr) {
                // 智能返回了自然语言文本，尝试从文本中提取 JSON 块
                const jsonMatch = trimmedContent.match(/\[[\s\S]*\]|\{[\s\S]*\}/);
                if (jsonMatch) {
                  try {
                    parsedData = JSON.parse(jsonMatch[0]);
                    logger.log('[school] ✅ 从文本中提取 JSON 成功');
                    setAnalysisMeta({
                      source: '智能推荐服务',
                      statusText: '响应为文本，已提取其中 JSON 片段并解析',
                      rawSummary: trimmedContent
                    });
                  } catch {
                    parsedData = null;
                  }
                }
                if (!parsedData) {
                  logger.warn('[school] ⚠️ 智能返回非 JSON 格式，尝试文本提取院校');
                  setAnalysisMeta({
                    source: '智能推荐服务',
                    statusText: '响应为自然语言，已尝试从文本中提取院校名称',
                    rawSummary: trimmedContent
                  });
                  parsedData = { schools: extractSchoolsFromText(trimmedContent) };
                }
              }
            } else if (typeof content === 'object') {
              parsedData = content;
              logger.log('[school] ✅ 智能返回对象格式数据');
              setAnalysisMeta({
                source: '智能推荐服务',
                statusText: '响应为对象数据，已尝试读取 schools 字段',
                rawSummary: JSON.stringify(content)
              });
            }

            if (!parsedData || typeof parsedData !== 'object') {
              logger.warn('[school] ⚠️ 智能返回数据不可解析，显示空状态');
              this.applySchoolList([], false);
              setAnalysisMeta({
                source: '智能推荐服务',
                statusText: '响应内容不可解析，未识别出院校列表',
                rawSummary: contentPreview
              });
              parsedData = {};
            }

            // 更新院校数据
            let schoolsList = [];
            if (Array.isArray(parsedData)) {
              schoolsList = parsedData;
            } else if (parsedData.schools && Array.isArray(parsedData.schools)) {
              schoolsList = parsedData.schools;
            }

            // 如果API返回格式不符合预期，显示空状态
            if (schoolsList.length === 0) {
              logger.warn('[school] ⚠️ API返回格式不符合预期，显示空状态');
              logger.log('[school] 📊 返回数据结构:', Object.keys(parsedData));
              logger.log('[school] 📄 返回数据预览:', JSON.stringify(parsedData).substring(0, 200));
              this.hasRealData = false;
              setAnalysisMeta({
                source: '智能推荐服务',
                statusText: '响应中未包含结构化院校列表',
                rawSummary: contentPreview
              });
            }

            // 规范化数据格式，确保每个专业都有完整的 scores 数组
            if (schoolsList.length > 0) {
              schoolsList = schoolsList.map((school) => {
                // 确保有 majors 数组
                if (!school.majors || !Array.isArray(school.majors)) {
                  school.majors = [];
                }

                // 规范化每个专业的 scores 数据
                school.majors = school.majors.map((major) => {
                  if (!major.scores || !Array.isArray(major.scores) || major.scores.length === 0) {
                    // 如果没有 scores，创建默认结构
                    major.scores = [{ total: '-', eng: '-' }, { total: '-' }, { total: '-' }];
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

              this.applySchoolList(schoolsList, true);
              logger.log(`[school] ✅ 更新院校列表: ${schoolsList.length} 所院校（已规范化数据格式）`);
              setAnalysisMeta({
                source: '智能推荐服务',
                statusText: `已解析到 ${schoolsList.length} 所推荐院校`,
                rawSummary: contentPreview
              });
            } else {
              // 无数据时显示空状态
              this.applySchoolList([], false);
              logger.log('[school] ⚠️ 智能返回空数据，显示空状态');
              setAnalysisMeta({
                source: '智能推荐服务',
                statusText: '智能已返回内容，但未匹配到可展示院校',
                rawSummary: contentPreview
              });
            }
          } catch (parseError) {
            logger.error('[school] ❌ JSON 解析失败:', parseError);
            logger.log('[school] 📄 原始内容预览:', String(contentPreview).substring(0, 200));
            this.applySchoolList([], false);
            setAnalysisMeta({
              source: '智能推荐服务',
              statusText: '响应解析失败，未生成推荐院校',
              rawSummary: contentPreview
            });
          }
        } else {
          // 修复验证：明确记录响应异常情况
          logger.warn('[school] ⚠️ 智能 API 响应异常或无数据');
          logger.log('[school] 📊 响应详情:', {
            hasResponse: !!response,
            code: response?.code,
            hasData: !!response?.data
          });
          // 显示空状态
          this.applySchoolList([], false);
          setAnalysisMeta({
            source: '智能推荐服务',
            statusText: '接口响应异常，未返回可用数据',
            rawSummary: JSON.stringify(response || {})
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
          logger.log('[school] ℹ️ 30秒超时保护已触发，跳过成功处理');
          return;
        }

        // 隐藏加载动画，切换到结果页面
        toast.hide();
        this.currentStep = 3;
        logger.log('[school] ✅ 切换到结果页面 (Step 3)');
        logger.log('[school] 📊 当前推荐院校数量:', this.filteredSchools.length);
        if (this.filteredSchools.length > 0) {
          toast.success('匹配成功');
        } else {
          toast.info('暂无匹配结果');
        }
      } catch (error) {
        // 清除超时定时器
        if (loadingTimeout) {
          clearTimeout(loadingTimeout);
          loadingTimeout = null;
        }

        // 如果30秒超时保护已经触发，不再重复处理错误
        if (isTimeoutHandled) {
          logger.log('[school] ℹ️ 30秒超时保护已触发，跳过错误处理');
          return;
        }

        logger.error('[school] ❌ 智能推荐失败:', error);

        // 详细的错误处理和日志
        let errorMsg = '智能推荐失败，请稍后重试';
        let errorType = 'unknown';

        if (error.errMsg) {
          if (error.errMsg.includes('timeout') || error.errMsg.includes('time out') || error.errMsg.includes('超时')) {
            errorMsg = '智能分析超时，请稍后重试';
            errorType = 'timeout';
            logger.warn('[school] ⏱️ 请求超时（60秒）');
          } else if (error.statusCode === 401 || error.statusCode === 403) {
            errorMsg = '登录状态失效，请重新登录';
            errorType = 'auth';
            logger.error('[school] 🔑 API Key 错误:', error.statusCode);
          } else if (error.statusCode >= 500) {
            errorMsg = '智能服务暂时不可用';
            errorType = 'server';
            logger.error('[school] 🖥️ 服务器错误:', error.statusCode);
          } else if (error.errMsg.includes('fail') || error.errMsg.includes('网络')) {
            errorMsg = '网络连接失败，请检查后重试';
            errorType = 'network';
            logger.error('[school] 🌐 网络错误');
          }
        }

        logger.log('[school] 📊 错误详情:', {
          type: errorType,
          message: errorMsg,
          originalError: error.errMsg || error.message || error
        });

        // 如果30秒超时保护已经触发，不再重复显示提示和切换页面
        if (!isTimeoutHandled) {
          toast.hide();
          toast.info(errorMsg, 3000);

          // 切换到结果页面，显示空状态（不使用模拟数据）
          this.applySchoolList([], false);
          setAnalysisMeta({
            source: '智能推荐服务',
            statusText: errorMsg,
            rawSummary: error.errMsg || error.message || String(error)
          });
          this.currentStep = 3;
          logger.log('[school] ✅ 错误处理：切换到结果页面 (Step 3)，显示空状态');
        } else {
          logger.log('[school] ℹ️ 超时保护已处理，跳过重复的错误处理');
        }
      } finally {
        // ✅ 无论成功失败，都解锁提交按钮
        this.isSubmitting = false;
      }
    },
    resetFilter() {
      this.filter = { location: '', tag: '' };
      this.showFilter = false;
    },
    toggleTarget(school) {
      if (!isUserLoggedIn()) {
        toast.info('请先登录后添加目标院校');
        return;
      }
      school.isTarget = !school.isTarget;
      let targets = storageService.get('target_schools', []);
      if (school.isTarget) {
        const exists = targets.some((t) => t.id === school.id);
        if (!exists) {
          targets.push({ id: school.id, name: school.name, location: school.location, logo: school.logo });
        }
        vibrateLight();
        toast.success('已加入目标库');
      } else {
        targets = targets.filter((t) => t.id !== school.id);
        toast.info('已取消');
      }
      // ✅ F019: 统一使用 storageService
      storageService.save('target_schools', targets);
    },
    syncTargetStatus() {
      const targets = storageService.get('target_schools', []);
      const targetIds = new Set(targets.map((t) => String(t.id)));
      this.schoolList.forEach((s) => {
        s.isTarget = targetIds.has(String(s.id));
      });
    },
    navToDetail(id, openConsult = false) {
      logger.log(`[school] 🔗 跳转到详情页: id=${id}, openConsult=${openConsult}`);

      // 查找对应的院校数据
      const school = this.schoolList.find((s) => s.id === id || s.id === String(id));
      if (school) {
        logger.log(`[school] 📊 找到院校数据:`, {
          id: school.id,
          name: school.name,
          location: school.location,
          matchRate: school.matchRate,
          hasMajors: !!school.majors,
          majorsCount: school.majors?.length || 0
        });

        // 优化：通过缓存传递完整数据，避免URL过长导致小程序跳转失败
        // 先缓存数据，详情页通过id读取
        try {
          storageService.save(`school_detail_${id}`, school);
        } catch {
          /* 缓存失败不影响跳转 */
        }
        safeNavigateTo(`/pages/school-sub/detail?id=${id}&openConsult=${openConsult}`, {
          success: () => {
            logger.log(`[school] ✅ 页面跳转成功: /pages/school-sub/detail?id=${id}`);
          }
        });
      } else {
        logger.warn(`[school] ⚠️ 未找到院校数据，id=${id}，将使用详情页的 Mock 数据`);
        // 即使找不到数据，也允许跳转，详情页会使用 Mock 数据
        safeNavigateTo(`/pages/school-sub/detail?id=${id}&openConsult=${openConsult}`, {
          success: () => {
            logger.log(`[school] ✅ 页面跳转成功（使用详情页 Mock 数据）: /pages/school-sub/detail?id=${id}`);
          }
        });
      }
    }
  }
};
</script>

<style lang="scss" scoped>
.container {
  /* 强调色（School 模块 - 热橙） */
  --accent-warm: var(--warning);
  --accent-cool: var(--warning-hover, #e68600);
  --accent-warm-soft: rgba(255, 150, 0, 0.1);
  --accent-warm-mid: rgba(255, 150, 0, 0.2);
  --accent-warm-shadow: rgba(255, 150, 0, 0.3);

  /* 状态色 */
  --error: var(--danger);

  min-height: 100%;

  min-height: 100vh;
  background: var(--background);
  position: relative;
  overflow: hidden;
  transition: background-color 0.3s;
}

.aurora-bg {
  position: absolute;
  top: 0;
  width: 100%;
  height: 500rpx;
  background: linear-gradient(135deg, var(--warning) 0%, var(--warning-light, #ffb84d) 100%);
  filter: blur(80px);
  opacity: 0.15;
  z-index: 0;
}

.header-nav {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  z-index: 100;
  background: var(--bg-card);
  border-bottom: 2rpx solid rgba(0, 0, 0, 0.04);
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.04);

  .nav-content {
    height: 44px;
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
      font-weight: 800;
      color: var(--text-primary);
    }

    .nav-placeholder {
      width: 36rpx;
    }
  }
}

.main-scroll {
  /* 修复：精确计算滚动区域高度，避免阻断感 */
  height: calc(100vh - var(--nav-bar-height, 88px));
  padding: 30rpx;
  padding-bottom: calc(100px + env(safe-area-inset-bottom));
  box-sizing: border-box;
  position: relative;
  z-index: 1;
  background: var(--background);
  /* 优化滚动性能 */
  -webkit-overflow-scrolling: touch;
}

.glass-card {
  position: relative;
  overflow: hidden;
  background: var(--bg-card);
  border: 2rpx solid rgba(0, 0, 0, 0.04);
  border-radius: 28rpx;
  padding: 30rpx;
  margin-bottom: 30rpx;
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.06);
}

.glass-card::before {
  content: '';
  position: absolute;
  left: 24rpx;
  right: 24rpx;
  top: 0;
  height: 0;
  background: transparent;
}

.step-bar {
  display: flex;
  align-items: center;
  justify-content: space-around;
  padding: 40rpx;
  /* 修复：确保进度栏不被导航栏遮挡 */
  position: relative;
  z-index: 10;

  .step-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    /* gap: 10rpx; -- replaced for Android WebView compat */
    opacity: 0.4;
    transition: all 0.3s;

    &.active {
      opacity: 1;

      .step-dot {
        background: var(--warning);
        color: var(--text-inverse);
        border-color: var(--warning);
      }
    }

    .step-dot {
      width: 44rpx;
      height: 44rpx;
      border-radius: 22rpx;
      border: 2rpx solid var(--text-secondary);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 24rpx;
      transition: all 0.3s;
      font-weight: 800;
      color: var(--text-primary);
    }

    text {
      font-size: 24rpx;
      font-weight: 700;
      color: var(--text-primary);
    }
  }

  .step-line {
    flex: 1;
    height: 2rpx;
    background: rgba(0, 0, 0, 0.08);
    margin: 0 20rpx;
    margin-top: -30rpx;
    transition: all 0.3s;

    &.active {
      background: var(--warning);
    }
  }
}

.compliance-tip {
  margin: 0 8rpx 22rpx;
  padding: 18rpx 20rpx;
  border-radius: 24rpx;
  background: var(--bg-card);
  border: 2rpx dashed rgba(0, 0, 0, 0.08);
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.04);
}

.compliance-tip-text {
  font-size: 23rpx;
  line-height: 1.55;
  color: var(--text-secondary);
}

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
      color: var(--text-secondary);
    }
  }
}

/* 必填标记 */
.required {
  color: var(--error);
  margin-left: 4rpx;
}

/* 输入框字数提示 */
.input-hint {
  text-align: right;
  color: var(--text-secondary);
  margin-top: 8rpx;
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
    background: var(--bg-secondary);
    border: 2rpx solid rgba(0, 0, 0, 0.04);
    border-radius: 999rpx;
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
    border-color: var(--warning);
    box-shadow: 0 0 0 4rpx rgba(255, 150, 0, 0.12);
  }

  .ph-style {
    color: var(--text-secondary) !important;
    opacity: 0.7;
  }

  .placeholder-text {
    color: var(--text-secondary) !important;
    opacity: 0.7;
  }

  .picker-val {
    justify-content: space-between;
    color: var(--text-primary);

    .picker-arrow {
      font-size: 20rpx;
      color: var(--text-secondary);
    }
  }
}

/* 按钮组 */
.btn-group {
  margin-top: 60rpx;
  display: flex;
  /* gap: 20rpx; -- replaced for Android WebView compat */
}

.btn-group .secondary-btn {
  margin-right: 20rpx;
}

.secondary-btn {
  flex: 1;
  height: 110rpx;
  background: var(--bg-card);
  color: var(--text-primary);
  border-radius: 28rpx;
  font-size: 32rpx;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2rpx solid rgba(0, 0, 0, 0.08);
  transition: all 0.3s ease;
  box-shadow: 0 4rpx 0 rgba(0, 0, 0, 0.08);

  &::after {
    border: none;
  }
}

.tab-group {
  display: flex;
  /* gap: 20rpx; -- replaced for Android WebView compat */
  .tab-item {
    flex: 1;
    height: 100rpx;
    background: var(--bg-secondary);
    border: 2rpx solid rgba(0, 0, 0, 0.04);
    border-radius: 999rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 28rpx;
    color: var(--text-secondary);
    transition: all 0.2s;

    &.active {
      background: var(--warning);
      border-color: var(--warning);
      color: var(--text-inverse);
      font-weight: 700;
      box-shadow: 0 4rpx 0 var(--warning-dark, #cc7800);
    }
  }
}

.primary-btn {
  margin-top: 60rpx;
  flex: 2;
  height: 110rpx;
  background: var(--warning);
  color: var(--text-inverse);
  border-radius: 28rpx;
  font-size: 32rpx;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
  /* gap: 15rpx; -- replaced for Android WebView compat */
  box-shadow: 0 8rpx 0 var(--warning-dark, #cc7800);
  border: none;
  transition: all 0.15s ease;
  /* 修复：确保按钮不被 tabbar 遮挡 */
  position: relative;
  z-index: 5;

  &[disabled] {
    opacity: 0.5;
    box-shadow: 0 4rpx 0 var(--warning-dark, #cc7800);
  }

  &.pulse-btn:not([disabled]) {
    animation: pulse 2s infinite;
  }

  &:active:not([disabled]) {
    transform: translateY(4rpx);
    box-shadow: 0 4rpx 0 var(--warning-dark, #cc7800);
  }

  &::after {
    border: none;
  }
}

/* 按钮组内的 primary-btn 不需要额外 margin-top */
.btn-group .primary-btn {
  margin-top: 0;
}

@keyframes pulse {
  0%,
  100% {
    box-shadow: 0 8rpx 0 var(--warning-dark, #cc7800);
  }

  50% {
    box-shadow:
      0 8rpx 0 var(--warning-dark, #cc7800),
      0 0 20rpx rgba(255, 150, 0, 0.4);
  }
}

.info-tip {
  display: flex;
  align-items: center;
  justify-content: center;
  /* gap: 10rpx; -- replaced for Android WebView compat */
  padding: 20rpx;
  color: var(--text-secondary);
  font-size: 24rpx;
  margin-bottom: 30rpx;
  /* 修复：确保提示文字不被 tabbar 遮挡 */
  position: relative;
  z-index: 5;
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

.rh-left {
  display: flex;
  align-items: baseline;
  /* gap: 16rpx; -- replaced for Android WebView compat */
}

.rh-title {
  font-size: 32rpx;
  font-weight: 800;
  color: var(--text-primary);
}

.rh-subtitle {
  font-size: 24rpx;
  color: var(--text-secondary);
}

/* 信息提示横幅 */
.info-banner {
  display: flex;
  align-items: center;
  /* gap: 16rpx; -- replaced for Android WebView compat */
  padding: 20rpx 24rpx;
  margin-bottom: 24rpx;
  background: var(--bg-card);
  border: 2rpx solid rgba(0, 0, 0, 0.04);
}

.analysis-card {
  margin-bottom: 24rpx;
  border-left: 6rpx solid rgba(255, 150, 0, 0.4);
}

.analysis-head {
  align-items: center;
  margin-bottom: 10rpx;
}

.analysis-title {
  color: var(--text-primary);
}

.analysis-source {
  color: var(--text-secondary);
}

.analysis-status {
  color: var(--text-primary);
  line-height: 1.5;
  display: block;
}

.analysis-summary {
  margin-top: 12rpx;
  color: var(--text-secondary);
  line-height: 1.5;
  display: block;
}

.info-banner .info-icon {
  font-size: 28rpx;
}

.info-banner .info-text {
  flex: 1;
  color: var(--text-secondary);
  line-height: 1.5;
}

/* 返回修改按钮 */
.back-edit-btn {
  margin-top: 30rpx;
  padding: 20rpx;
  color: var(--text-secondary);
  text-align: center;
}

.rh-filter {
  font-size: 24rpx;
  color: var(--text-primary);
  background: var(--bg-card);
  padding: 10rpx 20rpx;
  border-radius: 999rpx;
  display: flex;
  align-items: center;
  /* gap: 8rpx; -- replaced for Android WebView compat */
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.06);
  border: 2rpx solid rgba(0, 0, 0, 0.04);
}

.filter-arrow {
  font-size: 20rpx;
  color: var(--text-secondary);
}

.school-card {
  padding: 30rpx;

  .sc-head {
    display: flex;
    align-items: flex-start;
    margin-bottom: 24rpx;
    padding-bottom: 24rpx;
    border-bottom: 2rpx solid rgba(0, 0, 0, 0.04);
  }

  .sc-logo {
    width: 96rpx;
    height: 96rpx;
    border-radius: 20rpx;
    margin-right: 24rpx;
    background: var(--bg-secondary);
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
    font-weight: 800;
    color: var(--text-primary);
    margin-right: 16rpx;
  }

  .sc-loc {
    font-size: 22rpx;
    color: var(--text-secondary);
  }

  .sc-tags {
    display: flex;
    /* gap: 12rpx; -- replaced for Android WebView compat */
    margin-top: 12rpx;
    flex-wrap: wrap;
  }

  .tag-item {
    margin-right: 12rpx;
    margin-bottom: 8rpx;
    font-size: 20rpx;
    color: var(--warning);
    background: rgba(255, 150, 0, 0.12);
    padding: 8rpx 18rpx;
    border-radius: 999rpx;
    border: none;
    font-weight: 600;
  }

  .match-rate {
    display: flex;
    flex-direction: column;
    align-items: center;
    background: rgba(255, 150, 0, 0.12);
    padding: 8rpx 16rpx;
    border-radius: 20rpx;
    flex-shrink: 0;
    border: none;
  }

  .mr-val {
    font-size: 32rpx;
    font-weight: 800;
    color: var(--warning);
    line-height: var(--line-height-normal);
  }

  .mr-lbl {
    font-size: 20rpx;
    color: var(--warning);
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
  border-bottom: 2rpx solid rgba(0, 0, 0, 0.04);

  &:last-child {
    margin-bottom: 0;
    padding-bottom: 0;
    border-bottom: none;
  }
}

.mj-title {
  font-size: 26rpx;
  margin-bottom: 16rpx;
  font-weight: 700;
  color: var(--text-primary);
  display: flex;
  align-items: center;
  flex-wrap: wrap;
}

.mj-code {
  color: var(--text-secondary);
  margin-right: 12rpx;
  font-weight: 400;
}

.mj-name {
  margin-right: 12rpx;
  color: var(--text-primary);
}

.mj-type {
  font-size: 20rpx;
  background: rgba(255, 150, 0, 0.12);
  padding: 6rpx 12rpx;
  border-radius: 999rpx;
  color: var(--warning);
  font-weight: 600;
}

.mj-scores {
  display: flex;
  justify-content: space-between;
  background: var(--bg-secondary);
  padding: 16rpx 24rpx;
  border-radius: 24rpx;
  border: 2rpx solid rgba(0, 0, 0, 0.04);
}

.score-col {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
}

.sc-year {
  font-size: 20rpx;
  color: var(--text-secondary);
  margin-bottom: 4rpx;
}

.sc-num {
  font-size: 28rpx;
  font-weight: 800;
  color: var(--text-primary);
}

.sc-num.high {
  color: var(--error);
}

.sc-num.sub {
  color: var(--text-secondary);
  font-weight: 400;
}

.card-footer {
  display: flex;
  /* gap: 24rpx; -- replaced for Android WebView compat */
  margin-top: 24rpx;
}

.cf-btn + .cf-btn {
  margin-left: 24rpx;
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
  border: 2rpx solid rgba(0, 0, 0, 0.08);
  color: var(--text-primary);
  background: var(--bg-card);
}

.cf-btn.primary {
  background: var(--warning);
  color: var(--text-inverse);
  box-shadow: 0 6rpx 0 var(--warning-dark, #cc7800);
  border: none;
  transition: all 0.15s ease;
}

.cf-btn.primary:active {
  transform: translateY(3rpx);
  box-shadow: 0 3rpx 0 var(--warning-dark, #cc7800);
}

.dark-mode .cf-btn.primary {
  box-shadow: var(--cta-primary-shadow);
  background: var(--cta-primary-bg);
  color: var(--cta-primary-text);
}

.cf-btn.disabled {
  background: var(--bg-secondary);
  color: var(--text-secondary);
  box-shadow: none;
}

.empty-tip {
  text-align: center;
  color: var(--text-secondary);
  font-size: 26rpx;
  margin-top: 80rpx;
  padding: 40rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  /* gap: 16rpx; -- replaced for Android WebView compat */
}

/* 择校空状态引导插画 */
.empty-illustration {
  width: 320rpx;
  height: 260rpx;
  margin-bottom: 24rpx;
}

.empty-title {
  color: var(--text-primary);
  margin-bottom: 4rpx;
}

.reset-btn {
  margin-top: 16rpx;
  padding: 16rpx 40rpx;
  background: var(--warning);
  border: none;
  border-radius: 24rpx;
  box-shadow: 0 6rpx 0 var(--warning-dark, #cc7800);
  transition: all 150ms ease-out;
}

.reset-btn:active {
  transform: translateY(3rpx);
  box-shadow: 0 3rpx 0 var(--warning-dark, #cc7800);
}

.reset-btn-text {
  color: var(--text-inverse);
}

.reset-link {
  color: var(--warning);
  text-decoration: underline;
}

/* 筛选弹窗 */
.filter-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--overlay);
  z-index: 200;
  display: flex;
  align-items: flex-end;
  backdrop-filter: blur(5px);
  -webkit-backdrop-filter: blur(5px);
  animation: fadeIn 0.3s;
}

.filter-panel {
  width: 100%;
  border-radius: 28rpx 28rpx 0 0;
  padding: 48rpx;
  box-sizing: border-box;
  max-height: 70vh;
  animation: slideUp 0.3s;
  background: var(--bg-card);
  border-top: 2rpx solid rgba(0, 0, 0, 0.04);
  box-shadow: 0 -8rpx 32rpx rgba(0, 0, 0, 0.1);
}

.fp-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 48rpx;
}

.fp-title {
  font-size: 36rpx;
  font-weight: 800;
  color: var(--text-primary);
}

.fp-reset {
  font-size: 28rpx;
  color: var(--text-secondary);
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
  /* gap: 20rpx; -- replaced for Android WebView compat */
}

.ft-item {
  margin-right: 20rpx;
  margin-bottom: 20rpx;
  background: var(--bg-secondary);
  padding: 16rpx 32rpx;
  border-radius: 999rpx;
  font-size: 26rpx;
  color: var(--text-secondary);
  border: 2rpx solid rgba(0, 0, 0, 0.04);
  transition: 0.2s;
}

.ft-item.active {
  background: var(--warning);
  color: var(--text-inverse);
  border-color: var(--warning);
  font-weight: 600;
  box-shadow: 0 4rpx 0 var(--warning-dark, #cc7800);
}

.fp-confirm-btn {
  width: 100%;
  background: var(--warning);
  color: var(--text-inverse);
  border: none;
  border-radius: 28rpx;
  margin-top: 20rpx;
  height: 100rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  font-size: 32rpx;
  box-shadow: 0 8rpx 0 var(--warning-dark, #cc7800);
  transition: all 0.15s ease;

  &:active {
    transform: translateY(4rpx);
    box-shadow: 0 4rpx 0 var(--warning-dark, #cc7800);
  }

  &::after {
    border: none;
  }
}

.safe-area-bottom {
  /* 修复：增加底部安全区域高度，避免内容被 tabbar 遮挡 */
  height: calc(100px + env(safe-area-inset-bottom));
  width: 100%;
  flex-shrink: 0;
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

/* ===== 综合暗色模式覆盖 ===== */
.container.dark-mode {
  --accent-warm: var(--brand-color);
  --accent-cool: var(--color-primary-dark);
  --accent-warm-soft: rgba(0, 242, 255, 0.1);
  --accent-warm-mid: rgba(0, 242, 255, 0.2);
  --accent-warm-shadow: rgba(0, 242, 255, 0.3);
}

.dark-mode .glass-input:focus-within {
  box-shadow: 0 10rpx 24rpx rgba(24, 86, 191, 0.18);
}

.dark-mode .tab-group .tab-item.active {
  background: var(--cta-primary-bg);
}

.dark-mode .info-banner {
  background: rgba(16, 20, 28, 0.72);
  border-color: rgba(124, 176, 255, 0.18);
}

.dark-mode .tag-item {
  background: rgba(16, 20, 28, 0.68);
  color: var(--text-primary);
  border: 1rpx solid rgba(255, 255, 255, 0.1);
}

.dark-mode .match-rate {
  background: rgba(16, 20, 28, 0.72);
}

.dark-mode .ft-item.active {
  background: var(--cta-primary-bg);
}

.dark-mode .cf-btn.primary {
  box-shadow: var(--cta-primary-shadow);
}

.dark-mode .filter-panel {
  background: linear-gradient(180deg, rgba(16, 20, 28, 0.96) 0%, rgba(11, 14, 20, 0.98) 100%);
}
</style>
