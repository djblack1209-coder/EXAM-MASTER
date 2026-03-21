<template>
  <view :class="['container', { 'dark-mode': isDark }]">
    <view class="aurora-bg" />

    <view class="header-nav" :style="{ paddingTop: statusBarHeight + 'px' }">
      <view class="nav-content">
        <text class="nav-back" @tap="goBack"> ← </text>
        <text class="nav-title"> 创建计划 </text>
        <view class="nav-placeholder" />
      </view>
    </view>

    <scroll-view scroll-y class="main-scroll" :style="{ paddingTop: statusBarHeight + 50 + 'px' }">
      <view class="hero-card">
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

<script>
import { storageService } from '@/services/storageService.js';
import { safeNavigateBack } from '@/utils/safe-navigate';
import { debounce } from '@/utils/throttle.js';
import { getStatusBarHeight } from '@/utils/core/system.js';
import BaseIcon from '@/components/base/base-icon/base-icon.vue';

const sanitizeInput = (input, maxLength = 50, allowEmoji = false) => {
  if (!input) return '';
  let result = String(input).replace(/[<>"'&\x00-\x1F\x7F]/g, '');

  if (!allowEmoji) {
    result = result.replace(/[^\u4e00-\u9fa5a-zA-Z0-9\s\-_.,!?，。！？、]/g, '');
  }

  return result.trim().slice(0, maxLength);
};

export default {
  components: {
    BaseIcon
  },
  data() {
    const formatDateInline = (date) => {
      const year = date.getFullYear();
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const day = date.getDate().toString().padStart(2, '0');
      return `${year}-${month}-${day}`;
    };
    return {
      statusBarHeight: 44,
      isDark: false,
      isFormValid: false,
      isSaving: false,
      isPageLoading: true,
      debouncedValidate: null,
      plan: {
        name: '',
        goal: '',
        startDate: formatDateInline(new Date()),
        endDate: formatDateInline(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)),
        dailyDuration: '2小时',
        reminderTime: '08:00',
        category: '综合',
        priority: 'medium',
        progress: 0,
        status: 'not_started',
        tasks: [],
        timestamp: Date.now()
      }
    };
  },
  onLoad() {
    this.statusBarHeight = getStatusBarHeight();

    this.debouncedValidate = debounce(() => {
      this.isFormValid = this.plan.name.trim() !== '' && this.plan.goal.trim() !== '';
    }, 300);

    const savedTheme = storageService.get('theme_mode', 'light');
    this.isDark = savedTheme === 'dark';

    this._themeHandler = (mode) => {
      this.isDark = mode === 'dark';
    };
    uni.$on('themeUpdate', this._themeHandler);

    setTimeout(() => {
      this.isPageLoading = false;
    }, 300);
  },
  onUnload() {
    uni.$off('themeUpdate', this._themeHandler);
  },
  methods: {
    formatDate(date) {
      const year = date.getFullYear();
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const day = date.getDate().toString().padStart(2, '0');
      return `${year}-${month}-${day}`;
    },
    showStartDatePicker() {
      uni.showModal({
        title: '选择开始日期',
        editable: true,
        placeholderText: this.plan.startDate,
        success: (res) => {
          if (res.confirm && res.content) {
            const trimmed = res.content.trim();
            const parsed = new Date(trimmed);
            if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed) && !isNaN(parsed.getTime())) {
              this.plan.startDate = trimmed;
              this.onInputChange();
            } else {
              uni.showToast({ title: '请输入有效日期：YYYY-MM-DD', icon: 'none' });
            }
          }
        }
      });
    },
    showEndDatePicker() {
      uni.showModal({
        title: '选择结束日期',
        editable: true,
        placeholderText: this.plan.endDate,
        success: (res) => {
          if (res.confirm && res.content) {
            const trimmed = res.content.trim();
            const parsed = new Date(trimmed);
            if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed) && !isNaN(parsed.getTime())) {
              if (this.plan.startDate && trimmed <= this.plan.startDate) {
                uni.showToast({ title: '结束日期必须晚于开始日期', icon: 'none' });
                return;
              }
              this.plan.endDate = trimmed;
              this.onInputChange();
            } else {
              uni.showToast({ title: '请输入有效日期：YYYY-MM-DD', icon: 'none' });
            }
          }
        }
      });
    },
    showReminderTimePicker() {
      uni.showModal({
        title: '设置提醒时间',
        editable: true,
        placeholderText: this.plan.reminderTime,
        success: (res) => {
          if (res.confirm && res.content) {
            const timeRegex = /^\d{2}:\d{2}$/;
            if (timeRegex.test(res.content.trim())) {
              this.plan.reminderTime = res.content.trim();
              this.onInputChange();
            } else {
              uni.showToast({ title: '请输入正确格式：HH:MM', icon: 'none' });
            }
          }
        }
      });
    },
    onInputChange() {
      if (this.debouncedValidate) {
        this.debouncedValidate();
      } else {
        this.isFormValid = this.plan.name.trim() !== '' && this.plan.goal.trim() !== '';
      }
    },
    savePlan() {
      if (!this.isFormValid || this.isSaving) {
        if (!this.isSaving) {
          const name = (this.plan.name || '').trim();
          const goal = (this.plan.goal || '').trim();
          if (!name && !goal) {
            uni.showToast({ title: '请填写计划名称和学习目标', icon: 'none' });
          } else if (!name) {
            uni.showToast({ title: '请填写计划名称', icon: 'none' });
          } else if (!goal) {
            uni.showToast({ title: '请填写学习目标', icon: 'none' });
          }
        }
        return;
      }

      this.isSaving = true;
      this.plan.name = sanitizeInput(this.plan.name, 50);
      this.plan.goal = sanitizeInput(this.plan.goal, 500);

      if (!this.plan.name || !this.plan.goal) {
        this.isSaving = false;
        const msg = !this.plan.name ? '计划名称含有不支持的字符，请重新输入' : '学习目标含有不支持的字符，请重新输入';
        uni.showToast({
          title: msg,
          icon: 'none'
        });
        return;
      }

      const plans = storageService.get('study_plans', []);
      this.plan.id = 'plan_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
      this.plan.createdAt = Date.now();
      plans.unshift(this.plan);
      storageService.save('study_plans', plans);

      uni.showToast({
        title: '计划创建成功',
        icon: 'success',
        duration: 1500,
        success: () => {
          safeNavigateBack();
        },
        complete: () => {
          setTimeout(() => {
            this.isSaving = false;
          }, 2000);
        }
      });
    },
    goBack() {
      safeNavigateBack();
    }
  }
};
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
  background:
    linear-gradient(180deg, var(--apple-specular-soft) 0%, transparent 38%),
    linear-gradient(160deg, var(--apple-glass-nav-bg) 0%, var(--apple-glass-card-bg) 100%);
  backdrop-filter: blur(24px) saturate(160%);
  -webkit-backdrop-filter: blur(24px) saturate(160%);
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
  padding: 30rpx 30rpx 112rpx;
  box-sizing: border-box;
  position: relative;
  z-index: 1;
}

.hero-card,
.form-card {
  margin-bottom: 28rpx;
  border-radius: 32rpx;
  background:
    linear-gradient(180deg, var(--apple-specular-soft) 0%, transparent 42%),
    linear-gradient(160deg, var(--apple-glass-card-bg) 0%, var(--apple-group-bg) 100%);
  border: 1px solid var(--apple-glass-border-strong);
  box-shadow: var(--apple-shadow-card);
}

.hero-card {
  padding: 34rpx 32rpx;
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
  font-weight: 700;
  color: var(--text-main);
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
  font-weight: 620;
  color: var(--text-main);
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
}

.pill-btn.active {
  background: var(--cta-primary-bg);
  color: var(--cta-primary-text);
  border-color: var(--cta-primary-border);
  box-shadow: var(--cta-primary-shadow);
  font-weight: 620;
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
  font-weight: 620;
  color: var(--text-sub);
  box-shadow: var(--apple-shadow-surface);
}

.priority-btn.low.active {
  background: rgba(52, 199, 89, 0.16);
  color: var(--success, #34c759);
}

.priority-btn.medium.active {
  background: rgba(255, 204, 0, 0.14);
  color: var(--warning, #ff9f0a);
}

.priority-btn.high.active {
  background: rgba(255, 99, 90, 0.14);
  color: var(--danger, #ff3b30);
}

.action-bar {
  position: sticky;
  bottom: 24rpx;
  padding-top: 8rpx;
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
  background: var(--cta-primary-bg);
  color: var(--cta-primary-text);
  box-shadow: var(--cta-primary-shadow);
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
