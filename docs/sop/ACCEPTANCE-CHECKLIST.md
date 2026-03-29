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
