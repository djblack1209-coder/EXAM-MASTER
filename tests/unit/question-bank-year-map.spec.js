import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import { describe, expect, it } from 'vitest';
import QuestionBankPage from '@/pages/practice-sub/question-bank.vue';
import storageService from '@/services/storageService.js';
import { getPracticeNavigationTree } from '@/config/bank-registry.js';

const source = readFileSync(resolve(process.cwd(), 'src/pages/practice-sub/question-bank.vue'), 'utf8');

describe('question bank public-course year map', () => {
  it('renders the full release-scope year map with trustworthy slot states', () => {
    expect(source).toContain('2005-2026 整卷真题地图');
    expect(source).toContain('selectedYearSlots');
    expect(source).toContain('selectedYearSlot.clickable');
    expect(source).toContain('loadAndStartSlot');
    expect(source).toContain('status-organizing');
    expect(source).toContain('status-missing');
    expect(source).toContain('selectedYearSlot.disabledReason');
    expect(source).toContain('const organizingCount');
    expect(source).toContain('正式 ${ready} · 整理中 ${organizing} · 待入库 ${missing}');
  });

  it('keeps every track on the 2005-2026 map and marks verified banks as clickable', () => {
    const tree = getPracticeNavigationTree({ tracks: ['english2', 'math1', 'math2', 'math3'] });
    const tracks = tree.flatMap((subject) => subject.tracks);

    for (const track of tracks) {
      expect(track.yearSlots).toHaveLength(22);
      expect(track.yearSlots[0].year).toBe('2026');
      expect(track.yearSlots.at(-1).year).toBe('2005');
    }

    const english2 = tracks.find((track) => track.id === 'english2');
    expect(english2.slotSummary).toEqual({ total: 22, ready: 1, organizing: 0, missing: 21 });
    expect(english2.yearSlots.find((slot) => slot.year === '2025')).toMatchObject({
      bankId: 'english2-2025',
      status: 'ready',
      statusLabel: '正式',
      actionLabel: '开始',
      clickable: true
    });

    const math1 = tracks.find((track) => track.id === 'math1');
    expect(math1.slotSummary).toEqual({ total: 22, ready: 1, organizing: 0, missing: 21 });
    expect(math1.yearSlots.find((slot) => slot.year === '2025')).toMatchObject({
      bankId: 'math1-2025',
      status: 'ready',
      statusLabel: '正式',
      actionLabel: '开始',
      clickable: true
    });

    const math2 = tracks.find((track) => track.id === 'math2');
    expect(math2.slotSummary).toEqual({ total: 22, ready: 1, organizing: 0, missing: 21 });
    expect(math2.yearSlots.find((slot) => slot.year === '2025')).toMatchObject({
      bankId: 'math2-2025',
      status: 'ready',
      statusLabel: '正式',
      actionLabel: '开始',
      clickable: true
    });

    const math3 = tracks.find((track) => track.id === 'math3');
    expect(math3.slotSummary).toEqual({ total: 22, ready: 2, organizing: 0, missing: 20 });
    expect(math3.yearSlots.find((slot) => slot.year === '2025')).toMatchObject({
      bankId: 'math3-2025',
      status: 'ready',
      statusLabel: '正式',
      actionLabel: '开始',
      clickable: true
    });
    expect(math3.yearSlots.find((slot) => slot.year === '2005')).toMatchObject({
      bankId: 'math3-2005',
      status: 'ready',
      statusLabel: '正式',
      actionLabel: '开始',
      clickable: true
    });
  });

  it('defaults a track with a verified bank to its newest ready slot', async () => {
    storageService.save('exam_profile', { tracks: ['english2'] });

    const wrapper = mount(QuestionBankPage, {
      global: {
        stubs: {
          BaseIcon: true
        }
      }
    });
    await nextTick();

    expect(wrapper.text()).toContain('2025考研英语二真题');
    expect(wrapper.text()).toContain('正式 1 · 整理中 0 · 待入库 21');
    expect(wrapper.find('.year-slot.active .slot-year').text()).toBe('2025');

    wrapper.unmount();
  });

  it('shows the cleaned politics papers as ready and keeps missing years blocked', () => {
    const tree = getPracticeNavigationTree({ tracks: ['politics'] });
    const politics = tree[0].tracks[0];

    expect(politics.slotSummary).toEqual({ total: 22, ready: 20, organizing: 0, missing: 2 });
    expect(politics.yearSlots.find((slot) => slot.year === '2025')).toMatchObject({
      bankId: 'politics-2025',
      status: 'ready',
      actionLabel: '开始',
      clickable: true
    });
    expect(politics.yearSlots.find((slot) => slot.year === '2024')).toMatchObject({
      bankId: 'politics-2024',
      status: 'ready',
      actionLabel: '开始',
      clickable: true
    });
    expect(politics.yearSlots.find((slot) => slot.year === '2018')).toMatchObject({
      bankId: 'politics-2018',
      status: 'ready',
      actionLabel: '开始',
      clickable: true
    });
    expect(politics.yearSlots.find((slot) => slot.year === '2019')).toMatchObject({
      bankId: 'politics-2019',
      status: 'ready',
      actionLabel: '开始',
      clickable: true
    });
    expect(politics.yearSlots.find((slot) => slot.year === '2020')).toMatchObject({
      bankId: 'politics-2020',
      status: 'ready',
      actionLabel: '开始',
      clickable: true
    });
    expect(politics.yearSlots.find((slot) => slot.year === '2021')).toMatchObject({
      bankId: 'politics-2021',
      status: 'ready',
      actionLabel: '开始',
      clickable: true
    });
    expect(politics.yearSlots.find((slot) => slot.year === '2022')).toMatchObject({
      bankId: 'politics-2022',
      status: 'ready',
      actionLabel: '开始',
      clickable: true
    });
    expect(politics.yearSlots.find((slot) => slot.year === '2005')).toMatchObject({
      bankId: 'politics-2005',
      status: 'ready',
      actionLabel: '开始',
      clickable: true
    });
    expect(politics.yearSlots.find((slot) => slot.year === '2006')).toMatchObject({
      bankId: 'politics-2006',
      status: 'ready',
      actionLabel: '开始',
      clickable: true
    });
    expect(politics.yearSlots.find((slot) => slot.year === '2007')).toMatchObject({
      bankId: 'politics-2007',
      status: 'ready',
      actionLabel: '开始',
      clickable: true
    });
    expect(politics.yearSlots.find((slot) => slot.year === '2008')).toMatchObject({
      bankId: 'politics-2008',
      status: 'ready',
      actionLabel: '开始',
      clickable: true
    });
    expect(politics.yearSlots.find((slot) => slot.year === '2009')).toMatchObject({
      bankId: 'politics-2009',
      status: 'ready',
      actionLabel: '开始',
      clickable: true
    });
    expect(politics.yearSlots.find((slot) => slot.year === '2010')).toMatchObject({
      bankId: 'politics-2010',
      status: 'ready',
      actionLabel: '开始',
      clickable: true
    });
    expect(politics.yearSlots.find((slot) => slot.year === '2011')).toMatchObject({
      bankId: 'politics-2011',
      status: 'ready',
      actionLabel: '开始',
      clickable: true
    });
    expect(politics.yearSlots.find((slot) => slot.year === '2012')).toMatchObject({
      bankId: 'politics-2012',
      status: 'ready',
      actionLabel: '开始',
      clickable: true
    });
    expect(politics.yearSlots.find((slot) => slot.year === '2013')).toMatchObject({
      bankId: 'politics-2013',
      status: 'ready',
      actionLabel: '开始',
      clickable: true
    });
    expect(politics.yearSlots.find((slot) => slot.year === '2014')).toMatchObject({
      bankId: 'politics-2014',
      status: 'ready',
      actionLabel: '开始',
      clickable: true
    });
    expect(politics.yearSlots.find((slot) => slot.year === '2015')).toMatchObject({
      bankId: 'politics-2015',
      status: 'ready',
      actionLabel: '开始',
      clickable: true
    });
    expect(politics.yearSlots.find((slot) => slot.year === '2016')).toMatchObject({
      bankId: 'politics-2016',
      status: 'ready',
      actionLabel: '开始',
      clickable: true
    });
    expect(politics.yearSlots.find((slot) => slot.year === '2017')).toMatchObject({
      bankId: 'politics-2017',
      status: 'ready',
      actionLabel: '开始',
      clickable: true
    });
    expect(politics.yearSlots.find((slot) => slot.year === '2023')).toMatchObject({
      status: 'missing',
      clickable: false
    });
  });

  it('shows verified formal banks as clickable in the operator-facing summary', async () => {
    storageService.save('exam_profile', { tracks: ['english1'] });

    const wrapper = mount(QuestionBankPage, {
      global: {
        stubs: {
          BaseIcon: true
        }
      }
    });
    await nextTick();

    expect(wrapper.text()).toContain('11');
    expect(wrapper.text()).toContain('正式');
    expect(wrapper.text()).toContain('0');
    expect(wrapper.text()).toContain('整理中');
    expect(wrapper.text()).toContain('正式 11 · 整理中 0 · 待入库 11');

    wrapper.unmount();
  });
});
