# TEST-3.7 清空错题数据方法

## 问题
在浏览器控制台执行 `uni.removeStorageSync('mistake_book')` 时，出现错误：
```
Uncaught ReferenceError: uni is not defined
```

## 解决方案

### 方法 1: 使用微信开发者工具的控制台（推荐）

在**微信开发者工具的控制台**中执行（不是浏览器控制台）：

```javascript
// 清空本地错题数据
uni.removeStorageSync('mistake_book')
console.log('✅ 本地错题数据已清空')

// 验证是否清空成功
const mistakes = uni.getStorageSync('mistake_book')
console.log('当前错题数量:', mistakes ? mistakes.length : 0)
```

### 方法 2: 使用 Storage 面板（最简单）

1. 打开微信开发者工具
2. 点击左侧 **"Storage"** 标签
3. 找到 `mistake_book` 键
4. 右键点击 → **"Delete"** 或直接删除
5. 刷新页面

### 方法 3: 在代码中添加临时清空方法

如果上述方法都不行，可以在错题本页面的 `onLoad` 中临时添加：

```javascript
onLoad() {
  // 临时清空数据（测试用，完成后删除）
  // uni.removeStorageSync('mistake_book')
  
  // 正常初始化代码...
}
```

### 方法 4: 使用 storageService（如果可用）

```javascript
// 在控制台中（如果 storageService 已全局暴露）
storageService.remove('mistake_book')
```

## 验证清空是否成功

执行清空后，在控制台验证：

```javascript
const mistakes = uni.getStorageSync('mistake_book')
if (!mistakes || mistakes.length === 0) {
  console.log('✅ 错题数据已清空')
} else {
  console.log('⚠️ 仍有错题:', mistakes.length)
}
```

## 注意事项

1. **确保在微信开发者工具的控制台中执行**，不是浏览器控制台
2. 清空后需要**刷新页面**或**重新编译**
3. 清空操作**不可逆**，建议在测试环境执行
4. 如果清空后仍有数据，可能是云端数据自动同步回来了
