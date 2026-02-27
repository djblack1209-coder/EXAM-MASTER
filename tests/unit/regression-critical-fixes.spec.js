import { beforeEach, describe, expect, it, vi } from 'vitest';

let currentUserId = 'user_a';
let currentToken = '';

vi.mock('@/utils/logger.js', () => ({
  logger: {
    log: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}));

vi.mock('@/utils/core/performance.js', () => ({
  perfMonitor: {
    trackApi: vi.fn(),
    trackRender: vi.fn(),
    getReport: vi.fn(() => ({}))
  }
}));

vi.mock('@/services/auth-storage.js', () => ({
  getUserId: () => currentUserId,
  getToken: () => currentToken
}));

vi.mock('@/config/index.js', async (importOriginal) => {
  const actual = /** @type {any} */ (await importOriginal());
  return {
    default: {
      ...actual.default,
      websocket: {
        ...actual.default.websocket,
        devUrl: 'ws://localhost:12345/ws',
        prodUrl: 'wss://example.com/ws'
      }
    }
  };
});

describe('关键回归修复', () => {
  beforeEach(() => {
    currentUserId = 'user_a';
    currentToken = '';
    global.__mockStorage = {};
    vi.clearAllMocks();
  });

  it('答题进度自动恢复支持对象格式存储，不会误清除数据', async () => {
    const { saveQuizProgress, loadQuizProgress } = await import('@/pages/practice-sub/useQuizAutoSave.js');
    const { default: storageService } = await import('@/services/storageService.js');

    const progress = {
      currentIndex: 2,
      userChoice: 1,
      hasAnswered: true,
      seconds: 88,
      aiComment: '继续保持',
      answeredQuestions: [{ id: 'q_1' }]
    };

    saveQuizProgress(progress, true);
    const loaded = loadQuizProgress();

    expect(loaded).not.toBeNull();
    expect(loaded.currentIndex).toBe(2);
    expect(loaded.seconds).toBe(88);

    const persisted = storageService.get('EXAM_QUIZ_PROGRESS', null);
    expect(persisted).toBeTruthy();
  });

  it('Laf 只读缓存按用户隔离，避免跨账号缓存串数据', async () => {
    const { lafService } = await import('@/services/lafService.js');
    const uniMock = /** @type {any} */ (globalThis).uni;

    uniMock.request.mockImplementation(({ success }) => {
      success?.({
        statusCode: 200,
        data: {
          code: 0,
          data: {
            uid: currentUserId
          }
        }
      });
      return { abort: vi.fn() };
    });

    const first = await lafService.request(
      '/rank-center',
      { action: 'get', mode: 'daily' },
      { skipNetworkCheck: true, skipRateLimit: true }
    );

    currentUserId = 'user_b';

    const second = await lafService.request(
      '/rank-center',
      { action: 'get', mode: 'daily' },
      { skipNetworkCheck: true, skipRateLimit: true }
    );

    expect(first.data.uid).toBe('user_a');
    expect(second.data.uid).toBe('user_b');
    expect(uniMock.request).toHaveBeenCalledTimes(2);
  });

  it('排行榜手动断开后，close 事件不会触发自动重连', async () => {
    const { RankingSocketService } = await import('@/pages/practice-sub/ranking-socket.js');

    const socketService = new RankingSocketService();
    socketService.socket = /** @type {any} */ ({ close: vi.fn() });
    socketService.state.value = 1;

    const reconnectSpy = vi.spyOn(socketService, '_scheduleReconnect');

    socketService.disconnect();
    socketService._onClose({ code: 1000, reason: 'manual_close' });

    expect(reconnectSpy).not.toHaveBeenCalled();
  });
});
