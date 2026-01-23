# TEST-9.3: 分数上传与更新验证报告

## 📋 测试目标
验证排行榜模块的分数上传与更新功能，确保当用户得分时，云端和本地都能同步更新。

## ✅ 完成的改进

### 1. 修复 uploadScoreToRank 方法 ✅

**问题**：
- 原方法使用 `userInfo.uid`，但实际应该使用 `EXAM_USER_ID`（与登录系统一致）

**修复**：
- 优先使用 `EXAM_USER_ID`
- 添加了详细的日志输出，使用 `[TEST-9.3]` 标记
- 改进了错误处理

**代码位置**：`src/pages/practice/pk-battle.vue` 第 577-601 行

```javascript
uploadScoreToRank() {
  // 优先使用 EXAM_USER_ID（与登录系统一致）
  const userId = uni.getStorageSync('EXAM_USER_ID') || '';
  const userInfo = uni.getStorageSync('userInfo') || {};
  
  // ... 上传逻辑
}
```

---

### 2. 增强日志输出 ✅

**改进**：
- 添加 `[TEST-9.3]` 标记，便于调试
- 记录完整的请求/响应流程
- 记录分数更新前后的对比

**日志示例**：
```
[TEST-9.3] 🏆 开始上传分数到排行榜
[TEST-9.3] 📤 发送分数更新请求: { url, action, userId, score, nickName }
[TEST-9.3] ✅ 分数上传成功: { code, message, newRecord, oldScore, newScore }
```

---

### 3. 添加页面刷新功能 ✅

**改进**：
- 在 `onShow()` 生命周期中自动刷新数据（从其他页面返回时）
- 添加了延迟机制，避免频繁刷新

**代码位置**：`src/pages/practice/rank.vue` 第 201-207 行

---

### 4. 创建测试方法 ✅

**新增方法**：`testUpdateScore(scoreIncrement = 10)`

**功能**：
- 模拟分数更新
- 自动计算新分数（当前分数 + 增量）
- 上传到云端
- 刷新排行榜数据
- 显示更新结果

**代码位置**：`src/pages/practice/rank.vue` 第 560-600 行

---

### 5. 改进 UI 显示 ✅

**改进**：
- 在底部固定栏显示当前分数
- 添加了分数显示文本：`分数: {{ myScore }}`

---

## 🧪 测试方法

### 方法 1：使用测试方法（推荐）

在排行榜页面的控制台中执行：

```javascript
// 获取页面实例
const pages = getCurrentPages();
const currentPage = pages[pages.length - 1];
const pageInstance = currentPage.$vm;

// 调用测试方法（增加 10 分）
pageInstance.testUpdateScore(10);
```

### 方法 2：直接调用 API

在控制台中执行：

```javascript
// 获取用户信息
const userId = uni.getStorageSync('EXAM_USER_ID');
const userInfo = uni.getStorageSync('userInfo') || {};

// 导入 lafService
import { lafService } from '../../services/lafService.js';

// 更新分数（当前分数 + 10）
const currentScore = 20; // 从页面获取或手动设置
const newScore = currentScore + 10;

await lafService.rankCenter({
  action: 'update_score',
  uid: userId,
  nickName: userInfo.nickName || '测试用户',
  avatarUrl: userInfo.avatarUrl || 'https://api.dicebear.com/7.x/avataaars/svg?seed=Guest',
  score: newScore
});
```

### 方法 3：通过 PK 对战

1. 进入 PK 对战页面
2. 完成一局对战
3. 查看控制台日志，确认分数已上传
4. 返回排行榜页面，查看分数是否更新

---

## 📊 验证检查清单

### API 调用验证
- [ ] 控制台显示 `[TEST-9.3] 🏆 开始上传分数到排行榜`
- [ ] 控制台显示 `[TEST-9.3] 📤 发送分数更新请求`
- [ ] API 响应成功：`code: 0`
- [ ] 控制台显示 `[TEST-9.3] ✅ 分数上传成功`

### 数据同步验证
- [ ] 刷新排行榜页面
- [ ] 控制台显示 `[TEST-9.1] 📥 API 响应`（包含更新后的数据）
- [ ] 排行榜中的分数已更新
- [ ] 底部固定栏显示的分数已更新

### UI 显示验证
- [ ] 底部固定栏显示新的分数
- [ ] 如果排名发生变化，排名显示已更新
- [ ] 排名差距提示已更新

---

## 🔧 技术细节

### 分数更新逻辑

根据后端云函数实现（`docs/backup/uniCloud-aliyun.backup/cloudfunctions/rank-center/index.js`）：

1. **查询用户记录**：使用 `uid` 查询数据库中是否已存在
2. **更新策略**：
   - 如果用户已存在：只有当新分数 > 旧分数时才更新
   - 如果用户不存在：直接插入新记录
3. **返回结果**：
   - `code: 0`：成功
   - `msg: '分数已刷新'` 或 `'新纪录上榜'`
   - `newRecord: true/false`：是否创建了新记录

### 分数计算逻辑

当前分数计算方式（`calculateMyScore()`）：
```javascript
得分 = 刷题数 * 10 + 坚持天数 * 20 + 正确率 * 100
```

---

## ⚠️ 注意事项

1. **分数更新策略**：
   - 后端只会在新分数 > 旧分数时更新
   - 如果新分数 <= 旧分数，会返回 `'未破纪录'`，但不会更新

2. **用户 ID 一致性**：
   - 必须使用 `EXAM_USER_ID`（与登录系统一致）
   - 如果使用不同的 ID，会创建新用户记录

3. **数据同步**：
   - 分数更新后，需要刷新排行榜页面才能看到最新数据
   - 可以通过 `onShow()` 生命周期自动刷新

---

## 📝 修改文件清单

1. **`src/pages/practice/pk-battle.vue`**
   - 修复 `uploadScoreToRank()` 方法
   - 增强日志输出

2. **`src/pages/practice/rank.vue`**
   - 添加 `onShow()` 生命周期刷新
   - 添加 `testUpdateScore()` 测试方法
   - 改进 UI 显示（显示分数）

---

## ✅ 测试结论

**TEST-9.3 准备完成！**

所有代码改进已完成，现在可以开始测试：

1. **使用测试方法**：在控制台调用 `testUpdateScore(10)`
2. **验证日志**：查看控制台中的 `[TEST-9.3]` 标记日志
3. **验证 UI**：检查排行榜页面中的分数是否更新

---

*报告生成时间：2024年*
*测试工程师：AI Assistant*
