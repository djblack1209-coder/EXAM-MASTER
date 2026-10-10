# 脚本与依赖维护

## 2026-10-09：语法帮助候选与可选本机服务

当前grammar-help-candidate/dist/build/{h5,mp-weixin,app}及backend；末次后端用词修复重新编译/打包，三前端未变。前端上一份remaining-view保留，bank-original/backend为必要基线；更早cache/dist/build可再生副本已核实替代、无句柄/页面消费者后移除，历史回执保持原时间点，不宣称旧目录仍当前可用。

可选服务仅后端环境LEARNING_LANGUAGE_TOOL_ENABLED=true和LEARNING_LANGUAGE_TOOL_URL=http://127.0.0.1:51740/v2/check，默认关闭。复用languagetool-trial/LanguageTool-6.6与原COPYING/各库和词典许可；现有Java运行languagetool-server.jar的HTTPServer，256MiB堆/96MiB元空间/2处理器，无public/allow-origin。已验配置grammar-help-candidate/grammar-server.properties：maxTextLength=2000、maxCheckTimeMillis=15000、maxCheckThreads=2、maxWorkQueueSize=2。堆限制不等于总RSS，启动健康接口不保证语言规则冷加载完毕；限额下失败短提示，明确重试，冷稳定性继续诊断。

本轮一次性grammar-probe.mjs用完清理，UI、HTTP、数据库和实际PID/启动时间回执保持。三份随机Mongo测试命名空间已删；共享服务和现有依赖不重建、不停止。工具输入通道关闭时没有据此重启服务；用已记录PID/启动时间/命令核对后正常SIGTERM，回收退出状态和监听。日常App、设备及受保护部署未更新。[验证](08-TESTING-INFRA.md)。

## 2026-10-09：原题旧页候选与固定语法检查运行时

当前阶段候选remaining-view-candidate/dist/build/{h5,mp-weixin,app}三端及准确目录审计均通过，沿原隔离输出命令构建，后端复用bank-original且未启。旧sprint/smart视图未注册，仅组件及完整交接回归；日常App未更新。

LanguageTool固定包6.6在既有忽略目录languagetool-trial/LanguageTool-6.6复用；官方ZIP哈希、全部展开文件一致性、许可及真实10句回执均保存在同一阶段记录。使用现有Java17+运行languagetool-server.jar，256MiB堆/96MiB元空间/2处理器，本机端口51740，无公开访问或常驻服务。两个试验进程均正常回收；完整展开核验后重复ZIP与一次性驱动清理，必要运行时、原失败/成功证据和各自许可保留。timing-candidate/dist/build是被当前与cache两份候选覆盖的可再生前端输出，确认原服务/标签均已关闭且无活跃文件句柄后删除；既有历史回执不回写，证据、后端和正式归档保留。未来更新先固定官方包、核对许可与接口，再适配；不得直接修改上游文件或用公开语法服务代替本机合同。[验证](08-TESTING-INFRA.md)。

## 2026-10-09：当前缓存更新候选与未决性能定位

当前cache-candidate/dist/build/{h5,mp-weixin,app}；后端复用bank-original且本轮未启动。普通H5以现有PWA复制器准确输出public/registerSW.js，injectRegister=false、现有构建插件注入一次defer引用，prompt等待旧窗口结束。最终构建确认引导与源码完全相同；App/微信沿准确目录审计，desktop排除仍为源码合同，未据此宣布日常App已更新。

本轮临时服务51739只用于独立合成站点；完整存档、等待/正常重开/离线与下一版两文件标记试验保留。覆盖的index/SW先核验备份、恢复并哈希核对，再重新构建；备份已清理。临时服务及13个普通测试标签关闭，错误标签70由于工具地址策略暂留。容量脚本capacity-probe.mjs保持在原忽略目录，用于继续分离构造/codec与repository验证耗时；没有新增常驻服务或另一学习记录中心。[验证](08-TESTING-INFRA.md)。

## 2026-10-09：当前计时候选与资源

当前前端timing-candidate/dist/build/{h5,mp-weixin,app}，后端复用bank-original-candidate/backend；最后H5页面文件index-BlhnWOFC。最后三端按明确UNI_OUTPUT_DIR串行构建，H5复制既有CDN、微信隐私注入/准确目录审计，App采用verifyAppArtifacts准确目录导入检查，不把默认目录当本轮证据。最终292相关与前面4371完整回归的源码时间点分别记在[08](08-TESTING-INFRA.md)。

临时浏览器夹具仅使用本机合成账户/私人数据库，已有题库/原件合同，真实answer-submit及原编号重放；普通重开/刷新保持原件和用时，缓存尚待独立诊断。临时脚本/数据库已移除，端口51731/51738/27190与七标签关闭，正式快照/收据/截图在既有忽略证据目录保留；全部授权目标未完成，固定App和设备仍分别待验。

## 2026-10-09：当前原件导入与恢复安全候选

当前bank-original-candidate/dist/build/{h5,mp-weixin,app}及backend均已编译核验；后端先tsc到明确忽略目录，再package-runtime --output，最后复用既有依赖符号链接，没有新建依赖环境。4353完整/6原跳过属于原件合同及旧标号修正后；浏览器发现存储归属与零号回执后分别追加203、60、323相关，最终构建/真实接口/浏览器对应最终源码，没有称此前全量覆盖后续改动。

本轮独立Mongo27190、API51731和预览51738已正常退出；共享Mongo852、日常App、模型/原件与必要恢复保留。15完整快照、正式产品导出及独立Mongo观察保留；移除独立测试数据库和临时脚本/页面，详细逻辑字节与可用空间变化见现有server.json.bankOriginalsAndReadSafety。后续用当前前后端，继续耗时/容量与剩余模块、设计、设备，完整目标active。

## 2026-10-09：当前组题交接候选

当前前端 `review-handoff-candidate/dist/build/{h5,mp-weixin,app}`，后端继续复用legacy-import且未启动。337相关/10文件，明确目录三端构建、微信注入审计与导入式准确App目录审计；没有重复整仓。测试日志、完整浏览器快照和资源收尾复用原server.json.researchExecution.quizReviewHandoff。共享Mongo852、模型/原件、日常App和必要恢复基线保留；本轮只启自有静态隔离预览，未调用真实模型或接受真实后端业务。完整目标仍active。

## 2026-10-09：当前旧查看自评候选与资源

当前legacy-review-candidate/dist/build为三端前端，后端复用legacy-import编译且未启动；依赖/模型/日常App不换。305相关、报告文案8项及私人归一化重放36项分别验，相关范围含原可靠教学/到期复测/备份，非整仓重复。三端按明确UNI_OUTPUT_DIR构建、微信隐私注入/审计与导入式准确App路径审计。

临时单进程51735以同一已有QA模式模拟合成账户学习根写入故障和比对完整事实；正常关闭/明确resume恢复/自评/完成/退出成立，0原答/复习，旧卡片和题库恢复资料保持。三标签/预览退出、合成存储和夹具清理，六份完整状态与截图保留，沿同一server.json登记，整个目标继续。[验证](08-TESTING-INFRA.md)。

## 2026-10-09：当前收藏前端候选与浏览器资源

当前favorite-candidate/dist/build为三端前端，后端继续legacy-import已验编译，本轮未启动。沿既有UNI_OUTPUT_DIR、隔离API参数、微信隐私注入/审计和导入式准确App审计，不新增依赖、常驻服务或可启动App副本。核心批4299完整与最终302相关/三端/浏览器分别记录，避免把早前完整回归当成后续页面改动的证据。

临时单进程51734只接本轮原创合成记录，QA控制精确账户/键的写入故障和全记录比对；没有真实模型或后端。真实页面普通刷新、现有重试、正常全关闭/重开成立，首次空白未注册路由/缺帮助观察保留，无缓存绕过。核验完9自有标签与预览退出、合成存储清空，临时夹具删除；10份完整记录及截图、现有候选/必要回退保留，沿同一server.json记录资源，不新增管理体系。[验证](08-TESTING-INFRA.md)。

## 2026-10-09：当前选题候选与隔离浏览器资源

当前前端quiz-selection-candidate/dist/build含H5/微信/App，后端继续复用legacy-import-candidate/backend。三端沿既有工具指定UNI_OUTPUT_DIR及隔离API，不安装依赖或替换日常App。App审计须导入verifyAppArtifacts传真实候选目录，现CLI忽略--app-dir，不能以默认目录检查代替候选。

本轮临时单进程51733预览只用原创合成题/私有存储，不启模型/后端/收费。QA按钮执行已授权植入、完整核对与收尾；选择/提交通过实际产品控件。第一次控制页账户副本不完整，校正所有普通/加密形式再记录明确A->B前态/后态，不隐藏初次结果。核验后8个自有标签和预览退出，夹具源码删除；同一server.json与完整9份快照/截图保留证据，候选与恢复基线暂留。[验证](08-TESTING-INFRA.md)。

## 2026-10-09：当前浏览器联调与服务收尾

legacy-import-browser-probe沿既有QA/生命周期适配，真实API51732、受控代理51731、H5预览51729与自有Mongo27189；模型/支付关闭。仅对本轮batchSync模拟不可用，正常模式透传认证真实后端，文件选择器接受产品正式导出，分别比对核心/历史缓存/实际数据库。静态预览no-store及本轮URL参数用于已拥有的开发预览；没有CDP缓存绕过，正常关闭/重开成立。

UI反馈/当前列表小改只更新同一legacy-import三端输出，后端与模型环境复用。最终244相关、三端/产物检查及实际取消/失败/成功/正常重开通过；全部自有服务与三个标签退出，16个合成键清空。210445380逻辑字节合成库/重复下载删除，可用空间即时观察增加811008字节，正式核心导出及两份完整服务器/缓存证据保留。候选、已有回退和必要恢复/模型/资料/日常App保持，最终全范围清理仍在整体完成后。[证据](08-TESTING-INFRA.md)。

## 2026-10-09：当前历史导入候选及真实接口生命周期

当前legacy-import-candidate具有H5/微信/App及独立编译后端；三个前端使用明确UNI_OUTPUT_DIR和隔离API/fallback127.0.0.1:51731。后端继续既有tsc/outDir与package-runtime；后者--output必须是项目内tmp相对路径，绝对路径被拒绝后改用规定格式，编译无需重跑。封装成功再链接实际standalone依赖，未安装或改变锁文件。

真实检查沿由既有生命周期夹具改编的legacy-import-probe.mjs，启动前确认51731/27189空闲。仅自有合成Mongo和内存JWT，模型/支付关闭；先运行旧编译后端复现，再正常停止并运行当前后端，所有子进程记录PID/启动时间与终态。22请求/10组通过后父进程和子进程全部退出；没有新浏览器标签或App副本。临时Mongo和已覆盖legacy-writer前端已量化回收，541723327逻辑字节/观察可用增加401289216字节。

保留当前组合候选、quiz-original完整候选、Legacy前端/Docling后端两份真实浏览器回退与原统计恢复基线；模型、原件/许可、正式证据和日常App保留。下一阶段复用当前组合候选进行历史待办实际浏览器同步/重开，再核对是否可以减少旧回退；整个目标完成后仍统一清理。[验证](08-TESTING-INFRA.md)。

## 2026-10-09：旧写入服务层候选、复用后端与收尾

本轮前端输出为legacy-writer-candidate/dist/build/{h5,mp-weixin,app}，使用既有uni与明确UNI_OUTPUT_DIR，隔离API/fallback仍为127.0.0.1:51731；微信隐私处理和H5静态材料复制只写此候选。后端源码未变，沿quiz-original-candidate/backend复用。157相关/4237完整后，三端构建与微信/App产物检查通过，但新写入真实HTTP/浏览器接续，不能以源码替身证据替代。

测试、构建和PlantUML进程均已退出，复用固定图源、图片、Java/JAR和既有server.json/researchExecution.legacyWriterSafety，不新增常驻服务。最新服务层输出待后端整合，现有quiz-original完整候选、Legacy前端/Docling后端及原统计恢复基线继续保留为真实已验回退；整合后实际验收通过再核对覆盖并清理冗余。原模型、许可、内容、依赖、用户资料和日常App不动。[验证](08-TESTING-INFRA.md)。

## 2026-10-09：完整原题候选与资源复用

当前候选为`quiz-original-candidate`的H5/微信/App及独立编译后端；上一`legacy-mistake-candidate`前端及其所需`docling-candidate/backend`保持。旧Docling前端输出已由两份已验候选覆盖并回收；Docling/SymPy模型/运行时、原内容/许可及原统计恢复基线保留。独立编译使用既有tsc/outDir、package-runtime --output，封装前只撤去已核对的候选node_modules链接，实际依赖不动，完成后恢复链接。

沿忽略目录中的`quiz-original-probe.mjs`验证，模型/支付关闭，仅本机合成数据；HTTP/API/Mongo/三个标签及父终端已正常退出，清空21个合成键。回收542195621逻辑字节已核验冗余，可用空间观察增量350126080字节；当前候选、前一可回退版本、必要后端、模型、日常App与正式交付物保持。当前PlantUML工具继续供阶段汇报使用，无新增常驻服务；整体任务完成后再统一清理。[验证](08-TESTING-INFRA.md)。

## 2026-10-09：阶段费曼汇报与PlantUML进度图

按客户明确要求，在[13 开发计划](13-DEVELOPMENT-PLAN.md)维护阶段汇报约定和最新费曼说明，固定更新[图源](diagrams/13-progress.puml)及[进度图](diagrams/13-progress.png)。图源和图片是正式交付物，后续复用文件，不新增一套重复报告。

复用本机既有OpenJDK25.0.2，以[PlantUML官方下载页](https://plantuml.com/download)指向的MIT版1.2026.8独立JAR在本地绘图，文件17744555字节；官方发布资产SHA256为3629c9cd017c7f73e6450396eea0040216c7e1eef8473ce33cc1aad469dab2f9，下载后已匹配。渲染工具放在既有忽略证据目录`plantuml-renderer/`，供已授权的每阶段汇报复用，不改变项目依赖或整体许可，不上传项目内容。采用[官方活动图语法](https://plantuml.com/activity-diagram-beta)，不新增Graphviz或常驻服务；禁用远程资源与图内源代码元数据。

本轮首次使用旧颜色前缀时语法失败；按当前语法改用动作后的颜色标记，成功生成702×1252 PNG并检查中文、标签和阶段边界。只改文档/图，不重复运行已经通过且未改动的应用测试或构建。下载临时文件已回收，渲染命令均退出；必要JAR作为后续汇报的当前工具保留，资源记录沿`server.json/researchExecution.phaseReporting`维护。

## 2026-10-09：历史错题当前候选与资源收尾

当前前端为`legacy-mistake-candidate/dist/build/{h5,mp-weixin,app}`；后端源码未改，沿`docling-candidate/backend`复用，默认模型与支付关闭。隔离H5/API使用51729/51731，Mongo27189，仅本机合成数据。可复用夹具`legacy-mistake-probe.mjs`位于既有忽略证据目录，记录精确PID/启动时间与消费者，正常退出并回收；没有新增常驻服务或修改日常App。

本轮服务/三个标签已关闭，清空21个合成键；回收332988752已计量逻辑字节的过时OATutor三端/后端编译输出和重复导出，另清理自有合成库。此前OATutor原内容、许可、来源及回执保留，其编译输出由已核验的当前Legacy/上一Docling两份候选覆盖，原统计恢复基线仍保留。删除编译目录内的node_modules符号链接只撤去该链接，实际后端依赖保持。清理阶段遇到不存在的合成存储目录已跳过并补全记录；未捕获完整磁盘增量，不以逻辑文件字节推断释放RAM。[验证](08-TESTING-INFRA.md)。

## 2026-10-09：客户端与原生连接器资料版面候选

当前本地候选为`docling-candidate`，复用原解析服务、已固定的隔离Docling环境与模型，无新增常驻服务。App传输核心声明专用100秒解析能力；旧桥不满足合同即拒绝文件长请求，其他请求仍35秒。关闭宿主增强开关即可回退普通提取，已保存资料和原件保持；候选尚未安装至日常App或部署。

完整回归4163/6原跳过后，页面增量页码修复另通过258相关并重新构建三端。合成接口/浏览器服务和标签已退出，重复导出移出下载目录；删除544465983逻辑字节已核实合成数据和过时编译输出。当前Docling、上一OATutor候选及必要统计基线可读取，固定App、原依赖、模型和资料保留；本轮不将磁盘可用变化视为释放RAM。[验证](08-TESTING-INFRA.md)。

## 2026-10-09：私人解析器可选版面处理

沿原`private-material-parser.py`入口运行，无新常驻服务。宿主显式设置`MATERIAL_DOCLING_ENABLED=1`及三个绝对路径`MATERIAL_DOCLING_PYTHON`、`MATERIAL_DOCLING_RUNTIME`、`MATERIAL_DOCLING_MODELS`才启用；依赖与模型沿下节固定版本，当前仅macOS宿主。`/health`由隔离worker核验文件，不能用任意存在的目录冒充可用；`/parse`须另明确`ocrEngine=docling`及布尔`allowOCR`。回退只需关闭开关，保留已保存原件及待核对片段。

页数探测、转换与原页图使用自有子进程；请求断开/正常退出触发取消并等待收尾。转换、缓存和页图目录均临时，上传原件沿原存储合同管理。真实接口试验的合成存储112507逻辑字节已回收，未生成新三端候选，当前模型/环境、历史证据、两份候选、日常App与必要回滚内容保留。客户端接入仍需逐项处理35秒原生桥预算及区域预览，不以本接口通过替代真机。[验证](08-TESTING-INFRA.md)。

## 2026-10-09：Docling可选本机环境与整理

[依赖锁](../scripts/pipeline/requirements-docling-macos-arm64.txt)仅适用Python3.12/macOS14+ arm64宿主，不进入客户端依赖/主包。Docling-slim2.135.0、RapidOCR3.9.2、OmegaConf2.3.0、ANTLR4.9.3及依赖共81包逐文件锁摘要。RapidOCR3.9.2由headless OpenCV提供cv2，不并装覆盖同名模块的GUI wheel；该组合按实际调用验证，不称无差别满足两套包元数据。原venv、前端锁文件和项目整体许可不变。

安装用既有Python、独立--target、--require-hashes、--no-deps、--no-cache-dir、--no-compile。不能对全部依赖强制only-binary后接受退回旧OmegaConf的结果：ANTLR仅源码发行，先将锁定setuptools84.0.0装入隔离target，再以该target的PYTHONPATH和--no-build-isolation构建固定SHA源码包。原下载计划、失败及本地wheel摘要保留，临时安装包核验后回收，后续以仓库依赖锁为准。

结构模型只取[Heron固定版本](https://huggingface.co/docling-project/docling-layout-heron/tree/8f39ad3c0b4c58e9c2d2c84a38465abf757272d8)和[TableFormer固定版本](https://huggingface.co/docling-project/docling-models/tree/2199320848bb9a8a519d22e4b528185a4f9a6f64)的必要配置/权重，下载文件384434844字节；RapidOCR三模型来自固定wheel，原SHA与模型署名说明一致。worker逐次核对固定摘要，不在转换时自动下载或更新。Docling代码MIT、各模型卡及RapidOCR原许可/模型说明分别保存，不把代码许可扩展到全部模型/用户内容，未打包发布模型。

可选宿主项为MATERIAL_DOCLING_ENABLED、MATERIAL_DOCLING_PYTHON、MATERIAL_DOCLING_RUNTIME、MATERIAL_DOCLING_MODELS，默认关闭且无新常驻服务；回退只停用该适配，原解析器和资料保持。确认路径、无符号链接/跟踪/打开引用后删除临时安装包、旧OmegaConf和失败合成副本，共27859265逻辑字节；实时空闲110946615296→110974451712字节单列。模型（含旧RapidOCR包内模型）、当前运行环境、来源/许可、候选、日常App及回滚资料保留。全部目标完成后仍需统一核对剩余冗余。[验证](08-TESTING-INFRA.md)。

## 2026-10-09：静态带练内容维护与候选整理

函数带练复用当前领域操作、Store、历史分页/同步、Vitest及三端编译，不新增依赖、常驻服务或数据库。固定内容与适配分别位于learning-oatutor-content和learning-oatutor；原始JSON、精确版本、逐文件摘要、历史许可与本地修订均可追溯。更新内容须新增明确版本、重做依赖/来源/语义核验，并保留旧记录所需版本；不能覆盖旧快照或把上游答案转为可靠评分。回退入口时仍保留旧版本读取/重放能力及CC署名。

当前oatutor-candidate已完成54专项/4132完整、后端与三客户端构建及真实HTTP/H5同步重开；上一个compute-help-candidate保留为回退候选，reference-statistics原浏览器基线仍保留。核对相关源码摘要一致、无开放文件/端口、未跟踪及真实路径后，回收legacy-groups-candidate/dist、remote-evidence-candidate/backend和本轮合成Mongo，共542960891逻辑字节；后端只解除旧产物内的依赖链接，当前node_modules未动。实时可用磁盘106206019584→106565521408字节，和删除文件逻辑大小分别记录。

自有API52441、Mongo52417、预览52412正常退出0并回收，51729/51731/27189无监听；标签5/6关闭，14合成存储键归零。共享Mongo852、唯一日常App、源码、用户资料、许可原件和恢复基线保持。完整目标继续，全部任务验收后再统一核对剩余垃圾与冗余。

## 2026-10-09：计算参考候选与阶段收尾

认证入口复用现有JWT、learning_states、分布式限流和学习历史校验；无新常驻计算服务、数据库或前端依赖。配置示例新增 LEARNING_SYMPY_ENABLED、LEARNING_SYMPY_PYTHON、LEARNING_SYMPY_PACKAGES，默认关闭。启用前按下节固定摘要将依赖装入独立target目录并提供宿主绝对路径；回滚关闭开关即可，已保存的原答/帮助记录继续可读。

当前沿原Vitest/TypeScript/uni编译和package-runtime产出compute-help-candidate；三客户端明确隔离UNI_OUTPUT_DIR，微信隐私注入只作用于本候选。真实联调复用原Python与SymPy独立runtime、standalone依赖链接，JWT只在内存；不改正式输出/锁文件/日常App。全量4111/6原跳过与三端产物/实际HTTP及H5同步重开已记录于08。

本轮合成Mongo29文件210347797逻辑字节在正常退出及无消费者核验后删除；两个自有页面与预览/API/Mongo均已收尾，14个测试存储键归零。当前候选、SymPy运行时、原浏览器基线与恢复材料仍有后续验收用途，继续保留；不清依赖、用户资料或构建缓存。全部任务完成后再统一核对冗余。

## 2026-10-09：SymPy可选宿主运行时

新增内部learning-sympy适配器和静态Python worker，复用standalone编译；package-runtime同时复制该worker。前端、默认启动与公共HTTP端点未启用此能力。后续产品调用只使用宿主配置的绝对Python和独立packages路径，不接受模型/客户端传路径，不继承凭据环境。

固定版本与wheel摘要在[requirements-sympy.txt](../laf-backend/standalone/requirements-sympy.txt)，安装应使用现有Python、独立--target目录、--require-hashes、--only-binary=:all:和--no-cache-dir/--no-compile；原LICENSE/AUTHORS随环境保留。本轮独立安装SymPy1.14.0/mpmath1.3.0共28794326逻辑字节，现有venv、项目整体许可和锁文件不变。运行时当前用于继续接入，尚非冗余；回滚只停用适配调用，旧学习数据和既有精确校验保持。候选与每次子进程终态沿既有server.json记录，没有新常驻服务或管理框架。

## 2026-10-08：原答分类汇总的隔离验收与回收

复用 answer-submit、既有审计测试和standalone编译/打包，单次聚合与分页同账户/筛选；不新增端点、管理脚本、依赖或常驻服务。当前157相关和3后端阶段、17请求10项实际HTTP通过。打包前确认无服务消费者，只解除隔离输出指向当前依赖的node_modules链接，打包后恢复链接；未删除依赖或写正式dist，未变化客户端产物复用。

首次QA已结束退出1，问题是null筛选夹具漏计Mongo缺字段，已修正夹具而未改产品查询；首份JSON及诊断日志保留。两次独立合成Mongo数据目录用完正常回收，合计420213937字节逻辑大小；当前服务正常重开验证后也已正常SIGTERM/退出0并回收，4382/27189无消费者及监听。共享Mongo852、原失败意图Mongo材料、正式输出/依赖和唯一App均保留。没有新窗口、模型请求或费用；完整回归测试进程按PID/启动与终态收尾。

## 2026-10-08：公共书信验证复用与自有资源收尾

复用 learning-email-writing 及相关既有测试、公共参考注册表、学习后端和互动学习区，不新增常驻工具/管理脚本/依赖。当前530相关/3957完整、11阶段及实际17请求10检查；Mac继续原Tauri根、隔离输出和 --no-bundle/离线锁定参数，只保留现有QA data_store_identifier差异。当前3f候选未安装；上一476f候选按原程序摘要实际解压核验后压缩保留，候选归档不冒充固定7e完整回滚。

当前实际API与合成Mongo已正常退出回收，210090062字节合成数据库逻辑大小删除，共享Mongo不动。H5自有预览PID60073/启动20:28:14及包装60072，实际标签18→19正常重开验证后关闭；目录临时标签20也关闭。按身份/启动/参数和无消费者确认后SIGTERM，子退出-15、包装回收，51639无监听。原source-recovery-h5构建保留，未清构建缓存。

7份本轮下载逐一与保留完整记录/两张画面逐字核对后删除，另删除目录预览包装，共5441165字节逻辑大小；这不是实时磁盘或RAM变化。原网页资料、唯一App、候选、原始来源HTML、必要失败日志与指定恢复归档继续保留。正式输出/配置与暂存保护按既有基线核验，下一单元仍沿完整矩阵。

## 2026-10-08：原答接收验证与资源边界

沿既有 audit-answer-submit-idempotency、API/request-core/鉴权/分布式限流/题库安全验证；151相关与完整3942通过/6原跳过。后端复用 standalone 的 tsc --noEmit、隔离 outDir 与 package-runtime --output，只有核验无消费者后解除同一路径 node_modules 链接，打包后链接当前依赖，未写正式dist。

实际HTTP只用独立回环4382/27189和合成QA数据库，JWT签名材料仅内存/子进程环境，0模型/费用；正常关闭、等待回收并确认端口空闲后回收210257186字节逻辑合成库。共享Mongo、固定7e、476f候选和资料/归档保留。源码/日志/来源恢复材料不清，正常重开测试不代替设备或完整目标。

随后现有 practice.api/\_request-core/auth-storage 实际连接隔离 Express/JWT/Mongo，6请求7项通过：原字段/稳定编号、重传完整原回执、409、无JWT拒绝、同键账户隔离与迟到账户变化拒收。只用内存uni HTTP适配，不称浏览器/真机联调；服务器判分pending与零错题/FSRS/诊断/模型保持。首轮5项通过，内部嵌套errorType断言不属公共合同，已按失败/null数据/账户变化短句和真实数据库原账户事实复核，首份报告保留。两次合成库共回收420213948字节逻辑大小，当前依赖/源码和共享Mongo保持；原3942/8客户端未变部分复用。客户端回执呈现/其余统计、公共范文许可和完整矩阵继续。

## 2026-10-08：续答身份与重传编号，完整目标继续

复用现有Vitest、B回执与同一隔离8客户端输出；不新增常驻工具、依赖或可见.app。115专项通过，最终相关/完整按原串行参数及容量20秒运行，不能以mock请求或候选退出0代替服务端与原生实际验收。后端源码未改，原HTTP19/36为学习合同证据，不能证明answer-submit字段缺口已修复。资源用完按具体PID/启动/消费者正常回收。

所有3883/8客户端原日志与字段按before-lease-fix保留，不冒充写锁修复版。新增最小红与222专项沿既有测试文件；写锁最多等待2秒，原容量20秒、共享资源与账户/生命周期/停止合同不改。自有PID85513/启动17:28:28预览在标签15关闭后SIGTERM并-15回收，非自有标签14保留；源码/原材料/稳定C原答与回滚都保持。

新2项最小红复现onLoad忽略实际query及H5重试丢resume意图；已接宿主参数、仅当前do-quiz的H5路由四键回退，直接参数优先，其他页面不借查询串。224专项通过后再补优先/外国页面边界；写锁与补记版522相关/3894完整通过，保留为before-query-fix，最终10源码/17快照的相关、完整、8客户端与冷启动/稳定身份补记/正常重开重新执行。首次混用旧资源及原稳定C未入core的现场保持，不以正常刷新替代错误恢复验收。

最终当前范围525相关/3897完整、6原跳过（165.37秒）与8隔离客户端通过，10源码测试冻结一致；微信241主包1449804字节、12媒体132099/最大32728、含许可全部static146742及秘密/分包、App0阻塞审计通过。H5首次加载超时仍存在，页面重试保留原继续确认；明确继续本地补记原C同UUID/会话为pending，不增统计或重发API/模型。新D独立UUID仍属同一保存会话，原所有core集合前缀与218库保持；正常关闭重开16键1841071字节逐字相同，7条缓存记录（含2条自评），5份核心原答均pending、不重复补记，仍余31。只在该刷题资料范围成立，原H530身份/旧统计/后端答案真正接收幂等、Mac与设备/视觉/模型自然时间/长会话长期效果/公共许可和受保护发布继续；固定7e及1156979恢复材料未动，最新476f候选未安装，完整目标active。

## 2026-10-08：通用续答恢复，完整目标继续

复用practice/index、do-quiz、useQuizAutoSave与三个现有测试文件，13份源码/文档改前快照已核验；没有新CLI、依赖或数据库。测试沿现有Node串行参数，后端未改可复用类型/编译/HTTP；客户端继续同一source-recovery四输出、显式隔离UNI_OUTPUT_DIR，微信隐私处理不落默认正式目录，Tauri原QA差异/独立target/--no-bundle/离线锁文件保持。

当前固定7e与1156979字节/三个有效回滚保持，后续候选未经实际前态与还原核验不更新入口。自有资源按新PID/启动时间/消费者记录，当前未开原生；旧终结exec不复用，当前完整回归尚在运行。独立功能和UI/UX分别推进，窗口继续右侧。[验证](08-TESTING-INFRA.md)。

实际自评问题沿既有quiz-session-contract统一outcome，补进度/答题卡/结果、session-feedback、practice-mode-manager和现有测试，不另建工具。新增9份改前快照共22份，原6字段初版测试/8构建/原始QA移至before-neutral-review-fix记录；自有IAB11和4382 PID38796（12:43:53）已正常结束，原错误自评原始载荷保留。新15字段继续原隔离输出与--no-bundle，初版dcd41094…仅未安装候选，不作为成功回滚；固定7e不改。

本次继续沿既有Vitest、隔离8客户端输出及现有B回执。相关选择读取引用并补实际结果组件守卫；完整执行仍使用串行原参数与20秒容量界限，不放宽跳过、超时或公共门禁。365相关和新的真实组件失败/修正证据分别保留，最终完整/产物/实际重开尚在执行。

最终完整3864/6原跳过与8客户端按16冻结源码成功；最新9cdd候选仅隔离--no-bundle未安装，后端源未改复用3类型阶段与HTTP19/36。现有微信/App审计和全主包/全部static边界实际通过，正式输出未重建。自有4382预览按PID93344/启动Thu Oct8 13:27:44/根目录核验后SIGTERM，子进程-15/包装0回收；两个自有标签关闭，完整快照/归档保留。

## 2026-10-08：明确提交复用现有刷题流程

只修改do-quiz、quiz-session-contract、quiz-mistake-handler及现有三个测试文件；13份源码/文档改前快照核验。继续现有Node串行回归、source-recovery四客户端输出与素材/隐私处理，weixin-privacy明确UNI_OUTPUT_DIR为隔离微信根；不重新生成题库、改题源、安装升级或写默认正式构建目录。后端源码未改，复用上一最终编译/HTTP；原生继续既有QA差异、独立target、--no-bundle/离线锁文件。

资源沿server.json记录PID/启动时间/消费者与返回会话，本轮自有原生导出面板取消后正常退出，固定7e和完整1156979字节恢复资料保持；首轮H5标签8/4382预览PID63439（11:03:32）已正常关闭/回收。最终实操复用同一输出，当前原生候选未经更新验收不得当成功回滚。正式产物、原始PDF、共享Mongo和原失败模型材料保持。[验证](08-TESTING-INFRA.md)。

最终8隔离客户端阶段与审计通过，新未安装候选9753858d…复用同一target取代前d96候选；当前7e/1156979字节资料/三个验证归档保持。最终H5标签9/10及PID4923（11:23:11）预览正常关闭/回收，两轮预览子进程-15/包装回收，相关测试/构建均终结。八份事实快照在逐字比较、真实路径/未跟踪/无消费者核对后删除14225750逻辑字节，保留唯一前态/阶段/最终完整白名单与失败日志；未清缓存、源码、依赖、原件或必要回滚。

## 2026-10-08：中文材料论证复用当前环境

修改现有learning-writing、共享domain主题、conversation-learning入口和learning-lab中文段落标签；验证沿现有learning-argument-writing测试，没有新CLI、依赖、常驻服务或组件。12份源码/文档改前快照已逐字摘要核验；现有静态输出、desktop-fields-v3-source/隔离target与后端运行时继续复用。

新后端输出必须明确隔离，HTTP用合成账户和自有Mongo，执行前记录PID/启动时间/消费者并正常收尾；共享Mongo852及失败模型原材料保留。跨端和--no-bundle候选通过后，再核对当前7e完整记录、制作并试还原适当回滚，仅原子更新固定程序，不新增可见.app。当前归档与正式资料仍有恢复用途，不因新源码而删除。[验证](08-TESTING-INFRA.md)。

最终复用原后端隔离目录vocabulary-cross-week-backend与四客户端输出，类型/编译/package-runtime/三客户端/桌面网页与--no-bundle本地候选7387e5df…通过，不安装升级。编排的weixin-privacy阶段现在明确传UNI_OUTPUT_DIR=既有隔离微信根，补跑后审计通过；默认正式app.js仅本轮两份重复预加载尾段已依据原登记摘要精确恢复，其他6090份与5配置保持。错误阶段、隔离修正、失败媒体审计及phase修复前测试/HTTP均保留。HTTP两轮合成目录共420221891逻辑字节、四份重复导出4017671字节已在正常收尾/消费者和创建身份/逐字比较后回收；自有H5标签6/7与PID91914（10/08 10:12:02）预览正常关闭并回收，4382/51639/27189无监听，共享Mongo852保留。当前固定7e、完整1156979字节及三个有效归档、原H530身份材料保持，新Mac候选未安装。

## 2026-10-08：跨周词义复用现有开发路径

新间隔沿现有learning-vocabulary、共享domain、conversation-learning Store、learning-lab与页面包装函数，不新增CLI或依赖。默认1天/v1保持，3/7天/v2严格重建；相关与完整测试使用现有Node22串行参数，原容量限制不改。13份源码/文档改前快照已核验，正式产物和未授权源码/题源保护保持。

后端使用现有TypeScript/package-runtime明确隔离输出；客户端继续source-recovery四输出、素材/隐私审计、desktop-fields-v3-source及原QA标识差异、独立target与--no-bundle。更新唯一Mac入口前继续核验完整原记录、备份并实际试还原当前适当版本，保留成功基线，仅原子替换程序，不新增可见.app。新增资源逐项记PID/启动时间/消费者并正常回收，共享Mongo与失败模型材料保持。[验证](08-TESTING-INFRA.md)。

最终后端隔离输出vocabulary-cross-week-backend，经编译/package-runtime后仅链接现有standalone/node_modules，不安装升级。11最终阶段通过；碰撞修复前日志与摘要保留。最终Mac7e796927…已在当前95584e79…完整记录核验/归档试还原后，只原子替换固定入口程序；标识/图标/模式/xattr/文件时间及其他六项保持。HTTP16/36正常收尾，210134835字节合成目录回收；H5两来源预览/自有标签3、4、5正常关闭，完整重开重复导出与3个新下载核验后回收3822586字节，前态/当前完整记录和原始分页身份材料保留。

当前955回滚归档Yozi AI.app.zip为247252526字节/SHA693193b1…，实际CRC和7项全树/mode/链接/xattr还原相同，配对原1129028字节；AE2近期归档及压力E9指定成功基线保留。试还原未启动/注册，精确临时副本253681668字节已删除；正常退出PID82348/87566/3113均确认当前程序无消费者，自有IAB为空，共享Mongo852/原失败模型材料保留。8份完整导出在逐字比较、路径/符号链接/消费者核验后回收9170867逻辑字节，保留各唯一比较前态、停止后1156979字节正式记录及原H530身份材料；未清tmp、构建缓存、依赖或源码。

## 2026-10-08：整卷范围修复复用隔离构建

本批仅答题页加载逻辑与既有回归文件改变，不新增工具/依赖/生产调用。复用source-recovery-h5、source-recovery-mp-weixin、source-recovery-app与source-recovery-desktop-web四输出，UNI_INPUT_DIR明确src、UNI_OUTPUT_DIR限定证据根，桌面WENLI_DESKTOP=1；沿既有素材复制、微信隐私注入与预算/秘密/分包、App审计。相关/完整测试串行，容量阈值不调大。

Mac保持现有desktop-fields-v3-source Tauri根及capabilities/learning-desktop.json；继续原source-recovery-native-config、独立target/QA资料、--no-bundle --no-sign -- --offline --locked --jobs 2。8阶段及审计已完成，源码摘要一致。ae2入口回滚ZIP已CRC读取并实际还原，7项正文/模式/链接/扩展属性逐项相同；临时还原改名为非应用目录且未启动/注册，验证后回收。前压力成功归档与1129028字节完整资料另保留。

确认固定程序无消费者、当前包/配对记录/试还原归档身份一致后，仅原子替换可执行程序到95584e79…，程序模式/xattr/文件时间及其余6项清单保持，未新增可见.app。更新后正常导出/正常退出重开再导出逐字一致；两个重复导出核验后回收2258056字节，保留既有完整当前记录。IAB标签2、4382服务及两次自有原生进程正常关闭、退出核验，共享Mongo852/启动03:07:21与其他任务浏览器保持。[验证](08-TESTING-INFRA.md)、[边界](14-MODEL-PRIVACY-COST.md)。

## 2026-10-08：缺页政治参考沿现有CLI补充

现有answer_evidence_repair.py的--restore-politics-reference增加可选--supplement-source，限登记的src_c1f32165212f2a00169bb748-2023考研政治补充出版方参考.pdf，实际SHA256 c1f32165212f2a00169bb748f08082960c60420e7fa1edacca09e23f1bb99b04、10页、488334字节，补充上限1MiB。仅重读第3页固定的9–13题编号边界，核对两份阅图原参考块、A–D选项顺序及答案，补10/11；原卷题干不被补充卷的措辞/OCR覆盖。

必须沿原--question-source/--answer-source/--target合同，不与companion混用；无--write保持候选零写。已补充候选再执行时必须显式带登记补充来源，防止遗漏参数降回旧缺页证据。最终原子替换前再次读回三源身份；候选历史、模式和幂等保持。flashcard_quality按实际文件身份缓存主源/补充源，独立重读并重建完整证明；重算载荷不放行伪造参考。两公共门禁继续reference_only_authority拒绝，不登记公共许可或评分权威。沿现有Python/Node/fitz/Ruff/依赖，0安装升级、0模型调用。[验证](08-TESTING-INFRA.md)、[边界](14-MODEL-PRIVACY-COST.md)。

## 2026-10-08：政治参考恢复复用现有工具

answer_evidence_repair既有CLI增加--restore-politics-reference及必需的--question-source/--answer-source；沿--target/--write，禁止与companion修复混用。只接受两份登记raw-inbox PDF实际SHA256、11/27页和前11页文本/像素相同；此登记参考文件限32MiB，英语来源原16MiB保持。题号必须完整1–38，参考题号精确排除原文件确缺的10/11；要求整套A–D、单/多选答案形状及材料双问/双问参考，清除已确认页脚与教师附注。目标身份、证据结构和历史先校验，干跑零写、整批失败不写、同目录原子替换、旧内容历史与幂等保持。

politics-reference-v1绑定题面、选项、答案、说明、实际两源身份和参考状态；sourceRole=publisher_reference、scoringAuthority=false、rightsStatus=not_verified。Python门禁独立重读登记源并比较实际载荷；Node/Python对politics-2023保留reference_only_authority拒绝，即使候选/证明/发布标记被剥除。未自动提升、刷新来源清单或授予官方评分权。[验证](08-TESTING-INFRA.md)。

## 2026-10-07：沿现有修复工具恢复已核对原题

最终现有工具的相关99项/完整3715项与Python55项、自检通过，8隔离阶段完成，源码/编译表113库字节一致；具体日志与不完整实际边界集中在[验证](08-TESTING-INFRA.md)，不以缺空修复补齐公共许可或全部语义。

english_passage_repair沿现有--target/--source-pdf/--write增加--restore-cloze-evidence和--restore-section-evidence。完形限定2006/2007/2010的20完整题号、整套选项和来源答案；翻译/排序限定实际SHA256登记的2007/2010来源，画线句与固定顺序已读原卷。干跑零写、整批身份/答案拒绝、旧证据历史、字节变化保护、原子写和幂等保持。不自动OCR到固定共享路径、改答案/启用状态或用重算摘要代替来源恢复。

questionProof的cloze-source-v1或english-section-source-v1严格七字段，源文件只准本机raw-inbox稳定ID/年份PDF，16MiB限额、无符号链接/路径越界和实际PDF字节；后者同时绑定targetSegment/编号/fixedSequence/fixedParagraphs。Node与Python一致拒绝缺证明及漂移。Mac实操发现PDF文本层遗漏数字/OCR前缀后，完形来源限定三个登记PDF字节；仅经原页核对的1/20缺空与Bom/Spain9s/Whafs替换在对应SHA范围执行，正文3/19/20 million保持，统一[1]–[20]且拒绝缺空、重复、重排。即使重算完整载荷证明，缺空仍拒绝；旧门禁三份实际0阻塞/新门禁各1的证据保留。数学三2007生成器只为第24题从原PDF两页裁切完整题面，保存实际JPEG字节摘要，媒体200KB边界保持；未运行旧全量渲染清理。

既有generate-compressed-bank-modules在本轮自有隔离cwd读取当前源库，保留原目录，核对113解压JSON字节后原子更新当前生成表。源码和微信编译表一致，旧无图测试改为当前两张题图；日志/原失败和快照保持。复用现有Node、Python3.12、fitz/Poppler/Ruff/依赖，0安装升级；无bundle Mac隔离构建不生成可见恢复.app。[验证](08-TESTING-INFRA.md)、[矩阵](13-DEVELOPMENT-PLAN.md)。

## 2026-10-07：既有生成器摘要范围复用

两处现有题库门禁按宿主库ID登记102个历史库的11种原组合摘要格式，序列化保留Python原排序/间隔、页面引用、裁切标识、正文/选项及答案角色。普通清洗文字仍沿既有Unicode空白规则；组合格式采用各自生成器的规范化结果，不能把显示题干当全部依据，也不向调用方开放算法选择。

18个英文库复用现有生成器compact函数，现有flashcard_quality的内部--legacy-hash-batch只做本机摘要；不运行整模块或提取/渲染/写入。Node优先现有.venv-baidu/bin/python，否则使用已配置python3；项目发布链路原已依赖Python，不安装新运行时。批次2048条/8MiB、每段65536字符、10秒、1MiB回执和严格SHA256形状，所有子进程同步回收；不可用/未知源/异常回执不放行。普通质量CLI的空载荷与空有效范围拒绝保留。

当前两工具和JS测试与最终完整执行哈希一致；Python夹具仅修正缺省material的读取，另实际完成49项最终相关与自检。只改工具/测试/现有文档，无产品或来源数据改动，不重复构建、更新日常程序或开窗口。115库3981题双运行时结果相同，151源JSON/原PDF及生成器保持；3页只读PNG在查看后精确回收1698784逻辑字节。源码与缓存、成功入口/回滚、共享Mongo和失败模型原件保留。[验证](08-TESTING-INFRA.md)。

## 2026-10-07：题库摘要核对沿现有工具

question-bank-release-gate与flashcard_quality分别重算当前题干/答案摘要并拒绝所有已填写别名冲突；沿清洗器Unicode空白与UTF-8 SHA256规则，BOM不归为空白。不增加管理脚本、接口、依赖或自动修复入口；不把重算摘要当作来源/答案质量证据。

复用现有Node、.venv-baidu Python3.12和已安装Ruff。系统Python3.9最初无法导入namespace测试，记录为环境调用错误，实际红/绿及46项最终相关均以现有3.12执行；修复时Python函数插入位置错误和旧占位摘要夹具的失败保留，最终自检/回归通过。JavaScript旧CLI用例不再假设真实库摘要零阻塞，检查汇总与明细合同；当前数据不改。

flashcard_quality同时拒绝空/非数组/混合无效载荷与空有效范围；输出新增emptyScopeBlockerCount/emptyScope阻塞项，合法旧questions/顶层数组仍可读取。--fail-on-blockers对空库返回2，不以0题报告放行，也不向输入目录生成题目。

真实审计显式--output到既有忽略证据目录，--fail-on-blockers的退出2按预期拒绝记录；不运行会覆盖正式dist的完整release:gate。原始151份JSON保持；39向量只用临时合成文件，16720逻辑字节正常回收，JavaScript测试按本轮实际创建路径逐项teardown。当前程序/候选/回滚、源材料、编译缓存和共享Mongo保留，结束的exec不复用。[验证](08-TESTING-INFRA.md)、[整理合同](../tmp/AGENTS.md)。

## 2026-10-07：压强最终候选与环境复用

复用既有Node、uni、TypeScript、Cargo和依赖，压强最终8个前端/原生阶段重建、3个未变后端/题库阶段经哈希核对复用。隔离输出为证据目录下science-pressure-backend、science-pressure-h5、science-pressure-mp-weixin、science-pressure-app、science-pressure-desktop-web；正式dist保持。后端package-runtime的--output继续限定仓库tmp相对路径，不改拒绝绝对路径门禁。

Mac源码根desktop-fields-v3-source沿既定data_store_identifier唯一差异，其他Cargo/build.rs/capabilities与仓库一致；复用desktop-material-prerequisite-target、science-pressure-native-config.json与--no-bundle --no-sign -- --offline --locked --jobs 2。更新前5a816bd5…成功入口归档试还原逐文件、模式、链接、xattrs一致，并配对1053156字节成功重开记录；只原子换程序为e9c258e9…，标识/元数据/图标/资料保持，无新增可见.app。

所有shell保持login:false，结束的exec不复用；独立HTTP用合成账户/内存签名材料及独立库，不调用模型。自有HTTP与预览、标签和验证窗口用完正常回收，身份和删除清单沿现有server.json；当前候选、源码快照、当前依赖、编译缓存、原始资料与必要成功回滚保留。[结果](08-TESTING-INFRA.md)、[实际范围](06-FRONTEND-REFERENCE.md)、[整理规则](../tmp/AGENTS.md)。

## 2026-10-07：密度最终候选与现有环境复用

复用现有Node/uni/TypeScript/Cargo、源码与缓存；最终前端/原生8阶段重建，未变后端编译/打包和题库生成3阶段复用。隔离输出为证据目录下 `science-density-backend`、`science-density-h5-fixed`、`science-density-mp-weixin-fixed`、`science-density-app-fixed`、`science-density-desktop-web-fixed`；UNI_INPUT_DIR/UNI_OUTPUT_DIR与桌面WENLI_DESKTOP保持隔离，正式dist未覆盖。

QA源码根为 `desktop-fields-v3-source` 本身；main.rs只保留既定data_store_identifier差异，Cargo/build.rs/capabilities与仓库一致。Mac沿 `desktop-material-prerequisite-target`、`science-density-native-fixed-config.json` 与 `--no-bundle --no-sign -- --offline --locked --jobs 2`，不安装升级或新建可见.app。固定入口先正常退出，3211d14b…归档试还原逐文件/模式/链接/xattrs一致，配对985519字节正常重开记录，再原子替换5a816bd5…程序，其余束文件与元数据保持。

后端打包仍用仓库tmp相对 `--output`，绝对路径拒绝门禁保留；合成HTTP独立库/自有进程正常结束，0真实模型。H5三轮具体预览与自有标签、桌面正常重开验证用完关闭；资源身份与清理沿现有server.json。编译缓存、源码快照、原件、最近成功回滚及正式产物保留。[结果](08-TESTING-INFRA.md)、[实际范围](06-FRONTEND-REFERENCE.md)、[资源规则](../tmp/AGENTS.md)。

## 2026-10-07：英文正文复用隔离构建与回滚环境

本轮输出为证据目录下 `public-english-full-backend/h5/mp-weixin/app/desktop-web`，复用现有TypeScript编译/运行打包、uni与CDN复制、题库分包和隐私注入；11阶段均正常退出回收。后端编译只指定隔离outDir；现有 `verify-backend-http.mjs` 固定正式dist/测试端口，未直接用于本轮候选，沿已有忽略目录HTTP验收机制在内存运行，未增加管理脚本或依赖。

Mac沿 `desktop-fields-v3-source` 的原data_store_identifier与 `desktop-material-prerequisite-target`，`--no-bundle --no-sign -- --offline --locked --jobs 2`，无新可见.app、无正式dist覆盖。当前成功031cbff1…入口与947946字节记录已制作新归档并试还原，模式/链接/xattrs/元数据一致，未启动恢复副本，临时恢复253648644字节已回收；候选3211d14b…仅原子替换固定程序。桌面窗口捕获失败与正常回收/重开记录保留，不能以脚本成功代替桌面实操。[验证](08-TESTING-INFRA.md)、[资源回执](../tmp/visual-build-20261001/resume-rubric-evidence-20261004/server.json)。

## 2026-10-07：复用合成预热、原生对话框和隔离编译

`build:apple:vision`沿现有SDK加入CoreText；`--warmup`只识别项目内存合成文字，严格8字段回执，无识别正文。`test:apple:vision`12项真实合成检查成立，合成45秒与私人12秒分开。当前CLI源码11408f81…/程序a9d3ea88…在 `tmp/apple-vision-builds/build-Fn1d7b`，旧6bDJMT保留前态；没有新管理脚本或依赖。

本轮复用 `apple-readiness-h5`、`apple-readiness-mp-weixin`、`apple-readiness-app`、`apple-readiness-desktop-web` 四个隔离输出。桌面材料沿已有DialogExt与临时句柄，AppManifest/本地主窗口能力登记三命令，三份权限文件由现有构建自动生成；不启用通用fs/shell权限。QA源码仅加原指定data_store_identifier，沿 `desktop-fields-v3-source`、`desktop-material-prerequisite-target`、已安装Cargo及 `--no-bundle --no-sign --offline --locked --jobs 2`，无新可见.app、不覆盖正式dist。唯一入口原子更新031cbff1…，图标/元数据/标识保持，061166c0…与0d9fe727…归档已试还原。

缺Cargo路径、遗漏缓存变量、Rust测试遗漏TAURI_CONFIG及原生权限遗漏的失败回执保留；误用默认target编译已正常停止，现有/误建缓存均保留。最终完整3587/6原跳过使用既有串行参数，原20秒容量门槛未放宽。[验证](08-TESTING-INFRA.md)、[当前实操](06-FRONTEND-REFERENCE.md)。

## 2026-10-07：功与动能复用现有隔离入口

本轮复用Vitest单worker/不并行文件、standalone类型编译/运行装配、uni-app H5/微信/App、隐私注入、全主包/媒体与App审计和Tauri构建。最终输出为现有证据目录的`science-energy-h5-fixed`、`science-energy-mp-weixin-fixed`、`science-energy-app-fixed`、`science-energy-desktop-web-fixed`，后端复用`science-energy-backend-final`；源码/产物哈希核对一致，不覆盖正式dist。初版前端`*-final`被最终核验版本覆盖后按明确清单回收，日志与恢复归档保留。

原生仍`--no-bundle --no-sign --offline --locked --jobs 2`，复用已核验QA Rust源与目标缓存；11受影响阶段全部成功，不安装/升级依赖。先归档并试还原后仅原子更新唯一入口可执行程序，标识、资料、图标和元数据保持，未生成新的可见.app。

隔离HTTP沿合成账户、独立27189数据库/4382后端、原认证/限流与无平台模型/收费配置，19项41请求成立，自有进程已正常终止并回收退出状态、数据库临时数据已删除。最后H5只读静态预览GET50/POST0，正常TERM退出0且已回收，相关端口无监听；原生两实例与自有标签已正常关闭，共享Mongo892/2026-10-07 02:02:18保留。重启不复用旧会话/PID；计时探针撤除，复用[现有回执](../tmp/visual-build-20261001/resume-rubric-evidence-20261004/server.json)。[验证](08-TESTING-INFRA.md)、[资源](12-CHANGELOG.md)。

正常原图导入复用现有`build:apple:vision`/`--build-only`与Python资料解析器，未安装SDK/依赖。既有SDK编译后的当前Apple CLI在`tmp/apple-vision-builds/build-6bDJMT/wenli-apple-vision`，源/二进制摘要已核对，保留供下一冷启动就绪验收。H5与Mac先后使用精确http://127.0.0.1:51639/tauri://localhost来源和独立临时存储；合成令牌仅0600临时文件/内存，界面和测试后均清除，未入导出/日志。两个解析器正常SIGINT退出−2并回收，预览退出0；临时存储和原件已确认回收，当前普通Mac两实例/自有标签正常关闭。

## 2026-10-06：隔离科学构建与唯一Mac入口

本地验收复用既有uni/Tauri工具链，不安装或升级。H5/微信/App与桌面分别指定`UNI_OUTPUT_DIR`至现有证据目录science-motion-\*，随后运行已有素材复制、微信隐私注入/完整主包与媒体检查、App产物审计；后端tsc --outDir与package-runtime --output也隔离，先打包再链接既有运行依赖。标准npm构建会写正式dist，不用于这批隔离核验。

Mac复用已适配Rust源树、隔离frontendDist/QA资料与既有CARGO_TARGET_DIR，调用现有Tauri CLI加`--no-sign --no-bundle -- --offline --locked --jobs 2`。只生成程序；更新前ZIP试还原核对全部正文/权限/链接/扩展属性，确认无当前程序消费者后，在.noindex暂存原结构，仅替换程序并原子更新`/Users/blackdj/Applications/Yozi AI.app`，核验后收回暂存。Info/标识/图标/资料与正式App/DMG保持，不留下额外同名.app；无需重新注册整个系统数据库。最终串行回归、HTTP、实际系统保存/停止重开及未验范围见[08](08-TESTING-INFRA.md)、[06](06-FRONTEND-REFERENCE.md)。

## 可选本地演示渲染（2026-10-05）

`node scripts/build/render-learning-visual.mjs --check --engine manim` / `--engine blender` 只探测已有工具，不安装依赖或联网。缺引擎返回 `RENDERER_UNAVAILABLE` / 退出2。本机 Manim 不可用，既有 Blender 可用；视频实际来自后者，不能把固定 Manim 源码导出称为 Manim 渲染验收。

显式渲染使用 `node scripts/build/render-learning-visual.mjs --engine blender --recipe tmp/本次参数.json --output tmp/新的独立目录`。参数 JSON 限4096字节并按 [04](04-API-DOCUMENTATION.md) 校验；仅模板/有界整数，无模型代码或URL。输出必须为本仓库 tmp 中全新目录，不能覆盖正式产物、已有任务或借符号链接越界。Blender 按后台/出厂空场景/禁止自动执行/两线程启动，固定144帧后由已有 FFmpeg 编为 H.264；单步骤限时，正常停止后等待，必要时仅升级终止自身子进程。保留 job.json、固定生成源码、场景与视频，核验导出可读后回收可再生帧。

当前已生成 `src/static/learning-media/distance-return.mp4`（640×360、24fps、6秒），不包含模型调用或用户资料。微信媒体预算现在也计算 mp4/webm，不能靠忽略视频扩展绕过200KB合同；仅微信产物把当前品牌导出替换为专属128px图标/768px插画，网页/App源素材保持完整。隔离构建须明确 `UNI_OUTPUT_DIR`，再运行隐私注入、主包全文件/媒体审计；标准 npm 构建入口会写正式目录，不能用于本批隔离核验。

现有 `deploy/tencent/scripts/prepare-backend.mjs` 仅在 VPS-Config 冻结维护租约内运行准备/恢复、保留备份恢复、新候选暂存及限定身份索引迁移。`stage-candidate` 复用已接受私有库，在事务独立目录/命名空间验证候选；`recover-candidate` 核对所有权后只回收自己的候选资源。`check-prepared / check-candidate / check-identities` 只读核对原服务、主库、归档、已接受索引及清理事实。维护程序先以文件保护更新，再单独应用候选归档，保证文件先恢复时仍有匹配的恢复程序；原 `prepare` 不能重跑到已有服务树。所有变更继续经过既有 `maintain-files`，这些入口没有公网切换或公共题库导入能力。当前实际暂存/回退与索引验收见[09A](09A-LAF-BACKEND-DEPLOYMENT.md)。

`migrate-identities / recover-identities` 只针对已核实的新私有空主库，分别从同哈希已暂存候选调用九项 `scope:"user-identities"` 与独立 `scope:"desktop-oauth"`，使用实际应用账户权限；固定子进程不继承模型、SMTP 或 OAuth 配置。当前 `wenli-backend-stage-v2` 绑定全部归档文件指纹和前一项接受回执的原始哈希，旧八项记录保留为来源；新回执按完整候选哈希独立保存。修改前持久保存完整原索引/非索引指纹及短期集合状态，提交回执原子且拒绝覆盖；成功后只读重放当前回执。恢复只删除原快照没有且完整定义一致的新增索引，并仅删除本批新建且仍为空的短期集合。原邮箱/\_id、旧八项与并发新增记录、外来索引/配置不覆盖。默认 `simple` 排序的显式/省略形式仅用于新定义准入，冻结的原 metadata 仍精确比较。原有真实私有库/配置恢复材料被维护事务冻结哈希并交给独立观察者；本次无本机业务状态写入，本机恢复命令仅返回成功，实际服务端恢复由 `recover-identities` 完成，不把本机空操作当数据库恢复。新增主库记录或前态变化时拒绝继续这项限定准备，不能重跑整库迁移绕过。

客户已采用 Tauri 2；桌面入口复用现有 uni-app 构建，产物与普通 H5 分开，锁定 `@tauri-apps/api` / CLI 2.12.1，并保留 `src-tauri/Cargo.lock`。Node/npm 继续按 package.json，Rust 至少 1.90；本机使用 Rust 1.93.1。macOS 需要 Apple Command Line Tools，Windows 需要 Rust/C++ Build Tools/WebView2；不自动安装系统工具链、签名或发布。Mac 本批构建依赖保留未剥离的 proc-macro，避免当前 dyld 拒绝其 LINKEDIT；不修改系统安全设置。

| 命令                  | 当前入口                                          | 副作用与验收范围                                                                          |
| --------------------- | ------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `dev:desktop`         | `node scripts/build/desktop.mjs dev`              | 先构建独立桌面前端，再编译并运行本机应用；不是远程生产页面                                |
| `build:desktop:web`   | `node scripts/build/desktop.mjs web`              | 本地构建并复制既有 CDN 素材到 dist/build/desktop，不调用模型                              |
| `build:desktop`       | `node scripts/build/desktop.mjs build`            | 编译并打包当前操作系统；macOS 输出 App/DMG，Windows 配置 NSIS；不代表另一操作系统安装通过 |
| `test:desktop:native` | `cargo test --manifest-path src-tauri/Cargo.toml` | 本地 Rust 文件合同与导航边界测试，不替代系统文件选择和实际安装                            |

依赖已安装时以上入口不会另行安装 npm 包；Cargo 缺少的已锁定依赖仍需首次获取。桌面 App/DMG 属于交付产物，保留；本轮临时安装副本、合成材料与自建进程验收后收尾。客户于 2026-10-03 明确要求重建后清理旧构建缓存，后续按该最新授权，仅清理已核对可重建、无 Git 跟踪且没有活跃使用的问理旧缓存和本轮自建缓存；依赖、模型、恢复材料与正式产物保留。构建与实际安装记录见[13](13-DEVELOPMENT-PLAN.md)。

桌面授权使用已锁定的官方 `tauri-plugin-opener`、系统随机数和 SHA-256 依赖。仅提供生成一次会话证明、打开 QQ/微信固定授权地址及聚焦原窗口的本机命令；关闭插件的通用点击接管，不授予网页通用浏览器、文件路径或 shell 权限。编译与原生测试可通过明确的 `CARGO_TARGET_DIR` 放入本轮忽略目录，完成后按上述范围收尾，不改正式 App/DMG。配置与实际范围见[09](09-DEPLOYMENT-GUIDE.md)。

2026-10-05 候选复用底层 uni 构建命令，以 `WENLI_DESKTOP=1` 和明确 `UNI_OUTPUT_DIR` 输出桌面前端，再运行既有 CDN 复制；标准 `desktop.mjs web` 会写正式目录，不用于这项隔离核验。Tauri 使用独立 `CARGO_TARGET_DIR`、空前置构建钩子、绝对前端路径和 `--bundles app --no-sign -- --offline --locked`，只生成本机 App。独立应用标识/应用目录与 macOS 14+ WebKit UUID 保护正式用户存储；锁定版配置宏将 UUID 数组错误生成 Vec 而报 E0308，后续只在临时源码副本增加一行官方 `WebviewWindowBuilder.data_store_identifier([u8; 16])`，保留原导航/权限，未改上游或依赖。旧失败日志、适配 diff/config 与最新候选归属复用原 `server.json`。[构建及实操范围](12-CHANGELOG.md)。

私人解析器沿原启动/存储接wenli-upload-v1与wenli-upload-maintenance-v1，无新依赖/模型消费；test:baidu:pipeline纳入已有回执恢复与登记维护检查。显式持久目录保留原件与512项登记，默认临时目录退出清理；满额拒绝新登记，用户预览/确认后只整理已关闭登记，封存旧批次，未确认登记和原件保留。仅本机移除/无正文定位恢复另行明确确认。协议见04/05/14，本轮证据见11。

全平台构建入口只运行package.json实际声明的目标；缺桌面/手机安装包命令、未知参数或构建失败均非零退出，依赖缺失不自动安装。网页/小程序构建与实际安装/设备验收分开。已有网页检查在浏览器启动失败或关闭报错时仍关闭服务；后端/真实模型检查只停止自己的进程，限时升级终止并核对退出信号。微信检查已补连接后的超时关闭/断开，启动前第三方隐藏进程仍需后续专用设备验收，未据此声称全路径收尾已通过。

真实模型现有验证入口 `node scripts/build/verify-learning-live.mjs` 可指定 --provider gemini/zai/zhipu/groq 与 --output tmp/唯一目录；固定隔离Mongo（LEARNING_TEST_MONGO_URI必须为mongodb://127.0.0.1:27189/exam_learning_isolated）、后端4383、合成任务，无平台收费/生产权限。默认算术验收最多3次请求；--suite含实际网页/四个材料方向/另一型号，最多8次；--tasks仅补验指定postgraduate/civil/decimal/share/ielts/toefl/alternate/writing，每项最多1次，web须单独选择且最多1次，不与--suite混用。alternate限已核对Groq型号，不自动换入口或重试。 decimal验证小数增长率，share验证循环占比及跳过过小整体；模型返回的计算核对须经精确有理数对照，提示/计划须有成功执行收据，修正和独立变式仍由保存原文重建规则判分。--backend-dir可显式选择已打包的tmp隔离构建，拒绝越界、..和符号链接；未指定时保留原dist入口。standalone/package-runtime.mjs --output仅允许项目tmp中已成功编译且非符号链接的目录，先打包再链接现有运行依赖，不安装新包。网页使用最新H5产物/4212/独占浏览器，只连接本次隔离后端；finally关闭自己的浏览器、服务和后端，异常/信号同样收尾。报告分别记录模型请求尝试和最终账本not_called/started/received；未取得最终账本保持未知，actualCalls历史字段仍表示尝试数，不能当作供应商实际接收数。调用方负责finally停止自己启动的隔离Mongo，并删除自己的唯一输出目录/测试凭据/数据库；不读取或删除其他测试目录。

私有目录只解析数据节点，不执行文档，不输出密钥。未核实价格继续pending；真实失败单列，不用模型互评代替独立判分。当前多型号只证明明确选择后的宿主规则/受限工具工作，不证明供应商语义或完整考试能力。

`--tasks writing` 为单独的通知反馈验收，不与其他task或suite组合；只保存一份合成原答并生成一次，后端另设 `LEARNING_BYOK_CALL_LIMIT=1`。按现有UI请求合同发送四维量表，后续只读取相同requestId的结果，不为补验重发模型；主体/工具比较排除读取时的缓存期限元信息。失败报告只保存已校验的HTTP状态与简短上游代码，不留原始错误正文。调用前即保存本次编号，最终账本缺失或started保持未知，不能据请求次数推断供应商接收、用量或成本。本批只做API检查，没有调用既有浏览器分支；实际UI继续使用当前电脑使用工具。收尾先保存并独立核验原失败账本/指纹，再移除本次临时加密凭据和数据库，保留脱敏回执与合成原答/必要接续材料，不删除客户私有目录或其他任务资源。

新增 `build:apple:vision` → `node scripts/build/build-apple-vision.mjs --build-only`：真实macOS14以上SDK本机编译到唯一忽略目录，记录源码/二进制SHA；不下载、安装、部署。`test:apple:vision` → `node scripts/build/verify-apple-vision.mjs`：独立本机合成OCR/回环HTTP自检，首次合成模型初始化最多45秒，后续12秒；不读取真实资料/生产配置，不调用模型或收费。报告保留，自己的夹具/二进制清理。编译和自检产生临时产物，程序与SDK不具备时明确失败。

- `npm run test:app:material` → `node scripts/build/verify-app-material.mjs`：真实JDK/Foundation文件/NSFileCoordinator与阻塞管道验收；唯一忽略临时目录、合成资料，无网络/费用，完成清理，保留源码哈希报告。需要macOS/实际Java，`WENLI_TEST_JAVA_HOME`可指定既有工具链；不下载SDK，不代表移动设备。

下表按本轮 package.json 重新扫描生成。分类只是初筛；test、dry-run、gate 名称不保证无生产写入、网络或费用。隔离目录、数据库和账户须在执行前明确，质量报告使用 --output 放 tmp/，不覆盖真实题库。

## 自动依赖更新

.github/dependabot.yml 每周检查根/后端 npm、pip、GitHub Actions、Docker。兼容 minor/patch 分组，major 单独审查；npm/pip 设置 7 日冷却。锁文件、ESLint/格式、单元/后端/多端与安全检查保持，不自动合并或部署。当前配置未推送到默认分支，托管自动更新尚未实证。

运行版本以根及后端 engines/packageManager/锁为准；已有安全 override 不为追新删除。不能把 npm outdated 的非零退出误当脚本崩溃，也不能从无新依赖推断旧风险已消失。生产依赖与开发工具风险分别记录。

## 命令索引

App连接器新增两个命令（运行条件/SDK边界见[09B](09B-APP-CONNECTOR.md)）：

- `npm run test:app:connector` → `node scripts/build/verify-app-connector.mjs`：真实JDK/Foundation双内核回环HTTP/TLS，不调用模型；随机本机端口、合成密钥/编译产物在忽略tmp，完成清理，报告保留。需要macOS及实际Java工具链。
- `npm run build:app:connector` → `node scripts/build/build-app-connector.mjs --build-only`：实际移动SDK本地编译，缺SDK退出2，不下载/装配/部署。成功新建唯一tmp插件包和SDK哈希，不覆盖已有包；单平台显式追加`-- --android`/`-- --ios`。

新增 npm run dev:local-model → node scripts/build/local-model-connector.mjs：启动只监听本机的文本连接器，health 不推理；/chat 会调用用户配置的模型服务，须核对固定目标、真实型号、流向和会话硬预算。参数与令牌存储见[09A](09A-LAF-BACKEND-DEPLOYMENT.md)。原资料解析器 /chat 已退役，不把连接测试当成所有模型能力验证。

本机 HTTP 验证只接受 LEARNING_TEST_MONGO_URI=mongodb://127.0.0.1:27189/exam_learning_isolated，调用前自行启动该隔离 Mongo 并构建后端。npm run test:backend:http 启动 4382 端口合成 JWT 后端，写入合成学习记录并测试 13 项；拒绝其他 URI，不连接生产、不调用模型/支付。已有 4382 服务时不要并发执行。

| npm run 名称                         | 当前命令                                                                                                                                                                                                                                                                                                                                                                                                                | 副作用初筛                               |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| `dev`                                | `uni -p h5`                                                                                                                                                                                                                                                                                                                                                                                                             | 开发进程/生命周期；按实际命令审查        |
| `dev:mp-weixin`                      | `uni -p mp-weixin`                                                                                                                                                                                                                                                                                                                                                                                                      | 开发进程/生命周期；按实际命令审查        |
| `dev:mp-qq`                          | `uni -p mp-qq`                                                                                                                                                                                                                                                                                                                                                                                                          | 开发进程/生命周期；按实际命令审查        |
| `dev:h5`                             | `uni -p h5`                                                                                                                                                                                                                                                                                                                                                                                                             | 开发进程/生命周期；按实际命令审查        |
| `build`                              | `uni build -p h5`                                                                                                                                                                                                                                                                                                                                                                                                       | 本地检查或产物；审查源码与输出路径       |
| `build:app`                          | `uni build -p app`                                                                                                                                                                                                                                                                                                                                                                                                      | 本地检查或产物；审查源码与输出路径       |
| `dev:app`                            | `uni -p app`                                                                                                                                                                                                                                                                                                                                                                                                            | 开发进程/生命周期；按实际命令审查        |
| `build:mp-weixin`                    | `node scripts/build/generate-compressed-bank-modules.mjs && uni build -p mp-weixin && node scripts/build/inject-mp-weixin-privacy.mjs`                                                                                                                                                                                                                                                                                  | 本地检查或产物；审查源码与输出路径       |
| `audit:mp-main-usage`                | `npm run build:mp-weixin && node scripts/build/check-mp-main-package-usage.mjs`                                                                                                                                                                                                                                                                                                                                         | 本地检查或产物；审查源码与输出路径       |
| `audit:ui-quality`                   | `node scripts/build/ui-quality-gate.js`                                                                                                                                                                                                                                                                                                                                                                                 | 本地检查或产物；审查源码与输出路径       |
| `audit:deep-scan`                    | `node scripts/build/deep-scan.js`                                                                                                                                                                                                                                                                                                                                                                                       | 本地检查或产物；审查源码与输出路径       |
| `audit:secrets:tracked`              | `bash scripts/build/audit-tracked-secrets.sh`                                                                                                                                                                                                                                                                                                                                                                           | 本地检查或产物；审查源码与输出路径       |
| `audit:laf:function-sources`         | `node scripts/build/audit-laf-function-sources.mjs`                                                                                                                                                                                                                                                                                                                                                                     | 本地检查或产物；审查源码与输出路径       |
| `audit:subpkg-sync`                  | `node scripts/build/check-subpkg-duplicates.mjs`                                                                                                                                                                                                                                                                                                                                                                        | 本地检查或产物；审查源码与输出路径       |
| `audit:question-bank:report`         | `node scripts/build/question-bank-release-gate.mjs`                                                                                                                                                                                                                                                                                                                                                                     | 本地检查或产物；审查源码与输出路径       |
| `audit:question-bank:release`        | `node scripts/build/question-bank-release-gate.mjs --fail-on-blockers`                                                                                                                                                                                                                                                                                                                                                  | 本地检查或产物；审查源码与输出路径       |
| `audit:release:external:report`      | `node scripts/build/release-external-gate.mjs`                                                                                                                                                                                                                                                                                                                                                                          | 本地检查或产物；审查源码与输出路径       |
| `audit:release:external`             | `node scripts/build/release-external-gate.mjs --fail-on-blockers`                                                                                                                                                                                                                                                                                                                                                       | 外部/设备/业务验收；不得直接用生产       |
| `audit:release:backlog`              | `node scripts/build/release-blocker-backlog.mjs`                                                                                                                                                                                                                                                                                                                                                                        | 本地检查或产物；审查源码与输出路径       |
| `audit:release:backlog:release`      | `node scripts/build/release-blocker-backlog.mjs --fail-on-blockers`                                                                                                                                                                                                                                                                                                                                                     | 本地检查或产物；审查源码与输出路径       |
| `audit:wechat:artifacts`             | `node scripts/build/verify-wechat-artifacts.mjs`                                                                                                                                                                                                                                                                                                                                                                        | 本地检查或产物；审查源码与输出路径       |
| `smoke:wechat:devtools`              | `node scripts/build/wechat-devtools-release-smoke.mjs --fail-on-blockers`                                                                                                                                                                                                                                                                                                                                               | 外部/设备/业务验收；不得直接用生产       |
| `audit:app:artifacts`                | `node scripts/build/verify-app-artifacts.mjs`                                                                                                                                                                                                                                                                                                                                                                           | 本地检查或产物；审查源码与输出路径       |
| `smoke:jwt`                          | `node scripts/build/create-smoke-jwt.mjs`                                                                                                                                                                                                                                                                                                                                                                               | 可能写入/凭据/外部调用；先核对目标与授权 |
| `test:cloud:smoke`                   | `node scripts/build/live-cloud-smoke.mjs`                                                                                                                                                                                                                                                                                                                                                                               | 外部/设备/业务验收；不得直接用生产       |
| `test:cloud:smoke:release`           | `node scripts/build/live-cloud-smoke.mjs --fail-on-skipped`                                                                                                                                                                                                                                                                                                                                                             | 外部/设备/业务验收；不得直接用生产       |
| `build:mp-qq`                        | `uni build -p mp-qq`                                                                                                                                                                                                                                                                                                                                                                                                    | 本地检查或产物；审查源码与输出路径       |
| `build:h5`                           | `uni build -p h5 && node scripts/build/copy-cdn-to-h5.mjs`                                                                                                                                                                                                                                                                                                                                                              | 本地检查或产物；审查源码与输出路径       |
| `audit:mobile:h5-viewports`          | `node scripts/build/mobile-viewport-smoke.mjs`                                                                                                                                                                                                                                                                                                                                                                          | 外部/设备/业务验收；不得直接用生产       |
| `audit:mobile:inventory`             | `node scripts/build/mobile-module-inventory.mjs --output data/mobile-module-inventory.json`                                                                                                                                                                                                                                                                                                                             | 本地检查或产物；审查源码与输出路径       |
| `audit:mobile:baseline`              | `npm run build:app && npm run audit:app:artifacts && npm run audit:mobile:inventory && npm run build:h5 && npm run audit:mobile:h5-viewports`                                                                                                                                                                                                                                                                           | 本地检查或产物；审查源码与输出路径       |
| `test`                               | `vitest run`                                                                                                                                                                                                                                                                                                                                                                                                            | 本地检查或产物；审查源码与输出路径       |
| `test:baidu:pipeline`                | `.venv-baidu/bin/python -m unittest tests.unit.test_private_material_parser tests.unit.test_material_upload_recovery tests.unit.test_english_answer_key_verify tests.unit.test_english_passage_repair tests.unit.test_english_writing_prompt_verify tests.unit.test_flashcard_quality`                                                                                                                                  | 本地检查或产物；审查源码与输出路径       |
| `test:watch`                         | `vitest`                                                                                                                                                                                                                                                                                                                                                                                                                | 本地检查或产物；审查源码与输出路径       |
| `test:coverage`                      | `vitest run --coverage`                                                                                                                                                                                                                                                                                                                                                                                                 | 本地检查或产物；审查源码与输出路径       |
| `lint`                               | `eslint --cache --cache-location node_modules/.cache/eslint/ src/`                                                                                                                                                                                                                                                                                                                                                      | 开发进程/生命周期；按实际命令审查        |
| `lint:fix`                           | `eslint --cache --cache-location node_modules/.cache/eslint/ src/ --fix`                                                                                                                                                                                                                                                                                                                                                | 本地检查或产物；审查源码与输出路径       |
| `format`                             | `prettier --write "src/**/*.{js,vue,css,scss,json}" "scripts/**/*.{js,mjs,cjs}" "tests/**/*.{js,ts}" "laf-backend/{functions,standalone,utils,triggers,types}/**/*.{js,mjs,ts}" "*.{js,json}" ".github/**/*.{yml,yaml}" "docs/**/*.md" "README.md" "AGENTS.md" "deploy/**/*.{js,cjs,json,yml,yaml}" "laf-backend/{package,tsconfig}.json" "laf-backend/standalone/*.json" "laf-backend/functions/*.yaml" "public/*.js"` | 本地检查或产物；审查源码与输出路径       |
| `format:check`                       | `prettier --check "src/**/*.{js,vue,css,scss,json}" "scripts/**/*.{js,mjs,cjs}" "tests/**/*.{js,ts}" "laf-backend/{functions,standalone,utils,triggers,types}/**/*.{js,mjs,ts}" "*.{js,json}" ".github/**/*.{yml,yaml}" "docs/**/*.md" "README.md" "AGENTS.md" "deploy/**/*.{js,cjs,json,yml,yaml}" "laf-backend/{package,tsconfig}.json" "laf-backend/standalone/*.json" "laf-backend/functions/*.yaml" "public/*.js"` | 开发进程/生命周期；按实际命令审查        |
| `assets:png:dry-run`                 | `node scripts/assets/generate-png-assets.mjs --dry-run`                                                                                                                                                                                                                                                                                                                                                                 | 本地检查或产物；审查源码与输出路径       |
| `assets:png:generate`                | `node scripts/assets/generate-png-assets.mjs`                                                                                                                                                                                                                                                                                                                                                                           | 可能写入/凭据/外部调用；先核对目标与授权 |
| `assets:png:validate`                | `node scripts/assets/generate-png-assets.mjs --validate-only`                                                                                                                                                                                                                                                                                                                                                           | 本地检查或产物；审查源码与输出路径       |
| `baidu:manifest:self-test`           | `python3 scripts/baidu/source_manifest.py --self-test`                                                                                                                                                                                                                                                                                                                                                                  | 本地检查或产物；审查源码与输出路径       |
| `baidu:manifest:quality:self-test`   | `python3 scripts/baidu/manifest_quality.py --self-test`                                                                                                                                                                                                                                                                                                                                                                 | 本地检查或产物；审查源码与输出路径       |
| `baidu:manifest:quality`             | `python3 scripts/baidu/manifest_quality.py`                                                                                                                                                                                                                                                                                                                                                                             | 本地检查或产物；审查源码与输出路径       |
| `baidu:netdisk:candidate-coverage`   | `python3 scripts/baidu/public_course_candidate_coverage.py`                                                                                                                                                                                                                                                                                                                                                             | 本地检查或产物；审查源码与输出路径       |
| `baidu:cleaning:queue:self-test`     | `python3 scripts/baidu/cleaning_queue.py --self-test`                                                                                                                                                                                                                                                                                                                                                                   | 本地检查或产物；审查源码与输出路径       |
| `baidu:cleaning:queue`               | `python3 scripts/baidu/cleaning_queue.py`                                                                                                                                                                                                                                                                                                                                                                               | 本地检查或产物；审查源码与输出路径       |
| `baidu:flashcards:repair:answers`    | `python3 scripts/baidu/answer_evidence_repair.py`                                                                                                                                                                                                                                                                                                                                                                       | 可能写入/凭据/外部调用；先核对目标与授权 |
| `baidu:flashcards:quality:self-test` | `python3 scripts/baidu/flashcard_quality.py --self-test`                                                                                                                                                                                                                                                                                                                                                                | 本地检查或产物；审查源码与输出路径       |
| `baidu:flashcards:quality`           | `python3 scripts/baidu/flashcard_quality.py`                                                                                                                                                                                                                                                                                                                                                                            | 本地检查或产物；审查源码与输出路径       |
| `baidu:flashcards:quality:release`   | `python3 scripts/baidu/flashcard_quality.py --fail-on-blockers`                                                                                                                                                                                                                                                                                                                                                         | 本地检查或产物；审查源码与输出路径       |
| `baidu:sources:verified`             | `python3 scripts/baidu/verified_source_registry.py --registry data/verified-source-registry.json --output data/verified-source-export.json`                                                                                                                                                                                                                                                                             | 开发进程/生命周期；按实际命令审查        |
| `baidu:sources:merge`                | `python3 scripts/baidu/source_manifest.py --input data/verified-source-export.json --source-channel verified_registry && python3 scripts/baidu/manifest_quality.py --manifest data/source-manifest.json --output data/source-manifest-quality.json`                                                                                                                                                                     | 可能写入/凭据/外部调用；先核对目标与授权 |
| `baidu:sync:dry-run`                 | `python3 scripts/baidu/incremental_sync.py --dry-run`                                                                                                                                                                                                                                                                                                                                                                   | 开发进程/生命周期；按实际命令审查        |
| `baidu:sync`                         | `python3 scripts/baidu/incremental_sync.py --download`                                                                                                                                                                                                                                                                                                                                                                  | 可能写入/凭据/外部调用；先核对目标与授权 |
| `baidu:sync:netdisk:dry`             | `python3 scripts/baidu/incremental_sync.py --dry-run --scan-dir "/EXAM-MASTER/考研历年真题/01.考研政治" --scan-dir "/EXAM-MASTER/考研历年真题/02.考研英语" --scan-dir "/EXAM-MASTER/考研历年真题/03.考研数学"`                                                                                                                                                                                                          | 开发进程/生命周期；按实际命令审查        |
| `baidu:sync:netdisk:queue`           | `python3 scripts/baidu/incremental_sync.py --scan-dir "/EXAM-MASTER/考研历年真题/01.考研政治" --scan-dir "/EXAM-MASTER/考研历年真题/02.考研英语" --scan-dir "/EXAM-MASTER/考研历年真题/03.考研数学" && npm run baidu:manifest:quality && npm run baidu:netdisk:candidate-coverage && npm run baidu:cleaning:queue`                                                                                                      | 本地检查或产物；审查源码与输出路径       |
| `baidu:group:registry:check`         | `python3 scripts/baidu/group_sync.py --validate-registry`                                                                                                                                                                                                                                                                                                                                                               | 开发进程/生命周期；按实际命令审查        |
| `baidu:group:sync:dry`               | `python3 scripts/baidu/group_sync.py --mode=sharelink --dry-run`                                                                                                                                                                                                                                                                                                                                                        | 开发进程/生命周期；按实际命令审查        |
| `baidu:group:sync`                   | `python3 scripts/baidu/group_sync.py --mode=sharelink`                                                                                                                                                                                                                                                                                                                                                                  | 可能写入/凭据/外部调用；先核对目标与授权 |
| `baidu:group-file:index:self-test`   | `python3 scripts/baidu/group_file_index.py --self-test`                                                                                                                                                                                                                                                                                                                                                                 | 本地检查或产物；审查源码与输出路径       |
| `baidu:group-file:index:dry`         | `python3 scripts/baidu/group_file_index.py --dry-run`                                                                                                                                                                                                                                                                                                                                                                   | 本地检查或产物；审查源码与输出路径       |
| `baidu:group-file:index`             | `python3 scripts/baidu/group_file_index.py`                                                                                                                                                                                                                                                                                                                                                                             | 可能写入/凭据/外部调用；先核对目标与授权 |
| `release:gate:report`                | `npm run build:h5 && npm run build:mp-weixin && npm run deps:audit:prod && npm run audit:question-bank:report && npm run baidu:flashcards:quality && npm run audit:release:external:report && npm run audit:release:backlog && npm run audit:wechat:artifacts`                                                                                                                                                          | 本地检查或产物；审查源码与输出路径       |
| `release:gate`                       | `npm run build:h5 && npm run build:mp-weixin && npm run deps:audit:prod && npm run audit:question-bank:release && npm run baidu:flashcards:quality:release && npm run audit:release:external && npm run audit:release:backlog:release && npm run audit:wechat:artifacts && npm run test:cloud:smoke:release`                                                                                                            | 外部/设备/业务验收；不得直接用生产       |
| `deps:check`                         | `npm outdated`                                                                                                                                                                                                                                                                                                                                                                                                          | 本地检查或产物；审查源码与输出路径       |
| `deps:audit`                         | `npm audit --registry=https://registry.npmjs.org`                                                                                                                                                                                                                                                                                                                                                                       | 本地检查或产物；审查源码与输出路径       |
| `deps:audit:prod`                    | `npm audit --omit=dev --registry=https://registry.npmjs.org`                                                                                                                                                                                                                                                                                                                                                            | 本地检查或产物；审查源码与输出路径       |
| `release:patch`                      | `npm version patch --no-git-tag-version`                                                                                                                                                                                                                                                                                                                                                                                | 可能写入/凭据/外部调用；先核对目标与授权 |
| `release:minor`                      | `npm version minor --no-git-tag-version`                                                                                                                                                                                                                                                                                                                                                                                | 可能写入/凭据/外部调用；先核对目标与授权 |
| `release:major`                      | `npm version major --no-git-tag-version`                                                                                                                                                                                                                                                                                                                                                                                | 可能写入/凭据/外部调用；先核对目标与授权 |
| `prepare`                            | `husky`                                                                                                                                                                                                                                                                                                                                                                                                                 | 开发进程/生命周期；按实际命令审查        |
| `audit:repository`                   | `node scripts/build/repository-health.mjs --strict`                                                                                                                                                                                                                                                                                                                                                                     | 本地检查或产物；审查源码与输出路径       |
| `security:signing-salt`              | `node scripts/build/create-request-signing-salt.mjs`                                                                                                                                                                                                                                                                                                                                                                    | 可能写入/凭据/外部调用；先核对目标与授权 |
| `lint:tooling`                       | `eslint --max-warnings=0 scripts/ tests/ *.config.js`                                                                                                                                                                                                                                                                                                                                                                   | 开发进程/生命周期；按实际命令审查        |
| `typecheck:backend`                  | `npm run typecheck --prefix laf-backend/standalone`                                                                                                                                                                                                                                                                                                                                                                     | 开发进程/生命周期；按实际命令审查        |
| `build:backend`                      | `npm run build --prefix laf-backend/standalone`                                                                                                                                                                                                                                                                                                                                                                         | 本地检查或产物；审查源码与输出路径       |
| `lint:python`                        | `ruff check scripts tests && ruff format --check scripts tests`                                                                                                                                                                                                                                                                                                                                                         | 开发进程/生命周期；按实际命令审查        |
| `audit:backend:runtime`              | `node scripts/build/audit-backend-runtime.mjs`                                                                                                                                                                                                                                                                                                                                                                          | 本地检查或产物；审查源码与输出路径       |
| `test:backend:http`                  | `node scripts/build/verify-backend-http.mjs`                                                                                                                                                                                                                                                                                                                                                                            | 本地检查或产物；审查源码与输出路径       |

格式统一使用 Prettier / ESLint / Ruff，但不机械重写第三方 vendored 内容。read-only repository-health 不删除文件，不执行扫描发现的脚本；动态注册与条件平台仍需人工检查。发布门禁保持现有失败语义，报告成功不等于 canPublish=true。

## 本轮开发依赖安全适配

沿用现有uni-app版本，安全override固定Express 4.22.3、body-parser 1.20.8、qs 6.16.0、ws 6.2.6/8.22.0、Jimp 0.22.12、serialize-javascript 7.0.5、humanfs 0.16.8。许可证分别为MIT，qs/serializer/jpeg-js为BSD-3，humanfs为Apache-2.0；既有第三方许可文件保持归属。版本、维护活动和完整依赖树记录在tmp/resource-delivery，补丁不是不受攻击保证。主要依据：[Express发布](https://github.com/expressjs/express/releases/tag/v4.22.3)、[qs安全说明](https://github.com/ljharb/qs/security/advisories/GHSA-4mjr-xmp4-gh2g)、[WS安全说明](https://github.com/websockets/ws/security/advisories/GHSA-96hv-2xvq-fx4p)、[humanfs安全说明](https://github.com/humanwhocodes/humanfs/security/advisories/GHSA-p498-v437-472g)、[serializer发布](https://github.com/yahoo/serialize-javascript/releases/tag/v7.0.5)。

Jimp旧版HTTP回调与phin新Promise不兼容，升级整个同一Jimp家族并验证PNG/JPEG、HTTP及微信二维码实际解码。其file-type 16存在ASF解析风险；自研`@wenli/file-type-compat 1.0.0`仅把CJS异步fromBuffer转发到MIT的官方file-type 21.3.4，源码不复制解析器，不承诺其他旧接口。file-type使用Node ESM，Node>=20，项目实际要求>=22.22.3，动态import由Node缓存。只用于开发机的图片/二维码工具，不进入客户端或模型工具沙箱，不新增数据外发/权限；仍按既有工具调用边界使用。相对原实现，它保留消费方接口并使用官方有界解析；资源验证为64 MiB堆/2秒子进程的零长度ASF和2 MiB压缩XML探测，另有正常图片/二维码往返与三端构建。依据：[ASF安全说明](https://github.com/sindresorhus/file-type/security/advisories/GHSA-5v7r-6r5c-r473)、[ZIP安全说明](https://github.com/sindresorhus/file-type/security/advisories/GHSA-j47w-4g3g-c36v)、[21.3.4发布](https://github.com/sindresorhus/file-type/releases/tag/v21.3.4)。检测类型仍只是提示，不是内容安全证明。

内部适配使用file:依赖和`$file-type` override；根file-type-modern别名和适配manifest版本同时维护。曾有嵌套相对路径旧锁/链接残留，使安装摘要误报零风险；最小全新安装定位后只移除本轮创建的坏链接/锁条目。最终必须核对npm ls、真实调用和全依赖audit，不以安装返回码单独验收。自动依赖PR仍须审查适配/别名、锁与许可/三端/攻击回归，不自动合并；托管运行仍待发布默认分支后验证。

Apple CPU 配置依据：[Apple Vision compute device API](https://developer.apple.com/documentation/vision/vnrequest/setcomputedevice%3Aforcomputestage%3A)，原始候选依据：[语言纠错开关](https://developer.apple.com/documentation/vision/vnrecognizetextrequest/useslanguagecorrection)，预览方向依据：[ImageIO方向转换](https://developer.apple.com/documentation/imageio/kcgimagesourcecreatethumbnailwithtransform)。实际SDK头与本机运行证据同时核对。
