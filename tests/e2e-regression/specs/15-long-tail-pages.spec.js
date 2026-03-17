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

function hasToast(uiSpy, pattern) {
  return uiSpy.toasts.some((item) => pattern.test(item.title));
}

async function installUniUiSpy(page) {
  await page.evaluate(() => {
    window.__e2eUiSpy = { modals: [], toasts: [], actionSheets: [], loadingCalls: 0, hideLoadingCalls: 0 };
    const uniApi = window.uni || {};

    uniApi.showModal = (options = {}) => {
      window.__e2eUiSpy.modals.push({
        title: options.title || '',
        content: options.content || '',
        confirmText: options.confirmText || '',
        cancelText: options.cancelText || ''
      });
      if (typeof options.success === 'function') {
        options.success({ confirm: true, cancel: false, tapIndex: 0, content: 'E2E Edited Value' });
      }
    };

    uniApi.showToast = (options = {}) => {
      window.__e2eUiSpy.toasts.push({ title: options.title || '', icon: options.icon || '' });
      if (typeof options.success === 'function') {
        options.success();
      }
    };

    uniApi.showActionSheet = (options = {}) => {
      window.__e2eUiSpy.actionSheets.push({ itemList: options.itemList || [] });
      if (typeof options.success === 'function') {
        options.success({ tapIndex: 0 });
      }
    };

    uniApi.showLoading = () => {
      window.__e2eUiSpy.loadingCalls += 1;
    };

    uniApi.hideLoading = () => {
      window.__e2eUiSpy.hideLoadingCalls += 1;
    };

    window.uni = uniApi;
  });
}

async function readUiSpy(page) {
  return page.evaluate(() => window.__e2eUiSpy || { modals: [], toasts: [], actionSheets: [] });
}

async function seedFavorites(app) {
  await app.setStorage('question_favorites', [
    {
      id: 'fav_e2e_1',
      questionId: 'q_e2e_1',
      questionContent: 'E2E 收藏题 1',
      options: ['选项A', '选项B', '选项C', '选项D'],
      answer: 'A',
      analysis: 'E2E 收藏题解析',
      category: '数学',
      folderId: 'default',
      note: '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      reviewCount: 1,
      lastReviewAt: Date.now()
    }
  ]);
}

async function seedFiles(app) {
  await app.setStorage('imported_files', [
    {
      name: 'E2E-资料.pdf',
      size: 512,
      date: '2026-03-08',
      source: 'E2E 导入',
      status: 'completed'
    },
    {
      name: 'E2E-总结.docx',
      size: 128,
      date: '2026-03-08',
      source: 'E2E 导入',
      status: 'ready'
    }
  ]);
}

async function seedPlans(app) {
  await app.setStorage('study_plans', [
    {
      id: 'plan_e2e_seed',
      name: 'E2E 周计划',
      goal: '完成 12 道高频题并整理错题',
      startDate: '2026-03-08',
      endDate: '2026-03-15',
      dailyDuration: '2小时',
      reminderTime: '08:00',
      category: '综合',
      priority: 'high',
      progress: 50,
      status: 'in_progress',
      tasks: [{ id: 'task_1', title: '刷题', completed: true }],
      analytics: {
        completionRate: 50,
        progressTrend: { trend: 8, projected: 82 },
        recommendedAdjustments: [{ priority: 'medium', message: '保持每日 2 小时节奏' }]
      }
    }
  ]);
  await app.setStorage('study_stats', { completionRate: 62, progress: 62 });
}

async function seedKnowledgeState(app) {
  await app.setStorage('v30_bank', [
    { id: 'kg_1', question: '数学题 1', category: '数学', options: ['A', 'B'], answer: 'A' },
    { id: 'kg_2', question: '数学题 2', category: '数学', options: ['A', 'B'], answer: 'A' },
    { id: 'kg_3', question: '数学题 3', category: '数学', options: ['A', 'B'], answer: 'A' },
    { id: 'kg_4', question: '英语题 1', category: '英语', options: ['A', 'B'], answer: 'A' },
    { id: 'kg_5', question: '英语题 2', category: '英语', options: ['A', 'B'], answer: 'A' },
    { id: 'kg_6', question: '英语题 3', category: '英语', options: ['A', 'B'], answer: 'A' }
  ]);
  await app.setStorage('study_record', {
    totalAnswered: 24,
    correctCount: 18,
    mistakeReviewCount: 3
  });
}

async function mockSocialApi(page) {
  let friends = [
    {
      uid: 'friend_e2e_1',
      nickname: '回归好友A',
      avatar: '/static/images/default-avatar.png',
      score: 188,
      studyDays: 28,
      accuracy: 86,
      last_active: Date.now()
    }
  ];

  let requests = [
    {
      user_id: 'request_e2e_1',
      requester_info: {
        nickname: '待处理好友',
        avatar_url: '/static/images/default-avatar.png'
      },
      request_message: '一起回归测试',
      created_at: Date.now()
    }
  ];

  await page.route('**/social-service', async (route) => {
    let payload = {};
    try {
      payload = JSON.parse(route.request().postData() || '{}');
    } catch {
      payload = {};
    }

    if (payload.action === 'get_friend_list') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ code: 0, msg: 'ok', data: friends })
      });
      return;
    }

    if (payload.action === 'get_friend_requests') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ code: 0, msg: 'ok', data: requests })
      });
      return;
    }

    if (payload.action === 'search_user') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 0,
          msg: 'ok',
          data: [{ _id: 'search_e2e_1', nickname: '待添加研友', avatar: '', score: 99 }]
        })
      });
      return;
    }

    if (payload.action === 'send_request') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ code: 0, msg: '好友请求已发送' })
      });
      return;
    }

    if (payload.action === 'handle_request') {
      requests = requests.filter((item) => (item.user_id || item.from_uid) !== payload.fromUid);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ code: 0, msg: '处理成功' })
      });
      return;
    }

    if (payload.action === 'remove_friend') {
      friends = friends.filter((item) => item.uid !== payload.friendUid);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ code: 0, msg: '已删除好友' })
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ code: 0, msg: 'ok', data: [] })
    });
  });
}

test.describe('A2-长尾页面深度回归', () => {
  test('LONG-001 收藏页支持答案展开、笔记保存与跳转练习', async ({ app, page }) => {
    await app.setLoggedInSession();
    await seedFavorites(app);
    await app.goto('/pages/favorite/index');

    await expectAnyTextVisible(page, ['我的收藏', 'E2E 收藏题 1', '查看答案']);
    await clickVisible(page.getByText('查看答案', { exact: false }).first());
    await expect(page.getByText('选项A', { exact: false }).first()).toBeVisible({ timeout: 10_000 });

    await clickVisible(page.getByText('添加笔记', { exact: false }).first());
    await app.actions.input('textarea', 'E2E 收藏笔记');
    await clickVisible(page.getByText('保存', { exact: false }).first());
    await expect(page.getByText('我的笔记', { exact: false }).first()).toBeVisible({ timeout: 10_000 });

    await clickVisible(page.getByText('练习此题', { exact: false }).first());
    await expectRoute(page, '/pages/practice-sub/do-quiz');
  });

  test('LONG-002 文件管理页支持查看文件信息、删除与清空', async ({ app, page }) => {
    await app.setLoggedInSession();
    await seedFiles(app);
    await app.goto('/pages/practice-sub/file-manager');
    await installUniUiSpy(page);

    await expectAnyTextVisible(page, ['文件管理', 'E2E-资料.pdf', 'E2E-总结.docx']);
    await clickVisible(page.getByText('查看', { exact: false }).first());

    let uiSpy = await readUiSpy(page);
    expect(uiSpy.modals.at(-1)?.title).toContain('文件信息');
    expect(uiSpy.modals.at(-1)?.content).toContain('E2E-资料.pdf');

    await clickVisible(page.getByText('删除', { exact: false }).first());
    await expect(page.getByText('E2E-资料.pdf', { exact: false }).first()).toBeHidden({ timeout: 10_000 });

    await clickVisible(page.locator('.icon-btn.danger').first());
    await expectAnyTextVisible(page, ['暂无文件', '导入学习资料后，文件将显示在这里']);
  });

  test('LONG-003 好友页支持搜索加好友、查看资料与删除好友', async ({ app, page }) => {
    await app.setLoggedInSession();
    await mockSocialApi(page);
    await app.goto('/pages/social/friend-list');
    await installUniUiSpy(page);

    await expectAnyTextVisible(page, ['我的好友', '好友请求', '回归好友A']);
    await app.actions.input('.search-input-wrapper', '研友');
    await clickVisible(page.locator('.search-btn').first());
    await expect(page.getByText('待添加研友', { exact: false }).first()).toBeVisible({ timeout: 10_000 });

    await clickVisible(page.getByText('添加', { exact: false }).first());
    await page.waitForTimeout(600);
    let uiSpy = await readUiSpy(page);
    expect(uiSpy.toasts.some((item) => /好友请求已发送/.test(item.title))).toBe(true);

    await clickVisible(page.getByText('回归好友A', { exact: false }).first());
    await expectRoute(page, '/pages/social/friend-profile');
    await expectAnyTextVisible(page, ['好友资料', '发起 PK 挑战', '删除好友']);

    await clickVisible(page.getByText('删除好友', { exact: false }).first());
    await page.waitForTimeout(1700);
    await expectRoute(page, '/pages/social/friend-list');
  });

  test('LONG-004 知识图谱支持掌握度查看、节点详情与练习跳转', async ({ app, page }) => {
    await app.setLoggedInSession();
    await seedKnowledgeState(app);
    await app.goto('/pages/knowledge-graph/index');
    await installUniUiSpy(page);

    await expectAnyTextVisible(page, ['知识图谱', '掌握分布', '学习路径']);

    await clickVisible(page.getByText('掌握分布', { exact: false }).first());
    let uiSpy = await readUiSpy(page);
    expect(uiSpy.modals.at(-1)?.title).toBe('知识掌握度分布');

    await clickVisible(page.locator('.quick-action').nth(1));
    uiSpy = await readUiSpy(page);
    expect(uiSpy.modals.at(-1)?.title === '推荐学习路径' || hasToast(uiSpy, /暂无学习建议/)).toBe(true);

    await clickVisible(page.locator('.quick-action').nth(2));
    uiSpy = await readUiSpy(page);
    expect(uiSpy.modals.at(-1)?.title === '知识关联分析' || hasToast(uiSpy, /暂无关联数据/)).toBe(true);

    await clickVisible(page.locator('.quick-action').nth(4));
    uiSpy = await readUiSpy(page);
    expect(uiSpy.modals.at(-1)?.title === '薄弱知识点' || hasToast(uiSpy, /暂无薄弱知识点/)).toBe(true);
  });

  test('LONG-005 学习计划支持详情查看、智能调整与删除', async ({ app, page }) => {
    await app.setLoggedInSession();
    await seedPlans(app);
    await app.goto('/pages/plan/index');
    await installUniUiSpy(page);

    await expectAnyTextVisible(page, ['学习计划', 'E2E 周计划', '智能调整']);

    await clickVisible(page.getByText('查看详情', { exact: false }).first());
    let uiSpy = await readUiSpy(page);
    expect(uiSpy.modals.at(-1)?.title).toBe('计划详情');
    expect(uiSpy.modals.at(-1)?.content).toContain('E2E 周计划');

    await clickVisible(page.getByText('智能调整', { exact: false }).first());
    uiSpy = await readUiSpy(page);
    expect(uiSpy.toasts.some((item) => /计划已智能调整/.test(item.title))).toBe(true);

    await clickVisible(page.locator('.plan-card .action-btn.danger').first());
    uiSpy = await readUiSpy(page);
    expect(uiSpy.toasts.some((item) => /计划已删除/.test(item.title))).toBe(true);
  });
});
