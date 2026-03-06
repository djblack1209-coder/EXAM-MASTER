// @ts-nocheck
import { defineConfig, devices } from '@playwright/test';

const isCI = Boolean(process.env.CI);
const baseURL = process.env.E2E_BASE_URL || 'http://127.0.0.1:5173';

const sharedUse = {
  baseURL,
  actionTimeout: 10 * 1000,
  navigationTimeout: 20 * 1000,
  trace: 'retain-on-failure',
  screenshot: 'only-on-failure',
  video: 'retain-on-failure',
  locale: 'zh-CN',
  timezoneId: 'Asia/Shanghai'
};

export default defineConfig({
  testDir: './tests/e2e-regression/specs',
  outputDir: 'test-results/e2e-compat',
  timeout: 90 * 1000,
  expect: {
    timeout: 10 * 1000
  },
  fullyParallel: false,
  retries: 1,
  workers: isCI ? 1 : 2,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'docs/reports/e2e-compat-html', open: 'never' }],
    ['json', { outputFile: 'docs/reports/e2e-compat-results.json' }],
    ['junit', { outputFile: 'docs/reports/e2e-compat-results.xml' }]
  ],
  projects: [
    {
      name: 'mobile-390x844',
      use: {
        ...devices['Pixel 5'],
        ...sharedUse,
        viewport: { width: 390, height: 844 }
      }
    },
    {
      name: 'mobile-375x667',
      use: {
        ...sharedUse,
        browserName: 'chromium',
        viewport: { width: 375, height: 667 },
        isMobile: true,
        hasTouch: true,
        deviceScaleFactor: 2
      }
    },
    {
      name: 'desktop-1440x900',
      use: {
        ...sharedUse,
        browserName: 'chromium',
        viewport: { width: 1440, height: 900 },
        isMobile: false,
        hasTouch: false,
        deviceScaleFactor: 1
      }
    }
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: 'npm run dev:h5',
        url: baseURL,
        reuseExistingServer: true,
        timeout: 180 * 1000
      }
});
