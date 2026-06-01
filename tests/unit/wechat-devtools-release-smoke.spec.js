import { describe, expect, it } from 'vitest';

import { classifyWechatDevtoolsSmokeError } from '../../scripts/build/wechat-devtools-release-smoke.mjs';

describe('wechat devtools release smoke diagnostics', () => {
  it('classifies CLI login failures as a login-required release blocker', () => {
    const diagnostic = classifyWechatDevtoolsSmokeError(
      new Error('Error: 错误 Error: 需要重新登录 (code 10)Error: 需要重新登录')
    );

    expect(diagnostic).toMatchObject({
      code: 'wechat_devtools_login_required',
      category: 'auth',
      action: 'Log in to WeChat DevTools, then re-run npm run smoke:wechat:devtools.'
    });
  });
});
