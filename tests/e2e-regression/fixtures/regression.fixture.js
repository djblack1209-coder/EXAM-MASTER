// @ts-nocheck
import { test as base, expect } from '@playwright/test';
import { HumanActions } from '../helpers/human-actions.js';
import { NetworkLogger } from '../helpers/network-logger.js';

class AppDriver {
  constructor(page, testInfo, actions) {
    this.page = page;
    this.testInfo = testInfo;
    this.actions = actions;
  }

  async goto(routePath) {
    await this.page.goto(`/#${routePath}`);
    await this.page.waitForLoadState('domcontentloaded');
    await this.page.waitForTimeout(800);
  }

  async gotoHome() {
    await this.page.goto('/');
    await this.page.waitForLoadState('domcontentloaded');
    await this.page.waitForTimeout(800);
  }

  async screenshot(name) {
    const safeName = name.replace(/[^a-zA-Z0-9_-]/g, '_');
    const filePath = this.testInfo.outputPath(`${safeName}.png`);
    await this.page.screenshot({ path: filePath, fullPage: true });
    await this.testInfo.attach(name, {
      path: filePath,
      contentType: 'image/png'
    });
  }

  async setLoggedInSession() {
    await this.page.addInitScript(() => {
      localStorage.setItem('EXAM_TOKEN', 'e2e_mock_token');
      localStorage.setItem('EXAM_USER_ID', 'e2e_user_01');
      localStorage.setItem(
        'EXAM_USER_INFO',
        JSON.stringify({
          _id: 'e2e_user_01',
          userId: 'e2e_user_01',
          nickname: '自动化回归账号',
          avatar: '/static/images/default-avatar.png'
        })
      );
    });
  }
}

export const test = base.extend({
  app: async ({ page }, use, testInfo) => {
    const networkLogger = new NetworkLogger(page, testInfo);
    const actions = new HumanActions(page);
    const app = new AppDriver(page, testInfo, actions);

    await page.route('**/school-query', async (route) => {
      let action = '';
      try {
        action = JSON.parse(route.request().postData() || '{}').action || '';
      } catch {
        action = '';
      }

      if (action === 'detail') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            code: 0,
            data: {
              _id: 'e2e-school',
              code: 'e2e-school',
              name: 'E2E 示例大学',
              shortName: 'E2EU',
              province: '北京',
              tags: ['双一流'],
              colleges: [],
              description: '这是用于回归测试的稳定院校详情数据。'
            }
          })
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ code: 0, data: [] })
      });
    });

    await page.route('**/school-crawler-api', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ code: 0, data: { list: [] } })
      });
    });

    networkLogger.start();

    await page.addInitScript(() => {
      localStorage.setItem('E2E_RUN_ID', String(Date.now()));
    });

    try {
      await use(app);
    } finally {
      if (testInfo.status !== testInfo.expectedStatus) {
        const failurePath = testInfo.outputPath('failure-screen.png');
        await page.screenshot({ path: failurePath, fullPage: true });
        await testInfo.attach('failure-screen', {
          path: failurePath,
          contentType: 'image/png'
        });
      }

      networkLogger.stop();
      await networkLogger.flush();
      await actions.disableWeakNetwork();
    }
  }
});

export { expect };
