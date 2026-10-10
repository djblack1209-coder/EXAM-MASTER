# 测试与证据

本文说明怎样验证、各测试负责什么、证据如何分级，以及当前仍未关闭的验证问题。各阶段的逐次测试数量、浏览器快照与资源回收明细属于历史记录，见 [12](12-CHANGELOG.md) 与 git 历史（2026-10-10 精简前完整版本见提交 `77093a22`）。

## 最近一次阶段验证（2026-10-09，语法帮助）

当前 `grammar-help-candidate` 三前端与独立后端编译、准确目录审计通过；相关检查 387 项（331 项/10 文件 + 56 项核心边界/5 文件），末次后端提示用词修复后 28 项接口复测通过。真实 Express/JWT、隔离随机 Mongo 命名空间与固定 LanguageTool 6.6 基本规则通过实际 HTTP：要求 JWT、未同步不初始化、精确原答绑定、相同重试无学习写入、错账户/原答/地址拒绝。

实际浏览器核验：明确提交英文原答后检查得到 go→goes/went 一条帮助；草稿与重复检查不新增原答或帮助；引擎不可用时原题/原答/判分/帮助保全；取消后迟到结果不入本机；明确重试成功；授权同步后本机完整核心与独立 Mongo 相等，正常关页重开后仍相等（3 原答 / 2 帮助 / 0 复习）。正式证据为 `grammar-browser-state.json`、`grammar-database-state.json`、`grammar-help.jpg`、`grammar-reopened.jpg` 和 `server.json` 的 grammarHelp，位于 08C 所述证据目录。

2026-10-10 清理后（删除未注册旧页与无引用模块）的完整回归：4291 通过 / 6 原跳过 / 1 失败（下述已知超时），H5、微信、App 三端构建与产物审计通过。

## 已知未关闭问题

- **语法引擎冷加载**：LanguageTool 在 15 秒检查上限下冷加载多次超时（一次 16198 ms / 500，一次并行构建时），首查约 9—11 秒，后续短句 0.07—0.19 秒。失败回执 `grammar-http-cold-failure.json`、`languagetool-cold-timeout.json` 保留；限额不放宽，原因待查。
- **整组运行耗时**：`learning-history.spec.js` 的"五 MiB 隔离存储可保存两万操作"在整仓回归中超过 20 秒门槛（2026-10-09 整组约 58 秒，2026-10-10 全量仍复现），单独复测约 10.6 秒通过。独立测量显示构造两万操作的时间约 94% 花在反复复制隔离快照；系统负载和内存压力是候选原因，尚未证明唯一原因。既有 20/10 秒门槛不放宽。
- **页面缓存**：正常重开仍可能先取到旧页面，普通刷新能取得最新版本，尚未宣布解决。

## 本地验证

```sh
npm test -- tests/unit/learning-backup.spec.js tests/unit/conversation-learning.spec.js tests/unit/learning-ui.spec.js
npm run lint
npm run lint:tooling
npm run format:check
npm run audit:repository
npm run build:h5
npm run build:mp-weixin
npm run build:app
npm run typecheck:backend
npm run build:backend
```

命令先核对[08C](08C-SCRIPTS-REFERENCE.md)的副作用。涉及不同输出目录的构建顺序执行，避免同一产物被并发覆盖。后端 HTTP/Mongo 测试只用隔离数据库、合成身份，不能推断生产登录或数据恢复。

## 职责

- conversation-learning：10/6 计划、6/2 首答、歧义、提示修正、重复操作、争议更正、时区、同步及生命周期。
- learning-backup：预览无写入、原始事实重算、重复恢复、并发旧预览、账户隔离、敏感字段/原型攻击、超限、保存中断及撤销。
- learning-provider-ledger / endpoints / sync-subscription：provider 能力、SSRF、结构化输出、分账、预算预留/结算/取消、周边界和服务端回调。
- learning-ui / rhythm：真实组件入口、导航焦点、连续状态与用户方法偏好；端到端另看浏览器证据。
- learning-rubric：版本/维度/满分/原答引用、模糊条件、评分重试、仅评分修订帮助与首答、恢复重算、云端完整上下文、实际页面与统计共享；rubric-v1 的6项独立合同样例不证明模型语义效果。
- quality-v1：客观/计算/主观/含图、不同基础、识别歧义和攻击输入，有限独立答案与明确评分依据；evaluate-learning 记录结构、核验和人工复核需求。
- Python 资料工具：来源角色、区域、不确定条件、质量门禁和隔离恢复。
- learning-continuity：真实 auth Store 退出/归属切换、延迟写入保全、访客迁移及同日计划并集、冲突双方保存/采用/恢复、旧预览、取消、晚到同标识冲突与云副本删除。
- local-model-connector：真实 Node HTTP 与隔离上游，目标/型号/来源/令牌隔离、同请求并发去重、超限、超时复用和客户端响应长度限制。隔离上游不冒充真实模型。
- learning-material-deletion：资料范围预览/确认/取消、编辑缓存、原事件与导出脱敏、计划分母、保存中断恢复、旧备份与迟到请求、首次/重复/多设备同步、连续多资料删除、原件待办/重试/匹配回执、不同解析器原件隔离。
- learning-material-store：新/重复/变更提取的关联历史、恶意页图拒绝、晚到响应不跨账户，以及真实页面取消确认不调用解析。
- verify-backend-http：固定本机 Mongo、原生后端进程和合成 JWT；鉴权、CORS、资源限制、真实 10/6 与 6/2、重复上传、用户隔离及同标识冲突共 13 项。

小样本通过不能证明全学科教学效果、长期掌握、利润或合规。独立验题器覆盖以实际实现为限；含图/主观评测不因结构通过就称答案可靠。

## 证据分级

源码实现 → mock/隔离测试 → 真实依赖调用 → 真机 → 可公开发布。每级独立报告。真实模型测试需要已授权上游费用与调用预算；没有设备、支付账户、生产前态或题源，标记对应阻塞，其余本地开发继续。

当前功能交付日志、基线、浏览器截图与报告在 tmp/function-delivery/；文档/品牌前序证据在 tmp/rebrand-rebuild/；此前真实 BYOK 的脱敏证据在 tmp/free-api-closure/。当前测试数量和结果由[11](11-RELEASE-NOTES.md)引用实际报告，不写固定数量承诺。release:gate 包含外部业务验收，不在无授权时新增云调用。

先前空间维护删除过编译目录，本轮功能验证已重新生成一套当前产物。历史构建通过不能代替当前设备/部署验收；本机隔离 H5 产物绑定测试端口，不能直接部署。

资料删除当前证据在 `tmp/material-deletion/`；真实本机 PDF/解析器磁盘删除与鉴权后端单独验证，H5核对范围预览、取消、时区与删除前后记录。页面确认逻辑由实际组件测试覆盖，不把隔离测试账号或合成记录当生产验收。

主观评分证据在 `tmp/rubric-delivery/`。真实Mongo/HTTP重放与手工独立评分合同验证，不调用模型推理；云模型传输/工具执行使用隔离响应，不能称真实模型评分已通过。evaluate-learning 合并确定性与主观合同集，结构成功率不能当真实模型成功率，语义准确率/长期效果/真实成本继续留空待验。

精确代数验证：`learning-algebra.spec.js` 覆盖人工独立固定集32项及语法/资源/原定义域/伪造依据/自然答绑定/变式/教学/记录/恢复/来源门禁。`evaluate-learning.mjs` 合并该集；合同成功率不等于模型结构成功率。独立 Python Fraction 按固定二项式、商式与线性根公式进行54次次级差分核对；这些采样不用于生产恒等判定。证据在 `tmp/algebra-delivery/`，保留失败修正后的最终日志。真实隔离 Mongo/鉴权HTTP 和真实 H5 各自报告，未调用模型推理。

## 长历史专项

`learning-history.spec.js`16项覆盖600条消息的分页/旧raw、恢复共享、写入与清理中断、只读写者隔离、取消/超时/篡改/陈旧预览、较大访客计划合并、隐私删除及整本机删除、紧凑确认/陈旧分页与50条页面窗口。`learning-history-server.spec.ts`4项覆盖旧raw/gzip、解压上限/篡改/归属、版本分页、CAS与重复/墓碑。真实Mongo专项共4项，默认全量跳过，另以固定隔离库运行通过；实际HTTP基线13项保留。

夹具为自写整数加法独立答案及重复长消息，仅验证规模和一致性，不能作为真实模型或学科质量样本。622操作、600消息、1885928逻辑字符经本机后端完成7批确认和16页读取，重复不增revision；H5新增闲聊后603消息/626操作，恢复空隔离状态与实际同步服务端同为7作答、首答2/6、计划6/10。证据在`tmp/history-delivery/`；全量1511通过/4跳过、真实Mongo4/4、HTTP13/13分别报告，不能合算成生产用户通过数。

本机执行一次后端全流程3323ms/进程heap31MB，626操作恢复/读取核对2785ms；均为该夹具一次观测，不是设备或最大容量性能承诺。浏览器重复预置两套分页触发真实配额失败，去掉隔离入口的重复副本后保存/重开通过；保留失败与修正证据，不用mock替代。无新模型推理、收费或生产写入。手写/含图、真实模型、设备与更大真实历史另验。

流式专项覆盖实际UTF8逐字节/所有切分点、完整EOF、型号/请求绑定、截断、非法工具/事件、跨段密钥脱敏、H5 Reader及微信原生chunk隔离适配、预览不落事实、重开只读结果恢复、授权/隐私/取消/迟到响应、背压、跨用户取消、配置变更和已知未调用/未知供应商成本。命令：`npm test -- tests/unit/learning-stream.spec.ts tests/unit/learning-stream-store.spec.js tests/unit/learning-stream-runtime.spec.ts tests/unit/learning-endpoints.spec.ts tests/unit/free-model-presets.spec.ts --maxWorkers=1`。

本机TLS夹具、真实HTTP/Express/Mongo和浏览器是隔离执行证据，不是供应商成功。测试进程的DNS/socket注入只映射自产测试上游；源码公网SSRF、固定DNS与TLS校验不改，不采用生产allow-local开关。夹具无真实用户材料/密钥、无外部费用；当前证据在tmp/stream-delivery。桌面高负载首次回归的大历史时间预算失败单独留存，收紧本项目并行后重跑，不通过放宽产品预算或停止其他项目掩盖。

高负载回归进一步定位到逐消息复制与全量序列化的开销，已增加共享reducer的有界隔离重放批次：每批只复制一次，消息追加使用精确JSON长度增量；其他操作仍完整计算，逐操作守容量/幂等/业务边界，任一失败后不能提交批次。普通单次写入仍先复制，恢复/同步最终只在原原子入口保存。未放宽2秒普通恢复校验、120秒长历史预算、600万字符/2万操作或服务端CAS约束。专项对比纯reducer结果、输入不变、失败整批拒绝和容量边界；历史夹具/隔离HTTP适配使用同一批次实现。

本批补齐模型缓存隐私验收：纯账本/鉴权端点覆盖缓存清除、晚到结算、用户隔离、无效资料批次拒绝、重复墓碑不删后续结果，以及跨文档后一步失败后的重试；真实Mongo专项增至5项，其中包含CAS并发删除/结算。默认跳过这些固定隔离库用例，另行实际运行；早期4项结果仅属于前序快照。

上游依赖补丁专项对真实Babel执行包内map往返与绝对/父目录越界输入，对CSS选择器执行正常序列化与深层AST序列化/遍历/复制有界拒绝。生产依赖审计与全依赖审计分别记录；全依赖报告仍有开发工具链风险，不用生产零漏洞替代全部通过。保留首次安全门禁失败和补丁后复验。

## 恢复资源与依赖增量验证

专项入口：`npm test -- --maxWorkers=2 tests/unit/learning-model-resources.spec.ts tests/unit/learning-endpoints.spec.ts tests/unit/toolchain-compatibility.spec.js tests/unit/build-dependency-security.spec.js`。覆盖UTF8容量、缓存过期/淘汰/同ID恢复、旧数据维护、并发账单、异常大usage/未知计费、无效配置调用前拒绝；实际依赖验证查询字符串、符号链接复制、序列化注入、两代本机WebSocket、PNG/JPEG/HTTP与微信QR、受限解析攻击。

证据在tmp/resource-delivery。真实本机Mongo 6项、HTTP 13项和缓存HTTP 3项，与模型mock分开；缓存HTTP使用合成数据库正文，没有供应商调用。H5实际读取用量/资源边界，在缓存过期时仍能免费开始本地练习、记录可靠错题并刷新保留，纯查询/作答未发起proxy-ai。H5截图在最后file-type适配前完成，业务代码未再改；最后依赖版三端构建和图片/二维码回归单独记录，不据此称真实设备或模型通过。当前数量与逐命令结果以[11](11-RELEASE-NOTES.md)及机器报告为准，前序流式1549项/22风险属历史快照。

页图增量专项命令：`npm test -- --maxWorkers=2 tests/unit/learning-vision.spec.js tests/unit/learning-vision-store.spec.js tests/unit/learning-endpoints.spec.ts tests/unit/free-model-presets.spec.ts tests/unit/learning-material-store.spec.js tests/unit/learning-material-deletion.spec.js tests/unit/learning-stream-store.spec.js tests/unit/learning-backup.spec.js`。覆盖头部/编码/大小/来源、独立图像授权、角色/疑义/区域、工具注入拒绝、待结算、普通文本不冒充图片能力、重复/恢复/备份/删除。证据在tmp/vision-delivery，实际本机HTTP/TLS/Mongo夹具和H5操作单独记录；合成页图与结构输出不是OCR/语义准确率评测，也不是实际供应商成功。首轮断言/响应式复制修复记录保留，后续高负载超时不能改写成全量通过。

一次不等式固定集inequality-v1包含36项人工独立答案，专项覆盖区间并集空隙/重叠/端点、方向、分数、常数、范围外/攻击、来源重建、实际数轴、帮助/首答/计划/恢复/同步；88项合并固定合同报告仍只证明有限确定性与安全降级，33项需人工复核，不等于真实模型语义效果。合并代数/不等式案例ID带版本前缀，避免同名攻击样例失去追溯。次级Python Fraction独立公式核对112个系数/方向案例、336次断言，采样不用于生产判分。原测试误将未检验知识点要求为状态对象，实际系统仅由有效证据建立状态，修正为不产生判断；保留失败日志。证据在tmp/inequality-delivery，命令：`npm test -- --maxWorkers=2 tests/unit/learning-inequality.spec.js tests/unit/learning-algebra.spec.js tests/unit/learning-teaching.spec.js tests/unit/learning-quality.spec.js`。
