import { createSSRApp } from 'vue'
import App from './App.vue'

export function createApp() {
    const app = createSSRApp(App)
    return { app }
}

// H5 平台挂载
// #ifdef H5
const { app } = createApp()
app.mount('#app')
console.log('[Main] App mounted successfully')
// #endif
