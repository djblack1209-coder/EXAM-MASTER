import { assert } from './learning-domain.js';

// A whole-window exclusive Web Lock protects synchronous localStorage transactions.
// Other windows may read/export but cannot overwrite learning facts or recovery copies.
export function createLearningWriteLease(locks) {
  let lease = null;
  function release() {
    lease?.release?.();
    lease = null;
  }
  function prepare(owner) {
    if (!locks?.request) return 'unsupported';
    if (lease?.owner === owner && lease.status !== 'blocked') return lease.status;
    release();
    const candidate = { owner, status: 'acquiring', release: null };
    lease = candidate;
    Promise.resolve()
      .then(() =>
        locks.request(`exam-master:learning-v1:${owner}`, { mode: 'exclusive', ifAvailable: true }, async (lock) => {
          if (lease !== candidate) return;
          if (!lock) {
            candidate.status = 'blocked';
            return;
          }
          candidate.status = 'writable';
          await new Promise((resolve) => {
            candidate.release = resolve;
          });
        })
      )
      .catch(() => {
        if (lease === candidate) candidate.status = 'blocked';
      });
    return candidate.status;
  }
  return {
    prepare,
    release,
    assertWritable(owner) {
      const blocked = lease?.owner === owner && lease.status === 'blocked';
      const status = prepare(owner);
      assert(
        !blocked && status !== 'blocked',
        'OTHER_WINDOW_ACTIVE',
        '另一窗口正在保存学习记录。可查看或导出；请关闭该窗口后重试，避免覆盖作答。'
      );
      assert(status !== 'acquiring', 'WRITE_LEASE_PENDING', '正在取得本机记录写入权，请稍后重试');
      return status;
    }
  };
}

let browserLocks = null;
// #ifdef H5
if (typeof navigator !== 'undefined') browserLocks = navigator.locks;
// #endif
export const learningWriteLease = createLearningWriteLease(browserLocks);
export const learningWriteProtectionSupported = Boolean(browserLocks?.request);
// #ifdef H5
if (typeof window !== 'undefined') window.addEventListener('pagehide', () => learningWriteLease.release());
// #endif
