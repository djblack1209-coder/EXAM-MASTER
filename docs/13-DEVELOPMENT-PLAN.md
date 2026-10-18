# 开发计划

## 阶段13：AI 辅导平台改版（2026-10-18）

客户已授权当前 Codex 会话接管设计、实现与验证，并选定 Logo A。产品与体验合同见[01](01-PRODUCT-VISION.md#ai-辅导平台定位2026-10-18)、[07](07-STYLING-SYSTEM.md#ai-辅导平台界面2026-10-18当前规则)及根 AGENTS。此排序覆盖下方历史 Now / Next / Later 的执行顺序；旧证据不回写。

| 阶段     | 用户结果与主要工作                              | 状态与完成条件                                                                                      |
| -------- | ----------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| 交接/12D | 收尾既有 Mac/网页交付                           | 12D 通过；交付文档 6ede157e、09a5226f 已正常推送。4212 与日常版保留，目标 Claude 执行进程已退出。   |
| 13A      | 对照新定位盘点差距                              | 已完成；沿现有实现逐批改造。                                                                        |
| 13B      | 写定新方向与设计合同                            | 已提交 d2c6945f；新合同生效。                                                                       |
| 13C      | 退役内置题库、页图、专用入口/脚本；保留历史记录 | 已实现；移除内置数据/页图/压缩表/索引与专用脚本，读时兼容、正式产物无残留通过。                     |
| 13D–13E  | 对话工作区、学习档案容器、手机抽屉、Logo A      | 已实现；对话主导、档案/资料/设置、手机抽屉、Logo A；合成网页/Mac实际操作通过。                      |
| 13F      | 知识→例题→明确作答→反馈→小结的受限卡片协议      | 本机实现；受限卡片/持久化/事件重放/同步保护/旧消息与停止重开已检查；真实模型闭环待网络可用。        |
| 13G–13H  | 对话建档、用户确认的计划调整及事实图表          | 已实现；逐题建档草稿/原子确认、计划建议明确采用、事实知识点/日历/目标进度；相关交互与协议回归通过。 |
| 13I      | 连接设置及上传资料学习                          | 本机资料上传/解析/出处通过；真实模型首次尝试被SSRF拒绝，not_called，未冒充教学通过。                |
| 13J      | 界面细节与同源交付                              | 本机同源交付完成；构建/产物审计、Mac隔离与日常打开、资料保全及原子更新通过。                        |

Now：在安全可达网络下完成真实模型/合成资料教学验收，跟进搜索准备60秒超时。Next：后端兼容更新须另获部署授权；继续按真实用户体验反馈小批改进。Later：夸克/百度网盘/Google Drive、Windows/微信/手机真机、签名公证及公开上线。

旧题库记录按客户选择不迁移：有快照照常显示；无快照提示「原题已随旧题库下线」，保留原答/结果/时间，排除该题复习，历史统计保持。来源与答案门禁继续用于仍交付的内容；题库退役后改为产物无残留检查，不通过样例、空库或私人入口绕过其他门禁。Git 历史和线上数据不删除，不强推或改仓库可见性。

客户已在当前会话授权持续使用现有免费配置和合成资料；首次智谱 glm-4.7-flash 请求被SSRF阻断，账本 not_called，平台付费关闭。系统解析 open.bigmodel.cn/api.z.ai/api.groq.com 为198.18保留段；不更改网络或放宽SSRF。现有后端未部署，本版本不得直接部署旧 Laf 托管入口。日常 App/4212、用户原件、私人资料及必要恢复基线保护；新候选隔离验证后才交付。

本轮 Claude 窗口在交接核对期间发生并发变化，目标会话随后从侧栏消失，两个原 JSONL 路径亦不存在；未继续操作该窗口。先前已读取的 332 条去重对话/上下文保存在忽略目录 `tmp/p13-handoff/private/claude-dialogue-readback.json`，目录0700/文件0600，非完整工具载荷或图像归档，不进入 Git。有效设计草案已并入本节与07，不依赖临时目录继续实施。

### 阶段13本机实现与当前验证

旧题库专项门禁改为源码/正式产物无退役数据；通用判分、FSRS、私人PDF/OCR、旧原答、备份和来源/安全/设备门禁保持。只删除已跟踪且专属于旧题库的文件，客户未跟踪原件不动；Git历史不清理。旧四步引导与底栏/旧首页专属源文本检查退役，新工作区的账户隔离、明确提交和实际交互回归继续执行。

教学内容块1版只允许知识/例题/笔记，显示操作不写学习事实；模型计划工具2版生成待确认建议，旧收据按旧操作幂等重放。建议绑定账户/对话/目标/时区/原版本，停止、取消或上下文变化时拒绝采用；不能借建议标记执行删除等其他动作。旧服务若保留事件却丢失卡片/建议，不覆盖本机记录；隐私删除墓碑优先。完整建档通过既有批次原子保存，无效日期不会部分写入。

候选网页已实际完成单动作欢迎、建档草稿/确认、分数题5/6明确提交、刷新保留原答、档案与资料入口；390/768/1280/1440无横向溢出，中英文/深浅色/减少动态及抽屉Escape关闭已检查。档案概览统一全部学习口径，对话迷你档案保留当前目标；无跨目标自述字段混合。Mac隔离身份实际完成新对话、原答、停止、正常退出与重开。合成PDF经独立本地连接器实际上传并解析1页，选定原文数值生成占比练习、明确提交100/3%并由独立规则判对，刷新后保持原答。保留出处和“待校对”，未自动接受参考答案。相关协议/UI/历史定向回归259项、另一批127项、私人解析/恢复57项、保留的来源/同步39项及隔离后端HTTP14项通过（含新卡片/档案草稿同步、确认与幂等）；全量首轮存在旧预期与容量/搜索准备计时失败，第二次全量运行241文件/5279项通过，仍有搜索准备60秒超时、已退役源文本断言及底栏导入残留；后两者修复后协议/UI/历史259项通过。历史两万操作容量用例本次定向已通过；全量不是全绿，不以定向通过替代全量结论。微信最终主包1839054字节、媒体175891字节，主包和媒体预算均通过。

本机交付源码为 `7c5e6dda`（实现5329b732及档案范围/手机顶栏修正）。Mac唯一入口和4212网页已原子更新；标识/UUID/版本2.2.0及同身份ad-hoc签名保持，更新程序、Logo图标和签名。实际日常打开读到27目标，19个学习键在打开期间及正常退出后与更新前逐字相同；此前27目标/32原答/3资料/444事件保持，无迁移。新程序归档已解包，内容/模式/扩展属性/严格签名及回执恢复纳秒时间通过；私人学习备份也完成隔离SQLite读回还原。网页入口 `/static/js/index-CLawqI_3.js` 经4212真实HTTP与磁盘逐字核对；PID10463保持，旧网页保存在 dist/build/h5-before-p13。

程序新归档 tmp/p13-candidate/daily-current.app.zip，成功旧基线沿 tmp/p12a-evidence/daily-current.app.zip；新旧元数据及私人资料位置沿 tmp/p13-candidate/verification.json，恢复条件见08C。核验App只留新归档并精确注销；旧暂存App、解包核验、临时源码镜像、测试数据库、临时凭据与重复截图已按清单清理，保留当前候选、代表图、原始资料、回读正文和必要回退。删除临时内容按文件逻辑大小记录，不等于物理可用空间变化；编译缓存保持。模型失败账本沿 tmp/p13-live/album/live-report.json；不提交正文、目录密钥或合成测试凭据。

阶段13收尾另撤下题库清洗队列专用测试与固定旧题库云盘扫描别名；来源年份/版权/原件同步的通用检查保留。该修正仅影响脚本与测试，不改变已验收交付的运行时代码7c5e6dda。

当前结果、下一步与设备/生产边界同步在[进度图](diagrams/13-progress.png)和[PlantUML图源](diagrams/13-progress.puml)；历史阶段记录沿下文与Git保留。

## 阶段12A：日常 Mac 与本机网页同源交付（2026-10-18）

本轮本机试用交付已完成，源码固定 `86ae5ba7`；并行下一批功能不纳入本轮安装。桌面/H5前端、两身份原生离线锁定单worker编译、公开产物检查及独立合成网页/Mac基础路径均通过。唯一日常Mac入口已原子更新，标识/UUID/版本2.2.0及严格ad-hoc签名保持，实际打开与正常退出后的27目标/32原答/3资料/444事件及19个学习键逐字同，无迁移；程序未运行。网页 `dist/build/h5` 入口 `index-9D3k5lSA.js`，4212仅回环，由launchd托管PID10463继续供试用。当前候选、上一版程序/网页回退及私人留底均已核验，详见本轮[变更日志](12-CHANGELOG.md#2026-10-18-同源交付阶段12a)、[脚本说明](08C-SCRIPTS-REFERENCE.md#当前候选与本机资源)及 `tmp/p12a-evidence/receipt.json`。

本次包含后续界面与导航调整、聊天中的数学/理科学习、记录搜索筛选、账号切换和中断重开的可靠性修复，以及随Mac前端交付的Tauri JS API 2.12.3补丁更新；统一可信客户端IP等后端修复已进入代码，但后端修复没有部署，本次试用不生效；GitHub自动检查和安全扫描维护不改变产品行为。

当前只处理本机交付；后端、真实模型、设备及公开发布验收不由本轮替代。4212的会话恢复、停止与访问日志处理见[现行说明](08C-SCRIPTS-REFERENCE.md#4212-会话恢复与访问日志阶段12c)。`tmp/p1-*`、原资料、正式历史产物与大编译缓存保留；旧回执不回写。

## 2026-10-17 可信客户端 IP 审计补修（阶段7C）

本项已处理（本地实现）：F1 为7A回归，exam 443 的 `/exam-master/` 改为一跳直达后端，覆盖 XFF/X-Real-IP，保留8080原配置；静态路由检查覆盖公开443/80的前缀与函数路径，80重定向及default404保持。F2 更正四份未跟踪 env 的 `VITE_API_BASE_URL` 与未跟踪 Laf 应用 `invokeUrl` 均指向 `nf98ia8qnt.sealosbja.site`，CI仅保留条件冷恢复，托管是否在用未核验，本轮不联网。

此版本不得部署到 Laf 托管：已装laf-cli声明 `ctx.socket` 为WebSocket，合成HTTP上下文会使依赖IP函数返回503；托管运行时是否必然为空尚未实证，须先完成可信入口适配和验收。修复仅在授权部署到standalone/腾讯后生效，仍连Laf旧函数的客户端不受保护。

IP 读取由守卫测试负责，Laf源码审计只检查源码来源/跟踪状态，不作为IP安全审计。守卫扫描functions及standalone（不扫描依赖和编译输出），覆盖拼接/模板属性、方括号ip/remoteAddress、x-cluster-client-ip和大写Forwarded；共享函数及入口适配器仅按文件、所属函数和精确读取表达式白名单放行，每处恰好一次，不整文件豁免。

验证：IP专项11文件185项通过，16项变异检出并恢复；后端与三端隔离构建/产物审计通过。UTC全量5473项通过/7项跳过，但搜索原60秒准备钩子失败；记录负载后单跑仍失败，源码与7A一致，不修改阈值、不宣称全量门禁通过。完整命令、耗时及临时收尾脚本修正见下方变更日志。

剩余事项：

- 授权部署时核验Docker转发模式（docker-proxy / iptables）、实际socket来源、网段冲突与同网伪装（NET_RAW/ARP）。
- Laf托管的可信入口适配与独立验收；当前版本禁止部署到该托管路径。
- Cloudflare / Worker / Tunnel外层聚合需要受控边缘设计，不能直接信任任意来路头。
- 本机未找到nginx，`nginx -t`未验证；部署前须在目标环境验证。

验证与资源收尾见本轮[变更日志](12-CHANGELOG.md#2026-10-17-可信客户端-ip-审计补修阶段7c)及 `tmp/p7c-evidence/`。以下7A记录为历史证据，不改写其原结果。

## 2026-10-17 可信客户端 IP（阶段7A）

6处业务入口改用共享IP函数；standalone启动时编译地址/CIDR白名单，拒绝跳数、信任全部及非法配置。默认仅信任原生回环地址；腾讯Compose固定桥接网关并只信任网关/32，启动环境可覆盖，Nginx六处覆盖XFF。代理链从右向左截止首个不受信地址，直连忽略转发头；IPv4映射IPv6、地址表示及端口归一。有效IP缺失返回503，不使用unknown/随机桶、不退回请求头。登录HMAC及数据库/本地回退合同保留，邮件既有client_ip改用规范地址，首页限流日志去掉地址值。

新增共享函数、配置、源码守卫、6处消费者及真实standalone随机端口HTTP回归；已有测试夹具补有效传输地址，原认证/隔离断言保持。Laf源码审计现在实际识别LAF_SOURCE_AUDIT_STRICT=true。部署/隐私/API合同同步，限流输入变化可能使旧桶与邮件小时统计分段；不清空旧计数、不回写历史记录。当前仅本地修复；腾讯实际网关/NAT来源、网段冲突、CDN出口聚合和Laf托管运行时未验收，详见[09A](09A-LAF-BACKEND-DEPLOYMENT.md#可信代理与客户端-ip本地修复待授权上线阶段7a)。

IP相关最终10文件183项通过（12.67秒），新增三文件52项覆盖统一函数、地址白名单/非法启动、各消费者、源码守卫与真实HTTP随机端口；HTTP隔离产物仅暴露合成探针，指定本地测试库并在finally关闭。12项变异全部检出并恢复：6处业务直接读头、共享函数读头、入口跳数信任、编译器跳数信任、归一化缺失、源码守卫和Nginx追加头。

`TZ=UTC npm test -- --maxWorkers=1`全量耗时999.29秒，285文件通过、2文件失败、1个原Mongo文件跳过；5469项通过、2项失败、7项跳过。搜索准备钩子超60秒，学习历史两项分别超20秒/10秒；搜索准备开始时uptime一分钟负载675.10，超时后另存负载367.12。按原阈值单文件复跑，搜索1项通过33.80秒（开始负载80.33），学习历史23项通过33.16秒（开始负载46.70）。相关历史/搜索实现未改，未另建同负载基线，不将复跑通过改写为全量门禁通过；保留高负载超时的实际退出1及原动态导入警告。

lint、format:check、lint:tooling、audit:repository、audit:subpkg-sync、后端typecheck通过。后端tsc隔离构建35.64秒、原打包2.21秒，既有运行时审计仅重定向构建/报告路径后29/29入口加载通过（3.78秒）；`LAF_SOURCE_AUDIT_STRICT=true npm run audit:laf:function-sources`通过。H5/微信/App隔离构建20.37/19.98/17.54秒，三端公开产物、微信/App专项及微信包体审计通过，主包1954177字节、媒体181028字节。全程使用现有依赖与npm离线模式，无安装或下载。

核验摘要后回收本阶段后端及三端主构建335430271文件字节，不保留完整构建副本；该数字不是磁盘净增或RAM释放。微信生成脚本造成题库表重写，113库解压JSON语义均相等（4库仅原始格式不同），已还原该表原字节，不提交无关生成差异。HTTP临时构建与进程随测试收尾，p1并行目录、既有dist/后端输出、日常App和恢复材料保持；只保留`tmp/p7a-evidence/`报告、哈希与日志。真实Nginx/Docker来源、网络冲突、CDN聚合、Laf托管及设备/公网仍未验收，本轮没有部署、短信或真实邮件/收费。

## 阶段6J：负载敏感超时

- 移动视口：已处理（阶段6J本地验收）。根因是10秒测试预算未覆盖导航、两次就绪及收尾；本机另有配套浏览器缺失后静默使用系统Chrome155的收尾不稳定。保留单浏览器复用，改为每次独立context/page、Node环境、35120毫秒单次检查预算与35000毫秒生命周期钩子；使用Playwright配套headless shell并在CI显式安装、独立串行运行。28项断言和生产验证逻辑保持；与全量并跑连续10次零失败，最终UTC全量5420通过/6项既有Mongo环境跳过/零失败，CI云端实际耗时尚待验收。完整证据与本地/CI验收边界见[12](12-CHANGELOG.md#2026-10-17-移动视口冒烟稳定性阶段6j)及`tmp/p6j-evidence/`。
- 搜索性能：原负载敏感beforeAll 60秒问题继续保留，本阶段未处理，不改实现或阈值；原有跟踪与历史结论保留如下。
  - 阶段7C/7D补记（2026-10-17）：7C全量中该钩子超时，负载回落前单跑仍超时；7D在基线`9022d092`、新版`be9d0198`、基线上依次单跑均通过（36.89/40.86/32.45秒），差异不触及其42个依赖文件；推送后GitHub CI运行39061336227全部通过。判断与负载相关，但未在本机复现根因，仍待后续处理。

## 阶段6D：笔记异步回执与后续项

阶段6G补修同草稿连续提交：入队前登记待写ID，所有排队提交完成后才释放；同一页面/原题/编辑器代次复用ID，切题、切回、重开或其他页面分别保存。失败释放在途计数并保留原绑定重试身份，重试重新写入确认；6D的原回执与账户锁边界保持。回归、变异和完整门禁见[12](12-CHANGELOG.md#2026-10-17-同一草稿连续提交去重阶段6g)。下列未保存草稿切题体验和提交入口不可读问题仍保留为后续项。

本批修复笔记保存的原题/页面/草稿代次回执边界，以及原账户读改写串行化与写后回读确认。支持Web Locks的H5同源多标签由同一锁覆盖；App/微信只保证同一JS运行时的多页面，无Web Locks的独立H5标签、独立运行时、旧版及外部写入者不具备共同锁，写后回读不保证未来不覆盖。测试、变异及完整门禁结果见[12](12-CHANGELOG.md#2026-10-17-笔记异步回执与串行写入阶段6d)；不构成设备、日常App更新、生产发布或依赖安全收口。

6B指出的两项基线问题继续保留，本轮不修：

- 打开笔记后切题但尚未保存时，草稿仍随当前题目重新定向；本批仅防止已发出的旧保存回执修改新题和草稿，后续应明确锁定草稿题目或切题撤销/确认的体验，再补对应回归。
- 提交入口`quizRecordOwnerMatches`遇身份暂不可读仍进入`rejectQuizResume`，清空题目和选择；现有保留逻辑只覆盖计时停止返回不可用后的分支，不能宣称整个提交路径均保留输入。后续区分unavailable与changed并补入口回归。

阶段6E已修复身份夹具回归：`1a8db95d`把稳定失效的旧generation记录误报为SESSION_UNAVAILABLE，现恢复返回null；读取中generation变化仍保持暂不可读，未来未提交记录仍阻断。身份事务9项和6D笔记12项均通过，null提醒/笔记/标签/计时设置拒绝写入，原账户及原题回执边界保持。6D搜索beforeAll 60秒、移动视口10秒超时，经指挥方同机`c279ab96`对照同样复现，属于高负载下既有超时；基线GitHub CI两项通过，以CI结果为准，不放宽阈值。阶段6E完整树UTC全量5408通过/6个原Mongo环境跳过/零失败，搜索与移动视口按原阈值通过；静态检查、三端隔离构建及产物/包体审计全部通过，完整结果与资源收尾见[12](12-CHANGELOG.md#2026-10-17-稳定退出登录态读取修复阶段6e)及`tmp/p6e-evidence/`，不以专项或构建代替设备/发布验收。

## 阶段5U审计收口与后续批次

本轮只修非法计划时区的错误码和 CI 多时区预算；新客户端 + 旧服务端仍按旧语义重建计划，与修复前相同，属于分批部署/回滚窗口的既有兼容限制，并非本轮回归。发布和回滚先后顺序见[后端运行合同](09A-LAF-BACKEND-DEPLOYMENT.md#学习同步的发布与回滚顺序)。以下留待后续批次，不在5U实现：

- 同步协议增加能力或版本握手：客户端识别旧服务端，不采用语义不同的快照，并补齐混合版本回归。备选：客户端在计划载荷明确写入 `day`，使旧服务端也计算同一天；仍需核对完整时区语义。
- GitHub 运行 `39034674869` 已实测：Run tests 为212秒，原上限300秒；上海、纽约、洛杉矶六套件多时区步骤为36秒，上限4分钟；Lint & Test 整个 job 为6分16秒，上限15分钟。Run tests 上限已调到8分钟，保留其余预算；继续跟踪既有间歇性收尾超时，本机耗时不代替 GitHub 实测。
- `session-log-privacy` 的 Node 遍历不遵守 `.gitignore`，扫描比原 `rg` 更严，被忽略的日志和 `src/` 下的 `node_modules` 会多出命中。可选改为 `git ls-files -co --exclude-standard`，保留实际扫描和静态标签门禁。
- 时区边界：旧客户端读取新事件的语义、旧无时区事件是否迁移、脱敏后重建计划时的时区。账户设置和计划共用“长度 1–80 的字符串 + 运行时 `Intl.DateTimeFormat`”校验（阶段5V）；非字符串、空串、超长值和缺字段的 `timezone.set` 返回 `INVALID_INPUT` 且不写入，`plan.set` 未带时区沿用账户时区。合法字符串的接受范围保持不变；本机 Node22.22.3 确认接受 `+23:00` 和 `US/Pacific`，不是仅 IANA 名称，本轮不收紧，跨运行时范围留待核对。

## 依赖安全（下一批次优先）

2026-10-17阶段5N只核验、归因和登记，不升级依赖、不修改锁文件或安全扫描策略。新鲜 `npm audit --ignore-scripts --package-lock-only --audit-level=critical --json --registry=https://registry.npmjs.org` 仍退出1：**1 critical、21 high**。对照本地 `origin/main`（`bb90018d`）的同日审计为4 critical、34 high；当前两个根公告在基线报告中均已存在，根锁文件的版本和包integrity也相同，属于既有问题。数量包含依赖传播，不代表22个独立公告。

| 包名 / 当前版本                               | 公告编号                                                                                  | 受影响路径                                                                                                                                                                      | 可用修复版本 / 下一步                                                                                                                                                   |
| --------------------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `proxy-addr@2.0.8`，原critical                | [GHSA-jqcg-44mw-7w3h / CVE-2026-90711](https://github.com/advisories/GHSA-jqcg-44mw-7w3h) | 根锁文件 `node_modules/proxy-addr`（`@dcloudio/vite-plugin-uni → express@4.22.3`）及生产后端 `laf-backend/standalone/package-lock.json`（`express@4.22.3`）                     | 阶段6C离线升至 **2.0.8**，直接依赖不变、缓存tarball完整性通过；代理与IP限流核对见下文。干净安装仍缺缓存，在线CI安全扫描待验，不能据锁文件升级宣称安全门禁通过。         |
| `braces@3.0.3`，high；也是上一轮Trivy唯一high | [GHSA-vfj7-8cjw-p6xm / CVE-2026-93687](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) | 根锁文件 `node_modules/braces`；DCloud工具链经 `uni-cli-shared → chokidar@3.6.0 → braces`，或 `fast-glob@3.3.3 → micromatch@4.0.8 → braces`；`unimport@4.1.1` 也经fast-glob传播 | 2026-10-17核对公告仍**没有已发布修复版本**，上一轮Trivy也没有FixedVersion；等待可靠上游修复/完整替换方案。npm建议的旧DCloud版本不是braces的补丁版本，不据此降级或豁免。 |

21项high包括braces本身及20个传播包：`chokidar`、`fast-glob`、`micromatch`、`unimport`，以及 `@dcloudio/` 下的 `uni-app`、`uni-app-plus`、`uni-app-uts`、`uni-app-vite`、`uni-cli-shared`、`uni-cloud`、`uni-components`、`uni-console`、`uni-h5`、`uni-h5-vite`、`uni-mp-compiler`、`uni-mp-vite`、`uni-mp-weixin`、`uni-push`、`uni-stat`、`vite-plugin-uni`；受影响节点为根锁文件对应的 `node_modules/<包名>`。这些传播项沿同一braces公告处理，尚无已验证兼容修复组合。既有H5模块图拒绝braces进入客户端不消除构建工具输入风险，也不改变扫描结果。

阶段5N对CI `security-scan` 的历史影响：当时 `npm audit --audit-level=critical` 因proxy-addr退出1；Trivy配置扫描CRITICAL/HIGH、`exit-code: '1'`，上一轮实际因braces退出1。这两步均有 `continue-on-error: true`，随后产生可见warning，不能把作业继续执行称为依赖安全通过；跟踪文件密钥检查仍为硬门禁。本轮未重新下载Trivy或数据库，沿用上一轮报告并核对同版本锁节点；未改变CI或公开发布门禁。公开仓库推送前仍须由指挥方处理未闭合风险，本阶段没有推送。[本阶段验证与环境归因](12-CHANGELOG.md#2026-10-17-推送前核验收口阶段5n)。

### 阶段6C离线修复（2026-10-17）

阶段6I已在主工作树main合并依赖分支，合并提交`daf3516d`，未推送。合并后全量5417通过/2项超时失败/7项未执行或跳过，整体未通过；搜索和移动视口单跑仍钩子超时，科学能量46项及学习路径11项单跑通过，高负载不是已独立证明的根因。静态、后端及三端隔离构建/产物门禁通过，详见[12](12-CHANGELOG.md#2026-10-17-依赖安全分支合并与完整门禁阶段6i)。保留低负载或CI下的完整测试核验；根与standalone干净安装交由包含合并树的CI `Install dependencies`及`Verify standalone backend`步骤，不联网补本机缓存，不以合并前CI替代。

两个锁文件只升级proxy-addr 2.0.7→2.0.8，其直接依赖均为`forwarded@0.2.0`、`ipaddr.js@1.9.1`；其他包版本不变。`npm update proxy-addr --package-lock-only --offline --ignore-scripts --no-audit --no-fund`因离线元数据请求无法命中缓存而失败（根另报`@babel/types`元数据请求未命中），改用npm缓存中的原始元数据手工更新version/resolved/integrity，tarball的SHA-512、SHA-1均匹配元数据。standalone原64个npmmirror地址中1个随升级归一、另63个仅替换resolved主机名，integrity保持；最终根1056个、后端103个网络下载地址均为`registry.npmjs.org`，无凭据或私有源。

缓存中的GHSA-jqcg-44mw-7w3h条目说明：IPv4映射IPv6信任子网可被用于IP伪造，受影响`>=1.1.0 <2.0.8`。standalone使用`trust proxy = 1`的跳数函数，没有使用公告涉及的CIDR信任子网编译；Express的`req.ip`传入`ctx.socket.remoteAddress`。腾讯云配置仅将后端端口发布到回环地址，Nginx追加`X-Forwarded-For`并设置`X-Real-IP`；Nginx访问日志和入口限流使用连接级`$remote_addr`/`$binary_remote_addr`，不依赖proxy-addr。这只是仓库配置核对，未验证生产拓扑。

该头部信任缺口已在阶段7A本地处理：6处业务统一读取入口判定地址，地址白名单取代跳数信任，Nginx覆盖XFF，缺少有效来源拒绝当前请求。登录HMAC与原认证/预算合同保持；专项、变异与门禁结果见本页阶段7A及[12](12-CHANGELOG.md)。尚未部署，真实腾讯网关来源、网段冲突、CDN聚合及Laf托管运行时仍须授权验收；不能据本地通过宣称线上已防伪造。

独立目录两次`npm ci --ignore-scripts --offline --no-audit --no-fund`（统一下载源前/后）均因`whatwg-url@14.2.0`缺缓存退出1；按锁integrity核对共54个tarball缺失，清单在`tmp/p6c-evidence/missing-offline-tarballs.json`。本轮停止干净安装验证，不联网、不由已安装文件重打包冒充registry tarball。其余检查使用现有依赖的隔离写时复制副本，并换入经缓存完整性核验的proxy-addr 2.0.8；这不能替代根及后端在线CI `npm ci`。根`npm audit --audit-level=critical`与Trivy数据库刷新均未执行，交由CI Security Scan；braces等待上游修复，发布门禁保持。完整验证和资源收尾见[12](12-CHANGELOG.md#2026-10-17-proxy-addr离线升级与dependabot分流阶段6c)。

### Dependabot 分流（2026-10-17）

按本轮给定PR清单及本地远端跟踪引用登记，未联网刷新PR或CI状态。14个PR均基于旧main、CI失败是指挥方提供的背景，不能据此认定升级本身失败。运行时固定Node 22 LTS；不切Node 25或Node 26类型。以下是计划决定，未对GitHub PR执行评论、关闭、合并或rebase。

| PR  | 依赖                            | 决定与前置条件                                                                                                                                                                                                                        |
| --- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| #2  | `node:25-alpine`                | 拒绝。Node 25不是LTS，保留Node 22 LTS运行合同。                                                                                                                                                                                       |
| #3  | GitHub Actions大版本            | 放入Actions迁移批次。checkout/setup-node/upload-artifact 4→7、setup-python 5→7、setup-kubectl 3→5、Trivy→0.36；需核对runner运行时、权限、产物与输入变化，在真实GitHub作业验收。部署作业无法在CI里验证，须另获外部授权并具备回滚条件。 |
| #4  | `ruff`                          | 下一次依赖刷新；客户同意联网下载后核对Python lint/格式及现有脚本。                                                                                                                                                                    |
| #5  | `@types/node@26`                | 拒绝。类型与Node 22 LTS对齐，不能用26类型掩盖运行时不可用API。                                                                                                                                                                        |
| #6  | `python-dotenv`                 | 下一次依赖刷新；客户同意联网下载后验证环境读取和依赖约束。                                                                                                                                                                            |
| #7  | `requests`                      | 下一次依赖刷新；客户同意联网下载后验证资料工具HTTP、错误与超时处理。                                                                                                                                                                  |
| #8  | `express@5`                     | 放入Express 5迁移批次，与类型同步。依指挥方提供的[官方支持页](https://expressjs.com/en/support)信息，4.x仍为ongoing、无正式EOL，但更新已很少；先核对路由、错误、上传、代理/IP、认证限流及真实HTTP兼容，再迁移。                       |
| #9  | `mongodb@7`                     | 放入MongoDB 7迁移批次。先提供可运行的隔离Mongo集成环境，现有6项Mongo测试仍跳过；启用并通过它们，再验证驱动/连接/索引及数据兼容。                                                                                                      |
| #10 | `@types/express@5`              | 放入Express 5迁移批次；必须与Express 5及真实HTTP/typecheck一起验收，不能只升级类型。                                                                                                                                                  |
| #11 | `typescript@7`                  | 放入TypeScript 7迁移批次。先核对Node16模块解析、Laf/standalone编译与打包、类型工具链及全量回归。                                                                                                                                      |
| #12 | `uni-framework`                 | 下一次依赖刷新；需客户同意联网下载，保持DCloud同版本同渠道，并完成微信和App构建验证，H5不能替代。                                                                                                                                     |
| #13 | `testing`                       | 下一次依赖刷新；需客户同意联网下载，再跑完整测试并核对测试运行器兼容。                                                                                                                                                                |
| #14 | `tooling`                       | 下一次依赖刷新；需客户同意联网下载。Prettier小版本可能整体改变格式，Playwright可能下载浏览器；单列格式差异与下载预算后验证。                                                                                                          |
| #15 | 单独切换`@dcloudio/uni-app`渠道 | 拒绝。DCloud各包必须同版本、同渠道，不能单包切换。                                                                                                                                                                                    |

配置仅忽略Docker `node`和根/后端`@types/node`的semver-major，以及后端目录`express`、`@types/express`、`mongodb`、`typescript`的semver-major；迁移批次完成并验收后再移除对应后端忽略规则。其余分组、冷却、频率和权限保持，minor/patch继续原规则。

建议的GitHub操作（须客户另行同意，本阶段未执行）：关闭拒绝项#2/#5/#15，并关闭已由迁移忽略规则覆盖的#8/#9/#10/#11，保留相应迁移待办；其他PR在获批联网刷新、更新基线并验证后再处理。没有推送本阶段配置，托管端效果未验证。

**推送后状态（2026-10-17，`b914eac7`）**：

- 忽略规则生效后，Dependabot 自动关闭了 #2、#5、#8、#9、#10、#11；#15 仍未关闭，关闭须客户同意。
- Dependabot 新开 #16 `backend-compatible`，包含：
  - nodemailer 10.0.13→10.1.0：有行为变化，例如连接池空闲 4 分钟后关闭；
  - `@types/node` 小版本。

  放入下一次依赖刷新，需验证邮件发送路径。

- #3、#4、#6、#7、#12–#14 维持上表决定。
- 同次 CI 中，根目录与 standalone 的干净安装均通过；standalone 审计为 0 个漏洞；Security Scan 的 critical 审计通过。根依赖仍有 21 个 high 级别漏洞，含既有 braces，等上游修复。

### 阶段8A依赖更新（2026-10-17，本地 main）

客户已授权本批目标安装包及必要传递依赖联网下载。只读核对 #4/#6/#7/#12/#13/#14/#16 后，在当前 main 重建锁文件，未合并旧 Dependabot 分支；两个 npm 锁文件的网络 resolved 主机均为 registry.npmjs.org，DCloud 运行包渠道与既有安全 override 保持。

- Python：ruff 0.17.0、requests >=2.34.2,<3、python-dotenv >=1.2.4,<2；隔离 Python 3.12 环境复用已安装 OCR/模型依赖，只下载 Ruff/dotenv，未调用真实百度或模型 API。Ruff 130 文件通过；pytest 最终 219 通过。旧环境同样复现夹具 shebang 空格路径失败，改用 env python3 并显式带上当前解释器目录，保持原恢复/子进程断言与超时。
- 框架：@dcloudio/types ^3.4.32、@vitejs/plugin-vue ^6.0.10；测试：@vue/test-utils ^2.5.1、happy-dom ^20.14.6。组件/邮件专项 6 文件 190 项通过，没有放宽断言。
- 工具：@tauri-apps/api 固定 2.12.2；eslint-plugin-vue ^10.11.1、playwright ^1.64.0、postcss ^8.5.29、prettier ^3.9.10、sass ^1.105.1、terser ^5.51.2、vue-eslint-parser ^10.4.1、yaml ^2.9.1，锁定 PR 指定版本。Prettier 新格式只影响 4 文件，已单独提交；Ruff 未放宽规则。API/CLI/Cargo tauri 同为 2.12 次版本，未做 Rust/Tauri 编译。
- 后端：nodemailer ^10.1.0、@types/node ^22.20.5。邮件验证码路径用真实安装包的 JSON/自定义无网络传输验证发件人、信封、内容、5000/5000/8000 毫秒超时选项、暂态保留与鉴权失败回滚；禁止套接字连接，没有发信。连接超时现在覆盖整个建连阶段；本路径没有连接池或附件流。当前源码只有 send-email-code 一处 createTransport/sendMail，未发现独立共享邮件模块；Laf 托管邮件包由运行时提供，standalone 升级不替代托管验收。
- Playwright 本机仅新增配套 headless shell 156.0.8078.4（revision 1248），标准安装会附带 FFmpeg，因此本机沿包内 registry 安装器仅选择该 shell；未动旧浏览器缓存，未安装完整 Chromium/Firefox/WebKit/新版 FFmpeg。CI 的 --with-deps --only-shell chromium 及独立单 worker 28 项命令仍匹配；本机 28/28 通过，云端 CI 尚未运行。
- 锁文件与 PR 的唯一差异：postcss 8.5.29 依赖 `nanoid ^3.3.19`，本地重建锁文件时选用兼容补丁 3.3.20（PR 锁文件为 3.3.19），属目标包的必要传递依赖，8B 复核接受。
- audit 前后：根均 0 critical / 21 high / 0 moderate / 0 low，standalone 均 0，公告节点集合保持。既有 braces 及传播风险未闭合，不运行 audit fix --force，不降低安全或公开发布门禁。
- #3 仍 OPEN，保留 Actions 大版本迁移批次；#15 仍 OPEN，维持不单独切换 DCloud 渠道的决定，关闭与否由客户决定。本批不合并、关闭或评论任何 PR，不推送、不部署。

本批证据集中 tmp/p8a-evidence。首次 npm caret 解析误取 Playwright/core 1.64.1 与 Sass 1.105.2（PostCSS 8.5.30 仅命中已有缓存），已在提交前纠正到 PR 指定版本；多余下载也记入 downloads.json，不删除共享 npm/浏览器缓存。下载总计 31 项、130366323 字节；包元数据/只读 PR 内容不计入安装包体积。全量 `TZ=UTC npm test -- --maxWorkers=1` 耗时 592.44 秒，288 文件通过/1 搜索文件失败/1 原 Mongo 文件跳过，5476 项通过/7 项跳过，零断言失败，整体退出 1。唯一失败是搜索 beforeAll 超原 60 秒，实际准备 134.29 秒；相关测试与基准脚本未改，history 仅有 Prettier 分号后空格变化。前序 7C 也有同类超时，尚未独立证明归因于负载；保留本次全量失败，单独复跑不替代全量。随后记录一分钟负载 8.36，搜索单文件按原阈值复跑 1/1 通过（35.77 秒）；没有扩大阈值或重写全量结果。lint、lint:tooling、lint:python、format:check、仓库/分包审计、后端类型/隔离打包/29 个运行时入口及严格 Laf 源码审计通过。H5/微信/App 隔离构建与产物审计通过（53.14/23.26/30.54 秒）；微信主包全文件 334 个、1954082 字节，媒体 19 个、181028 字节，满足 2 MB/200 KB 门槛。构建无 Sass 弃用警告，微信保留 a 标签选择器不受支持提示。113 库生成表逐库解压 JSON 相等后还原原字节。Python 虚拟环境和 wheel 临时包已删除，四份主构建共 335430104 文件字节已核验摘要并回收；Spotlight 只读索引曾暂缓收尾，未停止系统进程。只留报告、哈希和日志，p1 并行目录、当前依赖、日常 App、用户资料与恢复基线保持。文件字节不等于磁盘净增或 RAM 释放。云端 CI/干净安装、真实设备、托管 Laf/SMTP 和公开发布门禁仍未验收；本批未推送、部署、短信、真实邮件或收费。

### 阶段9A：GitHub Actions 升级（2026-10-17，本地 main）

Dependabot #3 的两份 workflow 已按原 PR 的版本引用落地，未合并其分支；#3 当前仍 OPEN，待推送后真实 GitHub CI 验证。#15 仍 OPEN，保持不单独切换 DCloud 渠道，是否关闭由客户决定。本轮只读访问 GitHub 发布说明、Action 文件与仓库状态，没有下载工具/安装包、操作 PR、触发 workflow、推送或部署。

- checkout v4.2.2→v7.0.1：已读 [v5](https://github.com/actions/checkout/releases/tag/v5.0.0)、[v6](https://github.com/actions/checkout/releases/tag/v6.0.0)、[v7](https://github.com/actions/checkout/releases/tag/v7.0.0)。v5 切 Node 24；v6 把凭据移到 `$RUNNER_TEMP` 独立文件，认证 Git 命令仍可用，默认 persist-credentials=true、fetch-depth=1 保持；容器内认证 Git 需 runner 2.329.0，本仓库没有该用法。v7 默认阻止 pull_request_target/workflow_run 检出外部 PR，本仓库仅 push/pull_request 和百度 schedule/workflow_dispatch，不开启不安全选项。
- setup-node v4.4.0→v7.1.0：已读 [v5](https://github.com/actions/setup-node/releases/tag/v5.0.0)、[v6](https://github.com/actions/setup-node/releases/tag/v6.0.0)、[v7](https://github.com/actions/setup-node/releases/tag/v7.0.0) 及目标说明。v5 切 Node 24 并引入 packageManager 自动缓存，v6 仅自动识别 npm 并移除 always-auth，v7 切 ESM、移除占位 NODE_AUTH_TOKEN；本仓库无 registry-url/always-auth，两个显式 `cache: npm` 优先于自动识别，不重复缓存，不需新增 package-manager-cache 输入。项目 Node 22.22.3 不变。
- setup-python v5/v5.6.0→v7：已读 [v6](https://github.com/actions/setup-python/releases/tag/v6.0.0)、[v7](https://github.com/actions/setup-python/releases/tag/v7.0.0)。Node 24/ESM，v7 移除未使用的 pip-install；显式字符串 `3.12` 仍优先于版本文件，按 semver 匹配本地工具缓存、缺失时由 CI 下载相符补丁版，check-latest=false、allow-prereleases=false 保持；pip 仍由现有独立步骤安装。
- upload-artifact v4.6.2→v7.0.2：已读 [v5](https://github.com/actions/upload-artifact/releases/tag/v5.0.0)、[v6](https://github.com/actions/upload-artifact/releases/tag/v6.0.0)、[v7](https://github.com/actions/upload-artifact/releases/tag/v7.0.0) 及补丁说明。v6 默认 Node 24，v7 ESM 与 archive=false 单文件直传；本仓库保持默认 archive=true、overwrite=false、include-hidden-files=false，三个名称无冲突，H5 目录与百度多路径仍按原规则归档，保留期 1/14 天及缺文件处理保持，不使用新增直传。
- trivy-action v0.35.0→v0.36.0：已读 [发布说明](https://github.com/aquasecurity/trivy-action/releases/tag/v0.36.0)；上游实际文件为 action.yaml。composite Action 的六个现用输入保持，默认 Trivy v0.69.3→v0.70.0，内部缓存引用同步更新，entrypoint 改用便携 shebang；扫描阈值、忽略文件、exit-code=1 与原非阻断告警合同不变，数据库及真实扫描结果待 CI。
- setup-kubectl v3→v5：已读 [v4](https://github.com/Azure/setup-kubectl/releases/tag/v4.0.0)、[v5](https://github.com/Azure/setup-kubectl/releases/tag/v5.0.0) 及 v5.1/v5.2。Node 16→20→24，ESM，新增部分版本补丁解析与镜像/校验和输入；原完整 `version: v1.28.0` 和 kubectl-path 输出仍支持，默认下载源 dl.k8s.io，无自定义镜像，无需新增输入。此项仅静态核对，不运行部署作业。

目标 JS Action 均用 Node 24，runner 最低 2.327.1；两份 workflow 全部使用 GitHub 托管 ubuntu-latest，实际 runner 兼容性待 CI。所有显式输入已逐项与目标 action.yml/action.yaml 核对，本仓库没有消费这些 Action 的 outputs；原步骤输出 repo/check 不受影响。部署条件逐字保持：staging 需 develop 且 DEPLOY_ENABLED=true，production 需 main、DEPLOY_ENABLED=true 且 PRODUCTION_PLATFORM=sealos-cold-recovery；仓库变量列表为空，当前两部署作业均跳过。

百度 workflow 当前 active，每日 `0 18 * * *`（北京时间次日 02:00），手动触发配置保持且本轮未执行。仓库 secrets 为 0，缺 BAIDU_ACCESS_TOKEN 使 token_ready/group_ready=false、两个同步作业均跳过；BAIDU_LINK_REGISTRY_JSON 亦未配置。不注入凭据或用 dry-run 冒充实跑。

证据集中 tmp/p9a-evidence，复用当前依赖；本机 PATH 未发现 actionlint，不安装。YAML 解析、PR 差异/输入/门控比对与 `npm run lint:tooling`、`npm run audit:repository`、`npm run format:check`、`git diff --check` 为本轮静态验收；仓库脚本/测试未引用 workflow 路径或这些 Action 版本，不跑本地全量测试/构建，云端实际执行由指挥方推送后确认。

推送后状态（2026-10-17，`5202c969`）：GitHub CI 运行 39068768717 全部通过，Node 24 版 Action 正常执行，npm 缓存命中，h5-build 产物上传成功（278140763 字节），两个部署作业按门控跳过；Dependabot 于 20:57:51Z 自动关闭 #3。9B 复核与该次 CI 日志共同确认一个既有缺口：`.trivyignore` 在 2026-04-25 大扫除（`943b352a`）中被删除后，Trivy 步骤在扫描前即报 `cannot find ignorefile '.trivyignore'` 失败，`continue-on-error` 使安全扫描作业仍显示成功，随后的告警注释误称“发现 CRITICAL/HIGH 级别漏洞”；自那以后文件系统漏洞扫描实际未执行。该缺口非本批引入，留待“恢复安全扫描并分诊结果”批次处理。Dependabot 新开 #17（@tauri-apps/api 2.12.3、@tauri-apps/cli 2.12.2），#15 仍待客户决定。

### 阶段11A：扫描覆盖补齐（2026-10-17）

本轮在 main 以 `1ff0da41` 为基线，只固定百度直接依赖并补做 GitHub Advisory Database 一次性核查；Dependabot **#17（Tauri）留到 11B**。不改 package.json、锁文件、workflow 或 Dependabot 配置，不下载或安装包，不运行 Trivy/npm audit，不推送或部署。以下是当前结论，阶段10C的历史扫描记录保持原样。

| 对象                                                    | 处理                                                                                                       | 扫描覆盖                                                                                                             | 复查触发                                                                 |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `requirements-baidu.txt`                                | 固定 requests 2.34.2、python-dotenv 1.2.4、openai 2.40.0、pymupdf 1.27.2.3、ocrmac 1.0.1；保留 darwin 条件 | Trivy v0.70.0 源码推演可解析 5 个直接包；一次性通告查询 0 命中。传递依赖没有因此获得持续扫描覆盖，下一次真实 CI 待验 | 清单/解释器/扫描器变动，或下一次 CI 验收                                 |
| `.venv-baidu`                                           | 只读冻结完整 35 包，不修环境                                                                               | 一次性查询 15 条独立通告：1 CRITICAL、9 HIGH、5 MEDIUM；不等于新安装后的依赖图                                       | 使用前评估下列修复建议；环境或依赖变动后复查                             |
| `scripts/pipeline/requirements-docling-macos-arm64.txt` | 保持 81 项 URL/哈希：**80 个 wheel + 1 个 ANTLR 源码包**，更正“81 个 wheel”的前提                          | 文件名解析并规范化 81 个唯一包/版本，一次性通告查询 0 命中；Trivy 持续扫描缺口仍在                                   | 清单变动即复查；最迟与 braces 忽略项一起在 2027-01-15 之前复查           |
| 根及 Laf 的 nodemailer                                  | 根锁无此包；standalone 跟踪锁为 10.1.0；本机被忽略的 Laf 锁为 10.0.13，二者均满足 `^10.0.13`               | 两版本一次性查询均 0 命中；standalone 已有 CI 锁扫描，不能代替托管运行时                                             | 任一清单/锁/运行时变动；恢复托管前先补可复现版本依据、扫描及可信入口验收 |

**百度版本依据与后续更新**：只读 `PIP_NO_INDEX=1 .venv-baidu/bin/python -m pip --disable-pip-version-check list --format=freeze` 得到本机 Python 3.12.12 与完整清单；除 python-dotenv 本机为 **1.2.2** 外，其余四项与固定版本相同。历史 `3b7f83dd` 引入五个范围，`12af71ba` 将 requests/python-dotenv 下限提升为 2.34.2/1.2.4，后者不能被本机旧版本降回去；历史只能证明下限来源，另读 [python-dotenv v1.2.4 release](https://github.com/theskumar/python-dotenv/releases/tag/v1.2.4) 确认 2026-10-01 已发布。其 [pyproject.toml](https://github.com/theskumar/python-dotenv/blob/v1.2.4/pyproject.toml) 要求 Python >=3.10；本机 METADATA 中 requests/pymupdf 要求 >=3.10，openai/ocrmac 要求 >=3.9，本机 dotenv 1.2.2 要求 >=3.10。两项百度 CI 作业均固定 Python 3.12，兼容上述要求；作业因缺密钥跳过，没有可用的安装日志，也没有验证固定清单的重新安装。

现有脚本 `scripts/baidu/incremental_sync.py` 仅引用 `pip install -r` 安装提示，两项 workflow 也按文件安装，无硬编码范围或测试需要调整。Dependabot pip 仍每周一检查、7 日冷却、最多 3 个版本更新 PR，固定 `==` 仍能被更新为新的精确版本；minor/patch 沿 `material-tools` 分组。去掉原 `<3`/`<2` 上限后，未被分组匹配的 major 将作为单独 PR 出现，需兼容性审查，不自动安装或合并；配置保持不变。

**Trivy 可读性**：只读核对实际 Action v0.36.0 的 [默认版本 v0.70.0](https://github.com/aquasecurity/trivy-action/blob/v0.36.0/action.yaml#L98-L101)、[pip 分析器](https://github.com/aquasecurity/trivy/blob/v0.70.0/pkg/fanal/analyzer/language/python/pip/pip.go) 与 [解析器](https://github.com/aquasecurity/trivy/blob/v0.70.0/pkg/dependency/parser/python/pip/parse.go)。默认路径只取 `==`；先去空格/续行符，再截去 `#` 注释、`;` 环境条件和 `--` 哈希参数，包名允许字母/数字/点/下划线/连字符，并校验 PEP 440 版本。现有 `TRIVY_FILE_PATTERNS` 已识别此文件，五行均可解析；解析器不求值平台条件，故扫描含 ocrmac 共 5 包，而 Linux pip 只安装 4 个直接包、macOS 为 5 个。此结论是源码核对和静态清单检查，不冒充真实 Trivy 运行。

**一次性通告核查（2026-10-17 UTC）**：仅通过 `gh api --method GET /advisories`，按 ecosystem 与 `affects=包名@版本,...` 批量查询并 `--paginate`；覆盖 reviewed、unreviewed、malware 三类，后两类均 0 命中。阳性对照 requests 2.31.0 命中 3 条、nodemailer 6.9.8 命中 19 条，确认查询有效。按 wheel/sdist 文件名解析，名称按 `[-_.]+` 统一为 `-` 并转小写，81 个有效清单行与 80 wheel/1 sdist 一一对应。百度固定 5 包为 0，完整本机 35 包为 15，Docling 81 包为 0，nodemailer 10.0.13/10.1.0 各为 0；全部命中如下，均来自本机环境、无撤回通告。零命中仅表示当时数据库未返回已知通告，不等于安全或完整持续扫描。

| 本机包 / 版本 | 通告 / 级别                                                                                          | 影响与建议（只建议，未改环境）                                                                                                                       |
| ------------- | ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| anyio 4.13.0  | [GHSA-82r6-8w77-94w6](https://github.com/advisories/GHSA-82r6-8w77-94w6) / CVE-2026-63374 / CRITICAL | 国际化域名使用 IDNA 2003 编码，在连接被劫持并重定向时可能接受攻击者证书。建议优先评估升至 4.14.2；此前由 IDNA 库预编码域名并核对实际外连路径。       |
| pillow 12.2.0 | [GHSA-9hw9-ch79-4vh6](https://github.com/advisories/GHSA-9hw9-ch79-4vh6) / CVE-2026-59205 / HIGH     | ImageCms 变换传入不匹配模式的输出图像可造成原生堆越界写。建议升至 12.3.0，核验输入/输出模式并避免不可信参数直达该 API。                              |
| pillow 12.2.0 | [GHSA-vjc4-5qp5-m44j](https://github.com/advisories/GHSA-vjc4-5qp5-m44j) / CVE-2026-59204 / HIGH     | 恶意分块 JPEG2000 解码可累积缓冲区并耗尽内存。建议升至 12.3.0，限制不可信图像格式及解析进程内存。                                                    |
| pillow 12.2.0 | [GHSA-phj9-mv4w-65pm](https://github.com/advisories/GHSA-phj9-mv4w-65pm) / CVE-2026-55380 / HIGH     | 直接调用 GdImageFile.open 绕过像素炸弹检查，可触发巨量分配。建议升至 12.3.0，限制此专用入口及图像尺寸。                                              |
| pillow 12.2.0 | [GHSA-45hq-cxwh-f6vc](https://github.com/advisories/GHSA-45hq-cxwh-f6vc) / CVE-2026-55379 / HIGH     | 恶意 BDF 字体的字形尺寸绕过像素检查，可持续占用大量内存。建议升至 12.3.0，避免加载不可信 BDF 字体。                                                  |
| pillow 12.2.0 | [GHSA-5x94-69rx-g8h2](https://github.com/advisories/GHSA-5x94-69rx-g8h2) / CVE-2026-54060 / HIGH     | FontFile.compile 合并字形时缺少总像素检查，可耗尽内存。建议升至 12.3.0，限制字体合成总尺寸。                                                         |
| pillow 12.2.0 | [GHSA-8v84-f9pq-wr9x](https://github.com/advisories/GHSA-8v84-f9pq-wr9x) / CVE-2026-54059 / HIGH     | PCF 字体位图尺寸可绕过像素检查，在报错前也可能先大量分配。建议升至 12.3.0，避免加载不可信 PCF 字体。                                                 |
| pillow 12.2.0 | [GHSA-62p4-gmf7-7g93](https://github.com/advisories/GHSA-62p4-gmf7-7g93) / CVE-2026-54058 / HIGH     | 从文件名打开的 McIdas AREA 经 mmap 行步长校验缺失可越界读，泄露内存或崩溃。建议升至 12.3.0，限制该格式及不可信文件解析。                             |
| urllib3 2.7.0 | [GHSA-vxq7-64xx-v4gw](https://github.com/advisories/GHSA-vxq7-64xx-v4gw) / CVE-2026-97689 / HIGH     | 恶意服务端发送无界 chunk-size 行可耗尽流式读取内存，requests 的流式接口也受影响。建议升至 2.8.0，核对流式下载响应大小及资源限制。                    |
| urllib3 2.7.0 | [GHSA-8988-9cw3-xx77](https://github.com/advisories/GHSA-8988-9cw3-xx77) / CVE-2026-97687 / HIGH     | HTTPS 代理与目标站 TLS 策略可能混用/修改，特定配置下可被冒充代理；转发模式可能暴露请求或目标客户端证书身份。建议升至 2.8.0，独立校验证书与代理配置。 |
| anyio 4.13.0  | [GHSA-5p39-cfhj-2xmp](https://github.com/advisories/GHSA-5p39-cfhj-2xmp) / CVE-2026-64847 / MEDIUM   | 进程池 stderr 未排空可能导致工作进程永久阻塞；建议评估 4.14.2。                                                                                      |
| pillow 12.2.0 | [GHSA-pg7v-jwj7-p798](https://github.com/advisories/GHSA-pg7v-jwj7-p798) / CVE-2026-59203 / MEDIUM   | EPS 的负数 BeginBinary 长度可导致死循环；建议评估 12.3.0。                                                                                           |
| pip 26.1.2    | [GHSA-qwm4-qh6w-59xr](https://github.com/advisories/GHSA-qwm4-qh6w-59xr) / CVE-2026-13346 / MEDIUM   | 索引中的双重编码包 URL 处理有误；建议评估 26.2.0。                                                                                                   |
| pytest 8.4.2  | [GHSA-6w46-j5rx-g56g](https://github.com/advisories/GHSA-6w46-j5rx-g56g) / CVE-2025-71176 / MEDIUM   | tmpdir 处理存在风险；建议评估 9.0.3，并单独审查跨大版本测试兼容性。                                                                                  |
| urllib3 2.7.0 | [GHSA-gh4c-6fx4-qh6g](https://github.com/advisories/GHSA-gh4c-6fx4-qh6g) / CVE-2026-97688 / MEDIUM   | 分块 Deflate 流可进入死循环；建议评估 2.8.0。                                                                                                        |

本机版本命中不等于已证实产品调用可被利用；本轮未运行恶意样本或核验全部调用可达性。上述补丁版本来自通告的 first_patched_version；更新及安装验收须另获该批次联网许可，不能把 11B 的 Tauri 范围当作 Python 环境下载许可。

**Docling 写法评估**：`name==version --hash=sha256:...` 有利于 Trivy 与人工识别，但从固定 URL 改为按名字解析会改变索引查找、平台 wheel 选择和候选发现行为。保留 `--require-hashes --no-deps` 与每个原始摘要，可继续拒绝不同文件字节；仅固定版本而丢弃摘要不可接受。ANTLR 当前是源码包，须保留预装 setuptools 84.0.0、PYTHONPATH 和 `--no-build-isolation` 的构建顺序；若改成预构建 wheel，其摘要必须另验。现有远程 URL 清单本身不提供完整离线安装；名字写法配合完整本地 wheelhouse、`--no-index --find-links` 可支持离线，但必须先备齐对应平台的 80 个 wheel 与源码/构建前提，不能仅改文本就宣称可离线。任何改写均须获下载许可后联网核验实际安装、哈希及现有 worker/解析回归，本阶段不改清单。

**Laf 后端判断**：根 `package-lock.json` 不含 nodemailer；`laf-backend/standalone/package-lock.json` 的 10.1.0 满足托管声明 `^10.0.13`，但它锁定的是另一部署入口，**不能代替托管锁或证明托管实装版本**。本机 `laf-backend/package-lock.json` 确有 10.0.13，但被 `laf-backend/.gitignore` 明确忽略，不在跟踪树，也不能作为 CI 或线上依据。仓库的托管部署仅保留条件冷恢复入口，实际线上是否仍在用未核验；按 [现有合同](14-MODEL-PRIVACY-COST.md#客户端-ip-最小化阶段7a)，本版本不得部署到 Laf 托管。本阶段没有新增托管锁的必要，也不联网生成；未来拟恢复托管时，应先确定该入口可消费的跟踪锁文件或等效平台锁定清单，获得安装依据并补扫描、可信客户端 IP 适配与真实验收，之后才讨论部署授权。

验证：本地 `prettier --check`、`git diff --check` 和现有仓库审计的严格判定通过；调用 `repository-health.mjs` 的 `scanRepository`/`hasRepositoryErrors` 并将报告放入本阶段目录，避免覆盖并行任务的 `tmp/maintenance` 输出。无坏链接、缺失脚本或语法错误；既有 `tests/unit/client-ip-http.spec.ts` 的 fixture 字符串仍按原规则登记为测试引用，不算严格错误。版本/Requires-Python、81 项文件名和查询覆盖、nodemailer semver 范围、历史段落仅插入未改写及只读环境元数据保持均通过静态核对；未增加测试、重装或构建。

证据集中 `tmp/p11a-evidence/`：冻结清单、Requires-Python/元数据摘要、Git 历史、GitHub 源码与发布记录、查询目标及全部命中、验证和进程回收报告。仅保留小型报告/源码摘取/日志，不建新环境、不留构建副本、不触碰 `tmp/p1-*`；复查触发及 2027-01-15 前的 Docling/braces 合并复查按上表执行。

### 阶段11B：17 号 Tauri 补丁更新（2026-10-17）

本轮以 main `05387c5b` 为基线，重放 Dependabot #17 的两文件差异，不合并分支。`@tauri-apps/api` 2.12.2→2.12.3，`@tauri-apps/cli` 2.12.1→2.12.2；锁中的 11 个平台包及 CLI 对它们的版本引用同步为 2.12.2。PR 基线 `9b88dabe` 落后于本地 main，但补丁可干净应用；安装前后锁文件字节一致，最终两文件差异与 #17 逐字一致。Rust tauri 保留 2.12.1，全部 Tauri JS 包与其主次版本同为 2.12，`Cargo.toml` / `Cargo.lock` 未改。

客户本批仅授权从 registry.npmjs.org 下载 API 2.12.3（139468 字节）、CLI 2.12.2（100623 字节）、cli-darwin-arm64 2.12.2（8082365 字节），合计 **8322456 字节**；逐包核对锁文件 SHA-512 integrity，没有清单外下载，也没有另取版本元数据。根 lifecycle 只有 `prepare: husky`，三个发布包没有 preinstall/install/postinstall 钩子；发布包自带 JS 与本机二进制。先将这三个压缩包离线写入现有 npm 缓存，再用 `NPM_CONFIG_UPDATE_NOTIFIER=false npm install --offline --prefer-offline --no-audit --no-fund --ignore-scripts` 增量安装，恰好更换 3 包；额外网络限制拒绝外网连接。`npm ls` 与本机平台包均为目标版本，`node_modules/.bin/tauri --version` 为 2.12.2。

桌面前端通过 `src/services/desktop/{oauth,learning-files}.js` 引入 API core；隔离运行现有 `npm run build:desktop:web`（53.63 秒）及其公开产物检查通过，生成 JS 中检出 `window.__TAURI_INTERNALS__.invoke`。只使用公开测试配置，输出到本批目录；登记文件树及 API 所在 chunk 的 SHA-256 后回收 317697671 文件字节，未复制构建作为证据。`npm run test:desktop:native -- --offline --locked --jobs 1` 通过 10/10（2.23 秒），复用 Rust 缓存，未新增或改写 target 文件。全平台 `cargo metadata --offline --locked` 因缺 Android 缓存拒绝请求；限定本机 `aarch64-apple-darwin` 后离线解析通过，再运行原生测试。桌面启动/打包入口仅核对接线与语法，不运行 `tauri info` / `tauri build`，不替换日常 App。

全量 `TZ=UTC YOZI_ISOLATED_BUILD=1 npm test -- --maxWorkers=1` 运行 674.18 秒（Vitest 672.26 秒），289 文件通过、1 搜索文件失败、1 原 Mongo 文件跳过；5526 项通过、7 项跳过，整体退出 1。唯一失败为 `learning-record-search-performance.spec.js` 的 beforeAll 超过原 60000ms，准备实际 73129.58ms；搜索测试与基准脚本相对本轮基线逐字未改，与阶段7C/8A已记录的失败同类，不能把负载断言为唯一原因。未放宽阈值，也不以专项通过替代全量门禁。四组桌面测试共 71 项及工具链兼容 43 项均通过；未启用隔离 Mongo 实库验收。

下载记录与最终小报告分别为 `tmp/p11b-evidence/downloads.json`、`report.json`；收尾仅保留这两份。三个下载临时包在增量安装验收后回收，现有 npm/Rust 依赖缓存保留；11A 历史、`tmp/p1-*`、既有服务、日常 App 和恢复材料保持。本轮只在本地 main 按路径提交，不推送、合并、评论或关闭 #17；云端 CI、Windows 与设备验收未覆盖。

推送后验收（2026-10-18）：`5dbe8d27`、`05387c5b`、`995340b2` 快进推送后，CI run 39107283413 全绿，两个部署作业 skipped。Trivy 语言清单由 5 个增至 6 个，新增目标 `requirements-baidu.txt`，提示为 notice「没有 CRITICAL/HIGH；目标=6」；npm audit 仍为 CRITICAL=0、HIGH=21，均为同一 braces 通告，忽略项不变。Dependabot #17 于 2026-10-18 07:22 UTC 自动关闭。本机 `.venv-baidu` 的 1 CRITICAL/9 HIGH 仍待客户另批下载许可后修复。

### 阶段11D：本机百度工具环境更新（2026-10-18）

以本地 main `602a9b6c` 为基线，复用 `.venv-baidu` 的 Python 3.12.12 / macOS arm64 环境；客户单独授权本批约 5 MB 下载。只替换以下四个包，完整冻结清单仍为 35 包，其余 31 包版本不变；python-dotenv 与现有 requirements-baidu.txt 的 1.2.4 对齐，未改该清单、workflow、package.json 或锁文件。虚拟环境与本机证据均被 Git 忽略，提交只包含本节及变更日志，不推送或部署。

| 包            | 原版本 → 当前版本 | 官方 wheel                                        | 文件字节 |
| ------------- | ----------------- | ------------------------------------------------- | -------: |
| anyio         | 4.13.0 → 4.14.2   | `anyio-4.14.2-py3-none-any.whl`                   |   125813 |
| pillow        | 12.2.0 → 12.3.0   | `pillow-12.3.0-cp312-cp312-macosx_11_0_arm64.whl` |  4780323 |
| urllib3       | 2.7.0 → 2.8.0     | `urllib3-2.8.0-py3-none-any.whl`                  |   135717 |
| python-dotenv | 1.2.2 → 1.2.4     | `python_dotenv-1.2.4-py3-none-any.whl`            |    23266 |

**下载与离线安装**：所有 pip 命令均使用 `.venv-baidu/bin/python -m pip`。下载显式指定 `--index-url https://pypi.org/simple --no-deps --only-binary=:all: --disable-pip-version-check`，禁用本机 pip 配置及缓存，并用 `--use-deprecated=legacy-resolver` 避免额外获取 metadata sidecar。实际只有四个官方索引 GET 和四个 files.pythonhosted.org wheel GET，wheel 合计 **5065119 字节**，没有清单外下载；文件名、字节、SHA-256、完整来源 URL 和请求清单在 `tmp/p11d-evidence/downloads.json`。四包的解释器平台标签、ZIP CRC 及包内 RECORD 摘要均通过；安装前再次核对 SHA-256。随后设 `PIP_NO_INDEX=1`，使用 `--no-index --find-links tmp/p11d-evidence/wheels --no-deps --only-binary=:all: --disable-pip-version-check --no-cache-dir --no-compile` 离线安装，未补装依赖。

**离线验收与限制**：安装及导入/功能/离线测试进程受 `sandbox-exec` 的 `deny network*` 约束，没有监听端口；Python 审计拦截网络与 `.env` 内容读取，并设 `PYTHON_DOTENV_DISABLED=1`，未运行真实百度同步。安装前后 `pip check` 均无冲突；`pip list --format=freeze` 对账只有表中四包变化。requests、openai、fitz/pymupdf、dotenv、anyio、PIL、urllib3、ocrmac 均可导入；Pillow 在内存生成英文图片，ocrmac 快速模式实际识别 `YOZI AI OFFLINE TEST 2026`；PyMuPDF 在内存生成并读回一页 828 字节 PDF；dotenv 正确读取并随即删除合成测试文件。五份 `tests/unit/test_baidu*.py` 以该环境运行 `python -m pytest -q -p no:cacheprovider`，**30 项通过**；source_manifest、manifest_quality、cleaning_queue、flashcard_quality、group_file_index 的 `--self-test` 全部通过。

首次准确模式 OCR 在 Apple Vision → Espresso → AppleNeuralEngine 的模型编译同步调用处等待超过 120 秒，未据此宣称通过。已先正常终止并回收该进程，离线恢复原四包，逐项核对全部备份文件哈希、原冻结清单和 `pip check` 一致；原环境快速模式通过后，再用同一批已下载 wheel 离线安装，完成上述全部验收。准确模式的根因及其在原环境中的表现仍未验证；快速模式通过不能替代准确模式验收，未修改 ocrmac 或应用运行设置。

**通告复查（2026-10-18 07:52 UTC）**：沿用 11A 的 `gh api --method GET /advisories --paginate`、ecosystem / affects 批量查询与包名规范化，覆盖新的完整 35 包冻结清单及 reviewed、unreviewed、malware。去重后 **0 CRITICAL / 0 HIGH / 2 MEDIUM**，后两类均零命中，无撤回通告；阳性对照 requests 2.31.0 为 3 条、nodemailer 6.9.8 为 19 条。剩余 pip 26.1.2：[GHSA-qwm4-qh6w-59xr / CVE-2026-13346](https://github.com/advisories/GHSA-qwm4-qh6w-59xr)，首个修复版 26.2.0；pytest 8.4.2：[GHSA-6w46-j5rx-g56g / CVE-2025-71176](https://github.com/advisories/GHSA-6w46-j5rx-g56g)，首个修复版 9.0.3。两包不在本批许可内，保持原版本。此为只读在线通告查询，不是运行 Trivy 或持续扫描，也不能证明不存在未知风险。

**回滚与收尾**：改动前在 `PIP_NO_INDEX=1` 下冻结清单，将四个包目录、dist-info 及 python-dotenv 的 `bin/dotenv` 复制到 `tmp/p11d-evidence/rollback/`，共 **15896515 文件字节 / 348 文件**；`rollback/manifest.json` 登记相对路径、大小、权限、SHA-256 与恢复条件，本批已实际离线还原验证。恢复时仅移除这四包的当前目录及 dist-info，再按清单复制回原 `.venv-baidu` 路径，并核对哈希、冻结清单及 `pip check`；依赖当前 Python 3.12 / arm64 解释器和其余包保持。安装验收后已删除 wheels 的 5065119 字节，连同已合并进小报告的临时驱动、合成输入、重复日志/查询结果，共回收 **6747800 文件字节**；该数字不代表实时磁盘可用空间增量。仅保留 downloads.json、report.json 与已验回滚材料，全部本批子进程已回收；既有客户端/服务、日常 App、用户资料与 `tmp/p1-*` 保留，11A/11B 历史段落不改。

补充验收（2026-10-18，Claude）：不经 `sandbox-exec`，在更新后的 `.venv-baidu` 中以 accurate 模式（百度修复脚本调用 `ocrmac.OCR` 时的默认级别）识别 Pillow 合成的英文图片两次：首次 55.4 秒（一次性神经引擎模型编译），第二次 0.2 秒，两次均正确识别全文。准确模式验收通过；上文 120 秒超时推测与沙箱限制或首次编译耗时有关，未再单独复现。

### 阶段10A：恢复 Trivy 安全扫描（2026-10-17，本地 main）

事实：以 `aa44be83` 为干净本地 main 基线。旧忽略文件由 `git show 943b352a^:.trivyignore` 核对，非注释条目均是路径，两个 GHSA 仅在注释内，引用的 deploy 文件现已不在跟踪树。[v0.70.0 忽略解析器](https://github.com/aquasecurity/trivy/blob/v0.70.0/pkg/result/ignore.go) 跳过注释、把首字段作为 ID，故这些路径不是路径排除规则。决定删除 Action 的 trivyignores 输入，不新建忽略文件，不预先豁免任何发现。

[trivy-action v0.36.0 的实际元数据文件为 action.yaml](https://github.com/aquasecurity/trivy-action/blob/v0.36.0/action.yaml)，默认 Trivy v0.70.0；[入口](https://github.com/aquasecurity/trivy-action/blob/v0.36.0/entrypoint.sh) 先检查显式忽略文件，解释了原扫描启动失败。现在只扫描一次，fs / 默认 vuln,secret / CRITICAL,HIGH，exit-code=0；JSON 输出 `${{ runner.temp }}/yozi-trivy.json`，数据库缓存也移出工作区，报告不上传为产物。独立 Node 脚本离线渲染可读清单与摘要，随后删除两份原始 JSON。漏洞逐条输出目标、包、已装版本、修复版本（没有则“未提供”）、ID、级别；密钥只输出规则 ID、文件、起始行、级别，不读取或序列化匹配值/上下文。

- 扫描范围：[fs 文档](https://github.com/aquasecurity/trivy/blob/v0.70.0/docs/guide/target/filesystem.md) 和 [npm 分析器](https://github.com/aquasecurity/trivy/blob/v0.70.0/pkg/fanal/analyzer/language/nodejs/npm/npm.go) 确认依赖来自锁文件，node_modules 的 package.json 仅用于补许可证；[密钥分析器](https://github.com/aquasecurity/trivy/blob/v0.70.0/pkg/fanal/analyzer/secret/secret.go) 已内置跳过任意层 node_modules。仍显式 `skip-dirs: node_modules,**/node_modules`，统一排除第三方遍历且不漏嵌套目录；不跳过 laf-backend、src-tauri、源码或测试目录，不设置 scanners，保持默认漏洞与密钥组合。[目录 glob 与文件识别依据](https://github.com/aquasecurity/trivy/blob/v0.70.0/docs/guide/configuration/skipping.md)。
- 开发依赖：[Node 文档](https://github.com/aquasecurity/trivy/blob/v0.70.0/docs/guide/coverage/language/nodejs.md) 明确 npm 开发依赖默认排除；通过 `TRIVY_INCLUDE_DEV_DEPS=true` 纳入，避免遗漏构建工具风险。其效果不推广到所有语言：Cargo.lock 与 Cargo.toml 同扫时，[Cargo 分析器](https://github.com/aquasecurity/trivy/blob/v0.70.0/pkg/fanal/analyzer/language/rust/cargo/cargo.go) 仍移除开发依赖。
- 清单识别：[pip 分析器](https://github.com/aquasecurity/trivy/blob/v0.70.0/pkg/fanal/analyzer/language/python/pip/pip.go) 默认仅识别名为 requirements.txt 的文件，增加 `TRIVY_FILE_PATTERNS=pip:(^|/)requirements[^/]*\.txt$`，覆盖根与子目录 requirements*.txt，不覆盖默认锁文件识别。现有根/standalone package-lock 与 src-tauri/Cargo.lock 均保留扫描。独立 package.json 不是完整可解析依赖图的替代；[Python 默认只解析精确 == 版本](https://github.com/aquasecurity/trivy/blob/v0.70.0/docs/guide/coverage/language/python.md)，范围和 URL wheel 清单不能宣称全覆盖，不擅自把最低版本当已装版本。
- 防止空扫误报：[语言扫描器](https://github.com/aquasecurity/trivy/blob/v0.70.0/pkg/scan/langpkg/scan.go) 保留有包但无漏洞的目标，[JSON writer](https://github.com/aquasecurity/trivy/blob/v0.70.0/pkg/report/json.go) 即使移除 Packages 仍保留非空 Target。故 Results 缺失/空数组、空 Target、不可解析/结构异常或步骤未成功均视为未完成，输出非阻断 error。正常结果有 CRITICAL/HIGH 时按严重级别和漏洞/密钥类别分别计数 warning，无则 notice；三态均写入 GITHUB_STEP_SUMMARY。
- npm audit 同类修复：原逻辑仅看步骤失败，无法区分网络错误。现在保存 JSON 与实际退出码，仅在有效 v2 报告、清单计数及 critical 阈值与退出状态一致时判定发现/无发现；错误对象、报告缺失/异常或执行未完成报 error。保留 critical 告警阈值，HIGH 在摘要计数并逐条输出日志。扫描/提示失败均不阻断，tracked secrets audit 仍是硬门禁，部署 needs/变量条件不变。

本地 29 个报告场景通过，覆盖发现/无发现、缺文件/扫描失败/跳过/取消、JSON/结构异常、零目标/省略 Results、四类 CRITICAL/HIGH 计数、匹配值/错误正文不外泄及控制行转义；其中两例复用阶段8A报告验证兼容性，不重新联网。YAML 解析、其余全部 job/部署条件与 tracked secrets 步骤逐项不变、四份 requirements 文件匹配、npm 封装退出 0/1 和原始报告删除均通过。`npm run lint:tooling`、`npm run audit:repository`、`npm run format:check` 通过；仓库审计仍记录一项既有测试内引用（client-ip-http.spec.ts 的 fixture 字符串），严格门禁按原规则不视为错误，无新坏链接/脚本/语法问题。 10A2 补交 31 项内嵌 fixture 回归并纳入现有 CI 单元测试入口，逐例核验 annotation/摘要及密钥脱敏，与相关原测试共 48 项通过；两处 Annotate 改为 `!cancelled()`、清理保持 `always()`，只读核对 [action.yaml 第162–231、233–248行](https://github.com/aquasecurity/trivy-action/blob/v0.36.0/action.yaml#L162-L248) 与 [entrypoint.sh 第11–13、85–88行](https://github.com/aquasecurity/trivy-action/blob/v0.36.0/entrypoint.sh#L11-L88) 确认 `TRIVY_INCLUDE_DEV_DEPS`/`TRIVY_FILE_PATTERNS` 不被覆盖并传入 Trivy，[第140–146行](https://github.com/aquasecurity/trivy-action/blob/v0.36.0/action.yaml#L140-L146) 的缓存路径与第248行的 `TRIVY_CACHE_DIR` 共用 `inputs.cache-dir`，故 runner.temp 仍支持缓存恢复/保存，真实执行与命中待 CI。

验证异常如实保留：第一次 npm 封装模拟依赖 PATH，本机非交互 shell 启动时前置了真实工具路径，导致一次真实 npm audit，违反本阶段仅限 GitHub 的联网约束。npm 调试日志确认 23 个审计/元数据 HTTP 请求、0 个包 tarball 请求，返回 0 critical/21 high；没有执行安装命令。已用显式 shell 函数调用模拟命令的精确路径，检查 mock 参数与退出码，两种退出均复验通过。证据集中 tmp/p10a-evidence，保留异常简报与最终报告/日志，回收合成输入及一次性驱动；不生成构建副本，不触碰 tmp/p1-*。未运行真实 Trivy、数据库刷新、安装包下载或全量测试/构建，未推送/部署。

10A3 修复扫描明细的 workflow 命令注入：以每次运行的随机 UUID 暂停命令解析并在 `finally` 恢复，annotation 留在块外且仅含可信标题、校验计数和固定状态，摘要仅保留安全转义的汇总；只读核对 runner v2.338.0 [ActionCommandManager.cs 第70–102行](https://github.com/actions/runner/blob/v2.338.0/src/Runner.Worker/ActionCommandManager.cs#L70-L102) 确认 `::` 与旧式 `##[` 两种解析共用暂停状态，新增恶意包名/路径/标题/ID、随机 token、中途输出异常恢复和三类 null 字段的离线 fixture 回归。

推送后由指挥方确认两扫描实际完成、锁文件与清单目标及 npm 开发依赖覆盖、脱敏清单与三态摘要、硬门禁/部署门控保持；再按真实 CRITICAL/HIGH 逐项分诊，届时才决定是否需有依据的忽略清单。作业成功本身不代表扫描完成或风险消失。

### 阶段10C：首次真实扫描分诊（2026-10-17）

事实：[CI run 39075070763](https://github.com/djblack1209-coder/EXAM-MASTER/actions/runs/39075070763) 扫描提交 `558f82d0`，Lint & Test、Security Scan 均 success，两项部署 skipped；只读 GitHub API 已复核。Security Scan 作业 `117520410520` 实际运行 Trivy v0.70.0：5 个目标、漏洞 0 CRITICAL / 1 HIGH、密钥 0 CRITICAL / 0 HIGH；npm audit 实际退出 0，0 critical / 21 high，阈值仍是 critical。原始 JSON 按既有流程删除，648 行完整日志保留在 `tmp/p10c-evidence/security-scan.log`，不把绿色作业解释为零风险。10B2 已复核 `558f82d0` 通过：阻塞项及新增问题均为空，50 项离线回归及独立 runner 命令解析核对完成，注入阻塞解除；原报告 `tmp/p10b2-audit/report.json` 保留。

**覆盖核对**：`git ls-files` 共找到 18 份相关锁文件、清单或包元数据，逐项对应如下。未列为单独目标不等于被目录排除；本次只跳过根及嵌套 `node_modules`，没有排除以下源码目录。

| 清单 / 元数据                                                                                 | 实际目标与原因                                                                                                                                                                                  | 覆盖判断                                                                                                                   |
| --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `package-lock.json`                                                                           | 目标 1，npm 锁文件                                                                                                                                                                              | 已扫；唯一 HIGH 在此                                                                                                       |
| `laf-backend/standalone/package-lock.json`                                                    | 目标 2，npm 锁文件                                                                                                                                                                              | 已扫，无 CRITICAL/HIGH                                                                                                     |
| `laf-backend/standalone/requirements-sympy.txt`                                               | 目标 3，sympy 1.14.0 / mpmath 1.3.0 精确版本及哈希                                                                                                                                              | 已扫，无 CRITICAL/HIGH；未安装传递包的清单之外内容不作保证                                                                 |
| `requirements-dev.txt`                                                                        | 目标 4，ruff 0.17.0 / pytest 8.4.2 精确版本                                                                                                                                                     | 已扫，无 CRITICAL/HIGH；不含其完整传递依赖闭包                                                                             |
| `src-tauri/Cargo.lock`                                                                        | 目标 5，Cargo 锁文件                                                                                                                                                                            | 已扫，无 CRITICAL/HIGH；语言特有限制见下文                                                                                 |
| `package.json`                                                                                | 声明由根锁文件承载，不单列目标                                                                                                                                                                  | 无新增清单缺口                                                                                                             |
| `laf-backend/standalone/package.json`                                                         | 声明由同目录锁文件承载                                                                                                                                                                          | 无新增清单缺口                                                                                                             |
| `scripts/compat/file-type/package.json`                                                       | 本地 file: 适配包，其 `file-type-modern` 21.3.4 由根锁文件承载                                                                                                                                  | 无新增外部依赖缺口                                                                                                         |
| `requirements-baidu.txt`                                                                      | 5 项均为版本范围；[v0.70.0 pip 解析器](https://github.com/aquasecurity/trivy/blob/v0.70.0/pkg/dependency/parser/python/pip/parse.go) 默认只取精确 `==`，没有可生成目标的包                      | **缺口**：百度资料工具及其传递依赖未覆盖；不能把最低版本当实装版本                                                         |
| `scripts/pipeline/requirements-docling-macos-arm64.txt`                                       | 81 项均为带哈希的 wheel URL；同一解析器不解析 URL 中的包名/版本                                                                                                                                 | **缺口**：Docling 工具环境未覆盖；不是 skip-dirs 所致                                                                      |
| `laf-backend/package.json`                                                                    | 托管 Laf 的 `nodemailer ^10.0.13` 无独立锁文件；fs 的 [npm 分析器](https://github.com/aquasecurity/trivy/blob/v0.70.0/pkg/fanal/analyzer/language/nodejs/npm/npm.go) 不用孤立声明生成漏洞依赖图 | **缺口**：托管端实装邮件版本未知；standalone 的 10.1.0 扫描不能替代                                                        |
| `src-tauri/Cargo.toml`                                                                        | 与 Cargo.lock 同读以识别根依赖，不单列目标                                                                                                                                                      | 当前没有 dev-dependencies；唯一根 build-dependency `tauri-build` 也可沿锁文件 `tauri → tauri-build` 到达，不将其误报为遗漏 |
| `pyproject.toml`                                                                              | 仅 Ruff 配置，无项目依赖声明                                                                                                                                                                    | 不适用，无新增依赖缺口                                                                                                     |
| `nativeplugins/Yozi-Connector/package.json`                                                   | 原生插件元数据，无 npm 依赖；系统 framework 名称不是 npm 清单                                                                                                                                   | 不适用；不代表原生 SDK/系统库已扫描                                                                                        |
| `uni_modules/uni-config-center/package.json`                                                  | DCloud 插件元数据，无外部 npm 依赖                                                                                                                                                              | 不单列目标；随库源码不属于锁文件漏洞匹配范围                                                                               |
| `uni_modules/uni-id-common/package.json`                                                      | DCloud 插件元数据，仅声明本地 uni-config-center 模块                                                                                                                                            | 不单列目标；随库源码同样未作独立漏洞匹配                                                                                   |
| `uni_modules/uni-config-center/uniCloud/cloudfunctions/common/uni-config-center/package.json` | 本地公共模块元数据，无外部 npm 依赖                                                                                                                                                             | 无外部依赖遗漏；**边界**：模块本体版本未独立匹配通告                                                                       |
| `uni_modules/uni-id-common/uniCloud/cloudfunctions/common/uni-id-common/package.json`         | 唯一依赖为指向上行模块的 file:，无独立锁文件                                                                                                                                                    | 无新增 registry 依赖；**边界**：随库模块及其内嵌代码须另行审计                                                             |

开发依赖证据：CI 日志第 485、515 行记录运行步骤实际继承 `TRIVY_INCLUDE_DEV_DEPS=true`；根/standalone 锁文件分别有 768/16 个 `dev:true` 条目。[扫描器第452–495行](https://github.com/aquasecurity/trivy/blob/v0.70.0/pkg/scan/local/service.go#L452-L495) 在 include=true 时直接跳过开发包剔除，[官方 npm 说明](https://github.com/aquasecurity/trivy/blob/v0.70.0/docs/guide/coverage/language/nodejs.md#npm) 与此一致；结合实际扫描成功，可确认 npm 开发依赖被纳入，不能把差额归因为漏扫 dev。`requirements-dev.txt` 也确实是输出目标。原始包列表未保留，不能逐包回验这 784 项；`braces` 在锁内没有 dev:true（因 DCloud 部分包列在 dependencies），它本身不是证明 dev 开关的样本。[Cargo 分析器](https://github.com/aquasecurity/trivy/blob/v0.70.0/pkg/fanal/analyzer/language/rust/cargo/cargo.go#L111-L180) 另有按根普通依赖可达性筛选，不因 npm 开关而纳入独立 dev/build 分支；当前未声明根 dev 依赖，不推广为未来 Cargo 开发依赖全覆盖。

**发现与两扫描对账**：CI 日志第255–275行的 21 个包，与既有 `tmp/p8a-evidence/audit-root-after.json` 的 vulnerability 包集合逐项相同；后者的结构化 via 对象只有一条通告，其余均是字符串形式的依赖传播。再由当前锁文件及离线 `npm ls braces chokidar micromatch fast-glob unimport --all --offline --ignore-scripts --no-audit --no-fund` 核实路径。两边按 GHSA/CVE 别名合并后，**独立通告共 1 条**，没有额外可分诊的运行时通告。

| 独立通告 / 两侧级别                                                                                                 | 包、实装版本、修复版本与目标                                                                                                                   | 实际用途、依赖链与产物影响                                                                                                                                                                                                                                                                                        | 建议动作 / 优先级                                                                     |
| ------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| [GHSA-vfj7-8cjw-p6xm / CVE-2026-93687](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)，均 HIGH，GitHub CVSS 7.5 | `braces 3.0.3`；Trivy FixedVersion 未提供；GitHub first_patched_version=null、受影响 <=3.0.3；目标 `package-lock.json` / `node_modules/braces` | 开发/构建工具：DCloud `uni-cli-shared → chokidar 3.6.0 → braces`；或 `uni-cli-shared / vite-plugin-uni → fast-glob 3.3.3 → micromatch 4.0.8 → braces`；`uni-app-plus → uni-app-uts → unimport 4.1.1 → fast-glob` 亦传播。恶意深层花括号模式会耗尽栈并终止 Node 构建进程；当前未见产品用户输入到该工具的运行时入口 | P2，跟进上游修复；按本轮规则限时接受开发构建风险，不自动降级 DCloud，也不声称漏洞修复 |

npm 的 21 是 `braces` 加 20 个受影响包的元漏洞传播计数：`chokidar`、`fast-glob`、`micromatch`、`unimport` 及 16 个 DCloud 包（逐项在原 CI 日志）；Trivy 的 1 是一个目标中一个已装包的一个漏洞匹配，不把其上层使用者各算一条通告。两者都包含 npm dev，差额来自计数口径。npm 使用 registry 审计通告，Trivy 使用自己的漏洞数据库及严重性选择；本条两侧均 HIGH，GitHub 通告也为 HIGH，严重性差异不是本次差额原因。CI 脱敏清单未输出 Trivy SeveritySource，因此不推测该字段具体值。npm 的旧 `uni-cli-shared 0.2.994` 等 fixAvailable 是有破坏性的上层替换/降级建议，不是 braces 已发布补丁，也不是已验证兼容方案。

产物判断依据：阶段8A日志中 H5 / 微信 / App 模块守卫分别核过 388 / 429 / 376+4 个模块，均记录 braces absent；`vite.config.js` 的既有守卫拒绝把 braces 纳入客户端模块图，源码/后端无其调用，standalone 锁内也无该包。阶段8A交接提交 `4ae0f52f` 到本次扫描提交的客户端、相关构建配置及两份 npm 锁文件无差异，故复用现有证据判断当前 H5、微信、App 不带该漏洞包；未重新构建、未据此宣称真机或所有原生 SDK 已验收。

**处理决定与后续**：只在根 `.trivyignore` 登记 `CVE-2026-93687 exp:2027-01-15`（从 2026-10-17 起 90 天），附无修复、仅构建用途及产物依据，独立提交。GitHub 只读核对的[上游 tags](https://github.com/micromatch/braces/tags) 最新为 3.0.3，[问题70](https://github.com/micromatch/braces/issues/70) 仍 open，通告尚无已知修复版本，符合本轮限时规则。[Action v0.36.0 入口](https://github.com/aquasecurity/trivy-action/blob/v0.36.0/entrypoint.sh#L23-L75) 在未提供 trivyignores 时不覆盖默认忽略路径；[默认参数](https://github.com/aquasecurity/trivy/blob/v0.70.0/pkg/flag/report_flags.go#L68-L73) 与 [Filter](https://github.com/aquasecurity/trivy/blob/v0.70.0/pkg/result/filter.go#L24-L45) 仍读取工作目录 `.trivyignore`，[文本解析及到期剔除](https://github.com/aquasecurity/trivy/blob/v0.70.0/pkg/result/ignore.go) 支持 `ID exp:YYYY-MM-DD`，到期按 UTC 日期比较；无需恢复 Action 输入。纯文本忽略按 ID 全局适用，没有路径限定：一旦新增运行时引用或后端同名依赖，必须撤销并重新分诊。npm audit 仍报告 21 high；忽略不是修复，不修改发布门禁。

- 下一依赖批次：复查 braces 上游修复；如出现可兼容的补丁/次版本或 overrides，不延续忽略，获客户联网下载许可后更新及验证。当前这一独立通告没有已确认可用的非破坏性修复包，本阶段不下载、不升级。
- 扫描覆盖待办：为百度环境的实装完整依赖、Docling wheel 元数据及托管 Laf 运行时建立可核验的版本清单，再用现有 CI 方案补扫；随库 uniCloud 模块保持独立源码/版本审计边界。本阶段只登记，不修改这些清单或引入扫描工具。
- [Ubuntu 26 迁移观察](https://github.com/actions/runner-images/issues/14748)：ubuntu-latest 自 2026-10-19 起分批迁移，计划 11-19 完成；观察 Python 解析/二进制包、Playwright 系统依赖及编译库变化。现在不改 runner、不安装系统依赖。
- 本轮仅静态分诊及文档/忽略项修改；不运行 Trivy、npm audit/npm view，不下载包/工具，不推送或部署。证据复用 `tmp/p10c-evidence/`，保留指定 CI 日志及小型报告，无构建副本；`tmp/p1-*` 与既有服务不动。

本地验证：18 份清单对应、21 包与单一通告对账、90 天到期语法及历史段落未改检查通过；两文档 Prettier 与 `git diff --check` 通过。现有 `toolchain-compatibility.spec.js` 仅选“真实Rollup模块图拒绝”用例，1 通过、42 未选执行，验证内部/外部 braces 均被拒绝、普通模块可产出；不代表重跑全量测试。新增忽略文件的下一次真实 CI 读取效果尚未验证。

10D 只读复核（2026-10-17）：结论可推送、无阻塞。忽略项与 CI 日志中 Trivy 报告的同一 CVE 匹配；trivy-action v0.36.0 无 `trivyignores` 输入时由 Trivy 读取根 `.trivyignore`，`exp:` 于 2027-01-15 00:00 UTC 到期后自动恢复告警；21/21 条 npm audit HIGH 均追溯到同一通告。口径更正：braces 除经 5 个根 devDependencies 外，也经 3 个根 dependencies（`@dcloudio/uni-app-plus`、`@dcloudio/uni-app-vite`、`@dcloudio/uni-components`）的 DCloud 构建链传递引入；用途仍限于构建，三端不打包的结论沿用阶段8A模块图证据（相关构建输入未变）。新增运行时引用时须立即撤销忽略并重新分诊。

推送后验收（2026-10-17）：`33ab6407` 的 CI run 39076689994 全绿；Trivy 提示由 warning 变为 notice「没有 CRITICAL/HIGH；目标=5」，忽略项生效；npm audit 仍按阈值提示 CRITICAL=0、HIGH=21（同一通告）；两项部署 skipped。

**2026-10-17阶段5L【只排空遗留离线任务】**：删除无生产消费者的入队、去重、待写重放、容量淘汰与发送闭包；保留旧格式读取、锁内认领与锁后复核、按id回执、已载入任务取消、有效期、账户隔离、pause/resume、网络恢复及提示条入口。连续审计问题集中在入队路径，故收窄职责而不继续修补重放；未访问用户存储来推断无遗留。现行合同见[04](04-API-DOCUMENTATION.md#阶段5l只排空遗留离线任务现行)、[05](05-DATABASE-SCHEMAS.md#阶段5l遗留队列持久合同现行)，最终验证及资源收尾见[12](12-CHANGELOG.md#2026-10-17-遗留离线队列收窄阶段5l)。最终231项相关回归、全量5279通过/6原Mongo跳过/零失败，lint、三端隔离构建、公开产物与包体检查通过；无性能超时。保留5L/5K候选与指定5G回退，已回收冗余5I/5J构建。不扩展后续功能、推送或生产授权。

## 阶段5L审计条目处理

| ID                        | 处理与依据                                                                       |
| ------------------------- | -------------------------------------------------------------------------------- |
| fixes-21-01               | 随入队路径删除而关闭；无pendingEnqueues及失败重放投影。                          |
| fixes-21-02               | 随入队路径删除而关闭；无重放换id，取消不会产生新任务。                           |
| order-21-01               | 随入队路径删除而关闭；无待重放更新覆盖后继正文。                                 |
| order-21-02               | 随入队路径删除而关闭；无重放换id重复发送。                                       |
| order-21-03               | 随入队路径删除而关闭；与fixes-21-02同源，dequeue/clear无重放副作用。             |
| fixes-20-02 / order-20-02 | 随入队路径删除而关闭；5K有序去重更新及专用测试删除，历史验证不回写。             |
| migrate-10-03             | 随入队路径删除而关闭；requestFnMap删除，发送仅从遗留requestData经rebuilder重建。 |
| order-20-03               | 保留；跨上下文重复提交对排空遗留任务仍适用，无跨窗口租约与服务端统一taskId幂等。 |

今后若需要离线提交，须按“跨窗口认领租约 + 服务端按任务 id 幂等”重新设计入队，不恢复本次删除的实现。当前生产未注册rebuilder，无法重建时任务保留并报告未同步；真实服务端发送/设备验收仍独立成立。

**2026-10-16阶段5K【恢复登记与去重重放】**：仅修复 fixes-20-01/order-20-01 与 fixes-20-02/order-20-02；中断恢复和登记保持同一锁回调与原意图/退出栅栏，失败去重替换有序重放并确认后清除；普通退出和游客迁移证明保持既有边界。2026-10-17最终核验：251项相关回归（12项新增）、全量5284通过/6原Mongo跳过/零失败，lint、三端隔离构建、公开产物及包体检查通过。审计ID与测试名见[04](04-API-DOCUMENTATION.md#第十一轮定点修复恢复登记与去重重放阶段5k)，前序超时、自引入差分修正、完整验证及资源收尾见[12](12-CHANGELOG.md#2026-10-16-恢复登记与去重重放修复阶段5k)。order-20-03作为既有限制已补收到的审计证据，本轮不修；不扩展后续功能、推送、生产或设备验收授权。

**2026-10-16阶段5J【推送前针对性修复】**：仅修复 fixes-10-01/02/03/04 与 order-10-02（重复ID见04矩阵）；其他第10轮发现先在4780191a对照归属。发送占用与认领归属、去重目标id、故障期间迁移逻辑槽、过期容量清理及中断身份恢复已落实；最终239项针对性回归、全量5272通过/6原Mongo跳过/零失败、lint及三端隔离构建和产物检查通过；前两轮既有性能波动、归因与收尾见[12](12-CHANGELOG.md)。本阶段明确不推送、不部署，不扩展后续功能批次。

## 账户隔离后续批次（第 10 轮审计）

以下5项的历史归属均在 `4780191a` 和 `37206056` 以同一探针复现，归属既有问题；其中migrate-10-03在5L随入队路径删除而关闭，余4项在2026-10-17定点修复。历史复现回执为 `tmp/stage5j/attribution-baseline-final.json`、`attribution-current-final.json`（5个探针，计时含stop/pause），正文另见 `body-baseline.json`、`red-body-only.json`。这些历史回执只验证“问题存在”；本轮正确行为的红绿回归、相关检查及未验证边界见[12](12-CHANGELOG.md#2026-10-17-账户隔离遗留写入修复第10轮遗留)和`tmp/p1-isolation/`（含`audit/`与`fix/`）。下表保留原审计场景与归属依据，前四项为本轮已修范围，不构成构建、设备或公开发布验收。

| ID / 级别                                    | 位置                                                                                        | 场景摘要                                                                                        | 建议修法                                                                                     | 归属依据                                                                                                                    |
| -------------------------------------------- | ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| **writes-10-01 / P1：本轮已修**              | `src/components/business/learning/journey-reminders.vue` edit/save                          | 账户1打开草稿，切至已有路线的账户2，原组件保存将旧提醒写入账户2分区；同账户重登录也不撤销旧编辑 | 编辑开始保存原绑定和上下文；保存验证并沿用，owner/epoch换代撤销编辑，同账户续期保留草稿      | 两版本挂载真实组件和Store均出现账户2 reminder.set；5I未修改该文件，edit/save源码相同                                        |
| writes-10-02 / regress-10-01 / P2            | `src/pages/practice-sub/question-note.js` addNote/\_saveNotes；`do-quiz.vue` handleSaveNote | 底层保存SESSION_UNAVAILABLE，仍返回success，页面提示成功并清空草稿，重载无笔记                  | 传递保存回执与暂不可用；仅确认后成功/关闭；失败保留草稿及原绑定待重试，同类笔记/标签同步核对 | 两版本实际存储save注入失败，addNote及真实页面方法均复现；5I仅添加初始化末尾assert，未改保存/页面方法                        |
| regress-10-02 / P2                           | `src/pages/practice-sub/question-timer.js` \_matches/stop/pause                             | 身份暂不可用使本地stop/pause失败，interval仍存活并多计隐藏时间                                  | 按计时token归属立即本地停止/暂停；业务写入/回调另核对原会话；旧token不可停止新计时           | 两版本真实计时器stop/pause均失败且active/interval保持；5I未改\_matches/stop/pause                                           |
| order-10-01 / P2                             | `src/services/auth-storage.js` getLoginSessionEpoch/checkSession                            | 快照失败后补读旧记录，期间同账户续期推进generation，误判changed并删除防抖待写                   | 补读前后generation夹读，遇并发保持unavailable与待写，仅确认owner/epoch改变才撤销             | 两版本存储读取钩子在补读记录后交错实际续期，原绑定恢复current但flush后待写已丢；补读无一致性循环在5I前已存在                |
| migrate-10-03 / P2（5L随入队路径删除而关闭） | `src/utils/core/offline-queue.js` 事务刷新/恢复与requestFnMap                               | 第二实例替换正文后，第一实例刷新任务却保留旧闭包；旧正文发送并删除新正文任务                    | 5L随入队路径删除而关闭：删除requestFnMap，遗留正文仅由rebuilder重建；原绑定闭包建议不再执行  | 两版本transaction及recovery探针都发送正文1、未发正文2；478的旧载入保留本地旧项，372的事务投影更新正文但仍留闭包，缺陷均存在 |

已声明的残留限制 **order-20-03 / P2：跨上下文重复提交同一任务**：离线队列没有跨窗口发送租约，也没有端到端幂等保证。收到的第20轮order审计证据为：两个独立H5执行上下文共用存储及同一Web Lock，第一个发送后等待确认，第二个处理已载入的同一任务；独立合成接收worker实际收到相同taskId两次、分别确认成功，最终持久队列为空。`37206056`对照同样存在，属于既有限制，本轮不修；此处记录提供的审计证据，本轮未重新运行该接收worker探针。后续须持久化带归属/恢复期限的认领、锁内核对，并由服务端按任务id幂等接收。同运行时认领不等同于跨窗口发送租约；多窗口、进程崩溃和远端已收但本地未确认须协议处理，不宣称恰好一次。

**2026-10-16阶段5H【第八轮终审设计收口】**：本批只统一身份generation事务、无Web Locks拒绝登录、离线任务状态机、可恢复启动与原绑定计时器，不提前扩展功能批次。当前候选与有效回执为`tmp/stage5h/`；最终检查与平台缺口见[12](12-CHANGELOG.md)，现行接口/持久合同见[04](04-API-DOCUMENTATION.md#第八轮终审身份事务队列与启动恢复阶段5h)、[05](05-DATABASE-SCHEMAS.md#阶段5h身份代数离线状态机与启动恢复现行)。当前候选核验成功后保留5G回退，回收已覆盖的5F三端生成物；历史回执、日常App与正式原生恢复链保持。WebView2和微信/App真机未验；全量的既有性能夹具准备超时、单项复验通过，波动根因未确认，性能门禁未全绿。公开发布门禁不变。

**2026-10-16阶段5G【第七轮终审收口】**：继续既有会话入口/读取/写入合同，修复发起尝试栅栏、OAuth迟到回调、同步重入重置、可重试初始化、只读导航、连接器续段、处理中退出和离线发送确认；不扩展功能批次。当前隔离候选与回执为`tmp/stage5g/`，最近成功回退保留`tmp/stage5f/`，新候选核验后仅清理被覆盖的5E三端生成物；历史回执、日常App与原生恢复链保持。逐项范围、验证与限制见[12](12-CHANGELOG.md#2026-10-16-第七轮终审修复阶段5g)；真实账号/供应商、自然多窗口、设备和公开门禁继续待验。

**2026-10-16阶段5F【第六轮终审修复完成】**：本批限定于登录回滚/排队、严格读取、暂不可用回执、先撤销退出、游客分代与防抖隔离。全量5156通过/6项原Mongo环境跳过/零失败，36项新增回归；三端隔离构建、736文件公开产物审计及1940957/181028字节微信预算通过。统一读取失败不提供空写入基础，新增队列内容留在内存，成功重读合并后再写；旧事务不得恢复已退出身份或影响后继尝试。功能规划和外部授权边界不变，逐项用例/最终验证及资源收尾见[12](12-CHANGELOG.md)，读取迁移目录见[04](04-API-DOCUMENTATION.md#第六轮终审持久化读取与成功回执阶段5f)。

**2026-10-16阶段5E【第五轮正常流程回退收口】**：仅落实同账户续期继续、暂不可用保留队列、资料按字段提交、游客安全复制、纯本地阅读与延迟确认原会话绑定。功能规划不变；验证和逐项回归见[12](12-CHANGELOG.md)，现行接口/持久化合同见[04](04-API-DOCUMENTATION.md#用户数据持有者--绑定方式阶段5)、[05](05-DATABASE-SCHEMAS.md#本机登录会话代号2026-10-16)。本轮未提供生产、推送或设备验收授权。

**2026-10-16阶段5D【第四轮防回退收敛】**：本轮仅修复会话终审12类问题，落实owner/epoch操作绑定、快照完整性分离、可恢复待写/队列、老格式升级不撤销、跨窗口Auth同步和无锁冲突失败关闭；功能开发没有提前启动。正常续期、升级、恢复、新练习/计划及游客零值保留均有回归；最终全量5090通过/6项既有Mongo环境跳过/零失败，31项新增回归、三端隔离构建/公开产物与预算、真实H5状态显示和恢复通过。最终验证和资源收尾见[12](12-CHANGELOG.md)。本地提交不构成推送、生产、短信、收费或设备验收授权。

**2026-10-16阶段5C【终审问题第三轮收敛】**：本地修复与最终隔离核验完成。身份更新/迁移统一锁内CAS，登录失败只回退自有提交；暂不可用保留只读投影、防抖待写与游客迁移证明，重置可重入，收藏延迟确认保持原绑定、计划单例每动作重读且确认保存后成功。终审12项（regress-1/order-1同一问题）均已有失败回归；最终全量5059通过/6项既有Mongo环境跳过/零失败，源码lint、三端构建与公开产物/包体审计通过；微信主包1934407字节、媒体181028字节，回执及资源收尾见[12](12-CHANGELOG.md)。未扩展功能、生产授权或设备验收范围。

**2026-10-16阶段5【会话入口绑定】**：13项审计问题的本地修复、三端隔离构建与产物审计完成；统一会话快照、传输与属主存储入口，撤销不复活、读取异常可重试、缓存恢复不换代。18条审计场景在`2c739ff4`全部失败，修复版通过；最终全量5000通过、6项MongoDB环境跳过，另1项既有性能夹具准备超时且单独复跑仍超时，相关源码未改，负载归因与低负载待复验见12。原生10项及lint通过，自有进程与冗余临时材料已收尾，保留当前候选/回退链；真实多窗口、账号/401、对应设备和公开发布分别待验，原有功能与发布范围不扩展。当前合同见[04](04-API-DOCUMENTATION.md#用户数据持有者--绑定方式阶段5)、[05](05-DATABASE-SCHEMAS.md#本机登录会话代号2026-10-16)与[12](12-CHANGELOG.md#2026-10-16-会话入口绑定阶段5)。

本文只保留当前计划：范围与交付顺序、已采用的关键决定、A—E 批次、完整交付核对矩阵、最近一次阶段汇报和汇报约定。逐阶段的历史汇报与验收细节见 [12 变更记录](12-CHANGELOG.md) 和 git 历史（2026-10-10 精简前的完整版本见提交 `77093a22`）。

客户2026-10-12要求继续建立目标推进：优先功能模块与上游开发/接入，功能完成后继续UI/UX。沿已有模块和候选逐批实现与验收；设备、来源、生产及长期效果门禁分别保留，不因一个外部条件未就绪停止其他功能。

客户2026-10-13追加要求优先查清反复UI/UX问题，并重读原模板、抽取复用要素、落实一条路径的闭环。本轮将该学习路径的UI/UX收口提到当前阶段；技术行为已经通过的部分复用，不重跑完整生命周期或将所有功能、设计同时开工。设计依据与后续复用顺序集中在[07现行规则](07-STYLING-SYSTEM.md#模板抽取与后续复用2026-10-13)。

**完整交付目标【进行中】**：客户本次要求推进到全部闭环，目标已建立；已验的本机数学/复习候选不等于全部开发完成。本批继续真实模型界面和发布缺口。协议确认与合成账号实际邮箱登录通过；两次合成学习请求都因本机Groq域名解析到受阻地址而在调用上游前拒绝，真实教学、提示后订正与独立检验尚未走通。修复未调用/无结果的恢复提示及提示落在屏幕外的问题，隔离H5宽窄/中英文/焦点、停止和普通重开保持2原答/32事件。发布配置检查补上模型保险库密钥格式，117项相关检查通过，未全量复测。页面修正已继续同源交付到日常网页与唯一Mac入口；用户体验与真实模型正向教学仍未完成。

**同源交付补充【事实】**：网页沿正常PWA更新启用index-DaKcbRHv，原5答/43事件逐字保持。Mac两身份沿既有UUID构建、归档完整读回并实际启动；独立QA仅一次本机模拟失败，无供应商调用、作答或判分，17份原答及220事件完整前缀保持，最终17答/230事件停止重开逐字相同。日常原27目标/32答/3资料/444事件在更新前、候选还原、安装后与普通重开逐字一致，停止/深色/暂停提醒保持；只有程序可执行文件变化，原8项其余元数据与权限配置保持。复用已通过117项，无源码逻辑变更或全量复测。[同源交付变更](12-CHANGELOG.md#2026-10-13模型失败界面同源网页与mac交付)。

**发布缺口【事实与未验证】**：10月14日当前题库报告为113/127槽位、3901卡、14覆盖及8来源配对缺口；119槽位自动配对继续单列，公开使用证据覆盖为0/127，许可缺口127，已启用范围答案/判分阻断均为0；不是七个学段的全部课程覆盖。来源计数沿既有自动配对规则，不证明其余来源已经独立完成权利与评分权威核验。现有依赖风险未取得解除依据；前轮官方问题与版本查询没有形成修复结论，本批不重复联网审计。生产配置只做源码预查，没有读取真实生产环境；归档材料存在不替代新鲜外部验收。[题源修复](12-CHANGELOG.md#2026-10-14数学二题源误准入修复)与[完整矩阵](#完整交付核对矩阵)继续作为唯一安排。

## Now / Next / Later（2026-10-13）

**2026-10-16阶段5B【会话复审收敛】**：17项审计问题均先在`3281a5b8`复现后修复；登录尝试顺序、完整身份提交与独立撤销、迁移比较交换、可证明游客迁移、FSRS/练习原绑定、不可用只阻写/外发、守卫重入及积压通知已收口。新增31项，冻结源全量5032通过/6项既有Mongo集成跳过/零失败；源码lint、隔离三端构建与公开/平台产物检查通过，主包1929903字节、媒体181028字节。[完整结果](12-CHANGELOG.md#2026-10-16-会话复审收敛阶段5b)与[持有者清单](04-API-DOCUMENTATION.md#用户数据持有者--绑定方式阶段5)为接续依据。

**T1未复现/跟踪边界**：同名全部action遍历在未改动基线6.67秒、冻结版全量7.237秒通过，包含无通知换代、写入/请求拒绝、只读重读，未改用例或10秒阈值。缺原失败断言/堆栈，不能确定先前56.63秒是调度超时还是断言失败；本阶段不猜测修改代码。若再现，先保留失败位置/负载并作同负载基线比较。旧不明全局学习值保留且不自动归户；真实多窗口、真实账号/401、对应设备和公开发布继续单列，本批未改变功能规划或提供生产授权。

**2026-10-16阶段4H【操作与写入用时检查】**：本地实现与隔离核验完成。全部112个Store action在操作前核对持久化/绑定代号，写入和异步回执另核对发起会话、记录及取消；换代先同步撤销连接/共享/缓存/忙碌状态并拒绝旧请求，只读可重读，新授权后的请求不受旧finally影响。原件删除、资料登记、历史缓存、同步和流式写入全部覆盖；格式迁移先写确认再删，空旧副本和前缀删除不误判登出，真实积压退出保持。新增14项，最终4981项中4975通过、0失败、6项既有专用Mongo集成跳过；lint、隔离三端构建、735文件公开扫描和App/主包检查通过，主包1907953字节、媒体181028字节。候选/证据在`tmp/stage4-20261016/stage4h/`及既有资源记录，保留4H/4G候选与4D/原回退链，已覆盖的4F构建回收且证据保留；[112入口及写入/外发清单](04-API-DOCUMENTATION.md#会话用时检查覆盖清单阶段4h)、[变更记录](12-CHANGELOG.md)。未推送或改变日常App；真实双窗口、账号/401、App/微信设备和公开发布分别待验。

**2026-10-16阶段4G【登录会话代号与积压撤销隔离】**：成功登录（含同账户再登录、微信回调、静默登录）由存储层加密保存新随机代号，续期/重复保存/资料更新保持；旧用户无代号首次读取补写，不退出。Store对任一身份通知重读代号；不同、缺失或跨窗口删除提示均完整重置并取消旧请求，结果落地前再次核对，拒绝积压退出→同账户登录后的旧正文、预览与工具；公共请求缓存亦隔离。新增41项，全量4967项中4961通过、0失败、6项既有专用Mongo集成跳过；lint、隔离三端构建、735文件公开产物和App/微信包体检查通过。候选/证据为`tmp/stage4-20261016/stage4g/`，4F候选及4D/原回退基线保留，4E冗余构建回收且证据保持。存储合同见[05](05-DATABASE-SCHEMAS.md#本机登录会话代号2026-10-16)，请求合同见[04](04-API-DOCUMENTATION.md#跨学科学习记录查找2026-10-16)，收尾见[12](12-CHANGELOG.md)。真实双窗口、账号/401网络退出、对应设备与公开发布另验；本阶段不扩展功能或发布范围。

**2026-10-16阶段4F【同账户续期保持会话】**：身份通知后比较权威账户ID与实际账户令牌；同账户续期保留配置、连接、共享许可、在线模式、搜索与原答，只撤销不能重鉴权的旧凭据请求，本地模型/资料/历史继续；相同有效凭据或资料更新不撤销请求。账户切换、退出、重新登录及无法可靠识别ID保持完整重置。新增44项真实加密路径回归，全量4926项中4920通过、0失败、6项既有专用Mongo集成跳过；lint、隔离三端构建、735文件公开产物及App/微信包体审计通过。候选与证据为`tmp/stage4-20261016/stage4f/`；真实双窗口/账号/401网络退出和对应设备另验，日常App及既有回滚基线保持。当前合同见[04](04-API-DOCUMENTATION.md#跨学科学习记录查找2026-10-16)与[14](14-MODEL-PRIVACY-COST.md#本机学习记录查找2026-10-16)，验证与收尾结果见[12](12-CHANGELOG.md)。本阶段不扩展功能或发布范围。

**2026-10-16阶段4E【加密身份监听补齐】**：学习Store订阅存储层统一身份通知，涵盖7种身份/令牌键的明文、加密和兼容前缀形式，同窗口登录/退出/令牌变化、原生uni/wx写入及跨窗口通知共用撤销路径；兼容身份不复用旧缓存，进行中的读取取消后不采纳迟到结果。新增17项回归，全量4882项中4876通过、0失败、6项既有专用Mongo集成跳过；源码/工具lint、隔离三端构建、735文件公开产物及包体审计通过。候选与回执复用`tmp/stage4-20261016/stage4e/`和现有资源记录；日常App、旧候选及必要回滚基线保持，真实双窗口/账号与对应设备另验。本阶段仅补齐复核阻塞，不扩展功能或发布范围。[收尾记录](12-CHANGELOG.md#2026-10-16-加密身份与跨窗口统一撤销阶段4e)。

**2026-10-16阶段4D【审计阻塞修复与隔离回归完成】**：账户/生命周期通知先同步撤销搜索、筛选和原答投影，读取中/失败期间隐藏旧正文并提供加载/重试。记录搜索按修订复用只读投影，分页后格式化日期，输入防抖180毫秒；5000规范原答、约367万字符的独立本机无命中基准通过100毫秒目标，CI采用独立宽限，不能替代设备性能。SymPy仅调整测试子进程启动限时，产品安全限额保持。完整4865项中4859通过、0失败、6项既有专用Mongo集成跳过；三端最终隔离构建、735文件公开产物与App/微信包体检查通过。网页合成A→不兼容B、失败重试、返回A及390px恢复入口实操通过，A的1原答/11事件保持。当前候选与回执为`tmp/stage4-20261016/stage4d/`；原三端回退候选及必要恢复链保留，日常App未更新。对应设备、真实账号/模型、自然跨天与公开发布继续按既有门禁；本阶段到修复交付边界，不扩展功能范围。[收尾记录](12-CHANGELOG.md)。

**2026-10-16阶段4第2批【通用记录查找与复习筛选完成】**：优先交付跨学科、跨学段可复用的原题/原答查找，避免继续平移物理小主题。侧栏支持目标、题干、学科/知识点及全部已提交原答，稳定分页并明确打开原会话/题目及指定旧稿；可靠错答、部分正确、待核对与本次帮助分别筛选，不把未来未答或AI辅助分数升级为事实。13项查找及8项筛选新增检查、聊天/页面/阶段2D守卫共4文件194项通过；后端类型、三端候选/公开产物与App、微信包体检查通过。网页真实合成流程4原答40事件、帮助0/0/0/1，错答/待核对/帮助分别命中，搜索/筛选/清除零写，停止重载全状态严格相同；390px抽屉超高导致清除不可点已修复并实操，宽屏也已观察。该完整批次到交付边界，复用`tmp/stage4-20261016/`及原候选目录，首批提交不改写。下一批可继续更广有可靠依据的独立学习路径；同源Mac/对应设备、大记录容量、自然跨天/长期效果、模型正向与公开发布分别待验。真实模型限次/账号/渠道审核、部署、短信和收费待具体授权与外部条件。

**2026-10-16阶段4功能接续【C批科学聊天小批次完成】**：本次明确恢复功能开发，按C批“更广独立题型”接通功与动能、速度—时间图两项已有科学能力的聊天入口；复用既有判分/变式/原时区复测，无新增题源、模型、界面结构或外部授权。当前聊天/两科学合同3文件208项通过，页面与阶段2D守卫另2文件152项通过（不同文件合计360项，其中本批新增19项）；两条实际网页路径分别3答29事件，错答/一次提示后订正/无提示变式及停止重载完整保持，外部请求和页面错误均0。功动能宽屏与速度图390px分别实操，最终H5/微信/App构建、公开产物守卫与App审计通过，微信主包1885563字节/媒体181028字节。该独立批次已到可交付边界；更广独立学科题型、同源Mac/对应设备、自然跨天、模型正向教学及公开发布仍列后续。资源与候选复用`tmp/stage4-20261016/`；真实模型限次/设备账号/渠道审核、部署、短信和收费待具体授权与外部条件，旧暂停及partial历史不回写。

**2026-10-16用户暂停【paused_by_user】**：客户最新明确要求“控制所有会话全部优雅停止当前任务”，撤回此前自动接续。当前压强聊天8项新增及三端候选已通过，准备的1200秒网页路径未启动；实际网页/Mac/设备仍未验。自有UI、运行时与重型/等待请求均0，无未闭写事务，61257已关闭；源码未提交改动、现有回执/日志、候选、原资料与全部必要恢复链保留，日常App、用户4212预览及共享客户端/MCP不动。后续只等客户明确恢复，不因迟到交接或旧授权重新启动。

**2026-10-16压强聊天接续【源码与三端候选通过，实际路径待验】**：将明确中英压强主题接到已有v6工厂及本题帮助，旧入口共用，不改均匀垂直接触条件、判分或页面。8项新增隔离通过，含3答/帮助0→1→0、未来未答、停止重开/恢复、否定/引用/私有具体题与旧原答保护；649误禁用户hint教法的测试失败保留，650只补跑1项。651必要三端构建/审计通过，H5 fV-BrvuA/083c63e0，微信主包1879633字节/媒体181028字节，App零阻断。未联网、改预览/日常或打开新UI。下一步准备复用原61257/3答31事件完整基线的新鲜有限网页实操，先核当前源及真实学习域；缺失即partial，不导入或重演旧作答。旧3答/题目/条件/教法按官方投影保全，新压强错答/提示后订正/独立正确及未来未答分别成立；Mac及其他设备另验。[本批记录](12-CHANGELOG.md#2026-10-16聊天接续已有压强练习)。

**2026-10-16当前接续【原生全文及数据通过，计时部分完成】**：当前Mac候选实际显示三条完整原答及两条correct，正常CmdQ后42答/519事件、17对话教法和全部学习事实严格保持；636使用私有immutable副本，源数据库未SQLite打开，源文件元数据/内容前后稳定。余355.452秒的阅读标记未达360秒，不回填时间或计为完整原生验收通过；06:52:07.289133 UTC提前253.854317秒CLOSED，消费者/精确注册0。0600证据c878337d独立读回同，复用d009；App252779600字节及副本913408字节已回收，02b归档/日常入口/全部旧成功与partial保留。网页AnKg三全文与28ab证据继续有效。当前补齐默认关闭的诗词鉴权调用、固定公开情境及1200毫秒取消/迟到保护，19项新增、后端类型及必要三端构建/产物审计通过，H5为D2EHLPgN/b827e075，微信主包1879287字节、媒体181028字节，App零阻断；默认不联网、不改日常入口。固定免费公开源的有限核验已有本轮授权；646仅一次内存启用原适配器取新停层依据，DNS1个非公网地址被原保护拒绝、HTTPS0，不重试或放宽SSRF，不推断上游故障，在线正向等待外部条件；实际正向、其他设备、模型/长期效果与发布分别待验。[本批结果](12-CHANGELOG.md#2026-10-16mac已存原答全文可见与计时部分完成)、[调用合同](04-API-DOCUMENTATION.md)。

**2026-10-15句子原生冷核【42答519事件通过；正确原答全文UI缺口接续】**：新鲜同源Mac完整三答、实际页顶提示一次、未来仅排、停止/一次普通重开及正常关闭已操作；提前751.7秒CLOSED，2031/2769树组及2479/2528均无、消费者0/精确注销。授权双采样40答500→503事件/帮助0→1，提示区间四完整对象严格同，0600区间98293841保持。606一次冷只读核原39对象/条件/判分/488前缀/profile29/executions8/16旧教法全保，新3原文、等级与0/1/0精确；3原difficulty观察和修订nextStrategy与实际attempt/scope/官方输出匹配，2条原可靠review合法，未来未答。0600新快照d00902cf独立读回同；归档132e/签名9项/注销/消费者0核后回收252779600字节候选App，所有旧链保留、post置空。重开UI只显示首错完整原答，两份正确全文未逐条显示，normalReopenThreeOriginalsObserved与nativeCoreUiVerified均false，actions+coldFacts通过；不拿存储事实补UI通过。只读呈现小改已完成，2项新增页面回归通过，必要三端候选AnKgR34o/f1370c25及现有审计通过；QA42未再读取/写入，无新native或任何UI。下一步只准备复用旧网页3答31事件/61257的只读原文可见性路径，须未来新鲜独占grant核实际存储，缺失即partial关闭，不导入、不重答或提示。Mac呈现及设备仍未验。[冷核与缺口](12-CHANGELOG.md#2026-10-15句子原生三答冷核通过与原答呈现接续)。

**2026-10-15句子当前源码Mac准备【候选可恢复，原生完整路径待独占交接】**：已核旧CYcQ/d0b与当前运行源确有差异，595一次必要桌面/原生构建D3wNZLnm/f70c3b0a，283相关文件镜像一致/Rust不变/复用缓存；原QA39答488事件与b991只读完全相同。596从d9恢复并只换exe，9项元数据/其余8项/签名身份及选项、0600新归档132e2185完整读回和独立试还原通过，试还原副本252779600字节已收回。当前候选保留未打开，日常/4212和旧恢复链保持；不重复已验网页和旧9+5+1。1200秒单一三答/实际页顶提示/未来未答/停止重开路径、提示前后各一次有界轻量只读采样请求、关闭后post已准备；待parent新鲜独占grant，不自启。提示区间4对象严格保持；全程允许与新attempt/scope绑定的原difficulty观察和修订nextStrategy，旧16对话教法保留、新停止全局投影按官方规则核，不新增零profile/整份global相等guard。[准备与未验边界](12-CHANGELOG.md#2026-10-15句子当前源码mac候选与完整验收准备)。

**2026-10-15句子组织聊天接续【网页三答及当前源真实提示位置通过，Mac同源准备接续】**：原12题/判分/组件/复测不改。Dj同聊选题、草稿零写、wrong首句/提示后correct修订/Enter独立correct新句，帮助0/1/0；未来任务未答，停止/root一次重开后3原答31事件及新学习域SHA88fadf63同，0600证据81861cf9保持。原作答观察/自动教法与提示区间4对象分别核对，旧573/rawStorage/543/900等失败不改。页顶归属5项与消息目标1项新回归/各自必要三端候选通过，旧逻辑/网页三答未重跑。nj位置失败870a65cd仍false；B1VNbJ3X新鲜600秒零作答、一次主按钮实测提示y39.5/气泡24在composer694之上，焦点原消息ID、内容与命中均正确，图已亲看无遮挡；只3事件/help1且题/profile/strategy/原答保持，停止后0答12事件，控制台/非静态0。93330/52709/tab正常收口、blank/1090×557恢复，提前430.9秒关闭；0600当前通过证据aff9fb93独立读回同。下一步核当前源native缺口与原39答488事件/b991前态，复用原QA身份/UUID/Rust缓存，仅必要一次同源候选和完整原生路径/post合同READY后交接；不重放网页、不重判旧答、保所有恢复链。Mac、自然次日/语义、其他设备与发布仍分别待验。[当前网页通过与原失败分层](12-CHANGELOG.md#2026-10-15真实提示消息窄屏位置补验通过)。

**2026-10-15澄清与直接参考合并Mac【同源有限核心通过，原37保持；旧硬门禁partial保留】**：283份相关源/入口核同、Rust/QA身份UUID保持及必要一次单worker locked/offline构建的CYcQ_xay/d9候选已实际验。新独立1200秒完成初二必要澄清且无默认数学→同会话明确邮件保首goal→两稿pending/help0,1和主入口一次同聊完整公开参考→只开club-room不交第三稿→stop/正常退出/同路径一次重开，旧目录/私人资料1保持。全部720/660/600/480/420/360/300/120门槛满足，提前726秒关闭，两个精确主进程/树/组及消费者无、入口注销。UI释放后原FIFO一次只读后检保原37核心/467前缀/profile/executions及15个旧会话有效教法；自然39答488事件，两稿全文/换行/尾空格精确、参考一次，无新strategy.set/auto/model/profile/可靠复习/诗词。当前全局严格等官方新停止会话投影，旧global字节不等仍false，不回拨或重写旧543/rawStorage失败；原生逐动作global字节与独立网络/账单未另采。新0600快照b991891e独立读回同，d9归档/9项元数据签名/未注册/无消费者复核后仅删临时App252779600字节，worker已回收，prepared argv=null。首900秒目标未发partial、a070观察37及success34/31/25和全部恢复链保留；无UI重开、重判、合并、日常安装或旧检查重跑。此项不替代网页rawStorage、真实模型/其他设备、日常同源交付、来源依赖/公开发布及长期效果。[最新验收](12-CHANGELOG.md#2026-10-15初二澄清与直接参考同源mac有限路径通过)。

**2026-10-15离线邮件直接参考【9项新定向/三端及网页核心通过，原始storage恒等门禁仍partial】**：主入口“读参考信件”/Read sample email直接在同聊天显示既有公开示例、全文和准确出处许可，只记本题真实hint，不strategy.set/模型/判分；否定/引用/停止、其他题/非offline/批量边界保持。7逻辑/2页面与静态、H5 Ctrv3wPq/CDN2588/407、微信335文件1877747字节/媒体181028及App审计通过。真实单网页两稿全文精确pending/help0,1，主按钮一次显示公开参考且首稿/strategy/profile/原题完整不变，只开club-room条件核help0不交第三稿；stop/390/普通root一次重开学习state及19事件前后SHA完全相同、仍停止。整份localStorage仅新增\_\_DC_STAT_UUID、全部原键值字节同，但原硬校验仍false；0600失败现场读回同，不回写或排除键假通过。一次源定位为uni-h5缺值时生成的本地设备标识，统计配置关闭，无学习域差异，不造产品持久修补；精确触发回调/afterRoot网络未采。自有tab/60582/PID67323正常回收、blank/1090×557恢复，提前183秒关闭。QA37、partial37与34成功/31/25及归档保持，旧543partial不变；不重复旧完整链。

**2026-10-15英文邮件Mac接续【三原稿与原34事实通过，严格教法元数据门禁partial】**：沿原273源核同及已验程序链复用邮件对应归档，重核SHA/9项元数据/严格签名，仅还原一份候选，无新测试/编译/压包；最新澄清2源变更另记。启动前QA与0600的34答442事件基线完整相同。实际900秒单窗口走通邮件goal/建议草稿/明确送、3完整原稿、一次本地出处参考、异情境独立稿、stop/正常退出/同路径一次重开；所有时间闸满足，提前393秒关闭，两精确主进程/组/消费者无并注销。通用提示误点产生真实4事件/3消息，离线提示后改从已明确的本地参考入口继续，未连接/切换模型，不删记录凑数。原post的strategy全对象相等断言失败，未放宽；随后只读诊断原34答/条件/判分/会话/材料/计划/复习及442前缀、profile/executions均保持。自然实际37答467事件，新3全文/换行/尾两空格、pending/help0,1,0、原题修订/独立条件、本地参考一次、停止和无新可靠复习/诗词均通过，新增model.request0；不以事件代替独立网络或账单验收。唯一strategy差异at/conversationId/reason，method与difficulty未变，整项仍partial；原14会话有效教法相同，仅全局新会话投影变化，不做回拨历史元数据的UI恢复。37答0600恢复副本独立读回一致，仅保全部分结果，不替代原34成功基线；原34/31/25、全部程序链、QA及4212/日常App/模型绑定保持。独立重核归档/签名9项/未注册/无消费者和4快照后，仅回收252779600字节自有App副本，不改变业务partial。失败post禁自动重跑/重开，下一步只修离线邮件直接读已有出处参考的入口，不重复三稿或旧路径；设备、日常和公开发布分别待验。

**2026-10-15学段与科目澄清【17项定向、三端候选及完整单网页路径通过】**：学段或未知/非数学目标继续必要澄清，不再默认给数学建议；同一会话最近一次真实用户明确数学、物理或英文邮件才接原建议，初始目标保持，科目更正可收起旧建议，不新增教学域。点击只改草稿、明确发送才开原有题目。7项服务与10项页面定向、相关静态通过；原镜像只同步2项运行源，H5 C0e3cf2M/CDN2588项/407模块、微信335文件1876452字节/媒体181028字节和App产物检查通过。新鲜网页实际走通初二澄清→数学→改学历史→数学→原不等式草稿/明确发送，首goal/同会话/空profile保持；建议仅草稿时整份state/storage不变。stop/390/普通root仅重开一次后，1题/1计划/0答/0复习/12消息/17事件完整保持，整份学习状态及localStorage SHA相同，仍停止，390无横溢、重开console/非静态网络0。精确PID57708/50381正常退出并回收，tab1关闭，原blank/实际1090×557视口还原；启动及收尾的两项本机命令断言在动作前失败、修正后完成，原始partial保留。不重复旧328/150/3或已验不等式三答，无模型/诗词API/合并；原QA34/冻结恢复链/4212与日常App保持。Mac本批未重编或实操，设备、日常安装与整体目标继续分别验收。

**2026-10-15一次不等式网页/Mac闭环【同源实操与原31逐项保持通过】**：旧Mac与当前网页3项运行源不同，273份相关全源码/入口配置逐字核同后，只做一次必要单worker locked/offline桌面/原生构建，复用原QA身份/UUID、Rust与目标缓存；归档完整读回、独立试恢复、严格签名、9项元数据和签名身份/选项/权限保持。原生新会话实际走通不等式草稿/明确送、严格端点`t≤3`错、渐进`t<3`正、变化条件独立`t<2`正，帮助0/1/0，仅独立正确后一次出处诗；反向Tab/Return交卷、stop/正常quit/同路径仅一次重开和原目录/资料1保持。53605/54346正常退出并注销无消费者，UI释放后原gate只读完整核原31答/条件/判分/材料/计划/复习/会话及412事件前缀保持，新3后实际34答442事件，无重判或凑数；新0600快照独立读回同，原31/25和全部程序恢复链保留。两份临时程序副本各252779600字节已按归档/元数据/签名/无消费者证明后回收，QA数据、4212与日常App保持；不重复328/150/3、已验网页或旧Mac。只关闭此有限本机路径，邮件Mac、其他设备、真实模型/长期效果、日常安装和公开发布仍待相应授权及验收。

**2026-10-15一次不等式聊天界面补验【网页已通过；后续Mac闭环见上方最新条目】**：旧新Mac3答/导入网页3答均为方程，现单独补验原`safe-named-linear-inequality-v1`，不扩大旧验收口径。328项、5项客户端源码与BmdFgpo\_/d6ca候选同哈希复用，无源码/判分重写或重复328/150/3/构建。新鲜网页实际完成数学目标、不等式建议仅草稿及明确发送：`-2*t+6>0`的`t≤3`可靠错答；渐进提示后`t<3`正确/帮助1；新`-2*(t+1)+6>0`独立`t<2`正确/帮助0，只有此后一次原古籍出处短句。停止/普通根入口重开，3完整原答/题目条件/等级帮助、2计划、2复习、消息及30事件等全部事实逐字一致，整份学习状态与localStorage SHA相同，仍停止；390无横溢，console/非静态网络0。自有tab1/58203精确预览PID49538与会话、子树/组/端口正常收口，原blank与视口还原；4212/日常App/QA31及25、旧冻结产物保持。仅网页不等式补验通过，Mac/其他设备、真实模型和长期效果仍待对应验证，学段词默认数学问题仍留后续未改源码。

**2026-10-15诗词API适配【内部候选26项与类型检查通过，在线正向/启用未验】**：按指定服务公开GraphQL查询准备受限内部后端模块，默认关闭，只用固定公开篇名及情境，不外发身份/私人正文；复用既有公网解析与IP固定/TLS，不加对外未鉴权入口或前端直连。800毫秒含DNS、32KB/5条、无重定向/自动重试，单公用缓存/请求合并/失败冷却；上游全文/作者/篇名与独立古籍核对相同才回原缓存引用编号。26项来源/隐私/SSRF/超时/缓存定向检查及后端类型通过，TS不在现有ESLint覆盖中。一次真实接续仅到DNS，HTTPS实际启动0、未取得来源正向匹配，未放宽网络或重试；仍只使用原有离线诗句，不把候选称为API已接通。临时bundle106963字节回收，既有邮件/分数密度网页Mac、4212/日常App与资料链保持。后续若接调用端仍须鉴权/绑定具体反馈、取消/离页迟到保护和实际正向，不重跑旧已验路径或增加模型/费用。

**2026-10-15英文邮件聊天接续【150项逻辑、3项页面、三端产物及完整单网页路径通过】**：写作目标只给邮件建议，明确选择后在原会话沿已有`english-email-v1`开题；草稿与明确提交、完整原文、参考帮助和独立稿继续原规则。否定/引用不换题，具体贴题不丢条件，主观反馈待核对，不推进可靠复习或插入正确赞语。新增用例期待按原标点规范化和邮件可访问控件修正后150项与3项页面/相关静态通过，后者另核换行/尾空格；H5 BmdFgpo\_/2588项CDN/407模块、微信主包335文件1876370字节与媒体181028字节、App脚本和产物审计通过。首次预览4个静态连接重置未创建学习记录，提前收口；仅改回既有并发预览方式，一次4资源并发GET逐字节通过，保留原根因未证明的范围。新鲜网页实际完成同一会话原稿、参考后修订及异情境独立稿，3原答均待核对、帮助0/1/0；停止与普通根入口重开，完整原文/换行/尾两空格、21事件、整份学习状态及localStorage SHA相同，390无横溢。自有页面、两预览及预查进程/组/端口正常关闭回收、视口还原；用户4212、日常App、旧QA31/25资料链及冻结分数/密度候选保持。本批未原生重编/日常安装，邮件Mac、其他设备、真实语义和长期效果仍分别待验；没有模型、短信或生产调用。

**2026-10-15分数/密度网页与Mac闭环【隔离实操与原资料保持通过，日常未安装】**：Mac同一新会话实际走通分数/密度各3答、提示订正、无提示独立变式、一次出处短诗、键盘明确提交、停止与正常退出重开。只读持久分页逐项确认原25答/题目/材料/计划/复习/判分与原事件前缀保持，新增6答后实际31答/412事件；原额外记录不删除、不重判旧答。新31答0600快照独立读回一致，两QA进程正常退出、临时入口注销，程序副本252779600字节已回收；原QA资料域、新旧已验归档、原25答快照、日常App和4212保持。本批已验网页/Mac不重复；继续原计划其他离线接续与内容/发布缺口，真实模型、设备、日常安装及长期效果仍分别待验。

**2026-10-15分数/密度Mac同源候选【构建、归档及试还原通过，实操待交接】**：原FIFO消费者结束后，仅把队列等待改为300秒接续保存命令；桌面BZF9eLS4/CDN2588项与407模块检查、原缓存单worker locked/offline原生编译通过。沿原QA身份/资料UUID生成归档，完整读回和独立试还原、严格签名及9项元数据保持通过，除可执行文件外8项内容不变。归档过程的Python3.9元数据接口差异已修正，未重复前端或原生编译；系统原生查询确认临时候选及试还原入口均未注册，试还原副本已回收252779600字节。原QA25答快照、先前成功程序归档及日常入口保持；本批未启动Mac窗口，尚未增加作答或安装日常App。已准备含启动/原答保护/新增6答/停止重开/退出注销及120秒收尾的900秒独占路径，等待协调者新时段，不把候选准备当作Mac实操完成。

**2026-10-15密度聊天接续【隔离网页完整路径通过，Mac同源接续中】**：先说物理目标，再明确选择密度，沿同一会话开始原`science-transfer-v5`练习；首条精确标题与后续聊天复用同一原题工厂，保留原选项、单位、明确提交和独立新条件。不以年级词推断数学目标，物理澄清只提供密度建议且点击仅改草稿；聊天提示沿已有密度公式记真实帮助，来源/条件不合法不提供可靠教学。停止、原答与历史评分不改，不将物理变式套用数学短诗。3文件111项逻辑及3项定向页面检查通过，合并分数/密度候选的H5/微信/App构建及产物审计通过，同一隔离网页已实际走通分数错答/提示订正/独立变式与一次出处短诗，再明确密度换题、选项草稿/错答/公式订正/独立新条件；停止后普通根入口重开保持6原答/54事件及整份持久存储逐字同，390宽度无横溢，键盘明确提交通过。自有tab1/50343预览正常关闭回收，4212与日常App保持；已回收本轮被新合并候选覆盖的未启动分数中间产物333802253字节。后续仅准备同源Mac隔离QA，不重复旧已验路径或安装日常入口。5项源码已同步原镜像，Rust身份适配与QA25答恢复链保持；一次60秒FIFO等待因既有Sonic消费者占用退出75，桌面/原生命令未启动，准确命令已保存在原回执，不即时重提或另建队列。

**2026-10-15分数聊天接续【源码与定向检查通过，实操待验】**：先说目标后，可在同一聊天明确选择分数加减/乘除/四则，或贴受支持的完整分数算式；复用原精确分数合同，不推断学段、基础或教材。原答、错答/提示后订正、无提示变式、停止重开与备份重放保持；可靠无提示变式正确后沿用原古籍短句，每会话仍最多一次，跨方程换题也不重复。分母为零等不支持题保留私人待核对，裸分数答案、否定和引用不切题。3文件136项及JS静态通过；隔离H5/微信/App构建和产物审计通过，实际分数聊天界面待验，尚未更新4212或日常Mac，不重复旧386/289项或已验网页/Mac路径。在线诗词仍未接入，无模型、短信或生产调用。

**2026-10-15 Mac隔离学习与数据核对【本机有限路径通过，日常未安装】**：离线同会话澄清/贴题、错答、提示后订正、独立变式和一次有出处诗词、键盘明确提交通过；仅一次确认合并本轮web合成36操作，普通退出重开后本机与导入会话均保持停止。原279操作前后重复预览均新增0/已有279；只读QA持久分页及隔离重放确认原18答、题目/材料/计划/评分事实保持，本机新增3、web导入3。启动时还可见1条记录时间为10月14日、未收入旧18答导出的方程作答；它在合并前恢复副本中即存在且保持，故当前真实总数为25（原基线18+启动额外1+本机3+导入3），不强行凑24、不丢弃额外记录，其更早创建来源只按现有回执证据表述。当前25答完整快照已以0600保存并独立重放验证。两QA进程正常退出，精确临时入口已注销并收回试还原程序；新旧归档、QA资料域、日常App和4212保持。真实模型/三端、日常交付与长期效果仍分别待验，未新增日常安装授权。

**2026-10-15同源Mac候选【归档还原通过，实际窗口待验】**：沿已验网页路径接续，桌面前端Byvko-2Y及CDN2588项已重建；复用原缓存、既有QA配置，单worker、locked/offline原生编译通过。新QA归档`native-field-qa.chat-first.zip`已完整读回并实际还原，9项模式/纳秒/xattrs、严格签名及除可执行文件外8项内容保持。标识仍为cn.wangshiliang.wenli.qa.journey、QA资料域51922026-1010-4272-9129-357388911307，日常93d5ef76-c442-4705-81c9-5c9ad92f1dfe适配不动；旧程序/资料恢复链保留。当前只准备隔离程序，未启动原生窗口或安装日常入口。下一步为单窗口、含启动/收尾共1200秒的Mac离线聊天/记录/恢复实操；4215服务不需要启动，不登录或确认新协议。先用原QA 9会话/18答/1资料/279事件文本只读重复预览保护，再走新聊天3答、仅合并本批web合成36操作及普通重开；不打开系统保存窗口。已过网页与18/289项不重跑，正常退出只处理精确QA进程/路径并保留新旧归档。

**2026-10-15默认聊天入口【隔离网页路径通过，同源Mac待接续】**：默认学习页已接同一个聊天框、两条只改草稿的示例、必要澄清和情境题目/进度；移除前置学段/教材表单，营销开始与启动沿同一学习入口。换题域9文件386项、页面等8文件289项分别通过，不累加为新验收。首次独占实操只取得入口观察，未走通完整学习路径；新来源已核对当前源码、镜像、HTML与h4LDfXmq脚本一致，未复现旧4216的Wenli画面，该旧现象原因仍未证实。实际“开始学习”无跳转对应一处已确认产物缺陷：动态uni导航没有被H5导入。现已改为显式导航，18项编译器/导航/引导离页定向检查通过，修正H5已构建（kJM8CjTv，CDN2588项/407模块），新鲜隔离网页已从首次引导一次正常点击进入同一聊天框，必要澄清、贴题/换题、明确错答、提示后订正、独立变式与一次有出处诗词、键盘/390窄屏、停止/普通根入口重开及重复备份预览通过。英文切换与明确取回旧题保留3原答及35事件完整前缀，仅追加1条question.focus；未删除或实际合并备份。自有页面/58222服务已正常关闭，用户4212、日常Mac、原资料与UUID保持。

**2026-10-15聊天换题【域接续复核通过】**：同一聊天明确换新题并返回前题订正，保留目标、前题原答/评分/未用提示与复习；普通答案、引用和否定不切题。不支持的新题保留完整私人待核对条件。首轮385通过/1失败与随后返回75的历史保留在12；确认保护及恢复提示修正后的9文件386项已实际通过。当前默认页面另有289项相关通过，不能替代实际入口与设备验收。

**2026-10-15贴题与小步提示【域接续通过，界面待接入】**：补齐当前聊天路径的实际输入缺口：先说“这道题我不会，带我一步步理解”，再贴完整单x方程/一次不等式，实际提示、明确作答、无提示变式、一次诗词、停止重开/恢复均在原Store隔离通过。原目标/贴题文本保留，推荐用语不再误进答案；无题时不记帮助，不推断低基础。裸答案、其他未声明符号、多变量、附加条件或不支持题型先澄清；中断提示可同编号接续。9文件379项相关检查和JS静态通过，不与旧285项累加。默认页面、当前H5/Mac及实际用户路径仍未更新；继续等待主要入口与独占UI交接，无新构建/服务/模型调用。[本批记录](12-CHANGELOG.md#2026-10-15贴题与小步提示接续)。

**2026-10-15聊天学习核心【域候选通过，默认页面未切换】**：沿当前小批次，仅在现有Store/Service增加显式聊天调用：自然目标先澄清一个必要知识点，方程/一次不等式直接生成已有独立版本题；首条目标不记原答，旧调用不自动改变行为。错答、明确帮助后订正、无提示变式、一次有出处诗词、停止重开与恢复已沿真实Store隔离检查；中断题目/计划写入后以同编号重试，不重复建题/任务或误判知识点文字。鼓励只在当前会话的可靠无提示独立变式正确后出现，每会话最多一次；错答/部分/待核对/帮助后成功不加此赞语，缺句或可选写入失败保留原答判分，英文反馈前缀与引用原文分别保持。已查证古籍版1条引句，在线诗词API及数据集未接入，不新增模型或网络调用。原页面仍有旧目标表单，当前H5/Mac也未包含这次聊天核心；完整入口/三端、实际界面/资料、自然次日、真实模型、在线API与公开发布继续待验。当前只补域候选，Sonic之外不同时开启大范围入口重构。[当前变更](12-CHANGELOG.md#2026-10-15聊天学习核心与离线诗词域候选)。

**2026-10-14聊天主入口与情境诗词【新增用户方向，接续准备中】**：按[现有产品简报](01-PRODUCT-VISION.md#聊天优先与诗词反馈2026-10-14)把聊天作为网页业务端、桌面及手机的主要学习入口：少量具体示例、逐轮必要澄清、足够开始后直接练习；设置次级化，材料/结果/进度按需展示，保留可访问性与直接操作。不是把旧页面藏进菜单或仅换聊天外观；沿原模板和现有组件调整层级，不重做审美。原会话/作答/错题/材料/UUID/身份/版本/评分历史保护不变。诗词由应用层按真实表现和过程选取可靠原文，保留作者/出处，适量且不重复；错答/部分正确先准确反馈，不以鼓励混淆判分。检索/缓存只用去标识主题，不传私人正文；慢/限流/不可用不阻塞核心回复，不新增模型/费用/常驻服务/全量诗库或未授权外部数据。

**本次接续及顺序【当前】**：最新直接人类指令已核实为持续接续已授权工作，主要批次仍为Yozi；撤回仅适用于错投Bot/Logo。全部五项目CLI经唯一heavy_gate、capacity1/FIFO、每项目最多一请求、worker1；无新改动不重跑已过386/289项，返回75保存断点。UI保持关闭，准备好候选与有限路径后在原PAUSED请求独占交接。本批完成条件是首次引导正常进入同一聊天框，必要澄清、贴题/换题、明确错答、帮助后订正、独立变式/一次有出处短诗、停止/普通重开及合成备份重复导入预览实际走通，并核对英文、窄屏和键盘。原材料、诊断、可靠判分、复习、身份及版本历史复用；Mac同源、其他设备、真实模型与发布分别保留后续完成条件。

**2026-10-14单未知量一次不等式【规则与隔离候选通过，实操待验】**：按完整矩阵补显式声明一个小写拉丁未知量的实数一次不等式，独立新版本保持旧未标记和不匹配版本待核对；多变量/变量分母/复杂附加条件不扩展。恢复后9文件328项相关检查、JS静态及后端编译打包通过；真实Store明确提交、负系数与开闭端点、帮助后订正、原符号数轴、平移变式、诊断、停止重开/恢复/事件重放及零网络通过。H5隔离候选index-Bnq9B0BN.js构建完成，CDN2588项复制，405客户端模块未含braces；14项依赖风险仍未解除。候选仅绑定回环4215、备用为空，未启动服务或安装到用户预览，不能用于部署；build-source仅同步两项共享模块，既有Rust身份适配保持。4212仍为CuRSLEE0，日常Mac仍为local-progress；实际网页/原生与其他端构建/设备继续待验。此前排队143未运行事实保留，不计为通过。新聊天入口与诗词反馈当前仅准备，不由本次数学检查推定完成。[本批记录](12-CHANGELOG.md#2026-10-14聊天主入口与情境诗词接续准备)。

**2026-10-14单未知量方程【网页交付，Mac待重建/验收】**：按矩阵补显式声明一个小写拉丁未知量的精确方程路径，题目还须显式选择新版本；未标记的旧导入同题干继续待核对，旧x合同不扩大。最终9文件310项相关检查及后端打包通过。网页先行错答路径及最终版本部分正确、帮助后完整订正、独立变式、停止重开通过，旧4答/48事件全部事实前缀保持，最终7答/73事件逐字同；原4212正常更新，用户原5答/43事件前后逐字同，最终入口沿08C。先行Mac归档读回/还原/签名通过，独立QA原18答/279事件前态原生导出相同，新题/1份错答实际通过；后续观察接口失败，订正/变式/最终重开未完成。加入历史版本边界后原生包已过期并撤下，只重建前端，不再增加本轮原生编译；观察恢复后沿最新源码/前端重新构建、完成剩余路径与同源交付。日常App未更新，继续local-progress版本，网页与日常Mac暂不同版。客户暂不便处理保存窗口，不继续索取操作、不重开日常入口。新增共享合同的微信/App构建与对应设备另验；后续先完成共享合同及历史兼容核对，再生成原生候选，避免重复编译。更广符号语义、多变量、无理根、真实模型、许可/依赖/设备与发布仍保留矩阵。[本批依据](12-CHANGELOG.md#2026-10-14单未知量方程网页交付与mac候选)。

**2026-10-14题源权利依据【本批查证完成，许可未取得】**：现有2010—2013政治研招网登记适用站点版权说明，其他使用需站点同意、镜像需明确书面授权；尚未取得本项目公开分发许可，不能以出处或参考解析替代。四条登记追加政策地址/原件摘要，未添加许可声明；9项登记检查、9条内存导出与实际门禁摘要保持核对通过，公开使用仍0/127、许可缺口127。原题、正式清单、网页/Mac与资料未改，无新构建或外部写入；本批无需用户额外体验。后续取得具体适用许可并核对评分证据，或查证独立可复用来源，不能用大纲补历年试卷缺口。[核查依据](12-CHANGELOG.md#2026-10-14研招网来源公开使用依据核查)。

**客户2026-10-14最新顺序【当前】**：暂不处理iPhone端，优先现有网页/官网与macOS。iPhone SDK、装配和真机保留为后续待办，不继续索取SDK或启动相关工作；完整目标不删项。账户切换后的统计缓存与迟到清理已完成本批网页/macOS同源交付；后续继续Now 3的可执行发布缺口，真实模型仍等待安全网络与新的限次授权。日常资料不用于试验。

**2026-10-14旧统计账户与访客隔离【同源交付完成，体验待反馈】**：旧题库进度在B无缓存/缺字段时继续展示A统计，并会在兼容写入时带入A历史；另外两个旧统计键仍会在登录时自动迁移访客原件。7个隔离反例复现后修复：恢复从当前账户空值起步、退出/登录同步切换展示、兼容写入先切换归属、释放监听；存储私有键规则同时禁止读取回退与自动迁移。5文件128项通过；网页index-CTVOsgjl实际更新并正常重开，原5答/43事件逐字同。同UUID Mac候选完整读回并实际还原、原子更新唯一入口，原27会话/32答/3资料/444事件在更新前/还原/安装后/普通重开四节点逐字同；受影响统计页实际打开，原Future展示恢复；本批不重做真实登录，A/B及访客迁移以真实Store/存储隔离回归为证。不新增可靠判分、模型、短信或生产调用，其他矩阵继续有效。[本批变更](12-CHANGELOG.md#2026-10-14旧统计账户及访客迁移隔离)。

**2026-10-14公共题源公开使用门禁【本批工程完成，来源许可未完成】**：复核发现旧门禁把自动配对数直接写成“可发布来源”。现保留119槽位自动配对、8配对缺口，另以具体原件/出处/公开分发范围/实际依据/核验记录的完整声明判公开使用覆盖；当前可计入为0，127个必需历年槽位均缺完整证据。登记导出核对实际SHA256，来源清单传递，发布与缺口报告共同拒绝证据缺失、错文件/出处、私人范围或已知品牌风险；不制造许可、修改原题或关闭发布阻断。56项JS与25项Python检查通过，真实门禁与缺口命令按预期退出2；113槽位/3901卡、网页与Mac交付物和日常资料未改，无新构建或模型/SMS/生产调用。配对、许可、评分和设备继续分列，后续需取得并核对实际来源许可及评分证据。[本批变更](12-CHANGELOG.md#2026-10-14公共题源公开使用证据门禁)。

**2026-10-14账户统计隔离小批次【工程交付完成，体验待反馈】**：先复现A的5分钟缓存被B复用、A的延迟退出清理覆盖B两项问题，再将统计缓存与迟到读写绑定当前账户/会话，退出同步失效；旧退出清理只作用于发起时的生命周期及Pinia，收藏完整重置。41项相关检查通过；网页与归档实际还原的Mac均以本机合成账号完成A→B，旧题库统计分别10条/15分钟、20条/30分钟，B普通重载/重开保持，未生成可靠作答。QA原9会话/18答/1资料/279事件切换前后逐字同；用户网页原5答/43事件在正常PWA重开后与原备份逐字同，日常Mac27会话/32答/3资料/444事件在更新前、归档还原、安装后和普通重开逐字同。网页4212与唯一Mac已更新，原UUID、元数据与保护合同保持；没有真实模型、短信或生产调用。迟到回执依靠专项用例，不冒充真实网络竞态验收。此项不解除14项high、来源、跨端设备、公开发布或长期效果门禁。[本批变更](12-CHANGELOG.md#2026-10-14账户统计会话隔离与同源交付)。

**2026-10-14移动装配条件【缺实际SDK，准备校正完成】**：新鲜iOS build-only预查仅因DCloud模块头/依赖未配置退出2；Xcode/iPhoneOS27.0本身可用，无二进制或App变更。当前DCloud锁定包与App产物声明compilerVersion5.31，09B原5.08装配描述已归为历史，官方当前下载页5.26不能直接当作已验兼容组合。SDK完整来源、版本/资源与模块编译/装配、真机路径仍待闭环；客户已明确暂不处理iPhone，不再等待或继续索取SDK，不空编译、不绕过既有浏览器安全拒绝或以模拟器替代真机。此项仅准备进展，不是新产品交付，其他原矩阵仍有效。[装配准备](09B-APP-CONNECTOR.md#移动-sdk-编译)。

**2026-10-14依赖边界小批次【H5工程完成，风险未解除】**：沿既有14项high审计定位braces经glob/watch构建工具传播；官方公告未列修复版本。现有Vite构建拒绝该包进入客户端模块图，40项工具链用例与实际H5405模块检查通过，产物与当前候选2955文件逐字节一致，未更新入口或资料。7类引入拒绝和正常产出已验；构建工具输入安全、其他端/后端及更广可达性未证明，14项风险仍阻塞发布。当前没有升级/降级或豁免，后续只有取得可靠上游或完整处理证据才解除。SDK仍未准备；真实模型继续等待安全网络与新的限次授权，用户体验/公开发布/长期效果均保留原矩阵。[本批依据](12-CHANGELOG.md#2026-10-14依赖运行时构建边界)。

**2026-10-14题源准入小批次【工程完成】**：按Now 3复用2021数学二本机PDF，实际发现品牌推广与同页参考解析，拒绝其继续被计为可发布官方来源。已知副本在重新登记、清单质量、清洗队列和题库门禁中保持阻断，改名/清空字段/published均不能恢复；缺口说明要求核验独立替代来源。16项Python与52项JS通过，实际门禁与缺口报告均按预期返回2；启用范围113槽位/3901卡不变，来源缺口据实由7修正为8，未新增题卡或可靠评分。当前没有新的已验可发布替代来源；其他已登记候选的内容、权利及评分依据仍需逐份核验，不因文件名或旧自动配对计数直接准入。用户重启GPT后已确认原预览退出，恢复相同4212产物；日常App和资料未改。本批不涉及新界面，无额外用户操作要求。[本批依据](12-CHANGELOG.md#2026-10-14数学二题源误准入修复)。

**2026-10-14持续目标与串行安排【当前】**：客户已明确恢复本项目并统一撤销先前暂停要求，按现有完整计划继续，无需再因降载等待恢复确认。每阶段仅一份重型作业，当前worker为1，已通过检查复用。本批题库路径已完成网页与唯一Mac同源交付，原答与普通重开验证成立；进入Now 3其余内容/来源、依赖等可执行缺口，真实模型仍须安全网络与新的限次授权。用户体验、SDK/设备、公开发布与长期效果继续保留原矩阵，不以本批完成代替完整目标。

**2026-10-14当前小批次：题库路径同源交付【工程交付完成，用户体验待验】**：复用上一批160项相关检查，不重复视觉校准或全量测试。原4212已正常更新并重开，原5答/43事件逐字保持；同源Mac两身份归档完整读回并实际还原启动，QA整卷载入、选项草稿、明确提交、退出保存、普通重开与明确继续通过，旧17答/275事件完整前缀保持，最终18答/279事件逐字一致。唯一日常Mac仅原子替换程序文件，原27会话/32答/3资料/444事件在更新前、归档还原、安装后和普通重开逐字同；原UUID、权限、深色阅读与停止状态保持。新增作答仅在独立QA，日常资料未合并测试记录。隐藏/卸载/迟到回执保护仍以已通过的隔离用例为证，不冒充本次真实网络取消。网页可从[原4212入口](http://127.0.0.1:4212/#/pages/practice-sub/question-bank)体验，Mac使用唯一日常入口，原4214不再需要。题源/可靠判分/模型/设备/发布门禁不因本批放宽，未新增真实模型、短信或生产调用。[本批依据](../tmp/stage1-mobile-20261011/verification.md#2026-10-14题库路径网页与唯一mac同源交付)。

**已完成的视觉基线【继续复用，历史验收范围】**：按客户2026-10-14最新要求，推进全App的原模板审美校准；最新反馈要求恢复原色天空与英文展示文案，业务语言和阅读偏好分别保留。客户随后确认本版网页方向可以，继续沿原模板校准。现网页与唯一Mac同源交付，QA17答/275事件、日常32答/444事件及网页5答/43事件在归档恢复或普通重开后逐字保持；四端候选与实际宽窄画面通过，完整设备/用户操作体验仍分别待验。复用07的原文、已批准品牌和公共组件，逐页检查字体、布局、材质和必要状态，模板未覆盖部分沿现有元素派生；不另创视觉方向。连接反馈子批已完成：通用操作错误不再改变模型连接状态，53项相关检查、网页/Mac共4次本机模拟通过，原记录保持，真实供应商调用0。真实模型的两次限额仍已用完。

**Now 3取消反馈补充【事实】**：修复离页后迟到取消错误抢回隐藏页焦点；停止提示保持在当前“已停止”，布局后再次核对页面归属。45项相关检查、网页/Mac各两次本机模拟取消及同源四端候选通过，没有供应商调用或新增作答。QA原17答/230事件完整前缀保持，最终17答/257事件普通重开逐字同；日常32答/444事件及用户网页5答/43事件更新、归档恢复与重开逐字保持。当前子批已交付；继续内容与依赖等可执行缺口，真实模型教学、设备、生产和用户体验仍在原完整矩阵内。[本批变更](12-CHANGELOG.md#2026-10-13取消与离页焦点修复同源交付)。

本节是当前执行排序，复用[一页产品简报](01-PRODUCT-VISION.md#一页产品简报2026-10-13)、下方10月12日评审基线及A—E工程批次；不另建计划或重复验收台账。首次规划只修改文档；随后按客户“建立目标开始推进”完成Now 1的本机技术收口。随后按“建立目标继续推进”完成Now 2同版Mac交付；日常入口已更新，没有上线，历史证据与各次验收分别记录。

**本次结果【事实】**：分数加减/乘除两组交卷与无提示变式共5份原答，4次可靠作答、1次待核对；草稿不提交、原答保持、停止与普通重开、明确恢复、授权重复同步及账号隔离通过。修复网页首次空白、会话切换和空服务端首次同步的时区问题；相关181项、当前源码后端10项与H5/微信/App构建和产物检查通过，没有全量复测或模型/SMS/生产调用。[当前入口及依据](08C-SCRIPTS-REFERENCE.md#当前候选与本机资源)。

**UI/UX收口【事实】**：重新比对两份原模板并归入07复用规则；修复嵌套卡片的零边距传播、结果入口无定位/焦点及返回原题失败，判分版本改为主动展开。当前路径宽窄浅深、中英文、键盘和减少动态分别核对；查看依据不改记录，长草稿不新增原答，返回原题只新增一条明确定位记录，普通重开保持5份原答。当前网页可体验，技术依据集中在[现有回执](../tmp/stage1-mobile-20261011/verification.md)。

**同版Mac交付【事实】**：唯一日常入口已更新；两种资料身份、既有权限与恢复材料保持。独立QA两模块交卷及结果/原题焦点、长草稿、浅深阅读、停止/明确恢复和普通重开通过，14答/168事件从归档实际恢复逐字相同；日常27目标、32原答、3资料、444事件在更新前/后与普通重开完整导出逐字相同，深色与暂停保持。

**Next 1工程预查【事实】**：客户尚未体验，先完成首次使用与普通重开预查。修复第一组入口不突出、模糊目标默认整数模块、重复字段标签及明确恢复后仍需找题组；草稿/取消不保存，交卷才写原答。新独立网页3答/38事件、Mac旧14答/188事件分别保持，日常32答/444事件和用户网页5答/43事件在同版更新/重开后逐字相同。当前必要修正已交付，Next 1用户认可仍未完成；自然次日另验。

**Next 1出错恢复【事实】**：复现已有路线填400天后错误落到屏幕下方的问题，现错误就近显示并聚焦，取消保留原路线，再明确修正才保存。坏备份拒绝、预览/取消不写事实、明确合并、重复预览新增0、未完成交卷与普通重开实际通过；独立网页最终3答/52事件、用户网页5答/43事件、QA14答/188事件及日常32答/444事件分别保持。35项界面检查和1项模拟同步失败专项通过，未全量复测；没有本轮真实云同步或模型请求。工程预查已交付，用户体验与自然次日仍待反馈。

**Next 1复习与复盘【事实】**：修复进入复测后题目仍在屏幕外、停止时不能查看待核对原答，以及已安排2题重开却显示建议6题的问题；复盘卡片复用20px内边距，失败原因可见。真实当前时钟下网页独立到期复测、复盘与明日2题只读安排、停止重开通过，最终4答/71事件；Mac新增1份独立可靠复测、1份保留原提示历史的可靠复测和1份待核对复测，旧14答/188事件完整前缀保持，最终17答/220事件普通重开逐字相同。日常32答/444事件及用户网页5答/43事件更新前后逐字相同。38项相关界面检查和四端候选/产物检查通过，同源码Mac已交付；没有更改系统时间、模拟自然次日、模型/SMS或生产调用。

**待体验/未验证**：网页与日常Mac现可体验同一业务批次，记录按账户/资料域各自保留。信息层级和操作是否顺手、反馈是否有用、自然次日是否愿意接续、模型语义与其他真机仍待验。Now 1、当前路径UI/UX及Now 2工程交付已完成，用户体验仍待反馈；本批全App代码与本机视觉校准已交付，后续沿原模板处理具体体验反馈，继续模型、内容、依赖与发布缺口，用户认可、试点与经营分别成立。

**当前判断：先把已有学习闭环收口成可体验的版本，再验证需求、准备试点，最后按证据扩展和经营。** 本版一次只推进一个主要交付；Now内按顺序完成小批次，Next/Later不同时开工。完整课程、设备与生产条件继续单列。下面的基础数学首路径、试点需求和商业模式均为建议或假设，不替用户认定方向已获验证。

| 安排                           | 用户结果                                           | 主要依赖                                                                                                             | 完成条件                                                                                                                                     | 下一步                                                                                                                                                                  |
| ------------------------------ | -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Now：聊天主入口与情境诗词      | 用聊天直接开始并接续一条完整学习路径，减少首屏选择 | 现有Store/精确判分/教法/材料/复习、原模板、诗词逐条来源及轻量适配；共享队列与主要重构交接                            | 说目标/逐轮澄清/直接练习/明确作答/准确反馈/帮助后订正/独立变式/可选情境短诗/停止重开与复习；原记录保持，诗词失败不阻塞，键盘/窄屏可用        | 当前网页及Mac三已存原答全文/42答519事件保护成立，原生计时partial保留；默认关闭诗词调用与三端候选通过，在线被本机解析保护拒绝；按现有Now/Next继续独立功能，4212/日常保持 |
| 基线：原模板审美校准           | 所有页面与控件具有连贯的字体、材质和操作层级       | 原两份提示词、客户批准品牌、07令牌与组件、已有候选                                                                   | 17入口来源映射；公共组件和页面异常修正；宽窄/主题/英文/键盘与相关构建通过；同源候选交付、原记录保持                                          | 源码、逐页宽窄及同源候选已交付；网页方向获认可，原记录保持；全部页面操作体验及其他真机仍分别待验                                                                        |
| Now 1：最新学习路径收口        | 今天做完一组练习，原答、反馈和次日任务连贯         | 现有整数/分数路线、共享学习事实、隔离网页与真实本机后端；不依赖新的公共题库或模型                                    | 最新分数题从草稿到交卷、无提示变式、停止/明确恢复、重开及授权同步实际走通；原答逐字保持、重复不新增、待核对不进入可靠复习                    | 本机路径已通过；下一批准备同版Mac候选，用户体验与自然次日另验                                                                                                           |
| Now 2：交付同一候选（已完成）  | 网页与Mac体验同一批已验行为，原资料保留            | 既有Mac宿主、独立QA与原资料身份、配对恢复材料；复用前阶段业务检查                                                    | 两身份实际还原/重开、停止/恢复与路径操作通过；唯一入口原子更新，原32答/444事件逐字保持。规则候选不冒充真实AI                                 | 用户体验待反馈；本次模型界面已获具体授权，安全网络与真实教学路径仍待完成                                                                                                |
| Now 3：真实模型界面与发布缺口  | 模型可教学，失败能读懂原因且原答可取回             | 本次明确授权、隔离合成账号、既有模型目录、安全网络与发布合同                                                         | 正向教学/工具采用/订正/独立检验及真实用量成立；失败、取回、停止和重开保全；发布门禁按实际条件通过                                            | 失败恢复、保险库门禁及同源网页/Mac已交付；取消/离页反馈已交付；继续内容与依赖等可执行缺口；真实教学仍待安全网络和新的限次授权                                           |
| Next 1：体验评审与小修正       | 第一次使用与第二天接续都能独立完成                 | 可运行候选、用户实际体验；保留现有品牌与Claude设计方向                                                               | 用户完成下方体验步骤，入口/交卷/反馈/停止/接续中的阻断问题消失；空白、失败、加载、键盘与窄屏可操作。技术通过和用户认可分别记录               | 首次、恢复和复盘工程预查已交付；用户体验与自然次日待反馈；按故障、体验或新需求继续小批次修正                                                                            |
| Next 2：美国有限试点准备与运行 | 已确定范围内的用户能安全开始、持续学习并取回记录   | Next 1认可；目标人群需求、实际地区登录、年龄准入/隐私、内容权利、模型预算与账单、依赖风险、受保护发布/恢复和生产授权 | 所开放范围的release:gate与真实外部业务/恢复检查通过；完成授权后才发布。由实际试点记录验证首次完成、次日/到期回访与反馈，无证据不宣称需求成立 | 先核验发布缺口：按10月12日记录，14项依赖传播风险仍阻塞；当前不重跑联网审计来制造新基线。邀请、发送消息、收费和生产操作按具体授权执行                                    |
| Later 1：复盘、增长与成本      | 对合适用户有可重复价值，免费核心可持续             | 试点真实反馈、有效学习记录、已结算用量与维护负担                                                                     | 根据下方少量指标决定修复或扩展；先验证一个获客入口。只有需求与成本成立，才提出平台模型服务的额度/定价与支付方案，支付另验                    | 复用现有记录与账本，形成一次简短复盘；没有用户/账单时保留未知，不虚构收入、转化率或预算                                                                                 |
| Later 2：中国与平台/学科扩展   | 在需求明确的地区、学科和设备继续完成同一学习路径   | 用户方向选择、当地登录/未成年人及数据规则、来源与可靠评测、SDK/设备/发行条件                                         | 网页→macOS/Windows→微信→手机按实际范围逐端通过；小学/初高中/考研/考公/雅思/托福每次只收口一条有可靠依据的路径                                | 下一地区以中国为主；先按需求、到可用距离和维护成本选一条路径，不为覆盖名称重写平台                                                                                      |
| Later 3：持续维护或退出        | 更新可回退，记录可导出；暂停服务时有清楚迁移安排   | 实际故障/成本/价值证据、导出恢复能力及用户决定                                                                       | 上线后有最短故障处理与回退办法；决定暂停时先验证导出/迁移和依赖影响，保留必要恢复材料；结束维护或删除由用户决定                              | 按真实故障维护；每次复盘明确继续、缩小范围、暂停或结束，不自动删除用户数据或项目                                                                                        |

执行以完成条件推进，不承诺外部账号、SDK、设备、合规或发布的完成日期。Now 1与Now 2已完成本机交付；当前Next 1工程预查与必要小修正已完成，仍由用户体验决定该路径是否顺手，当前已按客户新指示调整为全App视觉校准优先，历史已通过路径复用。外部条件未就绪不承诺日期，失败、新风险或范围变化才调整，用户无需选择测试或架构。

### 需要你体验的内容

分数网页可从[本机候选](http://127.0.0.1:4212/#/pages/learning/index)体验当前5答合成记录；Mac使用[唯一日常入口](</Users/blackdj/Applications/Yozi AI.app>)，保留原32份原答与原资料，不合并网页或QA合成记录。两者业务与设计规则同版，首页分别沿Playful/Future既定布局。已有目标停止时先明确“继续当前任务”，也可新建目标，在“安排第一组练习”点“设置学习路线”，明确勾选分数加减/乘除并保存后训练。先试交卷→查看结果/依据→回到原题，再普通关闭重开。静态网页后端已收尾，当前不提供实时云同步或模型服务；Mac也没有在本批新增模型/短信调用。相应其他真机与用户认可仍需独立验收。

1. 不导入材料，保存一个真实学习目标；观察是否能直接找到今天要做的任务。
2. 完成一组练习并明确交卷；看是否能分清原答、提示后结果、可靠判分和待核对，理解下一步。
3. 使用一次帮助，再尝试无提示变式；判断反馈是否帮助自己继续，而不是增加选择负担。
4. 停止并正常重开，第二天从原目标接续；反馈是否需要重新解释背景、能否找到复习入口。

体验反馈只需描述“在哪一步、原本想做什么、实际发生什么”；可附最影响使用的一点。是否值得再次使用、优先数学还是语言、中文/英文是否适合目标用户属于方向与需求验证；规则正确性、记录一致性、权限和模型边界由Codex验证，不要求用户人工核对模型答案。

### 按风险验证与交付

| 变化/风险                        | 必要验证                                                                                                       | 交付出口                                                                    |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| 规划与回执同步                   | 受影响文档格式、本地链接/新锚点、引用命令与git diff --check                                                    | 文档就地更新，已通过业务检查不因文档变动重复运行                            |
| 学习/判分/调度逻辑               | 受影响的既有单测，复杂逻辑或真实回归才补针对性用例；实际草稿/交卷/待核对/停止/重开路径                         | 确定性规则与原答记录一致；主观语义/长期效果另列                             |
| 页面或跨端适配                   | 页面加H5构建与实际操作；改跨端合同才加相应微信/App构建、包体审计与设备                                         | 端上实际可操作；构建不替代设备、用户认可                                    |
| 权限、同步、恢复、模型调用与费用 | 隔离数据下的鉴权/账户隔离、原子拒绝、重复/迟到/取消、原答保持；必要的配对备份与恢复；真实请求沿授权及预算      | 不丢失、不串用户、不重复写/扣费；供应商返回不等于业务采用，未知成本继续未知 |
| 公开发布或收费                   | 已有release:gate及真实账号/学习/恢复外部检查，受保护发布与独立回退；涉及法律、平台规则、价格时再查当前官方来源 | 对该次实际开放范围通过并获授权后交付，不以开发版本放宽门禁                  |

相关检查通过且无新改动、失败或风险时继续交付。复用现有前端、Tauri宿主、API/后端、FSRS、模型入口和资料解析器，开源扩展先核对许可/兼容、通过现有适配接入；本轮不增加框架、依赖、MCP、多代理或全仓哈希台账。当前先收口已选学习路径的UI/UX，后续每个功能批次一起完成对应体验状态；每批交付访问入口、简短步骤、实际通过范围与限制，并收尾自有资源。

### 试点后的最少观察与维护

软件正确性与需求验证分开：前者看提交、判分、隔离、停止和恢复是否按合同工作；后者看目标用户是否愿意完成并再次使用。优先从现有记录得到首次完成目标/题组的情况、次日或到期独立复习完成情况、每活跃学习者的实际模型/解析成本及阻断问题。指标保留分母、时间范围、提示与待核对状态，不能用任务完成率替代掌握；没有真实样本与账单时不设虚假的基线或增长目标。

试点时提供一个明确的问题反馈入口和短故障恢复说明；记录问题时仅取必要脱敏信息。依赖安全、服务失效、资料恢复与成本异常按实际影响处理，减少新增功能；长期效果等自然复测证据逐步判断。停止或退出先保障导出与迁移，暂停/删除决定交给用户。

## 产品全景与当前评审基线（2026-10-12）

**判断：核心学习闭环已成形，当前处于本机集成与试点准备阶段。** 已有功能、已在本机实际走通、客户认可体验、其他设备通过和可以公开发布是五种不同状态；不以代码量、测试数量或训练模块数量计算整体完成百分比。

用户的一次学习是：选择目标 → 设置路线 → 对话带练或导入自己的材料 → 明确交卷 → 查看原答与反馈依据 → 独立巩固 → 按时复习 → 查看记录。材料导入可跳过，用户可以随时停止；普通重开不能偷偷恢复任务。

| 用户要做的事             | 功能进度与实际范围                                                                                             | UI/UX进度                                                  | 下一验收点                                            |
| ------------------------ | -------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | ----------------------------------------------------- |
| 进入产品、登录与设定目标 | 中文默认、英文切换、地区登录过滤、美国13岁以上注册限制、明确保存目标已实现；登录配置与各供应商真实接入分别成立 | 两种落地页、公共组件、地区控件已实现并有本机截图/键盘检查  | 第一次使用是否知道下一步；实际账号登录与跨端授权      |
| 安排今天并连续学习       | 23个有界路线模块、单题/整批/限时模式、原目标跨日接续、停止/明确恢复已实现；现有两日路线和Mac提醒有本机实操     | 主学习页、侧栏、窄屏抽屉、深浅色、路线与复盘已迁移公共控件 | 最新分数路线的完整网页/真实后端路径；完整用户旅程审阅 |
| 导入自己的资料           | 文本/PDF、页码与片段定位、本机印刷图解析、角色/疑义校对、取消/重试/删除已实现                                  | 私人资料、原文阅读、恢复预览沿现有界面                     | 手写/复杂公式/含图材料质量、手机OCR和真机文件权限     |
| 练习并获得反馈           | 整数四则、有限精确代数、科学任务、词句和写作路径已实现；新增分数四则的自动规则与构建通过，实操待验             | 草稿/明确交卷、可靠与待核对状态、原答阅读已实现            | 更广独立题型与主观反馈质量；公共题目来源/答案门禁     |
| 巩固、复习和提醒         | 原答绑定的变式、可靠作答准入、FSRS、日历与暂停保护已实现；Mac到期提醒/点击返回已有实际验收                     | 计划、日历、错题和反馈控件已统一                           | 跨周/跨时区与多设备实际复习；其他平台后台提醒         |
| 查看记录、备份与同步     | 原答/帮助/判分分开、统计显示分母、明确授权同步、冲突双方保留、备份恢复已实现；本机合成容量有界通过             | 统计、导出、恢复预览及确认已接现有界面                     | 大规模不同内容、多设备冲突、长期更新稳定性            |
| 选择模型与管理费用       | 指定模型、密钥保护、授权、预算、取消、幂等与订阅沙箱已实现；已有有限真实供应商API证据                          | 模型/设置入口和双语控件已实现                              | 真实产品界面模型路径、更广质量与成本结算；收费仍关闭  |

事实：网页、微信、App和桌面前端可构建；网页与macOS已有部分真实本机路径。日常Mac入口保留上一已验版本，最新四则/分数和上游更新未安装到该入口。Windows安装、微信与手机完整设备验收、正式签名公证、完整公开发布仍待完成。七个目标方向（小学/初中/高中/考研/考公/雅思/托福）是覆盖规划，不是七套完整课程。美国试点仍按在美华人学生/家庭、中文为主、13岁以上的已确定范围推进。

判断：下一轮用户评审优先看主学习页的入口数量、下一步是否显眼、原答反馈是否好懂、第二天是否容易接续；组件统一和机械检查通过不能替代这次体验评审。当前风格仍为紫蓝吉祥物、玻璃组件和立体按钮，保留Playful网页/Future桌面原构图。

| 顺序                 | 要交付的结果                                           | 完成条件                                                                                                                     |
| -------------------- | ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| 1 功能与上游收口     | 最新训练、模型与数据保护成为同一个可验收的网页/Mac候选 | 完成分数实操与真实后端，接续明确授权的模型界面路径；保全原记录；对剩余14项依赖风险形成可验的处理结果；验收后再更新日常入口   |
| 2 用户体验评审与修正 | 从第一次进入到第二天复习，用户能独立完成               | 客户按实际旅程指出问题，分别修入口、操作、反馈与视觉；错误/空白/加载/停止/恢复和键盘/窄屏同步验收                            |
| 3 试点与跨端扩展     | 美国范围内的真实试点和后续平台交付                     | 账号/隐私/费用规则与外部验收就绪；网页→macOS/Windows→微信→手机逐端验收；来源、安全及release:gate按实际范围通过，生产另需授权 |

分支核对发现，四条开发分支在本轮开始前已经是main祖先；历史移动分支的75文件已逐项审阅，9项移植、19项覆盖、47项由现行实现取代。保留现行行为，不重新覆盖旧页面。客户本轮授权提交所有项目改动并整理主线；仅做本地提交与分支整理，远端同步及发布单独记录。本轮核验和资源归属复用[现有回执](../tmp/stage1-mobile-20261011/verification.md)，不另建一套状态文档。

## 2026-10-10：对话学习路线与整批训练执行计划

客户已接受基于[ChatGPT 分享对话](https://chatgpt.com/share/6aca1dfe-3a78-83ea-9e9b-ab24ebafd15d)的十一项优化，并要求先写计划，再持续实施到学习闭环。本文是本轮唯一计划，不另建根级说明或重复待办报告。计划先于业务代码落地，下面只按实际验证更新本机范围；完整设计、其他设备、真实模型语义和长期效果分别保留。

### 目标与闭环标准

用户能够明确保存学习目标与节奏，查看今日模块路线，集中完成题组并一次交卷，取得与原答绑定的统一反馈，完成模块/日终复盘，确认下一批训练与到期复习，在支持的终端设置、修改、取消提醒，并从提醒回到原任务明确作答。普通重开、备份恢复和已授权同步后，目标、题序、原答、停止、完成依据与提醒状态保持一致。

“当前第几天”“已完成几天”“已经提交”“可靠判分”“独立复测通过”分别表达。题目和统计仍来自已有共享事实；小样本、提示后正确、主观辅助反馈和活动次数不升级为长期掌握或正式考试分数。

### 范围、收益与成本

沿现有页面/组件 → Store → Service → 共享后端合同实施，复用已支持的原创数学、写作、词句、科学及私人材料单元，保留 Playful/Future 构图、紫蓝品牌、Wot/现有字体与可访问性。收益是减少搬运成绩、逐题确认和查找下一任务的负担；成本是增加有界学习路线/题组合同、对应视图与恢复/同步回归。先复用现有依赖和系统能力；确需新的外部工具、运行依赖或通知服务时，另说明收益与维护成本并取得同意。

本轮本地功能实现不授权收费、生产部署或真实用户数据迁移。公共题源门禁保留，分享页题目/分数不导入用户记录或公共库。已有 `tests/unit/learning-history.spec.js` 未提交修改保全。功能与视觉分别验收，设备/站外送达、真实模型语义和长期效果不由源码或构建推定。

客户已进一步选择采用系统原生定时通知。官方Tauri桌面通知实现会忽略调度参数，因此macOS沿系统UserNotifications建立受限桥，由系统保存定时请求；网页保留明确授权的应用内通知。原生桥只接收有界提醒与固定学习返回信息，不提供任意命令、URL或正文执行能力；关闭应用后的实际送达及其他平台分别验收。

客户随后提供[最新Day 2结课对话](https://chatgpt.com/share/6aca4b80-6900-83ea-a27d-7618b6da1e4c)，追加吸收日间/分项差异卡、集中薄弱点巩固卡和接续档案：先呈现两轮原答样本、提示经历、题量/模式/建议时长和待核对，再解释训练记录差异；不从不同自编题推出能力升降。可靠错答、部分正确、提示后成功与主观待核对分开组织，巩固按钮绑定原题/证据，并实际创建独立检验任务。后续题量可修改，接续摘要只投影当前目标的真实记录和明确偏好，不复制分享页成绩或把AI主观评价提升为掌握事实。新内容并入阶段3，阶段4—5继续独立完成。

随后要求同一目标按日期/模块定位完整会话，模型只接收当日受限正文及同目标接续依据；每日进度嵌入对话，精简重复标题/角色标签并优化首页Yozi AI字形。已沿现有实现完成并有限验收，完整保存、明确作答和停止保持，未增加依赖或新计划。唯一日常入口程序更新、配对恢复、正常重开与相关回归通过；后经客户明确授权修复同身份本机签名，日常identity实际许可、退出送达、冷启动一次返回和停止撤销均已验，其他设备继续分列。

### 分阶段工作与十一项对应

| 阶段         | 交付与原清单对应                                                  | 当前验证与剩余范围                                                                                          | 当前状态     |
| ------------ | ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------ |
| 1 目标与呈现 | 01目标/今日路线、03结构化卡片、04范围一致统计                     | 保存/重开/恢复、分母与范围通过；网页宽窄/浅深/键盘/减少动态通过，完整设计与其他设备待验                     | 本机已验     |
| 2 模块与整批 | 02节奏/一次交卷、05模块、06错答卡                                 | 有界21模块；减法、精确除法及六物理模块沿同一原答/整批/变式合同，不扩大为全课程质量                          | 本机已验     |
| 3 复盘与后续 | 07复盘、08证据调整、10既有可视化、11路线/日历；Day2差异/巩固/接续 | 两完成日、双方分母、待核对、实际独立变式、可改后续和事实摘要通过；自然长期跨天/教学效果待验                 | 本机已验     |
| 4 提醒       | 09修改/暂停/去重/真实状态/原任务                                  | 独立与日常macOS身份均实际退出送达/冷启动一次返回；日常原事实保持、停止撤销通过；其他平台待验                | 日常Mac已验  |
| 5 闭环与收口 | 十一项接续、恢复/同步、构建/审计、资源收尾                        | 两日9原答/真实登录/明确授权同步保持；日期定位、8文件241项与6文件176项、日常更新/签名/正常重开通过；设备继续 | 本机阶段通过 |

### 验证与完成规则

1. 用已有 Vitest/固定规则构造隔离任务验证目标日期、统计范围、题组全量校验、原答/帮助、稳定编号、计划版本、取消/迟到结果和旧事件兼容；不访问真实用户数据或未经授权的模型。
2. 运行受影响前后端检查、H5/微信/App 构建与产物审计；检查脚本副作用后执行，复用既有输出位置，不启动重复全套环境。
3. 浏览器实际走完一条可独立判分的完整学习路线，追加主观待核对、未答/失败重试、停止、重开和备份恢复；统计、卡片及原答与事实逐项对照。真实后端与原生候选沿既有受保护隔离入口验收。
4. 提醒至少分别记录设置成功、到期触发、平台接纳、真实送达与点击返回；不把页内提示或API返回冒充关闭应用后的系统通知。平台申请/权限/设备实际不可用只阻塞对应验收，其余工作继续。
5. 同步受影响的01/03/04/05/06/07合同、12变更、本计划与既有PlantUML进度图；每个独立阶段用业务语言汇报结果、依据和剩余项。完成矩阵保留未验证项，完整目标未满足时继续进行，不以测试数量或构建全绿替代闭环。

## 最新阶段的费曼汇报：同版Mac交付与原资料保持

网页和Mac现在可以体验同一批学习行为。原生两组分数练习交卷、结果定位、判分依据和返回原题已实际操作；长草稿仍需明确提交，停止与明确恢复、普通重开分别成立。既定首页、紫蓝吉祥物、玻璃导航和实色阅读卡继续复用，原答与待核对仍清楚区分。

唯一日常入口已经更新，原27目标、32原答、3资料和444事件在更新前、归档实际还原、更新后及普通重开完整导出逐字相同，原深色偏好与暂停保持。独立QA原11份作答保留，新增3份合成原答，最终14答/168事件重开相同；不并入日常或网页记录。复用前阶段业务检查，只补必要桌面构建、两身份实际界面、程序/资料恢复与相关文档核对，没有重复全量测试。

【假设/待体验】卡片留白与定位预计更清楚，是否顺手仍由你的实际体验决定。当前进入Next 1体验反馈；模型界面、自然次日、其他设备、内容来源与生产仍待验。本批没有外部模型、短信、生产部署或提交/推送。技术与恢复依据集中在[候选说明](08C-SCRIPTS-REFERENCE.md#当前候选与本机资源)、[已有回执](../tmp/stage1-mobile-20261011/verification.md)和[固定进度图](diagrams/13-progress.png)。

### 前序上游安全补丁与学习记录保持

上游解析器遇到异常长选择器或巨大源码映射偏移时，原版本可能耗尽计算资源；服务端渲染的属性名还可被回车拆分。已采用官方修复，并将现有跨端工具链整组接续到同一发行，普通样式、中文内容、学习原答与停止规则保持。没有修改上游正文或添加另一套框架。

相关107项和全量4631项通过，含6项真实隔离数据库、零跳过；四端构建及微信/App产物检查通过。网页按原升级规则关闭再打开后，实际新版本仍读取原五份作答，公共导出与升级前逐字一致，运行错误0。日常安装程序没有更新，设备和完整视觉继续分别验收。

依赖审计由19项降至14项，剩余记录均关联同一个braces问题：本机能在原字符上限内复现递归栈溢出，上游维护者对风险判断有争议且尚无已发布修复版。已检查的调用来自构建工具链，未发现产品代码直接调用，但未证明全部可达范围，因此发布审计门禁继续阻塞。采用的跨端版本仍内含其定制旧Vue运行时，与官方Vue包的本地兼容已验，不宣称上游正式认证；旧Vite peer差异亦保留。后续继续独立功能和可执行接入，UI/UX在功能完成后进行，完整目标仍进行中。依据见[本阶段变更](12-CHANGELOG.md#2026-10-12上游安全补丁与跨端工具链接续)与[既有回执](../tmp/stage1-mobile-20261011/verification.md)。

### 前序减法除法与复习上游接续

原学习路线只有整数加法和乘法，现增加减法和除法。分数与有限小数按精确值核对，接近正确答案的舍入值不能自动通过；零除数、复合表达式与超界值不取得判分权。沿原界面完成两组四份原答，再从错答生成不同运算数的无提示变式；停止和普通重开保持五份原答，不据此认定整科掌握。

复习库沿官方MIT发行更新至5.4.2，客户端与后端统一版本，保留已保存的安排日期。旧参数迁移后的范围由上游重新约束；项目适配拒绝非法个性化参数并保全已有设置，修正下划线留存率改变被旧指纹忽略的问题。相关69项与全量4601项通过（含6项真实隔离Mongo，零跳过）；五份实际网页原答的六项HTTP重放/隔离/拒绝和最终候选普通重开逐字导出通过，四端前端与后端产物通过。首次全量的一项原计算进程2秒超时保留，未放宽限额，单独43项及最终全量复测通过，原因未证明。当前依赖安全审计仍19项，日常安装程序、其他设备与公共来源分别待验；本机实现不授权公开发布。

### 前序精确数值格式与原响应接续

模型给出的常规带分数和排版分数可以准确表示同一个占比，原验收却将其当作格式失败。现用明确、有界的模型核对入口读取该数值，并继续与材料重建结果比较；学生作答规则和旧记录没有变化。缺行、多值、跨行或舍入仍拒绝，不由模型文字推断掌握。

一份旧回复与本次唯一新Groq回复分别通过同一原答/提示/独立字段流程接续及12项真实HTTP保持，原错答与首答错误率1/1不变。新请求原CLI的排版字符拒绝保留，改后消费同一回复，没有再次生成；4550项全量通过、6项原跳过，供应商费用待结算。此阶段只关闭有限数值格式与结果接续，真实产品界面、对应设备和广泛教学效果仍按矩阵保留。依据见[本阶段变更](12-CHANGELOG.md#2026-10-12模型精确数值格式与原响应接续)与[既有回执](../tmp/stage1-mobile-20261011/verification.md)。

### 前序写作输出约束与真实API闭环

新明确反馈只评阅当前已保存原答，格式绑定编号和证据数组；原宿主继续核对分值、原答范围和停止，不把模型分数升级可靠掌握。旧请求、原哈希/缓存和本机协议保持；新模型参数先进入实际预算与调用记录。

4520项全量通过，6项原Mongo跳过；真实Groq20b一次最终请求完成9项API/工具/同步/停止验收，只有1份待核对原答与AI辅助记录，零可靠复习。四端构建与产物通过；此前四份实施400、原五项诊断和更早七项模型记录均保留，供应商费用未知。当前日常App仍为原串已验版本；模型网页候选已重建，实际协议确认未收到，尚不称产品界面或设备验收完成。依据见[本阶段变更](12-CHANGELOG.md#2026-10-12写作输出约束与真实api闭环)与[现有回执](../tmp/stage1-mobile-20261011/verification.md)。

### 前序写作原答保全与日常入口更新

明确提交时，通知和引导写作现在保留首尾空白；旧作答仍按原规则恢复，引用位置和重试结果不被新规则改写。草稿没有作答事实，模型不能代替用户提交，未经确认的整批操作不能保存；原答仍待核对。

4508项全量检查通过，6项原Mongo跳过；真实隔离后端七项验收与实际网页提交、备份恢复、重复零新增和普通重开分别通过。独立桌面身份新增一份合成通知，原10份作答保持；唯一日常入口同身份更新，27目标/32原答/3资料/444事件的完整前后及普通重开导出逐字一致，停止与暂停提醒保持。程序配对归档、完整试还原和严格本机签名通过，四端构建通过；功能不替代完整视觉或其他设备。

另一次Groq写作请求因供应商JSON拒绝失败，原因未证实，未采用评分，费用仍待结算；真实模型界面当次协议确认仍待客户回答。SDK未准备、Windows及手机、真实语义与费用、公开来源、生产和长期效果继续按完整矩阵推进，目标仍进行中。依据见[本阶段变更](12-CHANGELOG.md#2026-10-12写作原答原串与旧记录兼容)、[实际恢复画面](../tmp/stage1-mobile-20261011/notice-original-ui-restored.png)与[现有回执](../tmp/stage1-mobile-20261011/verification.md)。

### 模型写作诊断与拒绝记录接续

同一通知做五项隔离探针：原1000/default与1000/low均JSON拒绝，2000/low及两次引用表述澄清取得JSON后仍因错误位置、证据类型、量表编号被拒绝。没有评分采用，试验参数和提示未进入源码或日常程序，默认JSON失败的唯一根因未证实。三份真实拒绝记录的八类数组、失败收据、重复、停止/迟到、账号隔离与鉴权经14项零模型实际HTTP保持，原答仍pending，无可靠复习。

前轮提出的严格输出和原答/量表绑定已实现，并取得上述一次真实API闭环；三份旧归档工具参数均遗漏rubricId，原“错误编号”解释在最新阶段更正，历史响应不改。原引用、预算、权限和停止规则继续保留，真实产品界面仍待协议确认，语义/费用/其他型号继续分列。五次前轮诊断的供应商费用均待结算，平台0不代表供应商0。手写来源准入见下方候选表，未导入数据；SDK、其他设备和完整矩阵继续保留。

### 前序大备份恢复与网页容量边界继续有效

记录接近上限时，用户需要能安全取消、保存、重开和撤销。此次用自写的可压缩大备份走完实际网页入口：校验中取消仍保留原空记录，明确合并后普通重开完整导出逐字一致；最后一项手动完成可保存，下一项因原上限被拒绝，已有历史没有自动删除。明确撤销后回到写入前记录，再导入同一备份显示零新增且禁用合并；最后普通重开仍一致。

原七份作答与提示保持，首答错误仍2/6，全计划原6/10；手动完成时7/10，撤销后6/10，当前题范围6/6分别呈现。原20秒隔离存储测试及原120秒完整恢复/重复通过，业务代码、容量与期限没有改。这份资料高度可压缩，隔离5MiB配额与实际浏览器分别成立；其他内容、对应设备和长期规模仍待验，历史耗时原因没有被本次通过证明。

真实模型界面已准备好本机合成断点，当次协议确认尚待客户回答；看门狗正常关闭暂时无消费者的服务，候选和完整断点保留。本轮模型调用零，原日常程序和资料保持。依据见[本阶段变更](12-CHANGELOG.md#2026-10-12合成大备份的网页恢复与容量边界)、[实际零新增画面](../tmp/stage1-mobile-20261011/capacity-ui-repeat.png)与[现有回执](../tmp/stage1-mobile-20261011/verification.md)。SDK、其他设备、模型广泛语义/费用、来源、生产及长期效果继续分别推进，完整目标保持进行中。

### 前序语法取消与地区控件恢复继续有效

用真实语法引擎和本机隔离后端走完了网页检查流程：先明确作答并授权同步，取消时不留下帮助，成功时只保存一条建议，重复检查与普通重开保持相同记录。原答没有被改写，仍待核对，也没有新增可靠复习。实际HTTP另验鉴权、隔离、拒绝伪造、原期限、断开、停止与明确恢复；网络延迟与Java计算超时分别说明，历史冷启动波动仍待定位。

网页实操发现地区按钮空闲时被错误禁用，键盘却能切换。现由公共组件正确接收禁用状态：空闲恢复点击，登录等待时全部选项锁定，失败后恢复。相关72项及全量4499项回归通过，保留6原跳过，独立只读复审接受；实际登录重试及原10条学习事件逐字保全，四端候选通过。

原生QA与唯一日常程序实际地区/统计点击及普通重开分别通过，原10答/120事件与日常27目标/32原答/3资料各自逐字保持。首次日常候选遗漏既有资料UUID构建适配，进入引导页；没有迁移或写入新空域，回滚后完整资料保持，再从正确镜像重建并验收后提升归档。当前与上一成功程序均可恢复，临时程序与重复输出已回收；完整原生视觉仍单列。

依据见[本阶段变更](12-CHANGELOG.md#2026-10-12语法真实http闭环与地区控件禁用修复)、[公共控件合同](07-STYLING-SYSTEM.md#公共组件)与[现有回执](../tmp/stage1-mobile-20261011/verification.md)。DCloud SDK尚未准备；对应设备、Windows、真实模型、公开题源、完整设计、生产与长期效果继续分别验收，完整目标保持进行中。

### 前序私有目录模型接续继续有效

本次模型接续已按客户选择使用本机Free-llm-API目录，实际调用远程供应商，只发送合成材料。一个Groq小数增长率样例取得精确200%核对及两条工具收据；原错答、提示后修正与不同字段无提示变式分别保存。两份记录的八组事实数组真实后端重放逐字段一致、重复零新增、账户隔离通过，相关179项回归通过。原题计划仍0/1，脚本正确答案不证明学生自主学习，有限样例不证明广泛语义。

两GLM写作请求返回429/1305，占比先后缺核对行、带分数超出当前解析范围及上游JSON拒绝，均保留待验。原始密钥仅在内存取用，隔离加密保险库试验后删除，日常资料保持；七次供应商成本均待结算。真实产品界面模型链路与完整矩阵继续推进，依据见[数值模型核验](12-CHANGELOG.md#2026-10-12私有免费目录的真实数值模型核验)及[现有回执](../tmp/stage1-mobile-20261011/verification.md)。

### 前序侧栏更新继续有效

学习目标较长时，目录会把自身撑宽，选中背景伸进学习内容区。现在让目录列按侧栏宽度收缩，显示不下的名称沿用省略号；完整目标仍保留，导航、作答和停止规则不变。网页深浅色、窄屏抽屉、原生核验与日常程序实操通过，独立复审接受这个具体修复，完整视觉继续待验。

日常程序按原身份、资料域、版本及精确元数据更新；更新前后和普通重开的完整导出逐字一致，27目标、32作答、3资料及全部历史保持。当前与上一成功程序分别归档，已试还原；临时程序、网页与重复副本按既有规则回收。原生合成10答记录与日常资料分别保留。相关回归、四端候选、恢复映射和实际画面见[本阶段变更](12-CHANGELOG.md#2026-10-12侧栏长标题收缩与日常原生更新)与[现有回执](../tmp/stage1-mobile-20261011/verification.md)。

前序容量构造对照没有复现原20秒超时，且替代计数更慢，未改容量代码或限额；本次实际网页证据见上，历史耗时/保存原因保持未证明。模型、Windows及对应设备、公开题源、受保护生产与长期效果各自留门禁，完整目标继续进行中。

### 前序实际复测范围继续有效

复习应分别记录“到期后独立完成”和“马上再答一次”。这次沿已有隔离桌面程序的实际到期入口，完成两次无提示复测；各新增下一次安排，立即重做保留原答但没有延长安排。停止后两种作答入口都拒绝写入，普通重开后的完整导出逐字保持。此前用过提示的基础题现在有一份到期独立正确记录，但完整阅读和长期掌握仍未证明。

依据为原7答/93事件断点与当前10答/120事件；新增两次可靠复测及一次立即重做。原题、资料、原答与旧安排日期/证据保持，只有两份被新安排替代的旧记录标记取消。空状态重放约63毫秒通过原期限，同账户零新增。无业务代码、日常程序、模型或时钟变更，复用前序回归和候选。临时程序正常关闭并核验归档，重复产物按既有规则整理；详见[本阶段变更](12-CHANGELOG.md#2026-10-12原生实际到期复测立即重做与停止保护)与[现有回执](../tmp/stage1-mobile-20261011/verification.md)。

前序复测时常用本机推理入口未就绪；客户随后明确选择本机Free-llm-API私有目录。当前沿既有解析器、明确供应商/型号和有界合成任务接续真实验收：目录位于本机，所列API仍是远程供应商，不宣称本地推理或资料不出机。原始密钥仅内存取用，隔离保险库沿既有加密合同并在试验后删除，不执行HTML、不复制密钥、不读取.env或其他credentials文件，不上传日常原资料；失败回执、供应商成本待结算及语义边界分别保留。客户确认DCloud SDK尚未准备；Windows、对应设备、公共题源、受保护生产和长期效果门禁保持，完整目标继续进行中。

### 前序计算辅助范围继续有效

后台计算需要在用户取消、任务变化或达到限额时退出。前序用真实进程验证了正常退出和拒绝退出两种情况，又经过真实本机服务验证超时、断开连接和停止任务；原答及待核对保持，故障后仍能正常取回参考。

还发现一个具体浪费：无效数据会先加载整套数学内核，随后才检查格式，有时检查前已耗尽限额。现在先做同一套检查，无效请求尽早拒绝，再加载可选内核计算；原版本和全部限额保持。七个真实红测修复，十一项输入拒绝和原十六个数学参考通过，整体回归4498项通过、6项原跳过。参考只提供帮助，不把待核对改成可靠判分。同时补齐监测辅助命令的环境隔离：只传必需路径和语言设置，不沿用宿主凭据；独立红测、复审及实际监测通过。

这次只改变后端内核，当前隔离后端已打包该文件；上一阶段的日常App、27目标/32原答/3资料和恢复链保持。没有重复更新日常程序或四端前端，没有生产、模型或收费操作。本轮计算进程及独立服务回收，测试数据库和冗余临时材料已整理，运行时、许可与必要诊断保留。

完整目标继续进行中。这次实际范围是macOS计算进程、本机HTTP和有界输入；其他工具及完整界面/设备链路、Linux硬内存限制、更广语义/数学、合法请求冷启动稳定性仍分别验证。客户确认DCloud SDK尚未准备，对应设备、Windows、真实模型、公共题源、受保护生产和长期效果门禁保持。

依据见[本阶段变更](12-CHANGELOG.md#2026-10-12工具进程实际限额取消与输入前置校验)、[现有回执](../tmp/stage1-mobile-20261011/verification.md)、[工具合同](04-API-DOCUMENTATION.md#sympy宿主适配合同)及[当前恢复映射](08C-SCRIPTS-REFERENCE.md#当前候选与本机资源)。原生视觉及此前容量/保存因果不由这批工具检查证明。

## 范围与交付顺序（客户 2026-10-01 确认）

产品保持通用学习定位，重点覆盖小学、初中、高中、考研、考公、雅思和托福。平台能力来自共享学习事实、材料来源、受限工具、独立判分和复习反馈；不以更换提示词或接入强模型代替垂类能力。

交付顺序：网页 → macOS/Windows → 微信小程序 → 手机应用。10月01日时桌面安装包尚未实现；10月02日已采用 Tauri 并完成上述 macOS arm64 本机安装范围，Windows 仍待验，不把 H5/PWA 或 uni-app 源码构建称为安装验收。客户已选择主网页 Playful Idea、桌面 Future 3D Portfolio（小程序参考）；提示词来源 https://wangshiliang.cn/news 。原模板先忠实构建，再替换为 Yozi AI 品牌并接现有功能；设计合同见07。

真实模型验收使用本机私有免费模型目录，优先沿已有受保护入口、合成学习任务和有界调用。客户不安排人工核对：自动验收采用独立标准答案或确定性规则；主观语义、口语发音及长期教学效果继续标记未验证，其他模型的同意不升级为可靠判分。

1. 第一阶段（偿债，小至中）：保留交接源码版本和既有暂存；修复跨账户请求共用、取消和迟到结果；修正打包误报和异常收尾；完成原件登记整理/定位恢复的实际网页验收。
2. 第二阶段（共用垂类底座，中）：复用现有学习策略、工具和模型连接；明确学习方向、年级/考试版本、任务目标、材料和可验证能力。分别记录无材料/缺答案/工具不支持，不自动猜教材、试卷年份或官方评分。用同一固定任务比较多个模型的结构成功、工具执行、引用、独立判分、取消和重复请求。
3. 第三阶段（纵向能力，中至大）：先小学算术与初高中代数、考研现有合法材料，再考公数量/资料分析与英语阅读；之后推进申论、作文、听说。每条路径交付材料→原答→校验/辅助反馈→诊断→独立复测，不把七个方向名称当作七套已验收功能。已有题源门禁继续阻塞公共库发布。
4. 第四阶段（桌面，中）：Tauri 2 已获客户采用，macOS 本机包/文件/学习恢复已验；继续 Windows 安装、真实账户/模型连接与签名发布条件。复用服务与事实；更新继续保留应用标识及用户数据，当前没有后台自动更新权限。采用其他新框架或辅助组件前说明收益和维护成本并取得用户同意。
5. 第五阶段（移动，大）：依次微信、手机；复用已有适配，逐项验收真实授权、登录、网络、文件和设备，保留包体及受保护发布边界。

## 已采用的关键决定

总体执行顺序为“统一合同 → 高价值接入 → 能力扩展 → 系统整合”，本轮路线与整批训练沿顶部执行计划推进，设计范围见[07](07-STYLING-SYSTEM.md)。长期真实学习效果单独验收，不阻塞软件工程开发；功能、界面、设备与生产验收分别成立。

### 桌面宿主已采用：Tauri 2

客户于 2026-10-02 明确“采用并继续”，已采用 Tauri 2 的 macOS/Windows 宿主，复用现有 Vue/uni-app H5 产物与学习事实，默认 Future 外观；文件、凭据与连接器沿既有逐次授权及受保护接口，不给网页任意文件/命令权限，不加载远程页面到特权窗口。macOS arm64 App/DMG 已完成本机隔离安装；Windows 继续独立构建/安装验收。开发者签名、公证、商店、收费及生产发布另按原授权门禁。

收益是沿现有前端实现、使用系统 WebView，减少另维护一套页面；成本是引入 Rust/Tauri 依赖和两端原生打包维护，Windows 需要 C++ Build Tools 与 WebView2，本机 Rust 1.93.1 已就绪。依据为 [Tauri 架构](https://v2.tauri.app/start/)与[官方构建前提](https://v2.tauri.app/start/prerequisites/)。API 锁定 2.12.3、CLI 锁定 2.12.2，Rust tauri 保留 Cargo.lock 中的 2.12.1，主次版本同为 2.12；四个脚本已接入 package.json，操作说明见[08C](08C-SCRIPTS-REFERENCE.md)。当前日常包为本机 arm64 构建，经明确授权补齐同身份ad-hoc签名并严格核验，未开发者签名/公证。

### 开源调研与采用判断

以下仅确认公开说明和许可信息，未安装、未运行或导入上游代码/数据；采用判断是建议，不代表质量验收。当前不新增依赖，不直接修改上游。正式复用时保留上游归属，自定义适配独立存放；先更新上游再应用适配，安全修复和结构冲突单独评估。

| 覆盖               | 核对来源                                                                                                                                                                           | 适用点与限制                                                                                                             | 本轮决定                                                             |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------- |
| 平台底座           | [Codex](https://github.com/openai/codex)、[Kolibri](https://github.com/learningequality/kolibri)                                                                                   | 工具/上下文与教育内容组织；独立平台许可不等于所载教材许可，也不证明学习效果                                              | 借鉴职责边界，保留已有架构，不引入整套平台                           |
| 小学               | [中国小学数学知识图谱](https://github.com/wwlwgo/cn-primary-math-knowledge-graph)、[数据许可](https://github.com/wwlwgo/cn-primary-math-knowledge-graph/blob/main/DATA_LICENSE.md) | 稳定能力标识/来源映射；当前依赖明确为soft候选。代码MIT，数据库ODbL、自有文字CC BY-SA；许可文档与候选版本对应关系仍待确认 | 作为知识组织候选，不把候选先修当必需关系，不导入教材/题目            |
| 初中/高中/考研数学 | [MATH](https://github.com/hendrycks/math)、[Math-Verify](https://github.com/huggingface/Math-Verify)                                                                               | 数学固定评测、答案解析/等价校验；竞赛题不等于中国课标或考研真题，解析成功不证明推理正确，复杂输入需资源隔离              | 保留已有有界精确规则，研究扩充独立评测；不引入通用执行器             |
| 考公               | [考公AI导师](https://github.com/KeWang0622/kaogong-skill)                                                                                                                          | 行测/申论题型和出处分工；政策/格式必须核对当年官方信息，模拟题不能称真题，评分语义仍待验                                 | 借鉴任务分工，复用已有资料/原答/辅助评分，不照搬题库                 |
| 雅思/托福          | [English Exam Coach](https://github.com/OleksiiDotsenko/english-exam-coach)                                                                                                        | 任务类型、原答改写、独立复测与进度；明确非官方估分，考试格式按年度更新，文字转录不证明听说能力                           | 先英语阅读/词汇和有来源反馈，再作文/听说；考试格式实施前核对官方版本 |
| 跨方向复习         | [ts-fsrs](https://github.com/open-spaced-repetition/ts-fsrs)                                                                                                                       | 项目已有FSRS；调度规则不能代替可靠作答依据或长期效果证明                                                                 | 继续复用，不重复实现第二套调度                                       |

### 手写评测候选的来源准入（2026-10-12）

本轮只读核对两个已有候选，未下载、导入、安装或评测；它们尚未准入，也不能关闭纸页OCR、复杂含图题目与完整判分门禁。

| 候选        | 数据与代码分开核对                                                                                                                                                                                                                                                           | 可覆盖的诊断与当前缺口                                                                                                                                                                                        |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| MathWriting | [官方说明](https://github.com/google-research/google-research/blob/master/mathwriting/README.md)标明代码Apache-2.0、数据CC BY-NC-SA 4.0；用途与非商业条件的符合性尚未确认，不能仅因本地或免费就按已准入使用                                                                  | [格式](https://github.com/google-research/google-research/blob/master/mathwriting/archive_readme.md)区分真实触屏笔迹与拼接符号的合成笔迹，以normalizedLabel为公式转录标注；渲染图不是纸页扫描，无题目答案权威 |
| HASYv2      | [工具元数据](https://github.com/MartinThoma/HASY/blob/master/setup.cfg)声明MIT，许可全文证据仍待补；[作者论文](https://arxiv.org/html/1701.08380)将数据标为ODbL。[ODbL §2.4](https://opendatacommons.org/licenses/odbl/1-0/)不自动覆盖单张图像独立版权，图像权利尚未核验完整 | 浏览器书写后渲染的32×32单符号，symbol_id/latex标注，仅覆盖符号分类；不证明公式结构、纸页版面、图表含义或答案角色                                                                                              |

若准入条件满足，复用既有Apple Vision图片入口与解析器回执校验；当前没有这两套样本的驱动或LaTeX指标适配。先固定版本/样本/许可/标注/渲染及切分规则，统计失败、空输出、超时和疑义，再比较规范转录；缩小子集不直接对比完整论文成绩。现有固定文本质量夹具中的含图歧义只是合同样例，不是真实OCR准确率证据。错误转录仍待校对，不自动成为可靠答案、学习事实或公共题源。

## A—E 批次

按用户确定的 A—E 规划继续实施。每批交付一条可运行路径，同时记录安全、费用和数据一致性；不为形式重复已有模块。外部阻塞只影响对应验收。

| 批次             | 已有本地实现                                                                     | 后续重点 / 外部条件                                            |
| ---------------- | -------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| A 基线与对话     | 审计、兼容reducer/repository、工具、作答/统计/预算、有界长历史及本机两万操作容量 | 真实用户规模、设备容量与长期冷归档                             |
| B 材料与质量     | 文本、分段 PDF/印刷图连接器、角色/来源/不确定、争议更正、有限变式                | 真实手写/含图评测、移动原生OCR桥和设备能力                     |
| C 教学与复习     | 可修正自述/节奏、方法保护、实际教学后续观察、换法、有效 FSRS 调度                | 更广独立题型验证、长期复测与策略效果校准                       |
| D 模型与商业基础 | provider、BYOK、连接器、能力差异、分账预算、周权益和订阅沙箱                     | 真实本地可达性、视觉/供应商流式与端验、价格/支付授权和渠道资格 |
| E 连续交付       | 同步、迁移/回滚、多端构建、备份/访客分批校验、冲突双方及版本分页处理             | 实际规模/设备、独立生产回退/公开发布                           |

## 完整交付核对矩阵

下表按最初需求逐项核对，避免把“本地功能候选”提前标成目标完成。隔离测试、真实服务、设备与公开发布分别记录；真实价格和权限未定项保留可配置/关闭，不据此停止其余实现。

| 需求范围          | 当前实现/证据                                                                                                                                                                                                                                                                                                                                                                                                                            | 仍需完成                                                                                                                                                                                                                                      |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 聊天默认学习入口  | 阶段4功动能与速度图明确中英主题、规范帮助及独立变式接通；两条网页3答29事件停止重载保持，三端候选分别核验；原会话/事件/Store保留；换题域9文件386项、默认页面8文件289项分别通过；一个聊天框、两条草稿示例、必要澄清、情境题目/进度及次级设置已接入。首次引导无跳转已定位H5动态导航缺陷，显式调用修正后18项定向及新H5候选通过                                                                                                               | 隔离网页首次引导至澄清、换题、错答/帮助后订正、独立变式/一次诗词、键盘/窄屏、停止重开与重复备份预览通过；3原答与35事件前缀保持，明确取回旧题仅追加定位事件。用户4212/日常Mac未更新；同源Mac、三端旅程、日常原资料、自然次日与用户体验分别待验 |
| 情境诗词鼓励      | API代码GPL-3.0/数据MIT分别核对；1条独立古代原文保留署名/卷次/异署。可靠无提示数学变式正确后每会话一次本地短句，默认关闭的鉴权调用及1200毫秒取消/迟到保护已补齐，19项新增与三端产物通过                                                                                                                                                                                                                                                   | 单次原适配器诊断被本机DNS公网地址保护拒绝、HTTPS0；实际在线正向待外部条件，更多逐条来源/情境、实际网络竞态/设备与用户反馈继续；无新模型/费用或私有数据外发，不以1条缓存代表完整诗词服务                                                       |
| 产品定位/免费边界 | 对话为主、BYOK/本地与平台权益分账；核心记录/错题/计划不受会员门禁                                                                                                                                                                                                                                                                                                                                                                        | 当前平台模型服务及生产额度规则未开放；不代订正式价格                                                                                                                                                                                          |
| 仓库审计/复用     | 既有工作树与暂存区保全、统一 reducer、旧答题/FSRS/质量工具复用、文档索引21份                                                                                                                                                                                                                                                                                                                                                             | 后续每批扫描增量；当前npm生产依赖审计14项高风险传播均指向braces问题；已定位构建工具链但全部可达性未证明，发布审计保持阻塞；托管依赖PR未验证                                                                                                   |
| 连续对话/跨入口   | 自动作答/错题/计划/统计、帮助/收据、防串题及原答/明确动作边界；50条消息窗口/分页/大恢复及本机两万操作保存/同步；本次可压缩合成大备份的网页取消/20000上限/撤销/重复及重开通过；新版字段实际同步、最终H5原文流程与原冷启动13项安全基线，以及Mac候选系统文件/原答/字段流程与正常退出重开通过；字段先修17项实际HTTP与66事件网页刷新保持；新Mac基础/帮助/独立字段变式及93事件重开、实际到期复测后120事件重开保持；原Mac文件/阅读/字段流程保留 | 任意内容与对应设备容量、多设备实际冲突、冷归档及长期更新稳定性；前轮冷启动失败和持续性能原因保留                                                                                                                                              |
| 动态教学          | 12种方法合同；实际教学/后续关联、用户教法保护、受阻换法；原答差异/二次候选先修；v3字面错答的字段对应基础及原资料独立复测                                                                                                                                                                                                                                                                                                                 | 更广具体先修和独立学科质量、12方法对不同题型的适用性与长期效果；有限字段基础不能推断认知错因                                                                                                                                                  |
| 语言/参考/写作    | 六体裁、原创语境词义与独立写句/明日任务、两许可片段；论证和当前托福学术讨论/邮件的完整原文、帮助/独立/pending/原时区复测及最新/校对/停止/来源保护；两端正常重开与原记录保持；12原创句子有界组合及提示/独立/未来/停止、当前计划入口修复与回归/构建                                                                                                                                                                                        | 许可一致的成套范文/实际评分、完整听说读写与更广句子任务、更多中文/不同基础的可靠语义、自然跨天/长期效果                                                                                                                                       |
| PDF/纸质材料      | 分段文本/本机识别、来源/角色/页图/版本、不确定校对、取消/重试/去重                                                                                                                                                                                                                                                                                                                                                                       | 真实手写/复杂公式和含图集、移动Apple桥接、微信代码已接但授权网络/文件真机待验，App保护连接/系统文件源码已接，完整SDK装配与设备未通过                                                                                                          |
| 工具层            | 9项受限工具及宿主教学交付；结构/权限/调用/超时/幂等；macOS SymPy真实进程限额/取消、7项实际HTTP、前置校验与11项拒绝、16参考保持；有限数学工具不运行代码                                                                                                                                                                                                                                                                                   | 更广独立数学规则/图形与变式；其他工具及完整界面/设备的超时/取消链路、Linux硬内存限制、合法冷启动稳定性和更广攻击评测                                                                                                                          |
| 学习事实/判分     | 题目版本、原答/帮助、评分/完整原答阅读/更正、首答/变式；密度四任务、帮助/独立/原时区未来与双端完整重开；来源绑定的字面/精确数量、有界代数及显式单未知量方程（网页已验、Mac待重建/验收）；单未知量一次不等式9文件328项及后端/H5隔离候选通过，实际界面/其他端待验；v3逐行校验及字段先修，最新17项实际HTTP/网页刷新与旧v1/v2冻结                                                                                                            | 主观引用/分值仍AI辅助；更广符号语义/多变量/无理零点、复杂条件和学科语义；对应设备及更广原生诊断待验                                                                                                                                           |
| 统计/复习         | 分子分母、partial单列、计划版本、时区、可解释状态；可靠到期复测才推进FSRS；Mac实际两次到期独立复测、立即重做不推进及停止保护通过，10答/120事件普通重开与重放保持                                                                                                                                                                                                                                                                         | 离线跨周/时区变化的真实多设备、长期教学/调度效果未证明                                                                                                                                                                                        |
| 多模型/连接       | 指定provider、能力和授权、密钥保险库、SSRF；Node连接器鉴权/预算/幂等；App云教学原生分块、能力门禁、55组宿主检查与移动SDK内核编译；私有目录远程Groq有限200%核对、两条工具收据及八组事实HTTP重放通过；新写作严格格式与原答引用、同步/停止9项API验收通过；占比精确带分数/排版字形及两份真实返回接续12项HTTP通过                                                                                                                             | 本次协议与真实界面登录已通过，写作/数值正向教学仍待安全网络和新限次授权；失败恢复及同源网页/Mac已验；有限数值/格式通过不替代模型评语/广泛质量；其他供应商/视觉/本地推理、完整DCloud装配及微信/App设备网络/流式仍待验                          |
| 费用/订阅         | 成本与权益分账、预留/结算/取消、周权益和订阅沙箱、收费默认关闭                                                                                                                                                                                                                                                                                                                                                                           | 真实价格/续订升降级/退款渠道与成本结算未验收；未开展真实收费                                                                                                                                                                                  |
| 安全/隐私/迁移    | 用户隔离、退出保留、明确迁移、备份重放、冲突归档、云副本及教学缓存清除                                                                                                                                                                                                                                                                                                                                                                   | 单资料本机/解析器回执/同步墓碑已实现；历史原件定位、设备缓存及运营备份清除范围需部署验证；公开服务当前规则与授权审查                                                                                                                          |
| A—E连续增量       | 可运行单元已记录至11/12，已恢复本地 UI/功能开发和自主免费选型                                                                                                                                                                                                                                                                                                                                                                            | 完整需求完成前目标保持进行中，不仅以本地构建定义交付                                                                                                                                                                                          |
| 固定质量/12场景   | 全局301项固定质量保留；另有七方向字段基础专项13项，相关10文件/252项、17项实际HTTP及网页证据；原流式/缓存隐私与回归保留                                                                                                                                                                                                                                                                                                                   | 更广学科/基础/攻击/手写含图、真实结构成功率/引用/延迟/完整成本/自动独立语义评测；有限样例不代替语义与长期效果                                                                                                                                 |
| 最终交付/发布     | 实际代码、兼容记录、合同/索引、能力矩阵和门禁；新字段先修三端源码审计/网页通过；最新日常Mac同身份程序更新、本机签名、恢复/正常重开与退出提醒已验                                                                                                                                                                                                                                                                                         | 正式发行签名公证与Windows、公共题源/资料、受保护生产、微信/App设备、完整release:gate和公开发布                                                                                                                                                |

至少12个验收场景对应：1无资料/无模型（本地页面通过）；2角色/歧义（本机PDF有限通过，手写待验）；3帮助/修正/首次幂等（本轮回归）；4统计10/6和6/2（已有真实H5）；5动态难度/抽象（有限挑战/类比，广泛效果未证明）；6明确意愿/停止/画像修正（代码/隔离）；7变式独立检验（有限算例）；8跨入口/网络/同步（代码、本机HTTP和H5，设备规模待验）；9模型/密钥/共享（有限Gemini历史证据，本地真实/设备待验）；10权益/退款（隔离沙箱，不收费）；11攻击/SSRF/越权（隔离，继续扩展）；12迁移/回滚/旧门禁（代码/隔离，生产恢复待授权与可靠前态）。

## 阶段结束后的汇报约定（2026-10-09起）

客户要求每执行完一阶段，进行一次费曼汇报，并用PlantUML绘制进度图。每个可独立验收的阶段完成后，先用完全不了解项目的人也能理解的语言说明：这款软件要解决什么问题、原来哪里不可靠、本阶段改成什么、对使用者有什么用、怎样证明有效，以及还缺什么。术语必须用普通话解释；技术命令、文件、版本和测试数字集中在依据里。结果没有验证时明确说尚未验证，不用任务数量估算完成百分比。

同步更新[当前进度图](diagrams/13-progress.png)与[PlantUML源文件](diagrams/13-progress.puml)，图中文字明确区分本机已验证、下一步、待完成和设备/生产边界。功能与设计两条线继续独立推进；小步骤不冒充完整阶段。复用本节和固定图文件，正式历史回执保留，避免每次新增一套报告或重复图像；阶段清理结果简短如实汇报。此约定从当前已完成阶段开始执行，整个持续目标仍进行中。
