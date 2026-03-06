// @ts-nocheck
import { test, expect } from '../fixtures/regression.fixture.js';
import { expectAnyTextVisible, expectSchoolPageReady, expectVisible } from '../helpers/assertions.js';

async function getRuntimeState(page) {
  return page.evaluate(() => {
    const appRoot = document.querySelector('#app');
    const textLen = (document.body?.innerText || '').trim().length;
    const hasUni = typeof window !== 'undefined' && typeof window.uni !== 'undefined';
    const appChildren = appRoot?.children?.length || 0;
    return {
      hasUni,
      textLen,
      appChildren,
      ready: hasUni || textLen > 20
    };
  });
}

test.describe('A2-冒烟测试', () => {
  test('SMOKE-001 应用启动并显示首页结构', async ({ app, page }) => {
    await app.gotoHome();
    const runtime = await getRuntimeState(page);
    expect(runtime.ready, `H5 runtime not ready: ${JSON.stringify(runtime)}`).toBeTruthy();
    await expectAnyTextVisible(page, ['首页', '刷题', '择校', '我的']);
    await app.screenshot('smoke-home');
  });

  test('SMOKE-002 刷题页关键入口可见', async ({ app, page }) => {
    await app.goto('/pages/practice/index');
    const runtime = await getRuntimeState(page);
    test.skip(!runtime.ready, `H5 runtime not ready: ${JSON.stringify(runtime)}`);

    await expectAnyTextVisible(page, ['智能刷题', '刷题', '导入', '题库']);
    await expectVisible(page, 'body');
    await app.screenshot('smoke-practice');
  });

  test('SMOKE-003 择校页表单可操作', async ({ app, page }) => {
    await app.goto('/pages/school/index');
    const runtime = await getRuntimeState(page);
    test.skip(!runtime.ready, `H5 runtime not ready: ${JSON.stringify(runtime)}`);

    await expectSchoolPageReady(page);
    await expectAnyTextVisible(page, ['择校', '院校', '提交', '学校']);
    await app.actions.input('#e2e-school-input-current-school', '测试输入');
    await app.screenshot('smoke-school');
  });
});
