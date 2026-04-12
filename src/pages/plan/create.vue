<template>
  <view :class="['container', { 'dark-mode': isDark }]">
    <view class="aurora-bg" />

    <view class="header-nav" :style="{ paddingTop: statusBarHeight + 'px' }">
      <view class="nav-content">
        <view class="nav-back" @tap="goBack"><BaseIcon name="arrow-left" :size="32" /></view>
        <text class="nav-title"> 创建计划 </text>
        <view class="nav-placeholder" />
      </view>
    </view>

    <scroll-view scroll-y class="main-scroll" :style="{ paddingTop: statusBarHeight + 50 + 'px' }">
      <view class="hero-card">
        <!-- 卡通铅笔图标装饰 -->
        <image
          class="feature-cartoon-icon"
          src="./static/icons/pencil-paper.png"
          mode="aspectFit"
          style="margin-bottom: 12rpx"
        />
        <text class="hero-eyebrow"> Plan Setup </text>
        <text class="hero-title"> 给这段备考设定一个稳定的节奏 </text>
        <text class="hero-subtitle"> 名称、目标、提醒和优先级都会影响后续的智能建议。 </text>
      </view>

      <view v-if="isPageLoading" class="form-card skeleton-card">
        <view v-for="i in 7" :key="i" class="skeleton-form-item">
          <view class="skeleton-label skeleton-animate" />
          <view class="skeleton-input skeleton-animate" />
        </view>
        <view class="skeleton-btn skeleton-animate" />
      </view>

      <view v-else class="form-card">
        <view class="form-group">
          <text class="group-eyebrow"> Basics </text>

          <view class="form-item">
            <text class="form-label"> 计划名称 </text>
            <input
              v-model="plan.name"
              class="form-input"
              placeholder="例如：考研数学基础阶段复习"
              maxlength="50"
              @input="onInputChange"
            />
          </view>

          <view class="form-item no-margin">
            <text class="form-label"> 学习目标 </text>
            <textarea
              v-model="plan.goal"
              class="form-textarea"
              placeholder="例如：掌握高等数学第一章知识点，完成100道习题"
              :auto-height="true"
              maxlength="500"
              @input="onInputChange"
            ></textarea>
          </view>
        </view>

        <view class="form-group">
          <text class="group-eyebrow"> Schedule </text>

          <view class="form-item">
            <text class="form-label"> 开始日期 </text>
            <view class="picker-row" @tap="showStartDatePicker">
              <text class="picker-text">
                {{ plan.startDate }}
              </text>
              <BaseIcon name="calendar" :size="28" class="picker-icon" />
            </view>
          </view>

          <view class="form-item">
            <text class="form-label"> 结束日期 </text>
            <view class="picker-row" @tap="showEndDatePicker">
              <text class="picker-text">
                {{ plan.endDate }}
              </text>
              <BaseIcon name="calendar" :size="28" class="picker-icon" />
            </view>
          </view>

          <view class="form-item">
            <text class="form-label"> 每日学习时长 </text>
            <view class="pill-grid">
              <text
                class="pill-btn"
                :class="{ active: plan.dailyDuration === '1小时' }"
                @tap="plan.dailyDuration = '1小时'"
              >
                1小时
              </text>
              <text
                class="pill-btn"
                :class="{ active: plan.dailyDuration === '2小时' }"
                @tap="plan.dailyDuration = '2小时'"
              >
                2小时
              </text>
              <text
                class="pill-btn"
                :class="{ active: plan.dailyDuration === '3小时' }"
                @tap="plan.dailyDuration = '3小时'"
              >
                3小时
              </text>
              <text
                class="pill-btn"
                :class="{ active: plan.dailyDuration === '4小时+' }"
                @tap="plan.dailyDuration = '4小时+'"
              >
                4小时+
              </text>
            </view>
          </view>

          <view class="form-item no-margin">
            <text class="form-label"> 提醒时间 </text>
            <view class="picker-row" @tap="showReminderTimePicker">
              <text class="picker-text">
                {{ plan.reminderTime }}
              </text>
              <BaseIcon name="clock" :size="28" class="picker-icon" />
            </view>
          </view>
        </view>

        <view class="form-group">
          <text class="group-eyebrow"> Focus </text>

          <view class="form-item">
            <text class="form-label"> 计划分类 </text>
            <view class="pill-grid category-grid">
              <text class="pill-btn" :class="{ active: plan.category === '数学' }" @tap="plan.category = '数学'">
                数学
              </text>
              <text class="pill-btn" :class="{ active: plan.category === '英语' }" @tap="plan.category = '英语'">
                英语
              </text>
              <text class="pill-btn" :class="{ active: plan.category === '政治' }" @tap="plan.category = '政治'">
                政治
              </text>
              <text class="pill-btn" :class="{ active: plan.category === '专业课' }" @tap="plan.category = '专业课'">
                专业课
              </text>
              <text class="pill-btn" :class="{ active: plan.category === '综合' }" @tap="plan.category = '综合'">
                综合
              </text>
            </view>
          </view>

          <view class="form-item no-margin">
            <text class="form-label"> 优先级 </text>
            <view class="priority-selector">
              <text class="priority-btn low" :class="{ active: plan.priority === 'low' }" @tap="plan.priority = 'low'">
                低
              </text>
              <text
                class="priority-btn medium"
                :class="{ active: plan.priority === 'medium' }"
                @tap="plan.priority = 'medium'"
              >
                中
              </text>
              <text
                class="priority-btn high"
                :class="{ active: plan.priority === 'high' }"
                @tap="plan.priority = 'high'"
              >
                高
              </text>
            </view>
          </view>
        </view>
      </view>

      <view v-if="!isPageLoading" class="action-bar">
        <button
          class="action-btn primary"
          hover-class="btn-scale-sm"
          :disabled="!isFormValid || isSaving"
          @tap="savePlan"
        >
          {{ isSaving ? '保存中...' : '保存计划' }}
        </button>
      </view>
    </scroll-view>
  </view>
</template>

<script setup>
import { ref, reactive } from 'vue';
import { onLoad, onUnload } from '@dcloudio/uni-app';
import { modal } from '@/utils/modal.js';
import { toast } from '@/utils/toast.js';
import { storageService } from '@/services/storageService.js';
import { safeNavigateBack } from '@/utils/safe-navigate';
import { debounce } from '@/utils/throttle.js';
import { getStatusBarHeight } from '@/utils/core/system.js';
import BaseIcon from '@/components/base/base-icon/base-icon.vue';
import { sanitizeInput } from '@/utils/security/sanitize.js';

// R14: sanitizeInput 已提取为全局工具

// ── 工具函数 ──
/** 格式化日期为 YYYY-MM-DD */
function formatDate(date) {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// ── 响应式状态 ──
const statusBarHeight = ref(44);
const isDark = ref(false);
const isFormValid = ref(false);
const isSaving = ref(false);
const isPageLoading = ref(true);

const plan = reactive({
  name: '',
  goal: '',
  startDate: formatDate(new Date()),
  endDate: formatDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)),
  dailyDuration: '2小时',
  reminderTime: '08:00',
  category: '综合',
  priority: 'medium',
  progress: 0,
  status: 'not_started',
  tasks: [],
  timestamp: Date.now()
});

// ── 非响应式模块级变量 ──
let debouncedValidate = null;
let _themeHandler = null;

// ── 页面生命周期 ──
onLoad(() => {
  statusBarHeight.value = getStatusBarHeight();

  // 防抖校验：名称和目标都填写后才允许保存
  debouncedValidate = debounce(() => {
    isFormValid.value = plan.name.trim() !== '' && plan.goal.trim() !== '';
  }, 300);

  // 主题初始化
  const savedTheme = storageService.get('theme_mode', 'light');
  isDark.value = savedTheme === 'dark';

  _themeHandler = (mode) => {
    isDark.value = mode === 'dark';
  };
  uni.$on('themeUpdate', _themeHandler);

  // 骨架屏延迟隐藏
  setTimeout(() => {
    isPageLoading.value = false;
  }, 300);
});

onUnload(() => {
  uni.$off('themeUpdate', _themeHandler);
});

// ── 方法 ──

/** 输入变更时触发校验 */
function onInputChange() {
  if (debouncedValidate) {
    debouncedValidate();
  } else {
    isFormValid.value = plan.name.trim() !== '' && plan.goal.trim() !== '';
  }
}

/** 显示开始日期选择器 */
function showStartDatePicker() {
  modal.show({
    title: '选择开始日期',
    editable: true,
    placeholderText: plan.startDate,
    success: (res) => {
      if (res.confirm && res.content) {
        const trimmed = res.content.trim();
        const parsed = new Date(trimmed);
        if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed) && !isNaN(parsed.getTime())) {
          plan.startDate = trimmed;
          onInputChange();
        } else {
          toast.info('请输入有效日期：YYYY-MM-DD');
        }
      }
    }
  });
}

/** 显示结束日期选择器 */
function showEndDatePicker() {
  modal.show({
    title: '选择结束日期',
    editable: true,
    placeholderText: plan.endDate,
    success: (res) => {
      if (res.confirm && res.content) {
        const trimmed = res.content.trim();
        const parsed = new Date(trimmed);
        if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed) && !isNaN(parsed.getTime())) {
          if (plan.startDate && trimmed <= plan.startDate) {
            toast.info('结束日期必须晚于开始日期');
            return;
          }
          plan.endDate = trimmed;
          onInputChange();
        } else {
          toast.info('请输入有效日期：YYYY-MM-DD');
        }
      }
    }
  });
}

/** 显示提醒时间选择器 */
function showReminderTimePicker() {
  modal.show({
    title: '设置提醒时间',
    editable: true,
    placeholderText: plan.reminderTime,
    success: (res) => {
      if (res.confirm && res.content) {
        const timeRegex = /^\d{2}:\d{2}$/;
        if (timeRegex.test(res.content.trim())) {
          plan.reminderTime = res.content.trim();
          onInputChange();
        } else {
          toast.info('请输入正确格式：HH:MM');
        }
      }
    }
  });
}

/** 保存计划到本地存储 */
function savePlan() {
  if (!isFormValid.value || isSaving.value) {
    if (!isSaving.value) {
      const name = (plan.name || '').trim();
      const goal = (plan.goal || '').trim();
      if (!name && !goal) {
        toast.info('请填写计划名称和学习目标');
      } else if (!name) {
        toast.info('请填写计划名称');
      } else if (!goal) {
        toast.info('请填写学习目标');
      }
    }
    return;
  }

  isSaving.value = true;
  plan.name = sanitizeInput(plan.name, 50);
  plan.goal = sanitizeInput(plan.goal, 500);

  if (!plan.name || !plan.goal) {
    isSaving.value = false;
    const msg = !plan.name ? '计划名称含有不支持的字符，请重新输入' : '学习目标含有不支持的字符，请重新输入';
    toast.info(msg);
    return;
  }

  const plans = storageService.get('study_plans', []);
  plan.id = 'plan_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
  plan.createdAt = Date.now();
  plans.unshift(plan);
  storageService.save('study_plans', plans);

  toast.success('计划创建成功');
}

/** 返回上一页 */
function goBack() {
  safeNavigateBack();
}
</script>

<style lang="scss" scoped>
.container {
  min-height: 100%;
  min-height: 100vh;
  background: linear-gradient(
    180deg,
    var(--page-gradient-top) 0%,
    var(--page-gradient-mid) 54%,
    var(--page-gradient-bottom) 100%
  );
  position: relative;
  overflow: hidden;
}

.aurora-bg {
  position: absolute;
  top: -120rpx;
  left: -80rpx;
  width: 100%;
  height: 620rpx;
  background:
    radial-gradient(circle at 18% 24%, rgba(107, 208, 150, 0.34) 0%, transparent 40%),
    radial-gradient(circle at 80% 12%, rgba(255, 255, 255, 0.4) 0%, transparent 28%);
  filter: blur(70px);
  opacity: 0.95;
  z-index: 0;
}

.header-nav {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  z-index: 100;
  background-color: var(--em3d-card-bg);
  border-bottom: 1px solid var(--apple-glass-border-strong);
  box-shadow: var(--apple-shadow-surface);
}

.nav-content {
  height: 50px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 30rpx;
}

.nav-back,
.nav-placeholder {
  width: 72rpx;
  height: 72rpx;
}

.nav-back {
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.62);
  border: 1px solid rgba(255, 255, 255, 0.46);
  box-shadow: var(--apple-shadow-surface);
  font-size: 36rpx;
  color: var(--text-main);
  font-weight: 700;
}

.nav-title {
  font-size: 32rpx;
  font-weight: 620;
  color: var(--text-main);
}

.main-scroll {
  height: 100%;
  height: 100vh;
  padding: 30rpx 30rpx 200rpx;
  box-sizing: border-box;
  position: relative;
  z-index: 1;
}

.hero-card,
.form-card {
  margin-bottom: 28rpx;
  border-radius: 32rpx;
  background-color: var(--em3d-card-bg);
  border: 1px solid var(--apple-glass-border-strong);
  box-shadow: var(--apple-shadow-card);
}

.hero-card {
  padding: 34rpx 32rpx;
}
/* 卡通图标通用样式 */
.feature-cartoon-icon {
  width: 80rpx;
  height: 80rpx;
}

.hero-eyebrow,
.group-eyebrow {
  display: block;
  margin-bottom: 10rpx;
  font-size: 22rpx;
  letter-spacing: 3rpx;
  text-transform: uppercase;
  color: var(--text-secondary);
}

.hero-title {
  display: block;
  font-size: 42rpx;
  line-height: 1.24;
  font-weight: 800;
  color: var(--text-primary);
}

.hero-subtitle {
  display: block;
  margin-top: 16rpx;
  font-size: 26rpx;
  line-height: 1.6;
  color: var(--text-sub);
}

.form-card {
  padding: 18rpx;
}

.form-group {
  padding: 26rpx;
  border-radius: 26rpx;
  background: rgba(255, 255, 255, 0.48);
  border: 1px solid rgba(255, 255, 255, 0.42);
  margin-bottom: 18rpx;
}

.form-group:last-child {
  margin-bottom: 0;
}

.form-item {
  margin-bottom: 32rpx;
}

.form-item.no-margin {
  margin-bottom: 0;
}

.form-label {
  display: block;
  margin-bottom: 14rpx;
  font-size: 27rpx;
  font-weight: 700;
  color: var(--text-primary);
}

.form-input,
.form-textarea,
.picker-row,
.pill-btn,
.priority-btn {
  background: rgba(255, 255, 255, 0.66);
  border: 1px solid rgba(255, 255, 255, 0.44);
}

.form-input,
.form-textarea {
  width: 100%;
  padding: 24rpx;
  border-radius: 20rpx;
  box-sizing: border-box;
  font-size: 28rpx;
  color: var(--text-main);
  box-shadow: var(--apple-shadow-surface);
}

.form-input:focus,
.form-textarea:focus {
  border-color: rgba(255, 255, 255, 0.7);
}

.picker-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24rpx;
  border-radius: 20rpx;
  box-shadow: var(--apple-shadow-surface);
}

.picker-text {
  font-size: 28rpx;
  color: var(--text-main);
  font-weight: 500;
}

.picker-icon {
  color: var(--text-sub);
}

.pill-grid {
  display: flex;
  flex-wrap: wrap;
  /* gap: 14rpx; -- replaced for Android WebView compat */
}

.category-grid .pill-btn {
  min-width: 142rpx;
}

.pill-btn {
  padding: 16rpx 26rpx;
  border-radius: 999rpx;
  font-size: 25rpx;
  color: var(--text-sub);
  text-align: center;
  box-shadow: var(--apple-shadow-surface);
  /* R-UI: gap 替代方案，兼容 Android WebView */
  margin-right: 14rpx;
  margin-bottom: 14rpx;
}

.pill-btn.active {
  background: #58cc02;
  color: var(--text-inverse);
  border-color: transparent;
  box-shadow: 0 6rpx 0 #46a302;
  font-weight: 800;
}

.pill-btn.active:active {
  transform: translateY(3rpx);
  box-shadow: 0 3rpx 0 #46a302;
}

.priority-selector {
  display: flex;
  /* gap: 14rpx; -- replaced for Android WebView compat */
}

.priority-btn {
  flex: 1;
  padding: 20rpx;
  border-radius: 22rpx;
  text-align: center;
  font-size: 28rpx;
  font-weight: 700;
  color: var(--text-sub);
  box-shadow: var(--apple-shadow-surface);
  /* R-UI: gap 替代方案，兼容 Android WebView */
  margin-right: 14rpx;
}

.priority-btn:last-child {
  margin-right: 0;
}

.priority-btn.low.active {
  background: color-mix(in srgb, var(--success) 16%, transparent);
  color: var(--success, #34c759);
}

.priority-btn.medium.active {
  background: rgba(255, 204, 0, 0.14);
  color: var(--warning, #ff9f0a);
}

.priority-btn.high.active {
  background: rgba(255, 99, 90, 0.14);
  color: var(--danger, var(--danger));
}

.action-bar {
  position: sticky;
  bottom: 24rpx;
  padding-top: 8rpx;
  /* R411: 防止按钮遮盖上方最后一个表单项 */
  margin-top: 40rpx;
}

.action-btn {
  width: 100%;
  padding: 24rpx;
  border-radius: 999rpx;
  font-size: 32rpx;
  font-weight: 650;
  border: none;
}

.action-btn.primary {
  background: #58cc02;
  color: var(--text-inverse);
  box-shadow: 0 8rpx 0 #46a302;
}

.action-btn.primary:active {
  transform: translateY(4rpx);
  box-shadow: 0 4rpx 0 #46a302;
}

.action-btn[disabled] {
  opacity: 0.5;
}

.action-btn::after {
  border: none;
}

.nav-back:active,
.pill-btn:active,
.priority-btn:active,
.picker-row:active,
.action-btn:active {
  transform: scale(0.98);
}

.skeleton-card {
  padding: 32rpx;
}

.skeleton-form-item {
  margin-bottom: 40rpx;
}

.skeleton-label {
  width: 120rpx;
  height: 28rpx;
  border-radius: 6rpx;
  margin-bottom: 16rpx;
}

.skeleton-input {
  width: 100%;
  height: 80rpx;
  border-radius: 20rpx;
}

.skeleton-btn {
  width: 100%;
  height: 92rpx;
  border-radius: 999rpx;
  margin-top: 60rpx;
}

.skeleton-animate {
  background: linear-gradient(90deg, var(--muted) 25%, var(--bg-card) 50%, var(--muted) 75%);
  background-size: 200% 100%;
  animation: skeleton-loading 1.5s infinite;
}

.container.dark-mode .aurora-bg {
  background:
    radial-gradient(circle at 18% 24%, rgba(10, 132, 255, 0.18) 0%, transparent 42%),
    radial-gradient(circle at 80% 12%, rgba(95, 170, 255, 0.14) 0%, transparent 30%) !important;
  opacity: 0.9;
  filter: blur(110px);
}

.container.dark-mode .hero-card,
.container.dark-mode .form-card {
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.08) 0%, transparent 42%),
    linear-gradient(160deg, rgba(18, 20, 28, 0.92) 0%, rgba(10, 12, 18, 0.88) 100%);
}

.container.dark-mode .nav-back,
.container.dark-mode .form-group,
.container.dark-mode .form-input,
.container.dark-mode .form-textarea,
.container.dark-mode .picker-row,
.container.dark-mode .pill-btn,
.container.dark-mode .priority-btn {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.1);
}

.container.dark-mode .pill-btn.active {
  background: var(--cta-primary-bg);
  border-color: var(--cta-primary-border);
}

@keyframes skeleton-loading {
  0% {
    background-position: 200% 0;
  }

  100% {
    background-position: -200% 0;
  }
}
</style>
