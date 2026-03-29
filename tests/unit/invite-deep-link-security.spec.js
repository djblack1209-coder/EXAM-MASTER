import { beforeEach, describe, expect, it, vi } from 'vitest';

async function loadInviteModule({ inviteSecret = '', enableMock = false, lafRequestMock = null } = {}) {
  vi.resetModules();

  const logger = {
    log: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  };

  vi.doMock('@/utils/logger.js', () => ({ logger }));
  vi.doMock('@/config/index.js', () => ({
    default: {
      deepLink: {
        h5BaseUrl: 'https://exam-master.com',
        miniProgramPkPath: '/pages/practice-sub/pk-battle',
        appScheme: 'exammaster://',
        inviteExpiry: 24 * 60 * 60 * 1000,
        inviteCodeLength: 8,
        inviteSecret
      },
      debug: {
        enableMock
      }
    }
  }));

  // mock social.api.js — validateInviteCode / joinPKRoom 现在调用 pkBattle
  const mockPkBattle = lafRequestMock || vi.fn().mockRejectedValue(new Error('网络不可用(测试环境)'));
  vi.doMock('@/services/api/domains/social.api.js', () => ({
    pkBattle: mockPkBattle
  }));

  const mod = await import('@/pages/practice-sub/invite-deep-link.js');
  return { mod, logger, mockRequest: mockPkBattle };
}

describe('invite-deep-link security', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws when creating link without invite secret', async () => {
    const { mod } = await loadInviteModule({ inviteSecret: '' });

    await expect(
      mod.createInviteDeepLink({
        type: 'pk',
        roomId: 'room_1',
        inviteCode: 'ABC12345',
        inviterId: 'user_1',
        subject: 'politics',
        questionCount: 10
      })
    ).rejects.toThrow('INVITE_SECRET_MISSING');
  });

  it('returns null when parsing link without invite secret', async () => {
    const { mod, logger } = await loadInviteModule({ inviteSecret: '' });

    const parsed = mod.parseInviteLink('?r=room_1&c=ABC12345&sign=deadbeef');

    expect(parsed).toBeNull();
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Missing invite secret'));
  });

  it('can create and parse signed link with valid secret', async () => {
    const { mod } = await loadInviteModule({ inviteSecret: 'test_invite_secret' });

    const link = await mod.createInviteDeepLink({
      type: 'pk',
      roomId: 'room_secure_1',
      inviteCode: 'ABCD1234',
      inviterId: 'user_secure_1',
      subject: 'english',
      questionCount: 12
    });

    const parsed = mod.parseInviteLink(link);

    expect(parsed).toMatchObject({
      valid: true,
      roomId: 'room_secure_1',
      inviteCode: 'ABCD1234',
      inviterId: 'user_secure_1',
      subject: 'english',
      questionCount: 12
    });
  });

  it('validateInviteCode calls backend API, falls back to format validation on error', async () => {
    const { mod, logger } = await loadInviteModule({
      inviteSecret: 'test_invite_secret',
      enableMock: false
    });

    // lafService.request 在测试环境会抛出错误
    // catch 分支对格式合法的邀请码降级为格式校验，返回 true
    const valid = await mod.validateInviteCode('ABCD1234', 'room_1');

    expect(valid).toBe(true);
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('降级为格式校验'));
  });

  it('validateInviteCode returns false for invalid format code on error', async () => {
    const { mod } = await loadInviteModule({
      inviteSecret: 'test_invite_secret',
      enableMock: false
    });

    // 格式不合法的邀请码（包含小写），降级校验也返回 false
    const valid = await mod.validateInviteCode('abcd1234', 'room_1');

    expect(valid).toBe(false);
  });

  it('allows validateInviteCode mock only in debug mode', async () => {
    const { mod } = await loadInviteModule({
      inviteSecret: 'test_invite_secret',
      enableMock: true
    });

    const valid = await mod.validateInviteCode('ABCD1234', 'room_1');

    expect(valid).toBe(true);
  });

  it('validateInviteCode succeeds when backend returns valid', async () => {
    const mockRequest = vi.fn().mockResolvedValue({ code: 0, data: { valid: true } });
    const { mod } = await loadInviteModule({
      inviteSecret: 'test_invite_secret',
      enableMock: false,
      lafRequestMock: mockRequest
    });

    const valid = await mod.validateInviteCode('ABCD1234', 'room_1');

    expect(valid).toBe(true);
    expect(mockRequest).toHaveBeenCalledWith({
      action: 'validate_invite_code',
      data: { code: 'ABCD1234', roomId: 'room_1' }
    });
  });

  it('joinPKRoom returns failure with error message when API unavailable', async () => {
    const { mod } = await loadInviteModule({
      inviteSecret: 'test_invite_secret',
      enableMock: false
    });

    const result = await mod.joinPKRoom({ roomId: 'room_1' });

    expect(result.success).toBe(false);
    expect(typeof result.message).toBe('string');
  });
});
