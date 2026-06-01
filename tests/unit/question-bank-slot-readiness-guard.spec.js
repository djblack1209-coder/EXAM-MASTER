import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import { describe, expect, it } from 'vitest';
import QuestionBankPage from '@/pages/practice-sub/question-bank.vue';
import storageService from '@/services/storageService.js';

const source = readFileSync(resolve(process.cwd(), 'src/pages/practice-sub/question-bank.vue'), 'utf8');

describe('question bank slot readiness detail', () => {
  it('keeps selected year slots explicit about status and next action', () => {
    expect(source).toContain('slot-readiness-panel');
    expect(source).toContain('当前状态');
    expect(source).toContain('下一步');
    expect(source).toContain('buildYearSlotReadiness');
    expect(source).toContain('selectedYearSlotReadiness');
    expect(source).toContain('slot-action-disabled');
    expect(source).toContain('整理中，暂不可开始');
    expect(source).toContain('待入库后开放');
  });

  it('keeps the readiness copy user-facing instead of exposing backend workflow terms', () => {
    expect(source).not.toContain('题库发布校验');
    expect(source).not.toContain('答案 hash');
    expect(source).not.toContain('SourceEvidence');
    expect(source).not.toContain('发布链路');
    expect(source).not.toContain('题源');
    expect(source).not.toContain('复核');
  });

  it('shows a blocked but intentional state for unavailable year slots', async () => {
    storageService.save('exam_profile', { tracks: ['politics'] });

    const wrapper = mount(QuestionBankPage, {
      global: {
        stubs: {
          BaseIcon: true
        }
      }
    });
    await nextTick();

    await wrapper.findAll('.year-slot')[0].trigger('tap');
    await nextTick();

    expect(wrapper.find('.year-slot.active .slot-year').text()).toBe('2026');
    expect(wrapper.find('.slot-readiness-panel').exists()).toBe(true);
    expect(wrapper.find('.slot-readiness-panel').classes()).toContain('status-missing');
    expect(wrapper.text()).toContain('资料暂未入库');
    expect(wrapper.text()).toContain('资料入库后开放');
    expect(wrapper.text()).toContain('待入库后开放');
    expect(wrapper.find('.slot-action-disabled').exists()).toBe(true);
    expect(wrapper.find('.slot-action-disabled').attributes('aria-disabled')).toBe('true');
    expect(wrapper.find('.slot-action-disabled').classes()).toContain('muted');

    wrapper.unmount();
  });
});
