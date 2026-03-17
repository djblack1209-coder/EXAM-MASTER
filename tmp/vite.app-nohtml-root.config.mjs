import { defineConfig } from 'vite';
import uniModule from '@dcloudio/vite-plugin-uni';
import path from 'path';

const uni = typeof uniModule === 'function' ? uniModule : Reflect.get(Object(uniModule), 'default') || uniModule;

export default defineConfig({
  root: path.resolve(process.cwd(), 'tmp/app-nohtml-root'),
  plugins: [uni()],
  resolve: {
    alias: {
      '@': path.resolve(process.cwd(), 'src')
    }
  }
});
