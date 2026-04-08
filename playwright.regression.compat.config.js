// @ts-nocheck
import { defineConfig, devices } from '@playwright/test';
import fs from 'fs';

const isCI = Boolean(process.env.CI);
const baseURL = process.env.E2E_BASE_URL || 'http://127.0.0.1:5173';

function resolveChromiumExecutable() {
  const candidates = [
    process.env.PLAYWRIGHT_EXECUTABLE_PATH,
    '/Applications/Chromium.app/Contents/MacOS/Chromium'
  ].filter(Boolean);

  return candidates.find((candidate) => fs.existsSync(candidate));
}

const executablePath = resolveChromiumExecutable();

const sharedUse = {
  baseURL,
  actionTimeout: 10 * 1000,
  navigationTimeout: 20 * 1000,
  trace: 'retain-on-failure',
  screenshot: 'only-on-failure',
  video: 'retain-on-failure',
  locale: 'zh-CN',
  timezoneId: 'Asia/Shanghai',
  launchOptions: executablePath
    ? {
        executablePath
      }
    : undefined
};

export default defineConfig({
  testDir: './tests/e2e-regression/specs',
  outputDir: 'test-results/e2e-compat',
  timeout: 60 * 1000,
  expect: {
    timeout: 10 * 1000
  },
  // CI 环境：并行执行 + 2 worker 加速；本地：串行便于调试
  fullyParallel: isCI,
  // CI 环境：不 retry 以节省时间（18 spec x 3 retry 会超时）；本地可 retry
  retries: isCI ? 0 : 1,
  workers: isCI ? 2 : 1,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'docs/reports/e2e-compat-html', open: 'never' }],
    ['json', { outputFile: 'docs/reports/e2e-compat-results.json' }],
    ['junit', { outputFile: 'docs/reports/e2e-compat-results.xml' }]
  ],
  projects: isCI
    ? [
        // CI 只跑主力移动端配置，节省时间（3浏览器→1浏览器）
        {
          name: 'mobile-390x844',
          use: {
            ...devices['Pixel 5'],
            ...sharedUse,
            viewport: { width: 390, height: 844 }
          }
        }
      ]
    : [
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
        timeout: 300 * 1000
      }
});
