import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { readFileSync } from 'node:fs';
import { knowledgeGraphSeed } from '@/services/learning/knowledge-graph-seed.js';
import {
  knowledgeGraphView,
  knowledgeGraphTitle,
  knowledgeNodeDetail,
  knowledgeGraphSvg
} from '@/services/learning/knowledge-graph-view.js';
import Knowledge from '@/pages/learning/knowledge.vue';
import { safeNavigateTo } from '@/utils/safe-navigate.js';
vi.mock('@/utils/safe-navigate.js', () => ({ safeNavigateTo: vi.fn() }));
afterEach(() => vi.unstubAllGlobals());
vi.mock('@dcloudio/uni-app', () => ({ onLoad: vi.fn(), onResize: vi.fn(), onShow: vi.fn() }));
const button = {
  props: ['label', 'disabled', 'selected'],
  emits: ['tap'],
  template: '<button :aria-label="label" :disabled="disabled" @click="$emit(\'tap\')"><slot /></button>'
};
beforeEach(() => {
  setActivePinia(createPinia());
});
describe('只读知识框架验证版', () => {
  it('完整保留 26 节点/36 边，七个能力域与带写域；390/1090 节点均在画布内', () => {
    for (const width of [358, 702]) {
      const graph = knowledgeGraphView(knowledgeGraphSeed, width);
      expect(graph.nodes).toHaveLength(26);
      expect(graph.edges).toHaveLength(36);
      expect(graph.groups.map((group) => group.name)).toEqual([
        '审题',
        '结构',
        '句式',
        '语法',
        '表达',
        '论证',
        '检查',
        '带写'
      ]);
      for (const node of graph.nodes) {
        expect(node.x).toBeGreaterThanOrEqual(0);
        expect(node.x + node.width).toBeLessThanOrEqual(width);
        expect(node.y + node.height).toBeLessThanOrEqual(graph.height);
        expect(node.status).toBe('insufficient');
        expect(node.statusLabel).toBe('数据不足');
      }
    }
  });
  it('hard 实线、soft 虚线、方向箭头，深浅色适配且选择突出相关边', () => {
    const graph = knowledgeGraphView(knowledgeGraphSeed);
    const svg = knowledgeGraphSvg(graph);
    const local = graph.edges.filter(
      (edge) =>
        graph.nodes.find((node) => node.id === edge.from).chapter ===
        graph.nodes.find((node) => node.id === edge.to).chapter
    );
    expect(svg.match(/marker-end=/g)).toHaveLength(local.length);
    for (const edge of graph.edges) {
      expect(svg.includes(`data-from="${edge.from}" data-to="${edge.to}"`)).toBe(local.includes(edge));
    }
    expect(svg).not.toMatch(/ C[\d.]/);
    expect(knowledgeGraphSvg(graph, true)).toContain('#a7aaad');
    const selected = knowledgeGraphSvg(graph, false, 'task');
    expect(selected).toContain('opacity="0.95"');
    expect(selected).toContain('opacity="0.12"');
    expect(selected).toContain('data-from="task" data-to="revision-task"');
    expect(selected).not.toContain('data-from="collocation" data-to="translation"');
    expect(graph.edges).toHaveLength(36);
    const soft = knowledgeGraphSvg(graph, false, 'collocation');
    expect(soft).toContain('data-strength="soft"');
    expect(soft).toContain('stroke-dasharray="5 4"');
  });
  it('uses explicit framework subject metadata and falls back without guessing unknown subjects', () => {
    expect(knowledgeGraphTitle(knowledgeGraphSeed)).toBe('考研英语写作 · 知识框架');
    for (const seed of [null, {}, { subject: 'unknown' }, { subjectLabel: '  ' }])
      expect(knowledgeGraphTitle(seed)).toBe('知识框架');
    expect(knowledgeGraphTitle({ subject: '数学', subjectLabel: '数学' })).toBe('数学 · 知识框架');
  });
  it.each([358, 680])('framework arrows never pass through unrelated cards at width %i', (width) => {
    const graph = knowledgeGraphView(knowledgeGraphSeed, width);
    const svg = new DOMParser().parseFromString(knowledgeGraphSvg(graph), 'image/svg+xml');
    for (const path of svg.querySelectorAll('path[data-from]')) {
      const tokens = path.getAttribute('d').match(/[MHV]|-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/gi);
      let x = 0,
        y = 0;
      for (let i = 0; i < tokens.length;) {
        const command = tokens[i++];
        const nx = command === 'V' ? x : Number(tokens[i++]);
        const ny = command === 'H' ? y : Number(tokens[i++]);
        if (command !== 'M') {
          for (const node of graph.nodes.filter(
            (node) => ![path.getAttribute('data-from'), path.getAttribute('data-to')].includes(node.id)
          )) {
            const crosses =
              x === nx
                ? x > node.x &&
                  x < node.x + node.width &&
                  Math.max(y, ny) > node.y &&
                  Math.min(y, ny) < node.y + node.height
                : y > node.y &&
                  y < node.y + node.height &&
                  Math.max(x, nx) > node.x &&
                  Math.min(x, nx) < node.x + node.width;
            expect(
              crosses,
              `${path.getAttribute('data-from')}→${path.getAttribute('data-to')} crosses ${node.id}`
            ).toBe(false);
          }
        }
        x = nx;
        y = ny;
      }
    }
  });
  it('详情仅投影标准、提示与先修，不输出答案、评分规则、降阶题和选项', () => {
    const seedBefore = JSON.stringify(knowledgeGraphSeed);
    const graph = knowledgeGraphView(knowledgeGraphSeed);
    const detail = knowledgeNodeDetail(graph, 'translation');
    expect(detail.prerequisites.map((edge) => edge.from)).toEqual(['sentence', 'collocation']);
    expect(detail.diagnosticPrompt).toBeTruthy();
    expect(JSON.stringify(graph)).not.toMatch(/answerIndex|rubric|lowered|options|make progress/);
    expect(knowledgeNodeDetail(graph, 'missing')).toBeNull();
    expect(knowledgeGraphView(null).nodes).toEqual([]);
    for (const node of graph.nodes) {
      expect(node.masteryCriteria).not.toEqual(
        knowledgeGraphSeed.topics.find((topic) => topic.id === node.id).masteryCriteria
      );
    }
    expect(JSON.stringify(knowledgeGraphSeed)).toBe(seedBefore);
  });
  it('节点点击与先修跳转更新详情，空详情及禁用诊断可见，不写学习事实', async () => {
    const source = readFileSync('src/pages/learning/knowledge.vue', 'utf8');
    const service = readFileSync('src/services/learning/knowledge-graph-view.js', 'utf8');
    expect(source + service).not.toMatch(/\bdiagnose\(|setStorage|\.commit\(|\.api|fsrs/i);
    const wrapper = mount(Knowledge, { global: { stubs: { BaseButton: button } } });
    expect(wrapper.findAll('[data-node-id]')).toHaveLength(26);
    expect(wrapper.text()).toContain('选择一个能力节点');
    await wrapper.get('[data-node-id="translation"]').trigger('click');
    await flushPromises();
    expect(wrapper.get('#knowledge-detail').text()).toContain('短句意义转写');
    expect(wrapper.get('#knowledge-detail').text()).toContain('暂无记录 · 待审核');
    expect(wrapper.get('[aria-label="查看先修：构造完整句"]').exists()).toBe(true);
    await wrapper.get('[aria-label="查看先修：构造完整句"]').trigger('click');
    expect(wrapper.get('#knowledge-detail').text()).toContain('无先修关系');
    expect(wrapper.get('.diagnosis-pending').attributes('disabled')).toBeDefined();
    wrapper.unmount();
  });
  it('直接打开时返回洞察，正常页面栈返回原入口；对话出口可用', async () => {
    const wrapper = mount(Knowledge, { global: { stubs: { BaseButton: button } } });
    vi.stubGlobal('getCurrentPages', () => [{}]);
    await wrapper.get('[aria-label="返回洞察或资料库"]').trigger('click');
    expect(safeNavigateTo).toHaveBeenCalledWith('/pages/archive/index?view=phrases');
    vi.stubGlobal('getCurrentPages', () => [{}, {}]);
    await wrapper.get('[aria-label="返回洞察或资料库"]').trigger('click');
    expect(uni.navigateBack).toHaveBeenCalled();
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '回到对话')
      .trigger('click');
    expect(safeNavigateTo).toHaveBeenCalledWith('/pages/learning/index');
    wrapper.unmount();
  });
  it('两个入口都指向分包页面，无新增主导航', () => {
    for (const path of ['muse-saved-library.vue', 'muse-library.vue']) {
      expect(readFileSync(`src/components/business/learning/${path}`, 'utf8')).toContain(
        "safeNavigateTo('/pages/learning/knowledge')"
      );
    }
    const pages = JSON.parse(readFileSync('src/pages.json', 'utf8'));
    expect(
      pages.subPackages.find((group) => group.root === 'pages/learning').pages.some((page) => page.path === 'knowledge')
    ).toBe(true);
    expect(pages.pages.some((page) => page.path === 'pages/learning/knowledge')).toBe(false);
  });
});
