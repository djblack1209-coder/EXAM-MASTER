/**
 * Vitest 配置文件
 * 用于单元测试和组件测试
 *
 * @see https://vitest.dev/config/
 */
import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';
import crypto from 'crypto';

// Polyfill crypto.hash for Node < 20.12 (used by @vitejs/plugin-vue@6 internally)
if (typeof crypto.hash !== 'function') {
  crypto.hash = (algorithm, data, outputEncoding) => {
    return crypto.createHash(algorithm).update(data).digest(outputEncoding);
  };
}

export default defineConfig({
  plugins: [vue()],

  test: {
    // 测试环境
    environment: 'happy-dom',

    // 全局变量
    globals: true,

    // 测试文件匹配模式
    include: ['tests/unit/**/*.{test,spec}.{js,ts,vue}', 'src/**/*.{test,spec}.{js,ts}'],

    // 排除目录
    exclude: ['node_modules', 'dist', 'tests/visual/**/*'],

    // 覆盖率配置
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: './coverage',
      include: ['src/**/*.{js,ts,vue}'],
      exclude: ['src/**/*.d.ts', 'src/main.js', 'src/App.vue']
    },

    // 设置别名
    alias: {
      '@': resolve(__dirname, 'src'),
      '@components': resolve(__dirname, 'src/components'),
      '@pages': resolve(__dirname, 'src/pages'),
      '@utils': resolve(__dirname, 'src/utils'),
      '@services': resolve(__dirname, 'src/services')
    },

    // Laf 运行时包：本地不存在，测试中通过 vi.mock 提供
    server: {
      deps: {
        external: ['nodemailer', 'tencentcloud-sdk-nodejs']
      }
    },

    // Mock uni-app API
    setupFiles: ['./tests/setup.js'],

    // 超时设置
    testTimeout: 10000,

    // 并发（Vitest 4+ 顶层配置）
    maxConcurrency: 5
  },

  resolve: {
    extensions: ['.mjs', '.ts', '.js', '.mts', '.jsx', '.tsx', '.json'],
    alias: {
      '@': resolve(__dirname, 'src'),
      '@components': resolve(__dirname, 'src/components'),
      '@pages': resolve(__dirname, 'src/pages'),
      '@utils': resolve(__dirname, 'src/utils'),
      '@services': resolve(__dirname, 'src/services'),
      // Laf 运行时包本地不存在，指向 mock stub 避免 Vite import 解析失败
      nodemailer: resolve(__dirname, 'tests/__mocks__/nodemailer.js'),
      'tencentcloud-sdk-nodejs': resolve(__dirname, 'tests/__mocks__/tencentcloud-sdk-nodejs.js')
    }
  }
});
