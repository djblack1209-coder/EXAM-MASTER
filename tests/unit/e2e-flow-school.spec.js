/**
 * 全链路测试 4: 择校分析 & 学校数据流程
 * 搜索学校 -> 查看详情 -> 设置目标院校 -> SchoolStore 状态管理
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';

vi.mock('@/utils/logger.js', () => ({
  logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn() }
}));
vi.mock('@/utils/core/performance.js', () => ({
  perfMonitor: { trackApi: vi.fn(), trackRender: vi.fn(), getReport: vi.fn(() => ({})) }
}));

describe('全链路: 择校分析流程', () => {
  let pinia;

  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);
    global.__mockStorage = {};
    vi.clearAllMocks();
  });

  describe('Phase 1: SchoolStore 状态管理', () => {
    it('初始状态 - 无择校计划', async () => {
      const { useSchoolStore } = await import('@/stores/modules/school.js');
      const schoolStore = useSchoolStore();

      expect(schoolStore.info).toEqual({});
      expect(schoolStore.hasPlan).toBe(false);
    });

    it('setInfo 设置择校信息', async () => {
      const { useSchoolStore } = await import('@/stores/modules/school.js');
      const schoolStore = useSchoolStore();

      schoolStore.setInfo({
        schoolId: 'tsinghua_001',
        schoolName: '清华大学',
        majorId: 'cs_001',
        majorName: '计算机科学与技术',
        targetScore: 380,
        province: '北京'
      });

      expect(schoolStore.hasPlan).toBe(true);
      expect(schoolStore.info.schoolName).toBe('清华大学');
      expect(schoolStore.info.targetScore).toBe(380);
    });

    it('clearInfo 清空择校信息', async () => {
      const { useSchoolStore } = await import('@/stores/modules/school.js');
      const schoolStore = useSchoolStore();

      schoolStore.setInfo({ schoolName: '北京大学' });
      expect(schoolStore.hasPlan).toBe(true);

      schoolStore.clearInfo();
      expect(schoolStore.hasPlan).toBe(false);
      expect(schoolStore.info).toEqual({});
    });

    it('setInfo(null) 安全处理', async () => {
      const { useSchoolStore } = await import('@/stores/modules/school.js');
      const schoolStore = useSchoolStore();

      schoolStore.setInfo(null);
      expect(schoolStore.info).toEqual({});
      expect(schoolStore.hasPlan).toBe(false);
    });

    it('setInfo(undefined) 安全处理', async () => {
      const { useSchoolStore } = await import('@/stores/modules/school.js');
      const schoolStore = useSchoolStore();

      schoolStore.setInfo(undefined);
      expect(schoolStore.info).toEqual({});
    });
  });

  describe('Phase 2: 完整择校流程模拟', () => {
    it('搜索 -> 选择 -> 设置目标 -> 修改 -> 清除', async () => {
      const { useSchoolStore } = await import('@/stores/modules/school.js');
      const schoolStore = useSchoolStore();

      // Step 1: 初始无计划
      expect(schoolStore.hasPlan).toBe(false);

      // Step 2: 用户选择了学校
      schoolStore.setInfo({
        schoolId: 'pku_001',
        schoolName: '北京大学',
        majorName: '软件工程',
        targetScore: 360
      });
      expect(schoolStore.hasPlan).toBe(true);
      expect(schoolStore.info.schoolName).toBe('北京大学');

      // Step 3: 用户修改目标分数
      schoolStore.setInfo({
        ...schoolStore.info,
        targetScore: 370
      });
      expect(schoolStore.info.targetScore).toBe(370);
      expect(schoolStore.info.schoolName).toBe('北京大学');

      // Step 4: 用户换了学校
      schoolStore.setInfo({
        schoolId: 'zju_001',
        schoolName: '浙江大学',
        majorName: '人工智能',
        targetScore: 350
      });
      expect(schoolStore.info.schoolName).toBe('浙江大学');

      // Step 5: 清除
      schoolStore.clearInfo();
      expect(schoolStore.hasPlan).toBe(false);
    });
  });

  describe('Phase 3: LafService 学校查询接口', () => {
    it('lafService.searchSchools 参数构建正确', async () => {
      const { lafService } = await import('@/services/lafService.js');

      // Mock request
      const mockRequest = vi.spyOn(lafService, 'request').mockResolvedValue({
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

      mockRequest.mockRestore();
    });

    it('lafService.getSchoolDetail 参数构建正确', async () => {
      const { lafService } = await import('@/services/lafService.js');

      const mockRequest = vi.spyOn(lafService, 'request').mockResolvedValue({
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

      mockRequest.mockRestore();
    });

    it('lafService.getProvinces 获取省份列表', async () => {
      const { lafService } = await import('@/services/lafService.js');

      const mockRequest = vi.spyOn(lafService, 'request').mockResolvedValue({
        code: 0,
        success: true,
        data: ['北京', '上海', '广东', '浙江']
      });

      const result = await lafService.getProvinces();
      expect(result.success).toBe(true);
      expect(result.data).toContain('北京');

      mockRequest.mockRestore();
    });

    it('lafService.getHotSchools 网络失败返回空数组', async () => {
      const { lafService } = await import('@/services/lafService.js');

      const mockRequest = vi.spyOn(lafService, 'request').mockRejectedValue(new Error('网络错误'));

      const result = await lafService.getHotSchools();
      expect(result.success).toBe(false);
      expect(result.data).toEqual([]);

      mockRequest.mockRestore();
    });
  });
});
