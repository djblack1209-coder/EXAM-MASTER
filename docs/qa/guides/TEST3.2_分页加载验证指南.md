# TEST-3.2: 错题本分页加载验证指南

## 📋 测试目标
验证错题本页面在滚动到底部时，能够正确触发分页加载，自动加载更多错题数据。

## ✅ 前置条件
1. 确保错题本中有**超过 20 条错题**（pageSize = 20）
   - 如果不足，请先通过刷题功能做错更多题目
   - 或者手动创建测试数据

## 🔍 测试步骤

### 步骤 1: 打开错题本页面
1. 启动微信开发者工具
2. 进入错题本页面 (`pages/mistake/index.vue`)
3. 打开控制台（Console）

### 步骤 2: 观察第一页加载
1. 页面加载时，观察控制台日志：
   ```
   [mistake-book] 🔄 开始加载数据 - reset: true, currentPage: 1, pageSize: 20
   [mistake-book] 📡 调用 storageService.getMistakes(1, 20)
   [mistake-book] ✅ 数据加载完成: { count: 20, total: X, page: 1, hasMore: true/false, source: 'cloud' }
   [mistake-book] ✅ 重置模式：加载了 20 条错题
   [mistake-book] 📊 当前状态 - 总错题数: 20, hasMore: true, currentPage: 1
   ```

2. **预期结果**：
   - ✅ 第一页显示 20 条错题（如果总数 >= 20）
   - ✅ `hasMore` 为 `true`（如果总数 > 20）
   - ✅ `currentPage` 为 1

### 步骤 3: 滚动到底部触发分页
1. 在错题本页面中，**向下滚动到列表底部**
2. 观察控制台日志：
   ```
   [mistake-book] 📄 触发分页加载 - currentPage: 1, isLoading: false, hasMore: true
   [mistake-book] ➡️ 开始加载第 2 页
   [mistake-book] 🔄 开始加载数据 - reset: false, currentPage: 2, pageSize: 20
   [mistake-book] 📡 调用 storageService.getMistakes(2, 20)
   [mistake-book] ✅ 数据加载完成: { count: X, total: Y, page: 2, hasMore: true/false, source: 'cloud' }
   [mistake-book] ✅ 追加模式：从 20 条增加到 X 条（新增 Y 条）
   [mistake-book] 📊 当前状态 - 总错题数: X, hasMore: true/false, currentPage: 2
   ```

3. **预期结果**：
   - ✅ `loadMore()` 被调用
   - ✅ `currentPage` 递增为 2
   - ✅ 调用 `storageService.getMistakes(2, 20)`
   - ✅ 列表追加新数据（总数 > 20）
   - ✅ `hasMore` 根据实际情况更新

### 步骤 4: 继续滚动（如果还有更多数据）
1. 如果 `hasMore` 为 `true`，继续滚动到底部
2. 观察是否继续加载第 3 页、第 4 页...
3. **预期结果**：
   - ✅ 每次滚动到底部都触发加载
   - ✅ `currentPage` 持续递增
   - ✅ 列表持续追加数据

### 步骤 5: 验证加载完成
1. 当所有数据加载完成后，`hasMore` 应为 `false`
2. 再次滚动到底部时，不应触发新的加载请求
3. 控制台应显示：
   ```
   [mistake-book] 📄 触发分页加载 - currentPage: X, isLoading: false, hasMore: false
   [mistake-book] ⏸️ 分页加载被阻止 - isLoading: false, hasMore: false
   ```

## ✅ 验证点清单

### 技术验证点
- [ ] 滚动到底部时，`loadMore()` 方法被调用
- [ ] `currentPage` 正确递增（1 → 2 → 3 ...）
- [ ] `storageService.getMistakes(page, 20)` 被正确调用
- [ ] 返回的数据格式正确：`{ list, total, page, limit, hasMore, source }`
- [ ] 数据追加逻辑正确：`[...this.mistakes, ...result.list]`
- [ ] `hasMore` 状态正确更新
- [ ] `isLoading` 状态正确切换（true → false）
- [ ] 当 `hasMore = false` 时，不再触发加载

### UI 验证点
- [ ] 第一页显示 20 条错题（如果总数 >= 20）
- [ ] 滚动到底部后，列表自动追加新数据
- [ ] 列表总数正确显示（例如：如果有 35 条错题，最终应显示 35 条）
- [ ] 加载过程中，UI 正常响应（不卡顿）
- [ ] 加载完成后，滚动流畅

### 边界情况验证
- [ ] 如果错题总数 < 20，只显示实际数量，不触发分页
- [ ] 如果错题总数 = 20，`hasMore` 应为 `false`，不触发分页
- [ ] 如果错题总数 = 21，第一页显示 20 条，第二页显示 1 条
- [ ] 快速连续滚动时，不会重复触发加载（`isLoading` 保护）

## 🐛 已知问题排查

### 问题 1: 滚动到底部未触发加载
**可能原因**：
- `scroll-view` 的 `@scrolltolower` 事件未正确绑定
- 列表高度不足，未触发滚动事件

**解决方法**：
- 检查 `scroll-view` 的 `scroll-y` 属性
- 确保列表内容高度超过容器高度

### 问题 2: 分页加载被阻止
**可能原因**：
- `isLoading` 仍为 `true`（上次加载未完成）
- `hasMore` 为 `false`（已加载完所有数据）

**解决方法**：
- 检查控制台日志，确认 `isLoading` 和 `hasMore` 的值
- 如果 `isLoading` 一直为 `true`，可能是异步操作未正确完成

### 问题 3: 数据未正确追加
**可能原因**：
- `reset` 参数错误（应为 `false`）
- 数据合并逻辑错误

**解决方法**：
- 检查 `loadData(false)` 调用
- 验证 `[...this.mistakes, ...result.list]` 逻辑

## 📝 测试结果记录

### 测试环境
- **测试日期**：_____________
- **测试人员**：_____________
- **微信开发者工具版本**：_____________
- **错题总数**：_____________
- **第一页显示数量**：_____________
- **分页数量**：_____________

### 测试结果
- [ ] ✅ 通过 - 所有验证点均通过
- [ ] ⚠️ 部分通过 - 部分验证点未通过（请说明）
- [ ] ❌ 失败 - 核心功能未通过（请说明）

### 问题记录
（如有问题，请详细记录）

---

**提示**：测试时请保持控制台打开，观察所有日志输出，这将帮助快速定位问题。
