// @ts-nocheck
import { test, expect } from '../fixtures/regression.fixture.js';
import { expectAnyTextVisible, expectRoute } from '../helpers/assertions.js';

async function clickVisible(locator) {
  await locator
    .evaluate((el) => {
      el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' });
    })
    .catch(() => {});
  await locator.scrollIntoViewIfNeeded().catch(() => {});
  await locator.click({ timeout: 10_000, force: true });
}

async function installNativeSpy(page) {
  await page.evaluate(() => {
    window.__e2eNativeSpy = { clipboard: [], toasts: [], shares: [] };
    const uniApi = window.uni || {};

    uniApi.setClipboardData = ({ data, success }) => {
      window.__e2eNativeSpy.clipboard.push(String(data || ''));
      if (typeof success === 'function') success();
    };

    uniApi.showToast = ({ title = '', icon = '' } = {}) => {
      window.__e2eNativeSpy.toasts.push({ title, icon });
    };

    window.uni = uniApi;
    window.navigator.share = async (payload) => {
      window.__e2eNativeSpy.shares.push(payload || {});
      return true;
    };
  });
}

async function readNativeSpy(page) {
  return page.evaluate(() => window.__e2eNativeSpy || { clipboard: [], toasts: [], shares: [] });
}

test.describe('A2-分享与原生降级链路', () => {
  test('SHARE-001 首页每日金句分享面板可打开并关闭', async ({ app, page }) => {
    await app.setLoggedInSession();
    await app.gotoHome();

    await clickVisible(page.locator('#e2e-home-daily-quote').first());
    await expectAnyTextVisible(page, ['选择分享方式', '生成海报', '复制文案']);

    await page
      .locator('.share-modal-mask')
      .first()
      .click({ position: { x: 8, y: 8 }, force: true })
      .catch(() => {});
    await page.waitForTimeout(300);
    await expect(page.getByText('选择分享方式', { exact: false }).first()).toBeHidden({ timeout: 10_000 });
  });

  test('SHARE-002 院校详情页分享按钮在 H5 下优先分享，失败时回退复制', async ({ app, page }) => {
    await app.setLoggedInSession();
    await app.goto('/pages/school-sub/detail?id=e2e-school');
    await installNativeSpy(page);

    await expectAnyTextVisible(page, ['E2E 示例大学', '智能录取概率预测', '智能咨询']);
    await clickVisible(page.locator('#e2e-school-detail-share-btn').first());

    let nativeSpy = await readNativeSpy(page);
    expect(nativeSpy.shares).toHaveLength(1);
    expect(nativeSpy.clipboard).toHaveLength(0);

    await page.evaluate(() => {
      window.navigator.share = async () => {
        throw new Error('share blocked');
      };
    });

    await clickVisible(page.locator('#e2e-school-detail-share-btn').first());

    nativeSpy = await readNativeSpy(page);
    expect(nativeSpy.clipboard.length).toBeGreaterThan(0);
    expect(nativeSpy.toasts.some((item) => String(item.title || '').includes('院校信息已复制'))).toBeTruthy();
  });

  test('SHARE-003 登录页隐私政策与用户协议链接持续可访问', async ({ app, page }) => {
    await app.goto('/pages/login/index');
    await clickVisible(page.getByText('《隐私政策》', { exact: false }).first());
    await expectRoute(page, '/pages/settings/privacy');

    await app.goto('/pages/login/index');
    await clickVisible(page.getByText('《用户协议》', { exact: false }).first());
    await expectRoute(page, '/pages/settings/terms');
  });
});
