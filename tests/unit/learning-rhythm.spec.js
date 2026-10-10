import { describe, it, expect, beforeEach } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { currentRhythm, rhythmOperations } from '@/services/learning/learning-rhythm.js';
import { useConversationLearningStore } from '@/stores/modules/conversation-learning.js';
import { effectiveGrade } from '@/services/learning/learning-domain.js';

beforeEach(() => {
  uni.clearStorageSync();
  setActivePinia(createPinia());
});
describe('可跳过的学习节奏与真实学习事实', () => {
  it('不选节奏也能开始；选择记录为自述并改变方法，不增加作答或能力判断', () => {
    const store = useConversationLearningStore();
    store.start('12 + 8');
    expect(currentRhythm(store.state.profile, store.selectedConversationId)).toBeNull();
    store.setRhythm('gentle');
    expect(store.state.strategy.method).toBe('steps');
    expect(store.state.profile.at(-1)).toMatchObject({ source: 'self_report', field: 'preference', value: '慢慢理解' });
    expect(store.summary.validAnswers).toBe(0);
    expect(store.summary.knowledge).toEqual({});
    store.refresh();
    expect(currentRhythm(store.state.profile, store.selectedConversationId)).toBe('gentle');
    store.setRhythm('focus');
    expect(store.state.strategy.method).toBe('check');
  });
  it('复习节奏回到实际错题，保留原始错误、复测类型和首次口径', () => {
    const store = useConversationLearningStore();
    store.start('12 + 8');
    store.submit('19', true, 'first-answer');
    store.setRhythm('review');
    expect(store.activeQuestion.prompt).toContain('12 + 8');
    const attempt = store.submit('20', true, 'review-answer');
    expect(attempt.kind).toBe('review');
    expect(effectiveGrade(attempt).outcome).toBe('correct');
    expect(store.summary.first).toMatchObject({ denominator: 1, numerator: 1 });
    expect(store.state.attempts[0].answer).toBe('19');
  });
  it('未知节奏、忙碌状态不能写入；复习无题如实返回而不造题', () => {
    const store = useConversationLearningStore();
    expect(() => rhythmOperations('untrusted-instruction')).toThrow('有效');
    store.busy = true;
    expect(() => store.setRhythm('focus')).toThrow('取消');
    expect(store.state.profile).toHaveLength(0);
    store.busy = false;
    expect(store.setRhythm('review')).toEqual({ focused: false });
    expect(store.state.questions).toHaveLength(0);
    expect(store.state.conversations).toHaveLength(0);
  });
  it('下一段偏好可继承，指定对话的自述不泄漏成其他对话画像', () => {
    const profile = [
      { field: 'preference', source: 'self_report', scope: '下一段学习', value: '专注推进' },
      { field: 'preference', source: 'self_report', scope: '对话 c1', value: '慢慢理解' },
      { field: 'preference', source: 'inferred', scope: '对话 c2', value: '巩固复习' }
    ];
    expect(currentRhythm(profile, 'c1')).toBe('gentle');
    expect(currentRhythm(profile, 'c1', 'check')).toBeNull();
    expect(currentRhythm(profile, 'c2')).toBe('focus');
  });
});
