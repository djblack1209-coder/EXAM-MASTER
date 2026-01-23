# 战区A：核心刷题链路验证计划

## 📋 测试概览

**测试目标**：验证 Exam-Master 核心价值闭环 - 刷题→错题→复习
**测试环境**：Mock 数据 + Laf 混合模式
**测试优先级**：⭐⭐⭐⭐⭐（最高优先级）
**预计耗时**：45-60分钟

---

## 🎯 测试范围

### 涉及模块
- `src/pages/practice/do-quiz.vue` - 刷题引擎
- `src/pages/mistake/index.vue` - 错题本
- `src/services/storageService.js` - 数据服务层
- `src/services/zhipuService.js` - AI解析服务

### 核心功能点
1. ✅ 题库数据加载与渲染
2. ✅ 答题交互与判分逻辑
3. ✅ 错题自动保存机制
4. ✅ 错题本数据回显
5. ✅ AI深度解析（可选）
6. ✅ 云端+本地混合存储

---

## 📝 测试用例清单

### 测试阶段1：题库准备（5分钟）

#### TEST-A1.1 检查题库数据结构
**前置条件**：
- 已安装依赖并启动项目
- 微信开发者工具已打开

**执行步骤**：
```bash
# 1. 打开微信开发者工具控制台
# 2. 执行以下代码检查题库
uni.getStorageSync('v30_bank')
```

**预期结果**：
- 返回数组，包含至少5道题目
- 每道题包含字段：`question`, `options`, `answer`, `desc`, `category`, `type`

**如果题库为空**：
```javascript
// 在控制台执行以下代码注入Mock数据
const mockQuestions = [
  {
    id: 'q1',
    question: '马克思主义哲学的直接理论来源是（）',
    options: ['A. 古希腊罗马哲学', 'B. 17世纪英国哲学', 'C. 18世纪法国哲学', 'D. 德国古典哲学'],
    answer: 'D',
    desc: '马克思主义哲学的直接理论来源是德国古典哲学，特别是黑格尔的辩证法和费尔巴哈的唯物主义。',
    category: '马原',
    type: '单选题'
  },
  {
    id: 'q2',
    question: '实践的基本特征包括（）',
    options: ['A. 客观物质性', 'B. 自觉能动性', 'C. 社会历史性', 'D. 以上都是'],
    answer: 'D',
    desc: '实践具有客观物质性、自觉能动性和社会历史性三个基本特征。',
    category: '马原',
    type: '单选题'
  },
  {
    id: 'q3',
    question: '毛泽东思想形成的时代背景是（）',
    options: ['A. 帝国主义战争与无产阶级革命', 'B. 和平与发展', 'C. 经济全球化', 'D. 信息革命'],
    answer: 'A',
    desc: '毛泽东思想形成于帝国主义战争与无产阶级革命的时代，这是其重要的时代背景。',
    category: '毛中特',
    type: '单选题'
  },
  {
    id: 'q4',
    question: '社会主义核心价值观的基本内容包括（）',
    options: ['A. 富强、民主、文明、和谐', 'B. 自由、平等、公正、法治', 'C. 爱国、敬业、诚信、友善', 'D. 以上都是'],
    answer: 'D',
    desc: '社会主义核心价值观包括国家层面（富强、民主、文明、和谐）、社会层面（自由、平等、公正、法治）和个人层面（爱国、敬业、诚信、友善）。',
    category: '思修',
    type: '单选题'
  },
  {
    id: 'q5',
    question: '中国共产党成立的时间是（）',
    options: ['A. 1919年', 'B. 1921年', 'C. 1927年', 'D. 1949年'],
    answer: 'B',
    desc: '中国共产党成立于1921年7月23日，标志着中国革命进入新的历史阶段。',
    category: '史纲',
    type: '单选题'
  }
];

uni.setStorageSync('v30_bank', mockQuestions);
console.log('✅ Mock题库已注入，共', mockQuestions.length, '道题');
```

---

### 测试阶段2：刷题流程验证（15分钟）

#### TEST-A2.1 进入刷题页面
**执行步骤**：
1. 点击底部 TabBar "练习" 图标
2. 进入 `practice/index.vue` 页面
3. 点击"开始刷题"或类似入口按钮
4. 跳转到 `practice/do-quiz.vue`

**预期结果**：
- ✅ 页面正常加载，无白屏
- ✅ 显示题目内容（第1题）
- ✅ 显示进度条：`1 / 5`
- ✅ 显示计时器：`00:00`
- ✅ 显示4个选项（A/B/C/D）

**截图位置**：`docs/qa/screenshots/TEST-A2.1_刷题页面加载.png`

---

#### TEST-A2.2 题目渲染验证
**执行步骤**：
1. 检查题目文本是否完整显示
2. 检查选项格式是否正确（A. xxx / B. xxx）
3. 检查题目类型标签（单选题/多选题）

**预期结果**：
- ✅ 题目文本清晰可读，无乱码
- ✅ 选项格式统一，对齐美观
- ✅ 题目类型标签正确显示

**关键代码位置**：
```vue
<!-- do-quiz.vue 第52-60行 -->
<view class="glass-card question-card" v-if="currentQuestion">
  <view class="q-tag">{{ currentQuestion.type || '单选题' }}</view>
  <text class="q-content">{{ currentQuestion.question }}</text>
</view>
```

---

#### TEST-A2.3 答题交互验证
**执行步骤**：
1. 点击选项A（故意选错）
2. 观察选项状态变化
3. 等待AI解析动画
4. 查看结果弹窗

**预期结果**：
- ✅ 点击后选项高亮（绿色边框）
- ✅ 出现扫描线动画："AI 正在深度解析逻辑..."
- ✅ 弹出结果弹窗（红色背景，显示"LOGIC ERROR"）
- ✅ 显示正确答案和AI解析
- ✅ 有震动反馈（手机端）

**关键判分逻辑**：
```javascript
// do-quiz.vue 第265-280行
const isCorrect = this.isCorrectOption(idx);
this.resultStatus = isCorrect ? 'correct' : 'wrong';

if (isCorrect) {
  // 答对：显示鼓励语，不保存错题
  this.aiComment = "精彩！你的知识储备非常扎实...";
} else {
  // 答错：保存错题 + AI解析
  this.saveToMistakes();
  await this.fetchAIDeepAnalysis(...);
}
```

**截图位置**：
- `docs/qa/screenshots/TEST-A2.3_答错结果弹窗.png`
- `docs/qa/screenshots/TEST-A2.3_AI解析动画.png`

---

#### TEST-A2.4 答对题目验证
**执行步骤**：
1. 点击"继续挑战"进入下一题
2. 这次选择正确答案（根据题库数据）
3. 观察结果弹窗

**预期结果**：
- ✅ 弹窗背景为绿色
- ✅ 显示"PASS"标题
- ✅ 显示鼓励语："精彩！你的知识储备非常扎实..."
- ✅ **重要**：不保存到错题本（答对的题不应该进入错题本）

**验证方法**：
```javascript
// 在控制台执行
const mistakes = uni.getStorageSync('mistake_book') || [];
console.log('当前错题数量:', mistakes.length);
// 应该只有1条（之前答错的那道题）
```

---

#### TEST-A2.5 连续刷题流程
**执行步骤**：
1. 连续答完5道题（故意答错2-3道）
2. 观察进度条变化：`1/5 → 2/5 → ... → 5/5`
3. 完成后查看完成提示

**预期结果**：
- ✅ 进度条实时更新
- ✅ 计时器持续计时
- ✅ 完成后弹窗："🎉 练习完成，本次共完成 5 道题目！"
- ✅ 点击"返回"回到练习首页

---

### 测试阶段3：错题保存机制验证（10分钟）

#### TEST-A3.1 检查错题本数据结构
**执行步骤**：
```javascript
// 在微信开发者工具控制台执行
const mistakes = uni.getStorageSync('mistake_book') || [];
console.log('错题数量:', mistakes.length);
console.log('第一条错题:', mistakes[0]);
```

**预期结果**：
```javascript
{
  id: "local_1737605123456_abc123", // 或云端ID
  question: "马克思主义哲学的直接理论来源是（）",
  question_content: "马克思主义哲学的直接理论来源是（）",
  options: ["A. 古希腊罗马哲学", ...],
  user_answer: "A",
  userChoice: "A",
  correct_answer: "D",
  answer: "D",
  analysis: "AI解析内容...",
  desc: "AI解析内容...",
  category: "马原",
  wrong_count: 1,
  wrongCount: 1,
  is_mastered: false,
  isMastered: false,
  sync_status: "pending", // 或 "synced"（如果云端保存成功）
  created_at: 1737605123456,
  timestamp: 1737605123456
}
```

**关键字段验证**：
- ✅ `question` 或 `question_content` 存在
- ✅ `user_answer` 记录了错误答案
- ✅ `correct_answer` 记录了正确答案
- ✅ `analysis` 包含AI解析（如果AI服务可用）
- ✅ `wrong_count` 初始值为1
- ✅ `is_mastered` 初始值为false

---

#### TEST-A3.2 验证云端同步状态
**执行步骤**：
```javascript
// 检查同步状态
const mistakes = uni.getStorageSync('mistake_book') || [];
mistakes.forEach((m, i) => {
  console.log(`错题${i+1}:`, {
    id: m.id,
    sync_status: m.sync_status,
    question: m.question?.substring(0, 20) + '...'
  });
});
```

**预期结果**：
- 如果用户已登录且网络正常：`sync_status: "synced"`, `id` 为云端ID
- 如果用户未登录或网络异常：`sync_status: "pending"`, `id` 以 `local_` 开头

**关键代码位置**：
```javascript
// storageService.js 第200-250行
async addMistake(data) {
  const userId = uni.getStorageSync('EXAM_USER_ID');
  if (!userId) {
    return this._saveMistakeLocal(data, 'local_only');
  }
  
  try {
    const res = await lafService.request('/mistake-manager', {...});
    if (isSuccess) {
      // 云端保存成功，sync_status: 'synced'
    }
  } catch (error) {
    // 降级到本地，sync_status: 'pending'
  }
}
```

---

### 测试阶段4：错题本回显验证（15分钟）

#### TEST-A4.1 进入错题本页面
**执行步骤**：
1. 从练习页面返回首页
2. 点击"错题本"入口（可能在首页或练习页）
3. 进入 `mistake/index.vue`

**预期结果**：
- ✅ 页面正常加载
- ✅ 显示错题列表（至少2-3条）
- ✅ 每条错题显示：题目、选项、分类标签、时间
- ✅ 显示模式切换按钮："刷题模式" / "背诵模式"

**截图位置**：`docs/qa/screenshots/TEST-A4.1_错题本列表.png`

---

#### TEST-A4.2 刷题模式验证
**执行步骤**：
1. 确保当前为"刷题模式"（默认）
2. 点击第一条错题的"查看解析"按钮
3. 观察解析展开效果

**预期结果**：
- ✅ 解析区域展开，显示：
  - 正确答案（绿色高亮）
  - AI解析内容
  - 左侧绿色竖线装饰
- ✅ 按钮文字变为"隐藏解析"
- ✅ 再次点击可收起

**关键代码位置**：
```vue
<!-- mistake/index.vue 第90-98行 -->
<view class="analysis-box" v-if="mode === 'recite' || item.showAnalysis">
  <view class="correct-ans">正确答案：{{ item.answer || item.correct_answer }}</view>
  <view class="analysis-content">
    <text class="label">AI 解析：</text>
    {{ item.desc || item.analysis || '暂无解析' }}
  </view>
</view>
```

---

#### TEST-A4.3 背诵模式验证
**执行步骤**：
1. 点击"背诵模式"切换按钮
2. 观察错题列表变化

**预期结果**：
- ✅ 所有错题自动展开解析
- ✅ 正确答案标记为绿色
- ✅ 用户错误答案标记为红色
- ✅ 适合快速复习场景

**截图位置**：`docs/qa/screenshots/TEST-A4.3_背诵模式.png`

---

#### TEST-A4.4 错题重做功能
**执行步骤**：
1. 切换回"刷题模式"
2. 点击某条错题的"重做此题"按钮
3. 选择正确答案
4. 点击"提交答案"

**预期结果**：
- ✅ 进入练习状态，显示选项列表
- ✅ 选择答案后高亮显示
- ✅ 提交后显示结果："✓ 回答正确！你已经掌握了这道题。"
- ✅ 错题状态更新为"已掌握"（`is_mastered: true`）
- ✅ 云端状态同步（如果已登录）

**验证方法**：
```javascript
// 控制台检查
const mistakes = uni.getStorageSync('mistake_book') || [];
const masteredMistake = mistakes.find(m => m.is_mastered === true);
console.log('已掌握的错题:', masteredMistake);
```

**关键代码位置**：
```javascript
// mistake/index.vue 第450-490行
submitPractice(index) {
  const isCorrect = selectedOption === correctOptionIndex;
  if (isCorrect) {
    this.$set(mistake, 'is_mastered', true);
    storageService.updateMistakeStatus(mistakeId, true);
  }
}
```

---

#### TEST-A4.5 错题删除功能
**执行步骤**：
1. 点击某条错题的"移除"按钮
2. 确认删除弹窗
3. 观察列表变化

**预期结果**：
- ✅ 弹窗提示："掌握了吗？移除后无法恢复。"
- ✅ 确认后错题从列表消失
- ✅ 本地缓存同步删除
- ✅ 云端数据同步删除（如果已登录）

**验证方法**：
```javascript
// 删除前记录数量
const beforeCount = uni.getStorageSync('mistake_book').length;
// 删除后检查
const afterCount = uni.getStorageSync('mistake_book').length;
console.log('删除前:', beforeCount, '删除后:', afterCount);
// 应该减少1
```

---

### 测试阶段5：AI解析功能验证（10分钟，可选）

#### TEST-A5.1 检查AI服务配置
**前置条件**：需要配置智谱AI API Key

**执行步骤**：
```javascript
// 检查API Key配置
import { getApiKey } from '@/common/config.js';
console.log('API Key:', getApiKey() ? '已配置' : '未配置');
```

**预期结果**：
- 如果已配置：显示"已配置"
- 如果未配置：AI解析将使用降级文案

---

#### TEST-A5.2 AI解析请求验证
**执行步骤**：
1. 答错一道新题
2. 观察AI解析过程
3. 查看网络请求

**预期结果**：
- ✅ 显示加载动画："AI 正在深度解析逻辑..."
- ✅ 网络请求发送到：`https://open.bigmodel.cn/api/paas/v4/chat/completions`
- ✅ 请求参数包含：
  ```json
  {
    "model": "glm-4",
    "messages": [
      {"role": "system", "content": "你是一个睿智、专业的考研备考助手..."},
      {"role": "user", "content": "题目+选项+正确答案+学生选择..."}
    ]
  }
  ```
- ✅ 响应成功后显示AI解析内容
- ✅ 如果请求失败，显示降级文案："网络连接中断，AI 导师未能成功接入..."

**关键代码位置**：
```javascript
// do-quiz.vue 第290-350行
async fetchAIDeepAnalysis(question, userChoice) {
  const prompt = `你是一位专业的考研辅导专家...`;
  
  try {
    const res = await uni.request({
      url: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
      method: 'POST',
      header: {
        'Authorization': `Bearer ${getApiKey()}`,
        'Content-Type': 'application/json'
      },
      data: { model: "glm-4", messages: [...] }
    });
    
    if (res.statusCode === 200) {
      this.aiComment = res.data.choices[0].message.content;
    }
  } catch (e) {
    this.aiComment = "网络连接中断...";
  }
}
```

---

#### TEST-A5.3 AI解析降级验证
**执行步骤**：
1. 临时断开网络（飞行模式）
2. 答错一道题
3. 观察降级行为

**预期结果**：
- ✅ 显示降级文案："网络连接中断，AI 导师未能成功接入。建议重新审视题干与选项的对应关系，查看解析加深理解。"
- ✅ 错题仍然正常保存到错题本
- ✅ 使用题库中的 `desc` 字段作为解析内容

---

### 测试阶段6：边界情况验证（5分钟）

#### TEST-A6.1 空题库处理
**执行步骤**：
```javascript
// 清空题库
uni.removeStorageSync('v30_bank');
// 进入刷题页面
```

**预期结果**：
- ✅ 弹窗提示："题库空空如也，请先去资料库导入学习资料..."
- ✅ 点击"去导入"跳转到 `practice/import-data` 页面
- ✅ 点击取消返回上一页

---

#### TEST-A6.2 空错题本处理
**执行步骤**：
```javascript
// 清空错题本
uni.removeStorageSync('mistake_book');
// 进入错题本页面
```

**预期结果**：
- ✅ 显示空状态UI：
  - 🍃 图标
  - "暂无错题，继续保持！"
  - "去刷题" 按钮
- ✅ 点击"去刷题"跳转到练习页面

**截图位置**：`docs/qa/screenshots/TEST-A6.2_空错题本.png`

---

#### TEST-A6.3 重复错题处理
**执行步骤**：
1. 答错同一道题2次
2. 检查错题本

**预期结果**：
- ✅ 错题本中只有1条记录（不重复）
- ✅ `wrong_count` 字段增加：`1 → 2`
- ✅ 显示错误次数标签："⚠️ 错误 2 次"

**关键代码位置**：
```javascript
// do-quiz.vue 第370-400行
async saveToMistakes() {
  const existingMistake = localMistakes.find(m => 
    m.question === questionText || m.id === this.currentQuestion.id
  );
  
  const mistakeData = {
    ...
    wrong_count: existingMistake ? existingMistake.wrong_count + 1 : 1
  };
}
```

---

## 🎬 测试执行流程

### 准备阶段（5分钟）
```bash
# 1. 启动项目
npm run dev:mp-weixin

# 2. 打开微信开发者工具
# 3. 注入Mock题库（如果为空）
# 4. 清空错题本（重新开始测试）
uni.removeStorageSync('mistake_book');
```

### 执行阶段（40分钟）
按照上述测试用例顺序执行，每个阶段完成后：
1. ✅ 标记完成状态
2. 📸 截图关键界面
3. 📝 记录异常情况

### 总结阶段（5分钟）
1. 统计通过/失败用例数量
2. 整理Bug清单
3. 生成测试报告

---

## 📊 测试报告模板

### 测试结果汇总
| 测试阶段 | 用例数 | 通过 | 失败 | 通过率 |
|---------|--------|------|------|--------|
| 题库准备 | 1 | - | - | - |
| 刷题流程 | 5 | - | - | - |
| 错题保存 | 2 | - | - | - |
| 错题回显 | 5 | - | - | - |
| AI解析 | 3 | - | - | - |
| 边界情况 | 3 | - | - | - |
| **总计** | **19** | **-** | **-** | **-%** |

### 发现的问题
| 编号 | 严重程度 | 问题描述 | 复现步骤 | 状态 |
|------|---------|---------|---------|------|
| BUG-A1 | 🔴高 | ... | ... | 待修复 |
| BUG-A2 | 🟡中 | ... | ... | 待修复 |

### 测试结论
- [ ] ✅ 核心刷题链路功能完整，可以进入下一战区
- [ ] ⚠️ 存在阻塞性问题，需要修复后重测
- [ ] ❌ 核心功能不可用，需要紧急修复

---

## 🔧 常见问题排查

### Q1: 题目不显示或显示为空
**排查步骤**：
```javascript
// 1. 检查题库数据
const bank = uni.getStorageSync('v30_bank');
console.log('题库数量:', bank?.length);
console.log('第一题:', bank?.[0]);

// 2. 检查数据格式
if (bank && bank.length > 0) {
  const q = bank[0];
  console.log('字段检查:', {
    hasQuestion: !!q.question,
    hasOptions: Array.isArray(q.options),
    hasAnswer: !!q.answer
  });
}
```

### Q2: 错题保存失败
**排查步骤**：
```javascript
// 1. 检查用户登录状态
const userId = uni.getStorageSync('EXAM_USER_ID');
console.log('用户ID:', userId || '未登录');

// 2. 检查网络请求
// 在 Network 面板查看 /mistake-manager 请求
// 状态码应为 200，响应包含 {ok: true, id: "..."}

// 3. 检查本地存储
const mistakes = uni.getStorageSync('mistake_book');
console.log('本地错题数量:', mistakes?.length);
```

### Q3: AI解析不显示
**排查步骤**：
```javascript
// 1. 检查API Key
import { getApiKey } from '@/common/config.js';
console.log
