import { defineConfig } from 'vite';
import uniModule from '@dcloudio/vite-plugin-uni';
import path from 'path';

const uni = typeof uniModule === 'function' ? uniModule : uniModule.default || uniModule;

export default defineConfig({
  plugins: [uni()],
  resolve: {
    alias: {
      '@': path.resolve(process.cwd(), 'src')
    }
  }
});
