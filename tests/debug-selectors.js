const { chromium } = require('@playwright/test');

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();

    console.log('🔍 正在访问首页...');
    await page.goto('http://localhost:5173/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    console.log('\n📊 检查页面标题:');
    const title = await page.title();
    console.log('Title:', title);

    console.log('\n📊 检查 #app 内容:');
    const appContent = await page.locator('#app').innerHTML();
    console.log('App innerHTML length:', appContent.length);
    console.log('App innerHTML preview:', appContent.substring(0, 500));

    console.log('\n📊 检查所有 class 包含 "stats" 的元素:');
    const statsElements = await page.locator('[class*="stats"]').count();
    console.log('Stats elements count:', statsElements);

    if (statsElements > 0) {
        for (let i = 0; i < Math.min(statsElements, 5); i++) {
            const className = await page.locator('[class*="stats"]').nth(i).getAttribute('class');
            console.log(`  - Element ${i}: class="${className}"`);
        }
    }

    console.log('\n📊 检查所有 class 包含 "container" 的元素:');
    const containerElements = await page.locator('[class*="container"]').count();
    console.log('Container elements count:', containerElements);

    if (containerElements > 0) {
        for (let i = 0; i < Math.min(containerElements, 5); i++) {
            const className = await page.locator('[class*="container"]').nth(i).getAttribute('class');
            console.log(`  - Element ${i}: class="${className}"`);
        }
    }

    console.log('\n📊 检查所有顶层元素:');
    const topElements = await page.locator('#app > *').count();
    console.log('Top level elements count:', topElements);

    if (topElements > 0) {
        for (let i = 0; i < Math.min(topElements, 5); i++) {
            const tagName = await page.locator('#app > *').nth(i).evaluate(el => el.tagName);
            const className = await page.locator('#app > *').nth(i).getAttribute('class');
            console.log(`  - Element ${i}: <${tagName}> class="${className}"`);
        }
    }

    console.log('\n📊 检查 user-greeting-card:');
    const userGreeting = await page.locator('.user-greeting-card').count();
    console.log('user-greeting-card count:', userGreeting);

    console.log('\n📊 检查 custom-tabbar:');
    const customTabbar = await page.locator('custom-tabbar').count();
    console.log('custom-tabbar count:', customTabbar);

    console.log('\n📊 检查 feature-menu:');
    await page.goto('http://localhost:5173/#/pages/practice/index');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    const featureMenu = await page.locator('.feature-menu').count();
    console.log('feature-menu count:', featureMenu);

    console.log('\n📊 检查 form-card:');
    await page.goto('http://localhost:5173/#/pages/school/index');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    const formCard = await page.locator('.form-card').count();
    console.log('form-card count:', formCard);

    await browser.close();
    console.log('\n✅ 调试完成');
})();
