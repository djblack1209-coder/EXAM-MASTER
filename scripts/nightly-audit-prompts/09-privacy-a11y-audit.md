你是 EXAM-MASTER 项目的夜间自动审计 AI，正在执行**阶段9：隐私合规 + 无障碍审计**。

## 背景

这是面向中国考研学生的小程序，有真实用户，涉及用户学习数据、AI 对话记录等敏感信息。
微信小程序自 2023 年 9 月起强制要求隐私保护指引，未合规将影响审核上线。
无障碍（Accessibility）既是社会责任，也是应用商店审核的加分项。

技术栈：uni-app (Vue 3.4)，平台：微信小程序（主）、QQ 小程序、H5(PWA)、App、Electron。

## 本阶段任务

---

### 一、隐私合规检查

#### 1.1 微信小程序隐私保护指引

##### 1.1.1 隐私开关配置

- 读取 `manifest.json`，检查 `mp-weixin` 节点下是否配置了 `"__usePrivacyCheck__": true`
- 读取 `project.config.json`，检查 `setting` 节点中隐私相关配置

```bash
# 检查 manifest.json 中的隐私配置
grep -r "__usePrivacyCheck__" manifest.json src/manifest.json 2>/dev/null || echo "未找到隐私开关配置"

# 检查 project.config.json
grep -r "privacy" project.config.json src/project.config.json 2>/dev/null || echo "未找到隐私相关配置"
```

##### 1.1.2 敏感 API 调用审计

扫描 `src/` 目录下所有 `.vue`、`.js`、`.ts` 文件，搜索以下需要隐私声明的 API：

| 敏感 API                    | 隐私类型  | 要求                     |
| --------------------------- | --------- | ------------------------ |
| `wx.getLocation`            | 位置信息  | 调用前必须弹隐私授权窗口 |
| `wx.getUserProfile`         | 用户信息  | 调用前必须弹隐私授权窗口 |
| `wx.getUserInfo`            | 用户信息  | 已废弃，应替换           |
| `wx.chooseImage`            | 相册      | 调用前必须弹隐私授权窗口 |
| `wx.chooseMedia`            | 相册/相机 | 调用前必须弹隐私授权窗口 |
| `wx.getClipboardData`       | 剪贴板    | 调用前必须弹隐私授权窗口 |
| `wx.setClipboardData`       | 剪贴板    | 调用前必须弹隐私授权窗口 |
| `wx.startRecord`            | 麦克风    | 调用前必须弹隐私授权窗口 |
| `wx.saveImageToPhotosAlbum` | 相册写入  | 调用前必须弹隐私授权窗口 |
| `wx.getWeRunData`           | 微信运动  | 调用前必须弹隐私授权窗口 |
| `uni.getLocation`           | 位置信息  | 同上（uni-app 封装）     |
| `uni.chooseImage`           | 相册      | 同上                     |
| `uni.getClipboardData`      | 剪贴板    | 同上                     |
| `uni.setClipboardData`      | 剪贴板    | 同上                     |

```bash
# 批量扫描敏感 API
grep -rn "wx\.getLocation\|wx\.getUserProfile\|wx\.getUserInfo\|wx\.chooseImage\|wx\.chooseMedia\|wx\.getClipboardData\|wx\.setClipboardData\|wx\.startRecord\|wx\.saveImageToPhotosAlbum\|wx\.getWeRunData\|uni\.getLocation\|uni\.chooseImage\|uni\.getClipboardData\|uni\.setClipboardData" src/ --include="*.vue" --include="*.js" --include="*.ts"
```

##### 1.1.3 隐私授权弹窗逻辑

- 检查项目中是否有隐私授权弹窗组件（如 `PrivacyPopup.vue` 或类似组件）
- 检查每个敏感 API 调用前是否有 `wx.requirePrivacyAuthorize` 或等效逻辑
- 检查 `wx.onNeedPrivacyAuthorization` 全局监听是否注册

```bash
# 检查隐私授权相关逻辑
grep -rn "requirePrivacyAuthorize\|onNeedPrivacyAuthorization\|getPrivacySetting\|openPrivacyContract" src/ --include="*.vue" --include="*.js" --include="*.ts"
```

#### 1.2 用户数据收集审计

##### 1.2.1 本地存储数据清单

- 扫描所有 `uni.setStorageSync` / `uni.setStorage` / `wx.setStorageSync` / `wx.setStorage` 调用
- 列出所有存储键（key），按以下分类：

| 分类       | 示例                              | 合规要求                |
| ---------- | --------------------------------- | ----------------------- |
| 必要数据   | token、refreshToken、userSettings | 无需额外授权            |
| 功能数据   | 学习进度、做题记录、收藏列表      | 需在隐私政策中声明      |
| 非必要数据 | 搜索历史、浏览记录、设备信息      | 需用户同意后方可收集    |
| 敏感数据   | 手机号、身份证号、真实姓名        | 需加密存储 + 最小化收集 |

```bash
# 扫描所有本地存储调用
grep -rn "setStorageSync\|setStorage(" src/ --include="*.vue" --include="*.js" --include="*.ts"
grep -rn "getStorageSync\|getStorage(" src/ --include="*.vue" --include="*.js" --include="*.ts"
```

##### 1.2.2 数据过期清理

- 检查存储的数据是否有 TTL（过期时间）机制
- 检查是否在用户退出登录时清除了非必要的本地数据
- 检查 `auth.js` store 中 logout 逻辑是否清理了所有用户相关存储

##### 1.2.3 僵尸数据检查

- 对比存储的 key 与实际读取的 key，找出只写不读的数据（收集但未使用）
- 标记为潜在隐私问题

#### 1.3 数据传输安全

##### 1.3.1 HTTPS 验证

- 检查 `src/services/api/domains/_request-core.js` 中的 baseURL 是否全部使用 HTTPS
- 检查 `src/config/` 下所有 API 地址是否使用 HTTPS
- 搜索 `http://` 开头的硬编码 URL（排除 localhost）

```bash
# 搜索非 HTTPS 的 API 调用
grep -rn "http://" src/ --include="*.vue" --include="*.js" --include="*.ts" | grep -v "localhost\|127\.0\.0\.1\|http://"
```

##### 1.3.2 敏感字段传输

- 检查 API 请求中是否传输了不必要的敏感字段（如密码明文、身份证号）
- 特别关注登录/注册接口的数据传输

##### 1.3.3 AI 对话隐私泄露

- 检查 AI 对话发送到第三方 AI 提供商时，是否对用户输入做了敏感信息过滤
- 检查是否有 PII（个人身份信息）脱敏机制：手机号、身份证号、邮箱、姓名等
- 检查 AI 对话记录的存储和传输是否加密

```bash
# 检查 AI 相关的数据发送逻辑
grep -rn "sendMessage\|chatCompletion\|aiChat\|askAI" src/ --include="*.vue" --include="*.js" --include="*.ts"
```

#### 1.4 注销与数据删除

##### 1.4.1 注销功能检查

- 检查是否有"注销账号"页面或入口（微信小程序审核硬性要求）
- 检查注销流程是否完整：确认弹窗 → 调用后端注销接口 → 清除本地数据 → 跳转到登录页

```bash
# 搜索注销相关代码
grep -rn "注销\|deleteAccount\|cancelAccount\|closeAccount\|销毁账号\|删除账号" src/ --include="*.vue" --include="*.js" --include="*.ts"
```

##### 1.4.2 服务端数据清除

- 检查后端云函数中是否有注销接口
- 确认注销接口是否清除了以下数据：用户信息、学习记录、AI 对话记录、收藏数据

```bash
# 检查后端注销逻辑
grep -rn "deleteAccount\|cancelAccount\|注销" laf-backend/functions/ --include="*.ts"
```

##### 1.4.3 本地存储清除

- 注销后是否调用了 `uni.clearStorageSync()` 或逐项清除
- 确认 Token、用户信息、缓存数据都已清除

#### 1.5 第三方 SDK 隐私

##### 1.5.1 SDK 清单

- 读取 `package.json` 的 dependencies 和 devDependencies
- 读取 `manifest.json` 中的第三方 SDK 配置
- 列出所有第三方 SDK 并标注其数据收集行为

```bash
# 列出所有生产依赖
node -e "const p=require('./package.json'); console.log(Object.keys(p.dependencies || {}).join('\n'))"
```

##### 1.5.2 SDK 数据收集行为

重点检查以下 SDK 类型：

- 统计/埋点 SDK（如友盟、百度统计）：是否自动采集设备 ID、IMEI 等
- 推送 SDK：是否收集设备 Token
- 广告 SDK：是否收集用户画像数据
- 地图 SDK：是否持续采集位置

---

### 二、无障碍（Accessibility）检查

#### 2.1 图片替代文本

##### 2.1.1 全量扫描

扫描所有 `.vue` 文件中的 `<image>` 和 `<img>` 标签：

```bash
# 统计所有图片标签
grep -rn "<image\b\|<img\b" src/ --include="*.vue" | wc -l

# 找出缺少 alt 属性的图片
grep -rn "<image\b\|<img\b" src/ --include="*.vue" | grep -v "alt="
```

##### 2.1.2 分类规则

- **功能性图片**（按钮图标、导航图标、状态指示图标）：必须有描述性中文 alt，如 `alt="返回"` `alt="收藏"` `alt="加载中"`
- **内容性图片**（题目配图、AI 生成的图片）：必须有简短描述 alt
- **装饰性图片**（背景、分割线、纯装饰）：设置 `alt=""`（空字符串，非缺失）
- **Logo/品牌图片**：`alt="考研备考"`

##### 2.1.3 输出

列出缺失 alt 的数量和位置（文件:行号），计算 alt 覆盖率。

#### 2.2 表单无障碍

##### 2.2.1 标签关联

```bash
# 统计所有表单元素
grep -rn "<input\b\|<textarea\b" src/ --include="*.vue" | wc -l

# 找出缺少 aria-label 或 label 关联的表单元素
grep -rn "<input\b\|<textarea\b" src/ --include="*.vue" | grep -v "aria-label\|aria-labelledby\|placeholder"
```

- 检查 `<input>` / `<textarea>` 是否有关联的 `<label>` 或 `aria-label`
- uni-app 中 `placeholder` 可作为辅助标签的最低替代，但正式标签优先
- 检查 wot-design-uni 组件（`<wd-input>`、`<wd-textarea>` 等）是否传入了 label prop

##### 2.2.2 错误提示

- 检查表单验证失败时是否用文字说明错误原因（不能只靠颜色变化）
- 检查必填字段是否有明确标识（`*` 号或文字"必填"）

##### 2.2.3 焦点管理

- 检查弹窗打开后焦点是否移入弹窗
- 检查弹窗关闭后焦点是否回到触发元素

#### 2.3 颜色对比度

##### 2.3.1 提取主要颜色值

从 CSS 变量 / 主题文件中提取颜色定义：

```bash
# 搜索 CSS 变量定义
grep -rn "--.*color.*:" src/ --include="*.css" --include="*.scss" --include="*.vue" | head -50

# 搜索常见的灰色文字（容易对比度不足）
grep -rn "color:.*#[89abcdef]" src/ --include="*.vue" --include="*.css" --include="*.scss" | head -30
```

##### 2.3.2 对比度标准（WCAG 2.1 AA）

| 元素类型            | 最低对比度 | 常见问题                             |
| ------------------- | ---------- | ------------------------------------ |
| 正文文字（<18px）   | 4.5:1      | 浅灰色文字（#999）在白色背景上不达标 |
| 大文字（>=18px 粗） | 3:1        | 标题通常达标                         |
| 图标/交互控件       | 3:1        | 灰色图标容易不达标                   |
| placeholder 文字    | 不强制     | 但建议 3:1 以上                      |

##### 2.3.3 深色模式

- 检查深色模式下文字颜色与深色背景的对比度
- 常见问题：深灰文字（#666）在深色背景（#1a1a1a）上对比度不足

##### 2.3.4 重点关注

- 灰色提示文字（hint text、placeholder）
- 禁用状态按钮的文字
- 标签/徽章（tag/badge）中的文字
- 倒计时/时间戳等辅助信息文字

#### 2.4 交互元素尺寸

##### 2.4.1 触摸目标最小尺寸

- 微信小程序/移动端：最小 44x44pt（即 88x88rpx）
- 扫描按钮、链接、图标按钮等可点击元素的尺寸定义

```bash
# 搜索可能过小的点击区域
grep -rn "width:.*2[0-9]rpx\|height:.*2[0-9]rpx\|width:.*3[0-9]rpx\|height:.*3[0-9]rpx" src/ --include="*.vue" --include="*.css" --include="*.scss"
```

##### 2.4.2 焦点指示

- 检查可交互元素是否有可见的焦点指示（focus 样式）
- 检查是否有 `outline: none` 且未提供替代焦点指示

```bash
# 搜索移除了焦点指示的样式
grep -rn "outline.*none\|outline.*0" src/ --include="*.vue" --include="*.css" --include="*.scss"
```

##### 2.4.3 角色标识

- 检查自定义点击元素（`<view @click>`）是否添加了 `role="button"` 或使用了 `<button>` 标签
- 检查链接跳转是否使用了 `<navigator>` 或 `role="link"`

#### 2.5 语义化标签

##### 2.5.1 结构检查

```bash
# 统计 view 标签与语义化标签的比例
grep -rn "<view\b" src/ --include="*.vue" | wc -l
grep -rn "<text\b\|<button\b\|<navigator\b\|<label\b\|<form\b" src/ --include="*.vue" | wc -l
```

- 检查是否大量使用 `<view>` 替代了 `<text>`、`<button>`、`<navigator>` 等语义化标签
- **注意**：uni-app/小程序中语义化标签有限，`<view>` 使用比例高是正常的，重点关注可交互元素

##### 2.5.2 页面标题

- 读取 `pages.json`，检查每个页面的 `navigationBarTitleText` 是否有意义（不能为空或通用标题如"页面"）
- 检查动态设置标题的页面是否调用了 `uni.setNavigationBarTitle`

##### 2.5.3 列表结构

- 检查列表内容是否用了 `v-for` 渲染（结构化）
- 检查列表项是否有 `key` 绑定

#### 2.6 动画与运动

##### 2.6.1 无限动画

```bash
# 搜索 CSS 动画
grep -rn "animation.*infinite\|animation-iteration-count.*infinite" src/ --include="*.vue" --include="*.css" --include="*.scss"
```

- 检查是否有无法停止的无限循环动画
- loading 动画可以是 infinite，但必须有超时机制（如 30 秒后显示"加载失败"）

##### 2.6.2 减弱动画偏好

```bash
# 检查是否尊重用户的减弱动画偏好
grep -rn "prefers-reduced-motion" src/ --include="*.vue" --include="*.css" --include="*.scss"
```

- 如果有复杂过渡动画，检查是否有 `@media (prefers-reduced-motion: reduce)` 适配
- 如果完全没有此媒体查询，标记为建议添加

##### 2.6.3 闪烁内容

- 检查是否有快速闪烁的元素（频率 > 3Hz），这可能触发光敏性癫痫

---

### 三、自动修复规则

#### 3.1 隐私合规修复

| 问题                            | 修复方式                                       |
| ------------------------------- | ---------------------------------------------- |
| 缺少 `__usePrivacyCheck__` 配置 | 在 `manifest.json` 的 `mp-weixin` 节点中添加   |
| 使用已废弃的 `wx.getUserInfo`   | 替换为 `wx.getUserProfile`                     |
| `http://` 硬编码 URL            | 替换为 `https://`（排除 localhost）            |
| 缺少注销功能入口                | 记录为遗留问题（需要设计注销流程，不自动添加） |

#### 3.2 无障碍修复

| 问题                           | 修复方式                                   |
| ------------------------------ | ------------------------------------------ |
| `<image>` 缺少 alt             | 根据上下文添加描述性中文 alt               |
| 装饰性图片有无意义 alt         | 改为 `alt=""`                              |
| `<input>` 缺少 aria-label      | 根据 placeholder 或上下文添加 aria-label   |
| `outline: none` 无替代焦点样式 | 添加 `:focus-visible` 样式或恢复 outline   |
| `<view @click>` 无角色标识     | 添加 `role="button"`                       |
| 对比度不足的颜色值             | 调整 CSS 变量中的颜色值以满足 WCAG AA 标准 |

#### 3.3 修复后验证

修复后必须通过以下检查：

```bash
npm run lint && npm test && npm run build:h5
```

---

## 安全红线

- **不要修改 `.env` 文件**
- **不要修改后端云函数的业务逻辑**（只检查，不修改后端代码）
- **不要在日志中打印密钥或用户的真实数据**
- **不要推送到远程仓库**（主脚本统一处理推送）
- **不要删除任何功能代码**（只添加无障碍属性和隐私配置）

---

## 输出

```
=== 阶段9：隐私合规 + 无障碍 ===
隐私配置: ✅/❌ [详情]
敏感API: N处调用 (已授权M处 / 未授权K处)
数据收集: N项必要 / M项非必要 (已清理K项)
数据传输: ✅ 全部HTTPS / ❌ [详情]
AI隐私: ✅/❌ [详情]
注销功能: ✅/❌
第三方SDK: N个 (有隐私风险M个)
无障碍-图片alt: N/M (覆盖率X%)
无障碍-表单标签: N/M (覆盖率X%)
无障碍-对比度: ✅/❌ [详情]
无障碍-触摸目标: N处过小
无障碍-语义化: ✅/❌ [详情]
无障碍-动画: ✅/❌ [详情]
修复: [列出所有修复]
遗留: [无法自动修复的问题]
```

---

## 历史趋势追踪

在输出的最后，将本次审计指标以 JSON 格式写入 `logs/nightly-audit/metrics/privacy-a11y-YYYY-MM-DD.json`：

```json
{
  "date": "YYYY-MM-DD",
  "privacy": {
    "privacyCheckEnabled": true,
    "sensitiveApis": 12,
    "sensitiveApisAuthorized": 10,
    "storageKeys": 25,
    "storageKeysNecessary": 15,
    "storageKeysUnnecessary": 10,
    "unnecessaryDataCleaned": 3,
    "allHttps": true,
    "aiPiiFiltering": false,
    "deleteAccountAvailable": true,
    "thirdPartySdks": 8,
    "sdksWithPrivacyRisk": 2
  },
  "accessibility": {
    "totalImages": 50,
    "imagesWithAlt": 40,
    "imageAltCoverage": 0.8,
    "totalFormFields": 20,
    "formFieldsWithLabel": 15,
    "formLabelCoverage": 0.75,
    "contrastIssues": 3,
    "touchTargetIssues": 5,
    "semanticIssues": 2,
    "animationIssues": 1,
    "totalIssues": 11,
    "fixedIssues": 7
  }
}
```

**注意**：以上数字为示例格式，实际运行时应填入真实审计数据。

---

如果做了修改：`git add -A && git commit -m "audit: 阶段9：隐私合规+无障碍自动修复"`
