// @ts-nocheck
import { test, expect } from '../fixtures/regression.fixture.js';
import { expectAnyTextVisible, expectRoute } from '../helpers/assertions.js';

async function skipWhenRuntimeNotReady(test, page) {
  const runtime = await page.evaluate(() => {
    const textLen = (document.body?.innerText || '').trim().length;
    const hasUni = typeof window !== 'undefined' && typeof window.uni !== 'undefined';
    return { hasUni, textLen, ready: hasUni || textLen > 20 };
  });
  test.skip(!runtime.ready, `H5 runtime not ready: ${JSON.stringify(runtime)}`);
}

async function clickVisible(locator) {
  await locator
    .evaluate((el) => {
      el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' });
    })
    .catch(() => {});
  await locator.scrollIntoViewIfNeeded().catch(() => {});
  await locator.click({ timeout: 10_000 });
}

test.describe('A2-可点击入口真实交互', () => {
  test('CLICK-001 首页工具卡真实点击后可跳转到对应页面', async ({ app, page }) => {
    await app.setLoggedInSession();

    const targets = [
      {
        trigger: '#e2e-home-tool-doc',
        route: '/pages/tools/doc-convert',
        texts: ['文档转换', '选择文件', '开始转换']
      },
      {
        trigger: '#e2e-home-tool-id-photo',
        route: '/pages/tools/id-photo',
        texts: ['证件照制作', '背景颜色', '开始制作']
      },
      {
        trigger: '#e2e-home-tool-photo-search',
        route: '/pages/tools/photo-search',
        texts: ['拍照搜题', '相册', '开始识别']
      }
    ];

    for (const item of targets) {
      await app.gotoHome();
      await skipWhenRuntimeNotReady(test, page);
      await clickVisible(page.locator(item.trigger).first());
      await expectRoute(page, item.route);
      await expectAnyTextVisible(page, item.texts);
    }
  });

  test('CLICK-002 刷题页关键入口真实点击后可跳转或打开弹层', async ({ app, page }) => {
    await app.setLoggedInSession();

    await app.goto('/pages/practice/index');
    await skipWhenRuntimeNotReady(test, page);
    await clickVisible(page.locator('#e2e-practice-import-card').first());
    await expectRoute(page, '/pages/practice-sub/import-data');
    await expectAnyTextVisible(page, ['资料导入', '选择复习资料']);

    await app.goto('/pages/practice/index');
    await skipWhenRuntimeNotReady(test, page);
    await clickVisible(page.locator('#e2e-practice-menu-rank').first());
    await expectRoute(page, '/pages/practice-sub/rank');
    await expectAnyTextVisible(page, ['排行榜', '学习足迹', 'PK']);

    await app.goto('/pages/practice/index');
    await skipWhenRuntimeNotReady(test, page);
    await clickVisible(page.locator('#e2e-practice-menu-study-detail').first());
    await expectRoute(page, '/pages/study-detail/index');
    await expectAnyTextVisible(page, ['学习详情', '学习统计', '热力图']);

    await app.goto('/pages/practice/index');
    await skipWhenRuntimeNotReady(test, page);
    await clickVisible(page.locator('#e2e-practice-menu-modes').first());
    await expectAnyTextVisible(page, ['选择练习模式', '专项突破', '限时训练']);
  });

  test('CLICK-003 个人中心菜单真实点击后可跳转', async ({ app, page }) => {
    await app.setLoggedInSession();

    await app.goto('/pages/profile/index');
    await skipWhenRuntimeNotReady(test, page);
    await clickVisible(page.locator('#e2e-profile-menu-mistake').first());
    await expectRoute(page, '/pages/mistake/index');
    await expectAnyTextVisible(page, ['错题', '错题本', '复习']);

    await app.goto('/pages/profile/index');
    await skipWhenRuntimeNotReady(test, page);
    await clickVisible(page.locator('#e2e-profile-menu-study-detail').first());
    await expectRoute(page, '/pages/study-detail/index');
    await expectAnyTextVisible(page, ['学习详情', '学习统计', '趋势']);

    await app.goto('/pages/profile/index');
    await skipWhenRuntimeNotReady(test, page);
    await clickVisible(page.locator('#e2e-profile-menu-settings').first());
    await expectRoute(page, '/pages/settings/index');
    await expectAnyTextVisible(page, ['设置', '深色模式', '清除缓存数据']);
  });

  test('CLICK-004 设置页好友入口真实点击后可跳转', async ({ app, page }) => {
    await app.setLoggedInSession();
    await app.goto('/pages/settings/index');
    await skipWhenRuntimeNotReady(test, page);

    await clickVisible(page.locator('#e2e-settings-friends-entry').first());
    await expectRoute(page, '/pages/social/friend-list');
    await expectAnyTextVisible(page, ['我的好友', '好友请求', '搜索']);
  });

  test('CLICK-005 文档转换页点击选择文件会真实弹出文件选择并更新 UI', async ({ app, page }) => {
    await app.setLoggedInSession();
    await app.goto('/pages/tools/doc-convert');
    await skipWhenRuntimeNotReady(test, page);
    await expectAnyTextVisible(page, ['文档转换', '选择文件', '点击选择文件']);

    const chooserPromise = page.waitForEvent('filechooser');
    await clickVisible(page.locator('#e2e-doc-file-placeholder').first());
    const chooser = await chooserPromise;

    await chooser.setFiles({
      name: 'e2e-sample.docx',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      buffer: Buffer.from('mock docx content for click coverage')
    });

    await expect(page.getByText('e2e-sample.docx', { exact: false }).first()).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('#e2e-doc-start-convert').first()).toBeVisible({ timeout: 10_000 });
    await expectAnyTextVisible(page, ['开始转换', '文件读取中...', '继续转换']);
  });
});
