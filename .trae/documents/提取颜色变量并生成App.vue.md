## 提取颜色变量并生成App.vue

### 1. 颜色变量提取
从index.vue中提取的关键颜色变量：

| 变量名 | 浅色值（推断） | 深色值（index.vue实际值） |
|--------|----------------|---------------------------|
| --bg-page | #ffffff | #000000 |
| --bg-card | rgba(255, 255, 255, 0.95) | rgba(0, 0, 0, 0.7) |
| --text-main | #ff9800 | #ff9800 |
| --text-secondary | rgba(0, 0, 0, 0.8) | rgba(255, 255, 255, 0.9) |
| --primary | #00E5FF | #00E5FF |
| --secondary | #FF5722 | #FF5722 |
| --border | rgba(0, 0, 0, 0.1) | rgba(255, 152, 0, 0.4) |
| --shadow | rgba(0, 0, 0, 0.1) | rgba(255, 152, 0, 0.2) |
| --text-tertiary | rgba(0, 0, 0, 0.6) | rgba(255, 255, 255, 0.8) |
| --bg-progress | rgba(0, 0, 0, 0.1) | rgba(255, 255, 255, 0.2) |
| --bg-loading | #f5f5f5 | radial-gradient(ellipse at center, #0a0a1a 0%, #000000 100%) |

### 2. 生成App.vue
- 在`<style>`中使用`:root`定义浅色模式变量
- 使用`@media (prefers-color-scheme: dark)`定义深色模式变量
- 严格使用index.vue中的深色值，浅色值根据语义化推断

### 3. 验证清单
列出提取的颜色对照表，确保色值准确