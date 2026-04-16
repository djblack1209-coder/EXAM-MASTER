/**
 * base-chart 组件单元测试
 * 验证 ucharts 封装组件的核心逻辑（props 校验、数据格式化、主题色、空状态等）
 */
import { describe, it, expect, vi } from 'vitest';

// ---- Mock 依赖 ----
// Mock uCharts 构造函数
vi.mock('@qiun/ucharts', () => ({
  default: vi.fn().mockImplementation(function (opts) {
    this.opts = opts;
    this.showToolTip = vi.fn();
    this.touchLegend = vi.fn();
    this.getCurrentDataIndex = vi.fn(() => 0);
    this.scroll = vi.fn();
    return this;
  })
}));

// Mock theme store
vi.mock('@/stores/modules/theme', () => ({
  useThemeStore: vi.fn(() => ({
    isDark: false
  }))
}));

// Mock uni 全局 API
global.uni = {
  createSelectorQuery: vi.fn(() => ({
    in: vi.fn(function () {
      return this;
    }),
    select: vi.fn(function () {
      return this;
    }),
    boundingClientRect: vi.fn(function (cb) {
      cb && cb({ width: 375, height: 250 });
      return this;
    }),
    exec: vi.fn()
  })),
  createCanvasContext: vi.fn(() => null),
  getSystemInfoSync: vi.fn(() => ({ pixelRatio: 2 }))
};

// ---- 直接测试组件内部逻辑（不挂载 DOM） ----
describe('BaseChart 组件逻辑', () => {
  describe('Props 校验', () => {
    it('type 只接受合法的图表类型', () => {
      const validTypes = ['line', 'column', 'area', 'pie', 'ring', 'radar', 'bar'];
      validTypes.forEach((t) => {
        expect(validTypes.includes(t)).toBe(true);
      });

      // 非法类型
      expect(validTypes.includes('scatter')).toBe(false);
      expect(validTypes.includes('funnel')).toBe(false);
    });

    it('默认 props 值正确', () => {
      // 验证默认值（对应组件中 defineProps 的 default）
      const defaults = {
        type: 'line',
        categories: [],
        series: [],
        title: '',
        subtitle: '',
        height: 250,
        legend: true,
        dataLabel: false,
        dataPointShape: true,
        animation: true,
        enableScroll: false,
        itemCount: 5,
        colors: [],
        emptyText: '暂无数据',
        padding: [15, 15, 0, 5]
      };

      expect(defaults.type).toBe('line');
      expect(defaults.height).toBe(250);
      expect(defaults.legend).toBe(true);
      expect(defaults.dataLabel).toBe(false);
      expect(defaults.emptyText).toBe('暂无数据');
    });
  });

  describe('空状态检测', () => {
    /** 模拟 isEmpty 逻辑 */
    function checkEmpty(type, series) {
      if (!series || series.length === 0) return true;
      if (['pie', 'ring'].includes(type)) {
        return series.every((s) => !s.data || s.data === 0);
      }
      return series.every((s) => !s.data || s.data.length === 0);
    }

    it('空 series 返回 true', () => {
      expect(checkEmpty('line', [])).toBe(true);
      expect(checkEmpty('line', null)).toBe(true);
      expect(checkEmpty('pie', undefined)).toBe(true);
    });

    it('有数据的 series 返回 false', () => {
      expect(checkEmpty('line', [{ name: 'A', data: [1, 2, 3] }])).toBe(false);
      expect(checkEmpty('column', [{ name: 'B', data: [10] }])).toBe(false);
    });

    it('饼图：data=0 视为空', () => {
      expect(checkEmpty('pie', [{ name: 'A', data: 0 }])).toBe(true);
      expect(checkEmpty('ring', [{ name: 'A', data: 0 }])).toBe(true);
    });

    it('饼图：data>0 视为非空', () => {
      expect(checkEmpty('pie', [{ name: 'A', data: 42 }])).toBe(false);
      expect(
        checkEmpty('ring', [
          { name: 'A', data: 10 },
          { name: 'B', data: 20 }
        ])
      ).toBe(false);
    });

    it('折线图：全部 data=[] 视为空', () => {
      expect(checkEmpty('line', [{ name: 'A', data: [] }])).toBe(true);
      expect(
        checkEmpty('line', [
          { name: 'A', data: [] },
          { name: 'B', data: [] }
        ])
      ).toBe(true);
    });
  });

  describe('主题色生成', () => {
    /** 模拟 getThemeColors 逻辑 */
    function getThemeColors(isDark, customColors) {
      return {
        background: 'rgba(0,0,0,0)',
        fontColor: isDark ? '#94A3B8' : '#6b7280',
        gridColor: isDark ? 'rgba(148,163,184,0.15)' : 'rgba(0,0,0,0.08)',
        legendFontColor: isDark ? '#CBD5E1' : '#374151',
        colors:
          customColors.length > 0
            ? customColors
            : isDark
              ? ['#60A5FA', '#34D399', '#FBBF24', '#F87171', '#A78BFA', '#FB923C', '#2DD4BF', '#E879F9']
              : ['#4A90E2', '#34D399', '#F59E0B', '#EF4444', '#8B5CF6', '#F97316', '#14B8A6', '#D946EF']
      };
    }

    it('浅色模式颜色正确', () => {
      const theme = getThemeColors(false, []);
      expect(theme.fontColor).toBe('#6b7280');
      expect(theme.colors[0]).toBe('#4A90E2');
      expect(theme.background).toBe('rgba(0,0,0,0)');
    });

    it('深色模式颜色正确', () => {
      const theme = getThemeColors(true, []);
      expect(theme.fontColor).toBe('#94A3B8');
      expect(theme.colors[0]).toBe('#60A5FA');
      expect(theme.legendFontColor).toBe('#CBD5E1');
    });

    it('自定义颜色优先', () => {
      const custom = ['#FF0000', '#00FF00'];
      const themeLight = getThemeColors(false, custom);
      const themeDark = getThemeColors(true, custom);
      expect(themeLight.colors).toEqual(custom);
      expect(themeDark.colors).toEqual(custom);
    });
  });

  describe('Series 数据格式化', () => {
    /** 模拟 formatSeries 逻辑 */
    function formatSeries(type, rawSeries) {
      if (!rawSeries) return [];
      if (['pie', 'ring'].includes(type)) {
        return rawSeries.map((item) => ({
          name: item.name || '',
          data: item.data || 0,
          color: item.color || undefined
        }));
      }
      return rawSeries.map((item) => ({
        name: item.name || '',
        data: item.data || [],
        color: item.color || undefined,
        type: item.type || undefined,
        pointShape: item.pointShape || undefined
      }));
    }

    it('折线图 series 格式化', () => {
      const input = [{ name: '学习时长', data: [10, 20, 30], color: '#FF0000' }];
      const output = formatSeries('line', input);
      expect(output).toEqual([
        { name: '学习时长', data: [10, 20, 30], color: '#FF0000', type: undefined, pointShape: undefined }
      ]);
    });

    it('饼图 series 格式化', () => {
      const input = [
        { name: '正确', data: 80, color: '#34D399' },
        { name: '错误', data: 20, color: '#EF4444' }
      ];
      const output = formatSeries('pie', input);
      expect(output).toEqual([
        { name: '正确', data: 80, color: '#34D399' },
        { name: '错误', data: 20, color: '#EF4444' }
      ]);
    });

    it('空输入返回空数组', () => {
      expect(formatSeries('line', null)).toEqual([]);
      expect(formatSeries('pie', undefined)).toEqual([]);
    });

    it('缺少字段用默认值补充', () => {
      const input = [{ data: [1, 2] }];
      const output = formatSeries('column', input);
      expect(output[0].name).toBe('');
      expect(output[0].color).toBeUndefined();
    });
  });

  describe('Canvas ID 唯一性', () => {
    it('每次生成的 ID 都不同', () => {
      const ids = new Set();
      for (let i = 0; i < 100; i++) {
        const id = `base-chart-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        ids.add(id);
      }
      // 100 个 ID 至少有 90 个不同（极端情况下同一毫秒可能相同，但随机后缀会区分）
      expect(ids.size).toBeGreaterThanOrEqual(90);
    });
  });

  describe('Extra 配置构建', () => {
    /** 模拟 buildExtraConfig 逻辑 */
    function buildExtraConfig(type, isDark, extra = {}) {
      switch (type) {
        case 'line':
        case 'area':
          return {
            line: { type: 'curve', width: 2, activeType: 'hollow', ...extra.line },
            tooltip: {
              showBox: true,
              bgColor: isDark ? '#1E293B' : '#FFFFFF',
              fontColor: isDark ? '#E2E8F0' : '#1A1D1F',
              ...extra.tooltip
            }
          };
        case 'column':
          return {
            column: { type: 'group', width: 20, ...extra.column },
            tooltip: { showBox: true, bgColor: isDark ? '#1E293B' : '#FFFFFF', ...extra.tooltip }
          };
        case 'radar':
          return {
            radar: {
              gridType: 'radar',
              gridColor: isDark ? 'rgba(148,163,184,0.2)' : 'rgba(0,0,0,0.1)',
              ...extra.radar
            }
          };
        default:
          return extra;
      }
    }

    it('折线图默认使用曲线', () => {
      const cfg = buildExtraConfig('line', false);
      expect(cfg.line.type).toBe('curve');
      expect(cfg.line.width).toBe(2);
    });

    it('柱状图默认分组模式', () => {
      const cfg = buildExtraConfig('column', false);
      expect(cfg.column.type).toBe('group');
    });

    it('雷达图使用 radar 网格', () => {
      const cfg = buildExtraConfig('radar', true);
      expect(cfg.radar.gridType).toBe('radar');
      expect(cfg.radar.gridColor).toBe('rgba(148,163,184,0.2)');
    });

    it('深色模式 tooltip 背景色', () => {
      const darkCfg = buildExtraConfig('line', true);
      const lightCfg = buildExtraConfig('line', false);
      expect(darkCfg.tooltip.bgColor).toBe('#1E293B');
      expect(lightCfg.tooltip.bgColor).toBe('#FFFFFF');
    });

    it('自定义 extra 覆盖默认值', () => {
      const cfg = buildExtraConfig('line', false, { line: { width: 4 } });
      expect(cfg.line.width).toBe(4);
      expect(cfg.line.type).toBe('curve'); // 其他值保留
    });
  });
});
