# 全面代码质量修复计划

## 第一步：ESLint 手动修复 3 个错误

### 1.1 `src/pages/mistake/index.vue:246-266` — 删除重复的 computed 属性

删除第一个 `filteredReviewMistakes`（246-266行），保留第二个（268-288行，兼容 camelCase + snake_case）。

将：
```
    // ✅ 1.7: 根据筛选条件过滤错题
    filteredReviewMistakes() {
      if (this.reviewFilter === 'high_freq') {
        return [...this.mistakes]
          .filter((m) => (m.wrong_count || 1) >= 2)
          .sort((a, b) => (b.wrong_count || 1) - (a.wrong_count || 1));
      }
      if (this.reviewFilter === 'recent') {
        return [...this.mistakes]
          .sort((a, b) => {
            const ta = a.last_wrong_time || a.created_at || 0;
            const tb = b.last_wrong_time || b.created_at || 0;
            return tb - ta;
          })
          .slice(0, 20);
      }
      return [...this.mistakes]
        .sort((a, b) => (b.wrong_count || 1) - (a.wrong_count || 1));
    },
    // ✅ 1.7: 根据筛选条件过滤错题
    filteredReviewMistakes() {
```

改为：
```
    // ✅ 1.7: 根据筛选条件过滤错题（兼容 camelCase 和 snake_case 字段名）
    filteredReviewMistakes() {
```

### 1.2 `src/services/storageService.js:156` — let 改 const

将 `let result = new Array(halfBlock.length);` 改为 `const result = new Array(halfBlock.length);`

### 1.3 `src/services/storageService.js:1259` — 未使用的 catch 变量

将 `} catch (e) {` 改为 `} catch (_e) {`

---

## 第二步：ESLint 自动修复 30 个警告

运行 `npm run lint:fix`

涉及文件：
- `src/componentsess/index/KnowledgeBubbleField.vue` — no-multi-spaces
- `src/config/index.js` — arrow-parens
- `src/pages/index/index.vue` — arrow-parens
- `src/pages/mistake/index.vue` — arrow-parens
- `src/pages/practice/import-data.vue` — indent
- `src/pages/practice/index.vue` — arrow-parens
- `src/services/http.js` — comma-dangle
- `src/services/lafService.js` — no-multi-spaces, arrow-parens
- `src/utils/event-emitter.js` — no-trailing-spaces
- `src/utils/response-validator.js` — comma-dangle

---

## 第三步：删除孤立页面和死代码

删除以下文件/目录（已验证零外部引用，未注册在 pages.json）：

- `src/pages/group/` 整个目录（index.vue + detail.`src/pages/legal/` 整个目录（user-agreement.vue）
- `src/services/groupService.js`（仅被 group 页面引用）

---

## 第四步：迁移静态资源

### 4.1 移动缺失的图标到 src/static/icons/

```bash
cp static/icons/study.png src/static/icons/study.png
cp static/icons/stack-of-books.png src/static/icons/stack-of-books.png
cp icon/loading-bar.png src/static/icons/loading-bar.png
```

### 4.2 修复路径引用

`src/pages/study-detail/index.vue:89`：
将 `src="/icon/loading-bar.png"` 改为 `src="/static/icons/loading-bar.png"`

---

## 第五步：删除冗余根目录资源

```bash
rm -rf static/          # 所有内容已在 src/static/ 中或已迁移
rm -rf icon/            # 11 个文件中 10 个无引用，1 个已迁移
rm logo.png             # 无引用，src/static/images/logo.png 是正式版本
```

---

## 第六步：package.json 添加 type: module

在 `package.json` 第 5 行 `"main": "main.js"` 后添加 `"type": "module"`，消除 ESLint 的 Node.js 性能警告。

---

## 第七步：安全处理 — 敏感文件从 Git 追踪中移除

.gitignore 已经包含了 `.env`、`.env.local`、`laf-backend/.env*` 的规则。
需要确认这些文件是否仍被 Git 追踪（可能在规则添加前已 commit）。

```bash
git rm --cached .env 2>/dev/null
git rm --cached .env.local 2>/dev/null
git rm --cached .env.development 2>/dev/null
git rm --cached .env.production 2>/dev/null
git rm --cached laf-backend/.env.backend 2>/dev/null
git rm --cached laf-backend/.env.backend.generated 2>/dev/null
```

这只会从 Git 追踪中移除，不会删除本地文件。

---

## 第八步：全部验证

```bash
npm run lint          # 确认 0 errors, 0 warnings
npm run test          # 确认测试通过
npm run build:mp-weixin  # 确认微信小程序构建成功
```

---

## 风险评估

| 步骤 | 风险 | 说明 |
|------|------|------|
| 1-2 | 低 | ESLint 修复，逻辑不变 |
| 3 | 无 | 已验证零外部引用 |
| 4-5 | 中 | 资源路径变更，需构建验证 |
| 6 | 低 | 仅影响 ESLint 加载性能 |
| 7 | 低 | 仅从 Git 追踪移除，不删文件 |
| 8 | — | 验证步骤 |
