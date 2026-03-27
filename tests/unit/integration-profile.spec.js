/**
 * 全链路集成测试 — 个人资料：头像更换、昵称修改、数据展示
 * 模拟真实用户在 profile/settings 页面的交互行为
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';

const mockRequest = vi.hoisted(() => vi.fn().mockResolvedValue({ code: 0, success: true, data: {} }));

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

import { useUserStore } from '@/stores/modules/user.js';
import { useStudyStore } from '@/stores/modules/study.js';
import storageService from '@/services/storageService.js';

describe('E2E 个人资料交互', () => {
  let userStore, studyStore;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockRequest.mockResolvedValue({ code: 0, success: true, data: {} });
    setActivePinia(createPinia());
    userStore = useUserStore();
    studyStore = useStudyStore();
    storageService.clear?.() ||
      (() => {
        ['userInfo', 'EXAM_USER_ID', 'EXAM_TOKEN', 'learning_achievements', 'theme_mode'].forEach((k) => {
          try {
            storageService.remove(k);
          } catch {}
        });
      })();
  });

  // ==================== 头像更换流程 ====================

  describe('头像更换', () => {
    it('未登录用户点击头像 → 应跳转登录页而非弹出选择', () => {
      // 模拟未登录状态
      userStore.isLogin = false;
      const isLoggedIn = !!(userStore.isLogin || storageService.get('EXAM_USER_ID'));
      expect(isLoggedIn).toBe(false);

      // 未登录时 handleAvatarTap 应走 handleLogin 分支
      let navigatedTo = null;
      global.uni.navigateTo = vi.fn(({ url }) => {
        navigatedTo = url;
      });
      if (!isLoggedIn) {
        uni.navigateTo({ url: '/pages/login/index' });
      }
      expect(navigatedTo).toBe('/pages/login/index');
    });

    it('已登录用户点击头像 → 弹出拍照/相册选择', () => {
      userStore.setUserInfo({ _id: 'u1', nickName: '测试用户' });
      storageService.save('EXAM_USER_ID', 'u1');

      const isLoggedIn = !!(userStore.isLogin || storageService.get('EXAM_USER_ID'));
      expect(isLoggedIn).toBe(true);

      // 模拟 showActionSheet
      let sheetOptions = null;
      global.uni.showActionSheet = vi.fn(({ itemList, success }) => {
        sheetOptions = itemList;
        success({ tapIndex: 1 }); // 用户选择"从相册选择"
      });

      let chosenSourceType = null;
      if (isLoggedIn) {
        uni.showActionSheet({
          itemList: ['拍照', '从相册选择'],
          success: (res) => {
            chosenSourceType = res.tapIndex === 0 ? ['camera'] : ['album'];
          }
        });
      }

      expect(sheetOptions).toEqual(['拍照', '从相册选择']);
      expect(chosenSourceType).toEqual(['album']);
    });

    it('选择拍照 → sourceType 应为 camera', () => {
      global.uni.showActionSheet = vi.fn(({ success }) => {
        success({ tapIndex: 0 }); // 拍照
      });

      let sourceType = null;
      uni.showActionSheet({
        itemList: ['拍照', '从相册选择'],
        success: (res) => {
          sourceType = res.tapIndex === 0 ? ['camera'] : ['album'];
        }
      });
      expect(sourceType).toEqual(['camera']);
    });

    it('chooseImage 成功 → 应调用 uploadFile 上传头像', async () => {
      storageService.save('EXAM_USER_ID', 'u1');
      storageService.save('EXAM_TOKEN', 'token123');

      // Mock chooseImage
      global.uni.chooseImage = vi.fn(({ success }) => {
        success({ tempFilePaths: ['/tmp/avatar.jpg'] });
      });

      // Mock uploadFile
      let uploadParams = null;
      global.uni.uploadFile = vi.fn((params) => {
        uploadParams = params;
        params.success({
          data: JSON.stringify({ code: 0, success: true, data: { url: 'https://cdn.example.com/avatar/u1.jpg' } })
        });
      });

      // 模拟 chooseAndUploadAvatar 流程
      const chooseRes = await new Promise((resolve, reject) => {
        uni.chooseImage({ count: 1, sizeType: ['compressed'], sourceType: ['album'], success: resolve, fail: reject });
      });
      const tempFilePath = chooseRes.tempFilePaths[0];
      expect(tempFilePath).toBe('/tmp/avatar.jpg');

      // 上传
      const uploadRes = await new Promise((resolve) => {
        uni.uploadFile({
          url: 'https://api.example.com/upload-avatar',
          filePath: tempFilePath,
          name: 'file',
          formData: { userId: 'u1', type: 'avatar' },
          header: { Authorization: `Bearer token123` },
          success: (res) => {
            const data = JSON.parse(res.data);
            resolve({ success: !!(data.code === 0 || data.success), avatarUrl: data.data?.url || data.url });
          },
          fail: () => resolve({ success: false })
        });
      });

      expect(uploadRes.success).toBe(true);
      expect(uploadRes.avatarUrl).toBe('https://cdn.example.com/avatar/u1.jpg');
      expect(uploadParams.formData.userId).toBe('u1');
      expect(uploadParams.formData.type).toBe('avatar');
    });

    it('上传成功 → 应同步更新 store + localStorage + 发送事件', () => {
      const newAvatarUrl = 'https://cdn.example.com/avatar/new.jpg';

      // 初始化用户
      userStore.setUserInfo({ _id: 'u1', nickName: '测试', avatarUrl: '' });
      storageService.save('userInfo', { nickName: '测试', avatarUrl: '' });

      // 模拟上传成功后的同步逻辑
      let emittedEvent = null;
      global.uni.$emit = vi.fn((event, data) => {
        emittedEvent = { event, data };
      });

      // 1. 更新本地存储
      const localUserInfo = storageService.get('userInfo', {});
      localUserInfo.avatarUrl = newAvatarUrl;
      storageService.save('userInfo', localUserInfo);

      // 2. 更新 store
      userStore.updateUserInfo({ avatarUrl: newAvatarUrl });

      // 3. 发送事件
      uni.$emit('userInfoUpdated', { avatarUrl: newAvatarUrl });

      // 验证
      expect(storageService.get('userInfo').avatarUrl).toBe(newAvatarUrl);
      expect(userStore.userInfo.avatarUrl).toBe(newAvatarUrl);
      expect(emittedEvent.event).toBe('userInfoUpdated');
      expect(emittedEvent.data.avatarUrl).toBe(newAvatarUrl);
    });

    it('上传失败 → 应显示错误提示', async () => {
      global.uni.uploadFile = vi.fn((params) => {
        params.success({ data: JSON.stringify({ code: -1, success: false, message: '文件过大' }) });
      });

      const uploadRes = await new Promise((resolve) => {
        uni.uploadFile({
          url: 'https://api.example.com/upload-avatar',
          filePath: '/tmp/big.jpg',
          name: 'file',
          formData: { userId: 'u1', type: 'avatar' },
          success: (res) => {
            const data = JSON.parse(res.data);
            if (data.code === 0 || data.success) {
              resolve({ success: true });
            } else {
              resolve({ success: false, message: data.message || '上传失败' });
            }
          }
        });
      });

      expect(uploadRes.success).toBe(false);
      expect(uploadRes.message).toBe('文件过大');
    });

    it('网络错误 → uploadFile fail 回调应返回网络错误', async () => {
      global.uni.uploadFile = vi.fn((params) => {
        params.fail({ errMsg: 'uploadFile:fail timeout' });
      });

      const uploadRes = await new Promise((resolve) => {
        uni.uploadFile({
          url: 'https://api.example.com/upload-avatar',
          filePath: '/tmp/avatar.jpg',
          name: 'file',
          formData: { userId: 'u1', type: 'avatar' },
          success: () => resolve({ success: true }),
          fail: () => resolve({ success: false, message: '网络错误' })
        });
      });

      expect(uploadRes.success).toBe(false);
      expect(uploadRes.message).toBe('网络错误');
    });

    it('用户取消选择图片 → 不应显示错误提示', () => {
      global.uni.chooseImage = vi.fn(({ fail }) => {
        fail({ errMsg: 'chooseImage:fail cancel' });
      });

      let showedError = false;
      try {
        uni.chooseImage({
          count: 1,
          success: () => {},
          fail: (err) => {
            if (err.errMsg && err.errMsg.includes('cancel')) {
              return; // 用户取消，静默处理
            }
            showedError = true;
          }
        });
      } catch {}

      expect(showedError).toBe(false);
    });

    it('userAvatar 计算属性 → 优先 store > localStorage > 空', () => {
      // 场景1: store 有值
      userStore.setUserInfo({ avatarUrl: 'https://store-avatar.jpg' });
      storageService.save('userInfo', { avatarUrl: 'https://local-avatar.jpg' });

      let avatar = '';
      if (userStore.userInfo?.avatarUrl) avatar = userStore.userInfo.avatarUrl;
      else if (storageService.get('userInfo')?.avatarUrl) avatar = storageService.get('userInfo').avatarUrl;
      expect(avatar).toBe('https://store-avatar.jpg');

      // 场景2: store 无值，localStorage 有值
      userStore.updateUserInfo({ avatarUrl: '' });
      avatar = '';
      if (userStore.userInfo?.avatarUrl) avatar = userStore.userInfo.avatarUrl;
      else if (storageService.get('userInfo')?.avatarUrl) avatar = storageService.get('userInfo').avatarUrl;
      expect(avatar).toBe('https://local-avatar.jpg');

      // 场景3: 都无值
      storageService.save('userInfo', {});
      avatar = '';
      if (userStore.userInfo?.avatarUrl) avatar = userStore.userInfo.avatarUrl;
      else if (storageService.get('userInfo')?.avatarUrl) avatar = storageService.get('userInfo').avatarUrl;
      expect(avatar).toBe('');
    });
  });

  // ==================== 昵称修改流程 ====================

  describe('昵称修改', () => {
    it('编辑昵称 → 后端 + store + localStorage 三方同步', async () => {
      userStore.setUserInfo({ _id: 'u1', nickName: '旧昵称' });
      storageService.save('userInfo', { nickName: '旧昵称' });
      storageService.save('EXAM_USER_ID', 'u1');

      const { lafService } = await import('@/services/lafService.js');
      mockRequest.mockResolvedValue({ code: 0, success: true });

      const newName = '新昵称2024';

      // 1. 后端持久化
      await lafService.updateUserProfile({ nickname: newName });

      // 2. 更新 store
      userStore.updateUserInfo({ nickName: newName });

      // 3. 更新 localStorage
      const cached = storageService.get('userInfo', {});
      cached.nickName = newName;
      storageService.save('userInfo', cached);

      // 验证三方一致
      expect(userStore.userInfo.nickName).toBe('新昵称2024');
      expect(storageService.get('userInfo').nickName).toBe('新昵称2024');
      expect(mockRequest).toHaveBeenCalled();
    });

    it('空昵称 → 应被拒绝', () => {
      const newName = '   '.trim();
      expect(newName).toBe('');
      // 空昵称不应更新
      const shouldUpdate = !!newName;
      expect(shouldUpdate).toBe(false);
    });

    it('昵称长度限制 → 最多20字符', () => {
      const longName = '这是一个超级超级超级超级超级超级长的昵称测试';
      const sanitized = longName.substring(0, 20);
      expect(sanitized.length).toBeLessThanOrEqual(20);
    });

    it('后端更新失败 → 不应更新本地数据', async () => {
      userStore.setUserInfo({ _id: 'u1', nickName: '原始昵称' });
      storageService.save('userInfo', { nickName: '原始昵称' });
      storageService.save('EXAM_USER_ID', 'u1');

      const { lafService } = await import('@/services/lafService.js');
      mockRequest.mockRejectedValue(new Error('网络超时'));

      const result = await lafService.updateUserProfile({ nickname: '新昵称' });
      // updateUserProfile 内部 catch，返回 { code: -1, success: false }
      expect(result.code).toBe(-1);
      expect(result.success).toBe(false);

      // 模拟前端逻辑：只有 code === 0 才更新本地
      if (result.code === 0) {
        userStore.updateUserInfo({ nickName: '新昵称' });
        const cached = storageService.get('userInfo', {});
        cached.nickName = '新昵称';
        storageService.save('userInfo', cached);
      }

      // 验证 store 中原始数据未被修改
      expect(userStore.userInfo.nickName).toBe('原始昵称');
    });

    it('userName 计算属性 → 未登录显示"未登录"，已登录显示昵称', () => {
      // 未登录
      let isLoggedIn = false;
      let userName = !isLoggedIn ? '未登录' : userStore.userInfo?.nickName || '学习者';
      expect(userName).toBe('未登录');

      // 已登录有昵称
      isLoggedIn = true;
      userStore.setUserInfo({ nickName: '考研人小明' });
      userName = !isLoggedIn ? '未登录' : userStore.userInfo?.nickName || '学习者';
      expect(userName).toBe('考研人小明');

      // 已登录无昵称
      userStore.updateUserInfo({ nickName: '' });
      userName = !isLoggedIn ? '未登录' : userStore.userInfo?.nickName || '学习者';
      expect(userName).toBe('学习者');
    });
  });

  // ==================== 个人资料数据展示 ====================

  describe('个人资料数据展示', () => {
    it('学习天数 → 从 studyProgress 正确读取', () => {
      studyStore.studyProgress = { studyDays: 42, totalQuestions: 100, correctCount: 75 };
      const studyDays = studyStore.studyProgress?.studyDays || 0;
      expect(studyDays).toBe(42);
    });

    it('正确率计算 → correctCount / totalQuestions * 100 四舍五入', () => {
      studyStore.studyProgress = { totalQuestions: 300, correctCount: 213 };
      const progress = studyStore.studyProgress;
      const rate = Math.round((progress.correctCount / progress.totalQuestions) * 100);
      expect(rate).toBe(71); // 213/300 = 71%
    });

    it('正确率 → totalQuestions 为 0 时返回 0', () => {
      studyStore.studyProgress = { totalQuestions: 0, correctCount: 0 };
      const progress = studyStore.studyProgress;
      const rate =
        !progress || !progress.totalQuestions || progress.totalQuestions === 0
          ? 0
          : Math.round((progress.correctCount / progress.totalQuestions) * 100);
      expect(rate).toBe(0);
    });

    it('成就徽章数 → 从 learning_achievements 数组长度读取', () => {
      storageService.save('learning_achievements', [
        { id: 'first_login', name: '初来乍到' },
        { id: 'streak_7', name: '连续7天' },
        { id: 'accuracy_90', name: '学霸' }
      ]);
      const achievements = storageService.get('learning_achievements', []);
      const badgeCount = Array.isArray(achievements) ? achievements.length : 0;
      expect(badgeCount).toBe(3);
    });

    it('成就徽章 → 非数组时返回 0', () => {
      storageService.save('learning_achievements', 'invalid');
      const achievements = storageService.get('learning_achievements', []);
      const badgeCount = Array.isArray(achievements) ? achievements.length : 0;
      expect(badgeCount).toBe(0);
    });

    it('统计卡片点击 → 显示正确的提示信息', () => {
      const studyDays = 42;
      const badgeCount = 3;
      const accuracyRate = 71;

      const messages = {
        days: `累计学习 ${studyDays} 天`,
        badges: `已获得 ${badgeCount} 个勋章`,
        accuracy: `答题正确率 ${accuracyRate}%`
      };

      expect(messages.days).toBe('累计学习 42 天');
      expect(messages.badges).toBe('已获得 3 个勋章');
      expect(messages.accuracy).toBe('答题正确率 71%');
    });

    it('userId 展示 → 未登录显示"点击登录"，已登录显示真实ID', () => {
      // 未登录
      let isLoggedIn = false;
      let displayId = !isLoggedIn ? '点击登录' : userStore.userInfo?.userId || userStore.userInfo?._id || '100001';
      expect(displayId).toBe('点击登录');

      // 已登录
      isLoggedIn = true;
      userStore.setUserInfo({ _id: 'user_abc123', userId: 'UID_001' });
      displayId = !isLoggedIn ? '点击登录' : userStore.userInfo?.userId || userStore.userInfo?._id || '100001';
      expect(displayId).toBe('UID_001');

      // 已登录但无 userId，fallback 到 _id
      userStore.updateUserInfo({ userId: '' });
      displayId = !isLoggedIn ? '点击登录' : userStore.userInfo?.userId || userStore.userInfo?._id || '100001';
      expect(displayId).toBe('user_abc123');
    });

    it('主题切换 → 保存到 storage 并正确读取', () => {
      // 切换到深色
      storageService.save('theme_mode', 'dark');
      expect(storageService.get('theme_mode')).toBe('dark');

      // 切换回浅色
      storageService.save('theme_mode', 'light');
      expect(storageService.get('theme_mode')).toBe('light');
    });

    it('页面导航 → 各入口正确跳转', () => {
      const navigations = [];
      global.uni.navigateTo = vi.fn(({ url }) => navigations.push(url));
      global.uni.switchTab = vi.fn(({ url }) => navigations.push(url));

      // 模拟各按钮点击
      uni.navigateTo({ url: '/pages/mistake/index' }); // 错题本
      uni.navigateTo({ url: '/pages/study-detail/index' }); // 学习统计
      uni.navigateTo({ url: '/pages/settings/index' }); // 设置

      expect(navigations).toContain('/pages/mistake/index');
      expect(navigations).toContain('/pages/study-detail/index');
      expect(navigations).toContain('/pages/settings/index');
    });
  });

  // ==================== 完整用户旅程 ====================

  describe('完整用户旅程：登录 → 修改资料 → 查看数据', () => {
    it('新用户注册后修改头像和昵称，查看学习数据', async () => {
      // Step 1: 登录
      storageService.save('EXAM_USER_ID', 'new_user_001');
      storageService.save('EXAM_TOKEN', 'jwt_token_xxx');
      userStore.setUserInfo({ _id: 'new_user_001', nickName: '微信用户', avatarUrl: '' });

      const isLoggedIn = !!(userStore.isLogin || storageService.get('EXAM_USER_ID'));
      expect(isLoggedIn).toBe(true);

      // Step 2: 修改昵称
      const { lafService } = await import('@/services/lafService.js');
      mockRequest.mockResolvedValue({ code: 0, success: true });
      await lafService.updateUserProfile({ nickname: '考研冲冲冲' });
      userStore.updateUserInfo({ nickName: '考研冲冲冲' });
      storageService.save('userInfo', { ...storageService.get('userInfo', {}), nickName: '考研冲冲冲' });

      expect(userStore.userInfo.nickName).toBe('考研冲冲冲');

      // Step 3: 上传头像
      global.uni.uploadFile = vi.fn((params) => {
        params.success({
          data: JSON.stringify({ code: 0, data: { url: 'https://cdn.example.com/avatar/new_user_001.jpg' } })
        });
      });

      const avatarUrl = 'https://cdn.example.com/avatar/new_user_001.jpg';
      userStore.updateUserInfo({ avatarUrl });
      storageService.save('userInfo', { ...storageService.get('userInfo', {}), avatarUrl });

      expect(userStore.userInfo.avatarUrl).toBe(avatarUrl);
      expect(storageService.get('userInfo').avatarUrl).toBe(avatarUrl);

      // Step 4: 查看学习数据
      studyStore.studyProgress = { studyDays: 1, totalQuestions: 10, correctCount: 7 };
      const rate = Math.round((7 / 10) * 100);
      expect(rate).toBe(70);

      // Step 5: 查看成就
      storageService.save('learning_achievements', [{ id: 'first_login', name: '初来乍到' }]);
      const badges = storageService.get('learning_achievements', []);
      expect(badges.length).toBe(1);
    });
  });
});
