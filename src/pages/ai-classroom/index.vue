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
      <text class="empty-icon">📚</text>
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
import { ref, onMounted } from 'vue';
import { useClassroomStore } from '@/stores/modules/classroom.js';
import { initTheme } from '@/composables/useTheme.js';
import PrivacyPopup from '@/components/common/privacy-popup.vue';
import { logger } from '@/utils/logger.js';

const classroomStore = useClassroomStore();

const isDark = ref(initTheme());

const lessons = ref([]);
const loading = ref(false);
const showCreateModal = ref(false);
const creating = ref(false);

const subjects = [
  { value: 'politics', label: '政治', icon: '🏛️' },
  { value: 'english', label: '英语', icon: '🌍' },
  { value: 'math', label: '数学', icon: '📐' },
  { value: 'professional', label: '专业课', icon: '📖' }
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
    logger.warn('[AI课堂] 加载课程列表失败:', e);
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
  const timer = setInterval(async () => {
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
          clearInterval(timer);
          if (res.data.status === 'ready') {
            toast.success('课程生成完成');
          }
          await loadLessons();
        }
      }
    } catch {
      clearInterval(timer);
    }
  }, 3000);
  // 5分钟超时
  setTimeout(() => clearInterval(timer), 300000);
}

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
.classroom-list-container {
  min-height: 100vh;
  background: var(--bg-primary, #0a0a0a);
  padding-bottom: env(safe-area-inset-bottom);
}
.dark-mode {
  --text-primary: #f5f5f7;
  --text-secondary: #8e8e93;
  --bg-card: rgba(255, 255, 255, 0.06);
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
  padding: 12px 16px;
  padding-top: calc(env(safe-area-inset-top) + 12px);
  backdrop-filter: blur(20px);
  background: rgba(0, 0, 0, 0.6);
}
.nav-title {
  font-size: 17px;
  font-weight: 600;
  color: var(--text-primary, #f5f5f7);
}
.apple-glass-card {
  background: var(--bg-card, rgba(255, 255, 255, 0.06));
  border-radius: 16px;
  padding: 16px;
  margin: 0 16px 12px;
  border: 1px solid rgba(255, 255, 255, 0.08);
}
.create-card {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-top: 80px;
}
.create-icon {
  width: 48px;
  height: 48px;
  border-radius: 14px;
  background: linear-gradient(135deg, #34c759, #30d158);
  display: flex;
  align-items: center;
  justify-content: center;
}
.icon-text {
  font-size: 28px;
  color: #fff;
  font-weight: 300;
}
.create-info {
  flex: 1;
}
.create-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary, #f5f5f7);
  display: block;
}
.create-desc {
  font-size: 13px;
  color: var(--text-secondary, #8e8e93);
  display: block;
  margin-top: 4px;
}
.lesson-list {
  padding-top: 8px;
}
.section-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-secondary, #8e8e93);
  margin: 16px 16px 8px;
  display: block;
}
.lesson-card {
  position: relative;
}
.lesson-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}
.lesson-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary, #f5f5f7);
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.lesson-status {
  padding: 2px 8px;
  border-radius: 8px;
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
  font-size: 11px;
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
  gap: 12px;
}
.meta-item {
  font-size: 12px;
  color: var(--text-secondary, #8e8e93);
}
.progress-bar {
  height: 4px;
  border-radius: 2px;
  background: rgba(255, 255, 255, 0.08);
  margin-top: 10px;
  overflow: hidden;
}
.progress-fill {
  height: 100%;
  border-radius: 2px;
  background: linear-gradient(90deg, #ff9f0a, #34c759);
  transition: width 0.3s;
}
.lesson-actions {
  position: absolute;
  top: 16px;
  right: 16px;
}
.action-delete {
  font-size: 12px;
  color: #ff453a;
}
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 80px 0;
}
.empty-icon {
  font-size: 48px;
}
.empty-title {
  font-size: 17px;
  font-weight: 600;
  color: var(--text-primary, #f5f5f7);
  margin-top: 16px;
}
.empty-desc {
  font-size: 13px;
  color: var(--text-secondary, #8e8e93);
  margin-top: 8px;
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
  padding: 20px;
}
.modal-content {
  width: 100%;
  max-width: 360px;
  max-height: 80vh;
  overflow-y: auto;
}
.modal-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--text-primary, #f5f5f7);
  display: block;
  margin-bottom: 20px;
  text-align: center;
}
.form-group {
  margin-bottom: 16px;
}
.form-label {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary, #f5f5f7);
  display: block;
  margin-bottom: 8px;
}
.subject-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}
.subject-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 10px 4px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.04);
  border: 2px solid transparent;
}
.subject-item.active {
  border-color: #34c759;
  background: rgba(52, 199, 89, 0.1);
}
.subject-icon {
  font-size: 24px;
}
.subject-name {
  font-size: 12px;
  color: var(--text-primary, #f5f5f7);
  margin-top: 4px;
}
.form-input {
  width: 100%;
  height: 40px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  padding: 0 12px;
  color: var(--text-primary, #f5f5f7);
  font-size: 14px;
}
.form-textarea {
  width: 100%;
  height: 100px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  padding: 10px 12px;
  color: var(--text-primary, #f5f5f7);
  font-size: 14px;
}
.modal-actions {
  display: flex;
  gap: 10px;
  margin-top: 20px;
}
.btn-cancel {
  flex: 1;
  height: 42px;
  background: rgba(255, 255, 255, 0.08);
  color: var(--text-secondary, #8e8e93);
  border: none;
  border-radius: 12px;
  font-size: 15px;
}
.btn-create {
  flex: 1;
  height: 42px;
  background: linear-gradient(135deg, #34c759, #30d158);
  color: #fff;
  border: none;
  border-radius: 12px;
  font-size: 15px;
  font-weight: 600;
}
.btn-create[disabled] {
  opacity: 0.5;
}
</style>
