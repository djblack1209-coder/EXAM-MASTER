<template>
  <view class="search-input-wrapper">
    <view class="search-box">
      <text class="search-icon">&#x1F50D;</text>
      <input
        class="search-input"
        :value="modelValue"
        :placeholder="placeholder"
        placeholder-class="ph-style"
        maxlength="30"
        @input="onInput"
        @focus="onFocus"
        @blur="onBlur"
      />
      <view v-if="modelValue" class="clear-btn" @tap="clearInput">
        <text class="clear-icon">&times;</text>
      </view>
    </view>

    <!-- 搜索历史（输入为空时显示） -->
    <view v-if="showDropdown && !modelValue && history.length > 0 && !suggestions.length" class="suggestions-dropdown">
      <view class="history-header">
        <text class="history-title">最近搜索</text>
        <text class="history-clear" @tap.stop="clearHistory">清除</text>
      </view>
      <view class="history-tags">
        <text v-for="(kw, i) in history" :key="i" class="history-tag" @tap="tapHistory(kw)">{{ kw }}</text>
      </view>
    </view>

    <!-- Suggestions dropdown -->
    <view v-if="showDropdown && suggestions.length" class="suggestions-dropdown">
      <scroll-view scroll-y class="suggestions-list" :style="{ maxHeight: '400rpx' }">
        <view
          v-for="(school, index) in suggestions"
          :key="school._id || school.code || index"
          class="suggestion-item"
          @tap="selectSchool(school)"
        >
          <text class="school-name">{{ school.name }}</text>
          <text v-if="school.province || school.location" class="school-location">
            {{ school.province || school.location }}
          </text>
          <view v-if="school.tags && school.tags.length" class="school-tags">
            <text v-for="tag in school.tags.slice(0, 3)" :key="tag" class="school-tag">{{ tag }}</text>
          </view>
        </view>
      </scroll-view>
    </view>

    <!-- Loading indicator -->
    <view v-if="isSearching && showDropdown" class="search-loading">
      <text class="loading-text">搜索中...</text>
    </view>
  </view>
</template>

<script setup>
import { toast } from '@/utils/toast.js';
import { logger } from '@/utils/logger.js';
import { ref } from 'vue';
import { useSchoolStore } from '@/stores/modules/school';
import PinyinMatch from 'pinyin-match';
import { useSearchHistory } from '@/composables/useSearchHistory.js';

// 初始化择校 Store
const schoolStore = useSchoolStore();

const props = defineProps({
  modelValue: { type: String, default: '' },
  placeholder: { type: String, default: '搜索学校（支持拼音，如 bjdx）' },
  schoolList: { type: Array, default: () => [] }
});

const emit = defineEmits(['update:modelValue', 'select']);

const showDropdown = ref(false);
const suggestions = ref([]);
const isSearching = ref(false);
let searchTimer = null;

// v3: 搜索历史
const { history, add: addHistory, clear: clearHistory } = useSearchHistory('school', { maxItems: 8 });

function onFocus() {
  showDropdown.value = true;
}

function onInput(e) {
  const value = e.detail.value;
  emit('update:modelValue', value);

  clearTimeout(searchTimer);
  if (!value || value.length < 1) {
    suggestions.value = [];
    return;
  }

  searchTimer = setTimeout(() => {
    searchSchools(value);
  }, 300);
}

async function searchSchools(keyword) {
  isSearching.value = true;

  try {
    // v2: pinyin-match 支持拼音首字母/全拼/多音字搜索
    if (props.schoolList.length > 0) {
      const local = props.schoolList
        .filter(
          (s) =>
            (s.name && (PinyinMatch.match(s.name, keyword) || s.name.includes(keyword))) ||
            (s.province && s.province.includes(keyword)) ||
            (s.location && s.location.includes(keyword))
        )
        .slice(0, 10);

      if (local.length > 0) {
        suggestions.value = local;
        isSearching.value = false;
        return;
      }
    }

    const res = await schoolStore.searchSchools(keyword, 10);

    if (res && res.code === 0) {
      if (res.data && Array.isArray(res.data.list)) {
        suggestions.value = res.data.list;
      } else if (Array.isArray(res.data)) {
        suggestions.value = res.data;
      } else {
        suggestions.value = [];
      }
    } else {
      suggestions.value = [];
    }
  } catch (e) {
    logger.warn('[SchoolSearch] search failed:', e?.message);
    suggestions.value = [];
    // 网络请求失败时给用户提示
    toast.info('搜索失败，请重试');
  } finally {
    isSearching.value = false;
  }
}

function selectSchool(school) {
  emit('update:modelValue', school.name);
  emit('select', school);
  addHistory(school.name); // v3: 记录搜索历史
  showDropdown.value = false;
  suggestions.value = [];
}

function tapHistory(keyword) {
  emit('update:modelValue', keyword);
  searchSchools(keyword);
}

function clearInput() {
  emit('update:modelValue', '');
  suggestions.value = [];
}

function onBlur() {
  setTimeout(() => {
    showDropdown.value = false;
  }, 200);
}
</script>

<style lang="scss" scoped>
.search-input-wrapper {
  position: relative;
  width: 100%;
}

.search-box {
  display: flex;
  align-items: center;
  padding: 0 30rpx;
  background: rgba(255, 255, 255, 0.62);
  border: 1rpx solid rgba(255, 255, 255, 0.5);
  border-radius: 999rpx;
  height: 100rpx;
  box-sizing: border-box;
  transition: all 0.3s;
  box-shadow: inset 0 1rpx 0 rgba(255, 255, 255, 0.72);
}

.search-box:focus-within {
  border-color: var(--apple-glass-border-strong);
  box-shadow: 0 10rpx 24rpx rgba(16, 40, 26, 0.08);
}

.search-icon {
  font-size: 28rpx;
  flex-shrink: 0;
  margin-right: 12rpx;
}

.search-input {
  flex: 1;
  font-size: 28rpx;
  color: var(--text-main);
  background: transparent;
  height: 100%;
}

.ph-style {
  color: var(--text-sub) !important;
  opacity: 0.7;
}

.clear-btn {
  width: 40rpx;
  height: 40rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--muted, rgba(0, 0, 0, 0.1));
  flex-shrink: 0;
  margin-left: 12rpx;
}

.clear-icon {
  font-size: 22rpx;
  color: var(--text-sub);
  line-height: 1;
}

/* ==================== 搜索历史 ==================== */
.history-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16rpx 24rpx 8rpx;
}

.history-title {
  font-size: 24rpx;
  font-weight: 600;
  color: var(--text-secondary, #8b8fa3);
}

.history-clear {
  font-size: 22rpx;
  color: var(--text-secondary, #8b8fa3);
  opacity: 0.7;
}

.history-tags {
  display: flex;
  flex-wrap: wrap;
  /* gap: 12rpx; -- replaced for MP WebView compat */
  padding: 12rpx 24rpx 20rpx;
}

.history-tag {
  font-size: 24rpx;
  color: var(--text-primary, #1a1a2e);
  background: var(--muted, #f3f4f6);
  padding: 8rpx 20rpx;
  border-radius: 999rpx;
  white-space: nowrap;
}

.history-tag:active {
  opacity: 0.7;
  background: var(--primary-light, rgba(15, 95, 52, 0.1));
}

/* ==================== Suggestions ==================== */
.suggestions-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  z-index: 100;
  margin-top: 8rpx;
  background: var(--bg-card, #fff);
  border-radius: 24rpx;
  box-shadow: 0 8rpx 32rpx rgba(0, 0, 0, 0.12);
  border: 1rpx solid var(--border-color, rgba(0, 0, 0, 0.06));
  overflow: hidden;
}

.suggestion-item {
  padding: 20rpx 24rpx;
  border-bottom: 1rpx solid var(--border-color, rgba(0, 0, 0, 0.04));
  display: flex;
  flex-direction: column;
}

.suggestion-item:last-child {
  border-bottom: none;
}

.suggestion-item:active {
  background: rgba(0, 0, 0, 0.04);
}

.school-name {
  font-size: 28rpx;
  font-weight: 600;
  color: var(--text-main, var(--text-primary));
}

.school-location {
  font-size: 22rpx;
  color: var(--text-sub);
  margin-top: 4rpx;
}

.school-tags {
  display: flex;
  margin-top: 6rpx;
}

.school-tag {
  font-size: 20rpx;
  color: var(--accent-warm, #0f5f34);
  background: rgba(15, 95, 52, 0.08);
  padding: 2rpx 12rpx;
  border-radius: 8rpx;
  margin-right: 8rpx;
}

.search-loading {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  z-index: 100;
  margin-top: 8rpx;
  padding: 20rpx;
  text-align: center;
  background: var(--bg-card, #fff);
  border-radius: 16rpx;
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.08);
}

.loading-text {
  font-size: 24rpx;
  color: var(--text-sub);
}
</style>
