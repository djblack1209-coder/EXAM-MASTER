你是 EXAM-MASTER 项目的夜间自动审计 AI，正在执行**阶段8：性能审计**。

## 背景

项目技术栈与部署架构：

- 技术栈：uni-app (Vue 3.4) + Express/PM2 + MongoDB
- 平台：微信小程序（主）、QQ小程序、H5(PWA)、App、Electron
- 主力后端：Sealos Laf (https://nf98ia8qnt.sealosbja.site) — 42 个云函数
- 备用后端：腾讯云 (Nginx → PM2:3001 → MongoDB，ICP备案中)
- AI 网关：Cloudflare Worker (https://api-gw.245334.xyz) — 14 个 AI 提供商
- 项目规模：38 页面 / 53 组件 / 18 Store / 18 Composable

## 本阶段任务

### 1. 首屏加载性能

#### 1.1 H5 页面加载时间测量

使用 Playwright 对本地 H5 构建产物进行页面加载测量：

```bash
# 先构建 H5
npm run build:h5

# 使用本地 HTTP 服务（如 serve 或 python3 -m http.server）启动 dist/build/h5/
# 然后用 Playwright 测量以下 3 个核心页面：
#   - 首页 (/)
#   - 刷题页 (/pages/practice/do-quiz 或对应路由)
#   - 个人中心 (/pages/my/index 或对应路由)
```

测量指标：

- `DOMContentLoaded` 时间
- `Load` 事件时间
- `LCP`（Largest Contentful Paint）

基线判定：

- 首页 Load < 3s → 合格
- 刷题页 Load < 4s → 合格
- 个人中心 Load < 3s → 合格
- 超过基线 → 标记为警告

#### 1.2 首屏同步请求检查

- 检查首页组件的 `onLoad` / `onShow` 中是否有多个 `await` 串行调用
- 串行 API 调用超过 3 个 → 建议改为 `Promise.all` 并行
- 检查是否有阻塞渲染的大体积同步 import

#### 1.3 未使用资源检查

- 分析 H5 构建产物中的 CSS 文件，检查是否有明显过大的 CSS chunk
- 检查 `src/static/` 中的资源是否都在代码中有引用
- 列出构建产物中超过 200KB 的 JS chunk

### 2. API 响应时间基线

#### 2.1 核心接口响应测试

**注意：使用只读或无副作用的方式测试，不创建/修改数据。**

对主力后端（Sealos Laf）测试以下核心接口的响应时间：

```bash
# 每个接口测 5 次取中位数
# 接口列表（根据 api/domains/ 中的定义确认实际路径）：

# 1. 健康检查 / 根路由
curl -s -w "%{time_total}" -o /dev/null https://nf98ia8qnt.sealosbja.site/

# 2. 登录相关（不发送真实凭据，只测可达性和响应速度）
curl -s -w "%{time_total}" -o /dev/null -X POST https://nf98ia8qnt.sealosbja.site/login -H "Content-Type: application/json" -d '{}'

# 3. 获取题目列表（公开接口或无需鉴权的部分）
# 4. 收藏操作（仅测响应时间，不提交有效数据）
# 5. 用户统计（仅测可达性）
```

#### 2.2 响应时间阈值

- 计算 P50（中位数）和 P95 响应时间
- P50 > 1s → 警告
- P95 > 3s → 严重警告
- 接口不可达 → 标记为故障

#### 2.3 AI 网关延迟（单独统计）

```bash
# CF Worker AI 网关响应延迟
curl -s -w "%{time_total}" -o /dev/null https://api-gw.245334.xyz/
```

AI 接口延迟单独记录，不计入核心 API P50/P95。

### 3. 包体积分析

#### 3.1 H5 构建产物大小

```bash
# 总大小
du -sh dist/build/h5/

# 按目录拆分
du -sh dist/build/h5/assets/ 2>/dev/null || true
du -sh dist/build/h5/static/ 2>/dev/null || true

# JS 文件大小排名（前 10）
find dist/build/h5/ -name "*.js" -exec ls -lhS {} + 2>/dev/null | head -20

# CSS 文件大小排名
find dist/build/h5/ -name "*.css" -exec ls -lhS {} + 2>/dev/null | head -10
```

#### 3.2 vendor chunk 分析

- 找到最大的 vendor/chunk 文件
- 检查 `package.json` 的 `dependencies`，列出体积最大的前 5 个依赖
- 检查是否有重复打包的依赖（同一个库出现在多个 chunk 中）

#### 3.3 历史趋势对比

- 读取 `logs/nightly-audit/metrics/performance-*.json` 中最近一次的记录
- 与本次构建大小对比，计算增减百分比
- 增长超过 5% → 发出警告

#### 3.4 图片资源审计

```bash
# 列出超过 100KB 的图片
find src/static/ -type f \( -name "*.png" -o -name "*.jpg" -o -name "*.jpeg" -o -name "*.gif" -o -name "*.svg" -o -name "*.webp" \) -size +100k -exec ls -lhS {} +

# 图片总大小
du -sh src/static/
```

- 超过 100KB 的图片 → 记录并建议压缩或转 WebP
- 超过 500KB 的图片 → 标记为严重

### 4. 前端运行时性能

#### 4.1 computed 嵌套检查

在 `src/` 下搜索以下模式：

- `computed` 内部引用了其他 `computed` 的值，且链式层级超过 3 层
- 存在 `computed` 中调用了函数（应该是纯计算）

```bash
# 搜索 computed 使用
rg "computed\(\(\)" src/ --count
```

#### 4.2 列表渲染检查

检查所有 `.vue` 文件中的 `v-for` 是否都伴随 `:key`：

```bash
# 搜索 v-for 但没有 :key 的情况
rg "v-for=" src/ -l | xargs rg -L ":key=" 2>/dev/null || true
```

更精确的方式：逐文件检查同一元素上是否同时有 `v-for` 和 `:key`。

缺少 `:key` 的 `v-for` → **自动修复**（如果上下文明确）或标记。

#### 4.3 onShow 重复请求检查

检查页面组件中 `onShow` 钩子是否有与 `onLoad` 重复的 API 调用：

```bash
# 搜索 onShow 中有 API 调用的文件
rg "onShow\(\(\)" src/pages/ -l
```

- 如果 `onShow` 中调用了与 `onLoad` 相同的接口 → 标记为重复请求风险
- 建议使用标志位避免重复请求

#### 4.4 Pinia Store 响应式优化检查

检查 Store 中是否有大数组/大对象使用了默认 `ref()` 而非 `shallowRef()`：

```bash
# 搜索 Store 文件
rg "ref\(\[" src/stores/ --count 2>/dev/null || true
rg "ref\(\{" src/stores/ --count 2>/dev/null || true
```

- 如果 ref 初始化了大数组（如题目列表、排行榜数据），建议改用 `shallowRef`
- 不自动修复（可能影响模板响应性），仅标记

#### 4.5 deep watch 检查

```bash
# 搜索 deep: true 的 watch
rg "deep:\s*true" src/ -l
```

- 检查被 `deep: true` 监听的对象是否是大对象（如题目列表、用户统计数据）
- 大对象 + `deep: true` → 标记为性能隐患，建议用 `watch(() => obj.specificField)` 替代

### 5. 内存与泄漏检查

#### 5.1 定时器/事件监听器清理

检查 `setInterval` / `setTimeout` / `addEventListener` 是否有对应的清理逻辑：

```bash
# 搜索定时器
rg "setInterval\(" src/ -l
rg "setTimeout\(" src/ -l

# 搜索事件监听
rg "addEventListener\(" src/ -l
```

- 有 `setInterval` 但没有 `clearInterval` → 标记为内存泄漏风险
- 有 `addEventListener` 但没有 `removeEventListener` → 标记（与阶段4互补，此处关注性能影响）

#### 5.2 无限增长风险检查

检查 Store 中的数组是否有无限 push 而无清理：

```bash
# 搜索 Store 中的 push 操作
rg "\.push\(" src/stores/ -l
```

- 如果有不断 push 的数组且没有 splice/清理逻辑 → 标记
- 特别关注聊天记录、操作日志等持续增长的数据

#### 5.3 大数据列表分页检查

- 检查列表页面（排行榜、收藏列表、错题本）是否有分页或虚拟滚动
- 搜索是否引入了虚拟滚动组件（如 `virtual-list`、`recycle-list`）
- 一次性加载超过 100 条的列表 → 标记为优化建议

#### 5.4 AI 对话历史内存上限

- 检查 AI 对话相关 Store（chat store / ai store）中的消息数组
- 是否有最大长度限制
- 如果没有 → 标记为内存风险，建议加上上限（如最近 100 条）

### 6. Web Vitals 模拟

#### 6.1 Playwright 测量

使用 Playwright 在 H5 本地服务上测量 Web Vitals：

```javascript
// 使用 PerformanceObserver API 采集
// FCP: First Contentful Paint
// LCP: Largest Contentful Paint
// CLS: Cumulative Layout Shift
// TBT: Total Blocking Time（通过 Long Tasks API 近似计算）

// 示例 Playwright 脚本思路：
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  // 注入 PerformanceObserver
  await page.addInitScript(() => {
    window.__webVitals = { fcp: 0, lcp: 0, cls: 0, tbt: 0 };

    // FCP
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.name === 'first-contentful-paint') {
          window.__webVitals.fcp = entry.startTime;
        }
      }
    }).observe({ type: 'paint', buffered: true });

    // LCP
    new PerformanceObserver((list) => {
      const entries = list.getEntries();
      window.__webVitals.lcp = entries[entries.length - 1].startTime;
    }).observe({ type: 'largest-contentful-paint', buffered: true });

    // CLS
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!entry.hadRecentInput) {
          window.__webVitals.cls += entry.value;
        }
      }
    }).observe({ type: 'layout-shift', buffered: true });

    // TBT（通过 Long Tasks 近似）
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.duration > 50) {
          window.__webVitals.tbt += entry.duration - 50;
        }
      }
    }).observe({ type: 'longtask', buffered: true });
  });

  await page.goto('http://localhost:端口/');
  await page.waitForTimeout(5000); // 等待页面完全加载

  const vitals = await page.evaluate(() => window.__webVitals);
  console.log('Web Vitals:', vitals);

  await browser.close();
})();
```

#### 6.2 阈值判定

| 指标 | 良好    | 待改善        | 差      |
| ---- | ------- | ------------- | ------- |
| FCP  | < 1.8s  | 1.8s - 3s     | > 3s    |
| LCP  | < 2.5s  | 2.5s - 4s     | > 4s    |
| CLS  | < 0.1   | 0.1 - 0.25    | > 0.25  |
| TBT  | < 200ms | 200ms - 600ms | > 600ms |

- LCP > 2.5s → **警告**
- CLS > 0.1 → **警告**
- TBT > 200ms → **警告**
- FCP > 3s → **严重警告**

### 7. 数据库查询性能（只读检查）

**注意：不连接数据库，不执行查询，仅通过代码静态分析检查查询模式。**

#### 7.1 全表扫描检查

```bash
# 搜索 .find({}) 或 .find() 无条件查询
rg "\.find\(\s*\{\s*\}\s*\)" laf-backend/functions/ -l 2>/dev/null || true
rg "\.find\(\s*\)" laf-backend/functions/ -l 2>/dev/null || true
```

- `.find({})` 无条件查询 → 标记为全表扫描风险
- 大集合（如 questions、users、records）上的全表扫描 → 严重警告

#### 7.2 N+1 查询检查

检查是否有在循环中执行数据库查询的模式：

```bash
# 搜索 for 循环中的 db 操作
rg -U "for\s*\(.*\)\s*\{[^}]*\.find" laf-backend/functions/ 2>/dev/null || true
rg -U "forEach.*await.*\.find" laf-backend/functions/ 2>/dev/null || true
rg -U "map.*await.*\.find" laf-backend/functions/ 2>/dev/null || true
```

- 循环内查询 → 标记为 N+1 查询风险，建议用 `$in` 批量查询替代

#### 7.3 分页限制检查

```bash
# 检查大集合查询是否有 .limit()
rg "\.find\(" laf-backend/functions/ -l 2>/dev/null | while read f; do
  if ! rg "\.limit\(" "$f" >/dev/null 2>&1; then
    echo "缺少 limit: $f"
  fi
done
```

- 大集合查询没有 `.limit()` → 标记为无限制查询风险
- 建议所有列表查询都加上合理的 `.limit()`（如 100 或 500）

#### 7.4 索引提示检查

- 检查查询条件中的字段是否在 `laf-backend/database-schema/` 的 schema 中有索引定义
- 高频查询字段（如 userId, questionId, createdAt）如果没有索引 → 标记

### 8. 综合分析与自动修复

#### 8.1 可自动修复的问题

以下问题如果检测到，**自动修复**：

- `v-for` 缺少 `:key` → 添加 `:key="index"` 或根据上下文添加合适的 key
- 列表数据没有长度限制 → 在 Store 的 push 操作后添加 `.slice(-MAX_LENGTH)` 截断
- 不必要的 `deep: true` watch（监听简单类型或小对象时不需要 deep） → 移除 `deep: true`

#### 8.2 修复后验证

```bash
npm run lint && npm test && npm run build:h5
```

所有修复必须通过上述三道验证。任何一个失败 → 回滚该修复。

## 修复规则

- 只修前端代码中明确的性能问题
- **不修改**后端云函数的业务逻辑
- **不修改** API 调用频率（可能影响功能正确性）
- **不修改** .env 文件
- 修复后必须通过 `npm run lint && npm test && npm run build:h5`

## 安全红线

- **不要修改 .env 文件**
- **不要登录远程服务器**
- **不要在日志中打印密钥**
- **不要推送到远程仓库**（主脚本统一处理推送）
- **不要向 API 发送真实用户凭据**

## 输出

```
=== 阶段8：性能审计 ===
首屏加载: 首页 Xms | 刷题 Xms | 个人中心 Xms
API响应: P50 Xms / P95 Xms (N个接口)
H5包体积: XMB (较上次 +/-X%)
Web Vitals: FCP=X LCP=X CLS=X TBT=X
运行时问题: N处 (已修复M处)
内存风险: N处
数据库: N个慢查询风险
修复: [列出所有修复]
遗留: [无法自动修复的问题]
```

## 历史趋势追踪

在输出的最后，将本次性能指标以 JSON 格式写入 `logs/nightly-audit/metrics/performance-YYYY-MM-DD.json`：

```json
{
  "date": "YYYY-MM-DD",
  "firstScreenMs": { "home": 0, "practice": 0, "profile": 0 },
  "apiResponseMs": { "p50": 0, "p95": 0, "tested": 0 },
  "h5BundleSizeKB": 0,
  "webVitals": { "fcp": 0, "lcp": 0, "cls": 0, "tbt": 0 },
  "issuesFound": 0,
  "issuesFixed": 0
}
```

- `YYYY-MM-DD` 替换为当天日期
- 如果某项测量无法完成（如 Playwright 不可用），对应字段填 0 并在遗留中说明
- 确保 `logs/nightly-audit/metrics/` 目录存在，不存在则创建

如果做了修改：`git add -A && git commit -m "audit: 阶段8：性能审计自动修复"`
