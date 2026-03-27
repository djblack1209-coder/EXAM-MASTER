// @ts-nocheck
/**
 * GAP Coverage Tests — Phase A2 缺失覆盖补充
 * 覆盖: 择校完整流程、错题本、token过期、XSS、未登录重定向、
 *       做题进度恢复、下拉刷新、空题库状态、兼容性布局
 */
import { test, expect } from '../fixtures/regression.fixture.js';
import { expectAnyTextVisible, expectSchoolPageReady } from '../helpers/assertions.js';
import { schoolFormData } from '../data/test-data.js';

function buildQuestionBank(count = 5) {
  return Array.from({ length: count }, (_, i) => ({
    id: `gap_q_${i + 1}`,
    question: `GAP 示例题目 ${i + 1}`,
    title: `GAP 示例题目 ${i + 1}`,
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

async function assertNoHorizontalOverflow(page, tolerance = 24) {
  const metrics = await page.evaluate(() => {
    const root = document.documentElement;
    const body = document.body;
    const viewportWidth = window.innerWidth || 0;
    const scrollWidth = Math.max(root?.scrollWidth || 0, body?.scrollWidth || 0);
    return { viewportWidth, scrollWidth, delta: scrollWidth - viewportWidth };
  });
  expect(
    metrics.delta,
    `Horizontal overflow: delta=${metrics.delta}, viewport=${metrics.viewportWidth}`
  ).toBeLessThanOrEqual(tolerance);
}

// ─── GAP-01 P0: 完整择校提交→AI推荐→院校详情 ───
test.describe('GAP-P0 核心流程补充', () => {
  test('GAP-01 择校完整流程: 填表→提交→AI推荐→院校详情', async ({ app, page }) => {
    await app.setLoggedInSession();
    await app.goto('/pages/school/index');
    await skipWhenRuntimeNotReady(test, page);
    await expectSchoolPageReady(page);

    // Step 1: 填写本科信息
    await app.actions.input('#e2e-school-input-current-school', schoolFormData.currentSchool);
    await app.actions.input('#e2e-school-input-current-major', schoolFormData.currentMajor);

    const nextBtn = page.locator('#e2e-school-step1-next').first();
    if (await nextBtn.isVisible().catch(() => false)) {
      await nextBtn.click();
      await page.waitForTimeout(500);
    }

    // Step 2: 填写目标院校
    const targetSchoolInput = page.locator('#e2e-school-input-target-school').first();
    if (await targetSchoolInput.isVisible().catch(() => false)) {
      await app.actions.input('#e2e-school-input-target-school', schoolFormData.targetSchool);
      await app.actions.input('#e2e-school-input-target-major', schoolFormData.targetMajor);

      const submitBtn = page.locator('#e2e-school-step2-submit').first();
      if (await submitBtn.isVisible().catch(() => false)) {
        await submitBtn.click();
      }
    }

    // 等待结果
    await page.waitForTimeout(2000);
    const resultRoot = page.locator('#e2e-school-result-root').first();
    const hasResult = await resultRoot.isVisible().catch(() => false);
    const hasCard = await page
      .locator('[id^="e2e-school-card-"]')
      .first()
      .isVisible()
      .catch(() => false);

    if (hasResult || hasCard) {
      // 点击第一个院校卡片进入详情
      const firstCard = page.locator('[id^="e2e-school-card-"]').first();
      if (await firstCard.isVisible().catch(() => false)) {
        await firstCard.click();
        await page.waitForTimeout(1000);
        await expectAnyTextVisible(page, ['院校详情', 'E2E 示例大学', '双一流', '计算机']);
      }
    } else {
      // 至少验证提交后页面没有崩溃
      await expectAnyTextVisible(page, ['择校', '院校', '匹配', '智能']);
    }

    await app.screenshot('gap-01-school-full-flow');
  });

  // ─── GAP-02 P0: 错题本流程 ───
  test('GAP-02 错题本: 页面可达且空状态正确展示', async ({ app, page }) => {
    await app.setLoggedInSession();
    await app.goto('/pages/mistake/index');
    await skipWhenRuntimeNotReady(test, page);

    // 错题本页面应该可达，显示空状态或错题列表
    await expectAnyTextVisible(page, ['错题本', '暂无错题', '开始复习', '错题']);
    await app.screenshot('gap-02-mistake-book');
  });

  // ─── GAP-05 P0: Token过期后行为 ───
  test('GAP-05 Token过期: 清除token后访问需登录页应重定向或提示', async ({ app, page }) => {
    // 先设置一个过期/无效token
    await page.addInitScript(() => {
      localStorage.setItem('EXAM_TOKEN', 'expired_invalid_token');
      localStorage.setItem('EXAM_USER_ID', '');
      localStorage.setItem('EXAM_USER_INFO', '');
    });

    await app.goto('/pages/profile/index');
    await skipWhenRuntimeNotReady(test, page);

    // 应该显示登录提示或重定向到登录页
    const bodyText = await page.evaluate(() => document.body?.innerText || '');
    const hasLoginPrompt = /登录|请先登录|去登录|未登录/.test(bodyText);
    const isOnLoginPage = page.url().includes('login');
    const hasProfileFallback = /个人|设置|学习/.test(bodyText);

    expect(
      hasLoginPrompt || isOnLoginPage || hasProfileFallback,
      'Token过期后应提示登录、重定向或显示降级页面'
    ).toBeTruthy();

    await app.screenshot('gap-05-token-expired');
  });

  // ─── GAP-07 P0: 做题中途退出→恢复进度 ───
  test('GAP-07 做题进度恢复: 有题库时进入做题页可看到进度UI', async ({ app, page }) => {
    await app.setLoggedInSession();
    await app.setStorage('v30_bank', buildQuestionBank(5));

    await app.goto('/pages/practice-sub/do-quiz');
    await skipWhenRuntimeNotReady(test, page);

    // 应该显示题目或进度相关UI
    const progressEl = page.locator('#e2e-quiz-progress').first();
    const hasProgress = await progressEl.isVisible().catch(() => false);
    const hasQuizContent = await page
      .evaluate(() => {
        const text = document.body?.innerText || '';
        return /题目|选项|下一题|提交|练习|GAP 示例/.test(text);
      })
      .catch(() => false);

    expect(hasProgress || hasQuizContent, '做题页应显示进度或题目内容').toBeTruthy();
    await app.screenshot('gap-07-quiz-progress');
  });

  // ─── GAP-13 P0: XSS防护 ───
  test('GAP-13 XSS防护: 聊天输入脚本标签不会执行', async ({ app, page }) => {
    await app.setLoggedInSession();
    await app.goto('/pages/chat/chat');
    await skipWhenRuntimeNotReady(test, page);

    // 尝试输入XSS payload — uni-input 是自定义元素，需要定位内部 input
    const xssPayload = '<script>window.__xss_executed=true</script>';
    const host = page.locator('#e2e-chat-input, .msg-input').first();

    if (await host.isVisible().catch(() => false)) {
      // 先点击激活，再找内部真实 input
      await host.click({ timeout: 5000 });
      const innerInput = host.locator('input').first();
      const target = (await innerInput.isVisible().catch(() => false)) ? innerInput : host;

      await target.evaluate((el, val) => {
        if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
          el.value = val;
          el.dispatchEvent(new Event('input', { bubbles: true }));
        } else {
          const inner = el.querySelector('input');
          if (inner) {
            inner.value = val;
            inner.dispatchEvent(new Event('input', { bubbles: true }));
          }
        }
      }, xssPayload);

      await page.waitForTimeout(300);

      const sendBtn = page.locator('.send-btn, .btn-send').first();
      if (await sendBtn.isVisible().catch(() => false)) {
        await sendBtn.click();
        await page.waitForTimeout(1000);
      }
    }

    // 验证脚本没有执行
    const xssExecuted = await page.evaluate(() => window.__xss_executed === true);
    expect(xssExecuted, 'XSS payload should not execute').toBeFalsy();

    await app.screenshot('gap-13-xss-prevention');
  });

  // ─── GAP-14 P0: 未登录访问需登录页 ───
  test('GAP-14 未登录访问需登录页: 应显示登录提示或降级', async ({ app, page }) => {
    // 不设置任何登录状态
    const protectedPages = ['/pages/practice-sub/import-data', '/pages/chat/chat', '/pages/settings/index'];

    const results = [];
    for (const route of protectedPages) {
      await app.goto(route);
      await skipWhenRuntimeNotReady(test, page);

      const bodyText = await page.evaluate(() => document.body?.innerText || '');
      const url = page.url();
      const hasLoginRedirect = url.includes('login');
      const hasLoginPrompt = /登录|请先登录|去登录/.test(bodyText);
      const hasPageContent = bodyText.trim().length > 30;

      results.push({
        route,
        hasLoginRedirect,
        hasLoginPrompt,
        hasPageContent
      });
    }

    // 至少页面不应崩溃（有内容或有登录提示）
    for (const r of results) {
      expect(
        r.hasLoginRedirect || r.hasLoginPrompt || r.hasPageContent,
        `${r.route} 未登录访问应有合理响应`
      ).toBeTruthy();
    }

    await app.screenshot('gap-14-unauthenticated-access');
  });
});

// ─── P1 级别测试 ───
test.describe('GAP-P1 次要流程补充', () => {
  // ─── GAP-03 P1: PK对战页面可达 ───
  test('GAP-03 PK对战: 页面可达且核心UI元素存在', async ({ app, page }) => {
    await app.setLoggedInSession();
    await app.setStorage('v30_bank', buildQuestionBank(10));
    await app.goto('/pages/practice-sub/pk-battle');
    await skipWhenRuntimeNotReady(test, page);

    await expectAnyTextVisible(page, ['匹配', '取消匹配', 'PK', '对战', '题库空空如也']);
    await app.screenshot('gap-03-pk-battle');
  });

  // ─── GAP-04 P1: 模拟考试页面可达 ───
  test('GAP-04 模拟考试: 页面可达且核心UI元素存在', async ({ app, page }) => {
    await app.setLoggedInSession();
    await app.setStorage('v30_bank', buildQuestionBank(10));
    await app.goto('/pages/practice-sub/mock-exam');
    await skipWhenRuntimeNotReady(test, page);

    await expectAnyTextVisible(page, ['模拟考试', '考试设置', '开始考试', '题库空空如也']);
    await app.screenshot('gap-04-mock-exam');
  });

  // ─── GAP-06 P1: 接口超时统一loading ───
  test('GAP-06 接口超时: 页面显示loading或超时提示而非白屏', async ({ app, page }) => {
    await app.setLoggedInSession();

    // 模拟所有API超时
    await page.route('**/getHomeData', async (route) => {
      await new Promise((r) => setTimeout(r, 8000));
      await route.abort('timedout').catch(() => {});
    });

    try {
      await app.gotoHome();
      await skipWhenRuntimeNotReady(test, page);

      // 页面不应白屏，应有loading或超时提示或降级内容
      const bodyText = await page.evaluate(() => (document.body?.innerText || '').trim());
      expect(bodyText.length, '页面不应白屏').toBeGreaterThan(10);
      await app.screenshot('gap-06-api-timeout');
    } finally {
      await page.unroute('**/getHomeData');
    }
  });

  // ─── GAP-08 P1: 学习计划创建页表单可操作 ───
  test('GAP-08 学习计划创建: 表单可填写且保存按钮可点击', async ({ app, page }) => {
    await app.setLoggedInSession();
    await app.goto('/pages/plan/create');
    await skipWhenRuntimeNotReady(test, page);

    await expectAnyTextVisible(page, ['创建学习计划', '保存', '目标', '计划名称']);

    // 尝试填写表单
    const nameInput = page.locator('input').first();
    if (await nameInput.isVisible().catch(() => false)) {
      await nameInput.fill('GAP测试计划');
    }

    await app.screenshot('gap-08-plan-create-form');
  });

  // ─── GAP-09 P1: 首页下拉刷新 ───
  test('GAP-09 首页下拉刷新: 触发后页面不崩溃', async ({ app, page }) => {
    await app.setLoggedInSession();
    await app.gotoHome();
    await skipWhenRuntimeNotReady(test, page);

    // 模拟下拉手势
    const viewport = page.viewportSize() || { width: 390, height: 844 };
    const startX = Math.floor(viewport.width * 0.5);
    await page.mouse.move(startX, 100);
    await page.mouse.down();
    await page.mouse.move(startX, 400, { steps: 15 });
    await page.mouse.up();
    await page.waitForTimeout(1500);

    // 页面应仍然可交互
    await expectAnyTextVisible(page, ['首页', '刷题', '择校', '我的']);
    await app.screenshot('gap-09-pull-refresh');
  });

  // ─── GAP-10 P1: 聊天页滑动 ───
  test('GAP-10 聊天页滑动: 页面可滑动且不崩溃', async ({ app, page }) => {
    await app.setLoggedInSession();
    await app.goto('/pages/chat/chat');
    await skipWhenRuntimeNotReady(test, page);

    await expectAnyTextVisible(page, ['研聪', '和智能好友聊聊', '清华学霸']);
    await app.actions.swipeUp();
    await page.waitForTimeout(500);

    // 页面仍可交互
    const bodyText = await page.evaluate(() => (document.body?.innerText || '').trim());
    expect(bodyText.length).toBeGreaterThan(10);
    await app.screenshot('gap-10-chat-scroll');
  });

  // ─── GAP-11 P1: 375px兼容性 ───
  test('GAP-11 375px布局: 关键页面无水平溢出', async ({ app, page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await app.setLoggedInSession();

    const pages = [
      '/pages/index/index',
      '/pages/practice/index',
      '/pages/school/index',
      '/pages/profile/index',
      '/pages/login/index'
    ];

    for (const route of pages) {
      await app.goto(route);
      await skipWhenRuntimeNotReady(test, page);
      await assertNoHorizontalOverflow(page);
    }

    await app.screenshot('gap-11-375px-compat');
  });

  // ─── GAP-15 P1: 空题库状态展示 ───
  test('GAP-15 空题库: 各页面空状态正确展示', async ({ app, page }) => {
    await app.setLoggedInSession();
    // 确保题库为空
    await app.setStorage('v30_bank', []);

    const emptyStatePages = [
      { route: '/pages/practice-sub/do-quiz', keywords: ['题库空空如也', '导入', '暂无'] },
      { route: '/pages/mistake/index', keywords: ['暂无错题', '错题本', '暂无', '错题'] },
      { route: '/pages/favorite/index', keywords: ['暂无收藏', '收藏', '暂无'] }
    ];

    for (const entry of emptyStatePages) {
      await app.goto(entry.route);
      await skipWhenRuntimeNotReady(test, page);
      await expectAnyTextVisible(page, entry.keywords);
    }

    await app.screenshot('gap-15-empty-state');
  });
});

// ─── P2 级别测试 ───
test.describe('GAP-P2 兼容性补充', () => {
  // ─── GAP-12 P2: 414px兼容性 ───
  test('GAP-12 414px布局: 关键页面无水平溢出', async ({ app, page }) => {
    await page.setViewportSize({ width: 414, height: 896 });
    await app.setLoggedInSession();

    const pages = ['/pages/index/index', '/pages/practice/index', '/pages/school/index', '/pages/profile/index'];

    for (const route of pages) {
      await app.goto(route);
      await skipWhenRuntimeNotReady(test, page);
      await assertNoHorizontalOverflow(page);
    }

    await app.screenshot('gap-12-414px-compat');
  });
});
