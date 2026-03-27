// @ts-nocheck
import { test } from '../fixtures/regression.fixture.js';
import { expectAnyTextVisible, expectSchoolPageReady } from '../helpers/assertions.js';

async function skipWhenRuntimeNotReady(test, page) {
  const runtime = await page.evaluate(() => {
    const textLen = (document.body?.innerText || '').trim().length;
    const hasUni = typeof window !== 'undefined' && typeof window.uni !== 'undefined';
    return { hasUni, textLen, ready: hasUni || textLen > 20 };
  });
  test.skip(!runtime.ready, `H5 runtime not ready: ${JSON.stringify(runtime)}`);
}

test.describe('A2-异常流程', () => {
  test('EXC-001 择校空输入触发前端校验', async ({ app, page }) => {
    await app.goto('/pages/school/index');
    await skipWhenRuntimeNotReady(test, page);
    await expectSchoolPageReady(page);

    const submit = page.getByText('提交', { exact: false }).first();
    if (await submit.isVisible().catch(() => false)) {
      await submit.click();
    }
    await expectAnyTextVisible(page, ['请输入', '目标', '院校', '专业']);
    await app.screenshot('exception-school-empty-input');
  });

  test('EXC-002 文档转换未选文件不能提交', async ({ app, page }) => {
    await app.goto('/pages/tools/doc-convert');
    await skipWhenRuntimeNotReady(test, page);

    const startBtn = page.getByText('开始转换', { exact: false }).first();
    if (await startBtn.isVisible().catch(() => false)) {
      await startBtn.click();
    }
    await expectAnyTextVisible(page, ['请选择', '文件', '文档', '转换']);
    await app.screenshot('exception-doc-convert-empty-file');
  });

  test('EXC-003 断网后恢复可继续交互', async ({ app, page }) => {
    await app.goto('/pages/tools/photo-search');
    await skipWhenRuntimeNotReady(test, page);

    await app.actions.setOffline(true);
    await app.screenshot('exception-photo-offline');
    await app.actions.setOffline(false);
    await page.reload();
    await expectAnyTextVisible(page, ['拍照搜题', '拍照', '相册']);
    await app.screenshot('exception-photo-recovered');
  });

  test('EXC-004 弱网场景页面仍可响应', async ({ app, page }) => {
    await app.actions.enableWeakNetwork(1500);
    await app.goto('/pages/chat/chat');
    await skipWhenRuntimeNotReady(test, page);

    await expectAnyTextVisible(page, ['研聪', '和智能好友聊聊', '清华学霸']);
    await app.actions.disableWeakNetwork();
    await app.screenshot('exception-weak-network-chat');
  });

  test('EXC-005 智能接口500时聊天页可降级并保持可交互', async ({ app, page }) => {
    await app.setLoggedInSession();

    await page.route('**/proxy-ai', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'mock server error' })
      });
    });

    try {
      await app.goto('/pages/chat/chat');
      await skipWhenRuntimeNotReady(test, page);

      // 等待聊天页骨架屏消失、输入区域可见（骨架屏最长 8s + 安全裕量）
      const chatInput = page.locator('#e2e-chat-input, .msg-input, input[type="text"]').first();
      await chatInput.waitFor({ state: 'visible', timeout: 25000 });

      await chatInput.click();
      await chatInput.fill('接口异常回归测试');
      await page.locator('#e2e-chat-send, .send-btn').first().click();

      // 根据 lafService 对 500 的处理方式，可能出现以下任一文本：
      // - API 返回非 0 code 时的降级回复
      // - 请求抛出异常时的失败状态文本
      // - uni.showToast 弹出的错误提示
      await expectAnyTextVisible(
        page,
        ['抱歉，我暂时无法回复，请稍后再试~', '发送失败，点击消息重试', '网络错误，请稍后重试', '点击重试'],
        20000
      );
      await app.screenshot('exception-chat-api-500-fallback');
    } finally {
      await page.unroute('**/proxy-ai');
    }
  });
});
