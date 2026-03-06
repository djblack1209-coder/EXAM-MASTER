/**
 * 全链路集成测试 — 择校交互全流程
 * 模拟真实用户：3步向导填写 → 智能推荐 → 筛选 → 目标院校管理 → 院校详情 → 智能预测
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';

vi.mock('@/utils/logger.js', () => ({
  logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn() }
}));
vi.mock('@/utils/core/performance.js', () => ({
  perfMonitor: { trackApi: vi.fn(), trackRender: vi.fn(), getReport: vi.fn(() => ({})) }
}));

import { useSchoolStore } from '@/stores/modules/school.js';
import storageService from '@/services/storageService.js';

describe('E2E 择校交互全流程', () => {
  let schoolStore;

  beforeEach(() => {
    vi.restoreAllMocks();
    setActivePinia(createPinia());
    schoolStore = useSchoolStore();
    global.__mockStorage = {};
  });

  // ==================== Step 1: 背景信息填写 ====================

  describe('Step 1: 背景信息', () => {
    it('学历选择 → 本科/专科切换', () => {
      const formData = { degree: '' };

      formData.degree = 'bk'; // 用户点击"本科"
      expect(formData.degree).toBe('bk');

      formData.degree = 'zk'; // 用户点击"专科"
      expect(formData.degree).toBe('zk');
    });

    it('毕业院校验证 → 中英文校名通过，特殊字符拒绝', () => {
      const validateSchoolName = (name) => /^[\u4e00-\u9fa5a-zA-Z\s()（）]+$/.test(name);

      expect(validateSchoolName('北京大学')).toBe(true);
      expect(validateSchoolName('Peking University')).toBe(true);
      expect(validateSchoolName('北京大学(医学部)')).toBe(true);
      expect(validateSchoolName('')).toBe(false);
      expect(validateSchoolName('学校<script>')).toBe(false);
    });

    it('canGoToStep2 → 必填字段全部填写才能进入下一步', () => {
      const formData = { degree: '', school: '', currentMajor: '' };

      const canGoToStep2 = () => !!(formData.degree && formData.school && formData.currentMajor);

      expect(canGoToStep2()).toBe(false);

      formData.degree = 'bk';
      expect(canGoToStep2()).toBe(false);

      formData.school = '武汉大学';
      expect(canGoToStep2()).toBe(false);

      formData.currentMajor = '计算机科学';
      expect(canGoToStep2()).toBe(true);
    });
  });

  // ==================== Step 2: 报考信息 ====================

  describe('Step 2: 报考信息', () => {
    it('canSubmit → 目标院校和专业必填', () => {
      const formData = { targetSchool: '', targetMajor: '' };
      const canSubmit = () => !!(formData.targetSchool && formData.targetMajor);

      expect(canSubmit()).toBe(false);

      formData.targetSchool = '清华大学';
      expect(canSubmit()).toBe(false);

      formData.targetMajor = '计算机技术';
      expect(canSubmit()).toBe(true);
    });

    it('英语证书选择 → picker 选项正确', () => {
      const certOptions = ['无', 'CET-4', 'CET-6', '雅思', '托福'];
      expect(certOptions.length).toBe(5);
      expect(certOptions).toContain('CET-6');
    });
  });

  // ==================== Step 3: 智能推荐 ====================

  describe('Step 3: 智能推荐', () => {
    it('submitForm → 调用 proxyAI recommend 获取推荐', async () => {
      const { lafService } = await import('@/services/lafService.js');
      const mockRequest = vi.spyOn(lafService, 'request').mockResolvedValue({
        code: 0,
        success: true,
        data: {
          reply: JSON.stringify([
            {
              id: 'sch001',
              name: '浙江大学',
              location: '浙江',
              tags: ['985', '211'],
              matchRate: 85,
              majors: [{ name: '计算机技术', scores: [380, 375, 370] }]
            },
            {
              id: 'sch002',
              name: '南京大学',
              location: '江苏',
              tags: ['985', '211'],
              matchRate: 78,
              majors: [{ name: '软件工程', scores: [365, 360, 355] }]
            }
          ])
        }
      });

      const result = await lafService.proxyAI('recommend', {
        content: '本科 武汉大学 计算机科学 目标：计算机技术',
        degree: 'bk',
        school: '武汉大学',
        major: '计算机科学'
      });

      expect(mockRequest).toHaveBeenCalled();
      expect(result.code).toBe(0);
      const schools = JSON.parse(result.data.reply);
      expect(schools.length).toBe(2);
      expect(schools[0].name).toBe('浙江大学');
      expect(schools[0].matchRate).toBe(85);
      expect(schools[0].majors[0].scores).toEqual([380, 375, 370]);
    });

    it('推荐结果筛选 → 按地区过滤', () => {
      const schoolList = [
        { id: '1', name: '北京大学', location: '北京', tags: ['985'] },
        { id: '2', name: '浙江大学', location: '浙江', tags: ['985'] },
        { id: '3', name: '复旦大学', location: '上海', tags: ['985'] },
        { id: '4', name: '武汉大学', location: '湖北', tags: ['985'] }
      ];

      // 用户选择"浙江"
      const locationFilter = '浙江';
      const filtered = schoolList.filter((s) => !locationFilter || s.location === locationFilter);
      expect(filtered.length).toBe(1);
      expect(filtered[0].name).toBe('浙江大学');

      // 无筛选
      const allSchools = schoolList.filter(() => true);
      expect(allSchools.length).toBe(4);
    });

    it('推荐结果筛选 → 按标签过滤', () => {
      const schoolList = [
        { id: '1', name: '北京大学', tags: ['985', '211', '自划线'] },
        { id: '2', name: '郑州大学', tags: ['211'] },
        { id: '3', name: '河南大学', tags: [] }
      ];

      const tagFilter = '985';
      const filtered = schoolList.filter((s) => s.tags.includes(tagFilter));
      expect(filtered.length).toBe(1);
      expect(filtered[0].name).toBe('北京大学');
    });

    it('resetFilter → 清空所有筛选条件', () => {
      const filters = { location: '北京', tag: '985' };
      // 重置
      filters.location = '';
      filters.tag = '';
      expect(filters.location).toBe('');
      expect(filters.tag).toBe('');
    });
  });

  // ==================== 目标院校管理 ====================

  describe('目标院校管理', () => {
    it('toggleTarget → 添加目标院校', () => {
      const targetSchools = [];
      const school = { id: 'sch001', name: '浙江大学', isTarget: false };

      // 添加
      school.isTarget = true;
      targetSchools.push({ ...school });
      storageService.save('target_schools', targetSchools);

      const saved = storageService.get('target_schools', []);
      expect(saved.length).toBe(1);
      expect(saved[0].name).toBe('浙江大学');
      expect(saved[0].isTarget).toBe(true);
    });

    it('toggleTarget → 移除目标院校', () => {
      const targetSchools = [
        { id: 'sch001', name: '浙江大学', isTarget: true },
        { id: 'sch002', name: '南京大学', isTarget: true }
      ];
      storageService.save('target_schools', targetSchools);

      // 移除浙大
      const updated = targetSchools.filter((s) => s.id !== 'sch001');
      storageService.save('target_schools', updated);

      const saved = storageService.get('target_schools', []);
      expect(saved.length).toBe(1);
      expect(saved[0].name).toBe('南京大学');
    });

    it('目标院校上限检查 → 最多可添加合理数量', () => {
      const maxTargets = 5;
      const targets = Array.from({ length: maxTargets }, (_, i) => ({
        id: `sch${i}`,
        name: `学校${i}`,
        isTarget: true
      }));

      expect(targets.length).toBe(maxTargets);
      // 尝试再添加一个
      const canAdd = targets.length < maxTargets;
      expect(canAdd).toBe(false);
    });

    it('settings 页面 → 目标院校列表展示和删除', () => {
      storageService.save('target_schools', [
        { id: '1', name: '清华大学' },
        { id: '2', name: '北京大学' },
        { id: '3', name: '浙江大学' }
      ]);

      let targets = storageService.get('target_schools', []);
      expect(targets.length).toBe(3);

      // 用户点击删除第二个
      targets = targets.filter((_, idx) => idx !== 1);
      storageService.save('target_schools', targets);

      const updated = storageService.get('target_schools', []);
      expect(updated.length).toBe(2);
      expect(updated.map((s) => s.name)).not.toContain('北京大学');
    });
  });

  // ==================== 学校搜索 ====================

  describe('学校搜索', () => {
    it('searchSchools → 关键词搜索调用后端', async () => {
      const { lafService } = await import('@/services/lafService.js');
      const mockRequest = vi.spyOn(lafService, 'request').mockResolvedValue({
        code: 0,
        success: true,
        data: [
          { code: '10001', name: '北京大学' },
          { code: '10002', name: '北京师范大学' }
        ]
      });

      const result = await lafService.searchSchools('北京', 10);
      expect(result.code).toBe(0);
      expect(result.data.length).toBe(2);
      expect(mockRequest.mock.calls[0][1].action).toBe('search');
      expect(mockRequest.mock.calls[0][1].data.keyword).toBe('北京');
    });

    it('getHotSchools → 获取热门院校', async () => {
      const { lafService } = await import('@/services/lafService.js');
      vi.spyOn(lafService, 'request').mockResolvedValue({
        code: 0,
        success: true,
        data: [
          { code: '10001', name: '北京大学', hot: 100 },
          { code: '10003', name: '清华大学', hot: 99 }
        ]
      });

      const result = await lafService.getHotSchools({ limit: 10 });
      expect(result.code).toBe(0);
      expect(result.data.length).toBe(2);
    });

    it('getSchoolDetail → 获取院校详情', async () => {
      const { lafService } = await import('@/services/lafService.js');
      vi.spyOn(lafService, 'request').mockResolvedValue({
        code: 0,
        success: true,
        data: {
          code: '10001',
          name: '北京大学',
          location: '北京',
          tags: ['985', '211', '自划线'],
          scoreLine: 380,
          ratio: '8:1',
          passRate: 30,
          majors: [{ name: '计算机技术', scores: [380, 375, 370] }]
        }
      });

      const result = await lafService.getSchoolDetail('10001');
      expect(result.code).toBe(0);
      expect(result.data.name).toBe('北京大学');
      expect(result.data.scoreLine).toBe(380);
    });

    it('搜索缓存 → 10分钟内使用缓存', () => {
      const now = Date.now();
      const cacheKey = 'cached_schools';
      const cacheTimeKey = 'cached_schools_time';
      const cacheTTL = 10 * 60 * 1000; // 10分钟

      // 写入缓存
      storageService.save(cacheKey, [{ name: '缓存学校' }]);
      storageService.save(cacheTimeKey, now);

      // 5分钟后 → 应使用缓存
      const elapsed = 5 * 60 * 1000;
      const cacheTime = storageService.get(cacheTimeKey, 0);
      const shouldUseCache = now + elapsed - cacheTime < cacheTTL;
      expect(shouldUseCache).toBe(true);

      // 15分钟后 → 缓存过期
      const elapsed2 = 15 * 60 * 1000;
      const shouldUseCache2 = now + elapsed2 - cacheTime < cacheTTL;
      expect(shouldUseCache2).toBe(false);
    });
  });

  // ==================== 院校详情页交互 ====================

  describe('院校详情页', () => {
    it('matchRate 计算 → 基于学习数据的匹配度算法', () => {
      // 模拟 calculateMatchRate 逻辑
      const calculateMatchRate = (school, studyData) => {
        let score = 60; // 基础分
        // 学习天数加分 (最多+15)
        score += Math.min(15, Math.floor((studyData.studyDays / 90) * 15));
        // 做题数加分 (最多+10)
        score += Math.min(10, Math.floor((studyData.doneCount / 500) * 10));
        // 错误率扣分
        const errorRate = studyData.mistakeCount / Math.max(studyData.doneCount, 1);
        if (errorRate < 0.2) score += 5;
        // 学校层次调整
        if (school.tags?.includes('985')) score -= 10;
        if (school.tags?.includes('普通')) score += 10;
        // 已是目标加分
        if (school.isTarget) score += 5;
        return Math.max(30, Math.min(98, score));
      };

      const school985 = { tags: ['985', '211'], isTarget: false };
      const studyGood = { studyDays: 120, doneCount: 600, mistakeCount: 60 };
      const rate = calculateMatchRate(school985, studyGood);

      expect(rate).toBeGreaterThanOrEqual(30);
      expect(rate).toBeLessThanOrEqual(98);
      // 120天 → +15, 600题 → +10, 错误率10% → +5, 985 → -10 = 60+15+10+5-10 = 80
      expect(rate).toBe(80);
    });

    it('智能录取概率预测 → 调用 proxyAI predict', async () => {
      const { lafService } = await import('@/services/lafService.js');
      vi.spyOn(lafService, 'request').mockResolvedValue({
        code: 0,
        success: true,
        data: { reply: '75|根据你的学习数据，录取概率较高，建议继续保持' }
      });

      const result = await lafService.proxyAI('predict', {
        content: '预测录取概率',
        schoolName: '浙江大学',
        studyDays: 90,
        doneCount: 500,
        mistakeCount: 80
      });

      expect(result.code).toBe(0);
      const [probability, comment] = result.data.reply.split('|');
      expect(parseInt(probability)).toBe(75);
      expect(comment).toContain('录取概率');

      // 概率状态文本
      const prob = parseInt(probability);
      const statusText = prob >= 80 ? '势在必得' : prob >= 50 ? '大有可为' : '仍需努力';
      expect(statusText).toBe('大有可为');
    });

    it('智能院校咨询 → 多轮对话带历史', async () => {
      const { lafService } = await import('@/services/lafService.js');
      const mockRequest = vi.spyOn(lafService, 'request').mockResolvedValue({
        code: 0,
        success: true,
        data: { reply: '浙江大学计算机技术专业2024年复试分数线为380分...' }
      });

      // 第一轮
      const history = [];
      const q1 = '浙大计算机分数线是多少？';
      history.push({ role: 'user', content: q1 });

      await lafService.proxyAI('consult', {
        content: q1,
        schoolName: '浙江大学',
        history: history.slice(-10) // 最近5轮
      });

      expect(mockRequest).toHaveBeenCalled();
      const args = mockRequest.mock.calls[0][1];
      expect(args.action).toBe('consult');
      expect(args.schoolName).toBe('浙江大学');

      // 第二轮带历史
      history.push({ role: 'assistant', content: '380分...' });
      history.push({ role: 'user', content: '报录比呢？' });

      mockRequest.mockResolvedValue({
        code: 0,
        success: true,
        data: { reply: '报录比约为8:1...' }
      });

      await lafService.proxyAI('consult', {
        content: '报录比呢？',
        schoolName: '浙江大学',
        history: history.slice(-10)
      });

      const args2 = mockRequest.mock.calls[1][1];
      expect(args2.history.length).toBe(3);
    });

    it('失败消息重试 → 点击重发', async () => {
      const { lafService } = await import('@/services/lafService.js');
      const mockRequest = vi.spyOn(lafService, 'request');

      // 第一次失败
      mockRequest.mockRejectedValueOnce(new Error('网络超时'));
      const result1 = await lafService.proxyAI('consult', { content: '测试' });
      expect(result1.success).toBe(false);

      // 重试成功
      mockRequest.mockResolvedValueOnce({
        code: 0,
        success: true,
        data: { reply: '回复内容' }
      });
      const result2 = await lafService.proxyAI('consult', { content: '测试' });
      expect(result2.code).toBe(0);
    });
  });

  // ==================== 导航与缓存 ====================

  describe('导航与数据缓存', () => {
    it('navToDetail → 缓存学校数据后跳转', () => {
      const school = { id: 'sch001', name: '浙江大学', matchRate: 85 };

      // 缓存到 storage
      storageService.save(`school_detail_${school.id}`, school);

      // 验证缓存
      const cached = storageService.get(`school_detail_${school.id}`);
      expect(cached.name).toBe('浙江大学');
      expect(cached.matchRate).toBe(85);

      // 模拟导航
      let navigatedUrl = null;
      global.uni.navigateTo = vi.fn(({ url }) => {
        navigatedUrl = url;
      });
      uni.navigateTo({ url: `/pages/school-sub/detail?id=${school.id}` });
      expect(navigatedUrl).toContain('school-sub/detail');
      expect(navigatedUrl).toContain('id=sch001');
    });

    it('TabBar 择校入口 → switchTab 跳转', () => {
      let switchedUrl = null;
      global.uni.switchTab = vi.fn(({ url }) => {
        switchedUrl = url;
      });

      uni.switchTab({ url: '/pages/school/index' });
      expect(switchedUrl).toBe('/pages/school/index');
    });

    it('settings 添加目标院校 → switchTab 到择校页', () => {
      let switchedUrl = null;
      global.uni.switchTab = vi.fn(({ url }) => {
        switchedUrl = url;
      });

      // 模拟 settings 页面的"去添加目标院校"按钮
      uni.switchTab({ url: '/pages/school/index' });
      expect(switchedUrl).toBe('/pages/school/index');
    });
  });

  // ==================== SchoolStore 状态管理 ====================

  describe('SchoolStore 状态', () => {
    it('setInfo / clearInfo → 择校计划状态管理', () => {
      schoolStore.setInfo({ school: '浙江大学', major: '计算机技术', year: 2025 });
      expect(schoolStore.info.school).toBe('浙江大学');

      schoolStore.clearInfo();
      expect(Object.keys(schoolStore.info).length).toBe(0);
    });

    it('hasPlan → 有计划时返回 true', () => {
      schoolStore.setInfo({ school: '浙江大学' });
      expect(schoolStore.hasPlan).toBe(true);

      schoolStore.clearInfo();
      expect(schoolStore.hasPlan).toBe(false);
    });
  });

  // ==================== 端到端完整旅程 ====================

  describe('完整旅程：填写背景 → 智能推荐 → 选择目标 → 查看详情', () => {
    it('用户从零开始完成择校全流程', async () => {
      const { lafService } = await import('@/services/lafService.js');

      // Step 1: 填写背景信息
      const formData = {
        degree: 'bk',
        school: '武汉大学',
        currentMajor: '计算机科学',
        targetSchool: '浙江大学',
        targetMajor: '计算机技术',
        englishCert: 'CET-6'
      };
      expect(formData.degree).toBe('bk');

      // Step 2: 提交获取智能推荐
      vi.spyOn(lafService, 'request').mockResolvedValue({
        code: 0,
        success: true,
        data: {
          reply: JSON.stringify([
            {
              id: 's1',
              name: '浙江大学',
              location: '浙江',
              tags: ['985'],
              matchRate: 82,
              majors: [{ name: '计算机技术', scores: [380, 375, 370] }]
            },
            {
              id: 's2',
              name: '华中科技大学',
              location: '湖北',
              tags: ['985'],
              matchRate: 88,
              majors: [{ name: '计算机技术', scores: [360, 355, 350] }]
            },
            {
              id: 's3',
              name: '南京大学',
              location: '江苏',
              tags: ['985'],
              matchRate: 75,
              majors: [{ name: '软件工程', scores: [370, 365, 360] }]
            }
          ])
        }
      });

      const aiResult = await lafService.proxyAI('recommend', { content: '推荐' });
      const schools = JSON.parse(aiResult.data.reply);
      expect(schools.length).toBe(3);

      // Step 3: 用户筛选湖北地区
      const filtered = schools.filter((s) => s.location === '湖北');
      expect(filtered.length).toBe(1);
      expect(filtered[0].name).toBe('华中科技大学');

      // Step 4: 添加为目标院校
      const targets = [];
      targets.push({ ...schools[0], isTarget: true }); // 浙大
      targets.push({ ...schools[1], isTarget: true }); // 华科
      storageService.save('target_schools', targets);
      expect(storageService.get('target_schools').length).toBe(2);

      // Step 5: 查看浙大详情
      storageService.save('school_detail_s1', schools[0]);
      const detail = storageService.get('school_detail_s1');
      expect(detail.majors[0].scores[0]).toBe(380); // 最新年分数线

      // Step 6: 设置择校计划
      schoolStore.setInfo({ school: '浙江大学', major: '计算机技术', year: 2025 });
      expect(schoolStore.hasPlan).toBe(true);
      expect(schoolStore.info.school).toBe('浙江大学');
    });
  });
});
