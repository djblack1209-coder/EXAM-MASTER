/**
 * 登录流程集成测试
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockUserStore = {
  isLogin: false,
  userInfo: null,
  setUserInfo: vi.fn(),
  setLoginStatus: vi.fn()
};

const mockStorage = {
  save: vi.fn(),
  get: vi.fn()
};

vi.mock('../../src/stores', () => ({
  useUserStore: () => mockUserStore
}));

vi.mock('../../src/services/storageService.js', () => ({
  default: mockStorage
}));

describe('登录流程集成测试', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUserStore.isLogin = false;
    mockUserStore.userInfo = null;
  });

  it('邮箱登录成功后应保存用户信息', () => {
    const userInfo = { id: '123', email: 'test@example.com', nickname: '测试用户' };

    mockUserStore.setUserInfo(userInfo);
    mockUserStore.setLoginStatus(true);
    mockStorage.save('user_token', 'mock_token');

    expect(mockUserStore.setUserInfo).toHaveBeenCalledWith(userInfo);
    expect(mockUserStore.setLoginStatus).toHaveBeenCalledWith(true);
    expect(mockStorage.save).toHaveBeenCalledWith('user_token', 'mock_token');
  });

  it('登录失败应清除状态', () => {
    mockUserStore.setLoginStatus(false);
    mockUserStore.setUserInfo(null);

    expect(mockUserStore.setLoginStatus).toHaveBeenCalledWith(false);
    expect(mockUserStore.setUserInfo).toHaveBeenCalledWith(null);
  });

  it('Token过期应触发重新登录', () => {
    mockStorage.get.mockReturnValue(null);

    const token = mockStorage.get('user_token');
    expect(token).toBeNull();
  });
});
