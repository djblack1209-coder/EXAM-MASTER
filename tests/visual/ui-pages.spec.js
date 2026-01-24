import { test, expect } from '@playwright/test';

/**
 * EXAM-MASTER UI 视觉回归测试
 * 自动截图对比，5%差异内自动通过
 */

test.describe('核心页面视觉回归测试', () => {
    test('首页 - 学习统计面板', async ({ page }) => {
        await page.goto('http://localhost:5173/');
        await page.waitForLoadState('networkidle');

        // 等待 Vue 应用挂载 - 检查 #app 是否有内容
        await page.waitForFunction(() => {
            const app = document.querySelector('#app');
            return app && app.children.length > 0;
        }, { timeout: 15000 });

        // 等待统计容器出现
        await page.waitForTimeout(2000);
        await page.waitForSelector('.stats-container', { timeout: 15000, state: 'visible' });

        // 截图对比（自动）
        await expect(page).toHaveScreenshot('homepage-stats.png', {
            maxDiffPixelRatio: 0.05,
            animations: 'disabled'
        });
    });

    test('刷题中心 - 题库列表', async ({ page }) => {
        await page.goto('http://localhost:5173/#/pages/practice/index');
        await page.waitForLoadState('networkidle');

        // 等待 Vue 应用挂载
        await page.waitForFunction(() => {
            const app = document.querySelector('#app');
            return app && app.children.length > 0;
        }, { timeout: 15000 });

        // 等待功能菜单加载
        await page.waitForTimeout(2000);
        await page.waitForSelector('.feature-menu', { timeout: 15000, state: 'visible' });

        await expect(page).toHaveScreenshot('practice-list.png', {
            maxDiffPixelRatio: 0.05
        });
    });

    test('错题本 - 错题卡片', async ({ page }) => {
        await page.goto('http://localhost:5173/#/pages/mistake/index');
        await page.waitForLoadState('networkidle');

        // 等待数据加载
        await page.waitForTimeout(2000);

        await expect(page).toHaveScreenshot('mistake-book.png', {
            maxDiffPixelRatio: 0.05
        });
    });

    test('择校分析 - 表单页面', async ({ page }) => {
        await page.goto('http://localhost:5173/#/pages/school/index');
        await page.waitForLoadState('networkidle');

        // 等待 Vue 应用挂载
        await page.waitForFunction(() => {
            const app = document.querySelector('#app');
            return app && app.children.length > 0;
        }, { timeout: 15000 });

        // 等待表单卡片渲染
        await page.waitForTimeout(2000);
        await page.waitForSelector('.form-card', { timeout: 15000, state: 'visible' });

        await expect(page).toHaveScreenshot('school-form.png', {
            maxDiffPixelRatio: 0.05
        });
    });
});

test.describe('组件级视觉回归测试', () => {
    test('导航栏组件', async ({ page }) => {
        await page.goto('http://localhost:5173/');
        await page.waitForLoadState('networkidle');

        // 等待 Vue 应用挂载
        await page.waitForFunction(() => {
            const app = document.querySelector('#app');
            return app && app.children.length > 0;
        }, { timeout: 15000 });

        // 等待用户信息卡片可见
        await page.waitForTimeout(2000);
        const navbar = await page.locator('.user-greeting-card');
        await navbar.waitFor({ state: 'visible', timeout: 15000 });

        await expect(navbar).toHaveScreenshot('navbar-component.png', {
            maxDiffPixelRatio: 0.03,
            timeout: 15000
        });
    });

    test('底部导航栏', async ({ page }) => {
        await page.goto('http://localhost:5173/');
        await page.waitForLoadState('networkidle');

        // 等待 Vue 应用挂载
        await page.waitForFunction(() => {
            const app = document.querySelector('#app');
            return app && app.children.length > 0;
        }, { timeout: 15000 });

        // 等待底部导航栏渲染
        await page.waitForTimeout(2000);
        const tabbar = await page.locator('custom-tabbar, .custom-tabbar').first();
        await tabbar.waitFor({ state: 'visible', timeout: 15000 });

        await expect(tabbar).toHaveScreenshot('tabbar-component.png', {
            maxDiffPixelRatio: 0.03,
            timeout: 15000
        });
    });

    test('空状态组件', async ({ page }) => {
        await page.goto('http://localhost:5173/#/pages/mistake/index');

        // 模拟空状态
        await page.evaluate(() => {
            localStorage.clear();
        });
        await page.reload();

        const emptyState = await page.locator('.base-empty');
        if (await emptyState.isVisible()) {
            await expect(emptyState).toHaveScreenshot('empty-state.png', {
                maxDiffPixelRatio: 0.03
            });
        }
    });
});

test.describe('交互状态视觉测试', () => {
    test('按钮悬停状态', async ({ page }) => {
        await page.goto('http://localhost:5173/#/pages/practice/index');
        await page.waitForLoadState('networkidle');

        // 等待 Vue 应用挂载
        await page.waitForFunction(() => {
            const app = document.querySelector('#app');
            return app && app.children.length > 0;
        }, { timeout: 15000 });

        // 等待按钮可见
        await page.waitForTimeout(2000);
        const startButton = await page.locator('.primary-btn').first();
        await startButton.waitFor({ state: 'visible', timeout: 15000 });
        await startButton.hover();

        await expect(startButton).toHaveScreenshot('button-hover.png', {
            maxDiffPixelRatio: 0.05,
            timeout: 15000
        });
    });

    test('加载状态', async ({ page }) => {
        await page.goto('http://localhost:5173/#/pages/mistake/index');

        // 捕获加载状态
        const loading = await page.locator('.base-loading');
        if (await loading.isVisible()) {
            await expect(loading).toHaveScreenshot('loading-state.png', {
                maxDiffPixelRatio: 0.05
            });
        }
    });
});

test.describe('响应式布局测试', () => {
    test('iPhone 12 视口', async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await page.goto('http://localhost:5173/');

        await expect(page).toHaveScreenshot('responsive-iphone12.png', {
            maxDiffPixelRatio: 0.05
        });
    });

    test('小屏设备 (iPhone SE)', async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 667 });
        await page.goto('http://localhost:5173/');

        await expect(page).toHaveScreenshot('responsive-iphonese.png', {
            maxDiffPixelRatio: 0.05
        });
    });
});
