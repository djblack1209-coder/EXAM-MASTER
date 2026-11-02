# 诊断持久采集合同 A v2（待审，未启用）

**v2 待批／默认关闭。** 原始 [A v1](DRAFT-DIAGNOSTIC-PERSISTENCE-CONTRACT-20261024.md) 冻结保留。技术依据为主线转交的《YOZI-AB-CLAUDE-VERDICT-20261024.md》全文333行，SHA256 `16502dd7eb5e73ac514965d8bc124a8a50c99816767cd97b06a81a7b9184c42d`；它是技术指导，不提供 G1–G9 授权。本轮仅获准默认关闭源码及手写合成夹具离线验证，不授权启用、真实读取／采集或删除。

## 现状差集 Q1–Q5（仅无秘密源码事实）

| 项      | 实际代码事实                                                                                                                                                                                                                                                                    | 与一期要求的差集                                                                                                                                                               |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Q1      | `learning-account.ts:41` 产出11个类型槽、7个计量／位置槽、5个枚举槽、4个布尔槽；类型为missing/null/array/object/string/number/boolean/json_object/invalid_json；数值统一0～2MiB，非法字段被忽略。类型／终止原因／起始类别为闭合枚举，但没有必填版本／时间／阶段或整份1KiB检查。 | 改成严格闭合新对象构造；任一未知键／非法值整份不收，版本为diag-meta-1。                                                                                                        |
| Q1 口径 | `learningResponseShape` 使用JS String.length（UTF-16码元）；HTTP读取器以Buffer chunk.length累加，没有解压步骤；provider与coach均从异常message正则取position。                                                                                                                   | 仅identity正文可确认是解码后字节；其他编码省略responseBytes。位置不再取message；目前JSON.parse没有项目结构化偏移，所以产出端省略position及unit，不另造解析器。                 |
| Q2      | `captureDiagnostics` 初值false，但proxy在DEV_TEST＋精确QA owner＋coach时自动置true，没有独立开关；settle也仅按DEV_TEST和该owner保存，未限定失败。DEV_TEST要求dev/test渠道、development/test环境、loopback和隔离数据库，production时不成立。                                     | 源码显示既有QA采集可能已开，运行值／存量未知；已向主线报告，不读环境确认，不擅改配置。增加默认关闭采集及owner自读门，生产硬关闭。                                              |
| Q3      | maintainModelResources只维护call.result及usage，不清诊断／calls。reserveCall在非DEV_TEST限制500条，DEV_TEST放宽；账号预留另有7MiB保护，未发现calls定时淘汰。eraseModelResultCache会清诊断，但它是既有明确隐私删除，不是TTL维护。                                                | 保留calls／结果／费用现行规则；新版本满32份停写，不淘汰、不物理删除；遗留诊断不可读且不计新版本容量。                                                                          |
| Q4      | settleCall克隆账号，非reserved幂等复用；诊断已与结算位于同一次mutateAccount CAS。CAS最多5次，按库内revision比较更新，每次重新读取文档并调用settle。                                                                                                                             | 在该回调内重数新版本诊断，第32份可写／第33份停写；诊断异常不改变结算／费用，不重试推理。                                                                                       |
| Q5      | action=result按认证owner及requestId找call，会调用recoverStaleReservations／maintainModelResources并可能写库。原失败返回code/success/status/error/validationPath/message，不返回完整诊断；补核发现usage会展开call并夹带遗留responseDiagnostics。                                 | 在既有失败投影增加默认关闭的owner诊断白名单；usage显式排除responseDiagnostics，关闭旁路。不建立新接口；原结果维护及基础错误投影不扩张，新增诊断对象不含自由errorCode/message。 |

源码与编译产物是独立文件，standalone从其编译目录加载并缓存JS；本轮不emit／替换编译目录，不更新QA。旧PID26222在本轮精确PID检查时已不存在；这不证明当前没有其他QA进程，本轮不启停或重新核查服务。

## Claude建议纳入的一期合同

- 仅服务端判定：严格隔离dev/test、非production、allowlist恰好一个owner、库内owner匹配、采集开关及已授权owner读取面同时开放。两个开关默认false；本轮均不设置或启用。
- 仅失败call可采；成功、取消、不确定owner、多owner均不写。版本／时间由结算端生成，来源不是客户端。
- 必填 `version='diag-meta-1'`、安全整数 `capturedAt`、`failureStage`。阶段仅http_envelope／json_parse／schema／secret_guard／unknown；transport是否新增仍待主线二选一，本期连接／超时失败用unknown。
- 11个类型槽沿v1固定名称／9种类型；计量槽沿v1固定名称，Chars单位UTF-16码元，计量0～2,097,152；httpStatus仅100～599。networkStage=headers/received，mimeCategory=json/sse/text/other/missing，envelopeJson=valid/invalid，startToken=object/array/string/other/empty；finishReason沿v1闭合值；4个布尔槽沿v1。禁止原文、秘密、身份、隐藏推理、错误message/stack、动态键／通用骨架等v1禁存清单全部保持。
- syntaxPosition仅json_parse且有项目解析器结构化偏移、对应positionUnit时可产出；当前拿不到，全部省略，不从错误字符串推断。schema验证与读取复用同一构造器。
- 单份紧凑UTF-8 JSON≤1024B，最多32份合法新版本记录；32KiB只是推论，不加累计字节控制面。超限／非法整份舍弃，用固定事件码DIAG_OMITTED_SCHEMA／SIZE／CAPACITY，不带字段或值；诊断不能危及结算。
- 新对象逐键校验／构造，拒绝未知键、非法类型、非安全整数、访问器、循环／序列化失败；不在原对象删键。实际最长合法序列化大小以本轮离线结果为准，Claude手算843B不当作结果。
- isDiagReadable为纯读取：精确版本、合法新对象、安全now与capturedAt、capturedAt≤now、now<capturedAt+86,400,000；读不续期、不删除。遗留／未来时间／到期记录不可读，但不自动删除。
- owner自读只扩既有result失败投影，校验owner／requestId／版本／24小时后返回经同一校验器的新对象；门关闭不增加字段，门打开但无可读诊断标unavailable。维护者读、新接口／管理页／导出／备份、自动淘汰和物理删除均不实施。

## 实现边界与仍待主线落实

本地一期范围限learning-account.ts的校验／结算／纯可读函数、proxy-ai.ts的失败元数据映射、provider／coach的位置来源及字节口径、learning-models.ts的关闭态投影；不改严格解析、密钥回显／出站阻断、鉴权、费用、幂等、原eraseModelResultCache或结果缓存政策。

G1正式批准v2仍未完成；G2登录继续搁置；G5采集还需已授权读取面与明确收尾人／方式／时间；G6每次物理删除需独立书面授权；G7存量／备份清点需访问授权；G9任何QA开关／部署需独立授权。默认关闭源码与离线夹具不解除这些门。24小时只承诺逻辑不可读，不承诺物理删除。

待主线选择仅保留：transport枚举是否新增；实际启用与owner自读范围；读取和收尾授权／执行条件。未定项不由本轮自行补定。

本批离线回执：一期源码已实现，采集与owner自读仍默认关闭；8项合成定向检查通过，既有无关用例跳过。最长合法全字段夹具实际紧凑JSON为834B（含16位安全时间整数），没有采用手算843B；usage遗留诊断排除另在B阶段新增handler夹具中验证通过。相关6个TypeScript入口noEmit为0诊断，coach源码ESLint通过。本批没有真实采集／读取、数据库操作、删除、运行时更新或新构建，不能作为真实教学验收。
