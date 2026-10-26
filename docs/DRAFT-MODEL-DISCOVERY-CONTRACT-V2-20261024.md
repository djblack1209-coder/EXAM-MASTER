# 只读模型发现合同 B v2（待审，未启用）

**草案／未定案。** 原始 [B v1](DRAFT-MODEL-DISCOVERY-CONTRACT-20261024.md) 冻结保留。按主线转交的Claude333行裁决修订，只授权默认关闭离线源码／手写夹具阶段，不授权发现、凭据使用、真实推理或部署。G1–G9保持；登录18:31继续搁置。本轮不联网、连库或读真实记录。

## 现状差集 Q6–Q9（无秘密源码事实）

| 项  | 源码事实                                                                                                                                                                                                                                                                                        | 本阶段处理与限制                                                                                                                                                                             |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Q6  | profile没有独立递增配置版本。modelConfigurationVersion是内容摘要，包含keyRef或apiKey，不能作为新发现缓存版本。正常save每次生成新keyRef并经账号CAS替换profile，delete先经账号CAS移除profile再删key；这些路径会递增account.revision。                                                             | 不改既有摘要／旧测试状态。离线发现使用读取器提供的非秘密配置版本；现有account.revision可作保守候选，但真实绑定轮换／撤销覆盖及凭据适配须主线确认，不新增密钥散列。                           |
| Q7  | learning-model-runtime的Map用于真实调用取消，不是发现合并；learning-models／provider未见发现缓存／冷却。客户端readModelResource已有按context的promise合并、取消及迟到守卫。                                                                                                                     | 服务端只增加一个有界Map，合并在途／缓存／冷却，内存LRU；客户端本批不接。不能把客户端Map当服务端实现。                                                                                        |
| Q8  | 静态聊天路径：DeepSeek api.deepseek.com /chat/completions；Groq api.groq.com /openai/v1/chat/completions；Mistral api.mistral.ai /v1/chat/completions；OpenRouter openrouter.ai /api/v1/chat/completions；千帆 qianfan.baidubce.com /v2/chat/completions。现有provider用Authorization: Bearer。 | 相应models路径静态上同host／base前缀／Bearer可作为候选，但没有读取当前真实profile，不能声称已绑定。首批只做DeepSeek与Groq；其他unsupported。                                                 |
| Q9  | 现有出站为node:https.request而非fetch；固定经过DNS校验的socket地址、保留TLS hostname、不自动重定向；支持AbortSignal。成功正文>1MiB中止，错误正文只缓冲64KiB但会继续计量；现有30/60秒超时不包含全部DNS等待，未做通用GET/JSON读取。                                                               | 不改推理POST。新增有限只读GET transport，复用validateCloudEndpoint／resolveCloudEndpoint与地址固定；拒绝3xx／非JSON／压缩编码，流式计量到2MiB即中止，10秒总时限，fetch接口可注入手写假响应。 |

Q1–Q5见[A v2](DRAFT-DIAGNOSTIC-PERSISTENCE-CONTRACT-V2-20261024.md)。源码不会热更新已编译standalone目录，本轮不构建、部署或替换运行时。

## 阶段一：静态元数据与纯最高档预检

`sourceKind`仅为无序枚举local_catalogue／official_document／official_api_observed，不是覆盖优先级。每个投影含sources[]；字段只有value/state/reason/sourceRef/sourcePath。API来源URL写静态模板，不写含账号／地域空间标识的实际URL。

字段state为known／unknown／not_applicable／conflict；freshness由expiresAt与now单独派生。not_applicable需正式文档证据；null、缺字段、不明k/M均unknown。不同来源冲突保留两份来源，阻断依赖该字段的最高档；不取最大或最小。没有完整列表时缺席不是unlisted。

闭合上限沿裁决：modelId为1～256可打印ASCII字符；模态每类≤8个；supportedParameters≤64个、每个≤64字符；reasoningLevels≤16个、每个≤32字符。名单／字段缺失不填false、0或无限制。pricing固定unknown/not_collected_phase1；freeQuota固定unknown/not_discoverable；verifiedInference不由发现产出。

参数只能由经逐条主线审阅的精确（厂商／地域／协议／modelId）静态映射生成；发现只能否决，不能生成参数。当前没有获批最高值引文，所有真实映射的highestReasoningLevel均null，evaluateHighestTier返回HIGHEST_LEVEL_UNKNOWN；不接入真实调用路径。

静态映射另带outputIncludesReasoning=true/false/unknown；unknown拒绝。true时须有推理上限且在既有2000产品上限内留出主线确定的正文余量，阈值未定就拒绝。免费资格仅沿free-model-presets.ts精确型号／价格版本／到期事实，不取发现价格、free后缀或历史结算。预算／免费冲突返回BUDGET_OR_FREE_SCOPE_CONFLICT，不降档、不改上限、不换路由、不建议降档。Kimi类保留推理协议返回PRIVACY_REVIEW_REQUIRED。

官方文档静态映射须有reviewedAt／reviewDueAt与段落引用；reviewDueAt由主线逐条确定，不使用全体24小时复核。本轮不补引文或猜周期；缺审阅输入的能力保持未知。

## 阶段二：默认关闭的服务端最小接缝

- 复用POST /learning-models的新discover分派，必须放在会写库的分布式限流／账户维护之前；保留requireAuth。新动作不调用mutateAccount、maintainModelResources、账本／诊断／费用写入或配置保存。
- 业务payload只允许profileId、可选modelId、必填refresh:boolean；action仅是已有端点分派标识，不成为任意字段入口。多余字段立即拒绝；凭据／URL／owner／headers不从请求接收。
- 默认关闭，生产硬关闭。运行时凭据适配与实际网络不在本轮授权；离线依赖注入只提供手写profile版本、虚构凭据和假fetch。服务端没有获准的凭据读取器时返回UNSUPPORTED_DISCOVERY_AUTH，不新增保险库取用实现。
- 每个请求先经只读profile读取器获得当前owner、配置版本及静态边界匹配，再访问缓存；未绑定／owner不符／版本未知拒绝。请求完成再次核版本，变化则不回填；不依赖多实例事件失效，不读解密秘密。
- refresh:false只读缓存，不发请求；refresh:true须明确授权且过冷却才可能调用GET。本地默认关闭实现不等于授权实际refresh。
- DeepSeek仅GET /models，详情从列表同一条投影；Groq列表GET /openai/v1/models，详情ID限`^[a-zA-Z0-9][a-zA-Z0-9._-]{0,255}$`且同前缀，拒绝斜杠、反斜杠及路径穿越，不猜编码；不分页，出现分页标识即complete=false。
- 列表只给modelId／displayName／availability；详情单模型给字段及sources。响应中的绝对URL不跟随；厂商自由字段／错误文本不回传、不持久化。
- 有界Map承载在途合并／列表或单模型快照／冷却，按owner＋非秘密配置版本＋profile＋模式／型号隔离；按序列化键与状态／投影计1MiB内存预算，LRU淘汰非在途且冷却已过的项，满额且不能释放则拒绝。取消或配置变化仅清快照，保留profile冷却，避免变版本／取消后立即重发绕过。没有第二套持久缓存／框架。
- 上限为响应2MiB、1000条、首期1页、10秒总时限；5分钟TTL、60秒刷新冷却。401/403不重试或换凭据；404/410不可确认；429冷却；失败旧缓存标stale且不能放行最高档。实际计费元数据端点unsupported。

## 真实启用前仍缺的门槛

G1主线书面批准v2；G2恢复正常会话；G3逐厂商凭据使用授权；G4只读请求授权及计费／限流确认；G8逐条最高档引用、隐私及首次真实推理／费用授权；G9部署／配置启用授权。现在全部未解除。account.revision候选版本与真实撤销适配、reviewDueAt周期、正文余量、transport枚举等未定内容只阻塞相应启用／参数，不阻塞已授权离线默认关闭实现。

本批离线回执：静态元数据与evaluateHighestTier的4项纯函数检查通过；服务端默认关闭接缝的9项新增检查通过（含A的usage排除回归）。夹具实际覆盖关闭态数据库／维护／分布式限流调用0、同键合并、owner／版本隔离、迟到拒收、缓存／冷却／TTL／LRU、10秒总时限及2MiB流式中止；另验取消一位仍保留共享请求、全部取消则中止且不回填，取消／变版本不能绕过冷却。只重跑取消与版本受影响的2项，其余通过项沿用。全部profile、凭据及响应为手写假数据，无真实GET／DNS／库访问。6个相关TypeScript入口noEmit为0诊断。生产硬关闭、运行时无凭据读取适配器、最高档注册表为空；客户端未接线，QA／环境／候选未更新，不能判任何真实厂商可用或最高档通过。

## 附录：v1厂商证据表的定位

[B v1第2、3节](DRAFT-MODEL-DISCOVERY-CONTRACT-20261024.md#2-厂商模型列表与能力来源核对)只作为原作者公开文档核查记录，不是本合同条款，也未获Claude逐项复核。其他厂商、方舟AK、Gemini原生路径、百炼空间host、TokenHub／Cloudflare等不纳入首批；保留原目录及用户选择，不猜新接口。
