<template>
  <view class="classroom-container" :class="{ 'dark-mode': isDark }">
    <!-- 顶部导航 -->
    <view class="top-nav apple-glass" :style="{ paddingTop: statusBarHeight + 'px' }">
      <image src="/static/icons/chevron-left.png" class="back-icon" alt="返回" mode="aspectFit" @tap="goBack" />
      <view class="nav-center">
        <text class="nav-title">{{ lessonTitle }}</text>
        <text class="nav-subtitle">{{ phaseText }}</text>
      </view>
      <text class="nav-action" @tap="handleEndClass">结束</text>
    </view>

    <!-- 课程进度条 -->
    <view class="progress-section">
      <view class="progress-bar-bg">
        <view class="progress-bar-fill" :style="{ width: progressPercent + '%' }" />
      </view>
      <text class="progress-text">{{ currentSceneIndex + 1 }} / {{ totalScenes }}</text>
    </view>

    <!-- 消息列表 -->
    <scroll-view class="message-list" scroll-y :scroll-top="scrollTop" scroll-with-animation>
      <!-- 课堂开始提示 -->
      <view v-if="messages.length === 0 && !loading" class="welcome-card apple-glass-card">
        <text class="welcome-icon">🎓</text>
        <text class="welcome-title">课堂即将开始</text>
        <text class="welcome-desc">AI 老师和同学已就位，点击下方按钮开始上课</text>
        <button class="btn-start" @tap="startClass">开始上课</button>
      </view>

      <!-- 消息气泡 -->
      <view
        v-for="msg in messages"
        :key="msg.id"
        class="message-item"
        :class="'role-' + (msg.metadata?.isUser ? 'user' : msg.role)"
      >
        <!-- Agent 头像和名称 -->
        <view v-if="!msg.metadata?.isUser" class="agent-info">
          <view class="agent-avatar" :class="'avatar-' + msg.role">
            <text class="avatar-text">{{ avatarEmoji(msg.role) }}</text>
          </view>
          <text class="agent-name">{{ msg.agentName }}</text>
        </view>

        <!-- 消息内容 -->
        <view class="message-bubble" :class="msg.metadata?.isUser ? 'bubble-user' : 'bubble-agent'">
          <!-- 测验类型消息 -->
          <view v-if="msg.type === 'quiz'" class="quiz-content">
            <text class="quiz-label">📝 课堂测验</text>
            <text class="quiz-body">{{ parseQuizDisplay(msg.content) }}</text>
          </view>
          <!-- 普通文本消息 -->
          <text v-else class="message-text">{{ msg.content }}</text>
        </view>

        <!-- 用户消息右对齐 -->
        <view v-if="msg.metadata?.isUser" class="user-tag">
          <text class="user-name">我</text>
        </view>
      </view>

      <!-- 加载中 -->
      <view v-if="loading" class="loading-indicator">
        <view class="typing-dots">
          <view class="dot dot-1" />
          <view class="dot dot-2" />
          <view class="dot dot-3" />
        </view>
        <text class="loading-text">{{ loadingAgent }} 正在思考...</text>
      </view>
    </scroll-view>

    <!-- 底部操作栏 -->
    <view class="bottom-bar apple-glass">
      <!-- 等待输入状态：显示输入框 -->
      <view v-if="phase === 'waiting_input'" class="input-section">
        <input
          v-model="userInput"
          class="chat-input"
          placeholder="输入你的答案或问题..."
          confirm-type="send"
          @confirm="sendMessage"
        />
        <button class="btn-send" :disabled="!userInput.trim() || loading" @tap="sendMessage">发送</button>
      </view>

      <!-- 其他状态：显示操作按钮 -->
      <view v-else class="action-section">
        <button class="btn-action btn-continue" :disabled="loading" @tap="continueClass">
          {{ loading ? '思考中...' : '继续' }}
        </button>
        <button class="btn-action btn-question" :disabled="loading" @tap="askQuestion">举手提问</button>
        <!-- ✅ [闭环核心] 课后测验入口 -->
        <button v-if="phase === 'completed'" class="btn-action btn-quiz" @tap="goQuiz">课后测验</button>
      </view>
    </view>
  </view>
</template>

<script setup>
import { toast } from '@/utils/toast.js';
import { ref, computed, onMounted, nextTick } from 'vue';
import { safeNavigateBack } from '@/utils/safe-navigate';
import { useClassroomStore } from '@/stores/modules/classroom.js';
import { initTheme } from '@/composables/useTheme.js';
import { logger } from '@/utils/logger.js';
import { getStatusBarHeight } from '@/utils/core/system.js';
import { sanitizeAIChatInput } from '@/utils/security/sanitize.js';

const classroomStore = useClassroomStore();

const isDark = ref(initTheme());

// 页面参数
const lessonId = ref('');
const sessionId = ref('');
const lessonTitle = ref('AI 课堂');

// 课堂状态
const messages = ref([]);
const phase = ref('idle');
const currentSceneIndex = ref(0);
const totalScenes = ref(0);
const loading = ref(false);
const loadingAgent = ref('AI');
const userInput = ref('');
const scrollTop = ref(0);
const statusBarHeight = ref(0);

const progressPercent = computed(() => {
  if (totalScenes.value === 0) return 0;
  return Math.round(((currentSceneIndex.value + 1) / totalScenes.value) * 100);
});

const phaseText = computed(() => {
  const map = {
    idle: '准备中',
    lecturing: '讲课中',
    discussing: '讨论中',
    quizzing: '测验中',
    reviewing: '复习中',
    waiting_input: '等待回答',
    completed: '已结束'
  };
  return map[phase.value] || '';
});

function avatarEmoji(role) {
  const map = { teacher: '👨‍🏫', student: '🧑‍🎓', examiner: '📋' };
  return map[role] || '🤖';
}

function parseQuizDisplay(content) {
  try {
    const parsed = JSON.parse(content);
    const quiz = parsed.quiz || parsed;
    if (quiz.questions) {
      return quiz.questions.map((q, i) => `${i + 1}. ${q.stem}`).join('\n\n');
    }
  } catch {
    // 非JSON，直接显示
  }
  return content;
}

function scrollToBottom() {
  nextTick(() => {
    scrollTop.value = scrollTop.value + 99999;
  });
}

// 开始上课
async function startClass() {
  loading.value = true;
  loadingAgent.value = '系统';
  try {
    const res = await classroomStore.startSession(lessonId.value);
    if (res.success && res.data) {
      sessionId.value = res.data.sessionId;
      if (res.data.state) {
        updateState(res.data.state);
      }
      if (res.data.lesson) {
        lessonTitle.value = res.data.lesson.title;
        totalScenes.value = res.data.lesson.sceneCount || 0;
      }
      // 自动推进第一步
      await continueClass();
    } else {
      toast.info(res.message || '开始失败');
    }
  } catch (e) {
    logger.warn('[课堂] 开始失败:', e);
    toast.info('网络异常，请重试');
  } finally {
    loading.value = false;
  }
}

// 继续推进课堂
async function continueClass() {
  if (loading.value) return;
  loading.value = true;
  loadingAgent.value = 'AI';
  try {
    const res = await classroomStore.sendMessage(null, sessionId.value);
    if (res.success && res.data) {
      if (res.data.message) {
        messages.value.push(res.data.message);
        loadingAgent.value = res.data.message.agentName || 'AI';
      }
      if (res.data.state) {
        updateState(res.data.state);
      }
      scrollToBottom();
    }
  } catch (e) {
    logger.warn('[课堂] 推进失败:', e);
    // [AUDIT FIX R135] 用户操作失败时给出明确提示
    toast.error('课堂加载失败，请稍后重试');
  } finally {
    loading.value = false;
  }
}

// 发送用户消息
async function sendMessage() {
  const msg = sanitizeAIChatInput(userInput.value.trim());
  if (!msg || loading.value) return;

  // 先在本地显示用户消息
  messages.value.push({
    id: `user_${Date.now()}`,
    role: 'teacher',
    agentName: '我',
    content: msg,
    type: 'text',
    timestamp: Date.now(),
    metadata: { isUser: true }
  });
  userInput.value = '';
  scrollToBottom();

  loading.value = true;
  loadingAgent.value = 'AI';
  try {
    const res = await classroomStore.sendMessage(msg, sessionId.value);
    if (res.success && res.data) {
      if (res.data.message) {
        messages.value.push(res.data.message);
      }
      if (res.data.state) {
        updateState(res.data.state);
      }
      scrollToBottom();
    }
  } catch (e) {
    logger.warn('[课堂] 发送消息失败:', e);
    // [AUDIT FIX R135] 消息发送失败提示用户
    toast.error('消息发送失败，请重试');
  } finally {
    loading.value = false;
  }
}

// 举手提问
async function askQuestion() {
  userInput.value = '';
  phase.value = 'waiting_input';
  toast.info('请输入你的问题');
}

function updateState(state) {
  if (state.phase) phase.value = state.phase;
  if (state.currentSceneIndex !== undefined) currentSceneIndex.value = state.currentSceneIndex;
  if (state.totalScenes) totalScenes.value = state.totalScenes;
}

function goBack() {
  safeNavigateBack();
}

function handleEndClass() {
  uni.showModal({
    title: '结束课堂',
    content: '确定要结束当前课堂吗？',
    success: async (res) => {
      if (res.confirm && sessionId.value) {
        await classroomStore.endSession(sessionId.value);
        safeNavigateBack();
      }
    }
  });
}

// ✅ [闭环核心] 课后测验
function goQuiz() {
  uni.navigateTo({ url: '/pages/practice-sub/do-quiz' });
}

onMounted(() => {
  // 获取页面参数
  const pages = getCurrentPages();
  const currentPage = pages[pages.length - 1];
  const options = currentPage?.$page?.options || currentPage?.options || {};
  lessonId.value = options.lessonId || '';

  // [AUDIT FIX R135] 使用统一工具函数获取状态栏高度
  statusBarHeight.value = getStatusBarHeight();

  if (!lessonId.value) {
    toast.info('缺少课程参数');
    setTimeout(() => safeNavigateBack(), 1500);
  }
});
</script>

<style scoped>
.classroom-container {
  min-height: 100vh;
  background: linear-gradient(180deg, #f0f4f8 0%, #e8edf2 100%);
  display: flex;
  flex-direction: column;
}
.classroom-container.dark-mode {
  background: linear-gradient(180deg, #0d1117 0%, #161b22 100%);
}

/* 顶部导航 */
.top-nav {
  display: flex;
  align-items: center;
  padding: 12rpx 24rpx;
  backdrop-filter: saturate(180%) blur(20px);
  background: rgba(255, 255, 255, 0.72);
  border-bottom: 1rpx solid rgba(0, 0, 0, 0.06);
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
}
.dark-mode .top-nav {
  background: rgba(22, 27, 34, 0.82);
  border-bottom-color: rgba(255, 255, 255, 0.06);
}
.back-icon {
  width: 40rpx;
  height: 40rpx;
  opacity: 0.6;
}
.nav-center {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.nav-title {
  font-size: 30rpx;
  font-weight: 600;
  color: #1a1a2e;
}
.dark-mode .nav-title {
  color: #e6edf3;
}
.nav-subtitle {
  font-size: 22rpx;
  color: #8b949e;
  margin-top: 2rpx;
}
.nav-action {
  font-size: 28rpx;
  color: #e74c3c;
  padding: 8rpx 16rpx;
}

/* 进度条 */
.progress-section {
  display: flex;
  align-items: center;
  padding: 16rpx 32rpx;
  margin-top: 120rpx;
}
.progress-bar-bg {
  flex: 1;
  height: 8rpx;
  background: rgba(0, 0, 0, 0.06);
  border-radius: 4rpx;
  overflow: hidden;
}
.dark-mode .progress-bar-bg {
  background: rgba(255, 255, 255, 0.08);
}
.progress-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #34d399, #10b981);
  border-radius: 4rpx;
  transition: width 0.3s ease;
}
.progress-text {
  font-size: 22rpx;
  color: #8b949e;
  margin-left: 16rpx;
  white-space: nowrap;
}

/* 消息列表 */
.message-list {
  flex: 1;
  padding: 16rpx 24rpx;
  padding-bottom: 160rpx;
}

/* 欢迎卡片 */
.welcome-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 60rpx 40rpx;
  margin: 40rpx 0;
  border-radius: 24rpx;
  background: rgba(255, 255, 255, 0.72);
  backdrop-filter: saturate(180%) blur(20px);
  border: 1rpx solid rgba(255, 255, 255, 0.3);
}
.dark-mode .welcome-card {
  background: rgba(30, 37, 46, 0.72);
  border-color: rgba(255, 255, 255, 0.06);
}
.welcome-icon {
  font-size: 80rpx;
  margin-bottom: 20rpx;
}
.welcome-title {
  font-size: 34rpx;
  font-weight: 600;
  color: #1a1a2e;
  margin-bottom: 12rpx;
}
.dark-mode .welcome-title {
  color: #e6edf3;
}
.welcome-desc {
  font-size: 26rpx;
  color: #8b949e;
  margin-bottom: 32rpx;
  text-align: center;
}
.btn-start {
  background: linear-gradient(135deg, #34d399, #10b981);
  color: #fff;
  border: none;
  border-radius: 48rpx;
  padding: 20rpx 64rpx;
  font-size: 30rpx;
  font-weight: 600;
}

/* 消息气泡 */
.message-item {
  margin-bottom: 24rpx;
}
.role-user {
  display: flex;
  flex-direction: row-reverse;
  align-items: flex-start;
}
.agent-info {
  display: flex;
  align-items: center;
  margin-bottom: 8rpx;
}
.agent-avatar {
  width: 48rpx;
  height: 48rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 12rpx;
}
.avatar-teacher {
  background: rgba(99, 102, 241, 0.15);
}
.avatar-student {
  background: rgba(52, 211, 153, 0.15);
}
.avatar-examiner {
  background: rgba(251, 191, 36, 0.15);
}
.avatar-text {
  font-size: 28rpx;
}
.agent-name {
  font-size: 22rpx;
  color: #8b949e;
  font-weight: 500;
}
.message-bubble {
  max-width: 85%;
  padding: 20rpx 28rpx;
  border-radius: 20rpx;
  line-height: 1.6;
}
.bubble-agent {
  background: rgba(255, 255, 255, 0.82);
  border: 1rpx solid rgba(0, 0, 0, 0.04);
  border-radius: 4rpx 20rpx 20rpx 20rpx;
}
.dark-mode .bubble-agent {
  background: rgba(30, 37, 46, 0.82);
  border-color: rgba(255, 255, 255, 0.06);
}
.bubble-user {
  background: linear-gradient(135deg, #34d399, #10b981);
  color: #fff;
  border-radius: 20rpx 4rpx 20rpx 20rpx;
  margin-left: auto;
}
.message-text {
  font-size: 28rpx;
  color: #1a1a2e;
  white-space: pre-wrap;
  word-break: break-word;
}
.dark-mode .bubble-agent .message-text {
  color: #e6edf3;
}
.bubble-user .message-text {
  color: #fff;
}
.user-tag {
  margin-left: 12rpx;
}
.user-name {
  font-size: 22rpx;
  color: #8b949e;
}

/* 测验内容 */
.quiz-content {
  display: flex;
  flex-direction: column;
}
.quiz-label {
  font-size: 24rpx;
  font-weight: 600;
  color: #f59e0b;
  margin-bottom: 12rpx;
}
.quiz-body {
  font-size: 28rpx;
  color: #1a1a2e;
  white-space: pre-wrap;
}
.dark-mode .quiz-body {
  color: #e6edf3;
}

/* 加载动画 */
.loading-indicator {
  display: flex;
  align-items: center;
  padding: 20rpx 0;
}
.typing-dots {
  display: flex;
  align-items: center;
  margin-right: 16rpx;
}
.dot {
  width: 12rpx;
  height: 12rpx;
  border-radius: 50%;
  background: #8b949e;
  margin: 0 4rpx;
  animation: dotPulse 1.4s infinite ease-in-out;
}
.dot-1 {
  animation-delay: 0s;
}
.dot-2 {
  animation-delay: 0.2s;
}
.dot-3 {
  animation-delay: 0.4s;
}
@keyframes dotPulse {
  0%,
  80%,
  100% {
    opacity: 0.3;
    transform: scale(0.8);
  }
  40% {
    opacity: 1;
    transform: scale(1);
  }
}
.loading-text {
  font-size: 24rpx;
  color: #8b949e;
}

/* 底部操作栏 */
.bottom-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 16rpx 24rpx;
  padding-bottom: calc(16rpx + env(safe-area-inset-bottom));
  backdrop-filter: saturate(180%) blur(20px);
  background: rgba(255, 255, 255, 0.82);
  border-top: 1rpx solid rgba(0, 0, 0, 0.06);
}
.dark-mode .bottom-bar {
  background: rgba(22, 27, 34, 0.88);
  border-top-color: rgba(255, 255, 255, 0.06);
}
.input-section {
  display: flex;
  align-items: center;
}
.chat-input {
  flex: 1;
  height: 72rpx;
  background: rgba(0, 0, 0, 0.04);
  border-radius: 36rpx;
  padding: 0 28rpx;
  font-size: 28rpx;
  color: #1a1a2e;
}
.dark-mode .chat-input {
  background: rgba(255, 255, 255, 0.06);
  color: #e6edf3;
}
.btn-send {
  margin-left: 16rpx;
  background: linear-gradient(135deg, #34d399, #10b981);
  color: #fff;
  border: none;
  border-radius: 36rpx;
  padding: 0 32rpx;
  height: 72rpx;
  line-height: 72rpx;
  font-size: 28rpx;
  font-weight: 600;
}
.btn-send[disabled] {
  opacity: 0.4;
}
.action-section {
  display: flex;
  gap: 16rpx;
}
.btn-action {
  flex: 1;
  height: 80rpx;
  border-radius: 40rpx;
  font-size: 28rpx;
  font-weight: 600;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
}
.btn-continue {
  background: linear-gradient(135deg, #34d399, #10b981);
  color: #fff;
}
.btn-continue[disabled] {
  opacity: 0.5;
}
.btn-question {
  background: rgba(99, 102, 241, 0.12);
  color: #6366f1;
}
.btn-quiz {
  background: linear-gradient(135deg, #f59e0b, #d97706);
  color: #fff;
}
</style>
