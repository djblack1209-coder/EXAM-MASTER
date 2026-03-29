# 微信小程序 文档摘要缓存

## 主包大小限制

- **来源**：https://developers.weixin.qq.com/miniprogram/dev/framework/subpackages/basic.html
- **结论**：主包不超过 2MB，每个分包不超过 2MB，所有分包总计不超过 20MB。静态资源（图片/字体）也算在包大小里。ECharts 等大型库必须放分包或使用自定义构建。
- **日期**：2026-03-29

## 隐私权限声明（2023年9月后强制）

- **来源**：https://developers.weixin.qq.com/miniprogram/dev/framework/user-privacy/
- **结论**：使用 `wx.chooseImage`、`wx.getLocation`、`wx.chooseMessageFile` 等涉及用户隐私的 API 前，必须在 `app.json` 中配置 `"usePrivacyCheck": true`，并在调用前弹出隐私授权弹窗。否则 API 调用会静默失败。
- **日期**：2026-03-29

## wx.request 注意事项

- **来源**：https://developers.weixin.qq.com/miniprogram/dev/api/network/request/wx.request.html
- **结论**：并发限制 10 个。超时时间默认 60s，可通过 `timeout` 参数设置。域名必须在小程序后台配置白名单。`dataType` 默认 `json`，会自动 JSON.parse。
- **日期**：2026-03-29
