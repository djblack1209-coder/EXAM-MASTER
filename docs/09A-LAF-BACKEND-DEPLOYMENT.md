# 后端运行合同

私人资料解析器可选 Mac Apple Vision：先 `npm run test:apple:vision` 做公开合成自检，再 `npm run build:apple:vision`（仅编译），把返回的绝对 `binary` 路径显式配置为 `MATERIAL_APPLE_VISION_BIN`；其他令牌/精确Origin/loopback监听/临时存储合同不变。要求真实macOS14以上及对应Apple SDK，CPU配置必须由API支持；不使用自动硬件回退。系统模型首次编译可能超过资料12秒期限，健康检查不代表完成初始化；先合成自检，真实文件超时则明确重试/校对，不放宽预算。子进程只继承PATH/TMPDIR，正文走有界stdin，固定错误码不记录资料/密钥。此二进制在解析器Mac运行，不能填充DCloud移动插件验收。

Laf 函数与独立后端共享业务源码。standalone/server.ts 提供 Express 路由；standalone/cloud-shim.ts 适配隔离 Mongo/存储。生产必须明确 ALLOWED_ORIGINS，不能继承旧域名或开发来源。上传、JSON 与请求时间均有预算限制。

TypeScript 使用 Node16 模块解析，运行仍要求 Node >=22.22.3。构建完整入口，noEmitOnError 保留；package-runtime.mjs 将 @lafjs/cloud 改为本地适配，并复制未改写的 FSRS CommonJS bundle 与 YAML。原生 ESM 检查不能只靠测试转译器。

```sh
npm run typecheck:backend
npm run build:backend
npm run audit:backend:runtime
```

最后一项审计本地产物，不等于部署。npm run start --prefix laf-backend/standalone 会使用环境连接真实数据库和服务，运行前必须指定隔离/授权目标。

learning_states / learning_accounts / learning_model_keys 为私有集合，服务端用户授权、索引和禁止客户端直连策略必须在真实环境验证。密钥保险库与账户集合分离，AES-GCM 绑定用户/配置，日志不含密钥；持有保险库主密钥的运营者能解密，不是端到端保密。

Mongo 初次并发初始化复用同一连接 Promise；失败关闭并释放，生命周期测试与隔离运行证据见 11。真实生产恢复、真实账户登录、SMTP、设备和外部模型分别验收，不能由本机合成身份代替。

## 本机文本模型连接器

运行 npm run dev:local-model 前明确 LOCAL_MODEL_IDS（逗号分隔真实型号）与固定 LOCAL_MODEL_TARGET（默认 http://127.0.0.1:11434/v1/chat/completions）。仅数值本机/私网地址允许；显式云型号不允许。模型服务的真实推理未通过，不能从 health 成功推断推理可用。接口按 [Ollama 官方兼容协议](https://docs.ollama.com/api/openai-compatibility)的文本子集实现，兼容其他服务须逐项验证。

LOCAL_CONNECTOR_PORT 默认 8766，LOCAL_CONNECTOR_ORIGINS 默认 http://127.0.0.1:4204（逗号分隔精确来源），必须与当前 H5 来源完全一致。LOCAL_CONNECTOR_TOKEN 至少 32 字符；未设置则创建仅本人可读的 tmp/local-model-connector/token，终端只提示文件路径，不打印令牌。连接器只绑定 127.0.0.1，前端配置 http://127.0.0.1:8766/chat，令牌只保存在当前内存。可选 LOCAL_MODEL_API_KEY 仅交给固定本机上游，不把连接器令牌转发。微信代码可直连已授权可达目标，但手机localhost是手机自身；需已有可信HTTPS网关或符合微信域名规则的地址转发到此环回服务，并完整保留来源、Bearer、固定上游/型号及硬预算。微信端来源标识固定为https://wenli-weixin.invalid，服务端必须显式加入LOCAL_CONNECTOR_ORIGINS；不能把这项配置当作真实设备已验证。未开放LAN监听、不修改域名校验。现有App客户端仍拒绝此路径。

LOCAL_CONNECTOR_MAX_CALLS 默认 20（最多 100）；CLI 固定输出 512 token、25 秒超时、最多 2 并发及 10 次/分钟。服务构造函数可在硬上限内配置输出/超时供隔离验证，CLI 不读取额外同名环境变量。健康检查不产生推理；/chat 相同 requestId 同内容复用包含失败的执行结果，次数用尽须停止。进程重启是新的会话预算，不能据此声称跨进程持久计费。不开任意代码执行、工具/视觉/流式能力。固定本机服务是否再次转发云端由用户核对，不承诺仅因地址私有就绝不离开设备。

## 本机资料解析器

运行 .venv-baidu/bin/python scripts/pipeline/private-material-parser.py，明确 MATERIAL_CONNECTOR_TOKEN（至少 32 字符）和 MATERIAL_CONNECTOR_ORIGIN。MATERIAL_CONNECTOR_PORT 默认 8765，仍只绑定127.0.0.1；前端独立配置 /parse。微信连接同样需要受保护可达地址与精确MATERIAL_CONNECTOR_ORIGIN=https://wenli-weixin.invalid，现有H5来源独立设置，不能自动扩大为通配。可选 MATERIAL_CONNECTOR_STORAGE 保存原件供继续处理/删除，未指定使用进程临时目录并在正常退出清理。POST /health 仅检查鉴权及现有程序，不能证明手写/中文识别质量。PDF 文本优先，扫描文字识别必须用户勾选；系统已有 pdftotext/pdftoppm/Tesseract 的有限路径通过，不安装或下载模型。旧 /chat 返回 410。

资料原件删除需连接器/delete；本机范围确认后只向已授权原解析器发送匹配fileId。回执未到或失败保留无正文待办，重试单独确认，不把设备记录删除说成所有外部原件或运营备份已消失。当前能力/证据见[14](14-MODEL-PRIVACY-COST.md)。

大learning_states由Node内置gzip保存，逻辑上限600万UTF-16字符/2万操作，压缩8MiB/解压2400万字节；旧raw兼容，单文档CAS和用户隔离保持。页面读取仍经同一鉴权/限流入口，不新增对外无授权文件服务。原生后端27/27入口加载及固定Mongo大历史已验证；Laf云实际部署/运行与设备尚未验证。旧版本程序不支持新封装，生产回退须先具备独立数据前态，详见[09B](09B-BACKEND-MIGRATION-GUIDE.md)。

流式部署仍需真实环境另验：独立Express有每请求AsyncLocalStorage响应与本机TLS/HTTP证据；Laf托管response接口、网关缓冲/超时、HTTP断流及跨实例取消尚未实测。本轮只改本地源码与构建，不部署。Nginx/Laf须保持认证、来源、上游白名单/固定DNS/TLS及账本预算；只有完整结构经校验才向客户端返回成功收据。不能把代理配置存在当流式公开可用。当前App无可靠分块路径时主动非流式，不静默消费。
