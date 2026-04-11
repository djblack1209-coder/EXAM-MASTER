<template>
  <view :class="['container', { 'dark-mode': isDark }]">
    <view class="aurora-bg" />

    <!-- 导航栏 -->
    <view class="header-nav apple-glass" :style="{ paddingTop: statusBarHeight + 'px' }">
      <view class="nav-content">
        <view class="nav-back" @tap="handleBack"><BaseIcon name="arrow-left" :size="32" /></view>
        <text class="nav-title">{{ isDetailMode ? '小组详情' : '学习小组' }}</text>
        <view class="nav-placeholder" />
      </view>
    </view>

    <!-- 加载骨架屏 -->
    <view v-if="isLoading" class="loading-state" :style="{ paddingTop: statusBarHeight + 60 + 'px' }">
      <view class="skeleton-list">
        <view v-for="i in 4" :key="i" class="skeleton-card apple-glass-card">
          <view class="skeleton-line skeleton-title" />
          <view class="skeleton-line skeleton-desc" />
          <view class="skeleton-line skeleton-short" />
        </view>
      </view>
    </view>

    <!-- ========== 列表模式 ========== -->
    <scroll-view
      v-if="!isLoading && !isDetailMode"
      scroll-y
      class="main-scroll"
      :style="{ paddingTop: statusBarHeight + 50 + 'px' }"
      refresher-enabled
      :refresher-triggered="isRefreshing"
      @refresherrefresh="onPullRefresh"
      @scrolltolower="loadMore"
    >
      <!-- 标签切换 -->
      <view class="tab-bar">
        <view :class="['tab-item', { active: activeTab === 'my' }]" @tap="switchTab('my')">
          <text class="tab-text">我的小组</text>
          <view v-if="activeTab === 'my'" class="tab-indicator" />
        </view>
        <view :class="['tab-item', { active: activeTab === 'discover' }]" @tap="switchTab('discover')">
          <text class="tab-text">发现小组</text>
          <view v-if="activeTab === 'discover'" class="tab-indicator" />
        </view>
      </view>

      <!-- 我的小组列表 -->
      <view v-if="activeTab === 'my'" class="group-list">
        <!-- 空状态 -->
        <view v-if="myGroups.length === 0" class="empty-box">
          <BaseIcon name="users" :size="80" class="empty-icon" />
          <text class="empty-title">暂未加入任何小组</text>
          <text class="empty-text">去「发现小组」看看，或者创建一个属于你的学习小组吧</text>
          <view class="empty-actions">
            <button class="action-btn apple-glass-pill" @tap="switchTab('discover')">发现小组</button>
            <button class="action-btn primary apple-cta" @tap="showCreateModal = true">创建小组</button>
          </view>
        </view>

        <!-- 小组卡片 -->
        <view
          v-for="group in myGroups"
          :key="group._id"
          class="group-card apple-group-card"
          @tap="enterGroupDetail(group)"
        >
          <view class="card-top">
            <view class="group-avatar">
              <text class="avatar-text">{{ (group.name || '组').substring(0, 1) }}</text>
            </view>
            <view class="group-info">
              <text class="group-name">{{ group.name }}</text>
              <text class="group-meta">{{ group.member_count || 0 }} 名成员</text>
            </view>
            <BaseIcon name="chevron-right" :size="28" class="card-arrow" />
          </view>
          <text v-if="group.description" class="group-desc">{{ group.description }}</text>
          <view v-if="group.tags && group.tags.length > 0" class="tag-row">
            <text v-for="(tag, tIdx) in group.tags.slice(0, 3)" :key="tIdx" class="tag-pill">{{ tag }}</text>
          </view>
        </view>
      </view>

      <!-- 发现小组列表 -->
      <view v-if="activeTab === 'discover'" class="group-list">
        <!-- 空状态 -->
        <view v-if="allGroups.length === 0" class="empty-box">
          <BaseIcon name="search" :size="80" class="empty-icon" />
          <text class="empty-title">暂无可加入的小组</text>
          <text class="empty-text">当前还没有公开的学习小组，不如创建一个吧</text>
        </view>

        <!-- 发现卡片 -->
        <view v-for="group in allGroups" :key="group._id" class="group-card apple-group-card">
          <view class="card-top">
            <view class="group-avatar discover-avatar">
              <text class="avatar-text">{{ (group.name || '组').substring(0, 1) }}</text>
            </view>
            <view class="group-info">
              <text class="group-name">{{ group.name }}</text>
              <text class="group-meta">{{ group.member_count || 0 }} 名成员</text>
            </view>
            <button
              class="join-btn apple-cta"
              :class="{ joined: isJoined(group._id) }"
              :disabled="isJoined(group._id)"
              @tap.stop="handleJoinGroup(group)"
            >
              {{ isJoined(group._id) ? '已加入' : '加入' }}
            </button>
          </view>
          <text v-if="group.description" class="group-desc">{{ group.description }}</text>
          <view v-if="group.tags && group.tags.length > 0" class="tag-row">
            <text v-for="(tag, tIdx) in group.tags.slice(0, 3)" :key="tIdx" class="tag-pill">{{ tag }}</text>
          </view>
        </view>
      </view>

      <view class="safe-area" />
    </scroll-view>

    <!-- ========== 详情模式 ========== -->
    <scroll-view
      v-if="!isLoading && isDetailMode"
      scroll-y
      class="main-scroll"
      :style="{ paddingTop: statusBarHeight + 50 + 'px' }"
      refresher-enabled
      :refresher-triggered="isRefreshing"
      @refresherrefresh="onDetailRefresh"
    >
      <!-- 小组信息头部 -->
      <view v-if="currentGroup" class="detail-header apple-glass-card">
        <view class="detail-top">
          <view class="detail-avatar">
            <text class="detail-avatar-text">{{ (currentGroup.name || '组').substring(0, 1) }}</text>
          </view>
          <view class="detail-info">
            <text class="detail-name">{{ currentGroup.name }}</text>
            <text class="detail-meta"
              >
{{ currentGroup.member_count || 0 }} 名成员 · 创建于 {{ formatDate(currentGroup.created_at) }}
</text
            >
          </view>
        </view>
        <text v-if="currentGroup.description" class="detail-desc">{{ currentGroup.description }}</text>
        <view v-if="currentGroup.tags && currentGroup.tags.length > 0" class="tag-row">
          <text v-for="(tag, tIdx) in currentGroup.tags" :key="tIdx" class="tag-pill">{{ tag }}</text>
        </view>
      </view>

      <!-- 成员列表 -->
      <view class="section-block">
        <view class="section-header">
          <text class="section-title">小组成员</text>
          <text class="section-count">{{ currentGroup?.members?.length || 0 }} 人</text>
        </view>
        <view v-if="currentGroup?.members && currentGroup.members.length > 0" class="member-list">
          <view
            v-for="member in currentGroup.members.slice(0, 10)"
            :key="member._id || member.user_id"
            class="member-item apple-glass-card"
          >
            <view class="member-avatar">
              <text class="member-avatar-text">{{ (member.nickname || member.username || '用').substring(0, 1) }}</text>
            </view>
            <view class="member-info">
              <text class="member-name">{{ member.nickname || member.username || '匿名用户' }}</text>
              <text v-if="member.role === 'owner'" class="member-role">创建者</text>
              <text v-else-if="member.role === 'admin'" class="member-role">管理员</text>
            </view>
          </view>
        </view>
        <view v-else class="empty-inline">
          <text class="empty-inline-text">暂无成员信息</text>
        </view>
      </view>

      <!-- 共享资源 -->
      <view class="section-block">
        <view class="section-header">
          <text class="section-title">共享资源</text>
          <text class="section-count">{{ groupResources.length }} 项</text>
        </view>
        <view v-if="groupResources.length > 0" class="resource-list">
          <view v-for="res in groupResources" :key="res._id" class="resource-item apple-glass-card">
            <BaseIcon name="file-text" :size="36" class="resource-icon" />
            <view class="resource-info">
              <text class="resource-name">{{ res.title || '未命名资源' }}</text>
              <text class="resource-meta">{{ res.sharer_name || '匿名' }} · {{ formatDate(res.created_at) }}</text>
            </view>
          </view>
        </view>
        <view v-else class="empty-inline">
          <text class="empty-inline-text">暂无共享资源</text>
        </view>
      </view>

      <!-- 离开小组按钮 -->
      <view class="leave-section">
        <button class="leave-btn" @tap="handleLeaveGroup">退出小组</button>
      </view>

      <view class="safe-area" />
    </scroll-view>

    <!-- 浮动创建按钮（列表模式） -->
    <view v-if="!isLoading && !isDetailMode" class="fab-btn apple-cta" @tap="showCreateModal = true">
      <BaseIcon name="plus" :size="36" />
    </view>

    <!-- 创建小组弹窗 -->
    <view v-if="showCreateModal" class="modal-overlay" @tap="showCreateModal = false">
      <view class="modal-content apple-glass-card" @tap.stop>
        <view class="modal-header">
          <text class="modal-title">创建学习小组</text>
          <view class="modal-close" @tap="showCreateModal = false"><BaseIcon name="close" :size="24" /></view>
        </view>
        <view class="modal-body">
          <view class="form-group">
            <text class="form-label">小组名称 <text class="required">*</text></text>
            <input
              v-model="createForm.name"
              class="modal-input"
              placeholder="请输入小组名称（2-20字）"
              maxlength="20"
            />
          </view>
          <view class="form-group">
            <text class="form-label">小组简介</text>
            <textarea
              v-model="createForm.description"
              class="modal-textarea"
              placeholder="介绍一下你的学习小组吧..."
              maxlength="200"
            ></textarea>
            <text class="char-count">{{ (createForm.description || '').length }}/200</text>
          </view>
          <view class="form-group">
            <text class="form-label">标签（用空格分隔）</text>
            <input
              v-model="createForm.tagsInput"
              class="modal-input"
              placeholder="例如：考研 数学 每日打卡"
              maxlength="50"
            />
          </view>
        </view>
        <view class="modal-footer">
          <button class="modal-btn secondary" @tap="showCreateModal = false">取消</button>
          <button class="modal-btn primary" :disabled="!createForm.name.trim()" @tap="handleCreateGroup">创建</button>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue';
import { onLoad, onShow, onUnload } from '@dcloudio/uni-app';
import { toast } from '@/utils/toast.js';
import { storageService } from '@/services/storageService.js';
import { safeNavigateBack } from '@/utils/safe-navigate';
import { useGroupStore } from '@/stores/modules/group.js';
import { logger } from '@/utils/logger.js';
import { getStatusBarHeight } from '@/utils/core/system.js';
import BaseIcon from '@/components/base/base-icon/base-icon.vue';

// ── Store ──
const groupStore = useGroupStore();

// ── 响应式状态 ──
const statusBarHeight = ref(44);
const isDark = ref(false);
const isLoading = ref(true);
const isRefreshing = ref(false);
const activeTab = ref('my');
const isDetailMode = ref(false);
const showCreateModal = ref(false);

// 小组数据（直接引用 Store）
const myGroups = computed(() => groupStore.myGroups);
const allGroups = computed(() => groupStore.allGroups);
const currentGroup = computed(() => groupStore.currentGroup);
const groupResources = computed(() => groupStore.groupResources);

// 当前详情 ID
const currentGroupId = ref('');

// 创建表单
const createForm = ref({
  name: '',
  description: '',
  tagsInput: ''
});

// 主题切换回调引用
let _themeHandler = null;

// ── 方法 ──

/** 初始化系统信息 */
function initSystemUI() {
  statusBarHeight.value = getStatusBarHeight();
}

/** 切换标签页 */
function switchTab(tab) {
  activeTab.value = tab;
  if (tab === 'discover' && allGroups.value.length === 0) {
    loadDiscoverGroups();
  }
}

/** 加载我的小组 */
async function loadMyGroups() {
  try {
    await groupStore.fetchMyGroups(1);
    logger.log('[group] 我的小组加载完成:', myGroups.value.length);
  } catch (e) {
    logger.warn('[group] 加载我的小组失败:', e);
  }
}

/** 加载发现小组 */
async function loadDiscoverGroups() {
  try {
    await groupStore.fetchAllGroups(1);
    logger.log('[group] 发现小组加载完成:', allGroups.value.length);
  } catch (e) {
    logger.warn('[group] 加载发现小组失败:', e);
  }
}

/** 初始化数据 */
async function loadData() {
  isLoading.value = true;
  try {
    await loadMyGroups();
  } catch (e) {
    logger.warn('[group] 初始化数据失败:', e);
    toast.info('加载失败，请下拉刷新重试');
  } finally {
    isLoading.value = false;
  }
}

/** 加载详情数据 */
async function loadDetailData(groupId) {
  isLoading.value = true;
  try {
    await Promise.all([groupStore.fetchGroupDetail(groupId), groupStore.fetchGroupResources(groupId, 1)]);
    logger.log('[group] 小组详情加载完成:', currentGroup.value?.name);
  } catch (e) {
    logger.warn('[group] 加载详情失败:', e);
    toast.info('加载详情失败');
  } finally {
    isLoading.value = false;
  }
}

/** 下拉刷新 */
async function onPullRefresh() {
  isRefreshing.value = true;
  try {
    if (activeTab.value === 'my') {
      await loadMyGroups();
    } else {
      await loadDiscoverGroups();
    }
  } catch (_e) {
    /* 静默处理 */
  }
  isRefreshing.value = false;
}

/** 详情页下拉刷新 */
async function onDetailRefresh() {
  isRefreshing.value = true;
  try {
    if (currentGroupId.value) {
      await loadDetailData(currentGroupId.value);
    }
  } catch (_e) {
    /* 静默处理 */
  }
  isRefreshing.value = false;
}

/** 滚动到底部加载更多 */
async function loadMore() {
  if (groupStore.loading) return;
  if (activeTab.value === 'discover') {
    const currentPage = Math.ceil(allGroups.value.length / 20) + 1;
    await groupStore.fetchAllGroups(currentPage);
  }
}

/** 判断是否已加入某小组 */
function isJoined(groupId) {
  return myGroups.value.some((g) => g._id === groupId);
}

/** 进入小组详情 */
function enterGroupDetail(group) {
  currentGroupId.value = group._id;
  isDetailMode.value = true;
  loadDetailData(group._id);
}

/** 加入小组 */
async function handleJoinGroup(group) {
  if (isJoined(group._id)) return;
  const result = await groupStore.joinExistingGroup(group._id);
  if (result.success) {
    toast.success(result.message || '加入成功');
  } else {
    toast.info(result.message || '加入失败');
  }
}

/** 创建小组 */
async function handleCreateGroup() {
  const name = createForm.value.name.trim();
  if (!name || name.length < 2) {
    toast.info('小组名称至少2个字');
    return;
  }
  const tags = createForm.value.tagsInput ? createForm.value.tagsInput.trim().split(/\s+/).filter(Boolean) : [];

  const result = await groupStore.createNewGroup({
    name,
    description: createForm.value.description.trim(),
    tags
  });

  if (result.success) {
    toast.success(result.message || '创建成功');
    showCreateModal.value = false;
    createForm.value = { name: '', description: '', tagsInput: '' };
  } else {
    toast.info(result.message || '创建失败');
  }
}

/** 离开小组 */
function handleLeaveGroup() {
  if (!currentGroupId.value) return;
  uni.showModal({
    title: '确认退出',
    content: '退出后将无法查看该小组的资源和消息，确定要退出吗？',
    success: async (res) => {
      if (res.confirm) {
        const result = await groupStore.leaveCurrentGroup(currentGroupId.value);
        if (result.success) {
          toast.success(result.message || '已退出小组');
          isDetailMode.value = false;
          currentGroupId.value = '';
        } else {
          toast.info(result.message || '退出失败');
        }
      }
    }
  });
}

/** 返回处理 */
function handleBack() {
  if (isDetailMode.value) {
    isDetailMode.value = false;
    currentGroupId.value = '';
  } else {
    safeNavigateBack();
  }
}

/** 格式化日期 */
function formatDate(timestamp) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const m = date.getMonth() + 1;
  const d = date.getDate();
  return `${m}月${d}日`;
}

// ── 生命周期 ──

onLoad((options) => {
  initSystemUI();

  // 主题初始化
  const savedTheme = storageService.get('theme_mode', 'light');
  isDark.value = savedTheme === 'dark';
  _themeHandler = (mode) => {
    isDark.value = mode === 'dark';
  };
  uni.$on('themeUpdate', _themeHandler);

  // 检查是否为详情模式
  if (options?.mode === 'detail') {
    const tempGroupId = storageService.get('temp_group_id');
    if (tempGroupId) {
      isDetailMode.value = true;
      currentGroupId.value = tempGroupId;
      loadDetailData(tempGroupId);
      return;
    }
  }

  loadData();
});

onShow(() => {
  // 如果不在详情模式，刷新列表
  if (!isDetailMode.value) {
    loadMyGroups();
  }
});

onUnload(() => {
  uni.$off('themeUpdate', _themeHandler);
});
</script>

<style lang="scss" scoped>
.container {
  min-height: 100vh;
  background: var(--bg-secondary, #f5f5f7);
}

.aurora-bg {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 400rpx;
  background: var(--gradient-aurora);
  filter: blur(60px);
  z-index: 0;
}

/* 导航栏 */
.header-nav {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
  background:
    linear-gradient(180deg, var(--apple-specular-soft) 0%, transparent 42%),
    linear-gradient(160deg, var(--apple-glass-nav-bg) 0%, var(--apple-glass-card-bg) 100%);
  backdrop-filter: blur(24px) saturate(160%);
  -webkit-backdrop-filter: blur(24px) saturate(160%);
  border-bottom: 1rpx solid var(--apple-glass-border-strong);
  box-shadow: var(--apple-shadow-surface);
}

.nav-content {
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20rpx;
}

.nav-back {
  font-size: 40rpx;
  color: var(--text-primary);
  padding: 10rpx 20rpx;
}

.nav-title {
  font-size: 36rpx;
  font-weight: 600;
  color: var(--text-primary);
}

.nav-placeholder {
  width: 72rpx;
}

/* 主滚动区域 */
.main-scroll {
  height: 100vh;
  padding: 0 20rpx;
  box-sizing: border-box;
}

/* 标签切换栏 */
.tab-bar {
  display: flex;
  justify-content: center;
  margin-bottom: 24rpx;
}

.tab-item {
  position: relative;
  padding: 16rpx 40rpx;
  margin-right: 32rpx;
}

.tab-item:last-child {
  margin-right: 0;
}

.tab-text {
  font-size: 30rpx;
  color: var(--text-sub);
  font-weight: 500;
}

.tab-item.active .tab-text {
  color: var(--primary);
  font-weight: 700;
}

.tab-indicator {
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 40rpx;
  height: 6rpx;
  border-radius: 3rpx;
  background: var(--primary);
}

/* 小组卡片 */
.group-list {
  padding-bottom: 20rpx;
}

.group-card {
  position: relative;
  overflow: hidden;
  background: linear-gradient(180deg, var(--apple-group-bg) 0%, var(--apple-glass-card-bg) 100%);
  border: 1px solid var(--apple-glass-border-strong);
  border-radius: 28rpx;
  padding: 24rpx;
  margin-bottom: 20rpx;
  box-shadow: var(--apple-shadow-card);
}

.group-card::before {
  content: '';
  position: absolute;
  left: 24rpx;
  right: 24rpx;
  top: 0;
  height: 1rpx;
  background: var(--apple-specular-soft);
}

.card-top {
  display: flex;
  align-items: center;
  margin-bottom: 12rpx;
}

.group-avatar {
  width: 80rpx;
  height: 80rpx;
  border-radius: 20rpx;
  background: linear-gradient(135deg, var(--primary), #7c3aed);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-right: 20rpx;
}

.discover-avatar {
  background: linear-gradient(135deg, #f59e0b, #ef4444);
}

.avatar-text {
  font-size: 36rpx;
  font-weight: 700;
  color: #ffffff;
}

.group-info {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.group-name {
  font-size: 30rpx;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 4rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.group-meta {
  font-size: 24rpx;
  color: var(--text-sub);
}

.card-arrow {
  color: var(--text-sub);
  flex-shrink: 0;
}

.group-desc {
  font-size: 26rpx;
  color: var(--text-sub);
  line-height: 1.5;
  margin-bottom: 12rpx;
  display: block;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.tag-row {
  display: flex;
  flex-wrap: wrap;
}

.tag-pill {
  font-size: 20rpx;
  color: var(--primary);
  background: rgba(79, 70, 229, 0.08);
  padding: 6rpx 16rpx;
  border-radius: 999rpx;
  border: 1rpx solid rgba(79, 70, 229, 0.15);
  margin-right: 12rpx;
  margin-bottom: 8rpx;
}

/* 加入按钮 */
.join-btn {
  flex-shrink: 0;
  font-size: 24rpx;
  padding: 10rpx 24rpx;
  border-radius: 999rpx;
  background: var(--cta-primary-bg);
  color: var(--cta-primary-text);
  border: 1rpx solid var(--cta-primary-border);
  box-shadow: var(--cta-primary-shadow);
  line-height: 1.4;
}

.join-btn::after {
  border: none;
}

.join-btn.joined {
  background: rgba(255, 255, 255, 0.68);
  color: var(--text-sub);
  border-color: rgba(255, 255, 255, 0.5);
  box-shadow: none;
}

/* ========== 详情模式 ========== */
.detail-header {
  position: relative;
  overflow: hidden;
  background: linear-gradient(160deg, var(--apple-glass-card-bg) 0%, var(--apple-group-bg) 100%);
  border: 1px solid var(--apple-glass-border-strong);
  border-radius: 28rpx;
  padding: 28rpx;
  margin-bottom: 24rpx;
  box-shadow: var(--apple-shadow-card);
}

.detail-header::before {
  content: '';
  position: absolute;
  left: 24rpx;
  right: 24rpx;
  top: 0;
  height: 1rpx;
  background: var(--apple-specular-soft);
}

.detail-top {
  display: flex;
  align-items: center;
  margin-bottom: 16rpx;
}

.detail-avatar {
  width: 100rpx;
  height: 100rpx;
  border-radius: 24rpx;
  background: linear-gradient(135deg, var(--primary), #7c3aed);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-right: 24rpx;
}

.detail-avatar-text {
  font-size: 44rpx;
  font-weight: 700;
  color: #ffffff;
}

.detail-info {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.detail-name {
  font-size: 36rpx;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 8rpx;
}

.detail-meta {
  font-size: 24rpx;
  color: var(--text-sub);
}

.detail-desc {
  font-size: 28rpx;
  color: var(--text-sub);
  line-height: 1.6;
  margin-bottom: 16rpx;
  display: block;
}

/* 区块 */
.section-block {
  margin-bottom: 24rpx;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16rpx;
}

.section-title {
  font-size: 30rpx;
  font-weight: 600;
  color: var(--text-primary);
}

.section-count {
  font-size: 24rpx;
  color: var(--text-sub);
}

/* 成员列表 */
.member-list {
  display: flex;
  flex-wrap: wrap;
}

.member-item {
  display: flex;
  align-items: center;
  width: calc(50% - 10rpx);
  margin-right: 20rpx;
  margin-bottom: 16rpx;
  background: linear-gradient(160deg, var(--apple-glass-card-bg) 0%, var(--apple-group-bg) 100%);
  border: 1px solid var(--apple-glass-border-strong);
  border-radius: 20rpx;
  padding: 16rpx;
  box-shadow: var(--apple-shadow-surface);
}

.member-item:nth-child(2n) {
  margin-right: 0;
}

.member-avatar {
  width: 56rpx;
  height: 56rpx;
  border-radius: 50%;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-right: 12rpx;
}

.member-avatar-text {
  font-size: 24rpx;
  font-weight: 600;
  color: #ffffff;
}

.member-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.member-name {
  font-size: 24rpx;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.member-role {
  font-size: 20rpx;
  color: var(--primary);
  margin-top: 2rpx;
}

/* 资源列表 */
.resource-list {
  /* 资源列表容器 */
}

.resource-item {
  display: flex;
  align-items: center;
  background: linear-gradient(160deg, var(--apple-glass-card-bg) 0%, var(--apple-group-bg) 100%);
  border: 1px solid var(--apple-glass-border-strong);
  border-radius: 20rpx;
  padding: 20rpx;
  margin-bottom: 12rpx;
  box-shadow: var(--apple-shadow-surface);
}

.resource-icon {
  flex-shrink: 0;
  margin-right: 16rpx;
  color: var(--primary);
}

.resource-info {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.resource-name {
  font-size: 28rpx;
  color: var(--text-primary);
  margin-bottom: 4rpx;
}

.resource-meta {
  font-size: 22rpx;
  color: var(--text-sub);
}

/* 空状态 - 内联 */
.empty-inline {
  padding: 40rpx;
  text-align: center;
}

.empty-inline-text {
  font-size: 26rpx;
  color: var(--text-sub);
}

/* 离开按钮 */
.leave-section {
  padding: 40rpx 20rpx;
}

.leave-btn {
  width: 100%;
  height: 88rpx;
  border-radius: 999rpx;
  font-size: 30rpx;
  font-weight: 600;
  color: #ef4444;
  background: rgba(239, 68, 68, 0.06);
  border: 1rpx solid rgba(239, 68, 68, 0.2);
  line-height: 88rpx;
}

.leave-btn::after {
  border: none;
}

/* 浮动按钮 */
.fab-btn {
  position: fixed;
  right: 40rpx;
  bottom: 120rpx;
  width: 100rpx;
  height: 100rpx;
  border-radius: 50%;
  background: var(--cta-primary-bg);
  color: var(--cta-primary-text);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow:
    var(--cta-primary-shadow),
    0 8rpx 24rpx rgba(79, 70, 229, 0.35);
  z-index: 90;
}

/* 空状态 */
.empty-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 80rpx 40rpx;
  text-align: center;
}

.empty-icon {
  margin-bottom: 20rpx;
  color: var(--text-sub);
}

.empty-title {
  font-size: 32rpx;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 12rpx;
}

.empty-text {
  font-size: 26rpx;
  color: var(--text-sub);
  margin-bottom: 32rpx;
  line-height: 1.5;
}

.empty-actions {
  display: flex;
}

.empty-actions .action-btn {
  margin-right: 16rpx;
}

.empty-actions .action-btn:last-child {
  margin-right: 0;
}

.action-btn {
  font-size: 26rpx;
  padding: 14rpx 32rpx;
  border-radius: 999rpx;
  background: rgba(255, 255, 255, 0.68);
  color: var(--text-primary);
  border: 1rpx solid rgba(255, 255, 255, 0.5);
  box-shadow: var(--apple-shadow-surface);
}

.action-btn::after {
  border: none;
}

.action-btn.primary {
  background: var(--cta-primary-bg);
  color: var(--cta-primary-text);
  border: 1rpx solid var(--cta-primary-border);
  box-shadow: var(--cta-primary-shadow);
}

/* 骨架屏 */
.skeleton-list {
  padding-top: 20rpx;
  padding-left: 20rpx;
  padding-right: 20rpx;
}

.skeleton-card {
  background: linear-gradient(160deg, var(--apple-glass-card-bg) 0%, var(--apple-group-bg) 100%);
  border: 1px solid var(--apple-glass-border-strong);
  border-radius: 28rpx;
  padding: 28rpx;
  margin-bottom: 20rpx;
}

.skeleton-line {
  height: 24rpx;
  border-radius: 12rpx;
  background: var(--border, #e5e5e5);
  animation: skeleton-pulse 1.5s ease-in-out infinite;
}

.skeleton-title {
  width: 50%;
  margin-bottom: 16rpx;
}

.skeleton-desc {
  width: 80%;
  margin-bottom: 12rpx;
}

.skeleton-short {
  width: 35%;
}

@keyframes skeleton-pulse {
  0%,
  100% {
    opacity: 0.4;
  }
  50% {
    opacity: 0.8;
  }
}

/* 弹窗样式 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--overlay);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40rpx;
}

.modal-content {
  width: 100%;
  max-width: 620rpx;
  background: linear-gradient(160deg, var(--apple-glass-card-bg) 0%, var(--apple-group-bg) 100%);
  border-radius: 28rpx;
  overflow: hidden;
  border: 1rpx solid var(--apple-glass-border-strong);
  box-shadow: var(--apple-shadow-floating);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24rpx;
  border-bottom: 1px solid var(--border);
}

.modal-title {
  font-size: 32rpx;
  font-weight: 600;
  color: var(--text-primary);
}

.modal-close {
  font-size: 40rpx;
  color: var(--text-sub);
  padding: 8rpx;
}

.modal-body {
  padding: 24rpx;
}

.form-group {
  margin-bottom: 24rpx;
}

.form-group:last-child {
  margin-bottom: 0;
}

.form-label {
  font-size: 26rpx;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 12rpx;
  display: block;
}

.required {
  color: #ef4444;
}

.modal-input {
  width: 100%;
  height: 80rpx;
  background: rgba(255, 255, 255, 0.68);
  border: 1px solid rgba(255, 255, 255, 0.5);
  border-radius: 999rpx;
  padding: 0 24rpx;
  font-size: 28rpx;
  color: var(--text-primary);
  box-sizing: border-box;
}

.modal-textarea {
  width: 100%;
  height: 180rpx;
  background: rgba(255, 255, 255, 0.68);
  border: 1px solid rgba(255, 255, 255, 0.5);
  border-radius: 24rpx;
  padding: 16rpx;
  font-size: 28rpx;
  color: var(--text-primary);
  box-sizing: border-box;
}

.char-count {
  font-size: 22rpx;
  color: var(--text-sub);
  text-align: right;
  margin-top: 8rpx;
  display: block;
}

.modal-footer {
  display: flex;
  padding: 24rpx;
  border-top: 1px solid var(--apple-divider);
}

.modal-btn {
  flex: 1;
  height: 80rpx;
  border-radius: 999rpx;
  font-size: 28rpx;
  border: none;
}

.modal-btn + .modal-btn {
  margin-left: 16rpx;
}

.modal-btn.secondary {
  background: rgba(255, 255, 255, 0.7);
  color: var(--text-primary);
  border: 1rpx solid rgba(255, 255, 255, 0.5);
}

.modal-btn.primary {
  background: var(--cta-primary-bg);
  color: var(--cta-primary-text);
  border: 1rpx solid var(--cta-primary-border);
  box-shadow: var(--cta-primary-shadow);
}

.modal-btn::after {
  border: none;
}

.safe-area {
  height: 120rpx;
}

/* 加载状态（骨架屏容器） */
.loading-state {
  padding: 0 20rpx;
}

/* ========== 暗黑模式 ========== */
.dark-mode .aurora-bg {
  opacity: 0.3;
}

.dark-mode .nav-back,
.dark-mode .nav-title,
.dark-mode .tab-item.active .tab-text,
.dark-mode .group-name,
.dark-mode .detail-name,
.dark-mode .section-title,
.dark-mode .member-name,
.dark-mode .resource-name,
.dark-mode .empty-title,
.dark-mode .modal-title,
.dark-mode .form-label,
.dark-mode .modal-input,
.dark-mode .modal-textarea {
  color: var(--text-main, #ffffff);
}

.dark-mode .group-card,
.dark-mode .detail-header,
.dark-mode .member-item,
.dark-mode .resource-item,
.dark-mode .skeleton-card {
  background: var(--bg-card, #1c1c1e);
  border-color: var(--border, rgba(255, 255, 255, 0.1));
}

.dark-mode .modal-input,
.dark-mode .modal-textarea {
  background: var(--bg-secondary, #2c2c2e);
  border-color: var(--border, rgba(255, 255, 255, 0.1));
}

.dark-mode .modal-btn.secondary {
  color: var(--text-main, #ffffff);
  border-color: var(--border, rgba(255, 255, 255, 0.1));
}

.dark-mode .action-btn {
  color: var(--text-main, #ffffff);
  border-color: var(--border, rgba(255, 255, 255, 0.1));
}

.dark-mode .tag-pill {
  background: rgba(99, 102, 241, 0.12);
  border-color: rgba(99, 102, 241, 0.2);
}
</style>
