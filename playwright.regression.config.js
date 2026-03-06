import { defineConfig, devices } from '@playwright/test';

const isCI = Boolean(process.env.CI);
const baseURL = process.env.E2E_BASE_URL || 'http://127.0.0.1:5173';

export default defineConfig({
  testDir: './tests/e2e-regression/specs',
  outputDir: 'test-results/e2e-regression',
  timeout: 90 * 1000,
  expect: {
    timeout: 10 * 1000
  },
  fullyParallel: false,
  retries: 1,
  workers: isCI ? 1 : 2,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'docs/reports/e2e-regression-html', open: 'never' }],
    ['json', { outputFile: 'docs/reports/e2e-regression-results.json' }],
    ['junit', { outputFile: 'docs/reports/e2e-regression-results.xml' }]
  ],
  use: {
    ...devices['Pixel 5'],
    baseURL,
    actionTimeout: 10 * 1000,
    navigationTimeout: 20 * 1000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    viewport: { width: 390, height: 844 },
    locale: 'zh-CN',
    timezoneId: 'Asia/Shanghai'
  },
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: 'npm run dev:h5',
        url: baseURL,
        reuseExistingServer: true,
        timeout: 180 * 1000
      }
});
