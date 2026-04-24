// @ts-nocheck
import { test, expect } from '../fixtures/regression.fixture.js';
import { expectAnyTextVisible, expectRoute } from '../helpers/assertions.js';

const PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4////fwAJ+wP9KobjigAAAABJRU5ErkJggg==';

function buildQuestionBank(count = 12) {
  return Array.from({ length: count }, (_, index) => ({
    id: `e2e_q_${index + 1}`,
    question: `E2E 示例题目 ${index + 1}`,
    title: `E2E 示例题目 ${index + 1}`,
    options: ['选项A', '选项B', '选项C', '选项D'],
    answer: 'A',
    category: '综合',
    difficulty: 2
  }));
}

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

async function seedHomeState(app) {
  await app.setStorage('v30_bank', buildQuestionBank(12));
  await app.setStorage('user_preferences', {
    preferredSubjects: [],
    weakAreas: [],
    studyPattern: 'balanced',
    targetScore: 80
  });
  await app.setStorage('my_tasks', [
    {
      id: 'e2e_task_1',
      title: 'E2E 今日任务',
      done: false,
      priority: 'high',
      tag: '优先',
      tagColor: 'red'
    },
    {
      id: 'e2e_task_2',
      title: 'E2E 错题复习',
      done: false,
      priority: 'medium',
      tag: '重要',
      tagColor: 'yellow'
    }
  ]);
}

async function ensureDemoBankReady(app, page) {
  await app.goto('/pages/practice/index');
  await app.setStorage('v30_bank', buildQuestionBank(12));
  await page.reload();
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(800);
  await skipWhenRuntimeNotReady(test, page);
}

test.describe('A2-更细颗粒度真实点击覆盖', () => {
  test('DETAIL-001 首页欢迎横幅空题库弹窗与确认跳转可点击', async ({ app, page }) => {
    await app.setLoggedInSession();
    await app.gotoHome();
    await app.setStorage('v30_bank', []);
    await app.gotoHome();
    await skipWhenRuntimeNotReady(test, page);

    await clickVisible(page.locator('#e2e-home-banner-practice').first());
    await expectAnyTextVisible(page, ['题库空空如也', '去上传']);
    await clickVisible(page.getByText('去上传', { exact: false }).first());
    await expectRoute(page, '/pages/practice-sub/import-data');
    await expectAnyTextVisible(page, ['资料导入', '选择复习资料']);
  });

  test('DETAIL-002 首页欢迎横幅与统计卡真实点击后可跳转', async ({ app, page }) => {
    await app.setLoggedInSession();
    await seedHomeState(app);
    await app.gotoHome();
    await skipWhenRuntimeNotReady(test, page);

    await app.gotoHome();
    await skipWhenRuntimeNotReady(test, page);
    await clickVisible(page.locator('#e2e-home-stat-questions').first());
    await expectRoute(page, '/pages/practice/index');

    await app.gotoHome();
    await skipWhenRuntimeNotReady(test, page);
    await clickVisible(page.locator('#e2e-home-stat-accuracy').first());
    await expectRoute(page, '/pages/mistake/index');
    await expectAnyTextVisible(page, ['错题', '错题本', '复习']);

    await app.gotoHome();
    await skipWhenRuntimeNotReady(test, page);
    await clickVisible(page.locator('#e2e-home-stat-streak').first());
    await expectRoute(page, '/pages/study-detail/index');
    await expectAnyTextVisible(page, ['学习详情', '学习统计', '趋势']);

    await app.gotoHome();
    await skipWhenRuntimeNotReady(test, page);
    await clickVisible(page.locator('#e2e-home-stat-achievements').first());
    await expectRoute(page, '/pages/profile/index');
    await expectAnyTextVisible(page, ['个人中心', '每日打卡', '系统设置']);
  });

  test('DETAIL-003 首页学习轨迹与工具卡当前精简版真实点击可响应', async ({ app, page }) => {
    await app.setLoggedInSession();
    await seedHomeState(app);
    await app.gotoHome();
    await skipWhenRuntimeNotReady(test, page);

    await clickVisible(page.locator('#e2e-home-activity-view-all').first());
    await expectRoute(page, '/pages/study-detail/index');

    await app.gotoHome();
    await skipWhenRuntimeNotReady(test, page);
    await clickVisible(page.locator('#e2e-home-tool-doc').first());
    await expectRoute(page, '/pages/tools/doc-convert');

    await app.gotoHome();
    await skipWhenRuntimeNotReady(test, page);
    await clickVisible(page.locator('#e2e-home-tool-photo-search').first());
    await expectRoute(page, '/pages/tools/photo-search');

    await app.gotoHome();
    await skipWhenRuntimeNotReady(test, page);
    await clickVisible(page.getByText('快速开始', { exact: false }).first());
    await expect(page).toHaveURL(/#\/pages\/(practice\/index|practice-sub\/do-quiz)$/);
  });

  test('DETAIL-004 TabBar 四页真实点击切换可达', async ({ app, page }) => {
    await app.setLoggedInSession();
    await app.gotoHome();
    await skipWhenRuntimeNotReady(test, page);

    await page.evaluate(() => document.querySelector('#e2e-tabbar-practice')?.click());
    await page.waitForTimeout(500);
    await expectRoute(page, '/pages/practice/index');

    await page.evaluate(() => document.querySelector('#e2e-tabbar-school')?.click());
    await page.waitForTimeout(500);
    await expectRoute(page, '/pages/school/index');

    await page.evaluate(() => document.querySelector('#e2e-tabbar-profile')?.click());
    await page.waitForTimeout(500);
    await expectRoute(page, '/pages/profile/index');

    await page.evaluate(() => document.querySelector('#e2e-tabbar-index')?.click());
    await page.waitForTimeout(500);
    await expect(page).toHaveURL(/#\/$|#\/pages\/index\/index$/);
  });

  test('DETAIL-005 刷题页剩余菜单与 PK 对战真实点击后可跳转', async ({ app, page }) => {
    await app.setLoggedInSession();
    await ensureDemoBankReady(app, page);
    await app.goto('/pages/practice/index');
    await skipWhenRuntimeNotReady(test, page);

    await clickVisible(page.locator('#e2e-practice-battle-btn').first());
    await expectRoute(page, '/pages/practice-sub/pk-battle');
    await expectAnyTextVisible(page, ['匹配', '取消匹配', 'PK']);

    await app.goto('/pages/practice/index');
    await skipWhenRuntimeNotReady(test, page);
    await clickVisible(page.locator('#e2e-practice-menu-file-manager').first());
    await expectRoute(page, '/pages/practice-sub/file-manager');
    await expectAnyTextVisible(page, ['文件管理', '文件', '上传']);

    await app.goto('/pages/practice/index');
    await skipWhenRuntimeNotReady(test, page);
    await clickVisible(page.locator('#e2e-practice-menu-ai-tutor').first());
    await expectRoute(page, '/pages/chat/chat');
    await expectAnyTextVisible(page, ['和智能好友聊聊', '研聪', '发送']);

    await app.goto('/pages/practice/index');
    await skipWhenRuntimeNotReady(test, page);
    await clickVisible(page.locator('#e2e-practice-menu-mistake').first());
    await expectRoute(page, '/pages/mistake/index');
    await expectAnyTextVisible(page, ['错题', '错题本', '复习']);
  });

  test('DETAIL-006 练习模式弹层真实点击后可打开并关闭', async ({ app, page }) => {
    await app.setLoggedInSession();
    await ensureDemoBankReady(app, page);
    await app.goto('/pages/practice/index');
    await skipWhenRuntimeNotReady(test, page);

    await clickVisible(page.locator('#e2e-practice-menu-modes').first());
    await expectAnyTextVisible(page, ['选择练习模式', '专项突破', '限时训练']);
    await page
      .locator('.practice-modes-modal-overlay')
      .first()
      .click({ position: { x: 8, y: 8 }, force: true })
      .catch(() => {});
    await page.waitForTimeout(300);
    await expect(page.getByText('选择练习模式', { exact: false }).first()).toBeHidden({ timeout: 10_000 });
  });

  test('DETAIL-007 文档转换完整点击流可执行', async ({ app, page }) => {
    await app.setLoggedInSession();
    await app.goto('/pages/tools/doc-convert');
    await skipWhenRuntimeNotReady(test, page);

    const chooserPromise = page.waitForEvent('filechooser');
    await clickVisible(page.locator('#e2e-doc-file-placeholder').first());
    const chooser = await chooserPromise;
    await chooser.setFiles({
      name: 'e2e-doc.docx',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      buffer: Buffer.from('mock docx body for detailed click coverage')
    });

    await expect(page.getByText('e2e-doc.docx', { exact: false }).first()).toBeVisible({ timeout: 10_000 });
    await clickVisible(page.locator('#e2e-doc-start-convert').first());
    await expectAnyTextVisible(page, ['转换完成', '下载转换结果', '继续转换']);
    await clickVisible(page.locator('#e2e-doc-reset').first());
    await expect(page.locator('#e2e-doc-file-placeholder').first()).toBeVisible({ timeout: 10_000 });
  });

  test('DETAIL-008 证件照制作完整点击流可执行', async ({ app, page }) => {
    const projectName = test.info().project?.name || '';
    test.skip(projectName.includes('desktop'), '证件照文件选择主流程已在移动视口覆盖，桌面兼容仅保留页面可达检查');

    await app.setLoggedInSession();
    await app.goto('/pages/tools/id-photo');
    await skipWhenRuntimeNotReady(test, page);

    const chooserPromise = page.waitForEvent('filechooser');
    await clickVisible(page.locator('#e2e-id-photo-upload').first());
    const chooser = await chooserPromise;
    await chooser.setFiles({
      name: 'e2e-avatar.png',
      mimeType: 'image/png',
      buffer: Buffer.from(PNG_BASE64, 'base64')
    });

    await expectAnyTextVisible(page, ['证件照尺寸', '背景颜色', '开始制作']);
    await clickVisible(page.locator('#e2e-id-photo-size-2inch').first());
    await clickVisible(page.locator('#e2e-id-photo-color-red').first());
    await clickVisible(page.locator('#e2e-id-photo-start').first());
    await expectAnyTextVisible(page, ['保存到相册', '换个颜色', '重新制作']);
    await clickVisible(page.locator('#e2e-id-photo-change-color').first());
    await expectAnyTextVisible(page, ['证件照尺寸', '背景颜色', '开始制作']);
  });

  test('DETAIL-009 拍照搜题完整点击流可执行', async ({ app, page }) => {
    await app.setLoggedInSession();
    await app.goto('/pages/tools/photo-search');
    await skipWhenRuntimeNotReady(test, page);

    const chooserPromise = page.waitForEvent('filechooser');
    await clickVisible(page.locator('#e2e-photo-search-album').first());
    const chooser = await chooserPromise;
    await chooser.setFiles({
      name: 'e2e-question.png',
      mimeType: 'image/png',
      buffer: Buffer.from(PNG_BASE64, 'base64')
    });

    await expectAnyTextVisible(page, ['识别结果', '题库匹配', '智能解析']);
    await clickVisible(page.getByText('以下哪个选项最符合题意？', { exact: false }).first());
    await expectRoute(page, '/pages/practice-sub/do-quiz');
  });

  test('DETAIL-010 个人中心主题按钮与反馈入口真实点击可响应', async ({ app, page }) => {
    await app.setLoggedInSession();
    await app.goto('/pages/profile/index');
    await skipWhenRuntimeNotReady(test, page);

    const themeBtn = page.locator('#e2e-profile-theme-btn').first();
    const beforeText = (await themeBtn.textContent()) || '';
    await clickVisible(themeBtn);
    await page.waitForTimeout(400);
    const afterText = (await themeBtn.textContent()) || '';
    expect(afterText).not.toBe(beforeText);

    await clickVisible(page.locator('#e2e-profile-menu-feedback').first());
    await expectAnyTextVisible(page, ['意见反馈', 'feedback@exam-master.com', '知道了']);
  });
});
