# Exam-Master V1.0 Bug修复清单

> **基于QA测试反馈的问题清单**

---

## 🔴 严重Bug（优先级：P0）

### Bug-1: 答对题目仍然保存到错题本
**描述**：TEST-2.2中，选择正确答案后，题目仍然被保存到错题本中。

**原因分析**：
- `isCorrectOption()` 判断逻辑可能有问题
- 或者 `saveToMistakes()` 被错误调用

**影响**：核心功能错误，导致错题本数据不准确。

---

### Bug-2: JSON解析错误
**描述**：AI诊断报告生成时，控制台报错：
```
SyntaxError: Unexpected token 关 in JSON at position 303
```

**位置**：`pages/mistake/index.vue` 第326行（`prepareReport`方法）

**原因分析**：
- AI返回的内容可能不是纯JSON
- `drawReport` 方法接收的是文本，不应该尝试JSON解析

---

## 🟡 UI显示问题（优先级：P1）

### Bug-3: 错题本字段映射错误
**问题列表**：
1. **题目不显示**：使用 `item.question`，但数据字段是 `question_content`
2. **正确答案显示"未知"**：使用 `item.answer`，但数据字段是 `correct_answer`
3. **时间显示"未知时间"**：使用 `item.addTime`（字符串），但数据可能是 `created_at`（时间戳）
4. **分类显示"未分类"**：`item.category` 可能为空或不存在

**位置**：`pages/mistake/index.vue` 模板部分

---

### Bug-4: 模式切换无响应
**描述**：点击"背诵模式"按钮，页面无变化。

**位置**：`pages/mistake/index.vue` 第19行

**可能原因**：
- Vue响应式问题
- 模式切换后UI没有正确更新

---

### Bug-5: AI诊断报告UI问题
**问题列表**：
1. **按钮文字被截断**：显示"AI正在诊"而不是"AI正在诊断"
2. **UI不符合统一设计**：Loading状态UI与整体设计不一致

**位置**：`pages/mistake/index.vue` 第117行

---

## 📝 修复计划

### 阶段1：核心Bug修复（立即）
- [ ] Bug-1: 修复答对题目保存逻辑
- [ ] Bug-2: 修复JSON解析错误

### 阶段2：字段映射修复（优先）
- [ ] Bug-3: 修复错题本字段映射

### 阶段3：UI优化（次要）
- [ ] Bug-4: 修复模式切换响应
- [ ] Bug-5: 修复AI诊断报告UI

---

## 🔍 代码位置

### Bug-1相关文件
- `pages/practice/do-quiz.vue`
  - 第279-315行：`selectOption()` 方法
  - 第139-152行：`isCorrectOption()` computed

### Bug-2相关文件
- `pages/mistake/index.vue`
  - 第317-394行：`prepareReport()` 方法
  - 第438行：`drawReport()` 方法

### Bug-3相关文件
- `pages/mistake/index.vue`
  - 第34行：题目显示
  - 第74、84行：正确答案显示
  - 第93行：时间显示
  - 第33行：分类显示

### Bug-4相关文件
- `pages/mistake/index.vue`
  - 第16-21行：模式切换按钮

### Bug-5相关文件
- `pages/mistake/index.vue`
  - 第117行：按钮文本
  - 第325行：Loading状态

---

**生成时间**：2026-01-21  
**状态**：待修复
