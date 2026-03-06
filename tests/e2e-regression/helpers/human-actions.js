export class HumanActions {
  constructor(page) {
    this.page = page;
    this._slowRoutes = new Set();
  }

  async pickFirstVisible(locator) {
    const count = await locator.count();
    for (let i = 0; i < count; i += 1) {
      const candidate = locator.nth(i);
      if (await candidate.isVisible().catch(() => false)) {
        return candidate;
      }
    }
    return locator.first();
  }

  async tap(selector) {
    await this.page.locator(selector).first().click({ timeout: 10_000 });
  }

  async tapByText(text) {
    await this.page.getByText(text, { exact: false }).first().click({ timeout: 10_000 });
  }

  async input(selector, value) {
    const host = await this.pickFirstVisible(this.page.locator(selector));
    await host.scrollIntoViewIfNeeded().catch(() => {});
    await host.click({ timeout: 10_000 });

    let target = host;
    const innerCandidates = host.locator('input, textarea, [contenteditable="true"]');
    if (await innerCandidates.count()) {
      target = await this.pickFirstVisible(innerCandidates);
    }

    await target.scrollIntoViewIfNeeded().catch(() => {});
    await target.click({ timeout: 10_000 });
    await target.fill('');
    await target.type(value, { delay: 45 });
  }

  async swipeUp() {
    const viewport = this.page.viewportSize() || { width: 390, height: 844 };
    const startX = Math.floor(viewport.width * 0.5);
    const startY = Math.floor(viewport.height * 0.78);
    const endY = Math.floor(viewport.height * 0.24);

    await this.page.mouse.move(startX, startY);
    await this.page.mouse.down();
    await this.page.mouse.move(startX, endY, { steps: 18 });
    await this.page.mouse.up();
    await this.page.waitForTimeout(300);
  }

  async goBack() {
    await this.page.goBack({ waitUntil: 'domcontentloaded' });
  }

  async backgroundAndResume() {
    const bgPage = await this.page.context().newPage();
    await bgPage.goto('about:blank');
    await bgPage.bringToFront();
    await this.page.waitForTimeout(300);
    await this.page.bringToFront();
    await this.page.waitForTimeout(500);
    await bgPage.close();
  }

  async setOffline(enabled) {
    await this.page.context().setOffline(enabled);
    await this.page.waitForTimeout(300);
  }

  async enableWeakNetwork(delayMs = 1200, urlPattern = '**/*') {
    if (this._slowRoutes.has(urlPattern)) {
      return;
    }
    this._slowRoutes.add(urlPattern);
    await this.page.route(urlPattern, async (route) => {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      try {
        await route.continue();
      } catch {
        // 请求可能已在页面关闭/测试结束时中断，忽略即可
      }
    });
  }

  async disableWeakNetwork(urlPattern = '**/*') {
    if (!this._slowRoutes.has(urlPattern)) {
      return;
    }
    this._slowRoutes.delete(urlPattern);
    await this.page.unroute(urlPattern);
  }
}
