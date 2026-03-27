/**
 * useStyleOnboarding — 学习风格引导（首次使用3步配置）
 * 从 index/index.vue 提取的 Onboarding 步骤逻辑
 */
import { ref } from 'vue';
import { storageService } from '@/services/storageService.js';
import { toast } from '@/utils/toast.js';
import { DEPTH_LEVELS, TONE_OPTIONS } from '@/composables/useLearningStyle.js';

export function useStyleOnboarding() {
  const showStyleOnboarding = ref(false);
  const onboardingStep = ref(1);
  const obTargetScore = ref(350);
  const obDepth = ref('standard');
  const obTone = ref('encouraging');
  // 静态配置数据
  const styleDepths = DEPTH_LEVELS;
  const styleTones = TONE_OPTIONS;

  /**
   * 检查是否需要显示 onboarding（未配置学习风格 且 非新用户）
   */
  function checkShowOnboarding(isNewUser) {
    try {
      const config = storageService.get('learning_style_config');
      if (!config && !isNewUser) {
        showStyleOnboarding.value = true;
      }
    } catch (_e) {
      /* silent */
    }
  }

  /**
   * 进入下一步或完成配置
   */
  function nextOnboardingStep() {
    if (onboardingStep.value < 3) {
      onboardingStep.value++;
      return;
    }
    // 完成：保存配置
    storageService.save('learning_style_config', {
      depth: obDepth.value,
      style: 'example',
      tone: obTone.value,
      targetScore: obTargetScore.value,
      weakSubjects: []
    });
    showStyleOnboarding.value = false;
    toast.info('AI已为你个性化配置');
  }

  return {
    // 响应式状态
    showStyleOnboarding,
    onboardingStep,
    obTargetScore,
    obDepth,
    obTone,
    styleDepths,
    styleTones,
    // 方法
    checkShowOnboarding,
    nextOnboardingStep
  };
}
