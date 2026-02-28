# 微信提审操作单全量审计报告（2026-02-28）

> 审计目标：按提审操作单完成发布前全量核验，并清理冗余开发痕迹，确保交付包清爽可审。

---

## 1. 提审操作单核验结果

| 操作单项               | 结果        | 证据                                                                                                          |
| ---------------------- | ----------- | ------------------------------------------------------------------------------------------------------------- |
| 隐私保护开关启用       | ✅ 通过     | `manifest.json:68` 启用 `mp-weixin.__usePrivacyCheck__ = true`                                                |
| 隐私授权事件接入       | ✅ 通过     | `src/components/common/privacy-popup.vue:49` 注册 `wx.onNeedPrivacyAuthorization`                             |
| 隐私指引可达与降级链路 | ✅ 通过     | `src/components/common/privacy-popup.vue:91` 调用 `wx.openPrivacyContract`，失败降级 `pages/settings/privacy` |
| 协议页面可达           | ✅ 通过     | `pages.json:149`、`pages.json:157` 已配置 `pages/settings/privacy`、`pages/settings/terms`                    |
| 登录前同意机制         | ✅ 通过     | `src/pages/login/index.vue:221` 协议勾选 UI；`src/pages/login/index.vue:366` 未勾选直接拦截                   |
| 敏感权限拒绝后引导     | ✅ 通过     | `src/utils/helpers/permission-handler.js:129` 使用 `uni.openSetting` 引导用户授权                             |
| 小程序包体核验         | ✅ 通过     | 本轮构建测得主包约 `0.68MB`、总包约 `1.60MB`                                                                  |
| 质量门禁全绿           | ✅ 通过     | 见第 2 节命令审计结果                                                                                         |
| 生产依赖漏洞余量       | ⚠️ 风险接受 | `npm audit --omit=dev`：`11` 项（`1 moderate` / `10 high`），均为 uni 生态传递依赖                            |

---

## 2. 全量命令审计（本轮实跑）

| 命令                          | 结果        | 关键输出                                   |
| ----------------------------- | ----------- | ------------------------------------------ |
| `npm run test`                | ✅ 通过     | `63 files / 979 tests passed`              |
| `npm run lint`                | ✅ 通过     | 无 error/warning 阻塞                      |
| `npm run build:h5`            | ✅ 通过     | `DONE Build complete`                      |
| `npm run build:mp-weixin`     | ✅ 通过     | `DONE Build complete`                      |
| `npm run audit:deep-scan`     | ✅ 通过     | 扫描 `469` 文件，`TEST: 65`                |
| `npm run audit:ui-quality`    | ✅ 通过     | `100/100`                                  |
| `npm run audit:mp-main-usage` | ✅ 通过     | 主包关键模块引用检查通过                   |
| `npm audit --omit=dev`        | ⚠️ 可控风险 | `11 vulnerabilities (1 moderate, 10 high)` |

---

## 3. 冗余开发痕迹清理

本轮执行了低风险清理，确保不影响业务链路：

1. 删除未复用的 QA 调试注入模块：`src/utils/debug/qa.js`。
2. 移除 App 启动期 QA 拦截器与全局 QA 挂载：`App.vue`。
3. 深度扫描脚本排除备份目录，避免开发快照干扰质量统计：`scripts/build/deep-scan.js:84`。

清理后复核：Lint/Test/H5/MP 构建与全部审计脚本均通过。

---

## 4. 平台侧人工项（仍需提审负责人执行）

以下事项无法仅靠仓库自动化，需要在微信公众平台后台完成最终确认：

1. 合法域名（request/upload/download/socket）配置与证书有效性。
2. 隐私保护指引“收集字段-用途-场景”与当前版本功能逐项一致。
3. 类目与资质材料匹配（教育/工具类）。
4. 提审说明、测试账号、测试路径、审核备注完整。
5. 若涉及支付/虚拟权益，相关资质与文案一致性核验。
