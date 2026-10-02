# 测试与证据

原件首批回执恢复增量：新增28项JS专项，7文件215项相关通过；最终全量213文件/2061项通过、1文件/6项默认跳过。Python解析器原12项加新19项=31项，流水线60项通过。专项覆盖登记先于正文、登记失败零HTTP、写入前校验、实际写租约、上下文撤销、原存储切换、未知原件不清待办、关闭墓碑拒绝晚到、共享/已关联保护、恢复只用fileId、事实失败保留及逐次页面许可。实际HTTP检查Bearer/Origin/形状与存储身份；真实H5/Chrome/FileReader/Python/Poppler合成PDF10项证明首批回执丢失后刷新/重授权/查询/不重传恢复/明确关闭/删除与晚到重放。证据 `tmp/material-upload-delivery/delivery-report.json`，包括保留的失败与修正日志；不将夹具错误计作产品边界复现。

本批三端/独立后端构建、27入口、JS/Python检查与产物审计分别记录；没有完整release:gate/新云烟测或移动设备结论。固定质量210/210及84人工样例、公共14覆盖/7来源与私人17文件854卡38阻塞沿前批证据，不作本批新跑。长期512登记维护、旧新客户端混用、设备/真实语义/题库/生产仍待验。

跨窗口专项 `tests/unit/learning-crosswindow-lifecycle.spec.js` 以共享存储的实际Repository、Store与Storage事件复现。首轮21项中19失败/2通过；当前覆盖另一实例删除/恢复/撤销/同步、标记移除/保存失败/损坏、只读正文零传输、迟到健康/解析、普通学习稳定、监听清理、H5兼容缓存和初始化不误拒App元信息。旧删除测试改为仅允许严格无正文撤销标记，保留全部正文/分页清理断言；事实保存失败继续保全前态/恢复副本并撤销旧异步许可。真实双标签页、Web Locks与Python/Poppler证据另列于11及 `tmp/material-crosswindow-delivery`，回调夹具不冒充移动设备。

资料生命周期专项 `tests/unit/learning-material-lifecycle.spec.js` 使用实际Store/Repository删除与备份恢复、Vue页面、隔离Reader/微信/原生回调，覆盖迟到选择/确认/正文、换授权后恢复原值、来源列表原地改动、重复回调、新动作与旧cancel、普通学习更新。首轮29失败/4通过，之后单项连接恢复1失败/33通过，App扩展4失败/59通过均保留日志；最终结果、实际H5/Python/Poppler与构建详见11及 `tmp/material-lifecycle-delivery`。回调夹具不证明移动SDK/设备，跨窗口共享生命周期另行验证。

Apple OCR 新专项 `tests/unit/learning-apple-ocr.spec.js` 19项：能力回执、严格许可/零上传、无静默回退、旧解析器兼容、批次/续页、逐片段来源、实际Vue选择/失败重试及目标Origin。`npm run test:apple:vision` 用实际Mac SDK/Foundation/Vision/CoreML/CoreText编译并跑11项真实合成图/扫描PDF/Poppler/HTTP检查；另有Python解析12项。合成印刷中英文、空白/方向/资源/回执/原件删除只验证本机有限合同，不能当真实手写、复杂数学、模型语义或移动设备准确率。自检只对公开合成图允许首次45秒初始化；资料识别仍12秒。证据见 `tmp/apple-ocr-delivery/delivery-report.json`。

App文件专项：`npm test -- tests/unit/learning-app-material.spec.js tests/unit/learning-app-connector.spec.js tests/unit/learning-weixin-connector.spec.js tests/unit/learning-material-store.spec.js --maxWorkers=2`。覆盖能力/元信息、逐次许可、实际页面与Store、同对象令牌变化、账户/记录生命周期、取消/迟到、隐藏/卸载和失败回执零新增。`npm run test:app:material` 实际JDK/Foundation 57项文件/协调/管道检查，无网络/费用，不能代替系统文件选择器或移动安全作用域。

App连接器JS专项见tests/unit/learning-app-connector.spec.js；npm run test:app:connector用本机真实JDK/Foundation做29项回环HTTP/TLS检查，临时服务/密钥清理后保留源码哈希报告。JS合成回调、本机原生内核、移动SDK编译/插件装配和真机分别成立；缺SDK的编译入口明确退出2，不算通过。合同与运行条件见[09B](09B-APP-CONNECTOR.md)。

当前条件先修固定集tests/fixtures/learning/condition-diagnosis-v1.json为38项人工独立期望：24项蕴含/反例、14项原答差异候选；原172项保留，共210/210、84人工复核。45项新专项加已有先修/条件共129项相关通过；最终全量207文件/1854项通过、1文件/6项默认跳过。覆盖任意有效反例、开闭端点、数域/极点、负分母、空前件、注入、缺反例、大整数精确比较/资源降级、实际Store入口、帮助/任务、最新依据、更正、同步/备份及隐私删除。初始入口红测确认可靠条件错答无法诊断；新增大分数阈值误超既有分段资源界，保留必须降级断言并补界内精确比较，未放宽产品上限。当前证据在tmp/condition-diagnosis-delivery；结构/有限规则不证明模型语义或长期教学效果。

主观原答定位v2固定集为tests/fixtures/learning/rubric-evidence-v2.json的28项人工独立期望，含科学/历史/语言表述、重复/重叠引用、范围错配、换行空白、Emoji/代理对、伪造权威/附近原文与疑义降级；固定质量合计172/172、75人工复核。42项新专项另覆盖真实工具/Store、完整疑义背景、旧v1冻结、升级前旧工具重试、备份重建、资料删除和确定性重试耗时。初始全量复现收据动态耗时导致幂等冲突，修复后新耗时测试与最终全量通过；未放宽同ID改写门禁。当前命令、失败修复和实际本机证据在tmp/rubric-evidence-delivery。只验证合同与可追溯范围，不证明实际模型语义准确率或全学科质量。

条件关系固定集为tests/fixtures/learning/condition-v1.json的30项人工期望，纳入evaluate-learning后总144项；47项需人工复核，不是语义/全学科准确率。learning-condition专项另覆盖81组独立阈值公式、极点/二次独立公式、边界反例、整数空区间、伪造分类/定义域、低层提示、Store/备份、更正及资料删除。首轮一致性测试误用不存在的Store方法已修正为实际公开入口；产品门禁未放宽。当前日志与真实本机证据在tmp/condition-delivery。

微信连接专项：`npm test -- tests/unit/learning-weixin-connector.spec.js tests/unit/learning-material-store.spec.js tests/unit/local-model-connector.spec.js tests/unit/learning-material-deletion.spec.js tests/unit/conversation-learning.spec.js tests/unit/learning-ui.spec.js --maxWorkers=2`。覆盖实际Store/页面隐私组件、旧SDK/PC/App拒绝、精确授权/令牌、manual重定向、UTF8/响应硬上限、正文超时/取消/迟到回调，以及读取前后文件大小/修改时间/编码与逐次许可。真实HTTP使用RequestTask形状桥接到隔离Node/Python和合成上游；九项通过不意味着在微信SDK或设备运行。当前逐命令证据在tmp/weixin-connector-delivery；真机仍需合法域名/HTTPS、手机到电脑的真实可达性、Origin头、隐私拒绝/同意与设备文件读取。

当前先修v2固定集为tests/fixtures/learning/prerequisite-v2.json的26项人工期望；覆盖符号/进位、区间边界/方向/临界值、方程漏解/原定义域/数域、化简限制及必须降级的输入。evaluate-learning把它纳入同一固定报告，原88项保留，共114项；候选题的题干/独立答案与原答状态分别检查，不能用生成器自身输出充当期望。专项还验证原方程完整解集变式、v1冻结回放、备份/同步、更正、帮助与伪造依据；当前逐命令结果在tmp/diagnosis-evidence-delivery。该确定性报告不证明模型语义、因果效果或长期掌握。

以下教学后续观察数量为前序批次历史快照，当前验证以11及最新交付报告为准。

教学后续观察专项：`npm test -- tests/unit/learning-teaching-observation.spec.js tests/unit/learning-teaching.spec.js tests/unit/conversation-learning.spec.js tests/unit/learning-rhythm.spec.js tests/unit/learning-inequality.spec.js --maxWorkers=2`，当前93项通过。覆盖仅选方法/口头懂了不算效果、失败/历史交付、帮助/变式/原题重做/到期边界、不同对话/父链循环隔离、当前判分更正、持续用户方法锁、模型越权和实际统计组件。第一轮6项失败及两处实现/四处测试修复分开留证；不修改原有门禁。

该增量最终`npm test -- --maxWorkers=2`为1655通过/6默认跳过，本机JWT/HTTP/Mongo6项与H5无模型连续受阻→实际换法→用户直接讲解保护→独立变式→统计/返回/刷新/授权同步分别通过。证据在tmp/strategy-delivery；三端构建/产物和独立后端27入口分别记录，仍不替代供应商/设备/长期教学效果。固定规则与评分合同集仍88/88、33人工复核，不把新增教学单元测试数加进该质量分母。

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
