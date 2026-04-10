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
    for (let attempt = 0; attempt < 2; attempt += 1) {
      await this.page.goto('/#/pages/index/index');
      await this.page.waitForLoadState('domcontentloaded');
      await this.page
        .locator('#e2e-home-root')
        .first()
        .waitFor({ state: 'visible', timeout: 12000 })
        .catch(() => {});
      await this.page.waitForTimeout(800);

      const hasTimeoutOverlay = await this.page
        .evaluate(() => (document.body?.innerText || '').includes('连接服务器超时，点击屏幕重试'))
        .catch(() => false);

      if (!hasTimeoutOverlay) {
        break;
      }
    }
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
      const prefix = '__exam_storage__:';
      const token = 'e2e_mock_token';
      const userId = 'e2e_user_01';
      const userInfo = {
        _id: 'e2e_user_01',
        userId: 'e2e_user_01',
        nickname: '自动化回归账号',
        avatar: '/static/images/default-avatar.png'
      };

      // 原始键（uni-app 直接读取）
      localStorage.setItem('EXAM_TOKEN', token);
      localStorage.setItem('EXAM_USER_ID', userId);
      localStorage.setItem('EXAM_USER_INFO', JSON.stringify(userInfo));

      // storageService 前缀键（loginGuard.getUserId 读取）
      localStorage.setItem(`${prefix}EXAM_TOKEN`, JSON.stringify({ value: token }));
      localStorage.setItem(`${prefix}EXAM_USER_ID`, JSON.stringify({ value: userId }));
      localStorage.setItem(`${prefix}userInfo`, JSON.stringify({ value: userInfo }));
    });
  }

  async clearSession() {
    await this.page.addInitScript(() => {
      const prefix = '__exam_storage__:';
      const keysToRemove = [];

      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i);
        if (!key) continue;
        if (
          key.startsWith(prefix) ||
          key.startsWith('EXAM_') ||
          key.startsWith('u_') ||
          key === 'redirect_after_login'
        ) {
          keysToRemove.push(key);
        }
      }

      keysToRemove.forEach((key) => localStorage.removeItem(key));

      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.clear();
      }

      try {
        if (typeof uni !== 'undefined' && typeof uni.clearStorageSync === 'function') {
          uni.clearStorageSync();
        }
      } catch {
        // ignore compat cleanup failures in e2e
      }
    });
  }

  async setStorage(key, value) {
    if (!/^https?:/i.test(this.page.url())) {
      await this.page.goto('/#/pages/index/index');
      await this.page.waitForLoadState('domcontentloaded');
      await this.page.waitForTimeout(500);
    }

    await this.page.evaluate(
      ({ storageKey, storageValue }) => {
        const prefix = '__exam_storage__:';
        const wrapped = JSON.stringify({ value: storageValue });
        const rawUserId =
          localStorage.getItem('EXAM_USER_ID') ||
          (typeof uni !== 'undefined' && typeof uni.getStorageSync === 'function'
            ? uni.getStorageSync('EXAM_USER_ID')
            : '') ||
          '';
        let userId = rawUserId;

        if (!userId) {
          try {
            const compat = localStorage.getItem(`${prefix}EXAM_USER_ID`);
            if (compat) {
              const parsed = JSON.parse(compat);
              userId = parsed?.value || '';
            }
          } catch {
            userId = '';
          }
        }

        localStorage.setItem(`${prefix}${storageKey}`, wrapped);
        localStorage.setItem(storageKey, JSON.stringify(storageValue));
        if (typeof uni !== 'undefined' && typeof uni.setStorageSync === 'function') {
          try {
            uni.setStorageSync(storageKey, storageValue);
          } catch {
            // ignore compat failures
          }
        }

        if (userId && !storageKey.startsWith('EXAM_')) {
          localStorage.setItem(`${prefix}u_${userId}_${storageKey}`, wrapped);
          localStorage.setItem(`u_${userId}_${storageKey}`, JSON.stringify(storageValue));
          if (typeof uni !== 'undefined' && typeof uni.setStorageSync === 'function') {
            try {
              uni.setStorageSync(`u_${userId}_${storageKey}`, storageValue);
            } catch {
              // ignore compat failures
            }
          }
        }
      },
      { storageKey: key, storageValue: value }
    );
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
              matchRate: 91,
              scoreLine: '365',
              ratio: '8:1',
              passRate: '120',
              majors: [
                { name: '计算机科学与技术', code: '081200', type: '学硕' },
                { name: '人工智能', code: '085410', type: '专硕' }
              ],
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
        body: JSON.stringify({
          code: 0,
          data: [
            {
              _id: 'school_hot_1',
              code: 'school_hot_1',
              name: '热门示例大学',
              shortName: '热点大',
              province: '北京',
              tags: ['双一流'],
              matchRate: 86
            },
            {
              _id: 'school_hot_2',
              code: 'school_hot_2',
              name: '热门示例学院',
              shortName: '热点院',
              province: '上海',
              tags: ['211'],
              matchRate: 80
            }
          ]
        })
      });
    });

    await page.route('**/proxy-ai', async (route) => {
      let payload = {};
      try {
        payload = JSON.parse(route.request().postData() || '{}');
      } catch {
        payload = {};
      }

      if (payload.action === 'recommend') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            code: 0,
            success: true,
            data: {
              reply: JSON.stringify({
                schools: [
                  {
                    id: 'e2e-school',
                    code: 'e2e-school',
                    name: 'E2E 示例大学',
                    province: '北京',
                    tags: ['双一流', '计算机'],
                    matchRate: 91,
                    majors: [
                      {
                        code: '081200',
                        name: '计算机科学与技术',
                        type: '学硕',
                        scores: [{ total: 365, eng: 55 }, { total: 352 }, { total: 348 }]
                      }
                    ]
                  },
                  {
                    id: 'e2e-school-2',
                    code: 'e2e-school-2',
                    name: 'E2E 智能学院',
                    province: '上海',
                    tags: ['211'],
                    matchRate: 84,
                    majors: [
                      {
                        code: '085410',
                        name: '人工智能',
                        type: '专硕',
                        scores: [{ total: 352, eng: 50 }, { total: 344 }, { total: 338 }]
                      }
                    ]
                  }
                ]
              })
            }
          })
        });
        return;
      }

      if (payload.action === 'friend_chat') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            code: 0,
            success: true,
            data: '这是后端返回的智能好友回复：建议你先做 10 道高频题，再复盘错题。'
          })
        });
        return;
      }

      if (payload.action === 'consult') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            code: 0,
            success: true,
            data: '这是院校智能咨询回复：该校近年计算机方向竞争激烈，建议重点准备专业课与复试表达。'
          })
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ code: 0, success: true, data: 'ok' })
      });
    });

    await page.route('**/school-crawler-api', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ code: 0, data: { list: [] } })
      });
    });

    await page.route('**/doc-convert', async (route) => {
      let payload = {};
      try {
        payload = JSON.parse(route.request().postData() || '{}');
      } catch {
        payload = {};
      }

      if (payload.action === 'convert') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            code: 0,
            data: {
              jobId: 'e2e-doc-job',
              status: 'finished',
              downloadUrl: 'https://example.com/e2e-doc-result.docx',
              files: [{ filename: 'e2e-doc-result.docx', url: 'https://example.com/e2e-doc-result.docx' }]
            }
          })
        });
        return;
      }

      if (payload.action === 'get_status') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ code: 0, data: { jobId: 'e2e-doc-job', status: 'finished' } })
        });
        return;
      }

      if (payload.action === 'get_result') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            code: 0,
            data: {
              downloadUrl: 'https://example.com/e2e-doc-result.docx',
              files: [{ filename: 'e2e-doc-result.docx', url: 'https://example.com/e2e-doc-result.docx' }]
            }
          })
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ code: 0, data: {} })
      });
    });

    await page.route('**/photo-bg', async (route) => {
      let payload = {};
      try {
        payload = JSON.parse(route.request().postData() || '{}');
      } catch {
        payload = {};
      }

      if (payload.action === 'get_sizes') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            code: 0,
            data: {
              '1inch': { name: '一寸', desc: '25×35mm' },
              '2inch': { name: '二寸', desc: '35×49mm' }
            }
          })
        });
        return;
      }

      if (payload.action === 'get_colors') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            code: 0,
            data: {
              white: { name: '白色', hex: '#FFFFFF' },
              blue: { name: '蓝色', hex: '#438EDB' },
              red: { name: '红色', hex: '#D03A3A' }
            }
          })
        });
        return;
      }

      if (payload.action === 'process') {
        const pngBase64 =
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4////fwAJ+wP9KobjigAAAABJRU5ErkJggg==';
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            code: 0,
            data: {
              resultImage: `data:image/png;base64,${pngBase64}`,
              foreground: pngBase64,
              needComposite: false,
              bgColorHex: '#438EDB'
            }
          })
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ code: 0, data: {} })
      });
    });

    await page.route('**/ai-photo-search', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 0,
          data: {
            confidence: 0.96,
            recognizedText: '已识别：示例题目内容',
            matchedQuestions: [
              {
                _id: 'e2e-question-1',
                question: '以下哪个选项最符合题意？',
                category: '综合',
                difficulty: 2,
                answer: 'A',
                options: ['A', 'B', 'C', 'D']
              }
            ],
            aiSolution: {
              answer: 'A',
              analysis: {
                steps: ['阅读题干', '定位关键条件', '排除干扰项'],
                keyPoints: ['基础概念', '条件判断']
              },
              commonMistakes: ['忽略题干限定词']
            }
          }
        })
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
