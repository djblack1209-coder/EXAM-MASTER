# API 与工具合同

接口与工具的当前合同，按业务主题分组。各合同的实现阶段与验收数字见 [12](12-CHANGELOG.md) 与 [08](08-TESTING-INFRA.md)；2026-10-10 前按日期排列的原版本见 git 提交 `77093a22`。

## 学习业务与通用工具

### 学习业务

| 入口                    | 合同与限制                                                                                        |
| ----------------------- | ------------------------------------------------------------------------------------------------- |
| /proxy-ai               | 鉴权、预算预留、指定模型与分享授权、结构化工具输出验证；不根据自然语言直接写学习事实              |
| /proxy-ai-stream        | 共用预算/鉴权；有界SSE预览→完整校验收据，未通过能力/终端拒绝                                      |
| /learning-models        | list、usage、save、delete、test、cancel、result；密钥只在 save 输入到服务端保险库，响应不返回密钥 |
| /learning-sync          | pull、page、push、delete；当前用户隔离，每批最多100操作，服务端再验证，CAS最多5次                 |
| /learning-subscriptions | order、callback；生产收费关闭，权益须服务端验证，沙箱重复回调幂等                                 |
| /answer-submit          | 旧练习幂等作答入口，不能因新对话替代而删除数据兼容                                                |

连接测试可能产生真实上游调用和费用，不能把它当无成本健康探针。BYOK 与平台账分开，具体政策见[14](14-MODEL-PRIVACY-COST.md)。学习请求绑定 expectedOwner，切换账户后拒绝旧响应。

### 内部学习工具

learning.progress、learning.focus、learning.submit、learning.hint、learning.method、learning.assess、learning.plan、learning.stop。assess 当前版本1.2，其余1.0；参数白名单、读写权限、业务前置条件、幂等 ID、调用预算、超时及取消在 learning-tools 中定义；本地动作 cost=false，模型生成另计调用预算。提交仅接收用户明确答案。

策略调整保存 evidenceIds 与短理由，失败保存真实错误收据。模型要求“已加入错题”不能替代成功执行结果；工具结果渲染不执行 HTML/脚本。

`teaching-followup-v1` 是宿主只读派生，不开放任意模型写入。输入为本账户现有状态和可选conversationId/scope/limit（1—100，默认20）；输出contract/total/rows，关联实际教学messageId/executionId、题版本、方法、后续状态/分母/最多6个尝试证据ID，不返回原聊天正文。按事件顺序只关联最新成功教学、同对话原题或明确关联的同学科变式；父链最多16层，循环/缺父不归因。旧备份的历史交付明确historyOnly，不冒充本轮执行。progress工具读取同一函数，模型上下文最多3段当前范围观察，仍受原上下文与任务预算限制；无网络、无额外模型额度或费用。

新strategy.set可选source为self_report/observed/model、conversationId绑定已有对话，旧未带字段事件继续兼容。用户明确指定的教法/节奏优先；宿主保留同对话的方法锁直到用户再调整，不让自动观察覆盖。模型method违反锁即拒绝，相同方法只返回现有策略及执行收据，不覆盖用户难度/理由/来源。两次可靠错答触发先修，实际教学后仍错再改变表达与步骤；未实际交付不能仅凭方法标签判断效果，提示正确只提示后续独立检验。

### 原答与明确操作的意愿边界

`userDirective` 不再凭正文包含“图示”“提示”“提高难度”等词取得操作权限。教法、复习和时间请求须匹配完整动作表达，可带“请/帮我”等明确请求前缀及句末标点；停止接受完整停止表达及随后用标点分开的原因。“停止排放……”、引用、否定教法或正文提及动作保持讨论/澄清。以“我的答案是/我的答案:/答案是/我认为”起始的输入先沿原作答分类，不修改教法、画像或停止。目标和基础仍只接受明确自述起始表达。

原快捷动作、明确继续与恢复自动入口保留；后两者继续分别操作当前任务/教法。完整动作文字经“确认这是正式作答”提交只作原答，不执行指令。执行中的模型请求仅允许明确停止取消，正文中的停止词不取消；取消后迟到输出不能写入。旧事件/备份/私人同步合同和客观判分政策不变，主观原答仍待核对且不进入可靠首答、掌握或 FSRS。[实际范围](06-FRONTEND-REFERENCE.md)、[专项与回归](08-TESTING-INFRA.md)。

### 学习方向与私人资料客观练习

`conversation.start` 可选 `task={contract:"learning-task-v1",track,stage,edition}`。track仅接受general/primary/junior/senior/postgraduate/civil/ielts/toefl；stage/edition由用户明确选择或填写、每项最多100字符，空白为null，不猜课程或考试版本。旧无task事件继续兼容。`learningTaskContext`从当前题目派生来源与independent_rule/ai_assisted_only/pending_reference；课程覆盖和官方评分始终unverified。`progress`工具只读同一上下文。云端/本地模型上下文沿原预算、共享许可与白名单，不发送未知能力字段；无效任务在上游请求与费用预留前拒绝。

`material-objective-v1` 仅用于已保存私人资料的明确 `key: value` 文本字段，支持literal（字面引用）、difference（增量）、growth_percent（增长率）。片段最多2000字符/20个唯一字段，字段键80/值300字符；拒绝未校对疑义、非正文角色和答案/批注字段。数量仅支持九位以内整数，增长率须正基期/非负现期，作答须带%。题干仅包含本题选定字段，不把下一复测字段一并送给模型。

前批数量练习使用 `material-objective-v2`，字面引用为 v1，旧 v1/v2 题干与判分合同继续原样回放。v2 支持整数/小数的 difference、growth_percent 和 share_percent（部分占整体的百分比）；纯数值字段限九位整数部分、最多六位小数，沿既有安全整数有理数算法，约分后分子绝对值/分母上限均为 10⁹，任何中间步骤越界即拒绝，不改用浮点容差。增长率要求正基期/非负现期；占比要求正整体、0≤部分≤整体。增量答案可用有限小数或分数，百分数须带 ASCII `%`，循环小数用精确分数，不猜单位、千位分隔、指数记法或舍入。单个答案最多256字符，不执行表达式；可解析但不相等记错，不明确或超限保持待核对。新旧客户端/后端须匹配合同；本地构建不意味着线上后端已支持对应版本。

本批新建资料练习使用 `material-objective-v3`，包含字面与上述精确数量类型。每个非空行须完整满足“字段：值”；标题、说明、空键/值、过长字段不会静默丢弃。字段标签按NFKC及连字符/下划线分隔检查常见中英文答案、批注、学生/用户作答标记，包括Answers/Solutions/Annotations、AnswerKey/Answer_Keys、Student answers/Student_response和全角形式；只规范用于拒绝的标签，不改写字段原文或值。单数旧守卫及角色/疑义/大小/唯一字段限制继续保持。这是有界格式与标签检查，不能证明内容真实、全面理解所有答案区或语义。新题干使用“根据所给原文完成练习”，只改合同降版不能通过来源重建。v3数量沿v2精确有理数，字面沿v1文本匹配，依据必须匹配v3；变式保持父合同。旧v1/v2仍保留原解析及题干，不强行按v3重算已保存事实或赋予新的来源可靠性；旧客户端/服务器、正式安装与同步上线需版本匹配另验。

2026-10-05当前隔离后端的27项实际JWT/HTTP/Mongo合同通过，覆盖七阶段、14种非法来源行整批拒绝、来源重建/简单降版/提取事件伪造拒绝、精确占比、旧v1/v2与两项辅助记录不升级、停止/幂等/跨账户隔离。原安全基线最终在同版独立新进程通过13/13：保持10秒启动和5秒请求上限，无处理器预热；只适配隔离产物、数据、报告路径和进程归属回执。前轮冷启动失败与温态结果分别保留，不叠加计数，不证明持续性能、生产同步、主观语义或设备验收。[分级验证](12-CHANGELOG.md)、[测试口径](08-TESTING-INFRA.md)。

v2 仍从保存片段重建题干、来源和 validation，拒绝伪造答案/提取版本与降版改写。变式保持原合同，只选不重复且适用的字段：占比保留原部分、更换整体，其他数值练习以原现期作新基期；遇到单位、零基期、过小整体或超限候选跳过，无适用字段就明确拒绝。字段来源不证明资料真实、官方评分或长期掌握；原停止、指定教法、独立正确计划、复习、隐私删除及同步边界保持。

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

### 共用开始主题与启动生命周期

首页和对话页使用同一只读 `LEARNING_START_TOPICS`：路程与位移、英文通知写作、英文说明写作、中文叙事写作、12 + 8。选择只填学习目标草稿；明确“开始学习”才沿原任务入口写入记录，不恢复另一条已停止任务或改变指定教法。仅有共享对话、尚未作答时也隐藏旧首页重复进度、统计和真题计数；题源、恢复和共享记录入口保留，不把学习作答当成真题作答。

启动页保留原1800ms自动路由及4200ms兜底时点。兜底为真实按钮，键盘沿现有绑定；离页释放监听、主题订阅和本页全部返回核验计时器，迟到的导航成功/失败不再安排核验或跳转。此合同不改认证、首次引导、后端权限、任务事实或费用。

### 有界演示、写作草稿与证据关系

新增 `visualize` 是现有受限工具体系中的只读工具，不是通用 Python、浏览器或视频任务执行器。客户端仅在能力中明确声明 `visualization: learning-visual-v1` 时可收到该工具；旧客户端保持原能力结构，未知或缺少版本时服务端拒绝新工具，不静默提升能力。能力声明不替代认证或权限。参数只接受 `template: distance_displacement`、`outward`（1至20整数米）和 `backward`（0至去程的整数米），默认6/4；代码、URL、HTML、文件和资源提升字段拒绝。宿主生成6秒/24步示意，仍检查原读权限、调用预算、取消、截止时间、当前对话/停止和用户锁定教法。执行成功只保存原执行收据，展示请求为临时状态；不写作答、成绩或掌握。不支持的概念不伪造演示。真实模型选模板和设备路径尚未验收。

`learning-lab.vue` 的本地预测、逐步播放、词汇/句式提示与草稿是探索状态。没有自动播放；减少动态效果改为逐步观察；折叠、换标签、账户/记录/对话/题目上下文变化、停止、页面隐藏及卸载会释放播放并收起或重置本次探索，不自动恢复。停止后可查看静态示意与原答关系，带练、预测和播放禁用。6/4固定示例可按用户操作播放项目原创本地 MP4；其他数值使用示意，不冒称已有相应视频。

英文通知以活动/时间/地点/行动四个目标逐句组织，每句最多240字符；词句有限检查每次只返回一个反馈。信息找到、首字母/句末标点和已支持的介词问题均与语义正确分开。完整带练后提供不同活动/时间/地点的独立草稿（最多1000字符）；仍只是信息检查，不创建正式独立作答或可靠判分。评价维度参考官方指南，题目为原创，尚未接公共满分语料或个性化可靠词汇证据。

证据关系图按账户现有状态及当前对话筛选，采用当前有效更正，忽略已无题目的记录；最多展示40个知识范围节点，每节点最近4条原答入口。14天格分别标记可靠作答和待核对作答，帮助另列，不升格掌握；关系类型为 `record_membership`，不是先修推断。返回原题只选择记录，不解除停止。图、阅读及草稿不提交学习事实；请求真实教学时仍沿原帮助与工具收据合同记录。

模块选型：采用已有 [Blender 外部渲染器](https://raw.githubusercontent.com/blender/blender/main/COPYING)，未复制引擎或安装依赖；提供 [Manim Community（MIT）](https://github.com/ManimCommunity/manim/blob/main/LICENSE.community) 固定模板适配，本机可用性检查返回 `RENDERER_UNAVAILABLE`。 [Motion Canvas（MIT）](https://raw.githubusercontent.com/motion-canvas/motion-canvas/main/LICENSE) 是后续候选，未安装/接入。[PhET 当前 HTML 许可页](https://phet.colorado.edu/es/licensing)列 上游许可，未作为可用于本产品收费方向的自动选型。各项目代码、内容和素材许可分别核对，不从旧宣传页推断当前许可。

当前渲染入口仅开发机主动执行：固定源码插入已验证整数，限时子进程、固定工具、640×360/24fps/6秒 Blender 输出，只允许本仓库 tmp 的新独立目录并拒绝符号链接越界。它不是面向不可信代码的完整沙箱；没有公网渲染服务或自动抓取权限，模型文本绝不作为 Python 执行。[操作入口](08C-SCRIPTS-REFERENCE.md)、[教学方向](01-PRODUCT-VISION.md)。

写作语料候选补查（2026-10-05）：作者的 [ASAP 2.0 仓库](https://github.com/scrosseye/ASAP_2.0)声明 CC BY 4.0，包含基于材料的英语议论文、人工评分、评分量表与原始阅读材料；它适合后续核验论点、依据与组织结构，不是英文通知、中文作文或雅思/托福的通用满分范文。仓库同时说明部分文章来自 [PERSUADE 2.0](https://github.com/scrosseye/persuade_corpus_2.0)，后者声明 上游许可；两者来源及许可差异仍需逐项核实，不能由新仓库的总声明推定所有子集可在本产品分发。ASAP 2.0 README 内的总数与分项也未据实际文件核对，不作为已验证语料规模。本轮只查作者 README，没有下载作文或导入任何数据。

2026-10-06重新核验上述两个作者仓库，许可差额仍在。另查 [OpenStax 写作教材当前前言](https://openstax.org/books/writing-guide/pages/preface)：列上游许可，并要求进入AI产品/模型另获书面许可；不能按旧CC BY印象直接导入。 [Wikibooks议论文固定版本4596318](https://en.wikibooks.org/w/index.php?title=Rhetoric_and_Composition/Argument&oldid=4596318)提供署名示例和页面许可声明，但文中外部引文的再分发依据、原题及评分依据未闭合，仍为候选，不能称满分范文或可靠标准答案。此次仅作来源核验，未下载、导入、发送或评分作文；候选不能解除公共题源门禁。

后续接入须先核对文章、题目、阅读材料、评分量表各自来源及许可，再只投影必要的正文、体裁、题目/量表标识、分值范围、评分来源与归属信息；公开语料包含的种族、残障、经济背景等人口字段不进入辅导画像。结构拆解应保留证据片段与范围，并比较不同得分文章，不能把常见句式或人工总分变成逐词可靠答案。通知等尚无已核实许可语料的体裁继续使用原创练习，不用这些候选冒充已完成范文模块或公共题源门禁。

### 本机连接器

App模块wenli-app-connector-v1只接受完整保护能力匹配，原生重验固定路径/方法、精确origin、令牌/授权/容量/时间。固定来源https://wenli-app.invalid须连接器显式允许，不能代替认证。健康、文本、已有原件续解析和匹配删除、文件选择及逐次确认已有源码；缺模块零请求，完整DCloud装配和设备仍待验。云教学流另须wenli-app-stream-v1完整匹配；本地/chat、视觉能力不由流式入口扩大。错误仅固定码，取消和迟到拒绝不自动重试；上限与SDK/设备边界见[09B](09B-APP-CONNECTOR.md)。

Node local-text-1.0：GET /health、POST /chat、OPTIONS；精确 Origin、Bearer 令牌、固定目标/型号、显式 consent、稳定 requestId。相同请求复用执行及失败结果，异内容 409；输入、输出、次数、速率、并发和时间有硬上限。health 只证明连接器可达和配置能力，upstreamReachability=not_tested，不代表模型已推理成功。只支持文本，工具/视觉/流式关闭，输出不能执行学习工具；平台扣量为零。超限、未授权、取消和上游故障如实返回。

Python 资料连接器：POST /health、/parse、/delete，使用自己的令牌/来源。health 不解析文件；/parse 分批保留原件、页图、文本与角色，扫描识别需独立许可。原 /chat 返回 410，避免绕过 Node 模型预算。客户端H5路径与微信原生代码已接通；微信传输需基础库3.2.2以上及手机/开发者工具支持manual重定向和分块，PC仍拒绝；App需专用模块匹配装配，当前SDK/设备未验收。微信固定Origin标识https://wenli-weixin.invalid，仅作请求来源，不是目标地址；连接器需显式授权此精确来源。不得以Origin代替Bearer鉴权、用户逐次许可或域名/HTTPS要求。

宿主教学交付 `teaching.deliver` v1 不开放为模型自由写入工具。输入须绑定当前对话/题目、受支持方法、实际内容、local_tool/model_reply来源、帮助标记和1至3级；结果为 messageId/executionId/helped，本地不产生模型费用。题目切换、停止、结构非法或落盘失败拒绝整次交付。模型请求期间题目变化后，旧响应及工具均拒绝写入。

本地受限整数教学支持不同内容的解释、引导、分层提示、分步、先修补充、例题、类比和加法数轴。加法挑战改为带括号的组合乘法任务，独立计算答案并保留原题关系；其他题型能力不足如实显示。变式根据原题版本生成，不根据已经改变的目标伪造关联。

资料删除内部合同 v1：`previewMaterialDeletion(materialId)` 只读；`deleteMaterial(preview, consent)` 校验用户/版本/完整范围后写入；`retryOriginalDeletion(deletionId, consent)` 仅处理已存在原件待办。它们不向模型开放任意删除权限，本地不扣额度。保存失败、陈旧预览、账号变化、目标不匹配、未授权、取消和回执缺失分别拒绝或保留待办。与旧题库发布、模型保险库及整账户删除互不替代。

Python `poppler-tesseract-v2` 的 /delete 只接受固定64位十六进制 fileId，精确 Origin/Bearer 鉴权，禁止跟随资料目录符号链接；成功包含 deleted/fileId/alreadyAbsent。删除不存在原件可幂等成功；I/O失败返回500，正在解析返回409，均无成功回执。解析和删除互斥，避免删除后子进程再写回页图。客户端超时10秒、禁止重定向、受限响应、可取消；只向导入原件的已授权 origin 发令牌，不自动换目标或调用云端。微信新增RequestTask形状测试桥经真实本机HTTP调用的证据，不是微信SDK或设备验收。取消与超时中止请求；3xx/Location、超限、UTF8不完整和旧SDK均拒绝，不跟随重定向、不换目标或自动云端回退。

### 流式与只读恢复（learning-stream-v1）

`POST /proxy-ai-stream`使用与proxy-ai相同的消息/上下文/明确modelId/shareConsent/requestId。新客户端附requestBinding，服务端校验并加入预算指纹；旧REST输入可不含此字段，旧调用记录仍可查询，旧指纹不会冒充当前配置成功复用。未授权/非法输入/未声明能力在上游调用前拒绝；当前后端缺可靠response时结算已知not_called，不开始上游。

HTTP头为text/event-stream UTF8、no-cache及X-Accel-Buffering:no。事件依次为start(version=1/requestId/modelId/真实model)、最多32次preview({text,provisional:true})、一个result或error；ID从1递增。客户端须收到完整空行、终止事件和正常EOF，核对归属/型号/绑定后才处理。预览不是工具成功、答案或内部推理；密钥回显/编码变体脱敏，提前成功宣称改为建议。UTF8/BOM/CRLF/CR/LF、多行、失序/重复/未完成/资源超限有专项检验。

上游须为明确声明的OpenAI兼容SSE、单choice、实际model一致；请求stream_options.include_usage。完整stop和DONE才返回有效输出；length/content_filter、原生tool/function片段、结束后追加或结构错误拒绝。未完整结束即使用量片段存在也不认最终计费为已确认；完整结束却内容失败时仍保留供应使用量。缺可靠用量继续pending，不能填零。30秒上游/5秒DNS、1MiB上游、3万内容字符；下游2MiB、每事件10万字符/34个事件，客户端45秒。背压停止新增输出，最终收据写入最多等1秒；无无限重试。

App云教学已接专用原生分块合同：仅POST /proxy-ai-stream，基础保护能力与wenli-app-stream-v1全部匹配才发送原账户令牌及本次授权上下文。headers→连续chunk→complete使用同一请求ID和连续序号；规范Base64每块最多8192字节、累计2MiB/256块/45秒。原生完整UTF-8及JS共用解码/SSE/请求绑定/EOF分别校验，旧模块不会借用H5或REST回退。原有H5/微信/App读取每块及事件都核对Store账户、对话/题目、记录生命周期、模型和共享授权，变化时取消并拒绝旧工具。源码、真实本机内核、移动SDK内核编译、完整插件与设备证据分别记录在[09B](09B-APP-CONNECTOR.md)；预览不写学习事实，模型实际费用仍须既有账本确认。

`POST /learning-models {action:"result",requestId}`在本账户原成本账只读获取completed的原result，不预留、不请求供应商、不扣平台量。reserved返回409，cancelled返回499，无记录404；失败没有可用结果。客户端仅在原消息/题目/模型/共享授权一致、无后续学习状态调整或隐私生命周期变化时应用，工具及回复沿用同ID幂等。取消/导入历史不恢复执行。重开后需主动选回原模型并授权；旧用户内容不会带新账户令牌发送。

模型save可显式声明stream；声明不等于实际通过。连接状态按配置身份（端点/型号/能力/密钥引用或密钥）摘要绑定，普通调用和sse-v1分别报告，24小时后stale；更换配置或旧账缺版本则untested，不把过去另一配置成功当现在已连接。

协议依据：[WHATWG SSE](https://html.spec.whatwg.org/multipage/server-sent-events.html)、[OpenAI完成流事件](https://developers.openai.com/api/reference/resources/chat/subresources/completions/streaming-events/)、[Gemini兼容协议](https://ai.google.dev/gemini-api/docs/openai)、[DCloud request](https://uniapp.dcloud.io/api/request/request)。核对日期2026-09-30；兼容协议不保证所有型号具有视觉/流式/工具能力，未静默更换预设型号或开启费用。微信同时核对已安装@dcloudio/types的enableChunked及运行时onHeadersReceived/onChunkReceived，官方微信页面本轮未完整取回，实机仍待验。

### 模型结果恢复的资源响应

`learning-models result`仍只查同账户原请求，不调用供应商或收费；查前可CAS清理过期/超容量缓存，不新增学习事实。completed有可用缓存才success；过期/淘汰/太大/不可用返回410、`MODEL_RESULT_UNAVAILABLE`及cacheStatus，隐私删除返回`MODEL_RESULT_DELETED`。失败/在途/取消沿用实际状态；跨用户404。`proxy-ai`同输入重播使用相同规则，不返回success+null，不删幂等记录后重新消费。

`learning-models list/usage` 返回resultCache：policy/version、entries、bytes、expiryEnforcement=on_access；usage.calls不包含私人教学result或fingerprint，保留usageEvidence、实际成本状态及释放原因。新成功响应附resultCache.status/expiresAt；原缓存读取依实际当前状态判断。维护与结算同一用户单文档CAS，错误和超限保留原学习记录；服务端配置/限额见[14](14-MODEL-PRIVACY-COST.md)。

### 页图辅助解读（page-reading-v1）

`POST /proxy-ai` 可附 `images:[{dataUrl,source}]` 和 `imageShareConsent:true`，仍需原 shareConsent、modelId、requestId、鉴权/限流和预算。每次仅当前题目一张PNG/JPEG内嵌页图，最多512 KiB、边长4096、像素8 Mi；不接收远程URL、SVG或任意content数组。source为materialId、segmentId、page（整数或null）、extractionVersion、extractionEventId（字符串或null），须与当前question.source精确相符，且question具有questionKey。编码与图片头部校验不等于图像真实性、完整解码或OCR质量验证。

当前只开放显式声明 vision / openai-image-url-v1 的BYOK非流式；客户端仅H5接入。平台图像价格适配、本地及微信/App路径未验收，不自动回退。图像body拒绝发生在预留/上游之前；400表示授权/格式/来源，413表示资源，422表示能力/路径。正常上游请求用末条user的 text + image_url 内容数组，地址仅为经过校验的data URL。权限由服务端决定，不能以图中指令改变。

结果 `visualReading` 保存version=page-reading-v1、status=ai_assisted、请求来源、summary、regions与uncertainties。region项仅role/text/region，角色为question/options/user_answer/teacher_annotation/reference_candidate/unknown；位置为归一化[x,y,width,height]或null，仍是模型候选。最多8块，每块1000字，summary最多1500字且总计5000字；疑义最多6项各200字。自由文本不能替代该结构，额外工具/建题、核验状态、越界位置和伪造角色拒绝。模板明确不判分、不记错题/计划；用户在原资料中局部确认候选后沿用原建题和作答入口。

调用记录和结果增加inputMode=image/text；图片priceVersion=vision-pricing-unverified、actualCost=null/pending，保存实际usage，不套文本价格或免费预设。BYOK不扣平台权益。重播/恢复、取消和隐私缓存清理沿用原幂等；读取既有结果不重新上传图片或消费。请求事件只保存visualSource，无额外图片副本；teaching.deliver消息保留visualReading、标记帮助，不构成作答或独立掌握。普通文本测试不更新visionStatus；list单独报告同配置图片调用connected/failed/stale/untested，成功传输仍不证明识别正确。

协议核对：[OpenAI 图片输入](https://developers.openai.com/api/docs/guides/images-vision)、[Gemini兼容图片输入](https://ai.google.dev/gemini-api/docs/openai)，2026-09-30。仅验证了相应字段合同，不将文档示例型号当作本项目真实通过型号。

### 教学结果隐私删除

`learning-sync delete`先在本账户成本文档CAS清除calls.result、写resultDeletedAt，并标记所有已预留请求cancelRequestedAt，再移除learning_states；成功回执含modelResultCacheDeleted=true/erasedResults/cancellationRecorded。客户端要求两项删除回执，旧后端只确认学习状态时不宣称全部完成。任一步失败可重试，不清空成本/权益、密钥或其他账户。已删除结果查询及原请求重播返回410/MODEL_RESULT_DELETED，不触发生成。

新且有效的material.delete同步批次在学习状态CAS前保守清除此账户全部旧教学结果缓存，因当前请求元数据不足以证明每项材料范围；题目/尝试/任务事实仍按原资料关联规则处理。整个批次先完成结构/业务校验，非法输入不清除；重复已接受墓碑不清除后续新结果。多文档步骤不是事务，后一步失败可留下结果已清、状态未删，接口如实报失败并允许重试；并发重试可能扩大缓存清除范围，不凭结果缓存重建统计。

## 备份、恢复与历史

### 恢复接口

当前教法由`conversationStrategy(state, conversationId)`从已有事件恢复；界面、自动调整和模型背景共用这一解析，不用最后一个全局标签判断其他对话。无对话的节奏只在新对话开始时作为初始选择。`strategy.auto`及`task.resume`绑定已有对话且必须`source:self_report`，分别表示明确恢复自动教法、明确继续当前任务；不在模型工具白名单中。恢复自动不会提交答案、生成帮助、调用模型或解除停止；`question.focus`只导航，不解除停止。停止任务的普通消息不会触发作答或模型，其他对话继续正常执行。方法工具即使未传请求锁也要核对已保存的用户选择。

`prerequisite-diagnosis-v2`复用question.add/focus、正式作答、计划和现有独立判分。本对话受支持原题的1—2条可靠wrong/partial须由整数规则或代数验题器再验；按最新原答差异选择进位/符号、不等式方向/临界值/端点、方程完整解集/原定义域/代入、化简等价/原限制的候选小题。部分正确单独保留，不转为错题；原答与手工更正不一致、待核对、解析攻击及范围外拒绝诊断。新建候选要求当前题目最新作答仍可靠受阻，补全正确或最新待核对则不借旧答案继续建议新诊断；已存在的历史诊断仍保留并按原引用重验。理由仅描述可观察差异和候选检查，不宣称唯一认知错因。

诊断题保存原题版本、证据ID及evidenceOutcomes、概念、理由与对话；共享reducer重验合同、引用顺序、题干及规则。知识范围独立，没有parentQuestionKey，计划完成条件为independent_correct，不能冒充原题迁移/掌握。随后“独立检验原题”中，v2方程诊断保留原数域、原定义域和全部解要求，左右互换并负倍缩放后重新独立验题；其他题复用既有受限变式。帮助隔离，缺条件、partial与提示后正确不能冒充完整独立成功。更正撤销诊断关联，私人原资料删除覆盖诊断题与后续变式。v1题干/理由冻结，旧事件、同步和备份仍按v1重放，不自动替换为v2。

本地repository.previewRestore(JSON)返回新增/复用/待复核计数和owner/revision；小备份仍使用最多500操作/150万字符/32层/2秒合同。较大旧v1备份和learning-history-v1分页包走异步prepareLearningHistoryRestore，每批最多20操作/140万字符，进度、AbortSignal和120秒硬上限；输入JSON最多1200万字符，事件正文和最终状态最多600万字符/2万操作。预览无持久写入，保留原始业务校验，不信任导入结果；分批途中出现墓碑也不能隐式删除当前资料。

大小备份的页面确认均使用私有预览 token，绑定完整输入、owner、revision及lifecycle；小备份也不能把一份预览用于另一份有效正文。新预览或 `cancelPreview` 撤销旧缓存，异步校验结束后复查请求代次与取消信号。Store 把完整预览交给 `restoreData`；repository 的数字版本参数只保留给既有内部调用兼容，不作为页面确认合同。再次确认后才保存 recovery 前态并应用完整结果。变更、切换账户、取消和超限使预览失效。Store 禁止历史校验并发，账户往返、记录重建或校验期间新作答会取消旧任务，收尾清空进度；同账户合并、不自动上传。rollback 恢复最近一次写入前态；非法结构、账户不匹配、冲突、验证或提交前保存失败保持当前记录，提交后清理失败如实报告并在下次读取重试，不虚报全部完成。备份文件格式、学习事件及服务端同步协议保持兼容。

本地分页新增可选 `learning-page-gzip-v1` 物理编码，复用现有 pako 1.0.11 官方构建；仅在压缩表示更小且载荷不超过120000字符时采用，否则沿旧原文页。目录仍为 `learning-pages-v1`，学习状态、公开备份和后端协议不变。压缩页先核对owner/generation/index、字段、声明长度及规范Base64，再逐块限制解压，必须完整到达gzip尾部、无额外尾部且长度和原目录校验和一致；缺页、损坏、未知编码不当空记录。恢复副本复用、原子根切换、只读窗口/写租约、隐私清理及固定访客读取均沿原保护。旧原文页可混读；不支持编码的旧读取器会拒绝新页，旧二进制回退和正式安装更新须独立验收，不能靠清空记录绕过。压缩不是加密，不放宽600万字符/2万操作、1200万输入或时间/请求边界。

访客迁移使用固定访客读取入口：previewGuestMigration → migrateGuest(preview, consent)。再次核对当前账户、版本及访客内容指纹后写入；同日计划使用 plan.merge 保留双方任务与完成依据。不能通过普通备份修改 owner 越权。

同步冲突：先归档双方；预览绑定账户、本机 revision、记录生命周期及实际归档身份。新归档保存独立 generation，旧无此字段的归档用完整内容建立身份，仍可读取。adoptRemoteConflict 在发请求前核对当前归档，再重新 pull；远端指纹与预览、本机版本/生命周期均一致才采用。restoreConflictLocal 恢复本机冲突副本；页面/Store 清除归档也必须传入当前已确认的预览，repository 无参数入口仅保持既有内部兼容。移除后重建、同版本替换或记录删除/恢复，均不允许旧确认作用于新副本；H5 同账户归档 Storage 变化也撤销旧弹窗。已有不同冲突归档不被新冲突覆盖，采用/恢复继续保留双方原归档。学习备份格式、事件与后端协议未变化。

同步首个请求发送前显示等待、阶段与请求尝试数；读取/补传/分页继续原预算，不把请求尝试当成功。Store 反馈绑定当前请求、账户和记录生命周期，离页/账户往返/记录重建后的迟到结果不进入新页面；同步自身的成功提交可以正常推进生命周期。取消不能撤销已经成功上传的批次，也不能撤销已完成的云端删除。`/learning-sync delete` 必须同时确认 `deleted:true` 和 `modelResultCacheDeleted:true`，且当前账户/生命周期仍一致，才显示完整删除回执；旧回执不因同账户、同 ID 重建而恢复有效。本机原件保留，后续主动同步可以重新上传，其他设备也须停止同步。

大同步：pull小状态保持`{state,revision}`，大状态返回`{history:manifest,revision}`；page输入`{revision,generation,offset,count}`，count为1至3，响应包含owner、相同revision/generation/offset及pages。页面最多120000字符，revision/generation过期拒绝；不保存旧服务端快照供绕过删除。客户端至多重新pull一次处理版本变化，仍冲突则保留本机。

push可选`returnSnapshot:false`返回`{accepted,revision,snapshotRequired:true}`；旧调用仍可接完整或分页快照。客户端每批最多100操作/600000个JSON字符；服务端原2MB请求与800000字符单操作门禁保持。相同重复操作和纯pull不增加服务端revision。整次同步最多512请求/10分钟、客户端24次/61秒；鉴权及服务端30次/分钟不放宽，所有分页继续检查归属、取消和生命周期。资料墓碑先确认后重新读取，普通上传完再读完整服务端事实，不根据确认收据编造统计。

客户端现在逐批检查接收事实：精简回执及旧服务返回的分页回执，其 `accepted` 必须包含本批全部操作 ID；小完整快照须含本批全部操作且同 ID 内容一致。旧服务忽略精简选项返回分页快照时，继续重新 pull 当前完整版本。隐私墓碑确认缺失立即停止，不先补传普通正文。最终完整云端状态必须包含本次开始时的全部操作；成功回执之后云端缺失操作也不能显示完成或用本机重放掩盖。只有同步途中新增的本机操作可保留在本机供下次明确同步。接收进度仅在本批验证通过后增长，已接收全部也仍需最终完整核对；这些规则不改变服务端协议、授权或预算。

### 网页备份文件读取

H5 恢复入口新增浏览器标准文件选择，桌面宿主继续调用原生选择器。只读取本次用户选择的一个 `.json` 文件，不上传、不执行操作、不自动恢复；读取成功仍须现有同账户校验、完整预览和明确合并。物理文件上限沿桌面 4800 万字节，解码后沿现有 1200 万字符输入上限；逻辑状态 600 万字符、2 万操作及校验时限保持。先核对字节容量再读取，完整 ArrayBuffer 必须匹配文件容量，严格 UTF-8 拒绝损坏文本，不使用替换字符静默改写正文。

文件读取绑定账户/记录生命周期、revision、原备份输入及当前页面和恢复面板。输入往返、账户往返、记录变化、收起面板、离页/卸载和明确取消使旧回执失效；失败和取消保留原输入与当前记录。重复选择和校验在读取期间禁用，浏览器提供明确取消入口；不靠窗口重新聚焦猜测选择结果。系统 cancel 事件关闭选择，没有该事件的浏览器仍可使用页面取消；缺 FileReader、严格 TextDecoder 或取消能力时保留粘贴入口并说明限制。读取结束清除临时 input、事件监听与 FileReader，正在读取时中止，不保存绝对路径或新建服务端文件权限。源码见[记录文件](../src/services/learning/record-files.js)，原恢复合同继续适用。

### 完整历史的复制与计数

原两万操作压力用例仍沿20秒、5MiB隔离存储与完整重开/后续写入/回滚断言。共享Domain保持原JSON序列化/解析的隔离副本；普通整数和字符串快照直接采用同一序列化正文长度，可能有非规范数字或转义的正文仍按解析后重新序列化计数。计数继续是JSON的UTF-16字符数，6,000,000字符、20,000操作、每批最多500和恢复每段20操作不变，不用近似字节数放宽上限。

连续message.add仅在当前隔离批次复用操作索引；每次新批次/账户独立，保留首次标识的语义。非消息操作、历史数组变化、失败和结束释放索引，隐私重写后不复用旧正文。重复内容沿原收据，同标识改内容、已删除记录和失败批次继续拒绝；索引不进入学习事实、备份、同步或日志。

实际网页完成20,000操作文件选择、原120秒预算预览、明确合并、50条消息分页及普通重开。首答2/6、计划6/10、7作答、0待核对和停止来自本机合成算例；输入时区不覆盖当前账户边界，仍为America/Los_Angeles。3,121,682字节公开正文在阅读与重开前后逐字相同。统计只将缺知识点时的内部题目标识显示为原题文字，原分组、明确知识点和时区原值不改。[证据](08-TESTING-INFRA.md)、[界面](06-FRONTEND-REFERENCE.md)。

### 历史同步反馈、当前回执与页面生命周期

同步按钮旁保留短结果，并以role=status/aria-live提示；进行中禁用重复发送，取消确认不发送。失败原待办保留，成功与部分未完成分别说明；结果不由关闭加载提示一并抹去。确认捕获账户/令牌和原文，页面退出/卸载或账户变化使旧反馈与刷新失效；同账户换登录会话的迟到结果也不留下永久“同步中”。本机同步映射保存后直接刷新，不用独立延迟定时器。

mistake-manager的列表和冲突读取不使用通用短时缓存，避免上传成功后仍展示旧数量，或以旧缓存冒充当前云端版本。授权、隔离、限流和原件准入不变。核心正式导出只包含学习核心；历史原件在既有历史缓存/后端独立比对，不能把核心导出宣称为整个历史题库导出。[证据](08-TESTING-INFRA.md)。

### 网页版本更新保护当前工作

仅普通H5构建启用更新机制；desktop标志、App和小程序不注入该浏览器引导。现有Workbox使用prompt、skipWaiting=false、clientsClaim=false，新版本安装完成后等待旧控制窗口结束，不强制刷新或主动认领当前页面。公共registerSW.js由现有PWA资源复制合同输出，H5头部只注入一次defer脚本；缺声明的源文件构建失败，不沿用生成的旧引导冒充实际实现。

首次安装不显示“更新”；已有控制器且registration.waiting就绪才显示一次可关闭的通知。窗口重新可见时检查公共sw.js，失败保留当前页面，不重载、提交、改写或删除学习资料；通知只提示完成当前任务后关闭所有Yozi页面再打开。“继续学习”只关闭通知。首次从没有提示代码的旧程序迁移，需要正常关闭旧窗口，之后才具备后续更新通知。私人API/资料不进入公共静态缓存，原缓存隔离及删除旧派生HTTP缓存的合同保留。

该选择依据[Workbox生命周期](https://developer.chrome.com/docs/workbox/service-worker-lifecycle/)与[Vite PWA更新说明](https://vite-pwa-org.netlify.app/guide/auto-update)，实际生命周期、原稿/原答保全和离线观察见[08](08-TESTING-INFRA.md)。没有将本机缓存试验当成生产切换、后端鉴权、日常App或设备验收。

## 账户与登录

### QQ 应用归属与平台身份

`POST /login` 的 `type=qq` 只接受 `h5`（省略平台时兼容）、`app`、`mp-qq`。网页与小程序只提交有界一次性 code，网页带发起时保存的相同 redirectUri；不能改用客户端 accessToken。App SDK 仅经现有 Store/API 提交 `{accessToken, platform:"app"}`，不获取或上传客户端资料/角色，不以客户端 openid 创建身份；120 秒共享期限涵盖 provider 与 SDK 等待，重复/迟到回调只结束一次，页面/账户变化后不交换或保存旧会话。

网站服务端配置为 `QQ_APPID/QQ_SECRET`，移动 SDK 凭证必须对应独立 `QQ_MOBILE_APPID`，小程序独立使用 `QQ_MINI_APPID/QQ_MINI_SECRET`。两个小程序新字段均为空时兼容完整旧 QQ 配置；填写任一新字段后必须填写完整，不能混合旧密钥。缺移动配置不借用网站 AppID。固定 QQ HTTPS 请求各限 10 秒/64 KiB，不跟随重定向；token 参数精确编码，支持 JSON 及受限旧 JSONP/form 回执。网站和 App 均须核对 QQ `/me.client_id` 与服务端对应 AppID 完全一致，以及合法 openid/unionid，核验前不写账户。[QQ 官方回执](https://wiki.connect.qq.com/获取用户openid_oauth2-0)。

只有服务端一致的 qq_unionid 可以衔接已有账户；平台身份分开存储，已绑定身份冲突返回 409，不自动合并。资料仅从核验后服务端固定接口读取并筛选，供应商 token/小程序 session_key 不落库或响应；原始描述、凭据网址和账户标识不进入新 QQ 登录日志。客户端仅保留完全匹配的固定 QQ 业务提示，夹带详情时仍拒绝显示；原零自动重试、鉴权及限流保持。

相关 8 组 189 项、当前各端构建、真实隔离 Mongo 索引与并发检查，以及不可变归档实际启动均通过；合成供应商回执不证明真实 QQ 授权，App/小程序 SDK 与真实授权另验。腾讯私有主库限定身份迁移随后已独立接受。Tauri 仍沿原明确未接入提示和邮箱入口。身份迁移事实见[05](05-DATABASE-SCHEMAS.md)，客户操作见[09](09-DEPLOYMENT-GUIDE.md)。

### 受保护的身份索引迁移

既有管理员函数 `db-create-indexes` 在原管理密钥校验之后接受 `scope:"user-identities"`，当前本地源码只创建 users 的九项身份唯一索引（含新增网站微信约束），不重命名原邮箱索引、不迁移账户或其他集合。腾讯上一批已接受的范围仍为八项，本批增量尚未应用。省略 scope 或 `all` 保持完整迁移兼容；其他值返回 400，未授权请求在范围解析和数据库操作前拒绝。身份范围任何一项失败返回 `code:1 / success:false` 与固定消息，不把原始重复身份、供应商标识或驱动错误写入响应/日志；重复执行已存在的同定义索引仍成功。完整迁移的旧警告流程保留，不能把警告当成身份范围成功。

独立后端继续不公开该函数的 HTTP 路由，管理 JWT 不能代替原管理密钥。腾讯私有主库已通过冻结维护租约中的限定迁移与独立回退演练；这项索引验收不证明公网入口或真实第三方授权可用。[实际索引与范围](05-DATABASE-SCHEMAS.md)，[部署和回退事实](09A-LAF-BACKEND-DEPLOYMENT.md)。

### 网页登录回调

普通浏览器微信网站登录沿原 `/login`，请求仅为 `{type:"wechat_web",code}`，使用服务端独立 `WX_WEB_APPID/WX_WEB_SECRET`；缺配置拒绝，不借用公众号、小程序或移动凭据。前端 Auth Store 导出 `loginByWechatWeb`，沿现有 API 禁用网络/冷启动自动重试并脱敏错误；成功回执由回调页完成账户/页面一致性检查后才保存身份。请求 `wechat_h5` 继续为公众号，移动和小程序原合同保持。

H5 发起时将 `wechatMode`（`website` 或 `h5`）绑定到原同源随机授权上下文；普通浏览器使用网站 `qrconnect/snsapi_login`，微信内使用公众号 `snsapi_userinfo`。返回只信任初次保存的模式，回调参数不能改应用类型；旧上下文未含模式时兼容公众号，未知模式拒绝。网站公开 AppID 与同源完整返回地址分别由 `VITE_WX_WEB_APP_ID/VITE_WX_WEB_REDIRECT_URI` 提供。本轮本机真实 Mongo 与合成网页返回通过，真实微信授权仍待应用审核、配置和发布，见[客户指南](15-MANUAL-SETUP-GUIDE.md)。

平台登记入口为同源静态文件 `/oauth/qq.html` 与 `/oauth/wechat.html`，不能登记 `/#/pages/login/...`。入口先移除普通查询与片段，只把 code、state、error、error_description 交给固定的现有页面；重复参数全部保留，由既有校验拒绝，其他重定向参数不转发。静态页不交换凭据、不写身份、不发送网络请求，使用同源脚本、限制性 CSP 和 no-referrer。H5 与桌面网页产物包含这些文件，微信/App 不复制。QQ 服务器的来源回退也改为 `/oauth/qq.html`；显式地址含片段、URL 凭据或未许可主机时在上游调用前拒绝，不换地址继续交换。服务端配置仍由运营维护，必须与平台及客户端完全一致。

QQ 与微信继续通过已有 Auth Store 调用 `/login`，QQ 的 `redirectUri` 使用发起授权时保存的同一地址，不由回调页重新猜测。客户端授权上下文保存在既有全局 `qq_oauth_state` / `wx_oauth_state` 键，包含随机 state、origin、redirectUri 和 createdAt，最长十分钟；旧字符串记录须重新发起登录。发起与返回页面必须同源，缺配置、安全随机源或存储失败时不跳转。

回调页已登记在登录分包，使用页面 onLoad 参数并核对 URL 普通查询与 hash 查询。缺失、重复、冲突、过期或取消的授权均先消费校验上下文再拒绝，不交换凭据；回调参数从地址栏移除，页面不记录授权码或 state。离开页面或请求期间账户变化后，不保存迟到身份；成功后仍沿既有加密存储、用户隔离及事件通知。后端 QQ 回调域名、鉴权和限流合同不变。

Tauri 主窗口继续仅加载本地页面。桌面 QQ/微信网站授权已接系统浏览器与一次领取回执，沿现有 Store/API 使用 `POST /login`、`type=desktop_oauth`，不加载远程特权页面。[腾讯文档](https://wiki.connect.qq.com/使用authorization_code获取access_token)明确不支持 App 内嵌 H5 登录。真实供应商审核、正式回调发布与公网业务仍须独立验收。

桌面接续合同：`begin` 仅接受 provider/challenge；原生系统生成 32 字节随机 verifier，其十六进制字符串的 SHA256 为 challenge。verifier 只留桌面当前动作内存，不进入授权 URL、存储或日志。服务端随机会话最长十分钟，绑定平台、应用、固定 HTTPS 回调、发起桌面 Origin 与 challenge；先核对保留期限索引再创建，默认 `DESKTOP_OAUTH_ENABLED=false`。原生命令只打开固定 QQ/微信网站授权主机、路径、scope 与严格参数；普通网页即使有编译标志也没有原生权限。

浏览器在现有回调页以 `complete` 提交 provider/state 与 code 或固定 error。服务端核对注册回调 Origin/应用，再原子占用一次授权码交换；浏览器只收到 `desktopReady`，不会保存问理身份、改其原账户或跳转到已登录首页。短期库仅暂存经认证加密的账户引用，不保存 JWT 或供应商令牌。取消或到期后，晚到换码结果不能恢复 ready。

桌面 `poll/cancel` 必须携带原 sessionId/verifier 并来自发起 Origin。每 IP 每分钟 30 次，在读取会话前限制；其他登录尝试保持原 5 次/分钟。客户端等待至少三秒，只对明确 pending 继续，错误、页面隐藏/卸载、账户切换或超时停止并尝试取消，不自动重开或重放。页面隐藏采用单调代次，快速返回不能重新接纳旧结果。领取通过原子 ready→consumed 仅成功一次、清空加密结果，再读取当前用户状态签发问理凭据；账户停用、篡改、过期或重复领取拒绝。成功后聚焦原普通窗口，再沿原身份保存与用户隔离返回；浏览器回执不是桌面已登录证明。本合同是应用接续校验，不宣称供应商 PKCE 或标准设备授权协议。

`wechat_h5` 对应公众号微信内网页授权；`wechat` 无 platform 或 `platform=mp-weixin` 对应小程序 code2session（旧客户端 `weixin` 别名继续兼容，当前 Store 已使用 `wechat`），`platform=app` 对应开放平台移动应用。未知类型或平台返回 400，不回退小程序。移动 App 使用官方 SDK 的 `onlyAuthorize=true`，沿现有 Store/API 仅发送一次性 code 与 platform，不取客户端 access_token、openid、昵称或角色；SDK 等待上限 120 秒，重复/迟到回调只结算一次，页面卸载或账户变化后不继续换码、不保存迟到身份。[DCloud 官方说明](https://uniapp.dcloud.net.cn/tutorial/app-oauth-weixin.html)。

服务器独立使用 `WX_MOBILE_APPID/WX_MOBILE_SECRET`，公众号仍用 `WX_GZH_APPID/WX_GZH_SECRET`；缺对应配置直接拒绝，密钥不进入客户端。两种 OAuth 复用固定微信 HTTPS 换码/资料地址，code 限 10—200 位字母数字/下划线/连字符，每次请求 10 秒、响应 64 KiB，拒绝重定向和非 200/畸形凭据。服务器重验 openid/unionid 的一致性；移动身份为 `wx_mobile_appid + app_openid`，不与同值小程序/公众号 openid 混用，只有一致的服务端 unionid 才衔接已有账户。已有绑定冲突返回 409，不自动合并。供应商令牌只在服务端内存使用，响应仅返回问理 JWT 与允许的账户字段，上游错误对象/描述/含凭据网址不进入日志或响应。登录 API 在既有请求层显式禁止网络/冷启动自动重放；失败回执只保留数字状态和固定消息，不附原始错误/响应体。未认证登录失败不广播已有账户失效，客户端不把凭证、供应商描述或账户标识写入登录开发日志；用户重新发起才再次发送凭证。

上述移动分支已通过本地源码、编译产物、合成上游与真实隔离 Mongo 并发检查；唯一索引及实际迁移见[05](05-DATABASE-SCHEMAS.md)。腾讯新候选暂存与私有主库限定迁移已独立接受，公网入口尚未切换；原生 SDK 装配、真实微信授权和普通浏览器扫码仍未验收。客户操作与字段映射见[09](09-DEPLOYMENT-GUIDE.md)。

凭据错误保留客户端完全匹配的固定邮箱业务提示；新用户须先验邮箱的回执重建为已有“该邮箱未注册，请先注册”，沿原表单切换。密码强度错误仅重建固定提示，未知描述不显示；“未设置密码”不归为验证码错误。邮箱登录和验证码发送在显示结果前关闭加载状态，finally 仅解除提交状态，避免立即清掉刚显示的成功或失败提示。最新 Mac 独立包在普通窗口用合成 HTTP 实际验证：协议未确认零请求，三次明确登录各一个 POST，首次失败后至少 95 秒没有自动重试，服务繁忙/注册接续/密码错误提示可见，不展示原始错误；该范围不含真实账户、SMTP 或供应商授权。

### 本机桌面合同补验

最新桌面前端在独立 Tauri 候选实际完成系统 JSON 读取、预览/确认合并、取消和系统保存。完整原答在学习页与概览共用原只读合同；阅读前后 37,555 字节公开备份逐字相同，旧 v1 保持未定位且停止后可读。v3 英文字段的首答错、带一条提示的订正对、无提示变式对分别保留可靠判分与来源；原四作答、六资料、前 27 事件保持。停止任务正常退出重开后，63,635 字节完整备份逐字相同。属于本机合成合同和确定性字面判分，真实模型语义、设备与正式发布仍分别验收。[本轮范围](12-CHANGELOG.md)、[桌面构建边界](09-DEPLOYMENT-GUIDE.md)。

## 刷题、原答与回执

### 单题有效用时、进度确认与原答恢复

单题时钟用performance.now（不可用时Date.now）测量实际间隔，不按setInterval投递次数加秒；停止时采样并冻结elapsedMs，提醒界面按整秒显示。暂停保存累计值，恢复从新锚点继续；软超时只提醒、不停止计量或自动提交。指定单题/临时组/智能组/整卷/旧交接首题、明确继续和题目切换启动对应时钟。每次启动产生token，页面停止/暂停/恢复与拒绝续答只引用自身token，旧页不能终止新题；账户改变重读本账户设置，通知不再作用于旧页。

未提交题的进度可附questionTiming={index,questionId,elapsedMs}，必须对应同一位置和原题ID，有限非负且不超过24小时；不是学习或判分事实。续答只在明确确认后恢复该累计值。已提交且有合法attemptId的reference_match题目恢复原userChoice/已答/待核对结果，锁定选项且不开新的单题钟；继续到未答题才重新启动。明确另开练习仍可产生独立提交编号，接收重试沿原编号与冻结的答案/用时，不回填历史duration0。

自动保存捕获独立快照、账户及认证上下文；500ms期间换账户/令牌即放弃旧写入，立即保存或清除取消待写。v1.2.0进度把savedAt置于同一完整存档，以一次save明确true及完整读回确认；不再依赖两个键先后写成功。旧格式仍读私有EXAM_QUIZ_PROGRESS_TIME，过期/损坏只拒绝恢复而保留原件。EXAM_QUIZ_PROGRESS/TIME、question_timer_settings/time_records不从访客空间自动迁移，正常preserveLearning退出保留这些私有记录。可靠判分/复习准入没有改变。[依据](08-TESTING-INFRA.md)。

### 导入前原件、只读题库与零号回执

闪卡适配先验证原输入、捕获完整quizOriginal，再投影显示题。原始字符串/带label、text/value/content的对象选项及其页码等元数据保留，26项/4000字符约束与结构/凭据限制继续成立；标号错配拒绝。数字参考按已有零起始下标规则生成显示字母，原件中仍保存数字；缺参考/编号/题干、重复编号或凭据夹带整组拒绝，不补默认A或跳过缺项。父级文件来源/许可等作为importContext保留，明确试卷ID用于限定导入归属；显示材料的静态地址在视图解析，不改原件路径。父级来源不冒充卡片来源，更不授予评分或公开权。paper/paperMeta/provenance也进入受限原件合同。

新原件导入先改独立副本，同编号跨试卷或已有编号歧义拒绝；明确更新同一卷时，不把上一版本缺省的内容/来源字段粘到新原件。已有非内容标记保留，但不成为新可靠成绩。保存明确true并完整读回后才报导入成功。选题准备只允许原始数据或确定的显示投影，改文章、选项、参考或来源不能沿旧快照通过。

v30_bank、备份/原答、载入标记、私有选题交接与收藏键不能从无前缀访客空间自动认领，旧通用migrateLegacy:true也不授予归属；登录的通用migrateUserKeys跳过这些键。访客原件留在原空间，归属确认沿现有明确导入/学习迁移。正常退出的preserveLearning保留题库、必要备份、原答和收藏/收藏夹/设置，仍可清理普通会话缓存。题库刷新只读、不自动恢复；旧AI生成保存、隐式恢复/清空返回失败并保留原件，现有学习核心与明确维护合同继续使用。未注册冲刺入口沿完整私有交接，不替换现题库/备份或制造选项；其旧掌握/到期视图并未据此验收。

旧answer-submit保持原鉴权、参数白名单和幂等。接收回执的question_id采用同值文本：整数0送"0"；本机原件、进度和原答ID仍为数字0。mode本来就是normal，没有放宽服务端模式或ID规则。回执只证明收到原答；完整原件进入后端仍需现有“同步学习记录”的明确授权。原参考、许可和原版本保持待核对，无可靠判分或FSRS准入。[证据](08-TESTING-INFRA.md)。

### 完整原件、账户与本次练习绑定

新智能组题使用私有 `quiz_review_handoff_v1`，不是新的学习记录中心。`prepareQuizReview({ids,expectedOwner,paperId})` 先严格读取当前账户题库，再完整命中所选编号、保持顺序和数字0；至多200题、交接至多3600000字符。原件不全、重复或错卷先拒绝。保存值为 `quiz-review-handoff-v1`，包含一次编号、ownerId、paperId及每题完整quizOriginal；保存明确true且严格读回与预期相同，才返回可跳转入口。账户/登录会话变化、false、异常或读回不符均不报成功。

练习URL的reviewId必须与当前账户、保存体和试卷一致，原件快照不可缺。读取保留交接，普通重开仍用确认时原题；题库后来改变不会替换原参考。新入口失效不回退普通题库或旧全局编号。旧smart_review_ids保持兼容存储原样，不能证明当前账户选题；旧无编号整卷URL只读取当前私有整卷且不消费它。进度handoffId区分两次相同选题，明确resume继续原进度快照。

整卷加载跨异步等待固定账户和登录会话；导入先改独立副本，保存false/异常/读回不一致停止，不假报同步成功。新整卷练习、完成页推荐下一组和未注册旧智能页共用交接，开启不写连续复习或可靠成绩。旧智能页仍未重新注册，其历史到期/掌握显示没有据此验收；原导入适配器更早丢失完整来源的问题、冲刺替换题库及其它隐式恢复写入继续单列修复。当前交接保存的是已有题库中的完整原件，不声称已追回旧导入没留下的资料。[证据](08-TESTING-INFRA.md)。

### 查看、自评与旧调度写入

经典闪卡查看/四级自评通过quiz-learning-bridge的recordQuizLearningObservation使用已有会话、完整原件、焦点、帮助与消息。查看为notice及hint，自评为明确user消息，并关联同会话/同完整原件版本的已保存查看编号；不创建attempt、grade、review或旧FSRS卡，不增加fsrs_review_count或触发优化。原件、稳定编号、账户/令牌/页面/题目/会话及写入租约分别核对；重复同编号同内容只确认，内容或自评不同继续冲突，停止/错配/保存失败不能冒充成功。帮助文本只作短预览，完整参考仍在原件。

只查看不算卡片完成，进度保存observationId/referenceId。明确续答恢复原查看状态，读回核心事件与完整原件确认，不重放成作答；旧无可确认查看编号只提示重新保存。自评明确保存后才前进；失败持续提示，保存中禁止重复，按钮有键盘/禁止语义。展示“已查看/自评”，不称可靠复习或考试正确率。已有真正可靠作答/到期复测的FSRS核心保留。

rateAndNext仅前进，不凭旧布尔值或参考匹配调度。旧quiz-mistake-handler的自动错题保存返回RELIABLE_GRADE_REQUIRED，AI原件覆盖返回ORIGINAL_IMMUTABLE；原答/可靠错题由已有独立核心承担。退出\_restoreQuestionBankIfReview不恢复或删除未决旧题库/备份/标志，恢复须走明确恢复合同；旧声称弱项和无可靠依据的诊断不能继续产生事实。解析显示固定当前上下文，迟到显示停止，不改原解析。

私人归一化重放保留问题/会话/原答/复习事实，原有规范器会给question.add原始事件加publishable:false，不能声称归一化前后事件字节完全相同；该拒绝公开的边界保持。[证据](08-TESTING-INFRA.md)。

### 收藏原件与绑定单题交接

收藏沿本机question_favorites/favorite_folders/favorite_settings，不新增账户或记录中心。原始题或显示题必须与完整quizOriginal一致，按完整内容/来源/版本身份区分，同题干或编号不同内容不合并。读取当前账户的独立副本，不自动认领无前缀访客数据；旧收藏缺quizOriginal保持原样可见，不能补造完整原件重练。精确收藏ID可删除指定版本，同编号多版本的模糊删除拒绝；对象查询保留完整身份，数字0不变空值。

所有编辑先改副本，当前账户仍相同且storageService.save明确true后才更新内存/成功。页面弹窗携带读取时账户，旧笔记/删除/移动/重命名不能改另一账户相同ID。收藏夹删除只持久化一次收藏夹变更；其原条目完整保留，读取时无有效夹归入默认夹，避免半成功的两份写入。旧reviewCount/lastReviewAt只是旧标记；recordReview返回RELIABLE_REVIEW_REQUIRED，不新增活动复习/FSRS或可靠统计。

私有原件读取使用migrateLegacy:false/throwOnError:true。后者是可选严格模式：网页兼容运行时直接读当前持久值，JSON损坏或读取失败向调用者报错，不用空数组覆盖未知原件；普通get的既有缺省行为保持。当前收藏/单题使用严格读取，其他旧调用仍逐项推进。

“练习此题”在同账户读取当前精确收藏原件、保存并读回确认temp_practice_question后才跳转，值为quiz-single-handoff-v1，含一次id、ownerId和完整question/quizOriginal；singleId参数必须与账户和交接完全匹配。替换、错编号或保存不确定拒绝，旧临时值不冒充这次交接；成功准备后消费，不写学习事实。进度context的handoffId区分同题的不同练习入口，明确resume仍按原快照恢复。当前私有命名空间的旧完整临时原题继续兼容，但带新singleId不回退旧值；此为此前单题阶段，智能组题归属已由本页最新合同接续。

收藏页已经查看参考时，交接保存legacy-review-view-v1的referenceViewed=true；明确提交后沿独立核心记录帮助和原答，仍pending、无复习，不将参考视为可靠成绩。来源/许可声明不获判分或公共发布权。客户端注册pages/favorite子包，个人中心“我的收藏”入口可用；阅读预览帮助区分同题干不同文章，原件存储保持完整。[证据](08-TESTING-INFRA.md)。

### 选题原件与作答编号合同

单题、临时题组、指定整卷和指定复习先按完整原件核对题干别名、原编号、真实选项/参考和完整资料，再生成显示字段；显示缺省文案不进入quizOriginal。题干兼容question/question_content/questionContent/content/title，编号使用空值判断，数字0合法。已保存原件与现题干/选项/参考/阅读/媒体/来源不一致或夹带已识别凭据时拒绝，不补造题号、四个选项或默认答案。

指定入口必须整组命中，缺失、重复请求编号或题库同编号多份均拒绝，保留未消费交接，不切换普通题或悄悄少题。整卷仍按原顺序，并仅消费与整卷编号/顺序完全一致的临时ID；普通智能组题保留算法，仅使用完整原件。交接在成功准备后消费，不写学习事实。跨页旧smart_review_ids的归属元信息仍待补，不能把本页检查当成交接权限完成。

本页加载时固定账户，选择、保存、明确提交及同步分别核对；账户存储不是响应式，提交动作另行检查，不能仅信任缓存的按钮状态。答案和进度保持数字0，不与空编号合并；原参考匹配仍pending，不授予可靠判分或FSRS资格。收藏和旧自评调度/题库恢复等遗留写入仍单列待修。[证据](08-TESTING-INFRA.md)。

### 历史原件导入只保存，不增加错误或复习

mistake-manager的add/batchSync采用legacy-mistake-import-v1，复用既有mistake_book，不新增账户或记录中心。客户端先固定legacy_raw，再转传输别名；原选项、题型、参考、正文别名、阅读、目标片段、媒体、来源/许可/版本和旧状态声明分别保留。空答案、零计数和false不被其他别名覆盖；未知错误/掌握不补造。旧时间保持原值，缺时间才由本次归档写入时间补足。整个原件在传输和服务器两侧检查有界数据及已识别凭据/程序属性。

服务器身份始终来自JWT，保留授权、限流与用户隔离。以账户、原导入编号、完整题面/来源和原答的确定性表示产生SHA256索引和固定私有记录编号；唯一插入发生并发冲突或响应丢失时只读同一记录回执，不再次加计数/调度。仍比较完整原件和旧状态，不能只凭索引宣称相同；来源/材料或原答变化另存，旧版不覆盖。旧缺材料记录只按已知原件精确重放，不补造材料/版本；新的完整材料进入独立原件。旧状态变化继续冲突，原声明不改写。

新增归档grade=pending/stats_eligible=false。旧错误次数、复习次数和掌握等是legacy_original.state里的原声明；兼容的wrong_count/review_count/is_mastered只回显声明，不能作为可靠判分。到期、稳定度等FSRS字段不从导入声明填到活动根字段，不创建FSRS卡、原答、学习任务或review_logs。来源SHA、许可、参考仅为声明，不赋予判分或公开发布权。已存在的旧原件及原答保持，独立学习核心与可靠复习合同不变。

批量最多200条、总3600000字符；每份原件1800000字符、12层/20000节点，题干8000字符/26选项等仍沿共享合同。整批结构/映射先验，空原件、坏来源、凭据或重复编号在第一次写入前拒绝；合法批次每组5条处理，失败也按原编号返回，结果不明不转另一入口重复提交。updateStatus对认证请求返回409，不把旧掌握标记当复习。updateFields只允许标签/笔记（note兼容），界限外或混入原件/学习状态的请求整次拒绝；有界文字原样保存，按账户与编号写入，零更新须读回确认，不能虚报更新1条。[证据](08-TESTING-INFRA.md)。

### 旧记录客户端写入固定账户，保存失败不得报成功

新增、冲突处理和冲突批处理接同一历史记录队列；捕获账户与登录令牌，排队后及远端每次返回/异常后再次核对。新增原文在调用时固定副本，之后修改草稿不改变已确认内容。当前账户或令牌变化、已取消响应不触发本机降级，不写后来账户；访客记录不会因登录而自动迁移。读取与新增串行，缓存独立副本在保存成功前不改变原数组；保存失败返回失败，远端已保存则单列remoteSaved/编号供原账户核对，不报本机完成。

指定云端编号、分页和false筛选放入mistake-manager的data，实际后端才会消费；账户仍由JWT决定。冲突须取得成功的精确编号与原账户云端版本，普通分页包装/其他编号、失败响应或缓存里的旧云端副本不得冒充当前依据。原题/原答或旧状态不一致时继续保留冲突，不自动拼接或覆盖。相同原件和相同旧状态仅处理标签、笔记；发送字段只允许这两项，不重写正文、原答、错误次数、掌握或FSRS状态。写入/本机保存未确认时仍失败，等待期间本机记录变化则保留最新缓存。

同步超时、异常或缺少明确回执时保持原待办，取消旧的立即逐条重发；远端可能已经保存，观察失败不能解释成尚未执行。回执兼容既有编号别名，拒绝重复或未知对应关系，未返回的原条目保持待办。旧掌握入口兼容返回RELIABLE_REVIEW_REQUIRED，不发远端请求、不写本机作答/复习；新复习仍由现有可靠学习合同决定。

上述为客户端服务层合同。旧后端batchSync/add/updateFields/updateStatus的幂等、完整原件与统计准入仍须继续修复及真实接口验收，不能把本阶段替代后端或设备通过。[验证](08-TESTING-INFRA.md)。

### 原题先保存，再整理显示；原答绑定完整版本

新增共享`quiz-original-v1`，保存原题正文别名、原选项标号、原题型/参考/解析、阅读/指定片段、题图/答案页图、音频记录以及来源、版本与许可声明。手工拼接题干和选项不能替代原件；在旧条目交接及通用题目整理前捕获，显示时才转换标号、引用格式或图片说明。占位题干/选项不得作为原件入库。原记录与题库保持；新增副本只在明确提交时进入学习事实。

学习题目仍`scope=legacy/source.kind=existing_bank`、不可发布、无可靠判分权。来源编号/SHA/许可只保留原声明，不是认证或评分依据；即使题干匹配可计算数学形式，也不得忽略附加材料而自动判分。图/音频在原件中保全，相关播放与设备合同仍另验。

完整内容以确定性排序比较，短指纹仅作索引；材料、参考、媒体、来源或原版本变动创建新版本，旧原答仍指向旧题。旧的缺材料版本只能按已有题干/选项/来源编号与原会话/答案精确重放，不补造未知材料；新原答进入独立完整版本。显示与原件不符时，在创建对话或其他事实之前拒绝，读参考帮助保留实际原格式。私人同步与本地题目保存共用原件形状/版本/权限校验，伪造权威、错配与凭据载荷整批拒绝。

原件最多1800000字符、12层/20000节点，原题干8000字符、最多26个文字选项/每项4000字符；超过限制保全原件并拒绝新事实，不截断假装完整。原件只接可保存数据、指定字段，禁止已识别的访问凭据与程序属性，不执行代码或访问来源URL。统一页显示完整阅读/指定片段和待核对来源/许可；旧缺材料记录说明原答保留。[验证](08-TESTING-INFRA.md)。

### 历史错题只读汇总、完整交接与明确原答

旧报告仅统计当前载入的有效条目和原分类，缺失分类单列；不从旧错误次数推断能力、掌握、病因或学习收益。报告固定账户/记录快照，账户或原件变化、关闭和卸载均取消迟到图片；正文始终可用，图片只摘要前八个分类，复制保留全部正文。

单条重练沿既有`legacy-review-handoff-v1`，核对显示原件与当前缓存的题干、选项、参考、阅读材料、媒体及来源身份；缺失资料、重复编号、旧账户或内容变化均拒绝，原题库/备份不变。已看历史参考以`legacy-review-view-v1`带入明确提交，记为待核对帮助；选择仍为草稿，原答提交后为pending，不直接写掌握或复习。数字0编号保持。

历史读取、精确移除、批量移除和确认后的历史待办同步均固定账户/令牌，队列及每次远端返回后再核对；取消、账户变更或本机保存失败不写到后来账户。分页仅更新对应编号，保留未载入缓存和游客原件；打开历史页不自动上传，移除仅限明确确认的已载入编号。恢复资料处理时清除过期反馈，不把旧取消提示当当前任务结果。旧后端batchSync/add/update等其他写入和统一学习题目中的完整材料仍继续审计，不能由本批推出整个旧体系已完成。[验证](08-TESTING-INFRA.md)。

### 远端依据汇总与计划草稿

smart-study-engine 的 analyze_mastery 读取当前JWT账户的规范 learning_states，经既有历史校验再调用 summarizeLearning；缺记录仅返回空依据，不初始化或覆盖坏记录。可靠原答、需提示/待复测和实际到期项按核心事实返回，旧 answer_records 的全范围汇总单列 legacyHistory，复用 answer-submit 的 quiz-receipt-summary-v1 聚合，不受500条上限影响；不从旧布尔、题量或记忆常量推算掌握百分比。

sprint_priority/generate_plan 返回带原作答 evidenceIds 的练习建议和最多7天草稿；到期项保留 questionKey，仅列在首日，不虚构未来已到期。日期严格验证，按保存时区的日历日计算备考天数，当日考试不生成备考日；时间限0.5–12小时，草稿不写计划，不推算提分ROI或建议放弃学科。停止来源任务后不继续推荐，已有原答保留。

get_error_clusters 只分组旧标签/分类，最多扫描1000条且明示总量、扫描量、truncated；保留完整原题/原答/参考，不生成严重度、趋势或默认答案。deep_correction 现返回已有依据的复习提醒，modelInvoked=false/persisted=false，不从旧次数生成新病因诊断。get_pending_corrections 保留旧文本但标记 legacy_generated_reference/unverified/scoringAuthority=false；标记已读严格校验ID、账户及真实更新数。支持现有data参数和旧顶层参数，冲突拒绝；JWT、分布式限流及用户隔离保持。[验证](08-TESTING-INFRA.md)。

### 历史分组与完整条目重练

`getErrorClusters` 返回 `legacy-error-groups-v1`、当前ownerId、scoringAuthority=false；只按旧标签/分类计原条目数和可重练数，未知旧标签归未分类。不生成严重度、趋势、因果建议或改写error_clusters。该只读入口和重练交接使用storageService.get的migrateLegacy=false，避免读取时把无归属访客缓存迁入后来账户；此选项不改变其他旧调用默认行为。

`prepareLegacyReview` 按当前账户重新读取原记录，只接受唯一稳定编号、非空题面、完整选项及有效参考答案；完整多选保留全部标签，缺资料、重复编号、答案越界或选项标签错序保留原件且不重练。文字类保留非空完整参考，参考仍不具有评分权威。每次最多200条，另外区分资料不全skipped与完整未纳入deferred。

交接仅写当前账户专用legacy_review_handoff_v1，绑定launch id/ownerId/完整题目快照。答题页再次校验，入口失效时不换成无关题；不替换v30_bank、备份或旧review标记。已保存进度能独立恢复，不依赖后来交接。新明确作答仍是reference_match/pending，不回写旧原答或自动转为可靠判分。实际入口为错题页“历史题库记录→历史分组”；独立error-clusters组件未注册路由，未为此恢复退役页面。[验证](08-TESTING-INFRA.md)。

### 开源适配与客户端参考作答准入

所有外部能力都经现有 Service/Backend 适配，沿用 Yozi 的账户、对话、任务、原答和复习事实。外部用户编号不得成为授权依据；请求必须绑定当前身份、任务、题目版本、原件/片段和稳定提交编号。响应晚于停止、取消、换题或账户变化时，不得写入后来任务；网络重试沿原编号，内容冲突拒绝。新模块逐项登记上游精确版本、代码/模型/内容的不同许可、必要声明、适配入口和回滚条件，不直接覆盖上游文件。

| 输出类别                   | 可以保存/展示                                     | 统计与复习准入                                      |
| -------------------------- | ------------------------------------------------- | --------------------------------------------------- |
| 解析/OCR/检索片段          | 原件身份、页码/位置、提取工具版本、引用和不确定性 | 不生成已核实题目、答案键或学习成绩                  |
| 参考匹配/语法规则/模型建议 | 原答、反馈类型、依据版本、结果及局限              | 不自动计正确率、能力、错题、Elo或FSRS               |
| 受限可靠判定               | 由既有领域校验重建的题目级结果与完整依据          | 仅通过现有独立作答/帮助/教法/停止合同后进入对应指标 |
| 用户明确自评               | 用户选择、原题和时间                              | 保持自评复习事实，不能转换为考试成绩                |

本批 `do-quiz` 新选择题保留 `userChoice`、`userAnswer`、`attemptId`、`referenceMatch`，标记 `source=reference_match`、`grade.status=pending`、`isCorrect=null`。参考一致与不一致均保持待核对；只累计明确作答次数，不写 StudyStore、智能组题、旧每日正确率、计时评分、Elo、自动错题、模型分析和默认FSRS评级，也不按每题一分钟估算学习时长。继续按钮不代替用户自评。原始用时仍保存在原答/离线记录中。

共享进度按待核对、自评、旧判对/旧判错和依据不明分别计数。待核对与明确自评优先；其余只有没有 `grade`、没有 `submission_contract` 且无互相冲突的旧布尔字段才归旧判定。字符串、空值、未知权威和缓存自称可靠均不升级；旧比例仅以可分类旧布尔为分母，零分母为 `null`。本地题库摘要声明 `scoringAuthority=false`、当前 `gradedCount=0`、`accuracy=null`，不据此生成连对、能力、诊断或复习建议。原缓存不迁移、不覆写。首页/个人中心的“近期旧判对”只读最近逐题记录，不再拿无法核对来源的累计数量拼百分比。

学习引擎的 `learning-evidence-summary-v1` 从现有 learningRepository / summarizeLearning 读取题目级依据、待复测/需提示状态和实际到期安排；旧题库记录单列 `legacyHistory`。不把预设记忆值、旧错题数、题量或旧累计比例估算为掌握程度，读取不改写旧 `knowledge_mastery` 缓存。计划保留 `evidenceIds`，到期项保留 `questionKey`；已停止来源任务不再推荐。没有依据时仅给一般练习安排，不伪称已诊断薄弱点。此处修复覆盖共享答题摘要、主要历史显示和本地学习计划；其余旧选题算法与调用来源仍需逐项核对。

后端原答回执增加 `submission_contract` 和 `attempt_id`；客户端同时校验成功状态、协议、原编号、题目、会话、原答、规范答案、用时、模式及接收时间，匹配后才显示已同步，判分仍待核对。缺回执、失败和未知协议不猜成功。原答另存 `ownerId`；重试只允许原账户，沿原编号、原答和原用时，不读后来草稿、不重复计数。访客仅存本机；不自动把访客或身份不明的旧记录归入后来账户。停止、换账户/令牌或关闭页面后拒收迟到回执。离线缓存按账户和原编号去重并保留首次保存时间，冲突不覆写，坏缓存保留。

### 原答清单的只读分类汇总

现有 answer-submit/getRecords 增加顶层 `summary`，合同 `quiz-receipt-summary-v1`，范围为当前JWT账户及所有合法筛选命中的全部记录，不受分页/100条展示或500条掌握历史上限影响。一次数据库聚合同时计算 received、pending、legacyCorrect、legacyWrong；legacyGraded为两项旧布尔之和，其余为unclassified。显式grade.status=pending只归待核对，即使旧is_correct同时为布尔；只有既无submission_contract又无grade字段的旧true/false进入旧布尔统计。未知/缺失/null/字符串判分、新合同缺grade或其他未验证权威均不猜判，原文档不修改。

legacyAccuracy只表示保留旧布尔记录的比例，分母为legacyGraded，零分母返回null；`scoringAuthority=false`，不能称为独立评分或能力统计。记录列表/分页/筛选保持旧合同；Mongo的is_correct=null仍包含缺字段旧记录，但缺字段归unclassified，不能因null查询被叫作待核对或错误。JWT/注入校验/120次/分钟限流保持，查询不写作答、评分、FSRS、错题或模型事实。

当前157相关、3后端阶段与17真实本地HTTP请求10项通过；512条所有者混合记录、账户/筛选/分页、原答重传与后端/Mongo正常重开成立。最终246文件3963项通过、1文件6项原有跳过（109.97秒），两份源码/测试摘要保持。客户端旧正确率/Elo/智能组题及用户缓存统计尚未由此自动修复，远程Laf和设备另验。[验证](08-TESTING-INFRA.md)。

### 原始作答接收与不可变回执

answer-submit 已接现有客户端 snake_case data 和独立作答 idempotencyKey；身份只取 JWT。同一账户同一编号在原记录保留期间复用原始回执，同编号不同原始字段返回409并保全原答；内置 \_id 唯一约束使并发重传只写一份。原答含原会话、原用时和原选择，数字字符串/大小写的原始载荷保留，规范字段另存。缺合法编号、伪造正确性/身份字段、畸形筛选、注入或限流拒绝不写作答事实。

可用服务器题目只绑定提交时题面/选项/类型/分类/来源快照与摘要，不把注册 approved 或原 answer 当成独立评分依据；不可用、他人私有或 premium 只保留题号。新回执 grade.pending/is_correct=null，不自动写错题、FSRS、会话诊断或模型事实。getRecords 支持原 session_id/question_id 和严格 boolean/null is_correct，仍按 JWT 隔离；既有布尔历史不追写。smart-study-engine 在500条上限前排除待核对作答，其他历史统计与独立判分继续验收。

随后现有 practice.api/\_request-core/auth-storage 实际连接隔离 Express/JWT/Mongo，6请求7项通过：原字段/稳定编号、重传完整原回执、409、无JWT拒绝、同键账户隔离与迟到账户变化拒收。只用内存uni HTTP适配，不称浏览器/真机联调；服务器判分pending与零错题/FSRS/诊断/模型保持。首轮5项通过，内部嵌套errorType断言不属公共合同，已按失败/null数据/账户变化短句和真实数据库原账户事实复核，首份报告保留。两次合成库共回收420213948字节逻辑大小，当前依赖/源码和共享Mongo保持；原3942/8客户端未变部分复用。客户端回执呈现/其余统计、公共范文许可和完整矩阵继续。

### 续答身份与重传编号

续答快照可选sessionId仅接受1–64位字母/数字/下划线/连字符，只有明确确认才恢复该原身份；旧记录缺身份时保持缺失，不根据近期对话猜配后端会话。新明确选择提交保存独立attemptId，同一作答重传沿该编号作为idempotencyKey，新明确作答使用新编号。迟到分析绑定提交时题目/选择/位置/作答、账户和会话；上下文改变不回填后来的原答。非法身份或编号保全旧缓存并拒绝读取/替换。后端answer-submit仍有既有snake_case/内部字段不匹配，原400审计保持，此客户端合同不证明后端接收/持久化/FSRS或服务端幂等。

H5首次实操发现已保存原答没有进入本地对话记录：首次Web Lock申请尚未就绪。最小红复现后等待真实独占锁（最多2秒，释放/别窗/生命周期与账户变化仍拒绝）；只有明确继续后，才按已有会话/原作答编号补记已提交选择。不猜配旧缺失、跳过自评、不重发API/模型，不增加可靠评分；同编号不同内容在整批补记前拒绝，已接受历史收据幂等，停止后不接新作答。

新2项最小红复现onLoad忽略实际query及H5重试丢resume意图；已接宿主参数、仅当前do-quiz的H5路由四键回退，直接参数优先，其他页面不借查询串。224专项通过后再补优先/外国页面边界；写锁与补记版522相关/3894完整通过，保留为before-query-fix，最终10源码/17快照的相关、完整、8客户端与冷启动/稳定身份补记/正常重开重新执行。首次混用旧资源及原稳定C未入core的现场保持，不以正常刷新替代错误恢复验收。

最终当前范围525相关/3897完整、6原跳过（165.37秒）与8隔离客户端通过，10源码测试冻结一致；微信241主包1449804字节、12媒体132099/最大32728、含许可全部static146742及秘密/分包、App0阻塞审计通过。H5首次加载超时仍存在，页面重试保留原继续确认；明确继续本地补记原C同UUID/会话为pending，不增统计或重发API/模型。新D独立UUID仍属同一保存会话，原所有core集合前缀与218库保持；正常关闭重开16键1841071字节逐字相同，7条缓存记录（含2条自评），5份核心原答均pending、不重复补记，仍余31。只在该刷题资料范围成立，原H530身份/旧统计/后端答案真正接收幂等、Mac与设备/视觉/模型自然时间/长会话长期效果/公共许可和受保护发布继续；固定7e及1156979恢复材料未动，最新476f候选未安装，完整目标active。

### 通用续答恢复

上方继续训练只在现有账户有完整可恢复快照时进入resume=true，载入原题顺序/材料/选项/图片和原mode/paperId/指纹，不消费当前库、单题/拍照缓存或其他复习交接。明确确认才恢复原位置、用时与原答；第1题已答也可继续。原24小时可用边界保留，过期/坏缓存不可恢复但不自动删除；显式恢复缺快照拒绝，不悄悄替换20题。

恢复确认与重新开始绑定显示过的整份快照与当前账户；先核账户再读取，防止读取触发旧匿名缓存迁移。快照替换、过期或身份变化均保留材料并拒绝迟到动作。按原位置/题号计完整，不以末题或重复计数判完成；未完到末尾转首个未答题并保留原答，完整自评仍不是可靠判分。当前范围不证明原服务器诊断sessionId连续；该标识仍在页面onLoad生成，后续需按同一意图/重答与隔离合同独立处理。[验证](08-TESTING-INFRA.md)。

真实末题自评暴露旧rateFlashcardAndNext将1/2当错、3/4当对。新自评只存isCorrect=null/mode=flashcard/source=self*rating，保持FSRS自评安排，拒绝非1–4、未翻阅/锁定/错模式，不写答题统计、错误或正确奖励；先即时保存再下一题，切题撤去旧参考。旧flashcard_flip/flashcard_rating*\*即使保留旧true/false，也按reviewed解释，不重写原载荷；进度、答题卡、分类结果、连对/完美、模式摘要与薄弱点统一。纯自评不称考试正确率或触发无作答的诊断。[验证](08-TESTING-INFRA.md)。

结果合同统一按明确的flashcard/self_rating标记解释旧自评，不改原载荷。全自评只报告复习数量，不显示考试百分比、推断失分点或触发正确奖励；混合作答仅依据已判分分类给出分数建议。原服务器会话/重答幂等与旧统计历史仍是独立待办。

最终当前源3864完整通过/6原跳过、8隔离客户端通过；H5原38题/旧4记录保全，新自评isCorrect=null，旧核心3原答仍pending且答题统计不变。正常重开16键1823963字节精确。服务器session/重答幂等与旧统计历史另验，不把本地答案键正确率升级为可靠考试评分。

### 旧刷题选项草稿与明确提交

旧do-quiz的selectOption只更新当前题草稿：单选可更换，多选可加入/撤销，按索引排序；无效索引、无选项/翻译/闪卡、分析/导航/结果/已答状态拒绝。明确submitChoice才停止单题计时、保存一份原答并即时写现有续答快照，再沿原统计、分析、错题和反馈路径执行；重复提交不加记录。导航/恢复清草稿，不将草稿补成原答。

getQuizSelectionAnswer重建完整标签，多选必须精确匹配整组，缺选/多选/不同集合均不能按任意正确成员判整题正确；完整标签沿原分析、离线、对话学习、后端提交和错题载荷传递，旧单选索引记录保持。旧客户端isCorrect仍不是服务端判分证据；quiz-learning-bridge原答继续pending，不提升为一般能力、可靠掌握或官方成绩。原题源、公共门禁、认证/账户隔离/SSRF/限流/预算/幂等与停止合同保持，不增加接口或模型权限。[验证](08-TESTING-INFRA.md)。

最终100相关/3813完整及8隔离客户端阶段、微信/App审计通过。H5最终CUWy9jHU键盘明确提交ACD后，在下一题/隐藏之前即有3份完整续答；首2份原答与8集合前缀/画像保持，3份学习原答均grade.pending/no_independent_reference，0模型执行。正常关闭重开、明确确认第18/38题后，14项事实白名单1822782字节逐字相同，草稿空/提交禁用。Mac实际更新和完整目标继续待验。

### 指定整卷的刷新范围与原进度

答题页有paperId时，先从现有账户隔离的v30_bank读取该卷全部题目，保留原顺序、完整材料/画线句/题图及答案字段；首次加载与刷新均不进入20题智能组题。全局瞬态smart_review_ids仅在与本卷完整ID顺序一致时消费，其他复习选择保留；无paperId的原复习入口沿其既有明确选择。指定卷缺失、重复/缺ID、空题面或损坏缓存阻止加载并提示返回题库重试，不混入其他卷。

原mode/paperId/题目集合指纹与EXAM_QUIZ_PROGRESS账户范围保持。刷新可提示原未完进度，只有用户确认恢复才采用保存的位置/时间/题目快照；读卷和刷新不创建原答、可靠判分、复习完成或模型调用，不因导航解除学习对话的停止。原resume=true的明确恢复合同保留。本批不改变服务接口、来源/评分权威、公共入库、认证/用户隔离、SSRF、限流、预算或幂等。[验证](08-TESTING-INFRA.md)、[实际范围](06-FRONTEND-REFERENCE.md)。

当前H5实际刷新2007仍52题，180题/4库及原数学进度摘要保持；数学旧第24题先提示，明确确认后恢复，0新原答。新固定Mac程序95584e79…完整导出与正常重开仍1129028字节逐字相同；实际六处翻译及2010排序成立，答题卡末行可达性与余下题目仍待验，不能以功能/构建通过代替完整界面验收。

### 旧能力结论退役与语法检查选用边界

未注册的sprint-mode与smart-review复用原题分组入口；只读当前账户完整题库，展示题数与“作答后待核对”。选组沿prepareQuizReview确认完整原件与归属后才导航；不再读旧错误计数/连续天数/可提取性来推断掌握、诊断或提分，不设置考试日期、替换题库或恢复备份。有效复习调度仍由现有学习核心负责，这两份旧页未据此注册进产品。

旧questionTimer.recordTime返回LEGACY_TIMER_WRITER_RETIRED，不再写独立旧计时表。旧表可读，但单位未验证，scoringAuthority=false、reliableCount=0，效率分/趋势/最佳时段均不授予；有效非负有限值含0，以在线均值及逐项极值避免大值溢出和参数数量错误。当前实际计时、明确提交原答与暂停续答合同保持。

LanguageTool本机10句试验通过，固定官方稳定包6.6（2025-03-27）；选择下一阶段将其作为明确请求的可选英文拼写/语法帮助，尚未接入客户端或业务接口。它会误报Yozi，无法判断“五加五等于十一”，不自动替换原答、不打作文/雅思/托福分、不增加可靠复习。固定en-US、UTF-16定位和正文一致性须继续沿原账户/题目/作答/取消/帮助记录合同；本次没有向公共服务发送文本。[证据](08-TESTING-INFRA.md)。

## 题库来源与公共参考

### 本机题库来源证明合同

当前完形证明已增加完整空序和登记PDF身份；即使重算整个载荷摘要，缺空也拒绝。来源摘要不代表全部题面、语义或许可已验。[最终验证](08-TESTING-INFRA.md)。

已有静态题库的sourceEvidence.questionProof采用cloze-source-v1或english-section-source-v1，严格字段contract/bankId/sourceId/sourceFilePath/sourceFileSha256/sourceType/contentHash。证明来自已核对原PDF，完整题面、上下文/材料、选项、句段、原答案和题号均纳入载荷；翻译/排序额外绑定targetSegment/targetSegmentNumber/fixedSequence/fixedParagraphs。两门禁核对登记本机真实PDF字节，剥除证明/漂移/路径替换拒绝；完形另强制[1]–[20]完整唯一顺序，正文数字不得冒充空位，即使重算摘要也不放行缺空；数学裁切另按questionAssetHashes核对JPEG字节。

原answerEvidence、答案、ID、题量与启用状态保持，旧sourceEvidence在questionEvidenceHistory留存。此字段不新增HTTP权限、模型调用、自动提交或语义判分；来源摘要一致不证明许可、官方评分或完整公共发布。当前14覆盖/7来源缺口、待提升38处继续阻塞。[验证](08-TESTING-INFRA.md)。

### 政治缺页参考的补充来源合同

现有政治候选修复增加可选登记补充PDF，仅使用实际SHA256固定的10页聚创出版方参考第3页补10→D、11→A。题干措辞及OCR差异已阅图对应，原卷38题面/选项保持；不把补充卷替换成原题或官方答案键。referenceProof沿politics-reference-v1增加supplementProof，绑定来源ID、固定路径/字节、URL、物理页/题号、原参考块摘要与阅图映射；sourceRole=publisher_reference、scoringAuthority=false、rightsStatus=not_verified。两题仅为candidate_matched，旧候选答案/缺页证明留在referenceEvidenceHistory。

Python独立重读三份真实PDF，校验当前原卷题面及两份补充答案，重算整个载荷摘要也不能伪造题面、答案、页号或来源。缺补充参数不能降回旧缺页状态；不接受未登记路径、符号链接、字节漂移或超限。Node/Python的reference_only_authority拒绝保持，38处候选来源及公共14覆盖/7来源缺口继续阻塞。本机登记不构成转载许可、评分授权、公共入库或新HTTP权限。[验证](08-TESTING-INFRA.md)、[脚本](08C-SCRIPTS-REFERENCE.md)。

### 许可公共书信正文与来源绑定帮助

现有公共写作参考新增 `mcmurrey-inquiry-letter-body-en-v1`，沿 `public-writing-reference-v1`，体裁 email、语言 en、范围 full_body。原[示例页](https://mcmassociates.io/textbook/examples/inquirex2c.html)自身声明 [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)，由 David McMurrey 提供，署名保留 W. Gary NNNNN（原文署名），不推断真实作者身份。正文从称呼至落款共9段、3项问题，略去地址抬头，旧邮箱/电话替为占位，段落与编号规范化；改动、署名、来源、信内日期1998-07-12及旧教学示例用途可见。原第三项问题措辞保留并说明，未猜改原文。参考不是考试答案键或官方评分依据，scoringAuthority=false。

`hint.add` 仅在现有邮件写作合同和当前邮件题支持注册书信参考，其余已登记参考仍沿原体裁合同；ID、版本、体裁、题目/对话归属与完整内容由服务器注册源重建。未知URL、伪造正文/许可、跨题/账户及停止后新写拒绝；客户端不抓任意URL。同一待提交帮助周期重复阅读沿旧ID，明确提交后新阅读为下一周期帮助。选择不写事实，明确阅读记帮助，原段落草稿不变；提交仍保存完整原答、帮助及pending，未增加可靠评分或模型事实。

当前530相关/3957完整、11类型/构建阶段、17实际HTTP请求10项与当前H5阅读/明确原答/停止/完整正常重开已成立；独立QA认证同步不是远程账户/真实设备验收。更多许可范文、可靠语义、其他历史统计和完整开发矩阵继续，固定Mac尚未安装本候选。[验证](08-TESTING-INFRA.md)。

### 有许可的英文正文全文与段落帮助

`usgs-water-cycle-full-en-v1` 沿现有公开写法参考与 `hint.add` 合同：选篇目只改草稿，明确“读正文全文”才保存当前题帮助。正文为 [USGS Water cycle](https://www.usgs.gov/special-topics/water-science-school/water-cycle) 的7小节、8段主文，4438字符、固定版本与摘要；`coverage=full_text` 仅表示正文全文，导读、图片、图注和导航不收录。作者 Water Science School、机构 U.S. Geological Survey，日期未标注；[机构版权政策](https://www.usgs.gov/information-policies-and-instructions/copyrights-and-credits)的美国公有领域声明仅用于机构制作文字，不扩展到第三方媒体。

固定正文、许可、身份与第1/3/8段写法批注由宿主重建；客户端只提交当前对话、题目、来源ID与版本，未知版本、正文/许可注入或另一题整批拒绝。新段落定位兼容旧句级来源，不改评分、容量或通用规范化。重读幂等，独立题撤去帮助、旧答与指定教法保持；日期、提前拒绝及停止保护沿原合同。`scoringAuthority=false`，阅读不产生可靠首答、掌握、FSRS或官方成绩。[验证范围](08-TESTING-INFRA.md)、[实际界面](06-FRONTEND-REFERENCE.md)。

### 固定公共全文与写作换题入口

沿 `public-writing-reference-v1` 增加两份中文叙事写法参考：[苏轼《记承天寺夜游》固定版本8732064](https://zh.wikisource.org/w/index.php?oldid=8732064&title=%E8%A8%98%E6%89%BF%E5%A4%A9%E5%AF%BA%E5%A4%9C%E9%81%8A&variant=zh-hans)、[柳宗元《至小丘西小石潭记》固定版本2510274](https://zh.wikisource.org/w/index.php?oldid=2510274&title=%E8%87%B3%E5%B0%8F%E4%B8%98%E8%A5%BF%E5%B0%8F%E7%9F%B3%E6%BD%AD%E8%A8%98&variant=zh-hans)。ID分别为 `wikisource-chengtian-full-zh-v1`、`wikisource-xiaoshitan-full-zh-v1`，version均1，`coverage: full_work`；保留3/5段及末段。《记承天寺夜游》保留本版“水中”及据《永乐大典》补的末句署名；《小石潭记》保留“珮环/清洌/下澈/奉壹”，界面说明异文。固定正文摘要分别为 `822f31a4…909a`、`8aebd857…6b08`，完整摘要与原始公开API响应保存在现有回执。原作公有领域、维基文库转录和新增批注的[CC BY-SA 4.0许可](https://creativecommons.org/licenses/by-sa/4.0/)分别标明，许可范围限定相应文字，不改变应用代码许可。

篇目选择只改草稿；明确“读全文”才以当前对话/题目键、referenceId和referenceVersion写入帮助，保存成功且收据篇目/版本匹配才显示。服务端仍只接收四个原允许字段，拒绝自带正文、权威、版本或题目注入，保留规范题、体裁、账户、停止及幂等；私人重放仍由固定注册表重建。旧两份参考、17个导出常量及12个原规范题结果保持。完整原答可带参考出处，语义仍pending，参考阅读不授予成绩、掌握或FSRS事实。

实操复现写作“换题练习”误绑定未定义函数，现改接已有 `variant` 包装入口；六个现有体裁均经真实页面按钮回归验证创建独立新情境、清除本题帮助、保留旧原答并遵守停止。没有新增接口、存储版本、依赖或模型请求。[界面与范围](06-FRONTEND-REFERENCE.md)、[验证](08-TESTING-INFRA.md)、[完整矩阵](13-DEVELOPMENT-PLAN.md)。

### 中文公共叙事参考与课程目标

`public-writing-reference-v1`新增固定标识`wikisource-shexi-return-zh-v1`/版本1，仅用于规范的当前中文叙事任务；旧英文参考版本/12个写作情境保持。摘录鲁迅《社戏》回村段落111字符，初刊1922年12月《小说月报》第13卷第12期；取[维基文库固定页面10605419的简体转录](https://zh.wikisource.org/w/index.php?oldid=10605419&title=%E7%A4%BE%E6%88%B2&variant=zh-hans)，转录[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)，原作按来源公有领域说明为中国/美国公有领域，保留鲁迅署名。正文未改，摘要`51f38b91b1db2dfcb68fa69b8a22800b976182679d1d6d499b3e6712ee593a80`；不导入图片、网页编辑者资料、校勘批注或整篇正文。

三句写法批注由Yozi AI另外撰写。`teachingBasis`只记录[教育部2022年语文课程标准](https://www.ictr.edu.cn/download_center/ywjy.html)的表达与交流第5–6条，纸页16/PDF23，Yozi AI短转述及对应旧项目量表story/detail/organisation；未导入整份PDF、未改现有rubric-v1或GUIDED_WRITING_CONTRACT，scoringAuthority始终false。课程目标与作者原文分别归属，不宣称此片段获官方分数或80–150字练习等于完整学段写作验收。

沿原hint.add白名单、同账户/题目/体裁/规范题与原创建日期校验，成功保存后展示；重复未提交阅读去重，原答后重读另记帮助，题目/量表/教法/原稿不变。原答提示和私人重放保留完整出处、许可、批注与目标；新情境不迁移，未来题可读但提前提交拒绝，停止/切题/账户/迟到仍保护。主观原答保持pending，不提升可靠首答、掌握、考试等级或FSRS。[实操](06-FRONTEND-REFERENCE.md)、[验证](08-TESTING-INFRA.md)、[矩阵](13-DEVELOPMENT-PLAN.md)。

### 公开说明文参考与帮助归属

英文说明写作可明确选择“读一段说明”。当前只导入[Luca Brocca的公开文章](https://kids.frontiersin.org/articles/10.3389/frym.2023.1201606)中土壤含水量的一段原文，保留作者、Susan Debad协作撰写信用、出版方、2024-03-05发布日期、原文/DOI与[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)许可。正文未改；定义、比较、条件与结果的写法批注由Yozi AI添加并分开标明。图片、儿童审稿者资料与联系方式未导入；它是写法参考，不是考试原答、官方等级或满分证据。

复用`hint.add`，参考路径只允许`conversationId`、`questionKey`、`referenceId`、`referenceVersion`。当前固定标识`frontiers-soil-moisture-en-v1`/版本1，正文SHA256为`d1315869f2f9e7ed369f8573bf2f37ee6eb210794cc06c9872348c9078ff95ec`；该摘要固定本地摘录，不称整篇网页不可变。当前英文说明题、原创建时间、题面/来源/体裁/原答父题须满足原写作合同；提示固定level=1，正文、来源、署名、许可和批注从本地已核验版本重建。任意URL、版本、正文/许可/层级注入及跨题拒绝，不增加联网、模型工具或评分权限。已开放版本必须继续保留，不能改同标识同版本正文导致历史私人重放漂移。

Store先核对租约、账户、当前题和停止，再保存帮助，成功才展示。当前未提交帮助中重复阅读复用原提示，不添事件；原答保存后参考收起，重新明确阅读才写新的帮助。原稿保持，题目/量表/指定教法不改；换题、切账户、隐藏、忙碌或停止释放当前参考。来源及许可随原答提示和私人重放保留；新情境不迁旧帮助，打开的未答认词题沿原帮助继承。自由原答仍pending，阅读、格式或包含词语均不提升首答、语义正确、知识掌握或FSRS。当前未来写作题可阅读，但原到期提交门禁继续保持。[实操](06-FRONTEND-REFERENCE.md)、[验证](08-TESTING-INFRA.md)、[矩阵](13-DEVELOPMENT-PLAN.md)。

## 私人资料解析

### 客户端资料版面与原生长解析合同

客户端明确选择“版面整理”后才发送`ocrEngine=docling`，OCR允许与否单独明确；默认普通提取保持。健康能力须同时满足本机合同、固定文件检查、单页/10MiB/无额外云费用及上传恢复的存储身份，不能凭任意可用标志开放。每次最多四页，每页通过共享版面校验并保存后才推进；后续页保留原SHA、存储身份、总页数和OCR选择，光标不得倒退或跳页。取消保留已保存页和原上传恢复凭据，改目标先拒绝；相同摘要但不同存储身份不合并。

新增共享校验核对表格完整覆盖/跨度/不重叠、有限区域坐标、公式原文与文字序列、原页图及待核对属性；伪装表格的文本区域拒绝。客户端保存与认证`material.add`重放共用该规则，失败不写学习事实。预览只改变当前区域/单元格选择，不改题目、作答或复习；全部结果仍无判分权。

App连接器须明确声明`materialParse.contract=yozi-material-parse-v1`与100000毫秒预算，才允许非流式`POST /parse`超过35秒；其他路由/方法仍限35秒，旧桥在传资料前拒绝长请求。解析器自身90秒总预算和转换资源限制保持，2MB输出、鉴权/目标绑定/取消保持。[验证](08-TESTING-INFRA.md)。

### Docling接入私人解析器，客户端待接

既有鉴权/Origin保护的`POST /health`新增`ocrEngines.docling`；默认关闭，配置正确后仅核验隔离目录中的固定包版本及模型摘要，返回`files_verified/recognitionState=not_tested`，不把环境可用当作识别准确。能力检查单并发、4秒、128MiB RSS采样、64KiB输出，失败返回不可用。`POST /parse`明确`ocrEngine=docling`、严格布尔`allowOCR`后才走增强路径，当前仅PDF、单页/请求、最多2048页；未选择时原解析链继续。

沿既有storageId/requestId、原件SHA、上传登记与恢复/删除合同保存原件；增强请求不等待其他解析释放锁，忙时409，不排队启动重型worker。整次处理预算90秒，转换子进程仍最多75秒/2GiB；页数读取和页图渲染均能取消。1200像素原页PNG临时生成后随回执返回，与PDF点尺寸的纵横比须一致；页图最多1MiB、完整片段最多1800000字节。所有成功/失败片段保留原件摘要、页码、提取版本及待核对/无评分权威，失败不返回部分候选或误导定位。

连接断开和服务正常退出会取消增强任务、终止并回收自有子进程、清除临时转换/页图；已存原件与上传凭据保留，可沿原目标恢复。当前已验证本机HTTP接口；客户端仍未开放此引擎，不能据此声称用户入口、保存同步、跨端或设备验收完成。App原生传输现有35秒上限须先单独适配，不直接给旧原生桥发送长请求。[验证](08-TESTING-INFRA.md)、[配置](08C-SCRIPTS-REFERENCE.md)。

### Docling逐页内部适配

新增[本机worker](../scripts/pipeline/private-material-docling.py)及原私人解析器内的docling_command，合同yozi-docling-page-v1，默认关闭。宿主须明确配置Python、隔离依赖和本地模型；输入仅PDF字节、SHA-256、页码与严格布尔allowOCR，不接URL、任意源文件路径或模型参数。原件最多10MiB、页码1–2048，每次只转换一页，摘要不符先拒绝。当前未接入/parse、/health或客户端，原上传凭据、原件定位和删除恢复路径保持。

按原JSON树保留阅读顺序、表格行列/跨行列、单元格坐标、公式orig与图内子文字；坐标为PDF点/左上原点。非法坐标、越页、循环/重复/丢失节点、重叠或不完整单元格拒绝。零行零列且无单元格的区域只保留位置，不补文字或开启OCR。上限1000块、3000文字定位、400单元格/表、20000正文字符，超限失败而不静默截断。所有结果始终unassigned、reviewRequired=true、gradingAuthority=false，不写成绩、错题或FSRS。

父进程限制75秒、2GiB RSS采样、2MiB输出及256KiB丢弃式错误输出，worker另限CPU90秒；取消、超时、监测或输出失败均回收子进程，父进程删除自有临时原件/缓存。该子进程不是操作系统沙箱。后续产品接入仍须补齐每次明确授权、账户/任务/资料绑定、分批保存、迟到拒收、取消及原页预览。[实证](08-TESTING-INFRA.md)、[依赖](08C-SCRIPTS-REFERENCE.md)。

### Apple 就绪与桌面资料逐次许可

解析器的单个 `--warmup` 子进程只识别项目内存合成中英文，不读路径、stdin或私人原件。`ocrEngines.appleVision.readiness` 使用 `wenli-apple-readiness-v1` 的 `preparing/ready/failed`，绑定可执行文件真实路径、设备、inode、大小与修改时间；旧代晚回执无效。准备/失败在正文解码与存储前拒绝，同代失败不自动重试或换引擎。严格合成回执才开放；就绪仍为 `recognitionState=not_tested`。合成45秒、私人12秒、PDF25秒/5页及原回执预算保持，正常停止回收自有子进程。

桌面沿现有原生对话框增加 `choose_learning_material/read_learning_material/discard_learning_material`，仅打包的本地主窗口可调用，不开放远程页面、任意路径或通用文件权限。选择只返回名称、大小与300秒一次性句柄；明确解析许可后才读取。普通PDF/PNG/JPEG、10MB、文件身份、读取前后状态和正文签名均核对；过期、替换、取消、账户/记录/连接/页面变化不发送迟到正文。原生以有界二进制回执返回，客户端核对大小后接原授权解析器，不增加模型或云回退。

最终串行完整回归3587通过/6原跳过；350项原就绪相关JS、57Python、12真实SDK/Vision/Poppler/HTTP以及桌面266相关/8原生逻辑检查分别成立，不相加冒充去重数量。H5现行资产、准备/禁用/重查与320px浅深/减少动态已验；Mac正常PNG选择、取消重选、明确Apple许可、1/1候选与范围删除成立，947946字节正常重开相同。数字/手写/公式语义、自然机器冷启动和设备独立待验。[验证](08-TESTING-INFRA.md)、[矩阵](13-DEVELOPMENT-PLAN.md)。

### 资料字面错答的字段对应先修

`prerequisite-material-literal-v1` 只从同一对话、同一题目版本的最新可靠错答生成。原题必须是完整保存原文重建的 `material-objective-v3` 字面练习；原字段、题干、来源、规则和原答再次核对，不接受旧 v1/v2、疑义、主观辅助分、模型声明或其他对话的依据。最多引用最近两份真实错答；最新正确或待核对关闭新诊断。理由只说明原答与当前字段原文不同，不能据此确定认知错因、整科学习能力或完整阅读水平。

小题使用 `safe-field-locator-v1` 的固定中英文合成资料，检查“冒号前的字段名与冒号后的值”对应。新 `answerType`/规则 `field_key` 由规范题干独立重建，客户端或模型自报答案不能取得判分权限；固定题干、两字段及来源合同不匹配即不能可靠判分。可解析的另一字段名记错，多字段、HTML/代码、只填值或不明确输入保持待核对/澄清；不执行内容。共享 reducer 在新建、恢复和私人同步中拒绝伪造诊断方向、证据、跨账户来源、降版合同和额外权限字段。

小题知识点单独记为“先修：字段与值对应”，不向原阅读知识点写入掌握证据。低级提示说明定位步骤，三级提示/讲解披露答案并记录帮助；帮助后正确不完成 `independent_correct` 任务。原错答保留，原题独立检验仍以原资料不同字段生成变式，不继承小题提示。原答更正后历史题和作答保留，诊断关联回到待核对；资料删除沿原关联移除小题与变式，停止不被诊断或阅读解除。

本批相关 10 文件/252 项、17 项实际隔离 JWT/HTTP/Mongo 检查及 H5 实操通过，七方向合成样例仅覆盖字段对应基础。无新增接口、依赖、模型调用、费用或生产写入；旧事件与 v1/v2 保持原合同。[前端范围](06-FRONTEND-REFERENCE.md)、[证据口径](08-TESTING-INFRA.md)。

## 数学与计算

### 函数运算静态带练与来源合同

新增 oatutor-static-pathway-v1 固定内容包，只接入同一题族的相加、相减、相乘、相除四项及19个分步节点。题目绑定当前账户状态、conversationId、题目版本、packId/packVersion/itemId；原题、来源、依赖及参考快照须与本机固定注册内容逐字段一致。没有任意URL导入、动态表达式、外部账户或BKT状态入口。

沿现有学习操作与认证 learning-sync：oatutor.node.open 先保存帮助再显示提示；oatutor.scaffold.submit 要求已展开、前置节点已读/明确作答、explicit=true，最多1000字符并原样保存空格/换行；oatutor.reference.read 要求已有本步原答；oatutor.final.read 要求已有本题原答。分步原答为独立题目版本的 variant/pending，完成前置作答不表示答对。原题正式提交也保留原文；重试同编号幂等，不同内容冲突。重复读参考复用既有帮助，帮助按编号去重，并在历史续答和再次作答时继承；停止、账户/对话/题目或上下文revision变化拒绝旧动作。

题面与教学参考分别署名OpenStax及OATutor，固定上游1925decc、历史d2ede1e与出版方33391c5的许可证据/摘要；九份原始JSON保留，中文翻译、重复编号、减法负号、约分和定义域修订明确标记。内容CC BY 4.0仅限此固定历史材料及适配，项目代码许可不变；来源公开不构成评分权威，grade仍pending，不写可靠成绩、错题或FSRS。[许可全文](../src/static/licenses/oatutor-functions-CC-BY-4.0.txt)、[验证](08-TESTING-INFRA.md)。

### 认证计算参考与显式帮助入口

新增 POST learning-compute，learning-compute-v1/sympy_reference 必须经过 requireAuth、当前账户每分钟12次分布式限流及明确consent。默认关闭，宿主设置 LEARNING_SYMPY_ENABLED=true 与固定 Python/packages 路径后才可用；客户端不能传运行路径。每进程最多2个计算、每账户1个，同时延续下节子进程限额。部署与运行环境启用需分别验收。

只读取当前JWT账户已经同步的 learning_states，不初始化或覆盖记录。客户端 expected 必须与服务器当前对话、题目版本/正文/来源、最近一次原答及其时间/类型一致；没有同步返回409，不自动上传学习历史。服务器计算前后重读状态，250ms检查revision变化，断开连接、任务停止/状态变化会取消计算；页面同时绑定账户/令牌、epoch和本机revision，拒收迟到响应。原答仅供服务端身份绑定，Python只接收安全系数。

对话题卡的“计算参考”在已有原答且属于可解析方程时可用。用户确认“计算并阅读”后调用；收到的版本、许可、解集和身份须重新校验，随后通过现有 teaching.deliver 原子保存消息与本题帮助，再显示结果。origin=upstream_reference，内容由规范数据重建，同一原答已读结果复用；保存失败不显示为成功。帮助记录可按既有明确授权同步/恢复，后续作答会保留已获帮助事实。原答、pending判分、可靠统计和FSRS不因参考升级。

接口结果仍固定 gradingAuthority=false/persisted=false/requiresHelpRecord=true；持久化发生在客户端已有帮助操作中。请求无模型、付费或供应商调用。当前仅本机候选/隔离后端与H5验收，日常App、生产和真实设备未更新。[验证](08-TESTING-INFRA.md)、[隐私](14-MODEL-PRIVACY-COST.md)。

### SymPy宿主适配合同

新增宿主内部sympy-reference-v1，仅为当前已保存的方程与原答计算参考。宿主提供已验证状态、当前认证身份、对话和页面epoch；scope严格绑定ownerId/conversationId/questionKey/attemptId，必须是当前题目版本及最近一次原答。题目全文/来源与原答摘要、状态revision、epoch形成确定请求编号，同一上下文重试一致；账户/切题/改答/停止及停止后继续的revision变化均拒收迟到结果。调用方还须将取消信号接到自己的页面/任务生命周期，本模块不是认证入口或持久化幂等账本。

Python子进程只收既有安全解析器生成的有理系数/定义域，原答和题面不发送到worker，不使用parse_expr/sympify/eval或Shell。输出严格核对SymPy版本、数域、集合形状、大小和gradingAuthority=false，固定source/许可由宿主补充。结果persisted=false/requiresHelpRecord=true；未来显示前仍须走原题帮助写入与生命周期复核，未改原答、可靠评分、FSRS或统计。目前只有内部适配器，无新HTTP端点、前端入口或自动计算调用。

候选CPU上限3秒、总时长5秒、输入/输出各16KiB、RSS192MiB按100ms采样；Linux另设512MiB地址空间上限。macOS的RSS监测不等于硬内存沙箱，Linux硬上限尚未实机验收。取消/超时先TERM，200ms仍未退出才终止自有子进程，等close后返回；监测失败拒绝，正常退出与ps采样竞态只等待25ms退出事件。冷启动成本和最终实测见[验证](08-TESTING-INFRA.md)，不是产品性能承诺。

### 精确代数内部合同

`safe-algebra-v1` 由宿主 `question.add` / `attempt.submit` 调用，不开放任意计算、命令或修改答案工具。输入为完整绑定题干和原答；结果为验证后的题目规则/范围状态，或 `{status,outcome,basis,evaluator,authority}`。权限沿用当前账户读写学习事实；数学计算本身只读、免费、无网络。题目添加和提交仍由原事件ID幂等，重复断流/补传不重复统计。同步与备份重新计算规则，不信任客户端的 coefficients、solution 或 executable 标签。

目标支持“化简 (x+1)^2”“解方程 x^2-5x+6=0”“整数解方程 2\*x=1”等，生成完整题干以实数/整数/正数定义域为准。单变量 x，有限整数/精确小数/分数、括号、加减乘除、整幂；支持受限 `\frac{a}{b}` 与常用符号。隐式 `2x` 可以使用，`1/2x` 歧义拒绝；空白不拼接数字。零次/负次幂保留非零条件，0^0 不定义。最简形式和完整通用 CAS 不在合同内。

等价式要求相同原定义域；约分后“x+1，x≠1”可核验，遗漏限制先待核对，额外/错误限制可判错；直接重述原式先待后续检验。方程支持一次及有理根二次、无实解/恒等方程、 unordered/重复根/±、精确单位分数和数域筛选。有限正确解的非空真子集判partial；空集只对实际无解判对；恒等方程需要完整数域及排除值。无理根、高次根、多变量、三角函数及资源越界保留pending，不从近似值猜可靠结果。

输入256字符、128token、16层、指数绝对值6、次数6、分数10亿；固定有界同步运算，无后台子进程，取消只在原提交/教学宿主边界生效，不能声称可中断已开始的同步运算。`unsupported_expression`、`unsupported_roots`、`unsupported_irrational_roots`、`undefined_expression`、`ambiguous_implicit_division`、`resource_limit`、`missing_domain_condition`、`original_expression_repeated` 等保留原答并待核对，不伪造成功。变式改变等价式/零点任务方向或数域，生成后重新验条件、全部解和原题关系；不能只按模型文本写入结果。

### 一次不等式与解集合同

`safe-linear-inequality-v1`沿用上述宿主数学入口、完整题目/原答绑定和免费只读计算，无新增权限/网络/代码执行。目标可写“解不等式 -2\*x+6>0”；规范题干限定完整实数域，两边经精确有理数合并后必须为一次或常数，原变量分母/定义域孔洞、二次、链式题干、整数域和额外条件均不宣称可可靠处理。常数真假分别得全体/空集，不除以零。

输入/深度/幂/系数仍受safe-algebra的256字符/128token/16深度/6次幂与1e9有理数上限，答案512字符、最多4个区间并集。答案支持x<3、3>x、(-∞,3)、有界开闭区间和归一化并集；不以小数近似代替精确分数。无穷端点必须开，倒置/未知函数/额外定义域待核对；自然猜测、引用和反问先澄清。题目明确要求完整解集，已解析但漏区段、反向或开闭不等价按wrong表达，不套用有限多解题的partial规则。

判分依据为新合同ID、完整表达、方向和规范区间，来源真实性仍独立。变式同时负倍缩放/左右对调，改变表达与符号操作后重算条件和完整解集；不提前给答案。分层提示1/2不显示当前阈值；显式数轴按精确边界、方向和空/实心显示，是示意数轴而非函数曲线，展示答案按3级帮助保存。提示后正确不作独立掌握，新变式/复测和任务沿用原记录/FSRS准入。范围外或不明确表达保留pending，错误类型使用现有资源/前置/输入校验；无独立计算可用时转原配置入口或局部校对，不伪造在线AI。

本地文本客户端只投影requestId/modelId/shareConsent/messages与goal/strategy/profile/question/attempt/summary背景；Store的requestBinding和背景owner不发往连接器。保留服务端未知字段拒绝、型号与共享许可校验，不为云端背景放宽本地合同。

### 二次不等式先修诊断

`prerequisite-quadratic-inequality-v1`只接纳显式二次题在同一对话/题目版本中的可靠错答。题干必须由`safe-quadratic-inequality-v1`独立重建验证，作答必须重新解析并与完整精确解集判错；不信任调用方参考、评分、认知错因或模型声明。最新正确/待核对关闭新诊断，最多引用最近两份真实错答，以最新答案选择候选；无依据、未校对、资源超限、诊断题自身或旧二次待核对题不能生成小题。原先修v1/v2和条件合同原样重验，不借用线性阈值判断二次错因。

比较的是可观察差异：相同各段/边界但开闭不同→端点小题；双根两段漏一段→完整并集；相同零点但里外选择不同→分段符号；结构相同而边界值不同→小方程的全部零点；重根→平方符号/零点；无实零点→整体符号；多项差异→完整区间。重根先单独处理，临界值保持精确有理数，不以浮点容差或随机试值诊断。小题和理由均按合同重建；理由明确不能确定实际认知错因，不能因一个错答直接推广整科能力。

共享reducer新建/同步/恢复拒绝伪造主题、理由、证据、对话、降版合同及额外权限字段，也拒绝最新事实已变化的陈旧新建候选。历史有效小题保留；所引用原答更正后关联变为待核对，不删除已发生作答或原任务分母。小题按`independent_correct`完成，帮助后正确单独记录；原题独立检验仍生成完整二次区间变式，负倍缩放/对调由完整原式重验，无小题提示继承。停止/对话内教法选择、私人资料级联删除、公开库门禁及所有受保护后端边界保持。

40项期望为人工手算，固定质量现为290项；这不是模型语义准确率、认知诊断因果或长期教学效果。数学规则沿[二次函数、零点与系数](https://openstax.org/books/college-algebra-2e/pages/5-1-quadratic-functions)核对，仅用于事实验证，没有复制教材、代码、图片或素材。实际范围见[06](06-FRONTEND-REFERENCE.md)。

### 二次不等式完整解集

`safe-quadratic-inequality-v1`只由显式目标“解二次不等式 x^2-4>=0”或规范题干“在实数范围内解二次不等式 …，写出完整解集。”进入。原`解不等式`/`safe-linear-inequality-v1`继续冻结，原二次待核对题不会在重放时自动升级；无新 API、权限、模型调用或费用。新题使用同一 Store/reducer 和独立纯函数校验，客户端/模型/导入的参考解集重新计算，公共来源和隐私门禁保留。

限定完整实数域、单变量 x、有理系数，两边之差恰为二次多项式；只允许常数分母且原式没有变量定义域孔洞。沿256字符/128token/16深度/6次幂/1e9有理数及安全整数限额，不放宽上限。复用条件工具的全部精确零点分段，开区间与零点分别校验并归一化合并；有理双根、重根、无实根分别处理，不用近似根或随机试值推断解集。无理零点、链式/额外条件、非二次、多变量、变量分母、未校对或资源越界保留pending。

答案沿512字符/最多4段及原区间解析，可写`-2<x<2`、`[-2,2]`、`(-∞,-2]∪[2,∞)`；孤立点可写`[1,1]`。完整区间等价才correct，已解析却漏段/端点开闭不同为wrong；猜测/讨论/语法不明确先澄清，不把“±根”当完整区间。图示覆盖双段、中间区间和单点，原全体/空集保留；位置示意、值精确，图示作为3级帮助保存。初级提示不显示当前完整解集；负倍缩放/左右对调的变式由原式重验，原帮助和首答保留，变式不继承提示。原v1/v2线性先修合同不生成二次诊断；具体二次诊断由上节新合同接续。

数学依据核对[OpenStax二次函数的系数、零点与开口](https://openstax.org/books/college-algebra-2e/pages/5-1-quadratic-functions)及[不等式、区间与严格边界](https://openstax.org/books/college-algebra-2e/pages/2-7-linear-inequalities-and-absolute-value-inequalities)，只用于规则核对，没有导入其教材、代码或图片。40项期望由本项目独立给出，真实模型/语义/长期效果、跨端设备与发布仍另验。

## 科学

### 压强的有界计算与当前题帮助

`science-transfer-v6` 的 `normal_contact_pressure` 只支持 `pressure/force/area/pressure_kpa`，必须明确 `uniformContact=true`；压力为垂直接触面的力。每个任务只接受对应两个已知量：pressure/pressure_kpa用normalForceN与areaCm2，force用pressurePa与areaCm2，area用normalForceN与pressurePa。力/面积0.01–10000、压强0.01–1000000，最多两位小数；字符串、零/负/非有限值、未知字段、质量或角度推断拒绝。精确约分计算p=F/A、F=pA、A=F/p，cm²除10000换m²、Pa除1000换kPa，乘法先交叉约分。单位出处为[NIST Chapter 4 Table 3](https://www.nist.gov/pml/special-publication-811/nist-guide-si-chapter-4-two-classes-si-units-and-si-prefixes)，仅支持Pa=N/m²，不授予判分权或教材转载许可。

题面、四个唯一选项、答案与来源由宿主重建；剥除科学字段不能绕过合同。明确A–D提交可按本题约束判分，其他表达pending，即使字面等于结果也不升级语义评分。主题选择只改草稿，明确开始/提交才写事实。压强帮助还必须与当前题规范条件完全相同，拒绝同上下文下换量/目标/模板，旧探索示例合同保持。

复用现有question.add/attempt.submit/hint.add/plan.set，不增加接口、存储版本或模型可视化模板。独立新题撤去帮助，指定教法、原时区次日、提前拒绝、停止和幂等保持；认证、隔离、SSRF、限流、预算不放宽。最终相关331/完整3693通过、6原跳过，HTTP19项40请求；实际功能与视觉/设备/语义分开。[验证](08-TESTING-INFRA.md)、[实操](06-FRONTEND-REFERENCE.md)。

### 密度确定计算与最终页面绑定

`science-transfer-v5` 的 `mass_density` 仅支持 `density/mass/volume/density_si`，各任务只接对应两个已知量；质量/体积0.01–10000、密度0.01–100，最多两位小数。未知字段、字符串、非有限值、零值和混入单位拒绝。约分有理数求ρ=m/V、m=ρV、V=m/ρ，g/cm³乘1000换kg/m³，必要时保留分数；公式与SI单位只链接[NIST 8.6.7](https://www.nist.gov/pml/special-publication-811/nist-guide-si-chapter-8)，不复制教材或宣称官方判分。

沿现有 `question.add/attempt.submit/hint.add/plan.set`；宿主重建题面、四个唯一选项与答案，剥除科学字段不能绕过来源合同。只对本题明确A–D判正确/错误，其他表达pending。帮助归属本题，独立题撤去帮助，原教法、原时区次日、提前禁用、停止与重放保持；普通发送仅澄清，不能代替明确提交，不增加接口/存储版本或放宽安全。

最小密度面板按值监听上下文、题目标识/版本、条件、可见/忙碌/停止；等值题目刷新保留已保存方法，真正切题才撤去。实际uni-button停止门禁已有效，补 `aria-disabled` 与不可用时退出Tab序列；键盘沿页面既有绑定。最终相关284/完整3646通过、6原跳过；后端与判分未变，复用HTTP15项39请求。双端主流程与完整重开已验，SI/自由表达的实际界面、视觉、设备与语义另列。[验证](08-TESTING-INFRA.md)、[实际范围](06-FRONTEND-REFERENCE.md)。

### 功与动能的有界合同

新增 `learning-visual-v5` 的 `work_kinetic_energy` 与 `science-transfer-v4` 原创四选一题。固定前提为惯性参考系中的质点、质量不变、直线运动和恒定合力；只接受 template/massKg/initialVelocityMps/netForceN/direction/physicalSeconds 六项。质量0.1–20kg、初速度−10–10m/s、合力0–12N，最多两位小数；观察1–10整数秒。向右为正，零合力必须none。用精确有理数核对合力总功等于动能变化；功使用有符号位移，动能使用速度平方，不能用路程替代位移或把负速度判作负动能。旧v1–v4模板与题目保持，旧或未知能力声明拒绝新模板。

已确认原图再次选择同一演示概念时，保持原图条件、预测和当前步骤，不重复写帮助；切换其他概念仍清除原图并进入示例。普通示例选择及当前题不可展示时的明确恢复入口保持既有行为。

题面、选项、来源、对话、版本、参数和判分权均由规范条件重建，剥除合同不能绕过。明确开始与提交才写题目/原答，含糊答案待核对；观察先保存本题帮助，不记作答或掌握。独立新题改变条件并撤去帮助；原时区明日复测保留提前拒绝、幂等、停止与私人重放。原图须明确确认质点、惯性系、恒定质量、直线运动及合力/单位/初始状态；未知、单个施力、变质量、转动/形变、多维或非惯性系拒绝，仍核对账户、原页、提取版本、题目与内容快照。

[功的定义](https://openstax.org/books/university-physics-volume-1/pages/7-1-work)、[动能定义](https://openstax.org/books/university-physics-volume-1/pages/7-2-kinetic-energy)、[功动能定理](https://openstax.org/books/university-physics-volume-1/pages/7-3-work-energy-theorem)只作定义出处；当前网页为上游许可-SA，未引入教材正文、图片或习题。题目、计算和画面为项目原创；有限质点算例正确不代表一般能量守恒、完整课标、语义掌握或官方考试成绩。[验证](08-TESTING-INFRA.md)、[界面](06-FRONTEND-REFERENCE.md)。

本轮又通过正常文件入口接入同一原创PNG，H5/固定Mac的系统或网页选择、逐次发送许可、Apple CPU文字识别、页图/行坐标/提取事件均已实际核对。识别区域保持unassigned/reviewRequired，500/200被读作S0D/208的原候选不改成正确条件，字面练习因此禁用，没有自动题目、判分或掌握。两端范围预览仅清本轮1份合成资料/原件，旧资料/题目/作答/教法保持；保存/重開与真实识别准确性分别成立。

### 速度—时间图与独立检验

新增 `learning-visual-v4` 的 `velocity_time_graph`：输入仅 `template` 与 `points`，2–4个折点，每点仅 `time` 与带符号 `velocity`。时间从0开始严格递增，范围0–10秒；速度−20–20米/秒，两项最多两位小数；相邻折点明确为直线、向右为正。固定24步/6秒播放。v4客户端兼容旧版本，旧客户端拒绝新模板；`visualize`沿原权限/教法/停止/预算限制，只补坐标白名单，任意代码、URL、媒体与未知字段仍拒绝。

宿主用约分有理数计算每段带符号梯形面积，过零处切开；正、负面积大小相加为路程，相减为位移，绘图近似不参与判分。直线段的平均速度及位移公式核对[OpenStax恒加速度](https://openstax.org/books/university-physics-volume-1/pages/3-4-motion-with-constant-acceleration)，斜率定义核对[加速度](https://openstax.org/books/university-physics-volume-1/pages/3-3-average-and-instantaneous-acceleration)；实现、题面与合成图原创，没有导入该站正文、题目或图片。

原图仍沿 `learning-diagram-v1` 绑定当前账户/题目/像素/快照；须手工确认时间s/ms、速度m/s或cm/s、正方向left/right、相邻折点linear及全部带符号坐标。统一换算为秒/米每秒/向右为正，曲线、无法确定和缺单位拒绝。条件只改草稿，明确确认并成功保存 `hint.add` 才观察；保存失败不采用。预测不计作答，首次示例观察归当前题帮助；新条件独立题不迁移旧帮助。

新增 `science-transfer-v3`，原创四选一题由规范条件重建题面/选项/答案与执行规则，私人同步不采信传来的权威。已准备目标若已有帮助或原答，继续生成下一条件；仍未使用的同一目标可复用，避免把帮助后的旧题称为独立题。明确提交才保存 `variant` 原答；明日复测保留原安排时区、提前拒绝、账户隔离和停止。旧6个演示、150帧及12个题/判分结果逐字保持。

恢复备份的成功状态在后续新事实写入时清除；仅仍有效/可确认的旧预览提示失效，避免错误显示“未合并”。没有放宽待确认预览、授权或恢复副本合同。[实操](06-FRONTEND-REFERENCE.md)、[回归与边界](08-TESTING-INFRA.md)、[矩阵](13-DEVELOPMENT-PLAN.md)。

### 科学初速度与分段合力

新增独立版本`learning-visual-v3`与`science-transfer-v2`，旧v1/v2整数演示和v1题目保持原题面、规则及重放。`accelerated_motion`只接受template、massKg、initialVelocityMps、netForceN、direction、physicalSeconds；`changing_net_force`只接受template、massKg、initialVelocityMps、segments。质量0.1–20kg、合力0–12N、初速度−10–10m/s，最多两位小数；向右为正。每段仅有seconds/netForceN/direction，2–3段、每段1–10整数秒、总时间不超过10秒；非零合力left/right，零合力none。画面固定24步与6秒播放，不允许代码、URL、文件或资源参数。v3客户端兼容旧模板，v1/v2客户端拒绝新模板，不增加工具权限或费用。

宿主逐段用F/m、v=v₀+at及Δx=v₀t+at²/2接续速度和位置；速度过零处分开累加走过长度，位移保留符号。出题使用安全整数有理数，有限小数或分数明确展示，不拿绘图近似值判分；全部帧/双质量精确计算越界时拒绝创建题目，伪造规则保持pending。公式核对[恒加速度](https://openstax.org/books/university-physics-volume-1/pages/3-4-motion-with-constant-acceleration)及[牛顿第二定律](https://openstax.org/books/university-physics-volume-1/pages/5-3-newtons-second-law)，题面和实现原创，未导入该站正文或图片。

原图沿`learning-diagram-v1`绑定当前账户、题目、原页像素与快照；新模板另须明确初始状态、速度大小/方向/单位，质量kg/g、速度m/s或cm/s、合力N及时间s分别确认。明确选择静止才填零速度；未知状态、缺单位、单个推力或未确认分段合力均拒绝。换条件只改草稿，帮助保存成功才采用演示。科学新题仍为当前对话的原创四选一，规范来源/条件/题面/选项重建答案；预测不写作答；观看只记已成功保存的帮助，明确提交才保存原答，计划复测保留原时区和停止边界。提交按钮每次渲染/动作重新读日期，不缓存昨日门禁。更多图形、任意变力、小数去程/回程及真实识图/设备/长期效果分别待验。

批次历史仍生成完整JSON隔离副本。数值检测改为完整词元；仅负零、指数、超大整数或转义/代理项存在实际规范化差额时重算长度，非规范原始JSON仍按解析后的长度守边界。原6百万字符、2万操作、100操作默认批次/500最大批次、5MiB存储及20秒容量回归不变。

当前科学检验或物理题查看普通示例时，首个计算帧/开始播放/明确打开固定视频先沿现有hint.add保存观察帮助；内容由有界示例条件重建并明确标为示例，不伪称原图。保存失败不展示结果；同题同示例未提交期间去重，原答后再看另归下一次作答。原图确认已有图示帮助，不重复计同一路径。帮助记录不创建原答或成绩；换新条件不迁移，未来题仍拒绝提前提交，带帮助答对不完成independent_correct。账户/租约/上下文/停止保护继续适用。

### 科学独立检验

新增`science-transfer-v1`，复用现有`learning-visual-v2`整数模板、题目/原答/计划与私人重放。演示完成后的明确入口改变数值和方向，收起观察支架，生成本项目原创四选一题；路程检验区分总长度与有符号位移，合力检验同恒定合力下双质量的加速度关系及零合力。题面、选项、来源、版本、对话及参数精确核对，答案从规范条件重建，客户端或导入的答案权限不能自行提升。含糊、多选、非当前选项保持待核对；不执行模型代码、文件或URL，不新增依赖/模型调用。

选项仅改草稿，明确提交才保存原答，沿用可靠判分、原题帮助归属、首答错题率及现有FSRS口径。任务条件为`independent_correct`，提示后正确不完成；不同条件的题不迁原帮助。明日复测需当前对话原答，保留安排时的日期与时区、今日/明日既有任务；计划写入失败重试复用新题。普通查看/切题不恢复停止，未到原安排时区的复测日拒绝作答，到了日期仍需明确提交且无提示正确才完成。新题/复测绑定对话、原题与删除关联，私人同步重新核对规则。本地新宿主合同与正式旧客户端/PWA更新分别验收。

这是两个有界规则单元；选对一道题、观看、题目生成或计划安排不能证明完整科学掌握、真实识图、语义评分或长期教学效果。[实际界面](06-FRONTEND-REFERENCE.md)、[验证](08-TESTING-INFRA.md)、[完整矩阵](13-DEVELOPMENT-PLAN.md)。

### 原图条件与物理演示

`learning-diagram-v1` 只接受当前账户/对话/题目所指的私人资料原页，重验页码、片段、材料与片段提取版本、提取操作、PNG/JPEG 编码/头部和既有512KB/4096边长/8MP预算。确认同时绑定题干/片段文字与完整页图；标识相同而原页或文字变化也拒绝旧确认。不校验图片真实性或OCR语义，不发送图片或联网。

数值、单位、方向及科学条件默认未知，选择不写事实。确认必须explicit且全部符合模板：距离m/cm、质量kg/g精确换算到受支持整数，不猜或舍入；恒定合力必须确认初始静止、合力单位N与力的性质，单个推力不当净力。原图/账户/题目变化释放表单与演示，保存失败不展示未记录帮助。宿主先沿原hint.add保存绑定当前题目的短帮助，明确同步true回执后才采用场景；重复已关闭按钮不重复保存。查看原图只用现有uni图片查看接口并暂停演示，退出/上下文变化收回自有查看，停止仍可读原图。

`learning-visual-v1` 及无方向的旧distance_displacement保持；确切`learning-visual-v2`另允许往返direction left/right，以及`constant_net_force`：massKg1–20整数、netForceN0–12整数，非零left/right，零合力必须none。固定初始速度0、恒定合力、2秒物理观察、6秒动画与24步；派生第二物体质量为两倍，绝非原图自动识别的第二个物体。未知客户端版本不升级旧能力，不接受代码、HTML、URL、路径或额外速度/预算，原认证、权限、教法、取消/停止及费用边界保持。

位置按a=Fnet/m、v=at、x=at²/2计算，质量加倍的a/x为一半；向左坐标为负，零合力从静止保持静止。显示舍入标近似，小加速度不冒充精确零。物理关系核对 [OpenStax第二定律](https://openstax.org/books/college-physics-2e/pages/4-3-newtons-second-law-of-motion-concept-of-a-system) 与 [匀加速关系](https://openstax.org/books/college-physics-2e/pages/2-5-motion-equations-for-constant-acceleration-in-one-dimension)，场景/原图合成样例为本项目原创，没有导入教材图文或题库。

确认/播放/预测不是作答、掌握、计划完成或FSRS。私人题/原页不重写、分数不变。新科学/向左的离线视频适配仍不可用，Manim未安装，不将互动帧或旧6/4视频当新视频；渲染入口提前拒绝以免产生空中间目录。小数、已有速度/变力/多维运动、原图自动条件提取、正式独立物理检验、真实模型与完整设备分别待验。

最终H5与普通Mac隔离候选实际确认原图查看、条件选择、预测/逐步/播放及停止后阅读；重开仍停止，公开记录分别70,791与99,872字节逐字不变。Mac原有20事件写作记录完整保留，原答/题目/材料/计划/复习没有因演示改变。[实际范围](06-FRONTEND-REFERENCE.md)、[测试差额](08-TESTING-INFRA.md)。

### 互动学习的题目与临时演示绑定

当前已校验写作题默认进入本体裁带练，科学题默认读取既有版本的规范条件，不再用固定距离示例替代当前题。开合、视图/示例选择和原稿输入不写原答、成绩、掌握、计划或教法；计算轴范围与观察结果须等待既有帮助成功保存及明确观察。无法校验的科学条件显示短错误，可明确选择普通示例，不能伪称当前题已解释。

Store内临时`visualRequest`增加`owner`和`learningContext`，组件同时核对账户、学习生命周期/对话/题目上下文、对话ID与题目ID/版本；这些字段不进入新的后端接口或学习事件。旧`context`绑定保持，缺失/错配/不可校验请求拒绝。用户操作过视图后，新演示只提供“查看新演示”，明确选择才替换；未保存草稿与已确认原图保留，关闭/隐藏/停止/忙碌时不自动打开或播放。账户、对话、题目/版本和条件切换收回旧草稿/播放；隐藏清草稿并暂停，保留同上下文的明确视图选择。模型回复原有帮助记账、指定教法、预算和幂等合同保持。

### 重复选择当前演示视图保持原图条件

已选择的视图再次点击或键盘确认只标记明确选择，不暂停播放、不清除已确认原图或预测，也不追加帮助。切到其他视图仍沿原清理边界；账户、对话、题目/版本、停止和忙碌合同保持。原图条件只有“确认条件并演示”才写帮助，重复明确确认仍各记一次，不能把本地条件确认称图像识别、可靠判分或语义掌握。本次只补客户端同视图短路，没有后端接口、事件或存储版本变更。[实际核验](06-FRONTEND-REFERENCE.md)、[测试](08-TESTING-INFRA.md)。

## 语言与写作

### 已提交英文原答的可选语法帮助

新增POST /learning-grammar，默认关闭，JWT归属、每账户12次/分钟分布式限流、最多2个并行检查/每账户1个保留。请求严格只含action=grammar_reference、consent=true、contract=learning-grammar-v1、conversationId/questionKey/attemptId/epoch/expected；客户端不能指定文本、引擎地址或来源。服务端只读当前账户已同步完整记录，核对题目版本、原答、会话和快照，未同步不初始化，不借用别人的记录。英文subjective原答含拉丁字母且不超过2000个JS字符，不截断原答。

本机LanguageTool6.6固定版本/包哈希，基本规则、en-US，服务端配置只接受http://127.0.0.1:显式端口/v2/check，无用户名/查询/片段，拒绝重定向。输出最多65536B/40处问题，每处最多8条候选；严格校验UTF-16位置、原文切片、规则/消息长度和版本，gradingAuthority=false。20秒连接与读回期限，服务端复核版本/原答；250ms观察同步修订和停止，变化或断开取消读取。引擎自身可继续完成有界计算，不把关闭HTTP连接宣称为瞬间停止Java全部工作。

响应persisted=false/requiresHelpRecord=true。客户端明确确认后请求，原账户/令牌/会话/修订变化拒绝迟到结果；一条teaching.deliver原子保存帮助及消息后才显示，失败不显示成功。同一原答同类已保存帮助复用，不检查尚未提交草稿；新明确原答另建记录。帮助留固定来源与对应原答，后续作答可记录受过帮助，但不改旧答案、pending、可靠统计或FSRS。返回零问题显示“未发现基础规则问题”，不等于事实正确或作文合格。内容以text显示，不执行原文或规则消息。

默认LEARNING_LANGUAGE_TOOL_ENABLED非true或URL缺失返回不可用；客户端不改用公共语法API、模型或收费服务。共享学习核心仍支持原SymPy参考，两个帮助合同按类型分开复用。冷加载曾超时，明确错误后可重试；限额不放宽，稳定性独立待验。[实测](08-TESTING-INFRA.md)。

### 中文材料论证合同

新增chinese-material-argument-v1/material_argument，四份Yozi AI原创情境分别讨论阅读角、社区花园、阅读方式和午餐分量。每题三段完整材料、不同意见与观察范围包含在规范prompt，明确“合成观察，不是真实统计”；不复制外部语料，不声明官方任务或标准答案。来源/体裁/taskId/对话/材料/量表/原答与原时区明日日期按现有写作合同重建，修改材料、删除范围、伪造客观规则或剥除写作字段但仍声明本合同均拒绝。

四段草稿沿观点/材料分析/不同意见/结论，选择体裁只改草稿，明确开始、提交或安排才写相应事实。2000字符段落只检查普通文本、中文和句末标点，不能以材料编号/关键词/格式判断论证。正式原答8000字符，保留全部空格换行并始终pending；旧通知/说明/叙事1000及邮件/讨论4000、英文论证8000保持。新材料独立任务撤去旧帮助，原答、辅助引用、用户教法、停止、私人重放、原时区未来禁答及100任务上限保持。300–600字为项目练习建议，不是考试字数或可靠评分阈值。[验证](08-TESTING-INFRA.md)、[隐私](14-MODEL-PRIVACY-COST.md)。

HTTP发现新材料复测在未传客户端kind时会按parent题默认记variant；新合同现按规范phase=retest推导review，并原子拒绝first等类型伪造。此约束只作用于chinese-material-argument-v1，其他写作/科学合同保持。复测仍仅pending原答与submitted计划事实，不授予可靠掌握。

最终530相关/3788完整、11类类型/构建、微信处理补跑隔离阶段及HTTP19项36请求通过。H5当前23条前态保全，主题/方向、段落输入、拼稿、完整/独立原答草稿及未来草稿均未写事实；明确两次提交439/365字符原文逐字保存、pending。第一原答带4条格式帮助，独立新材料原答无旧帮助；原时区10/09第三组材料0原答、计划未完成。停止正常重开1018749字节相同，原23条九集合前缀/画像/各自教法保持；全局教法绑定新当前任务explain。Mac候选7387e5df…未安装，最新30条H5资料身份仍另验。

### 英文论证合同接续

新增 `english-argument-v1`，四个 Yozi AI 原创任务分别讨论公共空间、学校项目、居家办公与家庭食物浪费。`createWritingQuestion(..., 'argument')` 沿当前题目/原答/帮助/私人重放/教法/停止与原时区次日复测；旧通知及 `guided-writing-v1` 的题目正文、量表和版本保持。段落草稿上限2000字符；新论证正式原答上限8000字符，与页面共用 `writingAnswerLimit`。旧写作/词句仍1000字符。草稿检查只确认有限基本格式；新论证正式原答保留全部空格、换行（含首尾），始终pending，不由草稿或字数生成可靠成绩、词汇掌握或FSRS。

`ARGUMENT_WRITING_BASIS` 关联[IELTS 官方格式](https://ielts.org/take-a-test/test-types/ielts-academic-test/ielts-academic-format-writing)与[写作评分维度 PDF](https://ielts.org/cdn/ielts-guides/ielts-writing-band-descriptors.pdf)的2023年5月版本，2026-10-06复核：Task 2 至少250词，建议约40分钟。四项项目辅助维度各5分，不换算官方等级，不复制官方题目、范文或等级描述正文。原模型失败意图及账本保持，当前增量0模型生成请求。真实语义、官方评分与完整考试能力仍未验收。新论证反馈/请求只接最新且未校对原答，迟到拒绝；历史同编号收据保持幂等。声明 `english-argument-v1` 来源时剥除写作字段也不能绕过规范题目校验。

### 原创英文句子组织的有界判分

共享主题“英文句子组织”只在明确开始后创建题目；`sentence-building-v1`包含12个项目原创情境、固定开头/标点、稳定打乱的唯一词块与指定空位。完整规范题绑定当前对话、题目版本、来源及任务编号，客户端与独立后端使用同一规范化和判分；篡改条件不能获得可执行判分权。正式提交需明确确认，最多500字符；未确认只澄清、不新增作答或复习。私人重放不采信客户端校验字段，由宿主重建。

登记的原组合和已复核替代排列可判“本题组合正确”；只对已复核的完整错误替换判“本题组合需调整”。其他未登记排列，包括含额外词块但尚未复核的表达，保持待核对，不自动改写可靠首答或新增复习。时间短语前置、定语从句与主句互换谓语、yet的另一位置已补入登记；这是有限词块组合核对，不是一般语法、词语掌握、整体英语能力、语义评分或官方成绩。[ETS当前任务结构](https://www.ets.org/toefl/test-takers/ibt/about/content.html?version=after-jan-2026)与[官方任务形式](https://www.ets.org/content/dam/ets-org/pdfs/toefl/toefl-ibt-lesson-plan-writing.pdf#page=4)只作形式出处，不提供本库答案或考试评分权。

提示保存后才显示，绑定原题；独立新句子使用不同且未用过的情境，撤去原帮助并保留指定教法。明日复测绑定原题、安排日期及原时区；重复安排幂等、提前提交拒绝，到期无提示且本题正确才完成独立任务。12情境用完明确提示，不复用旧题冒充新检验。停止/切题/切账户/隐藏后的迟到动作保留原保护。计划页通过既有“句子复测 · 日期 / 回到复测题”入口查看，不恢复停止。[实现与实操](06-FRONTEND-REFERENCE.md)、[验证边界](08-TESTING-INFRA.md)。

### 原创英文邮件与当前托福任务

新增`english-email-v1`，四个Yozi AI原创情境为图书延期、社团场地调整、小组项目进度和社区欢迎活动，每题逐项绑定收件角色、情境和三个任务要求。沿现有共享题目/Store/同步合同，不新增接口或存储版本；规范来源不能通过剥除写作字段绕过校验。来意、情况、回应、结尾四步草稿只检查基本格式，允许称呼逗号和无句号署名，不以关键词判任务完成或语义正确。

[ETS当前2026格式](https://www.ets.org/toefl/test-takers/ibt/about/content.html?version=after-jan-2026)与[官方教学资料邮件示例及评价要点](https://www.ets.org/content/dam/ets-org/pdfs/toefl/toefl-ibt-lesson-plan-writing.pdf#page=15)已于2026-10-06复核：建议7分钟；没有从该资料给邮件捏造100词下限或具体分数。官方示例仅链接并说明其定性评价边界，没有复制、分发或送模型。任务中的收件角色不是实际邮箱，没有发送邮件操作；完整考试计时、官方分数和可靠语义仍待验。

草稿2000、正式原答4000字符，首尾空白、双空格和换行完整保留；旧论证8000及短写作/词句1000保持。目的与任务、信息与展开、读者与语气、语言与组织为项目原创辅助维度，各5分，不换算托福分数。辅助/请求仅接最新且未校对原答，迟到、校对及停止拒绝，合法历史收据仍幂等；独立新题撤去帮助，明日新题按原安排时区拒绝提前提交。原答pending，不提升可靠首答、掌握或FSRS。[实际范围](06-FRONTEND-REFERENCE.md)、[验证](08-TESTING-INFRA.md)。

### 原创英文学术讨论与当前托福格式

新增`english-discussion-v1`，四个Yozi AI原创情境分别讨论校园空间、志愿安排、课程反馈和周边出行。每题包含教授提问及两位同学观点，规范正文/版本、项目辅助量表与原答逐项绑定；看法、回应、展开三步草稿只检查基本格式，不能由关键词或100词阈值判定讨论贡献。建议100词以上/10分钟来自[ETS 当前2026结构](https://www.ets.org/toefl/test-takers/ibt/about/content.html?version=after-jan-2026)及[官方教学资料第3页](https://www.ets.org/content/dam/ets-org/pdfs/toefl/toefl-ibt-lesson-plan-writing.pdf#page=4)，本地2026-10-06复核。没有复制官方题目、范文或等级描述，也未实现完整考试计时/评分。

沿现有`createWritingQuestion`、共享主题和Store，不新增后端接口或存储版本。新讨论草稿2000、正式原答4000字符，首尾空白、双空格、换行保留；论证8000、旧短写作/词句1000保持。讨论贡献、观点展开、组织与衔接、语言表达是项目原创辅助维度，各5分，不换算托福分数。辅助反馈及模型请求仅接最新未校对原答，迟到/校对/停止拒绝；合法历史收据仍幂等。声明讨论来源后剥除合同也不能绕过规范校验。独立新题撤去帮助，原时区明日新讨论提前禁止提交，提交仍pending，不推进可靠首答/掌握或FSRS。[实际核验](06-FRONTEND-REFERENCE.md)、[验证](08-TESTING-INFRA.md)。

公开范文候选复核：ASAP 2.0作者总声明仍为CC BY 4.0、其PERSUADE来源仓库仍为上游许可；[The Learning Agency当前目录](https://the-learning-agency.com/guides-resources/datasets/)又声明CC BY，尚未证明同一文件子集授权一致，继续阻塞导入。[ASAP作者仓库](https://github.com/scrosseye/ASAP_2.0)、[PERSUADE作者仓库](https://github.com/scrosseye/persuade_corpus_2.0)。[OpenStax Writing Guide当前页尾](https://openstax.org/books/writing-guide/pages/12-introduction)声明NC-SA及AI用途事先许可要求，本次不采用该文本或批注，没有下载作文数据集、个人/人口字段或请求许可。既有公开说明/叙事片段保持；公共范文的实际评分、真实语义及完整考试能力仍分别待验。

### 写作体裁、当前情境与原答

`guided-writing-v1` 在原通知之外加入英文说明与中文叙事，各有四个有限原创情境：旧纸回收/节水/旧书交换/步行，借伞/找书/扶同学/照顾植物。英文50–80词、中文80–150字，正式原答最多1000字符；generated/project_original、不可发布，无客观validation/expectedAnswer。写作元信息保存contract、genreId、taskId、conversationId、phase、dueDay、plannedDay、plannedTimezone，题面/来源/维度与规范任务重建，未知字段、体裁、情境、错配与跨对话拒绝。旧`english-notice-v1`创建结果及已有记录保持，旧客户端不能由未知合同自行降级或宣称新体裁可用。

新量表来源为`project_original`，四维各5分：英文为信息/读者/组织/语言，中文为事情/细节/顺序/表达；总分20只是本项目辅助规则，不是官方作文评分或课程标准。normalizeRubric支持该来源类别，其他维度/引用/分数/权限边界不放宽。主观原答和模型辅助继续pending/待核对，不能进入可靠首答、词汇掌握或FSRS。

带练先绑定当前体裁的规范任务，每一步的目标、词语与句型跟随当前taskId；通知也跟随实际活动、时间、地点和要求，不继续显示无关示例。选择体裁只改本地草稿；未建立同体裁任务时须明确“开始带练”。词语/句型/反馈仍先保存hint.add，异体裁或保存失败不展示；普通状态刷新保持草稿，仅账户/记录/题目/体裁变化释放。有限线索无法确认时可明确“先保留这句”，仍是临时草稿，不宣称表达错误或正确，不自动复制/提交。撤去支架或已有原答后换同体裁新情境，旧帮助/原答留原题。

日历复测在三种体裁均按安排时区决定到期；提前可读，但Domain与提交按钮拒绝作答。到期explicit=true保存review原答并按submitted完成任务，依旧pending、不进入FSRS。原请求结果恢复、锁定教法、来源删除、账户/对话/题目/原答归属、取消与停止沿现有合同；新体裁不增加模型工具或调用。当前词语词表为原创情境帮助，尚无独立词义作答驱动的个人词汇适配。[用户规则](07-STYLING-SYSTEM.md)、[实际验证范围](06-FRONTEND-REFERENCE.md)、[矩阵](13-DEVELOPMENT-PLAN.md)。

### 原创通知正式原答与复测

**english-notice-v1** 复用现有状态、量表、帮助与同步接口。四种固定原创通知为阅读社团、美术社团、运动会、历史参观；换题同时改变活动、时间、地点和参加要求。50–80词、原答最多1000字符，generated/project_original、不可发布，无客观validation/expectedAnswer；题型用尽明确不可用，不冒称完整课程。四维简化描述为本项目原创，参考 [Cambridge官方B1写作评价指南](https://www.cambridgeenglish.org/images/231794-cambridge-english-assessing-writing-performance-at-level-b1.pdf)的内容、交际达成、组织、语言及各0–5范围，不输出官方等级或真实满分结论，未导入外部作文。

新建、恢复和私人同步重验规范题干、来源、量表及writingExercise精确字段：contract、taskId、conversationId、phase、dueDay、plannedDay、plannedTimezone。拒绝伪造条件/来源/客观权威/额外能力、重复题型与跨对话焦点。换题/复测的父题必须关联同一对话已保存原答且题型不同；仅修量表可沿私有版本保持原任务，修改题目条件则移除固定任务合同，原题/原答不重写。

四句带练正文仍是临时草稿，不自动复制或提交。已有正式通知题时，词义、句型或单句反馈先保存原hint.add；失败不展示未记录帮助。正式题建立前的探索没有作答事实。独立入口在原题接受过帮助后另建新条件，旧未提交题/帮助保留，新题不继承提示。有限信息检查不证明语法、语义或掌握。

通知必须explicit=true才提交；普通提问/发送及带练完成不自动保存。明确提交保持完整原答、完成submitted任务，主观仍pending，不进入可靠首答、知识掌握或FSRS。“获取反馈”要求当前最新已保存原答、有效模型连接及原分享授权；内部model.request增加feedbackAttemptId，反馈目的不再次提交正文，旧请求不必带该字段。

反馈沿原生成/结果恢复、认证、取消、SSRF、预算和幂等。宿主绑定账户/记录/对话/题目/作答，结果必须恰有一项指向该原答的assess且无新题或其他写工具；完整预检先于写入，拒绝顺带plan/focus/hint、缺评估、错原答与假引用。新反馈用subjective-rubric-v2重验quote/start/end，保存辅助来源/帮助但不改分；恢复原请求不重新生成，切题/新作答/账户变化/取消/停止与迟到结果不得写旧上下文，用户锁定教法保持。

明日复测须用户明确安排，按安排时账户时区取日历次日，保存plannedDay/plannedTimezone并按操作时间重验，不加24小时推断。新条件关联原答，新增明日submitted任务并保留既有任务；先检查100项上限。重复安排复用原题/计划，计划失败重试复用已建题，不伪报成功。提前打开不宣称到期、完成或掌握，聚焦不恢复停止。恢复/同步保留安排日期，统计仍按现有账户时区计算，没有所有跨时区计划分母相同的结论。

本地量表/引用合同不等于作文语义、官方分数、个人可靠词汇或长期效果；ASAP/PERSUADE子集许可、其他体裁/中文、真实模型、设备与发布分别待验。[实际范围](06-FRONTEND-REFERENCE.md)、[测试](08-TESTING-INFRA.md)。下节独立草稿“不记录帮助/不建立正式题”保留本轮前探索范围，正式通知新增事实以上述合同为准。

### 写作中的语境认词

`vocabulary-context-v1`提供10个明确义项、每义项两个原创原句/中文释义/干扰项；当前写作只绑定recycle、paper、reduce、waste（废弃物）、collect、bring、save（节约资源）、exchange八义项。同词的保存文件/浪费动作保持独立，不能由另一义项提升。词义参考对应词条的公开索引内容，部分全文读取返回403，未据此核验全文分发许可；例如[Cambridge](https://dictionary.cambridge.org/dictionary/english/save)等对应词条；链接用于核对意义，不复制词典例句、抓取语料或声称官方等级/满分来源。规范版本、来源、句子、选项、答案、原写作与对话全部重建校验，未知或改变的规则保持待核对。

| 操作                | 绑定与实际行为                                                                                                                                    |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `vocabulary.open`   | 当前未停止的写作题及其规范词语；保留主题焦点和未保存草稿。重复打开未答语境复用原题；先快照既有帮助，再把显示的题面/选项记为写作支架，不增加作答。 |
| `vocabulary.submit` | 显式选择、原写作仍为当前题、原打开事件及本句无旧作答；原答与确定规则结果原子保存，随后记录实际释义反馈。期间新增的写作帮助进入已打开词义题。      |

题目为generated/project_original、不可公开发布；原答kind=variant，记录只表示本语境的四选一结果，不增加可靠首答分母或自动FSRS。通用attempt.submit不能绕过嵌入绑定。两个不同规范语境的最新原始明确提交均无提示正确、无用户更正时，才折叠这个义项的词卡；错答、有帮助或校对则重新优先。重复原句不增加覆盖，不读取文章共现、浏览次数或学生自述来推断掌握。结构化选择只改本地草稿，确认才写原答；hint/open/submit沿现有租约、账户/生命周期、幂等、限额、私人重放与恢复，不增加模型工具权限、联网或费用。换句再认属于即时有界练习，跨天调度/长期记忆、整词/语言熟练度与语义能力仍分别待验。

### 自由原句的词义与引用反馈

新增 `vocabulary-use-feedback-v1`，仅为规范 `vocabulary-review-v1` 的usage任务派生反馈依据：义项/版本、原词义题及其明确原答、原写作和当前原句逐项绑定。宿主从原有词义重建词义、词形与搭配、情境表达三项项目原创维度，各2分；不在历史题目上加量表，不改变旧题版本、自由原句的pending判分或词卡算法。维度不是官方分数，包含目标词也不证明使用正确。

`requestVocabularyFeedback`要求当前未停止的自由写句、最新且未校对的明确原答、已连接模型和数据流向授权；没有保存原句、离线或未授权时不发请求。仅接纳绑定该原答的单个assess，拒绝新题、其他工具、其他原答/量表、遗漏维度和伪造引用。沿 `subjective-rubric-v2` 验证原文与UTF-16范围，重复文字须指定位置，不能截断字符；新原句、校对、切题、账户切换、取消或停止后的迟到响应不采用。旧无量表文字反馈仍按旧合同重放，新明确词句反馈必须带完整维度和引用。

模型上下文只补当前义项、原词义题的一条原句与本次完整原答，保留原12千字符、次数、权限和费用边界。保存的v2辅助反馈由宿主另附 `vocabularyUse` 来源绑定，不接受模型指定该绑定或权威；原答和可靠判分不覆盖，不能提升首答、整词掌握、计划的independent_correct或FSRS。原请求恢复只读取结果，不重新生成。界面复用原答位置组件并移除规范词语任务不能保存的量表编辑入口。

最终本地3308项回归及独立HTTP12项通过；实际H5/原生操作范围见[06](06-FRONTEND-REFERENCE.md)，完整质量与真实模型边界见[08](08-TESTING-INFRA.md)。新的单次词句模型意图被SSRF保护拒绝，账本为not_called/成本0已结算，未取得语义结果；与先前通知failed/started和pending成本分别保留，不重发或另建同意图。[隐私与成本](14-MODEL-PRIVACY-COST.md)、[完整矩阵](13-DEVELOPMENT-PLAN.md)。

### 词语的独立任务与日历复测

`vocabulary-review-v1`沿现有`question.add`、`plan.set`、`question.focus`及`attempt.submit`，不增加模型/网络端点。题目绑定原v1词义题、明确原答编号、义项/版本、原写作及对话；必须回到未停止的原写作才能安排，计划写入失败后复用同一新题。来源/题面/选项/义项/原答/日期/时区篡改拒绝，私人同步丢弃传来的客观权限并由原创规则重建。旧v1题目与词卡折叠算法不改写。

| 任务       | 事实与验收口径                                                                                                                                                                                                                                                                           |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 明日认词   | 每义项两个额外原创原句，当前仍绑定写作中的八义项。安排保留原写作焦点和草稿，附加明日计划；按安排时区的下一日历日开放，不用24小时猜跨月/闰日。选择只填草稿，明确提交保存kind=review；无提示且正确才完成独立任务。同句只接受一次原始提交，补传沿原编号幂等，新编号重复不能补成无提示正确。 |
| 自己写一句 | 明确打开独立任务，不复制逐句草稿。原答限1000字符，保留内部换行和连续空格；明确提交保存kind=variant并只完成“已提交”。包含目标词、格式正确或词义选择正确均不判用法正确；结果保持pending/null，语义和真实反馈独立待验。                                                                     |

这两种任务不新增可靠首答或自动FSRS；到期选择只表示本句词义。新日历任务暂不并入旧v1两个语境的折叠覆盖，不称跨天记忆或整词掌握。停止后仅可阅读，账户/记录/题目切换拒绝迟到动作；当前渲染与提交重新读日期，避免计算属性缓存昨天。原计划/原答/指定教法与隐私、认证、预算、限流和幂等保持。当前回归、真实隔离HTTP与最终界面范围见[08](08-TESTING-INFRA.md)、[06](06-FRONTEND-REFERENCE.md)。

### 词义3/7天复测合同

现有startVocabularyTask/vocabularyTaskFor增加可选delayDays，默认1保持vocabulary-review-v1的原字段、正文、选择与自由写句。新增3/7天仅retest，使用vocabulary-review-v2及delayDays=3或7；分别绑定另外两条项目原创语境和固定contextId=0/1，senseId/senseVersion、原写作/词义题/明确原答、计划日/原时区/到期日完整重建。dueDay按原时区日历加3/7天，不按24小时累加；后来换时区不提前开放。不支持的间隔、字段剥除、降级合同、换语境/来源/日期拒绝，选择规则由宿主重建，不信任客户端validation。

选择间隔只改草稿，明确安排才加题与计划且保持写作焦点；同原词义题/间隔/到期日复用，计划失败重试只补缺失计划，100项上限保持。未来、停止、其他对话/账户与重复提交不补答；无提示正确才完成independent_correct，带提示正确不完成。只产生本句限定词义review，不增加首次作答分母、整词掌握或一般语义权限；自由写句仍pending，日历任务不重复FSRS安排。私有同步/完整重放保持，旧v1不迁移或改写。[验证](08-TESTING-INFRA.md)、[隐私](14-MODEL-PRIVACY-COST.md)。

最终同日到期去重含delayDays（旧v1按1），1/3/7任务分别保留，完成一题不完成其他间隔。当前439相关/3751完整、16项HTTP通过；H5当前可读22条前态经实际操作/停止/完整重开保持，新增1词义原答，两未来任务0作答。最新30条H5回执对应实际资料身份尚未闭环，不自动用回执覆盖当前记录；固定Mac已原子更新7e796927…，原25条九集合前缀/画像/各自教法保持，停止正常重开1156979字节逐字一致；两未来题0原答、计划未完成。

Mac主题/方向、词义选项、3→7间隔及7/3未来选答的完整导出分别逐字相同；明确开始/词义确认/安排与停止共新增1对话、4题、1限定词义原答、3计划、15事件，0未来作答/模型执行。旧25对话各自教法保持，全局strategy正确绑定新当前任务。

## 评分与复习

### 主观评分合同

`learning.assess` 1.1 的 rubricId/维度合同作为旧v1保留；当前1.2宿主为有rubric的题指定`subjective-rubric-v2`，模型参数不开放rubricContract降级。rubricId必须匹配题目版本，逐一提交全部criteria；每项为criterionId、score（数值或null）、feedback、evidence（最多3段，每段250个UTF-16单元）。维度1至6个，每维满分0.5至10，合计最多30分，分数按0.5递增。超分、缺漏、重复、自创维度、非原答引用、错误版本和未知字段拒绝；给分必须引用原答。无维度题保留旧`{name,feedback}`未量化反馈，不接受自行添加分数。

v2 evidence支持原文字符串或`{quote,start,end}`：字符串须在绑定原答中唯一；重复时扩展成唯一原文或明确范围，不能自动挑第一处。start从0开始、end不含终点，按UTF-16计数；必须是安全整数、原答范围内并与quote完整相符，不能截断代理对。同维度重复引用同一范围拒绝；原答保留空白与换行。位置、出现序号/总数和前后各最多24个Unicode码点的原文由宿主重新计算，模型不能传入附近原文或权限。任何题目疑义未校对时所有维度score都须null；缺分不妨碍记录可定位原文。旧v1事件继续按原规则重放，不自动改写旧意见或伪造位置。

写入型工具同一操作内容重试复用原成功收据及耗时，已写评分但收据缺失时仅补齐收据；同一ID改内容仍`IDEMPOTENCY_CONFLICT`。权限、次数/时间预算仍逐次检查，不因已有收据放行新内容。

总分任一维缺失即null/uncertain，不把缺失当零；全满分/零分/其他确定分数表达为correct/wrong/partial，政策 `rubric-total-v1`。这是辅助分值表达，不是可靠首答判定或掌握。两次模型一致不升级；引用真实仅证明引用出现在原答，不证明语义评估正确。

维度可从用户定义/参考候选/模型候选建模，均无答案权威；当前页面仅用户明确编辑。保存产生新题版本/任务和修改理由，旧版本与计划分母保留。同题仅修订维度保留原帮助和作答关系，不增加首答。该动作不调用模型、不扣生成额度。

云端当前背景只发送goal/profile/strategy/question/attempt/summary，包含完整绑定原答、维度及题目疑义的field/reason/critical/resolved，JSON最多12000字符；超限在预留/调用前413拒绝，不静默截断评分依据。疑义仅投影上述字段，发送背景不包含owner或未知配置字段，鉴权仍校验当前用户。模型调用沿用真实预算与取消合同；本地纯文本连接器仍不执行assess。

### 辅助评分的完整原答阅读

`rubric-evidence.vue` 只读已有作答及评估，无新增接口、模型调用、工具执行或事实写入。阅读对象为已保存的 `attempt.answer`（非提交前输入草稿），须为非空字符串且最多 10000 个 UTF-16 单元，并与评估的 questionKey 匹配；v2 还须绑定同一 attemptId。学习页继续按当前对话与题目选择作答，概览继续展示其既有记录范围，未新增或修复跨对话筛选。

v2 位置按保存原答重验 quote、start/end、安全整数、完整相等与代理对边界，再重新计算字位、出现序号及附近原文。明确范围可区分同文多处；非法范围不突出且不猜第一处。v1 可完整阅读但保持未定位；对应作答无法核实时禁用查看。引用和原答经普通文本渲染，HTML 标签及“恢复自动教法”等指令文字不能触发业务操作。查看指定引用与查看完整原答互斥；账户/记录上下文、作答标识/对话/题目/正文或评估标识/合同/维度变化即收起，重开默认收起。

用户校对后的辅助评分显示历史记录提示；展开不改分、不写事件、不取消停止、不解锁指定教法，辅助分值仍待核对且不进入可靠首答或掌握。七阶段中英文及攻击样例仅证明确定性引用/阅读合同，语义评分与真实模型仍独立待验。[前端证据](06-FRONTEND-REFERENCE.md)、[测试边界](08-TESTING-INFRA.md)、[选型与样式](07-STYLING-SYSTEM.md)。

2026-10-05最终H5实际阅读保持上述合同：公开恢复的27事件/4作答中，第二处重复引用、HTML普通文字、完整空格换行、旧v1未定位、历史校对与概览通过；阅读前后37,555字节完整公开备份逐字一致。1280/390/320px浅深色、键盘、实际悬停/按下和减少动态效果分别验收，偏好覆盖已复原。本机合成界面不代表模型语义、真机或正式更新。

### 可见日历与原时区复测门禁

学习Store的日期/今日摘要改为订阅只读的可见时间；写作、词义、科学的提交读取为函数，每次渲染订阅当前时间、每次动作重新读本机时间。共享读取器最多一份分钟计时器：页面show/mount、文档visibilitychange和窗口focus/pageshow复核，最后一个页面隐藏/卸载或Store scope释放时撤销自己的计时器/监听；恢复可见时立即读实际时间。没有document/window的端使用原uni页面生命周期，未按固定24小时推算日界。

复测仍按题目创建时的plannedTimezone/dueDay校验；改变当前账户时区不提前开放原题，后台/时钟回拨后的动作不采用昨日缓存。服务只改内存显示时间，不写学习事实、计划、提示、成绩、教法或停止，不联网/调用模型、不改系统时间。前后端原NOT_DUE、明确提交、认证/隔离/预算和停止保护继续成立；日历变更不能完成计划或恢复任务。

完整串行3,233通过/6原配置跳过，原时区/夏令时与三类页面门禁有界覆盖；实际浏览器模拟日界及Mac重开记录范围见[06](06-FRONTEND-REFERENCE.md)、[测试](08-TESTING-INFRA.md)。自然跨天、跨设备、主观语义和长期效果继续分别验收。
