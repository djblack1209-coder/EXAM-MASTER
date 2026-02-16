import { defineConfig, loadEnv } from 'vite'
import uni from '@dcloudio/vite-plugin-uni'
import path from 'path'
import fs from 'fs'

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
        const outDir = options.dir || ''
        if (!outDir.includes('mp-weixin')) return
        
        const src = path.resolve(__dirname, 'src/custom-tab-bar')
        const dest = path.resolve(outDir, 'custom-tab-bar')
        
        if (!fs.existsSync(src)) {
          console.warn('[TabBar Plugin] src/custom-tab-bar not found, skipping copy')
          return
        }
        if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true })
        
        let copied = 0
        for (const file of fs.readdirSync(src)) {
          fs.copyFileSync(path.join(src, file), path.join(dest, file))
          copied++
        }
        console.log(`[TabBar Plugin] Copied ${copied} files to ${dest}`)
      } catch (err) {
        // TabBar copy failure should not break the entire build
        console.error('[TabBar Plugin] Failed to copy custom-tab-bar:', err.message)
      }
    }
  }
}

// https://vitejs.dev/config/
export default defineConfig(({ command, mode }) => {
  // 加载环境变量
  const env = loadEnv(mode, process.cwd(), '')
  
  // 判断是否为生产环境
  const isProduction = mode === 'production'
  const isStaging = mode === 'staging'
  const isDevelopment = mode === 'development'
  
  console.log(`[Vite] Building for mode: ${mode}, command: ${command}`)
  
  return {
    plugins: [
      uni(),
      copyCustomTabBar()
    ],
    
    // 环境变量定义
    define: {
      'process.env.NODE_ENV': JSON.stringify(mode),
      'process.env.SENTRY_DSN': JSON.stringify(env.VITE_SENTRY_DSN || ''),
      '__APP_VERSION__': JSON.stringify(env.npm_package_version || '1.0.0'),
      '__BUILD_TIME__': JSON.stringify(new Date().toISOString()),
      '__BUILD_MODE__': JSON.stringify(mode)
    },
    
    // 路径别名
    resolve: {
      alias: {
        // ✅ P008: @ 映射到 src/，子路径自动解析无需重复声明
        '@': path.resolve(__dirname, 'src')
      }
    },
    
    // CSS 预处理器配置
    css: {
      preprocessorOptions: {
        scss: {
          silenceDeprecations: ['legacy-js-api'],
          // ✅ F003: 自动注入共享 SCSS 变量到所有组件
          additionalData: `
            @use "${path.resolve(__dirname, 'src/styles/_variables.scss').replace(/\\/g, '/')}" as *;
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
      sourcemap: isDevelopment ? 'inline' : (isStaging ? true : false),
      
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
      rollupOptions: {
        output: {
          // 分割代码块
          manualChunks: (id) => {
            // 仅对第三方库进行分组，src/ 下的代码交由 uni-app 自动分包
            // 避免将仅被分包引用的 utils/services 强制打入主包
            if (id.includes('node_modules')) {
              if (id.includes('vue') || id.includes('pinia')) {
                return 'vendor-vue'
              }
              return 'vendor'
            }
          },
          // 文件命名 - 生产环境使用 hash，开发环境使用可读名称
          chunkFileNames: isProduction 
            ? 'static/js/[name]-[hash].js'
            : 'static/js/[name].js',
          entryFileNames: isProduction
            ? 'static/js/[name]-[hash].js'
            : 'static/js/[name].js',
          assetFileNames: isProduction
            ? 'static/[ext]/[name]-[hash].[ext]'
            : 'static/[ext]/[name].[ext]'
        }
      },
      
      // 块大小警告限制（KB）
      chunkSizeWarningLimit: isProduction ? 500 : 1000,
      
      // 资源内联限制（小于此大小的资源会被内联为base64）
      assetsInlineLimit: 4096,
      
      // 构建目标（es2018 支持 async/await、rest/spread 等，减少 polyfill 体积）
      target: 'es2018',
      
      // CSS 代码分割
      cssCodeSplit: true,
      
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
                console.log(`[Proxy] ${req.method} ${req.url} -> ${options.target}`)
              })
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
      include: ['vue', 'pinia'],
      exclude: [],
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
  }
})
