# T2 写作量规骨架 + T5 工程评测集 v1

事实：三套独立写作量规与冻结工程清单已落地，独立 runner 通过；真实效果为 `real_effect: unavailable`。本轮复用工作树已有量规草稿，补齐校验与回归检查；没有考试评分准确率、≥80% 达标或相关性结论。

- T2：[量规数据与校验](../laf-backend/functions/_shared/writing-rubrics.js)包含英语二 A 节10分、B节15分及语文60分。每套都有维度、分档、权重、证据要求、学生得分点及原创合成微练习；分别5/5/6个得分点，每点一练。均标注「AI 评估，不是官方分数」、草稿未审核。
- 英语分值和五档区间复核自[清华大学出版社试读103886-02，表1.1](https://www.tup.tsinghua.edu.cn/upload/books/yz/103886-02.pdf)物理页2–3；正文提及2023大纲，版次/出版年未核实，当前年份官方原文未验证。描述为项目归纳；内容/语言/衔接/语体/读者效果五项是观察点，权重为项目暂定关注比例，整体分档，不生成虚构的官方分项分。
- 语文采用基础40分（内容20＋表达20）及发展20分。范围与分档转录依据为[成都市2019级三诊评分意见副本](https://www.jhgk.cn/upload/file/20220509/1652076774591008712.pdf)物理页3（路径日期2022-05-09）；非本年高考官方细则，地区/考试年份适用性保持未知。发展「深刻/丰富/有文采/有创意」整体观察，不拆成四项各5分；未启用地区扣分规则。
- 反篇幅条款：无有效信息增量不因字数加分，事实错误/任务缺失不由篇幅或辞藻抵消，依据绑定当前题目/原答，未知分及缺项总分为null。已验证的是数据条款不可缺失，语义抗骗能力未验证；六类成对变体仍待补齐。
- 兼容：保留旧0–30分、最多6维、半分合同及既有记录；coach四维反馈仍为辅助观察。不做自动换算、不接模型或教学主流程；后续接入须单独设计有版本的评分/证据合同。

- T5：[冻结manifest](../tests/fixtures/evaluation/engineering-v1.manifest.json)保留原case ID及命名空间、文件/版本/provenance、明确期望（含错误、null、引用范围、原答保存和反例）、分组及泄漏分组、文件字节SHA-256与规范JSON条目SHA-256。
- 11 JSON共308条：quality14、rubric6、rubric-evidence39、algebra32、inequality36、prerequisite26、condition30、condition-diagnosis38（24 probe＋14 diagnosis）、quadratic40、quadratic-diagnosis40、material7。英语图52题（26主测/26降阶），数学图18题（9/9）；三类数量分开报告，不当作独立学生样本。
- 每条均标注合成工程回归与 `real_effect: unavailable`。真实独立已评分作文及专家根因轨迹均为0；没有校准/验收效果切分。同一作者套件保守同组，图主测/降阶同能力点同组。
- [清单校验模块](../scripts/eval/engineering-v1-manifest.mjs)同时冻结202个可达本地实现/测试/配置/锁文件版本哈希，覆盖当前未提交工作树；仅有HEAD或manifest不能恢复源码，合入时须连同引用文件保存。漂移会失败，不在runner中自动重建基线；后续变更应审查后发布新版清单。
- [独立runner](../scripts/eval/run-engineering-v1.mjs)在自有临时cwd运行既有301条确定性脚本；7条资料流程、图引擎及写作/原答引用等走已有隔离单测。保存逐条回放结果、测试输出、子进程PID/起止时间/退出状态到独立[机器报告](../tmp/engineering-eval-v1/report.json)。图题冻结及图引擎合同通过，不等于70条真实学生诊断轨迹通过。

验证事实：完整runner通过301/301回放、10个文件310项单测；新增量规7项、manifest13项（含篡改数量/ID/哈希/来源/期望/分组/效果声明拒绝）。首轮新增manifest测试的浏览器URL环境问题已改为Node环境并复跑通过。格式检查、文档链接检查及 `git diff --check` 通过。

复跑命令：`YOZI_ISOLATED_BUILD=1 node scripts/eval/run-engineering-v1.mjs`；只读核验：`node scripts/eval/run-engineering-v1.mjs --validate`。相关单测使用现有 `npm test -- tests/unit/engineering-eval-v1.spec.js` 亦通过；完整runner使用同一现有Vitest入口，不加载私有env，不传账户/模型凭据。

事实：旧 `tmp/adaptive-learning/quality-report.json` 前后SHA-256均为 `2986144188b8c11364b5705e4477a7f272f0eec2b95ec4f931a04e4c5a2df54e`。零新增依赖、零模型调用、无生产写入；未改src/或新增主包导入，没有重建H5/微信/App，故不新增这些端的验收结论。

后续T2：由教师审核适用年份/地区量规及暂定权重，补带分数来源的真实答卷、逐维依据与双人盲评裁决；按盘点建议准备24篇小样本、作者隔离及各方向至少6对反篇幅变体，先冻结容差再验收。现有参考范文/图表冲突候选继续隔离，不充评分标杆。

后续T5：补齐真实四科专家根因轨迹、已评分作文及原408失败输入/响应；与本工程集分别版本化和报告。新数据可用前保持真实效果不可用，不用当前工程通过率代替诊断、评分或学习效果。

资源收尾：复用现有Node、Vitest和依赖，没有服务、浏览器标签或App窗口接管；本轮runner子进程正常退出且回收，自有`.run-*`临时目录已删除，保留独立报告、旧质量报告、用户原件、既有候选/回滚材料及并行任务资源。未清理归属不明的历史资源。

附录路径：上述三个实现/数据入口、两份新单测 [writing-rubrics-foundation.spec.js](../tests/unit/writing-rubrics-foundation.spec.js) 与 [engineering-eval-v1.spec.js](../tests/unit/engineering-eval-v1.spec.js)，以及本报告；施工依据为[数据盘点](2026-10-22-eval-data-readiness.md)。没有新增第三方组件或依赖许可事项；路由方负责审查日志与任务板。
