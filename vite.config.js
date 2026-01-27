import { defineConfig } from 'vite'
import uni from '@dcloudio/vite-plugin-uni'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    uni()
  ],
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
    'process.env.SENTRY_DSN': JSON.stringify(process.env.SENTRY_DSN || '')
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@/services': path.resolve(__dirname, 'src/services'),
      '@/stores': path.resolve(__dirname, 'src/stores'),
      '@/common': path.resolve(__dirname, 'common'),
      '@/components': path.resolve(__dirname, 'src/components'),
      '@/pages': path.resolve(__dirname, 'src/pages'),
      '@/utils': path.resolve(__dirname, 'src/utils'),
      '@/static': path.resolve(__dirname, 'src/static')
    }
  },
  css: {
    preprocessorOptions: {
      scss: {
        silenceDeprecations: ['legacy-js-api']
      }
    }
  },
  build: {
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true
      }
    }
  }
})
