<template>
  <view class="classroom-list-container" :class="{ 'dark-mode': isDark }">
    <PrivacyPopup />
    <!-- 顶部导航 -->
    <view class="top-nav apple-glass">
      <text class="nav-title">AI 课堂</text>
    </view>

    <!-- 创建课程卡片 -->
    <view class="create-card apple-glass-card" @tap="showCreateModal = true">
      <view class="create-icon">
        <text class="icon-text">+</text>
      </view>
      <view class="create-info">
        <text class="create-title">创建互动课程</text>
        <text class="create-desc">输入考研主题，AI 为你生成互动课堂</text>
      </view>
    </view>

    <!-- 加载骨架屏 -->
    <view v-if="loading" class="skeleton-list">
      <view v-for="i in 3" :key="i" class="skeleton-card">
        <view class="skeleton-header-row">
          <view class="skeleton-title skeleton-animate" />
          <view class="skeleton-badge skeleton-animate" />
        </view>
        <view class="skeleton-meta skeleton-animate" />
      </view>
    </view>

    <!-- 课程列表 -->
    <view v-if="lessons.length > 0" class="lesson-list">
      <view class="section-title">我的课程</view>
      <view v-for="item in lessons" :key="item._id" class="lesson-card apple-glass-card" @tap="enterLesson(item)">
        <view class="lesson-header">
          <text class="lesson-title">{{ item.title }}</text>
          <view class="lesson-status" :class="'status-' + item.status">
            <text class="status-text">{{ statusText(item.status) }}</text>
          </view>
        </view>
        <view class="lesson-meta">
          <text class="meta-item">{{ item.subject }}</text>
          <text class="meta-item">{{ formatTime(item.created_at) }}</text>
        </view>
        <view v-if="item.status === 'generating'" class="progress-bar">
          <view class="progress-fill" :style="{ width: (item.progress || 0) + '%' }" />
        </view>
        <!-- 长按删除 -->
        <view class="lesson-actions">
          <text class="action-delete" @tap.stop="confirmDelete(item._id)">删除</text>
        </view>
      </view>
    </view>

    <!-- 空状态 -->
    <view v-if="!loading && lessons.length === 0" class="empty-state">
      <text class="empty-icon">[书]</text>
      <text class="empty-title">还没有课程</text>
      <text class="empty-desc">点击上方创建你的第一个 AI 互动课程</text>
    </view>

    <!-- 创建课程弹窗 -->
    <view v-if="showCreateModal" class="modal-mask" @tap="showCreateModal = false">
      <view class="modal-content apple-glass-card" @tap.stop>
        <text class="modal-title">创建 AI 课程</text>

        <view class="form-group">
          <text class="form-label">考研科目</text>
          <view class="subject-grid">
            <view
              v-for="s in subjects"
              :key="s.value"
              class="subject-item"
              :class="{ active: form.subject === s.value }"
              @tap="form.subject = s.value"
            >
              <text class="subject-icon">{{ s.icon }}</text>
              <text class="subject-name">{{ s.label }}</text>
            </view>
          </view>
        </view>

        <view class="form-group">
          <text class="form-label">学习主题</text>
          <input
            v-model="form.topic"
            class="form-input"
            placeholder="例如：马克思主义基本原理、高等数学极限"
            maxlength="100"
          />
        </view>

        <view class="form-group">
          <text class="form-label">学习资料（可选）</text>
          <textarea
            v-model="form.materials"
            class="form-textarea"
            placeholder="粘贴笔记、教材内容或知识点，AI 会据此生成课程"
            maxlength="8000"
          ></textarea>
        </view>

        <view class="modal-actions">
          <button class="btn-cancel" @tap="showCreateModal = false">取消</button>
          <button class="btn-create" :disabled="creating" @tap="handleCreate">
            {{ creating ? '生成中...' : '开始生成' }}
          </button>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { toast } from '@/utils/toast.js';
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { useClassroomStore } from '@/stores/modules/classroom.js';
import { initTheme } from '@/composables/useTheme.js';
import PrivacyPopup from '@/components/common/privacy-popup.vue';
import { logger } from '@/utils/logger.js';
import config from '@/config/index.js';

const classroomStore = useClassroomStore();

const isDark = ref(initTheme());

const lessons = ref([]);
const loading = ref(false);
const showCreateModal = ref(false);
const creating = ref(false);

// R14: 轮询定时器引用，用于页面卸载时清理
let _pollTimer = null;
let _pollTimeout = null;

const subjects = [
  { value: 'politics', label: '政治', icon: '[政]' },
  { value: 'english', label: '英语', icon: '[英]' },
  { value: 'math', label: '数学', icon: '[数]' },
  { value: 'professional', label: '专业课', icon: '[专]' }
];

const form = ref({
  topic: '',
  subject: 'politics',
  materials: ''
});

// 加载课程列表
async function loadLessons() {
  loading.value = true;
  try {
    const res = await classroomStore.fetchLessons({ page: 1, limit: 50 });
    if (res.success && res.data) {
      lessons.value = Array.isArray(res.data) ? res.data : res.data.list || [];
    }
  } catch (_e) {
    logger.warn('[AI课堂] 加载课程列表失败:', _e);
  } finally {
    loading.value = false;
  }
}

// 创建课程
async function handleCreate() {
  if (!form.value.topic.trim()) {
    toast.info('请输入学习主题');
    return;
  }
  creating.value = true;
  try {
    const res = await classroomStore.createLesson({
      topic: form.value.topic.trim(),
      subject: form.value.subject,
      materials: form.value.materials.trim() || undefined
    });
    if (res.success && res.data) {
      toast.success('课程生成已启动');
      showCreateModal.value = false;
      form.value = { topic: '', subject: 'politics', materials: '' };
      // 轮询进度
      pollLessonStatus(res.data.lessonId);
      await loadLessons();
    } else {
      toast.info(res.message || '创建失败');
    }
  } catch (_e) {
    toast.info('创建失败，请重试');
  } finally {
    creating.value = false;
  }
}

// 轮询课程生成进度
function pollLessonStatus(lessonId) {
  // 先清理之前的轮询（防止重复）
  clearPollTimers();

  _pollTimer = setInterval(async () => {
    try {
      const res = await classroomStore.fetchLessonStatus(lessonId);
      if (res.success && res.data) {
        // 更新列表中的进度
        const idx = lessons.value.findIndex((l) => l._id === lessonId);
        if (idx >= 0) {
          lessons.value[idx].progress = res.data.progress;
          lessons.value[idx].status = res.data.status;
        }
        if (res.data.status === 'ready' || res.data.status === 'failed') {
          clearPollTimers();
          if (res.data.status === 'ready') {
            toast.success('课程生成完成');
          }
          await loadLessons();
        }
      }
    } catch {
      clearPollTimers();
    }
  }, config.ai.pollIntervalMs);
  // 5分钟超时兜底
  _pollTimeout = setTimeout(() => clearPollTimers(), config.ai.pollTimeoutMs);
}

// R14: 清理轮询定时器
function clearPollTimers() {
  if (_pollTimer) {
    clearInterval(_pollTimer);
    _pollTimer = null;
  }
  if (_pollTimeout) {
    clearTimeout(_pollTimeout);
    _pollTimeout = null;
  }
}

// R14: 页面卸载时清理定时器，防止内存泄漏
onBeforeUnmount(() => {
  clearPollTimers();
});

// 进入课程
function enterLesson(item) {
  if (item.status === 'generating') {
    toast.info('课程正在生成中...');
    return;
  }
  if (item.status === 'failed') {
    toast.info('课程生成失败，请重新创建');
    return;
  }
  uni.navigateTo({ url: `/pages/ai-classroom/classroom?lessonId=${item._id}` });
}

function statusText(status) {
  const map = { generating: '生成中', ready: '已就绪', failed: '失败' };
  return map[status] || status;
}

function formatTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}

async function confirmDelete(lessonId) {
  uni.showModal({
    title: '确认删除',
    content: '删除后无法恢复，确定要删除这个课程吗？',
    success: async (res) => {
      if (res.confirm) {
        const result = await classroomStore.deleteLesson(lessonId);
        if (result.success) {
          toast.success('已删除');
          await loadLessons();
        }
      }
    }
  });
}

onMounted(() => {
  loadLessons();

  // ✅ [闭环核心] 处理从诊断报告页自动创建课程的参数
  const pages = getCurrentPages();
  const currentPage = pages[pages.length - 1];
  const options = currentPage?.$page?.options || currentPage?.options || {};
  if (options.autoCreate === 'true' && options.topic) {
    showCreateModal.value = true;
    form.value.topic = decodeURIComponent(options.topic);
    form.value.subject = options.subject || 'professional';
  }
});
</script>

<style scoped>
/* [AUDIT FIX R135] px→rpx 响应式适配 */
.classroom-list-container {
  min-height: 100vh;
  background: linear-gradient(
    180deg,
    var(--page-gradient-top, var(--bg-page)) 0%,
    var(--page-gradient-mid, var(--bg-page)) 52%,
    var(--page-gradient-bottom, var(--bg-page)) 100%
  );
  padding-bottom: env(safe-area-inset-bottom);
}
.top-nav {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24rpx 32rpx;
  padding-top: calc(env(safe-area-inset-top) + 24rpx);
  backdrop-filter: blur(40rpx);
  -webkit-backdrop-filter: blur(40rpx);
  background: var(--apple-glass-nav-bg, rgba(250, 255, 246, 0.74));
}
.dark-mode .top-nav {
  background: rgba(0, 0, 0, 0.6);
}
.nav-title {
  font-size: 34rpx;
  font-weight: 600;
  color: var(--text-primary, var(--foreground));
}
.apple-glass-card {
  background: var(--apple-glass-card-bg, rgba(255, 255, 255, 0.68));
  border-radius: 32rpx;
  padding: 32rpx;
  margin: 0 32rpx 24rpx;
  border: 1px solid var(--glass-border, rgba(255, 255, 255, 0.72));
  box-shadow: var(--apple-shadow-card, 0 4px 12px rgba(0, 0, 0, 0.06));
}
.dark-mode .apple-glass-card {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.08);
  box-shadow: none;
}
.create-card {
  display: flex;
  align-items: center;
  gap: 28rpx;
  margin-top: 160rpx;
}
.create-icon {
  width: 96rpx;
  height: 96rpx;
  border-radius: 28rpx;
  background: linear-gradient(135deg, #34c759, #30d158);
  display: flex;
  align-items: center;
  justify-content: center;
}
.icon-text {
  font-size: 56rpx;
  color: #fff;
  font-weight: 300;
}
.create-info {
  flex: 1;
}
.create-title {
  font-size: 32rpx;
  font-weight: 600;
  color: var(--text-primary, var(--foreground));
  display: block;
}
.create-desc {
  font-size: 26rpx;
  color: var(--text-secondary, var(--muted-foreground));
  display: block;
  margin-top: 8rpx;
}
.lesson-list {
  padding-top: 16rpx;
}
.section-title {
  font-size: 30rpx;
  font-weight: 600;
  color: var(--text-secondary, var(--muted-foreground));
  margin: 32rpx 32rpx 16rpx;
  display: block;
}
.lesson-card {
  position: relative;
}
.lesson-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16rpx;
}
.lesson-title {
  font-size: 30rpx;
  font-weight: 600;
  color: var(--text-primary, var(--foreground));
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.lesson-status {
  padding: 4rpx 16rpx;
  border-radius: 16rpx;
}
.status-generating {
  background: rgba(255, 159, 10, 0.15);
}
.status-ready {
  background: rgba(52, 199, 89, 0.15);
}
.status-failed {
  background: rgba(255, 69, 58, 0.15);
}
.status-text {
  font-size: 22rpx;
}
.status-generating .status-text {
  color: #ff9f0a;
}
.status-ready .status-text {
  color: #34c759;
}
.status-failed .status-text {
  color: #ff453a;
}
.lesson-meta {
  display: flex;
  gap: 24rpx;
}
.meta-item {
  font-size: 24rpx;
  color: var(--text-secondary, var(--muted-foreground));
}
.progress-bar {
  height: 8rpx;
  border-radius: 4rpx;
  background: var(--brand-tint-subtle, rgba(15, 95, 52, 0.08));
  margin-top: 20rpx;
  overflow: hidden;
}
.dark-mode .progress-bar {
  background: rgba(255, 255, 255, 0.08);
}
.progress-fill {
  height: 100%;
  border-radius: 4rpx;
  background: linear-gradient(90deg, #ff9f0a, #34c759);
  transition: width 0.3s;
}
.lesson-actions {
  position: absolute;
  top: 32rpx;
  right: 32rpx;
}
.action-delete {
  font-size: 24rpx;
  color: #ff453a;
}
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 160rpx 0;
}
.empty-icon {
  font-size: 96rpx;
}
.empty-title {
  font-size: 34rpx;
  font-weight: 600;
  color: var(--text-primary, var(--foreground));
  margin-top: 32rpx;
}
.empty-desc {
  font-size: 26rpx;
  color: var(--text-secondary, var(--muted-foreground));
  margin-top: 16rpx;
}
.modal-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40rpx;
}
.modal-content {
  width: 100%;
  max-width: 720rpx;
  max-height: 80vh;
  overflow-y: auto;
  background: var(--apple-glass-card-bg, rgba(255, 255, 255, 0.95));
}
.dark-mode .modal-content {
  background: rgba(30, 30, 36, 0.96);
}
.modal-title {
  font-size: 36rpx;
  font-weight: 700;
  color: var(--text-primary, var(--foreground));
  display: block;
  margin-bottom: 40rpx;
  text-align: center;
}
.form-group {
  margin-bottom: 32rpx;
}
.form-label {
  font-size: 28rpx;
  font-weight: 600;
  color: var(--text-primary, var(--foreground));
  display: block;
  margin-bottom: 16rpx;
}
.subject-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16rpx;
}
.subject-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20rpx 8rpx;
  border-radius: 24rpx;
  background: var(--brand-tint-subtle, rgba(15, 95, 52, 0.06));
  border: 2px solid transparent;
}
.dark-mode .subject-item {
  background: rgba(255, 255, 255, 0.04);
}
.subject-item.active {
  border-color: #34c759;
  background: rgba(52, 199, 89, 0.1);
}
.subject-icon {
  font-size: 48rpx;
}
.subject-name {
  font-size: 24rpx;
  color: var(--text-primary, var(--foreground));
  margin-top: 8rpx;
}
.form-input {
  width: 100%;
  height: 80rpx;
  background: var(--brand-tint-subtle, rgba(15, 95, 52, 0.06));
  border: 1px solid var(--border, rgba(15, 95, 52, 0.15));
  border-radius: 20rpx;
  padding: 0 24rpx;
  color: var(--text-primary, var(--foreground));
  font-size: 28rpx;
}
.dark-mode .form-input {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.1);
}
.form-textarea {
  width: 100%;
  height: 200rpx;
  background: var(--brand-tint-subtle, rgba(15, 95, 52, 0.06));
  border: 1px solid var(--border, rgba(15, 95, 52, 0.15));
  border-radius: 20rpx;
  padding: 20rpx 24rpx;
  color: var(--text-primary, var(--foreground));
  font-size: 28rpx;
}
.dark-mode .form-textarea {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.1);
}
.modal-actions {
  display: flex;
  gap: 20rpx;
  margin-top: 40rpx;
}
.btn-cancel {
  flex: 1;
  height: 84rpx;
  background: var(--brand-tint-subtle, rgba(15, 95, 52, 0.06));
  color: var(--text-secondary, var(--muted-foreground));
  border: none;
  border-radius: 24rpx;
  font-size: 30rpx;
}
.dark-mode .btn-cancel {
  background: rgba(255, 255, 255, 0.08);
}
.btn-create {
  flex: 1;
  height: 84rpx;
  background: linear-gradient(135deg, #34c759, #30d158);
  color: #fff;
  border: none;
  border-radius: 24rpx;
  font-size: 30rpx;
  font-weight: 600;
}
.btn-create[disabled] {
  opacity: 0.5;
}

/* 加载骨架屏 */
.skeleton-list {
  padding: 0 32rpx;
}

.skeleton-card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 32rpx;
  padding: 40rpx;
  margin-bottom: 24rpx;
}

.skeleton-header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24rpx;
}

.skeleton-title {
  width: 60%;
  height: 40rpx;
  border-radius: 16rpx;
}

.skeleton-badge {
  width: 120rpx;
  height: 48rpx;
  border-radius: 24rpx;
}

.skeleton-meta {
  width: 40%;
  height: 28rpx;
  border-radius: 12rpx;
}

.skeleton-animate {
  background: linear-gradient(90deg, var(--bg-secondary) 25%, var(--bg-card) 50%, var(--bg-secondary) 75%);
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
</style>
