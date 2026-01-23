# TEST-9.3: 控制台测试代码

## 🚀 快速测试方法

### 方法 1：使用页面测试方法（最简单）✅

在排行榜页面的控制台中执行：

```javascript
// 获取当前页面实例
const pages = getCurrentPages();
const currentPage = pages[pages.length - 1];
const pageInstance = currentPage.$vm;

// 调用测试方法（增加 10 分）
pageInstance.testUpdateScore(10);
```

---

### 方法 2：直接调用 API（推荐）✅

在排行榜页面的控制台中执行：

```javascript
(async () => {
  // 获取用户信息
  const userId = uni.getStorageSync('EXAM_USER_ID');
  const userInfo = uni.getStorageSync('userInfo') || {};
  
  console.log('[TEST-9.3] 📊 当前用户信息:', { userId, nickName: userInfo.nickName });
  
  // 计算新分数（当前分数 20 + 10 = 30）
  const currentScore = 20; // 从页面获取或手动设置
  const newScore = currentScore + 10;
  
  console.log('[TEST-9.3] 📤 准备更新分数:', { currentScore, newScore });
  
  try {
    // 直接使用 uni.request 调用 API
    const res = await new Promise((resolve, reject) => {
      uni.request({
        url: 'https://nf98ia8qnt.sealosbja.site/rank-center',
        method: 'POST',
        data: {
          action: 'update_score',
          uid: userId,
          nickName: userInfo.nickName || '测试用户',
          avatarUrl: userInfo.avatarUrl || 'https://api.dicebear.com/7.x/avataaars/svg?seed=Guest',
          score: newScore
        },
        success: (res) => {
          if (res.statusCode === 200) {
            resolve(res.data);
          } else {
            reject(res.data || { message: `请求失败: ${res.statusCode}` });
          }
        },
        fail: (err) => {
          reject({ message: '网络请求失败', error: err });
        }
      });
    });
    
    console.log('[TEST-9.3] ✅ 分数更新成功:', res);
    
    // 刷新排行榜页面
    const pages = getCurrentPages();
    const currentPage = pages[pages.length - 1];
    if (currentPage && currentPage.$vm && currentPage.$vm.loadRankData) {
      await currentPage.$vm.loadRankData();
      console.log('[TEST-9.3] ✅ 排行榜已刷新');
    }
    
    uni.showToast({
      title: `分数已更新: ${currentScore} → ${newScore}`,
      icon: 'success',
      duration: 2000
    });
  } catch (error) {
    console.error('[TEST-9.3] ❌ 分数更新失败:', error);
    uni.showToast({
      title: '分数更新失败',
      icon: 'none'
    });
  }
})();
```

---

### 方法 3：使用页面实例直接调用（最简单）✅✅✅

**推荐使用这个方法！**

在排行榜页面的控制台中执行：

```javascript
// 获取页面实例
const pages = getCurrentPages();
const currentPage = pages[pages.length - 1];
const pageInstance = currentPage.$vm;

// 调用测试方法（增加 10 分）
pageInstance.testUpdateScore(10);
```

---

## 📋 验证步骤

1. **打开排行榜页面**
2. **打开控制台**（开发者工具）
3. **复制上面的代码**（推荐使用方法 3）
4. **粘贴到控制台并执行**
5. **查看日志输出**：
   - 应看到 `[TEST-9.3] 🏆 开始上传分数到排行榜`
   - 应看到 `[TEST-9.3] 📤 发送分数更新请求`
   - 应看到 `[TEST-9.3] ✅ 分数上传成功`
6. **查看页面**：
   - 底部固定栏的分数应更新
   - 如果排名变化，排名也应更新

---

## 🔍 预期结果

### 控制台日志示例：

```
[TEST-9.3] 🏆 开始上传分数到排行榜
[TEST-9.3] 📤 发送分数更新请求: {
  url: "/rank-center",
  action: "update_score",
  userId: "69714ab1e7cc2607c934fc6a",
  score: 30,
  nickName: "CARVEN"
}
[TEST-9.3] ✅ 分数上传成功: {
  code: 0,
  message: "分数已刷新",
  newRecord: true,
  oldScore: 20,
  newScore: 30
}
[TEST-9.1] 🏆 开始获取排行榜数据
[TEST-9.1] 📥 API 响应: {
  code: 0,
  hasData: true,
  dataType: "array",
  dataLength: 1
}
[TEST-9.1] ✅ 排行榜数据加载成功: {
  totalCount: 1,
  top3Count: 1,
  myRank: 1,
  myScore: 30
}
```

### UI 变化：

- 底部固定栏：分数从 `20` 更新为 `30`
- 排名提示：如果排名变化，会显示新的排名

---

## ⚠️ 注意事项

1. **必须在排行榜页面执行**：代码需要访问页面实例
2. **确保已登录**：需要 `EXAM_USER_ID`
3. **分数更新策略**：后端只会在新分数 > 旧分数时更新

---

## 🐛 如果遇到问题

### 问题 1：`Cannot read property '$vm' of undefined`

**解决**：确保在排行榜页面执行代码

### 问题 2：`用户未登录`

**解决**：检查 `EXAM_USER_ID` 是否存在：
```javascript
console.log('用户ID:', uni.getStorageSync('EXAM_USER_ID'));
```

### 问题 3：分数没有更新

**解决**：
1. 检查控制台日志，确认 API 调用成功
2. 确认新分数 > 旧分数（后端策略）
3. 手动刷新排行榜页面

---

*测试代码生成时间：2024年*
