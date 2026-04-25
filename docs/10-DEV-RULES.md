# 开发规范与标准操作流程

> 合并自原 docs/sop/ 目录下 8 个文件

---

# 功能验收清单

> **用途**：AI 每次修改代码后，必须逐项检查本清单中与修改范围相关的条目，确保没有功能被意外破坏。
> **更新日期**：2026-03-30
> **维护者**：QA 负责人（AI 自动执行）

---

## 使用规则

1. **不需要每次跑全部条目**，只需跑「与本次修改有关的功能区」
2. 每个条目的验证方式已标注（Playwright 截图 / npm test / 手动打开页面 / curl 命令）
3. ❌ 表示检查未通过 → **必须修复后才能说"完成了"**
4. ✅ 表示检查通过
5. 拿不准影响范围时，至少跑「快速回归」章节的 10 个必检项
6. 修改了后端云函数 → 额外跑「后端健康」检查
7. 修改了公共组件/Store/Service → 影响面大，跑相关的所有功能区

---

## 一、核心页面可访问性（每次必检）

> 4 个 Tab 页 + 登录页 + 开屏页能正常打开，不白屏、不报错

- [ ] **CHK-001**: 打开 App 后，开屏页（Splash）正常显示品牌动画，几秒后自动跳转到首页
  - 验证方式：Playwright 截图
  - 关联页面：`pages/splash/index`
  - 关联功能：基础框架

- [ ] **CHK-002**: 首页能正常打开，显示今日学习数据、快捷入口卡片，底部 Tab 栏可见且不遮挡内容
  - 验证方式：Playwright 截图
  - 关联页面：`pages/index/index`
  - 关联功能：基础框架

- [ ] **CHK-003**: 刷题页能正常打开，显示题库列表和各种刷题入口（智能复习、PK 对战、模拟考试等）
  - 验证方式：Playwright 截图
  - 关联页面：`pages/practice/index`
  - 关联功能：③ AI 诊断循环

- [ ] **CHK-004**: 择校页能正常打开，显示院校搜索和推荐列表
  - 验证方式：Playwright 截图
  - 关联页面：`pages/school/index`
  - 关联功能：基础框架

- [ ] **CHK-005**: 个人中心页能正常打开，显示用户头像/昵称、学习统计概览、功能入口列表
  - 验证方式：Playwright 截图
  - 关联页面：`pages/profile/index`
  - 关联功能：基础框架

- [ ] **CHK-006**: 底部 Tab 栏四个按钮（首页/刷题/择校/我的）都能点击切换，选中状态颜色高亮正确
  - 验证方式：Playwright 截图 + 逐个点击
  - 关联页面：所有 Tab 页
  - 关联功能：基础框架

---

## 二、用户认证流程

> 登录、注销、登录状态保持——这是一切功能的前提

- [ ] **CHK-007**: 未登录时，打开需要登录的页面会自动跳转到登录页，而不是白屏或报错
  - 验证方式：Playwright 截图（清除登录态后访问个人中心）
  - 关联页面：`pages/login/index`
  - 关联功能：用户认证

- [ ] **CHK-008**: 登录页能正常显示，微信登录/QQ 登录按钮可见
  - 验证方式：Playwright 截图
  - 关联页面：`pages/login/index`
  - 关联功能：用户认证

- [ ] **CHK-009**: 登录成功后能自动跳回之前的页面，用户信息（头像、昵称）显示正确
  - 验证方式：npm test（auth 相关测试用例）
  - 关联页面：`pages/login/index`、`pages/profile/index`
  - 关联功能：用户认证

- [ ] **CHK-010**: 退出登录后，再次打开 App 会回到登录页，不会看到上一个用户的数据
  - 验证方式：npm test + Playwright 截图
  - 关联页面：`pages/settings/index`（退出按钮）
  - 关联功能：用户认证

- [ ] **CHK-011**: 新手引导页在首次登录后正常展示，引导流程可正常走完
  - 验证方式：Playwright 截图
  - 关联页面：`pages/login/onboarding`
  - 关联功能：用户认证

---

## 三、刷题核心流程

> 选题 → 做题 → 提交 → 看结果 → FSRS 复习调度，这是产品最核心的链路

- [ ] **CHK-012**: 从刷题页选择一个题库后，能正常进入做题页面，题目内容（题干、选项）显示完整
  - 验证方式：Playwright 截图
  - 关联页面：`pages/practice-sub/do-quiz`
  - 关联功能：① FSRS-5 间隔重复引擎

- [ ] **CHK-013**: 做题时选择答案后，能正常判断对错，显示正确答案和解析
  - 验证方式：npm test（quiz 相关测试）+ Playwright 截图
  - 关联页面：`pages/practice-sub/do-quiz`
  - 关联功能：① FSRS-5 间隔重复引擎

- [ ] **CHK-014**: 做完一组题后，结果页正常显示：正确率、用时、经验值变化、FSRS 记忆统计
  - 验证方式：Playwright 截图
  - 关联页面：`pages/practice-sub/do-quiz`（结果弹窗）
  - 关联功能：① FSRS-5 / ⑦ 游戏化系统

- [ ] **CHK-015**: FSRS 复习调度正常工作——做完题后，系统根据对错自动安排下次复习时间
  - 验证方式：npm test（FSRS 相关测试用例）
  - 关联页面：`pages/practice-sub/smart-review`
  - 关联功能：① FSRS-5 间隔重复引擎 / ⑧ 智能复习

- [ ] **CHK-016**: 智能复习页能正常打开，显示今日到期需要复习的卡片数量，点击开始能进入复习
  - 验证方式：Playwright 截图
  - 关联页面：`pages/practice-sub/smart-review`
  - 关联功能：⑧ 智能复习

- [ ] **CHK-017**: 题库管理页能正常打开，能看到已有题库列表，支持搜索和筛选
  - 验证方式：Playwright 截图
  - 关联页面：`pages/practice-sub/question-bank`
  - 关联功能：③ AI 诊断循环

- [ ] **CHK-018**: 模拟考试页能正常打开，能设置考试时长和题目数量，开始考试后有倒计时
  - 验证方式：Playwright 截图
  - 关联页面：`pages/practice-sub/mock-exam`
  - 关联功能：③ AI 诊断循环

- [ ] **CHK-019**: 诊断报告页能正常打开，显示薄弱知识点分析和学习建议
  - 验证方式：Playwright 截图
  - 关联页面：`pages/practice-sub/diagnosis-report`
  - 关联功能：③ AI 诊断循环

- [ ] **CHK-020**: 错题聚类分析页能正常打开，按知识点对错题进行分组展示
  - 验证方式：Playwright 截图
  - 关联页面：`pages/practice-sub/error-clusters`
  - 关联功能：③ AI 诊断循环

- [ ] **CHK-021**: 冲刺模式页能正常打开，进入后能快速连续做题
  - 验证方式：Playwright 截图
  - 关联页面：`pages/practice-sub/sprint-mode`
  - 关联功能：③ AI 诊断循环

---

## 四、AI 功能

> AI 是产品的核心差异化能力，必须确保 AI 对话能正常收发消息

- [ ] **CHK-022**: AI 聊天页能正常打开，输入框可以打字，发送消息后 AI 能返回回复（不超时、不报错）
  - 验证方式：Playwright 截图 + 手动测试一次对话
  - 关联页面：`pages/chat/chat`
  - 关联功能：③ AI 诊断循环

- [ ] **CHK-023**: AI 回复中的 Markdown 格式（加粗、列表、代码块、公式）能正确渲染，不显示原始标记符号
  - 验证方式：Playwright 截图
  - 关联页面：`pages/chat/chat`（MarkdownRenderer 组件）
  - 关联功能：③ AI 诊断循环

- [ ] **CHK-024**: AI 课堂列表页能正常打开，显示可选的课程/知识点列表
  - 验证方式：Playwright 截图
  - 关联页面：`pages/ai-classroom/index`
  - 关联功能：④ 多 Agent 课堂

- [ ] **CHK-025**: 进入互动课堂后，老师/学生/考官三个 AI 角色能正常对话，消息区分显示
  - 验证方式：Playwright 截图 + 手动发送一条消息
  - 关联页面：`pages/ai-classroom/classroom`
  - 关联功能：④ 多 Agent 课堂

- [ ] **CHK-026**: AI 择校咨询页能正常打开，输入成绩和意向后 AI 能给出择校建议
  - 验证方式：Playwright 截图
  - 关联页面：`pages/school-sub/ai-consult`
  - 关联功能：③ AI 诊断循环

- [ ] **CHK-027**: AI 对话过程中的「思考中」动画能正常显示，AI 回复完毕后自动消失
  - 验证方式：Playwright 截图（发送消息后立即截图）
  - 关联页面：`pages/chat/chat`（ThinkingBlock 组件）
  - 关联功能：③ AI 诊断循环

---

## 五、社交与对战

> PK 对战、排行榜、好友系统——用户之间的互动功能

- [ ] **CHK-028**: PK 对战页能正常打开，显示匹配按钮和段位信息
  - 验证方式：Playwright 截图
  - 关联页面：`pages/practice-sub/pk-battle`
  - 关联功能：⑤ PK 对战 + ELO

- [ ] **CHK-029**: 点击匹配后，能正常进入等待状态，匹配成功后双方能看到同一道题
  - 验证方式：npm test（PK 相关测试）
  - 关联页面：`pages/practice-sub/pk-battle`
  - 关联功能：⑤ PK 对战 + ELO

- [ ] **CHK-030**: PK 结束后，显示胜负结果和 ELO 段位变化（赢了加分、输了扣分）
  - 验证方式：npm test（ELO 算法测试）
  - 关联页面：`pages/practice-sub/pk-battle`
  - 关联功能：⑤ PK 对战 + ELO

- [ ] **CHK-031**: 排行榜页能正常打开，按段位/经验值排序显示用户列表，自己的排名高亮
  - 验证方式：Playwright 截图
  - 关联页面：`pages/practice-sub/rank`
  - 关联功能：⑤ PK 对战 + ELO

- [ ] **CHK-032**: 好友列表页能正常打开，显示已添加的好友和好友请求
  - 验证方式：Playwright 截图
  - 关联页面：`pages/social/friend-list`
  - 关联功能：⑩ 社交功能

- [ ] **CHK-033**: 好友主页能正常打开，显示好友的学习数据和段位信息，支持发起 PK
  - 验证方式：Playwright 截图
  - 关联页面：`pages/social/friend-profile`
  - 关联功能：⑩ 社交功能

---

## 六、数据管理

> Anki 导入导出、错题本、收藏、学习计划——用户的数据不能丢

- [ ] **CHK-034**: Anki 导入页能正常打开，能选择 .apkg 文件并成功导入题目
  - 验证方式：npm test（Anki 解析测试）+ Playwright 截图
  - 关联页面：`pages/practice-sub/import-data`
  - 关联功能：⑥ Anki 导入/导出

- [ ] **CHK-035**: 导入的 Anki 题目能在题库中正常显示，格式（图片、公式、音频）不丢失
  - 验证方式：npm test + Playwright 截图
  - 关联页面：`pages/practice-sub/question-bank`
  - 关联功能：⑥ Anki 导入/导出

- [ ] **CHK-036**: 导出功能能正常生成 .apkg 文件，导出的文件能被 Anki 软件识别
  - 验证方式：npm test（导出相关测试）
  - 关联页面：`pages/practice-sub/import-data`
  - 关联功能：⑥ Anki 导入/导出

- [ ] **CHK-037**: 文件管理页能正常打开，显示用户已导入的文件列表，支持删除
  - 验证方式：Playwright 截图
  - 关联页面：`pages/practice-sub/file-manager`
  - 关联功能：⑥ Anki 导入/导出

- [ ] **CHK-038**: 错题本页能正常打开，显示做错的题目列表，支持按科目/知识点筛选
  - 验证方式：Playwright 截图
  - 关联页面：`pages/mistake/index`
  - 关联功能：③ AI 诊断循环

- [ ] **CHK-039**: 错题本中点击某道错题，能看到原题、自己的错误答案、正确答案和 AI 分析
  - 验证方式：Playwright 截图
  - 关联页面：`pages/mistake/index`
  - 关联功能：③ AI 诊断循环

- [ ] **CHK-040**: 收藏页能正常打开，显示用户收藏的题目，支持取消收藏
  - 验证方式：Playwright 截图
  - 关联页面：`pages/favorite/index`
  - 关联功能：数据管理

- [ ] **CHK-041**: 学习计划列表页能正常打开，显示已创建的计划和完成进度
  - 验证方式：Playwright 截图
  - 关联页面：`pages/plan/index`
  - 关联功能：③ AI 诊断循环

- [ ] **CHK-042**: 创建学习计划页能正常操作，填写目标后能成功创建计划
  - 验证方式：Playwright 截图
  - 关联页面：`pages/plan/create`
  - 关联功能：③ AI 诊断循环

- [ ] **CHK-043**: 自适应学习计划页能正常打开，根据用户表现动态调整计划内容
  - 验证方式：Playwright 截图
  - 关联页面：`pages/plan/adaptive`
  - 关联功能：② 知识图谱 x FSRS 融合

---

## 七、游戏化

> 经验值、连续签到、成就、每日挑战——让用户"上瘾"的功能

- [ ] **CHK-044**: 做完题后经验值(XP)正确增加，经验值弹窗动画正常显示
  - 验证方式：npm test（XP 计算测试）+ Playwright 截图
  - 关联页面：`pages/practice-sub/do-quiz`（xp-toast 组件）
  - 关联功能：⑦ 游戏化系统

- [ ] **CHK-045**: 连续签到功能正常——每天首次使用自动签到，连续天数正确累加，中断后重置
  - 验证方式：npm test（签到相关测试）
  - 关联页面：`pages/index/index`
  - 关联功能：⑦ 游戏化系统

- [ ] **CHK-046**: 成就系统正常——达成条件后弹出成就解锁提示，成就列表页能查看所有成就
  - 验证方式：npm test（成就触发测试）
  - 关联页面：`pages/profile/index`
  - 关联功能：⑦ 游戏化系统

- [ ] **CHK-047**: 每日挑战功能正常——每天刷新挑战任务，完成后有额外奖励
  - 验证方式：npm test + Playwright 截图
  - 关联页面：`pages/index/index`
  - 关联功能：⑦ 游戏化系统

---

## 八、工具类

> 拍照搜题、文档转换、证件照换底色、专注计时——实用工具

- [ ] **CHK-048**: 拍照搜题页能正常打开，能拍照或从相册选图，OCR 识别后显示搜索结果
  - 验证方式：Playwright 截图
  - 关联页面：`pages/tools/photo-search`
  - 关联功能：⑨ 工具套件

- [ ] **CHK-049**: 文档转换页能正常打开，能上传文件并选择目标格式进行转换
  - 验证方式：Playwright 截图
  - 关联页面：`pages/tools/doc-convert`
  - 关联功能：⑨ 工具套件

- [ ] **CHK-050**: 证件照换底色页能正常打开，上传证件照后能切换背景颜色（红/蓝/白）
  - 验证方式：Playwright 截图
  - 关联页面：`pages/tools/id-photo`
  - 关联功能：⑨ 工具套件

- [ ] **CHK-051**: 专注计时页能正常打开，计时器能启动/暂停/重置，计时结束后有提醒
  - 验证方式：Playwright 截图
  - 关联页面：`pages/tools/focus-timer`
  - 关联功能：⑨ 工具套件

---

## 九、设置与个人中心

> 设置页、隐私政策、主题切换——影响全局体验

- [ ] **CHK-052**: 设置页能正常打开，各个设置项（主题、通知、缓存清理等）都可点击
  - 验证方式：Playwright 截图
  - 关联页面：`pages/settings/index`
  - 关联功能：基础框架

- [ ] **CHK-053**: 主题切换功能正常——切换深色/浅色模式后，所有页面颜色同步变化，文字可读
  - 验证方式：Playwright 截图（切换前后对比）
  - 关联页面：`pages/settings/index`（ThemeSelectorModal 组件）
  - 关联功能：基础框架

- [ ] **CHK-054**: 隐私政策页和用户协议页能正常打开，内容完整可滚动
  - 验证方式：Playwright 截图
  - 关联页面：`pages/settings/privacy`、`pages/settings/terms`
  - 关联功能：合规要求

- [ ] **CHK-055**: 学习统计详情页能正常打开，各类图表（趋势图、雷达图）正确渲染不空白
  - 验证方式：Playwright 截图
  - 关联页面：`pages/study-detail/index`
  - 关联功能：③ AI 诊断循环

- [ ] **CHK-056**: 知识图谱页能正常打开，力导向图正确渲染，节点可以点击查看详情
  - 验证方式：Playwright 截图
  - 关联页面：`pages/knowledge-graph/index`
  - 关联功能：② 知识图谱 x FSRS 融合

- [ ] **CHK-057**: 掌握度总览页能正常打开，显示各知识点的掌握程度进度条
  - 验证方式：Playwright 截图
  - 关联页面：`pages/knowledge-graph/mastery`
  - 关联功能：② 知识图谱 x FSRS 融合

- [ ] **CHK-058**: AI 家教列表能正常显示，可以选择不同的 AI 家教角色
  - 验证方式：Playwright 截图
  - 关联页面：`pages/settings/index`（AITutorList 组件）
  - 关联功能：④ 多 Agent 课堂

---

## 十、跨平台兼容

> H5、微信小程序、Electron 桌面版——同一套代码在不同平台的表现

- [ ] **CHK-059**: H5 版本能正常构建（`npm run build:h5`），不报错
  - 验证方式：`npm run build:h5`
  - 关联页面：全部
  - 关联功能：跨平台

- [ ] **CHK-060**: 微信小程序版本能正常构建（`npm run build:mp-weixin`），主包不超过 2MB
  - 验证方式：`npm run build:mp-weixin` + 检查包体积
  - 关联页面：全部
  - 关联功能：跨平台

- [ ] **CHK-061**: Electron 桌面版能正常启动（`npm run electron:dev`），窗口不白屏
  - 验证方式：`npm run electron:dev`
  - 关联页面：全部
  - 关联功能：跨平台

- [ ] **CHK-062**: 单元测试全部通过（`npm test`），不少于 1196 个用例
  - 验证方式：`npm test`
  - 关联页面：全部
  - 关联功能：质量保障

- [ ] **CHK-063**: 代码检查全部通过（`npm run lint`），0 错误 0 警告
  - 验证方式：`npm run lint`
  - 关联页面：全部
  - 关联功能：质量保障

---

## 十一、后端健康（修改云函数时必检）

- [ ] **CHK-064**: 后端 TypeScript 编译通过，不报类型错误
  - 验证方式：`cd laf-backend && npx tsc --project tsconfig.standalone.json`
  - 关联页面：无（后端）
  - 关联功能：全部后端接口

- [ ] **CHK-065**: 服务器健康检查接口返回正常
  - 验证方式：`curl -s https://api.245334.xyz/health-check`
  - 关联页面：无（后端）
  - 关联功能：全部后端接口

- [ ] **CHK-066**: PM2 进程状态正常（online），内存/CPU 无异常飙升
  - 验证方式：`ssh root@101.43.41.96 'pm2 list'`
  - 关联页面：无（服务器）
  - 关联功能：全部后端接口

---

## 快速回归（最关键的 10 条 — 修改任何代码后必检）

> 不管改了什么，至少跑完这 10 条。全部通过才能说「完成了」。

| 序号 | 编号    | 检查内容                      | 验证方式           |
| ---- | ------- | ----------------------------- | ------------------ |
| 1    | CHK-063 | 代码检查 0 错误 0 警告        | `npm run lint`     |
| 2    | CHK-062 | 单元测试全部通过 (≥1196 用例) | `npm test`         |
| 3    | CHK-059 | H5 构建成功不报错             | `npm run build:h5` |
| 4    | CHK-002 | 首页能正常打开不白屏          | Playwright 截图    |
| 5    | CHK-003 | 刷题页能正常打开              | Playwright 截图    |
| 6    | CHK-012 | 选题后能正常进入做题          | Playwright 截图    |
| 7    | CHK-013 | 做题后能正确判断对错          | npm test           |
| 8    | CHK-015 | FSRS 复习调度正常工作         | npm test           |
| 9    | CHK-022 | AI 聊天能正常收发消息         | Playwright 截图    |
| 10   | CHK-007 | 未登录时正确跳转登录页        | Playwright 截图    |

> **口诀**：先跑三板斧（lint / test / build），再看首页和刷题，最后确认 AI 和登录。
# AI 决策日志（黑匣子）

> **用途**：记录重大技术决策的原因和被否决方案，避免新AI会话重蹈覆辙
> **规则**：AI在做出下列类型决策时，必须在本文件追加一条记录
> **读取时机**：每个新AI会话开始任务前，必须先读本文件获取历史上下文

## 必须记录的决策类型

1. **架构选择** — 选了方案A不选方案B/C
2. **依赖选择** — 为什么用这个库不用那个库
3. **重构方案** — 为什么这样重构不那样重构
4. **Bug修复** — 根因分析和修复策略选择（尤其是修了2次以上的bug）
5. **性能权衡** — 为什么在性能和可读性之间这样取舍
6. **安全决策** — 为什么采取这种安全措施
7. **放弃决策** — 为什么决定不做某个功能/不修某个bug

## 记录格式

```
### DEC-XXX: [决策标题]
- **日期**：YYYY-MM-DD
- **决策者**：AI会话 / 用户指示
- **背景**：（用大白话说，为什么需要做这个决策）
- **选项分析**：
  - 方案A：[描述] — 优点/缺点
  - 方案B：[描述] — 优点/缺点
  - 方案C（如果有）：[描述] — 优点/缺点
- **最终选择**：方案X
- **选择理由**：（一句话总结为什么选这个）
- **注意事项**：（未来AI会话需要知道的陷阱或限制条件）
- **关联文件**：[受此决策影响的文件列表]
```

## 查询索引

| ID      | 日期       | 领域      | 标题                                                       | 关键词                          |
| ------- | ---------- | --------- | ---------------------------------------------------------- | ------------------------------- |
| DEC-001 | 2026-03-29 | 架构/重构 | lafService 彻底重构而非渐进包装                            | lafService, API分层, domain API |
| DEC-002 | 2026-03-29 | 架构/配置 | 游戏常量集中到 game-constants.js                           | 常量, 配置碎片化, XP, 成就      |
| DEC-003 | 2026-03-29 | 架构/重构 | offline-cache-service.js 重新实现而非删除                  | 离线缓存, 空文件, 运行时崩溃    |
| DEC-004 | 2026-03-29 | 性能      | H5 vendor 拆分用 manualChunks 而非 vite-plugin-compression | 首屏性能, bundle拆分, gzip      |
| DEC-005 | 2026-03-29 | 安全      | 全局路由守卫用 uni.addInterceptor 而非页面级 onLoad 检查   | 路由守卫, 鉴权, XSS             |
| DEC-006 | 2026-03-29 | 架构      | PK Battle API 重写为后端实际 action 而非修补前端调用       | PK对战, API断链, action名       |
| DEC-007 | 2026-03-29 | 放弃决策  | 放弃 vite-plugin-compression，Nginx 实时 gzip 够用         | gzip, 预压缩, D030              |

---

## 决策记录

（以下为历史决策，按时间倒序排列，新记录追加到最前面）

---

### DEC-005: 全局路由守卫用 uni.addInterceptor 而非页面级 onLoad 检查

- **日期**：2026-03-29
- **决策者**：AI会话（十四轮审计）
- **背景**：H5环境下用户可以直接在浏览器输入URL访问需要登录的页面（比如AI对话页），绕过登录白嫖Token。需要一个统一的登录拦截机制。
- **选项分析**：
  - 方案A：每个页面的 onLoad 里加登录检查 — 优点：简单直接 / 缺点：36个页面要改，漏一个就是安全漏洞，后续新增页面也容易忘
  - 方案B：App.vue 用 uni.addInterceptor 拦截 navigateTo/redirectTo — 优点：一处配置全局生效，维护白名单即可 / 缺点：需要维护白名单列表
- **最终选择**：方案B
- **选择理由**：一个地方管所有页面的权限，比在36个文件里各写一遍靠谱得多
- **注意事项**：白名单目前14个公开页面，新增公开页面（如活动页）必须加入白名单，否则未登录用户访问会被拦截
- **关联文件**：`src/App.vue`（initRouteGuard函数）

---

### DEC-004: H5 vendor 拆分用 manualChunks 而非 vite-plugin-compression

- **日期**：2026-03-29
- **决策者**：AI会话（十五轮审计）
- **背景**：H5首屏加载的JS文件有443KB（gzip后149KB），太大了。需要优化首屏加载速度。
- **选项分析**：
  - 方案A：安装 vite-plugin-compression 做构建时gzip预压缩 — 优点：文件更小 / 缺点：Nginx已经有实时gzip，效果有限；多一个依赖
  - 方案B：vite.config.js 配置 manualChunks 把 Vue/Pinia/uni-app 运行时拆成独立vendor包 — 优点：vendor包独立缓存，用户二次访问只需加载业务代码 / 缺点：首次加载请求数增加
- **最终选择**：方案B
- **选择理由**：入口JS从443KB降到135KB（减69.5%），vendor包可以长期缓存，对回访用户提升巨大
- **注意事项**：manualChunks 仅在H5平台生效（通过 `process.env.UNI_PLATFORM === 'h5'` 判断），微信小程序有自己的分包机制不能混用
- **关联文件**：`vite.config.js`（manualChunks配置）

---

### DEC-003: offline-cache-service.js 重新实现而非删除

- **日期**：2026-03-29
- **决策者**：AI会话（架构清爽化重构 Task 5）
- **背景**：`offline-cache-service.js` 是一个0字节的空文件，但有2个composable在import它。空文件 = 运行时崩溃。要么删掉（然后修改2个消费者），要么补上实现。
- **选项分析**：
  - 方案A：删除空文件 + 修改2个消费者移除依赖 — 优点：少一个文件 / 缺点：离线缓存能力直接没了，以后要加还得重写
  - 方案B：实现完整的离线缓存服务（isOnline/getCachedQuestions/cacheQuestions/addToSyncQueue） — 优点：功能完整，PWA离线可用 / 缺点：需要写新代码
- **最终选择**：方案B
- **选择理由**：离线缓存对PWA和弱网环境（地铁里刷题）是核心功能，补上比删掉有价值
- **注意事项**：旧的 `offline-cache.js` 返回boolean，新的 `checkOfflineAvailability()` 返回 `{ available, isOnline }` 对象。`do-quiz.vue` 有一层重定向适配
- **关联文件**：`src/services/offline-cache-service.js`, `src/pages/practice-sub/do-quiz.vue`

---

### DEC-002: 游戏常量集中到 game-constants.js 而非继续分散

- **日期**：2026-03-29
- **决策者**：AI会话（架构清爽化重构 Task 1）
- **背景**：XP奖励值、等级经验公式、连续签到倍率、成就定义这些游戏化常量分散在4个不同文件里（gamification.js、useXPSystem.js、learning-analytics.js、checkin-streak.js）。改一个值要改4个地方，而且容易改漏导致数据不一致。
- **选项分析**：
  - 方案A：在 config/index.js 里加一个 game 配置块 — 优点：复用现有配置体系 / 缺点：config/index.js 已经很大了（18个配置键），游戏常量和系统配置混在一起不清晰
  - 方案B：新建 config/game-constants.js 专门管游戏常量 — 优点：职责分离，游戏策划改数值只看这一个文件 / 缺点：多一个配置文件
- **最终选择**：方案B
- **选择理由**：游戏常量变动频率高（调平衡），和系统配置（超时/重试）性质不同，分开更好维护
- **注意事项**：所有游戏化数值（XP奖励、等级公式、签到倍率、成就解锁条件）必须从 game-constants.js 读取，禁止在消费者文件里写魔法数字
- **关联文件**：`src/config/game-constants.js`, `src/stores/modules/gamification.js`, `src/composables/useXPSystem.js`, `src/utils/learning-analytics.js`, `src/composables/checkin-streak.js`

---

### DEC-001: lafService 迁移采用方案B（彻底重构）而非方案A（渐进包装）

- **日期**：2026-03-29
- **决策者**：AI会话（架构清爽化重构 Task 4）
- **背景**：项目早期所有API调用都通过一个叫 `lafService` 的中间层。后来我们建了按业务领域划分的API文件（ai.api.js、practice.api.js等），但40多个文件还在调旧的lafService。相当于新路修好了，但大家还在走老路。
- **选项分析**：
  - 方案A：渐进包装 — 保留lafService，让它内部调用新的domain API，对外接口不变 — 优点：不动现有代码，风险低 / 缺点：多了一层转发，lafService变成"翻译层"永远无法删除，新开发者更困惑
  - 方案B：彻底重构 — 所有Store/Page/Service直接调用domain API，lafService归零 — 优点：代码路径清晰，少一层调用 / 缺点：要改40+文件，风险较高
- **最终选择**：方案B
- **选择理由**：长痛不如短痛。包装层会让代码越来越难懂，新AI会话看到两套API调用方式会更混乱
- **注意事项**：lafService.js 文件保留但0生产导入（263个测试引用仍在用它做mock），禁止新代码再导入lafService。如果未来看到 `import { lafService }` 出现在非测试文件中，那是Bug
- **关联文件**：`src/services/lafService.js`（已废弃，仅测试用）、`src/services/api/domains/*.api.js`（正确路径）、7个Store + 8个Page + 17个Service文件（已迁移）

---

### DEC-006: PK Battle API 重写为后端实际 action 而非修补前端调用

- **日期**：2026-03-29
- **决策者**：AI会话（五轮审计）
- **背景**：social.api.js 里有4个PK对战函数（createPKRoom/joinPKRoom/getPKRoomStatus/submitPKResult），但它们用的action名后端根本不认识，调了也是白调——永远返回"不支持的操作"。
- **选项分析**：
  - 方案A：让后端加上前端期望的action名 — 优点：前端不用改 / 缺点：后端已有成熟的7个action，加重复功能是浪费
  - 方案B：重写前端API函数，对齐后端实际支持的7个action（find_match/poll_room/submit_result/room_answer/leave_room/get_records/calculate_elo） — 优点：和后端完全对齐，一次修好 / 缺点：前端调用方全部需要更新
- **最终选择**：方案B
- **选择理由**：后端的action设计更合理（比如用find_match而非createPKRoom），前端应该适配后端而非反过来
- **注意事项**：PK对战的完整流程是 find_match → poll_room（轮询等对手） → room_answer（提交答案） → submit_result（提交最终结果）。如果未来改PK逻辑，先看后端pk-battle.ts支持哪些action
- **关联文件**：`src/services/api/domains/social.api.js`, `laf-backend/functions/pk-battle.ts`

---

### DEC-007: 放弃 vite-plugin-compression，Nginx 实时 gzip 够用

- **日期**：2026-03-29
- **决策者**：AI会话（十六轮审计，D030评估）
- **背景**：有人建议安装 vite-plugin-compression 在构建时生成 .gz 文件，这样 Nginx 可以直接发送预压缩文件而不用实时压缩。听起来能提升性能。
- **选项分析**：
  - 方案A：安装 vite-plugin-compression — 优点：理论上省掉Nginx实时压缩的CPU开销 / 缺点：多一个构建依赖，构建产物翻倍（每个文件多一个.gz），Nginx已经配好了gzip且服务器CPU完全够用
  - 方案B：维持现状，Nginx实时gzip — 优点：零改动，已在线运行稳定 / 缺点：理论上多一点CPU开销（但实际可忽略）
- **最终选择**：方案B（维持现状）
- **选择理由**：服务器CPU利用率很低，Nginx实时gzip完全够用，引入新依赖的风险大于收益
- **注意事项**：如果未来服务器CPU吃紧或并发量大幅增长，可以重新考虑预压缩方案。当前记录为技术债D030但优先级低
- **关联文件**：`vite.config.js`, `/etc/nginx/conf.d/exam-master.conf`
# AI Development Rules — Iron Laws

> Version: 2.0 | 迁移自 `docs/AI-SOP/SOP-RULES.md`
>
> These rules govern how AI assistants work with the EXAM-MASTER codebase.
> **Violation of any rule = immediate rollback.**

---

## Rule 1: Read Before Code

Before writing ANY code, read these files in order:

1. `CLAUDE.md` — 30-second project overview
2. `docs/status/HEALTH.md` — current bugs and deploy status
3. `docs/AI-SOP/MODULE-INDEX.md` — locate relevant files
4. 按 `docs/sop/DOC-FETCH-RULES.md` 第一条分级判断，查阅对应技术的官方文档（优先用 Context7 → 本地缓存 `docs/doc-cache/` → web_fetch 兜底）

## Rule 2: Locate Before Fix

Never guess file locations. Use `docs/AI-SOP/MODULE-INDEX.md` to find the exact file for your task.

## Rule 3: Layer Discipline

```
Router/Page → Component → Store → Service → Backend
```

- Pages call Components and Stores
- Stores call Services
- Services call `uni.request()` → Backend
- **NO skipping layers** (e.g., Page directly calling backend)

## Rule 4: Documentation Filing Law

| Document type    | Must go in                | Naming                                |
| ---------------- | ------------------------- | ------------------------------------- |
| Project overview | `docs/AI-SOP/`            | `PROJECT-BRIEF.md`, `ARCHITECTURE.md` |
| Module reports   | `docs/AI-SOP/modules/`    | `kebab-case.md`                       |
| Change log       | `docs/sop/CHANGE-LOG.md`  | Append only                           |
| Bug tracking     | `docs/status/HEALTH.md`   | Edit in place                         |
| Design specs     | `docs/superpowers/specs/` | `YYYY-MM-DD-name-design.md`           |
| Release notes    | `docs/releases/`          | `release-vX.Y.Z.md`                   |

### FORBIDDEN

- `.md` files at project root (except `README.md`, `CLAUDE.md`)
- Docs inside `src/`
- Chinese filenames (use kebab-case English, content can be Chinese)
- New doc directories outside `docs/`

## Rule 5: Security Checklist

Before every commit:

- [ ] No API keys in frontend code
- [ ] No `.env` files with real keys committed
- [ ] `requireAuth(ctx)` on all authenticated endpoints
- [ ] No `JWT_SECRET_PLACEHOLDER
- [ ] scrypt for passwords, never SHA256/MD5

## Rule 6: WeChat MP Size Budget

Main package MUST stay under **2MB**.

- Use `npm run build:mp-weixin` and check
- Heavy libs go in subPackages (ECharts custom build saves ~900KB)
- Composables/utils move to subpackage when needed

## Rule 7: Code Style

- `<script setup>` Composition API (no Options API for new code)
- Pinia stores: `defineStore` with setup syntax
- File names: `kebab-case.vue`, `kebab-case.js`
- Variables: `camelCase`
- Constants: `UPPER_SNAKE_CASE`
- Components: `PascalCase`
- Use `wot-design-uni` components before building custom
- UnoCSS atomic classes preferred, no inline styles

## Rule 8: Backend Rules

- Every cloud function: `export default async function(ctx) { ... }`
- Always call `requireAuth(ctx)` for authenticated endpoints
- Use `createLogger()` + `checkRateLimitDistributed()` from `api-response.ts`
- AI requests: only through `proxy-ai.ts` or `provider-factory.ts`
- FSRS scheduling: server-side only via `fsrs-scheduler.ts`
- SiliconFlow: **NEVER** call `Pro/` prefix models (key death)

## Rule 9: Completion Protocol

After finishing ANY task:

1. 质量关卡 → `npm run lint` + `npm test` + `npm run build:h5`（全过才算完）
2. 按 `docs/sop/REGRESSION-TEST-STRATEGY.md` 触发矩阵执行对应级别回归测试
3. 新功能 → 按 `docs/sop/ACCEPTANCE-CHECKLIST.md` 对照相关条目验收
4. 重大决策 → 记入 `docs/sop/AI-DECISION-LOG.md`
5. 更新 `docs/sop/CHANGE-LOG.md` + `docs/status/HEALTH.md`
6. 自检 → 构建通过？没泄露密钥？文档更新了？

## Rule 10: Verify Before Claim

- Run `npm run build:mp-weixin` for frontend changes
- Run `npx tsc --project tsconfig.standalone.json` for backend changes
- Test the specific endpoint you changed with `curl`
- Never say "done" without evidence
# 变更影响范围分析规则

> AI 在修改任何代码之前，**必须**先执行本文档的分析流程，用大白话告知用户可能受影响的功能，获得确认后才能动手。

---

## 第一步：识别修改类型

根据要改的文件所在目录，判断它属于哪一层：

| 层级       | 目录                                                      | 大白话解释               |
| ---------- | --------------------------------------------------------- | ------------------------ |
| 页面层     | `src/pages/`                                              | 用户直接看到的每个"屏幕" |
| 组件层     | `src/components/`                                         | 页面里可复用的"零件"     |
| 状态层     | `src/stores/modules/`                                     | 跨页面共享的"记忆"       |
| 逻辑层     | `src/composables/`                                        | 多个页面共用的"工具函数" |
| 接口层     | `src/services/api/domains/`                               | 前端和后端之间的"传话筒" |
| 样式层     | `src/styles/`                                             | 控制全局外观的"皮肤"     |
| 后端层     | `laf-backend/functions/`                                  | 服务器上处理数据的"后台" |
| 后端公共层 | `laf-backend/functions/_shared/`                          | 所有后台功能共用的"地基" |
| 配置层     | `vite.config.js` / `src/pages.json` / `src/manifest.json` | 项目的"总开关"           |

**规则：层级越靠下，影响范围越大。** 改一个页面只影响那个页面；改接口层或后端公共层，可能影响几十个功能。

---

## 第二步：查表确定影响范围

### 高风险区（改这些 = 影响全局）

| 修改位置                     | 影响层级   | 可能受影响的功能                                        | 风险 | 需要额外验证                      |
| ---------------------------- | ---------- | ------------------------------------------------------- | ---- | --------------------------------- |
| `_request-core.js`           | 接口层     | **所有功能** — 每个需要联网的操作都经过这里             | 🔴高 | 全量测试 + 每个页面手动点一遍     |
| `stores/auth.js`             | 状态层     | **所有需要登录的功能** — 登录、注册、个人中心、做题记录 | 🔴高 | 登录流程 + 需要登录的页面全部验证 |
| `App.vue`                    | 页面层     | **所有页面** — 全局样式、主题初始化、启动逻辑           | 🔴高 | 每个 Tab 页 + 暗黑模式切换        |
| `vite.config.js`             | 配置层     | **整个项目** — 打包、开发环境、路径别名                 | 🔴高 | 完整构建 H5 + 微信小程序          |
| `_design-tokens.scss`        | 样式层     | **所有页面外观** — 颜色、字号、圆角、间距               | 🔴高 | 亮/暗模式所有页面截图对比         |
| `_shared/auth-middleware.ts` | 后端公共层 | **所有需要登录的后端接口** — 鉴权失败会导致全部报错     | 🔴高 | 后端编译 + 登录后调用任意接口     |
| `_shared/api-response.ts`    | 后端公共层 | **所有后端接口** — 返回格式变了前端全部解析失败         | 🔴高 | 后端编译 + 前端全量测试           |
| `_shared/ai-providers/`      | 后端公共层 | **所有 AI 功能** — AI 对话、拍照搜题、AI 批改、诊断     | 🔴高 | 每种 AI 功能各调一次              |
| `pages.json`                 | 配置层     | **页面路由** — 页面跳转、TabBar、导航栏                 | 🔴高 | 所有页面能否正常打开              |

### 中风险区（改这些 = 影响多个功能）

| 修改位置                                        | 影响层级   | 可能受影响的功能                          | 风险 | 需要额外验证               |
| ----------------------------------------------- | ---------- | ----------------------------------------- | ---- | -------------------------- |
| `stores/gamification.js`                        | 状态层     | 经验值、成就弹窗、排行榜、等级显示        | 🟡中 | 做题得分 + 成就 + 排行榜页 |
| `stores/study-engine.js`                        | 状态层     | 刷题流程、答题记录、学习计划进度          | 🟡中 | 做题 + 智能复习 + 学习统计 |
| `stores/review.js`                              | 状态层     | 智能复习、FSRS 调度、复习提醒             | 🟡中 | 智能复习 + 知识图谱        |
| `stores/theme.js`                               | 状态层     | 所有页面的主题切换（亮/暗/自定义）        | 🟡中 | 切换主题 + 各页面截图      |
| `stores/user.js` / `stores/profile.js`          | 状态层     | 个人中心、头像、昵称、学习数据展示        | 🟡中 | 个人中心页 + 首页用户信息  |
| `composables/useTheme.js`                       | 逻辑层     | 主题相关的所有页面                        | 🟡中 | 主题切换后各页面外观       |
| `composables/useNavigation.js`                  | 逻辑层     | 所有页面跳转逻辑                          | 🟡中 | 各页面间的跳转             |
| `composables/useStudyTimer.js`                  | 逻辑层     | 学习计时、专注计时、学习统计              | 🟡中 | 计时器 + 学习统计页        |
| `api/domains/auth.api.js`                       | 接口层     | 登录、注册、微信授权、QQ 授权             | 🟡中 | 所有登录方式               |
| `api/domains/practice.api.js`                   | 接口层     | 做题、交卷、题目加载、成绩统计            | 🟡中 | 刷题全流程                 |
| `api/domains/ai.api.js`                         | 接口层     | AI 对话、AI 批改、AI 诊断                 | 🟡中 | AI 聊天 + 做题后 AI 反馈   |
| `components/layout/custom-tabbar/`              | 组件层     | 底部导航栏 — 首页/刷题/择校/我的 四个入口 | 🟡中 | 四个 Tab 页切换            |
| `_shared/fsrs.service.ts` / `fsrs-scheduler.ts` | 后端公共层 | 智能复习算法、做题调度、知识图谱掌握度    | 🟡中 | 智能复习 + 做题顺序        |
| `_dark-mode-vars.scss` / `_wot-theme.scss`      | 样式层     | 暗黑模式 / 组件库主题样式                 | 🟡中 | 亮暗模式切换               |
| `laf-backend/functions/answer-submit.ts`        | 后端层     | 交卷、成绩计算、经验值发放                | 🟡中 | 做题交卷 + 成绩展示        |
| `laf-backend/functions/proxy-ai*.ts`            | 后端层     | 所有 AI 对话功能（普通 + 流式）           | 🟡中 | AI 聊天 + 拍照搜题         |

### 低风险区（改这些 = 只影响单个功能）

| 修改位置                              | 影响层级 | 可能受影响的功能                             | 风险 | 需要额外验证        |
| ------------------------------------- | -------- | -------------------------------------------- | ---- | ------------------- |
| `pages/index/`                        | 页面层   | 仅首页                                       | 🟢低 | 首页展示正常        |
| `pages/practice/`                     | 页面层   | 仅刷题入口页                                 | 🟢低 | 刷题入口正常        |
| `pages/practice-sub/do-quiz.vue`      | 页面层   | 仅做题页面                                   | 🟢低 | 做题流程正常        |
| `pages/school/` / `pages/school-sub/` | 页面层   | 仅择校相关页面                               | 🟢低 | 择校搜索 + 详情页   |
| `pages/chat/`                         | 页面层   | 仅 AI 聊天页面                               | 🟢低 | 发消息 + 收回复     |
| `pages/plan/`                         | 页面层   | 仅学习计划相关页面                           | 🟢低 | 计划列表 + 创建计划 |
| `pages/mistake/`                      | 页面层   | 仅错题本                                     | 🟢低 | 错题列表 + 报告     |
| `pages/tools/`                        | 页面层   | 仅工具页（计时器/拍照/格式转换）             | 🟢低 | 对应工具可用        |
| `pages/settings/`                     | 页面层   | 仅设置页面                                   | 🟢低 | 设置项操作正常      |
| `pages/social/`                       | 页面层   | 仅社交功能（好友列表/主页）                  | 🟢低 | 好友相关操作        |
| `pages/login/`                        | 页面层   | 仅登录/注册页面（注意：登录逻辑在 Store 层） | 🟢低 | 登录界面显示        |
| `pages/knowledge-graph/`              | 页面层   | 仅知识图谱页面                               | 🟢低 | 图谱展示正常        |
| `components/business/index/`          | 组件层   | 仅首页的卡片/统计/问候语                     | 🟢低 | 首页各卡片          |
| `components/business/practice/`       | 组件层   | 仅刷题页的弹窗/进度条/动画                   | 🟢低 | 刷题页交互          |
| `components/common/`                  | 组件层   | 用到该组件的页面（看具体哪个组件）           | 🟢低 | 使用该组件的页面    |
| 单个后端函数（如 `school-query.ts`）  | 后端层   | 仅对应的单个功能                             | 🟢低 | 对应功能可用        |

---

## 第三步：汇报模板

AI 在动手之前，**必须**用以下格式向用户汇报：

```
📋 变更影响分析
━━━━━━━━━━━━━━━━━━

📝 我要改什么：[一句话说清楚，例如"修复登录按钮点击没反应的问题"]
📁 要改的文件：[文件列表]
🎯 影响范围：
  - [功能A] — [为什么会受影响，一句话]
  - [功能B] — [为什么会受影响，一句话]
⚠️ 风险等级：[🟢低 / 🟡中 / 🔴高]
✅ 改完后我会验证：[验证步骤]

确认后我就开始改，有疑问随时说。
```

**多文件修改时**，取所有文件中最高的风险等级作为整体风险等级。

---

## 第四步：验证清单

修改完成后，根据风险等级执行对应的验证：

### 🟢 低风险 — 单功能验证

```bash
npm run lint          # 代码规范检查
npm test              # 单元测试
```

- 手动验证受影响的那个页面/功能能正常使用

### 🟡 中风险 — 关联功能验证

```bash
npm run lint          # 代码规范检查
npm test              # 单元测试
npm run build:h5      # 构建验证
```

- 手动验证受影响的所有页面/功能
- 如果改了样式：亮色 + 暗色模式都要截图确认

### 🔴 高风险 — 全量验证

```bash
npm run lint          # 代码规范检查
npm test              # 单元测试（全部 1196 条必须通过）
npm run build:h5      # H5 构建
npm run build:mp-weixin  # 微信小程序构建（检查包大小）
```

- 后端改动额外执行：`cd laf-backend && npx tsc --project tsconfig.standalone.json`
- 四个 Tab 页（首页/刷题/择校/我的）全部打开验证
- 登录流程走一遍
- 主题切换验证

---

## 附录：特殊情况速查

| 情况                                | 处理方式                             |
| ----------------------------------- | ------------------------------------ |
| 只改了注释或文档                    | 跳过影响分析，直接改                 |
| 只改了测试文件                      | 跳过影响分析，跑 `npm test` 确认即可 |
| 改了 `package.json` 的依赖          | 视为🔴高风险，需要完整构建验证       |
| 改了 `.env.*` 环境变量              | 视为🔴高风险，确认不含真实密钥       |
| 改了 `electron-builder.config.json` | 只影响桌面版打包，不影响小程序和 H5  |
| 不确定影响范围                      | 按🟡中风险处理，多验证总比少验证好   |
# DOC-FETCH-RULES — 官方文档强制查阅规则

> 版本：2.0 | 适用对象：所有 AI 助手
>
> **一句话原则**：AI 的训练数据有截止日期，写代码前必须查官方文档，以文档为唯一真相。

---

## 第零条：优先级铁律

```
AI 训练记忆 < 项目已有代码 < 官方文档 < 官方 GitHub 源码
```

冲突时永远以右侧为准。禁止用"我记得"跳过文档查阅。

---

## 第一条：查还是不查？三级分类

不是每次调用 API 都要拉文档——那样效率太低。按以下分级执行：

### 🔴 必查（不查 = 修改不可信）

| 场景                                     | 原因                               |
| ---------------------------------------- | ---------------------------------- |
| 第一次使用某 API / 某功能                | 零经验，必须确认签名               |
| 遇到报错                                 | 先查官方 Issue，不猜原因           |
| 安装/升级依赖包                          | 必须读 Breaking Changes            |
| 写 MongoDB 聚合管道 / 复杂查询           | 操作符语法极易出错                 |
| 微信小程序平台特有 API                   | 平台差异大，必须查                 |
| 修改构建配置（Vite / ESLint / tsconfig） | 配置项版本敏感                     |
| 修复已经修了两次以上的 Bug               | 说明之前的修法有问题，必须回到文档 |

### 🟡 建议查（不确定就查）

| 场景                         | 原因                         |
| ---------------------------- | ---------------------------- |
| API 参数超过 3 个            | 参数顺序/类型容易记混        |
| 使用不常见的 Vue 3 内置组件  | Teleport/Suspense 等用法特殊 |
| 跨组件通信（provide/inject） | 响应式丢失是常见坑           |
| Store 在组件外使用           | Pinia 有特殊要求             |

### 🟢 不用查

| 场景                                           | 原因                         |
| ---------------------------------------------- | ---------------------------- |
| `ref()` / `reactive()` / `computed()` 基础用法 | 项目中已有大量正确用例可参考 |
| `console.log()` 等 JS 原生 API                 | 无版本差异                   |
| 项目中已有 5 处以上正确用例的模式              | 复制已验证的模式即可         |

---

## 第二条：怎么查？三层查阅策略

按效率从高到低，优先用上层，上层不够再往下走：

### 第 1 层：Context7 精准查询（优先使用）

本项目已接入 Context7 文档查询工具，能精准返回特定 API 的代码片段，不浪费上下文窗口。

```
# 步骤 1：解析库 ID
context7_resolve_library_id("pinia", "如何在组件外使用 store")

# 步骤 2：精准查询
context7_query_docs("/vuejs/pinia", "在路由守卫中使用 store 的正确方式")
```

**适用场景**：查特定 API 用法、查特定功能的代码示例。

### 第 2 层：本地文档摘要缓存

高频易错点的关键结论预存在 `docs/doc-cache/` 目录中，AI 优先读本地缓存。

```
# 目录结构
docs/doc-cache/
├── README.md          ← 缓存使用说明
├── vue3.md            ← Vue 3 高频易错点摘要
├── pinia.md           ← Pinia 关键用法摘要
├── uniapp.md          ← uni-app 平台差异摘要
├── mongodb.md         ← MongoDB 查询/聚合摘要
├── wechat-mp.md       ← 微信小程序 API 摘要
├── eslint-v9.md       ← ESLint v9 flat config 摘要
└── typescript.md      ← TypeScript 配置和类型工具摘要
```

**适用场景**：已知的高频坑点、项目特有的配置约定。
**维护规则**：每次通过在线文档解决了一个坑，把结论追加到对应缓存文件中。

### 第 3 层：在线拉取官方文档（兜底）

Context7 查不到、本地缓存没覆盖时，才用 `web_fetch` 拉取官方文档。

```
# 拉取时注意：只拉特定页面，不拉首页/目录页
web_fetch("https://pinia.vuejs.org/zh/core-concepts/outside-component-usage.html")
# ✅ 好：精准页面

web_fetch("https://pinia.vuejs.org/zh/")
# ❌ 差：首页内容太多，浪费上下文
```

---

## 第三条：版本锁定文档索引

> 版本号来自项目 `package.json`，非"最新"。查文档时必须对照此版本。

### 前端核心

| 技术               | 项目版本    | Context7 ID         | 官方文档                               |
| ------------------ | ----------- | ------------------- | -------------------------------------- |
| **Vue 3**          | 3.4.21      | `/vuejs/core`       | https://cn.vuejs.org/api/              |
| **Pinia**          | 2.1.7       | `/vuejs/pinia`      | https://pinia.vuejs.org/zh/            |
| **uni-app**        | 3.0.0-alpha | `/dcloudio/uni-app` | https://uniapp.dcloud.net.cn/          |
| **Vite**           | 5.2.8       | `/vitejs/vite`      | https://cn.vitejs.dev/config/          |
| **wot-design-uni** | ^1.14.0     | —                   | https://wot-design-uni.netlify.app/    |
| **ECharts**        | 5.x         | `/apache/echarts`   | https://echarts.apache.org/zh/api.html |
| **KaTeX**          | ^0.16.38    | —                   | https://katex.org/docs/supported.html  |

### 后端与运行时

| 技术           | 项目版本  | Context7 ID             | 官方文档                                   |
| -------------- | --------- | ----------------------- | ------------------------------------------ |
| **TypeScript** | 5.x       | `/microsoft/TypeScript` | https://www.typescriptlang.org/docs/       |
| **Node.js**    | >=20.17.0 | `/nodejs/node`          | https://nodejs.org/docs/latest-v20.x/api/  |
| **Express.js** | 4.x       | `/expressjs/express`    | https://expressjs.com/zh-cn/4x/api.html    |
| **MongoDB**    | 7.x       | `/mongodb/docs`         | https://www.mongodb.com/zh-cn/docs/manual/ |

### 测试工具

| 技术                | 项目版本 | Context7 ID             | 官方文档                          |
| ------------------- | -------- | ----------------------- | --------------------------------- |
| **Vitest**          | ^4.0.18  | `/vitest-dev/vitest`    | https://cn.vitest.dev/            |
| **Playwright**      | ^1.57.0  | `/microsoft/playwright` | https://playwright.dev/docs/intro |
| **@vue/test-utils** | ^2.4.6   | —                       | https://test-utils.vuejs.org/     |

### 工具链

| 技术                  | 项目版本                 | 官方文档                          |
| --------------------- | ------------------------ | --------------------------------- |
| **ESLint**            | ^9.39.2 (v9 flat config) | https://eslint.org/docs/latest/   |
| **eslint-plugin-vue** | ^10.7.0                  | https://eslint.vuejs.org/         |
| **Prettier**          | ^3.5.3                   | https://prettier.io/docs/en/      |
| **Husky**             | ^9.1.7                   | https://typicode.github.io/husky/ |

### 平台 API

| 平台               | 官方文档                                                    |
| ------------------ | ----------------------------------------------------------- |
| **微信小程序 API** | https://developers.weixin.qq.com/miniprogram/dev/api/       |
| **微信小程序框架** | https://developers.weixin.qq.com/miniprogram/dev/reference/ |
| **QQ 小程序 API**  | https://q.qq.com/wiki/develop/miniprogram/API/              |

### 运维

| 技术                   | 官方文档                                          |
| ---------------------- | ------------------------------------------------- |
| **Nginx**              | https://nginx.org/en/docs/                        |
| **PM2**                | https://pm2.keymetrics.io/docs/usage/quick-start/ |
| **Docker**             | https://docs.docker.com/                          |
| **Cloudflare Workers** | https://developers.cloudflare.com/workers/        |

---

## 第四条：文档查阅标准流程

```
收到任务
  │
  ├─ 识别涉及哪些技术 → 按第一条分级判断"查不查"
  │
  ├─ 🔴 必查 / 🟡 不确定
  │     │
  │     ├─ 第1层：Context7 精准查询（优先）
  │     │     └─ 找到 → 确认 API 签名 → 开始写代码
  │     │
  │     ├─ 第2层：读 docs/doc-cache/ 对应文件
  │     │     └─ 有对应条目 → 确认后开始写代码
  │     │
  │     └─ 第3层：web_fetch 拉取官方特定页面
  │           └─ 找到 → 确认 + 把关键结论追加到 doc-cache → 开始写代码
  │
  └─ 🟢 不用查 → 直接写代码（参考项目中已有正确用例）
```

---

## 第五条：报错处理 — 先查后改

遇到报错，**禁止凭经验直接改**，必须按以下顺序：

```
1. 完整复制报错信息
2. 识别报错来自哪个库（看 stack trace）
3. 查项目当前使用的版本号（package.json）
4. Context7 查询该库对应报错的解决方案
5. 查不到 → GitHub Issues 搜索报错关键词
6. 确认是否为已知 bug → 查 Changelog
7. 基于文档给出修复方案
8. 修复 + 运行验证
```

**特殊规则**：如果同一个 Bug 修了两次还没修好，必须回到第 4 步重新查文档，不允许继续"试错式修复"。

---

## 第六条：禁止行为

| 禁止                            | 原因                               |
| ------------------------------- | ---------------------------------- |
| 凭记忆写 API 参数名             | 版本不同参数可能已变               |
| 从已有的错误代码复制粘贴        | 会扩散 bug                         |
| 没查文档就说"应该可以"          | 猜测不是工程                       |
| 跳过 Changelog 直接升级依赖     | Breaking Change 会导致崩溃         |
| 用第三方博客替代官方文档        | 博客可能过时                       |
| `web_fetch` 拉取文档首页/目录页 | 内容太多浪费上下文，必须拉特定页面 |

---

## 第七条：文档缓存维护规则

`docs/doc-cache/` 目录是"经验库"——每次通过查文档解决了问题，把结论沉淀下来：

```markdown
# 追加格式示例（追加到 docs/doc-cache/pinia.md）

## storeToRefs 在 setup store 中的用法

- 来源：https://pinia.vuejs.org/zh/core-concepts/#using-the-store
- 结论：在 setup store 中，必须用 storeToRefs() 解构才能保持响应式，直接解构会丢失响应式
- 日期：2026-03-29
```

**维护时机**：

- 修完一个因文档不熟导致的 bug → 追加
- 发现版本升级导致的 Breaking Change → 追加
- 发现项目特有的平台差异坑 → 追加

**不追加的情况**：

- JS 原生 API（不会变）
- 项目中已有 5 处以上正确用例的模式（直接参考代码）

---

## 第八条：与现有规则的集成

本规则与 `CLAUDE.md` 和 `AI-DEV-RULES.md` 并行生效：

**AI-DEV-RULES Rule 1（Read Before Code）扩展为**：

```
1. 读 CLAUDE.md
2. 读 docs/status/HEALTH.md
3. 读 docs/AI-SOP/MODULE-INDEX.md
4.【新增】按第一条分级判断，查阅对应技术的官方文档
5. 开始写代码
```

**CHANGE-LOG 更新时**，如果本次修改参考了文档，追加一行：

```markdown
- 参考文档：[文档名称](URL)
```

---

## 附录：版本更新检查清单

每次升级 `package.json` 中的依赖版本后，必须同步更新：

1. 本文件第三条中的"项目版本"列
2. `docs/doc-cache/` 中对应技术的缓存文件（标记旧版内容、补充新版变化）
3. 运行完整质量关卡（lint + test + build）确认升级无破坏
# 回归测试策略

> AI 每次修改代码后，必须根据修改范围选择对应级别的测试来验证，不跑测试不许说"完成了"。

## 测试分级

### Level 1: 快速冒烟（每次修改后必跑，无例外）

```bash
npm run lint && npm test && npm run build:h5
```

- **耗时**：约 3 分钟
- **作用**：确保代码没语法错误、1196 个单元测试全过、H5 能正常打包
- **通俗说**：相当于出门前检查"钥匙手机钱包带了没"

### Level 2: E2E 回归（改了页面逻辑/交互/路由时必跑）

```bash
npm run test:e2e:regression
```

- **耗时**：约 5-10 分钟
- **作用**：Playwright 自动打开浏览器，模拟真实用户点击、跳转、填表单，跑 18 个 spec 文件
- **覆盖**：冒烟检查 → 核心流程 → 异常流程 → 状态恢复 → 高风险页面 → 全路由覆盖等
- **通俗说**：相当于让一个测试员把 app 从头到尾点一遍

### Level 3: 可视化回归（改了样式/主题/组件外观时必跑）

```bash
npm run test:visual
```

- **耗时**：约 3-5 分钟
- **作用**：对每个页面截图，和之前保存的"标准截图"逐像素对比，发现页面长歪了立刻报警
- **覆盖**：`ui-pages.spec.js`（基础页面）+ `full-feature-pages.spec.js`（功能页面）
- **通俗说**：相当于把两张照片叠在一起看有没有走形

### Level 4: 全量回归（大重构/发版前必跑）

```bash
npm run test:qa:full-regression
```

- **耗时**：约 15-20 分钟
- **作用**：把所有检查串起来跑一遍——lint → 格式检查 → 云函数审计 → H5 构建 → 单元测试 → 可视化测试 → E2E 回归 → 兼容性测试 → Maestro → 密钥审计 → 依赖审计 → 小程序包体积检查
- **通俗说**：相当于年度体检，全身上下查一遍

---

## 触发条件矩阵

AI 每次改完代码，对照这张表，打勾的级别必须跑：

| 修改类型                          | L1 冒烟 | L2 E2E | L3 可视化 | L4 全量 |
| --------------------------------- | :-----: | :----: | :-------: | :-----: |
| 改了一个页面的业务逻辑            |   ✅    |   ✅   |     -     |    -    |
| 改了全局样式 / 主题色 / 字体大小  |   ✅    |   -    |    ✅     |    -    |
| 改了单个组件的样式                |   ✅    |   -    |    ✅     |    -    |
| 改了多个组件（≥3 个）             |   ✅    |   ✅   |    ✅     |    -    |
| 改了 `_request-core.js` 或 API 层 |   ✅    |   ✅   |     -     |   ✅    |
| 改了 Pinia Store                  |   ✅    |   ✅   |     -     |    -    |
| 改了路由 `pages.json`             |   ✅    |   ✅   |     -     |    -    |
| 改了后端云函数                    |   ✅    |   ✅   |     -     |    -    |
| 改了 Vite / 构建配置              |   ✅    |   -    |     -     |   ✅    |
| 改了 npm 依赖（新增/升级/删除）   |   ✅    |   ✅   |    ✅     |   ✅    |
| 大规模重构（改了 ≥5 个文件）      |   ✅    |   ✅   |    ✅     |   ✅    |
| 发版前                            |   ✅    |   ✅   |    ✅     |   ✅    |
| 只改了文档 / 注释 / CHANGELOG     |    -    |   -    |     -     |    -    |

**特别说明**：只改文档不需要跑任何测试，但如果文档改动涉及到代码示例，还是要跑 Level 1。

---

## 测试失败处理流程

### 原则：测试没过 = 没做完，禁止跳过

```
测试失败
  ↓
第 1 步：看报错信息，判断是"真的坏了"还是"测试本身需要更新"
  ↓
├─ 真的坏了 → 第 2 步：回到代码修 bug → 修完重跑测试
│
└─ 测试需要更新（比如页面本来就要改，截图当然不一样了）
    ↓
    第 2 步：确认改动是"故意的"→ 更新基准截图/修改测试断言
    ↓
    第 3 步：重跑测试确认全过
```

### 具体场景

| 场景                               | 处理方式                                                         |
| ---------------------------------- | ---------------------------------------------------------------- |
| Level 1 lint 报错                  | 直接修，通常是格式问题，`npm run lint -- --fix` 可以自动修大部分 |
| Level 1 单元测试失败               | 看失败的 test 文件，判断是代码 bug 还是测试需要更新              |
| Level 1 build 失败                 | 通常是 import 路径错误或类型问题，按报错信息修                   |
| Level 2 E2E 某个 spec 失败         | 打开 `test-results/` 看截图和 trace，定位是哪个页面/交互出了问题 |
| Level 3 截图对比不一致             | 如果是故意改的样式 → `npm run test:visual:update` 更新基准截图   |
| Level 3 截图对比不一致但不是故意的 | 说明改动产生了副作用，回去查代码找出意外影响的地方               |
| Level 4 某个环节失败               | 按上面对应级别的方式处理，全过后才算完成                         |

### 禁止事项

- ❌ 不许因为"赶时间"跳过失败的测试
- ❌ 不许注释掉失败的测试用例来"让测试通过"
- ❌ 不许在没搞清原因的情况下盲目更新基准截图
- ❌ 不许只跑通过的部分然后说"测试通过了"

---

## 可视化回归具体规则

### 什么时候更新基准截图

基准截图是"正确的样子"，只有以下情况才允许更新：

1. **故意改了 UI**：比如用户要求换颜色、调字号、改布局 → 改完后 `npm run test:visual:update`
2. **新增了页面**：新页面没有基准截图 → 跑一次生成基准
3. **升级了依赖导致渲染变化**：确认新渲染是正确的 → 更新基准

### 更新基准截图的流程

```bash
# 1. 先跑一次看哪些截图变了
npm run test:visual

# 2. 打开报告，肉眼确认每一张"变了的截图"都是预期变化
#    报告在 playwright-report/ 目录

# 3. 确认无误后更新基准
npm run test:visual:update

# 4. 再跑一次确认全过
npm run test:visual
```

### 截图对比容差

- 默认容差值已在 `playwright.visual.config.js` 中配置
- 如果某个页面有动态内容（如时间、随机数据），测试中应该 mock 掉或设置更高容差
- 不要为了通过测试而把容差调到离谱的程度

---

## AI 工作检查清单

每次完成代码修改后，AI 必须自问：

- [ ] 我改了几个文件？改了什么类型的内容？（对照触发条件矩阵）
- [ ] 该跑的测试级别都跑了吗？
- [ ] 测试全过了吗？有没有跳过失败的？
- [ ] 如果改了 UI，可视化截图对比过了吗？
- [ ] 如果更新了基准截图，每张都确认过是预期变化吗？
- [ ] 构建产物正常吗？（`npm run build:h5` 没报错）

**全部打勾了才能说"完成了"。**
# Document Update Protocol

> 定义何时、更新哪些文档的触发规则

## Trigger Matrix

| When you...                                      | Update these docs                                      |
| ------------------------------------------------ | ------------------------------------------------------ |
| Change frontend page (`src/pages/`)              | `modules/frontend-pages.md` + CHANGE-LOG               |
| Change component (`src/components/`)             | `modules/frontend-components.md` + CHANGE-LOG          |
| Change service (`src/services/`)                 | `modules/frontend-services.md` + CHANGE-LOG            |
| Change store (`src/stores/`)                     | `modules/frontend-stores.md` + CHANGE-LOG              |
| Change cloud function (`laf-backend/functions/`) | `modules/backend-functions.md` + CHANGE-LOG            |
| Change DB schema                                 | `modules/backend-schemas.md` + CHANGE-LOG              |
| Change API contract                              | `modules/api-documentation.md` + CHANGE-LOG            |
| Add/remove dependency                            | `PROJECT-BRIEF.md` + CHANGE-LOG                        |
| Change build/deploy config                       | `ARCHITECTURE.md` + CHANGE-LOG                         |
| Discover a bug                                   | `docs/status/HEALTH.md` → Active Issues                |
| Fix a bug                                        | `docs/status/HEALTH.md` → move to Resolved             |
| Identify tech debt                               | `docs/status/HEALTH.md` → Tech Debt                    |
| Change styles/theme                              | `modules/styling-system.md` + CHANGE-LOG               |
| Change test infra                                | `modules/testing-infra.md` + CHANGE-LOG                |
| Add new LLM provider                             | `modules/backend-functions.md` (号池章节) + CHANGE-LOG |
| Change server config                             | CHANGE-LOG (scope: `deploy` or `infra`)                |
| Make a major technical decision                  | `AI-DECISION-LOG.md` → 追加决策记录                    |
| Complete a new feature                           | `ACCEPTANCE-CHECKLIST.md` → 对照相关条目验收           |
| Fix a bug that may affect other features         | `REGRESSION-TEST-STRATEGY.md` → 按触发矩阵执行测试     |
| Modify code that affects multiple files          | `CHANGE-IMPACT-ANALYSIS.md` → 填写影响分析报告         |
| Change SOP rules or create new SOP doc           | `WORKFLOW-PLAYBOOK.md` + CLAUDE.md 文档体系表          |

## CHANGE-LOG Entry Format

```markdown
## [YYYY-MM-DD] Brief Title

- **Scope**: [frontend|backend|ai-pool|deploy|auth|database|docs|infra]
- **Files Changed**: list of files
- **Summary**: what was done and why
- **Breaking Changes**: any API/behavior changes (or "None")
```

### Scope Tags

| Tag        | When to use                                     |
| ---------- | ----------------------------------------------- |
| `frontend` | Vue pages, components, stores, services, styles |
| `backend`  | Cloud functions, shared modules, DB operations  |
| `ai-pool`  | LLM provider changes, API keys, model updates   |
| `deploy`   | Server config, Nginx, PM2, Docker, CF Worker    |
| `auth`     | JWT, login, password, admin auth                |
| `database` | Schema changes, indexes, migrations             |
| `docs`     | Documentation-only changes                      |
| `infra`    | CI/CD, monitoring, backup, security             |

## Bug Lifecycle in HEALTH.md

```
发现 Bug
  → 记录到 HEALTH.md「Active Issues」
  → 分配 ID: H{NNN}
  → 标注严重度: 🔴 Blocker | 🟠 Important | 🟡 Normal | 🔵 Low
  → 标注领域: frontend | backend | deploy | auth | database | infra

修复 Bug
  → 移至「Recently Resolved」
  → 标注解决方案 + 日期
  → ID 改为 R{NNN}

识别深层问题
  → 记入「Tech Debt」
  → ID: D{NNN}
  → 评估优先级和影响
```
# 工作流剧本 & 参考手册

> 本文件包含 CLAUDE.md 的详细执行流程和参考信息。
> AI 在识别任务类型后按需加载本文件，不必每次会话全部阅读。

---

## 流程 A: 新功能开发（产品经理+工程师+QA 协作）

```
1. 理解意图 → 用大白话和客户确认："您是想要...对吗？"
2. 可行性评估 → 30秒说清楚方案（用类比解释），评估对现有架构的影响
3. 搜索开源 → 检查 GitHub 上是否有成熟的高 Star 项目可以直接搬运/集成
   - 有成熟方案 → 直接搬运，去除无关依赖，适配本项目风格
   - 无成熟方案 → 自己实现，但参考同类项目的设计思路
4. 影响分析 → 读 docs/sop/CHANGE-IMPACT-ANALYSIS.md，填写影响报告模板
5. 拆分任务 → TodoWrite 列出步骤（颗粒度到单个文件级别）
6. 逐步实施 → 每完成一步标记完成 + 汇报进度（"一共5步，做到第3步"）
7. 截图展示 → Playwright 截图给客户看效果
8. 质量关卡 → npm run lint + npm test + npm run build:h5（三个全过才算完）
9. 回归测试 → 按 docs/sop/REGRESSION-TEST-STRATEGY.md 执行对应级别测试
10. 验收 → 按 docs/sop/ACCEPTANCE-CHECKLIST.md 对照相关功能条目
11. 决策记录 → 重大决策写入 docs/sop/AI-DECISION-LOG.md
12. 收尾 → 更新 CHANGE-LOG + HEALTH.md
```

## 流程 B: UI/UX改进（设计师角色）

```
1. 截图当前状态 → Playwright 截图
2. 分析问题 → 按现代UI规范给出改进方案（圆角、间距、配色、响应式）
3. 实施修改 → 直接改，不追问
4. 截图对比 → 修改前 vs 修改后
5. 大白话说明 → "改了哪里、为什么这样改"
6. 质量关卡 → npm run lint + npm test + npm run build:h5
```

## 流程 C: Bug修复（QA+工程师协作）

```
1. 一句话告诉客户 → "哪里坏了"
2. 根因调查 → 使用 systematic-debugging skill
3. 影响分析 → 读 docs/sop/CHANGE-IMPACT-ANALYSIS.md 确认修复范围
4. 修复 → 直接修
5. 验证 → 跑相关测试/截图证明
6. 回归测试 → 按 docs/sop/REGRESSION-TEST-STRATEGY.md 执行
7. 告诉客户 → "修好了，原因是...（类比解释）"
```

## 流程 D: 部署运维（DevOps 角色）

```
1. 构建前端 → npm run build:h5 / build:mp-weixin
2. 编译后端 → cd laf-backend && npx tsc --project tsconfig.standalone.json
3. 上传服务器 → scp + ssh pm2 restart（服务器信息见 .env.server）
4. 验证 → curl health-check 确认在线
5. 告诉客户 → "已上线，你可以打开看看"
```

## 流程 E: 状态查询

```
1. 读 docs/status/HEALTH.md
2. SSH 检查服务器状态
3. 用大白话汇报：系统状态、最近变更、待处理问题
```

## 流程 F: 质量审计

```
1. npm run lint + npm test + npm run build:h5（前端三道关卡）
2. 后端 TS 编译检查
3. 服务器 health-check + pm2 + SSL 检查
4. 按 docs/sop/ACCEPTANCE-CHECKLIST.md 逐一验证核心功能
5. 汇报发现的问题并逐一修复
6. 更新 HEALTH.md
```

## 流程 G: 技术咨询

```
1. 理解用户想法
2. 从技术可行性、开发成本、维护难度三个维度分析
3. 用大白话给出建议，附带类比说明
4. 如果用户确认要做 → 自动切换到流程A
```

## 流程 H: 性能优化

```
1. 使用 Playwright 测量页面加载时间
2. 分析瓶颈（网络请求、组件渲染、包体积）
3. 影响分析 → 读 docs/sop/CHANGE-IMPACT-ANALYSIS.md
4. 实施优化
5. 前后对比数据
6. 告诉客户 → "快了多少、怎么做到的"
```

---

## 常用命令

```bash
# 前端
npm run dev:h5                    # 本地开发
npm run build:h5                  # H5 正式构建
npm run build:mp-weixin           # 微信小程序构建

# 后端部署（腾讯云）
cd laf-backend && npx tsc --project tsconfig.standalone.json
scp -r dist/* root@101.43.41.96:/opt/apps/exam-master/backend/
ssh root@101.43.41.96 'cd /opt/apps/exam-master/backend && npm install && pm2 restart exam-master'

# Electron 桌面应用
npm run electron:dev              # 本地运行桌面版
npm run electron:build:mac        # 打包 macOS 版本

# 测试
npm test                          # 单元测试（90文件/1196用例）
npm run lint                      # 代码检查
npm run test:e2e:regression       # E2E 回归测试
npm run test:visual               # 可视化回归测试
npm run test:qa:full-regression   # 完整回归（含 E2E + 可视化）

# 服务器检查
ssh root@101.43.41.96 'pm2 list && curl -s http://localhost:3001/health-check'
```

## 服务器信息

⚠️ **敏感信息在 `.env.server`（不在版本控制中）**

| 项        | 值                                                      |
| --------- | ------------------------------------------------------- |
| IP        | 101.43.41.96                                            |
| 后端路径  | /opt/apps/exam-master/backend/                          |
| PM2进程名 | exam-master                                             |
| Nginx配置 | /etc/nginx/conf.d/exam-master.conf                      |
| MongoDB   | Docker容器 exam-master-mongo, 127.0.0.1:27017           |
| SSL证书   | /etc/letsencrypt/live/api.245334.xyz/（到期2026-06-20） |

SSH 登录方式：`ssh root@101.43.41.96`（密码见 `.env.server`）

## 已知陷阱

| 陷阱                              | 解法                                                |
| --------------------------------- | --------------------------------------------------- |
| 微信小程序包太大                  | `npm run build:mp-weixin` 检查，ECharts用自定义构建 |
| `@lafjs/cloud` 在独立服务器不存在 | 用 `cloud-shim.ts` 适配                             |
| SiliconFlow DS key 调用Pro模型    | key会永久死亡，只用标准模型                         |
| canvas-confetti 微信不支持        | 用 `mp-confetti.js` (CSS动画)                       |
| MongoDB `_.or()` 查询             | 必须用 `.where()` 顶层操作符                        |
| 首页底部内容被TabBar遮挡          | padding-bottom 至少 140px + safe-area               |
| Vite HMR 动态导入偶尔失败         | 重启 dev 服务器即可，生产构建不受影响               |
| Node 18 npm 版本警告              | 升级到 Node >= 20.17.0 可消除                       |

## 配置文件位置

| 配置         | 路径                                          |
| ------------ | --------------------------------------------- |
| 前端环境变量 | `.env.development`, `.env.production`         |
| 后端环境变量 | `laf-backend/.env`                            |
| 测试环境变量 | `.env.test`（同步 .env.example）              |
| 页面路由     | `src/pages.json`                              |
| Vite构建     | `vite.config.js`                              |
| uni-app配置  | `src/manifest.json`                           |
| 服务器凭证   | `.env.server`（不在版本控制中）               |
| Electron配置 | `electron-builder.config.json`                |
| ESLint       | `eslint.config.js`（v9 flat config）          |
| Prettier     | `.prettierrc`                                 |
| Git Hooks    | `.husky/`（pre-commit, commit-msg, pre-push） |
