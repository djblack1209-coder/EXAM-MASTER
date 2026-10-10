# 工具与兼容模块

| 模块                                 | 用途与边界                                              |
| ------------------------------------ | ------------------------------------------------------- |
| auth-storage / storageService        | 分用户存储与身份读取；不能改名打断旧数据                |
| learning-write-lease                 | H5 单写者租约；不支持 Web Locks 的端明确显示能力范围    |
| learning-backup                      | 同账户受限恢复，不执行代码、不接纳导入判分权威          |
| learning-sync                        | 明确授权上传，重连幂等、内容冲突和生命周期检查          |
| local-connector / material-connector | 模型/资料两类连接路径，目标、鉴权和授权来源分别验证     |
| safe-navigate / home-navigation      | 已注册页面路由与统一首页；不从模型文本构造任意导航      |
| keyboard-controls                    | H5 学习键盘交互，不推断微信辅助技术通过                 |
| logger                               | 记录有限诊断，不打印密钥、原始资料或完整私人聊天        |
| fsrs-service                         | 有效复习的调度职责，不等于整个学科掌握模型              |
| static-assets / pwa-cache-policy     | 公共静态资源与缓存范围；用户数据/API 不进入公共离线缓存 |

工具实现集中 src/services/learning/ 与 src/utils/；[模块索引](03-MODULE-INDEX.md)提供关键入口。使用现有模块，避免增加功能相同的包装层。无静态入边的模块先检查动态注册、easycom、条件编译和测试，不能自动删。

新引入组件须记录问题、相对现有优势、所选版本官方资料、许可证、维护状态、资源/跨端成本和安全验证。当前 Logo 是原创几何 SVG，没有新增产品运行依赖；离线栅格化使用已安装工作区 sharp，不修改依赖锁。
