/**
 * 新用户引导流程管理
 * 解决检查点1.1：新用户冷启动路径断裂问题
 * 
 * 功能：
 * 1. 引导步骤管理
 * 2. 进度追踪
 * 3. 事件埋点
 * 4. 状态持久化
 */

// ✅ 检查点 5.1: 导入分析服务
import { analytics } from './analytics/event-bus-analytics.js';

// 引导步骤定义
const ONBOARDING_STEPS = {
  WELCOME: 'welcome',           // 欢迎页
  UPLOAD_GUIDE: 'upload_guide', // 上传引导
  FIRST_UPLOAD: 'first_upload', // 首次上传
  FIRST_PRACTICE: 'first_practice', // 首次练习
  FIRST_REVIEW: 'first_review', // 首次复习
  COMPLETED: 'completed'        // 完成引导
};

// 引导流程配置
const ONBOARDING_CONFIG = {
  // 各步骤的提示信息
  tips: {
    [ONBOARDING_STEPS.WELCOME]: {
      title: '欢迎使用 Exam-Master',
      content: '让 AI 帮你高效备考',
      action: '开始体验'
    },
    [ONBOARDING_STEPS.UPLOAD_GUIDE]: {
      title: '上传学习资料',
      content: '支持 PDF、Word、图片等格式',
      action: '去上传'
    },
    [ONBOARDING_STEPS.FIRST_UPLOAD]: {
      title: '资料上传成功',
      content: 'AI 正在为你生成题库...',
      action: '查看题库'
    },
    [ONBOARDING_STEPS.FIRST_PRACTICE]: {
      title: '开始你的第一次练习',
      content: '答错的题目会自动加入错题本',
      action: '开始练习'
    },
    [ONBOARDING_STEPS.FIRST_REVIEW]: {
      title: '复习错题',
      content: '及时复习，巩固记忆',
      action: '去复习'
    },
    [ONBOARDING_STEPS.COMPLETED]: {
      title: '引导完成',
      content: '你已掌握基本操作，开始学习吧！',
      action: '完成'
    }
  },
  
  // 步骤顺序
  stepOrder: [
    ONBOARDING_STEPS.WELCOME,
    ONBOARDING_STEPS.UPLOAD_GUIDE,
    ONBOARDING_STEPS.FIRST_UPLOAD,
    ONBOARDING_STEPS.FIRST_PRACTICE,
    ONBOARDING_STEPS.FIRST_REVIEW,
    ONBOARDING_STEPS.COMPLETED
  ]
};

// 存储键名
const STORAGE_KEYS = {
  CURRENT_STEP: 'onboarding_current_step',
  COMPLETED_STEPS: 'onboarding_completed_steps',
  EVENTS: 'onboarding_events',
  IS_NEW_USER: 'is_new_user',
  FIRST_VISIT_TIME: 'first_visit_time'
};

/**
 * 引导流程管理类
 */
class OnboardingFlow {
  constructor() {
    this.currentStep = null;
    this.completedSteps = [];
    this.events = [];
    this.isInitialized = false;
  }
  
  /**
   * 初始化引导流程
   */
  init() {
    if (this.isInitialized) return;
    
    try {
      // 恢复状态
      this.currentStep = uni.getStorageSync(STORAGE_KEYS.CURRENT_STEP) || ONBOARDING_STEPS.WELCOME;
      this.completedSteps = uni.getStorageSync(STORAGE_KEYS.COMPLETED_STEPS) || [];
      this.events = uni.getStorageSync(STORAGE_KEYS.EVENTS) || [];
      
      // 检查是否是新用户
      const firstVisitTime = uni.getStorageSync(STORAGE_KEYS.FIRST_VISIT_TIME);
      if (!firstVisitTime) {
        uni.setStorageSync(STORAGE_KEYS.FIRST_VISIT_TIME, Date.now());
        uni.setStorageSync(STORAGE_KEYS.IS_NEW_USER, true);
      }
      
      this.isInitialized = true;
      console.log('[OnboardingFlow] 初始化完成，当前步骤:', this.currentStep);
    } catch (e) {
      console.error('[OnboardingFlow] 初始化失败:', e);
    }
  }
  
  /**
   * 检查是否是新用户
   */
  isNewUser() {
    const isNew = uni.getStorageSync(STORAGE_KEYS.IS_NEW_USER);
    const questionBank = uni.getStorageSync('v30_bank') || [];
    return isNew === true && questionBank.length === 0;
  }
  
  /**
   * 获取当前步骤
   */
  getCurrentStep() {
    this.init();
    return this.currentStep;
  }
  
  /**
   * 获取当前步骤的提示信息
   */
  getCurrentTip() {
    this.init();
    return ONBOARDING_CONFIG.tips[this.currentStep] || null;
  }
  
  /**
   * 完成当前步骤，进入下一步
   */
  completeStep(step) {
    this.init();
    
    const stepToComplete = step || this.currentStep;
    
    // 添加到已完成列表
    if (!this.completedSteps.includes(stepToComplete)) {
      this.completedSteps.push(stepToComplete);
      uni.setStorageSync(STORAGE_KEYS.COMPLETED_STEPS, this.completedSteps);
    }
    
    // 计算下一步
    const currentIndex = ONBOARDING_CONFIG.stepOrder.indexOf(stepToComplete);
    const nextIndex = currentIndex + 1;
    
    if (nextIndex < ONBOARDING_CONFIG.stepOrder.length) {
      this.currentStep = ONBOARDING_CONFIG.stepOrder[nextIndex];
    } else {
      this.currentStep = ONBOARDING_STEPS.COMPLETED;
      // 标记为非新用户
      uni.setStorageSync(STORAGE_KEYS.IS_NEW_USER, false);
    }
    
    uni.setStorageSync(STORAGE_KEYS.CURRENT_STEP, this.currentStep);
    
    // 记录事件
    this.trackEvent('step_completed', { step: stepToComplete, nextStep: this.currentStep });
    
    console.log('[OnboardingFlow] 步骤完成:', stepToComplete, '-> 下一步:', this.currentStep);
    
    return this.currentStep;
  }
  
  /**
   * 跳过引导
   */
  skipOnboarding() {
    this.init();
    
    this.currentStep = ONBOARDING_STEPS.COMPLETED;
    uni.setStorageSync(STORAGE_KEYS.CURRENT_STEP, this.currentStep);
    uni.setStorageSync(STORAGE_KEYS.IS_NEW_USER, false);
    
    this.trackEvent('onboarding_skipped', { skippedAt: this.currentStep });
    
    console.log('[OnboardingFlow] 引导已跳过');
  }
  
  /**
   * 重置引导流程
   */
  reset() {
    this.currentStep = ONBOARDING_STEPS.WELCOME;
    this.completedSteps = [];
    this.events = [];
    
    uni.setStorageSync(STORAGE_KEYS.CURRENT_STEP, this.currentStep);
    uni.setStorageSync(STORAGE_KEYS.COMPLETED_STEPS, this.completedSteps);
    uni.setStorageSync(STORAGE_KEYS.EVENTS, this.events);
    uni.setStorageSync(STORAGE_KEYS.IS_NEW_USER, true);
    
    console.log('[OnboardingFlow] 引导已重置');
  }
  
  /**
   * 检查步骤是否已完成
   */
  isStepCompleted(step) {
    this.init();
    return this.completedSteps.includes(step);
  }
  
  /**
   * 获取引导进度百分比
   */
  getProgress() {
    this.init();
    const totalSteps = ONBOARDING_CONFIG.stepOrder.length - 1; // 不包括 COMPLETED
    const completedCount = this.completedSteps.filter(
      s => s !== ONBOARDING_STEPS.COMPLETED
    ).length;
    return Math.round((completedCount / totalSteps) * 100);
  }
  
  /**
   * 记录事件（埋点）
   */
  trackEvent(eventName, data = {}) {
    const event = {
      name: eventName,
      data,
      timestamp: Date.now(),
      step: this.currentStep
    };
    
    this.events.push(event);
    
    // 限制事件数量，避免存储过大
    if (this.events.length > 100) {
      this.events = this.events.slice(-50);
    }
    
    uni.setStorageSync(STORAGE_KEYS.EVENTS, this.events);
    
    console.log('[OnboardingFlow] 事件记录:', eventName, data);
    
    // ✅ 检查点 5.1: 接入实际的埋点服务
    analytics.track(eventName, { ...data, step: this.currentStep });
  }
  
  /**
   * 获取所有事件记录
   */
  getEvents() {
    this.init();
    return this.events;
  }
  
  /**
   * 显示引导提示
   */
  showTip(options = {}) {
    const tip = this.getCurrentTip();
    if (!tip) return;
    
    const { onConfirm, onCancel } = options;
    
    uni.showModal({
      title: tip.title,
      content: tip.content,
      confirmText: tip.action,
      cancelText: '稍后',
      success: (res) => {
        if (res.confirm) {
          this.trackEvent('tip_confirmed', { step: this.currentStep });
          onConfirm && onConfirm(this.currentStep);
        } else {
          this.trackEvent('tip_cancelled', { step: this.currentStep });
          onCancel && onCancel(this.currentStep);
        }
      }
    });
  }
  
  /**
   * 获取引导步骤常量
   */
  get STEPS() {
    return ONBOARDING_STEPS;
  }
}

// 导出单例
export const onboardingFlow = new OnboardingFlow();

// 导出步骤常量
export { ONBOARDING_STEPS };

// 默认导出
export default onboardingFlow;
