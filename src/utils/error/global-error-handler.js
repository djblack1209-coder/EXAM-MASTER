/**
 * 轻量版全局错误处理器
 * 替代原 16K 的重量级实现，仅保留 main.js 所需的核心 API
 */
import { logger } from '@/utils/logger.js';

let _config = {};

export const globalErrorHandler = {
  init(config = {}) {
    _config = config;
    // 注册全局未捕获异常处理
    if (typeof uni !== 'undefined' && uni.onError) {
      uni.onError((err) => {
        if (_config.ignorePatterns?.some((p) => p.test?.(String(err)))) return;
        logger.error('[GlobalError]', err);
        _config.onError?.({ type: 'unhandled', message: String(err) });
      });
    }
  },
  createVueErrorHandler() {
    return (err, vm, info) => {
      if (_config.ignorePatterns?.some((p) => p.test?.(String(err)))) return;
      logger.error('[VueError]', info, err);
      _config.onError?.({ type: 'vue', message: String(err), info });
    };
  }
};
