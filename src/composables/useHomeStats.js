/**
 * useHomeStats — 首页统计数据加载
 * 从 index/index.vue 提取的统计刷新、成就加载、活动历史、热力图逻辑
 */
import { ref } from 'vue';
import { storageService } from '@/services/storageService.js';
import { formatRelativeTime } from '@/utils/formatters.js';

export function useHomeStats({ studyStore } = {}) {
  // 统计数据（从 computed 移到 ref，避免每次渲染重复读取 storageService）
  const realTotalQuestions = ref(0);
  const realAccuracy = ref(0);
  const realStudyDays = ref(0);
  const todayQuestionCount = ref(0);
  const achievementCount = ref(0);
  const recentActivities = ref([]);
  const heatmapData = ref({});

  /**
   * 集中更新统计数据 — 使用 count 元数据，不再反序列化整个题库
   */
  function refreshStats() {
    try {
      // 优先读取轻量 count 元数据，避免反序列化整个题库数组
      const cachedCount = storageService.get('v30_bank_count', -1);
      if (cachedCount >= 0) {
        realTotalQuestions.value = cachedCount;
      } else {
        // 首次或元数据丢失时回退到完整读取，并缓存 count
        const questionBank = storageService.get('v30_bank', []);
        realTotalQuestions.value = Array.isArray(questionBank) ? questionBank.length : 0;
        storageService.save('v30_bank_count', realTotalQuestions.value);
      }
    } catch (_e) {
      realTotalQuestions.value = 0;
    }

    try {
      const store = studyStore?.value || studyStore;
      const storeAccuracy = parseFloat(store?.accuracy || 0);
      if (storeAccuracy > 0) {
        realAccuracy.value = storeAccuracy;
      } else {
        const studyRecord = storageService.get('study_record', {});
        const correct = studyRecord.correctCount || 0;
        const total = studyRecord.totalAnswered || 0;
        realAccuracy.value = total === 0 ? 0 : Math.round((correct / total) * 100);
      }
    } catch (_e) {
      realAccuracy.value = 0;
    }

    try {
      const store = studyStore?.value || studyStore;
      const storeDays = store?.studyProgress?.studyDays || 0;
      if (storeDays > 0) {
        realStudyDays.value = storeDays;
      } else {
        const studyDates = storageService.get('study_dates', []);
        realStudyDays.value = Array.isArray(studyDates) ? studyDates.length : 0;
      }
    } catch (_e) {
      realStudyDays.value = 0;
    }

    // 今日答题数（用于每日目标进度环）
    try {
      const today = new Date().toISOString().split('T')[0];
      const todayAnswerDate = uni.getStorageSync('today_answer_date') || '';
      const todayAnswerCount = parseInt(uni.getStorageSync('today_answer_count') || '0');
      if (todayAnswerDate === today) {
        todayQuestionCount.value = todayAnswerCount;
      } else {
        // 降级：尝试旧格式
        const todayRecord = storageService.get('today_answer_count', { date: '', count: 0 });
        todayQuestionCount.value = todayRecord.date === today ? todayRecord.count || 0 : 0;
      }
    } catch (_e) {
      todayQuestionCount.value = 0;
    }
  }

  /**
   * 加载成就数量
   */
  function loadAchievements() {
    const achievements = storageService.get('learning_achievements', []);
    achievementCount.value = Array.isArray(achievements) ? achievements.length : 0;
  }

  /**
   * 加载最近学习活动
   */
  function loadRecentActivities() {
    const store = studyStore?.value || studyStore;
    const history = store?.questionHistory || [];

    if (history.length > 0) {
      recentActivities.value = history.slice(0, 4).map((record) => ({
        title: `练习：${record.questionType || '综合题'}`,
        subtitle: record.isCorrect ? '答对，继续保持' : '答错，已加入错题本',
        time: formatRelativeTime(record.timestamp),
        icon: record.isCorrect ? 'check' : 'cross',
        status: record.isCorrect ? 'completed' : 'in-progress'
      }));
    } else {
      // 默认活动
      recentActivities.value = [
        { title: '开始学习', subtitle: '欢迎使用Exam-Master', time: '刚刚', icon: 'celebrate', status: 'completed' }
      ];
    }
  }

  /**
   * 加载学习热力图数据
   */
  function loadHeatmapData() {
    try {
      // 优先读取 study_stats（do-quiz 每次答题写入的）
      const studyStats = storageService.get('study_stats', {});
      if (studyStats && typeof studyStats === 'object' && Object.keys(studyStats).length > 0) {
        heatmapData.value = studyStats;
        return;
      }
      // 降级：尝试其他可能的键名
      const studyRecords =
        storageService.get('study_daily_records', {}) || storageService.get('daily_study_records', {});
      if (studyRecords && typeof studyRecords === 'object' && Object.keys(studyRecords).length > 0) {
        heatmapData.value = studyRecords;
        return;
      }
      // 最终降级：从题库答题记录构建
      const bank = storageService.get('v30_bank', []);
      const heatmap = {};
      bank.forEach((q) => {
        const ts = q.last_attempt_at || q.updated_at;
        if (ts) {
          const date = new Date(ts);
          const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
          heatmap[key] = (heatmap[key] || 0) + 1;
        }
      });
      heatmapData.value = heatmap;
    } catch (_e) {
      heatmapData.value = {};
    }
  }

  return {
    // 响应式状态
    realTotalQuestions,
    realAccuracy,
    realStudyDays,
    todayQuestionCount,
    achievementCount,
    recentActivities,
    heatmapData,
    // 方法
    refreshStats,
    loadAchievements,
    loadRecentActivities,
    loadHeatmapData
  };
}
