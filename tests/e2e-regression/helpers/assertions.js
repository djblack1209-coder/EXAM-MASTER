import { expect } from '@playwright/test';

export async function expectRoute(page, routePath) {
  await expect(page).toHaveURL(new RegExp(`#${escapeRegExp(routePath)}$|#${escapeRegExp(routePath)}[?&]`));
}

export async function expectVisible(page, selector, timeout = 10_000) {
  await expect(page.locator(selector).first()).toBeVisible({ timeout });
}

export async function expectAnyTextVisible(page, texts, timeout = 10_000) {
  let lastError;
  for (const text of texts) {
    try {
      await expect(page.getByText(text, { exact: false }).first()).toBeVisible({ timeout });
      return;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error('No expected text found.');
}

export async function expectSchoolPageReady(page, timeout = 20_000) {
  const input = page.locator('#e2e-school-input-current-school').first();
  const title = page.getByText('智能择校助手', { exact: false }).first();
  await Promise.race([input.waitFor({ state: 'visible', timeout }), title.waitFor({ state: 'visible', timeout })]);
}

function escapeRegExp(input) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
