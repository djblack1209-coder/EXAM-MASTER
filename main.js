import { createSSRApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'

export function createApp() {
  const app = createSSRApp(App)
  const pinia = createPinia()

  app.use(pinia)

  return {
    app,
    pinia
  }
}

// H5 平台挂载
// #ifdef H5
const { app } = createApp()
app.mount('#app')
// #endif
