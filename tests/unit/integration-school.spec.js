/**
 * 全链路测试 4: 择校分析 & 学校数据流程
 * 搜索学校 -> 查看详情 -> 设置目标院校 -> SchoolStore 状态管理
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';

const mockRequest = vi.fn().mockResolvedValue({ code: 0, success: true, data: {} });

vi.mock('@/utils/logger.js', () => ({
  logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn() }
}));
vi.mock('@/utils/core/performance.js', () => ({
  perfMonitor: { trackApi: vi.fn(), trackRender: vi.fn(), getReport: vi.fn(() => ({})) }
}));
vi.mock('@/services/api/domains/_request-core.js', async (importOriginal) => {
  const original = await importOriginal();
  return { ...original, request: mockRequest };
});

describe('全链路: 择校分析流程', () => {
  let pinia;

  beforeEach(async () => {
    pinia = createPinia();
    setActivePinia(pinia);
    global.__mockStorage = {};
    vi.clearAllMocks();
    mockRequest.mockResolvedValue({ code: 0, success: true, data: {} });
  });

  describe('Phase 1: LafService 学校查询接口', () => {
    it('lafService.searchSchools 参数构建正确', async () => {
      const { lafService } = await import('@/services/lafService.js');

      // Mock request
      mockRequest.mockResolvedValue({
        code: 0,
        success: true,
        data: [
          { code: '10001', name: '北京大学', province: '北京' },
          { code: '10003', name: '清华大学', province: '北京' }
        ]
      });

      const result = await lafService.searchSchools('北京', 5);

      expect(mockRequest).toHaveBeenCalledWith('/school-query', {
        action: 'search',
        data: { keyword: '北京', limit: 5 }
      });
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
    });

    it('lafService.getSchoolDetail 参数构建正确', async () => {
      const { lafService } = await import('@/services/lafService.js');

      mockRequest.mockResolvedValue({
        code: 0,
        success: true,
        data: {
          code: '10001',
          name: '北京大学',
          province: '北京',
          scoreLine: { 2024: 380, 2023: 375 }
        }
      });

      const result = await lafService.getSchoolDetail('10001');

      expect(mockRequest).toHaveBeenCalledWith('/school-query', {
        action: 'detail',
        data: { code: '10001' }
      });
      expect(result.data.name).toBe('北京大学');
    });

    // getProvinces 测试已在 Round 28 移除死代码时删除

    it('lafService.getHotSchools 网络失败返回空数组', async () => {
      const { lafService } = await import('@/services/lafService.js');

      mockRequest.mockRejectedValue(new Error('网络错误'));

      const result = await lafService.getHotSchools();
      expect(result.success).toBe(false);
      expect(result.data).toEqual([]);
    });
  });
});
