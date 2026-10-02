# 构建与部署边界

## 本地构建

H5：npm run build:h5 → dist/build/h5；微信：npm run build:mp-weixin → dist/build/mp-weixin；已配置 App：npm run build:app → dist/build/app。产物检查分别使用 audit:wechat:artifacts / audit:app:artifacts，微信主包检查见 08C。构建不上传、不创建付费资源、不改变生产数据库。

独立后端：npm ci --prefix laf-backend/standalone（先审查锁与生命周期），npm run typecheck:backend，npm run build:backend。运行入口和要求见[09A](09A-LAF-BACKEND-DEPLOYMENT.md)。环境示例只解释字段，不保存真实密钥。

## 磁盘空间与产物清理

2026-09-30 空间维护清理了根级 dist、独立后端 dist、6 份临时 H5 构建，以及 ESLint、Ruff、pytest 和自产 Python 字节码缓存。共移除 20,370 个生成文件；按 du 的已分配块计量，项目从约 4.72 GiB 降至 3.78 GiB，减少 1,016,385,536 字节（约 1.02 GB）。同一测量窗口内磁盘可用空间净增加 1,008,762,880 字节；文件系统快照和其他应用也会影响这一数字，硬链接计量只算一次。

原始资料、题源/质量数据、源码、Git 历史、依赖环境、恢复前快照、验收日志与截图保留。清理记录在本机 tmp/disk-cleanup-20260930/report.json；删除前核对目标无 Git 跟踪文件且未被进程打开，删除后核对源码哈希、工作树状态和暂存区一致。

| 已清理的产物                | 再次使用时的操作                                                           |
| --------------------------- | -------------------------------------------------------------------------- |
| dist/build/h5               | npm run build:h5                                                           |
| dist/build/mp-weixin        | npm run build:mp-weixin，然后做包体与产物审计                              |
| dist/build/app              | npm run build:app，然后 npm run audit:app:artifacts                        |
| laf-backend/standalone/dist | npm run build:backend；本地后端启动前重建                                  |
| tmp 中的历史/隔离 H5 输出   | 保留历史日志与截图；当前版本按需要重新构建，历史版本须使用对应源码与锁文件 |
| 工具与 Python 字节码缓存    | 对应工具下次运行会自动生成                                                 |

仅开发 H5 可使用 npm run dev:h5。上述清理是前序维护记录；本轮功能交付已重建一套 H5/微信/App/后端输出，未复制多套历史构建。本批流式H5验收使用127.0.0.1:4231/api及本机隔离后端/TLS夹具；验收后只保留一套当前构建，不保留私有测试JWT或TLS私钥。最终发布门禁构建显式关闭mock/debug、清空API/fallback，真实云smoke目标设为不可连接协议防止误触授权范围。没有配置真实服务端的本地产物不能部署或宣称在线AI可用；设备/部署前必须用授权环境重建并验收对应产物。

日常按需生成单个平台输出，临时预览结束后及时清理对应构建目录。清理范围先查 Git 跟踪和活跃进程，再确认可重建性；tmp 整体包含恢复快照与证据，不直接整体删除。data/raw-inbox、题库、原始材料、配置和密钥不作为缓存处理。安装环境仍保留，避免空间维护使离线开发和解析失效。

## 生产前置

本轮无生产部署授权。部署时必须重新读取 VPS-Config 当前运行合同，记录目标、前态、可信恢复源和可恢复备份；生产应用必须原子且受保护，有独立回滚及真实选题→答题→判分→复习后检。--build-only 仅构建，不能证明生产恢复。拒绝未保护写入的部署策略保持。

公共发布执行现有 release:gate，保留来源质量、资源预算、依赖安全、外部/微信设备及真实云端验收。首页/health 的 HTTP 200 不能代替题库与学习业务。旧库不合格不强制停用私人学习，但私人入口不能绕过旧库公开门禁。

对公开 AI、未成年人、隐私、内容标识、素材授权与各端支付规则，实际发布前核对当时官方要求并留下证据；BYOK 或上游资质不能替代应用自身验收。品牌名/域名/商店名称与授权也需单独确认，不在本轮注册或购买。

本轮临时Mongo/HTTP/TLS及浏览器页面均属隔离验收，结束后停止并清理自产数据库/临时TLS私钥，只保留脱敏报告/脚本/截图。全量重放在共享reducer有界副本内完成，不通过提高产品预算掩盖超时。现有Dependabot按周提出依赖更新，保持锁文件/分包/许可证与测试门禁，不执行无人审查的破坏性升级。

本批release:gate初次在生产依赖安全审计发现Babel/选择器解析器漏洞；未执行audit fix --force或破坏性框架回退。package.json按原大版本覆盖Babel7.29.7、选择器6.1.3/7.1.3，锁文件同步；专项防护及三端构建验证兼容，生产审计恢复零漏洞。依据：[Babel补丁说明](https://github.com/babel/babel/releases/tag/v7.29.6)、[选择器6.1.3](https://github.com/postcss/postcss-selector-parser/releases/tag/6.1.3)、[选择器7.1.3](https://github.com/postcss/postcss-selector-parser/releases/tag/7.1.3)。仍保留全依赖开发工具链审计的22项风险，需逐项兼容处理，不能以自动更新等同已安全。

本轮继续完成开发工具链安全升级与窄接口适配，最终全依赖审计、依赖树和三端结果见[11](11-RELEASE-NOTES.md)/tmp/resource-delivery；上文22项风险为前序快照。部署前新增核对LEARNING_MODEL_RESULT_CACHE，配置非法时保持调用拒绝，不设置无限保留；默认访问清理不等于后台物理删除。恢复及账单新字段为可选兼容，旧正文按原时间限制；生产容量、账单归档、备份保留和后台清理仍需运营验收，不由本轮部署。npm ci需保留scripts/compat/file-type源码与根别名，原后端生产安装不依赖这一开发适配。
