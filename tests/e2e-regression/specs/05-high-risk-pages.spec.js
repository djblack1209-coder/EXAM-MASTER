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

const highRiskPages = [
  {
    id: 'HR-001',
    route: '/pages/login/index',
    keywords: ['登录', '邮箱登录/注册', '隐私政策'],
    requiresAuth: false
  },
  {
    id: 'HR-002',
    route: '/pages/school/index',
    keywords: ['智能择校助手', '开始智能择校匹配', '报考院校'],
    requiresAuth: false
  },
  {
    id: 'HR-003',
    route: '/pages/practice-sub/import-data',
    keywords: ['资料导入', '开始智能出题', '选择复习资料'],
    requiresAuth: true
  },
  {
    id: 'HR-004',
    route: '/pages/practice-sub/do-quiz',
    keywords: ['题库空空如也', '确认退出', '继续答题', '练习完成'],
    requiresAuth: true
  },
  {
    id: 'HR-005',
    route: '/pages/practice-sub/pk-battle',
    keywords: ['匹配', '取消匹配', 'PK', '题库空空如也'],
    requiresAuth: true
  },
  {
    id: 'HR-006',
    route: '/pages/practice-sub/mock-exam',
    keywords: ['模拟考试', '考试设置', '开始考试'],
    requiresAuth: true
  },
  {
    id: 'HR-007',
    route: '/pages/tools/doc-convert',
    keywords: ['文档转换', '开始转换', '选择文件'],
    requiresAuth: true
  },
  {
    id: 'HR-008',
    route: '/pages/tools/photo-search',
    keywords: ['拍照搜题', '相册', '开始识别'],
    requiresAuth: true
  },
  {
    id: 'HR-009',
    route: '/pages/tools/id-photo',
    keywords: ['证件照制作', '开始制作', '背景颜色'],
    requiresAuth: true
  },
  {
    id: 'HR-010',
    route: '/pages/settings/index',
    keywords: ['设置', '清除缓存数据', '注销账号'],
    requiresAuth: true
  },
  {
    id: 'HR-011',
    route: '/pages/chat/chat',
    keywords: ['研聪', '和智能好友聊聊', '清华学霸'],
    requiresAuth: true
  }
];

test.describe('A2-高风险页面可达性', () => {
  for (const entry of highRiskPages) {
    test(`${entry.id} ${entry.route} 页面渲染`, async ({ app, page }) => {
      if (entry.requiresAuth) {
        await app.setLoggedInSession();
      }
      await app.goto(entry.route);
      await skipWhenRuntimeNotReady(test, page);

      if (entry.route === '/pages/school/index') {
        await expectSchoolPageReady(page);
      }

      await expectAnyTextVisible(page, entry.keywords);
      await app.screenshot(`risk-${entry.route.replace(/[^a-zA-Z0-9/_-]/g, '_')}`);
    });
  }
});
