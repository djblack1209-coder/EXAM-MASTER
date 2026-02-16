import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright 视觉回归测试配置
 * 用于 EXAM-MASTER UniApp 微信小程序项目
 */
export default defineConfig({
    testDir: './tests/visual',

    // 快照存储路径
    snapshotPathTemplate: '{testDir}/snapshots/{testFilePath}/{arg}{ext}',

    // 超时配置
    timeout: 30 * 1000,
    expect: {
        timeout: 5000,
        toHaveScreenshot: {
            maxDiffPixelRatio: 0.05,  // 5%差异内自动通过
            threshold: 0.2,            // 像素差异阈值
            animations: 'disabled',    // 禁用动画
        }
    },

    // 失败重试
    retries: process.env.CI ? 2 : 0,

    // 并行执行
    workers: process.env.CI ? 1 : undefined,

    // 报告配置
    reporter: [
        ['html', { outputFolder: '.vscode/visual-report' }],
        ['json', { outputFile: '.vscode/visual-results.json' }],
        ['list']
    ],

    use: {
        // 基础URL（开发服务器）
        baseURL: 'http://localhost:5173/',

        // 截图配置
        screenshot: 'only-on-failure',
        trace: 'retain-on-failure',

        // 视口大小（模拟微信小程序）
        viewport: { width: 375, height: 667 },
    },

    // 测试项目配置
    projects: [
        {
            name: 'Mobile Chrome',
            use: {
                ...devices['iPhone 12'],
                // 微信小程序 User Agent
                userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.0'
            },
        },
    ],

    // 开发服务器配置
    webServer: {
        command: 'npm run dev:h5',
        url: 'http://localhost:5173',
        reuseExistingServer: !process.env.CI,
        timeout: 120 * 1000,
    },
});
