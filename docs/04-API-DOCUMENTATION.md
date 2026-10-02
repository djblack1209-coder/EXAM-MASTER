# API 与工具合同

## 学习方向与私人资料客观练习（2026-10-01）

`conversation.start` 可选 `task={contract:"learning-task-v1",track,stage,edition}`。track仅接受general/primary/junior/senior/postgraduate/civil/ielts/toefl；stage/edition由用户填写、每项最多100字符，空白为null，不猜课程或考试版本。旧无task事件继续兼容。`learningTaskContext`从当前题目派生来源与independent_rule/ai_assisted_only/pending_reference；课程覆盖和官方评分始终unverified。`progress`工具只读同一上下文。云端/本地模型上下文沿原预算、共享许可与白名单，不发送未知能力字段；无效任务在上游请求与费用预留前拒绝。

`material-objective-v1` 仅用于已保存私人资料的明确 `key: value` 文本字段，支持literal（字面引用）、difference（增量）、growth_percent（增长率）。片段最多2000字符/20个唯一字段，字段键80/值300字符；拒绝未校对疑义、非正文角色和答案/批注字段。数量仅支持九位以内整数，增长率须正基期/非负现期，作答须带%。题干仅包含本题选定字段，不把下一复测字段一并送给模型。

题目绑定materialId/segmentId/页码/位置/提取版本与事件；`question.add`按实际保存原文重建规则，不采纳调用方的validation、改写题干/来源或评分维度。原事件中的validation清空，备份/真实同步均由原资料重建；未知或已删除原文不能恢复可靠判分。人工编辑题干清除旧资料练习合同，回到普通待校验题，避免规则与题目错配。

不同字段/字段对的变式复用原来源，找不到新字段则不生成；原答、帮助后修正、独立变式和复习分别记录，计划要求independent_correct。字面匹配不证明阅读理解/官方等级；合法数学材料沿既有精确数学规则，不因方向名称扩大校验能力。删除资料同时清除关联任务阶段/版本元信息，原隐私与停止/教法边界保留。

当前题目的模型讲解、提示和检查不接受模型擅自新增题目；明确variant/challenge或没有当前题目时才接纳待核对候选。云端在结果结算/缓存前过滤，客户端也保护本地或历史缓存回执；模型候选始终validation=null，不升级判分权威。

`wenli-upload-maintenance-v1` 沿受保护POST `/parse` 增加 `preview-upload-maintenance` 与 `compact-upload-receipts`，健康能力含稳定storageId和当前generation。预览只含登记计数/批次/指纹；明确确认提交原storageId、原generation、previewFingerprint和同operationId。服务端先持久封存原批次，再逐项清理已关闭登记，原件和未确认登记保留，回执 originalsDeleted 必须为0。中断/丢回执沿原动作恢复，不重复换代；旧批次prepare/正文拒绝，非登记查询不得声称已删除原件。并发变化要求重预览，不静默自动维护。

定位导出与恢复使用现有 `wenli-upload-locator-v1`，只含同账户无正文七字段登记；不含令牌、原件、路径或状态权威。用户明确保存/放弃恢复并再次确认后可仅移除本机待办，零远端调用、不宣称远端删除。恢复需同账户、当前生命周期与容量，零自动重传；重新授权原存储后才能核对或恢复原件。

私人解析器 `/health.uploadRecovery` 宣告 `available=true`、`contract=wenli-upload-v1`、`storageId`（32位小写十六进制）及 `maxReceipts=512`。客户端只接受匹配合同/身份。沿现有受保护 POST `/parse` 增加三个严格元信息动作：`prepare-upload` 仅 action/requestId/storageId/size，`upload-receipt` 与 `close-upload` 仅 action/requestId/storageId；编号为8—80位字母/数字/下划线/连字符，原件大小1—10 MiB。均沿原Bearer、精确Origin和固定路径，不增加云API/路径白名单。客户端先持久本机无正文待办，再取得 prepared/匹配编号与大小回执，才发送首批正文的 requestId/storageId。准备失败或上下文撤销不发正文，旧无能力解析器沿旧请求，不宣称可恢复。

`upload-receipt` 返回合同/编号/状态/大小及可用fileId，无原件正文、姓名或片段。状态 prepared/receiving/stored/closing/closed/absent；只有完整字节长度和SHA匹配才能报stored。恢复仍经既有parse(fileId)，沿登记的OCR许可与引擎，不重新上传；每批成功写入私人事实后才清本机待办。stored已关联本机资料时只核对既有资料，不重复解析；该待办快捷关闭拒绝删除已关联原件，须走原资料范围预览。absent不清定位待办，避免迟到正文成为孤立原件；明确close先写closing墓碑，再清本次新建且未被其他登记引用的原件，verified closed/布尔 originalDeleted 后才能清待办，已有/共享原件如实报 sharedOriginalRetained。原存储身份改变或回执不匹配保留待办。

解析器在原件写入前原子保存 receiving/fileId/owned/bodyFingerprint 登记，原件使用临时文件、flush/fsync与原子替换；解析或回执失败仍可定位。取消/正常原件删除先关闭登记，迟到相同编号不能复活正文；失败保留closing，可重试。仍受单进程原件锁、10 MiB/50 MiB及512登记上限；不静默驱逐未知原件或闭合墓碑，长期整理另行实现/验收。持久目录仅用户显式配置，默认临时存储退出删除；客户端取消不会撤回已发送正文。

Repository新增本机 `conversation_learning_v1_lifecycle` 共享撤销标记（learning-lifecycle-v1），观察其代次变化更新既有数值生命周期。`lifecycleContext()` 只读账户/生命周期，不重放正文或完成隐私写入；Store recordContext/materialContext在标记不合法时返回不可用，health/parse拒绝。`prepareAsyncAction()`在现有写入租约下初始化无正文标记；H5/微信文件动作、App确认读取与Store解析在正文前检查写入权。首次初始化不改变本窗口记录身份；删除/有新增的恢复/撤销/访客归入/同步替换及资料删除在事实写入前换代，失败也不接纳旧回执。只读窗口仍可查看/导出，不开放上传换取事后写入失败。无新增云API。

客户端Store的 `materialContext()` 返回当前账户、Repository生命周期与单调授权代次，只供当前动作校验，不包含令牌，不作为认证或持久化字段。端点、允许来源、consent、令牌及连接对象变化都换代，暂时清空或改动后恢复原值不会复活旧动作。资料health/parse使用动作开始时的连接快照；每批事实/续页前复核上下文，变更主动取消当前解析请求并拒收迟到回执。H5、微信选择/确认/读正文及App确认/读取使用同一代次；App只选元信息仍允许隐藏后返回，再重新授权。无新增后端API或工具权限。

私人解析器新增 `/health` 的 `ocrEngines.appleVision`：`available`、`contract=wenli-apple-vision-v1`、`status=capabilities_verified`、`runtime=macos_connector`、`languages=[zh-Hans,en-US]`、`recognitionState=not_tested`。检查只验证程序/协议/CPU/语言能力，不证明冷启动或准确率。`/parse` 可显式传 `ocrEngine=apple-vision`，必须 `allowOCR===true`；默认请求形状/Tesseract兼容。未知/不可用/缺许可在正文解码与存储前拒绝；识别失败不换引擎。文字PDF仍走Poppler。返回 `recognitionEngine`，OCR片段 `method=apple_vision`、`role=unassigned`、`reviewRequired=true`、`coordinateSpace=preview_pixels_top_left`，预览方向/尺寸与行框一致。Apple PDF批次保留原5页上限并加25秒共享期限、180万UTF8字节片段回执预算；达上限保存已完成页，下一页留到后续动作。客户端 Apple 选择只接纳匹配引擎的回执；续页/重试保留选择并复核原解析器 Origin。

App文件合同 `wenli-app-file-v1`：系统选择回执仅id/file(handle/name/size)，明确consent=true后read回执为id/handle/name/size/contentBase64；原生重验元信息与10 MiB字节预算。取消/释放只针对临时句柄，不新增云端API。页面经Store只读recordContext取得实际账户/记录生命周期，清除/恢复使旧动作失效；网络和业务校验仍沿原受保护解析服务。完整字段、时限和移动SDK边界见[09B](09B-APP-CONNECTOR.md)。

`prerequisite-condition-v1`接受有界条件题可靠wrong。完整原答分类与独立P⇒Q/Q⇒P成立集的差异选充分、必要或双向候选，保存direction（p_to_q/q_to_p）及有序1—2条evidenceIds/evidenceOutcomes。双向不同先检验充分方向，原题变式再检查完整分类，不认定唯一认知错因。新建及question.add重验全题最新作答；最新正确/待核对拒绝陈旧候选，旧已保存题仍保留，更正引用使关联待核对。整数/代数旧v1/v2合同冻结。

基础小题`safe-condition-implication-v1`只检验P⇒Q。回答“成立”须完整成立集包含，否则答“反例x=整数或分数”（可前缀“不成立，”）。任何共同数域/原排除值内的P真Q假均有效，不要求等于工具代表点；同真、同假或反方向不能反驳此方向。整数/分数沿1e9上限，连分数比较避免交叉乘法精度和BigInt设备要求。零分母、多个值、注入、模糊声明、未知/无理零点及资源越界待核对；题干重建validation/conditionProbeAnalysis，不信任模型/备份传值。基础阈值小题沿原数域、使用独立小例；“独立检验原题”交换原P/Q并保留完整原数域与排除值。

safe-condition-relation-v1复用现有learning-sync、作答/教学/恢复合同，无新端点。condition_relation客观类型按canonical题干重新推导P⇒Q/Q⇒P，不能信任客户端/模型保存的分类或反例。共同数域支持实数/整数/正数，原分母/约分限制必须在该域外或明确共同排除；缺失不隐式限制全集，返回pending。条件分子/分母/限制至多二次且全部零点可精确为有理数，完整分段证明两向包含，保留精确反例；资源/复杂表达/无理零点和未校对条件降级。

客户端复用 src/services/api/ 的请求、鉴权与统一错误处理，不从组件直接访问数据库。学习 API 定义在 src/services/api/domains/learning.api.js；后端以函数源码和 yaml 元数据为准。

## 学习业务

| 入口                    | 合同与限制                                                                                        |
| ----------------------- | ------------------------------------------------------------------------------------------------- |
| /proxy-ai               | 鉴权、预算预留、指定模型与分享授权、结构化工具输出验证；不根据自然语言直接写学习事实              |
| /proxy-ai-stream        | 共用预算/鉴权；有界SSE预览→完整校验收据，未通过能力/终端拒绝                                      |
| /learning-models        | list、usage、save、delete、test、cancel、result；密钥只在 save 输入到服务端保险库，响应不返回密钥 |
| /learning-sync          | pull、page、push、delete；当前用户隔离，每批最多100操作，服务端再验证，CAS最多5次                 |
| /learning-subscriptions | order、callback；生产收费关闭，权益须服务端验证，沙箱重复回调幂等                                 |
| /answer-submit          | 旧练习幂等作答入口，不能因新对话替代而删除数据兼容                                                |

连接测试可能产生真实上游调用和费用，不能把它当无成本健康探针。BYOK 与平台账分开，具体政策见[14](14-MODEL-PRIVACY-COST.md)。学习请求绑定 expectedOwner，切换账户后拒绝旧响应。

## 内部学习工具

learning.progress、learning.focus、learning.submit、learning.hint、learning.method、learning.assess、learning.plan、learning.stop。assess 当前版本1.2，其余1.0；参数白名单、读写权限、业务前置条件、幂等 ID、调用预算、超时及取消在 learning-tools 中定义；本地动作 cost=false，模型生成另计调用预算。提交仅接收用户明确答案。

策略调整保存 evidenceIds 与短理由，失败保存真实错误收据。模型要求“已加入错题”不能替代成功执行结果；工具结果渲染不执行 HTML/脚本。

`teaching-followup-v1` 是宿主只读派生，不开放任意模型写入。输入为本账户现有状态和可选conversationId/scope/limit（1—100，默认20）；输出contract/total/rows，关联实际教学messageId/executionId、题版本、方法、后续状态/分母/最多6个尝试证据ID，不返回原聊天正文。按事件顺序只关联最新成功教学、同对话原题或明确关联的同学科变式；父链最多16层，循环/缺父不归因。旧备份的历史交付明确historyOnly，不冒充本轮执行。progress工具读取同一函数，模型上下文最多3段当前范围观察，仍受原上下文与任务预算限制；无网络、无额外模型额度或费用。

新strategy.set可选source为self_report/observed/model、conversationId绑定已有对话，旧未带字段事件继续兼容。用户明确指定的教法/节奏优先；宿主保留同对话的方法锁直到用户再调整，不让自动观察覆盖。模型method违反锁即拒绝，相同方法只返回现有策略及执行收据，不覆盖用户难度/理由/来源。两次可靠错答触发先修，实际教学后仍错再改变表达与步骤；未实际交付不能仅凭方法标签判断效果，提示正确只提示后续独立检验。

## 恢复接口

当前教法由`conversationStrategy(state, conversationId)`从已有事件恢复；界面、自动调整和模型背景共用这一解析，不用最后一个全局标签判断其他对话。无对话的节奏只在新对话开始时作为初始选择。`strategy.auto`及`task.resume`绑定已有对话且必须`source:self_report`，分别表示明确恢复自动教法、明确继续当前任务；不在模型工具白名单中。恢复自动不会提交答案、生成帮助、调用模型或解除停止；`question.focus`只导航，不解除停止。停止任务的普通消息不会触发作答或模型，其他对话继续正常执行。方法工具即使未传请求锁也要核对已保存的用户选择。

`prerequisite-diagnosis-v2`复用question.add/focus、正式作答、计划和现有独立判分。本对话受支持原题的1—2条可靠wrong/partial须由整数规则或代数验题器再验；按最新原答差异选择进位/符号、不等式方向/临界值/端点、方程完整解集/原定义域/代入、化简等价/原限制的候选小题。部分正确单独保留，不转为错题；原答与手工更正不一致、待核对、解析攻击及范围外拒绝诊断。新建候选要求当前题目最新作答仍可靠受阻，补全正确或最新待核对则不借旧答案继续建议新诊断；已存在的历史诊断仍保留并按原引用重验。理由仅描述可观察差异和候选检查，不宣称唯一认知错因。

诊断题保存原题版本、证据ID及evidenceOutcomes、概念、理由与对话；共享reducer重验合同、引用顺序、题干及规则。知识范围独立，没有parentQuestionKey，计划完成条件为independent_correct，不能冒充原题迁移/掌握。随后“独立检验原题”中，v2方程诊断保留原数域、原定义域和全部解要求，左右互换并负倍缩放后重新独立验题；其他题复用既有受限变式。帮助隔离，缺条件、partial与提示后正确不能冒充完整独立成功。更正撤销诊断关联，私人原资料删除覆盖诊断题与后续变式。v1题干/理由冻结，旧事件、同步和备份仍按v1重放，不自动替换为v2。

本地repository.previewRestore(JSON)返回新增/复用/待复核计数和owner/revision；小备份仍使用最多500操作/150万字符/32层/2秒合同。较大旧v1备份和learning-history-v1分页包走异步prepareLearningHistoryRestore，每批最多20操作/140万字符，进度、AbortSignal和120秒硬上限；输入JSON最多1200万字符，事件正文和最终状态最多600万字符/2万操作。预览无持久写入，保留原始业务校验，不信任导入结果；分批途中出现墓碑也不能隐式删除当前资料。

大恢复使用私有预览缓存并绑定完整输入、owner、revision及lifecycle；再次确认后才保存recovery前态并应用完整结果。变更、切换账户、取消和超限使预览失效。Store禁止忙碌时恢复，同账户合并、不自动上传。rollback恢复最近一次写入前态；非法结构、账户不匹配、冲突、验证或提交前保存失败保持当前记录，提交后清理失败如实报告并在下次读取重试，不虚报全部完成。

访客迁移使用固定访客读取入口：previewGuestMigration → migrateGuest(preview, consent)。再次核对当前账户、版本及访客内容指纹后写入；同日计划使用 plan.merge 保留双方任务与完成依据。不能通过普通备份修改 owner 越权。

同步冲突：先归档双方；adoptRemoteConflict 必须重新 pull，远端指纹与预览、本机版本一致才采用。restoreConflictLocal 恢复本机冲突副本；删除归档是单独确认动作。已有不同冲突归档不被新冲突覆盖。取消不能撤销已经成功上传的批次。/learning-sync delete 实际返回成功后才显示云端删除；本机原件保留，后续主动同步可以重新上传，其他设备也须停止同步。

大同步：pull小状态保持`{state,revision}`，大状态返回`{history:manifest,revision}`；page输入`{revision,generation,offset,count}`，count为1至3，响应包含owner、相同revision/generation/offset及pages。页面最多120000字符，revision/generation过期拒绝；不保存旧服务端快照供绕过删除。客户端至多重新pull一次处理版本变化，仍冲突则保留本机。

push可选`returnSnapshot:false`返回`{accepted,revision,snapshotRequired:true}`；旧调用仍可接完整或分页快照。客户端每批最多100操作/600000个JSON字符；服务端原2MB请求与800000字符单操作门禁保持。相同重复操作和纯pull不增加服务端revision。整次同步最多512请求/10分钟、客户端24次/61秒；鉴权及服务端30次/分钟不放宽，所有分页继续检查归属、取消和生命周期。资料墓碑先确认后重新读取，普通上传完再读完整服务端事实，不根据确认收据编造统计。

## 本机连接器

App模块wenli-app-connector-v1只接受完整保护能力匹配，原生重验固定路径/方法、精确origin、令牌/授权/容量/时间。固定来源https://wenli-app.invalid须连接器显式允许，不能代替认证。健康、文本、已有原件续解析和匹配删除路由已装配模块；缺模块零请求，文件选择和逐次确认已接源码，视觉/流式未开放。错误仅固定码，取消和迟到拒绝不自动重试；上限与SDK/设备边界见[09B](09B-APP-CONNECTOR.md)。

Node local-text-1.0：GET /health、POST /chat、OPTIONS；精确 Origin、Bearer 令牌、固定目标/型号、显式 consent、稳定 requestId。相同请求复用执行及失败结果，异内容 409；输入、输出、次数、速率、并发和时间有硬上限。health 只证明连接器可达和配置能力，upstreamReachability=not_tested，不代表模型已推理成功。只支持文本，工具/视觉/流式关闭，输出不能执行学习工具；平台扣量为零。超限、未授权、取消和上游故障如实返回。

Python 资料连接器：POST /health、/parse、/delete，使用自己的令牌/来源。health 不解析文件；/parse 分批保留原件、页图、文本与角色，扫描识别需独立许可。原 /chat 返回 410，避免绕过 Node 模型预算。客户端H5路径与微信原生代码已接通；微信传输需基础库3.2.2以上及手机/开发者工具支持manual重定向和分块，PC仍拒绝；App需专用模块匹配装配，当前SDK/设备未验收。微信固定Origin标识https://wenli-weixin.invalid，仅作请求来源，不是目标地址；连接器需显式授权此精确来源。不得以Origin代替Bearer鉴权、用户逐次许可或域名/HTTPS要求。

宿主教学交付 `teaching.deliver` v1 不开放为模型自由写入工具。输入须绑定当前对话/题目、受支持方法、实际内容、local_tool/model_reply来源、帮助标记和1至3级；结果为 messageId/executionId/helped，本地不产生模型费用。题目切换、停止、结构非法或落盘失败拒绝整次交付。模型请求期间题目变化后，旧响应及工具均拒绝写入。

本地受限整数教学支持不同内容的解释、引导、分层提示、分步、先修补充、例题、类比和加法数轴。加法挑战改为带括号的组合乘法任务，独立计算答案并保留原题关系；其他题型能力不足如实显示。变式根据原题版本生成，不根据已经改变的目标伪造关联。

资料删除内部合同 v1：`previewMaterialDeletion(materialId)` 只读；`deleteMaterial(preview, consent)` 校验用户/版本/完整范围后写入；`retryOriginalDeletion(deletionId, consent)` 仅处理已存在原件待办。它们不向模型开放任意删除权限，本地不扣额度。保存失败、陈旧预览、账号变化、目标不匹配、未授权、取消和回执缺失分别拒绝或保留待办。与旧题库发布、模型保险库及整账户删除互不替代。

Python `poppler-tesseract-v2` 的 /delete 只接受固定64位十六进制 fileId，精确 Origin/Bearer 鉴权，禁止跟随资料目录符号链接；成功包含 deleted/fileId/alreadyAbsent。删除不存在原件可幂等成功；I/O失败返回500，正在解析返回409，均无成功回执。解析和删除互斥，避免删除后子进程再写回页图。客户端超时10秒、禁止重定向、受限响应、可取消；只向导入原件的已授权 origin 发令牌，不自动换目标或调用云端。微信新增RequestTask形状测试桥经真实本机HTTP调用的证据，不是微信SDK或设备验收。取消与超时中止请求；3xx/Location、超限、UTF8不完整和旧SDK均拒绝，不跟随重定向、不换目标或自动云端回退。

## 主观评分合同

`learning.assess` 1.1 的 rubricId/维度合同作为旧v1保留；当前1.2宿主为有rubric的题指定`subjective-rubric-v2`，模型参数不开放rubricContract降级。rubricId必须匹配题目版本，逐一提交全部criteria；每项为criterionId、score（数值或null）、feedback、evidence（最多3段，每段250个UTF-16单元）。维度1至6个，每维满分0.5至10，合计最多30分，分数按0.5递增。超分、缺漏、重复、自创维度、非原答引用、错误版本和未知字段拒绝；给分必须引用原答。无维度题保留旧`{name,feedback}`未量化反馈，不接受自行添加分数。

v2 evidence支持原文字符串或`{quote,start,end}`：字符串须在绑定原答中唯一；重复时扩展成唯一原文或明确范围，不能自动挑第一处。start从0开始、end不含终点，按UTF-16计数；必须是安全整数、原答范围内并与quote完整相符，不能截断代理对。同维度重复引用同一范围拒绝；原答保留空白与换行。位置、出现序号/总数和前后各最多24个Unicode码点的原文由宿主重新计算，模型不能传入附近原文或权限。任何题目疑义未校对时所有维度score都须null；缺分不妨碍记录可定位原文。旧v1事件继续按原规则重放，不自动改写旧意见或伪造位置。

写入型工具同一操作内容重试复用原成功收据及耗时，已写评分但收据缺失时仅补齐收据；同一ID改内容仍`IDEMPOTENCY_CONFLICT`。权限、次数/时间预算仍逐次检查，不因已有收据放行新内容。

总分任一维缺失即null/uncertain，不把缺失当零；全满分/零分/其他确定分数表达为correct/wrong/partial，政策 `rubric-total-v1`。这是辅助分值表达，不是可靠首答判定或掌握。两次模型一致不升级；引用真实仅证明引用出现在原答，不证明语义评估正确。

维度可从用户定义/参考候选/模型候选建模，均无答案权威；当前页面仅用户明确编辑。保存产生新题版本/任务和修改理由，旧版本与计划分母保留。同题仅修订维度保留原帮助和作答关系，不增加首答。该动作不调用模型、不扣生成额度。

云端当前背景只发送goal/profile/strategy/question/attempt/summary，包含完整绑定原答、维度及题目疑义的field/reason/critical/resolved，JSON最多12000字符；超限在预留/调用前413拒绝，不静默截断评分依据。疑义仅投影上述字段，发送背景不包含owner或未知配置字段，鉴权仍校验当前用户。模型调用沿用真实预算与取消合同；本地纯文本连接器仍不执行assess。

## 精确代数内部合同

`safe-algebra-v1` 由宿主 `question.add` / `attempt.submit` 调用，不开放任意计算、命令或修改答案工具。输入为完整绑定题干和原答；结果为验证后的题目规则/范围状态，或 `{status,outcome,basis,evaluator,authority}`。权限沿用当前账户读写学习事实；数学计算本身只读、免费、无网络。题目添加和提交仍由原事件ID幂等，重复断流/补传不重复统计。同步与备份重新计算规则，不信任客户端的 coefficients、solution 或 executable 标签。

目标支持“化简 (x+1)^2”“解方程 x^2-5x+6=0”“整数解方程 2\*x=1”等，生成完整题干以实数/整数/正数定义域为准。单变量 x，有限整数/精确小数/分数、括号、加减乘除、整幂；支持受限 `\frac{a}{b}` 与常用符号。隐式 `2x` 可以使用，`1/2x` 歧义拒绝；空白不拼接数字。零次/负次幂保留非零条件，0^0 不定义。最简形式和完整通用 CAS 不在合同内。

等价式要求相同原定义域；约分后“x+1，x≠1”可核验，遗漏限制先待核对，额外/错误限制可判错；直接重述原式先待后续检验。方程支持一次及有理根二次、无实解/恒等方程、 unordered/重复根/±、精确单位分数和数域筛选。有限正确解的非空真子集判partial；空集只对实际无解判对；恒等方程需要完整数域及排除值。无理根、高次根、多变量、三角函数及资源越界保留pending，不从近似值猜可靠结果。

输入256字符、128token、16层、指数绝对值6、次数6、分数10亿；固定有界同步运算，无后台子进程，取消只在原提交/教学宿主边界生效，不能声称可中断已开始的同步运算。`unsupported_expression`、`unsupported_roots`、`unsupported_irrational_roots`、`undefined_expression`、`ambiguous_implicit_division`、`resource_limit`、`missing_domain_condition`、`original_expression_repeated` 等保留原答并待核对，不伪造成功。变式改变等价式/零点任务方向或数域，生成后重新验条件、全部解和原题关系；不能只按模型文本写入结果。

## 流式与只读恢复（learning-stream-v1）

`POST /proxy-ai-stream`使用与proxy-ai相同的消息/上下文/明确modelId/shareConsent/requestId。新客户端附requestBinding，服务端校验并加入预算指纹；旧REST输入可不含此字段，旧调用记录仍可查询，旧指纹不会冒充当前配置成功复用。未授权/非法输入/未声明能力在上游调用前拒绝；当前后端缺可靠response时结算已知not_called，不开始上游。

HTTP头为text/event-stream UTF8、no-cache及X-Accel-Buffering:no。事件依次为start(version=1/requestId/modelId/真实model)、最多32次preview({text,provisional:true})、一个result或error；ID从1递增。客户端须收到完整空行、终止事件和正常EOF，核对归属/型号/绑定后才处理。预览不是工具成功、答案或内部推理；密钥回显/编码变体脱敏，提前成功宣称改为建议。UTF8/BOM/CRLF/CR/LF、多行、失序/重复/未完成/资源超限有专项检验。

上游须为明确声明的OpenAI兼容SSE、单choice、实际model一致；请求stream_options.include_usage。完整stop和DONE才返回有效输出；length/content_filter、原生tool/function片段、结束后追加或结构错误拒绝。未完整结束即使用量片段存在也不认最终计费为已确认；完整结束却内容失败时仍保留供应使用量。缺可靠用量继续pending，不能填零。30秒上游/5秒DNS、1MiB上游、3万内容字符；下游2MiB、每事件10万字符/34个事件，客户端45秒。背压停止新增输出，最终收据写入最多等1秒；无无限重试。

`POST /learning-models {action:"result",requestId}`在本账户原成本账只读获取completed的原result，不预留、不请求供应商、不扣平台量。reserved返回409，cancelled返回499，无记录404；失败没有可用结果。客户端仅在原消息/题目/模型/共享授权一致、无后续学习状态调整或隐私生命周期变化时应用，工具及回复沿用同ID幂等。取消/导入历史不恢复执行。重开后需主动选回原模型并授权；旧用户内容不会带新账户令牌发送。

模型save可显式声明stream；声明不等于实际通过。连接状态按配置身份（端点/型号/能力/密钥引用或密钥）摘要绑定，普通调用和sse-v1分别报告，24小时后stale；更换配置或旧账缺版本则untested，不把过去另一配置成功当现在已连接。

协议依据：[WHATWG SSE](https://html.spec.whatwg.org/multipage/server-sent-events.html)、[OpenAI完成流事件](https://developers.openai.com/api/reference/resources/chat/subresources/completions/streaming-events/)、[Gemini兼容协议](https://ai.google.dev/gemini-api/docs/openai)、[DCloud request](https://uniapp.dcloud.io/api/request/request)。核对日期2026-09-30；兼容协议不保证所有型号具有视觉/流式/工具能力，未静默更换预设型号或开启费用。微信同时核对已安装@dcloudio/types的enableChunked及运行时onHeadersReceived/onChunkReceived，官方微信页面本轮未完整取回，实机仍待验。

## 教学结果隐私删除

`learning-sync delete`先在本账户成本文档CAS清除calls.result、写resultDeletedAt，并标记所有已预留请求cancelRequestedAt，再移除learning_states；成功回执含modelResultCacheDeleted=true/erasedResults/cancellationRecorded。客户端要求两项删除回执，旧后端只确认学习状态时不宣称全部完成。任一步失败可重试，不清空成本/权益、密钥或其他账户。已删除结果查询及原请求重播返回410/MODEL_RESULT_DELETED，不触发生成。

新且有效的material.delete同步批次在学习状态CAS前保守清除此账户全部旧教学结果缓存，因当前请求元数据不足以证明每项材料范围；题目/尝试/任务事实仍按原资料关联规则处理。整个批次先完成结构/业务校验，非法输入不清除；重复已接受墓碑不清除后续新结果。多文档步骤不是事务，后一步失败可留下结果已清、状态未删，接口如实报失败并允许重试；并发重试可能扩大缓存清除范围，不凭结果缓存重建统计。

## 模型结果恢复的资源响应

`learning-models result`仍只查同账户原请求，不调用供应商或收费；查前可CAS清理过期/超容量缓存，不新增学习事实。completed有可用缓存才success；过期/淘汰/太大/不可用返回410、`MODEL_RESULT_UNAVAILABLE`及cacheStatus，隐私删除返回`MODEL_RESULT_DELETED`。失败/在途/取消沿用实际状态；跨用户404。`proxy-ai`同输入重播使用相同规则，不返回success+null，不删幂等记录后重新消费。

`learning-models list/usage` 返回resultCache：policy/version、entries、bytes、expiryEnforcement=on_access；usage.calls不包含私人教学result或fingerprint，保留usageEvidence、实际成本状态及释放原因。新成功响应附resultCache.status/expiresAt；原缓存读取依实际当前状态判断。维护与结算同一用户单文档CAS，错误和超限保留原学习记录；服务端配置/限额见[14](14-MODEL-PRIVACY-COST.md)。

## 页图辅助解读（page-reading-v1）

`POST /proxy-ai` 可附 `images:[{dataUrl,source}]` 和 `imageShareConsent:true`，仍需原 shareConsent、modelId、requestId、鉴权/限流和预算。每次仅当前题目一张PNG/JPEG内嵌页图，最多512 KiB、边长4096、像素8 Mi；不接收远程URL、SVG或任意content数组。source为materialId、segmentId、page（整数或null）、extractionVersion、extractionEventId（字符串或null），须与当前question.source精确相符，且question具有questionKey。编码与图片头部校验不等于图像真实性、完整解码或OCR质量验证。

当前只开放显式声明 vision / openai-image-url-v1 的BYOK非流式；客户端仅H5接入。平台图像价格适配、本地及微信/App路径未验收，不自动回退。图像body拒绝发生在预留/上游之前；400表示授权/格式/来源，413表示资源，422表示能力/路径。正常上游请求用末条user的 text + image_url 内容数组，地址仅为经过校验的data URL。权限由服务端决定，不能以图中指令改变。

结果 `visualReading` 保存version=page-reading-v1、status=ai_assisted、请求来源、summary、regions与uncertainties。region项仅role/text/region，角色为question/options/user_answer/teacher_annotation/reference_candidate/unknown；位置为归一化[x,y,width,height]或null，仍是模型候选。最多8块，每块1000字，summary最多1500字且总计5000字；疑义最多6项各200字。自由文本不能替代该结构，额外工具/建题、核验状态、越界位置和伪造角色拒绝。模板明确不判分、不记错题/计划；用户在原资料中局部确认候选后沿用原建题和作答入口。

调用记录和结果增加inputMode=image/text；图片priceVersion=vision-pricing-unverified、actualCost=null/pending，保存实际usage，不套文本价格或免费预设。BYOK不扣平台权益。重播/恢复、取消和隐私缓存清理沿用原幂等；读取既有结果不重新上传图片或消费。请求事件只保存visualSource，无额外图片副本；teaching.deliver消息保留visualReading、标记帮助，不构成作答或独立掌握。普通文本测试不更新visionStatus；list单独报告同配置图片调用connected/failed/stale/untested，成功传输仍不证明识别正确。

协议核对：[OpenAI 图片输入](https://developers.openai.com/api/docs/guides/images-vision)、[Gemini兼容图片输入](https://ai.google.dev/gemini-api/docs/openai)，2026-09-30。仅验证了相应字段合同，不将文档示例型号当作本项目真实通过型号。

## 一次不等式与解集合同

`safe-linear-inequality-v1`沿用上述宿主数学入口、完整题目/原答绑定和免费只读计算，无新增权限/网络/代码执行。目标可写“解不等式 -2\*x+6>0”；规范题干限定完整实数域，两边经精确有理数合并后必须为一次或常数，原变量分母/定义域孔洞、二次、链式题干、整数域和额外条件均不宣称可可靠处理。常数真假分别得全体/空集，不除以零。

输入/深度/幂/系数仍受safe-algebra的256字符/128token/16深度/6次幂与1e9有理数上限，答案512字符、最多4个区间并集。答案支持x<3、3>x、(-∞,3)、有界开闭区间和归一化并集；不以小数近似代替精确分数。无穷端点必须开，倒置/未知函数/额外定义域待核对；自然猜测、引用和反问先澄清。题目明确要求完整解集，已解析但漏区段、反向或开闭不等价按wrong表达，不套用有限多解题的partial规则。

判分依据为新合同ID、完整表达、方向和规范区间，来源真实性仍独立。变式同时负倍缩放/左右对调，改变表达与符号操作后重算条件和完整解集；不提前给答案。分层提示1/2不显示当前阈值；显式数轴按精确边界、方向和空/实心显示，是示意数轴而非函数曲线，展示答案按3级帮助保存。提示后正确不作独立掌握，新变式/复测和任务沿用原记录/FSRS准入。范围外或不明确表达保留pending，错误类型使用现有资源/前置/输入校验；无独立计算可用时转原配置入口或局部校对，不伪造在线AI。

本地文本客户端只投影requestId/modelId/shareConsent/messages与goal/strategy/profile/question/attempt/summary背景；Store的requestBinding和背景owner不发往连接器。保留服务端未知字段拒绝、型号与共享许可校验，不为云端背景放宽本地合同。
