import { defineConfig, loadEnv } from 'vite';
import uniModule from '@dcloudio/vite-plugin-uni';
import path from 'path';
import fs from 'fs';
import { createRequire } from 'module';
import { normalizeAppRuntimeIndexFile } from './scripts/build/app-runtime-html.js';
import { VitePWA } from 'vite-plugin-pwa';

const require = createRequire(path.join(process.cwd(), 'vite.config.js'));
const uniCliSharedUtils = require('@dcloudio/uni-cli-shared/dist/utils.js');

// 兼容 @dcloudio/vite-plugin-uni CJS/ESM 双层 default 问题
const uni = typeof uniModule === 'function' ? uniModule : Reflect.get(Object(uniModule), 'default') || uniModule;

function guardHBuilderMiniProgramHelpers(platform) {
  const isRunByHBuilderX =
    Boolean(process.env.UNI_HBUILDERX_PLUGINS) && Boolean(process.env.RUN_BY_HBUILDERX || process.env.HX_Version);

  if (!platform?.startsWith('mp-') || !isRunByHBuilderX) return;

  try {
    const helpers = uniCliSharedUtils.requireUniHelpers();
    if (typeof helpers?.UUVP === 'function') return;
    console.warn('[Uni Guard] HBuilderX helper UUVP missing, fallback to standard mini program build path');
  } catch (error) {
    console.warn(
      `[Uni Guard] Failed to load HBuilderX helpers, fallback to standard mini program build path: ${error.message}`
    );
  }

  const originalRequireUniHelpers = uniCliSharedUtils.requireUniHelpers;

  uniCliSharedUtils.requireUniHelpers = (...args) => {
    let helpers = {};

    try {
      helpers = typeof originalRequireUniHelpers === 'function' ? originalRequireUniHelpers(...args) || {} : {};
    } catch (_error) {
      helpers = {};
    }

    if (typeof helpers.UUVP !== 'function') {
      helpers = Object.assign({}, helpers, {
        UUVP: () => ({ name: 'noop-hbuilder-uuvp' })
      });
    }

    return helpers;
  };
}

/**
 * 微信小程序自定义 tabBar 占位组件复制插件
 * 当 pages.json 中 tabBar.custom = true 时，微信框架强制要求
 * 项目根目录存在 custom-tab-bar/index 组件，否则报 "Component is not found"
 */
function copyCustomTabBar() {
  return {
    name: 'copy-custom-tab-bar',
    writeBundle(options) {
      try {
        const outDir = options.dir || '';
        if (!outDir.includes('mp-weixin')) return;

        const src = path.resolve(__dirname, 'src/custom-tab-bar');
        const dest = path.resolve(outDir, 'custom-tab-bar');

        if (!fs.existsSync(src)) {
          console.warn('[TabBar Plugin] src/custom-tab-bar not found, skipping copy');
          return;
        }
        if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });

        let copied = 0;
        for (const file of fs.readdirSync(src)) {
          fs.copyFileSync(path.join(src, file), path.join(dest, file));
          copied++;
        }
        console.log(`[TabBar Plugin] Copied ${copied} files to ${dest}`);
      } catch (err) {
        // TabBar copy failure should not break the entire build
        console.error('[TabBar Plugin] Failed to copy custom-tab-bar:', err.message);
      }
    }
  };
}

function emitAppPackManifest() {
  return {
    name: 'emit-app-pack-manifest',
    writeBundle(options) {
      try {
        if (process.env.UNI_COMPILER === 'nvue') return;

        const outDir = options.dir || '';
        if (!/[/\\]dist[/\\](build[/\\]app|dev[/\\](app|app-plus))$/.test(outDir)) return;

        // 如果 uni-app-plus 编译器已经生成了 manifest.json，不要覆盖
        const targetPath = path.resolve(outDir, 'manifest.json');
        if (fs.existsSync(targetPath)) {
          const existing = JSON.parse(fs.readFileSync(targetPath, 'utf8'));
          if (existing.launch_path !== 'index.html' || existing.plus?.launchwebview) {
            console.log(`[App Manifest Plugin] Skipped: uni-app-plus compiler already emitted manifest`);
            return;
          }
        }

        const sourcePath = path.resolve(process.env.UNI_INPUT_DIR || __dirname, 'manifest.json');
        const source = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
        const appPlus = source['app-plus'] || {};

        const compiledManifest = {
          id: source.appid || '',
          name: source.name || '',
          description: source.description || '',
          version: {
            name: source.versionName || '1.0.0',
            code: source.versionCode || '100'
          },
          launch_path: 'index.html',
          permissions: source.permissions || {},
          plus: {
            modules: appPlus.modules || {},
            splashscreen: appPlus.splashscreen || {},
            distribute: appPlus.distribute || {}
          }
        };

        fs.writeFileSync(targetPath, JSON.stringify(compiledManifest, null, 2));
        console.log(`[App Manifest Plugin] Emitted ${targetPath}`);
      } catch (err) {
        console.error('[App Manifest Plugin] Failed to emit manifest:', err.message);
      }
    }
  };
}

function normalizeAppRuntimeIndex() {
  return {
    name: 'normalize-app-runtime-index',
    writeBundle(options) {
      try {
        if (process.env.UNI_COMPILER === 'nvue') return;

        const outDir = options.dir || '';
        if (!/[/\\]dist[/\\](build[/\\]app|dev[/\\](app|app-plus))$/.test(outDir)) return;

        const indexPath = path.resolve(outDir, 'index.html');
        if (normalizeAppRuntimeIndexFile(indexPath)) {
          console.log(`[App Runtime Plugin] Normalized ${indexPath}`);
        }
      } catch (err) {
        console.error('[App Runtime Plugin] Failed to normalize index:', err.message);
      }
    }
  };
}

/**
 * App 端强制 inlineDynamicImports，避免 IIFE + code-splitting 冲突
 * 必须在 configResolved 阶段修改，因为 uni-app-vite 的 config() 会覆盖 vite.config.js 的 output
 */
function forceAppInlineDynamicImports() {
  return {
    name: 'force-app-inline-dynamic-imports',
    enforce: 'post',
    configResolved(config) {
      const platform = process.env.UNI_PLATFORM || '';
      if (platform !== 'app' && platform !== 'app-plus') return;

      const output = config.build?.rollupOptions?.output;
      if (output && !Array.isArray(output)) {
        output.inlineDynamicImports = true;
        delete output.manualChunks;
      } else if (Array.isArray(output)) {
        output.forEach((o) => {
          o.inlineDynamicImports = true;
          delete o.manualChunks;
        });
      }
    }
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ command, mode }) => {
  // 加载环境变量
  const env = loadEnv(mode, process.cwd(), '');
  const platform = process.env.UNI_PLATFORM || env.UNI_PLATFORM || '';
  guardHBuilderMiniProgramHelpers(platform);

  // 判断是否为生产环境
  const isProduction = mode === 'production';
  const isStaging = mode === 'staging';
  const isDevelopment = mode === 'development';
  const isAppPlus = platform === 'app' || platform === 'app-plus';

  const isNvueCompiler = process.env.UNI_COMPILER === 'nvue';
  const appInputDir = process.env.UNI_INPUT_DIR
    ? path.resolve(process.env.UNI_INPUT_DIR)
    : path.resolve(__dirname, 'src');
  const viteRootDir = process.cwd();
  const shouldBypassNvueHtmlEntry = isAppPlus && isNvueCompiler;

  process.env.VITE_ROOT_DIR = viteRootDir;

  const isH5 = !platform || platform === 'h5';

  console.log(`[Vite] Building for mode: ${mode}, command: ${command}, platform: ${platform || 'unknown'}`);

  return {
    root: viteRootDir,

    base: isAppPlus ? './' : '/',

    plugins: [
      uni(),
      copyCustomTabBar(),
      emitAppPackManifest(),
      normalizeAppRuntimeIndex(),
      forceAppInlineDynamicImports(),
      // Phase 3-6: PWA 离线体验（仅 H5 平台启用）
      ...(isH5
        ? [
            VitePWA({
              registerType: 'autoUpdate',
              includeAssets: ['static/images/logo.png'],
              manifest: {
                name: '研友刷题',
                short_name: '研友刷题',
                description: '考研备考刷题助手 - 智能间隔重复、PK对战、AI诊断',
                theme_color: '#6366f1',
                background_color: '#f5f5f7',
                display: 'standalone',
                scope: '/',
                start_url: '/',
                icons: [
                  { src: '/static/images/logo.png', sizes: '192x192', type: 'image/png' },
                  { src: '/static/images/logo.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
                ]
              },
              workbox: {
                // 预缓存 app shell
                globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
                // 运行时缓存策略
                runtimeCaching: [
                  {
                    // API 请求：NetworkFirst，离线时回退缓存
                    urlPattern: /^https:\/\/.*\.(sealosbja\.site|lafyun\.com)\/.*/i,
                    handler: 'NetworkFirst',
                    options: {
                      cacheName: 'api-cache',
                      expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 }, // 1天
                      networkTimeoutSeconds: 5,
                      cacheableResponse: { statuses: [0, 200] }
                    }
                  },
                  {
                    // 图片资源：CacheFirst
                    urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp)$/,
                    handler: 'CacheFirst',
                    options: {
                      cacheName: 'image-cache',
                      expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 } // 30天
                    }
                  },
                  {
                    // 字体：CacheFirst
                    urlPattern: /\.(?:woff|woff2|ttf|eot)$/,
                    handler: 'CacheFirst',
                    options: {
                      cacheName: 'font-cache',
                      expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 } // 1年
                    }
                  }
                ]
              }
            })
          ]
        : [])
    ],

    // 环境变量定义
    define: {
      'process.env.NODE_ENV': JSON.stringify(mode),
      'process.env.SENTRY_DSN': JSON.stringify(env.VITE_SENTRY_DSN || ''),
      __APP_VERSION__: JSON.stringify(env.npm_package_version || '1.0.0'),
      __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
      __BUILD_MODE__: JSON.stringify(mode)
    },

    // 路径别名
    resolve: {
      alias: {
        // ✅ P008: @ 映射到 src/，子路径自动解析无需重复声明
        '@': appInputDir
      }
    },

    // CSS 预处理器配置
    css: {
      preprocessorOptions: {
        scss: {
          silenceDeprecations: ['legacy-js-api', 'import', 'global-builtin'],
          // ✅ F003: 自动注入共享 SCSS 变量到所有组件
          additionalData: `
            @use "${path.resolve(__dirname, 'src/styles/_design-tokens.scss').replace(/\\/g, '/')}" as *;
            $env-mode: "${mode}";
            $is-production: ${isProduction};
          `
        }
      },
      // 生产环境启用 CSS 代码分割
      devSourcemap: !isProduction
    },

    // 构建配置
    build: {
      // 源码映射：开发和测试环境启用，生产环境关闭
      sourcemap: isDevelopment ? 'inline' : isStaging ? true : false,

      // 代码压缩配置
      minify: isProduction || isStaging ? 'terser' : false,

      terserOptions: {
        compress: {
          // 生产环境移除 console 和 debugger
          drop_console: isProduction,
          drop_debugger: isProduction || isStaging,
          // 生产环境移除特定函数调用
          pure_funcs: isProduction ? ['console.log', 'console.info', 'console.debug'] : []
        },
        mangle: {
          safari10: true
        },
        format: {
          // 生产环境移除注释
          comments: !isProduction
        }
      },

      // 代码分割配置
      write: !shouldBypassNvueHtmlEntry,

      rollupOptions: {
        input: shouldBypassNvueHtmlEntry ? path.resolve(__dirname, 'scripts/build/empty-app-nvue-entry.js') : undefined,
        output: isAppPlus
          ? {
              // App 端：IIFE 格式必须内联所有动态导入，禁止代码分割
              inlineDynamicImports: true
            }
          : {
              // 非 App 端：正常的文件命名配置
              chunkFileNames: isProduction ? 'static/js/[name]-[hash].js' : 'static/js/[name].js',
              entryFileNames: isProduction ? 'static/js/[name]-[hash].js' : 'static/js/[name].js',
              assetFileNames: isProduction ? 'static/[ext]/[name]-[hash].[ext]' : 'static/[ext]/[name].[ext]'
            }
      },

      // 块大小警告限制（KB）
      chunkSizeWarningLimit: isProduction ? 500 : 1000,

      // 资源内联限制（小于此大小的资源会被内联为base64）
      // 提升到 8KB — 减少小图标的 HTTP 请求数
      assetsInlineLimit: 8192,

      // 构建目标（es2018 支持 async/await、rest/spread 等，减少 polyfill 体积）
      target: 'es2018',

      // CSS 代码分割（App 端禁用，避免 IIFE 格式冲突）
      cssCodeSplit: isAppPlus ? false : true,

      // 生产环境 CSS 压缩（lightningcss 比默认 esbuild 压缩率更高）
      cssMinify: isProduction ? 'esbuild' : false,

      // 生产环境报告压缩后的大小
      reportCompressedSize: isProduction
    },

    // 开发服务器配置
    server: {
      host: '0.0.0.0',
      port: parseInt(env.VITE_DEV_PORT) || 5173,
      strictPort: false,
      open: false,

      // 代理配置
      proxy: {
        '/api': {
          target: env.VITE_API_BASE_URL || 'https://nf98ia8qnt.sealosbja.site',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
          // 开发环境显示代理日志
          configure: (proxy, options) => {
            if (isDevelopment) {
              proxy.on('proxyReq', (proxyReq, req) => {
                console.log(`[Proxy] ${req.method} ${req.url} -> ${options.target}`);
              });
            }
          }
        }
      },

      // 热更新配置
      hmr: {
        overlay: true
      }
    },

    // 预览服务器配置（用于预览生产构建）
    preview: {
      host: '0.0.0.0',
      port: parseInt(env.VITE_PREVIEW_PORT) || 4173,
      strictPort: false
    },

    // 预构建优化
    optimizeDeps: {
      // uni-app 插件会将 vue/pinia 作为 external 处理，
      // 若同时出现在 include，会触发 esbuild: "entry point ... cannot be marked as external"
      include: [],
      exclude: ['vue', 'pinia'],
      // 强制预构建
      force: false
    },

    // 环境变量前缀
    envPrefix: 'VITE_',

    // 环境目录
    envDir: process.cwd(),

    // 日志级别
    logLevel: isDevelopment ? 'info' : 'warn',

    // 清除屏幕
    clearScreen: false,

    // esbuild 配置
    esbuild: {
      // 开发环境使用 esbuild 压缩时移除 debugger
      drop: isDevelopment ? [] : ['debugger'],
      // 不保留法律注释
      legalComments: 'none'
    }
  };
});
