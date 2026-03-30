<template>
  <!-- AI 每日简报 — 从"功能集合"到"AI助手"的核心组件 -->
  <view v-if="!isNewUser" class="ai-briefing apple-glass-card" :class="{ dark: isDark }">
    <!-- 顶部标识 -->
    <view class="briefing-header">
      <view class="briefing-badge">
        <BaseIcon name="sparkle" :size="20" class="badge-icon" />
        <text class="badge-text">AI 学习助手</text>
      </view>
      <text v-if="greeting" class="briefing-time">{{ greeting }}</text>
    </view>

    <!-- AI 建议内容 -->
    <view class="briefing-body">
      <!-- 加载中 -->
      <view v-if="loading" class="briefing-loading">
        <view v-for="i in 3" :key="i" class="loading-dot" />
        <text class="loading-text">AI 正在分析你的学习状态...</text>
      </view>

      <!-- AI 简报消息 -->
      <text v-else class="briefing-message">{{ briefingMessage }}</text>
    </view>

    <!-- 今日任务列表 -->
    <view v-if="!loading && tasks.length > 0" class="briefing-tasks">
      <view v-for="(task, index) in tasks" :key="index" class="task-item" @tap="handleTaskTap(task)">
        <view class="ta<REDACTED_SECRET>" :class="[task.priority]" />
        <view class="task-content">
          <text class="task-title">{{ task.title }}</text>
          <text v-if="task.subtitle" class="ta<REDACTED_SECRET>">{{ task.subtitle }}</text>
        </view>
        <text class="task-arrow">›</text>
      </view>
    </view>

    <!-- 一键开始按钮 -->
    <view v-if="!loading && primaryTask" class="briefing-action" @tap="handleTaskTap(primaryTask)">
      <BaseIcon name="play" :size="20" class="action-icon" />
      <text class="action-text">{{ primaryTask.actionText || '开始今日学习' }}</text>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import BaseIcon from '@/components/base/base-icon/base-icon.vue';
import { storageService } from '@/services/storageService.js';
import { logger } from '@/utils/logger.js';
import { debounce } from '@/utils/throttle.js';

// 动态导入 — analyzeMastery/getPendingCorrections/getSprintPriority 在 smart-study.api.js 中
const loadStudyApi = () => import('@/services/api/domains/smart-study.api.js');

const props = defineProps({
  isDark: { type: Boolean, default: false },
  isNewUser: { type: Boolean, default: false },
  reviewPending: { type: Number, default: 0 },
  overdueCount: { type: Number, default: 0 },
  todayDone: { type: Number, default: 0 },
  accuracy: { type: Number, default: 0 },
  examDate: { type: String, default: '' },
  // [AUDIT FIX R135] 冻结空数组常量，避免每次父组件渲染时创建新引用导致不必要的子组件重渲染
  weakPoints: { type: Array, default: () => Object.freeze([]) },
  pendingCorrections: { type: Number, default: 0 },
  hasUnfinished: { type: Boolean, default: false }
});

const emit = defineEmits([
  'go-review',
  'go-practice',
  'go-correction',
  'go-chat',
  'go-weak-training',
  'resume-session'
]);

const loading = ref(false);
const briefingMessage = ref('');
const tasks = ref([]);
const primaryTask = ref(null);
// AI 增强数据
const aiEnriched = ref(false);

const greeting = computed(() => {
  const h = new Date().getHours();
  if (h < 6) return '凌晨了，注意休息';
  if (h < 9) return '早上好';
  if (h < 12) return '上午好';
  if (h < 14) return '中午好';
  if (h < 18) return '下午好';
  if (h < 22) return '晚上好';
  return '夜深了，别熬太晚';
});

const daysToExam = computed(() => {
  if (!props.examDate) return -1;
  const diff = Math.ceil((new Date(props.examDate) - new Date()) / 86400000);
  return Math.max(0, diff);
});

// [AUDIT FIX R135] 对 watcher 添加 debounce，防止父组件快速重渲染时触发多次 API 调用
const debouncedGenerateBriefing = debounce(() => {
  generateBriefing();
}, 300);

watch(
  () => props.reviewPending,
  () => {
    debouncedGenerateBriefing();
  }
);
watch(
  () => props.todayDone,
  () => {
    debouncedGenerateBriefing();
  }
);

onMounted(() => {
  generateBriefing();
});

/**
 * 生成 AI 每日简报 — 核心逻辑
 * 先用本地规则立即展示，再异步调用后端增强
 */
function generateBriefing() {
  // 本地规则立即展示（零延迟）
  _buildBriefing();
  // 异步调用后端 AI 增强（不阻塞首屏）
  _enrichWithAI();
}

function _buildBriefing() {
  const taskList = [];
  let message = '';

  // === 构建 AI 简报消息 ===
  const daysLeft = daysToExam.value;

  // 优先级 1：有未完成的练习 → 续做
  if (props.hasUnfinished) {
    message = '你有一份未完成的练习，先把它做完吧！';
    taskList.push({
      title: '继续上次练习',
      subtitle: '接着上次进度',
      priority: 'urgent',
      action: 'resume',
      actionText: '继续练习'
    });
  }

  // 优先级 2：有逾期复习卡
  if (props.overdueCount > 0) {
    message = message || `你有 ${props.overdueCount} 道复习已逾期，遗忘曲线在加速下滑，先把它们捡回来！`;
    taskList.push({
      title: `复习 ${props.reviewPending} 道到期卡片`,
      subtitle: props.overdueCount > 0 ? `⚠️ ${props.overdueCount} 道已逾期` : 'FSRS 算法调度',
      priority: 'urgent',
      action: 'review',
      actionText: '开始复习'
    });
  } else if (props.reviewPending > 0) {
    // 有待复习但无逾期
    taskList.push({
      title: `复习 ${props.reviewPending} 道到期卡片`,
      subtitle: '按遗忘曲线最佳时机',
      priority: 'high',
      action: 'review',
      actionText: '开始复习'
    });
  }

  // 优先级 3：有待矫正的错题
  if (props.pendingCorrections > 0) {
    taskList.push({
      title: `订正 ${props.pendingCorrections} 个薄弱知识点`,
      subtitle: 'AI 已分析出根本原因',
      priority: 'high',
      action: 'correction'
    });
  }

  // 优先级 4：推荐做新题
  if (props.todayDone < 10) {
    taskList.push({
      title: '做一组新题巩固',
      subtitle: `今日已做 ${props.todayDone} 题，建议 10+`,
      priority: 'normal',
      action: 'practice'
    });
  }

  // 优先级 5：和 AI 好友聊聊
  if (props.todayDone >= 10 && props.reviewPending === 0) {
    taskList.push({
      title: '和 AI 学伴聊聊',
      subtitle: '讨论考点、缓解压力',
      priority: 'low',
      action: 'chat'
    });
  }

  // === 引用昨日学习记忆（让AI有连续性） ===
  const memory = _loadYesterdayMemory();
  let memoryPrefix = '';
  if (memory) {
    if (memory.questionsCount > 0 && memory.weakestPoint) {
      memoryPrefix = `昨天你做了${memory.questionsCount}题，「${memory.weakestPoint}」仍需加强。`;
    } else if (memory.questionsCount > 0) {
      memoryPrefix = `昨天做了${memory.questionsCount}题(正确率${memory.accuracy}%)，`;
    }
  }

  // === 构建主消息 ===
  if (!message) {
    if (daysLeft > 0 && daysLeft <= 30) {
      // 冲刺阶段
      message = `距离考研还有 ${daysLeft} 天！冲刺阶段要保持节奏。`;
      if (props.accuracy < 60) {
        message += `你的正确率 ${props.accuracy}%，建议重点突破薄弱科目。`;
      } else if (props.accuracy > 85) {
        message += `正确率 ${props.accuracy}% 很棒，保持状态！`;
      }
    } else if (daysLeft > 30) {
      message = `距离考研还有 ${daysLeft} 天。`;
      if (props.reviewPending > 0) {
        message += `今天有 ${props.reviewPending} 道复习在等你。`;
      } else if (props.todayDone > 0) {
        message += `今天已做 ${props.todayDone} 题，继续保持！`;
      } else {
        message += '新的一天，开始学习吧！';
      }
    } else {
      // 没设考试日期
      if (props.todayDone === 0) {
        message = '新的一天开始了，先完成今日复习任务吧！';
      } else {
        message = `今天已做 ${props.todayDone} 题，正确率 ${props.accuracy}%。`;
        if (props.reviewPending > 0) {
          message += `还有 ${props.reviewPending} 道复习等着你。`;
        } else {
          message += '复习任务已清零，真厉害！';
        }
      }
    }
  }

  briefingMessage.value = memoryPrefix ? memoryPrefix + message : message;
  tasks.value = taskList.slice(0, 3); // 最多显示3个任务
  primaryTask.value = taskList[0] || null;
}

/**
 * 异步调用后端 AI 增强简报 — 不阻塞首屏展示
 * 获取真实的掌握度数据和待矫正列表，替换/补充本地规则生成的内容
 */
async function _enrichWithAI() {
  if (aiEnriched.value) return; // 避免重复调用
  loading.value = true;
  try {
    // 动态加载 API 模块（不静态打包进主包）
    const api = await loadStudyApi();
    const { analyzeMastery, getPendingCorrections, getSprintPriority } = api;

    // 基础请求：掌握度 + 待矫正
    const requests = [analyzeMastery(), getPendingCorrections()];

    // 冲刺模式：距考试≤30天时额外请求战略优先级
    const daysLeft = daysToExam.value;
    const isSprintMode = daysLeft > 0 && daysLeft <= 30 && props.examDate;
    if (isSprintMode) {
      requests.push(getSprintPriority(props.examDate));
    }

    const results = await Promise.allSettled(requests);
    const [masteryResult, correctionResult] = results;
    const sprintResult = isSprintMode ? results[2] : null;

    const currentTasks = [...tasks.value];
    let enrichedMessage = briefingMessage.value;

    // ========= 冲刺模式：用后端ROI分析重写任务列表 =========
    if (isSprintMode && sprintResult?.status === 'fulfilled' && sprintResult.value?.data?.items) {
      const sprint = sprintResult.value.data;
      const mustDo = sprint.items.filter((i) => i.priority === 'must_do').slice(0, 2);
      const skipped = sprint.items.filter((i) => i.priority === 'skip');

      // 重写消息为冲刺模式
      enrichedMessage = `距考研仅 ${sprint.daysRemaining} 天！${sprint.strategy}`;

      // 清空现有任务，用冲刺优先级替代
      currentTasks.length = 0;

      // 插入 must_do 知识点
      for (const item of mustDo) {
        currentTasks.push({
          title: `冲刺: ${item.knowledgePoint}`,
          subtitle: `ROI ${item.roi} | 预估${item.estimatedMinutes}分钟 | ${item.reason}`,
          priority: 'urgent',
          action: 'weak-training',
          actionText: '立即开始'
        });
      }

      // 如果有战略放弃的知识点，提示用户
      if (skipped.length > 0) {
        enrichedMessage += ` 建议战略放弃：${skipped.map((s) => s.knowledgePoint).join('、')}。`;
      }

      // 保留复习任务（冲刺阶段复习仍然重要）
      if (props.reviewPending > 0) {
        currentTasks.push({
          title: `复习 ${props.reviewPending} 道到期卡片`,
          subtitle: '冲刺阶段复习不能停',
          priority: 'high',
          action: 'review'
        });
      }
    } else {
      // ========= 非冲刺模式：常规AI增强 =========

      // 用真实的薄弱点数据增强
      if (masteryResult.status === 'fulfilled' && masteryResult.value?.data?.summary) {
        const summary = masteryResult.value.data.summary;
        if (summary.weakestPoint && summary.weakCount > 0) {
          // 在任务列表中插入 AI 薄弱点推荐
          const weakTask = {
            title: `突破薄弱: ${summary.weakestPoint}`,
            subtitle: `${summary.weakCount}个薄弱点，平均掌握度${summary.avgMastery}%`,
            priority: 'high',
            action: 'weak-training',
            actionText: '开始训练'
          };
          // 插入到复习任务之后、普通任务之前
          const insertIdx = currentTasks.findIndex((t) => t.priority === 'normal' || t.priority === 'low');
          if (insertIdx >= 0) {
            currentTasks.splice(insertIdx, 0, weakTask);
          } else {
            currentTasks.push(weakTask);
          }
          // 增强消息
          if (summary.avgMastery < 60) {
            enrichedMessage += ` AI 发现${summary.weakCount}个薄弱知识点需要重点攻克。`;
          }
        }
      }

      // 用真实的待矫正数据增强
      if (correctionResult.status === 'fulfilled' && correctionResult.value?.data?.corrections) {
        const corrections = correctionResult.value.data.corrections;
        if (corrections.length > 0) {
          // 更新已有的 correction 任务，或新增
          const existingIdx = currentTasks.findIndex((t) => t.action === 'correction');
          const correctionTask = {
            title: `AI 诊断: ${corrections.length}个知识点需矫正`,
            subtitle: corrections
              .map((c) => c.knowledge_point || c.knowledgePoint)
              .slice(0, 2)
              .join('、'),
            priority: 'high',
            action: 'correction'
          };
          if (existingIdx >= 0) {
            currentTasks[existingIdx] = correctionTask;
          } else {
            currentTasks.push(correctionTask);
          }
        }
      }
    } // 关闭非冲刺模式的 else 块

    tasks.value = currentTasks.slice(0, 3);
    primaryTask.value = currentTasks[0] || null;
    briefingMessage.value = enrichedMessage;
    aiEnriched.value = true;

    // 保存今日学习记忆（供明天引用）
    _saveTodayMemory(masteryResult);
  } catch (err) {
    // 后端调用失败，静默降级（保持本地规则结果）
    logger.warn('[AIDailyBriefing] AI 增强失败，使用本地规则:', err);
  } finally {
    loading.value = false;
  }
}

/**
 * 保存今日学习摘要到本地存储（供明天 AI 简报引用）
 * 键名按日期分区，最多保留7天记忆
 */
function _saveTodayMemory(masteryResult) {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const memory = {
      date: today,
      questionsCount: props.todayDone,
      accuracy: props.accuracy,
      reviewPending: props.reviewPending,
      weakestPoint: '',
      weakCount: 0
    };
    if (masteryResult?.status === 'fulfilled' && masteryResult.value?.data?.summary) {
      const s = masteryResult.value.data.summary;
      memory.weakestPoint = s.weakestPoint || '';
      memory.weakCount = s.weakCount || 0;
    }
    // 保存到按日期索引的记忆列表
    const memories = storageService.get('ai_learning_memories', {});
    memories[today] = memory;
    // 只保留最近7天
    const keys = Object.keys(memories).sort().reverse();
    if (keys.length > 7) {
      for (const oldKey of keys.slice(7)) {
        delete memories[oldKey];
      }
    }
    storageService.save('ai_learning_memories', memories);
  } catch (_e) {
    // 静默，不影响主流程
  }
}

/**
 * 读取昨天的学习记忆（如果有）
 */
function _loadYesterdayMemory() {
  try {
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const memories = storageService.get('ai_learning_memories', {});
    return memories[yesterday] || null;
  } catch {
    return null;
  }
}

function handleTaskTap(task) {
  if (!task) return;
  switch (task.action) {
    case 'resume':
      emit('resume-session');
      break;
    case 'review':
      emit('go-review');
      break;
    case 'correction':
      emit('go-correction');
      break;
    case 'practice':
      emit('go-practice');
      break;
    case 'weak-training':
      emit('go-weak-training');
      break;
    case 'chat':
      emit('go-chat');
      break;
  }
}
</script>

<style lang="scss" scoped>
.ai-briefing {
  margin: 0 30rpx 24rpx;
  padding: 28rpx;
  border-radius: 28rpx;
  overflow: hidden;
  position: relative;
  /* 渐变边框效果 */
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 4rpx;
    background: linear-gradient(90deg, var(--wise-green, #34d399), var(--info-blue, #06b6d4), var(--purple, #8b5cf6));
    border-radius: 28rpx 28rpx 0 0;
  }
}

.briefing-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20rpx;
}

.briefing-badge {
  display: flex;
  align-items: center;
  background: linear-gradient(
    135deg,
    color-mix(in srgb, var(--wise-green) 15%, transparent),
    color-mix(in srgb, var(--info-blue) 15%, transparent)
  );
  padding: 8rpx 20rpx;
  border-radius: 20rpx;
}

.badge-icon {
  color: var(--wise-green, #34d399);
  margin-right: 8rpx;
}

.badge-text {
  font-size: 24rpx;
  font-weight: 600;
  color: var(--wise-green, #34d399);
}

.briefing-time {
  font-size: 24rpx;
  color: var(--text-sub);
}

.briefing-body {
  margin-bottom: 20rpx;
}

.briefing-message {
  font-size: 30rpx;
  line-height: 1.6;
  color: var(--text-main);
  font-weight: 500;
}

/* 加载动画 */
.briefing-loading {
  display: flex;
  align-items: center;
  padding: 16rpx 0;
}

.loading-dot {
  width: 12rpx;
  height: 12rpx;
  border-radius: 50%;
  background: var(--wise-green, #34d399);
  margin-right: 8rpx;
  animation: dotBounce 1.4s ease-in-out infinite;
}

.loading-dot:nth-child(2) {
  animation-delay: 0.2s;
}
.loading-dot:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes dotBounce {
  0%,
  80%,
  100% {
    opacity: 0.3;
    transform: scale(0.8);
  }
  40% {
    opacity: 1;
    transform: scale(1.2);
  }
}

.loading-text {
  font-size: 26rpx;
  color: var(--text-sub);
  margin-left: 12rpx;
}

/* 任务列表 */
.briefing-tasks {
  margin-bottom: 20rpx;
}

.task-item {
  display: flex;
  align-items: center;
  padding: 18rpx 0;
  border-bottom: 1rpx solid var(--apple-divider);
}

.task-item:last-child {
  border-bottom: none;
}

.ta<REDACTED_SECRET> {
  width: 10rpx;
  height: 10rpx;
  border-radius: 50%;
  margin-right: 16rpx;
  flex-shrink: 0;
}

.ta<REDACTED_SECRET>.urgent {
  background: var(--danger);
}
.ta<REDACTED_SECRET>.high {
  background: var(--warning);
}
.ta<REDACTED_SECRET>.normal {
  background: var(--wise-green, #34d399);
}
.ta<REDACTED_SECRET>.low {
  background: var(--text-tertiary);
}

.task-content {
  flex: 1;
  min-width: 0;
}

.task-title {
  font-size: 28rpx;
  color: var(--text-main);
  font-weight: 500;
}

.ta<REDACTED_SECRET> {
  font-size: 22rpx;
  color: var(--text-sub);
  margin-top: 4rpx;
}

.task-arrow {
  font-size: 32rpx;
  color: var(--text-hint);
  margin-left: 12rpx;
}

/* 一键开始按钮 */
.briefing-action {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 22rpx;
  border-radius: 20rpx;
  background: linear-gradient(135deg, var(--wise-green, #34d399), var(--wise-green-dark, #059669));
  transition: opacity 0.2s;
}

.briefing-action:active {
  opacity: 0.85;
}

.action-icon {
  color: var(--text-inverse);
  margin-right: 10rpx;
}

.action-text {
  font-size: 30rpx;
  font-weight: 600;
  color: var(--text-inverse);
}

/* 暗色模式 */
.ai-briefing.dark {
  .task-item {
    border-bottom-color: rgba(255, 255, 255, 0.08);
  }
}
</style>
